import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { UciTransport } from "@chessroyale/chess";

const root = fileURLToPath(new URL("../../../", import.meta.url));

/** The Maia box as a separate process (packages/maia-worker's cli): text in, text out. For the sims that pick as Maia. */
export function maiaProcess(): UciTransport {
  const child = spawn(process.execPath, ["--import", "tsx", root + "packages/maia-worker/src/cli.ts"], { stdio: ["pipe", "pipe", "inherit"] });
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
  return { send: (c) => child.stdin.write(c + "\n"), onLine: (l) => listeners.push(l), close: () => child.kill() };
}
