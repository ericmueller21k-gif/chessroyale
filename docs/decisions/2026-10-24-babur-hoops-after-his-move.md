# Babur's Hoops: thrown after his move, and 2 to 4 a battle (Oct 24, 2026)

Eric, Oct 24, after testing Babur on his phone: "because he's ulting so much, and he cannot lose five turns a game because
of his ults. They're not that strong… make it… he just does like two of those ults, two to three throughout the game, and
then he still has his turn… the logic should be he plays his move, then before your turn, he throws the rings. And I don't
really think… it doesn't matter that the engine doesn't really understand… the advantage that that creates… I do think he
was ulting slightly too much. It should be… 2 to 4 times per game."

Before: the Hoops were his whole turn (a pass, `passTurn`, a base at its ply; the pass guard; no move that turn), and
`rageSpeed.tiger` 1.6 gave about 3.5 casts in a 47-move battle (Eric saw 5 to 6 in a ~60-move game). His rules:
[2026-10-23-tiger-rules.md](2026-10-23-tiger-rules.md); how he works now: [bosses.md](../areas/bosses.md) (his row).

## What changed

1. **After his move.** On his turn after the warning (or after the admins' trigger) he plays his move as any turn (his
   engine, his brain), then the hoops are thrown at the end of his turn, before the crowd's. The blocks are chosen on the
   position after his move, the crowd to move: his gain is the crowd's best with the walls in force against the same
   position without them, in `hoopsBand`, nearest `hoopsTarget`. The walls hold for the crowd's next `hoopsCrowdMoves` (2)
   moves and his move between them, as before. His move never crosses a hoop: there are none yet when he moves. The board
   doesn't change for the cast (walls only), so there's no base, no pass and no pass guard.
2. **The mechanism reused: his balloon's.** The balloon's landing was already asked of the host with his move (the request's
   `balloon`), answered with it (the bossMove's `balloon`) and applied after it (`afterBossMove`, as Moo's Moonbeam is). The
   hoops go the same way: the request for his move carries `hoops` (`hoopsAsk`) when they're due, the host plays his move,
   then `hoopsAnswer` on the position after it (the cast, then a due balloon's landing outside it), and sends the blocks as
   the bossMove's `hoops` ("c3 f5 b6"; "" none). `afterBossMove` throws them (`tigerBattle.cast`: checked by `hoopsCheck`
   and the due check) and then ends the balloon (`endOfTurn`). Solo and the sims do the same in the runner's `playBoss`
   (`tigerTurnEnd`). Gone: the separate step (`hoopsDue`, `playHoops`, `applyHoops`, `hoopsAny`, `hoopsWait`), the lobby's
   `requestHoops` and its `bossKind` "hoops", solo's `hoopsTurn`, the request's `hoopsAny`, the cast's "@square" (the landing
   is the move's `balloon`, as on any turn), and the boss kit driver's hoops step.
3. **The order: the hoops first, then the balloon.** In the rules: the blocks are picked on the position after his move (as
   the brief says), and a ready balloon then lands outside them, its square checked with the walls standing (`landCheck`'s
   "never inside a hoop"). On screen: his move shows, then the cast's moment (the HOOPS! banner, then the throws), which holds
   the crowd's clock; the balloon's landing (or pop) and his cheer (or wince) play from the crowd's turn's start, after it
   (`momentsOf`: the cast is order 0 and holds its length, the landing order 1 with no length). So the screen never shows
   both at once. This is the order the old cast turn already used.
4. **A banner for the cast: HOOPS!** The brief: "His move plays, then the hoops' banner and throw, then the crowd's turn.
   The banner is a full banner as today… Nothing plays under the banner." Today the cast had no banner of its own (only the
   RAGE! warning a turn before, `e2e/banner-time.spec.ts` said so), so I added one in the same shape as every other
   ultimate's: "HOOPS!" over "No crossing the rings for 2 moves" (the number from `hoopsCrowdMoves`), the fire tone, a boss
   banner's whole length (`bossBannerMs`, the 0.75 s extra included), its window [0, 300] in `POWER_BANNERS`: off the board as
   the first hoop leaves his paw, so the moment's clock holds 1.95 s at its start (`bannerLeadMs`) and nothing of the cast
   plays under it. The cast's moment is now 3.44 s (1.49 s of throws and landings after the banner), the server and solo
   waiting for it as before. His lines are the kit's `ultimateWarn` (with RAGE!) and `ultimate` (the cast), unchanged.
5. **A move of his that gives check: no cast that turn.** `hoopsGuard` keeps its rule that neither king is in check (it was
   written for the pass, where none could be). Keeping it is the simplest safe choice: no new rule for walls standing round
   a check, which the walls' attack rule (no attack across a wall) would otherwise have to judge. The hoops wait, the warning
   stays, and they're asked again with his next move. In the sim his move gave check on 11 of the 64 turns the cast was due at 1.3 (9 of 45 at 1.1): each waited a turn.
6. **The warning's words stay "After your move: Hoops".** Still true (they come after your move, and his). "Next turn" would
   also fit; not worth a text change.
7. **The host's time.** His move's request now carries the cast's search too (up to `hoopsTimeMs`, 8 s, plus the landing's
   share), so the server gives the host `hoopsTimeMs` longer before it asks another device (`hoopsMs` in the lobby) on the
   turns the hoops are asked.
8. **An older app** (a host before this change) ignores the request's `hoops` and sends his move alone: no cast, asked
   again with his next move; the balloon as before.
9. **The dock's "Babur spent his turn on the hoops." is gone**: the dock shows his move, as any turn.

## How often: `rageSpeed.tiger` 1.6 → 1.3

The aim (the brief): about 3 casts a battle at the 60-move cap, at least 2 in a typical battle. At 1.6 the 10 s crowd's
battles had 3.45 casts in 47 moves (4.4 per 60 moves; reports/tiger-sim.md, babur12R10). Scaling the fill rate to about
2.9 per 60 moves gave 1.1 (the meter's own wait while the walls stand, and the warning turn, kept). The run at 1.1 (the
report's 10 s crowd, 20 battles) gave **1.80 casts a battle**, under 2: he keeps his turn now, so his battles are shorter
(39 crowd moves, against 47). By the brief's rule (sweep only outside 2 to 4) one more run, at 1.3: **2.55 casts a battle**
(0 / 6 / 3 / 7 / 4 battles with 0 / 1 / 2 / 3 / 4+), 3.45 per 60 moves, in 44 moves; the four battles that reached the cap had
4, 5, 5 and 4. Shipped 1.3, and the sweep stopped. Six battles of twenty still had only one cast: all short ones (he won
quickly). The table: [reports/tiger-sim.md](../../reports/tiger-sim.md), the top section.

## Strength (reported, not tuned: the director takes it to Eric)

He keeps his turn now and his balloons fill faster (PR #333), so he is stronger. The 10 s crowd scores **0.12** (± 0.07;
2 won, 1 drawn, 17 lost) at 1.3, and 0.10 (± 0.06) at 1.1, against **0.35** for the same crowd after #333 (babur12R10), the
report's 0.40 (tigerR10) and the director's 0.25 to 0.40 target. Eric's pace (a 5 s pick: 0.35 with 5.5 landed in #333,
babur12P) was not re-run. Landed material is about the same (5.9 a battle, against 6.25): what he gains is the turns he no
longer gives away (3.45 a battle before), while the walls still take the crowd's engine-best move on 66% of walled turns.
Not tuned further here: the brief's call. The obvious knobs, if Eric wants him weaker: `balloonStageSec`, the pops, or the
offset (already at −250, Stockfish's floor for the 1600 tier).

## Player-visible text

- FAQ, Babur's Hoops: "at the start of his turn, after the warning, he throws 3 burning hoops onto the board, and that's his
  whole turn, so you move next." → "on his turn after the warning, he plays his move as usual, then throws 3 burning hoops
  onto the board before your turn."; and "If throwing them would cost him real material (a piece of his left hanging), they
  wait for his next turn." → "If his move puts your king in check, they wait until after his next move."
- New banner on the cast: "HOOPS!" / "No crossing the rings for 2 moves".
- The dock on his cast's turn: "Babur spent his turn on the hoops." → his move (the line every turn of his has).

## Also (the director's addendum)

Two stale comments PR #333 left, comments only: `characters/tiger-lines.ts` ("one comes about every two minutes" → about
every 50 s, from the settings' names) and `characters/tiger-sounds.ts` ("one every 30 s" → one a stage).

## Tests

- Unit `packages/chess/test/tiger.test.ts`: a full meter, his move AND the hoops in the same turn, the blocks the ones
  `hoopsFrom` picks on the position after his move; a ready balloon and the hoops in the same turn (the cast's moment
  first, the landing outside the hoops); the walls for exactly the crowd's next 2 moves; junk, "" or none: his move stands,
  asked again; a cast sent when none is due refused; the admins' trigger after his next move; `hoopsFrom`, `hoopsCheck`
  (a check by his move: none) and `hoopsAnswer` on the position after his move; the cast's moment with its banner's hold.
- Online `packages/server/test/tiger-lobby.test.ts`: the request for his move asks for the cast and a due balloon; his move
  and the host's cast in one turn, checked, walled; junk leaving his move alone, asked again. The boss kit and its
  solo/online parity test play his hoops through his move now.
- `packages/app/test/banners.test.ts` (HOOPS!'s window, a boss banner's length, nothing under it), `faq.test.ts`,
  `tiger-wired.test.ts` (no "spent his turn" line).
- e2e `e2e/tiger.spec.ts`, phone and desktop: every frame, his move drawn before HOOPS!, the banner up its length with no
  hoop or ring under it, the first hoop after it, then your turn; the walls as before.
