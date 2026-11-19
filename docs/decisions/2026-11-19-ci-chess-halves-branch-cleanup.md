# The chess unit tests in two halves; old review and audit branches cleaned up

Eric, Nov 19 (on the bloat sweep's N2 and Q3): "that sounds fine. Yes, it can delete those."
- `check.yml`'s `chess` job runs in two halves (`vitest --shard`), the typecheck on the first: the tower's kit and layer tests had
  doubled it (195 s → about 470 s) and it set every PR's `check` time. Every test still runs on every PR.
- `branch-cleanup.yml` also deletes `review/*` and `audit/*` branches (they never merge) once their tip is over 3 days old.
