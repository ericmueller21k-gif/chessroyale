# The 50 v 50 rework in the runner, server and protocol (Nov 16, 2026)

Step C2 of `notes/designs/crowd-rework.md` (branch `design/crowd-rework`; the rules in core: [2026-11-16-crowd-rework-core.md](2026-11-16-crowd-rework-core.md)).
Eric, Nov 16: "Yeah, the 50v50 rework. We're doing away with the hidden boss on that for now." **Every 50 v 50 plays the rework from
here:** `CROWD_SETTINGS` takes `CROWD_REWORK` (spread in last).

**What changed.**
- **The runner** (`MatchRunner`): `endGameIfOver()` ends the one game by the board's rules (mate, stalemate, repetition, the fifty-move
  rule, insufficient material) or at `crowdMoveLimit` (`crowdLimitReached`), then `finishGame` with `gameWinner()`, which is the
  judge's verdict at the limit (`crowdLimitVerdict`, 75%, from the board's agreed numbers; today's 60% stays for the old endings).
  The lobby and solo call it after each move's reveal and before each deal, **ahead of any cut**: a game over on a cut's move cuts
  nobody. A finished board is never replaced. 50 v 50 never enters a final (no team final, boss final or duel: their code stays,
  unreached, until C4). The 1 v 1 is an ordinary team turn with one player a side, whose pick is played; after the last cut
  `stageComplete` is never true (no more cuts or breaks, whatever a test's `?rounds=` makes its length).
- **Who left** (`PlayerState.leftAt`, the move they left at): set by `retire` (a person out, no bot) and by `handOver` once a move
  has been played (the seat a bot took); `crowdResults()` passes them to `crowdPodium` as `left`, so neither is ever the best player.
- **The protocol, optional fields only:** `results.podium { winner?, best }` (`best` null only when nobody qualifies); each
  `standings` row of the results gains `outAtMove` (a cut's move, or the move they left at; null still in at the end) and `perMove`
  (`matchLoss`, 2 decimals); `NetVote.id` (the vote's id: "pick", "start", "speed"). Old apps ignore them.
- **The server** (`lobby.ts`): the vote's patch (`crowdPick` in the overrides, as any vote's), the game's end, the places in
  finishGame's order (no schema change), the results' new fields. `?format=` under the rework only skips the votes (it has no
  ending to play); a new test switch `?limit=N` sets the move limit (server and solo).
- **The app:** reads the votes with `heldVotes(vote, settings)` (votes.ts: by the message's id, else the settings' `pregameVotes`),
  never `PREGAME_VOTES` by index (`net.ts`, `Vote.tsx`). Only what keeps the screens true: the reveal's chance line by the pick
  mode (`crowdPickOdds`), "1 v 1" for what follows the last cut (top bar, the cut screen's next, the results' row). The rest is C3.

**The director's call (Nov 16): no shared-blunder relief with 4 or fewer picks** (`CROWD_SCORING.sharedMinPicks` 5; raids unset).
At 4 or fewer one pick is a quarter of them (`sharedShare`), so a lone pick counted as a crowd's shared blunder: at 2 a side a
6-point loss counted as 3. Counted over the **real picks** (not the side's size), so a miss never changes how the real picks score:
Eric's AFK rule's tally (`crowd-afk.test.ts`, "the team's average and the tally leave the misses out") holds as it was.

**Calls made here:**
- **A flag fall:** the brief lists it among the ways the game ends, but 50 v 50's clock has none: an empty bank still gets its
  increment, a miss gets a pick made for it, the 4th miss removes the player (the AFK rule), and a side's last seat always goes to
  a bot (`botTakes`), so no side is ever empty. Nothing to add; flagged to the director in the PR (a 1 v 1 that loses on time
  would be a new rule).
- **A seat left before any move** (a bot took it during move 1's thinking) isn't marked: the bot played the whole match.
- **"Out at move" for a leaver** is the board's move number when they left (`clockMove`), as the top bar shows it.
- **The old 50 v 50 kept for its tests:** `CROWD_PRE_REWORK` puts the old settings back over `CROWD_SETTINGS`; the old endings'
  unit tests (team final, duel, the Hidden Boss's final online, a final's premoves) and the FAQ's words use it until C4 retires
  them and C3 rewrites the FAQ. No lobby, test switch or queue sets it.
- **Eric's rule "a big majority always wins"** (Nov 4) ends with the rework (the design he said go to: "today's 70% sure share
  and 60/30/10 odds go"); its guard checks now run on `CROWD_PRE_REWORK` until C4, and `docs/rules/eric.md` says so.
