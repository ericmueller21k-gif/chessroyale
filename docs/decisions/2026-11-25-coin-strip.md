# The coin strip on every end screen (Nov 25, 2026): the payments build's PR 3

Eric approved the design's section 11 ([2026-11-17-payments-design.md](2026-11-17-payments-design.md); mockup on `stills/coin-reward-mockup`).
Built as `components/CoinStrip.tsx`, inside `EndRewards` right under the XP bar, so every end screen with an XP box has it (boss
results, the 50 v 50, Squads' card and results, ranked 1 v 1). It reads the grant the XP box shows (`XpGrant.coins`: the result row's
first answer). Timings: `END_SCREEN.coins`; the view: core `coinStripView`. Stills: `stills/pay-coin-strip`.

Calls made:
1. **"Play +27", not "15 min +27"** (the mockup's): Eric's Nov 9 rule, never the minutes on screen (they'd show how to stall).
2. **A bonus the day's steps cut shows what it paid**, split over its parts by their shares (core `splitBonus`). No step badge for now;
   PR 4's boost badge can carry one if wanted.
3. **The XP box's height (80 px, 76 design px in the 1 v 1's column), not the mockup's 78**: the XP box is 80 now.
4. **Greyed: one centered line, no pile** ("No coins: test game."); waiting: "Counting your coins…" the same way.
5. **Reduced motion only** turns it off (as the XP sequence): the game's "Animations" setting is the 50 v 50's ghost pieces, not this.
6. **Ranked's coin line and Squads' "+65 coins" are gone**; Squads keeps its crates and the daily cap's words. The bot, town and aborted
   1 v 1 card (no XP box) keeps its own coin words.
7. **Known gap for the director:** a computer's boss result at 1536 × 730 was already near full (its stack ended at 691 px); with the
   strip, Home sat about 50 px under the window's foot. Fixed in the same PR: [2026-11-25-coin-strip-fit.md](2026-11-25-coin-strip-fit.md)
   (the column scales with the window's height; the 1 v 1 column's strip is the compact one).
