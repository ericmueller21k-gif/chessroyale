/**
 * A paint worker (paint-pool.ts): paints the loading screen's pictures handed to it, with the main thread's own code (paint-jobs.ts
 * `paintSpec`), and sends each one's pixels back as it's done (their buffers transferred, not copied). What it paints from (a
 * character, a box) comes once, by number, and is kept for the pictures after.
 */
import { paintSpec, type PaintSpec } from "./paint-jobs.ts";
import type { Job, Reply } from "./paint-pool.ts";

const defs = new Map<number, unknown>();

self.onmessage = (e: MessageEvent<{ defs: [number, unknown][]; jobs: Job[]; slow: number }>) => {
  for (const [id, v] of e.data.defs) defs.set(id, v);
  const slow = e.data.slow;
  for (const j of e.data.jobs) {
    const t0 = performance.now();
    let r: Reply;
    const send: Transferable[] = [];
    try {
      const spec = (j.kind === "frame" ? { kind: "frame", ch: defs.get(j.ref), k: j.k, dark: j.dark } : { kind: "roof", b: defs.get(j.ref), q: j.q }) as PaintSpec;
      if (!(spec.kind === "frame" ? spec.ch : spec.b)) throw new Error("paint worker: not sent");
      const out = paintSpec(spec);
      const bufs = new Set<ArrayBuffer>();
      if ("data" in out) bufs.add(out.data.buffer as ArrayBuffer);
      else for (const f of out) for (const c of f) bufs.add(c.data.buffer as ArrayBuffer);
      send.push(...bufs);
      r = { i: j.i, out };
    } catch (err) {
      r = { i: j.i, error: String(err) };
    }
    // (Tests, `?paintslow=`: as long as on a core that much slower, as the page's own thread is slowed (CDP's CPU throttling doesn't reach
    // workers). Never in play.)
    if (slow > 1) for (const until = t0 + (performance.now() - t0) * slow; performance.now() < until; );
    (self as unknown as Worker).postMessage(r, send);
  }
};
