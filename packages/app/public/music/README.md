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
id): its lobby and its floor room play it; a floor's battle plays one of its bosses' own themes (docs/decisions/2026-11-19-tower-music.md).

## Chub & Chirp's theme (Nov 22)

`hopper-loop`: one seamless loop, no intro (as Chandy's), 129.92 s, from `boss-music-stereo-192/` on branch `stills/trailer-v2` (commit
`0313337a`, song `song_x.py`), re-encoded from its 192 kbps handoff to 128 kbps as above (same length, lined up with it at `pad`, 30 s and
just before `pad + loopSeconds`). Keyed `hopper` (the roster id). Eric, Nov 22: "Yes let's add that one." Its own crickets and rabbit-foot
thumps echo `hopper-sounds.ts`; if a playtest mistakes them for the fight's sounds, the music helper turns them down.

## Smudgy's theme (Nov 22)

`smudgy-loop`: one seamless loop, no intro (as Chandy's), 166.5 s, from `boss-music-stereo-192/` on branch `stills/trailer-v2` (commit
`e74fb337`, song `song_ao.py`), re-encoded from its 192 kbps handoff to 128 kbps as above (same length, lined up with it at `pad`, 30 s and
just before `pad + loopSeconds`). Keyed `smudgy` (the roster id). Eric, Nov 22, on the third version: "Yeah, this is the one." Its slow
opening (the first 20 s) is part of the loop, so every pass replays it; its quiet middle (1:05 to 1:33) sits about 3 dB under the rest, the
calmest boss theme on purpose. Its splats, brush swishes, drips and giggles echo `smudgy-sounds.ts`; if a playtest mistakes them for the
fight's sounds, the music helper turns them down.

## Nov 23: Birdie's theme and his ult's piece

`birdie-loop` (his theme, the runaway-train song: one seamless loop, no intro, 136.296292 s, 162 bpm) and `birdie-ult-intro` (his
ultimate's piece, "the crossing": 15.8 s), from `boss-music-stereo-192/` on branch `stills/trailer-v2` (commit `6981fcee`, song
`song_aj.py`), re-encoded from their 192 kbps handoff to 128 kbps as above (same length, lined up with it at `pad`, 30 s and just before
`pad + loopSeconds`; the piece at its start, `pad` and its drop). Keyed `birdie` (the roster id: his theme from the battle's start) and
`birdie-ult` (shaped like the Hidden Boss's pieces: intro `birdie-ult-intro`, `introSeconds` 14.814813, loop `birdie-loop` from its top;
keep its `marks`). His fall switches the battle to `birdie-ult` with the drop on the train's impact (`switchPlan`'s `dropAt`; `BIRDIE_ULT`
in settings.ts, whose `introMs` a test keeps equal to `introSeconds`): the piece plays once a battle, then his theme loops as normal.
Eric, Nov 23: "Going back to the Train version 4 song, that's going to be Birdie's song."

## Nov 27: the Stranger's theme

`stranger-loop`: one seamless loop, no intro (as Chandy's), 160 s, from `boss-music-stereo-192/` on branch `stills/trailer-v2` (commit
`61f81d07a`, song `song_ap.py`, "Gothic hybrid v3"), re-encoded from its 192 kbps handoff to 128 kbps as above (same length, lined up with
it at `pad`, 30 s and just before `pad + loopSeconds`). Keyed `stranger` (the roster id). Eric, Nov 27, to the music helper: "this Gothic
hybrid v3, you can change it to the stranger, because that's what the boss is". Its opening (17 s of one voice over a low tone, no beat)
is part of the loop, so every pass replays it. The first theme with sampled sound: its voice, strings, flute, oboe, violin and bell are
played through the FluidR3_GM sound bank (Frank Wen, MIT license), credited in the FAQ and `/licenses/third-party.txt`.

## Nov 28: the Stranger's theme, the choir version

`stranger-loop` replaced in place (same name, same 160 s loop, same entry; `lufs` -16.4 → -16.6): from `boss-music-stereo-192/` on
`stills/trailer-v2` (commit `efeade008`). Wherever the one sampled voice sang, the same bank's choir's women now sing the same notes at
the same level; nothing else changed. Eric, Nov 28, to the music helper: "this should be the new one ... replace the old one" (the full
song, both voices equal). Re-encoded to 128 kbps as above and lined up with the handoff. The Nov 27 version stays at `61f81d07a`.
