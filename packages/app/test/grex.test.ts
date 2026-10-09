import { describe, expect, it } from "vitest";
import { pickLine, type Beat } from "../src/characters/boss-beats.ts";
import { CRACKLE_EVERY, GREX_SOUNDS, WHISTLES, WHISTLE_SPREAD, grexSound, whistlePick } from "../src/characters/grex-sounds.ts";
import { CANDLE_LEN, CANDLE_SHOTS, CANDLE_SWEEP, candleMuzzle } from "../src/characters/grex.ts";
import { CANDLE, candleShotTimes, fireCountdown, shadowItems, type Moment } from "../src/components/BossPowers.tsx";
import type { BossView } from "../src/game.ts";
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
    expect(warn.frames.filter((f) => f.layers.some((l) => l.part.startsWith("tube:"))).length).toBeGreaterThan(3);
    expect(cueAt(warn, "fizz")).not.toBeNull();
  });

  it("drops onto the board with a roar, slams the big candle down and fires it 24 times, sweeping it left and right", () => {
    const rc = anim("romanCandle");
    expect(rc.loop).toBe(false);
    // He drops in: the first frames are only his growing shadow.
    expect(rc.frames[0]!.layers).toEqual([]);
    // The roar, then the slam (the picture jolts), then the volley.
    expect(cueAt(rc, "roar")!).toBeLessThan(cueAt(rc, "slam")!);
    expect(cueAt(rc, "slam")!).toBeLessThan(cueAt(rc, "launch")!);
    expect(rc.frames.find((f) => f.cue === "slam")!.shake).toBeTruthy();
    expect(grex.sounds.slam).toBe("grexSmack");
    expect(grex.sounds.shot).toBe("grexWhistle");
    const shots: number[] = [];
    let t = 0;
    for (const f of rc.frames) {
      if (f.cue === "launch" || f.cue === "shot") shots.push(t);
      t += f.ms;
    }
    expect(shots.length).toBe(CANDLE_SHOTS);
    expect(CANDLE_SHOTS).toBe(24);
    expect(shots[0]).toBe(cueAt(rc, "launch"));
    for (let n = 1; n < shots.length; n++) expect(shots[n]! - shots[n - 1]!).toBeLessThanOrEqual(140);
    // A satisfying few seconds of shots.
    expect(shots.at(-1)! - shots[0]!).toBeGreaterThan(2500);
    expect(candleShotTimes(grex)).toEqual(shots);
    // It's much bigger than before (6 x 20), and he sweeps it both ways: the shots fan out.
    expect(CANDLE_LEN).toBeGreaterThanOrEqual(40);
    expect(Math.min(...CANDLE_SWEEP)).toBeLessThanOrEqual(-20);
    expect(Math.max(...CANDLE_SWEEP)).toBeGreaterThanOrEqual(20);
    const tilts = new Set(rc.frames.filter((f) => f.cue === "shot" || f.cue === "launch").map((f) => f.layers.find((l) => l.part.startsWith("tube:"))!.part));
    expect(tilts.size).toBeGreaterThanOrEqual(7);
    // Each shot leaves from the candle's top, where it is on that frame (its cap is drawn there).
    rc.frames.forEach((f, i) => {
      if (f.cue !== "shot" && f.cue !== "launch") return;
      const n = shots.indexOf(rc.frames.slice(0, i).reduce((x, g) => x + g.ms, 0));
      const [mx, my] = candleMuzzle(n).at;
      const cap = pixels(grex.ch, rc, i, "wWB");
      expect(cap.some(([x, y]) => Math.abs(x - mx) <= 3 && Math.abs(y - my) <= 3), `shot ${n}`).toBe(true);
    });
    expect(rc.frames.at(-1)!.ms).toBeGreaterThanOrEqual(300);
    // The moment holds him on the board long enough (the shared clock gives it POWER_FX.candle).
    expect(CANDLE.exitAt + 700).toBeLessThanOrEqual(7100);
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

  it("whistles each shot up: three whistles, a little pitch either way, now and then a crackle at the top", () => {
    const picks = Array.from({ length: 300 }, (_, i) => whistlePick(((i * 0.37) % 1 + 1) % 1, ((i * 0.61) % 1 + 1) % 1, ((i * 0.83) % 1 + 1) % 1));
    expect(new Set(picks.map((p) => p.name))).toEqual(new Set(WHISTLES));
    for (const p of picks) expect(Math.abs(p.rate - 1)).toBeLessThanOrEqual(WHISTLE_SPREAD + 1e-9);
    expect(Math.min(...picks.map((p) => p.rate))).toBeLessThan(0.97);
    expect(Math.max(...picks.map((p) => p.rate))).toBeGreaterThan(1.03);
    const crackles = picks.filter((p) => p.crackleAt !== null).length / picks.length;
    expect(crackles).toBeGreaterThan(1 / CRACKLE_EVERY - 0.1);
    expect(crackles).toBeLessThan(1 / CRACKLE_EVERY + 0.1);
    // Each whistle rises: its strongest pitch near the end is well above its start (a small DFT over a window).
    for (const w of WHISTLES) {
      const s = grexSound(w, 44100);
      const pitch = (from: number) => {
        const N = 1024;
        let best = 0;
        let at = 0;
        for (let k = 8; k < 120; k++) {
          let re = 0;
          let im = 0;
          for (let i = 0; i < N; i++) {
            const a = (2 * Math.PI * k * i) / N;
            re += s[from + i]! * Math.cos(a);
            im -= s[from + i]! * Math.sin(a);
          }
          if (re * re + im * im > best) [best, at] = [re * re + im * im, k];
        }
        return (at * 44100) / N;
      };
      expect(pitch(Math.floor(s.length * 0.7)), w).toBeGreaterThan(pitch(Math.floor(44100 * 0.12)) * 1.4);
    }
  });

  it("never sounds louder than a move, even the whole volley of 24 whistles at once (the slowest, every crackle)", () => {
    const R = 44100;
    const rc = anim("romanCandle");
    const at: number[] = [];
    let t = 0;
    for (const f of rc.frames) {
      if (f.cue === "launch" || f.cue === "shot") at.push(t / 1000);
      t += f.ms;
    }
    // The worst case: each whistle as long and slow as it can be, overlapping the most, a crackle on every one.
    const mix = new Float32Array(Math.ceil(R * (at.at(-1)! + 2)));
    const add = (s: Float32Array, start: number, rate: number) => {
      for (let j = 0; j * rate < s.length; j++) {
        const k = Math.floor(start * R) + j;
        if (k < mix.length) mix[k]! += s[Math.floor(j * rate)]!;
      }
    };
    at.forEach((start, i) => {
      const w = whistlePick((i % 3) / 3 + 0.01, 0, 0);
      add(grexSound(w.name, R), start, w.rate);
      add(grexSound("sparkle", R), start + w.crackleAt!, w.rate);
    });
    const smack = grexSound("smack", R);
    let peak = 0;
    let sum = 0;
    const from = Math.floor(at[0]! * R);
    const to = Math.floor((at.at(-1)! + 0.9) * R);
    for (let i = from; i < to; i++) {
      peak = Math.max(peak, Math.abs(mix[i]!));
      sum += mix[i]! ** 2;
    }
    expect(peak).toBeLessThan(MOVE_PEAK);
    expect(10 * Math.log10(sum / (to - from))).toBeLessThan(MOVE_MEAN_DB - 1);
    // The smack is a hard hit, but no louder than a move either.
    expect(Math.max(...smack.map(Math.abs))).toBeLessThan(MOVE_PEAK / 2);
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

  it("counts the shots still up there in a column: left<n> shows n lit, from the bottom", () => {
    const shots = EFFECTS.candleShots;
    expect(shots.counter).toEqual({ prefix: "left", max: 24 });
    expect(shots.ch.h).toBeGreaterThan(shots.ch.w * 15);
    for (let n = 0; n <= 24; n++) {
      const layers = shots.ch.anims[`left${n}`]!.frames[0]!.layers;
      const lit = layers.filter((l) => l.part === "lit");
      expect(lit.length).toBe(n);
      if (n && n < 24) expect(Math.min(...lit.map((l) => l.y))).toBeGreaterThan(Math.max(...layers.filter((l) => l.part === "spent").map((l) => l.y)));
    }
  });

  it("shadows a fireball's square, small 3 turns out, bigger, then the biggest with a glow; see-through", () => {
    const sh = EFFECTS.fireShadow;
    const area = (a: string) => opaque(sh.ch, a);
    expect(area("shadow2")).toBeGreaterThan(area("shadow1") * 2);
    expect(area("shadow3")).toBeGreaterThan(area("shadow2") * 1.6);
    // Small enough at first to read as far away; never the whole square.
    expect(area("shadow1")).toBeLessThan(32 * 32 * 0.12);
    expect(area("shadow3")).toBeLessThan(32 * 32 * 0.7);
    for (const a of Object.keys(sh.ch.anims))
      for (const f of sh.ch.anims[a]!.frames) {
        const img = renderFrame(sh.ch, f);
        for (let p = 3; p < img.data.length; p += 4) expect(img.data[p]!, a).toBeLessThan(0xa0);
      }
    // Each size grows out of the one before.
    expect(sh.stages!.map((st) => st.into)).toEqual(["grow1", "grow2", "grow3"]);
  });

  it("stays cheap however long it burns: small frames, few of them, redrawn at most every 50 ms", () => {
    for (const name of ["fireTile", "pieceBurn", "sparkFly", "candleShot", "fireballFall", "candleShots", "fireShadow"] as const) {
      const fx = EFFECTS[name];
      expect(fx.ch.w * fx.ch.h, name).toBeLessThanOrEqual(32 * 32);
      for (const [a, an] of Object.entries(fx.ch.anims)) {
        if (an.loop) expect(an.frames.length, `${name} ${a}`).toBeLessThanOrEqual(8);
        for (const f of an.frames) expect(f.ms, `${name} ${a}`).toBeGreaterThanOrEqual(50);
      }
    }
  });
});

describe("the fire on screen", () => {
  it("counts down on a burning tile: the crowd moves left before it burns, 3, 2, 1 (and 0 as it burns)", () => {
    expect([1, 2, 3].map((st) => fireCountdown(st))).toEqual([3, 2, 1]);
    expect(fireCountdown(4)).toBe(0);
  });

  const view = (shadows: { square: string; lands: number; stage: number }[], turn = 6) => ({ powers: { turn, shadows } }) as unknown as Pick<BossView, "powers">;
  const moment = (kind: Moment["kind"], at: number, ms: number, squares?: string[]): Moment => ({ kind, key: kind, at, ms, ...(squares ? { squares } : {}) });

  it("shows each shadow at its size; the ones just picked once the moment that picked them is over", () => {
    const sh = [
      { square: "c3", lands: 9, stage: 1 },
      { square: "e2", lands: 8, stage: 2 },
      { square: "g4", lands: 7, stage: 3 },
    ];
    // On your move: all three, each at its size.
    expect(shadowItems(view(sh), [], 1000).map((i) => `${i.square}:${i.then}`)).toEqual(["c3:shadow1", "e2:shadow2", "g4:shadow3"]);
    // As the candle goes up, the first wave's shadows wait until he jumps off.
    const candle = moment("candle", 10_000, 7100);
    expect(shadowItems(view([sh[0]!], 3), [candle], 10_000 + CANDLE.exitAt - 1)).toEqual([]);
    expect(shadowItems(view([sh[0]!], 3), [candle], 10_000 + CANDLE.exitAt + 1).map((i) => i.square)).toEqual(["c3"]);
    // A wave landing: its squares keep their biggest shadow until each fireball lands; the new ones come after the last.
    const wave = moment("fireball", 20_000, 1700, ["a2", "h3"]);
    const during = shadowItems(view(sh), [wave], 20_100);
    expect(during.map((i) => `${i.square}:${i.then}`)).toEqual(["e2:shadow2", "g4:shadow3", "a2:shadow3", "h3:shadow3"]);
    const after = shadowItems(view(sh), [wave], 21_690);
    expect(after.map((i) => i.square)).toEqual(["c3", "e2", "g4"]);
  });
});
