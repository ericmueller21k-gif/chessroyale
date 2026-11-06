# Sprite kit + Smudgy pilot (Nov 6)

Goal: one shared, data-driven way to make boss/character sprites, so a new boss's figure is data, not bespoke drawing code.
Bosses stay 2D pixel sprites (Eric agreed, Nov 6). Read docs/rules/eric.md, packages/app/src/characters/ (sprite.ts, kits.ts,
index.ts, side-size.ts, each boss's art) and how intros and the board figures use them before designing.

## The kit (infrastructure; merges on green)
- Shared rules in code: texel size per figure class (town walker, board figure, intro figure), palette ramps (3 steps per hue),
  the 1-px ink outline, nearest filtering at 1.5x or more.
- Sprites as data: `{ palette, grids/parts, frames, anchors (feet, hands, head), facing }`; frame templates (idle, walk, talk,
  attack, hurt) a boss fills in. One renderer from data to cached canvases, used by town, rooms, intros and boards.
- **Facing is explicit data** (left/right, plus which way is "toward the board/opponent") so no caller guesses by mirroring.
- Kit unit tests: palette use only, outline present, anchors inside the grid, every frame the same size, facing flips anchors.
- Don't move other bosses. They move only when next touched.

## The pilot: Smudgy (look needs Eric's OK before merge)
- Move Smudgy onto the kit with the same look (pixel-diff vs today at the same scale; any change must be deliberate and listed).
- **Bug Eric saw:** in the battle intro, Smudgy is facing the wrong way when the match starts. Find the cause (likely a mirror/
  facing default in the intro or the board-side figure), fix it through the kit's facing data, and add a test that his figure
  faces the board/opponent at the intro's last frame and the match's first frame, on phone and computer, both sides of the board.
- Check the other bosses' intros for the same bug (number check: facing at the intro's end); list any that are wrong. Fix them
  only if the fix is the same one-line facing data; otherwise list them for later.

## Deliverables
- Before/after stills of Smudgy (town, room, board, intro last frame) and a GIF of the battle intro start, phone; one computer
  still. In the scratchpad folder given in the prompt, NOT in the repo.
- areas.json, area page lines (<=5 per page), decision note (<=10 lines). PR (full-e2e), body <=40 lines.
