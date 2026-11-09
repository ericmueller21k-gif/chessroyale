# Ranked L1: left for later phases (Nov 9, 2026)

- "A second 8+ in a season locks for 7 days and opens a fair-play case": seasons don't exist yet (S1), and fair-play flags are
  A1. Today every 8+ is the 24-hour lock.
- Team modes' leaves (50 v 50, Squads, Duo): T2/T3. `ranked_conduct.mode` is "1v1" for now; the window already counts across
  modes once they write to it.
- Ops: the counts are `countCall`s (`ranked.dodge`, `ranked.leave`, `ranked.locked`, `ranked.delayed`) in /admin/ops' call
  counts, not a page of their own.
- The 1 v 1 queue bar (browsing while queued) still says "Searching 1 v 1": the stage has the delay's countdown.
