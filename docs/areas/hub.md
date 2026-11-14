# The front door: home, queue, profiles

Lane: `hub`. Accounts and sign-in are on [accounts.md](accounts.md); matchmaking on [matchmaking.md](matchmaking.md).

## How it works today

- **Loading (Nov 10, [phone load 2](../decisions/2026-11-10-phone-load-2.md)):** `index.html`'s shell (home's markup, only the logo, hero
  panel and PLAY's outline visible; the splash where this device hasn't landed on home: `shell.ts`) shows before the script runs and goes as
  the first real screen draws. The match screens (`screens/game-screens.ts`), solo, FAQ, Legal and Auto chess are chunks (`lazy.tsx`),
  preloaded when play is near. Pictures are cached on first show, not precached; the demo video is MP4 only. `scripts/measure-load.mjs`.
  Past `FRONT_DOOR.loadBarAfterMs` (2 s) the shell shows a thin bar and what's loading (under the splash's logo, centered; the shell is always the splash since Eric's Nov 10 call, never home's outline),
  moved by the app's steps (`loadbar.ts`); a script that won't load, or no step for 20 s: "Try again" (a reload).
  [Decision](../decisions/2026-11-10-loading-bar.md); guard: `e2e/home-layout.spec.ts`, "the loading bar".
  Your profile (`/api/me`) is asked for beside the sign-in options, not after them (`account.ts` `loadAccount`, Nov 10). The service
  worker precaches one file at a time at low priority and, after a deploy, copies what's unchanged from the old version's cache
  (same name under `/assets/`, else the same hash in `sw.js`'s `HASHES`) instead of downloading it again.

- **The daily quests overlay (Nov 9; the mockup [2026-11-09-quests-mock.md](../decisions/2026-11-09-quests-mock.md), on real quests since
  phase 3: [2026-11-09-quests-screens.md](../decisions/2026-11-09-quests-screens.md); the rules and server: [accounts.md](accounts.md), "Quests"):**
  `components/QuestsOverlay.tsx` (props: the quests, each with its `canReroll`, the two countdowns, paused, callbacks), fed by `quests.ts` (`useQuests`:
  GET /api/quests as home shows; the reroll's POST). A gold-framed card over home (a plain dark dim, no blur): the app icon in a crest, "Daily Quests",
  "New quests in 12h" ("Quests are paused for a moment." under PAUSE_REWARDS), two or three daily rows (one carried over) and the weekly under its own
  label ("Resets in 4d"), each with its picture (a live boss's portrait, Squads' pawns, the board's pieces), goal, bar and count ("Done!"), and its
  reward in the shop's art (the Winter crate, the key); a reroll on each daily (each its own, once a day: only that one greys once used, or on a done quest; Nov 10); "Got it", ×, Escape
  or a tap outside close it. **By itself** on the XP day's first home visit, signed in, on this device (`hunchess.quests.seenDay`), never over the
  walkthrough, the queue or another notice (chat's, the Welcome Crate's): then it stays due, and the day counts as seen only when it shows
  (review of #575, m3). **After a game that moved a quest** (Nov 10, [decision](../decisions/2026-11-10-quest-progress.md)): home compares the counts
  with the ones this device last saw (`hunchess.quests.shown`, per account) and opens it by itself (same "never over" rules), each moved bar sliding to
  its new count in turn (`QUESTS.show`); one it finishes glows, pops, says "Done!" and bursts its reward; sounds by name (`questSound` in sound.ts,
  placeholders until Eric's pack: `QUEST_SOUND_FILES`). e2e sets `hunchess.quests.noPop` unless `questsSeen: false`. The **Quests entry** is a phone's top bar button (beside your pawn, before the shop; below 344 px the logo becomes the app's icon so
  every button keeps 40 px) and a computer's **Daily Quests** in its side menu, between Play with friends and Shop & crates (`nav.quests`: home with the
  overlay open, via `intent`; Eric, Nov 10, [decision](../decisions/2026-11-10-desktop-quests.md); nothing on the card); for everyone, greyed ("Sign in
  for quests") for a guest where sign-in is set up. A game that finishes a quest says so in its result's toast ("Quest done: Boss Hunter +300 XP").
  Guards: `e2e/home-layout.spec.ts`, "quests (Nov 9, phase 3 …)", and `e2e/quests.spec.ts`, phone and computer.

- **The first-time walkthrough** (`components/Walkthrough.tsx`, slides in `tutorial.ts`): 13 slides; each lights every visible
  `data-tour` element (a computer's side menu and home button both). Only the last slide has OK and "Don't show me this again";
  `?tour=1` reopens it. Decision: [2026-11-07-walkthrough-v2.md](../decisions/2026-11-07-walkthrough-v2.md).

- **Kill switches and the maintenance banner** ([ops.md](ops.md) "Kill switches"): a mode, Solo and Boss alone, or
  Squads resting disables its way in on the home screen with its line ("Squads is resting for a bit. Back soon.": under
  PLAY, in the Party sheet, in Play with friends, on the Boss raid screen under its choices); the boss menu hides a resting
  boss. `MAINTENANCE_BANNER` shows as a slim band over the top of every screen (✕ hides it until the message changes).
- **The landing page** shows where online play needs signing in (`onlineNeedsSignIn` from `/api/auth/config`) and
  you aren't signed in: sign in, or play against bots as a guest (remembered on the device). An invite link shows it
  even to a guest. `?nolanding` skips it (tests). Guests play Solo, a Solo raid and Boss alone.
  Its sign-in box (Nov 12, Eric: "put a sign in already [first], and then below that... a sign up button, and then... your age
  thing"): **Sign in** first, Google and the email code with no question; "New to HunChess?" **Sign up** below, which asks
  "Sign up: when were you born?" in the same box, then the same two ways ("Have an account? Sign in" goes back). The heading
  names the view ("Sign in to play online", "Sign up to join lobby ABCDE"). Both views are the same height (the question's rows
  wrap where the email's do), so switching moves nothing below. [accounts.md](accounts.md), "The age gate";
  [2026-11-12-signin-without-age.md](../decisions/2026-11-12-signin-without-age.md).
  Its **demo reel**, 25 s on a loop, a pixel-font caption each (50 v 50; the park, Big Boy's challenge; ranked, the ranks up to
  Transcendent; the Hidden Boss), cut twice: a phone's portrait one (`/media/hunchess-reel.*`, 860 × 1544, the screen's whole width)
  and a computer's 16:9 one from 1024 px (`hunchess-reel-wide.*`, 1920 × 1080). Only one loads. From 1024 px the page fills the
  window and never scrolls: left, the title and the reel, as big as fits; right, a 380 px column (sign-in, then Questions), the
  only part that scrolls (`.landing-stage` / `.landing-side`, display: contents below 1024 px). Remake: `scripts/reel/` then `scripts/encode-demo.sh`. [2026-11-11-landing-reel.md](../decisions/2026-11-11-landing-reel.md).
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
    pick's options or words (Nov 9, [2026-11-09-home-modes-options.md](../decisions/2026-11-09-home-modes-options.md)): 50 v 50's
    **Solo queue** (the public queue), **Party** (greyed, "Soon": queueing together into the public matchmaking, up to
    `CROWD_PARTY_MAX` = 8, sides random, ranked, a later job; Eric, Nov 9) and **Bots** (you and 99 bots in your
    browser: PLAY opens **the Bot level box**, [2026-11-09-home-modes-bot-level.md](../decisions/2026-11-09-home-modes-bot-level.md):
    My level, Very easy … Very hard, Random, each with its average; OK greyed until a pick, remembered on the device, `BOT_LEVELS`;
    `components/BotLevelBox.tsx`), each a title and a sub line, three equal buttons in the 44 px row (Bots off has no button since
    Nov 9; a stored "botsoff", a test's, still queues people only); Squads' **Solo queue**, **Party** ([squads.md](squads.md); Party
    opens the party sheet at once, and PLAY opens it again while Party is picked; its line "Queue with up to 3 friends") and **Bots**, greyed ("Soon") until its server part;
    for 1 v 1 (always people) your rank's emblem (48 px, its box
    there before your profile loads; none in placements) beside your rank, "Your rank: Gold 2 · 45 RP" or "Your rank:
    Placement 2/5" (`ranked1v1Rank`, from your profile; whole on one line at 320 px at its widest, "Your rank:
    Transcendent · 1234 RP"), over "Win to climb, lose to drop" (Nov 9; what 1 v 1 is, "Ranked chess vs one player near your level", is
    the line above PLAY). Then **the line above PLAY** (Oct 28, Eric: "swap the line
    of text below Play and put it above play") and PLAY. The line is exactly one line whatever it says, phone and computer (Nov 9,
    [2026-11-09-home-modes-hint-line.md](../decisions/2026-11-09-home-modes-hint-line.md): ellipsized if ever too long, every line
    written to fit 320 px), and never empty: "Tap a game mode to get started" with no mode picked. The room it freed on a phone (16.9 px)
    went to the Other modes cards (72.9 px tall there, their foot where it was), PLAY and Chess Town rising by it. After the
    first pick no click on home moves or resizes anything (a mode, an option). The first pick wakes the greyed options (their default selected) and moves nothing: the
    panel was there from the first view (Oct 25; it used to come in with the first pick, Oct 24, which raised the RANKED
    row and the board). PLAY, the cards and the line stay put. 1 v 1's PLAY is
    `startRanked1v1()`: its queue at once, at `/1v1` ([ranked.md](ranked.md)); resting (`PAUSE_RANKED1V1`), PLAY is
    off with its line, as the other modes. Ranked's leave rules (L1, Nov 9; [ranked.md](ranked.md), "Leaving early"): a
    lockout greys 1 v 1's PLAY with its countdown in the line ("You left early: 1 v 1 opens in 4:32", one line from 320 px;
    `LeavesLine`, the only part drawn each second), PLAY back by itself as it ends; the delayed queue's line ("3 leaves in your
    last 20: +2 min queue") leaves PLAY on. Home's note slot (the `fd-notice` at its top, dismissable for the tab) says "You left
    before the game started: −5 RP" after a dodge, or "Finish ranked games to clear your leaves." from 5 marks; another notice (a match
    that ended) goes first.
  - **Searching while you browse** (Eric, Nov 10; [2026-11-10-search-on-home.md](../decisions/2026-11-10-search-on-home.md); `search.ts`, Home's `SearchRow`):
    a search on (1 v 1's, a 50 v 50 or Squads lobby stepped out of), the modes row keeps its box: a green ring, "Searching · 50 v 50", "Solo queue · 37 of
    100 in the lobby" (no "in the lobby" under 340 px), the time; the panel Cancel, Lobby, Start with bots (`searchSlots`), Cancel and bots asking in the
    same slots (the question not a button; Yes, No; back after `FRONT_DOOR.searchAskMs`). The rest greys (`fd-off`, `inert`); the top bar and card stay lit.
  - **Chess Town's button** (Eric, Oct 31 and Nov 1; it was the full-width Boss Arena card, Oct 26, "Party up and take on the bosses";
    [docs/decisions/2026-11-01-home-chess-town.md](../decisions/2026-11-01-home-chess-town.md)): right under PLAY, **exactly PLAY's size at
    every width** (`.fd-town` is in each of PLAY's size rules in `styles.css`: 97 px on a phone, 76 px on a computer, 60 px in a short
    window; the column's gap between them), opening the town square at `/town` (the same page the address opens; its back button is
    home). A little town scene fills it, playing its idle loop, with **CHESS TOWN** over it in big white letters with a dark outline
    (a bit above the middle, so the lower half of the picture shows) and the gold ring over the picture. **Two pictures, picked at random
    as the page loads, 50/50** (`pickTownPicture` in `home-art/town.ts`; `?town=A` or `?town=B` in the address forces one, for stills
    and tests: anyone's address, not a gated test switch): **A**, the skyline (the tower, the houses, the trees), and **B**, the square
    (the shops, the table with its two pawns, the lamps, a bird). **Three skies by the device's clock** (Nov 1,
    [docs/decisions/2026-11-01-chess-town-skies.md](../decisions/2026-11-01-chess-town-skies.md); `skyAt` and `pickSky` in `home-art/town.ts`,
    the hours in `TOWN_SKY_HOURS`; `?sky=day|dusk|night` forces one, `?night=1` is night): **day** 06:00 to 17:00 (a light-blue sky, the town in
    fuller colors, the windows unlit glass), **dusk** 17:00 to 19:00 (the pictures as drawn, the dusk sky), **night** 19:00 to 06:00 (a deep
    night-blue sky, the town darker and cooler, the windows and lamps lit warm, a dozen fixed stars and a glow round the lamp). The look is a
    palette swap of the same drawings (`townLook` in `home-art/looks.ts`: the same parts at the same places, the same idle loop; only the night
    adds loose pixels, on pixels that are empty in every frame), picked once as the page loads, so it never swaps while you look; the sky is
    `.fd-town[data-sky]` in `styles.css`. The same in the light and the dark theme.
    The scene (`Scene` in `home-art/Pic.tsx`, its math `sceneLayout` in `home-art/layout.ts`, unit-tested) is drawn on a canvas,
    nearest-neighbor, at the biggest whole-pixel scale whose height fits the button (3 css px an art pixel on a phone, 2 on a computer; B's
    plain last 3 rows are cut when the box is a little short), down on the button's foot and centered; where the button is wider than the
    picture a narrow gap is filled by the ground's end column, a wide one (a computer) by the picture's own ends repeating, so the ground
    runs to the edge. It's drawn only when its frame changes (the loops are 4 to 5 frames a second, not every animation frame), still on
    the first frame under reduced motion. The side menu's **Chess Town** item opens the same page (the town has no side menu, so it
    never shows as the open page) with **the crest** (`arena-town-badge`, 40 px, its idle playing) as its icon in place of the crown;
    Boss Battle keeps the crown there. The crest isn't on the button.
  - **Other modes** (Oct 24, Eric: "a tiny text that says other modes, right below play"; Oct 26: three cards; Nov 1: two): an 11 px
    muted label under Chess Town's button (14 px under it on a phone), then the **Boss Battle** and **Auto chess** cards side by side, half
    width each (`rd-pair`, Eric, Oct 26). Every card has its picture to the left of its words (Oct 28, Eric: "there's plenty of space for
    them to sit to the left of the text"): the cards 56 px tall with a 32 px picture (28 px at 320 px wide), the name and one short
    line ("Any boss, up to 3", "Build an army") beside it, and no › (no room for it beside the picture at 390 px). **Boss Battle's picture
    is the rotating boss faces** (Nov 1; from the old Boss Arena card: a still of one boss you can meet, turning to the next every 30 s
    (`FRONT_DOOR.bossCardMs`) with a 0.6 s fade (`bossCardFadeMs`), never the Hidden Boss or a resting boss, the card's size fixed; it
    waits while the app is hidden, and under reduced motion there's no fade (`BossCardFace` in `components/BossSelect.tsx`; test switch
    `?cardMs=`); the crown it had is gone from the card). **Auto chess's picture is the army** (Nov 1: `arena-auto-card`, 32 px, its idle
    playing; it was the board's white knight). Auto chess opens `/autochess`, as Settings' Testing row does, with its back button home.
    PLAY takes the room the shorter options and cards gave back (Oct 26, Eric: "the play button is too small", 64 px;
    Oct 28: "make the play button bigger with the space we gain"): **97 px on a phone** (label 44 px), **76 px on a computer** (label
    40 px), 60 px in a computer's short window, under 760 px tall (was 48; label 32 px), and Chess Town's button is the same: it replaced a
    64 px card with a PLAY-sized one, so where the page had no room left the two give it back together (Nov 1): **a phone under 700 px tall**
    has them 97 px down to 80 px (at 666 px and below; the page keeps fitting from 360 × 640 up with no scrolling), and **a computer
    window 761 to 811 px tall** has them 76 px down to 70 px (the live window's board keeps its size, 233 px at most). 1440 × 900 and
    390 × 844 are as before, and a short laptop (1280 × 720) is 60 px as before.
    The title is Archivo, not Archivo Black: that file's lowercase i has no dot, so "raid" read as "raId" (Oct 24). "Other modes" is
    centered over the cards.
  - **The pictures' source** (Nov 1): the four drawings (`arena-town-skyline`, `arena-town-square`, `arena-town-badge`, `arena-auto-card`,
    in `packages/app/src/home-art/`) are the API's drawings from `origin/claude/boss-art` (`scripts/boss-art/out/<name>/<name>.ts`, with
    each one's `summary.md` there), copied as drawn, only their two import lines changed; `home-art/Pic.tsx` plays them with the
    bosses' own `renderFrame`. A new picture is a drawing there, copied here the same way.
  - **The Solo Boss Mode card** (Eric, Oct 26; half width; "Boss Battle", "Any boss, up to 3" since Oct 29) opens the **Boss Battle
    screen**, the Boss raid screen's solo form (below). Its picture is the crown from the side menu's old Boss raid
    item, drawn large in the card's gold (`CrownArt` in `screens/Home.tsx`): a placeholder until Opus draws one.
  - **The Boss raid screen: a character select** (Eric, Oct 16;
    [docs/decisions/2026-10-16-boss-character-select.md](../decisions/2026-10-16-boss-character-select.md);
    `BossSelect`): tall slanted tiles at the top like a fighting game's select grid, one per boss you can meet, each its
    boss's figure on a color of its own, all the same size with a small gap, six to a row on a phone (two rows on a wide computer, Nov 2:
    [docs/decisions/2026-11-02-boss-select-rows.md]), see also
    [docs/decisions/2026-10-23-boss-select-sf.md](../decisions/2026-10-23-boss-select-sf.md)), the Hidden Boss's dark
    and locked, and "?" for a random boss; under them a stage (the 1 v 1 stage's
    platform) with the picked boss in its idle, its name and its strength against you: skulls and Boss alone's level at
    your difficulty ("💀 Rating 1800 · Hard": the Maia rating it plays at, Oct 18; the difficulty named unless it's Normal), the same number Boss alone's menu
    shows, worked out by one function (`bossAloneElo`) and following the menu's difficulty as it changes. One number per
    boss: the raids show none
    ([docs/decisions/2026-10-17-boss-sheet-fit.md](../decisions/2026-10-17-boss-sheet-fit.md)). A tap drops the boss on,
    plays its sound once and says one of its lines (the boss section, [bosses.md](bosses.md)). Under the stage the ways
    to play. **Boss Battle** (Oct 26 as Solo Boss Mode; the home card and the side menu's item) shows **START** (Oct 29; it was the Boss alone button); the full
    screen (`?mode=raid`, the test link, titled "Boss Battle" too since Nov 10) shows every choice below, as before, until the raids move to
    Chess Town's Colosseum. Each choice goes through its flow: **Join a Boss Battle** and **People only** (the raid's queues, always a random boss:
    "Random boss · …"), **Play with bots** (a Solo raid against the boss picked), **Boss alone** (its menu: the
    difficulty and the boss picked; a phone's sheet at the foot under 600 px wide, a dialog in the middle with room all
    round from 600 px at any height, its rows scrolling inside so it always fits) and **Play with friends** (a raid made
    for the boss picked: the lobby's `bossPicked`; or join one by code). With the Hidden Boss picked every choice is
    locked (grayed out, a small lock). The pick is kept on the device (`brc.bossId`; the Hidden Boss never). A resting
    part disables its choices with its line under them; a resting boss has no tile (a pick of one reads as random).
    While a 1 v 1 search runs, a choice asks "Leave the 1 v 1 queue?" first (App's `leavingDuelFirst`).
  - **`/bosses`** (unlisted, not admin-gated; Eric's shortcut): opens the solo boss picker at once ("Choose your boss":
    every boss you can meet and a random one, and for an admin the Hidden Boss after them; the difficulty), over home.
  - Your icon (no coins at the top: the shop and your own profile show them, Eric, Oct 18), and the live line ("214 online · 9 matches running · 31 in queue") with the typical
  - **On a game's screen** (Nov 1, Eric: "the side menu… on the desktop still"; docs/decisions/2026-11-01-game-screens-computer.md):
    a computer with a mouse has the same side menu beside every game screen (`GameFrame`, `game-frame.css`): 232 px with labels from
    1800 px wide (round 2; 1366 before), icons only below it (labels as tooltips). An item leaves the match through the gear's own Resign or Leave confirm,
    then goes to its page. A phone and a touch tablet have none.
    wait above PLAY. The shop, your profile and Play with friends are in a phone's top bar and a computer's side menu,
    not on home's column (Eric, Oct 18; [docs/decisions/2026-10-18-play-at-the-bottom.md](../decisions/2026-10-18-play-at-the-bottom.md)).
  - **Play with friends** (the friends page's **Private lobby**, a computer's side menu): **Get friend code** makes a
    lobby in the row's pick (50 v 50 if none, or with 1 v 1 or Squads picked) and copies its invite link as it opens
    (the lobby screen says "Invite link copied: paste it to your friends"); join one by its code; **Your friends ›**
    (with "N new") opens the friends list. The full Boss raid screen's Play with friends makes a raid, as before (the
    Boss Battle form has none).
  - **The rank line under your name** (Oct 28, Eric: "get rid of the novice weighty … we're going with the new ranking
    system"): your ranked 1 v 1 rank (`RankLine`, `homeRankLine()` in `ranked.ts`): the tier and division in the tier's
    color, then the RP ("Gold 3 · 45 RP"), "Placement 2/5", or "Unranked" before your first ranked game (a blank line of the
    same height while your account loads). No rating rank's name: `RATING_RANKS` is retired
    ([2026-10-28-ranked-tiers.md](../decisions/2026-10-28-ranked-tiers.md)).
  - **An admin's test rank** (Oct 28: `?rank=gold-3`, only where `testSwitchesAllowed()`) shows in the rank line; a player sees their real
    rank. **Your level** (real since Nov 9; [2026-11-09-xp-box.md](../decisions/2026-11-09-xp-box.md)): a thin **green ring** round your
    icon, filled clockwise from the top to your share of the level, and a tiny **"LVL 7"** above it (`LevelRing` in `components/FrontDoor.tsx`,
    from `/api/me`'s `xp`), for everyone who can earn XP (signed in, or anyone where sign-in isn't set up). Both are drawn outside the
    icon's box and take no room, so home is the same size and shape with or without them.
  - **Your ride on home** (Eric, Nov 1: he equipped Riding Chirp and "it doesn't show on the main page on desktop"): the big pawn on
    your card, your ring (a phone's top bar) and the side menu's Profile item ride the ride you wear
    (`DressedPawn`'s `ride`, as the locker's preview and the profiles do; [2026-10-31-rides.md](../decisions/2026-10-31-rides.md)), its
    idle playing, fitted into the same box so nothing grows or moves; its hop (every 30 s) carries the pawn and its ride together.
    The same big pawn on a computer's queue screen rides too (it's the same card). Not your pawn in the queue's and Squads' small cards or a match's screens (still the pawn alone).
  - A screen that replaces home (a phone's queue, the Boss raid screen, home again) starts at its top. A match's Home
    and a closed lobby's note land on home itself; Cancel in a raid's queue goes back to the Boss raid screen (the full one).
  - **Phone:** a top bar (the logo, a **chat** button where the pawn was (Nov 11: the global chat as a full-screen sheet over home, `components/ChatSheet.tsx`; [decision](../decisions/2026-11-11-home-chat-profile.md)), the shop, **Friends** (with a count
    of requests and invites), then a gear that opens Settings in one tap (Nov 9: the icons a size bigger; Nov 10: Quests, the shop, Friends and the gear plain outlines in the text color, no fill, [decision](../decisions/2026-11-10-quick-fixes.md); the profile is the shop's square showing only your pawn's face, still: [decision](../decisions/2026-11-09-topbar-color.md)); a computer's are its side menu's, so none is
    there; [docs/decisions/2026-10-17-phone-settings-gear.md](../decisions/2026-10-17-phone-settings-gear.md),
    [docs/decisions/2026-10-18-play-at-the-bottom.md](../decisions/2026-10-18-play-at-the-bottom.md)), then one column: your card, the RANKED row, its panel, the line
    above PLAY and PLAY (Oct 28), then Chess Town's button (PLAY's size), then Other modes with Boss Battle and Auto chess side by side, at the bottom. Your pawn's card takes the room
    left: your tag (icon, name, "Gold 3 · 45 RP"; an admin's test version below) centered above your pawn's head, the pawn 75% bigger than before
    (170 × 154 → up to 298 × 270) and sized to the room the tag leaves (Oct 24). On a short card (under 190 px tall: a
    640 px phone, or a 740 px one (measured at 320, 375 and 430 px wide), since the options panel is there from the first view, Oct 25)
    the tag stands beside the pawn instead, as it did when the room was short (Oct 18), so home fits with no scrolling
    from 360×640 up in every mode. At 320×568 home fits too, with a small pawn (about 51 px).
    ([docs/decisions/2026-10-18-phone-home-fits.md](../decisions/2026-10-18-phone-home-fits.md)). Big tap targets, no
    sideways scroll at 320–430 px; a long name on your home card ellipsizes.
  - **Your profile (Nov 11):** "View profile" in the card's bottom-right corner (13 px words and its box at the bottom edge on cards under 110 px); `e2e/home-layout.spec.ts`, "View profile never covers your name".
  - **Portrait (Nov 11, Eric: rotation off on phones):** a phone held sideways (landscape, 500 px high or less) is covered by `#rotate-lock` in `index.html`; the installed app is locked by its manifest, and `main.tsx` asks `screen.orientation.lock` where a browser allows it.
  - **Computer** (1024 px+): a side menu, the play column in the center in the phone's order (Eric, Oct 18): the RANKED
    row, its panel, the line above PLAY and PLAY (Oct 28), then Chess Town's button (PLAY's size), then Other modes with Boss Battle and Auto chess side by side (a little shorter) at the
    bottom; the right column (Nov 7, Eric's mockup; the same place on every framed page: a 62 px slot, TOWN and its tools in the
    town; FRIENDS ›; the live line; the global chat, [chat.md](chat.md)). The pawn hops on a computer too (Oct 24: the hop was phone-only). Nov 11: no pawn or chat button in the top area on a computer.
    From 1280 px the play column starts with the **live window**: the featured real match (a matchmade one, most
    people, then newest) or, when none runs, bot-match replays played on a shared clock cycle so everyone sees the same
    moment (`LIVE_WINDOW`; replays in `packages/app/public/replays/crowd-bots.json`, never fetched on phones).
    A computer's only (`LIVE_WINDOW_MEDIA`: 1280 px wide, 600 px tall, a mouse; never mounted on a phone or tablet)
    and always silent, whatever the sound setting (its board is `silent`; Eric, Oct 12).
- **The live line** is GET `/api/live`: polled every `FRONT_DOOR.livePollMs` while a front-door screen shows it, every
  `heartbeatMs` elsewhere (a match), never while the tab is hidden; a request with no answer is given up after `liveTimeoutMs` (10 s,
  Nov 11: one that never answered stopped every later one, and the chats riding on it). The same request says you're here. Online = seen
  within `onlineWindowMs`. The numbers come from the live hub (see [ops.md](ops.md)). Squads' lobbies report to the
  hub too (Oct 15) but stay off this line: they count for the overload limit and the ops health view only.
- **The queue screen:** the lobby's seats fill on screen (people, then bots popping in after the fill time), the wait
  so far, "Switch to Default" in Bots off. The match starts in place.
- **Profiles** ([docs/decisions/2026-10-28-public-profile.md](../decisions/2026-10-28-public-profile.md), [2026-10-29-public-profile-fit.md](../decisions/2026-10-29-public-profile-fit.md)). Two screens:
  - **The public profile** (`screens/PublicProfile.tsx`, Eric's mockup of Oct 28): the one page every player has, the same for every
    viewer, opened by a tap on another player's name or face anywhere (`PlayerName`, the queue's pawns, the town card, a lobby; the
    address `/profile/<id>`). Back, "Player Profile", ••• (Block, Report); their dressed pawn in a circle over their icon (blurred and
    faded; the theme's light yellow with the default pawn) with a green dot while they're online; their name; "Online now · Joined
    Oct 2026" (or "Last seen 2h ago · …", or just "Joined …" if they hide it); "Level 7" (everyone's, from their XP, since Nov 9; the line is there while the page loads); **Challenge** (today's invite) and **Add Friend** (today's request), both greyed on your
    own page, for a guest, while loading and for someone you blocked; then three cards: **Ranked Standing** (1v1 / 50 v 50 /
    Squads menu, "Season 1": the 1v1 emblem, tier and division, RP, peak rank, win rate, W / L, win streak; "Placement 2/5",
    "Unranked", "Banned" and "Coming soon" in the same room), **Recent Matches** (the last five games in any mode, a ranked 1 v 1's
    RP change; "View all" opens today's list) and **Equipped Cosmetics** (one row of compact tiles, three or four, each a picture, name, "<Slot> · <colors>" and a rarity pill; "View all" opens each
    item's purity and Shiny). One column on a phone; from 744 px wide two (header, Ranked beside Recent, Cosmetics). Nothing private: no
    email, sign-in method, age, the hidden 1 v 1 rating or fair-play details; the icon is public since Oct 28. Its words are in
    `public-profile.ts` (tested), its styles `public-profile.css`. **Every size and space is Eric's mockup's, measured from the image**
    (Oct 29, [the fit decision](../decisions/2026-10-29-public-profile-fit.md): its tables hold every padding and gap; a change to the page
    keeps them, and a number is never set by eye). Nothing hidden, nothing shifts: it loads as the same markup on gray bars, the Ranked
    card is one height in every mode, every list keeps its room, and a note is a toast over the page's bottom.
  - **Your own profile** (`screens/PlayerProfile.tsx`, from your own pawn; what a profile showed before the public one, Oct 28):
    your 1 v 1 rank's pill once you've played a ranked game (Oct 28: the rank shown everywhere), "Rating 1612" (the crowd
    rating's number, no rank name) and "Top N%" (once `percentileMinPlayers` have ratings), your coins, Edit name & icon, locker,
    Friends, the rating chart, stats (Crowd, Boss raid), "Boss tiers beaten" (online raids only: a solo win is the browser's word),
    recent matches, what you wear, a "1 V 1" section (your rank, tier, division and RP, or "Placement N/5", and your record), Quick
    chat, Settings; **View public profile** at its top opens yours as others see it. A bot or someone with no account gets a card
    that says so.
- **Ranked 1 v 1's way in** ([ranked.md](ranked.md)): `/1v1` queues in one tap; the home screen's button (not built
  yet) calls `startRanked1v1()` (`packages/app/src/duel.ts`) and shows `ranked1v1Label()` (`packages/app/src/ranked.ts`:
  the rank's label from the profile, null until it loads). The first-time pawn-vote hint is `VoteHint`
  (`components/VoteHint.tsx`, once per device: `brc.voteHintSeen`), for every pawn vote to use.
- **Friends** (Oct 15; [docs/decisions/2026-10-15-friends-and-invites.md](../decisions/2026-10-15-friends-and-invites.md); the rules and data on [accounts.md](accounts.md)):
  - **The friends page** (`/friends`, `screens/Friends.tsx`; Eric, Nov 11, [decision](../decisions/2026-11-11-friends-page.md): it replaced the Nov 9
    pop-up): Back, a search box (names starting with what's typed, any case, from 2 characters, 250 ms after typing stops: `GET /api/friends/search`,
    public fields only, banned, test accounts and, where sign-in is set up, guests left out; its own rate limit), the results in a fixed-size box over
    the page (icon, name, level; a tap opens their profile, where Add Friend is), **Private lobby** ("Make one or join with a code": Play with friends'
    sheet), **Online** (each with what they're doing: the app's live line says `?doing=`, core's `ACTIVITIES`,
    kept in the live hub's memory beside "in a match"; Invite) and **Offline** ("Last online 2h ago", Invite greyed), then invites and friend
    requests when any (under the lists, so nothing above them moves when they arrive: fix round, Nov 11), then "Requests sent and blocked ›"
    (Cancel, Unblock) and Settings. The query and hash stay on the address in and out of `/friends` and a profile opened from it (test switches, links). The page watches the live line (`watchLive`) while open: its inbox count is how a new request or invite reaches the list. The search reads
    `users_name`, or `users_name_signed` (partial: signed-in accounts only, its WHERE the search's own text) where sign-in is set up, ordered by
    the name alone so LIMIT stops after six rows (never every guest named "Player").
  - **Known staleness (accepted):** `doing` can be a moment stale across Worker instances: two instances' batches can reach the hub out of order
    (the town, then home from another instance flushed first), and the list shows the older activity until the next 30 s heartbeat. Same as
    `busy` today (`presence.ts`, `live.ts`); not worth ordering the batches.
  - **Where:** a phone's way in is **Friends** in home's top bar (the page above), or Friends on your own
    profile, each with the count of requests and invites (Eric, Oct 18: home's line above the live line is gone,
    [docs/decisions/2026-10-18-play-at-the-bottom.md](../decisions/2026-10-18-play-at-the-bottom.md)); a computer's right column has "FRIENDS ›" (Nov 7: the list and its Invite buttons went with Eric's mockup; requests' count
    beside it). Both open the friends page.
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
  phased to an admin only menu for testers"). Practice mode counts only where the test switches do (`prefs.ts`:
  `practiceOn` reads `testSwitchesAllowed()`: an admin, a server with TEST_SWITCHES on, Vite's dev server). For players
  practice is off, whatever the device stored (`brc.practice`). Online the lobby checks too: a `hello`'s practice counts
  only from an admin's socket or where TEST_SWITCHES is "1" (`lobby-do.ts`).
- **The eval bar: off for everyone** (Eric, Nov 1: "it should never actually be displayed… we can keep it in the
  settings for now, but disable it… Nothing gets resized when the eval bar isn't enabled"; decision:
  docs/decisions/2026-11-01-eval-bar-off.md). `evalBarOn()` is false on every device, testers and test servers too, so
  `EvalBar` draws nothing on any board (the play, reveal, vote, final and boss screens) and every board takes the room
  a player's always has, centered, on a phone and a computer. Settings → Testing keeps its "Eval bar" row, switched off
  and not tappable ("Off for now"); a stored `brc.evalBar` is ignored. The value is still worked out (the God King's
  word on how it's going reads it). Each result records it (`results.eval_bar`: 1 on, 0 off, NULL from older apps),
  from solo's post and the online `hello`: every device's reads 0 since Nov 1.
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
- **Coming back from another app** (Eric, Nov 3, iPhone: the sound was gone after switching apps): the page coming back
  (visibilitychange, pageshow, focus) tries `resume()`; the first tap or key after it (`wakeAudio`, a capture listener ahead of
  the page's) makes a new audio context if the old one isn't running with its clock moving (iOS: suspended, interrupted, closed,
  or "running" but stopped), warms the boss sounds again and moves the Colosseum's ambience to a new element
  (`onAudioRebuilt`). That tap's own sound plays as the new context wakes; nothing plays while the page is hidden. The old
  context is closed at once, unless a listener still needs it: the boss music fades out on it once the new one has taken over (Nov 14,
  at most 2 s; [bosses.md](bosses.md) "Music").
  `packages/app/test/sound-return.test.ts`, `e2e/sound.spec.ts`; docs/decisions/2026-11-03-sound-after-app-switch.md.
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
| Searching while you browse (every queue): the state, the bar | `packages/app/src/search.ts`, `components/SearchBar.tsx`; home's rows in `screens/Home.tsx`; the lobbies' Exit in `screens/Queue.tsx` (`useQueueExit`) |
| Screens | `packages/app/src/screens/Home.tsx` (home, the RANKED row, Chess Town's button, the Other modes cards (Boss Battle, Auto chess), the Boss raid screen and its Solo Boss Mode form), `Landing.tsx`, `Queue.tsx`, `Profile.tsx`, `PlayerProfile.tsx` (yours), `PublicProfile.tsx` (everyone's), `Settings.tsx`, `Lobby.tsx`, `Legal.tsx`, `Friends.tsx` |
| Friends' pieces (rows, the live panel's section, the toast, Invite friends, the settings, a profile's buttons) | `packages/app/src/components/Friends.tsx`; the list and actions `friends.ts` |
| The computer's frame and menus | `components/FrontDoor.tsx`, `FrontMenu.tsx`, `LiveWindow.tsx`, `LiveNumber.tsx`, `MiniBoard.tsx`, `TinyBoard.tsx`, `LeaderboardSheet.tsx` |
| Names and icons everywhere | `components/PlayerName.tsx`, `PixelIcon.tsx` (`UserIcon`), `profile-nav.ts` |
| The public profile's words and numbers, shared pieces | `packages/app/src/public-profile.ts` (+ `test/public-profile.test.ts`), `components/ProfileParts.tsx` (what they wear, recent matches, the report sheet), `public-profile.css` |
| The live line, app side | `packages/app/src/live.ts` |
| The FAQ (its words and numbers; the format; the screen) | `packages/app/src/faq/content.ts`, `faq/markdown.ts`, `screens/Faq.tsx` |
| Light and dark (Settings → Theme; the gear's Light / Dark row, Nov 1) | `packages/app/src/theme.ts`; `components/MatchMenu.tsx` (`ThemeRow`) |
| Piece sounds (the pickers' options, storage) | `packages/app/src/piece-sounds.ts`; played by `sound.ts`; files in `public/sounds/` (the classics) and `public/sounds/pieces/` (from `scripts/piece-sounds.py`); sources in `public/sounds/SOURCES.md` |
| Bot-match replays | `packages/app/src/bot-replays.ts`; made by `npm run replays:bots` (`packages/sim/scripts/bot-replays.ts`) |
| Server: profiles, results, the API | `packages/server/src/accounts.ts`, `api.ts` |
| Server: the live line | `packages/server/src/live-hub.ts`, `live.ts`, `presence.ts` |
| What a profile works out (ranks, percentiles) | `packages/core/src/profile.ts` |
| Styles | `packages/app/src/styles.css` (the front door's sections) |

## Settings

`FRONT_DOOR`, `LIVE_WINDOW`, and the matchmaking settings on [matchmaking.md](matchmaking.md).

## Tests and tools

- Unit: `packages/server/test/accounts.test.ts`, `live.test.ts`, `packages/core/test/profile.test.ts`, `packages/app/test/public-profile.test.ts` (the public profile: the online line's forms, the merged recent list, the rarity and color text, the stats),
  `packages/app/test/theme.test.ts`, `under-board.test.ts`, `king-attack.test.ts` (the eval bar is off for everyone),
  `piece-sounds.test.ts` (the piece-sound picks: storage, fallback, files), `testers.test.ts` (practice mode, and the
  eval bar off for everyone), `faq.test.ts` (the FAQ: contents against sections, links, every boss, numbers following the
  settings); `packages/server/test/lobby-do-practice.test.ts` (online practice: testers only).
- e2e: `e2e/front-door.spec.ts`, `home-ranked.spec.ts` (the RANKED row at 320-390 px and on a computer, home keeping still through every click
  (PLAY, the line above it, the board preview, Chess Town's button and the panel within 1 px, at 320 and 390 px and 1280-1920 px), "home, said
  once" (Oct 28: no ⓘ, titles only, the line above PLAY, the cards' pictures beside their words, PLAY's height, Chess Town's button PLAY's size, a phone fits) and "test rank
  and level" (an admin's `?rank=`; everyone's real level ring and LVL from their XP, Nov 9; a player's real 1 v 1 rank), 1 v 1's PLAY,
  the Boss raid screen (`?mode=raid`) and each of its choices, `/bosses`), `boss-select.spec.ts` (the character select: a
  tap's drop, sound and line, "?", the Hidden Boss dark and locked and never named, the pick reaching Boss alone, a Solo
  raid and a raid you make, resting bosses, the layout at 320-1280 px, the card turning; Boss alone's menu and
  `/bosses` fitting 1280×600 to 1920×1080 and phones at 320-390 px, its last row reachable; one number per boss, the
  stage's and the menu's and the battle's), `landing.spec.ts`, `home-layout.spec.ts`, `live-window.spec.ts`, `profile.spec.ts`, `public-profile.spec.ts` (the public profile on a phone and a computer at 1280 and 1440: every card, the 1v1 menu with the card the same height in every mode, the icon behind the pawn, the level line, nothing shifting while it loads, your own page greyed, Challenge, Add Friend, Block and Report),
  `profile.spec.ts` also checks that home's pawn and your ring ride your ride in the same boxes (Nov 1), at every ride's 0.75 and as drawn too (`?rideScale=1`), and ("rides lazy", Nov 1) that while a ride's drawing (its own chunk) is held back home's pawn and ring, your profile's pawn and the locker's tile keep the same boxes, the pawn sitting where it will ride, the ride appearing under it; `crate-banner.spec.ts` also the crate pages' gambling warning (shop.md);
  unit: `packages/app/test/home-art.test.ts` (the 50/50 pick and `?town=`, the scene's whole-pixel layout at phone, computer and short-laptop sizes, the four drawings' frames, the clock's three skies and `?sky=`, and that each look keeps every pixel in its place); `home-polish.spec.ts` also checks Chess Town's button under the three skies (the clock's edges, `?sky=`, nothing moving, no swap while you look);
  `install.spec.ts`, `crate-banner.spec.ts`, `friends.spec.ts` (two players: request, accept, online, the invites
  setting, an invite joined from its toast, a block; the friends page: search, profile, accept, "In Chess Town", phone and computer), `eval-bar.spec.ts` (never shown, testers
  too: the Testing row shown, off and disabled, the board's room, phone and computer; players: no bar, no switch), `piece-sounds.spec.ts`
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
- Home's boxes get their heights from fixed sizes, never from the font showing (Oct 28): the play column is anchored to the
  bottom, so a card that is 3 px taller for the moment Archivo loads moves everything above it. Short names get
  `white-space: nowrap`, and a text whose `normal` line height differs between Archivo and the fallback font gets a px one. Run
  the guard (`home-ranked.spec.ts`, "Eric's rule") with `--repeat-each=16 --workers=4`: one run in five failing means something
  moves late. A `PerformanceObserver` of type `layout-shift` in the page names what moved and when.
  Since Nov 13 the three fonts (Archivo, Archivo Black, Press Start 2P) are preloaded in `index.html`, fetched beside the app's script,
  so they're in by its first paint and nothing reflows when one arrives (crate-banner:44: the pixel font's swap moved the crates' rows 5 px).
