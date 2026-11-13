## A ban means you can't sign in (Eric, Nov 13)

**Full lane: please add the `full-e2e` label** (sign-in, security, fair play). An independent review follows.

Eric: "When I think of the word banned, I think of you can't sign in anymore. Just like every other game works." / "If you try to
sign in, it would say your account has been banned. For more information, email support." / "No URLs work."

### What players see

- A banned account sees only: **"Your account has been banned. For more information, email support@hunchess.com."** (the address
  is a `mailto:` link). Nothing else: no menus, town, solo or chat. It shows on every URL (`/`, `/town`, `/play`, `/profile`, a
  lobby link, …), in a tab that was already open (it drops to the line on its next request), and after a reload.
- Signing in to a banned account (emailed code, Google, a test account's script) shows the same line. No session is made.
- No appeal box in the game any more. Appeals come by email. The "can't play online, solo games still open" notice is gone.
- The ban email says the same line (plus the admin's note to the player, if one is written).
- Once the ban is lifted, the next load is the game again, and the account signs in as before.
- Unchanged: guests that aren't banned, the engine pool (never a ban, never shown), the review page.
- Stills (phone and computer, light and dark): branch `stills/ban-blocks-sign-in`.

### What changed

- **Server: the ban gate** (`packages/server/src/ban-gate.ts`, called in `index.ts` `handle()` before any route). A request whose
  session belongs to a banned account, or from a browser marked banned, gets the ban answer. That covers every `/api/*` route and
  the admin pages, the lobbies' WebSocket upgrades included. The ban answer is a 403 `{banned: true, message}` with an
  `x-hc-banned: 1` header. It also ends that session (its row and its cookie) and marks the browser (`hc_banned` = the banned
  account's id, HttpOnly, 400 days). While that account is banned, the mark refuses every request, whatever cookie comes with it.
  Lifting the ban takes the mark away on the next request.
- **Server: sign-in refused** (`signInBan` in `fairplay.ts`). It runs once the identity is proven (the right code, or Google's
  callback) and before the age question, in `api.ts` (email verify, Google callback) and `test-accounts.ts`. Ban evasion is
  covered with `banCheck`'s identity rule, now one shared query (`identityOwner`):
  - an identity new to us that a banned account had is refused, and nothing is made;
  - an account whose own identities a banned account had is banned by evasion as it signs in;
  - a Google sign-in whose verified email is a banned account's address is refused.
- PLAY, friends' requests and invites (`banCheck` finding evasion) give the same ban answer. The Hidden Boss's door keeps its
  answer's shape and session and adds the header (its guard test is untouched; see Calls, 8).
- Removed: `/api/appeal`, `/api/fairplay/status`, the app's appeal sheet and `fairStatus`/`sendAppeal`. The server's `appeal()`
  and `fairStatus()` stay for the download and the admin's old appeals.
- **App:** `packages/app/src/ban.ts` wraps the page's `fetch` and goes to the ban screen on any answer with the header (from every
  call, old and new). The device remembers it in `brc.banned` and asks `/api/me` once at load. `main.tsx` draws only `<BanScreen/>`
  when banned. `components/FairPlay.tsx` is now the ban screen (`showBanNotice` kept as the name its callers use).
- Core: `BANNED_LINE`, `SUPPORT_EMAIL` (`core/src/fairplay.ts`); `FAIRPLAY.banCheckMs` (30 s).
- Copy: the FAQ (Fair play), the terms (fair play), the privacy policy (the new `hc_banned` cookie and its local-storage flag), the
  ban and "appeal upheld" emails.
- Docs: `docs/decisions/2026-11-13-ban-blocks-sign-in.md`; `docs/areas/fairplay.md`, `accounts.md` (with the round-trip note),
  `ops.md`, `town-square.md`; Eric's rule added to `docs/rules/eric.md` with its guards; `e2e/areas.json` (`ban-*.ts`, `ban.ts`
  are shared foundations).

### Calls made (the decision file has them all)

1. **One gate in front of every route**, not a check in each, so a route added later is covered too. The account helpers are left
   alone: many callers swallow their errors (`.catch(() => null)`), so a "banned" thrown from there would read as a guest.
2. **Its cost:** one joined read (the session and its case). Each Worker instance keeps a "not banned" answer per session for 30 s
   (`FAIRPLAY.banCheckMs`). Without that, the live line's and the town's polls (built to need no D1 read) would each read D1.
   - A ban made on the same instance counts at once (`setCase` forgets its answers).
   - A ban made on another instance counts within 30 s.
   - No session and no mark: nothing is read.
   - D1 down: the request passes (as `mayPlay` already did).
3. **The browser mark** is what makes "no URLs work" and "the account's own cookie never gets it past" hold. Clearing the
   browser's data clears it: that browser is then a guest, which this job leaves unchanged, and the device marker still sends a new
   account from it to review.
4. A refused sign-in also ends the browser's current session (a guest's or another account's): it's the browser that's marked.
5. The refusal comes only after the identity is proven. Refusing when the code is sent would tell anyone who types an address that
   its account is banned.
6. Evasion at sign-in, as listed under "What changed".
7. Page URLs are static files served without the Worker. The server enforces the ban on the API (everything the app does
   online), and the app draws only the ban screen. Running the Worker for every file would cost a Worker call per file.
8. **The Hidden Boss's door** keeps its 403 body and session and only adds the header. `hidden-room.test.ts` guards Eric's room
   rule ("every check"); ending the session there would have changed its M1 check. The gate ends the session on the next request.
9. The ban email includes the admin's note if one is written (the review page's field says "in the email").

### Tests

- Typecheck (all packages): clean.
- Unit, run locally: server, app and core, 294 files / 4,046 tests, all pass. New: `packages/server/test/ban-sign-in.test.ts`
  (8 tests, through the whole Worker), covering:
  - email and Google sign-ins refused, with no session;
  - a wrong code says nothing about the ban;
  - evasion: a +tag or Gmail dots, an account deleted while banned, an alias account banned at sign-in, Google's verified email;
  - every route refused for a marked browser, with no guest made;
  - the account's own session refused and ended;
  - a session banned mid-use: refused at once on this instance, and within `banCheckMs` when banned elsewhere;
  - PLAY's evasion ban;
  - lifting: the mark goes and sign-in works;
  - pooled, reviewed and guest accounts pass;
  - a made-up mark is taken away;
  - a banned test account is refused.
- e2e, local, both projects: `e2e/fairplay.spec.ts` (3 pass, 1 skipped by its own project rule), `e2e/legal.spec.ts`,
  `e2e/age-gate.spec.ts`. All pass. They ran under the e2e lock with the machine's own Chromium, through an uncommitted local
  config, because this machine's Playwright browsers differ from the project's.

### Test checks changed or removed (old → new)

- `e2e/fairplay.spec.ts`, "a banned account: PLAY, a new lobby and an invite show the ban notice with an appeal; solo still
  plays; the profile says Banned" (phone only) → **"a ban means you can't sign in (Eric, Nov 13): a tab open drops to the ban
  line; every URL and API route answers only it; signing in again is refused with no session; a lifted ban signs in as
  before"** (phone and computer).
  - **Removed** (the behavior is gone by Eric's word):
    - PLAY opens the "Your account can't play online" dialog with "Solo games against bots are still open.";
    - the appeal: Send disabled until text, sent, "Your appeal is with us", remembered on the next PLAY;
    - a new lobby shows the notice;
    - an invite's lobby turns the account away with the notice;
    - solo still plays.
  - **Kept:**
    - a decision needs a reason (400);
    - the reviewer's token can't ban (409);
    - without the token, the API and the review page are 404;
    - the admin's ban answer;
    - others see "Banned" on the profile.
  - **New:**
    - the open tab drops to the line;
    - the screen holds only the line and its mailto link (no button, canvas, home or board; no sideways scroll);
    - 10 URLs each show only it;
    - 10 API routes each give 403, the header and the line;
    - no session is left, and the browser is marked;
    - with storage cleared, still banned;
    - the account's own planted session is refused and ended;
    - a fresh browser's email sign-in is refused, with no session;
    - lifted, the browser loads the game and signs in.
  - Not a guard of any rule before; it now guards Eric's new rule.
- `packages/server/test/fairplay-admin.test.ts`, "emails > say what happened and how to appeal…" → "a ban's says what the ban
  screen says (Eric, Nov 13: appeals by email)…".
  - Old: subject `/can't play online/`; text `/appeal/` and `/Solo games against bots are still open/`.
  - New: the exact subject and text, the admin's note after the line, no "Solo"/"tap PLAY"/"see a form" in the ban and "upheld"
    emails, and the "upheld" email says to email support.
  - The sender and the cleared email: unchanged.
- `packages/server/test/fairplay-admin.test.ts`, "the player's side of the API > /api/me gives the device a marker; a banned
  account sees its status and appeals" → "…; the appeal form's routes are gone (Eric, Nov 13: appeals by email)".
  - Old: `/api/fairplay/status` → `{banned: true, appeal: null}`; POST `/api/appeal` → an open appeal.
  - New: neither route is the account API's (null), and no appeal row is written.
  - The device-marker checks: unchanged.
- No guard test of `docs/rules/eric.md` was edited. `packages/server/test/hidden-room.test.ts` (a guard) is unchanged and passes:
  its M1 compares the body with the `BANNED_MESSAGE` constant, which now holds Eric's line.

### For the director

- `e2e/fairplay.spec.ts`'s "the reviewer's API lists a reported player's case…" is tagged `@phone-only` but skips unless desktop,
  so it never runs. This was already so before this PR; I left it alone.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01JuCWRuDQNo76Myuf5BEYWP
