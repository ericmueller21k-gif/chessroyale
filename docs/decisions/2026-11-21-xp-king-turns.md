# XP: a turn the God King played for you is one of your moves (Nov 21, 2026)

**Eric (Nov 21, screenshot):** a Battle Tower floor won by mate on move 12 ("Move 12 of 12 · Qxd8#"), and the end screen said
"No XP: the game ended before move 10." He had called the God King on several turns. "This is a massive bug. We got to fix this
ASAP"; "imagine a real player doing this, and you don't get any experience."

**The cause.** A turn you call the God King to play is kept as an abstained turn (runner.ts `resolveBoard`: `move: null`,
`abstained: true`). The device's count for XP (App.tsx: `solo.moves.filter((m) => m.move !== null)`) and the match room's online
(lobby.ts `lock`: only a pick that went in) counted picks alone, so each call took one move off. 12 turns with 3 calls: 9, under 10.

**The fix.** "Your own moves" are now the turns you took:
- On a device: core's `ownMoves` (xp.ts) counts a pick, a turn you called the God King to play (`MoveRecord.abstained`, copied by
  `moveRecordFrom`), and a turn Hollow's dark ended at your last wrong try (`MoveRecord.darkOut`, solo.ts). App.tsx sends it to
  `/api/results` (Boss alone, solo raids, tower floors); a kept tower floor keeps the records, so a rejoin counts the same. The
  town challenge's "in 12 moves" uses it too (boss-tokens.ts `battleOutcome`).
- Online (raids, 50 v 50 has no God King, Boss Battle and tower parties): the match room's `lock` counts a call and the dark's end
  as it does a pick (`r.picked`), so XP's minimum, the daily reward's 15, boss tokens' 10 and the Welcome Crate all follow.
- Unchanged: the 10-move rule, and the trust rules (solo: the device's word can only lower XP, the server's own clock; online: the
  room's own count).

**The calls** ("a turn you took counts"):
- **A God King call** counts whether or not he came (in a raid he needs more than half the crowd): calling him was your turn.
- **Hollow's dark ending your turn** (a crowd's 5th wrong try) counts: you were playing it, trying until it ended. It's still scored
  as a missed move, as before. In Boss alone the dark's forced move is played as your move and already counted; the blackout ends
  the battle.
- **The XP time online** runs to your last turn taken, a call or the dark's end included (`pickedAt`), as it did to your last pick.
- **Already counted, no change:** the Last Stand (the pick he took back and the re-pick: both yours, both scored; never on a tower
  floor), Folio's Revision (your crossed-out pick went in and was scored), the power-up's engine move (played as your pick).
- **Not counted, no change:** a turn you let run out (Crowd 50 v 50's pick made for a miss included), and Boingo's funhouse (his
  move for you, unscored: the boss took that turn, you didn't). The Hidden Boss: a call never comes, your pick goes on.
- **No change needed:** the tower floor's free leave (before your 2nd move) reads the board's crowd moves, which already count the
  King's; ranked coins' minimum (1 v 1, no God King); Squads (no God King).
- A tower floor kept before this change keeps its calls without the mark: those calls don't count. Only floors under way at the
  deploy.
