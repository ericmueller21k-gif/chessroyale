# Boss art

A boss character drawn by the Claude API (Opus 5.5), for review. Nothing here goes into the game: an approved drawing
is moved into `packages/app/src/characters/` and wired by hand (or by a helper).

```sh
npm run boss-art -- <id> <brief.md> [refs dir]
```

- **How it works:** the model works in a loop with tools, the way a helper does.
  - It reads the game's sprite format, the art guide (`.claude/agents/characters.md`) and finished bosses (read only).
  - It writes or edits its one drawing (`out/<id>/<id>.ts`).
  - It renders it and looks at the result: one animation's frames at up to 4x, and the idle at phone size beside another boss.
  - It looks at the brief's reference pictures, and fixes what reads badly until it calls `done`.
- **Key:** `BOSS_LINES_API_KEY`, as for boss lines (`scripts/boss-lines/api.ts`), read only by the SDK (never printed or written). The renders run in a process of their own without it in the environment, since they run the drawing's code.
- **Spend:** `BOSS_ART_CAP_USD` (default 20), and at most `BOSS_ART_MAX_TURNS` turns (default 90).
  - Every turn's real usage is added up at the model's prices: Opus 5.5 $4 / $20 per million tokens (cache writes $5), Sonnet 5.5 $2 / $10 (cache writes $2.50); cache reads $0.20.
- **Model and effort** (Oct 27): `BOSS_ART_MODEL` (default `claude-opus-5-5`; or `claude-sonnet-5-5`) and `BOSS_ART_EFFORT` (default `high`; `low`, `medium`, `xhigh`). The summary names both. `BOSS_ART_MAX_TOKENS` (default 48,000) is each turn's output ceiling, thinking included: at `xhigh` a model can think past 48,000 before it writes, and a turn that runs out of room ends the run.
  - A turn whose worst case (the cached conversation read again, the new part written, a full 48,000 output tokens) could pass the cap isn't sent; the run stops with what it has.
  - Each tool result tells the model what's been spent, so it can pace itself.
- **Output** (`scripts/boss-art/out/<id>/`):
  - `<id>.ts`, the drawing;
  - `summary.md`: the spend, the turns, its notes;
  - `log.jsonl`: each turn's tokens and dollars;
  - `preview/`: the repo's preview of every animation (GIFs, the frame sheet, the comparison);
  - `looks/`: every picture it looked at.
  - The drawing, the summary and the log are committed; `preview/` and `looks/` aren't.
- **Typecheck:** `npx tsc -p scripts/boss-art --noEmit`.

## Crate items and rides (`--item`, `--rider`)

```sh
BOSS_ART_EFFORT=medium BOSS_ART_CAP_USD=3 npm run boss-art -- --item <id> <brief.md> [refs dir]
BOSS_ART_EFFORT=high BOSS_ART_CAP_USD=6 npm run boss-art -- --rider <id> <brief.md> [refs dir]
npm run boss-art -- --rider-views <id> <brief.md> [refs dir]     # a finished ride's front and back views ($3, high)
npx tsx scripts/boss-art/boss-refs.ts scripts/boss-art/refs/<id> <boss id>[:anim,anim]   # the boss's pictures, as references
```

- **The format:** the game's own item format, SVG drawn by Preact on the pawn's 100 × 100 box (Items.tsx), not pixel
  grids. The drawing (`out/<id>/<id>.tsx`) imports `item-kit.tsx`, a copy of Items.tsx's paint (`Region`, `LINE`, `lw`, …),
  and exports an `ItemDraft` (what ITEM_DEFS, ITEM_ART, FRAMES, SHINE_BOX and ATTACH would get) or a `RiderDraft` (a ride
  under the pawn: `Back` and `Front` drawings, its `idle` and its town `move`, and a `pose` per frame that places the pawn,
  its lower part cut off as the town's bench-sit does). A ride can also have `views: { front, back }` (below).
- **Units and the town's squares:** 100 units is the pawn's box, which the town draws about 1.45 town squares across
  (`youSquares` in town/feel.ts), so **one square is about 69 units**, not 100. A ride's widest frame, in any view, is at
  most **125 units** (about 1.8 squares); a pawn's own base is about 51 units (0.74 squares). A move's `dx` 0 to 100 stands
  for one square of travel: the town fits it to one square (69 units).
- **Its eyes** (`item-render.ts`, its own process without the key): esbuild bundles `item-harness.tsx` with the drawing and
  Chromium screenshots one picture: the motion frame by frame at 4x on a pawn (240 px), phone size (a 60 px lobby pawn, the
  130 px home pawn, the 64 px locker tile) beside existing items, and every color at 75% purity, 100% and shiny. A ride:
  its idle or move at 4x, the town size (a pawn about 45 px) through its move, every color, its tile, for one view
  (`view`: side, front or back); or `view: "all"`, the three views side by side (below).
- `BOSS_ART_EFFORT` (default high) and `BOSS_ART_MAX_TOKENS` (default 24,000 for an item, 32,000 for a ride) as for bosses.
- **Previews:** `out/<id>/preview/` (not committed): every frame (`frames.png`; a ride: `idle.png`, `move.png`) and the
  standard look (`look.png`); a ride with views also `front-idle.png`, `front-move.png`, `back-idle.png`,
  `back-move.png` and `views.png` (the three side by side, every move frame); `ride.gif` (below) once you've made it.

### Rider views: front and back (`--rider-views`, Oct 31)

Every ride gets a run up and a run down. Walking left or right the town shows the side view (mirrored for left); walking
**up** the screen it shows the ride from **behind** (its rump, hind legs, the back of the saddle; the pawn from behind,
so the game hides face items then); walking **down**, from the **front** (its face and chest).

- **The format** (`item-kit.tsx`): a `RiderDraft` is its side view as before (`idle`, `move`, `pose`, `Back`, `Front`),
  plus optional `views: { front?, back? }`, each a `RiderViewDraft` with its own `idle`, `move`, `pose`, `Back`, `Front`
  (and an optional `frame`). `RiderProps` carries `view` for code shared between views. Side-only drawings are unchanged.
- **The front and back move** is one square walked toward or away from the camera, in place: the town slides the ride up
  or down the screen, so the pose keeps dx about 0 and dy is only a bob or a hop; the legs step, the wheels roll, it hops.
  The pawn sits at the same height as on the side (same `pawnY` and `cut`), centered.
- **Adding views to a finished ride:** copy `briefs/_views-template.md` and fill it in, then run
  `npm run boss-art -- --rider-views <id> <brief.md>`. It starts from `out/<id>/<id>.tsx` (the drawing it edits in
  place), shows the model its source, its notes from `summary.md` and pictures of its side view, and asks it to add
  `front` and `back` that match (proportions, colors, painted part, personality) by inserting code. The original is
  kept beside it as `<id>.side.tsx` (not committed); `done` is refused until the side view renders pixel for pixel as
  the original did (idle and move, every frame, every color, the tile) and both views exist. Defaults: cap $3
  (`BOSS_ART_CAP_USD`), effort high. It writes `views-summary.md` and `views-log.jsonl` (the side run's `summary.md` and
  `log.jsonl` stay), and its looks are `looks/views-*`.
- **Seeing them:** the render tool's `view: "all"` (the default once a ride has views) shows the three in columns:
  idle frame 0 and some move frames at 4x (the side's move in place, so every cell is one size), then idle and every
  move frame at town size, then cobalt and midnight. The contact sheet (`item-render.ts` `mode: "sheet"`) gives a ride
  with views a whole row: the three side by side, idle and every move frame (or `frames`), at 4x and at town size.
- **Test fixture:** `fixtures/views-test-ride.tsx`, a plain pony with all three views (not art), for checking the
  harness: `npx tsx scripts/boss-art/item-render.ts '{"draft":"scripts/boss-art/fixtures/views-test-ride.tsx","mode":"rider","view":"all","out":"<dir>"}'`.

### One GIF per ride (`ride-gif.ts`, Oct 31)

```sh
npx tsx scripts/boss-art/ride-gif.ts <id> [color] [--out <file or folder>]    # out/<id>/preview/ride.gif, and a copy at --out
npx tsx scripts/boss-art/ride-gif.ts --all [color] [--out <folder>]           # every ride under out/ with a RiderDraft
npx tsx scripts/boss-art/ride-gif.ts scripts/boss-art/fixtures/views-test-ride.tsx --out <file>   # a drawing outside out/ (needs --out)
```

Instead of contact sheets: one GIF of a ride on the town's floor. No API, no key: it bundles the drawing with
`ride-gif-harness.tsx` (esbuild), draws each frame in Chromium, and puts the GIF together with sharp. Default color red at
100%; `[color]` is any item color. About 10 s and 250 to 600 KB (it warns under 8 s or over 15 s, and past 4 MB it
encodes again with fewer colors).

- **The sequence:** a stand in the idle, run right 3 squares, a stand, run left 3 (the side view, mirrored), a stand,
  run up 2 (the back view), a stand, run down 2 (the front view), then the idle for 2.5 s (the side view, facing right, so
  it loops). The stands turn the ride to the next view and last 0.35 to 1.5 s (about 1.4 s), whatever brings the total
  near 10 s; they play the idle at its own timing. A ride with no front or back view yet uses its side view for up and
  down and prints a warning.
- **Pace:** each square takes 200 ms, a bot's step (`botStepMs`; your own step, `youStepMs`, is 90 ms and hides the
  animation), with the move's frames scaled to fit, as the town would play them (the side view travels as drawn, `dx` 0 to
  100 over the cycle; the front and back views are slid evenly up or down the screen). A ride's `move.ms` is only its
  proportions here; a cycle drawn at 650 ms is played at 200.
- **The scale** (Eric: "make sure that they're actually scaled properly… be cognizant of the horizontal size"):
  - Town size is the render tool's: a pawn's 100-unit box is 45 px (0.45 px a unit); the GIF is that raster, shown 2x with
    nearest-neighbor. The plain pawn stands 4 squares along from where the ride starts.
  - One town square is 100 / 1.45 = 31 px here (69 units); see "Units and the town's squares" above.
  - The floor is the town's (render.ts `SQ_LIGHT`, `SQ_DARK`; seams at 0.86), its squares as deep as the town's camera
    shows them on a phone zoomed out (camera.ts at 390 x 844: 0.92 of their width). Sprites stand upright, as in the town.
- **The caption strip:** the ride's name, its width as "N.NN squares (U units)", **red above 125 units** (about 1.8
  squares), and what it's doing (the view shown). The width is the widest frame of any view (idle and every move frame),
  measured from the drawn pixels (alpha over 20, on a raster 5x finer than the town's), with its pawn on it and without
  the pose's `dx`.
- **Widths so far** (Oct 31, the 15 rides under `out/`): 84 units (1.21 squares, boingo-pogo) to 178 (2.58,
  hollow-steed). Eight are over 125: alfil-howdah 128, balloon-pup 131, ginger-sled 147, hollow-steed 178, moon-ride 146,
  puddles-mower 170, sawyer-dozer 127, smudgy-brush 152 (riding-chirp is 120). Only riding-chirp has front and back views.

### Item motion

The game's items are still today: only the shine moves (a CSS animation). A drawing's motion is frames: its `Art` gets `f`,
the frame number, and `motion.ms` (a ride: `idle.ms`, `move.ms`) each frame's length. To show them, the game would need:
- **In the DOM** (votes, lobby, home, locker): `ItemLayer` taking a frame number from one shared clock (one timer for the
  whole page, ticking each motion's frames, paused when the page is hidden and under reduced motion), so a screen of 100
  pawns costs one timer. Still items ignore it.
- **In the town** (a canvas): your dressed pawn is drawn once into a picture (town/you-look.ts); a moving item would be
  baked into one picture per frame the same way, and the town would pick the frame by the clock. A ride also needs its
  `move` played per square walked in place of the walk's hop, and the pawn drawn between its `Back` and `Front`, cut at
  the pose's `cut` (the stool-sit's clip in render.ts, `sitCut`).
- For a ride's views: the town picks the view by the step's direction (side, mirrored for left; back going up; front
  going down) and slides the ride a square up or down while its front or back `move` plays in place; from behind, the
  pawn's face items are hidden.
- A new slot, `rider`, in crates.ts (`ItemSlot`, `cleanLook`) and a place for it in the locker.
