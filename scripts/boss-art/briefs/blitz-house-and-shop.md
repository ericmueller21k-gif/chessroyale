# Blitz's home and shop: the sneaker store

Blitz is the speed-chess cheetah: a lanky hustler in a backwards cap and a teal and orange zip jacket. Eric now wants
him to be a **silly try-hard who uses young people's slang** ("yo, this game is chopped, bro", "broski", "fam", "cuz").
His art: `scripts/boss-art/out/boss-blitz/boss-blitz.ts` (`PALETTE`: gold-tan fur with black spots, teal `A`-`D`,
orange `E`-`H`, greys, clock white, flag red). His sidekick is a sleepy tortoise, `scripts/boss-art/out/sidekick-blitz/sidekick-blitz.ts`
(about half his height), and his Cheetah Shoes are in `scripts/boss-art/out/cheetah-shoes/`.

**Drawn by hand in this session on the weekly plan usage, not the API runner** (Eric, Nov 3: the API credit is out).
Make the same files and format the runner makes.

## Eric's design (Nov 3, his words)
"Just a straight up sneaker store, wall to wall with sneakers on display, also some rows/racks with shoes / shoe boxes, a
halfpipe, a big pallet of energy drink cases called Cheetah Chug, the outside can do the neon lighting, no chess clocks
needed, it's funnier that way."

So: **no chess clocks anywhere** in the house or the shop.

## 1. His home on the town square: `house-blitz`
File: `scripts/boss-art/out/house-blitz/house-blitz.ts`. Follow the other homes:
- **Frame:** about 144 wide and 120 to 150 tall, its foot like the others', on a 3 x 3 plot.
- **Light:** from the top left, with the outline and the soft ground shadow.
- **Sign:** a blank sign board on two posts in front; the game writes the name, so never draw letters on it.
- **Exports:** `HOUSE_BLITZ: Character` (id `house-blitz`, only an `idle`), `HOUSE_BLITZ_SIGN = signFace(...)`,
  `HOUSE_BLITZ_LIGHTS` and `HOUSE_BLITZ_POOLS`.
- **Models:** `packages/app/src/town/houses/kit.ts` and finished homes such as `houses/tiger.ts`, `houses/gardener.ts`
  and `scripts/boss-art/out/house-timber/house-timber.ts`.

**The design:** a flashy little **sneaker shop** front:
- a flat-roofed storefront with a big glass window full of sneakers on lit shelves;
- **neon** in his teal and orange: a neon outline of a sneaker or a cheetah paw, a neon stripe along the roofline, an OPEN
  sign;
- a sneaker pair hanging by their laces from a wire or the awning;
- a teal and orange striped awning;
- a stack of shoe boxes by the door;
- a Cheetah Chug energy-drink crate or cooler outside.

**`idle`:** 4 to 6 frames. The neon buzzes and flickers (one letter or tube blinking now and then), and the hanging
sneakers sway. Its neon glow goes in `HOUSE_BLITZ_LIGHTS` (colored glows like the park's lamps; read how
`LightSpot`/`LightPool` work in kit.ts).

## 2. His shop inside: `house-shop-blitz`
File: `scripts/boss-art/out/house-shop-blitz/house-shop-blitz.ts`. **Follow Timber's shop exactly** for structure:
`scripts/boss-art/out/house-shop-timber/house-shop-timber.ts`, its brief `scripts/boss-art/briefs/shop-timber-interior.md`
and its notes `scripts/boss-art/out/shop-timber-nov3.md`.
- **One file, the same pieces:** each piece its own `Character` (`shop-blitz-<name>` in `SHOP_BLITZ_PIECES`),
  `SHOP_BLITZ_LAYOUT`, and the room still `HOUSE_SHOP_BLITZ` (id `house-shop-blitz`, with one viewing animation per
  piece).
- **The same exports:** `SHOP_BLITZ_COUNTER_SIGN`, `SHOP_BLITZ_CRATE_AT`, `SHOP_BLITZ_MARKS = { boss: [8, 10.5], you: [11, 10.5] }`,
  `SHOP_BLITZ_LIGHTS` and `SHOP_BLITZ_POOLS` (each with `piece`).
- **The same layout grid and camera rules:**
  - 20 x 20 squares of 37 px, with flat 37 x 37 floor tiles;
  - the back wall on row 0, the side walls on columns 0 and 19, the low front with the door at columns 9-10 on row 19;
  - the counter at columns 8-11, row 3, at **most about 32 px tall**, so the tortoise shows behind it;
  - the battle circle an octagon at columns 6-13, rows 7-14;
  - a path at least 2 squares wide from the door to the counter.
- **Marks:** start marks on the **west (boss) and east (you)**, centered on the middle of column 8 and of column 11, on
  the line between rows 10 and 11. **That's pixel y = 11 x 37 = 407 in the room's floor**, the same as the emblem's
  middle (Timber's first shop had this half a square off; don't repeat it).
- **Seen close:** the default inside is a close third-person camera (one art pixel is about 4 screen pixels), so keep
  the floor tiles calm.

**The design:**
- **The back wall:** the clean, bright look Eric likes in every shop. Big shop windows onto a bright city street or a
  skate park, between walls of sneaker shelves.
- **Walls of sneakers:** wall to wall, sneakers on lit display shelves (on the back wall either side of the windows, and
  on the side walls), in lots of colorways: his teal and orange, reds, whites, blacks, a few spotted cheetah-print pairs.
  Each sneaker is only a few pixels, but they must read as sneakers.
- **Racks and rows:** freestanding racks of sneakers, and stacks and rows of shoe boxes (orange boxes with a white
  swoosh-like stripe; never a real brand's logo).
- **A halfpipe:** a skate halfpipe ramp in a corner (about 4 x 2 squares), in wood with teal coping, maybe a skateboard
  on it.
- **Cheetah Chug:** a big pallet stacked high with energy-drink cases called **CHEETAH CHUG**, in loud colors (orange and
  teal cans, a cheetah-spot pattern), with a shrink-wrap sheen. A few pixel letters reading CHUG are fine.
- **The counter:** a sneaker-store checkout counter with a register, a shoe-box stack and a little sneaker display, and
  a blank plaque (`SHOP_BLITZ_COUNTER_SIGN`). The crate, **Blitz's Boss Crate**, is a big orange shoe box with a teal
  lid, a paw print and a spotted ribbon (idle: a glint).
- **The floor:** a polished shop floor, for example light wood or speckled terrazzo, calm. A runway rug or a lane
  stripe leads from the door.
- **The battle circle:** a sneaker-store try-on zone or a mini basketball court:
  - **floor:** polished court wood or rubber track, with his colors;
  - **edge:** a bold painted line;
  - **emblem:** 2 x 2, a big sneaker sole print or a cheetah paw in the middle;
  - **marks:** west and east, like sneaker footprints or try-on mats.
- **The animated showpiece (big, about 3 x 2 squares or more):** your call, for example a rotating sneaker display
  turntable under a spotlight, with a hero pair spinning; or the halfpipe with a skateboard rolling back and forth; or the
  Cheetah Chug pallet with a neon sign buzzing. Say what you picked and why. 8 to 12 frames.
- **No chess clocks** anywhere.

**Lights:** neon signs and display spotlights. Use `SHOP_BLITZ_LIGHTS` and `SHOP_BLITZ_POOLS`.

## How to check your work
- Render pictures with a small script of your own (see how `scripts/boss-art/render.ts` uses `renderFrame` and `png`),
  then Read the PNG.
- See it through the town's camera with the shop mockup:

  ```sh
  SHOP=blitz KIDSHEET=chubchirp npx tsx scripts/boss-art/shop-view.ts <out.png> <col> <row> 390 844 close
  ```

  - Add a sensible mockup ceiling for `blitz` the way `nursery` and `lodge` were added: drawn by the mockup, not the art.
  - Add the shop's flat-tile name prefixes to the `flat` test if they're new.
- Typecheck: `npx tsc -p scripts/boss-art --noEmit`.
- Keep images lean: look at final stills, about 10 to 15 in all, not every attempt.
