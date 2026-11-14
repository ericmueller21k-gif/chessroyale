import { mkdirSync, writeFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { legalMoves } from "@chessroyale/chess";
import { asServerAdmin, submitMove, test } from "../helpers.ts";

// Visual QA capture (review/recluse-visual-qa): the room's challenge, Fill with 3 bots, the whole fight, a still + boxes at each beat.
const OUT = process.env.QA_OUT ?? "qa-out";
const canvas = (p: Page) => p.locator("canvas.town-canvas");
const room = (p: Page) => p.locator("canvas.town-shop-canvas");
const hook = (p: Page) => p.evaluate(() => (window as any).__hiddenRoom?.() ?? null);
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const metrics: Record<string, unknown> = {};
let tag = "";
const log: string[] = [];

const SELS = [".board-row > .board-wrap", ".mv-side", ".under-board", ".bp", ".you-pawn", ".dk-mate-art", ".gk-unit", ".boss-char", ".boss-bar", ".boss-dock", ".tower-side", ".bp-tower", ".gchat-field", ".rc-stage", ".boss-level"];
async function still(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  metrics[name] = await page.evaluate((sels) => {
    const box = (e: Element) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); };
    const vis = (e: Element) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05; };
    const boxes = Object.fromEntries(sels.map((s) => [s, [...document.querySelectorAll(s)].filter(vis).map(box)]));
    const bubbles = [...document.querySelectorAll('[class*="bubble"], .cs-say, [class*="speech"], [class*="voice"]')].filter(vis).map((e) => ({ cls: e.className.toString().slice(0, 60), text: (e.textContent ?? "").slice(0, 80), box: box(e) }));
    // the drawn top of each boss figure canvas
    const figs = [...document.querySelectorAll(".boss-char canvas, .cs-fig canvas, .rc-stage canvas")].filter(vis).map((cv: any) => {
      let top = -1, left = cv.width, right = -1;
      try {
        const px = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
        for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (px[(y * cv.width + x) * 4 + 3] > 0) { if (top < 0) top = y; left = Math.min(left, x); right = Math.max(right, x); }
      } catch {}
      const r = cv.getBoundingClientRect();
      return { parent: cv.parentElement?.className?.toString().slice(0, 50), box: box(cv), drawnTop: top < 0 ? null : Math.round(r.top + (top / cv.height) * r.height), drawnX: right < 0 ? null : [Math.round(r.left + (left / cv.width) * r.width), Math.round(r.left + ((right + 1) / cv.width) * r.width)] };
    });
    const quads = [0, 1, 2, 3].map((q) => document.querySelector(`.rc-q${q} .hb-board`)).filter(Boolean).map((e) => box(e!));
    return { vw: innerWidth, vh: innerHeight, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, boxes, bubbles, figs, quads, step: document.querySelector(".rc-stage")?.getAttribute("data-step") ?? null, phase: (window as any).match?.phase.kind ?? null, form: (window as any).match?.boss?.form ?? null, formStep: (window as any).match?.boss?.formStep ?? null };
  }, SELS);
  writeFileSync(`${OUT}/${tag}-metrics.json`, JSON.stringify(metrics, null, 1));
  writeFileSync(`${OUT}/${tag}-log.txt`, log.join("\n"));
}
const bubbleUp = (page: Page, timeout: number) => expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.bc-bubble, [class*="bubble"]')].some((e) => (e.textContent ?? "").trim().length > 3 && e.getBoundingClientRect().width > 0 && Number(getComputedStyle(e).opacity) > 0.5)), { timeout }).toBe(true).then(() => true, () => false);

async function shopAt(page: Page, kind: string, s?: unknown) {
  const xy = await page.evaluate(([k, q]) => (window as any).__shopAt?.(k as string, q) ?? null, [kind, s] as const);
  const cv = xy && (await room(page).boundingBox());
  return xy && cv ? { x: cv.x + xy.x, y: cv.y + xy.y } : null;
}
async function stairsCard(page: Page, to: string) {
  const card = page.getByRole("dialog", { name: "Stairs", exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    if (!(await shopAt(page, "pass", to))) await page.evaluate((t) => (window as any).__shopLook?.("pass", t), to);
    const at = await shopAt(page, "pass", to);
    expect(at).not.toBeNull();
    await page.mouse.click(at!.x, at!.y);
    await expect(card).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 40_000 });
  return card;
}
async function climb(page: Page, to: string) {
  await expect(async () => {
    if ((await room(page).getAttribute("data-part")) === to) return;
    const card = await stairsCard(page, to);
    await card.getByRole("button", { name: "Go up" }).click();
    await expect(room(page)).toHaveAttribute("data-part", to, { timeout: 6000 });
  }).toPass({ timeout: 45_000 });
  await expect(room(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
}

test("QA: his whole fight, stills at each beat", async ({ page }) => {
  test.setTimeout(900_000);
  const size = process.env.QA_SIZE?.split("x").map(Number);
  if (size && test.info().project.name === "desktop") await page.setViewportSize({ width: size[0]!, height: size[1]! });
  const vp = page.viewportSize()!;
  tag = test.info().project.name === "phone" ? "phone" : `desktop${vp.width}`;
  page.on("pageerror", (e) => log.push("pageerror " + e.message));
  const townroom = `qa-${tag}-${Date.now().toString(36)}`;
  await page.goto("/");
  await asServerAdmin(page, "ops");
  await page.goto(`/town?sky=day&debug&townroom=${townroom}`);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await page.evaluate(() => (window as any).__townGlide?.("recluse"));
  const homeAt = async () => {
    const xy = await page.evaluate(() => (window as any).__townAt?.("home", "recluse") ?? null);
    const cv = xy && (await canvas(page).boundingBox());
    return xy && cv ? { x: cv.x + xy.x, y: cv.y + xy.y } : null;
  };
  await expect.poll(homeAt, { timeout: 20_000 }).not.toBeNull();
  await page.waitForTimeout(1200);
  const wcard = page.getByRole("dialog", { name: "The Walk-up", exact: true });
  await expect(async () => {
    if (await wcard.isVisible()) return;
    const at = await homeAt();
    await page.mouse.click(at!.x, at!.y);
    await expect(wcard).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  await wcard.getByRole("button", { name: "Go in" }).click();
  await expect(room(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  await climb(page, "landing");
  await climb(page, "top");
  const his = page.getByRole("dialog", { name: "Hidden Boss", exact: true });
  await expect(async () => {
    if (await his.isVisible()) return;
    const at = await shopAt(page, "square", [4, 4]);
    await page.mouse.click(at!.x, at!.y);
    await expect(his).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 30_000 });
  await his.getByRole("button", { name: "Challenge" }).click();
  await expect(page.locator(".hb-count")).toHaveText(/1 of 4/, { timeout: 10_000 });
  await his.getByRole("button", { name: "Fill with 3 bots" }).click();
  await expect(page).toHaveURL(/\/lobby\/[A-Z2-9]{5}/, { timeout: 90_000 });
  await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
  const trophy = page.getByRole("button", { name: "Win this form (testing)" });
  const teamMove = async () => {
    await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
    const turn = await page.evaluate(() => { const m = (window as any).match; return { fen: m.phase.board.fen as string, allowed: (m.phase.allowed ?? null) as string[] | null }; });
    const quiet = legalMoves(turn.fen).filter((m) => /^[a-h][27]/.test(m) && !/^[de]/.test(m));
    await submitMove(page, turn.allowed?.[0] ?? quiet[0] ?? legalMoves(turn.fen)[0], turn.fen);
    await expect.poll(() => page.evaluate((f) => (window as any).match?.phase.kind !== "play" || (window as any).match?.phase.board.fen !== f, turn.fen), { timeout: 60_000 }).toBe(true);
  };
  // 1 the kid
  await page.waitForTimeout(1500);
  await still(page, "01-kid-start");
  log.push("kid line natural: " + (await bubbleUp(page, 25_000)));
  await still(page, "02-kid-line");
  // 2 growing: play until formStep 2 (13), then 4 (20)
  const formStep = () => page.evaluate(() => (window as any).match?.boss?.formStep ?? 0);
  for (let i = 0; i < 12 && (await formStep()) < 2; i++) await teamMove();
  await page.waitForTimeout(2500);
  await still(page, "03-kid-13");
  for (let i = 0; i < 12 && (await formStep()) < 4; i++) await teamMove();
  await page.waitForTimeout(2500);
  await still(page, "04-kid-20");
  log.push("kid20 line: " + (await bubbleUp(page, 20_000)));
  await still(page, "05-kid-20-line");
  // 3 beat the kid
  await expect(trophy).toBeEnabled({ timeout: 60_000 });
  await trophy.click();
  await teamMove();
  await expect.poll(() => page.evaluate(() => (window as any).match?.boss?.result ?? null), { timeout: 90_000 }).toBe("crowd");
  await page.waitForTimeout(1000);
  await still(page, "06-kid-beaten");
  await page.waitForTimeout(2500);
  await still(page, "07-kid-grows-up");
  await expect.poll(() => page.evaluate(() => (window as any).match?.boss?.form ?? "adult"), { timeout: 30_000 }).toBe("adult");
  await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
  await page.waitForTimeout(1500);
  await still(page, "08-man-start");
  log.push("man line: " + (await bubbleUp(page, 40_000)));
  await still(page, "09-man-line");
  // 4 his fall
  await expect(trophy).toBeEnabled({ timeout: 60_000 });
  await trophy.click();
  await teamMove();
  await expect.poll(() => page.evaluate(() => (window as any).match?.boss?.result ?? null), { timeout: 90_000 }).toBe("crowd");
  await page.waitForTimeout(700);
  await still(page, "10-man-fall");
  // 5 cutscene: a still ~1.8 s after each new line, until the phase change
  await expect.poll(() => page.evaluate(() => document.body.classList.contains("cs-on")), { timeout: 60_000 }).toBe(true);
  await page.waitForTimeout(1200);
  await still(page, "11-cutscene-start");
  const seen = new Set<string>();
  let n = 0;
  let t0 = 0;
  for (const until = Date.now() + 120_000; Date.now() < until; ) {
    const st = await page.evaluate(() => ({ k: (window as any).match?.phase.kind, say: [...document.querySelectorAll(".cs-say .speech-line")].map((e) => e.textContent ?? "").join("|") }));
    if (st.k === "phaseChange") { t0 = Date.now(); break; }
    if (st.say && !seen.has(st.say) && n < 4) {
      seen.add(st.say);
      log.push("cut line: " + st.say);
      await page.waitForTimeout(1800);
      if ((await phase(page)) !== "phaseChange") { n++; await still(page, `12-cutscene-line${n}`); }
    }
    await page.waitForTimeout(200);
  }
  // 6 the transformation (beats from settings: intro at +0.3 s; burst 2.9, rise 3.3-5.2, radiate 6.6, white 7.6-8.3, reveal 10.3, line1 10.9, visor down 16.05, leap ~16.7, crack ~17.7)
  expect(t0, "the phase change").toBeGreaterThan(0);
  const at = async (ms: number, name: string) => { const w = t0 + ms - Date.now(); if (w > 0) await page.waitForTimeout(w); await still(page, name); };
  await at(1200, "13-change-book");
  await at(4600, "14-transform-lifted");
  await at(6900, "15-transform-radiate");
  await at(9000, "16-transform-white");
  await at(12_600, "17-transform-reveal-line1");
  await at(15_400, "17b-transform-line1-whole");
  await at(17_100, "18-transform-leap");
  await expect.poll(() => page.evaluate(() => document.querySelector(".rc-stage")?.getAttribute("data-step")), { timeout: 40_000 }).toMatch(/crack|split|shuffle/);
  await page.waitForTimeout(900);
  await still(page, "19-crack-line2");
  await expect.poll(() => page.evaluate(() => document.querySelector(".rc-stage")?.getAttribute("data-step")), { timeout: 40_000 }).toMatch(/split|shuffle/);
  await page.waitForTimeout(500);
  await still(page, "20-split");
  await expect.poll(() => page.evaluate(() => document.querySelector(".rc-stage")?.getAttribute("data-step")), { timeout: 40_000 }).toBe("shuffle");
  await page.waitForTimeout(1500);
  await still(page, "21-shuffle-countdown");
  // 7 four boards
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("simul");
  const simulNow = () => page.evaluate(() => (window as any).match?.simul ?? null);
  await expect.poll(async () => (await simulNow())?.playing ?? false, { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(3000);
  await still(page, "22-four-boards");
  log.push("phase2 line: " + (await bubbleUp(page, 30_000)));
  await still(page, "23-four-boards-line");
  // a board ending: the trophy wins every board still on
  await expect(trophy).toBeEnabled({ timeout: 30_000 });
  await trophy.click();
  const mine = (await simulNow()).boards[0];
  if (mine.toMove === "crowd") await page.evaluate((mv) => (window as any).match?.simulMove?.(mv), legalMoves(mine.fen)[0]);
  // fall back to real taps on your board
  for (let i = 0; i < 6 && !((await simulNow())?.decided); i++) {
    const b = (await simulNow()).boards[0];
    if (b.toMove === "crowd") {
      const mv = legalMoves(b.fen)[0]!;
      const board = page.locator(".rc-simul .rc-q2 .hb-board, .rc-simul .rc-big .hb-board").first();
      const box = (await board.boundingBox())!;
      for (const sq of [mv.slice(0, 2), mv.slice(2, 4)]) { const f = sq.charCodeAt(0) - 97, r = Number(sq[1]) - 1; await page.mouse.click(box.x + (f + 0.5) * (box.width / 8), box.y + (7 - r + 0.5) * (box.height / 8)); }
    }
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(300);
  await still(page, "24-boards-ending");
  await page.waitForTimeout(1500);
  await still(page, "25-boards-won");
  await expect.poll(() => phase(page), { timeout: 40_000 }).toBe("results");
  await page.waitForTimeout(1500);
  await still(page, "26-results");
  writeFileSync(`${OUT}/${tag}-log.txt`, log.join("\n"));
});
