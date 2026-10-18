# Deployment

## Contract

### Deploy to GenLayer Studionet

1. Go to [https://studio.genlayer.com/contracts](https://studio.genlayer.com/contracts).
2. Upload `contracts/grantvault.py`.
3. Click **Deploy** — no constructor arguments required.
4. Copy the deployed contract address.

The contract in this repository has a new ABI (`confirm_delivery`, `recover_dispatch`, `get_settlement`, new attempt and vault fields). The address below is the earlier deployment; it predates these changes, so deploy the current file and update `src/config/chains.ts` before using the app. StudioNet is a temporary network: addresses may not survive resets, so the repository tests are the proof of behavior, not the address.

```
Superseded address (old ABI, do not use): 0xeA2107a2c4Dd3d58cD296E42771EeA7caAf45Add
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
genvm-lint download --version v0.2.16
genvm-lint check contracts/grantvault.py
genvm-lint typecheck contracts/grantvault.py
pytest tests -q -p no:cacheprovider
```

The tests pin GenVM v0.2.16 (`sdk_version` in every deploy). Unpinned, `genlayer-test` resolves GitHub's latest GenVM release, which can be a release candidate whose bundle is not published.

Do **not** run with `-s`. Do **not** use a GitHub-main checkout of genlayer-test.

The suite runs 160 tests (see README "Contract tests" for the list), including two real registry.npmjs.org responses in `tests/fixtures/`.

Tests mock the npm registry and LLM, and the harness simulates value delivery. They prove Python logic, validator agreement rules, the release window, the evidence commitments, fail-safe time handling and settlement accounting. They do **not** prove real LLM behavior, live registry behavior for very large package documents, multi-node consensus timing, or real chain delivery. No live StudioNet run is recorded for the current contract; use docs/E2E_STUDIONET.md.

## Known V1 limitations

- Public npm packages only.
- One funder and one designated maintainer per vault.
- Publisher identity is determined by `_npmUser.name` in the release record of the package-level registry document. This field is set by npm at publish time and reflects the npm account that ran `npm publish`. It is authoritative for npm's own records but is not a cryptographic proof.
- npm registry availability and unauthenticated API rate limits can produce `INCONCLUSIVE` outcomes.
- External transfers are asynchronous and emitted at finalization. The contract emits one transfer per dispatch, proves delivery from its own balance (`confirm_delivery`), and re-opens a transfer that never left only after 7 days (`recover_dispatch`). Only one dispatch can be in flight across all vaults.
- The qualitative judgment reads registry facts (dependency changes, file counts, test script, description), not tarball contents or a changelog; requirements those facts cannot show produce `INCONCLUSIVE`.
- Very large package documents may fail to fetch and degrade to `INCONCLUSIVE`.
- No private packages, no multi-maintainer vaults, no reputation system.
