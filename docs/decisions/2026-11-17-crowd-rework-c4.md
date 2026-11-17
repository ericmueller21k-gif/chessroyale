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

**Eric, Nov 17 (via the director), a change to the brief:** "Fine to remove but we may bring this back and remove the modes we are
building now. For the majority mode I wonder if we should still use this, so it almost always does the majority but sometimes the
2nd or 3rd option." So **Majority is the old draw** (`crowdPickOdds("majority")` → `crowdTopOdds` with `majorityOf(settings)`: the
most-picked at `crowdSureShare` 0.7 of the real picks or more, always; else the top `crowdPlayedFromTop` 3 by their picks; a miss's
pick never counts), Strong and Chaos as built, and **the guard "a big majority always wins" holds in Majority**: `crowd-afk.test.ts`
runs on the 50 v 50's settings with `crowdPick: "majority"`. The vote card's blurb: "Your team's top pick, sometimes 2nd or 3rd".

**Calls made here:**
- **The old draw's settings stay** (`crowdPlayedFromTop`, `crowdSureShare`, `crowdTopOdds`): Majority reads them, one setting away
  from the old way if Eric brings it back. **`finalFormat`, `teamFinal*`, `CROWD_KNOCKOUTS`, `CROWD_STAGE_ROUNDS` and
  `CROWD_PRE_REWORK` stay too:** the FAQ and the home page's 50 v 50 text (reached) read them until C3 rewrites them, and
  `bot-replays.ts` plays on `CROWD_PRE_REWORK`. The runner's final code (unreached) stays with them; one small PR after C3 can take
  the endings' settings, `CROWD_PRE_REWORK` and that code together.
- **`bot-replays.ts` stays:** it makes the home page's live-window replays (`replays:bots`), still old 50 v 50 matches; re-recording
  them on the rework is C3's or a follow-up's.
- The Hidden Boss's own code, his room's fight and its tests (`recluse-online.test.ts`, `hidden-boss-room.spec.ts`,
  `recluse.spec.ts`) are untouched.
