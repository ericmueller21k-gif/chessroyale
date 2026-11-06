# Boingo's Funhouse inside: an arcade fun place (Nov 6, 2026; WIP, paused at the usage reset)

Eric, Nov 6 (trimmed): "An arcade style … the old kind of kids' pizza arcade I loved … a spiral slide … netting three layers high
you climb up through, and at the top a slide to go down … one of those half-dome spinny arcade games where you press the button as
the light goes around … roll-ball lanes on the wall … his shop like a prize store you walk into, prizes up on the wall … goofy things,
little stuffed animals … repetitive is fine … his pogo stick as the centerpiece with a sign next to it saying how much it costs, and a
light down on it like you did for the portraits … a claw machine … the water-squirt race game along the wall, 5 little clowns shooting
water into the holes, the race being little knights moving along, on a loop … it can be larger than the other rooms, we'll add more."
No custom intro this round (Eric). Boingo is live, so the room goes to everyone.

## The calls made here

- **No real brands, mascots or venues.** The arcade Eric loved is a feel reference only: "roll-ball lanes", "the spinning light game",
  "the squirt race", "the claw machine", "the prize counter".
- **The room is 24 x 24 squares** (the others are 20): `RoomArt.n` (`SHOP_BOINGO_N`), passed to `makeRoom`; every other room's 20 is
  unchanged.
- **Drawn by hand in code** (`shops/boingo-art.ts`), Boingo's `CLOWN_PALETTE` with the arcade's own keys added (night-blue confetti
  carpet, chrome, glass, bulbs, a pink-and-teal carnival mat). Plenty of light: the marquee bulbs on every wall piece chase on one
  clock (3 frames), and every game's glow is a light at every placement of its piece.
- **The Shopkeeper** is a clown attendant in the prize store's teal uniform, drawn with the clown kid's rig and moves recolored
  (`characters/sidekicks/funkeeper.ts`, baked as the others; `sidekick-funkeeper`). "Shopkeeper", no name, not a town bot: Squirt
  stays Boingo's kid.
- **Boingo's Boss Crate** with Boingo's Pogo (his ride) first, in `BOSS_CRATES` after Folio's.
- **The pogo's sign** reads its price from the crate settings (`pogoSign()`, `BOSS_CRATE_PRICE.tokens`): "BOINGO'S POGO: 3 Boingo tokens".
- **His challenge** uses the default intro on the mat: his line "Step right up! Honk honk!" (new, in his entrance lines' voice), the
  pop as the table comes, his slide whistle (`clownSlideUp`) as the wipe.
- **The ceiling** is the tent's for now (`roof: "tent"`): a carnival top over a carnival room. An arcade ceiling of its own can come later.
- **The chat's tone** is night (a dark arcade of lights: white words).
- **The claw machine** stub: `packages/app/src/claw/index.ts`, `openClawMachine(): void`, a small "Coming soon" card closed by a tap.

## Left when paused (02:59 UTC)

- The price sign's words drawn on its gold face (`POGO_SIGN` is ready; no room draws sign text yet, so it needs a few lines in
  `ShopRoom.tsx`'s static layer).
- The arcade's own ceiling (the tent's for now).
- The claw machine's walk-up zoom (as the statue's). Its tap is wired (standing at its spot, a tap on the machine's square calls
  `openClawMachine()`), but on the whole machine, not yet on the coin slot's own box (`SHOP_BOINGO_COIN_SLOT`).
- The squirt race's win flash and reset are in its frames (two races, a different winner each); the clowns' squirt is drawn in the
  race piece, not yet its own small character.
- The unit tests of the claw zoom and of the stub on the slot's tap (the room's, the mat's, the keeper's, the crate's, the race loop's
  and the lights' are in `packages/app/test/shop-boingo.test.ts`); the e2e of the claw zoom and the challenge; the frame rate against Folio's room; the
  stills and GIFs on both platforms; the area page; the PR body.
