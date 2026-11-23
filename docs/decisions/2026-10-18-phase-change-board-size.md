# The board keeps its size through the Hidden Boss's phase change (Oct 18, 2026)

Eric, Oct 18, on his phone, with `?win=1`: "the board shrinks right after capturing, or right after putting him in
checkmate … If you note the size of the board before putting him in checkmate, and then note the size during his rant
right before he splits the boards, you'll see a clear difference in size." He thought it came with the slower phase
change (PR #269, Oct 17). Lane: `god-king` (the boss battle's presentation). Area page: [bosses.md](../areas/bosses.md).

## What was wrong

On a phone the board's width is the smaller of the screen's width and the window's height less a fixed budget for
everything else on the screen (styles.css, the phone block): 330 px, or 255 px when the scoreboard under the board is
minimized (`.screen.game:has(.mini-tower.closed)`: "the board takes the room"). Phase 1's screens (your move, his fall)
have the scoreboard; the phase change's screen (`PhaseChangeScreen`) has none. So with the scoreboard minimized, the
`:has(…closed)` rule stopped matching the moment the phase change began (1.85 s after the mate, as his fall ends), the
board fell back to the 330 px budget, and it stayed smaller until the split.

It shows only where the board is sized by the window's height: a window under about the width plus 255 px. Every frame
measured from the move before the mate to the split, the scoreboard minimized (Chromium, an iPhone 13's emulation;
WebKit gave the same boxes as Chromium at 390 × 664):

| Window | Before the mate | Phase change, on main | Phase change, with the fix |
| --- | --- | --- | --- |
| 390 × 600 | 314 px | 270 px | 314 px |
| 375 × 548 | 293 px | 220 px (its 220 px minimum) | 293 px |
| 320 × 568 | 244 px | 238 px | 244 px |
| 390 × 844, 375 × 812, 390 × 664, 375 × 629 | width-bound: no change | | |
| 1280 × 800, 1280 × 600 (a computer) | no change | | |

With the scoreboard open there was no change at any size (both screens use the 330 px budget).

**Not caused by #269.** The commit before it (`b8815e8`) shrinks the board the same way at the same sizes (390 × 600:
314 to 270 px at 1.85 s; 375 × 548: 293 to 220 px). #269 made it twice as noticeable: the phase change runs about
22 s from the mate to the split instead of 12, so the smaller board is on screen for about 20 s, through his new lines.

## The fix

`PhaseChangeScreen` reads the same remembered view the scoreboard does (`underBoardView().open`, prefs.ts) and, when
it's minimized, its screen carries `rc-folded`; styles.css adds `.screen.game.rc-folded` to the two minimized-scoreboard
rules, so the phase change gives the board the same budget phase 1 did. The split starts from that board (the four
quarters are clipped copies of the stage, the same box). Nothing is resized or measured anew, and nothing else in the
transition moves: the header, his place, the title line and the dock stand where his fall left them (on main the dock
jumped up 44 px with the board at 390 × 600). The phase change still fits: it has phase 1's board without the
scoreboard's bar under it (in a window as short as 375 × 548, phase 1's own screen already runs past the bottom by the
dock's last 18 px with the God King in it; the phase change now matches it there rather than fitting better). After the split, phase 2's own screen (a big board and three small ones) is unchanged.

## Calls I made

- **Keep phase 1's size, not a fixed one.** Reserving the scoreboard's room always would grow the board for a player
  whose scoreboard is open: the same jump the other way. Mirroring the setting is one class and two selectors.
- **No overlay or placeholder scoreboard** on the phase change: an empty bar under the board would be one more thing
  on a screen that already has his bust, his words, the God King and the dock.
- **The guard** (`e2e/recluse.spec.ts`, "the board keeps its size from the mate until the split"): every animation
  frame from your mating move until the split begins, the board's box (its wrap and the squares drawn in it) within
  1 px of the first frame's, and every step of the phase change seen. A phone at 390 × 600 with the scoreboard
  minimized (an iPhone 13's width in a window short enough that its height sizes the board; the default 390 × 664
  doesn't show the bug), a computer at 1280 × 600 (a laptop's maximized window). On main the phone fails (the board
  changed in 1,224 of 1,341 frames); with the fix both pass.
- **Eric's own phone** (an iPhone 15, about 393 × 659 in Safari with its bars showing) is width-bound by these rules
  too, so his window must have been shorter than that when he saw it (Safari's bars, or another layout); the cause is
  the only rule that can change the board's width between these screens, and the fix covers every height.

No player-visible text changed.
