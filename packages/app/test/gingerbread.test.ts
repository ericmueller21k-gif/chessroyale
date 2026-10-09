import { describe, expect, it } from "vitest";
import { pickLine, type Beat } from "../src/characters/boss-beats.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { GINGER_SOUNDS, gingerSound } from "../src/characters/gingerbread-sounds.ts";
import { BOARD_CELL, SQUARE } from "../src/characters/effects.ts";
import { bossKit } from "../src/characters/kits.ts";
import { EFFECT_NAMES, EFFECTS, POWER_MOMENTS, animLength, cueAt } from "../src/characters/power-art.ts";
import { frameKeys, renderFrame, type Character } from "../src/characters/sprite.ts";
import { spriteFrameAt } from "../src/components/BossEffect.tsx";

const ginger = bossKit("Ginger")!;
const clown = bossKit("Boingo the Clown")!;
const MOMENTS: Beat[] = ["entrance", "move", "capture", "check", "hurt", "thinking", "smug", "rattled", "defeat", "victory", "strike", "power", "ultimateWarn", "ultimate"];

describe("Ginger, the Freeze boss", () => {
  it("has a kit with an animation for every moment, his powers included, and a sound for every cue", () => {
    expect(ginger).not.toBeNull();
    for (const b of [...MOMENTS, "idle" as Beat]) expect(ginger.ch.anims[ginger.anims[b] ?? b], b).toBeTruthy();
    for (const a of Object.values(ginger.ch.anims)) for (const f of a.frames) if (f.cue) expect(ginger.sounds[f.cue], f.cue).toBeTruthy();
  });

  it("has short lines for every moment, never instructions, rare on his plain moves", () => {
    for (const m of MOMENTS) {
      expect(ginger.lines[m]?.length, m).toBeGreaterThan(1);
      for (const l of ginger.lines[m]!) {
        expect(l.length, l).toBeLessThanOrEqual(28);
        expect(l, l).not.toMatch(/\b(tap|press|click|pick|play|move your|select)\b/i);
      }
    }
    for (const m of ["move", "thinking"] as Beat[]) expect(ginger.chance[m]!).toBeLessThanOrEqual(0.15);
    // The blizzard's warning and the blizzard itself always get a line; the same one for everyone.
    expect(pickLine(ginger, "ultimate", "ult:30")).not.toBeNull();
    expect(pickLine(ginger, "ultimateWarn", "warn:28")).toBe(pickLine(ginger, "ultimateWarn", "warn:28"));
  });

  it("casts with a glowing cane and icy eyes, and his bolt leaves the cane at the freeze cue", () => {
    const cast = ginger.ch.anims.freezeCast!;
    const at = cueAt(cast, "freeze")!;
    expect(at).toBeGreaterThan(200);
    expect(at).toBeLessThan(animLength(cast));
    const i = cast.frames.findIndex((f) => f.cue === "freeze");
    // The cane glows (its glow part is drawn) from the wind-up to the throw, and his eyes go ice-blue.
    expect(cast.frames.slice(1, i + 1).every((f) => f.layers.some((l) => l.part.startsWith("glow:")))).toBe(true);
    expect(cast.frames[i]!.pal?.e).toMatch(/^#9f/);
    // The bolt (its deep ice-blue, used nowhere else on him) flies on the two frames after, further right each time.
    const bolt = (n: number) => frameKeys(ginger.ch, cast.frames[n]!).flatMap((row) => row.flatMap((k, x) => (k === "J" ? [x] : [])));
    expect(bolt(i)).toEqual([]);
    expect(bolt(i + 1).length).toBeGreaterThan(0);
    expect(Math.min(...bolt(i + 2))).toBeGreaterThan(Math.min(...bolt(i + 1)));
  });

  it("sounds no louder than a piece's move", () => {
    for (const name of GINGER_SOUNDS) {
      const s = gingerSound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      expect(10 * Math.log10(sum / s.length), name).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(s, `${name} is the same every time`).toEqual(gingerSound(name, 44100));
    }
  });
});

describe("the power moments (power-art.ts)", () => {
  it("name, for each boss, an animation in its kit, the cue of its hit, and effects that exist", () => {
    for (const [boss, moments] of Object.entries(POWER_MOMENTS)) {
      const kit = bossKit(boss)!;
      expect(kit, boss).not.toBeNull();
      for (const beat of ["power", "ultimateWarn", "ultimate"] as const) {
        const m = moments[beat];
        expect(kit.anims[beat], `${boss} ${beat}`).toBe(m.anim);
        const anim = kit.ch.anims[m.anim]!;
        expect(anim.loop, m.anim).toBe(false);
        if (m.hit) expect(cueAt(anim, m.hit), `${m.anim} ${m.hit}`).not.toBeNull();
        for (const e of m.effects ?? []) expect(EFFECT_NAMES).toContain(e);
      }
    }
  });

  it("add Boingo's pie throw and funhouse without losing any of his moments", () => {
    for (const a of ["idle", "entrance", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory", "pieThrow", "funhouse"])
      expect(clown.ch.anims[a], a).toBeTruthy();
    // The pie leaves his glove before he laughs; the board flips mid-spin, after he lands.
    const pie = clown.ch.anims.pieThrow!;
    expect(cueAt(pie, "throw")!).toBeLessThan(cueAt(pie, "laugh")!);
    const fun = clown.ch.anims.funhouse!;
    expect(cueAt(fun, "boing")!).toBeLessThan(cueAt(fun, "flip")!);
    expect(clown.lines.ultimate?.length).toBeGreaterThan(0);
  });
});

describe("the effect sprites", () => {
  const keysOk = (ch: Character) => {
    for (const [name, part] of Object.entries(ch.parts)) for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(ch.palette, `${ch.id} ${name}: "${k}"`).toHaveProperty(k);
  };

  it("cover one square, or the whole board, and draw every frame", () => {
    for (const name of EFFECT_NAMES) {
      const fx = EFFECTS[name];
      const size = fx.covers === "board" ? 8 * BOARD_CELL : SQUARE;
      expect([fx.ch.w, fx.ch.h], name).toEqual([size, size]);
      keysOk(fx.ch);
      for (const a of Object.values(fx.ch.anims)) for (const f of a.frames) expect(renderFrame(fx.ch, f).data.length).toBe(size * size * 4);
    }
  });

  it("start once, loop while they last, and end on an empty frame, with a sound for every cue", () => {
    for (const name of EFFECT_NAMES) {
      const fx = EFFECTS[name];
      if (fx.start) expect(fx.ch.anims[fx.start]!.loop, `${name} start`).toBe(false);
      if (fx.loop) expect(fx.ch.anims[fx.loop]!.loop, `${name} loop`).toBe(true);
      const ends = [fx.end, !fx.loop ? fx.start : undefined].filter(Boolean) as string[];
      for (const e of ends) {
        const last = fx.ch.anims[e]!.frames.at(-1)!;
        expect(frameKeys(fx.ch, last).flat().filter(Boolean), `${name} ${e} ends empty`).toEqual([]);
      }
      for (const a of Object.values(fx.ch.anims)) for (const f of a.frames) if (f.cue) expect(fx.sounds[f.cue], `${name} ${f.cue}`).toBeTruthy();
    }
  });

  it("sweep the blizzard across the board in 1 to 1.5 s, with its wind", () => {
    const sweep = EFFECTS.blizzardSweep.ch.anims.sweep!;
    expect(animLength(sweep)).toBeGreaterThanOrEqual(1000);
    expect(animLength(sweep)).toBeLessThanOrEqual(1500);
    expect(cueAt(sweep, "wind")).toBe(0);
  });

  it("let a frozen piece show through the ice, inside a solid rim", () => {
    const ice = EFFECTS.iceOverlay.ch;
    const img = renderFrame(ice, ice.anims.frozen!.frames[0]!);
    const alpha = (x: number, y: number) => img.data[(y * SQUARE + x) * 4 + 3]!;
    expect(alpha(16, 20)).toBeGreaterThan(40);
    expect(alpha(16, 20)).toBeLessThan(160);
    expect(alpha(16, 1)).toBe(255);
    // Over the board, the see-through ice is blended in.
    expect(renderFrame(ice, ice.anims.frozen!.frames[0]!, { bg: "#f0d9b5" }).data[(20 * SQUARE + 16) * 4 + 3]).toBe(255);
  });
});

describe("playing an effect (BossEffect)", () => {
  const ice = EFFECTS.iceOverlay.ch;
  it("plays its start once from `since`, then its loop by the clock, or holds its last frame", () => {
    const since = 1_000_000;
    const len = animLength(ice.anims.freeze!);
    expect(spriteFrameAt(ice, "freeze", "frozen", since, since)).toMatchObject({ anim: "freeze", frame: 0 });
    expect(spriteFrameAt(ice, "freeze", "frozen", since + len + 10, since).anim).toBe("frozen");
    const thaw = ice.anims.thaw!;
    expect(spriteFrameAt(ice, "thaw", undefined, since + 60_000, since)).toMatchObject({ anim: "thaw", frame: thaw.frames.length - 1 });
    // Two devices that started it a moment apart show the same frame of the loop at the same time.
    expect(spriteFrameAt(ice, "freeze", "frozen", 5_000_123, since).frame).toBe(spriteFrameAt(ice, "freeze", "frozen", 5_000_123, since + 40).frame);
  });
});
