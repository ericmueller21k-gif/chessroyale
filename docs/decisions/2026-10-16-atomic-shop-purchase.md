# Buying with coins is one transaction (Oct 16, 2026)

**The bug** (found by an independent review): `buyItem` read the wallet, checked the price against it, then took the
coins and granted the item in two separate statements, with no check in the write itself. Two buys at once (two taps,
two devices) both passed the check: two different items could take the coins below zero, and the same item was paid
for twice (the grant's `INSERT OR IGNORE` gave it once). Harmless only because `SHOP_FREE` makes every price 0; it had
to be right before coins are ever spent.

**The fix:** the grant and the charge are one D1 batch, which D1 runs as one transaction: all of it or none
(`Sql.batch`, added by #240).

1. `INSERT INTO inventory … SELECT … WHERE EXISTS (the wallet has coins >= price)`: the item goes in only if the
   coins are there. A plain `INSERT`: if the item is owned by then, it fails on the primary key, and the batch fails
   and changes nothing.
2. `UPDATE wallets SET coins = coins - ? WHERE … coins >= ? AND EXISTS (the item owned)`: the coins come off.

When step 1 put the item in, step 2 always takes the coins. Inside one transaction nothing else can write between
the two statements, and step 1 doesn't touch the wallet, so the coins step 1 saw are still there. A failed batch
changes nothing. So there's no way to pay without getting the item, or to get it without paying.

Afterwards one read gives the answer:
- the item is owned (bought now, or got by another buy at once): a no-op success, as before;
- it isn't, and the batch went through: "Not enough coins.", as before;
- it isn't, and the batch failed (D1 down): that error, with nothing charged.

The free path (price 0, while `SHOP_FREE` is on) is the plain `INSERT OR IGNORE` it always was, so it still needs no
wallet.

**Why this form (review, Oct 16):** the first version took the coins first and granted the item `WHERE changes() = 1`.
It worked on the local D1, but Cloudflare doesn't document `changes()` across a batch. If it ever read 0, a player
would pay and get nothing. This form relies only on the batch's documented all-or-nothing. Checked on the local D1
(`wrangler`'s workerd) for no wallet, short, exact and extra coins, each with the item owned or not, plus the two
races. Production D1 couldn't be tried from here.

Tests: `packages/server/test/shop-buy.test.ts` (with `SHOP_FREE` off). The two at-once tests fail on the old code.
Also tested: an item owned by the time the write runs (rolled back, no charge, success), and a write that fails for
another reason (the error, no charge).
