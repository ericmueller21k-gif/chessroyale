# Folio's home, second pass: revise the drawing you have

The first brief (`scripts/boss-art/briefs/house-folio.md`) still holds: read it. Your drawing exists: **read it first**
(`scripts/boss-art/out/house-folio/house-folio.ts`) and revise it. You can now read Folio itself:
`scripts/boss-art/out/folio/folio.ts` (`FOLIO_PALETTE`) and `scripts/boss-art/briefs/folio.md`.

## The director's review of the first pass
It's tidy and the door, glow and seal work, but it reads as a **plain white cottage with grey siding**, not a house folded
from Folio's paper, and it's lighter and blander than the homes beside it. Fix:

1. **Folio's own colors.** Use `FOLIO_PALETTE` exactly: warm cream paper (A, B lit, C mid, D shaded, E crease), its
   outline (k), its gilt (G, q, o, g, H) and its seal (v, w). No cool whites, no lavender or grey walls: the shaded side
   is Folio's warm D/E paper.
2. **It must read as folded paper.** Give it real origami structure: crisp mountain and valley creases you can see at
   phone size. Ideas: the roof as a pleated sheet (a zigzag of lit and shaded strips along its edge), the walls with a
   vertical fold and a diagonal crease or two, a folded-under hem along the bottom, slightly uneven corners, and the
   paper's thickness showing at cut edges (a 1-px darker line). It should look like a model someone folded from one big
   page, not a house painted cream.
3. **A crane on the roof.** A paper crane, clearly Folio's shape in small (a V of wings, a long neck and a pointed
   tail, a gold pixel at the beak), perched on the ridge like a weathervane, about 14 to 20 px wide. It's the home's
   silhouette: anyone who knows Folio should recognize the house from it.
4. **The hanging cranes must read as cranes**, not blobs: each a tiny V of wings with a head and tail point, 7 to 9 px
   wide, swaying on its thread (as now, out of step).
5. **The writing**: the dashes read as siding. Make it Folio's handwriting: 1-px lines with small rounded humps every
   3–4 px, 2 or 3 short lines per lit face, very faint (`#8a93b8` on lit paper, `#717898` on mid; none or almost none on
   shaded faces). Faint is right; the lines must never read as boards, bricks or veins.
6. **Weight**: about the visual weight of the Botanical Garden and Smudgy's gallery beside it: more contrast between lit
   and shaded faces (Folio's D and E), a dark cast shadow under the roof's eave, and a ground shadow like theirs.
7. Keep: the frame size (144 x 128 or a little taller if the roof crane needs it, foot at the bottom middle), the door
   flap and its glow, the seal over the door, the book and page stack, the sign (a smaller board is fine, so it hides less
   of the house), the idle (cranes sway; one lamp flicker). Drop the grass tufts unless the other homes have them.

Look again at 3x and 4x on both backgrounds and at phone size beside house-gardener, house-smudgy and house-hollow, then
call done with notes.
