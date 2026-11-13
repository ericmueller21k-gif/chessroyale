# Delta review: the bans review round (#687, `claude/ban-blocks-sign-in` @ `09462707`)

Independent, read-only re-review, full lane (sign-in, security, fair play), effort xhigh. Brief: `notes/briefs/review-bans-delta.md`.
First review: `origin/review/bans:review.md` (on `eafaf10f`). Round: `git diff eafaf10f 09462707 -- packages docs e2e` (the Wrangler
music files in it come from main).

**Verdict: no blockers, no majors. Both majors and all 7 minors and 3 nits are fixed as the round's PR body says, and the round's 4
calls hold up. New: 2 minor, 1 for Eric, 3 nits.** The `hidden-boss-room.spec.ts:242` flake wasn't caused by the gate or the mark.

## What I ran

- `npx vitest run packages/server packages/core packages/app` on `09462707`: **295 files, 4,061 tests, all pass.**
- `npm run typecheck`: **clean.**
- **M2's guard checked:** with the fix's one line (`if (!live) forgetToken(token)`) taken out, the PR's "stale-token case" test
  fails; put back, it passes. So it guards the fix.
- **My own proof tests** (the PR's harness from `ban-sign-in.test.ts`, then the 4 tests in the appendix): **4 tests, all pass.** Each
  one confirms a claim the brief asks about (D1 to D4 below). I didn't commit them anywhere.
- **The flaky test:** I read the failing run's shard 13 log and its report artifact: the failing attempt's page snapshot and the
  retry's trace with its network log.
- e2e not run locally (the PR carries `full-e2e`). I read `e2e/fairplay.spec.ts`'s changes instead.

## The first review's findings, one by one

| Finding | Fixed? | Where, and how I checked |
|---|---|---|
| **M1** shared device locked out | **Yes** | `ban-gate.ts` `banGate`: the session is checked first. The mark refuses only when there's no live session, and never on `SIGN_IN_ROUTES`. `refusalEnds` decides which session a refusal ends. `/admin/*` is out of the gate (`index.ts`). Tests: the PR's family tablet test, plus my D1 to D3. |
| **M2** stale token served by presence | **Yes** | `sessionBanned`: a session row that's gone or expired calls `forgetToken`. Presence caches no misses (`cachedUserId`), so nothing brings the token back. The PR's test fails without the line. What's left is the documented window: up to `banCheckMs` (60 s) after a ban made on another instance. |
| minor 1: UNMARK over a route's own mark | **Yes** | `index.ts:196` skips the UNMARK when the response has the ban header or sets `hc_banned`. Tested (one `hc_banned` cookie, the route's). |
| minor 2: code routes without Origin/JSON checks | **Yes** | `email/start` and `email/verify` both check Origin and JSON. A refused code is spent (`spendEmailCode`). For evasion, the age question comes before any mark (`askAgeFirst` returns first), so one code plants at most one mark. The app's `api()` sends JSON, and browsers send Origin on same-origin POSTs (as `/api/auth/age` already relied on). |
| minor 3: one ask per page load | **Yes** | `ban.ts` `checkBan`: after a ban answer it asks again in 60 s. After a failed ask it waits 5 s, doubling to 60 s. It asks at once on `visibilitychange`/`online`, and there's one ask at a time. `ban.test.ts` covers all of it. |
| minor 4: evasion leaves nothing to clear | **Yes** | `evasionAccount` makes the account, banned by evasion. Cleared by a person, it signs in and stays cleared: `identityOwner`'s cleared clause, and `setCase` drops the evasion account's identity rows on a lift. Tested by the PR; my D2 covers it with another account signed in. See new minor 2 for a side effect. |
| minor 5: gate cost | **Yes** | `banCheckMs` is 60 s. `ops.md` says `ops` load-tests the gate before launch. |
| minor 6: "Ban from online play" | **Yes** | Now "Ban (can't sign in)". `chat-mod.test.ts` was updated with it. |
| minor 7: privacy text | **Yes** | `Legal.tsx`: the text now covers an evasion ban and the shared device. |
| nits (WebSocket in ROUTES, the lifted email, `SUPPORT_EMAIL`) | **Yes** | `/api/lobby/ABCDE/ws` with `Upgrade` is in `ROUTES`. There's a `lifted` email kind (`decide` and `decideAppeal` use it). `CONTACT = SUPPORT_EMAIL`. |

## The brief's questions

- **The mark refuses only requests with no session, never the sign-in routes.** Holds. `SIGN_IN_ROUTES` is exactly the six sign-in
  routes in `api.ts` (config, age, email start/verify, Google start/callback). Logout isn't one of them, and that's right: it makes a
  guest, so on a marked browser it needs a live session (D1). "Live" means a session row that exists and hasn't expired. A made-up or
  ended token counts as no session, and the refusal clears it (D1).
- **The sister on the marked tablet signs in, plays, and her session survives his refused sign-in.** Holds.
  - The PR's test covers his emailed code.
  - D2 adds his `+tag` evasion and his banned Google account at the callback. Each time her session count stays at 1, her next
    `/api/me` is hers, and she has no case.
  - The browser keeps the mark. It names whichever account was refused last (the evasion account, then his).
- **The banned person still sees only the line (+ "Sign in to another account") on every URL and API route.** Holds.
  - With no session, every gated route gets the ban answer. That includes `/api/me`, so no guest is made for him, and logout (D1).
  - None of the sign-in routes makes a session without a proven identity. Every `createSession`/`createGuest` call is `signInAs`,
    `/api/me`, logout or test accounts, and only `signInAs` is reachable from a sign-in route (D1).
  - His own code or Google account is refused with no session made (D1, D2).
  - The app draws only `<BanScreen/>` while banned. The e2e's `onlyTheBan` allows only the line, plus the box headed "Sign in to
    another account".
- **M2 (forgetToken).** Fixed and guarded (above).
- **The sign-in routes run without a session for every browser.**
  - **CSRF:** `age`, `email/start` and `email/verify` all check Origin and JSON. Google's start is a GET that only sets `state` and
    `next` and redirects. Its callback checks `state` against its cookie, unchanged.
  - **No session means no guest merge:** `signIn` with `current = null` switches to the identity's account, or makes a new one.
  - **No new exposure:** a script could already get a guest with one `GET /api/me`, and the per-address and per-IP limits still
    apply.
  - **A guest ended on a refused sign-in:** yes, `refusalEnds`. D3: a guest made by her sign-out is ended when he tries his banned
    account, and the tablet is back to the line. A signed-in account's session is never ended (D2).
- **Evasion accounts are made, banned and clearable.**
  - Made only once the sign-in can finish (behind the age question), never joined to `current`, banned by evasion, the code spent.
  - Clearing works and lasts (PR test).
  - Google's verified email that a banned account owns:
    - on an existing account without an email, it now bans that account by evasion;
    - on a new Google account, it makes its own evasion account.
    - Both can be cleared, and that's consistent with PLAY.
- **The app's re-asks: no loop, backoff.** Holds.
  - `enterBan` while the screen is already up does nothing, and `set` starts at most one timer.
  - A 2xx brings the app back. `App` then mounts fresh, and its `loadAccount` runs again.
  - Route-level ban answers (`mayPlay`, friends, the hidden room's door) only fire for an account whose case is "banned", so the
    gate agrees with them, and the app can't swing between the screens on its own. One exception: the hidden room's door keeps its
    answer up to a minute (`SEEN_MS`), so just after a lift a tap on it can drop the app to the screen once. The next ask brings it
    back. That's fine.
  - One gap is new minor 1: the sign-in box isn't asked for again.
- **D4, the trade-off M1 accepted:** the banned person can sign in on his marked browser with a fresh address, as clearing cookies
  always allowed. D4 shows the device marker (`hc_device`, kept when the data isn't cleared) sends that account to review at PLAY.

## `e2e/hidden-boss-room.spec.ts:242` [desktop], passed only on retry (run 43515048784, `eafaf10f`, shard 13)

**Not the gate or the mark.**

- **Where it failed:** at `toLanding(admin, …)` (`:250` → `:85`). The walk-up's tap point (`__townAt("home","recluse")`) had come
  into view, then read null for 20 s. That's before any ban logic matters.
- **The failing attempt's page snapshot** (`error-context.md`) is the town, not the ban screen. It shows the nav, the town square's
  canvas, the live panel with "11 online", and "Back to me" (the camera had moved off the player). The focused element is
  "Go to Rolling Dough", another building. A ban answer would have replaced the whole page with `<BanScreen/>`.
- **The retry's trace** (the one CI keeps) has 258 network events. Every `/api/*` answer is 200, and none carries `x-hc-banned`.
- **Nothing in this test can be banned or marked.**
  - Its accounts are `asServerAdmin`/`asSignedIn` emails, and nothing in shard 13 bans anyone. `fairplay.spec.ts` ran on shard 5,
    on another runner with its own server and database.
  - Each test's browser context is fresh, so it has no `hc_banned`.
  - The gate's added work is one indexed read per session per 30 s (at `eafaf10f`). That's negligible on the local database.
- **The likely cause:** the town camera or glide moving the walk-up off screen during the tap loop. That's the town's, or the spec's,
  to fix at its cause if it shows on main.

## New findings

### Minor

1. **The ban screen asks for the sign-in options once per mount. If that ask fails, the shared device's box never appears.**
   - **Where:** `FairPlay.tsx:41` calls `loadSignInOptions()` in a `useEffect(…, [])`. `loadSignInOptions` swallows a failure
     (`account.ts:244`). Its comment, "the screen asks again when it's back", is true only of `checkBan`, which doesn't fetch the
     options.
   - **When it bites:** a device that remembers the ban (`brc.banned`) draws `<BanScreen/>` first and never mounts `App`. So
     `loadAccount` never runs, and this one ask is the only fetch of `/api/auth/config`. If it fails (offline at launch, a 429, a
     5xx), the box stays missing for the page's life. On the family tablet, the sister then has nothing to tap until a reload, and
     on an installed app that means closing it.
   - **Fix:** call `loadSignInOptions()` again on the screen's asks (`checkBan`) or on `online`/`visibilitychange`. It already
     returns at once when the options are known. A unit test in `ban.test.ts` or the e2e (`/api/auth/config` fails once) would pin
     it.
2. **Evasion at sign-in strands the guest's progress of a person later cleared** (a side effect of minor 4's fix).
   - **What happens:** `evasionAccount` (`fairplay.ts:223`) makes the account with `current = null`. `refusalEnds`
     (`ban-gate.ts:85`) ends the guest's session as "the one signing in".
   - **Before #687:** for the Oct 16 cousin, the guest itself took the address, was banned at PLAY, and clearing gave everything
     back.
   - **Now:** a cleared cousin gets an empty "Player" account, and their guest's results, XP, coins and items stay on an orphaned
     guest with no session.
   - **Why joining is safe:** joining a guest `current` (as `signIn` does) is never worse. For the banned person's own guest, the
     things go into a banned account. For a guest made by another account's sign-out on a shared tablet, it's ended either way. It
     also fits call 3 ("a guest's session is the one signing in"). Another account's session must still never be joined, as now.
   - **Fix:** join a guest `current`, or add one line to the decision's call 6 saying a cleared person starts fresh. Rare case, low
     priority.

### For Eric (process, not code)

- **Eric's rule has new wording, and the ban screen now has more than the line.** The round adds a sentence to the rule in
  `docs/rules/eric.md:163` ("'No URLs work' is about the banned account, not the device…"). It also adds "Sign in to another
  account" under the line. Eric said "it would say your account has been banned. For more information, email support", and "No URLs
  work". The rule is new in this PR and not on main, so no guard on main was edited. Still, the new sentence interprets his words,
  and CLAUDE.md makes changes to his rules his call. I think the call is right: it's how per-account bans work in other games, and
  without it the family tablet is locked out for 400 days. But the PR body should ask Eric's OK on that sentence, and on the box,
  before merge. The round already marks the box as removable (call 1).

### Nits

- **She waits up to a minute after his refused sign-in.** On a tablet where her session survives, the app drops to the ban screen
  (the answer carries the header) and comes back to her account only at the next ask. That's up to 60 s (`ban.ts:59`), or sooner on
  a reload or when the page comes back into view. Showing him the line is right. A sooner ask after a refused sign-in from the box,
  say 5 s, would give the tablet back quicker. UX only.
- **The box is missing on a "too young" device.** `FairPlay.tsx:53` leaves the box out when `age === "under"`. Everywhere else
  `<SignIn>` shows the friendly too-young line in its place (`SignIn.tsx:41`). Dropping that condition would make it consistent
  with "nothing hidden".
- **Decision call 3 overclaims the device marker.** It says "clearing the browser's data clears it too (… the device marker still
  sends a new account from it to review)". Clearing the data clears `hc_device` too. The marker sends a new account to review only
  when the data is kept: D4's case, a fresh address on the still-marked browser. This wording was carried over from the first round.

## Checked and sound

- **The order of the gate's checks.**
  - A banned session is refused on every route, sign-in routes included, and ended there.
  - A stale mark is taken off even when a live session comes with it: the sister's tablet after a lift.
  - The database down: the request passes.
  - The `!admin` skip covers only `/admin/fairplay` and `/admin/ops`, and both still require `isAdmin` or the reviewer token. The
    reviewer's API is under `/api/admin/` and so is gated, but it uses a bearer token, not a session.
- **`refusalEnds`.**
  - A gone token (with `current` null) is ended and its cookie cleared.
  - A guest's session is ended. So is the banned account's own, though the gate normally gets there first.
  - Another account's session is never ended, and then `hc_session` is left alone (`banHeaders(…, ended=false)`).
  - Test accounts use the same rule.
- **`signInBan`/`evasionAccount`.**
  - `signInBan` only reads, apart from the evasion ban of an existing account. Accounts are made only past `finish`.
  - The Google path asks the age question with nothing made when `evades` can't finish yet.
  - The `brought` email is checked only for an account without one.
- **The sign-in box.**
  - The e2e signs the sister in from the ban screen and plays. The mark stays.
  - The heading is `Sign in to another account`.
  - `onlyTheBan` still checks: no canvas or home, no stray buttons, no sideways scroll.
- **Docs.** The decision's review round, `fairplay.md`, `accounts.md` and `ops.md` match the code. `ops.md`'s figure is corrected
  for 60 s.

## Appendix: the delta proof tests

The PR's `ban-sign-in.test.ts` up to its first `describe` (imports and harness, lines 1 to 104), then:

```ts
import { banCheck } from "../src/fairplay.ts";
const sessionsOf = async (sql: Sql, userId: string) => (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?", userId))!.n;
beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.useRealTimers());

describe("delta review POC", () => {
  it("D1: a marked browser with no session: the sign-in routes mint no session; every other route, logout and a made-up token get only the line", async () => {
    const w = await setUp();
    const bro = await account(w.sql, "email", "bro@example.com");
    await setCase(w.sql, bro.id, "banned", "admin:eric@example.com", "engine moves", 1500);
    const b = browser(w);
    b.jar.set("hc_banned", bro.id);
    expect((await b.call("/api/auth/config")).status).toBe(200);
    expect((await b.call("/api/auth/age", { json: { oldEnough: true } })).status).toBe(200);
    expect((await b.call("/api/auth/email/start", { json: { email: "bro@example.com" } })).status).toBe(200);
    expect((await b.call("/api/auth/google/start?next=/")).status).toBe(302);
    expect(b.jar.has("hc_session")).toBe(false);
    for (const p of ["/api/me", "/api/live", "/api/quests"]) isBanAnswer(await b.call(p));
    isBanAnswer(await b.call("/api/auth/logout", { method: "POST" }));
    b.jar.set("hc_session", "e2enotarealtoken0123456789abcdefgh");
    isBanAnswer(await b.call("/api/me"));
    expect(b.jar.has("hc_session")).toBe(false);
    // His own code: refused, still no session, still marked with him.
    isBanAnswer(await b.call("/api/auth/email/verify", { json: { email: "bro@example.com", code: w.codes.get("bro@example.com") } }));
    expect([b.jar.has("hc_session"), b.jar.get("hc_banned")]).toEqual([false, bro.id]);
  });

  it("D2: the sister signed in on the tablet: his evasion sign-in (+tag) and his Google sign-in are refused; her session survives each", async () => {
    const w = await setUp();
    const bro = await account(w.sql, "email", "bro@gmail.com");
    await w.sql.run("UPDATE users SET google_sub = 'g-bro' WHERE id = ?", bro.id);
    const sis = await account(w.sql, "email", "sis@example.com");
    await decide(w.sql, bro.id, "ban", "admin:eric@example.com", "engine moves", Date.now());
    const t = browser(w);
    t.jar.set("hc_session", await createSession(w.sql, sis.id, Date.now()));
    expect((await t.call("/api/me")).status).toBe(200);
    // Evasion by a +tag: its own account, banned; her session untouched; the tablet marked with the new account.
    const r = await t.emailSignIn("bro+2@gmail.com");
    isBanAnswer(r);
    const ev = (await w.sql.first<{ id: string }>("SELECT id FROM users WHERE email = ?", "bro+2@gmail.com"))!;
    expect(await caseOf(w.sql, ev.id)).toMatchObject({ status: "banned", decided_by: "evasion" });
    expect([await sessionsOf(w.sql, sis.id), await sessionsOf(w.sql, ev.id), t.jar.get("hc_banned")]).toEqual([1, 0, ev.id]);
    expect(((await t.call("/api/me")).body as { user: { id: string } }).user.id).toBe(sis.id);
    // His banned Google account: refused at the callback; her session untouched.
    Object.assign(w.google, { sub: "g-bro", email: "bro@gmail.com" });
    expect(await t.googleSignIn()).toBe(`${origin}/town?signin=banned`);
    expect([await sessionsOf(w.sql, sis.id), t.jar.get("hc_banned")]).toEqual([1, bro.id]);
    expect(((await t.call("/api/me")).body as { user: { id: string } }).user.id).toBe(sis.id);
    // Nothing of hers became a case.
    expect(await caseOf(w.sql, sis.id)).toBeNull();
  });

  it("D3: a guest made by her sign-out on the tablet: his refused sign-in ends it (call 3), and the tablet is back to the line", async () => {
    const w = await setUp();
    const bro = await account(w.sql, "email", "bro3@example.com");
    const sis = await account(w.sql, "email", "sis3@example.com");
    await setCase(w.sql, bro.id, "banned", "admin:eric@example.com", "engine moves", 1500);
    const t = browser(w);
    t.jar.set("hc_banned", bro.id);
    t.jar.set("hc_session", await createSession(w.sql, sis.id, Date.now()));
    expect((await t.call("/api/auth/logout", { method: "POST" })).status).toBe(200);
    const guest = ((await t.call("/api/me")).body as { user: { id: string } }).user.id;
    expect(guest).not.toBe(sis.id);
    isBanAnswer(await t.emailSignIn("bro3@example.com"));
    expect(await sessionsOf(w.sql, guest)).toBe(0);
    isBanAnswer(await t.call("/api/me"));
  });

  it("D4: the banned person signs in on his marked browser with a fresh address: allowed (as clearing cookies), and the device marker sends it to review at PLAY", async () => {
    const w = await setUp();
    const bro = await account(w.sql, "email", "bro4@example.com");
    const device = "dev0123456789abcdef";
    await banCheck(w.sql, bro, device, 1000);
    await setCase(w.sql, bro.id, "banned", "admin:eric@example.com", "engine moves", 1500);
    const b = browser(w);
    b.jar.set("hc_banned", bro.id);
    b.jar.set("hc_device", device);
    const signed = await b.emailSignIn("someone-new@example.com");
    expect([signed.status, signed.banHeader]).toEqual([200, null]);
    const fresh = (await w.sql.first<User>("SELECT id, name, icon, email, google_sub, created_at FROM users WHERE email = ?", "someone-new@example.com"))!;
    expect((await b.call("/api/live")).status).toBe(200);
    expect(b.jar.get("hc_banned")).toBe(bro.id);
    expect((await banCheck(w.sql, fresh, device, Date.now())).banned).toBe(false);
    expect(await caseOf(w.sql, fresh.id)).toMatchObject({ status: "review" });
  });
});
```
