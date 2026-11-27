# Review: claude/tower-easy-floors (head e3521013), boss lane quick pass

**1. Blocker: online never gets the floor's draw.** `packages/server/src/lobby.ts:2520` builds the `bossRequest`'s brain as
`{ brain: b.brain, rating: now.rating }`, dropping `b.draw`. `hostBoss` (`packages/app/src/net.ts:1113`) reads `brain.draw` from that
request's brain (`m.brain`, net.ts:977), not from the `bossBrain` message, so `brain.draw` is always undefined. Failing case: an
online tower floor 1 on the Maia brain: the host and the checker both draw at 0.8 / 0.9 with no gift check, and a drawn Qd1-d4
onto a pawn's square is played. Solo redraws it. The decision note's "solo and online agree" doesn't hold. Fairness is unharmed (both
devices drop it alike), but the feature is solo only. Fix: `...(b.draw ? { draw: b.draw } : {})` on line 2520, plus one check in a
lobby test that a tower floor's `bossRequest` carries `brain.draw` (today only `bossBrainPlan` is tested: several-bosses.test.ts:370).

**2. Should-fix (once 1 is fixed): honest devices can get a throw strike.** `lobby.ts:2435` strikes the worse of two differing boss
moves when the gap is `BOSS_CHECK.throwLoss` (0.8) or more. That limit was set above maia-raw's honest worst at 0.8 / 0.9 (0.76,
settings.ts BOSS_CHECK note). On floor 1 the draw is 1.6 / 1 (every legal move in reach), so an honest Maia move that allows a mate
in one, against a device that fell back to Stockfish (maiaOf), now reaches 0.8+ and its device is struck. Same with an **older app**
as one of the two: it ignores `draw` and draws 0.8 / 0.9 with gifts, the new app draws loose, and both are "by Maia" with
different moves. Whichever comes out 0.8+ worse is struck: the new app's loose slip, or the old app's honest queen gift. Suggest: no
throw strike on a battle whose brain carries a looser `draw` (or scale `throwLoss` by it), and send `draw` only when both devices
understand it (a hello flag like `seeded`), or let a pair with an older app fall through to "the better plays" with no strike.

**3. Nit: a sound queen sacrifice is refused.** `packages/chess/src/boss-brain.ts:35-43` only skips an immediate mate. A queen sac
that forces mate is a "gift": `r6k/6pp/7N/8/2Q5/8/8/6K1 w`, `c4g8` (Qg8+ Rxg8 Nf7#) scores 7 (checked with chess.js 1.4.0) and
is redrawn. Rare at these ratings, and it only makes a boss weaker, never unfair. A cheap fix: after the cheapest capture on `to`,
skip the gift if the mover then has a mate in one.

**4. Should-fix: stray deletion.** Commit 7955616 ("Drop the PR body file") also deletes `review/dash-hang-on-2/` (9 stills and
GIFs from another lane, still on main). Restore them, or the merge removes them from main.

**5. Nit: types.** `MatchRunner.humanBrain`'s type (`packages/chess/src/runner.ts:1553`) has no `draw`. It reaches
`pickBossMove` only through object spreads (solo.ts:888, tower-sim.ts:579), so a later rewrite that lists fields one by one would
drop it with no type error. Add `draw?: MaiaDraw` there.

**6. Nit:** noGift only applies to `maia-raw` (`humanBrainMove`). An admin's guarded-brain pick on a tower floor gets the loose
temperature but no gift check. Fine if that's intended. Say so in the decision note.

Checked and fine: off the tower nothing changes (`bossBrainPlan` adds `draw` only on a Maia tower floor; Stockfish floors from 51,
Boss alone, raids and the Hidden Boss, who isn't in `towerPool`, are untouched). The redraw is deterministic for one seed and position
(it uses the move's seeded `rng`, and Maia's `p` is the raw softmax sent as fixed text, so `p^(1/T)` matches the box's draw). Every
listed move a gift: Stockfish's best, the same on both devices. Pins, x-rays, a king that can't recapture, trades, protected squares,
promotions (pawn moves aren't checked) and castling all score right. Phone cost: chess.js move generation only, at most about 8
candidates times a few plies, no engine search. The unit tests check what they claim, but none covers the online path (see 1).
