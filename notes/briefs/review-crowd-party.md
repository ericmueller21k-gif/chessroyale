# Review: the 50 v 50 Party (PR #747, branch claude/crowd-party). Full lane: an independent review. Opus, xhigh. Read-only

About 60 to 90 minutes. Read `CLAUDE.md` (the full lane), `docs/areas/matchmaking.md`, `hub.md`, `accounts.md` ("Friends and
invites"), `docs/rules/eric.md`, the brief `notes/briefs/crowd-party.md` (on `claude/director-notes`), then the diff
`git diff origin/main...origin/claude/crowd-party`. No code changes.

Look hard, ranked: **stored data** (the `users.dnd` column: the migration, its default, old rows, rollback, every query reading users);
**security and abuse** (who can join a party: invite-only, a guessed party id, a blocked user, an invite after Do Not Disturb, a banned
account, rate limits on invites); **matchmaking** (a party ticket seated whole and on one team every time; a party larger than the
free seats; the leader leaving mid-search; Cancel recalling everyone; a member reloading (the PR's known limit: say if it can strand
someone or split a team); ranked, XP and fair play for parties (the pooled rating rule)); **the protocol** (the optional fields; an
old client); **the screens** (Eric's standing rules: notices on top never push, nothing hidden/shifts, Chess Town asks first with the
notice's Accept; the notice never over a match); the e2e and unit tests really prove the flow. Each finding: file:line, the failing
case, a fix in one line, and a severity.

Write `review.md` (at most 2 pages: verdict, findings by severity, what you checked) to the orphan branch `review/crowd-party` and push.
End commits with the Claude-Session line only, no model names.
