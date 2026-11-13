# A ban means you can't sign in (Nov 13, 2026)

Eric, Nov 13: "When I think of the word banned, I think of you can't sign in anymore. Just like every other game works." "If you
try to sign in, it would say your account has been banned. For more information, email support. And then if those emails come in,
then we can respond to those accordingly." "Make sure that when someone's banned, it's not just the landing page. No URLs work."
The line, exactly: "Your account has been banned. For more information, email support@hunchess.com." No appeal box in the game:
appeals come by email. It holds on every URL and API route, enforced on the server; a tab already open drops to the message.

## What changed

- **Signing in is refused** for a banned account (a person's ban, or an evasion ban: `banCheck`'s rule), by an emailed code, by
  Google, or as a test account (the scripts' way in): the ban answer, no session made. `signInBan` (server `fairplay.ts`).
- **The ban gate** (server `ban-gate.ts`, run by the Worker before every `/api/*` route, the lobbies' WebSockets included): a request
  whose session belongs to a banned account gets the ban answer; so does every request from a browser marked banned, on every
  route, sign-in's included, whatever session it carries (the whole device is banned: below, "Eric's call").
- **The ban answer:** 403 `{banned: true, message}` with an `x-hc-banned` header; the browser's session ended, whatever account it
  was (its row deleted, its cookie cleared); the browser marked (`hc_banned`, the banned account's id, HttpOnly, 400 days).
- **The app** looks at every answer it gets (it wraps the page's `fetch`, so every call counts, old and new) and, on the header,
  draws only the ban screen: the line, the address a mailto link, and nothing else (no sign-in, menus, town, solo or chat). The device remembers it (`brc.banned`), so a reload or a deep link shows it from the first frame, and asks the server while
  the screen is up whether it still holds.
- **Gone:** the appeal form, the "can't play online, solo still open" notice, and their routes (`/api/appeal`,
  `/api/fairplay/status`). The admin side is as it was (lift a ban, the review page, old appeals). The ban email says the screen's line.
- **Unchanged:** the engine pool (never a ban, never shown); guests that aren't banned; a lifted ban signs in as before.

## Calls made

1. **Where the server checks:** one gate in front of every route, not a check in each. A route added later is covered without
   anyone remembering to; the lobbies' WebSocket upgrades go through it too. The account helpers (`accountOf`, `userFromToken`)
   are left as they were: many callers swallow their errors (`.catch(() => null)`), so a "banned" thrown from there would read as a
   guest in some of them.
2. **Its cost:** the gate reads the session and its case in one query (a join, the case by its key), and each Worker instance keeps
   a "not banned" answer per session for `FAIRPLAY.banCheckMs` (60 s since the review round; 30 s at first). Without it, the live
   line's and the town's polls (every 1.5 to 5 s, built to need no database read: `presence.ts`) would each read the database. A ban
   made on the same instance counts at once (`setCase` forgets that account's answers: `ban-cache.ts`); one made on another, within
   a minute. A request with no session and no mark reads nothing. A database that doesn't answer lets the request through (its route
   fails or works, as before). `ops` load-tests the gate before launch (`docs/areas/ops.md`).
3. **The browser's mark:** "No URLs work" and "a tab already open" need the browser itself to stay out once it has been told, so
   the ban answer marks it. While that account is banned, the mark refuses every request from that browser, the sign-in's own
   routes included, whatever session it carries (another account's is ended): the whole device is banned ("Eric's call", below;
   the review round's shared-device fix is undone). Lifting the ban takes the mark away on the browser's next
   request (it's then a guest, free to sign in); clearing the browser's data clears it too (a guest: guests are unchanged by this
   job, and the device marker still sends a new account from it to review).
4. **A refused sign-in ends whatever session the browser carried** (a guest's, the banned account's, another account's): the whole
   device is banned ("Eric's call"). The first round's rule, back.
5. **The check comes once the identity is proven** (the code right, Google's answer), never at the code's sending: refusing an
   address before then would tell anyone who typed it that its account is banned. It comes before the age question.
6. **Evasion at sign-in:** an existing account whose identities are a banned account's (or that would take Google's verified email
   that is a banned account's address) is banned by evasion as it signs in, what its next PLAY would have done. An identity new to
   us that is a banned account's gets its own new account, banned by evasion at once, as PLAY's check did, so a person can clear it
   (minor 4: a cousin sharing a mailbox, `2026-10-16-integrity-followups.md`; refused with nothing made, nobody could ever clear
   it). That account is never joined to the one signed in on the browser (a guest's or another person's), and is made only once
   the sign-in can finish, behind the age question as any new account. Every refusal names, and marks the browser with, the account
   the person tried to sign in to.
7. **Page URLs** are the app's static files (served without the Worker), so the server enforces on the API, which is everything
   the app can do online; the app draws only the ban screen on every URL. Running the Worker for every file to serve a ban page
   would cost a Worker call per file for every player.
8. **The Hidden Boss's room** keeps its own ban answer's shape and the session (its guard test, `hidden-room.test.ts`, guards one
   of Eric's rules), with the header added: the app drops to the ban screen at once, and the gate ends the session and marks the
   browser on the next request.
9. **The ban email** is the screen's line, with the admin's note to the player when one is written (the review page's field says
   "in the email"). An appeal turned down says to email support; neither says solo stays open.

## Review round (Nov 13): the director's calls on the review of #687

(M1's fix and the ban screen's "Sign in to another account" were undone by Eric's call, below; the rest of the round stands.)

- **M1, shared devices: the reviewer's fix (undone: "Eric's call").** The mark locked a whole browser out: a family tablet marked by the brother's ban
  refused his sister's sign-in and ended her session, for 400 days. Now the mark refuses only a request with no live session (and
  the banned account's own session is refused anyway); the sign-in routes pass it (`SIGN_IN_ROUTES`: the options, the age question,
  the emailed code, Google's trip), so a proven identity that isn't banned signs in, and its live session passes the mark. The
  banned person still gets the line on every URL: Eric's "No URLs work" is about the banned account. A refused sign-in ends only
  the banned account's session (call 4). The admin pages (`/admin/*`) are out of the gate: only admins see them anyway, and an
  admin's browser that met a ban can still lift it.
- **M2:** a session row gone (ended by another instance's gate) or expired: the gate also forgets its token in this instance's
  presence cache, which kept it 10 minutes and served the banned account to the routes that read it (town chat, presence).
- **Minors:** no UNMARK over a route's own ban answer (1); Origin and JSON checks on the emailed code's start and verify, as the age
  question (2); the app asks again while the ban screen is up (a minute after a ban answer, 5 s doubling after a failed ask, at once
  when the page is back in view or online) (3); evasion at sign-in makes a clearable account (4, call 6); `banCheckMs` 60 s (5); the
  review page's button says "Ban (can't sign in)" (6); the privacy text (7). Nits: the lobby WebSocket in the tests' routes; a lifted
  ban's email says to sign in again; one source for the support address (core's `SUPPORT_EMAIL`).
- **Calls made in the round:**
  - **(Undone: "Eric's call".) The ban screen offers "Sign in to another account"** (the app's own sign-in box, under the line). Without it M1's fix can't be
    reached in its own case (the brother banned while signed in on the tablet: the screen had nothing to tap). Signing in to the
    banned account there is refused again, as anywhere. The director's or Eric's to take out: it's one block in `FairPlay.tsx`.
  - **The sign-in routes run without a session** for every browser, not only marked ones (a marked one has none, and the age
    question, the code and Google needed the guest a marked browser can't get). A marked browser never reaches them now (the gate
    refuses it first), but they keep running without a session. The emailed code's start and verify now check
    Origin and JSON, so a session was never what kept them same-site. A new account made this way is made as before.
  - **A guest's session is the one signing in:** a refused sign-in ends it (otherwise the banned person would play on as that guest,
    the line gone at the next ask). (Since "Eric's call", any session it carried is ended.)
  - **A refused code is spent** (it was kept for a device that hadn't answered the age question, so one code could plant several
    marks: minor 2).
  - **A lifted ban's email** is its own kind (`lifted`: "Sign in again to play online"); a review cleared keeps its line.

## Eric's call (Nov 13): the whole device is banned

Eric, on the review's shared-device fix: "No, just the whole device is banned. We're not tolerating any fucking bullshit. If you get
banned and your sister gets upset about it, so be it. We can always revert it later."

- A browser carrying a banned account's mark gets the ban answer on every gated route, the sign-in's own included, whatever session
  it carries; that session is ended (another account's too). `SIGN_IN_ROUTES` and `refusalEnds` are gone (`ban-gate.ts`).
- A refused sign-in on any browser ends whatever session it carried (call 4).
- The ban screen is only the line again (no "Sign in to another account").
- Kept from the review round: M2's forgotten token, the screen's re-asks, evasion accounts, the Origin and JSON checks, `banCheckMs`
  60 s, the button and email wording, `/admin/*` outside the gate. The other account itself is never banned or opened as a case: on
  another device it plays as ever. To revert: the review round's commits on #687 (`d0ee232`, `4000dc2`, `8cfb6ee`) hold the
  shared-device version.
