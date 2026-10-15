# Decisions

Judgment calls made while building, with the reason for each. Eric asked to be involved as little as possible, so
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
- [Two tweaks (Eric, Oct 9, 2026)](docs/history/bosses.md#two-tweaks-eric-oct-9-2026): Ginger freezes more often; the God King keeps his colors in the dock
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
- [Power-up slots, a center-closing timer, shorter openings, replay from move 0 (Oct 3, 2026)](docs/history/match-and-crowd.md#power-up-slots-a-center-closing-timer-shorter-openings-replay-from-move-0-oct-3-2026)
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
- [The cut as a judgment (Oct 5, 2026)](docs/history/match-and-crowd.md#the-cut-as-a-judgment-oct-5-2026)
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
  3-4, colors swapped on each pair), Pairs one (both boards, swapped), the final one, an Armageddon a fresh one.
- **Relay colors and rotation:** side 0 is White on boards 1 and 3, so with everyone moving one board along, each
  player alternates colors turn by turn, and each half two of a squad move. Both squads rotate the same way, so a
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
  for the active block when the move is resolved; `blockCancelledByMate` is exported so the screens can gray such a
  block out live.
- **Missed actions:** a missed pick and a forfeited block both count toward the no-show streak; 3 in a row hands
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
  blocks) and 0.5% (canceled) of moves.
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
judgment rather than "piece lost", because players sometimes sacrifice on purpose and a sacrifice the engine likes
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
  across him at about 14°, blade up to our left, as in the reference. The fur is the reference's warm gray-brown.
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
  neighboring squares. Nothing may move straight across that edge (a rook, queen, king or pawn moving through it);
  diagonal moves pass corners, not edges, so they aren't blocked; knights jump it; a piece can still land on the
  square from another side.
- Each cut lasts 3 turns and is visibly repaired over them (tape or stitches closing up); a new cut comes after a
  1-turn gap.
- Placed on an edge in the crowd's half that one of the crowd's legal moves would cross, so it matters a little.

##### Ultimate: sawing the board in half
- Needs the shared rage meter full, and move 10 or later, and one half of the board (files a-d or e-h) favoring
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
  - **The split waits for room (Eric, Oct 10: "option 1", keep it as built).** The engine (Stockfish 19, for his moves,
    the judge, the eval bar, the hints and the bots, on every device and the engine server) refuses any position with a
    ninth pawn a side or a 33rd piece ("Unsupported position. BLACK has more than 8 pawns."; "More than 32 pieces"),
    and a search sent one never answers. In 55% of raid openings (5 moves in) he still has all 8 pawns, so the split as
    first designed would have broken the battle there. So **the split needs room** (fewer than 8 of his pawns, fewer
    than 32 pieces: `splitRoom`): after his first move (always a pawn move) it comes at once when there's room;
    otherwise it waits (`split.waiting`) and comes after his first pawn move once he has lost a pawn, the same moment.
    Nothing else changes. (The alternatives put to Eric, not taken: no split at all without room; the new half replacing
    one of his other pawns; another engine build.)
  - **The split never forks (my call).** The new half never lands where it attacks one of the crowd's pieces (a knight,
    bishop, rook or queen), gives check, or leaves the crowd without a move: the engine measured splits that forked or
    won a piece at once at 4 to 7 pawns, far past "a pawn's head start". Attacking a pawn is ordinary chess and allowed.
    A pawn with neither side allowed counts as having no square (next bullet).
  - **Which pawn splits (Eric, Oct 10: "he only splits after one is captured, then he picks a pawn which has a space
    available next to it and splits it").** The timing is as above (once he has fewer than 8 pawns, on his pawn move).
    When it comes: the pawn he just moved, if a square beside it passes the rules above (no fork, no check, the crowd
    keeps a move); if not, another of his pawns that has one, the most central first (the d and e files, then c and
    f, and so on), from the seed among pawns as central (`chooseSplit`); if none has one, it waits and tries again on
    his next pawn move. (Before this, a pawn he moved with no square meant no split at all.)
  - **A first move that isn't a pawn's (my call).** His first move is a pawn's unless a check leaves him no pawn move
    (the rule lifts, like every power's limit). Then too the split waits and comes on his first pawn move with room
    and a pawn to split, so he always gets it (the e2e found a crowd's Bxf7+ on move 1 losing it for good).
  - **The halves are tracked** (`split.halves`, `trackHalves`) through every move, his and the crowd's: a half that's
    taken (en passant too) or promotes (a whole piece now) is gone; each keeps its side of the cut (`a`: the one toward
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
- **Sounds** (`characters/sawyer-sounds.ts`, synthesized): the rev, a swing, the cut's rasp, the wood crack, tape, the
  big board saw, a hop's thump, the halves' clunk. Each 3 to 5 dB under a move's mean, peaks under half a move's, low and
  soft (no chimes), through the mute switch; the big saw is made ahead (31 ms to make on a computer). His moves still
  knock as every move does (a test hears the move's knock first).
- **Lines** (`SAWYER_LINES`): Eric's ("Measure twice, cut once.", "Two for one!", "Timber!", "This board's getting
  renovated.") and more in that voice; every one under 35 characters, so the speech rule shows each whole for its full
  time (never cut short by its cap). The split's line comes from a `split` beat of his own.
- **Test links:** `?boss=sawyer`, `?boss=sawyer&power=boardsaw` (the warning on turn 2, the saw on turn 3), the admins'
  "Trigger ultimate (testing)" (the saw as the next turn begins).
- **Tests:** `packages/chess/test/sawyer.test.ts` (the split, its room and its square; another pawn when the one he
  moved can't split, the most central, and the wait when none can; tracking through captures, en
  passant and promotion; cuts with sliders, pawns, the king, knights and diagonals; checks and pins across a cut; the
  only-legal-moves and only-way-out-of-check lifts; castling; the schedule; the judge's best move always allowed; the
  board saw's trigger, length and test switches), `packages/server/test/boss-powers-lobby.test.ts` ("Sawyer online"),
  `packages/app/test/sawyer.test.ts` (his moments' beats, effects, sounds and lines), `e2e/sawyer.spec.ts` (phone and
  computer: the split and its halves, the board saw and its gap, a cut taped and healing, the rejoin, his sounds
  through mute), `e2e/perf.spec.ts` (his moments on a slowed phone), `e2e/boss-speech.spec.ts` (his split's line held
  whole). Frames: `npm run frames:sawyer`.

### Squads: quick early rounds, a roomier final (Oct 10, 2026)

Eric picked option B: the final is the showdown, and he likes more games. Each Clock option now sets a quick clock for
rounds 1 and 2 and the final's own, longer one (`finalBankSeconds`, `finalIncrementSeconds`), aiming at:
- every option's lobby within 20-40 minutes;
- Normal's median at 30-35;
- under about 15% of finals decided on time.

The calls, from the sim's tuning runs (`reports/squads-sim.md`):

- **The final needs about 4 minutes of bank and at least 3 s of increment.** In finals-only runs (60 finals each):
  - 3+3 to 3+5 ended on time in 17-23% of finals;
  - 3:30 hovered at the 15% line (8-22% across runs);
  - 4+3 to 5+5 ended on time in 3-10%: a bank that size absorbs a missed pick's 20 s charge;
  - 4+2 ended on time in 17%: two pickers need about 3 s a move to keep pace;
  - 5 s of increment didn't clearly help, and it costs a minute.
- **The chosen options**, 36 lobbies each:

  | Option | Rounds 1 and 2 | Final | Median | 90th pct | Longest | Finals on time |
  | --- | --- | --- | --- | --- | --- | --- |
  | Fast | 1+2 | 4+3 | 32.6 | 35.3 | 36.9 | 5.6% |
  | Normal | 1+2 | 4+4 | 33.8 | 36.8 | 38.7 | 2.8% |
  | Long | 1+2 | 4:30+4 | 36.0 | 39.2 | 43.5 | 5.6% |
- **The same early clock (1+2) for every option.** A 4-minute final costs 17-20 minutes and the early rounds about 16,
  so there's no room for a slower early clock. 1+3 added about 2 minutes, and with it a Long option's 90th percentile
  went over 40. The options differ in the final's room, not much in length; a clearly faster Fast would need a final
  closer to the 15% line.
- **The early rounds are a scramble:** 20% of Relay boards and 60% of Pairs boards end on time. That's option B's "quick
  early rounds". If Pairs feels decided by the clock in playtests, 1+3 brings it to about 53% for about 2 minutes more.

### Squads: one team clock per squad (Oct 11, 2026)

Eric replaced the per-board clocks with one team clock per squad for the whole tournament, so fast wins pay off later.
(The brief before it, a per-move delay for Pairs, is folded in as the free seconds.) The calls:

- **Where the bank lives:** on the squad (`Squad.bankMs`). `startTeamClocks` sets it from the voted option,
  `planMatch` brings it into a match (plus the top-up from round 2 on), and `settleTeamClocks` carries it out.
  Armageddon's fixed clocks don't touch it.
- **The drain**, worked out from the thinking times the server passes:
  - Each of a squad's moves being thought about drains the bank from the free seconds until it's made (the slower
    picker of a pair), several at once together.
  - If the bank runs out during the half, the moves still being thought about are cut off (random moves). That's
    the moment a live server would see.
  - At zero, each move has only the free seconds; there are no flag falls.
- **Out of time isn't a no-show.** `resolveHalf` returns `timeouts` among the missed, and the sim leaves them out of
  the no-show streak, so a slow move in sudden death never hands a seat to a bot. Phase 2 should do the same.
- **One free-seconds value per option** (3 s for all three), not 5 s for Pairs. At 4-5 s people spend the free time
  on every move, and a lobby ran 36-45 minutes; at 3 s, 31-33.
- **No increment** (a setting): +1 s made lobbies longer (40 minutes) for no gain the sim could see.
- **The options:**

  | Option | Starting bank | Top-up | Free seconds | Median | 90th pct (min) |
  | --- | --- | --- | --- | --- | --- |
  | Fast | 3 min | 45 s | 3 | 30.6 | 37.1 |
  | Normal | 4 min | 1 min | 3 | 33.1 | 39.7 |
  | Long | 5 min | 1 min | 3 | 31.3 | 37.2 |

  The options differ in pressure, not length: 65%, 48% and 38% of squads reach sudden death, mostly in Pairs.
- **Ties:** more bank left wins, then a coin. A quarter of ties now go to the coin, because both squads are at zero.
  If that grates, the next tiebreak could be the squad that reached sudden death later.

### The eval bar's switch (Oct 10, 2026)

Eric suspects the eval bar may hurt the game more than it helps and wants to be able to find out, so it stays on by
default and players get a switch to turn it off. Calls:

- **Where:** Settings only (Eric, Oct 10: never on a board screen), under Playing, as "Eval bar", in the same switch
  style as the rest of the page.
- **Stored on the device** (`prefs.ts`, `brc.evalBar`, every read and write in try/catch): accounts keep no preferences
  today, and adding a preferences store for one switch isn't worth it yet.
- **Every mode:** the one `EvalBar` component (play, reveal, vote, final, boss screens) draws nothing when it's off. All
  the layout rules that narrow the board are written for `.eval-bar ~ .board-wrap`, so the board takes the room back
  by itself, centered, on a phone and a computer (on an iPhone 13 it grows from 312 to 333 px, where the height becomes
  the limit; on a 1440 x 900 computer from 552 to 584 px). The vote board and the game board still match.
- **The value is still worked out when it's off:** the God King's word on how it's going reads it (`knownEval`), and
  he shouldn't talk differently because the bar is hidden; the cost is what it was with the bar on.
- **Measuring it (cheap, so done):** each result records whether its player had the bar on (`results.eval_bar`: 1, 0,
  or NULL from an older app): solo's result post carries it, and online the app says it in its `hello` (the lobby keeps
  it per player; a hello again on coming back updates it). Later, `eval_bar` against placements and average loss
  shows who turns it off and how they play.

### A boss's attack on a king: Hollow lashes the God King in his Last Stand, and the crowd's king at his mate (Oct 10, 2026)

Eric's brief: the reverse of the God King's strike on the boss. Hollow first; Eric wants to try it before the others
get theirs. His correction (Oct 10): the main moment is the God King's Last Stand (Hollow attacks the God King as he
saves the crowd); doing it again at checkmate was left to us. Calls:

- **Both, with one animation.** The kit gets a `kingAttack` moment (`KingAttackKit`, kits.ts) that both use, on beats
  every boss's attack shares (`KING_ATTACK`, boss-timing.ts): it drops in beside the king, ten hits 170 ms apart (a
  gold "−N" off the king each, the God King's strike style), cackles and leaps off: 2.78 s. Shared beats keep the God
  King's frames, the numbers, the sounds and the server's clock in step, whichever boss attacks.
- **In the Last Stand it is the blow meant for the piece** (beat 5): instead of the 25 anonymous red slashes, Hollow
  drops in as the piece slides back and lashes the God King, whose blows (a flash and a jolt each, his armor cracking
  at the 2nd, 6th and 9th) land on the lashes; Hollow leaps off as he staggers; then the Last Stand carries on as
  before (the collapse, the fade, the re-pick). It fits between the slide and the stagger, so the Last Stand is no
  longer and the server needed no change for it. His numbers are the God King's gold strike style, as Eric asked,
  not the red slash numbers.
- **At his mate:** cosmetic only. The mating move shows, 0.6 s later Hollow drops in beside the crowd's king and lashes
  it; the king (a copy, the real one hidden) flashes at each lash, darker each time, topples away from him at the last
  and fades as his dark gathers on its square; then the result. The result waits for it: the mating move now holds
  3.9 s (was 1.8 s; 0.45 s in Boss alone) for a boss with an attack, solo and online alike (`bossTurnShowMs`, used by
  both; `KING_ATTACKERS` lists those bosses for the server, and a unit test keeps it equal to the kits). Other bosses
  and every other move keep today's timing. No power's moment plays with a mate.
- **Where he stands:** beside the king on the side toward the board's middle (mirrored when the king is on the left
  half), a square and a half to two squares off, so the whole strand reads as a whip and its tip lands in the king's
  square. A side-on lash reads better than one from "in front" on a top-down board, and the king's side always has
  room. He is about 1.8 squares tall (36 frame pixels a square: at least one screen pixel per art pixel on a phone, so
  his pixels stay crisp), over the squares beside the king for under 3 s while nobody can move.
- **His art:** his own parts and palette (`HOLLOW_ATTACK`, a frame 38 px wider so the strand fits; his usual frame
  stays as it was), four new strand poses (cracked out straight, flicked up, cracked out low, dropped), sparks off the
  bulbs at its tip, and `lashHit` (the crack of a bulb's color across the king's square, forehand or backhand) on
  the shared `BoardEffects` canvas. Drawn ahead as his battle starts: his first drop-in frame took about 80 ms to draw
  cold on a computer.
- **His sound:** `hollowLash`, a low whoosh sinking as it swings, a dull snap and the wire's rattle; about 6 dB under
  a move, centered near 240 Hz, no chimes (the loudness and "low and dark" tests cover it).
- **His line:** as he lands, into his voice by the speech rule, critical (the battle's end, or the Last Stand's big
  moment): "Shh. Sleep now, little king.", "Into the dark with you." or "Lights out, little king." His usual reaction
  line to the mating move (a check line) stays quiet then.
- **Test switches:** `?boss=hollow&laststand=1` (already there: your first move calls the Last Stand) and
  `?boss=hollow&mate=1` (new, solo: the battle starts after 1.f3 e5 2.g4 with the boss to move, and it plays a mate in
  one whenever it has one: the attack and the result within seconds of the intro). Frames:
  `npm run frames:king-attack` (the page's clock paused and stepped 40 ms a frame).

### Squads, phase 2: the server (Oct 11, 2026)

The Squads lobby, parties, the queue, bots, the bracket, spectating, rewards, the test controls and the protocol
(`docs/areas/squads.md`, "The server"). The rules stay phase 1's: the server runs them and never decides what they
decide (duties, deadlines, clocks, what a miss plays, ties). Nothing links to it yet. The calls made:

- **Two new Durable Objects, not the Crowd lobby's.** `SquadsLobby` (one per lobby) and `SquadsParty` (one per party),
  a new migration tag (`v5`). Crowd's `Lobby` is built around the runner, the host and the judges; Squads shares none
  of that, so a second class keeps both simple. The pattern is Crowd's: pure logic (`squads-lobby.ts`) under a thin
  object that stores, times and talks. Each match is stored under its own key and only when it changed (a lobby has up
  to seven, each with its boards' positions).
- **Parties are their own small object, not a private lobby's code.** A party has to gather before it queues (a Squads
  lobby fills a minute after it opens), and its friends may play several lobbies together. So: a code and invite link
  for the party; the leader queues; the matchmaker holds seats for the whole party under a one-time pass; each member
  joins the lobby with the pass and lands in one squad. Party and lobby codes are separate namespaces (their routes
  differ).
- **The Squads queue is Crowd's matchmaker with groups.** The same object and queue (batches, admission, "busy, you're
  in line"), under its own name (`squads-default`). Each ticket is a party or one player; a lobby takes a group only if
  every party still fits the squads whole, checked with the rules' own packing (`formSquads`), since 32 free seats
  aren't enough (six parties of 3 and five of 2 don't fit). Otherwise the next lobby.
- **Bots' engine work goes to players' devices, checked against each other** (Eric's computing priorities). A job is one
  board's position in one half; two devices each, preferring devices outside that match (nobody's engine picks the moves
  of the bots they play against or beside while anyone else's can), then computers, the least loaded and fastest; a
  device holds at most 4 unanswered jobs (a phone 2), and the rest wait for a device to answer (the soonest-needed
  first), so a lobby with one phone still gets engine bots, not the quick look. Boards in the same position (every
  board's start on the first turn) share one job. Each job says how deep to search (`botWork.nodes`), so every device
  does the same search. The browser engine is deterministic, so answers must match
  exactly. Two that disagree: the engine server settles it with one restricted search of their moves (counted in its
  daily budget), or without it a third device referees; the wrong device gets a strike, and two strikes mean no more
  work. Only an answer that doesn't hold together is a strike: an illegal move, a score out of range. A move listed
  twice keeps its first line (the run through the real server found the engine interface does that now and then,
  and the stricter check had benched an honest device), and fewer lines than asked are fine. One answer stands after 400 ms (like the judges' grace); none after 4 s, or no device at all: the server's own
  quick look.
- **The quick look has no engine.** The engine server can't serve routine bot moves: a lobby asks thousands of
  positions and its budget is 3,000 searches a day. Stockfish in the Worker would be a big change to the engine lane's
  code and costs CPU on every bot move. So the Worker scores moves by material two plies deep (a capture it can take
  back costs the taker its piece) and mate in one, with a small nudge to the center and castling (about 6 ms a position).
  It's only for when no device can answer: nobody connected, or devices too slow. A bot waits for its devices until
  1.5 s before its deadline, never longer.
- **Halves.** A half ends when everyone with a duty has locked in, or when the last deadline of anyone still choosing
  has passed, plus the network's 300 ms grace (the Crowd lobby's `lateGraceMs`); a choice after a deadline and its
  grace is refused ("late"). A choice names its half (`seq`), so a late message never lands in the next one. Bots
  blocking in the final think as if on the picking squad's clock (as in the sim).
- **Who sees what.** Choices go out as the rules' `visibleChoices` allows each player. Who has locked in goes to
  everyone: every squad's clock on screen needs to know who is still thinking. A resolved half is public.
- **Takeover and leaving.** A person whose seat a bot took over (three misses in a row) can take it back from the next
  half (`reclaim`): the rules' takeover is permanent, but a dropped connection shouldn't cost the rest of the lobby.
  Leaving while your squad still plays hands the seat to a bot at once (no point in three random moves first).
  Leaving once your squad is out just goes: you can queue again.
- **Armageddon's color** is picked by any person on the choosing squad during the intro, the last pick standing;
  nobody picks, the bots' Black (draw odds).
- **Rewards** (unranked; numbers in `SQUADS_LOBBY.rewards`, for Eric to tune): 1st 100 coins and a crate, 2nd 60 and a
  crate, 3rd-4th 40, 5th-8th 20. Paid when the bracket decides the squad's placement (a squad out in round 1 is paid
  then), to each person still playing their seat (not one who left, nor a seat a bot has taken over). Every signed-in
  person on the squad gets the result on their profile (mode "squads", placement 1, 2, 3 or 5 of 8 squads). Coins go
  in the wallet; crates are counted in a new `wallets.crates` column (an `ALTER TABLE` at runtime, as every column
  since the first) for when crates stop being free, and move with a guest's coins when they sign in.
- **Test controls** are gated like the boss battle's trigger: admins (ADMIN_EMAILS), with a settings switch
  (`SQUADS_LOBBY.testControls`) that removes them everywhere. For local runs and the e2e suite, the Worker variable
  `SQUADS_TEST=1` lets anyone use them (like `OPS_STATS`: never set in production). "Next round" ends the earliest
  unfinished round with the rules' `endByMaterial` and starts the next round's matches 3 s later; in the votes it
  closes them. A test lobby (`POST /api/squads/lobby?start=pairs|final`) skips the rounds before, the squad with more
  people going through (so testers reach the round they want), and may set its own clock. Nothing is recorded or
  rewarded in a test lobby, or in any lobby after a test control was used.
- **A lobby with nobody in it plays on.** As Crowd's: its bots reach the results (people who left may still be placed
  and paid), and the abandoned cap (180 minutes) is the backstop. A lobby whose fill time comes with nobody connected
  waits for the next person. Should the rules ever throw in a match, the server ends it by material rather than
  leaving an alarm failing forever.
- **The protocol** is its own file (`squads/protocol.ts`) with a version number in every `hello` and `welcome`
  (`SQUADS_PROTOCOL`, 1); an app on another version is told to reload. Crowd's protocol is untouched.
- **Team clocks** (Eric's one bank per squad for the tournament, built in the rules alongside this) stay entirely in the
  rules' functions: the server starts them when the bracket is drawn, keeps what each match leaves, and shows them.
  Every player gets every squad's clock (beside its name and rank on screen): in the lobby view, and a `clocks` message
  whenever a half begins or ends anywhere. During a half the screen runs a clock down from what it already has (the
  match's banks and free seconds, its duties, who has locked in); the exact bank comes with each half's result, so the
  server sends nothing per second.
- **Out of time is not a no-show** (the rules' `timeouts`, as the team clock's decision asks): a miss on the person's
  record, but not one of the three no-shows that hand the seat to a bot, so a slow move in sudden death never does.
  Except for someone who isn't there (disconnected, and no move made): that's a no-show as any other, or an absent
  player in sudden death would play random moves for their squad for the rest of the lobby. A half isn't cut short
  when a bank runs out: anyone still thinking may still make their move until the ceiling (late, but there).
- **Measured through the real server** (`scripts/squads-headless.ts --device` against `wrangler dev`, the Normal clock's
  numbers, one idle person whose device did the bots' engine work): a full bot lobby took 28.9 minutes from the fill
  to its results (round 1 over at 11 minutes, round 2 at 21, the final 8 minutes), in line with the sim's 33-minute
  median. The device answered 1,336 jobs; every board ended in mate. (A run before the duplicate-line fix, its device
  benched, played most moves from the quick look: boards ran to 150-230 plies by repetition and the lobby past an hour.
  The quick look is a last resort, not a bot.)
- **Left for later:** the live line (online, matches running, in queue) and the matchmaker's overload limit don't count
  Squads yet; no quick chat in Squads lobbies; the app's side of bot work arrives with phase 3's screens (until then a
  real lobby's bots use the quick look).

### Squads, phase 3: the screens (Oct 11, 2026)

Squads is playable: the menu slot, parties, the waiting room, the votes, the standings with every squad's team clock,
Relay, Pairs, Pick and Block, the final's staging, spectating, the results, the test controls on screen, the app's side
of bot work and the sounds (docs/areas/squads.md, "The screens"). The calls:

- **The menu.** Squads takes Classic's spot (Crowd · Squads · Boss raid), as Eric's brief says; Classic stays playable
  by link (`?mode=classic`) while it's reworked, so its tests and solo games still run. With Squads picked, PLAY is the
  solo queue and the Matchmaking row (Default, Bots off, Solo) gives way to one **Party** button: Squads has no Solo
  (the server runs it) and always fills with bots, so those choices don't apply. "Play with friends" opens the party
  too. Guests where online play needs signing in get "Squads is online · Sign in to play".
- **Parties are a sheet over home**, like "Play with friends": code, invite link (copy, or the phone's share sheet),
  members with the leader marked, empty seats saying a bot fills them, PLAY for the leader only. Closing it leaves the
  party. An invite link fills in the code (one tap to join, as Crowd's lobby links do); a device already in the party
  goes straight back in. When the party is placed its socket closes (members stay members), so a member still in a
  lobby can't be pulled into the next one; "Back to your party" after the lobby reconnects. A placing is acted on once
  (remembered per party), so reopening the party never rejoins an old lobby.
- **Squad names and colors are the app's**, by squad id (Rooks, Knights, Bishops, Queens, Kings, Pawns, Towers,
  Crowns): the rules number squads, a name and a color make eight of them tellable apart in a strip at 360 px. One
  short word each (checked at 360 px in e2e).
- **Standings:** a side panel on a computer (from 1100 px, where the arena has room, as Crowd's tower), a strip of
  eight chips on a phone (name and clock; a tap opens the table with members, plus the bracket). Ordered by how far each
  squad got, a squad still playing above one knocked out at the same stage. Sudden death is a red, pulsing "SD" (the
  panel says "Sudden death"); the pulse is a shadow and a scale, never a color transition (LESSONS).
- **The clock on screen runs from what the client already has** (the server sends nothing per second): each move still
  being thought about drains past the free seconds; a duty stops draining when its players have all locked in (when
  this device saw it). The exact bank arrives with each half. ▼, or ▼▼ when two moves drain a bank at once.
- **No eval bar in Squads**, on the votes or the boards: "no engine in the game". The vote board is Crowd's, given
  Squads' own votes, every pawn on one side (squads aren't sides).
- **Tiny boards:** every match's boards in a group with its two squads' colors along the top, your squad's ringed;
  the latest round's finished matches stay grayed until the next round's start. YOU and NEXT follow the board you're on
  (during the moment after a turn's second half, still last turn's). Tappable once you've moved or locked in, and
  whenever you have nothing to choose; a new half that asks something of you brings you back to your board.
- **What shows at once:** your Relay move is on your board as soon as you make it and stays (the half resolving later
  plays the same move: no snap-back, checked frame by frame); a pick or block shows at once, kept on top of the
  server's view until the server has it, so it never blinks out when someone else's choice arrives first.
- **The reveals** reuse Crowd's ghost-move reveal (`ShadeMoves`): ghost pieces with their pickers' names (a bot's last
  word, so two tags side by side fit), a reel stepping between the two picks and landing on the coin's, then the move
  plays with its knock. The final adds ghost arrows for the picks, both blocks, then the active one slamming down as a
  red lock on its square (or no lock: the mercy rule, a missed block, a canceled one, said in words). The reveal's
  words go in the line above the board, not over the squares. Each reveal fits the show the server gives it (3 s
  Pairs, 4.5 s the final). The reveal draws on its own frames; the rest of the screen is drawn again only at its
  moments (perf).
- **Staging:** every match opens with a card over the board for its break (round, squads, one line of rules, the
  count); the final's is "SQUAD FINAL" with both squads' members. A finished match is marked over once its last half's
  show ends (the server says so only in the bracket), so a knocked-out player's screen moves on to the live final.
- **Knocked out** is a sheet (in view on a phone, unlike a card under the board): Spectate the bracket, or Queue
  again (Back to your party). Leaving mid-match is at the standings' foot and asks again while your squad still plays,
  since a bot then takes the seat for good.
- **Sounds:** the big board's own knocks for moves; a quiet tick (`sqTick`, a clock tick at under half the timer's
  level) at 2 s and 1 s of your free time left while you still have a choice to make (blockers aren't on the clock: no
  ticks); a short low "dun-dun" sting (`sqSting`, muted brass through a low-pass, no bell partials) when a squad on the
  big board enters sudden death: the moment its clock hits zero on screen, or the half's `sudden_death` event, once
  per squad until it's out of it again. Both measured quieter than a move (peak and RMS, rendered offline, in e2e);
  everything through mute. No chimes: the vote's result tones and timer ticks are off in Squads.
- **Bot work:** answered from the page's engine pool as Crowd's judging is (one speed check per page, shared), every
  engine at once; no answer leaves it to the other device or the server's quick look. A knocked-out player's open page
  keeps answering.
- **Test controls on screen** only when the server's `welcome` says so: "Next round" beside the match's title, "Skip
  votes" in the votes (the server's `nextRound`, which closes them). The test lobby: an admin's Party sheet has Relay ·
  Pairs · Final, and a link Eric can open on any device: `/squads/test/pairs` (also `relay`, `final`, and
  `?clock=BANK,TOPUP,FREE,INC` for a team clock in seconds).

### The board's coordinates, inside the edge squares (Oct 11, 2026)

Eric saw it on a Squads Relay board, flipped for Black: the file letters were a column off (none under the first
column, "H … B" from the second, "A" outside the board) and the rank numbers sat on the lines between rows. It was
every big board in every mode, either way up: the app never styled chessground's coordinates, and chessground's own
CSS puts them off the squares (files 24 px to the right across the board's full width, ranks 20 px up). The calls:

- **Where:** each rank's number at the top left of its square in the left column, each file's letter at the bottom
  right of its square in the bottom row, either way up. That is where Hollow's night draws its own coordinates, so they
  don't move when the night covers the board. Exactly an eighth each (a flex basis of 0), in chessground's container,
  which is the board itself.
- **Under the pieces,** as on a printed board, tucked into the corners, where a piece's base only just reaches a
  letter's edge. Drawn over the pieces they read badly where they cross one (dark on a black piece, white on a white
  one).
- **Color by the square under each label:** white on the dark squares, dark brown on the light ones (the brown theme's
  own coloring assumed ranks on the right edge, so it was wrong for the left column). Bold, 9 px on a phone's board,
  growing with the board to 14 px on a computer.
- **Tests:** `boardCoords` / `expectCoordsInSquares` in `e2e/helpers.ts` measure each label's text against the square
  it names; Squads' Relay test checks your board and next turn's (the other way up), and a Crowd "everyone moves" test
  checks both ways up as the board turns to the side to move. On a phone and a computer.

### Sawyer's split: a morph, not halves (Oct 11, 2026)

- **Eric asked for it:** the saw goes through the pawn, which squashes and pinches into two smaller whole pawns (about half size) that hop to their squares, all in the same 3.6 s moment. The old cut-in-halves look stays behind one switch, `SAWYER_LOOKS.split` (`"morph"` | `"halves"`, `packages/core/src/settings.ts`); setting `"halves"` brings back the old animation and the half-drawn pair.
- **My call:** the two small pawns grow back to a pawn's size as they land, and the board then draws them as ordinary pawns (no halves), because the rules treat them as ordinary pawns. If Eric wants them kept small, set `SAWYER_LOOKS.settle` to `"small"`: they stay small on every board.

### Beta Crate · Series 001, batch 1: the crate, the old shop hats, a Winter scarf (Oct 11, 2026)

Eric asked for a second crate series built from themes (secret agent and pirate split into parts of different rarity,
a one-off Smiley Face), with the shop's free pawn hats moved in, one more full theme, and a Winter scarf. It ships in
batches, so he can check the look after each. The full plan, the odds and the batches are in
`docs/history/shop-and-crates.md` ("Beta Crate · Series 001"). The calls:

- **Tiers (the director's mapping; Eric asked to confirm):** his four groups onto our top four, in his order. Tommy
  Gun and Parrot are Mythic, Pirate Hat and Smiley Face Legendary (all four through Fischer Random), Suit and Tie Epic,
  Dark Shades and Wire Earpiece Rare. A tier is one field in `ITEM_DEFS`.
- **A tier is now truly one field:** a crate lists all its items once, and each item's tier says where it is (a box,
  or behind Fischer Random). Fischer Random's odds are per tier (Legendary 80, Mythic 20), shared evenly, exactly
  Winter's old 40/40/20. Winter's rolls are unchanged.
- **The pawn hats move into the Beta crate (Eric confirmed):** Party Hat, Wizard Hat and Top Hat Common, Viking Helm
  and Little Crown Uncommon, now painted like any crate item. The shop's hat slot is retired, with no "No hat" left
  behind; stored test hats are ignored, never a crash. God King looks stay in the shop. Eric's reason: the shop will
  later sell other things, such as new boss animations and new attack animations (way down the road), so God King
  packs belong there, separate from crates. Bots that wore a shop hat now wear the same hat as a crate item.
- **Same odds as Winter:** boxes 40/26/18/14, Fischer Random 2%. Every tier holds something from batch 1, so the strip
  stays whole at the same odds all along. If a tier is ever empty, the strip leaves it out (no crash), and a test fails.
- **The container is a supply box:** a wooden crate with steel corners, a band in the tier's color and a stenciled
  star. The crate itself is olive drab, stenciled BETA 001. Beta is listed first, with a one-line blurb and an item
  count on each crate.
- **The third theme is Ninja:** it reads at pawn size and makes the playground trio with pirates and agents.
- **Suit and Tie rolls two colors** (the suit, the tie). **The Wire Earpiece is a head item**, so it can be worn with
  Dark Shades (face). **The Smiley Face's features turn white on Midnight**, where dark ones vanish.
- **28 items when complete,** 8/7/5/4 in the boxes, so each tier's items end up rarer than the one below's (5.0, 3.71,
  3.6, 3.5, 0.8 and 0.2%). In batch 1, the lone Rare and Epic items are 18% and 14%, as Winter's lone Antlers were.
- **Winter Scarf (Uncommon, face):** pieces gain a `neck` anchor (pawn 34, snowman 30, gingerbread 34), because a
  scarf sits at the neck, not on the beard line. Face, so it goes with a beanie or a Santa hat. Antlers go from 26% to
  13%, the Scarf 13%.
- **Batch 1 odds (Beta):** Party Hat, Wizard Hat, Top Hat 13.3% each; Viking Helm, Little Crown, Eyepatch 8.7% each;
  Dark Shades 18%; Suit and Tie 14%; Smiley Face 1.6%; Tommy Gun 0.4%.
- **The fitting sheet** gained a short mode for showing a batch (`sheet=1`: each item as a card and on both pawns,
  plus whole outfits).

### A human-like boss: Maia-3 for Ginger (prototype, Oct 11, 2026)

Eric wants to try a boss that plays like a person, not like Stockfish held back, and choose how it should behave by
playing it on his phone. The prototype: Ginger in Boss alone, her moves picked by **Maia-3**, the human-like chess
model from CSSLab at the University of Toronto (Chessformer, ICLR 2026). No calibration across all bosses yet.

- **The license (Eric's decision, followed exactly):** Maia-3's code and weights are AGPL-3.0; Eric won't publish the
  game's source, and accepts the "separate program" approach. So Maia lives in its own box, `packages/maia-worker/`:
  its own `LICENSE` (the AGPL text), a `README.md` with the provenance and every conversion step, the conversion
  script, the worker's source and its tests. It's built to a standalone worker plus the model, served from
  `/engine/maia/` with `LICENSE.txt` and `NOTICE.txt` beside them, as Stockfish is. The box imports no game code; the
  game imports none of the box: it starts the worker (`packages/app/src/maia.ts`) and exchanges plain-text,
  UCI-style lines with it (`uci`, `isready`, `setoption name UCI_Elo|Temperature|TopP|MultiPV`, `position fen`,
  `go [searchmoves …]` → `info … multipv k … p <probability> pv <move>` lines, then `bestmove`), through
  `HumanUciEngine` (`packages/chess/src/human-uci.ts`), the same kind of transport as Stockfish's. My call: `p` comes
  before `pv` (UCI ends an info line with its pv; the game's parser takes either order).
- **The model:** the official `UofTCSSLab/Maia3-23M` checkpoint, converted by our own script (ONNX, opset 17) and
  quantized to int8 (onnxruntime's dynamic quantization). Checked against the official PyTorch model: fp32 matches to
  5e-5; int8 has the same top move in 106 of 108 positions × ratings (the 2 others near-ties). No third-party export.
- **Hosting:** the int8 file is 25,191,199 bytes (24.02 MiB), under Cloudflare's 25 MiB per static asset, so it's an
  ordinary asset: no R2, nothing paid. **Committed to git** (`packages/maia-worker/model/`): Workers Builds deploys
  from git and can't run PyTorch, so a build-time conversion isn't possible, and a download at build time would make
  every deploy depend on Hugging Face and on a file we'd have to host somewhere anyway. The cost: about 20 MB of
  repository per model version (it barely compresses). Git LFS not used (an extra moving part for Workers Builds).
- **The brains** (`BOSS_BRAIN` in settings.ts, the rule in `boss-brain.ts`, hooked into `bossMoveFrom`):
  `stockfish` (today's boss), `maia-raw` (Maia's own move, no guard), `maia-light` (no move giving away more than 25
  points / 2 logits against Stockfish's best), `maia-full` (today's guard, 10 points / 1 logit; strict, 4 points /
  0.5 logit, at Maia 3000). The guarded ones try Maia's own draw first, then its likeliest other moves (at least 3%, at
  most 5 tried), and play Stockfish's best only if none pass. The veto reads the top-8 search the boss already runs:
  no extra engine work, so a move outside the top 8 is turned down rather than searched (my call). The judge, the
  powers (`allowed`, passed to Maia as `searchmoves`), the King's strike (Stockfish's own step back) and the speech
  are untouched. Under Maia the stumble roll is ignored: Maia's own mistakes take its place (my call).
- **Ginger's default is Maia, no guard (Eric, Oct 11):** "the guard existed to stop Stockfish-at-Elo playing well and
  then randomly suiciding; Maia's mistakes are human ones, so the guard isn't needed." She plays at Maia's natural
  human strength, mistakes included; her edge comes from her powers. The light and full guards stay, in settings and
  in the admins' Brain picker, so he can compare.
- **Mild sampling (my call):** Maia's move is drawn from its own probabilities at temperature 0.8 with top-p 0.9 (the
  official engine's two options): a little sharper than a human's spread, none of the rarest moves, and it doesn't
  repeat itself game after game. Both are in `BOSS_BRAIN`.
- **Maia's rating** follows the boss's strength: about 1100 at 1400, a straight line to 2000 at 2400, then 3000 at
  2600, held to 2800; from 2800 Stockfish always (`BOSS_BRAIN.maiaRating`, `stockfishFrom`). My call: "strength" is
  what Stockfish would play the boss at (the tier, the boss's own offset and solo's difficulty), because that's what
  the earlier measurements matched Maia against, so the offset and the Easy–Hardest picker keep working.
- **Who meets it (my call):** in the prototype only admins do (`BOSS_BRAIN.forPlayers` false): Maia reaches players
  only once its source is published (Eric's OK; below) and the bosses are calibrated. Players meet Stockfish exactly
  as before and never download Maia. Online battles are always Stockfish.
- **Never waiting for Maia:** it's asked alongside the top-8 search; no answer within 1.5 s of the request
  (`timeoutMs`), not loaded yet, failed, or a broken worker: today's Stockfish move. A load that takes over 60 s is
  given up for the battle.
- **Loading:** the worker starts as the battle's intro begins (the model loads during it). The boss menu fetches the
  files ahead when Maia may play. The service worker doesn't precache them (about 29 MB to download, 40 MB unpacked) but keeps them once fetched,
  in their own cache named by their contents (an app update keeps it; a new model replaces it). The worker is ended
  after the battle, freeing its few hundred MB.
- **Testing (admins only):** a Brain picker in Boss alone's boss menu (Default · Stockfish · Maia, no guard · light
  guard · full guard; also `?brain=<id>`), applying to whichever boss you meet (Ginger is the pilot; the rule is the
  same for every boss), and a debug line under the dock: "Maia 1190 · no guard · Maia's #2 · 90 ms", "guard → Maia's
  #2", "guard → Stockfish", "Stockfish (Maia loading)".
- **Credits (Settings):** "Bosses and bots use Stockfish (GPL-3.0, source) and Maia-3 by CSSLab, University of Toronto
  (AGPL-3.0), each a separate program running in your browser. The source of our Maia box is available on request
  (notice, license)." Eric asked for both names in one line (bots will use Maia too, later).
- **What the sanity runs show (`reports/maia-boss.md`; small samples, plain chess, no powers):** raw Maia makes Ginger
  much easier at these ratings. Against the same strong bot player at tier 1600 (Ginger 1500, Maia 1190), the player
  scored 1.5 of 8 against today's Stockfish Ginger, 5 of 8 against Maia with no guard, 5 of 8 with the light guard and
  1.5 of 8 with the full guard. Per move in a live game, raw Maia gave away 10.8 points on average and over 25 points
  on 21% of its moves (today's Ginger: 1.7 and 1%). Maia's own likeliest move at 1190 already gives away over 25
  points 8% of the time in such positions; the mild draw makes it 13% (temperature 1: 16%). So keeping her as hard as
  today on the raw brain means a higher Maia rating: that's for the calibration. A whole boss move took about 0.5–0.8
  s here with Maia (the top-8 search plus Maia's ~80 ms), against 1.4 s with Stockfish (which adds its UCI_Elo search).
- **Before Maia reaches players (pre-launch, needs Eric's OK; in ROADMAP.md):** publish the Maia box's source (a public
  repository or a download on the site; until then "on request"), and calibrate every boss.

### Maia: the plan beyond the prototype (Eric, Oct 11, 2026)

Recorded with the prototype; not built yet except where it says.

- **Models:** bosses use the 23M model (built). Non-boss bots (Crowd, Squads) will later use the smaller 5M one (the
  same conversion, `convert.py --model 5m`).
- **Game quality first:** the boss model isn't shrunk for old phones. A device that can't load Maia, or runs it too
  slowly, falls back to today's Stockfish brain automatically, so nobody is locked out (built: the fallback above).
- **Strength:** a boss still follows the crowd's ratings (people only) plus a margin, because a crowd voting together
  plays above its average; calibration sets the margin later. Above Maia's ceiling Stockfish takes over. Between them
  a bridge band (around 2600–2800) ramps through Maia with the light guard, then Maia with the strict guard (and
  perhaps a share of Stockfish moves), so strength never jumps. (The prototype holds Maia 3000 from 2600 to 2800,
  then Stockfish.)
- **Credits:** one line naming both, Stockfish and Maia-3, for bosses and bots (built).

### Boss screen polish: the eval bar at the back, the God King facing the boss, Hollow's lights (Oct 11, 2026)

Three visual fixes Eric asked for from a screenshot of a Hollow battle on a computer. The calls:

- **The eval bar is behind everything beside the board.** The board's row is a layer of its own (`isolation`) and
  the bar sits at its back (`z-index: -1`), so the boss by the corner, his strand, his effects and his words all draw
  over it. Nothing moved: Eric likes a sprite overlapping the bar a little.
- **Computer only, the God King mirrors the boss** (Eric: no room on a phone, so the phone is unchanged). Same
  breakpoint as every desktop layout (`min-width: 900px` and `min-height: 600px`). His feet on the board's bottom edge
  like the boss's, his middle as far right of the board as the boss's is left of it (86 px with the eval bar, 62 px
  without), measured within 2 px at 12 desktop sizes. The status box is the board's width, centered under it. The board
  keeps its size (the room his old spot in the dock took stays free under the status box); growing it would change
  every boss screen's layout, so it's left for Eric to ask for.
- **His words and his menu open outwards** (to the right, away from the board) on a computer, as the boss's do: over
  the board they would hide pieces. A box that would leave the screen moves back into view as before.
- **The column beside the board makes room for him.** From 1100 px an online raid's chat (and from 900 to 1099 px the
  scoreboard) would otherwise sit under him: it starts where he ends (`--gk-clear`, from the same sums as the board's
  size), up to about 100 px narrower when the board fills its column. Boss alone has nothing there.
- **The Last Stand's leap:** he no longer shows again in his spot for a moment as his leap ends (a 200 ms fade did
  that), and his shadow no longer stays behind as a gray dome while he leaps. Both were there before the move too.
- **Hollow's lights: 8 colors** in `HOLLOW_LIGHTS` (settings.ts): red, yellow, blue, green, orange, purple, pink and
  cyan, each a glass color and a shade; the glint and glow are made from the glass. Purple and pink are kept bright
  and clear of his own violet.
- **"Never repeat" means neighbors** (with ten bulbs and eight colors, no order can avoid repeats): a bulb's color
  differs from the next three bulbs' along the wire either way. The next one is its neighbor, but his countdown to
  the next cover puts every third bulb out at a time (with a third lit, bulbs 0, 3, 6 and 9 show side by side), and
  the first screenshots had two reds three apart looking like neighbors. Within three, no two bulbs that ever show
  next to each other match. Bulbs 4 and 5 (either side of his hand) count as neighbors; the two ends don't.
- **The same lights for everyone in a battle:** Hollow's view sends `lights`, a number from 0 to 4095 drawn from the
  battle's seed (`powerRoll(seed, "lights")`). Only 12 bits, so it can't be used to work out the seed and foresee his
  powers. It's a new optional field, not a new message; an older server without it gets a random order per battle on
  each device.
- **Recolored as drawn, not redrawn:** the art is code-drawn, so each of the ten bulbs got palette keys of its own,
  drawn in default colors (red, yellow, blue in turn, as before), and a per-key color swap (`Swap` in sprite.ts)
  turns them into the battle's colors wherever his frames are drawn: his sprite and every moment, his attack and its
  lashes, Lights out, the strip by the boss bar. The swap keeps whatever a frame does to a bulb (out, flickering,
  flashing), so a bulb keeps its color through every frame. The strip's three bulbs and the lashes take the first
  three bulbs' colors, always three different ones. Lights out still puts a third of the strand out at a time (bulbs
  2, 5, 8 first), now by position rather than color.

### Piece sounds you pick: a Move sound and a Capture sound (Eric, Oct 11, 2026)

Eric: "Add a few options: sound packs for the chess sounds … free to use … split them up so you can select whatever
capture sound and whatever move sound you want", in Settings with a play button.

- **Two pickers in Settings → Sound**, each option a radio with its own ▶: Move sound (Wooden knock, Light wood, Poker
  chip, Click, Soft) and Capture sound (Double knock, Heavy wood, Chips, Clack, Thud). Today's wooden knocks are the
  first option and the default, so nothing changes for anyone who doesn't pick. Kept on the device (`brc.moveSound`,
  `brc.captureSound`, like the mute switch; accounts keep no preferences); an unknown or old id reads as the default.
  The list and the storage: `packages/app/src/piece-sounds.ts`.
- **Where the sounds come from (licenses first):** two picks of each from Kenney's CC0 packs (*Impact Sounds*, *Casino
  Audio*), and two of each made for the game by `scripts/piece-sounds.py` (a few decaying partials and a short burst of
  noise: ours outright). Nothing CC BY, so no credit line is owed in Settings (Kenney's welcome but not required: left
  out, like the God King's CC0 packs). Every file's source, author and license: `public/sounds/SOURCES.md`. Lichess's
  sets are out (AGPL, CC BY-NC-SA or non-free, per its own `COPYING.md`); Freesound's CC0 "Piece Placement" (el_boss)
  would do but Freesound refused the download from here.
- **Leveled to today's sounds** (my call): each file starts on its hit and its loudest 30 ms, heard through a phone
  speaker (high-passed at 200 Hz) and the game's 6 kHz low-pass, matches today's move or capture. Kenney's chips were
  pitched down a fifth: as recorded, most of them was above the low-pass and they'd have had to clip to be as loud.
  mp3 like the rest (Safari), 2–4 KB each.
- **Everywhere a move or capture sounds:** the big board's knock (every mode, replays included) and Classic's ripple
  of moves across the boards use the pick. **Castling** (my call): today's king-and-rook knock with the default move
  sound; with another, the picked move sound twice, 110 ms apart (king, then rook), so it matches. **The judge's
  gavel** at a Crowd cut stays today's wooden knocks pitched down, whatever the pick: it's a gavel on a block, not a
  piece.
- **Light:** the first tap loads only the picked two (and today's two, which the gavel uses); the rest load when
  previewed. Until a picked file has loaded, or if it can't, today's knock plays: a move is never silent because of
  a pick. (The service worker still precaches every file for offline play: the new ones are 23 KB in all.)
- **Previews play with the sound switched off** (my call): ▶ is a tap asking to hear it. Picking an option plays it
  too, like a phone's ringtone list. Mute still silences every sound in a game.
- **Flagged for Eric: the defaults are GPL-3.0** (PyChess, chosen Oct 2 "the same license as the app"). Since the
  Maia decision (Oct 11) the game's source isn't published, which GPL assets in the bundle don't fit. Eric asked to keep
  today's sound as the default, so it stays; switching the defaults to a CC0 or our own option (Light wood and Heavy
  wood are the closest) is a one-line change in `piece-sounds.ts` (and castling's knock would need a new file too).
- **Tests:** `packages/app/test/piece-sounds.test.ts` (storage, fallback, files present, small and credited);
  `e2e/piece-sounds.spec.ts` (pick, preview, reload, what loads, and every file decoded in the browser: starts on its
  hit, as loud as the default within 2 dB).

### The FAQ: "How HunChess works", in Settings (Oct 11, 2026)

Eric: "I want to put in the app a full explanation of how things work… call it the FAQ… maybe have a table of
contents. Put it in the settings." With the math of how a strong boss switches from Maia to Stockfish first, and how
the God King's save comes into play. The calls:

- **Where:** Settings → HOW TO PLAY, a row "📖 FAQ · How it works" above the short rules, opening its own page at
  `/faq` (back goes to Settings; the computer's side menu keeps Settings lit). A link to a heading works too
  (`/faq#faq-handover`).
- **One file of words, every number from settings** (`packages/app/src/faq/content.ts`): each section is a function of
  `FaqSources` (the settings objects: `DEFAULT_SETTINGS`, `BOSS_POWERS`, `BOSS_BRAIN`, `BOSS_ROSTER`, `CRATES`…) that
  returns its text in a small Markdown-like format (`faq/markdown.ts`: headings with anchors, lists, tables, formula
  lines, notes, links). No Markdown library (nothing new to download for a page few open). Worked examples are worked
  out by the game's own functions (`scoreGroup`, `maiaRatingFor`, `bossStrength`, `lastStandBar`, `kingCharges`), so
  they can't drift; a test builds the FAQ from changed settings and checks the words follow. Two numbers that lived as
  literals in code are now named so the FAQ can quote them: `BRILLIANT` (scoring.ts) and `ENGINE_MIN_ELO` (boss.ts,
  used by uci.ts). The boss's top-8 search is a literal in `bossMoveFrom`, so the FAQ says "its best moves" instead.
- **The contents:** every section, plus the sub-headings of the three Eric cares most about (how a boss decides its
  moves, the powers, the God King), each a tap-to-jump link; every section ends with "↑ Contents".
- **What's marked:** Maia is "Being tested; coming soon" while `BOSS_BRAIN.forPlayers` is off (the note flips by
  itself when it's on); the bridge band between Maia and Stockfish (2600–2800) is "Planned" (today Maia holds at 3000
  to 2800, then Stockfish). Classic gets one line: off the menu while it's redesigned.
- **True to the code, where the brief's shorthand differs:** a raid's boss is matched to the people in it (bots never
  count); the Crowd's boss battle is set from the last ten's ratings in that match, weighted toward the best, minus
  100, whoever they are (bots among them count, as `startBoss` does). The rating-gap formula is the usual one, shown
  as a guide to the boss menu's "+N vs you", not something the game computes.
- **Security:** only how the game works for a player. Nothing on how the app talks to the server (messages, routes,
  who scores what, the engine server), limits, secrets, admin or test controls, or how cheating is detected; fair play
  says what happens, not how it's found. A unit test checks the text for the obvious words.
- **Keeping it true:** a rule change changes the FAQ's words in the same PR (docs/areas/hub.md, `.claude/LESSONS.md`);
  every playable boss must have its block in `BOSS_BLOCKS` (the test fails without one).

### Quick fixes: Ginger's ice on its square, the timer bars at the back, the queen banners silent (Oct 11, 2026)

From Eric's screenshot of Ginger's blizzard on a computer, and his word on the queen banner. The calls:

- **Why the ice didn't line up:** each block was already one square-shaped sprite, the same for every piece, but it
  was placed and sized in % of the board's wrap, which is up to 8 device pixels wider than chessground's own board
  (the lesson "A ring a few pixels off its square" again). At a board of 552 px in a 555 px wrap, the blocks drifted
  up to 2.6 px right and down toward the h-file and rank 1, so the king's block on g1 sat flush right and 6 px in on
  the left, and rank 1's blocks ran into the bar under the board. Now the ice and the cold burst as it forms are
  placed in eighths of `--cg-size` (`onSquare`), like every other boss's squares: 0 px off on every square, both ways
  up, on a phone (312 px board in a 314 px wrap) and on computers (456 and 552 px boards). `e2e/boss-powers.spec.ts`
  checks every block within 1 px of its square, all one size.
- **The block keeps its one-pixel inset** (1/32 of the square: about 1.2 px on a phone, 2 px on a computer). Flush to
  the edge, neighboring blocks would merge into one sheet with doubled outlines; with it, each piece reads as its own
  block of ice. It's static while frozen (only the glint sweeps across it).
- **Every timer bar is at the back** (`.timer-bar`, `z-index: -1`), as the eval bar is: the board's wrap isn't a layer
  of its own, so the bars go to the back of the board's row (a layer, `isolation`), behind the squares' overlays, a
  boss's sprite, effects, banners and words, and the God King. Nothing moved. Before, the bar under the board drew
  over the rank-1 ice and the power layer on a phone and over Hollow's sprite on a computer; after, everything that
  crosses a bar draws over it (checked for all six bosses with their ultimates, phone and computer, and on the
  Crowd's vote, watching and play screens, where the bars still show whole).
- **The queen banners are silent** (Eric: the gasp sounded wrong; keep the banners and any other sound). The gasp was
  the only sound either banner played (QUEEN DOWN! and QUEEN SLAIN!), so they now play nothing; the capture's own
  sounds and the boss's reaction are unchanged. The clip stays in the repo, unused
  (`public/sounds/banner/queen-gasp.mp3`, still `queenGasp` in `sound.ts`, so bringing a sound back is one prop on
  each banner in `screens/Boss.tsx`). It's still fetched with the other samples (8 KB); left so to keep `sound.ts`
  untouched while its settings are being worked on.

### The Crowd's 10:00 that "goes back to 10 minutes after every move" (Oct 11, 2026): working as designed, not changed; settled Oct 13

**Settled (Oct 13, 2026):** the increment banks as in real chess, and that's how it stays. Eric asked for real chess
time controls ("the games should follow normal chess timer variations"), and on a chess clock a quick move keeps the
seconds it didn't use. So the "free seconds" change below is off the table, and the 10-minute bank is now Rapid 10+5,
one of three time controls (see "Crowd 50 v 50: three chess time controls (Eric, Oct 13, 2026)").

Eric, in a 50 v 50 against bots: a 10-minute timer that seemed to go back to 10:00 after every move. It's your time
bank (the board's clock at the top right, after this move's seconds, and the scoreboard's BANK), and it works as Eric
set it on Oct 2: 10 minutes for the match, **+5 s added at the start of every move**, and no move longer than the
move clock (20 s in Crowd). So a move made in about 5 s costs nothing, a quicker one adds to the bank, and only the
seconds past 5 drain it, at most 15 s a move. Measured in a solo 50 v 50: moves of 8, 3, 8 and 2 s took the bank
10:00 → 9:56 → 9:57 → 9:54 → 9:56, and each move's clock opens 5 s above the bank (10:01 on a 9:56 bank) before
draining. In 50 v 50 you move about 20 times before the final, so even 15 s a move uses only half the bank.

- **Not changed:** the only way to make it "consistently go down" is a rule change, so it's Eric's call. The smallest
  one: make the 5 s free seconds, as Squads' team clocks already are (the bank stands still for the first 5 s of a
  move, then drains; unused free seconds aren't banked). `applyRound` would charge `max(0, think − 5 s)`, the board's
  clock would show the bank holding, then draining, and it would never go up. A display-only change (holding the bank
  at the start instead of jumping up 5 s) isn't clearly right: under the current rule a quick move still adds to the
  bank, so it would jump up after the move instead.

### A board lab at /boardlab, for choosing chessground's replacement (Oct 12, 2026): throwaway; remove or admin-gate before a public launch

A bare page, not linked anywhere, where Eric can feel candidate boards on his phone: today's board (`?board=cg`),
cm-chessboard (`?board=cm`, MIT) and one written from scratch (`?board=own`), with chips for slide speed, drag, move
dots and piece set. Chessground is GPL-3, which doesn't fit a closed-source game. Its code is in
`packages/app/src/boardlab/` and loads only on that path (`main.tsx`), so the game's bundle doesn't grow. It must be
removed or put behind an admin check before a public launch: it's a debugging page anyone could open.

### Rage meters: every boss's ultimate again and again; the King's strikes add rage; Ginger's random free piece (Oct 11, 2026)

Eric: "every boss can ult multiple times a game; that's how a typical rage meter works. When you strike bosses, it
should build their rage meter faster, like a video game thing. Ginger's ult: it's one piece chosen at random, not the
queen anymore. His meter should build up a bit faster because his ult's kind of weak: about twice per game." The calls:

- **The cycle.** The meter is full on the ultimate's own turn, then empties. While the ultimate's effect still runs it
  stays empty and nothing gathers (time, the eval, material lost and strikes alike: anything gathered is let go), and
  no other ultimate can come, from the meter or the admins' trigger. Once the effect is over, `warnAt` and `ultAt`
  clear and the meter fills again from empty (`rageUsed` holds what's been spent; `ults` counts them). Rage past full
  is let go too: an ultimate empties the meter whatever it held.
- **When an effect is over** (each boss's `ultimateRunning`): the blizzard and the Big Bounce after their own turn; the
  funhouse after its flipped turns; the Roman candle once its last fireball has landed and every tile has burnt out
  (about 13 turns); Lights out after the turn that follows it (his extra move belongs to it); the board saw once the
  halves rejoin.
- **Repeats are fresh, and nothing assumed "once".** Every choice was already seeded by the turn (Ginger's piece, the
  funhouse's move, the candle's waves, Big Boy's candidates and spots, the board saw), except Lights out's targets and
  the bots' finds, which were seeded by the battle alone: a later Lights out gets a seed of its own (`LightsOutTest.seed`,
  drawn from the battle's and the turn), so it names other pieces; the first stays as it was. The "once" guards became
  "not this turn again" (`funhouseDue`, `lightsOutDue`, `bounceDue`). The server's Lights out state was already new
  per test; the screens' moments are keyed by turn. The test switch (`?power=`) brings only the first; the trigger
  works again once each one is over (its button: "under way" while it runs, then ready).
- **The King's strike** adds `rageStrike` = 25 (a quarter of the meter), at the boss's speed like every gain, as he
  strikes (the meter rises at once on every screen); nothing while an ultimate's effect runs.
- **Ginger's free piece** is random from the seed among the crowd's pieces with a legal move, never the king nor the
  piece her freeze holds unless nothing else can move (then the king, then the frozen piece). My call on the king:
  "one piece at random" taken literally would sometimes leave only the king to shuffle, which the old rule kept as the
  last resort too. The mercy rules stand: in check only pieces that can answer it have moves, and a barred move that was
  the piece's only one lifts the ice. The banner names it ("Only your knight on c3 moves"), and the God King's line
  fits it (the queen's lines, the king's, or new `blizzardOne` lines).
- **The display:** full (pulsing) on the ultimate's turn. As it's spent the meter turns dimmed and dashed (`paused`),
  holds full for 0.4 s, then its bar slides down to nothing over 0.9 s (`RAGE_DRAIN`, on the page's clock, so a
  screen change or the next turn coming quickly doesn't cut it: the first tries jumped or lost half the slide to the
  busy first frame of the next screen); it stays empty while the effect runs, then fills again. Each strike shows as a
  jump of a quarter. Older servers send `rage: null` once spent, which still hides it.
- **The meter's bar was always drawn at 22%** (found in the frames): the threat skulls' dimming rule
  (`.boss-threat i`) caught its `<i>` too. Now it's `.boss-threat > i`, and the bar shows its real orange and red
  (lesson recorded). On a phone, a boss's line in the bar's text box can cover the meter while it's said (as before);
  the slide is then seen only on a computer, and the empty, dashed meter after it everywhere.
- **The rates, by estimate.** Eric changed the plan (to save usage): no sim runs; set the rates by reasoning from
  typical battle lengths. **Rates set by estimate; not yet tested with the bot sim. Run the sim at a future date**
  (`npx tsx packages/sim/scripts/boss-sim.ts raid all 20 11 2 <tag>` then `raid-summary <tag>`: Solo raids of 50 bots
  with every power, built for this and checked on one game, then stopped). Before/after crowd win rates are therefore
  not measured either.
  - A typical battle: about 40 crowd moves (Solo raids in `reports/last-stand.md`: 26 to 59, median about 35; the
    game's boss in `reports/boss-calibration.md`: 44 to 56 on average; the cap is 60).
  - The new rates: `ragePerMove` 4 (was 5), `rageAheadMax` 4 (was 5), `ragePerMaterial` 100/18 (was 100/9: a queen's
    worth is now half the meter, since trades would otherwise bring one ultimate after another), `rageStrike` 25. At
    speed 1 that's about 7 a crowd move in a typical battle: 4 for time, about 0.4 for the eval (a crowd is seldom
    ahead of a stronger boss), about 1.7 for material (the boss loses about 12 points in 40 moves, mostly trades) and
    about 0.9 for strikes (about one and a half a battle). A meter fills in about 14 crowd moves.
  - Each boss's `rageSpeed` makes room for how long its effect pauses the meter (D) and its warning turn (w), so the
    second ultimate lands around turn 30 and a third only in a battle that runs to the cap:

    | Boss | Speed | Fill (moves) | w | D | Ultimates at about turn | In a 40-move battle |
    |---|---|---|---|---|---|---|
    | Ginger | 1.1 (Eric: a bit faster) | 13 | 1 | 1 | 15, 30, 45 | 2 |
    | Boingo | 1.15 | 12 | 1 | 3 | 14, 30, 46 | 2 |
    | Jefferson | 1.2 | 12 | 1 | about 13 | 14, 40 | 1 to 2 (about 1.5) |
    | Hollow | 1 | 14 | 0 | 2 | 15, 31, 47 | 2 |
    | Big Boy | 1 | 14 | 0 | 1 | 15, 30, 45 | 2 |
    | Sawyer | 1.3 | 11 | 1 | 5 | 13, 30, 47 (later when no half is his yet) | 2 |

  - Before: one ultimate a battle for every boss, the first from about turn 22 on time alone and sooner with trades
    (the three sim games run on the old rules before the plan changed had theirs at turns 7, 9 and 14).
  - **Jefferson gets about one and a half, not two (flagged for Eric):** his Roman candle burns the crowd's half for
    about 13 turns, a third of a typical battle, and Eric finds it too strong already; two full barrages would keep
    the crowd's half on fire for most of the game. He gets a second in a battle that lasts (about 40 moves or more).
    PR C weakens the barrage; his speed can rise then.
  - **Big Boy keeps two:** each Big Bounce costs the crowd about a pawn (`bounceTarget`), so two is about two pawns, and
    his Elo offset (−250) already pays for nasty powers.
  - Crowd win rates: not measured. Expect the crowd to face about one more ultimate a battle than before, so a little
    harder; every boss's offset is unchanged until the sim says otherwise.

### Boingo: two pies, and the funhouse turns the board round (Oct 11, 2026)

Eric: "Up to two pies on the board at once for the clown. Funhouse ultimate: he rotates the board. First he flips it
upside down, like he normally does. A few turns later he turns it 90 degrees to one side, left or right. Then he does
a 180, so now it's on the side we haven't done yet. A few more turns after that, it goes back to the start, and we
leave it there. And he doesn't play any extra moves during this time." The calls:

- **Two pies.** Each pie keeps its rules (an empty square near the center that the fewest moves reach, `pieTurns` 3
  turns, nobody on either side moves onto it). The cadence was "3 on, 2 clear" (one pie at a time); now a new pie
  every `pieEvery` = 2 turns while fewer than `pieMax` = 2 are down, never on a square already pied, so there are two
  on the board every other turn. The state is `pies` (a list); screens get `pies`, and `pie` (the newest) for older
  ones. The pies are placed like Ginger's ice now (PR #148): in eighths of chessground's board (`onSquare`), exact at
  any size, and turned with the board.
- **The funhouse's steps:** `funhouseStepTurns` = 4 crowd turns a step (Eric said "a few"; the middle of 3 to 5).
  180° as it comes (turn T), the quarter turn to his side on T+4 (90° clockwise or 270°, from the seed), the half turn
  to the other side on T+8, back on T+12, where it stays. Each step is a short moment as the crowd's turn begins
  (`spin`: "SPIN!" naming the way it turns, or "BACK AGAIN!"), then the board turns. Its effect runs until it's back:
  the meter fills again from T+12.
- **No forced move:** the move he played for the crowd is gone, with everything that served it (the host's funhouse
  request, `funhouseMoveFrom`, its settings, the "Not scored" line). Today's funhouse turn wasn't scored only because
  nobody picked it; now the crowd picks every turn, so every turn is scored as usual. The turned turns don't count for
  fair play (a power turn, as the flipped ones were).
- **How the 90° board works:** chessground maps a tap or a drag from its own box and draws only two ways up, so a
  CSS rotation of the board would put taps on the wrong squares. A quarter turn is drawn by moving every square where
  the turned board shows it (`board-view.ts`), and every move chessground reports is turned back. Tapping and dragging
  are exact at every angle, phone and computer (e2e: a move by tap and by drag at 0°, 180°, 90° and 270°, with touch on
  the phone). The coordinates name the real squares: on a quarter turn the bottom edge runs along the ranks and the
  side along the files, and the e2e coordinate check now handles a turned board.
- **Pieces stay upright:** today's flip spins the board with its pieces (upside down for a moment) and then draws it
  from the other side with the pieces upright. The quarter turns do the same: the board turns in its own plane
  (700 ms, shrinking at the halfway point so its corners stay in its box), then is drawn at its new angle,
  untransformed. Found in the frames: a board made for a turned view first drew the position unturned and flew every
  piece across it; it's made turned now.
- **His meter:** the funhouse now holds it for 12 turns, so `rageSpeed` for Boingo goes to 1.8 (by estimate, as the
  others: about two funhouses in a typical battle, the first around turn 10). Rates set by estimate; not yet tested
  with the bot sim. Run the sim at a future date.

### Jefferson: a weaker Roman candle, some of it on his own side, and his laugh (Oct 11, 2026)

Eric: "Jefferson's ult is too strong. It should also land on his side a bit. It also seems his pieces are immune; I
think that's fine. But add some drops to his side. When his piece is on one, he laughs and says something witty about
how his don't burn, but just once per match, when it triggers." The calls:

- **How much lands on his side:** `candleOwnShare` = 0.4 of each wave, rounded per wave (0, 1, 1, 2, 2, 2, 1, 1, 0 of
  the 1, 2, 3, 4, 4, 4, 3, 2, 1): 10 of the 24 fall on his half and 14 on the crowd's, where all 24 fell before. That's
  42% fewer per barrage on the crowd's half. With about one and a half barrages in a typical battle now (PR A), it's
  about 21 fireballs a battle on the crowd's half against 24 before (and in a battle where he fires once, 14 against 24).
  So it's clearly less punishing per barrage, and a little less per battle. Set by estimate; not yet tested with the
  bot sim. Run the sim at a future date. The waves, their timing and the shadows are unchanged. The crowd's squares are
  picked first, as before, so with no share the barrage would be exactly the old one.
- **What a drop on his half does:** a real fire tile, like any other. His pieces never burn (as before), so it's mostly
  wasted, but a crowd piece that wanders into his camp and stays on one still burns. One rule everywhere ("his fire burns
  your pieces") seemed clearer than tiles that do nothing.
- **His laugh:** the first crowd turn on which one of his pieces stands on a tile from the candle (a fireball landing
  on it, or his piece moving onto one), a `fireproof` moment as that turn begins: his smug look by the board's corner, a
  cool glint over the piece, the dock's "Fireproof!" and one of four lines in his text box (the shared speech rule:
  `SPEECH` timing, said as a critical line so a busy moment never drops it). Once a match. The line is picked from the
  battle's seed (`fireproof.pick`, 12 bits, which the app takes modulo its lines), the same on every screen. His
  sparkler's fire doesn't count, only the candle's.
- **No laugh sound:** Jefferson has none of his own. The only laugh sound is Boingo's kazoo, which would be the wrong
  character, so there's none, as the brief allowed.
- **The lines** (`FIREPROOF_LINES` in `Grex.tsx`): "Ha! My pieces don't burn. Perks!", "Fireproof! Did I forget to
  say?", "Hot? Not for my team. Ha!", "Mine are fire-rated. Yours? Ha!".
- **His meter** stays at `rageSpeed` 1.2 (PR A): the barrage still lasts about 13 turns, so two full ones would keep
  fire on the board most of a typical battle.

### Our own board, behind a switch (Phase 1 of replacing chessground, Oct 12, 2026)

Chessground is GPL-3 and is compiled into the app, which would force the game's source open at a public launch. Eric
tried three boards side by side in the board lab and couldn't tell them apart, so he chose our own. Phase 1 builds it
for real, behind a switch, at full parity; Phase 2 (after Eric's OK on his phones) makes it the default and removes
chessground. The calls:

- **One switch, every screen:** `BOARD.impl` ("chessground" by default for now). `components/Board.tsx` picks the
  board for every screen that draws one (Crowd, raids, Boss alone, Squads, replays, votes, the finals, the God King's
  moments, Classic, and the small boards: the mini boards and the live window drew chessground too, so they follow the
  switch; the tiny boards are our own SVG already). A board keeps the one it was made with. Admins switch their device
  in Settings → "Testing (admins)"; `?board=own` / `?board=cg` switches any device and is kept on it (`brc.board`), so
  a link survives every screen (the other test switches only last one load, but this one has to outlive a whole visit
  to be useful). `VITE_BOARD=own` at build time makes ours the default: the e2e suite's second run.
- **The same props and the same behavior where the game relies on it:** a tap-tap move goes as the second press goes
  down; a move you make stays shown until the game next tells the board anything (as chessground's did; so the Crowd's
  pick still goes back while a solo move stays); the selection survives a new position; after a dragged move the next
  drag starts at once; a dropped piece lands at once and a drop where it can't go goes straight back; a touch on a
  piece, near one or with one selected doesn't scroll the page, one elsewhere can. The numbers are the lab's: 220 ms
  slides on a cubic ease in and out, a 3 px drag threshold, a fade on the captured piece.
- **The same elements and stacking,** so nothing drawn over the board needed to change: pieces are `<piece class="white
  pawn">` at z-index 2 (8 sliding, 11 dragged, 1 fading), highlights are `<square>` with the same classes (and each
  `marks` class), arrows are drawn with chessground's measured widths, colors and see-through-ness, and the board
  writes its size as `---cg-width` (`--cg-size` stays the name everything reads, until Phase 2 renames it everywhere at
  once). Only four places looked inside chessground's own elements (the God King's strike and Lights out measuring
  `cg-board`, the chat bubble, Sawyer's split pawns); they now ask `board/dom.ts`, which finds either board.
- **Boingo's quarter turns are built in** (board-view.ts's mapping): squares are drawn where the turned view shows them
  and taps are turned back, with no rewritten FEN.
- **Its size is measured without transforms** (the computed width, then a ResizeObserver's content box), where
  chessground measured its box on screen: a board inside a turning or jolting row keeps its size (the Oct 8 lesson's
  failure can't happen to it).
- **The check glow** (`BOARD.checkHighlight`): the game's board never showed it (the wrapper cleared it on every
  update), so it stays off on both boards for parity; it's one setting if Eric wants it.
- **The pieces:** the cburnett set came in through chessground's CSS (GPL). The same drawings now come from their own
  source, Wikimedia Commons, where Colin M.L. Burnett offers them under a choice of licenses; we use the BSD one
  (`board/pieces/`: the twelve files, `LICENSE.txt`, `SOURCES.md` with every URL and checksum). Chessground's copies
  had one change, the black pieces' white details toned to `#ececec`; we made the same one-color change so nothing
  looks different (measured: the only remaining differences are a pixel of anti-aliasing at the outlines). Credited in
  Settings and the FAQ, the license served at `/licenses/pieces.txt`. Both boards draw them (chessground's own piece
  CSS is gone already).
- **A bug found on the way: the promotion picker showed four empty buttons** on the game's board (its pieces' art only
  applied inside chessground's own element). The picker now draws its pieces on both boards.
- **The board lab** now shows the game's two real boards (`?board=cg`, `?board=own`) beside cm-chessboard; the lab's
  own sketch is gone, and so is its non-commercial "Staunty" piece set (it was only for trying).

### Piece sounds: all wood, nothing GPL; the first tap no longer waits for sound (Oct 12, 2026)

Eric: the pickers' options should be "slightly different wooden sounds, not chips or clicks". And the defaults were
PyChess's knocks (GPL-3), which a closed-source game can't ship. The calls:

- **Five wooden options each,** from Kenney's CC0 *Impact Sounds* and our own synthesis (`scripts/piece-sounds.py`):
  moves Light wood (the default; Kenney's light knock), Wooden tap (ours: a short, bright knock, the closest in
  character to the old one), Bright wood, Ringing wood, Deep wood; captures Heavy wood (the default), Double knock (a
  light knock then a heavy one, as the old capture was), Short wood, Wood block, Big wood. Poker chip, Chips, Click,
  Soft, Clack and Thud are gone, and so are the PyChess files. A device that had picked any of them hears the default.
- **The defaults: Light wood and Heavy wood** (the brief's suggestion, real recorded wood). Measured against the old
  knocks, Wooden tap and Double knock are closer in brightness and length; they're one tap away in Settings if Eric
  prefers them, and a one-line change to make them the defaults.
- **Leveled to the old loudness:** the script now holds the old move and capture's measured loudness (TARGET), since
  their files are gone.
- **Castling** with the default is its own file (`castle-wood.mp3`: the Light wood twice, king then rook, 110 ms apart,
  the second softer), the same pattern castling already had with any other pick.
- **The gavel** is the default capture and move sounds pitched down a little (0.9 and 0.8), where the old bright knocks
  were taken down to about half: Kenney's wood is already low, and halving it would boom.
- **The first tap of a visit** spent 45-210 ms (a 4x slowed phone) making the audio graph and starting 25 downloads
  inside the tap, so the first move's own frame waited. The graph is now made while the page is idle (it starts
  suspended and fetches nothing; browsers allow that), the tap only switches it on, and the samples start loading after
  the tap's frame. Every tap still tries to switch sound on until it's running (iPhones).

### Our own board, the only board (Phase 2 of replacing chessground, Oct 12, 2026)

Eric approved Phase 2 for the same night, once Phase 1 was proven (the full e2e on both boards, every boss effect's
frames checked, the measurements with no regressions). The calls:

- **Our board is the board,** with no switch: `BOARD.impl`, the admin toggle and `?board=` are gone (a device that kept
  a choice simply draws ours). Chessground is removed completely: the dependency, its CSS, its wrapper, every
  `cg-*` name (`--cg-size` is `--board-size`, `---cg-width` is `--board-width`; the layers drawn with pieces are
  `.hb-pieces`, with the piece base chessground's CSS used to give them), and every trace of it in the built app.
- **The board lab is removed** (`/boardlab`): its job, choosing the board, is done, and it was a debugging page anyone
  could open (the pre-launch item from Oct 12). cm-chessboard goes with it.
- **If it ever has to go back:** the whole of Phase 2 is one merge commit, so `git revert -m 1 <that merge>` on `main`
  (then push; `main` deploys) puts chessground back as it was at the end of Phase 1, with the switch (off by default:
  chessground drawn) and the lab. Nothing else depends on it.

### Boingo's funhouse: the forced move is back (Oct 12, 2026)

Eric, Oct 12: the forced move is the joke; restored. The calls:

- **When:** once a funhouse, as it comes (the crowd's turn T, when the board turns upside down): he plays the crowd's
  move for it, then his own; the crowd plays its own from T+1. Each repeat ultimate (a new funhouse once the board is
  back) plays one again, once. It's the crowd's move on the board, but nobody picked it, so nobody is scored for it (the
  "Not scored." line is back, under "Plays your move: Nf3" beside his icon: the old "Boingo the Clown plays your
  move: Nf3" was cut off before the move in a phone's dock).
- **Which move:** restored as it was before Oct 11 (`funhouseMoveFrom`): weak but recoverable, 1 to 2.5 pawns worse
  than the best (`funhouseLoss` [10, 25]), never past `funhouseMaxLogit` 1.6 in log-odds, never a move that allows a
  forced mate or leaves the queen hanging, from the allowed moves (a pie still blocks it).
- **Online:** the host's engine picks it (the boss request's `funhouse` flag, from the crowd's allowed moves), the
  server plays it and sends the same move to everyone; with no engine anywhere, a random allowed move, as for the boss.
- **The rotation:** unchanged, 4 turns a step counted from T, so his move is the first of the upside-down step's 4
  turns (the crowd plays 3 upside down, then 4 at each quarter turn, then back). The meter waits as before.
- **His screen:** the funhouse is a screen of its own again, after his move for the crowd (5.2 s): the banner, he pogos
  on, the board turns upside down, his joke, the move lands, he bounces off; then his own move. Until then his previous
  move shows the board the right way up (`shownAngle`): the board turns in his moment, not before it.
- **His joke** (`FUNHOUSE_LINES`, picked from the battle's seed as the event's `pick`, like Jefferson's laugh, so the
  same for everyone in a lobby): "Oops! Did I just
  play for you? Hee hee!", "Whoopsie, my hand slipped... on YOUR piece!", "Honk honk! I'll drive this one!", "Your
  move? I made it for you. You're welcome!". The God King's answer is back too: "That clown played our move! We'll
  fix it."

### Every boss on Maia: the rule, the bridge band, online, loading (Eric, Oct 12, 2026)

Eric played Ginger on Maia and wants every boss on it, up to the strength where Stockfish has to take over. His calls
(Oct 11–12), followed exactly: no guard by default (Maia's mistakes are human ones; a boss's edge comes from its
powers; the guards stay); Stockfish at the top (from about 2800, today's boss with its guard); a bridge band between
them (about 2600–2800: Maia with the light guard, then the strict guard, maybe a share of Stockfish's moves); strength
from the crowd's ratings (people only), the raid tier or the solo difficulty, plus each boss's offset, plus a margin
for a crowd; bosses on the 23M model (the 5M one for Crowd and Squads bots comes later); game quality over old
phones (a device that can't load Maia, or runs it too slowly, plays Stockfish); players stay on Stockfish until he
OKs publishing the Maia box's source (AGPL), and admins get Maia on every boss now. My calls:

- **Every boss's brain is one setting:** `BOSS_BRAIN.brain` (`maia-raw`), with `byBoss` for an exception (none). The
  prototype's per-boss `soloDefault` is gone. The guards stay as brains for the bridge and the admins' picker, and the
  strict guard is now a brain of its own (`maia-strict`, 4 points / 0.5 logit): the prototype's "the full guard turns
  strict at Maia 3000" rule is gone, because the bridge needs the strict guard at a strength, and one guard per brain
  is simpler to read and test.
- **Maia picks the boss's normal moves, within its powers' limits** (pies, toy blocks, saw cuts and the board saw,
  Sawyer's first pawn move): it's asked for the allowed moves only (`searchmoves`), and the boss never plays anything
  else, even if a broken worker named another. If none of Maia's moves is allowed, the boss plays **today's Stockfish
  move** (the prototype played Stockfish's best there; the brief asks for today's move). Every candidate vetoed by a
  guard still means Stockfish's best, as in the prototype (the guard is there to keep the boss strong).
- **The special moves, one by one** (unchanged unless said):
  - **The King's strike:** Stockfish's own step back (5–15 points). It's the God King's power, and its size is the
    design; Maia has no notion of "a move N points worse".
  - **Boingo's funhouse move for the crowd:** `funhouseMoveFrom`, as restored on Oct 12 (the brief: leave it). It's
    the crowd's move, weak but recoverable by design, not the boss's.
  - **Hollow's extra move after Lights out:** `extraMoveFrom` (a quiet move gaining at most `lightsOutExtraGain`). A
    capped gain needs scored moves; Maia can't promise "quiet and small".
  - **Big Boy's bounce:** `bounceFrom` (a position from scored candidates in a loss band), not a move at all.
  - **Slips:** none under Maia (its own mistakes take their place, as in the prototype). The slip roll still happens,
    so the match's other random draws stay where they were.
  - **The mate test switch** (`?mate=1`): its mate in one, as before.
- **The bridge band** (`bridgeFrom`, `bridgeStrictFrom`, `stockfishFrom` 2800; `bandBrain`; the numbers are the
  calibration's, below): Maia with the light guard, then with the strict one, and a share of the boss's moves today's
  Stockfish move instead (with its own guard and slips), growing in a straight line from none at `bridgeFrom` to
  `bridgeStockfishShare` just under 2800. Each move's
  draw comes from the match's random source in solo (only in the band, so nothing else's draws move) and from the
  host's on its device online; Maia isn't asked for a move Stockfish plays. An admin's pick plays that brain, no share.
- **Strength from the people** (Eric's "people only"): the Crowd's boss battle now takes the weighted rating of the
  people among the last ten (bots only if no person is left among them). It used to count the bots too. This moves
  today's Stockfish bosses in the Crowd's boss battle as well, toward the people's own strength, which is the point.
  A raid already counted people only.
- **The crowd's margin** (`crowdMargin`, set by the calibration): Maia plays at `maiaRatingFor(strength + margin)` when
  more than one picks the crowd's moves (a raid, solo or online, and the Crowd's boss battle); in Boss alone (and a raid
  of one) at `maiaRatingFor(strength)`. A crowd voting together plays above its average member; a lone player doesn't.
- **Where it plays:** every boss battle. Solo: Boss alone, a Solo raid and the Crowd's boss battle (the battle's brain
  is chosen as its intro begins, `startBrain`; a battle simulated after you're out stays Stockfish: nobody watches it,
  and nothing need download). Online: the lobby decides the battle's plan once, as it begins (`bossBrainNow`, kept in
  the lobby's record so a revived lobby keeps it), tells the host's device at once (`bossBrain`, so it loads Maia during
  the intro), and every request for the boss's own move carries the plan; the host's device plays Maia's move and the
  server sends that one move to everyone, as it always has. A new host, or the host back after a reload, is told again.
  The funhouse move, the extra move and the bounce requests carry no plan.
- **Who meets it while it's off for players** (`forPlayers` false): an admin's device, on every boss in every solo
  mode; online only a lobby whose people are all admins (my call: a lobby with a player in it meets Stockfish, so no
  player meets Maia, or downloads it, before Eric's OK and the source being published; Eric can test online alone in a
  private raid, or with his own devices). A device that may not run Maia (a player's) never downloads it and plays
  Stockfish's move even if asked to play Maia. `MAIA_TEST=1` (wrangler dev, for the e2e; never production) counts
  everyone as an admin for the lobby's choice, like `SQUADS_TEST`; only an admin's app still runs Maia.
- **The one value for players: `BOSS_BRAIN.forPlayers`.** Turned on, every boss plays Maia for everyone, solo and
  online (only the host's device loads it online), with the same rule. What must happen first: Eric's OK to publish the
  Maia box's source (`packages/maia-worker/`, AGPL-3.0: a public repository or a download on the site, then the credits
  link it instead of "on request"). The Crowd's vote and the Settings rules now say "a boss" rather than "a Stockfish
  boss", so nothing else needs changing that day.
- **Loading:** Maia's files (about 29 MB) are fetched ahead when a battle on Maia may come: Boss alone's menu (when a
  boss below 2800 may be met), the raid you make from the menu, a Solo raid's queue, a raid's lobby and the Crowd's vote
  for a boss battle (on a device that may run it: an admin's, or once it's on for players the host's). A battle that
  starts while a prefetch is still under way lets it finish before the worker loads, so the files come down once. The
  service worker keeps them (unchanged). The worker, a few hundred MB, is closed when the battle ends (solo: its result;
  online: the results, or leaving). The fallback stays at 1.5 s (`timeoutMs`): nothing ever waits for Maia, so an old
  or slow phone simply plays Stockfish's moves.
- **The admins' tools:** the BRAIN · TEST picker (Boss alone's menu) works on every boss: Default (each boss's own:
  Maia, no guard, with the bridge and Stockfish at the top), Stockfish, or Maia with no, light, full or strict guard (at
  the boss's Maia rating, no share). The debug line shows in every solo boss battle for an admin and online on the
  host's device: "Maia 1640 · no guard · Maia's #2 · 90 ms", "Maia 2450 · strict guard · 25% Stockfish · Stockfish
  (bridge share)", "… Stockfish (none of Maia's moves allowed)".
- **Tests:** every playable boss through a long battle with every power on a Maia that names a forbidden move first
  (`maia-bosses.test.ts`: never played; the strike, the funhouse move, the extra move and the bounce never ask Maia;
  Sawyer's first ask is pawn moves only), the rule and the bridge (`boss-brain.test.ts`), the online plan
  (`boss-powers-lobby.test.ts`: admins only, the host told, new hosts told, no plan on the special requests, players
  under `forPlayers`), and `e2e/maia.spec.ts` (every boss on Maia for an admin on a phone; an online raid on Maia where
  the host's Maia moves reach the other player, who never downloads it).

### Every boss on Maia: the calibration (Oct 12, 2026)

A modest run, as asked (`packages/sim/scripts/maia-calibration.ts`, `reports/maia-calibration.md`; boss-sim.ts's bot
crowds and method; small samples with ± two standard errors, about ±0.3 at 10 games). The calls:

- **The target (my call, from the record):** the boss battle's own target from Oct 3, "very hard but beatable": a
  crowd about even with the boss in plain chess (then a club crowd won 38%, drew 25%, lost 38%), the powers, each
  boss's offset and the God King on top as before. Not "as hard as today's Stockfish boss": with its blunder guard
  (Oct 5) and slips it beat every beginner, casual and club bot crowd we tried in plain chess (18 games, not a draw)
  and held the expert crowd to 0.25. A guard-free human boss can't be that hard below Maia's ceiling, and Eric chose
  "no guard: its edge comes from its powers". So a Maia boss is clearly easier in plain chess than today's Stockfish
  one; flagged for Eric, with the knobs below.
- **What was measured:** bot crowds (beginner 1484, casual 1920, club 2266, expert 2771; the boss at the crowd's
  weighted rating less 100) against today's Stockfish boss and against Maia with no guard at several ratings; the
  expert crowd also against the light and strict guards at Maia 2700; one bot alone (the casual and club crowds'
  middle member) at its own rating; and, per move, Maia's loss at nine ratings with each guard. Crowds were about even
  with Maia at roughly 350 (beginner), a little under 1000 (casual) and 2100 (club); the club crowd scored the same
  against 2100 and 2600, and the expert crowd beat Maia at 2700 nine times in ten. A lone club bot scored 0.25 against
  Maia 1000.
- **Maia's rating lines** (`maiaRating`, the boss's level → Maia): 600 (the floor) up to 1800, 850 at 2200, 2100 at
  2550, 2500 from 2650 (held: Maia's ceiling). The level is the strength, plus the crowd's margin for a crowd.
- **The crowd's margin: 400** (`crowdMargin`): a lone bot needed a far weaker Maia than a crowd of its own rating,
  about 400 of level on the lines. Bots' mistakes are independent random moves, which voting filters out better than
  real people's (often shared) mistakes, so real crowds may need less: it's the one value to tune for crowds.
- **The ceiling: Maia 2500.** With no guard Maia stops gaining strength between 2100 and 2700 (per move 2.73 points
  at 2400, 2.53 at 2700, 2.80 at 3000), and the model has few people up there.
- **The bridge: 2500 to 2800** (`bridgeFrom` 2500, `bridgeStrictFrom` 2650, `bridgeStockfishShare` 1, `stockfishFrom`
  2800). A step under Eric's "about 2600–2800", because Maia with no guard at its ceiling already falls short of strong
  crowds (that 9 in 10). The share of Stockfish's moves grows from none at 2500 to all of them just under 2800, so the
  boss arrives exactly at today's Stockfish boss there. Against the expert crowd, light guard 0.65, strict 0.35,
  Stockfish 0.25: each step no bigger than the error bars.
- **The floor stays 600** (`maiaRatingMin`): the model learned from people rated about that and up; asking for less is
  outside what it knows. The weakest crowds and players meet a Maia a little stronger than even (the beginner crowd,
  which plays a random move a quarter of the time, scored 0.13 against 600).
- **Boss alone:** with no margin, a player of 1500 meets Maia 600 at Normal (the prototype gave Ginger Maia 1190 there,
  which Eric enjoyed); 1800 meets about 660; Hardest at 1900 about 1560. The lone bots say that's about even (a club bot
  of 2162 scored 0.50 against the shipped rule's Maia 826). This is the least certain part: Eric's play decides, and
  the lines' first two points (or Hard and Hardest) are the knob.
- **Checked:** the shipped rule on fresh openings, 8 games each: the casual crowd 0.38, the club crowd 0.50, the club
  bot alone 0.50, the expert crowd (in the bridge: strict guard, 90% Stockfish) 0.38. About even everywhere.
- **The prototype's sanity runs** (`reports/maia-boss.md`) used one strong bot (2% random moves) against a 1500 boss,
  which is why raw Maia looked much easier there; against crowds of the tier's own strength the picture is the one
  above.

### The classic piece sounds are back as the defaults, with close variations (Oct 12, 2026)

**Eric, Oct 12: classic PyChess knocks back as the default, GPL-3.0, credited.** He liked them best. His reasoning: a
sound file is data the game plays, not code compiled into it, so the GPL covers the files, not the game: the same
separate-file reasoning as Stockfish. This reverses the morning's removal (above, "Piece sounds: all wood, nothing
GPL") for these files only. The calls:

- **The classics, restored byte for byte** from before that PR (`sounds/move.mp3`, `capture.mp3`, `castle.mp3`, as
  converted on Oct 2), are the defaults: Move **Classic knock**, Capture **Classic double knock**; castling with the
  default move sound plays `castle.mp3` again. They keep their old id (`wood`), so a device that picked them before
  Oct 12 hears them again. Nothing stored, or an unknown id, also reads as the classic.
- **Every wood option stays** (Light wood, Wooden tap, Bright wood, Ringing wood, Deep wood; Heavy wood, Double knock,
  Short wood, Wood block, Big wood), after the classics. A device that picked one (Light wood or Heavy wood included,
  while they were the defaults) keeps it; one that never picked hears the classic. Kenney's Double knock's note is now
  "A light knock, then a heavy one", so the two double knocks read differently.
- **Three variations of each classic,** right after it: **Classic light** (2 semitones up, +3 dB above 2.5 kHz, a
  slightly shorter decay), **Classic deep** (2 down, −3 dB, a slightly longer decay, at most +6 dB) and **Classic
  soft** (1 down, −5 dB, a slightly shorter decay); the captures' are "Classic light double", "Classic deep double",
  "Classic soft double" (the pickers' labels must differ: each ▶ is named by its label). Made by
  `scripts/piece-sounds.py` from PyChess's original WAVs (not the mp3s, to avoid a second lossy pass), reproducible
  byte for byte. Measured against the classic (the power-weighted spectral center): the moves' light +14%, deep −12%,
  soft −5%; the captures', which have more high end for the EQ to work on, +28%, −28%, −12%. The captures keep their
  two knocks, up to 12% closer together or further apart; every one is as loud as its classic. They're GPL-3.0
  (modified PyChess files), credited as "variations of PyChess's sounds, made by our script", with each one's exact
  recipe in `sounds/SOURCES.md` (the GPL's "modified, and when" notice; with the public WAVs, everything needed to
  remake them).
- **The decay of a capture is changed more gently** (a tau of 120–150 ms, not the move's 50–80 ms): the classic
  capture's low ring is quiet and long, and the move's settings cut it enough to make it a different sound.
- **Leveled to the classic of its kind,** and once more from the encoded mp3 (the mp3 moved the loudness about half
  a decibel); the script now measures the classics' files for its target instead of holding their numbers. Kenney's
  and our files are left as they were (within half a decibel of the classic; the e2e allows two).
- **The e2e loudness check now measures what the script levels:** Web Audio reads a low- or high-pass's Q in dB, so
  its default (1 dB) put a bump at 200 Hz the script's filters (Q 0.707) don't have, and read Kenney's low wood about
  2 dB louder than the classics. With Q set to −3.01 dB the browser's numbers match the script's to 0.01 dB: every
  option is within half a decibel of its classic, so the check is now 1 dB (0.5 for the variations), not 2.
- **The license text is Stockfish's copy** (`/engine/COPYING.txt`, copied from the stockfish package at every build;
  the same GPL-3.0 text as PyChess's `LICENSE`, only its line endings differ), not a second copy. The notice is in
  `/licenses/third-party.txt`; Settings and the FAQ credit "Classic piece sounds and their variations: PyChess
  (GPL-3.0)", linking PyChess's `sounds/` folder, the license and `sounds/SOURCES.md`.
- **`castle-wood.mp3` is gone:** it was castling for Light wood as the default, and castling with any non-default
  pick plays that pick twice, which for Light wood is the same thing.
- **The gavel** is the classic capture and move sounds pitched down to about half (0.55 and 0.45), as it was before
  this morning.

### Maia bosses harder: a boss is a challenge (Eric, Oct 12, 2026)

Eric, after #157 aimed for an even game: "We should be upping the Maia rating. The numbers don't need to be accurate;
people read 'boss' and assume it's a challenge, so that's the key." The new target (his): the boss clearly favored in
plain chess, each crowd and a lone player at its own difficulty scoring about 0.30, before the powers and the God King;
where Maia alone can't get there, the bridge starts earlier rather than the challenge being lost; Maia with no guard
wherever it can reach the target on its own. The calls (`reports/maia-calibration.md`, "Harder"):

- **Maia's rating lines** (level → Maia): 600 up to 1800, 850 at 2000, 1100 at 2250, 2000 at 2400, 2500 from 2650.
  The crowd's margin stays 400.
- **The guard follows the level, Stockfish's share the strength** (`bandBrain`): the light guard from a level of 2400,
  the strict one from 2800 (`bridgeFrom`, `bridgeStrictFrom`); Stockfish's share from a strength of 2500
  (`bridgeShareFrom`, new) to all of the moves just under 2800. So a crowd, whose level is 400 above the boss's
  strength, meets the guards 400 sooner: a club-level crowd (strength about 2150) already plays a light-guarded Maia,
  because Maia with no guard can't hold such a crowd under about 0.5 at any rating. One player alone meets the light
  guard from 2400 and never the strict one (Stockfish takes over from 2800, as before); the share still ramps them
  into Stockfish.
- **What the sims say** (8 games a row, fresh openings): the casual crowd 0.25 (Maia 805) and the expert crowd 0.31
  (strict guard, 57% Stockfish) land on the target; the club crowds 0.19 and 0.06 (light guard) and a club bot alone
  0.06 (Maia 910) land harder; a casual bot alone is at Maia's floor already (0.13 and 0.00). The light guard is a big
  step for a club crowd (it removes just the blunders a voting crowd punishes), with nothing between it and Maia with
  no guard (about 0.5) in this design. Erring harder follows Eric's "rather than losing the challenge". The knobs if
  real club-level crowds find it too hard: a looser light guard, or the light guard from a higher level; for Boss alone
  the lines' first points.
- **Tries along the way** (not shipped): the strict guard from a level of 2550 (the club crowd lost all 8), and the
  light guard at Maia 2500 from 2400 (0.19 and 0.12). The rows of the shipped rule are the ones in the report.
- **Everything else stands:** players stay on Stockfish (`forPlayers`), the bridge still hands over to today's
  Stockfish boss exactly at 2800, the special moves keep their own picks.

### Ginger's Blizzard: three turns, thawing (Eric, Oct 12, 2026)

Eric: "Ult lasts 3 turns now: 1 unmelted piece turn 1, turn 2 about 4–5 pieces, then all. A slight buff to his ult.
Shows the ice slightly thawing as pieces get closer to being available." The rule, turn by turn (`bosses/ginger.ts`,
`blizzardStep`; numbers `blizzardTurns` 3 and `blizzardFree` [[1, 1], [4, 5]] in `BOSS_POWERS`):

- **Turn 1** (as it comes): as before, one crowd piece free, a random one with a legal move from the seed, never the
  king nor the frozen piece unless nothing else can move (`chooseBlizzard`, unchanged); every other crowd piece iced,
  the king included.
- **Turn 2:** 4 or 5 of the crowd's pieces free in all, the number drawn from the seed (my call for "about 4–5": the
  count in all, the first piece included, so 3 or 4 more thaw). The first piece stays free wherever it moved; the
  pieces that thaw are named the turn before (from turn 1's position, at random, those with a legal move first, never
  the king nor a piece the freeze will still hold), so the cracked ice the crowd sees on turn 1 is a promise: those
  pieces always thaw. As turn 2 begins two more rules can thaw more: if fewer than the count are free (the boss took
  the first piece or a named one), more thaw to make it up, at random, those with a move first, never the king; and
  if no free piece has a legal move (in check: none can answer it), one that has one thaws too (the mercy rule:
  `chooseMover`, never the king nor a frozen piece while another will do). So turn 2 has 4 to 6 free, 4 or 5 unless
  the mercy rule was needed.
- **Turn 3:** every piece free, the ice gone. It still counts as the Blizzard's (its three turns): the meter stays
  empty and dimmed and no other ultimate (or the test trigger) can come until turn 4. Nothing limits the crowd's moves
  on it, so it counts for fair play again (turns 1 and 2 don't).
- **The freeze waits** while the Blizzard lasts (my call: a "FREEZE!" banner during the thaw, or right after "the ice
  is gone", would read as a contradiction); it can come from turn 4.
- **The ice through the boss's turn:** the iced pieces keep their ice (and the cracked ones their cracks) while the
  boss thinks and moves (`iced` on the boss's turn, `icedSquares`), so nothing flickers off and on between turns, and
  the melt has ice to melt.
- **Online:** everything comes from the battle's seed and the position, worked out once on the server; every screen
  gets the same `iced` and the new `thaw` (NetBossPowers: the iced pieces that thaw next turn) and the same `thaw`
  event (its `squares`: the pieces freed). Tested in the lobby (`boss-powers-lobby.test.ts`). A battle saved mid-blizzard
  before this deploy (the old state, its first piece only) is read as before on its own turn, then ends.
- **The test switch and trigger** are unchanged: `?power=blizzard` warns as turn 2 begins and brings it on turn 3 (the
  thaw on 4, the ice gone on 5); the admins' trigger brings it as the next turn begins and works again from the turn
  after its third.

**On screen** (`components/Ginger.tsx`, the ice in `characters/effects/ginger.ts`), checked frame by frame on a phone
(390 px, light and dark) and a computer (1280 px):

- **Cracked, thin ice** for the pieces due to thaw next turn: still the one block flush with its square (the same rim
  pixels, placed by `onSquare`), but nearly clear (the piece shows through it plainly, where whole ice tints it
  blue), its inner rim and frost gone, its edge paler, cracked right across, meltwater running down it and dripping
  off its bottom edge (`thinning`, a loop). On turn 1 they crack (`crack`: cracks, chips flying, a crackle) as the
  Blizzard's moment ends, once the sweep has iced the last piece; on turn 2 every piece still iced cracks (all of it
  thaws next turn).
- **The melt:** as each later turn begins, a short moment (`thaw`, 2.2 s, the clock stopped as for every power): its
  banner, then the freed pieces' ice splits, sinks into a puddle and dries up (about 0.66 s), then the next ones
  crack. The banner (cold, like the Blizzard's): "THAWING!" and the pieces by kind, most valuable first ("Your knight
  and two pawns are free"; more than three kinds: "Four more of your pieces are free"); on the last, "THAWED!" and "The
  ice is gone: every piece moves". Its long line wraps under the title (`.thaw .fb-sub`), so the faces stay on the
  board. The dock says "Thaw!".
- **Speech** (the shared rule, `speech.tsx`): Ginger grumbles as the ice melts ("Melting? Already?!", "Hmph. Don't get
  comfy.", "My lovely ice!", "Drip, drip… bah!": her kit's `ultimateHit` lines, normal priority, waiting their turn),
  and stays in her spot (`pm-stay`: she doesn't step up to cast for it). The God King: new `thaw` lines on turn 2 ("The
  ice is cracking! More of ours can move.") and `thawed` lines on turn 3 ("The storm has passed. Full strength!");
  two of his turn-1 lines say "for now", and one points at the cracked ice ("Only one piece moves. The cracked ice goes
  next.").

**The rage rate, by estimate** (Eric's standing instruction: no bot sim for ultimate rates; DECISIONS, "Rage meters"):
the meter now stays empty for three turns instead of one. At Ginger's old speed (1.1: a full meter in about 13 crowd
moves of a typical battle) her Blizzards would come at about turns 15, 32 and 49 instead of 15, 30 and 45, so a
battle of the usual 35 to 40 moves would more often see only one. Her speed goes to **1.2** (about 12 moves to fill):
about turns 14, 30 and 46, two in a typical battle as before. **Estimate; not tested with the bot sim.**

Tests: `packages/chess/test/ginger.test.ts` (the three turns over many games: one free, then 4 or 5 with the first still
free and the cracked ones thawed, then all; a free piece always has a move and the ice is never lifted; the mercy rule
in check, the king last; the count never thaws the king, and makes up a piece the boss took; the same seed gives the
same thaw; the freeze waits; the meter empty and the trigger refused through all three turns; in the match runner the
ice through the boss's turn and the thaw's turn scored by the free pieces' moves), updates in `boss-powers.test.ts`,
`grex.test.ts`, the lobby test, `gingerbread.test.ts` (the thin ice flush, clearer and dripping; the banner's names)
and `faq.test.ts`; e2e: `boss-powers.spec.ts` (all three turns on a phone and a computer) and `grex.spec.ts` (the
trigger through the three turns).

### The live window: a computer's only, and silent (Eric, Oct 12, 2026)

Eric: "On the main URL on mobile, the main screen, I hear pieces moving from the bot game being shown. It shouldn't be
on mobile (sadly just no room), and audio should be disabled on it by default."

- **Where it shows:** only where `LIVE_WINDOW_MEDIA` matches: 1280 px wide (its room in the play column, as before),
  the desktop's 600 px tall, and a mouse (`hover: hover` and `pointer: fine`). Before, the width alone decided, so a
  touch screen reporting a computer's width (a tablet, a big phone, a phone browser's desktop mode) got it. Anywhere
  else it isn't mounted: no board, no timer, no replays fetched. Tablets lose it too; they're the same "no room to
  spare, a finger not a mouse" case, and the window is a nice-to-have.
- **Silent, whatever the sound setting:** its board is `silent` (`boardKnock` in `move-sound.ts` returns nothing for a
  silent or small board, and neither counts as the big board shown, so a game's board never takes a knock from it).
  Its board was already `small`, which skipped the knock, so the sound Eric heard most likely came from a device the
  old width-only test let through; `silent` makes the rule explicit rather than a side effect of the size.
- **No speaker toggle:** its header row (tag, mode, move count) is already cut short with "…" at 1280 px, and the
  window is something to glance at, not to listen to. Easy to add later if someone asks.
- **Games unchanged:** every board in a match still plays the picked move and capture sounds (e2e `sound.spec.ts`).

### Squads test tools: the start link and Cheat lines (Eric, Oct 12, 2026)

Eric wanted to stress-test Squads alone: a link that drops him straight into a full lobby at the first vote, and the
engine's best moves on demand ("I'm bad at chess and need infinite cheat moves").

- **The link is `/squads/test` (also `/squads/test/start`)**, the server's `start=votes`: a test lobby whose fill time
  is the moment it's made, so the opener's connection fills it (bots in every other seat) and the votes follow after
  the usual full-grid moment (1.8 s, kept: it's the same screen players see). The other test links keep their 5 s wait
  for others to join. Admin-only, like every test control (`squadsTestAllowed`).
- **Cheat lines show the evaluation on the arrow and the rank by color,** not "1 · +0.8" on the arrow: the board's
  arrow labels sit in a small disc sized for 3-4 characters (the power-up hints' "52.1"), and 7 characters there would
  be unreadable on a phone. The full "1 · Nf3 +0.8" is listed under the button, in the same colors.
- **Evaluations in pawns, approximately,** for the side to move: the engine gives an expected score (win + half the
  draws), turned back into pawns on Stockfish's scale (+1.00 is about a 50% win, an expected score of about 0.75).
  Good enough to compare moves; the chess package's engine interface stays as it is.
- **An engine of its own** for the lines, not the shared pool: the pool does the lobby's bot work at every half's start,
  exactly when Eric would want his lines. 300,000 nodes (`SQUADS_LOBBY.cheatLines`).
- **For a block,** the position is the picking side's to move, so its top moves are the ones worth blocking: the same
  search, no special case.
- **A fix found on the way:** the block line above the board named the blockers' own color as the one picking ("Block
  with Pam · White is picking" while Black picked): a block's duty carries the blockers' side. It now names the other
  side, the one whose move it is.

### Squads v2: same-move tokens, move blocks, the final a majority vote (Eric, Oct 12, 2026)

Eric's goals: "The game never slows down; everything happens seamlessly. Might be a little hectic at times, but not too
crazy, because chess is already tough." It should feel like real chess as much as possible. Eliminations and
power-ups are for a later version, not built. What he set, and the calls made where he didn't (DEFAULT: one setting
each in `SQUADS`, so he can change it):

**Same-move tokens (Pairs).** Before, partners had to pick different moves and a coin played one, so a must-play move
could be lost to a coin.
- 5 per squad per match (Eric; `tokens.perMatch`). Both partners locking the same move: it plays, no coin, a token
  burns automatically (no button). At 0, picks must differ, as before: the board won't take the partner's move and the
  panel says "No same-move tokens left: pick a different move". One legal move still plays itself (no token). A
  missed pick is still a random move other than the partner's, so a miss never burns one.
- **The refund (DEFAULT `refundGap` 0.37 of expected score).** Eric: "about 2 pawns' worth on the judge's
  expected-score scale". The judge's scale is expected score (1 point = 0.01), and a pawn near a level position is
  0.95 log-odds of it (measured for the bosses: `BOSS_POWERS.bouncePawnLogit`), so two pawns down from level is 0.5 to
  0.13: a gap of 0.37. The move is the only real one if it's the best among the moves that could be played and every
  other is worse by at least that. In expected score, not pawns, on purpose: in a won (or lost) position every move
  scores about the same, so "keeps the mate" against "still +5" isn't an only move (Eric's "the ONLY objective move,
  all alternatives massively worse"), while a recapture in a level game is (the Scotch's Qxd4: 0.58 against 0.00).
- **The judge's work on players' devices.** The verdict takes the bot engine's top moves for the position (the same
  job as the bots' work, 8 lines at 250k nodes, two devices compared exactly), reusing the half's own bot work on that
  board when there was any, or a remembered answer; else devices outside the match first, the token's own squad last.
  No device answering in time: no refund, and the breakdown says "no device could judge it". The server's quick look
  (material, no engine) never judges a token.
- **When:** the verdict shows once the pair's reveal is over (`pairRevealSeconds`, 3 s): "Token refunded: only move".
- **The breakdown** (both squads, after the match; between matches and on the results): every use, its move,
  refunded or not, and why in pawns' worth (`pawnWorth` 0.185, half the gap, so 2.0 is the line): "Qxd4: refunded,
  every other move lost at least 3.1 pawns", "e4: not refunded, Nf3 was within 0.3", "…Nf3 was better by 0.6 pawns",
  "…Qg4 mates too", "…no device could judge it".
- **Bots** match their partner only when the partner's move is the bot's own best and beats the next by
  `bots.sameMoveGap` (0.3, a little under the refund line: a bot spends a token where a person might). The sim: bots
  use 1-2 a match, 75-80% refunded.

**Move blocks, every round (Relay, Pairs, the final).** The old Pick and Block (blockers, two blocks and a coin,
`blocksSeenBy`, `picksSeenBy`, `avoidBlockChance`, no blocks at 3 legal moves) is gone. Eric changed the brief's piece
blocks to move blocks: "It's not a full piece block ever. You tap their piece and play the move you wanna block."
- A 5-point bank per squad per match (Eric; `blocks.bankPerMatch`; a match can be given its own, `MatchSetup.blockBanks`,
  so a mode can set 0 or top it up). Cost by the piece making the move: pawn 1; knight, bishop or rook 2; queen 3
  (Eric); castling 2 (Eric: "let's allow castling to be blocked for 2 tokens"; `castlingCost`, null to turn it off);
  the king's ordinary moves never.
- **As many a turn as the bank allows** (Eric: "one big blocking play, high risk high reward, changeable later";
  `maxPerTurn` null, a number to cap it). The same move twice on a board is refused.
- **Who and when (DEFAULT):** any of the squad's players with a duty on that board, before the squad's move there is
  settled: in Relay before the move is made, in Pairs and the final while any of them hasn't locked in. The first tap
  wins (nothing is taken back), paid at once, and everyone sees it at once.
- **What a block can name (DEFAULT):** it's placed before your own move, so it names a move they might have after it:
  any square the piece could reach by how it moves (a slider up to and onto the first piece in its way, either
  color, since your move may take it; a pawn's pushes and both diagonals; a knight's jumps), or castling while they
  still have the right. A promotion block covers every piece. The cost is the piece's.
- **It takes effect** on the other squad's next turn on that board, and is gone after it: that piece to that square
  can't be played (the piece's other moves can). A miss, a forced move or a bot never plays it.
- **Lifted and refunded, announced:** when it wouldn't take effect (DEFAULT, the director's: "if your own move makes
  the blocked move impossible anyway, refund the block": the piece taken, the way shut, the game over); and by the
  mercy rules on the turn's blocks on that board together (Eric): while they would leave no move, or only moves that
  allow mate in one, the most recent still standing is lifted, until that's no longer so. **In check (DEFAULT
  `liftInCheck`):** the brief's "if they're in check, a piece that can answer the check can't be blocked", carried to
  move blocks: in check every legal move answers it, so every block is lifted. Eric's move-block message listed only
  the two mercy rules; this one is kept as a setting he can turn off. You pay only for blocks that take effect.
  **Confirmed by Eric (Oct 12, ~22:00):** `liftInCheck` stays on: "That's fine, no blocks while putting enemy in check,
  good idea."
- **The look (Eric):** each blocked move is an arrow from the piece to the square, both squads, from the moment it's
  placed until the other squad has played its move: it draws like a move arrow, then keeps redrawing itself slowly
  and softly (a 2.6 s loop at about 55% strength), the lock fading in and out on it (35-90%). Its beat is kept from when
  it was first seen, so the screen drawing again never restarts it. Watched frame by frame on a phone (dark) and a
  computer (light): one draw, then the loop, through your move, the show and their half, gone the frame their move
  lands; no flash. The short "banner" is the line above the board for 2.6 s ("You blocked Qd8–f6 (−3)", "Knights
  blocked your Qd8–f6", "Block lifted: it would have left no move (refunded)"): drawn over the board it hid the very
  piece it named.
- **Each squad's block points and tokens** show under its clock, both squads, always.
- **Bots** block sparingly: the other squad's likely reply to their own move (the engine line's second move, now
  carried in bot-work answers), with `blockChance` 0.04 a move, or `sharpChance` 0.15 when that reply captures or
  checks, shared among the players choosing the move (the final's four), keeping `blockReserve` 2 unless it's sharp,
  never a king's move or one a mercy rule would lift. The sim: 1.5-3 blocks a squad a match.

**The final: a majority vote** (Eric). Every player of the squad picks; teammates' picks show live to their own squad
only, as arrows with the teammate's name, with Copy; when all have locked or time runs out, the most picked move
plays. A tie: a seeded coin between the tied moves (Eric confirmed, "random between the tied moves"; `final.tie`).
Players who didn't pick don't count; nobody picked: a random move. No tokens. Blocks as in every round. Armageddon for
a drawn final as before, a vote too, each squad keeping the block bank the final left it (DEFAULT: the same match).
Bots vote at their skill and copy a person's pick on their squad with `copyHumanChance` 0.35.

**The clocks (unchanged rules, how the new pieces fit).** A block is thinking time: the move's time runs to the
block when it came later than the last pick. The final's vote is one move being thought about, so it drains its
squad's bank once, until its slowest picker's last choice (or to the ceiling if one never picks: the half waits for
everyone or the time, as before). The free seconds, the per-active-thinker drain, the top-ups and sudden death are as
they were. The sim: median lobbies 28.6, 30.2 and 31.1 minutes (Fast, Normal, Long), as before v2 (30.6, 33.1, 31.3).
Through the real server (`scripts/squads-headless.ts --device` against `wrangler dev`, the Normal clock, one idle
person whose device did the bots' engine work and the judge's): a full bot lobby took 34.6 minutes from the fill to its
results (round 1 over at 12.6 minutes, round 2 at 25.8, the final 8.5), within the sim's spread (the one run before v2
took 28.9). The long part was a Pairs match that ended 1-1 and went to the bank (12.8 minutes). The device answered
1,163 jobs; no errors.

**Test tools.** `/squads/test`, Next round, Skip votes and Cheat lines keep working. Cheat lines while blocking show
the other squad's best moves after yours (your pick, or a teammate's; none yet, the move handed over). Test lobbies
also take `fen=` (the first round's position), `bots=strong` and `seat=white`, so e2e can count on what happens.

**Protocol 2** (`SQUADS_PROTOCOL`): `block` both ways, `blockNo`, `token`; the match's tokens, block banks, blocks and
token log; the final's one duty; bot-work answers carry each line's reply.

**A test bound:** the full bot lobby unit test (no devices: the server's quick look, far weaker bots) ran 43-103 minutes
over 8 seeds before v2 and 41-96 after (means 65 and 64). Its upper bound of 60 held only for its own seed, by luck;
it's now what must hold, the lobby's safety close for a lobby nobody is in (`LOBBY_LIFE.lobbyAbandonedMinutes`, 180).

### Squads modes: Classic and Mercenary (Eric, Oct 12, 2026)

Eric designed a mode vote with a coin economy for Squads, and asked for it calibrated to play out "smooth and
balanced". He named it Pillage, then renamed it the same evening: "Can we change pillage to Mercenary... just make
front facing called Mercenary mode". Nothing had shipped under the old name, so it's `mercenary` in the code and
settings too. Every number below is one line in `SQUADS.mercenary` or `SQUADS.modeVote`; the calibration is
`reports/squads-mercenary.md` (the Squads sim playing Mercenary: `SQUADS_SIM_MODE=mercenary npm run sim:squads`).

**The Mode vote** is the first pre-game vote, before Start and Clock, on the same machinery.
- The options are **Classic** (just chess: same-move tokens stay, since they fix a fairness hole; no blocks, block
  bank 0; no coins, no shop) and **Mercenary**. A third card says **Coming soon**: shown, never votable. The server
  refuses it, the cards and zones show it dashed, and a pawn dropped on it walks back. My suggestions for the third
  mode (Hand & Brain, Bughouse, Fog of War) are in ROADMAP.md; nothing is built.
- Nobody voting means Classic, the base game.
- **Bots vote, leaning Classic.** Each lobby draws a lean, a Classic share between 0.35 and 0.75, and each bot votes
  Classic with that chance. With bots alone, 62% of lobbies come out Classic and 38% Mercenary (5,000 draws), and a
  few people can swing a close one.
- Start and Clock keep their bots' random draws, so adding the vote moved nothing else.
- **Test lobbies:** the bots sit the Mode vote out, so the opener's vote decides it. `mode=mercenary` or
  `mode=classic` on the link skips the vote (`/squads/test?mode=mercenary`, `/squads/test/pairs?mode=mercenary`).
- **Mercenary's base block bank stays 5,** Eric's number from Squads v2; Block points add to it.

**Earning: the numbers** (Oct 12; reshaped on Oct 13, see "Mercenary: Eric's first changes" below). Eric's scale
was hundreds of coins, with a good team having about 700 saved by the later rounds.
- **Captures pay 3 coins a point of the piece taken:** pawn 3, knight or bishop 9, rook 15, queen 27. They're the
  frequent, small rewards.
- **Board results:** a board won pays 50, and a checkmate 50 more (100, "around a hundred"). A drawn board pays 15 to
  each side. Winning the match pays 75, so every squad that goes through has something to shop with.
- The final's coins buy nothing (no round follows), but they're counted all the same.
- **The result** (72 lobbies, three skill mixes):
  - A squad that wins Relay earns about 600 (median 609; Relay pays most, with 4 boards).
  - It shops before Pairs with a median wallet of 621 (10th to 90th percentile: 509 to 693). Bots shopping as people
    might buy 2.4 items there, and save everything 26% of the time.
  - It reaches the final's shop with a median of 690 (518 to 1,048) and caps 1.4 items on average: a strong squad can
    max out a few items, never all of them (every cap at first prices costs about 1,500).
  - Eric's "~700 saved by the later rounds" is about the final's median.

**Brilliant moves.** Squads had no detection to reuse. Crowd's `brilliance` needs a field of six or more people
picking in one position, and Squads has one to four. So Mercenary uses the judge the same-move tokens already use (the
bot engine's top moves, from players' devices).
- **A brilliant move** is a quiet move (not a capture, not out of check), from ply 16, in a position still in the
  balance (the best scores between 0.1 and 0.9). It must be the judge's best by 0.5 of expected score over every other
  line, about 2.7 pawns.
- **Captures and answers to a check are left out** because they're often the only move without being brilliant
  (taking a loose piece, which pays anyway).
- **Never with a Stockfish token's lines on screen.**
- **Bots' moves** are judged only from work already done; a person's move gets a device job.
- **75 coins** (Oct 13: 25, at most twice per squad per match; below). It's rare: 0.7 a lobby in the sim.

**Catch-up** (Eric: so the rich don't just get richer).
- **Who gets it:** the squad that has earned less by play than its next opponent gets half the difference (to the
  nearest 10, at most 300). It's paid as the match is set (both squads known), during the shop's window.
- **Between rounds, not during a match:** coins only buy items for the next match, so a comeback bonus during a match
  would come too late to help.
- **It compares coins earned, not wallets,** so spending first can't farm it.
- **The sim:** the median gap was 72 before Pairs and 138 before the final, and catch-up paid 40 and 70. The squad that
  had earned less won 48% and 46% of those matches: no snowball. The squad that spent more won 62% in Pairs and 48% in
  the final: items matter, without deciding.

**The shop.**
- **When:** open from a squad's match's end until its next match's first half. That's the wait for the other match
  plus the 20 s break, which is there anyway: it adds no time. Squads still in only; none before Relay (no coins yet).
- **One wallet:** anyone on the squad buys from it, and each purchase goes live to the squad by name. Every squad's
  coins and cart are public, for counterplay.
- **"−" puts the last one back** at what it cost, while the shop is open. With four people on one wallet, a mis-tap
  needs undoing.
- **Escalation: +100 for every one of that item the squad has already bought this tournament,** one rule for every
  item. Eric's anchors fit it exactly: Stockfish tokens at 200, 300, 400 (the third about 400), and shields at 100,
  then 200. The Buy button shows the price now. Cheap items climb steeply, which pushes squads toward variety.
- **Caps per round:** Stockfish token 2, block points 2, shield 2, time coin 2.
- **Test lobbies starting at Pairs or the final:** the squads still in get 600 coins (about the median wallet before
  Pairs) and a 30 s intro to shop in.

**The items, ranked by what they're worth, then priced.**
1. **Stockfish token, 200.** An engine-perfect decision at the moment you choose is worth more than any amount of free
   time: far ahead.
   - It shows your own top 3 moves for one decision, with evaluations, in your position, your side to move. Blocked
     moves are left out, and it never shows a reply or the other squad's moves (`tokenLines` keeps first moves only).
   - **It's worked out on the user's own device** (Cheat lines' code: its own engine, 300,000 nodes), not through the
     bot-work path. The lines appear at once, nothing about them crosses the server (the position is public anyway),
     no other device is loaded, and Eric's computing priorities say a device that can do the job does it. The engine
     is deterministic at fixed nodes, so in the final every teammate's device shows the same lines.
   - **Pairs: the partner who used it only sees it.** Their partner sees their pick live anyway; the evaluations and
     alternatives stay theirs. **The final: the whole squad sees it,** and one a half is enough there. Elsewhere it's
     one a player a half.
2. **Breather, 150: taken out on Oct 13** (below). It doubled the free seconds a move for the whole match.
3. **Block points, 100:** +3 points, a queen block or a minor and a pawn (offense).
3. **Shield, 100:** cancels one block that would bite, and the blocker still pays (defense). It's level with block
   points.
5. **Time coin, 75:** +30 s on the team bank as the match starts, about ten moves' drain. It goes into the bank (so
   it's "used" then), and what's left of a bank carries on as always.

No sixth item. Extra same-move tokens only matter in Pairs, a takeback isn't chess, and a hidden move needs fog; none
was clean.

**Item rules.**
- **The shield acts as the half is played,** on blocks that would take effect, the first placed first; their points
  stay spent. A block lifted anyway (impossible after the blocker's move, a check under `liftInCheck`, a mercy rule)
  never uses a shield, and stays refunded.
- **Shield and mercy together:** of blocks that together would trip a mercy rule, the later ones are lifted
  (refunded), and the earlier one, still standing, is the one shielded.
- **Shields are public.** A cheap decoy block pops one before the real block: counterplay.
- **Armageddon after a drawn final carries the final's tokens and shields on:** it's the same round, as block banks
  are.

**Bots.**
- A squad shops by bots only while nobody is playing on it; a bot never spends people's coins.
- They shop 3-9 s into the window. Before the final they save everything a quarter of the time, or else spend 50-90%
  of the wallet; in the final they spend it all.
- They choose by weight: block points 3, time and shields 2, Stockfish token 0.5.
- They use a Stockfish token on 4% of decisions, or 35% when the engine's best beats the next by 0.2 or more, and then
  play the best move. That's about 0.2 tokens a squad a match in the sim.

**Fair play: token moves are left out.**
- **Squads moves aren't recorded for fair play today:** there are no judged numbers per person's move to record. So
  the exclusion is built where it will hold.
- **Core:** `FairMove.engineToken` gives the skip reason "engineToken": never counted, never part of anyone's crowd.
- **Squads:** each match's `assists` log and the events' `assisted` say exactly whose choices had the lines on screen
  (`isAssisted`).
- When Squads feeds fair play, those moves go in with `engineToken`. They already never earn brilliant coins.

**The look.**
- The shop is a sheet at the foot of the screen with nothing dimmed behind it, so the boards stay in view. "Hide"
  folds it into a pill. It shows Eric's line, both squads' wallets, any catch-up, the items and the purchases.
- **The explainer shows once per account,** remembered on the device under the account's id. A server-side flag
  would need a new stored field for a few lines of text; a second device shows it once more.
- In a match, a line in the panel shows both squads' coins and what's left of their kits. Under each clock: the block
  points (none in Classic) and same-move tokens. The line above the board announces a shield or a brilliant move.
  The standings show every squad's coins.

**Length** (Eric: about 30 minutes; the shop must add none). Oct 12's numbers, with the Breather:
- The shop adds none. Items that buy time do lengthen games.
- In the sim, on the same seeds and the Normal clock, Mercenary's median lobby was 33.1 minutes against Classic's
  31.3. The 90th percentiles were 39.1 and 40.3.
- **Without time coins and breathers bought** (a tuning run), Mercenary matched Classic exactly.
- Making breathers pricier and the bots buy time less often brought the gap from 4 minutes down to about 1.5-2.
- Squads in Mercenary reach sudden death less often (39% against 51%).

**Protocol 3** (`SQUADS_PROTOCOL`): the Mode vote; `wallets`, `buy`/`unbuy`, `bought`, `shopNo` and `coins`; the
match's mode, free seconds, kit, tokens, shields, assists and coins; `assist` both ways and `assistNo`; "coins"
events; shielded blocks.

**Test tools.**
- `/squads/test?mode=mercenary`.
- `bots=blocks` (or `bots=strong,blocks`) has a test lobby's bots block whenever they can, so a test, or Eric, can
  see a shield fire.

### Mercenary: Eric's first changes (Oct 13, 2026)

Eric's changes after Mercenary went live, and the calls made with them. Every number is one line in
`SQUADS.mercenary`; the calibration is `reports/squads-mercenary.md`.

**Brilliant moves pay 25, at most twice per squad per match.** Eric: "a brilliant move pays seventy-five. There
should probably be a cap on how many of those you can get a game... How could one move be more than winning an entire
game?"
- **25** is below a board won in every round (40 in Relay, more later), and a fraction of the base a match pays.
- **The cap, 2 per squad per match** (`brilliant.capPerMatch`), counted by the lobby in each match (`brilliantPaid`;
  Armageddon counts with the final it settles). Each match starts the count again.
- **Why 2:** brilliant moves are rare (0.8 a lobby in the sim), so the cap only stops a freak run. Two still reward a
  squad that keeps finding them.
- **Past the cap** it's still a brilliant move: the banner says "Brilliant! Nf5 by Pam: no coins (cap of 2 a match
  reached)", and the coins message comes with 0 coins and `capped`.

**The Breather is gone.** Eric: "I never said anything about putting in a breather item... seems absolutely
pointless... How would doubling free seconds per move be better than a shield?" The director added it to the brief,
and it overlapped the time coin, so it's taken out entirely: the item, its price and cap, its effect (with it the
match's per-side free seconds, `delays`), the bots' weight for it, its icon, the FAQ line and its tests. Four items
stay, nothing replaces it.
- **A lobby in play across the deploy:** a match stored with a breather in its kit plays on without it, both squads on
  the match's free seconds (`upgradeMatch`). A wallet with a breather still in an open shop's cart gets it refunded at
  what it cost (150, plus the price step for each one bought before), and the counts drop it (`upgradeWallet`). A
  breather already used for an earlier round gives nothing back: it was played.

**The economy's shape.** Eric first set a target: "let's like aim for that being the distribution on average per
round" (500-800 coins a squad a round). Then he made it about the shape, not the number: "more like thinking about
what the average spread should be for any sort of game style like that, a squad game... like Valorant or CSGO, where
doing well should get you rewarded to be able to get a few more things. But even the bottom team... it shouldn't be
that crazy of a distribution... so it can just do its own calculations."
- **Like CS or Valorant:** there, the round payout is most of the money and kills add a little; a team that keeps
  losing gets a loss bonus so it can still buy. Mercenary now works the same way.
  - **The base:** every match a squad plays pays 200 at its end, win or lose (`played`; a drawn final's Armageddon
    doesn't pay it again), and winning it pays 150 more.
  - **Play on top, smaller:** a coin a point of material taken (pawn 1, knight or bishop 3, rook 5, queen 9), a board
    won 40 and a mate 25 more, a drawn board 15 to each side, the capped brilliant moves.
  - **Fewer boards, more each:** a board's coins are doubled in Pairs and multiplied by 4 in the final
    (`roundScale`). Relay has 4 boards, Pairs 2 and the final 1, so without this a squad's play would earn half as much
    each round.
  - **Catch-up is the loss bonus.** In Squads a squad that loses a match is out, so the gap that matters is between the
    two squads meeting. The squad that has earned less gets half the gap, now at most 150 (it was 300, when play was
    most of the coins).
- **The targets, from Eric and the director's notes:** two squads meeting should usually be within about two-thirds of
  each other's coins; a round should buy about a Stockfish token, a time reload and a block or shield, and a very good
  round a second token; 500-800 a round is where Eric pictured it.
- **The result** (the sim, 72 lobbies, the Normal clock; only squads that win reach a shop, so the winners' numbers
  matter):
  - A winner's round: median 622 in Relay (10th to 90th percentile 540 to 650), 686 in Pairs (542 to 742), 730 in
    the final. Losers: 322, 276 and 240.
  - The base and the win are 57-59% of all coins earned.
  - Every winner's round before a shop paid for a token, a reload (100, Eric's Time chip prices) and a shield or block
    points (400). 14% paid for a second token too (700).
  - Two squads meeting: the poorer had earned a median 94% of the richer's coins before Pairs and 93% before the final.
    Their wallets were 97% and 85% (10th percentile 92% and 67%). The wider wallet gap before the final comes from a
    choice: one squad saved everything before Pairs and the other spent.
  - The squad that had earned more won 57-58% of the next matches: some edge for playing better, no runaway.
- **Rejected:** first, the play numbers scaled up to hit 500-800 (the sim's first try: board wins 100). Play was then
  most of the money, and the spread came out wide. Then a base of 250 with smaller play: the spread was so tight that a
  good round bought almost nothing extra (Relay winners within 95 coins of each other).

**Prices.** Eric: "you would always want to try to grab one Stockfish token; if you did really well, you could grab
your second one." The Stockfish token stays 200, +100 a repeat (200, 300, 400). Block points and the shield stay
100, +100: affordable with a token in a typical round, not trivial. The time coin is unchanged here; it becomes the
Time chip, with its own prices, in the next change.

**Length:** a median 32.0 minutes against Classic's 31.3 on the same seeds (90th percentiles 36.4 and 40.3).

**Protocol 4** (`SQUADS_PROTOCOL`): the item list without the Breather and the match without `delays`; "coins" with
`capped`; the "played" coins.

### Mercenary: the Time chip (Eric, Oct 13, 2026)

The time coin (+30 s on the team bank as the next match started) becomes the **Time chip**. Eric: "you can use one on
any turn and it just actually adds time to that current turn... you can store up to a few of them... always want to
go into the next round with a few extra... they don't add to your total... you tap it, it pushes your clock, so even if
you have 20 seconds left it'll go to 50... it opens up the cap for the turn and you can use more than one on a turn."
The rules below are the director's reading of that, recorded as the defaults; every number is in `SQUADS.mercenary`.

- **Name and effect:** "Time chip", +30 s (`chipSeconds`) on one move: the one being thought about on the tapper's
  board. The move's deadline moves 30 s later, so a chip opens the per-move cap too, and those 30 s don't drain the
  bank: the clock jumps (20 s left shows 50) and the bank stands still while the chip's seconds run down. Time from
  a chip that isn't used is lost; it never goes into the bank (Eric's "they don't add to your total"). Several can go
  on one move.
- **When its 30 s run:** from the tap, but not before the free seconds end, so a chip tapped in the free seconds
  still gives its full 30 s. A second chip on the same move while the first is running adds 30 s to its end.
- **Sudden death:** a move has the free seconds and 30 s more for each chip. The chip has to be tapped within the free
  seconds, so the button is there from the move's first moment.
- **The bank running out while a chip holds it:** that move runs to the chip's end; the squad's other moves are cut
  off as before.
- **Owned and stored:** chips belong to the squad's shared pool and are the only item kept from round to round. A
  squad holds at most 3 (`items.chip.cap`), and the shop won't sell past that (held plus cart). In a match the squad's
  chips are the match's (the wallet shows none meanwhile); the ones left go back to the wallet when the match ends.
  A drawn final's Armageddon keeps the final's chips.
- **Tapped, never automatic.** Eric considered a chip that fires by itself when time runs out and rejected it as
  confusing.
  - Any squad player on the move being thought about taps the chip button by their squad's clock, during their
    squad's move. In Pairs, both partners share it.
  - **The first tap wins,** like blocks: a tap carries how many chips the tapper saw on the move, so two teammates
    tapping at the same moment spend one, and the second gets "A teammate's chip went on first". Stacking is a second,
    deliberate tap.
- **Both squads see** each squad's chip count under its clock (with the block points and tokens) and in the panel's
  kit line, and "+30 s" floating up from that squad's clock when one is tapped.
- **Prices** (Eric, Oct 13): "everyone should be able to basically reload on time chips... you spend your extra
  money, if you have it, to reload your time bank." **25, 25, 50, 50, then 50 for every one after**, counted by chips
  bought in the tournament, not chips held (`items.chip.prices`, the last repeating). This replaces the +100 per
  repeat for chips; the other items keep it.
- **Bots** (a squad nobody is playing): they buy chips like other items, up to what a squad may hold, and tap one on a
  move in sudden death with 60% chance, or with under 20 s of bank with 30%, 0.7 to 1.8 s in, then think on into it.
  Not every time, and never a squad with people playing (its chips are theirs).
- **Classic:** no chips.
- **A lobby in play across the deploy:** a time coin still in an open shop's cart is refunded at what it cost (75,
  plus the price step for each one bought before); a time coin bought earlier is already in its squad's bank.
- **The sim** (72 lobbies, the Normal clock, people's chips played by the bots' policy, a chip's time partly used):
  - Squads buy 1.8 chips before Pairs and 2.5 before the final (each round's shop, mean), and tap 1.7 a match in
    Pairs and the final.
  - A round's coins still buy a token, a chip reload (25 + 25 + 50 = 100) and a shield or block points in every
    winner's round, and a second token in 14%.
  - 48% of squads reach sudden death (the time coin's lobbies: 44%, Classic's 51%): a chip doesn't add to the bank, it
    gives one move time. 1.4% of moves are random for want of time (Classic 1.5%).
  - **Length:** a median 33.2 minutes against Classic's 31.3 on the same seeds (90th percentiles 39.3 and 40.3), about
    a minute more than with the time coin (32.0): the chips' time is spent on hard moves.
- **Through the real server** (`scripts/squads-headless.ts --device`, three bot lobbies at once on a busy machine):
  Mercenary 39.9 and 40.1 minutes, Classic 31.9. Relay, before any shop, took 3-4 minutes longer in both Mercenary
  lobbies, so most of that gap comes before chips exist; the pair before Eric's changes went the other way (Mercenary
  35.1, Classic 38.1). Single lobbies swing by minutes, so the sim's same-seed comparison is the length measure. Seven
  of the eight squads that went on reloaded 3 chips before Pairs (the eighth saved); every finalist reloaded before
  the final.
- **The price rule:** the director's brief said to keep +100 a repeat unless chips went unbought. Eric then set chips'
  own list, so that rule never applied: at 25-50 a chip nearly every squad that wins reloads.
- **Protocol 5** (`SQUADS_PROTOCOL`): the item "chip" in place of "time"; the wallet's and the match's `chips`;
  `chip` both ways and "chipNo"; a half's `chips`.

### Crowd 50 v 50: three chess time controls (Eric, Oct 13, 2026)

Eric, Oct 12-13: "10+5s is fine for the long mode, needs to be 3 time options, the games should follow normal chess
timer variations", and "we got to do the time control change first". The pre-game vote "How fast?" (Normal 20 s a move,
Variable 10 s rising to 30 s, Bullet 10 s, all on one 10-minute bank with +5 s a move) is now three real chess time
controls. Each is a bank for the game, an increment added at the start of every move and kept in the bank when a move
is quicker (as on a chess clock), and a cap on any one move, because 50 people pick together and every turn has to end.

| Option | Bank | Increment | Cap on a move |
| --- | --- | --- | --- |
| Bullet 3+2 | 3:00 | +2 s | 10 s |
| Blitz 5+3 (nobody votes) | 5:00 | +3 s | 15 s |
| Rapid 10+5 (today's clock) | 10:00 | +5 s | 20 s |

**The calibration, by arithmetic** (Eric, Oct 13: keep testing proportionate; no sim). A player makes 20 moves before
the team final or the boss battle (10 before the first cut, then one a cut for 10 cuts) and 23 before the duel. A move
of t seconds costs the bank t minus the increment (nothing if t is less: it banks the rest), so a bank lasts
bank ÷ (t − increment) moves. Moves each bank lasts, and what's left after the 20 moves before the final:

| Time control | 6 s a move | 7 s a move | 8 s a move | The cap every move |
| --- | --- | --- | --- | --- |
| Bullet 2+1 (asked for) | 24 moves (0:20 left) | 20 (0:00) | 17 (dry at move 18) | 13 (dry at move 14) |
| **Bullet 3+2 (built)** | 45 (1:40) | 36 (1:20) | 30 (1:00) | 22 (0:20; dry at move 23) |
| Blitz 5+3 | 100 (4:00) | 75 (3:40) | 60 (3:20) | 25 (1:00) |
| Rapid 10+5 | 600 (9:40) | 300 (9:20) | 200 (9:00) | 40 (5:00) |

- **Bullet is 3+2, not 2+1.** The brief's rule: if 2+1 runs a normal-pace player dry before the final, make it 3+2
  and keep the 10 s cap. At 7 s a move 2+1 is empty at exactly move 20, and at 8 s at move 18, so a normal-pace player
  would play the last cuts on 1 s a move. 3+2 keeps a 7-8 s player in time through the knockouts with a minute or more
  to spare, and someone at the cap every move lasts about the whole knockout phase. It's still clearly the fastest
  option: 3 minutes and at most 10 s a move, against Blitz's 5 minutes and 15 s.
- **The finals use the same clock.** The team final and the duel go on on the same board; the boss battle's crowd turns
  too. In a long final on Bullet a normal-pace player will be on the increment alone (2 s a move) after about 16 more
  moves (80 s left at 7 s a move), as in real bullet. Not changed: it's what Bullet means. If playtests find a 2 s
  move too short on a phone, Bullet 3+3 is a one-line change in `votes.ts`.
- The bots think 2 s up to 85% of the cap (`botThinkMs`): on Bullet 5.25 s a move on average, so about 55 moves on 3:00.

**The calls made:**
- **Nobody votes: Blitz**, the middle option. The director's call, keeping the rule that nobody voting gives the middle
  option (it was Variable).
- **Left to right, fastest first** (Bullet, Blitz, Rapid), as the brief lists them and as chess sites order them.
  Icons: ⚡ Bullet (the old Bullet's), 🔥 Blitz, ⏱️ Rapid (the old Normal's).
- **Each option is one data entry** in `PREGAME_VOTES` (`votes.ts`): `timeControl(id, icon, name, { timeBankSeconds,
  timeIncrementSeconds, moveClockSeconds })`. The patch sets those three (and clears any rising schedule); the card's
  label ("Bullet 3+2") and blurb ("3 min + 2 s a move · max 10 s") are made from the same numbers, so they can't drift
  apart. The title stays "How fast?" and the vote's id `speed` (so `?speed=` keeps working).
- **Everyone's bank is set when the vote ends.** The match is made (with the default 10:00 bank) before the vote, so a
  patch with a bank resets every player's bank, people and bots, as long as no move has been played (`startBanks` in
  `match.ts`, called by `MatchRunner.patchSettings`; solo and the lobby server both go through it). It never touches a
  bank once a move is played.
- **The bank isn't capped at its start:** quick moves can take it past 3:00, as in chess.
- **Old `?speed=` ids** map to the new ones: normal → rapid, variable → blitz, bullet → bullet (and the older slow and
  standard → rapid). An id we don't know gets the default (Blitz); no id means the vote decides.
- **Gone:** Normal, Variable and the old Bullet, `VARIABLE_CLOCK` (nothing else used it), its table in How to play and
  `clockStepRanges`/`clockScheduleLine`. Kept: `moveClockSteps` and `moveClockAt`, the one place every clock is read
  (solo, the server, the finals, the bots); no option has a rising schedule now, but removing it would touch the runner,
  the server and the app for nothing a player sees. Its tests keep an inline schedule.
- **Without the vote** (Pre-game votes off, Everyone moves, raids and Boss alone) the clock is Rapid 10+5 with a 20 s
  cap, as before. Raids and Boss alone never read the vote (`pregameVotes` needs 50 v 50 with votes on). Squads' team
  clocks and Mercenary's time chips are untouched.

**Everywhere the vote's clock reaches (checked):**
- **Solo:** the runner's settings carry the patch, so the deadline (`allowedMsFor`), the board's clock and the bots'
  timing follow it.
- **The lobby server:** the patch goes into the record's overrides (it survives the Durable Object sleeping; tested by
  waking a lobby from its record) and into the runner; each person's deadline comes from their own bank. A miss costs
  the whole allowed time, as before.
- **Online apps:** the board's clock adds the increment to the bank as your move starts, so the app must know it. An app
  joined from PLAY only knows the Crowd's usual clock, and a reload mid-match never sees the vote, so each `round`
  message now carries `increment` beside `moveClock`. Crowd's lobby protocol has no version number (only Squads has
  one, `SQUADS_PROTOCOL`), and the field is optional both ways: an older app ignores it, and a new app on an older
  server keeps its own increment. Nothing to bump.
- **Replays:** the home page's live window plays recorded bot matches on its own ply timing (`LIVE_WINDOW`), and a new
  board's settling-in replay runs before the clock starts. Neither reads the vote; unchanged.
- **The finals:** team final, duel and boss battle all take each move's deadline from the same bank, increment and cap
  (the boss battle's clock counts on from the game's move number, which with a flat cap changes nothing). Found and kept,
  as pacing of their own: in a final, a bot's turn waits its recorded think time clamped to 1.5-4 s (solo) or 1.5-6 s
  (online), and solo squeezes the other team's whole turn into at most 5 s. Neither is a person's clock, and the time
  charged to a bot's bank is still its drawn think time, capped by its bank and the cap.
- **The scoreboard's BANK** comes from the server's (or solo runner's) banks, so it starts at the voted bank and moves
  after each move. `LOW_BANK_MS` (red under a minute) works for all three.

**Testing.** The full lane, not the light one: this changes the runner (`patchSettings`) and the protocol, which the
lanes rule (CLAUDE.md, Eric, Oct 13) puts in the full lane. Unit tests: each option's patch, the bank and increment
math (banking on quick moves, the cap, an empty bank), the calibration above, the old ids, the default, the runner
resetting banks only before move 1, and the lobby applying the winner (round, increment, banks, and after waking).

### Squads: three chess time controls (Eric, Oct 13, 2026)

Eric, Oct 13, of the 50 v 50's three chess time controls (above): "I wanted that for squad"; he expects the bullet
modes to be popular. He approved the director's plan before going to sleep ("go ahead"): three options named like chess
time controls; the shared team bank stays (it's what makes Squads work across Relay's simultaneous boards), and the
top-ups unless the increment makes them pointless; a real chess increment that banks; a cap on a move for each option;
medians of about 20, 30 and 40 minutes with sensible 90th percentiles; nobody voting gives the middle one; old ids
mapped. The calls, all made without Eric:

| Option | Bank | Increment | Free seconds | Cap on a move | Top-up a round |
| --- | --- | --- | --- | --- | --- |
| Bullet 1+1 | 1:00 | +1 s | 2 s | 10 s | +15 s |
| Blitz 3+2 (nobody votes) | 3:00 | +2 s | 2 s | 15 s | +30 s |
| Rapid 5+3 | 5:00 | +3 s | 2 s | 20 s | +1:00 |

- **The increment banks** as on a chess clock, by the rule the team clock already had (`incrementSeconds`, 0 until
  now): each move made in time earns it, credited after the half; a missed move earns none (`incrementOnMiss`). A
  move quicker than the free seconds and the increment together adds to the bank, which isn't capped at its start; a
  slower one costs only what's past them. Credited after the half, not at the move's start (the 50 v 50's way):
  with several moves draining one bank at once, the rule that existed keeps every other part of the team clock (the
  double drain, the bank running out mid-half, the Time chip's windows, the screens' clock) as it was.
- **Sudden death with an increment.** At zero each move still has only the free seconds; one made in time earns the
  increment, which lifts the squad out again, so near zero a squad lives on it (each move the free seconds plus the
  increment: 3 s on Bullet, as sudden death gave before). "sudden_death" now comes only when a bank is still empty once
  the half's increments are in. The screen's sting plays when a squad's clock hits zero and again only after its bank
  has been back above the low line (30 s): living on the increment would otherwise sting every half.
- **The increment sets the pace, not the bank** (the tuning runs' finding). In the sim's model people spend their
  bank over 40 moves plus most of the free seconds and the increment, so a squad's bank settles where its drain and
  its increments meet (a round 1 winner carried about 20 s on Bullet, 35 on Blitz, 50 on Rapid). A bigger bank only
  slows each round's start. In the tuning runs (12 lobbies each, the usual bot spread) 1+1 and 1:30+1 ran 26.9 and
  26.1 minutes, 2+2 and 3+2 30.9 and 32.7, 4+3 and 5+3 39.8 and 40.3: the bank moved a lobby by a minute or two, the
  increment by 5-8. So the options' increments step 1, 2, 3 s (and 1, 3, 5 minutes reads as a chess ladder too).
- **The free seconds stay, at 2 s for every option (were 3).** With an increment on top, 3 s made each option about 4-5
  minutes longer (people spend most of the free seconds every move: Blitz 3+1 with 3 s ran 37.6 minutes, 3+2 with 2 s
  34.8, 8 lobbies each). Gone, sudden death would have no time for a move. One number for every option keeps it clear ("A move's first 2 s are free"), and the Time chip's
  "30 s from after the free seconds" reads as before. 2 s in sudden death is tight for a pair on a phone, but sudden
  death is now 0.2-0.5% of moves, and a move made in it lifts the squad out.
- **Caps 10, 15, 20 s,** as the 50 v 50's; each match carries its own (`capMs`), Armageddon the final's. The single
  `moveCeilingSeconds` is gone.
- **Top-ups stay, scaled (+15 s, +30 s, +1 minute).** The increment makes them less needed (a squad is never stuck in
  sudden death), but not pointless: Pairs is where squads reach sudden death (the slower of two pickers drains the
  bank), and a round's top-up is its buffer there. They cost under a minute a round.
- **Names and cards:** "Bullet 1+1" (`clockLabel`, minutes and increment as chess players write them), the blurb
  "1 min + 1 s a move · max 10 s" as the 50 v 50's cards, and the rest in the result's banner (`teamClockDetail`: one
  clock per squad for the tournament, the top-up, the free seconds, the increment, sudden death; short enough for a
  320 px phone). Icons as the 50 v 50's: ⚡ 🔥 ⏱️. Each match's opening card says the time control in one line
  (`matchClockLine`: "Blitz 3+2 · +2 s a move · max 15 s"), for anyone who missed the vote.
- **Nobody votes: Blitz,** the middle option, as Normal was.
- **Old ids** (`clockById`): fast → bullet, normal → blitz, long → rapid; an id we don't know gets Blitz, never an
  error. A stored vote's result is the option's place, so an old Fast, Normal or Long vote reads as Bullet, Blitz or
  Rapid. **A lobby stored mid-tournament keeps its numbers** (`upgradeClock`, `upgradeRules`, `upgradeMatch`): its
  clock and matches, stored without a cap, get the one ceiling every option had then (20 s, `legacyCapSeconds`), and
  it finishes on the clock it voted. Upgrading it to the new option would change the increment and the cap under
  players mid-tournament.
- **Test links:** `?clock=bullet|blitz|rapid` (old ids mapped) or the numbers with an optional fifth, the cap
  (`120,30,3,1,10`); four numbers keep the old 20 s ceiling, so every older link means what it did.
- **Bots** pace themselves as before (their bank over 40 moves plus 80% of the free seconds and the increment), but
  never past 90% of when their squad's bank would run out with all its moves going (`cutoffMs`, `liveCutoff` as the
  half begins; `bots.inTime`), not just of their deadline: near zero on Bullet the deadline is the cap, 10 s, and the
  bank runs out at about 3 s. And a bot waiting for its devices' answer plays from the quick look by then too: a
  weaker move in time beats a random one. No per-option tuning was needed.
- **The Time chip** works as it did: 30 s on top of the option's cap, the bank held still from after the free seconds,
  the increment still earned by a move made in it; in sudden death the free seconds and 30 s.
- **The sim's people watch the clock** (the one change to its model): about to think past 85% of the time they can see
  (the cap, or their squad's bank running out), they hurry as in sudden death. Without it, squads living on their
  increment near zero would have people blindly thinking past their bank.
- **The calibration** (`reports/squads-sim.md`; Classic 36 lobbies an option, 12 per skill mix; Mercenary 12):

  | Option | Classic median | 90th pct | Mercenary median | 90th pct | Squads reaching sudden death | Moves in it | Random for want of time |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | Bullet 1+1 | 26.9 | 34.7 | 29.9 | 39.9 | 31% (Merc 28%) | 0.5% (0.5%) | 0.7% |
  | Blitz 3+2 | 33.5 | 40.9 | 37.8 | 41.6 | 22% (23%) | 0.4% (0.3%) | 0.6% |
  | Rapid 5+3 | 43.9 | 54.5 | 43.9 | 52.7 | 22% (17%) | 0.4% (0.2%) | 0.4% |
  | (old Fast, Normal, Long) | 28.6-31.1 | 33.3-39.6 | | | 46-64% | 7-13% | 1.3-2.1% |

  The usual bot spread alone (Mixed): 26.9, 32.7 and 40.3. Level matches no longer go to the coin (0 of 258; a
  quarter to a third did, both squads at zero).
- **Bullet doesn't reach 20 minutes, and can't on its clock alone.** About 11 minutes of every lobby is shown, not
  played (each Relay half's moves, 1 s; the pair's reveal, 3 s; the final's, 4.5 s; over about 220 halves, plus the
  votes and the bracket), and the slowest of four people choosing in a half takes about 3-4 s even at a person's
  fastest. Shorter reveals in Bullet (Pairs 2 s, the final 3 s) bring it to 24.0 on the same seeds (Mixed): left to
  Eric, as it's how the reveals look. Blitz and Rapid are 3-4 minutes over their 30 and 40; Rapid's 90th percentile
  (55, strong squads' long games) is the long one. Rapid 5+2 or a 15 s cap would trim it.
- **Through the real server** (`scripts/squads-headless.ts --clock bullet --device`, one idle person whose device did
  the bots' engine work): a full Bullet lobby took **32.9 minutes** from the fill to its results, within the sim's
  spread (median 26.9, 90th percentile 34.7) and long for the usual reason: one Relay match ran 13 minutes (boards of
  159 and 183 plies) and held up its side of the bracket; Pairs took 8 and the final 10. The bots were never out of
  time: 0 missed actions in 1,949 moves (the 3 on the record were the idle person's, before a bot took the seat), and
  squads that tied in rounds 1 and 2 had 2-7 s of bank left, living on the increment. A first try ended at 24 minutes
  into the lobby (in the final) when the local server stopped; Relay then took 8.4 minutes and Pairs 13.3 (a 129-ply
  game).
- **Screens:** the vote's result banner with a detail line (Squads' Mode, Start and Clock votes) is centered in the
  board rather than 28% down: at 320 px it ran over the cards under it (every Squads option with a detail did,
  before this too). Checked frame by frame at 320, 390 and 1280 px (the Clock vote, its banner, the match's card, the
  clock line on Rapid and near zero), and measured in `e2e/squads-clocks.spec.ts`.
- **Protocol 6** (`SQUADS_PROTOCOL`): a clock's `capSeconds` in the rules, a match's `capMs`.
- **Untouched:** the 50 v 50's time controls, raids and Boss alone, and Armageddon's own clocks (90 and 60 s, +1 s;
  now with the lobby's 2 free seconds and the final's cap).

**Testing.** The full lane: this changes the rules, the server, the protocol and stored data. Unit tests: each option
into every match, the increment banking, the cap, sudden death and the increment lifting a squad out, living on the
increment, the old ids and the default, a stored match and lobby upgraded (and a lobby on the old Normal clock played
to its results), the Time chip on every option, bots on every option (and a whole bot lobby on Bullet) in time, the
server applying whichever option the vote picks, the test link's clock, the FAQ's words from the settings. e2e: the
Clock vote's cards, its banner and the clock line whole at 320 px, and the winner's cap in the deadlines.

### Wrangler, a sprite preview (art only, Oct 13, 2026)

A pink cowboy pig with two lassos, from Eric's reference, drawn so Eric can review him before his powers are designed
(as with Sawyer's and Big Boy's previews). Eric named him **Wrangler**, a cowboy who rounds up livestock. Art only: no
powers, rules, lines, sounds, kit or roster entry, and he is not in `CHARACTERS`, so nothing in the game shows him
(`packages/app/test/pig.test.ts` checks that, and makes the checks `characters.test.ts` makes of every character).

- **Names:** the display name is "Wrangler"; the code id and file stay `pig` (`characters/pig.ts`, `PIG`), because
  "wrangler" already means Cloudflare's CLI in this repo (`wrangler.jsonc`, `npx wrangler`).
- **Previews without registering him:** `npm run preview:characters -- <dir> extra=packages/app/src/characters/pig.ts
  only=pig` (the preview script already loads draft modules). He was also checked in the real game on a 390 px phone
  and a 1280 px computer by swapping his kit into a boss's place from a scratch script, not from the app's code.
- **Art** (`characters/pig.ts`): a 115 x 77 frame (the extra width on our right is room for the throw); at rest he is
  75 x 70 px, 68 px above his feet (Sawyer 67, Big Boy 69, Hollow 75), 37 px each side of his foot point. Facing front,
  turned a little to our left as in the reference, light from the top left, the same 1-pixel dark outline and halo as
  the cast. Kept from the reference: the brown hat with its dark band and gold star, pointy pink ears, angry brows, the
  big snout (light, dark-rimmed, two nostrils), the toothy grin rising to one cheek, the fringed vest with its star,
  the belt and big gold buckle, the boots with gold spurs, the loop spinning overhead and the coil in the other fist.
  - **Simplified for size:** the fringe is a row of dark ticks along the vest's hems; each spur is a gold strap and a
    3 x 3 rowel; the hat's badge and the vest's star are 5 x 5 stars (the badge's ring was dropped); the slack under
    his spinning fist is one small hanging loop (the reference has several); the coil is three rings, not a tangle;
    the rope's twist is a darker tick every 3 px. The snout, ears, hat and loop were kept big, so at 1x on a phone he
    reads as a pig in a cowboy hat with a lasso.
  - **Fitting the phone's boss bar:** the loop sits a little lower than in the reference (behind his far ear and the
    hat's brim) and the coil arm is shorter, so nothing rises above Sawyer's height under the heading and the coil
    stays off the boss's name. Like Sawyer he needs the `wide` box (58 px) when he gets a kit.
  - **Rigging:** a loop is an ellipse (center, radii, tilt) painted as rope, and the line runs from his fist to the
    loop's nearest point, so a lasso pose is a few numbers; arms and legs are painted from their points, the hat from
    its tilt (for the nod), every part made the first time it shows (`lazyParts`).
- **Animations** (a turn of the spin is 8 frames; one-shots end on the idle's first spin position):
  - `idle` (loop, 4.1 s, silent): the loop spins overhead the whole time (it swings round and foreshortens, its knot
    running round it, his fist circling), a dip at the knees now and then, two blinks, a sneer (one brow cocked, the
    lip curled) and a snort (head jerk, flared nostrils, two puffs).
  - `lasso` (1.9 s): a quick wider spin and a lean back (cue `whirl`), he hurls the loop out to our right (cue
    `throw`), it drops over its mark on the ground (cue `catch`, at `CATCH`), he hauls it tight (cue `tug`) and drags
    it a little way, then flicks it home over his head. Made for his future passive (he ropes a piece and drags it a
    square); the board will aim at `CATCH` later.
  - `taunt` (2.2 s): a slow nod tipping his hat down over his eyes (cue `tip`), then a laugh with his head back and the
    hat hopping (cue `laugh`), snorts (cue `snort`), and a spur stomp with dust and a glint off the spur (cue `stomp`).
    A hand-to-brim hat tip didn't work: his arms are short (cartoon proportions), so the nod tips it instead.
  - `windup` (3.1 s, a generic ultimate wind-up, since his ultimate isn't designed): he shakes the coil out into a
    second loop (cue `windup`), spins both over his head faster and wider, hurls both out (cue `throw`), they drop (cue
    `catch`), a double yank (cue `tug`), then he gathers up. It doesn't copy Big Boy's Big Bounce.
- **For later (not built):** his passive (Eric: now and then he lassos one crowd piece and drags it one square, only
  when Stockfish says it costs the crowd less than a pawn) and his ultimate (Eric's to design; a big rope catch was
  mentioned). When he becomes a boss: a kit (`wide`, his portrait `PIG_PORTRAIT`), sounds for his cues, his lines.

### Wrangler, built (Oct 13, 2026)

Wrangler becomes a playable boss (`pig`, 🤠, display name "Wrangler"; the code id stays `pig` because "wrangler" is
Cloudflare's CLI here): his rules, the host's engine search for his powers, the server's checks, his moments, sounds and
lines, on the approved sprite (only added to). **Eric's idea, with the director's calls** (Eric, Oct 13: "you can make
the design decision"), then the calls made while building him.

#### The design (Eric's idea; the director's calls, settled)

- **A cowboy pig with two lassos.** Three lasso powers, each checked by the engine so it bends the game, never breaks it.
- **The long pull** (his opening flourish): his first move is a center pawn's double step, then he lassos it one square
  further (three squares in one move). The engine picks the d- or e-pawn; neither sound (it hangs the pawn, or its path
  or square is blocked): an ordinary first move. Measured by the director (Stockfish, depth 18): −0.2 to +0.3 pawns for
  him against a normal first move, pure flavor; side pawns are bad for him (c-pawn −0.7 to −1.8), so center only.
- **The lasso drag** (passive; Eric: "he drags your piece one direction, up down left or right... only when it's
  calculated that it drops you less than a pawn... a slight disadvantage according to Stockfish... not a ton"): every
  `dragEvery` turns from about turn 3, one crowd piece dragged one square orthogonally onto an empty square. Never the
  king, never a pawn onto the 1st or 8th rank, never leaving the crowd in check or without a move. Of the legal drags,
  one costing the crowd 0.1 to 0.9 pawns, nearest the middle, seeded among ties; none: no drag, and it doesn't count.
  About 3 to 4 a battle, estimated (Eric's rule on power rates).
- **SHOWDOWN!** (ultimate; Eric: "he takes three of your pieces and three of his... facing each other in a line, not
  much space between, near the center... an opportunity for the players to make a big devastating mistake, but even if
  they make the correct play it's still slightly advantageous for the boss"). **The director's finding:** with free
  play after the line-up the crowd wins (whoever moves first grabs material), so **the crowd's next move must be one of
  the duels** (its piece taking his facing one). Three matched pairs (queen, rook, then bishop or knight), each facing
  along a file, rank or diagonal (knights a jump apart) with 0 or 1 empty squares between, all six on files b-g, ranks
  3-6, his three always protected, bishops on their own color. The host's engine searches line-ups (the warning turn,
  and from about 85% of the meter); the best duel leaves him +0.1 to +1.2, another costs the crowd 2 or more pawns more;
  no check, never a mate in 1 for him after the best duel; nearest +0.5, seeded among ties; about 8 s a turn. Nothing
  found: "Not yet..." up to 2 more turns, then a 2-pair showdown, then a lasso drag. No legal duel: a normal move.
  Online the host computes and everyone gets the same line-up through the shared state (as Big Boy's bounce). About two
  a battle on the meter, estimated, not yet sim-tested.
- **Also:** an Elo offset like the others; the Maia brain as for every boss, the special moves keeping their own logic;
  the FAQ; test links.

#### What was built, and my calls

- **Rules** (`packages/chess/src/bosses/pig.ts`, on the base boss; every number in `BOSS_POWERS.pull*`, `drag*`,
  `showdown*`): pure checkers (`pullOptions`, `dragOptions`/`checkDrag`, `checkLineup`) the server, the host and solo
  share, and the engine work (`pullFrom`, `dragFrom`, `showdownFrom`, `pigTurn`) that runs where the boss's moves are
  worked out. The grid helpers Big Boy's bounce used moved to `bosses/grid.ts` and are shared.
- **His color: Black, as every raid boss** (my call). He starts from the starting position (his center pawns must be
  home), and a raid's crowd plays White (Boss alone too), so his pull answers the crowd's first move: d7-d4 or e7-e4,
  whichever is sound (after 1.e4, e7-e4 is blocked, so d7-d4 if it doesn't hang). Playing Black like the others keeps
  the crowd's first move its own and the pull a reply to it. `?side=b` turns it round for testing (the crowd Black,
  his pull White's e2-e5 or d2-d5 as move 1), and the rules handle either side.
- **The long pull:** "unsound" is (a) the double step not legal or the third square taken; (b) the pawn left simply
  taken on its square (attacked by a crowd pawn, or by more crowd pieces than defend it), or giving check; (c) the
  engine's best pull costing him more than `pullMaxLoss` (0.5) pawns against his best ordinary move (`pullNodes`). He
  plays the pull that's best for him. It goes on the board as the double step (his real move, so the move list, the
  clocks and the judges see a legal move) and then the pawn is lassoed on as a base (the same way Big Boy's bounce
  changes a position outside a move); no en passant after it. The Maia brain plays his ordinary moves; the pull is his
  own logic, decided before the brain is asked.
- **The lasso drag:** first on crowd turn `dragFirst` (3), then every `dragEvery` (10): turns 3, 13, 23, 33, so 3 to 4
  in a battle of 30 to 40 crowd moves (estimated, not sim-tested). Calls on top of Eric's rule:
  - **Never a bishop** (my call): any orthogonal step changes a bishop's square color, giving two bishops on one
    color, a position no game could reach (Big Boy's bounce keeps bishops on theirs for the same reason).
  - Never onto the en passant square, never leaving more of the crowd's material hanging than before (a cheap filter
    before the engine), never a drag that gives check either way.
  - **A decided game has none** (past 4 pawns either way): the engine's expected score is flat there, so it can't read
    a 0.1-0.9 loss (I saw drags never land in the band in won or lost games; it now skips without the engine time).
  - The engine: at most `dragCandidates` (16, a seeded sample) glanced at (`dragScreenNodes`, 8k), the `dragConfirm`
    (3) nearest the band's middle looked at properly (`dragNodes`, 50k), the one nearest 0.5 played. About half a
    second on one engine on a computer.
  - Shown with the lasso throw: the art's `CATCH` point lands on the piece, he hauls it a square ("LASSO!").
- **SHOWDOWN!, my calls:**
  - **The band is measured from the position before the line-up**, not from level (my reading; recorded for Eric).
    In checking the director's experiment I found its sign was flipped: Stockfish scores the side to move, which after
    the crowd's forced capture is the boss, but `showdown_forced.py` read it as White's (the crowd's), so its "best duel"
    was his best, and its 3-15% wasn't Eric's goal. Measured properly over 8 middlegames: about 1.7% of random line-ups
    meet the goal with the band from level, about 5% with the band from the position before, and about 1 in 9 with the
    generator below. From level the goal also can't be met at all once the game is lopsided (a crowd 3 pawns up would
    need a 3.1-pawn swing). From the position before, it means what Eric said: even the right duel swings the game a
    little his way (+0.1 to +1.2), a wrong one 2 or more pawns further. In a level game the two readings agree.
  - **Mates:** no line-up where the engine sees any forced mate for him after the best duel (stricter than mate in 1),
    and a mate-in-1 check on top.
  - **The generator** (`lineups`): pairs by value (queens, rooks, then bishops or knights; the most valuable available),
    each crowd piece and his of the kind moved to two facing squares in the middle, never through another of the
    line-up's squares, never onto a square another line-up piece left; his piece protected after the line-up; no
    check. It prefers line-ups where at most one of his three is attacked by two or more of the crowd's pieces (over
    1,200 line-ups in 8 middlegames, 11% of those met the goal against 3% of the rest), until 1000 tries in a row find
    none. Bishops stay on their color, rooks leaving a
    corner take their castling right. Seeded by the turn (`lassoSeed`, never the battle seed: the host would learn
    every power's rolls).
  - **The search** (scan, then confirm): each line-up costs one search per duel at `showdownNodes` (8k, a quick scan
    read with slack); the promising ones are scored again at `showdownConfirmNodes` (40k), checked for the mate, and
    the first that qualifies, nearest +0.5, is his. It runs during the crowd's turn as a **scout** on the device's own
    engine (from `showdownScoutFrom`, 85% of the meter, through the warning and holds), up to `showdownSearchMs` (8 s)
    a turn; at his turn the scout's finds are re-checked on the new position first, then fresh ones for up to
    `showdownTurnMs` (3 s; at most `showdownSetups`, 60, line-ups). The line-up tries run in 6 ms slices between
    frames, the engine in its own worker, so the board never freezes. Measured on one engine on a computer: a showdown
    found in 1 to 3 s in the positions that have one (4-5 of 8 middlegames at the turn's budget; the others at a later
    try or decided). A phone is 3-5 times slower: the scout's time is what makes that work.
  - **Holds only help with three pairs left:** if the board no longer has three matched pairs, waiting can't help
    (material only goes), so the try is his last at once: two pairs, then a drag.
  - **Fizzle-proof:** "Not yet..." (`showdownHolds`, 2) uses his taunt and a line; the 2-pair showdown follows the same
    rule; the last resort is a drag in the passive's band, shown as his ultimate (and if not even that, the meter is
    spent and he says so, so the meter never sticks). No engine anywhere (online, nobody can run one): no showdown.
  - **The forced duel:** the crowd's allowed moves are only the duels (`crowdFilter`); none legal: the dispatcher lifts
    the filter (a normal move). The move clock is the usual one. The duel is a turn the crowd didn't set up
    (`powerTurn`), as after a drag.
  - **Online:** the server asks the host for his move plus what his turn needs (`bossRequest.pull`, `drag`,
    `showdown: "try" | "last"`, and the turn's seed); the host answers with the move and the drag or line-up
    (`bossMove.drag`, `showdown`); the server checks each answer with the same pure checkers and puts it on the board
    as a base, so everyone sees the same line-up. The host's reply has 15 s more for a showdown, 8 s more for a drag.
    The main lobby protocol has no version constant (only Squads has one), so none to bump; the new fields are optional.
  - **Rage speed** 1.1 (his showdown pauses the meter for one turn after its warning, more if he holds): about two a
    battle, estimated, not yet sim-tested.
- **Strength: offset −250** (my judgment), as Big Boy and Sawyer: his drag costs the crowd about half a pawn three or
  four times a battle, and a showdown swings about half a pawn his way with a trap on top, nastier than the −100
  bosses' powers.
- **Screens** (`components/Pig.tsx`, his kit "Wrangler" with the `wide` box): the long pull and each drag are a
  moment ("LONG PULL!", "LASSO!"): he hops out of his corner beside the piece, the throw's loop drops on it at the
  art's `CATCH`, the `tug` cue hauls it a square (he steps with it), and he hops back. SHOWDOWN!: the banner, he leaps
  into the middle with the wind-up (both loops), leaps back to his corner, and his ropes yank the six pieces into the
  line-up one pair at a time (each rope from his fists), then "DRAW!" with a quick-draw sting; the three duels glow as
  the only choices and the dock says "Showdown! Take one of his three." The duel then plays as a normal move.
  "Not yet..." is his snort and a line; a showdown spent with nothing to show (no line-up, no drag) gets its own line
  ("Next time, varmints."), since there's no next try. The God King has his word at "DRAW!" ("Three duels, and one's a
  trap. Choose well!") and that turn keeps quiet about a queen in danger or a mate threat: only a duel can be played.
  Checked frame by frame on a 390 px phone and a 1280 px computer, light and dark (`npm run frames:pig`).
- **Sounds** (`characters/pig-sounds.ts`, synthesized): rope whirl, throw, catch, tug, the hop's thump, his snort and
  snorting laugh, a spur stomp, the double wind-up, a pair's yank, and "DRAW!"'s sting (a low damped twang and a knock).
  All under a move's loudness, nothing bright.
- **Lines** (his text box): "This board ain't big enough for the six of us.", "It's high noon!", "Pick yer duel,
  varmints.", "Not yet...", "Yee-haw!", and so on.
- **Test links:** `?boss=pig` (Boss alone against him), `?boss=pig&power=showdown` (the warning as turn 2 begins, the
  line-up searched after his next move, the showdown as turn 3 begins, or "Not yet..." first), `?boss=pig&power=drag`
  (drags from turn 2, every 2 turns), and the admins' "Trigger ultimate (testing)" (searched after his next move, no
  warning). `?side=b` for the crowd as Black (his pull as White). A raid link takes `&boss=pig` too.

**Testing.** The full lane: new rules, the server, the protocol and the screens. Unit tests
(`packages/chess/test/pig.test.ts`): the long pull (center pawns only, skipped when blocked, hanging or too costly, the
board's record), the drag (its band and pick, never the king or a bishop, never into check or no move, a pawn never
to the 1st or 8th rank, castling rights, the server's check, seeded and deterministic), the showdown (the line-up's
shape and middle, his pieces protected, bishops on their color, the band and the trap, mates refused, the forced duel
and the no-legal-duel case, the scan and confirm, the scout's carried line-ups, holds, two pairs, the drag and the spent
turn as fallbacks, the same line-up from the same seed and position, the host's answer and solo's agreeing); the lobby
("Wrangler online": the host asked and answered, a bad answer refused); the app (his art, kit, moments, lines, sounds,
the duel turn). e2e (`e2e/pig.spec.ts`, phone and computer): the long pull and a drag; SHOWDOWN! with only the duels
playable; online, the host's line-up through the server. `npm run perf:boss -- <dir> pig both 25` (and with
`showdown`): 16.7-16.8 ms frames at the 95th percentile through his searches on the computer and on the phone at 4x
CPU slowdown, the scout's turns included; nothing grows with the match. In the perf runs the God King's Last Stand
(once a battle) twice undid the crowd's wrong duel: the trap works, and the King can still save the crowd from it.

### Resign: leaving a match in every mode (Eric, Oct 13, 2026)

Eric: "we need a surrender button basically, or a forfeit button, for every game mode... right now when I play test I
basically just refresh the screen or back out of it. Against the bosses, if you know you're losing, there's really no
exit unless you just leave. And that just seems to hang a session. And then surrendering can also close lobby codes and
stuff... take a look at how chess.com and lichess put it on their screen... do something similar so it's familiar to
players... I know they have undo move; we're not building anything like that at the moment."

**What hung.** No match screen had a way out (only Squads' standings had "Leave the lobby"). So:
- **Online**, someone who closed the tab kept their seat for the rest of the match: every move of theirs was a miss,
  and every move waited out the whole clock for a pick that never came. With nobody left, the match still played on
  by itself for up to an hour or more (each move its full clock; the boss's moves, with no device to play them,
  random after a 15 s wait), counted on the live line all along, and only the 180-minute safety cap would have
  closed one that stuck. And opening the app again put you straight back into it (the device remembers the match it's
  seated in, to rejoin it): the losing session you'd walked away from, every time.
- **Solo**, the only exit was a reload. Knocked out, the rest of the match was played out with the engine on "Playing
  out the match…" (minutes in a 50 v 50 or a raid), with no way to skip it; and a solo match's steps after an engine
  search didn't check whether it had been left meanwhile (a search finishing late could set its timers going again).

**Where the button is** (lichess and chess.com: a small flag by the moves and clocks on a computer, a bottom bar or a
"⋯" menu on phones, with a second step):
- **Phone:** "⋯" at the right end of every match screen's top line, where the sound button was, opens a small sheet at
  the foot of the screen: one row, **Sound** (on/off) and **Resign** with a flag (**Leave the match** before move 1, or
  once you're out) side by side. A tap anywhere else, "⋯" again or Escape closes it. A home for later options. The
  sound button moved into it because the top line has no room for both at 360 px with its widest numbers (the cut pill
  already runs close: `e2e/crowd.spec.ts`). One row, and the confirm one short paragraph, because on the shortest
  phones (an iPhone SE, 375 x 667) a taller sheet reached Squads' clocks under the board.
- **Open through the next move:** a match screen is drawn afresh when the phase changes (a reveal, the next move, the
  boss's reply), so the sheet or confirm someone just opened stays open through that instead of vanishing under their
  thumb (it was found vanishing by `e2e/sound.spec.ts`).
- **Computer** (the game's two-column layout, 900 px wide and up): the **flag** beside the sound button at the top
  line's right end, above the panel beside the board. My call against putting it under the board: the row under the
  board is different on every screen (« » and power-ups, the boss's dock, the reveal, the vote's cards), while the top
  line is the same everywhere, Squads included.
- **Both:** a second step that says what will happen: "Resign? You'll leave this match and it counts as a loss. A bot
  takes your seat." with Cancel (focused, so Enter or a stray tap never resigns) and Resign. Nothing dims or covers the
  board, its moves or the clock meanwhile: the phone's sheet sits at the foot of the screen, the computer's confirm
  under the flag (checked by `e2e/resign.spec.ts` and frame by frame).
- **Someone already out** (the cut screen, watching in Classic, Classic's stage break, solo's play-out) also gets a
  plain "Leave the match" button there; solo's play-out says "Skip to your result".
- No undo, no draw offers (Eric: not now).

**What resigning means** (`LEAVING` in settings.ts):
- **Solo** (Boss alone, a Solo raid, a Solo 50 v 50, Classic): the match stops at once, a loss: you're out in the last
  place still open; "You resigned" on the results (Boss alone: the boss won). Every timer stops, every step after an
  engine search checks first, Maia's worker and the showdown scout close (the engine pool's workers stay up, idle,
  for the next match). Recorded on your profile as any solo result (team or boss result a loss).
- **Online** (Crowd 50 v 50, everyone moves, boss raids, Classic): you can't end the game for everyone; you leave it.
  - **Out in the last place still open**, where a cut would put you now (the familiar battle-royale rule; never your
    current rank, or resigning while ahead would beat playing on). A bot then playing your seat may finish anywhere;
    that's the bot's place, never yours.
  - **A loss, recorded as you go:** your team's (or the crowd's against a boss) result a loss, and in a boss battle you
    didn't see it through. Your rating estimate is your moves so far, as for anyone. In a match that counts for
    ranking it counts for yours; and the match's ranked status counts everyone who played, so nobody's leaving makes
    it unranked for those who stay (or for the one who left).
  - **A bot takes your seat** (a new id and a bot's name nobody in the match has, at `LEAVING.botSkill`, the same as
    Squads' replacement bots) where the lobby fills seats with bots: Default and private Crowd lobbies. The seat keeps
    its team, score, bank, power-ups and turns in a final. With Bots off, and in a private raid (people only), the seat
    goes out instead; except in a final (a game needs both sides) and for the last one on a side (a team, or the
    crowd against a boss), so no side is ever left with nobody to move.
  - The resign is answered ("resigned", with what was recorded) and the socket closed; the device forgets its seat, so
    the app opened again never puts you back. A resign sent while the connection is between tries goes again, as the
    same seat, the moment it's back; with no answer in `LEAVING.confirmWaitMs` (4 s) the app goes home anyway and the
    away rule does the rest. Coming back with the seat's token later: told you left ("You resigned
    that match.", or for the away rule, "You were away from that match too long...") with "See your result".
  - If you were the host (your device played the boss or scored), the next device takes over at once.
- **Squads:** "Leave" was already there (a bot plays your seat for good). Now with your squad still in the bracket
  it's resigning: a loss on your record at once, at the worst place your squad can still finish (5th-8th in Relay,
  3rd-4th in Pairs, 2nd in the final), never the squad's later place (before, a leaver was recorded at the squad's
  final place, so a bot squad's win went on the leaver's profile); no reward, as before. The "You resigned" screen,
  then Queue again or Home. Before the bracket (the votes): Leave, nothing recorded (before, the squad's place was).
  Its squad already out: Leave, its result stands.
- **Before move 1** (the votes, the full grid's moment, a boss's entrance) it's **Leave**: home, a bot in your seat (Bots
  off: the seat is simply gone), nothing recorded; a vote you'd cast goes with you.
- **Already out** (cut, struck down): Leave: home; your place stands and is recorded with everyone's when the match
  ends (your team may yet win the game).

**Leaving without resigning** (a refresh, a closed tab, the back button, the app in the background):
- **Today's grace stays:** within `LEAVING.awayMs` (120 s, the same as Bots off's waiting seats) a reload or a return
  puts you back in your seat. Past it, you've left the match, exactly as if you'd resigned (seat to a bot, a loss).
  This is also how an app from before this change, which never sends "resign", is handled.
- **Nobody is held up meanwhile:** a move locks as soon as everyone still here has moved; someone away no longer makes
  everyone wait out the clock. With nobody here at all it waits for the clock as before, so a reload doesn't cost you
  the move.
- **The last person out ends it:** when nobody is left in a match (everyone resigned, or gone past the grace), it ends
  at once rather than playing on for no one: everyone's result recorded as they left it, and the lobby closes straight
  away. The 180-minute cap is now only a safety net. Squads keeps its own rule for someone away (a bot after three
  misses, theirs again with "Take my seat back"); its lobby ends at once, the same way, when nobody is left.

**Also found and fixed: Big Boy's Big Bounce crashed online.** The lobby server rebuilds its match from storage on
every message, and the rebuilt match was missing the boss's memo (and a few other fields a new match starts with). Big
Boy's Big Bounce reads that memo, so in an online raid against him the bounce threw and the raid stalled, another
"hung session". The rebuilt match now starts with every one of them (`MatchRunner.restore`; tested in
`packages/chess/test/bigboy.test.ts`, which fails without the fix).

**Lobby codes** (following "Closing finished lobbies"). What changed:
- A match everyone has left closes at once (it was up to 180 minutes, or until it played itself out): its code stops
  working and is free again.
- A private lobby nobody started closes when its last person presses Leave (it waited an hour), so its invite link
  says "That lobby has closed."
- A finished match's results still stay up 15 minutes for the people on them, as before.

**Protocol.** Crowd's lobby: a new message each way, "resign" from the app and "resigned" back; an "error" can say
`left` (how you left). The main lobby has no version constant, and an old app never sends "resign" (the away rule
covers it). Squads: `SQUADS_PROTOCOL` 7 ("left" says how and what was recorded; "error" can say `left`); an older app
is asked to reload, as for every Squads bump.

**Testing.** The full lane. Unit: `packages/server/test/resign.test.ts` (resigning mid-match: the seat to a bot, the
others play on, told how and let go, back with the token; a rated loss and the match staying ranked; Leave in the
votes; Bots off: out, and the last of the crowd to a bot; leaving once cut; the last person out ending it and closing
it; a reload within the grace and the away rule after it; nobody held up by someone away; resigning on the boss's turn
as its host; resigning during Lights out; a private lobby closing when emptied; Squads: resigning mid-bracket, leaving
in the votes, the last one out and the away case), `lobby-life.test.ts` (each ending wrapped up after the last went),
`packages/chess/test/crowd.test.ts` (handing a seat over and retiring keep every place given once),
`packages/app/test/faq.test.ts`. e2e `e2e/resign.spec.ts` (phone and computer): Boss alone through the "⋯" sheet and
the flag (the confirm staying up through a move and the boss's reply, Cancel, Resign, nothing after it), a Solo 50 v
50 (Leave in the votes, Resign mid-match), Squads (Resign, the lobby closing), and an online raid (one resigns, a bot
takes the seat, the other plays on and hosts); every confirm checked clear of the board, the line above it, the timer
bars and the clocks. Frame by frame (`npm run frames:resign`, phone 390 and computer 1280, light and dark, Boss alone
and a Crowd match): the sheet and confirm never cover the board or the line above it, the board never moves, no frame
blinks.

### Wrangler's reply to the showdown's duel: the engine's best (Eric, Oct 13, 2026)

**Eric's report:** Wrangler's SHOWDOWN! came, Eric took his queen in the forced duel, and Wrangler didn't take back: he
took a different piece, so Eric won a queen for free. The admins' debug line said "Maia 600 · no guard".

**The cause:** the showdown's search scores every line-up as if he answers each duel with the engine's best move (each
position after a duel is read from the engine's top move: `scoreLineups`, `qualifies`). His actual next move came from
his normal brain (`bossBrainFor`): at Eric's level Maia at 600 with no guard, which can miss the recapture (with
Stockfish as the brain, a slip could miss it too). So the power played out other than it was scored.

**The fix:** his one reply right after a showdown duel (two pairs or three) is the engine's best move at full strength:
one Stockfish line at the boss's own budget (`bossNodes`, deeper than the search's own reads), no Maia, no guard, no
slip or stumble (`BossMoveKind` "best", `bestReplyFrom` in `runner.ts`). All his other moves are unchanged.
- **Where it's decided:** a new hook on the base boss, `BossRules.bestReply` (Wrangler's: `duelReplyDue` in `pig.ts`:
  the crowd's last move is one of the showdown's duels, on the showdown's own turn), read by the runner's
  `bossMoveKind`. The server works out the kind as for a slip or the King's strike and tells the host
  (`bossRequest.best`, sent without a `brain`, as the funhouse's, the bounce's and the extra move's requests are);
  solo's runner plays it the same way. Everyone sees the host's one move, as before.
- **My calls:**
  - **The King's strike still staggers it.** The crowd paid a charge for that step back; the strike's own guard still
    never gives a piece away for nothing, so a staggered reply still takes back or near enough.
  - **The slip's random draw is still made** before the kind is decided, so the match's random source moves on as it
    did before and nothing else drawn after it changes.
  - **The Last Stand:** a duel the God King takes back isn't on the board, so the reply waits for the duel that is.
  - **The admins' debug line** says "Stockfish's best (power reply)" for that move (admins only; no player text
    changes).
- **When the engine is slow or missing:** in solo this device's Stockfish always plays it (Maia isn't asked at all).
  Online, a host that doesn't answer in time is replaced and the next one gets the same "best" request, so the move is
  still Stockfish's best. Only when no device in the lobby can run the engine at all does the server play a random
  allowed move, as it does for every boss move then; that case can't be Stockfish quality, and the engine server isn't
  asked for boss moves.

**Found while testing: the engine's best reply isn't always taking back.** In a line-up the other pairs face each other
too, so after a duel his best reply can be another capture first (in one e2e game all three duels' best replies were
his knight taking the crowd's line-up knight, the queen to be taken back a move later). The fix plays that move, as the
search scored it; but his moves after it are his brain's again, so where the engine's line needs a second move of his
(taking the queen back next), a weak brain can still miss it. Not changed here (the brief: one reply); covered since by
his engine moves after the duel, while the line-up's tactics are live ("Wrangler's showdown: his own meter, no warning,
fired when ready", below).

**Other powers checked for the same gap** (a power whose engine check assumes a boss reply that his brain might not
play). None is as clear-cut; recorded, not changed:
- **The long pull** and **the lasso drag:** measured against his best ordinary move or with the crowd to move, with no
  forced reply of his built in. If his brain misses a chance afterwards, the crowd simply loses less.
- **Boingo's funhouse move:** the crowd's forced move is picked as a 1 to 2.5 pawn loss assuming his best reply, and
  that reply is his brain's. Same shape, lower stakes: if it misses the punishment the crowd gets off lightly (a capture
  he fails to answer could even gain it a little).
- **Big Boy's Big Bounce:** scored with him to move, assuming his best move, which is his brain's. A bounce can leave a
  crowd piece attacking one of his (only the crowd's hanging material is filtered), and a weak brain may not answer it.
  Same shape, less clear-cut than a forced capture.
- **Hollow's extra move** is the engine's own pick; Ginger's, Jefferson's and Sawyer's powers aren't scored on his
  reply.

**Testing.** The full lane (rules, the server and the protocol). Unit: `packages/chess/test/pig.test.ts` (on his brain,
Maia at 600, with every move a slip: after the queens' duel he takes back, the move the search assumed; the brain and a
slip on the same position would take another piece; Maia isn't asked; his next move is Maia's again; only right after a
duel on the showdown's turn; the King's strike still staggers; the host's path agrees with solo), and "Wrangler online"
in `packages/server/test/boss-powers-lobby.test.ts` (a lobby of admins on Maia with slips on: the reply's request says
`best`, without the brain or a slip, the host's answer is the recapture and everyone gets it, and the next request is
the brain's again). Both fail without the fix. e2e: `e2e/pig.spec.ts` plays a duel and checks his reply is exactly
the engine's best at full strength, taking back when that's the best (solo on a phone as an admin, on his Maia brain;
on a computer; and online).

## Vote options never move (Oct 13, 2026)

Eric: "The voting rounds in all modes should never change position. They should always be slowest on the left, fastest on the right; for the mode type, just pick one order." Every vote now keeps its data order on every screen (Black's turned board no longer mirrors the zones and cards), speeds run Rapid, Blitz, Bullet in the 50 v 50 and Squads, Mode stays Classic, Mercenary, Coming soon, and each default is named by id (Blitz, Classic, Team final, Normal start).

### A computer's title line: testing items, sound, the flag (Eric, Oct 13, 2026)

On a computer every match's title line spans the board's column (the boss bar's width) and ends in an admin's testing
items, then sound, then the flag, so they sit next to the title, not at the window's corner (Eric: "utilize the space
next to 'BOSS · move 1'"); when tight, the brain's pill ellipsizes first. The flag's confirm now opens beside it, into
the column next to the board (under it, it would cover the board). Phones unchanged.

### The Hidden Boss, a sprite preview (art only, Oct 14, 2026)

Eric approved it (Oct 14: "wow it looks PERFECT"). It's in main unregistered, so the approved drawing is kept safe
until he's built.

Eric's future hidden boss, a chess legend (ROADMAP.md, "The hidden boss"), drawn so Eric can review him before his
rules are designed. Art only: no rules, kit, lines, sounds or roster entry; he is in no character, kit or effect list,
so nothing in the game shows him (`packages/app/test/recluse.test.ts` checks that, and makes the checks
`characters.test.ts` makes of every character). His working code id is `recluse` and his label "Hidden Boss": Eric
will name him later, and no real name appears in any code, file, label or on the book.

- **Where he comes from:** the outfit from Eric's own reference sprite (a white shirt with rolled sleeves, a blue tie
  with light-blue rings and a gold clip, navy trousers, brown shoes); the face from a photo Eric sent, used only as a
  likeness reference (original pixel art, not traced; the photo is not in the repo): the head tilted down, the eyes
  rolled up at us from under heavy brows with the whites showing beneath the irises, swept hair parted on our left
  with a loose lock towards his brow, a long face, a long straight nose, strong cheekbones, a narrow chin, thin lips in
  a half-smirk. Eric then replaced the first pose (seated on a stone block, a piece held out): he **stands, tall and
  lanky**, with **the red book** (a red cloth hardcover of his rival's games) and a small dark-wood bishop in his
  other hand. The book's only marking (Eric): a gold-stamped Cyrillic "Ш" (for "шахматы", chess) in a thin gold
  border on its cover, faint gold bands on its spine; no title, no names.
- **Sizes and the phone crop:**
  - `RECLUSE`, the whole figure (a computer, 2x by the board's corner): a 64 x 146 frame, 129 px tall above his feet
    at rest, 137 at most (his hair in the wind; the cast is 67 to 88: Sawyer 67, Wrangler 68, Hollow 75, Jefferson
    88), 42 px wide with the book at his side. His head is 25 px wide (the brief suggested 18 to 22; Eric then asked
    for "a little larger again" so the face reads). At 2x he is about 258 CSS px tall by the board's corner on a
    1280 px screen: he fits beside the board, clear of it, the God King at the other corner as usual.
  - `RECLUSE_BUST`, the phone crop (the boss bar at 1x): a figure his height can't fit the bar (56 px, 88 when
    `tall`), so the phone gets a bust from the same rig: head, shoulders and the top of the book, cut at the chest, 50
    x 70, 61 px above its foot at rest and 69 at most (within the cast's 75), the same face and animations. When he
    gets a kit, the phone should draw the bust and the computer the full figure (a kit holds one character today, so
    the kit needs a second one for the bar), with the `wide` box (58 px).
  - `RECLUSE_BOOK`, the book alone for board effects later: 32 x 32 (one square, as the other one-square effects).
- **Animations** (`RECLUSE` and `RECLUSE_BUST` alike; cues in brackets):
  - Phase 1: `idle` (loop, 4.8 s, silent: a slow breath, the stare, his eyes down to the piece he turns in his fingers
    and back, a blink, a brow twitch, the book clutched at his side); `consult` (`lift`, `open`, `snap`: the book out,
    opened, a page scanned with a flick of the eyes, a knowing look, snapped shut); `stare` (the entrance: `dip`, then
    the upward stare held 1.3 s, `stare`); `laugh` (`laugh`, `cackle`: head back, shoulders shaking, forward with a
    wild-eyed grin); `spellbook` then `spellLoop` then `spellClose` (the ultimate: `raise`, `open`, `laugh`, `cackle`;
    the book falls open to us, its pages glowing and turning, motes and little stars rising, his hair lifting in the
    wind, his eyes wide; the loop holds as long as the ultimate runs; `slam` shuts it with a puff of page dust); `slam`
    (`open`, `slam`: a decisive move, the book flipped open and slammed shut).
  - The fall (Eric): `collapse` (`reel`, `drop`, `thud`, `book`: to his knees in four steps, the book falling flat in
    front of him) then `collapseLoop` (slumped, rocking, his lips moving fast: mumbling); `revive` (`rise`, `snap`,
    `catch`: up slowly with his head down, then upright, his hair lifting, his eyes narrowed, the book flying up
    spinning into his hands).
  - Phase 2 (revived): `idle2` (loop, 4.7 s) and `consult2`, `stare2`, `laugh2`, `spellbook2`, `spellLoop2`,
    `spellClose2`, `slam2`: his hair streaming in a constant wind in every frame (a test checks), deeper shadows on his
    face, a glint in his eyes, a wider stance, the book held ready in front of him. Nothing in phase 2 falls back to
    calm hair.
  - The book (`RECLUSE_BOOK`): `fly` (loop, spinning a turn in 8 frames), `slam` (dropping flat: `slam`, dust, a
    shockwave ring), `flip` (loop, pages flipping fast), `close` (`snap`), `idle` (lying closed).
- **Simplified for size:** the tie's rings are 4-pixel crosses round a dark middle (5 down the tie); the clip and the
  buckle are 1 to 2 px of gold; the piece is a 5 x 12 bishop (its turn shown by its shine and mitre slit moving round);
  the moves on the pages are dashes; the hair in the wind is three hand-drawn phases of streaming locks; the kneeling
  legs are short thighs with his heels behind (his shins hidden); when he holds the book in both hands the piece is
  tucked in his palm (not drawn). In the bust, the book he reads is mostly below the picture (its top edge shows) and
  kneeling he sinks only part way, so his mumbling face stays in the bar.
- **Previews:** `npm run preview:characters -- <dir> extra=packages/app/src/characters/recluse.ts
  only=recluse,recluse-bust,recluse-book`. He was checked in the real game on a 390 px phone and a 1280 px computer by
  swapping his drawing into a boss's kit from a scratch script, not from the app's code.

### Wrangler's showdown: his own meter, no warning, fired when ready (Eric, Oct 13, 2026)

**Eric's report:** he tested Wrangler for 30 turns straight and the ultimate never fired. Every try (mostly the admins'
"Trigger ultimate" button) said "Not yet...". **Eric's decisions**, in order:
- "he checks every turn after three or four moves, and the moment it's ready he fires it with no warning."
- No meter at first: "the meter for him doesn't matter, because if we wait for the meter, then we might miss an
  opportunity. I think that's the problem." Then his final call: a special meter that fills steadily over his first 5
  turns ("I've got you in my sights." as it fills, both ropes swinging until he fires), and once full he fires on the
  first turn a line-up is ready; Eric expects that to "only take a few turns at most".
- The line-up is always a rook, a bishop and a knight (no queens), anywhere on the board (ranks 2-7), backed by the
  director's test (`showdown_v2.py`, 3 middlegames, 60 random line-ups each, depth 10): today's queen, rook and bishop in
  the middle fit the goal 14% of the time (6-28% by position); rook, bishop and knight anywhere 19% (15-21%), his median
  edge +0.33.
- After a duel, the engine keeps playing his moves while the showdown's tactics are live (the coordinator, after
  #174's finding that his best reply can be another capture first), up to 3.

**Why it said "Not yet..." so often (found while building this):**
- **His turn's search re-scanned the same line-ups.** It ran in rounds (scan until three promising, confirm them, go
  again), but each round started the seeded generator from the beginning, so after the first three promising ones it
  only ever saw the same line-ups again. It now carries one run of the generator on, round after round. (The Wrangler
  rage test went from 15 s to 1 s: the same bug, burning its budget on repeats.)
- **Queens in the middle**, the rarer line-up (14% against 19%, and far from steady by position).

**What was built** (`packages/chess/src/bosses/pig.ts`; numbers in `BOSS_POWERS.showdown*`):
- **His meter** (`BossRules.meter`, `showdownMeter`): his moves fill it, `showdownMeterTurns` (5) from empty, and
  nothing else (no rage over time, no eval speed-up, no material, no King's strike: `strikeRage` adds nothing to a
  boss with a meter of its own). The rage meter in his boss bar shows it. Full: he says "I've got you in my sights."
  once a fill (a beat of his, `ready`, from his view's `ready`; normal priority, so a moment's line can't make it lapse)
  and his idle becomes the `ready` loop (the wind-up's spin, both loops, looped; no throw) until he fires.
- **Firing:** with the meter full, after each of his moves the host's engine (solo: this device's) looks for a line-up;
  the first turn one qualifies, it goes on the board and SHOWDOWN! comes as the next crowd turn begins, no warning, no
  "Not yet..." (both gone). None: he plays on, his lasso drags carry on, and he looks again after his next move. Then
  the meter empties and fills again over 5 more of his moves; at most `showdownMax` (2) a battle, after which he has no
  meter (none shown). `showdownGap` was never kept (the meter is the gap).
- **The search** (from his move `showdownFrom`, 4): the scout searches every crowd turn while one may still come (the
  view's `scout`), three pairs then two, and keeps what it found from turn to turn (those that qualified first), dropping
  each once it no longer holds; at his turn those first, then fresh ones (three pairs the first 60% of
  `showdownTurnMs`, then two). Same time budgets as before (`showdownSearchMs` 8 s while the crowd thinks,
  `showdownTurnMs` 3 s at his turn). With the meter full and nothing qualifying, each of his turns spends up to its 3 s.
- **The line-up** (`pairKinds`, `lineupTry`, `checkLineup`): a rook, a bishop and a knight pair, placed a pair at a time
  anywhere on ranks 2-7 (no more middle, no more five-file span), same facing rules, his pieces protected, no queens
  (the server refuses one). **Substitutes (my order):** a pair that can't be formed (bishops on different colors or gone,
  say) is replaced by a second rook pair, then a second knight pair, then a second bishop pair (one on each color);
  still short of three: two pairs only (the rook and, seeded, a bishop or knight). **Two pairs by default:** at his turn
  three pairs are tried first; none qualifying, two pairs under the same rule.
- **The band:** the coordinator's starting point, kept: the crowd's best duel leaves him from −0.2 to +1.5 pawns
  against the position before (`showdownEdge`; it was +0.1 to +1.2), a wrong first duel costs the crowd 1.5 more
  (`showdownTrap`; it was 2), target +0.5. Why kept: with it the sim below has a first showdown in every battle, at
  his first chance in 33 of 36, and the edges came out −0.19 to +1.45, median +0.2 (13 of 60 a little below level), so
  the right duel stays about level or a little his way, as Eric wants, and a wrong one still costs a piece's worth.
  The second showdowns that never came were in decided battles, where no band could help (below). No reason to widen
  it.
- **His moves after the duel** (`engineMoveDue`, `BossRules.bestReply`, the `best` kind and request from #174): his reply,
  then each next move while the showdown's tactics are live, up to `showdownEngineMoves` (3) in all, are the engine's
  best at full strength; then his brain again. **"Live", my reading:** a line-up piece of either side (followed as it
  moves, gone once taken) is still attacked by any piece of the other side. The coordinator's wording was "attacked by a
  line-up piece of the other, or his engine line still has a capture inside the line-up"; the server decides the kind
  with no engine, so it can't read his engine line, and the capture his line needs next (often his protector, not a
  line-up piece, taking back) is always of an attacked line-up piece: "attacked by any piece" covers both, and the cap
  bounds it.
- **The admins' trigger:** his meter full at once (shown full), fired at his next turn ignoring the cap: up to
  `showdownTestMs` (10 s) of searching, and none qualifying, the line-up nearest the goal it saw (`missBy`), marked
  `outside` and shown on their debug line as "Showdown (test: outside the band)". The server records `outside` only on
  the trigger's turn, so a player's showdown is never marked so (the host's word on the band was always trusted). No two
  matched pairs on the board: the old stand-in drag (LASSO!, "No showdown this time: a tug instead"), admins only now.
- **My calls:**
  - **The line comes first.** His meter fills with his 5th move; "I've got you in my sights." comes as the crowd's next
    turn begins, and he fires from his 6th move on, so the line is always his tell (Eric's "no further warning" after
    it). The earliest showdown is lined up after his 6th move.
  - **The scout starts at `showdownFrom`** (his move 4) even though the meter is full only after his 5th: two turns of
    search are ready when it fills, as Eric asked.
  - `?power=showdown` (the test switch) fills his meter from turn 2, his showdown searched from his next move.

**Measured** (`packages/sim/scripts/showdown-sim.ts`: battles through the match runner, a crowd of 10 bots against him,
his scout and his turn's search for real; boss and judge at 120,000 nodes; the searches' budgets on a device's own
clock, a phone's 200,000 nodes a second or a computer's 800,000, so a busy machine doesn't skew it). 36 battles against
crowds of three strengths (expert, club, casual), up to 40 crowd moves: 21 on a phone's budget (7 a strength), 6 on a
computer's, and 9 more on a phone's that also recorded the positions where his full meter waited
(`reports/boss-sim/showdown-{phone1,computer1,diag1,diag2}.jsonl`):
- **His meter full:** as crowd turn 6 began in every battle (his 5 moves); again 5 of his moves after each showdown.
- **The first showdown:** in all 36. At his first chance (crowd turn 7) in 33; 3 and 5 turns after full in the others.
- **The second:** in 24 of 36. When it came: at his first chance in 17, after 2 of his turns in 5, then 4 and 5.
  Not in 12: one battle ended (move 11) before his meter filled again; in 11 it stayed full, waiting, for the rest of
  the battle (2 to 28 turns). The positions recorded show why: the battle was decided. The crowd had lost its queen and
  he was past the engine's top score (0.999 expected, 7.27 pawns), so every duel of every line-up read the same, and no
  duel could cost the crowd anything more (some also had no rook, bishop or knight pairs left once its bishops were on
  different colors). 8 of the 11 ended as his wins, 2 as draws at the move limit with him far ahead, 1 as the crowd's.
- **Size:** 40 of three pairs, 20 of two.
- **Edges** (his, after the crowd's best duel): −0.19 to +1.45, median +0.2 (13 of 60 a little below level).
- **The engine's moves after the duel:** 3 (the cap) after 38 duels, 2 after 19, 1 after 3: the other pairs still
  face each other after one duel, so the tactics usually stay live to the cap.
- **A battle already decided his way** (my call): Eric's rule is kept (no showdown that doesn't meet his goal; the
  second simply doesn't come), but the search stops there: when his edge is so high that no duel could cost the crowd
  `showdownTrap` more against the engine's top score (`showdownHopeless`: above 5.98 pawns, an exact bound, so it never
  skips a showdown that could qualify), his turn and the scout stop after the one search of the position, instead of
  his phone (the host's, online) searching 3 s every turn and 8 s every crowd turn for the rest of the battle. The
  admins' trigger still searches (its line-up outside the band). If Eric wants a second showdown even in a decided
  battle, the nearest line-up could be fired there as the trigger does; not done (it reverses his goal).

**Player-visible text.** Added: his line "I've got you in my sights.". Removed: "Not yet...", "Not yet... snort.",
"Not yet, partner..." (and the dock's "Not yet…"), "Next time, varmints.", "Dang. No showdown.", "Snort. Not today.",
his warning lines ("High noon's comin'.", "Reach for yer pieces…", "Snort. Get ready.") and the "RAGE!" warning
banner for his ultimate. Changed: the FAQ's SHOWDOWN! paragraph (his meter, his line, rook, bishop and knight anywhere,
two pairs, the band, the engine's moves after the duel, at most two), the rage meter section ("Wrangler has a meter of
his own with no warning"; Wrangler out of its speeds list) and the King's strike line ("Wrangler's meter is his own, and
a strike adds nothing to it"). Admins only: "Showdown (test: outside the band)" on the debug line; LASSO!'s "No
showdown this time: a tug instead" now only for the trigger. Unchanged: SHOWDOWN!, DRAW!, "Three duels: you must take
one" ("Two duels…"), "Showdown! Take one of his three." ("two").

**Testing.** The full lane. Unit: `packages/chess/test/pig.test.ts` (the kinds, zone and substitutes; the band and
`missBy`; three pairs then two; none qualifying and the trigger's nearest outside the band; the scout's kept line-ups;
his turn's rounds scanning new line-ups, none twice (on the old code, 15 different duel positions in 300 scans); no
search in a battle decided his way, the trigger's still;
his meter (his moves only, not a strike), firing when full and a line-up qualifies, playing on when none does, the cap,
the trigger, host and solo agreeing; his reply on Maia at 600 with slips, and a two-capture line completed by the engine
on a brain that never captures), `maia-bosses.test.ts` (his moves after the duel not Maia's; his showdowns spent
after the trigger, so his turns don't each search for seconds on its fake engine: 59 s, near its 60 s limit, to 13 s),
`rage.test.ts`, the lobby ("Wrangler online": asked with his
meter full, no warning or "Not yet...", the trigger's `test` and `outside`, his engine moves asked as `best`), the app
(his line and ready loop, the lines gone, the FAQ). e2e `e2e/pig.spec.ts`: his line and ready loop, a showdown with no
warning (solo on a phone as an admin on Maia, and on a computer; online), the duel and his reply, the admins' trigger.
Frames: `npm run frames:pig` on a 390 px phone and a 1280 px computer, light: his line typing out and held in his box,
both loops whirling over his head in the ready loop (in view on the phone's bar, not clipped), his meter full; the long
pull; SHOWDOWN!'s ropes reaching pieces anywhere on the board (a rook hauled from h8 to b6, a bishop from f1 to h5) and
the pairs landing; the duels glowing on edge files (a6-b6); the meter full on the duel's turn. (The computer's
screencast had 0.4-0.55 s gaps throughout, the machine shared with other sessions' e2e runs, none tied to his moments.)

### The Hidden Boss: no chess piece, a natural free arm (Eric, Oct 14, 2026)

Eric, on the approved sprite: "that chess piece in his hand, we can do away with that... his hand looks all weird with
the chess piece... The one with the book is fine." Art only (`characters/recluse.ts`); this replaces the piece in "The
Hidden Boss, a sprite preview" above.

- **No piece anywhere:** every animation, phase 1 and 2, the full figure and the bust (a test checks that no frame
  draws one).
- **His free arm** (his left, our right) now hangs relaxed: the same sleeve, rolled cuff and shading as his book arm,
  a fuller forearm (it was 3 to 4 px, reading as a stick next to the sleeve; now about 5) and a typed hand, open and
  relaxed, its thumb in front towards his body and parted by a shade line, the fingers loosely curled. The hand carries
  its own outline, open at the top, so no line crosses the wrist. When he holds the book out in front of him, that hand
  grips its edge as before.
- **The animations that used the piece:** the idle's piece-turning is now two small curls of his free hand's fingers
  while his eyes are down; phase 2's idle keeps his fingers drumming on the book. The stare never held the piece out
  (it already only leans in), so it is unchanged. The slam stays the book slammed shut with its puff of dust: he has
  stood without the stone since Eric's redesign, so a palm slam on the stone isn't possible, and bringing the book down
  is the slam Eric approved. The book animations are untouched.

### The Hidden Boss, phase 1: an admin's fight in Boss alone (Eric, Oct 14, 2026)

Eric approved building him (Oct 14: "feel free to even build [him] in once animations are done, I trust this run of
it"), then specified his phase-1 ultimate himself. Phase 1 only: the 4-board simul, Chess960, the red book item, the
special crate and Squads come later. ROADMAP.md, "The hidden boss", has the whole design.

**Who and where.**
- Roster id `recluse`, name "Hidden Boss" (Eric names him later), icon 📕, kit "Hidden Boss". No real name anywhere.
- **Hidden from players** (`BossDef.adminOnly`): `isPlayable` is false for him, so every place that asks it skips him
  (a random boss, raids, the Crowd's boss final, the server's lobby creation, the FAQ, a player's boss menu,
  `maia.spec.ts`'s list). `adminPlayable`, `hiddenBosses` and `menuBosses` add him to the boss menu, after the rest,
  for an admin picking for Boss alone only (not "for your raid"). The app sets `bossHidden` for an admin's Boss alone,
  and only then does the runner meet him (`chooseBoss`'s `hidden`). A player's `?boss=recluse`, a stored pick or
  `?wip=1` gets a random boss instead.
- **Online:** not reachable (the server makes a raid only with a playable boss), so the host and server paths are
  untouched and no message changed (no protocol constant to bump: the lobby protocol has none, and Squads' is
  untouched). His rules live in the shared match runner (the clock, the God King's block), so an online fight later
  gets them as they are; he asks the host for no engine work besides his move.

**His brain: Maia-3 at its strongest, raw** (Eric, Oct 14: "so it feels like an aggressive human playing").
- `BOSS_BRAIN.fixed` (`{ recluse: "maia-raw" }`): Maia at its top rating (the last point of `maiaRating`: 2500), no
  guard, no Stockfish share, whatever his strength, the crowd, the difficulty or an admin's Brain picker. Stockfish only
  where Maia isn't on offer, and while it loads (as for every boss).
- **Why not `byBoss`:** it keeps the bridge band (the light and strict guards from 2400, Stockfish's share from 2500),
  which isn't raw.
- His strength is fixed too, at 2650, the level where Maia reaches 2500 (`fixedLevel`), whatever the player's rating
  or the difficulty. So the menu shows 2650 and four skulls, he never slips, and Stockfish's moves while Maia loads are
  at 2650.
- Unchanged once `BOSS_BRAIN.forPlayers` turns on (a test checks the plan with it on).

**His passive, "nohelp": the God King's help doesn't work against him** (Eric, Oct 14).
- `BossRules.blocksKing`: the runner's `kingDecision` (his move), `callStrike` and `lastStandFor` never let him act.
  Nothing is spent: no charge, no strike, no turn. Solo's `callKing` refuses too.
- **The try is mocked:** the dock's "Play move" or "Strike" doesn't call him. Instead the boss slams the book shut
  where he stands and mocks it (his lines in turn), and the God King says his help won't take hold.
- **The Last Stand** never comes. It isn't something the player calls, so it isn't mocked (my call: simplest).
- Power-ups are the crowd's own, not the God King's, and Boss alone has none anyway (a raid starts with none, and the
  Last Stand that leaves some can't come).
- **The God King in this fight:** his own opening line (`foeIntro`), said as "START!" comes, when nothing else is
  being said (on the first move it could wait behind a danger warning and lapse), and his blocked line (`foeBlocked`). His lines about
  calling him (the "Tap me" nudge, "spent", "A charge might turn it") are left out of this fight.

**His ultimate: the bullet clock** (Eric, Oct 14, replacing the brief's "a few seconds a move for N moves": "Meter
builds starting turn 1, about 7 turns in he says something about how you're thinking too much and to just play pure
chess etc, true to him, then for the rest of phase 1 it's bullet with no added time per move so it's a true race
against the clock but it should be bearable for a strong team").
- **His own meter** (`BossRules.meter`, as Wrangler's), not the rage meter: empty at crowd turn 1, full at
  `BOSS_POWERS.bulletTurn` (7). Nothing else fills it (no strikes, no eval). It comes as that turn begins: no warning,
  no "RAGE!". The admins' trigger brings it as the next turn begins; `?power=bullet` on turn 2.
- **From then to the end of the battle:** every bank still in is set to `bulletBankSeconds` (180 s) as it comes
  (`turnBegun`). Then no increment, no per-move cap (a move may take the whole bank: `allowedMsFor` is the bank), and
  nothing adds time. The God King's strike, which stops the clock, can't come; time chips are Squads'.
- **Running out loses on time** (my call). Today a move that runs out of time is a missed move, and the engine's best
  is played for the crowd (`scoreGroup`); Boss alone has no loss on time. With no increment, an empty bank would make
  every move time out, and the engine would play the rest of the game. So in the bullet phase, a bank that runs out
  (everyone still in at 0: `bossOutOfTime`) ends the battle at once. The move isn't played, the boss wins, and the
  result screen says "Hidden Boss won on time." (`bossTimedOut`, kept on the runner: nothing stored or sent changed).
- **The numbers, by estimate (not yet sim-tested):**
  - 180 s for the rest of phase 1: the clock starts only after his move and its moments have shown (Boss alone: a
    0.45 s show), so nothing but thinking comes out of it.
  - A strong player at 3 to 5 s a move gets 36 to 60 more moves out of it. A battle is capped at 60 crowd moves (53
    after turn 7), and a typical one is over well before.
  - Turn 7: Eric's "about 7 turns in".
- **On screen** (`RECLUSE_FX.bullet`, 4.6 s; the clock starts after it, as after every power):
  - Where he stands (the bust in a phone's bar, the whole figure by the board on a computer; he never steps onto the
    board): he consults the red book, opens it like a spell book (pages glowing and turning, hair in the wind, the
    laugh), holds the spell, slams it shut.
  - His line as it begins; "BULLET!" with "No added time." as the book falls open.
  - From then on, the dock says "Bullet · 2:41 left" on every move: your bank, ticking (text a player must read to play
    stays on screen; the timer bar above the board is the bank too).
  - **How:** `playInPlace`, a run of his own animations played over his beat by his figure, both placements alike.

**Animations used.**
- `idle`.
- `stare`: his entrance.
- `consult`: the first beat of his ultimate ("right before his ultimate"), and when he's behind on material (his
  `rattled` mood, sometimes with a line).
- `laugh`: when he wins.
- The spellbook set: his ultimate.
- `slam`: as he mocks the God King's help. It's a decisive moment the player causes, during their own move, so it plays
  whole. His own move shows for only 0.45 s in Boss alone, which would cut a slam on a capture short.
- `collapse`, then `collapseLoop`: beaten.
- Phase 2's sets aren't used.

**Beaten.**
- The battle ends as the crowd's win. The board holds 4.5 s (`BossRules.fallMs`, solo's `fall` phase: "You beat him!")
  while he collapses and his first mumbled line comes. Then the normal result screen, where he stays slumped
  (`kit.loops.defeat`) and mumbles on (`kit.fall`: three lines in turn, each as the last one goes).
- Phase 2 isn't built, so nothing follows: no book slam, no split, no revive.

**His kit and the screens.**
- `kit.bar` is a drawing of its own for the phone's boss bar: his bust (in the wide box). `ch` is his whole figure: a
  computer (2x by the board's corner) and the results (1.25x, in a taller box). Other bosses' kits are untouched (a
  kit without `bar`, `loops`, `fall` or `lineOf` works as before).
- His words go above his head on a computer, and beside him (never over him) on the results.
- **Fit** (measured, with the sprite-fit fix for 900 to 1099 px merged): 390 px phone: the bust sits in the bar like
  the cast. 900 and 1024: his whole figure at 1x (129 px) inside the window by the board's corner. 1280 and 1920: at 2x
  (258 px), clear of the board. His bubble goes above his head at every width (its rule follows the scale), moved into
  view at the window's edge.
- **A fix for every boss:** a new battle's intro now forgets the last battle's moments and sounds (`resetBeats`).
  Their keys repeat from battle to battle (`intro:N`, `over:crowd`), so a second battle in one visit skipped the
  entrance and the defeat or victory animation.

**Sounds:** five, synthesized (no files, cheap, made ahead with `warmSounds`, all under a move's loudness): the pages
fluttering, the book shut, a rustle of cloth, his laugh as breath through the nose (no voice) and a low swell under his
stare. Every cue has one, as for every boss.

**His lines** (one table, `characters/recluse-lines.ts`; Eric, Oct 14: real quotes "keeping them intact is a must").
- **Real quotes, word for word,** only the research report's Tier A (verified), never shortened, adapted or
  re-punctuated:
  - Intro, only when he's White and the game opened 1.e4 (the one place it reads right): "Best by test." His note to
    1 P-K4 in his game against Bisguier (NY State Open 1963), *Chess Life*, Dec 1963, pp. 302–303; repeated in his book
    of his sixty memorable games (1969).
  - Mocking the God King's help: "I don't believe in psychology. I believe in good moves." Peter Kihss in the
    *New York Times*, Jul 4, 1972, p. 14 (Winter, C.N. 5830).
  - Mocking the God King's help: "A genuine beginner's move" (a fragment as published). On 6 Be2 in the Grünfeld,
    in his game against Greenwald, *Chess Life*, Oct 1963, pp. 237–238.
  - When he wins: "He played book lines, but didn't know them very well." On Alekhine, "The Ten Greatest Masters in
    History", *Chessworld*, Jan–Feb 1964, pp. 56–61.
  - Mumbling, beaten: "Morphy, I think everyone agrees, was probably the greatest genius of them all." Press
    conference, Sep 21, 1992, in Seirawan & Stefanovic, *No Regrets*.
  - The player-move triggers (1.d4, the King's Gambit) can't come in phase 1: Boss alone starts five moves into a named
    opening. Not built.
- **Placeholders for Eric's own lines** (ours, in his chess persona; not his words, no near-copies of real quotes,
  nothing political, national or hateful):
  - Intro: "Sit down. Let's find out if you can really play.", "Forget your opening book. Here we play chess.", "Show
    me one move you didn't copy from somewhere."
  - His ultimate (no verified quote fits): "You're thinking too much. Stop calculating and play!", "Enough staring at
    the board. Pure chess now. Move!", "All that thinking, and still no idea. Play fast!"
  - Mocking the God King's help: "Engine moves? Keep that crutch away from my board.", "Theory, engines, a king in
    armor. None of it is chess!"
  - Consulting the book when behind: "Hm. I've seen this before.", "Interesting. Very interesting."
  - When he wins: "Memorized moves. I knew it."
  - Mumbling, beaten: "No... the book said... bishop takes... no...", "Sixty-four squares... I counted every one..."
- **The God King:** "I sense a tremendous power within this foe." (Eric's own, from ROADMAP.md). Placeholders: "Careful.
  My strength feels faint against this one.", "This is no ordinary boss. Trust your own moves." (his opening line);
  "My power... it won't take hold!", "Nothing! He shrugs off my strength.", "I can't reach him. This fight is yours
  alone." (his help blocked).
- **Screen text:** "BULLET!", "No added time.", "Bullet · m:ss left" (the dock), "You beat him!" (the dock, beaten),
  "the boss is beaten" (the line above the board), "… won on time." (results), "Bullet!" (the dock's word for the
  moment), the menu's "no God King help · bullet clock".

**Test tools:** `?win=1` (solo): the battle starts after 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6, your move: Qxf7 mates him (to see
him beaten). `npm run frames:recluse -- <dir> [phone|desktop|both]` (against `npx wrangler dev`, as an admin): his
intro, the trigger's ultimate, the God King's help mocked, and ?win=1's collapse, frame by frame, with GIFs.

**Testing.** The targeted lane (no protocol or stored-data change): `check`; unit
`packages/chess/test/recluse.test.ts` (hidden from players and the menu, his brain plan and strength, the meter and the
bullet clock's bank, increment and cap, the trigger and the switch, the loss on time, the God King blocked with nothing
spent, `?win=1`), `packages/app/test/recluse-boss.test.ts` (the kit, the collapse loop, the run in place within its
moment, the mock lines in both voices, the God King's cues, the quotes word for word, the sounds) and his art test
updated; e2e `e2e/recluse.spec.ts` (a player never sees him; an admin's fight on a phone and a computer: the stare, Maia
2500, the help mocked, the bullet clock on the trigger; beaten: the collapse and the result). Frames on a 390 px phone
and a 1280 px computer (intro, ultimate, mock, collapse; the machine was loaded, so the boss's thinking was slow and the
screencast had 0.25–0.7 s gaps, none tied to his moments).

### The Maia box's source on the site (Eric, Oct 13–14, 2026)

Eric's OK on Oct 13 ("Publish it."): publish the Maia box's source, then turn `BOSS_BRAIN.forPlayers` on. **The source
is published** (below). **`forPlayers` stays off for now:** the session doing this work wasn't permitted to change
that value (its permission check treated it as a feature-flag change needing the owner's own approval), so the flip is
a separate one-line change once Eric approves it himself. It's ready: the FAQ, the credits and the tests already
cover both states (`packages/app/test/maia-players.test.ts`, `faq.test.ts`, `boss-powers-lobby.test.ts`). My calls:

- **Where:** the site itself serves the box's complete source next to the worker it builds:
  **`/engine/maia/maia-box-source.tar.gz`** (about 57 KB), so it stays public when the GitHub repository goes private.
  It's a static file (Workers static assets), behind nothing but Zero Trust Access, which covers the whole site until
  launch: no Worker route, no admin check.
- **Built at build time by the box's own build** (`packages/maia-worker/scripts/source-archive.mjs`, called by
  `build.mjs`), so it can't drift from what's served: the app's build copies the box's `dist/` as it is. Under
  `maia-box/`: every file of the box (worker code, `build.mjs` and the archive script, `convert.py` and its
  `requirements.txt`, `package.json`, `tsconfig.json`, the AGPL `LICENSE`, the README with the upstream Maia-3 commit,
  the checkpoint's revision and sha256 and every conversion step, the bundled libraries' license texts, the tests and
  their fixtures), minus `dist/`, `node_modules/` and the model; plus three files written for it: `package-lock.json`
  (the box's own packages cut from the workspace's lockfile, so `npm ci` installs exactly what the site's build used),
  `model/README.txt` (the model's name, size, sha256 and where to get it) and `SHA256SUMS.txt` (every file the build
  wrote, to check a rebuild against the site). The same files make the same bytes (sorted entries, fixed times and
  owners).
- **Checked by rebuilding:** extracted, the model put in `model/`, `npm ci`, `node scripts/build.mjs`: all five served
  files came out byte for byte the same (`sha256sum -c SHA256SUMS.txt`), and so did the archive; npm leaves the
  cut lockfile exactly as it is.
- **The model is linked, not bundled again.** The AGPL (section 6(d)) lets the Corresponding Source sit on a different
  server, a third party's included, with clear directions next to the object code, as long as we make sure it stays
  available. The converted int8 file is itself served next to the archive (`/engine/maia/maia3-23m-int8.onnx`, the
  same bytes the build takes from `model/`); what it's made from is CSSLab's own release (Hugging Face
  `UofTCSSLab/Maia3-23M` and the `CSSLab/maia3` code), pinned by revision, commit and sha256, with `convert.py` doing
  every step. A second copy in the archive (20.3 MB packed) would only make the same bytes download twice. Flagged: if
  CSSLab ever removed that checkpoint revision, we'd have to host it ourselves (92 MB, over a static file's 25 MiB
  limit: R2 or split files).
- **Bundled libraries** (onnxruntime-web 1.30.0, MIT; chess.js 1.4.0, BSD) are pinned by the archive's lockfile
  (exact versions and integrity hashes), not copied in: generally available packages, used unchanged.
- **Caching:** the archive isn't precached by the service worker, isn't kept in the Maia cache, and doesn't count
  toward that cache's name, so editing the box's README or tests never makes a player download Maia again.
- **Stockfish too (my call: cheap, same mechanism).** The credits pointed upstream only (Stockfish's repository and
  stockfish.js's, not the exact version), while the GPL-3.0 asks for the source of the very build we serve. Now
  **`/engine/stockfish-source.tar.gz`** (1.6 MB): stockfish.js at its tag `v19.0.0` (commit `9cb3e506…`, as `git
  archive` writes it), the lite network the build embeds (`src/nn-61e7af4bb97d.nnue`, which its build would otherwise
  download) and a note on what it is and how to build the two files (emscripten 3.1.7, `node build.js --lite
  --single-threaded --no-split`). The npm package's files are byte for byte the tag's GitHub release, and the network
  is inside the shipped `.wasm`. The npm package has no source, so the archive is committed
  (`packages/app/stockfish-source/`, with how it was made) and the build refuses a `stockfish` version without one. Not
  rebuilt by us (it needs emscripten 3.1.7): the provenance above is the check.
- **Links:** Settings' credits ("this build and its source"; "Our Maia box's source code is free to download"), the
  FAQ (one plain line in the Maia section, and both archives in its credits), `/licenses/third-party.txt` and the
  Maia box's `NOTICE.txt` link the archives; nothing says "on request" any more.
- **Tests:** `packages/maia-worker/test/source-archive.test.ts` (the build writes it; what it holds; nothing from the
  game; the lockfile against the workspace's; the hashes; the same bytes twice), `packages/app/test/engine-source.test.ts`
  (Stockfish's archive matches the installed version, its license, its network), `faq.test.ts` (the line, the links,
  every Maia line live when it's on), `maia-players.test.ts` and `boss-powers-lobby.test.ts` (with `forPlayers` on for
  the test: a player's boss on Maia by the same rule as an admin's, solo and online), and `e2e/maia.spec.ts` (the
  archives served as gzip files that hold the source, a tap saving one).

### Beta Crate · Series 001, batch 2: the secret agent and the pirate (Oct 14, 2026)

Eric approved finishing the Beta crate, so the planned batches 2 and 3 ship together (agent and pirate complete,
21 of 28 items) and the ninja follows as the last batch. Colors and descriptions are the plan's
(`docs/history/shop-and-crates.md`). The calls:

- **Fake Mustache, not Moustache:** American English (CLAUDE.md). The id is `fake-mustache`.
- **A `mouth` anchor:** a mustache goes under the nose, and no anchor put it there on every piece (the eye line put it
  on the snowman's carrot, the neck under the gingerbread man's smile). Pawn 33, snowman 27, gingerbread 28.
- **The Wire Earpiece follows the eye line** (it's a head item, but sits at the ear), just below where shades' arms
  go, so it shows with Dark Shades on.
- **The Parrot perches on the left shoulder (as we see it),** facing out: on the right it covered the eyepatch, and
  the left is free whatever else is worn. Weapons don't move with the piece, so it's drawn where every piece's
  shoulder is (pawn, snowman, gingerbread).
- **The Pirate Hat** is a tricorn seen from the front, its brim turned up to a point at each side, so it doesn't read
  as a sombrero; its gold trim and the skull stay unblotched (fixed parts), as do the Bandana's white dots.
- **The Fedora's band is dark,** a light shade of the hat on a very dark one (Midnight), where a dark band vanishes.
- **The Captain's Coat** opens at the hem to show the pawn, so it reads as white or black; its lapels and cuffs are a
  shade of its color.
- **Batch 2 odds (Beta):** Common (6) 6.67% each, Uncommon (5) 5.2%, Rare (4) 4.5%, Epic (2) 7%, Pirate Hat and
  Smiley Face 0.8%, Tommy Gun and Parrot 0.2%. Until the ninja's two Epics join, an Epic item is likelier than a
  Common one, as in batch 1.
- **The fitting sheet** takes `scale=1|2`, to look at the art at 1× and 2×.

### The boss by the board's corner stays in the window (Eric, Oct 14, 2026)

From 900 to 1099 px (no leaderboard beside the screen) the boss there is drawn at 1× (as in a phone's boss bar) next to
the eval bar, and the board gives up room only if the margin still falls short of his widest frame (Sawyer's), so he's
whole at every width (he was half off a 1024 px window). At 1024 × 768 the board doesn't move; at 900 × 700 it is 50 px
smaller. From 1100 px he stays 2× over the leaderboard's edge and nothing moves. The God King keeps his size and place.

### Beta Crate · Series 001, batch 3: the ninja; the crate is complete (Oct 14, 2026)

The last seven items, so Beta holds all 28 of the plan, at the plan's final odds. Colors and descriptions are the
plan's (`docs/history/shop-and-crates.md`). The calls:

- **The Ninja Hood's eye slit is a hole,** so the piece shows through it (white or black), with two eyes drawn in it
  (dark on white, light on black). It meets the piece's eye line, so on a snowman or a gingerbread man its eyes land
  on theirs. It drapes to the shoulders; worn over the Ninja Mask, the slit shows the mask instead of the piece.
- **The Ninja Mask** covers the lower half of the head from the eye line, so it goes with the headband (head) and
  with Dark Shades.
- **The Ninja Gi** shows the pawn's head, its base and a V at the neck, so it reads as white or black; the collar is
  a shade of its color, and the belt stays black on every color (its knot outlined in gray on a black pawn).
- **The Katana** is sheathed, a hand's width of steel showing between the guard and the scabbard: the hilt's wrap
  and the scabbard take the color, as the plan says, and a bare blade would leave nothing in the color but the grip.
- **The blurb** names the ninjas: "Secret agents, pirates, ninjas, the old shop's hats and a smile".
- **The final odds (Beta, 28 items):** Common (8) 5% each, Uncommon (7) 3.71%, Rare (5) 3.6%, Epic (4) 3.5%, Pirate
  Hat and Smiley Face 0.8%, Tommy Gun and Parrot 0.2%. Each tier's items are now rarer than the one below's, and a
  test keeps it so.

### The board draws its pieces only when they change (Oct 14, 2026)

Queued Oct 12, approved by Eric Oct 14: the board redrew its pieces every frame while a boss effect played, and
`perf.spec.ts`'s Roman candle check (line 126) was flaky on its frame budget.

**What was re-rendering.** Profiled on a phone slowed 4x and a computer, through every boss effect (Jefferson's
candle, Ginger's blizzard and thaw, Boingo's funhouse turns, Big Boy's bounce, Sawyer's saw, Hollow's Lights out,
Wrangler's lasso drag and Showdown), with a render counter on every component:
- The boss screen keeps a clock that ticks every animation frame (`useFrameNow` at the top of `BossScreen`), so the
  whole screen renders every frame for the boss's entire turn: the header, the dock, the boss's figure, the eval bar,
  and the board, whose own drawing (64 squares' highlights, 32 pieces, the coordinates) was rebuilt and compared every
  frame although nothing in it changed. The board's own drawing was about a fifth of that screen's work each frame.
- The board also drew itself every 20 ms after any capture, on every screen, until the next move: a finished capture
  fade stayed in its list, so its settle timer kept firing. On the Play screen (redrawn five times a second) that was
  the board's biggest cost.
- The long tasks in the effects weren't the board. Jefferson's candle made its three whistles and the crackle the
  first time a shot went up (synthesized at the cue), and drew its frames (him, the rockets, the column of shots) as
  they first showed: together over a second of a slowed phone's time, in chunks of 50 to 250 ms, during the launch
  the spec measures. Ginger's wind and Boingo's sounds were made at their cue the same way.

**The fix.**
- The board is two parts (`board/OwnBoard.tsx`): `OwnBoard`, the wrap with what screens draw over the board and the
  promotion picker, drawn whenever the screen is; and its drawing layer, drawn again only when what it shows changes
  (`boardInputs` in `board/logic.ts`: plain values, so a screen's fresh arrays change nothing) or by itself (a tap, a
  drag, a slide or a fade ending). A move you made goes back exactly as before (the first new thing the screen hands
  the board, `arrows` by identity too, lets it go and draws the layer again). The rule is in docs/areas/board.md.
- Fades and slides that are over are let go (`stillRunning`, tested): no more drawing every 20 ms.
- Boingo's, Ginger's and Jefferson's synthesized sounds join the ones made ahead in idle moments as a battle starts
  (`warmSounds`); Jefferson's candle frames are drawn ahead, a slice a frame, like Big Boy's and Wrangler's
  (`prewarmGrex`). Nothing looks or sounds different: the same samples and frames, made earlier.
- The effects already draw on their own layers (the board's children, `BoardEffects`' shared canvas, CSS animations);
  none of them hands the board a new value every frame.

**Measured** under the shared e2e lock (the machine otherwise quiet), each effect's frames from a solo Boss alone game
with its ultimate brought early, base (main) and after side by side, three rounds, medians. "Long tasks" are the main
thread's tasks over 50 ms of wall time; "CPU" is the main thread's own CPU time a frame (the steadier measure: wall
times include waiting for a core while the other browser runs, and frame times come in whole refreshes, 16.7, 33.3 or
50 ms). `npm run perf:boss` now reports the same per effect (`fxBy`).

*Phone (iPhone 13 size, CPU slowed 4x):*
| Effect | p95 frame, ms (before → after) | long tasks > 50 ms (before → after) | main-thread CPU a frame, ms: mean / p95 | tasks over 50 ms of CPU | runs |
| --- | --- | --- | --- | --- | --- |
| Jefferson's Roman candle | 49.9 → 33.3 | 7 → 1 (max 211 → 53) | 14.8 → 11.3 / 31.7 → 24.3 | 5 → 0 | 3/3 |
| Ginger's blizzard | 33.4 → 49.9 | 2 → 2 (max 133 → 65) | 14.2 → 11.4 / 27.1 → 26.7 | 1 → 1 | 3/3 |
| Ginger's thaw | 33.3 → 33.3 | 0 → 1 (max 0 → 58) | 10.4 → 9.3 / 16.4 → 17.9 | 0 → 0 | 3/3 |
| Boingo's funhouse | 33.3 → 33.3 | 3 → 1 (max 90 → 77) | 9.7 → 10.4 / 15.8 → 24.6 | 1 → 1 | 3/3 |
| Boingo's funhouse turn | 33.3 → 33.4 | 1 → 1 (max 53 → 60) | 10.7 → 11.2 / 22.8 → 18 | 1 → 0 | 3/3 |
| Big Boy's bounce | 33.3 → 16.8 | 1 → 1 (max 68 → 65) | 11.5 → 11.5 / 21.7 → 16.4 | 1 → 1 | 3/3 |
| Sawyer's board saw | 33.3 → 16.8 | 1 → 1 (max 81 → 57) | 10.9 → 9.9 / 16.6 → 16.1 | 1 → 1 | 3/3 |
| Hollow's Lights out | 33.3 → 33.3 | 11 → 9 (max 94 → 123) | 12.1 → 11.5 / 26.2 → 24.5 | 3 → 3 | 3/3 |
| Wrangler's lasso drag | 33.3 → 33.4 | 3 → 1 (max 59 → 56) | 8.9 → 9.9 / 19.8 → 23.7 | 1 → 0 | 3/3 |
| Wrangler's Showdown | 33.4 → 33.4 | 5 → 2 (max 159 → 177) | 12.8 → 11.5 / 26.6 → 21.2 | 2 → 0 | 3/3 |

*Computer (1280 x 800):*
| Effect | p95 frame, ms (before → after) | long tasks > 50 ms (before → after) | main-thread CPU a frame, ms: mean / p95 | tasks over 50 ms of CPU | runs |
| --- | --- | --- | --- | --- | --- |
| Jefferson's Roman candle | 41.7 → 33.3 | 4 → 2 (max 50 → 160) | 4.4 → 3.4 / 9.9 → 6.1 | 0 → 0 | 2/2 |
| Ginger's blizzard | 50.1 → 33.4 | 4 → 1 (max 150 → 86) | 3.8 → 3.4 / 7.7 → 7.2 | 0 → 0 | 3/3 |
| Ginger's thaw | 33.4 → 33.4 | 7 → 2 (max 152 → 152) | 3.1 → 2.9 / 6.2 → 5.9 | 0 → 0 | 3/3 |
| Boingo's funhouse | 33.3 → 16.8 | 1 → 1 (max 75 → 55) | 2.6 → 2.4 / 5.2 → 4 | 0 → 0 | 3/3 |
| Boingo's funhouse turn | 33.3 → 66.7 | 0 → 1 (max 0 → 90) | 2.8 → 2.6 / 5.1 → 5.1 | 0 → 0 | 3/3 |
| Big Boy's bounce | 16.8 → 16.8 | 0 → 2 (max 0 → 108) | 3.1 → 3.1 / 6.3 → 5.5 | 0 → 0 | 3/3 |
| Sawyer's board saw | 16.8 → 16.8 | 2 → 0 (max 57 → 0) | 2.9 → 2.5 / 5.4 → 3.8 | 0 → 0 | 3/3 |
| Hollow's Lights out | 16.8 → 16.8 | 0 → 1 (max 0 → 114) | 2.8 → 2.6 / 6.1 → 5.4 | 0 → 0 | 3/3 |
| Wrangler's lasso drag | 33.4 → 33.4 | 2 → 1 (max 67 → 56) | 2.9 → 2.5 / 5.2 → 4.4 | 0 → 0 | 3/3 |
| Wrangler's Showdown | 33.4 → 50 | 2 → 4 (max 124 → 122) | 3.1 → 3.1 / 5.8 → 5.8 | 0 → 0 | 3/3 |

What it says: the board's work is gone from every effect (mean CPU a frame down 0.6 to 3.5 ms on the slowed phone for most,
within the noise for the rest), and the candle's long tasks with it (its stalls were the sounds and frames, now made ahead), which is
what made `perf.spec.ts:126` flaky. Big Boy's bounce and Sawyer's board saw now hold 16.7 ms at the 95th percentile on
the slowed phone; the rest are at 33 ms there, held up by the boss screen rendering everything else every frame (the
follow-up). On a computer the main thread does 3 to 4 ms a frame; its 33 ms frames there aren't the page's scripts.
A few rounds' numbers swing either way (the funhouse, the lasso drag, the Showdown on a computer): single long tasks
of 55 to 180 ms land in one round and not the next, on both builds.

**Next** (Eric approved, Oct 14: "make do the boss screen lag fixes"; its own PR): the boss screen still renders its
header, dock and figure every frame (3 to 5 ms a frame on the slowed phone), and the solo match's `boss` view is
checked by serializing the boss's state and the whole move history on every read, many reads a frame, which grows with
the match.

**Testing.** Unit: `board-logic.test.ts` (when the board draws again; the fades and slides still running). e2e (the
targeted lane): `perf.spec.ts` (with the board's drawings counted through the candle's launch), every boss spec,
`resign.spec.ts`, `crowd.spec.ts`, `squads-play.spec.ts`. Frame by frame, base and after, phone 390 and computer 1280:
a plain move, and every boss effect (the candle and its waves, the blizzard and both thaws, the funhouse and its turns,
the bounce, the split, the board saw and the cuts, Lights out, the pull, the drag and the Showdown): the same on both,
no piece flickers, jumps back or slides twice, and the funhouse's forced move still slides after the board turns.

### Maia for players: on (Eric, Oct 14, 2026)

`BOSS_BRAIN.forPlayers` is on: every player's bosses play their normal moves with Maia-3 by the same rule admins had
(`bossBrainFor`, `maiaRatingFor`, the guards by level, Stockfish from 2800), solo and online. Eric's go: "flip it", on
Oct 14, after the Maia box's source went up on the site (#183). The session that published the source wasn't
permitted to change the flag, so the director made this one-value change with Eric's explicit OK. A player's device
now downloads the Maia model (24 MiB, cached) when a boss battle needs it; a device that can't run it plays
Stockfish's move as before. The FAQ's Maia section reads as live (it follows the flag). Left for Eric: the real-phone
check (`TESTING.md`, "Maia").

### Squads: Rapid 5+2 (Eric, Oct 14, 2026)

Eric, Oct 14, of Squads' Rapid: "It shouldn't be 55 minutes, because, yeah, that's just a little too long... find a way
to reduce that." (Bullet and Blitz stay as they are.) The call, made without Eric: **Rapid 5+2, was 5+3.** One number
changes (`SQUADS.clocks`, Rapid's `incrementSeconds`, 3 to 2): the bank (5:00), the top-up (+1:00), the free seconds
(2 s) and the cap (20 s) stay. The aim was Rapid's 90th percentile at about 45 minutes or under, with Rapid still the
slowest option.

- **The comparison** (`npm run sim:squads`; Classic 72 lobbies an option, 24 per skill mix; Mercenary 24, Mixed; all on
  the 5+3 calibration's seeds, `SQUADS_SIM_SEEDS="5:00|1:00|2|3|20"`, so every candidate starts from the same lobbies;
  minutes):

  | Option | Classic median | 90th pct | Longest | Mercenary median | 90th pct | Squads reaching sudden death | Moves in it | Random for want of time |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Rapid 5+3 (before) | 40.7 | 51.3 | 63.7 | 42.9 | 49.1 | 21% (Merc 20%) | 0.3% (0.3%) | 0.4% (0.3%) |
  | **Rapid 5+2 (chosen)** | **36.3** | **45.3** | 82.0 | **37.4** | **48.2** | 22% (22%) | 0.4% (0.4%) | 0.5% (0.4%) |
  | Rapid 4+2 | 35.4 | 48.4 | 100.4 | | | 22% | 0.3% | 0.5% |
  | Rapid 6+2 | 36.3 | 47.3 | 86.7 | 38.1 | 44.6 | 22% (20%) | 0.3% (0.3%) | 0.4% (0.3%) |
  | Blitz 3+2 (unchanged) | 33.5 | 45.5 | 74.7 | 36.0 | 41.6 | 22% (23%) | 0.3% (0.3%) | 0.5% (0.5%) |

  By skill mix (Classic medians), 5+2 against Blitz: Strong 41.6 and 34.9, Mixed 35.8 and 33.8, Casual 33.9 and 32.5
  (5+3: 42.9, 40.3, 38.7). Rapid 5+3 with a 17 s cap (36 lobbies on its own seeds) ran 40.6 minutes, 90th percentile
  56.5: no help, so it was dropped. 4+3 wasn't run: the time controls' tuning had 4+3 within half a minute of 5+3.
- **The increment is the lever, as the time controls' tuning found.** One second less a move took 4-5 minutes off
  the median and 6 off the 90th percentile. The bank barely matters: 4+2, 5+2 and 6+2 are within a minute of each
  other at the median, and their 90th percentiles (45-48) differ by no more than the noise. So the simplest change
  wins: one number, and the card still reads like a chess clock ("Rapid 5+2").
- **The long tail is long games.** The 90th percentile comes from the few lobbies whose games run long. With 36
  lobbies it's about the fourth longest, and it moves 4-7 minutes from one set of lobbies to another. Blitz 3+2 ran 40.9 on the calibration's lobbies and 45.5 on these, and 5+2 ran 52.6 on 36
  lobbies of its own seeds and 45.3 on these 72. So these numbers compare candidates on the same 72 lobbies. They
  don't promise a number for one lobby.
- **Still the slowest, but closer to Blitz.** Rapid's median stays above Blitz's for every skill mix (2.8 minutes overall,
  6.7 for strong squads, 1.4 in Mercenary), from its bigger bank, top-up and cap. With the same increment as Blitz, it
  can't be much further apart without bringing back the long tail: a bigger bank adds almost nothing (6+2), and a
  bigger increment is what made 5+3 long.
- **Sudden death and random moves: as Blitz's.** 22% of squads reach it (Blitz 22%), 0.4% of moves are made in it
  (Blitz 0.3%; 5+3 itself 0.3-0.4%), and 0.5% of actions become random moves for want of time (Blitz 0.5%; 0.6% in the
  calibration). Near zero a squad lives on 2 s free plus 2 s back a move, as on Blitz.
- **Labels follow the setting** (`clockLabel`, `teamClockLine`, `teamClockDetail`, `matchClockLine`, the FAQ): the
  vote card "Rapid 5+2", "5 min + 2 s a move · max 20 s"; each match's card "Rapid 5+2 · +2 s a move · max 20 s"; the
  result's banner "... each move made in time adds 2 s ..."; the FAQ "Rapid 5+2 (5 minutes, +2 s a move, at most 20 s
  on a move)". The vote order (Rapid, Blitz, Bullet) and the default (Blitz, by its id) stay.
- **Lobbies in play keep their clock.** Each match carries its own increment (`incrementMs`), and a lobby's rules
  carry its voted clock, so a lobby that voted 5+3 before the deploy finishes on 5+3.
- **The sim:** `SQUADS_SIM_SEEDS` (every option on one clock's seeds) and each lobby's minutes in the progress lines,
  for comparisons like this one. `reports/squads-sim.md` was regenerated with the new Rapid (Bullet and Blitz came out
  the same as before: the sim is deterministic, and the 5+3 calibration reproduced exactly).

### The boss screen's lag: the boss view free to read (Oct 14, 2026)

Eric, Oct 14 ("make do the boss screen lag fixes"), after "The board draws its pieces only when they change": the boss
screen still renders everything every frame, and the solo match's boss view was checked by serializing the battle.

**What changed.** `MatchRunner.bossView` (asked many times a frame by a boss screen: the header's tower, the dock, the
boss's figure) built its cache key by serializing the boss's whole state and the move history on every ask, a cost
that grew with the match. The runner replaces the boss's state, its boards and its last move rather than changing them
in place, so the same objects with the same position and history now give the same view after comparing a few values;
anything else goes on to the full key as before (the guarantee stays: a cached view is the one a fresh build gives).
Tested in `long-match.test.ts` (no serializing when nothing changed; each input changed gives the fresh view; a board
changed in place, as tests do, is caught).

**What wasn't changed, and why.** The plan was also to stop the boss screen rendering its header, figure and chat
every frame, keeping the per-frame clock for the parts that animate. Looking at what those parts draw from, several
depend on being drawn every frame without saying so: Hollow's bulb strip relights at a time it reads while drawing, the
admins' brain line reads a note the engine writes without telling the screen, and the chat's "Next in N s" counts down
only as it's drawn. Each could be given its own timer, but every one found suggests more, and a miss is a visible
change (a bulb relighting late, a line frozen). Measured, the header, the figure and the chat together are about
1.5 ms of a 4x-slowed phone's frame (a fifth of the screen's render work), short of what the remaining effects need
to reach 16.7 ms there. Following "simple beats flashy", it's left for Eric and the director to decide.

**Measured** under the shared lock, base (main) and after side by side, three rounds, medians, as in the board's
section:

*Phone (iPhone 13 size, CPU slowed 4x):*
| Effect | p95 frame, ms (before → after) | long tasks > 50 ms (before → after) | main-thread CPU a frame, ms: mean / p95 | tasks over 50 ms of CPU | runs |
| --- | --- | --- | --- | --- | --- |
| Jefferson's Roman candle | 33.3 → 33.3 | 2 → 1 (max 71 → 53) | 12.8 → 12.3 / 27.6 → 26.6 | 1 → 0 | 3/3 |
| Ginger's blizzard | 33.4 → 50 | 3 → 2 (max 81 → 77) | 13.2 → 14.8 / 29.4 → 37.6 | 1 → 1 | 3/3 |
| Ginger's thaw | 33.4 → 33.4 | 3 → 1 (max 91 → 65) | 12.4 → 13.2 / 25.6 → 29.2 | 0 → 0 | 3/3 |
| Boingo's funhouse | 33.3 → 16.8 | 0 → 0 (max 0 → 0) | 10.2 → 10 / 16.4 → 15.9 | 0 → 0 | 3/3 |
| Boingo's funhouse turn | 33.3 → 16.8 | 0 → 0 (max 0 → 0) | 9.2 → 8 / 15.2 → 14.8 | 0 → 0 | 3/3 |
| Big Boy's bounce | 33.3 → 16.8 | 0 → 1 (max 0 → 51) | 13.1 → 12 / 25.1 → 16.5 | 0 → 0 | 3/3 |
| Sawyer's board saw | 16.8 → 16.8 | 1 → 1 (max 68 → 51) | 9.8 → 9.8 / 15.6 → 15 | 0 → 0 | 3/3 |
| Hollow's Lights out | 33.3 → 16.8 | 3 → 4 (max 139 → 105) | 12.2 → 12 / 23.4 → 16.6 | 3 → 4 | 3/3 |
| Wrangler's lasso drag | 33.3 → 33.3 | 1 → 0 (max 51 → 0) | 10.4 → 10 / 16.2 → 17.3 | 0 → 0 | 3/3 |
| Wrangler's Showdown | 33.3 → 33.3 | 1 → 1 (max 65 → 68) | 11.8 → 11.6 / 21.2 → 26.1 | 1 → 1 | 3/3 |

*Computer (1280 x 800):*
| Effect | p95 frame, ms (before → after) | long tasks > 50 ms (before → after) | main-thread CPU a frame, ms: mean / p95 | tasks over 50 ms of CPU | runs |
| --- | --- | --- | --- | --- | --- |
| Jefferson's Roman candle | 16.8 → 16.7 | 0 → 0 (max 0 → 0) | 3.6 → 3.5 / 5.5 → 5.6 | 0 → 0 | 3/3 |
| Ginger's blizzard | 16.7 → 16.8 | 0 → 0 (max 0 → 0) | 3.7 → 3.6 / 6.9 → 6.4 | 0 → 0 | 3/3 |
| Ginger's thaw | 16.8 → 16.8 | 0 → 0 (max 0 → 0) | 3.4 → 3.3 / 4.9 → 5 | 0 → 0 | 3/3 |
| Boingo's funhouse | 16.8 → 16.7 | 0 → 0 (max 0 → 0) | 2.4 → 2.7 / 3.7 → 4.4 | 0 → 0 | 3/3 |
| Boingo's funhouse turn | 16.7 → 16.7 | 0 → 0 (max 0 → 0) | 2.7 → 2.8 / 4.8 → 5.9 | 0 → 0 | 3/3 |
| Big Boy's bounce | 16.8 → 16.8 | 0 → 0 (max 0 → 0) | 3.6 → 3.6 / 5.2 → 5.2 | 0 → 0 | 3/3 |
| Sawyer's board saw | 16.7 → 16.8 | 0 → 0 (max 0 → 0) | 3 → 2.8 / 4.5 → 4.2 | 0 → 0 | 3/3 |
| Hollow's Lights out | 16.8 → 16.7 | 0 → 0 (max 0 → 0) | 3.1 → 3.1 / 6.1 → 6.3 | 0 → 0 | 3/3 |
| Wrangler's lasso drag | 16.7 → 16.7 | 0 → 0 (max 0 → 0) | 3.1 → 3 / 4.5 → 4.6 | 0 → 0 | 3/3 |
| Wrangler's Showdown | 16.8 → 16.8 | 0 → 0 (max 0 → 0) | 3.5 → 3.6 / 6 → 6.8 | 0 → 0 | 3/3 |

On a computer every effect now holds 16.7 ms at the 95th percentile. On the slowed phone the boss view's cost in a
short Boss alone game is small, so most rows move within the rounds' noise; it grows with a match's length and with a
raid's players, which these runs don't reach. The render counter (a diagnostic build) showed the boss screen's render
work during the candle, blizzard and Showdown down from 4.1-4.7 ms to 3.1-3.8 ms a frame on the slowed phone. Jefferson's
candle, Ginger's blizzard and Wrangler's Showdown stay at about 33 ms there: their frames' main-thread time is spread over
the effects' own drawing (two dozen rocket sprites and their canvases, the blizzard's full-board snow), the browser's
style, layout and paint, and the screen's render; none alone brings them to 16.7 ms.

**Testing.** Unit: `long-match.test.ts`. e2e (targeted lane: the boss view is read by every boss screen, solo and the
lobby server): `perf.spec.ts`, every boss spec, `king-attack.spec.ts`, `resign.spec.ts`, `multiplayer.spec.ts`.

### Chess960's rules: true Fischer Random castling, the rules foundation (Oct 14, 2026)

The hidden boss's phase 2 is played in Fischer Random (Chess960), and Eric wants a true tribute, so it gets real
Chess960 castling, not random back ranks with castling switched off (ROADMAP.md, "The hidden boss"). This is the rules
foundation only: no boss, no screen and no phase change use it yet. Nothing changes for normal games.

- **Our own small Chess960 rules, used only for Chess960 positions** (`packages/chess/src/chess960.ts`, about 540 lines with its comments).
  chess.js 1.4 can't be extended cleanly: it hard-codes castling (the king from e1 two squares, rooks on a1 and h1) and
  its FEN check refuses any castling field but KQkq. Wrapping it (its moves without castling, plus castling of our own)
  was the other choice, but its public move list builds every move's SAN (about 1.8 ms a position), too slow to check
  move generation to depth 4, and the fast path is a private method. So the rules are ours: move generation with
  castling, making a move (a position is a value: "undo" is the one before, kept), SAN both ways, check, mate,
  stalemate and the draws, the same checks in the same order as chess.js. Correctness is pinned by perft against the
  published Chess960 numbers (all 960 of chessprogramming.org's positions to depth 4 matched while building; 12 chosen
  for their castling to depth 4 in the tests), by Stockfish's own perft and move list on the same positions, and by
  random games from the normal setup checked move by move against chess.js (same legal moves, FENs, SAN and endings).
- **Normal games keep today's code, unchanged.** `rules.ts` sends a position to the Chess960 rules only when its FEN's
  castling field names rooks by file, which a normal FEN never does; every normal FEN runs exactly the code it ran
  before (the existing tests pass unchanged, and the engine sends Stockfish exactly the same commands). The read-only
  questions castling can't change (a piece on a square, check, a queen in danger) ask chess.js about the same position
  with its castling rights blanked, so the board, its sounds and the boss's animations read a Chess960 position too.
  A Chess960 game whose rights are all gone plays identically under either.
- **FEN: Shredder-FEN** (each castling rook by its file, White's in capitals, the king's side first: "HAha" for the
  normal setup, "HFhf" for a king on g1 between rooks on f1 and h1), rather than X-FEN (KQkq unless that's ambiguous,
  then a file). One rule, never ambiguous, no "outermost rook" inference; it's what Stockfish writes in Chess960 mode,
  character for character (a test compares them), and what the published perft tables use. Reading also takes KQkq
  (the outermost rook), so a normal FEN can be read. The en passant square is written only when the capture is legal,
  as chess.js writes it, so a position always has one FEN and repetition counts it right.
- **Start positions by the standard (Scharnagl) numbering,** 0 to 959, 518 the normal setup
  (`chess960BackRank`, `chess960Fen`), or drawn from a seeded random source (`randomChess960(rng)`, the same seed giving
  the same setup).
- **Moves in and out.** UCI writes castling as the king taking its own rook (e1h1, b1a1), as Stockfish does with
  `UCI_Chess960`, so the engine's moves need no translation; SAN writes O-O and O-O-O. Never ambiguous: a king can't
  otherwise move onto its own piece.
- **Castling's rules** (each with a test): the king lands on g1 or c1 and the rook beside it on f1 or d1 (mirrored for
  Black); every square either crosses or lands on is empty but for those two; the king isn't in check and no square
  from where it stands to where it lands is attacked, judged with the king and that rook lifted off, so a rook can't
  shield the king from a line it opens by leaving (king c1, rook b1, a queen on a1: no castling); the right goes when
  the king moves, that rook moves, or that rook is taken. The king or rook already on its square, and the two swapping,
  all work. A castling can be the only legal move, so a Chess960 stalemate is judged by these rules, never chess.js.
- **The board's input: both gestures, only for Chess960.** The king dragged (or tapped) onto its own rook castles,
  which is the move as it's written; the king dragged onto the square it castles to (g1 or c1, as in normal chess) also
  castles wherever that can't mean anything else: the king isn't already there, its rook isn't standing there, and no
  ordinary king move goes there (king f1, rook h1: g1 is a plain king step, so castling is onto the rook). The dots show
  both squares. The change is two helpers in `board/logic.ts` (`destsFor` adds the shortcut squares, `gestureMoves`
  resolves a gesture) and one line in `OwnBoard.tsx`; for a normal FEN both return exactly what they did. The move
  sound knocks castling (not a capture) for a king onto its own rook.
- **Stockfish.** `UciEngine` (the browser's workers and Node) and the engine server (`engine/server.mjs`) switch
  `UCI_Chess960` on just before a Chess960 position and off before the next normal one, judged from the FEN, so a
  shared engine can't be left in the wrong mode; a normal search after a normal one sends nothing new. The engine
  server's request check now takes a Chess960 castling field. Its scores, top moves and `playAtElo` (the boss's
  strength later) work on Chess960 positions as they are. Not wired into any boss.
- **No settings:** nothing here is a tunable (the 960 numbering is the variant's own); the boss's strength and clock
  will be settings when he's built.
- **For whoever builds phase 2:** a Chess960 board starts from a base at ply 0 holding its start FEN
  (`bases: [{ ply: 0, fen }]`), because `baseAt` otherwise assumes the normal start; then `fenAtPly`, `boardEnd`,
  `recentMoves` and the rest work as they are. The FAQ explains Chess960 when a player can meet it.

**Testing.** Targeted lane (CLAUDE.md, Oct 14): typecheck, every unit test (the normal-chess ones unchanged), and the
e2e specs that play moves on the board (listed in the PR). Unit: `packages/chess/test/chess960.test.ts` (the numbering
and seeded draw; FEN round trips, X-FEN reading and refused rights; perft on 12 published positions to depth 4, the
FEN functions to depth 3, normal positions read as Chess960; each castling rule and edge case; rights lost; castling as
the only move; O-O / O-O-O both ways and every move's SAN read back; random games against chess.js; `rules.ts`'s
routing, repetition with rights), `chess960-engine.test.ts` (the exact commands a normal and a Chess960 search send;
Stockfish's FEN, perft and move lists against ours; scoring, a castling found and written e1h1-style, `playAtElo` at
3000, and back to normal castling after), `packages/app/test/board-logic.test.ts` ("Chess960 castling on the board":
the dots, both gestures, the edge cases, a screen's limited moves, tap and drag, both pieces sliding, normal castling
untouched) and `move-sound.test.ts` (the castle knock).

### An admin's Engine move button (Eric, Oct 14, 2026)

Eric wants to beat the Hidden Boss's phase 1 himself while playtesting, and a 2650 Maia is beyond him. So admins get
one small button, **"Engine move"**, in Boss alone only: one tap plays Stockfish's best move as theirs, through the
normal move path (clocks, the boss's reply, its powers and the Hidden Boss's bullet clock all as usual). It works against
every boss (simpler, and Eric can use it anywhere), never for players and never online (raids, Crowd, Squads,
multiplayer: `NetMatch` has no such method), and `BOSS_POWERS.engineMoveButton` false removes it.

- **The search is the power-up hints'** (`runner.topMovesFor`, 250,000 nodes at `engineNodes`): it already starts as
  your move begins (the judge's prefetch), so a tap usually answers at once and adds no engine work, and it only picks
  moves the turn allows (a power's limits). A separate fixed search would queue behind that one on the device's single
  engine and be slower, so there's no new number; the setting's comment says what the search is.
- It waits (grayed) while searching and whenever it isn't your move, so a double tap sends one move.
- **The Hidden Boss starts from the starting position** (Eric, Oct 14, same PR): never a book opening, since his lines
  say he has no memorized lines. His rules' `opening.fromStart` (the flag Wrangler, Big Boy and Hollow already use);
  sides as usual, so in Boss alone the crowd is White, and with `?side=b` he's White and makes the first move from the
  start (his "Best by test." fits when Maia plays 1.e4). Other bosses unchanged.
- **Testing:** targeted lane. `packages/app/test/engine-move.test.ts` (the gate), `packages/chess/test/recluse.test.ts`
  (his board starts at the standard FEN, as White he moves first; another boss still gets its opening), `e2e/recluse.spec.ts` (an admin's tap
  plays a move on phone and computer; a player's Boss alone has no button) and `e2e/resign.spec.ts`.

### The Hidden Boss's bullet bank: 1:00 (Eric, Oct 14, 2026)

After playing phase 1, Eric: the 3:00 bank after his ultimate "feels like too much honestly, let's do it 1+0". So
`BOSS_POWERS.bulletBankSeconds` is 60, was 180; nothing else changes (no increment, no per-move cap, out of time loses).
Still not sim-tested.

### The Hidden Boss, phase 2: the phase change and four Chess960 boards (Eric, Oct 14, 2026)

Eric approved building it (Oct 14). Same reach as phase 1: admins only, in Boss alone, with bots; players never meet
him (no menu, raid, Crowd, random pick or server path changed; `?boss=recluse` still gives a player another boss).
Online and stored data are untouched: no protocol or schema change (the result screen's "won N of 4" is solo's own
phase field). ROADMAP.md, "The hidden boss", has the whole design.

**Eric's calls (Oct 14).**
- **Each board its own Fischer Random start**, four different setups drawn from the battle's seed, no two the same
  (Eric: "Every player gets a different one that avoids everybody just discussing the same move in like a Discord").
  This replaces the director's first call (one shared setup for equal difficulty). Drawn without replacement from
  the 960 (`phase2Numbers`), so there's no retry loop; the same seed gives the same four.
- **His strength starts at about 2750** (`RECLUSE_PHASE2.elo`, Stockfish's UCI_Elo), not the roadmap's earlier 3000:
  at this pace 2750 "may be sufficient". A starting value, to tune after real players try him.

**The phase change** (about 7.2 s; `PHASE_CHANGE` in `packages/app/src/recluse-phase2.ts`; `PhaseChangeScreen`).
Phase 1 won: the board holds while he collapses and mumbles (phase 1's fall, 4.5 s), then, instead of the result:
- the red book flies from his side to the board's center, spinning, and slams down (its `slam`: dust, the ring; the
  board jolts with the saw's crash);
- crack lines run down and across the middle: Sawyer's board-saw gap (`boardGap`), the same sprite turned 90° for the
  other line, with its crack sound (Eric's pick: reuse the saw);
- the quarters part and each grows into a whole board at its corner, a 2x2 in the board's square. Each is a full
  board clipped to its quarter, its clip opening as it shrinks toward its corner: only a transform and a clip, which
  the board measures without (`.claude/LESSONS.md`: never change what a board draws under a transform);
- the book, lying where it fell, flips its pages while every board's pieces fly to their Chess960 squares (the board's
  own slide), then snaps shut and goes back to him: he started rising before, and his revive's catch comes as it
  goes; he rests in phase 2's idle (the book in front, hair always flowing) from then on;
- "PHASE 2" "Chess960 · win all four boards", and the clocks start.
- **Not skippable,** like a boss's intro (no cutscene in the game is). `?phase=2` jumps straight to it.
- **His figure** follows a "figure run" (`setFigureRun`, BossCharacter.tsx): a loop before, a run of animations, then a
  loop for good, over his beat; his beat's lines and fall lines are quiet meanwhile. Both voices are reset as it
  begins (phase 1's words are over).
- **Frames that don't exist, and what stands in** (for the director): a slumped frame without the book (in
  `collapseLoop` the book lies by his knees while the board's book flies and slams: two books on screen for those
  seconds); a page flip in his hands during the shuffle (the board's book flips instead, and his revive's catch takes it
  back); his "super saiyan" transformation when beaten (a placeholder: `spellbook2`, then the glowing `spellLoop2`).

**Phase 2's play** (rules `packages/chess/src/bosses/recluse-phase2.ts`, driver `Phase2Game`, screen `SimulScreen`).
- **Four boards, Chess960, the players White** (as the crowd is in Boss alone; my call: they move first, and it keeps
  the phase 1 frame "you play White"). You play board 0; bots the other three. Each board is a BoardState from a base
  at ply 0 holding its start FEN (`phase2Board`: `bases: [{ ply: 0, fen }]`), so `fenAtPly`, `boardEnd` and
  `recentMoves` replay it from its own setup.
- **No power-ups, no blocks, no items;** the God King's help stays blocked and mocked as in phase 1 (now with
  `slam2`). Phase 2's own ultimate (Eric's, below) is the only power.
- **His brain: Stockfish, never Maia** (`phase2Brain`: Maia can't play Chess960), whatever `BOSS_BRAIN.fixed` says for
  him in phase 1, at `elo` 2750, `nodes` 250,000 and at most `moveMs` 900 ms a move (`go nodes … movetime …`; a new
  optional argument of `playAtElo`). On this device, like every solo boss; **one engine serves the four boards in
  turn** (`phase2Next`: your board first when it waits, then the board that has waited longest). The bots think on
  the last engine of the pool (the same one on a device with one): Stockfish at 2200, 100,000 nodes, a random 0.9 to
  2.6 s a move on their own clocks. No engine answer: the first legal move (never a stall).
- **The clock: ultra-fast bullet** (`bankSeconds` 120: 2:00 a board, an estimate, not yet sim-tested), no increment,
  nothing adds time; it runs only on the player's move; he has no clock (as in phase 1). Out of time loses that board
  (checked five times a second; a move made late isn't played).
- **Winning and losing:** a board ends by mate, stalemate or a draw by rule, time, or resigning. A lost board's
  neighbors play on (the roadmap's default); the battle ends when every board is decided. **All four must be won**: a
  draw is not a win. Then his reaction holds the boards for `endMs` (3.2 s): beaten, the transformation's placeholder
  and his line; he won, `laugh2` and a victory line. Then the result: "Victory!" ("You beat Hidden Boss on all 4
  boards!"), or "Defeated" with "Hidden Boss won. You won N of 4 boards: all 4 must be won."
- **His phase 2 ultimate** (Eric, Oct 14, added to this build): a move that takes longer than `slowMoveSeconds` (5 s),
  by you or a bot, on any board, is a slow move, and he says one of his lines about playing faster (LOW priority in
  his voice: it waits its turn or lapses, so one sprite never has two bubbles). When the team's slow moves pass
  `slowMovesForUlt` (5; it fires on the 6th), his ultimate: "That's enough!" (placeholders), the spellbook where he
  stands (`spellbook2`, `spellLoop2`, `spellClose2`), "5 SECONDS!" over the boards. From then on every move on every
  board has `ultMoveSeconds` (5 s) with **no bank**; when they run out, a **random legal move** is played for that
  player (`phase2Timeouts`), never a loss on time. Before it, the 2:00 bank applies as above (a bank that runs out
  loses the board). Squads' missed move (`randomLegalMove`, squads/board.ts) is the approach reused, a seeded pick
  from the legal moves, but through our own `legalMoves` (Squads' helper is chess.js's, which has no Chess960). His
  phase 2 start line is now NORMAL priority so the ultimate's line cuts in if it comes in the first seconds. The dock
  shows "slow moves N of 5" before it and "5 s a move · 3.2 s left" after; each board's tag shows that board's
  seconds. The bots think past 5 s now and then before it (`botSlowChance` 12%, `botSlowMs` 5.4 to 7 s) so the count
  comes in Boss alone even if you're quick; the admins' "Trigger ultimate (testing)" brings it at once. **Estimates,
  not yet sim-tested:** with a 2:00 bank (about 3 s a move over a game) slow moves will be common, so the ultimate will
  likely come early in the fight. **Online later:** the 5 s must allow for network lag (a small grace on the server's
  clock, as `lateGraceMs` does for moves today).
- **Resigning** is your board's ("Your board is lost. The other boards play on, but all four must be won."); once it's
  decided, Leave ends the battle where it stands ("The battle ends here, and the boss wins it.").
- **Layouts** (reusing what exists): the boss screen's frame (header, his bust in the phone's bar, his figure by the
  board on a computer, the God King's dock). A phone: the other three boards small above yours, tappable to watch one
  big ("Back to my board"), as Squads does; a computer: all four as the 2x2 the phase change leaves (no jump).
- **Engine move** (admins, #199) works on your phase 2 board: Stockfish's best for its Chess960 position (UCI_Chess960
  switched on by the engine wrapper), played as your move.
- **Test switches:** the admins' "Trigger ultimate (testing)" brings phase 2's ultimate at once. `?win=1` covers both phases: phase 1 is the mate in one; in phase 2 every board starts from the
  same mate in one, written as Chess960 (`PHASE2_WIN_FEN`, from the normal setup 518), the bots take theirs at once,
  so your Qxf7 wins it all. `?phase=2` (an admin's Hidden Boss only) starts at the phase change. Together, a loss is
  one resign away (3 of 4).
- **The admins' brain line** in phase 2: "Stockfish 2750 · at most 900 ms · last 640 ms".

**Lines** (`characters/recluse-lines.ts`, all placeholders for Eric's own but one quote): his revive, phase 2's start,
a board he wins, a board he loses, beaten on all four; the God King's phase 2 start, a board won, a board lost, the
victory. **One real quote, word for word** (the research report's Tier A, A5), for a board he wins (the players are
White): "Of course White can always play differently, in which case he merely loses differently. (Thank you, Weaver
Adams!)" ("A Bust to the King's Gambit", *American Chess Quarterly* 1:1, Summer 1961, p. 9). Also placeholders: his
slow-move lines and his ultimate's ("That's enough! Five seconds a move, all of you!"). Nothing political,
national or hateful. **Screen text** (admins only): "PHASE 2", "Chess960 · win all four boards", "The red book!", "One
board becomes four…", "Phase 2!", "Every board must be won.", "Your move", "The boss is thinking…", "Your clock m:ss · no
added time", "Back to my board", "Won", "Lost", "Lost on time", "Lost: resigned", "Draw", "Phase 2 · N of 4 won", the two
results lines and the two resign notes. No player-visible text changed.

**Measured** (slow-phone profile and a computer: see the PR for the numbers).

**Next step:** the engine-against-engine sim in Chess960 at the real clock (2750 and the 2:00 bank), then real
players.

**Testing.** Targeted lane, thorough (rules and the runner): typecheck, the whole unit suite; unit
`packages/chess/test/recluse-phase2.test.ts` (four different seeded starts, ply-0 bases and replays, Chess960
castling on a board, the clocks, time and resign, all four must win, a mate by him, his next board, the ultimate's
slow-move count, its threshold and the random move out of time, the Stockfish-only brain with the exact UCI commands,
real Stockfish on every board within his time) and
`packages/app/test/recluse-phase2.test.ts` (the phase change's beats and length, the four boards driven with pretend
engines: the test switch's win, his strength and budget on every move, your time running out, the ultimate from the
trigger and from slow moves, resigning); e2e
`e2e/recluse.spec.ts` (phase 1 beaten into the phase change and four boards, then Victory; `?phase=2`'s four starts,
Stockfish answering, Engine move, the God King mocked; the ultimate on the trigger, then a random move for you out of
time; a loss by resigning, 3 of 4), plus the specs of the areas it
touches (castling, resign, boss-speech, king-attack, maia, perf). Frames: `npm run frames:recluse2`.

## Big Boy's perf check near its budget (Oct 14, 2026)

**What:** Big Boy's slow-phone perf check (`e2e/perf.spec.ts`, his intro and snack) stays as it is, budget included,
and is known to sit near its limit. Boss sounds are now made ahead in a worker (#203), off the page's thread.

**Why:** The check failed in the batch run and alone. A/B runs (#202) showed the same results on 878ccab and main, with
matching CPU profiles; nothing merged since had changed it. On a quiet machine the window drops 8 to 16% of frames
against a 15% budget, with p95 at two or three refreshes (and `p95 < 50` sits exactly on three, so timing jitter
decides 49.9 against 50.1). With four busy loops added it drops 21 to 34%, and other sessions' builds and unit tests
don't take the e2e lock. Moving the sounds to a worker removed their 50 to 180 ms tasks from the page (Big Boy's
intro lost 1,120 → 1,025 ms to dropped frames, Hollow's 1,001 → 803 ms, 8 runs each). What's left is mostly the
browser's own work and the boss screen redrawing every frame. Memoizing that redraw is what would clear the budget,
but it's a riskier change to the boss screen (many lessons apply), so it's held for Eric to decide. No budget was
raised.

**So:** a red Big Boy perf run is re-run alone on a quiet machine before a PR is blamed.


## The Hidden Boss's phase change, reworked (Eric, Oct 14, 2026)

Eric, after seeing the phase change from #201: "I wanted it where the board split is a bit longer cool animation, he
drops down to the center of the board, book in hand, angry, drops it to the ground, light beaming from it as he chants
nonsense and then the boards crack and split like they do now." Then, the same day, what he chants: the 1962
Candidates in Curaçao, where he said his rivals teamed up on him ("He should mumble their last names randomly, say
things like 'they worked as a team'... just don't say Soviets obviously and Russians, their last names are ok
though"), and through phase 2's play, lines about the team against him, escalating. Same reach as before: admins only,
in Boss alone; no rule, protocol or stored data changed.

**The sequence** (one timeline, `PHASE_CHANGE` in `packages/app/src/recluse-phase2.ts`; about 10.4 s after a 1.8 s fall,
was 7.2 s after 4.5 s; not skippable, as before):
1. **Beaten** (0 to 1.8 s before it): he collapses and mumbles as before, but the fall is short when phase 2 follows
   (`PHASE_CHANGE.fallMs`; the rules' 4.5 s stays for a fall without one). His voice is cleared as he falls rather than
   as the change begins, so his mumbling carries on until his chant cuts in.
2. **Up in a rage** (0 to 1.3 s), where he stands, both drawings (the bust in a phone's bar, the figure by a computer's
   board): his brows come down, his head snaps up glaring, teeth bared, he gets up and the book flies back up into his
   hand (`rage`).
3. **The leap** (1.3 to 2.3 s): the board draws his whole figure, on a phone too (his place stands empty meanwhile; his
   bubble stays beside it, as for Sawyer and Wrangler). From his place (the bar's top left on a phone, beside the
   board's bottom left on a computer) onto the middle, his shadow where he'll land; a thud (`recluseThump`), a burst
   of dust, the board jolts (`leap`).
4. **The book thrown down** (2.3 to 3.5 s): brandished over his head, a shout, then thrown at his feet, where it lands
   open with a thud and dust (`drop`).
5. **The chant** (3.5 to 7.35 s): arms raised over the open book, his mouth working, his hair lifting: phase 2's face
   and hair from here (the light is his power coming back), so the transformation is this beat. Light pours up out of
   the book: a cone of it behind him with rays, pulsing, and a glow on the pages (CSS only), motes rising in his frames,
   the pages lit; a soft minor chord swelling over the stare's hum (`recluseGlow`). One chant line in his bubble.
6. **The boards crack and split** (5.2 to 7.25 s), as before: Sawyer's board-saw gap down and across, the quarters part
   (the board jolts again) and grow into four boards, as the light dies.
7. **The book back** (7.35 to 8.2 s): it snaps shut and flies up into his hands (his revive's own frames: `pickup`),
   his revive line; meanwhile every board's pieces fly to their Chess960 squares (7.5 to 8.4 s).
8. **The leap back** (8.2 to 8.9 s) to his place, gone before he lands (`leap2`); there, phase 2's idle from then on.
9. **"PHASE 2"** at 9.0 s; the clocks start at 10.4 s.

**One book on screen**, his own, in his frames, from start to end. The flying book effect (`RECLUSE_BOOK`) isn't shown
any more (kept as art), so the slumped frame's book and a second book on the board can't both show, as they did.

**My calls.**
- **The light in CSS, not a sprite:** two layers (`.rc-light`, `.rc-glow`) whose opacity and transform alone move;
  the least code and no new frames to paint. The motes and lit pages are in his frames (as his spellbook's are).
- **His size on the board:** 24% of its width, about his own 2x beside a computer's board (1.3x on a phone).
- **One chant line a phase change**, picked from the list: each bubble stays 3.5 to 4.5 s (the one rule), so two
  wouldn't end before his revive line. One bubble at a time throughout: the mumble, the chant, the revive line, then
  phase 2's line.
- **The dock's first line** "The red book!" is now "The boss rises!" (admins only). The flying book's page-flip sound is
  gone with it.
- **Frames** (41 new frame specs, the bust 11 of them; parts painted only when first shown, drawn ahead from his
  battle's start: `prewarmRecluse`): `rage`, `leap`, `drop`, `chantRaise`, `chant` (an 8-frame loop), `pickup` (one
  new frame, then the revive's), `leap2`; a raised open hand, his angry face (brows drawn down in a V, a glare, a
  scowl, a shout), a free hand clenched, no shadow in the air. Two new synth sounds (`thump`, `glow`), made ahead in
  the sound worker like his others.

**His words** (`characters/recluse-lines.ts`; Eric's rules: his rivals' last names are fine, Petrosian, Keres, Geller,
Tal, Korchnoi; never the words for their country or its people; nothing that says Korchnoi threw games, only the agreed
draws and the teamwork, which historians largely accept; a test checks the first and the last):
- **Real quotes, word for word**, from his article "The Russians Have Fixed World Chess", Sports Illustrated, Aug 20,
  1962, read on a scan of the printed pages (p. 19's passage is also quoted word for word in Dominic Lawson, "Collusion
  in Curaçao", Standpoint, 2012): "They worked as a team." (p. 19), "They consulted during the games." (p. 19), "They
  agreed ahead of time to draw the games they played against each other." (p. 19), "They would openly analyze my game
  while I was still playing it." (p. 65), "It made me mad that they thought they could get away with it." (p. 65), "I
  will never again play in one of these tournaments." (p. 18). Of the other candidates passed along: "Well, I now know
  better." (p. 18) is verified but reads oddly alone; "Anyone could draw his own conclusions from this sequence of
  events" (p. 64) is about Korchnoi's games (left out by Eric's rule); "If you start out badly..." isn't in the article
  (not used, not paraphrased).
- **Ours** (placeholders): the mumbled name fragments ("Petrosian... Keres... Geller...", "Keres... Geller... draw...
  draw...") and the phase 2 lines below.

**His collusion lines in phase 2** (Eric, Oct 14: the four boards against a team fit his story): every `talkEvery` (8)
of his moves on all the boards, give or take `talkJitter` (2), a line from three pools by his moves so far: early,
suspicious muttering; from `talkMiddleFrom` (24), accusations (his games analyzed, the quick draws, the names); from
`talkLateFrom` (64), paranoid ranting (`Talk`, `talkStage`). Each pool in turn. **The lowest priority:** skipped (not
queued) while any line of his is up, and a new priority below LOW in the speech rules (`CHATTER`): any other line (a
slow move's, his ultimate's, a board's) cuts in on it, so those always come first. Estimates: on four boards he moves
about once a second, so a line every 6 to 10 s when nothing else is said, the middle from about half a minute in, the
late after about a minute.

**Phase 2's slow moves, reworked (Eric, Oct 14, after playtesting; same PR, the same files).**
- **The ultimate at 10 of 10:** `slowMovesForUlt` is 10 (was 5, firing on the 6th). Still one shared team counter, one
  per slow move as it's made; now the 10th brings it (`>=`, not `>`).
- **The marks beside every board** (`SlowMarks` in `screens/Recluse2.tsx`), as Jefferson's candle shots stand beside
  his board ("it fits the theme of the other boss"): ten slots, a red pixel X for each slow move, the rest dim, a small
  "slow" label. A column by the right edge of each of a computer's four boards (in the gutter, never over a board) and
  of a phone's big board; a phone's three small boards have no room beside them, so a row above each. Eric: no turtle,
  "something basic... doesn't distract too much, but it's clear to everyone playing". The dock's "slow moves N of 5" is
  gone (the dock keeps your clock).
- **Each slow move:** a soft sound (`recluseSlow`: two low notes falling, D to A, quick plucks with a little of their
  octave so a phone's speaker carries them, well under a move's loudness, made ahead in the sound worker: never a
  buzzer), the marks of the board it was on flash red for 1.8 s with a small "slow move" note over its top-right corner
  (my call: a note on the board says which board without numbering them, and a dock note didn't fit a phone's line),
  and his slow-move line as before (not on the 10th: his ultimate's line then).
- **The ultimate's banner** ("5 SECONDS!") over every board at the same moment: over the four on a computer, over yours
  on a phone with "5 s!" across each small board. Nobody is paused; everyone whose move it is gets a fresh, full 5 s
  from that moment (`phase2Ult` already restarted them; now tested), however long they'd thought.
- **That banner is held 1 s longer** (`PHASE2_ULT_BANNER_MS` 2.8 s): `FightBanner`'s new `long` option, the same
  entrance and exit with the hold a second longer (its own keyframes, 2.5 s). Every other banner keeps its timing.

**His bubble over the boards in phase 2** (Eric, Oct 14: a long line, the Weaver Adams quote, was cut off and covered
by the boards). Each board now keeps its own layers to itself (`isolation: isolate` on a phone's small boards and a
computer's four), so his bubble sits over every board; it already wraps within the screen (at most 220 px or 60% of
the width, moved back into view if it would run off). Measured with the longest line on a 390 px and a 360 px phone and
at 1280 and 1024 px: nothing covers it, all of it on screen.

**Measured** (the slow-phone perf case, `e2e/perf.spec.ts`, 4x CPU throttling, three runs each on this machine):
- Before, on a quiet machine (origin/main, 3 runs): the phase change p95 33 ms, 5 to 8% of frames dropped; four
  boards in play 2 to 3%.
- A/B, alternating runs of main and this branch while other sessions' engine sims loaded the machine (load 6 to 11 on
  4 cores; main failed its budget too then), six runs each: the phase change main 17, 10, 10, 16, 20, 22% dropped
  (p95 33 to 50 ms), this branch 16, 14, 9, 15, 12, 22% (p95 33 to 67 ms); four boards in play main 14, 11, 15, 22,
  19, 22%, this branch 15, 13, 22, 17, 18, 20%. So no worse than main under the same conditions. The light's layers
  move only their opacity and transform, his figure carries no filter, his frames are drawn ahead from his battle's
  start, and each board's slow marks are drawn again only when their count or flash changes. A run on a quiet machine
  is still to do (the budget, 15% dropped and p95 under 50 ms, holds only there, as for Big Boy's check).

**Testing.** Targeted lane (animation, art and lines, and one rule number: the ultimate's threshold): typecheck, the
app's unit tests
(`recluse-phase2.test.ts`: the timeline's beats and length, one book in every frame, the leap's shadow and dust, the
lines' rules and quotes, the collusion stages, intervals and priority, his moves counted, the slow moves' boards and
the 10th bringing the ultimate; `recluse.test.ts`: every new
frame inside its frame, the cues; `recluse-boss.test.ts`: a recluse sound for every cue, the new sounds under a move's
loudness); the rules' `packages/chess/test/recluse-phase2.test.ts` (the ultimate at 10 of 10, a fresh full 5 s for
anyone mid-move); e2e `recluse.spec.ts` (the phase change's every beat watched from before it can show, no second
book, his place empty only while he's on the board; ten slow moves marking every board, the note, the sound, the long
banner at 10), `boss-character.spec.ts`, and `perf.spec.ts`'s phase 2 case. Frames:
`npm run frames:recluse2 -- <dir> both light only=change`.

## Squads: jump to my next board, and who's watching (Oct 14, 2026)

**What (Eric, Oct 14):** two things for the Squads match screen. **Jump to my next board** (Relay): "a button toggle
with an info thing; enabled it moves you instantly to the next board, waiting and watching, with it off you wait
until forced. It should be on by default." **Who's watching** (every Squads match board): "your pawn pieces stacked
above the board for who is spectating the board with like a spectate eye icon." Eric also decided that viewing boards
after you've moved stays free, helping teammates included ("it is squads after all"); whether to limit viewing a
teammate's board while they're still to move is an open question for players (ROADMAP.md, Squads).

**Calls:**
- **The switch** sits on the match screen only (Relay, in the panel after your move's panel, so it never pushes the
  move or Block down), not in Settings: one place, in view when it matters. "Jump to my next board" with an (i) that
  opens one line: "On: once you've moved, you go straight to the board you play next turn, to study it while you wait.
  Off: you stay on your board until the game moves you." On by default (`SQUADS_LOBBY.watching.jumpToNext`),
  remembered per device (`brc.squads.jumpNext` in prefs.ts, try/catch).
- **The jump comes 600 ms after your move** (`jumpAfterMs`), not in the same frame: until the half ends your move shows
  only on your own big board (the tiny boards show the server's position), so an instant switch would hide the piece
  you just moved. A board you open yourself in those 600 ms wins. It comes once a half; "Back to my board" stays.
- **The board to study** is next turn's; if that one has finished (you'd sit that turn out and scout it), the first
  board after it that's still going, the one you'll actually play next; if none but yours, you stay. The line above
  the board says "Watching Board 3 · your next board".
- **Who's watching** shows people only (bots never view), never you and never the board's own players this turn: a
  small pixel eye, then up to 4 profile pawns (`Avatar`, with their items), overlapping, then "+N"; names on hover
  (a title), nothing on long-press. Each pawn is the watcher's color on that board (white for someone outside the
  match). The pawns spill a little above and below the line over the board, so the line keeps its height and the
  board doesn't move as people come and go.
- **The protocol** gains `view` (the board a screen shows full size, sent only when it changes: a tap, the jump, Back,
  a new half; again after a reconnect) and `viewers`, optional both ways, so `SQUADS_PROTOCOL` stays 7: an app on
  either side of the deploy keeps playing, and one that never sends `view` simply isn't shown.
- **Each screen hears only about the board it shows** (not every board to everyone): who's on it, when that changes,
  and the whole list when it has just moved there; at most once a second per screen (`coalesceMs` 1000, twice the
  brief's example: who's watching doesn't need to be quicker, and it halves the worst case on a slow phone).
- **Only the pawns redraw** on `viewers`: the client tells them alone (`onViewers`), never the whole screen, and each
  pawn is memoized. Views are kept in the lobby's record (a view change is one storage write, like any message).

**Measured** (a local server, a full 32-seat test lobby, main first and then this change; the frames on an iPhone 13
profile with the CPU slowed 4x):
- **Messages, per player per minute** (3 minutes of Relay): 32 people each doing what the screen does with the jump
  on (their board when a half asks them to move, the next board 600 ms after their move: about 6 view changes a minute
  each): main 356 → 376 messages (+6%), 194.6 → 196.4 KB (+1%); `viewers` 19.6 a minute each. The first version
  (every board's changes to everyone) sent 101 a minute each: telling each screen only about its own board cut it
  five-fold. 4 people and 28 bots, each switching every 3 s: 210 → 234 (+11%), `viewers` 24.8. One client spamming 10
  switches a second: 42 `viewers` a minute each (the cap is 60). Each view change is one write of the lobby's record,
  as for any message.
- **Frames, share over 20 ms** (12 s windows, two runs each; a shared machine, so a few points of noise): nobody
  switching, the same (main 2.9-5.2%, the branch 2.8%). Three watchers each coming onto and off your board every 5 s:
  1.1-2.1% → 4.2-5.0% on your board, 0.6% → 1.0-1.9% on your next board; every 2 s (the one-a-second cap): 1.5% →
  4.8% and 0.4% → 2.7-3.2%. p95 stays at one refresh (16.8 ms) in every case. One change of the pawns costs a slowed
  phone 10-15 ms (median; 40-50 ms at worst), almost all of it a dressed `Avatar` being drawn (a plain pawn: 2 ms),
  and only when someone comes or goes; on a real board that's a few times a turn. Before the pawns redrew alone (a
  `viewers` message redrew the whole screen) the 1-second churn cost 17-20%.
- **Narrow phones:** at 360 px and up the line over the board stays one line with four pawns and "+2"; at 320 px the
  longest Relay line ("Moved · Board 1 · waiting for the half to end") wraps under the widest stack and the board moves
  14 px (as a long block banner does today).
- **Frame by frame** (`npm run frames:squads relay`, light and dark): the piece slides once, then the board switches
  once 600 ms later; nothing snaps back, no flash.

**Player-visible text:** "Jump to my next board", its (i) line above and the (i)'s label ('What "Jump to my next
board" does'), "Watching Board N · your next board", the pawns' hover "Watching: Pam, Quinn" (and "Watching this
board: …" for screen readers), "+N", and the FAQ's Relay line.

**Testing.** Full lane (a client-server protocol change): typecheck, the whole unit suite (new: the board to jump to,
finished boards included; who's watching on the server: a board shown, switching, nobody, only your own board's news,
a burst coalesced, views naming no board, disconnecting, coming back, leaving, an app that never says; the switch's
default and storage; the FAQ line), e2e `e2e/squads-watch.spec.ts` (the jump on by default and off, remembered; a
second player's pawn with the eye over your board, the board not moving, gone when they look away or disconnect),
`squads-play.spec.ts` and `squads-v2.spec.ts` adapted to the jump, and the whole e2e suite.

### The Hidden Boss's slow moves: once, beside your board (Eric, Oct 14, 2026)

Eric, after playing it: "Why show the same slow moves 4 times each player just needs to see one on the right of their
board since they all are the same total right?" The count is the team's, so the ten marks now show once: a column by
the right edge of your board (on a phone, the big board, yours or the one you're watching). The small boards and the
other three on a computer show none. The marks flash at every slow move, whoever's; the short "slow move" note still
sits on the board it was on, so you see which board was slow.

## The Hidden Boss after Eric's playtest: no strikes, a try spends its charge, one quote gone, 1+0 then 1+2 (Eric, Oct 14, 2026)

Eric played phase 1 on Oct 14 and asked for four changes. Same reach as before: admins only, in Boss alone; no
protocol or stored data changed (online can't meet him: the new event kind and rule are the shared runner's, as his
others are).

**1. He never strikes the crowd** (my call; Eric: "I'll leave you to that").
- Every boss knocks out the crowd's worst mover every `bossKillEvery` (3) moves while more than its minimum is left,
  and its intro says "Worst mover struck every 3 moves." Eric saw it in his fight and wasn't sure it belonged. It
  doesn't: his real fight is a squad of four, who must all reach phase 2's four boards.
- A per-boss rule, `BossRules.noStrikes` (his only): the runner's `bossKillDue` is never true for him (solo, the server
  and the sims all ask it), the screens get `strikeIn` null, so his card says "Move N of M", and his intro's second
  line is empty instead of the strikes line. Other bosses unchanged (a unit test runs a crowd of five against him and
  against Boingo: no knockouts for him, Boingo's at moves 3 and 6, the card counting down).

**2. The Weaver Adams line is gone** from `boardWon` (Eric: "it doesn't fit the rest"), with its source note. His board
win lines are the two placeholders. Nothing else referred to it but its test (now: no Weaver Adams anywhere in his
lines). Its research entry stays in "The Hidden Boss, phase 2" as a record.

**3. The God King's help tried against him spends the charge** (Eric: "using the king's move doesn't draw down on the
usage vs him like it should").
- Tapping "Play move" or "Strike" is still blocked and mocked as before (the slam, his line, the God King's), and now
  uses up that charge as if it had worked: the runner's `kingTried` (one charge a try; none left, nothing), called by
  solo's `callKing`, which the dock now calls after the mock. The crowns go down; with none left the God King can't be
  called, as against any boss. Phase 2 too (the same dock, the same charges).
- **My calls:** a blocked try leaves your move yours (he played nothing; the clock runs on), and a second try in the
  same move spends another charge (each try is a use; no new state to track). `kingMoves` and `kingStrikes` stay empty
  (he never acted). The Last Stand isn't a player's action: unchanged, it never comes and spends nothing.
- Online can't meet him: `NetMatch.callKing` sends nothing for him (no server path takes such a try), as before.

**4. The bullet clock: 1+0 for three moves, then he adds 2 s a move** (Eric: "1 min too short, needs to be 1+1 or even
1+2... a few moves, say 3, with 1+0, then he says a comment about it and suggests adding time per move, then a banner
or just text on the center of the board that says time being added per move").
- After his ultimate (the 1:00 bank, as before), the crowd plays `BOSS_POWERS.bulletPlainMoves` (3) moves at 1+0. As
  the next crowd turn begins, his moment `bulletPlus` (a new event kind, once, from his rules' `everyTurn`): where he
  stands he consults the book and says one grudging line (new placeholders, `RECLUSE_LINES.bulletPlus`: too fast even
  for real chess, time per move then; one hints that the clock that adds time per move was his own idea, never as a
  quote, and no number in the lines), then clean text across the middle of the board, "+2 s a move from now on"
  (`.rc-plus`: a dark band, white text sized to the board, fading in and out; not a FightBanner), from 0.5 s to the
  end of the moment (2.8 s, `RECLUSE_FX.bulletPlus`). The dock's word for the moment is "+2 s a move".
- From then on each move made in time adds `bulletIncrementSeconds` to that player's bank. **2 s** (the director's
  pick: Eric said 1+1 or 1+2; 1:00 felt too short, so the more forgiving one; one setting). It's the game's usual
  increment: the runner's round settings give the bullet clock that increment (`bulletIncrement`, from the turn and
  `ultAt`), so a move may take the bank plus 2 s, and the bank after it is the bank plus 2 s less the time taken; a move
  not made in time empties the bank, and the battle is lost on time as before. No cap on the bank (none existed for
  bullet): the per-move cap is set where no bank can reach it (the bullet bank plus the increment on every move a
  battle can have), so the bank decides.
- The dock shows the time control once it applies: "Bullet 1+2 · 0:41 left" (before it, "Bullet · 0:41 left" as now).
- **The clock still only counts your own thinking:** his moment is a power's moment like any other (`POWER_FX`), so
  the crowd's clock starts after it, as it starts after his move, his thinking and every reveal.
- Settings in `packages/core/src/settings.ts` with comments; estimates, not sim-tested.

**Testing.** Targeted lane (rules touched, so the whole unit suite): typecheck; unit
`packages/chess/test/recluse.test.ts` (no strikes against him and Boingo's as before; a try spends a charge, one a try,
none left nothing, phase 2's too, another boss's untouched; three moves at 1+0, his moment once as the fourth begins,
+2 s a move made in time, the bank growing past 1:00 uncapped, out of time still loses, the rule's numbers, the moment's
length in the boss's turn show), `packages/app/test/recluse-boss.test.ts` (the moment's line, priority, text, dock word
and timing; "Bullet 1+2" from the right turn; no Weaver Adams; solo's `callKing` spending a charge a try and leaving
your move yours); e2e `recluse.spec.ts` (no strike text from the intro on; the dock's crowns 3, 2, 1 in phase 1 and 3, 2
in phase 2; three moves at 1+0, his line, "+2 s a move from now on" only while the boss screen holds, "Bullet 1+2", the
bank after a move exactly +2 s less the time taken), `matchmaking.spec.ts`'s Solo raid (another boss's card still says
"Strikes in…"), `king-attack.spec.ts`, `boss-speech.spec.ts`, `resign.spec.ts`. Frames: `npm run frames:recluse --
<dir> both light only=plus`; the dock's "Your move. Bullet 1+2 · 0:59 left" measured whole in its two lines at 320,
360 and 390 px, and the band on the squares exactly.
- **A test fix on the way** (`recluse.spec.ts`, phase 2's slow moves, from #208): it failed on a computer, on main too.
  The bots' slow moves can bring his ultimate during the 5.4 s the test thinks, and then its own move can't add one; the
  test now stops counting once the ultimate has come by the time it moves.

### Maia's loading step (Eric, Oct 14, 2026)

On Eric's iPhone 15 (Safari, Wi-Fi) Maia failed to load in every normal boss battle and loaded with `?win=1`, where
almost nothing else runs; with #209 the admins' line said why: "failed: Stockfish (load failed: no available ba…",
onnxruntime-web's "no available backend found. ERR: [wasm] …", which on iOS Safari usually means its WebAssembly memory
couldn't be made. Eric: "We just need to add a loading bar... 'loading components' or something. People can deal with
it if they need to wait 5 or 10 seconds." Then, Oct 14: tell players about the download, quick and simple. My calls:

- **A loading step before the intro, solo only** (Boss alone, a Solo raid, the Crowd's boss battle in Solo: wherever
  `startBrain` puts the boss on Maia). The boss screen holds the intro's first frame under a card on the board, the
  intro card's backdrop with no entrance: the boss's portrait, **"Loading the boss…"**, a bar, under it "12 of 40 MB"
  while the files come down with **"First time only: about 40 MB, then it's saved on this device."**, then
  **"Starting…"** while Maia starts, and **Leave** (home; before move 1 only: in the Crowd's battle leaving is
  resigning, which stays the top line's, with its confirm). Then the intro as before; its card takes over from the
  step's without an entrance, so the board never shows between the two dark cards. The boss's figure rests (a
  `loading` stage: its idle loop, no line); its entrance is the intro's.
- **Stockfish stops, it doesn't only idle.** Each Stockfish worker on the device (the pool the app starts as it opens,
  and the engine of its own if one was made) ends once the work already asked for is done, so its WebAssembly memory is
  freed; anything asked for meanwhile (the intro's eval bar, a hint, the Engine move's search, the boss's move) waits in
  its queue; fresh workers start, set up as before, when the step ends (`UciEngine.pause`, `pauseEngines`). Maia's
  worker starts at once, but its model loads only after Stockfish's workers have ended. Stopping is simpler than
  re-ordering the app's start (the pool is made as the app opens, for every mode) and frees the same memory. Online is
  unchanged (other players can't wait on one device; the protocol isn't touched).
- **One retry.** A load that fails short of memory or with no backend ("memory" or "backend" in its reason) is tried
  once more from a fresh worker, with Stockfish still stopped; any other failure (a missing file) isn't.
- **Never stuck.** `BOSS_BRAIN.loadGateMs`, 20 s from the step's start (download included), is the most it waits; then
  the battle begins whatever happened: Maia not ready yet loads on and takes over once ready (Stockfish's moves until
  then), as before the step. 20 s: on Wi-Fi a first download takes a few seconds and the start a second or two (Eric's
  5 or 10 seconds), and a slow connection gives up rather than hold a player. If a fresh Stockfish doesn't answer within
  `stockfishBackMs` (15 s) after the step, Maia is closed and Stockfish started once more: a battle needs Stockfish,
  not Maia.
- **The bar** counts the bytes the page reads (the menu's prefetch, else the step's own) against the three files'
  sizes, written into the app by its build (live, the worker and the WebAssembly come compressed with no length the
  page could use; a response's own length when it isn't compressed; a sliding bar when neither is known). Files the
  service worker already keeps aren't read again (the prefetch used to read all 40 MB every time it ran), so a later
  battle goes straight to "Starting…". The download is counted in the files' own size, 40 MB (`BOSS_BRAIN.downloadMb`,
  checked against the files by a test), which is what's saved on the device; over the network it's about 29 MB (the
  WebAssembly comes compressed), so "about 40 MB" never understates it.
- **Maia's memory, in the box.** onnxruntime-web 1.30's only WebAssembly build is the threaded one (we run one thread),
  so its memory is shared, and it asks for a 4 GiB maximum. A shared memory reserves its maximum up front, and iOS
  Safari can refuse that much, more readily with Stockfish's memories already reserved beside it, which fits Eric's
  `?win=1` loading and normal battles not. The box now caps it at 512 MiB while the session is made
  (`MEMORY_MAX_PAGES` in `packages/maia-worker/src/model.ts`); the model uses about 70 MB of it (69 MB after loading
  and after 20 moves, the same, in Node), and works the same in Chromium. A load's error now comes whole and on one
  line (`errorText`: its kind, message and cause), and a phone's admins' line wraps instead of cutting it (a computer's
  pill stays one line in the title line, so the boards below never move, with the whole text on hover). Verified in
  Chromium and Node only; only Eric's iPhone can say which of the three (the cap, Stockfish stopped, the retry) did it
  (TESTING.md, "Maia").
- **The admins' line** says more: "loading (waited 20 s)" when the step gave up, "… (2nd try; the 1st: <reason>)" after
  a retry, "Stockfish (Maia closed: Stockfish didn't start again beside it)" after the last resort.
- **Measured** (Chromium, the CPU slowed 4x, a local server): the step took 3.6 s the first time (the download 2.3 s,
  Maia's start 1.3 s) and 1.2-1.3 s after that (a quarter second looking in the cache, then "Starting…"); unslowed in
  the e2e, 2.3-2.8 s the first time. A boss intro on a slowed phone (`perf.spec.ts`, Big Boy's snack, one run each):
  main p95 33.4 ms, 13% of frames dropped; this branch p95 16.8 ms, 2% (twice): the intro no longer shares the phone
  with Maia's load. The other perf cases within their usual spread.
- **The FAQ** (Brain 2) says why Maia (a human-like engine, so a boss plays more like a person than Stockfish does),
  that it's a bigger download, about 40 MB, fetched once and kept, and that on a slow connection or if it can't load
  the boss plays Stockfish; its rule 4 now says a Solo or Boss alone battle waits for Maia, 20 s at most, and online
  nobody does (it said nobody ever waits). Numbers from `BOSS_BRAIN`.

## The Hidden Boss absorbs the God King (Eric, Oct 14, 2026)

Eric's idea for phase 2's story: there the Hidden Boss plays with Stockfish, which clashes with his anti-engine
persona. So he **absorbs the God King** (the players' engine helper, whom he mocked all through phase 1) and becomes
**half engine**, "brain and engine combined": the God King, stronger than every boss, is finally overpowered. Eric on
the look: "if we can avoid doing any sort of changing to the sprite and just do an overlay, that would be sick"; on the
arcs: "not like the ones we had earlier used in this game; they need to be a bit smoother looking"; on the whole: "it's
supposed to be this epic thing" (about 15 to 20 s). Same reach as before: admins only, in Boss alone; no rule,
protocol or stored data changed.

**The sequence** (`PHASE_CHANGE` in `packages/app/src/recluse-phase2.ts`; ms from the phase change's start, which
follows the 1.8 s fall; 14.8 s, so 16.6 s with the fall, was 10.4 s after it; not skippable, as before):
1. **The God King triumphant** (0 to 2.1 s): in his place in the dock (BossDock's new `king`, from `absorbKing`) he
   raises his sword (his `raise`, `raised`), his golden aura swelling behind him (CSS, `.gk-aura`), with his shout
   (`gkHyuah`) and a short gloat in his bubble. The boss is still slumped and mumbling.
2. **The boss seizes it** (1.7 s): still on his knees, his head snaps up glaring (the rage's first beat, moved here) and
   he raises his open hand to the God King (`seize`; then `seizeLoop`, his arm trembling, his teeth gritted).
3. **The drain** (2.14 to 4.29 s, `drainMs`: exactly the God King's Last Stand blows to his stagger): a golden stream
   from the God King into the boss's hand (`AbsorbStream`, over the page: a beam of two strokes, a wide soft one and a
   thin bright core, and 16 golden motes flowing along it, moved by transform; a glow gathering in the hand), under both
   their bubbles. The God King is drained through his Last Stand's blows, his own frames from the first blow (red-white
   flashes, his armor cracking at three points, his flame dimming), flickering more and more (CSS opacity) as his aura
   shrinks; his cry in his bubble, a grunt (`gkLastGrunt2`) and the drain's whoosh (`recluseDrain`, new).
4. **The power lands** (4.29 s, `igniteAt`): the boss's fist closes on it (`seized`, its spark `recluseSpark`, new), a
   cold flash in his hand, and his **half-engine look ignites** (a flare of the eye, the circuit lines drawn in); his
   line (4.41 s; NORMAL priority, so his chant cuts in on it at 7.93 s, after it has been up whole for at least 1.8 s:
   two CRITICAL lines would have held the chant's words back to the split, and his revive line after them). The God King staggers and fades up and away in light, five motes rising (`gkLeave`); **gone** at 4.99
   s, his last words still up beside his empty place until their time is over.
5. **Then the reworked change goes on**, 4.43 s later than before: up in a rage (4.89 s: off his knees, the book
   snatched, his fist), the leap onto the board (5.76 s; lands 6.44), the book brandished and thrown down (6.73), the
   chant and its light (7.93), the cracks (9.63) and the quarters parting (10.38) and growing into four boards (10.78 to
   11.68), the book back in his hands (11.78; the shuffle 11.93 to 12.83), the leap back (12.66; home 13.34), "PHASE 2"
   (13.44), the clocks (14.84).
6. **The arcs** (9.43 to 11.58 s, each gone 0.26 s later): blue arcs strike the cracks from his raised hands, about
   every 85 to 145 ms, and two big ones from both hands at once, out along the cross, as the board cracks and as it
   parts; a blue flash where each lands and a blue pulse on the board. One soft crackle under them (`recluseArc`, new,
   its two snaps on the big ones).

**His half-engine look** (the whole of phase 2 and the result screen after it, until a new battle): over every drawing
of him, the bust in a phone's bar, his figure by a computer's board, his figure on the board through the rest of the
change, the results: **his left eye (our right, the side towards the board) glows cold blue**, **faint circuit lines**
run from beside it up to his temple and down his cheek, with three bright pads, and **now and then it all flickers**
(twice, then steady for about five seconds). An overlay only (`EngineOverlay`, components/Recluse.tsx): a box his
drawing's size holding one his head's size, moved onto his head every frame by a transform (`placeEngine`, from where
the frame puts his head part: `headOf`, his shake included), so it sits on the eye in any animation of either drawing;
four elements, and only opacity and transform animate. It ignites only as it comes (`fresh`); a screen drawn later
shows it already on.

**The God King in phase 2: gone.** His place in the dock stays, empty (`king="gone"`: the dock doesn't move), with no
button, no charges and no words; his phase 2 lines (`KING_VS_RECLUSE.phase2`, `boardWon`, `boardLost`, `victory2` and
their cues) are removed, phase 1's kept. Nothing needed a voice for the team: a board's result is on its own tag, and
the boss has his line on it. This replaces #210's "a try spends its charge in phase 2 too" (Eric's own call here: no God
King buttons in phase 2); in phase 1 a try still spends its charge.

**Lines** (all PLACEHOLDERS, ours, in `characters/recluse-lines.ts`; nothing presented as his words):
- His, as the power lands (one, by the phase change): "All game you leaned on an engine. Now see how you like it.",
  "Mind and machine. Both mine now." ("A Beautiful Mind" is the title of the film about John Nash, so it isn't used.)
- The God King's triumph (short: his cry cuts in about two seconds later; a new cue kind, `lead`: always said, but a
  critical line cuts in on it): "Kneel. The crown always wins.", "Down you stay, bookworm!", "Your book is closed.
  Kneel!". His cry as he's drained: "No! My light... what are you doing?!", "Release me! That power is mine!", "Aaagh!
  My strength!".
- Phase 2's chatter mocks the engine he took (`RECLUSE_LINES.engine`): every third line of his chatter, from the
  first, in turn, the lowest priority as the collusion lines: "Fun, isn't it?", "Look how much fun we're having.",
  "Not so nice when the engine's on my side, is it?", "Go on, call your God King. Oh, that's right.", "Every line,
  every move. I see them all now."
- Screen text (admins only): the dock's "The God King triumphs!", "He's draining the God King!", then "The boss rises!"
  over "Mind and engine, one." until his chant.

**My calls.**
- **The God King where he always is**, in the dock (by the board's bottom-right corner on a computer, under the board
  on a phone), not brought onto the board: his figure is already there, and the stream then crosses the board from him
  to the boss (on a phone from the dock to the bar above the board). The stream leaves him sideways and low and rises
  into the hand from below, so it never runs through either bubble; it's drawn under them.
- **His drained look is his own Last Stand frames** (Eric: no new God King frames needed), timed so their stagger comes
  as the power lands: the flashes and cracks read as his power being torn out. The aura, the flicker and the fade are
  CSS over his figure. Those 59 frames are drawn ahead from the battle's start (`prewarmKing`, about 4 ms a frame of
  work): on this machine each takes about 2 ms to draw, a new one every 30 to 50 ms through the drain, which a slowed
  phone would feel.
- **The boss's raised hand and fist are new frames of his** (3 short animations, 12 frames, from his existing parts:
  kneeling, the open palm of his chant, his fist), not an overlay: the overlay rule is for the half-engine look. They
  make the seizing read; the rage starts from his knees after them, as before.
- **The arcs:** a midpoint-displacement path (jagged in the small, smooth in the large) drawn as curves through the
  points' midpoints, so no sharp zigzag; a thin bright core over two soft glows (wide translucent strokes, no filter),
  blue enough to read on the light squares; each shape redrawn every 70 ms of its 260 ms. One SVG over the board.
- **The God King's figure in the dock is no longer a button in the phase change and phase 2** (it wasn't callable in
  the phase change before either).

**Measured** (the slow-phone perf case, `e2e/perf.spec.ts`: an iPhone 13 profile at 4x CPU throttling, `?phase=2`, the
whole phase change, then eight seconds of four boards in play; runs of this branch and main alternating, on a quiet
machine, load 0.7 to 1.8):
- The phase change: this branch 9.6, 8.4 and 6.2% of frames over 20 ms (p95 33.3 to 33.4 ms, the longest 233, 167 and
  150 ms); main 5.0, 5.9 and 5.5% (p95 33.3, the longest 233, 183 and 200). A point or two more dropped frames over a
  change half again as long (14.8 s against 10.4), within the budget (15%, p95 under 50 ms), p95 the same, the longest
  frame no longer. (The first run predates drawing ahead one slice at a time; with `?phase=2` the drawing ahead runs
  during the change itself, which in a real fight it never does: it's done in phase 1, minutes earlier.)
- Four boards in play: this branch 1.7, 1.3 and 0.6%, main 1.9, 0.6 and 0.6%: the same (the look over his figure costs
  nothing that shows).
- Drawing the God King's drained frames on the spot costs about 2 ms each on this machine (unthrottled), so they're drawn
  ahead; the stream's motes move by transform only, and the arcs are one SVG of a few strokes, no filter.

**Testing.** Targeted lane (animation, art, lines and the God King's presence; no rule changed): typecheck, the app's
and the chess package's unit tests; `recluse-phase2.test.ts` (the timeline's beats, order and 15 to 20 s length, the
figure run's steps landing on the beats, the God King's look at each moment and gone for good, his triumph giving way
to his cry, the arcs on the cracks with their big ones, the lines, the God King silent in phase 2 through SoloMatch's
own phase 2 moments, the chatter's engine lines), `recluse.test.ts` (the seizing frames' cues, kneeling, the hand
inside the frame; his head found on every frame of either drawing with the engine eye on his eye's pixels; every frame
inside its frame); e2e `recluse.spec.ts` (every beat of the absorption watched from before it can show, the arcs, the
look on his figure on the board and where he stands; in phase 2 no God King button, figure or word), `king-attack`,
`boss-speech`, `perf.spec.ts`'s phase 2 case. Frames: `npm run frames:recluse2 -- <dir> both light only=change`.

## The engine reader: a slot's last exact line may name another move (Oct 14, 2026)

**What:** The code that reads Stockfish's output (`searchLines` in `packages/chess/src/uci.ts`, and the same function in
`engine/server.mjs`) reads each MultiPV slot's last exact line, as before, unless that lists a move twice. Then it lists
each move once, with the numbers of that move's own latest exact line; the moves listed are the ones in the last line
printed for each slot (bound lines included), in the slots' order. Eric approved the fix ("Engine fix is a go").

**Why:** Stockfish re-sorts its lines as it goes deeper, and a search that runs out of nodes partway through a line
prints that slot as a bound. The slot's last exact line was then from the depth before, and it often named the move
that had since moved to another slot. One move came out twice (with an out-of-date number) and another not at all.
Measured: about 19% of the judge's top-8 searches (lite build, 250k nodes, 800 searches), 6.7% of device re-checks
(700k, 3 moves), 5 to 6% of the engine server's re-checks (native 17.1, 400k and 2M, 4 moves), 2.2% at 20k nodes with 2
moves. Players felt it as silent misgrading: a duplicated move's out-of-date number (5 points or more off in about
1.75% of top-8 searches, up to about 35), a board's best move missing from the top 8 (about 0.5%), and a re-check
quietly ignored when the best move was the one left out. The castling move in the first report was a coincidence.

**Only broken searches change:** a search with no move twice reads exactly as before, by construction (checked on the
raw output of 1,000 saved searches: lite top 8 at 250k, single lines at 250k, re-checks at 700k, the server's at 2M).
A first version also re-read a search whose last line was a bound naming another move (about 2 single-line searches in
100), with that move and an older number; it was narrowed so those keep their old reading.

**Kept as safety nets:** `scoreMoves`' fallback for a move left out (`scoreAfter`) and Squads' `cleanTop` (keeps a
move's first line if it is listed twice).

**Rollout:** during a deploy, a device on the old code and one on the new can disagree on an affected search; the
lobby then asks a third judge and the engine server, as for any disagreement. Fine before launch.

**Before and after** (`reports/engine-reader.md`): the judge's accuracy doesn't change beyond noise (judge-accuracy's
positions re-scored with the fix: today's scorer's error −0.035 ± 0.022 points a pick). The boss's own Stockfish move
changes in 7 of 1,200 positions (+0.03 points a move). In paired raids (about 24 games a boss, each code), no boss moves
beyond noise; all together the crowd's score leans +0.05 ± 0.03 its way. Bosses keep their tuning.

**Testing.** Full lane (judging numbers on every device and on the server): typecheck, the whole unit suite, the whole
e2e suite. Unit: `packages/chess/test/uci.test.ts` (recorded lines where two moves swap slots and the search stops on
a bound; a search with no move twice reads exactly as before, a single line too; with a move twice, a move that has
left the lines is dropped).

### Engines' exits never reach the page: positions Stockfish refuses (Oct 15, 2026)

Another helper saw page errors `ExitStatus: "Y"` in `e2e/sawyer.spec.ts`'s errors check (4 of 40 runs on main, 2 of
80 on a branch from it), and asked whether #212's stopping and restarting of Stockfish's workers caused them.

**What it is.** Stockfish 19 (the stockfish.js build the game runs) checks each position as it's set up. One it refuses
("Unsupported position. WHITE has more than 8 pawns.", "King can be captured.", "Too many pieces for WHITE.", …) gets
"info string CRITICAL ERROR: …" and an `exit()`, and in a browser worker Emscripten throws its exit, an `ExitStatus`
(this build's minified class `Y`), uncaught; an uncaught error in a worker is reported in the page too. Reproduced in
Chromium against the worker itself: every refused position gives exactly `ExitStatus: Y` in the page, and nothing else
did (a worker stopped mid-search or mid-start, `quit`, `stop`, commands sent during a search, the next search sent at
once after a `bestmove`, a position with no moves, `searchmoves` with an illegal move). So #212's pause isn't the cause:
stopping a worker throws nothing. The engine answers on afterwards, but its last position stays set (the refused one
isn't), so a search for a refused position answers for another one ("Sawyer, built" saw it hang in Node, where the
exit ends the process).

**Where the spec's errors came from: not found.** With every position the engine was asked about checked (a refused
one logged with its caller) and every worker's error and complaint caught, 80 runs of the spec's tests as on main (60
across its three, 20 more of the split's) never sent a refused position or ended a worker, and the match runner made
none through 120 Sawyer battles (and 30 of each other boss) on a stand-in engine that checks every position it's
handed. Reading the code found one game path that can make one, Sawyer's split beside a promoted piece (below), which
can't come in the spec's first moves. So the cause of those page errors stays open; both nets below keep it from a
player whatever it was.

My calls:

- **Positions Stockfish refuses are never sent.** `stockfishRefuses(fen)` (`packages/chess/src/uci.ts`) holds its
  rules, measured against the build: one king a side; no pawn on the first or eighth rank; at most 8 pawns a side; no
  more pieces than promotions could have made (beyond a queen, two rooks, two bishops and two knights, no more than the
  pawns missing; bishops' colors don't count); the side not to move not in check; an en passant square on the sixth
  rank with White to move, the third with Black; at most four castling rights it can read. Move counters and castling
  rights a position can't have, it ignores. `UciEngine` checks before every search: a refused position gets no lines
  (as a position with no moves; scoring, no scores), and a move at a strength throws, as "no move" does. Every caller
  already handles both (the boss falls back to the first allowed move, the eval bar keeps its last value).
- **A worker's error stays in the worker.** Stockfish's workers and Maia's handle their error event (`preventDefault`):
  whatever ends a worker's program, nothing reaches the page as an error of its own (Stockfish's: a console warning;
  Maia's already failed Maia, and the boss plays Stockfish).
- **Sawyer's split counts promotions.** `splitRoom` also counts his promoted pieces: with seven pawns and a second
  queen he has no room (an eighth pawn would make more pieces than promotions could). It's the one game path found
  that could hand Stockfish a refused position.
- **The spec's moves don't lose.** Its quiet fallback could walk into a quick mate, and taking every pawn of his it
  could sometimes lost the battle before the split came (flakes on main too). Its moves now come from the engine's
  ranking for the crowd (`engineTop`, the judge's, Sawyer's limits kept): the wanted move if it's within a tenth of
  the best's expected score, else the best quiet move that is, else the best; while it waits for the split (now up to
  20 crowd moves, was 14), a pawn of his taken if that's within a fifth of the best, else the best move. The first
  move stays quiet (the knock test). The board saw's dots check is skipped when no piece has moves both across the
  middle and not (a position now and then). A last test sends a refused position to a worker on purpose: no page
  error, and the engine answers on.

## The boss dock after Eric's Hidden Boss playtest: the board's width, your clock, the God King's "can't" (Eric, Oct 15, 2026)

Eric played the Hidden Boss on his iPhone 15 (Oct 14-15) and reported four things about the box under the board.

- **The lone big number wasn't the countdown misfiring.** Eric: "just the big one popped up for a second, and I
  definitely had more time", around moves 12 to 15, while spamming Engine move; his screenshot of the same battle shows
  "Bullet 1+2 · 0:20 left" at move 20. Every turn's deadline is the bank plus the increment, set as the turn starts, and
  the big 3-2-1 and the dock's time both read it. A unit test spams Engine move at every moment through the bullet's
  1+0 and 1+2 moves and checks, every 50 ms, that the count only shows in the bank's own last 3 s
  (`packages/app/test/boss-clock.test.ts`). Five browser runs found nothing either, spamming real Engine move taps with
  instant and slow answers, a 4x and 6x slowed CPU, the test switch and the natural turn-7 bullet, and an observer on
  every `.cc-num` inserted. What fits all of it: the bullet's first three moves are 1+0 (60 s, nothing added). Think
  through them and you reach the first 1+2 turn with about 0 s, so that turn starts with what's left plus 2 s, inside the
  count. Its first frame shows one big number ("3" for 2.0 to 3.0 s, rounded up) and no build-up. It's gone a moment
  later when an instant Engine move goes in. Each instant move after that banks about 1.9 s, which takes about 0 s to
  about 0:20 by move 20, his screenshot. The countdown was right. Nothing told him his time was that low: the dock's
  "· 0:02 left" was small and muted, came after the words, was gone between moves, and was rounded down while the big
  number is rounded up, so the two read one apart. So the fix is the clock (below), and the countdown's logic stays as
  it is. The same test plays that path: 19.7 s on each 1+0 move, then a 2.9 s turn whose first frame shows a lone "3"
  and whose dock clock reads "0:03". Found on the way: Engine move waits for the judge's full search (the power-up
  hints'), and on a slowed phone that took 3 to 9 s of the bank a move. Fine for an admins' tool; a spammer under 1+2 can
  still run out.
- **Your clock, always there** (`DockClock` in `BossDock.tsx`): bold at the status box's right, on every boss battle's
  screens (every boss, raids, the Crowd's boss final, the Hidden Boss's phase 2, where it's your board's clock). It runs
  on your move and turns red in its last 10 s (`TICK_FROM_SECONDS`, when the ticks start). Once your move is in, it holds
  where it stopped, dimmed, through the boss's turn, its moments and the reveal, whichever screen shows it: one store per
  match, written as it runs. It reads m:ss in whole seconds rounded up, as the big 3-2-1 counts, so its 0:01 is the big
  "1". Under the bullet clock's increment, a move starts with the 2 s added (the runner gives a move the bank plus the
  increment), so as your move begins the number goes up by 2, a green "+2" rising over it for 1.6 s
  (`DOCK_PLUS_MS`). The words on the left drop the time ("Your move. Bullet 1+2"; phase 2's "Your clock m:ss" line is
  gone, its ultimate's line says "5 s a move, or a random one"). On a phone in phase 2, the big board's tag no
  longer repeats your clock over its corner, where it covered the a8 piece (Eric: "It's not in the right spot"). It's
  gone on your board and shows only the player's name on a board you watch. The small boards' clocks sit just above
  each board, off its pieces. A computer's four boards keep their name-and-clock tags. Light: the clock re-renders itself a few times a second;
  the screen around it doesn't. None during Lights out (its prompt takes the box, as it takes the arrows' room), the
  phase change, or before your first move of the battle.
- **The row is exactly the board's width, under its edges, on every screen.** BossDock measures the board as drawn
  (`.hb-container`, a whole number of device pixels) before the first paint and whenever it or the dock changes size,
  and places the row by it (`--dk-left`, `--dk-w`). One rule for every variant (the eval bar's offset, the scoreboard
  minimized, a short phone, phase 2's big board or its four), rather than a copy of each board-size formula. Copies
  would drift. On a phone the row had run from the screen's left edge to the God King, 24 px left of the board and
  40 px short of its right edge.
- **The God King on a phone: on a line of his own under the row, in its middle**, so the box has the board's whole
  width. His words and his menu open above the row (over the board's bottom edge, as they did beside it), never over the
  box. Absorbed by the Hidden Boss (phase 2), his empty place takes no line there (the row above doesn't move). **Where
  he goes is decided by the room there is, not the device** (Eric: "decide by available width"): beside the
  row when the screen's column has 66 px right of the board (his 58 px and a gap), under it otherwise. Side by side
  squeezes the box as soon as the board fills the column, and on a phone or tablet held upright it always does (the
  column is at most 560 px, so 768 px gives the same column as a big phone). That leaves him beside the row only on a phone
  on its side, whose board is held back by the height. A 768 px breakpoint was tried first: the screen's column clips
  anything outside it (the phone layout locks the screen with `overflow: hidden`), so he was cut off at 768. A computer
  (900 px wide and 600 tall) keeps him by the board's bottom-right corner as before, the row the board's width there too
  (it already was, within 2 px). Measured in `e2e/boss-dock.spec.ts` at 320, 390, 768, 844 × 390, 1024 and 1280 px:
  the row's edges within 1 px of the board's.
- **The words' room on a phone.** With the row the board's width and the clock in it, the « » are 32 px (were 40) and
  the margins a little less up to 420 px, the clock 17 px (15 px under 360). That gives the words what they had beside the
  God King, within a few pixels (320 px: 113 against 114; 360: 147 against 154; 390: 176 against 184). The Last Stand's
  short verdict ("Chances 55% → 12%") now shows up to 379 px (was 359), so its long one never loses its end at 360. On a
  phone, "Bullet 1+2" keeps together on its line.
- **Tapping the God King with no charges left** (with the Hidden Boss, your tries spend them): his soft "can't", two
  quick, muffled low notes falling, under a move's loudness, synthesized in the sound worker's table as the bosses' are
  (`characters/god-king-sounds.ts`, the `godKing` module in `boss-sounds.ts`, `kingCant`). Plus a tiny shake, dimmed a
  moment (0.4 s). Nothing else: no menu, nothing spent. His button now takes the tap when he has no charges (it said
  nothing before), labelled "God King: no charges left".

## The Crowd's boss final: always the Hidden Boss, the top 4 (Eric, Oct 14, 2026)

Eric: "that mode is always just versus [him], like the top four always battle versus [him]… instead of saying boss raid
it'll say hidden boss… That'll incentivize people to also want to pick that mode… you're always playing with three
other randoms." His name will change later; not now ("Hidden Boss" everywhere), but it comes from one place.

**The vote's option** (`bossFinalOption` in `packages/core/src/votes.ts`).
- Label: his roster name ("Hidden Boss"); icon: his (📕); blurb: "Top 4 team up against him" (the count from
  `crowdFinalists("boss")`). My call on "against him" rather than "against the Hidden Boss": the label right above
  names him, the winner's banner shows label and blurb side by side (his name twice), and a sentence without his name
  can't break when he's renamed ("against the A powerful foe").
- Its id ("boss"), its place (the middle) and the default (Team final) stay: options never move (Eric, Oct 13).
- With no `crowdFinal` boss in the roster, the card and the final fall back to "Boss battle" 👹 against a random playable
  boss, as before.

**Top 4** (`CROWD_KNOCKOUTS.boss`): the duel's cuts stopping at four, `[16, 14, 12, 10, 8, 8, 6, 6, 4, 4, 4, 2, 2]`
(13 cuts; the battle starts after move 22, was 20 for the top 10). My call: the same tail as the duel (8, then 6, then
4, one from each team a cut) rather than a single cut from 8 to 4. Every cut is the same number from each team, so the
four are two of each; in the battle they're one crowd.

**The rule: he's the Crowd's final for everyone, hidden everywhere else.** `BossDef.crowdFinal` on his roster line and
`crowdFinalBoss()` (`boss.ts`). The runner's `startBoss` meets him whatever boss was picked or met last (`bossId`,
`bossAvoid` don't apply there any more). He stays `adminOnly`: never random, never in a raid, never in a player's boss
menu, never from a lobby creator's `?boss=`. Tests: `boss.test.ts`, `recluse.test.ts`, `crowd.test.ts`,
`crowd-hidden-boss.test.ts`.

**One edit to rename him.** His `name` in `BOSS_ROSTER`. Screens find a boss's kit by the name they show, so a renamed
boss would have lost its kit: `bossKit` now falls back to the roster's `kit` for that name (`kitName` in
`characters/kits.ts`). The vote's card, the FAQ, the result lines and the menus already take his name from the roster.

**Online, phase 1** (the lobby runs his rules through the shared runner, as solo does). Piece by piece:
- **His brain:** decided as the battle begins (`bossBrainNow` → his fixed brain, Maia at its top, 2500, raw), told to
  the host, whose device plays his moves; his moves are asked at his fixed 2650 (Stockfish's while Maia loads, or if it
  can't run). The roadmap wants his moves from our engine server for "this fight": that's the Squads path, with its
  reward and fair-play review. This path has no reward, so the host's device (Eric's computing priorities: players'
  devices first); his server-side brain comes with phase 2 online.
- **No help:** the God King's move, strike and Last Stand never come online either (the runner's rules). A try
  (`NetMatch.callKing`, the existing "king" message) is never a turn, a strike or a tally on the server: it spends a
  charge (`kingTried`, #210's rule) and the move goes on. On main before this PR a "play move" call would have taken the
  caller's turn: nobody could meet him online then. The mock (the slam, his line, the God King's) plays on the device
  that tried; the others see the crown gone with the move's reveal. My call: no new message to show everyone the mock.
- **No strikes, the bullet clock and its increment (1+0, then +2 s), a loss on time:** runner rules, so the lobby's
  deadlines (`allowedMsFor`), banks and end follow. New: the results carry `timeout` (he won on time), read in the same
  event the battle ends (`bossTimedOut` stays off the stored state).
- **His lines and moments:** from the shared boss view, the same on every screen, as for every boss.
- **His collapse:** beaten, the lobby holds the board `RECLUSE_FALL_MS` (4.5 s) with a boss message marked `fall`, then
  sends the results; resigning meanwhile is "already out" (everyone is placed).
- **Protocol:** two optional fields, `fall` (boss message) and `timeout` (results). Nothing removed or renamed. An older
  app shows the fall as the board with the result in it, and the result without "on time".
- **Phase 2 is not online** (four boards online, his server-side Stockfish, its fair-play hooks: a separate, bigger
  build). Online, a phase 1 win ends the battle as the crowd's victory, as before phase 2 existed.

**Solo Crowd (you and bots): phase 2 runs** as in Boss alone, when you were one of the four (`phase2Follows`): you on
board 0, the other three finalists (their names) on the others (`phase2Mates`; fresh bots only if fewer than three
remain). The result screen keeps your place in the crowd ("2nd of 100") with "You beat Hidden Boss on all 4 boards!" or
"Hidden Boss won. You won N of 4 boards…". Out before the final, the battle plays out without you (no phase 2).

**No rewards from this path** (rewards only via Squads, ROADMAP.md). Nothing special is recorded: the final records
what any boss final records (your place, the cuts, the boss reached and survived).

**Also, on the way:**
- The battle's intro said "Ten of you vs the boss.": now "Four of you vs the boss." (from the count).
- The result's "A win on your record." went to places 1 to 10: now to those who fought (a raid's crowd not struck down,
  the Crowd's top 4), as the server's record already did.
- Online the vote's result now patches the app's settings as it does the server's, so the last cut names the right
  ending and the leaderboard's cut line follows the boss final's 13 cuts (a reload mid-match falls back to the queue's
  settings, as before).
- `?win=1` also works in a solo Crowd's boss final (a mate in one), to see him beaten there. New test switch
  `?weakbots=1` (solo, and a lobby you create; `WEAK_BOT_SKILL`): every bot plays loosely, so a test playing the
  engine's best move surely reaches the top 4. With the usual bots it didn't (8th in the first run): the strongest bots
  play the engine's move as often as a perfect player, and only two of each team get through.
- Settings' "How to play": "a boss battle (top 10 against a boss)" is now "(top 4 against Hidden Boss)", its counts from
  the settings. The FAQ: the endings name him; his own block (met only in the Crowd's final, no God King help, no
  strikes, the bullet clock, phase 2 solo, online a phase 1 win); his fixed strength and brain; the God King's section;
  "Still to come" no longer lists him among bosses without art.
- A player who met him in the Crowd records him as their last boss; the next random boss avoids him, which avoids
  nobody (he isn't in the draw). Not worth a rule.

**Player-visible text:** the card ("Hidden Boss", 📕, "Top 4 team up against him"), "Four of you vs the boss.",
Settings' "a boss battle (top 4 against Hidden Boss)", the FAQ lines above; the results' "A win on your record." for
raid survivors placed below 10th.

**Testing.** Full lane (the server and what it sends): typecheck; the whole unit suite; e2e `crowd-hidden.spec.ts` (new:
the card on a phone and a computer; solo through phase 2 with the finalists; online: his intro, four in the battle, a
God King try, his bullet clock), `formats.spec.ts`, `votes.spec.ts`, `crowd.spec.ts`, `recluse.spec.ts`, `maia.spec.ts`,
then the whole suite.
