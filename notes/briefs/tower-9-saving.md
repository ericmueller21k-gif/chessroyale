# Battle Tower PR 9: saving (Nov 19). Opus, xhigh, alone. FULL lane (stored data: full-e2e, an independent review, delta re-reviews)

Read CLAUDE.md, `.claude/LESSONS.md`, the design `docs/decisions/2026-11-18-battle-tower-design.md` §5 (saving; the party only as far as
the schema needs it) and §3 rewards (not built here), `docs/areas/battle-tower.md`, `docs/areas/accounts.md`, and core `tower.ts` (PR 8:
`TowerRun`, `newRun`, `startFloor`, `finishFloor`, `leaveFloor`, `towerPool`). Branch `claude/tower-saving` from main.
- **Server `packages/server/src/tower.ts`:** `TOWER_SCHEMA` (`tower_runs`, `tower_best`, the unique open-run index, as the design;
  `met` holds core's `TowerRun` deal state: floors dealt, deck, decks), `CREATE TABLE IF NOT EXISTS` as `boss-tokens.ts` does; registered
  in `account-data.ts` (export and delete) and the sign-in merge (`accounts.ts`: a guest's open run and bests move to the account;
  two open runs of one kind: keep the higher floor, the other `abandoned`; bests: the max).
- **Routes** (`index.ts`): `GET /api/tower`, `POST /api/tower/run` (new; replaces an open one only with `confirm`), `POST
  /api/tower/floor/start` (the server notes the start: `fight`), `/finish` (a result only for the floor it started; won → next floor
  dealt by core; lost/drawn → out; best updated), `POST /api/tower/stop` (between floors: nothing to do but a clean answer; mid-floor
  before the 2nd move: free leave, the same bosses later; after: a loss, per core `leaveFloor`). Rate limits and the guest cookie as
  the other account routes. The seed from the server, never the device. The pool from the server's kill switches.
- **Solo only here:** party rows (`kind 'party'`, `members`) exist in the schema but nothing writes them (PR 12). No rewards, no
  emblems, no crates (later PRs). The device-side restore of a floor mid-game is PR 10's.
- **Trust:** a device reports a solo floor's result, as `finishSoloBattle` does today (the device's word: the design pays solo no
  bonus); the server checks it's the started floor, its time sane (as Boss alone's checks), and never accepts a second finish.
- **Tests:** server unit tests with the D1 test double the other tables use: schema, every route's happy path and refusals, the
  merge, export/delete, the one-open-run index, a replayed finish refused, a free leave vs a counted leave. Add the area to
  `e2e/areas.json` if you add an e2e check (one focused API check in an existing spec at most; no new screens).
Effort xhigh. Decision note about five lines per call. Area pages battle-tower.md and accounts.md. Done: `.pr-body.md` (Lane: FULL;
what changed; changed checks old → new; under 60 lines) and `.done`; push and end. No PRs, no CI waits. `.question` for anything
only Eric decides (accounts or money).
