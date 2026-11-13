# Review: a ban means you can't sign in (#687, `claude/ban-blocks-sign-in` @ `eafaf10f`)

Independent, read-only review, full lane (sign-in, security, fair play). Brief: `notes/briefs/review-bans.md`.

**Verdict: no blockers. 2 major, 7 minor, 3 nits.** Both majors are server-side and small to fix. The design (one gate before every
route, refusal only after the identity is proven, the mark, the app's fetch wrapper) is sound. The gaps are about who else the mark
catches, and what happens once the gate deletes a session row.

## What I ran

- `npx vitest run packages/server packages/core packages/app` on the PR head: **294 files, 4,054 tests, all pass.**
- `npm run typecheck`: **clean.**
- A proof-of-concept test file using the PR's own harness (`ban-sign-in.test.ts`'s `setUp`/`browser`): **4 tests, all pass,
  each confirming a finding below.** Full source in the appendix; drop it into `packages/server/test/` to run it.
- e2e: not run (the PR carries `full-e2e`). I read `e2e/fairplay.spec.ts` and the `areas.json` change instead.

## Blockers

None.

## Major

### M1. The browser mark locks out accounts that aren't banned on a shared device, deletes their sessions and tells them "Your account has been banned"

`packages/server/src/ban-gate.ts:120-122`: the mark is checked before the session. When the marked account is banned, the gate
answers `banAnswer(sql, token, marked)` whatever session the request carries. The sign-in routes are behind the same gate.

**Failing case** (POC F2): a family tablet. The brother's account is banned, so the tablet is marked. His sister, never banned,
then on that tablet:
- `POST /api/auth/email/start` and `GET /api/auth/google/start` both get the ban answer, so she can't sign in at all;
- a session of hers on it is refused and its row deleted (`sessionsOf(sis) === 0`);
- she sees "Your account has been banned." Her case is `null`.

This lasts 400 days (`MARK_DAYS`), until the brother's ban is lifted, or until someone clears the site's data, which the screen
doesn't suggest. The same happens on a school or library computer.

Two related cases:
- Decision call 4 (`api.ts:741`): a refused sign-in to the banned account also ends whoever else's session that browser had.
- An admin whose browser carries a mark can't open `/admin/fairplay` to lift it. The gate covers the admin pages, which a banned
  account can't reach anyway (`isAdmin`), so gating them adds no protection, only this risk.

**Why it matters:**
- The brief asks about exactly this case: a NON-banned player locked out by a shared device.
- It reverses a standing call without saying so: `fairplay.ts:206` "one seen on a device a banned account played from goes to
  review (families share devices)".
- The decision note (call 3) and the privacy text (`Legal.tsx:369`) only consider the banned person's own browser.

**Suggested fix** (keeps "No URLs work" for the banned person):
- Let the mark refuse requests with no session, or with the banned account's session.
- Let the sign-in routes through it. A proven, non-banned identity then gets a session, and requests carrying a live, non-banned
  session pass the mark.
- Ban evasion through a fresh address is then no easier than clearing cookies, which already works. The device marker still sends
  that new account to review.
- Leave `/admin/*` out of the gate.

This is a product call (Eric's "No URLs work"), so it's the director's or Eric's to make. At the least, the decision note and the
privacy text should say that the mark locks out the whole browser.

### M2. Once the session row is gone, another instance's gate passes the token, and presence's 10-minute token cache still serves the banned account

- `ban-gate.ts:94-105`: `sessionBanned` decides who the session belongs to from the `sessions` row.
- `ban-gate.ts:54-58`: the first ban answer, on any instance, deletes that row.
- `presence.ts:70-82`, `TOKEN_CACHE_MS = 10 * 60_000`: `cachedUserId` keeps token→user for 10 minutes, and other instances still
  hold it.

On another instance, once its 30-second "not banned" answer runs out, the gate reads the row, finds none, and returns
`{userId: null, banned: false}`. It passes the request and keeps that answer for another 30 s. The route then calls
`cachedUserId(token)` and gets the banned account back.

**Failing case** (POC F3), for a client that keeps `hc_session` but drops `hc_banned` (a script, or devtools):
- A cheater runs a script. Ban + row deleted elsewhere, then +30 s.
- `GET /api/friends/online` with the old token: 200, served as the banned account. A made-up token gets 401.

The same path (`cachedUserId`/`signedInReader`) serves:
- the live line's presence (`api.ts:251`: marked online, friends' inbox);
- **town chat posting** (`town-chat-api.ts:74`);
- the problem reports' account (`problems.ts:511,519`);
- hidden profiles (`api.ts:333`).

That's up to about 10 minutes per instance after the ban. Eric's rule says "the account's own sign-in cookie never gets it past",
and the unit and e2e guards only check this on one instance.

**Suggested fix** (one line): in `sessionBanned`, when the row is missing or expired, call `forgetToken(token)` (presence.ts) before
answering. Every instance's gate runs before every route, so its presence cache can't outlive the session. A test: the POC F3 case,
expecting 401 or the ban answer.

## Minor

1. **A route's ban answer is undone when the browser also carries a stale mark.** `index.ts:194` appends `UNMARK` after the route's
   own `Set-Cookie: hc_banned=<id>`, so the later header wins and the browser ends up unmarked.
   - Failing case (POC F5): a browser with a mark that no longer holds (a lifted ban, or a made-up id) finishes an emailed-code
     sign-in to a banned account. The answer is the ban answer, but with two `hc_banned` cookies, the second `Max-Age=0`.
   - Its next `/api/me` is a guest's, with a 200.
   - The same applies to `banRedirect` (Google), `mayPlay`, friends' `banned()` and test accounts.
   - The trigger is narrow (a page load normally unmarks first), but the fix is trivial: skip the `UNMARK` when the response
     already sets `hc_banned` or carries `x-hc-banned`.
2. **`/api/auth/email/verify` has no Origin or JSON check** (`api.ts:726`; compare `api.ts:405-406`, `/api/auth/age`, and
   `/api/me/delete`). It now plants a 400-day device mark.
   - Not exploitable cross-site today (POC F1): with no session cookie it answers the 401 at `api.ts:382` before the code is
     checked, and `SameSite=Lax` keeps the cookie off a cross-site POST.
   - But a `text/plain` body with `Origin: https://evil.example` is accepted whenever a session cookie comes with it. The
     protection is incidental.
   - Add the same two lines as `/api/auth/age`, ideally to `/api/auth/email/start` too.
   - Also: an address no account has answered the age question for keeps its code live (`keep = !finish`). One code then gives up
     to `MAX_ATTEMPTS` (5) refusals, each planting a mark (POC F1).
3. **The app checks the ban only once per page load** (`main.tsx:40`, `ban.ts:75-84`).
   - If that `/api/me` gets anything but a 2xx or the ban answer (a 429, a 5xx, D1 down, which the gate itself lets through), a
     player who isn't banned stays on the ban screen for the whole page life. There's no retry and no button, and on an installed
     app "reload" means closing it.
   - After a lift, an open tab also stays on the screen until a reload. The e2e reloads, so it doesn't see this.
   - Suggest retrying `checkBan` with backoff while the screen is up, or on `visibilitychange`/`online`.
4. **Evasion at sign-in leaves a person no account to clear.** `signInBan`'s "identity new to us" path (`fairplay.ts`, `asked` loop)
   refuses with nothing made.
   - Before this PR, the Oct 16 "cousin" case (`2026-10-16-integrity-followups.md` §2) made an account, banned it for evasion at
     PLAY, and let a person clear it. It then stayed cleared (`identityOwner`'s cleared clause).
   - Now someone sharing a mailbox with a banned account (a family address, or a domain where `+` isn't sub-addressing, since
     `normalizeEmail` strips `+tag` on every domain) can never get an account. Their browser is also marked with the other
     person's banned id (M1).
   - An email appeal has nothing to act on short of lifting the other account's ban.
   - The PR's own test asserts it ("ban evasion … is refused", `ban-sign-in.test.ts:192`). Worth one line in the decision, or
     make the account and ban it for evasion, as PLAY did, so it can be cleared.
5. **The cost on hot paths is real, though documented** (`docs/areas/ops.md`).
   - Before: the live line and the town's polls (every 1.5–5 s) needed about one D1 read per session per instance per 10 minutes
     (presence).
   - Now: one more joined read per session per instance per 30 s, 20× that rate, multiplied by how many instances a session's
     polls land on. Rough figure: 10k signed-in players touching 2 instances each is about 670 reads/s added.
   - Suggest: `ops` load-tests with the gate before launch. `banCheckMs` could also go to 60–120 s: a person's ban counting
     within 2 minutes instead of 30 s costs nothing, and the same instance already counts at once.
6. **The review page's button still says "Ban from online play"** (`admin.ts:751`). The admin should see what a ban now does, e.g.
   "Ban (can't sign in)".
7. **The privacy text on `hc_banned`** (`Legal.tsx:369`, "set only if an account banned for fair play was used or signed in to on
   this device: that account's random id") doesn't cover two cases:
   - an evasion refusal, which stores another account's id (the matched banned owner);
   - the shared-device effect (M1).
   It's otherwise accurate: nothing new is stored server-side, and `brc.banned` is listed under local storage.

## Nits

- No test sends a WebSocket upgrade through the gate. It's covered by construction (`handle` runs the gate before `route`, and all
  four app sockets are under `/api/`), but the PR and the decision claim it explicitly. A `/api/lobby/ABCDE/ws` entry with
  `Upgrade: websocket` in `ROUTES` would pin it.
- The "cleared" email still ends "you can play online as usual" (`fairplay-mail.ts`). After a lifted ban, every session is gone,
  so "sign in again" would be more accurate.
- `SUPPORT_EMAIL` (core) duplicates `CONTACT` in `Legal.tsx:12`. They're the same string, but there are now two sources.

## Checked and sound

- **Every route and page:** the gate runs in `handle` before `route` for every `/api/*` path and the admin pages. The rest are
  static assets (`run_worker_first` covers only those), and the app draws only the ban screen.
  - Exempt: `/api/ops/stats` (ops key), the ranged ambience file, and `/api/e2e/sql` (local only).
  - All four app WebSockets are under `/api/`. `sendBeacon` goes to `/api/problems` and is gated.
  - `cookieOf` and `readCookie` use the same first-match regex, so two `hc_session` cookies can't split the gate from the route.
  - No route takes a session token from anywhere but the cookie. The only bearer is the reviewer's token, not a session.
- **No leak on sign-in:** a wrong code gets the plain 400 (tested). `email/start` doesn't change. Google is refused only after
  `state` matches its cookie and the token exchange. Bans are public on profiles anyway.
- **Who passes:** guests, review, pool and cleared accounts pass. A mark naming no banned account is removed. D1 down: the gate
  logs and passes.
  - A pooled account caught for evasion at sign-in is banned, as `banCheck` already did at PLAY, so it's no new exposure of the pool.
- **Lifting a ban:** the next request removes the mark, the account signs in again, and its sessions were already ended (tested,
  unit and e2e).
- **Evasion:** `identityOwner` is the old `banCheck` query moved unchanged, with the cleared clause intact. `normalizeEmail` is
  unchanged (dots only for Gmail, `+tag` everywhere, as before).
- **Cookie flags:** `hc_banned` has `Path=/; HttpOnly; Secure; SameSite=Lax`, the same as `hc_session`; the ban answer has
  `cache-control: no-store`.
- **The app's fetch wrapper:**
  - It's installed before any request in `main.tsx`. The `fetcher = fetch` defaults resolve the global at call time, so they're
    wrapped too.
  - It reads only status and header, and leaves the body alone.
  - No loop: `enterBan` only sets state, and the ban screen fetches nothing.
  - Offline: the screen stays. The status poll keeps getting 403s about once a minute, which is cheap.
- **e2e:** the rewrite keeps every check whose behavior still exists (the reviewer token's 400 and 409, the 404s without it,
  "Banned" on the profile). It drops only what Eric removed (the notice, the in-game appeal, solo while banned), and now runs on
  phone and computer.
  - `ban-*.ts` and `app/src/ban.ts` are in `areas.json`'s run-everything list, which is right for a gate in front of every route.
- **Eric's rules:** the new rule in `eric.md` names its guards, and they exist with those titles. No existing guard test was edited:
  `fairplay.spec.ts` wasn't a guard on main, and `hidden-room.test.ts` is unchanged and passes.

## Appendix: proof-of-concept tests

The PR's `ban-sign-in.test.ts` up to its first `describe` (imports and harness), then:

```ts
describe("review POC", () => {
  it("F1 (hardening, not exploitable today): /api/auth/email/verify takes a cross-site text/plain body; only the 401 for no session cookie stops it", async () => {
    const w = await setUp();
    const cheat = await account(w.sql, "email", "cheat@example.com");
    await setCase(w.sql, cheat.id, "banned", "admin:eric@example.com", "engine moves", 1500);
    const attacker = browser(w);
    await attacker.call("/api/me");
    await attacker.call("/api/auth/age", { json: { oldEnough: true }, headers: { origin } });
    expect((await attacker.call("/api/auth/email/start", { json: { email: "cheat+v1@example.com" } })).status).toBe(200);
    const code = w.codes.get("cheat+v1@example.com")!;
    const body = `{"email":"cheat+v1@example.com","code":"${code}","x":"="}`;
    const xsite = await worker.fetch(new Request(origin + "/api/auth/email/verify", { method: "POST", headers: { "content-type": "text/plain", origin: "https://evil.example" }, body }), w.env as never, ctx);
    expect(xsite.status).toBe(401);
    const guest = browser(w);
    await guest.call("/api/me");
    const withCookie = await guest.call("/api/auth/email/verify", { method: "POST", headers: { "content-type": "text/plain", origin: "https://evil.example" }, body });
    expect(withCookie.status).toBe(403);
    expect(guest.jar.get("hc_banned")).toBe(cheat.id);
    // The same code again, from another browser with a session: refused again (the code was kept).
    const other = browser(w);
    await other.call("/api/me");
    const again = await other.call("/api/auth/email/verify", { method: "POST", headers: { "content-type": "text/plain", origin: "https://evil.example" }, body });
    expect([again.status, other.jar.get("hc_banned")]).toEqual([403, cheat.id]);
  });

  it("F2: a shared device marked by one banned account refuses another, never-banned account: sign-in, and its session (deleted)", async () => {
    const w = await setUp();
    const bro = await account(w.sql, "email", "bro@example.com");
    const sis = await account(w.sql, "email", "sis@example.com");
    const tablet = browser(w);
    tablet.jar.set("hc_session", await createSession(w.sql, bro.id, Date.now()));
    expect((await tablet.call("/api/me")).status).toBe(200);
    await decide(w.sql, bro.id, "ban", "admin:eric@example.com", "engine moves", Date.now());
    isBanAnswer(await tablet.call("/api/live"));
    isBanAnswer(await tablet.call("/api/auth/email/start", { json: { email: "sis@example.com" } }));
    isBanAnswer(await tablet.call("/api/auth/google/start?next=/"));
    tablet.jar.set("hc_session", await createSession(w.sql, sis.id, Date.now()));
    isBanAnswer(await tablet.call("/api/me"));
    expect(await sessionsOf(w.sql, sis.id)).toBe(0);
    expect(await caseOf(w.sql, sis.id)).toBeNull();
    isBanAnswer(await tablet.call("/admin/fairplay"));
  });

  it("F3: once the session row is gone (ended by the gate on another instance), this instance's gate passes the token, and presence's 10-minute token cache still serves the banned account", async () => {
    const w = await setUp();
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 13, 12), toFake: ["Date"] });
    const pat = await account(w.sql, "email", "pat3@example.com");
    const token = await createSession(w.sql, pat.id, Date.now());
    const b = browser(w);
    b.jar.set("hc_session", token);
    expect((await b.call("/api/friends/online")).status).toBe(200);
    // Another instance bans Pat and its gate ends the session (this one hears of neither).
    await w.sql.run("INSERT INTO fairplay_cases (user_id, status, opened_at, updated_at) VALUES (?, 'banned', ?, ?)", pat.id, Date.now(), Date.now());
    await w.sql.run("DELETE FROM sessions WHERE token_hash = ?", await sha256(token));
    vi.setSystemTime(Date.now() + FAIRPLAY.banCheckMs + 1);
    const after = await b.call("/api/friends/online");
    expect([after.status, after.banHeader]).toEqual([200, null]); // should be 401 or the ban answer
    const c = browser(w);
    c.jar.set("hc_session", "e2enotarealtoken0123456789abcdefgh");
    expect((await c.call("/api/friends/online")).status).toBe(401);
  });

  it("F5: a browser carrying a mark that no longer holds, refused at sign-in by a route: the route's mark is undone by the gate's UNMARK after it", async () => {
    const w = await setUp();
    const old = await account(w.sql, "email", "old@example.com");
    const pat = await account(w.sql, "email", "pat5@example.com");
    await setCase(w.sql, pat.id, "banned", "admin:eric@example.com", "engine moves", 1500);
    const b = browser(w);
    await b.call("/api/me");
    await b.call("/api/auth/age", { json: { oldEnough: true }, headers: { origin } });
    expect((await b.call("/api/auth/email/start", { json: { email: "pat5@example.com" } })).status).toBe(200);
    b.jar.set("hc_banned", old.id);
    const refused = await b.call("/api/auth/email/verify", { json: { email: "pat5@example.com", code: w.codes.get("pat5@example.com") } });
    isBanAnswer(refused);
    const marks = refused.res.headers.getSetCookie().filter((c) => c.startsWith("hc_banned="));
    expect(marks.length).toBe(2);
    expect(marks[1]).toContain("Max-Age=0");
    expect(b.jar.has("hc_banned")).toBe(false);
    expect((await b.call("/api/me")).status).toBe(200);
  });
});
```
