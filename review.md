# Review: PR #622, test accounts and the cheater demo (one round, read-only)

Branch `claude/cheater-demo` at `6e0699f` (contains main `0593569`, #618 merged). Brief: `notes/briefs/review-cheater-demo.md`.
Ran: the server unit tests (83 files, 1124 tests, all pass), `npm run typecheck` (passes), and two probe tests of my own (both
pass, which confirms findings 1 and 2; code at the end). Nothing in the PR was changed.

**Verdict:** nothing blocks merging for the pre-launch demo. Two security/data gaps (1, 2) need fixing before launch, and the
demo's headline claim (3) isn't supported by the local numbers yet.

## Major

### 1. The service-token path does not close at launch (security)

`packages/server/src/test-accounts.ts:47` lets in any request that passes `viaAccess` (`access.ts:91-113`). `viaAccess`
checks the token's signature, audience, issuer, expiry and `common_name`. It doesn't check which path Access issued the
token for, and it can't. The launch plan keeps Access on the health path with the same variable: `wrangler.jsonc:61` ("At
launch ... ACCESS_AUD becomes the health path's own application's") and `ROADMAP.md:126-131` ("keep an Access application on
the health path ... with the service-token policy").

- **Failing case:** after launch, a holder of the ops service token calls `GET https://hunchess.com/api/admin/health` through
  Access. Access hands back its JWT (aud = the new `ACCESS_AUD`) as the `CF_Authorization` cookie. The holder sends that JWT
  as `Cf-Access-Jwt-Assertion` with `POST /api/admin/test-accounts {name}`, a path Access no longer fronts. The route answers
  200 with a session cookie, so the holder can make any number of accounts with no email on the live site and sign in as
  them. Probe 1 below shows this, with the real `viaAccess` and a token whose aud is the health application's. (This stops
  only if Cloudflare strips a client-sent `Cf-Access-Jwt-Assertion` on paths outside every Access application. I couldn't
  confirm that, and the code shouldn't rely on it.) So the line in `.pr-body.md:8` and the decision note, "at launch ... the
  token path closes by itself", is wrong.
- **Also, today:** unless the secret `OPS_ACCESS_CLIENT_ID` is set, any service token that the whole-site application admits
  passes, not just `CF_ACCESS_CLIENT_ID2`. The ops view was read-only. The same gate now makes and signs in to accounts and
  deletes them. The fair-play reviewer is a scheduled Claude agent that reads player-written text, and
  `docs/fairplay-reviewer.md:12` tells it to send "the service token" while the site is behind Access. So it may hold this
  power too.
- **Fix:** close the route in code, not through the Access setup. (a) Add a dedicated switch, e.g. `TEST_ACCOUNTS_CLIENT_ID`:
  the token path is open only when it's set, and only for that `common_name`. Unset means no token gets in. (b) Add a line to
  `ROADMAP.md`'s launch list: unset it, and run `cheater-demo.ts --delete` first. (c) Correct the decision note and the PR
  body.

### 2. Test accounts count as reporters: two or three of them put a real player in review (data)

The PR keeps test accounts off the "Top N%" and the 1 v 1 top places. Fair play's reports still count them as people:
`fairplay.ts:394-410` (`reviewIfReported`) counts distinct signed-in reporters, and a test account has an email, so it
passes `signedIn` (line 406). Review holds the target's online results off ranking (`fairplay.ts:7`), so this is a way into
real players' rankings.

- **Failing case:** probe 2. Three test accounts (`Judge Jo`, `Judge Jay`, `Strong Sam`) each `reportPlayer(..., "Cheating")`
  a real account, and its case becomes `review`. For an account with fewer than 10 matches, two reports are enough
  (`newAccountReporters`). The demo script never reports anyone. But anyone holding a test-account session can, and with
  finding 1 that stays possible after launch.
- **Fix:** add `AND u.test IS NOT 1` to the reporter query in `reviewIfReported` (or refuse reports from test accounts in
  `reportPlayer`). Add a unit test next to the "off public rankings" one.

### 3. The demo's claim that Eddie gets pooled rests on a stand-in that shares Eddie's own engine

The local deep re-check (`.pr-body.md`, "Local runs") ran fair play's `deepCheckRun` with "Node's full-network Stockfish at
1M nodes". In the repo that can only be `STOCKFISH_FULL_BUILD` (`packages/chess/src/node.ts:13`, `stockfish-19-single.js`),
which is exactly Eddie's engine (`scripts/cheater-demo.ts:613`). The live re-check is native Stockfish 17.1 (a different
version and network, `engine/Dockerfile:1-4`), single-threaded (`engine/server.mjs:143`), at 2M nodes (`settings.ts:3596`).
An engine checking its own moves agrees with them more often than a different engine would. So the local "deep best"
numbers are an upper bound on what the live re-check will show.

Even with that boost, none of Eddie's four local matches cleared the one-match bar of 90% (`banOneDeep`, `settings.ts:3719`;
the new-account pool path needs two such matches, `newHits: 2`). The four rates were 87.5%, 73%, 85% and 73%. Run B, the
script's final form, came to 19/24 = 79% across its two matches, under the 80% two-match bar (`banDeep`, line 3715), and
#618's leave-one-out rule makes the bar harder still. So "expect ... pooled within 3-6" (`.pr-body.md:35`) is a guess, and
the live run could plausibly end with Eddie only in review.

Timing works against it as well. A match costs about 120 searches. The re-check runs 40 searches every 15 minutes (about 45
minutes per match) and 500 a day (`settings.ts:3600-3601`), so at most about 4 matches a day. `--matches 6 --wait-pool 60`
will usually finish before the re-check catches up, and it plays matches 4 to 6 while matches 1 to 3 are still queued.

**Sam is not pooled for the right reason:** his matches never reached the deep re-check (scores 1.1 and 0, under
`queueScore: 2`, `settings.ts:3598`). The judges' measures that cleared him run on the lite build, the same as browsers, so
the stand-in doesn't affect his result. It rests on only two matches per run, though.

- **Fix:**
  - Rerun the local stand-in with the engine server's own binary: the `sf_17.1` avx2 release from `engine/Dockerfile`,
    `Threads 1`, `FAIRPLAY.deep.nodes`, through `deepCheckRun`, or the engine container itself.
  - Commit that stand-in harness. It isn't in the PR, so the local numbers can't be reproduced.
  - Report Eddie's per-match deep-match rate and replace the prediction with it.
  - If Eddie can't clear the bars against 17.1, tell the director before the live run. The thresholds are Eric's call. Don't
    switch Eddie to 17.1 to make the demo pass: a real cheater wouldn't use the checker's exact build.
  - Size `--wait-pool` to about 45 minutes per queued match (or say to run `--report` later).

## Minor

- `test-accounts.ts:155`: an admin's POST from the site sets the test account's session cookie in the admin's own browser.
  That signs them out of their admin account there. Send the cookie only to token and e2e callers, or say so in the docs.
- Deleting doesn't leave "nothing behind": `deleteAccount` re-keys results to `DELETED_ID` (`account-data.ts:13-16, 85`) and
  keeps ledger rows. The demo's engine-played matches and its resignations at boss finals stay in the game's stats (boss win
  rates, placements). For `purgeFairPlay`, I'd delete the results rows outright. The header of `test-accounts.ts`, "everything
  kept about it", overstates what's removed.
- `accounts.ts:307-309`: the comment cites "test-accounts.ts, NOT_TEST", which doesn't exist. The partial index `users_test`
  serves only `topPlace`'s subquery, not `publicProfile`'s `test IS NOT 1` counts. `accounts.ts:1051` adds one more D1 read
  per profile view; that value could come from the user row already read.
- `scripts/cheater-demo.ts` isn't typechecked by CI (no tsconfig includes `scripts/`). On its own, `tsc` reports only the
  missing `ws` types.
- `.done` and `.pr-body.md` are in the diff (main has neither): drop them before merging.

## Checked, fine

- **Forged headers.** `x-e2e-sql` works only where `E2E_SQL` (32+ characters) is set. It's never set in `wrangler.jsonc`, and
  staging doesn't set it. Staging also doesn't inherit `vars`, so its token path is closed and it has no sign-in or admins.
  `Cf-Access-Jwt-Assertion` is checked for signature, aud, iss, exp, nbf and `common_name`, and a person's Access login
  carries no `common_name`. A forged `Origin` still needs an admin's session: non-GET admin calls must come from the same
  origin, and cookies are `SameSite=Lax`. Every other caller gets 404.
- **No real account handed out.** The lookup is by address, and a non-test match gets 409 with no session (test covers it).
  The insert is `ON CONFLICT (email) DO NOTHING` on `users.email UNIQUE`. `test.hunchess` can't receive a code or be a Google
  address. Nothing else writes `users.test`; `signInWithIdentity`'s dynamic `UPDATE` sets only `email` or `google_sub`.
- **DELETE scope.** It selects only `WHERE test = 1`. Each store's erase touches only that id: reports by or about it,
  friends, its ranked rows, and 1 v 1 games re-keyed to `DELETED_ID`. `purgeFairPlay` is used only here, and real accounts'
  files are untouched (test covers it).
- **Migration.** On an existing database, `COLUMNS` runs `ALTER TABLE users ADD COLUMN test`, and it does run, because
  `SCHEMA_VERSION` fingerprints `COLUMNS` and `AFTER_COLUMNS`. A fresh database runs CREATE, then the ALTER, then the partial
  index. `account-data.test.ts`'s column pin is updated.
- **Rankings.** The server's only public rankings today are the "Top N%" (`publicProfile`) and 1 v 1 top places (`topPlace`).
  Both now leave test accounts out; a grep found no other leaderboard query. A test account's own "Top N%" counts itself.
- **Paid.** Making an account grants nothing (test: no wallet, ledger or items).
- **The script.** It sends the token only to exactly `https://hunchess.com`, never prints it, sends the e2e key only to
  localhost, and fails on a redirect. Every pick is checked as legal, and Maia is skipped on Freestyle positions.
- **No ban-evasion spill.** Fair play's identities are hashed email and Google id plus device markers, not IP addresses. Each
  script account gets its own device cookie, so a later ban on Eddie can't reach Eric's own devices.

## Probes (in `packages/server/test/`, not pushed to the PR)

```ts
// 1: after launch, a JWT from the health path's own Access app opens the route (real viaAccess; certs stubbed).
vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ keys: [jwk] })));
const jwt = sign({ aud: [HEALTH_AUD], iss: `https://${TEAM}`, exp: T0 / 1000 + 600, common_name: "client.access" });
const res = await handleTestAccounts(new Request("https://hunchess.com/api/admin/test-accounts", { method: "POST",
  headers: { "cf-access-jwt-assertion": jwt, "content-type": "application/json" }, body: JSON.stringify({ name: "Anyone" }) }),
  { DB: d1, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: HEALTH_AUD }, { now: T0 });
expect(res.status).toBe(200);                       // passes
// 2: three test accounts report a real player for cheating.
for (const name of ["Judge Jo", "Judge Jay", "Strong Sam"]) { /* POST via access: true, then */
  await reportPlayer(sql, testUser, real.id, "Cheating", null, T0 + 1000); }
expect((await caseOf(sql, real.id))?.status).toBe("review");   // passes
```
