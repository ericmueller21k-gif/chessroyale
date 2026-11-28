# Rank piece sets for the shop: mockup of the styles (Eric, Nov 28 ~01:30 UTC). Fable, high. Stills only (orphan `stills/rank-pieces`)

Read `notes/briefs/rules-common.md` first, then `notes/briefs/town-shop-mockup.md` and its `NOTE.md` on `stills/town-shop-mockup` (the
12 boards and their colors), `docs/areas/board.md` (the piece SVGs: Colin M.L. Burnett's set, how pieces draw) and `docs/areas/ranked.md`
(the tiers and their emblem colors). A throwaway preview script, not merged; no game code, no PR.

**Eric:** a purchase in the shop: rank-colored pieces, bought once you've reached that rank (Gold and up, like the boards), either the
**king and queen only** or the **full set**. White and black must stay obvious at a glance. His two ideas, mock both:
- **A. The whole piece a gradient:** e.g. Pearlescent: white pieces a white→pearl gradient, black pieces a black→pearl gradient.
- **B. The default piece with a gradient border** a few pixels wide in the rank's colors (the inside stays white or black). He worries a
  SOLID border would look ugly: show one solid version beside it so he can see the difference.
And a game setting: **"Always default board and pieces"** (in the main Settings and the in-game settings) that shows the default board and
pieces everywhere, even your own, for players who want plain chess.
**Make (stills):**
1. For 3 ranks (Gold, Sublime, Pearlescent): A, B (gradient border) and B-solid, each on a full board in a real middlegame on that rank's
   board AND on the default board, white and black both, at phone size (the board ~370 px) and big. The king-and-queen-only version of A
   and B on one of them.
2. A close-up sheet: each style's king, queen, rook, bishop, knight and pawn, white and black, at 3 sizes (phone, computer, 2x), so the
   edges and gradients can be judged.
3. Check at phone size that every style keeps white vs black, the last move, check's glow and capture rings readable; note any that fail.
4. The setting's row in Settings (the toggle and its one-line explanation), as a still.
NOTE.md: what you made, which style you'd pick and why (one paragraph), any that failed the check. Then `.done` on the stills branch.
