# #913 fix: Birdie faces the wrong way in his building (Nov 23). Opus medium, boss lane

Eric (Nov 23, after the stills of round 4 in the game): "He's facing the wrong way in the building." In `stills/birdie-lobby-4`
`gates-down-phone.png`, Birdie on his toy train stands on his mark west of the table and faces **left (west, toward the seats)**, away from
the table and the player. He should face **the table** (east), as every boss does at his challenge.

PR #913, branch `claude/birdie-lobby-4` (push to it, never force). Start: `git fetch origin claude/birdie-lobby-4 main && git checkout -B
claude/birdie-lobby-4 origin/claude/birdie-lobby-4`. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`. Effort medium.

`challenge.ts` `marksOf` sets `bossFace: 1` (east) for an across table. Find why Birdie still faces west: most likely his figure's drawing
faces left natively (his train's nose is on the left) and the room's flip for a boss's facing assumes a right-facing sprite, or his
character lacks the flag other left-facing bosses carry. Check every place he stands in his room and his challenge (walking in, on his
mark, seated, the table beat, the gates' beats, his idle in the lobby if he stands there) and in the town square if the same flag drives
it. Fix it at its cause (the one flag or the one place), not per beat. Check the other bosses' facing at their challenges didn't change
(the boss-challenge unit tests; one e2e challenge of another boss).

Prove: typecheck; the room and `boss-challenge` unit tests (add one check: Birdie faces the table on his mark); `e2e/birdie-home.spec.ts`
challenge (phone). Retake `gates-down-phone.png`, `gates-lowering-phone.png`, `gates-table-phone.png` on `stills/birdie-lobby-4`. Write a
fresh `.pr-body.md` with only a "Facing fix" section (cause, fix, changed checks old → new). `.done`, push, stop. Don't open PRs or wait on
CI. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`. American English.
