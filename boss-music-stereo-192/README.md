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
