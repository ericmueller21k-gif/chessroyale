# The boss music at full quality: stereo, 192 kbps, and nothing colors it (Nov 14, 2026)

Eric (Nov 14): "it's ruining the music… let's just go ahead and fuck the filter and the compression." He hears the songs clean
in his music chat and muffled in the game.

- **What the game does to the sound, read in a real browser** (Chromium, the built app, Jefferson's battle; `AudioNode.connect`
  wrapped before the app loads): each music source → its gain (`MUSIC.volume`, 0.25) → `musicOut` (the master's 0.9) → the speakers.
  No filter, no compressor, no duck. playbackRate 1, detune 0. Every music path (battle, room, splash, the rebuild's handover) goes
  through `startPlan` into `musicBus().out`, so this is the only path. e2e/grex.spec.ts now checks it.
- **Sample rate:** the files are 48 kHz. The test browser's context ran at 44.1 kHz, so `decodeAudioData` resampled them once, as it
  decodes. That's fine and not audible; a 48 kHz device plays them as they are.
- **Re-rendered from the songs**, never re-encoded: stereo, constant 192 kbps (`handoff.py --stereo --kbps 192`, `phases_v.py` the
  same, on `claude/trailer-v2`). Lengths unchanged; each level within 0.3 dB of before (measured as heard: a mono file plays on both
  speakers); every loop seam best lag 0 ms. themes.json: only the recorded `lufs`/`peakDb` moved (by 0.1 to 0.9 dB).
- **Cost:** all themes 17.3 → 52.0 MB; the town's preload (all but the Hidden Boss's) 14.8 → 44.4 MB, about 20 → 59 s at 6 Mbps. The
  town still waits at most 3 s (`MUSIC.townWaitMs`), and the rest lands behind it. Decoded, a two-minute theme is 22 → 44 MB (stereo),
  one theme at a time as before.
- **Stale builds:** pages are fetched fresh (network-first) and the worker updates itself (skipWaiting, claim), but the music is
  cache-first. So the first open after a deploy can still play the old files. The old worker answers until the new one takes over, and
  then the old copies are dropped. **A player who wants the new build closes the app (or tab) fully and opens it again, twice.** Call
  made: the worker's version now hashes `/music/` too (vite.config.ts), so a deploy that changes only a song still drops the old copies.
  Before, that happened only because the bundle carries the commit.
