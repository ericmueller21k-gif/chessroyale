# Birdie's art in the game (Nov 23, 2026)

Moved from `claude/boss-art` into `packages/app/src/characters/` (birdie*.ts, effects/birdie.ts), lazy like every boss's.

- His frames that touched the canvas's edge are clipped and baked in (`birdie-figure.ts`): the characters test forbids edge pixels.
- Armored Birdie only has an idle drawn: his one-shots (move, capture, hurt, check, entrance) are a breath of that idle.
- His sounds are his own, synthesized (`birdie-sounds.ts`); his lines are placeholders until Eric's.
- His town home isn't built: `town-player.test.ts` now checks the admin-first bosses whose lot is in the plan.
