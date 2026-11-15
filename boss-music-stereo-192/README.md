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

`tiger-loop.mp3` / `.ogg` (stereo, 192 kbps), and its entry in this folder's `themes.json`: one loop of 120.0 s, no
intro piece (`introSeconds` 0), pad 0.5 as the others, -16.7 LUFS, peak -1.1 dBFS. Built by
`python3 handoff.py --stereo --kbps 192 <folder> tiger` from `scripts/reel/music/song_af.py` on `claude/trailer-v2`.
It is Eric's own plan for the song (written with another assistant), built as written; he heard it and said "that's so
good ... I like the second one". The loop point is clean on the built file (the climax falls into the quiet opening,
as his plan has it).
