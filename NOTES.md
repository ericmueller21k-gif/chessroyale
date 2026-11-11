# A soundtrack for the landing reel, two ways (samples for Eric)

One original theme, written note by note in code (`src/score.py`), played two ways. No AI audio, no recordings of anyone,
no known tune. Both are 25.3 s, the phone reel's length, and loop without a gap.

| | Listen | Watch with the reel |
|---|---|---|
| 1. Chiptune | `reel-chiptune.ogg` / `.mp3` | `reel-chiptune-with-reel.mp4` |
| 2. Orchestra | `reel-orchestra.ogg` / `.mp3` (the written notes: `reel-orchestra.mid`) | `reel-orchestra-with-reel.mp4` |

The `-wide` files are the same tracks for the computer reel (25.43 s: the same notes a hair slower).

## The music
- **Tempo and key:** 151.8 beats a minute, 16 bars of 4/4 (64 beats fill the reel exactly). D minor; the town is in F major,
  Transcendent lands on D major.
- **Timed to the picture** (phone reel; beat 0 sits 0.25 s in, so the cuts fall on beats):

  | Time | Picture | Music |
  |---|---|---|
  | 0.25 s | 50 v 50 | the fanfare, full on, a drum fill into the town |
  | 3.4 s | the town | lighter: a bouncy tune, a hopping bass, off-beat chords, no snare |
  | 9.7 s | Big Boy's swirl | a climbing line and a roll that grows |
  | 11.3 s | "A boss appears" | the hit, then his low stomping tune (with a cheeky wrong note) |
  | 12.9 s | ranked | the fanfare again over a driving march |
  | 17.25 s | the ranks shuffle up | a rising run, one note per rank, quickening exactly as the ranks do |
  | 19.2 s | Transcendent | a bright D major burst with a cymbal and a sparkle, ringing out |
  | 20.8 s | the Hidden Boss | a drop to a low held D with an E flat leaning on it, nearly silent; one high "glint" at 23.8 s |
  | 24.8 s | fade to black | a roll swells and two pickup notes cross the loop point back into the fanfare |

## 1. Chiptune (`src/chip.py`)
Every sample is computed, the way `packages/app/src/characters/synth.ts` makes the bosses' sounds: two pulse-wave voices
(the lead and a quick broken-chord voice), a 16-step triangle bass, and noise for the drums, cymbal and the Hidden Boss's
breaths, plus a small echo on the lead. No samples and no files, so no license. It could later be ported to the game's own
synth and made in the browser (no download), if Eric picks this one.

## 2. Orchestra (`src/orch.py`)
The same notes arranged for trumpet, French horns, trombones, strings (held, short, pizzicato and tremolo), contrabass,
timpani, a choir pad, flute, piccolo, harp, glockenspiel, a tubular bell and percussion; written out as a standard MIDI
file and played by **FluidSynth 2.3** (free music software, LGPL; a tool we run, nothing of it ships) through the
**FluidR3_GM** sampled-instrument library by Frank Wen, **MIT license** (Ubuntu package `fluid-soundfont-gm`; its
`copyright` file: "I hereby release Fluid under the MIT license"). MIT allows use in a commercial game; if this track
ships, add FluidR3_GM's copyright line to `LICENSES.md`.

## Mix and loudness
Both are mastered to **-16.0 LUFS** (measured with ffmpeg's EBU R128 meter), peaks at about -1.2 dBFS (chiptune) and
-1.5 dBFS (orchestra), no clipping. The gain is fixed and the ceiling works on each sample alone, so the loop point isn't
touched; whatever rings on past the end (echo, reverb) is folded back onto the start.

## To know
- **Looping:** the `.ogg` loops gaplessly. An `.mp3` always carries a few milliseconds of padding, so for a perfect loop
  play the `.ogg` (or decode with Web Audio), or put the sound inside the reel's own video file as in the `-with-reel` samples.
- **Wide reel:** its cuts sit up to 0.08 s from the stretched track's beats (Transcendent 19.32 s in the music, 19.40 s in
  the picture): close enough to read as on the beat.
- I couldn't listen to the result: levels, the timing of the hits and the loop were checked by measurement
  (`src/levels.py`, onsets, a spectrogram), the notes and the balance by ear only on paper. Expect to want a balance tweak or two.
- **Rebuild:** `src/build.sh <hunchess-reel.mp4> <hunchess-reel-wide.mp4>` (python3 with numpy, ffmpeg, fluidsynth,
  FluidR3_GM.sf2). Change a note in `src/score.py` and both tracks follow.
