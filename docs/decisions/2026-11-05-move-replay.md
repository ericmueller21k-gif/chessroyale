# Move replay, its button and the first-time tip (Squads)

Date: Nov 5, 2026. Eric: "Each time you arrive at a board, the moves played on it since you last played it replay
(animated, one after another, each move's from/to shown as it lands), then your free seconds start as usual"; "free
seconds = today's + 0.5 s per move played since you last played (3 moves: +1.5 s)", replay on or off; a tap or a move
skips it; a rewind button by the gear with a dot trail while on; a first-time tip with the gear and the button lit.
Addition (Nov 5): during the replay, who played each move as a name tag over the moved piece, one box size, a long
name smaller, over 12 characters cut with "…".

## What was built

- **The rule** (`packages/chess/src/squads/schedule.ts`, `movesSinceLastPlayed`; `match.ts`, `Duty.freeMs` and
  `Duty.replay`): a duty's free time is the match's free seconds + `replayMsPerMove` × the moves played on its board
  since its player last played there. It is computed where the clock is (`halfDuties`), so the drain (`bankTimeline`,
  each move past its own free time), the chips' windows, the sudden-death deadline (the free time) and the bots' cutoffs
  all use it. The server sends it on each duty (`NetDuty.freeMs`, `replay`); the screen's clock runs from it
  (`dutyFreeMs`). One number in settings: `SQUADS.replaySecondsPerMove` (0.5). The replay's pace:
  `SQUADS_LOBBY.replay` (first move 150 ms in, then one every 450 ms; the last held until the extra time ends).
- **The screen** (`packages/app/src/move-replay.ts`, `components/MoveReplay.tsx`, `screens/SquadsMatch.tsx`): at the
  start of your move on a board you've come back to, a board of its own over the big board steps through the moves
  (from and to marked, the piece sliding, the move's knock), a name tag over each moved piece; the line above the board
  says "Your move · Board 2 · replay 2 of 3"; the free-seconds pill shows the replay icon in place of "free" while the
  extra lasts; your move's panel says "4.5 s free (+1.5 s for 3 moves missed), then your squad's clock runs.".
- **The button** (`ReplayButton`): left of the gear in the match's top line and the votes' top line.
- **The tip** (`ReplayTip`): over the votes (or a match) of a lobby joined from the queue.

## Calls made

1. **"Since you last played it" counts every move on that board** after your last move there, both squads' (your
   opponent's reply included): Relay, once the rotation is round, is 7 moves (+3.5 s); Pairs 3 moves after one turn away
   (+1.5 s, Eric's example). A board you've never played: every move on it so far.
2. **Only when you come back** (your board last turn was another): staying on your board (Pairs' repeated slots, the
   final, Armageddon) adds nothing, as you watched those moves. Turn 1 adds nothing.
3. **Where else:** Squads' Relay and Pairs are the only modes that move you between boards today. Classic (8 boards)
   already replays missed moves on its own settling-in time (`useReplay`, "Replaying the moves you missed"); it's
   frozen until Eric's rework (CLAUDE.md), so its clock is unchanged. Crowd, raids, 1 v 1 and the final are one board.
4. **A pair** shares one move's time: its free time uses the larger of the two partners' counts; the replay shows to
   the one who came back.
5. **Who "you" are is the seat** (a bot playing your seat counts as you), worked out from the schedule (pure arithmetic,
   the same on server and client).
6. **Sudden death:** the time to make a move is the free time, so it grows too ("free time grows to cover it").
7. **Bots** think as before (their pace from the match's free seconds): they don't watch replays, and the e2e and the
   sim keep their timing.
8. **A match stored before this** (in play across the deploy) keeps its clock: `replayMsPerMove` 0 (`upgradeMatch`).
   The protocol's new duty fields are optional (no version bump); an older server's duties read as the free seconds.
9. **The button's setting is per account on this device** (`brc.squads.replay.<user id>`): the app keeps no settings on
   the account (prefs.ts is per device). Default on (`SQUADS_LOBBY.replay.on`). Off: no animation, the board shows the
   position; the extra time stays.
10. **The skip:** a tap anywhere on the board ends the replay at once; the replay is drawn on a board of its own over the
    real one, so the same tap reaches the real board under it (a move can start with it). Squads has no premoves (it
    doesn't opt in), so there's nothing more to skip there. Browsing the moves (« ») also ends it.
11. **The name tag:** the final's pick-name look (blue a teammate, green you, grey an opponent), a fixed box a quarter of
    the board wide; the text is set smaller for names over about 9 letters; over 12, the first 11 and "…". A pair's same
    move: both names ("Ann + Bo"). A forced move, or a move from before this page joined (a reload): no tag.
12. **The tip shows "the first time this account queues"** on the first screen of that lobby with the gear and the
    button: the votes (the waiting room has no gear). Queueing is the solo queue's PLAY or a party's; a test lobby's link
    counts only with the test switch `?replaytip`. Not ticked: shown again on the next queue (once per lobby). Kept per
    account on this device (`brc.squads.tip.<user id>`).
13. **"Turn off animations"** points at the gear's real Animations row (Settings → Board's): in Squads it changes the
    reveals (ghost pieces, or names only). It doesn't shorten the server's reveal times, so the line says "for a calmer
    board: picks show as names only" rather than "quicker play". Animations doesn't turn the replay off (its own button).
14. The cut-outs are rounded boxes a little bigger than each button (circles round two buttons side by side overlapped).
