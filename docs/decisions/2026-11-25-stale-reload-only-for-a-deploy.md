# A file that won't load reloads the page only for a deploy (Nov 25, 2026)

The director's brief (flake-xp-start): main's run 45559755980 had `xp.spec:223` (the "No XP" loop) wait 4 minutes for Boss Battle's START
on home. **Cause:** a file the Boss Battle screen fetches in the background (the opening library, `solo.ts loadOpenings`) got a dropped
connection from the e2e server (wrangler's dev proxy, which retries once), Vite fired `vite:preloadError`, and `stale.ts` loaded the
page again, as for a deploy: the reload lands on home (the screen isn't in the address). Staged (that file refused once): main gives
CI's error 2 of 2. It's the same cause as Nov 23's lost Resume tap (2026-11-23-resume-race.md), which was patched by carrying the tap
across the reload; and a player on a patchy phone connection was thrown home the same way.
**Changed:** `stale.ts` always takes Vite's event, then asks the server's `/version.json`: another build than the page's, the page
loads again (as before: once a minute, back where it was); the same build or no answer within `APP_CACHE.staleCheckMs` (5 s), the
load just fails and its caller tries again (the browser fetches a failed module again). `loadOpenings` tries a second time at once,
so a START that joined the failing background load still plays; `startSolo` and `startTowerFloor` say "Couldn't load the game." for
a load that rejects, never a screen stuck loading (Nov 23's follow-up). `lazy-game.ts` marks the match chunk only once it's in.
Call: no new player-visible text. Tests that stage a deploy now stage one (`aDeployLanded`: another build in `/version.json`).
