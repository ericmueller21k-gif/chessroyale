# Alfil, the woolly mammoth boss: a still for Eric's review (Oct 17, 2026)

**Eric:** "Before we make gifs and do anything, have an agent work this up into a still image sprite and I'll suggest
edits if needed before moving forward."

## What was built

`packages/app/src/characters/alfil.ts`: `ALFIL` with `ALFIL_PALETTE`, one pose (`idle`, a single frame) and
`ALFIL_PORTRAIT`. It isn't in `CHARACTERS`, `BOSS_KITS` or the roster: nothing in the game draws him yet. The preview
draws him through its existing `extra=` option (`npm run preview:characters -- <dir> extra=packages/app/src/characters/alfil.ts only=alfil`),
so no hook was needed.

He's built like the other bosses: painted parts (head with the Nettipattam, ears, body, caparison, feet, shadow) and
strokes from points (legs, trunk, tusks, tail) in `alfilLayers(pose)`, so the poses and animations that follow are
numbers. Outlines, light from the top left and the halo (`#2c2624`, as Sawyer's and Wrangler's) follow the roster.

## Calls made

- **Size:** a 79 x 75 frame, 70 px from the top of his crown to his feet, 72 px wide. The select stage draws every
  boss at one pixel size up to 70 px tall (`TALLEST / PX` in `BossSelect.tsx`), so he's the tallest boss drawn at full
  size there, just over Big Boy (69). Hollow (75) and G-REX (88) are taller in pixels but get shrunk on the stage.
  He's as wide as Sawyer and Wrangler, so on a phone's bar he'd need the `wide` box (as they have) when he's wired in.
- **Colors:** the reference's warm reddish-brown fur (five tones and a light-catching lock color), ivory tusks and
  nails, red and blue cloth with the game's own gold (`#f2c14e`) for the trim and tassels.
- **Simplified for the pixel size:** the breast strap under his trunk is left out (at this size it hid between his
  trunk, his near foot and his thigh, a few stray pixels); the cloth's patterns are two diamonds inside a blue border
  and a gold line (the reference's blue corner triangles left out); four tassels on the caparison and five on the
  headpiece (the reference has more); the fur's texture is banded tones, a few darker strands and locks hanging off
  every lower edge rather than drawn strands; three toenails on each foot.
