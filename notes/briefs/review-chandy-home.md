# Review: Chandy's Swamp (PR #737, branch claude/chandy-home). One quick pass (boss lane), read-only. Opus, high

About 30 minutes. Read `CLAUDE.md` (the boss lane, "Simple beats flashy", "Nothing hidden, nothing shifts"), `.claude/LESSONS.md`,
`docs/areas/town-square.md` ("Inside a shop", "Challenging a boss", "Adding a home", "The street town"), the brief
`notes/briefs/chandy-home.md` (on `claude/director-notes`), then the diff `git diff origin/main...origin/claude/chandy-home`.
No fuzz marathons, no sims, no code changes.

Look for real problems only, ranked:
- anything that changes other homes or players' towns today: the shared room code (`RoomArt.wade`, roof `sky`), the intro timeline's
  `lift` now lifting both figures (does every other intro's beat log still match?), the arrival title's owner-line change on every
  home, the moved lamp (Eric's Nov 7 no-lamp rule), `settings.ts` changes, the admin-only gate (a player's town must not show the
  swamp, its bot or its chip);
- per-frame work in the room on a phone (splash, rings, the sky roof; no new loops);
- the rise: both figures on the platform the whole time, the waterline clip off once lifted, nothing drawn over a figure;
- the greyed "Coming soon" challenge ("Nothing hidden"), and that `?introPreview` can't reach players in production
  (TEST_SWITCHES never in production);
- originality, no images under docs/.
Each finding: file:line, the failing case, a fix in one line.

Write `review.md` (at most 1 page: verdict, findings by severity, what you checked) to the orphan branch `review/chandy-home` and
push. End commits with the Claude-Session line only, no model names.
