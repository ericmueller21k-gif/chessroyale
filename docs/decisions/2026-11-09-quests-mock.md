# The daily quests overlay: a mockup in the real app (Nov 9, 2026)

- **Eric (Nov 9):** likes about 90% of his ChatGPT reference (notes/briefs/assets/quests-overlay-eric-ref.png); make it "close to what it would actually be" in our game's style.
- **What changed:** `QuestsOverlay` (props in, callbacks out) shown over home with fake data behind `?quests=mock|done|entry`; a Quests entry on your card. No server or storage.
- **Calls made:** our art only (a boss's portrait, the board's cburnett pieces, the shop's Winter crate and key), plain CSS frame (gold border, black crest and title banner); the reroll is a small round button on each daily's top-left corner (always there, greyed when used or done); the weekly sits under its own "Weekly · Resets in 4d" label, tinted gold.
- **The entry's place (first round):** the phone's top bar has no room for a fifth button at 320 px, so it's on your card: top right on a computer, bottom right on a phone (a tall card's tag sits at its top), icon only on a short card, whose corner is kept free (the tag recenters 26 px left there). Open for Eric.

## Round 2 (Nov 9): Eric's changes

- **Eric:** "We have room for one more spot on mobile … That's where I want it to go." The Quests entry is now one more square button in a phone's top bar, beside your pawn, before the shop; the same 44 px as the others (36 px below 344 px). The card's entry stays on a computer (its top bar is hidden there, 1024 px and up), so the card's icon-only fallback is for a computer's short card only.
- **Measured at 320 px:** with the entry the row is 15 px short at 40 px buttons (the pawn overlapped it). Fix: below 344 px the round items are 36 px, the gaps 4 px and the logo 14 px. Fits with about 15 px to spare, "HunChess" whole.
- **The dim:** a plain dark overlay (rgba 0, 0, 0, 0.55) in light and dark, no blur (it cost a phone while home's pictures move).
- **The crest:** the HunChess app icon (`public/icons/icon.svg`, the browser tab's), in the same round crest, instead of the pawn.

