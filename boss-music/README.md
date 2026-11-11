# Boss themes: the handoff for wiring them into boss battles (Nov 11)

Eric approved these in the music chat. Each is made in code (no samples, no AI audio; every tune original) by
`scripts/reel/music/` on branch `claude/trailer-v2`. `python3 scripts/reel/music/handoff.py <folder>` rebuilds this
whole folder (needs python3 with numpy, and ffmpeg).

| Boss (id) | Files | Intro | Loop | Status |
|---|---|---|---|---|
| Jefferson (`grex`) | `grex-intro`, `grex-loop` | 6.667 s | 113.333 s | Final (two minutes) |
| Big Boy (`bigboy`) | `bigboy-loop` | none | 120.0 s | Final (two minutes) |
| Hollow (`hollow`) | `hollow-intro`, `hollow-loop` | 6.0 s | 114.0 s | Final (two minutes) |
| Folio (`folio`) | `folio-intro`, `folio-loop` | 24.545 s | 95.455 s | Final (two minutes; its intro is the soft opening, the loop starts on the first drop) |
| Don Dough (`zebra`) | `zebra-intro`, `zebra-loop` | 6.857 s | 113.143 s | Final (two minutes) |

Ginger's (`gingerbread`) is not ready. Later songs and longer versions will keep these names and this shape, so
the wiring shouldn't hard-code lengths: read them from `themes.json`.

## The files
- Each piece comes as `.ogg` (Vorbis, about 110 kb/s) and `.mp3` (LAME V5, about 130 kb/s), 48 kHz stereo. Same sound;
  pick by what the browser decodes (MP3 decodes everywhere, iOS Safari included).
- All songs sit within a dB of each other (-16.0 to -16.8 LUFS) and peak at about -1 dBFS, so one music volume fits all.
- `themes.json`: per boss id, the pieces' names, `introSeconds`, `loopSeconds`, `bpm`; and `pad` (0.5 s).

## How to play one (Web Audio)
The intro plays once and the loop repeats; a song with no intro (`"intro": null`) is just the loop.

- **The intro file is longer than `introSeconds`**: it carries about 4 s of its own tails (echo, crackle) that ring
  on over the start of the loop. Don't wait for it to end: start the loop at `t0 + introSeconds` and let the two overlap.
- **The loop file has `pad` seconds of extra audio at each end** (the loop's end before it, its start after it). Loop
  between `pad` and `pad + loopSeconds`, never the whole file: the loop is then seamless whatever silence a decoder
  adds at the file's ends (MP3 does).

```ts
const t0 = ctx.currentTime + 0.05;
if (introBuffer) { const a = ctx.createBufferSource(); a.buffer = introBuffer; a.connect(musicGain); a.start(t0); }
const b = ctx.createBufferSource();
b.buffer = loopBuffer; b.loop = true; b.loopStart = pad; b.loopEnd = pad + loopSeconds;
b.connect(musicGain);
b.start(t0 + introSeconds, pad);
```

An `<audio loop>` element won't do: it loops the whole file (the pads would repeat) and gaps on most phones.

## Checked
Decoded from the MP3 and OGG and played back in a simulation of the above: no step at the loop point bigger than the
music's own; intro plus loop matches the full song (r 0.97 to 0.998); peaks -0.9 to -1.4 dBFS.

## Not decided here (the director's and Eric's calls)
Where the files live in the app and how they're loaded (the loops are about 1.7 to 2.1 MB each: fetch a boss's theme when its battle
is picked, not at start-up); the music's volume against the game's sounds and the bosses' sound packs; a music on/off
setting beside mute; what plays when a battle ends or the app goes to the background; solo, raid and online alike.
