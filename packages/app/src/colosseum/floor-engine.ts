/**
 * The Colosseum's own Stockfish (Oct 30, the first look): one worker, started when the screen opens and ended when it
 * closes (the town never loads it: Eric's frame-rate rule). It plays both bots' moves at their ratings and gives the eval
 * bar its number at a low depth. The same worker and UCI talk as the game's pool (engine.ts), kept apart from that pool so
 * this screen's work never queues behind a match's and nothing outlives the screen.
 */
import { UciEngine, sideToMove, type UciTransport } from "@chessroyale/chess";
import { DEFAULT_SETTINGS } from "@chessroyale/core";
import { FLOOR } from "./match.ts";

const ENGINE_JS = "/engine/stockfish-19-lite-single.js";
const ENGINE_WASM = "/engine/stockfish-19-lite-single.wasm";

function transport(): UciTransport {
  const listeners: ((line: string) => void)[] = [];
  let worker: Worker | null = null;
  const start = () => {
    const w = new Worker(`${ENGINE_JS}#${encodeURIComponent(ENGINE_WASM)}`);
    w.onmessage = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      for (const line of e.data.split("\n")) for (const l of listeners) l(line.trim());
    };
    w.onerror = (e) => {
      e.preventDefault();
      console.warn(`Colosseum Stockfish: ${e.message || "error"}`);
    };
    return w;
  };
  return {
    send: (c) => (worker ??= start()).postMessage(c),
    onLine: (l) => listeners.push(l),
    close: () => {
      worker?.terminate();
      worker = null;
    },
    restart: () => {
      worker?.terminate();
      worker = null;
    },
  };
}

export interface FloorEngine {
  move(fen: string, rating: number, ms: number): Promise<string>;
  evaluate(fen: string): Promise<{ white: number; mate: number | null } | null>;
  close(): void;
}

/** The screen's engine (null if it can't start: the floor then plays random legal moves and the bar stays empty). */
export async function floorEngine(): Promise<FloorEngine | null> {
  const engine = new UciEngine(transport(), { nodes: FLOOR.moveNodes, hashMb: DEFAULT_SETTINGS.engineHashMb });
  try {
    await Promise.race([engine.init(), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 20_000))]);
  } catch {
    engine.close();
    return null;
  }
  return {
    move: (fen, rating, ms) => engine.playAtElo(fen, rating, FLOOR.moveNodes, ms),
    async evaluate(fen) {
      try {
        const [best] = await engine.topMovesAt(fen, 1, FLOOR.evalNodes);
        if (!best) return null;
        const w = sideToMove(fen) === "w";
        return { white: w ? best.expected : 1 - best.expected, mate: best.mate ? (w ? best.mate : -best.mate) : null };
      } catch {
        return null;
      }
    },
    close: () => engine.close(),
  };
}
