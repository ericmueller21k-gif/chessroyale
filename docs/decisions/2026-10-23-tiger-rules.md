# The circus tiger in the rules: Balloons and Hoops (Oct 23, 2026)

A new raid boss (Eric, Oct 23): **Babur, the circus tiger** (id `tiger`), a circus tiger who hated his act (the roaring,
the jumping through hoops) and makes chess-piece balloons. His name (Eric, Oct 24) is one constant, `TIGER_NAME = "Babur"`
(core `boss.ts`), a plain name like Smudgy's. This builds his rules, the server side, solo,
the raid sim, the tests and the FAQ block. His art and animations are on `claude/tiger-sprite`
(docs/decisions/2026-10-23-tiger-animations.md there); the wiring (kit, sprite, the pump in the boss bar, the board art) is
the next lane's. Until then he stays **not playable** (`kit: null`; the test links `?boss=tiger&wip=1`, `&power=hoops`,
`&balloon=<pawn|knight|bishop|rook|queen|fakequeen>`, `&stage=N`). How it works now: [bosses.md](../areas/bosses.md)
(his row); the tuning: [reports/tiger-sim.md](../../reports/tiger-sim.md).

## What was decided before this lane (the brief, Eric's words in the design notes)

- **Opening:** the same start every raid has (the starting position).
- **Balloons (passive):** a balloon on his nozzle at the start of his turn when it's empty; 4 stages of 15 s on the same
  clocks as Puddles' seeds; ready after; at the end of his turn a ready balloon lands as one of his pieces or pops; the
  nozzle empty until his next turn. Shapes and pops (percent): pawn 55 (pops 12), knight 13 (25), bishop 13 (25), rook 6
  (35), fake queen 10 (always), queen 3 (never): about 25% pop. Whether it pops is decided at the roll and shown only as
  it pops; a fake queen is a queen everywhere. Where it lands: fair, by the host's engines, his gain in the shape's band
  (pawn [0.3, 1.5], knight or bishop [2, 4], rook [3.5, 6], queen [7, 10.5]) nearest the middle, with hard guards. Six
  colors, seeded. Moments `place`, land, `pop`, cheer, big cheer, `wince`.
- **Hoops (ultimate):** the rage meter, the warning, his whole turn; three 2x2 blocks in ranks 2 to 7 (the inner ranks
  preferred), apart; walls for both sides for the crowd's next 2 moves (his move between them too): no move across, no
  capture or attack across, so no check across; within a block, moves allowed. Placed by the host's engines, his gain in
  [0.5, 2.5] nearest 1.5, greedy block by block; guards; fewer fit, what fits; none, no cast. About 3 casts a battle.

## The calls made here, and why

1. **Readiness is decided as his turn's work is asked for**, not as his move lands (`balloonAsk`: the request for his move
   or his cast; once a turn, kept on the balloon as `asked`/`due`). The host must be asked for a landing square with the
   move, so the server has to know then whether a balloon is due; deciding it at the move would let a balloon that
   became ready during his think pop now (no square needed) but land only a turn later (no square asked): a sharp
   watcher could read which. One that becomes ready while he thinks is looked at at his next turn's end.
2. **The host is asked to land every due balloon, dud or not** (the request's `balloon`: the shape as shown, "q" for a
   fake queen, a seeded order, the hoops standing), and **a dud goes through the same steps as a real balloon until the
   last** (the review, Oct 24): a shape he can't have pops either way (`nine`); the square must pass `landCheck` either
   way (none, or refused, and both wait ready); only then does a dud pop and a real one land. Before, a dud popped with
   no square while a real one waited, so a "q" still on the nozzle after its due turn was known to be real (a host timeout,
   an older app, or a deliberately refused square as a probe). Side-by-side tests (unit, and a lobby test comparing every
   message to every device in a real queen's battle and a fake one's) hold it.
2a. **Duds come from a secret of their own** (the review's blocker, Oct 24): the host's asks carry orders drawn from the
   battle's seed, and a 32-bit seed can be brute-forced from one of them (the public shapes and colors pin it too). So
   whether a balloon pops, and whether a queen is the fake one, come only from `BalloonState.secret`, a second draw from
   the match's random source as his battle starts (`opening.setUp`, `Battle.random`), kept in the boss state and in no
   view, moment or ask; the shapes, colors and orders still come from the seed. A test: the same seed with another secret
   gives other duds and the same shapes; nothing a device gets carries the secret.
3. **A shape he can't have pops (`nine`, dud or not, so a pop at full material says nothing of a "q")**: a ninth pawn (the brief), and, the same rule the engine applies
   (`stockfishRefuses`), more pieces than promotions could make. Since every raid starts from the starting position,
   **every balloon pops until he has lost a pawn or a piece** (with all eight pawns and his full set, a third knight is
   as impossible as a ninth pawn). Waiting on the nozzle instead would only block the pump for the same result.
4. **Moment names:** `place`, `pop`, `wince`, `hoops` and `hoopsOut` as the brief says; the landing and the reactions are
   `balloonLand`, `balloonCheer` and `balloonBigCheer`, because `land` is Alfil's Slam landing and `cheer`/`bigCheer` are
   Puddles', and a kind has one length (POWER_FX) and one view (MOMENT_UI): theirs hold the turn, his don't. His art's
   animations keep their names (the kit maps them).
5. **Nothing of the balloons holds a clock** (`TIGER_FX` 0 for all of them and for `hoopsOut`): the brief's "the server
   waits for the hoops cast, not for balloons". The cast's moment is `HOOPS_BEATS.total`: the third throw at 860 ms, a
   300 ms flight (my number: the art's flight is a loop the wiring moves) and the ring's 330 ms landing, 1490 ms (his
   animation alone is 1360). `hoopsOut` comes as the crowd's second move lands, while he thinks (as Moo's Full Moon).
6. **The walls only ever take moves away.** A move is stopped when the squares it touches (start, every square passed
   over, landing; a pawn taken en passant) are some in a block and some out, for any block: into, out of, through
   (a slider passing over a block's squares), a knight jumping in or out (a knight jumping past, outside to outside, is
   free). "No attack across": a move that would leave **any** king attacked across a wall (`attackAcross`, chess.js's
   attackers, each attack's line through `crossesHoop`) isn't played. So a king never stands in an attack the walls
   stop, and every check on the board is one chess.js and Stockfish agree on (Stockfish can't be told about walls, and
   refuses a position with the side not to move in check). The cost against Eric's literal rule, in rare positions: a
   king can't step into an attack that crosses a wall, a piece pinned across a wall stays pinned, and a move that would
   "check" across a wall isn't allowed (by his rule it would be allowed and harmless).
7. **Where the walls plug in:** the same place as Big Boy's toy blocks and Ginger's freeze, the boss's `crowdFilter`
   (the crowd's allowed moves: the judge's searchmoves, the bots, the God King, the screens' dots and refusals) and
   `bossStops` (his `bossAllowed`: the request's `allowed`, his brain's searchmoves, `bossMoveFrom`'s last check, the
   runner's `applyBossMove` refusing any other), with `stopReason` "hoop" for the dock's words. The dispatcher's ground
   rule stays: a turn the walls would leave without a move lifts them for that turn (so a check whose only answers cross a
   wall is no mate, and no false stalemate). **His search** sees the walls at its root only (the moves searched); deeper,
   Stockfish plays ordinary chess: the walls stand for two crowd moves and one of his, and there's no way to give an engine
   walls. The same for every gain measured with walls (the cast's, a landing's): the crowd's root moves restricted.
8. **The cast's search** (`hoopsFrom`): block by block, each step weighing up to `hoopsLooks` (8) blocks in `hoopOrder`
   (the blocks whose walls, with those chosen, stop the most of the crowd's legal moves first, a block within ranks 3 to 6
   counting `HOOP_INNER` (3) moves more, ties seeded: a block nothing would cross changes nothing, and the sim's first runs,
   seeded among the inner blocks only, found casts that bit less), not touching those chosen, the whole
   set passing `hoopsGuard`; it keeps the one whose total gain is in the band nearest 1.5, else nearest the band. All
   three are thrown when they fit, so a step's choice keeps the total nearest the target. At most 8 x 3 searches at
   `hoopsNodes` (20,000) plus the one before: about 500,000 nodes, a few seconds on a slow phone, inside `hoopsTimeMs`
   (8 s; past it, the blocks so far, at least one) and the request's 15 s timeout; the guards themselves cost about 10 ms a
   block on a computer (measured), so up to a second or two more on a slow phone, breathing between blocks. The pass guard
   applies as to every power that spends his whole turn (`passLoses`: unless the switch's or the trigger's).
9. **The landing** (the review, Oct 24): **never a square the crowd attacks** is now a hard guard in `landCheck` (the
   server's check too; none left, and it waits, dud or not). `landFrom` weighs up to `balloonLooks` (8) seeded squares
   that pass it, each at `balloonNodes` (15,000), breathing per square, within `balloonTimeMs` (3 s; inside a cast, its own
   share of what's left of `hoopsTimeMs` + 3 s, so cast and landing stay well under the request's 15 s), and takes **the
   least valuable**: his gain nearest the low end of the shape's band, in the band if any is. **The bands are measured in
   the engine's own units** (`packages/sim/scripts/tiger-bands.ts`: 16 roughly even middlegames, up to 10 safe squares
   a shape, 151 to 160 placements each): a safe pawn gains 0.06 / 0.31 / 0.68 / 1.57 / 4.91 (10th, 25th, 50th, 75th, 90th
   percentiles), so its band stays [0.3, 1.5]; **any safe piece saturates the engine's win chances** (7.12 / 7.27 / 7.46 /
   7.67 / 8.04 for a knight, bishop, rook or queen alike), so a piece's band is [7, 8.5] and "a piece's worth" is
   whatever safe square helps him least. The brief's piece bands ([2, 4], [3.5, 6], [7, 10.5]) were out of reach below.
9a. **The walls' rule stays** (the director's call on the review, Oct 24): attacks across a wall still count for king
   safety; only moves and captures are removed. The FAQ says so plainly.
9b. **`hoopMateInOne`**: when the walls leave a side no move they lift for that turn, so every legal mate counts.
10. **The answers:** his move's landing is the bossMove message's `balloon` (a square); the cast's answer is one string,
    `hoopsCode`: the blocks by their corners in throw order and "@" and the landing square ("c3 f5 b6 @e4"). The server
    checks both (`hoopsCheck`, `landCheck`); junk, "" or PASS_WAIT: no cast (`hoopsWait`, he moves, again next turn); a
    refused or missing square: the balloon waits ready. Older apps ignore the new fields: no cast, and balloons wait.
11. **The test switches:** `?balloon=<shape>` forces every balloon (never a dud but the fake queen) and starts his battle
    from 1.e4 d5 2.exd5 Qxd5 (`BALLOON_TEST_MOVES`, as Smudgy's `?power=repaint`), so a balloon can land at once;
    `?stage=N` puts every balloon on N stages blown (4: ready at once). The parity test uses `stage=4` so both paths
    land the same balloons on the same turns.
12. **The balloon goes on only when the crowd's move lands**, so when the boss moves first (the crowd Black) his first
    turn has no balloon: the first goes on at the start of his second.
13. **Stage time 30 s, not 15** (the brief: "the sim tunes stage time and offset"): with 15 s the crowd scored 0.00 in 29
    battles (about four balloons landing a battle); see the sim. The offset can't weaken him further: at −250 he plays at
    Stockfish's floor (1350 against a 1600 tier) and slips at the cap already.

## The numbers and why

- **Offset −250** (the usual for a boss with powers): it can't go lower usefully, since at −250 against the 1600 tier he
  plays at Stockfish's floor (1350) and slips at the cap already.
- **`balloonStageSec` 30** (Eric's 15 s, the brief's default for the sim to tune): with 15 s the crowd scored 0.00, 0.06
  and 0.00 over three crowd speeds (29 battles); a sweep at `rageSpeed` 2 gave 0.40 (30 s), 0.30 (45 s) and 0.50 (60 s).
- **Pops 40 / 55 / 55 / 55, the fake queen always and the real one never (about half)**, and **the least valuable safe
  square**: the review's (Oct 24), after Eric's "It's a lot of balloons but most don't even make it and most are pawns or
  maybe a bishop knight". His edge had been landed material (the reviewer's 54 battles of the first shipped code, at 30 s
  and `rageSpeed` 1.4: the crowd 0.065 ± 0.03).
- **`rageSpeed` 1.6:** 3.5 casts a battle with a 10 s crowd, 3.0 with a slow one.
- **The bands** measured in the engine's units (call 9); **`balloonLooks` 8, `balloonNodes` 15,000, `balloonTimeMs` 3 s,
  `hoopsLooks` 8, `hoopsNodes` 20,000, `hoopsTimeMs` 8 s**: Puddles' sizes, so a phone's search stays a few seconds.

| Run (shipped) | Crowd's pick | Battles | Crowd score | Crowd moves | Casts a battle | Balloons placed / landed / popped |
| --- | --- | --- | --- | --- | --- | --- |
| tigerR10 | 10 s | 20 | **0.40** (± 0.11) | 49 (29-60) | 3.5 | 5.8 / 1.9 / 2.9 |
| tigerR20 | 20 s | 20 | 0.05 (± 0.05) | 45 (21-60) | 3.0 | 7.6 / 2.9 / 3.8 |

The 10 s crowd is at the top of the director's target (0.25 to 0.40); by the review's rule (45 s stages only if under 0.20)
no further run. **A slow crowd stays far weaker (0.05):** the pump is real time, so a crowd that uses its whole clock every
turn feeds him a third more balloons (Eric: playing slowly feeds him); flagged. Ninth-pawn pops: 8 of 115 balloons
(tigerR10). Landed pawns sit in or near their band; pieces at the saturated band's low end. A cast's gain is still almost
never in [0.5, 2.5] (mean −0.26, median 0.00: the lost tempo, and walls the engine sees only at the root), yet the walls
took the crowd's engine-best move on 70 to 74% of the walled turns; the FAQ no longer promises a gain for them. Before the
review: 0.14 at 30 s and `rageSpeed` 1.4 (14 battles). All of it: [reports/tiger-sim.md](../../reports/tiger-sim.md).

## What the wiring lane needs

- **The pump** (`BossUi.barProp`) from the view's `balloon`: `shape`, `color` (0-5), the stage from the battle's clock:
  `balloonStage({ at, readyAt }, now)` with `gardenNow()` (the page's visible time solo; the server's online through
  `setGardenSource`), so every device draws the same stage. The pump's `grow` step as a stage comes, held at stage 4 once
  ready (`ready` in the view: found ready at his turn's check). Stage 1 is the same for every shape; the shape is public
  from placement.
- **`place`** (at the start of his turn, while he thinks; `shape`, `color`): his hop to the pump (620 ms) and `place`
  (820, the pump's `put<Piece>` at its `touch` cue, 440). Never holds his move.
- **`balloonLand`** (as the crowd's turn begins; `square`, `shape`, `color`): the pump's `release` (330), the flight to the
  square, `land<Piece>` (790; his piece goes on at its `poof` cue: the board shows the position before it until then),
  then `balloonCheer` (720) or `balloonBigCheer` (1160). **`pop`** (`shape`, `color`): the pump's `pop<stage><Piece>`
  (400), then `wince` (780). None holds a clock.
- **`hoops`** (as the crowd's turn after the cast begins; `blocks` in throw order): his `hoops` (1360), a hoop leaving his
  paw at each `throwN` (300, 580, 860: `HOOPS_BEATS`), flying `flyMs` (300) to its block, the ring's `land` (330); the
  rings `burn` while the view's `hoops.left` is 2 and `dying` at 1; **`hoopsOut`** (while he thinks, as the crowd's second
  move lands): each ring's `out` (400). The dock's refusal words are in `refused.ts` ("A burning hoop is in the way.",
  "His only move: through the hoop.").
- `TIGER_UI` in `components/Tiger.tsx` holds the place (moments that show nothing yet); the visual e2e is that lane's.

## Player-visible text added

- `refused.ts`: `hoop: "A burning hoop is in the way."`, `THROUGH.hoop: "His only move: through the hoop."`.
- `power-words.ts`: `balloons: "blows up balloons that land as his pieces"`, `hoops: "Hoops"`.
- The FAQ's block for him (`BOSS_BLOCKS.tiger`), shown once he's playable.
- `TIGER_UI.ultimate.name`: "Hoops" (the warning's name).
