# A ban means you can't sign in (Nov 13, 2026)

Eric, Nov 13: "When I think of the word banned, I think of you can't sign in anymore. Just like every other game works." "If you
try to sign in, it would say your account has been banned. For more information, email support. And then if those emails come in,
then we can respond to those accordingly." "Make sure that when someone's banned, it's not just the landing page. No URLs work."
The line, exactly: "Your account has been banned. For more information, email support@hunchess.com." No appeal box in the game:
appeals come by email. It holds on every URL and API route, enforced on the server; a tab already open drops to the message.

## What changed

- **Signing in is refused** for a banned account (a person's ban, or an evasion ban: `banCheck`'s rule), by an emailed code, by
  Google, or as a test account (the scripts' way in): the ban answer, no session made. `signInBan` (server `fairplay.ts`).
- **The ban gate** (server `ban-gate.ts`, run by the Worker before any route): a request whose session belongs to a banned account,
  or from a browser marked banned, gets the ban answer on every `/api/*` route and the admin pages, the lobbies' WebSockets included.
- **The ban answer:** 403 `{banned: true, message}` with an `x-hc-banned` header; the session ended (its row deleted, its cookie
  cleared); the browser marked (`hc_banned`, the banned account's id, HttpOnly, 400 days).
- **The app** looks at every answer it gets (it wraps the page's `fetch`, so every call counts, old and new) and, on the header,
  draws only the ban screen: the line, the address a mailto link, nothing else (no menus, town, solo or chat). The device remembers
  it (`brc.banned`), so a reload or a deep link shows it from the first frame, and asks the server once whether it still holds.
- **Gone:** the appeal form, the "can't play online, solo still open" notice, and their routes (`/api/appeal`,
  `/api/fairplay/status`). The admin side is as it was (lift a ban, the review page, old appeals). The ban email says the screen's line.
- **Unchanged:** the engine pool (never a ban, never shown); guests that aren't banned; a lifted ban signs in as before.

## Calls made

1. **Where the server checks:** one gate in front of every route, not a check in each. A route added later is covered without
   anyone remembering to; the lobbies' WebSocket upgrades go through it too. The account helpers (`accountOf`, `userFromToken`)
   are left as they were: many callers swallow their errors (`.catch(() => null)`), so a "banned" thrown from there would read as a
   guest in some of them.
2. **Its cost:** the gate reads the session and its case in one query (a join, the case by its key), and each Worker instance keeps
   a "not banned" answer per session for `FAIRPLAY.banCheckMs` (30 s). Without it, the live line's and the town's polls (every 1.5
   to 5 s, built to need no database read: `presence.ts`) would each read the database. A ban made on the same instance counts at
   once (`setCase` forgets that account's answers: `ban-cache.ts`); one made on another, within 30 s. A request with no session and
   no mark reads nothing. A database that doesn't answer lets the request through (its route fails or works, as before).
3. **The browser's mark:** "No URLs work" and "a tab already open" need the browser itself to stay out once it has been told, so
   the ban answer marks it. The mark holds whatever cookie the browser brings (the account's own included) while that account is
   banned; lifting the ban takes the mark away on the browser's next request (it's then a guest, free to sign in); clearing the
   browser's data clears it too (a guest: guests are unchanged by this job, and the device marker still sends a new account from
   it to review).
4. **A refused sign-in ends the browser's current session too** (a guest's, or another account's): the browser is the one marked,
   and "no session is made" is simplest to keep if it has none.
5. **The check comes once the identity is proven** (the code right, Google's answer), never at the code's sending: refusing an
   address before then would tell anyone who typed it that its account is banned. It comes before the age question.
6. **Evasion at sign-in:** an existing account whose identities are a banned account's is banned by evasion as it signs in (what
   its next PLAY would have done). An identity new to us that is a banned account's is refused, with nothing made. Google's verified
   email that is a banned account's address is refused too, with nothing else changed (the one signing in owns that address).
7. **Page URLs** are the app's static files (served without the Worker), so the server enforces on the API, which is everything
   the app can do online; the app draws only the ban screen on every URL. Running the Worker for every file to serve a ban page
   would cost a Worker call per file for every player.
8. **The Hidden Boss's room** keeps its own ban answer's shape and the session (its guard test, `hidden-room.test.ts`, guards one
   of Eric's rules), with the header added: the app drops to the ban screen at once, and the gate ends the session and marks the
   browser on the next request.
9. **The ban email** is the screen's line, with the admin's note to the player when one is written (the review page's field says
   "in the email"). An appeal turned down says to email support; neither says solo stays open.
