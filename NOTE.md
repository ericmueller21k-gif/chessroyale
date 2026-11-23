# Birdie's lobby, round 4, in the game (Nov 23)

Headless Chromium, the game's own room, as an admin. Branch `claude/birdie-lobby-4`.

- `room-phone.png`, `room-desktop.png`: the whole room as you first see it on walking in, phone (iPhone 13) and computer (1280 × 800),
  with its arrival banner.
- `gates-lowering-phone.png`, `gates-down-phone.png`, `gates-table-phone.png`: his challenge. The gates lowering on the marks, then down
  and flashing through his line, then the table beat.
- `table-close-phone.png`: the table and both bar arms, close (the Close camera from the floor south of the table).
- `arm-west-close-phone.png`: the west bar arm and its stools, close, from the floor beside the seats.

## Eric's notes, and what the in-game stills show
- **"The bar … should be risen, and their stools should be there":** `room-phone` and `table-close`. Both arms stand raised like the front
  run, the same height, with their charcoal side faces and red stripe toward the stools. Three stools stand against each arm.
- **"Make the birdseed pile bigger so it's clear":** `room-phone` and `gates-down`. A big heap on the run's east end, and the vat's heap
  beside the bartender over the run's far edge.
- **"The train tracks … should move over on top of the table":** `room-phone` and `room-desktop`. The tracks run across the room on row 7
  under the table. The front-left corner is plain floor.
- **"The train crossing things that come down … the red light … flashing as the battle starts":** `gates-lowering` and `gates-down`. Both
  gates are up and dark while you walk the room. From the marks, their arms swing down level and the red lights flash in turn until the
  battle.
- **"No bird feeders around that table … a squared table with a chessboard on it, just like every other boss has":** `table-close`. A
  square table whose top lies flat, a chessboard on it, on a wood leg, a stool each side, no feeders. During the challenge the pieces pop
  onto it (`gates-table`).

## Calls (docs/decisions/2026-11-23-birdie-lobby-4.md)
- The table uses the town table's geometry, with its top as the renderer's flat slab in the art's table colors. The art's own top would
  stand up like a sign in the game.
- The east gate stands one square east of the art's place. At the art's square, its crossbuck hid you on your mark during the challenge.
- The vat moved up beside the bartender so its heap shows over the run.

## Worth a look
- From close up and from the side (`arm-west-close`), each arm shows as three stepped faces, one per row. This happens because every
  room piece stands up at its row. From the room's usual camera the arms read as one raised counter.
- The art's bar stools stand a little taller than the table's top.
