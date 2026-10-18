# Chub & Chirp's Carrot Patch in the rules: the cast, the race, the spin (Oct 18, 2026)

Chub & Chirp's ultimate (Eric's boss sheet, Oct 18: every rule approved in chat). This builds it in the rules, the
protocol, the simulator and the screens' placeholders; their art (the carrot board art, the ladder, the reel, sounds,
lines, the FAQ words, the select tile) is the wiring PR's. Until then they stay **hidden from players** (the test link:
`?boss=hopper&wip=1&power=carrotpatch`). How it works now: [docs/areas/bosses.md](../areas/bosses.md) (their row); the
tuning: [reports/hopper-carrots-sim.md](../../reports/hopper-carrots-sim.md).

## What Eric decided (the sheet)

- **Trigger:** "the usual rage meter, with the usual warning the turn before. It fires once, then the meter stays off.
  The cast is his whole turn, so you move first in the race."
- **The cast:** "5 carrots land on 5 empty squares, at least one on each half, none touching another."
- **Where they go:** "for each empty square, count exactly how many moves each side needs to get a piece there from the
  current position, with you moving first. Pick a set of 5 that fits a target." The sim tunes the target toward his
  count 2 or 3 about 70%, 0 or 1 about 15%, 4 about 12%, 5 about 3%; "placement first, the odds only after that".
- **The race:** a piece claims a carrot "by ending its move on it (a capture onto it counts). Any piece can: a pawn, the
  king, or his Leapfrog hop landing there. A claimed carrot stays claimed." It ends "when all 5 are pulled, or after 12
  moves each; unpulled carrots count for nobody". "5 carrots wins him the game the moment he pulls the fifth." "If the
  game ends first, there's no spin."
- **The spin:** his tier is his count; the odds table (tier 3 the softened one); the server rolls online, solo locally.
- **His prize pieces:** "Reuse Alfil's landing code." Pawns on his second row, then his third; other pieces on his back
  row, then his second, nearest the middle first; never a square that gives check; "if nothing fits on his half, the
  nearest empty square". If the engines refuse more than 8 pawns or 16 pieces a side, "the prize steps down to the next
  one that fits."
- **His race brain:** "Stockfish's top few safe moves are re-scored by the race: his distance to the open carrots and
  yours, so he also blocks or takes your runners." "The sim's crowd player uses the same layer." "Easier difficulties
  race worse, as they play worse."

## How it's built

- **The trigger** (`HOPPER` in `packages/chess/src/bosses/hopper.ts`): the meter's warning as a crowd turn begins; the
  cast at the start of his turn after it (`ultimateOnHisTurn`; the runner's `carrotDue`, the lobby's `requestCarrots`,
  solo's `carrotTurn`, as Alfil's Slam comes); the admins' trigger, at the start of his next turn without the warning.
  **Once a battle** (`BossRules.ultimateOnce`, new): from the cast on the meter is off (`rageOf` null: none shown,
  nothing gathers), the trigger refuses and the admins' button goes. #273's `noUltimate` is gone (nothing else used it).
  The cast comes before anything else of his that turn (no hop with it: it's his whole turn).
- **The cast** (`carrotBattle.apply`): no engine, so the server works it out itself and never asks the host. The turn
  passes as Alfil's V1 fusion: `passTurn` (the en passant square cleared, the move number on), a base on the board at its
  ply (no move added, so every replay plays from it and a repetition counts from it), the board's last move cleared, the
  crowd's turn set up as after his move, its moment (`carrots`) with that turn's.
- **The placement** (`plantCarrots` in `packages/chess/src/bosses/carrots.ts`): `reachMap` gives each side's fewest
  moves to every square, each piece moving alone with every other piece where it stands (a pawn straight on to an empty
  square, two from its first rank; diagonally only onto a piece; nothing passes through a piece; no king is ever taken).
  A square's **lead** is the crowd's fewest moves less his (the crowd moves first, so a tie is the crowd's). Each of the
  five carrots goes where the lead is nearest one of `carrotLeads` (the sim's target), nearer squares first, among
  squares a piece of either side reaches within `carrotReach` (4) moves, none touching one already placed; seeded among
  equals (`powerRoll(seed, "carrots", turn, square)`); if all five landed on one half, the carrot whose swap to the
  other half costs least is swapped. The same position and seed always give the same carrots: the server, the host and
  every replay agree.
- **The race:** after every crowd move, hop and move of his, a carrot still in the ground that a piece now stands on is
  pulled by that piece's side (so a castling rook and an en passant capture count; a piece passing over pulls nothing;
  the carrots are always empty squares, so "a capture onto it" can only be en passant). `carrotMoves` (12) each: the
  crowd's counted in `afterCrowdMove`, his in `afterBossMove`. Over: all pulled (`pulled`), both sides' 12 done
  (`moves`), or his fifth (`won`).
- **His fifth carrot** ends the battle at once: the runner's `stageComplete`, `finishBossBattle` gives "boss", and the
  results carry `carrots: true` (the results screen: "Chub & Chirp won with their fifth carrot."). It wins even when the
  same move draws on the board (a stalemate, the fifty-move rule, a repetition: the sheet's "he wins on the spot";
  `bossCarrotWin` reads only a mate as the board's own result). A mate is his either way and keeps the mate's line.
  Either way its moments, the pull and his win, play before the result, as after any fifth carrot: the runner's
  `preparePowers` lets them through once the board's game is over (delta review of #275, N-a). Given the choice, his
  brain takes a fifth carrot that doesn't stalemate, reach the fifty-move count or leave a dead draw (review of #275,
  S1). It looks at the position alone, so it can't see a repetition; the result is his either way.
- **The spin** (`carrotBattle.spin`): after his move, once the race is over (whoever pulled the last carrot), the battle
  still on: his tier is his count; the roll is `spinRoll` (`powerRoll(seed, "carrotSpin", crowd move)` over the sheet's
  table, `carrotOdds`): the battle's seed in the state, so the server rolls it online (one result for every screen),
  the device in solo, and a replay gets the same. The prize goes on his side (`prizeFits`, `placePrize`), a base at its
  ply; its moment (`carrotSpin`: tier, prize, squares) as the crowd's turn begins.
- **The prize's squares** (`placePrize`): Alfil's landing code, `putDown` (now shared: Alfil's `landing` calls it
  unchanged): the piece's squares in the sheet's order (pawns: his 2nd row then 3rd; other pieces: his back row then
  his 2nd; each row from the middle out, d before e), those allowed (empty, a pawn never on the first or last rank,
  never attacking the crowd's king), a square it isn't left hanging on first (the landing code's rule), each checked for
  a move left to the crowd; none of his rows: the nearest empty square allowed. The most valuable piece first.
  - **A prize bishop tries the color his bishops lack first** (both lists, his rows and then the nearest anywhere, keep
    their order within each color), then the other color; with no bishop or both colors, as any piece. The review
    measured the plain order putting it on his only bishop's color 48% of the time, always with a square of the other
    color free on his rows: a second bishop on one color is worth well under the 3 pawns the odds and `raceWorth` count
    it at. Alfil's landing keeps a bishop on its own color for the same reason (review S3). The landing code's own rule
    still comes first: a square where it isn't left hanging, of either color, before one where it is.
  - **The en passant square** (`editedFen`, Alfil's, shared): cleared when a piece stands on it **or on the square
    behind it** (where the double step started). Stockfish drops the square then and chess.js keeps it, so a prize pawn
    on d7 just after his d7-d5 left chess.js one move (the en passant capture) that the engine never saw: never in the
    judge's top moves, and a search for it scored a stray move too. Now both agree. This also covers Alfil's landing (a
    crowd piece landing behind his double step), where the review found the same latent case (review S2).
- **His race brain** (`raceGuard` in `packages/chess/src/runner.ts`, beside the landing guard; `bossMoveFrom`'s new
  `race`): on his ordinary moves in the race, his pick, his search's `carrotLooks` (4) best moves within the blunder
  guard, and the moves that pull a carrot (4 more), are each played and searched at `carrotNodes` (30,000: the landing
  guard's budget a position), then scored with the race. On the host's engine online (the boss request's `race`); the
  server never searches.
- **The crowd's judge weighs the race** (`HOPPER.judge`: `raceJudged`, `raceRanked`, the pulls scored and offered to the
  bots; the score jobs' and judges' jobs' `race`).

## My calls

- **What the race is worth (one model for his brain and the judge).** The sheet's "his distance to the open carrots
  minus the crowd's" taken as far as it goes: from each side's fewest moves to each carrot still in the ground
  (`reachMap`, within each side's moves left), `raceOutlook` plays the race forward with **one carrot at a time each**
  (a side works toward the carrot it would otherwise lose soonest among those it gets to first, else its nearest; the
  side to move first), and each carrot's taker holds it by its margin (how many plies later the other side would have
  got there, `carrotSharp` a ply through a logistic); his own count the less the later he'd pull them (`carrotHurry` a
  move: one in the ground isn't his yet). That gives the odds of his final count, and each count's prize is worth its
  average in pawns (the sheet's table: 0, 1.4, 2.6, 5.05, 18; his fifth, `carrotWinWorth`, 30 pawns: the battle). Taking
  a runner or blocking one changes the fewest moves, so it counts by itself.
  - **First tries, measured and dropped:** each carrot's chance on its own (a lead of a ply 77%) made two carrots one
    move from him both "certain" and every crowd score near zero during the race; with each count's prize put on top of
    the whole position, moves stopped being told apart (all near zero). And without the one-move discount neither side
    pulled a carrot it thought safe, so the race ended with half the carrots in the ground.
  - **Moves are compared, not totals:** a move's score is the engine's, less the pawns of the race's worth it gives up
    against the best move for the race among those weighed (`raceAdjust`: bouncePawnLogit log-odds a pawn). The race's
    best move keeps the engine's number, so nothing saturates and the scores stay readable.
- **His brain weighs the pulls too, not only his top four.** The sheet's "top few safe moves": the margin is what keeps
  them safe (the blunder guard against his best), but a short list of his top moves leaves out moves inside the margin,
  and a pull is the race's own move. So the moves that pull a carrot are searched and weighed too (four at most), and
  only kept within the guard. A switch must be **for the race**: its race worth at least `carrotMinGain` (0.25 pawn)
  above his pick's, so a tiny race gain can't let a stronger chess move in at an easy setting (the first version asked
  only for any gain at all, and the review built a switch on 0.015 pawn of race that was 9 points better at chess).
  Why 0.25: on the review's 29 switches by real Stockfish (113 looks at Elo 1350), the six with race gains under 0.25
  (0.01 to 0.24 pawn) were either a stronger chess move (two: 1.5 and 4.6 points better at chess for 0.07 and 0.24
  pawn) or a swap between moves the engine scored the same in a lost position; the next gain up was 0.32, a real race
  trade (2 points worse at chess). 0.25 sits in that gap; a quarter pawn is also about the race's own precision (a
  carrot's odds move by more than that with a single ply of margin). A move that pulls **his fifth carrot** is always
  played, as a mate would be (first one that doesn't stalemate, reach the fifty-move count or leave a dead draw, when he
  has the choice; a repetition he can't see).
  The budget: at most 9 × 30,000 nodes on a race move, about his move's own search again, 12 moves a battle.
- **He races as he plays.** Three ways his difficulty shows in the race: on a slip (a weak boss's stumble, up to 25% of
  his moves) the race brain is off; under the God King's strike it's off (a dazed move, the strike's own step back); and
  the race weighs in by his strength (`raceWeight`: 25% at Elo 1000 and below, all of it from 2000). Easy grabs a carrot
  when it costs nothing; Hardest fights for them.
- **The judge counts the race** (as it counts G-REX's fire). On the server it costs about 50 ms of the Durable Object's
  CPU a race turn (the review's measure: `raceJudged` plays each of the 37 scored moves and works out the race after
  it), 12 turns a battle: well within Workers Paid's limits, so it stays as it is. It grows with the distinct picks a
  crowd makes; worth a look if a big crowd's picks spread wide (review N4). Without it: the bots never race (in a Solo raid the
  human's pick is 1 of 50, so the crowd would never pull a carrot), and a player who pulls a contested carrot at a small
  cost on the board is scored as having made a mistake (and is the one the boss strikes down). The ground rule "the
  judge plays by the same rules" applies. The sheet's "the sim's crowd player uses the same layer" falls out of it: the
  sim's bots are the game's bots. The bots pick from the engine's top moves and the pulls (`judge.offer`, new: scored
  first, as his brain's), so they weigh the same moves he does. Online the score jobs carry `race`; the lobby's runner
  counts the race on the host's raw numbers, once, for everyone; two judges' jobs give the same bots' picks (tested).
- **The eval bar reads the engine's own evaluation during the race, carrots ignored** (the director's call, Oct 18),
  as it does around every other power online: the race's weighing values moves by what the carrots are worth, which
  isn't the position's value (it could read 0% for a side that is fine on the board). Online the bar always read the
  app's own search; solo's read `topMovesFor`, the judge's ranking, so during the race it now reads `engineTop`, the
  same search with no boss rule. The hints and the bots keep the judge's ranking. (The 100% the wiring screenshot
  showed right after the cast in the test switch's opening is the engine's own: his cast passes his turn, and after
  1.e4 e5 2.Nf3 Nc6 3.d4 the crowd moving again is 99.5% for White by Stockfish at 500,000 nodes.)
- **Fair play: a race turn counts only when the engine's best move is also the race's best move, and then it's
  recorded with the engine's own numbers.** The director's call after the delta review of #275 (S5, its option b). The
  rule held to: a legitimate carrot move must never count against a player.
  - **The rule** (the runner's `resolveBoard`, for any boss whose judge changes the numbers): a race turn counts when the
    engine's best keeps its own score under the race's judge. That happens exactly when it is the race's best too:
    `raceAdjust` never raises a score, and leaves one as it is only for the race's best. Every other race turn is left
    out (the turn's `power` flag, skip reason `bossPower`).
  - **A counted turn is recorded as any turn without the race:** the runner hands fair play the engine's own numbers
    (`fairScored`, which the lobby's `noteFair` reads instead of the round's). Fair play then reads exactly what it would
    from a carrot-blind engine: the same best, finds, near moves, only moves, decided positions, crowd finds, and the
    same losses for the match's strength. And no move is charged more there than the game charges it: the race leaves the
    engine's best as it is and never raises another move, so each move's loss by the engine's numbers is at most its
    loss in the round's score. A cheater copying a carrot-blind engine plays its best, the recorded best, as on any
    turn.
  - **Not the round's numbers on those turns** (my call within option b, which the review wrote with them): the race
    lowers the other moves, so its numbers can still read differently from the engine's. A move within a point of the
    best by the engine's numbers can be a miss by the race's, the near moves fewer, the gap past the only-move line, the
    crowd's finds fewer (which makes another player's find of the best look harder), and the match's strength lower. In
    the review's sample, 3 of the 34 such turns that weren't already decided had a move that was a find by the engine's
    numbers and a miss by the race's, and 5 a different count of near moves. A case from a re-run of its script is a
    test now (Nh7-f6, 0.9 points behind the best: a find, not a miss).
  - **Why every other race turn is left out:** there the race lowered the engine's best (whether or not it stays the
    best), and neither set of numbers is safe. The race's numbers create finds and remove only-move and decided skips:
    in the delta review's sample they changed fair play's reading toward suspicion on 25 of the 100 such turns that
    counted under the previous version (and on none of the other 34), among them a carrot pull 8.15 points worse at
    chess recorded as a find. The engine's
    numbers would charge the race's own move more than the game does (it keeps its score while the best loses some).
    Where the race made another move the best, that best is our own weighing of the carrots, which no engine of a
    player's own sees.
  - **The coverage it keeps:** in the delta review's real-Stockfish sample (64 battles, 646 race turns, 161 of them not
    already decided), 34 of the 161 count: about 1 in 5. The rest are lost to fair play: only race turns, only this
    boss, once a battle. Accepted: the rule above comes first, and this one is provably clean and the simplest to reason
    about.
  - **The earlier versions:** every race turn left out (too broad: on many race turns the race's best is the engine's
    own); then only the turns where the race made another move the best, the rest on the round's numbers (the delta
    review's S5: those numbers still changed fair play's reading on about 1 counted turn in 5). Weighed and turned down
    in the first round: every race turn on the engine's numbers, as on the turns the race lowered above.
  - The other readers of the record (checked in the first round) are fine: the deep re-check searches the recorded
    candidates on the engine server (carrot-blind, and on counted race turns the candidates are the engine's own top
    moves); the review page is for admins; and what players see of their moves (their score, their match rating,
    brilliant moves) comes from the round's own numbers, never from fair play's record.
  - The rule lives in the runner, for any boss whose judge changes the numbers: today only G-REX's fire, whose turns are
    power turns already, and the race. Nothing else changes.
  - **The turn right after his spin still doesn't count** (`powerTurn`, with the turn after a hop), as for every power
    that changes the board (#273's reason for the hop): his prize goes on the board just before it. (The first round
    gave a timing reason, the spin's moment against fair play's 5-s line for a fast hard find; the review found that
    line isn't applied to other bosses' moments of about that length, so the reason is the board change.)
- **The God King's strike** called on the crowd's turn just before the cast waits for his next move (the cast isn't a
  move, as with the hop; Alfil's fusion *was* his move, so it took the strike there). That move is staggered and his race
  brain is off for it: the crowd's strike is also a race tool.
- **The God King's Last Stand:** the move he takes back isn't played, so it pulls nothing and isn't one of the race's
  moves; the re-pick is. Its numbers are the judge's, the race counted, so a crowd move that hands him the race (his
  fourth carrot, or the fifth in reach) can be the disaster he steps in for.
- **Leapfrog and the race:** a hop counts toward his two as ever (the cast doesn't reset or lift the cap); a hop landing
  on a carrot pulls it for him (its `carrot` event just before the hop's, so the hop keeps its own screen). **A new
  refusal, `carrots`:** never a hop that pulls his fifth carrot, nor one that lets his move pull it when it couldn't
  before (two carrots in one turn, the crowd unable to answer): #273's principle, nothing decisive he gets that the crowd
  can't answer. A hop to his fourth, with his fifth out of reach, is an ordinary tactic, allowed.
- **QUEEN SLAIN!:** your move that takes his queen plays its banner in his thinking before the cast (held for it, as
  ever); the cast passes the turn, so his next thinking follows a new move of yours and the banner can't come back.
- **The halfmove clock:** the cast leaves the fifty-move count as it was. A pass isn't a move (no capture, no pawn
  move, but no ply played either), and keeping the count means the cast can never end the battle by itself (a count of
  99 made 100 would). The position changed, so the base at its ply restarts repetition.
- **"None may be a square a piece could be standing on when the cast resolves":** the carrots are planted on the
  position the cast leaves, at that moment, never ahead of it (a warning a turn earlier leaves time for pieces to move).
- **The spin always comes after his move.** The race can end on the crowd's move (it pulled the last carrot) or his;
  either way the spin plays as the crowd's turn after his move begins, with that turn's moments, the prize going on then.
  One place for it on every path (online, solo, a restored runner); the race being over, his move between can't change
  his tier. His move mating first: no spin (the battle ended first).
- **The engines' limits** (the brief's check, Oct 18): chess.js takes any count (9 or 10 pawns a side, 17 or 18 pieces,
  3 queens); Maia's worker reads positions with chess.js and its encoder takes any count (both checked); **Stockfish 19,
  the game's, refuses** more than 8 pawns a side or more pieces than promotions could have made (a queen beyond one, a
  rook, bishop or knight beyond two, each counting against a missing pawn), which also caps a side at 16: its process
  ends and no search comes back (checked on the Node build, `stockfish-19-lite-single`). Our FEN check
  (`stockfishRefuses`) already matches it exactly. So the prize is tried on the board and **steps down** when refused,
  through `carrotPrizes` (2 queens, queen and rook, queen, rook, bishop, knight, 2 pawns, a pawn; never up): with his
  whole army nothing fits (a blank); with one pawn gone, a queen fits where two don't. In the sim (below) it stepped down
  rarely: the cast comes once pieces have been traded.
- **Event names:** `carrots` (the cast), `carrot` (a pull, `by`), `carrotSpin`, `carrotWin`. The brief's "spin" is
  taken: Boingo's funhouse turns the board with a `spin` event.
- **When the pulls show:** the crowd's pull with its own turn's events (it plays as its move lands), his hop's with the
  hop, his move's as the crowd's turn after it begins (as Alfil's fusion and landing): `momentsOf` keys two pulls in one
  turn apart by `by`.
- **Placeholder screens** (`components/Hopper.tsx`): each moment holds its time and draws nothing; `HOPPER_BEATS` has
  the cues for the art lane (the cast's five tosses about 1.5 s then the ladder, a pull's pop and token, the reel's 3 s
  and the prize's drop, his win). The rage warning names it "Carrot Patch"; the dock's line for the cast's turn (his
  whole turn, no move to show): "Chub & Chirp spent their turn planting carrots."

## The tuning: placement only, the odds as the sheet has them

[reports/hopper-carrots-sim.md](../../reports/hopper-carrots-sim.md): the raid sim with everything the game does, #273's
seeds with the meter on, and forced casts from varied middlegames for the distribution (649 races in all).

- **`carrotLeads` = [3, 1, 0, 0, −2]** (moves: his lead on each carrot). Over 167 races his count is **0-1 18%, 2-3
  68%, 4 11%, 5 3%** against the target's 15, 70, 12 and 3, each within about a standard error. The first aims
  ([2, 1, 0, −1, −2]) gave 25, 65, 9, 1; four more were tried (the table in the report).
- **The crowd's score stays in the pack** with the meter on: 0.48 (± 0.09) in 44 crowd moves with these leads, 0.27
  (± 0.08) in 46 with the first (26 battles each; within two standard errors of each other and of Leapfrog's 0.31
  without it). The prize decides most battles where it's big: the crowd lost all 18 where his tier was 3 or more.
- **The odds aren't changed** (the brief: only if placement can't get there): placement got there.
- **His offset stays −250.**
- **At the top strengths, before he goes live** (after the review, S6): tier 1800 on Hard and Hardest (Elo 1800 and
  2050, the race weighing 0.8 and all of it), 150 forced casts and 26 battles with the meter on each, and the same 26
  battles with Leapfrog alone as the reference. Five carrots: 2% at both (7 of 329 races, ± 0.8; the line for a change
  was about 5%). His count 0-1 25% and 22%, 2-3 61% and 63%, 4 13% at both. The crowd: 0.19 (± 0.07) and 0.27 (±
  0.08), against 0.33 and 0.29 with Leapfrog alone: in the pack, within one and a half standard errors of the boss
  without his ultimate. **No change to the tuning.** The race brain's minimum gain (above) re-checked at his usual
  strength: 21, 68, 9 and 2% over 92 races, within the errors of the chosen leads' 18, 68, 11 and 3.

## The protocol (optional fields only; an older app or host ignores them)

- `NetBossPowers.carrots` (`CarrotView`): the crowd move the cast came after, the squares, who pulled each (null: in
  the ground), each side's count and moves left, `over` and why, his tier (his count), his spin (tier, rolled, prize
  after any step down, squares).
- Events `carrots` (squares), `carrot` (square, `by`), `carrotSpin` (tier, prize, squares), `carrotWin` (square).
  Apps since #267 pass over a kind they don't know; he can't be met online by an older app anyway (hidden).
- The boss request's `race` (his ordinary move in the race): the carrots in the ground, his count, the moves left, the
  race's weight at his strength. An older host plays his move without it: he races worse, nothing breaks.
- Score jobs, judges' jobs and the prefetch plan's `race`: the bots pick with it; an older device's report leaves the
  pulls unscored and its bots' picks differ, so two judges disagree and the lobby settles it as it does any
  disagreement.
- The results' `carrots`: the battle was his by his fifth carrot.

## What the wiring PR needs

The carrot board art (the soil mound, the pop, the token in the claimer's corner), the ladder over the cast's moment,
the reel (every card as often as its odds, no rigged near-misses), the dock's count with the pixel carrot, the sounds
(`thunk`, `pop`, the reel's ticks and stop), the lines (`carrotHis`, `carrotYours`, `spinBig`, `spinSmall`,
`spinEmpty`, `carrotsAll`), the FAQ's odds (from `BOSS_POWERS.carrotOdds`), on `HOPPER_BEATS`'s cues. The state
already has the prize on the board when his move's screen comes (a base at his move's ply), so until the art comes the
prize simply appears with his move (checked frame by frame on a phone: no piece moves twice or jumps); the spin's
moment should show the board without it until `prizeAt` (as Alfil's moments show the board before the fusion).
A fifth carrot that also mates now carries its `carrot` and `carrotWin` events (delta review, N-a); once his king attack
is in `KING_ATTACKERS`, `bossTurnShowMs` holds a mate for the attack alone, so the wiring decides how the two play.
