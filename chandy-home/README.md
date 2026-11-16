# Chandy's Swamp: round 1 mockup (Nov 16)

Branch `claude/chandy-home` (from `claude/boss-chandy`). Everything except the rise is the real game, in an admin's town (Chandy is
in `BOSS_ADMIN_FIRST`, so nobody else sees it).

## The stills

1. `01-front-day-phone.png`, `02-front-day-computer.png`: the swamp on **Meadow Street** between Wrangler's Stall and Moo & Moon
   Meadow. Two bald cypresses as tall as the row houses beside it, Spanish moss, hazy cypresses across the water so the street doesn't
   show through, low brush, lily pads, cattails, a plank boardwalk as the way in, the sign on the near bank. Chandy wanders out front.
   The lot's sides and back are leafy walls, and inside the box is flooded.
2. `03-front-night-phone.png`: at night the lantern on the boardwalk's post glows and three fireflies blink over the water.
3. `08-room-day-phone.png`, `09-room-night-phone.png`: inside. There's no roof: the sky is the town's sky at that time of day (stars
   at night). All the way round stand cypresses in the water, and the whole floor is swamp water. At the back is the bullfrog's stand
   on stilts (tin roof, bait sign, jars, his crate on it). Then a half-sunk rowboat, a log, cypress knees, a stump and cattails.
   Nothing marks the battle spot. It's under the water. Dusk gets a warm dim, night a blue dim with the stand's lantern lit.
4. `04-walk-wading.gif`: walking in the water. The water hides your feet behind a ripple ring. Each third of a square kicks up 5
   drops of spray and leaves a widening ring. No shadow while you're in the water.
5. `05-challenge-rise.gif`, `06-wipe-first-frames.png`: **a flat mockup** drawn from the real pieces (the game plays it in the room's
   camera once it's built). The order:
   - you on your marks in the water;
   - **the board's mossy post rises first**, water streaming off it, its foot still under the water;
   - **the platform rises** under you both, lifting you 22 px, with the post's foot on it;
   - **two milk crates** drop on as the stools (his blue, yours orange);
   - his point and shot as a stand-in for his God King swing;
   - **the wipe**: the swamp's water rises over the screen, reeds and a lily pad riding its wavy edge, bubbles in it.

   The rise takes about 4.4 s and the whole thing about 8.8 s. The checkered slab on the post is a stand-in: the game lays the real
   board there.
6. `07-keeper-a-bullfrog.png`: the Shopkeeper.

## Calls for Eric

- **K. Who keeps the shop?** **A (recommended): the old bullfrog** in a faded bucket hat and a fishing vest (07: idle, a throat puff,
  a wave). B: a snapping turtle in hip waders, a fishing rod over his shell (not drawn yet; say B and I'll draw it).
- **P. Where:** Meadow Street, between Wrangler's Stall and Moo & Moon Meadow (lamps on both sides). OK, or another lot?
- **H. Height:** the cypresses stand about as tall as the row houses next to it (taller than most homes, like the Walk-up). OK?
- **R. The rise:** post first, then the platform 22 px up with both of you on it, then the crates. Faster, slower or higher?
- **W. The wipe:** water rising from the bottom. OK, or water coming in from the sides?

## Not there yet / for others

- **His crate (the item-builder's lane):** core has no Boss Crate of Chandy's yet (`crates.ts` `bossCrate("chandy", …)` and its ride
  item). Until it lands the frog has no crate to sell: Talk gives one of three lines, like Rolling Dough's. The crate on the stand is
  only a picture.
- **The challenge:** his rules aren't in the roster yet. His card's "Challenge alone" is greyed and says "Coming soon".
- **No town chatter** for him (no kid of his): like Rolling Dough's.

## Frame cost on a phone (estimate; measured at the build with `@perf`)

- Front: one more home picture (144 x 170) and its box, like any home.
- Room: drawn like every room (its back is kept as one picture while the camera rests). Per frame the only additions are one clip per
  walking figure, a ripple ellipse, at most 24 drop rectangles and 6 ring ellipses, all on the room's one canvas with no new loop.
  That should be well under a millisecond.

## Files (on `claude/chandy-home`)

- `town/houses/chandy.ts`: the front
- `home-boxes.ts`: the box
- `town-kit.ts`: the new `foliage` and `water` textures
- `street-plan.json`: the lot
- `shops/chandy-art.ts`: the room
- `ShopRoom.tsx`: the `sky` roof, `wade`, the spray
- `characters/sidekicks/swampkeeper.ts`: the frog
- `characters/chandy-figure.ts`: his town figure
- `shops/chandy-intro-art.ts`: the challenge's pieces
- `scripts/boss-art/chandy-home-stills.ts`: the rise mockup
