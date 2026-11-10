# Audit F3: every core module traced by default; an unmapped new file fails `check` (Nov 10)

Read first: CLAUDE.md, notes/briefs/rules-common.md (branch claude/director-notes), and section F3 of
notes/pipeline-audit-2026-11-09.md (same branch). docs/areas/ops.md "CI e2e". The code: e2e/ci-select.mjs, e2e/areas.json,
.github/workflows/check.yml and e2e.yml.

## The change
1. In `traceChanges` (e2e/ci-select.mjs), every `packages/core/src/**/*.ts` except `index.ts` is traced by default (the specs of
   whatever imports what the diff changes), and the hand-kept per-file core list in `traced.modules` goes. `index.ts` (and anything
   else that truly is a shared foundation: keep what's in `full` today apart from core) still runs everything.
2. A new step in the `check` workflow (fast, no browser): for the PR's added files under `packages/` (and `e2e/*.spec.ts`), fail if no
   area, `traced` or `none` entry in e2e/areas.json matches, naming the file and what to add. It should run in the first minute.
3. Unit tests for both (the repo already tests ci-select: extend those). Prove on 3-4 real recent PR diffs (e.g. the XP PRs that
   touched core/xp.ts, #590) that the selection is what you'd expect: print old vs new spec lists in the PR body (short).

Lane: targeted (CI selection is not gameplay; no e2e of your own needed beyond ci-select's tests). Effort high. Decision note
docs/decisions/2026-11-10-trace-core-by-default.md, at most ~120 words. Update docs/areas/ops.md "CI e2e" and CLAUDE.md's one line
about which paths are traced, in the same PR. Push to claude/audit-f3; when done, write .pr-body.md at the repo root (short: what
changed, old → new selection on the sample PRs, checks changed) and push. Don't open the PR.
