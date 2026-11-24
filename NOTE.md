# Crate opening overhaul: mockup and sound options (Nov 24)

A mockup only. Nothing here is wired into the game and nothing merges to main. The roll, the odds and the server call are untouched:
this changes only how the opening looks and sounds. The code is on branch `claude/crate-open-mockup` (the page is
`/crate-open-preview.html` on `npm run dev`). This branch holds only the media.

## What's here

| Folder | What |
|---|---|
| `sounds/` | The 3 sound options: the whole sequence (about 5.0 s each), each also as a 2.0 s Legendary ending. MP3 and WAV. |
| `gifs/` | One GIF per rarity on a phone (`common.gif` … `mythic.gif`), plus `computer-legendary.gif`. About 5.8 s each, looping. |
| `videos/` | The same runs as MP4 **with sound**, every rarity in every option (`<tier>-spokes.mp4`, `-ratchet`, `-reel`), plus `computer-legendary-spokes.mp4`. These are the best way to judge it: picture and sound together. |
| `stills/` | Six beats (spin, stop, shake, burst, beam, card) for Rare and Mythic on a phone, and Legendary on a computer. |

## The sound options

Each one is made in code, the same way the bosses' sounds are (no outside samples, so nothing for LICENSES.md). Every clip runs:
the strip's clicks slowing to a stop, the box dropping in and landing with a thud, the box shaking faster and faster over a rising
charge, then the lid bursting off with the sting. The sting's chord climbs with the rarity, so a better item sounds brighter before
you read it. The clips are leveled to match each other (−14.4 to −15.0 LUFS). The low boom needs headphones; a phone speaker still
carries the clicks, the crack and the chord.

- **A: Card in the spokes** (`A-card-in-the-spokes.mp3`). A stiff card snapping against spokes. At full speed it's a papery buzz.
  As it slows, each flap gets a little flutter, and the last few rattle. At the stop the card comes to rest on a spoke. Then a clean,
  glassy chord.
- **B: Prize-wheel ratchet** (`B-prize-wheel-ratchet.mp3`). A sharp, hollow plastic click on each peg. As it slows you hear the
  clicker scrape up each peg before it snaps. It ends in a solid thunk as the clicker drops between two pegs, with a small bounce.
  Then a warm bell chord.
- **C: Slot reel** (`C-slot-reel.mp3`). A heavier metal tick with the reel's weight under it. From a third of the way in, a low swell
  rises under the slowdown until the reel locks with a clunk. Then a fuller pad chord.
- **The Legendary endings** (`*-legendary-ending.mp3`, 2.0 s each). The top of the shake, then a bigger burst: a deeper boom, a longer
  whoosh as the beam shoots up, the chord with an octave under it, a rising sparkle run and a held choir, and a longer room tail.
  Legendary and Mythic both use this ending.

## The look (the GIFs)

1. **The spin.** It's the same strip with more depth: the window's ends fall into shadow like a drum, with a gloss along the top. The
   center line glows and has notches top and bottom. At speed a motion-blurred copy of the strip sits over it and fades out as it
   slows. The slowdown is a cubic, not today's quartic. With today's curve no tile edge crosses the line in the last third of the
   spin (measured: the last click comes at 66%), so it ends in a long silent crawl. With the cubic, and the strip stopping just
   past the winning tile's near edge, the last click comes at about 80%. The strip creeps over the last edge, runs a few pixels too
   far and settles back. At the stop the winner lifts and flares and everything else dims.
2. **The open (Rocket League style).** The winning box (the tier's own box from the strip, the same art the current unwrap uses)
   drops into the middle, lands with a squash and shakes harder and harder while light leaks from its lid's seam and pools under it.
   Then the lid bursts off, spinning away, and **a beam of light in the rarity's color** shoots up out of the box. Rays fan out behind
   it and motes rise in it. The item rises out of the beam into the reveal card, which forms around it. The beam stays as a glow
   behind the card.
3. **By rarity.** The beam gets wider and the rays more numerous from Common to Mythic. Legendary and Mythic also get a flash over
   the whole stage, rays across the whole stage that turn slowly, and the stage jolting at the burst.

**The light reused:** the Hidden Boss's light (`components/recluse-light.ts`, the one in his transformation and in Moo's and Birdie's
cinematics). It now has one small export, `lightSprites(rgb)`: its own ray, shaft, pool and glow shapes, made in the tier's color.
Here they're made once per color and moved by CSS: no canvas, no worker, no frame loop.

**Frame rate:** everything moves by transform and opacity in Web Animations, which run on the compositor, not the main thread. The
clicks are worked out ahead and scheduled on the audio clock (`clickTimes`), so neither the picture nor the sound depends on a frame
loop. Today's strip moves from a main-thread frame loop, so any hitch on the page shows in it. Measured on an emulated iPhone 13 with
the CPU slowed 4× (`node scripts/crate-open-perf.mjs`): 60 fps steady (median 16.7 ms, p95 16.8 ms) through the whole run on every
tier. There is one long main-thread frame (about 150 to 230 ms at 4×, about 26 ms of real CPU) as the animations are set up at the
start. It doesn't stop the strip: the strip's clock was already 280 ms in during it. The final version would set them up while
"Opening…" waits for the server.

## Decisions for Eric

1. **Which sound:** A, B or C (or A's clicks with C's swell under them, an easy mix).
2. **How long the spin is.** Today it's 6.2 s. The clips and GIFs use 2.7 s so the whole sequence fits the 3 to 5 s clips asked for.
   The page plays 2.7 s, 4 s or 6.2 s, and the sound follows any length.
3. **Stopping just past the near edge** every time, for the near-miss creep. Today it stops anywhere in the middle 60% of the tile.
   Either way it's only where the picture stops; which tile it is doesn't change.
4. **The box or the crate.** The mockup drops the winning tier's box (what the strip landed on). The crate itself (the Beta crate's
   art) could drop instead; that's a one-line change.

## New art

**None is needed.** The mockup uses only existing art. The lid flying off is the box's own drawing cut in two. A final version
*could* have an opened box drawn for each look (the present, the supply box, the HunChess box: the inside showing, and the lid as
its own piece), so the lid flies off as a real lid rather than a cut band. From the art runner's past costs (the coin $1.29, Big
Boy's tower $1.63), that's about 6 small pieces, **roughly $6 to $10 (a $10 cap)**. No art was bought for this job.

## My recommendation

- **Sound A, the card in the spokes.** It's the sound Eric described, and its papery buzz-to-flutter is the least "silly" of the
  three and the most exciting at speed. C is the runner-up if he wants more weight. Its swell could go under A.
- **A 4 s spin.** 2.7 s is a little quick for a crate, and 6.2 s with the open's extra 3 s makes the whole thing long.
- **Ship the look as it is**, with no new art: the cubic slowdown with the near-edge stop, the box open, the tier-colored beam, and
  the bigger moment for Legendary and Mythic.
- When building it for real: the crate's sounds are made ahead in the sound worker (as the bosses' are); reduced motion skips the
  blur, the shake and the jolt; the Fischer Random path reuses the same open (its second strip lifts the item and the gold beam
  comes without a box); and Settings' "Reveal sound" keeps the move reveal's voices. It goes in the targeted lane (screens), with
  the crate specs.
