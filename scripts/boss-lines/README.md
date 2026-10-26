# Boss lines

Drafts of original boss dialogue from the Claude API, for Eric to review. Nothing here goes into the game: an approved line is copied into the game's line tables by hand.

```sh
npm run boss-lines -- packs [out]           # the source packs only, no API call (free)
npm run boss-lines -- sample                # Ginger and Jefferson -> docs/boss-lines/sample/
npm run boss-lines -- pair <id> <id> [out]  # any two bosses (roster ids), same steps as the sample
npm run boss-lines -- boss <id> [out]       # one boss: its sheet and 100 everyday lines, then the critique
```

- **Key:** `ANTHROPIC_API_KEY` from the environment, read only by the SDK (never printed or written). The base URL is pinned to `https://api.anthropic.com`.
- **Spend:** `BOSS_LINES_CAP_USD` (default 3). Every response's real usage is added up at Opus 5.5's prices ($4 / $20 per million tokens). A call whose worst case (its input plus a full 12,000 output tokens) could pass the cap isn't sent, and the run stops with what it has.
- **Files:** `packs.ts` (what the repo says about each boss), `lore.ts` (where each boss's lore comes from), `prompts.ts` (the prompts and JSON schemas), `rules.ts` (the automatic check), `api.ts` (the SDK call and the spend guard), `main.ts` (the modes and the report).
- **Output:** `packs.json`, `results.json` (every line as first written, after the critique, and the check's verdict) and `sample.md` (readable, with the cost).
- **Typecheck:** `npx tsc -p scripts/boss-lines --noEmit`.
