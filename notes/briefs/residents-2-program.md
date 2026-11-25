# Residents PR 2: the program + ranked 1 v 1 (Nov 25). Opus high, targeted lane. Runs BESIDE PR 1 (Eric OK'd two at once tonight)

Design: `notes/residents-design.md` on `claude/director-notes` (§0, §1 "What the program reuses" and "Engines", §3 "PR 2"). PR 1 (the
server: flag, `/api/admin/residents`, `PAUSE_RESIDENTS`) is being built at the same time on `claude/residents-server`: fetch it often and
code against its route types; merge it into your branch to test. Eric wants residents playing 1 v 1 TONIGHT.

Start: `git fetch origin main claude/residents-server && git checkout -B claude/residents-program origin/main`. Read CLAUDE.md,
`scripts/cheater-demo.ts` (Access headers, account route, Maia "as people play", Stockfish/Maia in Node), `scripts/load/player.ts`
(heartbeat, reconnect, PLAY queue), `docs/areas/ranked.md` (the queue `/api/1v1/*`, `DuelGame`, leaving rules), `packages/app/src/duel.ts`
(how the app plays 1 v 1).

Build `scripts/residents/` (Node, TypeScript, run with tsx):
- `run.ts`: `--base <url>` (default hunchess.com; Access headers from `CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET` env, never printed),
  `--accounts 200`, `--target-online 30`, `--hours <n>` (0 = forever), `--modes 1v1`. Refuses to run while the server says paused; stops all
  residents cleanly on SIGTERM and when the server pauses them (503/closed sockets).
- `names.json`: 200 reviewed handle-style names (never a real person's name or a hint of one; never "bot"/"resident"). Looks: seeded items +
  pawn color + free icon, set once.
- Skill: a fixed Maia rating per resident (bell around 1150, 600-2200, steps of 100, as `BOT_LOBBY.ratings`), moves DRAWN from Maia's
  policy. A small engine pool (Maia one process; Stockfish only if 1 v 1 needs it: it shouldn't, no judging in 1 v 1).
- Schedules: home time zones, daily shape, sessions 10-60 min, seeded by resident and day; the scheduler keeps ~`target-online` online in
  waves. Behaviors per design (normal 70, slow 8, leaver 5, AFK 4, chatty 8 (presets only), rage-quit 5; 2% socket drops + rejoin).
- 1 v 1 client: queue with the ticket, the stage vote, clock-aware think time, rare draw offers, resign rules; each resident its own cookie
  jar (session + fair play's device cookie). Two residents sometimes queue alone so a queuing Eric meets one within seconds.
- Heartbeat `POST /api/admin/residents/beat` each minute (counts by state, errors by kind).
- Logs: one line per event to stdout, no cookies or tokens; a summary every 5 minutes.
- Proof: unit tests for the scheduler and profiles (vitest, in the repo's test setup); a local run against `npx wrangler dev` with
  PR 1 merged in (20 residents, 15 minutes, games finish, the switch stops them). Do NOT run against hunchess.com: the director does the
  first production run.
- Docs: `docs/areas/ops.md` (a "Residents" section: how to run it, the switch), decision file. `.pr-body.md`, `.done`, push, stop.
  Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Effort high.
