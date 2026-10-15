# Kill switches, a maintenance banner and one-command rollback (Oct 15, 2026)

For launch, the director asked for three ways to act fast without a code change: a switch to rest any mode, boss or
the shop; a banner on every screen; and a rollback in one command. How it works now:
[`docs/areas/ops.md`](../areas/ops.md), "Kill switches" and "Rolling back"; how Eric flips one: `DEPLOY.md`, "Kill
switches and the maintenance banner". The calls:

- **Worker runtime variables, one per switch** (CLAUDE.md: admin settings go in the Worker's runtime variables):
  `PAUSE_CLASSIC`, `PAUSE_CROWD`, `PAUSE_RAID`, `PAUSE_SQUADS`, `PAUSE_SOLO`, `PAUSE_SHOP`, `PAUSE_FRIENDS` and
  `PAUSE_BOSS_<ID>` (by the boss's roster id, e.g. `PAUSE_BOSS_PIG` for Wrangler); "1" rests that part, deleting it brings it back. One variable each
  rather than a list in one variable: each shows by name in the dashboard, and a typo in one can't switch off another.
  "true", "yes", "on" or a JSON `true` count too (a kill switch shouldn't fail on how it was typed); anything else
  is on. `MAINTENANCE_BANNER` is the banner's message (at most 200 characters).
- **One module reads them, with a 60 s cache** (`packages/server/src/kill-switches.ts`, as the brief asked). How fast
  a change applies: changing a variable in the dashboard deploys a new version of the Worker, and its instances start
  with nothing cached, so it applies within seconds of that deploy (the cache would matter only if the switches moved
  to KV or D1). The cache is per environment object, so tests with different settings never see each other's.
  Like any deploy, it restarts the Durable Objects: players in a match reconnect for a moment and play on.
- **What "resting" means for each part:**
  - **Classic, Crowd, Boss raid:** no PLAY into that mode's queue and no new lobby in it (`/api/play`, `/api/lobby`:
    503 with the line). A lobby already made, or a match already running, goes on. Joining a lobby by its code still
    works: it's already made.
  - **Squads:** no new queue (`/api/squads/play`) or party (`/api/squads/party`). A party already in line waits with
    the line on its sheet, asks again every minute, and goes in once Squads is back. Admins' test lobbies stay open,
    so Eric can check a fix before switching it back on.
  - **Solo (and Boss alone):** played in the browser, so only the app can stop them. It disables both.
  - **The shop:** no buying and no crate opening (`/api/shop/buy`, `/api/locker/open`). Your locker, and wearing
    what you have, stay.
  - **A boss:** never met, at random or picked. The boss menu hides him, the server refuses a raid lobby made for him,
    and every match's boss pick (online and solo) skips him (`rosterWithout` in core). The Crowd's boss final meets
    another boss while his is resting, and its vote card says "Boss battle" / "Top 4 team up against a boss" instead
    of his name. If every boss were resting, the whole roster stands, so a match never fails for it.
  - **Friends:** the friends API answers "off" and the Friends page says so (`friendsOn` in `friends-api.ts`, now
    `!isPaused(env, "friends")`, as agreed with the friends lane). Its words join the others': "Friends are resting
    for a bit. Back soon." (was "Friends are switched off for now. Try again later.").
  - **Solo and Boss alone** also can't be started from a results screen's "again" or the computer's side menu.
- **The way in is disabled with a short line, not hidden,** so a player knows it's coming back: "Squads is resting
  for a bit. Back soon." The line goes where the mode's line already is: under PLAY, on the Party button, in Play with
  friends, and under the buttons for Boss alone. The server's refusal carries the same line (pauses.ts in core), so an
  app that hasn't asked yet still shows the right words. The app asks `GET /api/status` at start, every minute while
  it's on screen, and when it comes back to the screen.
- **The banner sits over the top of the page** (fixed, a slim band, the safe area respected), not in the page's flow:
  every screen is sized to the window, so pushing them down would make them scroll. ✕ hides it on that device until
  the message changes.
- **Rollback: `npm run rollback`** (`scripts/rollback.mjs`). It lists the latest 10 versions with the live one marked,
  and rolls back to the one before (`previous`) or a named one through `wrangler rollback`, with `--dry-run` to look
  first. It asks before rolling back in a terminal; elsewhere it needs `--yes`. It needs `CLOUDFLARE_API_TOKEN`, which
  it never prints. Tested on Oct 15 in list and `--dry-run` mode only: there is no standing staging Worker (the
  load-test script makes it and deletes it each time), and production isn't for trying it. The token can list
  versions and deployments. Whether it may roll back ("Workers Scripts: Edit") couldn't be checked without doing it.
- **Testing:** full lane (it gates every way in). Unit: `packages/server/test/kill-switches.test.ts` (reading, the
  cache, the lines, `/api/status`, each refusal, the shop, a resting boss never chosen, the Crowd final's card).
  e2e: `kill-switches.spec.ts` starts its own server on port 8789 with Squads resting and a banner. Squads' PLAY and
  Party are closed with the line, the server refuses with it, the banner shows on four screens and a match, and ✕
  hides it.
