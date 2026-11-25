# Town atlas pages, round 2: blank pictures drawn by drawImage (Nov 25). Opus high, town lane, targeted. Branch `claude/town-atlas-pages` (PR #949)

PR ericmueller21k-gif/chessroyale#949 (head 2af6f9d9; read its `.pr-body.md`/PR body and `docs/decisions/2026-11-25-town-atlas-pages.md`)
makes each kept picture a stand-in canvas that's empty until its OWN 2D context is asked for (`keep-pictures.ts` `domPageIO.standIn`
overrides `getContext`) or the painter uploads it alone. CI run 45605985953 shard 5: `e2e/town-controls.spec.ts:347` fails on phone AND
desktop, both tries: "every portrait drawn" 0 of 21. Cause (director's read): `TownMap.tsx` `Face` and `Town.tsx` `drawFace` (the on-screen
chips) do `g.drawImage(r.chipFace(...).img, …)` onto THEIR canvas: drawing FROM a stand-in never calls its getContext, so it copies an
empty canvas. Players on a repeat visit would see blank boss faces on the chips and the large map.
Fix the CAUSE, for every consumer, not just these two:
1. Audit every path that can receive a picture canvas from the kept pages and draw from it without its own getContext: the chips and the
   large map, the Canvas2D fallback when there's no WebGL (render.ts's `ctx.drawImage(img…)` calls: list which can get a stand-in), the
   painter's lost-context path, statues/hit tests, anything else. Say in the PR body which can and how each is now safe.
2. Prefer one structural fix over sprinkling `fill` calls: e.g. the picture accessors (`.get(i)`, `chipFace`) hand out a filled canvas, or
   the kept pages are used only on the WebGL path and any 2D consumer gets cut pictures; whichever is least code and fewest ways to break
   (CLAUDE.md "Simple beats flashy"). Keep the measured repeat-visit gain (say if it changes).
3. A check that fails without the fix: the minimap spec already does on a repeat visit; make sure CI's run of it is a REPEAT visit (kept
   pages), and add one focused check for the on-screen chips' faces (pixels not blank) on a repeat visit, in an existing spec.
Run `town-controls.spec.ts` (phone + desktop), `town-street.spec.ts`, the `@perf` "a second visit…" before pushing. Update `.pr-body.md`
("Round 2" section) and the decision note. `git fetch origin claude/town-atlas-pages && git checkout -B claude/town-atlas-pages
origin/claude/town-atlas-pages`, `git rm .done` if present, push, fix, push, write `.done`, stop. Don't open PRs or wait on CI. Commits end
with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By).
