# Smudgy, wired in and playable (Oct 19, 2026)

The wiring lane for **Smudgy** (id `smudgy`; his rules: [2026-10-19-smudgy-rules.md](2026-10-19-smudgy-rules.md), his art:
[2026-10-19-smudgy-animations.md](2026-10-19-smudgy-animations.md) and [-still](2026-10-19-smudgy-still.md)). He is
**live**: his roster line has `kit: "Smudgy"`, so Boss alone, raids and the Boss raid screen's twelfth tile all meet him.
How it works now: [docs/areas/bosses.md](../areas/bosses.md) (his row). The director reviews the masked board and the
lines before this merges.

## The masked board: one rule, one place

While `powers.camo.square` hides his rook, **every screen draws `maskedFen(fen, camo.square)`**: his rook is one of his
pawns, in every position a player can see. It is done once, where positions are drawn, not screen by screen:

- `packages/app/src/camo.ts` is a small registry. The match tells it about the battle each time the boss view changes
  (`net.ts`'s `boss` setter, `solo.ts`'s `boss` getter), and it keeps the hidden square at **every position of the game
  so far** (`hiddenTrail`, walked from the swap's base), so a past position is masked with the square the rook stood on
  *then*. `seenFen(fen)` answers for any position: a known one by its table entry, one made from the latest (the pick on the
  board, a Last Stand's) with the latest square. Nothing hidden (before the swap, revealed, taken, the battle over, any
  other boss): the fen unchanged.
- `components/Board.tsx` is the one component that draws a position and calls `seenFen`; every board (the big one, the
  boss screen's, the crowd's ghosts and mini boards, the history, the replays, the intro) goes through it. `unmasked` is
  the true board, passed only once `boss.result` is set (the Last Stand card, the results).
- **The moves.** Legal moves for the dots are computed on the drawn board (`Play.tsx`'s `painted` memo). A move legal there
  but not allowed (`allowed ?? legalMoves(trueFen)` does not have it) is **stopped by the board itself** (`stopped`,
  `OwnBoard.userMove`): it never moves, and the dock says why, "A painted piece stops that move." (`refusedLine`,
  stop reason `paint`) for three seconds. The player picks again, at no cost; nothing snaps back, because nothing moved.
  If the drawn board has no legal move at all, the true board is used (a mate or a stalemate on the true board is real).
- **The names of moves.** All through `seenSan(fen, move)`: the dock, the Crowd screen's SAN and verdict words, the
  hints, the barred note, the God King's cues. The match runner's `specialMove` already names his hidden rook's steps as a
  pawn's ("d6", never "Rd6"), so the dock's "Boss plays …" is the pawn's name.

### Every place checked for a leak of the hidden rook

| Where | Result |
| --- | --- |
| The big board, the boss screen's board, the Crowd screen's board, the crowd's ghost boards and mini boards | masked (`Board.tsx` `seenFen`) |
| The dots a tap shows | the moves legal on the drawn board; a superset of what is allowed (camo.test.ts, real battles, both sides) |
| A refused move | the line and a second pick (`stopped`); never a silent snap-back (e2e) |
| Last-move highlight and arrows | squares only, the same for a pawn-shaped step as for a pawn; a strike reveals him anyway |
| The move knock's sound | read from the drawn board; `moveKnock` returns null for a position chess.js can't read |
| The check ring on a king | read from the drawn board (`inCheckDrawn`); a rook's check is a reveal, so none is shown that a pawn could not give |
| Move names: the dock, the Crowd screen's SAN, the hints, the barred note | `seenSan` (camo.test.ts); "Boss plays …" until the paint drips on a strike |
| The history browsed back, the replays, the intro | a table of the hidden square at every ply (camo.test.ts: every ply of 6 real battles, both sides; e2e browses a battle back ply by ply against the game) |
| The God King's cues, the boss character's mood and beats | read from the drawn board (`turnCues`, `kingTurn`, `bossBeat`'s `seen`) |
| The Last Stand's and the reveal's words (`blunderWords`) | the drawn board |
| The splash of Camouflage | covers every square with one of his pawns *as drawn* (the rook as one of them), so the same squares whichever pawn hides it (smudgy-wired.test.ts) |
| Results, the Last Stand card, the final | the true board, once `boss.result` is set |
| The home page's live window (`/api/live`, public) | masked by the server (`lobby.ts`, `hiddenRook`); its votes are named on the same board (smudgy-lobby.test.ts) |
| Spectators / anyone in the lobby | the same app, the same `Board`: masked. The network carries the true position to every client, as with Hollow's dark (the rules decision, call 2) |

**Accepted limits** (they read the true board, as the rules decision records): the judge and the bots know where the rook
is, so the **⚡ hints** are the engine's best moves on the true board and the God King's "bad move" and Last Stand costs
can reflect it; the **eval bar** (tester-only) shows the true evaluation; `?mate=1` cannot mate for him. A hidden-rook
move that mates ends the battle, and the true board shows at once.

**A crash the mask taught us:** chess.js throws on a position with a pawn on rank 1 or 8, and a rook of his drawn as a pawn
can stand there (its strike's last rank, the instant before the paint drips). Code that reads a *drawn* position catches it
(`inCheckDrawn`, `moveKnock`); the rule is in docs/areas/bosses.md's checklist.

## His moments

All timed by his animations' cues (`SMUDGY_BEATS` in `bosses/smudgy.ts`; `SMUDGY_FX` is derived from them, so the server
waits exactly as long as the screen plays):

| Moment | Plays | Length |
| --- | --- | --- |
| Camouflage (as your turn begins after his second forced move) | "CAMOUFLAGE!" ("A rook hides among his pawns"); he flings his brush at the `splash` cue; a blob of paint flies to his pawn row (380 ms); a splash lands on every square with one of his pawns, 25 ms apart; the swap happens under the paint (`swapAt`); the paint holds 450 ms and fades off the board as you'll see it from now on | 3300 ms |
| The reveal (his hidden rook strikes, gives check or leaves you no move you could see) | the piece moves as a pawn; his tail snaps open at the `drip` cue and the paint drips off its square; it shows as a rook | 1500 ms |
| The rook taken (your move took it) | a drip on its square, "That was his rook!", his line; while he thinks | 1200 ms |
| Repaint (his whole turn) | "REPAINT!"; a cream stroke on his pawn's square at `stroke1` (it's yours now), a charcoal one on your piece's at `stroke2` (it's his); each piece changes color under its stroke | 3000 ms |

## The calls made here, and why

1. **Mask at the one place that draws, with a registry, not by passing masked fens around.** A screen that forgot would leak;
   with one choke point none can. The registry costs one cheap call per boss-view change.
2. **The strike's art animation is `strike`; the rules' moment is `unmask`.** The moment `unmask` plays the kit's
   `powerHit` (`strike`) and the dock says "His pawn was a rook!" at the drip, not before.
3. **The reveal shows a pawn sliding to the target, then the drip.** The strike is the reveal, so the slide giving it
   away a moment early is the point of the moment; the name is held ("Boss plays …") until the paint drips.
4. **`hush`, not silence, before the drip:** "Boss plays …" keeps the dock's line in place so the layout doesn't jump.
5. **Test switches `?paint=1` and `?paint=2`** (`PAINT_TEST`, `settings.bossPaintTest`): his rook already hidden on d7 with
   the d-file open and your king on e1, so Kd1 and Kd2 are moves the drawn board offers and the real board refuses, and his
   moves scripted: 1, d7-d6 then a strike on d2; 2, d7-d6, d6-d5, for your rook (Ke2, Rd1, Rxd5) to take hidden. Without
   them his hidden-rook moves depend on the engine, and the e2e would be a flake waiting. Solo only, like `?mate=1`.
6. **The splash is sorted nearest his brush** so the paint spreads from his side; the set of squares is what hides the rook,
   not the order.
7. **The rook taken has its own moment on the thinking screen**, from when the device first sees the event (a screen drawn
   again carries on); it is not part of the next turn's moments.
8. **`SMUDGY_CHANCE`:** Hopper's, plus his own moments always speaking (a power's line is always said).
9. **Sounds are synthesized** (`characters/smudgy-sounds.ts`): splash, drip, brush swish, giggle, dab, thump, oof, with a
   level table under a move's peak and loudness (the #271 test, in smudgy-wired.test.ts); all go through the shared `play`,
   so the mute switch is respected.
10. **The select tile** is the twelfth: two rows of six on a phone and a computer, `SELECT_SOUND` `smudgySplash`, his three
    select lines. The FAQ block says "The board hides it only while the battle lasts: once it's over, the board shows the
    real position."

## Lines: used as written; the three over 42 characters

`scratchpad/smudgy/lines.md` is in `SMUDGY_LINES` exactly (a test compares all 42). The existing caps in the repo's tests are
Alfil's and Hopper's 42 and Hollow's 44, and apply to their own lines; Smudgy has no cap. Three of his are longer:

- "Every chameleon blends in. I'd rather stand out." (48; an entrance line and a select line)
- "Hold still. I'm painting you into a corner." (43; an entrance line)
- "Hold still, your majesty. You need a touch-up." (46; his king attack)

They wrap to two lines in his bubble. The e2e puts each in a copy of the real bubble at 320, 360, 390 and 1280 px: whole,
in view, over neither the board nor the bar's status. The director can shorten them without touching anything else.

## Tests

Unit: `camo.test.ts` (real battles, both sides), `smudgy-wired.test.ts`, `smudgy-lobby.test.ts` (the live window), the paint
switch's scripts in `packages/chess/test/smudgy.test.ts`, the roster, kit and king-attack tests with him added. E2E:
`smudgy.spec.ts` (every frame of Camouflage; the board read from the page against the game, every ply of the history; the
refused move's line and the second pick; the strike; the capture of the hidden rook; Repaint's strokes and colors; the
layout at 320, 360, 390 and 1280), `king-attack.spec.ts`, `boss-speech.spec.ts`, `boss-select.spec.ts`, `boss-smoke.spec.ts`.

Not tested: a real phone (Eric's).
