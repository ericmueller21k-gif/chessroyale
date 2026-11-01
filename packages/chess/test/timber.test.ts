import { describe, expect, it } from "vitest";
import { BOSS_ADMIN_FIRST, BOSS_POWERS, BOSS_ROSTER, WORKSHOP_PIECES, adminFirst, isPlayable, menuBosses, mulberry32, type BossPowerState } from "@chessroyale/core";
import {
  MatchRunner,
  POWER_FX,
  TIMBER_FX,
  addScraps,
  costOf,
  dropSquare,
  finished,
  freshWorkshop,
  gnawPick,
  kingAttacked,
  legalMoves,
  pieceAt,
  powerTurn,
  scrapTarget,
  sideToMove,
  stockfishRefuses,
  timberEvents,
  workshopAt,
  workshopClosed,
} from "../src/index.ts";
import { ticksAt } from "../src/bosses/base.ts";
import { KIT_OPENING, crowdPick, fakeEngine, kitSettings } from "./boss-kit-lib.ts";

/**
 * Timber, the beaver builder (docs/decisions/2026-11-01-timber.md): Scraps (a real-time meter: a scrap every 15 s, 2 for each
 * capture of his; each to a random unfinished piece of five, pawn 2, knight 4, bishop 4, rook 6, queen 12; a finished one
 * dropped on his half at the end of his turn, one a turn, a cap a battle) and Gnaw (after the usual warning, after his move:
 * one of your pawns eaten, 8 scraps).
 */

const S = BOSS_POWERS;
const EVERY = S.scrapEverySec * 1000;

type Battle = { r: MatchRunner; tick: (ms: number) => void };

function battle(seed: number, opts: { test?: string; side?: "w" | "b" } = {}): Battle {
  let t = 100_000;
  const settings = kitSettings({ boss: "timber", test: opts.test ?? "", maxMoves: 60 });
  const r = new MatchRunner({ settings, rng: mulberry32(seed), engines: [fakeEngine()], library: [KIT_OPENING], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: opts.side ?? "w", clock: () => t });
  return { r, tick: (ms) => void (t += ms) };
}
const fenOf = (r: MatchRunner) => r.boards.get(r.state.boards[0]!)!.fen;
const powersOf = (r: MatchRunner) => r.boss!.powers!;

async function crowdMove(r: MatchRunner, pick?: (fen: string, allowed: string[]) => string) {
  r.deal();
  const fen = fenOf(r);
  const allowed = r.crowdAllowed() ?? legalMoves(fen);
  const move = pick ? pick(fen, allowed) : crowdPick(fen, allowed, mulberry32(fen.length * 31 + allowed.length));
  await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
  return move;
}

function onPosition(r: MatchRunner, fen: string, crowd: "w" | "b", patch: Partial<BossPowerState> = {}) {
  const id = r.state.boards[0]!;
  const board = r.boards.get(id)!;
  r.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== board.history.length), { ply: board.history.length, fen }] });
  const boss = r.state.boss!;
  r.state = { ...r.state, boss: { ...boss, crowdSide: crowd, powers: { ...boss.powers!, ...patch } } };
}

/** A quiet middlegame, him (Black) to move, a pawn and a knight of his gone: any piece of the workshop can drop. */
const QUIET_B = "r1bqkb1r/pp3pp1/2p1pn2/3p4/3P4/2P1PN2/PP3PPP/RNBQKB1R b KQkq - 0 6";

describe("Timber's sheet", () => {
  it("is on the roster with Scraps and Gnaw, admins first", () => {
    const def = BOSS_ROSTER.find((d) => d.id === "timber")!;
    expect(def).toMatchObject({ name: "Timber", kit: "Timber", powers: { passive: "scraps", ultimate: "gnaw" } });
    expect(BOSS_ADMIN_FIRST).toContain("timber");
    expect(adminFirst(def)).toBe(true);
    expect(isPlayable(def)).toBe(false);
    expect(menuBosses({ admin: false, raid: true }).some((d) => d.id === "timber")).toBe(false);
    expect(menuBosses({ admin: false, raid: false }).some((d) => d.id === "timber")).toBe(false);
    expect(menuBosses({ admin: true, raid: true }).some((d) => d.id === "timber")).toBe(true);
    expect(menuBosses({ admin: true, raid: false }).some((d) => d.id === "timber")).toBe(true);
  });

  it("has Eric's numbers: a scrap every 15 s, 2 a capture, 8 a Gnaw; pawn 2, knight 4, bishop 4, rook 6, queen 12", () => {
    expect(S.scrapEverySec).toBe(15);
    expect(S.scrapsPerCapture).toBe(2);
    expect(S.gnawScraps).toBe(8);
    expect(WORKSHOP_PIECES.map((p) => costOf(p))).toEqual([2, 4, 4, 6, 12]);
    expect(S.workshopDropMax).toBeGreaterThan(0);
    expect(POWER_FX.build).toBe(TIMBER_FX.build);
    expect(POWER_FX.gnaw).toBe(TIMBER_FX.gnaw);
  });
});

describe("the real-time meter (one block for every boss on real time)", () => {
  it("counts ticks from `since`, one every `every`, and says when the next lands", () => {
    expect(ticksAt(1000, 1000, 15_000)).toEqual({ ticks: 0, next: 16_000 });
    expect(ticksAt(1000, 15_999, 15_000)).toEqual({ ticks: 0, next: 16_000 });
    expect(ticksAt(1000, 16_000, 15_000)).toEqual({ ticks: 1, next: 31_000 });
    expect(ticksAt(1000, 0, 15_000).ticks).toBe(0);
  });
});

describe("the workshop", () => {
  it("lands a scrap every 15 s on the clock, each on an unfinished piece, the same wherever it's worked out", () => {
    const w = freshWorkshop(7, 0);
    expect(workshopAt(w, EVERY - 1).landed).toBe(0);
    const a = workshopAt(w, 10 * EVERY);
    expect(a.landed).toBe(10);
    expect(a.prog.reduce((x, y) => x + y, 0)).toBe(10);
    expect(a.next).toBe(11 * EVERY);
    // (In two steps it's the same as in one.)
    const half = workshopAt(w, 4 * EVERY + 300);
    const b = workshopAt({ ...w, prog: half.prog, n: half.n, since: half.since }, 10 * EVERY);
    expect(b.prog).toEqual(a.prog);
    expect(b.n).toBe(a.n);
  });

  it("never puts a scrap on a finished piece, and wastes one when every piece is finished", () => {
    const full = WORKSHOP_PIECES.map((p) => costOf(p));
    expect(scrapTarget(1, 0, full)).toBe(-1);
    const prog = [2, 4, 0, 6, 12];
    for (let i = 0; i < 50; i++) expect(scrapTarget(3, i, prog)).toBe(2);
    const p2 = [0, 0, 0, 0, 0];
    addScraps(9, 0, p2, 200);
    p2.forEach((x, k) => expect(x).toBe(costOf(WORKSHOP_PIECES[k]!)));
    expect(finished(p2)).toEqual([0, 1, 2, 3, 4]);
    // (In the order they finished.)
    const p3 = [0, 0, 0, 0, 0];
    const done: number[] = [];
    addScraps(9, 0, p3, 200, undefined, done);
    expect([...done].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(finished(p3, done)).toEqual(done);
  });

  it("closes after its last drop: no more scraps", () => {
    const w = { ...freshWorkshop(1, 0), drops: S.workshopDropMax };
    expect(workshopClosed(w)).toBe(true);
    expect(workshopAt(w, 100 * EVERY)).toMatchObject({ landed: 0, next: null });
  });

  it("drops onto an empty square of his half the crowd doesn't attack, a legal position with no check", () => {
    for (const piece of WORKSHOP_PIECES) {
      const fen = QUIET_B.replace(" b ", " w ");
      const d = dropSquare(fen, piece, 5, 0);
      expect(d, piece).not.toBeNull();
      expect(Number(d!.square[1])).toBeGreaterThanOrEqual(5);
      expect(pieceAt(fen, d!.square)).toBeNull();
      expect(pieceAt(d!.fen, d!.square)).toEqual({ color: "b", type: piece });
      if (piece === "p") expect(d!.square[1]).not.toBe("8");
      expect(stockfishRefuses(d!.fen)).toBeNull();
      expect(kingAttacked(d!.fen, "w") || kingAttacked(d!.fen, "b")).toBe(false);
    }
  });

  it("can't drop anything while he has his whole army (a ninth pawn, a third knight with eight pawns: positions the engine refuses)", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1";
    for (const piece of WORKSHOP_PIECES) expect(dropSquare(fen, piece, 5, 0), piece).toBeNull();
  });
});

describe("in a battle", () => {
  it("?power=scraps: his finished pawn drops at the end of his first turn, a build moment as the crowd's next turn begins", async () => {
    const b = battle(3, { test: "scraps" });
    await crowdMove(b.r);
    await b.r.playBoss(fakeEngine());
    const w = powersOf(b.r).workshop!;
    expect(w.drops).toBe(1);
    expect(w.last).toMatchObject({ at: 1, piece: "p" });
    expect(w.prog[0]).toBe(0);
    const fen = fenOf(b.r);
    expect(pieceAt(fen, w.last!.square)).toEqual({ color: "b", type: "p" });
    expect(stockfishRefuses(fen)).toBeNull();
    expect(timberEvents(powersOf(b.r).events)).toEqual([{ kind: "build", turn: 2, square: w.last!.square, shape: "p" }]);
    expect(powerTurn(b.r.boss)).toBe(true);
    // (A base at its ply: the replay reproduces the position.)
    const board = b.r.boards.get(b.r.state.boards[0]!)!;
    expect(board.bases?.at(-1)).toEqual({ ply: board.history.length, fen });
  });

  it("drops at most one piece a turn, the first finished he can have, and starts its slot over", async () => {
    const b = battle(4);
    await crowdMove(b.r);
    const full = WORKSHOP_PIECES.map((p) => costOf(p));
    onPosition(b.r, QUIET_B, "w", { workshop: { ...powersOf(b.r).workshop!, prog: [...full], done: [4, 1, 0, 2, 3], since: 1e12 } });
    await b.r.playBoss(fakeEngine());
    const w = powersOf(b.r).workshop!;
    expect(w.drops).toBe(1);
    expect(w.last!.piece).toBe("q");
    expect(w.prog).toEqual([2, 4, 4, 6, 0]);
    expect(w.done).toEqual([1, 0, 2, 3]);
  });

  it("a capture of his: 2 scraps", async () => {
    const b = battle(5);
    await crowdMove(b.r);
    // (Black to move with a free pawn on e5 for his knight on f6... his only capture: Nxe4.)
    onPosition(b.r, "rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2", "w", { workshop: { ...powersOf(b.r).workshop!, since: 1e12 } });
    const before = powersOf(b.r).workshop!.n;
    b.r.applyBossMove("f6e4");
    const w = powersOf(b.r).workshop!;
    expect(w.n - before).toBe(S.scrapsPerCapture);
    expect(w.bonus).toEqual({ at: 1, scraps: S.scrapsPerCapture, from: "capture" });
  });

  it("?power=gnaw: warned as turn 2 begins; after his next move one of your pawns is eaten, 8 scraps, the meter spent", async () => {
    const b = battle(6, { test: "gnaw" });
    await crowdMove(b.r);
    await b.r.playBoss(fakeEngine());
    expect(powersOf(b.r).events.some((e) => e.kind === "warn")).toBe(true);
    await crowdMove(b.r);
    const pawns = (fen: string) => fen.split(" ")[0]!.split("").filter((c) => c === "P").length;
    const before = pawns(fenOf(b.r));
    b.tick(1);
    await b.r.playBoss(fakeEngine());
    const p = powersOf(b.r);
    expect(pawns(fenOf(b.r))).toBe(before - 1);
    expect(p.ults).toBe(1);
    expect(p.workshop!.gnaw).toMatchObject({ at: 2, scraps: S.gnawScraps });
    const g = p.workshop!.gnaw!;
    expect(pieceAt(fenOf(b.r), g.square!)).toBeNull();
    expect(timberEvents(p.events)).toContainEqual({ kind: "gnaw", turn: 3, square: g.square, scraps: S.gnawScraps });
    expect(stockfishRefuses(fenOf(b.r))).toBeNull();
    // (Then the meter fills again from empty.)
    await crowdMove(b.r);
    expect(powersOf(b.r).ultAt).toBeUndefined();
  });

  it("Gnaw with none of your pawns left eats nothing (said on screen); one whose going would check you is never picked", () => {
    expect(gnawPick("4k3/8/8/8/8/8/8/4K3 w - - 0 40", 1, 0)).toBe("none");
    // (The e2 pawn shields White's king from the rook on e8: only the a2 pawn may go.)
    for (let seed = 0; seed < 20; seed++) {
      const pick = gnawPick("4r1k1/8/8/8/8/8/P3P3/4K3 w - - 0 40", seed, 0);
      expect(pick).not.toBe("none");
      expect((pick as { square: string }).square).toBe("a2");
    }
    // (The only pawn shields the king: none qualifies, it waits.)
    expect(gnawPick("4r1k1/8/8/8/8/8/4P3/4K3 w - - 0 40", 1, 0)).toBeNull();
  });

  it("plays a long battle by the rules: drops only on his half, never more than the cap, every position one the engine plays", async () => {
    const b = battle(11, { side: "b" });
    for (let i = 0; i < 80 && !b.r.isOver() && !b.r.boss!.result; i++) {
      b.tick(20_000);
      if (b.r.bossToMove()) await b.r.playBoss(fakeEngine());
      else if (b.r.boss!.crowdMoves >= 50) break;
      else await crowdMove(b.r);
      const fen = fenOf(b.r);
      expect(stockfishRefuses(fen)).toBeNull();
      expect(kingAttacked(fen, sideToMove(fen) === "w" ? "b" : "w")).toBe(false);
      const w = powersOf(b.r).workshop!;
      expect(w.drops).toBeLessThanOrEqual(S.workshopDropMax);
      if (w.last) expect(["1", "2", "3", "4"]).toContain(w.last.square[1]);
    }
  });
});
