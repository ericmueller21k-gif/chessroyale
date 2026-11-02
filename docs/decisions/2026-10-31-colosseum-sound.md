# The Colosseum's sound: Eric's arena ambience, streamed, and the crowd's cheer (Oct 31, 2026)

**Eric (Oct 30-31).** He listened to our candidates and kept cheer A. Then he chose his own track for the ambience:
a one-hour "Gladiator arena ambience" that he says is royalty free; licensing is his call. He also said: "some of
the clanging sounds … the highs need to come down … so they don't get as loud". He dropped shocked, boo, our beds
and our clangs; they are in git history at commits 7ae46b82 and c02749b8.

## What changed

- **`sounds/colosseum/ambient.mp3`** is his hour, processed by `scripts/crowd-sounds.py`.
  - The clangs are tamed by a fast compressor above 2 kHz. Their loudest 10 ms moments go from about 9 dB over the
    voices to about level with them.
  - A -5 dB high shelf makes them duller and farther.
  - A gentle broadband compressor evens out the rest.
  - It is mono, 22.05 kHz, 40 kb/s CBR, with no cover image: 18.0 MB, against 53 MB for the original. Its average
    sits 15 dB under a move.
- **`sounds/colosseum/cheer.mp3`** is cheer A: Quendel's CC BY 4.0 cheering with Sandermotions' CC0 applause. It plays
  as a captured queen's piece lands, with the crowd's jump. It is credited in Settings, the FAQ and the notice.
- **The gear's "Ambient crowd noise"** (still On by default) now plays the ambience. It streams through an `<audio>`
  element routed into Web Audio: it starts at a random point in the hour, loops at the end, fades in and out over
  1 s, pauses while the tab is hidden or the game's Sound is off, and starts on the next tap if the browser blocks
  autoplay.

## Calls made

- **Streamed, not decoded whole.** An hour decoded into Web Audio would be about 300 MB of memory on a phone. An
  `<audio>` element downloads only what plays, by Range requests.
- **CBR, so a seek lands anywhere.** With a constant bitrate, a random start costs one Range request.
- **The Worker answers the Range requests.** Cloudflare's asset server (as `wrangler dev` showed) sends the whole file,
  with a 200 and no length, even when a range is asked for. Without a fix, a phone would download everything before
  its random start, about 9 MB on average.
  - So the path is in `run_worker_first`, and `packages/server/src/ranged.ts` cuts the stream to the range as a 206,
    reading only up to the range's end. It never holds the file in memory.
  - The file's size is a constant, checked by a test against the file, because the asset server doesn't send it and
    a player needs it to seek.
- **The service worker leaves the file alone.** Precaching it would put 18 MB on every install, and Safari won't
  stream media through a service worker's reply.
- **40 kb/s at 22.05 kHz.** That lands in the 15 to 20 MB budget for the hour, and the game already low-passes
  everything at 6 kHz.
- **The cheer follows the game's Sound setting, not the ambient switch** (as the brief asked). It is fetched when the
  Colosseum opens, not with the samples every screen loads.
- **Frame rate: not measured.** Nothing here touches the drawing or the frame loop (eric.md asks for a measurement
  only then): the audio element, its gain and the cheer's one-shot run off the frame loop.
