# Town square: arrow keys walk you; zoom pill and focus button shrink under the keys

Lane: targeted (the town). Eric approved the look (Nov 4, `town-arrow-keys.png` option A) and the shrink (`town-arrow-keys-v3.png`).
Decision note: `docs/decisions/2026-11-04-town-arrow-keys.md`. Area page: `docs/areas/town-square.md` ("Arrow keys").

## Player-visible changes
- **Arrow keys, on screen** (bottom right of the town box): up on top, left / down / right in a row. Each key 27 px, 3 px gaps,
  rounded, see-through white with a thin dark outline and a chevron. Held: dark, white chevron, a pixel lower. Phone and computer.
- **Hold a key, you walk that way** (town square and inside shops), square to square at a tap's pace, for as long as it's held;
  release stops you after the step in progress. Two held is a diagonal. Walls, the floor and people stop you as they stop a tap.
- **Keyboard**: the arrow keys and WASD do the same; the matching on-screen key lights while held. Ignored while typing in a box or a chat log.
- **Zoom pill and focus button** shrink to 57 × 27 and 27 × 27 px, together 87 px (the keys' width), right-aligned under the keys.
  Same look and same actions, just smaller.
- A key walk stands you up, closes an open card and calls off a game you were walking to, as a tap does.
- No new text on screen.

## Changed checks (old → new)
- `e2e/town-desktop.spec.ts`, "phones and tablets: the town's boxes are main's ...": the `controls`, `zoom` and `focus` boxes at
  390×844, 430×932, 768×1024 and 1024×768. Old `controls` e.g. [242, 794, 134, 36] → new [289, 740, 87, 90]; old `zoom` [242, 794, 88, 36]
  → new [289, 803, 57, 27]; old `focus` [340, 794, 36, 36] → new [349, 803, 27, 27] (the other sizes likewise). The 14 px from the box's
  right and foot still hold. Bar, world and chat box unchanged.
- No check removed. Nothing in `docs/rules/eric.md` guards these boxes (the "containers keep their size" rule is the one Eric's
  shrink request sets aside, for these two buttons only).

## New checks
- `e2e/town.spec.ts`, "the arrow keys: holding ArrowUp walks you up and the up key lights while it's held; the on-screen down arrow walks you back; a release stops you" (phone and computer).
- `packages/app/test/town-arrows.test.ts` (9 tests): the step each held combination asks for, diagonal axis alternation, WASD,
  keyWalk runs on square to square, stops after release, stops at a wall, diagonals stay diagonal.

## Verification
- `npx tsc -p packages/app --noEmit` clean; `npx vitest run packages/app/test/town-arrows.test.ts` 9 passed.
- e2e local (targeted: `town.spec.ts`, `town-desktop.spec.ts`): 57 passed, 6 skipped (project-specific), 1 layout table fixed (controls
  height 90, not 60) and rerun passed.
- Stills (before = main 8af7ee6a, after = this branch): `docs/town-arrow-keys/phone-before.png`, `phone-after.png`,
  `phone-after-pressed.png`, `computer-before.png`, `computer-after.png`, `computer-after-pressed.png`. Sprites: the pawn and the
  bots stay whole on screen in every still.

## Not done / for the director
- Frame-rate measurement against main: not run. The change adds one call per frame to the town's frame loop (`keysWalk`: a read
  of four booleans, no allocation while no key is held); the walker's per-step lookahead runs once per 90 ms step. Flagged because the
  town rule asks for a measurement whenever the frame loop changes.
- Keys are 27 px (the sketch's size), below the 44 px tap guideline; the sketch sets it, so it's kept.
- Tap targets: the zoom and focus buttons are 27 px tall too (were 36).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
