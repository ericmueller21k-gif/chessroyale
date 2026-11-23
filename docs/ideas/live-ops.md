# Live ops: knowing when the live game breaks, and fixing it fast (design, Nov 9, 2026)

**Status:** piece 1 (alerts to Discord) built Nov 10 (`alerts.ts`; docs/areas/ops.md, "Alerts to Discord"), without the abandon rates, the bot and known-noise labels; pieces 2 to 4 designed, not built. Build it before launch (ROADMAP.md, "Live ops"). Eric, Nov 9: "we don't have developers, we just
have Claude Code agents … if the game comes out, there might be some issues, and the best case scenario is we're already seeing
them on the back end … and deploying fixes." And: "the last thing I'd want is the game's live and we're in panic thinking there's
issues when there's really not."

## Why

After launch, nobody watches the game all day. Today, problems reach us in three ways:
- devices and the server report errors to `ops_errors`;
- players send bug reports;
- `/admin/ops` and `npm run ops:report` show both.

All three are **pull**: someone has to look. This design adds **push**: the game tells us when something is wrong. An agent then
looks first, fixes what it can through the normal lanes, and tells Eric. It also adds **safer releases**, so a bad deploy reaches
a few players, not all of them.

## What we already have (built; don't rebuild)
- **Error reporting:**
  - every device's errors and the server's own (Durable Object entry points included) go to `ops_errors`, per hour, 30 days;
  - players' bug reports and feedback go in alongside them;
  - all of it shows on `/admin/ops`.
- **Health view:** `GET /api/admin/health` and `npm run ops:report`: the build, the live hub's numbers, errors this hour, the hour
  before and the last 24 hours, the top 10 kinds, Durable Object errors, players' reports, engine budget. It prints
  "Needs attention" lines.
- **Kill switches:** `PAUSE_<NAME>` for every mode, boss and system (shop, rewards, leave penalties …) and the
  `MAINTENANCE_BANNER`. They're set in the Cloudflare dashboard, take effect at once, and need no deploy.
- **Rollback:** `npm run rollback -- previous` returns to the last good version. Schema changes are additive only, so an older
  version still runs on today's database.
- **The Worker's cron** every 15 minutes (`wrangler.jsonc` `triggers.crons`), already used for the ledger check and fair play's
  re-check.
- **Ranked's records:** leaves and dodges are in `ranked_conduct` and counted in ops counts (`ranked.dodge`, `ranked.leave`):
  the first "abandon" signal.

## The pieces

### 1. Alerts to Discord (the cheapest and easiest: free, and the Discord app on Eric's phone gives the push notification)
- **Where:** one private Discord channel, `#hunchess-alerts`. Its webhook URL is a Worker secret (`ALERT_WEBHOOK`), never in the
  repo. Two levels:
  - **PAGE** (a ping with @Eric): players can't play;
  - **DIGEST** (a quiet post): everything else.
- **Who sends:** the existing 15-minute cron, a new step `checkAlerts()` (`packages/server/src/alerts.ts`).
- **It reads what's already stored** (no new tracking):
  - errors per 15 minutes, by kind;
  - new kinds never seen in the last 7 days;
  - Durable Object errors;
  - matches started vs finished per mode;
  - dodges and leaves;
  - the engine budget;
  - the live-site bot's last result (piece 3).
- **A PAGE needs all three** (piece 5, no false alarms):
  - a real count (e.g. 20+ errors of one kind in 15 minutes, or a mode with 0 finished games while players are queueing);
  - well above that hour's own normal (3× the same hour's 7-day median);
  - **two checks in a row** (30 minutes).
- **One alert per problem:** a PAGE isn't repeated for the same problem while it lasts. It says "still happening" once an hour and
  "recovered" when it ends.
- **The DIGEST:** once a day at 8 am Central. It has:
  - the top new error kinds;
  - modes whose abandon rate moved;
  - players' bug reports;
  - the bot's runs.
- All thresholds go in `settings.ts` (`ALERTS`). A kill switch, `PAUSE_ALERTS`.

### 2. The on-call agent (a scheduled Claude task, not a new server)
- **Woken by:** each PAGE (the alert step can call the scheduled task's fire endpoint, or the agent checks Discord's state), plus
  one morning run after the digest.
- **What it does, in order:**
  1. Read the health view and the errors: what, since when, which devices, which mode.
  2. **Confirm before anything else.** Reproduce it (the app locally, a test, or the live-site bot's failing step). If it can't
     confirm it and the numbers are back to normal, it writes "watching, nothing confirmed" and stops (piece 5).
  3. **If players can't play:** switch that part off (`PAUSE_<NAME>`) and set the banner ("We're fixing X; back soon"). Roll
     back if the last deploy caused it. These steps need Eric's Cloudflare access, so until the agent has a scoped API token for
     variables only, it posts "please set PAUSE_X" to Eric with one tap.
  4. **Fix:** a normal PR through the normal lane and tests, with the error's story added to `docs/history/lessons.md`.
  5. Post to Discord what broke, what it did, and the PR. Then lift the switch once the fix is live.
- It follows CLAUDE.md like any helper: same model, one Opus at a time, effort by the lane.

### 3. The live-site bot ("a bot that plays HunChess for us")
- A GitHub Actions workflow on a schedule (every 2 hours; `workflow_dispatch` to run it by hand). It plays a handful of short real
  journeys against **hunchess.com**:
  - the app loads;
  - a solo game plays to a result;
  - 1 v 1 finds a match (two bot browsers);
  - a boss battle starts and ends;
  - the shop and the locker open.
- **About 5 minutes a run.** That's about 1,800 Actions minutes a month at every 2 hours: inside GitHub Pro's 3,000 included.
- **Before launch the site is behind Zero Trust:** the bot uses a Cloudflare Access **service token** (Eric creates it once). It
  logs in as a test account that's marked so its games never count (ranked, XP, coins, fair play).
- **A failure retries once,** on a new browser. Only a second failure is reported, as a PAGE if it's a core journey and a DIGEST
  otherwise.

### 4. Safer releases
- **Gradual deployments** (Cloudflare Workers versions): a new version takes 10% of traffic for 15 minutes. The alert step compares
  its errors with the old version's (errors carry the version), then promotes it to 100% or rolls it back by itself. Check
  Cloudflare's current support for Durable Objects first; if needed, gradual for the Worker only.
- **Risky changes** (a schema change that rewrites rows, a protocol change old apps can't read) ship at a quiet hour (the lowest of
  the live hub's 7-day curve), with the banner up. Most deploys need no window: a Worker swaps over with no downtime.

### 5. No false alarms (Eric, Nov 9)
Test-suite reds came mostly from test machines (slow runners, shared queues, timing), not from the game. Live alerts avoid that by
design:
- **Real players' rates, never one event.** A minimum count, against the same hour's normal, two checks in a row.
- **Two levels.** Only "players can't play" pages Eric; everything else waits for the morning digest.
- **Retry before reporting** (the bot), and **confirm before escalating** (the agent).
- **Known noise is labelled once,** not alerted again. An error kind marked "known, harmless" (a browser extension, an old app
  version) stays in the digest's counts and never pages.
- **Keep the tests honest:** flaky tests get fixed at their cause (the flaky-test batches), so a red CI run means a real problem.

## Build order (each its own PR; a few hours each)
1. **Alerts:** `alerts.ts` in the cron, the thresholds, the digest, `PAUSE_ALERTS`, tests that feed it fake counts. Full lane? No:
   it reads stored data and adds no new table, only one small `alert_state` row (what was paged, when) → targeted lane, plus the
   Discord secret.
2. **The live-site bot:** the workflow, the test account flag, the journeys (reusing e2e helpers), and its result posted to the
   server (`POST /api/admin/bot-run`, admin token) so the alerts see it.
3. **The on-call agent:** its scheduled task and its prompt (a brief on the director-notes branch), and the morning run.
4. **Gradual deployments:** after launch traffic exists (there's nothing to compare at one player).

## What Eric does (when it's built; about 10 minutes)
- Make a Discord server or a channel, add a webhook, and paste its URL into Cloudflare as the Worker secret `ALERT_WEBHOOK`. The
  director sends the exact steps.
- Make a Cloudflare Access service token for the bot (before launch only).
- Later, optional: a Cloudflare API token limited to the Worker's variables, so the agent can flip a kill switch itself.

## Cost
Discord is free. Actions minutes are inside GitHub Pro. The cron already runs. The on-call agent uses Claude only when something
fires, plus one short morning run.
