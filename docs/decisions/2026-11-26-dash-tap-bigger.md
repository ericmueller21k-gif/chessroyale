# Dash's clock tap: bigger, over the board's edge, and redrawn (Nov 26, 2026)

- **Eric:** "could we scale him up maybe like 3 times where he's actually hanging over the board a bit ... you can still click on your own tiles that he's blocking ... he shouldn't move"; the pose "kind of wonky ... your feet are up in the air ... resting one hand on his head ... lackadaisically".
- **Changed:** `DASH_LIE` redrawn on his belly (cheek on the near paw, the far paw tapping, shins up kicking lazily, soles to the sky) at twice his standing sprite's detail, from his own shapes and palette. `DASH_TAP.lieScale: 3` (his old size times this) and `DASH_TAP.overhang: 0.8`.
- **Call:** a true 3x would reach 1.4 squares up the board on a 390 px phone (only about 40 px lie between the board and the dock's bottom), covering whole squares. So the size is capped at 0.8 of a square over the board's edge, and by the room beside your time: about 2.1x on a phone (320 and 390 px), 2.7x on a computer (1280 x 800, 1536 x 730). Raise `overhang` toward 1 for bigger.
- Taps go through him (`pointer-events: none`, as before); he's placed once and never moves while you pick.
