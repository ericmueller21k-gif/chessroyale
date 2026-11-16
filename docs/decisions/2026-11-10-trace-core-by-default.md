# Core modules traced by default; a new unplaced file fails `check` (Nov 10, 2026)

Audit F3 (Nov 9): unlisted core modules (xp.ts, pawn-color.ts) ran every e2e spec on their PRs.

- Every `packages/core/src/**/*.ts` but `index.ts` is traced (`TRACED_BY_DEFAULT` in `e2e/ci-select.mjs`); the hand-kept core list is gone.
- A new traced module is followed from everything it exports (code outside a declaration still runs everything); a removed one still runs everything.
- `check` fails when a PR adds a file under `packages/` (or a spec) that no area, `traced`, `none` or `full` entry places. The call: a `full` match counts as placed (deliberately shared).
- Left for their lanes: `app/src/haptics.ts` and `server/src/typed-chat.ts`, already unplaced, still run everything.
