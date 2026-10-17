# Alfil's powers in the rules: Tusks and the Mammoth Slam (Oct 17, 2026)

Eric approved Alfil's boss sheet on Oct 17 (Tusks revised the same day): a woolly mammoth, the chess bishop's ancestor.
This builds his two powers in the rules, the protocol and the simulator. His art (sprite, animations, sounds, lines,
select tile, FAQ words) is the art lane's, a later PR; until it ships he is **hidden from players**. How it works now:
[docs/areas/bosses.md](../areas/bosses.md) (his row); the calibration: [reports/alfil-sim.md](../../reports/alfil-sim.md).

## What Eric decided (the sheet)

- **Tusks:** "from his 3rd turn, then every few turns. At most 2 elephants a game (Eric: yes)." He marks two of his
  pawns "anywhere on the board", "then he plays his normal move." "Your turn, the counter: capture either glowing pawn
  and the fusion fails (Eric: yes)." "His next turn, the fusion: before his move ... the elephant (a bishop in every
  way, drawn with its own piece art) drops onto one of the two pawns' squares, whichever the engine prefers. Then he
  plays his move." "2 pawns (2) become a bishop (3), so he gains about 1 point." "Which pair: the engine picks the pair
  that helps him most, as for the other bosses' powers."
- **Mammoth Slam:** "once his meter is full, as for the other bosses"; "2 pawns and 1 knight or bishop; never your
  queen, rook or king; if you have fewer of those, he takes fewer"; "gone for 3 of your turns", then "back on their own
  squares"; taken: "the nearest empty square", a bishop on its color, a pawn never on the first or last rank, "never
  lands giving check, and never somewhere it would just be taken for free when another square avoids that"; "a cap on
  how much it can swing the game while they're airborne"; "It never leaves you mated in one because a piece is
  airborne." "The engine doesn't know they're coming back. That's fine, and it's part of the fun."

## My calls

### Hidden until his art ships

- **His roster entry has `kit: null`.** The one playable rule (`isPlayable`: a kit and powers) then keeps him off every
  menu (the Boss raid screen's tiles), out of random picks and public queues, and out of a lobby's pick, with no new
  flag. The existing test switch meets him: `?boss=alfil&wip=1` (Boss alone; test switches are for admins, test
  servers and dev only). The art lane's last step (his kit's name in his roster line) makes him playable.
- **His offset: −250** (as Big Boy, Sawyer and Wrangler, the bosses whose powers move material): the sim below. At the
  raid's tiers a boss this far under the lobby plays at Stockfish's floor (1320), so below 1600 his powers decide, not
  the offset; an offset lower than the others' would change nothing there (measured: −400 crushed the crowd as −250 did).
- **His rage speed: 1.2** (as Ginger's and Jefferson's): the Slam holds the meter about four turns (its own and three
  up), like the blizzard.

### Tusks

- **When:** the cast and the fusion happen at the start of his turn, before his move, each its own step (as Big Boy's
  bounce: the runner's `alfilStep`, the lobby's `requestAlfil`, solo's `alfilTurn`), so each has its own moment on
  screen before his move, in the sheet's order. "His Nth turn" counts his moves (`hisTurn`), whoever moved first.
- **Every 5 of his turns** (`tusksEvery`): casts at his 3rd, 8th, 13th... while he has fewer than two elephants.
- **The engine's pick, bounded (the sim's verdict):** the first build let the engine pick the square best for him with
  no bound. The paired sim: **26 of 26 battles won by him, 25 moves on average** (the pack: 0.04 to 0.79 of a point per
  battle for the crowd). Each fusion was worth about +1.8 pawns to the engine, not the sheet's "about 1 point": an
  elephant put down on its best square just before his move is a free move. In one replay (seed 5) the elephant on c6
  and his Qa5+ left every reply at 0.000. Every other engine-scored power is bounded (the bounce, the drag, the
  showdown, the funhouse's move), and Eric's "as for the other bosses' powers" points there. So the engine picks the
  square whose gain for him is nearest **1 pawn** (`tusksTarget`) inside **0.5 to 1.5** (`tusksGain`), else the
  nearest below; never past the cap, never a mate. None: the fusion fails and the pawns stay (`fusion.why` "nowhere").
- **The pair, the same way:** the cast weighs a few seeded pairs (`tusksLooks` 5) by their fusion as if it came now,
  with the same pick (`tusksPairs`, `castPick`): a pair whose fusion will land in the band, not one too strong to come.
  With a static pick (the elephant's reach) about half of all casts fizzled on the cap at fusion time. The pairs giving
  up a passed pawn or his king's shield come last. The counter isn't avoided: it's part of the power.
- **Never an illegal position:** no fusion opens a check on his king (a pawn that blocks one can give way only to the
  elephant on its own square: the block holds), none gives check (the crowd's king attacked on his move is no
  position), he always has a move, and the engine plays it (two pawns fewer and a bishop more never passes what
  promotions make). Two bishops on one color can happen: the elephant is "a bishop in every way".
- **Never one that leaves more of the crowd's material hanging than before** (Big Boy's bounce's rule; Sawyer's split
  never lands attacking a piece): a piece put down just before his move would otherwise win material at once.
- **The counter:** a marked pawn taken (en passant too), or no longer a pawn (it promoted), fails the fusion at once.
- **The marked pawns and the elephants travel with their pieces** (`followSquares`, as Sawyer's halves); an elephant
  taken drops off the list.

### The Mammoth Slam

- **When:** at the start of his turn after its warning, as Big Boy's bounce (his turn then is the one place the host's
  engine already works between moves). They land as the crowd's 4th turn begins: three crowd turns without them.
- **The swing cap, played out:** the engine can't read a position five points down (Stockfish's win/draw/loss puts the
  crowd at 0.000 for every lift: a probe on 40 balanced positions read all 16 lifts the same), so the slam's measure
  plays the turns out (the engine's best for both sides, `slamLineNodes` a search), puts the pieces down and scores the
  position (`slamFrom`): the crowd's loss nearest **0.75 pawns** (`slamTarget`) inside **0.25 to 1.5** (`slamLoss`),
  else the nearest below; never past the cap, never a mate against the crowd. Of the lifts leaving the least of the
  crowd's material hanging, seeded, `slamLooks` 4 are played out. The engine-boss, thinking he's five points up, often
  trades down and the returning pieces punish it: the crowd's gain then reads below the band, as Eric expected ("he
  can't plan around it").
- **Never a piece whose lift leaves the crowd's king in check**, nor one that opens a check on his; a lone minor that
  blocks one: two pawns alone (fewer, as the sheet's "fewer if you have fewer").
- **The landing:** own squares first (Eric's predictable option; the hanging rule only for a taken square, as the sheet
  says), then the nearest empty square allowed by king steps, then straight-line steps, then square order; never giving
  check (for an own square too: the crowd's move would start with his king in check); the side to move always has a
  move; a piece with nowhere to go stays up one more turn.
- **Never mated in one because they're up:** at the start of his turn, if he has a mate in one that he wouldn't have with
  them down, they land at once (`landed.early`), before his move.
- **Near the end:** they land by the crowd's last turn at the latest (the battle's verdict counts them).
- **The shadows:** the view gives each airborne piece its square (where it lands), the crowd turn it lands, the turns
  left and the shadow's size 1 to 3, counted as Jefferson's candle counts its shadows.

### What's left alone

- **The judge** scores the crowd's moves by the engine as ever: it doesn't know about the fusion or the airborne pieces
  ("The engine doesn't know they're coming back. That's fine"). A capture of a marked pawn is scored as the engine sees
  it; a judge rule for it, as the fire's, would put the marked pawns in every judging job (the judging protocol, with
  every judge's exact match), which this PR leaves alone. A turn with pawns marked or pieces up doesn't count for fair
  play (`powerTurn`). Flagged for the director.
- **He limits nobody's moves:** no `bossStops`, no new refusal words.

### The protocol (optional fields only; an older app ignores them)

`NetBossPowers`: `tusks` (the cast: his turn, the crowd move it came after, the marked pawns' squares now), `fusion`
(the two squares and the elephant's; `to` null: it failed, `why`), `elephants` (squares now), `slam` (the lift, the
turn they land, the engine's measure when known here), `airborne` (each piece: its square, the turn it lands, turns
left, shadow size), `landed` (each piece's own square and where it came down; `early`). Events: `tusks`, `fuse`,
`slam`, `land`. The boss request: `fuse` (positions with an elephant: the cast's pairs or the fusion's squares) and
`slam` (the lifts); the host answers a position or "". An older app as host ignores both and answers a move: the
cast's first pair, no fusion, nothing lifts. The app's `momentsOf` passes over a moment kind it doesn't know (an
older app would have thrown on a newer server's), and his moments (`components/Alfil.tsx`) hold their time and draw
nothing until his art comes.

## The sim

<!-- filled in from reports/alfil-sim.md -->
