# XP phase 2: an admin grants up to 100 keys at once (Nov 9, 2026)

The brief: raise the admin test grant so Eric can grant himself 100 keys at once, now that every crate takes one.

- `BOSS_TOKENS.keysGrantMax` = 100 (tokens stay at `grantMax`, 10). Through the ledger as before (reason "admin grant").
- **How Eric does it:** signed in as his admin account, Shop → Crates → "Admin: test grants" → **+100 crate keys** (one tap = 100 keys;
  tap again for more). No email or id of his is in the repo: who's an admin stays the Worker's `ADMIN_EMAILS` secret.
