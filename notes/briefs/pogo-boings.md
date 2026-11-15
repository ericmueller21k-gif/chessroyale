# Boingo's Pogo: a boing per square, on the hop (Eric, Nov 15), not a loop

Effort high (sound timing on the town's steps and frames). Targeted lane. New branch `claude/pogo-boings` from `origin/main`. Read
`CLAUDE.md`, `.claude/LESSONS.md`, `docs/areas/town-square.md` (rides, "Its moving sound"), `packages/app/src/ride-sound.ts`,
`docs/decisions/2026-11-14-ride-sounds.md` and `2026-11-15-pogo-rate.md`.

Eric, after riding the looped pogo: "the pogo's all wrong ... let's get rid of the fade in and fade out ... the moment I press the
button, it should be like boing, boing ... every time ... you go from one square to the next, it should be a boing ... they're going to
overlap each other, but that's fine ... the boing sound needs to line up with the frames of like when you're jumping and landing ...
there'll be a lot of boings and they'll be overlapping, but that's what actually it'll feel correct." (A tap moves 2 squares.)

He heard a sample and picked it ("Yeah, I like A"): `notes/ref/pogo-sample-A-tune-2026-11-15.mp3` on `claude/director-notes`. It has a
boing on every square at a square per 90 ms (a tap = 2 boings), the boings taking turns through the 4 pitches of the current loop (its
"little tune"). How it was cut: from `public/sounds/rides/boingo-pogo.wav` (24 kHz mono), the 4 boings start at 0.100, 0.350, 0.600,
0.850 s; each cut 0.245 s from 2 ms before its start, with a 6 ms fade at its end. Make those 4 one-shots (one small file with the 4 back
to back and their offsets, or 4 tiny files: whichever is simpler), at the same level as the loop's boings.

Build:
- The pogo stops being a loop: no fade in, no fade out, no hold timer, no `rate`. Each step of YOUR pawn on the pogo plays the next boing
  of the 4 (a, b, c, d, a, ...) as its own one-shot source, so they overlap freely. The dozer keeps its loop exactly as it is.
- Timing: the first boing plays on the press's first moving frame (no lag). Each boing lines up with the hop. Look at the pogo's move
  animation frames (`ride-cells.ts` "boingo-pogo" move: 12 frames, 880 ms; `components/rides/boingo-pogo.tsx`) and at where a square's
  step starts and ends (`world.ts` Walker, `youStepMs` 90). Put the boing on the step's moment that matches the jump (take-off or
  landing): say which and why, with a frame strip if it helps. If the drawn bounce doesn't happen once per square (the animation's cycle
  is far longer than a step), don't redraw the ride: report it with a frame strip so the director can take it to Eric (the characters
  lane).
- Schedule each boing on the audio clock at the step's time (not a setTimeout), from the frame loop's step events: no work per frame
  beyond "a step happened". Sound switch off / page hidden: nothing.
- Settings in `packages/core/src/settings.ts` (`RIDE_SOUND`): the pogo's kind (`steps`), its level, its boing offsets and length, and
  whether it fires on take-off or landing, so it's one place to tune. Remove what the loop-only pogo no longer uses; keep the dozer's.

Tests: unit (fake audio context, as `ride-sound.test.ts`): one boing per step, cycling 4, overlapping (a new one doesn't stop the last),
the first on the first step with no delay, a tap = 2 boings, standing = none, other rides and on foot silent, the dozer unchanged. The
rides e2e in `town.spec.ts`: pogo steps give one source per square (the dozer's check stays). Frame rate on phone if the frame loop changes.
Typecheck; app unit tests; the touched specs. Push at each real step; `.pr-body.md` (what changed, player-visible, settings, checks old ->
new); `.done`. No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only). About 1 hour.
