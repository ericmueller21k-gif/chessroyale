# The Hidden Boss's child and adult forms online: no random move either (Eric's option 1), plus #683's small follow-ups

Effort xhigh, full lane (server, the online match). Branch `claude/recluse-phase1-pause` from main. Read CLAUDE.md, `docs/areas/bosses.md`
("Phase 2 online"), `docs/decisions/2026-11-13-recluse-server-only.md`.
## Today (phase 1 online, every boss: lobby.ts BOSS_CHECK)
The host's device makes his move (Maia; Stockfish's seeded move where Maia isn't loaded), a second device checks it, the engine server
arbitrates a disagreement. With no device answering at all (`bossTimeout`), he plays a RANDOM legal move.
## Build (Eric, Nov 13, option 1: "Keep Maia on the devices, but replace the random-move fallback with the same pause plus a server move")
- In the Hidden Boss's fights (his room's and the Crowd's boss final), when no device answers his move: no random move. Pause his fight
  ("He's thinking…", the same pause as phase 2's; nobody's clock runs anyway on his turn, so check what pauses mean in phase 1) and ask
  the engine server for a move at his strength: the child's Maia rating via Stockfish's stand-in (`levelForMaia`, `bossEloNow`) or the man's
  fixed level. Server answer → play it. No answer in `RECLUSE_ONLINE.serverWaitMs` → no result for the board players' phase (as phase 2's
  no result: board players nothing counts; others' results stand).
- Other bosses: unchanged (say so; a follow-up for Eric if he wants it for all bosses).
- #683's delta review minors (`git show origin/review/683-delta:review.md`): m1 don't await the D1 count before his search (count in the
  background); m2 the daily digest reads yesterday's UTC row too ("yesterday N, today so far M"); m3 write down the bots-device call
  honestly in the decision note (the reviewer's point).
## Tests
Server unit tests (no device answers → pause → server move; → no result; the child's strength used), typecheck, unit tests of packages
touched, `e2e/hidden-boss-room.spec.ts` both projects. Ask for `full-e2e` in the PR body. `.pr-body.md`, push WIP at each step, `.done`.
No PRs, no CI waits, no model names in commits. Never stop silently.
