# The saved town is keyed by its art, not the build's commit (Nov 28, 2026)

Eric: "if this is Fable's recommendation, then we just do the whole thing." Phase 0 of the town's structure (`DESIGN.md`, finding 2).

- **Was:** the kept pictures' key began with the commit id, so every deploy painted the town again.
- **Now:** the build bundles the code the pictures come from with all it uses (esbuild, tree-shaken) and hashes it
  (`packages/app/town-art.ts`, `__TOWN_ART__`). Nobody keeps a list; unused settings, comments and types don't count.
- **My call:** when in doubt it repaints (never stale art): over the last 54 deploys it would have changed 20 times, not 54; settings
  and boss rules the characters import are most of the 20. Phase 1 replaces it.
- **Chips:** each place's face drawn once, on its own canvas; a place keeps its chip.
