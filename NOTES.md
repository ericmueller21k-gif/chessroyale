# The landing reel's music: two samples

Two ~25 s tracks scored to the landing reel (PR #628, `claude/landing-reel`). They use the same original theme and the same
timing, so the only thing to compare is the sound. Both were written note by note in code. Neither uses AI audio.

| | Chiptune | Orchestra |
|---|---|---|
| Watch with sound | `hunchess-reel-chiptune-with-reel.mp4` | `hunchess-reel-orchestra-with-reel.mp4` |
| Audio | `hunchess-reel-chiptune.ogg` / `.mp3` | `hunchess-reel-orchestra.ogg` / `.mp3` |
| Made with | the game's own sound blocks (`packages/app/src/characters/synth.ts`) | MIDI written in code, played by FluidSynth through the FluidR3 GM soundfont |

`wide/` has the same two tracks re-timed to the computer reel (`hunchess-reel-wide.mp4`, whose cuts land up to 0.17 s later), with
their own muxed MP4s. `midi/` has the orchestra's MIDI files, which open in any notation or DAW program (MuseScore, GarageBand, …).

## The music
- **Key and tempo:** D major at 150 bpm (148 on the wide reel). The boss and ranked switch to D minor at 144 bpm, and the
  Hidden Boss is unmetered.
- **The theme (original):** D A D E F# | G F# G A. It comes back in D minor for ranked (D A D E F | D F D Bb).
- **Timed to the cuts.** Every note is placed at an absolute time worked out from the clip lengths in
  `scripts/encode-demo.sh`. The tempo is chosen so that bar 8's downbeat falls on the boss's first frame.

| Reel (phone, s) | Scene | Music |
|---|---|---|
| 0.00 | 50 v 50 | The theme over driving 8th notes and a crash. Bar 2 builds into a 16th-note snare roll. |
| 3.19 | The town | Lighter and staccato over an oom-pah bass (flute in the orchestra, a 25% pulse on the chip). |
| 6.39 | Big Boy's card | A cheeky B-flat stab, half a step above the tune, then C, then home. |
| 7.33 | His Crib | The card's C stabs carry on; at 7.99 a toy box starts: bells and celesta over plucked bass. |
| 9.58 | The swirl | Chromatic chords climb over a low A, with a snare roll, a timpani roll and a cymbal swell into the hit. |
| **11.18** | "A boss appears" | **The hit:** a tutti D minor chord with timpani, crash and choir. Two low A's lead into ranked. |
| 12.23 | Ranked 1 v 1 | The theme in D minor on horns, with 8th-note strings and drums on the beat. |
| 17.23 | The ranks shuffle up | One rising note per rank, on the reel's own hold times (380 ms down to 170 ms), over an A pedal and a growing roll. |
| **19.23** | Transcendent | **The stinger:** a big D (add 9) chord, bells running up, crash and timpani. |
| 20.58 | The Hidden Boss | **The drop:** a deep boom, a held low D and a dark pad (D, F, then A-flat), his eye's glint (a high E-flat) and two heartbeats. It sits about 15 dB under the rest, close to silence under "…and the most powerful of them all". |
| 24.50 | Loop | A roll and three pickup notes (A, B, C#) that land on bar 1's D when the reel starts again. |

**Loop-clean.** Each track lasts exactly as long as its reel (25.300 s phone, 25.433 s wide). The reverb and echo tails that run
past the end are mixed back onto the start, so the loop has no gap and no sudden cut.

**Levels.** Both tracks are -16.0 LUFS integrated, with the true peak under -1.4 dBTP (look-ahead limiter, nothing clips), 24-bit /
48 kHz before encoding. The OGG is Vorbis q6; the MP3 is 192 kbps.

## How each was made
**Chiptune** (`scripts/reel/music/chiptune.ts`). It plays `score.ts` on chip voices built from synth.ts's `osc`, `lowpass`,
`bandpass`, `noise` and `render`, the same blocks the bosses' sounds use:
- a 12.5% / 25% / 50% pulse lead with a delayed vibrato and a small slide into each note;
- chords as a fast pulse arpeggio, a new note every 2 frames at 60 Hz;
- a 4-bit stepped-triangle bass;
- noise drums: a kick from a triangle pitch drop, a band-passed snare, high-passed hats and crash, and a swept noise swell;
- a dotted-8th ping-pong echo.

It uses no samples and no licenses. Because it's pure code it could also play live in the game later, which would add no download.

**Orchestra** (`scripts/reel/music/orchestra.ts`). It arranges `score.ts` for 16 MIDI channels:
- strings (sustained and tremolo), pizzicato, cellos and contrabasses;
- trumpet, French horns and a brass section;
- timpani, glockenspiel, celesta and flute;
- choir "ah" and "oo";
- the orchestra drum kit (concert bass drum, snare, cymbals) and a reverse cymbal. The reverse cymbal is keyed so its swell
  peaks on each hit (the higher the key, the faster it plays; measured per key).

It writes a standard MIDI file, which **FluidSynth 2.3** plays through the **FluidR3 GM** soundfont with its own hall reverb.
`master.py` then wraps the loop, sets the loudness and encodes.

**License.** FluidR3_GM.sf2 is © 2000–2002, 2008 Frank Wen and released under the **MIT license** (Debian/Ubuntu package
`fluid-soundfont-gm` 3.1, `/usr/share/doc/fluid-soundfont-gm/copyright`: "I hereby release Fluid under the MIT license"). MIT allows
commercial use. To be safe, add a credit line wherever the game lists its credits: "Orchestral samples: Fluid R3 GM soundfont ©
Frank Wen, MIT license". FluidSynth (LGPL-2.1) is only the tool that played the notes: nothing of it ships, and its output isn't
covered by its license. The chiptune uses only our own code.

## Rebuild or change it
`scripts/reel/music/` goes into the repo at the same path. To render both tracks for one reel:

    scripts/reel/music/render.sh <out dir> packages/app/public/media/hunchess-reel.mp4 phone

The script needs `fluidsynth`, `fluid-soundfont-gm`, ffmpeg, and python3 with numpy and scipy. A render takes about 10 s. To
change a note or a level, edit `score.ts` (shared by both tracks) or the arrangement table at the top of `orchestra.ts`. After a
new reel recording, update the cue times in `score.ts` (`PHONE` / `WIDE`).

**Using it on the landing page.**
- Muting the reel's own audio track (as the `-with-reel.mp4` files do) is the simplest option: the sound stays in sync and loops
  gaplessly with the video.
- If you use a separate file instead, use the OGG or a WAV. The MP3 is 44 ms longer than the reel because of encoder padding, so
  it won't loop cleanly.
- Safari doesn't play every OGG, so iPhones need the AAC track in the MP4.
