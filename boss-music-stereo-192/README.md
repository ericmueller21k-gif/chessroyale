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
