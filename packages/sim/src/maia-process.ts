import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { UciTransport } from "@chessroyale/chess";

const root = fileURLToPath(new URL("../../../", import.meta.url));

/** The environment a Maia process gets: this one's, without anything named like a secret (Maia needs none; the residents' token). */
export function maiaEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([k]) => !/SECRET|TOKEN|PASSWORD/i.test(k)));
}

/** Every Maia process still running, killed when this process exits (a `process.exit` anywhere: none is left behind). */
const children = new Set<ChildProcess>();
process.on("exit", () => {
  for (const c of children) c.kill();
});

/** The Maia box as a separate process (packages/maia-worker's cli): text in, text out. For the sims that pick as Maia. */
export function maiaProcess(): UciTransport {
  const child = spawn(process.execPath, ["--import", "tsx", root + "packages/maia-worker/src/cli.ts"], { stdio: ["pipe", "pipe", "inherit"], env: maiaEnv(process.env) });
  children.add(child);
  child.on("exit", () => children.delete(child));
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
