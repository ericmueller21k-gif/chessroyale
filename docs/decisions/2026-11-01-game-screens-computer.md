# A computer's game screens: no title line on a boss battle, the side menu back, the board as big as fits (Nov 1, 2026)

Lane: the director's (every game screen with a board). Area pages: [board.md](../areas/board.md), [bosses.md](../areas/bosses.md),
[hub.md](../areas/hub.md) (the side menu is the front door's). Code: `packages/app/src/game-frame.css` (new, loaded after
`board-size.css`), `components/FrontMenu.tsx` (`GameFrame`, `SideMenu` with `game`), `screens/Hud.tsx` (`BossTools`, the boss
title line's removal), `screens/Boss.tsx` (`BossBar`'s `move`), `App.tsx` (`sideNav`, `sideNext`, the wrappers), `screens/Duel.tsx`
(`DuelFront`'s `gameFrame`), `board-size.css` (the room, `--win-w`), `styles.css` (`--win-w` in the places that read the window's
width). Tests: `e2e/desktop-board.spec.ts`, `e2e/board-layout.spec.ts`.

## Eric's words (Nov 1, on the mockup: "Build it")

> "the gear, the boss move one bar, all of that needs to be… completely gone from the top… We don't need it to say boss… big boy
> and then move one… the lightning bolt, the fish and the setting thing can go to the right side of the board… the top bar…
> pushed right up against the web URL thing… too big of a buffer at the bottom… whatever happened to the side menus… we should be
> having that on the desktop still… there's in fact no way to even exit this because the left side menu is gone."

## The rule

A computer (a window 900 × 600 and up with a mouse: `(hover: hover) and (pointer: fine)`, `MOUSE_LAYOUT`) gets three things. Phones
and touch tablets are unchanged to the pixel (`desktop-board.spec.ts`'s touch test, unchanged).

1. **A boss battle has no title line.** Boss alone, a raid and the Crowd's boss final: the boss's bar is the top of the window, its
   "Move N" left of "60 moves left". The ⚡, the fish (admins) and the gear sit at the top of the column beside the board, the move
   list 36 px under them. The vertical room is 123 px (the bar's 6 px above, 8 below, the dock's row 34 px, its 6 and 8, the tallest
   bar, Puddles' 61 px). The Hidden Boss's phases keep their title line (`Hud`'s `keepTitle`: not named in the brief).
2. **The side menu is on every game screen** (Boss alone, a raid, the Crowd, its vote and reveals, 1 v 1, Squads, Auto chess, the
   results, a lobby): the front door's own `SideMenu`, in a grid column beside the screen (`GameFrame`). **232 px with its labels
   from 1800 px; below 1800 px icons only** (round 2; round 1 had 1366), each label visually hidden (still read by screen readers)
   and shown as a tooltip.
   Every screen lays out in what's left of the window (`--win-w`: 100vw less the menu).
3. **Leaving through the menu is the gear's leave.** An item on a match's screen asks the same confirm the gear's Resign or Leave
   asks (`ConfirmExit`, the match's own `exitFor`, a 1 v 1 game's resign, a Squads lobby's `squadsExit`, auto chess's "Leave this
   game?"). Cancel keeps the game. Once it's out (a resign's result, the server's answer, the duel over, the squad out), the page the
   item asked for shows. A game with nothing to leave goes at once.

## The sizes (the board's drawn side, px; before = main at a2f721a; after = this branch's head)

Round 2 target (the director's brief, round 2): every screen's board at least main's at 1280 × 640, 1280 × 800, 1366 × 768,
1440 × 900 and 1920 × 1080, and bigger where the window allows. Every row meets it. The board is drawn in whole multiples of 8
device pixels, so the drawn side is up to 8 px under its wrap.

| Screen | 1280 × 640 | 1280 × 800 | 1366 × 768 | 1440 × 900 | 1920 × 1080 |
| --- | --- | --- | --- | --- | --- |
| Boss alone (Puddles) | 440 → **512** | 600 → **600** | 568 → **640** | 696 → **760** | 880 → **952** |
| A raid (a Boss raid, Puddles) | 440 → **456** | 456 → **456** | 536 → **536** | 616 → **616** | 880 → **944** |
| Crowd 50 v 50 (and its vote) | 456 → **456** | 456 → **456** | 536 → **536** | 616 → **616** | 904 → **904** |
| 1 v 1 | 464 → 464 | 624 → 624 | 592 → 592 | 728 → 728 | 904 → 904 |
| Squads | 408 → 408 | 504 → **504** | 536 → **536** | 664 → **664** | 848 → 848 |
| Babur, Boss alone (`tiger`) | not measured on main → **512** | 536 → **536** | 568 → **624** | 680 → **680** | 880 → **952** |

Round 1 (before this round) had the menu's width taken from every width-bound screen: a raid, the Crowd and Squads were 152 px short
of main at 1366 and 1440, Babur 80 to 232 px short. Round 2 gives that room back (the next section).

Reading the table:

- **Boss alone is height-bound at 1280 × 640 and 1920 × 1080** (512 and 952) and **width-bound at 1280 × 800 and 1440 × 900** (600 and
  760: the boss's column, the eval bar and the column beside the board take the width the menu leaves).
- **1024 × 768** (not one of the five sizes): Boss alone is 440, 24 px short of main's 464 (round 1: 384). Not analysed further; the
  900 to 1099 px layout (his box at 1×, the column at its 280 px least) is what's left to look at. A raid and the Crowd are not
  measured at that width.
- **Between 1800 and 1856 px wide** (by the layout's arithmetic, not measured): the full menu's 232 px makes a raid width-bound below
  main's 880 (824 at 1800 px wide, 864 at 1840). From 1856 px it is at 880 again. If that band matters, the labels' breakpoint (1800)
  is the call to move.

## The calls I made

1. **The room is 123 px for every boss battle, not each boss's bar** (as Oct 29): the tallest bar (Puddles, 61 px) fits, the board
   doesn't change size from one boss to another. The paddings went down to make it fit: 6 px above the bar and 8 px under the dock (was
   10 and 14), the gaps as margins, not row gaps.
2. **The menu's width is in the layout, not overlaid:** the screens take the window less the menu (`--win-w`), so nothing sits under
   the menu and the board's centering is unchanged. A phone or a touch tablet gets no menu at all: the front door's `.fd-side` shows
   at 1024 px and wider whatever the pointer, so `GameFrame` doesn't draw it there (a touch tablet's screen would move otherwise). The
   frame element is the same either way (`display: contents` without a mouse), so a window that crosses the line keeps its screen.
3. **Icons only below 1800 px, from the front door's own menu** (not a new one), with the labels visually hidden and as tooltips: a
   screen reader still hears "Boss Battle" and so on. The logo is "HC" below 1800 px (its text doesn't fit 80 px). (Round 2: 1800, not
   1366: at 1366 and 1440 the labels would take 152 px more of a board that has no room to spare.)
4. **The menu's leave goes through the match's own exit,** not a new one: each screen's `MatchExit` (the gear's confirm, the same note
   and buttons), then the page. `sideNext` waits for the match to be out: a solo resign goes to its result first, so the page shows
   once the result is gone (`match.phase` results, a duel `over`, a squad's `resigned`, auto chess left).
5. **The admins' ⚡ and 🐟 move with the gear** into the column (the title line's `match-tools` are the same elements); they're admin
   tools and shown only to admins, as before.
6. **Boss alone's bank time** (`BankTime`, the title line's "your total time left") showed nothing in Boss alone (there's no bank for
   you there), so nothing moves. The dock's clock (`DockClock`) is the battle's clock, as before.
7. **No "Board size" setting** (the brief: the new layout replaces today's; Eric can ask for a Compact one later).

Round 2 (the director's brief: no board may shrink because of the side menu):

8. **The menu's 80 px come back from what sits beside the board, never below what it needs:** the right column is 280 px where the
   board is width-bound and 340 px where its height is the limit (`--side-w`, a clamp in `board-size.css`; the screen takes the
   width either way); a leaderboard beside the board is 340 px (was 360; names ellipsize, the numbers fit: checked in a still); Boss
   alone's empty column is 196 px (was 216; 240 without the eval bar, as before). Babur's column is 153 px + his share of the
   window's height (was 170 + …): his pump keeps its place (its left edge in the window, checked by the geometry).
9. **His words and the God King's words stay in the window:** a speech box's width is at most its column (Boss alone's words: at most
   196 px, so the box's left edge stays at the window's content edge), and the God King's words open at most `--side-w` less 98 px
   (they ran 44 px off the window at 1440 × 900 once the board grew: `SpeechBox`'s own fit runs once, when the line starts, not on a
   resize). Both wrap more than before; the font is unchanged.
10. **The God King's column** (`--gk-column`, what the boss-dock's own sums read) uses the same `--side-w`.

## Tests (changed checks, old → new)

None of these guards a rule in `docs/rules/eric.md`. The gear's guard (`e2e/match-menu.spec.ts`, "the gear on every screen with a
chessboard") is unchanged; its title-line test is on the Crowd, which keeps its title line.

Round 2 (this list is the whole change since round 1):

- `e2e/desktop-board.spec.ts`:
  - `NOW` (drawn sizes at 1920 × 1080, 1440 × 900, 1366 × 768, 1280 × 800): alone 1440 528 → 760, 1366 448 → 640, 1280 × 800
    520 → 600, 1920 952 (same); raid 1920 864 → 944, 1440 384 → 616,
    1366 304 → 536, 1280 × 800 376 → 456; Crowd and vote 1920 864 → 904, 1440 384 → 616, 1366 304 → 536, 1280 × 800 376 → 456;
    1 v 1 unchanged; Squads 1440 432 → 664, 1366 352 → 536, 1280 × 800 424 → 504, 1920 848 (same).
  - `MAIN` (the sizes main must not be smaller than): the old constants were main's of Oct 29 (alone 1920 552, 1440 552, 1366 480,
    1280 × 800 456; raid the same; Crowd 552/552/536/456; 1 v 1 704/648/512/544; Squads 600/600/536/504). Now main at a2f721a, the
    sizes round 1 measured: alone 880/696/568/600; raid 880/616/536/456; Crowd and vote 904/616/536/456; 1 v 1 904/728/592/624;
    Squads 848/664/536/504. The check: "never smaller than main's, less the side menu's width" (an allowance of 80 px below 1366,
    232 from there) → "never smaller than main's" (no allowance). `MENU` is gone.
  - Babur's sizes (`tiger`, Boss alone): 1280 × 800 456 → 536, 1920 × 1080 896 → 952, 1366 × 768 400 → 624, 1440 × 900 448 → 680.
  - "a computer's game screens: the side menu…": the labels' breakpoint 1366 → 1800 (icons at 1280 × 800, 1366 × 768 and 1440 × 900;
    labels at 1920 × 1080, 232 px wide). The check's own width and label checks are the same.
- `e2e/board-layout.spec.ts` (the computer test, Boss alone and a raid):
  - `MAIN_TOWER` (the raid's scoreboard): 1280 × 800 x 90 w 360 → w 340; 1440 × 900 x 10 → 90, w 360 → 340; 1920 × 1080 w 360 → 340.
  - `MAIN_BOARD_BOX` (Boss alone, x, width): 1280 × 800 344, 520 → 324, 600; 1440 × 900 496, 528 → 324, 760; 1536 × 864 496, 624 →
    351.5, 736; 1920 × 1080 521.5, 952 → 511.5, 952; 1024 × 768 176, 384 → 176, 440.
  - `RAID_BOARD_BOX` (1280 × 800): 488, 376 → 468, 456.
  - "the same width" (the column: exactly 340) → "the column's width" between 279 and 341: 340 where the height is the limit,
    280 where the width is. (The column is `--side-w`.)
- Not changed: `ROOM`, the touch tests (phones and tablets to the pixel), the "moves" and "God King" geometry checks, the boss screen's
  title-line test, the side menu's confirm test.

Round 1 (kept for the record; numbers superseded by the table above):

- `ROOM` (the room above and below the board): `alone` 200 → 123, `raid` 200 → 123 (the others unchanged).
- "the moves from the board's top" → 36 px under the board's top on a boss screen (the tools' row above them), 0 on the Crowd and
  the others; the tools themselves at the board's top.
- New: "a computer's boss screen: no title line…", "a computer's game screens: the side menu is on each…", "a computer's side menu
  on a boss battle: its confirm first…".
- `e2e/board-layout.spec.ts`: "level with the board's top" → 36 px under it (the tools above); "half the height" keeps its formula with the
  floor the CSS has always had: 120 px.
- `e2e/desktop-board.spec.ts` "the straight with the board's left edge" check: it compared the title line's box, which a boss screen no
  longer has; it now compares what's there (a `filter`), the same check.

Run locally (round 2, this branch's build, the local wrangler on a spare port): `desktop-board.spec.ts` 13 of 13 (twice, the second
after the God King's words and the speech box's fix); `board-layout.spec.ts` "a computer: Boss alone has no scoreboard…" 1 of 1.
Measured, not asserted: the geometry of every screen at 1280 × 640, 1280 × 800, 1366 × 768, 1440 × 900, 1920 × 1080, 1536 × 864,
1024 × 768 (round 2's measure: the board's wrap and the column boxes; the ones above are from it). Not run locally (CI): the other
area specs, `boss-speech`, `tiger`, `boss-dock`, `gardener`, `hopper`, which draw these screens' words and pump; the words' width
changed (above).
