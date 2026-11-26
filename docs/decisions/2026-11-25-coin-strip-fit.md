# The coin strip fits every computer end page (Nov 25, 2026): payments PR 3's finish

The brief (director, Nov 25): on a computer's boss result at 1536 × 730 the strip pushed Home about 50 px under the window (Eric's rules:
nothing hidden, Play again and Home reached without scrolling). Measured at 1536 × 730, 1280 × 600, 1366 × 650 and 1920 × 960.

Calls made:
1. **A boss result's column scales with the window's height** (`zoom` on `.boss-results > .results-top`, end-screen.css): 1 from an 870 px
   window, the window over 870 below it (0.84 at 1536 × 730, 0.69 at 1280 × 600). Why not the brief's other ideas: everything but the
   boss row already took 580 px, so 1280 × 600 could never fit by trimming the strip, the quests' row or the boss row alone, and the boss
   row varies 193 to 254 px by boss. 870 is the tallest stack measured (834 px; Gingerbread 773) plus the page's padding. Set from the
   window, never from what's in the column, so nothing moves as the screen fills. One CSS line; the 1 v 1's column already scales the
   same way (`--es-u`). Below 870 every boss result is a little smaller, Gingerbread's too (it alone would fit at 0.915 at 1536 × 730).
2. **The 1 v 1 end column's strip is the compact one** (44 design px: the count with the day's total beside it, then the parts), drawn at
   the column's scale. At its full 76 the chat fell to 31.6 px of messages at 1536 × 730 (its guard asks 40; ranked-1v1.spec "real
   screens"). The column's scale is now 1 from an 810 px window and 0.65 at 1280 × 600 (was 1 from 800 and 0.69), its gap never under
   8 px: the chat keeps 72 / 51 / 44 px at 1536 × 730 / 1366 × 650 / 1280 × 600.
3. The review's board allows for the page's padding (`100vh - 184px`, was 180): it left a 4 px scroll at 1280 × 600.
4. Checks read design px on a zoomed column: `endGaps`' gap times the column's zoom; xp.spec's box heights and the boss/pawn 16 px gaps
   (boss-result.spec, formats.spec) over it.

Since Nov 26 the quests keep no empty rows ([2026-11-26-quests-no-empty-rows.md](2026-11-26-quests-no-empty-rows.md)): the 1 v 1 end
page with XP and one quest at 1536 × 730 is whole, its chat too. Left: at 0.69 the strip's smallest words are about 5 px.
