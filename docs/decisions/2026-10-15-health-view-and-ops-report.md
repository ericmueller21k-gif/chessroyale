# The health view and `npm run ops:report` (Oct 15, 2026)

Launch readiness, step 2 (ROADMAP.md): one snapshot of the game an AI session can read and act on, as JSON
(`GET /api/admin/health`) and as the first section of `/admin/ops` (docs/areas/ops.md, "Health"). The calls:

- **Squads on the live hub** (the director's pick): each Squads lobby reports itself to the hub as mode "squads"
  (on a change or a minute on, at most every 2 s, as Crowd's lobbies do; forgotten as it closes). It counts in the
  health view and **the overload limit now counts Squads players** (it didn't before); the home page's public line
  (online aside: matches running, in queue, playing now, the live window) leaves Squads out, unchanged.
- **Who may read the JSON:** an admin's session, or a request that came through Cloudflare Access for its application:
  the Worker checks Access's own token (`Cf-Access-Jwt-Assertion`) against the team's public keys (RS256, keys cached
  an hour, asked again for an unknown key id at most once a minute), its audience and its expiry, so the view stays
  closed where Access isn't in front of it (the site at launch). The team domain and the application's AUD tag are
  public (the Access login redirect names both) and sit in `wrangler.jsonc`; no new secret. Pre-launch any request
  that passed Access may read it (only Eric and the service token can); at launch the health path needs its own Access
  application and `ACCESS_AUD` updated (ROADMAP.md, "Only Eric can do").
- **Errors by the clock hour:** rows are per hour, so the view says "this hour" (so far) and "the hour before" rather
  than a rolling hour it can't count exactly; and 24 hours.
- **The engine server's last answer and last failure** weren't kept anywhere: they're two keys in D1's `meta`, written
  at most once a minute (an answer) or every 10 s (a failure) per instance, never in the way of a search's answer
  (a write that fails is ignored).
- **`npm run ops:report`** is a plain Node script (no dependencies): the service token from `CF_ACCESS_CLIENT_ID2` /
  `CF_ACCESS_CLIENT_SECRET2` as headers, never printed; "Needs attention" first, each line saying what's wrong and where
  to look (thresholds: 20 errors an hour or 3 times the hour before, any Durable Object error this hour, a failing
  engine server, 80% of a budget, unread bug reports). Node's fetch only uses `HTTPS_PROXY` with
  `NODE_USE_ENV_PROXY=1`, so the npm script sets it (harmless without a proxy).
- **The API's rate limit keys the way the problems endpoint's does** (the independent security review of the error
  capture, Oct 15, left this one here): the account is a key only for a real session cookie (43 characters, as
  `randomToken` makes them; a made-up cookie each time was a fresh key, and a growing map), and the limits are counted
  in order, stopping at the first that refuses, so a refused request uses up nothing of the account's. The answer's
  wait is the refusing limit's (it was the longest of all of them).
- **Testing:** the targeted lane plus the server specs it touches (the hub's counts, Squads' lobbies, the overload
  limit, the live window, the ops page): typecheck, the unit suite (a new `health.test.ts`), and the e2e specs
  `problems`, `front-door`, `live-window`, `busy`, `squads` and `squads-play`.
