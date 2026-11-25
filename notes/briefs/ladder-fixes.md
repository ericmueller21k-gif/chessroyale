# Season ladder (#935): review fixes (Nov 25). Opus xhigh, FULL lane. A fresh helper; the review is the handoff

PR ericmueller21k-gif/chessroyale#935, branch `claude/ladder` (head fe44ac86). Review: `REVIEW.md` on branch `review/ladder` (read all).
Start: `git fetch origin claude/ladder review/ladder && git checkout -B claude/ladder origin/claude/ladder`.

Fix on the same branch, each with a test that fails first:
- **M1 + m4 (one path, server-side):** in `handleLadder`, after the shared top comes back, build the viewer's own copy: drop any stale row of
  theirs, insert their fresh row in ladder order (`ladder DESC, user_id DESC`), shift the places of shown rows below them by 1 when they're a
  left-out viewer (they weren't counted), `total` + 1 for a left-out viewer, trim to `LADDER.size`. Whether the viewer is left out is read in
  `ladderYou`'s own query, never in the answer. The JSON a pooled player gets must be indistinguishable from an honest player's in the same
  spot. `rowsWithYou` in the app becomes a no-op or goes. Rewrite the two tests that pinned the leak (n2) to assert the "as ever" view,
  including the short-ladder bottom case.
- **m3 DIRECTOR CALL:** follow fair play's documented hook (`eligibleForRanked`: not while in review or banned): add `review` to `LEFT_OUT`,
  so the ladder and the top tiers' place leave out players under review; they get M1's "as ever" view. One line in the decision file.
- **m1:** home's LADDER › must never take a tap meant for Squads: `.fd-ranked [role=radiogroup] { position: relative; z-index: 1 }` (or
  equivalent); e2e: `elementFromPoint` at Squads' top edge is Squads (phone and computer).
- **m2 (Eric: "simple beats flashy"):** replace `caches.default` with a module `Map` per mode kept `LADDER.cacheSeconds` in the Worker
  instance (the codebase's own pattern: `topPlaces`). Fix the docs' read-rate claims (settings comment, ranked.md, hub.md).
- **m5:** keep the list's scroll apart from the answer's age (refetch if stale, then restore the scroll); clear the "back from profile"
  flag when the profile closes any other way; the e2e asserts `.ld-list` scrollTop after Back.
- Nits: n1 (assert the radio row's y, or reword), n3 (`role="list"` + `div role="listitem"` > `button`, "You" in its label), n5 (one line in
  ranked.md). Leave n4.
Run typecheck, the server/app unit tests and the ladder e2e checks (phone + computer). Update `.pr-body.md` (a "Review fixes" section; changed
checks old → new). Push, `.done`, stop. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`
(no Co-Authored-By). Effort xhigh. About an hour.
