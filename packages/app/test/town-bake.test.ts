import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BOSS_ADMIN_FIRST } from "@chessroyale/core";
import { TOWNS, bakeTown, type BakeResult, type TownKind, type TownManifest, type TownOrder } from "../../../scripts/bake-town.ts";
import { unpng } from "../../../scripts/png.ts";
import { BAKED_NAME, filesOf, manifestFrom } from "../src/town/manifest.ts";
import { ATLAS } from "../src/town/paint.ts";
import { SHEET_ANIMS, sidekickFrame } from "../src/town/pictures.ts";
import { SIDEKICK_SHEETS, type SidekickSheet } from "../src/town/sidekick-sheets.ts";

/**
 * The build bakes Chess Town's pictures (Nov 28, the town's structure, phase 1a: scripts/bake-town.ts, docs/decisions/2026-11-28-town-bake.md).
 * Every picture the town's loading screen keeps (town/pictures.ts: the list render.ts `plan` reads), painted here by the device's
 * painting code, is in the baked files pixel for pixel, at the place the manifest gives it, in a player's town and an admin's; with it
 * the roofs' and glows' pieces, the animations' frame times and the boxes' tops. And each frame of each sidekick the town shows (phase
 * 1c), cut from its sheet. (That the device's canvases are this list's pictures, in this order: e2e/perf.spec.ts, by the town's own
 * picture hash.)
 */
let dir = "";
let baked: BakeResult;
let manifest: TownManifest;
let order: TownOrder;
const pages = new Map<number, { w: number; h: number; data: Uint8Array }>();

const page = (i: number) => {
  let p = pages.get(i);
  if (!p) pages.set(i, (p = unpng(readFileSync(join(dir, manifest.files[i]!.name)))));
  return p;
};

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "town-bake-test-"));
  baked = await bakeTown(dir);
  manifest = JSON.parse(readFileSync(join(dir, baked.manifestName), "utf8")) as TownManifest;
  order = JSON.parse(readFileSync(join(dir, "order.json"), "utf8")) as TownOrder;
}, 180_000);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("the build bakes Chess Town's pictures (Nov 28, phase 1a)", () => {
  for (const kind of TOWNS)
    it(`${kind === "admin" ? "an admin" : "a player"}'s town: every picture its loading screen keeps is in the baked files, pixel for pixel, with its roofs' and glows' pieces, its animations' times and its boxes' tops`, { timeout: 180_000 }, async () => {
      // This town's list, painted here (the device's own painting code, as this test's modules have it: not the bake's bundle).
      vi.resetModules();
      vi.doMock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: kind === "admin" }));
      const { bakeList } = await import("../src/town/bake.ts");
      const { GLOW_GAP } = await import("../src/town/paint-jobs.ts");
      const want = bakeList();
      expect(want.pictures.size, "pictures by name").toBeGreaterThan(2000);
      const names = Object.keys(manifest.pictures);
      let missing = 0;
      let differ = 0;
      let elsewhere = 0;
      const bad: string[] = [];
      for (const [name, { px }] of want.pictures) {
        const at = manifest.pictures[name];
        if (!at) {
          missing++;
          continue;
        }
        const [f, x, y, w, h] = at;
        // (On a file this town fetches.)
        if (!manifest.files[f]!.towns.includes(kind)) elsewhere++;
        const pg = page(f);
        let same = w === px.w && h === px.h && x + w <= pg.w && y + h <= pg.h;
        for (let j = 0; same && j < h; j++) {
          const a = Buffer.from(pg.data.buffer, pg.data.byteOffset + ((y + j) * pg.w + x) * 4, w * 4);
          const b = Buffer.from(px.data.buffer, px.data.byteOffset + j * w * 4, w * 4);
          same = a.equals(b);
        }
        if (!same && differ++ < 5) bad.push(name);
      }
      expect(missing, "pictures not in the manifest").toBe(0);
      expect(differ, `pictures whose baked pixels differ (${bad.join(", ")})`).toBe(0);
      expect(elsewhere, "pictures on a file this town doesn't fetch").toBe(0);
      // The loading screen's own order (the device's canvases, a name again where it paints one picture twice).
      expect(order[kind].map((i) => names[i])).toEqual(want.order);
      expect(want.order.length).toBeGreaterThanOrEqual(want.pictures.size);
      // What the renderer needs beside the pixels: each as this town works it out.
      for (const k of ["roofs", "glows", "anims", "tops"] as const) {
        expect(Object.keys(want[k]).length, k).toBeGreaterThan(50);
        for (const [key, v] of Object.entries(want[k])) if (JSON.stringify(manifest[k][key]) !== JSON.stringify(v)) throw new Error(`${k} "${key}" differs`);
      }
      // A roof's pieces lie on its sheets (its `/<n>` pictures), a glow's on its own picture.
      for (const [roof, faces] of Object.entries(want.roofs))
        for (const f of faces)
          for (let j = 0; j < f.length; j += 7) {
            const sheet = manifest.pictures[`${roof}/${f[j]}`]!;
            expect(f[j + 1]! + f[j + 3]! <= sheet[3] && f[j + 2]! + f[j + 4]! <= sheet[4], `${roof}: a piece on its sheet`).toBe(true);
          }
      let pieces = 0;
      let glowsOff = 0;
      for (const [glow, g] of Object.entries(want.glows)) {
        const sheet = manifest.pictures[glow];
        expect(!!sheet, `${glow}: a picture only with pieces`).toBe(g.length > 0);
        for (let j = 0; sheet && j < g.length; j += 7) expect(g[j]! + g[j + 2]! <= sheet[3] && g[j + 1]! + g[j + 3]! <= sheet[4], `${glow}: a piece on its sheet`).toBe(true);
        // (Nov 26; here from the paint workers' test, gone with them: none of a glow's pieces within GLOW_GAP of another, the atlas's
        // own padding, so a smoothed draw of one reads clear pixels round it; and nothing drawn outside the pieces.)
        const px = want.pictures.get(glow)?.px;
        if (!px) continue;
        const own = new Int32Array(px.w * px.h).fill(-1);
        for (let k = 0; k < g.length; k += 7) {
          pieces++;
          const [sx, sy, w, h] = g.slice(k, k + 4) as [number, number, number, number];
          for (let y = Math.max(0, sy - GLOW_GAP); y < Math.min(px.h, sy + h + GLOW_GAP); y++)
            for (let x = Math.max(0, sx - GLOW_GAP); x < Math.min(px.w, sx + w + GLOW_GAP); x++) {
              if (x >= sx && y >= sy && x < sx + w && y < sy + h) own[y * px.w + x] = k;
              else if (own[y * px.w + x] !== -1) glowsOff++;
            }
        }
        for (let i = 0; i < own.length; i++) if (own[i]! < 0 && px.data[i * 4 + 3]) glowsOff++;
      }
      expect(pieces, "the glows' pieces").toBeGreaterThan(2000);
      expect(glowsOff, "glow pieces too near another, or pixels outside a glow's pieces").toBe(0);
      // The sidekicks' frames (phase 1c): every frame of every sheet this town shows is a picture of its own, the sheet's pixels
      // exactly (the device used to fetch the sheet and cut it), on a file of that sidekick's that this town fetches. Named by the
      // sheet's name in SIDEKICK_SHEETS: Rivet's is `timber`, whatever his art's id (an admin's town never drew him until this).
      expect(want.sheets.length).toBeGreaterThanOrEqual(14);
      expect(want.sheets.includes("timber"), "Rivet, Timber's kid: in an admin's town only").toBe(kind === "admin");
      let frames = 0;
      for (const id of want.sheets) {
        const sheet = (SIDEKICK_SHEETS as Record<string, SidekickSheet>)[id]!;
        const src = unpng(readFileSync(new URL(`../src/town/sidekicks/${id}.png`, import.meta.url)));
        SHEET_ANIMS.forEach((anim, row) =>
          sheet.ms[anim].forEach((_, col) => {
            frames++;
            const name = sidekickFrame(id, anim, col);
            const at = manifest.pictures[name];
            if (!at) throw new Error(`${name}: not in the manifest`);
            const [f, x, y, w, h] = at;
            const file = manifest.files[f]!;
            expect([file.group, file.towns.includes(kind), w, h], name).toEqual([`sidekick:${id}`, true, sheet.w, sheet.h]);
            const pg = page(f);
            for (let j = 0; j < h; j++) {
              const a = Buffer.from(pg.data.buffer, pg.data.byteOffset + ((y + j) * pg.w + x) * 4, w * 4);
              const b = Buffer.from(src.data.buffer, src.data.byteOffset + ((row * sheet.h + j) * src.w + col * sheet.w) * 4, w * 4);
              if (!a.equals(b)) throw new Error(`${name}: not its sheet's pixels (row ${j})`);
            }
          }),
        );
      }
      expect(frames, "sidekick frames").toBeGreaterThan(800);
      expect(want.pictures.size + frames, "the town's pictures by name: painted, and the sidekicks' frames").toBe(baked.totals.towns[kind].names);
      vi.doUnmock("../src/town/admin-town.ts");
    });

  it("each file is named by its group and its pixels, holds its pictures as the atlas packs them (clear pixels round each, nothing else on the page), and no town fetches a file it draws nothing of", () => {
    const { pad, big, page: side } = ATLAS;
    const on = new Map<number, Set<string>>();
    for (const [f, x, y, w, h] of Object.values(manifest.pictures)) on.set(f, (on.get(f) ?? new Set()).add(`${x},${y},${w},${h}`));
    manifest.files.forEach((file, i) => {
      expect(file.name, "a group's name, a hash, .png").toMatch(/^[a-z0-9-]+(\.(player|admin))?\.[0-9a-f]{12}\.png$/);
      expect(file.name.startsWith(file.group.replace(/[^a-z0-9]+/gi, "-").toLowerCase()), `${file.name}: named by its group`).toBe(true);
      expect(file.name.includes(`.${file.towns[0]}.`), `${file.name}: named by its one town`).toBe(file.towns.length === 1);
      expect(file.towns.length).toBeGreaterThan(0);
      const pg = page(i);
      expect([pg.w, pg.h, file.bytes]).toEqual([file.w, file.h, readFileSync(join(dir, file.name)).length]);
      expect(file.name, "named by its pixels").toContain(createHash("sha256").update(`${pg.w}x${pg.h}:`).update(pg.data).digest("hex").slice(0, 12));
      expect(pg.w <= side && pg.h <= side || on.get(i)!.size === 1, `${file.name}: no bigger than an atlas page`).toBe(true);
      // Each picture's box grown by the atlas's padding: none overlaps another's picture, and nothing is drawn outside the pictures.
      const own = new Int32Array(pg.w * pg.h).fill(-1);
      const rects = [...on.get(i)!].map((r) => r.split(",").map(Number) as [number, number, number, number]);
      rects.forEach(([x, y, w, h], k) => {
        if (w > big || h > big) expect([x, y, w, h, rects.length], `${file.name}: a big picture alone on a page its size`).toEqual([0, 0, pg.w, pg.h, 1]);
        else expect(x >= pad && y >= pad && x + w + pad <= pg.w && y + h + pad <= pg.h, `${file.name}: padded inside its page`).toBe(true);
        for (let yy = y; yy < y + h; yy++) own.fill(k, yy * pg.w + x, yy * pg.w + x + w);
      });
      let near = 0;
      rects.forEach(([x, y, w, h], k) => {
        for (let yy = Math.max(0, y - pad); yy < Math.min(pg.h, y + h + pad); yy++)
          for (let xx = Math.max(0, x - pad); xx < Math.min(pg.w, x + w + pad); xx++) {
            const o = own[yy * pg.w + xx]!;
            if (o >= 0 && o !== k) near++;
          }
      });
      expect(near, `${file.name}: pictures within the padding of another`).toBe(0);
      let stray = 0;
      for (let p = 0; p < own.length; p++) if (own[p]! < 0 && pg.data[p * 4 + 3]) stray++;
      expect(stray, `${file.name}: pixels drawn outside its pictures`).toBe(0);
    });
    // A home of a boss in the game for admins first is an admin's file; a player's town fetches none of it.
    const groupsOf = (kind: TownKind) => new Set(manifest.files.filter((f) => f.towns.includes(kind)).map((f) => f.group));
    for (const id of BOSS_ADMIN_FIRST) expect([groupsOf("admin").has(`home:${id}`), groupsOf("player").has(`home:${id}`)], id).toEqual([true, false]);
    for (const g of ["home:alfil", "park", "colosseum", "props", "row:south-st:S", "sidekick:boingo"]) expect(groupsOf("player").has(g), g).toBe(true);
    // (Rivet's and Tick's frames, the admins-first bosses' kids: an admin's files.)
    for (const g of ["sidekick:timber", "sidekick:blitz"]) expect([groupsOf("admin").has(g), groupsOf("player").has(g)], g).toEqual([true, false]);
    // The printed totals are the files'.
    expect(baked.totals.bytes).toBe(manifest.files.reduce((s, f) => s + f.bytes, 0));
    expect(baked.totals.files).toBe(manifest.files.length);
    expect(baked.totals.names).toBe(Object.keys(manifest.pictures).length);
  });

  it("the manifest is named by its contents (phase 1b: the build hands the app that name), reads as the app reads one, and every file is named as the service worker keeps one", () => {
    const text = readFileSync(join(dir, baked.manifestName), "utf8");
    expect(baked.manifestName).toBe(`manifest.${createHash("sha256").update(text).digest("hex").slice(0, 12)}.json`);
    expect(order.manifest, "order.json names it (a check's and a tool's way in)").toBe(baked.manifestName);
    expect(manifestFrom(JSON.parse(text)), "the app's own check of a manifest (town/manifest.ts)").toEqual(manifest);
    for (const name of [baked.manifestName, ...manifest.files.map((f) => f.name)]) expect(BAKED_NAME.test(name), name).toBe(true);
    // A player's town's pages: what its loading screen fetches (its fourteen sidekicks' among them since phase 1c; none of an admin's own).
    const fetched = filesOf(manifest, "player").map((i) => manifest.files[i]!);
    expect(fetched.length).toBeGreaterThan(20);
    expect(fetched.filter((f) => f.group.startsWith("sidekick:")).length).toBe(14);
    expect(fetched.filter((f) => !f.towns.includes("player"))).toEqual([]);
    // (The bake's inputs, for the dev server: the list's module and a house's among them.)
    expect(baked.inputs.some((p) => p.endsWith("/src/town/pictures.ts")) && baked.inputs.some((p) => p.includes("/src/town/houses/"))).toBe(true);
  });
});
