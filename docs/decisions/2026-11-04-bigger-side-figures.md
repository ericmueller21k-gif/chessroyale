# Bigger figures beside the board on a computer, round 2 (Nov 4, 2026)

Eric (Nov 4, after #482): "those things are tiny… there is space for more"; his rule the same day: a figure may overlap the board or a
menu ("it's better that they overlap on the board… it can even create a cool effect"), never be cut off by the window's edge. #482 kept
the mirror (your pawn's middle as far from the board as the boss's) and the boss clear of the board, and the figures grew only about 1.1×
at 1280, 1440 and 2000 px: the room right of the board held both sides back.

- **The rule now** (`characters/side-size.ts`, from 1100 px wide): the boss grows toward 2× (the board's side over 170, 2 to 4 screen px
  a sprite px) in the room left of the board (to the empty column's edge, and the window's top); your pawn and the God King toward 2× in
  the room right of it (to the window's edge, or a chat beside the corner). Each stands 12 px off the board where its room allows, and
  where it doesn't comes over the board's outer edge, by at most 0.05 of the board's side (0.4 of a square), before it gets smaller. The
  boss is drawn over the board there (z 6), a few px higher where his drawing under his feet would lie over the dock's row.
- **The mirror** gave way (the director: a design check, not an eric.md rule): each side is placed by its own room, by the same rule (a
  gap off the board, or as far over its edge as needed, at most 0.05 of its side). Kept exactly, it held the boss to 1.1× at 1280.
- **The God King's frame** (wider than his drawing) is clipped past the window's edge (`.gm-main`, `overflow-x: clip`), never scrolled to;
  his drawing stays inside, and his words and menu fit the room to the window (`--king-room`).
- **Calls:** Babur keeps 2 and his place (his pump's room); a raid's boss keeps 2 and his place (he stands over its scoreboard's edge: no
  empty column), its God King grows; a party's battle is unchanged (stacked by the corner). Your pawn's box ends at its feet now (it
  stood on the God King's 14 px crowns' row), so it never lies over the dock's row where it comes over the board's corner.
- **Sizes against the old ones (2× and 120 px, before #482):** the boss 1.55 to 1.8× at 1280 × 800, 1.55 to 2× at 1440 × 900, 1.8 to 2×
  at 1920 × 1080 and 1.65 to 2× at 2000 × 1250 (Folio's wide drawing the least); the God King and your pawn 1.4×, 1.43×, 1.9×, 1.6×.
  The board, a phone and 900 to 1099 px unchanged.
