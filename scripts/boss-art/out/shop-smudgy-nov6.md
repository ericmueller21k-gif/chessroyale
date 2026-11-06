# Smudgy's studio, its gallery owner and its intro (Nov 6), drawn by hand in code

Drawn in the game's tree (branch `claude/smudgy-home`) and copied here for the record, as Folio's and Hollow's are kept here. No paid
API, no art runner. The decision note: `docs/decisions/2026-11-06-smudgy-home.md` on that branch.

- `house-shop-smudgy/house-shop-smudgy.ts` (the game's `shops/smudgy-art.ts`) and `paint-kit.ts`: the room (dark planks, drop cloths,
  canvas-hung walls in deep teal, blue, oxblood and plum, the backdrop of paint shelves, the counter, the crate, sculptures of the
  Colosseum's pixel pieces, the life class: the knight turning on its platform and eight painters in a ring, one 32-frame loop shared,
  each an eighth of it apart). `room.png` (the room as a flat plan), `painters.png` (the loop), `painter-colors.png`, `knight.png`.
- `house-intro-smudgy/house-intro-smudgy.ts` (`shops/smudgy-intro-art.ts`): the round table and its stools, the cloth covered, whipped
  off and in its heap; `splatter.ts` (`shops/smudgy-splatter.ts`): the splatter into the match. `intro-cloth.png`.
- `sidekick-smudgy-keeper/sidekick-smudgy-keeper.ts` (`characters/sidekicks/smudgykeeper.ts`): the gallery owner, Dabble's rig with a
  smock and glasses. `keeper.png`.
- The previews: `scripts/boss-art/smudgy-stills.ts` (`npx tsx scripts/boss-art/smudgy-stills.ts <dir>`).
