# A crate opening is seen the moment Done, Wear or Open another is tapped (Nov 25)

- Cause of crate-banner.spec.ts:118's retry-pass (main, Nov 25): an opening was marked seen only by the card's "formed" timer
  (cardAt + cardMs), but its buttons work from the card's first frame. A quick Done closed the round with `hunchess-crate-unseen` still
  set, and the next visit to the crates resumed the old reveal over the list. A real player bug, not only a test's.
- Fix: Done, Wear and Open another mark it seen themselves (a bonus not seen yet still comes first, and still keeps it unseen).
- Check: crate-banner.spec.ts's first test taps Done on the card's first visible frame (opacity < 1), then reopens the crates: the
  list, no reveal. It failed before the fix.
