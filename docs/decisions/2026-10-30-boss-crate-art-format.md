# Boss Series Crate #1: how its art is drawn (Oct 30, 2026)

The calls made while the runner drew the crate's items (scripts/boss-art/out/crate-1-report.md):

- **The game's item format, not pixel art.** Crate items are SVG on the pawn's 100 × 100 square (Items.tsx), so the API
  draws them that way, through a copy of Items.tsx's paint (`scripts/boss-art/item-kit.tsx`). That way every color, the
  purity blotches and the shine come free, and a drawing moves into Items.tsx as one component.
- **Motion as frames:** the art takes a frame number, and each frame has a length. This is the least code that works
  both in the DOM and baked into the town's pictures. CSS keyframes would only work in the DOM. Nothing plays the frames
  in the game yet; what's needed is in scripts/boss-art/README.md, "Item motion".
- **Rides as a new slot ("rider"):** a drawing behind the pawn and one in front of it, and a pose per frame that places
  the pawn and hides its lower part, as the town's stool-sit does. The town's move is one square's frames, played per
  square walked.
- **Tiers (proposals, for the wiring):**
  - Hose and Balloon: Rare.
  - Firework, String of Lights and Mantle: Epic.
  - Paper Crown: Legendary.
  - Both rides: Mythic, since there's no tier above it for "hyper rare".
- **Redos:** the String of Lights and the Paper Crown read badly at first, so each got its one redo at high effort. The
  redos (`out/hollow-lights-2/`, `out/folio-crown-2/`) are the ones to use.
