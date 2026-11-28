# The daily ledger check failed for three weeks unseen (Nov 28, 2026)

The check said "4 accounts' balances and ledger disagree" every day from its first run (Nov 7) to Nov 28. No code path skips the
ledger: all four hold only rows from before it (Oct 4 to Nov 6), and the backfill meant to record them was shelved on Nov 7
("will pick that up another day"). It went unseen because one error a day never reaches ops:report's "Needs attention", and alerts
are off. The call: fix the silence, not add a check. The health view lists the schedule's failed jobs apart from the top errors, and
ops:report puts each under "Needs attention". The repair is the backfill, once, run by the director after review.
