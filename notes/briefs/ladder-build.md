# Season ladder: build (Nov 25). Opus xhigh, one PR, FULL lane (a new D1 index: stored data). Starts after residents PR 1 + PR 2

Eric (Nov 25) on the mockup (`stills/ladder-mockup`, NOTE.md; code `claude/ladder-mockup`): "Looks great mockup should be scrollable to the
top 200 id say?" Director calls: the phone's way in is **A** ("LADDER ›" at the right of home's RANKED label; the mockup's pick, Eric said
"looks great" and named no other); the computer's is the left panel's "Ladder" as in the mockup.

Start: `git fetch origin main claude/ladder-mockup && git checkout -B claude/ladder origin/main`, then bring over the mockup's
`screens/Ladder.tsx`, `ladder.ts`, `ladder.css` and the way-in pieces (drop the `?ladder=mock*` / `?ladderin=` switches except one test
switch for e2e if needed). Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`, `docs/areas/hub.md`, `docs/areas/ranked.md`.

- **The list: the top 200, one scroll** (Eric). No "Show the next 100": the list ends at 200 (or fewer). Your own row pinned at the foot,
  always, with your exact place even below 200 (a count on the index), or the placement line, or "Sign in to join the ladder" for a guest.
- **Server:** `GET /api/ladder?mode=1v1` → `{ season: 1, total, rows (≤200), you }`, as NOTE.md's endpoint but one page of 200: the
  partial index `ranked_1v1_board (ladder DESC, user_id DESC) WHERE games >= 5`, places with ties shared (as `topPlace`), one batched read
  of the 200 players' looks (no per-row `lockerState`), banned/engine-pool/test accounts left out (residents are IN: they're real-looking
  players by design). Edge cache 60 s for the rows; `you` per player, uncached. Tests in the server package.
- **Tab order mirrors home's RANKED row (Eric, Nov 25): 50 v 50 · 1 v 1 · Squads, with 1 v 1 in the CENTER and selected when the page opens.**
- **50 v 50 and Squads tabs:** greyed "No ranks yet", a tap says why (as the mockup). Not hidden.
- **App:** loading as greyed rows (nothing shifts), the profile tap, the town's and a match's menus' "Ladder" wired, `e2e/areas.json`
  places the new files, one e2e check (the page opens from home's A and the computer's panel; rows ≤ 200; your row pinned).
- Docs: `docs/areas/hub.md` + `ranked.md`, a short decision file. `.pr-body.md` (lane: full; changed checks), stills on
  `stills/ladder` (phone 428 + computer, dark), `.done`, push, stop. Commits end with only
  `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Effort xhigh.
