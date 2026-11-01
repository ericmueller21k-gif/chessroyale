# The eval bar off for everyone (the Testing row stays, disabled) (Nov 1, 2026)

Eric (Nov 1): "we need to disable the eval bar… it should never actually be displayed… we can keep it in the settings for now,
but disable it… disable it across the board, make sure that the size of the board, the chessboard, remains how it is. Nothing
gets resized when the eval bar isn't enabled."

- **What changed:** `evalBarOn()` is false on every device (testers, admins and test servers too), so `EvalBar` draws nothing on
  any board. Settings → Testing keeps its "Eval bar" row, switched off and not tappable, "Off for now"; a stored `brc.evalBar` is
  ignored. Results keep recording `eval_bar` as 0.
- **The director's call:** the Colosseum's spectator bar (its own `.col-eval` on the overlay board, watching not playing) stays.
  Eric can say if he wants that one off too.
- **Why the boards don't move:** a player's board already had no bar, so every board now lays out as a player's always has. The
  sizes the desktop and layout specs pin were measured with the testers' bar on; they're now the no-bar sizes, and the "never
  smaller than main's" checks still hold.
- **Babur's pump, round 2 (fixed).** With no bar, his column was the 240 px rule meant for Boss alone, so at 1440 × 900 and 1920 × 1080
  the pump's box (its size grows with the board) hit the side menu and went in the taller bar, and the board shrank (832 at 1920). His
  column is now his own formula at every size, `clamp(240px, 0.35 × the window's height − 40px, 340px)` (`board-size.css`): 240 at
  1280 × 800, 338 at 1920 × 1080. The pump stands beside him at all four sizes; his board is 600 at 1280 × 800 and 640 at 1366 × 768
  (both as before), 728 at 1440 × 900 (was 680, the taller bar's) and 952 at 1920 × 1080 (was 832). The check
  is unchanged except its two sizes (1440 680 → 728, 1920 832 → 952; PR body).
- **FAQ (round 2):** "The eval bar beside the board shows the same number." is dropped (`faq/content.ts`); nothing on screen shows the
  number now.
- **The chat tab on a short phone, round 3.** With the bar off for testers too, `panel.spec.ts` (390 × 664) measured a player's
  chat tab: a 140 px box whose two rows of buttons left the feed 23 px, one line (players have had this since #446). The
  board doesn't resize for it (Eric's rule) and nothing gets hidden behind a tap, so a box under 170 px gets 30 px buttons
  (were 34 and 38) and 18 px lines (were 22): the feed is 39 px, two whole lines, every button still there.
