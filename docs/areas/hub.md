# The front door: home, queue, profiles

Lane: `hub`. Accounts and sign-in are on [accounts.md](accounts.md); matchmaking on [matchmaking.md](matchmaking.md).

## How it works today

- **The landing page** shows where online play needs signing in (`onlineNeedsSignIn` from `/api/auth/config`) and
  you aren't signed in: sign in, or play against bots as a guest (remembered on the device). An invite link shows it
  even to a guest. `?nolanding` skips it (tests). Guests play Solo and Boss alone.
- **Home** (built from the approved mockups in `docs/mockups/front-door/`): the mode picker (Crowd 50 v 50, Boss raid,
  Classic), the Matchmaking row (Default, Bots off, Solo) with its ⓘ, PLAY, "Play with friends", "Boss alone" (solo's
  boss menu), the coin pill, your icon, and the live line ("214 online · 9 matches running · 31 in queue") with the
  typical wait under PLAY.
  - **Phone:** one column, big tap targets, no sideways scroll at 320–430 px.
  - **Computer** (1024 px+): a side menu, the play column in the centre, a side panel (playing now, global chat).
    From 1280 px the play column starts with the **live window**: the featured real match (a matchmade one, most
    people, then newest) or, when none runs, bot-match replays played on a shared clock cycle so everyone sees the same
    moment (`LIVE_WINDOW`; replays in `packages/app/public/replays/crowd-bots.json`, never fetched on phones).
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
  takes its room, centred, on a phone and a computer. Only in Settings, never on a board screen. Kept on the device
  (`prefs.ts`: `evalBarOn`, `brc.evalBar`; accounts keep no preferences). The value is still worked out (the God
  King's word on how it's going reads it). Each result records it (`results.eval_bar`: 1 on, 0 off, NULL from older
  apps), from solo's post and the online `hello`, to see later who turns it off and how they play.
- **The look:** dark ground `#14161b`, panels `#1b1e25` / `#232731`, gold `#f2c14e`, green `#4ade80` for online;
  Archivo and Archivo Black (self-hosted); the "Hun**Chess**" logo with "Chess" in gold.

## Where the code is

| What | Where |
| --- | --- |
| Screens | `packages/app/src/screens/Home.tsx`, `Landing.tsx`, `Queue.tsx`, `Profile.tsx`, `PlayerProfile.tsx`, `Settings.tsx`, `Lobby.tsx`, `Legal.tsx` |
| The computer's frame and menus | `components/FrontDoor.tsx`, `FrontMenu.tsx`, `LiveWindow.tsx`, `LiveNumber.tsx`, `MiniBoard.tsx`, `TinyBoard.tsx`, `LeaderboardSheet.tsx` |
| Names and icons everywhere | `components/PlayerName.tsx`, `PixelIcon.tsx` (`UserIcon`), `profile-nav.ts` |
| The live line, app side | `packages/app/src/live.ts` |
| Light and dark | `packages/app/src/theme.ts` |
| Bot-match replays | `packages/app/src/bot-replays.ts`; made by `npm run replays:bots` (`packages/sim/scripts/bot-replays.ts`) |
| Server: profiles, results, the API | `packages/server/src/accounts.ts`, `api.ts` |
| Server: the live line | `packages/server/src/live-hub.ts`, `live.ts`, `presence.ts` |
| What a profile works out (ranks, percentiles) | `packages/core/src/profile.ts` |
| Styles | `packages/app/src/styles.css` (the front door's sections) |

## Settings

`FRONT_DOOR`, `LIVE_WINDOW`, `RATING_RANKS`, and the matchmaking settings on [matchmaking.md](matchmaking.md).

## Tests and tools

- Unit: `packages/server/test/accounts.test.ts`, `live.test.ts`, `packages/core/test/profile.test.ts`,
  `packages/app/test/theme.test.ts`, `under-board.test.ts`, `king-attack.test.ts` (the eval bar's setting).
- e2e: `e2e/front-door.spec.ts`, `landing.spec.ts`, `home-layout.spec.ts`, `live-window.spec.ts`, `profile.spec.ts`,
  `install.spec.ts`, `crate-banner.spec.ts`, `eval-bar.spec.ts` (the switch: Settings only, the board's room, phone and
  computer).
- Frames: `npm run frames:home`, `frames:queue`.
- Real-phone check by Eric: `TESTING.md`.

## Rules for this area

- Phone first, the computer as good: check both in Playwright screenshots, at 320–430 px and 1024 px+.
- Real numbers only: every count, stat and rating comes from the server; never fake one.
- A number that grows (coins, ratings, counts) is tested at its widest realistic value (fake the server's answer with
  `page.route` if needed); measure a row of fixed-size items at 320 px with that content.
- Wherever an item is named, show the item (`ItemArt`, `Avatar`), never a stand-in.
- Give state classes a prefix (`ub-board`, not `board`); test every control from every state.
- Server pieces stay on the Durable Objects and D1 Eric already pays for; ask before anything that costs more.
