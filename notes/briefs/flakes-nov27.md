# Two red-on-main flakes (Nov 27): fix at the cause. Opus high (a game rule may change: then xhigh), god-king lane, targeted

Read `notes/briefs/rules-common.md` first. Branch `claude/flakes-nov27` from main. Main is red (FLAKY_RED) until this merges.

1. **`e2e/battle-tower.spec.ts:907`** (shared floor Grex + Smudgy, his hidden rook drawn a pawn): failed then passed on retry on main 62dd6cc
   (run of #1006) and on #1000's PR run. Failure at :968 (poll: `phase play && focus smudgy && drawn !== null`, 60 s). The page at the
   failure (shard 4 snapshot): "Your move", "Smudgy, to move", moves: "1. You: pawn to c3", "1… **Grex: rook to e7**". So Grex moved the
   rook on d7, Smudgy's camouflaged rook (`?paint=1`: hidden on d7), and Smudgy's `powers.camo.square` still says d7 (empty): `drawn` null
   for good. It fails only when Grex's engine happens to pick that rook. The director's read: **a game bug on shared floors**: Smudgy's
   camouflage state doesn't follow (or end) when another boss moves his hidden piece. Decide the rule (simplest, fair: the disguise ends
   and the rook shows as a rook once moved by anyone, as when Smudgy moves it himself; or Grex never moves Smudgy's disguised piece),
   record it in a 5-line decision note, make solo and online agree, and add a unit test (a shared floor where the other boss moves it).
   Then the e2e: keep its intent; if its position lets Grex take that rook by chance, pin it (a test switch) so the check is
   deterministic. Also check other powers that remember a square (Frostfire's frozen piece, Dough's lumps…) for the same multi-boss
   gap, and say which are fine.
2. **`e2e/zebra.spec.ts:97`** (desktop, Don Dough, first `yourMove`: phase stuck "boss" 90 s) on main ac75eaa (run 45927251585): two 503s
   from `/api/engine/score` just before (the test server has no engine). Find why a 503 from the score endpoint stalls the boss's
   first move (the fallback path) and fix it.
Run the two specs (and the unit tests you touch); `.pr-body.md` at most 40 lines (changed checks), `.done`.
