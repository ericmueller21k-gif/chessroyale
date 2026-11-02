# Brief: the boss battle result screen, cleaned up (Haiku)

Worktree `/home/user/cr-result`, branch `claude/boss-result-layout` (from main). Push as you go.
Eric's screenshots: `docs/boss-result-layout/eric-desktop-before.png` (a computer, zoomed out) and `eric-moves-before.png`
(the move-by-move review opened).

## Scope
The result screen after a **boss battle** (Boss alone / Boss Battle: "You resigned / Big Boy won", the Last Stand card, "It counts
as a loss", "Unranked…", the three stat tiles, then today: a "Stage / Average loss per move" table, "Lower is better…", a "Best
move" board, and a "Your game, move by move" button that opens the review). Find the component (screens/ result or game-over
screens; grep "Your game, move by move", "Lower is better", "Average loss per move"). If it's shared with Crowd / other modes,
change it for boss battles only and say so (Crowd's stage table means something there).

## Remove (boss battles)
- The "Stage / Average loss per move" table and the "Lower is better. 0 means you matched the engine's best move." line.
- The "Best move" board under it (and its caption like "f4: +0.0").
- The "Your game, move by move" button: the review it opens now shows by default at the bottom, no tap needed.
- In the review: the line "Scores compare your move with everyone who picked that turn. Close calls are re-checked with a deeper
  search before every cut."

## The review (every move)
- The move's header bar (e.g. "1. f4 · best Nf3 · 0/1 found · +0.0") and the text under the board ("You played f4 (23.5
  points from the best…). Best was Nf3. …") are exactly as wide as the board, centered with it (today the bar stretches wide).

## Phone
Everything centered in one column, like the top part already is (the board and some text below it are left-aligned today:
fix). The review sits below the stat tiles; you scroll down to it.

## Computer (wide)
Two columns inside the middle column: LEFT the top part (the flag/title, the boss and "Big Boy won.", the Last Stand card, "It
counts as a loss.", "Unranked…", the three stat tiles, the buttons); RIGHT the review (board, its bar, its text, the move
stepping). Both top-aligned, nothing floating. The little settings gear at the top right that floats alone in the empty space:
place it sensibly (top right of the content, beside the title row) so it doesn't hang alone. Narrow computer windows fall back
to the phone's single column.

## Rules
Nothing else changes (other modes' result screens, the text that stays). List every removed text in the PR body. Tests: find
specs that check the removed bits (grep the strings in e2e/ and packages/app/test) and update them; list changed checks old →
new. Run only those. Stills: phone 390x844 (top and scrolled to the review) and computer 1280x800 / 1440x900, after a boss
battle (a quick resign is fine), in `docs/boss-result-layout/`. PR-body file `docs/boss-result-layout/pr-body.md`.
