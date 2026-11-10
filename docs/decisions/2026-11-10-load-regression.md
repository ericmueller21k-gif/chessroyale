# The site loads slowly again (Nov 10, 2026)

Eric: "hunchess just took 30+ seconds to load on my desktop", then 6 s on a refresh. Found: `/api/me` made 28 D1 reads one after
another (about 40 ms each); now at once: 4 round trips (quests 5 → 3, friends 9 → 3; `me-round-trips.test.ts`). The app asks for
`/api/me` beside `/api/auth/config`; the manifest goes with credentials (Access redirected it). Measured, not ours: the main thread
(DOMContentLoaded 0.5 s at 4x CPU) and the precache (Chrome starts it after the page settles). The 30 s blank: page loads never
reach the Worker, so most likely Access signing in again. Follow-up (full lane): `ensureSchema`'s ~96 statements run one at a time
after a schema change, per request in flight.
