# Animated items play in Chess Town (Nov 27)

Eric: "it needs to be playing in the town. That's how people like to show off ... drawn at the start as a few frames ... that loop."

- As a figure is dressed (`town/you-look.ts`), its item's CSS animations are stopped at N moments and painted once, each frame kept as a
  patch over the still picture. The town picks one by a shared clock. Tube 8, cane 12: `TOWN_ITEM_FRAMES`.
- Patches, not whole figures: whole frames overflowed the atlas with 27 wearers (a page reset). Patches are ~13% the size.
- Identical looks share frames; others' looks play 6 at most. Riders and the far band show the still.
