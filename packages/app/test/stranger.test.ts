// The Stranger's art (Nov 27; docs/decisions/2026-11-27-stranger-art.md), drawn ahead of his rules: his figure (and its locked look), his
// kit (ART_KITS until his rules put him in the roster), his square's fire and ice, and his sounds. The same checks characters.test.ts and
// boss-character.test.ts make of every boss, plus his own: swords on his back at rest, drawn before every move, the tips meeting.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ART_KITS, BOSS_KITS } from "../src/characters/kits.ts";
import { EFFECTS } from "../src/characters/power-art.ts";
import { POSES, STRANGER, STRANGER_FOOT, STRANGER_PORTRAIT, STRANGER_SOUNDS, TIPS_AT } from "../src/characters/stranger.ts";
import { STRANGER_SQUARE } from "../src/characters/effects/stranger.ts";
import { STRANGER_LINES } from "../src/characters/stranger-lines.ts";
import { STRANGER_SOUND_NAMES, strangerSound } from "../src/characters/stranger-sounds.ts";
import { frameKeys, renderFrame, type Character } from "../src/characters/sprite.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import type { Beat } from "../src/characters/boss-beats.ts";

const whole = (ch: Character, edges = true) => {
  for (const [name, anim] of Object.entries(ch.anims))
    anim.frames.forEach((f, i) => {
      for (const look of [undefined, ...Object.keys(ch.looks ?? {})]) expect(renderFrame(ch, f, { look }).data.length).toBe(ch.w * ch.h * 4);
      if (!edges) return;
      const keys = frameKeys(ch, f);
      const edge = [...keys[0]!, ...keys[ch.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[ch.w - 1])];
      expect(edge.filter(Boolean), `${ch.id} ${name} frame ${i + 1}`).toEqual([]);
    });
  // (After the frames: his parts are painted the first time a frame shows them.)
  expect(Object.keys(ch.parts).length).toBeGreaterThan(0);
  for (const [name, part] of Object.entries(ch.parts)) for (const row of part.grid) for (const k of row) if (k !== ".") expect(ch.palette, `${name}: "${k}"`).toHaveProperty(k);
};

describe("the Stranger's art", () => {
  it("draws only with his palette, every frame whole in its frame, in every look (his square's art may fill its square)", () => {
    whole(STRANGER);
    whole(STRANGER_SQUARE, false);
  });

  it("loops his rests, cues his one-shots, and stands his boots on the ground point", () => {
    for (const name of ["idle", "think", "smug", "ready", "rattled", "defeatLoop", "victory"]) expect(STRANGER.anims[name]!.loop, name).toBe(true);
    for (const [name, a] of Object.entries(STRANGER.anims)) if (!a.loop) expect(a.frames.some((f) => f.cue), name).toBe(true);
    const keys = frameKeys(STRANGER, STRANGER.anims.idle!.frames[0]!);
    expect(keys[STRANGER_FOOT[1] - 1]!.slice(STRANGER_FOOT[0] - 8, STRANGER_FOOT[0] + 8).some(Boolean)).toBe(true);
  });

  it("keeps his swords on his back at rest and draws them for every move (Eric: 'keeps them put away most of the time')", () => {
    for (const p of [POSES.rest, POSES.flinch, POSES.rattled]) expect([p.swordF, p.swordI]).toEqual(["back", "back"]);
    for (const name of ["strike", "castFull"]) {
      const a = STRANGER.anims[name]!;
      // (Drawn at the start, home again at the end.)
      expect(a.frames.findIndex((f) => f.cue === "draw"), name).toBeLessThan(a.frames.findIndex((f) => f.cue === "slash" || f.cue === "tips"));
      expect(a.frames.at(-2)!.cue ?? a.frames.at(-1)!.cue, name).toBe("sheathe");
    }
    // The twin-tip cast: both blades' tips meet in front of his middle.
    expect(Math.abs(TIPS_AT[0] - STRANGER_FOOT[0])).toBeLessThanOrEqual(1);
    const ice = POSES.aimTips.swordI as { at: readonly [number, number]; deg: number };
    const r = (ice.deg * Math.PI) / 180;
    expect(Math.abs(ice.at[0] + Math.sin(r) * 41 - TIPS_AT[0])).toBeLessThanOrEqual(2);
  });

  it("his locked look is all shadow but his eyes, the crown's jewel and the aura", () => {
    const locked = STRANGER.looks!.locked!;
    for (const k of ["c", "d", "J", "W", "3", "o", "q", "v"]) expect(locked[k], k).toBe("#0b0912");
    for (const k of ["r", "i", "X", "K", "6", "9"]) expect(locked[k], k).toBeUndefined();
  });

  it("is a kit drawn ahead of his boss: every moment animated, a sound for every cue, its portrait inside the frame", () => {
    const kit = ART_KITS.Stranger!;
    expect(BOSS_KITS.Stranger).toBeUndefined();
    expect(kit.ch).toBe(STRANGER);
    const beats: Beat[] = ["entrance", "idle", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory", "strike", "power", "powerHit", "ultimateWarn", "ultimate", "ultimateHit"];
    for (const b of beats) expect(kit.ch.anims[kit.anims[b] ?? b], b).toBeTruthy();
    for (const l of Object.values(kit.loops ?? {})) expect(kit.ch.anims[l!]?.loop, l).toBe(true);
    for (const a of Object.values(STRANGER.anims)) for (const f of a.frames) if (f.cue) expect(kit.sounds[f.cue], f.cue).toBeTruthy();
    for (const a of Object.values(STRANGER_SQUARE.anims)) for (const f of a.frames) if (f.cue) expect(EFFECTS.strangerSquare.sounds[f.cue], f.cue).toBeTruthy();
    const P = STRANGER_PORTRAIT;
    expect(P.x >= 0 && P.y >= 0 && P.x + P.w <= STRANGER.w && P.y + P.h <= STRANGER.h).toBe(true);
    for (const lines of Object.values(STRANGER_LINES)) for (const line of lines ?? []) expect(line.length, line).toBeLessThan(48);
  });

  it("none of his lines is another speaker's (his voice's sound is keyed by a line's words: a shared line changed theirs)", () => {
    const mine = Object.values(STRANGER_LINES).flatMap((l) => [...(l ?? [])]);
    const src = join(import.meta.dirname, "../src");
    const files = (readdirSync(src, { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f) && !f.endsWith("stranger-lines.ts"));
    expect(files.length).toBeGreaterThan(100);
    for (const f of files) {
      const text = readFileSync(join(src, f), "utf8");
      for (const line of mine) for (const q of ['"', "'", "`"]) expect(text.includes(q + line + q), `"${line}" in ${f}`).toBe(false);
    }
  });

  it("his ready blades stay clear of the ground (the ground's cut is for his planted swords only)", () => {
    for (const name of ["draw", "slash", "cast", "ready"])
      for (const f of STRANGER.anims[name]!.frames) {
        const keys = frameKeys(STRANGER, f);
        // (A blade reaching the ground's row would be cut there: none in the row above it.)
        expect(keys.slice(STRANGER_FOOT[1] - 1).flat().filter((k) => k && "pPqQysSvVW".includes(k)), name).toEqual([]);
      }
  });

  it("his sounds are his own, every one used, quieter than a piece's move, and the same every time", () => {
    const own = (n: string) => `stranger${n[0]!.toUpperCase()}${n.slice(1)}`;
    const used = new Set([...Object.values(STRANGER_SOUNDS), "strangerVoice"]);
    for (const n of STRANGER_SOUND_NAMES) expect(used.has(own(n) as never), n).toBe(true);
    for (const s of used) expect(s.startsWith("stranger"), s).toBe(true);
    for (const name of STRANGER_SOUND_NAMES)
      for (const rate of [44100, 48000]) {
        const s = strangerSound(name, rate);
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
        expect(db, name).toBeGreaterThan(MOVE_MEAN_DB - 9);
        expect(s.length / rate, name).toBeLessThan(1.3);
      }
    expect(strangerSound("slash", 44100)).toEqual(strangerSound("slash", 44100));
  });
});
