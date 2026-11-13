# Independent review: PR #676 (the street town for everyone; the old town deleted), read-only

Effort high. Read CLAUDE.md, then `git diff origin/main...origin/claude/street-for-everyone` and the PR (ericmueller21k-gif/chessroyale#676).
Look for: any path where a player or guest can still reach old Canvas 2D town code (URL params, fallbacks, a missing WebGL 2 path);
anything the old town did for players that the street town now misses (guests' limits, AFK and the server's drop, bots, chat, doors,
the Colosseum, music, the minimap, the Hidden Boss's walk-up and his room's challenge flow from #673); admin-first homes leaking into a
player's town or its lots breaking walkability; e2e checks loosened rather than moved (each changed check should keep its intent, above
all Eric's rules in `docs/rules/eric.md`); deleted code still referenced (typecheck); frame-rate risk on a phone for guests.
Run `npm run typecheck` and the app unit tests (`npx vitest run packages/app`). No e2e runs.
Write `review.md` on orphan branch `review/street-for-everyone`: findings blocker / major / minor with file:line and a failing case, or
"no findings"; push it and stop. About 30 minutes.
