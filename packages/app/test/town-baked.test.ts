import { afterEach, describe, expect, it, vi } from "vitest";
import { adoptOrKeep, loadBaked, type Baked, type BakedNet, type NetAsk } from "../src/town/baked.ts";
import { Pictures, type Page, type PageIO } from "../src/town/keep-pictures.ts";
import { BAKED_NAME, filesOf, manifestFrom, type TownManifest } from "../src/town/manifest.ts";
import { countPages, placePages } from "../src/town/paint-gl.ts";
import { ATLAS, type AtlasPage } from "../src/town/paint.ts";

/**
 * The town loads the build's baked pictures (Nov 28, the town's structure, phase 1b: town/baked.ts, town/manifest.ts,
 * docs/decisions/2026-11-28-town-load-baked.md): the manifest read and checked, this town's files fetched and decoded, each picture a
 * canvas standing in for it by name, the files placed whole on the atlas's layers; and anything odd gives nothing at all, so the town
 * paints on the device as before. (That the loaded town is the painted one, picture for picture: e2e/town-street.spec.ts.)
 */
const H = "0123456789ab";
/** A small town: a home both towns draw, a row only a player's draws, an admin's home, and a sidekick's sheet. */
const manifest = (): TownManifest => ({
  v: 1,
  files: [
    { name: `home-a.${H}.png`, group: "home:a", towns: ["player", "admin"], w: 200, h: 100, bytes: 3000 },
    { name: `row-x-n.player.${H}.png`, group: "row:x:N", towns: ["player"], w: 300, h: 50, bytes: 1000 },
    { name: `home-b.admin.${H}.png`, group: "home:b", towns: ["admin"], w: 120, h: 80, bytes: 500 },
    { name: `sidekick-moo.${H}.png`, group: "sidekick:moo", towns: ["player", "admin"], w: 640, h: 256, bytes: 700 },
  ],
  pictures: {
    "a#0": [0, 2, 2, 40, 30],
    // (The same pixels as a#0: one place, two names.)
    "a#1": [0, 2, 2, 40, 30],
    "roof:a:flat/0": [0, 50, 2, 60, 60],
    "glow:a": [0, 120, 2, 20, 20],
    "x#0": [1, 2, 2, 100, 40],
    "b#0": [2, 2, 2, 50, 50],
  },
  roofs: { "roof:a:flat": [[0, 0, 0, 30, 30, 0.5, 1.5, 0, 30, 0, 10, 10, 0, 0], [0, 0, 30, 20, 20, -1, 2]] },
  glows: { "glow:a": [0, 0, 5, 6, 21.5, 5, 0], "glow:none": [] },
  anims: { a: [100, 200], x: [1000], b: [1000] },
  tops: { "box-a": 41.5 },
  sheets: { moo: 3 },
});

const closed: string[] = [];
/** Files as blobs naming themselves; decoding gives a page of the manifest's size (or `size`, or fails); a stand-in names its rect. */
const io = (m: TownManifest, o: { fail?: string; width?: number } = {}): PageIO => ({
  decode: async (b) => {
    const name = await b.text();
    if (name === o.fail) throw new Error("decode");
    const f = m.files.find((x) => x.name === name)!;
    return { width: o.width ?? f.w, height: f.h, name, close: () => void closed.push(name) } as Page;
  },
  standIn: (page, x, y, w, h) => ({ of: `${(page as Page & { name: string }).name}@${x},${y}`, width: w, height: h, cuts: 0 }) as unknown as HTMLCanvasElement,
  fill: (c) => void ((c as unknown as { cuts: number }).cuts = 1),
});
const net = (m: TownManifest | null, o: { missing?: string } = {}): BakedNet & { asked: string[] } => {
  const asked: string[] = [];
  return {
    asked,
    manifest: async () => m,
    file: async (name) => {
      asked.push(name);
      if (name === o.missing) throw new Error(`${name}: 404`);
      return new Blob([name]);
    },
  };
};

describe("the baked town's manifest (town/manifest.ts)", () => {
  it("reads the build's manifest as it is, and names files as the bake names them", () => {
    const m = manifest();
    expect(manifestFrom(JSON.parse(JSON.stringify(m)))).toEqual(m);
    expect(BAKED_NAME.test(`manifest.${H}.json`)).toBe(true);
    expect(BAKED_NAME.test(`row-colosseum-row-s.player.${H}.png`)).toBe(true);
    for (const bad of ["order.json", "manifest.json", `../x.${H}.png`, `a/b.${H}.png`, `x.${H}.js`, `X.${H}.png`]) expect(BAKED_NAME.test(bad), bad).toBe(false);
  });
  it("anything else is no manifest: the app's page sent for a missing file, another version, a file's name that leaves the folder, a picture off its file, pieces not in sevens", () => {
    const broken: [string, (m: TownManifest) => unknown][] = [
      ["a page", () => "<!doctype html>"],
      ["nothing", () => null],
      ["another version", (m) => ({ ...m, v: 2 })],
      ["a part missing", (m) => ({ ...m, tops: undefined })],
      ["a name out of the folder", (m) => ({ ...m, files: [{ ...m.files[0]!, name: `../../api/x.${H}.png` }, ...m.files.slice(1)] })],
      ["a file of no size", (m) => ({ ...m, files: [{ ...m.files[0]!, w: 0 }, ...m.files.slice(1)] })],
      ["a town it doesn't know", (m) => ({ ...m, files: [{ ...m.files[0]!, towns: ["guest"] }, ...m.files.slice(1)] })],
      ["a picture off its file", (m) => ({ ...m, pictures: { ...m.pictures, "a#0": [0, 180, 2, 40, 30] } })],
      ["a picture on no file", (m) => ({ ...m, pictures: { ...m.pictures, "a#0": [9, 2, 2, 40, 30] } })],
      ["a roof's pieces not in sevens", (m) => ({ ...m, roofs: { r: [[0, 0, 0, 30, 30, 0.5]] } })],
      ["a glow's pieces not in sevens", (m) => ({ ...m, glows: { g: [0, 0, 5] } })],
      ["an animation of no frames", (m) => ({ ...m, anims: { a: [] } })],
      ["a top that's no number", (m) => ({ ...m, tops: { b: "1" } })],
      ["a sheet on no file", (m) => ({ ...m, sheets: { moo: 7 } })],
    ];
    for (const [what, make] of broken) expect(manifestFrom(JSON.parse(JSON.stringify(make(manifest())) ?? "null")), what).toBeNull();
  });
  it("a town's files: the pages it draws from, never the other town's own, nor the sidekicks' sheets", () => {
    expect(filesOf(manifest(), "player")).toEqual([0, 1]);
    expect(filesOf(manifest(), "admin")).toEqual([0, 2]);
  });
});

describe("loading the baked town (town/baked.ts)", () => {
  it("fetches this town's files alone, tells its share as each lands, and stands a canvas in for each picture asked for, on its file", async () => {
    const m = manifest();
    const n = net(m);
    const shares: number[] = [];
    const b = (await loadBaked("player", n, io(m), { onShare: (s) => shares.push(s) })) as Baked;
    expect(n.asked.sort()).toEqual([m.files[0]!.name, m.files[1]!.name]);
    // (Its bytes in so far, of this town's 4,000: one file, then both.)
    expect(shares.length).toBe(2);
    expect([0.25, 0.75]).toContain(shares[0]);
    expect(shares[1]).toBe(1);
    expect({ files: b.files, bytes: b.bytes }).toEqual({ files: 2, bytes: 4000 });
    // (A player's town has no picture of an admin's home, nor one the manifest doesn't name.)
    expect([b.has("a#0"), b.has("x#0"), b.has("b#0"), b.has("nope")]).toEqual([true, true, false, false]);
    expect(() => b.pic("b#0")).toThrow(/no picture/);
    const a0 = b.pic("a#0") as unknown as { of: string; width: number; height: number };
    expect(a0).toMatchObject({ of: `${m.files[0]!.name}@2,2`, width: 40, height: 30 });
    // (A new canvas each time it's asked for, as the device kept a canvas a painting; two names of the same pixels share a place.)
    const again = b.pic("a#0");
    const a1 = b.pic("a#1");
    const x0 = b.pic("x#0");
    expect(again).not.toBe(a0);
    const pages = b.pages();
    expect(pages.map((p) => [p.width, p.height, p.pics.length])).toEqual([[200, 100, 3], [300, 50, 1]]);
    expect(pages[0]!.pics).toEqual([{ src: a0, x: 2, y: 2 }, { src: again, x: 2, y: 2 }, { src: a1, x: 2, y: 2 }]);
    expect(pages[1]!.pics).toEqual([{ src: x0, x: 2, y: 2 }]);
    b.fill(x0);
    expect((x0 as unknown as { cuts: number }).cuts).toBe(1);
    closed.length = 0;
    b.close();
    expect(closed.sort()).toEqual([m.files[0]!.name, m.files[1]!.name]);
  });
  it("an admin's town fetches its own files", async () => {
    const m = manifest();
    const n = net(m);
    const b = (await loadBaked("admin", n, io(m))) as Baked;
    expect(n.asked.sort()).toEqual([m.files[0]!.name, m.files[2]!.name].sort());
    expect([b.has("b#0"), b.has("x#0")]).toEqual([true, false]);
  });
  it("all or nothing, and it says why (the review of phase 1b, S3): no manifest, a file missing, one that doesn't decode or isn't its size, or a browser that can't decode gives none of it, the decoded files let go", async () => {
    const m = manifest();
    expect(await loadBaked("player", net(null), io(m))).toBe("manifest");
    expect(await loadBaked("player", { manifest: () => Promise.reject(new Error("offline")), file: async () => new Blob([]) }, io(m))).toBe("manifest");
    expect(await loadBaked("player", net(m), null)).toBe("decode");
    const cases: [string, () => ReturnType<typeof loadBaked>][] = [
      ["file", () => loadBaked("player", net(m, { missing: m.files[1]!.name }), io(m))],
      ["decode", () => loadBaked("player", net(m), io(m, { fail: m.files[1]!.name }))],
      ["size", () => loadBaked("player", net(m), io(m, { width: 199 }))],
    ];
    for (const [why, make] of cases) {
      closed.length = 0;
      expect(await make()).toBe(why);
      await new Promise((go) => setTimeout(go));
      // (What did decode is closed: no page left in memory.)
      expect(closed).toContain(m.files[0]!.name);
    }
  });
  /** A network whose second file (the row) hangs until `land` is called; `asks`: what each fetch was handed. */
  const hung = (m: TownManifest) => {
    const asks: NetAsk[] = [];
    const o = {
      asks,
      land: (_b: Blob) => {},
      net: {
        manifest: async () => m,
        file: (name: string, ask: NetAsk) => (asks.push(ask), name === m.files[1]!.name ? new Promise<Blob>((ok) => (o.land = ok)) : Promise.resolve(new Blob([name]))),
      } satisfies BakedNet,
    };
    return o;
  };
  it("nothing arriving for the stall limit (a connection that hangs, S2): it stops waiting and says so, every fetch stopped and what had decoded let go; a slow connection still coming in is never cut off, nor does time with the page hidden count", async () => {
    vi.useFakeTimers();
    try {
      const m = manifest();
      const h = hung(m);
      closed.length = 0;
      let done: unknown = "waiting";
      const p = loadBaked("player", h.net, io(m), { stallMs: 3000 });
      void p.then((v) => (done = v));
      // (Slow, but moving: a few bytes every 2 s for 10 s.)
      for (let k = 0; k < 5; k++) {
        await vi.advanceTimersByTimeAsync(2000);
        h.asks[1]!.moved();
      }
      // (The page hidden, a phone's other app: its requests are held, and the wait doesn't count.)
      vi.stubGlobal("document", { visibilityState: "hidden" });
      await vi.advanceTimersByTimeAsync(20_000);
      vi.stubGlobal("document", { visibilityState: "visible" });
      await vi.advanceTimersByTimeAsync(2000);
      expect(done).toBe("waiting");
      expect(h.asks[1]!.signal.aborted).toBe(false);
      // (Nothing for 3 s, the page showing.)
      await vi.advanceTimersByTimeAsync(1500);
      expect(done).toBe("stall");
      expect(h.asks.every((a) => a.signal.aborted), "every fetch stopped").toBe(true);
      expect(closed).toEqual([m.files[0]!.name]);
      // (The file landing after all isn't decoded.)
      h.land(new Blob([m.files[1]!.name]));
      await vi.advanceTimersByTimeAsync(10);
      expect(closed).toEqual([m.files[0]!.name]);
      expect(vi.getTimerCount(), "its watch stopped").toBe(0);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
  it("the town closing mid-load (S1): the fetches are stopped, a file landing after isn't decoded, what had decoded is let go, and it's no fallback (null); closed before it starts, nothing is asked", async () => {
    const m = manifest();
    const h = hung(m);
    const shut = new AbortController();
    closed.length = 0;
    const p = loadBaked("player", h.net, io(m), { closed: shut.signal });
    await new Promise((go) => setTimeout(go));
    expect(h.asks.length).toBe(2);
    shut.abort();
    expect(await p).toBeNull();
    expect(h.asks.every((a) => a.signal.aborted)).toBe(true);
    h.land(new Blob([m.files[1]!.name]));
    await new Promise((go) => setTimeout(go));
    expect(closed).toEqual([m.files[0]!.name]);
    const n = net(m);
    expect(await loadBaked("player", n, io(m), { closed: shut.signal })).toBeNull();
    expect(n.asked).toEqual([]);
  });
  it("pages the painter can't take whole (no room on the atlas): each picture is handed to its keep, so none is left to upload on its first draw", () => {
    const pages = [
      { img: {}, width: 10, height: 10, pics: [{ src: "a", x: 0, y: 0 }, { src: "b", x: 5, y: 0 }] },
      { img: {}, width: 10, height: 10, pics: [{ src: "c", x: 0, y: 0 }] },
    ] as unknown as AtlasPage[];
    const kept: unknown[] = [];
    const keep = (c: unknown) => void kept.push(c);
    expect(adoptOrKeep({ adopt: () => true, keep }, pages, () => {})).toBe(true);
    expect(kept).toEqual([]);
    expect(adoptOrKeep({ adopt: () => false, keep }, pages, () => {})).toBe(false);
    expect(kept).toEqual(["a", "b", "c"]);
  });
});

describe("the baked pictures in the loading screen's list (keep-pictures.ts Pictures)", () => {
  it("a baked picture is listed, never handed to the painter's keep (its file is adopted whole); a roof's pieces come from the manifest, each sheet one canvas a roof", async () => {
    const m = manifest();
    const b = (await loadBaked("player", net(m), io(m))) as Baked;
    const kept: unknown[] = [];
    const P = new Pictures((c) => kept.push(c), null, b);
    const a0 = b.pic("a#0");
    P.add(a0);
    P.add(a0);
    expect(P.list).toEqual([a0]);
    const roof = P.bakedRoof("roof:a:flat");
    expect(roof.faces.map((f) => [f.whole, ...f.tris].map((p) => [p.sx, p.sy, p.w, p.h, p.ox, p.oy]))).toEqual([[[0, 0, 30, 30, 0.5, 1.5], [30, 0, 10, 10, 0, 0]], [[0, 30, 20, 20, -1, 2]]]);
    const sheets = new Set(roof.faces.flatMap((f) => [f.whole, ...f.tris].map((p) => p.cv)));
    expect(sheets.size, "one canvas for the roof's one sheet").toBe(1);
    expect([...sheets][0]).toMatchObject({ of: `${m.files[0]!.name}@50,2`, width: 60, height: 60 });
    // (Another roof of the same name, a second box of the same art: sheets of its own, as the device painted it twice.)
    expect(P.bakedRoof("roof:a:flat").faces[0]!.whole.cv).not.toBe(roof.faces[0]!.whole.cv);
    for (const f of roof.faces) for (const p of [f.whole, ...f.tris]) P.add(p.cv as HTMLCanvasElement);
    expect(P.list.length).toBe(2);
    P.roofDone(roof);
    P.glowDone([1, 2, 3, 4, 5, 6, 0]);
    expect([P.roofs, P.glows], "nothing noted for a next visit").toEqual([[], []]);
    expect(kept).toEqual([]);
  });
});

describe("whole pages on the atlas's layers (paint-gl.ts placePages, countPages)", () => {
  const S = ATLAS.page;
  it("places each page as it is, tallest first, one under another and side by side where both fit, none over another", () => {
    // The town's own shapes: files nearly a layer wide, some hundreds of pixels tall, and a few narrow ones.
    const sizes: [number, number][] = [[2047, 2042], [2036, 504], [2048, 695], [872, 116], [958, 171], [2002, 1059], [2035, 86], [1325, 158], [2048, 1156], [1912, 417]];
    const { at, tops } = placePages(sizes)!;
    expect(at.length).toBe(sizes.length);
    for (let i = 0; i < sizes.length; i++) {
      const [l, x, y] = at[i]!;
      expect(x >= 0 && y >= 0 && x + sizes[i]![0] <= S && y + sizes[i]![1] <= tops[l]! && tops[l]! <= S, `page ${i} on its layer`).toBe(true);
      for (let j = 0; j < i; j++) {
        const [l2, x2, y2] = at[j]!;
        const apart = l !== l2 || x + sizes[i]![0] <= x2 || x2 + sizes[j]![0] <= x || y + sizes[i]![1] <= y2 || y2 + sizes[j]![1] <= y;
        expect(apart, `pages ${i} and ${j} apart`).toBe(true);
      }
    }
    // (The tallest takes a layer nearly whole; the rest stack on three more, as their heights need: 12.6 M pixels on four layers of
    // 4.2 M. The two narrow ones go beside each other.)
    expect(tops.length).toBe(4);
    expect(at[3]![2], "the two narrow pages share a shelf").toBe(at[4]![2]);
    expect(at[3]![0]).toBe(at[4]![0]);
  });
  it("a page bigger than a layer can't be placed; none take no layer", () => {
    expect(placePages([[S + 1, 10]])).toBeNull();
    expect(placePages([[10, S + 1]])).toBeNull();
    expect(placePages([])).toEqual({ at: [], tops: [] });
    expect(placePages([[S, S], [S, S]])).toEqual({ at: [[0, 0, 0], [1, 0, 0]], tops: [S, S] });
  });
  it("the kept pictures' pages are counted with the room left under the adopted pages", () => {
    // A layer filled 1,500 px down by adopted pages has 548 px left: three shelves of 150 (padding included) go there, the fourth on a new page.
    const open = [{ shelves: [], top: 1500 }];
    expect(countPages([[2048, 150], [2048, 150], [2048, 150]], open)).toBe(0);
    expect(countPages([[2048, 150], [2048, 150], [2048, 150], [2048, 150]], open)).toBe(1);
    expect(open, "the pages there aren't changed").toEqual([{ shelves: [], top: 1500 }]);
    expect(countPages([[2048, 1024]], [{ shelves: [], top: S }])).toBe(1);
  });
});

describe("fetching the baked files (town/baked-files.ts)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("@chessroyale/core");
    vi.doUnmock("../src/install.ts");
    vi.resetModules();
  });
  const NAME = `manifest.${H}.json`;
  const wait = (ms: number) => new Promise((go) => setTimeout(go, ms));
  /** Each town's pages' names, as the build hands them to the app (`__TOWN_PAGES__`: vite.config.ts, from the manifest's `filesOf`). */
  const pagesOf = (m: TownManifest) => Object.fromEntries((["player", "admin"] as const).map((t) => [t, filesOf(m, t).map((i) => m.files[i]!.name)]));
  /** The module as a build with a baked town has it, over a pretend network. `o.afterMs`: home's wait (4 s on home). */
  const load = async (answer: (path: string, signal?: AbortSignal) => Response | Promise<Response>, o: { afterMs?: number } = {}) => {
    const asked: { path: string; low: boolean; signal?: AbortSignal }[] = [];
    vi.stubGlobal("__TOWN_PICTURES__", NAME);
    vi.stubGlobal("__TOWN_PAGES__", pagesOf(manifest()));
    vi.stubGlobal("fetch", async (path: string, init?: { priority?: string; signal?: AbortSignal }) => {
      asked.push({ path, low: init?.priority === "low", ...(init?.signal ? { signal: init.signal } : {}) });
      return answer(path, init?.signal);
    });
    if (o.afterMs !== undefined)
      vi.doMock("@chessroyale/core", async (orig) => {
        const core = await orig<typeof import("@chessroyale/core")>();
        return { ...core, TOWN_PICTURES: { ...core.TOWN_PICTURES, homeFetchAfterMs: o.afterMs } };
      });
    return { asked, paths: () => asked.map((a) => a.path.replace("/town-pictures/", "")), mod: await import("../src/town/baked-files.ts") };
  };
  const json = (x: unknown) => new Response(JSON.stringify(x), { headers: { "content-type": "application/json" } });
  const png = (name: string) => new Response(name, { headers: { "content-type": "image/png" } });
  /** An answer that never comes, until its request is stopped. */
  const never = (signal?: AbortSignal) => new Promise<Response>((_, no) => signal?.addEventListener("abort", () => no(new DOMException("stopped", "AbortError"))));

  it("reads this build's manifest once a page, by the name the build gave it", async () => {
    const m = manifest();
    const { asked, mod } = await load(() => json(m));
    expect(mod.TOWN_MANIFEST).toBe(NAME);
    expect(await mod.bakedManifest()).toEqual(m);
    expect(await mod.bakedManifest()).toEqual(m);
    expect(asked).toEqual([{ path: `/town-pictures/${NAME}`, low: false }]);
  });
  it("the app's page sent for a file the server no longer has is no file, and no manifest (asked again the next time)", async () => {
    let page = true;
    const m = manifest();
    const { asked, mod } = await load((path) => (page ? new Response("<!doctype html>", { headers: { "content-type": "text/html" } }) : path.endsWith(".json") ? json(m) : png(path)));
    expect(await mod.bakedManifest()).toBeNull();
    await expect(mod.bakedFile(m.files[0]!.name)).rejects.toThrow();
    page = false;
    expect(await mod.bakedManifest()).toEqual(m);
    expect(await (await mod.bakedFile(m.files[0]!.name)).text()).toBe(`/town-pictures/${m.files[0]!.name}`);
    expect(asked.filter((a) => a.path.endsWith(".json")).length).toBe(2);
  });
  it("the dev server's build is handed order.json: the manifest is the one it names, read fresh each time the town loads (an art edit bakes a new one); a name that isn't a baked file's is no manifest; home fetches nothing ahead", async () => {
    const m = manifest();
    let named: unknown = NAME;
    const asked: string[] = [];
    vi.stubGlobal("__TOWN_PICTURES__", "order.json");
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", async (path: string) => (asked.push(path), path.endsWith("order.json") ? json({ manifest: named, player: [] }) : json(m)));
    const mod = await import("../src/town/baked-files.ts");
    expect(await mod.bakedManifest()).toEqual(m);
    expect(asked).toEqual(["/town-pictures/order.json", `/town-pictures/${NAME}`]);
    // (The town opened again after an art edit: the new bake's manifest, by the name order.json gives now.)
    const NEXT = `manifest.${H.split("").reverse().join("")}.json`;
    named = NEXT;
    expect(await mod.bakedManifest()).toEqual(m);
    expect(asked.slice(2)).toEqual(["/town-pictures/order.json", `/town-pictures/${NEXT}`]);
    vi.resetModules();
    named = "../../api/me.json";
    asked.length = 0;
    const again = await import("../src/town/baked-files.ts");
    expect(await again.bakedManifest()).toBeNull();
    expect(asked).toEqual(["/town-pictures/order.json"]);
    // (Home's fetch ahead would make the dev server bake the town for every page that rests on home: none there.)
    vi.doMock("@chessroyale/core", async (orig) => {
      const core = await orig<typeof import("@chessroyale/core")>();
      return { ...core, TOWN_PICTURES: { ...core.TOWN_PICTURES, homeFetchAfterMs: 10 } };
    });
    vi.resetModules();
    asked.length = 0;
    (await import("../src/town/baked-files.ts")).fetchTownAhead("player");
    await wait(80);
    expect(asked).toEqual([]);
  });
  it("an error's answer is no file; a file's bytes are told as they arrive (the loading screen's stall watch); the town's request is its own, never joined to one home started at low priority", async () => {
    const { asked, mod } = await load((path, signal) => (path.includes("gone") ? new Response("", { status: 404, headers: { "content-type": "image/png" } }) : path.includes("slow") ? never(signal) : png("a")));
    await expect(mod.bakedFile(`gone.${H}.png`)).rejects.toThrow(/404/);
    let moves = 0;
    const b = await mod.bakedFile(`a.${H}.png`, { moved: () => void moves++ });
    expect([await b.text(), b.type, moves > 0]).toEqual(["a", "image/png", true]);
    // (Home's, on its way at low priority; the town asks for the same file: a request of its own at the usual priority. Home's stopped:
    // its own request ends, the town's is untouched.)
    const homes = new AbortController();
    const one = mod.bakedFile(`slow.${H}.png`, { low: true, signal: homes.signal });
    const towns = new AbortController();
    const two = mod.bakedFile(`slow.${H}.png`, { signal: towns.signal });
    const slow = asked.filter((a) => a.path.includes("/slow."));
    expect(slow.map((a) => a.low)).toEqual([true, false]);
    homes.abort();
    await expect(one).rejects.toThrow(/stopped/);
    expect(towns.signal.aborted).toBe(false);
    towns.abort();
    await expect(two).rejects.toThrow(/stopped/);
  });
  it("home's fetch ahead: after its wait, the manifest and this town's pages by the names the build handed it, one at a time, all at low priority (the manifest never read on home); stopped before its wait, none", async () => {
    const m = manifest();
    vi.stubGlobal("navigator", {});
    const { asked, paths, mod } = await load((path) => (path.endsWith(".json") ? new Response("not read", { headers: { "content-type": "application/json" } }) : png(path)), { afterMs: 60 });
    const stop = mod.fetchTownAhead("admin");
    await wait(20);
    expect(asked).toEqual([]);
    await wait(150);
    expect(paths()).toEqual([NAME, m.files[0]!.name, m.files[2]!.name]);
    expect(asked.every((a) => a.low)).toBe(true);
    stop();
    asked.length = 0;
    mod.fetchTownAhead("player")();
    await wait(150);
    expect(asked).toEqual([]);
  });
  it("home's fetch ahead never asks again for a file this page has read (after each match home shows again): only what's new to it", async () => {
    const m = manifest();
    vi.stubGlobal("navigator", {});
    const { asked, paths, mod } = await load((path) => (path.endsWith(".json") ? json(m) : png(path)), { afterMs: 10 });
    mod.fetchTownAhead("player");
    await wait(100);
    expect(paths()).toEqual([NAME, m.files[0]!.name, m.files[1]!.name]);
    // (Home again: nothing. An admin's town then: only its own home's page. A file the town's load read counts too.)
    asked.length = 0;
    mod.fetchTownAhead("player");
    await wait(100);
    expect(asked).toEqual([]);
    await mod.bakedFile(m.files[2]!.name);
    asked.length = 0;
    mod.fetchTownAhead("admin");
    await wait(100);
    expect(asked).toEqual([]);
  });
  it("home's fetch ahead is stopped as home closes or its queue shows (S1): the file on its way is stopped too, and nothing more is asked for", async () => {
    const m = manifest();
    vi.stubGlobal("navigator", {});
    const { asked, paths, mod } = await load((path, signal) => (path.endsWith(".json") ? json(m) : never(signal)), { afterMs: 10 });
    const stop = mod.fetchTownAhead("player");
    await wait(100);
    expect(paths()).toEqual([NAME, m.files[0]!.name]);
    expect(asked[1]!.signal?.aborted).toBe(false);
    stop();
    expect(asked[1]!.signal?.aborted, "the file on its way").toBe(true);
    await wait(50);
    expect(paths()).toEqual([NAME, m.files[0]!.name]);
  });
  it("home fetches nothing ahead on a connection that asks to save data, nor on a slow one (2g, 3g); on 4g it does", async () => {
    const m = manifest();
    const { asked, mod } = await load((path) => (path.endsWith(".json") ? json(m) : png(path)), { afterMs: 10 });
    for (const connection of [{ saveData: true, effectiveType: "4g" }, { effectiveType: "slow-2g" }, { effectiveType: "2g" }, { effectiveType: "3g" }]) {
      vi.stubGlobal("navigator", { connection });
      mod.fetchTownAhead("player");
      await wait(60);
      expect(asked, JSON.stringify(connection)).toEqual([]);
    }
    vi.stubGlobal("navigator", { connection: { saveData: false, effectiveType: "4g" } });
    mod.fetchTownAhead("player");
    await wait(60);
    expect(asked.length).toBe(3);
  });
  it("on a first visit home's fetch ahead waits until the service worker answers the page (S4: a file fetched before that passes it by, and isn't kept); with no worker to come, it doesn't wait", async () => {
    const m = manifest();
    const on = new Map<string, () => void>();
    const sw = { controller: null as object | null, addEventListener: (t: string, f: () => void) => void on.set(t, f), removeEventListener: (t: string) => void on.delete(t) };
    vi.stubGlobal("navigator", { serviceWorker: sw });
    const { asked, mod } = await load((path) => (path.endsWith(".json") ? json(m) : png(path)), { afterMs: 10 });
    mod.fetchTownAhead("player");
    await wait(80);
    expect(asked, "the worker still installing").toEqual([]);
    sw.controller = {};
    on.get("controllerchange")!();
    await wait(60);
    expect(asked.length).toBe(3);
    expect(on.size, "its listener let go").toBe(0);
    // (A page its worker answers already, any later visit: at once.)
    vi.resetModules();
    asked.length = 0;
    (await import("../src/town/baked-files.ts")).fetchTownAhead("player");
    await wait(60);
    expect(asked.length).toBe(3);
    // (No worker to come, install.ts `workerNever`: a browser without one, or its registration failed.)
    vi.resetModules();
    vi.doMock("../src/install.ts", () => ({ workerNever: Promise.resolve() }));
    sw.controller = null;
    asked.length = 0;
    (await import("../src/town/baked-files.ts")).fetchTownAhead("player");
    await wait(60);
    expect(asked.length).toBe(3);
  });
});
