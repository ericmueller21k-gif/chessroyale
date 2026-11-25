# Payments build, PR 2: play coins in every counted game (Nov 25). Opus xhigh, FULL lane (wallets). Runs alone.

Branch `claude/pay-play-coins` from origin/main. The approved design is on main: `docs/decisions/2026-11-17-payments-design.md`
(merged in #772, Eric-approved): read section 6 "Coins: the math" (the rule, the bonus, the steps, `PLAY_COINS`), section 2 (storage,
"one coin, two ledgers": only what PR 2 needs), section 13 row 2, and "Calls made here" 1-2. Eric's answers: `notes/briefs/payments-answers.md`
on claude/director-notes. PR 1 (#790, prices + 1 crate a level) is merged. Read CLAUDE.md, `docs/areas/shop.md`, `accounts.md`, the XP area
page and `docs/rules/eric.md`.

Build exactly row 2 of the build table:
1. `PLAY_COINS` in settings.ts as the design's block (every number a setting).
2. `gameCoins()` in core (pure: the game's XP minutes, the day's coins so far, the result facts the server already has → play coins,
   bonus, the step it fell in). Same eligibility as XP's minutes (counted game, server-timed, `XP.maxMinutes`, 10 moves, not a leaver, not
   a test game, not a guest, not held by fair play; solo inside XP's solo minute cap, solo pays no bonus). The bonus: win 15 (XP's win
   rules, incl. the friends'-lobby once-a-day rule), ranked draw 5, 50 v 50 team top 3 +10, Squads placements 40/25/15/5; diminishing
   steps per day as the design; 600 a day at most.
3. Its grant on the server beside XP's grant, in the same place and the same transaction/idempotency (a game pays once; a retry or a
   reconnect never pays twice). Store the day's running totals the way XP's day totals are stored (no new table unless the design says
   so; if a D1 migration is truly needed, it's this PR's and the full lane covers it: say so in the PR body).
4. Ranked's own coins (2.4/1.6/0.8 a minute, 20 games a day) and Squads' placement coins are replaced by this one rule (Squads' crates
   stay). Remove the old paths; no game pays both.
5. `coin-report.ts` (packages/sim or scripts): the design's per-day table from the settings (weak/average/strong at 1 h, 3 h, 6 h), one run,
   written to `reports/coin-report.md`, so a settings change shows its effect.
6. Where the result already tells the player coins (ranked/Squads end screens' coin line), it shows the new number (no new UI: the
   coin reward strip is PR 3). FAQ/shop words that state coin earning follow settings.
Tests: unit tests for `gameCoins()` (each rule, the steps, the day cap, the 600 ceiling, solo, guest/test/held/leaver pay 0); server tests
for the grant (pays once, idempotent on retry, day totals roll at the XP day's boundary); the e2e coin lines that change. List every
changed check old → new. No eric.md guard edited (stop and push `.question` if one would be).
Decision note (short), `docs/areas/shop.md` + `accounts.md` updated, `.pr-body.md` (lane FULL; the director adds the full-e2e label and runs
an independent review). Push at each real step, write `.done`, stop. Don't open PRs or wait on CI. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Never put a secret value anywhere.
