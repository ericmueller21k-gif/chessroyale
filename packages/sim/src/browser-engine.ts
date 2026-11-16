/** Node-only: the browsers' Stockfish build in a Web Worker in headless Chromium, spoken to over UCI from Node. */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { UciEngine, type EngineOptions, type UciTransport } from "@chessroyale/chess";
import { STOCKFISH_BUILD } from "@chessroyale/chess/node";

/** The lite build in a Web Worker in headless Chromium, spoken to from here over UCI (the app's own transport). */
export async function browserEngine(opts: EngineOptions, cpuSlowdown = 1, build = "stockfish-19-lite-single"): Promise<{ engine: UciEngine; stop: () => Promise<void> }> {
  const { chromium } = await import("@playwright/test");
  const dir = dirname(STOCKFISH_BUILD);
  const server = createServer((req, res) => {
    const name = (req.url ?? "/").split("?")[0]!.split("#")[0]!.replace(/^\//, "");
    if (!name) return res.writeHead(200, { "content-type": "text/html" }).end("<!doctype html><title>engine</title>");
    try {
      const body = readFileSync(join(dir, name.replace(/[^\w.-]/g, "")));
      res.writeHead(200, { "content-type": name.endsWith(".wasm") ? "application/wasm" : "text/javascript" }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // (A slower CPU, as Chrome's devtools emulate one: rate 4 is a mid-range phone, roughly.)
  if (cpuSlowdown > 1) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: cpuSlowdown });
  const listeners: ((line: string) => void)[] = [];
  await page.exposeFunction("uciLine", (text: string) => {
    for (const line of text.split("\n")) for (const l of listeners) l(line.trim());
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  // (Runs in the page: typed loosely, as this package has no DOM types.)
  type Page = { Worker: new (url: string) => { onmessage: (e: { data: unknown }) => void; postMessage(c: string): void }; uciLine(t: string): void; sf: { postMessage(c: string): void } };
  await page.evaluate((name) => {
    const g = globalThis as unknown as Page;
    const w = new g.Worker(`/${name}.js#${encodeURIComponent(`/${name}.wasm`)}`);
    w.onmessage = (e) => void (typeof e.data === "string" && g.uciLine(e.data));
    g.sf = w;
  }, build);
  const transport: UciTransport = {
    send: (c) => void page.evaluate((cmd) => (globalThis as unknown as Page).sf.postMessage(cmd), c),
    onLine: (l) => listeners.push(l),
    close: () => undefined,
  };
  const engine = new UciEngine(transport, opts);
  await engine.init();
  return {
    engine,
    stop: async () => {
      await browser.close();
      server.close();
    },
  };
}

