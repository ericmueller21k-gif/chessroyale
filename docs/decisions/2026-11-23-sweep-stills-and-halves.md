# Old stills branches cleaned up; chess test halves split by time (Nov 23, 2026)

Eric, Nov 23, answering the bloat sweep: stills cleanup "7 days after merge"; chess halves "Yes, rebalance".

- `branch-cleanup.yml` now deletes a `stills/*` branch 7 days after the last merged PR whose body names it, and keeps it while an
  open PR names it. Call: a stills branch no PR names (a mockup or sheet sent only in chat) goes once its tip is 30 days old.
- `check.yml`'s chess halves: half 1 is the typecheck plus the six slowest files by CI's own times (one list, `HALF1`), half 2 the
  other 66. Was vitest's `--shard`, which split by file count (1 : 2.8 by time). Estimate: about 3 min off `check` per PR.
