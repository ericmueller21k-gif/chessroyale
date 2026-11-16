# The room's tests are no longer guards; CI keeps the failed try's recording (Nov 14)

- Eric, Nov 14, on the Hidden Boss room's tests: "I don't even care about the room rule testing at all, to be honest… I think that was
  just holding us up." The room's rule stays as built; its tests (`hidden-room.test.ts`, `hidden-boss-room.spec.ts` "his room…" and "a
  5th at his door…") change like any other test, without his OK. The online 🏆 is an admin testing tool, to be deleted later.
- Eric, Nov 14: "sounds good" to keeping a recording of a test's failing first try. CI's e2e runs `--trace retain-on-first-failure`
  (was `on-first-retry`, which recorded the retry, usually the passing one). Cost: about 8% more time per run (measured Oct).
- Also (this PR's CI): `engine-server.test.ts:180` saw a second engine search after the first timed out. The timer and `Date.now()` are
  different clocks, so the code read ~1 ms "left" and sent a useless search. A first group's second try now needs
  `ENGINE_SERVER.retryMinMs` (250 ms) left. Not reproduced locally (0 of 15 before and after); the guard removes the dependence.
- Reverted the same day (main run 43625203937, the first full run with it): five timing-sensitive specs passed only on their retry
  (town.spec:1165, town-chat:1480, hidden-boss-room:111, town-controls:253, town-street:294), against none in the three main runs
  before. Recording every test slows it enough to tip them. Back to `on-first-retry`; that run's first-try traces feed flaky round 6.
