# Boss alone's menu fits any window; one rating per boss (Oct 17, 2026)

Eric, Oct 17, from a photo of Chrome maximized on a Windows laptop (the taskbar below): Boss raid screen, Sawyer
picked, then **Boss alone**. "It's like sitting at the bottom and… there's no way I can drag it… It's literally attached
to the bottom of the screen." The same photo showed a second problem: the stage said "💀 Rating 1350", the menu's row
for the same boss "1600 ≈ your level" (Eric rated 1580, Hard picked). Lane: `hub` (the director's brief). Area pages:
[hub.md](../areas/hub.md), [bosses.md](../areas/bosses.md).

## Why the menu ran off the window

- Boss alone's menu (and the `/bosses` picker: `BossMenu`, `.boss-menu`) was a phone's sheet glued to the foot of the
  window (`align-items: flex-end`, square bottom corners) everywhere except windows at least **700 px tall** and 600
  wide (`@media (min-height: 700px) and (min-width: 600px)`). A maximized Chrome on a 1080p laptop at 150 % (or 720p
  at 100 %) leaves about 550 to 650 px for the page, under that line: so on Eric's laptop it was a bottom sheet,
  its last row flush with the window's bottom edge, where the taskbar sits. Any part of the window behind the
  taskbar hid the row, and a sheet stuck to the bottom reads as one to drag.
- Not the other causes the brief named: no ancestor has a transform, filter, `contain` or `container-type` (measured
  in the page: the overlay's box is the window's at every size), the page scrolling under it moves nothing (it's
  `position: fixed`), and its height was capped (94 % of the window, the rows scrolling inside).
- The game's leaderboard sheet and Squads' standings sheet (`.tower-overlay`, opened by a tap on the strip over the
  board) were the same: a bottom sheet at every width. The front door's other sheets (`.fd-sheet`: Play with friends,
  a Squads party, a profile's, bug reports, chat notices) already sit in the middle from 640 px, at any height, capped
  at 92 % of the window and scrolling inside: measured at every size below, they fit. The match menu's sheet
  (`.mm-sheet`) is a phone's only (a computer has the flag and its pop-up instead), so it stays.

## What changed

- **From 600 px wide, at any height, the menu is a dialog in the middle of the window** with 16 px of room all round
  (as the front door's other sheets are on a computer), its corners all rounded. My call: that's how the app's other
  computer sheets work, and a dialog in the middle can't be mistaken for something to drag. Under 600 px (phones in
  portrait) it's the same sheet at the foot as before: the look kept.
- **It always fits:** at most the window's height less that room; the rows scroll inside it (as before), never
  squeezed below one row (`min-height`); on a window too short even for that, the whole menu scrolls
  (`overflow-y: auto`, `overscroll-behavior: contain`, so a scroll in it never moves the page under it).
- The leaderboard's and Squads' standings sheet (`.tower-overlay`) the same way: in the middle from 600 px, room all
  round; a phone's unchanged.

## One rating per boss

The rule: **before a battle, a boss has one number on screen: Boss alone's strength at your saved difficulty.**

- The stage (`BossSelect`) and Boss alone's menu work it out with one function, `bossAloneElo(rating, boss,
  difficulty)` in `boss-difficulty.ts`: the tier a step above your rating, plus the boss's offset, plus the difficulty,
  exactly what the battle gets (App's `overridesFromUrl`: `bossFixedElo` and `bossDifficulty`; the runner's
  `bossStrength`). A test reads the battle's own strength after the menu's tap.
- The difficulty is the Boss raid screen's state (it was the menu's own): a tap in the menu changes the stage's number
  behind it at once, and both are remembered on the device as before (`brc.bossDifficulty`).
- The stage names the difficulty when it isn't Normal, so the number says what it's for.
- **The raids keep their own strength, and show no number:** a Solo raid (Raid with bots) meets the boss at your tier
  plus its offset with no difficulty on top: the stage's number at Normal. Join a raid and People only are always a
  random boss, its strength from the people in the raid (the server's `raidBossElo` over the humans' stored ratings as
  the match starts, plus the boss's offset; bots don't count). Play with friends is the same, over the people who join
  (a test link's `?boss=<tier>` fixes it). None of these can be known on this screen, so none is shown, and the stage
  is the only number.
- "?" (random) and the Hidden Boss (locked) show no number, as before.

### Every text that changed

| Where | Before | After |
| --- | --- | --- |
| The stage, Normal | "💀 Rating 1350" (no difficulty) | "💀 Rating 1350" (unchanged at Normal) |
| The stage, Easy | "💀 Rating 1350" | "💀 Rating 1050 · Easy" |
| The stage, Hard | "💀 Rating 1350" | "💀 Rating 1600 · Hard" |
| The stage, Hardest | "💀 Rating 1350" | "💀 Rating 1850 · Hardest" |
| FAQ, "Brain" section | "The Boss raid screen shows the boss you picked at its strength against you, and Boss alone's menu shows it with your difficulty and how far it is from yours ("+200 vs you"); 1 to 5 skulls show how dangerous it is." | "The Boss raid screen shows the boss you picked at Boss alone's strength against you, with your difficulty (named unless it's Normal), and Boss alone's menu shows the same number and how far it is from yours ("+200 vs you"); 1 to 5 skulls show how dangerous it is. A Solo raid (Raid with bots) has no difficulty on top: the stage's number at Normal." |

(The examples are Sawyer's for a player rated 1580: tier 1600, offset −250. The skulls follow the number, as before.)
The menu's own texts are unchanged.

Oct 25 (Eric): the stage shows no number or skulls, only the difficulty's name when it isn't Normal. Boss alone's menu keeps its number. Later the stage will show the boss's level.

## Tests

- `e2e/boss-select.spec.ts`, "fit any window": Boss alone's menu (an admin's, with the brain picker: its tallest) and
  the `/bosses` picker (every boss: its longest list), at 1280×600, 1280×720, 1366×768 and 1920×1080 (computer) and
  320, 360 and 390 px (phones): its box inside the window, on a computer with 16 px of room above and below; its last
  row scrolled to, inside the window and the list, and clickable (a trial click). It failed before the change at
  1280×600 (room below: 0).
- "one number per boss": Sawyer, Ginger and Big Boy at Easy, Normal, Hard and Hardest (rated 1580): the menu's row and
  the stage give the same number, the expected one (1600, 1350, 1200, 2000, 1600), the difficulty named on the stage;
  still so after the menu closes and after a reload; the widest line (five skulls, Hardest) on one line inside 320 px.
  It failed before the change (the stage said 1350 against the menu's 1600).
- "the pick reaches…": the battle's own strength is the menu's number (Boss alone, Hard) and the stage's at Normal (a
  Solo raid).
