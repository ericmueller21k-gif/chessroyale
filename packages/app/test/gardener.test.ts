import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { KING_ATTACK, kingAttackHits } from "@chessroyale/chess";
import { GARDENER, GARDENER_ATTACK, GARDENER_PORTRAIT, gardenerLayers, type GardenerPose } from "../src/characters/gardener.ts";
import { SMUDGY } from "../src/characters/smudgy.ts";
import { frameKeys, renderFrame, type Anim, type Character } from "../src/characters/sprite.ts";

/** The select stage draws every boss at one pixel size, up to this many sprite px from the top of its drawing to its feet (BossSelect's TALLEST / PX). */
const STAGE_TALLEST = 70;

describe("the hippo gardener's still", () => {
  const still = GARDENER.anims.idle!.frames[0]!;
  const keys = frameKeys(GARDENER, still);

  it("starts its idle on the approved still, in a palette that holds every color it uses", () => {
    expect(Object.keys(GARDENER.anims)[0]).toBe("idle");
    expect(GARDENER.anims.idle!.loop).toBe(true);
    for (const [name, part] of Object.entries(GARDENER.parts))
      for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(GARDENER.palette, `${name}: "${k}"`).toHaveProperty(k);
    expect(renderFrame(GARDENER, still).data.length).toBe(GARDENER.w * GARDENER.h * 4);
  });

  it("fits the select stage's 70 px, with nothing cut off at the frame's edge, and stands on its ground point", () => {
    const top = keys.findIndex((r) => r.some(Boolean));
    expect(GARDENER.foot[1] - top).toBeLessThanOrEqual(STAGE_TALLEST);
    const edge = [...keys[0]!, ...keys[GARDENER.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[GARDENER.w - 1])];
    expect(edge.filter(Boolean)).toEqual([]);
    const [fx, fy] = GARDENER.foot;
    expect(keys[fy - 1]!.slice(fx - 6, fx + 6).some(Boolean)).toBe(true);
  });

  it("has a portrait inside the frame", () => {
    const p = GARDENER_PORTRAIT;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + p.w).toBeLessThanOrEqual(GARDENER.w);
    expect(p.y + p.h).toBeLessThanOrEqual(GARDENER.h);
  });

  it("moves by numbers: the jaw, the water, the hands and the hose redraw without error and stay in the frame", () => {
    const poses: GardenerPose[] = [
      { jaw: 30, eyes: "wide", spray: 0 },
      { nozzle: 40, fist: [17, 29], spray: 22, droop: 12, seed: 7 },
      { hand: [36, 47], bob: 1, earN: -2, earF: 2, stepN: 3, tail: 2 },
    ];
    for (const pose of poses) {
      const k = frameKeys(GARDENER, { layers: gardenerLayers(pose), ms: 100 });
      const edge = [...k[0]!, ...k[GARDENER.h - 1]!, ...k.map((r) => r[0]), ...k.map((r) => r[GARDENER.w - 1])];
      expect(edge.filter(Boolean)).toEqual([]);
    }
  });
});

/** The cue times (ms from the animation's start) in order. */
function cues(anim: Anim): [number, string][] {
  const out: [number, string][] = [];
  let t = 0;
  for (const f of anim.frames) {
    if (f.cue) out.push([t, f.cue]);
    t += f.ms;
  }
  return out;
}
const length = (a: Anim) => a.frames.reduce((t, f) => t + f.ms, 0);

describe("the hippo gardener's animations", () => {
  it("keeps the approved still as the first frame of his idle (the pixels of Eric's third pass)", () => {
    const img = renderFrame(GARDENER, GARDENER.anims.idle!.frames[0]!);
    let [x0, y0, x1, y1] = [img.w, img.h, -1, -1];
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3]) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    const h = createHash("sha1");
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) h.update(img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4));
    expect([x1 - x0 + 1, y1 - y0 + 1, h.digest("hex")]).toEqual([71, 70, "1d8d8dc55f12a411fe8dfb218878b12661c49e47"]);
  });

  it("has every animation the other bosses have, with their frame counts and lengths, looping where theirs do", () => {
    for (const name of ["idle", "entrance", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory"]) {
      const mine = GARDENER.anims[name]!;
      const theirs = SMUDGY.anims[name]!;
      expect(mine, name).toBeDefined();
      expect([mine.frames.length, length(mine), mine.loop], name).toEqual([theirs.frames.length, length(theirs), theirs.loop]);
    }
  });

  it("has his own moments, as long as Alfil's (the toss no longer than his tusk point, the watering about his Slam)", () => {
    const a = GARDENER.anims;
    expect(length(a.plant!)).toBeLessThanOrEqual(1040);
    expect(length(a.plantMany!)).toBeLessThanOrEqual(1040);
    expect(Math.abs(length(a.water!) - 1360)).toBeLessThanOrEqual(60);
    for (const name of ["plant", "plantMany", "water", "cheer", "bigCheer", "shrug"]) expect(a[name]!.loop, name).toBe(false);
  });

  it("puts the cues the board art starts from on the right frames: the seeds leave his hand, the spray starts, sweeps and stops", () => {
    const a = GARDENER.anims;
    expect(cues(a.plant!)).toEqual([[280, "toss"]]);
    expect(cues(a.plantMany!)).toEqual([[330, "toss"]]);
    expect(cues(a.water!)).toEqual([[100, "tug"], [460, "spray"], [590, "sweep"], [1010, "stop"]]);
    expect(cues(a.cheer!).map(([, c]) => c)).toEqual(["cheer"]);
    expect(cues(a.bigCheer!).map(([, c]) => c)).toEqual(["cheer", "whoop"]);
    expect(cues(a.shrug!).map(([, c]) => c)).toEqual(["shrug"]);
  });

  it("shows the toss's seeds only as they leave his hand: three, or five for the opening's bigger handful", () => {
    const seeds = (anim: Anim) => Math.max(...anim.frames.map((f) => (f.specks ?? []).filter(([, , k]) => k === "7").length / 2));
    expect(seeds(GARDENER.anims.plant!)).toBe(3);
    expect(seeds(GARDENER.anims.plantMany!)).toBe(5);
    // (Only the cue frame has them in the air: the board's seeds fly on from there.)
    for (const name of ["plant", "plantMany"]) {
      const anim = GARDENER.anims[name]!;
      const cue = anim.frames.findIndex((f) => f.cue === "toss");
      anim.frames.slice(cue + 1).forEach((f) => expect((f.specks ?? []).filter(([, , k]) => k === "7")).toEqual([]));
    }
  });

  /** The front hose of a frame: its part's pixels in frame coordinates, and the nozzle's. */
  const parts = (ch: Character, layers: readonly { part: string; x: number; y: number }[], prefix: string) =>
    layers
      .filter((l) => l.part.startsWith(prefix))
      .flatMap((l) => ch.parts[l.part]!.grid.flatMap((row, j) => [...row].flatMap((k, i) => (k !== "." ? [[l.x + i, l.y + j] as const] : []))));
  const components = (px: readonly (readonly [number, number])[]) => {
    const seen = new Set<number>();
    const key = ([x, y]: readonly [number, number]) => y * 1000 + x;
    const all = new Set(px.map(key));
    let n = 0;
    for (const p of px) {
      if (seen.has(key(p))) continue;
      n++;
      const stack = [p];
      seen.add(key(p));
      while (stack.length) {
        const [x, y] = stack.pop()!;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const q = [x + dx, y + dy] as const;
            if (all.has(key(q)) && !seen.has(key(q))) {
              seen.add(key(q));
              stack.push(q);
            }
          }
      }
    }
    return n;
  };

  it("keeps the hose connected in every frame: one piece, from the nozzle's fitting to his hip", () => {
    for (const [id, ch] of [["gardener", GARDENER], ["attack", GARDENER_ATTACK]] as const) {
      for (const [name, anim] of Object.entries(ch.anims))
        anim.frames.forEach((f, i) => {
          const where = `${id} ${name} ${i + 1}`;
          if (!f.layers.length) return;
          const hose = parts(ch, f.layers, "hose:");
          const nozzle = parts(ch, f.layers, "nozzle:");
          expect(components(hose), `${where}: the hose in one piece`).toBe(1);
          // The nozzle's fitting touches the hose.
          const near = (a: typeof hose, b: typeof hose, d: number) => a.some(([x, y]) => b.some(([u, v]) => Math.abs(x - u) <= d && Math.abs(y - v) <= d));
          expect(near(hose, nozzle, 1), `${where}: the hose reaches the nozzle`).toBe(true);
          // The other end goes in at his hip (where the torso is: the torso's layer says how he is moved).
          const torso = f.layers.find((l) => l.part === "torso")!;
          const hip: [number, number] = [torso.x - 16 + 51.8, torso.y - 16 + 52];
          expect(hose.some(([x, y]) => Math.hypot(x - hip[0], y - hip[1]) <= 3.5), `${where}: the hose reaches his hip`).toBe(true);
        });
    }
  });

  it("draws nothing at the frame's edge in any frame, and every color is in the palette", () => {
    for (const ch of [GARDENER, GARDENER_ATTACK])
      for (const [name, anim] of Object.entries(ch.anims))
        anim.frames.forEach((f, i) => {
          const k = frameKeys(ch, f);
          const edge = [...k[0]!, ...k[ch.h - 1]!, ...k.map((r) => r[0]), ...k.map((r) => r[ch.w - 1])];
          expect(edge.filter(Boolean), `${ch.id} ${name} ${i + 1}`).toEqual([]);
          for (const c of new Set(k.flat())) if (c) expect(ch.palette[c] ?? (f.pal ?? {})[c] ?? (c === "@" ? "halo" : undefined), `${ch.id} ${name}: "${c}"`).toBeDefined();
        });
  });

  it("attacks a king on the shared beats: ten jets, on the hits' own times, the last frame empty", () => {
    const attack = GARDENER_ATTACK.anims.kingAttack!;
    expect(length(attack)).toBe(KING_ATTACK.ms);
    const jets = cues(attack).filter(([, c]) => c === "jet" || c === "spurt");
    expect(jets.map(([t]) => t)).toEqual(kingAttackHits());
    expect(jets.map(([, c]) => c)).toEqual(Array.from({ length: KING_ATTACK.lashes }, (_, i) => (i % 2 ? "spurt" : "jet")));
    expect(attack.frames[attack.frames.length - 1]!.layers).toEqual([]);
    expect(cues(attack).find(([, c]) => c === "land")![0]).toBe(KING_ATTACK.landAt - 110);
  });
});
