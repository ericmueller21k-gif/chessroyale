# 200 resident players: a living soft launch (Nov 25). Opus high, `ops` lane, DESIGN ONLY (read-only + a doc). No deploy, no spend

Eric (Nov 25): "a big thing I think we need to do is literally have 200 bots made which just sit on the server and play ranked, play 50v50
(can just fill these up with the default bots too), so like any time of day I can login and see games played, we need to simulate a small
soft launch as much as we can, should see them on the leaderboards, etc. mirroring a fully real small player base, even opening crates and
stuff maybe, unless that's too complex which is fine, the main thing is playing the game modes and seeing what we learn from this and what
needs to be fixed".

Start: `git fetch origin main && git checkout -B claude/residents-design origin/main`. Read CLAUDE.md (computing priorities; "simple beats
flashy"), `docs/areas/ops.md`, `accounts.md`, `ranked.md`, `matchmaking.md`, `crowd.md`, `fairplay.md`, `shop.md` (crates), and the swarm
audit on branch `claude/director-notes`, `notes/swarm-audit.md` (what exists: `scripts/load/player.ts`, `scripts/squads-headless.ts`,
`scripts/cheater-demo.ts` (real Crowd on production through an Access service token, real Stockfish/Maia judging), friend bots, test
accounts, server-side bots that fill seats).

Director's calls (record them in your doc; change one only with a strong reason, stated):
- **Production (hunchess.com), not staging.** Pre-launch only Eric is on production (Zero Trust), and he wants to log in any time and see a
  living game. So the residents are real accounts flagged as residents (stored flag), playing through the real paths with real judging
  (no made-up host scores), visible on the live count, leaderboards, profiles and the town like real players. **One kill switch** stops
  them at once; **one purge** removes every resident and everything they made (games, ratings, ladder rows, inventory, chat, fair-play
  rows) before launch. Both must be designed, and tested later.
- **200 accounts, behaving like a small real player base:** varied names (through the name filter), looks (locker items), skill (Maia
  levels spread like a real ladder), schedules (online in waves over a day by time zone, sessions of 10-60 min, not all at once: maybe
  20-60 online at a time), behavior mixes (leavers, slow, chatty, rage-quit after losses: some of each, small shares).
- **Modes:** ranked 1 v 1 (resident vs resident, and Eric meets them when he queues), 50 v 50 (residents join; the rest filled by the
  usual bots), then Squads, boss raids, the tower if cheap. Crates: open what they earn, if cheap (phase 2).
- **Fair play:** residents play Maia-like human moves, never engine-perfect; flag none by default but keep their signals visible (what
  we learn). They must never ban Eric or real players by reporting.

The doc must answer, from the code:
1. **Where the residents run:** (a) server-side inside Cloudflare (e.g. a Residents Durable Object with alarms that drives accounts through
   the matchmakers and lobbies as internal players, moves by the server's own bot logic or Maia somewhere), or (b) an external headless
   generator (GitHub Actions cron on the public repo, 6 h jobs back to back; or a small always-on VM), reusing player.ts / squads-client /
   cheater-demo through an Access service token. Weigh: least code and fewest ways to break (Eric: "easier code and less lag over all
   else, fewer bug risks"), real paths exercised (the point is to find what breaks), cost, and where moves come from (Maia/Stockfish
   CPU for ~10-30 concurrent games). Recommend one.
2. **Running cost per month** (Cloudflare requests, DO time, D1 writes, engine containers, Actions minutes or a VM), with the numbers
   shown, at 200 residents and ~40 online on average. What needs Eric to buy or sign up for, if anything.
3. **The plan in PRs** (each with its lane: anything stored or accounts is FULL lane), the order, effort per PR, and what Eric gets to see
   after each (e.g. PR 1: 200 accounts + 1 v 1 only; PR 2: 50 v 50; PR 3: a resident dashboard on the admin page: who's online, games
   today, errors; PR 4: crates...).
4. **Risks:** what could break real play or Eric's account (his rating against residents is fine), data that can't be purged cleanly,
   load on the single hub/matchmaker objects, the engine server's daily re-checks, fair play.
- Deliver: `docs/decisions/2026-11-25-residents-design.md` is NOT the place (it's a design, not a decision): write
  `notes-residents-design.md` at the branch root, push, `.done`, stop. Commits end with only
  `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). About an hour; read, don't run sims.
