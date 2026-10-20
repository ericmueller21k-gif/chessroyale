import { describe, expect, it } from "vitest";
import { KING_ATTACK, kingAttackHits } from "@chessroyale/chess";
import { MOO, MOO_ATTACK, MOO_ICONS, MOO_PALETTE, MOO_POWER_PALETTE, mooIconSprite, mooLayers, type MooIconId } from "../src/characters/moo.ts";
import { FLURRY_BEAMS, FLURRY_STAGGER_MS, MOONBEAM, MOON_HIT } from "../src/characters/effects/moo.ts";
import { frameKeys, renderFrame, type Character } from "../src/characters/sprite.ts";

/**
 * Moo & Moon's stills, animation pack and board art (docs/decisions/2026-10-20-moo-animations.md): the checks for his art and
 * the cues the board art hangs on. He isn't in the game yet, so the characters and kit tests don't see him.
 */
const sheets = (ch: Character) => Object.entries(ch.anims).flatMap(([name, a]) => a.frames.map((f, i) => ({ name, i, f })));
const length = (ch: Character, anim: string) => ch.anims[anim]!.frames.reduce((t, f) => t + f.ms, 0);
const cuesOf = (ch: Character, anim: string): [number, string][] => {
  let t = 0;
  const out: [number, string][] = [];
  for (const f of ch.anims[anim]!.frames) {
    if (f.cue) out.push([t, f.cue]);
    t += f.ms;
  }
  return out;
};
const atMs = (ch: Character, anim: string, cue: string): number => cuesOf(ch, anim).find(([, c]) => c === cue)?.[0] ?? -1;

describe("Moo & Moon (code-drawn pixel art)", () => {
  for (const ch of [MOO, MOO_ATTACK]) {
    describe(ch.name, () => {
      it("draws every part and speck only with colors in its palette", () => {
        for (const [name, part] of Object.entries(ch.parts)) for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(ch.palette, `${name}: "${k}"`).toHaveProperty(k);
        for (const { name, i, f } of sheets(ch)) for (const [, , k] of f.specks ?? []) expect(ch.palette, `${name} ${i}: "${k}"`).toHaveProperty(k);
      });
      it("has a looping idle and one-shots that fire cues, and renders every frame with nothing cut off at the frame's edge", () => {
        expect(ch.anims.idle?.loop).toBe(true);
        for (const [name, a] of Object.entries(ch.anims)) if (!a.loop) expect(a.frames.some((f) => f.cue), name).toBe(true);
        for (const { name, i, f } of sheets(ch)) {
          expect(renderFrame(ch, f).data.length).toBe(ch.w * ch.h * 4);
          const keys = frameKeys(ch, f);
          const edge = [...keys[0]!, ...keys[ch.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[ch.w - 1])];
          expect(edge.filter(Boolean), `${name} frame ${i + 1}`).toEqual([]);
        }
      });
    });
  }

  it("keeps the approved stills: idle's and sit's first frames are the poses, power the powered-up colors", () => {
    expect(MOO.anims.idle!.frames[0]!.layers).toEqual(mooLayers());
    expect(MOO.anims.sit!.frames[0]!.layers).toEqual(mooLayers({}, "sit"));
    expect(MOO.anims.power!.frames[0]!.pal).toEqual(MOO_POWER_PALETTE);
    for (const k of Object.keys(MOO_POWER_PALETTE)) expect(MOO_PALETTE).toHaveProperty(k);
  });

  it("has the pack's counts and lengths as the other bosses', and his own moments about as long as Alfil's", () => {
    const shape = (n: string) => [MOO.anims[n]!.frames.length, length(MOO, n)];
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
    // Moonbeam as long as Alfil's Tusks cast (1040), the transformation about as long as his Slam (1360).
    expect(shape("moonbeam")).toEqual([11, 1040]);
    expect(length(MOO, "fullMoon")).toBeGreaterThanOrEqual(1250);
    expect(length(MOO, "fullMoon")).toBeLessThanOrEqual(1450);
    for (const n of ["idle", "sit", "thinking", "smug", "rattled", "victory", "powerIdle"]) expect(MOO.anims[n]!.loop, n).toBe(true);
  });

  it("leaves a cue frame for every bit of board art", () => {
    // Moonbeam: the beam starts falling from the sky as he lifts his snout.
    expect(atMs(MOO, "moonbeam", "beam")).toBe(350);
    // Full Moon: the colors swap, then the big moo.
    const swap = MOO.anims.fullMoon!.frames.find((f) => f.cue === "swap")!;
    expect(swap.pal).toMatchObject(MOO_POWER_PALETTE);
    expect(atMs(MOO, "fullMoon", "swap")).toBeLessThan(atMs(MOO, "fullMoon", "moo"));
    // The flurry: five beams one after another, FLURRY_STAGGER_MS apart (the board art's stagger), in the powered-up colors.
    const beams = cuesOf(MOO, "flurry").filter(([, c]) => /^beam\d$/.test(c));
    expect(beams.map(([, c]) => c)).toEqual(["beam1", "beam2", "beam3", "beam4", "beam5"]);
    expect(beams.length).toBe(FLURRY_BEAMS);
    expect(beams.slice(1).map(([ms], i) => ms - beams[i]![0])).toEqual(Array(FLURRY_BEAMS - 1).fill(FLURRY_STAGGER_MS));
    for (const f of MOO.anims.flurry!.frames) expect(f.pal).toMatchObject(MOO_POWER_PALETTE);
    // Dazed: the aura fizzles, then the colors swap back (the first frame after `calm` has no powered-up palette).
    const dz = MOO.anims.dazed!.frames;
    const calm = dz.findIndex((f) => f.cue === "calm");
    expect(atMs(MOO, "dazed", "fizz")).toBe(0);
    expect(calm).toBeGreaterThan(0);
    expect(dz[calm]!.pal?.k).not.toBe(MOO_POWER_PALETTE.k);
    expect(dz.slice(calm).every((f) => !f.pal || f.pal.k !== MOO_POWER_PALETTE.k)).toBe(true);
  });

  it("attacks a king on the shared beats: the moon shines a beam on every hit, both of them looking at him", () => {
    const k = MOO_ATTACK.anims.kingAttack!;
    expect(length(MOO_ATTACK, "kingAttack")).toBe(KING_ATTACK.ms);
    const hits = kingAttackHits();
    const cues = cuesOf(MOO_ATTACK, "kingAttack");
    expect(cues.find(([, c]) => c === "land")![0]).toBe(360);
    const blows = cues.filter(([, c]) => c === "beam" || c === "shine");
    expect(blows.map(([ms]) => ms)).toEqual(hits);
    expect(blows.map(([, c]) => c)).toEqual(hits.map((_, i) => (i % 2 ? "shine" : "beam")));
    // Each beat's frame draws the beam as specks, from the moon to the king.
    const lit = k.frames.filter((f) => f.cue === "beam" || f.cue === "shine");
    for (const f of lit) expect((f.specks ?? []).filter(([, , key]) => key === "w").length, "beam core").toBeGreaterThan(40);
    expect(k.frames.at(-1)!.layers).toEqual([]);
  });

  it("makes the moon's glow and the aura parts of their own, behind everything, made for the pose's outline", () => {
    const powered = MOO.anims.power!.frames[0]!.layers;
    expect(powered[0]!.part).toMatch(/^aura/);
    const glowing = mooLayers({ moonGlow: 2 });
    expect(glowing.some((l) => l.part.startsWith("mglow"))).toBe(true);
    expect(mooLayers({ moonGlow: 0 }).some((l) => l.part.startsWith("mglow"))).toBe(false);
  });
});

describe("Moo's icons", () => {
  it("has ten, each about 10 pixels tall, in colors of its own palette, drawn as a one-frame sprite with room for its outline", () => {
    const ids = Object.keys(MOO_ICONS) as MooIconId[];
    expect(ids.sort()).toEqual(["anger", "cowbell", "grass", "heart", "milk", "moon", "pawn", "question", "sparkle", "zzz"]);
    for (const id of ids) {
      const icon = MOO_ICONS[id];
      expect(icon.grid.length, id).toBeGreaterThanOrEqual(9);
      expect(icon.grid.length, id).toBeLessThanOrEqual(10);
      for (const row of icon.grid) for (const k of row) if (k !== ".") expect(icon.palette, `${id}: "${k}"`).toHaveProperty(k);
      const ch = mooIconSprite(id);
      for (const f of ch.anims.idle!.frames) {
        const keys = frameKeys(ch, f);
        const edge = [...keys[0]!, ...keys[ch.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[ch.w - 1])];
        expect(edge.filter(Boolean), id).toEqual([]);
      }
    }
  });
});

describe("Moo's board art", () => {
  for (const [name, ch] of Object.entries({ MOONBEAM, MOON_HIT })) {
    it(`${name}: its colors in its palette, one-shots ending empty`, () => {
      for (const [pn, part] of Object.entries(ch.parts)) for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(ch.palette, `${pn}: "${k}"`).toHaveProperty(k);
      for (const [an, a] of Object.entries(ch.anims)) {
        for (const f of a.frames) {
          expect(renderFrame(ch, f).data.length).toBe(ch.w * ch.h * 4);
          for (const [, , k] of f.specks ?? []) expect(ch.palette, `${an}: "${k}"`).toHaveProperty(k);
        }
        // (A beam's fall ends on its hit's first look and the hit on the hold's, which the board keeps up.)
        if (!a.loop && !["fall", "hit"].includes(an)) expect(frameKeys(ch, a.frames.at(-1)!).flat().filter(Boolean), `${an} ends empty`).toEqual([]);
      }
    });
  }

  it("has a moonbeam column eight squares tall: it falls, hits, holds as the stunned mark and fades", () => {
    expect([MOONBEAM.w, MOONBEAM.h]).toEqual([32, 256]);
    expect(Object.keys(MOONBEAM.anims).sort()).toEqual(["fade", "fall", "hit", "hold"]);
    expect(MOONBEAM.anims.hold!.loop).toBe(true);
    expect(MOONBEAM.anims.fall!.frames[0]!.cue).toBe("beam");
    expect(MOONBEAM.anims.hit!.frames[0]!.cue).toBe("hit");
    expect(length(MOONBEAM, "fall")).toBeLessThanOrEqual(240);
    // The held glow is see-through, so the piece shows: the square's middle (the crescent in its corner aside) has no opaque pixel in it.
    const keys = frameKeys(MOONBEAM, MOONBEAM.anims.hold!.frames[0]!);
    const opaque = (k: string | null | undefined) => !!k && MOONBEAM.palette[k]!.length === 7;
    let solid = 0;
    for (let y = 224 + 6; y < 256 - 6; y++) for (let x = 6; x < 22; x++) if (opaque(keys[y]![x])) solid++;
    expect(solid).toBe(0);
    expect(Object.keys(MOON_HIT.anims).sort()).toEqual(["hitHL", "hitHR", "hitLL", "hitLR"]);
  });
});
