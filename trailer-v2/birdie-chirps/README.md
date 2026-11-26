# Birdie's voice: seven chirps

Eric (Nov 23), to the music helper: "those bird sounds that you did from the clip, could you pass some versions along
of that and tell ... the director that we want to wire those in for Birdie as like what he says ... he chirps
throughout the game basically, and also when like you go to challenge him to fight ... we'll use whatever chirping
you already had created for that song like for that. And so there could be like 5 to 6 kind of variations of
different chirps ... the director chat should know all the different places to wire in that sort of thing."

The clip he means is Birdie's ult piece (`../boss-music-stereo-192/birdie-ult-intro`): its birds are these same
phrases, so his voice and his music share one bird.

| File | What it is | Length | It could be (yours to decide) |
|---|---|---|---|
| `birdie-chirp-hello` | the clip's opening chirping: four quick chirps, then two clear notes | 0.91 s | **the challenge** (Eric's ask), his entrance |
| `birdie-chirp-tsip` | four quick falling chirps | 0.41 s | idle chatter, a move |
| `birdie-chirp-teeoo` | two clear notes, the second lower and trembling | 0.39 s | idle chatter, smug |
| `birdie-chirp-trill` | one high note shaken fast | 0.42 s | a capture, pleased |
| `birdie-chirp-cheer` | two chirps up | 0.19 s | a move, a nod |
| `birdie-chirp-ask` | two notes, the second higher (a question) | 0.33 s | thinking, your turn |
| `birdie-chirp-scold` | six fast chirps, back and forth, the last lower | 0.45 s | hurt, rattled, check on him |

`tsip`, `teeoo`, `trill` and `cheer` are in the ult's piece as they are here; `hello` is its first two phrases as
they come there; `ask` and `scold` are two more in the same voice, made for this. `birdie-chirps-sheet.mp3` plays all
seven in that order: Eric was sent it.

Each as `.wav` and `.mp3` (mono, 44.1 kHz; the mp3 112 kbps). Dry: no hall on them, as the game's sounds have none.
One gain for the whole set (the loudest peaks at -6 dBFS), so they keep their levels against each other: the level in
the game is yours to set (the test that keeps a boss's sounds under a piece's move). Every note's own pitch is
between 2.7 and 5.2 kHz, so the game's 6 kHz low-pass on effects leaves them nearly as they are (the trill, the
highest, loses a little).

## The recipe, to build them in code as the other bosses' sounds are

They are plain: no noise, no samples. A phrase is a few notes; a note is one whistle sliding from `f0` to `f1` Hz
over `secs`, with `u = t / secs`:

    pitch(t) = f0 * (f1 / f0) ** u * (1 + 0.06 * sin(2π * shake * t))      (the last factor only if it trembles)
    wave     = sin(phase) + 0.15 * sin(2 * phase)                          (phase: the running sum of the pitch)
    level(t) = sin(π * u) ** 1.3 * (0.6 + 0.4 * cos(2π * shake * t))       (the last factor only if it trembles)

| Phrase | Its notes: (starts at, s; from Hz; to Hz; lasts, s; how loud; trembles at, Hz) |
|---|---|
| tsip | (0, 4600, 3300, 0.055, 0.8) (0.11, 4600, 3300, 0.055, 1.0) (0.22, 4600, 3300, 0.055, 0.9) (0.36, 4600, 3300, 0.055, 0.7) |
| teeoo | (0, 3800, 3950, 0.14, 1.0) (0.19, 3000, 2750, 0.2, 0.9, trembles at 25) |
| trill | (0, 5200, 5000, 0.42, 0.8, trembles at 28) |
| cheer | (0, 2800, 4200, 0.07, 1.0) (0.12, 3000, 4500, 0.07, 1.0) |
| ask | (0, 2900, 3050, 0.12, 0.9) (0.17, 3700, 4300, 0.16, 1.0) |
| scold | (0, 5000, 3900, 0.045, 1.0) (0.075, 4400, 3500, 0.045, 0.9) (0.15, 5000, 3900, 0.045, 1.0) (0.225, 4400, 3500, 0.045, 0.9) (0.3, 5000, 3900, 0.045, 1.0) (0.375, 4200, 3200, 0.07, 0.85) |
| hello | tsip, then teeoo 0.5185 s after it at 0.9 of its level |

The table is `BIRDS` in `scripts/reel/music/song_aj.py` on `claude/trailer-v2`; `birdie_chirps.py` beside it builds
these files from it. More variations are a line each there: ask.
