/**
 * The HunChess engine in its own Web Worker, for Auto chess (docs/decisions/2026-10-21-hunchess-engine.md): the fight's moves and
 * the bot's looks at the adjust step, off the page's thread. One engine; its table carries over between the moves of one fight and
 * is cleared when a fight starts ("new"), so a fight plays the same way every time.
 */
import { HunchessEngine, type HunRules } from "@chessroyale/chess/hunchess";

export type HunRequest =
  | { type: "new"; id: number }
  | { type: "move"; id: number; startFen: string; moves: readonly string[]; rules: HunRules; nodes: number; cashInValue: number };

export interface HunReply {
  id: number;
  move: string | null;
  score: number;
  expected: number;
  depth: number;
  nodes: number;
  ms: number;
}

let engine: HunchessEngine | null = null;
let cashInValue = -1;

self.onmessage = (e: MessageEvent<HunRequest>) => {
  const req = e.data;
  if (req.type === "new") {
    engine?.newGame();
    return;
  }
  if (!engine || req.cashInValue !== cashInValue) {
    engine = new HunchessEngine({ nodes: req.nodes, cashInValue: req.cashInValue });
    cashInValue = req.cashInValue;
  }
  const t0 = performance.now();
  let reply: HunReply;
  try {
    const r = engine.best({ startFen: req.startFen, moves: req.moves, rules: req.rules }, req.nodes);
    reply = { id: req.id, move: r.move, score: r.score, expected: r.expected, depth: r.depth, nodes: r.nodes, ms: performance.now() - t0 };
  } catch {
    reply = { id: req.id, move: null, score: 0, expected: 0.5, depth: 0, nodes: 0, ms: performance.now() - t0 };
  }
  (self as unknown as { postMessage: (r: HunReply) => void }).postMessage(reply);
};
