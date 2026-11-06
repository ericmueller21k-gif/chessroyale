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

## Eric's correction on the claw machine (Nov 6, relayed by the director)

The claw machine must be "the real claw machine in the room, a big 3D arcade cabinet you walk up to. You watch the cabinet's own claw
move over the crates inside, grab one, lift it and usually drop it. Not a separate 2D overlay screen." So `claude/claw-machine`
(e7a50ec0) is merged in with its server, rules, token picker and result texts as built; its 2D roaming-claw screen is retired.

- **The cabinet** (`town/shops/claw-cabinet.ts`): a solid box of 2 x 2 squares drawn in true 3D through the room's camera (`proj` with
  a lift): base with the coin slot, joystick, button and prize door; glass sides and a glass ceiling; crates piled on felt; the chute;
  the gantry, trolley and the claw on its cable; a lit header with chasing bulbs. Paths and fills only, no pictures.
- **The play as the room draws it** (`claw/view.ts`): the controls write the stage and its time (`CLAW_PLAY`); `clawPose` poses the
  cabinet's claw from them and from the server's answer only. A win: grab, lift, carry to the chute, out into the tray. A loss: usually
  grabbed and dropped back on the pile partway up, a quarter of the time a slip (cosmetic, from the play's id). STOP only changes where
  it drops. Unit tests: `packages/app/test/claw-view.test.ts`.
- **Walking up** to its spot (19, 7) glides the camera in (the statue's way: `SHOP_FEEL.claw`): it comes down to the Close camera and
  frames the whole cabinet through a longer lens, above the controls. A tap on the cabinet walks you to the spot; a gold arrow bobs
  over the coin slot; a tap there opens the controls, now a small panel docked at the bottom (196 px), the cabinet in view above.
- **Kept:** the admins' "Admin: +3 of each token" button and the e2e seed hook (`?clawSeed=`). Retired: the `?claw=1` page-load switch.

## Where it stands (paused at the director's word, Nov 6, ~04:10 UTC: the Colosseum first)

Done and pushed: the room (the arcade ceiling, the price sign's words, the clown attendant), the in-room claw machine above, the unit
tests (`shop-boingo.test.ts`, `claw-view.test.ts`), and three e2e passing on phone and computer: `e2e/shop.spec.ts` "Boingo's
Funhouse" (rerouted in short northward hops: a hop toward the camera or more than about four squares away can be off a phone's screen,
and the keeper's talk range opens his card, which takes the next tap), `e2e/claw.spec.ts` (walk up, the zoom, the slot, the grant, a
forced win into the tray with Open now, a forced loss that never reaches the chute) and `e2e/boss-challenge.spec.ts` "challenging
Boingo" (the default intro on his mat, the battle, back where you stood). Stills so far in `docs/boingo-home/` (phone).

Left:
- The frame rate against Folio's room on a slowed phone (a local measurement spec was written; its run was cut by the pause).
- Stills on a computer; the GIFs (a squirt race, an in-room claw play: the frames come from `CLAW_SHOTS`).
- `e2e/areas.json`: Boingo's room and the cabinet's paths (`town/shops/boingo-art.ts`, `claw-cabinet.ts`, `claw/view.ts`) to the shop,
  claw and challenge specs.
- The area pages (`docs/areas/town-square.md`, `shop.md`), the claw branch's note and PR body brought in line with the in-room machine,
  and `docs/boingo-home/pr-body.md` (lane: full e2e, covering the claw).
