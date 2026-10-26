# The town square, slice 2: the sky by the time of day, real clouds, zoomed out (Oct 26, 2026)

## Eric's words (Oct 26, on slice 1, trimmed)

"This came out really nice… it feels great." Then: "Let's make the default zoom the zoom out… it feels a little nicer."
"I do like having the names written on the things as well. And above… having both… So you can fill in the sign for the
cow." On the clouds: "you have the blue fade on the angle of… the edge of [the world], and then it goes straight to white,
and then it goes back to blue, so it looks kind of choppy." "They're also kind of too circle-y… They don't really look like
real clouds." "Bring the clouds up, so the clouds are more in the sky." "Factor for the time of day that the local time
is… three phases: a sunny, and then… dawn or dusk, and then nighttime with stars… a big moon… or a big sun… that kind of
sits in the horizon… [and] slightly shifts… as you run in one direction." "I'm curious what it would look like with more
of just a normal kind of black border on the world." Then (through the director): make dawn its own fourth look, softer
and cooler than dusk.

## What changed

- **Zoomed out from the start**, phone and computer (`startZoomedOut`; slice 1 opened zoomed in). − and + work as before.
- **Every sign shows its home's name** at the zoomed-out view, both name styles on. Slice 1 wrote it in Press Start 2P
  only from 6-pixel letters, and zoomed out on a phone a home is about 100 pixels wide, so every board stayed blank there
  (the meadow's looked blank to Eric). Now: the signs' own pixel capitals (`sign-font.ts`, 3 × 5 letters, about a third
  narrower than Press Start 2P at the same height, drawn once per size in whole device pixels), on one line or two, from
  4.5-pixel letters (`signMinCap`); and every board is 24 pixels tall in the art (the meadow's 72 wide), so each name's
  letters are about 5 pixels tall at the zoomed-out view on a phone from 3 squares away, and about 10 on a computer.
- **The sky by the device's clock**, four looks blending in order over half an hour each, read once a minute:

  | Look | From | Sky (top → horizon) | Sun / moon | Clouds | Tint over the world |
  | --- | --- | --- | --- | --- | --- |
  | Dawn | 5:30 | light blue, lavender, pink, peach, pale gold | pale gold, on the left | lit soft pink | faint pink, 5% (and a low mist) |
  | Day | 7:30 | slice 1's blue to pale blue | big soft sun, on the right | white | none |
  | Dusk | 17:30 | dark blue, purple, pink, red-orange, gold | big, low, orange, on the right | lavender, lit pink and orange from below | warm orange, 10% |
  | Night | 19:30 | deep navy | big pale moon with craters; stars, a few twinkling | few, faint | cool navy, 34% |

  The colors are in `feel.ts` (`skyLooks`). `?sky=dawn|day|dusk|night` on `/town` holds one look (for Eric and the tests).
- **The horizon is one soft line**: the far ground, the haze strip and the skirt under the rim dissolve into the sky's
  own horizon color in every look, and the clouds are up in the sky, so nothing white sits between the haze and the sky.
- **Clouds that look like clouds**, up in the sky, spread with gaps, drifting slowly and shifting a little as you walk.
- **`rimLine`** in `feel.ts` (off): a dark line along the world's edge, its color `#1f2530` and width 2. Stills with it on,
  one per look, are in the PR for Eric to compare.
- **The chips show each boss's head** (Babur's showed his balloons).

## Judgment calls

- **Pixel clouds, not soft ones.** Both were drawn from the same shapes and looked at side by side at real size on a
  phone: the soft ones looked out of focus next to the crisp pixel homes and bosses; the pixel ones (3-pixel cells, each
  puff shaded as a ball lit from the top left, flat-ish bottoms, a few wisps) sit in the same world. Not circles: each
  cloud is a few wide domes, roughened.
- **Dawn and dusk** are separate looks (Eric's later note). Dawn's sun stands on the left (`sunX` 0.3), dusk's and day's on
  the right (0.7): it rises on the other side from where it sets. Changing from dawn to day, the two suns cross-fade over
  the half hour rather than one sun travelling.
- **The tint** is one translucent fill over the whole box after the world is drawn (the sky included, its colors chosen
  with it on), with the name tags, the bubble and the homes' names drawn after it so they stay as readable at night.
  Dawn's is barely there (5%), dusk's 10%, night's 34%, checked against the checker, the homes and the tags in the stills.
- **The sun and moon** sit with their middle just below the horizon (a tenth of their radius), so they rest on the world;
  they swing ±6% of the box's width as you walk once round the world (a sine of your position, so they never jump), about
  6 pixels a square on a phone: "barely".
- **Signs in capitals**, as on Eric's pictures; the floating names keep their case.
- **The world's names over bubbles:** a boss's bubble is drawn over a home's floating name (they met over Ginger Igloo).
- **Frame rate.** Measured headless (software rendering), 5 s while walking, the medians of four runs taken in turn:
  zoomed in (slice 1's view), 59.4 fps on a phone and 57.0 on a computer (slice 1: 57.8 and 52.2), so the sky costs
  nothing to speak of; at the zoomed-out default, 53.3 on a phone and 46.9 on a computer by day, 52.9 and 43.6 at night.
  The difference is the zoomed-out view's ground: about twice as many squares (some 700 on a computer), each an
  antialiased polygon; without the squares the same frame runs at 60. Cheaper drawing taken on the way: the squares
  batched one fill per color, small far squares (under `seamMinPx`, 7 pixels) drawn once without a seam, the sky filled
  only down to the rim, stars as single pixels rather than a sky-sized canvas.
