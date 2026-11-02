# Babur's shop, second pass: three burning hoops, the room's animated showpiece

The first brief (`scripts/boss-art/briefs/shop-babur-interior.md`) still holds, except where this one changes it. Your
drawing exists: **read it first** (`scripts/boss-art/out/house-shop-babur/house-shop-babur.ts`) and revise it with
`edit_drawing`. Don't rewrite the file, and leave every other piece as it is.

## What Eric asked for (Nov 2)
"Every house will have an animated piece… The circus: add in the same 3 fire rings/hoops with the animation being the
flame." This overrides "no fire anywhere" for this one piece. The rest of the room stays as it is.

## The piece: `fire-hoops`
- **Three burning hoops on stands**, the same hoops Babur throws in his ultimate. Read how they're drawn and take their
  look and colors, value for value:
  - `packages/app/src/characters/tiger.ts`: `hoopPart`, the hoop held in his paw, and its fire and steel keys, `p…` and `%`;
  - `packages/app/src/characters/effects/tiger.ts`: the ring of fire, `HOOP_PAL` and how its flames lick.
- **Each hoop** stands upright facing the camera on a short stand (a steel post on a small round base, a gold collar). It's
  a ring of steel about 30 px across, with tongues of flame licking up and outward all round it.
- **The three hoops in a row, one per square:** 3 x 1 squares, about 111 wide and about 80 tall. Put them on the east side
  in place of the cold `hoop-stand`, at columns 15-17, row 4 (solid). Move or drop the cold hoop: your call, but keep the
  room uncluttered and the path from the door to the counter clear.
- **Its idle is the flames**, 6 to 8 frames at about 100 to 120 ms, looping. The flames flicker and lick up round each
  ring, and each hoop's flames run out of step with the others so the three don't pulse together. A spark or two rises now
  and then. Only the flames move: the steel and the stands stay still.
- **Add an optional light** for the game to glow it, as the park's lamps have: export `SHOP_BABUR_HOOP_LIGHTS` (`LightSpot`s
  over each ring) and `SHOP_BABUR_HOOP_POOLS` (`LightPool`s of warm light on the sawdust under them). Their types are in
  kit.ts, and `TORCH` is the color.
- Add it to `SHOP_BABUR_PIECES`, `SHOP_BABUR_LAYOUT` and the room still, and give it its own viewing animation in
  `HOUSE_SHOP_BABUR` (`fire-hoops`, all its frames).

## Looks
- Render `fire-hoops` frame by frame at 4x on both backgrounds, then the room still (scale 1).
- Check that the flames loop smoothly and read as fire round a ring, at 4x and at the town's scale.
- Check that the room's path is still clear.

Call done with notes: the piece's size in pixels and squares, its frames beat by beat, and where the cold hoop went.
