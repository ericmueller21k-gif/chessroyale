import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { legalMoves } from "@chessroyale/chess";
import { test, submitMove, tapInTown, localSql, asAdmin } from "./helpers.ts";

test.use({ launchOptions: { executablePath: "/opt/pw-browsers/chromium" } });
// MOCKUP probe (not committed): the split bar's props, ?barprops=a|b, on floors of 2 and 3.
const OUT = process.env.STILLS ?? "/tmp/stills";
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

const SETS: Record<string, string[]> = { two: ["grex", "hollow"], three: ["timber", "dash", "zebra"], mix: ["grex", "hollow", "zebra"] };

for (const opt of ["a", "b"])
  for (const set of Object.keys(SETS))
    test(`bar props ${opt} ${set}`, async ({ page }) => {
      test.setTimeout(6 * 60_000);
      const proj = test.info().project.name;
      if (proj === "phone" && set === "mix") test.skip();
      if (proj === "desktop" && set !== "mix") test.skip();
      const bosses = SETS[set];
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
      await intoTower(page, `&power=candle&barprops=${opt}`);
      const made = await page.evaluate(async () => {
        const run = await fetch("/api/tower/run", { method: "POST", body: "{}", credentials: "same-origin", headers: { "content-type": "application/json" } });
        const me = await (await fetch("/api/me", { credentials: "same-origin" })).json();
        return { ok: run.ok, user: me.user.id as string };
      });
      expect(made.ok).toBe(true);
      await localSql(page, "UPDATE tower_runs SET floor = 6, met = ? WHERE user_id = ? AND status = 'open'", JSON.stringify({ floors: [["moo"], ["pig", "sawyer"], ["alfil", "folio"], ["boingo"], ["ginger", "moo"], ["grex", "hollow"]].slice(0, 5).concat([bosses]), deck: [], decks: 1 }), made.user);
      const clerk = await tapClerk(page);
      await clerk.getByRole("button", { name: /Continue: floor/ }).click();
      await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
      mkdirSync(OUT, { recursive: true });
      const info = () => page.evaluate(() => {
        const side = (window as any).match?.boss?.side;
        return { ids: side?.bosses?.map((b: any) => b.id), candle: side?.bosses?.find((b: any) => b.id === "grex")?.powers?.candle?.left ?? 0, props: document.querySelectorAll(".tw-prop-in > *").length, moment: document.querySelectorAll(".power-moment").length };
      });
      for (let n = 1; n <= 8; n++) {
        await playAMove(page);
        await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
        await page.waitForTimeout(1500);
        const i = await info();
        console.log(opt, set, n, JSON.stringify(i));
        if (n >= 3 && (!bosses.includes("grex") || i.candle > 0) && i.moment === 0) break;
      }
      await expect.poll(() => page.locator(".bc-bubble:visible").count(), { timeout: 30_000 }).toBe(0).catch(() => {});
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/${opt}-${set}-${proj}.png` });
      const parts = await page.evaluate(() => [...document.querySelectorAll(".tw-part")].map((p) => { const r = p.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
      console.log("parts", JSON.stringify(parts));
    });
