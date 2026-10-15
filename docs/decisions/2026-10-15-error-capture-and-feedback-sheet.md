# Error capture and the feedback sheet (Oct 15, 2026)

The director's brief for launch: nothing on a player's device reported an error, the server barely logged its own,
and the only admin page was fair play's. Built: every device reports its errors, the server records its own, players
report a bug (with a short id to share), send feedback or suggest an idea, and admins read it all on `/admin/ops`
(docs/areas/ops.md, "Errors and player reports"). The calls:

- **One endpoint, one table per thing.** `POST /api/problems` takes `{kind: "errors"}`, or a report: `{kind: "bug" |
  "feedback" | "idea"}` (the name `/api/report` was taken by player reports for fair play). Errors go in `ops_errors`,
  one row per fingerprint per hour, upserted; player reports in `ops_reports`. Hourly rows give the page true "last 24
  hours" and "7 days" counts (and next PR's "last hour") with one statement per kind per write.
- **A count is page loads, not throws.** A device sends each kind of error once per page load, so a loop throwing a
  thousand times a second counts once per player; that's the better measure of how many players a bug hits. The
  server's own errors count each time (they're already rare and bounded).
- **Bounded writes, per instance.** Counted in memory by fingerprint, written at once the first time and then at most
  every 20 s, at most 5 rows a write (the most frequent; the rest wait for the next write, set for a window later), at
  most 100 kinds held (more dropped and logged as a number). Under 30 s because the wait rides the request's
  `waitUntil` (as presence's batches do); a wait that a request's end cuts short doesn't stop the next one. Worst case a
  storm costs 15 rows a minute per instance, far inside D1's included writes. Reports are one row each, written at
  once for the id, capped at 20 a minute per instance on top of the per-address and per-account limits.
- **Fair counts** (the independent security review, Oct 15): an error counts once per request and once per address per
  write window (address and fingerprint pairs in memory, cleared at each write, never stored), so one device sending
  the same error over and over can't push other errors out of a write's 5 rows. A count is still about how many
  players a bug hits, as the device's once-per-page-load already made it.
- **The database's own caps** (my review, approved; made atomic by the independent review): every other cap is per
  instance, so a flood of made-up errors or reports from many addresses could grow D1 without bound. So: at most 100
  new kinds of error an hour (a kind already stored keeps counting) and 2000 reports in any 24 hours, each checked in
  the insert itself (`INSERT … SELECT … WHERE` an indexed count is under the cap; `RETURNING` says whether it wrote),
  so instances writing at once can't pass it: D1 runs one statement at a time. At a cap, one `{ops: "cap"}` log line
  (for the health view), and a report gets the usual "Too many reports right now. Try again in a minute."
- **Small rows, and the worst case** (the independent review asked for both): an error's row keeps its message and its
  latest occurrence's stack (1000 characters), place, last 10 breadcrumbs (60 characters each), device, version and
  account, no longer the message twice or all 20 breadcrumbs; a bug its note (500), place, 20 breadcrumbs, last 3
  errors (200 characters each, was 5 of 300), device, version and account. Measured at their longest: an error's row
  6.1 KB and a report's 7.3 KB with every field full of 3-byte characters, 2.7 KB and 3.3 KB in plain text. With
  every cap hit every hour for 30 days (72,000 error rows, 60,000 reports): about 440 MB of each, under 0.9 GB in all
  (0.4 GB in plain text), inside the 5 GB of D1 storage the Workers Paid plan includes, so no cost; in real use, a few
  megabytes.
- **The email scrubber is linear and bounded:** it ran before each field was cut to size, and a 20 KB field without
  separators took 0.8 s of CPU (measured). Now control characters are dropped first (so none can split an address past
  the scrub: the independent review's catch), the field is cut to its size with room for an address across the cut,
  and the pattern only tries a match where a run of address characters starts, with no nested quantifier: a few
  milliseconds at any length (a unit test holds it under 20 ms).
- **Only the app's own requests** (the independent review): the endpoint takes JSON only (415 otherwise: an HTML
  form on another site can't send it) and refuses a request whose browser says another site's page sent it (403 for
  `sec-fetch-site` other than `same-origin`; a request without the header, from a script, is judged by the limits
  alone). The app sends JSON both ways: fetch, and sendBeacon with a JSON blob (Chromium sends it as
  `application/json`, same-origin, measured), falling back to a keepalive fetch where a browser refuses one.
- **The cheap checks first** (the independent review): the rate limits run on the body's `kind` before any other
  field is read or scrubbed. The account's limit counts only a real session cookie (43 characters, as `randomToken`
  makes them: a made-up cookie each time would be a fresh key) and only once the address is let through, so a refused
  request uses up nothing. The API-wide limiter in `index.ts` keys the same way in the health PR, not here.
- **The cron's jobs fail apart** (the independent review): deleting old rows failing (a D1 error) is logged and counted
  as a server error, and fair play's deep re-check still runs.
- **Fingerprints** are source, kind, the message with numbers, long hex ids, hosts, queries and build hashes taken out,
  and the top file without its hash, so a bug keeps its row across deploys and the page shows which versions it came
  from. FNV-1a 32 bits: with a few hundred kinds, a collision is about a one-in-a-million chance.
- **The account id only when signed in, and only its own.** The app sends it only for a signed-in player; the server
  keeps it only if it's the session's own (the presence cache, so rarely a D1 read). Guests send none.
- **No IP addresses, no emails, no chat.** The rate limits key on the address in memory only; emails are scrubbed from
  every stored text (a report's note included: "[email]"); breadcrumbs are screens, moments and moves sent, never
  anything typed. Kept 30 days, deleted by the existing 15-minute cron. The privacy page says so.
- **The version is the commit.** `vite.config.ts` puts the commit's first 12 characters in the app
  (`WORKERS_CI_COMMIT_SHA` in Workers Builds, else git) and writes `dist/version.json` (not precached); the Worker reads
  that file through the assets binding for its own errors. The one cost: the bundle now changes with every commit, so
  every deploy updates the service worker's cache (mostly 304s); most deploys changed the bundle anyway.
- **The error boundary throws the error on once** after showing "Something went wrong" with Reload, so the console and
  every e2e spec's page-error check still see a render error (the boundary would otherwise hide it from them). The
  page's listener skips an error already captured, so it's reported once.
- **The sound worker's error is handled in the worker too** (`preventDefault`, like #216's for the engines'): it was
  already handled (sounds made in idle moments instead) but also reached the page, which would have counted it twice.
- **Durable Objects' entry points are wrapped where the Worker exports them** (`guardEntries` in `index.ts`: a list of
  each class's fetch, WebSocket handlers, alarm and the methods the Worker calls; errors thrown on as before). In each
  object's own module the wrap made an import cycle (live hub, problems, API, live hub) that the unit tests' module
  loader can't resolve. The matchmaker's batch errors, caught and logged before, now go to the store too.
- **One feedback sheet, three kinds** (Eric's addition, Oct 15): "We'd love your feedback", then 🐞 Report a bug (the
  diagnostics, as built first), 💬 Feedback and 💡 Suggest an idea (a note alone: no diagnostics, no account, no
  version kept, so a note can't be tied to a device or player). Feedback and ideas need a note (nothing else is sent);
  a bug's is optional. Every kind gets the same short id and lives in the same table with its kind; only a bug shows
  "share this id" (the others, a thank-you), since only a bug is worth looking up by id. The match menu opens it on
  Report a bug, Settings on Feedback; no link on the home screen (Settings is one tap away, and the front door stays
  uncluttered). The same rate limits, all three kinds together. `/admin/ops` lists reports of one kind
  (`?kind=idea`: the ideas as a list).
- **The sheet is one over any screen**, beside the ban notice and drawn like it, opened from the match menu or
  Settings. In the match menu itself the form would be redrawn with every phase (a match draws each phase's screen
  afresh), dropping a phone's keyboard mid-sentence. On a phone it's a row under Sound and Resign (the sheet is two
  rows now: measured at 320, 360 and 390 px, it stays below the board and the move's clock, over the lower part of the
  dock only while open); on a computer a 🐞 button before the sound button. Where an admin's testing items
  share that title line (boss battles, Eric only), they already fill it at 504 px (900 to 1280 px wide), and one more
  button pushed them over the title: there the report button gives way (a CSS rule; measured the same as before), and
  admins report from Settings or a phone.
- **The ops page searches errors by message** (`?q=`), and among equal counts shows the newest first: what a session
  triaging a player's report needs, and what keeps a fresh error findable in the e2e's long-lived local database.
- **e2e admins:** no sign-in is set up in tests, so the e2e Worker's `ADMIN_EMAILS` has one email per project and a test
  gives its account that email with `wrangler d1 execute --local` (per project, so the two projects never take each
  other's).
- **Testing:** the full lane (a new public endpoint, stored data, security): typecheck, the unit suite (a new
  `problems.test.ts`: each of the reviews' fixes has its own test), the whole e2e suite on GitHub Actions, and a new
  `problems.spec.ts`.
