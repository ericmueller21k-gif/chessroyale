import { describe, expect, it } from "vitest";
import { POWER_BANNERS, SUPER_FREEZE_BEATS as SF, bannerLeadMs, powerFxMs } from "@chessroyale/chess";
import { GINGER_BATTLE, superFreezeCast } from "../src/characters/ginger-super.ts";
import { GINGER_LINES, GINGERBREAD } from "../src/characters/gingerbread.ts";
import { SUPER_ICE, SUPER_ICE_STEPS } from "../src/characters/effects/ginger-superice.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { EFFECTS } from "../src/characters/power-art.ts";
import { animLength, renderFrame } from "../src/characters/sprite.ts";
import { gingerMoments } from "../src/components/Ginger.tsx";
import type { BossView } from "../src/game.ts";

/**
 * Ginger's Super Freeze on screen (Nov 18): his cast and the ice block drawn by the art runner, timed to the beats the server and
 * solo wait for (SUPER_FREEZE_BEATS), his own sounds and lines, and its moment on his thinking screen.
 */

const cueAt = (frames: readonly { ms: number; cue?: string }[], cue: string) => {
  let t = 0;
  for (const f of frames) {
    if (f.cue === cue) return t;
    t += f.ms;
  }
  return -1;
};

describe("Ginger's Super Freeze: the art against its beats", () => {
  it("his cast (his intro's charge, one charged cycle, the blast) lasts the beats' castMs, the bolt leaving on the blast cue at boltAt", () => {
    const cast = GINGER_BATTLE.anims.superFreeze!;
    expect(cast).toBe(superFreezeCast);
    expect(animLength(cast)).toBe(SF.castMs);
    expect(cueAt(cast.frames, "charge")).toBeGreaterThanOrEqual(0);
    expect(SF.chargeAt + cueAt(cast.frames, "blast")).toBe(SF.boltAt);
    // (It ends where he stands at rest: his idle's first frame.)
    expect(cast.frames.at(-1)!.layers).toEqual(GINGERBREAD.anims.idle!.frames[0]!.layers);
    // (His drawing for the battle is his own: the same frame, foot and parts, his other animations untouched.)
    expect({ id: GINGER_BATTLE.id, w: GINGER_BATTLE.w, h: GINGER_BATTLE.h, foot: GINGER_BATTLE.foot }).toEqual({ id: GINGERBREAD.id, w: GINGERBREAD.w, h: GINGERBREAD.h, foot: GINGERBREAD.foot });
    for (const [name, anim] of Object.entries(GINGERBREAD.anims)) expect(GINGER_BATTLE.anims[name]).toBe(anim);
  });

  it("the ice block grows over growMs (each square whole within it), holds, and settles over settleMs to nothing", () => {
    expect(animLength(SUPER_ICE.anims.grow!)).toBe(SF.growMs);
    expect(animLength(SUPER_ICE.anims.settle!)).toBe(SF.settleMs);
    expect(SUPER_ICE.anims.hold!.loop).toBe(true);
    expect(SUPER_ICE_STEPS).toHaveLength(9);
    for (const t of SUPER_ICE_STEPS) expect(t).toBeLessThanOrEqual(SF.growMs);
    // (The middle first, then the sides, then the corners.)
    expect(SUPER_ICE_STEPS[4]).toBeLessThan(SUPER_ICE_STEPS[1]!);
    expect(SUPER_ICE_STEPS[1]).toBeLessThan(SUPER_ICE_STEPS[0]!);
    const last = SUPER_ICE.anims.settle!.frames.at(-1)!;
    const img = renderFrame(SUPER_ICE, last);
    expect([...img.data].filter((_, i) => i % 4 === 3).every((a) => a === 0)).toBe(true);
    expect({ w: SUPER_ICE.w, h: SUPER_ICE.h }).toEqual({ w: 96, h: 96 });
    expect(SF.settleAt - SF.iceAt).toBe(SF.growMs + SF.holdMs);
  });

  it("his own sounds (his pack's: the charge, the blast, the burst and the crackle) and his own lines", () => {
    const kit = BOSS_KITS["Ginger"]!;
    expect(kit.ch).toBe(GINGER_BATTLE);
    expect(kit.anims.superFreeze).toBe("superFreeze");
    expect(kit.sounds.charge).toBe("gingerCharge");
    expect(kit.sounds.blast).toBe("gingerBlast");
    expect(EFFECTS.superIce.sounds).toEqual({ burst: "gingerBurst", crackle: "gingerCrackle" });
    expect(GINGER_LINES.superFreeze?.length).toBeGreaterThanOrEqual(3);
  });

  it("its banner is up until he starts charging; its moment on his thinking screen, from when this device first saw it, after the banner's hold", () => {
    expect(POWER_BANNERS.superFreeze).toEqual([[0, SF.chargeAt]]);
    const boss = {
      id: "gingerbread",
      startMove: 0,
      crowdSide: "w",
      crowdMoves: 9,
      board: { fen: "4k3/8/8/8/8/8/PPP5/4K3 b - - 0 1", history: [], ply: 0 },
      powers: { turn: 9, events: [{ kind: "superFreeze", turn: 9, square: "b2", squares: ["a2", "b2", "c2"] }] },
    } as unknown as BossView;
    const [m] = gingerMoments(boss, 10_000);
    expect(m).toMatchObject({ kind: "superFreeze", square: "b2", squares: ["a2", "b2", "c2"], lead: bannerLeadMs("superFreeze") });
    expect(m!.at).toBe(10_000 + bannerLeadMs("superFreeze"));
    expect(m!.ms + m!.lead!).toBe(powerFxMs({ kind: "superFreeze" }));
    // (Drawn again later, it carries on from when it was first seen.)
    expect(gingerMoments(boss, 12_000)[0]!.at).toBe(m!.at);
    // (Another turn's, or another boss's: none.)
    expect(gingerMoments({ ...boss, powers: { ...boss.powers!, turn: 10 } } as BossView)).toEqual([]);
    expect(gingerMoments({ ...boss, id: "moo" } as BossView)).toEqual([]);
  });
});
