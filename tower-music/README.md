# The battle tower's music: one loop

Eric (Nov 18-19) asked for background music for the new battle tower. After four other goes he approved this one
(Nov 19: "this is the one, nice work"): a moody 96 BPM boom-bap groove in F sharp minor with a funk bass, off-beat
stabs, a gritty low guitar and dark chords, built from his own plan and its follow-up ("freeze 0:00 to 0:20 ... keep
the 0:00-0:20 groove as the unbreakable spine").

| File | What it is | Length |
|---|---|---|
| `tower-loop` | the whole theme, one seamless loop, no intro piece | 160.0 s (2:40) |

As `.mp3` (stereo, 192 kbps) and `.ogg`, like the boss themes' files since Nov 14. `themes.json` has the numbers
(`loopSeconds` 160.0, `pad` 0.5, -16.1 LUFS, peak -1.3 dBFS).

## How to play it

Exactly as a boss theme's loop with no intro (Chandy's, Babur's): the file has `pad` (0.5 s) of its own end before it
and of its own start after it. Start it at offset `pad` and loop between `pad` and `pad + loopSeconds`.

- It is a place's music, like the town's, not a boss's: the id `tower` is a guess. Rename it to whatever the tower is
  called in the code.
- It is mixed darker and a little under a boss theme on purpose (Eric: "keep the sound more muted overall, it's the
  background battle tower music"): it needs no extra turning down beyond the music level the game already uses.
- Its first bar opens with a guitar crash. On the loop that crash is the downbeat the last bar's drum fill lands on.

Made in code by `scripts/reel/music/handoff.py --stereo --kbps 192 <folder> tower` on `claude/trailer-v2` (the song is
`song_an.py`). The other tower tries (`song_ak.py` slow and dark, `song_al.py` and `song_am.py` orchestral builds) are
not used; Eric shelved `song_ak.py` as a possible defeat song.
