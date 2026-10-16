# Buying with coins is one transaction (Oct 16, 2026)

**The bug** (found by an independent review): `buyItem` read the wallet, checked the price against it, then took the
coins and granted the item in two separate statements, with no check in the write itself. Two buys at once (two taps,
two devices) both passed the check: two different items could take the coins below zero, and the same item was paid
for twice (the grant's `INSERT OR IGNORE` gave it once). Harmless only because `SHOP_FREE` makes every price 0; it had
to be right before coins are ever spent.

**The fix:** the charge and the grant are one D1 batch (D1 runs a batch as one transaction), `Sql.batch` (the same
shape as #240's, so the two merge cleanly):

1. `UPDATE wallets SET coins = coins - ? WHERE user_id = ? AND coins >= ? AND NOT EXISTS (the item owned)`: the coins
   come off only if they're still there and the item still isn't owned;
2. `INSERT INTO inventory … SELECT … WHERE changes() = 1`: the item is granted only if that update changed the row.

Afterwards one read says how it went: the item is owned (bought now, or by the other buy at once: a no-op success,
as before), or it isn't, and the answer is "Not enough coins." as before. The free path (price 0, while `SHOP_FREE`
is on) is the plain `INSERT OR IGNORE` it always was, so it still needs no wallet.

**Why one batch:** it's the smallest change that is truly atomic on D1, which has no `BEGIN`/`COMMIT` for a Worker.
`changes()` is SQLite's count of rows the previous statement changed; a batch runs its statements in order on one
connection, so the grant sees the update's count (0 when the update matched nothing, never an older statement's).
Checked on the local D1 (`wrangler`'s workerd, the one `npx wrangler dev` runs) and in node's SQLite: one item twice
at once is charged once, two items with coins for one buy exactly one, and a short wallet after a write that changed
a row grants nothing. Production D1 couldn't be tried from here.

Tests: `packages/server/test/shop-buy.test.ts` (with `SHOP_FREE` off); the two at-once tests fail on the old code.
