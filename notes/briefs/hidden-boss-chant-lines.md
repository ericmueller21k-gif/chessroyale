# Hidden Boss: two lines in his chant, a longer rise-to-crack (Nov 13)
You are the `god-king` helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: high (timing across the phase change and its music).
Follow `.claude/agents/god-king.md`. Read CLAUDE.md, .claude/LESSONS.md. His phase change: `packages/app/src/recluse-phase2.ts`
(`PHASE_CHANGE`), `screens/Recluse2.tsx`, settings `RECLUSE_PHASE2.change`. His music switching (merged in PR #670): `music.ts`
`recluseMusic`; the transformation theme starts `introSeconds` before the split (themes.json `recluse-phase3`).

Eric's final lines (Nov 13), said by the man during the chant, between the book landing open and the board's crack:
1. "Computation without creativity is nothing." (pause about 1 s) "Now I have both."
2. "Prepare yourself." (pause about 1 s) "This is the ultimate test of your skill."
Show them in his speech bubble, typed out the way the cutscene mockup types (each sentence typed, about 1 s between sentences, each
box held long enough to read; err slow). The cutscene mockup's pace is `RECLUSE_CUTSCENE` on branch claude/hidden-boss-cutscene
(45 ms a character, 1 s between sentences, hold 1.7 s plus 40 ms a character): use the same numbers, as settings.
Lengthen the chant (`castHoldMs` or a new setting) so both lines fit, the chant's light and the arcs keeping their look. The last line
should finish about as the music goes silent, 1 s before the crack. The rise-to-crack time (from his rage rise, where the transformation
theme starts, to the split) must stay at most 18 s.

The music: the transformation theme in the game is still cut for 8.74 s. Don't touch audio. Write the new rise-to-crack time in seconds
(3 decimals) in a file `.rise-to-crack` at the branch root and in your PR body; the director sends it to the music session, which builds the
matching cut, and the director copies it in. Until then the split will be later than the drop: that's expected on your branch.
Testing: typecheck; the unit tests for the phase change's timeline and the music switching (update any that pin the old length);
`e2e/recluse.spec.ts` "beaten in phase 1" locally. One still or short clip of each line on a phone. About 1.5 hours.
Branch claude/hidden-boss-chant (from origin/main once PR #670 is merged: check `git log origin/main` for it first). Push at each real
step. Decision note at most 60 words. When done: push .pr-body.md (short, with an updated timing sheet), then .done last. Don't open a PR.
American English. Never include model names in commits.
