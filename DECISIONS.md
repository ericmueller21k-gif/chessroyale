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

### Sawyer, a sprite preview (Oct 10, 2026)

A raccoon in a hard hat with a reciprocating saw, from Eric's reference, drawn so Eric can see him before deciding
whether to keep this boss (as with Big Boy's preview). Art only: no powers, rules, lines or sounds of his own, and no
entry in `packages/core/src/boss.ts`, so he never shows in a battle. His kit is `BOSS_KITS["Sawyer"]`, seen only through
the test link `?wip=1&kit=Sawyer`.

- **Art** (`characters/sawyer.ts`): about 73 x 69 px (with his halo) in an 83 x 73 frame, three-quarters on and facing
  our left as in the reference, light from the top left. A wide, low stance; a yellow hard hat with three ridges and a
  brim lower at the front; clear goggles over his mask (the far lens smaller), angry brows and a toothy grin rising to
  his near cheek; spiky cheek fur; a cream chest; white gloves; a big ringed tail curling up behind him; the saw held
  across him at about 14°, blade up to our left, as in the reference. The fur is the reference's warm grey-brown.
  - **Rigging:** the saw is painted from its angle, where its front grip is and how far the blade has slid out, and the
    gloves ride on its grips, so every saw pose is three numbers and the hands follow. The legs, arms and tail are
    painted from their points; every part is painted the first time it shows (`lazyParts`).
  - **No brand marks:** the saw is plain red and black. Its motor's vents are a grille of three short slits; a first
    try with three stacked dashes read like a letter, so it was changed.
  - **Clear goggles in pixel art:** a pixel can't show the face through tinted glass, so each lens is a grey rim with a
    glint, the face drawn inside it, and the brow fur above the mask white (raccoons have it), so the goggles read as
    clear and not as sunglasses at phone size.
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
- **Never above his hat:** nothing in any animation rises above his hat at rest (the hat's jiggle goes down over the
  goggles, not up), so on a phone he stays under the heading above the bar (a test checks every frame).
- **Placeholders for the preview only:** every moment plays one of his three animations (his entrance, move, check and
  victory the rev; a capture and a strike the saw down; the rest the idle), and his cues borrow quiet existing sounds
  (G-REX's fizz for the rev, Boingo's slide whistle for the swing, Ginger's crunch for the cut) because every cue must
  have one. No lines.
- **Portrait:** his hat, goggles and grin.
- **In the test link** he takes the place of every boss, but a battle is still that boss's: when Boingo's powers fire,
  the boss bar hides its character for the power's moment (as it always does) and Sawyer has no moment to play there.
- Tests: `packages/app/test/sawyer.test.ts` (a preview kit with no boss; never above his hat; the idle's buzz, swish,
  blink and smirk, silent; the rev and saw down's cues and where the cut lands; the portrait), plus the shared
  character tests.
