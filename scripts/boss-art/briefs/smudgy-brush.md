# Brush Ride (a ride, Boss Series): redrawn, Oct 31 (Eric's design)

Draw **Brush Ride**, a hyper-rare ride from the boss Smudgy: the chameleon painter boss (a lime-green chameleon with a
striped casque, big amber eyes, a plum beret, a paint-splashed apron, a big brush and a palette; the references show
him). This replaces an earlier drawing Eric turned down (too long, a red paint blob on the bristles, drips and a palette
dangling): **don't do those**.

- **Eric's design:** a giant paintbrush **flown like a broom**, held level above the ground with a soft shadow, the
  bristles behind (our left), **shorter than before**. A **wooden handle**, the **metal band** (ferrule) where the
  bristles meet the handle, and **black bristles** like a real brush's hair (a dark, tapering tuft with a few strand
  lines, a little highlight). **No paint blob, nothing dripping or dangling** (no drips, no palette, no hanging
  things). The pawn sits astride the handle near the middle, upright, only its very bottom hidden behind a small seat
  pad (or just the handle) so it reads as riding *on* the brush, never cut in half.
- **The painted part** (the item's color): **the bristle tips** (the last stretch of the black bristles dipped in the
  color), and a **short trail of that color** it leaves behind as it moves: a soft brush-stroke ribbon that fades. A
  little of the trail in the idle too (a short wisp from the tips that comes and fades). The handle, band and black
  bristles are fixed colors.
- **Idle:** a slow float bob with a slight sway, a short wisp of color from the tips.
- **Town move:** it **swoops** across the square, leaving a **short** stroke of color in the air behind that fades.
  One square per move, dx 0 to 100; its last frame leads into the next move's first.
- **Size (Eric: "be cognizant of the horizontal size"):** the brush itself, every frame, stays within **1.25 squares
  wide**: at most 125 units across, e.g. x from about -12 to 113 on the pawn's 100-unit square, the idle wisp included;
  the move's trail may reach a little further back but keep it short.
- It must read at town size (a pawn about 45 px) and look great at 4x. Cute and charming. The item style (bold dark
  outlines, flat fills, a highlight or two). Never draw letters or numbers.
- Tier: mythic. Name it "Brush Ride", id "smudgy-brush". Say in your notes the ride's width in units.
