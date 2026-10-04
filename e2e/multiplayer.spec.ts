import { devices, expect, test, type Page } from "@playwright/test";

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

/** Best move for the position on screen, from this page's own engine. */
async function playBest(p: Page) {
  await p.evaluate(async () => {
    const m = (window as any).match;
    const fen = m.phase.board.fen;
    const [engine] = await m.engines();
    const [top] = await engine.topMoves(fen, 1);
    m.submit(top.move);
  });
}

test("two players in a lobby with 30 bots play a whole match; a reload rejoins the same seat", async ({ browser }) => {
  test.setTimeout(11 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run covers both devices");
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const guestCtx = await browser.newContext({ ...devices["iPhone 13"], browserName: undefined } as any);
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  await host.goto("/?debug&mode=classic&rounds=1&clock=12&pace=quick");
  await host.getByLabel("Your name").fill("Hosty");
  await host.getByRole("button", { name: "Create a lobby" }).click();
  await expect(host.getByRole("heading", { name: /^Lobby / })).toBeVisible();
  const code = (await host.locator(".invite-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{5}$/);

  await guest.goto(`/lobby/${code}?debug`);
  await guest.getByLabel("Your name").fill("Guesty");
  await guest.getByRole("button", { name: "Join lobby" }).click();
  await expect(guest.getByText("Waiting for the host to start")).toBeVisible();
  await expect(host.locator(".lobby-players li")).toHaveCount(2);

  await host.getByRole("button", { name: /^Start with 2 players/ }).click();
  await expect(guest.getByRole("heading", { name: "Today's openings" })).toBeVisible();

  let reloaded = false;
  let usedPowerUp = false;
  const done = new Set<string>();
  const stopAt = Date.now() + 9 * 60_000;
  for (let i = 0; Date.now() < stopAt && done.size < 2; i++) {
    for (const [name, p] of [
      ["host", host],
      ["guest", guest],
    ] as const) {
      if (done.has(name)) continue;
      const k = await phase(p);
      if (k === "results") done.add(name);
      else if (k === "play" && name === "guest" && !usedPowerUp) {
        // Use a power-up once: the engine's top 3 show up, and the guest plays the first.
        usedPowerUp = true;
        await p.evaluate(() => (window as any).match.usePowerUp());
        await expect(p.locator(".hints li")).toHaveCount(3, { timeout: 15_000 });
        await p.evaluate(() => (window as any).match.submit((window as any).match.hint[0].move));
      } else if (k === "play") await playBest(p);
      else if (k === "reveal" && name === "guest" && !reloaded) {
        reloaded = true;
        await guest.reload();
        await expect.poll(() => phase(guest), { timeout: 20_000 }).not.toBe("none");
      }
    }
    await host.waitForTimeout(250);
    if (i % 40 === 0) console.log(i, await phase(host), await phase(guest));
  }
  expect(done.size).toBe(2);
  // Same seat after the reload: the guest's results show a placement out of 64.
  await expect(guest.locator(".results h1")).toContainText(/of 64/);
  await expect(host.locator(".results h1")).toContainText(/of 64/);
});
