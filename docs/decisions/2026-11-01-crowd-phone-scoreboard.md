# Crowd on a phone: the scoreboard never moves; Black / White / All (Nov 1, 2026)

**Eric (Nov 1, from a 50 v 50 on his phone):** "it moves around too much… make it never move… a static container in the size
of the one… push the bottom one right up flush against it… anything that displays normally… has space above the scoreboard
to fit." "Delete" the "Your team watched this one" line. The scoreboard's header is a pick: Black · White · All, your team
selected when the match starts, the picked one in white, the others grey. "When I test this again live… I should never see
the scoreboard container shifting up or down… this is for mobile. On desktop, we can worry about that later."

What changed (phone only, the locked screen: `max-width: 899px` and `min-height: 520px`; 50 v 50 only, see round 2 below):

- **The middle box:** one fixed height, `--mid-h` (276 px since round 2, styles.css), between the board and the scoreboard. The ⚡ power-up
  row with its « » arrows moves into it (Play, `lockedPhone` in `screens/Play.tsx`), with the status line; the vote results
  (the five bars, their result line) take turns in it. Nothing in it changes its height.
- **The scoreboard** sits flush under it and fills the rest of the screen, so its top edge and height are the same on every
  phase of every turn. Measured at 390 × 844 (round 2, box 276): top 672, height 166 on picking, waiting and the reveal
  (round 1, box 170: top 566, height 272); at 375 × 667: top 589, height 72 (round 1: top 551, height 110).
- **"Your team watched this one · best was …" is gone.** A turn you watched has no line under the bars.
- **The header:** Black · White · All (`mini-picks` in `MiniTower.tsx`). A tap on another picks it; a tap on the picked one,
  or on the rows, opens the full list for that pick. "tap for all 50" is gone. "All" ranks all players by points with a
  small team mark on each row (`RaceTower`'s `teams`), and no cut line: each team is cut on its own in 50 v 50, so one line
  across both would be wrong.
- **Remembered pick:** per match (a WeakMap on the match, like the clock note), so it holds through every turn of the match
  and resets to your team at the next match.

Calls made:

- **The fold arrow (▴ / ▾) still folds** the scoreboard to its header, as before. Eric's brief said the arrow opens the full
  list, but the arrow is the fold, which `panel.spec.ts` guards; the list opens from the picked tab and the rows instead.
  Folding does move the board (the board grows, as it always did with the scoreboard minimized); it's the user's choice, not
  a phase of a turn.
- **At 375 × 667 the scoreboard is small** (72 px: the header and one row). Round 2 made the box taller (see below), so on
  the shortest phones the board gives back the extra height (down to its 220 px floor): the board is 231 px wide there
  (was 299), and nothing spills. Eric to judge on his phone: the trade is the board's size for the scoreboard's rows.

## Round 2 (Nov 1): scope, and nothing may spill

- **Scope: 50 v 50 only.** The box and its height apply only where `isCrowdFifty` (game.ts: a Crowd match with no boss)
  says so: the screen gets the class `crowd-50` (Play, the watching screen and the reveal in `screens/Crowd.tsx`), and the
  `.screen.game.crowd-50` rules in styles.css are the only ones that change. The power-up row moves into the box only there
  too. A boss raid, the Crowd's boss final, Boss alone, 1 v 1 (Duel), Squads, Classic and the rest keep their layout.
  Checked on a phone at 390 × 844: Boss alone's screen has no `crowd-50` class and its boss dock and board (314 px wide)
  as before; the other modes have no such class and no rule that touches them (not a pixel diff against main).
- **The box fits its tallest content.** Measured in the browser (the real styles, phone widths): six bars (the five and
  yours), a brilliant find named by its three finders (the most that can share one: `brilliantMaxFound` is 3) with three
  moves, and the result line wrapped with the allowance and the streak: 274 px. `--mid-h` is 276 px. The 👑 King row
  can't show in a poll: the poll is off in any boss battle, and King is a boss's power, so it isn't reserved for.
- **The board gives back the extra height on the shortest phones.** `.screen.game.crowd-50 .board-area .board-wrap` is
  `min(100%, calc(var(--app-h) - 330px - (var(--mid-h) - 170px)))`, still with its 220 px minimum: unchanged at 390 × 844
  (314 px wide), 231 px at 375 × 667.
- **Guard, extended:** `e2e/crowd.spec.ts`, "the scoreboard never moves" now also samples the middle box's overflow on
  every phase it sees (`scrollHeight - clientHeight`) and expects it to be 0 or less. Checks changed: none; one added
  check line.
- **Desktop (900 to 1099 px wide) also shows the new header**, where the scoreboard is still under the board; from 1100 px
  it's the side column, unchanged.

Guard: `e2e/crowd.spec.ts`, "the scoreboard never moves: its top edge, height and the middle box hold through two turns
(phone)". It isn't a check of an Eric rule in `docs/rules/eric.md`; it's the new check for "nothing shifts" in a match.

## Round 3 (Nov 1): the board keeps its size, the box is compact, the table follows Light / Dark

- **The board is main's size on every phone.** Round 2's board shrink (the box's extra height taken from the board) is
  gone. At 390 × 844 the board is 314 px wide, at 375 × 667 it is 299 px (main's).
- **The middle box is 200 px** (`--mid-h`, from 276). Its tallest content measured 195.6 px in the browser at both sizes:
  six bars, a brilliant find (one line, its names cut with an ellipsis), the result's two lines.
  - The brilliant find: "‼ Brilliant find! {names} found it · +N" (+ " each" for several finders). The moves are on the bars, so
    they're not repeated in the line.
  - The result, first line: the score with its verdict ("best was Qh5+"; cut with an ellipsis if it must be). Second line:
    the allowance and the streak, joined on one line ("no allowance · missed a capture · 🔥 +0.50 streak"), cut with an
    ellipsis if they don't fit.
  - The bars are thinner (8 px, rows 1 px padding). Nothing is hidden: the only cut is the ellipsis on a name or a verdict.
- **Scoreboard rows** (the box is shorter, so the scoreboard is taller): at 390 × 844 its top is 596 and its height 242,
  with 8 rows. At 375 × 667 its top is 581 and its height 80: the header and one row (the scoreboard's rows are what give
  way on the short phone; the board does not).
- **Light mode.** The 50 v 50 team table (`MiniTower`, `.mini-tower`) follows the Light / Dark pick: light rows, dark text,
  the Black · White · All pick in dark (the picked one) and grey (the others). The gold, silver and bronze rank chips, the
  cut zone, your row's tint and the cut line are unchanged.
- **Test checks.** None changed or added. The shoutout check's regex ("Brilliant find! You found … · +1") still
  matches the new line.

## Round 4 (Nov 1): the board never moves between the screens

- **The failing check** ("a rare brilliant find: … and the board doesn't move", 320 × 640): the line above the board on the
  play screen ("Your pick for Black · … picked") wrapped to two lines (28 px) and the reveal's line is one (14 px), so the
  board moved 14 px. Main wraps the same line here, so the check fails on main in this environment too (the director
  reports main's CI passing it: the wrap depends on the font's width there). The branch didn't change that line.
- **The decision:** in a 50 v 50 on a phone (`.screen.game.crowd-50`), the line above the board is at least two lines tall
  (`min-height: 28px`) on every phase. The text sits at the top of the box, and nothing is cut or hidden. The alternatives
  were rejected: an ellipsis would hide "picked", which main shows in full; a shorter line would drop "Your pick for", which
  main shows too.
- **The cost:** on the reveal and the watch screen the board and the scoreboard under it sit 14 px lower, so the scoreboard is
  14 px shorter there. The board's size is unchanged.
- **Checks:** none changed. Passing at 320 × 640: the brilliant-find check, "the board never moves or resizes during a turn
  (Crowd and Classic)", and "the scoreboard never moves".
