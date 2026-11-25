# Residents PR 1: server foundations (Nov 25). Opus xhigh ALONE, FULL lane (`full-e2e` label). Eric wants residents playing TONIGHT

Design: `notes/residents-design.md` on `claude/director-notes` (read §0, §1, §3 "PR 1", §4). Eric (Nov 25): Cloudflare Container OK
(~$50/mo, usage-billed); "I wanna get it running tn". So this PR is SLIM: what must exist before any resident touches production.

Start: `git fetch origin main && git checkout -B claude/residents-server origin/main`. Read CLAUDE.md, `docs/areas/ops.md` (kill
switches), `accounts.md`, `fairplay.md`, `ranked.md`, `packages/server/src/test-accounts.ts`, `pauses.ts`, `fairplay.ts`, `lobby.ts`
(`pickHost` ~1097, `serverOn` ~3861).

IN this PR:
1. **The flag** `users.resident` (migration as the schema does it; residents are NOT `test`: they count on rankings, top places, name search).
2. **`/api/admin/residents`** (a copy of `handleTestAccounts`): `POST {name, look?}` makes/signs in `<slug>@resident.hunchess` (name through
   `cleanName` + the filter; seeds 0-3 common locker items through the ledger, op `resident-seed:<id>`; reuses the newest unexpired
   session); `GET` the list + today's counts; `POST /beat` stores the program's last heartbeat in `meta`. Callers: admin, the e2e key,
   Access with the token `RESIDENTS_CLIENT_ID` names, **and, for tonight's first runs from the director's session, the token
   `TEST_ACCOUNTS_CLIENT_ID` names** (the director's existing one; note it in the decision file: removed or kept when PR 3 lands).
   Refused while paused.
3. **The kill switch `PAUSE_RESIDENTS`** (the `PAUSE_<NAME>` family): 503 for a resident session on every `/api/*`; every DO (Lobby,
   DuelGame, SquadsLobby, SquadsParty) refuses a resident `hello` and closes resident sockets on their next message (seats → bots under
   the usual leaving rules). Tests for each part.
4. **Fair play:** record residents' signals as anyone's; never open/escalate a case for a resident (count "would have: watch/review/pool"
   instead); residents' reports never count; no engine pool, no deep re-checks for residents.
5. **Engine server:** off for a lobby whose connected people are all residents (as `ENGINE_OFF`); a real person joining turns it on.
6. **Host rule:** `pickHost` passes over residents while a non-resident is connected.

NOT in this PR (later, before launch): the purge (PR 1b, its own full-lane PR with the table-coverage guard test), the container (PR 3),
the dashboard (PR 4). Leave a TODO line in ROADMAP's launch checklist: "purge residents; remove RESIDENTS_CLIENT_ID and the token".

Docs: `docs/decisions/2026-11-25-residents-server.md` (short), `docs/areas/ops.md` (kill switch list), `accounts.md`, `fairplay.md`.
Tests: unit tests for each part (server package), plus one e2e check only if a screen changes (none should). Run typecheck + the server
and core unit tests you touched. Write `.pr-body.md` (what, why, the full-lane note, changed checks). Push at each real step; `.done`,
push, stop. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By).
Effort xhigh (accounts, stored data, fair play, the server). Aim: 2 hours.
