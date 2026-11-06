Title: Smudgy's studio: his Art Gallery's inside, the life class, his challenge intro (the cloth whipped off) and the splatter into the match

**Lane: full e2e** (add the `full-e2e` label): it touches the shared intro (`town/shops/intro.ts`, `challenge.ts`), the room
(`ShopRoom.tsx`, `room.ts`), the match's start (a new transition) and `packages/core/src/crates.ts` (a shared foundation, so CI runs every
spec anyway). Smudgy is live: this goes to everyone.

## What changed
- **Go in on Smudgy's Art Gallery** leads into his paint studio (Eric, Nov 6: "A paint studio, tarps or canvases, a lot of different
  colors … darker teal, blue, darker reds, purples … as opposed to a very bright clownish feel … every wall is just splattered with
  canvas … a lot of layers of paint … kind of abstract"), drawn by hand in code (`shops/smudgy-art.ts`, `shops/paint-kit.ts`): dark plank
  floors with drips, spills and drop cloths; every wall hung with layered abstract canvases (poured skeins, splats and drips in deep teal,
  blue, oxblood and plum, a few warm highlights; no real artist copied or named); a backdrop of paint shelves round a lamp-lit canvas;
  easels, canvas stacks, paint pots and brush jars; the Colosseum's pixel pieces (`colosseum/pieces-gba.ts`'s models) as sculptures on
  plinths. Its ceiling: dark beams over a skylight (`roof: "studio"`). The chat's night tone.
- **Gallery picture lights** (Eric, after a first look: "lighting that comes down on the walls like in an art gallery"): a small brass
  picture light at the top of every wall panel (the back wall's 16, both side walls' 36), its warm cone baked into the panel (the plaster
  and the canvases' paints a shade lighter where it falls, `PICTURE_LIGHT`), and the room's lights at every placement: each bulb's halo
  (`SHOP_SMUDGY_LIGHTS`) and a soft warm glow on the wall over each cone (`SHOP_SMUDGY_POOLS`). No lamps over the floor; the floor, the life
  class and the table are as bright as before.
- **The life class:** the Colosseum's knight turning on a round platform (16 frames, 6 s a turn) in the middle of the back half; eight
  art-student chameleons (Dabble's rig, sitting, in smocks, four colors) on stools in a ring round it, each at an easel facing it with a
  paint table beside it. One 32-frame loop (8 s) per color, shared by all eight: the canvas goes blank, outline, blocked colors,
  finished; five frames painting and a brush dip in the pots each stage. Each painter starts an eighth of the loop after the last (a new
  optional `ShopPlace.t0`, added to the room's clock for that piece).
- **The battle spot:** a big drop cloth on the floor in the front half (`circle-<col>-<row>` tiles), its two marks painted on it (his a
  plum ring with a brush swirl, yours an ochre ring with a pawn), and between them a round table under a white cloth blotched with
  paint, the board's shape showing under it, its wooden stools (the painters') already there.
- **The gallery owner keeps the shop** (`characters/sidekicks/smudgykeeper.ts`, baked): an older chameleon (Dabble's rig, gray-green) in
  an oxblood smock and gold half-moon glasses, behind the counter with its blank plaque; its card "Shopkeeper", no name; not a town bot
  (Dabble stays Smudgy's kid). Dabble's file only exports its rig now; Dabble is unchanged (its sheet's hash is the same).
- **Smudgy's Boss Crate** (a paint-splattered wooden crate, a drip running down it) with the Brush Ride, his ride, first; in `BOSS_CRATES`.
- **Smudgy's own challenge intro** (`CHALLENGE_FEEL.smudgy`, `clothAnims`, `clothCues`; `shops/smudgy-intro-art.ts`): seated (the stools are
  there): you both walk on to the marks; his line (his battle entrance's first); he whips the cloth off (it lifts, sails west over his
  head and drops in a heap by his stool), the game's board on the table from the moment it's off the top; his reveal line. No attack.
- **The splatter into the match** (Eric's idea; `shops/smudgy-splatter.ts`): splats in the room's deep paints land faster and faster until
  the screen is covered (1.2 s), held while the battle loads (at least 0.25 s), then a brush stroke sweeps it away onto the match
  (0.5 s). A 2D canvas, each splat drawn once; every phase by the clock, so it can't get stuck or hold the match back.
- **Sounds:** four new ones synthesized in his pack (`smudgyWhoosh`, `smudgyFlop`, `smudgySplat`, `smudgySwipe`). All pass
  `boss-sounds-finite.test.ts`.
- Every other shop and boss intro is unchanged; the town's frame loop is unchanged. The room and the intro load only when you go in.
- Art copies and preview stills in `scripts/boss-art/out/` (`house-shop-smudgy`, `house-intro-smudgy`, `sidekick-smudgy-keeper`,
  `shop-smudgy-nov6.md`; `scripts/boss-art/smudgy-stills.ts`), also on `claude/boss-art` for the record.
- Decision: `docs/decisions/2026-11-06-smudgy-home.md` (Eric's words, the director's calls, the calls made here, the numbers). Area
  pages: `docs/areas/town-square.md` ("Smudgy's studio", "Smudgy's challenge"), `docs/areas/shop.md`.

## Player-visible changes (everyone)
- Smudgy's Art Gallery's card: its name and **Go in** (as every home you can go into).
- Inside: the header "Smudgy's Art Gallery"; the gallery owner's card **"Shopkeeper"** with **Talk**; the crate's card **"Smudgy's Boss
  Crate"**, its prizes **"Brush Ride"** ("Mythic ride") and the Beta Crate's line, **"3 Smudgy tokens, or 1 Smudgy token + 1 crate key"**,
  **"You have 0 Smudgy tokens and 0 crate keys."**, **"Buy with 3 Smudgy tokens"**, **"Buy with 1 Smudgy token + 1 crate key"**, and once
  bought **"Smudgy's Boss Crate is in your inventory."** The chat's night tone inside.
- Challenging Smudgy from the town now goes in with him (as every boss with a home's inside): the confirm **"Challenge Smudgy?"**,
  **"You'll fight Smudgy in Boss Battle, then come back here."**, Fight / Stay; the town's chat posts "… challenged Smudgy!".
- His line in a bubble: "Smudgy, artist. Don't touch the wet parts." (his battle's entrance line). **New text, his reveal line**, in a
  bubble over him for 2.4 s once the cloth is off: **"Careful, don't get any paint on the pieces!"**
- Into the match: the splatter and the brush stroke instead of the default flash and wipe.

## Changed checks (old → new); none guards a rule in `docs/rules/eric.md`
- `packages/app/test/shop-room.test.ts`, "only … Jefferson's, Ginger's and Folio's homes have an inside" → "… Ginger's, Folio's and
  Smudgy's homes have an inside"; its list gains `smudgy`.
- `packages/app/test/boss-challenge.test.ts`, "every boss whose home has an inside has an intro (… Ginger, Dash and Folio their own …)"
  → "(… Ginger, Dash, Folio and Smudgy their own …)"; `withIntro` gains `smudgy`; added: `introOf("smudgy")` `toMatchObject({ custom: true,
  name: "Smudgy", line: "Smudgy, artist. Don't touch the wet parts.", layout: "across", seated: true, chant: [the reveal line] })`.
- `packages/app/test/boss-challenge.test.ts`, "the layout: across for all eleven today" → "all twelve"; its list gains `smudgy`.
- `packages/app/test/town-bots.test.ts`, the baked sheets: `files` 21 → 22; `artId` gains `smudgykeeper: "sidekick-smudgy-keeper"`.
- `packages/app/test/shop-folio.test.ts`, Folio's crate: `expect(BOSS_CRATES.at(-1)).toBe(crate)` → `expect(BOSS_CRATES).toContain(crate)`
  (Smudgy's crate is the last now; every other check kept).
- `packages/app/test/smudgy-wired.test.ts`, his sound pack's names: `["dab", "drip", "giggle", "oof", "splash", "swish", "thump"]` (7) →
  `["dab", "drip", "flop", "giggle", "oof", "splash", "splat", "swipe", "swish", "thump", "whoosh"]` (11: the four new ones); its
  loudness checks, run on every sound of the pack, kept and passing for the new four.
- `packages/server/test/boss-tokens.test.ts`, the crates and their rides: gains `["smudgy", "smudgy-brush"]`.
- (`packages/core/test/crates.test.ts`'s `NO_CRATE_YET` keeps `smudgy-brush`: "in no regular crate", as the others' rides.)
- New, nothing removed: `packages/app/test/shop-smudgy.test.ts` (17: the room's walkable squares, the picture lights at every placement, the drop cloth and the table, the marks,
  the counter and keeper, the keeper's sheet and that it isn't a town bot, the knight and the ring, the painters' loops offset, the
  canvas's stages and the dips, the crate, the intro's beats in order, the cloth before the board before the reveal line, every cue a
  sound, the props drawn, the splatter's clock, and that it always ends in the match with no canvas to draw on); `e2e/shop.spec.ts`
  "Smudgy's Art Gallery …" (the room, the keeper's card, the crate, the sculptures); `e2e/boss-challenge.spec.ts` "challenging Smudgy in
  the town …" (the 2D town and the WebGL town).

## Tests run
- Unit: shop-smudgy (17), smudgy-wired, shop-folio, boss-challenge, shop-room, town-bots, boss-sounds-finite, boss-tokens, crates: pass. `npm run typecheck`
  (the app): pass.
- e2e, locally (phone and desktop): Smudgy's shop test; his challenge on the 2D town and the WebGL town (`?gl=1`): 6 passed.
  Specs CI should run: all (full lane).
- **Frame rate** (headless Chromium, a phone, the room standing 5 s just inside the door; a shared machine): with the picture lights,
  Smudgy's 58.6 fps against Folio's 59.8 (4x CPU: 12.5 against 13.2); before them, 58.9 against 59.2 (12.7 against 12.1). The eight
  painters draw from four shared 32-frame loops; the lights' washes are baked into the walls, each placement adding one halo and one glow.
- The whole app unit suite: 2,024 of 2,025 passed; `duel.test.ts`'s result-card test timed out once at its 5 s limit on the loaded shared
  machine and passed on its own (4.97 s): it imports nothing this PR changes.

## Stills and GIFs (`docs/smudgy-home/`)
- `door-*.png`, `table-*.png` (the cloth-covered table), `life-class-*.png`, `counter-*.png`, `sculptures-*.png`: phone and computer.
- `intro-phone.gif`: the whole intro from the game on a phone (390 × 844), from the Fight tap to the match, the splatter included
  (Chrome's own frames at their real times, 12 fps).
- `painters.gif`: the life class at work, one painters' loop (8 s), each painter at its own time.
- `whip-phone.png` (the cloth over him, the board on the table), `splatter-phone.png` (covered), `intro-reveal-desktop.png` (his reveal
  line on a computer).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
