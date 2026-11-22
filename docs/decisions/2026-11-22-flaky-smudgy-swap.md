# Every spec's moves through pickMove (Nov 22, 2026)

Main red on 8012d122: `smudgy.spec.ts:189`'s own picker walked into Qxf2# (his rook hidden on f7 leaves the f-file open behind f2).
Call, per "fix the cause, not add a checker": the six specs Nov 20's `pickMove` didn't reach (smudgy, moo, gardener, tiger, folio,
king-save-altered) now use it, each keeping its knight-first order. The app was right: the test's crowd lost. Smudgy's `yourMove` now
fails at once on a finished battle and names its end. Story: `docs/history/lessons.md`, "The same mate, in a spec the fix left out".
