# PR #1027 (Ranked at the town tables): fix the review's findings. Opus, xhigh (server, matchmaker, a socket). Full lane.

Read `notes/briefs/rules-common.md` first. The review is `REVIEW.md` on `origin/claude/town-ranked-review` (its appendix has repros for
S1 to S4 on the test fakes: turn the useful ones into real tests). Work on `claude/town-ranked` (merge `origin/main` first). Push at each step.

Fix, each with a test that fails before and passes after:
- **S1** watcher messages: drop a watcher's raw message over ~100 chars before parsing; answer one hello per socket (or one every few
  seconds); close the socket on anything else. Settings in `settings.ts`.
- **S2** one deadline per batch: `batchStart + seatWaitMs`, each town pair waits `min(answer, deadline)`. Mind the review's warning about
  `form()`'s failure path putting back every `seating` ticket (never two games).
- **S3** `closeIfDue`: no await between the check and the close. Send the last `townMatchOver` with `ctx.waitUntil` after the close.
- **S4** `Matchmaker.cancel` on a ticket in `seating`: await `this.forming`, then return `placedIn(ticket)`, so the Worker calls `abandon`
  and the player is excused, never charged a dodge.
- **S5** a refused watch: accept the socket and close it at once with its own code (4029 "Too many are watching this game.", 4003 for not
  allowed); the watch screen shows that reason with Back to town and stops retrying.
- **S6 (director's call):** watching needs an account. The Worker refuses a guest's `/ws?watch=1` (closed with 4003, the same path as S5),
  and the table card's Spectate shows greyed for a guest with "Make a free account to watch" (nothing hidden: greyed, not removed). The
  town keeps hiding names from guests.
- **S7** tests for `duel-do.ts`: `tellTown` (once at the end; retried at the next persist and at the close; `townTold` stored); the watch
  path (403/4003 for a non-town game or a guest, 4029 at `watchersMax`, only a hello answered).
- Nits to do: **N1** try the town tickets' seats first; **N2** the hub remembers over codes for `resultsKeepMinutes` so a late `townMatch`
  doesn't hold a table; **N3** backstop 180 → 90 minutes; **N4** clamp tables to the park's real count (export the count from core);
  **N9** coming back from Spectate counts as staying in town (no second "has entered the town", like the tower floor's return).
  Leave N5-N8 and N10 (note them in the PR body as follow-ups).

Update `docs/areas/` (town / matchmaking pages) and add a five-line decision note for S6 and N9. Changed checks old → new in `.pr-body-add.md`
(a short section the director appends to the PR body). Run typecheck, the server and app unit tests, and the town ranked e2e spec locally.
Commit AND push `.pr-body-add.md` and `.done3` (`git add -f`), check with `git ls-remote` they're on GitHub, then stop. No PRs, no comments.
