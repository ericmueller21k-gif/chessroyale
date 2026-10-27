# The town square: lights at dusk and night (Oct 27, 2026)

Phone and computer. Follows the slice 6 park (`2026-10-26-town-square-slice-6.md`) and the statues.

## Eric's words (Oct 27)

"I wanted to add lights, like street lamps or like park style lamps, so when it's night and also dusk that they turn on
for the little park, and then possibly just adding light for the buildings that have like a sort of interior. You don't
even need to necessarily draw a light in, but just make it glow from inside a little bit, so it clearly kind of shows,
like, you know, there's some liveliness in the town, if that makes sense. We don't need to necessarily add lights around
the world, but just light up the … like, so in, like, the barn stall, and really, I mean, it should be fairly
straightforward to know where to put them."

## What changed

- **Ten park lamps** (`LAMPS` in `world.ts`, beside `PARK_PLAN`; the art `PARK_LAMP` in `houses/park.ts`). A classic park
  lamp post: a stepped dark iron foot, a post with a collar halfway up, a lantern of four panes under a pointed cap with a
  ball on top, lit from the top left like the rest; 20 × 62 picture pixels, about a pawn and a half tall. Drawn once and
  cached (a `FrameCache`, like the trees and benches), sorted with the people like every park prop. Each is solid (walked
  round) and stands on paving.
- **By day and at dawn the lamps are unlit**: the glass is pale where the day lights it and grey in its shade. **At dusk
  and night they're lit**: the glass glows warm, a soft warm halo round the lantern, and a faint pool of light on the
  ground under each, about two squares across.
- **The homes and the Colosseum glow from inside** at dusk and night: their windows, doorways and glass warm and bright,
  with a soft glow spilling a pixel or three round them, and a faint pool on the ground in front of an open door. No lamp
  is drawn inside; the light is all. A few (candles, lanterns, torches) flicker slowly and gently; nothing blinks.
- **When:** off at dawn and day, on at dusk (0.7 of night's strength) and night (full) (`lightsAt` in `feel.ts`). When the
  sky blends from one look into the next over its half hour, the lights follow the blend (`mixLights` in `sky.ts`).
  `?sky=dusk` and `?sky=night` show them.
- The sky's looks are untouched (the tints dawn 5%, dusk 10%, night 34%). The name tags, the speech bubble and the homes'
  floating names are still drawn after everything, lights included, so they read exactly as before. No light falls on a
  sign board (a unit test checks every lit pixel), so the names written on the signs read as before too.

No player-visible text changed.

## Where the lamps stand, and why

The park is 20 × 11 squares (columns 13 to 32, rows 10 to 20; row 20 is nearest the Colosseum). The lamps follow the
brief's natural set:

| Lamps | Squares | Why there |
| --- | --- | --- |
| A pair where the promenade leaves the park toward the Colosseum | (20, 21), (25, 21) | On the walk between the park and the apron, either side of the promenade's paved strip (their squares paved for their feet): they frame the way to the gate. The first is ahead on your left as the page opens; the e2e test reads its glass. |
| A pair beside the fountain | (20, 14), (25, 14) | On the paving either side of the fountain's front row, between the tables' stools: the fountain is the park's middle, and they light it. A one-square path stays open on each side of the fountain. |
| One at each corner of the park's walk | (13, 20), (32, 20), (13, 10), (32, 10) | The corners of the paved walk round the park. Walking round a corner goes over the grass inside it, as short as before (a unit test). |
| A pair where the promenade comes in from the plaza | (20, 9), (25, 9) | On the plaza's squares just outside the park's south walk, either side of the promenade's mouth (paved for their feet). |

None stands on the promenade, a stool, a table, the fountain, the apron, a statue's square or any home's roaming ground,
and every square you could reach before (every stool included) is still reached from your start (unit tests). The park
keeps its ten tables (two stools each), its fountain, its paths, trees and benches.

## The homes' light spots

Each home carries its lights as data beside its art (`HOUSE_<ID>_LIGHTS`, and `HOUSE_<ID>_POOLS` for a pool on the
ground), exported with the house in `HouseArt` (`houses/index.ts`): boxes in the picture's pixels, which palette keys in
the box light up (the glass, the dark of a doorway, so frames, bars and things standing in front stay dark), a color, a
strength (0 to 1, at night) and, for a lantern, a halo.

- **Babur's Circus** (`tiger.ts`): the tent's doorway, warm (the show going on inside), and a pool in front.
- **Ginger Igloo** (`gingerbread.ts`): the doorway, a cold ice-blue (he loves the cold), and a blue pool on the snow.
- **Jefferson's Fireworks** (`grex.ts`): the stand's dark inside, warm behind the rockets on their rack.
- **Hollow Peak** (`hollow.ts`): its own green window is left exactly as it is (it already glows); the doorway only a dim
  warm (0.3).
- **Moo & Moon Meadow** (`moo.ts`): a meadow has no inside, so its lantern on the post shines, flickering, with a halo.
- **Boingo's Funhouse** (`clown.ts`): the gate's dark inside, warm behind its bars; the swirl tunnel a funhouse pink; a
  pink pool in front.
- **Big Boy's Crib** (`bigboy.ts`): a crib has no inside, so the toy train's windows glow, like a nightlight.
- **Sawyer's Woodshed** (`sawyer.ts`): the open front's inside, warm and flickering (lit by its lantern), the lantern on its
  hook with a halo, a pool in front.
- **Wrangler's Stall** (`pig.ts`): the lantern on the beam, with a halo, and the hay in the stall lit warm by it; both
  flicker.
- **Smudgy's Art Gallery** (`smudgy.ts`): the paintings in its two windows lit from inside, the door's little window, the
  lamp over the door (flickering, a halo), a pool in front.
- **Chub & Chirp's Grassland** (`hopper.ts`): a burrow, so a dim warm glow deep in its mouth, as of a fire inside,
  flickering.
- **Puddles' Botanical Garden** (`gardener.ts`): the greenhouse glows through all its glass (walls and gable, the plants
  showing behind it), its open door's leafy inside a little brighter, a pool in front.
- **Alfil's Pyramid** (`alfil.ts`): the doorway's dark, as of torches inside, flickering, and a pool on its steps.
- **The Colosseum** (`coliseum.ts`): the gate's tunnel, as if torches burn inside, and a scattered few arches (two of the
  lower tier's, one of the middle tier's without a marble pawn), all flickering, with a little of the gate's light on the
  apron. None near the statues (a unit test: no glare on their quotes up close), the queen and the king, or under a banner.

## How it's drawn (the calls)

- **A light layer, laid on after the tint.** Each light is baked once, the first time its picture is drawn lit: a small
  canvas per light (its lit pixels, the glow spilling round them, its halo) and per pool, at the picture's own pixels,
  in pixel-art bands (`lightSpill`, `lightHalo`, `lightPool` in `feel.ts`), drawn crisp like the picture once a picture
  pixel is 1.5 screen pixels or more. A frame adds this frame's lights into a layer canvas (with `lighter`) as it draws
  the world far to near, at each picture's depth: anything drawn later in front of a light (a pawn, a boss, a nearer
  home or tree) cuts its shape out of the layer (`destination-out`), so a pawn walking past a lit doorway stands dark
  against it, not lit through; the cut is clipped to the boxes of the lights it overlaps. After the tint the layer is laid
  on the world with `lighter`. No per-pixel work in a frame.
- **Only where a light touched.** The layer is cleared and laid on in 64 CSS-pixel tiles (`lightTilePx`), only the tiles
  a light touched; two layers are used in turn so clearing one never waits on the other. By day and at dawn nothing is
  made or drawn at all.
- **Things fade with distance and haze the same way their pictures do**: a light's strength is its picture's alpha times
  one minus its picture's haze in the far band, so no glow floats on its own. The far Colosseum standing past the rim
  (`drawFarColiseum`) stays unlit: it's a hazy shape on the horizon.
- **The flicker** (`lightFlicker` 16% at most, `lightFlickerMs` 700 ms a sway): two slow sways out of step on the lights
  marked `flicker` (lanterns, candles, torches), never a blink.
- **Colors**: the warm light from inside a home `#ffb85c`, a lantern's `#ffb648`, a torch's `#ff9a3c`, Ginger's ice-blue
  `#a8dcff`, the funhouse's pink `#ff8fe0` (`houses/kit.ts`).

## Frame rates

Measured as slice 6 did: headless Chromium, the default view (the park and the Colosseum in sight), warmed 6 s, then 3 s
still and 3 s walking (three taps a second apart); phone 390 × 844 at 3×, computer 1440 × 900; frames a second.

**Today (Oct 27, a busy machine).** Main and this branch built and measured in turn (this branch, main, this branch, main),
3 runs each, so each figure is the median of 6:

| | Phone day | Phone night | Computer day | Computer night |
| --- | --- | --- | --- | --- |
| main, still / walking | 58.0 / 53.5 | 55.9 / 51.9 | 42.0 / 42.6 | 37.8 / 41.3 |
| lights, still / walking | 58.0 / 55.0 | 52.0 / 48.9 | 43.2 / 46.7 | 35.2 / 37.5 |

By day the lights cost nothing (nothing is made or drawn; the differences are the machine's noise, which ran to ±5 between
runs of the same build). At night, on this loaded machine, they cost about 2.5 to 4 frames a second: the light layer's work
is about 1 ms a frame on the phone and 1.25 ms on the computer (timed in the page), plus laying it on the world.

**Earlier the same day, on a quieter machine** (the first build of this work, before the change below, which only removes
work): main 60.0 / 59.0 phone night, 52.4 / 54.3 computer night; the lights 60.0 / 57.7 and 51.4 / 54.4: within 1.5.

**What was trimmed:** a picture drawn in front of a light used to cut its whole shape out of the light layer, so the
Colosseum standing in front of a far home's lit window cut a Colosseum-sized hole every frame; it now cuts only inside the
boxes of the lights it overlaps (the layer's work on the computer: 2.2 → 1.25 ms a frame). The layer's tile size made no
measurable difference (16, 32 or 64 px). What's left is about evenly the lights' own drawing, the cuts, and the layer's
flush; the levers, if a phone ever needs them: smaller lamp halos and pools (they're the biggest pieces), or a
half-resolution layer on phones.

## Tests

- `packages/app/test/town-lights.test.ts` (new): the lamps (8 to 12, each in the park or just outside its walk, solid, on
  paving, a park prop; none on the promenade, a stool, a table, the fountain, the apron, a statue's square or a home's
  roaming ground; every square and stool still reached from the start, and the walk still goes round the corners; about
  a pawn and a half tall, its glass lit with a halo and a pool under it); every home and the Colosseum has light spots
  inside its picture, each lighting some of its pixels, none on a sign, Hollow's green window untouched; the Colosseum's
  gate first and none near the statues; off at dawn and day, on at dusk and night (night stronger), following the
  blend from dusk into night step by step.
- `e2e/town.spec.ts` (new test, phone and desktop): at `?sky=night` the pixels at a park lamp's glass and at Babur's
  Circus's lit doorway are clearly warmer and brighter than at `?sky=day` (by more than 25 in luminance and in red minus
  blue). Test hooks: `__townAt("lamp", i)` and `__townAt("light", id)`.
- No existing check changed.
