import { describe, expect, it } from "vitest";
import { frameKeys, type Anim, type Character } from "../src/characters/sprite.ts";
import { GARDEN_PLANT, SEED_FLY, SEED_PLOP, SWEEP_MS, WATER_HIT, WATER_SWEEP } from "../src/characters/effects/gardener.ts";
import { SQUARE } from "../src/characters/effects/common.ts";

const length = (a: Anim) => a.frames.reduce((t, f) => t + f.ms, 0);
function cues(anim: Anim): [number, string][] {
  const out: [number, string][] = [];
  let t = 0;
  for (const f of anim.frames) {
    if (f.cue) out.push([t, f.cue]);
    t += f.ms;
  }
  return out;
}
const isEmpty = (ch: Character, f: Anim["frames"][number]) => frameKeys(ch, f).every((r) => r.every((c) => !c));
const ALL = [SEED_FLY, SEED_PLOP, WATER_SWEEP, GARDEN_PLANT, WATER_HIT];

describe("the hippo gardener's board art", () => {
  it("has a color for every key it draws, with each frame exactly the area it covers", () => {
    for (const ch of ALL) {
      expect(ch.palette.k, ch.id).toBeDefined();
      for (const [name, anim] of Object.entries(ch.anims))
        anim.frames.forEach((f, i) => {
          const keys = frameKeys(ch, f);
          expect([keys.length, keys[0]!.length], `${ch.id} ${name} ${i + 1}`).toEqual([ch.h, ch.w]);
          for (const c of new Set(keys.flat())) if (c) expect(f.pal?.[c] ?? ch.palette[c], `${ch.id} ${name} ${i + 1}: "${c}"`).toBeDefined();
        });
    }
    expect([SEED_FLY.w, SEED_PLOP.w, GARDEN_PLANT.w, WATER_HIT.w]).toEqual([SQUARE, SQUARE, SQUARE, SQUARE]);
    expect([WATER_SWEEP.w, WATER_SWEEP.h]).toEqual([SQUARE * 8, SQUARE * 8]);
  });

  it("leaves nothing behind: what comes and goes ends on an empty frame", () => {
    const ends = [
      ["seedPlop", SEED_PLOP, "plop"],
      ["sweep's sheen", WATER_SWEEP, "sheen"],
      ["plain plant gone", GARDEN_PLANT, "gone"],
      ["killer", GARDEN_PLANT, "kill"],
      ["bud", GARDEN_PLANT, "bud"],
      ["queen's bud", GARDEN_PLANT, "budQueen"],
      ["wilt", GARDEN_PLANT, "wilt"],
      ["a hit", WATER_HIT, "hitHR"],
      ["a hit", WATER_HIT, "hitLL"],
    ] as const;
    for (const [what, ch, name] of ends) {
      const anim = ch.anims[name]!;
      expect(anim.loop, what).toBe(false);
      expect(isEmpty(ch, anim.frames[anim.frames.length - 1]!), what).toBe(true);
    }
    // The seeds: the plop is short and light (it can play over your turn).
    expect(length(SEED_PLOP.anims.plop!)).toBeLessThanOrEqual(450);
  });

  it("starts the seed's landing on its cue and every outcome from the sprout", () => {
    expect(cues(SEED_PLOP.anims.plop!)).toEqual([[0, "plop"]]);
    expect(cues(GARDEN_PLANT.anims.sprout!).map(([, c]) => c)).toEqual(["sprout"]);
    expect(cues(GARDEN_PLANT.anims.kill!).map(([, c]) => c)).toEqual(["rise", "open", "snap", "gulp"]);
    expect(cues(GARDEN_PLANT.anims.bud!).map(([, c]) => c)).toEqual(["swell", "pop"]);
    expect(cues(GARDEN_PLANT.anims.budQueen!).map(([, c]) => c)).toEqual(["swell", "pop"]);
    expect(cues(GARDEN_PLANT.anims.wilt!).map(([, c]) => c)).toEqual(["wilt"]);
    // The queen's is a touch grander: longer, and more of it on screen at its pop.
    const pop = (name: string) => frameKeys(GARDEN_PLANT, GARDEN_PLANT.anims[name]!.frames.find((f) => f.cue === "pop")!).flat().filter(Boolean).length;
    expect(length(GARDEN_PLANT.anims.budQueen!)).toBeGreaterThan(length(GARDEN_PLANT.anims.bud!));
    expect(pop("budQueen")).toBeGreaterThan(pop("bud"));
  });

  it("plays the plain plant's three turns: green, fall colors, leaves dropping, then gone", () => {
    const a = GARDEN_PLANT.anims;
    for (const name of ["green", "fall", "drop"]) expect(a[name]!.loop, name).toBe(true);
    for (const name of ["sprout", "grow", "toFall", "toDrop", "gone"]) expect(a[name]!.loop, name).toBe(false);
    // Each change ends on the look the next state loops from.
    const last = (name: string) => JSON.stringify(a[name]!.frames[a[name]!.frames.length - 1]!.layers);
    const first = (name: string) => JSON.stringify(a[name]!.frames[0]!.layers);
    expect(last("grow")).toBe(first("green"));
    expect(last("toFall")).toBe(first("fall"));
    expect(last("toDrop")).toBe(first("drop"));
    expect(last("sprout")).toBe(JSON.stringify([{ part: "seedling", x: 0, y: 0 }]));
    // The colors are different in each state: green leaves, then oranges, then fewer leaves.
    const colors = (name: string) => new Set(frameKeys(GARDEN_PLANT, a[name]!.frames[0]!).flat().filter((c) => c && "fghijlmn".includes(c)));
    expect([...colors("green")].every((c) => "fghi".includes(c!))).toBe(true);
    expect([...colors("fall")].some((c) => "jlmn".includes(c!))).toBe(true);
    // (The stem stays green; the leaves, nearly all of the plant, are fall colors.)
    const count = (name: string, set: string) => frameKeys(GARDEN_PLANT, a[name]!.frames[0]!).flat().filter((c) => c && set.includes(c)).length;
    expect(count("fall", "jlmn")).toBeGreaterThan(count("fall", "fghi") * 4);
  });

  it("is dark-outlined and stands on soil, so it reads on every board color scheme (a green plant on the Green squares)", () => {
    // Every plant frame's silhouette is ringed in the outline color and its lowest rows are soil.
    for (const name of ["green", "fall", "drop", "kill", "bud"])
      for (const f of GARDEN_PLANT.anims[name]!.frames) {
        const keys = frameKeys(GARDEN_PLANT, f);
        const flat = keys.flat().filter(Boolean);
        if (!flat.length) continue;
        expect(flat.filter((c) => c === "k").length, name).toBeGreaterThan(8);
        const rows = keys.map((r) => r.filter(Boolean));
        const low = rows.slice(24).flat();
        expect(low.some((c) => "abcdek".includes(c!)), name).toBe(true);
      }
  });

  it("sweeps the board in about the time the spray runs, then fades its wet sheen; the tint is see-through so the pieces show", () => {
    expect(length(WATER_SWEEP.anims.sweep!)).toBe(SWEEP_MS);
    expect(cues(WATER_SWEEP.anims.sweep!)).toEqual([[0, "spray"]]);
    for (const k of ["v", "u"]) expect(WATER_SWEEP.palette[k]!.length, k).toBe(9);
    // The pass never covers more than a share of the board with opaque pixels, the sheen none but its glints.
    for (const f of [...WATER_SWEEP.anims.sweep!.frames, ...WATER_SWEEP.anims.sheen!.frames]) {
      const opaque = frameKeys(WATER_SWEEP, f).flat().filter((c) => c && c !== "v" && c !== "u").length;
      expect(opaque / (SQUARE * 8) ** 2).toBeLessThan(0.1);
    }
  });
});
