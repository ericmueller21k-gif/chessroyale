# The Colosseum's inside: the arena's art (Oct 30)

These are the pieces of the arena, drawn by the API runner in its new `arena-` mode. All runs used Opus at effort
`medium` with Eric's mockup and four close-ups of it as references (`scripts/boss-art/refs/colosseum-arena/`). Nothing is
in the game yet. Each drawing is a `Character` in the sprite format, lit from the top left, outlined in `k`, and uses the
outside's travertine, navy, gold and marble keys and values (`houses/coliseum.ts`), so the pieces sit together.

**Total spent: $2.84 of the $20 approved.** All nine were drawn, plus one redo (the pieces). No cap was raised.

Contact sheet: `scripts/boss-art/out/arena-sheet.png`. It shows every piece at 3x (the railing at 2x). The repeating
pieces are tiled 3 times (the floor 3 x 3), and seat points show in magenta.

## Scale

A board square is about **32 to 36 px**: the floor tile is 32, pieces are 20 to 24 wide at the base, the pawn is 26 tall
and the king 52. A seated pawn in the stands is **16 x 20**, the same as `arena-crowd-back`'s pawns. Seats are 16 px
apart and rows 19 px apart. The near railing is drawn chunky (2 x 2 blocks) because it's close to the camera.

## The pieces

| # | Drawing | Cost | Frame (px) | Placing it | How it reads |
|---|---|---|---|---|---|
| 1 | `arena-stands` | $0.35 | 64 x 88 | Repeats side by side with no seam. 4 rows, back row first: `ARENA_STANDS_ROWS` = y 0–19, 19–38, 38–57, 57–76; `ARENA_STANDS_FRONT` = y 76–87 (the lowest row's front, which sits on the wall's top). `ARENA_STANDS_SEATS`: 16 pawn foot points, x 8/24/40/56 at y 29, 48, 67, 86. Each point sits a few px into the next row down, so drawing row by row (seat pawns, then the next row's stone) hides each pawn's lower half. Foot (32, 88). | Clean stepped benches, lit tops and shaded risers. A little flat: pawns on the seats will bring it to life. |
| 2 | `arena-wall` | $0.29 | 64 x 64 | Repeats side by side with no seam: one arch per slice. Its top (y 0, the coping) carries the stands; its foot (y 63) is the floor. Foot (32, 63). | Good: big sandstone courses, a dark arch with lit wedge stones, a darker plinth at the bottom. |
| 3 | `arena-pillar` | $0.37 | 24 x 96 | Foot (12, 95). `ARENA_PILLAR_FLAME` = (12, 12) is where to put a glow. `idle`: 5 frames at 120 ms, looping; the flame flickers and a spark rises. | Very good: a square pillar, a bronze bowl and a bright flame. Reads at phone size. |
| 4 | `arena-banner` | $0.23 | 24 x 56 | Hangs from the top of its rod at (12, 1) on the wall. `idle`: 6 frames at 220 ms, looping; the cloth sways and the rod stays still. | Very good: navy with a gold border and a crown, swallowtail bottom. Matches the mockup. |
| 5 | `arena-floor` | $0.20 | 32 x 32 | Three stills. `floor` tiles both ways with no seam. `side` is the board's raised border (y 0–11) and repeats side by side. `corner` is the border's top-left corner (top-left 12 x 12); turn it for the other corners. | The floor is quiet pale flags, so the board will stand out over it. The border is plain but works. |
| 6 | `arena-pieces-2` (**use this**) | $0.49 + $0.23 redo | 32 x 56 | Twelve stills (`wk wq wr wb wn wp bk bq br bb bn bp`). Foot (16, 55) for all of them. | Classic chunky shapes: marble white, slate black, gold rings. The first run's queen (`arena-pieces`) looked like a rook, so the redo gave it a pointed gold crown. Everything else is unchanged. |
| 7 | `arena-statue` | $0.30 | 40 x 80 | Foot (20, 79), stands by the wall. | A marble pawn champion with a helmet, round gold shield and short sword, on a sandstone plinth with a gold band. Generic. |
| 8 | `arena-railing` | $0.20 | 128 x 32 | Repeats side by side with no seam. Its bottom edge is the screen's bottom. Foot (64, 32). | A broad lit coping with chips, and a shaded face below with block joints. Reads as stone close up. |
| 9 | `arena-crowd-back` | $0.18 | 18 x 22 | Six stills, all with foot (9, 21). `red blue green gold purple` are pawns seen from behind (16 x 20, three tones each). `far` is a 5 x 7 neutral figure for the far stands, meant to be tinted by the game. | Clean and readable. Plain on purpose, so the game can add a bob. |

## Files

- Drawings, notes and per-turn spend: `scripts/boss-art/out/<id>/<id>.ts`, `summary.md`, `log.jsonl` (committed).
- Previews (not committed): `scripts/boss-art/out/<id>/preview/` has GIFs and frame sheets for stands, wall, pillar,
  banner, statue and railing. Every render the model looked at is in `looks/`.
- The repo's preview script (`scripts/preview-characters.ts`) needs an `idle` animation, so it didn't run for the three
  sets of stills (floor, pieces, crowd). The contact sheet shows them instead.
- Briefs: `scripts/boss-art/briefs/arena-*.md`.
- The runner's `arena-` mode (`run.ts`, `render.ts`) adds: the scenery instructions, `tile` ("x" or "xy") to check seams,
  `anim: "*"` to show a set of stills, and magenta markers for `..._SEATS` exports.

## Not drawn, and what could change

- Everything asked for was drawn. **$17.16 of the budget is left.**
- `arena-pieces` (the first run) is kept only for comparison. Use `arena-pieces-2`. Its id has a `-2` that the game can
  drop when it imports it.
- The stands' riser faces are fairly uniform. If they look flat in the scene with pawns on the seats, a second pass could
  add stairs or aisles and more variation in the stone. The brief left aisles to the game.
- The board border is plain. A gold inlay line or carved trim would cost about $0.30 more.
