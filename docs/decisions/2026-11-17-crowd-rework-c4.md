# The 50 v 50 rework, C4: the old endings' tests and sims retired (Nov 17, 2026)

Step C4 of `notes/designs/crowd-rework.md`, on the C2 branch (same PR). Eric, Nov 16: "We're doing away with the hidden boss on that
for now." Since C2 no 50 v 50 reaches a team final, boss final or duel, so the tests and sims that only played those endings go.

**Retired:** e2e `formats.spec.ts` "team final…", `crowd-hidden.spec.ts` (all three; its `areas.json` and `ci-timings.json` entries);
unit `crowd.test.ts` (team final, leaving in the final, duel, both boss finals), `opening-vote.test.ts` (the finals after a Freestyle
game), `lobby.test.ts` (the boss final online), `crowd-hidden-boss.test.ts` (whole file), `fairplay-lobby.test.ts` (a final's
premoves), `cut-ties.test.ts` (the team final's steps; the knockout cut's "ending reached exactly"), `results-rows.test.ts` (the
endings' rows); the sims `crowd-sim`, `allowance-sim`, `crowd-bots-sim`, `crowd-spread-probe`, `crowd-scoring-sim`,
`crowd-scoring-trace` (their reports stay as history).

**Moved onto the rework instead of retired** (they test something still live): the clock vote's and rising clock's runner tests, the
weak-bots cut and cut-plan tests, the bubble grace, the 1 v 1's results row, and the boss final's profile checks (eval bar, cuts,
best move) into "the 50 v 50 rework online".

**Calls made here:**
- **The settings stay for now** (`crowdPlayedFromTop`, `crowdTopOdds`, `crowdSureShare`, `finalFormat`, `teamFinal*`,
  `CROWD_KNOCKOUTS`, `CROWD_STAGE_ROUNDS`) **and so does `CROWD_PRE_REWORK`**: Eric's guard "a big majority always wins" reads the
  old draw (waiting for his OK, asked Nov 17), and the FAQ and the home page's 50 v 50 text (reached) still read the endings' settings
  until C3 rewrites them. The runner's final code (unreached) stays with them. Once C3 lands and Eric answers, one small PR takes
  the settings, `CROWD_PRE_REWORK`, the final code and their last tests together.
- **`bot-replays.ts` stays:** it makes the home page's live-window replays (`replays:bots`), still old 50 v 50 matches; re-recording
  them on the rework is C3's or a follow-up's.
- The Hidden Boss's own code, his room's fight and its tests (`recluse-online.test.ts`, `hidden-boss-room.spec.ts`,
  `recluse.spec.ts`) are untouched.
