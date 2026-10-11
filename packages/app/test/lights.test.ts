import { describe, expect, it } from "vitest";
import { HOLLOW_LIGHTS } from "@chessroyale/core";
import { DEFAULT_LIGHTS, LIGHT_BULBS, bulbColour, currentLights, lightsOrder, lightsSeedOf, syncLights } from "../src/characters/lights.ts";
import { BULBS, BULB_KEYS, HOLLOW, HOLLOW_ATTACK } from "../src/characters/hollow.ts";
import { EFFECTS } from "../src/characters/power-art.ts";
import { frameKeys, renderFrame, type Character, type Frame } from "../src/characters/sprite.ts";

/** Hollow's Christmas lights (Eric, Oct 11): random colours each game, never one colour on two neighbouring bulbs. */

const SEEDS = Array.from({ length: 4096 }, (_, s) => s);
/** A battle as the screens see it, with its powers' lights number. */
const battle = (lights: number) => ({ id: "hollow", startMove: 1, board: { id: 0, generation: 0 } as never, powers: { lights } as never });

/** Each pixel of a frame drawn in `key`: its colour (#rrggbb) and alpha. */
function coloursOf(ch: Character, f: Frame, key: string): { hex: string; a: number }[] {
  const keys = frameKeys(ch, f);
  const img = renderFrame(ch, f, { swap: ch.swap?.() });
  const out: { hex: string; a: number }[] = [];
  keys.forEach((row, y) =>
    row.forEach((k, x) => {
      if (k !== key) return;
      const i = (y * ch.w + x) * 4;
      out.push({ hex: `#${[0, 1, 2].map((j) => img.data[i + j]!.toString(16).padStart(2, "0")).join("")}`, a: img.data[i + 3]! });
    }),
  );
  return out;
}

describe("Hollow's lights", () => {
  it("has a palette of 8 colours, red, blue, green and yellow among them, all different", () => {
    const names = HOLLOW_LIGHTS.colours.map((c) => c.name);
    expect(names).toHaveLength(8);
    for (const n of ["red", "blue", "green", "yellow"]) expect(names).toContain(n);
    expect(new Set(HOLLOW_LIGHTS.colours.map((c) => c.glass.toLowerCase())).size).toBe(8);
    expect(LIGHT_BULBS).toBe(BULBS);
  });

  it("never puts one colour on two neighbouring bulbs, nor on bulbs that show side by side as the countdown dims some, over every seed", () => {
    for (const seed of SEEDS) {
      const order = lightsOrder(seed);
      expect(order).toHaveLength(BULBS);
      for (let i = 0; i < order.length; i++) {
        expect(Number.isInteger(order[i]) && order[i]! >= 0 && order[i]! < HOLLOW_LIGHTS.colours.length, `${seed}: bulb ${i}`).toBe(true);
        if (i >= 1) expect(order[i], `${seed}: bulbs ${i - 1} and ${i}`).not.toBe(order[i - 1]);
        if (i >= 2) expect(order[i], `${seed}: bulbs ${i - 2} and ${i}`).not.toBe(order[i - 2]);
        if (i >= 3) expect(order[i], `${seed}: bulbs ${i - 3} and ${i}`).not.toBe(order[i - 3]);
      }
    }
    // (A smaller palette still keeps neighbours apart.)
    for (const seed of SEEDS.slice(0, 200)) {
      const three = lightsOrder(seed, 10, 3);
      for (let i = 1; i < three.length; i++) expect(three[i]).not.toBe(three[i - 1]);
    }
  });

  it("gives the same lights for the same seed, and many different ones across seeds, every colour used", () => {
    for (const seed of SEEDS.slice(0, 300)) expect(lightsOrder(seed)).toEqual(lightsOrder(seed));
    const all = SEEDS.map((s) => lightsOrder(s));
    expect(new Set(all.map((o) => o.join(","))).size).toBeGreaterThan(4000);
    // Every colour turns up on every bulb, about as often as the others.
    for (let b = 0; b < BULBS; b++) {
      const counts = HOLLOW_LIGHTS.colours.map((_, c) => all.filter((o) => o[b] === c).length);
      for (const n of counts) expect(n, `bulb ${b}`).toBeGreaterThan(4096 / 8 / 2);
    }
  });

  it("takes the battle's number (the same on every screen), and the defaults before a battle shows", () => {
    expect(lightsSeedOf(battle(1234))).toBe(1234);
    // (No number from an older server: one picked here and kept for the battle.)
    const old = { ...battle(0), powers: {} as never, startMove: 7 };
    expect(lightsSeedOf(old)).toBe(lightsSeedOf(old));
    syncLights(battle(77));
    expect(currentLights()).toEqual(lightsOrder(77));
    for (let i = 1; i < DEFAULT_LIGHTS.length; i++) expect(DEFAULT_LIGHTS[i]).not.toBe(DEFAULT_LIGHTS[i - 1]);
  });

  it("draws each bulb in its battle colour on every frame (lit, out, flashing), his attack and Lights out included", () => {
    // Each bulb key: its bulb and its role (0 glass, 1 shade, 2 glint).
    const role = new Map(BULB_KEYS.flatMap((keys, b) => keys.slice(0, 3).map((k, r) => [k, [b, r] as const])));
    const OUT_OR_FLASH = ["#2e2a36", "#1d1a23", "#463f52", "#ffffff"];
    for (const seed of [5, 3070]) {
      syncLights(battle(seed));
      const order = lightsOrder(seed);
      const own = order.map((c) => bulbColour(c));
      const all = HOLLOW_LIGHTS.colours.map((_, c) => bulbColour(c));
      for (const [ch, anims] of [
        [HOLLOW, ["idle", "entrance", "victory", "lightsOut", "lightsBack", "hurt"]],
        [HOLLOW_ATTACK, ["kingAttack"]],
      ] as const) {
        for (const a of anims)
          for (const f of ch.anims[a]!.frames) {
            const keys = frameKeys(ch, f);
            const img = renderFrame(ch, f, { swap: ch.swap?.() });
            keys.forEach((row, y) =>
              row.forEach((k, x) => {
                const r = k ? role.get(k) : undefined;
                if (!r) return;
                const [b, n] = r;
                const i = (y * ch.w + x) * 4;
                const hex = `#${[0, 1, 2].map((j) => img.data[i + j]!.toString(16).padStart(2, "0")).join("")}`;
                const want = [own[b]!.glass, own[b]!.shade, own[b]!.glint][n]!;
                // Its own colour, or out (dark glass), or flashing white: never another bulb's colour.
                if (hex === want || OUT_OR_FLASH.includes(hex)) return;
                expect.fail(`${seed} ${a}: bulb ${b} drawn ${hex} (${all.find((c) => [c.glass, c.shade, c.glint].includes(hex)) ? "another colour" : "?"}), not ${want}`);
              }),
            );
          }
      }
      // The idle frame shows every bulb lit in its colour.
      const idle = HOLLOW.anims.idle!.frames[0]!;
      for (let b = 0; b < BULBS; b++) expect(coloursOf(HOLLOW, idle, BULB_KEYS[b]![0]).some((p) => p.hex === own[b]!.glass), `${seed} bulb ${b}`).toBe(true);
    }
  });

  it("colours the strip by the boss bar and the lashes on a king with the first three bulbs' colours", () => {
    syncLights(battle(2024));
    const order = lightsOrder(2024);
    const strip = EFFECTS.bulbStrand.ch;
    const lit = strip.anims.lit3!.frames[0]!;
    const keys = [["1", "4"], ["2", "5"], ["3", "6"]] as const;
    keys.forEach(([main, shade], b) => {
      expect(coloursOf(strip, lit, main).map((p) => p.hex)).toContain(bulbColour(order[b]!).glass);
      expect(coloursOf(strip, lit, shade).map((p) => p.hex)).toContain(bulbColour(order[b]!).shade);
    });
    const lash = EFFECTS.lashHit.ch;
    for (let c = 0; c < 3; c++) {
      const f = lash.anims[`hitFL${c}`]!.frames[1]!;
      expect(coloursOf(lash, f, keys[c]![0]).map((p) => p.hex)).toContain(bulbColour(order[c]!).glass);
    }
    // (Three different colours.)
    expect(new Set(order.slice(0, 3)).size).toBe(3);
  });
});
