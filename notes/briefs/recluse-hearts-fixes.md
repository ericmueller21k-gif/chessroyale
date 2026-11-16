# The Hidden Boss's hearts, the fix round (PR #744). Opus, xhigh, alone

Effort xhigh (his phase 2's rules, the server, the host's engine). `god-king` delegate. Work on the PR's branch `claude/recluse-hearts`
(check it out from origin; the director's prep commit is there). Include `notes/briefs/rules-common.md`. The review:
`git show origin/review/recluse-hearts:review.md`. Never write his name in anything you push. Read `.claude/LESSONS.md`.

## Do (the review's findings)
1. **M1 (must): a bot's hearts are cut by engine lag, not its own slow roll**, so a host whose device is slow loses bot boards and the
   fight can't be won. Judge a bot's move by its planned think, not its arrival: bot boards are never in the automatic cut; a bot's
   heart is cut only when its rolled think was the slow one (`botSlowChance`), at the moment its think ends. Online and solo the same.
   Tests: a bot answer arriving at 7 s from a slow host/engine with a normal roll costs no heart; a slow roll does.
2. **M2 (must): a fight in progress across a deploy** (an older stored record without `hearts`/`slashed`/`slashAt`) shows empty hearts
   and loses on the first slow move (NaN). On load/step: `hearts ??= RECLUSE_PHASE2.hearts; slashed ??= false; slashAt ??= null`. Test.
3. **m3:** the results line for a board lost to hearts: "too slow" (`Breakdown.tsx` `boardEnd`, `how: "slow"`). Test.
4. **m4 (director's call):** "+N" stays on top of the game screen, but not over an open sheet or menu (the resign confirm, quick
   chat): hide `.dk-plus` while one is open. Eric's "above everything" was about the dock's status box clipping it.
5. **m5:** note in `.pr-body.md` that a stale tab from before this change shows the old "5 s a move" line until it reloads (no fix).

Run only the tests you touch, plus the parity/lobby tests for 1-2. Rewrite `.pr-body.md` (add these to the changed checks) and write
`.done`. No PRs, no CI waits, no model names in commits (end with the Claude-Session line only). Push work in progress at each step.
