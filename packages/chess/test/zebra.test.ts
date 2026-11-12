import { describe, expect, it } from "vitest";
import { BOSS_ADMIN_FIRST, BOSS_POWERS, BOSS_ROSTER, adminFirst, isPlayable, menuBosses, mulberry32, type BossPowerState, type ZebraState } from "@chessroyale/core";
import {
  MatchRunner,
  POWER_FX,
  ZEBRA_FX,
  bossAllowed,
  crowdAllowed,
  doughKind,
  doughSquare,
  gildPick,
  goldAfter,
  kingAttacked,
  legalMoves,
  openingNameFor,
  pieceAt,
  powerTurn,
  riseCheck,
  sideToMove,
  stockfishRefuses,
  stopReason,
  zebraEvents,
  zebraTurnMs,
  type Opening,
} from "../src/index.ts";
import { KIT_OPENING, crowdPick, fakeEngine, kitSettings } from "./boss-kit-lib.ts";

/**
 * Don Dough, the zebra kingpin (docs/decisions/2026-11-11-don-dough.md): Rising Dough (a few lumps of dough dropped early on his
 * half, each showing what it rises as when its oven timer reaches 00:00, a minute off for every move, yours and his; your piece
 * landing on one squashes it) and Gold Plate (after the usual warning, at the start of his turn: his queen, else his strongest
 * piece, turns gold, and your pawns can't take it for the rest of the battle), and his comment on your opening.
 */

const S = BOSS_POWERS;

function battle(seed: number, opts: { test?: string; side?: "w" | "b"; library?: Opening[] } = {}): MatchRunner {
  const settings = kitSettings({
    boss: "zebra",
    test: opts.test ?? "",
    maxMoves: 60,
  });
  return new MatchRunner({
    settings,
    rng: mulberry32(seed),
    engines: [fakeEngine()],
    library: opts.library ?? [KIT_OPENING],
    entrants: [{ id: "h0", name: "H", isBot: false }],
    raidSide: opts.side ?? "w",
  });
}
const fenOf = (r: MatchRunner) => r.boards.get(r.state.boards[0]!)!.fen;
const zOf = (r: MatchRunner): ZebraState => r.boss!.powers!.zebra!;

async function crowdMove(r: MatchRunner, pick?: (fen: string, allowed: string[]) => string) {
  r.deal();
  const fen = fenOf(r);
  const allowed = r.crowdAllowed() ?? legalMoves(fen);
  const move = pick ? pick(fen, allowed) : crowdPick(fen, allowed, mulberry32(fen.length * 31 + allowed.length));
  await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
  return move;
}

function onPosition(r: MatchRunner, fen: string, crowd: "w" | "b", zebra: Partial<ZebraState> = {}, patch: Partial<BossPowerState> = {}) {
  const id = r.state.boards[0]!;
  const board = r.boards.get(id)!;
  r.boards.set(id, {
    ...board,
    fen,
    bases: [...(board.bases ?? []).filter((x) => x.ply !== board.history.length), { ply: board.history.length, fen }],
  });
  const boss = r.state.boss!;
  r.state = {
    ...r.state,
    boss: {
      ...boss,
      crowdSide: crowd,
      powers: {
        ...boss.powers!,
        ...patch,
        zebra: {
          ...boss.powers!.zebra!,
          his: crowd === "w" ? "b" : "w",
          ...zebra,
        },
      },
    },
  };
}

/** The placement and kinds with no lead guard, and out of reach of every move of yours (the switches the sim tried). */
const ANY_LEAD = { ...S, doughLeadMax: 99 };
const OUT = { ...S, doughReach: "out" as const };

/** A quiet middlegame, the crowd (White) to move, a pawn of each side gone: a lump of any kind can rise. */
const QUIET_W = "r1bqkb1r/pp3ppp/2n1pn2/3p4/3P4/2N1PN2/PP3PPP/R1BQKB1R w KQkq - 0 7";

describe("Don Dough's sheet", () => {
  it("is on the roster with Rising Dough and Gold Plate, admins first", () => {
    const def = BOSS_ROSTER.find((d) => d.id === "zebra")!;
    expect(def).toMatchObject({
      name: "Don Dough",
      kit: "Don Dough",
      powers: { passive: "dough", ultimate: "goldplate" },
    });
    expect(BOSS_ADMIN_FIRST).toContain("zebra");
    expect(adminFirst(def)).toBe(true);
    expect(isPlayable(def)).toBe(false);
    expect(menuBosses({ admin: false, raid: true }).some((d) => d.id === "zebra")).toBe(false);
    expect(menuBosses({ admin: false, raid: false }).some((d) => d.id === "zebra")).toBe(false);
    expect(menuBosses({ admin: true, raid: false }).some((d) => d.id === "zebra")).toBe(true);
  });

  it("has Eric's timers (Nov 12: pawn 8, knight and bishop 13, rook 16, queen 21), rook and queen rare, a few drops early on", () => {
    expect(S.doughTimers).toEqual({ p: 8, n: 13, b: 13, r: 16, q: 21 });
    expect(S.doughOdds.r).toBeLessThan(S.doughOdds.p);
    expect(S.doughOdds.q).toBeLessThan(S.doughOdds.n);
    expect(S.doughOdds.q).toBeLessThan(S.doughOdds.b);
    expect(S.doughDrops).toBeGreaterThanOrEqual(2);
    expect(S.doughLast).toBeLessThanOrEqual(20);
    expect(S.maxUltimates.zebra).toBe(2);
    for (const k of ["doughDrop", "doughRise", "doughSquash", "goldPlate", "openingTalk"] as const) expect(POWER_FX[k]).toBe(ZEBRA_FX[k]);
    // (Eric, Nov 11: Gold Plate's moment about 10 s.)
    expect(ZEBRA_FX.goldPlate).toBe(10_000);
  });
});

describe("Rising Dough: what and where", () => {
  it("drops only a kind he can have: from the starting position (all eight pawns, his whole army) none; after a pawn of his goes, any", () => {
    const start = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    for (let n = 0; n < 20; n++) expect(doughKind(start, "b", 3, n)).toBeNull();
    const kinds = new Set<string>();
    for (let n = 0; n < 400; n++) kinds.add(doughKind(QUIET_W, "b", 5, n, ANY_LEAD)!);
    expect([...kinds].sort()).toEqual(["b", "n", "p", "q", "r"]);
    // (Rook and queen rare: about S.doughOdds of them.)
    let rq = 0;
    for (let n = 0; n < 2000; n++) if (["r", "q"].includes(doughKind(QUIET_W, "b", 11, n, ANY_LEAD)!)) rq++;
    expect(rq / 2000).toBeLessThan(0.2);
  });

  it("counts the lumps still waiting as risen: never a lump that could never rise (a ninth pawn, a knight past promotion's room, past the lead)", () => {
    // (QUIET_W: his seven pawns, two knights; room for one promotion.)
    const only = (k: "p" | "n", lead: number = S.doughLeadMax) => ({ ...S, doughLeadMax: lead, doughOdds: { p: 0, n: 0, b: 0, r: 0, q: 0, [k]: 1 } });
    expect(doughKind(QUIET_W, "b", 5, 1, only("p", 99))).toBe("p");
    expect(doughKind(QUIET_W, "b", 5, 1, only("p", 99), [{ square: "h5", piece: "p" }])).toBeNull();
    expect(doughKind(QUIET_W, "b", 5, 1, only("n", 99))).toBe("n");
    expect(doughKind(QUIET_W, "b", 5, 1, only("n", 99), [{ square: "h5", piece: "n" }])).toBeNull();
    // (The lead: level on material, a pawn's fits; with a knight's waiting it would put him past doughLeadMax.)
    expect(doughKind(QUIET_W, "b", 5, 1, only("p"))).toBe("p");
    expect(doughKind(QUIET_W, "b", 5, 1, only("p"), [{ square: "h5", piece: "n" }])).toBeNull();
  });

  it("puts a pawn, knight or bishop on the two ranks of his half nearest the middle, a rook or queen behind them over a pawn of yours; never his back rank, a lump's square or one your move reaches now", () => {
    const crowd = "w";
    const reach = new Set(legalMoves(QUIET_W).map((m) => m.slice(2, 4)));
    for (let n = 0; n < 60; n++) {
      for (const piece of ["p", "n", "b"] as const) {
        const sq = doughSquare(QUIET_W, piece, 9, n, [], OUT)!;
        expect(sq, `${piece} #${n}`).toBeTruthy();
        expect(["5", "6"]).toContain(sq[1]);
        expect(pieceAt(QUIET_W, sq)).toBeNull();
        expect(reach.has(sq)).toBe(false);
      }
      for (const piece of ["r", "q"] as const) {
        const sq = doughSquare(QUIET_W, piece, 9, n, [], OUT);
        if (!sq) continue;
        expect(["6", "7"]).toContain(sq[1]);
        expect(reach.has(sq)).toBe(false);
        // (A pawn of yours below it on its file.)
        const file = [2, 3, 4, 5].some((r) => pieceAt(QUIET_W, `${sq[0]}${r}`)?.type === "p" && pieceAt(QUIET_W, `${sq[0]}${r}`)?.color === crowd);
        expect(file).toBe(true);
      }
    }
    // (Never on a lump.)
    const first = doughSquare(QUIET_W, "p", 9, 0)!;
    expect(doughSquare(QUIET_W, "p", 9, 0, [{ square: first }])).not.toBe(first);
  });

  it("never a lump that would put him more than doughLeadMax pawns ahead (but a queen's, rare); with doughReach \"any\" a square your move reaches is fine", () => {
    // (Level on material: a pawn's at most, or a queen's.)
    const kinds = new Set<string>();
    for (let n = 0; n < 400; n++) kinds.add(doughKind(QUIET_W, "b", 5, n)!);
    expect([...kinds].sort()).toEqual(S.doughQueenFree ? ["p", "q"] : ["p"]);
    // (A queen's no more often than the odds give it: the kinds he can't have step down to a pawn's, not to a queen's.)
    let q = 0;
    for (let n = 0; n < 2000; n++) if (doughKind(QUIET_W, "b", 7, n) === "q") q++;
    expect(q / 2000).toBeLessThan(S.doughOdds.q * 2);
    const reach = new Set(legalMoves(QUIET_W).map((m) => m.slice(2, 4)));
    let reached = 0;
    for (let n = 0; n < 60; n++) if (reach.has(doughSquare(QUIET_W, "p", 9, n, [], { ...S, doughReach: "any" })!)) reached++;
    expect(reached).toBeGreaterThan(0);
  });

  it("rises only where the guards allow: no pawn on a last rank, no ninth pawn, no check either way, a position Stockfish plays", () => {
    expect(riseCheck(QUIET_W, "p", "a8", "b")).toBeNull();
    expect(riseCheck(QUIET_W, "n", "e5", "b")).not.toBeNull();
    // (A knight on d3 would check your king on e1: it waits.)
    expect(riseCheck(QUIET_W, "n", "d3", "b")).toBeNull();
    // (All eight pawns: no ninth.)
    const full = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    expect(riseCheck(full, "p", "e6", "b")).toBeNull();
    const after = riseCheck(QUIET_W, "b", "a6", "b")!;
    expect(pieceAt(after, "a6")).toEqual({ color: "b", type: "b" });
    expect(stockfishRefuses(after)).toBeNull();
    expect(kingAttacked(after, "w") || kingAttacked(after, "b")).toBe(false);
  });
});

describe("Rising Dough in a battle", () => {
  it("?power=dough: a pawn's lump at the end of his first turn (from 1.e4 d5 2.exd5 Qxd5), its timer at doughTimers.p, a minute off each move, and it rises at 00:00 unless squashed", async () => {
    // (The crowd keeps clear of the lump: its moves never land on it.)
    let rose = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = battle(seed, { test: "dough" });
      const avoid = (fen: string, allowed: string[]) => {
        const lumps = new Set(zOf(r).lumps.map((l) => l.square));
        const ok = allowed.filter((m) => !lumps.has(m.slice(2, 4)));
        return crowdPick(fen, ok.length ? ok : allowed, mulberry32(fen.length + seed));
      };
      await crowdMove(r, avoid);
      await r.playBoss(fakeEngine());
      const z = zOf(r);
      expect(z.drops).toBe(1);
      const lump = z.lumps[0]!;
      expect(lump).toMatchObject({ n: 0, slot: 0, piece: "p", left: S.doughTimers.p, at: 1 });
      expect(r.boss!.powers!.events.find((e) => e.kind === "doughDrop")).toMatchObject({ square: lump.square, shape: "p" });
      // (A minute off each move, yours and his, down to his move at 0, and it rises after his move unless a guard holds it.)
      const lefts: number[] = [];
      for (let i = 0; i < S.doughTimers.p / 2; i++) {
        await crowdMove(r, avoid);
        lefts.push(zOf(r).lumps.find((l) => l.n === 0)?.left ?? -1);
        if (r.isOver() || !r.bossToMove()) break;
        await r.playBoss(fakeEngine());
        lefts.push(zOf(r).lumps.find((l) => l.n === 0)?.left ?? -1);
      }
      const up = zOf(r).rises.find((x) => x.n === 0);
      if (up) {
        rose++;
        expect(lefts).toEqual([...Array.from({ length: S.doughTimers.p - 1 }, (_, i) => S.doughTimers.p - 1 - i), -1]);
        expect(up).toMatchObject({
          side: "boss",
          piece: "p",
          square: lump.square,
        });
        expect(pieceAt(fenOf(r), lump.square)).toEqual({
          color: "b",
          type: "p",
        });
        expect(r.boss!.powers!.events.some((e) => e.kind === "doughRise" && e.square === lump.square)).toBe(true);
        expect(powerTurn(r.boss)).toBe(true);
      } else expect(lefts.slice(0, 3)).toEqual([S.doughTimers.p - 1, S.doughTimers.p - 2, S.doughTimers.p - 3]);
    }
    expect(rose).toBeGreaterThan(2);
  });

  it("your piece landing on a lump squashes it (gone, a moment as your move lands); his pieces never move onto one", async () => {
    const r = battle(7);
    // (A lump on e5, a knight of yours on f3 can land on it.)
    onPosition(r, QUIET_W, "w", {
      lumps: [{ n: 0, slot: 0, piece: "n", square: "e5", left: 6, at: 0 }],
      drops: 1,
    });
    expect(stopReason(r.boss, QUIET_W, "f3e5")).toBeNull();
    await crowdMove(r, () => "f3e5");
    expect(zOf(r).lumps).toEqual([]);
    expect(zOf(r).squashes.at(-1)).toMatchObject({
      side: "crowd",
      square: "e5",
      piece: "n",
    });
    expect(r.boss!.powers!.events.at(-1)).toMatchObject({
      kind: "doughSquash",
      square: "e5",
      shape: "n",
    });
    expect(zebraTurnMs(r.boss)).toBe(ZEBRA_FX.doughSquash);
    // (His move onto a lump: never, unless it's his only one.)
    const his = "r1bqkb1r/pp3ppp/2n1pn2/3p4/3P4/2N1PN2/PP3PPP/R1BQKB1R b KQkq - 0 7";
    onPosition(r, his, "w", {
      lumps: [{ n: 1, slot: 0, piece: "p", square: "e5", left: 3, at: 1 }],
    });
    expect(legalMoves(his)).toContain("f6e4");
    const allowed = bossAllowed(r.boss, his)!;
    expect(allowed.some((m) => m.slice(2, 4) === "e5")).toBe(false);
    expect(legalMoves(his).some((m) => m.slice(2, 4) === "e5")).toBe(true);
    expect(
      stopReason(
        {
          id: "zebra",
          powers: { zebra: { his: "b", lumps: [{ square: "e5" }], gold: [] } },
        },
        his,
        "c6e5",
      ),
    ).toBe("dough");
  });

  it("a lump at 00:00 after your move rises before his move (he can play it); one a guard holds waits, then rises after the next move", async () => {
    const r = battle(8);
    onPosition(r, QUIET_W, "w", {
      lumps: [{ n: 0, slot: 0, piece: "b", square: "a6", left: 1, at: 0 }],
      drops: 1,
    });
    await crowdMove(r, (_, allowed) => allowed.find((m) => m === "a2a3") ?? allowed[0]!);
    expect(zOf(r).rises.at(-1)).toMatchObject({
      side: "crowd",
      square: "a6",
      piece: "b",
    });
    expect(pieceAt(fenOf(r), "a6")).toEqual({ color: "b", type: "b" });
    expect(sideToMove(fenOf(r))).toBe("b");
    expect(r.boss!.powers!.events.at(-1)).toMatchObject({
      kind: "doughRise",
      square: "a6",
      shape: "b",
    });
    expect(zebraTurnMs(r.boss)).toBe(ZEBRA_FX.doughRise);
    // (A knight that would rise on d3 with your king on e1 would check it: it waits at 00:00.)
    const r2 = battle(9);
    onPosition(r2, QUIET_W, "w", {
      lumps: [{ n: 0, slot: 0, piece: "n", square: "d3", left: 1, at: 0 }],
      drops: 1,
    });
    await crowdMove(r2, (_, allowed) => allowed.find((m) => m === "a2a3")!);
    expect(zOf(r2).lumps).toMatchObject([{ n: 0, left: 0, square: "d3" }]);
    expect(pieceAt(fenOf(r2), "d3")).toBeNull();
  });

  it("drops a few times early on, never more than doughDrops, never after doughLast, at most doughLive at once: each a kind he can have, on a square the rules allow", async () => {
    let drops = 0;
    for (const seed of [11, 12, 13, 14]) {
      const r = battle(seed);
      for (let i = 0; i < 30 && !r.isOver(); i++) {
        await crowdMove(r);
        if (r.isOver() || !r.bossToMove()) break;
        await r.playBoss(fakeEngine());
        const z = zOf(r);
        expect(z.lumps.length).toBeLessThanOrEqual(S.doughLive);
        expect(z.drops).toBeLessThanOrEqual(S.doughDrops);
        if (z.drop && z.drop.at === r.boss!.crowdMoves) {
          expect(z.drop.at).toBeLessThanOrEqual(S.doughLast);
          expect(pieceAt(fenOf(r), z.drop.square)).toBeNull();
        }
        for (const l of z.lumps) expect(pieceAt(fenOf(r), l.square)).toBeNull();
      }
      drops += zOf(r).drops;
    }
    expect(drops).toBeGreaterThan(0);
  });
});

describe("Gold Plate", () => {
  it("?power=goldplate: warned as the second turn begins, his queen gilded at the start of his turn after it (his turn goes on), the meter spent", async () => {
    const r = battle(21, { test: "goldplate" });
    await crowdMove(r);
    await r.playBoss(fakeEngine());
    expect(r.boss!.powers!.events.some((e) => e.kind === "warn")).toBe(true);
    await crowdMove(r);
    const z = zOf(r);
    expect(z.gilds).toHaveLength(1);
    const g = z.gilds[0]!;
    expect(g.piece).toBe("q");
    expect(pieceAt(fenOf(r), g.square!)).toEqual({ color: "b", type: "q" });
    expect(z.gold).toEqual([g.square]);
    expect(r.boss!.powers!.events.at(-1)).toMatchObject({
      kind: "goldPlate",
      square: g.square,
      shape: "q",
    });
    expect(zebraTurnMs(r.boss)).toBeGreaterThanOrEqual(ZEBRA_FX.goldPlate);
    expect(r.bossToMove()).toBe(true);
    expect(r.boss!.powers!.ults).toBe(1);
    expect(zebraEvents(r.boss!.powers!.events).map((e) => e.kind)).toContain("goldPlate");
  });

  it("the admins' trigger brings one Gold Plate at the start of his next turn, spent with it (never again from the same pull)", async () => {
    const r = battle(24, { test: "dough" });
    await crowdMove(r);
    await r.playBoss(fakeEngine());
    r.triggerUltimate();
    expect(r.boss!.powers!.ultNext).toBe(true);
    const gilds: number[] = [];
    for (let i = 0; i < 5 && !r.isOver(); i++) {
      await crowdMove(r);
      gilds.push(zOf(r).gilds.length);
      expect(r.boss!.powers!.ultNext).toBeFalsy();
      if (r.isOver() || !r.bossToMove()) break;
      await r.playBoss(fakeEngine());
    }
    expect(gilds[0]).toBe(1);
    expect(gilds.at(-1)).toBe(1);
  });

  it("your pawns can't take a gold piece (the allowed moves, the judge's too); your other pieces can; the rule lifts on a turn it would leave no move", () => {
    const r = battle(22);
    // (His queen on d5, gold; your pawns on c4 and e4 and your knight on c3 attack it.)
    const fen = "r1b1kb1r/ppp2ppp/2n2n2/3q4/2P1P3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 6";
    onPosition(r, fen, "w", { gold: ["d5"] });
    const allowed = crowdAllowed(r.boss, fen)!;
    expect(allowed).not.toContain("c4d5");
    expect(allowed).not.toContain("e4d5");
    expect(allowed).toContain("c3d5");
    expect(stopReason(r.boss, fen, "e4d5")).toBe("gold");
    expect(stopReason(r.boss, fen, "c3d5")).toBeNull();
    // (Your only move a pawn's capture of his gold piece: it lifts. His gold rook on h3 checks your king on h1; g1 is his
    // bishop's; only gxh3.)
    const only = "6k1/8/8/2b5/8/7r/6P1/7K w - - 0 40";
    expect(legalMoves(only)).toEqual(["g2h3"]);
    onPosition(r, only, "w", { gold: ["h3"] });
    expect(crowdAllowed(r.boss, only)).toBeNull();
  });

  it("the gold follows the piece: his moves (castling too) carry it, a capture of it ends it; a second Gold Plate gilds his strongest piece that isn't gold", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R b kq - 0 20";
    expect(goldAfter(fen, "h8h5", ["h8"])).toEqual(["h5"]);
    expect(goldAfter(fen, "e8g8", ["h8"])).toEqual(["f8"]);
    expect(goldAfter(fen, "e8c8", ["a8", "h8"])).toEqual(["d8", "h8"]);
    expect(goldAfter("4k3/8/8/8/8/8/8/R3K2r w - - 0 20", "a1h1", ["h1"])).toEqual([]);
    const two = "r1bqkb1r/pp3ppp/2n1pn2/3p4/3P4/2N1PN2/PP3PPP/R1BQKB1R w KQkq - 0 7";
    expect(gildPick(two, "b", [], 1, 0)).toEqual({ square: "d8", piece: "q" });
    expect(gildPick(two, "b", ["d8"], 1, 1)!.piece).toBe("r");
    expect(gildPick("4k3/pppp4/8/8/8/8/8/4K3 w - - 0 30", "b", [], 1, 0)).toBeNull();
  });

  it("a turn a pawn of yours could take a gold piece doesn't count for fair play", async () => {
    const r = battle(23);
    const fen = "r1b1kb1r/ppp2ppp/2n2n2/3q4/2P1P3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 6";
    onPosition(r, fen, "w", { gold: ["d5"] });
    // (Your quiet move, then his keeps the queen on d5: a knight's.)
    await crowdMove(r, () => "a2a3");
    expect(r.bossToMove()).toBe(true);
    r.applyBossMove("f6g4");
    expect(zOf(r).goldTurn).toBe(r.boss!.crowdMoves + 1);
    expect(powerTurn(r.boss)).toBe(true);
  });
});

describe("his opening comment", () => {
  const lib: Opening[] = [
    {
      id: "x",
      eco: "C50",
      name: "Italian Game",
      names: {
        0: "Starting position",
        1: "King's Pawn Game",
        3: "King's Knight Opening",
        5: "Italian Game",
      },
      family: "Italian Game",
      unusual: false,
      moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5"],
      namedPlies: 5,
      expected: { 0: 0.5 },
    },
    {
      id: "y",
      eco: "B20",
      name: "Sicilian Defense",
      names: { 0: "Starting position", 2: "Sicilian Defense" },
      family: "Sicilian Defense",
      unusual: false,
      moves: ["e2e4", "c7c5", "g1f3"],
      namedPlies: 2,
      expected: { 0: 0.5 },
    },
  ];

  it("names the moves by the library: the longest named line they start with; none: null", () => {
    expect(openingNameFor(["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6"], lib)).toBe("Italian Game");
    expect(openingNameFor(["e2e4", "e7e5", "g1f3", "g8f6"], lib)).toBe("King's Knight Opening");
    expect(openingNameFor(["e2e4", "c7c5", "b1c3"], lib)).toBe("Sicilian Defense");
    expect(openingNameFor(["d2d4"], lib)).toBeNull();
    expect(openingNameFor([], lib)).toBeNull();
  });

  it("comes once a battle, as a turn from the second on begins with the game at move 4: the library's name and a line", async () => {
    const r = battle(31, { library: [...lib, KIT_OPENING] });
    const talks: { turn: number; opening?: string; move: number }[] = [];
    for (let i = 0; i < 8 && !r.isOver(); i++) {
      await crowdMove(r);
      if (r.isOver() || !r.bossToMove()) break;
      await r.playBoss(fakeEngine());
      for (const e of r.boss!.powers!.events)
        if (e.kind === "openingTalk")
          talks.push({
            turn: e.turn,
            ...(e.opening ? { opening: e.opening } : {}),
            move: Number(fenOf(r).split(" ")[5]),
          });
    }
    expect(talks).toHaveLength(1);
    expect(talks[0]!.turn).toBeGreaterThanOrEqual(2);
    expect(talks[0]!.move).toBe(4);
    expect(zOf(r).talk!.pick).toBeGreaterThanOrEqual(0);
  });
});
