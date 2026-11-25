/**
 * Don Dough's attack on a king (the kit's `kingAttack`: the God King's Last Stand and his mate; Eric, Nov 10: "Same animation for the
 * God King save as well. He comes down, and it looks like he's just firing off a bunch of shots with this loaf of bread. Keep it light,
 * funny, but still a good animation"), built from his own approved frames (zebra.ts) on the shared beats (KING_ATTACK): he drops in
 * (his entrance's fall and belly-bounce landing, by 470 ms), his roll up and aimed, ten shots of his `volley` on the hits (from 560
 * ms, every 170: each a kick of the roll, a puff of flour and its pop), a laugh, and a hop off (by 2780 ms).
 * His frame and feet as drawn: he faces our right, the king to his right.
 */
import { KING_ATTACK } from "@chessroyale/chess";
import { BOSS_ZEBRA } from "./zebra.ts";
import type { Anim, Character, Frame } from "./sprite.ts";
import { lazyAnim } from "./sprite.ts";

/** Frame `i` of his animation `name`, held `ms`, with `cue` (or none). */
const at = (name: string, i: number, ms: number, cue?: string): Frame => {
  const f = BOSS_ZEBRA.anims[name]!.frames[i]!;
  return { ...f, ms, cue };
};

const kingAttack: Anim = lazyAnim(() => {
  const K = KING_ATTACK;
  const fire = 80;
  const frames: Frame[] = [
    // The drop in: in the air, landing with a thud and a belly bounce, then the roll aimed (by the first hit).
    at("entrance", 0, 110),
    at("entrance", 1, 90),
    at("entrance", 2, 130, "thud"),
    at("entrance", 3, 110),
    at("breadPop", 4, K.lashAt - 440, "draw"),
    // Ten shots on the hits: the kick and its puff, then aimed again (a volley's two frames to a hit).
    ...Array.from({ length: K.lashes }, (_, i) => [at("volley", (2 * i) % 8, fire, "pop"), at("volley", (2 * i + 1) % 8, K.lashEveryMs - fire)]).flat(),
    // A laugh, then the hop off (gone by the attack's end).
    at("breadPop", 9, K.leaveAt - (K.lashAt + K.lashes * K.lashEveryMs), "laugh"),
    at("entrance", 1, 130),
    at("entrance", 0, 130),
    { ms: K.ms - K.leaveAt - 260, layers: [] },
  ];
  return { loop: false, frames };
});

/** His attack on a king: his own parts, palette and frame. */
export const ZEBRA_ATTACK: Character = { ...BOSS_ZEBRA, id: "zebra-attack", anims: { kingAttack } };
