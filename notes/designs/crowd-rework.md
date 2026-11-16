# 50 v 50 rework: the pick vote, equal cuts to a 1 v 1, a soft reset, the podium, RP (design, Nov 16, 2026)

Design only (director's lane, brief `notes/briefs/crowd-rework-design.md`); read against main at b6582a7. Sim:
`packages/sim/scripts/crowd-rework-sim.ts` → `reports/crowd-rework.md` (this branch). Mockups: `notes/mockups/crowd-podium.png`, `crowd-cut.png`.
Feeds the rank engine of `design/mode-ranks` (`notes/designs/mode-ranks.md`).

## 1. The rules

1. **Votes before move 1:** "How are moves picked?" replaces "How does it end?"; the start and speed votes stay. Nobody votes: Strong.
   - **Strong:** the team's 3 most-picked moves (a tie for 3rd: the better-scored). The judge's best of them is played; any other
     within **3% expected score** (about 30 cp) of it is "close", and one of the close ones is drawn, equal odds. Today's 70% sure
     share and 60/30/10 odds go.
   - **Majority:** the most-picked move; a tie is drawn among the tied (today's `popular` rule with one move).
   - **Chaos:** one of the distinct moves the team picked, each equally likely (not weighted by picks).
   - In every mode a miss's move picked for it never counts (today's AFK rule); nobody on the team picked: one of the engine's top 5.
2. **One game, played to its end:** mate, stalemate or a draw by the rules, or the **move limit**: after Black's 60th move the
   judge's verdict decides (one side at 75% expected score or more wins, as today's finals adjudicate; otherwise a draw; question 1).
   No team final, Hidden Boss final or duel. A game that ends early ends the match for everyone still in.
3. **Cuts, equal from each side,** after moves **14, 18, 22, 26, 30, 33, 39 and 42**. The stages, from 50 v 50 down (Eric, Nov 16:
   the top 4 a side play longer, the moves taken from the 1 v 1):

   | Stage | 50 v 50 | 34 v 34 | 23 v 23 | 15 v 15 | 10 v 10 | 6 v 6 | **4 v 4** | 2 v 2 | **1 v 1** |
   | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
   | Moves | 1-14 | 15-18 | 19-22 | 23-26 | 27-30 | 31-33 | **34-39** | 40-42 | **43-60** |
   | How many | 14 | 4 | 4 | 4 | 4 | 3 | **6** | 3 | **up to 18** |

   Each side's players are ranked by their round score, which is already relative to their own team (team average − yours,
   today's `scoreGroup`); today's tie rules stay (ties at the line go through and the places owed carry to later cuts; the last
   cut is exact: raw loss, then time, then a coin). The first cut is at 14 because the opening allowance is gone by then (section 2).
   **From move 43 the 1 v 1:** each side's last player picks alone and their pick is played (the pick mode no longer matters).
4. **Soft reset:** at each cut, each survivor keeps **50%** of their score; the round's play adds to it.
5. **Places:** those still in at the end first: the winning side's, then the losing side's (a draw: together), each by score; then
   each cut's players from the last cut back, both sides together, by their score at that cut. In the 1 v 1 the winner is 1st;
   drawn, the better whole-match score is. **Winner:** 1st place of a won game (a drawn game has none). **Best player:** the lowest
   counted points given away a move over the match, among those who survived at least half the cuts made.
6. **The podium (results):** 1st on the tallest pedestal in the middle, 2nd left, 3rd right, each a pawn in their side's color with
   their name and points a move; a "Winner" tag on 1st, a "Best player" tag on whoever it is (one player: both tags). A fixed line
   under the podium always names the best player ("★ Best player: Nadia K. · 7th · 0.71 a move"; "Best player: the winner" when
   it's them), so one off the podium is still shown. Under it, your row (place, out at move, points a move, RP) and the full chart of 100 in a
   fixed box that scrolls inside, your row pinned at its foot. Nothing moves when it fills (Eric's rules).
7. **RP** (mode-ranks M1's engine): your actual vs Glicko-expected result against each real player outside your party, from the
   places; a pair split by a cut whose relative scores at that cut were within **1 point** (the **tie band**) counts as a draw.
   RP = 40 × (S − E) + catch-up, as 1 v 1.
8. **Spectating after a cut** (Eric, Nov 16: "make sure there's a spectate option; I'm sure late game players wanna spectate who
   barely lost to see how it ends"). **Today** (`Crowd.tsx`'s cut screen, crowd.md "Resigning and leaving"): a cut player stays on the
   match screen to the results, with the verdict, "Why was I cut?", team chat and a plain "Leave the match" button (your place
   stands); nothing names watching as a choice. **New:** the cut screen's foot holds two buttons side by side, always both: **Spectate**
   (watch to the podium: the live board, who's left a side and the scores, the scoreboard as now; Leave stays in ⚙) and **Leave the
   match**. Above them, a fixed box: who's still in a side and the stages to come (`notes/mockups/crowd-cut.png`). Nothing hidden,
   nothing shifts: the buttons keep their place every cut; not tapping either is spectating.

## 2. What the sim says (`reports/crowd-rework.md`, 360 games)

Real chess on one board (Stockfish 19 lite, 50k nodes), 100 of the game's own 50 v 50 bots (each at its rating's temperature, the
team turn's shared lean), 40 games for each pick mode in a **mixed** (600-2200), **strong** (about 1750) and **weak** (about 850)
lobby, 6 probe players at 1900 / 1200 / 700 in each. Every seat's loss on every move is kept, so each schedule, carry and tie band
is replayed on the same games.

| | Strong | Majority | Chaos |
| --- | --- | --- | --- |
| Played move's loss a move (points), all lobbies | 0.8-0.9 | 1.5-1.7 | 3.2-4.4 |
| Played moves giving 25+ a game | 0.2-0.5 | 0.2-0.4 | 4-6.6 |
| Over before the 1 v 1 | 3-10% | 3-15% | 3-13% |
| Reached move 60 / mate | 48-70% / 30-48% | 53-60% / 40-48% | 33-55% / 45-68% |

- **The 1 v 1 comes:** games end before it 3-15% of the time; median end move 54-60.
- **Move 60 is the usual end:** a third to two thirds of games reach it, and in **89%** of those one side is at 75%+ (87% at 90%+):
  bots, like many players, don't convert. A draw there leaves about half of all games with no winner; the verdict, about 6%.
- **The schedule:** the first cut after move 14 (B) sorts a little better than after 10 (A): rank correlation of strength and
  place 0.32 vs 0.27 (mixed), and fewer cut lines on an exact tie (18-25% vs 24-32%); before 14 the opening allowance zeroes most losses.
- **The carry hardly matters** for who survives or for RP (rank correlation 0.31-0.32 at every carry, 0 to 100%). At 0% about 70%
  of cut lines fall on an exact tie (early scores are mostly 0), so ties go through and owe places; 25-75% keep it at 18-25%. **50%**.
- **The cut is mostly luck with these bots:** rank correlation 0.10-0.32; the strongest player finishes in the top 3 in 3-15%
  (3% by chance). The bots' strength is compressed: a 700 gives away 2.3 points a move, a 1900 1.2, each with an sd of 5-9, so a
  4-move round rarely tells them apart. The 2% random move isn't the cause (taking it out: 0.36). If players' strength shows about
  four times as much (the `wider` reading), rank correlation is 0.5-0.8 and a 1800+ finishes above a 900- 97% of the time (73% now).
  **An engine-best player still survives to the end 100% of the time and finishes 1st or 2nd 98%** (Eric's Nov 1 bar holds).
- **Winner and best player:** the best player is the winner in 35-55% of decided games, on the podium in 68-73%, median place 2:
  both titles earn their place on the screen.
- **RP** (40 × (S − E), Glicko on the true ratings): per match the probes' 10th-90th run about −30 to +29. Eric's three cases hold
  in sign and size: a 1900 in a weak lobby can gain little (90th percentile −0.8 with the bots, +0.2 `wider`); a 1200 in a strong lobby
  gains (+13 on average); a 700 in a strong lobby is never hurt by an early cut (+0.4 to +26). But with the bots' luck the strong
  lose about 5-11 a match on average and the weak gain: the expected place must come from the mode's own MMR (mode-ranks), which
  then narrows (risk 2). **Tie band 1 point:** the gap at the line is 0.15 (median), so 1 point turns 5-11% of pairs split by a cut
  into draws and trims the tails by about 1 RP; 2 and 4 points draw 9-27% for little more.

- **Eric's longer 4 v 4 (schedule C) costs nothing:** C sorts as B does (rank correlation 0.32 / 0.10 / 0.15, the same RP). 96% of
  games reach the 4 v 4 and play all 6 of its moves; 89% reach the 1 v 1, which plays a median 18 of its 18 (10th percentile 6).
  (The live games cut by B, so under C moves 40-42 were played by one bot a side: the played moves stay the live ones.)

**Recommended:** Strong as the default pick; schedule C (the table in rule 3; 4 v 4 for 6 moves, 1 v 1 from 43); carry 50%;
tie band 1 point; the judge's verdict at move 60. Settled by real matches, not the sim: how much players' strength really shows
per move (the `wider` question). Measure it from the first weeks of real 50 v 50 results (rank correlation of MMR and place).

## 3. What changes in today's code

- **core `votes.ts`:** the `format` vote ("How does it end?": team / boss / duel) becomes `pick` ("How are moves picked?": strong /
  majority / chaos), patching a new `crowdPick` setting; `bossFinalOption`, `crowdFinalists` go for 50 v 50.
- **core `settings.ts`:** `CROWD_CUTS` (after, keep) replaces `CROWD_STAGE_ROUNDS` / `CROWD_KNOCKOUTS` for 50 v 50; `crowdCarry` 0.5;
  `crowdMoveLimit` 60; `CROWD_PICK.strongClose` 0.03; `rankTieBand` 1 (with the mode ranks). `crowdPlayedFromTop`, `crowdTopOdds`,
  `crowdSureShare`, `finalFormat`, `teamFinal*`, `recluseChild` leave `CROWD_SETTINGS` (raids keep what they use).
- **core `match.ts`:** the played move by `crowdPick` (the `popular` draw's branch, using the judge's numbers for Strong); `endStage`
  multiplies survivors' scores by the carry (streaks untouched); the end's places (side result, then score); `bestPlayer()`.
- **chess `runner.ts`:** 50 v 50 never enters a final (`isFinal`, `startBoss` for the crowd final, the team final's steps, the duel);
  the move limit ends the game (the verdict); the 1 v 1 is an ordinary stage with one player a side.
- **protocol `protocol.ts`:** the vote's new id; `results` gains optional `podium { winner?: id; best: id }` and per player
  `outAtMove`, `perMove`. Optional fields only: old apps ignore them.
- **server `lobby.ts`:** the vote's patch, the move-limit end, places written in the new order (no schema change); the 50 v 50 boss-final
  path (the Hidden Boss's child, man and phase 2 online) is no longer reached (see question 3).
- **app:** `Vote.tsx` cards come from the data; the top bar's countdown ("Move 31 · cut in 2", "1 v 1 from move 43"); one banner at
  the 1 v 1; `Results.tsx` the podium, the best-player line and the chart (fixed heights); the FAQ.

**Build steps** (one `xhigh` helper at a time):

| Step | What | Lane, effort |
| --- | --- | --- |
| C1 | core: the pick vote and modes, the cut schedule, carry, move limit, places, best player; unit tests (`votes`, `cut-ties`, `crowd-bot-spread`, a new `crowd-rework.test.ts`) | targeted, xhigh |
| C2 | runner + server + protocol: no endings in 50 v 50, the limit, the 1 v 1 stage, results' optional fields; `crowd.test`, `lobby.test`, `resign.test` | targeted (optional protocol fields), xhigh |
| C3 | screens: vote cards, top bar, the 1 v 1 banner, the cut screen's Spectate / Leave, the podium results and chart (these mockups), FAQ; e2e `crowd.spec`, `formats.spec`, `votes.spec`, a podium check at 320 / 390 / 1280 | targeted, high |
| C4 | retire the 50 v 50 endings: `crowd-hidden.spec`, the endings' unit tests, dead settings; `e2e/areas.json` | targeted, medium |
| C5 | RP: mode-ranks M1-M3 with these places and the tie band | ranked, **full lane**, xhigh |

## 4. Risks

1. **Luck.** Eight cuts of 4-ish moves down to one player reward not blundering more than playing well; with bot-like players the
   finish is close to a lottery among the non-blunderers. The knob is the round length (fewer, longer rounds), not the carry.
   Real players likely differ more than bots (the `wider` rows); measure before tuning.
2. **RP on a luck-heavy result.** Glicko's expected place from 1 v 1-scale ratings is too confident for this format: strong players
   would bleed RP. The ranked lane should give 50 v 50 its own MMR (mode-ranks does), seed it with a wide RD, and consider one
   setting that pulls the expected result toward ½ by how much the format really sorts (fitted from real matches).
3. **The 1 v 1 is a fair-play target:** one player, normal chess, RP and a "Winner" at stake. `fairplay` should look at the 1 v 1
   first (its moves are judged as every other pick).
4. **Strong needs the judge before the move is played,** and judges on players' devices can differ near the 3% line: the played
   move must come from the agreed judgment, as today's scores do.
5. **Small groups:** at 2 a side a round score is half the difference; at 1 a side it's always 0, so the 1 v 1's order comes from the
   result (drawn: the whole-match score). Spelled out in C1's tests.
6. **What goes:** the Hidden Boss's 50 v 50 final, the team final and the duel, with their specs and settings (C4); old apps ignore
   the new optional fields.

## 5. Questions for Eric (each with a default)

1. **Move 60:** the judge's verdict decides (one side at 75%+ wins, else a draw), or always a draw? Nine in ten games that reach
   move 60 are clearly won by then. **Default: the verdict.**
2. **Chaos:** every move the team picked has the same chance, even one only one player picked; or a random player's pick (popular
   moves likelier)? **Default: the same chance** ("totally random"; the sim measured this).
3. **The Hidden Boss** (his child, the man, phase 2) is only met as the 50 v 50 boss final, which goes. Keep his code for a later
   raid or event, or remove it? **Default: keep it, unreached.**
4. **A game over before the 1 v 1:** those still in on the winning side place above the losing side's, or everyone still in by score
   alone? **Default: the winning side first** (the sim's rule).
