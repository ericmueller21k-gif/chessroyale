# Don Dough's oven timers: pawn 8, knight and bishop 13, rook 16, queen 21 (Nov 12, 2026)

Eric, Nov 12: "the 4 turns for a pawn is actually way too strong... I meant 4 of our turns... You need more time to capture."
Asked to pick, he chose "Pawn 8, rest 6 more".

- `doughTimers` p 4 → **8**, n and b 7 → **13**, r 10 → **16**, q 15 → **21** (`packages/core/src/settings.ts`). Still one off for
  every move, yours and his, so a pawn's lump gives you 4 of your own moves to squash it.
- The oven timer's art now has frames up to 30:00 (`TIMER_MAX`, made only when drawn), so any later tweak up to 30 needs no art.
- No sim rerun (light lane): with twice the time to squash, fewer lumps rise; `reports/zebra-sim.md` is from the old timers.
