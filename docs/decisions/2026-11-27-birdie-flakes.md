# Birdie's two flakes, fixed in the tests (Nov 27, 2026)

The brief: fix `birdie.spec.ts` "Birdie's fall" (desktop) and `birdie-home.spec.ts` "his challenge" (phone) at their causes; no bound loosened.
- The fall: reveal − drop read 608 ms (bound 600; the design is 200). The test copied its whole per-frame recording out of the page on
  every poll, stalling the page longer as the recording grew (120–290 ms every ~650 ms locally). `recorded()` now copies only the new
  frames: worst frame gap 34–51 ms, reveal − drop 220–229 ms over 5 desktop runs.
- The challenge: the wipe can be covered for only 670 ms; a locator's wait looks once a second by then. A MutationObserver now notes the
  moment as it's set. `chandy-home.spec.ts` had the same wait: fixed the same way.
