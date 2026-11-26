// SCRATCH (not committed): frames of Chandy's checkmate opening and the win beat, real taps.
import { expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { asAdmin, openBossRaid, submitMove, test } from "./helpers.ts";

test.use({ launchOptions: { executablePath: "/opt/pw-browsers/chromium" } });
const OUT = process.env.MATE_OUT ?? "/tmp/mate-frames";
import { writeFileSync } from "node:fs";
/** Every frame the page paints (CDP screencast), saved as JPEGs named by ms since the start. */
async function cast(page: Page, dir: string, ms: number, width: number) {
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const t0 = Date.now();
  let n = 0;
  cdp.on("Page.screencastFrame", (f: any) => {
    writeFileSync(`${dir}/${String(n++).padStart(4, "0")}-${String(Date.now() - t0).padStart(5, "0")}.jpg`, Buffer.from(f.data, "base64"));
    void cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: width, everyNthFrame: 1 });
  await page.waitForTimeout(ms);
  await cdp.send("Page.stopScreencast");
}
async function shots(page: Page, dir: string, ms: number, every = 0) {
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < ms) {
    const t = Date.now() - t0;
    await page.screenshot({ path: `${dir}/${String(i++).padStart(3, "0")}-${String(t).padStart(5, "0")}.png` });
    if (every) await page.waitForTimeout(every);
  }
}
test.skip(!process.env.MATE_OUT, "scratch");
test("mate frames", async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await asAdmin(page);
  await page.goto(`/?debug&pace=quick&laststand=0&brain=stockfish&boss=chandy&win=1&mode=raid`);
  await openBossRaid(page);
  await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase?.kind ?? "none"), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
  const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  await submitMove(page, "h5f7", fen);
  const dir = `${OUT}/${info.project.name}`;
  await cast(page, `${dir}/open`, 7500, info.project.name === "phone" ? 390 : 1280);
  const c = await page.evaluate(() => (window as any).match.boss.powers.chandy);
  for (let k = 0; k < 3; k++) {
    await expect(page.locator(".cd-root.cd-p-vote")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: new RegExp(`^Vote ${c.dodge.rounds[k].safe}`) }).click();
    await expect(page.locator(".cd-result")).toHaveText(`DODGED ${k + 1}/3`, { timeout: 10_000 });
  }
  await expect(page.locator(".cd-root.cd-p-result")).toBeAttached({ timeout: 10_000 });
  await expect(page.locator(".cd-root.cd-p-result")).not.toBeAttached({ timeout: 10_000 });
  await cast(page, `${dir}/win`, 2600, info.project.name === "phone" ? 390 : 1280);
  expect(errors).toEqual([]);
});
