# The account not loading: say why, never "Loading…" for good (Nov 20, 2026)

**Eric (Nov 20, the installed app on his laptop):** "It's totally frozen when I click profile, and it's just sitting loading. I don't
even know if this is like what account this is. The daily quests are grayed out, but I don't know how to sign in. Like, what am I?
Where's our sign in?"

**The cause (from the code):** when `/api/me` or `/api/auth/config` failed, `loadAccount` swallowed it as "no accounts here" (local
dev's path), and your own Profile waited for an account id that never came: "Loading…" for good. Why it failed for Eric: before
launch, hunchess.com sits behind Cloudflare Access. Once its sign-in ran out, every `/api/*` request got a 302 to
`*.cloudflareaccess.com`; a `fetch` following that cross-origin redirect fails exactly like being offline, so nothing knew. The app
itself kept running from an open window (or the service worker's saved copy, given when a page load got no answer at all).

**What changed:**
- `api()` asks with `redirect: "manual"`: our API never redirects a script's request, so a redirect (an `opaqueredirect`) is the gate.
  A 401/403 with `www-authenticate: Cloudflare-Access` counts too (what Access answers a request it takes for a script's). Chosen over
  `res.redirected`/`res.url`, which a followed cross-origin redirect never reaches (the fetch throws first).
- The load records why it failed (`failed`: offline, server, gate), with a 20 s limit per request (`FRONT_DOOR.accountTimeoutMs`).
- Profile and Settings' ACCOUNT say why in plain words with **Try again**; for the gate also **Sign in again**. One notice floats over
  the app while signed out of the gate (Eric's Nov 16 pop-up rule: it sits on top and pushes nothing; ✕ hides it), and goes once a
  request gets through (the minute's `/api/status` poll notices both ways); the account then loads by itself.

**Calls made:**
- **"Sign in again" is `location.reload()`.** The worker's page branch already passes on whatever the network answers, the gate's
  redirect included (a page's request keeps its redirects for the browser to follow), so a reload reaches the gate's login. No
  cache-busting address or worker bypass needed; the worker's comment now says so and `sw-versions.test.ts` holds it.
- **The saved app stays the answer whenever the network gives none (the fetch throws),** not only when `navigator.onLine` is false: a
  laptop on Wi-Fi without internet reports itself online, and would get the browser's error page instead of solo play. A network that
  answers (the gate, an error) is always passed on.
- **The guest's Sign in:** shown on the desktop Profile (KEEP YOUR PROFILE, in view at 1280 x 800) and Settings once the account loads
  as a guest; Eric didn't see it because his account never loaded. No layout change.
