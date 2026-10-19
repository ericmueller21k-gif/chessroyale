# Smudgy in the rules: Camouflage and Repaint (Oct 19, 2026)

A new raid boss (Eric, Oct 19): **Smudgy** (id `smudgy`), a chameleon painter in a beret who learned to paint because he
never could blend in. This builds his rules, the server side, the raid sim, the tests and the docs; his art and
animations are on `claude/smudgy-sprite` and the wiring (kit, lines, sounds, select tile, the board drawn as the crowd
sees it) is the next lane's. Until then he stays **hidden from players** (`kit: null`; the test link
`?boss=smudgy&wip=1`, with `&power=repaint` for his ultimate). How it works now: [docs/areas/bosses.md](../areas/bosses.md)
(his row); the tuning: [reports/smudgy-sim.md](../../reports/smudgy-sim.md).

## What Eric decided

- **His opening:** always the normal starting position (his passive needs his pawns and rooks at home), whatever side.
- **Camouflage (passive):** his first two moves are forced: an end pawn two squares, then that side's rook out through
  the gap to its third rank; the side at random among the sides where both moves are legal and the rook's new square
  isn't simply lost; if neither works, try again next turn, a few turns, else no Camouflage. At the end of his second
  turn, before the crowd plays, the rook swaps places with one of his pawns and is disguised as a pawn. Players see a
  pawn; a move legal on the board they see but illegal in truth is refused and picked again at no cost; bots are
  fooled as much as people; the judge scores on the board the players see. He plays it like a pawn (forward, two from
  its first rank, never a capture, no en passant trap, never onto the back rank as a pawn) until his 3rd turn after
  the swap; then any rook move. Revealed by a non-pawn move, by a check (direct or discovered), when the crowd takes it,
  and when the battle ends. One Camouflage a battle.
- **Repaint (ultimate):** one of his pawns painted the crowd's color and one of the crowd's knights or bishops his; his
  whole turn. The engine picks the pair: the crowd about 2 pawns worse (1.5 to 2.5), judged with the crowd to move.
  Never the crowd's queen, rooks or king, his king or the disguised rook; never a pawn one step from promoting for its
  new owner; nothing that leaves either side in check or hands either a mate in one; never a position the engine
  refuses. At most 2 a battle. No pair fits: none that turn, again next turn.

## The calls made here, and why

1. **The judge and the bots score the true board, within the moves the crowd can make** (the brief: "if that can't be
   done cleanly, say what you did instead"). The board the crowd sees has nine pawns of his (eight real ones and the
   rook drawn as a pawn), and Stockfish 19 refuses a ninth pawn (`stockfishRefuses`): the engine can't search it. Any
   stand-in (a pawn left out, the rook as another piece) changes the evaluation and would have to be carried through
   every judging path (solo, the host, the engine server, the deep checks) as a second position. So, as with Hollow's
   dark (the judge always saw the pieces in the dark), the engine searches the true position, but **only the crowd's
   allowed moves count: those legal on both boards** (`crowdFilter`). A refused move is never scored, never picked by
   a bot, and costs nothing. What's left: the judge knows where the rook is, so a move that walks into its line can
   score worse than it looks, and the bots see it too. **The turns he hides it don't count for fair play**
   (`powerTurn`): a player who knew would otherwise look like an engine. A cleaner fix later, if wanted: a judged
   position with the rook as a pawn once he has seven pawns or fewer (Repaint can bring that).
2. **The hidden piece is in the app's memory, not a network secret** (as Hollow's dark: the true position is sent and
   the screens hide it). The boss view carries `camo.square`; the screens draw a pawn there (`maskedFen`). A move legal
   as the crowd sees it but not in truth (its king into the rook's line, a piece it pins) is refused with a new
   reason, `paint` (`stopReason`; the dock's words: "A painted piece stops that move."), and the player picks again.
   Online the server simply ignores a pick that isn't allowed, as for every power; solo the same.
3. **No check that isn't there.** A pawn on the hidden rook's square would attack two squares diagonally. The hidden
   rook never steps where that pawn would check the crowd's king (that step counts as a strike, allowed only once it
   may strike), and the swap never picks a pawn whose square would show one. The crowd's king can't step onto those
   squares either (the board it sees forbids it): a pawn would stop it, so the rook's disguise does too.
4. **The rook's lift needs only to be legal.** The swap follows it at once, before the crowd moves, so the rook never
   stands on its third rank on the crowd's turn (a real pawn does). The "isn't simply lost" test stays where Eric put
   it, on the side's pick at the first move, and on the lift only if no swap could follow. The first sim run, with the
   test on the lift too, lost Camouflage in 3 battles of 4: the crowd's natural replies (d3, d4, e3) open a bishop onto
   a6 or h6 between his two moves. "Simply lost" is attacked by a cheaper piece, or attacked and undefended.
5. **The swap's pawn:** seeded among every pawn of his where the position after it is one the engine plays and the
   crowd isn't in check on either board (`swapOptions`), the pushed end pawn included. No engine preference (the brief
   left it open): any preference would make the hiding place guessable, and a plain pick is the least code.
6. **A forced move that can't be played** (in check, a square taken) counts a turn against `camoTries` (3); the second
   waits the same way; after three such turns, no Camouflage this battle. On those turns he plays his own move.
7. **The strike's turn:** from the crowd's `camoStrikeTurn` (3)rd move after the swap, i.e. his turn after it ("his
   3rd turn after the swap"; a Repaint turn counts as a turn). Before it, his brain may still give a discovered check
   with another piece: that reveals the rook, as Eric's rule says (a check reveals it whatever the turn).
8. **The move's name:** his hidden rook's pawn-shaped step is named as a pawn's (`specialMove`: "e6", not "Re6"), so
   the dock's line for his move gives nothing away. (The move list's SAN is drawn by the app from the board: the
   wiring lane draws it from the board the crowd sees.)
9. **Revealed at the battle's end** needs no moment: with the result set, the screens draw the true board.
10. **One Camouflage a battle**, and not a second one with the other rook (Eric's open question): not in this build.
11. **Repaint's measure:** his gain is his evaluation with the crowd to move after it against his evaluation before it,
    him to move (`passScores`, the same measure as the pass guard), in pawns. So it already counts what passing his
    turn costs him: **no separate pass guard** (a pair that leaves a piece of his hanging scores low and isn't picked).
12. **Repaint's hard rules, as they fall out:** a ninth pawn is a position the engine refuses, so **no Repaint while
    the crowd has all eight pawns**; "one step from promoting for its new owner" rules out his unmoved pawns (on his
    second rank, they'd be on the crowd's seventh), so only his advanced pawns are painted. "Hands either a mate in
    one": the crowd's mate in one with it to move, and his mate in one were the crowd to pass. He doesn't Repaint while
    in check (his move answers it), nor before his forced moves are done.
13. **No pair in the band:** no Repaint that turn (`repaintWait`, the warning kept), again at the start of his next
    turn, every turn until one fits. The test switch's first Repaint and the admins' trigger take the nearest pair
    even outside the band (marked `outside`), so a test always sees one.
14. **At most two a battle:** a new base-boss flag, `ultimateMax` (`ultimateSpent` in the dispatcher): after the last,
    as after a once-a-battle ultimate, the meter is off and the trigger refuses.
15. **Online, the host's engine picks the pair** (the boss request's `repaint`, as Alfil's and Chub & Chirp's picks);
    the server works out the pairs and checks the answer is one of them; no answer or no host: no Repaint that turn.
16. **The test switch** `?power=repaint` starts from 1.e4 d5 2.exd5 Qxd5 (a pawn gone from each side, so a pair can
    fit; his a- and h-pawns and rooks at home, so Camouflage comes as ever).
17. **Moments:** `camouflage` (`squares`: the rook's square, then where it hides), `strike` (`reveal` "move" or
    "check"), `rookTaken` and `repaint` (`squares`: the pawn, then the piece). Their lengths (`SMUDGY_FX`) are
    placeholders until his animations set them.
18. **The app side here is only what compiles and plays:** an empty `components/Smudgy.tsx`, his power words, the
    `paint` refusal line, solo's `repaintTurn` and the host's `repaint` answer. Everything drawn is the wiring lane's.

## The numbers

SIM-NUMBERS

Every number is in `BOSS_POWERS` (`camoTries`, `camoStrikeTurn`, `repaintBand`, `repaintTarget`, `repaintMax`,
`repaintNodes`, `rageSpeed.smudgy`) and his offset in `BOSS_ROSTER`.
