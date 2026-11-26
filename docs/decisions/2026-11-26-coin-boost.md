# Coin boost and Crate Bonus (Nov 26, payments PR 4)

Eric, Nov 18: "2.5 times coin boost for your next certain hours of play", from a crate that "occasionally drops from a daily quest"; a crate bonus: "your next 5 level-ups give double crates". Built as the design's section 7 (`COIN_BOOST`, `LEVEL_CRATE_BONUS`; art is placeholder). Calls:
1. The drop is rolled from the quest op's key, which holds the hidden ledger id: the same on every retry, checkable from the ledger, unguessable from a quest's id (no reroll farming).
2. The boost runs only in games that paid play coins (counted minutes, at least 1): past the day's 300 it waits, so a crate is always worth about 420 coins. A game partly in it gets that share.
3. "Level-ups" are the paying ones (every 2nd level); keys stay 1.
4. Stored as three wallet counts moved only by the ledger. The FAQ says hours (its XP section never says minutes).
