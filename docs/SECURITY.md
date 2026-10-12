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

The fetch URL is `https://registry.npmjs.org/{package}/{version}` — constructed deterministically from the locked package name and the submitted version string. No other URL is ever fetched for the primary verdict.

**Rule 0.8 check:** the fetched record's own `name` and `version` fields are compared to the locked values before any further check. A registry record that does not echo the claimed identifiers produces `NOT_GRANTED`.

## Economic invariants

- Reward is locked at vault creation; terms are immutable after that.
- Funder and maintainer must be distinct addresses.
- Only the designated maintainer can accept and submit.
- Funder cannot cancel after acceptance.
- Only `GRANTED` creates a maintainer entitlement.
- `NOT_GRANTED` and `INCONCLUSIVE` do not move funds. The vault stays ACTIVE for another attempt until the deadline.
- A `(vault_id, version)` pair with a conclusive verdict (`GRANTED` or `NOT_GRANTED`) cannot be re-submitted (replay protection via `seen` TreeMap). An `INCONCLUSIVE` attempt does not seal the version, so it can be retried after the registry recovers; attempts per vault are capped at 25.
- Withdrawal (`claim_funds`) checks the agreement-specific entitlement before emitting. The entitlement is zeroed and persisted BEFORE `emit_transfer` is called — no retry path.
- `PAYOUT_DISPATCHED` and `REFUND_DISPATCHED` are honest dispatch records. The contract cannot inspect the asynchronous child receipt and does not offer a retry.
- All `TreeMap` keys derived from addresses are normalized to lowercase hex at every write and read site (Bug 10 guard).

## Untrusted input handling

All user-submitted text (description, publisher name, package name) is sanitized:
- Control characters stripped.
- Code fences (`\`\`\``) replaced with `'''`.
- Injection markers (`[SYSTEM]`, `<|`) neutralized.
- Length capped at 480 chars for descriptions, 128 chars for publisher names.

The qualitative LLM pass receives only the wrapped description and facts the contract has already checked deterministically; raw registry text is never passed to the model. The evidence digest is a SHA-256 over the derived facts (publisher, publish time, bump).

## npm registry availability

The npm registry is an external authority. It can be unavailable, rate-limited, or temporarily inconsistent. The contract returns `INCONCLUSIVE` when reliable evidence cannot be obtained. `INCONCLUSIVE` does not pay out or refund — the vault stays active for another attempt.

Consensus compares outcome, publisher_found, published_at, bump_detected, and evidence_digest. The free-form explanation is not consensus-critical.

## Settlement architecture

`claim_funds(vault_id)` is the only value-emitting method. It is vault-specific and one-shot:
1. Checks that the sender matches the correct role for the vault's current state.
2. Reads the agreement-specific entitlement.
3. Zeros and persists the entitlement and the sender's claimable balance.
4. Writes the vault's dispatch state.
5. Calls `emit_transfer(value=amount, on="finalized")` exactly once.

There is no `retry_transfer`, no `confirm_transfer`, and no admin override. A child receipt failure is not automatically refunded.
