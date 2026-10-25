# The board screen: a running move list, the scoreboard and moves panel, the God King far right, a one-line "Your move"

Oct 25, 2026. Eric's notes and his marked-up phone screenshot (Boss alone vs Alfil), items 1, 3, 4 and 6 of his board-screen
rework. Every boss battle screen: Boss alone, a Solo raid, an online raid; phone and computer.

## What changed

- **A running move list** (`components/MovePanel.tsx`, `move-list.ts`): one row per move of the battle, newest at the
  bottom, kept scrolled to the newest unless you scrolled up. Each row: who moved (the boss's portrait; the God King's
  portrait when he played the crowd's move; alone, your own pawn as your profile wears it; in a raid the crowd's pawn), the
  move number ("12." / "12…"), the piece (the board's own piece art) and the square it went to ("O-O" for castling, the
  promoted piece after the square), a capture as "×" and the piece taken, in a raid how many picked the crowd's move
  ("31/50"), and how long the move took ("4s"). A new row fades in (220 ms), nothing at all under reduced motion.
- **Boss alone has no scoreboard anywhere**: a computer's left table (`.tower-side`) is gone in Boss alone (App.tsx: its
  column stays, empty, `.tower-space`), and so is the phone's table under the board; the move list takes its place.
- **A computer**: matches with more than one player keep the scoreboard on the left exactly as before (same box, measured
  against main). The move list sits in the column right of the board, from the board's top to above the God King's head
  (`.mv-side`, its height the board's less his 134 px and a gap, from `--board-px`, which BossDock writes as it lines the
  dock up with the board). What that column held before (an online raid's chat; from 900 to 1099 px the scoreboard) starts
  under the list.
- **A phone upright**: under the "Your move" row, one strip the board's width: the God King at its far right (his crowns,
  his menu opening above the row, his ⚡/🐟 for admins beside his head), the panel to his left. With other players, a
  small switch ("Players" / "Moves", and "Chat" when the match has chat on) picks what the panel shows, in the same box;
  alone, the moves only, no switch. A tap on the panel opens it full size over the board (a sheet from the board's top to
  the screen's foot, a ✕ at its top right; Escape or a tap outside closes it), where it scrolls. This replaces the old
  tap that opened the leaderboard and the fold arrow. The page never scrolls.
- **"Your move." and its « »: one line** (34 px, was 62; the clock on the same line). Where a screen had two lines (the
  boss's move and the line under it, the reveal's verdict, the Last Stand's warning), they now sit side by side with " · "
  between them: the first keeps its room, what follows is cut ("…") first.

## The calls, and why

- **Times come from this device.** The game's history has no times, and the brief says the list reuses the match's own
  history, never a second source of truth. So the moves are the history (worked out a ply at a time and remembered, never
  replayed from move 0 per draw), and how long each took is what this device watched: the boss's from his turn starting to
  his move landing, the crowd's from its move clock starting to its move being in (alone, as you play it; in a raid, as the
  votes are counted). A move played before this page was watching (a reload) shows no time. Adding times to the server's
  history would touch the protocol's core (the full lane) for a nicety.
- **No rows for powers.** A power that changes the board (a slam, a freeze, a hop) has its banner, the boss's words and
  the dock's line already; a slim row would need each boss's events turned into words. Simple first; easy to add later.
- **The opening before the battle** (a raid from an opening, the Crowd's boss final from move N) is one quiet row
  ("Italian Game · 6 moves"), not one row per book move.
- **What the list must not tell**: a move is drawn as the crowd sees it (Smudgy's hidden rook is a pawn there too, as on the
  board and in the dock); the boss's newest move isn't named while the dock hides it (Smudgy's reveal under the paint:
  `hushLast`); during Hollow's Lights out the list says "Lights out: the moves come back after." (the board's pieces are
  what the crowd must remember, and the « » are gone meanwhile).
- **The crowd's picture.** Alone it's your own pawn, as your profile wears it (`Avatar`). In a raid, the crowd's plain pawn
  in its color with how many picked the move: a picture per player would be noise, and the count is the detail that matters.
- **Online chat on a phone**: the strip has no room for the old split (scoreboard beside chat), so chat is the panel's
  third tab when it's on; a tab other than Chat shows the unread count on it, and new messages still bubble up while chat
  isn't shown, as before. A tap on chat doesn't open the sheet (its lines are buttons).
- **The God King's words on a phone** open to his left, over the panel (never over the board or the row), and his
  menu above the row at his right, as it opened above the row before. His ⚡ and 🐟 stay beside his head on his left (Eric,
  Oct 24), over the panel's top right where the switch leaves room; Chub & Chirp's carrot count sits just left of him (or of
  the admins' icons).
- **His words on a computer** still open above him, out from the board: they can cover the bottom of the move list for
  their few seconds. The list is reference, the line is said once; moving the list lower would put it beside him and shrink
  it, so his words win the space while they show.
- **Babur's pump and the empty column.** The pump is in `.boss-side`, left of the board, so it never meets the move list
  (right of the board). Dropping Boss alone's left column altogether recentred the board and left no room left of Babur
  for his pump at 1280 × 800 (it fell back to the taller bar, `tiger.spec.ts` caught it), so the column stays, empty: the
  board, the boss and the pump keep exactly their places. `tiger.spec.ts` now counts `.mv-side` among what the pump must
  stay off.
- **The board's size** on a phone is today's (the same rule, 330 px of the height for the rest); the 28 px the one-line
  row frees go to the strip. The board no longer grows when the scoreboard is minimized there, since there's nothing to
  minimize; a fold remembered from another match changes nothing on a boss screen (the Hidden Boss's phase change keeps
  phase 1's board size: `rc-folded` only where phase 1 could fold). On a computer the board is the same size as before.
- **Lights out's rounds** keep their 62 px box (two lines of prompt and the meter: the prompt is what the round asks of
  you, and the board above never moves). The one-line rule is for "Your move" and everything else in the row.
- **A phone on its side, a short window** (no locked phone layout, no computer layout): the old dock and the scoreboard under
  it as before; Boss alone shows the move list there instead of the scoreboard.
- **The Hidden Boss's phase change and phase 2** have no panel (four boards, and the God King gone): their docks are as
  before, one line tall.

## Tests

- Unit: `packages/app/test/move-list.test.ts` (each row's piece, square, capture, castling, en passant, promotion and
  positions from a history; only new plies worked out; a move taken back and a new base redone; who moved: the opening, the
  crowd, the God King, the boss; the times and a raid's picks as a device watches the phases).
- e2e: `e2e/board-layout.spec.ts` (a phone at 390 × 844, 360 × 640 and 320 × 568, Boss alone and a Solo raid: the God
  King at the strip's right edge, the panel to his left with no overlap, the board no smaller than main's, no scrolling,
  the switch in a raid and none alone, the sheet over the board and its ✕ and Escape; a computer at 1280 × 800,
  1440 × 900 and 1920 × 1080: Boss alone with no scoreboard, a raid's where it was within 1 px, the moves right of the
  board and over neither the board nor the God King; both: one row per move with the right piece, square and capture,
  and the "Your move" row at most 60% of main's height, its text one line).
- Specs whose meaning moved with the layout: `boss-dock.spec.ts` and `boss-character.spec.ts` (the God King under the
  row at its right edge, not its middle; the minimize check is gone, since there's nothing to minimize), `profile.spec.ts`
  (the phone opens the leaderboard from the panel), `recluse.spec.ts` (the board's size through the phase change, with a
  fold remembered from another match instead of a tap on the fold arrow).
