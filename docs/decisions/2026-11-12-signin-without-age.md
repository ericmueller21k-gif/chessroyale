# Sign in without the age question; Sign up asks it (Nov 12, 2026)

## Eric's words

"Right now you have to put in a birthday, even if you want to sign in. We need to do away with that. You should be able to go
to the site on a fresh browser and log in without having to select an age if you already have an account... put a sign in
already [first], and then below that... a sign up button, and then... your age thing."

The rule stays: 13 or older for an account ([2026-10-16-age-gate-and-real-money.md](2026-10-16-age-gate-and-real-money.md)).
This replaces that file's call 1 ("the question comes before every sign-in"); the rest of it stands.

## The flow

- **The box** (the landing page, Settings, your profile; `components/SignIn.tsx`): **Sign in** first, with no question:
  Continue with Google, or a 6-digit code by email. Below it, "New to HunChess?" and **Sign up**. Sign up shows "Sign up: when
  were you born?" (the same month and year, the same rules), then the same two ways, with the code's button saying "Sign up".
  "Have an account? Sign in" goes back. The heading names the view ("Sign in to play online", "Sign up to join lobby ABCDE").
- **The server decides once it knows who is signing in** (the code checked, or Google's callback):
  - this device just answered "old enough" (`hc_age=ok`): signed in, the account made if needed, `age_ok_at` set the first
    time, the answer used up (as before);
  - no answer, and the account it lands on has answered (`users.age_ok_at` set): signed in, nothing about the age touched;
  - otherwise (an email or Google account with no account yet, an account from before the question): **asked first**. No
    session, nothing made, moved or written. Email: 403 `{askAge, message: AGE_STEP_LINE}`. Google: back to the page with
    `?signin=age-google`.
- **The finish.** The box asks "One more step: when were you born?". The app posts `{oldEnough}` to POST `/api/auth/age` as
  before. Then:
  - **email:** the app sends the same code again; nothing is typed again;
  - **Google:** the app goes to Google again ("Then pick your Google account again."), and this time the callback finishes.
- **Too young**, `hc_age=under` or `brc.tooYoung`: refused at every step as before, Sign in included, whatever the account.
  The box shows only the friendly line: no Sign in, no Sign up.

## The calls I made

1. **Decide after the identity is checked, never from the typed email.** Before the code is right we don't know the email is
   theirs. Saying "this email needs the question" early would also tell anyone which emails have accounts. A wrong code gets the
   same answer either way (tested).
2. **"Answered" means `users.age_ok_at` is set.** An identity new to us that would join the signed-in account you're on counts
   as that account's (answered: no question). One that would make an account, or turn a guest into one, is asked.
   (`signInIfAnswered`, `answeredSignIn` in `accounts.ts`; `signInWithIdentity` is unchanged for every other caller.)
3. **Email: the code stays live for the finish, no new code.** When the sign-in must ask, the code check reports a right code
   without using it up (`verifyEmailCode(…, keep)`). The account lookup comes before the check, so the one atomic statement
   still decides: only a check that signs in uses the code up, and two finishes at once sign in once. The kept code keeps its
   limits: every check counts one of its 5 tries, it lasts its 10 minutes, it finishes once. The app holds the code in memory
   only.
4. **Google: one more trip to Google, not a kept identity.** Finishing without a second trip would mean keeping the Google
   account until the answer comes. That needs a new D1 table (a schema change, its part of the download and of deleting, a
   privacy line) or a signed cookie (a signing key we don't have: a new secret for Eric to set). Either way we'd keep the Google
   identity of someone not yet asked, maybe a child's. With the second trip nothing about the Google account is kept before the
   answer, and nothing new is stored. **What the player repeats:** one more pick of their account on Google's page. Only a
   Google account with no account yet (Sign up avoids it: the answer comes first) or an account from before the question (before
   launch, Eric's and testers') ever sees it.
5. **Sign up is "answer first", on the same endpoints.** The server can't tell signing up from signing in until the identity
   is checked, so Sign up is the question and then the same two ways. No new route.
6. **Sign in takes an email before the question.** That's what Eric asked for: an email is needed to send the code. If
   someone under 13 types theirs into Sign in, the code's record is the only thing kept, and it goes within the hour like every
   code's (`purgeEmailCodes`). Too young after the question: no account, nothing else. The privacy policy says so. If a lawyer
   wants the question before any email, only the email path changes back (Google keeps nothing either way).
7. **A fresh browser signing in to someone else's answered account isn't asked** (a child using a parent's email or Google
   account). That account's holder said they were old enough. It's the same as a device the parent is already signed in on.
8. **The layout keeps still.** One box, two views of the same height: the question's month and year wrap at the same width as
   the email's box and button (both rows: the first part from 210 px, the second from 196 px). Switching moves nothing,
   measured at 320, 390 and 428 px wide and on a computer. Steps of a sign-in (the code's box, a message) change the box as
   before. Sign in and Sign up are always one tap apart, and neither hides the other's way in.
9. **Fixed on the way:** at 320 px the email box's own width (about 274 px) pushed the sign-in box 8 px past its column. The
   box is now sized by its row (`width: 0` with its flex basis).

## Attacker cases considered

| Case | What happens | Test |
| --- | --- | --- |
| A fresh browser, an account that answered | Signed in, no question, no age cookie set | server "known and answered" (email, Google); e2e "Sign in on a fresh browser" |
| A fresh browser, an unknown email | Asked after the code; nothing made; the same code finishes it | server "an email with no account" |
| A fresh browser, an unknown Google account | Asked; nothing made or kept, not even the account's id in a cookie; the state is spent | server "a Google account with no account" |
| An account from before the question | Asked once, then never again | server (email, Google); e2e |
| Too young plus a known account (answered, pre-gate or none) | Refused at the email start, the code check (even with a right code), Google's start and its callback (even with a state from before the answer); no try counted | server "Sign in included…" |
| Too young after being asked | The waiting sign-in is dropped; the code can't finish it | server, app |
| The answer runs out between the code and its check | Asked again; the same code finishes it | server "between steps" |
| Two tabs | One tab's sign-in uses up the other's answer: the other is asked. Two finishes at once: one sign-in, one account | server "two tabs" |
| A replayed callback | On another device: no state, `?signin=failed`. After the trip that asked: its state is spent, `failed`. (Google's code is single-use too.) | server "a replayed callback" |
| A kept code abused | Still 5 tries, 10 minutes, one finish | server "a code kept for the question…" |
| Probing which emails have accounts | A wrong code answers the same for every email | the same test |

## Tests changed (old → new)

None of these guards a rule in `docs/rules/eric.md`.

- `packages/server/test/age-gate.test.ts`:
  - "every sign-in asks first; the answer lets this device sign in once…" → "Sign up: the answer lets this device make an
    account…; then it signs in with no question". Not answered, the email start sends a code (it was refused), and after
    signing out the account signs in again with no question (it was asked).
  - "Google: start and the callback need the answer…" → "Google: the account made keeps when…; an answer gone on the way asks (an
    unknown account) or doesn't (a known one)". A callback with no answer went to `?signin=failed`; now `?signin=age-google`, or
    signed in for an account that answered.
  - "an account from before the gate is asked at its next sign-in…" → split into the email and Google tests for an account
    from before the question: asked after the code, not at the start.
  - "a sign-in that starts gives the answer its time again…": the same, plus "no answer, no cookie".
  - New: known and answered (email, Google), an unknown email, an unknown Google account, a new identity for a signed-in
    account, the kept code's limits and the same answer for a wrong code, too young with each kind of account, the answer
    running out between steps, two tabs, a replayed callback.
- `packages/app/test/age-gate.test.ts`: "…a sign-in refused for want of it asks again" (an error and `ASK_AGE_LINE`) → "…a
  sign-in the server asks about waits, and the answer finishes it with the same code". New: an answered account, Google's
  second trip, too young dropping a waiting sign-in, a failed finish's note.
- `e2e/age-gate.spec.ts`: the under-13 test asks through Sign up ("Sign up: when were you born?"; it was "Before you sign in:
  when were you born?" before the options) and also checks that no Sign in or Sign up is left. "13 or older: the sign-in options
  after the question…" → "Sign up: the question first…" (the code's button says "Sign up"). New: "Sign in on a fresh
  browser…".
- `e2e/landing.spec.ts`: the options show at once (no answer first, also for the invite link's Google); new: Sign up and back
  move nothing (phone at 390, 428 and 320; computer at 1280, 1440 and 1920). The computer's on-screen check looks for "Continue
  with Google" and "Sign up" (it was "Continue").
