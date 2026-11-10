# Core modules traced by default; a new unplaced file fails `check` (Nov 10, 2026)

Pipeline audit F3 (Nov 9): new core modules (xp.ts, pawn-color.ts) ran every e2e spec on their PRs until someone listed them by hand.

- Every `packages/core/src/**/*.ts` but `index.ts` is traced (`TRACED_BY_DEFAULT` in `e2e/ci-select.mjs`); the hand-kept core list is gone.
- A new traced module is followed from everything it exports (code outside a declaration still runs everything); a removed one still runs everything.
- `check` fails when a PR adds a file under `packages/` (or a spec) that no area, `traced`, `none` or `full` entry places. The call: a `full` match counts as placed (board/, schemas: deliberately shared).
- Not mapped here: `packages/app/src/haptics.ts` and `packages/server/src/typed-chat.ts` already exist unplaced and still run everything; their lanes can place them.
