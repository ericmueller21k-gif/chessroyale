# Brief: root-cause the Ginger Igloo shop test's "one square short" failure (Opus high)

Worktree `/home/user/cr-gingersteps`, branch `claude/fix-ginger-steps`, from main 3f50ee8c. Set it up with `npm ci`. Ports 8998,
inspector 9498. Include notes/briefs/rules-common.md.

## The failure
Main's push run 42110146243 (3f50ee8c, #505: a change to `e2e/town.spec.ts` only), shard 2 of 5, `[desktop] e2e/shop.spec.ts:582`
"Ginger Igloo (Nov 5) …", failed on both tries in `tapTo` (`shop.spec.ts:630`):
- **First try** (line 648): expected `data-you` "6,5", received "5,5".
- **Retry** (line 704): expected "5,7", received "5,6" (it passed through 6,5 and 5,5, then stopped at 5,6).

A tap walked you, but you stopped one square short of the tapped square. It passed on #504's main run (f5e73337) and on its PR,
so it comes and goes. The spec's comments mention the elf pair's work loop (about 8 to 22 s in), the stairs and the catwalk.

## Do
1. **Reproduce** on desktop, repeatedly and under load: CPU throttling, and the shard's other specs.
2. **Find the real cause.** Why does a tap stop you one short? Candidates to check, not conclusions:
   - an elf standing on, or claiming, the target square (the "waits while you stand in its way" logic going the other way);
   - the path's end being taken as "the free square nearest" because the target is momentarily occupied;
   - a level change on the stairs or catwalk (two walk levels) mapping the tap to the wrong level's square;
   - the tap point (`shopAt("square")`) covered by a figure or a catwalk piece drawn over it.
3. **Fix the cause.** If it's in the app, fix the app (a player would hit it too). If it's only in the test, make the test aim and
   time correctly. Don't just wait longer. Never skip, loosen or quarantine the check.
4. Show it passing repeatedly (e.g. 20 of 20) on desktop and phone, with `e2e/shop.spec.ts` still green.

## Done
- A short report: the cause with its evidence, the fix, the runs, and the changed checks old → new.
- A decision note `docs/decisions/2026-11-05-ginger-steps.md`.
- A PR body at `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/ginger-steps-body.md` (lane: full e2e if
  app code changes, else the shop area).
- Push. Don't open the PR.
