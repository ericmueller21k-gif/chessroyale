# Typecheck the e2e tests (fix the cause: e2e type errors only show in CI, 25 min later)

Effort medium (tooling; no game code unless a type error points at one). Light lane. New branch `claude/e2e-typecheck` from `origin/main`.
Read `CLAUDE.md` ("Fix the cause, not add a checker"). Why: on Nov 15 a helper removed `box()` from `e2e/lobby-chat.spec.ts` while a
second test still called it; `npm run typecheck` passed (it runs `tsc -p` for packages/core, chess, sim, app, server, maia-worker only:
nothing for `e2e/`), and CI's e2e found "ReferenceError: box is not defined" half an hour later (#724).

Do: add an `e2e/tsconfig.json` (extending `tsconfig.base.json`, `noEmit`, the libs/types the specs need: DOM for `page.evaluate`
bodies, node, Playwright) and add `tsc -p e2e --noEmit` to the root `typecheck` script, so CI's `check` job runs it too (check
`.github/workflows/check.yml` calls `npm run typecheck`). Then fix every error it finds: real bugs (a missing name, a wrong field) fixed
in the spec; looseness that only needs a type (`as`, an annotation) typed, never `// @ts-ignore` or `any` sprinkled to silence it
(an `any` on a `window` hook read is fine where the specs already do it). If the error count is large (over ~150), stop after the config
and the first clear group, push, and list the rest by kind in `.pr-body.md` for the director to decide. Also the scripts the e2e uses
(`e2e/*.mjs`) stay out (they're JS). Keep `e2e/areas.json` right if the plan needs the new file (a shared foundation, or traced).
Prove: `npm run typecheck` green, and how long it takes before/after. Push; `.pr-body.md` (what changed, errors found and how each kind
was fixed, any real bug found, checks changed: none expected); `.done`. No PRs, no CI waits, no model names in commits (end commits with
the Claude-Session line only). About 45 minutes.
