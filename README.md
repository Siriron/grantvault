<div align="center">

<br />

<img src="public/favicon.svg" width="64" height="64" alt="GrantVault logo" />

<h1>GrantVault</h1>

<p><strong>npm release escrow on GenLayer — no backends, no adjudicators, no trust required.</strong></p>

<p>
  <a href="https://explorer-studio.genlayer.com"><img src="https://img.shields.io/badge/network-GenLayer%20Studionet-6366f1?style=flat-square" alt="Network" /></a>
  <img src="https://img.shields.io/badge/chain%20id-61999-8b5cf6?style=flat-square" alt="Chain ID" />
  <img src="https://img.shields.io/badge/contract-grantvault.py-0ea5e9?style=flat-square" alt="Contract" />
  <img src="https://img.shields.io/badge/tests-160%20passing-22c55e?style=flat-square" alt="Tests" />
  <img src="https://img.shields.io/badge/license-MIT-f59e0b?style=flat-square" alt="License" />
</p>

<br />

</div>

---

## What it does

A **funder** locks GEN tokens with a promise: if a designated open-source **maintainer** ships a specific npm package release by a deadline, the reward is automatically unlocked.

When the maintainer submits a version, GenLayer validators **independently** fetch the public npm registry, verify publisher identity, publish timestamp, and semver bump type, then reach consensus on whether the grant condition is met.

There is no administrator, no off-chain server, no dispute court, and no way for either party to unilaterally decide the outcome.

---

## Why GenLayer

The important question is not a simple API lookup: **does this exact release substantively satisfy the grant terms that were agreed before work began?**

Funder and maintainer have opposing financial incentives — neither can be trusted to decide alone. GenLayer validators independently retrieve npm registry evidence and reproduce the decision through consensus.

| Outcome | Meaning |
|---|---|
| `GRANTED` | Publisher match, release published inside the accepted-to-deadline window, semver bump ok, release facts support the description — reward payable |
| `NOT_GRANTED` | A hard check failed (wrong publisher, published before acceptance or after the deadline, bump too small, identity mismatch) or the facts contradict the description — vault stays active for another version |
| `INCONCLUSIVE` | Evidence unavailable, version not in the registry yet, or the registry facts cannot establish what the description promises — vault stays active, no funds moved |

---|---|
| `GRANTED` | Publisher match, deadline met, semver bump ok, qualitative check passed — reward payable |
| `NOT_GRANTED` | A hard check failed or qualitative intent clearly unmet — vault stays active for another attempt |
| `INCONCLUSIVE` | Evidence unavailable or ambiguous — vault stays active, no funds moved |

---

## Architecture

```
browser wallet (EIP-1193)
    │
    ▼
React + Vite frontend (this repo)
    │  genlayer-js write/read calls
    ▼
GenLayer Studionet (chain ID 61999)
    │
    ▼
GrantVault intelligent contract (contracts/grantvault.py)
    │  gl.nondet.web.get()
    ▼
registry.npmjs.org  ←  authoritative, validator-independent evidence
    │
    ▼
gl.nondet.exec_prompt()  ←  qualitative LLM pass (after all hard checks)
    │
    ▼
validator consensus  →  verdict recorded on-chain
```

No application backend. No server database. No operator signer. No cron worker.

---

## Lifecycle

```
1. Funder creates vault   →  OPEN        (GEN reward locked, terms immutable)
2. Maintainer accepts     →  ACTIVE      (acceptance time recorded; funder can no longer cancel)
3. Maintainer submits     →  evaluation  (validators fetch the npm package document, reach consensus)
4a. GRANTED               →  PAYABLE     (maintainer claims reward once)
4b. NOT_GRANTED           →  ACTIVE      (try again with a different version)
4c. INCONCLUSIVE          →  ACTIVE      (try again; evidence was insufficient)
5. Deadline passes        →  EXPIRED     (funder reclaims reward)
6. claim_funds            →  *_DISPATCHED  (one transfer emitted, entitlement already debited)
7. confirm_delivery       →  *_SETTLED   (contract balance proves the GEN left)
   recover_dispatch       →  PAYABLE / REFUNDABLE  (after 7 days, only if the balance shows nothing left)
```

---

## Evidence boundaries

One evidence source, one fetch:

| Host | URL pattern | Fetch method | Deciding fields |
|---|---|---|---|
| `registry.npmjs.org` | `https://registry.npmjs.org/{package}` (package locked at creation) | `gl.nondet.web.get` | `versions[v]._npmUser.name`, `time[v]`, all `versions[*]` + `time[*]` for the bump, `versions[v]` release record |

The publish time exists **only** in this package-level document; the version-level document (`/{package}/{version}`) has no `time` field (real captures are in `tests/fixtures/`). Callers cannot supply a URL. The contract:

1. Verifies the document's `name`, and the release record's `name` and `version`, match the locked values (**Rule 0.8**).
2. Checks `_npmUser.name` against the locked publisher.
3. Parses `time[version]` (integer arithmetic only) and requires `accepted_at <= published_at <= deadline`, so a release that existed before the grant was accepted can never satisfy it.
4. Derives the semver bump against the highest stable release below it that was published earlier.
5. Computes release facts in code: description, keywords, dependency additions/removals/changes against the baseline release, file count and unpacked-size change, test-script presence, repository, `gitHead`, tarball integrity.
6. Runs the LLM only after those checks pass; it must return `INCONCLUSIVE` when the facts cannot establish the described requirement. It does not read tarball contents or a changelog.

Two commitments are stored per attempt and compared by every validator: `source_digest` (SHA-256 of the canonical registry release record plus its publish time; recomputable by anyone) and `decision_digest` (SHA-256 of the decision inputs). The compact release facts the verdict used are stored too (`get_attempts`).

Block time that cannot be parsed makes every clocked write revert (`Block time unavailable`); no financial operation runs on a zero timestamp.

Evidence content is wrapped with `<<<UNTRUSTED_..._START/END>>>` delimiters. Package metadata and descriptions are never instructions to validators.

---

## Settlement

`claim_funds` debits the entitlement first, records the contract surplus (balance minus liabilities), emits one transfer, and blocks every other claim until it is resolved. `confirm_delivery` settles the vault only when the contract balance shows the GEN left (the surplus dropped). `recover_dispatch` reopens a dispatch only after 7 days and only if the balance shows nothing left; while a vault is `*_DISPATCHED` it cannot be claimed again, so a duplicate payout needs proven non-delivery first. Known limit: a donation to the contract at least as large as the payout can mask a delivered transfer; the vault then waits until recovery, and the repeat payout comes out of the donation, never another vault's funds. See [docs/SECURITY.md](docs/SECURITY.md).

---

## Network

| Property | Value |
|---|---|
| Network | GenLayer Studionet |
| Chain ID | `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Explorer | `https://explorer-studio.genlayer.com` |
| Contract | `contracts/grantvault.py` |
| Deployed address | [`0x66c85966A4fCfBEEAc43152F0188fb468CC6BD87`](https://explorer-studio.genlayer.com/address/0x66c85966A4fCfBEEAc43152F0188fb468CC6BD87) (set in `src/config/chains.ts`). StudioNet is temporary: addresses may not survive resets, so the repository tests are the proof of behavior, not the address. |

---

## Local setup

```bash
# Frontend
npm install
npm run dev          # http://localhost:5173

# After redeploying the contract, update src/config/chains.ts:
export const CONTRACT_ADDRESS = "0xYOUR_DEPLOYED_ADDRESS" as `0x${string}`;
```

Connect MetaMask or Rabby to chain ID 61999 (`https://studio.genlayer.com/api`).

---

## Contract tests

```bash
pip install "genlayer-test==0.29.2" genvm-linter
genvm-lint download --version v0.2.16
genvm-lint check contracts/grantvault.py
genvm-lint typecheck contracts/grantvault.py
pytest tests -q -p no:cacheprovider        # 160 tests; every deploy pins GenVM v0.2.16
```

The tests execute the real contract under the GenVM SDK in direct mode:

- Creation guards, accept/cancel lifecycle, role authorization, replay protection, INCONCLUSIVE retry, the 25-attempt cap
- **Real npm responses** (`tests/fixtures/`): the is-odd package document is judged end to end, and the real version-level document (no `time` map) can never grant
- Every verdict branch, HTTP 403/404/429/500/503 and invalid bodies never treated as evidence, untrusted wrapping of description and registry text
- **Release window**: before creation, between creation and acceptance, exactly at acceptance, one second early, after the deadline
- **Evidence commitments**: `source_digest` recomputed independently in the test, stable under volatile registry fields, each compared field forged in isolation
- **Release-specific evidence** reaching the model (dependency changes, file counts, test script) and the INCONCLUSIVE instruction
- **Fail-safe time**: unparseable block time reverts create, accept, cancel, expire, evaluate and claim without changing state
- **Settlement**: exact amounts and recipients, solvency refusal, one dispatch in flight, delivery confirmation with a harness-simulated recipient balance increase, withheld delivery, bounded recovery, no duplicate payout, the donation-masking case
- The storage pickling check (Bugs 4/5/6)

Mutation checks run against this suite (each planted bug fails tests, then reverted): `status_code` instead of `status`, no release-window check, validator skipping `source_digest`, accepting an invalid timestamp, `confirm_delivery` without proof, `recover_dispatch` without proof.

The tests mock the registry and the LLM, and the harness simulates value delivery. They do **not** prove real LLM behavior, live npm responses at scale (very large package documents may fail to fetch and degrade to `INCONCLUSIVE`), real multi-node consensus timing, or that a real chain delivers transfers as the harness hook does. The StudioNet end-to-end checklist is [docs/E2E_STUDIONET.md](docs/E2E_STUDIONET.md); it is a runbook with results to record, not a record of completed runs.

---

## Repository structure

```
contracts/
  grantvault.py          GenLayer intelligent contract
docs/
  DEPLOYMENT.md          Deploy instructions and address registry
  E2E_STUDIONET.md       StudioNet end-to-end runbook (results to record)
  SECURITY.md            Trust model and economic invariants
src/
  config/chains.ts       Contract address + chain constants (single source of truth)
  lib/genlayer.ts        Read/write client, transaction tracking
  lib/types.ts           TypeScript types for Vault and VaultAttempt
  lib/wallet.ts          EIP-1193 wallet helpers
  hooks/useWallet.ts     Wallet context
  views/
    HomeView.tsx          Vault list + wallet connect
    NewVaultView.tsx      Create vault form
    VaultView.tsx         Vault detail, evaluation, settlement
    DocsView.tsx          In-app documentation
  components/
    WalletProvider.tsx    Wallet context provider
    StatusBadge.tsx       Status pill component
    TxPanel.tsx           Transaction progress panel
    VaultCard.tsx         Vault summary card
    ErrorBoundary.tsx     Render-error fallback
pytest.ini               Makes unused test mocks fail the suite
tests/
  test_direct.py          160 direct-mode GenVM tests
  fixtures/               real registry.npmjs.org responses
vercel.json              SPA rewrite
README.md
LICENSE
```

---

## Docs

- [Deployment](docs/DEPLOYMENT.md)
- [Security model](docs/SECURITY.md)

---

## License

[MIT](LICENSE)
