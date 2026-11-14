# The boss music at full quality: stereo, 192 kbps, and proof nothing colors it (Eric, Nov 14)

Effort medium. New branch `claude/music-hq` from `origin/main`. Read `packages/app/public/music/README.md`,
`docs/decisions/2026-11-12-music-mono-preload.md`, `docs/decisions/2026-11-14-music-clean.md`, `packages/app/src/music.ts`,
`packages/app/src/sound.ts` (`musicOut`, `musicBus`).

Eric: "it's ruining the music… let's just go ahead and fuck the filter and the compression." He hears the songs clean in his music
chat (even its 64 kbps samples), and muffled in the game, live, after #697 (which sent music around the 6 kHz low-pass). Two jobs:

1. **Prove what the game does to the sound, and fix anything found.** In a real browser (Playwright, the live-like build), start a
   boss's music and inspect the actual Web Audio graph from each music source to `ctx.destination` (wrap `AudioNode.prototype.connect`
   before the app loads, or similar): list every node on the way. Expected after #697: source -> gain -> musicOut -> destination, no
   filter. If anything else is there (a filter, a compressor, a duck, a second low-pass on some path: the room's music, the splash's,
   the carried handoff, the town's), remove it from music's path. Also check the level (MUSIC.volume × the master's 0.9) and any
   playbackRate / sample-rate mismatch (48 kHz files on a 44.1 kHz context are resampled by the browser: fine, but say so). Also check
   the service worker can't keep serving an old app bundle after a deploy (Eric may be hearing an old build): say what a player must do.
2. **Re-render every theme at full quality** with the songs' own hand-over script: on branch `claude/trailer-v2`,
   `scripts/reel/music/handoff.py` (MONO = True and `-b:a 64k` since Nov 12). Render with **MONO = False** and **constant 192 kbps**
   (`-c:a libmp3lame -b:a 192k`), from the songs (never re-encode the existing MP3s), every theme in `packages/app/public/music/themes.json`
   (the Hidden Boss's four too). If the script needs a flag instead of an edit, add one (`--stereo --kbps 192`) on `claude/trailer-v2`
   and push it there. Copy the new MP3s into `packages/app/public/music/`, update `themes.json` only if a length changed (it shouldn't).
   Verify each loop seam (decode with ffmpeg; correlate the loop's start window with the window at loopEnd: best lag 0 ms) and each
   level (LUFS within 0.5 dB of before). Report the total download size before -> after (the town fetches every theme but the Hidden
   Boss's during its loading bar; say how long that adds at 6 Mbps), and the decoded memory per theme.
Update the music README ("mono at 64 kbps since Nov 12" -> stereo 192 kbps, Eric Nov 14) and a short decision note.
Tests: the music unit tests; `e2e/sound.spec.ts` and the music e2e (`ci-select`). Push at each real step; `.pr-body.md` (what the graph
showed, what changed, sizes, seams; checks old -> new); `.done`. No PRs, no CI waits, no model names in commits (end commits with the
Claude-Session line only). About an hour.
