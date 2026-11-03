# Timber's battle intro art (Nov 3)

Eric's design: "When he walks in, to the left there's a giant thick wooden log. He picks it up and walks it over… sets it
in the middle where the chessboard goes. Then he starts gnawing at it… a big storm of wood shavings and sawdust comes up
like a fog, then it falls and dissipates, and you see he's chewed it into a board (the table with the board). The seats
are little wooden stumps." The boss is on the left and you on the right, in about 12 s, with his own sounds. Eric
approved both runs in my own dialog (capped at $7 and $5).
- Briefs: `briefs/intro-timber.md` (the props, with the timeline) and `briefs/timber-intro-anims.md` (his moves).

## Cost
- **The props: $3.14** of $7 (`house-intro-timber/summary.md`).
- **His moves: $3.33** of $5 (`boss-beaver/summary.md`; the attack run's notes are in `boss-beaver/summary-attack.md`).
- Both finished and called done. **Timber in all: $16.08**: his house $1.71, his shop $5.05, his king attack $2.09 and
  this intro $6.47.

## Previews (mockups)
- **The whole intro**, side-on, about 11.4 s: [view-intro-sequence.gif](house-intro-timber/view-intro-sequence.gif). Key
  frames: [view-intro-keyframes.png](house-intro-timber/view-intro-keyframes.png).
  - He says his line, walks left to the log, heaves it up, carries it to the middle and stands it on end.
  - He gnaws it into an hourglass.
  - The shavings fog boils up and hides it. Under it the table and stumps swap in, then it settles to a ring of shavings.
  - He dusts off his paws and chitters.
  - The board on the table is a stand-in; the game draws the real one. Made by `scripts/boss-art/intro-timber-view.ts`.
- **The sawdust sweep** across a phone screen in his shop (about 1.2 s): [view-sawdust-phone.gif](house-intro-timber/view-sawdust-phone.gif).

## For the code helper
**Timber:** `BOSS_BEAVER_INTRO` (id `timber-intro`) in `boss-beaver/boss-beaver.ts`. 118 x 98, foot [52, 88], drawn
**facing our right**.
| Animation | Frames | Cue |
|---|---|---|
| `walk` | 6 x 110 ms | none (mirror it to walk left) |
| `lift` | 600 ms | `hup` f2 |
| `carry` | 6 x 110 ms | none |
| `setDown` | 500 ms | `thump` f2; no log in f4 |
| `gnaw` | 8 x 90 ms | `gnaw` f1/f5, `chomp` f3/f7 |
| `done` | 800 ms | `pat` f1, `chitter` f3 |
| `idle` | 1 frame | none |

- `TIMBER_INTRO_LIFT_AT = [0, 2]`: the lying log's foot relative to his in `lift` f0. Hide the lying log when `lift`
  starts.
- `TIMBER_INTRO_REACH = [34, -2]`: the standing log's foot relative to his in `setDown`'s last frame and in `gnaw`. Draw
  the log behind him.

**The props:** `house-intro-timber/house-intro-timber.ts`.
- `INTRO_TIMBER_LOG`: 80 x 70, foot [40, 64]. Animations `lying`, `standing`, and `gnawed` (6 x 250 ms, cues
  gnaw/chomp in turn).
- `INTRO_TIMBER_SHAVINGS`: 176 x 162, foot [88, 146], the table's foot.
  - `rise`: 8 x 110 ms, `clatter` f0.
  - `hold`: 4 x 120 ms, looping, `saw` f0. Swap the log for the table and stumps under it.
  - `settle`: 10 x 120 ms, `slide` f0. Its last frame is a ring of shavings to keep or fade.
- `INTRO_TIMBER_TABLE`: `PARK_TABLE`'s geometry, a gnawed log pedestal, no stools. `INTRO_TIMBER_TABLE_PALETTE`: a
  varnished slab, with squares maple `L` #efcf94 and walnut `D` #94603a. `INTRO_TIMBER_TABLE_INK`.
- `INTRO_TIMBER_STUMP`: 48 x 40, foot [24, 35], one at the table's foot x ± 37. `idle`, and `pop` (6 frames: it springs
  up out of the floor, `knock` f3). `INTRO_TIMBER_STUMP_SEAT_H` is the park stools' seat height.
- `INTRO_TIMBER_STORM` and `INTRO_TIMBER_FRONT`: the sawdust sweep, played exactly like Alfil's sandstorm, `swoosh` f0.

**Suggested timeline** (about 12.6 s with the sweep):

| Time (s) | What happens |
|---|---|
| 0 | his line (about 0.8) |
| 0.8 | walk left to the log |
| 1.5 | lift |
| 2.1 | carry to the middle |
| 3.8 | setDown |
| 4.3 | gnaw, with the log's `gnawed` (1.5) |
| 5.9 | shavings rise |
| 6.8 | hold (about 1.0; the table and stumps swap in, the stumps `pop`) |
| 7.8 | settle (1.2) |
| 9.0 | done (0.8) |
| about 9.8 | he walks to his seat or mark |
| about 11.4 | the sawdust sweep |

## Calls Eric may want to change
- While he carries the log it hides most of his body; only his head, paws and feet show.
- The chips from his gnawing are fine at phone size.
- After `done` he stands just left of the table, in front of his stump, so code should walk him to his mark or seat.
- In the intro his light comes from the top right, because he's mirrored to face right.
