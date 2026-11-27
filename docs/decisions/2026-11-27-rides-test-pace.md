# The rides test walks at 450 ms a step (Nov 27, 2026)

The brief: fix town.spec.ts "rides" (phone; "move:2:1" never seen) at its cause, no check loosened.
- Cause: its per-frame recorder sees only drawn frames. The walk down took 270 ms (3 steps at 90 ms); CI's slowest frames came
  300+ ms apart. With the CPU slowed 24x locally it failed every time, with CI's exact list.
- Call: a test hook `__townPace(ms | null)` slows your steps to 450 ms for the directional walks, then restores 90 (checked).
  Passes at 24x and 40x slowed CPU; 5 of 5 normal phone runs. The app's views were right throughout.
