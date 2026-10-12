# Deployment

## Contract

### Deploy to GenLayer Studionet

1. Go to [https://studio.genlayer.com/contracts](https://studio.genlayer.com/contracts).
2. Upload `contracts/grantvault.py`.
3. Click **Deploy** — no constructor arguments required.
4. Copy the deployed contract address.

The production contract address will be recorded here after deployment.

```
Production address: 0xeA2107a2c4Dd3d58cD296E42771EeA7caAf45Add (https://explorer-studio.genlayer.com/address/0xeA2107a2c4Dd3d58cD296E42771EeA7caAf45Add)
Network: GenLayer Studionet
Chain ID: 61999
RPC: https://studio.genlayer.com/api
Explorer: https://explorer-studio.genlayer.com
```

### Configure the frontend

Set the contract address in `src/config/chains.ts`:

```ts
export const CONTRACT_ADDRESS = "0xYOUR_DEPLOYED_ADDRESS" as `0x${string}`;
```

This is the single source of truth for the address. It is never read from `.env`.

## Frontend

### Local development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### Production build

```bash
npm run build
```

Deploy the `dist/` folder to Netlify, Vercel, or any static host.

For Vercel: the repository already includes a `vercel.json` with the SPA rewrite:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

## Contract tests

Requires Python 3.10+ and network egress (first run downloads the GenVM SDK bundle).

```bash
pip install "genlayer-test==0.29.2" genvm-linter
genvm-lint check contracts/grantvault.py
pytest tests -q -p no:cacheprovider
```

Do **not** run with `-s`. Do **not** use a GitHub-main checkout of genlayer-test.

The suite runs 101 tests: creation guards, accept/cancel lifecycle, all three verdict paths, the status vs status_code regression (valid record behind HTTP 403/404/429/500/503), bump detection including backport releases, INCONCLUSIVE retry and the attempt cap, untrusted wrapping, validator agreement and rejection (each compared field changed in isolation), exact payout/refund amounts and recipients, double-claim and wrong-claimant protection, case-insensitive wallet lookups, and the storage pickling check (Bugs 4/5/6).

Tests mock the npm registry and LLM. They prove Python logic and validator agreement rules. They do **not** prove real LLM behavior, real npm registry responses, multi-node consensus timing, or a live Studionet deployment; no live transaction has been run for this build.

## Known V1 limitations

- Public npm packages only.
- One funder and one designated maintainer per vault.
- Publisher identity is determined by `_npmUser.name` in the version-specific registry record. This field is set by npm at publish time and reflects the npm account that ran `npm publish`. It is authoritative for npm's own records but is not a cryptographic proof.
- npm registry availability and unauthenticated API rate limits can produce `INCONCLUSIVE` outcomes.
- External transfer children are asynchronous. The contract emits exactly one transfer per vault entitlement and records the dispatch state. A child failure is not automatically refunded.
- No private packages, no multi-maintainer vaults, no reputation system.
