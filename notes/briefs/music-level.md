# The music's level: a little under the game's sounds (Eric, Nov 14), and no doubled music

Effort medium. New branch `claude/music-level` from `origin/main` (after `claude/town-load-fast` merges if it has: it changes
music.ts's fetching only). Read `packages/app/src/music.ts`, `sound.ts` (`MASTER_LEVEL`, `musicOut`), settings `MUSIC.volume`.

Eric: the game's music sounds "shit" next to the same file played on its own. The file is exact (the songs' session compared main's
clown-loop.mp3 with the master: sample-exact, same width and bands, -1.4 dB headroom). The game plays music at MUSIC.volume 0.25 ×
0.9 = -13 dB, so a -16.8 LUFS file reaches the speakers at about -30 LUFS: thin and dull. Eric: "music volume should fit with
normal, a little quieter than the game, that's what every game does... it might just be volume."
1. **Level:** in a real browser (the built app), measure at the speakers (record the destination's input) the loudness of the music
   and the game's own sounds: a move, a capture, the clock's tick, a boss's voice blip, a button tap. Pick MUSIC.volume so the music
   sits a few dB under those (short-term loudness of the music vs the sounds' peaks; say the numbers), clearly full, never louder than
   the game. Expect roughly 0.5 to 0.7. Sound effects unchanged.
2. **Doubled music check:** count AudioBufferSourceNodes sounding one theme at once: entering a boss's place (Boingo's), leaving and
   re-entering, a 2 s+ window blur/focus (#697's handover starts the new copy before fading the old: does the old always stop?), a
   boss's splash, a battle's start from the room. If two ever sound together beyond the 300 ms cross-fade, fix it; add a unit test
   "never two sources of one theme sounding past the handover".
3. **Sample rate:** log and report the context's sample rate; nothing to change unless it's low on purpose somewhere.
Light lane for the level (one number), targeted if 2 finds a bug. Typecheck; music/sound unit tests; `e2e/sound.spec.ts`. Push;
`.pr-body.md` (the measured levels before/after, the count results, checks old -> new); `.done`. No PRs, no CI waits, no model names
in commits (end commits with the Claude-Session line only). About 45 minutes.
