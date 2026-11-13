import { describe, expect, it, vi } from "vitest";

// The street town (everyone's since Nov 13), as an admin's (every home): its buildings are built too.
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true }));

/**
 * The pictures painted when first drawn (Nov 10, phone load 3; houses/kit.ts `paint`): every picture the town, its shops, the rides,
 * the Colosseum's sprites and home's town scene make with `paint`, built lazily and painted afterwards in reverse order, matches the
 * same built and painted at once (as before). A paint function leaning on something that changes after the call (a shared random
 * number, a variable set later) or doing something besides giving pixels (a light pushed as it paints) shows here.
 */
const MODULES = import.meta.glob(["../src/town/**/*.ts", "../src/colosseum/sprites/*.ts", "../src/home-art/*.ts", "../src/components/rides/*.tsx"]);

/** Everything reachable from `roots` (objects and arrays, not functions), each once, in a fixed order. */
function reach(roots: unknown[]): object[] {
  const seen = new Set<object>();
  const out: object[] = [];
  const stack = [...roots].reverse();
  while (stack.length) {
    const v = stack.pop();
    if (!v || typeof v !== "object" || seen.has(v) || ArrayBuffer.isView(v)) continue;
    seen.add(v);
    out.push(v);
    // (A grid isn't read here: reading it paints.)
    const keys = Object.keys(v).filter((k) => k !== "grid");
    for (let i = keys.length - 1; i >= 0; i--) stack.push((v as Record<string, unknown>)[keys[i]!]);
  }
  return out;
}
/** A record of every object's own plain data (not grids), and the grids by their place in the walk. */
function data(objs: object[]): string {
  return objs.map((o) => JSON.stringify(Object.keys(o).filter((k) => k !== "grid").map((k) => [k, typeof (o as Record<string, unknown>)[k] === "object" ? 0 : (o as Record<string, unknown>)[k]]))).join("\n");
}
const isPart = (o: object): o is { grid: readonly string[] } => "grid" in o && "outline" in o;

async function build(atOnce: boolean) {
  vi.resetModules();
  // (The same choices each build: home's town scene picks its picture at random and its sky by the clock.)
  vi.spyOn(Math, "random").mockReturnValue(0.25);
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 10, 12) });
  const kit = await import("../src/town/houses/kit.ts");
  kit.paintAtOnce(atOnce);
  const roots: unknown[] = [];
  let failed = 0;
  for (const [path, load] of Object.entries(MODULES)) {
    try {
      roots.push(path, await load());
    } catch {
      failed++;
    }
  }
  // The pictures made when asked (render.ts's constructor): every street lot's building, the sheds and hedges, the statues.
  const { STREET_LOTS } = await import("../src/town/street.ts");
  const { lotArt, streetBoxes } = await import("../src/town/boxes.ts");
  const { PROPS, STATUES } = await import("../src/town/world.ts");
  const d = await import("../src/town/dressing.ts");
  const { statueArt, CLOSE } = await import("../src/town/houses/statues.ts");
  roots.push(STREET_LOTS.map(lotArt), streetBoxes(PROPS));
  for (let v = 0; v < 3; v++) roots.push(d.hedgeFront(v), d.hedgeTop(v), d.bush(v), d.bed(v), d.shed(v));
  for (const s of STATUES) roots.push(statueArt(s.id, 1), statueArt(s.id, CLOSE));
  kit.paintAtOnce(false);
  vi.restoreAllMocks();
  vi.useRealTimers();
  return { objs: reach(roots), failed };
}

describe("the town's pictures are painted when first drawn (Nov 10, phone load 3)", () => {
  it("every picture painted lazily, in reverse order, matches the same painted at once, pixels and data", { timeout: 120_000 }, async () => {
    const before = await build(true);
    const after = await build(false);
    expect(after.failed).toBe(before.failed);
    expect(after.objs.length).toBe(before.objs.length);
    // (Nothing besides the pixels waits for the painting: the data matches before any grid is read.)
    expect(data(after.objs) === data(before.objs), "the data before painting").toBe(true);
    const parts = after.objs.filter(isPart);
    expect(parts.length).toBeGreaterThan(5000);
    // Painted in reverse order (the last built first), then compared with the same painted at once.
    for (let i = parts.length - 1; i >= 0; i--) void parts[i]!.grid;
    const want = before.objs.filter(isPart);
    let differ = 0;
    for (let i = 0; i < parts.length; i++) if (parts[i]!.grid.join("\n") !== want[i]!.grid.join("\n")) differ++;
    expect(differ, "pictures that differ").toBe(0);
    expect(data(after.objs) === data(before.objs), "the data after painting").toBe(true);
  });
});
