# Folio's home on the town square: Folio's Folded House

You are drawing a **home**, not a boss: the building Folio lives in on the town square, where the player walks around a
small world of chess bosses' homes. Same sprite format as the bosses (`Character`), but only an `idle` animation; the
render tool's other boss checks don't apply (it knows: the id starts with `house-`).

## Read first
- Folio, the paper crane, whose home this is: `scripts/boss-art/out/folio/folio.ts` (its palette `FOLIO_PALETTE` and
  how its paper, ink, gilt and seal look), and its brief, `scripts/boss-art/briefs/folio.md`.
- How homes are drawn: `packages/app/src/town/houses/kit.ts` (the shared pieces: `paint`, `grain`, `groundShadow`, the
  sign board, posts and face) and two or three finished homes, e.g. `houses/hollow.ts`, `houses/gardener.ts`,
  `houses/smudgy.ts`. Match their frame size (144 wide, 120 to 150 tall), their light (from the top left), their outline,
  their ground shadow, and their **blank sign board on two posts in front** (the game writes the home's name on it; never
  draw letters). Export the sign's face the same way (`HOUSE_FOLIO_SIGN = signFace(...)`), and the home as
  `HOUSE_FOLIO: Character` with id `house-folio`.
- `docs/areas/town-square.md`, for how homes sit in the world.

Import from the repo with paths relative to your file (`../../../../packages/app/src/town/houses/kit.ts`, and so on).

## The design (the director's)
A small cottage **folded from one giant sheet of Folio's own paper**:
- Walls and a steep two-faced roof with crisp creases, every face lit, mid or shaded the way Folio's are (use its paper
  colors), so it reads as folded paper, not plaster.
- Faint handwriting across the walls and roof, in Folio's soft faded blue ink (`#8a93b8` on lit paper, `#717898` on
  mid, `#575c78` on shaded): a few short lines per face, **faint, like old pen on paper; never dark lines** (Eric: the
  ink must never read as veins).
- A thin gilt edge (Folio's gold) along the roof's ridge and its front edge.
- The door: a folded flap standing a little open, warm lamplight inside.
- **Folio's seal** over the door: the small vermilion stamp with the pawn knocked out, as on its wing.
- A string of three small paper cranes hanging from the eave on thread, cream with a pixel of gold each.
- A small stack of folded pages and a closed book beside the door, on the ground.
- The blank sign board on two posts in front, as on the other homes, in plain wood or folded card.
Keep it calm and cozy; it should sit comfortably among the other homes, about their size and visual weight.

## idle
Four to six frames: the hanging cranes sway gently on their threads (each a little out of step), and once in the loop
the lamplight in the doorway flickers softly. Nothing else moves.

## Looks
Render the idle at 3x and 4x on both backgrounds, and at phone size beside other homes (render's `with`:
`house-hollow`, `house-gardener`, `house-smudgy`) to check its size and weight. Call done with notes on your choices.
