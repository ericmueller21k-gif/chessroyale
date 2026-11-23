# Birdie: the warning sign and the slower ride (Nov 23, 2026)

Branch `claude/birdie-cadence-warning`. Taken from the app (an admin's Boss alone vs Birdie, `?power=train`), headless Chromium:
phone = iPhone 13 (390 x 664, 3x), computer = 1280 x 800.

- `*/sign-screen.png`: the whole screen on your warned turn, the sign glowing over the marked piece (the phone: a pawn on b2;
  the computer: a knight on a3), the crossing on its line.
- `*/sign-board.png`: the board alone. `*/sign-zoom.png`: the marked square and its neighbors, enlarged (the sign's edges).
- `*/ride-1..8-<ms>.png`: 8 frames of his slower ride (1.95 s, was 1.3 s), ms after the train first showed; `*/ride-sheet.png`
  the 8 side by side. The sign stays on the piece left on the line until the train's nose reaches it, then the smash.
  (On the phone, frames 7-8 stand at 1.45 and 1.72 s: its 3x screenshots take longer.)
- Measured every frame (no screenshots), the e2e: the train never stood still, 1.93 s on screen; 3.9 px a frame on the phone
  (5.9 at the old 1.3 s).
