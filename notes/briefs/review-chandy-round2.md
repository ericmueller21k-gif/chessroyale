# Review: Chandy round 2 (PR #745, branch claude/chandy-first-lock). One quick pass (boss lane), read-only. Opus, high

About 30 minutes. Read `CLAUDE.md` (the boss lane), `docs/areas/bosses.md` (Chandy), the brief `notes/briefs/chandy-first-lock.md` (on
`claude/director-notes`), then the diff `git diff origin/main...origin/claude/chandy-first-lock`. No fuzz, no sims, no code changes.

Real bugs only, ranked: a battle that hangs or breaks (the server holding the host's move 0.9 s for the first lock: a host that
disconnects then, a move that isn't a capture after all, a capture that's also check or mate; Dodge's two hits and the kill: the
result arriving for everyone online, the last chance's Dodge, reconnect mid-kill); solo vs online disagreeing (`beforeShow`); a lock
on the king or a queen lock pre-check skipped by `fireOnUnlock`; Dodge's longer timeline vs the server's timers and the 300 ms grace;
anything sent to clients early (the volley's lines, the safe squares); per-frame cost of the kill (5 s of beams, particles, shards).
Each finding: file:line, the failing case, a fix in one line. Write `review.md` (at most 1 page) to the orphan branch
`review/chandy-round2` and push. Commits end with the Claude-Session line only, no model names.
