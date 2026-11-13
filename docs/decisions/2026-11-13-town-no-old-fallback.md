# The street town never falls back to the old town (Nov 13, 2026)

Eric, on his iPhone as admin: "How is the town broken? ... it's the old version ... That's a major concern." Cause: the street town's
WebGL context lost twice in a minute (or not back in 5 s) reloaded the page at `/town?street=off`, the old Canvas 2D town; iOS drops
WebGL contexts when the app goes to the background.

- Gone: `?street=off` (no test needed it), the lost-twice rule (a context that comes back is fine) and an admin's no-WebGL-2 old town.
- A loss while the page is hidden waits for it to show, then gets 5 s. Not back, or WebGL failing to start: one reload of the street
  town; failing again within 2 minutes (session storage; none: no reload, so it can't loop): "The town couldn't load on this device."
  with Reload. Reason `message` added to `TOWN_GL_FALLBACK` (`lost-twice` kept for the week's counts).
- No WebGL 2 at all reloads once too (rare, admin-only; the same rule for every start failure is less code).
- The old Canvas 2D town stays: it's still every non-admin's town (the street town is admin-only), so nothing to delete.
