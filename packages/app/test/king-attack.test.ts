import { afterEach, describe, expect, it } from "vitest";
import { BOSS_ROSTER } from "@chessroyale/core";
import { KING_ATTACK, KING_ATTACKERS, LAST_STAND, kingAttackHits, lastStandAttackHits } from "@chessroyale/chess";
import { BOSS_KITS, bossKit } from "../src/characters/kits.ts";
import { HOLLOW, HOLLOW_ATTACK, HOLLOW_LINES } from "../src/characters/hollow.ts";
import { GOD_KING } from "../src/characters/god-king.ts";
import { EFFECTS, animLength, lashItem } from "../src/characters/power-art.ts";
import { frameKeys, renderFrame, type Anim } from "../src/characters/sprite.ts";
import { kingAttackBeat } from "../src/components/KingAttack.tsx";
import { evalBarOn, onPrefsChange, setEvalBarOn } from "../src/prefs.ts";

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
  it("is Hollow's only, and the server's list (KING_ATTACKERS) says the same", () => {
    const withAttack = Object.entries(BOSS_KITS)
      .filter(([, k]) => k.kingAttack)
      .map(([name]) => BOSS_ROSTER.find((b) => b.kit === name)!.id);
    expect(withAttack).toEqual([...KING_ATTACKERS]);
    expect(withAttack).toEqual(["hollow"]);
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

  it("hits the king's square back and forth: a forehand then a backhand, from his side, in the bulbs' colours", () => {
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

describe("the eval bar's setting (prefs.ts)", () => {
  const store = new Map<string, string>();
  const g = globalThis as { localStorage?: unknown };
  afterEach(() => {
    store.clear();
    delete g.localStorage;
  });

  it("is on by default, off when switched off, remembered, and tells the screens", () => {
    g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(evalBarOn()).toBe(true);
    let told = 0;
    const off = onPrefsChange(() => told++);
    setEvalBarOn(false);
    expect(evalBarOn()).toBe(false);
    expect(store.get("brc.evalBar")).toBe("0");
    setEvalBarOn(true);
    expect(evalBarOn()).toBe(true);
    expect(told).toBe(2);
    off();
  });

  it("stays on when the device keeps nothing (private window, blocked storage)", () => {
    g.localStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(evalBarOn()).toBe(true);
    expect(() => setEvalBarOn(false)).not.toThrow();
  });
});
