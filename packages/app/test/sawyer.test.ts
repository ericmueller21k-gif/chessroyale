import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, SPEECH, isPlayable } from "@chessroyale/core";
import { BOARD_SAW, SAW_CUT, SPLIT, START_FEN, pieceAt, withPiece } from "@chessroyale/chess";
import { CUT, LEAP, SAWYER, SAWYER_LINES } from "../src/characters/sawyer.ts";
import { SAWYER_SOUNDS, sawyerSound } from "../src/characters/sawyer-sounds.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { CUT_SIDES, GAP_W } from "../src/characters/effects.ts";
import { EFFECTS, POWER_MOMENTS, animLength, cueAt } from "../src/characters/power-art.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { frameKeys } from "../src/characters/sprite.ts";
import { cutSides, halfClass, splitFen, splitStill } from "../src/components/Sawyer.tsx";
import { holdMs } from "../src/speech.tsx";

const top = (keys: (string | null)[][]) => keys.findIndex((r) => r.some(Boolean));
const idle = SAWYER.anims.idle!;
const kit = BOSS_KITS["Sawyer"]!;

describe("Sawyer, the raccoon with a saw", () => {
  it("is the roster's sawyer (🪚), playable, his kit under his name", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "sawyer")!;
    expect(def.kit).toBe("Sawyer");
    expect(isPlayable(def)).toBe(true);
    expect(kit.ch).toBe(SAWYER);
    expect(POWER_MOMENTS["Sawyer"]).toBeTruthy();
  });

  it("never rises above his hard hat at rest, so on a phone he stays under the boss bar's heading", () => {
    const highest = Math.min(...idle.frames.map((f) => top(frameKeys(SAWYER, f))));
    for (const [name, anim] of Object.entries(SAWYER.anims))
      anim.frames.forEach((f, i) => expect(top(frameKeys(SAWYER, f)), `${name} frame ${i + 1}`).toBeGreaterThanOrEqual(highest));
  });

  it("has no goggles: a bold black bandit mask with his eyes inside it, glinting (Eric, Oct 10)", () => {
    for (const k of ["G", "H", "I", "Z"]) expect(SAWYER.palette, k).not.toHaveProperty(k);
    const keys = frameKeys(SAWYER, idle.frames[0]!);
    const mask = keys.flat().filter((c) => c === "m").length;
    expect(mask).toBeGreaterThan(80);
    const rows = keys.map((r) => r.join(""));
    const eyeRows = rows.filter((r) => r.includes("v"));
    expect(eyeRows.length).toBeGreaterThan(0);
    for (const r of eyeRows) expect(r.match(/v/g)!.length).toBe(2);
  });

  it("idles silently: the blade buzzes in and out, the tail swishes, he blinks and smirks", () => {
    const part = (prefix: string) => idle.frames.map((f) => f.layers.find((l) => l.part.startsWith(prefix))!.part);
    const saws = part("saw:");
    expect(saws.filter((s, i) => s !== saws[(i + 1) % saws.length]).length).toBeGreaterThan(idle.frames.length / 2);
    expect(new Set(part("tail:")).size).toBeGreaterThanOrEqual(4);
    const heads = part("head:");
    expect(heads).toContain("head:blink");
    expect(heads).toContain("head:smirk");
    expect(idle.frames.some((f) => f.cue)).toBe(false);
  });

  it("revs with a cue and a shake, and drives the saw down to bite the ground in front of him", () => {
    const rev = SAWYER.anims.rev!.frames;
    expect(rev.some((f) => f.cue === "rev")).toBe(true);
    expect(rev.some((f) => f.shake)).toBe(true);
    const down = SAWYER.anims.sawDown!.frames;
    const swing = down.findIndex((f) => f.cue === "swing");
    const cut = down.findIndex((f) => f.cue === "cut");
    expect(swing).toBeGreaterThan(0);
    expect(cut).toBeGreaterThan(swing);
    expect(CUT[1]).toBeGreaterThan(58);
    expect(CUT[0]).toBeLessThan(15);
  });

  it("has a portrait inside his frame that shows his hard hat, bandit mask, eyes and grin", () => {
    const p = kit.portrait;
    expect(p.x + p.w).toBeLessThanOrEqual(SAWYER.w);
    expect(p.y + p.h).toBeLessThanOrEqual(SAWYER.h);
    const keys = frameKeys(SAWYER, SAWYER.anims[p.anim]!.frames[p.frame]!);
    const inside = keys.slice(p.y, p.y + p.h).flatMap((r) => r.slice(p.x, p.x + p.w));
    for (const k of ["Y", "m", "w", "v", "x"]) expect(inside, k).toContain(k);
  });
});

describe("his moments", () => {
  it("leaps: off the ground at upAt with no shadow under him (the board draws it), down at landAt with a thump", () => {
    const leap = SAWYER.anims.leap!;
    let t = 0;
    for (const [i, f] of leap.frames.entries()) {
      expect(f.layers.some((l) => l.part === "shadow"), `frame ${i}`).toBe(!(t >= LEAP.upAt && t < LEAP.landAt));
      t += f.ms;
    }
    expect(cueAt(leap, "hop")).toBe(LEAP.landAt);
  });

  it("the split: he saws the pawn after landing, the blade biting as the cut cue lands, the crack after it", () => {
    expect(SPLIT.landAt - SPLIT.hopAt).toBe(LEAP.landAt - LEAP.upAt);
    expect(SPLIT.cutAt).toBe(SPLIT.sawAt + cueAt(SAWYER.anims.sawDown!, "cut")!);
    expect(SPLIT.crackAt).toBeGreaterThan(SPLIT.cutAt);
    expect(SPLIT.settledAt).toBeGreaterThan(SPLIT.crackAt);
    expect(SPLIT.backAt + (LEAP.landAt - LEAP.upAt)).toBeLessThanOrEqual(SPLIT.total);
    expect(SPLIT.sawAt + animLength(SAWYER.anims.sawDown!)).toBeLessThanOrEqual(SPLIT.backAt);
  });

  it("the board saw: a leap, a rev, then he saws his way up the middle for its run, the big saw's sound from its first frame", () => {
    const run = SAWYER.anims.boardSaw!;
    expect(run.frames[0]!.cue).toBe("bigsaw");
    expect(Math.abs(animLength(run) - BOARD_SAW.runMs)).toBeLessThanOrEqual(90);
    expect(BOARD_SAW.revAt + animLength(SAWYER.anims.rev!)).toBeLessThanOrEqual(BOARD_SAW.runAt);
    expect(BOARD_SAW.runAt + BOARD_SAW.runMs).toBe(BOARD_SAW.splitAt);
    expect(BOARD_SAW.offAt + (LEAP.landAt - LEAP.upAt)).toBeLessThanOrEqual(BOARD_SAW.total);
    // The blade bites (driven down, its tip at CUT) the whole way.
    for (const f of run.frames) expect(f.layers.find((l) => l.part.startsWith("saw:"))!.part).toMatch(/;-36;/);
  });

  it("a saw cut's moment: his saw comes down at the board's corner, the groove opening as the cut cue lands", () => {
    expect(SAW_CUT.cutAt).toBeGreaterThan(cueAt(SAWYER.anims.sawDown!, "cut")!);
    expect(SAW_CUT.cutAt + SAW_CUT.openMs).toBeLessThanOrEqual(SAW_CUT.ms);
    expect(animLength(EFFECTS.sawCut.ch.anims.openN!)).toBeLessThanOrEqual(SAW_CUT.openMs);
  });

  it("before the crack the new half isn't on the board; from it until they land, neither is; then both are", () => {
    const after = withPiece(withPiece(START_FEN.replace("pppppppp", "pppp1ppp"), "e5", { color: "b", type: "p" }), "d5", { color: "b", type: "p" });
    const split = { turn: 2, pawn: "e5", square: "d5", halves: [{ square: "d5", side: "a" as const }, { square: "e5", side: "h" as const }] };
    const m = { kind: "split" as const, at: 10_000 };
    const before = splitFen(split, m, m.at - 500, after)!;
    expect(pieceAt(before, "d5")).toBeNull();
    expect(pieceAt(before, "e5")).not.toBeNull();
    const air = splitFen(split, m, m.at + SPLIT.crackAt + 10, after)!;
    expect(pieceAt(air, "d5")).toBeNull();
    expect(pieceAt(air, "e5")).toBeNull();
    expect(splitFen(split, m, m.at + SPLIT.settledAt, after)).toBeNull();
    expect(splitFen({ ...split, square: null }, m, m.at, after)).toBeNull();
    // The board doesn't animate the crack or the landing; it does the move before them.
    expect(splitStill(m, m.at - 500)).toBe(false);
    expect(splitStill(m, m.at + SPLIT.crackAt)).toBe(true);
    expect(splitStill(m, m.at + SPLIT.settledAt + 400)).toBe(false);
  });

  it("each half shows the side away from its partner, whichever way up the board is", () => {
    expect(halfClass("a", "white")).toBe("saw-half-l");
    expect(halfClass("h", "white")).toBe("saw-half-r");
    expect(halfClass("a", "black")).toBe("saw-half-r");
    expect(halfClass("h", "black")).toBe("saw-half-l");
  });
});

describe("his effects", () => {
  it("a saw cut: its half on each square, on the side of the edge between them, whichever way up", () => {
    expect(cutSides({ a: "d4", b: "e4" }, "white")).toEqual(["E", "W"]);
    expect(cutSides({ a: "d4", b: "e4" }, "black")).toEqual(["W", "E"]);
    expect(cutSides({ a: "e2", b: "e3" }, "white")).toEqual(["N", "S"]);
    expect(cutSides({ a: "e2", b: "e3" }, "black")).toEqual(["S", "N"]);
  });

  it("a saw cut's two halves meet at the edge: a groove on the touching sides, nothing on the far ones", () => {
    const ch = EFFECTS.sawCut.ch;
    const keys = (anim: string) => frameKeys(ch, ch.anims[anim]!.frames[0]!);
    const left = keys("rawE");
    const right = keys("rawW");
    expect(left.every((r) => r[31] === "d")).toBe(true);
    expect(right.every((r) => r[0] === "d")).toBe(true);
    expect(left.some((r) => r[0])).toBe(false);
    expect(right.some((r) => r[31])).toBe(false);
    expect(keys("rawS")[31]!.every((c) => c === "d")).toBe(true);
    expect(keys("rawN")[0]!.every((c) => c === "d")).toBe(true);
  });

  it("a saw cut opens along the edge, is taped over turn by turn (a tape sound each time), and heals away (ends empty)", () => {
    const ch = EFFECTS.sawCut.ch;
    for (const S of CUT_SIDES) {
      for (const a of ["open", "raw", "tape1", "taped1", "tape2", "taped2", "heal"]) expect(ch.anims[`${a}${S}`], `${a}${S}`).toBeTruthy();
      const filled = (anim: string, i = 0) => frameKeys(ch, ch.anims[anim]!.frames[i]!).flat().filter(Boolean).length;
      const open = ch.anims[`open${S}`]!.frames.map((_, i) => filled(`open${S}`, i));
      for (let i = 1; i < open.length; i++) expect(open[i]!).toBeGreaterThan(open[i - 1]!);
      expect(ch.anims[`tape1${S}`]!.frames[0]!.cue).toBe("tape");
      expect(ch.anims[`tape2${S}`]!.frames[0]!.cue).toBe("tape");
      const tape = (anim: string) => frameKeys(ch, ch.anims[anim]!.frames[0]!).flat().filter((c) => c && "tTuU".includes(c)).length;
      expect(tape(`taped2${S}`)).toBeGreaterThan(tape(`taped1${S}`));
      expect(tape(`raw${S}`)).toBe(0);
      expect(frameKeys(ch, ch.anims[`heal${S}`]!.frames.at(-1)!).flat().some(Boolean)).toBe(false);
    }
    expect(EFFECTS.sawCut.sounds.tape).toBe("sawyerTape");
  });

  it("the board saw's gap: sawn open from the bottom to the top over its run, the halves parting, closing (ends empty)", () => {
    const ch = EFFECTS.boardGap.ch;
    expect(ch.w).toBe(GAP_W);
    expect(ch.h).toBe(256);
    const run = ch.anims.run!;
    expect(Math.abs(animLength(run) - BOARD_SAW.runMs)).toBeLessThanOrEqual(run.frames.length);
    const openFrom = run.frames.map((f) => top(frameKeys(ch, f)));
    for (let i = 1; i < openFrom.length; i++) expect(openFrom[i]!, `step ${i}`).toBeLessThanOrEqual(openFrom[i - 1]!);
    expect(frameKeys(ch, run.frames[0]!).at(-1)!.some(Boolean)).toBe(true);
    const width = (anim: string, i = 0) => frameKeys(ch, ch.anims[anim]!.frames[i]!)[128]!.filter(Boolean).length;
    expect(width("part", 0)).toBeLessThan(width("part", 2));
    expect(width("gap")).toBe(GAP_W);
    expect(ch.anims.part!.frames[0]!.cue).toBe("split");
    expect(ch.anims.close!.frames[0]!.cue).toBe("rejoin");
    expect(frameKeys(ch, ch.anims.close!.frames.at(-1)!).flat().some(Boolean)).toBe(false);
  });

  it("the crack as his pawn splits: a crack sound, ends empty", () => {
    const ch = EFFECTS.sawCrack.ch;
    expect(ch.anims.crack!.frames[0]!.cue).toBe("crack");
    expect(frameKeys(ch, ch.anims.crack!.frames.at(-1)!).flat().some(Boolean)).toBe(false);
    expect(EFFECTS.sawCrack.sounds.crack).toBe("sawyerCrack");
  });
});

describe("his lines", () => {
  it("are his builder's patter, the spec's among them, each short enough to read whole under the speech rule", () => {
    expect(SAWYER_LINES.entrance).toContain("Measure twice, cut once.");
    expect(SAWYER_LINES.split).toContain("Two for one!");
    expect(SAWYER_LINES.ultimate).toContain("Timber!");
    expect(SAWYER_LINES.ultimateWarn).toContain("This board's getting renovated.");
    for (const [beat, lines] of Object.entries(SAWYER_LINES))
      for (const l of lines!) {
        expect(l.length, `${beat}: ${l}`).toBeLessThanOrEqual(34);
        // Its whole reading time fits the rule (never cut short by the cap).
        expect(SPEECH.readMs + SPEECH.perCharMs * l.length, l).toBeLessThan(SPEECH.maxReadMs);
        expect(holdMs(l)).toBeGreaterThan(SPEECH.readMs);
      }
  });
});

describe("his sounds", () => {
  it("are all his own (no borrowed ones), one for every cue, his effects' too", () => {
    for (const [cue, sound] of Object.entries(kit.sounds)) expect(sound, cue).toMatch(/^sawyer/);
    for (const [name, an] of Object.entries(SAWYER.anims)) for (const f of an.frames) if (f.cue) expect(kit.sounds[f.cue], `${name}: ${f.cue}`).toBeTruthy();
    for (const fx of ["sawCut", "sawCrack", "boardGap"] as const) {
      for (const sound of Object.values(EFFECTS[fx].sounds)) expect(sound).toMatch(/^sawyer/);
      for (const an of Object.values(EFFECTS[fx].ch.anims)) for (const f of an.frames) if (f.cue) expect(EFFECTS[fx].sounds[f.cue], `${fx}: ${f.cue}`).toBeTruthy();
    }
  });

  it("sound no louder than a piece's move, and the same every time", () => {
    for (const name of SAWYER_SOUNDS) {
      const s = sawyerSound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      expect(10 * Math.log10(sum / s.length), name).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(s, `${name} is the same every time`).toEqual(sawyerSound(name, 44100));
    }
  });

  it("have no chimes or bright dings: a saw's buzz and rasp, wood and tape, their energy low", () => {
    for (const name of SAWYER_SOUNDS) {
      const s = sawyerSound(name, 44100);
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
