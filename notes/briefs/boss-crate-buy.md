# The Boss Crate card in a boss's room: the price line's look, Boingo's crate's stray stripe, and a "You bought it" pop-up (Nov 12)
You are the item-builder delegate for HunChess (repo ericmueller21k-gif/chessroyale; read .claude/agents/item-builder.md). Effort: high
(UI with logic after a purchase; the purchase and the opening themselves are unchanged: the server's routes, prices, odds and wallets stay
exactly as they are; if a fix needs to touch them, stop and report). Read CLAUDE.md, .claude/LESSONS.md, docs/rules/eric.md,
docs/areas/shop.md and town-square.md, docs/decisions about the boss crates (grep "Boss Crate"). Code:
packages/app/src/town/shops/ShopRoom.tsx (the `card === "crate"` sheet, its `buy`, `msg`), shops.ts (priceLine, holdLine, buyBossCrate),
the Crates screen (packages/app/src/screens/Crates.tsx) and how a crate is opened there, packages/app/src/town/town.css and styles.css.

Eric, Nov 12, with a screenshot of Boingo's Boss Crate card (branch claude/director-notes,
notes/mockups/2026-11-12-eric-boingo-crate-sheet.png):
1. "that thing is not only the wrong shape, it's the wrong color... white text... all wonky": the price line ("3 Boingo tokens, or 1
   Boingo token + 1 crate key") shows as a cream pill with white text. Director's finding: the room's `<p class="shop-price">` shares its
   class with the Shop screen's price button (`.shop-price` in styles.css: a cream pill), which wins over town.css's plain line. Fix: give
   the room's line its own class (e.g. `shop-room-price`) and keep the Shop screen's untouched; check the e2e selectors that read either.
2. "even the crate looks weird... on the right side of the crate. It's like yellow at the bottom": Boingo's crate (boingo-art.ts `crateCv`)
   draws its last gold stripe at x 27-29 while the box ends at x 28, so a yellow column pokes out past the right edge below the red.
   Fix only that: keep every stripe inside the box (no redesign: Eric has more revisions coming for his room and its drawing; hold them).
   Check the other bosses' crate drawings for the same overflow and fix any the same minimal way.
3. "I just bought his box, and it just deducted my tokens... but nothing popped up... There should be another pop-up that says that you
   bought it, and then give you an option to open it now... I thought we had that already... it just did like nothing basically."
   - First find why nothing showed: the card has a message row (`shop-msg`, Eric Nov 2: "X's Boss Crate is in your inventory.") that
     should have said so. Was it empty, hidden (the `town-soon` class?), cleared, or below the fold? Fix the cause.
   - Then: after a crate is bought (either way of paying), a pop-up: "You got Boingo's Boss Crate!" with the crate's picture, and two
     buttons: **Open now** and **Later**. Open now opens it with the game's existing crate opening (the Crates screen's own opening and
     reveal, the same route and odds: reuse it; don't build a second opener). Later closes the pop-up (the crate stays in your inventory,
     as today). Buying again from the card still works after either. Phone first (428 x 746), also the computer; light and dark; big tap
     targets; it never moves or resizes the card under it ("nothing hidden, nothing shifts": a pop-up over the card is fine).
   - If a buy fails (can't afford, server says no), the message row says why, as today; no pop-up.

## Tests (targeted lane: the town's shop card, the crate flow's screens)
- Unit: anything you add in shops.ts.
- e2e: in the existing spec that buys a boss crate in a room (find it via e2e/areas.json: shop.spec.ts or a boss's home spec): after a buy,
  the pop-up shows with Open now and Later; Later closes it and the crate is in the inventory; Open now opens it (the reveal shows, the
  crate's count goes down). The price line is not a button and has the card's text color. List changed checks old -> new.
- Typecheck; run the specs you touch locally. If Playwright looks for chromium_headless_shell-1194, run:
  `mkdir -p /opt/pw-browsers/chromium_headless_shell-1194 && ln -sfn /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64 /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux && ln -sfn chrome-headless-shell /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/headless_shell`.
- Stills (one set at the end) on branch stills/boss-crate-buy (never images under docs/: check.yml fails the PR): phone 428 x 746 first:
  Boingo's card (the price line, the crate), the pop-up, Open now's reveal; then a computer.
Aim for about an hour and a half.

Branch claude/boss-crate-buy from origin/main; push at each real step. A ~5-line decision note docs/decisions/2026-11-12-boss-crate-bought.md;
update docs/areas/shop.md (and town-square.md if the room's card is described there). When done: push .pr-body.md (what changed and why,
player-visible, changed checks old -> new, tests run), then .done last. Don't open a PR or wait on CI. American English. Never include model
names in commits.
