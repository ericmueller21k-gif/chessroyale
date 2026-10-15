# The opening allowance's calibration

Made by `packages/sim/scripts/opening-allowance.ts` (2451 positions, 32068 scored moves, moves 1-14; the lite build at 250k nodes, the judge's top-8 search plus a search over the other picks). Loss in points (1 point = 1% of expected score). How the moves are sorted is in the script's header.

## Loss by kind (moves 1-14)

Sound kinds on the balanced line only; material kinds on the line and its side branches.

| Kind | n | p10 | p25 | median | p75 | p90 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| top 2-4 | 4364 | 0.0 | 0.5 | 1.6 | 5.7 | 15.8 |
| top 5-8 | 5215 | 0.1 | 2.0 | 4.7 | 14.8 | 31.3 |
| random, sound | 3829 | 0.9 | 5.3 | 17.3 | 39.2 | 48.8 |
| missed free pawn | 2897 | 0.0 | 4.5 | 30.1 | 46.9 | 53.8 |
| missed free piece | 2021 | 0.0 | 7.7 | 47.3 | 53.0 | 95.0 |
| hangs a pawn | 4153 | 0.0 | 4.5 | 37.1 | 50.1 | 62.2 |
| hangs a piece | 5740 | 0.0 | 16.9 | 50.2 | 88.6 | 100.0 |

## Loss by move number (median / p90; n)

| Kind | moves 1-4 | moves 5-8 | moves 9-10 | moves 11-12 | moves 13-14 |
| --- | ---: | ---: | ---: | ---: | ---: |
| top 2-4 | 1.2 / 7.0 (633) | 1.7 / 12.6 (1492) | 2.3 / 19.1 (775) | 1.9 / 19.0 (723) | 1.4 / 22.4 (741) |
| top 5-8 | 3.4 / 12.7 (832) | 4.5 / 26.5 (1791) | 7.2 / 36.5 (921) | 7.7 / 38.3 (805) | 5.2 / 38.8 (866) |
| random, sound | 10.6 / 39.9 (686) | 19.9 / 48.2 (1323) | 23.1 / 51.5 (670) | 20.4 / 49.9 (549) | 13.3 / 50.1 (601) |
| missed free pawn | 35.6 / 49.5 (542) | 31.5 / 52.4 (1088) | 25.3 / 62.4 (494) | 22.1 / 61.5 (400) | 13.9 / 69.5 (373) |
| missed free piece | 46.8 / 52.1 (68) | 48.1 / 83.7 (693) | 46.5 / 97.7 (465) | 45.9 / 94.0 (387) | 47.3 / 99.3 (408) |
| hangs a pawn | 34.5 / 52.0 (278) | 41.3 / 55.5 (1589) | 33.0 / 57.8 (772) | 39.3 / 81.4 (741) | 22.1 / 89.2 (773) |
| hangs a piece | 49.5 / 94.8 (152) | 51.0 / 100.0 (1492) | 50.6 / 100.0 (1252) | 50.0 / 100.0 (1415) | 48.6 / 100.0 (1429) |

## What a flat allowance of G points would do

Moves 1-10 (the whole allowance). Sound kinds: the share that counts 0 (loss <= G). Material kinds: the share still charged at least half its raw loss / the share counted under 1 point ("about 0").

| Kind | G=2 | G=3 | G=4 | G=5 | G=6 | G=8 | G=10 | G=12 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| top 2-4 | 57% at 0 | 66% at 0 | 72% at 0 | 75% at 0 | 79% at 0 | 84% at 0 | 87% at 0 | 90% at 0 |
| top 5-8 | 21% at 0 | 36% at 0 | 46% at 0 | 55% at 0 | 59% at 0 | 65% at 0 | 71% at 0 | 75% at 0 |
| random, sound | 6% at 0 | 10% at 0 | 15% at 0 | 20% at 0 | 25% at 0 | 31% at 0 | 37% at 0 | 42% at 0 |
| missed free pawn | 88% / 17% | 84% / 19% | 81% / 21% | 79% / 23% | 77% / 24% | 73% / 27% | 68% / 29% | 65% / 31% |
| missed free piece | 94% / 16% | 92% / 17% | 91% / 18% | 90% / 19% | 89% / 19% | 88% / 20% | 86% / 21% | 85% / 22% |
| hangs a pawn | 90% / 17% | 86% / 18% | 84% / 20% | 82% / 22% | 80% / 23% | 76% / 25% | 73% / 27% | 69% / 29% |
| hangs a piece | 95% / 14% | 94% / 14% | 93% / 15% | 93% / 15% | 92% / 15% | 91% / 16% | 90% / 16% | 90% / 17% |

## The same with the material fallback

Moves 1-10 (the whole allowance). Sound kinds: the share that counts 0 (loss <= G). Material kinds: the share still charged at least half its raw loss / the share counted under 1 point ("about 0"): with the fallback a move that gives up material by the exchange check gets no allowance, so they're charged in full.

| Kind | G=2 | G=3 | G=4 | G=5 | G=6 | G=8 | G=10 | G=12 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| top 2-4 | 57% at 0 | 66% at 0 | 72% at 0 | 75% at 0 | 79% at 0 | 84% at 0 | 87% at 0 | 90% at 0 |
| top 5-8 | 21% at 0 | 36% at 0 | 46% at 0 | 55% at 0 | 59% at 0 | 65% at 0 | 71% at 0 | 75% at 0 |
| random, sound | 6% at 0 | 10% at 0 | 15% at 0 | 20% at 0 | 25% at 0 | 31% at 0 | 37% at 0 | 42% at 0 |
| missed free pawn | 100% / 11% | 100% / 11% | 100% / 11% | 100% / 11% | 100% / 11% | 100% / 11% | 100% / 11% | 100% / 11% |
| missed free piece | 100% / 15% | 100% / 15% | 100% / 15% | 100% / 15% | 100% / 15% | 100% / 15% | 100% / 15% | 100% / 15% |
| hangs a pawn | 100% / 12% | 100% / 12% | 100% / 12% | 100% / 12% | 100% / 12% | 100% / 12% | 100% / 12% | 100% / 12% |
| hangs a piece | 100% / 12% | 100% / 12% | 100% / 12% | 100% / 12% | 100% / 12% | 100% / 12% | 100% / 12% | 100% / 12% |

## Flat to move 10, or a taper from move 1

Moves 1-14. Flat: G through move 10, then down to 0 at move 14. Taper: G at move 1, down in a line to 0 at move 14. Sound kinds: share at 0; material kinds: share charged at least half its raw loss.

| Kind | flat G=4 | taper G=4 | flat G=6 | taper G=6 | flat G=8 | taper G=8 | flat G=10 | taper G=10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| top 2-4 | 63% | 50% | 70% | 56% | 75% | 62% | 78% | 65% |
| top 5-8 | 40% | 28% | 51% | 38% | 56% | 42% | 61% | 47% |
| random, sound | 18% | 13% | 25% | 18% | 30% | 22% | 35% | 25% |
| missed free pawn | 84% | 89% | 80% | 86% | 77% | 84% | 73% | 80% |
| missed free piece | 92% | 95% | 91% | 93% | 90% | 92% | 88% | 92% |
| hangs a pawn | 87% | 91% | 83% | 89% | 81% | 87% | 78% | 85% |
| hangs a piece | 94% | 96% | 93% | 96% | 92% | 95% | 92% | 94% |

## Material moves the engine says cost little

The exchange check is simple (one capture and the exchange on its square), so some moves it calls material are sound to the engine (a gambit, a pawn that can't be taken safely). Share with a raw loss under 2 / under 5 points, moves 1-10:

- missed free pawn: 14% / 21%
- missed free piece: 16% / 18%
- hangs a pawn: 14% / 20%
- hangs a piece: 13% / 15%
