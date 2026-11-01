# Boss art: sidekick-blitz

- Model claude-opus-5-5, effort high, adaptive thinking. 34 turns, 22 renders.
- Spend: **$2.42** of the $4.5 cap (70 input, 132,157 cache-write, 3,056,530 cache-read, 57,154 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-blitz/sidekick-blitz.ts.
- Previews: scripts/boss-art/out/sidekick-blitz/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-blitz/looks/.

## Its notes

I've drawn Blitz's sidekick (id "sidekick-blitz", exported as `sidekickBlitz`): a tiny, sleepy tortoise with Blitz's chess clock strapped to its shell. I rendered and looked at all 14 animations; most at 4x, with walk, entrance and the hurt strip seen at 2–3x. After my last fixes I re-rendered idle, wave, sit, entrance, hurt, rattled, check, move and smug, so not every animation was checked again after its final change.

**The look.** The frame is 70 x 52 with the feet at (26, 49). It stands about half the height of the gingerbread boss beside it. The shell is a warm brown dome of chunky plates over a rim and a cream belly. The clock rides on top: it's Blitz's own, white with two faces, ticks only, two dark buttons and the red flag, with no letters or numbers anywhere. Two orange straps with teal buckles hold it on, and it wears a teal sweatband with an orange stripe. It has a sage-green wrinkly head on a short stretchy neck, heavy-lidded eyes, a flat mouth and four stubby feet with pale toenails. It faces our right, lit from the top left, with Blitz's outline colour and a faint halo. At phone size the shell, the white clock and the face all read.

**Animations, beat by beat:**
- **idle** (loops, 3.6 s): a slow breath; a slow blink; the head droops 3 px as the lids fall and two sleepy bubbles float up; it jerks awake with its eyes open and the clock hops 1 px; back to sleepy; the flag twitches once.
- **walk** (loops, 1.2 s): it lifts one foot at a time (near front, far back, far front, near back), and the body and head dip as each foot lands. The clock wobbles side to side and the flag flicks. A "step" cue plays on each landing.
- **sit** (loops, 4.4 s): it lies flat on its belly, and the clock is set down on the table in front of it, under its chin. It breathes, gives a slow blink and dozes a moment. Then it slowly reaches out a front foot, presses the left button (a "ding" cue and a spark) and draws the foot back.
- **wave** (once, about 1.55 s): it slowly raises a front foot beside its head, waves it three times with a tiny smile and a blush, closes its eyes contentedly as the clock dings (spark on the right button), then settles back.
- **entrance:** it starts as a shell with a clock, its head and legs pulled in and the flag down. The legs come out, the head creeps out over about a second, it looks around sleepily, then the flag pops up with a ding.
- **thinking** (loops): chin up, eyes rolled up under the lids, thought dots growing into a little cloud, one foot shifting, one blink.
- **move:** it stretches its neck out toward the board with a little smirk, steps a front foot forward, then draws back.
- **capture:** a slow open-mouthed reach, a chew with sparkles, then a little smile as the clock dings.
- **hurt:** a flash and a shake. The head ducks into the shell, the legs half tuck and the clock jolts with the flag flipping. Then it peeks out wide-eyed and settles back to sleepy.
- **check:** its eyes open properly, it lifts a front foot high, and the clock dings with a big spark while it smirks.
- **smug** (loops): heavier lids, a smirk, chin up, a slow nod, the flag flicking once.
- **rattled** (loops): wide awake for once, with small pupils and a wavy mouth. It trembles, the clock rattles, the flag flaps and sweat drops fly.
- **defeat** (last frame holds): a jolt, then it pulls everything into its shell, the flag drops and sleepy bubbles rise. It goes to sleep rather than looking sad.
- **victory** (loops): slow happy stomps with contented closed eyes, the clock dinging on alternate buttons, sparkles around it.

**Choices you might want to change:**
- **Sit:** the clock comes off the shell and sits on the table in front of it, because it can't reach a clock on its own back. In that pose the flag is mostly hidden behind its head. If the game draws its own table or board, the clock's spot (`clockAt` for `sit`) may need moving.
- **Check and wave:** the raised foot doesn't actually reach the clock on its back. The clock just dings when the foot goes up. Only the sit loop shows a real button press.
- **Withdrawn into the shell** (entrance, defeat): a sliver of the head still shows at the front of the shell, which I kept as peeking.
- **Frame width:** the frame is 70 wide rather than 64 so the stretched neck in move, capture and check doesn't touch the edge.
- **New cues:** "ding", "chomp" and "step" are cue names a sound kit would need to supply. "poof" is used by other characters.
- **Style:** the far eye is a small simplified shape. Sleepy and dozing are shown with lids and grey bubbles, with no text.
