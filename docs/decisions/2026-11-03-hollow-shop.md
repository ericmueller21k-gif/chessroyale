# Hollow's cave in the game: Hollow Peak gets an inside, his dog keeps the shop (Nov 3, 2026)

Eric approved the art Nov 3 ("pretty much everything is perfect"): `claude/boss-art` at a53eba78 (`house-shop-hollow`,
`sidekick-hollow-dog`; notes `scripts/boss-art/out/shop-hollow-nov3.md`). Copied in as Dash's shop was (PR #477): the art's
imports moved, its room still and review strips left there. Hollow is live for everyone, so his cave is too (as Big Boy's).

## The calls

- **The cave's shape** is the art's mask, `SHOP_HOLLOW_FLOOR`, passed with the room's art (`RoomArt.floor`). `makeRoom(…, mask)`
  blocks every `#` square as well as the edge and the solid pieces; a box room passes no mask and is unchanged (`Room.floor` null).
  Walking, taps (a tap on rock walks you beside it) and paths need nothing else.
- **The camera.** A drag's focus is kept over the floor (`camFocus`: the nearest floor point), never into the rock. The ground past the
  room's 20 × 20 squares is filled with the rock's own tone (the flat rock tile's average color, worked out once), one fill under the
  horizon, so no view ends in nothing; past the mouth, the snowy night (the art's snow in shade) where a box room has its bright day.
  The far camera sits about six squares behind you, so walls south of you (the passage's sides, the mouth's arch as you come in)
  can stand between it and you: in a cave, a piece nearer the camera than you whose picture's box is over yours is drawn
  see-through (`SHOP_FEEL.seeThrough` 0.35). Simplest fix with no camera change, and the same idea as the existing near-camera fade.
  A unit test projects every walkable square at both zooms on a phone and a computer and checks every rock pixel over you is
  see-through; the close views along the passage, the bend and the hollow are in `docs/hollow-shop/close-views-*.png`.
- **The Shopkeeper's tag in the cave** is drawn with him (in depth order), not over everything, so nearer rock covers it. From the
  mouth at the further-out camera the counter's corner and his tag show at the screen's left edge (that camera sees over the
  hollow's low south rock); at Close it's out of sight.
- **Lights at every placement, every shop.** A light names its piece; it now shines at every place that piece stands (`lightsAt`,
  built once as the room loads), mirrored with a mirrored piece, moved with the crate, and fading with its piece near the camera.
  This also lights Alfil's second brazier and Dash's repeated shelves and windows, which lit at one place each before. The bulb
  strings' spots carry no halo or pool in the art, so they add no glow (their bulbs are bright in the art itself).
- **The dog** is `characters/sidekicks/hollowdog.ts` (the sheet's key can't have a hyphen), baked as the others; not a town bot.
  On (5, 2) and (6, 2), drawn at (5.5, 2.4), as the notes say. "Shopkeeper", no name.
- **Hollow Peak's card** keeps Hollow's line (Eric's approved words, Oct 28) over "Go in"; only its Shop and Coming soon went, as on
  every home you can go into.
- **His challenge:** the default intro for now; his line "Did you leave a light on?" (his entrance's), the wipe his darkness's cast
  sound. His lash lies 1.6 squares out in front of his feet, so at the usual hop-back place (2.6) it reached his stool: he hops
  back to 2.92 (`BossIntro.clear`, `marksFeel`'s `own`). The pond is an oval about 6 × 4 squares, so there his foot is at the ice's
  west edge (a tenth past it at most, on its snowy rim), his whole swing clear of the rock. The table, the stools and you are on the ice.
- **Starting zoom:** the further-out one, as every home. The chat: the night tone.

## Measured

- Shop frame rate, headless, walking 5 s, four runs in turn, medians: phone 390 × 844 Dash's 56.7 fps, Hollow's 53.2; computer
  1440 × 900 Dash's 57.3, Hollow's 54.9. The town's frame loop is unchanged (only the home card's markup changed).
- Lanterns in view at the challenge's start (its own camera, you both on your marks): 4 of 5 on a phone and a computer
  ((9, 5), (11, 8), (9, 11), (13, 16)); (17, 12) is just off the right edge. The bulb string shows nearly whole from the back
  corner to the tree. `docs/hollow-shop/intro-start-lanterns-*.png`.
