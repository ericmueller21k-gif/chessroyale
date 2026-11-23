# Colosseum: the art session's crisp pieces as Pixel, only the pieces pixelated, its own Animations (off by default)

**Lane:** targeted (the Colosseum's drawing and its gear; one optional prop on the shared `MatchMenu`). The e2e run: `e2e/colosseum.spec.ts` (its area), plus whatever CI traces from `components/MatchMenu.tsx`.

## Why
Eric (Nov 2): Pixel "also pixelates the entire crowd, and it looks terrible. The whole point was just to change the chess pieces"; the pieces "look smeared and sloppy… like a JPEG saved 100 times". Then, on the art session's 3D models (branch `claude/boss-art`): "it looks better now… queue it to go live, make it the default piece style option in the colosseum, remove the old pixel one, also the default animation toggle should be no animation", and "the colosseum settings are separate."

**What caused the smear:** Pixel drew the whole arena into a target a third of the screen's size and scaled it up (so the crowd and stands went chunky); its pieces were 3D meshes rasterized straight into that grid, each of their many small faces lit to its own cel tone (plus a shine threshold), so tones broke into one-pixel specks, thin parts came and went, and a sliding piece's size changed by fractions of a pixel every frame, reshuffling its pixels (shimmer).

## What changed
- **Pixel draws only the pieces as pixel art.** The arena, stands and crowd are full size again, as in 3D and 2D.
- **The pieces are the art session's models** (`colosseum/pieces-gba.ts`, `colosseum/arena-pieces-gba.ts`: copied as they are from `claude/boss-art` at b6a7743, the slender pawn Eric picked, all six pieces, both colors). Each is drawn by the models' own tracer as a sprite for your seat's pitch (when the view changes, never a frame; a new seat's set drawn off the frame loop while the old one shows), laid on one texel an art pixel with its foot snapped to the art grid: every pixel a palette color, a one-pixel outline, gold bands, rook top, mane and slit; nothing shimmers as a piece slides. Farther pieces are drawn smaller (six shares of each model, drawn ahead). The art pixel makes the square nearest you about 20 art pixels (what the models were drawn for). One draw call; three a frame in all.
- **The old pixel set is gone** (`pieces-pixel.ts`, its shaders, its small target and outline pass). 3D and 2D are unchanged.
- **The Colosseum's own Animations, off by default** (`colosseum-animations`, kept once chosen): the pieces' slide and the crowd's jump. It takes the Animations row's place in the Colosseum's gear (beside Pieces). The Colosseum read Settings → Board's Animations before; that global setting is untouched, still on by default for Crowd, raids, Classic's and Squads' reveals.
- Test hooks for stills (`snap`, `screenBox`, `place` with a slide start) and `scripts/frames-colosseum-crisp.mjs` (the stills, crops and GIFs).
- Docs: `docs/areas/colosseum.md`, `docs/decisions/2026-11-02-colosseum-gba-pieces.md`.

## What players see
- In the Colosseum with Pieces on Pixel (the default): crisp pixel-art pieces in the art session's style, from every seat, farther ones smaller; the crowd and arena sharp as in 2D.
- The gear's Pieces still reads Pixel / 3D / 2D (the name kept, so a saved "Pixel" gets the new pieces).
- In the Colosseum's gear, Animations is now the Colosseum's own and starts **off**: pieces jump to their squares and the crowd doesn't jump until it's switched on. No new text. Nothing changes on any other screen.

## Stills (`docs/colosseum-crisp3d/`)
- Before and after, phone (390 × 844) and computer (1440 × 900), the start position: the high view behind White (`before-*.png`, `after-*.png`) and a seat in the stands (`*-seat3.png`).
- The near rook and knight at 4x, before, after and the reference (`compare-desktop-rook-knight.png`, `compare-phone-rook-knight.png`); the board before, after and the reference (`compare-desktop-board.png`).
- A few moves sliding: `after-desktop-moves.gif` (high view), `after-phone-seat3-moves.gif` (a seat).

## Frame rate
Headless, software WebGL, the styles in the same page in turn, the high view behind White (medians of six 2 s windows): phone Pixel 18.4, 2D 20.2, 3D 11.0; computer Pixel 9.8, 2D 9.8, 3D 7.4. Pixel now costs what 2D does (the old one was cheaper only because it drew the arena at a ninth of the pixels).

## Changed checks (old → new)
- `e2e/colosseum.spec.ts`, the first test: Pixel's draw calls `toBe(10)` ("ten draw calls a frame in Pixel") → `toBe(3)` ("three"). **Added:** the gear's Animations switch off by default (`aria-checked` false), on with a tap, saved as `colosseum-animations` = "1" with `brc.crowdAnim` still unset.
- `e2e/colosseum.spec.ts`, "the gear's Pieces": Pixel's draw calls `toBe(10)` → `toBe(3)` (at the start and on stepping back to Pixel; the title's "10, 8, 3" → "3, 8, 3"); **added** `pieces()` is "pixel" after stepping back. The 3D check `drawCalls >= 5` unchanged (now prints the state if it fails: it failed once locally on desktop and passed on the rerun and the full run).
- `packages/app/test/colosseum.test.ts`: **removed** "the pixel set … six meshes" and "as the picture has them (round 2)" (both test the deleted `pieces-pixel.ts` meshes and their sizes); **added** "twelve sprites, every pixel a palette color or empty, each outlined, standing on its foot, heights in order" and "drawn for your seat: the high view at the mockups' 30°, every view's pitch in range, a square near you about 20 art pixels, the shares each smaller". The Pieces' order/default test unchanged.
- No check guarding a rule in `docs/rules/eric.md` changed.

## Tests run locally
`npm run typecheck` (app), `packages/app/test/colosseum.test.ts` and `colosseum-sounds.test.ts` (25 + 3 passed), `e2e/colosseum.spec.ts` phone and computer (6 passed).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
