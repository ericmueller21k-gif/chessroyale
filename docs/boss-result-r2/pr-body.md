Boss result: one stepped review board, the title clear of the boss, no gear on a computer, solo text

Round 2 of the boss battle's result page (Eric's screenshot after resigning to Timber: `docs/boss-result-r2/eric-desktop-before.png`:
the boss's picture covered "You resigned"). Boss result page only; Crowd's and Classic's breakdown overlay is unchanged.

## What changed

1. **The title is never behind the boss.** The boss's box is now as tall as its drawing (it was 124 px, and a taller drawing stood
   over the title). Order top to bottom: the flag, "You resigned", the boss, "Timber won." (16 px gap). Checked for Ginger, Jefferson
   (the tall one) and Big Boy.
2. **The review is one board, stepped with ◀ ▶.** Starts on move 1. The arrows use the game's replay buttons (the same look). The arrow
   keys (← →) step it too, not while typing in a field. The stepper row is one line at a fixed height; the board is at a fixed size and
   doesn't move when stepping (checked on the page: the board's and the stepper's boxes are the same before and after ▶ and ◀).
   - Board, computer: as wide as the column (1440 x 900: 650 px; 1280 x 800: 550 px), and no taller than the window leaves room for
     the stepper, the board and its text (no scroll). Before: 336 px.
   - Board, phone: the screen's width less the 16 px gutters (390 px wide: 358 px). Before: 335 px (86% of the width, at most 340 px).
3. **The gear on a computer's result page is gone** (the side bar has Settings). A phone keeps the gear (it has no other way to
   Settings on this page). Not hidden by CSS: not rendered on a computer when the side bar shows (`MOUSE_LAYOUT`, the same test the
   side bar uses).
4. **Solo: no "everyone".** In a boss battle you play alone (not server-paced: Boss alone and the Solo raid), the text under the board
   has no "Everyone's average loss" and the stepper row has no "N/N found". An online boss battle (server-paced: a Boss raid, a Boss
   Battle party) keeps both. Decided by `!match.serverPaced`, the same flag the result page uses for "Unranked: solo games...".
5. **Buttons on a boss result page** (computer): the wider review column made "Play again" wrap onto two lines, so it is kept on one
   line, as Home is (its text didn't change). The two buttons are now sized to their labels: Home 89 px, Play again 125 px wide at
   1440 (in Eric's screenshot: 144 and 122 px). Crowd's and Classic's result pages are unchanged.
6. **Computer layout of the result page**: the page uses the room beside the side menu (it was capped at 1100 px), with the review
   column 1.3 times the top part's (it was 1 to 1). Only the boss result page, computer layout.

## Removed and new text (old → new)

Inline review (boss battle result), in order:
- Removed: "What cost you the most" (heading and its list of up to three rows).
- Removed: "Every move (N)" (the list of every move, each a row to tap open).
- Row text (was: `N. move · best X · k/n found · ±score`, tap to open a board under the row) → stepper row (new):
  `Move i of N · move · best move · k/n found · ±score` (or `best Nc3` when you missed it; the score red when it cost you). Solo:
  the "· k/n found" part is left out.
- Kept: the brilliant-moves line (above the stepper).
- Under the board: "You played X (… points from the best…). That was the best move." (or "Best was Nc3.") kept. Then "Everyone's average loss: …" online only; solo, left out.
- Unchanged: the heading "Your game, move by move", the Home and Play again buttons' words, the stat tiles, the Last Stand card.

Overlay (Crowd, Classic): unchanged. Same code path; the list and "Everyone's average loss" stay there.

## Checks changed (old → new)

- `e2e/resign.spec.ts`, "Boss alone: Cancel keeps playing; Resign ends the game at once, a loss …": the review check measured the
  first move row's button (`.breakdown.inline .breakdown-move > button`, opened if closed) and checked the board and the row are the
  same width and centred. New: the stepper row (`.breakdown.inline .bm-step`) instead of the move row, the same checks (the stepper,
  the board and the review the same width, centred). Not a standing rule (eric.md).
- New `e2e/boss-review.spec.ts` (3 tests, phone and computer):
  - "a boss's picture never covers the title: the flag, the title, the picture, then the result line (Ginger, Jefferson, Big Boy)":
    the title's box is above the picture's box, and the result line is under the picture (no intersection).
  - "a boss battle alone: one board stepped with ◀ ▶ (and ← →), starting on move 1, the board never moves; no 'Everyone', no 'found'":
    no move list; the text has no "Everyone"; the stepper has no "found"; the gear is on a phone, not on a computer; ◀ greyed on move
    1 and ▶ on the last; ▶ ◀ and ← → keep the board's box exactly the same; the stepper and the text are the board's width, centred.

## Rules (docs/rules/eric.md)

- No check that guards a standing rule was changed or removed. `e2e/match-menu.spec.ts` (the gear on every screen with a chessboard)
  is unchanged; the boss result page on a computer is now a screen with a board and no gear. That touches the rule "The gear is on
  every screen with a chessboard, phone and computer (Eric, Oct 25)": it was left out here on Eric's request (the screenshot and the
  side bar with Settings), which the brief for this round asked for. Eric should confirm it, as the rule says.
- "Nothing hidden, nothing shifts": the review's stepper and board keep their places; the boss box grows only where the drawing is
  taller than the box (it moves the line under it down, as the title's gap needs).

## Lane

Targeted, UI: the boss result page (`packages/app/src/screens/Results.tsx`, `components/Breakdown.tsx`, `styles.css`), and its e2e.
Tests run locally: `tsc -p packages/app --noEmit` (clean); the e2e checks above on phone and computer (6 runs, all pass).

## The gear rule
`docs/rules/eric.md` ("The gear is on every screen with a chessboard"): Eric asked for this himself (Nov 3: "get rid of the little settings icon" on the computer, where Settings is in the side bar). The rule's text now notes the exception; its guard (`e2e/match-menu.spec.ts`) is unchanged.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
