# Security Model

GrantVault has no administrator, no off-chain adjudicator, and no operator signer.
The funder controls a vault only while it is in OPEN state. Once the maintainer
accepts, settlement follows the contract state machine and GenLayer validator consensus.

## Trust boundaries

**What GrantVault trusts:**
- The npm public registry (`registry.npmjs.org`) as an authoritative, independently-operated source of package metadata.
- GenLayer validators to independently re-derive verdict fields and compare them.

**What GrantVault explicitly does not trust:**
- Any caller-supplied URL or evidence. The registry URL is constructed by the contract from locked, validated identifiers. Callers cannot inject arbitrary fetch targets.
- The maintainer's description of what they shipped. The contract fetches the registry record itself.
- The funder's description, package name or publisher name as instructions. These are sanitized and the description is wrapped with `<<<UNTRUSTED_..._START/END>>>` delimiters before any LLM prompt.

## Evidence binding

The only fetch is `https://registry.npmjs.org/{package}`, built from the locked package name. The package-level document is required because `time[version]` exists only there; the version-level document has no `time` field (captured in `tests/fixtures/`).

- **Identity echo (Rule 0.8):** the document's `name` and the release record's `name`/`version` must equal the locked values, otherwise `NOT_GRANTED`.
- **Release window:** `accepted_at <= published_at <= deadline`. `accepted_at` is block time at acceptance, so a release that existed before the agreement can never qualify (`BEFORE_WINDOW`), and a late one is `LATE`.
- **Commitments:** `source_digest` is SHA-256 of the canonical JSON of a fixed whitelist of the registry's release record (name, version, description, keywords, license, repository, gitHead, dependency maps, scripts, bin, main, dist integrity/shasum/fileCount/unpackedSize, `_npmUser.name`) plus `time[version]`; volatile fields (dist-tags, deprecation, other versions) are excluded so independent validators agree. `decision_digest` commits to the decision inputs (vault terms, `accepted_at`, deadline, description hash, publisher found, publish time, bump, `source_digest`). The release facts the model saw are stored with each attempt.

## Economic invariants

- Reward is locked at vault creation; terms are immutable after that.
- Funder and maintainer must be distinct addresses.
- Only the designated maintainer can accept and submit.
- Funder cannot cancel after acceptance.
- Only `GRANTED` creates a maintainer entitlement.
- `NOT_GRANTED` and `INCONCLUSIVE` do not move funds. The vault stays ACTIVE for another attempt until the deadline.
- A `(vault_id, version)` pair with a conclusive verdict (`GRANTED` or `NOT_GRANTED`) cannot be re-submitted (replay protection via `seen` TreeMap). An `INCONCLUSIVE` attempt does not seal the version, so it can be retried after the registry recovers; attempts per vault are capped at 25.
- Withdrawal (`claim_funds`) checks the entitlement, requires the contract balance to cover all liabilities, zeroes and persists the entitlement BEFORE `emit_transfer`, and allows only one dispatch in flight.
- `PAYOUT_DISPATCHED` / `REFUND_DISPATCHED` mean "emitted, delivery unproven". They become `*_SETTLED` only through `confirm_delivery`, which requires the contract surplus (balance minus liabilities) to have dropped below its value at dispatch.
- A dispatched vault cannot be claimed again. `recover_dispatch` re-opens it only after 7 days and only if the surplus did not drop, at most 3 times per vault.
- All `TreeMap` keys derived from addresses are normalized to lowercase hex at every write and read site (Bug 10 guard).

## Untrusted input handling

All user-submitted text (description, publisher name, package name) is sanitized:
- Control characters stripped.
- Code fences (`\`\`\``) replaced with `'''`.
- Injection markers (`[SYSTEM]`, `<|`) neutralized.
- Length capped at 480 chars for descriptions, 128 chars for publisher names.

The qualitative pass receives the wrapped description and the wrapped release facts computed in code from the registry record (registry-authored text such as the release description is included, inside the untrusted wrapper). It must answer `INCONCLUSIVE` when those facts cannot establish the described requirement. Tarball contents and changelogs are not read.

## npm registry availability

The npm registry is an external authority. It can be unavailable, rate-limited, or temporarily inconsistent. The contract returns `INCONCLUSIVE` when reliable evidence cannot be obtained. `INCONCLUSIVE` does not pay out or refund — the vault stays active for another attempt.

Consensus compares outcome, publisher_found, published_at, bump_detected, source_digest, decision_digest and the stored release facts. The free-form explanation is only length-checked. Very large package documents may fail to fetch; that degrades to `INCONCLUSIVE`.

## Fail-safe time

`_require_now()` raises `Block time unavailable` when `gl.message_raw["datetime"]` cannot be parsed. Create, accept, cancel, expire, evaluate and claim all use it, so none runs on a zero timestamp.

## Settlement architecture

1. `claim_funds(vault_id)`: role check, entitlement check, `self.balance >= liability`, no other dispatch in flight; debits entitlement and claimable balance, records `dispatched_amount`, `dispatched_at` and `dispatch_surplus`, then `emit_transfer(value=amount)` once.
2. `confirm_delivery(vault_id)` (anyone): `surplus = balance - liability`; if `surplus < dispatch_surplus` the GEN left, so liability is reduced and the vault is `*_SETTLED`; otherwise it reverts.
3. `recover_dispatch(vault_id)` (anyone): after 7 days, if `surplus >= dispatch_surplus`, re-credits the entitlement and returns the vault to `PAYABLE`/`REFUNDABLE`.

External transfers are emitted at finalization, so confirmation is only possible after finality. Deposits raise balance and liability equally and cannot fake delivery. Only a donation at least as large as the payout can make a delivered transfer look undelivered; the vault then stays blocked until recovery, and the repeat payout is funded by the donation (the invariant `balance >= liability` is checked first), never by another vault. One dispatch at a time is a deliberate liveness trade-off. The harness simulates delivery; a real StudioNet run is still required (docs/E2E_STUDIONET.md).
