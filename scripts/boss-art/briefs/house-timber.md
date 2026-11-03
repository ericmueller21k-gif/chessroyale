# Timber's home on the town square: Timber's Lumber Lodge

You are drawing a **home**, not a boss: the building Timber lives in on the town square, where the player walks among the
chess bosses' homes. It uses the same sprite format as the bosses (`Character`), with only an `idle` animation. The
render tool's other boss checks don't apply (it knows: the id starts with `house-`).

## Read first
- Timber, the beaver builder: `scripts/boss-art/out/boss-beaver/boss-beaver.ts`, its `PALETTE`. Use his colors: his
  browns, the orange hard hat and safety vest, the yellow tool belt, the red hammer handle, the wood of his planks.
- How homes are drawn: `packages/app/src/town/houses/kit.ts` (`paint`, `grain`, `groundShadow`, `signBoard`,
  `signPost`, `signFace`, `LightSpot`, `LightPool`, `TORCH`, `LANTERN_LIGHT`). Look at two or three finished homes, for
  example `houses/gardener.ts`, `houses/tiger.ts` and `houses/alfil.ts`, and match:
  - their frame size (about 144 wide, 120 to 150 tall);
  - their foot;
  - their light (from the top left), outline and ground shadow;
  - their **blank sign board on two posts in front**: the game writes the name, so never draw letters.
- Exports, the same way as the others:
  - the home: `HOUSE_TIMBER: Character`, id `house-timber`;
  - the sign's face: `HOUSE_TIMBER_SIGN = signFace(...)`;
  - its lights, if it has a lamp or a glowing window: `HOUSE_TIMBER_LIGHTS` (`LightSpot`s) and `HOUSE_TIMBER_POOLS`
    (`LightPool`s).
- `docs/areas/town-square.md`, for how homes sit in the world. Every home stands on a **3 x 3 plot** of squares
  (`houses` in `packages/app/src/town/world.ts`), so match the others' footprint.

Import from the repo with paths relative to your file (`../../../../packages/app/src/town/houses/kit.ts`, and so on).

## The design (Eric, Nov 3: "a lumber-themed home")
A cozy **beaver lodge crossed with a little lumber mill**:
- A sturdy cabin of stacked logs, their round cut ends showing at the corners, on a low stone footing.
- A roof of rough planks or wooden shingles, with a stout stone chimney.
- A big front door of planks with iron straps, standing a little open, with warm light inside. One small window with
  light.
- **Lumber all round:**
  - a neat stack of sawn planks on one side, tied with rope;
  - a pile of round logs on the other;
  - a chopping stump with an axe or a mallet in it;
  - a sawhorse;
  - a few wood shavings and chips on the ground.
- A touch of beaver: maybe a lodge-like mound of sticks woven into one side of the roof, or a little dam-like log fence.
- His orange: a hard hat hung on a peg by the door, or an orange safety pennant or traffic cone.
- The blank sign board on two posts in front, as on the other homes: a rough plank sign on two log posts.

Keep it calm and cozy; it should sit comfortably among the other homes, about their size and visual weight.

## idle
Four to six frames:
- smoke curls up from the chimney;
- the light in the doorway or window flickers softly;
- maybe a wood chip or two drifts down from the plank stack.

Nothing else moves.

## Looks
Render the idle at 3x and 4x on both backgrounds, then at phone size beside other homes (render's `with`:
`house-gardener`, `house-tiger`, `house-alfil`) to check its size and weight. Call done with notes on your choices,
its size, its foot and its footprint.
