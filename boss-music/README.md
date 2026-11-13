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

## The Hidden Boss (`recluse`): four themes, one for each point of his fight (Nov 13)

Eric's plan: his house's music while he is a child; the score when the child is beaten; the childhood music again only when
that form is beaten and he talks; the music going wrong as he transforms; the big part dropping as the boards split, then
looping, the childhood music never again. A fight can last any length, so each is a theme like any boss's (an intro or
none, and a loop), played by the same rules as above with no change to them. What's new for the game is only *switching*
from one theme to the next.

| Theme (key in `themes.json`) | When it starts | Intro (once) | Loop |
|---|---|---|---|
| `recluse-house` | walking into his room; it carries on through the fight with the child | none | the house's minute, 60.0 s |
| `recluse-phase2` | the child is beaten | the stare, the build, the flag: 58.870 s | the chant, the duel, the book, the build again: 89.276 s |
| `recluse-beaten` | that form is beaten: he talks | the book slammed shut: 1.815 s | the house's minute again (the same file as `recluse-house`'s) |
| `recluse-phase3` | his transformation starts | the music souring, then a pause: 19.293 s. **It ends on the drop: the boards split at t0 + `introSeconds`** | the big chant to the score's end: 88.371 s |

**Switching:**
- `recluse-house` to `recluse-phase2`: fade the house out (about 1.5 s), then start the theme.
- to `recluse-beaten`: whatever is playing (the intro too, if the fight was short), fade it fast (about 0.3 s) and start
  the theme at once: it opens on a book's slam, which covers the cut. Its loop runs for as long as the talk does.
- to `recluse-phase3`: as the transformation starts, start the theme at once at full level and fade the house's loop
  out over about half a second. Its intro begins with the childhood music's last chord still ringing, so it joins the
  loop wherever that is.
- The result: as for any boss.

**The one length that has to match:** from the transformation's start to the boards' split is `recluse-phase3`'s
`introSeconds` (19.293 s now; `marks.pause`, 16.631 s in, is where the music stops for a tick and the book: `marks.drop`
is the same as `introSeconds`). Read it from `themes.json`. If the animation wants another length, say what it is and the
music is made again to fit (`phases_v.py`, about ten minutes): never stretch or cut the audio in the game. The talk can be
any length, and its text's pace can change freely.

**Levels:** one music volume fits all four. The house's loop is 6 dB under the other themes on purpose (-22 LUFS; it is
that far under in the score), so nothing in the game needs a gain of its own.

**The files:** mono, 48 kHz; `.mp3` at 64 kbps (the ones to ship), `.ogg` too. 2.5 MB of MP3 in all. An intro here stops
dead at its `introSeconds` (it has no tail of its own: each loop begins with the ring of what led into it), which the
usual rule, the loop at t0 + `introSeconds`, already plays right. Rebuilt by `python3 scripts/reel/music/phases_v.py
<folder>` on `claude/trailer-v2` (its notes have Eric's words and the calls made).

**Checked:** each theme decoded from its MP3 and played as above in a simulation: no step at an intro's end or a loop's
point bigger than the music's own; peaks -0.3 dBFS or lower.

**Calls made here, Eric's to reverse:** phase 2 keeps the score's first half and phase 3 its second (the drop brings
music the player hasn't heard); phase 2's loop goes round through the build each time; the talk has the house's loop,
so its length is free. The whole score as one piece (3:58, `track-V`) is not here: nothing in the fight plays it whole.

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
