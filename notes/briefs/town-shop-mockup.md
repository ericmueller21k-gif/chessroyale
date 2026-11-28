# Chess Town's shop: a new building, a board shopkeeper, board skins (Eric, Nov 28 ~00:10 UTC). PHASE A: mockup only. Fable, high

Read `notes/briefs/rules-common.md` first, then `docs/areas/town-square.md` (the buildings, which are facades without doors, the shops
with a room: ShopRoom, Don's bakery and its back room, how a room loads), `docs/areas/shop.md` (coins, the locker, ItemArt, the preview
"magnifier" on an item), `docs/areas/ranked.md` (the tiers) and `.claude/LESSONS.md`. Stills only on orphan `stills/town-shop-mockup`,
plus a throwaway preview script (not merged). No game code, no PR.

**Eric (paraphrased closely):** a new building near the town's center: take one of the facade buildings and give it a door. Inside, a
shop with a few shopkeepers where you buy things with coins (one currency, earned or bought; no premium currency). One shopkeeper sells
**chessboard skins** you equip and see during games, a few hung on the wall behind him (not every one). Tap him: our usual scrollable
menu list; tap a board: a preview (the magnifier we already use) showing an opening position and a few opening moves played on it.
Start: **one board per rank from Gold up** (Gold, Paragon, Illustrious, Sublime, Radiant, Pearlescent, Transcendent): mainly the rank's
color scheme with a little decorative border, "very simple to look at, but pleasant", and a few basic color boards besides. Load nothing
of the shop until you walk in; a board's preview loads when tapped ("Loading preview…"). The room must feel busy, not three keepers and
dead space, without costing memory: his idea, **Apple-store style display tables in the middle** with boards and items (hats etc.) shown on
them. Other corners later (rotating or seasonal items, God King things): leave them designed-in, not empty.

**Make (stills, phone 390x844 and computer 1280x800, light and dark where it matters):**
1. The street: which facade (near the center) becomes the shop, with its door and a sign (say which building and why in NOTE.md).
2. Inside: the room, the board keeper at his wall (a few boards hung), 2-3 display tables in the middle with boards and a few existing
   items (use real ItemArt), two more keeper spots dressed as "coming" (e.g. a God King stand, a seasonal stall) so nothing reads empty.
   Drawn the cheap way: the room as the other shop rooms are (its pictures made once, kept in the atlas), no per-frame work.
3. The keeper's list (our menu style): each board as a row, its name, price, a small swatch; owned/equipped marks; rank boards show
   the rank's emblem and, if you haven't reached it, why it's locked.
4. The preview: the board at full size with an opening (e.g. the Italian, 4-6 moves) playing on it.
5. **All the boards**: the 7 rank boards and 4-5 basic ones, each as a full board with pieces, side by side (one sheet). Colors tuned so
   pieces, the last move, check and the move dots all stay clear on every one (check with the board's existing marks).
NOTE.md: the choices (which building, the layout, each board's colors as hex), and open questions for Eric. `.done` there when done.
