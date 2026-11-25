# The HunChess Welcome Crate (Nov 6, 2026)

Eric, Nov 6: "A welcome crate: you get it for completing 5 games in any mode or any boss. It contains a special HunChess-colored
random rider, with a HunChess-theme gold and black crate. Never tradeable. Purity isn't listed for these. Limit one per account.
Something on it which says 'Thank you for being an early tester!', and also a note saying not tradeable. See if you can do all the
colors for all the riders and the crate and the UI wiring." How it works: [shop.md](../areas/shop.md), "The Welcome Crate".

Then, the same day: "the first one you get after 5 games, the next one you get after 25." So there are two Welcome Crates, at 5 and
25 finished games (`WELCOME_GIFT.milestones`), each once per account under the same rules; the second looks the same and holds a
HunChess ride different from the one the first gave.

The calls made here, each easy to change:

- **Each once per account, ever, by the server.** A table `welcome_crates` keyed by the account and the milestone (PRIMARY KEY
  (`user_id`, `milestone`)). The grant is one statement over both milestones: it inserts a milestone's row only while the account is
  signed in (an email or a Google account) and its finished games, counted in that same statement, reach it (5, then 25:
  `WELCOME_GIFT.milestones` in settings.ts); `ON CONFLICT DO NOTHING` makes a second grant of either a no-op. So retries, races, two
  tabs and two Workers can't grant two of either (tested: 12 grants at once at 5, 10 at once at 25). Nothing the app sends asks for it.
- **The second's ride is a different one.** Opening takes the earliest unopened crate. Its roll leaves out every ride an earlier
  Welcome Crate of the account gave (kept on its row, `def`, so deleting the first ride doesn't let it come again), and the insert
  checks that in the same transaction: two opens at once with both crates waiting open both, with two different rides (the loser of
  the check rolls again). Only if every ride had been won would a repeat be allowed (it can't happen with two crates).
- **What counts as a finished game.** Every row of `results` (online matches written by their rooms: Classic, Crowd and 50 v 50, boss
  raids, friends' lobbies, Squads; and solo matches, saved by the app from their result screen) plus every ranked 1 v 1 game
  (`ranked_1v1.games`; aborted ones are never recorded). A match left before its first move is never recorded. **Abandoned** matches
  don't count: a new `results.abandoned` column, 1 when the match room recorded the player as gone too long (`away`), idle (`afk`) or
  removed (`kicked`) mid-match; a resignation is a loss, a result, and counts. Only a room sets it; the app can't.
- **What's missed or approximate** (counted from what's stored): auto chess (played on the device; nothing reaches the server), a
  ranked game while fair play held the player (its record isn't written), and results from before today, which have no `abandoned`
  and all count (an online match abandoned before Nov 6 counts as finished). A solo result is the device's word, as every solo result
  is: a script could post 5 to earn the crate early. It gains one cosmetic it would earn in 5 quick games anyway, can't be repeated
  (one per account) and can't be traded on, so it's left as is.
- **The backfill:** the grant check runs on every profile load (`/api/me`: each sign-in and app start) and after every saved result,
  ranked game and Squads placement. An account that had 5 finished games before today gets the crate the next time it opens the app or
  finishes a game.
- **Guests and bots never get one:** the grant needs a signed-in account; bots have none. A guest's games join the account it signs in
  to (as they always have) and count there. The sign-in merge drops any welcome row under the guest (there can't be one) rather than
  moving it, so an account never holds two.
- **The notice** ("You earned a Welcome Crate!") shows once, in the boss token box's look, on home and on a match's result screen (where
  the token box shows); OK, Escape or a tap outside closes it for good (`welcome_crates.seen_at`).
- **The prize.** One random ride, each of the game's rides as likely, rolled by the server's own randomness (never a test switch) and
  stored as an `items` row (crate `welcome-hunchess`). Its id is the ride's with `-hunchess` (`balloon-pup-hunchess`), so it never
  stacks with, collides with or upgrades a normal copy. Opening is one transaction: the ride goes in only while the crate is unopened,
  and the crate is marked opened with that ride only if it went in; a second open answers the same ride (`again`), a rollback partway
  leaves the crate unopened and no ride.
- **The colorway, for every ride:** one remap for all of them, an SVG filter on each ride layer (never the pawn): the ride's light picks
  the palette (deep black, soft black, the logo's gold, light gold, cream) and a thin gold trim goes round it, so a dark ride never
  vanishes on a dark page. Levels per ride where the remap failed: only the Rodeo Bull (nearly all dark brown) is lifted. Lifting the
  bulb, the log and the moon was tried and dropped (it washed them out to cream). A new ride gets its colorway with no change.
- **Its stored finish:** yellow (paints the colored parts gold), a two-color ride's second part midnight (black), blemish 0. **No
  purity is shown** for the crate or its rides: not on the crate page, the reveal, the locker tile or its label, the delete
  dialog, or a profile's Wearing row ("Ride · HunChess gold & black · Not tradeable"); no shine on them anywhere.
- **Never tradeable, never listable.** There is no trading, gifting or listing in the game today (Nov 6: nothing in the server's
  routes or the app moves an item between accounts but a guest's sign-in). `tradeable()` in core says no for the crate and every
  HunChess ride, with `NOT_TRADEABLE` as the refusal: whatever trade or listing path comes must ask it on the server. "Not tradeable"
  shows on the crate's row and page, the notice, the reveal and each HunChess ride's locker tile.
- **Deleting** a HunChess ride from the locker works as for any item (hold, confirm); it isn't given again.
- **Admins** own one of every item (Eric, Oct 31), so they get an admin copy of each HunChess ride too (never stored).
- **Its look in the app:** the crate's own art (black chest, the logo's gold `#f2c14e` trim, bands, corners and pawn, "HUNCHESS",
  an idle glint every few seconds, still under reduced motion), first in the Crates tab; its page lists every ride it can give, each as
  likely; the opening is the Crates tab's own strip, landing on Fischer Random ("A HunChess ride"), then the ride.
- **Progress hint:** the next milestone's, on the crate's row and page: "Finish 5 games to earn your Welcome Crate: 3/5", then
  "Finish 25 games for your second Welcome Crate: 7/25" (a guest's adds "Sign in to earn it."); "You have 1. Open it!" while one
  waits; "Both opened. Their rides are in your locker." at the end. The notice fires for each. The app's `welcomeProgress()`
  (account.ts) answers `{ next: 5 | 25 | null, done }` from the account as loaded, for a tutorial's hint.
- **The backfill covers both:** an account with 25 or more past finished games gets both crates on its next app load.
- **Stored** (all new; older data reads as "not earned yet"): table `welcome_crates` (`user_id`, `milestone`, `granted_at`, `games`,
  `seen_at`, `opened_at`, `item_id`, `def`), column `results.abandoned` (NULL on every older row), and the ride as an ordinary `items` row. The account's
  download has it ("welcomeCrate"), deleting the account erases it.

Lane: full (stored data, fair play, the shared core).
