# The typecheck covers the e2e specs (Nov 15, 2026)

Why: a spec's removed helper (`box()` in lobby-chat, #724) passed `npm run typecheck` and failed CI's e2e half an hour later.
Fix the cause: `e2e/tsconfig.json` (the base config, DOM, node, vite/client, Preact JSX for the app modules specs import) and
`tsc -p e2e` in `npm run typecheck`, so `check` catches it. 89 errors fixed by typing (no `@ts-ignore`); one real bug (tiger's pump
fallback read `w` off a bounding box). `e2e/tsconfig.json` is in areas.json's `full` like the base config; `perf-probe.d.ts` in `none`.
