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
   from 1366 px; below 1366 px icons only**, each label visually hidden (still read by screen readers) and shown as a tooltip.
   Every screen lays out in what's left of the window (`--win-w`: 100vw less the menu).
3. **Leaving through the menu is the gear's leave.** An item on a match's screen asks the same confirm the gear's Resign or Leave
   asks (`ConfirmExit`, the match's own `exitFor`, a 1 v 1 game's resign, a Squads lobby's `squadsExit`, auto chess's "Leave this
   game?"). Cancel keeps the game. Once it's out (a resign's result, the server's answer, the duel over, the squad out), the page the
   item asked for shows. A game with nothing to leave goes at once.

## The sizes (the board's drawn side, px; before = main before this change, measured on this branch at a2f721a)

The board is drawn in whole multiples of 8 device pixels, so the drawn side is up to 8 px under its wrap (the wrap at 1280 × 640 is
517, drawn 512; at 1920 × 1080 the wrap is 957, drawn 952).

| Screen | 1280 × 640 | 1280 × 800 | 1366 × 768 | 1440 × 900 | 1920 × 1080 |
| --- | --- | --- | --- | --- | --- |
| Boss alone (Puddles) | 440 → **512** | 600 → **520** | 568 → **448** | 696 → **528** | 880 → **952** |
| A raid (a Boss raid, Puddles) | 440 → **376** | 456 → **376** | 536 → **304** | 616 → **384** | 880 → **864** |
| Crowd 50 v 50 (and its vote) | 456 → **376** | 456 → **376** | 536 → **304** | 616 → **384** | 904 → **864** |
| 1 v 1 | 464 → 464 | 624 → 624 | 592 → 592 | 728 → 728 | 904 → 904 |
| Squads | 408 → 408 | 504 → **424** | 536 → **352** | 664 → **432** | 848 → 848 |
| Babur, Boss alone (`tiger`) | not measured → **488** | 536 → **456** | 568 → **400** | 680 → **448** | 880 → **896** |

Reading the table:

- **Boss alone at 1280 × 640 is the brief's target** (517 wrap, 512 drawn; 1920 × 1080: 957 wrap, 952 drawn). The room is the same for
  every boss (123 px), so Puddles' 61 px bar fits; Big Boy's shorter bar leaves a few pixels spare.
- **Width-bound screens lose the menu's width.** Below 1366 px the icon menu costs 80 px: a raid, the Crowd, the vote and Squads at
  1280 × 800 are 80 px smaller, exactly the menu's width (the brief's rule: "not smaller than today's by more than the icon menu's
  width needs"). **From 1366 px the full menu costs 232 px**, so the same screens are 152 to 232 px smaller at 1366 × 768 and 1440 × 900
  (a raid, the Crowd: 536 → 304, 616 → 384). That is the brief's "full menu from 1366 up" and it is the number the director should look
  at: it's a real loss of board on those two sizes. Options, not taken: the labels from 1600 px instead (the boards at 1366 and 1440
  would be the icon menu's 80 px smaller, as at 1280), or a narrower labelled menu.
- **1 v 1 and Squads at 1280 × 800 and 1920 × 1080 are unchanged or near it:** the duel has no scoreboard beside it, so its column is
  not width-bound at 1366 and above (728 and 904 as before); Squads at 1920 is height-bound.
- **Babur's board** (his column grows with the board, for his pump) takes the menu's width too: 1366 × 768 568 → 400.

## The calls I made

1. **The room is 123 px for every boss battle, not each boss's bar** (as Oct 29): the tallest bar (Puddles, 61 px) fits, the board
   doesn't change size from one boss to another. The paddings went down to make it fit: 6 px above the bar and 8 px under the dock (was
   10 and 14), the gaps as margins, not row gaps.
2. **The menu's width is in the layout, not overlaid:** the screens take the window less the menu (`--win-w`), so nothing sits under
   the menu and the board's centering is unchanged. A phone or a touch tablet gets no menu at all: the front door's `.fd-side` shows
   at 1024 px and wider whatever the pointer, so `GameFrame` doesn't draw it there (a touch tablet's screen would move otherwise). The
   frame element is the same either way (`display: contents` without a mouse), so a window that crosses the line keeps its screen.
3. **Icons only below 1366 px, from the front door's own menu** (not a new one), with the labels visually hidden and as tooltips: a
   screen reader still hears "Boss Battle" and so on. The logo is "HC" below 1366 px (its text doesn't fit 80 px).
4. **The menu's leave goes through the match's own exit,** not a new one: each screen's `MatchExit` (the gear's confirm, the same note
   and buttons), then the page. `sideNext` waits for the match to be out: a solo resign goes to its result first, so the page shows
   once the result is gone (`match.phase` results, a duel `over`, a squad's `resigned`, auto chess left).
5. **The admins' ⚡ and 🐟 move with the gear** into the column (the title line's `match-tools` are the same elements); they're admin
   tools and shown only to admins, as before.
6. **Boss alone's bank time** (`BankTime`, the title line's "your total time left") showed nothing in Boss alone (there's no bank for
   you there), so nothing moves. The dock's clock (`DockClock`) is the battle's clock, as before.
7. **No "Board size" setting** (the brief: the new layout replaces today's; Eric can ask for a Compact one later).

## Tests (changed checks, old → new)

None of these guards a rule in `docs/rules/eric.md`. The gear's guard (`e2e/match-menu.spec.ts`, "the gear on every screen with a
chessboard") is unchanged; its title-line test is on the Crowd, which keeps its title line.

- `e2e/desktop-board.spec.ts`:
  - `ROOM` (the room above and below the board): `alone` 200 → 123, `raid` 200 → 123 (the others unchanged).
  - `NOW` (the sizes pinned, 1920 × 1080, 1440 × 900, 1366 × 768, 1280 × 800): alone 880/696/568/600 → 952/528/448/520; raid
    880/616/536/456 → 864/384/304/376; Crowd and vote 904/616/536/456 → 864/384/304/376; 1 v 1 unchanged; Squads 848/664/536/504 →
    848/432/352/424.
  - `MAIN` ("never smaller than main's") → "never smaller than main's, less the side menu's width" (`MENU`: 80 px below 1366,
    232 from there). The guard stays; the menu's width is the allowance.
  - "the moves from the board's top" → 36 px under the board's top on a boss screen (the tools' row above them), 0 on the Crowd and
    the others; the tools themselves at the board's top.
  - Babur's sizes: 1280 × 800 536 → 456, 1920 × 1080 880 → 896, 1366 × 768 568 → 400, 1440 × 900 680 → 448.
  - New: "a computer's boss screen: no title line…", "a computer's game screens: the side menu is on each…", "a computer's side menu
    on a boss battle: its confirm first…".
- `e2e/board-layout.spec.ts` (the computer test, Boss alone and a raid): the board's box per size (x, y, width), old → new: 1280 × 800
  264, 121.3, 600 → 344, 63.2, 520; 1440 × 900 294, 121.3, 696 → 496, 63.2, 528; 1536 × 864 360, 121.3, 664 → 496, 63.2, 624;
  1920 × 1080 444, 121.3, 880 → 521.5, 63.2, 952; 1024 × 768 96, 121.3, 464 → 176, 63.2, 384. A raid at 1280 × 800: 408, 121.3,
  456 → 488, 63.2, 376. The raid's scoreboard (x): 1280 × 800 10 → 90; 1920 × 1080 118 → 242. The list's top: "level with the board's
  top" → 36 px under it (the tools above). "Half the height" keeps its formula (the board's half less 73 px) with the floor the CSS has
  always had: 120 px (the test's old floor, 160 px of the whole list, is 80 of its half; the two differ only under a 386 px board).
- `e2e/desktop-board.spec.ts` "the straight with the board's left edge" check: it compared the title line's box, which a boss screen no
  longer has; it now compares what's there (a `filter`), the same check.

Run locally (the changed specs, on this branch's build): `desktop-board.spec.ts` 13 of 13; `board-layout.spec.ts` (the computer test and
"no eval bar"); `match-menu.spec.ts` 8 of 8 (the gear's guard). The other area specs (`tiger`, `boss-dock`, `gardener`, `boss-speech`,
`hopper`) are for CI.
