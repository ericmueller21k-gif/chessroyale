# Review: PR #656, Sign in without the age question (Nov 12)

Independent, read-only review of `claude/landing-signin` at `ef087ec` against `main` (full lane: sign-in, accounts, the age
gate). Read: the PR body, `docs/decisions/2026-11-12-signin-without-age.md`, `docs/areas/accounts.md`,
`docs/decisions/2026-10-16-age-gate-and-real-money.md`, and the whole diff (`api.ts`, `accounts.ts`, `SignIn.tsx`, `account.ts`,
`Landing.tsx`, `App.tsx`, `Legal.tsx`, `styles.css`, the server, app and e2e tests). CI on `ef087ec`: `check` green and the full
e2e suite (15 shards) green, so the new SQL (`?1`…`?5` in `verifyEmailCode`, including the parameter in `RETURNING`) runs on
the local D1 too.

## Verdict

**No blockers.** I found no way round the gate: no account is made, no identity attached to an account that never answered,
and no session given on such an account, without this device's "old enough" answer; a too-young device is refused at every
step. One **should-fix** in the app flow (a failed finish's message never reaches the screen) and five **nits**.

## Findings

### 1. Should-fix: a pending email sign-in that fails after the answer shows nothing, and its note turns up later out of context

- **Where:** `packages/app/src/account.ts:264` (`finishPendingSignIn` clears `pending` before the code is sent again) and
  `packages/app/src/components/SignIn.tsx:128` (`useState(takeSignInNote)` reads the note once, when `SignInOptions` mounts).
- **Scenario:** a fresh browser, an email with no account. The code is right, the server asks (403 `askAge`, code kept). The
  player takes more than 10 minutes over the question (or used 4 wrong tries first, see nit 2, or asked for a new code in
  another tab). They answer: `answerAge` → `finishPendingSignIn` → `set({ pending: null })` → the box renders
  `SignInOptions` at once (the view is "in" and `age` is "ok", so `ask` is null), and its `useState(takeSignInNote)` takes
  `null`, because the verify is still in flight. The verify fails (400 "That code didn't work…"), `signInNote` is set, but the
  mounted `SignInOptions` never reads it again. **The player sees the plain Sign in box with an empty email field and no
  message**, not signed in, with no idea why. The note stays in the state and appears the next time any `SignInOptions`
  mounts (say, opening Settings), out of context. On success there's a smaller version of the same thing: the empty Sign in
  options flash for one round trip between the question and home ("nothing shifts").
- **The test doesn't guard it:** `packages/app/test/age-gate.test.ts:176` ("a finish that fails … leaves its message and
  address for the sign-in options, once") calls `takeSignInNote()` directly; it passes whatever the box shows. No e2e
  covers a failed finish.
- **Smallest fix:** keep `pending` until the email finish settles, so the question stays (its Continue busy) during the
  finish and `SignInOptions` mounts only with the note ready:

  ```ts
  async function finishPendingSignIn(): Promise<void> {
    const p = state.pending;
    if (!p) return;
    if (p.kind === "google") {
      set({ pending: null });
      return signInWithGoogle(p.next);
    }
    try {
      await verifyEmailCode(p.email, p.code); // success sets pending: null; askAge sets it again
    } catch (e) {
      set({ pending: null, ...(tooYoung() ? {} : { signInNote: { message: (e as Error).message, email: p.email } }) });
    }
  }
  ```

  One `set` with both fields means one render, so the new `SignInOptions` takes the note. Add one check to
  `e2e/age-gate.spec.ts`'s "Sign in on a fresh browser" test: before answering for `old`, expire its code with `d1Write`
  (`UPDATE email_codes SET expires_at = 1 …`), answer, and expect the "That code didn't work" line and the address in the
  Email box.

### 2. Nit: a right code on the 5th try is asked about, then can never finish

- **Where:** `packages/server/src/accounts.ts:815` (a kept check counts a try like any other).
- **Scenario:** an email with no account; the player mistypes the code 4 times, then types it right (try 5): 403 `askAge`,
  "the code stays live". They answer; the finish is try 6, `attempts < 5` fails, and they get "That code didn't work" for a
  code that was right (with finding 1 fixed; today they see nothing). They must send a new code.
- **Fix (pick one):** don't count a try for a right kept code
  (`attempts = attempts + CASE WHEN code_hash = ?1 AND ?5 = 1 THEN 0 ELSE 1 END`); a wrong code still counts, so guessing gets
  no extra tries, and the code still finishes once and lasts its 10 minutes. This changes the "Kept for the question, the
  code still counts its tries: 5 in all" step of the server test ("a code kept for the question is still the code…"), so say
  so in the PR's changed checks. Or leave it, and say in the decision that the kept check uses a try.

### 3. Nit: a small timing difference can tell a signed-in prober which emails have accounts

- **Where:** `packages/server/src/accounts.ts:675-686` (`answeredSignIn`, read before the code is checked).
- **Scenario:** the response is the same for a wrong code, known email or not (tested). But the number of D1 reads isn't
  always: an email with an account costs 1 read; an email with none costs 1 for a guest or an account with an email, and
  **2** when the prober is signed in to an account with Google and no email (`attachAnswered` then reads the account's
  `age_ok_at`). Such an account is easy to make (a Google account whose email another account already has, so
  `adoptGoogleEmail` gives it none). The prober posts wrong codes to `/api/auth/email/verify` for target emails (no code
  needs to exist, so no tries are spent; the per-user limit is 1,200 a minute) and times them: about one D1 round trip
  (tens of ms, `accounts.md`: "about 40 ms") separates unknown emails from known ones. Noisy, but it's the probing the
  decision's call 1 sets out to prevent.
- **Smallest fix:** make `answeredSignIn` one statement whatever it finds, e.g.
  `SELECT (SELECT age_ok_at FROM users WHERE email = ?1) AS owner_at, EXISTS (SELECT 1 FROM users WHERE email = ?1) AS owned,
  (SELECT age_ok_at FROM users WHERE id = ?2) AS current_at` (with the `google_sub` column for Google), then decide in code.

### 4. Nit: the comment on the rare race promises a new code that nothing sends

- **Where:** `packages/server/src/api.ts:728`: "(The account went between the two reads: asked first, and the code's used, so
  a new one is sent.)"
- **Scenario:** `answeredSignIn` says "finish", the code is used up, then `signInIfAnswered` finds the account gone (deleted in
  between): 403 `askAge`. The app keeps the used code as `pending`, the answer sends it again, and the check fails. Nobody
  sends a new code; the player must. Very rare and safe (nothing is made), but the comment misleads.
- **Fix:** reword: "…and the code's used: the finish fails and the player sends a new code."

### 5. Nit: the privacy policy says the code's record "goes within the hour"; it can stay about 75 minutes

- **Where:** `packages/app/src/screens/Legal.tsx:417` (new sentence).
- **Scenario:** `purgeEmailCodes` deletes records sent more than an hour ago, and runs on the 15-minute schedule, so a record
  can stay up to about 1 hour 15 minutes. The policy is the one place this must be exact (an under-13's email, call 6).
- **Fix:** "goes about an hour later" (as `accounts.md` puts it: "an hour after their code was sent"), or purge at 45 minutes.

### 6. Nit: TESTING.md's Google check may surprise Eric if his account was made with the email code

- **Where:** `TESTING.md:116`, step 2 ("tap Continue with Google straight away: no question, and you should come back signed
  in").
- **Scenario:** Google sign-in finds accounts by `google_sub` only. If Eric's account has only an email (Google never added),
  a fresh private tab's Google sign-in is a Google account with no account: he's asked "One more step", picks his Google
  account again, and gets a **new, separate** account. That's not this PR's doing (Google never matched accounts by email),
  but the step would read as a failure of it.
- **Fix:** "with the Google account you already sign in with (if you've only ever used the email code, use the code
  instead)".

## Attacker cases checked (fine)

- **A fresh browser, an unknown email or Google account:** asked after the code or the callback; nothing written but the
  try's count (email) and nothing at all for Google (state and next cookies cleared, no cookie names the account). The only
  way to make an account is `signIn(…, answered = true)`, reached only with `hc_age=ok` on the request.
- **A pre-gate account (`age_ok_at` NULL):** `signIn` returns null before any write (`found.age_ok_at === null`); asked; the
  answer finishes it and sets `age_ok_at`.
- **A new identity joining the signed-in account:** only when that account has an identity and `age_ok_at` set
  (`attachAnswered`); a guest turning into an account always needs the answer. A signed-in pre-gate account can't add one.
- **`hc_age=under` plus any account:** refused at email start, verify (before any read or try), Google start
  (`?signin=age`, no state) and the callback (`|| ageRefusal`, before Google's token endpoint), including a state from before
  the answer and a code got elsewhere. `ageAnswer` finds "under" among several `hc_age` cookies.
- **`hc_age=ok` forged by hand:** the same as answering "old enough" (self-declared, as Oct 16 accepted). No cookie is given
  to a device that never answered (start only refreshes an existing "ok").
- **The answer expiring between steps:** asked again; the kept code finishes it.
- **Two tabs:** the cookie is the device's, so either tab's sign-in can use it up and the other is asked; two finishes of the
  same code are serialized by the single `UPDATE … WHERE expires_at >= now` (only one sees the live row). (Two finishes of
  *different* identities sent at the very same moment can both carry the same "ok", since it's only cleared in the response:
  two accounts from one device's answer. Same as before this PR, and both are that device's answer: not a finding.)
- **A replayed or forged callback:** another device has no state cookie; the asking trip clears its state; a successful trip's
  Google code is single-use. A forged state needs the victim's cookie.
- **A code verified twice / `keep` stretching it:** `keep` never touches `expires_at` and still counts the try; only a
  non-kept right check sets `expires_at = 0`, and only that request signs in. A resend replaces the code and resets tries as
  before (5 sends an hour).
- **Enumeration through the 403:** `askAge` needs a right code (the mailbox's owner). Wrong codes answer the same, known or
  not (the timing nit aside). Email start answers the same for every address.
- **Writes before the answer:** none on the asked paths (the server tests dump every table before and after), no
  `Set-Cookie` on the email 403, no session.
- **The app flow:** a pending email finishes with the same code (in memory only); a pending Google sign-in goes back to Google
  with `next` (Settings and `/profile` reopen on load, the lobby link shows the landing); a "too young" answer drops either
  (`rememberTooYoung` clears `pending`), and `askAgeForGoogle` refuses one on a too-young device.
- **Nothing hidden, nothing shifts:** Sign in shows its options at once and Sign up is one tap below (Eric's own design); the
  two views are the same height (the e2e measures the box and the guest button at 320, 390, 428, 1280, 1440 and 1920, with
  painted-frame settling). The only shift is the flash in finding 1.
- **Tests that guard what they claim:** the server tests check the database and cookies around each asked step and the too-young
  matrix; the e2e watches every question that appears (a MutationObserver from the first frame) and every answer sent. The
  one gap is finding 1's app test.
