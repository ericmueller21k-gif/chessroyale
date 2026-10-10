# Decisions

Judgement calls made while building, with the reason for each. Eric asked to be involved as little as possible, so
these weren't reviewed first. Most are a single line in `packages/core/src/settings.ts`.

## How this file works (Oct 10, 2026)

- **How things work today** is in [`docs/areas/`](docs/areas/README.md), one page per area. Read that first.
- **Why things are the way they are** is the decisions. Every decision up to Oct 10, 2026 now lives, word for word,
  in its area's file in [`docs/history/`](docs/history/). The index below lists each one, in the order it was made,
  and links to it. Code comments that cite `DECISIONS.md, "<section>"` still lead there: find the section's title
  below.
- **New decisions go at the end of this file**, under "New decisions": one section each, with the date and the
  reason, as before. Add to your own lane's sections rather than rewriting others'.
- **When a decision changes how an area works,** update its page in `docs/areas/` in the same PR.
- **When this file grows long again** (a month or so of new decisions), move the new sections, unchanged, to the end
  of their area's `docs/history/` file and list them in the index.

## Index: decisions up to Oct 10, 2026

### Bosses and their powers

In [`docs/history/bosses.md`](docs/history/bosses.md). How it works today: [`docs/areas/bosses.md`](docs/areas/bosses.md).

- [Boss raid: a mode of its own (Oct 4, 2026)](docs/history/bosses.md#boss-raid-a-mode-of-its-own-oct-4-2026)
- [Ten boss tiers (Oct 5, 2026)](docs/history/bosses.md#ten-boss-tiers-oct-5-2026)
- [Bosses never throw pieces away (Oct 5, 2026)](docs/history/bosses.md#bosses-never-throw-pieces-away-oct-5-2026)
- [Pick your boss (Oct 5, 2026)](docs/history/bosses.md#pick-your-boss-oct-5-2026)
- [The boss menu comes first (Oct 5, 2026)](docs/history/bosses.md#the-boss-menu-comes-first-oct-5-2026)
- [A banner when you take the boss's queen (Oct 5, 2026)](docs/history/bosses.md#a-banner-when-you-take-the-bosss-queen-oct-5-2026)
- [A solo boss raid flows like a chess site (Oct 6, 2026)](docs/history/bosses.md#a-solo-boss-raid-flows-like-a-chess-site-oct-6-2026)
- [Boss characters: style test (Oct 8, 2026)](docs/history/bosses.md#boss-characters-style-test-oct-8-2026)
- [Boss powers and the boss raid rework (design, Oct 8, 2026; the template, Freeze, Boingo and G-REX (Fire) built: see below)](docs/history/bosses.md#boss-powers-and-the-boss-raid-rework-design-oct-8-2026-the-template-freeze-boingo-and-g-rex-fire-built-see-below)
- [Lag that grew with the match (Oct 9, 2026)](docs/history/bosses.md#lag-that-grew-with-the-match-oct-9-2026)
- [Two tweaks (Eric, Oct 9, 2026)](docs/history/bosses.md#two-tweaks-eric-oct-9-2026): Ginger freezes more often; the God King keeps his colours in the dock
- [Hollow, the Darkness boss (design, Eric, Oct 9, 2026; calls marked "director's call")](docs/history/bosses.md#hollow-the-darkness-boss-design-eric-oct-9-2026-calls-marked-directors-call)
- [Big Boy, the baby boss (design, Eric, Oct 10, 2026; calls marked "director's call")](docs/history/bosses.md#big-boy-the-baby-boss-design-eric-oct-10-2026-calls-marked-directors-call)

### The God King and the boss battle's presentation

In [`docs/history/god-king.md`](docs/history/god-king.md). How it works today: [`docs/areas/god-king.md`](docs/areas/god-king.md).

- [The God King (Oct 4, 2026)](docs/history/god-king.md#the-god-king-oct-4-2026)
- [The God King, reworked after Eric's first look (Oct 4, 2026)](docs/history/god-king.md#the-god-king-reworked-after-erics-first-look-oct-4-2026)
- [The God King's strike happens during the move; the eval bar holds steady (Oct 4, 2026)](docs/history/god-king.md#the-god-kings-strike-happens-during-the-move-the-eval-bar-holds-steady-oct-4-2026)
- [Boss battle: one fixed dock under the board (Oct 4, 2026)](docs/history/god-king.md#boss-battle-one-fixed-dock-under-the-board-oct-4-2026)
- [Boss intro replays the opening, then "START!"; a fighting-game banner for big moments (Oct 4, 2026)](docs/history/god-king.md#boss-intro-replays-the-opening-then-start-a-fighting-game-banner-for-big-moments-oct-4-2026)
- [The God King stands by the board, talks, and takes commands like a Final Fantasy unit (Oct 4, 2026)](docs/history/god-king.md#the-god-king-stands-by-the-board-talks-and-takes-commands-like-a-final-fantasy-unit-oct-4-2026)
- [The God King, toned down: he's secondary to the chess (Oct 4, 2026)](docs/history/god-king.md#the-god-king-toned-down-hes-secondary-to-the-chess-oct-4-2026)
- [The God King's bubble carries across screens (Oct 5, 2026)](docs/history/god-king.md#the-god-kings-bubble-carries-across-screens-oct-5-2026)
- [The God King's cut-in banner (Oct 5, 2026)](docs/history/god-king.md#the-god-kings-cut-in-banner-oct-5-2026)
- [Boss dock: one row (Oct 5, 2026)](docs/history/god-king.md#boss-dock-one-row-oct-5-2026)
- [The God King's Last Stand (Oct 5, 2026; built)](docs/history/god-king.md#the-god-kings-last-stand-oct-5-2026-built)
- [The Last Stand, after Eric played it (Oct 7, 2026)](docs/history/god-king.md#the-last-stand-after-eric-played-it-oct-7-2026)
- [The God King, redrawn as pixel art (Oct 8, 2026)](docs/history/god-king.md#the-god-king-redrawn-as-pixel-art-oct-8-2026)
- [The God King, polish batch (Eric, Oct 9, 2026)](docs/history/god-king.md#the-god-king-polish-batch-eric-oct-9-2026)

### The match, Crowd and 50 v 50

In [`docs/history/match-and-crowd.md`](docs/history/match-and-crowd.md). How it works today: [`docs/areas/crowd.md`](docs/areas/crowd.md).

- [Milestone 1: match engine and scoring](docs/history/match-and-crowd.md#milestone-1-match-engine-and-scoring)
- [Milestone 2: simulation and playtest report](docs/history/match-and-crowd.md#milestone-2-simulation-and-playtest-report)
- [Milestone 3: solo build](docs/history/match-and-crowd.md#milestone-3-solo-build)
- [Milestone 5: spectating and polish](docs/history/match-and-crowd.md#milestone-5-spectating-and-polish)
- [Changes after Eric's first look (Oct 2, 2026)](docs/history/match-and-crowd.md#changes-after-erics-first-look-oct-2-2026)
- [Round flow, after Eric's first computer test (Oct 2, 2026)](docs/history/match-and-crowd.md#round-flow-after-erics-first-computer-test-oct-2-2026)
- [Which move continues the board, and sounds (Oct 2, 2026)](docs/history/match-and-crowd.md#which-move-continues-the-board-and-sounds-oct-2-2026)
- [Pace, the reveal, history and real piece sounds (Oct 2, 2026)](docs/history/match-and-crowd.md#pace-the-reveal-history-and-real-piece-sounds-oct-2-2026)
- [64 players, one board fewer per cut, and a 2v2 final (Oct 2, 2026)](docs/history/match-and-crowd.md#64-players-one-board-fewer-per-cut-and-a-2v2-final-oct-2-2026)
- [One locked phone screen, every board on top, one countdown style, ticks only (Oct 3, 2026)](docs/history/match-and-crowd.md#one-locked-phone-screen-every-board-on-top-one-countdown-style-ticks-only-oct-3-2026)
- [Cleaner play screen (Oct 3, 2026)](docs/history/match-and-crowd.md#cleaner-play-screen-oct-3-2026)
- [One line of controls, a power-up button, live numbers, a smarter small scoreboard (Oct 3, 2026)](docs/history/match-and-crowd.md#one-line-of-controls-a-power-up-button-live-numbers-a-smarter-small-scoreboard-oct-3-2026)
- [Power-up slots, a centre-closing timer, shorter openings, replay from move 0 (Oct 3, 2026)](docs/history/match-and-crowd.md#power-up-slots-a-centre-closing-timer-shorter-openings-replay-from-move-0-oct-3-2026)
- [Timer bar flush with the board; the reveal reel's sound is back (Oct 3, 2026)](docs/history/match-and-crowd.md#timer-bar-flush-with-the-board-the-reveal-reels-sound-is-back-oct-3-2026)
- ["15 opening moves", a sound lab, and a sound for every board moving (Oct 3, 2026)](docs/history/match-and-crowd.md#15-opening-moves-a-sound-lab-and-a-sound-for-every-board-moving-oct-3-2026)
- [Crowd mode: 100 players, one board (Oct 3, 2026)](docs/history/match-and-crowd.md#crowd-mode-100-players-one-board-oct-3-2026)
- [Crowd: every pick on the board, live tallies, an animations switch (Oct 3, 2026)](docs/history/match-and-crowd.md#crowd-every-pick-on-the-board-live-tallies-an-animations-switch-oct-3-2026)
- [Crowd: no double animation (Oct 3, 2026)](docs/history/match-and-crowd.md#crowd-no-double-animation-oct-3-2026)
- [The board never moves (Oct 3, 2026)](docs/history/match-and-crowd.md#the-board-never-moves-oct-3-2026)
- [50 v 50 revamp: pre-game votes, three endings, a boss, and Play now (Oct 4, 2026)](docs/history/match-and-crowd.md#50-v-50-revamp-pre-game-votes-three-endings-a-boss-and-play-now-oct-4-2026)
- [Crowd pieces: one spot per square (Oct 5, 2026)](docs/history/match-and-crowd.md#crowd-pieces-one-spot-per-square-oct-5-2026)
- [Motion trail, an option (Oct 5, 2026)](docs/history/match-and-crowd.md#motion-trail-an-option-oct-5-2026)
- [One name per square (Oct 5, 2026)](docs/history/match-and-crowd.md#one-name-per-square-oct-5-2026)
- [Elimination breakdown (Oct 5, 2026)](docs/history/match-and-crowd.md#elimination-breakdown-oct-5-2026)
- [The cut as a judgement (Oct 5, 2026)](docs/history/match-and-crowd.md#the-cut-as-a-judgement-oct-5-2026)
- [A crowd of one keeps its move on the board (Oct 6, 2026)](docs/history/match-and-crowd.md#a-crowd-of-one-keeps-its-move-on-the-board-oct-6-2026)
- [No flash between a match's screens (Oct 6, 2026)](docs/history/match-and-crowd.md#no-flash-between-a-matchs-screens-oct-6-2026)
- [e2e: two flaky solo tests (Oct 6, 2026)](docs/history/match-and-crowd.md#e2e-two-flaky-solo-tests-oct-6-2026)
- [Match screen fixes (Oct 7, 2026)](docs/history/match-and-crowd.md#match-screen-fixes-oct-7-2026)
- [Pre-game vote overhaul (Oct 7, 2026)](docs/history/match-and-crowd.md#pre-game-vote-overhaul-oct-7-2026)
- [Match screen: timers, the ring, chat on a computer (Eric, Oct 9, 2026)](docs/history/match-and-crowd.md#match-screen-timers-the-ring-chat-on-a-computer-eric-oct-9-2026)

### Matchmaking, lobbies and ranked

In [`docs/history/matchmaking-and-lobbies.md`](docs/history/matchmaking-and-lobbies.md). How it works today: [`docs/areas/matchmaking.md`](docs/areas/matchmaking.md).

- [Milestone 4: multiplayer lobbies](docs/history/matchmaking-and-lobbies.md#milestone-4-multiplayer-lobbies)
- [Closing finished lobbies (Oct 7, 2026)](docs/history/matchmaking-and-lobbies.md#closing-finished-lobbies-oct-7-2026)
- [Ranked, ratings and matchmaking (draft, Oct 7, 2026; for Eric's review)](docs/history/matchmaking-and-lobbies.md#ranked-ratings-and-matchmaking-draft-oct-7-2026-for-erics-review)
- [Matchmaking types, and when a match counts for ranking (Oct 7, 2026)](docs/history/matchmaking-and-lobbies.md#matchmaking-types-and-when-a-match-counts-for-ranking-oct-7-2026)

### The front door (hub)

In [`docs/history/hub.md`](docs/history/hub.md). How it works today: [`docs/areas/hub.md`](docs/areas/hub.md).

- [The name: HunChess (Oct 4, 2026)](docs/history/hub.md#the-name-hunchess-oct-4-2026)
- [A landing page, online play for signed-in players only, and Crowd first (Oct 4, 2026)](docs/history/hub.md#a-landing-page-online-play-for-signed-in-players-only-and-crowd-first-oct-4-2026)
- [The front door: home, queue, profiles (design, Oct 6, 2026; to build)](docs/history/hub.md#the-front-door-home-queue-profiles-design-oct-6-2026-to-build)

### Accounts and profiles

In [`docs/history/accounts.md`](docs/history/accounts.md). How it works today: [`docs/areas/accounts.md`](docs/areas/accounts.md).

- [Accounts and profiles (Oct 4, 2026)](docs/history/accounts.md#accounts-and-profiles-oct-4-2026)
- [Sign-in secrets in the Secrets Store (Oct 4, 2026)](docs/history/accounts.md#sign-in-secrets-in-the-secrets-store-oct-4-2026)

### Chat

In [`docs/history/chat.md`](docs/history/chat.md). How it works today: [`docs/areas/chat.md`](docs/areas/chat.md).

- [Quick chat in matches (design, Oct 6, 2026; built Oct 7, 2026)](docs/history/chat.md#quick-chat-in-matches-design-oct-6-2026-built-oct-7-2026)

### The shop, crates and the icon builder

In [`docs/history/shop-and-crates.md`](docs/history/shop-and-crates.md). How it works today: [`docs/areas/shop.md`](docs/areas/shop.md).

- [The shop (Oct 5, 2026)](docs/history/shop-and-crates.md#the-shop-oct-5-2026)
- [The pixel icon builder (Oct 5, 2026)](docs/history/shop-and-crates.md#the-pixel-icon-builder-oct-5-2026)
- [Crates: Winter Crate · Series 1 (Oct 5, 2026)](docs/history/shop-and-crates.md#crates-winter-crate--series-1-oct-5-2026)

### The engine and the judge

In [`docs/history/engine.md`](docs/history/engine.md). How it works today: [`docs/areas/engine.md`](docs/areas/engine.md).

- [The engine server: a hybrid (Oct 5, 2026)](docs/history/engine.md#the-engine-server-a-hybrid-oct-5-2026)
- [The re-check of close calls (Oct 5, 2026)](docs/history/engine.md#the-re-check-of-close-calls-oct-5-2026)
- [Brilliant moves (Oct 5, 2026)](docs/history/engine.md#brilliant-moves-oct-5-2026)
- [Many judges (Oct 8, 2026)](docs/history/engine.md#many-judges-oct-8-2026)
- [Deep checks on players' computers (Oct 8, 2026; built, ships off)](docs/history/engine.md#deep-checks-on-players-computers-oct-8-2026-built-ships-off)

### Fair play

In [`docs/history/fairplay.md`](docs/history/fairplay.md). How it works today: [`docs/areas/fairplay.md`](docs/areas/fairplay.md).

- [Fair play (Oct 8, 2026)](docs/history/fairplay.md#fair-play-oct-8-2026)

### Ops, capacity and hosting

In [`docs/history/ops.md`](docs/history/ops.md). How it works today: [`docs/areas/ops.md`](docs/areas/ops.md).

- [Paid hosting and a domain are on the table (Oct 3, 2026)](docs/history/ops.md#paid-hosting-and-a-domain-are-on-the-table-oct-3-2026)
- [Capacity: what if 10,000 players arrived? (assessment, Oct 7, 2026)](docs/history/ops.md#capacity-what-if-10000-players-arrived-assessment-oct-7-2026)
- [Capacity: built (Oct 7, 2026)](docs/history/ops.md#capacity-built-oct-7-2026)

## New decisions

Add new sections here (`### Title (date)`), newest last.

### Housekeeping: area pages, history by area, one file per boss (Oct 10, 2026)

Eric approved a housekeeping pass with no player-visible change. The calls made:

- **History split by area, not by month:** every decision so far is from October 2026, so by month would have been
  one file. Each area's history (`docs/history/<area>.md`) holds its old sections word for word, in order; the index
  above lists all 80 with links. Code comments that cite `DECISIONS.md, "<section>"` were left as they are: the index
  resolves them, and a pure refactor leaves the code's comments alone.
- **Two more area pages than listed,** `engine.md` and `chat.md`, so the `engine` and `social` briefs each point at a
  page of their own. Classic's notes sit on `crowd.md` (it's frozen until Eric redesigns it).
- **Lessons:** all 21 are still true, so none was dropped. `.claude/LESSONS.md` keeps every rule, grouped by theme;
  the stories moved word for word to `docs/history/lessons.md`; each area page repeats the rules for its area.
- **Ginger's rules file is `ginger.ts`,** not `freeze.ts` as the task list had it: it holds both of her powers (the
  freeze and the blizzard), and the other files are named after their boss too.
- **Each boss's hooks only see that boss's battles** (the dispatcher looks the boss up by id). Before, the shared code
  tested every power's state in turn. The two are the same for every state a battle can reach, since each power's
  state is only ever set by its own boss; the unit tests, the e2e suite and a comparison of the screens' output on
  battles with every boss confirm it.
- **Kept shared, on purpose:** the roster, power ids, event kinds and every boss's state fields in `core/boss.ts`
  (types every package reads); every number in `BOSS_POWERS` (Eric's one settings file); the protocol
  (`NetBossPowers`, the boss request's flags), so the lobby's host-engine moments (the funhouse, the extra move, the
  bounce), the host's handlers in `net.ts` and solo's flows stay where they were (changing them would change the
  server's messages); the boss screen's handling of the board during the funhouse, the bounce and the burn, and the
  intro's claim and snack (`screens/Boss.tsx`); and the runner's always-present screen fields for the first three
  bosses (`frozen`, `pie`, `fire`…), which every client reads. A new boss adds its own through its `view` hook. The
  "Adding a boss" checklist in `docs/areas/bosses.md` says which shared files a new boss still touches.
- **`BulbStrip` became `BossBarExtra`,** the boss bar's piece by the rage meter that any boss can fill (only Hollow
  does, with his bulbs).

### Squads, phase 1: the rules and a bot simulation (Oct 10, 2026)

Eric designed Squads (8 squads of 4, a bracket of Relay, Pairs and Pick and Block; `docs/areas/squads.md` holds his
design). Phase 1 is pure code: the rules (`packages/chess/src/squads/`), squad bots and a simulation
(`reports/squads-sim.md`). Nothing a player sees changed. The calls made:

- **Where the rules live:** the chess package, not `core`: they need chess.js (legal moves, mate in one) and the
  opening library, and `core` has no chess code. They have their own entry, `@chessroyale/chess/squads`, so their
  names don't crowd the package's main index. Every number is in `SQUADS` in settings.ts.
- **Replayable randomness:** each decision draws from its own stream, `squadsRng(seed, match, turn, half, board,
  what)`, rather than one shared generator. The server needs only the lobby's seed and the players' choices to
  replay anything, and a new kind of draw never shifts the others (the "lucky seed" lesson).
- **Forming squads:** parties go in largest first, each into the squad with the fewest free seats it fits, so people
  end up with people (a solo player joins a party of 3 before an empty squad) and bots fill the rest; parties that
  don't fit wait for the next lobby; seats are shuffled. The bracket is a seeded random draw (unranked). The final's
  White is a coin.
- **Votes** (Pace and Length replaced by one Clock vote: see "Squads: chess clocks" below): the whole lobby votes
  once, before round 1, on Crowd's machinery (one vote each, bots vote, non-voters join the winner). Nobody voting
  gives the normal start, 15 s and the move cap (a 32-player lobby shouldn't wait on one endless game by default).
  Length has two options; the vote board's third zone is for phase 3 to settle.
- **Openings:** 4 moves per side, classic lines inside the balance window Classic uses (0.40-0.60). "One opening" is
  one opening for the whole lobby, final and Armageddon included. "Random openings": Relay draws two (boards 1-2 and
  3-4, colours swapped on each pair), Pairs one (both boards, swapped), the final one, an Armageddon a fresh one.
- **Relay colours and rotation:** side 0 is White on boards 1 and 3, so with everyone moving one board along, each
  player alternates colours turn by turn, and each half two of a squad move. Both squads rotate the same way, so a
  player meets the same seat of the other squad on every board: a rival for the round.
- **"Your board alternates" (Pairs) and "each player alternates picking and blocking" (the final) can't hold for
  everyone while partners change:** two consecutive turns' pairs always share exactly one player, so each turn two
  players switch and two stay. The schedule (`pairSchedule`) keeps the spirit: player 1's pair alternates every turn,
  and over every six turns each player has each slot (board, or pick/block) three times, never more than three
  turns running, and all six possible pairs play each slot once.
- **Caps** (the move cap is gone with the clocks; the safety cap stays) **count moves played in the match** (an
  opening's moves don't), per side: 40 for the Length vote's cap, 120 for the safety cap, which guards every board,
  the final and Armageddon included. Material is pawn 1, knight and bishop 3, rook 5, queen 9; any lead wins
  (`materialLead` 1).
- **Clinch** is "more than half the points". In Pairs that needs both boards finished, so a squad 1-0 up plays on.
- **Choices:** a Relay move is final once made. Picks and blocks can change until the half ends; a change unlocks.
  Relay and Pairs choices show live to the player's own squad only; the final follows the visibility setting
  (Eric's: blocks to everyone, picks to the picking squad), spectators seeing what "everyone" allows.
- **One legal move plays itself** in Pairs and the final (two different picks are impossible); nobody is asked and
  nobody misses. Relay still asks the player.
- **Castling is the king's move (e1g1), and each promotion piece is its own move:** blocking the queen promotion
  leaves the rook, bishop and knight promotions open, as the chess library counts moves.
- **The mate-in-one mercy rule** is read literally (every legal move but the block allows mate in one) and checked
  for the active block when the move is resolved; `blockCancelledByMate` is exported so the screens can grey such a
  block out live.
- **Missed actions:** a missed pick and a forfeited block both count towards the no-show streak; 3 in a row hands
  the seat to a bot (at skill 4). A forced move or a block the mercy rule took away isn't a miss.
- **Armageddon** (now only for a drawn final: see "Squads: chess clocks" below)**:** the same format and length as the
  tied round (the final's is to the end), at 10 s. In Relay its one board takes each squad's seats in order; in Pairs
  the turn's first pair plays. "Total thinking time" is the sum of a squad's action times in the tied match, a miss
  counting the whole clock; level time goes to a coin. Bots choose Black (draw odds).
- **The test-only "Next round"** (`endByMaterial`) settles a level match with a coin (now time left first), so the
  bracket can move on.
- **Speed:** chess.js's public move list costs about 2.5 ms a position (it builds SAN and two FENs per move). The
  rules use its internal generator, as chess.js's own Move class does, with the public API as the fallback and a
  unit test holding the two to the same moves in the same order.
- **The simulation** (since re-run for the clocks: see "Squads: chess clocks" below) ran 120 full lobbies at three
  skill mixes and every Pace and Length vote, with a model of a person's clock and misses (no real data yet). The bot
  engine runs at 10k nodes: enough for bots that play at a temperature, and 30k would have taken 4-6 hours. Findings:
  - A lobby takes about 98 minutes at the defaults (15 s, 40-move cap) and about 3 hours "to the end". - Material
  decides 82-84% of round 1 and 2 boards at the cap, and capped matches never clinch early. - A third of Relay matches
  and half of Pairs matches tie. Black wins about half of Armageddons. - The coin plays a clearly weaker pick on about
  7% of Pairs moves. - A block forces the worse pick on about 1 final move in 16. The mercy rules fire on 5% (no
  blocks) and 0.5% (cancelled) of moves.
- **Settings stay as the brief set them in this PR.** The report recommends:
  - a 25-move cap (the check: 29 minutes saved at 15 s);
  - a shorter Armageddon (about 20 moves);
  - for Eric to weigh, after playtests: a lower safety cap or a cap for the final, which is now the longest round,
    and a material tiebreak before Armageddon in round 2.

### Speech that stays up long enough to read (Oct 10, 2026)

Eric, playing Ginger in Boss alone: when she froze his queen, her text box appeared and vanished almost at once. The
same kind of bug as Hollow's Lights out box (PR #124). A sweep of every boss's lines and the God King's found five
causes, all fixed by one shared rule (`packages/app/src/speech.tsx`, numbers in `SPEECH` in settings.ts):

- **Her text box was tied to the screen:** a reaction's line (her capture, her check) lived 3.4 s only while the
  battle stayed at the same beat. Alone, the boss's move shows for 0.45 s, so the line was gone as the crowd's turn
  began; and a power's moment hid her (`.boss-char`, box and all) while she cast. With a freeze, her line went 0.45 s
  after it came: what Eric saw.
- **Power lines lived in the dock for the moment's own length** (a freeze 2.3 s, the warning 1.7 s), mostly under the
  moment's banner, then the next moment or "Your move." replaced them.
- **Lines drawn over the board lived as long as their moment** (Boingo's funhouse line 1.8 s; Hollow's cover, claim
  and Big Boy's snack lines until their moment ended).
- **The God King's line was a flat 3.8 s** whatever its length (his opening lines take up to 1.5 s just to type), and
  any critical cue replaced it at once, even another critical one just begun.
- **Lights out:** "It's time." and the verdict were up 2.8 s at most, the verdict cut to about 2 s when Lights out's
  screen ended, and the prompt box could still be hidden by its fit check.

**The rule, and my calls:**
- **The time:** a line types out (28 ms a character, as before), then stays fully readable for 2.5 s plus 50 ms a
  character, at most 7 s (the brief's numbers), then fades (0.26 s). The fade comes after the readable time.
- **One voice per speaker,** outliving any screen: the boss's (`bossVoice`) and the God King's. Each says one line at a
  time; a new screen picks a line up where it was.
- **A line's time runs from when this device says it** (as a boss's animations run from when it first saw their
  moment), and a line that waited starts when it can show, not at the exact moment the last one ended: a busy frame
  (the first e2e runs caught one of 240 ms) never eats into its time.
- **Priorities:** critical cuts in on anything less; everything else waits its turn, highest first, then in the order
  said. **A critical line doesn't cut in on another critical one** (it waits for it), so no line is ever cut by an equal.
  Boss: an ultimate's line, Hollow's first cover (it says how the dark works), his claim, the battle's end are critical;
  passives, the warning, the snack and Lights out's verdict are normal; reactions are low. God King: his critical cues
  are critical, remarks normal, small talk low (his pacing by `KING_SPEECH` is unchanged).
- **A waiting line lapses after 5 s** (`waitMs`): "your king's in check" said behind another line would otherwise come
  after you've answered it.
- **Every boss line goes in its text box beside it** (the boss bar on a phone, by the board on a computer), on every
  screen, also while it stands at the board's corner for a moment (only its figure is hidden then). The dock says the
  moment's word ("Freeze!"), as it already did for Hollow's dark. The on-board line boxes are gone (they covered the
  board, so they couldn't stay into the crowd's turn). Lights out keeps its prompt box above the board, for the whole
  round; his other Lights out words go in his text box.
- **A move that brings a power's moment says nothing of its own,** so the moment's line comes with the moment instead
  of waiting behind a reaction.
- **A power's line is always said** (its kit's line for the moment, picked by the moment's key), as the dock always
  showed one; reactions keep their kits' chances.
- **Never hidden by a fit check:** a box that would run off the screen takes a smaller size, then moves back into view.
- **Not changed:** banners (the powers' cut-ins, the Last Stand's) keep their beats, which the server's timing shares;
  their words are big and untyped. The God King's bubble still gives way to his command menu while you have it open.
- **Tests:** `packages/app/test/speech.test.ts`; `e2e/boss-speech.spec.ts` watches every frame of one moment of every
  boss on a phone and a computer (its line whole and in view for its full time, and the God King's opening line). On
  `main` it fails: the God King's line was up 3.6 s of the 4.7 s it needs, and Ginger's freeze line never reached her
  text box.

### The Last Stand: working as designed; three proposals for Eric (Oct 10, 2026)

Eric's two games with Ginger: the save never came while he was losing on purpose (bad moves, then his queen left to be
taken), then came at once for a bad queen move at the start. Replayed in Solo (`scripts/repro-last-stand.ts`, the
runner's own numbers): moves that gave away 5, 12 and 20 points took the crowd from 52% to 19%, none reaching the bar
(33 to 35); from 19%, the hung queen cost 9 points and the crowd was under `lastStandFrom` (40) anyway. A queen hung on
move 1 cost 72 points against a bar of 35: Last Stand. The rule is as Eric set it (Oct 5): judged on the crowd's move
as played, in points of chances; once a game; never below 40%; the same solo and online; charges add 5 to the bar; no
move window but the bar easing over 22 moves; never waiting for the boss's capture. No rule changed.

**Proposals (Eric decides):**
1. **Judge the piece lost, not only the chances** (my pick). When the boss's best reply wins the queen or a rook
   outright, or mates, he steps in whatever the chances, while the crowd's best is still worth 10% or more. The judge
   already works out what a blunder loses (`blunderCost`), at no extra engine time. A queen left for the taking in a
   game already going badly (Eric's game 1) would be saved.
2. **Measure in pawns once the position is bad.** Below 40%, call him when one move gives away 5 pawns or more by the
   engine's eval (a rook, a queen); above 40%, as now.
3. **Lower the "already lost" line** (`lastStandFrom` 40 → 20) **with a bar that's a share of what's left** below 40%
   (e.g. the move throws away 60% of the crowd's remaining chances). One number alone isn't enough: from 25% no move
   can lose 35 points.

### Squads: chess clocks instead of the pace and the move cap (Oct 10, 2026)

Eric read phase 1's sim (a lobby took about 98 minutes) and asked for a lobby of about 20-40 minutes:
- chess clocks in place of the per-move pace and the move cap;
- one Clock vote (Fast, Normal, Long; Normal if nobody votes);
- every game to the end;
- ties in rounds 1 and 2 to the squad with more clock time left;
- Armageddon only for a drawn final, with White on more time.

The calls made:

- **Which clock runs.** Relay: the mover's time, on their side's clock for that board (the squad's four players share
  it). Pairs and the final: the slower picker's, since the side's clock runs until both have locked in. Blockers
  aren't on a clock; the per-move ceiling bounds them. If playtests show blockers sitting on the timer, the fix is to
  run the blocking side's clock once both pickers have locked in.
- **The per-move ceiling is 20 s, not the brief's starting 40.** A missed action charges the whole ceiling. With two
  pickers in Pairs and the final, 40 s charges decided most finals on time in the tuning runs. At these clocks nobody's
  ordinary think reaches 20 s, so the ceiling only ever charges a miss.
- **Missed actions earn no increment** (`incrementOnMiss`). A move chosen after the bank ran out is a flag fall, not a
  move. If the bank is shorter than the ceiling, a missed move is a flag fall, not a random move.
- **Can't mate:** a lone king, or a king with one knight or bishop. A flag against that side is a draw (the usual
  online rule, without asking whether a mate could be helped along).
- **Forced moves** (one legal move) take no time and earn the increment.
- **Time left** for the tiebreak is the sum of a squad's clocks over the match's boards; a board that ended early keeps
  its clock as it was. Exactly level goes to a seeded coin. "Next round" settles a level result the same way.
- **The drawn final's Armageddon:** White 1:30, Black 1:00, as the brief says, plus a 1 s increment. Without one, two
  pickers can't keep up a game's moves on a minute. The chooser is the squad with more time left in the final (a coin
  if level); bots choose Black.
- **Bots play with purpose when winning.** Their temperature is capped once the best move scores 0.9 or more, the
  engine's order breaks ties between moves that all win, and they play a mate they see. With every game played to the
  end, phase 1's wandering bots would otherwise run most games to the safety cap. Bots pace themselves by their clock
  (bank / 25 + 0.8 × increment), the same model the sim uses for people.
- **The clock options, tuned by the sim:** Fast 1+2, Normal 1:45+2, Long 2+3, in place of Eric's starting 2+1, 4+2,
  6+3.
  - Medians: 24, 31 and 36 minutes; 90th percentiles 27, 35 and 38; the longest of 72 lobbies, 39.8.
  - Eric's options take about 29, 43 and 61 minutes.
  - Increments are at least 2 s because a pair can't decide much faster than about 2-3 s. Below that, a side's bank
    drains in any long game.
- **The trade-off for Eric:** short clocks mean flags.
  - Flags decide 23-64% of Pairs boards and 37-75% of finals (Fast the most); at 4+2 almost none do.
  - If that feels anti-fun in playtests, the options are more increment for Pairs and the final, the blockers' clock,
    or a longer lobby. Each is his call.
- **The sim's lobby times assume a match starts as soon as its two feeder matches are done**, not when the whole
  round is. It saves under a minute on average, and phase 2 should do it.

### Speech: a few seconds, not more (Oct 10, 2026)

Eric, after "Speech that stays up long enough to read": "the message just needs to appear for a few seconds… two,
three seconds, four, not that long." `SPEECH` in settings.ts: `readMs` 2500 → 2200, `perCharMs` 50 → 35,
`maxReadMs` 7000 → 4500. The calls made:

- **The times, once typed:** "Freeze!" 2.45 s, a typical line (30 characters) 3.25 s, a 50-character line 3.95 s.
  The 4.5 s cap is reached at 66 characters, longer than any line today (the longest, 56, rests 4.16 s).
- **The cap is on the rest after typing,** as the brief put it. Typing is unchanged (28 ms a character: the words
  can be read as they come), so a line is on screen 2.6 s ("Freeze!") to 5.8 s (the longest) in all.
- **Everything else stays:** one voice per speaker, lines waiting their turn, critical lines cutting in (never on
  another critical one), a waiting line lapsing after 5 s, and no box ever hidden to fit.
- **e2e:** `e2e/boss-speech.spec.ts` still reads the minimum from `SPEECH`; it now also checks that each boss's line
  starts to fade, or gives way, within 1 s of its time, so a line can't quietly overstay either.

### The Last Stand: Eric's option 3 (Oct 10, 2026)

Eric chose option 3 of "The Last Stand: working as designed; three proposals for Eric". He keeps the engine's
judgement rather than "piece lost", because players sometimes sacrifice on purpose and a sacrifice the engine likes
gives nothing away. The "already lost" line drops, and in a weak position the bar is a share of the chances left. The
numbers (settings.ts): `lastStandFrom` 40 → 20, and two new keys, `lastStandShareBelow` 40 and `lastStandShare` 0.5.
The calls made:

- **The rule:** from 40% up, the plain bar as before (35 points on move 1 with charges, easing to 18). From 20% to
  40%, the lower of the plain bar and half the chances left (from 30%, 15 points; from 25%, 12.5). Under 20%, never.
  Once per game, the charges, the power-ups he leaves and solo and online (one runner) are unchanged.
- **The lower of the two,** not the share alone: late in a long battle with no charges, the plain bar (13) is under
  half of 39% (19.5). Dropping under 40% should never make the save harder.
- **Half, not the 60% the proposal had:** in the 60 recorded sim battles (`reports/last-stand.md`, regenerated from
  the same games), 11 of the 85 moves made between 20% and 40% gave away half or more of what was left (13 to 31
  points each); the next six gave away a quarter to a half (9 to 15 points). As each battle's first Last Stand, a share
  of 0.4 or 0.5 saves the same eight, 0.6 one fewer, 0.7 half of them. A 10-point slip from 30% (a third of what's
  left) is still the crowd's to play. Battles with a Last Stand: 32 of 60 before, 39 now.
- **Charges** add their 5 to the plain bar only; in the weak band the share is nearly always the lower anyway.
- **A step at 40%,** on purpose: on move 1 with charges, a move from 41% needs 35 points and one from 39% needs 19.5.
  That's the line as Eric drew it. If a playtest finds it odd, raising `lastStandShareBelow` or applying the share
  above 40% too is a one-number change.
- **Turning him off** (`?laststand=0`, and the tests that leave a piece to burn) is now `lastStandFrom` over 100: the
  old way, bars of 999, wouldn't cover the share.
- **Eric's two games now** (`scripts/repro-last-stand.ts`, the Solo runner's own numbers, Ginger, on a computer):
  - *Losing on purpose, then the queen:* moves that gave away 4, 9, 21 and 11 points took the crowd from 57% to 12%.
    The 21 came from 49%, under the plain bar (33.5); the 11 came from 35%, under half of it (17.6). Then the queen,
    hung from 12%: under 20%, already lost, no Last Stand. In Eric's own game (PR #129's replay) the queen went from
    19%, also under the line, and cost only 9 points, under half of what was left (9.5) too: neither number alone
    would have saved that one.
  - *A bad queen move at the start:* 55% to 4%, 51 points against a bar of 35: Last Stand, as before.
- **The script** takes `hang=<percent>` (the queen is hung once the chances are under it; 35 by default, Eric's game),
  reads the bar from `lastStandBar`, and labels each move "ok", "weak" or "already lost". It no longer re-reads the
  same row after a Last Stand, and it bars the move he took back from the re-pick.
- **Tests** (`packages/chess/test/last-stand.test.ts`): the bar by the chances left; a big blunder at 25% (to 5%) calls
  for him with the bar at 12.5, a 10-point slip there doesn't; nothing under 20%; a sacrifice the engine rates best
  never does, in a healthy position or a weak one, nor a speculative one 6 points worse; and with the real judge,
  Légal's 6.Nxe5!, the queen left to Bxd1, doesn't call for him.

### G-REX renamed Jefferson (Oct 10, 2026)

Eric renamed the fire giraffe: every name a player sees now says Jefferson (the roster's name, so the boss menu,
banners, intro, results and dock; his kit and character, keyed by that name; his entrance line), while his id stays
`grex` (code, file names, settings, `?boss=grex`, stored records), `?boss=jefferson` works too (`BOSS_ALIASES`, read
only from a link so a stored id is always the roster's), code comments keep the old name, and his dinosaur jokes from
the old name ("Tiny arms? Not me!", "Extinct… again…") stay until Eric says otherwise.

### Sawyer, a sprite preview (Oct 10, 2026)

A raccoon in a hard hat with a reciprocating saw, from Eric's reference, drawn so Eric can see him before deciding
whether to keep this boss (as with Big Boy's preview). Art only: no powers, rules, lines or sounds of his own, and no
entry in `packages/core/src/boss.ts`, so he never shows in a battle. His kit is `BOSS_KITS["Sawyer"]`, seen only through
the test link `?wip=1&kit=Sawyer`.

- **Art** (`characters/sawyer.ts`): about 73 x 69 px (with his halo) in an 83 x 73 frame, three-quarters on and facing
  our left as in the reference, light from the top left. A wide, low stance; a yellow hard hat with three ridges and a
  brim lower at the front; a bold black bandit mask across his eyes, a toothy grin rising to his near cheek; a white
  near-cheek tuft; a cream chest; white gloves; a big ringed tail curling up behind him; the saw held
  across him at about 14°, blade up to our left, as in the reference. The fur is the reference's warm grey-brown.
  - **Rigging:** the saw is painted from its angle, where its front grip is and how far the blade has slid out, and the
    gloves ride on its grips, so every saw pose is three numbers and the hands follow. The legs, arms and tail are
    painted from their points; every part is painted the first time it shows (`lazyParts`).
  - **No brand marks:** the saw is plain red and black. Its motor's vents are a grille of three short slits; a first
    try with three stacked dashes read like a letter, so it was changed.
  - **No goggles (Eric, Oct 10, after the first preview):** the reference's safety goggles hid the raccoon's mask, so
    they're gone, lenses and strap, and his face is drawn to read as a raccoon first: a bold black mask band from cheek
    to cheek with the eyes inside it (white, pupils glaring inward with a glint, the tops cut on a slant), white brow
    patches above it whose lower edges slant down to his nose (the angry brows), a dark stripe down his forehead,
    white cheeks and a long pointed white snout with a black nose. The grin and the hat are as before; the saw keeps
    its length (Eric considered a longer blade and decided against it).
- **Fitting the phone's boss bar:** he is wider than the other bosses (the saw one way, the tail the other). To keep
  the blade off the screen's edge and the tail off the boss's name: the stance is a few pixels narrower than the
  reference's, the tail curls closer in and swishes further behind him than out, and the blade is a pixel shorter. His
  kit is also `wide`: on a phone his box in the boss bar is 58 px wide instead of 48 (`.boss-char.place-bar.wide`,
  like G-REX's `tall`). Checked in the game on a phone and a computer (`npm run frames:character -- <dir> Boingo both
  kit=Sawyer`).
- **Animations:**
  - `idle` (loop, about 4.9 s, silent): the blade buzzes in and out the whole time (a pixel or two, every 90 ms), his
    tail swishes slowly, he dips at the knees now and then, blinks twice, and halfway through smirks for a moment (his
    near brow up, the grin pulled to one side, teeth on that side).
  - `rev`: a smirk, then he squeezes the trigger (cue `rev`): the saw shakes in his hands and tips up, the blade
    strokes fast, sawdust sprays off its teeth, his hat jiggles and he grins wide; then back to the smirk.
  - `sawDown`: he lifts the saw back, leans in and drives it down (cue `swing`), the blade biting at the ground in front
    of him (cue `cut`) in a burst of sawdust, buzzing there, then pulls it back up. The blade goes in at about 35° below
    level, not straight down: the saw is as long as he is tall, so straight down would leave his frame. Where the tip
    bites is exported as `CUT`, for the powers to aim their cut (a pawn, then the board) later.
- **Never above his hat:** nothing in any animation rises above his hat at rest (the hat's jiggle goes down over his
  brow, not up), so on a phone he stays under the heading above the bar (a test checks every frame).
- **Placeholders for the preview only:** every moment plays one of his three animations (his entrance, move, check and
  victory the rev; a capture and a strike the saw down; the rest the idle), and his cues borrow quiet existing sounds
  (G-REX's fizz for the rev, Boingo's slide whistle for the swing, Ginger's crunch for the cut) because every cue must
  have one. No lines.
- **Portrait:** his hat, mask and grin.
- **In the test link** he takes the place of every boss, but a battle is still that boss's: when Boingo's powers fire,
  the boss bar hides its character for the power's moment (as it always does) and Sawyer has no moment to play there.
- Tests: `packages/app/test/sawyer.test.ts` (a preview kit with no boss; never above his hat; the idle's buzz, swish,
  blink and smirk, silent; the rev and saw down's cues and where the cut lands; the portrait), plus the shared
  character tests.


### Sawyer, built (Oct 10, 2026)

Sawyer becomes a playable boss (`sawyer`, 🪚): his rules, his moments, his art for them, his sounds and lines, on the
approved sprite (kept as it was; only added to). Eric's design, word for word (the director's calls marked):

#### Sawyer, the raccoon with a saw (design, Eric, Oct 10, 2026; calls marked "director's call")

A raccoon in a yellow hard hat with a black bandit mask and a red-and-black reciprocating saw. Sprite approved by Eric
("perfect") on branch `claude/sawyer-art` (goggles removed at his request). Name "Sawyer" for now.

##### Opening: the split pawn
- His first move is always a pawn move. Then he jumps onto that pawn and saws it in half: a second pawn of his
  appears on an empty square right beside it, left or right at random (seeded; if only one side is empty, that side;
  if neither, no split). Both play as normal pawns, drawn as halves (the two pawns are tracked through the game).
- About a pawn's head start: his strength offset drops to match (set from a quick boss-sim run, as Big Boy's was).

##### Passive: saw cuts
- Every few turns (director's call: every 4, like Big Boy's blocks) he saws one edge of a square: a wall between two
  neighbouring squares. Nothing may move straight across that edge (a rook, queen, king or pawn moving through it);
  diagonal moves pass corners, not edges, so they aren't blocked; knights jump it; a piece can still land on the
  square from another side.
- Each cut lasts 3 turns and is visibly repaired over them (tape or stitches closing up); a new cut comes after a
  1-turn gap.
- Placed on an edge in the crowd's half that one of the crowd's legal moves would cross, so it matters a little.

##### Ultimate: sawing the board in half
- Needs the shared rage meter full, and move 10 or later, and one half of the board (files a-d or e-h) favouring
  him on material. He jumps on, revs, and a saw runs up the middle (between the d and e files) from bottom to top
  with a sawing sound; the board splits visibly in two.
- For 5 turns each, no piece may cross between the halves (any move whose path crosses the line, knights included).
- Afterwards the halves rejoin.

##### Rules for both kinds of cut (Eric approved)
- Cuts block movement, not attacks: checks still count across them, so nobody is suddenly in check when a cut heals
  or the halves rejoin.
- If a side's only legal moves cross a cut, those moves are allowed: a cut can never cause a mate or stalemate on its
  own. Never block the only way out of check. The judge uses the allowed-move filter, like Freeze and the toy blocks.

##### Character
- Sounds: the saw's buzz and rev, a sawing rasp, a wood crack for the split, tape/zip for the repair, a big board
  saw for the ultimate. Quieter than a move, through mute, no chimes.
- Short lines in his text box: "Measure twice, cut once.", "Two for one!", "Timber!", "This board's getting
  renovated.", and so on.

**What was built, and the calls made:**

- **Rules** (`packages/chess/src/bosses/sawyer.ts`, on the base boss; numbers `BOSS_POWERS.saw*`, `boardSaw*`):
  - **The split's ninth-pawn problem (my call, for Eric to confirm).** The engine (Stockfish 19, for his moves, the
    judge, the eval bar, the hints and the bots, on every device and the engine server) refuses any position with a
    ninth pawn a side or a 33rd piece ("Unsupported position. BLACK has more than 8 pawns."; "More than 32 pieces"),
    and a search sent one never answers. In 55% of raid openings (5 moves in) he still has all 8 pawns, so the split as
    designed would break the battle there. So: **the split needs room** (fewer than 8 of his pawns, fewer than 32 pieces:
    `splitRoom`). After his first move (always a pawn move, as designed) it comes at once when there's room; otherwise
    it waits and comes after his first pawn move once one of his pawns has gone (`split.waiting`), the same moment.
    Nothing else changes. Alternatives Eric may prefer: (a) no split at all without room; (b) the split always comes,
    and the new half replaces one of his other pawns (always seen, no head start); (c) a different engine build (the
    engine lane's).
  - **The split never forks (my call).** The new half never lands where it attacks one of the crowd's pieces (a knight,
    bishop, rook or queen), gives check, or leaves the crowd without a move: the engine measured splits that forked or
    won a piece at once at 4 to 7 pawns, far past "a pawn's head start". Attacking a pawn is ordinary chess and allowed.
    Neither side allowed: no split now (it waits for his next pawn move with room, as above).
  - **The halves are tracked** (`split.halves`, `trackHalves`) through every move, his and the crowd's: a half that's
    taken (en passant too) or promotes (a whole piece now) is gone; each keeps its side of the cut (`a`: the one towards
    the a-file).
  - **His first move:** only pawn moves (`bossStops`); none: any move (the dispatcher lifts it).
  - **The split is a base** on the board at its ply (the position changes outside a move): every replay plays from it.
    A new hook on the base boss, `afterBossMove`, does it (the runner calls it after his move, before the crowd's turn
    is set up); the halves follow the crowd's moves through `afterCrowdMove`.
  - **Saw cuts** (`sawFirst` 3, `sawEvery` 4, `sawTurns` 3): turns 3-5, 7-9, 11-13… (my call: from turn 3, not 2, so
    the split after his first move has turn 2 to itself). The edge (`chooseCut`): one of the crowd's legal moves crosses
    it straight, both its squares in the crowd's half, a seeded pick. `moveEdges`: a slide along a rank or file, a pawn's
    push or double step, the king's step; castling counts the king's way on to his rook's corner (the king's path and
    the rook's, as Big Boy's toy block counts it). Diagonals and knights cross no edge.
  - **The board saw** (`boardSawFrom` 10, `boardSawTurns` 5): the warning when the meter is full, it's turn 10 or later
    and one half of the board (files a-d or e-h) is his on material (his pieces there worth more than the crowd's,
    `favouredHalf`); the saw as the next turn begins (my call: whatever the material by then: the warning promised it).
    Any move from one half to the other is stopped (`crossesMiddle`), knights and castling long included. The test
    switch and the admins' trigger skip the conditions (my call: they're for testing).
  - **Fairness:** both kinds of cut stop moves only: chess.js's rules are untouched, so checks and pins work across them
    and nobody is in check out of nowhere when one heals. The dispatcher lifts a cut for a side whose every legal move it
    would stop (so never the only way out of check); the judge, bots and hints use the allowed moves; a cut turn is a
    power turn for fair play. Both sides are stopped (his own moves too).
- **Strength offset −250** (as Big Boy's): a quick boss-sim run (a new `split` mode in
  `packages/sim/scripts/boss-sim.ts`: his first move a pawn's, the split by the game's own rules, so from the starting
  position it comes once one of his pawns has gone; `reports/boss-sim/expert-7-split.jsonl`), an expert crowd of 10
  bots (rating 2908) at −250: 3 games, the crowd won 1, drew 1, lost 1 (the splits came at crowd moves 5, 5 and 14).
  For comparison, the others at −100 without a head start: no wins, 3 draws, 3 losses in 6 (Big Boy's runs), and Big
  Boy at −250 with his snack: no wins, 2 draws, 4 losses. So −250 doesn't make him harder than the rest. The machine was
  shared with other runs, so the sample is small (the club and casual crowds lose every game to every boss in this sim,
  as Big Boy's runs found, so they can't tell offsets apart). The engine's own measure of the split, in 12 raid
  openings with room (White to move after it), puts it at about 1 to 2.5 pawns, more than Big Boy's snack: the new half
  arrives with a tempo, and now and then it traps a piece a move later (a bishop on g5 or h4 boxed in by an extra g-pawn).
  **So −250 for now, as Big Boy's**: the games say it's not too generous, the static measure says he's at least a pawn
  up; the recorded results (self-balancing) will move it.
- **On screen** (`components/Sawyer.tsx`, `characters/effects/sawyer.ts`, his art in `characters/sawyer.ts`):
  - **The split** (`SPLIT`, 3.6 s after his move shows): "SPLIT PAWN!" (hazard stripes), he leaps from his corner onto
    the pawn (`leap`, new: a crouch, feet tucked in the air, a thump; the board draws his shadow), drives the saw into it
    (`sawDown`, reused; the pawn is drawn in front of him, shaking as the blade bites), it cracks (`sawCrack`: a wood
    crack, chips flying) and the two halves come apart, one sliding onto the square beside it; he leaps back. Near the
    right edge he faces right. The board doesn't show the new half before the crack nor animate the swap.
  - **Half-pawns:** every board (the boss's turn, your turn, the Crowd's) draws his two split pawns as halves wherever
    they go: chessground's own piece elements on those squares get a class that clips them to one half (the half away
    from its partner), a thin column at the cut shaded like fresh-cut wood (the pawn's own drawing, toned: it follows the
    pawn's outline). A MutationObserver keeps the classes in step with chessground before each paint, across its full
    redraws too (a first version watched a cg-board that chessground had already replaced).
  - **A cut** (`SAW_CUT`, 2.3 s): "SAW CUT!", his `sawDown` at the board's corner; as its cut cue lands the groove opens
    along the edge (`sawCut`, its half on each square, under the pieces), raw its first turn, two strips of duct tape its
    second (a tape sound), more tape and narrower its third, then the tape fades to a scar and it's gone. (My call: tape,
    not stitches: it reads at phone size.)
  - **The board saw** (`BOARD_SAW`, 5.7 s): "BOARD SAW!", he leaps onto the board's bottom edge between d and e, revs
    (`rev`, reused), saws his way up (`boardSaw`, new: the blade down and biting, stepping, sawdust; the big saw sound)
    with the groove opening behind him (`boardGap` run), and at the top the board jolts and splits: a gap down the middle
    (14 of the board's 256 px, under the pieces, a shadow round it) for its 5 turns; then the halves close up and knock
    back together (`close`, a clunk).
  - All drawn ahead in slices from when his battle shows (`prewarmSawyer`); the gap and cuts are single canvases.
- **Sounds** (`characters/sawyer-sounds.ts`, synthesised): the rev, a swing, the cut's rasp, the wood crack, tape, the
  big board saw, a hop's thump, the halves' clunk. Each 3 to 5 dB under a move's mean, peaks under half a move's, low and
  soft (no chimes), through the mute switch; the big saw is made ahead (31 ms to make on a computer). His moves still
  knock as every move does (a test hears the move's knock first).
- **Lines** (`SAWYER_LINES`): Eric's ("Measure twice, cut once.", "Two for one!", "Timber!", "This board's getting
  renovated.") and more in that voice; every one under 35 characters, so the speech rule shows each whole for its full
  time (never cut short by its cap). The split's line comes from a `split` beat of his own.
- **Test links:** `?boss=sawyer`, `?boss=sawyer&power=boardsaw` (the warning on turn 2, the saw on turn 3), the admins'
  "Trigger ultimate (testing)" (the saw as the next turn begins).
- **Tests:** `packages/chess/test/sawyer.test.ts` (the split, its room and its square; tracking through captures, en
  passant and promotion; cuts with sliders, pawns, the king, knights and diagonals; checks and pins across a cut; the
  only-legal-moves and only-way-out-of-check lifts; castling; the schedule; the judge's best move always allowed; the
  board saw's trigger, length and test switches), `packages/server/test/boss-powers-lobby.test.ts` ("Sawyer online"),
  `packages/app/test/sawyer.test.ts` (his moments' beats, effects, sounds and lines), `e2e/sawyer.spec.ts` (phone and
  computer: the split and its halves, the board saw and its gap, a cut taped and healing, the rejoin, his sounds
  through mute), `e2e/perf.spec.ts` (his moments on a slowed phone), `e2e/boss-speech.spec.ts` (his split's line held
  whole). Frames: `npm run frames:sawyer`.
