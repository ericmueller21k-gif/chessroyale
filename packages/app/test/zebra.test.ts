import { describe, expect, it } from "vitest";
import { BOSS_POWERS } from "@chessroyale/core";
import { POWER_FX, ZEBRA_ANIM } from "@chessroyale/chess";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { SELECT_SOUND } from "../src/characters/boss-select.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { ZEBRA_DOUGH } from "../src/characters/zebra-dough.ts";
import { GOLD_FX } from "../src/characters/zebra-gold.ts";
import { GOLD_CLOSE, OPENING_FALLBACK, OPENING_LINES, barRows, goldClose, goldFor, openingLine, speechParts } from "../src/characters/zebra-lines.ts";
import { ZEBRA_SOUNDS, zebraSound } from "../src/characters/zebra-sounds.ts";
import { ZEBRA_BEATS, zebraFen, zebraGold, zebraItems } from "../src/components/Zebra.tsx";
import type { Moment } from "../src/components/PowerParts.tsx";
import type { BossView } from "../src/game.ts";

/** Don Dough on screen (docs/decisions/2026-11-11-don-dough.md): his kit, his lines in the bar, his dough and gold on the board, his sounds. */
const kit = BOSS_KITS["Don Dough"]!;
const ms = (a: { frames: readonly { ms: number }[] }) => a.frames.reduce((t, f) => t + f.ms, 0);
const startOf = (a: { frames: readonly { ms: number; cue?: string }[] }, cue: string) => {
  let t = 0;
  for (const f of a.frames) {
    if (f.cue === cue) return t;
    t += f.ms;
  }
  return -1;
};

describe("Don Dough's kit", () => {
  it("his battle start is his breadPop, his drop and Gold Plate his own animations, every cue one of his own sounds", () => {
    expect(kit.anims.entrance).toBe("breadPop");
    expect(kit.anims.power).toBe("drop");
    expect(kit.anims.ultimate).toBe("goldPlate");
    for (const [name, an] of Object.entries(kit.ch.anims)) for (const f of an.frames) if (f.cue) expect(kit.sounds[f.cue], `${name}: ${f.cue}`).toMatch(/^zebra[A-Z]/);
    expect(SELECT_SOUND.zebra).toBe("zebraPop");
  });

  it("the rules' beats are the art's: his lump lands as it leaves his frame, the rise's pop, Gold Plate's first stroke and its 10 s", () => {
    const a = kit.ch.anims;
    expect(ms(a.drop!)).toBe(ZEBRA_ANIM.drop);
    expect(startOf(a.drop!, "drop")).toBeLessThan(ZEBRA_ANIM.landAt);
    expect(ms(a.goldPlate!)).toBe(4200);
    expect(startOf(a.goldPlate!, "gild")).toBe(ZEBRA_ANIM.gildAt);
    expect(ms(ZEBRA_DOUGH.anims.land!)).toBe(ZEBRA_ANIM.land);
    expect(ms(ZEBRA_DOUGH.anims.qRise!)).toBe(ZEBRA_ANIM.rise);
    expect(startOf(ZEBRA_DOUGH.anims.qRise!, "pop")).toBe(ZEBRA_ANIM.riseAt);
    expect(ms(ZEBRA_DOUGH.anims.nSquash!)).toBe(ZEBRA_ANIM.squash);
    // (The gold piece swaps in at the gilding's fourth frame.)
    const gild = GOLD_FX.anims.gild!;
    expect(ZEBRA_ANIM.gildAt + gild.frames.slice(0, 3).reduce((t, f) => t + f.ms, 0)).toBe(ZEBRA_ANIM.swapAt);
    expect(POWER_FX.goldPlate).toBe(10_000);
  });
});

describe("his lines in the bar (two rows at 320 px)", () => {
  it("every opening comment and every Gold Plate close is said in parts that each fit two rows, its words as written", () => {
    const all = [...OPENING_LINES.flatMap((f) => f.lines), ...OPENING_FALLBACK, ...GOLD_CLOSE];
    for (const line of all) {
      const parts = speechParts(line);
      for (const p of parts) expect(barRows(p), `${line}: "${p}"`).toBeLessThanOrEqual(2);
      expect(parts.join(" ")).toBe(line);
    }
  });

  it("names your opening by the library's name's start, the first family that matches; the fallback otherwise", () => {
    expect(openingLine("Sicilian Defense: Najdorf Variation", 0).replace(/\n/g, " ")).toBe(OPENING_LINES.find((f) => f.match === "Sicilian Defense")!.lines[0]);
    expect(openingLine("Queen's Gambit Declined: Orthodox Defense", 1).replace(/\n/g, " ")).toBe(OPENING_LINES.find((f) => f.match === "Queen's Gambit Declined")!.lines[1]);
    expect(openingLine("Queen's Pawn Game: London System", 0).replace(/\n/g, " ")).toBe(OPENING_LINES.find((f) => f.match.endsWith("London System"))!.lines[0]);
    expect(openingLine("Van Geet Opening", 0).replace(/\n/g, " ")).toBe(OPENING_FALLBACK[0]);
    expect(openingLine(null, 3).replace(/\n/g, " ")).toBe(OPENING_FALLBACK[1]);
  });

  it("Gold Plate's close says \"her\" for his queen, \"it\" for any other piece", () => {
    expect(goldFor("Go ahead, throw a pawn at her. I'll wait.", false)).toBe("Go ahead, throw a pawn at it. I'll wait.");
    expect(goldFor("Gold plated. Pawns, hooves off the lady.", false)).toBe("Gold plated. Pawns, hooves off.");
    expect(GOLD_CLOSE.map((l) => l.replace(/\n/g, " "))).toContain(goldClose("k", true).replace(/\n/g, " "));
  });
});

describe("his dough and gold on the board", () => {
  const boss = (z: object, extra: object = {}) => ({ id: "zebra", name: "Don Dough", startMove: 1, powers: { events: [], turn: 3, zebra: { lumps: [], gold: [], ...z } }, ...extra }) as unknown as BossView;
  const moment = (m: Partial<Moment>): Moment => ({ kind: "doughDrop", key: "k", at: 1000, ms: 1240, ...m }) as Moment;

  it("a lump proofs as its kind; a new one lands as his lob reaches the board; a rise rings, then rises, his piece on from its pop", () => {
    const b = boss({ lumps: [{ n: 0, slot: 0, piece: "n", square: "e5", left: 5, at: 1 }] });
    expect(zebraItems(b, [], 0)).toEqual([{ square: "e5", name: "zebraDough", anim: "n", since: 0 }]);
    const drop = moment({ square: "e5", shape: "n" });
    expect(zebraItems(b, [drop], 1000 + ZEBRA_BEATS.drop.landAt - 1)).toEqual([]);
    expect(zebraItems(b, [drop], 1000 + ZEBRA_BEATS.drop.landAt)[0]).toMatchObject({ anim: "land", then: "n" });
    const rise = moment({ kind: "doughRise", square: "c6", shape: "b", ms: 1690 });
    const none = boss({});
    expect(zebraItems(none, [rise], 1100)[0]).toMatchObject({ square: "c6", anim: "b" });
    expect(zebraItems(none, [rise], 1000 + ZEBRA_BEATS.rise.riseAt)[0]).toMatchObject({ square: "c6", anim: "bRise" });
    const fen = "r1bqkb1r/pp3ppp/2b1pn2/3p4/3P4/2N1PN2/PP3PPP/R1BQKB1R w KQkq - 0 7";
    expect(zebraFen({ id: "zebra" }, [rise], 1000 + ZEBRA_BEATS.rise.popAt - 1, fen)!.fen.split(" ")[0]).toBe("r1bqkb1r/pp3ppp/4pn2/3p4/3P4/2N1PN2/PP3PPP/R1BQKB1R");
    expect(zebraFen({ id: "zebra" }, [rise], 1000 + ZEBRA_BEATS.rise.popAt, fen)).toBeNull();
  });

  it("a gold piece is drawn gold from the gilding's fourth frame, glints quietly from then on", () => {
    const b = boss({ gold: ["d8"] });
    const g = moment({ kind: "goldPlate", square: "d8", shape: "q", ms: 10_000 });
    expect(zebraGold(b, [g], 1000 + ZEBRA_BEATS.gold.swapAt - 1)).toEqual([]);
    expect(zebraGold(b, [g], 1000 + ZEBRA_BEATS.gold.swapAt)).toEqual(["d8"]);
    expect(zebraGold(b)).toEqual(["d8"]);
    expect(zebraGold(boss({ gold: [] }))).toBeUndefined();
    expect(zebraItems(b, [], 0)).toEqual([{ square: "d8", name: "goldFx", anim: "glint", since: 0, quiet: true }]);
    expect(zebraItems(b, [g], 1000 + ZEBRA_BEATS.gold.gildAt)[0]).toMatchObject({ anim: "gild" });
    expect(zebraItems(b, [g], 1000 + ZEBRA_BEATS.gold.shineAt)[0]).toMatchObject({ anim: "shine" });
  });

  it("a timer for each lump the rules allow at once, each kind 00 to 15 and its rolls and ding", async () => {
    const { ZEBRA_TIMER } = await import("../src/characters/zebra-dough.ts");
    for (const k of ["p", "n", "b", "r", "q"]) {
      expect(ZEBRA_TIMER.anims[`${k}${String(BOSS_POWERS.doughTimers[k as "p"]).padStart(2, "0")}`]).toBeTruthy();
      expect(ZEBRA_TIMER.anims[`${k}Roll01`]!.frames[0]!.cue).toBe("roll");
      expect(ZEBRA_TIMER.anims[`${k}Ding`]!.frames[0]!.cue).toBe("ding");
    }
    expect(BOSS_POWERS.doughLive).toBeGreaterThanOrEqual(1);
  });
});

describe("his sounds", () => {
  it("no louder than a piece's move, in line with the other bosses', and the same every time", () => {
    for (const name of ZEBRA_SOUNDS) {
      const s = zebraSound(name, 44100);
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
      expect(db, name).toBeGreaterThan(MOVE_MEAN_DB - 7);
      expect(s, `${name} is the same every time`).toEqual(zebraSound(name, 44100));
    }
  });
});
