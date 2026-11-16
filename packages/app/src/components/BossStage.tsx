import { artOf, bossKit } from "../characters/kits.ts";
import { frameKeys, type Character } from "../characters/sprite.ts";
import { STAGE_PAWN, STAGE_PAWN_FIGURE, STAGE_RISE } from "../characters/boss-select.ts";
import { SpriteAnim, prewarmAnims } from "./BossEffect.tsx";
import { bossAnims } from "./BossCharacter.tsx";

/**
 * The boss select's stage figure (BossSelect.tsx): the picked boss in his idle, from his kit. In the match's chunk with his code (Nov 16,
 * the bundle split), loaded as the Boss raid screen opens; the select's tiles and faces draw from the first load (BossPortrait.tsx).
 */
/**
 * Where a boss stands on the stage, in % of the stage's width (cqi): one size of pixel for every boss, its foot on the
 * platform's middle. Its figure aims at STAGE_PAWN pawns tall (Nov 12; Nov 11 it was STAGE_SCALE times the old size: the
 * tuning knob is in characters/boss-select.ts), and never taller than the room above its feet: its head stays on the
 * stage (a tall one, the giraffe or the Hidden Boss, is held to that room, not cut off). Worked out once a character, from
 * its idle's first frame (the rows it draws in).
 */
const PX = 0.8;
/** The old cap (before Nov 11): a figure's head-to-feet height, in cqi. Never drawn smaller than that old size. */
const TALLEST = 56;
const FOOT_AT = 50;
/**
 * Where a boss's feet stand, in its own pixels, for one whose frame's `foot` point isn't between its feet (Eric, Oct 25:
 * Big Boy stood off to one side of the platform). Big Boy's feet span x 33 to 66 in his idle; his `foot` is x 44.
 */
const STAGE_FOOT_X: Readonly<Record<string, number>> = { bigboy: 49.5 };
/**
 * The room above a boss's feet on the stage, in cqi: its feet sit 12% up from the bottom of the spot (.bs-spot), a spot is 124:96,
 * so the feet are 88% of the spot's height down. The speech bubble sits above the spot now (Nov 12, Eric: "never over the
 * head"), so the whole height is the room, less a sliver for the head's outline.
 */
const STAGE_ROOM = (1 - 0.12) * ((100 * 96) / 124) - 1;
const placed = new Map<string, { left: number; width: number }>();
function placeOnStage(ch: Character, idle: string, rise: boolean): { left: number; width: number } {
  const key = `${ch.id}:${rise}`;
  let p = placed.get(key);
  if (!p) {
    const rows = frameKeys(ch, ch.anims[idle]!.frames[0]!);
    const top = Math.max(0, rows.findIndex((r) => r.some((k) => k !== null)));
    // (Never wider than the stage: a wide one, Wrangler's lasso out to one side, slides over to stay whole.)
    const tall = Math.max(1, ch.foot[1] - top);
    // (Bigger, never smaller than before: the old size is the floor, the aim is about two pawns tall (STAGE_PAWN), the room above the feet the cap.)
    const before = Math.min(PX, TALLEST / tall, 100 / ch.w);
    // (Nov 12: aimed at about two pawns tall, capped by the room above its feet, plus the band the bubble rises into when `rise`.)
    const room = STAGE_ROOM + (rise ? STAGE_RISE : 0);
    const px = Math.max(before, Math.min((STAGE_PAWN * STAGE_PAWN_FIGURE) / tall, room / tall, 100 / ch.w));
    const width = ch.w * px;
    const footX = STAGE_FOOT_X[ch.id] ?? ch.foot[0];
    placed.set(key, (p = { left: Math.max(0, Math.min(100 - width, FOOT_AT - footX * px)), width }));
  }
  return p;
}

export function BossStageFigure({ name, since, still, rise }: { name: string; since: number; still: boolean; rise: boolean }) {
  const kit = bossKit(name);
  if (!kit) return null;
  const idle = kit.anims.idle ?? "idle";
  const { left, width } = placeOnStage(artOf(kit), idle, rise);
  return <SpriteAnim ch={artOf(kit)} anim={idle} since={since} still={still} class="bs-sprite" style={{ left: `${left}cqi`, width: `${width}cqi` }} />;
}

/** The picked boss's moves made ahead in quiet slices (sprite.ts lazyAnim; BossEffect.tsx prewarmAnims), on the Boss raid screen. */
export const prewarmBoss = (name: string | undefined): (() => void) => prewarmAnims(bossAnims(name));
