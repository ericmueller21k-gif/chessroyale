# Payments PR 3 (coin strip): FINISH (Nov 25). Opus high, targeted. Branch `claude/pay-coin-strip` @ 98c2a8cc (paused for Eric's ask)

Brief: `notes/briefs/payments-pr3-coin-strip.md`. The previous helper built it (CoinStrip.tsx under the XP bar in EndRewards; core
`coinStripView`/`splitBonus`/`COIN_NONE_LINES`; `END_SCREEN.coins`; ranked's es-coins line removed; Squads' line crates-only; xp.spec
frame-by-frame test at 390x844 + 1536x730; ?mate greyed; 320 px; perf p95 16.8 ms; stills on `stills/pay-coin-strip`; decision note with 7
calls). Left, do exactly these:
1. **The boss result on a laptop (1536x730):** the stack was nearly full (bottom 691 of 730); the strip's 92 px pushes Home ~50 px below
   the window. Eric's rules: nothing hidden, the end page doesn't need scrolling to reach Play again / Home. Fix it (least code): e.g. the
   compact strip on boss results (design section 11 says boss results get a COMPACT strip under the compact XP), and/or the quests'
   reserved second row only while it can fill, and/or the boss row's room on short windows. Measure at 1536x730, 1280x600, 1366x650 and
   1920x960: Play again and Home whole in the window, `endGaps` passing. Say what you chose.
2. Check in pictures the 1 v 1 end page, Squads and 50 v 50 results with the strip (phone 390x844, laptop 1536x730, desktop 1920x960) and
   run `ranked-1v1.spec` (real screens + endGaps) and `resign.spec` locally. Add the stills to `stills/pay-coin-strip`; look at each.
3. `.pr-body.md` (lane targeted; checks changed old → new as the previous helper listed: perf end-screen split into fill + strip; xp.spec
   new test + ?mate and 320 additions; squads-reward-line.test rewritten; plus anything you change), then `.done`. Merge origin/main first.
Push at each real step. Don't open PRs or wait on CI. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). About an hour.
