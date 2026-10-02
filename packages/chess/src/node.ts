/** Node-only: runs the WebAssembly Stockfish build in a child process. */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { UciEngine, type EngineOptions, type UciTransport } from "./uci.ts";

const require = createRequire(import.meta.url);

/** The single-threaded lite build: the same file the browser loads. */
export const STOCKFISH_BUILD = join(dirname(require.resolve("stockfish/package.json")), "bin", "stockfish-19-lite-single.js");

export function nodeTransport(): UciTransport {
  const child = spawn(process.execPath, [STOCKFISH_BUILD], { stdio: ["pipe", "pipe", "inherit"] });
  let buffer = "";
  const listeners: ((line: string) => void)[] = [];
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    let i: number;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      for (const l of listeners) l(line);
    }
  });
  return {
    send: (c) => child.stdin.write(c + "\n"),
    onLine: (l) => listeners.push(l),
    close: () => child.kill(),
  };
}

export async function createNodeEngine(options: EngineOptions): Promise<UciEngine> {
  const engine = new UciEngine(nodeTransport(), options);
  await engine.init();
  return engine;
}
