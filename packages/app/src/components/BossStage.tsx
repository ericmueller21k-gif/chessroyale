import { artOf, bossKit, placeFacing } from "../characters/kits.ts";
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
function placeOnStage(ch: Character, idle: string, rise: boolean, mirror: boolean, props: readonly string[] = []): { left: number; width: number } {
  const key = `${ch.id}:${rise}:${mirror}`;
  let p = placed.get(key);
  if (!p) {
    const frame = ch.anims[idle]!.frames[0]!;
    const rows = frameKeys(ch, frame);
    // (Its height is its body's: a prop (kits.ts barProps, Chandy's rifle slung up his back) never sizes a boss, as in the bar. Eric,
    // Nov 18, Chandy small on the stage: "why is this mofo so SMALL".)
    const body = props.length ? frameKeys(ch, { ...frame, specks: undefined, layers: frame.layers.filter((l) => !props.some((q) => String(l.part).startsWith(q))) }) : rows;
    const top = Math.max(0, body.findIndex((r) => r.some((k) => k !== null)));
    const tall = Math.max(1, ch.foot[1] - top);
    // (Its props stay in the room, though: the rifle's tip under the speech bubble, never cut off at the stage's top.)
    const tallAll = Math.max(tall, ch.foot[1] - Math.max(0, rows.findIndex((r) => r.some((k) => k !== null))));
    // (Never wider than the stage, by what it draws, props and all, not its frame: Chandy's frame keeps empty room for his rifle held
    // level, which halved him. A wide one, Wrangler's lasso out to one side, slides over to stay whole.)
    let x0 = ch.w;
    let x1 = -1;
    for (const r of rows) r.forEach((k, x) => k !== null && ((x0 = Math.min(x0, x)), (x1 = Math.max(x1, x))));
    if (x1 < x0) [x0, x1] = [0, ch.w - 1];
    if (mirror) [x0, x1] = [ch.w - 1 - x1, ch.w - 1 - x0];
    const drawn = x1 - x0 + 1;
    // (Bigger, never smaller than before: the old size is the floor, the aim is about two pawns tall (STAGE_PAWN), the room above the feet the cap.)
    const before = Math.min(PX, TALLEST / tall, 100 / drawn);
    // (Nov 12: aimed at about two pawns tall, capped by the room above its feet, plus the band the bubble rises into when `rise`.)
    const room = STAGE_ROOM + (rise ? STAGE_RISE : 0);
    const px = Math.max(before, Math.min((STAGE_PAWN * STAGE_PAWN_FIGURE) / tall, room / tallAll, 100 / drawn));
    const width = ch.w * px;
    // (Mirrored about its frame's middle, its feet go with it.)
    const footX = mirror ? ch.w - (STAGE_FOOT_X[ch.id] ?? ch.foot[0]) : (STAGE_FOOT_X[ch.id] ?? ch.foot[0]);
    // (Its drawn part stays on the stage; the frame's empty room may hang off it.)
    placed.set(key, (p = { left: Math.max(-x0 * px, Math.min(100 - (x1 + 1) * px, FOOT_AT - footX * px)), width }));
  }
  return p;
}

export function BossStageFigure({ name, since, still, rise }: { name: string; since: number; still: boolean; rise: boolean }) {
  const kit = bossKit(name);
  if (!kit) return null;
  const idle = kit.anims.idle ?? "idle";
  // (Facing your pawn across the stage, left of it (Nov 17, kits.ts PLACE_FACING): a drawing that faces the other way mirrored.)
  const art = artOf(kit);
  const { mirror } = placeFacing(kit, art, "stage");
  const { left, width } = placeOnStage(art, idle, rise, mirror, kit.barProps);
  return <SpriteAnim ch={art} anim={idle} since={since} still={still} class={`bs-sprite${mirror ? " bs-mirror" : ""}`} style={{ left: `${left}cqi`, width: `${width}cqi` }} />;
}

/** The picked boss's moves made ahead in quiet slices (sprite.ts lazyAnim; BossEffect.tsx prewarmAnims), on the Boss raid screen. */
export const prewarmBoss = (name: string | undefined): (() => void) => prewarmAnims(bossAnims(name));
