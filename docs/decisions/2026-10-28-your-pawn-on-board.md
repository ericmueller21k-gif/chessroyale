# Your pawn beside the God King, and a shorter move list on a computer (Oct 28, 2026)

Boss alone only. Phone and computer. Builds on [2026-10-25-board-layout.md](2026-10-25-board-layout.md) (the strip, the move list,
the God King's place). Code: `YourPawn` and `hopAt` in `components/BossDock.tsx`; styles.css, "Boss alone: your pawn beside the
God King" and ".mv-side"; tests in `e2e/board-layout.spec.ts`.

## Eric's words (Oct 28, trimmed)

- "we should have everyone's pawn piece … represented on the board. I want to implement in all the modes, but let's start with
  the solo boss mode. … It doesn't need to do anything fancy, like when the king saves you, your piece stays there. … maybe add a
  few little animations, like we have that bounce one … or honestly even just an idle one where it kind of moves very slightly
  up and down, like how the king currently does. … on the desktop, … it should be left, like, close to the board, and then the
  king stands to the right of you, your piece, and they should be about the same size."
- The move list on a computer: "it just seems like it's a little weird how it sits off to the side this much. … It can stay the
  same width, but there's a lot of dead space in … the box … slice it in half vertically, and then shift it over so it's got a
  little buffer between the board, but it's flush with the top of the board."

## What it is

- **Your pawn** (Boss alone's battle screens): your own pawn as your profile wears it (`Avatar`, the same as the move list's
  rows and the town), in the crowd's color (a side `b` game draws it black, as the rows do). Drawn once; CSS transforms only.
  - **A computer:** right of the board, on the line of the God King's feet (the board's bottom edge), as far from the board as
    the boss is on its other side (its box 26 px off the board, its middle 86 px out: `--gk-off` with the eval bar, and with none
    `--gk-off` plus `--bs-out`, the 24 px the boss stands further out then: the director's note of Oct 28, #390), **the God King to
    its right**, his old place moved over by the pawn's width.
  - **A phone upright:** in the strip under the "Your move" row, just left of the God King, the same 58 px column and height as
    his. The panel gives up that width (it ran up to his column minus 8 px, now up to the pawn's column).
  - **Idle:** a slow bob up and down (2 px on a phone, 3 px on a computer), 2.4 s a round, the God King's own breath
    (24 frames of 100 ms). **Hop:** one small hop as your move lands: home's hero pawn's `fd-hop` (a crouch, up, a squash on
    landing), sped up to 0.6 s. Nothing else: it doesn't react to his save, a boss's power or the result. Under reduced motion
    neither plays.
- **The move list on a computer** (`.mv-side`, 900 px wide and up): its top is the board's top, **half its old height**, the
  same width (the column's 340 px), its left edge **13 to 15 px from the board's right edge** (it was 52 to 110 px at 1280, 1440, 1536,
  1920 and 1024 px wide). What's under it in the column (an online raid's chat; the scoreboard from 900 to 1099 px) starts 12 px under the
  shorter list.

## The calls

1. **Where the pawn shows.** Wherever Boss alone's dock has the panel (a phone upright) or the computer's corner: all of
   the battle's screens (your move, the boss's turn, the reveal). Not the Hidden Boss's phase change and phase 2 (their docks
   pass `king`: his place is the absorption's, then empty, and they have no panel), and not a phone on its side or a short window
   (the old dock, nowhere beside him to put it). A raid, Boss Arena, 1 v 1 and the town: unchanged.
2. **How big.** "About the same size" is how big it's drawn, not its box: a pawn fills about 70% of its square, he fills all of
   his. So the pawn's art box is 68 px on a phone (his 50) and 168 on a computer (his 120), its base on his feet's line: the drawn
   pawn is 49 px tall against his 50 on a phone, and 121 against his 122 on a computer. Their layout boxes (58 × 62 and
   120 × 134) are the same.
3. **The hop trigger.** Your move going in: the move shows on the board at once and the match goes to its "scoring" phase with your
   move (Boss alone's own move; a time-out has none and doesn't hop). The boss's reply and the God King's play never hop it. I
   first keyed it to the history growing, which came 2 to 3 s later, when the boss's turn began: too late to read as "as your
   move lands". The hop's start is kept per match (`hopAt`) and a new dock (each screen mounts its own) carries it on from its
   age (a negative `animation-delay`), as the bob carries on from the clock's phase.
4. **Phone: the panel's rows.** At 58 px less the panel is 119 px wide at 320 px, where a row (who, number, piece, square, a
   capture, the time) needed 140 to 175. Two container queries on the panel (190 px and 139 px wide) tighten the row: smaller
   gaps, padding and pictures. Every plain row, castle and capture shows its time at 320 and 360; a promotion with a capture can
   still lose a few pixels at 320 (it did on main at that width too). Raids' panels are unchanged (the queries are the pawn
   strip's).
5. **Phone: what stood left of him.** His ⚡ and 🐟 (admins) and **Chub & Chirp's carrot count move beside your pawn**, just left
   of it (my call: there's no room between him and it, and the count belongs with the strip's top row, not over the pawn).
   They're still level with his head, over nothing; on a computer the count is in the status box and the ⚡ and 🐟 in the title
   line, as before.
6. **His words.** On a computer they still open above him: clear of your pawn and of the list (the list is shorter, so they don't
   reach it any more). On a phone they open left from him over the panel, so for their few seconds they're over your pawn (as
   over the panel's top before); the pawn keeps its box and comes back with the words.
7. **A computer: the God King's old place.** He used to mirror the boss's distance from the board; the pawn has that place now and
   he stands beside it. `--gk-clear` (how far the column's contents keep from him) isn't changed: Boss alone has nothing in the
   column under the list, and a raid's king hasn't moved.
8. **How the list moves in.** Not a margin (it would change the column's width): a `translate` by the column's gap and the board's
   slack, from `--gk-column` and `--board-px` (the sums the God King's clearance uses). The gap is 13 px by the sum; the board's
   own wrap is up to 4 px wider than its squares, so it measures 13 to 15 px. **The height** is `max(120px, board/2 − 73px)`: half
   of the old `board − 146px`, with a floor of 120 px (the old floor was 160 px) so a short window still shows a few rows.
9. **A raid's list.** The same size and place wherever `.mv-side` shows on a computer: Boss alone, a Solo raid and an online
   raid. What's under it keeps its left edge (it keeps clear of the God King), so the list's left edge is up to 140 px left of
   it. Not changed here.

## Not done

- Everyone's pawn in the other modes (raids, Boss Arena, 1 v 1): Eric's "I want to implement in all the modes" is the next step.
- A phone on its side, and the Hidden Boss's phase 2: no pawn.

## Tests (changed checks, old → new)

None of these guards a rule in `docs/rules/eric.md` (the gear's guard, `e2e/match-menu.spec.ts`, is unchanged).

- `board-layout.spec.ts`, the computer test: "from the board's top (within 30 px)" → level with it (1 px); "room for rows,
  at least 150 px" → half the old height (2 px) and at least 120 px; "right of the board" → 12 to 16.5 px off it; new: the
  board's box is main's at 1280, 1440, 1536, 1920 and 1024 (1 px), the pawn's place, size and line, the God King to its right,
  his words clear of it, the scoreboard from 900 to 1099 px 12 px under the list. Its sizes grew (alone at five sizes; a raid at
  1280, 1920 and 1024).
- `board-layout.spec.ts`: new, with no eval bar (every player's board, `brc.evalBar` 0) the pawn's middle is as far from the board as the
  boss's (2 px), 26 px off it, and the list is still 12 to 16.5 px off the board (1280 and 1920).
- `board-layout.spec.ts`, the phone test: new, the pawn between the panel and him, his size and line, in the crowd's color,
  none in a raid. New tests: the pawn's bob and hop (and none under reduced motion), a narrow phone's rows fit.
- `boss-character.spec.ts`: "the God King's middle is as far from the board as the boss's" → **your pawn's** middle is, and he
  is right of the pawn.
- `boss-dock.spec.ts` (the admins' icons) and `hopper.spec.ts` (the carrot count): added, they stand clear of your pawn.
