# Payments build, PR 1: the new coin prices and 1 crate a level (Eric-approved, Nov 18). Light lane. Opus, high

Branch `claude/pay-prices` from main. About 45 min. Read CLAUDE.md, `docs/areas/shop.md`, and the approved design: `git show
origin/claude/payments-design:docs/decisions/2026-11-17-payments-design.md` (section 4, "Prices and the flow"; PR #772, approved by Eric,
merging soon). Eric's answers: `notes/briefs/payments-answers.md` on claude/director-notes.

Only this PR's part (the design's build table, PR 1): numbers in settings.ts and the text that states them. No purchases, no Stripe, no
play coins yet (that's PR 2).
1. `SHOP.prices` (full prices; the beta discount stays as is until real money turns on): key 250 → 100; HunChess/Gift/Beta crates
   100/150/150 → 50/75/75; boss crate (shop) 400 → 200; bundle 900 → 400; God King effects and chat packs to the design's numbers
   (300-400; 100-150: take the exact per-item values from the design, or scale proportionally and say how).
2. `XP.levelCrates` 2 → 1 (Eric: "One crate per level seems fine").
3. Every place that states these numbers in words (FAQ, shop copy, any "2 crates" text) follows settings.
4. Checks: the shop's unit and e2e price checks follow settings (change any hard-coded expectation and list it old → new); the XP
   level-up reward tests for 1 crate. No guard of `docs/rules/eric.md` touched (stop and push `.question` if one would be).
Short decision note (about 5 lines). Push `.pr-body.md` (under 30 lines) and `.done`, end. No PRs, no CI waits.
