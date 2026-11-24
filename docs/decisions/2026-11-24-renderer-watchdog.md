# The renderer watchdog: a hung page names its code (Nov 24, 2026)

- Twice a 5 s `expect` in `openSoloBoss` (the "Boss Battle" heading) ran for minutes to the test's timeout, with no trace: moo.spec
  on Nov 20, boss-bar.spec on Nov 24 (run 45383358676). Playwright 1.56's `expect` makes its first check with no timeout
  (`frames.js`, `noAbort`), so a page whose main thread never answers holds it there. Shown locally: a 45 s busy loop held a 5 s
  expect for 45 s.
- The cause wasn't found. No hang in 16 runs of both tests' loops at 6× CPU slowdown, boss-bar.spec ×3 (desktop) or moo.spec ×2
  (phone), all with the watchdog on (headless shell 1243 here; CI's image has 1194). Nothing on the screen's path spins: every loop
  there is bounded, a dropped match chunk recovers, and the kept battle's re-offer (Nov 22) came after the first hang.
- So, as the director decided on Nov 20: `watchRenderer` (e2e/helpers.ts) on every test's page. Its CDP session and Debugger domain open with
  the page (once a page hangs, a new session gets no answer). A ping unanswered for 30 s → `Debugger.pause` → the stack and the code
  at each place, printed as `[renderer-hang]` and attached. Cost: about 25 ms a test (inside the run-to-run noise); `@perf` skipped.
