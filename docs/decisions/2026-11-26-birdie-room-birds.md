# Birdie's Station inside: longer crossing arms, and the bar's birds (Nov 26, 2026)

- **Eric:** "the railroad like crossings that come down, we need those things to be bigger ... much longer ... up like high towards the
  ceiling"; "I want like 50 birds at the bar ... nibbling on bird feed ... the bartender keeps scooping up more bird feed ... if you run
  up to the bar, then they all fly away, and then they don't come back for a little bit".
- **Arms:** the art's arm 42 → 130 px (birdie-lobby-art.ts `ARM_LEN`), the same arm and stripes; raised, it reaches up past the bar
  toward the ceiling; lowered, each arm lies right across the battle spot.
- **Birds:** 50 (`SHOP_FEEL.birds`, every number there), a room scene (shops/birdie-birds.ts, `RoomFx`, as the tower's and walk-up's):
  one sheet baked as the room loads (one bird, 9 poses, 2 doves and 2 sparrows, both facings, 3 seed-pile sizes), a seeded fixed loop
  per bird (sit and peck in bouts, a little hop, a stool bird hops up onto the bar, off up into the ceiling to its side, back in), one
  draw pass. The bartender's existing 5.1 s scoop is the clock: each pour fills the next of the run's 4 piles, eaten down in 16 s; a bird
  pecks while its pile has seed. You within 2.2 squares of the bar: all fly off; back 25 s after you leave, over 15 s.
- **Calls:** the art's 5 static stool birds are left out (they'd sit on while the flock flew). The birds draw as one figure after the
  front stools' row, so the gates and you in front draw over them. Your place is read every 100 ms, not every frame (no allocation).
