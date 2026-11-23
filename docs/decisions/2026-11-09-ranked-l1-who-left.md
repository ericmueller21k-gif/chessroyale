# Ranked L1: who left, when it isn't obvious (Nov 9, 2026)

The design says "the one who left"; the server only knows who pressed what and whose sockets were open. The director's-lane calls
(`conductOf` in packages/chess/src/duel/rules.ts):
- Abort or a missed first move with exactly one player gone: the gone one dodged (they left first; the other gave up waiting or
  sat waiting for nobody). Both gone: nobody (a server that dropped both looks the same: "the server knows when it was at fault").
- Abort while still waiting for the other to connect (no game yet): the presser's dodge; the absent one isn't late yet.
- The queue's Cancel pressed the moment it paired (`DuelGame.abandon`): nobody's. They never saw the game.
- Abandoning = a flag while you had no socket and your opponent had one. No extra grace: in 1 v 1 your clock is the hold (a reload
  is back at once). A flag that's a draw (the other side can't mate) isn't a leave.
- Decided once as the game ends; coming back after changes nothing.
