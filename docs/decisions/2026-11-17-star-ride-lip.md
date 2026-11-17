# Moon's Ride: no straight edge round the seat (Nov 17, 2026)

Eric, on the live star with his own look (suit, crown, parrot): "WHATS WITH THE HORIZONTAL LINE". The cause: outside the dip,
the star in front of the pawn was masked below a straight line at the rim's middle, so anything beside the pawn (a parrot's tail,
a katana, a tommy gun, the far rim's light band) was chopped flat there. The pawn's own cut never showed (measured, every frame).
Fixed in the drawing by the API ($0.92): outside the dip the edge is now a curve that leaves the near lip smoothly and sweeps
out and down, staying above the pawn's cut line out to the widest items; the lip outline's two upper ends moved behind the pawn.
Data unchanged (`cut` 70, `pawnY` -8.5); only the drawing's hash in `ride-cells.ts` changed.
