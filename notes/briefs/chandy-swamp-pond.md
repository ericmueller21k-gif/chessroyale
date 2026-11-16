# Chandy's Swamp from the street: a pond, not a wall with windows (Eric, Nov 16). Opus, high. QUEUED: start after the rules job

Effort high (town art and its 3D box). `characters` delegate, town-square area. New branch `claude/chandy-pond` from main. Include
`notes/briefs/rules-common.md`. Read `.claude/LESSONS.md`, CLAUDE.md, `docs/areas/town-square.md` ("Adding a home", "The street
town"), and how #737 built it: `town/houses/chandy.ts` (the front), `home-boxes.ts` `chandy` (foliage sides and back, a water roof),
`town-kit.ts` (`foliage`, `water`).

## Eric's words (Nov 16, after it went live)
"The problem with the swamp right now is there's windows, which there shouldn't be windows. That should be at, it should actually
look like a pond where that space is."

## What the director saw (notes/briefs/assets/chandy-swamp-front-windows.png, from round 2's front still)
- The middle of the front, between the two cypresses, is a flat dark-green panel whose texture is a grid of darker squares: from the
  street it reads as a building face with windows, not as water and trees.
- Through gaps in the canopy, the buildings behind the lot show (a blue window at the top middle, row houses with windows behind
  the right cypress, a grey roof slab).

## What to do
- From the street the lot reads as **a pond**: open water going back into the lot (a water surface that recedes, reflections, lily
  pads, reeds at its edges), low brush and distant cypress trunks at its far side, the trees' crowns over it. No flat panel, no
  window-like grid anywhere (check the `foliage` texture and the box's back and sides from every angle the street camera can take).
- Nothing behind the lot shows through it: the canopy and far trees close it off, or the back is dense trees, never other buildings'
  windows in its frame.
- Keep its footprint, door (the boardwalk), sign, height and the admin gate as they are. The room inside is unchanged.
- Check every way a player sees it: the street from both directions and from across the street, phone and computer, day and night,
  zoomed out and in, the minimap.

## Deliver
Stills of the front from those views (about 6) to `stills/chandy-pond`, the area's tests (the home's art test, the town counts
unchanged), `@perf` only if the drawing cost changes. A 5-line decision note, `.pr-body.md` (what changed, player-visible, checks old
-> new), `.done`. No PRs, no CI waits, no images under docs/, no model names in commits.
