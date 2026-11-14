# The Hidden Boss's fight: before and after (Nov 14)

`after/<size>/`: the visual check's capture script (`review/recluse-visual-qa`, `capture/hidden-boss-room.spec.ts`, run from an
uncommitted `e2e/qa/`) on `claude/recluse-qa-fixes`, every beat, iPhone 13, 1280 x 800 and 1920 x 1080, with its metrics. Two stills
added: `16a-transform-white-peak` (the white's peak, about 8.1 s) and `16c-transform-white-dying`. `before/<size>/`: the check's own
stills of the beats each fix touches.

| Fix | Before | After |
|---|---|---|
| 1, phone's bar box at the countdown | `before/phone/21-shuffle-countdown.png` (26 px sliver) | `after/phone/21-shuffle-countdown.png` (277 px, the words) |
| 2, the cutscene's lone tail | `before/phone/12-cutscene-line2.png`, `-line4` | `after/phone/12-cutscene-line*.png`; `after/phone/cutscene-line-change-frames.png` (frames 40 ms apart across three line changes: no tail without its box) |
| 3, a computer's bar face | `before/desktop1280/04-kid-20.png` (the 9-year-old), `22-four-boards.png` (no suit) | `after/desktop1280/03-kid-13.png`, `04-kid-20.png`, `22-four-boards.png` |
| 4, his fall's words | `before/desktop1280/10-man-fall.png`, `before/desktop1920/10-man-fall.png` (82 px over his head) | `after/desktop1280/10-man-fall.png`, `after/desktop1920/10-man-fall.png` (16 px) |
| 5, the God King's line in the party layout | `before/desktop1280/09-man-line-run1.png`, `before/desktop1920/01-kid-start.png` | `after/desktop1280/01-kid-start.png`, `after/desktop1920/01-kid-start.png` |
| 6, phase 2's Moves panel | `before/desktop1280/25-boards-won.png` ("1. e4", phase 1's game) | `after/desktop1280/25-boards-won.png` |
| 7, a phone's small boards' names | `before/phone/23-four-boards-line.png` | `after/phone/23-four-boards-line.png` |
| 8, the white-out on a phone | `before/phone/16-transform-white.png` | `after/phone/16a-transform-white-peak.png` (all white), `16-transform-white.png`, `16c-transform-white-dying.png` |
| 9, his words over his helmet | `before/phone/17b-transform-line1-whole.png`, `before/desktop1280/17b-…` | `after/phone/17b-…` (inside the bar), `after/desktop1280/17b-…` (on the board, under the bar) |
| 10, the boards' snap | `before/desktop1920/22-four-boards.png` (414 → 408 px) | `after/*/metrics.json`: `21-shuffle-countdown` and `22-four-boards` boards the same (1920: 408 px both; 1280: 216 px both) |
