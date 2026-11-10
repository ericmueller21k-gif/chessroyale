# The site loads slowly again (Eric, Nov 10, ~20:50 UTC: "major major issue hunchess just took 30+ seconds to load on my desktop,
# never happened before" ... then "took like 6 seconds on a refresh but still horrible")

Eric's screenshots (director-notes `notes/assets/eric-load-nov10-*.png` if saved; else his words): first a 30 s white page (nothing
painted, the tab's spinner going), then a refresh with DOMContentLoaded 5.09 s, finish 13.6 s on desktop Chrome. His network list: most
assets from the service worker in a few ms; `/api/me?name=Player` 1.43 s; `friends` 815 ms; `quests` 767 ms; `manifest.webmanifest` a
302 to Cloudflare Access and a CORS error.

The director measured the live site (headless, through Access) at 20:55 UTC: document TTFB 0.43 s cold / 0.08 s warm, FCP 0.2-0.7 s,
app ready 2-3 s; `/api/me` 1.1-1.7 s on every load, every time (the slowest request, and home's account wait depends on it);
`/api/status` 0.25-0.5 s. Today's merges that touch the load path or `/api/me`: #599 (static shell), #607 (search on home), #609
(town paint), #610/#611/#618 (fair play, `banCheck`, engine pool), #613-#616, #619 (alerts cron).

## Find and fix
1. **Why `/api/me` takes over a second:** profile the handler (`packages/server/src/api.ts` ~:348, `profile()`): count D1 statements and
   time each locally (wrangler dev with a populated account: XP, quests, locker, friends, ranked, fair play). Cut it to well under 300 ms
   (batch the reads, drop what home doesn't need on first paint, or move it behind a second request). Same look at `quests` and `friends`.
2. **Why DOMContentLoaded was 5 s on Eric's refresh** when the assets came from the service worker: profile the main thread on a
   desktop (4x CPU slowdown to stand in for a busy laptop): script evaluation, the shell, anything synchronous before DCL. Fix what's ours.
3. **The 30 s white page:** check what the app or service worker does on the first load after a deploy (the new SW installing and
   precaching, an old SW serving a missing asset, a navigation preload, Access's redirect on the manifest). If the cause is ours, fix it;
   if it's Cloudflare Access re-authenticating, say so plainly with evidence.
Measure before and after (a table in the PR body). Lane: targeted (shared app modules and the server's `/api/me`); effort high. Decision
note docs/decisions/2026-11-10-load-regression.md (≤ 120 words). Push to claude/load-regress at each real step; as your LAST push
write .pr-body.md and .done together. Don't open the PR. Read CLAUDE.md, .claude/LESSONS.md and notes/briefs/rules-common.md first.
