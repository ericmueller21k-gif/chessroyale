# Build: the town shop, part 1 (the building, the room, the board keeper, buying and putting on boards). Opus, xhigh (coins). Full lane.

Eric, Nov 28 (to the mockup, `stills/town-shop-mockup`, its `NOTE.md`): "there's no questions": every pick below stands. Read
`notes/briefs/rules-common.md` first, then the mockup's NOTE.md (colors, the room's layout, the 12 boards' hex values) and its stills.
Branch `claude/town-shop` from `origin/main`. Push at each real step.

- **The building:** the pink striped front on South Street (between Folio's Folded House and Alfil's Pyramid) gets a double door and a
  "PAWN SHOP" sign; it's a room like the others (`docs/areas/` town page), drawn once on entry, nothing loaded before you walk in.
- **The room as drawn:** the board keeper (a pawn dressed in shop items) behind his counter; the "BOARD SKINS" wall (6) and the Apple-store
  table (6 on stands); the two plinths (Fire & Ice Crown, Parrot) and the two hat tables are display only; the two curtained "Coming soon"
  stalls (God King, seasonal) are greyed, not tappable to anything but a "Coming soon" line; the two shopper pawns stand still.
- **The keeper's list:** an Apple-style scrollable list, each board with its price, "Put on" if owned, "✓ On" if in use; a rank board not yet
  reached shows greyed "Reach <Rank> to buy". Rank boards: buyable once you have **ever** reached that rank, still for coins. Coins only.
- **The preview:** the Italian opening on a loop on the real board (`OwnBoard`), "Loading preview…" while its chunk loads (lazy).
- **The boards:** the 7 rank boards (Gold … Transcendent) and 5 basics (Walnut, Slate, Lagoon, Blossom, Graphite), hex values from the
  NOTE; the frame drawn **over the outer edge of the squares** (the board keeps its size: styling only). Prices placeholders in
  `settings.ts`: basic 150, rank 400.
- **Settings:** the free "Gold" board colors become "Classic Gold"; boards you own also show in Settings, Board colors.
- **Stored data:** owned boards and the one in use are saved on the account (D1 migration; the shop's existing wallet and purchase path,
  never a second wallet). A purchase is one server-side transaction: price checked on the server, never trusted from the client; buying
  twice never charges twice; not enough coins is a clear greyed state, not an error.
- Guests: the room is open, the list shows, buying is greyed with "Make a free account to buy".
- Area pages and a decision note (five lines: Eric's words, the picks). Unit tests for the purchase (server), an e2e for walk in → buy →
  put on → board shows in a match, and one still per platform for the director. Lane: full (stored data, coins).
Commit AND push `.pr-body.md` and `.done` (`git add -f`), check `git ls-remote`, then stop. No PRs, no comments.
