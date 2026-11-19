# Battle Tower PR 6: the delta review's fixes (Nov 19). Opus, xhigh, alone. Full lane (no further review round: the director checks)

Branch `claude/tower-several-bosses` (PR #808; pull first). The delta review: `git fetch origin review/tower-several-bosses-delta && git show
origin/review/tower-several-bosses-delta:.review.md`. Read it in full, then `docs/decisions/2026-11-18-several-bosses.md`.

Fix at the cause (CLAUDE.md, Nov 13):
- **MEDIUM 1 (Revision vs. the others' trackers):** the director's call is the review's option (a): on a side, Revision never crosses out a
  move of Folio's whose effects reached another boss's trackers (mark it when `followOthers` changes any partner's state; `revise` then
  declines, as if the trigger missed). Simpler than rewinding partners. If (a) turns out not to cover a repro (sawyer+folio s12,
  folio+smudgy s5/s37, folio+alfil), say why and do the smallest correct thing. Record the call in the decision note (a few lines).
- **MEDIUM 2 (the hidden rook's name):** another boss stepping Smudgy's hidden rook must be named as a pawn ("d6", not "Rd6"): take the
  move's name from any side boss whose `specialMove` renames that move (or a side-wide naming hook, whichever is less code). Add the
  review's check `expect(r.bossView()?.lastMove?.san).toBe("d6")`.
- **Test gap 3 (invariant 8 can't fail):** make the kit fail when `followBoard` lets go of anything after a plain move (the board equals
  `applyMove(before, move)`), or check invariant 8 before `followBoard`: pick one, show it fails on the current head for MEDIUM 1's repros.
- **The extra-move note** (Hollow's/Dash's extra move ignoring side stops, sliding the hidden rook): fix only if it's a few lines via the
  existing `sideStops`; otherwise list it under "Found, not fixed" in the PR body.
Each fix's test fails before it (show it). **Not yet:** the two `PAIR_BREAKS` stay until Eric answers.
**The 1-boss guard still holds:** no existing assertion edited for one boss; the chess suite, the layer twins, server boss and parity.
Done: update `.pr-body.md` (a short "Delta fixes" section; under 80 lines in all) and `.done`; push and end. No PRs, no CI waits.
