# A ban means you can't sign in (Eric, Nov 13)

Effort xhigh, **full lane** (sign-in, security, fair play; add the `full-e2e` label request to your PR body; an independent review follows).
Branch `claude/ban-blocks-sign-in` from main. Read CLAUDE.md, `docs/areas/fairplay.md`, `docs/areas/accounts.md`, `.claude/LESSONS.md`.

## Eric's words (Nov 13)
- "When I think of the word banned, I think of you can't sign in anymore. Just like every other game works."
- "If you try to sign in, it would say your account has been banned. For more information, email support. And then if those emails
  come in, then we can respond to those accordingly."
- "Make sure that when someone's banned, it's not just the landing page. No URLs work." (`/town`, any deep link.)

## What to build
- **A banned account (a person's fair-play ban: case status `banned`, including evasion bans from `banCheck`) can't sign in.** Signing in
  (every sign-in path: email code, Google, any other) is refused with exactly: "Your account has been banned. For more information,
  email support@hunchess.com." (the address a link: `mailto:`). No session is made.
- **An account already signed in when the ban lands is signed out** on its next request: every `/api/*` route that reads the account
  answers 403 `{ banned: true, message }` and clears the session; the app, on any such answer (or at boot), drops to a single ban
  screen with that message and nothing else (no menus, no town, no solo, no chat). Every URL (`/`, `/town`, `/play`, deep links, a tab
  already open) shows that screen for that browser until it's cleared; the account's own sign-in cookie never gets it past.
- **Remove the in-game appeal form and the "can't play online, solo still open" notice.** Appeals are by email now. Keep the admin side
  as it is (lift a ban, the review page). The ban email (Resend) says the same as the screen. Check the FAQ and any copy that mentions
  appealing in the game or solo staying open for a banned player, and update them.
- **Leave the engine pool alone** (the quiet pool from detection; never called a ban, never shown).
- **A lifted ban** lets the account sign in again as before.
- Guests (not signed in) are unchanged by this job.
- Make the call yourself where the server's check is costly: e.g. a ban marker the session check reads, rather than a full
  `banCheck` on every request; but the result must hold for every route. Record each call in `docs/decisions/` (one file).

## Tests
- Unit: sign-in refused for a banned account (each path), evasion too; a signed-in session refused and cleared after a ban; lifting
  restores sign-in; the pool unaffected.
- e2e (extend `e2e/fairplay.spec.ts`; no new spec file unless needed): a banned account signs in → only the message; then visits a list
  of URLs (`/`, `/town`, `/play`, `/profile`, a lobby link) and calls a few API routes directly → only the message / 403 each time.
  A tab open during the ban drops to the screen.
- Typecheck, the server/app unit tests you touched, `e2e/fairplay.spec.ts` (both projects) under the e2e lock.
- List every test check you change or remove (old → new) in the PR body. `docs/rules/eric.md`: add Eric's rule ("A ban means you
  can't sign in") with its guard (the e2e above).

Write `.pr-body.md` (what changed, what players see, calls made, tests, checks changed), push work in progress at each real step, then
push `.done` and stop. Don't open PRs or wait on CI. No model names in commits. Never put secrets in the repo.
