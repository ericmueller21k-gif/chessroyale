# 50 v 50: a big majority always wins, the AFK rule, and no chat bubble over the board (Nov 4, 2026)

Eric (Nov 4, playing 50 v 50 on his phone; "the recent changes make it feel much better"):

- "if 85% of people play one move it always picks it, even if it's a blunder… 10 people on white, a 7-2-1 split, the 7
  should always win, but a 6-3-1 could go to the 3."
- "no move at all = default to a random top 5 move, but your penalty is simply you get the lowest score given to a player
  on your team that round; but if you miss more than 3 moves in the game you are removed for being AFK, so people don't
  cleverly abuse AFK if they don't know a move and it's nearing the end."
- The chat bubble over the board ("Luft Lou 👏"): "delete it, chat stays in the chat box below, not above the board, never
  approved that."

## What changed

1. **A big majority always wins** (`crowdSureShare: 0.7` in `CROWD_SETTINGS`; `crowdTopOdds(moves, top, sure)` in
   `core/scoring.ts`). When the most-picked move has at least 70% of the team's real picks, it's played, always (a blunder
   too); below it, the top-3 draw as before (6-3-1: 60 / 30 / 10). The draw still takes its one number from the match's
   random source, so nothing drawn after it moves. A tie for the most is never sure. The reveal's "N% chance" and the odds
   the screens show follow (a sure move shows no chance). DEFAULT 1 (only a unanimous pick): a boss battle and raids keep
   the most popular pick anyway.
2. **The AFK rule** (`CrowdMisses`, `CROWD_MISSES = { defaultFromTop: 5, allowed: 3 }`, `crowdMisses` in `CROWD_SETTINGS`;
   off in raids and every other mode).
   - **The pick made for you:** one of the engine's top 5 moves (`scored`, the judge's numbers, best first) at random. It
     **never counts in the tally** (the director's call: it would sway or dilute the vote): the result keeps `move: null`
     and the pick in `defaultMove`, so the tally, the draw, the team's average, the sure share and brilliance see only real
     picks. It's chosen by the position and the player (`hashPick`), not the match's random source, so a miss moves nothing
     drawn after it (no seed in any test shifted for a miss).
   - **Nobody on the team picked:** today's code played the engine's best move; the brief asks for a random top-5 move,
     so in team turns the team now plays one of the top 5 (from the match's random source; it only happens in a people-only
     lobby, as bots always pick). A final's mover (the team final, the duel) and a boss battle keep today's: the engine's
     best, or the boss's own rule (Dash's flag). Call: a final's one mover isn't "the team", and the boss battle has its
     own out-of-time rules.
   - **The score:** the lowest round score of anyone in the group who picked that move (before a rare find's bonus, which
     only goes to the best), so a miss is never better than the worst real pick. Nobody picked: `missCaps` times the cap
     below zero, as before (there's no lowest). The streak ends, as before. `finalMissLoss` (the boss's strike and the last
     cut's tie-break by raw loss) is unchanged: it isn't a score, and 25 points is already worse than nearly any pick.
   - **The 4th miss in the game removes you** (`misses` on the player, counted all match, finals included;
     `MatchRunner.awayOut`, `RoundReport.away`). It's today's "left the match" path with a new `LeftHow`, `"afk"`: a loss,
     out in the last place still open, the seat to a bot where one takes it (online, `LobbyCore.leaveMatch`, as resigning:
     the loss is recorded at once, `takeLeftResults`); solo, the match stops there, as resigning. They don't come back: the
     old seat's token is told how they left. What they keep: the same as resigning, nothing for that game
     but the loss (on the profile, and in a ranked match it counts for ranking as one).
   - **Bots never:** they always pick, and `awayOut` skips bots (a seat handed to a bot keeps its count but is a bot).
   - **What the player sees:** each miss's reveal line, "Missed: a move was picked for you (1 of 3)" ("Missed: picked for
     you (1 of 3)" under 380 px, so it fits whole at 320); the finals' line "missed (2 of 3)"; the boss final's dock the same
     words. Removed: the results screen's heading "Removed for being away", then "You missed 4 moves. Out in Nth place of
     100." (with "A bot plays your seat." online) and "It counts as a loss."; back to the app later, home's note "You were
     removed from that match for being away (you missed 4 moves): it counted as a loss."
   - **Others:** the game shows no join or leave lines in chat or anywhere (a resign shows only as the seat's new bot name on
     the scoreboard), so a removal shows the same way. Call: no new feed line.
   - **Test switch `?afk=0`** (solo, a lobby you create, and a test pool's PLAY): misses as before Nov 4. For tests that idle
     on purpose (to be cut, or watching the screens for minutes); never for players.
3. **The chat bubble is gone** in every mode: `ChatBubble` (QuickChat.tsx), its render in App.tsx, `MatchChat.bubble`,
   `QUICK_CHAT.bubbleMs`, the pref `chatBubbles` (`brc.chatBubbles`), Settings' "New-message bubble" and the chat options'
   "Show new messages as a bubble while chat is hidden". Chat shows only in its box or tab; the Chat tab counts what's new.
   (Auto chess's meeting bubbles over the pawns are Eric's own design, not this.)

## The FAQ

"How it works" for 50 v 50 says the sure majority and that a miss gets a pick that doesn't count; "Scoring in 50 v 50"
says the miss's score and the removal. Its draw example is now 30 / 15 / 5 (60 / 30 / 10): 45 / 3 / 2 is sure since today.
