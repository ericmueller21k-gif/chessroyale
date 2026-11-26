import { describe, expect, it, vi } from "vitest";

// The street town as an admin's (every home): its pictures are all made here.
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true }));

const { framePixels, glowPixels, GLOW_GAP, paintBatch, paintCopy, paintSpec, roofCopy } = await import("../src/town/paint-jobs.ts");
const { COLISEUM_ART, HOUSES } = await import("../src/town/houses/index.ts");
const { PARK_LAMP, PARK_LAMP_LIGHTS, PARK_LAMP_POOLS } = await import("../src/town/houses/park.ts");
const { PaintPool, workerCount } = await import("../src/town/paint-pool.ts");
const { roofCuts } = await import("../src/town/box-draw.ts");
const { lotArt, streetBoxes } = await import("../src/town/boxes.ts");
const { STREET_LOTS } = await import("../src/town/street.ts");
const { PROPS, STATUES } = await import("../src/town/world.ts");
const { stepChar } = await import("../src/town/kit/bake.ts");
const d = await import("../src/town/dressing.ts");
const { statueArt } = await import("../src/town/houses/statues.ts");
const { BOSS_ART } = await import("../src/town/render.ts");
type Character = import("../src/characters/sprite.ts").Character;
type PaintSpec = import("../src/town/paint-jobs.ts").PaintSpec;
type Painted = import("../src/town/paint-jobs.ts").Painted;
type Batch = import("../src/town/paint-jobs.ts").Batch;
type Reply = import("../src/town/paint-jobs.ts").Reply;

/**
 * Chess Town's first visit paints on more cores (Nov 23, docs/decisions/2026-11-23-town-paint-workers.md): a paint worker gets each
 * picture's art as JSON (paint-jobs.ts `paintCopy`, `roofCopy`) and paints it with the main thread's own code, so every picture of the
 * town painted from the worker's copy is the main thread's byte for byte; and the pool hands out, waits, paints while it waits and
 * falls back to the main thread on any failure, every picture ending up the same.
 */
const BOXES = streetBoxes(PROPS);

/** Every character the town's loading screen paints frames of: each box's front and walls, the props, hedges, statues and bosses. */
function townCharacters(): Character[] {
  const out = new Set<Character>();
  for (const b of BOXES) {
    const B = b.box;
    for (const ch of [B.front, B.left?.ch, B.right?.ch, B.back?.ch, B.rear?.ch, b.tile]) if (ch) out.add(ch);
  }
  for (const l of STREET_LOTS) out.add(lotArt(l).front);
  for (let v = 0; v < 3; v++) for (const ch of [d.hedgeFront(v), d.hedgeTop(v), d.bush(v), d.bed(v), d.shed(v).front]) out.add(ch);
  for (const s of STATUES) out.add(statueArt(s.id, 1));
  for (const ch of Object.values(BOSS_ART)) out.add(ch);
  return [...out];
}
const same = (a: Painted, b: Painted): boolean => {
  if ("pieces" in a || "pieces" in b)
    return "pieces" in a && "pieces" in b && a.pieces.join() === b.pieces.join() && (a.sheet === null ? b.sheet === null : !!b.sheet && same(a.sheet, b.sheet));
  if ("data" in a || "data" in b) return "data" in a && "data" in b && a.w === b.w && a.h === b.h && Buffer.from(a.data).equals(Buffer.from(b.data));
  return a.length === b.length && a.every((f, i) => f.length === b[i]!.length && f.every((c, j) => { const e = b[i]![j]!; return c.w === e.w && c.h === e.h && c.ox === e.ox && c.oy === e.oy && Buffer.from(c.data).equals(Buffer.from(e.data)); }));
};
/** What a worker sends back for these pictures (paint-jobs.ts `paintBatch`, the worker's own code), from their art as JSON. */
function viaWorker(specs: PaintSpec[]): Painted[] {
  const defs: [number, string][] = [];
  const at = new Map<object, number>();
  const jobs = specs.map((sp, i) => {
    const o = sp.kind === "roof" ? sp.b : sp.ch;
    let ref = at.get(o);
    if (ref === undefined) at.set(o, (ref = defs.push([at.size, JSON.stringify(sp.kind === "roof" ? roofCopy(sp.b) : paintCopy(sp.ch))]) - 1));
    if (sp.kind === "glow") return { i, kind: "glow" as const, ref, spots: structuredClone(sp.spots), pools: structuredClone(sp.pools) };
    return sp.kind === "frame" ? { i, kind: "frame" as const, ref, k: sp.k, dark: sp.dark } : { i, kind: "roof" as const, ref, q: sp.q };
  });
  const out: Painted[] = [];
  paintBatch(new Map(), { defs, jobs, slow: 1 }, (r) => {
    if ("error" in r) throw new Error(r.error);
    out[r.i] = r.out;
  });
  return out;
}

describe("Chess Town's paint workers paint every picture as the main thread does (Nov 23)", () => {
  it("every frame of every character the town paints, light and a step darker, from the worker's JSON copy: the same pixels", { timeout: 120_000 }, () => {
    const chs = townCharacters();
    expect(chs.length).toBeGreaterThan(100);
    const specs: PaintSpec[] = chs.flatMap((ch) => ch.anims.idle!.frames.flatMap((_, k) => [false, true].map((dark) => ({ kind: "frame" as const, ch, k, dark }))));
    const got = viaWorker(specs);
    let differ = 0;
    specs.forEach((sp, i) => {
      if (sp.kind !== "frame") return;
      // (The main thread's own way: render.ts FrameCache, a darker one's character a ramp step down.)
      const want = framePixels(sp.dark ? stepChar(sp.ch, -1) : sp.ch, sp.k);
      if (!same(got[i]!, want)) differ++;
    });
    expect(differ, `pictures that differ of ${specs.length}`).toBe(0);
  });

  it("every box's roof, for each of the camera's four quarters, from the worker's copy of its box: the same pieces", { timeout: 120_000 }, () => {
    const specs: PaintSpec[] = BOXES.flatMap((b) => [0, 1, 2, 3].map((q) => ({ kind: "roof" as const, b, q })));
    const got = viaWorker(specs);
    let differ = 0;
    specs.forEach((sp, i) => {
      if (sp.kind === "roof" && !same(got[i]!, roofCuts(sp.b, sp.b.box, sp.q))) differ++;
    });
    expect(differ, `roofs that differ of ${specs.length}`).toBe(0);
  });

  it("every glow the loading screen bakes (Nov 26: homes, the Colosseum, fronts, sides, the lamp), from the worker's copy: the same sheet and pieces, each piece on its sheet with clear pixels round it", { timeout: 120_000 }, () => {
    const specs: PaintSpec[] = [];
    for (const a of [...Object.values(HOUSES), COLISEUM_ART]) specs.push({ kind: "glow", ch: a.ch, spots: a.lights, pools: a.pools });
    for (const l of STREET_LOTS) if (lotArt(l).lights.length) specs.push({ kind: "glow", ch: lotArt(l).front, spots: lotArt(l).lights, pools: [] });
    const sides = new Set<Character>();
    for (const b of BOXES)
      for (const side of [b.box.left, b.box.right, b.box.back ?? b.box.rear])
        if (side?.lights.length && !sides.has(side.ch)) (sides.add(side.ch), specs.push({ kind: "glow", ch: side.ch, spots: side.lights, pools: [] }));
    specs.push({ kind: "glow", ch: PARK_LAMP, spots: PARK_LAMP_LIGHTS, pools: PARK_LAMP_POOLS });
    expect(specs.length).toBeGreaterThan(100);
    const got = viaWorker(specs);
    let differ = 0;
    let pieces = 0;
    specs.forEach((sp, i) => {
      if (sp.kind !== "glow") return;
      const want = glowPixels(sp.ch, sp.spots, sp.pools);
      if (!same(got[i]!, want)) differ++;
      const { sheet, pieces: at } = want;
      if (!sheet) return;
      // Each piece on the sheet, none within GLOW_GAP of another (the atlas's padding), and nothing drawn outside the pieces.
      const own = new Int32Array(sheet.w * sheet.h).fill(-1);
      for (let k = 0; k < at.length; k += 7) {
        pieces++;
        const [sx, sy, w, h] = at.slice(k, k + 4) as [number, number, number, number];
        expect(sx >= 0 && sy >= 0 && sx + w <= sheet.w && sy + h <= sheet.h, `${sp.ch.id}: a piece on its sheet`).toBe(true);
        for (let y = sy - GLOW_GAP; y < sy + h + GLOW_GAP; y++)
          for (let x = sx - GLOW_GAP; x < sx + w + GLOW_GAP; x++) {
            if (x < 0 || y < 0 || x >= sheet.w || y >= sheet.h) continue;
            const inside = x >= sx && y >= sy && x < sx + w && y < sy + h;
            if (inside) own[y * sheet.w + x] = k;
            else expect(own[y * sheet.w + x], `${sp.ch.id}: pieces apart`).toBe(-1);
          }
      }
      for (let i = 0; i < own.length; i++) if (own[i]! < 0 && sheet.data[i * 4 + 3]) differ++;
    });
    expect(pieces, "the glows' pieces").toBeGreaterThan(2000);
    expect(differ, `glows that differ of ${specs.length}`).toBe(0);
  });

  it("a worker's copy of a character holds only its idle frames and the parts they draw, as plain data", () => {
    const ch = BOSS_ART.gingerbread;
    const c = paintCopy(ch);
    expect(Object.keys(c.anims)).toEqual(["idle"]);
    const used = new Set(ch.anims.idle!.frames.flatMap((f) => f.layers.map((l) => l.part)));
    expect(new Set(Object.keys(c.parts))).toEqual(used);
    for (const p of Object.values(c.parts)) expect(Object.getOwnPropertyDescriptor(p, "grid")?.get, "a plain grid").toBeUndefined();
  });
});

/** A worker in memory: each batch painted by the worker's own code a moment later, its answers copied as a message would be. */
class FakeWorker {
  onmessage: ((e: MessageEvent<Reply>) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessageerror: ((e: unknown) => void) | null = null;
  readonly defs = new Map<number, unknown>();
  batches = 0;
  gone = false;
  constructor(readonly opts: { failAfter?: number } = {}) {}
  postMessage(b: Batch): void {
    const copy = structuredClone(b);
    this.batches++;
    setTimeout(() => {
      if (this.gone) return;
      if (this.opts.failAfter !== undefined && this.batches > this.opts.failAfter) return this.onerror?.(new Error("broken"));
      paintBatch(this.defs, copy, (r) => this.onmessage?.({ data: structuredClone(r) } as MessageEvent<Reply>));
    }, 1);
  }
  terminate(): void {
    this.gone = true;
  }
}
const tick = () => new Promise<void>((go) => setTimeout(go, 2));

/** The loading screen's loop over a pool (render.ts `warm`): each picture in order, waiting (and helping) while a worker paints it. */
async function run(pool: InstanceType<typeof PaintPool>, specs: PaintSpec[]): Promise<{ out: Painted[]; here: number }> {
  const out: Painted[] = [];
  let here = 0;
  for (let i = 0; i < specs.length; i++) {
    let r = pool.take(i);
    for (let n = 0; r === "wait"; n++, r = pool.take(i)) {
      if (n > 5000) throw new Error("waited forever");
      if (!pool.pump(5) && !pool.steal()) await tick();
    }
    if (r === null) here++;
    out.push(r ?? paintSpec(specs[i]!));
  }
  pool.close();
  return { out, here };
}
const SPECS: PaintSpec[] = [
  ...[BOSS_ART.grex, BOSS_ART.moo, BOXES[0]!.box.front].flatMap((ch) => ch.anims.idle!.frames.flatMap((_, k) => [false, true].map((dark) => ({ kind: "frame" as const, ch, k, dark })))),
  ...BOXES.slice(0, 6).flatMap((b) => [0, 1].map((q) => ({ kind: "roof" as const, b, q }))),
];
const want = SPECS.map(paintSpec);
const allSame = (out: Painted[]) => out.every((o, i) => same(o, want[i]!));

describe("Chess Town's pool of paint workers (Nov 23)", () => {
  it("as many workers as the device's cores but one, at least one and at most TOWN_PAINT_WORKERS.max", () => {
    expect([undefined, 1, 2, 3, 4, 8, 16].map((c) => workerCount(c, 3))).toEqual([1, 1, 1, 2, 3, 3, 3]);
  });

  it("the workers paint the pictures ahead, the main thread paints the last ones while it waits, and every picture is the main thread's", async () => {
    const ws = [new FakeWorker(), new FakeWorker()];
    const pool = new PaintPool(SPECS, ws);
    expect(pool.workers).toBe(2);
    const { out } = await run(pool, SPECS);
    expect(allSame(out)).toBe(true);
    expect(pool.made.workers).toBeGreaterThan(0);
    expect(pool.made.workers + pool.made.here).toBeLessThanOrEqual(SPECS.length);
    expect(ws.every((w) => w.gone), "stopped when done").toBe(true);
    // (Each piece of art went to a worker once.)
    const sent = ws.map((w) => w.defs.size);
    expect(Math.max(...sent)).toBeLessThanOrEqual(3 + 6);
  });

  it("a worker that breaks: every worker stops and the rest is painted on the main thread, the same", async () => {
    const ws = [new FakeWorker({ failAfter: 1 }), new FakeWorker()];
    const pool = new PaintPool(SPECS, ws);
    const { out, here } = await run(pool, SPECS);
    expect(allSame(out)).toBe(true);
    expect(pool.workers).toBe(0);
    expect(here).toBeGreaterThan(0);
    expect(ws.every((w) => w.gone)).toBe(true);
  });

  it("a picture whose art can't go into JSON is painted on the main thread", async () => {
    // (Art that loops back on itself can't go into JSON.)
    const loop = { ...BOSS_ART.moo, id: "loop" } as Character & { self?: unknown };
    loop.self = loop;
    const specs: PaintSpec[] = [{ kind: "frame", ch: loop, k: 0, dark: false }, ...SPECS];
    const pool = new PaintPool(specs, [new FakeWorker()]);
    const out: (Painted | "wait" | null)[] = [];
    for (let i = 0; i < specs.length; i++) {
      let r = pool.take(i);
      for (let n = 0; r === "wait" && n < 5000; n++, r = pool.take(i)) if (!pool.pump(5)) await tick();
      out.push(r);
    }
    pool.close();
    // (Never sent: painted here in its turn.)
    expect(out[0]).toBeNull();
    expect(out.slice(1).every((o, i) => o === null || same(o as Painted, want[i]!))).toBe(true);
  });

  it("a worker's error for one picture: that one is painted on the main thread, the others still come from the workers", async () => {
    const broken = { ...BOSS_ART.grex, id: "broken", parts: {} } as Character;
    const specs: PaintSpec[] = [{ kind: "frame", ch: broken, k: 0, dark: false }, ...SPECS];
    const pool = new PaintPool(specs, [new FakeWorker()]);
    let first: Painted | "wait" | null = pool.take(0);
    for (let n = 0; first === "wait" && n < 5000; n++, first = pool.take(0)) await tick();
    expect(first, "painted here, where its failure is handled as before").toBeNull();
    expect(() => paintSpec(specs[0]!)).toThrow();
    const rest: Painted[] = [];
    for (let i = 1; i < specs.length; i++) {
      let r = pool.take(i);
      for (let n = 0; r === "wait" && n < 5000; n++, r = pool.take(i)) if (!pool.pump(5) && !pool.steal()) await tick();
      rest.push(r ?? paintSpec(specs[i]!));
    }
    pool.close();
    expect(allSame(rest)).toBe(true);
    expect(pool.made.workers).toBeGreaterThan(0);
  });
});
