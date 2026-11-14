# Town rides: a moving sound for two rides first (Eric, Nov 14, via the music session)

Effort high (sound timing in the town's frame loop). Targeted lane. New branch `claude/ride-sounds` from `origin/main`. Read `CLAUDE.md`,
`.claude/LESSONS.md`, `docs/areas/town-square.md`, and how game sounds play today (`packages/app/src/sound.ts`: the game's bus with the
Sound switch and page-hidden handling; not the music bus).

Eric: "we've got like riders for everyone in this town ... I need like a sound. So when you move around ... it sounds like ... a little
bulldozer moving ... I don't think we need an idle ... just like a moving sound ... one continuous sound." Of the two picks: "test this on
two of them here, and then we'll kind of go more. I want to move around with it and see how it feels ... when you stop moving, it doesn't
just like instantly stop ... it kind of fades over like a second or whatever ... I guess we'll have to test it."

Files: branch `stills/trailer-v2`, commit 563afd02, folder `ride-sounds/`: `sawyer-dozer.wav`, `boingo-pogo.wav`, `rides.json`,
`README.md` (read it). Mono WAV, 24 kHz, 1.2 s, 58 KB each; one loop of exactly 1 s with 0.1 s of itself either side:
`source.loop = true; loopStart = 0.1; loopEnd = 1.1; start(when, 0.1)`. Already low-passed. Copy them into the app's sound assets
(where the game's other sounds live; WAV kept so the loop is exact) and fetch/decode them like the other sounds (lazily, once, when
the town needs them; never blocking the town's load: #709).

Behavior (the music session's spec, to match):
- Only YOUR OWN pawn's ride, only while it moves on a ride that has an entry; standing: nothing. A ride with no entry stays silent.
  (Which ride is which: the town's ride/mount data; map `sawyer-dozer` and `boingo-pogo` to their rides; say how in the PR.)
- Moving = from its first step until `RIDE_SOUND.holdMs` (120) after its last (a step is 90 ms), so a turn or tap between steps never
  stops and restarts it. The loop keeps its own pace, never once per step.
- Start: fade in over `fadeInMs` (60). An `engine` ride also comes up to speed: playbackRate 0.8 -> 1 over ~300 ms. The pogo starts at
  its own speed.
- Stop: fade out over `fadeOutMs` (dozer 700, pogo 350); an engine sinks a little as it fades (playbackRate -> ~0.88).
- Moving again during the fade: ramp gain and speed back up from where they are; never restart from silence.
- Level: about gain 0.3 on the game's bus (the Sound switch and a hidden page silence it, as other game sounds).
- Every tunable in `packages/core/src/settings.ts` (`RIDE_SOUND`: level, holdMs, per-ride fadeIn/fadeOut, engine speeds) so Eric can tune
  by walking around. One source per ride at most; nothing per frame beyond reading "moving or not" (no new work in the frame loop's
  hot path beyond that).
Tests: unit tests for the moving/held/fade state (start, hold through a 100 ms gap, fade out, resume mid-fade without restart) with a fake
audio context, as `music.test.ts` does; one check in an existing town e2e that riding plays one looping source and standing still stops
it after the fade. Frame rate: measured once on phone if you touch the frame loop (`@perf`). Typecheck; app unit tests; the touched
specs. Push at each real step; `.pr-body.md` (what changed, player-visible, settings to tune, checks old -> new); `.done`. No PRs, no CI
waits, no model names in commits (end commits with the Claude-Session line only). About 1 to 1.5 hours.
