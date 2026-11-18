# Big Boy's tower (#784, branch claude/bigboy-tower): his rare topple + bring his strength back into the pack. engine + god-king lanes. Opus, xhigh

Branch `claude/bigboy-tower` (head a81d016): `git fetch origin claude/bigboy-tower && git checkout -B claude/bigboy-tower origin/claude/bigboy-tower`,
push to it. About 1.5-2 h. Read CLAUDE.md, `.claude/agents/engine.md`, `.claude/LESSONS.md`, `docs/decisions/2026-11-18-bigboy-tower.md`,
the brief `notes/briefs/bigboy-tower.md` on claude/director-notes (Eric's words and his answers at its end), `reports/boss-calibration.md`.

1. **Eric's answer the first pass missed:** "both but he usually doesn't": his pieces may also move onto a tower of height >= 2 and topple
   it (same scatter and lifetimes, timed from his move: the blocks stand through the crowd's next turn and his next, then go), but rarely:
   only when it's his engine/brain's clear best move (no special bonus), or a small seeded chance; record the call. Tests.
2. **Strength (the first pass's sim):** crowd 0.02 (0 wins of 26) against today's 0.27-0.35. He's far too strong now and his offset can't
   go lower (Stockfish's floor). Bring the crowd's score back near today's (0.25-0.35) with the fewest changes to Eric's design, in this
   order (the first pass's proposal): scatter only half the tower's height (rounded up); `towerScatterReach` 2; the crowd's topple's blocks
   stand through his turn only (not the crowd's next too) ONLY if needed (it changes Eric's confirmed rule: if you need it, stop and push
   `.question` for Eric instead); `towerMax` 6 last. One sim run per setting tried, at most three runs (the raid sim the first pass used,
   same seeds); report each.
3. Note the fair-play side effect for the director: nearly every turn is a power turn now. Propose (don't change) whether the tower's
   stacking turns should count as power turns for fair play (only turns where a block actually limits a legal move?).
Run typecheck, bigboy tests, the boss kit, e2e `bigboy.spec.ts` phone. Update `.pr-body.md` (the sim table, the changes, changed checks) and
push it with `.done`, end. No PRs, no CI waits.
