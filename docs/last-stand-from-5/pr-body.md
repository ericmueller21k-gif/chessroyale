# The God King's Last Stand waits for the crowd's 6th move

Eric, Nov 2: "sometimes it triggers on the first move… always hard set each side five moves in no matter what before it
will even look to make a save… it can literally be disabled until it detects that you've played five moves and then it can
flip on."

## What changed

- `lastStandFromMove: 5` in `packages/core/src/settings.ts` (beside the other Last Stand settings, Eric's words in its
  comment), added to `LastStandSettings` and checked in `lastStandDue` (`packages/core/src/boss.ts`). Every caller gets
  it: the runner's `lastStandFor` (solo and online), `last-stand-sim.ts`, `last-stand-blunders.ts`.
- **The boundary:** at `lastStandFor`, `b.crowdMoves` is the crowd's moves already played in this battle (it starts at 0 in
  every battle, and `applyRound` adds the judged move only after scoring). `lastStandDue` needs `crowdMoves >= 5`: no save
  on the battle's 1st to 5th moves, the 6th (`crowdMoves` 5) is the first he can save, with the bar as before (it still
  falls from move 1: 31.1 with charges on move 6).
- It counts the battle's own moves whatever the opening (Random opening, Freestyle, a battle that picks up a game in
  progress). `?laststand=1` (`forceLastStand`) still forces him on any move.
- FAQ, God King page (`docs/areas/god-king.md`), decision note `docs/decisions/2026-11-02-last-stand-from-move-6.md`.

## Player-visible changes

- No Last Stand on the crowd's first 5 moves of a boss battle; from the 6th as before.
- FAQ, "His save: the Last Stand", new paragraph: "**Not before move 6.** He never steps in on the crowd's first 5 moves of
  the battle: he's ready from its 6th move on. The moves count from the battle's start, however it began (a Random
  opening, Freestyle, or a battle that picks up a game in progress)."
- FAQ: "So it starts at 35 with charges (30 without), is 31.1 (26.1) on move 6, the first he can save, and eases to 18 (13)
  by crowd move 22…" (added the move 6 clause).
- FAQ table headers: "First move, with charges | First move, none" → "Move 6, with charges | Move 6, none" (values now
  move 6's: 31.1 / 26.1 from 40% up; the weak-position rows unchanged).
- FAQ worked example: "On the first move, from a level position, the crowd hangs its queen: … well over 35, so he saves
  it." → "On move 6, … well over 31.1, so he saves it (the same queen hung on move 5 would stand)."

## Changed checks (old → new)

`packages/chess/test/last-stand.test.ts`
- `raid()` helper: settings gain `lastStandFromMove: 0` (its tests are about the save itself from move 1; the rule has its
  own tests).
- "the bar starts at lastStandLoss…": its settings gain `lastStandFromMove: 0`; checks unchanged.
- "Eric's option 3": `lastStandDue(20, 0.25, 0, 3)` true → `(20, 0.25, 5, 3)` true; `(10, 0.25, 0, 3)` false → `(…, 5, …)`
  false; `(19, 0.19, 0, 3)` false → `(…, 5, …)` false; `(10, 0.2, 0, 3)` true → `(…, 5, …)` true; Eric's game 2
  `(72, 0.72, 0, 3)` true → `(72, 0.72, 0, 3)` **false** plus new `(72, 0.72, 5, 3)` true; `(0, 0.6, 0, 3)` false →
  `(…, 5, …)` false; `(0, 0.3, 0, 3)` false → `(…, 5, …)` false.
- "the move he took back doesn't bring the boss's strike closer": the strike just after crowd move 3 → 5;
  `crowdMoves: 3` → `5` after the stand; `due` `[6]` → `[8]`.
- "real blunders, the real judge" (3 cases): "calls for the Last Stand from move 1" → "on the battle's 6th move"
  (`crowdMoves` 5 set first); `bar` `lastStandBar(before, 0, 3)` → `lastStandBar(before, 5, 3)` rounded to 0.1 (as the
  runner reports it).
- New: "not on the crowd's first five moves of the battle (Eric, Nov 2)" (moves 1-5 never, move 6 at its bar, 0 turns it
  off) and "the first five moves in a match" (the battle's 1st move at game move 6 stands, the 5th stands, the 6th is saved
  with `atMove: 6`, `?laststand=1` still forces move 1).

`packages/chess/test/king-save-altered.test.ts`: `battle()` settings gain `lastStandFromMove: 0` (saves on the battle's
first move, about altered boards); checks unchanged.

`packages/server/test/lobby.test.ts`, "the God King's Last Stand online": `setup({ ...RAID_SETTINGS })` →
`setup({ ...RAID_SETTINGS, lastStandFromMove: 0 })`; checks unchanged.

`e2e/king-save-altered.spec.ts`: the in-page settings override adds `lastStandFromMove: 0` (the hoops can be out before
move 6); checks unchanged.

`packages/app/test/faq.test.ts`: new "the Last Stand's first five moves" (the paragraph, the move 6 bar and table, the
worked example; `lastStandFromMove: 3` and `0` variants). Existing checks unchanged.

No check guarding a rule in `docs/rules/eric.md` changed. Other e2e Last Stand specs use `?laststand=1` (forced, unaffected)
or `?laststand=0`.

## Tests run

`packages/chess/test/last-stand.test.ts` (21 passed, real Stockfish), `packages/chess/test/king-save-altered.test.ts` (29),
`packages/server/test/lobby.test.ts -t "Last Stand online"`, `packages/app/test/faq.test.ts` (52), `npm run typecheck`,
e2e `king-save-altered.spec.ts` (phone) under the shared lock.

## Lane

Targeted (a rules change in `packages/core`; CI's e2e run takes the whole suite since `packages/core` is shared).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
