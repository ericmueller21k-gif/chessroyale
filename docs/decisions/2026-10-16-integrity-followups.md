# Three integrity follow-ups: a guest's whole file, one identity row per owner, code starts at once (Oct 16, 2026)

Found by the reviews of #240 (delete my account) and #244 ([2026-10-16-sign-in-races.md](2026-10-16-sign-in-races.md)).
None changes what a player sees.

## 1. A guest's reports and fair-play file join the account it signs in to

**The gap.** The guest merge (`signInWithIdentity`, one batch since #244) moved results, the shop, the locker and
sessions, but left the guest's reports (made and about it) and fair-play rows under the guest's id. The guest's user
row went, so no later "Delete account" could reach them. Worse, a guest's case stayed with the deleted guest: a
banned guest signing in to a clean account played on, unbanned. (Where sign-in is set up, guests can't play online,
so a guest's file comes mostly from reports. The merge must still be right.)

**Now** the same batch runs `fairPlayMoves` (`fairplay-schema.ts`, beside `shopMoves`, `lockerMoves` and
`socialDeletes`). For each table:

| Table | What happens | Why |
| --- | --- | --- |
| `reports` | Re-keyed: reporter and target become the account. A report between the guest and the account is deleted. | Reports follow the player. One between the two is the player reporting themselves, which `reportPlayer` refuses. |
| `fairplay_cases` | The guest's case moves if it's open or a ban (watch, review, banned) and stricter than the account's (banned > review > watch > none): its status and reason, the later `updated_at`. The account keeps its own opening date and decision (`decided_at`, `decided_by`) unless a ban comes in, which brings its own. A cleared or closed guest case doesn't move. The guest's row goes. | A case can't be shed by signing in. A decision date sets aside what was weighed before it (the level, the report count, and since the review the identity rows in `banCheck`). Keeping the account's is what a raise of its own case does: what a person weighed stays weighed, so a cleared account isn't banned again by a guest's watch. A cleared guest case would bring its decision date over the account's own evidence. |
| `fairplay_log` | Re-keyed, plus a line "merged" (by "sign-in") when the guest had a case. | A person reading the case sees where it came from. The line doesn't name the guest's id, which nothing keeps. |
| `fairplay_matches`, `fairplay_appeals` | Re-keyed. The guest's open appeal is deleted first when the account has one open. | The evidence and an open appeal follow the case. One open appeal at a time: when both have one, both are banned and the account's ban is the one kept. |
| `fairplay_devices` | Copied to the account (`INSERT OR IGNORE`: the account's own row wins), then the guest's deleted. | Device markers are evidence against ban dodging. |
| `fairplay_identities` | Nothing to move. | A guest has no email or Google account, so fair play never keeps an identity for it. |

Then the account's case does what `setCase` does as a case opens:
- If the guest's case was open, the account's evidence is kept the full `evidenceDays` and queued for the deep
  re-check.
- In review or banned, the account's online results of the last `holdBackDays` are held. Banned, all of them are,
  and the account's identities are kept (hashed), so a new account made with its email (a +tag, Gmail dots) is
  banned too.
- The rating is then worked out again from what counts, so a banned account has none.

That last step also fixes an older hole: a clean guest signing in to a banned account used to give it a rating from
the guest's results.

**Not moved, on purpose:** error records and bug reports (`ops_errors`, `ops_reports`). The app sends the account
id only when signed in (`problems.ts`), so a guest's rows carry none. They expire after `OPS.store.keepDays` anyway.

## 2. Each banned account keeps its own identity row

**The gap.** `fairplay_identities` was keyed by the identity alone, and a ban wrote `INSERT OR REPLACE`. When account
A is banned and a second account B with the same email (a +tag, or after A was deleted) is banned as evasion, B's row
replaced A's. Clearing B (a cousin's account, say) then deleted the only row. The email stopped being caught, though
A's ban still stood.

**Now** the key is (kind, hash, user_id), so each owner has its own row:
- A ban still writes `INSERT OR REPLACE`, which now replaces only its own row.
- Clearing still deletes `WHERE user_id = ?`, which now removes only its own rows.
- Deleting an account (#240) still writes `INSERT OR IGNORE`, now its own row.
- `banCheck` reads banned owners first (`ORDER BY`), so a review owner's row can't hide a ban.

We picked this over re-pointing the one row to another banned owner when one is cleared. Re-pointing can't find a
deleted account's identity once its row was replaced, so it would need the rows this design keeps anyway.

**A decision weighs the identity rows written before it.** Keeping A's row means B, once cleared, would be banned
again by evasion at its next check, which would make clearing it impossible. For an account with a decision on its
case (`decided_at`: a person's, the reviewer's, or a watch closing on its own), `banCheck` now leaves out two kinds
of row:
- **Rows written at or before that decision.** They were weighed when it was made.
- **Rows of accounts banned by evasion** (`fairplay_cases.decided_by = 'evasion'`, on the case row, so no extra
  read). An evasion ban only repeats a ban already recorded. Without this, the evasion ban of a third account with
  the address, written after B's clearing, would catch B again.

So B stays cleared through a report, a watch opened by detection, that watch closing, or a guest's watch case
merging in (the merge keeps the account's decision, above). A report or detection opens a watch or review on it,
never a ban. A real ban of another account with the identity, after the decision, does catch it.

An account with no decision counts every row, evasion bans included, as before: after A's ban is lifted, B's
evasion ban still catches a brand-new account with the address (`fairplay-admin.test.ts`, "evasion"; skipping
evasion rows for every account fails that test).

The identity-based review and the device check still skip a cleared account by its status, as before.

The first version (review of #246, Oct 16) skipped the identity check whenever the status was "cleared". Any report
moved the status to watch and undid it. A known gap that remains: any decision sets the line, a watch closing on its
own too. So an account whose watch closes after another account's real ban isn't caught by that ban, unless it asked
to play in between (it would have been banned then).

**The table is rebuilt once.** SQLite can't change a key. `ensureSchema` reads `PRAGMA table_info`. If `user_id`
isn't in the key yet, it runs `IDENTITIES_REKEY` as one batch: rename the table, create it with the new key, copy
the rows, drop the old one. Two Worker instances doing this at once both succeed, one after the other, rows intact.
After the rebuild the check finds the new key and does nothing.

## 3. Starting email codes at once sends one

**The gap.** `startEmailCode` read the address's row, checked the 30 s resend gap and the 5-an-hour limit, and
wrote later. Starts at once all passed (ten at once sent ten emails in a test). That isn't a way in, but it costs
money and can flood a victim's inbox.

**Now** it's one statement, like `verifyEmailCode`. An `INSERT … ON CONFLICT DO UPDATE … WHERE` writes the code
only if the last one went out 30 s ago or more and the hour has sends left (a new hour starts the count at 1), with
`RETURNING`. Only the start whose statement wrote gets `ok` and sends the email. A refused start reads `sent_at` only
to choose the message ("A code was just sent…" or "Too many codes…"). The limits and messages are the same as before.

## Checked

- **Unit tests**, each failing on the old code:
  - `account-data.test.ts`, "a guest signing in to an existing account": no row anywhere names the guest after a
    merge; a ban, its appeal, holds and identity follow; the stricter case wins; a cleared guest case stays behind.
    Its second describe: the account keeps its own decision when a guest's watch joins it (a cleared cousin stays
    cleared), while a ban brings its own; one open appeal stays.
  - `fairplay-admin.test.ts`:
    - clearing one of two banned owners keeps the email caught, and the cleared one isn't banned again by a third
      account's evasion ban;
    - a cleared cousin stays cleared through a report and its watch closing, and a later real ban of an alias
      catches it;
    - a banned owner counts before a review one;
    - the old table is rebuilt with its rows.

  Each review fix was also reverted on its own to check that its test fails.
  - `sign-in-races.test.ts`: ten starts at once send one code, which works; the hour's limit holds at once too.
- **One existing test changed with the design:** "an identity shared by two deleted bans" now expects a row for each
  banned account (it pinned one).
- **The local D1** (`wrangler`'s workerd, through `getPlatformProxy`), not just node's SQLite:
  - the rebuild in a batch;
  - an upsert's `RETURNING` through `first()`;
  - ten starts at once, then the hour's limit;
  - the merge with a banned guest, and the stricter-case upsert;
  - the cousin case, then the review's paths: a report, the watch closing, a guest's watch merging in (the decision
    kept), a later real ban of an alias; and one open appeal after a merge.

  Production D1 couldn't be tried from here.

**Not fixed (noted by the review):** a Google-only account banned through the merge gets its email's hash only if it
had the email before the batch, because `adoptGoogleEmail` runs after. `setCase` has the same gap.
