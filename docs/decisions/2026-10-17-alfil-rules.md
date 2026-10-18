# Alfil's powers in the rules: Tusks and the Mammoth Slam (Oct 17, 2026)

Eric approved Alfil's boss sheet on Oct 17 (Tusks revised the same day): a woolly mammoth, the chess bishop's ancestor.
This builds his two powers in the rules, the protocol and the simulator. His art (sprite, animations, sounds, lines,
select tile, FAQ words) is the art lane's, a later PR; until it ships he is **hidden from players**. How it works now:
[docs/areas/bosses.md](../areas/bosses.md) (his row); the calibration: [reports/alfil-sim.md](../../reports/alfil-sim.md).

## What Eric decided (the sheet)

- **Tusks:** in Eric's words (Oct 17): "he points his weapon at two of his pawns as if casting; they glow. He plays his
  move, you play yours; on his next turn the two pawns lift to the center of the board, fuse in the air in a white
  flash, and the elephant appears." "From his 3rd turn, then every few turns. At most 2 elephants a game (Eric: yes)."
  He marks two of his pawns "anywhere on the board", "then he plays his normal move." "Your turn, the counter: capture
  either glowing pawn and the fusion fails (Eric: yes)." The elephant is "a bishop in every way, drawn with its own
  piece art" and "drops onto one of the two pawns' squares, whichever the engine prefers." "2 pawns (2) become a bishop
  (3), so he gains about 1 point." "Which pair: the engine picks the pair that helps him most, as for the other bosses'
  powers."
- **Mammoth Slam:** "once his meter is full, as for the other bosses"; "2 pawns and 1 knight or bishop; never your
  queen, rook or king; if you have fewer of those, he takes fewer"; "gone for 3 of your turns", then "back on their own
  squares"; taken: "the nearest empty square", a bishop on its color, a pawn never on the first or last rank, "never
  lands giving check, and never somewhere it would just be taken for free when another square avoids that"; "a cap on
  how much it can swing the game while they're airborne"; "It never leaves you mated in one because a piece is
  airborne." "The engine doesn't know they're coming back. That's fine, and it's part of the fun."

## The fusion is his move (V1; the director's call, Oct 17)

**The fusion is Alfil's whole turn:** the two pawns lift off, the elephant lands, and the crowd's turn begins. He plays
no other move that turn. The cast still comes with his normal move.

- **Why:**
  - **As first built**, with the fusion at the start of his turn and then his move (the sheet's bullet "Then he plays
    his move"), he won all 26 battles in the sim: a crowd score of 0.00, out of the pack (below).
  - **V1 scores 0.23 (± 0.08) over 26 battles**, in 32 crowd moves (12 to 60). That's inside the pack's spread: on
    today's code Sawyer scores 0.15 and Big Boy 0.35, and in the Oct 15 pack Ginger scored 0.08 and Jefferson 0.04.
    (The tuning round's target was 0.25 to 0.55; V1 is within one standard error of it.)
  - **It keeps everything Eric decided:** the cap of two elephants, and his cast, glow and fusion flow. It settles only
    what his own description left open: he said the cast comes with his move, and for the fusion only that the pawns
    lift, fuse and become the elephant, not whether Alfil also moves that turn.
  - **It changes the least of the variants measured.** The tuning round was to take the first in this order that
    landed: V1, then V2 (V1 with the elephant on the less advanced square, not the engine's pick), V3 (V1 with the first
    cast at his 6th turn), V4 (the first cast at his 8th turn, the fusion as first built).
- **The fusion stays forced when it's due:** once a cast stands uncountered and a square is allowed, his next turn is
  the fusion. He can't skip it to answer a threat the crowd made on the turn between, so that threat goes unanswered for
  a turn. That's counterplay, and it's intended. (A check is the one exception: no fusion can answer it, so the fusion
  waits. The marks stay, he answers the check with a move, and the fusion comes on his next turn that isn't in check.
  The counter is unchanged: take a marked pawn. As first built, a check killed the fusion; the director's call in the
  review round, below.)

### The tuning round (the raid sim, 26 battles each, seeds 1 to 13 and 31 to 43, `counter: 1`)

| Variant | What | Battles | Crowd wins | Draws | Boss wins | Crowd score (± 1 s.e.) | Seeds 1-13 / 31-43 | Moves (range) | Ultimates | Casts | Fusions | Countered | No square |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **V1** | **the fusion is his move (adopted)** | 26 | 6 | 0 | 20 | **0.23** (± 0.08) | 0.31 / 0.15 | 32 (12-60) | 2.0 | 60 | 50 | 8 | 2 |
| V2 | V1 + the less advanced square | 26 | 4 | 0 | 22 | **0.15** (± 0.07) | 0.23 / 0.08 | 30 (14-60) | 1.7 | 65 | 51 | 13 | 1 |
| V3 | V1 + first cast at his 6th turn | 26 | 5 | 1 | 20 | **0.21** (± 0.08) | 0.27 / 0.15 | 34 (15-60) | 2.1 | 69 | 49 | 13 | 6 |
| V4 | first cast at his 8th turn alone | 26 | 2 | 0 | 24 | **0.08** (± 0.05) | 0.08 / 0.08 | 32 (15-60) | 1.8 | 65 | 51 | 11 | 3 |

Runs `v1a`/`v1b` to `v4a`/`v4b` (`reports/boss-sim/raid-<tag>.jsonl`). V1 and V3 ran on this PR's V1 rules (the same
code but for comments, and a moment for a fusion with no square that was dropped since: neither touches the game); V4
on the rules as first built (aff97c6) with `tusksFirst: 8`. Earlier, at 13 battles each: the first cast at his 8th turn
0.23 (`f8a`), one elephant a battle 0.08 (`m1a`). Both would have changed a number Eric set; V1 doesn't.

**The sim isn't repeatable seed for seed.** A seed fixes the match's own random source, but the boss's moves are
Stockfish's at a set strength (UCI_Elo), and Stockfish draws those from the clock ([reports/engine-reader.md](../../reports/engine-reader.md)).
So the same seed plays a different battle each run: on the same code (aff97c6), seed 1 ran 17 crowd moves once and 20
the next. V4's seeds 1 to 13 scored 0.08, where `f8a`, the same rule on the same seeds, scored 0.23. Compare runs by
their totals and their standard errors (about ± 0.08 at 26 battles), never battle by battle.

### What V1 changed in the rules

- **The fusion's position has the crowd to move:** a base at the same ply (no move on the board, so no last move to
  show). The crowd's turn is then set up as after his move (`Battle.bossPassed`: the meter, the warning, the turn's
  moments), and the Slam's pieces land if that turn is when they're due (`alfilBattle.landDue`).
- **His turns count his fusions** (`hisTurn`: his moves plus his fusions, plus one), so the cast's schedule (his 3rd
  turn, then every 5) counts the fusion as a turn.
- **A turn's steps, in order:** the Mammoth Slam (at the start of his turn, before anything else of his), then the
  fusion (his turn ends with it) or a new cast (then his move). As first built, the fusion came before the Slam.
- **The guards** (`fusedFen`) are those of a move: his king never left attacked (a pawn that blocks a check gives way
  only to the elephant on its own square; in check as his turn begins, no fusion answers it, so it waits for his next
  turn and he moves), never a check given, never more of the crowd's material left hanging, never the crowd left
  without a move (no stalemate by a power), never a dead draw (review round), and the engine plays the position. **The mate-in-one guard is gone:** the crowd now sees the
  elephant and answers it before he moves again.
- **The engine's pick** scores each way with the crowd to move, his score the rest (`fuseFrom`), for the cast's pairs
  too.
- **On screen:** the fusion's moment plays first among the moments of the crowd's turn it begins (its event comes with
  that turn, `ALFIL.everyTurn`), before the crowd's clock starts, as after his move. A fusion that fails for lack of a
  square has no moment, as when the crowd takes a marked pawn, and he plays his move.
- **The God King's strike** made just before a fusion hits the fusion (review round, the director's call): the elephant
  lands on the worse of its two squares for him, in the engine's view (the square the engine didn't pick), and the strike
  is spent there, as by a move. With one square allowed, or no engine's answer, it lands as usual, and the strike is
  still spent. As first built, the strike waited for his next move on the board, so "Boss staggered." stayed up over
  the crowd's next turn and the crowd couldn't call another strike then.

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
- **Tuned (V1), hidden until his art is wired in:** with the fusion as his move he's inside the pack (above). The art
  lane's last step (his kit) makes him playable.
- **His rage speed: 1.2** (as Ginger's and Jefferson's): the Slam holds the meter about four turns (its own and three
  up), like the blizzard.

### Tusks

- **When:** the cast comes at the start of his turn, before his move, a step of its own (as Big Boy's bounce: the
  runner's `alfilStep`, the lobby's `requestAlfil`, solo's `alfilTurn`), so its moment plays before his move. The
  fusion is his next turn, and his move (V1, above). "His Nth turn" counts his turns, his moves and his fusions
  (`hisTurn`), whoever moved first.
- **Every 5 of his turns** (`tusksEvery`): casts at his 3rd, 8th, 13th... while he has fewer than two elephants. The
  sheet's "every few turns"; a cast the crowd counters comes back five turns later. The sims can't tell 5 from 8 (his
  battles end before a later cast matters).
- **The engine's pick, unbounded, as the sheet has it.** The pair: the cast weighs `tusksLooks` (5) of his pairs by
  their fusion as if it came now (`tusksPairs`), and marks the one best for him (Eric: "the pair that helps him most").
  The square: the one best for him (Eric: "whichever the engine prefers"; `fuseFrom`, each position searched at
  `tusksNodes` 30,000 with the crowd to move, as Big Boy's bounce weighs its candidates). Equals go in a fixed order
  (the pairs' order, then the squares'). With no engine's answer (no host, an older app's move) the fusion still comes:
  the first square allowed (the cast: the first pair). Only the counter, or a position where neither square is allowed
  now, stops it.
- **A cap was built first and dropped (the sims and a probe).** The first build bounded the fusion like the other
  powers: the square whose gain for him was nearest **1 pawn** inside **0.5 to 1.5** (the sheet's "about 1 point";
  none: no fusion). The measure is Stockfish's verdict in log-odds (`bouncePawnLogit`, the bounce's), and Stockfish
  calls a bishop for two pawns, put down just before his move (as first built), a won game: a probe on 21 balanced
  positions from engine play read the median fusion at **+7.3 pawns** (the measure's ceiling), only 4% of 292 fusions
  under 1.5. So the cap stopped **67 to 69%** of the fusions in the sims and let through only those in games already
  decided (every recorded gain 0: both readings at the measure's end). A fusion that fails two times in three without
  a counter isn't the sheet's power, and the cap kept only the decided games' fusions, the reverse of its aim; so it
  went. With the cap gone, `tusksGain` and `tusksTarget` went too. (V1, not a cap, is what brought him into the pack.)
- **The pair's order before the engine looks:** the pairs giving up a passed pawn or his king's shield come last,
  seeded among equals. The counter isn't avoided: it's part of the power.
- **Never an illegal position:** the fusion is his move, so it never leaves his king attacked (a pawn that blocks a
  check can give way only to the elephant on its own square: the block holds; in check as his turn begins, no fusion
  answers it, so it waits for his next turn, and he moves), never gives check (no power's piece ever lands giving one), never leaves the
  crowd without a move (no mate or stalemate by a power), and the engine plays it (two pawns fewer and a bishop more
  never passes what promotions make). Two bishops on one color can happen: the elephant is "a bishop in every way". As
  first built, a fusion that gave him a mate in one wasn't allowed (the crowd never saw the elephant before his move);
  with V1 the crowd sees it and answers first, so that guard went.
- **Never one that leaves more of the crowd's material hanging than before** (Big Boy's bounce's rule; Sawyer's split
  never lands attacking a piece): the crowd sees the pawns glow but not the square, so a fork it couldn't see coming
  would win material at once, far more than the fusion's point.
- **The counter:** a marked pawn taken (en passant too), or no longer a pawn (it promoted), fails the fusion at once.
- **The marked pawns and the elephants travel with their pieces** (`followSquares`, as Sawyer's halves); an elephant
  taken drops off the list.

### The Mammoth Slam

- **When:** at the start of his turn after its warning, as Big Boy's bounce (his turn then is the one place the host's
  engine already works between moves), before anything else of his that turn (a fusion due comes after it). They land
  as the crowd's 4th turn begins: three crowd turns without them.
- **The swing cap, played out:** the engine can't read a position five points down (Stockfish's win/draw/loss puts the
  crowd at 0.000 for every lift: a probe on 39 balanced positions read all 16 lifts the same), so the slam's measure
  plays the turns out (the engine's best for both sides, `slamLineNodes` a search), puts the pieces down and scores the
  position (`slamFrom`): the crowd's loss nearest **0.75 pawns** (`slamTarget`) inside **0.25 to 1.5** (`slamLoss`),
  else the nearest below; never past the cap, never a mate against the crowd. Of the lifts leaving the least of the
  crowd's material hanging, seeded, `slamLooks` 4 are played out. The engine-boss, thinking he's five points up, often
  trades down and the returning pieces punish it: the crowd's gain then reads below the band, as Eric expected ("you
  can plan around it, and he can't"). The measure is coarse (the line mostly reads no change or a big swing; the lift
  picked was in the band for 1 of V1's 43 lifts, 0 of 25 as first built, 5 of 36 for the Slam alone and 8 of 61 in the
  capped runs: `reports/alfil-sim.md`): what
  the cap does in practice is never turn a balanced game into a lost one for the crowd. When every lift weighed would,
  nothing lifts. As first built the meter was spent then, as with the bounce; since the review round it isn't (below).
- **Never a piece whose lift leaves the crowd's king in check**, nor one that opens a new check on his; a lone minor
  that blocks one: two pawns alone (fewer, as the sheet's "fewer if you have fewer"). A check he's already in (the
  crowd's last move gave it) doesn't stop the Slam: as first built it did, every lift refused, and the meter was spent
  on nothing (review round).
- **The landing:** own squares first (Eric's predictable option; the hanging rule only for a taken square, as the sheet
  says), then the nearest empty square allowed by king steps, then straight-line steps, then square order; never giving
  check (for an own square too: the crowd's move would start with his king in check); the side to move always has a
  move; a piece with nowhere to go stays up one more turn. A piece that lands on the en passant square takes it away
  (review round: as first built, the stale square made a pawn's own square look unplayable, so it landed beside it).
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
(his move: the two squares and the elephant's; `to` null: it failed, `why`, and he moved instead), `elephants`
(squares now), `slam` (the lift, the turn they land, the engine's measure when known here), `airborne` (each piece: its
square, the turn it lands, turns left, shadow size), `landed` (each piece's own square and where it came down;
`early`). Events: `tusks` and `slam` at the start of his turn, `fuse` with the crowd's turn his fusion begins (none for
a fusion that failed), `land`. The boss request: `fuse` (positions with an elephant, the crowd to move: the cast's
pairs or the fusion's squares) and `slam` (the lifts); the host answers a position or "". An older app as host ignores
both and answers a move: the cast's first pair, the fusion's first square allowed, nothing lifts (since the review round
the meter is kept, so with such a host the Slam is asked for each turn and never lifts). The app's
`momentsOf` passes over a moment kind it doesn't know (an older app would have thrown on a newer server's), and his
moments (`components/Alfil.tsx`) hold their time and draw nothing until his art comes.

**Old apps (review round):** an app from before this PR still throws on his moments' kinds (its `momentsOf` reads
every kind it's sent). It can't meet him through this PR: online he can't be picked until his art makes him playable
(`lobby-options.ts` takes only a playable boss), and his test link is solo. Once he's playable, an app left open since
before this deploy could meet him in an online raid before it updates: the main lobby has no version check (Squads and
the duel have one), and the service worker fetches every page fresh, so any reload or new visit gets the new app. Eric's
site is behind Cloudflare Access, so only Eric's devices could; no gate (the lobby's hello carries no version to check
in one line).

## The review round (Oct 17, after the independent review)

The review found no blocker, and no illegal position in a 60-battle fuzz. Its items, with the director's calls and mine:

- **A check no longer cancels the Slam** (the director's call). The lift's guard refused every lift while his own king
  was attacked, so a check from the crowd's last move made the Slam lift nothing, and the meter was spent anyway. Now
  only a lift that adds a check on him is refused (a line opened onto his king); a check he's already in stays, and his
  move after the Slam answers it. Every other guard stays (never a blocker of a check on the crowd's king, the landing's
  rules, the swing cap).
- **A Slam that lifts nothing keeps the meter** (the director's call): no lift could go, every lift was past the cap, or
  no engine answered. Nothing shows (no moment, no event), the meter stays full and warned, and the Slam comes again at
  the start of his next turn (`slamWait` in the match's state, never sent to screens; the trigger's `ultNext` is kept
  the same way). Online with no host, or an older app as host, that's one more host request (or its timeout) on each
  of his turns until a lift goes.
- **A check postpones the fusion** (the director's call): above, under "The fusion stays forced".
- **The God King's strike applies to a fusion** (the director's call): above, under "What V1 changed". No protocol
  change: the host is asked for its pick as ever, and the server takes the other square.
- **The move number:** when Black passes (his fusion when he's Black), the position's move number goes up, as after
  Black's move (`passTurn`). Hollow's pass is the crowd's, which is always White against him, so its number already
  stayed, as it should; the rule is now the general one.
- **The admins' trigger during a step** (the Slam then due at once) no longer wastes it: the host's pick comes back with
  the step it was asked for (`applyAlfil(pick, loss, step)`), and a pick for a step that isn't his now is dropped. The
  Slam is asked for next, then the step.
- **The en passant square:** a piece the Slam puts back on it takes it away (above, the landing).
- **Never a dead draw by a fusion (my call):** the cast never marks a pair whose fusion would leave too little material
  to mate (a lone bishop against a lone king, or bishops all on one color: `fusedFen` asks the game's own rule). If a
  marked pair comes to that by the fusion's turn (the crowd's last other piece taken in between), both squares are
  refused and the fusion fails as any fusion with no square does ("nowhere": no moment, he moves). I chose this over
  postponing it: it's one more guard on the list every square already passes, and a postponed fusion would mostly wait
  for good (king and two pawns against a lone king stays a dead draw whichever square the elephant takes).
- **Old apps:** the protocol section, below.
- **Not re-simulated:** the sims here ran on the rules before this round. The kept meter makes his Slam come more often
  (in V1, 10 of 53 Slams lifted nothing and spent the meter; each would now come again a turn later), and 2 of those
  10 had no lift to weigh at all (the rows don't keep the position; a check on his king, which emptied the list before
  this round, is the likely cause). The postponed fusion, the
  strike's effect and the dead-draw guard touch few battles. My estimate: a little stronger for him, within V1's
  standard error (± 0.08).

## The sim ([reports/alfil-sim.md](../../reports/alfil-sim.md))

The raid sim, 26 paired battles a run, with a crowd that takes a marked pawn when it costs at most a pawn (the bots'
judge doesn't know the rule). The probes quoted in this file (21 balanced positions and 292 fusions; 39 positions and 16
lifts; Stockfish's verdicts from the starting position) came from one-off scripts that aren't committed. The pack: 0.04 (Jefferson) to 0.79 (Hollow) for the crowd on Oct 15; on today's code
Sawyer 0.15 and Big Boy 0.35.

- **The fusion as his move (V1, adopted): 0.23** (± 0.08; 6 of 26 the crowd's, 32 crowd moves). In the pack.
- **As first built (the fusion, then his move): 0.00** (26 of 26 his, 25 crowd moves). Out of the pack: each fusion
  is a bishop for two pawns, which Stockfish calls a won game (two pawns up from the start: 1.000 too), and at the
  raid's tier he plays near Stockfish's floor, so his offset can't make up for it.
- **The Slam alone (Tusks off): 0.50**, mid-pack.
- **The capped Tusks: 0.35**, but two fusions in three failed with no counter, and the ones that came were in decided
  games: not a fix (above).
- **The numbers left to me didn't move it:** every 8 turns instead of 5, a lower offset.
