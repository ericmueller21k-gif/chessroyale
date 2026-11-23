# An ultimate that can't wait: Chandy's last chance on a shared floor (Nov 19, 2026)

**The director's call** on audit 1's finding 2 (docs/decisions/2026-11-19-battle-tower-audit-1.md): yes, he still dodges. The design
says every boss behaves on a floor as in his own battle, and Eric's words for the last chance (Nov 16) were "he still fires his ult
anyway". Before this, his Dodge came only when the mate opened at his own turn change: half the time with two bosses, a third with three.

**Built:**
- `BossRules.ultimateNow?(p, t)`: an ultimate that can't wait for its boss's own turn change. Chandy's: Dodge not yet used and
  `mateOpen`. `prepareSide` asks it at every turn change. When it says yes, his ultimate's step runs first, unheld, and the others wait
  with their warnings kept, as a prepared ultimate already makes them wait.
- **One exception (my call):** the ultimate the boss who just moved prepared with his move (`triggerAtHisTurn`) still comes. Wrangler's
  line-up is already on the board by then, and holding its showdown leaves him with the line-up and no showdown, the bug the several-bosses
  note recorded. Both come at that turn change, Dodge first. That only happens when the mate is open under the showdown's own forced
  duel.
- `mateOpen` on a side reads the side's allowed moves (`TurnContext.crowdMoves`): every boss's steps for the turn change, run on a copy of
  the match's state with the can't-wait ultimate held. They're worked out only when a mate in one is on the board, once per turn change.
  A mate another boss's freeze stops isn't open.
- **He holds the crowd's turn** (`focusNow`, after Hollow's second move): solo, the lobby and the view read Dodge from the boss in focus,
  so a Dodge out of focus would never play. With him in focus it plays as it does at his own turn change. After your move the order goes
  on from whoever moved last.

**Tests:** `several-bosses.test.ts`, "an ultimate that can't wait". It runs the audit's Scholar's mate in every order (Dodge as turn 4
begins, then your move, then the next boss), a mate Ginger's freeze stops (no Dodge), and Wrangler's prepared line-up kept with it
(stubbed).
