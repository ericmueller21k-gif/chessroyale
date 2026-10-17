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
- **His offset: −250**, the bottom of the others' range (as Big Boy, Sawyer and Wrangler, the bosses whose powers move
  material). At the sim's tier (1600, the Solo raid's bots) that's 1350, 30 above Stockfish's floor, with the 25% slips
  every boss this far under its tier gets; −400 is the floor itself with the same slips (one paired battle each: both
  his, in 19 and 14 moves). So at that tier his powers decide, not the offset, and going below the others' range buys
  nothing there; in stronger lobbies it works as theirs does.
- **Not to be made playable as he is:** with the sheet's Tusks he wins every battle in the sim (below). The art lane's
  last step (his kit) should wait for Eric's call on Tusks' strength.
- **His rage speed: 1.2** (as Ginger's and Jefferson's): the Slam holds the meter about four turns (its own and three
  up), like the blizzard.

### Tusks

- **When:** the cast and the fusion happen at the start of his turn, before his move, each its own step (as Big Boy's
  bounce: the runner's `alfilStep`, the lobby's `requestAlfil`, solo's `alfilTurn`), so each has its own moment on
  screen before his move, in the sheet's order. "His Nth turn" counts his moves (`hisTurn`), whoever moved first.
- **Every 5 of his turns** (`tusksEvery`): casts at his 3rd, 8th, 13th... while he has fewer than two elephants. The
  sheet's "every few turns"; a cast the crowd counters comes back five turns later. The sims can't tell 5 from 8 (his
  battles end before a later cast matters).
- **The engine's pick, unbounded, as the sheet has it.** The pair: the cast weighs `tusksLooks` (5) of his pairs by
  their fusion as if it came now (`tusksPairs`), and marks the one best for him (Eric: "the pair that helps him most").
  The square: the one best for him (Eric: "whichever the engine prefers"; `fuseFrom`, each position searched at
  `tusksNodes` 30,000, as Big Boy's bounce weighs its candidates). Equals go in a fixed order (the pairs' order, then
  the squares'). With no engine's answer (no host, an older app's move) the fusion still comes: the first square
  allowed (the cast: the first pair). Only the counter, or a position where neither square is allowed now, stops it.
- **A cap was built first and dropped (the sims and a probe).** The first build bounded the fusion like the other
  powers: the square whose gain for him was nearest **1 pawn** inside **0.5 to 1.5** (the sheet's "about 1 point";
  none: no fusion). The measure is Stockfish's verdict in log-odds (`bouncePawnLogit`, the bounce's), and Stockfish
  calls a bishop for two pawns, put down just before his move, a won game: a probe on 21 balanced positions from engine
  play read the median fusion at **+7.3 pawns** (the measure's ceiling), only 4% of 292 fusions under 1.5. So the cap
  stopped **67 to 69%** of the fusions in the sims and let through only those in games already decided (every recorded
  gain 0: both readings at the measure's end). A fusion that fails two times in three without a counter isn't the
  sheet's power, and the cap kept only the decided games' fusions, the reverse of its aim; so it went. With the cap
  gone, `tusksGain` and `tusksTarget` went too.
- **The pair's order before the engine looks:** the pairs giving up a passed pawn or his king's shield come last,
  seeded among equals. The counter isn't avoided: it's part of the power.
- **Never an illegal position:** no fusion opens a check on his king (a pawn that blocks one can give way only to the
  elephant on its own square: the block holds), none gives check (the crowd's king attacked on his move is no
  position), none gives him a mate in one (my call: the crowd never sees the elephant before it mates, as the Slam
  never leaves the crowd mated in one), he always has a move, and the engine plays it (two pawns fewer and a bishop
  more never passes what promotions make). Two bishops on one color can happen: the elephant is "a bishop in every
  way".
- **Never one that leaves more of the crowd's material hanging than before** (Big Boy's bounce's rule; Sawyer's split
  never lands attacking a piece): a piece put down just before his move would otherwise win material at once.
- **The counter:** a marked pawn taken (en passant too), or no longer a pawn (it promoted), fails the fusion at once.
- **The marked pawns and the elephants travel with their pieces** (`followSquares`, as Sawyer's halves); an elephant
  taken drops off the list.

### The Mammoth Slam

- **When:** at the start of his turn after its warning, as Big Boy's bounce (his turn then is the one place the host's
  engine already works between moves). They land as the crowd's 4th turn begins: three crowd turns without them.
- **The swing cap, played out:** the engine can't read a position five points down (Stockfish's win/draw/loss puts the
  crowd at 0.000 for every lift: a probe on 39 balanced positions read all 16 lifts the same), so the slam's measure
  plays the turns out (the engine's best for both sides, `slamLineNodes` a search), puts the pieces down and scores the
  position (`slamFrom`): the crowd's loss nearest **0.75 pawns** (`slamTarget`) inside **0.25 to 1.5** (`slamLoss`),
  else the nearest below; never past the cap, never a mate against the crowd. Of the lifts leaving the least of the
  crowd's material hanging, seeded, `slamLooks` 4 are played out. The engine-boss, thinking he's five points up, often
  trades down and the returning pieces punish it: the crowd's gain then reads below the band, as Eric expected ("you
  can plan around it, and he can't"). The measure is coarse (the line mostly reads no change or a big swing; the band
  is hit about one lift in ten in the sims): what the cap does in practice is never turn a balanced game into a lost
  one for the crowd. When every lift weighed would (about one Slam in six), nothing lifts and the meter is spent, as
  with the bounce.
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
cast's first pair, the fusion's first square allowed, nothing lifts. The app's `momentsOf` passes over a moment kind
it doesn't know (an older app would have thrown on a newer server's), and his moments (`components/Alfil.tsx`) hold
their time and draw nothing until his art comes.

## The sim ([reports/alfil-sim.md](../../reports/alfil-sim.md))

The raid sim, 26 paired battles a run, with a crowd that takes a marked pawn when it costs at most a pawn (the bots'
judge doesn't know the rule). The pack: 0.04 (Jefferson) to 0.79 (Hollow) for the crowd.

- **As built, the sheet's Tusks: 0.00** (26 of 26 his, 25 crowd moves). Out of the pack, the strongest boss by far.
- **The Slam alone (Tusks off): 0.50**, mid-pack. Tusks is the whole difference: each fusion is a bishop for two
  pawns, which Stockfish calls a won game (two pawns up from the start: 1.000 too), and at the raid's tier he plays near
  Stockfish's floor, so his offset can't make up for it.
- **The capped Tusks: 0.35**, but two fusions in three failed with no counter, and the ones that came were in decided
  games: not a fix (above).
- **The numbers left to me don't move it:** every 8 turns instead of 5, a lower offset.

**For Eric (his call: each changes the approved sheet; measured, 13 battles each):**

1. The first cast at his **8th** turn, not his 3rd: **0.23** (in the pack, near Big Boy's 0.27; 36 moves).
2. **One** elephant a battle, not two: **0.08** (Ginger's 0.08; 33 moves).
3. Not measured: the fusion as his move (the elephant lands and that's his turn), so the crowd answers it before he
   plays on.

Each is one number in `BOSS_POWERS` (`tusksFirst`, `tusksMax`) except the third, a rule. He stays hidden until then.
