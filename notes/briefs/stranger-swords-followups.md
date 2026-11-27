# The Stranger's swords: the review's follow-ups (#1002 merged; Nov 27)

Read `notes/briefs/rules-common.md` first. Branch `claude/stranger-swords-2` from main. Boss lane. Opus, effort high (timing; the server's
thinking minimum). The review: `REVIEW.md` on branch `claude/stranger-swords-review`. Fix only these:
1. **Should-fix 1, the dead air after his block** (1.3-3 s idle before his hop): put the block into the thinking minimum the way
   `burnt ? FIRE_BURN_MS` is (`packages/app/src/boss-timing.ts` ~:304 and the server's `thinkMinAt`): the Stranger, with `hisLoss >= 3`, thinks
   at least `FINISHER_BLOCK_MS`; then drop `finisherLeadMs` from the hold and from `strangerTurnMoments`; update the chess test
   (`held === finisher + FINISHER_BLOCK_MS`). Solo and online the same.
2. **Should-fix 2, the hop's peak on a phone:** a number check that `arc(CORNER, stand, 14, 0.5)` for every square stays at or below the
   corner's height (or lower the arc so it can't rise above the corner), so Eric's whole-on-screen rule is proven for the arc too.
3. **Nits:** the frostfire's margin for network delay (its landing ends at 4360 of a 4600 hold): give every finisher at least ~400 ms
   before the hold ends (shorten the frostfire or lengthen the hold a little; keep it about 5 s, Eric's "5-second thing");
   `hisLoss` skips a base that goes back as `bossBeat` does; `Boss.tsx:432` computes `chandyFen(...)` once.
4. **Already on main (not #1002's):** the Stranger's Frostfire burn moment plays Grex's `grexPoof` (`FireBurn`'s `pieceBurn` isn't quiet,
   `Grex.tsx:128`): make his burn quiet (his own burn sound already plays). Fix the cause: `boss-sounds-own.test.ts` reads only kits'
   sounds; if one line in it can also read the board effects his moments use, do it; if not, say so in the PR body.
Tests: the changed unit tests, `e2e/stranger.spec.ts` (phone). One GIF of the cut finisher after the change on `stills/stranger-swords-2`.
`.pr-body.md` at most 40 lines, then `.done`.

5. **Eric, Nov 27 ~07:30: "is it possible to time Stranger's moves and instead of the piece moving after have it capture the moment he
   kills it".** Today his capturing piece slides in only once he's home (the held move plays at the hold's end). Make his piece slide onto
   the square at the kill (the finisher's `gone` moment), as one hit. The director's design: the finisher event also carries the move's
   `from` (the server and solo know the pending move when the finisher is marked); from `gone` on, the board shows his piece on the
   square (the same slide animation as a normal move, started at `gone`), and when the held move arrives at the hold's end the board
   already matches it, so nothing animates twice. The turn's timing (the hold, the crowd's clock) is unchanged, so solo and online stay
   in sync; a late join or reconnect mid-finisher just shows the board as it is. Test: the e2e "his finisher" checks his piece is on
   the square before he's home; a unit test that the event's `from` is the held move's.
