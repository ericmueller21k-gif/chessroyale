# The front door: home, queue, profiles

Lane: `hub`. Accounts and sign-in are on [accounts.md](accounts.md); matchmaking on [matchmaking.md](matchmaking.md).

## How it works today

- **Kill switches and the maintenance banner** ([ops.md](ops.md) "Kill switches"): a mode, Solo and Boss alone, or
  Squads resting disables its way in on the home screen with its line ("Squads is resting for a bit. Back soon.": under
  PLAY, on the Party button, in Play with friends, under the buttons for Boss alone); the boss menu hides a resting
  boss. `MAINTENANCE_BANNER` shows as a slim band over the top of every screen (✕ hides it until the message changes).
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
- **Friends** (Oct 15; [docs/decisions/2026-10-15-friends-and-invites.md](../decisions/2026-10-15-friends-and-invites.md); the rules and data on [accounts.md](accounts.md)):
  - **Where:** a phone's home has a line above the live line ("Friends · 2 online", "N new" for requests and
    invites); a computer's live panel has a FRIENDS section above the live line (friends online, each with Invite,
    at most `FRIENDS.panelMax`, and "All friends ›"). Both open the friends list (`/friends`): invites to you (Join,
    ✕), friend requests (Accept, Decline), your friends online first (In a match next, then the rest; Invite on each),
    the requests you sent (Cancel) and who you've blocked (Unblock).
  - **Someone's profile:** Add friend (or Cancel request, Accept friend, Remove friend), Invite to play, Block and
    Report; Remove and Block ask for a second tap. Blocked: Unblock and Report only.
  - **Inviting:** to your private lobby while it waits, or your Squads party; at the front door with neither, the
    server is asked whether they'd take an invite, then a lobby (or, with Squads picked, a party) is made in the home
    screen's mode and they're invited into it. Not during a match. A lobby and a party have "Invite friends" (a sheet
    of your friends) under their link.
  - **A new invite** shows as a toast at the top of a front-door page (never over a match or the queue) for
    `FRIENDS.toastMs`: Join (into the lobby or party; the invite leaves your list) or ✕ (declines it).
  - **Settings → Friends:** "Invites from" (Everyone, Friends, No one) and "Show when I'm online".
  - **Fresh:** the list loads with your account and again when the live line's `inbox` grows (something new arrived
    for you). While a list is on screen (the phone's line, the computer's panel, the friends list, Invite friends) and
    you have a friend who shows when they're online, who's online in it refreshes every `FRIENDS.refreshMs`
    (`/api/friends/online`: the cached session, one D1 read, one hub call). Who's online and in a match come from the
    live hub (the app says "in a match" with its live line, `?busy=1`).
  - **The toast waits** for a front-door page: an invite that arrives during a match or in the queue shows when you're
    back (if it's still open), and its `FRIENDS.toastMs` start only once it's on screen.
- **Light and dark:** follows the device until you pick (Settings); same layout and accents in both.
- **Gone from Settings (Eric, Oct 15):** "Relaxed pace" (each mode plays its own pace; `?pace=quick` is a test switch)
  and Crowd's "50 v 50 / Everyone moves" choice (Crowd is always team turns). A device's old picks (`brc.pace`,
  `brc.crowdTurns`) are no longer read.
- **Settings, in order** (the overhaul, Eric, Oct 15: "smoothness, quickness, with some variety offered";
  [docs/decisions/2026-10-15-settings-overhaul.md](../decisions/2026-10-15-settings-overhaul.md)): THEME · SOUND
  (sound on or off, Move, Capture and Reveal sound) · BOARD (Animations, Motion trail) · QUICK CHAT · FRIENDS · HOW TO
  PLAY · ACCOUNT · PRIVACY AND TERMS · **TESTING**, shown only to admins (`profile.admin`, ADMIN_EMAILS). Gone the same
  day: the pre-game votes' switch (always on; `?augments=0` is a test switch), Classic's
  opening moves stepper (Classic plays its default), the sound lab (`?soundlab`: its choice is the Reveal sound).
- **Board** (Animations: picks as ghost pieces, or just names; Motion trail: each pick flies to its square): wherever
  picks show, Crowd and raids (`CrowdGhosts`) and Classic's and Squads' reveals (`ShadeMoves`: without the trail the
  see-through pieces appear on their squares, without animations only the names, which then carry the reel). Kept on
  the device (`brc.crowdAnim`, `brc.crowdTrail`, the same keys as before); `useBoardAnimations` and `useMotionTrail` in
  `hooks.ts`.
- **Testing (admins): practice mode and the eval bar** (Eric, Oct 15: "The engine moves and eval settings will be
  phased to an admin only menu for testers"). Both count only where the test switches do (`prefs.ts`: `practiceOn`,
  `evalBarOn` read `testSwitchesAllowed()`: an admin, a server with TEST_SWITCHES on, Vite's dev server). For players
  practice is off and there's no eval bar, whatever the device stored (`brc.practice`, `brc.evalBar`). Online the lobby
  checks too: a `hello`'s practice counts only from an admin's socket or where TEST_SWITCHES is "1" (`lobby-do.ts`).
- **The eval bar** (testers; its switch since Oct 10, testers only since Oct 15): on by default. Off, no bar on any
  board (every mode: the play, reveal, vote, final and boss screens all use `EvalBar`, which draws nothing) and the
  board takes its room, centered, on a phone and a computer. Only in Settings, never on a board screen. Kept on the
  device (`brc.evalBar`; accounts keep no preferences). The value is still worked out (the God King's word on how it's
  going reads it). Each result records it (`results.eval_bar`: 1 on, 0 off, NULL from older apps), from solo's post and
  the online `hello`: every player's reads 0 since Oct 15.
- **The Reveal sound** (Settings → Sound, Oct 15; was the sound lab): the roulette's voice as the crowd's move is
  chosen (`REEL_VOICES` in `sound.ts`, `brc.reelVoice`): Steel pan (the default), Kalimba, Marimba, Glockenspiel, Music
  box, 8-bit blip. Picking plays a whole roulette (`previewReel`), as ▶ does without picking.
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
  goes to Settings), or "📖 How each mode works" (`/faq#faq-modes`). Settings keeps no rules of its own: the FAQ is
  the one copy (Oct 15). A long page for the curious: a table of contents with tap-to-jump links, then the modes, how
  moves are scored (with the math and a worked example), how a boss decides its moves (its strength, Stockfish and
  Maia, the handover between them, what a rating gap means), boss powers and the rage meter (one block per boss), the
  God King and his Last Stand, leaving or resigning (the modes' last entry), crates and items, fair play (high level
  only), credits, and links to the privacy policy and terms (the game's own pages open in the same tab, so their Back
  returns to the FAQ). Its words are in
  `packages/app/src/faq/content.ts`, one entry per section in a small Markdown-like format (`faq/markdown.ts`), drawn
  by `screens/Faq.tsx`. **Every number comes from the settings objects** (`FaqSources`), never typed in.
  - **When a rule changes, its words in the FAQ change in the same PR** (a new boss: its block in `BOSS_BLOCKS`; a
    test fails without one). Something built but off for players is marked "Being tested"; a plan, "Planned".
  - **The Crowd's boss final's boss** (the Hidden Boss, Oct 14) isn't "playable" (he's hidden from players elsewhere),
    so his block isn't in `BOSS_BLOCKS`: `crowdFinalBlock` writes it after the rest, and the endings, his strength and
    brain and the God King's section name him from the roster (`crowdFinalBoss`), the counts from `crowdFinalists`.
    "Still to come" lists only bosses without their art and powers.
  - **Only how the game works for a player:** never how the app talks to the server (messages, routes, who computes
    what), limits, secrets, admin or test controls, or how cheating is detected (a test checks for the obvious words).
- **The look:** dark ground `#14161b`, panels `#1b1e25` / `#232731`, gold `#f2c14e`, green `#4ade80` for online;
  Archivo and Archivo Black (self-hosted); the "Hun**Chess**" logo with "Chess" in gold.

## Where the code is

| What | Where |
| --- | --- |
| Screens | `packages/app/src/screens/Home.tsx`, `Landing.tsx`, `Queue.tsx`, `Profile.tsx`, `PlayerProfile.tsx`, `Settings.tsx`, `Lobby.tsx`, `Legal.tsx`, `Friends.tsx` |
| Friends' pieces (rows, the home line, the live panel's section, the toast, Invite friends, the settings, a profile's buttons) | `packages/app/src/components/Friends.tsx`; the list and actions `friends.ts` |
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
  `piece-sounds.test.ts` (the piece-sound picks: storage, fallback, files), `testers.test.ts` (practice mode and the
  eval bar: testers only), `faq.test.ts` (the FAQ: contents against sections, links, every boss, numbers following the
  settings); `packages/server/test/lobby-do-practice.test.ts` (online practice: testers only).
- e2e: `e2e/front-door.spec.ts`, `landing.spec.ts`, `home-layout.spec.ts`, `live-window.spec.ts`, `profile.spec.ts`,
  `install.spec.ts`, `crate-banner.spec.ts`, `friends.spec.ts` (two players: request, accept, online, the invites
  setting, an invite joined from its toast, a block; the phone's line at 320 px), `eval-bar.spec.ts` (testers: the
  switch in Settings only, the board's room, phone and computer; players: no bar, no switch), `piece-sounds.spec.ts`
  (pick, preview, reload, what loads, every file's start and loudness; the Reveal sound), `faq.spec.ts` (Settings →
  FAQ, a jump to a section, a link to a heading, back).
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
