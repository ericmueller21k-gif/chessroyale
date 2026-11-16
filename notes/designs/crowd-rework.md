# 50 v 50 rework: the pick vote, equal cuts to a 1 v 1, a soft reset, the podium, RP (design, Nov 16, 2026)

Design only (director's lane, brief `notes/briefs/crowd-rework-design.md`); read against main at b6582a7. Sim:
`packages/sim/scripts/crowd-rework-sim.ts` → `reports/crowd-rework.md` (this branch). Mockup: `notes/mockups/crowd-podium.png`.
Feeds the rank engine of `design/mode-ranks` (`notes/designs/mode-ranks.md`).

## 1. The rules

1. **Votes before move 1:** "How are moves picked?" replaces "How does it end?"; the start and speed votes stay. Nobody votes: Strong.
   - **Strong:** the team's 3 most-picked moves (a tie for 3rd: the better-scored). The judge's best of them is played; any other
     within **3% expected score** (about 30 cp) of it is "close", and one of the close ones is drawn, equal odds. Today's 70% sure
     share and 60/30/10 odds go.
   - **Majority:** the most-picked move; a tie is drawn among the tied (today's `popular` rule with one move).
   - **Chaos:** one of the distinct moves the team picked, each equally likely (not weighted by picks).
   - In every mode a miss's move picked for it never counts (today's AFK rule); nobody on the team picked: one of the engine's top 5.
2. **One game, played to its end:** mate, stalemate or a draw by the rules, or the **move limit**: after Black's 60th move it's a
   draw on the board. No team final, Hidden Boss final or duel. A game that ends early ends the match for everyone still in.
3. **Cuts, equal from each side:** after moves **14, 18, 22, 26, 30, 33, 36 and 39** each side keeps **34, 23, 15, 10, 6, 4, 2, 1**.
   Each side's players are ranked by their round score, which is already relative to their own team (team average − yours,
   today's `scoreGroup`); today's tie rules stay (ties at the line go through and the places owed carry to later cuts; the last
   cut is exact: raw loss, then time, then a coin). The first cut is at 14 because the opening allowance is gone by then (see 6).
   **From move 40 the 1 v 1:** each side's last player picks alone and their pick is played (the pick mode no longer matters).
4. **Soft reset:** at each cut, each survivor keeps **50%** of their score; the round's play adds to it.
5. **Places:** those still in at the end first: the winning side's, then the losing side's (a draw: together), each by score; then
   each cut's players from the last cut back, both sides together, by their score at that cut. In the 1 v 1 the winner is 1st;
   drawn, the better whole-match score is. **Winner:** 1st place of a won game (a drawn game has none). **Best player:** the lowest
   counted points given away a move over the match, among those who survived at least half the cuts made.
6. **The podium (results):** 1st on the tallest pedestal in the middle, 2nd left, 3rd right, each a pawn in their side's color with
   their name and points a move; a "Winner" tag on 1st, a "Best player" tag on whoever it is (one player: both tags). A best player
   off the podium gets the fixed line under it ("★ Best player: Nadia K. · 7th · 0.71 a move"; the line is always there, "Best
   player: the winner" when it's them). Under it, your row (place, out at move, points a move, RP) and the full chart of 100 in a
   fixed box that scrolls inside, your row pinned at its foot. Nothing moves when it fills (Eric's rules).
7. **RP** (mode-ranks M1's engine): your actual vs Glicko-expected result against each real player outside your party, from the
   places; a pair split by a cut whose relative scores at that cut were within **1 point** (the **tie band**) counts as a draw.
   RP = 40 × (S − E) + catch-up, as 1 v 1.

## 2. What the sim says (`reports/crowd-rework.md`; FILL)

FILL

## 3. What changes in today's code

- **core `votes.ts`:** the `format` vote ("How does it end?": team / boss / duel) becomes `pick` ("How are moves picked?": strong /
  majority / chaos), patching a new `crowdPick` setting; `bossFinalOption`, `crowdFinalists` go for 50 v 50.
- **core `settings.ts`:** `CROWD_CUTS` (after, keep) replaces `CROWD_STAGE_ROUNDS` / `CROWD_KNOCKOUTS` for 50 v 50; `crowdCarry` 0.5;
  `crowdMoveLimit` 60; `CROWD_PICK.strongClose` 0.03; `rankTieBand` 1 (with the mode ranks). `crowdPlayedFromTop`, `crowdTopOdds`,
  `crowdSureShare`, `finalFormat`, `teamFinal*`, `recluseChild` leave `CROWD_SETTINGS` (raids keep what they use).
- **core `match.ts`:** the played move by `crowdPick` (the `popular` draw's branch, using the judge's numbers for Strong); `endStage`
  multiplies survivors' scores by the carry (streaks untouched); the end's places (side result, then score); `bestPlayer()`.
- **chess `runner.ts`:** 50 v 50 never enters a final (`isFinal`, `startBoss` for the crowd final, the team final's steps, the duel);
  the move limit ends the game as a draw; the 1 v 1 is an ordinary stage with one player a side.
- **protocol `protocol.ts`:** the vote's new id; `results` gains optional `podium { winner?: id; best: id }` and per player
  `outAtMove`, `perMove`. Optional fields only: old apps ignore them.
- **server `lobby.ts`:** the vote's patch, the move-limit end, places written in the new order (no schema change); the 50 v 50 boss-final
  path (the Hidden Boss's child, man and phase 2 online) is no longer reached (see question 3).
- **app:** `Vote.tsx` cards come from the data; the top bar's countdown ("Move 31 · cut in 2", "1 v 1 from move 40"); one banner at
  the 1 v 1; `Results.tsx` the podium, the best-player line and the chart (fixed heights); the FAQ.

**Build steps** (one `xhigh` helper at a time):

| Step | What | Lane, effort |
| --- | --- | --- |
| C1 | core: the pick vote and modes, the cut schedule, carry, move limit, places, best player; unit tests (`votes`, `cut-ties`, `crowd-bot-spread`, a new `crowd-rework.test.ts`) | targeted, xhigh |
| C2 | runner + server + protocol: no endings in 50 v 50, the limit, the 1 v 1 stage, results' optional fields; `crowd.test`, `lobby.test`, `resign.test` | targeted (optional protocol fields), xhigh |
| C3 | screens: vote cards, top bar, the 1 v 1 banner, the podium results and chart (from this mockup), FAQ; e2e `crowd.spec`, `formats.spec`, `votes.spec`, a podium check at 320 / 390 / 1280 | targeted, high |
| C4 | retire the 50 v 50 endings: `crowd-hidden.spec`, the endings' unit tests, dead settings; `e2e/areas.json` | targeted, medium |
| C5 | RP: mode-ranks M1-M3 with these places and the tie band | ranked, **full lane**, xhigh |

## 4. Risks

FILL

## 5. Questions for Eric (each with a default)

FILL
