import { afterAll, describe, expect, it } from "vitest";
import { AUTOCHESS, mulberry32 } from "@chessroyale/core";
import { HunchessEngine } from "@chessroyale/chess/hunchess";
import type { HunReply, HunRequest } from "../src/autochess/hunchess-worker.ts";

/**
 * Auto chess's engine link (autochess/engine.ts): the HunChess engine in a Web Worker. Here the worker is a stand-in on the test's
 * thread that runs the real engine (or, switched off, never answers): an answer is used, a late one is ignored, a missing one times
 * out to null (the fight then plays a stand-in move), and after three misses in a row the engine is given up on for the visit.
 */

let answering = true;
const asked: HunRequest[] = [];
class FakeWorker {
  onmessage: ((e: MessageEvent<HunReply>) => void) | null = null;
  onerror: (() => void) | null = null;
  private engine = new HunchessEngine({ nodes: 2000 });
  postMessage(req: HunRequest) {
    asked.push(req);
    if (req.type === "new" || !answering) return;
    const r = this.engine.best({ startFen: req.startFen, moves: req.moves, rules: req.rules }, req.nodes);
    setTimeout(() => this.onmessage?.({ data: { id: req.id, move: r.move, score: r.score, expected: r.expected, depth: r.depth, nodes: r.nodes, ms: 0 } } as MessageEvent<HunReply>), 1);
  }
}
const g = globalThis as unknown as { Worker?: unknown };
const before = g.Worker;
g.Worker = FakeWorker;
afterAll(() => {
  g.Worker = before;
});

const { botEvaluator, enginePick, newFight } = await import("../src/autochess/engine.ts");
const { playFight, fightMoves } = await import("../src/autochess/fight.ts");

const START = "4k3/pp3ppp/8/8/8/8/PP3PPP/2R1K3 w - - 0 1";
const cfg = { ...AUTOCHESS, fightNodes: 2000 };

describe("auto chess: the engine in its worker", () => {
  it("answers with one of the fight's moves, searched at the fight's node budget with the fight's rules", async () => {
    newFight();
    const answer = await enginePick({ startFen: START, moves: [] }, fightMoves(START), cfg, 2000);
    expect(fightMoves(START)).toContain(answer!.move);
    // (With its score for the side moving, which counts toward "too far ahead".)
    expect(typeof answer!.score).toBe("number");
    const req = asked.find((r) => r.type === "move")!;
    expect(req).toMatchObject({ nodes: 2000, rules: { variant: "fight", quietCap: 10, moveCap: 60, stallWinMargin: 50 }, cashInValue: AUTOCHESS.cashInValue });
    expect(req.type === "move" && "checksToWin" in req.rules).toBe(false);
    expect(asked[0]!.type).toBe("new");
  });

  it("the bot's look at a position: its expected score, 0 to 1, from the bot's side", async () => {
    const you = { color: "w" as const, king: "e1", board: { a2: "p" as const }, bench: [] };
    const strong = { color: "b" as const, king: "e8", board: { d8: "q" as const, a8: "r" as const }, bench: [] };
    const score = await botEvaluator(you, "b", cfg)(strong);
    expect(score).toBeGreaterThan(0.9);
  });

  it("a fight always ends: with the engine silent, each look times out to a stand-in move, and after three misses it is given up on", async () => {
    answering = false;
    const t0 = performance.now();
    const res = await playFight(START, { pick: (game, allowed) => enginePick(game, allowed, cfg, 50), wait: async () => undefined, rng: mulberry32(1), cfg: { ...cfg, moveCap: 8 } });
    expect(res).not.toBeNull();
    expect(res!.moves.length).toBeGreaterThan(3);
    // Three timeouts (50 ms each), then no more waiting.
    expect(performance.now() - t0).toBeLessThan(1500);
    const looks = asked.filter((r) => r.type === "move").length;
    // Given up on: asking again sends nothing and answers null at once.
    expect(await enginePick({ startFen: START, moves: [] }, fightMoves(START), cfg, 5000)).toBeNull();
    expect(asked.filter((r) => r.type === "move").length).toBe(looks);
  });
});
