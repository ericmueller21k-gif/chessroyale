# Boss art (item): stocking-mask

- Model claude-opus-5-5, effort medium, adaptive thinking. 5 turns, 2 renders.
- Spend: **$0.26** of the $2 cap (12 input, 19,815 cache-write, 47,831 cache-read, 7,413 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/stocking-mask/stocking-mask.tsx.
- Previews: scripts/boss-art/out/stocking-mask/preview/frames.png, scripts/boss-art/out/stocking-mask/preview/look.png. Each look it took: scripts/boss-art/out/stocking-mask/looks/.

## Its notes

I drew the Stocking Ski Mask (legendary, head slot, attach 25). It reads well on the white and the black pawn, in every colour scheme, and at 60 px. It also looks right with Ski Goggles and Dark Shades on top: the eye line stays at y 29 and nothing busy crosses it.

**What it is:** a knit stocking pulled over the whole head, in the item's colour. It's a bit bigger than the head (x 38–62, y 11–38), so none of the pawn's head shows around it. Four faint rib lines give the knit look.
- **Holes:** two eye holes at (46, 29) and (54, 29) and a mouth hole at (50, 33.4). They're cut out, so the pawn shows through. Each eye hole has a small eye, as the Ninja Hood does: dark on the white pawn, light on the black one.
- **Cuff:** a fixed white fluffy band around the bottom (about y 34–43), bumpy on both edges, with a soft grey shade and a few grey flecks so it reads on a white pawn.
- **Toe:** it flops over to the right from the crown and hangs down beside the head to about y 24. The tip is the item's colour darkened by 28%, there's a small heel bump on top, and a little highlight.
- Highest point: y 4, so nothing comes near y -9. Frame [34, 1, 42, 43].
- Description: "Santa's list says naughty. The elf in the stocking says prove it."

**Motion:** 8 frames of 300 ms, a 2.4 s loop. The toe swings ±9° on a sine around its fold at (55, 12): right, back through the middle, left, and back again, slow and even. Everything else stays still.

**Choices you might want to change:**
- The cuff's bumpy top edge under the mouth hole looks a bit like a toothy grin. I liked it for the heist feel; using more, smaller bumps would make it look more like plain fur.
- The sway is continuous rather than a long hold with a short beat of motion. Making it ±6° would calm it down.
- The toe flops to the right, the same side weapons sit on. It can be mirrored to flop left.
