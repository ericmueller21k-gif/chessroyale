# Boss art: sidekick-birdie

- Model claude-opus-5-5, effort high, adaptive thinking. 21 turns, 17 renders.
- Spend: **$2.02** of the $5 cap (44 input, 112,545 cache-write, 1,691,691 cache-read, 55,980 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-birdie/sidekick-birdie.ts.
- Previews: scripts/boss-art/out/sidekick-birdie/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-birdie/looks/.

## Its notes

The bartender is drawn and every animation has been rendered and checked: idle and wave (the two the brief asks for) and also entrance, thinking, move, capture, hurt, check, smug, rattled, defeat and victory.

**Before shipping:**
- **id:** I used the brief's id, `"sidekick-birdie-bartender"`, exported as `SIDEKICK_BIRDIE_BARTENDER` with the name "Bartender". The file sits at `sidekick-birdie/sidekick-birdie.ts`, and the render tool warns that it expected the id `"sidekick-birdie"`. If the build ties the id to the file name, that's a one-line change.
- **walk and sit:** these are left out on purpose, as the brief says, but the render tool still flags them as missing.
- **Size check:** the brief's comparison sidekick (`sidekick-jefferson-sonnet-2`) isn't on the render tool's roster, so the phone-size checks showed the tiger and the Black Knight instead. I matched its scale from its code: a 64×64 frame, the same outline and halo, and the same pose rig. To check the counter, I also rendered the idle behind a temporary 31 px bar; that test animation has been removed.

**Size and placement (to put him behind the bar):**
- **Frame:** 52 × 60, feet at (24, 58). Row 58 is the ground; his toes are on row 57.
- **Height:** about 55 px from his feet to the top of his head (the head starts at frame row 3).
- **Face:** the eye is at rows 8–12, about 47–50 px above his feet; the beak is at rows 9–13, about 45–49 px up. His whole head is within rows 2–20, inside his top 24 px.
- **Bow tie:** rows 19–21, about 37–39 px above his feet.
- **Over a 31 px counter (top edge at frame row 27):** his head, the green-violet neck, the bow tie, the top of the red vest and the glass and towel all show. The apron, yellow buttons, apron ties and feet are hidden below the bar top.

**The look:** a plump blue-grey pigeon with the brief's colours. He has a big round head tipped slightly forward, one large warm-brown eye with a pale ring and a highlight, a pink blush, and a charcoal beak with a red-orange cere and a small upturned line at its corner. The green neck has two light pixels of shine and violet at its back edge. He wears a red vest with a V at the throat, two train-yellow buttons and a point at the front, a white apron with a waistband, folds and a bow tied at his back, and a charcoal bow tie with a yellow dot. The glass is a plain wine glass and the towel a plain white cloth, with no letters or numbers anywhere.

**Animations, beat by beat:**
- **idle** (loops, 32 × 125 ms = 4 s): the towel circles the glass in 4-step strokes, which he holds up in his far wing. He breathes, bobbing 1 px every second. At frames 10–13 he blinks slowly (half shut, shut, shut, half). At frames 22–25 he gives a small friendly nod: his head dips 1 then 2 px with smiling eyes.
- **wave** (plays once, 1.15 s): he sets the glass down at counter height, raises his near wing and waves twice with the towel flicking, beak open in a happy hello, then picks the glass up and goes back to polishing.
- **entrance:** he rises from behind the bar with the glass and towel, beams, and gives a nod hello. The first frames are cut off at the bottom of the frame on purpose (that part is behind the counter).
- **thinking** (loops): head tipped back, eye rolled up, towel at his chin, thought dots popping up beside him, one blink.
- **move:** he leans in and flicks the towel toward the board, then goes back to polishing.
- **capture:** two happy hops with the glass lifted and the towel waving, a glint and twinkles, ending on a pleased look.
- **hurt:** a white flash and a jolt, eye screwed shut, head knocked back, a feather drifting off; then a worried look, a blink, and a smile.
- **check:** two brisk points of the towel at the board, then a pleased look.
- **smug** (loops): half-closed eyes, a slow polish, a glint on the glass.
- **rattled** (loops): wide eye, worried brow, sweat drops, polishing far too fast, trembling.
- **defeat:** a flash, dizzy X eye, and he sinks down behind the bar with his head drooping. The towel lands on his head and the last frame holds. The bottom of the frame is cut off on purpose here too.
- **victory** (loops): he raises the glass in a toast and waves the towel, with small hops, glints and twinkles.

**Choices you might want to change:**
- **Head height:** his head never goes above its rest position, because there is only one spare row at the top of the frame. Hops raise his body into his neck instead.
- **Wings:** both wings are drawn as arms (a pale bar, dark tips). The near wing crosses his chest while he polishes, which covers some of the vest; that only matters below the counter.
- **One eye:** I drew him in pigeon profile with a single eye rather than two.
- **Sounds:** cues are `"flap"` (wave, move, check, capture, victory) and `"poof"` (hurt, defeat). Nothing plays them yet; they need sounds in his kit.
