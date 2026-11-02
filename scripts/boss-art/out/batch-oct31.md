# API art batch, Oct 31

Eric approved the plan, capped at $50. All 21 runs finished: each one called `done`, and none got near its cap.
**Total spent: $15.14** (rides $8.86, home pictures $1.42, Cup $0.68, boss concepts $4.18).

Contact sheets (in this folder):
- `sheet-oct31-rides.png`: each ride's first idle frame, then five of its move frames, at 4x (white pawn, red, 75% purity).
- `sheet-oct31-home.png`: the three Chess Town options and the Auto chess card.
- `sheet-oct31-cup.png`: the trophy (gold idle, silver, bronze) and the Cup banner.
- `sheet-oct31-boss-concepts.png`: the three time-squeeze bosses' idles, frame by frame.

Each run's drawing, `summary.md` (full notes) and `log.jsonl` are in `out/<id>/`; its brief is in `briefs/<id>.md`.
Nothing here is in the game yet.

## Rides (`--rider`, effort high, cap $6 each; tier mythic)

| id | What it is | Cost | How it reads | Open choices from its notes |
|---|---|---|---|---|
| alfil-howdah | Alfil's Howdah: a woolly baby mammoth with a gold howdah; it plods | $0.57 | Clear and charming; the walk reads well | It has no canopy, because a roof would pass the 9-unit limit above the square; the painted part is the caparison, a wall panel and the pennant; the head reaches 6 units past the square |
| balloon-pup | Balloon Pup (Babur): a twisted-balloon dog; it springs | $0.63 | Very readable, a strong pick | The whole balloon takes the color, and the bow stays tiger orange; the hop tops out 23 units up |
| bigboy-buggy | Big Boy's Buggy: a pram with a hood and a rattle; it rolls | $0.66 | Reads at once; the hood is busy behind the pawn | The wheels turn slower than true rolling, on purpose; the rattle can overlap the pawn's shoulder; the rainbow badge on the side could go |
| boingo-pogo | Boingo's Pogo: a harlequin pogo with a ruffled seat; one big boing | $0.82 | Thin at town size, but the boing is great | The seat, cushion and pole take the color; the arc peaks 36 units up, the tallest of any ride |
| folio-crane | Paper Crane (Folio): a colored origami crane; it glides | $0.75 | Striking; the folds read | All the paper takes the color; the red seal stays fixed |
| ginger-sled | Candy Cane Sled (Ginger): a gingerbread sled on candy-cane runners | $0.54 | Clean and festive | The side panel and legs take the color; the snow puff is small |
| hollow-steed | Hollow's Shade: a shaggy shadow cat-beast wearing Christmas lights; it slinks | $0.66 | Cute; the smoke trail reads | Only the blanket takes the color; Midnight is dark on the black fur |
| jefferson-giraffe | Giraffe Gallop (Jefferson): a young giraffe with flame tips | $0.97 | Tall but fits; the gallop reads | The saddle takes the color, with a lighter blanket under it |
| puddles-mower | Puddles's Mower: a riding mower with a flower; it throws clippings | $0.94 | Reads well | The clippings are faint at town size; the bag is tan rather than green |
| sawyer-dozer | Sawyer's Dozer: a mini bulldozer with a raccoon-tail flag | $0.56 | Chunky and clear | The blade is painted with the body (it could be steel); the hazard stripe matches the yellow body; the tail flag reaches past the square |
| smudgy-brush | Brush Ride (Smudgy): a giant paintbrush flown like a broom; it leaves a stroke | $0.97 | Fun; the stroke reads | The paint and the stroke take the color; the handle stays fixed |
| rodeo-bull | Rodeo Bull (Wrangler): a stocky bull with a western saddle; it buck-hops | $0.79 | Clearly a bull, not Moo | The star is quieter on the Yellow color; Midnight is dark; the steam reaches past the square |

## Home pictures (`arena-` mode, effort medium, cap $3 each)

| id | What it is | Cost | How it reads | Open choices |
|---|---|---|---|---|
| arena-town-skyline | Chess Town A: a 112 x 32 skyline, a rook tower and a steeple topped with a cross | $0.30 | Reads at a glance; very "town" | The flag's wave is subtle; the flag could be gold |
| arena-town-square | Chess Town B: a 112 x 36 square, two pawns at a park table | $0.44 | The liveliest and the most "chess town" | The middle house has no awning; the bird is tiny |
| arena-town-badge | Chess Town C: a 40 x 40 gold-rimmed crest, a big pawn and houses | $0.31 | A strong emblem | The ring clips the tower top; only one window lights |
| arena-auto-card | Auto chess: a 32 x 32 knight, pawn and rook with a pennant and stars | $0.37 | Reads at 64 px | The pawn is mostly hidden; the march bob is 1 px |

## Colosseum Cup (`arena-` mode, effort medium, cap $3 each)

| id | What it is | Cost | How it reads | Open choices |
|---|---|---|---|---|
| arena-cup-trophy | A 40 x 48 gold cup with a king on the lid, plus silver and bronze stills | $0.32 | Strong; the three metals read apart | The laurel is gold on gold (green would stand out); the silver highlight is pure white |
| arena-cup-banner | A 112 x 36 navy and gold banner with a plain middle for the words | $0.36 | Clean, but more a framed sign than a cloth banner: no swallowtails show | The plain field is 62 px wide; a redo could ask for clearer ribbon tails |

## Time-squeeze boss concepts (boss mode, idle only, effort medium, cap $3 each)

| id | What it is | Cost | How it reads | Open choices |
|---|---|---|---|---|
| boss-tock | Tock, a badger clockmaker with a loupe and a pocket watch | $1.20 | Cozy and fussy; the watch reads | Hand on hip vs. folded over the belly; the watch's hand ticks fast |
| boss-trickle | Trickle, a living hourglass that flips itself over | $1.44 | The most original; the flip is a highlight | The sand turns violet after the flip |
| boss-blitz | Blitz, a cheetah in a cap slapping a chess clock | $1.54 | Lively showman; the clock reads | His arm across his chest can read as folded arms |

## Notes
- No run failed, and none needs a redo. The one weak spot is the Cup banner's missing ribbon tails.
- The `arena-` scenery mode was on `claude/colosseum-art` only, so I merged that branch into `claude/boss-art` (one
  conflict in `run.ts`, resolved to keep both modes; the typecheck is clean).
- The rides' references show the boss and its sidekick. The sidekick pictures came from a one-off script, since
  `boss-refs.ts` doesn't know sidekicks. `refs/` is not committed.
