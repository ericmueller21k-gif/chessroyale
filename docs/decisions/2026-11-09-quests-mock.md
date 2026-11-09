# The daily quests overlay: a mockup in the real app (Nov 9, 2026)

- **Eric (Nov 9):** likes about 90% of his ChatGPT reference (notes/briefs/assets/quests-overlay-eric-ref.png); make it "close to what it would actually be" in our game's style.
- **What changed:** `QuestsOverlay` (props in, callbacks out) shown over home with fake data behind `?quests=mock|done|entry`; a Quests entry on your card. No server or storage.
- **Calls made:** our art only (a boss's portrait, the board's cburnett pieces, the shop's Winter crate and key), plain CSS frame (gold border, black crest and title banner); the reroll is a small round button on each daily's top-left corner (always there, greyed when used or done); the weekly sits under its own "Weekly · Resets in 4d" label, tinted gold.
- **The entry's place:** the phone's top bar has no room for a fifth button at 320 px, so it's on your card: top right on a computer, bottom right on a phone (a tall card's tag sits at its top), icon only on a short card, whose corner is kept free (the tag recenters 26 px left there). Open for Eric.
