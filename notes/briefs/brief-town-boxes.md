# Brief: the street town, round 3: box buildings and the turning camera (code; Opus high)

Worktree `/home/user/cr-townboxes`, branch `claude/town-boxes`. It's made from `claude/town-layout` (round 2, PR #499, not merged
yet). When #499 merges, merge main in (a real merge, never a rebase). Run `npm ci`. Push as you go. Ports are 8995, inspector 9495.
Include notes/briefs/rules-common.md. Eric is OK with this running beside another helper (Nov 5).

**Read first:**
- Round 2's PR body and decision note: `docs/street-town/pr-body.md`, `docs/decisions/2026-11-05-street-town-layout.md`.
- The art's notes on `origin/claude/boss-art` 11a4d903: `scripts/boss-art/out/town-art-nov5.md`. It covers the box format (a front, two
  side walls, a back wall on three homes, roof faces), the lighting formula, draw order, "nothing between the camera and you", the
  camera's headings and turn zones, and draw counts.
- The mockup notes `out/town-street-mockup-nov5.md` (depth section) and the stills `out/town-art/6-turn-*`.

## Eric's asks this round answers
- "The corner screenshot you can clearly see the houses are flat, any way to fix?" → buildings are boxes.
- The view turns with the street so you always see the fronts, and it follows you smoothly.
- The boss homes are always visible.

## Do
1. **Box buildings** (everyday ones and the 16 homes, with the art's own sides and roofs):
   - Front, sides and roof faces, drawn by depth, lit as the art says, lit windows at dusk and night.
   - Neighbours hide each other's sides; skip a side a neighbour at least as tall covers.
   - About 12 to 20 draws a building. The dome and mound are one mesh in WebGL and cut down on the 2D fallback.
   - Both renderers: WebGL and the 2D fallback.
2. **The camera turn.** It faces north everywhere except on Seam Avenue, where it faces east. It turns in the four crossing zones,
   easing over about 0.5 s (a feel number) while it follows you.
   - People, trees and lamps stay billboards. Hedges are planes.
   - Taps and the arrow keys go through the heading: up is always up the screen.
   - The Colosseum's far drawing shows only within 45 degrees of north.
   - The sun stays put and the clouds slide.
   - The minimap and edge chips (if any) follow the heading.
   - Seam Avenue's round 2 stand-in fronts now face east, as planned.
3. **Name labels:** in round 2's phone still, "Timber's Lumber Lodge" floats high in the sky, well above his lodge. Put each home's
   floating name just over its own roof, and keep it from overlapping the buildings behind.
4. **Frame rate:** measure as round 2 did, plus the turn itself (walk through a crossing), on phone and computer, WebGL and the 2D
   fallback. If the phone drops more than about 5 fps below round 2, cut cost before shipping.
5. **Still admins only** (`STREET_TOWN`). The director flips it for everyone after Eric walks it.

## Done
- **Unit:** box faces and draw order, hidden sides skipped, the heading per zone and its easing, taps and arrows mapped through the
  heading, the Colosseum's far-drawing rule, draw counts per building within budget.
- **e2e:** the admin's street town on phone and computer, both renderers. Walk east along Fountain Street onto Seam Avenue: the camera
  turns, and fronts face you before and after. A tap and an arrow work mid-turn and after. Every figure stays on screen at rest.
- **Stills** in `docs/street-town-boxes/`: a street by day and at dusk, the turn's three frames, a boss home's sides, phone and computer.
- **PR body** `docs/street-town-boxes/pr-body.md`: every player-visible change, changed checks old → new, frame rate, lane (full e2e).
- Push, but don't open a PR. Send a short report.
