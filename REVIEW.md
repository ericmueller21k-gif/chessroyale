# Review: PR #837, "Jefferson's Roman candle: char first, then gone"

This is the boss lane's one quick review pass. It was read-only on the PR's code (`git diff origin/main...origin/claude/grex-char`, head `2eb929f`).

What I ran:
- `npm run typecheck`: clean.
- `packages/chess/test/grex.test.ts` and `packages/app/test/grex.test.ts`: 64/64 pass.
- A throwaway vitest scratch (deleted afterwards) on the rule functions, with these results:
  - First candle hit: the piece is charred, `n: 1`, nothing is emptied, and `fireShows` is true.
  - Second hit: the piece burns (`hits: 2`), its mark is dropped, and `fireBurns` lists the tile only once the piece is charred.
  - A charred piece pinned to its king: the tile fizzles and the piece stays charred (`n` stays 1).
  - The sparkler still burns at once and leaves no mark.
  - A charred piece stepping onto an empty candle tile that is ablaze burns.
  - Marks follow castling (h1 to f1), promotion (a7 pawn to a8 queen) and are dropped on capture (including en passant).

## What holds up

- **The rule.** `charSquares`, `fireAfterMove` and `burnsAt` match Eric's words. The king is never charred. The fizzle guard still applies through `burnOutcome`, which only gets the squares that burn. His own pieces are never affected, because `charSquares` checks that the piece is the crowd's. `candleHitsToBurn: 1` gives back the old candle.
- **Marks follow their pieces.** They reuse `followSplats`: the move, castling's rook, promotion's new kind, and captures, en passant included. `trackChars` runs before the fire in `afterCrowdMove`, after his move (`afterBossMove`), and after another boss's move on a shared floor (`followMove`). `wearOff` cleans up a mark whose piece is gone.
- **The judge.** `fireBurns` replaces `ablaze` everywhere the judge, the bots or a `ScoreJob.burn` reads it: `runner.fireBurn`, the three `lobby.ts` jobs, and `GREX.judge`. Nothing still reads `ablaze` for scoring. Not counting a charred piece that steps onto an empty candle tile is lenient, and the decision note records that.
- **Solo and online stay in step.** The boss's move waits for a char too, through one shared function: `fireShows` in both `solo.ts:1151` and `lobby.ts:2312`. The `charred` view goes through the generic `BossRules.view`, so a snapshot or a rejoin carries it with the rest of the power state. No per-field handling was needed, the same as Boingo's splats.
- **`battleDecor` and Boingo.**
  - On the boss screen and on the crowd's reveal screen, Boingo's splats render exactly as before (`partOf(boss, "clown")` returns the boss itself for a single boss).
  - Your-move screen: the splats now also follow your move while it is scored, through `pending`. That's an improvement, not a regression.
  - With both bosses on one floor, `joinDecor` merges the classes and children correctly.

## Findings

### 1. Important: on the crowd's reveal screen, char marks show as they will be after the fire, before the fire happens

`packages/app/src/screens/Crowd.tsx:623` (`decor={battleDecor(match.boss)}`).

`CrowdReveal` draws the position before the move, then after the move, while the ghosts count in. But `match.boss` already holds the state after the fire:
- Online, `onReveal` calls `setBoss(m.boss)` (`net.ts:1021`).
- In solo, `get boss()` returns the live runner, and the runner ran `afterCrowdMove` when it finished the round.

In a 50 v 50 raid, every candle hit then looks wrong for the length of the reveal:

- **(a) The char shows early.** A pawn left on a candle tile that is ablaze is drawn charred during the whole reveal, seconds before the boss screen plays its fire (`FireBurn`). The moment is spoiled.
- **(b) A piece about to burn flickers.** Take a charred knight left on a candle tile on its second hit:
  - `fireAfterMove` drops its mark (it is in `emptied`), so the reveal draws it as a plain knight.
  - The boss screen then draws it charred again while it burns (`grexDecor` adds back burnt pieces with `hits > 1` until `BURN.goneAt`).
  - The sequence the player sees is charred, then plain, then charred, then gone.
- **(c) A charred piece that moves loses its look before it lands.** Its mark has already moved to the destination square, so until `played` the piece on its starting square is drawn plain.

**Suggested fix:** give `CrowdReveal` the decor as it was before the fire. Pass `battleDecor` this turn's `burnt` events (`b.turn === boss.crowdMoves`), plus a flag that tells `grexDecor` to:
- leave out squares with `b.charred` this turn (at `candleHitsToBurn` 2 that's every `hits === 1`);
- keep `b.piece` events with `hits > 1`;
- before `played`, move a mark on `to(playedMove)` back to `from(playedMove)`.

As a check, add one assertion to `e2e/grex.spec.ts`: no `piece.pw-charred` on the reveal for the square charred that turn.

### 2. Minor: on the boss screen, a newly charred piece wears the look from the first frame of the burn

`packages/app/src/components/Grex.tsx`, in `grexDecor`.

The doc comment says a piece charred by this move's fire turns charred "as its tile's flames start to die". The code doesn't hold it back: the new mark is already in `p.charred`, so the look appears the moment the burn starts, under fresh flames.

**Suggested fix:** while `now < since + BURN.goneAt`, filter out squares that have `b.charred` in `burnt`. That's the same window already used to keep a burning piece's look, mirrored. Alternatively, change the comment to match the code.

### 3. Minor: on a shared floor, another boss's power that moves a crowd piece outside a move leaves the char mark behind

`packages/chess/src/bosses/grex.ts`: `GREX` has no `followBoard`.

Examples of such powers are Wrangler's drag or pull, Smudgy's swap or Repaint, and Folio's Revision rewinding the board. After one of them, the mark stays on the old square.

`wearOff` only drops a mark when that square no longer holds a crowd piece of the marked kind. So:
- a different pawn that ends up on the square inherits the char, and is burnt on its first candle hit;
- the piece that was moved loses its char.

This only matters if Jefferson shares a floor with such a boss, and Boingo's splats have the same gap.

**Suggested fix:** if Jefferson can be drawn onto such floors, add `followBoard` the way Sawyer and Alfil drop what no longer stands where they track it (the mark goes, as a capture would). If not, record that in the area page.

### 4. Minor, pre-existing: the dock says "Your king is fireproof." when the tile fizzled over a pinned piece, not the king

`Grex.tsx`, in `fireLine`.

When a charred piece's burn would leave its king in check, the tile fizzles and the dock line is about the king. This existed before for the sparkler. The candle now makes it more likely, because a charred pinned piece stays on its tile hit after hit.

**Suggested fix:** if the fizzled square isn't the king's, say what happened, for example "Pinned: the fire can't take it."

### 5. Minor: test gap

The e2e (`e2e/grex.spec.ts`) checks only the first hit's char and the dock line. The second hit is covered only by unit tests: the burn, and the charred look kept until `goneAt`. Those tests are good, so this is fine for the boss lane. A check for finding 1 would be the most useful one to add.

## Eric's rules (`docs/rules/eric.md`)

Nothing is hidden or shifts: the char is a CSS filter on the piece, so nothing moves. "Simple beats flashy" holds: one CSS tone, no new art, and it reuses Boingo's mark machinery.

The filter has two `drop-shadow`s, and the boss screen redraws every frame. The decor is memoized by `key`, so the piece elements only change when the marks change, and I don't expect a frame cost. Still, nothing in the PR shows a `@perf` run with several charred pieces on a phone, so one quick check would settle it.

## Verdict

**The rules and the server side are correct**, the judge only counts real burns, and the boss's move waits for a char. There's no blocker. Finding 1 is visible to players in every 50 v 50 candle hit and should be fixed, in this PR or a follow-up, before Eric's next playtest. Findings 2 to 5 are minor.
