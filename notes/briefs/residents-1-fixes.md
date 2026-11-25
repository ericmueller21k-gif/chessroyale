# Residents PR 1 (#931): review fixes (Nov 25). Opus xhigh, FULL lane. A fresh helper; the review is the handoff

PR ericmueller21k-gif/chessroyale#931, branch `claude/residents-server` (head 9b19454e). Review: branch `review/residents-server`,
`REVIEW.md` (read all of it). Design: `notes/residents-design.md`. Start: `git fetch origin claude/residents-server review/residents-server
&& git checkout -B claude/residents-server origin/claude/residents-server`.

Fix on the same branch (each with the test the review names, failing first, then passing):
- **M1** `residentsOnly` (lobby.ts:232): drop `h.connected &&` ("no real person still in this match"); `judges.test.ts` "p3 away" expects
  1 server ask, like "p3".
- **m1** reconnect: in `connect()`'s existing-seat path, a returning non-resident while the host is a resident → `hostId = hostNow()` +
  `resendHostWork()`; the resident's late `scores`/`bossMove` is ignored. Lobby test: "Eric drops in scoring, returns, re-asked; the
  resident's answer is dropped".
- **m3** gate `phase2Search`/`warm` in `phase2Lobby` on `!residentsOnly(lobby.r)` (the existing "no result" path); test; `engine.md` true.
- **m4** DIRECTOR CALL: leave residents' picks out of `others`/`crowd` for a NON-resident's `FairMove` (a real player's hard finds are
  measured against real people only; residents' own rows keep everyone). Test. One line in the decision file.
- **m5** the tests: assert the duel side's connected/away state (not just "changed"); Squads: a seated resident's next message closes
  it and its seat leaves; DuelGame and Squads reached through their own door (session → `resident`) at least once each.
- **n1** content-length check before reading; **n2** key the pause cache by the token's hash; **n6** pass `resident` into `connect()`.
- Leave for later (write them in the decision file's "later" list): m2 (PR 4: count distinct residents), m6 (PR 3: pin
  `OPS_ACCESS_CLIENT_ID`), n3/n4/n5 (the program, PR 2), n7, n8 (PR 4), n9 (design wording).
Run typecheck + the server unit tests. Update `.pr-body.md` ("Review fixes" section; changed checks old → new, incl. judges "p3 away"
0 → 1). Push, `.done`, stop. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`
(no Co-Authored-By). Effort xhigh. About an hour.
