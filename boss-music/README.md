# Boss themes: the handoff for wiring them into boss battles (Nov 11)

Eric approved these in the music chat. Each is made in code (no samples, no AI audio; every tune original) by
`scripts/reel/music/` on branch `claude/trailer-v2`. `python3 scripts/reel/music/handoff.py <folder>` rebuilds this
whole folder (needs python3 with numpy, and ffmpeg).

| Boss (id) | Files | Intro | Loop | Status |
|---|---|---|---|---|
| Jefferson (`grex`) | `grex-intro`, `grex-loop` | 6.667 s | 113.333 s | Final (two minutes) |
| Big Boy (`bigboy`) | `bigboy-loop` | none | 60.0 s | Approved at one minute; a two-minute version may replace it |
| Hollow (`hollow`) | `hollow-intro`, `hollow-loop` | 6.0 s | 54.0 s | Approved at one minute; a two-minute version may replace it |

Ginger's (`gingerbread`) is not ready. Later songs and longer versions will keep these names and this shape, so
the wiring shouldn't hard-code lengths: read them from `themes.json`.

## The files
- Each piece comes as `.ogg` (Vorbis, about 110 kb/s) and `.mp3` (LAME V5, about 130 kb/s), 48 kHz stereo. Same sound;
  pick by what the browser decodes (MP3 decodes everywhere, iOS Safari included).
- All songs sit within half a dB of each other (about -16.5 LUFS) and peak under -1 dBFS, so one music volume fits all.
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
music's own; intro plus loop matches the full song (r 0.97 to 0.998); peaks -1.1 to -1.5 dBFS.

## Not decided here (the director's and Eric's calls)
Where the files live in the app and how they're loaded (they're 0.7 to 2 MB each: fetch a boss's theme when its battle
is picked, not at start-up); the music's volume against the game's sounds and the bosses' sound packs; a music on/off
setting beside mute; what plays when a battle ends or the app goes to the background; solo, raid and online alike.
