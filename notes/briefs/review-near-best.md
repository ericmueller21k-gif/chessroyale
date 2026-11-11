# Review: fair play near-best + one-match pool + sustained strength (PR #629, branch claude/fairplay-near-best). One review, read-only. Opus, high

Read `CLAUDE.md` (full lane), `docs/areas/fairplay.md`, the build brief `notes/briefs/brief-fairplay-near-best.md` (with Eric's added
sustained-strength section; on `claude/director-notes`), then the diff `git diff origin/main...origin/claude/fairplay-near-best`.
Eric's stance (Nov 11): "It's better we put people in this queue than under ... one cheater ruins a game"; a pooled honest player is
released by a person. So judge against THAT: real bugs, not the trade-offs he chose.

Look for: a wrong verdict path (a pool that should be a review or the reverse, a ban anywhere, the never-ban guarantee broken); the
catch-up (`recountDeep`) not idempotent, touching closed/released cases, re-pooling a released player, or costly per run; the
sustained-strength path counting matches it shouldn't (unvouched, test accounts, power turns, Squads/1 v 1 differences, the window);
stored data or migrations (none expected: say if any); the admin page or API leaking anything to a player; tests that pass for the
wrong reason. Each finding: file:line, the failing case, a one-line fix. ≤ 1 page `review.md`, pushed to orphan branch
`review/near-best`.
