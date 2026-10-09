import { describe, expect, it } from "vitest";
import { BOSS_ROSTER } from "@chessroyale/core";
import { pickLine, type Beat } from "../src/characters/boss-beats.ts";
import { HOLLOW_SOUNDS, hollowSound } from "../src/characters/hollow-sounds.ts";
import { BULBS, BULB_KEYS, HOLLOW_CAST_FROM, HOLLOW_HEART, STRAND_SECTIONS, bulbsLook, findLine, hollowBuild } from "../src/characters/hollow.ts";
import { bossKit } from "../src/characters/kits.ts";
import { DAWN_STAGGER, EFFECTS, POWER_MOMENTS, animLength, cueAt, darkItem, lightsOutSmashes, lightsOutSpot, nightItems } from "../src/characters/power-art.ts";
import { frameKeys, lazyParts, renderFrame, type Anim, type Character } from "../src/characters/sprite.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";

const kit = bossKit("Hollow")!;
const ch = kit.ch;
const anim = (name: string): Anim => ch.anims[name]!;
const MOMENTS: Beat[] = ["entrance", "move", "capture", "check", "hurt", "thinking", "smug", "rattled", "defeat", "victory", "strike", "power", "ultimate", "darkFirst", "claim", "found", "missed", "lightsBack"];
/** The pixels of a frame drawn in any of `keys`. */
const pixels = (c: Character, f: Anim["frames"][number], keys: readonly string[]) => frameKeys(c, f).flat().filter((k) => k && keys.includes(k)).length;
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

describe("Hollow, the Darkness boss", () => {
  it("has a kit with an animation for every moment, his powers' included, a sound for every cue and a portrait", () => {
    expect(ch.name).toBe("Hollow");
    for (const b of [...MOMENTS, "idle" as Beat]) expect(ch.anims[kit.anims[b] ?? b], b).toBeTruthy();
    for (const a of Object.values(ch.anims)) for (const f of a.frames) if (f.cue) expect(kit.sounds[f.cue], f.cue).toBeTruthy();
    expect(ch.anims[kit.portrait.anim]).toBeTruthy();
  });

  it("is playable now: the roster's Hollow uses his kit, with the dark and Lights out", () => {
    expect(BOSS_ROSTER.find((b) => b.kit === "Hollow")?.powers).toEqual({ passive: "dark", ultimate: "lightsout" });
  });

  it("is his own creature: charcoal fur, no green anywhere, a violet edge glow so he reads on the dark ground", () => {
    for (const [k, c] of Object.entries(ch.palette)) {
      const [r, g, b] = rgb(c);
      expect(g > r + 30 && g > b + 30, `${k} ${c} is green`).toBe(false);
    }
    // The fur is near-grey and dark.
    for (const k of ["d", "c", "C", "h"]) {
      const [r, g, b] = rgb(ch.palette[k]!);
      expect(Math.max(r, g, b) - Math.min(r, g, b), k).toBeLessThan(20);
      expect(r + g + b, k).toBeLessThan(260);
    }
    // The halo: violet (blue and red over green), bright enough to see on #14161b.
    const [r, g, b] = rgb(ch.halo!);
    expect(b).toBeGreaterThan(g + 60);
    expect(r).toBeGreaterThan(g + 20);
    expect(r + g + b).toBeGreaterThan(3 * 0x40);
  });

  it("idles silently: the void at his heart swirls frame to frame and a glint runs down the bulbs", () => {
    const idle = anim("idle");
    expect(idle.loop).toBe(true);
    expect(idle.frames.some((f) => f.cue)).toBe(false);
    const voidOf = (i: number) => idle.frames[i]!.layers.find((l) => l.part.startsWith("void:"))!.part;
    for (let i = 1; i < 8; i++) expect(voidOf(i)).not.toBe(voidOf(i - 1));
    const glints = idle.frames.map((f) => (f.specks ?? []).filter(([, , k]) => BULB_KEYS.some((b) => b[2] === k)).map(([, , k]) => k));
    expect(new Set(glints.flat()).size).toBe(3);
  });

  it("counts down on his strand: each look puts about a third of the bulbs out, a colour at a time", () => {
    const f = anim("idle").frames[0]!;
    // The pixels in a lit bulb's own colours (main, shade, glint).
    const litColours = new Set(BULB_KEYS.flatMap((b) => b.slice(0, 3).map((k) => ch.palette[k]!.toLowerCase())));
    const lit = (look: string) => {
      const img = renderFrame(ch, f, { look });
      let n = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        const hex = `#${[0, 1, 2].map((j) => img.data[i + j]!.toString(16).padStart(2, "0")).join("")}`;
        if (img.data[i + 3] === 255 && litColours.has(hex)) n++;
      }
      return n;
    };
    const counts = [3, 2, 1, 0].map((n) => lit(bulbsLook(n)));
    for (let i = 1; i < 4; i++) expect(counts[i]!, `bulbs${3 - i}`).toBeLessThan(counts[i - 1]!);
    expect(counts[3]).toBe(0);
    // A long strand held in the middle (Eric's reference): ten bulbs, five down each half from his hand; each look
    // puts about a third out (bulb i is colour i % 3: blue first, then gold, then red).
    expect(BULBS).toBe(10);
    const at = hollowBuild({}).bulbs;
    expect(at).toHaveLength(10);
    const hand = Math.min(...at.map(([, y]) => y));
    for (const half of [at.slice(0, 5), at.slice(5)]) expect(Math.max(...half.map(([, y]) => y)) - hand).toBeGreaterThan(12);
    const litOf = (n: number) => Array.from({ length: BULBS }, (_, i) => i % 3 < n).filter(Boolean).length;
    expect([3, 2, 1, 0].map(litOf)).toEqual([10, 7, 4, 0]);
    // Lights out takes it in three sections, every bulb once.
    expect(STRAND_SECTIONS).toHaveLength(3);
    expect(STRAND_SECTIONS.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: BULBS }, (_, i) => i));
    expect(bulbsLook(5)).toBe("bulbs3");
    expect(bulbsLook(-1)).toBe("bulbs0");
  });

  it("casts the dark: a wind-up, then at the cast cue the darkness pours out of his chest towards the board", () => {
    const cast = anim("darkCast");
    expect(cueAt(cast, "cast")).toBeGreaterThan(200);
    const i = cast.frames.findIndex((f) => f.cue === "cast");
    // The pour: violet-black specks reaching further right frame by frame, from his chest.
    const reach = (n: number) => Math.max(...(cast.frames[n]!.specks ?? []).filter(([, , k]) => "vV".includes(k)).map(([x]) => x));
    expect(reach(i + 1)).toBeGreaterThan(reach(i));
    expect(reach(i + 2)).toBeGreaterThan(reach(i + 1));
    expect(Math.min(...(cast.frames[i]!.specks ?? []).filter(([, , k]) => "vV".includes(k)).map(([x]) => x))).toBeLessThanOrEqual(HOLLOW_CAST_FROM[0] + 2);
    expect(Math.abs(HOLLOW_CAST_FROM[1] - HOLLOW_HEART[1])).toBeLessThanOrEqual(3);
  });

  it("puts the lights out on the board: drops in, smashes the strand in three strikes, a section at a time, and ends in the dark", () => {
    const lo = anim("lightsOut");
    expect(lo.frames[0]!.layers).toEqual([]);
    const t = lightsOutSmashes(lo);
    expect(t[0]).toBeGreaterThan(cueAt(lo, "land")!);
    expect(t[1]).toBeGreaterThan(t[0]! + 300);
    expect(t[2]).toBeGreaterThan(t[1]! + 300);
    // Each smash leaves a section fewer lit on the strand (their glass gone, the sockets left).
    const mains = BULB_KEYS.map((b) => b[0]);
    const at = (ms: number) => {
      let acc = 0;
      return lo.frames.find((f) => (acc += f.ms) > ms)!;
    };
    const glass = [t[0]! - 10, t[1]! - 10, t[2]! - 10, t[2]! + 10].map((ms) => pixels(ch, { ...at(ms), specks: [] }, mains));
    for (let i = 1; i < 4; i++) expect(glass[i]!).toBeLessThan(glass[i - 1]!);
    expect(glass[3]).toBe(0);
    // The last frame: his fur nearly black, the void lit, and it holds a moment for the test to take over.
    const last = lo.frames.at(-1)!;
    expect(rgb(last.pal!.C!).reduce((a, b) => a + b)).toBeLessThan(rgb(ch.palette.C!).reduce((a, b) => a + b) / 2);
    expect(last.ms).toBeGreaterThanOrEqual(300);
    expect(POWER_MOMENTS.Hollow!.ultimate).toMatchObject({ anim: "lightsOut", hit: "smash3", onBoard: true });
  });

  it("pulses with the test's countdown: a tick each second, twice in the last, lasting the round", () => {
    for (const s of [3, 4, 5]) {
      const a = anim(`test${s}`);
      expect(animLength(a)).toBe(s * 1000);
      expect(a.frames.filter((f) => f.cue === "tick").length).toBe(s + 1);
    }
    expect(anim("lightsTest").loop).toBe(true);
    expect(kit.sounds.tick).toBe("hollowTick");
  });

  it("brings the lights back: a fresh strand spills out of the void and lights, then he leaps back to his corner", () => {
    const lb = anim("lightsBack");
    expect(cueAt(lb, "relight")).not.toBeNull();
    // The strand grows out of the void over a few frames (its parts name how much of it is out).
    const outs = lb.frames.map((f) => f.layers.find((l) => l.part.startsWith("strand:"))?.part.split(":").at(-1)).filter(Boolean);
    expect(outs.slice(1, 5)).toEqual(["0.25", "0.5", "0.75", "1"]);
    expect(lb.frames.at(-1)!.layers).toEqual([]);
  });

  it("claims the dark side for the intro, with a line", () => {
    expect(cueAt(anim("claimDark"), "cast")).not.toBeNull();
    expect(pickLine(kit, "claim", "claim:0")).not.toBeNull();
  });

  it("has short lines for every moment, never instructions; the first cover always says the same thing", () => {
    for (const m of MOMENTS) {
      expect(kit.lines[m]?.length, m).toBeGreaterThan(0);
      for (const l of kit.lines[m]!) {
        expect(l.length, l).toBeLessThanOrEqual(44);
        expect(l, l).not.toMatch(/\b(tap|press|click|pick|play|move your|select)\b/i);
        expect(l, l).not.toMatch(/grinch|grimch/i);
      }
    }
    for (const m of ["move", "thinking"] as Beat[]) expect(kit.chance[m]!).toBeLessThanOrEqual(0.15);
    expect(pickLine(kit, "darkFirst", "dark:1")).toBe("Don't forget what's there. Forgetting costs.");
    expect(pickLine(kit, "ultimate", "ult:9")).toBe("It's time.");
    expect(findLine(["q"])).toBe("Find my queen.");
    expect(findLine(["r", "n"])).toBe("Find my rook and my knight.");
    expect(findLine(["k", "b", "p"])).toBe("Find my king, my bishop and my pawn.");
  });

  it("sounds no louder than a piece's move, and the same every time", () => {
    for (const name of HOLLOW_SOUNDS) {
      const s = hollowSound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      expect(10 * Math.log10(sum / s.length), name).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(s, `${name} is the same every time`).toEqual(hollowSound(name, 44100));
    }
  });
});

describe("his dark on the board", () => {
  const dark = EFFECTS.darkSquare.ch;
  const alphaAt = (c: Character, a: string, i: number) => {
    const img = renderFrame(c, c.anims[a]!.frames[i]!);
    return (x: number, y: number) => img.data[(y * c.w + x) * 4 + 3]!;
  };

  it("hides the piece under a dark square on every frame it's dark, thinning included, and its last turn reads paler", () => {
    for (const a of ["dark", "thin"])
      dark.anims[a]!.frames.forEach((_, i) => {
        const al = alphaAt(dark, a, i);
        // Where a piece can be: the square but its outer two pixels, its corners rounded (a piece is round there).
        const piece = (x: number, y: number) => (x - Math.max(7, Math.min(24, x))) ** 2 + (y - Math.max(7, Math.min(24, y))) ** 2 <= 30;
        for (let y = 2; y < 30; y++) for (let x = 2; x < 30; x++) if (piece(x, y)) expect(al(x, y), `${a} ${i} at ${x},${y}`).toBe(255);
      });
    expect(alphaAt(dark, "gather", dark.anims.gather!.frames.length - 1)(16, 3)).toBe(255);
    // Thinning is paler (a lighter average) than dark.
    const mean = (a: string) => {
      const img = renderFrame(dark, dark.anims[a]!.frames[0]!);
      let s = 0;
      for (let p = 0; p < img.data.length; p += 4) s += img.data[p]! + img.data[p + 1]! + img.data[p + 2]!;
      return s;
    };
    expect(mean("thin")).toBeGreaterThan(mean("dark") * 1.2);
    expect(EFFECTS.darkSquare.stages!.map((s) => s.loop)).toEqual(["dark", "thin"]);
  });

  it("is cloudy, never a flat box, and leaves the square's rim for the selection's green glow", () => {
    for (let i = 0; i < 8; i++) {
      const keys = frameKeys(dark, dark.anims.dark!.frames[i]!);
      expect(new Set(keys.slice(4, 28).flatMap((r) => r.slice(4, 28))).size, `frame ${i}`).toBeGreaterThanOrEqual(4);
      const al = alphaAt(dark, "dark", i);
      let clear = 0;
      let rim = 0;
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 32; x++)
          if (x < 2 || y < 2 || x > 29 || y > 29) {
            rim++;
            if (al(x, y) < 160) clear++;
          }
      expect(clear / rim, `frame ${i}`).toBeGreaterThan(0.6);
    }
    // The cloud turns: its frames differ.
    expect(JSON.stringify(frameKeys(dark, dark.anims.dark!.frames[0]!))).not.toBe(JSON.stringify(frameKeys(dark, dark.anims.dark!.frames[3]!)));
  });

  it("places the dark square's looks: forming, dark, thinning, clearing", () => {
    expect(darkItem("e4", "new", 5)).toEqual({ square: "e4", name: "darkSquare", anim: "gather", then: "dark", since: 5 });
    expect(darkItem("e4", "thin", 0).anim).toBe("thin");
    expect(darkItem("e4", "clear", 9).anim).toBe("clear");
  });

  it("counts the bulbs down on the strip: each going out ends on one fewer, the relight on all three", () => {
    const strip = EFFECTS.bulbStrand.ch;
    const last = (a: string) => renderFrame(strip, strip.anims[a]!.frames.at(-1)!).data;
    const first = (a: string) => renderFrame(strip, strip.anims[a]!.frames[0]!).data;
    // (A glint aside: compare without specks by rendering lit<n>'s glint-free frame.)
    const plain = (a: string) => renderFrame(strip, { ...strip.anims[a]!.frames[0]!, specks: [] }).data;
    expect(renderFrame(strip, { ...strip.anims.out3!.frames.at(-1)!, specks: [] }).data).toEqual(plain("lit2"));
    expect(renderFrame(strip, { ...strip.anims.out1!.frames.at(-1)!, specks: [] }).data).toEqual(plain("lit0"));
    expect(renderFrame(strip, { ...strip.anims.relight!.frames.at(-1)!, specks: [] }).data).toEqual(plain("lit3"));
    expect(cueAt(strip.anims.out2!, "pop")).toBe(0);
    expect(cueAt(strip.anims.relight!, "relight")).toBe(0);
    void last;
    void first;
  });

  it("lights out: the whole board's tiles dim, go to night (opaque, faint edges, coordinates) and come back from his spot", () => {
    const night = EFFECTS.nightSquare.ch;
    const items = (step: "dim1" | "dim2" | "dim3" | "night" | "dawn", now = 0, extra = {}) => nightItems({ orientation: "white", step, since: 0, now, ...extra });
    // Every square, and the coordinates over the night (8 ranks, 8 files; a1 has both).
    expect(items("dim1").length).toBe(64);
    expect(items("night").filter((i) => i.name === "nightSquare").length).toBe(64);
    expect(items("night").filter((i) => i.name === "nightLabel").map((i) => i.anim).sort().join("")).toBe("12345678abcdefgh");
    // The dims let the pieces show; the night hides them.
    const alpha = (a: string, f = 0) => renderFrame(night, night.anims[a]!.frames[f]!).data[16 * 32 * 4 + 16 * 4 + 3]!;
    expect(alpha("dim1", 4)).toBeLessThan(alpha("dim2", 4));
    expect(alpha("dim2", 4)).toBeLessThan(255);
    for (const it of items("night").filter((i) => i.name === "nightSquare")) for (const f of night.anims[it.anim!]!.frames) expect(renderFrame(night, f).data.filter((_, p) => p % 4 === 3).every((a) => a === 255), it.anim).toBe(true);
    // A light square is lighter than a dark one; every tile has its faint violet edge.
    const px = (a: string, x: number, y: number) => {
      const d = renderFrame(night, night.anims[a]!.frames[0]!).data;
      return [...d.slice((y * 32 + x) * 4, (y * 32 + x) * 4 + 3)];
    };
    expect(px("night0L", 20, 3)[2]!).toBeGreaterThanOrEqual(px("night0D", 20, 3)[2]!);
    const edge = px("night5D", 10, 0);
    expect(edge[2]!).toBeGreaterThan(edge[1]! + 20);
    // A found piece shows: the middle of its square clear; an answer too, in gold; only one answer sounds.
    const shown = items("night", 1000, { shown: [{ square: "d8", at: 0, kind: "found" }, { square: "a1", at: 0, kind: "answer" }, { square: "h1", at: 0, kind: "answer" }] });
    expect(shown.find((i) => i.square === "d8" && i.name === "nightSquare")!.then).toBe("shown");
    expect(renderFrame(night, night.anims.shown!.frames[0]!).data[(16 * 32 + 16) * 4 + 3]).toBe(0);
    expect(shown.filter((i) => i.anim === "answer" && !i.quiet).length).toBe(1);
    // Dawn spreads from his spot: the far squares later than the near ones; it ends empty.
    const dawn = items("dawn", 3 * DAWN_STAGGER, { from: "d8" });
    expect(dawn.find((i) => i.square === "d8" && i.name === "nightSquare")!.anim).toMatch(/^dawn/);
    expect(dawn.find((i) => i.square === "d1" && i.name === "nightSquare")!.anim).toMatch(/^night/);
    expect(frameKeys(night, night.anims.dawn0D!.frames.at(-1)!).flat().filter(Boolean)).toEqual([]);
    // Black at the bottom: the coordinates follow the board.
    const black = nightItems({ orientation: "black", step: "night", since: 0, now: 0 }).filter((i) => i.name === "nightLabel");
    expect(black.find((i) => i.anim === "8")!.square).toBe("h8");
  });

  it("stands him above the board for the test, his feet on its top edge, never over a square", () => {
    const spot = lightsOutSpot(ch, 36);
    expect(spot.top + (spot.height * ch.foot[1]) / ch.h).toBeCloseTo(0, 5);
    expect(spot.left + (spot.width * ch.foot[0]) / ch.w).toBeCloseTo(50, 5);
  });

  it("names its moments and effects in the contract", () => {
    const m = POWER_MOMENTS.Hollow!;
    expect(m.power).toMatchObject({ anim: "darkCast", hit: "cast", effects: ["darkPour", "darkSquare"] });
    for (const [name, mo] of Object.entries(m.more!)) {
      expect(ch.anims[mo.anim], name).toBeTruthy();
      if (mo.hit) expect(cueAt(ch.anims[mo.anim]!, mo.hit), `${name} ${mo.hit}`).not.toBeNull();
    }
  });
});

describe("parts made when first drawn", () => {
  it("lists every part, makes each once, and only when it's read", () => {
    let made = 0;
    const { parts, add } = lazyParts();
    add("a", () => (made++, { grid: ["x"] }));
    add("b", () => (made++, { grid: ["y"] }));
    expect(Object.keys(parts)).toEqual(["a", "b"]);
    expect(made).toBe(0);
    expect(parts.a).toBe(parts.a);
    expect(made).toBe(1);
    expect(Object.values(parts).length).toBe(2);
    expect(made).toBe(2);
    expect(parts.zzz).toBeUndefined();
  });
});
