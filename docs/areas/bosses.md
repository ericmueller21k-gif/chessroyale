# Bosses and their powers

Lanes: `god-king` (the template, the powers' rules, server side and screens), `characters` (each boss's art,
moments, lines and sounds), `engine` (the boss's chess strength). The God King himself is on
[god-king.md](god-king.md).

## How it works today

- **A boss can be rested** (`PAUSE_BOSS_<ID>`, [ops.md](ops.md) "Kill switches"): the boss menu hides him, a raid
  lobby picked for him is refused, and every match's pick skips him (`rosterWithout` in `boss.ts`, a lobby's or solo
  game's `bossesOff`). The Crowd's boss final meets another while his boss rests, and its vote card names none.
- **Where bosses are met:** the boss raid (up to 50 people, online; or a Solo raid with 49 bots), the Crowd 50 v 50's
  boss final (the top 4, always against the Hidden Boss since Oct 14), and solo's "Boss alone" (one of the Boss raid
  screen's choices, or `/bosses`; [hub.md](hub.md); you pick every move
  against a boss you choose on the Boss raid screen's tiles, at a difficulty from Easy to Hardest, `BOSS_DIFFICULTY`). The Hidden Boss
  (below) is met by everyone in the Crowd's boss final, solo and online, and otherwise only by an admin, in Boss alone
  from the `/bosses` picker (his tile on the Boss raid screen is dark and locked for everyone).
- **The Boss raid screen's character select** (Eric, Oct 16; docs/decisions/2026-10-16-boss-character-select.md;
  `components/BossSelect.tsx`, `characters/boss-select.ts`): a tile per boss you can meet, the picked one on a stage in
  its idle (one sprite animating, on the shared loop; reduced motion: a still, no drop). Twelve tiles since Smudgy (Oct 19):
  two rows of six, on a phone and a computer (twelve in one row were under 44 px in a computer's column). A tap drops it on (the 1 v 1
  stage's drop), plays its sound once (`SELECT_SOUND`: Ginger `gingerCrackle`, her freeze; Boingo `clownSplat`, his
  pie; Jefferson `grexFizz`, his sparkler; Hollow `hollowCast`, his darkness; Big Boy `bigboyClack`, a toy block
  landing; Sawyer `sawyerRev`, his saw; Wrangler `pigWhirl`, his lasso; Alfil `alfilTrumpet`, his trumpet; Chub & Chirp
  `hopperChirp`, Chirp's chirp; Smudgy `smudgySplash`, paint landing; the Hidden Boss `recluseHum`, his stare) and
  says a line in its bubble (`SELECT_LINES`: its existing lines that read right outside a match, none twice running;
  new ones from each boss's lore wait for Eric). The Hidden Boss: a silhouette (his sprite drawn black, edged in
  violet), "???", never named, his ominous hum and Eric's two lines in turn ("Team up on me. It wouldn't be the first
  time anyone did that.", "You're not ready to fight me yet."), every way to play locked. Its own voice
  (`selectVoice`), the battle's speech rule.
- **The roster is a template** (`BOSS_ROSTER` in `packages/core/src/boss.ts`): each boss has an id, a name, an icon,
  a character kit (its art, moments, lines and sounds, by name), an Elo `offset` (nastier powers play a little weaker
  underneath) and its powers: a **passive** and an **ultimate**. Only a **playable** boss (`isPlayable`: a complete
  kit and powers) is ever chosen, in every mode. A random boss avoids the one met last (`chooseBoss`; online, the boss
  most of the lobby met last). A boss **hidden from players** (`adminOnly`: the Hidden Boss) isn't playable: it's never
  chosen at random, in a raid or by a lobby's creator, and no player's boss menu shows it; the boss menu lists it after
  the rest for an admin picking for Boss alone (`menuBosses`, `hiddenBosses`, `adminPlayable`), and only then does
  `chooseBoss` meet it (settings `bossHidden`, `chooseBoss`'s `hidden`). **The one exception, the Crowd's boss final**
  (Eric, Oct 14: "that mode is always just versus [him]"): the roster's `crowdFinal` boss (`crowdFinalBoss()`: the
  Hidden Boss) is the only boss it meets, for everyone, whatever was picked or met last (the runner's `startBoss`); with
  none marked it would be a random playable boss again. His name is one string in the roster (Eric will rename him): the
  vote's card, the FAQ and every screen take it from there. Details: [crowd.md](crowd.md), "The endings".
- **The strike** (`bossKillDue`, `strikeVictim`, `bossKill` in `match.ts`): every `bossKillEvery` crowd moves the boss
  knocks out the player with the most **counted** points lost since its last strike (the opening allowance taken off:
  a raid starts at move 6, so its first moves are covered; [crowd.md](crowd.md)), a tie going against the weaker
  player over the match (`matchLoss`), down to `minSurvivors` (half a raid). Still tied on both (everyone sound in the
  opening, say): nobody is struck, and the strike is due again after the next crowd move (`strikeIn` stays at "Strikes
  after this move"; never two at once). docs/decisions/2026-10-15-opening-allowance-and-ties.md.
- **Strength:** a rating on Stockfish's scale from the crowd's ratings (people only; Eric, Oct 12), the raid's tiers (a
  step above the people's ratings as the server stores them, never the app's word: [matchmaking.md](matchmaking.md)) or
  solo's difficulty, plus the boss's offset. Stockfish plays it at that UCI_Elo with the blunder guard (see
  [engine.md](engine.md)). **Boss alone** picks the boss's moves at its difficulty's Maia rating, whatever your
  rating: Easy 1000, Normal 1400, Hard 1800, Hardest 2200 (`BOSS_DIFFICULTY`'s `maia`, settings.bossAloneMaia,
  `bossBrainFor`'s `alone`; Eric, Oct 18: Hardest was way too easy; docs/decisions/2026-10-18-boss-alone-difficulty.md).
  Before a battle a boss has one number on screen: Boss alone's level at your difficulty, on the Boss raid screen's
  stage and in Boss alone's menu alike (`bossAloneElo` in `boss-difficulty.ts`; the raids show none:
  docs/decisions/2026-10-17-boss-sheet-fit.md).
- **The brain (Oct 12: every boss on Maia; DECISIONS.md, "Every boss on Maia"):** every boss plays its normal moves
  with **Maia-3** (a human-like model, a separate AGPL program in its own worker: `packages/maia-worker/`), no guard,
  at a Maia rating for its level (its strength, plus a crowd's margin), clearly favored in plain chess (Eric, Oct 12:
  "boss = a challenge"), then the bridge band (light guard, strict guard by the level; a growing share of Stockfish's
  moves by the strength), then Stockfish from 2800 (`BOSS_BRAIN`). Maia picks only among the moves its
  powers leave it. The King's strike, Boingo's funhouse move for the crowd, Hollow's extra move, Big Boy's bounce and
  Wrangler's long pull keep their own Stockfish picks (his drag and showdown aren't moves), and Wrangler's reply to the
  showdown's duel (and his next moves while its tactics are live) is Stockfish's best at full strength (below); Maia's
  own mistakes replace the slips. A boss with a **fixed brain** (`BOSS_BRAIN.fixed`: the Hidden Boss, Maia raw) plays it
  at Maia's top rating (2500), no guard, no Stockfish share, whatever its strength, the crowd, the difficulty or the Brain
  picker, and its strength is fixed at the level Maia reaches that (2650: `fixedLevel`). Players meet Maia too since
  Oct 14 (`BOSS_BRAIN.forPlayers`). A solo battle on Maia begins with a short loading step before its intro ("Loading
  the boss…": Maia loads alone, this device's Stockfish paused, 20 s at most; Oct 14). The Brain picker in Boss alone's
  menu and a debug line are admins' test tools. Details in [engine.md](engine.md), "The boss's brain".
- **Engine move** (admins only, Boss alone, Oct 14; `BOSS_POWERS.engineMoveButton`): a small "Engine move" button
  beside the ultimate's test trigger (a phone: under the dock; a computer: the title line) plays Stockfish's best move
  as yours (`SoloMatch.engineMove`: the power-up hints' search, `topMovesFor`, so only the moves the turn allows), through
  the normal move path. Gated by `engineMoveAllowed` in `boss-brain.ts`; online matches (`NetMatch`) have none. Tests:
  `packages/app/test/engine-move.test.ts`, `e2e/recluse.spec.ts`.
- **The ground rules of every power** (the server decides, the same everywhere):
  - Every power comes from the battle's seed (drawn once, as it starts) and the position, so the server, the solo game
    and every screen work out the same thing (`powerRoll`).
  - A power never leaves anyone without a legal move and never breaks check: a restriction that would leave no move
    (or no escape from check) lifts for that turn. The king is never frozen. The boss too (Eric, Oct 17: Sawyer's queen
    crossed his own board saw, his only way out of a knight's check): the move is marked (`lastMove.through`, a
    `StopReason`, from `applyBossMove`) and your turn's dock says so in place of "Your move." ("His only move: across
    the saw."), until the God King's strike lands that turn: then "Your move. Boss staggered." (no room for both).
  - **A move a power refuses says why** (Oct 17; docs/decisions/2026-10-17-power-limits-said-on-screen.md): a move
    legal in chess that the turn doesn't allow (across the saw, onto a pie, through a toy block, a frozen piece, the
    move the God King took back) stays put, as before, and the dock says why in place of "Your move." for 3 s
    (`REFUSED_MS`) or until the position changes (each is the dock's whole line, whole in its two lines at 320 px,
    where its box is 112 px: measured in `e2e/sawyer.spec.ts`): the board's `onRefused`, the words in `packages/app/src/refused.ts`
    (`REFUSED`, `THROUGH`), which power by `BossRules.stopReason` (`stopReason` in `boss-powers.ts`: Sawyer, Boingo,
    Big Boy; it reads only fields the screens' view has too).
  - **Whichever brain picks it, the boss's move is one his powers allow:** every path picks from the allowed moves,
    `bossMoveFrom` checks its own pick (else his best allowed move, logged; the first allowed if that search fails
    too) and `applyBossMove` checks what's played (else the first allowed, logged). Every power × brain path: `packages/chess/test/boss-power-legal.test.ts`.
  - Looking back through the moves (the history view) draws no power's marks but Hollow's dark: a past move shows
    without the saw, the pies or the ice it was played under (Oct 17: a gap, listed in the decision above).
  - The judge plays by the same rules: the best move is the best of the allowed ones.
  - **A power's follow-up move that the engine scored is played by the engine** (Eric, Oct 13: the crowd won
    Wrangler's queen in his showdown when his brain, Maia at 600, took another piece instead of taking back). When a
    power's search scores an outcome on the boss's best reply, that reply is the engine's best at full strength, never
    the brain's, a slip or a stumble: `BossRules.bestReply` gives the runner's `bossMoveKind` "best" (`bestReplyFrom`),
    the server sends it as `bossRequest.best` (no brain), and solo plays it the same way. The King's strike still
    staggers it. Today: Wrangler's reply to a duel and his next moves while its tactics are live (`engineMoveDue`).
  - Every crowd turn is the crowd's own pick, scored as usual, except the one Boingo's funhouse plays for it as it comes
    (Eric, Oct 12: unscored, once a funhouse); any turn a power touches doesn't count for fair play (`powerTurn`).
  - The clock stands still through every power's moment (`POWER_FX`, `powerMomentMs`): the crowd's clock starts after
    them, solo and online, so a power never costs anyone thinking time.
  - **A turned board** (Boingo's funhouse, Oct 11): upside down is the other side's orientation, as before; a quarter
    turn is drawn by moving every square to where the turned board shows it (`packages/app/src/board-view.ts`:
    `viewSquare`, `viewFen`), so the board maps taps and drags exactly as usual and each move is turned back
    (`Board`'s `turn`: [board.md](board.md)). A CSS rotation would have put taps on the wrong squares. The coordinates name the real squares
    (the bottom edge runs along the ranks), and everything drawn over the board places its squares with the same turn
    (`squareXY`'s `turn`, `onSquare`, the `BoardTurn` context Board gives what it draws). Each step spins the board in
    its own plane (`pw-turning-cw`/`ccw`, the half turn's `pw-flipping`), pieces going round with it for a moment as
    the flip always did, then draws it at its new angle, untransformed. A board made for a turned view is made turned
    (else every piece flies across it).
  - Turns are the crowd's: turn N is the crowd's Nth move of the battle.
- **The rage meter** (Eric, Oct 11: several ultimates a battle, like a game's rage meter; every boss but Wrangler and the
  Hidden Boss, whose meters are their own: their rows below) fills over time
  (`ragePerMove` a crowd move, up to `rageAheadMax` more while the crowd is ahead on the judged eval), with the boss's
  own material lost (`ragePerMaterial`: a queen's worth is half the meter) and with each of the God King's strikes on
  the boss (`rageStrike`: a quarter of it), every gain times the boss's `rageSpeed`. Full: a "RAGE!" warning, then the
  ultimate as the next crowd turn begins. Hollow's Lights out, Big Boy's Big Bounce and Alfil's Mammoth Slam come at the
  start of the boss's turn instead (Lights out's only warning is the full meter). The meter is full on the ultimate's own turn, then
  empties; while the ultimate's effect still runs (its rules' `ultimateRunning`: the blizzard its three turns, the Big
  Bounce its own turn, the funhouse until the board is back, the Roman candle until its last fire is out, Lights out through
  the turn after it, the board saw while the halves are apart, the Mammoth Slam while its pieces are up) it stays empty, dimmed and dashed on screen
  (`paused`), nothing gathers (strikes included) and no other ultimate can come, the test trigger neither. Once it's
  over, `warnAt` and `ultAt` clear and the meter fills again from empty for the next (`ults` counts them). The test
  switch (`?power=`) brings only the first; the test trigger works again once each one is over. Each repeat is fresh:
  its own turn's seed (Ginger's free piece and thaw, Big Boy's candidates, Jefferson's waves), and a later Lights out a seed of
  its own (other pieces named, other bot finds). **Rates set by estimate; not yet tested with the bot sim. Run the sim
  at a future date** (`boss-sim.ts raid`, below): the aim is about two ultimates in a typical battle of about 40 crowd
  moves (Jefferson about one and a half: his barrage lasts about a third of a battle).
  Boingo's meter is the fastest (`rageSpeed` 1.8): his funhouse holds it for 12 turns.
- **The bosses:**

| Boss (id) | Opening | Passive | Ultimate |
| --- | --- | --- | --- |
| Ginger (`gingerbread`) | the game so far | **Freeze:** a crowd piece (never the king, one that matters: a pick from the top three) iced for `freezeTurns`, every `freezeEvery` turns from turn 2 | **Blizzard** (three turns, thawing; Eric, Oct 12: `blizzardTurns`, `blizzardFree`; DECISIONS.md, "Ginger's Blizzard: three turns, thawing"): turn 1, only one crowd piece moves, at random from the seed among those with a legal move (Eric, Oct 11; it was the queen): never the king nor the frozen piece unless nothing else can move (`chooseBlizzard`); its banner names it ("Only your knight on c3 moves"). Turn 2, 4 or 5 free in all (from the seed): the first stays free, the pieces named on turn 1 thaw (at random, those with a move first, never the king), more if one was lost to the boss, and one that can move if none can (in check: one that answers it); its moment ("THAWING!") names them. Turn 3, the ice is gone ("THAWED!"), the meter still empty. The pieces due to thaw next turn show cracked, thin, dripping ice; the ice stays on through the boss's turn; the freeze waits until it's over (`blizzardStep`) |
| Boingo the Clown (`clown`) | the game so far | **Pie:** an empty square near the center that the fewest moves reach is pied for `pieTurns` (nobody, either side, may move onto it); a new one every `pieEvery` turns, up to `pieMax` (2) at once, never two on one square (Eric, Oct 11) | **Funhouse** (Eric, Oct 11): he turns the board round, `funhouseStepTurns` (4) crowd turns a step: upside down as it comes, then a quarter turn to a side from the seed (90° or 270°), then a half turn to the other side, then back where it started, where it stays (`funhouseAngle`, `boardAngle`; a `spin` moment each step). As it comes he plays the crowd's move for it (Eric, Oct 12: "the forced move is the joke"): a weak but recoverable one (`funhouseMoveFrom`: `funhouseLoss` 1 to 2.5 pawns, never past `funhouseMaxLogit` in log-odds, never a mate allowed or the queen left hanging), unscored, once a funhouse, on a screen of its own with his joke (`FUNHOUSE_LINES`, from the seed); online the host's engine picks it (the boss request's `funhouse`) and everyone gets the same move. Then the crowd plays its own, scored as usual (turned turns don't count for fair play). His meter fills again once the board is back |
| Jefferson (`grex`; G-REX until Oct 10) | the game so far | **Sparkler:** a tile on the crowd's half catches fire and burns in `fireStages` stages, one a crowd turn; a crowd piece left on it after the crowd's move on the last stage burns (never the king, never one whose loss leaves a king in check: it fizzles) | **Roman candle:** `candleShots` fireballs in waves (`candleWaves`) from `candleDelay` turns later, each wave's squares shown as growing shadows `candleAhead` turns ahead; `candleOwnShare` (0.4) of each wave, rounded, falls on his own half (Eric, Oct 11: too strong; 10 of the 24 there, 14 on the crowd's), where his pieces never burn (a crowd piece there still would). The first time one of his pieces stands in the candle's fire (`fireproof`, once a match) he laughs it off: a `fireproof` moment, his smug look and one of four lines picked from the seed (`FIREPROOF_LINES`; he has no laugh sound of his own, so none) |
| Hollow (`hollow`) | always Black, from the starting position (he claims the dark side in the intro if the crowd would have been Black) | **The dark:** after his first move he covers the square of the piece he moved, then another every `darkEvery`-th move (a random occupied square, never a king's) for `darkTurns`; pieces there are hidden; a move touching the dark goes unchecked, an illegal one costs `darkTryCost` and the `darkTries`-th ends the turn as a miss | **Lights out:** at the start of his turn, a memory test in rounds (`lightsOutRounds`: find 1, 2, then 3 of his pieces); each piece missed costs `lightsOutMiss`; below `lightsOutHold` found, he plays an extra quiet move (`lightsOutExtraGain`) |
| Big Boy (`bigboy`) | from the starting position less the crowd's d- or e-pawn, which he eats (his snack) | **Toy blocks:** every `blockEvery` turns from turn 2, a block on an empty square in the crowd's half that a crowd piece could move to, for `blockTurns`; nothing (either side) may move onto it or slide through it; a knight jumps it; it never stops an attack | **Big Bounce:** at the start of his turn (after the warning), `bouncePieces` crowd pieces thrown to empty squares within `bounceReach` (pawns sideways), into a position `bounceLoss` pawns worse for the crowd (nearest `bounceTarget`) |
| Wrangler (`pig`; the code id stays `pig`: "wrangler" is Cloudflare's CLI here) | from the starting position, Black as every raid boss (`?side=b` turns it round); his first move is the **long pull** (`pullOptions`, `pullFrom`): a center pawn's double step, then lassoed one square further, three squares in one move (e2-e5 or d2-d5 as White; d7-d4 or e7-e4 as Black after the crowd's first move), the engine's pick of the d- or e-pawn; none sound (it would hang the pawn: a crowd pawn on it, more attackers than defenders, or more than `pullMaxLoss` pawns against his best ordinary move; its path or square taken): an ordinary first move. The board's history keeps the legal double step and a base with the pawn one square on; the screens name it as the pull (`d4`) | **Lasso drag** (`dragOptions`, `dragFrom`): after his move, from turn `dragFirst`, every `dragEvery` turns, a crowd piece (never the king, never a bishop: it would change color) dragged one square up, down, left or right onto an empty square (a pawn never onto the first or last rank; never leaving the crowd in check or without a move, nor his king attacked), the one costing the crowd nearest the middle of `dragLoss` (0.1 to 0.9 pawns, log-odds as Big Boy's bounce), seeded among ties; none in the band (or a game already decided): none, and he tries again after his next move. A base on the board; `?power=drag`: from turn 2, every 2 | **SHOWDOWN!** (an engine-shaped power, below; Eric, Oct 13: "he checks every turn after three or four moves, and the moment it's ready he fires it with no warning"): **his own meter**, not the rage meter (`BossRules.meter`, `showdownMeter`): his moves fill it, `showdownMeterTurns` (5) from empty, nothing else (no strike rage, no eval speed-up); full, he says "I've got you in my sights." once (a beat of his, `ready`) and swings both ropes (his `ready` loop) until he fires. From then on, on the first of his turns where a line-up qualifies after his move, he fires, no other warning, no "Not yet...": three pairs, a rook, a bishop and a knight of each side (never queens; a pair that can't be formed is replaced by a second rook pair, then a second knight pair), or two (the rook and a minor) when no three-pair line-up qualifies, facing each other anywhere on ranks 2-7 (0 or 1 empty squares between, knights a jump apart, bishops on their color), his pieces protected (`checkLineup`, `pairKinds`); the crowd's next move must be one of the duels (its piece taking his; none legal: a normal move). The best duel gains him `showdownEdge` pawns over the position before (nearest `showdownTarget`), a wrong one costs the crowd `showdownTrap` more. Nothing qualifies: he plays on (drags carry on) and tries again next turn. His reply to the duel, and his next moves while a line-up piece is still attacked, up to `showdownEngineMoves`, are the engine's best at full strength (`engineMoveDue`; never his brain's). Then the meter empties and fills again; at most `showdownMax` a battle (then no meter). The admins' trigger: the meter full at once, fired at his next turn, the best line-up even outside the band (`outside`, on their debug line) if none inside is found in `showdownTestMs`; no pairs to line up: a drag stands in. On screen he drops into the middle winding up both loops, leaps to his corner and his ropes yank each pair in; "DRAW!"; the duels glow and the dock says "Take one of his three duels." (the God King quiet about threats he can't heed, his own word at "DRAW!") |
| Hidden Boss (`recluse`; an admin's Boss alone, and the Crowd's boss final for everyone, solo and online: his phase 1, Oct 14) | from the starting position, never a book opening (`opening.fromStart`: he has no memorized lines; Eric, Oct 14), sides as usual (`?side=b`: he's White and moves first); his brain fixed: Maia-3 at its top rating, raw, at a fixed 2650 | **No help** (`nohelp`, `blocksKing`): the God King's move, strike and Last Stand never come; the dock's "Play move" and "Strike" have him slam the book shut and mock it (`mockKingHelp`: his lines in turn, the God King's blocked line), and each try spends its charge as if it had worked (Eric, Oct 14: `kingTried`, solo's `callKing`; one a try, the dock's count drops, none left and the God King can't be called; your move goes on). The Last Stand, which nobody calls, spends nothing. **No strikes** (`noStrikes`, Oct 14): he never knocks out the crowd's worst mover, so his card counts the moves left ("12 moves left"; the title says which move it is, Oct 15) and his intro says nothing about strikes: his real fight is a squad of four who must all reach phase 2 | **Bullet** (Eric, Oct 14): **his own meter** (`bulletMeter`), empty at turn 1, full at `bulletTurn` (7), when it comes with no warning: where he stands, the book consulted, opened like a spell book, slammed shut (`playInPlace`), his line, "BULLET!" "No added time."; from then to the end every bank is `bulletBankSeconds` (60 s; Eric, Oct 14: was 180), no per-move cap (`bulletClock`; the dock says "Bullet", the bank is your clock at the box's right), and a bank that runs out loses on time (`bossOutOfTime`: the move isn't played; "won on time"). **Then he adds time per move** (Eric, Oct 14): the first `bulletPlainMoves` (3) moves add nothing (1+0); as the next turn begins, his moment (`bulletPlus`, `RECLUSE_FX.bulletPlus` 2.8 s, the clock after it): he consults the book with a grudging line (`RECLUSE_LINES.bulletPlus`), and "+2 s a move from now on" lies across the board's middle (`.rc-plus`, not a banner); from then on each move made in time adds `bulletIncrementSeconds` (2 s) to that player's bank (`bulletIncrement`: the runner's round settings give the bullet clock that increment, and a cap no bank can reach), and the dock says "Bullet 1+2"; a move starts with the 2 s added, so as each begins your clock goes up by 2, a "+2" over it (Eric, Oct 15). The trigger at the next turn, `?power=bullet` on turn 2. Beaten: the board holds `fallMs` (4.5 s) while he collapses and mumbles (online too: the lobby's boss message with `fall`, then the results); where his **phase change** and **phase 2** follow (below: Boss alone, a solo Crowd's final), only `PHASE_CHANGE.fallMs` (1.8 s). **Online** (the Crowd's boss final) every piece runs in the shared runner as solo's: his brain on the host's device (`bossBrain` maia-raw at 2500, his moves asked at 2650, Stockfish's meanwhile or as the fallback), the God King's tries (`NetMatch.callKing` sends them, the lobby spends a charge: never a turn or a strike), the bullet clock and its increment (each person's deadline from `allowedMsFor`), a loss on time (the results' `timeout`), no strikes, his lines and moments from the shared boss view; only the mock plays on the device that tried. All through it he mutters about the team against him, about every 15 s (his chatter, below; Oct 15). Not yet sim-tested |
| Sawyer (`sawyer`) | the game so far; his first move is a pawn's, then the **split pawn**: that pawn sawn in two, a second pawn of his on an empty square beside it (a seeded side; never where it attacks a crowd piece or gives check), both tracked. On screen (`SAWYER_LOOKS`, Oct 11) the sawn pawn morphs into two smaller whole pawns that hop to their squares and grow back to a pawn's size as they land (my call: they're ordinary pawns); `split: "halves"` brings back the old look (cut in two halves, drawn as halves wherever they go), `settle: "small"` keeps them small. If that pawn has no such square, another of his that has one (the most central, from the seed: `chooseSplit`); none, or a first move that wasn't a pawn's (a check left him none): it waits for his next pawn move. With no room for another pawn of his (8 already, 32 pieces, or as many promoted pieces as his missing pawns: the engine's limits) it waits for his first pawn move once there is | **Saw cuts:** every `sawEvery` turns from `sawFirst` (turn 3), an edge between two squares of the crowd's half that one of its legal moves crosses (none, as when his move left a check answered only diagonally, by a knight or outside that half: it waits a turn), for `sawTurns`: no straight move across it (a slide, a pawn's step, the king's, castling's way), either side; knights and diagonal moves pass; taped over as it heals | **Board saw:** the meter full, turn `boardSawFrom` or later, and a half of the board (a-d or e-h) his on material: the warning, then for `boardSawTurns` no move crosses between the d and e files (knights included), either side; then the halves rejoin |
| Alfil (`alfil`; Oct 17, live: his kit `Alfil`, so playable like every boss, on the tiles, in raids, at random and on home's card; tuned (V1: the fusion is his move; the crowd scores 0.23 in the sim, inside the pack; after the review round 0.17, and 0.15 with the landing guard, 0.00 with the pass guard (Oct 18: a fusion that would cost him real material waits a turn) and 0.12 with a fusion every 8 of his turns): `reports/alfil-sim.md`; on screen: docs/decisions/2026-10-17-alfil-wired.md) | the game so far | **Tusks:** at the start of his turn, before his move, from his `tusksFirst`-th (3rd) turn, every `tusksEvery` of his turns (his moves and his fusions: `hisTurn`), he marks two of his pawns anywhere (`tusksPairs`: `tusksLooks` (5) pairs whose fusion would be allowed, those giving up a passed pawn or his king's shield last, seeded; the engine picks the one whose fusion now is best for him, `fuseFrom`; no engine, the first); the crowd taking either on its turn stops it (it fails at once: `fusion.why` "taken"); his next turn, the fusion is **his move** (V1, docs/decisions/2026-10-17-alfil-rules.md): both lift off, an **elephant** (a bishop in every way, its square tracked as it moves: `elephants`, for its own art) lands on one of their two squares, the engine's pick, unbounded as the sheet has it (`fuseFrom`: the one best for him, each way scored with the crowd to move; no engine, the first allowed), and the crowd's turn begins (a base, no last move shown; `Battle.bossPassed` sets the turn up as after his move, the fusion's moment first among its moments): no other move of his that turn, and a fusion that's due can't be skipped; never a square that leaves his king attacked, gives check, leaves more of the crowd's material hanging, leaves the crowd without a move or makes a dead draw (`fusedFen`; neither allowed: it fails, "nowhere", with no moment, and he moves); in check as his turn begins, it waits for his next turn, the marks staying, and he answers the check with a move. It waits the same way when spending his turn on it would cost him `passGuardPawns` or more (the pass guard, also on the Carrot Patch's cast: docs/decisions/2026-10-18-turn-passing-guard.md). The God King's strike just before a fusion hits it: the elephant lands on the worse of the two squares for him (the one the engine didn't pick), and the strike is spent. At most `tusksMax` (2) a battle. `?power=tusks`: from his first turn, every other | **Mammoth Slam:** his rage meter full, its warning as a crowd turn begins, then at the start of his turn (after the crowd's move, as Big Boy's bounce; before a fusion due that turn): two of the crowd's pawns and one of its knights or bishops fly up (`slamCandidates`; never a queen, rook or king; fewer if it has fewer; never a piece whose lift leaves the crowd's king in check or adds a check on his: one he's already in doesn't stop it) for `slamTurns` (3) crowd turns, then land as the next begins, on their own squares (`landing`; taken: the nearest empty square allowed, a bishop on its color, a pawn never on the first or last rank, never giving check, never left hanging when another square avoids it, never leaving the side to move without a move). The swing cap (`slamFrom`): the engine plays the turns they're up out (its best for both sides), puts them down and scores it; the crowd's loss nearest `slamTarget` inside `slamLoss`, never past the cap or a mate. A Slam that lifts nothing (no lift, none within the cap, no engine's answer) keeps the meter, shows nothing and comes again at the start of his next turn (`slamWait`). They come down early, at the start of his turn, when he has a mate in one only because they're up. **He sees them coming** (the landing guard, Oct 17: docs/decisions/2026-10-17-alfil-sees-the-landing.md; how, on [engine.md](engine.md)): on his move just before they land, and his fusion then, his moves still come from the board as it is but are judged with them down (`landsAfterHisMove`, `slamAhead`), so he no longer walks into the squares they take; the judge still scores the crowd's moves on the board as it is. Their squares, turns left and shadow sizes are in the view (`airborne`) for the growing shadows reused from the Roman candle. **On screen** (`components/Alfil.tsx`, timed by `ALFIL_BEATS` from his animations' cues): the cast is "TUSKS!" ("<a> and <b> fuse next turn") and his trunk levelling the ankus, the two pawns glowing gold from its `cast` beat until the fusion or the counter; the fusion (no banner; the dock: "Alfil spent his move on the fusion.", `BossUi.noMove` for the rest of his turn) lifts them to the board's center at `rise`, a ball of white light at `flash`, and the elephant drops onto its square; elephants are drawn with their own piece art wherever the live board draws pieces (`BoardProps.elephants`). The Slam is "MAMMOTH SLAM!" ("N of your pieces fly up for 3 turns"), the board shaking at `slam`, the pieces flying up off their squares at `fly`, Jefferson's `fireShadow` (reused as is, `fireShadowItem`) on each square from `shadows`, a size a turn; the landing drops each out of the sky onto its own square with a soft thump (and slides it on when its own was taken; the dock: "Your pieces are back."), during his thinking when they come down early (`earlyLanding`) |
| Chub & Chirp (`hopper`; Oct 18: Chub the rabbit riding Chirp the grasshopper, the name in one constant, `HOPPER_NAME`; **live** with their art since Oct 18 (docs/decisions/2026-10-18-hopper-wired.md); tuned: the crowd scores 0.31 in the sim, inside the pack, `reports/hopper-sim.md`; docs/decisions/2026-10-18-hopper-leapfrog.md) | the game so far | **Leapfrog** (`hopper.ts`): at the start of his turn, before his move (as Big Boy's bounce: the runner's `hopDue`, the lobby's `requestHop`, solo's `hopTurn`), when one of his pawns stands nose to nose with one of the crowd's (the crowd's pawn on the square in front of his) and the square beyond is empty, his pawn hops over it to that square, automatically; then he plays his move (variant A: the sim turned down the hop as his move, 0.77 for the crowd). No instant queen (Eric; his move comes straight after the hop): never onto the crowd's last two ranks (`lastRank`, `nextToLast`), never one that frees a pinned pawn of his to promote (`promote`). Never a pinned pawn, none while he's in check (it waits), never one that gives check, leaves him without a move or gives him a mate in one he didn't have (`hopOptions`, each refusal with its reason). The principle: nothing decisive the crowd can't answer (a mate in one, a promotion); ordinary tactics are allowed; the en passant square cleared, the fifty-move count from zero, castling and the move number as they were; a base at its ply (no move added). Several can: the engine's pick, the one best for him (`hopFrom`, each searched at `hopNodes`, him to move; online the host's, the boss request's `hop`; no answer: the first). At most `hopMax` (2) a battle, one a turn. The crowd's turn after a hop doesn't count for fair play. The view's `hop` (`at`, `from`, `over`, `to`); event `hop` with his turn's. On screen (`components/Hopper.tsx`): a moment of its own before his move, `HOPPER_BEATS.hop` (1.6 s, on his `leapfrog` animation's cues): "LEAPFROG!", then his pawn stays on its square until the `takeoff` (720 ms), arcs over yours and lands beyond it on the `land` (1050 ms; `hopperFen`: the board doesn't animate it); the hop's screen is treated as Big Boy's bounce (his last move isn't news). `?power=leapfrog`: the battle starts from 1.e4 e5 (2.Nf3 with `?side=b`), so a hop comes on his first turn | **Carrot Patch** (`carrots.ts`, `hopper.ts`'s `carrotBattle`; Eric's sheet, Oct 18; docs/decisions/2026-10-18-carrot-patch.md; tuned: `carrotLeads` [3, 1, 0, 0, −2] gives his count 0-1 18%, 2-3 68%, 4 11%, 5 3%, and the crowd 0.48 with the meter on; at Hard and Hardest five carrots stay at 2% and the crowd scores as Leapfrog alone does there, reports/hopper-carrots-sim.md), **once a battle**: the usual meter and warning; at the start of his turn the cast is his whole turn (the runner's `carrotDue`/`applyCarrots`, the lobby's `requestCarrots`, solo's `carrotTurn`; no engine: the turn passes as Alfil's fusion, `passTurn`, a base at its ply, the fifty-move count kept). Five carrots on empty squares, at least one on each half, none touching (`plantCarrots`: each side's fewest moves to each square as the board stands, `reachMap`; each carrot where his lead is nearest one of `carrotLeads`, seeded among equals). A piece pulls one by ending its move on it (a capture, a castling rook, his hop landing); `carrotMoves` (12) moves each; his 5th wins the battle at once (`carrotWin`, the results' `carrots`), even when the same move draws on the board (a mate keeps its own line), its pull and win moments first either way (at a mate, then his attack on your king: `mateMoments`); else, the race over, after his move, his spin on his tier (`spinRoll`, the battle's seed: the server's online; `carrotOdds`, the sheet's), the prize on his side (`placePrize`, Alfil's landing code: pawns on his 2nd row then 3rd, pieces on his back row then 2nd, middle first, never giving check; a bishop on the color his bishops lack first; `editedFen` clears the en passant square when a piece stands on it or behind it, as Stockfish does), stepped down when the engines can't take it (`prizeFits`: Stockfish 19 refuses more than 8 pawns a side or more pieces than promotions could make). The battle ending first: no spin. The meter is off from the cast on (`ultimateOnce`). **His race brain** (the runner's `raceGuard`, the host's engine: the boss request's `race`): his pick, his top moves within the blunder guard and the moves that pull a carrot, searched at `carrotNodes` and weighed by what the race is worth (`raceWorth`: one carrot at a time each, `raceOutlook`; each tier's prize at its average), by his strength (`raceWeight`); a switch only for at least `carrotMinGain` (0.25 pawn) of race; off on a slip and under the King's strike; his last carrot always (given the choice, one that doesn't stalemate, reach the fifty-move count or leave a dead draw; he can't see a repetition). **The judge weighs the race** (`judge` hooks: `raceJudged`, `raceRanked`, the pulls scored and offered to the bots; the score jobs' `race`). A race turn counts for fair play only when the engine's best move is also the race's best, and then with the engine's own numbers (the runner's `resolveBoard` and `fairScored`, for any boss's judge); the turn right after his spin doesn't count, as for every power that changes the board. The eval bar reads the engine's own evaluation during the race, carrots ignored (solo's `engineTop`; online it always does). The view's `carrots` (`CarrotView`); events `carrots`, `carrot` (`by`), `carrotSpin` (`tier`, `prize`, `squares`), `carrotWin`. On screen (`components/Hopper.tsx`, on `HOPPER_BEATS`, each a cue of their animations): the cast (4.9 s) "CARROT PATCH!" ("5 carrots, 12 moves each"), a carrot tossed each bound, flying from Chub's paw to its square and planted (the art's `carrotPatch`, one canvas under the pieces: `carrotItems`), then his ladder for 2.5 s ("What their carrots win", from `carrotOdds`: `carrot-race.ts`); a pull pops and leaves the puller's token in the square's corner (his as your turn begins; yours as your move lands, on his thinking screen: `yourPulls`); the dock's count (`RaceBadge`: his, yours, your moves left) while the race is on; his spin (5 s): `raceWon` or `raceLost` (tier 2: won when he pulled at least as many as you), then the reel (one row of prize cards across the board's middle, each prize as often as its odds for his count, stopping in 3 s on what he rolled, the card picked by the moment's key alone: no rigged near-miss; `reelStrip`, `reelStop`), then the prize pieces drop onto their squares (`hopperFen`); his fifth carrot: "FIVE CARROTS!" and his cheer, no spin (when it also mates, his attack on your king comes after them, then the result). The dock's line for the cast. Lines: `carrotHis`, `carrotYours`, `spinBig`, `spinSmall`, `spinEmpty`, `carrotsAll`. `?carrots=N` (solo, with `?power=carrotpatch`; settings.bossCarrotTest; `carrotsWithinReach`): N carrots a step from his pieces and out of your reach, the rest a step from yours and out of his, and his race brain takes one whenever a move of his pulls one (`BossRace.eager`), so each side pulling its own brings his spin on N (5: his fifth wins). The dock's count (`RaceBadge`): at the status box's left on a computer, at the left of the God King's line on a phone. `?power=carrotpatch`: from 1.e4 e5 2.Nf3 Nc6, the cast at the start of his first turn |
| Smudgy (`smudgy`; Oct 19: a chameleon painter in a beret; **playable** since the wiring lane: kit `Smudgy`, `components/Smudgy.tsx`, `characters/smudgy*.ts`, `camo.ts`; docs/decisions/2026-10-19-smudgy-wired.md; his rules: docs/decisions/2026-10-19-smudgy-rules.md; tuned: offset 0, the crowd scores 0.44 in the sim (0.69 at −250), about 1.1 Repaints a battle, `reports/smudgy-sim.md`) | **always the starting position** (`opening.fromStart`), whichever side he has | **Camouflage** (`smudgy.ts`): his first two moves are forced (`camoDue`, set as his turn begins in `afterCrowdMove`, or in `opening.setUp` when he moves first; `bossStops` leaves him only it): an end pawn two squares, then that side's rook to its third rank; the side from the seed among those where both are legal and the rook's square isn't simply lost (`camoSides`); one that can't be played waits a turn, `camoTries` (3) turns in all, then no Camouflage. After the second, in `afterBossMove` (a base at its ply), the swap: the rook and one of his pawns change places, seeded among those that keep the position one the engine plays and the crowd out of check on either board (`swapOptions`); the rook hides there, the screens draw it as a pawn (`maskedFen` with the view's `camo.square`: as with Hollow's dark, in the app's memory, not a secret). It makes only pawn-shaped moves (`keepsDisguise`: forward, two from his pawns' rank, never a capture, never a double step a crowd pawn could take en passant on the board it sees, never the back rank, never a fake pawn check) until the crowd's `camoStrikeTurn` (3)rd move after the swap, then any rook move. Revealed by a move no pawn could make, a check (own or discovered), or a move of his that leaves the crowd no move legal on both boards (`unmask`, `reveal` "move", "check" or "stuck"), or when the crowd takes it (`rookTaken`, as the move lands). While it hides, his moves are named on the board the crowd sees (`specialMove`: "Rd8", never "Rhd8"), and the judge never names or rewards a capture of it (`judge` hooks: `hiddenJudged`, `hiddenRanked`). The crowd may play only moves legal on both boards (`crowdFilter`): one legal as it sees it but not in truth is refused with `stopReason` "paint" and picked again, no cost; the judge and the bots score the true board within those moves (the board it sees has nine pawns of his, which Stockfish refuses), and the turns he hides it don't count for fair play. Once a battle. The view's `camo` (`CamoView`); events `camouflage` (`square`: the rook's old square only; where it hides is only the view's), `unmask`, `rookTaken`. **On screen** (`SMUDGY_BEATS`, timed by his animations' cues; the audit of what a player can see is in the decision file): while `camo.square` hides the rook every screen draws `seenFen(fen)` (`camo.ts`: `maskedFen`, with the hidden square at every position of the battle so far, so the history and the replays are masked too): `Board.tsx` is the one place that draws a position (`unmasked` only for the true board once `boss.result` is set), the dots are the moves legal on the drawn board, every move's name goes through `seenSan` (the dock, the Crowd screen, the hints, the God King's cues, the barred note, the knock sound, the boss character's mood and beats), and the home page's live window is masked by the server (`lobby.ts`, `hiddenRook`). A move legal on the drawn board but not allowed is stopped by the board itself (`stopped`) and `refusedLine` says "A painted piece stops that move."; it is never played and never snapped back. Never read a drawn position with chess.js: it throws on a pawn on rank 1 or 8 (his rook, drawn as a pawn, on his strike's last rank), so `inCheckDrawn` and `moveKnock` catch it. His moments: "CAMOUFLAGE!" (he flings his brush at `splash`, a blob flies to his pawn row, a splash lands on every square with one of his pawns whichever hides the rook, the swap happens under it at `swapAt`, the paint holds and fades off the board as the crowd sees it from now on; 3300 ms), the reveal (his tail snaps open at `drip`: the piece moves as a pawn until the paint drips off it and it shows as a rook; the dock says "…" until then; 1500 ms), the rook taken ("That was his rook!", a drip on its square, his line; while he thinks; 1200 ms) | **Repaint** (`smudgy.ts`'s `smudgyBattle`), at most `repaintMax` (2) a battle (`ultimateMax`: then the meter is off): the usual meter and warning; at the start of his turn, his forced moves done, he paints one of his pawns the crowd's color and one of the crowd's knights or bishops his, his whole turn (`passTurn`, a base at its ply; the runner's `repaintDue`/`applyRepaint`, the lobby's `requestRepaint` asking the host with the request's `repaint`, solo's `repaintTurn`). The engine's pick (`repaintFrom`): his gain with the crowd to move against his evaluation before (`passScores`, `repaintNodes`) within `repaintBand` [1.5, 2.5], nearest `repaintTarget` (2); none: no Repaint that turn (`repaintWait`), again next turn; the test switch's first and the admins' trigger take the nearest outside it. Hard rules (`repaintOptions`): never the crowd's queen, rooks or king, his king or the hidden rook; never a pawn one step from promoting for its new owner; never either side in check or a mate in one for either; never a position the engine refuses (so never while the crowd has all eight pawns). The view's `repaint`, `repaints`; event `repaint` (`squares`: the pawn, then the piece). `?power=repaint`: from 1.e4 d5 2.exd5 Qxd5, a pawn gone each side. **On screen** (3000 ms): "REPAINT!" with "e5 and c4 change sides" (his pawn's square and your piece's), a cream stroke on his pawn's square at `stroke1` (it's yours now) and a charcoal one on your piece's at `stroke2` (it's his), each piece changing colour under its stroke (`smudgyFen`); the dock says "Smudgy spent his turn repainting." |

**The Hidden Boss's phase 2** (Oct 14; DECISIONS.md, "The Hidden Boss, phase 2"; solo only: an admin's Boss alone, and a
solo Crowd's boss final you reached, where the other three finalists take the other boards (`phase2Follows`,
`phase2Mates`). **Not online yet** (four boards online, his server-side Stockfish and its fair-play hooks are a separate
build): online, phase 1 won is the crowd's victory):
- **The phase change** (Eric, Oct 14, reworked, then opened with the God King's absorption; `PHASE_CHANGE` in
  `packages/app/src/recluse-phase2.ts`, about 24.8 s after a 1.8 s fall (its "PHASE 2" banner 1.4 s, `BOSS_BANNER.phase2Ms`, Oct 16), one timeline, not skippable like a boss's
  intro; drawn by `screens/Recluse2.tsx`, `PhaseChangeScreen`). **Its pace** (Eric, Oct 17, after playing it: "everything's
  perfect, but it happens way too fast"; docs/decisions/2026-10-17-phase-change-pace.md): about 10 s more from the mate
  to the split, the animations unchanged, every added time a setting (`RECLUSE_PHASE2.change`): his words before the
  seize (`talkMs`, 4.5 s), a hold as the power lands (`absorbHoldMs`, 1.5 s), a longer cast (`castHoldMs`, 4 s); then
  a 5-4-3-2-1 on every board before phase 2's clocks run (`countdownSeconds`):
  - **The absorption** (Eric, Oct 14: he plays with an engine in phase 2, so he takes the God King's; DECISIONS.md, "The
    Hidden Boss absorbs the God King"): in his place in the dock (BossDock's `king`, from `absorbKing`) the God King
    raises his sword, his golden aura swelling (`.gk-aura`), and gloats (`KING_VS_RECLUSE.triumph`, a `lead` cue: whole
    since Oct 17, before his cry); the boss, kneeling, mumbles on (his fall's first line), then says he'll take that
    power (`RECLUSE_LINES.seizeTalk`, `talkAt`: as his mumbling ends; typed out before his hand goes up); his head snaps up and he raises his open hand to him (`seize`, then
    `seizeLoop`, a figure run step held for the drain, `phaseChangeRun`); a golden stream runs from the God King into
    that hand (`AbsorbStream`: a beam of two strokes and motes moved by transform, over the page, measured from both
    drawings) while he's drained through his Last Stand's blows, flashing and cracking (his own frames, `lastStand`
    from its blows, drawn ahead by `prewarmKing`), flickering, his aura shrinking, and cries out
    (`KING_VS_RECLUSE.drained`); as it lands the boss's fist closes (`seized`, its spark `recluseSpark`), his half-engine
    look ignites (`setEngineAt`) and he says so (`RECLUSE_LINES.absorb`, CRITICAL: it cuts in on his word before the
    seize), and the God King fades up and away in light (`gkLeave`); he holds his fist, its last frame (a one-shot given
    a time in a figure run holds its last frame), the dock saying "The God King's power is his!". Sounds: `gkHyuah`, `recluseDrain`, `gkLastGrunt2`, `recluseSpark`, `gkLeave`.
  - **Then**, where he stands, he gets up in a rage (`rage`, both drawings); then the board draws his whole figure (a
    phone too; `.rc-fig`, his place empty meanwhile: `.rc-away`) for his leap onto the middle (`leap`: a thud, dust, the
    board jolts), the book brandished and thrown down open at his feet (`drop`), his chant over it (`chantRaise`,
    `chant`: arms raised, his hair lifting into phase 2's) as light pours up out of it (CSS only: `.rc-light`, a pulsing
    cone behind him, and `.rc-glow` on the pages; only opacity and transform move) and one chant line
    (`RECLUSE_LINES.chant`; it waits up to about a second for his absorb line to end), for `castMs` (5.7 s) before the crack; Sawyer's board-saw gap runs down and across the middle, the quarters part and each grows
    into a whole board (a transform and a clip only) as the light dies, while blue arcs strike the cracks from his
    raised hands (`Arcs`, `ARC_STRIKES`: a thin bright core in two soft glows, smooth paths redrawn every 70 ms, gone in
    260 ms, two big ones as the board cracks and as it parts, a blue flash where each lands and a blue pulse on the
    board; one SVG, no filter; `recluseArc`); the book snaps shut and flies up into his hands (`pickup`, his revive's
    frames) while every board's pieces fly to their Chess960 squares; he leaps back to his place (`leap2`) and rests in
    `idle2`; "PHASE 2".
  - **Then the countdown** (Oct 17): phase 2's screen (`SimulScreen`, the boards where you'll play them: a phone's big
    board and three small ones) with no clock running and no move possible: the round's countdown (`CenterCount`) on
    every board, 5 to 1 a second each with a tick, "Get ready" over yours, the dock saying "2:00 on your clock" "No added
    time."; the phase's `at` is when the clocks start (solo's `startSimul`, then `startClocks`), and his phase 2 line
    comes with them. Reduced motion: the same times, the numbers without their pop.
  - One book on screen throughout, in his frames (`RECLUSE_BOOK` isn't shown). His frames and the God King's are drawn
    ahead from his battle's start (`prewarmRecluse`), its sounds made ahead in the sound worker. Other sounds: his
    rustle, `recluseThump` (landing), `recluseShut` (the book), `recluseGlow` (the light), the saw's crack.
  - **The board keeps phase 1's size until the split** (Eric, Oct 18: it shrank on his phone as the boss fell;
    docs/decisions/2026-10-18-phase-change-board-size.md): the phase change has no scoreboard, so on a phone where
    phase 1's was minimized (`underBoardView().open` false) its screen carries `rc-folded`, which gives the board the
    same height budget as `:has(.mini-tower.closed)` (styles.css). Test: `e2e/recluse.spec.ts`, "the board keeps its
    size from the mate until the split" (every frame, within 1 px, 390 × 600 with the scoreboard minimized; 1280 × 600).
- **Its words, never twice at once** (Eric, Oct 15; DECISIONS.md, "Every banner a second longer; nothing said twice
  on the Hidden Boss's screens"): the subtitle adds nothing before the split (the title says "phase 2"), then
  "Chess960"; the boss bar's right side is empty (in phase 2, "N of 4 won": `bossNote`, `""` in the phase change, null
  outside phase 2, so it's tested against null); the dock never says what his or the God King's bubble or the banner
  says: no sub-line under "The boss rises!", and as "PHASE 2" "Win all four boards" shows, "2:00 on your clock" over
  "No added time." (two lines: one was cut off at 360 px). The God King's bubble goes with him once he's absorbed
  (`king="gone"`: none from an empty place). Phase 2's end: "The boss wins." (the bar says how many were won) or "All
  four boards won!". "5 SECONDS!" is its name alone; the dock says "5 s a move, or a random one", and his `ult2` lines
  never name the seconds (placeholders; the number is a setting).
- **His half-engine look** (Eric, Oct 14: "if we can avoid doing any sort of changing to the sprite and just do an
  overlay, that would be sick"): from the absorption to the end of the battle (the result screen too), over every
  drawing of him (the bust, his figure by the board, his figure on the board, the results): his left eye (our right)
  glows cold blue, faint circuit lines run from it to his temple and down his cheek, and now and then it flickers
  (`EngineOverlay` in `components/Recluse.tsx`: a box his drawing's size holding one his head's size, moved onto his head
  each frame by a transform, `placeEngine`, from the head part's place in the frame, `headOf`; the kit's `engine`;
  styles `.bc-engine`, opacity and transform animations only). It ignites only as it comes (`fresh`); a new battle
  clears it (`resetBeats`).
- **The God King is gone in phase 2** (absorbed): his place in the dock stays, empty (`king="gone"`, so the dock doesn't
  move), no button, no charges, and not a word from him (his phase 2 lines are gone; a board's result is on the board's
  own tag, and his word on it is the boss's).
- **Phase 2** (rules `packages/chess/src/bosses/recluse-phase2.ts`; driver `Phase2Game`; screen `SimulScreen`): four
  boards, each its own Chess960 start (`phase2Numbers`, from the battle's seed, all different), each a BoardState from
  a base at ply 0 (`phase2Board`). The players are White; you play board 0, bots the other three. His brain is
  Stockfish only (`phase2Brain`, `phase2BossMove`: `RECLUSE_PHASE2.elo` 2750, `nodes`, `moveMs` 900 a move), one engine
  serving the boards in turn (`phase2Next`: yours first). Each player's bank `bankSeconds` (120 s), no increment; he
  has no clock. Yours is the dock's clock, at the box's right (Oct 15). Each board's tag (`Tag`): on a computer, the
  player's name and clock in a row of its own above each board, off its back rank (the four boards a little smaller for
  it, `DESK` in `Recluse2.tsx`: 44.5% of the square each, a 4.6% row above; the phase change ends them there too; the
  "slow move" note at the row's right); on a phone, each small board's clock just above it, off its pieces,
  and the big board none when it's yours (the player's name on one you watch). The scoreboard has no Bank column from
  the phase change on (`RaceTower`'s `bank`): each clock is its board's. A board ends by mate, a draw, time
  (`phase2Flags`) or resigning (`phase2Resign`); the others play on;
  the battle ends when every board is decided, won only with all four won (`phase2Outcome`). Then his reaction
  (`RECLUSE_PHASE2.endMs`: beaten, the spellbook's glow as a placeholder for his transformation; he won, his laugh) and
  the result (`results.simul`: "won N of 4"). No power-ups, no items, no God King (absorbed). Engine move (admins)
  works on your board.
- **His phase 2 ultimate** (Eric, Oct 14): a move longer than `slowMoveSeconds` (5 s; anyone's, any board, before it
  comes) is a slow move for the team (`Phase2State.slow`; his line, `slow`, low priority: it never stacks; a soft sound,
  `recluseSlow`; the marks flash and that board gets a "slow move" note); each shows as a red pixel X beside your board
  only (`SlowMarks`: ten slots in a column by its right edge, as Jefferson's candle shots; on a phone, by the big board;
  once, since the count is the team's: Eric, Oct 14). The team's `slowMovesForUlt`-th (10; Eric, Oct 14) brings it (`phase2Ult`): his line (`ult2`), the
  spellbook where he stands, "5 SECONDS!" over every board (`PHASE2_ULT_BANNER_MS`: a boss's banner, 1.5 s, Oct 16); everyone
  whose move it is gets a fresh 5 s from then; from then on every move has `ultMoveSeconds` (5 s), no bank, and out of
  time a random legal move is played for that player (`phase2Timeouts`, as Squads plays a missed move; never a loss on
  time). The dock's clock counts it down ("5 s a move, or a random one" beside it). Bots think past 5 s now and then before it (`botSlowChance`, `botSlowMs`). The
  admins' trigger brings it at once.
- **His chatter, both phases** (Eric, Oct 14, then Oct 15: "he stopped saying voice lines after like 10 moves";
  DECISIONS.md, "The Hidden Boss keeps talking"): one line about every 15 s of play by the clock (`RECLUSE_TALK`:
  `everyMs` 15 s, give or take `jitterMs` 3 s), all through phase 1 (from his first "play" turn, the bullet stretch too,
  until he's beaten) and phase 2 (while any board is in play). `recluse-talk.ts`: `Chatter` (when the next is due, which
  line), `talkWhen` (whether he may talk now: in phase 1 on the crowd's move once its clock runs, or while he thinks,
  so never over his intro, his moments or his fall; in phase 2 while a board is in play), `useRecluseTalk` (the driver,
  called once from `App.tsx`: a look every 0.5 s while his fight is on screen; it reads only the match's view, so the
  Crowd final's online phase 1 gets it too, each device from its own view; never a player who's out, who only watches). Said at the lowest priority (`CHATTER` in `speech.tsx`): only when no other
  line of his is up, and any other line cuts in on it; due but blocked, it's tried again `retryMs` (1.5 s) later.
  Three stages by play time so far (`talkStage`; phase 1 middle from 1:15, late from 3:00; phase 2 from 0:45 and 1:45):
  suspicious muttering, accusations, angry ranting (`RECLUSE_LINES.talk[1]`, `talk[2]`; each stage shuffled, none again
  until all are said). In phase 2 every third line, from the first, mocks the engine he took (`RECLUSE_LINES.engine`, in
  turn: "Fun, isn't it?"). Phase 1's are about you and the God King (an engine at your side) against him; lines about
  the boards are phase 2's. His rivals' last names are fine; never their country or its people; nothing says Korchnoi
  threw games; each QUOTE in one phase only.
- **Layouts:** a phone: the other three boards small above yours (tap one to watch it; "Back to my board"); a computer:
  the four as a 2x2 in the board's square, each at its corner, as the phase change leaves them. Each board keeps its
  own layers to itself (`isolation`), so his bubble sits over all of them (Eric, Oct 14: a long line was covered).
- **Test switches:** `?win=1` (phase 1 a mate in one; in phase 2 every board starts from a mate in one, written as
  Chess960, and the bots take it, so your Qxf7 wins it all), `?phase=2` (straight to the phase change, no phase 1);
  together, a loss is one resign away.

- **An engine-shaped power** (Wrangler's showdown, Oct 13; Eric wants every ultimate this way later: ROADMAP.md): the
  power searches its possible outcomes with the engine and plays one that moves the game by a set amount, when it finds
  one. The pattern, in `bosses/pig.ts`:
  - **A pure, seeded generator** of plausible candidates (`lineups`: a pair at a time anywhere on ranks 2-7, his pieces
    protected, those with at most one of his pieces ganged up on first) and **a pure checker** the server uses on the
    answer (`checkLineup`): the host's word stands only within the rules.
  - **Scored by the engine where the boss's moves are worked out** (the host's device; solo this one), never the server:
    a quick scan of each candidate (`searchShowdowns`, `showdownNodes`, read with some slack), the promising ones looked
    at closely (`confirmShowdown`, `showdownConfirmNodes`), the pick nearest the target, seeded among ties. Its numbers
    are pawns in log-odds of the engine's expected score (as Big Boy's bounce), measured from the position before.
  - **Its search time comes from the crowd's thinking:** a scout (`ShowdownScout`, an engine of its own: `ownEngine`)
    searches the position while the crowd thinks, every turn from `showdownFrom` while one may still come (the view's
    `scout`), three pairs then two, confirming the promising ones and keeping them (those that qualified first) from turn
    to turn, dropped once they no longer hold; his move changes the position, so at his turn the kept ones are scanned
    again on the new one first (most still stand), then fresh ones, within `showdownTurnMs` (one run of the seeded
    generator a size, carried on round after round: until Oct 13 each round started it again, so his turn re-scanned
    the same few line-ups). The generator yields to the page every few milliseconds (`SLICE_MS`): nothing freezes the
    board. With his meter full and nothing qualifying, each of his turns spends up to `showdownTurnMs` searching;
    except in a battle already decided his way (`showdownHopeless`: his edge so high, against the engine's top score,
    that no duel can cost the crowd `showdownTrap` more), where his turn and the scout stop after one search.
  - **The server asks for it with his move** (`BossRules.asks`: the bossRequest's `pull`, `drag`, `showdown`, and a
    `seed` drawn from the battle's and the turn, never the battle's own) and gets it back with the move (`bossMove`'s
    `drag`, `showdown`); `afterBossMove` checks it and puts it on the board as a base; the next turn's events show it.
    The host has longer to answer when it's asked for one (`bossTimeoutMs`).
  - **The outcome it scored is the outcome played:** the search reads each position after the crowd's answer with the
    engine's best reply, so the boss's reply there is that move, by the engine at full strength (`bestReply`, above),
    never his brain's, and so are his next moves while the line-up's tactics are live (his best reply can be another
    capture first, the piece taken back a move later), up to `showdownEngineMoves`.
- **Test switches:** `?boss=<id>` picks the boss (`?boss=jefferson` too: `BOSS_ALIASES`, read by `bossIdFromLink`;
  a boss whose powers are built before its art: `?boss=<id>&wip=1`, solo, Boss alone);
  `?power=<id>` brings its ultimate early (warned as turn 2 begins, unleashed on turn 3; its passive as usual; Wrangler's
  `?power=showdown` fills his meter from turn 2, his showdown searched from his next move; `?power=drag` and Alfil's
  `?power=tusks` bring those passives sooner and more often; Chub & Chirp's `?power=leapfrog` starts the battle from
  1.e4 e5, so a hop comes on his first turn: `?boss=hopper&power=leapfrog`; their `?power=carrotpatch` starts it
  from 1.e4 e5 2.Nf3 Nc6, warned as the first turn begins, so the cast comes at the start of his first turn; Smudgy's
  `?power=repaint` starts it from 1.e4 d5 2.exd5 Qxd5 so a Repaint fits, warned as turn 2 begins, the first Repaint at
  the start of his turn after his forced moves: `?boss=smudgy&power=repaint`; his `?paint=1` and `?paint=2` start it with
  his rook already hidden on d7 and the d-file open (`PAINT_TEST`), his moves scripted: 1, the rook steps to d6 as a pawn
  would, then strikes on d2; 2, it steps to d6 and d5 and your rook takes it hidden (Ke2, Rd1, Rxd5); in both Kd1 and Kd2
  are moves the board you see offers and the real board refuses); admins
  see "Trigger ultimate (testing)" in any boss battle (`ultimateTestButton`, `triggerUltimate`: the ultimate as the next
  crowd turn begins, no warning; on a computer in the title line with the brain's pill, before sound and the flag; on a
  phone under the dock). A boss's attack on a king: `?boss=hollow&laststand=1` (Boss alone: your first move
  calls the God King's Last Stand, and Hollow lashes him) and `?boss=hollow&mate=1` (Boss alone from 1.f3 e5 2.g4, the
  boss to move: he mates at once, lashes your king, then the result; `settings.bossMateTest`, solo only).
- **Resigning never waits for a moment** (Oct 13; DECISIONS.md, "Resign: leaving a match in every mode"): the top
  line's "⋯" or flag works through every moment (the God King's Last Stand, Lights out, a power's banner, the boss's
  turn). Solo, the battle stops there (Boss alone: "You resigned", the boss won) and the moment's timers, its engine
  work, Maia and both voices are cleared. Online, the others' battle goes on: a host who resigns hands the boss's move
  to the next device at once, and someone resigning in Lights out leaves the test (a round no longer waits for them).
- **Banners** (Eric, Oct 16: "when the bosses ult they are ulting while the banner is still up, same thing for Toy
  Blocks: he threw it and we couldn't even see due to long banner time. Do 1 second less";
  docs/decisions/2026-10-16-banner-timing.md): **a boss's banners are 1.5 s** (`BOSS_BANNER.ms` in settings.ts): each
  power's (`PowerBanner`, through `PowerMoment`'s `banner`), QUEEN SLAIN! and QUEEN DOWN!, "START!", BULLET!, "5
  SECONDS!"; "PHASE 2" 1.4 s (`BOSS_BANNER.phase2Ms`). Each is a second shorter than on Oct 15 (when every banner got a
  second longer), and **off the board before its power plays**: a power's banner ends sooner where the power starts
  sooner, at the beat its view passes as `until` (the toy block's, the pie's and the sparkler's throw at 1.45 s, the
  blizzard's sweep and a thaw's melt at 1.3 s, the Big Bounce's leap at 1.3 s, Lights out's drop at 1.3 s, Boingo's spin;
  the split's, the lasso's and the showdown's 1.3 s and the darkness's 1.25 s are their tables' `bannerMs`); Wrangler's
  "DRAW!" from its beat to the moment's end (1.4 s). The banner's length is its band's: it slides in, holds, and is off
  by `--fb-ms`, which `FightBanner`'s and `PowerBanner`'s `ms` set (styles.css: `fb-band-in`, then `fb-band-out` timed
  from it; the entrances inside it come in its first 0.6 s whatever its length). The moments that grew a second for the
  longer banner are a second shorter again (`POWER_FX`: the rage warning 1.7 s, freeze 2.3, thaw 2.2, pie 2.3, sparkler
  2.3, Hollow's extra move 2.2, toy block 2.3, saw cut 2.3, the showdown 6 s), Boingo's board turns a second sooner
  (`FUNHOUSE`, `SPIN`; the funhouse 5.2 s, each spin 2.6 s), "START!" makes the intro a second shorter, the phase change
  is a second shorter, and the boss thinks at least 2 s after you take his queen (the banner and a beat:
  `bossThinkMs`). The God King's cut-ins (2.5 s, `KING_COMMAND.cutMs`), the Last Stand's (3.1 s), FISCHER RANDOM!,
  Squads' block line and the votes' result banner keep their Oct 15 lengths. The clock rule is unchanged everywhere
  (the crowd's clock starts after the moments; a strike stops it for `kingStrikeMs`, 4.7 s). Tests:
  `packages/app/test/banners.test.ts` (each power's banner read from its view's own code), `e2e/bigboy.spec.ts` (the
  toy block's and the Big Bounce's banners off the board before the throw and the leap, frame by frame: `watchSpans`).
- **QUEEN SLAIN! once, and only for your capture** (Eric, Oct 16: "he used his ult and idk what happened but the queen
  slayed banner appeared for like 1 second very fast"): it plays while the boss thinks after your move took his queen
  (`queenSlain` in `boss-timing.ts`, the screen's banner and `bossThinkMs`'s wait alike, solo and the lobby's
  `thinkMinAt`). Big Boy's turn thinks twice on the same last move (for the bounce, then for his move), so it was played
  again after his bounce, cut off by his move in Boss alone; now it plays only in the thinking straight after your move
  (`powers.bounce.at` this turn: old news), the bounce waits for it online as solo did, and his move after the bounce
  doesn't. It never plays for the boss taking your queen (Hollow thinks again after his own move for his extra move).
  Tests: `packages/chess/test/boss-guard.test.ts`, `bigboy.test.ts`, `packages/server/test/boss-powers-lobby.test.ts`.
- **What a boss says** (`packages/app/src/speech.tsx`, numbers in `SPEECH`; Eric, Oct 10: Ginger's line came and went
  at once): every line (its powers' moments, its ultimate, its warning, its reactions, Hollow's claim and Lights out
  words, Big Boy's snack) goes into the boss's voice and shows in its text box beside it (in the boss bar on a phone,
  by the board on a computer), on every screen of the battle, also while it stands at the board's corner for a
  moment. Each line types out, then stays fully readable for 2.2 s plus 35 ms a character (at most 4.5 s: a short
  line about 2.5 s, a long one about 4 s; Eric, later on Oct 10: "a few seconds… not that long"), whatever the screen
  does next. One line at a time: only a critical line (an ultimate's, Hollow's first cover of the dark, his
  claim, the battle's end) cuts in on another; the rest wait their turn, highest first, and lapse after 5 s of waiting.
  A move that brings a power's moment says nothing of its own (the moment's line is the boss's word that turn). Lights
  out's round prompt keeps its own box above the board for the whole round (and the dock). Each speaker's box keeps
  itself current (`VoiceBubble`: it listens to its voice and draws every frame while a line types and fades), so
  nothing around it has to be drawn again for it. On a phone the boss's box is in the boss bar's name column (BossBar,
  `.bc-bar-bubble`), from just above the bar's bottom edge upwards, never over the bar's status at its right or the line
  and board under the bar.
- **Nothing said twice during a power** (Oct 15; DECISIONS.md, "Nothing said twice"): **the banner names the power**
  (with its line saying what it does to you, as before); **the dock says what it means for you, or just your clock**:
  through a moment it keeps the turn's own line ("Boss plays Nf6"), unless the moment has words of its own where no
  banner says it (`MomentUi.dock`: the Big Bounce, "Your pieces land on new squares."; the fireballs, "Fire on e4 and f5" or "Fire on 3 squares";
  the fireproof laugh, "Fire burns only your pieces."); **the boss's bubble is a character line, never the power's
  name** (Eric's own lines stay: Big Boy's "Big boy BOUNCE!", Sawyer's "Two for one!", whose banner now says "He gets a
  second pawn"). Hollow's claim and Big Boy's snack lines are the bubble's only (the snack's dock: "You start a pawn
  down."); Wrangler's "DRAW!" is its name alone and your move's dock says "Take one of his three duels."; the Hidden
  Boss's "+2 s a move from now on" is the board's alone. The corner casts (the boss steps up to the board's top-left
  corner, over the subtitle and a8, while the board isn't playable) are as designed. Test:
  `packages/app/test/nothing-twice.test.ts`.
- **Same for everyone online:** what a boss does and says on screen comes only from the shared match state
  (`boss-beats.ts`): one-shot animations play once per moment from when the device first saw it, loops run by the
  clock, lines are picked by a hash of the moment. No new protocol for a boss's looks (Hollow's `lights`, a field of
  his view, is the one exception: below).
- **Hollow's lights** (Eric, Oct 11): his ten bulbs take a fresh order of `HOLLOW_LIGHTS`' 8 colors (settings.ts)
  each battle, never one color on bulbs within three of each other along the wire (so none lit side by side match as
  the countdown puts every third one out), the
  same for everyone: from his view's `lights` (0 to 4095, drawn from the battle's seed). Every place a bulb is drawn
  takes them (his sprite and moments, his attack and lashes, Lights out, the strip by the boss bar): each bulb has its
  own palette keys, recolored as frames are drawn (`characters/lights.ts`, `Swap` in `sprite.ts`). Unit:
  `packages/app/test/lights.test.ts`.
- **Hollow's whole strand in every pose** (Eric, Oct 16: "make sure it's showing for all of his animations";
  docs/decisions/2026-10-16-hollow-full-strand.md): all ten bulbs lit on his figure through the battle (idle, thinking,
  his move, a capture, check, smug, rattled, victory, casting the dark, the claim, his attack's lashes), whatever the
  countdown. Until Oct 16 his figure wore the countdown (`bulbs3`…`bulbs0`, a third of the strand out per move, 10 → 7
  → 4 → 0); now only the strip of three by the boss bar counts down (unchanged), and Hollow's kit has no `lookOf`. The
  looks stay (the battle's colors swap the same keys): his entrance lights the strand a third at a time, a hit makes it
  flicker, his defeat puts it out, Lights out smashes it and the fresh strand drops out of the void whole (its halves
  lengthening) and lights a third at a time. Unit: `packages/app/test/hollow.test.ts` (every frame of every animation
  paints all ten bulbs; the battle's poses show all ten lit).
- **The dock under the board, every boss battle** (Eric, Oct 15; DECISIONS.md, "The boss dock after Eric's Hidden Boss
  playtest"): the row (« status ») exactly the board's width, under its left and right edges, on every screen (BossDock
  measures the board as drawn, before the first paint and on every resize: `lineUpWithBoard`, `--dk-left`, `--dk-w`).
  In the box, the words centered and, at its right, **your clock** (`DockClock`): bold, m:ss rounded up as the big 3-2-1
  counts; running on your move, red in its last 10 s; once your move is in, it holds where it stopped, dimmed, through
  the boss's turn, the reveal and the moments, whichever screen shows it; under the bullet clock's increment a "+2"
  rises over it as each move begins. None during Lights out's rounds (their prompt and meter take the box: before the
  first round, as the night falls, the dock keeps its layout and your held clock, "Remember where his pieces are." over
  "Clocks stopped."), the phase change, or before your first move. Its first line wraps to two rather than being cut
  (the box holds two and the muted line under them). The muted line under a reveal leads with the verdict, in the
  reveal's words ("Best move · You: e4 (+2.1)", "Best was Qxe7+ · You: e4 (+0.0)"), so a cut on a narrow phone falls
  on your move and score, never on it. The words never carry the time, nor how many have
  picked (the line above the board says it). On a phone the God King stands on a line of his own under the row, in its
  middle, his menu opening above the row and his words beside him to his right, on his line (a long line runs down past
  it), never over the board or the box; beside the row only where the screen's column has 66 px right of the board
  (`KING_BESIDE_PX`: a phone on its side, his words above him as before). Tests: `e2e/boss-dock.spec.ts` (the edges
  within 1 px at six sizes, the clock in every frame of three moves), `packages/app/test/boss-clock.test.ts`.
- **The boss screen on a computer** (Eric, Oct 11): the boss by the board's bottom-left corner, the God King by its
  bottom-right, mirroring him (feet level, as far from the board); the status box under the board at its width; the
  column beside the board starts after the God King. The eval bar draws behind them both. A phone is unchanged.
  From 900 to 1099 px the boss is drawn at 1× by the eval bar, so he's whole in the window; the board makes room only
  if it must (`--bs-reach`, `--bs-need` in styles.css; Oct 14). From 1100 px he's 2× (2 screen px a sprite px).
- **What a boss screen draws each frame** (Oct 15; DECISIONS.md, "The boss screen draws only what changed"): the boss
  screen (`Boss.tsx`) and the Hidden Boss's phase change and phase 2 (`Recluse2.tsx`) keep a clock that ticks every
  frame for what moves with it: the board and everything drawn over it (moments, effects, banners, Lights out), the
  eval bar, the board's jolts and turns. The rest are elements made once and kept (`useMemo`), so Preact leaves them
  alone until their key changes: the header with the boss bar, the boss by the board and the chat or scoreboard under
  it, on `useStillKey` (`hooks.ts`: the match changing, the boss's state changing, and every 200 ms, as often as your
  move's screen draws, for what they read as they're drawn); the dock on the same key plus the few clock-read values
  its words use (the moment's dock words, the burn line, the snack window, the funhouse's move, "Your move in N";
  every frame during Lights out, whose prompt counts down). The phase change and phase 2 keep the header and the boss's place
  the same way. The phase change's dock draws every frame (its words change with the clock); phase 2's (`SimulDock`,
  Oct 16, docs/decisions/2026-10-16-the-reveal-draws-only-what-changed.md) is memoized on its words, the still key and
  the whole seconds on your clock, read from the same frame time as the boards' clocks, so it and they tick in the same
  frame. The crowd's reveal in a raid and the Last Stand (`CrowdReveal`) does the same: [crowd.md](crowd.md). What draws itself every frame inside them does it on its own
  clock: Hollow's bulb strip through his turn (`BossBarExtra`), the speakers' words (`VoiceBubble`), the God King
  while he commands or says "can't"; their figures animate on their own canvases' loops as before.
- **The bars at the back, the ice on its square, the queen banners silent** (Eric, Oct 11): the move clock's bars above
  and below the board draw behind everything (squares' overlays, the boss, his effects and words, the God King), as the
  eval bar does. Ginger's ice is one block the square's shape on every square, whatever the piece, placed on
  the board's own square (eighths of `--board-size`); her thin ice (due to thaw) is the same block, clearer and cracked
  (Oct 12). QUEEN DOWN! and QUEEN SLAIN! play no sound for now (the gasp is
  kept, unused: `queenGasp`).
- **A boss's attack on a king** (Eric, Oct 10; Hollow's first, Alfil's Oct 17, Boingo's, Sawyer's and Wrangler's Oct 18;
  Big Boy's, Ginger's and Jefferson's Oct 18: every playable boss but the Hidden Boss, who blocks the God King):
  purely cosmetic, no rule changes. Its kit's `kingAttack` (`KingAttackKit` in `kits.ts`: the character it's drawn
  from, its animation, its size in frame pixels a square, where it stands, its hit on the king's square) plays on the
  board beside a king, on the beats every boss shares (`KING_ATTACK` in `boss-timing.ts`: it drops in, lashes or
  strikes ten times, a hit each, and leaps off; 2.78 s), drawn by `components/KingAttack.tsx`: the boss on the side
  toward the board's middle (mirrored when the king is to its left), each hit on the king's square on one shared
  canvas (`BoardEffects`), a gold "−N" off the king each hit (the God King's strike style, `ks-hp`), its line into its
  voice as it lands (`kingAttack` lines, critical), its figure in the corner hidden meanwhile. Where it goes is one pure
  function, `kingAttackPlace` (KingAttack.tsx): on the side toward the board's middle; mirrored exactly when that turns
  its face and its prop toward the king (its art faces our right unless the kit says `facesLeft`); and near the board's
  top, where its frame would rise more than `ATTACK_ROOM_ABOVE` (0.4 squares) over the board (a phone's boss bar is
  just above), drawn smaller, shrunk toward the edge of the king's middle on its side (`KING_MIDDLE`) so its body stays clear of the
  king and its prop still lands on him
  (on the top row about 0.53 to 0.75 of its size, on the second only Jefferson, 0.92; full size everywhere else), its
  drop-in and leap clipped at that line (Eric, Oct 18: "nothing gets smushed on a phone"). Two places:
  - **The God King's Last Stand:** it is the blow meant for the piece, from `LAST_STAND.attackAt`; the Last Stand takes
    no longer (see [god-king.md](god-king.md)).
  - **The boss's mate** (Hollow mates the crowd): from `KING_ATTACK.mateAt` after its move shows, on the crowd's king
    (the real one hidden; a copy flickers at each hit, darker each time, topples at the last and fades as the dark
    gathers on its square). The result waits for it: solo and the server both hold the mating move for
    `bossTurnShowMs` (`KING_ATTACK.mateHoldMs`, 3.9 s, for a boss in `KING_ATTACKERS`; any other boss or move as
    before). No power's moment plays with a mate.
  - **Hollow's:** `HOLLOW_ATTACK` (`hollow.ts`: his own parts and palette in a frame 38 px wider, so the strand reaches),
    `kingAttack`: his shadow grows, he drops in, then whips his string of lights at the king back and forth, cracked
    out straight then low (`lash`, `lashLow`, `recoil`, `recoilLow` strand poses), sparks off its tip, a `lash` cue each
    (`hollowLash`: a low whoosh and a dull snap, quieter than a move); `lashHit` on the king's square (forehand or
    backhand, from his side, in a bulb's color); he cackles and leaps off. 36 frame pixels a square (about 1.8 squares
    tall), 1.8 squares from the king. Drawn ahead as his battle starts (`prewarmKingAttack`).
  - **Sawyer's, Wrangler's and Boingo's** (Eric, Oct 18: "a relentless assault", a hit on every beat; nothing
    touches the king's sprite): `SAWYER_ATTACK`, `PIG_ATTACK`, `CLOWN_ATTACK` (their own parts and palettes in a bigger
    frame: room for the prop toward the king and headroom to drop in, `characters/attack-frame.ts`). Sawyer drops in,
    revs and saws at the king ten times, sawdust bursting (`sawHit`; cues `cut` and `swing` in turn), standing 1.45
    squares off (his saw is short; he faces our left as always: `facesLeft`, the board mirrors him the other way).
    Wrangler drops in with the loop whirling and cracks his lasso at the king ten times, its end snapping in the king's
    square high and low, whipped back overhead between (`lassoHit`; `pigYank` and `pigCatch` in turn), 1.8 off.
    Boingo bounces in on his pogo and flings ten pies, one per bounce, each landing on the king (`pieHit`; `clownSplat`
    and `clownSqueak` in turn), 1.8 off. A unit test keeps each prop's end past the king's middle, his body out of the
    middle of the king's square, and the ten hits' sounds together under a move. On a board Boingo's funhouse has turned
    a quarter round, the attack goes on the square the board shows the king on (`viewSquare`, KingAttack.tsx).
    docs/decisions/2026-10-17-king-attacks-sawyer-wrangler-boingo.md. Wrangler's art faces our left, as Sawyer's does,
    so since Oct 18 he cracks the rope out to our left and his kit says `facesLeft` (he had thrown it to our right and
    was mirrored to reach the king, so he looked away from it).
  - **Big Boy's, Ginger's and Jefferson's** (Eric, Oct 18, the same "relentless assault", on the same beats):
    `BIGBOY_ATTACK`, `GINGER_ATTACK`, `GREX_ATTACK`. Big Boy drops in, stamps into a tantrum (his face red) and bonks
    the king with his giant lollipop ten times, overhead then sideways in turn, glaring at it (`bonkHit`, a
    candy-colored bonk; `bigboyBonk` and `bigboySwish` in turn), 1 square off, facing our left (his lollipop hand).
    Ginger drops into a whirl of snow and jabs the king with her frosted, glowing cane ten times, high and low, glaring
    at it (`frostHit`, a frost burst: ice shards and a white puff, never over or on the king's sprite;
    `gingerCrackle` and `gingerCrunch`), 1 square off. Jefferson drops in with his Roman candle, plants
    it, lights the fuse at 470 ms and fires one fireball a beat, each arcing over and popping on the king (`popHit`, a
    small firework pop; `grexPop` and `grexSparkle`), 1.8 off. Ginger's and Jefferson's frames are built when first
    read (their parts are painted as they're made). docs/decisions/2026-10-18-king-attacks-bigboy-ginger-jefferson.md.
  - **Every attacker looks at the king** (Eric, Oct 18): a unit test checks, in every hit frame, that a turned head
    (Sawyer, Wrangler, Jefferson) or glancing eyes (Big Boy, Ginger) point the way his prop goes, that a face drawn
    front on (Boingo, Hollow, Alfil) stays front on, and that the board mirrors him exactly when that keeps both toward
    the king, for a king on every file.
  - **Adding one for another boss:** its kit's `kingAttack` (an animation whose hits land on `kingAttackHits()`, cued,
    lasting `KING_ATTACK.ms`), its hit effect, its `kingAttack` lines, and its id in `KING_ATTACKERS` (a unit test keeps
    the two lists the same); its face's keys in the facing test, and its line in the "every square" test (both in
    `packages/app/test/king-attack.test.ts`).

## Where the code is

Each boss lives in its own files, one per layer, on a shared base. The shared files only put them together.

| Layer | Shared | Each boss (Ginger, Boingo, Jefferson, Hollow, Big Boy, Sawyer, Wrangler, Alfil, Chub & Chirp, Smudgy) |
| --- | --- | --- |
| The roster, the playable rule, choosing a boss, strength | `packages/core/src/boss.ts` (`BOSS_ROSTER`; power ids, event kinds and every boss's state fields in `BossPowerState`; `adminOnly`, `menuBosses`, `crowdFinal` and `crowdFinalBoss`, the fixed brain) | its line in `BOSS_ROSTER` |
| Rules: each turn's powers, allowed moves, what the judge sees, after-move effects, fair-play turns, its opening, its screen fields | `packages/chess/src/bosses/base.ts` (the base boss, `BossRules`, and shared helpers), `bosses/index.ts` (the registry), `boss-powers.ts` (the dispatcher: `prepareTurn`, `crowdAllowed`, `bossAllowed`, `powerTurn`, `icedSquares`, the judge's hooks) | `packages/chess/src/bosses/<boss>.ts`: `ginger.ts`, `boingo.ts`, `grex.ts`, `hollow.ts`, `bigboy.ts`, `sawyer.ts`, `pig.ts`, `recluse.ts`, `alfil.ts`, `hopper.ts`, `smudgy.ts` (`bosses/grid.ts`: the grid helpers Big Boy's, Wrangler's and Alfil's generators share; `topEach`/`eachOn` in `base.ts`: candidates shared out over a device's engines) |
| Timings the server and the screens share | `packages/chess/src/boss-timing.ts` (`POWER_FX` spreads each boss's `<BOSS>_FX`; `powerFxMs`, `bossIntroTimeline`) | in its rules file (`GINGER_FX`, `FIRE_BURN_MS`, `LIGHTS_OUT`, `CLAIM_MS`, `SNACK`, `BOUNCE`, `BLOCK`, `SPLIT`, `SAW_CUT`, `BOARD_SAW`…) |
| Its moments in the match runner (Lights out, the extra move, the bounce, Alfil's steps, Chub & Chirp's hop and Carrot Patch, Smudgy's Repaint) | `packages/chess/src/runner.ts` hands each a `Battle` (base.ts) and keeps one-line methods (`startLightsOut`, `playBounce`, `alfilStep`, `playAlfil`, `applyAlfil`, `hopDue`, `playHop`, `applyHop`, `carrotDue`, `applyCarrots`, `repaintDue`, `playRepaint`, `applyRepaint`, `bossRace`, `raceJob`…) | `<boss>Battle` in its rules file, with its engine pick (`extraMoveFrom`, `bounceFrom`, `fuseFrom`, `slamFrom`, `hopFrom`, `repaintFrom`) |
| The lobby server | `packages/server/src/lobby.ts` (the boss's turn; the host-engine requests for the extra move, the bounce and Alfil's steps (`requestAlfil`: the cast's pairs and the fusion's squares as the request's `fuse`, the Slam's lifts as `slam`, each asked of the host; the pick comes back with the step it was asked for, so one the admins' trigger overtook is dropped; `requestHop`: Chub & Chirp's hops as `hop`, asked only when more than one pawn can; `requestCarrots`: their cast, never asked, the server's own; `requestRepaint`: Smudgy's pairs as `repaint`, asked of the host; their race as the boss request's `race` and the score jobs' `race`; their spin, the server's roll), and what his turn `asks` besides his move: Wrangler's pull, drag and showdown), `packages/server/src/bosses/base.ts` (`BossLobby`) | `packages/server/src/bosses/hollow.ts` (dark tries, Lights out) |
| Solo | `packages/app/src/solo.ts` (drives the same runner; its own timing of Lights out; Wrangler's scout on your turn; Alfil's steps, `alfilTurn`; Chub & Chirp's hop, `hopTurn`, and cast, `carrotTurn`; Smudgy's Repaint, `repaintTurn`) | |
| The host's engine work | `packages/app/src/net.ts` (`hostBoss` and its kin; Wrangler's `pigTurn` and scout; Alfil's, Chub & Chirp's and Smudgy's `hostPick`; Chub & Chirp's race brain from the boss request's `race`; the score jobs' `race` for the bots) | |
| Art and sounds | `characters/index.ts` (`CHARACTERS`), `characters/kits.ts` (`BOSS_KITS`: animations per moment, lines, portrait; optional `bar` (a phone's bar's own drawing), `loops` (a loop by another name), `fall` (lines said in turn once beaten), `lineOf` (a line from the battle)), `characters/power-art.ts` (each power's moments and effects); a frame's cue sound plays as `SpriteAnim` draws it, or a moment late when a slow frame skipped it (`framesSince`, `components/BossEffect.tsx`) | `characters/<boss>.ts`, `<boss>-sounds.ts` (`gingerbread`, `clown`, `grex`, `hollow`, `bigboy`, `sawyer`, `pig`, `recluse`, `alfil`, `hopper`; his lines in one table, `recluse-lines.ts`) |
| Board effect sprites | `characters/effects.ts` (`EFFECT_SPRITES`), `characters/effects/common.ts` | `characters/effects/<boss>.ts`: `ginger.ts`, `boingo.ts`, `grex.ts`, `hollow.ts`, `bigboy.ts`, `sawyer.ts`, `pig.ts`, `alfil.ts`, `hopper.ts` (the carrots, the dock's carrot icon, the carrot bonk) |
| Speech: every line's time and turn, the text box | `packages/app/src/speech.tsx` (`Voice`, `bossVoice`, `SpeechBox`, `VoiceBubble`, `holdMs`); power moments' lines said in `BossPowers.tsx` (`useMomentSpeech`), reactions in `BossCharacter.tsx` | a moment's `line`, `lineAt` and `priority` in its `BossUi` (only when the kit's lines aren't the whole story) |
| Powers on screen: moments, banners, the board layer, the rage meter | `components/BossPowers.tsx` (`momentsOf`, which passes over a moment kind this app doesn't know (a newer server's) rather than reading it; `PowerMoment`, `PowerBoard`, `BossBarExtra`, `dockLine`, the warning), `components/PowerParts.tsx` (`BossUi`, `Moment`, `Flight`, `PowerBanner`), `components/BossEffect.tsx`; `playInPlace` (`BossCharacter.tsx`: a run of a boss's own animations where it stands, over its beat) | `components/Ginger.tsx`, `Boingo.tsx`, `Grex.tsx`, `Hollow.tsx` (+ `LightsOut.tsx`), `BigBoy.tsx`, `Sawyer.tsx`, `Pig.tsx`, `Recluse.tsx`, `Alfil.tsx`, `Hopper.tsx` (+ `carrot-race.ts`: the ladder's words and the reel) |
| The boss's brain (Maia-3 or Stockfish) | `bossBrainFor` (core `boss.ts`), `packages/chess/src/boss-brain.ts`, `human-uci.ts`, `bossMoveFrom` and `bossBrainPlan` (`runner.ts`); online the lobby's `bossBrainNow` and the host's `hostBoss` (`net.ts`); solo `startBrain` (`solo.ts`); `packages/app/src/maia.ts`, `boss-brain.ts`, `components/BossBrain.tsx` (the picker), `BrainDebug` (`BossDock.tsx`); the Maia box `packages/maia-worker/` | none (every boss: `BOSS_BRAIN.brain`; an exception would go in `BOSS_BRAIN.byBoss`) |
| The boss screen | `packages/app/src/screens/Boss.tsx` (still names a few bosses: see below; Sawyer's split hides the new half until the crack, and his board saw jolts the board; Wrangler's lasso and showdown keep pieces where they were until they're hauled: `pigBoard`; what it draws each frame and what it keeps: `useStillKey` in `hooks.ts`); `screens/Play.tsx` (Wrangler's duel prompt in the dock) | |
| The boss menu's power words | `packages/app/src/power-words.ts` (`Record<PowerId, …>`) | |
| A boss's attack on a king (the Last Stand, its mate) | `components/KingAttack.tsx`, `KING_ATTACK`, `KING_ATTACKERS`, `bossTurnShowMs` (`boss-timing.ts`), `KingAttackKit` (`kits.ts`), `LastStand.tsx`, `screens/Boss.tsx` | its kit's `kingAttack` (Hollow: `HOLLOW_ATTACK` in `hollow.ts`, `lashHit` in `effects/hollow.ts`, `hollowLash`; Alfil: `ALFIL_ATTACK`, `ankusHit`; Sawyer: `SAWYER_ATTACK`, `sawHit` in `effects/sawyer.ts`; Wrangler: `PIG_ATTACK`, `lassoHit` in `effects/pig.ts`; Boingo: `CLOWN_ATTACK`, `pieHit` in `effects/boingo.ts`; Big Boy: `BIGBOY_ATTACK`, `bonkHit` in `effects/bigboy.ts`; Ginger: `GINGER_ATTACK`, `frostHit` in `effects/ginger.ts`; Jefferson: `GREX_ATTACK`, `popHit` in `effects/grex.ts`; Chub & Chirp: `HOPPER_ATTACK`, `carrotHit` in `effects/hopper.ts`; their frames: `attack-frame.ts`; each hit's frames: `hitAnims` in `effects/common.ts`) |

### The base boss (`packages/chess/src/bosses/base.ts`)

A boss's rules are a `BossRules` object; every hook sees only its own boss's battles and its own state:

| Hook | What it does | Who uses it |
| --- | --- | --- |
| `id` | Its `BOSS_ROSTER` id | all |
| `wearOff(next, t)` | As a crowd turn begins, first: what wore off | Ginger (ice), Boingo (pie), Big Boy (block) |
| `ultimate(next, t)` | The ultimate's step until it has come: true when it comes now. `warnThenUnleash` is the usual one (warn, then the next turn) | all |
| `ultimateOnHisTurn` | It comes at the start of the boss's turn instead (the test trigger waits for it) | Hollow, Big Boy |
| `triggerAtHisTurn` | The test trigger is worked out at his turn, after his move: kept until its ultimate comes | Wrangler |
| `ultimateOnce` | Its ultimate comes once a battle: afterwards the meter is off (none shown, nothing gathers), the test trigger refuses and the admins' button goes | Chub & Chirp (the Carrot Patch) |
| `ultimateMax` | Its ultimate comes at most this many times a battle: after the last, as `ultimateOnce` (`ultimateSpent` in `boss-powers.ts`) | Smudgy (Repaint, `repaintMax`) |
| `meter(p, turn, s)` | A meter of its own instead of the rage meter (0-1; null: none shown); the King's strike adds nothing to it | Wrangler (his moves fill it), the Hidden Boss (turn 1 to `bulletTurn`) |
| `blocksKing` | The God King's help doesn't work against it: his move, strike and Last Stand never come; a player's try spends its charge (`kingTried`) | the Hidden Boss |
| `noStrikes` | It never strikes the crowd: no knockouts (`bossKillDue`), no count to a strike on screen (`strikeIn` null) | the Hidden Boss |
| `turnBegun(b)` | In the match, once a crowd turn has been set up | the Hidden Boss (every bank the bullet bank as his ultimate comes) |
| `fallMs` | Beaten: the board holds this long for its fall before the result, solo and online (the lobby's `fall`) | the Hidden Boss (4.5 s) |
| `everyTurn(next, t)` | Every turn after the ultimate's step | Jefferson (the barrage), Sawyer (the split's moment), the Hidden Boss (his increment's moment, once) |
| `passive(next, t)` | The passive's step (it waits a turn if the ultimate came now) | all |
| `crowdFilter`, `bossStops` | Its limits on the crowd's and the boss's moves (the dispatcher lifts them if none are left) | Ginger, Boingo, Big Boy, Sawyer (his first move a pawn's; the cuts), Smudgy (his forced moves; the hidden rook's pawn moves; the crowd's moves legal on the board it sees too) |
| `powerTurn` | A turn its powers touch doesn't count for fair play (nor, from the runner, one where its judge changed the engine's best move's score) | all but Hollow (Sawyer: a cut or the board saw on) |
| `iced` | The squares that show ice | Ginger |
| `judge` | What the judge must score too, how it ranks and reads moves; `offer`: the moves the bots may pick besides the top moves | Jefferson (fire), Chub & Chirp (the Carrot Patch's race: the pulls offered too) |
| `afterCrowdMove(b, move)` | After any crowd move, in the match | Jefferson (the burn), Sawyer (the halves follow) |
| `afterBossMove(b, move, extras)` | After the boss's own move, in the match, before the crowd's turn is set up; `extras`: what his turn worked out besides the move (the host's answer online) | Sawyer (the split: a base on the board; the halves follow), Wrangler (the pull, a drag or the showdown's line-up, each checked) |
| `specialMove(boss, fen, move)` | A boss move its rules play as something else, with its name on screen | Wrangler (the long pull: the double step, then the base) |
| `bestReply(boss, board)` | The boss's move now is a follow-up its power's engine search scored: the engine's best at full strength (`bossMoveKind` "best"), never the brain's, a slip or a stumble | Wrangler (his reply to the showdown's duel, and his next moves while its tactics are live) |
| `asks(boss, fen)` | What the boss's turn must work out with the engine besides its move (the server asks the host with the move) | Wrangler (his pulls, a drag, the showdown) |
| `scoreRound(b, players)` | Its own costs on a round's scores | Hollow (dark tries) |
| `opening` | `fromStart`, `crowdWhite`, `setUp` before move 1 | Hollow, Big Boy (the snack), Sawyer (his cuts from turn 3) |
| `view(p)` | Its fields for the screens (`NetBossPowers`) | Hollow, Big Boy, Sawyer, Wrangler (his meter `ready`, the `scout` cue) |

A boss's screen file fills in a `BossUi` (`components/PowerParts.tsx`): its moments by event kind (`order`, `kit` moment, `dock` words where no banner says what it means, `appearAt`, `own` screen, `line`, `lineAt`, `priority`, `view`), its ultimate's name for the warning, an optional `bar` piece by the rage meter and its `board` layer. A moment's line is said for it (its kit's line for the moment, as the moment begins, an ultimate's critical): a view never draws a boss's words itself. While a moment plays the boss's figure leaves its spot (it steps up to cast), unless the view's root has `pm-stay` (a moment it doesn't cast in: Ginger's thaw).

### Adding a boss

**What the shared test kit gives for free** (Oct 18; docs/decisions/2026-10-18-boss-test-kit.md). A boss on
`BOSS_ROSTER` with powers is covered with no edit, hidden or not:

- `packages/chess/test/boss-kit.test.ts` (driver and checks: `boss-kit-lib.ts`): three short seeded battles (his passive
  switched on early; his ultimate switched on early and the admins' trigger pulled again and again; a stress start with
  his pawn nose to nose with yours on your third rank), and after every step: a position Stockfish 19 plays (no pawn on
  rank 1 or 8, at most 8 pawns and 16 pieces a side, the side not to move never in check, the en passant square only
  where Stockfish keeps it); chess.js's legal moves equal Stockfish's wherever a power made the position; a round's
  scored moves legal and listed once; a move for whoever is to move, and a power's limit leaving one; the replay from
  the base reproducing the position; no step at the start of his turn handing him a promotion for his very next move;
  a power's declared win beating a draw on the same move; its moments coming before the result.
- `packages/server/test/boss-kit-parity.test.ts`: the same battle solo and online (the lobby, a host answering as the
  app's does): the same positions, power events and result.
- `e2e/boss-smoke.spec.ts` (once he's playable): his tile, a battle through the test switches, his passive and his
  ultimate (the admins' trigger), no page errors, on a phone.

**What a new boss must still add:** his own rule tests (`packages/chess/test/<boss>.test.ts`: his rules' numbers from
his sheet, his guards, the judge's view, his moments), a lobby test only for a request or message of his own, app tests
for his character and moments, and `e2e/<boss>.spec.ts` for what his powers show. Three things the kit needs from him:

- a power that decides the battle names its event `<something>Win` (as `carrotWin`): the kit's result checks key on it;
- a new kind of step at the start of his turn (a runner method `…Due` or `…Step`) goes into the kit's driver
  (`KNOWN_STEPS` and `runBattle` in `boss-kit-lib.ts`, the parity test's `solo` and its host): the kit fails until it does;
- his passive's event in `PASSIVE_EVENTS` (`e2e/boss-smoke.spec.ts`): the smoke test fails with what to add.

**An opt-out:** only where his sheet says a power may hand him a promotion for his very next move: his id and the
sheet's words in `PROMOTION_OPT_OUT` (`boss-kit-lib.ts`), with the decision file. It's empty.

1. **Design it** with Eric (opening, passive, ultimate) and record it in `DECISIONS.md`.
2. **Template** (`packages/core/src/boss.ts`): its line in `BOSS_ROSTER` (id, name, icon, kit name, offset, powers); new power ids in `PowerId` and `POWER_IDS`, new moment kinds in `PowerEventKind`, its state's fields in `BossPowerState`.
3. **Numbers** in `BOSS_POWERS` (`packages/core/src/settings.ts`): every tunable stays there.
4. **Rules**: `packages/chess/src/bosses/<boss>.ts` with its `BossRules` (start from the closest boss's file), its choose functions (seeded with `powerRoll`), its moments' lengths (`<BOSS>_FX`) and any beats the server and screens share. Register it: one line each in `bosses/index.ts`, `boss-powers.ts` (`export *`) and `boss-timing.ts` (`POWER_FX`). Its screen fields go in `NetBossPowers` (`protocol.ts`) and its `view` hook.
5. **Character and art**: `characters/<boss>.ts` (+ sounds), in `characters/index.ts` and `BOSS_KITS` (`kits.ts`); its effects in `characters/effects/<boss>.ts`, in `effects.ts` and `power-art.ts`'s `EFFECTS`; its moments in `power-art.ts`.
6. **Screen**: `components/<Boss>.tsx` with its `BossUi`; add it to `BOSS_UI` and `MOMENT_UI` in `BossPowers.tsx` (the compiler names any moment kind without a view). Its power words in `power-words.ts` (the compiler names a missing one). Its lines need nothing more: its kit's lines for each moment are said into its voice and held by the speech rule (`speech.tsx`); give a moment `lineAt` if the boss speaks partway through it, and say any other line with `bossVoice.say` (or `<Say>`), never in a box of its own.
7. **Only if it has a moment of its own beyond these** (and these still mean shared edits, because they're protocol):
   - one the host's engine plays (like the extra move, the bounce): a `<boss>Battle` with one-line runner methods, the lobby's request, answer and timeout (`lobby.ts`, `bossKind`), the host's handler (`net.ts`) and solo's (`solo.ts`), and the request's flag in `protocol.ts`; one worked out alongside the boss's own move (Wrangler's): `asks` and `afterBossMove`'s extras (see "An engine-shaped power"); a reply of the boss's that its search scored: `bestReply` (the engine plays it, never the brain);
   - one the server times (like Lights out): `packages/server/src/bosses/<boss>.ts` on `BossLobby`, routed from `lobby.ts`, its messages in `protocol.ts`, and solo's timing in `solo.ts`;
   - anything that changes the board the boss screen shows, or the intro (like the funhouse's turns, the bounce, the burn, Hollow's claim, Big Boy's snack, Sawyer's split): `screens/Boss.tsx`.
   - a boss whose screens draw a position other than the game's (Smudgy's rook drawn as a pawn): one function draws it for every screen (`camo.ts`'s `seenFen`; `Board.tsx` calls it), the names of moves go through the same (`seenSan`), and the page's tests read the board from the page against the game; chess.js throws on a pawn on rank 1 or 8, so code that reads a drawn position catches it;
   - anything that changes the position outside a move leaves a base (`afterCrowdMove`, `afterBossMove`, or the boss's own moment), and never a position the engine refuses (`stockfishRefuses`: a ninth pawn of one side, more pieces than promotions could make, the side not to move in check, …).
8. **Its attack on a king** (optional; the boss keeps today's Last Stand and mate without one): see "A boss's attack on
   a king" above.
9. **Tests**: the shared kit covers the ground rules (above); add `packages/chess/test/<boss>.test.ts` (his rules and his sheet's numbers, the judge's view), a lobby test in `packages/server/test/boss-powers-lobby.test.ts` for any request of his own, app tests for its character and moments, `e2e/<boss>.spec.ts`. Watch it frame by frame (`npm run frames:powers`, or a `frames-<boss>.mjs`), run `npm run perf:boss -- <dir> <boss id> both 25`, and give Eric the test links (`?boss=<id>`, `?power=<ultimate>`).
10. **Docs**: its row in the table above, its block in the FAQ (`BOSS_BLOCKS` in `packages/app/src/faq/content.ts`:
    its opening, passive and ultimate in a player's words; `faq.test.ts` fails without it), and this checklist if the
    shape changed. A change to any boss's rules changes its FAQ block in the same PR.

## Settings

`BOSS_POWERS` in `packages/core/src/settings.ts` (every power's numbers, Alfil's `tusks*` and `slam*`, Chub & Chirp's `hopMax`, `hopNodes` and `carrot*`, Smudgy's `camo*` and `repaint*` among them; the meter: `rageFull`, `ragePerMove`,
`rageAheadMax`, `rageAheadFull`, `ragePerMaterial`, `rageStrike`, `rageSpeed` by boss), `SAWYER_LOOKS` (how his split
looks), the `boss*` keys of `Settings`,
`BOSS_DIFFICULTY`, `BOSS_BRAIN` (every boss's brain, Maia's rating and the crowd's margin, the bridge band, its
sampling, the guards, `forPlayers`), `BOSS_TIERS` and each boss's `offset` in `boss.ts`.

## Tests and tools

- The shared boss test kit (every boss in the roster, no edit per boss): `packages/chess/test/boss-kit.test.ts` (with
  `boss-kit-lib.ts`; `KIT_SEEDS=<n>` for more seeds by hand), `packages/server/test/boss-kit-parity.test.ts` (solo and
  online agree), `e2e/boss-smoke.spec.ts` (every playable boss on a phone, the first on a computer). What each checks:
  "Adding a boss" above.
- Unit, the brain: `packages/chess/test/boss-brain.test.ts` (the rule, the bridge, the guards, the fallbacks),
  `maia-bosses.test.ts` (every boss's Maia path: its powers' limits kept, its special moves untouched),
  `boss-power-legal.test.ts` (Eric's Oct 17 position; every power that stops the boss × every brain path; the last
  checks; `stopReason`), `packages/app/test/refused.test.ts` (the dock's words), the online
  brain in `packages/server/test/boss-powers-lobby.test.ts`; the Maia box's own tests in `packages/maia-worker/test/`.
  e2e: `e2e/maia.spec.ts` (every boss on Maia for an admin; an online raid on Maia; players never load it). Sims:
  `packages/sim/scripts/maia-calibration.ts` (`reports/maia-calibration.md`), `maia-sim.ts` (`reports/maia-boss.md`).
- Unit, Ginger's blizzard: `packages/chess/test/ginger.test.ts` (its three turns, the thaw's count, the mercy rule,
  the seed, the meter and the freeze waiting, the match runner's view through the boss's turn); the thin ice and the
  thaw's banner in `packages/app/test/gingerbread.test.ts`; online in `boss-powers-lobby.test.ts`.
- Unit: `packages/chess/test/boss-powers.test.ts` (Boingo's pies, the funhouse's steps and its move: once a funhouse,
  unscored, its loss band and cap, among them), `rage.test.ts`
  (every boss's ultimate again and again, never two at once), `packages/app/test/board-view.test.ts` (the turned
  board's squares, moves and coordinates), `grex.test.ts` (the meter), `hollow.test.ts`, `bigboy.test.ts`, `sawyer.test.ts`,
  `long-match.test.ts`, `pig.test.ts` (Wrangler: the pull, the drag's rules and band, the line-up's kinds, zone,
  substitutes and checks, Eric's goal and the distance from it, the search (three pairs, then two; new line-ups each
  round; none in a decided battle) and the scout kept across turns, his meter (his moves only; not a strike), firing when full and a line-up qualifies, playing on when none
  does, the cap, the test trigger outside the band, the forced duel, his reply and next moves on Maia at 600 with slips
  on (a two-capture line completed), host and solo agreeing),
  `packages/core/test/boss.test.ts`, `packages/server/test/boss-powers-lobby.test.ts` ("Wrangler online": the
  showdown asked with his meter full, no warning or "Not yet...", the trigger's `test` and `outside`, his reply and next
  moves asked as `best` without the brain), `maia-bosses.test.ts`, `rage.test.ts` (his trigger again and again),
  `packages/app/test/boss-kits.test.ts`, `characters.test.ts`, `boss-character.test.ts`, `gingerbread.test.ts`,
  `grex.test.ts`, `hollow.test.ts`, `bigboy.test.ts`, `sawyer.test.ts`, `pig.test.ts`, `fire-replays.test.ts`, `power-words.test.ts`.
- Unit, Alfil: `packages/chess/test/alfil.test.ts` (live: playable, met at random and by name; the cast's pair, the
  guards (his king never left attacked, no check given, nothing left hanging, a position the engine plays), his turns, the schedule and the
  cap of two; the counter (en passant too); the marks and elephants following their pieces; the fusion's engine pick
  (the best for him, however much, scored with the crowd to move; no answer: the first square); the fusion as his move (no move after it, its moment with the crowd's turn, his turns counted on, no stalemate by a power, no dead draw, a mate threat it makes allowed, the move number); in check, the fusion waits; the God King's strike on a fusion; the Slam's lifts (never a queen, rook or king, fewer, never a blocker, a check he's in doesn't stop it, never one added), a Slam that lifts nothing keeping the meter, the trigger during a step; its swing
  cap played out by the engine, the landing's own squares and fallbacks (color, rank, check, hanging, a move left, the en passant square), the
  early landing against a mate in one, the last move's clamp; when (the warning, the trigger), the view's fields, the
  timing, the ground rules over many battles, a restored runner), `packages/server/test/boss-powers-lobby.test.ts`
  ("Alfil online": the cast, the fusion (his move: no move after it) and the Slam on the host's pick; "" or junk or no
  answer: nothing lifts, the meter kept, asked again his next turn; the trigger, and the trigger while the host weighs his cast; the landing guard's pieces, `land`, with his move just before they land only), `packages/chess/test/maia-bosses.test.ts` (his steps keep the engine's picks; Maia within the rest),
  `packages/chess/test/alfil-landing.test.ts` (the landing guard: Eric's queen walking into a landing pawn, before and
  after, on the real engine and in a battle; never an illegal move; nothing more searched when nothing lands next; his
  fusion weighed with them down),
  `packages/app/test/alfil.test.ts` (his kit, lines and sounds; his beats against his animations' cues; which moment
  plays where; the board under his moments, `alfilFen`; the dock's lines; the early landing; his FAQ block),
  `king-attack.test.ts` (his ankus's jabs); e2e `e2e/alfil.spec.ts` (his cast with its banner and glow, the fusion's
  rise, flash, elephant and dock line, the elephant drawn on its square; the Slam's banner, shake, flying pieces,
  shadows growing 1 to 3 and the landing; his tile, stage and figure at 320 px and 1280 px; phone and computer).
  Frame by frame: `npm run frames:alfil -- <dir> [tusks|slam|both] [phone|desktop] [light|dark]`.
- Unit, Smudgy: `packages/chess/test/smudgy.test.ts` (the roster line and his numbers; the forced moves for either color, the side's pick and every fallback, the turns missed and Camouflage given up; the swap's positions; the hidden rook's pawn-shaped moves only until its strike, then any; every reveal; a move refused for the hidden rook ("paint") and the crowd's moves legal on both boards; the judge's and the bots' moves within them; Repaint's hard rules, its band, his whole turn, the wait and the cap; a small fuzz of whole battles), `packages/app/test/faq.test.ts` (his block, for when he's playable); `packages/app/test/camo.test.ts` (real battles on both sides: the hidden rook a pawn in every position and every position of the history, its steps named as a pawn's, the dots a superset of the moves allowed, nothing masked after the reveal or the result; the refused move's line), `packages/app/test/smudgy-wired.test.ts` (his kit, the 42 lines as written, the sounds' levels, his beats against his animations' cues, the board under each moment, the splash the same whichever pawn hides the rook), `packages/server/test/smudgy-lobby.test.ts` (the home page's live window masked); e2e `e2e/smudgy.spec.ts` (the tile, the forced moves, the splash frame by frame and the swap under it; the masked board read from the page against the game, in every position of the history; the refused move's line and the second pick; the strike, the capture of the hidden rook and Repaint frame by frame; the layout at 320, 360, 390 and 1280), `e2e/king-attack.spec.ts`, `e2e/boss-speech.spec.ts`, `e2e/boss-select.spec.ts`, `e2e/boss-smoke.spec.ts`. The kit's driver plays his Repaint (`repaintDue`). Sims: `reports/smudgy-sim.md`.
- Unit, Chub & Chirp: `packages/chess/test/hopper.test.ts` (live: at random, on every menu, by name; the name; the hop: nose to nose only, either way up, the square beyond taken, the back rank and the rank before it
  (the review's 1.e3 e5 2.a3 e4 3.a4, both ways up), freeing a pinned pawn to promote, a pinned pawn, in check, giving
  check (the pawn or a line it opens), no move after it, a mate in one it would give him; the en passant square cleared,
  the fifty-move count, castling and the move number; several at once; the engine's pick (`hopFrom`; none: the first); in
  a battle: the base at its ply, its moment with his turn's, one a turn (even with three more that could), then his move,
  fair play; the review's line (no hop, no promotion); the cap of two; the view's `hop`; QUEEN SLAIN! not again after it;
  a restored runner; the test switch's start, every first move leaving the hop due; a fuzz of 10 battles: every position
  legal, replayable, the engine's, never the last two ranks or a new promotion),
  `packages/server/test/boss-powers-lobby.test.ts` ("Chub & Chirp online": one pawn hops at once, no host asked, his move
  asked on the new position; several: the host's pick, no move list or brain; junk, "" or no answer: the first; the test
  trigger bringing the Carrot Patch before any hop, the host asked only its pass guard), `maia-bosses.test.ts` (his hop keeps the engine's pick, his cast's
  pass guard asks no Maia, his race brain's swaps named; Maia within the rest), `packages/app/test/hopper.test.ts` (live: the kit, the
  60 lines and their caps, the sounds' levels, the select screen, the FAQ block, every beat against its animation's cue,
  the moments and their lines, your pull, the board under the moments, the carrots on the board), `carrot-race.test.ts`
  (the ladder's words; the reel's strip at each count's odds, all blank at 0, all two queens at 4, spread out, the stop on
  the rolled prize, no near-miss bias over 2,000 spins), `hopper-art.test.ts` (the art's own checks); e2e
  `e2e/hopper.spec.ts` (the test switches, phone and computer: the hop's pawn frame by frame, on its square until the
  takeoff, in the air, landed, then his move from the base; with `?carrots=2`, the cast with its banner, flights, carrots
  and ladder, the dock's count, pulls by both sides (yours popping and counted), the reel stopping on his roll with only
  his count's prizes, the prize on the board; his fifth carrot with `?carrots=5`: counted, "FIVE CARROTS!", the results' line; their tile, stage, figure
  and the dock's count at 320 px and 1280 px). Frame by frame: `npm run frames:hopper -- <dir> [hop|carrots|tile|all]
  [phone|desktop] [light|dark] [chase|ignore]`. Sims: `reports/hopper-sim.md`. The pass guard (Alfil's fusion and the Carrot Patch's cast): `packages/chess/test/pass-guard.test.ts`.
- Unit, the Carrot Patch: `packages/chess/test/carrots.test.ts` (the trigger: the warning, the switch, the admins'
  trigger, once a battle, the meter off after; the cast as his whole turn: the en passant square, the fifty-move count,
  the move number, the base, its moment; in check it waits; the math: `reachMap`'s pawn and blocker rules; five squares,
  both halves, none touching, the same position and seed the same; the leads; the race: pulls by a move, a capture (en
  passant), a castling rook, his hop (and its cap), never a hop that wins or sets up his win, the end by all pulled or by
  moves, his 5th carrot (the results' reason, its moments even when it stalemates or mates, his brain takes it, a mating
  one first in his order), no spin when the battle ends first; the spin: the sheet's odds over 20,000 seeds, seeded;
  prize squares, never check, the nearest square, a bishop's color on his rows and on the nearest; the engines' limits
  and the step down; what the race is worth: one at a time, the judge's ranking and evaluation, his brain's preference
  for a safe carrot and not a costly one, never a stronger chess move in disguise, his strength; the bots and a judge's
  job; the God King's strike and Last Stand, QUEEN SLAIN!, fair play (a race turn counted only where the engine's best is
  the race's, on the engine's numbers, with real Stockfish cases), the view, a restored runner; a fuzz of 12 battles),
  the lobby's "Chub & Chirp online (the Carrot Patch)" (the cast with no host asked, the same on every screen; the race
  in the score jobs and the boss request; junk or no answer; the server's spin; the carrot win in the results, and a
  stalemating one's moments before them; fair play's record on a counted race turn),
  `packages/app/test/race-eval-bar.test.ts` (the eval bar during the race: the engine's own evaluation, solo and
  online). Sims: `reports/hopper-carrots-sim.md`.
- Unit, a boss's attack on a king: `packages/chess/test/king-attack.test.ts` (the beats, the Last Stand's fit, the
  mate's hold, the mate switch), `packages/app/test/king-attack.test.ts` (the kit, Hollow's frames on the beats, the God
  King's blows, the hits; Sawyer's, Wrangler's, Boingo's, Big Boy's, Ginger's, Jefferson's and Chub & Chirp's: cues on the hits, reach,
  body clear, frame edges and palette, hit effects, the hits' sounds together; every attacker's face toward the king;
  its place at all 64 squares both ways up: `kingAttackPlace`).
- e2e, the Boss raid screen's select: `e2e/boss-select.spec.ts`; unit `packages/app/test/boss-select.test.ts` (every
  boss's sound from its own pack, its own lines, none twice running, the Hidden Boss's in turn).
- e2e: `e2e/pig.spec.ts` (Wrangler: the long pull, a drag, his meter's line and ready loop, a showdown with no warning,
  its forced duel and his reply (the engine's best), phone and computer, solo and online; the admins' trigger),
  `e2e/sawyer.spec.ts` "Sawyer's board saw on Maia" (his five replies under the saw never across it, a move of yours
  across it refused with the dock's words) and "Sawyer's board saw lifted for his only move" (Eric's position set on
  the runner: Qxb7 refused, Nf6+, his Qxf6 across the saw, and "His only move: across the saw." on every frame of your
  turn, whole at 320 px), `e2e/boss-powers.spec.ts` "Boingo's funhouse at every angle" (a move by tap and by drag, touch on the phone, at
  0°, 180°, 90° and 270°; the coordinates and pies on their squares at each), `e2e/king-attack.spec.ts` (Hollow's mate and his attack in the Last Stand, every frame; Sawyer's, Wrangler's, Boingo's, Big Boy's, Ginger's, Jefferson's and Chub & Chirp's in the Last Stand: every hit, his frame on screen, his sounds, no page errors), `e2e/boss-powers.spec.ts`, `grex.spec.ts`, `hollow.spec.ts`, `bigboy.spec.ts`, `sawyer.spec.ts`, `boss-character.spec.ts`,
  `boss-speech.spec.ts` (one moment of each boss: its line held whole and in view for its full time, every frame, and
  gone on time),
  `perf.spec.ts`. Unit: `packages/app/test/speech.test.ts` (the speech rule).
- Frames: `npm run frames:king-attack -- <dir> [hollow|alfil|sawyer|pig|clown|gingerbread|grex|bigboy] [phone|desktop|both] [laststand|mate|both] [light|dark] [gif] [width] [sq=a8|h8|e8|a1|h1] [stills]`
  (`sq=`: a position set first so your move, and the God King, land on that square: the attack at the board's corners
  and top)
  (the page's clock paused and stepped 40 ms at a time: every frame of the attack),
  `npm run frames:powers -- <dir> [gingerbread|clown|grex|all|both] [phone|desktop|both] [light|dark] [moves] [desktop
  width]` (Ginger: the blizzard, both thaws and the boss's turns between them, six moves by default), `frames:hollow`,
  `frames:bigboy`, `frames:sawyer`, `frames:pig -- <dir> [phone|desktop|both] [light|dark] [side=b] [power=drag]` (his
  long pull, his meter filling, SHOWDOWN! and the duels, then a drag), `frames:character -- <dir> [boss] [phone|desktop|both]`, `frames:wip`,
  `frames:rage -- <dir> [boss] [phone|desktop] [moves] [strikes]` (the rage meter: strikes, the warning, the
  ultimate, its slide down and refill, every frame, with the meter's own numbers sampled each frame).
- Previews: `npm run preview:characters -- <dir>` (GIFs and sheets of every boss and effect; `only=pig` for Wrangler).
  The Hidden Boss's bust and his book (art only, not shown) aren't in the character lists: add
  `extra=packages/app/src/characters/recluse.ts only=recluse,recluse-bust,recluse-book`.
- The Hidden Boss in the Crowd's final: `packages/chess/test/crowd.test.ts` ("50 v 50 boss final"),
  `packages/server/test/crowd-hidden-boss.test.ts` (online), e2e `e2e/crowd-hidden.spec.ts`; [crowd.md](crowd.md).
- The Hidden Boss: unit `packages/chess/test/recluse.test.ts` (hidden from players, his brain, the bullet clock and
  its increment, the loss on time, the God King blocked and a try spending its charge, no strikes), `packages/chess/test/recluse-phase2.test.ts` (phase 2's starts, ply-0 bases,
  clocks, time, resign, all four must win, the Stockfish-only brain), `packages/app/test/recluse-phase2.test.ts` (the
  phase change's beats and its one book, the absorption's (his figure run, the God King's look at each moment and gone
  for good, his triumph giving way to his cry), the arcs, the four boards driven, his lines, the God King silent in
  phase 2), `packages/app/test/recluse-talk.test.ts` (his chatter: long simulated phase 1 and phase 2 fights at real move
  timing, its stages, never over another line, when he may talk),
  frames `npm run frames:recluse2 -- <dir> [phone|desktop|both] [light|dark] [only=change]` (phase 2; the phase change
  alone with `only=change`), `packages/app/test/recluse-boss.test.ts` (kit, collapse loop, the run in place,
  the mocks, the quotes word for word, sounds), `recluse.test.ts` (art); e2e `e2e/recluse.spec.ts` (with his chatter
  logged over about three minutes of a played phase 1); frames
  `npm run frames:recluse -- <dir> [phone|desktop|both] [light|dark] [base=…]` (needs `npx wrangler dev`: an admin's fight,
  then `?win=1`'s collapse). Test switch `?win=1` (solo: you mate in one, to see a boss beaten).
- Perf: `npm run perf:boss -- <dir> <boss id> [phone|desktop|both] 25`.
- Sims: `packages/sim/scripts/showdown-sim.ts` (Wrangler's showdowns in real battles: a crowd of bots at three
  strengths, his scout and his turn's search at a computer's or a phone's budget; showdowns a battle, when, the wait
  after his meter fills, sizes, edges, the engine's moves after the duel, and the positions his full meter waited in;
  `reports/boss-sim/showdown-*.jsonl`),
  `packages/sim/scripts/boss-sim.ts` (modes `snack`, Big Boy's; `split`, Sawyer's; `raid <boss,ids|all> <games>
  <seed> <strikes> <tag> [patch]`: Solo raids of 50 bots with every power through the match runner, ultimates per game
  and the crowd's results, `raid-summary <tags>` for the table; a boss whose art isn't built yet met as its test link
  does; the boss's tier and strength in each row; Alfil's casts, fusions, counters and slams logged; Chub & Chirp's hops, and each pawn nose to nose that couldn't hop by why; their Carrot Patch's cast (the carrots and
  their leads), pulls, end, spin and race brain, and `cast` ([from, to]) for a forced cast at a crowd turn in that range,
  the battle stopped after the race (`reports/hopper-carrots-sim.md`); `patch` (JSON) for tuning runs: numbers over BOSS_POWERS, a
  boss's offset, and `counter`: a crowd that takes Alfil's marked pawn when it costs at most that many pawns; Alfil's
  calibration: `reports/alfil-sim.md`: as first built he won every battle; with the fusion as his move (V1) the crowd
  scores 0.23, inside the pack; the sim isn't repeatable seed for seed (Stockfish's UCI_Elo moves), so runs compare by
  their totals; each row also lists the landing guard's looks (`alfil.landing`: his pick, the move played, positions
  searched, ms) and the fusions weighed with the pieces down (`fuseLanding`)),
  `boss-blunders.ts` (`reports/boss-sim/`, `reports/boss-calibration.md`).

## Rules for this area (from `.claude/LESSONS.md`)

- A search in rounds carries its source on from round to round, and a power that fires only when a search finds
  something is measured in real battles on a phone's budget before it ships (`showdown-sim.ts`; Oct 13, "A showdown
  that never came").
- A limit that refuses a move, or lifts for one (the only way out of check), says so on screen in the power's words
  (`refused.ts`; Oct 17, "A saw the boss crossed"): a piece that only goes back, or a boss crossing his own saw, reads
  as a glitch. A new power that stops moves gives `BossRules.stopReason` and its words in `REFUSED` and `THROUGH`.
- A power's follow-up move that the engine scored must be played by the engine (`BossRules.bestReply`): when a power's
  search scores an outcome on the boss's best reply, his brain (Maia, a slip) never plays that reply (Oct 13, "A queen
  won for free").

- No power may make a position the engine (Stockfish 19, everywhere) refuses: a ninth pawn of one side, more pieces
  than promotions could make, the side not to move in check (`stockfishRefuses` in `uci.ts` has its rules). The engine
  never sends one (no lines, or "no move"), so a power that made one would leave the boss and the judge blind there.
  Sawyer's split waits for room (`splitRoom`, promotions counted).

- Anything that changes the position outside a move (a burn, a snack, a bounce) leaves a base, and nothing replays a
  board's history from move 0: use `fenAtPly(history, ply, bases)`. Grep for `fenAfter(` and `.history` and check each.
- Never change what the board draws (orientation, size) while a transform is on it or an ancestor.
- An effect that can appear many times at once goes on a shared canvas (`BoardEffects`), never a loop per sprite.
- Measure a new effect's first showing on a slowed phone; draw many new frames ahead, a slice a frame; make a boss's
  sounds before their cue; nothing a boss needs only in its battle is made when the app loads.
- Nothing read while rendering may grow with the match; run `npm run perf:boss` late in the match.
- A boss screen draws every frame only what moves with its clock (the board and what's over it). Something new that
  changes with time inside the header, the boss's figure, the chat or the dock draws itself (its own `useFrameNow`,
  a timer, or a CSS animation), or, for the dock's words, joins the dock's list of clock-read values in `Boss.tsx`;
  otherwise it waits up to 200 ms for the next `useStillKey` tick.
- Tables keyed by a closed set (powers, events) are typed by it (`Record<PowerId, …>`).
- Text a player must read to play (Lights out's prompt) stays on screen as long as it applies, outside the speech box.
- A boss's words go into its voice (`speech.tsx`), never into a box a screen or a moment owns: a line lives as long as
  the rule says, not as long as the screen that said it. Nothing hides a speech box to make it fit: it shrinks, then
  moves into view. Test a line's whole time on screen, every frame (`e2e/boss-speech.spec.ts`).
- A power's moment that shows something for less than about a second (a thaw's melt) is checked by watching for it from
  before the boss's move (`watchFor`, `watchSquares`), never by `toBeVisible` after its banner: its looks are up to a
  second apart (Oct 12, "A melt the test blinked through").
