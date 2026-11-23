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

## His weapon: the ankus (Oct 17)

**Eric** first asked for "a long ancient spear … almost longer than his whole body … holding that to his side", then
changed it to an ankus: the ornate goad an elephant's rider commands him with, which Alfil took from his rider and
carries as a trophy, scepter-length, held to his side in one raised front fist (pointing it later reads as a cast, his
Tusks power).

**What was built:** `ankus()` in `alfil.ts`, a part drawn along its axis from two pose points (`ankusButt`,
`ankusTip`), so a later pose (pointing it) is two numbers. All gold, shaded like the rest of him (light from the top
left, `P` added for brass's deepest shade): a straight spike at the tip, a knob under it set with a red stone, the
hook curving out of the knob and back down, a blue band under the head, red and blue wraps either side of his fist
(the Nettipattam's colors) and a knob at the butt. He grips it in his far front fist (the one out to our left); the
staff passes behind that fist, in front of his far ear and behind his far tusk, and its butt stands by his near foot.

**Calls made:**
- **Size: he stays full size on the select stage.** The stage draws every boss at one pixel size up to 70 px tall
  (`TALLEST / PX`) and shrinks any taller. A tip above his crown would make him 71 px or more and shrink him (at 71 px,
  to 0.789), so the tip stops level with the top of his crown: still 70 px tall, still drawn at 0.8. The staff is 67
  px from butt to tip, about his whole height, so it reads as scepter-long beside him.
- **Slanted a little (about 3 degrees), hook out to our left.** The hook toward his head ran into his ear and
  headpiece and read as a blur; out to our left it stands alone against the ground, beside his head, above his far
  ear. Its reach is capped by his room beside the board: the side stage on a computer reserves room for 44 sprite px
  left of a boss's feet (`--bs-reach`, sized by Sawyer's reach), and he was already at 42. With the ankus he reaches
  exactly 44 (30 to the right, unchanged), so it needs no more room there. The frame (79 x 75) and his feet are
  unchanged.
- **The phone's boss bar:** he's drawn at one screen px a sprite px from his feet at the box's bottom middle, as now.
  He reaches 44 px to the left (was 42) and stands 70 px tall (unchanged); with the `wide` box (58 px) that's 11 px
  past the bar's left edge, 2 more than before, against Sawyer's and Wrangler's 4. Checked when he's wired in, as
  noted above for the `wide` box.
- **The portrait** now shows the ankus's head beside his: `ALFIL_PORTRAIT` moved 3 px left and is 4 px wider
  (`x: OX, w: 50`), so its hook isn't cut in half. It reads cleanly beside the headpiece, and says who he is.
- **The accents:** a red stone on the knob and blue and red bands, small enough to stay one or two pixels each; no
  tassel (beside the hook, inside his reach, there's no room for one that wouldn't merge with it).
