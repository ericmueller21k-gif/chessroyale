# Boss art (rider views): smudgy-brush

- Model claude-opus-5-5, effort high, adaptive thinking. 15 turns, 8 renders.
- Spend: **$1.39** of the $3 cap (32 input, 81,870 cache-write, 799,667 cache-read, 41,179 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/smudgy-brush/smudgy-brush.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/smudgy-brush/preview/idle.png, scripts/boss-art/out/smudgy-brush/preview/move.png, scripts/boss-art/out/smudgy-brush/preview/look.png, scripts/boss-art/out/smudgy-brush/preview/front-idle.png, scripts/boss-art/out/smudgy-brush/preview/front-move.png, scripts/boss-art/out/smudgy-brush/preview/back-idle.png, scripts/boss-art/out/smudgy-brush/preview/back-move.png, scripts/boss-art/out/smudgy-brush/preview/views.png. Each look it took: scripts/boss-art/out/smudgy-brush/looks/.

## Its notes

I added front and back views to Brush Ride (smudgy-brush). The side view is untouched: all the new code sits after the side's functions, and the RiderDraft only gained a `views: { front, back }` field. Both views pass through x 50, keep the side's pawnY -16 and cut 84, and use the side's fixed colours: wood, silver band, black bristles, plum pad. The painted parts are still only the bristle tips (Region "tips") and the trail and wisp (Region "trail"), with the same names as the side. Each view is about 74 units wide at most, well inside the 125 limit.

**Back view (flying away, bristle end toward us):**
- A round black tuft with faint hair streaks and a grey highlight, and its colour-dipped tip in the middle as a wavy disk with the side's white highlight.
- The silver band's top edge shows as a crescent above the tuft.
- Behind that, the plum seat pad seen end-on, with the same dashed stitching.
- The handle runs away behind the pawn, so it's hidden. The soft shadow sits below.
- The tuft sits low and in front, so it covers the bottom middle of the pawn.

**Front view (flying toward us, handle end toward us):**
- The wooden handle comes out of the pad toward us and ends in a round end with grain rings and a highlight.
- The pad is behind it, and the pawn is clearly visible above.
- Behind the pawn, the far tuft is drawn splayed wide, so black bristles with coloured tips peek out on both sides.

**Idle (8 × 230 ms, as on the side):**
- The same ±2 bob, with the side's ±1.2° sway shown as a small roll; the pawn rolls along with it.
- The wisp follows the side's beats: none on frames 0–1, it grows on 2–4, lifts and fades on 5–6, and is gone on 7.
- Back: it curls up out of the centre tip. Front: it rises from the left tip, outside the pawn.

**Move (8 × 70 ms, as on the side):**
- The side's swoop in place: it dips 3.5 down and comes back up, with a ±3° bank, the pawn leaning 0.8× with it, and a ±2 sideways sway (pose dx ±2, so not exactly 0).
- Back: a short ribbon of colour trails toward us from the tip and fades out. It bends with where the tip has been, so it swings slightly side to side.
- Front: the stroke runs away behind the pawn, so only its two faded edges show past the shoulders, swinging with the bank.
- The move loops cleanly from its last frame to its first.

**Choices you might want to change:**
- **Pad width:** the pad seen end-on is about 52 wide, wider than the side's 36-long pad. It has to be that wide to hide the pawn's cut edge.
- **Front tuft:** the far tuft is splayed wide (x 13–87) only so it can peek past the pawn. A real round tuft would be completely hidden from the front.
- **Front trail:** it's a broad faded band behind the pawn, so mostly just its edges show. Widen `hw` in FrontTrail if you want more of it.
- **Back wisp:** it rises over the dark tuft, which at 4x can look a little like a flame.
- **Midnight:** as on the side, the dark tips are hard to tell from the black bristles.
