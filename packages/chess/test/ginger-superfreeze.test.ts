import { describe, expect, it } from "vitest";
import { BOSS_POWERS, mulberry32, type PowerEvent, type SuperFreezeState } from "@chessroyale/core";
import {
  GINGER_FX,
  MatchRunner,
  POWER_FX,
  SUPER_FREEZE_BEATS,
  bossThinkMs,
  chooseSuperFreeze,
  gingerTurnMs,
  heldIn,
  inCheck,
  legalMoves,
  pieceAt,
  powerFxMs,
  superBox,
  superHeld,
  superMeter,
  superNeed,
  type EngineLike,
} from "../src/index.ts";
import { KIT_OPENING, crowdPick, fakeEngine, kitSettings } from "./boss-kit-lib.ts";

/**
 * Ginger's Super Freeze (Eric, Nov 18; docs/decisions/2026-11-18-ginger-super-freeze.md): a second meter, full around crowd turns 8
 * to 15; as the crowd's move lands on the turn it's full (the start of his turn) the crowd's piece whose 3 x 3 holds the most of the
 * crowd's pieces is picked, and every one of the crowd's pieces in that 3 x 3 but the king is frozen for the crowd's next turn (the
 * farthest from the middle let go first until a legal move is left), then thaws as his turn starts; at most twice a battle; never on
 * the blizzard's turns. Real battles through the match runner, no test switch, unless a test says so.
 */

const fenOf = (r: MatchRunner) => r.boards.get(r.state.boards[0]!)!.fen;
const superOf = (r: MatchRunner): SuperFreezeState | null => r.state.boss?.powers?.superFreeze ?? null;
const from = (m: string) => m.slice(0, 2);

/** A battle through the match runner on the stand-in engine (the kit's), Ginger met as the test link does. */
function battle(seed: number, test = "", maxMoves = 60, engines: EngineLike[] = [fakeEngine()]) {
  const settings = kitSettings({ boss: "gingerbread", test, maxMoves });
  return new MatchRunner({ settings, rng: mulberry32(seed), engines, library: [KIT_OPENING], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: "w" });
}

/** What each crowd turn looked like as it was picked: its number, the position, the moves allowed, the pieces the Super Freeze held. */
interface Seen {
  turn: number;
  fen: string;
  allowed: string[] | null;
  held: string[];
  events: PowerEvent[];
  /** The meter as the screens show it, and whether it waits for the blizzard. */
  meter: number | null;
  waiting: boolean;
  used: number;
}

/** A whole battle (the crowd's moves picked at random from its allowed ones, `seed`'s), with every crowd turn and Super Freeze seen. */
async function playThrough(seed: number, test = "", maxMoves = 60) {
  const r = battle(seed, test, maxMoves);
  const rng = mulberry32(seed * 31 + 7);
  const turns: Seen[] = [];
  const fired: { after: number; event: PowerEvent; fen: string }[] = [];
  let guard = 0;
  while (!r.isOver() && !r.stageComplete() && guard++ < 400) {
    if (r.bossToMove()) {
      const boss = r.state.boss!;
      const ev = boss.powers!.events.find((e) => e.kind === "superFreeze" && boss.powers!.superFreeze?.hit?.at === boss.crowdMoves);
      if (ev && !fired.some((f) => f.after === boss.crowdMoves)) fired.push({ after: boss.crowdMoves, event: ev, fen: fenOf(r) });
      await r.playBoss();
      continue;
    }
    r.deal();
    const fen = fenOf(r);
    const allowed = r.crowdAllowed();
    const view = r.bossView()!.powers!;
    turns.push({ turn: r.state.boss!.crowdMoves + 1, fen, allowed, held: view.superFreeze?.held ?? [], events: view.events, meter: view.superFreeze?.meter ?? null, waiting: !!view.superFreeze?.waiting, used: view.superFreeze?.used ?? 0 });
    const move = crowdPick(fen, allowed ?? legalMoves(fen), rng);
    await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
  }
  return { r, turns, fired };
}

describe("Ginger's Super Freeze: the target and its 3 x 3", () => {
  it("the 3 x 3 round a square, cut at the board's edge", () => {
    expect(superBox("e4")).toEqual(["d3", "d4", "d5", "e3", "e4", "e5", "f3", "f4", "f5"]);
    expect(superBox("a1")).toEqual(["a1", "a2", "b1", "b2"]);
    expect(superBox("h5")).toEqual(["g4", "g5", "g6", "h4", "h5", "h6"]);
  });

  it("picks the crowd's piece whose 3 x 3 holds the most of its pieces (never the king), and freezes those (the king never)", () => {
    // White: a clump round c2 (b1 knight, b2, c2, d2 pawns, c1 bishop, d1 queen) and the king on e1 beside it; a lone rook on h4.
    const fen = "4k3/8/8/8/7R/8/1PPP4/1NBQK3 b - - 0 1";
    const pick = chooseSuperFreeze(fen, "w", 7, 0)!;
    // c2's 3 x 3 (b1 c1 d1 b2 c2 d2 b3 c3 d3): six pieces; d2's holds five (the king on e1 isn't counted); c1's, d1's fewer.
    expect(pick.target).toBe("c2");
    expect(pick.squares).toEqual(["b1", "b2", "c1", "c2", "d1", "d2"]);
    for (const seed of [1, 2, 3, 4, 5]) {
      const p = chooseSuperFreeze(fen, "w", seed, 0)!;
      expect(pieceAt(fen, p.target)?.type).not.toBe("k");
      expect(p.squares.every((sq) => pieceAt(fen, sq)?.color === "w" && pieceAt(fen, sq)?.type !== "k")).toBe(true);
    }
  });

  it("ties go to the seed (the same on every device), and only the king left: none", () => {
    // Two equal clumps (a2 b2 and g2 h2 pawns, kings apart): either may be picked, the same for the same seed.
    const fen = "4k3/8/8/8/8/8/PP4PP/4K3 b - - 0 1";
    const picks = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const a = chooseSuperFreeze(fen, "w", seed, 0)!;
      expect(chooseSuperFreeze(fen, "w", seed, 0)).toEqual(a);
      expect(a.squares.length).toBe(2);
      picks.add(a.target);
    }
    expect(picks.size).toBeGreaterThan(1);
    expect(chooseSuperFreeze("4k3/8/8/8/8/8/8/4K3 b - - 0 1", "w", 1, 0)).toBeNull();
  });

  it("a legal move always left: the farthest from the middle let go first (a corner before an edge), in check the answers too", () => {
    // The white king boxed in by his own pieces (a1 king; a2, b2 pawns, b1 knight): all three held leaves no move at all.
    const boxed = "4k3/8/8/8/8/8/PP6/KN6 w - - 0 1";
    const held = superHeld(boxed, "w", "b2", ["a2", "b1", "b2"], 3, 5);
    expect(held.length).toBe(2);
    expect(legalMoves(boxed).some((m) => !heldIn(boxed, m, held))).toBe(true);
    // (b2 is the middle: a2 and b1 are both at distance 1, so one of them goes, from the seed; b2 stays.)
    expect(held).toContain("b2");
    // In check (the d3 knight on e1, the king boxed in), only the answers count: c2 or e2 taking it.
    const inCheckFen = "4k3/8/8/8/8/3n4/2PPP3/RNBQKB2 w - - 0 1";
    expect(inCheck(inCheckFen)).toBe(true);
    const all = ["c2", "d2", "e2", "d1", "f1", "c1", "b1"];
    const h = superHeld(inCheckFen, "w", "d2", all, 1, 1);
    expect(legalMoves(inCheckFen).some((m) => !heldIn(inCheckFen, m, h))).toBe(true);
    expect(h).not.toContain("e1");
    expect(h.includes("c2") && h.includes("e2")).toBe(false);
  });

  it("an iced rook can't castle (the held pieces' rule)", () => {
    const fen = "4k3/8/8/8/8/8/5PPP/4K2R w K - 0 1";
    const held = superHeld(fen, "w", "g2", ["f2", "g2", "h2", "h1"], 1, 1);
    expect(held).toContain("h1");
    expect(legalMoves(fen).filter((m) => !heldIn(fen, m, held))).not.toContain("e1g1");
  });
});

describe("Ginger's Super Freeze: the meter", () => {
  it("fills over a number of crowd moves drawn from the seed in 8 to 15 (the test switch: 1, then 2)", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 200; seed++)
      for (const n of [0, 1]) {
        const need = superNeed(seed, n, "");
        expect(need).toBeGreaterThanOrEqual(BOSS_POWERS.superFreezeEvery[0]);
        expect(need).toBeLessThanOrEqual(BOSS_POWERS.superFreezeEvery[1]);
        seen.add(need);
      }
    expect(seen.size).toBe(8);
    expect(superNeed(5, 0, "superfreeze")).toBe(1);
    expect(superNeed(5, 1, "superfreeze")).toBe(2);
  });

  it("reads 0 to 1 as the crowd turns go by, full on the turn it comes, empty for good once spent", () => {
    const sf: SuperFreezeState = { since: 0, need: 10, used: 0, hit: null };
    expect(superMeter({ superFreeze: sf }, 1)).toBeCloseTo(0.1);
    expect(superMeter({ superFreeze: sf }, 10)).toBe(1);
    expect(superMeter({ superFreeze: { ...sf, since: 10, used: 1 } }, 11)).toBeCloseTo(0.1);
    expect(superMeter({ superFreeze: { ...sf, used: BOSS_POWERS.superFreezeMax } }, 30)).toBe(0);
    expect(superMeter({}, 3)).toBeNull();
  });
});

describe("Ginger's Super Freeze in real battles (no test switch)", () => {
  it("comes first between crowd moves 8 and 15 (later only while the blizzard holds it), at most twice a battle, frozen pieces held exactly the crowd's next turn, never the king, a move always left", async () => {
    const firsts: number[] = [];
    let twice = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { turns, fired, r } = await playThrough(seed);
      expect(fired.length).toBeLessThanOrEqual(BOSS_POWERS.superFreezeMax);
      if (fired.length === 2) twice++;
      const sf = superOf(r);
      const first = fired[0];
      if (first) {
        firsts.push(first.after);
        // (The blizzard's warning or ice delays it; else it comes on the move its meter fills: 8 to 15.)
        expect(first.after).toBeGreaterThanOrEqual(BOSS_POWERS.superFreezeEvery[0]);
        expect(first.after).toBeLessThanOrEqual(BOSS_POWERS.superFreezeEvery[1] + 4);
      } else expect(turns.length).toBeLessThan(BOSS_POWERS.superFreezeEvery[1] + 4);
      for (const f of fired) {
        // Its target and pieces: the crowd's, never the king, the 3 x 3 with the most.
        const { square, squares } = f.event;
        expect(pieceAt(f.fen, square!)?.color).toBe("w");
        expect(squares!.every((sq) => pieceAt(f.fen, sq)?.color === "w" && pieceAt(f.fen, sq)?.type !== "k")).toBe(true);
        expect(chooseSuperFreeze(f.fen, "w", r.state.boss!.powers!.seed, fired.indexOf(f))!.target).toBe(square);
        // Held on the crowd's next turn: none of their moves allowed, a move still left; never on the blizzard's turns.
        const next = turns.find((t) => t.turn === f.after + 1);
        if (!next) continue;
        expect(next.held.every((sq) => squares!.includes(sq))).toBe(true);
        const allowed = next.allowed ?? legalMoves(next.fen);
        expect(allowed.length).toBeGreaterThan(0);
        for (const sq of next.held) expect(allowed.some((m) => from(m) === sq)).toBe(false);
        expect(next.events.some((e) => e.kind === "blizzard" || e.kind === "thaw")).toBe(false);
        // Thawed as his turn starts: the turn after, nothing of it held.
        const after = turns.find((t) => t.turn === f.after + 2);
        if (after) expect(after.held).toEqual([]);
      }
      if (sf) expect(sf.used).toBe(fired.length);
    }
    expect(firsts.length).toBeGreaterThanOrEqual(5);
    expect(twice).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it("the meter's `waiting` (full, held back by the blizzard) says exactly when a full meter won't come as the move lands (review, Nov 18)", async () => {
    let waits = 0;
    let comes = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { turns, fired } = await playThrough(seed);
      for (const t of turns) {
        const full = t.meter !== null && t.meter >= 1 && t.used < BOSS_POWERS.superFreezeMax;
        if (!full) {
          expect(t.waiting).toBe(false);
          continue;
        }
        // (The battle went on after this move: the next crowd turn was seen.)
        if (!turns.some((x) => x.turn === t.turn + 1)) continue;
        const came = fired.some((f) => f.after === t.turn);
        expect(came).toBe(!t.waiting);
        if (t.waiting) waits++;
        else comes++;
      }
    }
    expect(comes).toBeGreaterThan(0);
    expect(waits).toBeGreaterThan(0);
  }, 240_000);

  it("the test switch (?power=superfreeze): after the crowd's first move, then its third", async () => {
    const { fired, turns } = await playThrough(3, "superfreeze", 12);
    expect(fired.map((f) => f.after)).toEqual([1, 3]);
    expect(turns.find((t) => t.turn === 2)!.held.length).toBeGreaterThan(0);
  }, 60_000);

  it("his thinking waits for its moment (solo and the server alike): its banner, the charge, the blast and the ice", async () => {
    const r = battle(3, "superfreeze", 12);
    while (!(r.bossToMove() && superOf(r)?.used)) {
      if (r.bossToMove()) await r.playBoss();
      else {
        r.deal();
        await r.score(new Map([["h0", { move: [...(r.crowdAllowed() ?? legalMoves(fenOf(r)))].sort()[0]!, thinkMs: 1000 }]]));
      }
    }
    const view = r.bossView()!;
    expect(view.powers!.events.some((e) => e.kind === "superFreeze")).toBe(true);
    expect(gingerTurnMs(view)).toBe(powerFxMs({ kind: "superFreeze" }) + 200);
    expect(bossThinkMs(view, false, gingerTurnMs(view))).toBeGreaterThanOrEqual(POWER_FX.superFreeze);
    expect(GINGER_FX.superFreeze).toBe(SUPER_FREEZE_BEATS.total);
    // (Eric: a 4 to 5 second charge up and expanding ice block, after its banner.)
    expect(SUPER_FREEZE_BEATS.total - SUPER_FREEZE_BEATS.chargeAt).toBeGreaterThanOrEqual(4000);
    expect(SUPER_FREEZE_BEATS.total - SUPER_FREEZE_BEATS.chargeAt).toBeLessThanOrEqual(5000);
    // Its pieces show ice from now, through his move.
    expect(view.powers!.iced.length).toBeGreaterThan(0);
  }, 60_000);
});
