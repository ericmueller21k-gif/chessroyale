# Chub & Chirp (the hopper), a rabbit riding a grasshopper: a still for Eric's review (Oct 18, 2026)

**Eric:** "New boss, a cute rabbit and grasshopper, they are friends. Just one sprite from a coding standpoint … the
smaller grasshopper is a bit easier for our style probably."

## What was built

`packages/app/src/characters/hopper.ts`: `HOPPER` with `HOPPER_PALETTE`, one pose (`idle`, a single frame) and
`HOPPER_PORTRAIT`. The boss is **Chub & Chirp** (Eric's name, Oct 18: Chub is the rabbit, Chirp the grasshopper); the
code keeps the id and file name `hopper` (ids don't follow display names, as `pig` for Wrangler), and `HOPPER.name`
is "Chub & Chirp". He isn't in `CHARACTERS`, `BOSS_KITS` or the roster, so nothing in the game draws him yet. The preview draws him through its `extra=` option
(`npm run preview:characters -- <dir> extra=packages/app/src/characters/hopper.ts only=hopper`).

The rabbit and the grasshopper are one character, built like the other bosses: painted parts (the grasshopper's
head, thorax shield, abdomen and wings; the rabbit's head, body, foot, tail, satchel and scarf knot; the saddle and
girth) and strokes from points in `hopperLayers(pose)`: all six legs (hip, knee, ankle, toe), the antennae, the rabbit's
ears and arms, both reins and the scarf's tail. So the hop, the ear flops, the reins snapping taut and the scarf
fluttering are numbers in `HopperPose` (`bob`, `air`, `ride`, the legs, `earN`/`earF`, `pawN`/`pawF`, `sag`,
`scarfEnd`/`billow`). Outlines, light from the top left and the halo follow the roster.

## Calls made

- **The design** (the director's call, which Eric can change): the simple reference's shapes, with the detailed one's
  green scarf (gold clasp) and brown satchel on the rabbit, and a small brown saddle. The detailed one's armor, gold
  trim and gems are left out: at this size they were clutter.
- **Facing our left**, as Alfil and Sawyer (and the detailed reference). The simple reference faces right, so its
  shapes are mirrored.
- **Size** (as first drawn; Eric's edits below change his width and the `wide` call): an 84 x 84 frame. He's 70 px from the halo over the rabbit's ear tips to his feet (the select stage's
  limit, so he's drawn at full size, 0.8) and 82 px wide: 43 px left of his feet (the antenna tips; the side stage
  allows 44) and 38 right (the hind foot and wing tip; Sawyer reaches 35, Wrangler 37). On a phone's boss bar he
  needs the `wide` box, as Sawyer, Wrangler and Alfil do. The frame has 14 empty rows on top for his hop later (the
  stage sizes him by the rows he draws in, so they change nothing at rest).
- **Colors:** the grasshopper in five greens with yellow-green legs, belly and antennae; the rabbit in four browns with
  a cream chest, muzzle, tail and sole and pink inside his near ear; the scarf a deeper blue-green so it doesn't merge
  with the grasshopper; the leather redder and darker than the rabbit's fur so the saddle, reins and satchel stand
  apart from him; the game's gold (`#f2c14e`) for the ring, the clasp, the buckle and the saddle's stud.
- **Simplified for the pixel size:** the reins are one-pixel lines with no outline (outlined, they read as a pole);
  no whiskers, no fur strands, no herringbone on the hind thigh, no headstall (the ring sits on his cheek alone); one
  vein and a few slanting ribs on the wings; the satchel's strap left out (under the scarf it was a few stray pixels);
  the saddle a small pad with a raised back edge and a gold stud, and the girth a strap lying on the body.
- **The portrait** shows both heads: the rabbit's (ears included) and the grasshopper's (eye, antennae, mouth and the
  ring), 46 x 55 (48 x 60 after Eric's edits), a little taller than wide, like the Hidden Boss's (the tile and the boss bar size portraits by width).

## Eric's edits (Oct 18)

**Eric:** "I think the sprite is fine tbh I'd just reduce slightly the cricket size, fix the scarf, and make the bunny
a tad bigger, basically the ratio of them is off I liked the ratio of the other duo of them I sent better."

- **The ratio** (the rabbit sitting up, ear tips to seat, over the grasshopper's body, face to abdomen or wing tip,
  without antennae or legs; measured on the drawn pixels, outlines left out):
  - the simple reference: about 0.93 (635 over 680 of its pixels);
  - before: 0.55 (the rabbit 42 px, the grasshopper 77);
  - now: **0.84** (the rabbit 49 px, the grasshopper 58).
- **How:** the shapes keep their numbers. Each figure is drawn in a space of its own and scaled into the scene
  (`BUG`, `RIDER` in `hopper.ts`): the grasshopper (body, legs, antennae, the ring) at 0.75 about his toes, the rabbit
  (head, ears, body, arms, foot, tail) with his saddle, satchel and scarf at 1.18, seated a little further back (his
  seat on the grasshopper's back at 46, was 43) so his face stays clear of the antennae. Pose numbers stay in each
  figure's own space; `bob`, `air`, `dx`, `ride` and `sag` are scene pixels. Thin lines (the legs, the antennae, the
  reins, the wing vein, the ridge, the belly's segment lines) keep one pixel rather than shrinking away.
- **Why 0.84, not the reference's 0.93:** he must stay within the select stage's 70 px, so every pixel the rabbit
  gains the grasshopper's height must give back. The full 0.93 needs the grasshopper at about 0.68 and the rabbit at
  1.23: a much smaller mount under a rabbit that's already chunkier than the reference's slim one (a big head, a wide
  haunch), which reads as more rabbit than the reference has. Eric asked for "slightly" and "a tad"; 0.84 is most
  of the way, and the duo reads like the reference.
- **The antennae** tilt a little further forward (tips at -4, 13 and 1, 9.5; were -1, 11 and 4, 7.5), clear of the
  bigger rabbit's muzzle, as in the reference. Same shape.
- **The scarf:** the tail was a thick, straight tube out to the side. It's now a thin band (3 px at the knot) that
  tapers to a point, leaves the back of his neck just above his back and waves: up, then down, the wave growing toward
  the tip, out past his back into the air (as the detailed reference's). It's drawn over his back and under his head,
  so the knot and its clasp sit on top. `scarfEnd` is its tip and `billow` the wave's height (negative rises first), so
  a flutter is those two moving. Same blue-green and gold clasp.
- **Size now:** still 70 px from the halo over the ear tips to his feet (the select stage's limit, drawn at 0.8) in
  the same 84 x 84 frame with its empty top rows. He's 65 px wide (was 82): 35 left of his feet (the antenna tips),
  29 right.
- **The `wide` box: no longer needed.** On a phone's bar the usual box holds 24 px each side of his feet; he's 11
  over on the left and 5 on the right, about as Ginger (34 left) and Jefferson and Hollow (35 and 36 right) are without
  it. Sawyer, Wrangler and Alfil (73 to 75 px wide) keep it. To check on a phone when he's wired in.
- **The shadow** is 42 px (was 58), to match the smaller grasshopper.
