# Big Boy's tower seen from above (Eric, Nov 18: option 3). Opus, high (art and animation; boss lane)

Branch `claude/bigboy-tower-topdown` from main. About 1.5-2 h. Read CLAUDE.md, `.claude/LESSONS.md`, `.claude/agents/characters.md`,
`docs/areas/bosses.md` (Big Boy), `docs/decisions/2026-11-18-bigboy-tower*.md`. Mockups and Eric's pick: branch
`stills/bigboy-tower-topdown` (`1-option3-numbers.png`, `2-closeup.png`; `mock-tower3.py` has the geometry I used: each block up
grows 3.5% and rises 2.4 art px, small jitter). The mockups are a quick sketch, not the art.

**Why (Eric):** today's 10-tall tower climbs about 4 squares up the board and covers everything behind it. Seen from above it
stays about on its own square (about 1.3 squares at 10). The **rules don't change**: only how it looks.

**What Eric asked for, in his words:**
- "Number 3 is the way": the tower seen from above, rising toward you. Each block a little bigger and a little higher than the
  one under it, a little off-center, so the lower blocks show as strips under the top one.
- **The count on the top block**, as a number ("If it says 3, then you know there's 3 blocks"), in "the original toy block
  design", "wooden", with "that carved wooden effect" (today's blocks: beveled wood rim, colored panel, cream glyph with its
  shade). My call: every block carries its own number (1 at the bottom … N on top), so the top always shows the count and a
  scattered block shows its number.
- **A shadow on the board for the whole tower** that grows as it gets taller, "to show its size".
- **Each new block** "come[s] down on top of it with a shadow, like getting bigger and bigger, and it plops on it every
  turn": keep his toss beat, then the block comes in from above (large, near the camera, shrinking to its place) while its
  shadow on the top of the stack grows to full size, then a plop (squash and bounce) and the tower settles.
- **The wobble:** "slightly misaligned also and wobbling ... like a building that's kind of wavering back and forth": the sway
  grows with each block up (the top moves most) and grows with height overall; at 10, the big wobble as today.
- **The topple:** "a pretty easy collapsing animation, because they're all scattering from that one spot": the stack collapses
  and the blocks fly out from the square to their scatter squares (today's ToppleFlights, starting from each block's new place).
  Scattered blocks are drawn from the same angle (one block from above).

**How (simple beats flashy, CLAUDE.md):** redraw `characters/effects/bigboy-tower.ts` (stand<N>, add<N>, tip<N>) with the art
runner (Opus, high; cap $6), not by hand; reuse the existing board layer, moments, sounds, lines and flights; update
`TOWER_BLOCKS`/`towerPoint` for the new geometry. Keep the tower under the pieces and the square marks (unchanged). The board
shadow can be part of the drawing. Check the first (1-block) and full (10) towers on a phone at 428 x 746 and a computer at
1280 x 800, light and dark, and watch the drop, wobble and topple frame by frame (`npm run frames:bigboy`, `?boss=bigboy&power=tower`).
@perf on a slowed phone if the frame loop changes (it shouldn't).

**Lane:** boss lane: targeted checks, the boss kit, `e2e/bigboy.spec.ts` (update its tower checks as needed; list changes old → new),
then the director's quick review. Done: stills on `stills/bigboy-tower-topdown` (phone first), `.pr-body.md` (under 40 lines) and
`.done`; push and end. No PRs, no CI waits.
