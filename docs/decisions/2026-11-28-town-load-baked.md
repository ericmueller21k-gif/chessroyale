# The town loads the build's baked pictures (Nov 28, 2026)

Eric: "if this is Fable's recommendation, then we just do the whole thing." Phase 1b of the town's structure (`DESIGN.md` §2).

- **Now:** the loading screen fetches the manifest (named by its contents: `__TOWN_PICTURES__`) and its town's files, decodes them off
  the main thread and uploads each whole (`town/baked.ts`). Frame counts and tops come from the manifest. The service worker keeps the
  files across deploys; home fetches them when idle.
- **My calls:** all or nothing (a file missing: the device paints that visit, keeps nothing); the dev server bakes when the town first
  asks, as every `frames:*` script starts one; the sidekicks' sheets are still cut on the device (phase 1c).
- **Measured** (slowed phone; computer): a first visit 11 s → 3.4 to 4.4 s; 4.8 s → 1.1 to 1.4 s. The same picture and GPU hashes.
