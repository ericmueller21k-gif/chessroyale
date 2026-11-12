# Review: Boingo's face pie (branch `claude/boingo-face-pie`, head 9247713)

Boss lane, one read-only pass. I read the decision note, `bosses/boingo.ts`, the dispatcher (`boss-powers.ts`), the runner's
crowd and boss move paths, the protocol's `splats`, `components/Boingo.tsx`, the three screens' `decor`, the FAQ and the tests.
I ran `boingo-pie.test.ts`, `boss-powers-lobby.test.ts`, `banners.test.ts` (80/80 pass) and `npm run typecheck` (clean), plus
two throwaway probes (not committed).

**No blockers.** One should-fix in the rule (castling puts a rook on a pie), one should-fix in the tests, and some nits.

## Should-fix

### 1. Castling's rook lands on a pied square
`packages/chess/src/bosses/boingo.ts:250` (`crowdFilter`), `:258` (`stopReason`), `:92` (`onPie` in `choosePieThrow`).

The filter only looks at `to(m)`, the king's square. Castling also moves the rook onto f1 (O-O) or d1 (O-O-O), and the
new rule pies the back rank often: any piece on the second rank with both squares behind it empty. The old pie never
reached the back rank, so this is new.

Two probes, both run against this branch with the real `prepareTurn` and `crowdAllowed`:
- `r3k3/pppppppp/8/8/Q7/8/4BPPP/4K2R w K - 0 1`, turn 2: he throws at Be2 and pies d1 and f1. `e1g1` is still allowed,
  and the rook lands on f1, under the pie. `stopReason` is null.
- `4k3/pppppppp/8/8/7Q/8/2NP4/R3K3 w Q - 0 1`, turn 2: he throws at Nc2 and pies b1 and d1. `e1c1` is still allowed,
  and the rook lands on d1.

This breaks the rule ("nobody, either side, may move onto them"). On screen the pie is drawn over the rook through the
boss's reply. It doesn't cause divergence, because the server, the solo runner and the judge all use the same filter.

**Smallest fix:** add one helper, `lands(m, fen)`: `to(m)`, plus the rook's landing square when `m` is castling. Use the
same king-moves-two-files test as `followSplats`, or the castling branch of `moveSquares`. Then call it in `crowdFilter`
(it already gets `fen` as its third argument), in `stopReason` (it has `_fen`), and in `onPie` in `choosePieThrow`, so the
guard and the nuisance score count the same moves. `bossStops` can stay as it is: pies are never on the boss's back rank.
Add one line to the "guards" test using the first position above.

### 2. The ranking ("a real nuisance") isn't tested, and the test named after it doesn't check it
`packages/chess/test/boingo-pie.test.ts:62-89`.

The title says it guards "the piece whose pies take away the most of the crowd's moves (its own retreats double), a pick
of the top three". The body only checks that each pick is a legal target and repeats for the same seed, and that
different seeds pick different pieces. Its one fixed position (`B`, line 88) has a single target. If the sort at
`boingo.ts:100` flipped (`a.score - b.score`), or the `2 *` were dropped, every test would still pass.

**Smallest fix:** one position with four or more targets whose scores are known. For example, a knight on e3 with its two
retreats d1 and f1 empty (score 4 or more), next to pawns whose squares behind nothing can reach (score 0). Assert that
across 30 seeds every pick is in the top three by `(score, value, square)`, and that the bottom one is never picked.

## Nits

3. **The lobby test's core checks are conditional.** `packages/server/test/boss-powers-lobby.test.ts:206-210`:
   `if (thrown) { … }`. Today `thrown` is true (I probed it: the position at turn 2 is the Ruy Lopez after 6…a6, and he
   throws). But if the raid's opening or seed changes, the splats-alike-for-every-player check would silently stop
   running. Fix: `expect(thrown).toBe(true)` before the `if`, or drop the `if`.
4. **The e2e can pass without ever seeing a freeze.** `e2e/boss-powers.spec.ts:464`: `expect(froze).toBe(due > 0 ? 1 :
   froze)` is trivially true when `due` is 0, and then the ice and the removed mark are never checked on screen. With the
   test switch and the plan, a freeze is likely but not certain (the boss's reply can land on a square behind the piece).
   Fix: log `due` and, if it's often 0, assert `due > 0`, or pick a plan that keeps the squares behind e4 clear.
5. **The boss-side guard checks the wrong position.** `boingo.ts:94` asks whether the boss would have moves "as it stands",
   with the crowd to move. His real moves come after the crowd's move. This is harmless, because `bossAllowed` lifts
   the limit when he has none, but the comment and the decision note promise more than the code does. Either word it
   as "a rough check; the dispatcher's lift is the guarantee", or drop it.
6. **`pieMax` below 2 turns the pie off silently.** `boingo.ts:229`: `pies.length + 2 > t.s.pieMax`. Every throw is a pair
   now, so `pieMax: 1` means he never throws, and nothing says so. Fix: `Math.max(2, t.s.pieMax)`, or a line in the
   settings comment.
7. **In the Crowd reveal, a marked piece's mark vanishes until its move lands.** `packages/app/src/screens/Crowd.tsx:595`:
   `boingoDecor(match.boss)` reads splats that have already followed the move, while `onBoard.fen` is still the position
   before it (until `played`). For the moment between the reveal and the move landing, the piece about to move shows no
   mark, then slides in wearing it. It's small and cosmetic. Fix: pass the decor only once `played`, or work it out from
   the marks before the move, `followSplats` in reverse (`last.marks` isn't in the view, so the first is simpler).
8. **The FAQ leaves one thing out** (`packages/app/src/faq/content.ts`, clown): a frozen rook can't castle either (the
   held-piece rule). Optional: add "(nor castle, if it's a rook)". Everything else matches the code: never the king,
   both squares empty, the top three with retreats counted double, a try again next turn, the mark following the piece,
   the second splat freezing for 1 turn and wiping the mark, and never leaving you without a legal move.

## Checked and fine

- **Pies and the freeze last exactly 1 turn.** `until = turn`. `wearOff` removes them as the next crowd turn begins (after
  his reply), and the freeze clears early if its piece is gone. The ice shows through his reply, as Ginger's does.
- **Marks follow their pieces in every case asked about.** Ordinary moves, castling's rook (both sides, both colors),
  promotion (it takes the new kind), en passant and captures (the mark goes). `trackSplats` runs after the board is
  updated, for the crowd's move (`runner.ts:1202`), his move (`:1459`) and the funhouse's move (`boingo.ts:359`).
  A Last Stand doesn't play the move, so the marks don't move, and the re-pick's `prepareTurn` is a no-op.
- **No unfair "no move".** The throw's guard keeps a legal crowd move with both pies and a freeze, in check too, and the
  dispatcher still lifts every limit if none is left. The king is never a target. A forced loss through a restriction
  is possible in principle, as with Ginger's freeze. That's a design point, not a bug.
- **Online, raid and solo agree.** It's one rule in the shared runner, from the seed and the position. The view carries
  `splats` to every player, and the in-match test checks that `bossView().splats` equals the state.
- **The test switch doesn't leak.** `t.test === "pie"` comes only from `bossPowerTest`, which only `?power=pie` sets (the
  lobby options and the solo test switches). Its default is `""`.
- **"Nothing hidden, nothing shifts".** The mark is an absolutely positioned child of the piece, the flights and the ice
  are overlays, and the banner keeps its size. Nothing moves or hides.

## Test checks changed or removed in the PR (for the PR body)

- Removed: "puts the pie on an empty square near the center…", and "pies: each for 3 turns, a new one every 2 turns, up
  to 2 at once…". Both are replaced by `boingo-pie.test.ts`.
- `banners.test.ts`: `pie: 2300` → `POWER_FX.pie === 2700`.
- The e2e Boingo test is split in two. The funhouse test's pies went from `toHaveLength(1)` / 1–2 to `[0, 2]`.
- None of these guards a rule in `docs/rules/eric.md`.
