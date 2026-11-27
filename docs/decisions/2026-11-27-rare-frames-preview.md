# Rare item frames and the item preview (Nov 27, 2026)

Eric, Nov 12: "a nice clean like gold border or like diamond border... if you click on them, it should load up like a little box... a
preview of like a pawn... utilizing the rider".

- **Frames:** Legendary gold, Mythic diamond (`ITEM_FRAMES` in settings.ts); Common to Epic keep their colored edge. Drawn on the
  tile's own border, so no tile changes size. On the locker's tiles, a crate's "Possible items" (and the Welcome Crate's rides) and
  the preview's box.
- **Preview:** a locker tile's tap already wears it and a hold deletes it, so the preview is a small magnifier on the tile's right
  edge. A crate's item rows did nothing on tap, so the whole row opens it. The box is the locker's `Avatar` (your default pawn color,
  wearing only that item, or riding it), so every item and ride works with no work of its own.
