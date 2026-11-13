# Independent review: PR (the Hidden Boss online: phase change + four boards), read-only

Effort xhigh. Read CLAUDE.md, then `git diff origin/main...origin/claude/recluse-online-phase2` and its PR body (the director's copy:
`notes/briefs/recluse-online-phase2-pr-body.md` on this branch). Full lane: server, protocol, the online match, fair play.
Look for:
- the four boards online: a move accepted out of turn, on another's board, illegal, or twice (two taps, a retry, two tabs); clocks and
  flags wrong across devices; the phase change's timing not the same for everyone; a reload mid-phase losing or doubling state;
- the engine server path: budget accounting (a search counted twice or never), a hang when the server doesn't answer (the host-device
  ask, `askMs`, the quick move), a host device that lies (`phase2Answer` trusted beyond the bots' moves? could a player make HIS moves
  weaker?);
- the 🏆 and the ultimate trigger reachable by a non-admin or outside his fights; XP, coins, ranked or fair-play records from a
  forced or test fight;
- leaving/resigning: the bot takeover, the leaver's loss, everyone gone;
- fair play: each person's move judged; nothing judged for bots;
- the Crowd's boss final (50 v 50) reaching him online: the top 4's seats, watchers, any change to existing Crowd results;
- the protocol additions staying optional for other lobbies; existing modes' results unchanged.
Run the server, core and app unit tests (`npx vitest run packages/server packages/core packages/app`) and typecheck. No e2e runs.
Write `review.md` on orphan branch `review/recluse-online-phase2`: findings blocker / major / minor with file:line and a failing case,
or "no findings"; push it and stop. About 30-45 minutes.
