# The room's tests are no longer guards; CI keeps the failed try's recording (Nov 14)

- Eric, Nov 14, on the Hidden Boss room's tests: "I don't even care about the room rule testing at all, to be honest… I think that was
  just holding us up." The room's rule stays as built; its tests (`hidden-room.test.ts`, `hidden-boss-room.spec.ts` "his room…" and "a
  5th at his door…") change like any other test, without his OK. The online 🏆 is an admin testing tool, to be deleted later.
- Eric, Nov 14: "sounds good" to keeping a recording of a test's failing first try. CI's e2e runs `--trace retain-on-first-failure`
  (was `on-first-retry`, which recorded the retry, usually the passing one). Cost: about 8% more time per run (measured Oct).
