# The Hidden Boss's transformation, redone: the book's light, no King (Eric, Nov 14): MOCKUP FIRST

Effort high (animation, lighting). God-king/boss presentation lane. Mockup on branch `stills/recluse-transform-book` (never under
docs/); no game code until Eric says go. Read `docs/areas/bosses.md`, `.claude/LESSONS.md`, CLAUDE.md "Simple beats flashy" (reuse
what works). Never write the Hidden Boss's name in player text, commits or PRs.

Eric, after the cutscene (the man and the ghost of his child self talk in the spotlight, on the board): "when that's done, it kind of
glitches him back into the left area where he's standing, and then he steals the king's power. Let's write that off. Instead, since
he's already on the ground with the book, let's just make the book open up, and it radiates light out, and use that same lighting
that Fable did [the summoning's light in his room: `packages/app/src/town/shops/recluse-scene.ts`, its light beats: reuse that look],
it should look better. And then it just starts beaming him, and that's what makes him transform. One seamless transition. It still
has this zoomed-in look [the cutscene's spotlight/lens vignette], with the child standing next to him, while this is happening. Once
he turns into the cyborg version, it gets rid of the lens view, and then he jumps, and he does the board split, since he's already
standing in the middle of the board. We'll forget the whole king thing entirely." The God King stays (alive, unused), drawn as usual.

Today's code: `components/RecluseCutscene.tsx`, `recluse-cutscene.ts`, `screens/Recluse2.tsx`, `recluse-phase2.ts` (`absorbKing`,
the arcs `ARC_STRIKES`, `PHASE_CHANGE`), `characters/recluse.ts` (`RECLUSE_JUMP`), the phase-3 theme's `introSeconds` (the split
lands on the music's drop: `recluse-phase3`, `marks`; the split must still land on it).

Mockup: a GIF (and a few stills) of the new sequence from the cutscene's last line to the four boards, at the game's size, phone and
computer: the book on the floor at his feet opens, light radiates from it (the summoning's look), beams up into him, he becomes the
cyborg (his existing transformation frames, if they fit), the lens view lifts, the child fades, he jumps, the board splits under him.
Give its timing beat by beat (s), and how it lines up with `recluse-phase3`'s intro and drop. Push it, write `.mockup` to branch
`claude/recluse-transform-book`, and wait in one foreground Bash call
(`timeout 590 bash -c 'until git fetch -q origin claude/recluse-transform-book && git show origin/claude/recluse-transform-book:.go >/dev/null 2>&1; do sleep 30; done'`,
repeated, up to 3 hours) for the director's `.go` with Eric's answer. On go: build it in the game, remove the King's absorption (the
server/protocol pieces too, if any: list them), keep the boss kit and the split-on-the-drop test green; `.pr-body.md`; `.done`.
No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only).
