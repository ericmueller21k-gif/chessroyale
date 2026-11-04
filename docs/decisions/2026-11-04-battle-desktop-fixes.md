# Boss battles on a computer: the cast in place, bigger figures, the cave's bubble (Nov 4, 2026)

Eric (Nov 4, Chrome, a 2000-px-wide window, fighting Hollow): Hollow "jumps out of the page" when he throws his darkness, drawn at
the board's top-left, half off the window, his words ("You'll pay for that.") left at the bottom-left; "we have space on the desktop.
They should be kind of bigger"; in the cave his intro line is in a bubble the size of a name tag, far above his head: "about three
times the size … just over his head". New standing rule the same day: every character sprite is whole on screen at rest and at the end
of each move, phone and computer; over the board or a menu is fine (docs/rules/eric.md).

- **The jump's cause:** not the move beat's `translate` (it only ever moves a phone's bar figure). Every power moment's cast was drawn
  by a second figure, `.pm-caster`, at the board's top-left corner (`top: -16%` of the board, Hollow's `-27%`), with the standing figure
  hidden (`visibility: hidden` on its sprite only, so its words stayed). On a phone that corner is just under the bar where the boss
  stands; on a computer the boss stands by the bottom-left, and the board's top is near the window's: at 2000 × 1250 Hollow's caster
  was drawn at y = -226. Fix: `Cast` (PowerParts.tsx) casts where he stands on a computer (an `InPlace` run); every corner cast uses
  it; flights leave from his side. A phone is unchanged. This changes "his cast stands by the board's corner, phone and computer alike"
  (Timber, Nov 1) for computers only: Eric's Nov 4 report calls the corner on a computer a bug, and every boss still works alike.
- **The old sizes:** the boss at 2 screen px a sprite px (box 96 × 120) since Boingo's first figure (7581a98d, Oct 8; 1× from 900 to
  1099 px since 6285b1cb, Oct 14), the God King in a 120 px box (his pixels doubled, d6c38776, Oct 8). They never shrank: the board grew round them (#406, Oct 29: 470 px
  to the window's height less the room, and #443, Nov 1: the title line gone), from 470 px to 600 to 1120 px.
- **The new sizes:** the board's side over 240 (2.5 at 1280 × 800) up to 4.5, in quarter steps, as far as the room left of the board
  (to the empty column's edge) and the window's top let each boss's drawing at rest and at each beat's end (`SIDE_REACH`); the God
  King and your pawn the boss's wanted size over 2, as far as the room right of the board lets them (1.15 at 1280 and 1440, 1.5 at
  1920, 1.25 at 2000). Calls: Babur keeps 2 (his pump stands beside him in that room; bigger, it went into the taller bar and the
  board shrank, which Eric said to leave); a party's stacked God King is unchanged; non-integer scales are fine (the town and the God
  King already draw that way).
- **The cave's bubble:** its font 0.11 of the boss's drawn frame height (11 to 32 px: about 22 px at 1440 × 900, 2.5 times the old 11),
  its tail just over the top of his drawing (not his frame's head room). A phone's is 11 to 13 px, as before, now just over his head.
- Unchanged: the board's size and place, a phone's layout, 900 to 1099 px, moments that carry the boss onto the board (their art still
  starts at the board's top-left: a follow-up).
