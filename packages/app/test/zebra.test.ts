import { describe, expect, it } from "vitest";
import { BOSS_POWERS, type PowerEvent } from "@chessroyale/core";
import type { VNode } from "preact";
import { POWER_FX, ZEBRA_ANIM } from "@chessroyale/chess";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { SELECT_SOUND } from "../src/characters/boss-select.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { ZEBRA_DOUGH } from "../src/characters/zebra-dough.ts";
import { GOLD_FX } from "../src/characters/zebra-gold.ts";
import { GOLD_CLOSE, OPENING_FALLBACK, OPENING_LINES, barRows, goldClose, goldFor, openingLine, speechParts } from "../src/characters/zebra-lines.ts";
import { ZEBRA_ROOM_SOUNDS, ZEBRA_SOUNDS, zebraSound } from "../src/characters/zebra-sounds.ts";
import { OvenTimers, ZEBRA_BEATS, timerRun, zebraFen, zebraGold, zebraItems, zebraTurnMoments } from "../src/components/Zebra.tsx";
import { momentsOf, powerLine } from "../src/components/BossPowers.tsx";
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

  it("a timer for each lump the rules allow at once, each kind from its start (doughTimers) down to 00, its rolls and ding", async () => {
    const { ZEBRA_TIMER } = await import("../src/characters/zebra-dough.ts");
    for (const k of ["p", "n", "b", "r", "q"]) {
      for (let m = 0; m <= BOSS_POWERS.doughTimers[k as "p"]; m++) {
        const mm = String(m).padStart(2, "0");
        expect(ZEBRA_TIMER.anims[`${k}${mm}`]).toBeTruthy();
        if (m > 0) expect(ZEBRA_TIMER.anims[`${k}Roll${mm}`]).toBeTruthy();
      }
      expect(ZEBRA_TIMER.anims[`${k}Roll01`]!.frames[0]!.cue).toBe("roll");
      expect(ZEBRA_TIMER.anims[`${k}Ding`]!.frames[0]!.cue).toBe("ding");
    }
    expect(BOSS_POWERS.doughLive).toBeGreaterThanOrEqual(1);
  });
});

describe("his oven timers (the review of Nov 11)", () => {
  type Z = { lumps: { n: number; slot: number; piece: string; square: string; left: number; at: number }[] };
  const view = (startMove: number, z: Z, events: PowerEvent[] = [], turn = 3) =>
    ({ id: "zebra", name: "Don Dough", startMove, powers: { events, turn, zebra: { gold: [], ...z } } }) as unknown as BossView;
  /** The timers' slots as drawn: each slot's attributes and its timer's props. */
  const slots = (b: BossView, moments: Moment[] = []) => {
    const root = OvenTimers({ boss: b, moments: () => moments }) as VNode<{ children: VNode<Record<string, unknown>>[] }>;
    return root.props.children.map((s) => ({ ...s.props, timer: (s.props.children as VNode<Record<string, unknown>> | undefined)?.props }));
  };

  it("a knight's, bishop's or queen's lump rising after your move (while he thinks: no screen moments) rings in its own slot", () => {
    const pawn = { n: 0, slot: 0, piece: "p", square: "h5", left: 2, at: 1 };
    const knight = { n: 1, slot: 1, piece: "n", square: "c5", left: 1, at: 2 };
    slots(view(101, { lumps: [pawn, knight] }));
    const rise: PowerEvent = { kind: "doughRise", turn: 3, square: "c5", shape: "n", by: "crowd" };
    const after = slots(view(101, { lumps: [{ ...pawn, left: 1 }] }, [rise]), []);
    expect(after[1]).toMatchObject({ "data-ring": "1", timer: { kind: "n", left: 0, ding: true } });
    expect(after[0]).toMatchObject({ "data-square": "h5", timer: { kind: "p", left: 1 } });
  });

  it("the roll after a move plays to its end: the timer's props don't change as the bar redraws at the same minute", () => {
    const lump = (left: number) => ({ lumps: [{ n: 0, slot: 0, piece: "p", square: "h5", left, at: 1 }] });
    slots(view(102, lump(4)));
    const first = slots(view(102, lump(3)))[0]!.timer;
    const again = slots(view(102, lump(3)))[0]!.timer;
    expect(again).toEqual(first);
    // (The roll is chosen once per minute, in the timer's effect.)
    expect(timerRun("t:102", "p", 4)).toBeNull();
    expect(timerRun("t:102", "p", 3)).toBe("pRoll04");
    expect(timerRun("t:102", "p", 3)).toBeNull();
  });

  it("two lumps rising on one move each have their own moment (their own line), after your move and after his", () => {
    const two: PowerEvent[] = [
      { kind: "doughRise", turn: 4, square: "c5", shape: "r", by: "crowd" },
      { kind: "doughRise", turn: 4, square: "h5", shape: "p", by: "crowd" },
    ];
    const yours = zebraTurnMoments(view(103, { lumps: [] }, two, 4), 5000);
    expect(new Set(yours.map((m) => m.key)).size).toBe(2);
    const his = two.map(({ by: _by, ...e }) => e);
    const after = momentsOf(view(104, { lumps: [] }, his, 4), 20_000);
    expect(after.filter((m) => m.kind === "doughRise")).toHaveLength(2);
    expect(new Set(after.map((m) => m.key)).size).toBe(2);
  });

  it("Gold Plate with nothing left to gild says no brag (the banner says so)", () => {
    expect(powerLine(kit, { kind: "goldPlate", key: "zebra:goldPlate:5:crowd" })).toBeNull();
    expect(powerLine(kit, { kind: "goldPlate", key: "zebra:goldPlate:5:crowd", square: "d8", shape: "q" } as Moment)).toMatch(/worthless/);
  });
});

describe("his sounds", () => {
  it("no louder than a piece's move, in line with the other bosses', and the same every time", () => {
    // (His own: the room's four are quieter by design, shop-zebra.test.ts.)
    for (const name of ZEBRA_SOUNDS.filter((n) => !ZEBRA_ROOM_SOUNDS.includes(n))) {
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
