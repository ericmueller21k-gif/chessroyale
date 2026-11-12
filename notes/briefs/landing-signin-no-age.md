# The front door: Sign in without the age question; Sign up asks it (Nov 12)
You are a helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: xhigh: sign-in, accounts and the age gate (a compliance
rule: 13 or older for an account). FULL lane: the PR runs the whole e2e suite (the director adds the `full-e2e` label) and gets an
independent review after you push.
Read first: CLAUDE.md, .claude/LESSONS.md, docs/rules/eric.md, docs/areas/accounts.md (the age gate, sign-in, guests) and hub.md (the
landing page), docs/decisions/2026-10-16-age-gate-and-real-money.md. The code: packages/app/src/components/SignIn.tsx (AgeQuestion
before every sign-in), packages/app/src/account.ts (`answerAge`, `tooYoung`), packages/core/src/age-gate.ts, packages/server/src/api.ts
(`ageAnswer`, `ageRefusal`, POST /api/auth/age, the email start/verify and Google start/callback routes), the users table's `age_ok_at`.

Eric, Nov 12: "right now you have to put in a birthday, even if you want to sign in. We need to do away with that. You should be able to
go to the site on a fresh browser and log in without having to select an age if you already have an account... put a sign in already
[first], and then below that... a sign up button, and then... your age thing."

## What to build
- The front door shows **Sign in** first, with no age question (email code and Google, as today), and below it **Sign up**, which asks
  "when were you born?" (the same AgeQuestion, same rules) before the account is made.
- **An existing account that has answered** (`users.age_ok_at` set) signs in on a fresh browser with no age question, by email code or by
  Google.
- **The age is still asked before any account is created and before any account that never answered signs in**:
  - Sign in with an email or a Google identity that has no account yet → the age question, then the account (never an account first).
  - An account from before the gate (`age_ok_at` empty) → asked once, at that sign-in, as today.
  - So the server decides after it knows who it is (code verified / Google callback): known and answered → signed in; otherwise →
    "age needed" (no session, nothing created), the app asks, posts `{oldEnough}` as today, and the sign-in finishes without asking for the
    email code again or a second trip to Google if you can do that safely (else say what the player has to repeat).
- **Too young stays absolute:** a device with `hc_age=under` / `brc.tooYoung` is refused at every step as today, Sign in included,
  existing account or not. A Sign in must never become a way round the gate (think about it like an attacker: a fresh browser, an unknown
  email, a pre-gate account, a too-young cookie plus a known account, a second tab, a replayed callback).
- The birth date is still never sent or stored; only `{oldEnough}` as today. The guest path and "Online play needs an account" are
  unchanged unless the new layout needs a wording change.
- Nothing hidden, nothing shifts (docs/rules/eric.md): both buttons always there; phone first (428 x 746 baseline), light and dark; a
  computer too. A mockup isn't needed first (Eric described the layout), but keep it plain and in the existing style.

## Tests (full lane)
Server unit tests for every path above (known+answered, known+pre-gate, unknown email, unknown Google, too-young device on each, the age
answer expiring between steps, two tabs). The existing age-gate tests must keep passing; list every changed check old -> new (any guard
in docs/rules/eric.md needs Eric's OK: stop and say so if one must change). e2e: update the sign-in specs; add one fresh-browser sign-in of
an existing account with no age question, and one Sign up that asks it. Typecheck; the unit tests of the packages you touch; the sign-in
and landing specs locally under the shared e2e lock (if Playwright looks for chromium_headless_shell-1194, run
`mkdir -p /opt/pw-browsers/chromium_headless_shell-1194 && ln -sfn /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64 /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux && ln -sfn chrome-headless-shell /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/headless_shell`).
If the D1 schema must change, write a migration and say so loudly in the PR body (it shouldn't need one: `age_ok_at` exists).
Stills (one set at the end) on stills/landing-signin: phone 428 x 746 light first (the front door), dark, the Sign up age step, a computer.

Branch claude/landing-signin from origin/main; push at each real step. Decision note docs/decisions/2026-11-12-signin-without-age.md
(Eric's words, the flow, the calls made and why, the attacker cases considered). Update docs/areas/accounts.md and hub.md.
When done: push .pr-body.md (what changed, player-visible changes, the flows, changed checks old -> new, tests run), then .done as the
last commit. Don't open a PR or wait on CI: the director does. American English. Never include model names in commits. Never put a secret
in the repo (it's public).
