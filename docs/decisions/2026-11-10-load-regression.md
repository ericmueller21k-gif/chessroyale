# The site loads slowly again (Nov 10, 2026)

Eric: "30+ seconds to load"; "the first time was slow because it was downloading". `/api/me` made 28 D1 reads in a row: now 4 round
trips, asked beside `/api/auth/config`. The precache fetched 127 files at once after a first load (PLAY's files at 10 Mbps: 4.4 s →
2.7 s one at a time) and 3.8 MB again per deploy: now it copies unchanged files (hashes in `sw.js`). The manifest goes with
credentials. A cold first paint waits only for the page and styles: the 30 s blank is most likely Access. Follow-up (full lane):
`ensureSchema`'s ~96 statements run one by one after a schema change, per request in flight.
