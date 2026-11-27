# #1009 fix round: the Boss Battle grid with his card live, and Eric's real-speed GIF (Nov 27). Opus high, layout. Then a quick review.

Read `notes/briefs/rules-common.md` first. Branch `claude/stranger-ult` (PR #1009). The director already pushed `boss-select spec: a
guest's tiles counted from the roster` (GUEST_TILES, twoRows: 17 tiles = a computer's 9 + 8, a phone's 6, 6, 5).
1. **The computer's grid overflows at 1280 px:** with his card live a guest has 17 tiles, the computer's two rows are 9 and 8, and at
   1280×800 the row runs ~91 px past the middle column's right edge (boss-select.spec.ts "on a computer the tiles go in two rows…", the
   "right buffer" check, expected ≥ -12, got -91.4). Fix the layout so 9 a row fit the column (tiles sized from the column's width and
   `--bs-two`, as eight did), whole and same-size, START on screen, nothing sideways; check 1280×800, 1440×900, 1920×1080 and a window
   under 1280 (six a row). Nothing else on the screen moves.
2. **"light 320x568: a color each": expected 14, got 15** (the grid test counts the tiles' tint colors with a hard 14): count it from
   the roster as GUEST_TILES does (his card has `SELECT_TINT.stranger`?), and make sure his tile's tint is set.
3. Run `e2e/boss-select.spec.ts` fully on phone and desktop (it all passes after this).
4. **Eric's GIF:** "send me a gif of his ult when it finishes": ONE GIF on a phone (390x844) at **real speed** of the whole ult (the RAGE
   warning or banner, his leap, the 11 s scene, his return, then one Ice and one Fire turn and a burn; cut the waits for your moves), as
   `storm-phone-realtime.gif` on `stills/stranger-ult`, under ~8 MB.
`.pr-body.md`: update the existing body's Changed checks (boss-select's counts and rows) and add the grid line; at most 40 lines. `.done`.
