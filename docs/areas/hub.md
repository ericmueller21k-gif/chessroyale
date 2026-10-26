# The front door: home, queue, profiles

Lane: `hub`. Accounts and sign-in are on [accounts.md](accounts.md); matchmaking on [matchmaking.md](matchmaking.md).

## How it works today

- **Kill switches and the maintenance banner** ([ops.md](ops.md) "Kill switches"): a mode, Solo and Boss alone, or
  Squads resting disables its way in on the home screen with its line ("Squads is resting for a bit. Back soon.": under
  PLAY, in the Party sheet, in Play with friends, on the Boss raid screen under its choices); the boss menu hides a resting
  boss. `MAINTENANCE_BANNER` shows as a slim band over the top of every screen (✕ hides it until the message changes).
- **The landing page** shows where online play needs signing in (`onlineNeedsSignIn` from `/api/auth/config`) and
  you aren't signed in: sign in, or play against bots as a guest (remembered on the device). An invite link shows it
  even to a guest. `?nolanding` skips it (tests). Guests play Solo, a Solo raid and Boss alone.
- **Home** (built from the approved mockups in `docs/mockups/front-door/`; the RANKED row and the Boss raid card, Eric,
  Oct 16, [docs/decisions/2026-10-16-home-ranked-row-and-boss-raid.md](../decisions/2026-10-16-home-ranked-row-and-boss-raid.md)):
  - **The RANKED row:** a small "RANKED" label over three buttons, a radio group: **50 v 50** ("Crowd chess"), **1 v 1**
    ("Classic chess") and **Squads** ("8 squads of 4"). Home opens with **none picked** and PLAY dimmed: you tap the mode
    you want, then PLAY (Eric, Oct 18; [docs/decisions/2026-10-18-play-at-the-bottom.md](../decisions/2026-10-18-play-at-the-bottom.md)). The pick holds until the app is opened again
    (a reload), and `?mode=` picks one from a link. Classic still plays with `?mode=classic`. Under the row, **the panel**,
    always there (Eric, Oct 25: "the menu buttons should never be like invisible"): with none picked it shows 50 v 50's
    options greyed, none selected and none tappable (`aria-disabled`, the `idle` class; no "Tap a mode above to play"
    text). One box of one fixed size for every mode (Eric, Oct 18:
    "it should never change size";
    [docs/decisions/2026-10-18-home-steady-layout.md](../decisions/2026-10-18-home-steady-layout.md)), holding the
    pick's options or words: 50 v 50's Matchmaking (Default, Bots off, Solo) with its ⓘ (its words float over the RANKED
    row, moving nothing); Squads' **Solo queue** or **Party** ([squads.md](squads.md); Party opens the party sheet at
    once, and PLAY opens it again while Party is picked); for 1 v 1 (always people) your rank in it, "Your rank: Gold 2 ·
    45 RP" or "Your rank: Placement 2/5" (`ranked1v1Label`, from your profile; whole on one line at 320 px at its
    widest), over "Ranked chess vs one player near your level". Then PLAY and its line, a fixed height whatever it says
    (two lines' room on a phone, one line on a computer). After the first pick no click on home moves or resizes anything
    (a mode, an option, the ⓘ). The first pick wakes the greyed options (their default selected) and moves nothing: the
    panel was there from the first view (Oct 25; it used to come in with the first pick, Oct 24, which raised the RANKED
    row and the board). PLAY, the cards and the line stay put. 1 v 1's PLAY is
    `startRanked1v1()`: its queue at once, at `/1v1` ([ranked.md](ranked.md)); resting (`PAUSE_RANKED1V1`), PLAY is
    off with its line, as the other modes.
  - **Other modes** (Oct 24, Eric: "a tiny text that says other modes, right below play"; Oct 26: three cards): an 11 px
    muted label under PLAY, then the **Boss Arena card** full width, and under it the **Solo Boss Mode card** and the
    **Auto chess** card side by side, half width each (`rd-pair`, Eric, Oct 26). The half cards stack the picture, the name
    and one short line ("Any boss, alone", "Build an army") with the › in the top corner; the Auto chess picture is a
    white knight from the board's own piece art. Auto chess opens `/autochess`, as Settings' Testing row does, with its back
    button home. PLAY is a third shorter (43 px on a phone, 59 px on a computer). On a phone the pair is as tall as the two
    cards it replaces (84 px each, 10 px apart), so home fits as before.
  - **The Boss Arena card** (Eric, Oct 26, replacing the Boss raid card; full width, "Boss Arena", "Party up and take on the
    bosses") opens the town square at `/town` (the same page the address opens; its back button is home).
    Its picture is a still of one boss you can meet, turning to the next every 30 s (`FRONT_DOOR.bossCardMs`) with a 0.6 s
    fade (`bossCardFadeMs`), never the Hidden Boss or a resting boss, the card's size fixed; it waits while the app is
    hidden, and under reduced motion there's no fade (`BossCardFace` in `components/BossSelect.tsx`; test switch
    `?cardMs=`). The animated card with lines is shelved (a later idea). The title is Archivo, not Archivo Black: that
    file's lowercase i has no dot, so "raid" read as "raId" (Oct 24). The side menu's **Boss Arena** item opens the same
    page (the town has no side menu, so it never shows as the open page).
  - **The Solo Boss Mode card** (Eric, Oct 26; half width, "Solo Boss Mode", "Any boss, alone") opens the **Solo Boss
    Mode screen**, the Boss raid screen's solo form (below). Its picture is the crown from the side menu's old Boss raid
    item, drawn large in the card's gold (`CrownArt` in `screens/Home.tsx`): a placeholder until Opus draws one.
  - **The Boss raid screen: a character select** (Eric, Oct 16;
    [docs/decisions/2026-10-16-boss-character-select.md](../decisions/2026-10-16-boss-character-select.md);
    `BossSelect`): tall slanted tiles at the top like a fighting game's select grid, one per boss you can meet, each its
    boss's figure on a color of its own, all the same size with a small gap, five to a row on a phone and a computer alike
    ([docs/decisions/2026-10-23-boss-select-sf.md](../decisions/2026-10-23-boss-select-sf.md)), the Hidden Boss's dark
    and locked, and "?" for a random boss; under them a stage (the 1 v 1 stage's
    platform) with the picked boss in its idle, its name and its strength against you: skulls and Boss alone's level at
    your difficulty ("💀 Rating 1800 · Hard": the Maia rating it plays at, Oct 18; the difficulty named unless it's Normal), the same number Boss alone's menu
    shows, worked out by one function (`bossAloneElo`) and following the menu's difficulty as it changes. One number per
    boss: the raids show none
    ([docs/decisions/2026-10-17-boss-sheet-fit.md](../decisions/2026-10-17-boss-sheet-fit.md)). A tap drops the boss on,
    plays its sound once and says one of its lines (the boss section, [bosses.md](bosses.md)). Under the stage the ways
    to play. **Solo Boss Mode** (Oct 26; the home card and the side menu's item) shows only **Boss alone**; the full
    screen (`?mode=raid`, the test link, titled "Boss raid") shows every choice below, as before, until the raids move to
    the Boss Arena's Coliseum. Each choice goes through its flow: **Join a raid** and **People only** (the raid's queues, always a random boss:
    "Random boss · …"), **Raid with bots** (a Solo raid against the boss picked), **Boss alone** (its menu: the
    difficulty and the boss picked; a phone's sheet at the foot under 600 px wide, a dialog in the middle with room all
    round from 600 px at any height, its rows scrolling inside so it always fits) and **Play with friends** (a raid made
    for the boss picked: the lobby's `bossPicked`; or join one by code). With the Hidden Boss picked every choice is
    locked (grayed out, a small lock). The pick is kept on the device (`brc.bossId`; the Hidden Boss never). A resting
    part disables its choices with its line under them; a resting boss has no tile (a pick of one reads as random).
    While a 1 v 1 search runs, a choice asks "Leave the 1 v 1 queue?" first (App's `leavingDuelFirst`).
  - **`/bosses`** (unlisted, not admin-gated; Eric's shortcut): opens the solo boss picker at once ("Choose your boss":
    every boss you can meet and a random one, and for an admin the Hidden Boss after them; the difficulty), over home.
  - Your icon (no coins at the top: the shop and your own profile show them, Eric, Oct 18), and the live line ("214 online · 9 matches running · 31 in queue") with the typical
    wait under PLAY. The shop, your profile and Play with friends are in a phone's top bar and a computer's side menu,
    not on home's column (Eric, Oct 18; [docs/decisions/2026-10-18-play-at-the-bottom.md](../decisions/2026-10-18-play-at-the-bottom.md)).
  - **Play with friends** (a phone's **Friends** in the top bar, a computer's side menu): **Get friend code** makes a
    lobby in the row's pick (50 v 50 if none, or with 1 v 1 or Squads picked) and copies its invite link as it opens
    (the lobby screen says "Invite link copied: paste it to your friends"); join one by its code; **Your friends ›**
    (with "N new") opens the friends list. The full Boss raid screen's Play with friends makes a raid, as before (the
    Solo Boss Mode form has none).
  - A screen that replaces home (a phone's queue, the Boss raid screen, home again) starts at its top. A match's Home
    and a closed lobby's note land on home itself; Cancel in a raid's queue goes back to the Boss raid screen (the full one).
  - **Phone:** a top bar (the logo, your pawn (your profile), the shop, **Friends** (with a count
    of requests and invites), then a gear that opens Settings in one tap; a computer's are its side menu's, so none is
    there; [docs/decisions/2026-10-17-phone-settings-gear.md](../decisions/2026-10-17-phone-settings-gear.md),
    [docs/decisions/2026-10-18-play-at-the-bottom.md](../decisions/2026-10-18-play-at-the-bottom.md)), then one column: your card, the RANKED row, its panel, PLAY
    and its line, then Other modes with the Boss Arena card, and Solo Boss Mode and Auto chess side by side under it, at the bottom. Your pawn's card takes the room
    left: your tag (icon, name, "Weighty · 1580") centered above your pawn's head, the pawn 75% bigger than before
    (170 × 154 → up to 298 × 270) and sized to the room the tag leaves (Oct 24). On a short card (under 190 px tall: a
    640 px phone, or a 740 px one (measured at 320, 375 and 430 px wide), since the options panel is there from the first view, Oct 25)
    the tag stands beside the pawn instead, as it did when the room was short (Oct 18), so home fits with no scrolling
    from 360×640 up in every mode. At 320×568 home fits too, with a small pawn (about 51 px).
    ([docs/decisions/2026-10-18-phone-home-fits.md](../decisions/2026-10-18-phone-home-fits.md)). Big tap targets, no
    sideways scroll at 320–430 px; a long name on your home card ellipsizes.
  - **Computer** (1024 px+): a side menu, the play column in the center in the phone's order (Eric, Oct 18): the RANKED
    row, its panel, PLAY and its line, then Other modes with the Boss Arena card, and Solo Boss Mode and Auto chess side by side under it (a little shorter) at the
    bottom; a side panel (playing now, global chat). The pawn hops on a computer too (Oct 24: the hop was phone-only).
    From 1280 px the play column starts with the **live window**: the featured real match (a matchmade one, most
    people, then newest) or, when none runs, bot-match replays played on a shared clock cycle so everyone sees the same
    moment (`LIVE_WINDOW`; replays in `packages/app/public/replays/crowd-bots.json`, never fetched on phones).
    A computer's only (`LIVE_WINDOW_MEDIA`: 1280 px wide, 600 px tall, a mouse; never mounted on a phone or tablet)
    and always silent, whatever the sound setting (its board is `silent`; Eric, Oct 12).
- **The live line** is GET `/api/live`: polled every `FRONT_DOOR.livePollMs` while a front-door screen shows it, every
  `heartbeatMs` elsewhere (a match), never while the tab is hidden. The same request says you're here. Online = seen
  within `onlineWindowMs`. The numbers come from the live hub (see [ops.md](ops.md)). Squads' lobbies report to the
  hub too (Oct 15) but stay off this line: they count for the overload limit and the ops health view only.
- **The queue screen:** the lobby's seats fill on screen (people, then bots popping in after the fill time), the wait
  so far, "Switch to Default" in Bots off. The match starts in place.
- **Profiles** (yours and anyone's, by tapping a name): icon, name, rank (from the rating, `RATING_RANKS`; "Top N%"
  once `percentileMinPlayers` have ratings), the rating chart, stats (All, Classic, Crowd), "Boss tiers beaten"
  (online raids only: a solo win is the browser's word), recent matches, what
  they're wearing (drawn with the real item art), their quick-chat picks. A profile others see never shows an email,
  a sign-in method or anything not on the approved list; a banned player's says "Banned". A "1 V 1" section shows
  their ranked rank (tier, division and RP, or "Placement N/5") and record, once they've played one (none for a banned
  player).
- **Ranked 1 v 1's way in** ([ranked.md](ranked.md)): `/1v1` queues in one tap; the home screen's button (not built
  yet) calls `startRanked1v1()` (`packages/app/src/duel.ts`) and shows `ranked1v1Label()` (`packages/app/src/ranked.ts`:
  the rank's label from the profile, null until it loads). The first-time pawn-vote hint is `VoteHint`
  (`components/VoteHint.tsx`, once per device: `brc.voteHintSeen`), for every pawn vote to use.
- **Friends** (Oct 15; [docs/decisions/2026-10-15-friends-and-invites.md](../decisions/2026-10-15-friends-and-invites.md); the rules and data on [accounts.md](accounts.md)):
  - **Where:** a phone's way in is **Friends** in home's top bar (its sheet's "Your friends ›"), or Friends on your own
    profile, each with the count of requests and invites (Eric, Oct 18: home's line above the live line is gone,
    [docs/decisions/2026-10-18-play-at-the-bottom.md](../decisions/2026-10-18-play-at-the-bottom.md)); a computer's live panel has a FRIENDS section above the live line (friends online, each with Invite,
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
  (sound on or off, Move, Capture and Reveal sound) · BOARD (Board colors, Animations, Motion trail) · QUICK CHAT · FRIENDS · HOW TO
  PLAY · ACCOUNT · PRIVACY AND TERMS · **TESTING**, shown only to admins (`profile.admin`, ADMIN_EMAILS). Gone the same
  day: the pre-game votes' switch (always on; `?augments=0` is a test switch), Classic's
  opening moves stepper (Classic plays its default), the sound lab (`?soundlab`: its choice is the Reveal sound).
- **Board colors** (Oct 18): three small boards side by side, Classic, Green and Gold, each a few squares in its own colors
  with the last move, a piece, its move dots and a capture ring; the picked one is gold, as the other choices are. A tap
  changes every board on this device at once; only this device (`brc.boardColors`): other players see their own. How it
  works: [board.md](board.md).
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
- **Every sound list is collapsed by default** (Eric, Oct 24; [decision](../decisions/2026-10-24-sound-collapse.md)): the
  title row ("Move sound", the pick's name, a chevron) is one button; a tap opens the list (each option with its ▶), a
  tap on the row closes it. Each list opens on its own; the open state isn't stored, so Settings opens collapsed. All three
  use `SoundPicker` in `Settings.tsx`: a future sound list gets the same by using it.
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
| Screens | `packages/app/src/screens/Home.tsx` (home, the RANKED row, the Other modes cards (Boss Arena, Solo Boss Mode), the Boss raid screen and its Solo Boss Mode form), `Landing.tsx`, `Queue.tsx`, `Profile.tsx`, `PlayerProfile.tsx`, `Settings.tsx`, `Lobby.tsx`, `Legal.tsx`, `Friends.tsx` |
| Friends' pieces (rows, the live panel's section, the toast, Invite friends, the settings, a profile's buttons) | `packages/app/src/components/Friends.tsx`; the list and actions `friends.ts` |
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
- e2e: `e2e/front-door.spec.ts`, `home-ranked.spec.ts` (the RANKED row at 320-390 px and on a computer, home keeping still through every click
  (PLAY, the board preview, the Boss Arena card and the panel within 1 px, at 320 and 390 px and 1280-1920 px), 1 v 1's PLAY,
  the Boss raid screen (`?mode=raid`) and each of its choices, `/bosses`), `boss-select.spec.ts` (the character select: a
  tap's drop, sound and line, "?", the Hidden Boss dark and locked and never named, the pick reaching Boss alone, a Solo
  raid and a raid you make, resting bosses, the layout at 320-1280 px, the card turning; Boss alone's menu and
  `/bosses` fitting 1280×600 to 1920×1080 and phones at 320-390 px, its last row reachable; one number per boss, the
  stage's and the menu's and the battle's), `landing.spec.ts`, `home-layout.spec.ts`, `live-window.spec.ts`, `profile.spec.ts`,
  `install.spec.ts`, `crate-banner.spec.ts`, `friends.spec.ts` (two players: request, accept, online, the invites
  setting, an invite joined from its toast, a block; the phone's line at 320 px), `eval-bar.spec.ts` (testers: the
  switch in Settings only, the board's room, phone and computer; players: no bar, no switch), `piece-sounds.spec.ts`
  (pick, preview, reload, what loads, every file's start and loudness; the Reveal sound), `faq.spec.ts` (Settings →
  FAQ, a jump to a section, a link to a heading, back).
- Frames: `npm run frames:home`, `frames:queue`.
- Real-phone check by Eric: `TESTING.md`.

## Rules for this area

- Phone first, the computer as good: check both in Playwright screenshots, at 320–430 px and 1024 px+, and a laptop's
  maximized window (1280×600, 1366×768): a sheet on a computer sits in the middle with room all round (Oct 17).
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
