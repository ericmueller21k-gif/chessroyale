# Hidden Boss: his younger ages, MOCKUP (Nov 12)
You are the `characters` helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: high (drawings and animation).
Follow `.claude/agents/characters.md` as your instructions. Read CLAUDE.md, .claude/LESSONS.md, docs/areas/bosses.md first.
Background, on branch claude/director-notes: notes/hidden-boss-today.md (how he works now; his id is `recluse`, his sprite
`packages/app/src/characters/recluse.ts`) and notes/briefs/hidden-boss-house-NOTES.md (the whole plan, "Update 3" and "Nov 12 (afternoon)").

**This job is a mockup for Eric to look at. It is not wired into any match.** Nothing changes for players.

Eric (Nov 12): "we'll just have three like different versions until his current oldest self. So like as a child, as like 13, and then
maybe like 20, and then whatever he is like his current one... they would all need just like idle animations... they won't utilize any
like special powers, so it's mainly just having the animation built... for like the when the youngest self appears, like after you defeat
the second level".

Draw, in the same pixel style, scale and palette family as today's sprite (`recluse.ts`):
1. **Three new ages:** the child (about 8 to 10), about 13, and about 20. Today's sprite is the fourth (the oldest), unchanged.
   - Likeness (Eric's exception, RULES.md): each keeps the strong features of today's face, so all four read as the same person
     growing up. A skinny kid. Taller, longer face and hair with each age. 1950s clothes for the child and the 13-year-old.
   - **The name never appears anywhere**: not in code, comments, file names, commits or text. Use `recluse` and "Hidden Boss".
2. **An idle animation for each new age** (a few frames, like today's idle: breathing, a blink, a kid fidgeting).
3. **The level-up / growing step:** one short animation from one age to the next (a flash or shimmer, then the older drawing). Reuse an
   existing effect if one fits (CLAUDE.md: simple beats flashy).
4. **The ghost of the child** for the cutscene after his adult form is beaten: the child drawing as a faded, ghost-like projection
   (see-through, pale, a soft glow) standing beside today's sprite kneeling. A still and a short idle loop.

Put the drawings in their own new file(s) under `packages/app/src/characters/` (for example `recluse-ages.ts`), registered only for
the preview, so later work can wire them. Keep today's sprite and every screen exactly as they are.

Show it (Eric reviews, about 10 images in all):
- A lineup sheet: child, 13, 20 and today's sprite side by side, at the in-game size on a phone and on a computer.
- Each new age's idle as a GIF, and the growing step as a GIF.
- The ghost child beside the kneeling adult, as a still and a GIF.
`npm run preview:characters -- <dir>` makes GIFs and sheets. Images never go under docs/: push them to branch `stills/hidden-boss-ages`
(images only, from an orphan or main), and list their paths in your report.

Testing: `npm run typecheck` and the characters unit tests (`packages/app/test/characters.test.ts`). No e2e (nothing on screen changes).
About an hour and a half.

Work on branch claude/hidden-boss-ages (from origin/main). Push at each real step. A decision note
`docs/decisions/2026-11-12-hidden-boss-ages-mockup.md` of at most 80 words. When done: push .pr-body.md (short: what's drawn, where the
images are, choices you made), then .done as the last commit. Do not open a PR or wait on CI: the director does. American English.
Never include model names in commits.
