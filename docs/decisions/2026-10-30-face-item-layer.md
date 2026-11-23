# Face items: tagged above or below a hat (Oct 30, 2026)

Eric (Oct 30), seeing goggles drawn over a pirate hat and a smiley under its brim: "an internal tag if it's an above or below face item". It comes up with the Winter Crate's new Stocking Ski Mask (a head item covering the face, goggles on top).

- Each face item in `ITEM_DEFS` (crates.ts) has `faceLayer: "above" | "below"`, replacing the drawing code's `OVER_HAT` list (Items.tsx). Same picture as before: Ski Goggles and Dark Shades above, the other six below.
- A unit test (`packages/core/test/crates.test.ts`) fails if a face item has no tag, or another slot has one.
- Area: [shop.md](../areas/shop.md).
