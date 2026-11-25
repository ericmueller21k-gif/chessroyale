# Fewer PRs run the whole e2e suite (Nov 6, 2026)

The pipeline audit (Nov 6, proposal 2): 10 of 17 merged PRs ran everything; PR e2e median 33.6 min.
The call: `packages/core/src` (but `index.ts`) and the server's accounts, api, account-data, locker, boss-tokens and
ranked modules are traced, not foundations; a CI-only change (e2e.yml, `e2e/ci-*`) runs the smoke set; 11 files no area
had (Walkthrough, tutorial, welcome-rows, …) joined their areas. `ledger.ts` is listed in `full` outright: money is the
full lane (CLAUDE.md). Replayed over Nov 6's 22 merges: full runs 12 → 8 (the 8: money or stored data reaching the
server's index.ts, App.tsx hub changes, main.tsx, the Playwright config). Main still runs everything after each merge.
