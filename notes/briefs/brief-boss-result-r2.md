# Brief: the boss battle result screen, round 2 (Haiku)

Worktree `/home/user/cr-result2`, branch `claude/boss-result-r2` (from main de2f6d16). Push as you go.
Eric's screenshot (a computer, after resigning to Timber): `docs/boss-result-r2/eric-desktop-before.png`. Look at it first.

Code: `packages/app/src/screens/Results.tsx` (the boss result page; it renders `<Breakdown inline … />` at about line 236) and
`packages/app/src/components/Breakdown.tsx` (the `inline` review). Crowd and Classic use `Breakdown` as an overlay (not
`inline`): **leave the overlay exactly as it is**. Every change below is for the boss result page only.

## 1. "You resigned" is hidden behind the boss
The boss's picture (Timber's hard hat) is drawn over the title "You resigned". Lay out top to bottom with a gap: the flag, the
title, then the boss picture, then "Timber won." Nothing overlaps, for every boss (the tall ones too: check Timber, Big Boy, the
God King's size if he shows), on phone and computer. Add an e2e check: the title's box and the boss picture's box don't intersect.

## 2. The move review: one fixed board, stepped with ◀ ▶
Today every move is a row; tapping a row opens a board under it, so the board jumps down the page. Eric: "you shouldn't have to
click a bunch of buttons to see each move. It should just be move left, move right, and then it updates and the board stays in
the exact same place the whole time."
- **Remove** in the inline review: the "Every move (N)" list and its rows, and the "What cost you the most" list. Keep the
  brilliant-moves line if any (one line of text above the stepper).
- **One stepper row above the board:** `◀` · "Move 1 of 12 · e4 · best move · +0.0" (the costly ones keep their red score;
  "best Nc3" when you missed it) · `▶`. Reuse the look of the game's existing back/forward replay buttons (grep the game screens
  for the replay's previous/next move controls) so it matches. `◀` greyed on the first move, `▶` on the last. On a computer the
  ← and → keys step too (only while this page is showing; not when typing in a field).
- Starts on move 1.
- **The board never moves.** The stepper row has a fixed height (one line; ellipsis if needed), the board sits under it at a
  fixed size, and the text "You played e4 (0.0 points from the best). That was the best move." stays under the board (keep that
  line). Stepping only redraws the board, the arrows (yours red, the best green, as now) and the two lines' text. No animation
  of the page; nothing above the board changes height.
- **Board size, computer:** about double today's: fill the right column's width (today about 336 px; target about 640–680 px),
  but capped so the stepper, the board and the text under it fit in the window without scrolling
  (`min(column width, window height − header − stepper − text)`). Narrow computer windows fall back to the phone layout.
- **Board size, phone:** below the top part, as now, as wide as the screen minus the usual side margins, centered.

## 3. The settings gear
The little gear button near the top of the result page: **remove it wherever the side bar with Settings shows** (the computer
layout: Settings is already at the bottom left). If the phone layout also has another way to Settings on this page (a bottom bar
or a menu), remove it there too; if the phone has no other way, keep it on the phone and say so in the PR body.

## 4. Solo battles: no "everyone"
In a boss battle you play alone (Boss alone, the Solo raid), the review talks about you only:
- Drop "Everyone's average loss: …" from the text under the board.
- Drop the "N/N found" count from the stepper row.
In an online boss battle with other players (a Boss raid, a Boss Battle party) keep both, as today. Decide it from the match's
mode or its player count (find the field; don't guess from `pickers` alone if the mode is available) and write which in the PR body.

## Rules
- Nothing else changes: the stat tiles, the buttons, the Last Stand card, Crowd's and Classic's overlays.
- Tests: grep the e2e and app tests for `Every move (`, `breakdown-move`, `found`, `What cost you the most`, `Everyone's average
  loss` and update the boss-result ones; list every changed check old → new. Add: stepping ▶ then ◀ changes the move and the
  board's on-screen box stays exactly the same (compare `getBoundingClientRect` before and after, on phone and computer); the
  title/boss no-overlap check; in a Boss alone battle the text has no "Everyone" and the row no "found". Run only those specs.
- Stills in `docs/boss-result-r2/`: computer 1440x900 and 1280x800, and phone 390x844 (top, and scrolled to the review), after a
  boss battle (a quick resign after a few moves is fine; Timber is admins-only, so use a live boss). Also one still on move 1 and
  one on a later move at the same window size, so the board's place can be compared.
- PR body file `docs/boss-result-r2/pr-body.md`: every removed and new text old → new, changed checks, the lane (targeted, UI).
- Then stop. Report in a few lines what you did and anything you couldn't.

Include and follow `notes/briefs/rules-common.md` (below).
