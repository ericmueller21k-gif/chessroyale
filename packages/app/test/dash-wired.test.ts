import { describe, expect, it } from "vitest";
import { DASH_ANIM } from "@chessroyale/chess";
import { BOSS_POWERS } from "@chessroyale/core";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { BOSS_BLITZ } from "../src/characters/boss-blitz.ts";
import { DASH_FIGURE, DASH_ROOM } from "../src/characters/dash-figure.ts";
import { DASH_CHANCE, DASH_LINES } from "../src/characters/dash-lines.ts";
import { DASH_SOUNDS, dashSound, type DashSound } from "../src/characters/dash-sounds.ts";
import { sidekickBlitz } from "../src/characters/sidekicks/sidekick-blitz.ts";
import { SELECT_LINES, SELECT_SOUND } from "../src/characters/boss-select.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { TOKEN_ART } from "../src/components/tokens/index.ts";
import { DASH_UI, DASH_WORDS, slapText } from "../src/components/Dash.tsx";
import { POWER_WORDS } from "../src/power-words.ts";

/** Dash's wiring (docs/decisions/2026-11-03-dash.md): his art, lines, sounds, select, token and words. */
const kit = BOSS_KITS["Dash"]!;
const cue = (anim: string, name: string) => {
  let t = 0;
  for (const f of BOSS_BLITZ.anims[anim]!.frames) {
    if (f.cue === name) return t;
    t += f.ms;
  }
  return null;
};
const length = (anim: string) => BOSS_BLITZ.anims[anim]!.frames.reduce((s, f) => s + f.ms, 0);

describe("Dash's wiring", () => {
  it("his figure is the art's as drawn, in a frame with room on its right (his feet where they were); his name says Dash everywhere a player sees", () => {
    expect(kit.ch).toBe(DASH_FIGURE);
    expect(DASH_FIGURE.anims).toBe(BOSS_BLITZ.anims);
    expect(DASH_FIGURE.w).toBe(BOSS_BLITZ.w + DASH_ROOM);
    expect(DASH_FIGURE.foot).toEqual(BOSS_BLITZ.foot);
    expect([DASH_FIGURE.name, sidekickBlitz.name, TOKEN_ART.dash!.name]).toEqual(["Dash", "Tick", "Dash token"]);
    const words = [...Object.values(DASH_LINES).flat(), ...(SELECT_LINES.dash ?? []), POWER_WORDS.clockslap, POWER_WORDS.scramble, DASH_WORDS.slap, DASH_WORDS.flag, DASH_WORDS.scramble(5, 3), DASH_UI.ultimate.name];
    for (const w of words) expect(w, w).not.toMatch(/blitz/i);
  });

  it("his moments' beats are his animations': the slap's slam and steal, the scramble's length, his finger gun", () => {
    expect(length("clockSlap")).toBe(DASH_ANIM.clockSlap);
    expect(cue("clockSlap", "slam")).toBe(DASH_ANIM.slapHitAt);
    expect(cue("clockSlap", "steal")).toBe(DASH_ANIM.stealAt);
    expect(length("timeScramble")).toBe(DASH_ANIM.timeScramble);
    expect(length("scrambleWarn")).toBe(DASH_ANIM.scrambleWarn);
    expect(length("check")).toBe(DASH_ANIM.check);
    expect(kit.anims).toMatchObject({ power: "clockSlap", ultimateWarn: "scrambleWarn", ultimate: "timeScramble" });
  });

  it("his lines: two or three a moment, short enough for the bubble; his slap, scramble and flag always speak", () => {
    for (const [beat, lines] of Object.entries(DASH_LINES)) {
      expect(lines!.length, beat).toBeGreaterThanOrEqual(2);
      expect(lines!.length, beat).toBeLessThanOrEqual(3);
      for (const l of lines!) expect(l.length, l).toBeLessThanOrEqual(60);
    }
    expect([DASH_CHANCE.power, DASH_CHANCE.ultimate, DASH_CHANCE.ultimateWarn, DASH_CHANCE.flag]).toEqual([1, 1, 1, 1]);
    expect(slapText(BOSS_POWERS.slapBankSeconds * 1000)).toBe("−30s");
  });

  it("his sounds are his own: one for every cue of his and Tick's animations, his select sound, every one used", () => {
    const own = (s: string) => /^dash[A-Z]/.test(s) && DASH_SOUNDS.includes((s[4]!.toLowerCase() + s.slice(5)) as DashSound);
    for (const [name, an] of [...Object.entries(BOSS_BLITZ.anims), ...Object.entries(sidekickBlitz.anims)]) for (const f of an.frames) if (f.cue) expect(kit.sounds[f.cue], `${name}: ${f.cue}`).toBeTruthy();
    for (const s of [...Object.values(kit.sounds), SELECT_SOUND.dash!]) expect(own(s), s).toBe(true);
    expect(SELECT_SOUND.dash).toBe("dashHello");
    const used = new Set<string>([...Object.values(kit.sounds), SELECT_SOUND.dash!]);
    for (const n of DASH_SOUNDS) expect(used.has(`dash${n[0]!.toUpperCase()}${n.slice(1)}`), n).toBe(true);
    for (const [name, k] of Object.entries(BOSS_KITS)) if (name !== "Dash") for (const s of Object.values(k.sounds)) expect(s, name).not.toMatch(/^dash[A-Z]/);
  });

  it("every one of his sounds is quieter than a piece's move (peak and loudness), and the same every time", () => {
    for (const name of DASH_SOUNDS) {
      const s = dashSound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      const db = 10 * Math.log10(sum / s.length);
      expect(db, name).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(db, name).toBeGreaterThan(MOVE_MEAN_DB - 6);
      expect(s, `${name} is the same every time`).toEqual(dashSound(name, 44100));
    }
  });
});
