import { describe, expect, it } from "vitest";
import { KING_COMMAND, KING_SUMMON, LAST_STAND, kingMoveMs, kingStrikeMs } from "@chessroyale/chess";
import { DEFAULT_SETTINGS } from "@chessroyale/core";
import { GOD_KING, GOD_KING_BLACK, GOD_KING_BOX, KING_TIP, commandMoment, cueLead, kingAnimMs, kingFrameAt, summonMoment } from "../src/characters/god-king.ts";
import { frameKeys, lieDown, renderFrame, type Character } from "../src/characters/sprite.ts";

const frameOf = (anim: keyof typeof GOD_KING.anims, now: number, since = 0, then?: keyof typeof GOD_KING.anims) => {
  const s = kingFrameAt(anim, now, since, then);
  return GOD_KING.anims[s.anim]!.frames[s.frame]!;
};

describe("the God King's pixel sprite", () => {
  it("recolours only his armour for Black: gold, eyes, cape, cloth and flame stay the same", () => {
    expect(Object.keys(GOD_KING_BLACK).sort()).toEqual(["a", "b", "c", "d"]);
    const f = GOD_KING.anims.idle!.frames[0]!;
    const keys = frameKeys(GOD_KING, f);
    const white = renderFrame(GOD_KING, f).data;
    const black = renderFrame(GOD_KING, f, { look: "black" }).data;
    let armour = 0;
    keys.forEach((row, y) =>
      row.forEach((k, x) => {
        const i = (y * GOD_KING.w + x) * 4;
        const same = white[i] === black[i] && white[i + 1] === black[i + 1] && white[i + 2] === black[i + 2];
        if (k && "abcd".includes(k)) armour++;
        else expect(same, `pixel ${x},${y} (${k})`).toBe(true);
      }),
    );
    expect(armour).toBeGreaterThan(300);
  });

  it("stands his feet at the bottom of his drawing space, one board square", () => {
    expect(GOD_KING.foot).toEqual([GOD_KING_BOX.x + GOD_KING_BOX.size / 2, GOD_KING_BOX.y + GOD_KING_BOX.size - 1]);
  });

  it("plays a one-shot once from its start, then loops what follows by the clock", () => {
    const raise = kingAnimMs("raise");
    expect(kingFrameAt("raise", 1000, 1000, "raised")).toEqual({ anim: "raise", frame: 0 });
    expect(kingFrameAt("raise", 1000 + raise - 1, 1000, "raised").anim).toBe("raise");
    expect(kingFrameAt("raise", 1000 + raise + 5, 1000, "raised").anim).toBe("raised");
    // Without a loop to follow, the last frame holds.
    expect(kingFrameAt("lastStand", 10 ** 7, 0)).toEqual({ anim: "lastStand", frame: GOD_KING.anims.lastStand!.frames.length - 1 });
    // Loops run by the clock, so every figure of him on screen is in step whenever it was drawn.
    const idle = kingAnimMs("idle");
    expect(kingFrameAt("idle", 5 * idle + 1, 123)).toEqual(kingFrameAt("idle", 1, 999));
  });

  it("summoned: appears, raises his sword through the cut-in, and his bolt or each cut lands on its effect's frame", () => {
    const times = { appearAt: 1300, raiseAt: 1550, boltAt: 3250 };
    expect(summonMoment(times, 1300).anim).toBe("appear");
    expect(summonMoment(times, 1549).anim).toBe("appear");
    expect(summonMoment(times, 2000)).toEqual({ anim: "raise", at: 1550, then: "raised" });
    const bolt = summonMoment(times, times.boltAt);
    expect(bolt.anim).toBe("point");
    expect(frameOf(bolt.anim, times.boltAt, bolt.at, bolt.then).cue).toBe("bolt");
    // Just before, his wind-up.
    expect(summonMoment(times, times.boltAt - cueLead("point") - 1).anim).toBe("raise");
    const slashAt = [3300, 3750, 4200];
    for (const at of slashAt) {
      const m = summonMoment({ appearAt: 1300, raiseAt: 1550, slashAt }, at);
      expect(m.anim).toBe("slash");
      expect(frameOf(m.anim, at, m.at, m.then).cue, `slash at ${at}`).toBe("slash");
      // Each cut is over, sword up again, before the next one starts.
      expect(m.at + kingAnimMs("slash")).toBeLessThanOrEqual(at + 450 - cueLead("slash"));
    }
  });

  it("has no back wings in any pose (Eric, Oct 9): only his helmet's", () => {
    expect(Object.keys(GOD_KING.parts).filter((k) => /wing/i.test(k))).toEqual(["wingHelm"]);
    for (const [name, anim] of Object.entries(GOD_KING.anims))
      for (const f of anim.frames) for (const l of f.layers) expect(l.part === "wingHelm" || !/wing/i.test(l.part), `${name}: ${l.part}`).toBe(true);
  });

  it("commanded from his spot: raises his sword, his bolt or each cut lands on its effect's frame, then he lowers it", () => {
    const C = KING_COMMAND;
    const move = { raiseAt: C.raiseAt, boltAt: C.boltAt, lowerAt: C.lowerAt };
    expect(commandMoment(move, -1).anim).toBe("idle");
    expect(commandMoment(move, 100)).toEqual({ anim: "raise", at: 0, then: "raised" });
    const bolt = commandMoment(move, C.boltAt);
    expect(frameOf(bolt.anim, C.boltAt, bolt.at, bolt.then).cue).toBe("bolt");
    expect(commandMoment(move, C.lowerAt)).toEqual({ anim: "lower", at: C.lowerAt, then: "idle" });
    // The bolt comes after the cut-in, and the piece moves after the bolt.
    expect(C.boltAt).toBeGreaterThanOrEqual(C.cutAt + C.cutMs);
    expect(C.moveAt).toBeGreaterThan(C.boltAt);
    const strike = { raiseAt: C.raiseAt, slashAt: C.slashAt, lowerAt: C.strikeLowerAt };
    for (const at of C.slashAt) {
      const m = commandMoment(strike, at);
      expect(frameOf(m.anim, at, m.at, m.then).cue, `slash at ${at}`).toBe("slash");
      expect(m.at + kingAnimMs("slash")).toBeLessThanOrEqual(at + 450 - cueLead("slash"));
    }
    expect(C.slashAt[0]).toBeGreaterThanOrEqual(C.cutAt + C.cutMs);
  });

  it("the clock stands still for the whole strike, and the reveal holds his move: quicker from his spot than summoned", () => {
    const C = KING_COMMAND;
    const s = DEFAULT_SETTINGS;
    expect(s.kingOnBoard).toBe(false);
    // The clock stops until his last slash has landed and he's lowering his sword.
    expect(kingStrikeMs(s)).toBeGreaterThanOrEqual(C.slashAt.at(-1)! + 400);
    expect(kingStrikeMs(s)).toBeLessThan(KING_SUMMON.strikeMs);
    // The reveal is longer by the time the move waits for him (a plain reveal plays it 750 ms in).
    expect(kingMoveMs(s)).toBeGreaterThanOrEqual(C.moveAt - 750);
    expect(kingMoveMs(s)).toBeLessThan(KING_SUMMON.moveMs);
    // The old way, kept behind the setting, keeps its own (longer) times.
    expect(kingStrikeMs({ ...s, kingOnBoard: true })).toBe(KING_SUMMON.strikeMs);
    expect(kingMoveMs({ ...s, kingOnBoard: true })).toBe(KING_SUMMON.moveMs);
  });

  it("his bolts leave from his sword's tip: above his square when raised, out to his side when pointing", () => {
    expect(KING_TIP.raised[1]).toBeLessThan(0);
    expect(KING_TIP.raised[0]).toBeGreaterThan(0);
    expect(KING_TIP.raised[0]).toBeLessThan(0.5);
    expect(KING_TIP.point[0]).toBeLessThan(0);
  });

  it("keeps his Last Stand in step with its timings: the crash, each blow's flash, the cracks, the fall", () => {
    const L = LAST_STAND;
    const at = (ms: number) => frameOf("lastStand", ms - L.fallAt, 0);
    expect(at(L.crashAt).cue).toBe("crash");
    for (let i = 0; i < L.slashes; i++) {
      const blow = L.slashAt + i * L.slashEveryMs;
      expect(at(blow + 10).pal?.a, `blow ${i + 1} flashes`).toBe("#ffffff");
      expect(at(blow + 60).pal?.a, `blow ${i + 1} ends`).toBeUndefined();
    }
    // Cracks (dark specks) appear at each crackAt and never heal.
    const cracks = (ms: number) => (at(ms).specks ?? []).filter(([, , k]) => k === "s").length;
    expect(cracks(L.crackAt[0]! - 20)).toBe(0);
    expect(cracks(L.crackAt[0]! + 40)).toBeGreaterThan(0);
    expect(cracks(L.crackAt[1]! + 40)).toBeGreaterThan(cracks(L.crackAt[0]! + 40));
    expect(cracks(L.crackAt[2]! + 40)).toBeGreaterThan(cracks(L.crackAt[1]! + 40));
    expect(at(L.staggerAt + 10).cue).toBe("stagger");
    expect(at(L.collapseAt + 10).cue).toBe("collapse");
    // Lying as he fades: the same picture as his fallen figure in the dock.
    expect(at(L.fadeAt + 100).layers).toEqual(GOD_KING.anims.fallen!.frames[0]!.layers);
    expect(kingAnimMs("lastStand")).toBeGreaterThanOrEqual(L.fadeAt + L.fadeMs - L.fallAt);
  });
});

describe("lying down (any character)", () => {
  const ch: Character = {
    id: "t",
    name: "t",
    w: 12,
    h: 12,
    foot: [6, 11],
    palette: { k: "#000000", x: "#ff0000", y: "#00ff00" },
    parts: { a: { grid: ["xxy", "x.."] }, b: { grid: ["yy", "y."], outline: false } },
    anims: {},
  };
  const frame = { ms: 1, layers: [{ part: "a", x: 3, y: 2 }, { part: "b", x: 7, y: 6, flipX: true }, { part: "a", x: 5, y: 7, rot: 1 as const }], specks: [[2, 9, "y"]] as const };

  for (const head of ["left", "right"] as const)
    it(`turns every part, outline and speck a quarter (head to the ${head})`, () => {
      const turned = lieDown(ch.parts, frame, 6, 6, head);
      const before = frameKeys(ch, frame);
      const after = frameKeys(ch, { ms: 1, ...turned });
      for (let y = 0; y < 12; y++)
        for (let x = 0; x < 12; x++) {
          // Head to the left is counter-clockwise: (x, y) lands at (y, 11 - x) about the centre of a 12 x 12 frame.
          const [X, Y] = head === "left" ? [y, 11 - x] : [11 - y, x];
          expect(after[Y]![X], `${x},${y}`).toBe(before[y]![x]);
        }
    });
});
