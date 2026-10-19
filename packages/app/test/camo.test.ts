import { afterEach, describe, expect, it } from "vitest";
import { mulberry32 } from "@chessroyale/core";
import { MatchRunner, applyMove, fenAtPly, legalMoves, maskedFen, pieceAt, type Base, type CamoView } from "@chessroyale/chess";
import { KIT_OPENING, crowdPick, fakeEngine, kitSettings } from "../../chess/test/boss-kit-lib.ts";
import { camoHidden, hiddenTrail, seenFen, seenSan, seenSanOrNull, trackCamo, type CamoBoss } from "../src/camo.ts";
import { hintsFrom } from "../src/hints.ts";
import { REFUSED, refusedLine } from "../src/refused.ts";

/**
 * The board as the crowd sees it while Smudgy's rook hides (camo.ts; docs/decisions/2026-10-19-smudgy-wired.md): the
 * hidden rook is a pawn in every position of the battle, nothing names it as a rook, and once it's revealed (or the battle
 * is over) everything is as it is. Real battles through the match runner, on the stand-in engine, both sides.
 */
afterEach(() => trackCamo(null));

const fenOf = (r: MatchRunner) => r.boards.get(r.state.boards[0]!)!.fen;
const placement = (fen: string) => fen.split(" ")[0]!;
/** How many rooks of a color the position has. */
const rooks = (fen: string, color: "w" | "b") => [...placement(fen)].filter((c) => c === (color === "w" ? "R" : "r")).length;
const pawns = (fen: string, color: "w" | "b") => [...placement(fen)].filter((c) => c === (color === "w" ? "P" : "p")).length;

function battle(seed: number, side: "w" | "b", test = "") {
  const settings = kitSettings({ boss: "smudgy", test, maxMoves: 40 });
  return new MatchRunner({ settings, rng: mulberry32(seed), engines: [fakeEngine()], library: [KIT_OPENING], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: side });
}

/** One step of a battle: his move (a Repaint first when it's due), or the crowd's (from `pick`). */
async function step(r: MatchRunner, rng: () => number) {
  if (r.bossToMove()) {
    if (r.repaintDue()) await r.playRepaint([fakeEngine()]);
    if (r.bossToMove()) await r.playBoss(fakeEngine());
    return;
  }
  r.deal();
  const fen = fenOf(r);
  const move = crowdPick(fen, r.crowdAllowed() ?? legalMoves(fen), rng);
  await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
}

describe("the board the crowd sees (a real battle, every step)", () => {
  it("draws the hidden rook as one of his pawns at every position, names none of its moves as a rook, and offers the moves the real board allows", async () => {
    let hiddenSteps = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const side = seed % 2 ? "w" : "b";
      const his = side === "w" ? "b" : "w";
      const r = battle(seed, side);
      const rng = mulberry32(seed);
      for (let i = 0; i < 70 && !r.isOver() && !r.stageComplete(); i++) {
        await step(r, rng);
        const view = r.bossView()!;
        trackCamo(view as unknown as CamoBoss);
        const camo = view.powers!.camo!;
        const fen = view.board.fen;
        if (!camo.square) {
          // Nothing hidden (before the swap, or revealed): every position is as it is.
          expect(seenFen(fen), `seed ${seed} step ${i}`).toBe(fen);
          continue;
        }
        hiddenSteps++;
        const where = `seed ${seed} step ${i}`;
        // The position now: a pawn of his where the rook is, and his other rook as it is.
        const seen = seenFen(fen);
        expect(pieceAt(seen, camo.square), where).toEqual({ color: his, type: "p" });
        expect(pieceAt(fen, camo.square)?.type, where).toBe("r");
        expect(rooks(seen, his), where).toBe(rooks(fen, his) - 1);
        expect(pawns(seen, his), where).toBe(pawns(fen, his) + 1);
        // Every position of the game since the swap, as the history and the replay show them (the board browsing back
        // draws these): the rook a pawn in each, wherever it stood then.
        const trail = hiddenTrail(view as unknown as CamoBoss)!;
        const h = view.board.history;
        trail.forEach((sq, ply) => {
          const was = fenAtPly(h, ply, view.board.bases);
          const drawn = seenFen(was);
          if (sq === null) expect(drawn, `${where} ply ${ply}`).toBe(was);
          else {
            expect(pieceAt(drawn, sq), `${where} ply ${ply}`).toEqual({ color: his, type: "p" });
            expect(rooks(drawn, his), `${where} ply ${ply}`).toBe(rooks(was, his) - 1);
          }
        });
        // His moves of it, named as the board the crowd sees names them: a pawn's, never "R…" (a move of his other rook
        // is "Rd8", never "Rhd8" when the hidden one could reach d8 too).
        trail.forEach((sq, ply) => {
          if (ply === 0 || sq === null || trail[ply - 1] === null) return;
          const m = h[ply - 1]!;
          const before = fenAtPly(h, ply - 1, view.board.bases);
          if (pieceAt(before, m.slice(0, 2))?.color !== his) return;
          const san = seenSan(before, m);
          if (m.slice(0, 2) === trail[ply - 1]) expect(san, `${where} ply ${ply}: ${m}`).toMatch(/^[a-h][1-8]?$|^[a-h]x?[a-h][1-8]$/);
          else if (pieceAt(before, m.slice(0, 2))?.type === "r") expect(san, `${where} ply ${ply}: ${m}`).toMatch(/^R[a-h1-8]?x?[a-h][1-8]/);
        });
        // The moves it offers (the dots): those legal as it draws the position, a superset of the moves the game allows
        // (the ones it refuses are tried like any other: `paint`).
        if (view.crowdSide === (fen.split(" ")[1] as "w" | "b")) {
          const offered = new Set(legalMoves(seen));
          for (const m of r.crowdAllowed() ?? legalMoves(fen)) expect(offered.has(m), `${where}: ${m}`).toBe(true);
        }
      }
    }
    // (The battles did hide a rook, for a good many steps.)
    expect(hiddenSteps).toBeGreaterThan(20);
  }, 120_000);

  it("draws a position made from the latest one (the pick on the board, a Last Stand's) with the same rook hidden", async () => {
    const r = battle(2, "b");
    const rng = mulberry32(2);
    let view = r.bossView()!;
    for (let i = 0; i < 40 && !(view.powers!.camo!.square && !r.bossToMove()); i++) {
      await step(r, rng);
      view = r.bossView()!;
    }
    trackCamo(view as unknown as CamoBoss);
    const square = view.powers!.camo!.square!;
    expect(square).toBeTruthy();
    const fen = view.board.fen;
    // A pick of the crowd's, played on the position the board shows: the hidden rook is still a pawn.
    const move = legalMoves(fen).find((m) => m.slice(2, 4) !== square)!;
    // (He plays the other color: the crowd is Black.)
    expect(pieceAt(seenFen(applyMove(fen, move)), square)).toEqual({ color: "w", type: "p" });
  }, 60_000);

  it("never draws a crowd rook as a pawn: only his rook on the hidden square is one", () => {
    const hidden = (fen: string): CamoBoss => ({
      id: "smudgy",
      crowdSide: "w",
      board: { fen, history: [], bases: [] },
      powers: { camo: { side: "h", step: 2, off: false, square: "e7", swap: null, strikeAt: null, reveal: null } as CamoView },
    });
    trackCamo(hidden("4k3/4r3/8/8/8/8/8/4K3 w - - 0 1"));
    // (A crowd rook that took its square: not his, not hidden.)
    const crowdRook = "4k3/4R3/8/8/8/8/8/4K3 b - - 0 1";
    expect(seenFen(crowdRook)).toBe(crowdRook);
  });

  it("is the position as it is for any other boss, with nothing tracked, once the rook is taken or revealed, and when the battle is over", () => {
    const view = (square: string | null, result?: "crowd"): CamoBoss => ({
      id: "smudgy",
      crowdSide: "w",
      ...(result ? { result } : {}),
      board: { fen: "4k3/4r3/8/8/8/8/8/4K3 w - - 0 1", history: [], bases: [] },
      powers: { camo: { side: "h", step: 2, off: false, square, swap: null, strikeAt: null, reveal: null } as CamoView },
    });
    const fen = "4k3/4r3/8/8/8/8/8/4K3 w - - 0 1";
    expect(camoHidden()).toBe(false);
    trackCamo(view("e7"));
    expect(camoHidden()).toBe(true);
    expect(placement(seenFen(fen))).toBe("4k3/4p3/8/8/8/8/8/4K3");
    // The battle over: the true board, past positions too.
    trackCamo(view("e7", "crowd"));
    expect(camoHidden()).toBe(false);
    expect(seenFen(fen)).toBe(fen);
    // Revealed or taken (no square), another boss, none at all.
    trackCamo(view("e7"));
    trackCamo(view(null));
    expect(seenFen(fen)).toBe(fen);
    trackCamo(view("e7"));
    trackCamo({ ...view("e7"), id: "hopper" });
    expect(seenFen(fen)).toBe(fen);
    trackCamo(view("e7"));
    trackCamo(null);
    expect(seenFen(fen)).toBe(fen);
  });
});

describe("what the words say of a hidden rook", () => {
  const view = (history: string[], bases: Base[], fen: string, square: string, swap: { at: number; rook: string; pawn: string }): CamoBoss => ({
    id: "smudgy",
    crowdSide: "w",
    board: { fen, history, bases },
    powers: { camo: { side: "a", step: 2, off: false, square, swap, strikeAt: null, reveal: null } as CamoView },
  });

  it("names the hidden rook's pawn-shaped step as a pawn's, his other rook's as a rook's, and a move that isn't one there (its strike) as it is", () => {
    // Black's rook hides on e7; the other rook on a8. White's king on e1.
    const fen = "r3k3/4r3/8/8/8/8/8/4K3 b - - 0 1";
    trackCamo(view([], [], fen, "e7", { at: 0, rook: "h6", pawn: "e7" }));
    expect(camoHidden()).toBe(true);
    expect(seenSan(fen, "e7e6")).toBe("e6");
    expect(seenSan(fen, "e7e5")).toBe("e5");
    expect(seenSan(fen, "a8b8")).toBe("Rb8");
    // A rook's strike: no move there; the real board names it, the strict one says nothing.
    expect(seenSanOrNull(fen, "e7a7")).toBeNull();
    expect(seenSan(fen, "e7a7")).toBe("Rea7");
    // A disambiguation that would name the rook is gone: both his rooks could reach d8 on the real board.
    const both = "r3k3/3r4/8/8/8/8/8/4K3 b - - 0 1";
    trackCamo(view([], [], both, "d7", { at: 0, rook: "h6", pawn: "d7" }));
    expect(seenSan(both, "a8d8")).toBe("Rd8");
    // The hints say the same.
    expect(hintsFrom(fen, [{ move: "e7e6", expected: 0.5 }]).map((h) => h.san)).toEqual(["e6"]);
  });

  it("says why a move the board offers but the real board refuses was stopped, in the dock's words", () => {
    // Your king steps onto the e-file: legal if the piece on e7 is a pawn.
    const fen = "4k3/4r3/8/8/8/8/8/3K4 w - - 0 1";
    const boss = { id: "smudgy", powers: { camo: { square: "e7" } } };
    expect(legalMoves(maskedFen(fen, "e7"))).toContain("d1e1");
    expect(legalMoves(fen)).not.toContain("d1e1");
    expect(refusedLine(boss as never, fen, "d1e1")).toBe(REFUSED.paint);
    expect(REFUSED.paint).toBe("A painted piece stops that move.");
    // A move the real board allows is no refusal.
    expect(refusedLine(boss as never, fen, "d1c1")).not.toBe(REFUSED.paint);
  });
});
