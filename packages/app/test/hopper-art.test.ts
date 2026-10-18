import { describe, expect, it } from "vitest";
import { KING_ATTACK, kingAttackHits } from "@chessroyale/chess";
import { HOPPER, HOPPER_ATTACK } from "../src/characters/hopper.ts";
import { ALFIL } from "../src/characters/alfil.ts";
import { CARROT_FLY, CARROT_HIT, CARROT_ICON, CARROT_PATCH } from "../src/characters/effects/hopper.ts";
import { frameKeys, type Anim } from "../src/characters/sprite.ts";

// Chub & Chirp (the hopper) aren't in CHARACTERS yet (not wired in), so the characters test doesn't see them: the same
// checks here, and his own moments' cues for the board art.

const cueTimes = (a: Anim): [string, number][] => {
  let t = 0;
  const out: [string, number][] = [];
  for (const f of a.frames) {
    if (f.cue) out.push([f.cue, t]);
    t += f.ms;
  }
  return out;
};
const length = (a: Anim) => a.frames.reduce((t, f) => t + f.ms, 0);

describe("Chub & Chirp's sprite and animations", () => {
  for (const ch of [HOPPER, HOPPER_ATTACK, CARROT_PATCH, CARROT_FLY, CARROT_HIT, CARROT_ICON]) {
    it(`${ch.id}: draws only with its palette's colors (and the halo, "@")`, () => {
      for (const [name, anim] of Object.entries(ch.anims))
        anim.frames.forEach((f, i) => {
          for (const row of frameKeys(ch, f)) for (const k of row) if (k && k !== "@") expect(ch.palette, `${name} frame ${i + 1}: "${k}"`).toHaveProperty(k);
        });
    });
  }

  for (const ch of [HOPPER, HOPPER_ATTACK]) {
    it(`${ch.id}: nothing is cut off at the frame's edge`, () => {
      for (const [name, anim] of Object.entries(ch.anims))
        anim.frames.forEach((f, i) => {
          const keys = frameKeys(ch, f);
          const edge = [...keys[0]!, ...keys[ch.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[ch.w - 1])];
          expect(edge.filter(Boolean), `${name} frame ${i + 1}`).toEqual([]);
        });
    });
  }

  it("has every animation the other bosses have, a looping idle and cued one-shots", () => {
    for (const name of ["idle", "entrance", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory"]) expect(HOPPER.anims).toHaveProperty(name);
    expect(HOPPER.anims.idle!.loop).toBe(true);
    for (const a of Object.values(HOPPER.anims).filter((a) => !a.loop)) expect(a.frames.some((f) => f.cue)).toBe(true);
    const [fx, fy] = HOPPER.foot;
    expect(frameKeys(HOPPER, HOPPER.anims.idle!.frames[0]!)[fy - 1]!.slice(fx - 6, fx + 6).some(Boolean)).toBe(true);
  });

  it("leapfrog: the take-off, then the landing", () => {
    expect(cueTimes(HOPPER.anims.leapfrog!).map(([c]) => c)).toEqual(["takeoff", "land"]);
  });

  it("Carrot Patch: five tosses, each carrot landing 300 ms later, about as long as Alfil's Slam", () => {
    const cues = new Map(cueTimes(HOPPER.anims.carrotPatch!));
    for (let n = 1; n <= 5; n++) {
      // Each flies 300 ms (the board's flight from his paw to its square), and he tosses one every 210 ms.
      expect(cues.get(`plant${n}`)! - cues.get(`toss${n}`)!).toBe(300);
      if (n > 1) expect(cues.get(`toss${n}`)! - cues.get(`toss${n - 1}`)!).toBe(210);
    }
    expect(cues.size).toBe(10);
    const ms = length(HOPPER.anims.carrotPatch!);
    const slam = length(ALFIL.anims.mammothSlam!);
    expect(Math.abs(ms - slam) / slam).toBeLessThan(0.15);
  });

  it("the race won and lost are short beats", () => {
    expect(length(HOPPER.anims.raceWon!)).toBeLessThan(1200);
    expect(length(HOPPER.anims.raceLost!)).toBeLessThan(1200);
  });

  it("his attack on a king: the shared beats, a carrot thrown on every hit", () => {
    const a = HOPPER_ATTACK.anims.kingAttack!;
    expect(length(a)).toBe(KING_ATTACK.ms);
    const cues = new Map(cueTimes(a).map(([c, t]) => [t, c]));
    for (const [i, t] of kingAttackHits().entries()) expect(cues.get(t), `hit ${i + 1}`).toBe(i % 2 ? "bonk" : "toss");
    expect(a.frames[a.frames.length - 1]!.layers).toEqual([]);
  });

  it("the board's carrots: each pull ends on its side's claimed look", () => {
    for (const side of ["W", "B"]) {
      const pull = CARROT_PATCH.anims[`pull${side}`]!;
      expect(pull.frames.some((f) => f.cue === "pop")).toBe(true);
      expect(pull.frames[pull.frames.length - 1]!.layers).toEqual(CARROT_PATCH.anims[`claimed${side}`]!.frames[0]!.layers);
    }
    expect(CARROT_PATCH.anims.plant!.frames[0]!.cue).toBe("thunk");
    expect(CARROT_PATCH.anims.plant!.frames.at(-1)!.layers).toEqual(CARROT_PATCH.anims.planted!.frames[0]!.layers);
    for (const [name, a] of Object.entries(CARROT_HIT.anims)) expect(a.frames.at(-1)!.layers, name).toEqual([]);
  });
});
