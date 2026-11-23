# The street town never falls back to the old town (Nov 13, 2026)

Eric, on his iPhone as admin: "How is the town broken? ... it's the old version ... That's a major concern." Cause: the street town's
WebGL context lost twice in a minute (or not back in 5 s) reloaded the page at `/town?street=off`, the old Canvas 2D town; iOS drops
WebGL contexts when the app goes to the background. Then: "It should never throw back an old version. It should just fail or something,
or we try to reload", and the old town must never load for a player by any path (old code is an exploit risk). A standing rule now.

- Gone: `?street=off` (no test needed it), the lost-twice rule (a context that comes back is fine) and an admin's no-WebGL-2 old town.
- A loss while the page is hidden waits for it to show, then gets 5 s. Not back, or WebGL failing to start: one reload of the street
  town; failing again within 2 minutes (session storage; none: no reload, so it can't loop): "The town didn't load. Please retry." with
  Retry, reason `retry` (new in `TOWN_GL_FALLBACK`; `lost-twice` kept for the week's counts). No WebGL 2: "Chess Town can't run on this
  device.", reason `no-webgl2`, no reload (it can't help).
- The old Canvas 2D town's code stays for now: the street town is still admin-only, so it's every other player's town.
