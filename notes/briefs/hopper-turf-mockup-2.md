# Chub & Chirp Turf mockup, round 2 (Eric, Nov 22). Haiku, high. Stills only, no game code

Eric on the first mockup: "Maybe we don't change the colors for the turf. ... just the feet imprint that he leaves behind, and then
for ours ... the HunChess like logo ... a dimmed version of it ... we keep all the colors on the board the same, like the defaults."
The first mockup is on orphan branch `stills/hopper-turf-mockup` (`NOTE.md`, the stills, `mockup-script/turf.mjs` which plays a real
battle and shoots, and `mockup-script/overlay.js` which draws the layer). Step by step:
1. `git fetch origin stills/hopper-turf-mockup main`; work in a checkout of `main` (`npm install`), and copy the two scripts from the
   stills branch into a `.mock/` folder there (never committed to main). Read `turf.mjs`'s header for how to run and reshoot.
2. In `overlay.js`: no square tints at all. `cell()` gets no background (both `HIS` and `YOURS` go unused).
3. His squares: keep Chirp's print pair exactly as drawn, but raise its opacity from 0.18 to 0.32 (fresh hop prints stay 0.62),
   since the prints are now the only sign. They must show on both the light and the dark squares.
4. Your squares: draw the app's logo, the crowned pawn from `packages/app/public/icons/icon.svg` (only its `<g>` paths: the crown,
   its band, the pawn; NOT the dark background rect), centered in the square at 46% of its width, filled `#1b1d22` at opacity 0.16
   (dimmed). Never as big or as dark as a piece: it must not read as a piece.
5. The count's swatches ("Chub 26 · You 21 · Open 17"): replace each colored swatch with a tiny version of that side's mark (a print
   pair; the crowned pawn); Open keeps no mark. The holds' pills, the hop-around's dashed path, ring and numbers stay as they are.
6. Reshoot all the stills (phone 390x844, computer 1280x800, the 320 checks), light mode as before, plus one dark-mode phone still
   (`desktop-1-turf-dark.png` is not needed). Look at each one: prints and logos visible but quiet; pieces, last move and dots on top.
7. Commit the new stills over the old ones on `stills/hopper-turf-mockup` (same names), update `NOTE.md` (replace the tints line with
   what you drew), commit the edited `mockup-script/overlay.js` there too, then write `.done2`, push and stop. Commits end with the
   `Claude-Session:` line only. About 45 minutes.
