# Boss art

A boss character drawn by the Claude API (Opus 5.5), for review. Nothing here goes into the game: an approved drawing
is moved into `packages/app/src/characters/` and wired by hand (or by a helper).

```sh
npm run boss-art -- <id> <brief.md> [refs dir]
```

- **How it works:** the model works in a loop with tools, the way a helper does.
  - It reads the game's sprite format, the art guide (`.claude/agents/characters.md`) and finished bosses (read only).
  - It writes or edits its one drawing (`out/<id>/<id>.ts`).
  - It renders it and looks at the result: one animation's frames at up to 4x, and the idle at phone size beside another boss.
  - It looks at the brief's reference pictures, and fixes what reads badly until it calls `done`.
- **Key:** `BOSS_LINES_API_KEY`, as for boss lines (`scripts/boss-lines/api.ts`), read only by the SDK (never printed or written). The renders run in a process of their own without it in the environment, since they run the drawing's code.
- **Spend:** `BOSS_ART_CAP_USD` (default 20), and at most `BOSS_ART_MAX_TURNS` turns (default 90).
  - Every turn's real usage is added up at Opus 5.5's prices ($4 / $20 per million tokens; cache writes $5, cache reads $0.20).
  - A turn whose worst case (the cached conversation read again, the new part written, a full 48,000 output tokens) could pass the cap isn't sent; the run stops with what it has.
  - Each tool result tells the model what's been spent, so it can pace itself.
- **Output** (`scripts/boss-art/out/<id>/`):
  - `<id>.ts`, the drawing;
  - `summary.md`: the spend, the turns, its notes;
  - `log.jsonl`: each turn's tokens and dollars;
  - `preview/`: the repo's preview of every animation (GIFs, the frame sheet, the comparison);
  - `looks/`: every picture it looked at.
  - The drawing, the summary and the log are committed; `preview/` and `looks/` aren't.
- **Typecheck:** `npx tsc -p scripts/boss-art --noEmit`.
