# An open tab survives a deploy: its own version's files stay until it reloads (Eric, Nov 15)

Effort high (the service worker and loading; a slip here breaks every page). Targeted lane. New branch `claude/stale-tab` from `origin/main`.
Read `CLAUDE.md`, `.claude/LESSONS.md`, `docs/areas/ops.md` and the front door / town pages on loading, `packages/app/sw-template.js`,
`packages/app/src/stale.ts`, `packages/app/src/lazy.tsx`, `packages/app/src/install.ts`, `packages/app/vite.config.ts` (FILES, HASHES,
LAZY_FILES), and `Town.tsx` lines ~320-460 (the room and intro imports).

What happened (Eric, Nov 15, on a computer): "I clicked on a different tab, and then I went back ... challenged Wrangler the Pig ... hit
challenge alone fight. And then it reloaded the town and put me back in the center." The ops errors show it: at 03:20:27 UTC his tab ran
018bd310; #724's deploy (07626574) had gone live at ~03:17. His tap needed `./shops/intro.ts` and `./shops/ShopRoom.tsx` (Town.tsx:452-453),
chunks of 018bd310 that were gone: the reports `TypeError: Cannot read properties of undefined (reading 'loadIntro')` and `(reading
'loadRoom')` (the `vite:preloadError` handler in stale.ts preventDefaults, so the import resolves `undefined` and `m.loadIntro` throws), and
stale.ts reloaded the page: the town again, at its center, his challenge gone.

The cause: the service worker precaches each version's files (everything but pictures), but a new version's worker, on `activate`
(sw-template.js:64-70), deletes every other version's cache and `clients.claim()`s the open tabs. An old tab then has its files neither on
the server nor on the device.

Fix the cause:
1. **An open tab keeps its version's files until it reloads.** Don't delete an older version's cache while a client still runs it (or keep
   the last N versions, N a setting, deleting older ones once no client uses them), and answer an old page's requests for its own files from
   its own version's cache. Decide how a request is matched to its version (Vite's hashed names under /assets/ make most of it simple).
   Mind storage: an old version's cache goes once no tab runs it. Pages with no service worker yet (a first visit) keep today's stale.ts
   reload as the fallback.
2. **The fallback reload keeps your place.** When stale.ts must still reload, the page comes back where it was: in the town at your square
   (and facing), and with the challenge or room the tap was opening, opened. (sessionStorage, read once on load.) No reload loops (stale.ts's
   once-a-minute rule stays).
3. **No crash on a failed chunk.** The room/intro imports (and any other `import(...).then((m) => m.x)` that can get `undefined` when
   stale.ts takes over) don't throw: they stop quietly while the page reloads. Find them all with a grep, fix them in one helper if that's
   simplest.
4. Also look at one more ops error (different cause, same area of "things that break on a real device"): `TypeError: undefined is not an
   object (evaluating '[d,f,p,m]')`, a render error on Safari, version 7453120ed891 (the deploy of Nov 14 22:23). Find where (a destructure
   of four from something undefined, likely a rect/tuple), fix the cause if it's clear; if not, say what you found.
Tests: unit for the worker's cache choice (which caches are kept/deleted with clients on old/new versions; an old page's file answered from
its cache) and for stale.ts's saved place; an e2e in an existing spec if one already deploys a new build mid-page (`town.spec` "a deploy
landed" / problems.spec: read them): an old tab opens a room/challenge after a deploy without reloading. Typecheck (includes e2e now if
#725 merged); app unit tests; the touched specs. Push at each real step; `.pr-body.md` (cause, fix, player-visible, checks old -> new);
`.done`. No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only). About 1.5 hours.
