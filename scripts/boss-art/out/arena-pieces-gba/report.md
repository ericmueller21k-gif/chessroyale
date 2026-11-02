# GBA pieces, trial: the rook and the knight (Nov 2)

Eric (Nov 2): today's Pixel pieces look "smeared and sloppy… like a JPEG saved 100 times"; redraw them as crisp Game Boy
Advance pixel art with defined features. On the spend question: "Just draw a rook and a horse, I will approve all the
pieces if these turn out the way we want."

- **What's here:** `arena-pieces-gba.ts` (one Character, 26 x 34, foot (13, 33); stills `wr`, `br`, `wn`, `bn`), drawn
  by the Claude API (Opus 5.5, effort high): **$1.13** of a $5 cap, 15 turns, 9 renders (`summary.md`, `log.jsonl`).
- `sheet.png`: the four at 1x and 4x on light and dark squares. `mockup-computer.png`, `mockup-phone.png`: the four laid on
  a still of the arena (Pixel, the high view behind White) with no other pieces, one sprite pixel one art pixel, each foot
  on its square's middle (`arena-pieces-sheet.ts`; the empty stills came from a local, uncommitted switch).
- **The size:** drawn for a square near White of 20 art pixels (rook 19 tall, knight 22, as PIXEL_TARGET). The arena's
  grid today gives a square there of about 19 art pixels on a computer (fits) and 16 on a phone (the pieces stand about 20%
  taller there, as the phone mockup shows). Far ranks aren't shrunk (as in Eric's picture). Whoever wires them in decides:
  a finer art pixel on a phone (the canvas is 2x today; at 3x a scale of 4 gives about 18) or a smaller phone set.
- **Next, once Eric approves:** the pawn, bishop, queen and king in a second run on the same base and palette (the model's
  notes in `summary.md` say how), then the director's helper draws them in the arena in place of the meshes.
