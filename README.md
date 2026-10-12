<div align="center">

<br />

<img src="public/favicon.svg" width="64" height="64" alt="GrantVault logo" />

<h1>GrantVault</h1>

<p><strong>npm release escrow on GenLayer — no backends, no adjudicators, no trust required.</strong></p>

<p>
  <a href="https://explorer-studio.genlayer.com"><img src="https://img.shields.io/badge/network-GenLayer%20Studionet-6366f1?style=flat-square" alt="Network" /></a>
  <img src="https://img.shields.io/badge/chain%20id-61999-8b5cf6?style=flat-square" alt="Chain ID" />
  <img src="https://img.shields.io/badge/contract-grantvault.py-0ea5e9?style=flat-square" alt="Contract" />
  <img src="https://img.shields.io/badge/tests-101%20passing-22c55e?style=flat-square" alt="Tests" />
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
2. Maintainer accepts     →  ACTIVE      (funder can no longer cancel)
3. Maintainer submits     →  evaluation  (validators fetch npm registry, reach consensus)
4a. GRANTED               →  PAYABLE     (maintainer claims reward once)
4b. NOT_GRANTED           →  ACTIVE      (try again with a different version)
4c. INCONCLUSIVE          →  ACTIVE      (try again; evidence was unavailable)
5. Deadline passes        →  EXPIRED     (funder reclaims reward)
```

---

## Evidence boundaries

The npm registry URL is constructed by the contract from locked identifiers:

```
https://registry.npmjs.org/{package}/{version}
```

Callers cannot supply arbitrary evidence URLs. The contract:

1. Fetches the version-specific record.
2. Verifies the record's own `name` and `version` fields match the locked values (**Rule 0.8**).
3. Checks `_npmUser.name` against the locked publisher identity.
4. Parses the `time[version]` field (integer arithmetic only — no `float()`) against the deadline.
5. Fetches the full packument to determine the semver bump type.
6. Runs an LLM qualitative pass only after all five hard checks pass.

Evidence content is wrapped with `<<<UNTRUSTED_..._START/END>>>` delimiters. Package names, descriptions, and changelogs are never instructions to validators.

---

## Network

| Property | Value |
|---|---|
| Network | GenLayer Studionet |
| Chain ID | `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Explorer | `https://explorer-studio.genlayer.com` |
| Contract | `contracts/grantvault.py` |
| Deployed address | [`0xeA2107a2c4Dd3d58cD296E42771EeA7caAf45Add`](https://explorer-studio.genlayer.com/address/0xeA2107a2c4Dd3d58cD296E42771EeA7caAf45Add) (set in `src/config/chains.ts`) |

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
genvm-lint check contracts/grantvault.py
pytest tests -q -p no:cacheprovider
```

101 tests covering:

- Creation guards (zero reward, self-funder, invalid bump, short description)
- Accept / cancel lifecycle and role authorization
- All three verdict paths (`GRANTED`, `NOT_GRANTED`, `INCONCLUSIVE`)
- Replay protection (a version with a conclusive verdict is sealed) and INCONCLUSIVE retry, plus the 25-attempt cap
- Bump detection, including backport releases and prerelease baselines
- Bug 1 regression: HTTP error body must not reach the LLM prompt
- Untrusted wrapping: description must appear inside `<<<UNTRUSTED_..._START/END>>>` delimiters
- Validator agreement and rejection (outcome mismatch, thin reasoning, leader error, unknown verdict)
- Settlement accounting (exact amount and recipient on claim after GRANTED, double-claim blocked, refund after cancel and after expiry, wrong-claimant rejection)
- Storage pickling check (Bugs 4/5/6: no storage-backed value crosses the nondet closure)
- Wallet index (`get_for_wallet` returns correct vaults for funder and maintainer)

Tests mock the npm registry and LLM. They prove Python logic and validator agreement rules. They **do not** prove real LLM behavior, real npm registry responses, or live network availability. No live deployment has been exercised yet.

---

## Repository structure

```
contracts/
  grantvault.py          GenLayer intelligent contract
docs/
  DEPLOYMENT.md          Deploy instructions and address registry
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
tests/
  test_direct.py          101 direct-mode GenVM tests
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
