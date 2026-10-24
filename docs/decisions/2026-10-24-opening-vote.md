# 50 v 50: a third pre-game vote, "How does it start?" (Oct 24, 2026)

Eric (Oct 24): "50v50 we wanna add a 3rd vote round but it's #2 in the lineup, final augment is still time control. Left
side normal, middle is a random standard opening, right is Fischer random but the name fide uses now." Then: "Freestyle
is the name to use for chess960" (FIDE's 2026 world championship was the "FIDE Freestyle Chess World Championship").

How it works now: [crowd.md](../areas/crowd.md), "How it starts".

## What was built

- **The vote** (`openingVote()` in `packages/core/src/votes.ts`), held second: `PREGAME_VOTES = [formatVote(),
  openingVote(), speedVote()]`. Title "How does it start?". Left to right: **Normal** ♟️ "The usual starting position",
  **Random opening** 🎲 "A real opening, 4 moves in", **Freestyle** 🔀 "The back-row pieces start shuffled". Nobody votes:
  Normal, by its id. Each patch is plain data: `crowdStart` (a new optional setting, `CrowdStart`) and `openingMoves`
  (0, 4, 0).
- **The boards.** The match is made before the votes (its board from the starting position, as 50 v 50 always was); the
  start vote's patch reaches `MatchRunner.patchSettings`, which sets every board still at its start up afresh
  (`setUpStart`): nothing for Normal (the board as made: nothing drawn, so a Normal game is exactly today's), a library
  line for Random opening, a Chess960 start for Freestyle. Once a move is played nothing changes. A start given before
  the match (`?start=` with the votes off) is set up the same way in the constructor.
- **Test switch** `?start=normal|random|freestyle` (`LOBBY_TEST_SWITCHES`, the app's `overridesFromUrl`), like `?speed=`:
  with `?format=` (votes off) it is the start; an unknown id is Normal; never a raid's.
- **Renamed for players:** "Chess960" is "Freestyle" in the Hidden Boss's phase 2 heading (`Recluse2.tsx`, both places)
  and the FAQ's phase 2 line. Code names (`chess960.ts`, `isChess960Fen`, ...) stay. The crates' "Fischer Random" spin is a
  crate feature, not the variant: untouched.
- **The FAQ** (50 v 50): "Then on how it starts, then on the clock." and a "How it starts" bullet, its labels, moves and
  default from the vote's data.

## The calls made here, and why

1. **One start for the board everyone shares.** The 50 v 50 has one board, so everyone starts from the same position;
   the convention for more boards (Classic: each board its own opening, from the match's random source) is kept by
   `setUpStart` doing every board at its start, each its own draw. A game that ends before the final restarts
   (`replaceBoard`) from a start of the same kind: another Chess960 start in Freestyle, another library line otherwise.
2. **Random opening is 4 moves a side** (`CROWD_START.randomOpeningMoves`, settings.ts), the same as Classic's and
   Squads' openings: long enough to be a real, named line (and to skip the first moves every game plays the same way),
   short enough that the game is still the players'. White to move (8 plies), inside `openingBalance` (0.4 to 0.6). The
   first cut still comes after 20 moves played (`firstStageRounds`), so it now falls at move 14, not 10: nobody is cut
   sooner for it.
3. **The random opening is drawn after the vote, from the match's own random source** (the server's online, the page's
   in solo), and sent as the board's history; no device draws its own. The phone replays those moves on the board the
   first time it sees it (as for any board new to it: "New board: replaying it from the start"), so the pieces drop in
   from the starting position after the votes and play the opening, about a second, before the first pick.
4. **Freestyle never deals the usual setup** (number 518): `freestyleStart` draws one of the other 959, each as likely,
   from the match's random source (seeded: the same seed, the same start; the server sends it to every device). It is a
   board from a base at ply 0 (`freestyleBoard`, as the Hidden Boss's phase 2 boards), so everything that replays a game
   (fenAtPly, the game's end, recentMoves, the app's history and replays, a restored lobby) starts there.
5. **The pieces that drop in after the last vote are the game's own.** The vote message carries `start` (Freestyle's
   position; unset for the usual one) once the start vote has changed it; the vote board drops those pieces and its eval
   bar reads that position. Without it a Freestyle game would drop the usual pieces, then jump to the shuffled ones.
6. **The boss final is always played from the usual starting position.** The Hidden Boss is `fromStart` already, so this
   is what he did anyway; the call is that it stays so after a Freestyle game, for any boss (`startBoss`: any start that
   isn't the usual one sends the boss's board to it). Why: his phase 1 brain is Maia, which knows only normal chess (the
   same reason his phase 2 plays Stockfish), and the bosses' powers and set-ups (Big Boy's eaten pawn, the camo, the
   Last Stand's checks, `mateInOne`) are written for a normal game. A start that can't break him beats a variant few
   have played against a boss. The team final and the duel simply play on, on the game's own board, from wherever it is.
7. **Scoring is unchanged.** The opening allowance counts by the game's own move number (the position's fullmove
   number), so a Freestyle game gets it for moves 1 to 10 (tapering to 14) as Normal does, and a random opening from
   move 5 (its first 4 moves were the library's, not anyone's picks), tapering out at move 14 as always. Neither is
   clearly wrong: if anything a Freestyle opening, with no theory to know, is where forgiving a sound move off the
   engine's line matters most. The material fallback works as before (a Chess960 castling, the king onto its rook, is a
   move the exchange check can't read, so it is never a "gave up material"). **For the scoring rework that comes next:**
   streaks will count from move 1 in these two modes; Random opening's "move 1" for the players is the game's move 5, so
   the rework should count from the first move picked (the board's `openingPlies`), not the fullmove number.
8. **Every vote keeps its time.** Three votes are three windows of `voteSeconds` (8 s) plus `voteResultSeconds` (4.2 s)
   each, about 37 s before move 1 (was about 24 s). No window was shortened: a third vote adds its own. (`cutSeconds` is
   the cut screen's, for the clock vote after a cut that's off since the pre-game votes: unchanged.)
9. **A Chess960 castle shows on the vote's ghosts as the king on its rook's square**, as Chess960 writes the move (the
   board itself castles properly, the rook beside the king). Left as it is: drawing the king's landing square instead
   would be a second notation for one move on one overlay.

## Every place that assumed the standard start or standard castling, and what happened to it

Already Chess960-ready (built for the Hidden Boss's phase 2, DECISIONS.md "Chess960's rules"), no change: the rules
(`rules.ts`: legal moves, making a move, SAN with O-O and O-O-O, the game's end, `fenAfter` from a start; chess.js only
for read-only questions, without the castling field), the engines (`UciEngine` turns `UCI_Chess960` on from the
position's castling field, and so does the engine server, `engine/server.mjs`), `stockfishRefuses`, the board's castling
gestures (`castleShortcuts960`: the king onto its rook, or onto g1/c1 where nothing else goes), the castling sound, the
exchange check, the God King's cues in the Crowd's reveal (`queenInDanger`, `blunderCost`: read without castling rights),
the board's history (`HistoryNav` in Play, with the board's bases), `recentMoves`. Bots pick from the judge's top moves
(Stockfish) or a legal move at random: never Maia, which only plays bosses (and the boss final starts from the usual
position). No PGN is made anywhere.

Changed here:

- `MatchRunner` (`runner.ts`): the start set up from the vote (`setUpStart`, `freshStart`, `patchSettings`); a replaced
  board in Freestyle (`replaceBoard`); a restored runner knows Freestyle's opening (`restore`: it isn't in the library,
  and became "Boss battle" before); the boss final from the usual position after any other start (`startBoss`).
- `boards.ts` (`FREESTYLE_OPENING`, `freestyleBoard`), `chess960.ts` (`freestyleStart`).
- The app's first replay of a board (`useReplay` in `hooks.ts`) starts from the board's own start, not always the
  usual position (a phone joining or reconnecting to a Freestyle game mid-match replayed it from the wrong position).
- The final's history (`Final.tsx`) steps back through the game with its bases (it replayed from the usual position).
- The vote board's dropping pieces and eval bar (`Vote.tsx`, `NetVote.start`, the lobby's `voteView`, solo's `voteStart`).
- Two e2e specs that worked out a legal move with chess.js (`chat.spec.ts`, `match-screen.spec.ts`: matchmade 50 v 50s
  with the votes on) now use the game's own rules: chess.js can't read a Chess960 position.

## Tests

Unit: `packages/core/test/votes.test.ts` (the order, the cards, the default, the patches, `?start=` ids),
`packages/chess/test/opening-vote.test.ts` (Freestyle's start: never 518, legal, mirrored, seeded; each start's board;
the balance window; before the match; never after a move; a Freestyle game through the runner with bots and the judge;
castling both ways judged and played; the snapshot), `packages/server/test/lobby.test.ts` (the start vote online:
Freestyle for everyone with `start` on the vote, bots move, the judge scores, both castles played, a lobby that sleeps
wakes with the same start; Random opening and Normal), `test-switches.test.ts`, `board-logic.test.ts` (both castles on a
Freestyle board), `faq.test.ts`. e2e: `e2e/opening-vote.spec.ts` (the three votes in order, phone and computer, the start's
cards and zones, the game from the start that won; `?start=freestyle` solo and online, `?start=random`, the default), and
the vote specs (`votes.spec.ts`, `formats.spec.ts`, `vote-hint.spec.ts`) now pass through the second vote.

## The sim

`npx tsx packages/sim/scripts/crowd-sim.ts 3 <start>` (100 bots, the real judge at 100k nodes, the vote's patch before move
1, the team final), 3 matches per start, Oct 24. Small samples: they show nothing breaks and nothing is off, not a tuning.

| Start | Rank corr. | Strongest in final | Top-5 in final | Plies (final) | Restarts | Mean pick loss before the final, raw / counted | Castles a match | Chess960 starts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | 0.647 | 1 of 3 | 2.33 | 118.7 (78.7) | 0 | 2.20 / 1.08 | 1.33 | 0 of 3 |
| Random opening | 0.649 | 2 of 3 | 3.00 | 165.7 (125.7) | 0 | 1.93 / 1.25 | 1.33 | 0 of 3 |
| Freestyle | 0.659 | 3 of 3 | 2.33 | 156.3 (116.3) | 0 | 1.99 / 0.99 | 1.00 | 3 of 3 |

Every match ran to its final and its end; scores sit where Normal's do. Random opening's counted loss is a little higher
because its allowance covers moves 5 to 14 instead of 1 to 14 (call 7); Freestyle's bots castle (the king onto its rook)
about as often as Normal's.
