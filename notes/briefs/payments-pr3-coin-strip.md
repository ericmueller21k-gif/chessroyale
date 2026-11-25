# Payments PR 3: the coin reward strip (Nov 25). Opus high, targeted + frames (end screens). Branch `claude/pay-coin-strip` from origin/main

The approved design: `docs/decisions/2026-11-17-payments-design.md` section 11 "The coin reward" (Eric-approved; its mockup on
`stills/coin-reward-mockup`: README.md, phone 1-4, computer 1, `mock/mock.html`). PR 2 (#950, merged today) pays the coins: the game's
grant answers `XpGrant.coins` (`GET /api/xp`, core `PlayCoins`: play, bonus, the parts, `today`; the result row's `results.coins`). Its
call 14 / review n5: the strip reads the game's STORED row (its first answer), not a later replay's `today`. Read CLAUDE.md,
`.claude/LESSONS.md` (watch any animation frame by frame: `npm run frames:boss`), `docs/rules/eric.md` ("nothing hidden, nothing
shifts"), and TODAY's end-screen rules: `docs/decisions/2026-11-25-end-screens-2.md` (one gap token `--es-gap`, nothing stretched, short
stacks centered as one block, `endGaps` guard in e2e/helpers.ts) and `2026-11-25-result-gap-from-reach.md`.
Build section 11, fitted to today's end screens:
- The strip right under the XP box, the XP box's width, its height reserved from the first paint (nothing moves), part of the stack with the
  ONE gap (the `endGaps` checks must still pass, now counting the strip). On every end screen with an XP box (1 v 1 page, boss results'
  compact one, 50 v 50, Squads where it has an XP box); greyed with why when no coins ("No coins: under 10 moves.", a test game, a guest…).
- It starts when the XP fill ends; coins drop into a small pile (at most 10, 110 ms apart, 420 ms a fall), "+52" rolls like a gas pump
  (transform only), the parts appear as the count reaches them, "PLAY TODAY 186/300" (or "300/300 · FULL"). No boost badge yet (PR 4).
- Sounds: `clawCoin` on each landing (at most every 90 ms), `sell` at the end; the Sound setting applies. One small canvas, the spin
  frames drawn once, the loop stops when done; animations off / reduced motion: the end at once, one clink. A tap skips to the end (as
  the XP sequence does).
- Remove the ranked/Squads coin LINES PR 2 kept (the strip replaces them), so coins show in one place.
Checks: one focused e2e check in an existing end-screen spec (the strip present, its place fixed through the count, the right number from
the grant, greyed with why) on phone 390x844 and laptop 1536x730; `endGaps` still passing with the strip; `@perf` for the animation
(CLAUDE.md: drawing/frame loop changed). Stills: phone mid-count, done, greyed, cap reached; laptop done; desktop 1920x960 done: push to
`stills/pay-coin-strip` (images only there) and look at each yourself against the checklist (one gap, nothing stretched, nothing moves).
Decision note (short), `docs/areas/shop.md` + the end-screen area page, `.pr-body.md` (lane targeted; checks changed old → new). Push at
each real step, write `.done`, stop. Don't open PRs or wait on CI. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). About 1.5 h.
