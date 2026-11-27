# Delta re-review of PR #990 (claude/hidden-boss-forms @ e4a4ab07), full lane, read-only

The fix round (d30082bf..e4a4ab07, the merge of main left out) fixes all five findings. One new nit; nothing blocks.
Ran: typecheck; app `solo-forms` + `public-profile` (33 tests), server `recluse-online` + `accounts` (86), all pass; the e2e
"Hidden Boss's rows" test on phone and desktop passes locally (every View all row one height at 390, 360, 1280 and 1440).

## The five findings
1. **Fixed** (should-fix 1). `recluseFormsAt` (packages/core/src/settings.ts:2607) is the one rule; lobby.ts:4702 and solo
   (public-profile.ts:151 `soloFormsBeaten`, App.tsx:136) both call it. A leaver in the child's fall (child, result "crowd") gets 1
   (recluse-online's new case, roomFight(4, 0)). It can't over-count: `nextBossForm` (runner.ts:2259) strips `result`, so the man
   starts with none; `phase2Result` (lobby.ts:4795) sets phase 2's own result; with `recluse2`/`simul` the four boards come first (2,
   or 3 won). The man's fall with no phase 2 after it gives 2. A child or man lost or drawn: 0 or 1. noResult: no row, as before.
   The server's clamp gets a number, so `fell` never applies there; its cases are unchanged.
2. **Fixed** (nit 2). The decision note covers a NULL row from an abandoned or forfeited solo fight.
3. **Fixed** (nit 3). `app/test/solo-forms.test.ts` runs soloResult's count; a phase-2 loss is 2.
4. **Fixed** (nit 4). View all: title "Hidden Boss" (bossDef's name, no "unranked"), 20 px faces (`.fd-match .rf-forms`). This also
   reaches PlayerProfile's list, the same component. The e2e checks the titles and the heights. Changed check: the reference row is
   now a solo raid (`online: false`), so its own title stays on one line.
5. **Fixed** (nit 5). A note beside `RECLUSE_FORMS` (settings.ts:2580).

## New
- **nit**: `docs/areas/accounts.md:68-70` still says the rule is core's `recluseFormsBeaten` from "lobby.ts `formsBeaten`, App.tsx
  `soloResult`", lists only `accounts.test.ts` and `recluse-online.test.ts` as tests, and never says a form counts once it fell. Name
  `recluseFormsAt` / `soloFormsBeaten`, "the forms that fell (a leaver in the child's fall: 1)" and `app/test/solo-forms.test.ts`.

## Checked, no problem found
- Every way a fight ends: a win is 3. A resign or loss as the child is 0, as the man 1, on the four boards 2. A leaver in a fall,
  the cutscene or the four boards is 1 or 2. A struck-down player gets the fight's count at its end, as before.
- Other bosses, the Crowd final against him (not a raid) and solo Crowd or Classic all stay NULL.
