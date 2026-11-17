# 50 v 50 rework, step C4: retire the old endings. Opus, medium. Targeted lane

Continue on branch `claude/crowd-rework-c2` (C2 is done there; this lands in the same PR, so main never runs specs for endings that
can't be reached). Read CLAUDE.md, the C2 branch's `.pr-body.md` ("For C4", "For the director") and `docs/decisions/2026-11-16-crowd-rework-runner.md`.

**Do:** retire what only tested the 50 v 50's old endings, now unreachable: `e2e/formats.spec.ts` "team final: the top 8 play 4v4…",
`e2e/crowd-hidden.spec.ts` (all three: the Hidden Boss's 50 v 50 final; his own code stays, unreached, Eric Nov 16), their entries in
`e2e/areas.json`, the unit tests and sims that now run on `CROWD_PRE_REWORK` only to keep the old endings alive, the dead settings
(`crowdPlayedFromTop`, `crowdTopOdds`, `crowdSureShare`, `finalFormat`, `teamFinal*`, … where nothing reached uses them; raids keep
theirs), and `CROWD_PRE_REWORK` itself if nothing needs it after. **Not** the guard in `docs/rules/eric.md` "a big majority always wins"
and its test (`crowd-afk.test.ts`): it waits for Eric's OK (asked Nov 17); leave it on `CROWD_PRE_REWORK` as C2 did.
Each removed test is named in `.pr-body.md` (old → removed, and why: the ending can't be reached). Keep the Hidden Boss's raid/admin paths
and `e2e/recluse.spec.ts` untouched.
**Checks:** typecheck, the unit tests you touch, `e2e/formats.spec.ts` and `e2e/crowd.spec.ts` locally (phone). Update the C2 branch's
`.pr-body.md` with a "C4" section; push; write `.done` again. Commits end with the `Claude-Session:` line only, no model names. No PR.
