# Boss Series Crate #1: the art, round 2

Two redos and one new item, drawn by the Claude API through the runner's item mode (`scripts/boss-art/README.md`) on
Oct 30 to 31, 2026. Model `claude-opus-5-5` for every drawing. Nothing is in the game: the drawings are in
`scripts/boss-art/out/`, and no game code was changed.

- **Contact sheet:** `scripts/boss-art/out/crate-1-round-2-sheet.png`.
  - Round 1's Firework and Crown sit beside their redos, each at rest, mid-motion and at 60 px.
  - The mask is shown in Red, Emerald and Midnight, and once with Ski Goggles on top.
  - Each piece's header names its drawing's id, since the redos share a name.
- **Previews:** each drawing's `out/<id>/preview/look.png` (not committed; the runner remakes them).
- **New in the render** (`item-harness.tsx`): a head item is now also shown with Ski Goggles and with Dark Shades worn
  over it (face items tagged `faceLayer: "above"`), so the mask was drawn seeing that.
- **New on the sheet** (`sheet-harness.tsx`): it can show extra looks of a drawing (`looks`: a color and an item worn on
  top).

## The pieces

| Piece | Drawing | Model, effort | Real cost | How it reads |
| --- | --- | --- | --- | --- |
| Jefferson's Firework, redo | `out/jefferson-firework-2/` | Opus, medium | **$0.21** | **A rocket at a glance**, fixed. A chunky body in the item's color with a cream band, a gold band and a small cream star. It has a dark pointed nose cone, three dark fins flaring at the base, and a short fuse out of the bottom. The fuse fizzes with tiny orange sparks (8 frames, 1.2 s). No stripes: nothing like the Candy Cane or Gift-Wrap Tube now. It reads at 60 px in every color. The star is the model's own touch and can come out. No `high` redo needed. |
| Folio's Paper Crown, second redo | `out/folio-crown-3/` (the one to use) | Opus, medium | **$0.67** | The crown is kept from round 1's redo. The crane is now a bold, outlined silhouette twice the size, with a beaked head to the left and a long tail to the right, and its wings fold and unfold (8 frames, 3.5 s). It's better at 4x and at 130 px: a bird on a crown. **At 60 px it still reads weakly:** at rest its wings lie flat, so it's a thin stick with a beak. With wings up it reads as a bird. |
| Folio's Paper Crown, the `high` redo | `out/folio-crown-4/` (an unfinished draft) | Opus, high | **$0.14** | The redo aimed at that: wings never flat, a fuller body, a shorter neck and tail. Its first drawing does put the mass in the middle (wings in a V at rest), but **the lifted wing is cut flat by the avatar's y −9 clip in frames 5 to 7**. The model never got to look and fix it: the runner stopped it before turn 3, because that turn's worst case ($0.71) could have passed what was left of the Crown's $1.50 cap ($0.69). Not usable as is. |
| Stocking Ski Mask, new | `out/stocking-mask/` | Opus, medium | **$0.26** | Reads right away. A knit stocking in the item's color covers the whole head, its toe flopping over to the right and swaying (8 frames, 2.4 s). A fluffy white cuff rings the neck, always white. The eye holes are at y 29 with small dark eyes in them, and there's a mouth hole. **Ski Goggles and Dark Shades sit on top correctly** (the sheet's last cell). It reads at 60 px and in every color. Midnight is the darkest, but its white cuff still frames it. The model's notes on what to change: the cuff's bumps under the mouth hole look a little like a toothy grin (kept for the heist feel); the toe can be mirrored to flop left, away from weapons. The model's description is in the drawing. No `high` redo needed. |

Each drawing's `summary.md` has the model's notes, beat by beat.

## Spend

| Item | Cap | Spent |
| --- | --- | --- |
| Firework | $1.50 | $0.21 |
| Crown | $1.50 | $0.81 ($0.67 + the `high` redo's $0.14) |
| Mask | $2.00 | $0.26 |
| **Total** | **$5.00** | **$1.28** |

- $3.72 of the $5 is unspent. No cap was raised.
- The Crown's one `high` redo is used. What's left in its cap ($0.69) is less than a `high` turn's worst case, so it can't
  go on under this brief.

## What's left

- **The Crown at 60 px.** `folio-crown-3` is the best finished one. To finish the job, either:
  - fix `folio-crown-4` by hand (lower its wing tips by about 3 units so the lifted V clears y −9: a small edit, no
    API spend); or
  - give it a new allowance for another `high` pass (about $0.75, by round 1's redo).
- **Wiring** (when Eric approves the art):
  - `stocking-mask` needs its entry in `crates.ts` (Winter Crate, head, legendary) and its art, frame and attach (25)
    in `Items.tsx`.
  - Its toe sway, like every drawing's motion, needs the shared item clock described in the README, "Item motion".
