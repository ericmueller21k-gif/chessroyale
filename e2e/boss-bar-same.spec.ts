import { expect, type Page, type TestInfo } from "@playwright/test";
import { BOSS_ROSTER, isPlayable } from "@chessroyale/core";
import { BOSS_KITS } from "../packages/app/src/characters/kits.ts";
import { plainLine } from "../packages/app/src/speech-icons.ts";
import { bossAloneFromHome, test } from "./helpers.ts";

/**
 * The phone boss bar is the same for every playable boss (docs/decisions/2026-10-24-boss-bar-same.md; Eric, Oct 24: "there should be
 * some continuity as far as the size and where their name sits… these box sizes should not change… these are the kind of checks
 * that should be… built"). One bar (99 px), one figure box (58 px wide, the bar's content tall), its feet on the same baseline for
 * every boss; the name, level, bars, status and free room in the same place for every boss. A boss is drawn at its own size
 * (4/3 or less for the big animals' steps, never below full size), and its drawing, at rest, stays 2 px inside the screen's left
 * edge, 2 px clear of the name column, and under the "BOSS · move N" text; it may hang out of the bar's top and left edge. Every
 * line a boss says sits inside its bar: one row when short, else two balanced rows, three only when two can't hold it, never four.
 * Every playable boss, at 320x568, 390x844 and 428x777, on a phone (a computer's bar is unchanged, so one run is enough there).
 */
const PLAYABLE = BOSS_ROSTER.filter(isPlayable);
const SIZES: [number, number][] = [[320, 568], [390, 844], [428, 777]];
const BASE = "/?debug&pace=quick&clock=60&laststand=0&brain=stockfish";
/** A pixel of slack for rounding (the box's edges are fractional at some widths). */
const TOL = 1;
/** The bar's height, the figure box's width and height (styles.css: the bar 99 px, the box 58 px wide, the bar's content tall). */
const BAR_H = 99;
const BOX_W = 58;
const BOX_H = 88;
/** The bar's bottom padding, under the feet: the figure's feet sit this far above the bar's bottom edge (styles.css). */
const FEET_PAD = 6;
/** The status's one line: taller than this, it has wrapped. */
const STATUS_ONE_LINE = 16;
/** The room at rest (px): the drawn left edge 2 px in from the screen, 2 px short of the name column, 1 px under the HUD's text. */
const SCREEN_CLEAR = 2;
const NAME_CLEAR = 2;
/** Rows of a bubble's text: the pitch of a 320 px line matches a 390 px line's (10.8 px). */
const ROW_PITCH_MIN = 10;

type Box = { x: number; y: number; w: number; h: number; r: number; b: number };
type Snap = {
  anim: string | null;
  bar: Box;
  box: Box;
  /** The figure's drawn pixels at rest (its idle frame), in screen pixels; null: none drawn. */
  pixels: { minX: number; maxX: number; minY: number; maxY: number } | null;
  name: Box;
  nameWhole: boolean;
  level: Box | null;
  rage: Box | null;
  passive: Box | null;
  status: Box;
  prop: Box | null;
  /** The "BOSS · move N" line's own text (the line above the bar), as drawn. */
  hudText: Box | null;
  board: Box | null;
  main: Box;
};
type LineRes =
  | { text: string; rows: number; pitch: number; bubble: Box; bar: Box; status: Box; name: Box; main: Box; fit: string | null }
  | { text: string; missing: true; seen: string };

/** Every box the bar is made of, as the page draws it, and the figure's drawn pixels at rest (its idle frame). */
const snap = (page: Page): Promise<Snap & { anim: string | null }> =>
  page.evaluate(() => {
    const box = (sel: string): { x: number; y: number; w: number; h: number; r: number; b: number } | null => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return r.width === 0 && r.height === 0 ? null : { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom };
    };
    const ch = document.querySelector(".boss-char.place-bar") as HTMLElement | null;
    const cv = document.querySelector(".boss-char-sprite") as HTMLCanvasElement | null;
    let pixels: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
    if (cv) {
      const d = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
      let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
      for (let y = 0; y < cv.height; y++)
        for (let x = 0; x < cv.width; x++)
          if (d[(y * cv.width + x) * 4 + 3]! > 0) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
      const cr = cv.getBoundingClientRect();
      const sx = cr.width / cv.width;
      const sy = cr.height / cv.height;
      if (maxX >= 0) pixels = { minX: cr.x + minX * sx, maxX: cr.x + (maxX + 1) * sx, minY: cr.y + minY * sy, maxY: cr.y + (maxY + 1) * sy };
    }
    const name = document.querySelector(".boss-name strong") as HTMLElement | null;
    const hud = document.querySelector(".screen.game .hud-row");
    let hudText: { x: number; y: number; w: number; h: number; r: number; b: number } | null = null;
    if (hud) {
      const walker = document.createTreeWalker(hud, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (/move/.test(n.textContent ?? "")) {
          const rg = document.createRange();
          rg.selectNodeContents(n);
          const r = rg.getBoundingClientRect();
          hudText = { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom };
          break;
        }
      }
    }
    return {
      anim: ch?.getAttribute("data-anim") ?? null,
      bar: box(".boss-bar")!,
      box: box(".boss-char.place-bar")!,
      pixels,
      name: box(".boss-name")!,
      nameWhole: !!name && name.scrollWidth <= name.clientWidth,
      level: box(".boss-level .lv-text"),
      rage: box(".boss-ult .rage-meter"),
      passive: box(".boss-passive > *"),
      status: box(".boss-next")!,
      prop: box(".boss-prop"),
      hudText,
      board: box(".board-wrap"),
      main: box(".boss-main")!,
    };
  });

/**
 * Says one line in the boss's voice (the test hook `sayBoss`, speech.tsx) and measures its bubble once it's drawn: its rows
 * (the distinct tops of its text's boxes), its box, and the bar, status, name column and room it has to fit in. Animations are
 * finished at once, so the box is measured at its final size.
 */
const sayLine = (page: Page, text: string): Promise<LineRes> =>
  page.evaluate(
    async ({ text, plain }) => {
      const say = (globalThis as { sayBoss?: (t: string) => boolean }).sayBoss;
      if (!say) return { text, missing: true as const, seen: "no hook" };
      // (A boss's own entrance line can take the box in the battle's first seconds, after the line is said: say it again then.)
      let el: HTMLElement | null = null;
      let taken = false;
      for (let attempt = 0; attempt < 2 && !(el && el.getAttribute("aria-label") === plain); attempt++) {
        taken = say(text);
        const deadline = performance.now() + 2500;
        while (performance.now() < deadline) {
          el = document.querySelector<HTMLElement>(".bc-bar-bubble");
          if (el && el.getAttribute("aria-label") === plain) break;
          await new Promise((r) => requestAnimationFrame(() => r(null)));
        }
      }
      if (!el || el.getAttribute("aria-label") !== plain) return { text, missing: true as const, seen: `taken ${taken}, bubbles ${document.querySelectorAll(".bc-bar-bubble").length}, shown ${el?.getAttribute("aria-label") ?? "none"}` };
      for (const a of el.getAnimations({ subtree: true })) {
        try {
          a.finish();
        } catch {
          // (A finished animation can't be finished again.)
        }
      }
      const rect = (e: Element) => {
        const b = e.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom };
      };
      const rg = document.createRange();
      rg.selectNodeContents(el);
      // (A row: the text's boxes whose tops lie within 3 px of each other; the rows' pitch is the closest two rows.)
      const tops = [...rg.getClientRects()].filter((q) => q.width > 0.5 && q.height > 0.5).map((q) => q.top).sort((a, b) => a - b);
      const rowTops: number[] = [];
      for (const t of tops) if (!rowTops.length || t - rowTops[rowTops.length - 1]! > 3) rowTops.push(t);
      const pitch = rowTops.length > 1 ? Math.min(...rowTops.slice(1).map((t, i) => t - rowTops[i]!)) : 0;
      return {
        text,
        rows: rowTops.length,
        pitch,
        bubble: rect(el),
        bar: rect(document.querySelector(".boss-bar")!),
        status: rect(document.querySelector(".boss-next")!),
        name: rect(document.querySelector(".boss-name")!),
        main: rect(document.querySelector(".boss-main")!),
        fit: el.dataset.fit ?? null,
      };
    },
    { text, plain: plainLine(text) },
  );

/** Whether the bar's bubble stays empty for `ms` (a boss's own line, its entrance or its idle moment, has taken the box before then). */
const bubbleQuiet = (page: Page, ms: number): Promise<boolean> =>
  page.evaluate(async (ms) => {
    const start = performance.now();
    while (performance.now() - start < ms) {
      if (document.querySelector(".bc-bar-bubble")) return false;
      await new Promise((r) => setTimeout(r, 100));
    }
    return true;
  }, ms);

/** The bubble's line count, box and room, and its one-row width, for a boss's every line. */
const linesOf = (kit: string): string[] => {
  const k = BOSS_KITS[kit]!;
  const all = [...Object.values(k.lines).flatMap((v) => [...(v ?? [])]), ...(k.fall ?? [])];
  return [...new Set(all)];
};

const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

/** A stacked sheet of the bars, one under another, labelled: the test's own picture for a person to compare. */
async function sheet(page: Page, title: string, bars: { name: string; png: Buffer }[], testInfo: TestInfo) {
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:12px;background:#f2efe9;font:600 13px system-ui;color:#222;width:420px">
    <div style="margin-bottom:8px">${title}</div>${bars
      .map((b) => `<div style="margin:0 0 10px"><div style="margin-bottom:2px">${b.name}</div><img src="data:image/png;base64,${b.png.toString("base64")}" style="display:block;width:100%;image-rendering:pixelated"></div>`)
      .join("")}</body>`;
  await page.setViewportSize({ width: 420, height: 900 });
  await page.setContent(html);
  await page.waitForLoadState("load");
  const png = await page.screenshot({ fullPage: true });
  await testInfo.attach(`${title}.png`, { body: png, contentType: "image/png" });
}

test("every playable boss's phone bar: one bar and one figure box for all, the figure at its size and in the room at rest, every line inside its bar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "one run is enough: a computer's bar is unchanged");
  test.setTimeout(3_000_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const snaps: Record<string, Partial<Record<number, Snap>>> = {};
  const lines: Record<string, Partial<Record<number, LineRes[]>>> = {};
  const pngs: Record<number, { name: string; png: Buffer }[]> = { 320: [], 390: [], 428: [] };
  const lineup: { name: string; png: Buffer; box: Box }[] = [];
  const boards: Record<number, Record<string, Box | null>> = { 320: {}, 390: {}, 428: {} };
  for (const def of PLAYABLE) {
    await page.goto(`${BASE}&boss=${def.id}`);
    await bossAloneFromHome(page);
    await expect(page.locator(".boss-bar")).toBeVisible({ timeout: 60_000 });
    snaps[def.id] = {};
    lines[def.id] = {};
    for (const [w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      // (The figure at rest: its idle frame drawn, nothing else of its moments.)
      await expect.poll(async () => (await snap(page)).anim, { timeout: 20_000 }).toBe("idle");
      await page.waitForTimeout(300);
      const s = await snap(page);
      snaps[def.id]![w] = s;
      boards[w]![def.id] = s.board;
      // (A clip of the page, not the element's own screenshot: the bar's live parts keep moving, so Playwright never finds it still.
      // Its box is waited for first: the bar is redrawn when a boss's screen settles.)
      await expect.poll(() => page.locator(".boss-bar").boundingBox(), { timeout: 20_000, message: `${def.id} at ${w}: the bar has a box` }).not.toBeNull();
      const at = (await page.locator(".boss-bar").boundingBox())!;
      pngs[w]!.push({ name: `${def.name}`, png: await page.screenshot({ clip: at }) });
      if (w === 390) {
        // The lineup's figure: from the screen's top to the bar's bottom, the left of the bar (the HUD's text is cut off in the picture).
        const fig = { x: at.x, y: 0, width: 96, height: at.y + at.height + 2 };
        lineup.push({ name: def.name, png: await page.screenshot({ clip: fig }), box: s.box });
      }
      // (The boss's own lines settle first: its entrance and its first idle moment take the box as the battle begins. The line check
      // starts once the box has been empty for a moment.)
      await expect.poll(() => bubbleQuiet(page, 1500), { timeout: 60_000, message: `${def.id} at ${w}: the boss is quiet` }).toBe(true);
      const out: LineRes[] = [];
      for (const text of linesOf(def.kit!)) out.push(await sayLine(page, text));
      lines[def.id]![w] = out;
    }
  }
  expect(errors, "no page errors").toEqual([]);

  for (const [w] of SIZES) {
    const at = (id: string) => snaps[id]![w]!;
    const all = PLAYABLE.map((d) => d.id);
    // One bar, one figure box, the same for every boss (±1 px).
    expect.soft(spread(all.map((id) => at(id).bar.h)), `${w}: the bar's height is the same for every boss`).toBeLessThanOrEqual(TOL);
    expect.soft(Math.abs(at(all[0]!).bar.h - BAR_H), `${w}: the bar is ${BAR_H} px`).toBeLessThanOrEqual(TOL);
    expect.soft(spread(all.map((id) => at(id).box.w)), `${w}: the figure box's width is the same`).toBeLessThanOrEqual(TOL);
    expect.soft(spread(all.map((id) => at(id).box.h)), `${w}: the figure box's height is the same`).toBeLessThanOrEqual(TOL);
    expect.soft(Math.abs(at(all[0]!).box.w - BOX_W), `${w}: the box is ${BOX_W} px wide`).toBeLessThanOrEqual(TOL);
    expect.soft(Math.abs(at(all[0]!).box.h - BOX_H), `${w}: the box is ${BOX_H} px tall`).toBeLessThanOrEqual(TOL);
    // The same place for the name, level, bars, status and the free room, for every boss (±1 px).
    for (const key of ["name", "status", "prop"] as const) {
      const xs = all.map((id) => at(id)[key]!);
      expect.soft(spread(xs.map((b) => b.x)), `${w}: ${key}'s x is the same`).toBeLessThanOrEqual(TOL);
      expect.soft(spread(xs.map((b) => b.y)), `${w}: ${key}'s y is the same`).toBeLessThanOrEqual(TOL);
    }
    expect.soft(spread(all.map((id) => at(id).prop!.w)), `${w}: the free room is the same width`).toBeLessThanOrEqual(TOL);
    expect.soft(spread(all.map((id) => at(id).prop!.h)), `${w}: the free room is the same height`).toBeLessThanOrEqual(TOL);
    for (const key of ["level", "rage"] as const) {
      const xs = all.map((id) => at(id)[key]!);
      expect.soft(spread(xs.map((b) => b.x)), `${w}: ${key} x is the same`).toBeLessThanOrEqual(TOL);
      expect.soft(spread(xs.map((b) => b.y)), `${w}: ${key} y is the same`).toBeLessThanOrEqual(TOL);
    }
    const withPassive = all.filter((id) => at(id).passive);
    expect.soft(spread(withPassive.map((id) => at(id).passive!.y)), `${w}: the passive bar's y is the same for every boss that has one`).toBeLessThanOrEqual(TOL);
    for (const id of all) {
      const s = at(id);
      const who = `${id} at ${w}`;
      expect.soft(s.nameWhole, `${who}: the name whole`).toBe(true);
      expect.soft(s.status.h, `${who}: the status on one line`).toBeLessThanOrEqual(STATUS_ONE_LINE);
      // The figure: feet on the bar's baseline, the same box.
      expect.soft(Math.abs(s.box.b - (s.bar.b - FEET_PAD)), `${who}: feet on the baseline`).toBeLessThanOrEqual(TOL);
      expect(s.pixels, `${who}: drawn`).not.toBeNull();
      const p = s.pixels!;
      // At rest: the drawing 2 px inside the screen's left edge, 2 px clear of the name column, under the HUD's text, and no lower than the
      // bar's bottom. It may hang out of the bar's top and left edge (Eric: "the only thing hanging out would be the boss").
      expect.soft(p.minX, `${who}: 2 px inside the screen's left edge`).toBeGreaterThanOrEqual(SCREEN_CLEAR);
      expect.soft(p.maxX, `${who}: 2 px clear of the name column`).toBeLessThanOrEqual(s.name.x - NAME_CLEAR);
      expect.soft(p.minY, `${who}: never covers the "BOSS · move N" text`).toBeGreaterThanOrEqual(s.hudText!.b + 1);
      expect.soft(p.maxY, `${who}: nothing of the figure below the bar`).toBeLessThanOrEqual(s.bar.b + TOL);
    }
    // Every line, inside the bar and beside the status, in at most three rows (two of them the same pitch as at 390); a one-row line
    // never past 60% of its room.
    for (const id of all) {
      for (const r of lines[id]![w] ?? []) {
        const who = `${id} at ${w}: "${r.text}"`;
        expect.soft("missing" in r ? `missing (seen: ${r.seen})` : "ok", `${who}: said and drawn`).toBe("ok");
        if ("missing" in r) continue;
        expect.soft(r.rows, `${who}: rows`).toBeLessThanOrEqual(3);
        expect.soft(r.rows, `${who}: at least one row`).toBeGreaterThanOrEqual(1);
        if (r.rows >= 2) expect.soft(r.pitch, `${who}: the rows' pitch`).toBeGreaterThanOrEqual(ROW_PITCH_MIN);
        expect.soft(r.bubble.x, `${who}: inside the bar, left`).toBeGreaterThanOrEqual(r.bar.x - TOL);
        expect.soft(r.bubble.r, `${who}: inside the bar, right`).toBeLessThanOrEqual(r.bar.r + TOL);
        expect.soft(r.bubble.y, `${who}: inside the bar, top`).toBeGreaterThanOrEqual(r.bar.y - TOL);
        expect.soft(r.bubble.b, `${who}: inside the bar, bottom`).toBeLessThanOrEqual(r.bar.b + TOL);
        expect.soft(r.bubble.y, `${who}: under the status, never over it`).toBeGreaterThanOrEqual(r.status.b - TOL);
        expect.soft(r.bubble.x, `${who}: from the name column's left edge`).toBeGreaterThanOrEqual(r.name.x - TOL);
        if (r.rows === 1) expect.soft(r.bubble.w, `${who}: a one-row line within 60% of its room`).toBeLessThanOrEqual(0.6 * r.main.w + TOL);
      }
    }
  }

  // The board's size for the PR: per size, the board's box.
  testInfo.annotations.push({ type: "boards", description: JSON.stringify(boards) });
  // A stacked sheet of every boss's bar at each size, and the lineup of the figures at 390 (each at its own size, feet on one line).
  for (const [w] of SIZES) await sheet(page, `boss bar at ${w}`, pngs[w]!, testInfo);
  await testInfo.attach("lineup.json", { body: Buffer.from(JSON.stringify(lineup.map((l) => ({ name: l.name, box: l.box })))), contentType: "application/json" });
  for (const l of lineup) await testInfo.attach(`lineup-${l.name}.png`, { body: l.png, contentType: "image/png" });
});
