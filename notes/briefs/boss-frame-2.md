# Boss frame (#964), round 2: one figure size in every fight (Nov 26). Opus high, targeted. Branch `claude/boss-frame`

CI on #964 (head 968e1bb3, run 45738154834, shard 4) failed `e2e/side-same-size.spec.ts:16` [desktop]: "1280x800: your pawn in <the
hidden boss>'s fight 201.6 as tall as in tiger's 193.2" (≤ 0.5 expected), on the retry too. Cause (from the PR body): the frame moves the
board 12–14 px right at a few sizes, so the room beside it shrinks and your pawn / the God King drop 1.2 → 1.15 (1280x800) and similar at
1920x1080; the hidden boss's fight is NOT framed (`bossFramed` excludes it), so it keeps the old size. The spec's rule: your pawn and the
God King are as tall in every fight at a window size (and every boss the same screen px per sprite px).
Fix the cause, least code: either (a) the framed fights keep the figures' old scale at every size (the scale shouldn't depend on the
12–14 px the gaps moved), or (b) the hidden boss's fight takes the frame too, if its phases allow it cleanly. Say which and why. Don't
touch the spec's rule. Run `side-same-size.spec.ts`, `desktop-board.spec.ts`, `board-layout.spec.ts`, `boss-side.spec.ts` (desktop) and the
boss kit; typecheck. Append a "Round 2" section to `.pr-body.md` (cause, fix, checks changed old → new if any). Never write the hidden
boss's name in commits, the PR body or file names (use "the hidden boss"). Delete `.done` at the start; COMMIT and push `.pr-body.md` and
a new empty `.done` at the end, stop. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
