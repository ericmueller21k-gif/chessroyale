import { describe, expect, it } from "vitest";
import { TIMBER_BUILD } from "../src/sound.ts";
import { TIMBER_SOUNDS, timberSound, type TimberSound } from "../src/characters/timber-sounds.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { SELECT_SOUND, TOWN_SOUNDS, townSound } from "../src/characters/boss-select.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";

/** Timber's own sounds, all wood (Eric, Nov 2: "He's using Big Boy's sounds… gnawing wood… knocking, cutting, saw, thumping"). */
const kit = BOSS_KITS["Timber"]!;
const own = (name: string): boolean => name === "timberBuild" ? TIMBER_BUILD.every(own) : /^timber[A-Z]/.test(name) && TIMBER_SOUNDS.includes((name[6]!.toLowerCase() + name.slice(7)) as TimberSound);

describe("Timber's sounds", () => {
  it("are all his own: his kit's, his select sound (the chitter) and his town taps', none of another boss's", () => {
    const his = [...Object.values(kit.sounds), SELECT_SOUND.timber!, ...(TOWN_SOUNDS.timber ?? [])];
    for (const s of his) expect(own(s), s).toBe(true);
    expect(SELECT_SOUND.timber).toBe("timberChitter");
    // (Eric, Nov 2: the build a tap, a whack or a knock; the gnaw when he takes your piece.)
    expect(kit.sounds.set).toBe("timberBuild");
    expect(kit.sounds.whack).toBe("timberGnaw");
    expect([0, 1, 2, 3].map((n) => townSound("timber", n))).toEqual(["timberChitter", "timberSaw", "timberKnock", "timberChitter"]);
    // (And no other boss's kit, select or town sound is one of his.)
    for (const [name, k] of Object.entries(BOSS_KITS)) if (name !== "Timber") for (const s of Object.values(k.sounds)) expect(s, `${name}`).not.toMatch(/^timber/);
    for (const [id, s] of Object.entries(SELECT_SOUND)) if (id !== "timber") expect(s, id).not.toMatch(/^timber/);
  });

  it("has one for every cue in his animations, and every one of his is used", () => {
    for (const [name, an] of Object.entries(kit.ch.anims)) for (const f of an.frames) if (f.cue) expect(kit.sounds[f.cue], `${name}: ${f.cue}`).toBeTruthy();
    const used = new Set<string>([...Object.values(kit.sounds), SELECT_SOUND.timber!, ...(TOWN_SOUNDS.timber ?? []), ...TIMBER_BUILD]);
    for (const n of TIMBER_SOUNDS) expect(used.has(`timber${n[0]!.toUpperCase()}${n.slice(1)}` as never), n).toBe(true);
  });

  it("sound no louder than a piece's move, in line with the other bosses', and the same every time", () => {
    for (const name of TIMBER_SOUNDS) {
      const s = timberSound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      // (Big Boy's and Sawyer's sit 3 to 5 dB under a move's mean.)
      const db = 10 * Math.log10(sum / s.length);
      expect(db, name).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(db, name).toBeGreaterThan(MOVE_MEAN_DB - 6);
      expect(s, `${name} is the same every time`).toEqual(timberSound(name, 44100));
    }
  });

  it("have no chimes or bright dings: wood, teeth and a little voice, their energy low", () => {
    for (const name of TIMBER_SOUNDS) {
      const s = timberSound(name, 44100);
      let e = 0;
      let d = 0;
      for (let i = 1; i < s.length; i++) {
        e += s[i]! ** 2;
        d += (s[i]! - s[i - 1]!) ** 2;
      }
      expect((Math.sqrt(d / e) * 44100) / (2 * Math.PI), name).toBeLessThan(2500);
    }
  });
});
