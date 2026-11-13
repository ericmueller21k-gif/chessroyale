# The God King's words stay inside the game screen (Nov 13, 2026)

Eric (Nov 13): on a computer his speech box opened to the right of him and was cut off at the right edge of the game screen. "It's okay
if it covers our pawn up a little bit... shift everything over to the left."

- The box already moved itself to stay on screen, but it measured against the window's right edge. The game screen's own box clips it
  earlier on a computer, so the fix measures against the screen's right edge (`speech.tsx`), and his room (`--king-room`, in
  `BossCharacter.tsx`) is measured to that edge too.
- Call: the box may cover the pawn beside him, as Eric said. No new layout, no size change.
- Test: one check in `e2e/boss-side.spec.ts` forces his `inCheck` line through the debug hook `__kingSay` (added in `App.tsx`, debug only)
  and asserts the box's edges sit inside the screen's. It fails on main (right edge 1272 px against 1270.5) and passes here.
