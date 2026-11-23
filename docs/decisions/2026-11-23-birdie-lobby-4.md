# Birdie's lobby, round 4, in the game (Nov 23)

Eric (Nov 23, round 3 in the game): the bar's arms "should be, actually like risen, and then their stools should actually be there"; "make
the birdseed pile bigger"; the tracks "should move over on top of the table", the crossing gates where he drew them, "flashing as the battle
starts"; no feeders round the table, "a squared table with a chessboard on it, just like every other boss has". Round 4's art copied in as drawn.
- The bar's arms: cut into a piece per row (raised top and side face), standing on their rows, so they read raised as the run does.
- The table: PARK_TABLE's geometry, its leg in his wood, the art's stools beside it; the top is the renderer's flat slab and board in the
  art's table colors (the art's top would stand up like a sign). In the lobby without pieces; the intro's pieces pop on as before.
- The gates lower when you both reach your marks (not on the walk in, so nobody walks under a lowered arm), then flash until the battle.
  No crossing sound: none exists, and none was asked. The east gate moved a square east: at the art's square it hid you on your mark.
- The vat moved up beside the bartender so its heap shows over the run; the run's one feeder moved under his pour.
- Frame rate (Birdie's lobby, phone, CPU slowed 4×, `__shopBench(30)` medians, two runs each, taken in turn): moving, main 75.3 / 75.4 ms
  and this branch 76.1 / 74.6 ms; resting, main 0.82 / 0.67 ms and this branch 0.85 / 0.85 ms. Level.

## Fix round (Nov 23, the director's check before Eric saw it)
The director: cut a piece a row, each arm showed as three stepped slabs (a notched top in the usual camera, three walls side by side up
close). Eric asked for the arms "risen" like the run: one counter, one straight top edge, one side face, the run's height, every camera.
- Each arm is now one piece, 1 x 3. The brief's first idea, standing it whole at its south row as other rooms' long pieces do, would stand
  it about 130 px over its foot against the run's 55: a tall wall over the run up close. So the room got a kind of deep piece of its own,
  a counter (`RoomArt.counters`): the old rule (each row's top 55 px over its foot) made continuous, in 4-row slices, each at its own
  depth. The art isn't redrawn: the same pixels, cut once.
- A side the camera sees past (the nearer slice's edge further in) gets the slice's edge columns down a card's height, only up to the
  next slice's edge (whole-width bands overdrew about 25 times).
- An arm is sorted with its north row's pieces, so its stools and feeders draw over it, as the art drew them.
- Frame rate: drawn straight, its dozens of draws an arm cost the resting room about 12 ms a frame in the room bench (usual camera, CPU 4x).
  It never changes, so the second frame the view rests its slices are kept in a canvas of their own, as the room's back is.
  `__shopBench(30)` medians, Birdie's lobby, phone, CPU slowed 4x, this machine, the round-4 commit before the fix then the fix: moving,
  63.4 / 69.3 ms before and 65.0 / 69.5 ms after (usual camera), 65.3 / 69.2 and 63.3 / 64.7 (Close); resting, 0.85 / 1.73 and 0.64 /
  0.69 (usual), 0.56 / 0.61 and 0.57 / 0.62 (Close). Level.
