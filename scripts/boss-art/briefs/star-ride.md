# Moon's Ride, redrawn as a rounded star (a ride, Moo & Moon's), Nov 17

Redraw **Moon's Ride** (it keeps its name for now) as a **rounded star**. Eric: "It should resemble more a flat 3D rounded
star ... It's just a 3D flat rounded star ... this one has just a single color to it. There's no dual color. But it
should have ... some shading to it ... So not just a total flat, same exact color for the whole thing."

- **The shape:** a thick, puffy **five-pointed star** with **fully rounded points** and soft rounded edges, like a pillow
  or a rounded cookie. It lies **flat and level** under the pawn like a hovering platform, seen from the town's camera
  (slightly from above, about 30 degrees): we see its **top face** as a five-pointed star, a little flattened by the
  angle, and below that its **thick rounded side** (a puffy band, about 10 to 14 units deep), so it reads as a solid 3D
  star, not a flat sticker. One point faces forward (our right), one back, the others spread round.
- **Shading (one color, never flat):** it's all the item's color, shaded light to dark: a **lighter, glossy top face**,
  a soft **highlight near its center** (and a small glint), the color getting darker over the **rounded sides and
  underside**, and the darkest under the far points. Paint the whole star as the painted part (one `Region`, or a few
  with the same paint), with the shading drawn over it from `lighten`/`darken` of the item's color. `colors` stays 1.
  It must read in every color: pale ones (Pearl) still show their shape by the darker sides; dark ones (Midnight) by
  their lighter top and highlight.
- **No** thrusters, turbines, fins, handles, rails, wings or a face. Nothing else on it. Keep it our own: a plain
  rounded star in the game's item style (bold dark outlines, soft shading), not any game's star vehicle (no rainbow
  trail, no other franchise's details).
- **The pawn sits on top**, upright, in the middle of the top face: its base resting on the star (at most its bottom
  few units hidden behind the star's near edge). It rides *on* the star, never in it.
- **It hovers:** it floats a little above the ground (a gap of about 6 to 10 units) with a **faint soft shadow** on the
  ground below it, a soft dark ellipse that stays on the ground and shrinks a little as the star rises.
- **Idle:** hovering: a slow, gentle bob up and down (2 to 3 units), the pawn moving with it, the shadow staying put.
  **No sparks or twinkles at rest.**
- **Town move:** a smooth glide across the square, still hovering (the same small bob, maybe a slight forward tilt), and
  from its **back point** a little **sparkler fizz**: a few tiny bright star sparks (pale gold and white, fixed colors)
  that pop out of its back point and fade right there, staying with the star as it goes (like a sparkler's fizz; not a
  ribbon or a long trail, nothing left behind: the trail mark comes later). One square per move, dx 0 to 100; its last
  frame leads into the next move's first.
- **Size:** the whole ride, every frame, within **125 units wide** (sparks included; aim for the star about 90 to 100
  units across). It must read at town size (a pawn about 45 px) as a star, and look great at 4x.
- Side view only for now (front and back come next). No trail mark yet.
- Tier: mythic. Name it "Moon's Ride". Description: one line with a little humor about riding a star. Say in your notes
  the ride's width in units.

## Second try (the first was turned down)

The first try is `scripts/boss-art/out/_prev/star-ride-try1.tsx` (read it; its picture is the reference
`try1-idle-turned-down.png`). **It reads as a flat red splat or puddle, not a star:** seen too flat (squashed to 0.55),
the pawn sitting in its middle hides most of it, the points are short and stubby, and its side is too thin to look puffy.
Keep what worked (one color shaded light to dark, the soft shadow staying on the ground, the sparkler fizz at the back
point, the glide) and fix the shape:

- **Show the star.** Look down on it more steeply (a vertical squash of about 0.7 to 0.8, not 0.55), so its top face is
  clearly a five-pointed star at town size, with **long, clearly separate rounded points** (deep notches between them,
  the points' tips round like a cookie cutter's star, not a blob). Turn it so a point faces the camera (down-front) and
  the others spread left, right and back, and so the points show **round the pawn**: the two front points and the two
  side points in front of and beside the pawn, the back point peeking above its shoulders or beside it.
- **Make it puffy and thick:** a rounded side about 14 to 18 units deep at the front (less toward the back points), bulging
  like a pillow, darker as it turns under, so it's clearly a 3D rounded star, a little like a plump star cookie.
- **The pawn sits on the back half of the top face**, so more of the star shows in front of it; its base rests on the top
  face (a cut is fine where the face's front edge would hide it).
- A clear **hover gap**: the shadow on the ground well below the star (6 to 10 units of air between them).
- Smooth soft shading (a gradient or several soft bands), so it reads as glossy and rounded, not splotchy.
- Keep within the limits: 125 units wide, the pawn's head no higher than about y −9 at the top of its bob (shrink the
  star's height or seat the pawn lower if they clash, never the star's points).
