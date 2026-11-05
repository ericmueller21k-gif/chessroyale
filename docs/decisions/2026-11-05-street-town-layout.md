# The street town, round 2: the layout, in an admin's town (Nov 5, 2026)

Eric approved the street town (Nov 5). The art and the plan are `claude/boss-art` at 11a4d903 (`town-art-nov5.md`,
`town-plan-nov5.md` and `.json`, `town-street-mockup-nov5.md`, `out/town-art/`). This round lays the town out from the plan at
today's camera (facing north everywhere), fronts only; round 3 adds the boxes (sides, roofs) and Seam Avenue's camera turn.

## What's in

- **Admins only (`STREET_TOWN`, admin-town.ts, beside `ADMIN_TOWN`).** An admin's town is the street town; everyone else keeps
  today's. Setting `STREET_TOWN` true for everyone makes it everyone's. Today's town's code and tests are untouched for a player.
- **The plan as data:** `town/street-plan.json` is the art's JSON copied as made; `town/street.ts` reads it. world.ts builds the
  ground (board streets, paved sidewalks, the park's walks and lawns, gardens, lots, the Colosseum), the props, the twelve tables,
  the start (22, 11) and the homes (each on its lot, its door square, its boss's rest square and wander box) from it.
- **The art copied in** as the shop art was: `town-kit.ts`, `buildings.ts`, `home-boxes.ts`, `dressing.ts` beside `houses/`, only
  their imports moved. Timber's and Dash's fronts in `home-boxes.ts` are the game's own copies (`houses/timber.ts`, `blitz.ts`), the
  same pictures with their signs' faces, so their names show on their signs.

## The calls

1. **Seam Avenue: its fronts stand in facing the camera** (the brief's first choice), each on its lot's south edge, until round 3's
   turn. The avenue is the world's wrap seam, and every east-west street crosses it: keeping it out of reach would cut them all.
   Its hedges (they run north to south) are drawn along the ground, their top and the side the camera sees, not as billboards.
2. **A boss passes a lamp in its own box, never stopping on it.** A wander box is one sidewalk row of whole squares (its yard strip
   is less than a square), and ten of the sixteen have a lamp beside the rest square, which walled them in. The art says a boss walks
   round them: it steps over the lamp's square in front of the lamp. It stops only on its rest square (out to a free square of its
   box and back, then a pause), so its door and sign stay in view.
3. **The bots stay off every boss's box** (so never stop on a door square), and walk the streets, sidewalks and park. A sidekick going
   home crosses its door square onto its lot's square behind the door and fades there, behind the front.
4. **The near side:** a front (and a shed, and a home) standing more than 0.9 squares nearer the camera than its focus isn't drawn;
   trees fade over the 1.5 squares nearer still (`streetNearCut`, `streetTreeFade` in feel.ts). From the focus, not from you, so a
   glide or a drag shows what it looks at.
5. **Figures whole on screen (Eric, Nov 4):** in the street town a boss or a bot fades out over the last half square before the box's
   foot or side would cut its drawing (you never fade). The camera follows you, so the figures behind you would otherwise stand cut
   off by the box's foot.
6. **The sidewalk is the game's paving** (its two tones and seams), not the slab tile with its kerb; the gardens and lots are the art's
   garden green. The hedge's top is laid flat over its depth. Cheap, and round 3 can lay the tiles.
7. **Zoomed in at the start** in the street town (`streetStartZoomedOut: false`; Eric, Nov 5); − / + as before.

## Frame rate

Headless, a phone 390 × 844 and a computer 1440 × 900, 5 s walking a set route (`__townWalk`, a test-only hook: today's town along
row 6, the street town along Fountain Street), medians of four runs taken in turn: phone today's town 52.4 fps (zoomed out, as it
opens) and 59.0 (zoomed in), the street town 59.3 (zoomed in, as it opens); computer 55.4, 59.8 and 59.8.
