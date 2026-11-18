# Battle Tower PR 6: several bosses in the runner (Nov 18). Opus, xhigh, alone. FULL lane (the runner's core)

Branch `claude/tower-several-bosses` from main (PRs 1-5 merged: every boss on the board layer). About 2-3 h. Read CLAUDE.md,
`.claude/LESSONS.md`, `docs/decisions/2026-11-18-battle-tower-design.md` (section 2 in full; build-plan row 6; the move list's
LIMITED rules), `docs/areas/battle-tower.md`, `docs/areas/bosses.md`, the four `*-on-the-layer.md` decisions.

Build exactly row 6: the match can hold 1-3 bosses on one side (`bosses: BossState[]` or the design's shape), the turn order (the
order dealt; each keeps "his turn"), every boss's turn steps run for his own turn, the merged layer (`mergeLayers` over every boss's
marks), one ultimate and one cinematic per turn change (the moments queue), `rageScale` (100/75/60% for 1/2/3 bosses, a setting),
the design's LIMITED rules (Wrangler's showdown reply out of turn; Hollow's second move; the race brain over every boss; Smudgy's
disguise binding all; Folio's Revision after its own move only), Hollow and Smudgy kept apart (`BATTLE_TOWER.apart`).
**The guard: a one-boss battle doesn't change at all** (every boss battle today is the 1-boss case): the boss kit, every boss's tests,
the four layer twins, the server's boss lobby tests and parity pass unchanged; any check you must edit is listed old → new with why.
**New:** the boss kit run over seeded pairs and threes (every pair at least once; a sample of threes), solo and the server's path
agreeing (parity); a rule (the design's style, one line) for any pair it finds breaking, reported to the director, not silently fixed.
No screens yet (PR 10), no tower rules yet (PR 8): a test switch or a runner option to start a battle with 2-3 bosses is enough.
Lean: only the tests you touch plus the kit; CI runs the full suite (`full-e2e`). Done: `.pr-body.md` (under 50 lines: what changed,
the 1-boss guard's evidence, pairs/threes results, changed checks old → new) and `.done`; push and end. No PRs, no CI waits.
