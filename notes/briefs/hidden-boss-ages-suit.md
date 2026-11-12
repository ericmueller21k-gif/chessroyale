# Hidden Boss ages: the age-20 suit (Nov 12)
You are the `characters` helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: medium (one outfit change on an existing drawing).
Follow `.claude/agents/characters.md`. Read CLAUDE.md first. The mockup is on branch claude/hidden-boss-ages
(`packages/app/src/characters/recluse-ages.ts`, wired into nothing); its images are on branch stills/hidden-boss-ages.

Eric (Nov 12) on the mockup: "it looks really, really, really good". The face stays as it is. One change, the age-20 version:
"instead of the same white shirt and tie, give him a black suit with black pants and a white t-shirt underneath it with a tie."
- So: a black suit jacket and black trousers, a white shirt underneath with a narrow tie (keep his tie's look distinct from today's
  blue diamond tie), and black shoes. Keep it readable at phone size (a dark suit on a dark background: keep the outline and a little
  sheen so the shape reads). Change his idle frames and the 13 -> 20 and 20 -> today growing steps to match.
- Nothing else changes. The name never appears anywhere.

Then re-make only the images that show age 20 (01 lineup, 02 faces, 05 idle, 06 growing all steps) on branch
stills/hidden-boss-ages, replacing the old ones. Run `npm run typecheck` and `packages/app/test/characters.test.ts`. About 30 minutes.
Push to claude/hidden-boss-ages. Update its .pr-body.md (the age-20 outfit), then push .done as the last commit (remove the old .done
first, then re-add it at the end). Don't open a PR. American English. Never include model names in commits.
