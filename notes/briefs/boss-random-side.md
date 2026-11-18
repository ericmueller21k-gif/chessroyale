**PARKED (Eric, Nov 18): "Maybe for now then we stick to white, but need to consider changing this later for sure." Not started; pick up when Eric says.**

# Every boss battle: you play White or Black at random (Eric, Nov 18). Opus, xhigh (every boss's rules, solo and online), alone

Branch `claude/boss-random-side` from main. About 1.5-2 h. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/bosses.md`,
`docs/areas/god-king.md`, `docs/rules/eric.md`.

**Eric, Nov 18:** "also randomly white or black should be in every boss fight, right now it's always white isn't it? I don't like that."
**Today:** a boss raid has one board, so `runner.ts`'s constructor (`raidBlack` only from `opts.raidSide === "b"`, the `?side=b` test
switch) always gives the crowd White; Hollow (`opening.crowdWhite`) is the one boss who always plays Black.
**Change:** the crowd's side drawn at random per battle from the match's seeded rng (so solo and online agree, a rematch draws again),
50/50, for every boss battle (Boss alone, raids, parties, the Hidden Boss's fight if it's a board battle); Hollow keeps his own rule;
`?side=b` / a `side=w` switch still force it for tests. The board shows from your side (flipped for Black, as `?side=b` already does).
**The real work: every boss with the crowd as Black.** Each boss was built and tested mostly with the crowd White. Run every boss's
powers with the crowd Black (the boss kit for both sides: add the side to `kitBattles` so each boss plays at least one battle each
way; Big Boy's snack and tower half, Chandy's queen-lock edge and Dodge square, Ginger's ice, Dash, Boingo, Alfil, Moo, Wrangler,
Smudgy, ...: anything that says "the crowd's half", "his edge", ranks, files or a start square), and fix what breaks. Also the God
King in black, the judge, the Last Stand, the boss's first move when he's White (he moves first: his thinking moment, the clock).
Checks: the boss kit both sides, each touched boss's tests, server boss tests, e2e boss-smoke both sides. List any boss behavior
that changes with the side in the PR body. Done: `.pr-body.md` (under 40 lines, changed checks old → new) and `.done`; push and end.
