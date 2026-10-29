# A computer's board as big as chess.com's: it grows with the window's height (Oct 29, 2026)

Lane: the director's (every game screen with a board). Area pages: [board.md](../areas/board.md), [bosses.md](../areas/bosses.md),
[crowd.md](../areas/crowd.md), [squads.md](../areas/squads.md), [ranked.md](../areas/ranked.md). Code: `packages/app/src/board-size.css`
(loaded after styles.css), `pumpPlace` in `components/Tiger.tsx`. Tests: `e2e/desktop-board.spec.ts`.

## Eric's words (Oct 29, with a chess.com screenshot and one of ours, Boss alone vs Puddles)

> "this is chess.com. I actually want to match … the way that they do the large chessboard. I think this is what people have come
> to expect … to be clear, this is desktop only. Mobile, everything's totally fine … When I scale my window on my computer, it also
> scales the board … we need this extra space … where it says like Martin foot up there. I think we just need a little more. So …
> we'll make ours a little smaller than there so we can fit the header at the top … for boss mode, that's already easy enough.
> Normal 1v1, because we don't have a bunch of stuff sitting around … /50, same thing, very easy … our … race car style board is
> just a thin thing … we don't make it the full full height of how chess.com has it, so it's gonna be a little smaller. But it's
> got to be close enough."

chess.com's board in his screenshot: 921 px in a 1036 px window, **0.889 of the height**. Ours was 470 px in 1061 (0.44).

## The rule

On a computer, every game screen with a chessboard sizes the board by **the window's height less the room the screen really needs
above and below it**, never wider than its column:

- **The room** (`--bd-room`): a boss battle 200 px (the title line, the boss's bar up to Puddles' 61 px with his seeds, the dock's
  "Your move" row, the padding); the Crowd's screens (its opening vote, play, reveal, final) 170 px (the title line, the line over
  the board, the row under it); 1 v 1 170 px (the title, the two players' strips); Squads 230 px (the tiny boards over the board, the
  clocks' line under it), its relay 250 px.
- **The screen grows to hold that board** (`--scr`: the board, the eval bar's 48 px, the 28 px gap, the 340 px column beside it,
  the gutters), at least its old width (1000 px beside a scoreboard, 1100 px without), never past the window.
- **Where the window is too narrow**, the board is width-bound (it shrinks to its column) and nothing overlaps: the scoreboard
  (360 px) and the column beside the board (340 px) keep their sizes.
- It changes **only with the window**: every screen of a game has the same room, so the board keeps its size between moves, through
  banners, a power, the Hidden Boss's phase change and the end.
- **A computer is a window 900 × 600 and up with a mouse** (`(hover: hover) and (pointer: fine)`). Phones and tablets keep their
  board to the pixel, a tablet on its side (1024 × 768, 1180 × 820 with touch) included.

## The sizes measured (testers' eval bar on, as `?debug` shows it)

| Window | chess.com's ratio | Boss alone | A raid | Crowd 50 v 50 and its vote | 1 v 1 | Squads |
| --- | --- | --- | --- | --- | --- | --- |
| 1920 × 1080 | 960 (0.889) | **880** (0.815), was 552 | 880, was 552 | 904 (0.837), was 552 | 904 (0.837), was 704 | 848 (0.785), was 600 |
| 1440 × 900 | 800 | 696 (0.773), was 552 | 616 (0.684), was 552 | 616, was 552 | 728 (0.809), was 648 | 664 (0.738), was 600 |
| 1366 × 768 | 683 | 568 (0.740), was 480 | 536, was 480 | 536, was 536 | 592 (0.771), was 512 | 536, was 536 |
| 1280 × 800 | 711 | **600** (0.750), was 456 | 456, was 456 | 456, was 456 | 624 (0.780), was 544 | 504, was 504 |

(Without the eval bar, every player's board, the width-bound ones are 48 px bigger: a raid and the Crowd 504 at 1280 × 800, 664 at
1440 × 900.)

- **Against chess.com:** at 1920 × 1080 Boss alone is 8% under chess.com's ratio, the Crowd and 1 v 1 6%. At 1280 × 800 Boss alone is
  16% under it and 1 v 1 12%: our screens need 170 to 200 px above and below the board (the title line with the gear, the boss's bar,
  "Your move"), chess.com 115 (its two name bars), and a fixed room weighs more in a short window. Within the brief's aims (800–880
  at 1920 × 1080, 600–660 at 1280 × 800) for Boss alone; 1 v 1 and the Crowd a little over at 1920 × 1080, nearer chess.com.
- **What couldn't follow, and why:** a raid, the Crowd and Squads at 1280 × 800 and 1366 × 768 (and a raid and the Crowd at
  1440 × 900) are width-bound: the scoreboard's 360 px on the left and the 340 px column on the right (the move list; the Crowd's
  status card and chat; Squads' panel) leave the board 504 px at 1280, less the eval bar's room for testers. The brief's rule is to
  shrink the board rather than overlap them; they are as big as main or bigger everywhere.

## The calls I made

1. **The room is the screen's real room, not a ratio.** A fixed room in px (what's really above and below) is what fits; a share of
   the height would leave the "Your move" row off the bottom of a short window or waste room on a tall one. 200 px for every boss
   (not each boss's bar): the board must not change size from one boss to another's bar height mid-raid, and Puddles' 61 px bar is
   the tallest.
2. **No cap on a big screen.** On a 1440 px tall window the board is 1240 px, as chess.com's grows.
3. **Computers only, by the pointer.** The desktop layout starts at 900 × 600, which an iPad on its side also is. "Mobile,
   everything's totally fine": a touch screen keeps the old sizes (a new check pins 1024 × 768 and 1180 × 820 with touch to main).
   A touch laptop's mouse is its main pointer, so it gets the new sizes.
4. **Boss alone's empty left column: 200 px (was 360).** It was kept for the boss and Babur's pump (docs/decisions/2026-10-25-board-
   layout.md); 200 px holds the widest boss (Folio's head included) with the board as big as 1280 × 800 lets it. A raid's
   scoreboard keeps its 360 px.
5. **Babur's column grows with the board** (`170 + 0.175 × (the window's height − 200)` px). His pump is a stage-4 queen as tall
   as her piece (docs/decisions/2026-10-24-babur-desktop-pump.md), so it's about 0.17 of the board wide: at 200 px it no longer
   fitted beside him at 1280 × 800 (and for players, without the eval bar, at 1440 × 900) and went to the taller bar. With his
   column it stands beside him at every size from 1100 px, as Eric first asked; his board gives up a little width for it at
   1280 × 800 (536 px with the eval bar, 584 without) and 1440 × 900 (680 with it, 696 without).
6. **A bug the bigger board showed: Babur's pump flipped between beside him and the taller bar** several times a second at
   1280 × 800 (before 5.). `pumpPlace` takes the taller bar's class off to measure the room beside him, but sized the pump from the
   squares' last drawn size, which the board rewrites only a frame later: the smaller board's, so a pump that didn't fit looked as
   if it did, and back. It now sizes the pump for the board as this layout draws it (its element's size, a whole multiple of 8 device
   px, as the board will write it). Guarded by `desktop-board.spec.ts` (one board size over 2.5 s at each size, the pump beside him).
7. **The move list stays half the board's height** (Eric, Oct 28: "slice it in half vertically"), from the board's top, 13 to 15 px
   off it, above the God King's head. The brief named the Oct 25 page ("from the board's top to above the God King's head"); the
   Oct 28 half height is Eric's later word on the same list, so it stands. It grows with the board (367 px by an 880 px board).
8. **Spectate has no chessboard** (the boards in play as mini boards), so it's unchanged. Auto chess has its own board and frame
   (`.ac-root`): left alone, as the brief says.
9. **The God King, your pawn, the boss, the eval bar, banners and speech** are all placed from the board (its corners, `--board-px`,
   eighths of `--board-size`), so they follow without a change.

## Frame rate (eric.md's method)

FRAME_RATE_PLACEHOLDER

## Tests (changed checks, old → new)

None of these guards a rule in `docs/rules/eric.md` (the gear's guard, `e2e/match-menu.spec.ts`, is unchanged; every phone and tablet
test is untouched).

- New: `e2e/desktop-board.spec.ts`. On a computer, for Boss alone, a Solo raid, the Crowd's 50 v 50 and its opening vote, 1 v 1 (a bot)
  and Squads (a test lobby): at 1920 × 1080, 1440 × 900, 1366 × 768 and 1280 × 800 and back, the board's side as measured, never more
  than the window's height less its room, never less than main's; nothing scrolls, everything in the window, nothing over anything
  (the boss's drawn pixels too; a raid's boss over the scoreboard's edge, as before, is the one allowed); the move list from the
  board's top, 12 to 16.5 px off it, half its height less 73 px, above the God King; the God King and your pawn by the board's
  bottom right on its line; the scoreboard left of the board; a resize grows or shrinks it; through the game (moves, the boss's
  turn, a crowd's reveal) one size. Babur: the pump beside him at every size, one board size over time and through his game.
  Phones and tablets: the board's box (x, y, side) is main's at 390 × 844, 430 × 932, 768 × 1024, 844 × 390 and a tablet on its side
  (1024 × 768, 1180 × 820, touch), Boss alone, the Crowd and 1 v 1.
- `e2e/board-layout.spec.ts`, the computer test: "the board's box is main's" (Boss alone) → the new sizes: 1280 × 800 x 408, 456 → 256,
  600; 1440 × 900 438, 552 → 286, 696; 1536 × 864 486, 552 → 352, 664; 1920 × 1080 678, 552 → 436, 880; 1024 × 768 unchanged.
  "A raid's scoreboard where it was": 1440 × 900 x 40 → 10, 1920 × 1080 x 280 → 118 (the screen beside it is wider), 1280 × 800
  unchanged.
- `packages/app/test/tiger-wired.test.ts`: the pump never needs more than the taller bar keeps, now up to a 1600 px board (was 1000),
  and board-size.css' taller-bar budget uses the same share.
