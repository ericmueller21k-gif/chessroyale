Boss battle result screen: cleaned up

Title: Boss battle result: review on the page, no stage table or best-move board

## What changed
Boss battles only. Crowd and Classic keep their result screens word for word.

Removed on a boss battle's result page:
- The "Stage / Average loss per move" table.
- The line "Lower is better: 0 means you matched the engine's best move."
- The "Best move" board and its caption (e.g. "f4: +0.0").
- The "Worst move" board (judgment call: it sat in the same pair as "Best move"; the review's "What cost you the most" shows the costly moves with their boards).
- The "Your game, move by move" button.
- In the review: "Scores compare your move with everyone who picked that turn. Close calls are re-checked with a deeper search before every cut."

The review now shows by default, under the stat tiles, with no tap:
- Its list of every move opens by default, and the first costly move's board opens (or the first move's, if nothing cost you).
- Its move bars, the board and the text under it are one width (340 px, or 86% of the window on a phone), centered like the top part. Today the bar stretched wide and the board and text sat left.
- Its heading is "Your game, move by move" (the review's title, no longer a button).

Computer (900 px and up with a mouse): two columns. Left: the top part (flag/title, the boss and its line, the Last Stand card, "It counts as a loss.", "Unranked…", the three stat tiles, the buttons). Right: the review. Both top-aligned. The gear sits at the top right of the top part, beside the title. Narrower windows keep the phone's single column.

Player-visible text that stays: everything in the top part, "Scoring took N ms per round on this device.", the unranked line, quick chat, "Most dangerous players this match".

## Changed checks (old → new)
- None changed. No check that guards a rule in docs/rules/eric.md was edited.
- Added to `e2e/resign.spec.ts`, "Boss alone: Cancel keeps playing; Resign ends the game at once…" (after the "It counts as a loss." check): the result page has no "Lower is better", no `.stage-table` or `.best-worst`, no "Your game, move by move" button; the review's move bar, board and review block are the same width and centered.

## Tests run
- `npm run typecheck`: pass.
- `npx playwright test e2e/resign.spec.ts -g "Boss alone: Cancel keeps playing"` (phone and desktop projects): pass, under the e2e lock.
- Stills (temporary spec, not committed): phone 390x844 at the top and scrolled to the review; computer 1280x800 and 1440x900 after a boss battle (quick resign). In `docs/boss-result-layout/`.

## Lane
Targeted: a shared component (`Breakdown`) and the result screen, changed for boss battles only. Decision note: `docs/decisions/2026-11-02-boss-result-layout.md`. The bosses area page has a new short section on the result page.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
