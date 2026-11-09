# Ranked L1: left for later phases (Nov 9, 2026)

- "A second 8+ in a season locks for 7 days and opens a fair-play case": seasons don't exist yet (S1), and fair-play flags are
  A1. Today every 8+ is the 24-hour lock.
- Team modes' leaves (50 v 50, Squads, Duo): T2/T3. `ranked_conduct.mode` is "1v1" for now; the window already counts across
  modes once they write to it.
- Ops: the counts are `countCall`s (`ranked.dodge`, `ranked.leave`, `ranked.locked`, `ranked.delayed`) in /admin/ops' call
  counts, not a page of their own.
- The 1 v 1 queue bar (browsing while queued) still says "Searching 1 v 1": the stage has the delay's countdown.
- Lockouts are per account: a second account (or a second device signed in to another account) isn't locked. The queue already
  hashes the device (two accounts on one device never meet); checking a device's latest lockout too is left for A1.
- While fair play holds a player (in review), their ranked games don't count (`games` doesn't move), so their marks don't age out
  of the last-20 window during the hold. The FAQ says "every ranked game you finish that counts for your rank".
