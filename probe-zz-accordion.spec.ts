import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { legalMoves } from "@chessroyale/chess";
import { test, submitMove, tapInTown, localSql, asAdmin } from "./helpers.ts";

test.use({ launchOptions: { executablePath: "/opt/pw-browsers/chromium" } });
// (The computer's stills at 2x for Eric; a phone keeps its device's own.)
test.use({ deviceScaleFactor: (async ({}, use: (v: number) => Promise<void>, info: { project: { name: string } }) => use(info.project.name === "desktop" ? 2 : 3)) as any });
// MOCKUP probe (not for main): the split bar as an accordion, floors of 2 and 3; stills, a tapped-open part and the slide's frames.
const OUT = process.env.STILLS ?? "/tmp/stills";
const TAG = process.env.TAG ?? "new";
const phase = (page: Page) => page.evaluate(() => (window as any).match?.phase?.kind ?? null);
const room = (page: Page) => page.locator("canvas.town-shop-canvas");

async function intoTower(page: Page, query: string) {
  await page.goto(`/town?debug&pace=quick&sky=day${query}`);
  await expect(page.locator("canvas.town-canvas")).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  const card = await tapInTown(page, "home", "tower", page.getByRole("dialog", { name: "Battle Tower", exact: true }));
  await card.getByRole("button", { name: "Go in" }).click();
  await expect(room(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
}
async function tapClerk(page: Page) {
  const card = page.getByRole("dialog", { name: "Clerk", exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    const xy = await page.evaluate(() => (window as any).__shopAt?.("keeper") ?? null);
    const cv = xy && (await room(page).boundingBox());
    expect(xy && cv).toBeTruthy();
    await page.mouse.click(cv!.x + xy!.x, cv!.y + xy!.y);
    await expect(card).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 40_000 });
  return card;
}
async function playAMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  const at = await page.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board.fen as string, allowed: (m.runner.crowdAllowed() as string[] | null) ?? null };
  });
  const quiet = ["e2e3", "d2d3", "g1f3", "b1c3", "a2a3", "h2h3", "c2c3", "b2b3", "g2g3", "f2f3"];
  const allowed = at.allowed ?? legalMoves(at.fen);
  await submitMove(page, quiet.find((m) => allowed.includes(m)) ?? allowed[0], at.fen);
}
const toMove = (page: Page) => page.evaluate(() => (window as any).match?.boss?.side?.toMove ?? -1);
const measure = (page: Page) =>
  page.evaluate(() => {
    const r = (s: string) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)];
    };
    return {
      bar: r(".tw-bar"),
      board: r(".board-wrap"),
      parts: [...document.querySelectorAll(".tw-part")].map((p) => Math.round(p.getBoundingClientRect().width)),
      card: r(".tw-bcard"),
      scrollY: document.scrollingElement?.scrollHeight === document.scrollingElement?.clientHeight,
    };
  });
async function quiet(page: Page) {
  await expect.poll(() => page.locator(".bc-bubble:visible").count(), { timeout: 30_000 }).toBe(0).catch(() => {});
  await page.waitForTimeout(800);
}

const SETS: Record<string, string[]> = { two: ["grex", "hollow"], three: ["timber", "dash", "zebra"], mix: ["grex", "hollow", "zebra"] };

for (const set of Object.keys(SETS))
  test(`accordion ${set}`, async ({ page }) => {
    test.setTimeout(8 * 60_000);
    const proj = test.info().project.name;
    if (proj === "phone" && set === "mix") test.skip();
    if (proj === "desktop" && set !== "mix") test.skip();
    const bosses = SETS[set]!;
    await asAdmin(page);
    await page.route("**/api/tower/floor/start", async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      if (body?.settings) {
        body.bosses = bosses;
        body.settings = { ...body.settings, bossIds: bosses, bossId: bosses[0] };
      }
      await route.fulfill({ response: res, json: body });
    });
    await intoTower(page, `&power=candle`);
    const made = await page.evaluate(async () => {
      const run = await fetch("/api/tower/run", { method: "POST", body: "{}", credentials: "same-origin", headers: { "content-type": "application/json" } });
      const me = await (await fetch("/api/me", { credentials: "same-origin" })).json();
      return { ok: run.ok, user: me.user.id as string };
    });
    expect(made.ok).toBe(true);
    await localSql(page, "UPDATE tower_runs SET floor = 6, met = ? WHERE user_id = ? AND status = 'open'", JSON.stringify({ floors: [["moo"], ["pig", "sawyer"], ["alfil", "folio"], ["boingo"], ["ginger", "moo"]].concat([bosses]), deck: [], decks: 1 }), made.user);
    const clerk = await tapClerk(page);
    await clerk.getByRole("button", { name: /Continue: floor/ }).click();
    await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
    mkdirSync(OUT, { recursive: true });
    const candle = () => page.evaluate(() => (window as any).match?.boss?.side?.bosses?.find((b: any) => b.id === "grex")?.powers?.candle?.left ?? 0);
    for (let n = 1; n <= 8; n++) {
      await playAMove(page);
      await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
      await page.waitForTimeout(1500);
      const moment = await page.locator(".power-moment").count();
      if (n >= 2 && (!bosses.includes("grex") || (await candle()) > 0) && moment === 0) break;
    }
    await quiet(page);
    console.log(TAG, set, proj, "measure", JSON.stringify(await measure(page)), "toMove", await toMove(page));
    if (process.env.DEBUG)
      console.log(
        "DEBUG",
        await page.evaluate(() => {
          const out: string[] = [];
          const card = document.querySelector(".tw-bcard") as HTMLElement;
          const walk = (e: Element, d: number) => {
            const r = e.getBoundingClientRect();
            const cs = getComputedStyle(e);
            out.push(`${" ".repeat(d)}${e.tagName}.${(e.className as any)?.baseVal ?? e.className} ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} bg=${cs.backgroundColor}|${cs.backgroundImage.slice(0, 40)} pos=${cs.position} disp=${cs.display} vis=${cs.visibility}`);
            if (d < 6) for (const c of e.children) walk(c, d + 1);
          };
          const bar = document.querySelector(".tw-bar")!;
          const bs = getComputedStyle(bar);
          out.push(`BAR pad=${bs.padding} h=${bs.height} minh=${bs.minHeight} disp=${bs.display} align=${bs.alignItems} box=${bs.boxSizing} border=${bs.borderWidth}`);
          walk(document.querySelector(".tw-part")!, 0);
          const rules: string[] = [];
          for (const sh of document.styleSheets) {
            let list: CSSRuleList;
            try { list = sh.cssRules; } catch { continue; }
            const visit = (l: CSSRuleList) => {
              for (const r of l) {
                if (r instanceof CSSStyleRule) { try { if (card.matches(r.selectorText) && (r.style.background || r.style.backgroundColor || r.style.backgroundImage || r.style.paddingBottom || r.style.padding)) rules.push(r.cssText.slice(0, 200)); } catch {} }
                else if ((r as any).cssRules) visit((r as any).cssRules);
              }
            };
            visit(list);
          }
          return out.join("\n") + "\nRULES\n" + rules.join("\n");
        }),
      );
    const name = proj === "phone" ? `phone-floor-of-${bosses.length}` : `computer-floor-of-${bosses.length}`;
    await page.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
    if (TAG === "old") return;

    // A tapped-open folded boss (the first folded part to the right of the one to move, else the first).
    const tm = await toMove(page);
    const pick = tm === bosses.length - 1 ? 0 : tm + 1;
    await page.locator(".tw-part").nth(pick).click();
    await page.waitForTimeout(600);
    console.log(TAG, set, proj, "tapped", pick, JSON.stringify(await measure(page)));
    await page.screenshot({ path: `${OUT}/${TAG}-${name}-tapped-open.png` });
    // Tapped again: back to the boss to move.
    await page.locator(".tw-part").nth(pick).click();
    await page.waitForTimeout(600);

    if (proj !== "phone" || set !== "three") return;
    // The slide on a turn change: every flex-grow transition paused as it starts, then stepped through, the bar shot at each step.
    await page.evaluate(() => {
      (window as any).__twRun = 0;
      document.addEventListener("transitionrun", (e) => {
        const t = e.target as HTMLElement;
        if (!t.classList?.contains("tw-part") || (e as TransitionEvent).propertyName !== "flex-grow") return;
        (window as any).__twRun++;
        for (const a of document.getAnimations()) if ((a as any).transitionProperty === "flex-grow") a.pause();
      });
    });
    const before = await toMove(page);
    await playAMove(page);
    await expect.poll(() => page.evaluate(() => (window as any).__twRun), { timeout: 120_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      for (const a of document.getAnimations()) if ((a as any).transitionProperty === "flex-grow") a.pause();
    });
    console.log("slide from", before, "to", await toMove(page));
    const bar = page.locator(".tw-bar");
    const box = (await bar.boundingBox())!;
    const clip = { x: 0, y: Math.max(0, box.y - 4), width: page.viewportSize()!.width, height: box.height + 8 };
    for (let t = 0, i = 0; t <= 300; t += 25, i++) {
      await page.evaluate((ms) => {
        for (const a of document.getAnimations()) if ((a as any).transitionProperty === "flex-grow") a.currentTime = ms;
      }, t);
      await page.waitForTimeout(60);
      await page.screenshot({ path: `${OUT}/slide-${String(i).padStart(2, "0")}.png`, clip });
    }
    await page.evaluate(() => {
      for (const a of document.getAnimations()) if ((a as any).transitionProperty === "flex-grow") a.finish();
    });
    // Reduced motion: a tap opens a part at once, no transition.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(300);
    const before2 = await page.evaluate(() => (window as any).__twRun);
    await page.locator(".tw-part:not(.tw-open)").first().click();
    await page.waitForTimeout(100);
    const parts = await page.evaluate(() => [...document.querySelectorAll(".tw-part")].map((p) => Math.round(p.getBoundingClientRect().width)));
    console.log("reduced motion: transitions run", (await page.evaluate(() => (window as any).__twRun)) - before2, "parts", JSON.stringify(parts));
  });
