# Delta review: PR #936's review fixes (`claude/residents-host`, e51b09fb → 55fd6bda)

Read-only, about 30 minutes. I read the whole fix delta (`git diff e51b09fb 55fd6bda -- packages scripts docs wrangler.jsonc DEPLOY.md
ROADMAP.md`), and checked it against `@cloudflare/containers` 0.3.7's `container.js` (stop, alarm loop, storage, envVars), the
residents client and the heartbeat route. Run at 55fd6bda:

- `npx vitest run packages/server`: 103 files, 1552 tests, all pass.
- The four residents test files (`residents-start`, `residents-host`, `residents-program`, `residents`) three times in a row: 70 of 70
  pass each time. `residents-start.test.ts` runs the real `start.sh` under bash in about 0.8 s.
- `npm run typecheck`: passes.
- The base image's digest, checked on AWS's mirror (registry HEAD): `sha256:7c400d78…988e` exists and is what `node:22-bookworm` points
  to there today.
- Node's `/proc` environment after `delete process.env.X`, checked for real (m2 below).
- `versionCall` driven with tsx for the case where the first read fails (N1 below).

**Verdict: no blocker, no major.** Every finding the brief named is fixed, and its test proves what it says, except where noted.
The secret can't reach a log, a beat, git, npm or a process's command line. The hash in the object's storage can't be turned back into
the secret. The host can't start while paused, and once the image exists it stops within one cron run when off, paused or without a
token. M3's rule can't lock the host out for good. Exit 78 can't cause a start storm. It does start a silent loop (minor 1).

## Each finding

- **M1 (exit 78 and the environment's hash): fixed.** `start.sh` ends the container on 78 (`start.sh:81-84`). The program gives
  78 on Access's refusal at start, at sign-in and on a beat (`run.ts:284,311,370`). `keepUp` stores a SHA-256 of the environment
  before `start`, and while the container is running it compares that hash with the current one (`residents-host.ts:28-46`). A
  mismatch gets a SIGTERM, and the next run starts the container fresh. The tests cover the rotation, an unknown hash, and the fresh
  start that keeps the new hash.
  - **Can the hash give the secret away? No.** It is a plain SHA-256: no key, no salt. Two of its three inputs are public: the client
    ID in `wrangler.jsonc`, and the options in `settings.ts`. So the hash would confirm a correct guess of the secret. But Access
    generates the secret as 64 hex characters (256 random bits), so guessing it is hopeless. Only two things can read the hash: the
    object's own code, which already has the secret in `env`, and an account member using the dashboard's Durable Object data browser,
    who could replace the secret anyway. It needs no key or salt. A key would mean a second Worker secret, which isn't worth the code.
  - The library doesn't keep `envVars` anywhere: it reads them per start (container.js:1327). Its own storage key is
    `__CF_CONTAINER_STATE`, so `envHash` can't collide with it, and nothing in the library calls `deleteAll`. The hash is
    deterministic (sorted keys, fixed inputs), so it can't flip between runs and cause a restart loop.
- **M2 (off, paused or no token stops it, gated by `RESIDENTS_HOST_IMAGE`): fixed.** The order is: no image, then paused, then
  off, then no token (`residents-host.ts:95-103`). It is tested for every off value, for paused-and-off, and for a blank secret.
  - **Can the host start while paused? No.** `keepUp` runs only on "keep". Nothing else starts the container: nothing fetches the
    object, and the library's `alarm()` never starts one.
  - **Does it keep spending once off? No.** With the container down, the cron's `halt` wakes the object. Its constructor sets an alarm
    a second ahead (container.js:359), and that alarm finds nothing running and deletes itself (container.js:1556-1564). There's no
    alarm loop and no start, so off costs two object calls per run. If the program ignores the first SIGTERM, the next run sends
    another, and a second signal makes the program exit at once (`run.ts:183`).
  - The DEPLOY.md, `index.ts` and test comments are updated. The old "off wins over the pause" assertion now asserts the opposite,
    as the review asked.
- **M3 (the instance id and the refusal to start): fixed, and it can't lock the host out for good.** A beat carries `instance`
  and `stopped`. The route stores the whole body and stamps `at` with server time, so both fields survive (`residents.ts:310`). The
  program checks before it beats for the first time, so a refused program never refreshes the beat it was refused on. Exit 1 is never
  final in `start.sh`, which retries with backoff (at most 15 minutes). The cases:
  - **A crash with no last beat:** the host's retry 60 s later can see its own stale beat (younger than 2 min) and refuse once. The
    120 s retry after that passes. That's about 3 minutes, every time.
  - **The host's first start while a director's run is going** (new or old program): the host refuses and backs off 60 → 900 s. The
    container stays up and billed meanwhile. It starts within 15 minutes of that run's end. An old program sends no `stopped`, so its
    last beat has to age out (2 minutes) first. The old program never checks either: see N5.
  - **The restart after exit 75, or a stop after a SIGTERM:** the last beat says `stopped`, so the next program starts at once.
  - **Paused:** no last beat (the server refuses beats while paused). By the time the pause is lifted, the last beat is normally
    older than 2 minutes.

  A beat's `by` now names the token (`access:residents` / `access:test`), tested in `residents.test.ts`. DEPLOY.md has the
  "before a manual run" line. Small rough edges: minor 2, N5, N6.
- **m1 (no drain on its own commit): fixed**, with one corner case that errs on the safe side (N1). `own` is
  `RESIDENTS_COMMIT.slice(0, 12)`, which matches `/version.json`'s `version` (vite.config.ts: `COMMIT.slice(0, 12)`). Tests: its own
  commit going live doesn't drain, and the next one after it does.
- **m2 (the secret out of `process.env` and out of Maia's environment): fixed as worded in `run.ts`.** The decision note says a
  little more than is true (N2). The delete comes right after `targetFrom` has copied the secret into `target.access` (`run.ts:72`),
  and nothing reads the variable later. `maiaEnv` drops `*SECRET*`, `*TOKEN*` and `*PASSWORD*`, and that is tested.
  - **Logs:** none. Every `fail` and `log` names only the origin, the exit code and fixed text. `AccessRefused`'s message is fixed
    text, and the cron's log line is the plan's fixed strings.
  - **Beats:** none. A beat carries counts, the instance and the commit.
  - **The object's storage:** the hash only.
  - **Git and npm:** the variable is unset before either runs, and the bash test asserts npm sees it unset.
  - **A process listing:** never in a command line. In the environment, as the start.sh comment says.
- **m3 (HOME): fixed** in both places: `: "${HOME:=/home/node}"` in start.sh, and `ENV HOME` in the Dockerfile. The Dockerfile line
  takes effect only when the image is next built, which is fine, since it hasn't been pushed. There's no test, which is fine: the
  default path needs a writable `/home/node`.
- **m4 (options only applied at a cold start):** covered by M1's hash (the options are part of it). On the wording, see N4.
- **m5 (tests): fixed.** `lifecycle.ts` holds the drain, version and other-program decisions as pure functions, each with tests.
  `residents-start.test.ts` runs the real `start.sh` with stand-in `node`, `npm` and `sleep`. It covers 75 restarting at once, the
  60 → 900 s backoff and its reset after 75, 78 ending the container, the secret reaching node but not npm, a failed install's
  message, and SIGTERM reaching the program and ending with exit 0. The comment about the cold start's length is corrected (about 18
  minutes at most).
- **n1–n4: fixed.**
  - n1: a failed fetch now says "couldn't fetch or install main: again in N s", and that is tested.
  - n2: `process.on("exit")` kills any Maia still running, so `fail()` after Maia leaves none behind.
  - n3: both halves of the token are trimmed, and a blank secret counts as no token. Both are tested.
  - n4: `FROM` is pinned by digest through a build argument, and I verified the digest on AWS's mirror.
- **n5:** moved, not removed. `RESIDENTS_HOST_IMAGE` "1" without the `containers` entry still throws at every cron run. The comments
  say to set both in the same PR, which is the review's own suggestion, so nothing more is needed.

## Minors

1. **While the token stays refused, the host keeps reinstalling every 15 minutes, and nothing says so where anyone looks**
   (`start.sh:81-84`, `residents-host.ts:39-45`; `docs/decisions/2026-11-25-residents-host-review.md:5`).
   - **When:** the Worker's secret is unchanged but Access refuses it: the token was revoked, it expired (service tokens have a
     lifetime), it was dropped from the Service Auth policy, or the wrong secret was pasted.
   - **What happens:** every cron run starts a fresh container. Each one cold-starts, clones, and runs `npm ci`. The tree is about
     680 MB: I measured `node_modules` after the same `npm ci --ignore-scripts`, and a fresh container has an empty disk. Then the
     first GET is refused, and the container exits 78. That's 96 times a day, until someone looks.
   - **Not a storm:** there's one cron, the library merges concurrent starts, and nothing else starts the container. It's also
     cheaper than the old loop, because the container is down between tries. Self-healing was a deliberate choice.
   - **Nobody would notice:** `/api/admin/residents` keeps saying `host: keep, on`. The only traces are `residents host: started` and
     `stopped (exit, exit 78)` lines in Observability, and no alert watches the heartbeat.
   - **Simplest fix, and it keeps the self-healing:** `onStop` stores the exit code in the object's storage. When the last exit was
     78 and the hash hasn't changed, `keepUp` starts again as now, but throws afterwards (for example "Access refused the residents'
     token at the last start: fix the token, or set the host off"). The cron's `failed("residents-host")` then counts it as a server
     error, and that shows on `/admin/ops`. That's about six lines and one test.
2. **Any exit after the first beat but before a clean stop makes the host's next try refuse itself, with a misleading message**
   (`run.ts:288`, `lifecycle.ts:51-57`).
   - **Which exits:** Maia not loading, "no resident could sign in", and a crash.
   - **Example:** Maia doesn't load. Then 60 s later start.sh retries, and the program says "another residents program is playing
     (instance 1a2b3c4d (by access:residents) …)". That instance is the host's own previous run. It passes at the 120 s retry.
   - **Effects:** the restart is no slower than a couple of minutes. But the backoff doubles twice per real failure, and the log
     sends a reader looking for a second program that doesn't exist.
   - **Fix:** add to the message "(this host's own last run, if it just stopped without its last beat)".
   - **The same thing can happen once by timing:** after exit 75, a regular beat still in flight can land after the last beat (a slow
     answer: each request may take up to 30 s). The next program then sees an unstopped beat a few seconds old.

## Nits

- **N1. A failed first version read while main is ahead of the live version drains once, needlessly** (`lifecycle.ts:28-30`). Checked
  with tsx: `versionCall(firstVersion(null, OWN), OWN, OLD)` gives `{ start: OWN, drainTo: OLD }`. The order is: B is merged and
  deploying with A still live, the host clones B, and its first read fails. It counts from B, so its next read of A drains, and it
  restarts on B. That is the safe side: with no history it can't tell an older live version from a newer one, and running behind a
  newer server is the worse mistake. It needs no code change. Add a line to `firstVersion`'s comment and that case to the test, so
  nobody "fixes" it the unsafe way.
- **N2. "Maia doesn't" get the secret (`docs/decisions/2026-11-25-residents-host.md:8`) overstates it.** I checked: after `delete process.env.X`, node's
  `/proc/self/environ` still holds the value, and a child reads it from `/proc/$PPID/environ`. It is the same as bash's, which
  start.sh's comment already admits. Maia is main's own code, so nothing changes in practice. Reword to "Maia's environment doesn't
  carry it (any process of this user can still read it from /proc)".
- **N3. Setting `RESIDENTS_HOST_IMAGE` back to "0" while the `containers` entry stays brings M2 back:** the cron never stops a running
  host again, and every deploy renews its sleep. Say in the `wrangler.jsonc` comment that IMAGE stays "1" while the entry exists, and
  that `RESIDENTS_HOST_ON` is the off switch.
- **N4. `settings.ts:5982`:** "a change restarts the host at the cron's next run" should say that the next run stops it and the one
  after starts it, up to 15 minutes later, as DEPLOY.md does.
- **N5. The one-program rule is checked at start only.** Two cases still sign each other's residents out with nothing to show for it:
  - a program from an older checkout (no check) started beside the running host;
  - a `--force` start.

  The report keeps only the last beat. At least `instance` and `by` now flip between reads. DEPLOY.md's "before a manual run" covers
  it. Fine for now.
- **N6.** In `start.sh`, the `[ "$stopping" -eq 0 ] || break` lines after each `run` (`start.sh:75,89`) never run: the TERM trap
  exits inside the handler. They're harmless. Drop them, or note that they're belt and braces.

## Test checks changed or removed by the fix delta

- `residents-host.test.ts`: the old check that off wins over the pause ("Off wins over the pause", `action: "none"`) is now "paused
  is checked first" (`stop: paused`). This is the change the review asked for.
- `residents-host.test.ts`: the old check that off does nothing at all (`null`, no object) is now "off stops it" (`stopping: off`,
  then `null` once it's stopped).
- `residents-host.test.ts`: the old "nothing at all" check now applies to "no image" instead.
- `residents-host.test.ts`: the wired-in cron's instance count went from 2 to 3 (off now reaches the object).
- `residents.test.ts`: a beat's `by` went from `"access"` to `"access:residents"`.

Nothing is removed without a replacement, and none of these is a guard test in `docs/rules/eric.md`. The new tests are
`residents-start.test.ts`, `residents-program.test.ts`'s lifecycle block, and the hash and storage cases in `residents-host.test.ts`.
