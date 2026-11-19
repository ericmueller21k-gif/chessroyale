# Boss art: sidekick-tower-clerk

- Model claude-opus-5-5, effort high, adaptive thinking. 26 turns, 27 renders.
- Spend: **$2.28** of the $5 cap (54 input, 129,856 cache-write, 2,285,777 cache-read, 58,475 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-tower-clerk/sidekick-tower-clerk.ts.
- Previews: scripts/boss-art/out/sidekick-tower-clerk/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-tower-clerk/looks/.

## Its notes

The Clerk is done: a penguin bellhop in his own black-and-white coat, wearing a slate jacket with gold piping, a gold hem and a double row of gold buttons, a gold pillbox cap with a gold chin strap, and a gold bow tie. He has an orange-gold beak and feet and half-lidded calm eyes with a tiny smile. He's drawn three-quarters, facing right, lit from the top left, and exported as `SIDEKICK_TOWER_CLERK` (id "sidekick-tower-clerk", name "Clerk"). I rendered every animation, and the idle at phone size beside Boingo (`clown`) and the tiger; he's about the same size as both. The last render shows no edge warnings.

**Size and placement**
- **Frame:** 64 × 68 px. The foot point is (30, 65), and the bottom of his feet is at y 64.
- **Height:** 57 px from the ground to the top of his cap (y 8), 58 px counting the outline.
- **Face:** the eyes are 42–45 px above the ground (frame y 20–23) and the beak 39–43 px (y 22–26).
- **Bow tie:** 32–34 px above the ground (y 31–33).
- **Behind a 30 px counter** (counter top at y 35), you see his cap, face, bow tie and the top 2–3 px of his jacket. The bow tie clears the counter by only about 2 px, so if the counter ends up taller than 30 px, raise him a pixel or two.

**Animations, beat by beat**
- **idle** (30 frames, 3 s, loops): breathes by 1 px, a slow blink. His bow tie slips crooked, he reaches up with a flipper and straightens it, then gives a pleased squint. Then a small polite nod, eyes closed, and one more blink near the end.
- **walk** (6 frames, 0.6 s, loops): a waddle, rocking side to side with alternating feet lifted, both flippers out for balance. The cap moves with his head.
- **sit** (16 frames, 200 ms each, loops): perched on a wooden stool, feet dangling forward toward the board, flippers folded. He blinks slowly, and halfway through he leans in with eyes up as if thinking about a move.
- **wave** (11 frames, 1.2 s, plays once): eyes open, then a courteous wave with the far flipper (three positions, happy closed eyes). Then a small bow with eyes closed and a flipper folded, and back to idle.
- **entrance**: waddles in from the left, stops, a small bow, a happy look, then calm.
- **thinking** (loops): flipper to his chin, eyes up, a foot tapping, thought puffs rising, one blink.
- **move**: an "after you" sweep of the flipper toward the board, then the flipper folds.
- **capture**: a small hop with a flipper up and gold twinkles, a puff of dust on landing, he checks his bow tie, then a satisfied smirk.
- **hurt**: a grey flash and shake that pops his cap up crooked and knocks his tie askew. He winces, then tidies himself up.
- **check**: raises a flipper twice with a bright look and a gold "!", then a smirk.
- **smug** (loops): chin up, half-lidded eyes, a smirk, a flipper folded, a slow nod.
- **rattled** (loops): wide O_O eyes, a wobbly beak, trembling, cap and tie askew, sweat drops.
- **defeat**: a flash, his cap flies off, dizzy x eyes and a wobble. He topples onto his back and the cap lands on his tummy (the last frame holds 1 s).
- **victory** (loops): little hops while waving, gold twinkles all around.

**Choices you might want to change**
- **Taller frame:** I made it 68 px tall instead of the sidekicks' usual 64 (everything sits 4 px lower) so his hops and cap pops don't touch the top edge.
- **Which flipper waves:** he waves with the far flipper, which pops out to the right of his head. It's dark against the dark ground and reads mainly through the halo.
- **Sit posture:** in `sit` his head sinks into his shoulders so his cap stays in the frame. It's the same three-quarter view, not a strict side view.
- **Chin strap:** it's a 1 px gold line down his cheek; you could drop it if it looks busy.
- **Sound cues:** I tagged frames with "step", "wave", "whoosh", "ding" and "poof". "ding" (check, capture, victory) and "wave" are new names, so they need sounds mapped.
- **Defeat ending:** the lying frame comes from turning his standing pose on its side, so it reads more like a doll tipped over than a drawn fall.
