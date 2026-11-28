# The baked town's load: the review's fixes (Nov 28, 2026)

The independent review of phase 1b (PR #1043) found no blockers; S1 to S5, the nits and the precache's check are fixed here (S6 and
the `loadSheetWaitMs` caps: phase 1c). Eric's rule holds: a load still moving is never cut off.

- **My calls:** the stall limit (`TOWN_PICTURES.stallMs`, 15 s) counts bytes, not files, and only while the page shows. Home never
  reads the manifest: the build hands it each town's page names (`__TOWN_PAGES__`). The fallback's report (`town-baked-fallback`, its
  reason) is counted among the errors. A page loaded past its worker (a hard reload) fetches none ahead.
- **Director's call:** the prefetch stays; not on `saveData`, `slow-2g`, `2g` or `3g`.
