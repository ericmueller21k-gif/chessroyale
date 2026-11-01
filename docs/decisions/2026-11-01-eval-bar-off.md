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
- **Known red, for Eric:** Babur's pump at 1440 × 900 and 1920 × 1080 is in the taller slot, not beside him, for a player today
  (the no-bar layout; the suite only ran with the bar on until now). The check is unchanged; Eric decides (see the PR body).
