# Timber's attack on the God King (Nov 2)

Eric found Timber was the only boss with no God King attack. He approved this run in my own dialog (capped at $5).
Brief: `scripts/boss-art/briefs/timber-king-attack.md`. Added to `boss-beaver/boss-beaver.ts`: `BOSS_BEAVER_ATTACK`
(id `timber-attack`) with `idle` and `kingAttack`. Only lines were added; nothing above them changed except one import
(`KING_ATTACK`). His figure's earlier summary and log: `boss-beaver/summary-figure.md`, `log-figure.jsonl`.

## Cost
**$2.09** of the $5 cap, 27 turns. It finished and called done (`boss-beaver/summary.md` has every frame with its time).

## The attack (2,780 ms, on the shared KING_ATTACK beats)
1. **Drop:** his shadow spreads, he drops in with the hammer raised, and lands at 470 ms with a squash and sawdust.
2. **Hammer hits:** hits 1 to 8 are the hammer, overhead whacks and side knocks in turn, with swish arcs and wood chips.
3. **Plank hits:** he slides a plank off his back, swings it like a bat (hit 9), and smashes it down on the king's head
   (hit 10).
4. **Exit:** he slides the plank back, gives a buck-toothed laugh with a wink, and hops off. The last frame is empty.
- **Preview:** [timber-king-attack.gif](boss-beaver/timber-king-attack.gif).

## For the kit (the director's helper)
- `kingAttack: { ch: BOSS_BEAVER_ATTACK, anim: "kingAttack", perSquare: 40, stand: 1.15, facesLeft: true, hit: … }`
  - Frame 110 x 108, foot (62, 102).
  - perSquare 40 keeps him about Big Boy's size.
- **Add `"timber"` to `KING_ATTACKERS`** in `packages/chess/src/boss-timing.ts`.
- **Cue to sound, in his own sounds (`timber-sounds.ts`):**

  | Cue | Frame | Time (ms) |
  |---|---|---|
  | `swoosh` | f2 | 202 |
  | `thump` | f5 | 470 |
  | `whack` | f6, f10, f14, f18 | 560, 900, 1240, 1580 |
  | `knock` | f8, f12, f16, f20 | 730, 1070, 1410, 1750 |
  | `slide` | f21 | 1840 |
  | `whack` | f23 | 1920 |
  | `thump` | f25 | 2090 |
  | `slide` | f28 | 2310 |
  | `chitter` | f29 | 2380 |
  | `hup` | f34 | 2640 |

- **The hit on the king's square** (code draws it, like Sawyer's `sawItem` in wood colors #f6d38e, #e0aa5c, #b47b36,
  #7e5222, with sawdust #e8d2a4):
  - for whacks, chips spray up and out;
  - for knocks and the plank bat, chips fly sideways from the side he hits;
  - for the final smash, a bigger splinter burst.

## Calls Eric may want to change
- **No tail slap.** His tail can't reach the king without a new tail part, so the plank bat and smash take its place.
- **Small hammer hits.** His hammer is its usual size, so its hits are small at phone size. The plank hits are the big
  ones.
