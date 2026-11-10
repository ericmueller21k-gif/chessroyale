# Discord alerts, step 1 of live ops (Eric, Nov 10: "I haven't set up the Discord alerts yet ... we'll need to do that")

The design is `docs/ideas/live-ops.md`, section 1 ("Alerts to Discord") and section 5 ("No false alarms"). Build section 1 only:
the Worker posts to a Discord webhook from the secret `ALERT_WEBHOOK` (Eric adds it in Cloudflare; never in the repo). Two levels:
**PAGE** (players can't play: e.g. the error rate on match/lobby/queue routes far above normal two checks in a row, a Durable Object
failing, D1 down) pings @Eric at once; everything else goes in a **morning digest** (once a day, Central morning). Rates against
normal, two checks in a row, de-duplicated (no repeat page for the same thing within an hour). Reuse the ops page's counters
(`ops.ts`, `health.ts`) and the existing cron. With no `ALERT_WEBHOOK` set, it does nothing (and the ops page says "alerts off").
Unit tests: the thresholds, two-in-a-row, de-dup, digest content, no webhook → no call. Lane: targeted (ops). Effort high.
Update docs/areas/ops.md and the live-ops idea's status line. Decision note docs/decisions/2026-11-10-discord-alerts.md (≤ 5 lines).
Push to claude/discord-alerts at each real step; as your LAST push write .pr-body.md and .done together. Don't open the PR. Read
CLAUDE.md and notes/briefs/rules-common.md first.
