# Boss music

Each boss's battle theme: an intro played once, then a loop until the battle's result (`src/music.ts`;
docs/decisions/2026-11-11-boss-music.md; docs/areas/bosses.md, "Music"). A boss not listed in `themes.json` plays no
music. Made in code by `scripts/reel/music/` on branch `claude/trailer-v2` (no samples, every tune original).

## Adding a boss's theme (no code change)

1. Take the boss's pieces from the music handoff (`boss-music/` on branch `stills/trailer-v2`, rebuilt by
   `python3 scripts/reel/music/handoff.py <folder>` on `claude/trailer-v2`): **the `.mp3` files only** (they decode
   everywhere, iOS Safari included; mono at 64 kbps since Nov 12, the handoff's default: never re-encode an MP3, which shifts the
   audio and moves the loop points: render it again from its song), e.g. `bigboy-loop.mp3`, or `hollow-intro.mp3` and `hollow-loop.mp3`.
2. Put them in this folder.
3. Copy the boss's entry from the handoff's `themes.json` into `themes.json` here, under `themes`, keyed by the boss's id
   (`grex`, `bigboy`, `hollow`…): `intro` (a name, or `null` for a loop-only song), `loop`, `introSeconds`,
   `loopSeconds`. Keep `pad` as the handoff has it. A longer version of a theme: replace its files and its entry.

The lengths are read from `themes.json`, never from the code. These files aren't precached (vite.config.ts): every theme in
`themes.json` is fetched during the town's loading bar ("Loading music…", Nov 12) and kept by the service worker; a theme is decoded
only when its battle, room or splash needs it.
