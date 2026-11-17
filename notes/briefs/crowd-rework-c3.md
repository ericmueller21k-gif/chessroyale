# 50 v 50 rework, step C3: the screens. Opus, high (screens with logic, layout). Targeted lane

Branch `claude/crowd-rework-c3` **from `origin/claude/crowd-rework-c2`** (PR #762, CI running; merge `origin/main` into yours once it
lands). Read CLAUDE.md, `.claude/LESSONS.md` (watch every screen change with real taps), `docs/rules/eric.md` (nothing hidden, nothing
shifts; notices on top), `docs/areas/crowd.md`, the design (`git show origin/design/crowd-rework:notes/designs/crowd-rework.md`, rules
6 and 8, section 3's app part) and its mockups on that branch: `notes/mockups/crowd-podium.png` / `.html`, `crowd-cut.png` / `.html`.

**Do (phone first, also good on a computer, light and dark):**
1. **Vote cards** for "How are moves picked?" (Strong / Majority / Chaos) from the vote data, plain-language lines (Majority: "Your team's
   top pick, sometimes 2nd or 3rd", as C4 set).
2. **The top bar's countdown:** "Move 31 · cut in 2", "4 v 4 next", "1 v 1 from move 43"; one banner as the 1 v 1 begins.
3. **The cut screen** (mockup `crowd-cut`): your place and the gap to the last one through, "Why was I cut?", a fixed box of who's still
   in a side and the stages to come, and at its foot **Spectate** (watch to the podium: the live board, who's left, the scores) and **Leave
   the match** side by side, always both, never moving (Eric, Nov 16: "make sure there's a spectate option").
4. **The podium results** (mockup `crowd-podium`): 1st tallest in the middle, 2nd left, 3rd right, **each player's own dressed pawn**
   (the shared pawn drawing, not a plain icon), name and points a move; "Winner" and "Best player" tags (one player: both); a fixed line
   naming the best player when off the podium; your row (place, out at move, points a move; RP once C5 lands: leave the spot, greyed);
   the full chart of all 100 in a fixed scrolling box with your row pinned. Nothing moves when it fills.
5. **The FAQ** and the home page's 50 v 50 text: the new rules in plain language (`CROWD_PRE_REWORK` no longer read by them).
**Checks:** e2e `crowd.spec`, `formats.spec`, `votes.spec`, one podium check at 320 / 390 / 1280 added to an existing spec; the FAQ test.
One set of stills (phone and computer) on `stills/crowd-rework-c3` (never under docs/). `.pr-body.md` (under 60 lines) and `.done`.
Commits end with the `Claude-Session:` line only, no model names. No PR, no waiting on CI.
