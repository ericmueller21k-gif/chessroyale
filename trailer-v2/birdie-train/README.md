# The train's sound for Birdie's ordinary move: five whistles (and four short runs)

**Read this part first: it replaces the plan below it.** Eric heard the four runs of puffing and said (Nov 23): "I
was thinking more whistles than the other stuff. Or we want a couple different whistles. And like the double whistle,
you know how the trains go like toot toot?" So the sound of Birdie's ordinary move is a **whistle**, a few different
ones, the double toot among them. The runs further down are the "other stuff": use one quietly under a whistle if it
helps a long move, or leave them out.

| File | What it is | Length | It could be (yours to decide) |
|---|---|---|---|
| `birdie-whistle-toot-toot` | **the double toot** he asked for: two short blasts | 0.58 s | most moves |
| `birdie-whistle-toot` | one short blast | 0.28 s | a short move |
| `birdie-whistle-long` | one long blast, sagging as it ends | 0.90 s | a move right across the board |
| `birdie-whistle-toot-long` | a short blast, then a long one | 1.05 s | a capture, a check |
| `birdie-whistle-peep-peep` | two quick peeps on a smaller, higher whistle | 0.40 s | variety, a small move |

`birdie-whistle-sheet.mp3` plays them in this order: toot, toot-toot, long, toot-long, peep-peep. Eric was sent it; he
has not said which he likes beyond asking for the double toot.

They are the whistle of his theme and of his ult's piece (three pipes: B, E and G, 494, 659 and 784 Hz; the peeps a
step up the chord: E, G and B, 659, 784 and 988 Hz), so they are in tune with his music. Each as `.wav` and `.mp3`
(mono, 44.1 kHz; the mp3 112 kbps), dry, one gain for the set (the loudest peaks at -6 dBFS; the level in the game is
yours). Nothing in them is over 4 kHz, so the game's low-pass on effects doesn't touch them.

To build them in code: the whistle is three sines together, each with its octave at 0.5, its twelfth at 0.33 and its
double octave at 0.15; it slides up 0.7 of a half step into its note over 50 ms, wavers a hair (0.4% at 6.5 Hz, its
level 8% at 11 Hz), sags 0.6 of a half step over its last fifth, comes in over 40 ms and lets go over 120 ms. The
blasts, (seconds in, how long, how loud): toot (0, 0.28, 1); toot-toot (0, 0.24, 0.9) (0.34, 0.24, 1); long (0, 0.9,
1); toot-long (0, 0.2, 0.9) (0.3, 0.75, 1); peep-peep (0, 0.16, 0.9) (0.24, 0.16, 1). The exact function is
`whistle_wave` in `scripts/reel/music/song_aj.py`; `birdie_train.py` beside it builds all of these.

---

## The four short runs (the first plan: now the "other stuff")

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
