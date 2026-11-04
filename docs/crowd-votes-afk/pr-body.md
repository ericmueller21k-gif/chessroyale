# 50 v 50: a big majority always wins, the AFK rule, and no chat bubble over the board

Lane: **full-e2e** (a rules change: add the `full-e2e` label). Decision: `docs/decisions/2026-11-04-crowd-votes-afk.md`.
New standing rules with their guards in `docs/rules/eric.md` (A match): the sure majority, the AFK rule, chat never over the board.

## What changed

1. **A big majority always wins** (Eric, Nov 4: "10 people on white, a 7-2-1 split, the 7 should always win, but a 6-3-1 could go
   to the 3"). New `crowdSureShare: 0.7` in `CROWD_SETTINGS`: when the most-picked move has 70% or more of the team's real picks it's
   played, always (a blunder too); below it, the top-3 draw as before (`crowdTopOdds(moves, top, sure)`, `drawMove`). Real picks
   only. Ties as before (a tie for the most is never sure). Still one draw from the random source, so nothing after it moves.
2. **The AFK rule** (`CrowdMisses`, `CROWD_MISSES = { defaultFromTop: 5, allowed: 3 }`, 50 v 50 only):
   - A miss gets a pick made for it: one of the engine's top 5 at random (by position and player, `hashPick`, so the match's random
     source doesn't move). It **never counts in the tally** (`move` stays null; the pick is `defaultMove`).
   - Nobody on the team picked: the team plays a random top-5 move (today it played the engine's best; team turns only, a final's
     mover and boss battles as before).
   - The score: the lowest round score of any teammate who picked (replaces `missCaps` × cap for 50 v 50; nobody picked: as before).
   - The 4th miss in the game: removed for being away, today's "left the match" path with a new `LeftHow` `"afk"` (a loss, out in
     the last place still open, a bot in the seat where one takes it; solo the match stops, as resigning). Bots never.
   - Online: `RoundReport.away` → `LobbyCore.leaveMatch(h, "afk")` in `applyScores`; `NetPick.defaultMove`/`missNo`,
     `NetFinal.last.missNo` (optional fields).
   - Test switch `?afk=0` (solo, a lobby you create, a test pool's PLAY): misses as before, for tests that idle on purpose.
3. **The new-message chat bubble is gone** in every mode (Eric: "delete it, chat stays in the chat box below, not above the board,
   never approved that"): `ChatBubble`, `MatchChat.bubble`, `QUICK_CHAT.bubbleMs`, the pref `brc.chatBubbles`, and its two switches.

## Every player-visible change and new text

- A 70%+ majority is always played (and its reveal shows no "% chance").
- A 50 v 50 miss's reveal line (was "no move · best Nf3"): **"Missed: a move was picked for you (1 of 3)"**; under 380 px
  **"Missed: picked for you (1 of 3)"**. The boss final's dock says the same (was "No move from you."). The finals' last-move line:
  **"missed (2 of 3)"** (was "missed").
- A miss's score: your team's lowest that move (was −2 × the cap, e.g. −4.00 before the first cut).
- Removed: results heading **"Removed for being away"**, then **"You missed 4 moves. Out in 37th place of 100."** (online also
  " A bot plays your seat."), then the existing "It counts as a loss." Home's note if you come back: **"You were removed from that
  match for being away (you missed 4 moves): it counted as a loss."**
- People-only lobbies: when nobody on a team picks, a random top-5 move is played (was the engine's best).
- Gone: the dark bubble over the board; Settings → Quick chat's **"New-message bubble"** switch ("On a phone, while chat is hidden,
  the newest message shows for a moment under the top bar (never over the board)."); the chat options' **"Show new messages as a
  bubble while chat is hidden"**.
- FAQ, The modes → 50 v 50: the draw example is now "if 30 pick one move, 15 another and 5 a third, they're played 60%, 30% and 10%
  of the time" (45 / 3 / 2 is sure now); new: "**A big majority always wins:** a move 70% or more of the team picked is always
  played, even a blunder (of 10 picks, 7 on one move always play it; 6 on it can still lose to another). Pick nothing and a move is
  picked for you, one of the engine's top 5, but it doesn't count in the vote (a missed move)."
- FAQ, Scoring in 50 v 50, "A missed move" (was "scores 2 times the limit below zero (−4 before the first cut)"): "(no pick in time):
  a move is picked for you, one of the engine's top 5 at random, but it never counts in your team's vote. You score the lowest score
  anyone on your team who picked got that move, so missing is never better than the worst real pick (if nobody on your team picked,
  2 times the limit below zero). The reveal tells you each time ("Missed: a move was picked for you (1 of 3)"). **Miss more than 3
  moves in a game and you're removed for being away**: it counts as resigning, a loss, out in the last place still open, and a bot
  takes your seat."
- Others see a removed player's seat turn into a bot on the scoreboard, as for a resign (the game shows no leave lines in chat).

Stills (phone): `docs/crowd-votes-afk/miss-line-phone.png` (the 3rd miss's line), `docs/crowd-votes-afk/removed-phone.png`.

## Changed checks (old → new); none guards a rule in docs/rules/eric.md

- `e2e/chat.spec.ts`, "quick chat picks in the profile: … exactly those lines in a match": the scoreboard part. Old: a new line shows
  as `.qbubble` under the top bar, contains "GG", doesn't overlap the board, `pointer-events: none`. New: no `.qbubble`, and nothing
  of the new line is added anywhere outside the box under the board (a MutationObserver from before it's sent); the move still lands
  and the Chat tab counts it as before. URL `?debug&pool=chat` → `?debug&pool=chat&afk=0` (the computer never picks).
- `e2e/chat.spec.ts`, "a name's menu and the chat options stay open…": `pool=chatmenu` → `pool=chatmenu&afk=0`.
- `e2e/panel.spec.ts`, "the panel under the board is never empty…" and "the chat tab's Team / All switch…": `pool=panel` /
  `pool=switch` → `+&afk=0` (the player never picks for minutes).
- `e2e/crowd.spec.ts`, "online, once you're out, a later cut says so…": URL `+&afk=0` (it relies on the old miss score to be cut).
- `packages/app/test/chat.test.ts`: "while a panel is on screen nothing is unread and no bubble shows; hidden, the newest shows for a
  moment" → "while a panel is on screen nothing is unread; hidden, a new line counts as unread (no bubble: Eric, Nov 4)": the
  `bubble()` checks → `"bubble" in chat` is false; the unread checks kept.
- `packages/core/test/crowd-scoring.test.ts`, "a miss": now run with `crowdMisses: null` (raids, `?afk=0`), same numbers; title says so.
- `packages/chess/test/crowd.test.ts`: "50 v 50 team final…" seed 1 → 5 (the sure majority changes every seed's game; seed 1 kept 4
  over the plan at a cut, the check allows 3); "50 v 50 boss final…" seed 4 → 58 (a seed whose cuts take exactly the plan, as the
  check needs).
- `packages/server/test/lobby.test.ts`, "bots chat a little…": `chatLobby(..., { crowdMisses: null })` (nobody picks, on purpose).
- `packages/server/test/crowd-hidden-boss.test.ts`, "his bullet clock online…": `crowdFinal({ ..., crowdMisses: null })` (nobody picks).

## Added checks

- `packages/core/test/crowd-afk.test.ts`: 7-2-1 → always the 7 (2000 seeds), 85% → always, 6-3-1 → the 3 sometimes, ties as
  before, the share counts real picks only; a miss scores the team's lowest, nobody picked as before, misses never in the average
  or tally.
- `packages/chess/test/crowd.test.ts`: "50 v 50's misses…" (the pick from the top 5, `missNo`, the lowest score, never in the
  tally, the 4th → `away`, bots never; off with `crowdMisses: null`) and "nobody on the team picked…" (a top-5 move, not always the best).
- `packages/server/test/resign.test.ts`: "50 v 50's AFK rule…" online: 1, 2, 3 of 3 on the reveals, the 4th → "resigned" `how: "afk"`,
  a bot in the seat, the loss recorded, the old token told how; someone who picks plays on.
- `e2e/crowd.spec.ts`: "50 v 50's AFK rule (Eric, Nov 4): …" (phone): each miss's line whole at 390 and 320 px, the votes line counts
  only real picks (team − 1), your score the team's lowest, then "Removed for being away" and "You missed 4 moves. …".

Run locally (under the lock): typecheck; the unit files above; e2e: the new AFK test, crowd "once you're out", chat.spec's two
tests, panel's two tests: all pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
