# Boss art (rider trail): folio-crane

- Model claude-opus-5-5, effort medium, adaptive thinking. 5 turns, 2 renders.
- Spend: **$0.27** of the $1.5 cap (12 input, 36,956 cache-write, 110,015 cache-read, 3,032 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/folio-crane/folio-crane.tsx.
- The trail: its mark {"frames":4,"lifeMs":650,"every":1,"w":24,"h":14,"drawn":"21 x 13 units at most"}; nothing taken out of its frames, the rest of every frame unchanged.
- Previews: scripts/boss-art/out/folio-crane/preview/idle.png, scripts/boss-art/out/folio-crane/preview/move.png, scripts/boss-art/out/folio-crane/preview/look.png, scripts/boss-art/out/folio-crane/preview/front-idle.png, scripts/boss-art/out/folio-crane/preview/front-move.png, scripts/boss-art/out/folio-crane/preview/back-idle.png, scripts/boss-art/out/folio-crane/preview/back-move.png, scripts/boss-art/out/folio-crane/preview/views.png, scripts/boss-art/out/folio-crane/preview/trail.png, scripts/boss-art/out/folio-crane/preview/ride.gif. Each look it took: scripts/boss-art/out/folio-crane/looks/.

## Its notes

I've added Paper Crane's trail mark: three folded-paper scraps lying on the ground. I took nothing out of the ride's frames. I checked every view's idle and move, and nothing gets left behind: the shadow stays under the crane. None of the ride's code changed, apart from one extra type import and the new `trail` field.

**The mark** (`PaperScraps`, a 24 × 14 box, one on every square the crane leaves, life 650 ms):
- **The scraps:** a cream paper triangle with a faint blue-grey ink line on it, a slightly darker cream sliver, and a small triangle in the item's color (flat `p.hex`). Each has a thin dark ink edge.
- **Frame 0 (160 ms):** crisp, all three lying close together.
- **Frame 1 (160 ms):** lighter (opacity 0.72), starting to drift apart.
- **Frame 2 (170 ms):** scattered: the pieces slide outward, turn a little and shrink slightly (opacity 0.45).
- **Frame 3 (160 ms):** almost gone (opacity 0.18, smaller and spread wider).
- **Direction:** it doesn't point any way, so it's the same for side, up and down. Every other mark is flipped left to right, so the scraps don't repeat exactly.

**How it reads:** at town size it shows on both the light and the dark squares as a small light speck with a dot of the item's color. The scraps are tiny at that size.

**Choices you might want to change:**
- **Outline weight:** I used a thin outline (lw 0.9), not the usual heavier one. With the thicker line the cream barely showed and the scraps looked like dark specks.
- **The colored scrap:** at town size it's only a dot. On dark colors like midnight it reads more as ink than as colored paper.
- **The last frame:** it still shows a faint trace rather than nothing.
