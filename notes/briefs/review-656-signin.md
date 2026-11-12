# Independent review: PR #656, Sign in without the age question (Nov 12)
You are a read-only reviewer for HunChess (repo ericmueller21k-gif/chessroyale). Effort: xhigh (sign-in, accounts, the age gate: a
compliance rule, 13 or older for an account). Don't push code. About 30 to 45 minutes.

The PR: branch claude/landing-signin (head ef087ec), against main. Read its body (PR #656 on GitHub, or
`git log origin/main..origin/claude/landing-signin`), docs/decisions/2026-11-12-signin-without-age.md, docs/areas/accounts.md (the age
gate), docs/decisions/2026-10-16-age-gate-and-real-money.md, then the diff: packages/server/src/api.ts, accounts.ts, the app's
SignIn.tsx, account.ts, Landing.tsx, App.tsx, and the tests.

Eric's ask: an existing account signs in on a fresh browser with no age question; Sign up asks it; nobody gets an account, or a session
on an account that never answered, without answering first; a too-young device is refused at every step.

Look hard for any way round the gate, like an attacker: a fresh browser; an unknown email or Google identity; a pre-gate account
(age_ok_at empty); a too-young cookie (hc_age=under) plus a known account; the answer expiring between steps; two tabs; a replayed or
forged Google callback/state; a code verified twice; the 403 askAge path leaking whether an email has an account (enumeration); an
account created or written (users row, identity, age_ok_at, cookies, sessions) before the answer; the `keep` code path extending a code's
life or tries; races between the answer and the finish. Also: correctness of the app flow (a pending sign-in finished by the answer,
Google's second trip), "nothing hidden, nothing shifts" on the front door, and any test that passes without guarding what it claims.

Output: push nothing to the PR branch. Write your findings to a file and push it to branch claude/review-656 (a new branch from
origin/main holding only `REVIEW-656.md`): each finding with severity (blocker / should-fix / nit), the file:line, a concrete failure
scenario, and the smallest fix. Say plainly if you find no blockers. Then push `.done` on that branch last. American English. Never
include model names in commits.
