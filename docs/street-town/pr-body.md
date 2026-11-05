# Street town, round 2: the layout, in an admin's town

Title: **Street town (round 2): the layout from the plan, admins only**

Eric approved the street town (Nov 5). This lays it out from the plan (`claude/boss-art` 11a4d903: `town-plan-nov5.json`, the
art in `out/town-buildings/`) at today's camera, fronts only, **in an admin's town only** (`STREET_TOWN`, beside `ADMIN_TOWN`)
until round 3 (the boxes and Seam Avenue's camera turn). A player's town is unchanged. Decision:
`docs/decisions/2026-11-05-street-town-layout.md`; area page: `docs/areas/town-square.md`, "The street town".

## What changed

- `town/street-plan.json` (the art's JSON, as made) and `town/street.ts` (reads it); `town/town-kit.ts`, `buildings.ts`,
  `home-boxes.ts`, `dressing.ts` copied in (imports moved; Timber's and Dash's fronts from the game's own copies, which carry
  their signs' faces).
- `town/admin-town.ts`: `STREET_TOWN` (an admin's town). `world.ts`: with it on, the ground, props, tables, start and homes come
  from the plan; a home knows its door square, entry, rest square and wander box (today's town: the same squares as before);
  bosses walk their wander boxes from their rest squares and back; the bots walk the streets, sidewalks and park, off every boss's
  box. `render.ts`: the gardens' green, the everyday buildings' fronts (lit at dusk and night), hedges with their tops (Seam
  Avenue's along the ground), bushes, beds, sheds; the near side cut; figures fade before the box's edge would cut them.
  `Town.tsx`: zoomed in at the start in the street town; the door squares from the home; a test-only `__townWalk` hook.
- `feel.ts`: `streetStartZoomedOut`, `streetNearCut`, `streetTreeFade`.

## Player-visible changes (admins only; a player's town is today's)

- An admin's town is the street town: the chessboard streets with a sidewalk each side, the lots and everyday buildings drawn as
  their fronts with the bigger buildings behind, back gardens with hedges on the near side, the Colosseum in its grove, the
  plus-shaped park with its 12 tables, trees, lamps and the fountain at the crossing.
- It opens zoomed in, at (22, 11) on the promenade just south of the fountain, facing north.
- Timber's Lumber Lodge and Dash's Kicks are there with their names on their signs.
- A tap on a home walks you to its door square and opens its card; an arrow into its lot opens it too.
- Each boss walks its own yard's sidewalk, passing a lamp, and stops only on its rest square (its door and sign in view).
- The bots walk the streets, sidewalks and park, never stopping on a door or a table; a sidekick goes home through its boss's door.
- Seam Avenue's own fronts stand in facing the camera (round 3 turns the camera there).
- Fronts between the camera and you aren't drawn; trees there fade. A boss or bot fades out just before the box's foot or side would
  cut it (Eric, Nov 4: sprites whole on screen).
- No new text.

## Changed checks (old → new)

No check guarding a rule in `docs/rules/eric.md` changed; none removed.
- `packages/app/test/town-dash.test.ts`, `town-timber.test.ts`: their mock `{ ADMIN_TOWN: true }` → `{ ADMIN_TOWN: true,
  STREET_TOWN: false }` (they test today's town with those homes; setup only, every check as it was).
- `e2e/shop.spec.ts`, helper `goIn`: a far home's chip clicked → its chip clicked if it has one, else the camera glides there as a chip's
  tap would (an admin's street town has more homes near, so a far one may have no chip). No check changed.
- New: `packages/app/test/town-street.test.ts` (the layout matches the plan: every lot, door, wander box, walkable square and the
  start; the park's 12 tables; every door reachable and a tap on its plot leading there; the bosses in their boxes; the bots never
  stopping on a door or a table's square). `e2e/town-street.spec.ts` (phone and computer: opens zoomed in at the start facing north,
  and a player's as today; down Fountain Street to Ginger Igloo's door and its card; the up arrow into Smudgy's Art Gallery opens
  its card; a park table works; the stills with `STILLS=docs/street-town`). `e2e/areas.json`: the new spec in the town's area.

## Frame rate

Headless, phone 390 × 844 and computer 1440 × 900, 5 s walking a set route (today's town along row 6, the street town along
Fountain Street), medians of four runs taken in turn (fps):

| | Today's town, zoomed out (as it opens) | Today's town, zoomed in | Street town, zoomed in (as it opens) |
| --- | --- | --- | --- |
| Phone | 52.4 | 59.0 | 59.3 |
| Computer | 55.4 | 59.8 | 59.8 |

(An earlier pass of the same, before the figures' edge fade: phone 56.0, 59.4, 59.8; computer 55.9, 60.0, 59.2.)

## Stills

`docs/street-town/`, phone and computer: `1-park`, `2-fountain-street-ginger-card` (a home's card), `3-seam-street`,
`4-fountain-street`, `5-colosseum-row`, `6-upper-street`, `7-seam-avenue`.

## Lane

**Full e2e** (the `full-e2e` label): the town is shared. Locally: `town-street.test.ts` and the town's unit tests;
`e2e/town-street.spec.ts` on both projects; the admin town's existing e2e (`boss-challenge` Dash and Timber, `shop` lodge, kicks and
boss tokens) on the phone, passing.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
