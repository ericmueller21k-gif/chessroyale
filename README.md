# The Hidden Boss's final form, round 4 (MOCKUP, Nov 15)

Eric, after playing round 3b: no more suit or helmet. His face as it is with the glowing blue eyes (Nov 14), a black trench coat,
his hair always rising and flowing, an aura field round him with bolts in it, and 1s and 0s spiraling round him in a double helix.
Mid-round notes from Eric: the hair "looks like dreadlocks, should have more strands... more lines in between", then blue hair
tried and dropped ("the brown is better, but the dreadlock change was good, keep that").

Every still here is from the real game (Boss alone, the Hidden Boss) except the close-up, the whole-figure sheet and the GIF, which
are his drawing rendered directly. The art is real code in his drawing (`characters/recluse.ts`: `coatFrame`, `coated`), worn the
way the suit was (by part names, plus its own layers), so for this mockup it simply replaces the suit wherever the suit showed.

## The images

| File | What |
|---|---|
| `idle.gif` | Phase 2's idle (4.7 s loop, 4x): the aura flickering, bolts flicking, the helix turning (one turn every 12 frames, about 1.6 s), his hair rippling, the coat's tails swaying |
| `closeup-front.png` | His head and chest up close (8x) |
| `whole-figure-dark-light.png` | The whole figure (4x): holding the book on a dark ground and on the light board's color, then the reveal pose (arms at his sides) on both |
| `phone-reveal-first-frame.png`, `computer-reveal-first-frame.png` | The reveal after the white-out, on the board (the spark at his chest is the existing reveal spark) |
| `phone-four-boards-figure.png`, `computer-four-boards-figure.png` | His figure on the board as it splits into four ("Prepare yourself") |
| `phone-bar-bust.png`, `phone-phase2.png` | Phase 2 on a phone: the boss bar's bust, and the whole screen |
| `computer-phase2-beside-board.png` | Phase 2 on a computer: his figure beside the four boards, the bar's face top left |

## What's drawn

- **Face:** as now: phase 2's shadows and the glowing blue eyes with the thin lines of light down his cheeks, on every frame
  (a blink still shuts them). No helmet, visor or suit.
- **Hair:** his own brown, always lifted: one mass swept up from his crown, made of fine strands with a darker line between each,
  every strand its own shade and length, so the top is a fringe of fine ends rather than a few thick locks. The whole mass ripples
  as the draft runs up it (three ways, changing every other frame) and each strand curls a little on its own. Its outer edges catch
  a little of the aura's light. It's part of his head's drawing (one outline), so no line runs across his hair.
- **Black trench coat, his own cut:** long, to mid-shin; worn open over his white shirt, blue tie and belt (his look from phase 1,
  so he's still himself); wide lapels with a notch, the collar turned up round his neck, a strap on each shoulder, buttons down each
  front, its own belt with one end hanging loose on his left, sleeves to the wrist with a cuff strap. Between the fronts you see his
  trousers and the coat's dark lining behind his legs; the blue lining shows at the inside corners of the hem. The tails sway a
  pixel or two each way (four steps).
- **Aura:** a see-through blue glow field round his whole figure, brighter close to him, its edge rippling up like a flame's
  (three flickers).
- **Bolts:** up to two small jagged crackles (white core, blue edge) flicking near the aura's edge on about half the frames.
- **Binary double helix:** two strands of tiny 1s and 0s (20 each) spiraling round him from his feet to above his hair, turning;
  the glyphs on the near side are drawn over him (the nearest white, the rest electric blue so they read on the light board too),
  the far side under him in dimmer blue; a faint dotted line traces each strand behind; now and then a digit flips. One passing in
  front of his face is left out, so it never covers his eyes.

## How it stays his own (not a famous look)

- **No sunglasses**: his face and glowing blue eyes show the whole time.
- **No falling code rain, and blue not green**: the 1s and 0s turn round him on two strands of a helix, inside his aura; they
  never fall in columns or cover the screen.
- **The coat**: a trench (lapels with a notch, shoulder straps, buttons down each front, a hanging belt end, cuff straps), worn open
  over his white shirt, blue tie and navy trousers with brown shoes; not an all-black outfit and not a high-collared, lapel-less long
  coat.
- **The hair**: his own brown, his own shape (fine strands swept up and rippling from his parted cut), not golden and not stiff
  spikes; the aura is cool blue, not a golden flame.
- His red book with its gold Ш, held in front of him, stays his signature.

## Frame cost (phones first)

- **Nothing added per frame on screen.** Like the suit, the coat, aura, bolts and helix are pixels in his own frames: each frame is
  drawn once (ahead, in `prewarmRecluse`'s slices) and cached; on screen a frame is still one `putImageData` of his 64 x 146 canvas
  (50 x 70 for the bust) when it changes, as now. No new canvas, element, loop or CSS effect.
- **Drawing ahead** (measured on a computer, idle's 36 frames): the suit 83 ms the first time (its parts painted) and 40 ms after;
  the coat 124 ms and 49 ms (about 1.4 ms a frame against 1.1). On a 4x slowed phone that's about 5 ms a frame, one frame a slice,
  already how his frames are drawn ahead. 18 more frames in all: the reveal's loops go from 6 to 12 frames so the helix turns.
- **The full helix stays**: a cheaper version (fewer glyphs, or no dotted strands) would cost the same on screen, since it's baked
  into the frames; it would only look emptier. The `@perf` specs run on go (the drawing changes).

## What the helmet look leaves dead (removed on go)

- His drawing: the suit and helmet (`suitName`, `suitFrame`, `suitTorso`, `suitLegs`, `helmet`, `glass`, `SHELL`, `OPENING`,
  `traces`, `GLOVE`, `BOOT`, the `Visor` type, the arm's `suit` flag) and their palette keys (the suit's navy and panels, the red and
  blue traces, the yellow nodes, the visor's glass). `suited` becomes the coat (or is renamed with the kit's `suit` flag,
  `setSuitAt` and `data-suit`, to name his final form).
- The transformation: the visor flip's frames (`flipUp`, `faceOpen`, `flipDown` in `recluse-transform.ts`) and their beats
  (`flipUpAt`, `flipDownAt` in the settings and `RecluseTransform.tsx`'s schedule): he's revealed with his face showing and says
  his first line ("Computation without creativity is nothing. Now I have both.") as he stands, at the same time it starts now
  (`line1At`), so the music and the rest of the beats don't move. The reveal's spark sound stays (only its comment names the visor).
- Tests and scripts: `recluse.test.ts` (the suit on every frame, the visor's three ways), `recluse-phase2.test.ts` (helmet heads,
  the visor up for his line), `e2e/recluse.spec.ts` (`visorUp`/`visorDown` beats, the suit's pixel colors), the frames script's beat
  names; `docs/areas/bosses.md`'s suit section.
- Known on go: in a phone's bar the tallest hair touches the bar's top edge (`phone-bar-bust.png`); the bar's shift for him can
  lower it a few pixels.
