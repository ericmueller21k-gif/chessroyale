# Ride views, Oct 31: front and back for 11 rides

Eric approved 12 rides at ~$1–1.50 each, $3 cap each, $40 cap total (Oct 31). Each ride now has `views: { front, back }`
in `out/<id>/<id>.tsx` (the runner checked the side view still renders pixel for pixel as before). Front = walking
down toward us (its face); back = walking up, away from us. Briefs: `briefs/<id>-views.md`. Contact sheet:
`out/sheet-oct31-views.png` (each ride's side, front and back: idle and move frames 1, 3, 5 at 4x, and town size).

**Total spent: $12.94** of the $40 cap.

| Ride | Cost | Front | Back | Open choices |
|---|---|---|---|---|
| riding-chirp | $1.38 | Big round face, both eyes, blush, bell on the painted collar, saddle horn | Rump, folded wings, big striped thighs, saddle back | Front leaves the big thighs out (looked spidery); antennae skim the pawn's sides |
| alfil-howdah | $0.98 | Trunk, tusks, pink ears, howdah wall and posts | Rump, tail, caparison and howdah back wall | – |
| balloon-pup | $0.86 | Head knot, ears, striped bow | Rear bubble and back legs | The curled tail crosses the pawn's middle from behind |
| bigboy-buggy | $0.88 | Basket with badge, hood arching behind with cream lining and frill | Hood ribs, push handle across, rattle | – |
| boingo-pogo | $0.52 | Drum seat, crossbar with grips and pom-poms, spring | Nearly the same as front (a pogo is symmetric) | Front and back differ little |
| folio-crane | $0.89 | Head and neck in front of the pawn, wings in a V | Pointed tail, wings in a V | The neck covers the pawn's middle in front |
| ginger-sled | $0.81 | Candy-cane hooks curling toward us, icing nose | Backrest with icing, runners | – |
| jefferson-giraffe | $2.66 (3 tries) | Long neck up the middle, head high with both eyes | Rump, flame tail, head and ossicones above the pawn | The neck splits the pawn in front (needed to keep the head high) |
| puddles-mower | $1.04 | Grille hood with headlight, steering wheel, clippings spray to the sides | Grass bag, flower, exhaust | – |
| sawyer-dozer | $0.94 | Blade across the front, bandit-mask headlight band, stack puffs | Hazard stripe, tail-light, seat back, tracks | – |
| rodeo-bull | $1.98 (2 tries) | Broad face, nose ring, horns, saddle horn | Rump, rope tail, cantle, blanket fringe | – |
| smudgy-brush | $0 | – | – | Skipped: no finished drawing on this branch (the Brush Ride is being redrawn) |

**Retries:** the giraffe and bull's first runs used up the 32,000-token output limit in one turn and drew nothing
($0.76 and $0.75). Rerun with 64,000 tokens, both drew their views, but the runner stopped them before calling done
($1.19, $1.23): at that limit its worst-case guess for the next turn didn't fit the $3 cap. The bull's views were good.
The giraffe's front had lost its neck (a short head over the pawn), so its brief was fixed and it was redone at 48,000
tokens ($0.71, finished). For rides drawn in one big turn, `BOSS_ART_MAX_TOKENS=48000` is the setting to use.
