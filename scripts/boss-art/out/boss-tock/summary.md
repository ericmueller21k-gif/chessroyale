# Boss art: boss-tock

- Model claude-opus-5-5, effort medium, adaptive thinking. 10 turns, 5 renders.
- Spend: **$1.20** of the $3 cap (22 input, 91,305 cache-write, 558,888 cache-read, 31,456 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/boss-tock/boss-tock.ts.
- Previews: scripts/boss-art/out/boss-tock/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/boss-tock/looks/.

## Its notes

Tock, the clockmaker badger. This is a concept, so only `idle` is drawn, as the brief asked: 24 frames of 180 ms, about 4.3 s, looping. The file is scripts/boss-art/out/boss-tock/boss-tock.ts and exports `TOCK` with id "boss-tock". The frame is 60 x 72. I rendered all 24 frames, at 3x and 5x, on dark and light grounds and at phone size beside the tiger.

The look: a stout badger facing our left. Black stripes run back through his eyes to his ears, with white down the middle of his head and grey behind. A brass loupe sits in his near eye and shows that eye magnified behind blue glass; a little leather strap runs from it to the back of his head. He wears a red bow tie, a cream shirt rolled up past his grey forearms, and a walnut leather apron with two pockets: a red screwdriver and a tweezer in one, a brass gear peeking out of the other. His far paw rests on his hip, which makes him look fussy. His near paw holds up a big brass pocket watch: tick marks with no numbers, an hour hand fixed at ten, a gold glint on the rim, and a gold chain hanging down to his pocket.

The idle, beat by beat:
- **The whole loop:** the minute hand ticks one mark per frame, so it goes round twice.
- **Frames 0–3:** calm breathing (the body sinks a pixel). The watch glints on frame 3.
- **Frames 4–10:** he dips his head and peers down at the watch through the loupe. His free paw reaches across and taps the rim twice, with little tap lines, and the watch jiggles a pixel each time.
- **Frames 11–13:** he looks up with a small smile and half-shut eyes. The loupe flashes: the glass goes bright and a star sparkles on it.
- **Frames 14–19:** a tiny silver coil spring boings out of his right apron pocket. He looks down at it, plucks it with his paw and tucks it back with a pat.
- **Frames 20–23:** a contented smile, a breath and a blink.

Choices you might want to change:
- **Hand on hip:** the resting paw on his hip makes him look fussy. A paw folded over his belly would read cozier.
- **Arm across the chest:** when he taps, his arm crosses his chest under his chin. It reads at phone size, but it's busy for a moment.
- **Small details:** the far eye is only a glint in the far stripe, and the mouth is a small dark line, so his face reads mostly through the loupe.
- **Hands:** the minute hand ticks once per frame, which is quick, like a second hand. Ticking every other frame would be calmer.
- **Spring colour:** the spring is pale steel so it shows up against the brown apron. Brass would match his palette better but would show up less.
