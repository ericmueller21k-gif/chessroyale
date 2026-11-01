import { devices, expect, type Page } from "@playwright/test";
import { legalMoves } from "@chessroyale/chess";
import { named, soloFromHome, test, pickMode } from "./helpers.ts";

/**
 * The space under the board on a phone: the scoreboard and quick chat, side by side (split) or one of them full
 * width, open or folded to its header. Eric saw it big and empty (Oct 7, 2026): two buttons each controlled half of
 * the view, and one combination drew a full-height box with nothing in it. Whatever is tapped and whatever a device
 * remembers, the panel shows the scoreboard's rows, the chat, or a small header bar: never an empty box.
 * (Nov 1, Eric: a phone's 50 v 50 is one box, the chat a tab: Black · White · All · Chat; "‹ Back" returns to the
 * scoreboard. The split is gone there; the tests below walk the tab.)
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
      // (Read with the sizes: a phase change between two looks is a different screen.)
      phase: ((window as any).match?.phase.kind ?? "none") as string,
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
  // Measured while a move is being chosen: a reveal adds its tally row above the panel (about 90 px on a phone), so
  // a check that happened to land in one read the chat as too short (the test's steps don't wait for the round). The
  // phase is read in the same look as the sizes: the round can move on between the wait and the look (on CI the
  // chat's feed measured 24 px, in the reveal), and then the next move being chosen is measured instead.
  let v = await look(p);
  for (let round = 0; round < 5; round++) {
    await expect.poll(() => phase(p), { message: `${step}: a move being chosen`, timeout: 60_000 }).toMatch(/^(play|watching)$/);
    await expect
      .poll(async () => {
        v = await look(p);
        return { layout: v.layout, open: v.height > 44 };
      }, { message: `${step}: the layout`, timeout: 5_000 })
      .toEqual(want);
    if (/^(play|watching)$/.test(v.phase)) break;
  }
  const where = `${step}: ${JSON.stringify(v)}`;
  expect(v.phase, where).toMatch(/^(play|watching)$/);
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
  await pickMode(p);
  await p.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(() => p.evaluate(() => (window as any).match?.chat?.enabled ?? false), { timeout: 90_000 }).toBe(true);
  await expect.poll(() => phase(p), { timeout: 90_000 }).toMatch(/play|watching/);
  const reload = async () => {
    await p.reload();
    await expect.poll(() => p.evaluate(() => (window as any).match?.chat?.enabled ?? false), { timeout: 60_000 }).toBe(true);
    await expect.poll(() => phase(p), { timeout: 60_000 }).toMatch(/play|watching|reveal|scoring/);
  };
  // A fresh device: the scoreboard, open (the chat is its tab).
  await p.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (/^brc\.(underBoard|miniTower)/.test(k)) localStorage.removeItem(k);
  });
  await reload();
  await expectShowing(p, { layout: "board", open: true }, "fresh");

  // Every button from every state, by real taps. Chat replaces the scoreboard in the same box and "‹ Back" returns to it;
  // folding leaves just the header (the fold is remembered; the Chat tab is not, so a reload shows the scoreboard).
  const FOLD = "Minimize the leaderboard and chat";
  const OPEN = "Show the leaderboard and chat";
  const CHAT = "Chat";
  const BACK = "Back";
  const walk: [string, { layout: "board" | "chat"; open: boolean }][] = [
    [FOLD, { layout: "board", open: false }],
    [OPEN, { layout: "board", open: true }],
    [CHAT, { layout: "chat", open: true }],
    [FOLD, { layout: "chat", open: false }],
    [OPEN, { layout: "chat", open: true }],
    [BACK, { layout: "board", open: true }],
    [FOLD, { layout: "board", open: false }],
    [OPEN, { layout: "board", open: true }],
    [CHAT, { layout: "chat", open: true }],
    [FOLD, { layout: "chat", open: false }],
    [BACK, { layout: "board", open: false }],
    [OPEN, { layout: "board", open: true }],
  ];
  // (A reload shows the scoreboard, the Chat tab isn't remembered: so the reload check is on the scoreboard's states, and a
  // chat state's steps follow on from the one before, as the tab stays.)
  for (const [i, [label, want]] of walk.entries()) {
    await tap(p, label);
    await expectShowing(p, want, `tap ${i + 1} "${label}"`);
    if (want.layout === "board") {
      await reload();
      await expectShowing(p, want, `reload after tap ${i + 1} "${label}"`);
    }
  }
  await tap(p, CHAT);
  await expectShowing(p, { layout: "chat", open: true }, "Chat, then a reload");
  await reload();
  await expectShowing(p, { layout: "board", open: true }, "reload: the scoreboard, not the chat tab");

  // A device that remembers an older build's two settings (the layout, and the fold) in any combination: it shows
  // the scoreboard after a reload, open or folded as the fold says. (The layout setting is the split's; the tab has none.)
  for (const layout of ["split", "board", "chat"]) {
    for (const fold of ["1", "0"]) {
      await p.evaluate(([l, f]) => {
        for (const k of Object.keys(localStorage)) if (/^brc\.(underBoard|miniTower)/.test(k)) localStorage.removeItem(k);
        localStorage.setItem("brc.underBoard", l);
        localStorage.setItem("brc.miniTower", f);
      }, [layout, fold]);
      await reload();
      const want = { layout: "board", open: fold === "1" || layout !== "split" } as { layout: "board"; open: boolean };
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
  await tap(p, "Minimize the leaderboard");
  await expectShowing(p, { layout: "board", open: false }, "chat off, folded");
  await reload();
  await expectShowing(p, { layout: "board", open: false }, "chat off, folded, reloaded");
  await tap(p, "Show the leaderboard");
  await expectShowing(p, { layout: "board", open: true }, "chat off, opened");
  // Chat back on: the scoreboard, with its Chat tab.
  await p.evaluate(() => localStorage.setItem("brc.chatOff", "0"));
  await reload();
  await expectShowing(p, { layout: "board", open: true }, "chat on again");
  await expect(p.locator(".under-board .mini-chat-tab")).toBeVisible();
});

test("solo Crowd with chat off: the scoreboard alone, full width, folds to its header and opens again", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "phone", "a phone's layout");
  await named(page, "Solo");
  await page.addInitScript(() => {
    // An older build's settings that drew the empty box with chat on.
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("brc.underBoard", "board");
      localStorage.setItem("brc.miniTower", "0");
      // (Solo's 50 v 50 has chat since Nov 1: off, it's the scoreboard alone, as solo was.)
      localStorage.setItem("brc.chatOff", "1");
    }
  });
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=2&clock=30&augments=0");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toMatch(/play|watching/);
  await expectShowing(page, { layout: "board", open: true }, "solo");
  const v = await look(page);
  expect(v.labels.filter((l) => /full width|Side by side/.test(l)), JSON.stringify(v)).toEqual([]);
  expect(v.width, JSON.stringify(v)).toBeGreaterThan(v.vw * 0.8);
  await tap(page, "Minimize the leaderboard");
  await expectShowing(page, { layout: "board", open: false }, "solo, folded");
  await tap(page, "Show the leaderboard");
  await expectShowing(page, { layout: "board", open: true }, "solo, opened");
});

test("the chat tab's Team / All switch: both labels whole at 320, 360 and 390 px, no sideways scroll", async ({ browser }) => {
  // (It read "TEAM | AI" at 360 px: the switch shrank to the room its header had left. Nov 1: the chat is a tab now, with
  // "‹ Back" in the same header.)
  test.setTimeout(4 * 60_000);
  test.skip(test.info().project.name !== "phone", "a phone's layout");
  const p = await (await browser.newContext({ ...devices["iPhone 13"], browserName: undefined } as any)).newPage();
  await named(p, "Switcher");
  await p.goto("/?debug&pool=switch");
  await pickMode(p);
  await p.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(() => p.evaluate(() => (window as any).match?.chat?.enabled ?? false), { timeout: 90_000 }).toBe(true);
  await expect.poll(() => phase(p), { timeout: 90_000 }).toMatch(/play|watching/);
  await p.getByRole("button", { name: "Chat", exact: true }).click();
  for (const width of [390, 360, 320]) {
    await p.setViewportSize({ width, height: 664 });
    await expect(p.locator(".under-board.ub-tab .qchat-tab .qto")).toBeVisible();
    // (Two frames: the layout settles after the resize.)
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const v = await p.evaluate(() => {
      const box = (e: Element) => {
        const r = e.getBoundingClientRect();
        return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height };
      };
      const panel = document.querySelector(".qchat-tab")!;
      const sw = panel.querySelector(".qto")!;
      return {
        panel: box(panel),
        sw: box(sw),
        buttons: [...sw.querySelectorAll("button")].map((b) => ({ text: b.textContent, box: box(b), spill: b.scrollWidth - b.clientWidth })),
        heads: [...panel.querySelectorAll(".qhead button")].map((b) => ({ label: b.getAttribute("aria-label") ?? b.textContent, box: box(b) })),
        scroll: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    const where = `${width} px: ${JSON.stringify(v)}`;
    expect(v.scroll, where).toBeLessThanOrEqual(0);
    expect(v.buttons.map((b) => b.text), where).toEqual(["Team", "All"]);
    for (const b of v.buttons) {
      // The label whole in its button, the button whole in the switch, the switch whole in the panel.
      expect(b.spill, where).toBeLessThanOrEqual(0);
      expect(b.box.l, where).toBeGreaterThanOrEqual(v.sw.l - 0.5);
      expect(b.box.r, where).toBeLessThanOrEqual(v.sw.r + 0.5);
      expect(b.box.w, `${where}: a tap target`).toBeGreaterThanOrEqual(30);
      expect(b.box.h, `${where}: a tap target`).toBeGreaterThanOrEqual(22);
    }
    expect(v.sw.l, where).toBeGreaterThanOrEqual(v.panel.l);
    expect(v.sw.r, where).toBeLessThanOrEqual(v.panel.r);
    // The header's other buttons whole in the panel too, never over the switch.
    for (const h of v.heads.filter((h) => !v.buttons.some((b) => b.box.l === h.box.l))) {
      expect(h.box.r, where).toBeLessThanOrEqual(v.panel.r + 0.5);
      expect(Math.min(h.box.w, h.box.h), `${where}: a tap target`).toBeGreaterThanOrEqual(28);
      expect(h.box.l >= v.sw.r - 0.5 || h.box.r <= v.sw.l + 0.5, where).toBe(true);
    }
  }
});

test("a phone's 50 v 50 box (Nov 1): at 390 × 750 the scoreboard starts under the reveal's one line, with four rows or more; Chat replaces it in the same box and Back returns to the same pick", async ({ browser }) => {
  // (Eric, Nov 1, on his phone: the scoreboard right up against the vote results and filling the rest of the screen; the
  // chat a tab in the scoreboard's header, "‹ Back" to the scoreboard as it was picked.)
  test.setTimeout(6 * 60_000);
  test.skip(test.info().project.name !== "phone", "a phone's layout");
  const p = await (await browser.newContext({ ...devices["iPhone 13"], browserName: undefined, colorScheme: "dark" } as any)).newPage();
  await named(p, "Boxer");
  await p.goto("/?debug&pool=box");
  await pickMode(p);
  await p.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(() => p.evaluate(() => (window as any).match?.chat?.enabled ?? false), { timeout: 90_000 }).toBe(true);
  await expect.poll(() => phase(p), { timeout: 90_000 }).toMatch(/play|watching/);
  await p.setViewportSize({ width: 390, height: 750 });
  // Your team's move, then the reveal with your result line.
  const stopAt = Date.now() + 4 * 60_000;
  while (Date.now() < stopAt && !(await p.locator(".poll-result").isVisible().catch(() => false))) {
    if ((await phase(p)) === "play") {
      const fen: string = await p.evaluate(() => (window as any).match.phase.board.fen);
      await p.evaluate((uci) => (window as any).match.submit(uci), legalMoves(fen)[0]!);
    }
    await p.waitForTimeout(300);
  }
  await expect(p.locator(".poll-result")).toBeVisible({ timeout: 60_000 });
  const boxes = () =>
    p.evaluate(() => {
      const box = (sel: string) => {
        const e = document.querySelector(sel);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
      };
      return {
        result: box(".screen.game .poll-result"),
        under: box(".screen.game .under-board"),
        rows: [...document.querySelectorAll(".screen.game .mini-tower .tower-row")].filter((e) => (e as HTMLElement).offsetParent !== null).length,
        pick: [...document.querySelectorAll(".screen.game .mini-tower .mini-pick.on")].map((e) => e.textContent)[0] ?? null,
        vh: innerHeight,
        under_mt: getComputedStyle(document.querySelector(".screen.game .under-board") ?? document.body).marginTop,
        under_parent: document.querySelector(".screen.game .under-board")?.parentElement?.className ?? null,
      };
    });
  const reveal = await boxes();
  // The scoreboard's top is right under the result line (4 px at most), and fills the rest of the screen.
  expect(reveal.vh, JSON.stringify(reveal)).toBe(750);
  expect(reveal.under!.t - reveal.result!.b, JSON.stringify(reveal)).toBeLessThanOrEqual(4);
  expect(reveal.under!.t - reveal.result!.b, JSON.stringify(reveal)).toBeGreaterThanOrEqual(0);
  expect(Math.round(reveal.under!.b), JSON.stringify(reveal)).toBeGreaterThanOrEqual(750 - 12);
  expect(reveal.rows, JSON.stringify(reveal)).toBeGreaterThanOrEqual(4);
  // Pick All, then Chat: the chat replaces the scoreboard in the same box; Back returns to All.
  await p.locator(".screen.game .mini-tower .mini-pick", { hasText: /^All$/ }).click();
  const picked = (await boxes()).pick;
  expect(picked).toBe("All");
  const before = (await boxes()).under!;
  await p.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(p.locator(".screen.game .under-board .qchat-tab")).toBeVisible();
  const chat = await boxes();
  expect(chat.under, JSON.stringify(chat)).toEqual(before);
  expect(await p.locator(".screen.game .under-board .mini-tower").count()).toBe(0);
  await p.getByRole("button", { name: "Back", exact: true }).click();
  await expect(p.locator(".screen.game .under-board .mini-tower")).toBeVisible();
  const back = await boxes();
  expect(back.pick, JSON.stringify(back)).toBe("All");
  expect(back.under, JSON.stringify(back)).toEqual(before);
});
