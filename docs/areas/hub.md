# The front door: home, queue, profiles

Lane: `hub`. Accounts and sign-in are on [accounts.md](accounts.md); matchmaking on [matchmaking.md](matchmaking.md).

## How it works today

- **The landing page** shows where online play needs signing in (`onlineNeedsSignIn` from `/api/auth/config`) and
  you aren't signed in: sign in, or play against bots as a guest (remembered on the device). An invite link shows it
  even to a guest. `?nolanding` skips it (tests). Guests play Solo and Boss alone.
- **Home** (built from the approved mockups in `docs/mockups/front-door/`): the mode picker (Crowd 50 v 50, Squads,
  Boss raid: Squads took Classic's spot, Oct 11; Classic still plays with `?mode=classic`), the Matchmaking row (Default,
  Bots off, Solo) with its ⓘ (with Squads picked: the Party button instead, see [squads.md](squads.md)), PLAY, "Play with friends", "Boss alone" (solo's
  boss menu), the coin pill, your icon, and the live line ("214 online · 9 matches running · 31 in queue") with the
  typical wait under PLAY.
  - **Phone:** one column, big tap targets, no sideways scroll at 320–430 px.
  - **Computer** (1024 px+): a side menu, the play column in the center, a side panel (playing now, global chat).
    From 1280 px the play column starts with the **live window**: the featured real match (a matchmade one, most
    people, then newest) or, when none runs, bot-match replays played on a shared clock cycle so everyone sees the same
    moment (`LIVE_WINDOW`; replays in `packages/app/public/replays/crowd-bots.json`, never fetched on phones).
    A computer's only (`LIVE_WINDOW_MEDIA`: 1280 px wide, 600 px tall, a mouse; never mounted on a phone or tablet)
    and always silent, whatever the sound setting (its board is `silent`; Eric, Oct 12).
- **The live line** is GET `/api/live`: polled every `FRONT_DOOR.livePollMs` while a front-door screen shows it, every
  `heartbeatMs` elsewhere (a match), never while the tab is hidden. The same request says you're here. Online = seen
  within `onlineWindowMs`. The numbers come from the live hub (see [ops.md](ops.md)).
- **The queue screen:** the lobby's seats fill on screen (people, then bots popping in after the fill time), the wait
  so far, "Switch to Default" in Bots off. The match starts in place.
- **Profiles** (yours and anyone's, by tapping a name): icon, name, rank (from the rating, `RATING_RANKS`; "Top N%"
  once `percentileMinPlayers` have ratings), the rating chart, stats (All, Classic, Crowd), recent matches, what
  they're wearing (drawn with the real item art), their quick-chat picks. A profile others see never shows an email,
  a sign-in method or anything not on the approved list; a banned player's says "Banned".
- **Light and dark:** follows the device until you pick (Settings); same layout and accents in both.
- **The eval bar's switch** (Settings → Playing, "Eval bar"; Eric, Oct 10): on by default. Off, no bar on any board
  (every mode: the play, reveal, vote, final and boss screens all use `EvalBar`, which draws nothing) and the board
  takes its room, centered, on a phone and a computer. Only in Settings, never on a board screen. Kept on the device
  (`prefs.ts`: `evalBarOn`, `brc.evalBar`; accounts keep no preferences). The value is still worked out (the God
  King's word on how it's going reads it). Each result records it (`results.eval_bar`: 1 on, 0 off, NULL from older
  apps), from solo's post and the online `hello`, to see later who turns it off and how they play.
- **Piece sounds** (Settings → Sound; Eric, Oct 11; all wood, Oct 12; the classics back as the defaults, Oct 12): a
  **Move sound** and a **Capture sound** picker, chosen separately, each option a radio (picking plays it) with its own
  ▶. Nine each, every one wood (Eric: "slightly different wooden sounds, not chips or clicks"). Moves: Classic knock
  (the default), Classic light, Classic deep, Classic soft, Light wood, Wooden tap, Bright wood, Ringing wood, Deep
  wood. Captures: Classic double knock (the default), Classic light double, Classic deep double, Classic soft double,
  Heavy wood, Double knock, Short wood, Wood block, Big wood. The classics are PyChess's knocks (GPL-3.0, credited in
  Settings and the FAQ; id `wood`, as before Oct 12, so an old pick of them still works); the three after each are
  close variations of it (pitch, EQ and decay changed a little, GPL-3.0 too); the rest are Kenney's (CC0) or ours.
  Kept on the device (`piece-sounds.ts`: `brc.moveSound`, `brc.captureSound`; an unknown or removed id reads as the
  default). `sound.ts` plays the pick for every move and capture (every mode, replays, Classic's ripple); castling is
  the classic king-and-rook knock (`castle.mp3`) with the default move sound, else the picked one twice; the Crowd
  gavel is the classic capture and move sounds pitched down to about half. Only the picked files and the defaults load
  (after the first tap's frame), the others when previewed; a pick not loaded yet plays the default. Previews play
  even with the sound switched off; mute silences everything in a game. The files: the classics in `public/sounds/`,
  the rest in `public/sounds/pieces/` (made by `scripts/piece-sounds.py`, leveled to the classic of their kind),
  every source and license in `public/sounds/SOURCES.md`.
- **The first tap of a visit** doesn't wait for sound (Oct 12): the audio graph is made while the page is idle
  (`prepareAudio`), so a tap only switches it on; the samples start loading after that tap's frame.
- **The FAQ, "How HunChess works"** (Eric, Oct 11): Settings → HOW TO PLAY → "📖 FAQ · How it works" (`/faq`; back
  goes to Settings). A long page for the curious: a table of contents with tap-to-jump links, then the modes, how
  moves are scored (with the math and a worked example), how a boss decides its moves (its strength, Stockfish and
  Maia, the handover between them, what a rating gap means), boss powers and the rage meter (one block per boss), the
  God King and his Last Stand, crates and items, fair play (high level only) and credits. Its words are in
  `packages/app/src/faq/content.ts`, one entry per section in a small Markdown-like format (`faq/markdown.ts`), drawn
  by `screens/Faq.tsx`. **Every number comes from the settings objects** (`FaqSources`), never typed in.
  - **When a rule changes, its words in the FAQ change in the same PR** (a new boss: its block in `BOSS_BLOCKS`; a
    test fails without one). Something built but off for players is marked "Being tested"; a plan, "Planned".
  - **Only how the game works for a player:** never how the app talks to the server (messages, routes, who computes
    what), limits, secrets, admin or test controls, or how cheating is detected (a test checks for the obvious words).
- **The look:** dark ground `#14161b`, panels `#1b1e25` / `#232731`, gold `#f2c14e`, green `#4ade80` for online;
  Archivo and Archivo Black (self-hosted); the "Hun**Chess**" logo with "Chess" in gold.

## Where the code is

| What | Where |
| --- | --- |
| Screens | `packages/app/src/screens/Home.tsx`, `Landing.tsx`, `Queue.tsx`, `Profile.tsx`, `PlayerProfile.tsx`, `Settings.tsx`, `Lobby.tsx`, `Legal.tsx` |
| The computer's frame and menus | `components/FrontDoor.tsx`, `FrontMenu.tsx`, `LiveWindow.tsx`, `LiveNumber.tsx`, `MiniBoard.tsx`, `TinyBoard.tsx`, `LeaderboardSheet.tsx` |
| Names and icons everywhere | `components/PlayerName.tsx`, `PixelIcon.tsx` (`UserIcon`), `profile-nav.ts` |
| The live line, app side | `packages/app/src/live.ts` |
| The FAQ (its words and numbers; the format; the screen) | `packages/app/src/faq/content.ts`, `faq/markdown.ts`, `screens/Faq.tsx` |
| Light and dark | `packages/app/src/theme.ts` |
| Piece sounds (the pickers' options, storage) | `packages/app/src/piece-sounds.ts`; played by `sound.ts`; files in `public/sounds/` (the classics) and `public/sounds/pieces/` (from `scripts/piece-sounds.py`); sources in `public/sounds/SOURCES.md` |
| Bot-match replays | `packages/app/src/bot-replays.ts`; made by `npm run replays:bots` (`packages/sim/scripts/bot-replays.ts`) |
| Server: profiles, results, the API | `packages/server/src/accounts.ts`, `api.ts` |
| Server: the live line | `packages/server/src/live-hub.ts`, `live.ts`, `presence.ts` |
| What a profile works out (ranks, percentiles) | `packages/core/src/profile.ts` |
| Styles | `packages/app/src/styles.css` (the front door's sections) |

## Settings

`FRONT_DOOR`, `LIVE_WINDOW`, `RATING_RANKS`, and the matchmaking settings on [matchmaking.md](matchmaking.md).

## Tests and tools

- Unit: `packages/server/test/accounts.test.ts`, `live.test.ts`, `packages/core/test/profile.test.ts`,
  `packages/app/test/theme.test.ts`, `under-board.test.ts`, `king-attack.test.ts` (the eval bar's setting),
  `piece-sounds.test.ts` (the piece-sound picks: storage, fallback, files), `faq.test.ts` (the FAQ: contents against
  sections, links, every boss, numbers following the settings).
- e2e: `e2e/front-door.spec.ts`, `landing.spec.ts`, `home-layout.spec.ts`, `live-window.spec.ts`, `profile.spec.ts`,
  `install.spec.ts`, `crate-banner.spec.ts`, `eval-bar.spec.ts` (the switch: Settings only, the board's room, phone and
  computer), `piece-sounds.spec.ts` (pick, preview, reload, what loads, every file's start and loudness), `faq.spec.ts`
  (Settings → FAQ, a jump to a section, a link to a heading, back).
- Frames: `npm run frames:home`, `frames:queue`.
- Real-phone check by Eric: `TESTING.md`.

## Rules for this area

- Phone first, the computer as good: check both in Playwright screenshots, at 320–430 px and 1024 px+.
- A new piece sound: wood, CC0 or ours (then CC BY, credited in Settings; never non-commercial). GPL only as a
  separate data file, credited, with the license served, as the PyChess classics and their variations are (Eric's
  call, Oct 12). Record its source (and, if changed, how) in `public/sounds/SOURCES.md` and level it with
  `scripts/piece-sounds.py`.
- Real numbers only: every count, stat and rating comes from the server; never fake one.
- A number that grows (coins, ratings, counts) is tested at its widest realistic value (fake the server's answer with
  `page.route` if needed); measure a row of fixed-size items at 320 px with that content.
- Wherever an item is named, show the item (`ItemArt`, `Avatar`), never a stand-in.
- Give state classes a prefix (`ub-board`, not `board`); test every control from every state.
- Server pieces stay on the Durable Objects and D1 Eric already pays for; ask before anything that costs more.
- The FAQ (`faq/content.ts`) is updated in the same PR as any rule it explains; its numbers come from settings.
