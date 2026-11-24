# Legendary/Mythic items polish: a MOCKUP first (Nov 24). Opus high (drawing and animation), item-builder's lane. No merge from this job

Eric (Nov 24): "anything that's a mythic needs to have some slight animation to it. Like the parrot, for example, could just like slightly
... flap its wings every few seconds, just like not obnoxiously. The Tommy gun could ... like the clip ... spin ... the fire and ice crown
... kind of feels like junk now ... rebuild that item". Then, after seeing the sheet: "the fire and ice crown ... the top little parts that
are floating, we should replace those with actual like flames ... the fire needs to be a bit cooler too than what it currently looks like
... change it up a little more. The banana suit can be left alone. That's a special item. ... a special category for the smiley face, that
instead of a smiley face, that's one of the options, but a few of them are different expressions ... they can just be like that [no
animation]. ... the candy cane, since it's like a magical thing, it should do this cool like magical spiral swirl that goes from the
bottom of it all the way and goes up to the top, and then kind of repeats every so often. ... the gift wrap tube ... definitely needs
something more than just ... a shiny effect ... I'm not even sure."

Start: `git fetch origin main && git checkout -B claude/item-polish-mockup origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, `.claude/agents/item-builder.md`, `docs/areas/shop.md` (items, colors, purity), `packages/core/src/crates.ts`
(ITEM_DEFS), `packages/app/src/components/Items.tsx` (each item's SVG), how items draw on pawns and cards (`npm run preview:items`).

Mockup only (a preview page + GIFs/stills on orphan `stills/item-polish-mockup`, never under docs/; code on `claude/item-polish-mockup`):
1. **Fire & Ice Crown (rebuild):** the ice crown's floating top spikes become real flames (animated: a calm flicker, not frantic), and a
   better fire overall: layered, glowing, in the item's color (it has a color: the flames in that color, the ice staying ice). Show it on a
   pawn, on its card, in 3 colors.
2. **Candy Cane:** a magical spiral swirl of light that travels from the bottom of the cane to its top along its stripes, then rests a few
   seconds, then repeats.
3. **Gift-Wrap Tube:** Eric isn't sure: offer 2 or 3 options side by side (e.g. its stripes scrolling like a barber pole with a sparkle at
   the tip; a ribbon bow that pops out at the top and curls back every few seconds; a small confetti puff from the end now and then). Say
   which you'd pick.
4. **Parrot:** a slight wing flap (or a head tilt) every few seconds, not obnoxious.
5. **Tommy Gun:** something that moves now and then (the drum turning a notch, a tiny muzzle puff): one or two options.
6. **Smiley Face (no animation):** a set of expressions as variants of the same item (e.g. smile, wink, grin with tongue, cool, surprised,
   laughing): 5 or 6 drawings in its style, shown on pawns. Say how it would work: as a variant rolled with the item (like its color; would
   need stored data: full lane) or as separate items in the crate (changes the crate's list and per-item odds); recommend one.
7. Leave the Banana Suit and the Pirate Hat as they are.
Rules: animations are CSS/SVG transforms and opacity only (no new frame loop), slow and calm, off with reduced motion; legible at pawn
size; light and dark. Frame rate: measure once on the items preview at 4x CPU. `NOTE.md` on the stills branch (each GIF, your picks).
`.done` on `claude/item-polish-mockup`, push, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By, no model names).
