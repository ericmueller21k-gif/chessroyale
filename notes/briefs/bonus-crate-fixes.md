# Bonus crate (#923): the review's fixes (Nov 25). Opus high, FULL lane, on the PR branch

PR https://github.com/ericmueller21k-gif/chessroyale/pull/923, branch `claude/bonus-crate` (head 1e268bc5). The independent review found
no blocker (ledger, idempotency, the roll and the pool are correct). Fix these on that branch, adding commits (no rebase, no force-push):

- **M1, a double-tap on OK spends a key.** `packages/app/src/screens/Crates.tsx:1060` (the bonus card's OK) sits over `:1128` (the item
  card's "Open another"): measured, OK (177,469,58x36) overlaps Open another (132,474,148x36) on the phone and on the computer too. A
  double-tap: the first closes the bonus card, the second opens another crate. Fix at the cause: the item card's buttons stay inert until
  the bonus card has fully gone plus about 300 ms (and/or OK not over that row). Test: a second tap right after OK opens nothing.
- **M2, the bonus card can be skipped.** `Crates.tsx:885-891`, `BONUS.afterCardMs` (700 ms): Open another or Done in those 700 ms cancels
  the timer, and the unseen record was already cleared at `:1104`, so a fast opener never sees the BONUS card (the crate is still
  granted). Fix: Done / Open another show a pending bonus first (or the card comes with the item card), and the unseen record clears only
  on the bonus card's OK. Test: tap Done right after the item card forms → the BONUS card shows.
- **N3, the odds text must be exact** (`packages/core/src/bonus-crate.ts:53`, `faq/content.ts:1188`): not "every opening" (the Welcome
  Crate's gives none) and not "any crate" without the exclusions; state each crate's share. E.g. "Opening a series or boss crate: 25%
  chance of a bonus crate, one of N crates chosen evenly (about X% each), with its key if it needs one. The Welcome Crate and crates of
  bosses not yet released aren't in it. Opening a bonus crate never gives another." N and X from `bonusPool()` and the setting.
- **N4:** `?bonus=0` (any non-"1" string) forces a bonus in test environments (`api.ts:654`, `Crates.tsx:530`): "0"/"" mean none.
- **N5:** an empty pool must not throw (`bonus-crate.ts:44`, `pool[-1]!`): no bonus.
- **N7:** `Crates.tsx:251` copy also mentions the bonus crates.
- **N8:** the bonus dialog takes the focus (and returns it to the item card's first button on OK); the item card underneath isn't
  reachable by keyboard while it's up.
- Test gaps to close: two different requests racing on a boss crate's ordinary and bonus rows; an open without a request id (the older
  app) that gives a bonus.

Read CLAUDE.md, `.claude/LESSONS.md`, the decision note. Prove: typecheck; the bonus unit tests (core, server, app) plus the new ones;
`e2e/crate-banner.spec.ts` (phone and computer) with one focused check each for M1 and M2. Update the PR body in `.pr-body.md` (a "Review
fixes" section, changed checks old → new), `.done` with "review fixes", push, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By, no model names).
