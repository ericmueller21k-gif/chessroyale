# The boss music plays clean: no muffling, no break when the sound is rebuilt (Eric, Nov 14 playtest)

Effort high (audio timing). Targeted lane. New branch `claude/music-clean` from `origin/main` (it has #691: `loopPlace`, the music
picked up where it was on a new audio context). Read `docs/areas/bosses.md` "Music", `docs/decisions/2026-11-11-boss-music.md`,
`2026-11-12-music-mono-preload.md`, `.claude/LESSONS.md` (sound), and `packages/app/src/sound.ts` around `ensureContext`,
`markStale`, `audioReturned`, `wakeAudio` (the Nov 3 Chrome silent-device fix: keep what it protects).

Eric: "it sounds much lower quality... I played the song in the Claude desktop, it plays so much more cleanly and clearer... we
can't compromise on these songs." And in the Hidden Boss's second form, a few minutes in: "all of a sudden it froze, stopped for a
second, and then it was almost like it restarted at a different part." He switches windows a lot while testing.

Found by the director (verify):
- **Muffled:** every sound, the music included, goes through `master` -> a 6 kHz low-pass (`soften`, "gentle on phone speakers")
  -> the speakers (`musicBus()` returns that master). The music should skip the low-pass: its own gain straight to
  `ctx.destination`, at the same level and still under the Music/Sound switches (music.ts `level()`). Keep the low-pass for the
  game's sounds.
- **The break:** the files' loop seams are exact (checked: the loop's end matches its start, best lag 0 ms). The break is the audio
  context being rebuilt after the window was away 2 s+ (`markStale("away …")` -> the next click `rebuildInTap`): the old music is
  cut at once and the new starts after `MUSIC.startDelayS`. Make it seamless: on a rebuild, start the music on the new context at its
  place first, and fade the old one out over ~300 ms after (if the old context was still sounding, nothing is heard; if it was dead,
  the new one simply comes in). Also say in the PR whether the "away" trigger is still needed beside the clock checks and
  `devicechange`, with the evidence (Nov 3's story is in the comment); don't remove it without a reason that holds.
- Not this job: the files' bitrate (mono 64 kbps since Nov 12): the songs' maker re-renders them; and the songs themselves.

Tests: unit tests in `packages/app/test/music.test.ts` / the sound tests for (1) music's path skips the low-pass, (2) a rebuild starts
the new before stopping the old, at the loop's place. Run the music/sound e2e specs `node e2e/ci-select.mjs files <paths>` lists.
Typecheck. Push at each real step; `.pr-body.md` (short: cause, fix, player-visible, checks old -> new); `.done`. No PRs, no CI
waits, no model names in commits (end commits with the Claude-Session line only). About an hour.
