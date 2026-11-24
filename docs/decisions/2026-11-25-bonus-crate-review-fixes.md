# The bonus crate: the review's fixes (Nov 25)

- **What:** the independent review of #923 (no blocker) asked: a double tap on the bonus card's OK must not open another crate (M1);
  the card must not be skippable by a fast Done or Open another (M2); the odds line exact (N3); `?bonus=0` none (N4); an empty pool no
  throw (N5); the Crates tab's copy (N7); the dialog's focus (N8).
- **Calls:** M1 by the item's buttons being `inert` while the card is up and `BONUS.calmMs` (300 ms) after OK, not by moving OK: one
  mechanism also keeps the keyboard off them (N8). M2: Done or Open another with a bonus not yet seen shows its card and does nothing
  else; OK then goes back to the item's card as always (one path, not a remembered action). The crate's unseen record clears on OK.
- **The odds line** gives each crate's share two ways (today 13 crates: "about 7.7% each, so about 1.9% of openings for each"), so it is exact whichever
  share a reader means.
