# Brief: the 3D art kit, and Boingo's claw machine rebuilt on it

**Eric, Nov 6:** "how does an N64 or a Game Boy Advance build these in 3D space and they look totally fine? … the moment I ask you to make something in 3D, it looks so different than everything else … the claw machine looks out of place … there's got to be a faster way … traditional video game, old school … pixelated."
He asked me to decide on one 3D approach for every room. The decision: yes, one kit, generalizing the street town's existing box kit. No new engine and no library.

Read first: `/home/user/cr-notes/notes/audit-2026-11-06.md` §2 (renderers; why the claw looks wrong) and §3 (the kit proposal). Follow §3.

## Part 1: the kit (`packages/app/src/town/kit/`)
- **`prims.ts`:** box, prism (gable), pyramid/hip, n-gon cylinder or dome, wedge, quad. Thin parts are quads 1–2 texels wide, never stroked lines.
- **`bake.ts`:** a pixel-grid texture on every face at the town's 37 texels a square. Light is baked as palette ramp steps (top or lit faces take the light ramp, fronts the base, the right side one step darker, roofs quantized from n·L), never a multiply or overlay, so every pixel is a palette color. A 1-texel ink outline goes on each face's outer edges.
- **`draw.ts`:** draws through the shared `Painter` and camera.ts `proj` (WebGL; the street town is WebGL-only now, #519). Nearest filtering at 1.5× and above.
- **`models/*.ts`:** one plain data object per model: `{ palette, textures: { name: Grid }, shapes: [{ prim, at: [x, z, lift], size, faces: { front, side, top } }], anchors }`.
- Move the street town's town-kit.ts, boxes.ts and box-draw.ts onto it where that's mechanical; at least the box path should go through the kit. Don't change how the town looks. Show before/after stills of the plaza and Fountain Street; they must match except for out-of-palette colors becoming palette colors.
- **Unit tests:** every baked pixel is in the palette; outlines are present; geometry is right for each primitive.

## Part 2: the claw machine on the kit
- The claw lives on branch `claude/boingo-home` (worktree /home/user/cr-boingo; `claw/view.ts`; it was merged from claude/claw-machine). Make your worktree from that branch, as claude/kit-claw.
- Rebuild the cabinet as a kit model, about 150 lines of data:
  - the base, cabinet body, glass (a palette alpha key), top sign and joystick panel;
  - the claw arm as quads;
  - Boingo's palette, at the room's pixel scale (match the room's on-screen texel size; the audit measured about 4 screen px per art px in the close-up);
  - the ink outline, the 3-step light, and no smooth vector shapes.
- Keep claw/view.ts's game logic (insert, aim, drop, 25% win) as it is.
- **Stills for Eric before any merge:** Boingo's room with the cabinet from where you enter, the close-up walk-up view, and a short GIF of a drop. Also the same views from the current branch as "before". Save them untracked under the worktree's stills/ and report the paths.

## How to ship
- Part 1 is a PR into main (`full-e2e`) and can merge on green.
- Part 2 stays on claude/kit-claw, pushed but with no PR, until Eric approves the stills. Boingo's room isn't live yet.

## Rules
- Follow `/home/user/cr-notes/notes/briefs/rules-common.md` ("Keep it lean", "Local servers"). Commit identity and trailers as in brief-ledger-1.md.
- American English.
- Measure the frame rate (main against the branch, WebGL) at the plaza and on Fountain Street, on phone and computer.
- Report the PR number and SHA, the claw branch SHA, the stills paths and a 10-line summary.
