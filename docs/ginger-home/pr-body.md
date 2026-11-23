Title: Ginger's igloo candy shop and his challenge intro (the catwalk and its two staircases, the elves at work, the Candy Cane Sled's crate, the icicle table)

# Ginger's igloo candy shop and his challenge intro (Nov 5)

Ginger Igloo gets an inside: a candy shop in his igloo run by little gnome-ish elves. The shopkeeper elf keeps the shop behind his
half-round stand, Ginger's Boss Crate sells the Candy Cane Sled, and the room has a second walking level: a catwalk along the candy wall
with a staircase at each end that you can run up, along and down. Challenging him now plays his own intro: he blasts the air, an icicle
falls and stabs the floor as the table, two elves toss the board onto it, he casts the pieces in, and his blizzard takes you to the
battle. The art is from `claude/boss-art` at 6ef02ce9. Ginger is live, so this goes to everyone. Decision note:
`docs/decisions/2026-11-05-ginger-home.md`. Area pages: `docs/areas/town-square.md` and `docs/areas/shop.md`.

## What changed
- **The igloo** (`town/shops/ginger-art.ts`, with its `candy-kit.ts`): a round floor 10 squares across (`SHOP_GINGER_FLOOR`, a floor's
  shape as Hollow's cave, not a cave), the walls one curve of overlapping 45 px cards (no gaps), the candy wall round the back and both
  sides, ice lanterns, barrels, the battle spot's glossy ice with his peppermint and your snowflake as its marks, lights at every placement.
  Its roof is the dome's ice blocks (new `roof: "igloo"`), outside the doorway the snowy night, the chat's day tone. Its pools of light
  and the battle spot's shine are baked into the floor's picture once.
- **The shopkeeper elf** (`characters/sidekicks/elf.ts`, baked by `scripts/bake-sidekicks.ts` into `town/sidekicks/elf.png`) behind his
  stand on (9, 5) and (10, 5), drawn at his art's size (25 px). He isn't a town bot: Crumb stays Ginger's kid in the town.
- **Ginger's Boss Crate** (`BOSS_CRATES`, `boss-gingerbread`) holds the **Candy Cane Sled** (`ginger-sled`, already a ride). It shows in
  the Crates tab and the FAQ for everyone. Its id is from his boss id, which is also the Gingerbread Man skin's item id; tokens are kept
  by boss and crates by crate id, so nothing collides.
- **The second level** (`town/shops/levels.ts`, new): the catwalk (40 px up) and the two straight flights at its ends are walkable only
  along their chain (`Room.levels`, `around` in `room.ts`). You get on and off only by the stairs, never off the deck's front edge. One
  height curve (`liftAt`) lifts you and every elf: the art's 5 px steps, joined in straight lines between their middles, easing up off
  the floor at the foot. Up there you're drawn half a square nearer (`levelZ`). A tap on the deck as drawn walks you up the nearer free
  staircase. The arrow keys follow the chain: left and right along the flight and round the curve, up from a foot climbs on, and up or
  down on the deck do nothing.
- **The arrow keys inside every shop:** up now walks you up the screen. It walked you down: a room's rows run toward its camera.
- **The elves** (`town/shops/ginger-elves.ts`, drawn from `ginger-elves-art.ts` as the room loads): three walkers with candy canes on
  their loops round the battle spot, and the dispensing pair (box and notepad) on their 47.5 s loop. The pair work five bins below, go up
  the east stairs, work five tubes along the catwalk and come down the west stairs, on the same height curve as you. Each one waits while
  you (or the boss walking in) stand on or just ahead of its way, and goes on once you step aside. They block walking where they are: a
  tap walks you round them (up the other staircase if one is on the nearer). If one steps into your way, you wait, then go on. If it's
  waiting for you too, you stop. No server state.
- **His intro** (`challenge.ts` `iceAnims`, `iceTimes`, `iceAt`, `iceCues`, `CHALLENGE_FEEL.ice`; `intro.ts` loads `ginger-intro-art.ts`
  and `characters/ginger-intro.ts`; ShopRoom draws it). It runs about 13.2 s from the marks to the wipe:
  - his own camera, centred on the table (new `BossIntro.cam`, `introCam`; every other boss's is unchanged)
  - you both walk on to the marks; his line in the big bubble
  - he charges his staff and blasts; the blast bursts over the battle spot; the icicle forms, falls point first and stabs the floor (a
    crack that stays, a puff of snow), and its round flat top is the table (27 px up: no stools)
  - the stockroom door opens and two elves carry the board out ("Coming, boss!"), run round behind you and toss it onto the table
  - he casts; the pieces come in as the small white light fades
  - his brag, his God King attack, then his blizzard of snowflakes and colored candy canes
  The table and the board are in place before any cover, and nobody steps after the board lands. Twelve new synthesized sounds
  (`gingerCharge`, `gingerBlast`, `gingerBurst`, `gingerWhoosh`, `gingerStab`, `gingerStep`, `gingerHeave`, `gingerClack`, `gingerCast`,
  `gingerSparkle`, `gingerThump`, `gingerGust`) mean every cue has a sound of his own.
- `keyWalk` (arrows.ts) gains an optional `to`, the room's step mapping. `paintTable` gains a `pieces` alpha.

## Player-visible changes and new text
- Ginger Igloo's card: its name, then **"Go in"**. "Shop" and "Coming soon" are gone.
- Inside: the header **"Ginger Igloo"**. The shopkeeper elf's tag and card say **"Shopkeeper"**, with **"Talk"**.
- The crate card: **"Ginger's Boss Crate"**, **"3 Ginger tokens, or 1 Ginger token + 1 crate key"**, **"You have N Ginger tokens and
  N crate keys."** and the buttons **"Buy with 3 Ginger tokens"** and **"Buy with 1 Ginger token + 1 crate key"**. Its prize is the
  **"Candy Cane Sled"**, Mythic ride.
- The FAQ's boss crates line and the Crates tab now include Ginger's Boss Crate.
- The igloo, its catwalk and stairs (you can walk up, along and down), and its elves are new.
- In every shop, the up arrow (and W) walks you up the screen.
- His challenge line (a placeholder until Eric's Gemini lines): **"Cold enough for you?"**. The carriers' line: **"Coming, boss!"**.
- His intro, his blizzard and his twelve new sounds are new.

## Changed checks (old → new)
- `boss-challenge.test.ts`: the intro bosses list `[alfil, bigboy, dash, gardener, grex, hollow, pig, tiger, timber]` gains
  `gingerbread`, plus his intro's fields; "across for all nine" → "all ten" (gains `gingerbread`).
- `shop-room.test.ts`: the homes-with-inside list gains `gingerbread`; the crate-words test gains his crate; the per-shop crate loop
  gains `gingerbread`.
- `shop-grex.test.ts`: `BOSS_CRATES.at(-1)` is Jefferson's → `BOSS_CRATES` contains Jefferson's (Ginger's is last now).
- `town-bots.test.ts`: the sidekick files 19 → 20, and the art id map gains `elf: "sidekick-ginger-elf"`.
- `boss-tokens.test.ts` (server): the crates' rides gain `["gingerbread", "ginger-sled"]`.
- `crates.test.ts` (core): unchanged. `ginger-sled` stays in `NO_CRATE_YET` (it means "in no regular crate", as Giraffe Gallop and Pen
  Pony do). The brief said to take it out, but that fails the regular crates' check (decision note).
- `e2e/areas.json`: the town's paths gain `packages/app/src/characters/ginger-intro.ts`.
- New: `packages/app/test/shop-ginger.test.ts` covers:
  - the height curve: continuous, 0 at the feet, 40 on the deck, each step's height at its middle, never more than 2.7 px off its tread
  - the chain's routing: only from a foot, never off the deck, the nearer staircase, the arrow keys, no talking from the catwalk
  - the round floor, the wall cards on every ring square, the lights, the stand and marks
  - the shopkeeper's sheet and place, and the crate (with the id check)
  - the elves' loops: on the floor and the levels, off the ice, smooth, 40 at every upper stop, 47.5 s
  - an elf waits while you're in its way and goes on after
  - the intro's beats in order (about 13.2 s), the icicle, the carriers (behind the marks, at their spots before the brag), the light and
    the pieces
  - every cue a sound; his camera only his (every other boss's identical to before)
- New e2e: `e2e/shop.spec.ts` "Ginger Igloo". It goes in, talks to the shopkeeper and checks the crate. It walks up the west stairs, along
  the catwalk and down the east stairs by taps (every frame of your lift checked for pops and for squares in front of the deck), then
  up, along and down again by the arrow keys. Last, the red walker waits while you stand in his way and goes on once you step aside.
  `e2e/boss-challenge.spec.ts` "challenging Ginger" plays his intro from the marks to the board and back to the town.

No check guarding a rule in `docs/rules/eric.md` changed.

## Frame rate
Headless, walking 5 s, median of 3, against Jefferson's warehouse, on this shared machine:

| Where you walk | Phone 390 × 844 (phone project) | Computer 1440 × 900 |
| --- | --- | --- |
| In the room | 37.5 against 34.9 fps | 36.6 against 34.8 fps |
| Left and right just inside the door | 35.7 against 40.8 fps | 33.7 against 33.5 fps |

At the doorway the near tunnel walls are the cost (the art's ring of overlapping cards). I cut the room's two dozen floor glows (baked
into the floor's picture). No elf was trimmed: they cost nothing measurable.

## Lane
Boss lane, but **full e2e**: it changes `packages/core` (the crate list is shared), which runs the whole suite anyway. Locally: the
typecheck, the new and changed unit tests, and the two Ginger e2e tests on phone and desktop all passed.

Stills (`docs/ginger-home/`, phone and desktop): `room`, `shopkeeper`, `on-stair`, `on-catwalk`, `stair-foot` (the bottom of the other
staircase), `elf-blocked`, `intro-start`, `icicle-landed`, `board-on-table`, `wipe`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
