# The Battle Tower audit: the auditor's brief

**Who reads this:** an independent auditor (a fresh session: Fable, effort high; Eric, Nov 18: "we want it to look for optimization or
issues"). You are read-only: you inspect, measure and write findings; you don't push fixes to anyone's branch. This file is your
whole job description. Read it to the end before opening any code.

## 1. What the Battle Tower is (how it's supposed to work)

The full design, with every call Eric settled: [docs/decisions/2026-11-18-battle-tower-design.md](../decisions/2026-11-18-battle-tower-design.md).
Its area page: [battle-tower.md](battle-tower.md). In short:

- **A climb of up to 99 floors**, alone or as a party of up to 4, opened from the town's clerk only (Eric, Nov 19: no home card). It replaces nothing.
- **Each floor is one game of chess** from the starting position, you as White, against 1, 2 or 3 bosses at once on one board. The
  boss count loops 1, 2, 2, 3. The bosses share the other side and take turns moving in the order they were dealt; each keeps his own
  powers and his own meter (slower on shared floors: 100%, 75%, 60%).
- **Every boss's moves are in** (the Hidden Boss isn't in the tower), a few with a one-line rule in the design's move list. Hollow and
  Smudgy never share a floor. Every boss behaves on a tower floor as he does in his own battle, except where the design's move list
  says otherwise.
- **The bosses get stronger every floor:** Maia from 600, +100 a floor, capped at 2500 (a lone boss +200 within the cap); from floor
  51, Stockfish from 2500, +25 a floor, to full strength from floor 80. Every number is a setting in `BATTLE_TOWER`
  (`packages/core/src/settings.ts`).
- **One loss ends the run.** A draw ends it too; leaving mid-floor is a loss (free before your 2nd move).
- **A party picks every move together:** the move most picked is played, a tie goes to the engine's best (`partyMove`), a member
  who picks nothing follows the Boss Battle party's no-pick rules.
- **Saving:** stop between floors and come back later. Runs are saved on the server (`tower_runs`, `tower_best`), guests included;
  a solo floor in progress is kept on the device and rejoined after a reload.
- **The room:** one snug room in HunChess's colors for every floor (the town's challenge room as the model), the floor's number big
  on both side walls, the bosses walking in through the top door.
- **The foundation is the board layer** (`packages/chess/src/board-layer.ts`): one state per square, edge and piece (open, no
  landing, no passing, walls, held, shielded…), every boss's marks at once, the most restrictive mark winning, and one "always a
  legal move" lift. Today's bosses move onto it with no change to any boss battle.

## 2. When you run

The director starts you at three points of the build (the design's build plan, section 7):
1. **After PR 6** (the board layer, today's bosses on it, several bosses in the runner): the rules core.
2. **After PR 10** (the climb's rules, saving, the solo screens): the first playable solo tower.
3. **After PR 12** (the party): the whole mode.

Each time, audit what's on `main` plus any open Battle Tower PR the director names. Read the earlier audits in
`docs/decisions/` (`*-battle-tower-audit-*.md`) first, and don't repeat a finding that's been fixed or answered.

## 3. What to look for, in this order

**1. Never compromise the game (CLAUDE.md, Eric's first priority).** Wrong results, an illegal move allowed or a legal one refused,
a player left with no legal move, a power landing on the wrong side, a floor that can't end, a run that saves the wrong floor or
loses progress, solo and online disagreeing (every pick is seeded from the game's seed: the same on every device and the server),
a reconnect or reload that breaks a floor, two bosses' marks combining wrongly (the most restrictive must win), a boss behaving
differently in his own battle than before the tower (the boss kit and every boss's tests are the guard: check they still cover
him), the party's vote counted wrongly, rewards paid twice.

**2. Lag on a phone (Eric, Oct 14: "we want easier code and less lag over all else, fewer bug risks").** Work done every frame or
every move that needn't be: recomputing legal moves or the layer for every square when one changed, re-rendering the whole board,
two or three bosses' moments animating at once (the design allows one at a time), engine calls that could be cached, timers left
running after a floor ends, memory that grows over a 99-floor run. Measure where you can: the repo's `@perf` specs
(`npx playwright test --grep @perf --project phone`) and a slowed phone; give numbers, not impressions.

**3. Simpler code (CLAUDE.md: "Simple beats flashy").** The same idea written twice (a boss rule copied instead of moved onto the
layer), special cases the layer should have made unnecessary, settings hard-coded instead of read from `BATTLE_TOWER`, dead code
left from the old per-boss checks, a fix that added a checker instead of fixing the cause (CLAUDE.md, Nov 13).

**4. Stored data and fair play.** The D1 tables and routes (`packages/server/src/tower.ts`): a run that can be forged or replayed,
progress lost on sign-in merge, export and delete missing it, a solo result trusted for a reward (the design pays crates only for a
party's run: check), fair play's power turns with several bosses (a floor that leaves fair play nothing to judge).

**5. The design itself.** Where the code shows a rule in the design is unworkable, ambiguous or likely to feel bad in play, say so
as a finding for the director (and Eric), with the evidence.

## 4. How to work

- Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`, this file, the design, then the code. Use the repo's own commands
  (CLAUDE.md, "Layout and commands"). Run only the tests you need to prove a finding (the touched units, a spec, `@perf`); no fuzz
  marathons, no full-suite runs (CI does that). Aim for about 1.5 hours.
- **Prove each finding:** a failing test or a throwaway script you ran (don't commit it to the build's branches), a trace, or a
  measurement. A finding you couldn't prove is marked "suspected" with what would prove it.
- Don't edit the build's code or its tests. Never touch a guard test of `docs/rules/eric.md`.

## 5. What you hand back

On a branch `audit/battle-tower-<n>` (n = 1, 2, 3 for the three points above) from `main`, commit
`docs/decisions/<date>-battle-tower-audit-<n>.md` and an empty `.done`; push and end. The file:

1. **Summary**, three lines: what you audited (commits, PRs), the verdict, the one thing the director should do first.
2. **Findings, most severe first.** Each: severity (blocking / high / medium / low / nit), the file and line, the scenario (what
   happens, to whom, how to reproduce it), the proof, the fix you'd suggest (the least code), and which section of §3 it falls under.
3. **Measurements** (§3.2): what you ran and the numbers.
4. **Checked and found right:** the areas you went through with no finding, so the next audit knows what's covered.
5. **For Eric** (only if any): a rule of his design that the code shows should change, in one line each.

American English, plain words. Commits end with only the line `Claude-Session: <your session link>`.
