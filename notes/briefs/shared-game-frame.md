# Build: one shared computer frame for every game screen (50 v 50, Boss alone/raid, Squads), after the 1 v 1 (Nov 25). Opus high, targeted, one PR per mode

Eric (Nov 25): "address the screens", "make sure changes are done to all screens so I'm not repeating myself", and on the 50 v 50 mockup:
"chat ... still too low, needs to be shrunk to match the left black box same height as I've said many times, it's below the board".
Start AFTER `claude/duel-layout` merges (the 1 v 1 frame, the side menu's labels-whenever-they-fit and the narrowing right column), and
build the other modes ON that frame (shared pieces, not copies): the top strip, the right column, the gap token, the gear's place.
Reference: round 1's NOTE and stills (`git show origin/stills/game-layout-mockup:NOTE.md`, `stills/*-before-after.png`).

## Eric's rules for every computer game screen (all of them, every size)
1. **Every column shares the board's top and bottom line.** The left column (the 50 v 50 scoreboard, Squads' team clocks), the board (with
   its strips) and the right column all start and end on the same two lines; the right column's content (status, buttons, chat) fits
   INSIDE that height: the chat shrinks to fit, never runs past the board. Add this to `docs/rules/eric.md` (at Eric's request) with ONE
   guard test that checks it on every mode at 1536x730 and 1920x960 (± 1 px).
   **And equal gaps:** the gap between the left column and the board equals the gap between the board and the right column (± 1 px;
   Eric, Nov 25: "the padding on the left and right of the chessboard aren't equal": 32 vs 43 px in the 50 v 50 mockup). Where there's no
   left column, the board-to-panel gap is the frame's one gap. The same guard test checks it.
2. The board never shrinks for the menu; labels show; the right column narrows to a working minimum first (the 1 v 1 PR's rule).
3. No title line: the mode's status line is the top strip; the gear top right, level with it.
4. Nothing hidden, nothing shifts; one gap token; nothing stretched.
## Per mode
- **50 v 50 (Eric APPROVED the director's mock, Nov 25; script `notes/tools/mock-crowd-50.spec.ts`, stills sent to him):** the top row is
  the status line, LABELED and longer: MOVE · NEXT CUT ("34 v 34" / "in 14 moves" / "now") · YOUR PLACE (1/50) · YOUR POINTS · CUT LINE,
  a small gray caps label over each value (SUPERSEDED in part: see "Eric's correction" below: PICKED is added, the pick line goes). The history arrows + power-ups row moves to the TOP of the right column (Eric chose this over keeping it under
  the board), then the vote box (standing skeleton), the status/result line, the chat to the board's foot. **The status box ("White is voting… 27/50") always shows** (Eric, Nov 25: "same treatment" as the
  vote box: always visible, empty or a waiting line when not in use): the same place and size in every phase, gray like the skeleton rows
  with a quiet "Waiting…" when there's nothing to say (e.g. your own pick turn), never a blank hole; the phone's one-line status likewise.
  Board 634 at 1536x730, 864 at 1920x960 (final mock). Scoreboard 340, right column 300, equal gaps (~29), centered. The phone is unchanged.
- **Squads:** a real right panel the board's height: the tiny boards on top, the pick line, then the chat; the board line ("Board 2 ·
  starting soon") in the top strip's middle.
- **Boss alone / raid:** the Moves panel the board's height (not stopping halfway); the boss bar: ASK the director (Eric's call pending:
  one-line bar for 621 px, or today's two-line bar for 602 px).
## Each PR
Stills at 1536x730, 1920x960, 1858x1040 (and the phone unchanged), looked at yourself against the rules above before pushing; the
`desktop-board.spec` real-screens numbers updated; checks changed old → new; a short decision note; area pages. Push, `.done`, stop.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By).

## 50 v 50 top row, Eric's correction (Nov 25, after the approved mock): the mock to match is the LAST one sent (`notes/tools/mock-crowd-50.spec.ts`)
- The "Your pick for White · N/50 picked" line over the board is GONE; its count is a labeled number in the top row right after MOVE:
  MOVE · PICKED (x/y: your team's picks on your turn, the voting team's while you watch) · NEXT CUT · YOUR PLACE · YOUR POINTS · CUT LINE.
- No team-color circle by MOVE.
- The row sits RIGHT on the board (no padding; a few px above the board's top bar, never touching it), on the same line as the board's
  timer pill, which STAYS where it always was (the board's top-right corner: Eric, "I never said to move the timer"); the whole screen
  moves up (no empty band at the top).
- The gear sits on the right column's first line, beside the arrows + power-ups, which start level with the board's top. The scoreboard's
  table starts level with the board's top too (its "BLACK TEAM" label above it, in the row's height).
- Board 634 at 1536x730, 864 at 1920x960 in the final mock.

## 50 v 50 mock APPROVED Nov 26 (Eric: "It's fine, I see it now")
Build exactly what `notes/tools/mock-crowd-50.spec.ts` shows, including the standing gray "Waiting…" status box.

## First job (Nov 26): the 50 v 50 only, one PR (branch `claude/crowd-frame`)
- Build on main after #953 (the 1 v 1 frame, `useMenuLabels`, the narrowing column, `--rd`/gap tokens). Reuse its pieces; don't copy.
- Labels vs the mock: the mock measured 634 with ICONS. The #953 rule (board never shrinks for the menu) decides labels per window:
  report the board with icons and with labels at 1536x730 and 1920x960. If labels would cost board, icons stay (the rule): say so.
- The right column's minimum stays 280 (#953); the mock's 300 is the target where there's room.
- Eric's column + equal-gap rule: add it to `docs/rules/eric.md` with ONE guard test (in `desktop-board.spec.ts`), checking the 50 v 50
  and the 1 v 1 now; Squads and Boss join it in their own PRs (say so in the rule's text).
- Stills: 1536x730 and 1920x960 on your own pick turn (the Waiting box) and while watching the other team vote, plus 1858x1040, plus
  the phone 390x844 to show it unchanged. Put them on `stills/crowd-frame`.
- Squads and Boss are NOT in this job.

## Second job (Nov 26): Squads only, one PR (branch `claude/squads-frame`)
- Build on main after #953 (1 v 1 frame) and #956 (50 v 50 frame, `--cf-gap`, Eric's column-rule guard in `desktop-board.spec.ts`). Reuse;
  don't copy. Read #956's PR body and `docs/decisions/2026-11-26-crowd-vote-column.md` first.
- Squads on a computer (1100 px and up, mouse): no title line; the board line ("Board 2 · starting soon", the format) is the top strip's
  middle; the gear top right, level with it. Left column: the team clocks / boards list as today, on the board's top and bottom lines.
  Right column, the board's height: the tiny boards on top, the pick/vote line (standing, gray "Waiting…" when idle, as the 50 v 50's
  status box), then the chat to the board's foot. Equal gaps either side of the board. The board never shrinks for the menu; labels by
  #953's rule.
- Add Squads (in play, and its lobby/vote if it has a board) to the eric.md column-rule guard at 1536x730 and 1920x960, and say so in the
  rule's text in `docs/rules/eric.md`.
- BEFORE building: make a quick mockup still (CSS/DOM injected over the live screen, like `notes/tools/mock-crowd-50.spec.ts`) at 1536x730
  and push it to `stills/squads-frame/mock/`; then build without waiting (the director reviews the mock and the build together).
- Stills of the build: 1536x730, 1920x960, 1858x1040, plus the phone 390x844 unchanged, on `stills/squads-frame/`.
- The phone is unchanged.
