# Boss lines

Drafts of original boss dialogue from the Claude API, for Eric to review. Nothing here goes into the game: an approved line is copied into the game's line tables by hand.

```sh
npm run boss-lines -- packs [out]           # the source packs only, no API call (free)
npm run boss-lines -- sample                # Ginger and Jefferson -> docs/boss-lines/sample/
npm run boss-lines -- pair <id> <id> [out]  # any two bosses (roster ids), same steps as the sample
npm run boss-lines -- boss <id> [out]       # one boss: its sheet and 100 everyday lines, then the critique
npm run boss-lines -- sheets [out]          # the 13 character sheets only (about $1), for Eric to approve first
```

- **Key:** `BOSS_LINES_API_KEY` from the environment (an environment variable in the cloud environment's settings; `ANTHROPIC_API_KEY` is kept for Claude Code's own sign-in and isn't passed to sessions), read only by the SDK (never printed or written). The base URL is pinned to `https://api.anthropic.com`.
- **Approved sheets:** `docs/boss-lines/approved-sheets.json` (an array of sheets, edited by hand from a sheets run's `results.json` once Eric has corrected them). A boss with a sheet there keeps it in every mode: no new sheet is written, and its lines are written from it.
- **Spend:** `BOSS_LINES_CAP_USD` (default 3). Every response's real usage is added up at Opus 5.5's prices ($4 / $20 per million tokens). A call whose worst case (its input plus a full 12,000 output tokens) could pass the cap isn't sent, and the run stops with what it has.
- **Files:** `packs.ts` (what the repo says about each boss), `lore.ts` (where each boss's lore comes from), `prompts.ts` (the prompts and JSON schemas), `rules.ts` (the automatic check), `api.ts` (the SDK call and the spend guard), `main.ts` (the modes and the report).
- **Output:** `packs.json`, `results.json` (every line as first written, after the critique, and the check's verdict) and `sample.md` (readable, with the cost).
- **Typecheck:** `npx tsc -p scripts/boss-lines --noEmit`.
