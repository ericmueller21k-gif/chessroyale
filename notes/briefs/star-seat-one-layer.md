# Moon's Ride: no lines over the pawn, by removing the layer that makes them. Opus, high (drawing structure)

Branch `claude/star-seat-one-layer` from main. About 45 min. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/shop.md` (rides),
the decisions `2026-11-17-star-ride*.md`, and `packages/app/src/components/rides/moon-ride.tsx`.

**Eric, Nov 17, 15:00 UTC, after #768 went live (his screenshot: `notes/briefs/assets/star-lines-nov17.jpg` on claude/director-notes,
his look: the suit, crown, parrot): "Still weird lines on the star, how hard is this to fix Jesus"** In it: the lip's black arc
across the coat, a light band and a second dark curve under it, and a dark diagonal stroke at the upper right over his item.

**The cause (not another patch):** the seat is made by drawing a second, masked copy of the star in front of the pawn (`Front`, its
`frontClipD` mask, `SeatLip`, `LipEnds`). Every edge of that copy (its outline, its rim highlight, its shading, the mask's own edge)
lands on the pawn and its items as a line. Four passes have moved the mask; each left another seam. Fix the structure:
- **Nothing of the star is drawn over the pawn.** Draw the star once, behind (with its dip and near lip). Clip the pawn (and its
  items, as one group) to "above the near lip's arc" inside the dip; outside the dip, don't clip (an item hanging beside the pawn
  just lies in front of the star). The clip's edge sits on the lip's outline so the pawn looks sunk into the seat. One outline, no
  copy, no seams. Delete `Front`'s star copy, its mask and whatever only existed for it.
- If an item must be clipped differently, say so in the PR rather than adding a layer.
- All views (side, front, back) and the trail mark; `cut`/`pawnY` as needed; re-measure `ride-cells.ts`.
- The drawing's art itself stays (the API runner's, on `claude/boss-art`); this is a structure change in the code that composes it.
  If a redraw is truly needed, use the API runner (Opus), cap $3.

**Check like Eric does:** his exact look (Eric's saved look, as in `stills/star-ride`), at phone size AND zoomed 4× on the seat, every
frame of the ride (60) and each view: no line of the star's on the pawn or any item. Also: katana, tommy gun, parrot, a wide coat.
Tests: `town-rides.test.ts`, e2e `town.spec.ts` rides test on phone. Light lane.

Stills for Eric: push to `stills/star-seat-one-layer` (never docs/): his look, phone size and the 4× zoom like his screenshot, before
and after. Done: `.pr-body.md` (under 40 lines) and `.done`, end. No PRs, no CI waits.
