# The HunChess (gold) rides sound as their rides (Nov 22)
Eric, Nov 22: "the sound for the pogo stick in the town only works on the red pogo stick, not the gold one ... why wouldn't ... anything
that's marked as the same item get the same sound?"
- Cause: each ride's Welcome Crate colorway is its own item (`<ride>-hunchess`), and `RIDE_SOUND.rides` was read with the item's id, so
  every gold ride (pogo, dozer, mower, sled) was silent. The ride's drawing and feel already mapped colorways to their ride.
- Fix: `ride-sound.ts` maps every item through `rideSoundId` (the colorway's ride) at its three entry points, so a ride's sound is its
  colorways' too, and a new ride's colorway needs nothing added.
