# Hidden Boss: the cutscene, MOCKUP (Nov 12)
You are the `characters` helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: high (animation and timing).
Follow `.claude/agents/characters.md`. Read CLAUDE.md, .claude/LESSONS.md, docs/areas/bosses.md. On branch claude/director-notes read
notes/hidden-boss-today.md (how he works now; id `recluse`; today's phase change is `recluse-phase2.ts` / `screens/Recluse2.tsx`) and
notes/briefs/hidden-boss-house-NOTES.md: the sections "Nov 12 (afternoon)", "Nov 12 (night): the cutscene, Eric's version" and
"Nov 12 (night): Eric's big update" are the spec. The drawings of the kid (age 9) and his ghost are on branch claude/hidden-boss-ages
(`packages/app/src/characters/recluse-ages.ts`): build from that branch (merge it into yours).

A MOCKUP for Eric: not wired into any match; nothing changes for players. Build it as real components (so the build can reuse them)
shown by a preview that is never reachable in production (no TEST_SWITCHES in production).

Show, on a phone (390 x 844) and a computer (1440 x 900), over a real board mid-game, with today's sprite on his knees:
1. Everything dims; a circular spotlight shines down on the board's center, soft feathered edge, no hard edge.
2. The ghost kid poofs into being a foot or two above the board (a magical materialize), drops, lands, knees buckle, straightens.
3. The 17 lines, each in its own text box by the speaker, typed out. Two-sentence lines: type the first, hold about 1 s, type the second.
   Hold each box long enough to read; err slow (put the typing speed and hold times in `packages/core/src/settings.ts`).
   Line 15 is "Computers or no computers." then "The best player in the world is still the best."
4. After line 17 the kid fades out (the segue; the book and the light are a later job).
Reuse what exists (the speech box, the ghost loop, the growing step's motes) before writing new. Simple beats flashy.

Images for Eric (about 6): a GIF or MP4 of the whole scene per platform, plus stills of the spotlight, the landing, and one text box. Push
them to branch stills/hidden-boss-cutscene (never under docs/). Testing: typecheck and the unit tests you touch; no e2e. About 2 hours.
Branch claude/hidden-boss-cutscene (from origin/main, with claude/hidden-boss-ages merged in). Push at each real step. Decision note
docs/decisions/2026-11-12-hidden-boss-cutscene-mockup.md, at most 80 words. When done: push .pr-body.md (short: what's built, where the
images are, choices made), then .done last. Don't open a PR. American English. Never include model names in commits.
