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
npx tsx scripts/boss-art/boss-refs.ts scripts/boss-art/refs/<id> <boss id>[:anim,anim]   # the boss's pictures, as references
```

- **The format:** the game's own item format, SVG drawn by Preact on the pawn's 100 × 100 square (Items.tsx), not pixel
  grids. The drawing (`out/<id>/<id>.tsx`) imports `item-kit.tsx`, a copy of Items.tsx's paint (`Region`, `LINE`, `lw`, …),
  and exports an `ItemDraft` (what ITEM_DEFS, ITEM_ART, FRAMES, SHINE_BOX and ATTACH would get) or a `RiderDraft` (a ride
  under the pawn: `Back` and `Front` drawings, its `idle` and its town `move`, and a `pose` per frame that places the pawn,
  its lower part cut off as the town's bench-sit does).
- **Its eyes** (`item-render.ts`, its own process without the key): esbuild bundles `item-harness.tsx` with the drawing and
  Chromium screenshots one picture: the motion frame by frame at 4x on a pawn (240 px), phone size (a 60 px lobby pawn, the
  130 px home pawn, the 64 px locker tile) beside existing items, and every color at 75% purity, 100% and shiny. A ride:
  its idle or move at 4x, the town size (a pawn about 45 px) through its move, every color, its tile.
- `BOSS_ART_EFFORT` (default high) and `BOSS_ART_MAX_TOKENS` (default 24,000 for an item, 32,000 for a ride) as for bosses.
- **Previews:** `out/<id>/preview/` (not committed): every frame (`frames.png`; a ride: `idle.png`, `move.png`) and the
  standard look (`look.png`).

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
- A new slot, `rider`, in crates.ts (`ItemSlot`, `cleanLook`) and a place for it in the locker.
