# Sign-ins at once: a guest's merge is one transaction, a code works once (Oct 16, 2026)

Found while fixing the shop's double charge ([2026-10-16-atomic-shop-purchase.md](2026-10-16-atomic-shop-purchase.md)).
Both bugs read a row, decided in code, and wrote back later, so two requests at once both acted on the same read.

**A guest's wallet was credited twice.** When a guest signs in to an existing account, the merge read the guest's
coins and crates, added them to the account, and only later deleted the guest's wallet. Two sign-ins at once (two
taps on "Verify", two tabs finishing Google) both read the wallet before either deleted it, so the account got it
twice (100 coins became 200 in a test).

**Now the whole merge is one D1 batch (one transaction).** That covers:
- the results re-keyed and the rating refreshed;
- the items, equipped choices and chat picks copied (`INSERT OR IGNORE`);
- the wallet added to the account's (`INSERT INTO wallets … SELECT … FROM wallets WHERE user_id = <guest> … ON CONFLICT
  … DO UPDATE`);
- the locker moved;
- the guest's rows, sessions, friends' rows and user deleted.

The statements come from `shopMoves` and `lockerMoves`, beside friends' `socialDeletes`. Wallet-only was the
first version. The review (Oct 16) asked for the whole merge, because a buy in another tab could otherwise land in
the middle. It could be charged, have its item put under the guest after the items were copied, then lose the item
when the guest's items were deleted. Now:
- **A second merge** runs wholly before or after the first; after it, the guest has nothing left to move.
- **A buy** lands wholly before the merge (its item and its charge move with the guest) or wholly after it (no guest
  wallet: "Not enough coins.", nothing charged). This holds once the buy is one batch too, as #243 makes it.
- **A merge that fails** (D1 down mid-way) moves nothing.

**One email code worked twice, and tries at once weren't counted.** `verifyEmailCode` read the code's row, compared
the hash, then marked it used (or counted the wrong try). Two checks of the right code at once both passed (both
signed in, and with the merge above, both credited the wallet). Worse, the 5-try limit was checked against the read,
so any number of guesses sent together were all checked against the code: the limit that makes a 6-digit code safe
didn't hold. Now it's one statement:

```sql
UPDATE email_codes SET attempts = attempts + 1, expires_at = CASE WHEN code_hash = ? THEN 0 ELSE expires_at END
WHERE email = ? AND expires_at >= ? AND attempts < ? RETURNING expires_at = 0 AS used
```

Each check takes a try only while the code is live and has tries left, and a right code is used up in the same
step. Only the check whose statement used it up gets in. A right code now counts as a try too, which changes nothing
because it's used up. The limit is still 5 tries, the code still works once for 10 minutes, and the player sees the
same messages.

**Checked** on the local D1 (`wrangler`'s workerd) as well as node's SQLite:
- two wallet moves of one guest at once credit it once, and a move into an account without a wallet makes one;
- `RETURNING` through `first()` works on a write;
- the right code checked twice at once gives one `used: 1` and one nothing;
- ten wrong guesses at once count 5 tries, and the right code is refused after them.

Production D1 couldn't be tried from here.

**Tests:** `packages/server/test/sign-in-races.test.ts`, with `SHOP_FREE` off:
- the two merge races and the two code races, which fail on the old code;
- a whole buy run before each step of a sign-in, and after it: the item and the charge go together, never one
  without the other;
- a merge whose batch fails: the guest keeps everything and the account gets nothing.

Both of the last two fail with the wallet-only version.

**Left for later:** `startEmailCode` has the same read-then-write shape. Starts at once can send more codes than
the 30 s and 5-an-hour limits allow. That's more email for an address, not a way in, so it isn't fixed here.
