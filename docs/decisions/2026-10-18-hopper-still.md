# The hopper, a rabbit riding a grasshopper: a still for Eric's review (Oct 18, 2026)

**Eric:** "New boss, a cute rabbit and grasshopper, they are friends. Just one sprite from a coding standpoint … the
smaller grasshopper is a bit easier for our style probably."

## What was built

`packages/app/src/characters/hopper.ts`: `HOPPER` with `HOPPER_PALETTE`, one pose (`idle`, a single frame) and
`HOPPER_PORTRAIT`. "Hopper" is a working name: the boss's name isn't decided. He isn't in `CHARACTERS`, `BOSS_KITS` or
the roster, so nothing in the game draws him yet. The preview draws him through its `extra=` option
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
- **Size:** an 84 x 84 frame. He's 70 px from the halo over the rabbit's ear tips to his feet (the select stage's
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
  ring), 46 x 55, a little taller than wide, like the Hidden Boss's (the tile and the boss bar size portraits by width).
