# StudioNet end-to-end runbook

Status: **not yet executed for the current contract.** The repository tests (direct mode) are the proof of logic; this runbook
is the live check they cannot replace. Fill the table with real transaction hashes after running it; do not mark a row
without a hash.

Setup: deploy `contracts/grantvault.py` in Studio (Run and Debug works), set `CONTRACT_ADDRESS` in `src/config/chains.ts`,
redeploy the frontend. Use three wallets: funder F, maintainer M, stranger S. Use a real public npm package that M's
npm account publishes, and a deadline several days out.

| # | Step | Expected | Tx hash | Execution result |
|---|---|---|---|---|
| 1 | F `create_vault` with GEN attached | vault OPEN, `get_settlement.liability` = reward, contract balance >= reward | | |
| 2 | M `accept_grant` | ACTIVE, `accepted_at` set | | |
| 3 | M `evaluate_release` with a version that already existed before step 2 | `NOT_GRANTED`, `bump_detected` = `BEFORE_WINDOW` | | |
| 4 | M `evaluate_release` with a version that does not exist yet | `INCONCLUSIVE`, `VERSION_NOT_PUBLISHED` | | |
| 5 | M publishes a new release with the npm account named in the vault, then `evaluate_release` | `GRANTED` (or `INCONCLUSIVE`/`NOT_GRANTED` if the description needs what registry facts cannot show); check `get_attempts`: `source_digest` equals SHA-256 of the canonical release record (see tests `indep_source_digest`) | | |
| 6 | Second vault, wrong `publisher_name` | `NOT_GRANTED` | | |
| 7 | M `claim_funds` on the GRANTED vault | `PAYOUT_DISPATCHED`; M's wallet balance rises by the reward after finalization | | |
| 8 | S `confirm_delivery` after finalization | `PAYOUT_SETTLED`, liability reduced | | |
| 9 | Repeat `claim_funds` | reverts `No funds` | | |
| 10 | Third vault, let the deadline pass, `close_expired`, F `claim_funds`, `confirm_delivery` | `REFUND_SETTLED`, F balance rises | | |
| 11 | Confirm every row above shows `FINISHED_WITH_RETURN` on the receipt (`genlayer receipt <hash> --stdout --stderr`) | no `FINISHED_WITH_ERROR` | | |

Also record: whether `confirm_delivery` succeeds only after the transfer finalizes (it should revert with
`Transfer not yet observed as delivered` before), and how a very large package document behaves.
