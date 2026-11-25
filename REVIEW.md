# Review: PR #936, residents host (`claude/residents-host` @ e51b09fb vs main)

Read-only review, about 45 minutes. I read the whole diff, `@cloudflare/containers` 0.3.7's `container.js` (the version in the
lockfile), and the residents program and server routes it touches. I also ran `start.sh` for real against a local bare repository,
with stand-in `node`, `npm` and `sleep` on `PATH`. That run checked the restart loop, the backoff, exit 75, SIGTERM forwarding and
where the secret ends up.

**Verdict:** no blocker for merging with `RESIDENTS_HOST_ON` set to "0", as long as M4 is checked first (one look at the
dashboard). Fix M1 to M3 before the host is turned on: each one leaves the host running when it shouldn't, or makes it fight with
itself.

## What holds (checked, no change needed)

- **The deploy.** Migration v7 with no `containers` entry is safe. `ResidentsHost` is exported from `index.ts`, and the `containers`
  array (EngineServer only) is unchanged, so EngineServer gets no rollout and keeps its pinned digest. The library's constructor
  throws when `ctx.container` is undefined (container.js:350), but nothing builds the object while the host is off: `hostPlan`
  returns "none" before `getContainer`, and `/api/admin/residents` only calls the pure `hostPlan`. Staging inherits the migration,
  and the exported class satisfies it.
- **The cron.** It can't start the host while paused: `keepUp` runs only on "keep", which needs not paused and both halves of the
  token. A throw stays isolated: the tick is its own `waitUntil` with `.catch(failed("residents-host"))`, and async functions turn
  throws into rejections. Two overlapping runs don't double-start, because the library merges concurrent starts (`startInFlight`,
  container.js:1294).
- **`start()` with nothing listening returns at once.** It returns while the container runs and the port answers "not listening"
  (container.js:1393). The comment's claim holds.
- **The secret stays out of logs and process arguments.** No `set -x`. The secret goes into node's environment, never a command
  line. The `host` field in `/api/admin/residents` contains only the plan's fixed strings. The heartbeat body carries no token.
  Checked by running the script: npm saw `CF_ACCESS_CLIENT_SECRET` unset; node saw it set.
- **`npm ci --ignore-scripts` holds for install time.** Eight packages in the lockfile have install scripts (esbuild ×3, fsevents ×2,
  protobufjs, stockfish, workerd), and with the flag none of them runs. The program doesn't need any of them (Maia's model is a
  committed `.onnx` file, and onnxruntime-web's wasm comes from node_modules).
- **The `start.sh` loop works as described (run).** Exit 75 restarts at once and resets the wait. Any other exit waits 60, 120,
  240, 480, then 900, 900, … seconds. A failing install retries on the same schedule, so a broken main costs one `npm ci` attempt
  every 15 minutes. The lockfile skip works: after the install recovered, later runs didn't reinstall. SIGTERM during a run gets
  "host: stopping", reaches node, and bash exits 0. SIGTERM during the backoff sleep exits at once.
- **The `OPS_ACCESS_CLIENT_ID` pin doesn't lock out the ops scripts.** `ops:report` and `cheater-demo` send `CF_ACCESS_CLIENT_ID2`,
  the 5212… token (STATUS.md, Nov 25: "= TEST_ACCOUNTS_CLIENT_ID"). `residents.ts:160` and `test-accounts.ts:69` override the pin on
  each call, so the residents' own routes still take the residents token. Staging has no Access vars (top-level `vars` aren't
  inherited), so it is unaffected. Admins' sessions on `/admin/ops` are unaffected.
- **The drain can't stall forever.** Every request has a 30 s timeout (client.ts). The drain ends after 20 minutes at most.
  `shutdown` waits at most 15 s for residents, then one beat (30 s at most), then exits.

## Majors

### M1. A rotated, expired or revoked token never reaches a running host, and the host keeps running for nothing
`residents-host.ts:25` (env passed only at `start`), `run.ts:350`, `start.sh:13`.

**Scenario:** Eric rotates the residents token's secret (after a leak, or when it expires: service tokens have a lifetime) and
updates the Worker secret. A secret change is a new Worker version: the DO restarts and finds the container running. Every cron run
after that takes `keepUp`'s "running" path, which only renews the sleep timer. The container's environment still holds the old
secret. Access turns it away, so the program stops ("Access turned the service token away", exit 1). `start.sh` restarts it with
the same `$secret`, and it fails at start again, retrying every 15 minutes for good. The host costs about $52 a month and plays
nothing. No alert watches the heartbeat (`alerts.ts` has nothing for residents), so only someone reading `beat.at` would notice.
The way out is a manual pause and unpause, or setting the host off and waiting (see M2). The run.ts comment "the host tries again
later" isn't true: it tries again with the same credentials.

**Fix (simplest):** give Access's refusal its own exit code (say 78) and have `start.sh` exit the container on it, with no restart
loop. The next cron run then starts a fresh container with the Worker's current secret. Or have `keepUp` store a hash of the
`envVars` it started with in the DO's storage (never the secret itself), and stop and restart when the hash changes. That also
covers m4.

### M2. "Off" doesn't stop the host, and with the host off the pause doesn't either; each deploy pushes its sleep back 30 minutes
`residents-host.ts:77-78`, test `residents-host.test.ts:77`, `DEPLOY.md:59`.

**Scenario:** the host is on, then `RESIDENTS_HOST_ON` goes to "0" (a PR merge, so a deploy). `hostPlan` returns "none", so the
cron never calls `halt`, and the docs rely on `sleepAfter` ("it sleeps within 30 minutes"). But the library keeps the sleep deadline
in memory (`sleepAfterMs`, container.js:772) and renews it in the constructor (container.js:360). Every Worker deploy restarts the
DO, the alarm loop constructs it again, and the deadline becomes now plus 30 minutes. On a day with a merge to main at least every
30 minutes (common here), the host never sleeps. The same applies to the off-plus-paused case the test asserts ("Off wins over the
pause"). Setting `PAUSE_RESIDENTS` is itself a "Save and deploy", so it pushes the sleep back again, and `start.sh` keeps the
container alive with restarts. Turning residents off, or pausing them with the host off, doesn't reliably stop the spend.

**Fix:** once the image exists, make off, paused and no-token all call `halt`, with paused checked first, whatever the off
switch says. For the time before the image exists, add a var (say `RESIDENTS_HOST_IMAGE: "1"`) set in the same PR as the
`containers` entry, and return "none" only while it's unset. Or keep the call and swallow the library's "Containers have not been
enabled" error. Update DEPLOY.md's "sleeps within 30 minutes" line and the test's comment.

### M3. Two programs at once sign each other's residents out
`residents.ts:237` (signing in deletes the account's other sessions), `residents.ts:160` (both tokens become `by: "access"`).

**Scenario:** the host is on, and the director runs the program from a session with the test-accounts token, which this PR keeps
"on purpose". Both programs sign in the same 200 accounts. Each sign-in deletes the other program's session, so each side gets 401,
signs in again ("signed out, signing in again", resident.ts), and kicks the other out. The two ping-pong across every account, and
a game's socket can lose its session mid-game. The heartbeat can't show this: `by` is "access" for both tokens, and the last beat
overwrites the previous one, so the report looks healthy. This becomes likely the day the host goes on: STATUS.md shows the
director's own runs going on nights in a row.

**Fix:** put an instance id (random, per start) in the beat. At start, the program reads `/api/admin/residents` (it already does,
for `paused`) and refuses to start if a different instance sent a beat within 2 × `beatSeconds`, unless `--force` is given.
`caller` should say which token it was (`access:residents` / `access:test`). Add a DEPLOY.md line: set the host off and wait, or
pause, before a manual run.

### M4. Check before merging: `OPS_ACCESS_CLIENT_ID` may already exist as a Worker secret
`wrangler.jsonc:82`, `ROADMAP.md:136-138`.

Until this PR, ROADMAP ("Only Eric can do") and the Oct 15 decision told Eric to add `OPS_ACCESS_CLIENT_ID` as a Worker secret,
optionally. If he did, this PR adds a plain-text var with the same name. Cloudflare refuses a binding name used twice with different
types (API error 10053, "Binding name … already in use"). I couldn't confirm whether `wrangler deploy` with `keep_vars` replaces the
secret or fails, but either way the production deploy is at risk. Look in Workers → chessroyale → Settings → Variables and Secrets
before merging, and delete the secret if it's there. In the same PR, update `ROADMAP.md:136-138`: it still tells Eric to add the
secret, and doing that now would collide with the var.

## Minors

- **m1. A second drain for nothing when main is ahead of the live version** (`run.ts:189-196`, `run.ts:271`). After an exit-75
  restart (or any crash restart), `start.sh` clones the head of main, which may already hold a merge whose deploy isn't live yet.
  The new program reads the old version as its `startVersion`. When its own commit goes live, it drains again: everyone goes
  offline for up to 20 minutes, then 200 sign-ins, all to restart on the same commit. Two merges a few minutes apart (normal here)
  are enough. A slow or failed first read of `/version.json` has a related effect: the first version it does read becomes its
  `startVersion`, even if that's a later deploy. **Fix:** let `own = RESIDENTS_COMMIT?.slice(0, 12)`. In `checkVersion`, when
  `v === own`, set `startVersion = v` and return without draining. Use `own` as the start version when the first read fails. Note
  also that a rollback has the host running main's newer client against the older server; add "pause residents" to the rollback
  steps.
- **m2. "git and npm never see it" is weaker than it reads** (`start.sh:13-14`). `unset` removes the secret from children's
  environments but not from bash's own startup environment: any process running as `node` can read it from
  `/proc/<bash pid>/environ`. In the run, npm's stand-in read it from `/proc/$PPID/environ`. The real protection is that git and npm
  run no repository or package code (`--ignore-scripts`), and that holds. **The plain risk:** anyone who lands code on main, or a
  dependency version change in the lockfile, gets the token within about 2 minutes of the deploy. Every module `run.ts` imports runs
  with it in `process.env`: tsx with esbuild's binary, ws, chess.js, onnxruntime-web, the workspaces. So does the Maia child, which
  inherits `process.env` (`maia-process.ts:9`). That is the same trust main already has (the Worker's bundle runs with every Worker
  secret), so this is not a new boundary. The container does install the whole monorepo's dependency tree, but it only runs that
  short list. What the token opens: Zero Trust for the whole pre-launch site, and the residents routes (make and sign in residents,
  with seeded items). Cheap reductions: `delete process.env.CF_ACCESS_CLIENT_SECRET` right after `targetFrom` reads it, and spawn
  Maia with an environment without it. Reword the start.sh comment and the decision note to say what actually protects the secret.
- **m3. `$HOME` under `set -u`** (`start.sh:12`). Docker sets `HOME` from `USER node`, which is where it was tested. I can't see
  whether Cloudflare's runtime does. If it doesn't, the script dies at line 12 ("HOME: unbound variable"), the container exits, the
  cron starts it again every 15 minutes, and residents never run. Fix with one line: `: "${HOME:=/home/node}"` before line 12
  (or `ENV HOME=/home/node` in the Dockerfile).
- **m4. A change to `RESIDENTS.host.args` doesn't apply after a deploy** (`residents-host.ts:90`, `settings.ts` `host.args`). The
  args reach `start.sh` as `RESIDENTS_ARGS` only when the container starts. A follow-deploys restart reruns the program with the
  old args, so a settings change waits until the container next starts from cold. Either read them from the checkout (run.ts can
  take `RESIDENTS.host.args` itself when started by the host), or say so in the settings comment. M1's env-hash fix covers this too.
- **m5. The tests don't prove the riskiest parts.** `residents-host.test.ts` mocks `Container` entirely, so it proves `hostPlan`,
  `hostEnvVars` and the wiring, nothing about the library. That's fine for a unit test, but two other claims are unproven:
  - **The drain logic has no test** (it is inline in run.ts's top-level loop), and `start.sh` has none either.
  - **The cold-start comment** ("up to a minute", `residents-host.ts:23`) doesn't match the numbers. With `retries: 200`, the
    300 ms wait and the library's 5 s ping timeout, the wait can reach about 200 × 5.3 s ≈ 18 minutes.

  **Fix:** move the drain decision into a pure function (new version, own commit, all idle, time up) with a short test, and add a
  small bash test using stand-in `node`/`npm`/`sleep` like the one I ran. It takes a few seconds and checks exit 75, the backoff,
  TERM forwarding and the secret not reaching npm.

## Nits

- **n1.** After a failed fetch or install, `start.sh` logs "couldn't fetch or install main" and then "the program exited with 1",
  although the program never ran. Log "again in N s" for that case instead.
- **n2.** `fail()` after Maia has started ("no resident could sign in", or `AccessRefused` during sign-in) exits without
  `engine.close()`. The Maia child is left to bash (PID 1) with its stdin closed; `cli.ts` has no `close` handler. If onnxruntime
  keeps the event loop alive, each such restart leaks a Maia process. I haven't verified that it does. Fix: close the engine in
  `fail`, or kill the child on `process.on("exit")` in `maiaProcess`.
- **n3.** `hostEnvVars` trims the client ID but not the secret. A secret pasted with a trailing newline gets refused, which then
  turns into M1's endless retry. Trim it, or have `hostPlan` say "no token" for one with whitespace around it.
- **n4.** `FROM public.ecr.aws/docker/library/node:22-bookworm` is a floating tag. The pushed image is pinned by digest in
  wrangler.jsonc, so production is stable, but a rebuild picks up whichever Node 22 is current. Pin the `FROM` by digest so the
  build can be reproduced.
- **n5.** `RESIDENTS_HOST_ON: "1"` before the `containers` entry exists makes the cron throw every 15 minutes (the library's
  constructor error), counted as a server error. DEPLOY.md gives the right order; M2's `RESIDENTS_HOST_IMAGE` flag would make the
  mistake impossible.
- **n6.** Unverified, from the docs: "a Worker deploy doesn't restart the container". If it is wrong, the cost is only a SIGTERM
  and a clean restart per deploy, which the program handles. Worth one look in Observability on the first deploy after the host
  goes on.

## Test checks changed or removed by the PR
None removed. Added: `packages/server/test/residents-host.test.ts`. Its assertion that "off wins over the pause"
(`residents-host.test.ts:77`) encodes M2's behavior and should change with the fix.
