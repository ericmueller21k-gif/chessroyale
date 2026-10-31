# Boss art (rider views): alfil-howdah

- Model claude-opus-5-5, effort high, adaptive thinking. 9 turns, 6 renders.
- Spend: **$0.98** of the $3 cap (20 input, 62,902 cache-write, 336,461 cache-read, 29,913 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/alfil-howdah/alfil-howdah.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/alfil-howdah/preview/idle.png, scripts/boss-art/out/alfil-howdah/preview/move.png, scripts/boss-art/out/alfil-howdah/preview/look.png, scripts/boss-art/out/alfil-howdah/preview/front-idle.png, scripts/boss-art/out/alfil-howdah/preview/front-move.png, scripts/boss-art/out/alfil-howdah/preview/back-idle.png, scripts/boss-art/out/alfil-howdah/preview/back-move.png, scripts/boss-art/out/alfil-howdah/preview/views.png. Each look it took: scripts/boss-art/out/alfil-howdah/looks/.

## Its notes

I added a front and a back view to Alfil's Howdah and left the side view's code untouched. I checked both views in the three-view render, frame by frame at 4x, at town size and in every color, with a white pawn and a black one (on Pearl). The colored parts are the same as the side's and keep its names: the caparison (blanket), the panel and the pennant. Fur, ivory, pink, gold trim, tassels and the blue-centered diamonds stay fixed. The pawn sits at the same height as on the side (lifted 26, hidden below 70) with no sideways offset, so turning a corner doesn't make it jump.

**Back view (walking away):** The round shaggy rump has a fur fringe. The caparison drapes over both flanks, its gold-trimmed edge arching up in the middle, with a gold diamond on each side and a tassel at each lower corner. The tufted tail hangs from under that arch, and the two hind legs show ivory toenails. The howdah's back wall matches the side's wall, with the same gold frame, panel and diamond. The two tall near posts have gold balls, and the pennant flies from the left one, as on the side. Behind the pawn you see the far rim and two short posts with balls and spikes. The top of the mammoth's head and tuft peek around the pawn, and both ears stick out past the howdah, so it reads as a mammoth from behind.

**Front view (walking toward us):** The big round head has the top tuft, two big shiny eyes, pink cheeks and two small curled ivory tusks. The curled trunk hangs down the middle. Both ears stick out to the sides with pink insides. The caparison drapes and their tassels show below the ears, and the two front legs show toenails. The gold front wall's colored panel shows above the head, with the two short front posts (gold balls and spikes) in front of the pawn. Behind the pawn are the far rim and the tall back posts, with the pennant on our right (the mammoth's left side). The pawn sits behind the head and reads clearly.

**Idle (8 × 220 ms, both views):** the side's slow breathing bob of the body, howdah and pawn, with the feet planted. The trunk sways and curls (front), and the ears flap once on frames 5–6. The tassels, tail and pennant swing gently.

**Move (8 × 110 ms, both views, in place with no forward or backward shift):** the side's lateral plod, seen end-on.
- Back: the left hind leg lifts first, the right one half a cycle later.
- Front: the two front legs take the side's front-leg timings, a quarter-cycle off the hind legs.
- Each lifting foot rises and shortens a little.
- The body dips twice per cycle and rolls side to side about 3°, pivoting at the feet. The pawn rolls with it.
- The trunk swings, the tassels and tail swing against the step, the pennant flaps and the ears give a small flap twice.
- Frame 7 leads back into frame 0.

**Choices you might want to change:**
- **Front panel:** the head's tuft overlaps the bottom middle of the front-wall panel and hides most of its gold diamond.
- **Caparison from the front:** it shows mostly as drapes and tassels below the ears. I hung it 5 units lower than the side's so it isn't hidden.
- **Back-view ears:** they sit higher than the front view's, because the head is farther away. They read as big flaps beside the howdah.
- **Tile box:** both new views use a narrower box than the side's: [4, -9, 92, 109].
- **Toenails from behind:** the hind feet show ivory toenails because the brief asked for them, though a real mammoth's wouldn't show from behind.
