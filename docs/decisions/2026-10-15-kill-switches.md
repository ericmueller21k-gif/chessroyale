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
  Like any deploy, players in a match reconnect for a moment and play on.
- **What "resting" means for each part:**
  - **Classic, Crowd, Boss raid:** no PLAY into that mode's queue and no new lobby in it (`/api/play`, `/api/lobby`:
    503 with the line). A lobby already made, or a match already running, goes on. Joining a lobby by its code still
    works: it's already made.
  - **Squads:** no new queue (`/api/squads/play`) or party (`/api/squads/party`). PLAY is disabled with the line;
    the Party button and Play with friends open the party sheet, where Create says the line and is disabled, and
    joining a party by its code still works, as the server allows it. A party already in line waits with the line on
    its sheet, asks again every minute, and goes in once Squads is back. Admins' test lobbies stay open, so Eric can
    check a fix before switching it back on.
  - **Solo (and Boss alone):** played in the browser, so only the app can stop them. It disables both.
  - **The shop:** no buying and no crate opening (`/api/shop/buy`, `/api/locker/open`). Your locker, and wearing
    what you have, stay.
  - **A boss:** never met, at random or picked. The boss menu hides him, the server refuses a raid lobby made for him,
    and every match's boss pick (online and solo) skips him (`rosterWithout` in core). Online, the lobby's object
    passes the list resting now into every match it runs (`lobby-do.ts`), so a lobby made before he was rested (one
    joined by code, a raid picked for him, the queue's filling lobby) doesn't meet him either. The Crowd's boss final meets
    another boss while his is resting, and its vote card says "Boss final" / "Boss final: top 4 team up against a
    boss" instead of his name (the card's own fallback). A resting boss's line says him as a sentence does
    (`bossInText`): "The Hidden Boss is resting for a bit. Back soon." If every boss were resting, the whole roster stands, so a match never fails for it.
  - **Friends:** the friends API answers "off" and the Friends page says so (`friendsOn` in `friends-api.ts`, now
    `!isPaused(env, "friends")`, as agreed with the friends lane). Its words join the others': "Friends are resting
    for a bit. Back soon." (was "Friends are switched off for now. Try again later.").
  - **Solo and Boss alone** also can't be started from a results screen's "again" or the computer's side menu.
- **A refusal is an answer, not an error:** the 503 with the line is returned, never thrown, so the Worker's error
  capture (`problems.ts`, which wraps every request) never counts it. `GET /api/status` is an ordinary route under the
  same capture.
- **The way in is disabled with a short line, not hidden,** so a player knows it's coming back: "Squads is resting
  for a bit. Back soon." The line goes where the mode's line already is: under PLAY, on the Party button, in Play with
  friends, and under the buttons for Boss alone. The server's refusal carries the same line (pauses.ts in core), so an
  app that hasn't asked yet still shows the right words. The app asks `GET /api/status` at start, every minute while
  it's on screen, and when it comes back to the screen.
- **The banner never covers the page** (review, Oct 15: at first it lay over the top bar, its Back and match menu,
  until dismissed). It's a slim band fixed at the top (the safe area respected), and its height goes to `--banner-h`:
  the page starts under it (body's padding) and every height taken from the window is that much less (`--app-h`, which
  replaced `100dvh` throughout styles.css), so nothing is covered and nothing scrolls because of it. Sheets and menus
  opened over the page (z-index 50 and up) cover the banner, not the other way round. ✕ hides it on that device until
  the message changes.
- **Rollback: `npm run rollback`** (`scripts/rollback.ts`). It lists the latest versions (live now, was live, code
  upload or settings change) and rolls back through `wrangler rollback`, with `--dry-run` to see the choice and why
  first. It needs `CLOUDFLARE_API_TOKEN`, which it never prints. From the review (Oct 15):
  - **"previous" is the version live just before the live code went out** (`rollback-pick.ts`), not the one
    numbered before it. Saving a variable makes a new version of the same code, so after bad code (#20) and a pause
    set to contain it (#21), the version before is #20, the bad code without the pause. The script steps back over
    settings changes to the live code's upload and takes the deployment before that. A settings change it lands on,
    or settings since that it undoes, are said in plain words.
  - **Flags go after `--`:** npm keeps `--dry-run`, `--env` and the rest for itself when they come before it (so
    `npm run rollback previous --dry-run` would have rolled back for real, and `--env staging` would have hit
    production). The script stops when npm took one, or when it gets more than one version.
  - **Only in a terminal that isn't CI:** `wrangler rollback` asks before it deploys and about any secret changed
    since that version. Outside a terminal, or with `CI` (or another variable its ci-info reads) set even in one, it
    answers its own questions yes (a rotated key could go back to its old value), so the script refuses there
    (`whyNotHere`), and in a plain terminal it hands the questions to you.
  - **Tested on production in list and `--dry-run` mode only** (Oct 16, the script as it is now): there is no
    standing staging Worker (the load-test script makes it and deletes it each time), and production isn't for trying
    a rollback. Every Workers Builds deploy in the latest 10 versions shows `workers/triggered_by: "upload"` ("code
    upload"), and the dry-run picked the version live before the live one (#239 under #240), as it should. No
    dashboard variable save is among them yet, so the trigger such a save records hasn't been seen; the script counts
    anything other than "upload" as a settings change. The token can list versions and deployments. Whether it may
    roll back ("Workers Scripts: Edit") couldn't be checked without doing it.
- **Testing:** full lane (it gates every way in). Unit: `packages/server/test/kill-switches.test.ts` (reading, the
  cache, the lines, `/api/status`, each refusal, the shop, a resting boss never chosen, even in a lobby made before,
  the Crowd final's card) and `rollback.test.ts` (which version "previous" is, in each case above).
  e2e: `kill-switches.spec.ts` starts its own server on port 8789 with Squads resting and a banner. Squads' PLAY and
  Party are closed with the line, the server refuses with it, the banner shows on four screens and a match, and ✕
  hides it.
