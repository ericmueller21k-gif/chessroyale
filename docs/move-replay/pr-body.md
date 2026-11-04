# Squads: move replay when you come back to a board, its toggle, and a first-time tip

**Lane: full (add the `full-e2e` label).** The clock rule changes, and the shared client-server protocol's duty gains two
optional fields (`NetDuty.freeMs`, `replay`).

## What changed

- **The rule (server and client agree; the clock is the server's).** Coming back to a board (Relay's rotation, Pairs'
  slots), a move's free seconds = the match's free seconds + **0.5 s for each move played on that board since you last
  played it** (`SQUADS.replaySecondsPerMove: 0.5`), whether the replay is shown or not. Computed where the clock is
  (`halfDuties` → `Duty.freeMs`, `Duty.replay`; `movesSinceLastPlayed` in `schedule.ts`); the bank's drain
  (`bankTimeline`: each move past its own free time), Time chips' windows and the sudden-death deadline use it. Relay once
  the rotation is round: 7 moves (+3.5 s). Pairs after one turn away: 3 moves (+1.5 s). Staying on your board adds
  nothing. A match stored before this keeps its clock (`replayMsPerMove` 0).
- **The replay.** At the start of your move on a board you've come back to, the missed moves land one by one (from and
  to marked, the piece sliding, its knock) within the extra time: 150 ms in, one every 450 ms, the last held a beat; then
  the board as it stands and the free seconds as usual. **A name tag over each moved piece says who played it** (teammate
  blue, you green, opponent grey; one box size; long names set smaller; over 12 characters cut with "…"). A tap on the
  board skips it at once, and the same tap reaches the board underneath, so a move can start with it.
- **The replay button**, left of the gear in Squads' match top line and the votes' top line: a drawn rewind icon; on, three
  dots chase slowly round its edge; off, the plain icon. Saved per account on this device (the app keeps no account
  settings; `brc.squads.replay.<user id>`). Off: no animation, the board just shows the position; the extra time stays.
- **The first-time tip**, the first time an account queues for Squads (solo PLAY or a party's), over that lobby's votes:
  the screen dims, the replay button and the gear stay lit (rounded cut-outs with a ring), a small box explains both,
  "Don't show this again" and OK. Not ticked: shown again on the next queue. (`?replaytip` makes a test lobby's link count
  as queueing.)
- **"Turn off animations"** points at the gear's real Animations row (the reveals' ghost pieces, or names only).
- FAQ (Squads' clocks) gains the move replay paragraph. Area page, decision, Eric's rules updated.

Decision: `docs/decisions/2026-11-05-move-replay.md` (14 calls). Stills: `docs/move-replay/` (the tip, the button on and
off, a replay mid-way with a name tag; phone and computer).

## Every player-visible change and new text

- The replay button (aria "Move replay: on" / "Move replay: off"; title "Move replay is on: coming back to a board, the
  moves you missed play back first" / "Move replay is off").
- During a replay, the line above the board: "Your move · Board N · replay K of M".
- The free-seconds pill: the replay icon in place of the word "free" while the replay's extra time lasts ("⟲ 3.7", then
  "free 2.0").
- Your Relay move's panel: "4.5 s free (+1.5 s for 3 moves missed), then your squad's clock runs." (was "N s free, then
  your squad's clock runs.", which still shows with nothing missed; the number now keeps a decimal when it has one).
- The pill's title: "Free seconds: the team clock runs after them (coming back to a board, 0.5 s more for each move you
  missed)".
- Name tags over replayed moves: the player's name ("You" for yours; a pair's same move "Ann + Bo"), 12 characters at most
  ("Christopher…").
- The tip: title "Two quick settings"; "Move replay is on: when the rotation brings you back to a board, the moves you
  missed play back first, and you get a little extra time for them. Tap [replay icon] to turn it off."; "Tap [gear] to
  turn off Animations for a calmer board: picks show as names only."; "Don't show this again"; "OK".
- FAQ, Squads' clocks, new last part: "**Move replay:** when the rotation brings you back to a board (Relay, Pairs), the
  moves played there since you last played it play back first, and your free seconds grow by 0.5 s for each of them (3
  moves: +1.5 s), so watching them never costs your squad time. A tap on the board skips the replay; the replay button by
  the gear turns it off (the extra time stays)."
- The votes' top line has one more button (the replay button), so a long vote title truncates a little sooner on a phone.

## Changed checks (old → new)

- `packages/chess/test/squads-final.test.ts`, "on a squad's move its whole squad picks, from move 1…": the two
  `halfDuties(...).duties` `toEqual`s, old `{ board, side, role, players, deadlineMs: CEILING }` → new the same plus
  `freeMs: DELAY, replay: [0, 0, 0, 0]` (a duty now carries its free time and each player's moves to replay). Not a guard
  in `docs/rules/eric.md`.
- No other check changed or removed. `e2e/areas.json`: the Squads area gains `move-replay.ts`, `MoveReplay.tsx` and
  `e2e/squads-replay.spec.ts`.

## New checks

- `packages/chess/test/squads-replay.test.ts` (8): the setting; Relay's and Pairs' counts; each duty's free time; the
  drain past the larger free time; a pair's shared free time; sudden death; a stored match.
- `packages/app/test/move-replay.test.ts` (6): the frames in order with who played each; the pace inside the extra time and
  the end; who played from a half's events; the tag's words (cut at 12 with "…"); the screen's clock from the duty's free
  time; the replay button off changes nothing on the clock.
- `e2e/squads-replay.spec.ts` (2, phone and computer): Relay replay then clock, tags one size with the long name smaller and
  cut, a tap skips and starts the move, off: no replay and the same free time, the trail only while on; the first-time
  tip (dim, both lit, the box whole on screen), back until "Don't show this again" is ticked.
- New rules in `docs/rules/eric.md` ("Squads: move replay (Eric, Nov 5)") with these as guards.

Locally: typecheck, the Squads unit tests (chess, server, app), the FAQ and ci-select tests, and `e2e/squads-replay.spec.ts`
on both projects passed. The rest of the Squads e2e is left to CI.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
