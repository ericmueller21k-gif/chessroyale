# A second failed file on the same build reloads the page, keeping Boss Battle (Nov 25, 2026)

The director's brief (stale-retry, #942): CI's `xp.spec` "a file dropped with no deploy" failed both tries with "Couldn't load the game."
**Cause, checked:** Chromium 141 (CI's Playwright 1.56.1, build 1194) keeps a failed dynamic `import()` and fails a re-import of the same
URL without fetching it (3 imports, 2 server hits; Chromium 158 fetches each time). Safari does the same. So `loadOpenings`' try again,
and any `lazyGroup` "next time", could never load there until the page loaded again.
**Changed:** `stale.ts` `chunkFailed`: a failure while `/version.json` names this same build stands once; the next one reloads the page
(once a minute, as for a deploy). No answer from the server (offline) never reloads: the caller says "Check your connection". Boss
Battle is a place (`App.tsx`: `setPlace` / `takePlace("raid")`), so the reload lands back on it, never home. `takePlace` now takes the
screen's key, and `dropPlace` clears only a screen's own place.
**Call:** a reload, not a cache-busting retry (`?retry=1` on the failed URL). The retry needs the URL from the error's text, which Safari
leaves out, and it can't fix a failed shared chunk the module imports. A reload clears every kept failure in every browser.
