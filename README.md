# Birdie's chirps and train runs (branch claude/birdie-sounds)

`birdie-sounds-first-moves.mp4`: a solo battle on a phone (428x746), `?power=train`, from his entrance through his train's ride and
his move after it (37 s). The sounds are mixed in at the times the game played them (its `play()` log), the board's move knock
included; his music left out. Sound and picture line up within about 80 ms (checked on three moves).

`timings.txt`: ms since the page opened; "you" is your tap, "phase" the screen's.

## Synthesized vs the music helper's files (raw shapes; levels are the game's)

| sound | length ref / mine (s) | envelope corr | strongest Hz ref / mine | centroid Hz ref / mine | band-energy diff | in game: peak, dB |
|---|---|---|---|---|---|---|
| hello | 0.91 / 0.91 | 1.00 | 3856 / 3856 | 3795 / 3786 | 0% | 0.15, -27.0 |
| tsip | 0.41 / 0.42 | 1.00 | 3836 / 3836 | 3988 / 3983 | 1% | 0.15, -26.8 |
| teeoo | 0.39 / 0.39 | 1.00 | 3874 / 3874 | 3614 / 3600 | 0% | 0.15, -25.3 |
| trill | 0.42 / 0.42 | 1.00 | 4883 / 5328 | 5212 / 5208 | 0% | 0.13, -28.0 |
| cheer | 0.19 / 0.19 | 1.00 | 3511 / 3557 | 3638 / 3634 | 0% | 0.15, -24.1 |
| ask | 0.33 / 0.33 | 1.00 | 2973 / 2973 | 3685 / 3676 | 1% | 0.15, -23.8 |
| scold | 0.45 / 0.45 | 1.00 | 4213 / 4193 | 4225 / 4216 | 0% | 0.15, -25.1 |
| trainShort | 0.59 / 0.60 | 0.98 | 176 / 176 | 1511 / 1275 | 9% | 0.26, -27.6 |
| trainMedium | 0.90 / 0.90 | 0.98 | 164 / 162 | 1403 / 1422 | 4% | 0.24, -27.9 |
| trainLong | 1.78 / 1.78 | 0.98 | 175 / 167 | 1832 / 1864 | 5% | 0.28, -28.9 |
| trainToot | 0.90 / 0.90 | 0.98 | 492 / 492 | 1196 / 1218 | 2% | 0.24, -26.0 |

(The first commit on this branch carried the repo's tree by mistake; this one keeps only the stills.)
