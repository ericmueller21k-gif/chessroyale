# The shop page, look first (Eric, Nov 9): his ChatGPT mockup, our own art, the beta discount

Mockups (look at both): `notes/briefs/assets/shop-eric-mockup.png` (the page) and `assets/shop-eric-discount-ribbon.jpg` (the 50% OFF
ribbon and the clock badge). The approved Boss Crate: `assets/boss-crate-mock-approved.png` (its SVG source: `boss-crate-mock-make.py`).

Eric: "we do want to follow basically the screenshot I sent you of how it designed that. I like that a lot. Pretty much exactly how it
is, but obviously we'll need our own artwork inserted where the keys are and where those mystery crates are." Phone: the page scrolls
(a 2-column grid). Computer: not 2x2: 4 items a row. **Look only: no real purchase wiring yet** (Stripe and coin purchases come next);
a price tapped shows a small note "Buying opens soon" (nothing hidden: the buttons are there).

## The page (Shop tab of the Shop screen, packages/app/src/screens/Shop.tsx; the Crates and Locker tabs unchanged)
- The line under the tabs: "Everything in the shop is 50% off during beta." (replaces "Nothing is for sale right now…").
- **Special offer** banner, full width, dark with gold (as the mockup): "SPECIAL OFFER" tab, "Crate + Key Bundle", "3 Keys + 3 Random
  Crates", "Includes a chance at a Mythic Crate.", its price pill. Its art: OUR art: three mystery crates (the HunChess crate's shape
  and colors with a gold "?" seal, the Boss Crate's seal style) stacked, and three of our KeyArt keys fanned, with a soft gold glow.
  No AI-looking art: drawn as SVG in components/Items.tsx's style (LINE, gold gradients).
- **Grid of item cards** (white cards, art, name, one-line description, price pill): Boss Crate (the approved art, "?" seal: "A random
  boss's crate. Opens without a key."), HunChess Crate, Gift Crate (WinterCrateArt; limited), Beta Crate (BetaCrateArt; limited), and a
  Crate Key card (KeyArt). Keep the mockup's sizes, spacing and type.
- **Limited items:** a gold clock badge in the card's top-left corner; tapping it opens a small pop-up: "Limited: a rotating shop item.
  It leaves the shop when its time is up."
- **Beta discount (logic, in settings):** `SHOP.discount = 0.5` (0 = none). Every card and the bundle get a red corner ribbon "50% OFF"
  (top right, as `shop-eric-discount-ribbon.jpg`), the full price struck through and the discounted price beside it in the pill.
  Ribbon text from the setting (50% → "50% OFF"); no ribbons and no strike when the discount is 0.
- **Prices** (full price, coins; in settings `SHOP.prices`; the director's numbers, from the coin economy: a game pays about 1.8 coins a
  minute, at most 70, 20 paying games a day): Crate Key 250, HunChess Crate 100, Gift Crate 150, Beta Crate 150, Boss Crate 400 (opens
  without a key), Crate + Key Bundle 900. With 50% off: 125, 50, 75, 75, 200, 450.
- Coin icon: the one the shop already uses for your coins (top bar), not a new gold coin.

## The Mythic Crate (new, Eric: "the exceedingly rare crate … straight like a legendary crate … effectively the same thing as a Fischer
random spin"; not called Fischer)
- Art: a new crate in our style, clearly the rarest (deep purple/black with bright gold, a crown emblem, a subtle shimmer that respects
  reduced motion). Add it to Items.tsx (MythicCrateArt) and show it in the bundle's line ("a chance at a Mythic Crate" with a tiny
  icon if it fits).
- Its definition only as a note now (docs/decisions): it holds what a Fischer Random pull holds (Legendary or Mythic only); the bundle's
  random crates each have a small chance (setting `SHOP.bundleMythicChance`, e.g. 0.05) of being a Mythic Crate. Wired with purchases later.

## Notes to add (no work now)
- ROADMAP.md: "Riders in regular crates (Eric, Nov 9)": a few rides that have nothing to do with the bosses, put in the regular crates
  (HunChess, Gift, Beta) to make them worth buying, since rides are the most wanted items. Next after the shop page.

Lane: targeted (shop screen, art, settings; no stored data, no money moves). Effort high. Tests: one focused e2e check in the shop spec
(the banner, the cards, the ribbon and struck prices from the setting, the clock pop-up, "Buying opens soon"; phone 2 columns, computer
4) and a unit test for the discount math (rounding). Update docs/areas/shop.md; a short decision note. Stills (deviceScaleFactor 2):
phone 390 light and dark (top and scrolled), 320, and a computer width, on orphan branch `stills/shop-page`, plus a sheet of the new art
(the bundle art and the Mythic Crate) at 512 px.
