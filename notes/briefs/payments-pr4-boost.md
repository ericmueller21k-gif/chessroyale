# Payments build, PR 4: coin boost and crate bonus (Nov 26). Opus xhigh, FULL lane (wallets). Branch `claude/pay-boost`

Eric, Nov 26: two money jobs may run at once today (this one and PR 5, `claude/pay-storage`). Keep to your own files where you can; if
you must touch code PR 5 touches (the spend path, the ledger kinds), keep it small and say so in the PR body.

Read: CLAUDE.md, `docs/rules/eric.md`, `docs/areas/shop.md`, `accounts.md`, the XP/quests area pages, and the approved design on main:
`docs/decisions/2026-11-17-payments-design.md` section 7 (coin boost and crate bonus), section 6 (the coin math the boost multiplies),
13 row 4, "Calls made here" 3. Eric's answers: `notes/briefs/payments-answers.md` on `claude/director-notes`. PR 2 (play coins, #950)
and PR 3 (the coin strip, `claude/pay-coin-strip`, may still be open: merge main as it lands) are the base.
Build exactly row 4, EXCEPT the art (placeholder art from existing assets; the director orders the art separately):
1. The roll: each daily quest finished rolls once on the server, in the quest's ledger batch: 4% a Coin Boost Crate, 4% a Crate Bonus,
   else nothing (every number in settings). Seeded/auditable the way the quest reward is; never sold.
2. Coin boost 2.5x for 120 minutes of counted play, no expiry; opened when the player chooses (Crates tab, free); counts down only in
   counted games' minutes; play coins and bonus multiplied; the day's 300 and the bonus steps count BASE coins; a second crate adds 120
   minutes, never stacks the multiplier. Server-side, idempotent with the game's coin grant (a game pays once).
3. Crate bonus: next 5 level-ups give double crates (keys stay 1); another adds 5.
4. Shown: the reward toast ("Coin Boost Crate!"), the Crates tab (open the boost; "Crate bonus: 4 level-ups left"), the level-up toast
   ("+2 Winter Crates (Crate bonus)"), and the coin strip's "x2.5 BOOST" badge + minutes left (only if PR 3 is merged; else a TODO).
Tests: unit + server tests for the roll's odds wiring, the countdown by counted minutes only, base coins toward the caps, no stacking,
idempotency on retry, the crate bonus count. One focused e2e check in an existing spec for the Crates tab line.
Lane: FULL. The director runs an independent review and delta reviews after you push. `.pr-body.md`, a decision note, area pages; then
COMMIT and push `.pr-body.md` and an empty `.done`, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`. Wait with one foreground `timeout 590 bash -c '…'`, never Monitor.
