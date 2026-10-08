import { devices, expect, type Page, type WebSocket } from "@playwright/test";
import { Chess } from "chess.js";
import { createLobbyFromHome, joinFromInvite, named, test } from "./helpers.ts";

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

/** Every lobby message this page sends and receives (parsed), to see the judges at work. */
function wiretap(p: Page) {
  const sent: any[] = [];
  const got: any[] = [];
  p.on("websocket", (ws: WebSocket) => {
    if (!ws.url().includes("/api/lobby/")) return;
    ws.on("framesent", (f) => {
      try {
        sent.push(JSON.parse(String(f.payload)));
      } catch {}
    });
    ws.on("framereceived", (f) => {
      try {
        got.push(JSON.parse(String(f.payload)));
      } catch {}
    });
  });
  return { sent, got };
}

test("many judges: two devices in one online match each check their speed, judge each round's board, and agree", async ({ browser }) => {
  test.setTimeout(6 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run plays both a phone and a computer");
  const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const phone = await (await browser.newContext({ ...devices["iPhone 13"], browserName: undefined } as any)).newPage();
  const tapD = wiretap(desk);
  const tapP = wiretap(phone);
  await named(desk, "Judgy");
  await named(phone, "Phony");

  // Crowd, everyone moves: both devices pick every move.
  await desk.goto("/?debug&pace=quick&mode=crowd&turns=all&augments=0&rounds=6&clock=12");
  await createLobbyFromHome(desk);
  await expect(desk.getByRole("heading", { name: /^Lobby / })).toBeVisible();
  const code = (await desk.locator(".invite-code").textContent())!.trim();
  await phone.goto(`/lobby/${code}?debug`);
  await joinFromInvite(phone);
  await expect(desk.locator(".lobby-players li")).toHaveCount(2);

  // Each device ran its speed check on joining and told the lobby (nodes per second).
  for (const tap of [tapD, tapP]) await expect.poll(() => tap.sent.find((m) => m.t === "speed")?.nps ?? 0, { timeout: 30_000 }).toBeGreaterThan(10_000);

  await desk.getByRole("button", { name: /^Start with 2 players/ }).click();
  const judgedReveals = () => tapP.got.filter((m) => m.t === "reveal" && m.judged).length;
  const stopAt = Date.now() + 4 * 60_000;
  while (Date.now() < stopAt && judgedReveals() < 3) {
    for (const p of [desk, phone]) {
      if ((await phase(p)) !== "play") continue;
      const fen: string = await p.evaluate(() => (window as any).match.phase.board.fen);
      const mv = new Chess(fen).moves({ verbose: true })[0]!;
      await p.evaluate((m) => {
        const x = (window as any).match;
        if (x.phase.kind === "play" && Date.now() > x.phase.startsAt) x.submit(m);
      }, mv.from + mv.to + (mv.promotion ?? ""));
    }
    await desk.waitForTimeout(250);
  }
  expect(judgedReveals()).toBeGreaterThanOrEqual(3);

  // Both devices were given the same jobs (two judges per board) and answered them; the old host request never came.
  const jobs = (tap: { got: any[] }) => tap.got.filter((m) => m.t === "judge").flatMap((m) => m.jobs.map((j: any) => j.id));
  const both = jobs(tapD).filter((id: string) => jobs(tapP).includes(id));
  expect(both.length).toBeGreaterThanOrEqual(3);
  for (const tap of [tapD, tapP]) {
    expect(tap.got.some((m) => m.t === "scoreRequest")).toBe(false);
    const answered = tap.sent.filter((m) => m.t === "judged").map((m) => m.id);
    for (const id of both.slice(0, 3)) expect(answered).toContain(id);
  }
  // A job names nobody: a position, picks and bots, never a player id or name.
  const job = tapD.got.find((m) => m.t === "judge").jobs[0];
  expect(JSON.stringify(job)).not.toMatch(/Judgy|Phony|"p\d+"/);
  // The two answers were identical (the engine is deterministic), so the lobby used them as they were.
  const report = (tap: { sent: any[] }, id: string) => JSON.stringify(tap.sent.find((m) => m.t === "judged" && m.id === id)?.report);
  for (const id of both.slice(0, 3)) expect(report(tapD, id)).toBe(report(tapP, id));
  // No engine server in the e2e run: the two devices re-checked the close calls themselves, sent after the quick
  // answer, and their re-checks were identical too.
  const deep = (tap: { sent: any[] }) => new Map(tap.sent.filter((m) => m.t === "judgedDeep").map((m) => [m.id, JSON.stringify(m.deep)]));
  const [dD, dP] = [deep(tapD), deep(tapP)];
  for (const [id, d] of dD) if (dP.has(id)) expect(dP.get(id)).toBe(d);
  for (const tap of [tapD, tapP]) {
    const order = tap.sent.filter((m) => m.t === "judged" || m.t === "judgedDeep").map((m) => `${m.t}:${m.id}`);
    for (const id of dD.keys()) if (order.includes(`judgedDeep:${id}`)) expect(order.indexOf(`judged:${id}`)).toBeLessThan(order.indexOf(`judgedDeep:${id}`));
  }
  // Nobody was cross-checking anyone afterwards (the judges did that).
  expect(tapP.sent.some((m) => m.t === "crossCheck")).toBe(false);
});
