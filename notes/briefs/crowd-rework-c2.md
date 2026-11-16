# 50 v 50 rework, step C2: runner, server and protocol. Opus, xhigh (the match runner, server, protocol). Targeted lane

Branch `claude/crowd-rework-c2` **from `origin/claude/crowd-rework-c1`** (C1 is PR #760, CI running; merge `origin/main` into yours
once it lands). Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/crowd.md`, the design (`git show origin/design/crowd-rework:notes/designs/crowd-rework.md`,
section 3's runner/server/protocol part and the C2 row) and PR #760's body ("For C2").

**Do:** switch 50 v 50 to the rework: `CROWD_SETTINGS` takes `CROWD_REWORK`. 50 v 50 never enters a final (no team final, no Hidden
Boss final, no duel: his code stays, unreached); the 1 v 1 is an ordinary stage with one player a side, whose pick is played. The game
ends by the chess rules (mate, stalemate, repetition, fifty-move rule, insufficient material, a flag fall) or at `crowdMoveLimit`
(`crowdLimitReached`, then `crowdLimitVerdict`), then `finishGame`; a game over on a cut's move cuts nobody; who left goes to
`bestPlayer`/`crowdPodium`. Strong's pick comes from the agreed judgment (the same numbers the scores use), never one device's.
**The director's call:** no shared-blunder relief once a side is 4 or fewer (a lone pick isn't a crowd's shared blunder): one setting.
Protocol: optional fields only: `results` gains `podium { winner?: id; best: id }` and per player `outAtMove`, `perMove`; the vote's
new id. The app reads the votes with `pregameVotes(settings)` (`net.ts`, `Vote.tsx`), not `PREGAME_VOTES` by index. Server (`lobby.ts`):
the vote's patch, the move-limit end, places in the new order (no schema change). Screens beyond what's needed to not break are C3.
**Checks:** `crowd.test`, `lobby.test`, `resign.test`, the boss kit if touched; the e2e specs C2 breaks (`crowd.spec`, `formats.spec`,
`votes.spec`, `crowd-hidden.spec` may need C4's retirement: if a spec only tests the old endings, mark it for C4 in the PR body, don't
delete it here). Old → new for each changed check. Push at each real step; `.pr-body.md` (under 60 lines) and `.done`. Commits end with
the `Claude-Session:` line only, no model names. No PR, no waiting on CI.
