# Crowd on a phone: the scoreboard never moves; Black / White / All (Nov 1, 2026)

**Eric (Nov 1, from a 50 v 50 on his phone):** "it moves around too much… make it never move… a static container in the size
of the one… push the bottom one right up flush against it… anything that displays normally… has space above the scoreboard
to fit." "Delete" the "Your team watched this one" line. The scoreboard's header is a pick: Black · White · All, your team
selected when the match starts, the picked one in white, the others grey. "When I test this again live… I should never see
the scoreboard container shifting up or down… this is for mobile. On desktop, we can worry about that later."

What changed (phone only, the locked screen: `max-width: 899px` and `min-height: 520px`):

- **The middle box:** one fixed height, `--mid-h` (170 px, styles.css), between the board and the scoreboard. The ⚡ power-up
  row with its « » arrows moves into it (Play, `lockedPhone` in `screens/Play.tsx`), with the status line; the vote results
  (the five bars, their result line) take turns in it. Nothing in it changes its height.
- **The scoreboard** sits flush under it and fills the rest of the screen, so its top edge and height are the same on every
  phase of every turn. Measured at 390 × 844: top 566, height 272 on picking, waiting and the reveal; at 375 × 667: top 551,
  height 110 (see the call below).
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
- **At 375 × 667 the scoreboard is small** (110 px: the header and two or three rows). The middle box is 170 px, sized for
  the five bars plus a sixth row (your move when it's outside the top five) and the result line. Eric to judge on his phone.
- **A brilliant-find line** (a rare find, 50 v 50's shoutout) sits in the vote results too, and can take the box a little
  past its 170 px for that one reveal. Not sized for; flagged for the live check.
- **Desktop (900 to 1099 px wide) also shows the new header**, where the scoreboard is still under the board; from 1100 px
  it's the side column, unchanged.

Guard: `e2e/crowd.spec.ts`, "the scoreboard never moves: its top edge, height and the middle box hold through two turns
(phone)". It isn't a check of an Eric rule in `docs/rules/eric.md`; it's the new check for "nothing shifts" in a match.
