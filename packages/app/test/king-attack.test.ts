import { afterEach, describe, expect, it } from "vitest";
import { BOSS_ROSTER } from "@chessroyale/core";
import { KING_ATTACK, KING_ATTACKERS, LAST_STAND, kingAttackHits, lastStandAttackHits } from "@chessroyale/chess";
import { BOSS_KITS, bossKit } from "../src/characters/kits.ts";
import { HOLLOW, HOLLOW_ATTACK, HOLLOW_LINES } from "../src/characters/hollow.ts";
import { ALFIL_LINES } from "../src/characters/alfil.ts";
import { GOD_KING } from "../src/characters/god-king.ts";
import { EFFECTS, animLength, bonkItem, carrotItem, frostItem, lashItem, lassoItem, moonItem, paintItem, pieItem, popItem, sawItem, waterItem } from "../src/characters/power-art.ts";
import { CLOWN_LINES } from "../src/characters/clown.ts";
import { SAWYER_LINES } from "../src/characters/sawyer.ts";
import { PIG_LINES } from "../src/characters/pig.ts";
import { clownSound, type ClownSound } from "../src/characters/clown-sounds.ts";
import { sawyerSound, type SawyerSound } from "../src/characters/sawyer-sounds.ts";
import { pigSound, type PigSound } from "../src/characters/pig-sounds.ts";
import { BIGBOY_LINES } from "../src/characters/bigboy.ts";
import { GINGER_LINES } from "../src/characters/gingerbread.ts";
import { GREX_LINES } from "../src/characters/grex.ts";
import { bigBoySound, type BigBoySound } from "../src/characters/bigboy-sounds.ts";
import { gingerSound, type GingerSound } from "../src/characters/gingerbread-sounds.ts";
import { grexSound, type GrexSound } from "../src/characters/grex-sounds.ts";
import { HOPPER_LINES } from "../src/characters/hopper.ts";
import { hopperSound, type HopperSound } from "../src/characters/hopper-sounds.ts";
import { SMUDGY_LINES } from "../src/characters/smudgy.ts";
import { MOO_LINES } from "../src/characters/moo.ts";
import { GARDENER_LINES } from "../src/characters/gardener-lines.ts";
import { gardenerSound, type GardenerSound } from "../src/characters/gardener-sounds.ts";
import { mooSound, type MooSound } from "../src/characters/moo-sounds.ts";
import { smudgySound, type SmudgySound } from "../src/characters/smudgy-sounds.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import type { KingAttackKit } from "../src/characters/kits.ts";
import { frameKeys, renderFrame, type Anim } from "../src/characters/sprite.ts";
import { ATTACK_ROOM_ABOVE, KING_MIDDLE, attackTop, kingAttackBeat, kingAttackPlace } from "../src/components/KingAttack.tsx";
import { evalBarOn } from "../src/prefs.ts";

// A boss's attack on a king (Eric, Oct 10: Hollow first): the kit's `kingAttack`, his frames on the shared beats, the
// God King's blows on its lashes in his Last Stand, and the hits on the king's square.

/** When each frame starts, ms from the animation's start. */
const starts = (a: Anim) => {
  let t = 0;
  return a.frames.map((f) => {
    const s = t;
    t += f.ms;
    return s;
  });
};

describe("the kit's kingAttack", () => {
  it("is every playable boss's but the Hidden Boss's, and the server's list (KING_ATTACKERS) says the same", () => {
    const withAttack = Object.entries(BOSS_KITS)
      .filter(([, k]) => k.kingAttack)
      .map(([name]) => BOSS_ROSTER.find((b) => b.kit === name)!.id);
    expect(withAttack).toEqual([...KING_ATTACKERS]);
    expect(withAttack).toEqual(["clown", "gingerbread", "grex", "hollow", "bigboy", "sawyer", "pig", "alfil", "hopper", "smudgy", "moo", "gardener", "tiger", "folio"]);
  });

  it("Alfil's: a `jab` cue on each of the shared hits, lasting the attack exactly, his ankus's tip in the king's square, a gold jab on it each hit", () => {
    const ka = bossKit("Alfil")!.kingAttack!;
    const a = ka.ch.anims[ka.anim]!;
    expect(a.loop).toBe(false);
    expect(animLength(a)).toBe(KING_ATTACK.ms);
    const s = starts(a);
    expect(a.frames.flatMap((f, i) => (f.cue === "jab" ? [s[i]] : []))).toEqual(kingAttackHits());
    expect(bossKit("Alfil")!.sounds.jab).toBe("alfilJab");
    const ch = ka.ch;
    for (const f of a.frames.filter((fr) => fr.cue === "jab")) {
      const img = renderFrame(ch, f);
      let right = 0;
      for (let y = 0; y < ch.h; y++) for (let x = 0; x < ch.w; x++) if (img.data[(y * ch.w + x) * 4 + 3]! > 0) right = Math.max(right, x);
      const reach = (right - ch.foot[0]) / ka.perSquare;
      expect(reach).toBeGreaterThan(ka.stand);
      expect(reach).toBeLessThan(ka.stand + 0.5);
    }
    // Each hit: a jab high then low, from his side, on the king's square (ankusHit, about 200 ms).
    const hits = [0, 1].map((i) => ka.hit("e1", i, "L", 1000));
    expect(hits.map((h) => [h.name, h.anim, h.square])).toEqual([["ankusHit", "hitHL", "e1"], ["ankusHit", "hitLL", "e1"]]);
    expect(ka.hit("e1", 0, "R", 0).anim).toBe("hitHR");
    expect(animLength(EFFECTS.ankusHit.ch.anims.hitHL!)).toBeLessThanOrEqual(KING_ATTACK.lashEveryMs + 50);
    expect(ALFIL_LINES.kingAttack?.length).toBeGreaterThan(0);
    expect(bossKit("Alfil")!.chance.kingAttack).toBe(1);
  });

  it("names an animation that lands a `lash` cue on each of the shared hits, and lasts the attack exactly", () => {
    const ka = bossKit("Hollow")!.kingAttack!;
    const a = ka.ch.anims[ka.anim]!;
    expect(a.loop).toBe(false);
    expect(animLength(a)).toBe(KING_ATTACK.ms);
    const s = starts(a);
    const lashes = a.frames.flatMap((f, i) => (f.cue === "lash" ? [s[i]] : []));
    expect(lashes).toEqual(kingAttackHits());
    // He lands at landAt (a cue for it), and is gone at the end.
    expect(s[a.frames.findIndex((f) => f.cue === "land")]).toBe(KING_ATTACK.landAt - 110);
    expect(a.frames.at(-1)!.layers).toEqual([]);
    expect(bossKit("Hollow")!.sounds.lash).toBe("hollowLash");
  });

  it("is drawn from Hollow's own parts and palette, in a frame wider on the right, nothing cut off at its edge", () => {
    expect(HOLLOW_ATTACK.parts).toBe(HOLLOW.parts);
    expect(HOLLOW_ATTACK.palette).toBe(HOLLOW.palette);
    expect(HOLLOW_ATTACK.foot).toEqual(HOLLOW.foot);
    expect(HOLLOW_ATTACK.w).toBeGreaterThan(HOLLOW.w);
    HOLLOW_ATTACK.anims.kingAttack!.frames.forEach((f, i) => {
      expect(renderFrame(HOLLOW_ATTACK, f).data.length).toBe(HOLLOW_ATTACK.w * HOLLOW_ATTACK.h * 4);
      const keys = frameKeys(HOLLOW_ATTACK, f);
      const edge = [...keys[0]!, ...keys[HOLLOW_ATTACK.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[HOLLOW_ATTACK.w - 1])];
      expect(edge.filter(Boolean), `kingAttack frame ${i + 1}`).toEqual([]);
    });
  });

  it("reaches the king: the strand's tip at a crack lands in the king's square, a square and a half off", () => {
    const ka = bossKit("Hollow")!.kingAttack!;
    const a = ka.ch.anims[ka.anim]!;
    const ch = ka.ch;
    for (const i of [0, 1]) {
      const f = a.frames.filter((fr) => fr.cue === "lash")[i]!;
      const img = renderFrame(ch, f);
      let right = 0;
      for (let y = 0; y < ch.h; y++) for (let x = 0; x < ch.w; x++) if (img.data[(y * ch.w + x) * 4 + 3]! > 0) right = Math.max(right, x);
      // In squares from his feet: past the near edge of the king's square and short of its far edge.
      const reach = (right - ch.foot[0]) / ka.perSquare;
      expect(reach, `crack ${i}`).toBeGreaterThan(ka.stand);
      expect(reach, `crack ${i}`).toBeLessThan(ka.stand + 0.5);
    }
  });

  it("has his line for it, said every time", () => {
    expect(HOLLOW_LINES.kingAttack?.length).toBeGreaterThan(0);
    expect(bossKit("Hollow")!.chance.kingAttack).toBe(1);
  });

  it("hits the king's square back and forth: a forehand then a backhand, from his side, in the bulbs' colors", () => {
    expect(lashItem("e1", 0, "L", 5)).toEqual({ square: "e1", name: "lashHit", anim: "hitFL0", since: 5 });
    expect(lashItem("a3", 1, "R", 5).anim).toBe("hitBR1");
    expect(lashItem("a3", 5, "R", 5).anim).toBe("hitBR2");
    for (let i = 0; i < KING_ATTACK.lashes; i++)
      for (const side of ["L", "R"] as const) {
        const a = EFFECTS.lashHit.ch.anims[lashItem("e1", i, side, 0).anim!]!;
        expect(a.loop).toBe(false);
        expect(animLength(a)).toBeLessThanOrEqual(220);
        expect(a.frames.at(-1)!.specks ?? []).toEqual([]);
      }
  });
});

/**
 * Sawyer's, Wrangler's and Boingo's (Eric, Oct 18: "a relentless assault", a hit on every beat): for each, its kit,
 * the cues its hits fall on and the sounds they play, which part of the drawing reaches the king's square, its hit on
 * the square and its lines.
 */
const ASSAULTS: {
  kit: string;
  item: KingAttackKit["hit"];
  effect: "sawHit" | "lassoHit" | "pieHit" | "bonkHit" | "frostHit" | "popHit" | "carrotHit" | "paintHit" | "moonHit" | "waterHit";
  anims: [string, string];
  /** The cues on its hits, in turn, and their sounds. */
  cues: [string, string];
  sounds: [string, string];
  /** The palette keys of its prop (and what flies off it): only these may be in the king's square's middle. */
  prop: string;
  lines: readonly string[] | undefined;
  wave: (name: string) => Float32Array;
}[] = [
  { kit: "Sawyer", item: sawItem, effect: "sawHit", anims: ["hitA", "hitB"], cues: ["cut", "swing"], sounds: ["sawyerCut", "sawyerSwing"], prop: "RrQBCDSsTUV", lines: SAWYER_LINES.kingAttack, wave: (n) => sawyerSound(n.replace(/^sawyer/, "").replace(/^./, (c) => c.toLowerCase()) as SawyerSound, 44100) },
  { kit: "Wrangler", item: lassoItem, effect: "lassoHit", anims: ["hitH", "hitL"], cues: ["crack", "lash"], sounds: ["pigYank", "pigCatch"], prop: "rRt", lines: PIG_LINES.kingAttack, wave: (n) => pigSound(n.replace(/^pig/, "").replace(/^./, (c) => c.toLowerCase()) as PigSound, 44100) },
  { kit: "Big Boy", item: bonkItem, effect: "bonkHit", anims: ["hitH", "hitL"], cues: ["bonk", "swing"], sounds: ["bigboyBonk", "bigboySwish"], prop: "123456vVF", lines: BIGBOY_LINES.kingAttack, wave: (n) => bigBoySound({ bigboyBonk: "bonk", bigboySwish: "swish" }[n] as BigBoySound, 44100) },
  { kit: "Ginger", item: frostItem, effect: "frostHit", anims: ["hitH", "hitL"], cues: ["crackle", "crunch"], sounds: ["gingerCrackle", "gingerCrunch"], prop: "sSvViIJfF", lines: GINGER_LINES.kingAttack, wave: (n) => gingerSound(n.replace(/^ginger/, "").replace(/^./, (c) => c.toLowerCase()) as GingerSound, 44100) },
  { kit: "Jefferson", item: popItem, effect: "popHit", anims: ["hitH", "hitL"], cues: ["pop", "sparkle"], sounds: ["grexPop", "grexSparkle"], prop: "qmtUvVwWBxyYfFR", lines: GREX_LINES.kingAttack, wave: (n) => grexSound(n.replace(/^grex/, "").replace(/^./, (c) => c.toLowerCase()) as GrexSound, 44100) },
  { kit: "Chub & Chirp", item: carrotItem, effect: "carrotHit", anims: ["hitH", "hitL"], cues: ["toss", "bonk"], sounds: ["hopperToss", "hopperBonk"], prop: "RKJPwbcd" /* (the carrot, its leaves in the grasshopper's greens, its speed lines) */, lines: HOPPER_LINES.kingAttack, wave: (n) => hopperSound(n.replace(/^hopper/, "").replace(/^./, (c) => c.toLowerCase()) as HopperSound, 44100) },
  { kit: "Smudgy", item: paintItem, effect: "paintHit", anims: ["hitH", "hitL"], cues: ["flick", "splat"], sounds: ["smudgySwish", "smudgySplash"], prop: "LMNQfgijUVWPRK12345678" /* (the brush: its handle, ferrule and bristles, the yellow paint on it and the flecks flying off) */, lines: SMUDGY_LINES.kingAttack, wave: (n) => smudgySound(n.replace(/^smudgy/, "").replace(/^./, (c) => c.toLowerCase()) as SmudgySound, 44100) },
  { kit: "Moo", item: moonItem, effect: "moonHit", anims: ["hitH", "hitL"], cues: ["beam", "shine"], sounds: ["mooBeam", "mooZap"], prop: "wKL" /* (the moon's small beam: its white core, pale shaft and rim) */, lines: MOO_LINES.kingAttack, wave: (n) => mooSound({ mooBeam: "beam", mooZap: "zap" }[n] as MooSound, 44100) },
  { kit: "Gardener", item: waterItem, effect: "waterHit", anims: ["hitH", "hitL"], cues: ["jet", "spurt"], sounds: ["gardenerJet", "gardenerSpurt"], prop: "JKLMk1234" /* (the brass nozzle, the water and the drops thrown off it) */, lines: GARDENER_LINES.kingAttack, wave: (n) => gardenerSound(n.replace(/^gardener/, "").replace(/^./, (c) => c.toLowerCase()) as GardenerSound, 44100) },
  { kit: "Boingo the Clown", item: pieItem, effect: "pieHit", anims: ["hitH", "hitL"], cues: ["splat", "squeak"], sounds: ["clownSplat", "clownSqueak"], prop: "wWXoOrSsE", lines: CLOWN_LINES.kingAttack, wave: (n) => clownSound(n.replace(/^clown/, "").replace(/^./, (c) => c.toLowerCase()) as ClownSound, 44100) },
];

/** How far the drawing reaches toward the king (squares from his feet), over the pixels whose key passes `keep`. */
function reach(ka: KingAttackKit, f: Anim["frames"][number], keep: (k: string) => boolean = () => true): number {
  const keys = frameKeys(ka.ch, f);
  let most = -Infinity;
  keys.forEach((row, y) =>
    row.forEach((k, x) => {
      if (!k || !keep(k) || y >= ka.ch.foot[1] + 1) return;
      most = Math.max(most, (ka.facesLeft ? ka.ch.foot[0] - x : x - ka.ch.foot[0]) / ka.perSquare);
    }),
  );
  return most;
}

describe("the relentless assaults: Sawyer saws, Wrangler cracks his lasso, Boingo pies, Big Boy bonks, Ginger jabs, Jefferson fires, Chub pelts carrots, Smudgy flicks paint (Eric, Oct 18-19)", () => {
  for (const a of ASSAULTS)
    describe(a.kit, () => {
      const kit = bossKit(a.kit)!;
      const ka = kit.kingAttack!;
      const anim = ka.ch.anims[ka.anim]!;

      it("lands a hit on each of the shared hits, its cues in turn, lasting the attack exactly, gone at the end", () => {
        expect(anim.loop).toBe(false);
        expect(animLength(anim)).toBe(KING_ATTACK.ms);
        const s = starts(anim);
        const hits = anim.frames.flatMap((f, i) => (f.cue && a.cues.includes(f.cue) && s[i]! >= KING_ATTACK.lashAt ? [[s[i], f.cue]] : []));
        expect(hits.map(([t]) => t)).toEqual(kingAttackHits());
        expect(hits.map(([, c]) => c)).toEqual(kingAttackHits().map((_, i) => a.cues[i % 2]));
        expect(anim.frames[0]!.layers).toEqual([]);
        expect(anim.frames.at(-1)!.layers).toEqual([]);
      });

      it("plays his own sounds on its hits, never the same twice running, and all ten together stay under a move", () => {
        expect(a.cues.map((c) => kit.sounds[c])).toEqual(a.sounds);
        expect(a.sounds[0]).not.toBe(a.sounds[1]);
        // Every cue in it has one of his sounds.
        for (const f of anim.frames) if (f.cue) expect(kit.sounds[f.cue], f.cue).toBeTruthy();
        const rate = 44100;
        const hits = kingAttackHits();
        const mix = new Float32Array(Math.ceil(((hits.at(-1)! - hits[0]! + 1000) / 1000) * rate));
        hits.forEach((t, i) => {
          const w = a.wave(a.sounds[i % 2]!);
          const at = Math.round(((t - hits[0]!) / 1000) * rate);
          for (let j = 0; j < w.length && at + j < mix.length; j++) mix[at + j]! += w[j]!;
        });
        let peak = 0;
        let sum = 0;
        const span = Math.round(((hits.at(-1)! - hits[0]!) / 1000) * rate);
        for (let j = 0; j < span; j++) {
          peak = Math.max(peak, Math.abs(mix[j]!));
          sum += mix[j]! * mix[j]!;
        }
        expect(peak).toBeLessThan(MOVE_PEAK);
        expect(10 * Math.log10(sum / span)).toBeLessThan(MOVE_MEAN_DB);
      });

      /** Its frames that land the hits. */
      const hitFrames = () => {
        const s = starts(anim);
        return anim.frames.filter((f, i) => f.cue && a.cues.includes(f.cue) && s[i]! >= KING_ATTACK.lashAt);
      };

      it("reaches past the middle of the king's square on each hit, his body clear of it (only his prop gets there)", () => {
        for (const f of hitFrames()) {
          const r = reach(ka, f);
          expect(r).toBeGreaterThan(ka.stand);
          expect(r).toBeLessThan(ka.stand + 0.5);
          // Nothing but the prop (and what flies off it) in the middle of the king's square, where the king is drawn.
          expect(reach(ka, f, (k) => !a.prop.includes(k) && k !== "k" && k !== "@")).toBeLessThanOrEqual(ka.stand - 0.35);
        }
      });

      it("draws in its palette, nothing cut off at its frame's edge, standing on its feet", () => {
        const ch = ka.ch;
        for (const [name, part] of Object.entries(ch.parts)) for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(ch.palette, `${name}: "${k}"`).toHaveProperty(k);
        anim.frames.forEach((f, i) => {
          for (const fr of [f]) for (const [, , k] of fr.specks ?? []) expect(ch.palette, `frame ${i + 1}: speck "${k}"`).toHaveProperty(k);
          expect(renderFrame(ch, f).data.length).toBe(ch.w * ch.h * 4);
          const keys = frameKeys(ch, f);
          const edge = [...keys[0]!, ...keys[ch.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[ch.w - 1])];
          expect(edge.filter(Boolean), `kingAttack frame ${i + 1}`).toEqual([]);
        });
        const first = hitFrames()[0]!;
        const [fx, fy] = ch.foot;
        expect(frameKeys(ch, first)[fy - 1]!.slice(fx - 10, fx + 10).some(Boolean)).toBe(true);
      });

      it("hits the king's square from his side, in turn, each about 200 ms and ending empty", () => {
        expect(ka.hit("e1", 0, "L", 7)).toEqual({ square: "e1", name: a.effect, anim: `${a.anims[0]}L`, since: 7 });
        expect(ka.hit("a3", 1, "R", 7).anim).toBe(`${a.anims[1]}R`);
        for (let i = 0; i < KING_ATTACK.lashes; i++)
          for (const side of ["L", "R"] as const) {
            const fx = EFFECTS[a.effect].ch.anims[ka.hit("e1", i, side, 0).anim!]!;
            expect(fx.loop).toBe(false);
            expect(animLength(fx)).toBeLessThanOrEqual(KING_ATTACK.lashEveryMs + 50);
            expect(fx.frames.at(-1)!.specks ?? []).toEqual([]);
            for (const fr of fx.frames) for (const [x, y, k] of fr.specks ?? []) {
              expect(EFFECTS[a.effect].ch.palette).toHaveProperty(k);
              expect(x >= 0 && y >= 0 && x < 32 && y < 32).toBe(true);
            }
          }
      });

      it("has his lines for it, said every time", () => {
        expect(a.lines?.length).toBeGreaterThan(0);
        expect(kit.chance.kingAttack).toBe(1);
      });
    });
});

/**
 * Where each attacker looks (Eric, Oct 18: Wrangler "looks like he's hitting him without looking"): in every hit frame,
 * the features of his face (the keys below, in his head part as drawn: flipped if its layer is) against the middle of
 * the whole head. A head turned to one side (Sawyer, Wrangler, Jefferson) or eyes glancing (Big Boy, Ginger) must point
 * the way his prop goes, toward the king (`facesLeft`: our left), by most of a pixel; a face drawn front on (Boingo,
 * Hollow, Alfil, as all their art) must be front on, so it can't be turned away either. Then, on the board, for a king
 * on every file: his drawing is mirrored exactly when that keeps his face and his prop toward the king.
 */
const FACES: Record<string, { keys: string; front?: boolean; head?: string; gaze?: true }> = {
  "Boingo the Clown": { keys: "eE", front: true },
  Ginger: { keys: "e" },
  Jefferson: { keys: "u" },
  Hollow: { keys: "eE", front: true },
  "Big Boy": { keys: "e" },
  Sawyer: { keys: "wx" },
  Wrangler: { keys: "we" },
  Alfil: { keys: "wx", front: true },
  // (Chub's eye, in his own head: the rabbit's, not Chirp's.)
  "Chub & Chirp": { keys: "xw", head: "rabbitHead" },
  // (Smudgy's eyes are layers of their own, each posed by where its pupil looks: toward the king, forward and down.)
  Smudgy: { keys: "", gaze: true },
  // (Moo's eyes are layers of their own too, each posed by where its pupil looks: toward the king, level.)
  Moo: { keys: "", gaze: true },
  // (Puddles' eyes are layers of their own, but his face is turned in three quarters: his nostrils, in his muzzle's end, are toward the king.)
  Gardener: { keys: "y" },
  // (Babur's face is turned toward the king as he bats each balloon: his amber eyes and his nose.)
  Tiger: { keys: "yYn" },
  // (Folio's head is a paper crane's in profile, its beak toward the king: its eye sits at the middle of its head, so it reads as
  // front on, never turned away.)
  Folio: { keys: "x", front: true },
};
/** Where his eyes look in a frame (the mean of his two pupils' x, in eye pixels; - toward our left), from the eye layers' own poses. */
function gazeTurn(f: Anim["frames"][number]): number {
  const gaze = f.layers.flatMap((l) => {
    // (Smudgy's `eyeN:-1,0`; Moo's `eyeNopen-1,0`, the look of the eye then the pupil's x and y.)
    const m = /^eye[NF](?::|(?:open|half|shut|glow|joy))(-?[\d.]+),/.exec(l.part);
    return m ? [Number(m[1])] : [];
  });
  expect(gaze, "both eyes").toHaveLength(2);
  return gaze.reduce((a, b) => a + b, 0) / gaze.length;
}
/** His face's features' middle less his head's middle (head pixels; + to our right) in a frame. */
function faceTurn(ka: KingAttackKit, f: Anim["frames"][number], keys: string, head = "head"): number {
  const layer = f.layers.find((l) => l.part.startsWith(head));
  expect(layer, "a head").toBeTruthy();
  let grid = ka.ch.parts[layer!.part]!.grid.map((r) => [...r]);
  if (layer!.flipX) grid = grid.map((r) => r.reverse());
  let all = 0, n = 0, feat = 0, m = 0;
  grid.forEach((row) =>
    row.forEach((k, x) => {
      if (k === "." || k === " ") return;
      all += x;
      n++;
      if (keys.includes(k)) {
        feat += x;
        m++;
      }
    }),
  );
  expect(m).toBeGreaterThan(0);
  return feat / m - all / n;
}

describe("each attacker looks at the king he hits (Eric, Oct 18)", () => {
  for (const [name, kit] of Object.entries(BOSS_KITS)) {
    const ka = kit.kingAttack;
    if (!ka) continue;
    it(`${name}: his face toward the king in every hit, on either side of the board`, () => {
      const face = FACES[name]!;
      const anim = ka.ch.anims[ka.anim]!;
      const s = starts(anim);
      const hits = anim.frames.filter((_, i) => kingAttackHits().includes(s[i]!));
      expect(hits).toHaveLength(KING_ATTACK.lashes);
      const toward = ka.facesLeft ? -1 : 1;
      for (const f of hits) {
        const d = face.gaze ? gazeTurn(f) : faceTurn(ka, f, face.keys, face.head);
        if (face.front) expect(Math.abs(d), `${name} front on`).toBeLessThan(0.75);
        else expect(d * toward, `${name} turned toward the king`).toBeGreaterThanOrEqual(0.75);
      }
      for (let col = 0; col < 8; col++) {
        const p = kingAttackPlace(ka, col, 4);
        // On screen: his drawing's way, mirrored or not, is the way to the king from where he stands.
        expect(toward * (p.mirrored ? -1 : 1)).toBe(p.left ? 1 : -1);
        expect(p.from).toBe(p.left ? "L" : "R");
      }
    });
  }
});

/**
 * Where an attack goes for a king on any square (Eric, Oct 18: "nothing gets smushed on a phone"), either way up: on
 * the side toward the board's middle, his prop on the king, his feet on the king's row, never rising more than
 * ATTACK_ROOM_ABOVE over the board's top (a phone's boss bar is above it), drawn smaller only near the top, and then
 * shrunk toward the edge of the king's middle (KING_MIDDLE): his body, outside it at full size (the test above), stays
 * outside it, and his prop still reaches the king (within a fifth of a square of his middle, or past it).
 */
describe("an attack's place on the board, at every square", () => {
  for (const [name, kit] of Object.entries(BOSS_KITS)) {
    const ka = kit.kingAttack;
    if (!ka) continue;
    it(`${name}: on the board at all 64 squares, both ways up`, () => {
      const rise = (ka.ch.foot[1] - attackTop(ka)) / ka.perSquare;
      // His prop's reach past the king's middle (squares, at full size), from the reach test above.
      const anim = ka.ch.anims[ka.anim]!;
      const s = starts(anim);
      const hitFrame = anim.frames.find((_, i) => s[i] === KING_ATTACK.lashAt)!;
      const past = reach(ka, hitFrame) - ka.stand;
      expect(past).toBeGreaterThan(0);
      for (const orientation of ["white", "black"] as const)
        for (let f = 0; f < 8; f++)
          for (let r = 0; r < 8; r++) {
            const col = orientation === "white" ? f : 7 - f;
            const row = orientation === "white" ? 7 - r : r;
            const p = kingAttackPlace(ka, col, row);
            const at = `${"abcdefgh"[f]}${r + 1} ${orientation}`;
            expect(p.left, at).toBe(col >= 4);
            // Never more than the room above the board, landed (his drop-in and leap above it are clipped).
            const top = row + 0.96 - rise * p.scale;
            expect(top, at).toBeGreaterThanOrEqual(-ATTACK_ROOM_ABOVE - 1e-9);
            expect(p.clipTop, at).toBeGreaterThanOrEqual(0);
            expect(p.box.y + p.box.h * p.clipTop, at).toBeGreaterThanOrEqual(-ATTACK_ROOM_ABOVE - 1e-9);
            // Full size from the third row from the top down (a phone's bar is above the top two); never below half.
            if (row >= 2) expect(p.scale, at).toBe(1);
            expect(p.scale, at).toBeGreaterThanOrEqual(0.5);
            // Shrunk toward the edge of the king's middle: his feet on its row, his prop still on the king.
            const footX = p.box.x + p.box.w * (p.mirrored ? 1 - ka.ch.foot[0] / ka.ch.w : ka.ch.foot[0] / ka.ch.w);
            const footY = p.box.y + p.box.h * (ka.ch.foot[1] / ka.ch.h);
            expect(footY, at).toBeCloseTo(row + 0.96, 6);
            expect(Math.abs(footX - (col + 0.5)), at).toBeCloseTo(KING_MIDDLE + (ka.stand - KING_MIDDLE) * p.scale, 6);
            expect((past + KING_MIDDLE) * p.scale - KING_MIDDLE, at).toBeGreaterThan(-0.2);
            // Within the board's width, give or take half a square at its sides.
            expect(p.box.x, at).toBeGreaterThanOrEqual(-0.5);
            expect(p.box.x + p.box.w, at).toBeLessThanOrEqual(8.5);
          }
    });
  }
});

describe("the God King's Last Stand against a boss's attack", () => {
  it("lands his blows on its lashes (a jolt each), as long as his usual Last Stand", () => {
    const usual = GOD_KING.anims.lastStand!;
    const attacked = GOD_KING.anims.lastStandAttacked!;
    expect(animLength(attacked)).toBe(animLength(usual));
    const s = starts(attacked).map((t) => t + LAST_STAND.fallAt);
    const jolts = attacked.frames.flatMap((f, i) => (f.shake && s[i]! >= LAST_STAND.slideAt && s[i]! < LAST_STAND.staggerAt ? [s[i]] : []));
    expect(jolts).toEqual(lastStandAttackHits());
  });
});

describe("the attack on a king's moments (kingAttackBeat)", () => {
  it("counts the lashes, flashes on each, darkens, then topples and fades at the end", () => {
    expect(kingAttackBeat(0)).toMatchObject({ hit: -1, lit: false, dim: 0, topple: 0, gone: 0 });
    const hits = kingAttackHits();
    expect(kingAttackBeat(hits[0]!)).toMatchObject({ hit: 0, lit: true });
    expect(kingAttackBeat(hits[0]! + 100)).toMatchObject({ hit: 0, lit: false });
    expect(kingAttackBeat(hits[9]! + 10)).toMatchObject({ hit: 9, dim: 1, topple: 0 });
    expect(kingAttackBeat(KING_ATTACK.ms).topple).toBe(1);
    expect(kingAttackBeat(KING_ATTACK.ms + 400).gone).toBe(1);
  });
});

describe("the eval bar is off for everyone (prefs.ts)", () => {
  const store = new Map<string, string>();
  const g = globalThis as { localStorage?: unknown };
  afterEach(() => {
    store.clear();
    delete g.localStorage;
  });

  it("is off whatever a device stored: a stored choice of on is ignored, and nothing is written", () => {
    g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(evalBarOn()).toBe(false);
    store.set("brc.evalBar", "1");
    expect(evalBarOn()).toBe(false);
    expect(store.get("brc.evalBar")).toBe("1");
  });

  it("is off where the device keeps nothing too (private window, blocked storage)", () => {
    g.localStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(evalBarOn()).toBe(false);
  });
});
