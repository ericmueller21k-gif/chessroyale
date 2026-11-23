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
