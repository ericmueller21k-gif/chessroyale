# The Hidden Boss's pieces in stereo at 192 kbps (Nov 14)

The same four themes as `../boss-music/`'s `recluse-*` (same pieces, same lengths, same `themes.json` entries and
marks), built in the format the game's music moved to on Nov 14:

    python3 scripts/reel/music/phases_v.py --stereo --kbps 192 <folder>     (branch claude/trailer-v2, at e774edfd)

They are here because `recluse-phase2`'s intro changed that day (a minute more of his stare before the build: see
`../boss-music/README.md`, "Nov 14"), so whichever format the game ships has the new intro ready. Against a stereo 192
build made before that change, only `recluse-phase2-intro` and its `themes.json` entry differ (`introSeconds`
118.887167, the new mark `calculation`: 70.0).

The other bosses' themes are not in this folder: `python3 scripts/reel/music/handoff.py --stereo --kbps 192 <folder>`
builds them.

## Nov 15: Babur's theme (`tiger`)

`tiger-loop.mp3` / `.ogg` (stereo, 192 kbps), and its entry in this folder's `themes.json`: one loop of **165.0 s**, no
intro piece (`introSeconds` 0), pad 0.5 as the others, -16.8 LUFS, peak -1.1 dBFS. Built by
`python3 handoff.py --stereo --kbps 192 <folder> tiger` from `scripts/reel/music/song_af.py` on `claude/trailer-v2`.
It is Eric's own plan for the song (written with another assistant), built as written; he heard it at two minutes and
said "that's so good ... I like the second one", then asked for it longer ("2 minutes and 30 seconds or 2 minutes and
45 seconds just plays. It's less repetitive"): this is the 2:45 one, the same sections with two of them longer. It
replaces the 120.0 s file of commit 43f2700f (same name: `loopSeconds` is what changed). The loop point is clean on
the built file (the climax falls into the quiet opening, as his plan has it).

## Nov 16: Chandy's theme (`chandy`)

`chandy-loop.mp3` / `.ogg` (stereo, 192 kbps), and its entry in this folder's `themes.json`: one loop of 155.844146 s
(2:36), no intro piece (`introSeconds` 0), pad 0.5 as the others, bpm 154, -16.8 LUFS, peak -1.1 dBFS. Built by
`python3 handoff.py --stereo --kbps 192 <folder> chandy` from `scripts/reel/music/song_ag.py` on `claude/trailer-v2`.
Eric's own plan for the song (a fast breakbeat with a saw lead and an organ solo), built as written; on hearing it: "It's
the new one, Chandy, that's being built right now, and it sounds great. Nothing to fix." The loop point is clean on the
built file. Chandy is not in the roster yet, so `chandy` is my guess at his id: rename the entry and the files if his
roster id is different.

## Nov 22: Chub & Chirp's theme (`hopper`)

`hopper-loop.mp3` / `.ogg` (stereo, 192 kbps), and its entry in this folder's `themes.json`: one loop of 129.920187 s
(2:10), no intro piece (`introSeconds` 0), pad 0.5 as the others, `bpm` null (its pace changes: the two takeoffs run
sharp, the calm is slower), -16.9 LUFS, peak -1.0 dBFS. Built by
`python3 handoff.py --stereo --kbps 192 <folder> hopper` from `scripts/reel/music/song_x.py` on `claude/trailer-v2`.
Eric's direction (Nov 13): night crickets, a tune that builds, a drop, an off-beat thumping, a big landing hop. He heard
the second go on Nov 13 and again on Nov 22: "Yes let's add that one". The built file is that go, sample for sample
(1.1 dB lower, the level the other themes are handed over at).
- The loop point is clean on the built file: the last bar's hop lands on bar 1's downbeat, then the night opens.
- The song has its own crickets and rabbit-foot thumps, shaped like the ones the game makes for this boss
  (`hopper-sounds.ts`). If they get mistaken for the fight's own sounds in play, say so and they come down or out.
- At 2:10 it is shorter than the 2:30 to 2:45 the later themes run: it is the length Eric approved.

## Nov 22: Smudgy's theme (`smudgy`)

`smudgy-loop.mp3` / `.ogg` (stereo, 192 kbps), and its entry in this folder's `themes.json`: one loop of **166.5 s**
(2:46.5), no intro piece (`introSeconds` 0), pad 0.5 as the others, `bpm` null (its pace changes), -16.0 LUFS, peak
-2.1 dBFS. Built by `python3 handoff.py --stereo --kbps 192 <folder> smudgy` from `scripts/reel/music/song_ao.py` on
`claude/trailer-v2`. Eric's direction (Nov 22): paint strokes and splatter, whimsical, calm but fast (about 172), a
slow 20-second opening, a build that pushes to about 226 and comes back. Third go; his verdict: "Yeah, this is the
one. This is the one." The built file is that go, sample for sample.

| From | What happens |
|---|---|
| 0:00 | the slow opening (half pace): soft piano, slow brush strokes, a music box, the violin low |
| 0:20 | the tune on the violin over the fast beat (about 172) |
| 0:43 | the piano has the tune; then the violin and the piano trade |
| 1:05 | the calm: no kit; a soft piano and a solo high on the music box (it rings like a glockenspiel) |
| 1:33 | a little waltz on the piano; the beat comes back |
| 1:44 | the rush: 172 up to about 226 |
| 1:53 | full speed (226): splats, the tune from 2:02 |
| 2:10 | one big splash; everything stops; drops |
| 2:13 | the tune in full, at 172 again |
| 2:35 | the tag, thinning into the slow opening |

- **The slow opening is part of the loop**, as Chub & Chirp's night and the tower's calm start are: the tag winds
  down into it, and the loop point is clean on the built file. Every pass replays those 20 seconds.
- The song has Smudgy's own sounds in it, shaped like the game's (`smudgy-sounds.ts`): splats (most of them from
  1:44 to 2:10), a brush's swish for the kit's cymbals, a swipe before each change of key, drips, and two quiet
  giggles (1:32 and 2:12). If any of them gets mistaken for the fight's own sounds in play, say so and it comes
  down or out.
- It is the calmest of the boss themes on purpose (his words: "a vibe of like a calmness, but still ... fast pace"):
  its quiet middle (1:05 to 1:33) is about 3 dB under the rest.

## Nov 23: Birdie's theme (`birdie`) and his ult's piece (`birdie-ult`)

Birdie isn't in the roster yet, so `birdie` is my guess at his id (his art is `boss-birdie`): rename the entries and the
files if it differs. Both are stereo 192 kbps `.mp3` and `.ogg`, with their entries in this folder's `themes.json`.

### The theme

`birdie-loop`: one loop of **136.296292 s** (2:16), no intro piece (`introSeconds` 0), pad 0.5 as the others, `bpm` 162
(steady all through: a bar is 1.481481 s), -16.5 LUFS, peak -1.2 dBFS. Built by
`python3 handoff.py --stereo --kbps 192 <folder> birdie` from `scripts/reel/music/song_aj.py` (the runaway train) on
`claude/trailer-v2`. Eric, Nov 23: "Going back to the Train version 4 song, that's going to be Birdie's song", with one
change, made here (the glockenspiel at 1:35 is out): "Other than that, I think the song's pretty much perfect." Checked:
it differs from the version he had only where the glockenspiel was; the loop point is clean on the built file. It
plays like any theme with no intro (Babur's, Chandy's).

### The ult's piece: the crossing

`birdie-ult-intro` (a 15.8 s file): the band drops to the song's own train beat, quiet, and over it a locomotive (its
exhaust, wheels on the rail joints, steam), a train whistle (two long blasts, a short, a long one sinking away) and
birds; its last two bars climb into a snare roll. It is not part of the theme's loop: it plays on a cue, once a fight
(Eric: "I don't think we actually want it playing more than once during the boss fight").

Its entry, `birdie-ult`, is shaped like the Hidden Boss's pieces: **intro** `birdie-ult-intro`, **`introSeconds`
14.814813** (ten bars), **loop** `birdie-loop` (Birdie's theme again, from its top), marks `whistle` 1.481481 and
`roll` 13.333333. -20.2 LUFS, peak -2.6 dBFS: built with the theme's own gain, so it sits about 5 dB under the
theme's verse and chorus (it "quiets down") and its last two bars are back at the theme's level.

### How Eric wants it wired (his words, Nov 23)

- When it starts: "we'll start this clip after the player gets a capture on the piece, which then triggers the back
  end to be like, okay, like enough material was captured. So then it will fade into this song".
- Where it ends: "at the end of your standalone clip where it sort of like finishes up, that's the part where ... it
  should line up ... right when ... the train kind of connects and the transformation happens".
- Birdie waits: "Birdie doesn't play his move right away. He basically times his next move to the exact moment where
  ... the end of that little ... clip ... right when the train light kind of hits and then he transforms. So we're
  basically delaying ... your AI or your computer move on this turn for a few seconds".
- Before it: "we can have him add a line to say".
- The full-screen animation of the train hitting is being built in another session (his words: "another chat"); it is
  shorter than the piece, so the piece starts first.

### What that comes to, with these files

1. **The drop is the impact.** This is `switchPlan` with a `dropAt`, as the Hidden Boss's boards split on one. Put
   the drop at the moment the train hits and he transforms. The piece then starts at `dropAt - 14.814813` s, what is
   playing fades from there, and the theme starts from its top exactly on the drop: its opening hits (the whole band,
   four bars of stabs and drum breaks) are the impact. The piece has no hit of its own at its end, on purpose: the
   theme's first bar is the hit. Their sum at the join is checked (peak -3.9 dBFS).
2. **The order of events:** the capture that fills the ult; a drop time at least 14.815 s ahead (plus whatever loading
   and the fade need); the music switches (the piece starts, a short fade from the theme: it opens on a burst of
   steam at once); his line; the full-screen animation starts at `dropAt` less its own time to the impact frame (that
   number comes from whoever builds it); the impact, the transformation and the theme's first hit together.
3. **His move waits for the drop.** His move on that turn, and the animation, are scheduled to the drop, not played as
   soon as the engine has the move: about 15 s from the capture to the impact. What his clock and the players' do
   meanwhile is yours to decide.
4. **Marks in the piece, for the visuals** (seconds from its start): 0.0 steam, the band drops, the first birds;
   1.48 the whistle's first blast (long, long, short, and a long one from 6.5 that sinks away by 9.3); 13.33 the snare
   roll starts; 14.815 the drop.
5. **If it can start on a bar line of the theme**, the beat carries across (both are 162; the theme's bars are every
   1.481481 s from its loop's start). Not needed: a plain short fade works, as the theme's own beat is going under it.
6. **After the drop** the theme runs from its top as a normal loop. If the transformed Birdie should have other music
   from there, change the entry's `loop`; nothing else moves.

Eric heard the piece by itself (with a drum hit where the theme now comes in) and a demo of this wiring: the theme's
chorus, the piece, and the theme from its top on the drop.

## Nov 27: the Stranger's theme (`stranger`)

`stranger-loop.mp3` / `.ogg` (stereo, 192 kbps), and its entry in this folder's `themes.json`: one loop of **160.0 s**
(2:40), no intro piece (`introSeconds` 0), pad 0.5 as the others, bpm 168, -16.4 LUFS, peak -1.2 dBFS. Built by
`python3 handoff.py --stereo --kbps 192 <folder> stranger` from `scripts/reel/music/song_ap.py` on `claude/trailer-v2`
at ebcbbb829. Eric, of this version: "this Gothic hybrid v3, you can change it to the stranger, because that's what the
boss is, and you can send it to the director to be wired into the stranger as his boss music."

- The loop opens on 17 seconds of one voice over a low tone, no beat (0:00 to 0:17), and that comes round each time
  the loop does: it is the song as he passed it. The last hit rings into it.
- **Credits.** This is the first theme with sampled sound in it: the voice, strings, flute, oboe, violin and bell are
  played from the song's own notes through the FluidR3_GM sound bank (Frank Wen; MIT license; Debian's
  `fluid-soundfont-gm`). The game's credits need a line for it. The drums, bass, guitars, lead and fast pattern are
  computed, as every other theme is.
- Rebuilding it needs `apt-get install fluidsynth fluid-soundfont-gm` (scripts/reel/music/sampled.py); the game needs
  nothing new: the files are plain MP3 and OGG like the others.
- Checked on the built files: the audio is the master Eric approved (correlation 1.00000); the loop point is clean on
  the MP3 and the OGG (the step across it is a fifteenth of the largest step nearby).
