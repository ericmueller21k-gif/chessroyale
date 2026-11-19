# Boss music

Each boss's battle theme: an intro played once, then a loop until the battle's result (`src/music.ts`;
docs/decisions/2026-11-11-boss-music.md; docs/areas/bosses.md, "Music"). A boss not listed in `themes.json` plays no
music. Made in code by `scripts/reel/music/` on branch `claude/trailer-v2` (no samples, every tune original).

## Adding a boss's theme (no code change)

1. Take the boss's pieces from the music handoff (`boss-music/` on branch `stills/trailer-v2`, rebuilt by
   `python3 scripts/reel/music/handoff.py <folder>` on `claude/trailer-v2`): **the `.mp3` files only** (they decode
   everywhere, iOS Safari included; stereo at a constant 128 kbps since Nov 16, Eric: "128 is fine for the game", rendered with
   `handoff.py --stereo --kbps 128` (and `phases_v.py --stereo --kbps 128` for the Hidden Boss's); 192 kbps Nov 14-16 (main at b3bd995), mono 64 kbps
   Nov 12-14. Render it from its song; if an MP3 must be re-encoded (as on Nov 16), use `ffmpeg -i old.mp3 -c:a libmp3lame -b:a 128k -ar 48000 -ac 2`
   and check, per file, that it decodes to the same length and lines up with the old at offset 0, at `pad` and `pad + loopSeconds`:
   docs/decisions/2026-11-16-music-128k.md), e.g. `bigboy-loop.mp3`, or `hollow-intro.mp3` and `hollow-loop.mp3`.
2. Put them in this folder.
3. Copy the boss's entry from the handoff's `themes.json` into `themes.json` here, under `themes`, keyed by the boss's id
   (`grex`, `bigboy`, `hollow`…): `intro` (a name, or `null` for a loop-only song), `loop`, `introSeconds`,
   `loopSeconds`. Keep `pad` as the handoff has it. A longer version of a theme: replace its files and its entry.

The lengths are read from `themes.json`, never from the code. These files aren't precached (vite.config.ts): every theme in
`themes.json` but the Hidden Boss's (`RECLUSE_MUSIC` in settings.ts: fetched as his fight starts, Nov 13) is fetched during the town's loading bar ("Loading music…", Nov 12) and kept by the service worker; a theme is decoded
only when its battle, room or splash needs it.

## The Hidden Boss's four themes (Nov 13)

`recluse-house`, `recluse-phase2`, `recluse-beaten`, `recluse-phase3`: keyed by their point in his fight, not by a boss id, and switched
mid-fight (`src/music.ts`, `recluseMusic` and `switchPlan`; the handoff's README, "The Hidden Boss"). Keep each entry's `marks`. The
boards split at the transformation's start + `recluse-phase3`'s `introSeconds`: a new length needs no code change.

## The town's theme (Nov 15)

`town-loop` (the theme, one seamless loop) and `town-solo-a`, `town-solo-b` (piano solos: `seconds` of music, then 4 s ringing out), from
`town-music/` on branch `stills/trailer-v2` (made by `scripts/reel/music/town.py --stereo --kbps 128` on `claude/trailer-v2`), the `.mp3`
files only. Their numbers are `themes.json`'s `town` entry (`loop`, `loopSeconds`, each solo's `id`, `file`, `seconds`; `pad` as every
theme's), copied from the handoff's `town.json`. How often and in what order the solos play: `TOWN_MUSIC` in settings.ts. A rebuilt piece:
replace its file and its numbers; no code change (`src/music.ts`, `townMusic`).

## The Battle Tower's theme (Nov 19)

`tower-loop`: one seamless loop, no intro (as Chandy's), from `tower-music/` on branch `stills/trailer-v2` (song `song_an.py`), re-encoded
from its 192 kbps handoff to 128 kbps as above (same length, lined up at 0, `pad` and `pad + loopSeconds`). Keyed `tower` (the tower's home
id): its lobby, its floor room and every floor's battle play it, never the bosses' own (docs/decisions/2026-11-19-tower-music.md).
