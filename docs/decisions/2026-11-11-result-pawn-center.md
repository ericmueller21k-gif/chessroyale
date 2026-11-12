# Boss result: your pawn centered over its name (2026-11-11)

Eric (Nov 11, a phone screenshot of "Victory! You beat Dash!"): "my pawn ... doesn't look good where it's not straight with the
stuff below it. If we need to shrink the text a little, we can; we still have room, we can bring things over to the right a
little. It just looks sloppy."

The first call: the pawn's art is centered over the XP column (the `-34px` margin override came out: it sat 20 px right of
center). The 16 px gap to the boss shrank, so the row gap went 16 → 24 px (20 under 360). Nothing moves vertically.

The second call (this helper, after a CI failure at 5.6 px: Smudgy's figure, "16 px between the boss and your pawn: received
5.6"): the row gap is 36 px (20 under 360, unchanged) and the padding-left 30 px (12 under 360, unchanged). Measured for every
boss at 360, 390 and 430 px (win, loss, draw; `scripts/frames-boss-result.mjs`, every frame for 4 s): the smallest gap at rest is
17.6 px or more. The gap moves 1 px for each px of row gap; the padding moves the row, not the gap. The padding went from 32 to 30 because the
row is as wide as its content (the gap adds to its width): at 360 px the XP column is 8 px from the edge and the boss 8 px in;
at 390 px they are 26 px and 20 px in. Pawn centering: 0.01 px off its column's center at every width.

**Open: 320 px.** The CSS for under 360 px is unchanged, so 320 px is what main had before this change, and it doesn't pass:
- Smudgy's gap at 320 px is 1.6 px (12 px wanted). Its gap is the row gap, one for one. Measured: a 32 px row gap at 320 px gave
  13.6 px, and a pawn scale of 1.4 gave the same 13.6 px, so the pawn scale doesn't move the gap.
- The row has no room for both: at 320 px the content (padding, boss, gap, the 160 px column) fills the screen, and a bigger gap
  pushes the XP column off the right edge (measured: a 32 px gap put it 16 px off).
- Jefferson's figure reaches 10 px past the left edge at 320 px.
- Option for Eric or the director (not pushed, not verified in full): narrow the XP column under 360 px from 160 to about 148 px and
  widen the gap to about 37 px. The narrower column moves the pawn left, so it takes more gap; by the measured margins that should
  just fit at 320 px, but it's an estimate, and the XP text would need checking at 148 px.

Per-boss numbers, the smallest painted gap at rest (over win, loss and draw; "before → after" at 360 to 430 px; at 320 px only
"kept", the same as main). A boss with a run-to-run change (Timber, Dash, Don Dough: their poses differ from run to run) can move
more than the table shows in one run.

| Boss | 320 px (kept) | 360 px before → after | 390 px before → after | 430 px before → after |
|---|---|---|---|---|
| Ginger (`gingerbread`) | 41.6 | 45.6 → 57.6 | 45.6 → 57.6 | 45.6 → 57.6 |
| Boingo the Clown (`clown`) | 33.6 | 37.6 → 49.6 | 37.6 → 49.6 | 37.6 → 49.6 |
| Jefferson (`grex`) | 17.6 | 21.6 → 33.6 | 21.6 → 33.6 | 21.6 → 33.6 |
| Hollow (`hollow`) | 23.6 | 27.6 → 39.6 | 27.6 → 39.6 | 27.6 → 39.6 |
| Big Boy (`bigboy`) | 43.6 | 47.6 → 59.6 | 47.6 → 59.6 | 47.6 → 59.6 |
| Sawyer (`sawyer`) | 23.6 | 27.6 → 39.6 | 27.6 → 39.6 | 27.6 → 39.6 |
| Wrangler (`pig`) | 23.6 | 27.6 → 39.6 | 27.6 → 39.6 | 27.6 → 39.6 |
| Alfil (`alfil`) | 9.6 | 13.6 → 25.6 | 13.6 → 25.6 | 13.6 → 25.6 |
| Hopper (`hopper`) | 27.6 | 31.6 → 43.6 | 31.6 → 43.6 | 31.6 → 43.6 |
| Smudgy (`smudgy`) | 1.6 | 5.6 → 17.6 | 5.6 → 17.6 | 5.6 → 17.6 |
| Moo & Moon (`moo`) | 45.6 | 49.6 → 61.6 | 49.6 → 61.6 | 49.6 → 61.6 |
| Gardener (`gardener`) | 9.6 | 13.6 → 25.6 | 13.6 → 25.6 | 13.6 → 25.6 |
| Tiger (`tiger`) | 43.6 | 47.6 → 59.6 | 47.6 → 59.6 | 47.6 → 59.6 |
| Folio (`folio`) | 11.6 | 13.6 → 25.6 | 15.6 → 25.6 | 13.6 → 25.6 |
| Timber (`timber`) | 9.6 | 7.6 → 25.6 | 15.6 → 39.6 | 13.6 → 47.6 |
| Dash (`dash`) | 9.6 | 51.6 → 25.6 | 31.6 → 59.6 | 27.6 → 27.6 |
| Don Dough (`zebra`) | 13.6 | 17.6 → 39.6 | 13.6 → 27.6 | 47.6 → 39.6 |

Changed checks: none (`e2e/formats.spec.ts`'s gap check is unchanged; it's the one that failed). Lane: light (CSS only). Tests:
`formats.spec.ts -g "God King's Last Stand"` on phone, five runs: all passed.
