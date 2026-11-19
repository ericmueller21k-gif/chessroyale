# Battle Tower PR 14: one sim run, modest (Nov 20). Opus, medium. Light lane (a report)

Eric, Nov 20: "Bot simulation. I don't even know if you really need to go all 99 right now, unless that's something that doesn't take
usage because it just runs on the simulator." So: keep it small and let the CPU do the work, not your turns. Branch `claude/tower-sim`
from main. Read CLAUDE.md, the design `docs/decisions/2026-11-18-battle-tower-design.md` (§3: the floors, `maiaStep`, `rageScale`;
§7 row 14), `docs/areas/battle-tower.md`, and the existing sims (`packages/sim/scripts/boss-sim.ts`, `npm run simulate`).
- A script `packages/sim/scripts/tower-sim.ts` (reuse the boss sim's runner and the boss kit's battle driver): bot climbers at a few
  player strengths (e.g. 1000, 1500, 2000 Elo stand-ins) climb from floor 1 with the real deal (`core/tower.ts`), each floor a real
  battle with its bosses and strength, until a loss or floor 50 (Maia's floors; Stockfish's 51-99 are left for later, say so).
  About 10 runs a strength. One background command; while it runs, wait with `timeout 590 bash -c 'until …; do sleep 30; done'`, never
  by checking every few seconds.
- The report `reports/tower-sim.md`: how far runs get at each strength, the floors where they fall, 1 vs 2 vs 3 boss floors' win rates,
  and whether `maiaStep` (100) or `rageScale` look off (a proposal, not a change). Under 60 lines.
Done: `.pr-body.md` (under 20 lines) and `.done`; push and end. No PRs, no CI waits.
