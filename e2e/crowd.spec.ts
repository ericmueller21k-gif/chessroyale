import { devices, expect } from "@playwright/test";
import { createLobbyFromHome, named, soloFromHome, test } from "./helpers.ts";

const phase = (p: any) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

test("narrow phones: the top bar's numbers stay clear of the sound button, and the cut lists whole rows of names", async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  // 360 px and 375 px wide (the layout is the same in both schemes; one of each).
  for (const [device, colorScheme] of [["Galaxy S24", "light"], ["iPhone SE (3rd gen)", "dark"]] as const) {
    const page = await (await browser.newContext({ ...devices[device], browserName: undefined, colorScheme } as any)).newPage();
    await named(page, "Maximilian Wolfe");
    await page.goto("/?debug&pace=quick&mode=crowd&rounds=2&clock=30&augments=0");
    await soloFromHome(page);
    await expect.poll(() => phase(page), { timeout: 30_000 }).toMatch(/play|watching/);
    // The longest real names (a 100-player lobby numbers them: "… 2") and the widest numbers, late in a game:
    // move 34, you at −112.5, the cut line around −120.
    await page.evaluate(() => {
      const m = (window as any).match;
      const long = ["Queen's Gambit Quinn", "Trompowsky Trina", "Prophylaxis Pia", "King's Indian Kip", "Bishop Pair Paul", "Zwischenzug Zak"];
      m.runner.state.players.forEach((p: any, i: number) => {
        if (p.isBot) p.name = `${long[i % long.length]} 2`;
        p.stageScore = p.id === "you" ? -112.5 : -100 - (i % 37) * 0.7;
      });
      m.phase = { ...m.phase, board: { ...m.phase.board, fen: m.phase.board.fen.replace(/\d+$/, "34") } };
      m.emit();
    });
    await expect(page.locator(".hud-row .hud-cut")).toContainText("−1");
    await page.waitForTimeout(1200); // (the numbers count to their new values)
    const bar = await page.evaluate(() => {
      const hud = document.querySelector(".hud-row .hud")!;
      const cut = document.querySelector(".hud-row .hud-cut")!.getBoundingClientRect();
      const mute = document.querySelector(".hud-row .mute-btn")!.getBoundingClientRect();
      const label = [...document.querySelectorAll(".hud-row .hud-stage-text > span")];
      return {
        text: (hud as HTMLElement).innerText,
        spill: hud.scrollWidth - hud.clientWidth,
        clear: mute.left - cut.right,
        labelCut: label.some((e) => e.scrollWidth > e.clientWidth),
      };
    });
    expect(bar.spill, `${device}: ${bar.text}`).toBeLessThanOrEqual(0);
    expect(bar.clear, `${device}: the cut pill runs under the sound button`).toBeGreaterThanOrEqual(0);
    expect(bar.labelCut, `${device}: "Move 34 · cut in 2" is cut short`).toBe(false);
    // Play to the first cut (16 go out) and hold it there.
    await expect
      .poll(
        async () => {
          await page.evaluate(() => {
            const m = (window as any).match;
            const move = [...(m.runner.planned?.values() ?? [])][0];
            if (m.phase.kind === "play" && move) m.submit(move);
          });
          return phase(page);
        },
        { timeout: 120_000, intervals: [250] },
      )
      .toBe("stageBreak");
    await page.evaluate(() => clearTimeout((window as any).match.timer));
    const names = page.locator(".crowd-cut .cut-out");
    await expect(names).toBeVisible({ timeout: 5000 });
    const list = await names.evaluate((box) => {
      const b = box.getBoundingClientRect();
      const chips = [...box.children].map((c) => ({ bottom: c.getBoundingClientRect().bottom, text: (c as HTMLElement).innerText, struck: getComputedStyle(c).textDecorationLine }));
      return { bottom: b.bottom, chips };
    });
    // Every name shown is whole (no row cut in half), struck through, and "+N" counts the rest of the 16.
    for (const c of list.chips) expect(c.bottom, `${device}: "${c.text}" is cut off`).toBeLessThanOrEqual(list.bottom + 0.5);
    const more = list.chips.at(-1)!;
    expect(more.text).toBe(`+${16 - (list.chips.length - 1)}`);
    for (const c of list.chips.slice(0, -1)) expect(c.struck).toBe("line-through");
    expect(list.chips.length).toBeGreaterThanOrEqual(5);
  }
});

test("online, once you're out, a later cut says so (not \"You're through\") and the gavel strikes again", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  // A lobby of one (and 99 bots) where you never pick: -25 a move puts you at the bottom of your team.
  await page.goto("/?debug&pace=quick&mode=crowd&turns=teams&format=team&rounds=1&clock=4");
  await createLobbyFromHome(page);
  await page.getByRole("button", { name: /Start with 1 player/ }).click();
  const cut = () => page.evaluate(() => {
    const p = (window as any).match?.phase;
    return p?.kind === "stageBreak" ? { stage: p.stage as number, youOut: p.youOut as boolean } : null;
  });
  let outAt: number | null = null;
  await expect
    .poll(async () => {
      const c = await cut();
      if (c?.youOut) outAt = c.stage;
      return outAt;
    }, { timeout: 3 * 60_000, intervals: [200] })
    .not.toBeNull();
  // The cut you went out at.
  await expect(page.locator(".crowd-cut .out-msg")).toContainText("You're out");
  await expect(page.getByRole("button", { name: "Why was I cut?" })).toBeVisible();
  // The next cut, watched from the sidelines: a new judgement (the doomed pawns glow before the gavel lands).
  await expect.poll(async () => (await cut())?.stage ?? -1, { timeout: 90_000, intervals: [100] }).toBeGreaterThan(outAt!);
  await expect(page.locator(".crowd-cut .grid-pawn.doomed").first()).toBeVisible({ timeout: 1000 });
  await expect(page.locator(".crowd-cut .grid-pawn.cut-now").first()).toBeVisible({ timeout: 5000 });
  // It says you went out before, not that you're through.
  await expect(page.locator(".crowd-cut .out-msg")).toHaveText(/^You went out earlier, in \d+(st|nd|rd|th) place\.$/);
  await expect(page.locator(".crowd-cut .safe-msg")).toHaveCount(0);
  await expect(page.locator(".crowd-cut")).not.toContainText("You're through");
  await expect(page.getByRole("button", { name: "Why was I cut?" })).toHaveCount(0);
});

test("Crowd 50 v 50: plays your team's turns, watches the other team's, survives cuts, through the team final to results", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  // Two rounds a stage, as in a real match (a cut after every move: one ply for each team). With one, a stage is a
  // single ply, so at the first cut the team that hasn't moved yet is all tied on 0 and its cut is a coin flip: you
  // could go out before ever playing.
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=2&clock=20&augments=0&finalTurns=12");
  await soloFromHome(page);
  const seen = new Set<string>();
  const stopAt = Date.now() + 9 * 60_000;
  while (Date.now() < stopAt) {
    const p = await phase(page);
    seen.add(p);
    if (p === "results") break;
    if (p === "play") {
      // The game starts from the initial position, with no other boards beside it.
      await expect(page.locator(".boards-strip")).toHaveCount(0);
      await page.evaluate(async () => {
        const m = (window as any).match;
        if (m.phase.kind !== "play") return;
        // The best move if the engine answers quickly; any legal move otherwise (a busy test machine mustn't miss the clock).
        const fen = m.phase.board.fen;
        const top = await Promise.race([m.runner.topMovesFor(fen), new Promise((r) => setTimeout(() => r(null), 12000))]);
        // (A teammate bot's planned pick is a legal move in the same position.)
        const fallback = [...(m.runner.planned?.values() ?? [])][0];
        if (m.phase.kind === "play") m.submit(top ? (top as any)[0].move : fallback);
      });
    } else if (p === "reveal") {
      // The live poll shows (unless the short quick-pace reveal has already moved on).
      await expect.poll(async () => (await phase(page)) !== "reveal" || (await page.locator(".poll-row").first().isVisible())).toBe(true);
      if (await page.locator(".poll-row").count()) seen.add("poll");
    }
    await page.waitForTimeout(250);
  }
  expect(await phase(page)).toBe("results");
  for (const k of ["play", "watching", "reveal", "poll", "stageBreak"]) expect(seen.has(k)).toBe(true);
  await expect(page.locator(".team-result")).toBeVisible();
  // Everyone placed 1-100.
  const places = await page.evaluate(() => (window as any).match.runner.state.players.map((p: any) => p.placement).sort((a: number, b: number) => a - b));
  expect(places).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
});

test("the board never moves or resizes during a turn (Crowd and Classic)", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  for (const mode of ["crowd", "classic"]) {
    await page.goto(`/?debug&pace=quick&mode=${mode}&augments=0`);
    await soloFromHome(page);
    await expect.poll(() => phase(page), { timeout: 30_000 }).toMatch(/play|watching/);
    const rects = new Map<string, Set<string>>();
    const stopAt = Date.now() + 25_000;
    while (Date.now() < stopAt) {
      const [kind, rect] = await page.evaluate(async () => {
        const m = (window as any).match;
        const k = m.phase.kind;
        if (k === "play" && !(window as any).__sub && Date.now() > m.phase.startsAt + 1000) {
          (window as any).__sub = 1;
          const top = await m.runner.topMovesFor(m.phase.board.fen);
          if (m.phase.kind === "play") m.submit(top[0].move);
          setTimeout(() => ((window as any).__sub = 0), 500);
        }
        const r = document.querySelector(".board-wrap .board")?.getBoundingClientRect();
        return [k, r ? `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}` : "none"];
      });
      if (["play", "scoring", "watching", "reveal"].includes(kind)) {
        if (!rects.has(rect)) rects.set(rect, new Set());
        rects.get(rect)!.add(kind);
      }
      if (kind === "stageBreak" && mode === "classic") await page.evaluate(() => (window as any).match.continueFromBreak());
      await page.waitForTimeout(100);
    }
    const summary = [...rects].map(([r, k]) => `${r} (${[...k].join("/")})`);
    expect(summary, `${mode}: board positions seen`).toHaveLength(1);
    expect([...rects.values()][0]!.size).toBeGreaterThanOrEqual(3);
  }
});
