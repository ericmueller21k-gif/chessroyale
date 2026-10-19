import { describe, expect, it } from "vitest";
import { KING_ATTACK, kingAttackHits } from "@chessroyale/chess";
import { PAINT_CHARCOAL, PAINT_CREAM, SMUDGY, SMUDGY_ATTACK, SMUDGY_PALETTE, smudgyLayers } from "../src/characters/smudgy.ts";
import { BRUSH_STROKE, PAINT_DRIP, PAINT_FLY, PAINT_HIT, PAINT_SPLASH } from "../src/characters/effects/smudgy.ts";
import { frameKeys, renderFrame, type Character } from "../src/characters/sprite.ts";

/**
 * Smudgy's still, his animation pack and his board art (docs/decisions/2026-10-19-smudgy-animations.md). He isn't wired
 * in (not in CHARACTERS, BOSS_KITS or the roster), so the characters test doesn't see him: these are its checks for him
 * and his art, and the cues the board art hangs on.
 */
const sheets = (ch: Character) => Object.entries(ch.anims).flatMap(([name, a]) => a.frames.map((f, i) => ({ name, i, f })));
const atMs = (ch: Character, anim: string, cue: string): number => {
  let t = 0;
  for (const f of ch.anims[anim]!.frames) {
    if (f.cue === cue) return t;
    t += f.ms;
  }
  return -1;
};
const length = (ch: Character, anim: string) => ch.anims[anim]!.frames.reduce((t, f) => t + f.ms, 0);

describe("Smudgy (code-drawn pixel art)", () => {
  for (const ch of [SMUDGY, SMUDGY_ATTACK]) {
    describe(ch.name, () => {
      it("draws every part only with colors in its palette", () => {
        for (const [name, part] of Object.entries(ch.parts)) for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(ch.palette, `${name}: "${k}"`).toHaveProperty(k);
      });
      it("has a looping idle and one-shots that fire cues, and renders every frame with nothing cut off at the frame's edge", () => {
        expect(ch.anims.idle?.loop).toBe(true);
        for (const [name, a] of Object.entries(ch.anims)) if (!a.loop && name !== "defeat") expect(a.frames.some((f) => f.cue), name).toBe(true);
        for (const { name, i, f } of sheets(ch)) {
          expect(renderFrame(ch, f).data.length).toBe(ch.w * ch.h * 4);
          const keys = frameKeys(ch, f);
          const edge = [...keys[0]!, ...keys[ch.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[ch.w - 1])];
          expect(edge.filter(Boolean), `${name} frame ${i + 1}`).toEqual([]);
        }
      });
    });
  }

  it("keeps the approved still as idle's first frame, and the pack's counts and lengths as the other bosses'", () => {
    const A = SMUDGY.anims;
    expect(A.idle!.frames[0]!.layers).toEqual(smudgyLayers());
    const shape = (n: string) => [A[n]!.frames.length, length(SMUDGY, n)];
    expect(shape("idle")).toEqual([16, 2000]);
    expect(shape("entrance")).toEqual([10, 1310]);
    expect(shape("thinking")).toEqual([16, 2080]);
    expect(shape("move")).toEqual([6, 710]);
    expect(shape("capture")).toEqual([12, 1100]);
    expect(shape("hurt")).toEqual([7, 720]);
    expect(shape("check")).toEqual([8, 950]);
    expect(shape("smug")).toEqual([8, 1200]);
    expect(shape("rattled")).toEqual([8, 640]);
    expect(shape("defeat")).toEqual([6, 1550]);
    expect(shape("victory")).toEqual([12, 1320]);
    // His own moments: the splash about as long as Alfil's Tusks cast (1040), Repaint about as long as his Slam (1360).
    expect(length(SMUDGY, "camouflage")).toBe(1040);
    expect(length(SMUDGY, "repaint")).toBeGreaterThanOrEqual(1250);
    expect(length(SMUDGY, "repaint")).toBeLessThanOrEqual(1400);
    for (const n of ["thinking", "smug", "rattled", "victory"]) expect(A[n]!.loop, n).toBe(true);
  });

  it("leaves a cue frame for every bit of board art", () => {
    // The splash leaves the brush before the swing's follow-through; the reveal's drips come off at the snap.
    expect(atMs(SMUDGY, "camouflage", "splash")).toBe(400);
    expect(atMs(SMUDGY, "strike", "drip")).toBe(110);
    // Repaint: two strokes, your color then his, the paint recolored on the frames of each (nothing else of him).
    const r = SMUDGY.anims.repaint!;
    expect(atMs(SMUDGY, "repaint", "stroke1")).toBeLessThan(atMs(SMUDGY, "repaint", "stroke2"));
    expect(r.frames.find((f) => f.cue === "stroke1")!.pal).toEqual(PAINT_CREAM);
    expect(r.frames.find((f) => f.cue === "stroke2")!.pal).toEqual(PAINT_CHARCOAL);
    for (const pal of [PAINT_CREAM, PAINT_CHARCOAL]) expect(Object.keys(pal).sort()).toEqual(["K", "P", "R"]);
    // (The paint keys are the paint's alone, so a frame's recolor changes it and nothing else.)
    for (const [name, part] of Object.entries(SMUDGY.parts)) if (name !== "paintGlob" && name !== "paintSmear") for (const row of part.grid) expect(row, name).not.toMatch(/[PRK]/);
    expect(SMUDGY_PALETTE.R).not.toBe(PAINT_CREAM.R);
  });

  it("attacks a king on the shared beats: a flick on every hit, his face on the king", () => {
    const k = SMUDGY_ATTACK.anims.kingAttack!;
    expect(length(SMUDGY_ATTACK, "kingAttack")).toBe(KING_ATTACK.ms);
    const hits = kingAttackHits();
    let t = 0;
    const cues: [number, string][] = [];
    for (const f of k.frames) {
      if (f.cue) cues.push([t, f.cue]);
      t += f.ms;
    }
    // (He lands 110 ms before the shared landing beat: the 360 ms of the drop-in, as Chub & Chirp's.)
    expect(cues.find(([, c]) => c === "land")![0]).toBe(360);
    const blows = cues.filter(([, c]) => c === "flick" || c === "splat");
    expect(blows.map(([ms]) => ms)).toEqual(hits);
    // (In turn, so the repeats don't pile up.)
    expect(blows.map(([, c]) => c)).toEqual(hits.map((_, i) => (i % 2 ? "splat" : "flick")));
    expect(k.frames.at(-1)!.layers).toEqual([]);
  });
});

describe("Smudgy's board art", () => {
  const art = { PAINT_SPLASH, PAINT_DRIP, BRUSH_STROKE, PAINT_FLY, PAINT_HIT };
  for (const [name, ch] of Object.entries(art))
    it(`${name}: a square, its colors in its palette, one-shots ending empty`, () => {
      expect([ch.w, ch.h]).toEqual([32, 32]);
      for (const [pn, part] of Object.entries(ch.parts)) for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(ch.palette, `${pn}: "${k}"`).toHaveProperty(k);
      for (const [an, a] of Object.entries(ch.anims)) {
        for (const f of a.frames) {
          expect(renderFrame(ch, f).data.length).toBe(32 * 32 * 4);
          for (const [, , k] of f.specks ?? []) expect(ch.palette, `${an}: "${k}"`).toHaveProperty(k);
        }
        // (A splash lands on its held look, which the board keeps up.)
        if (!a.loop && !an.startsWith("land")) expect(frameKeys(ch, a.frames.at(-1)!).flat().filter(Boolean), `${an} ends empty`).toEqual([]);
      }
    });

  it("lands a splash that hides the piece, holds it and fades it; three shapes, a drip and a stroke in either tint", () => {
    for (const v of ["A", "B", "C"]) {
      expect(Object.keys(PAINT_SPLASH.anims)).toEqual(expect.arrayContaining([`land${v}`, `hold${v}`, `fade${v}`]));
      expect(PAINT_SPLASH.anims[`hold${v}`]!.loop).toBe(true);
      // It covers most of the square once it holds (a pawn's silhouette stands inside the middle 20 x 24 of it).
      const keys = frameKeys(PAINT_SPLASH, PAINT_SPLASH.anims[`hold${v}`]!.frames[0]!);
      let covered = 0;
      for (let y = 4; y < 28; y++) for (let x = 6; x < 26; x++) if (keys[y]![x]) covered++;
      expect(covered / (24 * 20), v).toBeGreaterThan(0.93);
    }
    expect(length(PAINT_SPLASH, "landA")).toBeLessThanOrEqual(240);
    expect(PAINT_DRIP.anims.drip!.frames[0]!.cue).toBe("drip");
    expect(Object.keys(BRUSH_STROKE.anims).sort()).toEqual(["strokeC", "strokeN"]);
    expect(Object.keys(PAINT_HIT.anims).sort()).toEqual(["hitHL", "hitHR", "hitLL", "hitLR"]);
  });
});
