import { devices, expect, type Page } from "@playwright/test";
import { named, soloFromHome, test } from "./helpers.ts";

/**
 * The space under the board on a phone: the scoreboard and quick chat, side by side (split) or one of them full
 * width, open or folded to its header. Eric saw it big and empty (Oct 7, 2026): two buttons each controlled half of
 * the view, and one combination drew a full-height box with nothing in it. Whatever is tapped and whatever a device
 * remembers, the panel shows the scoreboard's rows, the chat, or a small header bar: never an empty box.
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

/** What the space under the board shows right now (the layout is read from what's on screen, not from classes). */
function look(p: Page) {
  return p.evaluate(() => {
    const seen = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? r : null;
    };
    const screen = document.querySelector(".screen.game")!;
    const panel = screen.querySelector(".under-board") ?? screen.querySelector(".mini-tower");
    const box = seen(panel);
    const tower = seen(screen.querySelector(".mini-tower"));
    const chat = seen(screen.querySelector(".qchat"));
    const rows = [...screen.querySelectorAll(".mini-tower .tower-row")].filter((e) => !!seen(e)).length;
    const feed = seen(screen.querySelector(".qchat .qfeed-wrap, .qchat .qoff"));
    const labels = [...(panel?.querySelectorAll("button[aria-label]") ?? [])].filter((b) => !!seen(b)).map((b) => b.getAttribute("aria-label")!);
    return {
      layout: tower && chat ? "split" : tower ? "board" : chat ? "chat" : "none",
      height: Math.round(box?.height ?? 0),
      right: Math.round(box?.right ?? 0),
      width: Math.round(box?.width ?? 0),
      vw: window.innerWidth,
      rows,
      feed: Math.round(feed?.height ?? 0),
      labels,
    };
  });
}

/** Never an empty box: open shows rows or chat; folded is a small header bar; and it fits the screen. */
async function expectShowing(p: Page, want: { layout: "split" | "board" | "chat"; open: boolean }, step: string) {
  await expect
    .poll(async () => {
      const v = await look(p);
      return { layout: v.layout, open: v.height > 44 };
    }, { message: `${step}: the layout`, timeout: 5_000 })
    .toEqual(want);
  const v = await look(p);
  const where = `${step}: ${JSON.stringify(v)}`;
  if (want.open) {
    if (want.layout !== "chat") expect(v.rows, where).toBeGreaterThan(0);
    if (want.layout !== "board") expect(v.feed, where).toBeGreaterThan(30);
  } else {
    expect(v.height, where).toBeLessThanOrEqual(40);
  }
  // As wide as the space (folded too: only the height folds).
  expect(v.width, where).toBeGreaterThan(v.vw * 0.8);
  // Inside the screen, with its margins.
  expect(v.right, where).toBeLessThanOrEqual(v.vw - 4);
}

/** A button in the space under the board (the top bar has a "Show the leaderboard" of its own: the full list). */
const tap = (p: Page, label: string) =>
  p.locator(".screen.game .under-board, .screen.game > .mini-tower").getByRole("button", { name: label, exact: true }).click();

test("the panel under the board is never empty: every tap, every remembered layout, chat off, and an old device's settings", async ({ browser }) => {
  test.setTimeout(8 * 60_000);
  test.skip(test.info().project.name !== "phone", "a phone's layout");
  const p = await (await browser.newContext({ ...devices["iPhone 13"], browserName: undefined, colorScheme: "light" } as any)).newPage();
  await named(p, "Folder");
  await p.goto("/?debug&pool=panel");
  await p.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(() => p.evaluate(() => (window as any).match?.chat?.enabled ?? false), { timeout: 90_000 }).toBe(true);
  await expect.poll(() => phase(p), { timeout: 90_000 }).toMatch(/play|watching/);
  const reload = async () => {
    await p.reload();
    await expect.poll(() => p.evaluate(() => (window as any).match?.chat?.enabled ?? false), { timeout: 60_000 }).toBe(true);
    await expect.poll(() => phase(p), { timeout: 60_000 }).toMatch(/play|watching|reveal|scoring/);
  };
  // A fresh device: side by side, open.
  await p.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (/^brc\.(underBoard|miniTower)/.test(k)) localStorage.removeItem(k);
  });
  await reload();
  await expectShowing(p, { layout: "split", open: true }, "fresh");

  // Every button from every state, by real taps. Making a panel bigger always opens it (Eric: "it should reset the
  // other toggle"); folding leaves just the header. After each tap, a reload keeps the same view.
  const FOLD = "Minimise the leaderboard and chat";
  const OPEN = "Show the leaderboard and chat";
  const walk: [string, { layout: "split" | "board" | "chat"; open: boolean }][] = [
    [FOLD, { layout: "split", open: false }],
    ["Leaderboard full width", { layout: "board", open: true }],
    [FOLD, { layout: "board", open: false }],
    [OPEN, { layout: "board", open: true }],
    [FOLD, { layout: "board", open: false }],
    ["Side by side", { layout: "split", open: true }],
    ["Chat full width", { layout: "chat", open: true }],
    [FOLD, { layout: "chat", open: false }],
    ["Side by side", { layout: "split", open: true }],
    [FOLD, { layout: "split", open: false }],
    ["Chat full width", { layout: "chat", open: true }],
    [FOLD, { layout: "chat", open: false }],
    [OPEN, { layout: "chat", open: true }],
    ["Side by side", { layout: "split", open: true }],
    ["Leaderboard full width", { layout: "board", open: true }],
    ["Side by side", { layout: "split", open: true }],
    [FOLD, { layout: "split", open: false }],
    [OPEN, { layout: "split", open: true }],
  ];
  for (const [i, [label, want]] of walk.entries()) {
    await tap(p, label);
    await expectShowing(p, want, `tap ${i + 1} "${label}"`);
    await reload();
    await expectShowing(p, want, `reload after tap ${i + 1} "${label}"`);
  }

  // A device that remembers an older build's two settings (the layout, and the fold) in any combination: it shows
  // something after a reload. A full-width panel that was folded opens (that's how it got stuck).
  for (const layout of ["split", "board", "chat"]) {
    for (const fold of ["1", "0"]) {
      await p.evaluate(([l, f]) => {
        for (const k of Object.keys(localStorage)) if (/^brc\.(underBoard|miniTower)/.test(k)) localStorage.removeItem(k);
        localStorage.setItem("brc.underBoard", l);
        localStorage.setItem("brc.miniTower", f);
      }, [layout, fold]);
      await reload();
      const want = { layout, open: fold === "1" || layout !== "split" } as { layout: "split" | "board" | "chat"; open: boolean };
      await expectShowing(p, want, `older build: ${layout}, ${fold === "1" ? "open" : "folded"}`);
    }
  }

  // Chat off: the scoreboard alone, full width, with no split button; folding and opening still work.
  await p.evaluate(() => localStorage.setItem("brc.chatOff", "1"));
  for (const start of ["split", "chat"]) {
    await p.evaluate((l) => {
      for (const k of Object.keys(localStorage)) if (/^brc\.(underBoard|miniTower)/.test(k)) localStorage.removeItem(k);
      localStorage.setItem("brc.underBoard", l);
    }, start);
    await reload();
    await expectShowing(p, { layout: "board", open: true }, `chat off (remembering ${start})`);
    const v = await look(p);
    expect(v.labels.filter((l) => /full width|Side by side/.test(l)), JSON.stringify(v)).toEqual([]);
    expect(v.width, JSON.stringify(v)).toBeGreaterThan(v.vw * 0.8);
  }
  // (No chat: the fold is the scoreboard's alone.)
  await tap(p, "Minimise the leaderboard");
  await expectShowing(p, { layout: "board", open: false }, "chat off, folded");
  await reload();
  await expectShowing(p, { layout: "board", open: false }, "chat off, folded, reloaded");
  await tap(p, "Show the leaderboard");
  await expectShowing(p, { layout: "board", open: true }, "chat off, opened");
  // Chat back on: the remembered layout returns.
  await p.evaluate(() => localStorage.setItem("brc.chatOff", "0"));
  await reload();
  await expectShowing(p, { layout: "chat", open: true }, "chat on again");
});

test("solo Crowd (no chat): the scoreboard alone, full width, folds to its header and opens again", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "phone", "a phone's layout");
  await named(page, "Solo");
  await page.addInitScript(() => {
    // An older build's settings that drew the empty box with chat on.
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("brc.underBoard", "board");
      localStorage.setItem("brc.miniTower", "0");
    }
  });
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=2&clock=30&augments=0");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toMatch(/play|watching/);
  await expectShowing(page, { layout: "board", open: true }, "solo");
  const v = await look(page);
  expect(v.labels.filter((l) => /full width|Side by side/.test(l)), JSON.stringify(v)).toEqual([]);
  expect(v.width, JSON.stringify(v)).toBeGreaterThan(v.vw * 0.8);
  await tap(page, "Minimise the leaderboard");
  await expectShowing(page, { layout: "board", open: false }, "solo, folded");
  await tap(page, "Show the leaderboard");
  await expectShowing(page, { layout: "board", open: true }, "solo, opened");
});
