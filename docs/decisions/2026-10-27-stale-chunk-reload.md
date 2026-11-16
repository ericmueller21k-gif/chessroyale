# A page open across a deploy loads again when the town square's files are gone

**Date:** Oct 27, 2026. **Who:** the director (a bug fix from the live health report).

## What was wrong
The town square's code and styles are their own chunk, loaded when it opens (`town/TownPage.tsx`). Each deploy replaces
the site's files, so a page opened before a deploy asks for the old chunk's files, which are gone: the town stayed a
blank screen and the error was reported ("Unable to preload CSS for /assets/Town-….css", Oct 26 21:51 UTC).

## The fix
- `app/src/stale.ts`: on Vite's `vite:preloadError` (a chunk's styles or module that won't load), the page loads again,
  so it gets the new version and opens where it was (`/town`). Once: not again within a minute in that tab, so a file
  missing for another reason is still reported (problems.ts) rather than reloaded in a loop; and never without session
  storage to remember that it tried.
- `TownPage.tsx`: no module while the page is loading again, so nothing else breaks meanwhile.
- Tests: `stale.test.ts` (once, the minute, no storage) and an e2e in `town.spec.ts` (the town's styles refused once:
  the page loads again, once, and the town is drawn), phone and computer; it fails on main.

No player-visible text changes.
