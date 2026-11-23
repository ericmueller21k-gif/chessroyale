# The train's sound for Birdie's ordinary move: four short runs

Eric (Nov 23), to the music helper: "also with the train sound from the same clip ... let it know that I want ...
the train sound made during Birdie's when he does his normal move throughout the game when he goes across the board.
We should be adding the little train sound appropriately. And we can have a couple versions of that too, like just a
couple different lengths or whatever. Nothing crazy."

The clip he means is Birdie's ult piece (`../boss-music-stereo-192/birdie-ult-intro`): these are its locomotive (the
exhaust's puffs, the wheels over the rail joints, steam, the whistle), the same sounds at the same pace, cut short.

| File | What it is | Length | It could be (yours to decide) |
|---|---|---|---|
| `birdie-train-short` | three puffs and one rail joint | 0.59 s | a short move |
| `birdie-train-medium` | five puffs, two rail joints | 0.90 s | most moves |
| `birdie-train-long` | eight puffs, three rail joints, a puff of steam as it stops | 1.78 s | a move right across the board |
| `birdie-train-toot` | the medium run with a short toot of the whistle over its start | 0.90 s | a capture, a check, or now and then for variety |

`birdie-train-sheet.mp3` plays the four in that order: Eric was sent it. He has not said which he likes yet.

Each as `.wav` and `.mp3` (mono, 44.1 kHz; the mp3 112 kbps). Dry. One gain for the set (the loudest peaks at
-6 dBFS): the level in the game is yours to set. 94 to 97% of each one's energy is under 6 kHz, so the game's
low-pass on effects leaves them as they are. They are quiet for their peaks (short puffs of noise), so judge them by
loudness, not by peak.

Picking by how long the move's animation runs is the simple way: each run swells and falls a little, as a train coming
and going by, so one that ends a touch before or after the piece lands still sits right. If a move needs a length
between these, or longer, it is one line on my side.

## What they are made of, to build them in code as the other bosses' sounds are

Seeded noise and a few sines, as the game's own synthesized sounds:

- **A puff** (the exhaust): noise with its highs rolled off above about 1.7 kHz (a running mean), plus 0.35 of a
  brighter noise (each random level held for 1/4500 s, its lows thinned); in over 12 ms, dying with a time of 35 ms;
  0.11 s long. A **strong puff**: rolled off above 1.1 kHz, dying over 55 ms, 0.16 s long; a weak one is 0.6 as
  loud. A puff every 0.185 s (an 8th at the song's 162), the strong one first and then every fourth.
- **A rail joint:** two knocks 85 ms apart; a knock is a 620 Hz sine dying in 8 ms, 0.6 of a 170 Hz sine dying in
  20 ms, and a tick of noise dying in 3 ms; 0.41 as loud as a strong puff.
- **Steam:** bright noise in over 30 ms, dying over about 0.12 s (0.35 s in all), 0.32 as loud.
- **The toot:** three pipes together at 494, 659 and 784 Hz (B, E, G: the whistle's chord in his song), each with
  its octave at 0.5, its twelfth at 0.33 and its double octave at 0.15; it slides up 0.7 of a half step into the
  note over 50 ms and sags 0.6 of one over its last fifth; 0.32 s long, 0.4 as loud.
- Each run's puffs, in order, are this loud: short 0.9, 1, 0.75; medium and toot 0.8, 1, 1, 0.9, 0.7; long 0.6,
  0.8, 1, 1, 1, 0.9, 0.75, 0.6. Rail joints at 0.46 s (short); 0.28 and 0.65 s (medium, toot); 0.28, 0.83 and
  1.2 s (long).

The exact functions are `chuff_wave`, `knock_wave`, `steam_wave` and `whistle_wave` in
`scripts/reel/music/song_aj.py` on `claude/trailer-v2`; `birdie_train.py` beside it builds these files from them.
