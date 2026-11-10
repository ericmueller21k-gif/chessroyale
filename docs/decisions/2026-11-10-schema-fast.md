# The schema run: once per instance, 4 round trips (Nov 10, 2026)

Eric, after #618's deploy: "HunChess" on the splash for about 8 s. Every API request on a new instance ran the schema a statement at a time (134 round trips fresh, 97 for one column).
The call: one run per instance (other requests wait for it, 5 s at most: a cut-short request's run never ends); the CREATEs and triggers in one batch, the columns in one read, the new columns and the version in one batch. A refused batch goes one at a time, as before.
The local D1 refuses more than 5 UNION terms and `pragma_table_info` on an unnamed table; the test's fake does too.
