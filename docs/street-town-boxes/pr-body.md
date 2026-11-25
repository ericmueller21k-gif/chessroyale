# Street town, round 3: box buildings and the turning camera, admins only

Title: **Street town (round 3): box buildings and the turning camera, admins only**

Eric (Nov 5, the corner screenshot): "you can clearly see the houses are flat, any way to fix?" Every building in the street town is
now a box as the art drew it (`claude/boss-art` 11a4d903, `town-art-nov5.md`), and the camera turns with the street so you always see
the fronts. Still **an admin's town only** (`STREET_TOWN`); a player's town is unchanged. Built on round 2 (`claude/town-layout`,
PR #499), merged in at 56a9a387. Decision: `docs/decisions/2026-11-05-street-town-boxes.md`; area page: `docs/areas/town-square.md`,
"The street town", round 3.

Round 4 (Eric's correction after round 2's stills: continuous rows wall to wall, the joins blended) builds on this branch and keeps
the turning camera, the box roofs and end walls and the name fix. The standalone houses' side walls weren't polished further here,
since the rows will hide most of them.

## What changed

- `town/boxes.ts` (new): every box (the 43 lots, the 12 sheds, the hedges in runs of up to five squares), the sides a neighbour at
  least as tall covers (skipped), each roof face's geometry, normal and texture frame, the art's light, and each frame's plan (each
  part's depth for the drawing order, faces turned away and tiny ones left out, far to near, one piece or triangles, the walls' strips).
- `town/box-draw.ts` (new): each roof painted once a heading (north, east) into a sheet or two a box; walls darkened once a shade.
- `town/turn.ts` (new): `camAt` (the plan's headings and turn zones), the eased `Turn`, the arrow keys through the heading
  (`screenStep`), the far Colosseum's 45 degrees (`farColosseumShows`).
- `camera.ts`: the view's heading (`setHeading`, `toCam`, `rel`, `fromCam`); `forEachSquare` lays the ground from a turned grid when
  the camera isn't facing north (today's town keeps its own path exactly).
- `render.ts`: every world point through the heading; the boxes' fronts, sides, backs and roofs drawn (both renderers: images through
  an affine transform), sorted by their own depths; the clouds slide with the turn; the far Colosseum within 45 degrees of north; a
  home's name over its own roof; test hooks. `sky-draw.ts`: the clouds' slide. `Town.tsx`: the turn (your square says which way; a
  chip's glide where it's going), the keys and the drag through the heading, `__townHeading` (tests).
- `home-boxes.ts`: the 2D fallback's domes 6 x 3 and Boingo's vault 4 round (`homeBox(id, low)`); `world.ts` unchanged.
- `feel.ts`: `streetTurnMs` (500), `streetTurnClouds`, `boxTinyPx`, `boxWholePx`, `boxWholePxFine`, `boxStrip*`, `boxBakeMs`,
  `nameOverRoof`, `nameDropStep`.

## Player-visible changes (admins only; a player's town is today's)

- The street town's buildings are boxes: each front with its side walls (lit 6% turned left, 30% turned right), the three homes' back
  walls, and their roofs (the art's tiles, lit from the top left, ink edges, flat roofs' rims); the sheds too; the hedges have tops.
  At dusk and night the sides' windows light up as the fronts' do.
- On Seam Avenue the camera faces east (its own fronts, which now face west); on its four crossings and everywhere else north. Walking
  out of a crossing along the avenue, or into one, the camera turns about you over about half a second.
- The arrow keys go through the camera: up is always up the screen (east on the avenue). Taps and dragging to look round too.
- The clouds slide as the camera turns; the sun stays. The Colosseum's far drawing shows only within 45 degrees of north.
- The edge chips point through the turned camera.
- A home's floating name sits just over its own roof (round 2's Timber's floated over its chimney smoke, high over Boingo's Funhouse),
  and drops toward its eave while it would lie over a building behind.
- No new text.

## Changed checks (old → new)

No check guarding a rule in `docs/rules/eric.md` changed; none removed; no existing check changed.
- New: `packages/app/test/town-boxes.test.ts` (every lot a box on its front line; faces' normals out and up; the drawing order;
  faces turned away left out; sides a neighbour at least as tall covers never drawn; the light; each building within 20 draws on the
  2D fallback, 40 mid-turn; the domes cut down; the near-side cut; the heading on every square as the art's `camAt`; the easing; the
  arrow keys and taps through the heading; the far Colosseum's 45 degrees).
- New in `e2e/town-street.spec.ts`: "the boxes and the turn" on Canvas 2D and WebGL, phone and computer (east along Fountain Street
  onto Seam Avenue: the camera turns, eased and seen midway; Fountain Street's and the avenue's fronts face you; every figure on screen
  at rest; on 2D also the up arrow and a tap mid-turn (held halfway) and after); "stills: the boxes and the turn" (STILLS only).

## Frame rate

Headless (software rendering), phone (iPhone 13, 390 × 844) and computer (1440 × 900), 5 s walking, round 2's build and this one
taken in turn on the same server: **Fountain Street** (west and back, the camera north: round 2's route) and **the turn** (up and down
Seam Avenue through Fountain Street's and Colosseum Row's crossings: five turns a way, the camera turning most of the time).

Canvas 2D (the default), after the cuts below, the mean of two rounds (fps):

| | Round 2 | Round 3 |
| --- | --- | --- |
| Phone, Fountain Street | 57.6 | 57.3 |
| Phone, the turn | 59.8 | 54.8 |
| Computer, Fountain Street | 59.3 | 58.4 |
| Computer, the turn | 59.6 | 53.7 |

Before the cuts (medians of four rounds) the phone's turn was 48.4 against 60.0. The cuts: hedges drawn in runs (131 squares, 28
runs), walls darkened once a shade instead of a shade laid over each strip, the transform put back once a batch, the roofs' two
paintings blended over 14 degrees of the turn (not all 90), the 2D fallback's faces drawn in one piece up to 2 px off (not two
triangles), the roofs painted faster. The phone's turn is still about 5 fps under round 2's, at the brief's limit: the avenue's view
east is the densest in the town (a wall of fronts close up with the bigger buildings over them). If more is needed, round 4's
continuous rows hide most side walls, and the next cut is the bigger buildings' roofs behind the rows.

WebGL (`?gl=1`, software in headless, so slow either way; medians of four rounds, before the cuts): phone Fountain Street 19.7 → 18.5,
the turn 25.2 → 19.4; computer 21.0 → 19.1 and 24.7 → 19.3. (Headless WebGL is SwiftShader; on a GPU it batches the boxes into its
few draw calls.)

## Stills

`docs/street-town-boxes/`, phone and computer: `1-seam-street-day`, `1-seam-street-dusk`, the turn `2-turn-1-before`,
`2-turn-2-mid` (held halfway), `2-turn-3-after` (Fountain Street's crossing onto Seam Avenue), `3-home-sides-timber` (Timber's
Lumber Lodge's side and hipped roof, from the avenue).

## Unfinished / for round 4

- The standalone houses' sides as they stand (round 4's rows hide most). The chess tables' boards stay in the camera's frame (the
  park always faces north). A home's sign lettering at a slant is drawn through the front's transform (not pixel-snapped).
- The WebGL e2e is slow when the machine is busy (headless software GL: 20 s alone, up to 4 minutes under load); its timeout is 400 s.

## Lane

**Full e2e** (the `full-e2e` label): the town's camera and drawing are shared. Locally: `town-boxes.test.ts` and every town unit test
(232 passing); `e2e/town-street.spec.ts` whole on both projects; the admin town's `boss-challenge` (Dash, Timber, Babur) and `shop`
(lodge, kicks, Babur, Puddles, boss tokens) on the phone, passing.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
