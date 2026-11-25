# Round 2 on `claude/crowd-frame` (PR open): the opening vote's right column (Nov 26). Opus high, targeted

Director's review of `stills/crowd-frame` (crowd-1920x960-opening-vote.png): the in-game frame matches Eric's approved mock. The opening
vote doesn't meet Eric's column rule: its right column holds the "Drag your pawn into a zone, or tap a card." line (wrapped to two
lines, centered under the gear) and the three cards, then is EMPTY down to the board's foot (about 700 px of nothing at 1920x960).
Do:
1. The vote's right column runs the board's height like the game's: the instruction line on ONE line (shorter words if needed, e.g.
   "Drag your pawn to a zone, or tap a card."), left-aligned on the gear's line; the cards; then the chat (Team/All, the same component and
   place as in the game) filling the rest to the board's foot. If the chat can't be in the vote (check how the phone's vote does it and
   whether chat is live there), the column still ends on the board's line: say what you put there and why.
2. Nothing moves when the game begins: the board, the scoreboard and the chat keep their places from the vote into move 1.
3. Add the vote screen to the new eric.md column-rule guard in `desktop-board.spec.ts` (1536x730 and 1920x960).
4. Merge origin/main first. Stills: the vote at 1536x730 and 1920x960 to `stills/crowd-frame/round-2/`. Append a "Round 2" section to
   `.pr-body.md` (what changed, checks changed old → new, specs run). Delete `.done` at the start; COMMIT and push `.pr-body.md` and a
   new empty `.done` at the end, then stop.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). American English.
Wait with one foreground `timeout 590 bash -c 'until ...; do sleep 30; done'`, never Monitor.
