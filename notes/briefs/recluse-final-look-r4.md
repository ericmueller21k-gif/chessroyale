# The Hidden Boss's final form, round 4: a mockup first (Eric, Nov 15)

Effort high (sprite art, animation, lighting: drawing work, Opus). Boss lane. New branch `claude/recluse-final-look` from main.
Never write the Hidden Boss's name in player text, commits or PRs (code names like `recluse` are fine).

Read first: `docs/areas/bosses.md` (his phase 2 look, the transformation), `.claude/LESSONS.md`, CLAUDE.md "Simple beats flashy",
and how round 3b shipped in #707 (the suit and helmet now live: `packages/app/src/components/Recluse.tsx` and its art; the mockup
lab from earlier rounds: `packages/app/src/dev/recluse-transform-lab.tsx`, `scripts/preview-recluse-transform.mjs`, on branch
`claude/recluse-transform-book`; its README and stills on `stills/recluse-transform-book`).

## Eric's words (Nov 15, after playing it)
"If I want to redo the Hidden Boss's final suit, I just played it ... It doesn't feel right still ... keep the face can stay the
same with the new glowing eyes ... his Iron Man style, which I think that's what I don't like either. Anyway, I want to now make it
so he's wearing a black trench coat and his hair is like now there's no more like helmet or whatever. His hair is just like always
like radiating up and like flowing now. And then he has like bolts of, he has like an aura field around him, and there's like a
pattern of like ones and zeros, like the binary ... spiraling around him in like a double like helix kind of spiral that is
spiraling around him with this aura. And could you maybe try to mock that up?"

## The look
- **Face:** his face as now, with the glowing blue eyes Eric picked Nov 14. No helmet, no visor, no suit.
- **Black trench coat:** long, past the knees, his own cut; it can sway a little in the aura's draft (cheap: 2 or 3 frames).
- **Hair:** always lifted and flowing upward (the light's push, now permanent), his own hair and color.
- **Aura:** a glow field round his whole figure, with small bolts (crackles) flicking in it.
- **Binary double helix:** tiny 1s and 0s on two strands spiraling round him inside the aura, turning (strands in front drawn over
  him, behind drawn under him). Cheap to draw: a few pixel glyphs per strand, looping.
- **Original design (required, CLAUDE.md "never copy famous characters"):** a black coat plus code and an upswept, glowing-aura
  hairdo are each close to famous looks. Keep it his own: no sunglasses, no falling green "code rain", glyphs in his blue (not
  green), no spiky golden hair, his own hair shape and color, no copied coat silhouette. Say in the README how it stays distinct.
- Everywhere his phase-2 look shows today wears it: his figure, the boss bar's bust, the four boards' figure, the reveal after the
  white-out. With no visor, his line ("Computation without creativity is nothing. Now I have both.") is said with his face showing,
  so the visor flip goes; list anything else round 3b's helmet drove (the flip's frames, timings) that becomes dead.
- Frame cost: phones first (Eric, Oct 14: "less lag over all else"). The aura, bolts and helix must stay inside the frame budget
  (`@perf` specs); if a full helix is too heavy, say so and offer a cheaper version.

## Mockup first
Stills: the full figure on the board (phone and computer), a close-up (front), the bar's bust, the four boards' figure, and the
reveal's first frame; one short GIF of the idle (aura, bolts, the helix turning, hair flowing, coat sway). About 10 images, no more.
Push them to `stills/recluse-final-look` with a README (what's drawn, the originality notes, the frame cost estimate), write
`.mockup` (content "round 4") to `claude/recluse-final-look`, and wait in one foreground Bash call
(`timeout 590 bash -c 'until git fetch -q origin claude/recluse-final-look && git show origin/claude/recluse-final-look:.go 2>/dev/null | grep -q round4; do sleep 30; done'`,
repeated, up to 3 hours) for the director's `.go` (it will contain "round4" and Eric's notes). A `.go` with "redo" means another
mockup round with the notes in it.

## On go
Pull main, build it in the game (solo and online, phone and computer), remove what the helmet look leaves dead, keep the boss kit
and the transformation's tests green; watch it frame by frame with real taps (`npm run frames:boss`) and run the `@perf` specs
(`npx playwright test --grep @perf --project phone`, under the shared e2e lock: the drawing changes); one still per platform;
update `docs/areas/bosses.md` and add a short decision note in `docs/decisions/`; `.pr-body.md` (what changed, player-visible,
checks old -> new); `.done`. No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only).
Push work in progress at each real step.
