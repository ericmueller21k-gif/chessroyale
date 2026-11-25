# Item polish: six Legendary/Mythic items (Nov 25)

Eric, Nov 25, on the approved mockup (`claude/item-polish-mockup`): "yes go ahead". Built exactly its picks: the Fire & Ice Crown's three flames,
the Candy Cane's gold strand, the Gift-Wrap Tube's confetti puff, the Parrot's double flap, the Tommy Gun's key and muzzle puff, and six Smiley
Face expressions rolled from the item's seed (even odds, never stored; named "Smiley Face · Wink"). Banana Suit and Pirate Hat untouched.
Calls: animation only where the item is the focus (`live`: your pawn, the locker preview, the crate reveal, a profile's cosmetics); grids,
lists and the power banner stay still (banners.test.ts guards the banner's markup, Eric's Nov 5 rule). Reduced motion: still drawings.
CSS on SVG transforms and opacity, no frame loop: five items playing on a 4x-slowed phone, p95 16.7 ms, no dropped frames (`e2e/perf.spec.ts`).
A smiley's expression is part of its stack (two Winks stack, a Wink and a Smile don't). Long names wrap after the "·", inside the tile.
