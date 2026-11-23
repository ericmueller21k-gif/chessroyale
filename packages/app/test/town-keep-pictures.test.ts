import { describe, expect, it } from "vitest";
import { TOWN_PICTURES } from "@chessroyale/core";
import { Pictures, entryFor, manifestOf, packPictures, pictureKey, restore, save, type Entry, type Page, type PageIO, type SaveIO, type Shelf } from "../src/town/keep-pictures.ts";
import type { RoofArt } from "../src/town/box-draw.ts";

/**
 * Chess Town's pictures kept between visits (Nov 23, docs/decisions/2026-11-23-town-keep-pictures.md): a later visit gets back exactly
 * the first visit's pictures and roofs, in the loading screen's order, and anything odd paints as before, clearing the bad entry.
 */
type Pic = HTMLCanvasElement & { tag: string };
const pic = (tag: string, w: number, h: number) => ({ tag, width: w, height: h }) as unknown as Pic;

/** A shelf in memory: what's in it, how often it was cleared and written, and which calls fail. */
function shelfOf(v: unknown = undefined, fail: { read?: boolean; write?: boolean; slow?: number } = {}) {
  const s = {
    v,
    cleared: 0,
    writes: 0,
    read: async () => {
      if (fail.slow) await new Promise((go) => setTimeout(go, fail.slow));
      if (fail.read) throw new Error("no storage");
      return s.v;
    },
    write: async (e: Entry) => {
      if (fail.write) throw new DOMException("full", "QuotaExceededError");
      s.writes++;
      s.v = e;
    },
    clear: async () => {
      s.cleared++;
      s.v = undefined;
    },
  };
  return s satisfies Shelf;
}

/** Pages as blobs naming their page and size; decoding reads that back; a cut is the rect it was cut from. */
const saveIO: SaveIO = { compose: async (m, p) => new Blob([JSON.stringify([p, m.pages[p * 2], m.pages[p * 2 + 1]])]) };
const closed: number[] = [];
const pageIO = (o: { fail?: boolean; size?: number } = {}): PageIO => ({
  decode: async (b) => {
    if (o.fail) throw new Error("decode");
    const [p, w, h] = JSON.parse(await b.text()) as number[];
    return { width: o.size ?? w!, height: h!, p, close: () => void closed.push(p!) } as Page;
  },
  cut: (page, x, y, w, h) => ({ tag: `${(page as Page & { p: number }).p}:${x},${y} ${w}x${h}`, width: w, height: h }) as unknown as HTMLCanvasElement,
});

/** A first visit: 300 pictures, a roof of two faces over three of them, and the same picture kept twice (listed once). */
function firstVisit() {
  const keptByPainter: unknown[] = [];
  const P = new Pictures((c) => keptByPainter.push(c), null);
  const list = Array.from({ length: 300 }, (_, i) => pic(`p${i}`, 20 + ((i * 37) % 300), 10 + ((i * 53) % 400)));
  for (const c of list.slice(0, 200)) P.add(c);
  P.add(list[5]!);
  const roof: RoofArt = {
    faces: [
      { whole: { cv: list[200]!, sx: 0, sy: 0, w: 10, h: 10, ox: 0.5, oy: 1.5 }, tris: [{ cv: list[200]!, sx: 10, sy: 0, w: 5, h: 5, ox: 0, oy: 0 }] },
      { whole: { cv: list[201]!, sx: 2, sy: 3, w: 8, h: 9, ox: -1, oy: 2 }, tris: [] },
    ],
  };
  for (const f of roof.faces) for (const p of [f.whole, ...f.tris]) P.add(p.cv as Pic);
  P.roofDone(roof);
  for (const c of list.slice(202)) P.add(c);
  return { P, list, keptByPainter };
}
const KEY = pictureKey("abc123", "/assets/Town-x.js", "layout");

describe("Chess Town's kept pictures (keep-pictures.ts)", () => {
  it("packs pictures onto pages without overlap, a picture wider than a page on one its width", () => {
    const sizes = [...Array.from({ length: 400 }, (_, i) => [10 + ((i * 41) % 500), 10 + ((i * 29) % 300)] as const), [3000, 40] as const];
    const { at, pages } = packPictures(sizes, 2048);
    const rects = at.map(([p, x, y], i) => ({ p, x, y, w: sizes[i]![0], h: sizes[i]![1] }));
    for (const r of rects) {
      expect(r.x + r.w).toBeLessThanOrEqual(pages[r.p]![0]);
      expect(r.y + r.h).toBeLessThanOrEqual(pages[r.p]![1]);
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        if (a.p === b.p) expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
      }
    expect(pages.some(([w]) => w === 3000)).toBe(true);
  });

  it("a later visit gets every picture and roof back, in the loading screen's order", async () => {
    const { P, list } = firstVisit();
    expect(P.list.length).toBe(300);
    const shelf = shelfOf();
    const bytes = await save(shelf, KEY, P, saveIO);
    expect(bytes).toBeGreaterThan(0);
    expect(shelf.writes).toBe(1);
    const m = manifestOf(KEY, P, TOWN_PICTURES.pagePx);
    const from = (await restore(shelf, KEY, pageIO()))!;
    expect(from.count).toBe(300);
    // (The later visit runs the same jobs: each new picture is the last visit's at its place, the roof its kept pieces.)
    const later = new Pictures(() => undefined, from);
    for (let i = 0; i < 200; i++) later.add(later.next());
    const roof = later.roof();
    for (const f of roof.faces) for (const p of [f.whole, ...f.tris]) later.add(p.cv);
    while (later.list.length < 300) later.add(later.next());
    expect(later.matched()).toBe(true);
    const cutOf = (i: number) => `${m.pics[i * 5]}:${m.pics[i * 5 + 1]},${m.pics[i * 5 + 2]} ${list[i]!.width}x${list[i]!.height}`;
    expect(later.list.map((c) => (c as Pic).tag)).toEqual(list.map((_, i) => cutOf(i)));
    expect(roof.faces.map((f) => [f.whole, ...f.tris].map((p) => [(p.cv as Pic).tag, p.sx, p.sy, p.w, p.h, p.ox, p.oy]))).toEqual([
      [
        [cutOf(200), 0, 0, 10, 10, 0.5, 1.5],
        [cutOf(200), 10, 0, 5, 5, 0, 0],
      ],
      [[cutOf(201), 2, 3, 8, 9, -1, 2]],
    ]);
    // (A visit that ran fewer jobs than were kept doesn't match: its entry is cleared, Town.tsx.)
    const short = new Pictures(() => undefined, from);
    short.add(short.next());
    expect(short.matched()).toBe(false);
  });

  it("anything odd paints as before (null) and clears the entry", async () => {
    const { P } = firstVisit();
    const good = shelfOf();
    await save(good, KEY, P, saveIO);
    const entry = good.v as Entry;
    const m = entry.manifest;
    const odd = async (v: unknown, io: PageIO = pageIO(), fail = {}) => {
      const s = shelfOf(v, fail);
      const r = await restore(s, KEY, io);
      return { r, cleared: s.cleared, left: s.v };
    };
    // No storage at all, or no decoding: paints, nothing to clear.
    expect(await restore(null, KEY, pageIO())).toBeNull();
    expect(await restore(good, KEY, null)).toBeNull();
    // Nothing kept yet (a first visit): paints, nothing cleared.
    expect(await odd(undefined)).toEqual({ r: null, cleared: 0, left: undefined });
    // Storage that throws (private mode), another build's entry, entries that don't read as one: paints, cleared.
    const cases: [string, unknown, PageIO?, object?][] = [
      ["storage throws", entry, undefined, { read: true }],
      ["an older build's", { ...entry, manifest: { ...m, key: pictureKey("old", "/assets/Town-x.js", "layout") } }, undefined],
      ["another layout's (an admin's town)", { ...entry, manifest: { ...m, key: pictureKey("abc123", "/assets/Town-x.js", "admin layout") } }, undefined],
      ["not an entry", "garbage", undefined],
      ["another version", { ...entry, manifest: { ...m, v: 2 } }, undefined],
      ["a page short", { ...entry, blobs: entry.blobs.slice(1) }, undefined],
      ["an empty page", { ...entry, blobs: entry.blobs.map((b, i) => (i ? b : new Blob([]))) }, undefined],
      ["a picture off its page", { ...entry, manifest: { ...m, pics: m.pics.map((v, i) => (i === 3 ? 99999 : v)) } }, undefined],
      ["a picture count cut short", { ...entry, manifest: { ...m, pics: m.pics.slice(0, -2) } }, undefined],
      ["a roof's piece past the pictures", { ...entry, manifest: { ...m, roofs: [[[999, 0, 0, 1, 1, 0, 0]]] } }, undefined],
      ["a page that doesn't decode", entry, pageIO({ fail: true })],
      ["a page of the wrong size", entry, pageIO({ size: 7 })],
    ];
    for (const [what, v, io, fail] of cases) expect(await odd(v, io ?? pageIO(), fail ?? {}), what).toEqual({ r: null, cleared: 1, left: undefined });
    // A read slower than the loading screen waits: paints; what it gives later is let go.
    closed.length = 0;
    const slow = shelfOf(entry, { slow: 50 });
    expect(await restore(slow, KEY, pageIO(), 10)).toBeNull();
    await new Promise((go) => setTimeout(go, 100));
    expect(closed.length).toBe(m.pages.length / 2);
    // And the good one still reads.
    expect(entryFor(entry, KEY)).not.toBeNull();
  });

  it("keeps nothing (and clears the old) when it can't: no storage, a full one, too big, a page that fails, a later visit", async () => {
    const { P } = firstVisit();
    expect(await save(null, KEY, P, saveIO)).toBeNull();
    expect(await save(shelfOf(), KEY, P, null)).toBeNull();
    const full = shelfOf("old", { write: true });
    expect(await save(full, KEY, P, saveIO)).toBeNull();
    expect(full.cleared).toBe(1);
    const big = shelfOf("old");
    const huge: SaveIO = { compose: async () => ({ size: TOWN_PICTURES.maxMB * 1024 * 1024 + 1 }) as Blob };
    expect(await save(big, KEY, P, huge)).toBeNull();
    expect([big.writes, big.cleared, big.v]).toEqual([0, 1, undefined]);
    const broken = shelfOf("old");
    expect(await save(broken, KEY, P, { compose: async () => Promise.reject(new Error("the town closed")) })).toBeNull();
    expect([broken.writes, broken.cleared]).toEqual([0, 1]);
    // (A visit that loaded them keeps nothing new.)
    const shelf = shelfOf();
    await save(shelf, KEY, P, saveIO);
    const later = new Pictures(() => undefined, await restore(shelf, KEY, pageIO()));
    later.add(later.next());
    expect(await save(shelf, KEY, later, saveIO)).toBeNull();
  });

  it("is keyed by the app's version, the town's code and its layout", () => {
    const k = pictureKey("v1", "/assets/Town-a.js", "x|y");
    expect(pictureKey("v2", "/assets/Town-a.js", "x|y")).not.toBe(k);
    expect(pictureKey("v1", "/assets/Town-b.js", "x|y")).not.toBe(k);
    expect(pictureKey("v1", "/assets/Town-a.js", "x|z")).not.toBe(k);
    expect(pictureKey("v1", "/assets/Town-a.js", "x|y")).toBe(k);
  });
});
