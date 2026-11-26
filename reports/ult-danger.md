# Bosses' ultimates in danger: the audit (Nov 26, 2026)

Eric, Nov 26: "It should have detected like he was basically in danger, or like it was already heavily in my favor, and it should start
triggering very quickly thereafter, like a turn or two at most." The rule and its calls: `docs/decisions/2026-11-26-ult-danger.md`.

**How:** `packages/sim/scripts/ult-danger.ts`, real battles through the match runner: Stockfish (120,000 nodes) as the judge and as the
boss's brain at his Elo (the usual tier, 1600, his offset on top), a crowd of one, 60 crowd moves at most, no strikes, no Last Stand.
The **strong** crowd plays the judge's best allowed move every turn (as Eric played); the **even** crowd picks like a strong player
(`botPick` over the judge's moves, skill 3). Seeds 1 to 3 a boss (the crowd White on odd seeds). **A danger window**: a crowd move the
judge puts at 0.70 or more for the crowd, none of his ultimates under way or warned as its turn began, one still to come this battle,
and none come yet in this danger (since the crowd's moves last went under the line). **His turns to the ultimate**: from that move,
counted in his turns, 1 being his very next (`never`: two or more of his turns left and none came). `–`: no window in that battle.

```sh
npx tsx packages/sim/scripts/ult-danger.ts run <ids|all> <seeds> <strong|even> <tag> [first seed] [off]
npx tsx packages/sim/scripts/ult-danger.ts summary <tags>    # the per-boss table
npx tsx packages/sim/scripts/ult-danger.ts jumps <tags>      # how often a move at the line falls back the next
npx tsx packages/sim/scripts/ult-danger.ts compare <before> <after>
```

Rows: `reports/ult-danger/*.jsonl`. `off-*`: before the rule (the danger line switched off; the boss's moves Stockfish's own draw at a
strength, so a before and an after are different battles). `on-*`: the first version (the meter filled at once after every ultimate).
`final-*`: the rule as shipped. `even2-*`, `birdie2-*`, `birdie900-*`: the boss's move drawn from the engine's top moves with a seed of
the position (eloDraw, as two devices do online), so the same seed plays the same battle before and after.

## The strong crowd: before and after (3 battles a boss, in seed order)

| boss | before: his turns to the ultimate (first window; worst) | after (first; worst) | ultimates a battle, before → after (the first after-version) |
|---|---|---|---|
| gingerbread | –, 7, 6; –, 7, 6 | 2, 2, 2; 2, 2, 2 | 3, 3, 3 → 3, 4, 4 (4, 4, 5) |
| clown | –, 4, 4; –, 8, 4 | 2, –, 2; 2, –, 2 | 3, 3, 3 → 3, 3, 3 (4, 3, 2) |
| grex | –, –, –; –, –, – | 2, –, 2; 2, –, 2 | 2, 1, 2 → 2, 1, 3 (2, 3, 1) |
| hollow | 10, 9, 12; 10, 9, never | –, 2, 2; –, 2, 2 | 3, 3, 3 → 3, 4, 4 (21, 13, 18) |
| bigboy | –, –, –; –, –, – | –, 2, 2; –, 2, 2 | 3, 3, 3 → 2, 3, 2 (3, 3, 32) |
| sawyer | 6, 4, 5; 6, never, 5 | 2, –, 2; 2, –, 2 | 3, 3, 1 → 3, 2, 3 (3, 5, 2) |
| pig | –, –, –; –, –, – | –, –, –; –, –, – | 1, 1, 1 → 1, 1, 1 (1, 1, 1) |
| alfil | 8, 11, 8; never, 11, 12 | –, –, 2; –, –, 2 | 2, 3, 3 → 4, 1, 2 (5, 3, 4) |
| hopper | 16, –, 23; 16, –, 23 | –, –, –; –, –, – | 1, 0, 1 → 1, 1, 1 (1, 1, 1) |
| smudgy | 9, 15, 13; 9, 15, 13 | 13, 10, 14; 13, 10, 14 | 2, 2, 2 → 2, 1, 1 (2, 2, 1) |
| moo | 12, 9, 7; 12, 9, 7 | 2, 2, 2; 2, 2, 2 | 1, 2, 2 → 3, 4, 3 (3, 3, 4) |
| gardener | 2, –, 8; 2, –, 8 | 2, 2, 2; 5, 2, 2 | 3, 3, 3 → 5, 4, 5 (5, 3, 3) |
| tiger | 9, 4, 11; 9, 9, 11 | 2, 4, 2; 2, 4, 2 | 4, 3, 3 → 3, 4, 4 (4, 11, 4) |
| folio | –, 3, –; –, 3, – | 2, –, –; 2, –, – | 3, 3, 3 → 3, 4, 2 (4, 1, 5) |
| timber | 17, –, –; 17, –, – | 2, –, 2; 2, –, 2 | 2, 2, 2 → 2, 2, 2 (2, 2, 2) |
| dash | –, 4, 9; –, 4, 9 | 2, 2, 2; 2, 2, 2 | 2, 2, 2 → 2, 2, 2 (2, 2, 2) |
| zebra | –, 8, 5; –, 8, 5 | 2, 2, –; 2, 2, – | 2, 2, 2 → 2, 2, 2 (1, 2, 2) |
| chandy | 12, 15, 26; 12, 15, 26 | –, 2, 2; –, 2, 2 | 1, 1, 1 → 1, 1, 1 (1, 1, 1) |
| birdie | –, –, 8; –, –, 8 | –, –, –; –, –, – | 1, 1, 1 → 1, 1, 1 (1, 1, 1) |
| recluse | 3, –, –; 3, –, – | 1, –, –; 1, –, – | 1, 1, 1 → 1, 1, 1 (1, 1, 1) |

- **After:** every boss whose ultimate needs only a full meter comes in his second turn in danger (2), Birdie's Fall excepted (two of
  the crowd's moves in a row: also 2; see below). The rest wait on their own rules, kept: **Smudgy** (13, 10, 14) his Repaint's pair
  (never a ninth pawn: no pair while the crowd keeps all eight, Eric, Nov 7) and his Camouflage first; the **circus tiger** (4, once)
  his hoops wait when his move gives check or none fit; **Puddles** (5, once) the pass guard on his watering (Eric, Oct 18); **Sawyer**
  (before: once never) the board saw from turn 10 with a half his.
- **Wrangler:** his Showdown came in every battle, before any danger (his meter is full from his fifth move): no window. **Chub &
  Chirp:** their Carrot Patch (once a battle) came before any danger in the after battles. **The Hidden Boss:** report only, his bullet
  clock on its own turn (7): 1 to 3 when the danger came before it, else no window.
- **The first version chained:** filled again at once after every ultimate, Hollow's Lights Out came 21, 13 and 18 times a battle and
  Big Boy's Bounce 32 (the last column's brackets). Shipped: one a danger.
- **Birdie:** against a Stockfish crowd his train (every 5 turns) kept the crowd under the line in all 13 battles (seeds 1 to 9 at
  1600, 1 to 4 at 900): his Fall came by material, at turns 13 to 28. His danger path is the unit tests' (`birdie.test.ts`,
  `ult-danger.test.ts`).

## How jumpy the line is (before the rule)

off-a: 15 battles, 30 crossings of 0.7: the next move held it 13, fell back 17 (the next three moves' lowest: 0.01, 0.49, 0.50, 0.50, 0.50, 0.51, 0.51, 0.53, 0.54, 0.56, 0.58, 0.61, 0.65, 0.65, 0.66, 0.66, 0.67)
off-b: 15 battles, 32 crossings of 0.7: the next move held it 18, fell back 14 (the next three moves' lowest: 0.00, 0.00, 0.49, 0.50, 0.50, 0.52, 0.53, 0.55, 0.59, 0.59, 0.60, 0.62, 0.65, 0.68)
off-c: 15 battles, 23 crossings of 0.7: the next move held it 13, fell back 10 (the next three moves' lowest: 0.00, 0.48, 0.49, 0.52, 0.52, 0.57, 0.58, 0.60, 0.61, 0.68)
off-d: 15 battles, 35 crossings of 0.7: the next move held it 19, fell back 16 (the next three moves' lowest: 0.00, 0.00, 0.50, 0.50, 0.51, 0.51, 0.52, 0.53, 0.57, 0.58, 0.59, 0.59, 0.60, 0.61, 0.61, 0.63)
even2-off: 9 battles, 1 crossings of 0.7: the next move held it 0, fell back 1 (the next three moves' lowest: 0.55)

About half the crowd's moves that reached 0.70 fell back under it the next move (57 of 120 with the strong crowd), mostly a power of
the boss's hitting back. Hence two in a row for Birdie's Fall (once a battle, and it armors him), one for the warned ultimates (two would
make them wait three of his turns).

## Even battles: the same before and after

The meters' normal pace in level battles is unchanged: the same nine battles (the boss's move seeded) before and after, his ultimates on
the same turns. The crowd reached the line once (Birdie, seed 2, 0.72 at move 20, under it the next move): two in a row brought nothing.

| boss | seed | before: ultimates (his turns), result | after: ultimates, result | first danger (crowd move) |
|---|---|---|---|---|
| gingerbread | 1 | 14; boss after 23 | 14; boss after 23 | never |
| gingerbread | 2 | 17; boss after 37 | 17; boss after 37 | never |
| gingerbread | 3 | 15, 32; boss after 35 | 15, 32; boss after 35 | never |
| folio | 1 | 14, 36; boss after 42 | 14, 36; boss after 42 | never |
| folio | 2 | 17, 37; boss after 47 | 17, 37; boss after 47 | never |
| folio | 3 | 15, 30, 49; boss after 56 | 15, 30, 49; boss after 56 | never |
| birdie | 1 | none; boss after 7 | none; boss after 7 | never |
| birdie | 2 | 20; boss after 31 | 20; boss after 31 | 20 |
| birdie | 3 | 15; boss after 45 | 15; boss after 45 | never |

Birdie's extra seeds, the strong crowd (seeded, before and after: the same battles; the line never reached):

| boss | seed | before: ultimates (his turns), result | after: ultimates, result | first danger (crowd move) |
|---|---|---|---|---|
| birdie | 4 | 19; boss after 58 | 19; boss after 58 | never |
| birdie | 5 | 20; boss after 43 | 20; boss after 43 | never |
| birdie | 6 | 28; boss after 60 | 28; boss after 60 | never |
| birdie | 7 | 21; boss after 40 | 21; boss after 40 | never |
| birdie | 8 | 24; boss after 36 | 24; boss after 36 | never |
| birdie | 9 | 21; boss after 60 | 21; boss after 60 | never |
