# The age gate, and real money later (Oct 16, 2026)

## Eric's decisions

- **Minimum age for an account: 13.** Eric: "13 younger is guest only. If they lie then so be it, we did our part."
  The director's brief reads it as: 13 or older may make an account, under 13 plays as a guest (US COPPA's line).
  Self-declared, no verification. If Eric meant 14, it's one number: `AGE_GATE.minAge` in `packages/core/src/settings.ts`.
- **Real money will exist later:** players will buy in-game currency, then spend it on crates and keys. Nothing is built
  for it now. Before any build, Eric approves a payment provider and the pricing, each with cost estimates. When it is
  built, these change with it:
  - the landing page's FAQ, "Is it free?" ("Coins and cosmetics will be earned by playing, never bought");
  - the terms' "Virtual items" ("never bought with real money");
  - the legal draft's "Real-money purchases" item: refund and consumer-law sections, and a country-by-country check of
    paid crates (some countries treat them as gambling);
  - ROADMAP's "loot-box rules before any real-money crates".

## What was built

- **The question:** "Before you sign in: when were you born?", with a month and a year. Nothing is chosen to start with,
  and no age is mentioned. The years run from this year back 100. It comes in the sign-in box everywhere signing in is
  offered: the landing page, Settings and your profile (`components/SignIn.tsx`). After an "old enough" answer, the box
  shows Google and the email code, as before.
- **The rule** (`packages/core/src/age-gate.ts`, shared): whole months, so you're 13 from the start of the month you
  turn 13. 12 years 11 months is refused; 13 exactly passes.
- **Only the answer leaves the phone.** The app works it out and posts `{oldEnough: true | false}` to POST
  `/api/auth/age`. The birth month and year are never sent or stored.
- **Under 13:**
  - The sign-in box says: "Accounts are for players 13 and older, so you'll play as a guest. Bots and bosses are all
    yours."
  - The landing's heading becomes "Online play needs an account", and the guest button stays.
  - The guest goes back to the default name ("Player") and icon (♟). The server refuses the guest's name and icon
    changes from that device, and the profile hides "Edit name & icon".
  - The feedback sheet sends a bug report with no note, and feedback and ideas (a note alone) aren't offered. The server
    drops a guest's note from that device too.
  - The device can't sign in at all: email start, email verify, Google start and Google's callback all refuse it. Any
    `hc_age=under` in a request counts, wherever it sits: a second `hc_age` set by hand for another path (which the
    browser sends first) can't hide it.
- **13 or older:** that device may sign in once, within `AGE_GATE.answerMinutes` (60). An emailed code and the trip to
  Google each give the answer its 60 minutes again as they start, so it can't run out between the start and the end
  (a code lasts 10 minutes, Google's state cookie 10). The sign-in uses the answer up, and the account gets
  `users.age_ok_at`: when its holder first said so.
- **A sign-in refused for want of the answer** (it ran out, or a sign-in in another tab used it up) brings the question
  back with "Please answer again before you sign in." Google's start sends the page back with `?signin=age` for the
  same line.

## The calls I made

1. **The question comes before every sign-in, not only a new account's.** We can't tell signing up from signing in until
   the email or Google identity is checked, and that identity is the personal information the question must come
   before. One answer is good for one sign-in within the hour. Signing in again (after signing out, or after an hour)
   asks again, so a younger player on a shared phone is asked too.
2. **Month and year, counted in whole months**, as the brief asks: 12 years 11 months is refused, 13 exactly passes. A
   player born late in the month passes up to a few weeks early. A birth month still to come counts as too young.
3. **The device works out the answer.** The server never sees the birth date, so it can't keep it. The rule is in
   `packages/core`, so the app and the tests share it.
4. **Remembering "too young": an HttpOnly cookie plus a local flag, each putting the other back.**
   - The cookie, `hc_age=under`, lasts `AGE_GATE.tooYoungDays` (400, the most a browser keeps one). The page can't clear
     it, and the server refuses sign-in on it.
   - The flag, `brc.tooYoung`, is in the app's storage. On load, the flag sends the answer to a server whose cookie is
     gone, and a server that says "under" sets the flag again. Clearing one isn't enough. The back button and a reload
     find the friendly line, and a new answer changes nothing.
   - **Why both:** Safari can delete a site's script-written storage after 7 days without a visit (not HttpOnly
     cookies), and someone can clear cookies but not storage.
   - **Why not a D1 table** keyed by fair play's device marker: it would last exactly as long as that marker's cookie
     (cleared with it). It would add a table, a privacy-policy entry and a part in deleting an account, and fail the
     same way.
   - Clearing all of the site's data does get round it. Eric: "If they lie then so be it, we did our part."
5. **A "too young" device can't sign in to any account, new or old.** The email typed would be a child's, and we can't
   tell whose it is before taking it. The cost: a parent can't sign in on a browser where their child answered under 13
   (another browser or device works). The FAQ doesn't explain this, so it doesn't teach the way round.
6. **Existing accounts are asked at their next sign-in, and nobody signed in is interrupted.** The question comes before
   every sign-in, so an account from before the gate meets it the next time it signs in (a new device, or after
   signing out), and `age_ok_at` is set then. A blocking screen for sessions already signed in was the alternative. It
   would also need an "existing account says under 13" path (deleting a child's data), for nobody: before launch,
   `main` deploys to Eric alone (Zero Trust), so the only accounts are Eric's and testers'.
7. **What's kept:** `users.age_ok_at`, the time of the first sign-in after an "old enough" answer (later ones leave it).
   It's in "Download my data" (the account's row) and goes when the account is deleted. NULL means an account from
   before the gate, or a guest. The privacy policy says so ("Your account", "Cookies", "Children").
8. **Deleting an account keeps "too young":** the app clears its storage except that flag, and the cookie isn't the
   account's. Otherwise "Delete account" would be a way to answer again.
9. **Neutral, as screening should be:** nothing in the question hints at the cutoff. The landing's FAQ sits under the
   question, so it doesn't mention the age either. The privacy policy and terms state it, on their own pages, as they
   must. The cutoff shows only after a "too young" answer, when it can't change anything.
10. **The limits are a guest's, not the device's.** An adult already signed in on that browser (a tab opened before a
    child answered in another) keeps their name, icon and feedback notes: their account was made before, by someone who
    said they were old enough. The `hc_age=under` cookie still refuses every new sign-in there.
11. **Guests who never answer keep choosing a name and drawing an icon.** The question is about accounts (Eric's
    decision), and nobody else sees a guest's name or icon where sign-in is set up, since guests don't play online. An
    "under 13" answer later wipes both.
12. **Old app versions** (the service worker's cache) have no question. Their sign-in is refused ("Please answer again
    before you sign in.") until the app updates itself. Before launch that's only Eric's devices.

## Guest audit (where sign-in is set up, as on hunchess.com)

Nothing in the game takes free text from one player to another: chat is preset lines and emoji everywhere.

| What | A guest today | A guest under the gate |
| --- | --- | --- |
| Online play: PLAY online, lobbies, raids, Squads, invite links | Refused by the server ("Sign in to play online"; `mayPlay` in `index.ts`, `lobby-do.ts`, `squads-do.ts`) | Same |
| Solo against bots, Boss alone, a solo raid | Yes | Yes |
| Global chat (preset lines) | Read only: posting needs sign-in (`chatPostResponse`) | Same |
| Quick chat in matches (fixed lines) | Online matches only, so none | None |
| Friends, requests, invites | Refused (`friends-api.ts`) | Same |
| Others' profiles, Report (preset reasons only) | Yes | Yes: nothing typed |
| Shop, locker, crates (free while testing) | Yes | Yes: nothing personal |
| Your name and drawn icon | Yes; nobody else sees them (guests aren't online) | **New:** the defaults only |
| The feedback sheet (a typed note, to us) | Yes | **New:** a bug report with no note; no feedback or ideas |
| An appeal (typed) | Only when banned, which needs online play | Can't be reached |
| Error reports (automatic) | Device facts, no account id for guests | Same |

## Tests

- `packages/core/test/age-gate.test.ts`: 12 years 11 months refused, 13 exactly passes, the month's first and last days
  alike, across the turn of the year, a month still to come, and the years offered.
- `packages/server/test/age-gate.test.ts`:
  - every sign-in asks first, by email and Google;
  - one answer, one sign-in, and `age_ok_at` keeps the first time;
  - an emailed code's start and Google's start each give the answer its time again;
  - an account from before the gate is asked at its next sign-in;
  - a too-young device is refused everywhere, and a later answer can't change it;
  - any `hc_age=under` in the request counts, even after a second `hc_age=ok`;
  - someone signed in on that device (a tab from before the answer) keeps their name, and its guest doesn't;
  - its guest goes back to the defaults;
  - the endpoint takes only JSON from the site's own page;
  - no birth date is stored: an answer writes nothing to the database beyond the guest's reset, and the cookie holds the
    answer alone.
- `packages/server/test/problems.test.ts`: a too-young device's guest: its bug report keeps no note, and its feedback and
  ideas are refused; someone signed in there keeps their note.
- `packages/app/test/age-gate.test.ts`:
  - only `{oldEnough}` is sent, and nothing on the device holds the date;
  - the flag and the server put each other back;
  - an answer that ran out asks again, saying why;
  - someone signed in on a too-young device isn't a young guest.
- `e2e/age-gate.spec.ts`, on a phone:
  - the neutral question;
  - the under-13 path: the friendly line; still too young after a reload, a new answer and cleared cookies; guest play
    under "Player", with no name editing; Settings → Feedback becomes a bug report that sends, kept with an empty note;
  - the 13+ path: an account made through the real code check, with `age_ok_at` in the local database.
- `e2e/landing.spec.ts` answers the question before the sign-in options.
- On Eric's phone: `TESTING.md`, "The age question":
  - the phone's own month and year pickers;
  - the under-13 answer, tried only in a private tab, since it locks that browser's sign-in for 400 days;
  - a sign-in with Google, the one path the automatic tests can't run (Google's return trip).
