import { describe, expect, it } from "vitest";
import { pickLine, type Beat } from "../src/characters/boss-beats.ts";
import { GREX_SOUNDS, grexSound } from "../src/characters/grex-sounds.ts";
import { bossKit } from "../src/characters/kits.ts";
import { EFFECTS, POWER_MOMENTS, animLength, cueAt } from "../src/characters/power-art.ts";
import { frameKeys, renderFrame, type Anim, type Character } from "../src/characters/sprite.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";

const grex = bossKit("G-REX")!;
const MOMENTS: Beat[] = ["entrance", "move", "capture", "check", "hurt", "thinking", "smug", "rattled", "defeat", "victory", "strike", "power", "powerHit", "ultimateWarn", "ultimate", "ultimateHit"];
const anim = (name: string): Anim => grex.ch.anims[name]!;
/** The pixels of a frame drawn in a palette key. */
const pixels = (ch: Character, a: Anim, i: number, keys: string) => frameKeys(ch, a.frames[i]!).flatMap((row, y) => row.flatMap((k, x) => (k && keys.includes(k) ? [[x, y] as const] : [])));

describe("G-REX, the Fire boss", () => {
  it("has a kit with an animation for every moment, his powers' included, and a sound for every cue", () => {
    expect(grex).not.toBeNull();
    expect(grex.ch.name).toBe("G-REX");
    for (const b of [...MOMENTS, "idle" as Beat]) expect(grex.ch.anims[grex.anims[b] ?? b], b).toBeTruthy();
    for (const a of Object.values(grex.ch.anims)) for (const f of a.frames) if (f.cue) expect(grex.sounds[f.cue], f.cue).toBeTruthy();
    expect(grex.ch.anims[grex.portrait.anim]).toBeTruthy();
  });

  it("has a dark outline and halo, so he reads on the light and the dark ground", () => {
    expect(grex.ch.halo).toBeTruthy();
    const lum = (hex: string) => [1, 3, 5].reduce((s, i, n) => s + parseInt(hex.slice(i, i + 2), 16) * [0.3, 0.59, 0.11][n]!, 0);
    expect(lum(grex.ch.palette.k!)).toBeLessThan(40);
    expect(lum(grex.ch.halo!)).toBeLessThan(60);
  });

  it("crackles while idle: his flames change shape and his sparklers spit different sparks frame to frame, silently", () => {
    const idle = anim("idle");
    expect(idle.loop).toBe(true);
    expect(idle.frames.some((f) => f.cue)).toBe(false);
    const flames = (i: number) => idle.frames[i]!.layers.filter((l) => /^(horn|tail|mane)(Big)?:\d$/.test(l.part)).map((l) => l.part).join();
    for (let i = 1; i < 8; i++) expect(flames(i), `frame ${i}`).not.toBe(flames(i - 1));
    const sparks = (i: number) => JSON.stringify(idle.frames[i]!.specks);
    for (let i = 1; i < 8; i++) expect(sparks(i)).not.toBe(sparks(i - 1));
    // A head bob to the beat: his head is a pixel lower on some frames.
    const headY = new Set(idle.frames.slice(0, 8).map((f) => f.layers.find((l) => l.part.startsWith("head:"))!.y));
    expect(headY.size).toBe(2);
  });

  it("has short lines for every moment, never instructions, rare on his plain moves", () => {
    for (const m of MOMENTS) {
      expect(grex.lines[m]?.length, m).toBeGreaterThan(1);
      for (const l of grex.lines[m]!) {
        expect(l.length, l).toBeLessThanOrEqual(28);
        expect(l, l).not.toMatch(/\b(tap|press|click|pick|play|move your|select)\b/i);
      }
    }
    for (const m of ["move", "thinking"] as Beat[]) expect(grex.chance[m]!).toBeLessThanOrEqual(0.15);
    // The Roman candle's warning and launch always get a line, the same one for everyone.
    expect(pickLine(grex, "ultimate", "ult:30")).not.toBeNull();
    expect(pickLine(grex, "ultimateWarn", "warn:28")).toBe(pickLine(grex, "ultimateWarn", "warn:28"));
  });

  it("throws his sparkler at the throw cue: it leaves his hand and flies on towards the board", () => {
    const ig = anim("ignite");
    const i = ig.frames.findIndex((f) => f.cue === "throw");
    expect(cueAt(ig, "throw")).toBeGreaterThan(150);
    const wires = (n: number) => ig.frames[n]!.layers.filter((l) => l.part.startsWith("wire:")).length;
    // Two sparklers in his hands before the throw, one after, two again once a fresh one fizzes alight.
    expect(wires(i - 1)).toBe(2);
    expect(wires(i)).toBe(1);
    const fresh = ig.frames.findIndex((f, n) => n > i && f.cue === "fizz");
    expect(fresh).toBeGreaterThan(i);
    expect(wires(fresh)).toBe(2);
    // The thrown one (its grey wire, loose) moves right and down over the frames after.
    const thrown = (n: number) => ig.frames[n]!.specks!.filter((s) => s[2] === "w" || s[2] === "W").map((s) => s[0] + s[1]);
    expect(Math.min(...thrown(i + 1))).toBeGreaterThan(Math.min(...thrown(i)));
    expect(Math.min(...thrown(i + 2))).toBeGreaterThan(Math.min(...thrown(i + 1)));
  });

  it("warns of the Roman candle by showing it off, its fuse fizzing", () => {
    const warn = anim("candleWarn");
    expect(warn.loop).toBe(false);
    expect(warn.frames.filter((f) => f.layers.some((l) => l.part === "candle")).length).toBeGreaterThan(3);
    expect(cueAt(warn, "fizz")).not.toBeNull();
  });

  it("drops onto the board with a roar and fires the Roman candle twelve times, in rapid succession", () => {
    const rc = anim("romanCandle");
    expect(rc.loop).toBe(false);
    // He drops in: the first frames are only his growing shadow.
    expect(rc.frames[0]!.layers).toEqual([]);
    expect(cueAt(rc, "roar")!).toBeLessThan(cueAt(rc, "launch")!);
    const shots: number[] = [];
    let t = 0;
    for (const f of rc.frames) {
      if (f.cue === "launch" || f.cue === "shot") shots.push(t);
      t += f.ms;
    }
    expect(shots.length).toBe(12);
    expect(shots[0]).toBe(cueAt(rc, "launch"));
    for (let n = 1; n < shots.length; n++) expect(shots[n]! - shots[n - 1]!).toBeLessThanOrEqual(160);
    // Each shot's rocket climbs from the candle's top on the frames after it.
    const i = rc.frames.findIndex((f) => f.cue === "launch");
    const top = (n: number) => Math.min(...rc.frames[n]!.specks!.filter((s) => s[2] === "x").map((s) => s[1]));
    expect(top(i + 1)).toBeLessThan(top(i));
    expect(rc.frames.at(-1)!.ms).toBeGreaterThanOrEqual(300);
    expect(animLength(rc)).toBeLessThan(4000);
  });

  it("goes out in smoke when he's beaten: his shades fly off and his flames turn to puffs", () => {
    const d = anim("defeat");
    const last = d.frames.at(-1)!;
    expect(last.layers.some((l) => l.part.startsWith("puff:"))).toBe(true);
    expect(last.layers.some((l) => /^(horn|tail|mane)(Big)?:\d$/.test(l.part))).toBe(false);
    expect(last.layers.find((l) => l.part.startsWith("head:"))!.part).toBe("head:out");
  });

  it("sounds no louder than a piece's move, and the same every time", () => {
    for (const name of GREX_SOUNDS) {
      const s = grexSound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      expect(10 * Math.log10(sum / s.length), name).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(s, `${name} is the same every time`).toEqual(grexSound(name, 44100));
    }
  });

  it("names his power moments in the contract: the throw, the warning, the candle on the board, the payoffs later", () => {
    const m = POWER_MOMENTS["G-REX"]!;
    expect(m.power).toMatchObject({ anim: "ignite", hit: "throw", effects: ["sparkFly", "fireTile"] });
    expect(m.ultimate).toMatchObject({ anim: "romanCandle", hit: "launch", onBoard: true });
    for (const beat of ["powerHit", "ultimateHit"] as const) {
      expect(grex.anims[beat], beat).toBe(m[beat]!.anim);
      expect(grex.lines[beat]!.length).toBeGreaterThan(1);
    }
    expect(m.powerHit!.effects).toContain("pieceBurn");
    expect(m.ultimateHit!.effects).toContain("fireballFall");
  });
});

describe("his fire on the board", () => {
  const tile = EFFECTS.fireTile;
  const opaque = (ch: Character, a: string, i = 0) => {
    const img = renderFrame(ch, ch.anims[a]!.frames[i]!);
    let n = 0;
    for (let p = 3; p < img.data.length; p += 4) if (img.data[p]! > 0) n++;
    return n;
  };

  it("burns a tile up in three stages that read on their own: each covers more, with more flame", () => {
    const flame = (a: string) => tile.ch.anims[a]!.frames.reduce((s, _, i) => s + pixels(tile.ch, tile.ch.anims[a]!, i, "yYfFR").length, 0);
    expect(flame("stage2")).toBeGreaterThan(flame("stage1") * 1.4);
    expect(flame("stage3")).toBeGreaterThan(flame("stage2") * 1.4);
    expect(opaque(tile.ch, "stage2")).toBeGreaterThan(opaque(tile.ch, "stage1"));
    expect(tile.stages!.map((s) => s.loop)).toEqual(["stage1", "stage2", "stage3"]);
  });

  it("keeps a piece on it visible at every stage: its middle shows through", () => {
    for (const st of ["stage1", "stage2", "stage3"]) {
      const img = renderFrame(tile.ch, tile.ch.anims[st]!.frames[0]!);
      let clear = 0;
      for (let y = 6; y < 18; y++) for (let x = 11; x < 21; x++) if (img.data[(y * 32 + x) * 4 + 3]! < 128) clear++;
      expect(clear / 120, st).toBeGreaterThan(0.8);
    }
  });

  it("fizzles under the fireproof king, sooner and smaller than it burns out", () => {
    const fz = tile.ch.anims[tile.endings!.fizzle!]!;
    expect(animLength(fz)).toBeLessThan(animLength(tile.ch.anims.burnOut!));
    expect(cueAt(fz, "fizzle")).toBe(0);
  });

  it("burns each kind of piece to ash: the real piece comes off at poof, its charred shape crumbles from the top", () => {
    const burn = EFFECTS.pieceBurn;
    for (const pc of ["p", "n", "b", "r", "q"] as const) {
      const a = burn.ch.anims[burn.pieces![pc]]!;
      const i = a.frames.findIndex((f) => f.cue === "poof");
      expect(i, pc).toBeGreaterThan(0);
      // After the poof its charred shape shows, and each crumbling frame shows less of it, from the top.
      const charTop = (n: number) => Math.min(...pixels(burn.ch, a, n, "cd").map(([, y]) => y));
      expect(pixels(burn.ch, a, i + 1, "cd").length).toBeGreaterThan(40);
      expect(charTop(i + 4)).toBeGreaterThan(charTop(i + 2));
      expect(charTop(i + 6)).toBeGreaterThan(charTop(i + 4));
    }
  });

  it("counts the shots still up there: left<n> shows n lit", () => {
    const shots = EFFECTS.candleShots;
    for (let n = 0; n <= 12; n++) expect(shots.ch.anims[`left${n}`]!.frames[0]!.layers.filter((l) => l.part === "lit").length).toBe(n);
  });

  it("stays cheap however long it burns: small frames, few of them, redrawn at most every 50 ms", () => {
    for (const name of ["fireTile", "pieceBurn", "sparkFly", "candleShot", "fireballFall", "candleShots"] as const) {
      const fx = EFFECTS[name];
      expect(fx.ch.w * fx.ch.h, name).toBeLessThanOrEqual(32 * 32);
      for (const [a, an] of Object.entries(fx.ch.anims)) {
        if (an.loop) expect(an.frames.length, `${name} ${a}`).toBeLessThanOrEqual(8);
        for (const f of an.frames) expect(f.ms, `${name} ${a}`).toBeGreaterThanOrEqual(50);
      }
    }
  });
});
