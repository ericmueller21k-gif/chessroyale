# Squads: Relay on 3 boards, and a cleaner match screen

**Lane: full e2e** (`full-e2e` label): the rules change, and so do the stored matches (a lobby in play across the
deploy finishes on 4 boards). Decision note: `docs/decisions/2026-11-05-squads-three-boards.md`. Stills:
`docs/squads-three-boards/` (phone 390 × 844 with the browser bar, computer 1440 × 900).

## What changed

**The rules** (`packages/chess/src/squads/`):
- **Relay is 3 boards** (`SQUADS.boards.relay: 3`); squads stay 4. **The ring** (`schedule.ts`: `relayRing`,
  `relaySeat`, `relayBoardOf`, `relayMovesOf`):
  - A squad's moves are numbered in play order, and move k goes to seat k mod 4.
  - Seats 1-3 start at the boards. Seat 4 waits and takes the first board to come free; a tie within a half goes by the
    ring's order.
  - Each of your moves is one board along from your last. One seat a squad sits out each turn. Every place is fixed.
  - Colors: every player plays each board once every three of their moves. So each gets their squad's split (2:1) and
    never 3 of a color running.
- **Best 2 of 3.** A match ends as soon as the other squad can't catch up, even by winning every board left. That is
  exactly "more than half the points": each finished board shares out one point.
- **The tie** (rounds 1 and 2; Eric's to change): first, more boards drawn as Black (new reason `black_draws`); then
  more team bank left; then the seeded coin.
- **Random openings:** board 3 gets its own opening.
- **Mercenary:** Relay's `roundScale` is ×4/3, and a stored 4-board match keeps ×1. Nothing else changed in Mercenary
  (Eric: to be revisited).
- **Stored matches:** a Relay match on 4 boards finishes on 4, with the old rotation and the old coin scale.

**The server:**
- The first pregame vote opens `SQUADS.firstVoteDelaySeconds` (3) after the full lobby shows. Its timer and the bots'
  votes wait too.
- A test lobby's `seat=white`: on 3 boards the opener could be the squad's waiting seat, so their squad's seats now
  start with them.

**The match screen** (`SquadsMatch.tsx`, `SquadsParts.tsx`, `MoveReplay.tsx`, `move-replay.ts`, `squads-view.ts`):
- **Mini boards:** 3 a match. A finished board gets a border and a check mark in the winning squad's color; a drawn board
  gets a neutral border and "½". No graying.
- **Test-only tools:** "Next round" is a tiny icon hard left. On a phone's Relay, Cheat lines is a tiny icon beside it.
- **The replay button:**
  - It has no box. A tap steps off (grayed) → last 2 → all → off. The stored on/off reads as all/off; a first match
    starts off.
  - Replay plays as your move on a board starts. It doesn't play if you were viewing that board when both of its last two
    moves landed.
- **Quick board jump** is in the gear's list and in Settings → Squads. The switch and its line under the board are gone.
- **Under the board:** only the move arrows and the turn order.
  - The turn order is one queue for the board on screen: all 8 players in the order they'll move there.
  - Your row says "Your turn · play now" or "Waiting for N players". A row's tap shows that position.
  - A phone shows 4 rows and opens all 8 over the board. A computer shows all 8.
  - "Back to my board", the "Your move" box and the rules line are removed.
- **Nothing cut off at the bottom** with the browser bar, at 390 × 664, 393 × 659, 428 × 746 and 360 × 560.
- **Coach marks:** three, in place of the replay tip. The last one has "Don't show these again".
- **The countdown tick** sounds only when the real bank runs out, never in the free seconds.

**Docs and reports:**
- FAQ: Relay, the turn order, Quick board jump, the replay settings, the tick.
- `docs/areas/squads.md`.
- `docs/rules/eric.md`, for the replay and coach-mark rules Eric changed (see the guards below).
- `reports/squads-sim.md`, with a section comparing 3 boards against 4.

## Player-visible changes and new text

- "Your turn · play now"; "Waiting for 1 player" / "Waiting for N players" (the turn order).
- The coach marks:
  - "Tap here for settings, like Quick board jump."
  - "Tap to replay moves: the last 2, all of them, or off."
  - "Tap a board to watch it. Tap yours to come back."
  - "1 of 3", "2 of 3", "Don't show these again", "OK".
- "Quick board jump" (was "Jump to my next board"). Its line: "On: once you've moved in Relay, you go straight to the
  board you play next, to study it while you wait. Off: you stay on your board until the game moves you."
- Replay button labels: "Move replay: off / the last 2 moves / all moves since you last played. Tap for …".
- Turn order controls: "Show all 8" / "Show the next 4". Test only: "Next round (test)", "Cheat lines (test)".
- Relay's intro line: "Your squad moves in turn, each move one board along; one of you waits to slot in. Best 2 of 3
  boards."
- "Their move here" (was "Their move · you play next half").
- Gone:
  - "Back to my board".
  - The "Your move" box in Relay.
  - "Each turn you make one move, one board along." under the board.
  - The replay tip ("Two quick settings", "Don't show this again").
- The first vote opens 3 s later. The tick no longer sounds during the free seconds.

## Changed checks, old → new

**Eric's guarded rules (`docs/rules/eric.md`, "Squads: move replay")**: Eric asked for these changes in this brief. The
rule text is updated to match.
- `packages/app/test/move-replay.test.ts`: "turning the replay off changes nothing on the clock" → "the replay button's
  setting changes nothing on the clock" (all three settings).
- `e2e/squads-replay.spec.ts`:
  - "Relay: coming back to a board, the moves you missed replay…" → "Relay: the replay button steps off, the last 2, all…".
    The button now starts off; the check is the cycle and its speeds, then all, then the last 2 ("of 2"), then off.
  - New: "Relay with Quick board jump…".
- `e2e/squads-replay.spec.ts` "the first-time tip…" → removed. It's replaced by `e2e/squads-three-boards.spec.ts` "the
  coach marks…".

**Other checks:**
- `packages/chess/test/squads-match.test.ts`:
  - Random openings: [0, 1, 0, 1] with pairs 1-2, 3-4 → [0, 1, 0], boards 1-2 shared and board 3 on its own.
  - Carry-over: the movers counted per side (2 and 1) instead of 2 and 2.
- `packages/chess/test/squads-mercenary.test.ts`:
  - Relay helper on 3 boards.
  - `roundScale[0]` 1 → 4/3.
  - Capture and board coins at ×4/3; the board-coin check now uses Pairs' ×2.
  - The breather-era drain `[2×, 2×]` → `[2×, 1×]`.
- `packages/chess/test/squads-lobby.test.ts`: `relayBoardOf` non-null assertions; the test still covers 4 boards.
- `packages/server/test/squads-lobby.test.ts`:
  - Round 1 matches have `SQUADS.boards.relay` boards (was 4).
  - First-half duties per side are 2 or 1 (was 2). The lone mover's late choice comes at 7 s (one move drains half as fast).
  - The tie check: draws as Black first.
  - "a full lobby of bots plays the whole bracket": the "bots used some same-move tokens" assertion moved to a new
    deterministic test, "bots use a same-move token on an only move" (a Pairs lobby from a hanging queen, strong bots).
- `packages/server/test/squads-mercenary-lobby.test.ts`: "a whole bot lobby in Mercenary": the "the bots tapped some
  chips" assertion moved to a new deterministic test, "bots tap a Time chip on a move that needs time…". Its banks are
  set to sudden death; with full banks there are no taps, and never by a squad of people.
- **Seeds:** while getting green I first changed the two whole-lobby seeds (11 → 12, 13 → 3), then reverted them. Both are
  back to 11 and 13. The two random-outcome assertions above are now deterministic tests.
  - Why they failed: on 3 boards those bot lobbies simply went differently.
  - In one, no Pairs bot pair met an only move. In the other, no bot squad's bank went under 20 s.
  - The sim doesn't show 3 boards draining banks less in general (see below).
  - Mercenary is to be revisited (Eric).
- `packages/server/test/squads-v2-lobby.test.ts` "a test lobby can start from a position…": a new loop checks that
  in Relay, too, the opener moves in the first half for every seed.
- `packages/server/test/squads-watching.test.ts`: board 3 → 2; the burst's boards `% 4` → `% 3`; the out-of-range board
  4 → 3.
- **Five server specs:** `FRONT_DOOR.fillShowMs` → `fillShowMs + SQUADS.firstVoteDelaySeconds × 1000` (the 3 s first-vote
  wait).
- `packages/app/test/faq.test.ts`: "Jump to my next board (… under the board)" → "Quick board jump (… in the gear's list
  and Settings)"; a new check on Relay's text.
- `e2e/squads-play.spec.ts` "Relay (a test lobby)…":
  - 16 tiny boards → 12.
  - `.sq-duty strong "You played"` → the turn order's `.sq-to-row.you.lit`, which goes once you've moved.
  - "Back to my board" → a tap on `button.sq-tiny.is-you`.
  - The coordinates check no longer expects the other color on your next board (3 boards: W, W, B).
- `e2e/squads-watch.spec.ts`:
  - The "Jump to my next board" switch and its (i) → the gear's "Quick board jump" row (`aria-checked`).
  - "Back to my board" → a tap on your tiny board.
  - The watcher's other board `% 4` → `% 3`.
- `e2e/squads-test-tools.spec.ts`:
  - On a phone's Relay, Cheat lines is the icon: grayed after your move (was gone), with no lines list.
  - The non-test player's `.sq-duty.move` → `.sq-to-row.you.lit`.
- New: `packages/chess/test/squads-three-boards.test.ts` (16 checks):
  - The ring: every place fixed, the waiting player slotting in, one mover per squad move, the color balance.
  - 2 of 3 and the clinch; the tie order; an old 4-board match finishing on 4; the coin scale; the drain.
- New unit checks in `packages/app/test/move-replay.test.ts`:
  - The replay settings, and when replay is skipped (watched both last moves → none; arrived after the teammate's move →
    replay; arrived as the turn began → replay).
  - No tick during the free seconds.
  - The coach marks' order and "Don't show these again".
- New unit checks in `packages/app/test/squads-view.test.ts`: the board queue, your row's words, the folded rows.
- New: `e2e/squads-three-boards.spec.ts`, phone and computer:
  - A 3-board Relay plays to a result, with the mini boards checked.
  - The queue: its size, the mover lit, your place, a row's tap.
  - The coach marks run once.
  - Nothing below the bottom edge at the phone sizes.
  - Added to `e2e/areas.json` (Squads).

## How the lobby's length moved (`reports/squads-sim.md`, Classic, 108 lobbies)

Same code, with Relay on 3 boards against 4 (median lobby, then 90th percentile):

| Clock | Median lobby, 3 boards | Median, 4 boards | 90th percentile, 3 | 90th percentile, 4 |
| --- | --- | --- | --- | --- |
| Bullet | 31.7 | 34.1 | 37.3 | 43.9 |
| Blitz | 39.4 | 42.7 | 50.2 | 53.4 |
| Rapid | 45.7 | 44.4 | 54.5 | 52.6 |

- **Relay matches** are 1-2 minutes shorter: 6.8 / 10.4 / 12.2 min, against 8.4 / 12.2 / 13.3.
- **Bank after Relay** (round 1 winners, faster / slower): Bullet 100.5 / 112.2 s against 113.7 / 123.2; Blitz 154.9 /
  152.6 against 153.3 / 158.1; Rapid 181.8 / 167.4 against 165.2 / 160.3.
- **Sudden death:** no squad reaches it on either board count.
  - The committed report, from before move replay's free time, had 21-31%. Its lobby lengths (26.9 / 33.5 / 35.9) are
    not comparable.
- **The side effect:** the team clocks barely move. Banks after Relay are within about ±15 s.
- **Level Relays** are rare (about 1%) and are always settled by draws as Black. Three boards share an odd number of
  points, so a level score always includes a draw.
  - All three drawn always goes to side 1, which is Black on two boards. **For Eric to know.**

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
