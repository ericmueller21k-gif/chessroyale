# History: The shop, crates and the icon builder

The decisions behind this area, moved here word for word from `DECISIONS.md` on Oct 10, 2026 (the housekeeping pass),
in the order they were made. This is the record of why. For how it works today, read [the area page](../areas/shop.md).

## The shop (Oct 5, 2026)

Eric wants a shop to test with (designs and prices to come). Everything is free while `SHOP_FREE` is on.

- **Catalog** (`core/shop.ts`, shared by app and server). Each category fills one slot. You own any number of its items and equip one, and every slot has a free starter.
  - God King effects: Holy Light (starter), Stormcaller, Hellfire, Voidborn, Emerald Oath. They recolor his lightning, beam and glow through CSS variables.
  - Pawn hats: none (starter), Party Hat, Little Crown, Wizard Hat, Top Hat, Viking Helm. They're SVG hats on your pawn in the pre-game votes.
  - Kill moves and other animations are listed as coming later.
- **Server.** Three D1 tables: `inventory`, `equipped`, and `wallets` (coins, for later).
  - `GET /api/shop`, `POST /api/shop/buy {item}`, `POST /api/shop/equip {item}`. Buying checks coins unless `SHOP_FREE`; equipping requires owning the item.
  - The profile carries the shop state, so the app knows your look in a match.
  - A guest's items, choices and coins join the account they sign in to; the account's own choices win.
- **App.** A Shop button beside the logo on the home screen opens the shop (also at `/shop`): category tabs and item cards with previews, Get · Free / Equip / Equipped.
- Cosmetics are what *you* see. In a crowd game, each player sees their own King effect for now; showing the caller's (or the winner's) look to everyone is for later.

## The pixel icon builder (Oct 5, 2026)

Eric asked for something like the old Call of Duty emblem editor.

- Player icons are now 48 × 48 pixel drawings (close to the suggested 50 × 50, and a cleaner size for scaling). The emoji picker is gone.
- Tap your icon on your profile ("Edit") to open the builder. The tools are deliberately few: pencil, eraser, fill bucket, color picker, 1/2/3 px brushes, undo, clear, a 24-color palette and a custom color.
- It saves a PNG data URL (well under 1 KB for most drawings) in the existing `users.icon` column. The server only accepts a real 48 × 48 PNG (signature, IHDR size, base64 only, at most 16 KB). The old emoji stay valid for older accounts.
- No moderation yet (Eric: worry about that later).
- **Fill froze the page (Eric, Oct 10, 2026).** Cause: the bucket's color was a signed number and the pixels unsigned, so "already that color" never matched; filling an area with its own color (the second click) re-queued every pixel forever until Chrome ran out of memory.
- Fix (`src/icon-pixels.ts`): colors are unsigned; the fill is iterative with a visited set, bounded to 48 × 48, and a fill or clear that changes nothing does nothing (no undo step); undo keeps the last 40 steps.

## Crates: Winter Crate · Series 1 (Oct 5, 2026)

Eric's design, a fun bonus for now: free and unlimited while testing, and fully compliant (odds shown, regional rules) if it ever involves money.

- **Three independent layers of rarity** (`core/crates.ts`):
  - **Tier, which decides the item.** The strip lands on a tier's present (color-coded), which opens to one of that tier's items, each as likely as the others; or on Fischer Random (Eric, Oct 6). The tiers run Common to Mythic (renamed Oct 6 from the Puzzle Pirates names, which went to player ranks; entries below written before then use the old names):

    | Present | Chance | Items inside (slot) | Each |
    | --- | --- | --- | --- |
    | Common (gray) | 40% | Santa Beard (face), Beanie (head), Christmas Tree Tee (skin) | 13.3% |
    | Uncommon (green) | 26% | Antlers (head) | 26% |
    | Rare (blue) | 18% | Santa Hat (head), Ski Goggles (face) | 9% |
    | Epic (purple) | 14% | Snowman (skin), Present (head), Gingerbread Man (skin), Chimney (skin) | 3.5% |
    | Fischer Random (a gold crown, not a present; a second spin) | 2% | Legendary Gift-Wrap Tube (weapon, 40%) or Candy Cane (weapon, 40%), Mythic Fire & Ice Crown (head, 20%) | 0.8%, 0.8%, 0.4% |

    So the crown is 0.4%. (Before the presents, odds were per item: 16% each for the commons, 12% antlers, 8% hat.)
  - **Color:** Red 30%, Yellow 30%, Sage 14%, Opal 9%, Cobalt 7%, Midnight 4.5%, Emerald 3%, Oceanic 2%, Pearl 0.5%. Opal, Oceanic and Pearl have a two-tone sheen.
  - **Purity:** 100% minus a blemish of 0–100%, rolled by bands (retuned Oct 5, below). Shiny (90%+) is 1 in 250; under 5% is 1 in 100; 80% of items land between 30% and 70%.
  - **Stacked:** a shiny Pearl crown is about 1 in 12.5 million; a Pearl crown at 99%+ about 1 in 1.25 billion. A test of 100,000 rolls checks the proportions.
- **Slots:** head, face, skin and weapon (new: held at the pawn's side). Skins replace the pawn and combine with the rest (a Snowman in a Santa Hat). They show in the votes and on the cut screen, not on the game board. Other online players see your look (sent on joining, cleaned by the server). The old shop hats still show when no crate item is on the head.
- **Paint system** (`components/Items.tsx`), Eric's suggestion:
  - Each item is drawn once on the pawn's square with marked paint regions. Those get the color automatically, then the blemish, then the shine; outlines and fixed parts (white fur, coal, ice) stay as drawn.
  - **Blemish:** a seeded noise field, cut so exactly that share of the item itself is blotched (measured on its painted parts; see the fix below); overlapping dark round blotches in one path, so even 100 pawns are cheap.
  - **Shine:** a sweeping highlight plus a sparkle.
  - The Fire & Ice Crown's flames burn in its rolled color. The tube has tri-blend stripes (its color, a light tint and white).
- **Server-side rolls.** Crates open on the server (`POST /api/locker/open`), and each item is stored with its color, blemish and seed (D1 tables `items`, `equipped_items`), so nobody can make themselves a Pearl crown. A guest's items follow them when they sign in.
- **Opening:**
  - A CS:GO-style strip: decoy tiles by the odds, with Fischer Random shown three times as often as it lands to tease.
  - It eases out over 6.2 s with a click per passing tile, so the clicks slow as it lands.
  - Landing on Fischer Random shows a gold crown with "?", the "FISCHER RANDOM!" banner, and a second spin among Legendary and Mythic items.
  - The reveal is an FF-style window (the God King's menu style) with the tier, name, color, purity and "Shiny!".
- **Where:** Shop → Crates (with each crate's page of odds) and Shop → Locker (avatar preview, items rarest first, tap to wear or take off).
- **Shine, after Eric's first look:** the sparkle sat off to the side. Now a broad soft band of light rolls slowly across each painted region of a shiny item (CSS-animated, 4.2 s, then a pause), sized to the item itself so thin items like the tube get it too.
- **Sound, after Eric's first look:** the strip's clicks were silent on his iPhone. The app turned sound on only on the very first touch (a `pointerdown`), which iPhones don't count as a tap. Every tap now tries until sound is on, and the Open button turns it on directly.
- **Layers (Eric):** worn items are drawn in front of the piece (a hat's brim over the pawn's head, a weapon in front). Chessground gives every piece z-index 2, which had put the pawn over its items; the avatar now has explicit layers: items flagged `layer: "back"` (a cape, wings), then the piece or skin, then the rest. Items may rise at most about a tenth of a square above their square (a clip caps them).
- **Fitting items to the piece (Eric: the beard sat high, the party hat swallowed the head):**
  - Every piece has anchor points: where a hat's brim sits (a few points below the top of the head, like a real hat) and where a beard starts (the middle of the head). The pawn's are 25 and 40; the snowman's are 14 and 22.
  - Each head or face item names the line in its own drawing that meets its anchor (`ATTACH` in Items.tsx: the hat's brim, the beard's top edge), and the avatar shifts it there, on a pawn or a skin.
  - A new item needs only that number; a new skin, its anchors.
  - The old shop hats moved up 9 points to sit snug on the head too.
- **Four more items (Eric, Oct 5):** Present, Candy Cane, Gingerbread Man and Chimney.
  - **Odds.** Eric asked for the tier below Exalted to be "close to like 12–15% odds". I read that as the Sublime tier, now four items, at 14% in all (3.5% each). Reading it as each item at 12–15% would make Sublime about half of all drops, commoner than the Novice beard, which breaks the "each tier rarer" ladder. To make room, the beard, antlers and hat went from 55/25/12 to 42/26/16. The candy cane splits the Exalted share of Fischer Random with the tube (40/40), and the crown stays at 20% (0.4% overall). Each tier is still rarer than the one before.
  - **Present: two colors.** It's a helmet: the box covers the head down to the neck, with a bow on top. The box and the ribbon (and bow) each roll a color with the usual odds, independently, so a matching pair is possible (red & red, about 9%). Items flagged `colors: 2` roll the second color, stored as `color2`. D1 gets a new column, added once by `ALTER TABLE` on start-up. Both colors share one blemish, with separate blotches. Shown as "Red & Emerald".
  - **Candy Cane:** always white, striped in its rolled color; held at the side like the tube.
  - **Gingerbread Man (skin):** the whole cookie takes the color, as Eric suggested. White icing and a smile (chocolate icing on the black side), with red and green gumdrop buttons. Anchors: hat 15, beard 26.
  - **Chimney (skin):** the pawn itself, sitting in a chimney up to its chest. The bricks are always red with white mortar; the rolled color paints the chimney's cap. The pawn is drawn in the skin, so the anchors are the pawn's.
  - All four were checked on white and black pawns, on the other skins, and with the other items worn.
- **Testing switches** (while `CRATES_FREE`): checkboxes on the crate page, or `?fischer=1` / `?shiny=1`, force Fischer Random and a shiny. The server ignores them once crates aren't free.
- **Purity, retuned (Eric, Oct 5):** shiny showed up too often, and purity now goes all the way to 0%.
  - **The odds** (`PURITY_BANDS` in `core/crates.ts`), even within each band, purity to one decimal:

    | Purity | Chance |
    | --- | --- |
    | 99–100% ✨ | 0.004% (1 in 25,000) |
    | 90–98.9% ✨ | 0.396% |
    | 70–89.9% | 9.6% |
    | 30–69.9% | 80% |
    | 5–29.9% | 9% |
    | 0–4.9% | 1% |

    So shiny is exactly 1 in 250 (was about 1 in 40), under 5% exactly 1 in 100, and an average item is about 50% pure (was about 66%). I picked 80% for "most between 30% and 70%", split the rest evenly above and below, and kept 99%+ as a 1-in-25,000 brag inside the shiny band. A band table, not a curve, so each number Eric names is one line to change; the crate page lists the same table.
  - **Shiny is 90.0% and up, as shown.** It was "blemish under 10", which made a 90.0% item not shiny, against Eric's "90%+". Only an item at exactly 90.0% changes.
  - **0% looks** blotched all over: the blotch color over the whole painted part, a darker shade of its color (red goes dark red, yellow mustard, Pearl a gray lavender). Blotches now also run past the square's edge (antler tips, the crown's flames), copying the nearest blotch inside, so those are covered too. The Present's bow knot became a painted part, so it darkens with the rest. Fixed parts (the candy cane's white, fur, ice) stay as drawn.
  - **Items people own keep their purity:** the stored blemish isn't touched (old rolls are all 51–100%), and their blotches keep their shape; only the parts past the square's edge and the Present's knot now pick up blotches too. Only the odds for new rolls changed.
  - **The strip's decoy tiles** already rolled their purity with the real roll, so they follow the new odds: about one shiny decoy every six opens, instead of about one per open (some 42 decoy items pass by in each open).
  - The fitting sheet (`npm run preview:items`) now shows cards at 95, 70, 50, 30, 5 and 0% purity (`purities=` to choose).
- **Blotches match the purity on the item (Eric, Oct 6: a 41.4% Exalted tube was almost fully covered):**
  - The blotch pattern was cut so that share of the *whole square* was blotched, so an item got whatever share of the pattern it happened to sit on. Measured over 120 patterns at 58.6% blemish: the tube was blotched anywhere from 11% to 100%, the beard, hat and scarf from 0% to 100%. Wide items averaged out; thin and small ones swung wildly. The old 51–100% range hid it.
  - Now the cut is measured on each painted part itself: the app samples the part's area (one point per square unit, once per item drawing) and cuts the same pattern where it covers exactly that share. The last blotch is drawn partway (a spot growing from its center or, in a clean spot already ringed by blotches, closing in from the edge), so the share is exact rather than a whole blotch at a time. Now every item lands within about 3 points of its purity, usually within 1.
  - Same patterns, so owned items keep their look in shape; only how much of them is blotched now matches the purity shown. About 1 ms a pawn, as before.
  - A test checks the coverage on a thin tube over many patterns.
- **Three commons and two redesigns (Eric, Oct 6):**
  - **Odds.** Eric: make the three new items commons, "there should be more commons", and keep the odds worked out. Novice now has four items at 16% each (64%). Each tier must stay rarer per item than the one below, so the antlers went from 26% to 12% and the Santa hat from 16% to 8%. Sublime stays at 14% (3.5% each) and Fischer Random at 2%. Per item: 16, 12, 8, 3.5, 0.8 (Exalted) and 0.4% (Transcendent). A test checks that ladder.
  - **Beanie** (head): a plain knit beanie, crown and ribbed cuff, in its color. No bobble, so it doesn't compete with the Santa hat.
  - **Ski Goggles** (face, two colors like the present): the frame and strap in the color, the lens in a second color at 60% opacity, so the face shows through, with a glint. Outlines are thinner than usual (1.6, not 3): at the usual width they swallowed the frame on a pawn-sized avatar.
    - Goggles go at the eyes, which no anchor marked (the face anchor is where a beard starts, well below the eyes on the pawn). Pieces now have an `eyes` anchor too (pawn 29, snowman 18, gingerbread 21), and an item can name the anchor it meets (`ATTACH_TO`).
    - They're a face item so they can be worn with a beanie, and they're drawn over a hat (`OVER_HAT`). Other face items still go under it: the present's box covers the top of a beard.
  - **Christmas Tree Tee** (a skin): the pawn in a T-shirt with a printed tree. Only the bulbs take the color. The shirt is white on the white side and charcoal on the black side (pure black disappeared on the black pawn). A skin, like the chimney, because a shirt fitted to the pawn wouldn't fit the snowman or the gingerbread man. So it doesn't combine with them; a separate "body" slot could do that later.
  - **Present: a visor.** An oval cut out of the box's front at face height, with a hint of glass and a glint. The ribbon stops above and below it. You see the face through it: the pawn's head, the snowman's eyes and nose, the gingerbread face.
  - **Chimney: bricks in the color.** The bricks and the cap take the color. The mortar is a shade of it (lighter on dark colors, darker on light ones such as yellow and Pearl), so the bricks still read. The whole chimney now blotches. Owned chimneys change with it.
  - The fitting sheet takes `with=` to wear other items too (goggles over a beanie).
- **Presents by tier (Eric, Oct 6):** "the crate opens thematic": the strip holds color-coded presents, one per tier, and Fischer Random (2%, the only tile that isn't a present). A present opens to one of its tier's items, split evenly.
  - **The present odds** (40/26/18/14/2): Eric said the rest of the 98% is "split between the other rarities". I read that as a ladder, each color rarer than the one below (an even split would make a purple present as common as a gray one). Sublime stays at Eric's earlier "12–15%" (14%, so its four items keep 3.5% each), and Novice, Broad and Paragon step down from there.
  - **A side effect to know:** Broad holds one item, so the antlers (26%) are likelier than any single Novice item (13.3%). Adding Broad items spreads that out.
  - **Ski Goggles moved to Paragon (Eric, Oct 6),** next to the Santa hat: 9% each. The Novice present now holds three items, 13.3% each.
  - **Opening:** the strip spins to a present; the present shakes and bursts ("Common present", in its color, 1.1 s); then the reveal. Fischer Random is unchanged (banner, a 4.8 s second spin among its items). The strip still shows Fischer Random three times as often as it lands, to tease.
  - **No second spin for presents (Eric, Oct 7):** at first a present holding several items had a second, shorter spin among them, and a one-item present (the Uncommon antlers) went straight to the reveal. Eric liked the straight-to-reveal one ("quicker, and it looks nicer"), so every present does that now; only Fischer Random spins again.
  - **Leaving during the spin (Eric, Oct 8):** the item is yours as soon as the server rolls it, but leaving the crate screen mid-spin used to lose the show, and coming back started over. Now the result is kept as "not seen yet" (on the device, and in memory if storage is off) the moment the server answers, and coming back to Crates opens straight to its reveal card, once; the reveal clears it. It's dropped if that item's gone from your locker (deleted).
- **The locker: stacks, hold to delete, and the free items (Eric, Oct 8):**
  - **Stacks.** Copies of the same item in the same color (both colors, for the present and the goggles) show as one tile with "×3" in the top right. The purest copy is the one shown, and the one you wear when you tap the stack. Stacks sort like single items did (rarest, rarest color, purest).
  - **Hold to delete** (about half a second; right-click on a computer), then a confirmation: "It's gone for good." A single item: Delete or Cancel. A stack: delete the extras and keep the best, delete all, or Cancel. If the copy you wore goes, the one you keep goes on. Moving your finger (a scroll) cancels the hold, and the phone's own long-press menu is off on items. The server deletes only your own items (`POST /api/locker/delete`) and takes them off first.
  - **One place to wear things (Eric).** Pawn hats and God King effects were bought *and* equipped in the Shop tab, so a hat you owned wasn't in your locker and stayed on when you took a crate hat off. Now the shop sells them (as before; free while testing) and says "In your Locker ›" once you have one; the locker lists what you got under "From the shop" (with a God King filter), next to the crate items, and that's where you wear or take off everything. The Shop tab keeps all three categories (God King effects, pawn hats, chat packs); "No hat" isn't for sale (you take a hat off in the locker). Shop items can't be deleted for now (no refunds yet).
  - **One head.** A pawn hat and a crate head item used to be worn at once, the shop hat showing whenever the crate one came off. Now wearing either takes off the other (on the server, both ways), and taking one off leaves the head bare. A God King effect is always on (tapping another switches it). Someone already wearing both from before sees the pawn hat as "Worn" in the locker once the crate hat comes off, and can take it off there.
  - **The crate page** lists the presents with their odds (and how many items each holds), then every item with its own chance.
  - Server rolls: the tier, then an item evenly from that tier's present (`presentItems`). Nothing stored changes.
- **Tier names: Common to Mythic (Eric, Oct 6):** "I kind of just want to revert to a common, uncommon, rare, etc.
  style." The Puzzle Pirates names move to the player rank ladder (the hub's work), so the items no longer use them.

  | Was | Now | Color (unchanged) |
  | --- | --- | --- |
  | Novice | Common | gray |
  | Broad | Uncommon | green |
  | Paragon | Rare | blue |
  | Sublime | Epic | purple |
  | Exalted (Fischer Random) | Legendary | gold |
  | Transcendent (Fischer Random) | Mythic | red |

  - **Legendary and Mythic for the two Fischer Random tiers,** not Eric's "mythic and unknown": "Unknown" on a tier pill
    ("Head · Red · 80% pure · Unknown") reads like missing data. Legendary then Mythic is the ladder players already
    know, and keeps his "Mythic" at the very top. Swapping in "Unknown" is a one-line change in `TIERS` if he prefers it.
  - **The ids changed too** (`common` … `mythic`), so the code doesn't keep names that are now player ranks. Nothing
    stores a tier: the locker stores the item (`def`) and the tier comes from `ITEM_DEFS`, as do looks sent to others
    online. No migration; owned items show the new names at once.
  - Odds, items and art are unchanged. A test pins the six names, their order (the locker sorts by it) and colors.

## Crates: Beta Crate · Series 001 (Oct 11, 2026)

Eric (Oct 11): "Let's queue up another crate series called Beta Crate Series 001. Migrate all the free items out and
into this crate, since players will have free keys anyway to use on these … The idea is themes: secret agent is a
theme but split into parts of different rarity, same for pirate; smiley face is unique though." Plus: Fischer Random
"ultra rare" Tommy Gun and Parrot (multi-colored, both weapons); "most rare" Pirate Hat and Smiley Face; "mythic"
Suit and Tie; "very rare" Dark Shades and Wire Earpiece; one more full theme and the missing parts, at the usual odds;
"all we need to build is a new crate instead of a present for that crate; everything else should be reusable." And:
"Add scarf to winter as uncommon." It ships in batches, so Eric can check the look after each.

- **Tiers (the director's mapping, Eric asked to confirm):** Eric's four groups onto our top four tiers in his order:
  Tommy Gun + Parrot Mythic, Pirate Hat + Smiley Face Legendary (all four through Fischer Random), Suit and Tie Epic,
  Dark Shades + Wire Earpiece Rare. His labels don't match our names; his order does.
- **A tier is one field.** A crate now lists all its items once (`items`), and each item's tier says where it is: in
  that tier's box, or behind Fischer Random. Fischer Random's odds are per tier (`fischer: [{ tier, weight }]`,
  Legendary 80, Mythic 20), shared evenly, which is exactly Winter's old 40/40/20, so Winter's rolls are unchanged.
  Moving an item between Epic and Legendary is one field in `ITEM_DEFS`, nothing else.
- **"Free items" = the shop's pawn hats (Eric confirmed).** They leave the shop and become Beta crate head items,
  redrawn as painted regions (color, blemish, shine), smaller so they fit every skin under the height cap. The shop's
  hat slot is retired: no "No hat" starter, no `hat` on profiles, avatars or bots. Hats owned or worn from testing are
  ignored (the shop reads only ids it knows), never a crash. God King looks stay in the shop, because the shop will
  later sell other things, such as new boss animations and new attack animations (way down the road), so God King
  packs belong there, separate from crates. Bots that wore a shop hat wear the same hat as a crate item now (their
  "shop hat" share joined the head share in `BOT_LOOKS`).
- **Same odds as Winter:** boxes Common 40, Uncommon 26, Rare 18, Epic 14, Fischer Random 2; a box opens to one of
  its tier's items evenly. Every tier holds something from batch 1, so the strip is whole at the same odds throughout.
  If a tier were ever empty, the strip leaves it out (`liveStrip`) instead of crashing an open, and a test fails on
  any live crate with an empty tier.
- **The container: a supply box.** A wooden crate with steel corners, a band in the tier's color and a stenciled
  star, drawn the size and place of a present, so the strip, the odds rows and the unwrap use either (a crate's
  `look` picks its box and its own crate art). "Supply box", not "crate", since it comes out of a crate. The Beta
  Crate itself is olive drab, stenciled BETA 001, with rope handles. Beta is listed first (it's new, and it's where
  the free keys' hats live); each crate shows a one-line blurb and its item count.
- **The third theme: Ninja.** It reads at pawn size (a colored band across the face, a hood with an eye slit),
  splits into seven parts across the tiers, and makes the playground trio with pirates and agents.
- **Suit and Tie rolls two colors** (the suit, the tie): the name has two parts, and Midnight & Midnight is the
  classic to chase. **The Wire Earpiece is a head item,** not face, so an agent can wear Dark Shades with it (earpiece,
  shades, suit and briefcase: one per slot). **The Smiley Face** is a flat dot smiley over the whole head, in its
  color; its features are dark, white on Midnight (dark ones vanish there). It's worn under a hat.
- **The Winter Scarf:** Uncommon, face, at the neck. Pieces gain a fourth anchor, `neck` (pawn 34, where its head
  meets its collar; snowman 30; gingerbread 34). A face item, so it goes with a beanie or a Santa hat, not a beard.
  The Uncommon present now holds the Antlers and the Scarf, 13% each (Antlers were 26%).
- **Checked** on white and black pawns, every skin, in Red, Pearl and Midnight, at 95, 50 and 0% purity. Fixes from
  the look: the party hat's stripes are a tint of its color (white ones made a red one a Santa hat), the eyepatch
  grew (it was a dot on a pawn) and got a light stitched edge (a Midnight patch vanished on a black pawn).
- **The fitting sheet** has a short mode for showing a batch: `npm run preview:items -- out.png sheet=1 items=…
  colors=… outfits=a+b;c` (each item as a card and on both pawns, colors in turn, and whole outfits).

### The full list

Color column: which part takes the rolled color (everything else is fixed, with outlines).

#### The Classics (from the old shop) · 5

| Item | Tier | Slot | Color | Description |
| --- | --- | --- | --- | --- |
| Party Hat | Common | head | the cone (white stripes, pom-pom) | Every move is a celebration. Even the blunders. |
| Wizard Hat | Common | head | hat and brim (gold star) | Knows things. Mostly opening theory. |
| Top Hat | Common | head | the hat (band a shade of it) | A pawn of means. Monocle sold separately. |
| Viking Helm | Uncommon | head | the helmet (cream horns, brass rim) | Pushes into any zone. The horns are for show; so is the plan. |
| Little Crown | Uncommon | head | the crown (blue jewel) | Dreaming of promotion. |

#### Secret Agent · 7

| Item | Tier | Slot | Color | Description |
| --- | --- | --- | --- | --- |
| Fake Moustache | Common | face | the moustache | A flawless disguise. Nobody will ever know it's you. |
| Fedora | Common | head | the hat (dark band) | For trench-coat weather and shadowy endgames. |
| Briefcase | Uncommon | weapon | the case (gold clasps) | Contents classified. Mostly sandwiches. |
| Dark Shades | Rare | face | the frames (dark lenses) | Can't see the board. Looks great, though. |
| Wire Earpiece | Rare | head | earpiece and coiled wire | "The pawn is moving. Repeat: the pawn is moving." |
| Suit and Tie | Epic | skin | the suit; the tie (2nd color) | A sharp suit in one color, the tie in another. License to promote. |
| Tommy Gun | Mythic (Fischer Random) | weapon | the metal; the wood (2nd color) | A classic drum-fed Tommy gun, metal in one color, wood in another. For settling the endgame. |

#### Pirate · 8

| Item | Tier | Slot | Color | Description |
| --- | --- | --- | --- | --- |
| Bandana | Common | head | the bandana (white dots) | Tied tight for high seas and long games. |
| Eyepatch | Uncommon | face | the patch (dark strap) | Half the vision, twice the swagger. |
| Hook | Uncommon | weapon | the cuff (steel hook) | Terrible for moving pieces. Great for drama. |
| Cutlass | Rare | weapon | guard and grip (steel blade) | Curved, polished, and strictly for show. |
| Spyglass | Rare | weapon | the barrel (brass rings) | Spots a fork from three boards away. |
| Captain's Coat | Epic | skin | the coat (gold buttons, white cravat) | Long, gold-buttoned and made for shouting orders. |
| Pirate Hat | Legendary (Fischer Random) | head | the tricorn (skull, gold trim) | A captain's tricorn, skull and all. Arr. |
| Parrot | Mythic (Fischer Random) | weapon | the body; wings and tail (2nd color) | Perches on your shoulder and repeats your moves back to you. |

#### Ninja · 7

| Item | Tier | Slot | Color | Description |
| --- | --- | --- | --- | --- |
| Ninja Headband | Common | head | band and tails | Long tails, for dramatic wind. |
| Shuriken | Common | weapon | the star | A throwing star. Not for throwing at the board. |
| Ninja Mask | Uncommon | face | the mask | Covers everything below the eyes, including your thinking face. |
| Nunchucks | Uncommon | weapon | the sticks (steel chain) | Two sticks, one chain, zero hand-eye coordination. |
| Katana | Rare | weapon | hilt wrap and scabbard (steel blade) | Folded a thousand times. Still can't cut through a fortress. |
| Ninja Hood | Epic | head | the hood | Only the eyes show, and they're calculating. |
| Ninja Gi | Epic | skin | the gi (black belt) | A wrap-front gi. The belt is black; you've earned it. |

#### One-off · 1

| Item | Tier | Slot | Color | Description |
| --- | --- | --- | --- | --- |
| Smiley Face | Legendary (Fischer Random) | face | the face (dot eyes and smile) | Have a nice game. |

#### Winter Crate · Series 1 · 1 new

| Item | Tier | Slot | Color | Description |
| --- | --- | --- | --- | --- |
| Scarf | Uncommon | face | the scarf (light stripes) | A long knit scarf. Your pawn's mom insisted. |

### Odds, when complete (28 items)

| Box | Chance | Items | Each |
| --- | --- | --- | --- |
| Common (gray) | 40% | Party Hat, Wizard Hat, Top Hat, Fake Moustache, Fedora, Bandana, Ninja Headband, Shuriken | 5.0% |
| Uncommon (green) | 26% | Viking Helm, Little Crown, Briefcase, Eyepatch, Hook, Ninja Mask, Nunchucks | 3.71% |
| Rare (blue) | 18% | Dark Shades, Wire Earpiece, Cutlass, Spyglass, Katana | 3.6% |
| Epic (purple) | 14% | Suit and Tie, Captain's Coat, Ninja Hood, Ninja Gi | 3.5% |
| Fischer Random | 2% | Legendary 80%: Pirate Hat, Smiley Face | 0.8% each |
| | | Mythic 20%: Tommy Gun, Parrot | 0.2% each |

### Odds after batch 1

| Box | Chance | Items | Each |
| --- | --- | --- | --- |
| Common | 40% | Party Hat, Wizard Hat, Top Hat | 13.33% |
| Uncommon | 26% | Viking Helm, Little Crown, Eyepatch | 8.67% |
| Rare | 18% | Dark Shades | 18% |
| Epic | 14% | Suit and Tie | 14% |
| Fischer Random | 2% | Smiley Face (Legendary) | 1.6% |
| | | Tommy Gun (Mythic) | 0.4% |

(Until the Rare and Epic boxes fill, a single Rare or Epic item is likelier than a single Common one, as Winter's
lone Antlers were. It evens out by batch 3.)

Winter, with the Scarf: the Uncommon present holds Antlers and Scarf, 13% each (Antlers was 26%).

### Batches

| Batch | Items | Running total |
| --- | --- | --- |
| 1 | Crate, supply box, two-crate page; Winter Scarf; the 5 Classics; Smiley Face, Tommy Gun, Dark Shades, Suit and Tie, Eyepatch | 10 of 28 |
| 2 | Agent: Fake Moustache, Fedora, Briefcase, Wire Earpiece; Pirate: Bandana, Hook | 16 (agent complete) |
| 3 | Pirate: Cutlass, Spyglass, Captain's Coat, Pirate Hat, Parrot | 21 (pirate complete) |
| 4 | Ninja: Headband, Shuriken, Ninja Mask, Nunchucks, Katana, Ninja Hood, Ninja Gi | 28 (complete) |
