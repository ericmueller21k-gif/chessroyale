# Brief: fair play counts near-best moves, and errs toward the engine pool. Opus, xhigh. Full lane (one review, one fix round)

Branch `claude/fairplay-near-best` from origin/main (create it; `npm ci`). Read `CLAUDE.md` (full lane), `docs/rules/eric.md`,
`docs/areas/fairplay.md`, and include `notes/briefs/rules-common.md` (on `claude/director-notes`).

## What happened (Nov 11, the live cheater demo, #622)
Engine Eddie played his own Stockfish 19's top move **every** move. The live deep re-check (native Stockfish 17.1, 2M nodes) agreed his
pick was its exact best only 22/32, 11/15, 6/9, 17/20 (about 74%), under `FAIRPLAY.levels.banDeep` 0.8, so he sits in **review**, never
pooled, and keeps meeting real players. Two engines often prefer different, practically equal moves: exact-match undercounts every
cheater who uses another engine (all of them). Strong Sam (Maia at 2500) stays on watch, as he should.

## Eric (Nov 11)
"It says 3,400 ... that's 100%. Just trust me. It's better we put people in this queue than under. One cheater ruins a game. If somebody
is legitimately not cheating and they feel like something's up, that's an easy thing for me to look at" (the pool tab's Release).

## Build
1. **Near-best counts as the engine's best.** A deep-checked move counts toward the deep share (`banDeep`, `banOneDeep`, every place that
   reads "the engine's best" from the deep result) when its rank is 1 **or its `loss` is at most `FAIRPLAY.deep.nearBestLoss`**
   (`deepResult` already stores `loss` in expected-score points: start at about the equivalent of 0.15 pawns near equality; pick and
   justify the number). Keep `rank` and `loss` as stored; no new searches. Say what the review page shows ("82% near the engine's best").
2. **Err toward the pool (Eric).** One deep-checked match past the one-match bars pools (today one match only opens a review: "two would
   pool"), and the two-match path keeps its bars; revisit `banOne*` and `banDeep` with the new count. Keep "never a ban" as is (pool mode).
3. **Existing cases** are worked out again with the stored deep results on the next scheduled run (Eddie should pool with no new
   matches; say how, and that it's idempotent).
4. **Calibrate with the cheater simulations** (fairplay lane's tools, one run at one setting): Eddie-like (any engine's top move) pools
   within 1-2 matches; strong humans (Maia 2200-2600, raw and drawn) don't pool; report the false-pool rate at those levels. Numbers in
   settings; the report in `reports/`.
5. Docs: fairplay.md (≤5 lines), a decision note (≤10 lines, Eric's words). Also add to `docs/ideas/` one paragraph of Eric's later idea:
   a button on a case that sends it to a helper for a deep analysis and a determination (not built now).

## Keep
Full lane: add nothing to the review loop beyond one review and one fix round (Eric). Every changed check old → new in the PR body.

## Deliver
Push; PR title "Fair play: near-best moves count, and one clear match pools"; body (≤40 lines: what changed for players and admins, the
sim's numbers, changed checks) to `.pr-body.md`; `.done` LAST. Wait for green CI.
