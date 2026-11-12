import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOARD_SEL, named, test, watchFor } from "./helpers.ts";

/**
 * Move replay in Squads (Eric, Nov 5; docs/decisions/2026-11-05-move-replay.md), on the real server (wrangler dev,
 * SQUADS_TEST on): in Relay, coming back to a board the moves played there since you last played it land one by one
 * (a name tag over each moved piece: who played it), then the free seconds run as usual; the free time is 0.5 s more a
 * move missed, the replay button on or off; a tap on the board skips the replay and starts your move; the button's dot
 * trail shows only while it's on; and the first-time tip (the screen dimmed, the gear and the button lit), whose
 * "Don't show this again" sticks. `REPLAY_STILLS=<dir>`: the stills for Eric are saved there.
 */

const stills = process.env.REPLAY_STILLS;
const still = async (page: Page, name: string) => {
  if (!stills) return;
  mkdirSync(stills, { recursive: true });
  await page.screenshot({ path: `${stills}/${name}-${test.info().project.name}.png` });
};

interface Seen {
  key: string | null;
  seq: number | null;
  duty: { board: number; freeMs: number; replay: number; startedAt: number } | null;
  delayMs: number;
  fen: string | null;
  mine: string | null;
}

const seen = (page: Page): Promise<Seen> =>
  page.evaluate(() => {
    const s = (window as any).squads;
    const m = s ? [...s.matches.values()].find((x: any) => x.state !== "over" && x.sides.some((sd: any) => sd.seats.includes(s.myId))) : null;
    const d = m?.state === "half" ? m.current?.duties.find((x: any) => x.players.includes(s.myId)) : null;
    return {
      key: m?.key ?? null,
      seq: m?.current?.seq ?? null,
      duty: d ? { board: d.board, freeMs: d.freeMs, replay: d.replay[d.players.indexOf(s.myId)], startedAt: m.current.startedAt } : null,
      delayMs: m?.delayMs ?? 0,
      fen: d ? m.boards[d.board].fen : null,
      mine: m ? (m.visible[s.myId] ?? null) : null,
    };
  });

/** Your next duty (a new half asking for your move), after `seq` if given. */
async function nextDuty(page: Page, after: number | null = null, timeout = 120_000): Promise<Seen> {
  let s: Seen | null = null;
  await expect
    .poll(
      async () => {
        s = await seen(page);
        return !!s.duty && !s.mine && (after === null || (s.seq ?? -1) > after);
      },
      { timeout, intervals: [100] },
    )
    .toBe(true);
  return s!;
}

async function tapSquare(page: Page, sq: string) {
  // (The big board's own squares: during a replay its board is drawn over it, later in the page.)
  const box = (await page.locator(`.board-area ${BOARD_SEL.squares}`).first().boundingBox())!;
  const black = await page.locator(`.board-area ${BOARD_SEL.wrap}`).first().evaluate((el) => el.classList.contains("orientation-black"));
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const x = black ? 7 - f : f;
  const y = black ? r : 7 - r;
  await page.mouse.click(box.x + (x + 0.5) * (box.width / 8), box.y + (y + 0.5) * (box.height / 8));
}

/** Your Relay move, tap, tap: the first quiet legal move, else (only captures legal, run 42849806128) the first non-promotion. */
async function move(page: Page, fen: string) {
  const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.promotion);
  const mv = legal.find((m) => !m.captured) ?? legal[0];
  await tapSquare(page, mv.from);
  await tapSquare(page, mv.to);
  await expect.poll(async () => (await seen(page)).mine, { timeout: 5_000 }).toBe(mv.from + mv.to);
}

/** A Relay test lobby (Classic, White on your first board, 3 s free, a 60 s cap), past the votes. */
async function relayLobby(page: Page, extra = "") {
  await page.goto(`/squads/test/relay?nolanding&debug&clock=120,0,3,0,60&seat=white&mode=classic${extra}`);
  await expect(page.getByRole("button", { name: "Skip votes" })).toBeVisible({ timeout: 40_000 });
}

const button = (page: Page) => page.locator(".hud-row .rp-btn");
const mode = (page: Page) => button(page).getAttribute("data-mode");

/** The board on screen's move count when it came on screen (the replay's rule reads it). */
const arrived = (page: Page) => page.locator(".board-area .board-row").first().getAttribute("data-arrived").then(Number);

/**
 * Eric's rule (Nov 5): no replay if you watched both of the last two moves on the board land. Your next duties until one
 * where you didn't (each skipped one checked: nothing replays), its move made for you on the way.
 */
async function nextReplaying(page: Page, after: number | null): Promise<Seen> {
  for (let i = 0; i < 4; i++) {
    const s = await nextDuty(page, after);
    const total = await plies(page, s.duty!.board);
    if (s.duty!.replay > 0 && (await arrived(page)) > total - 2) return s;
    await page.waitForTimeout(600);
    await expect(page.locator(".rp-over")).toHaveCount(0);
    await move(page, s.fen!);
    after = s.seq;
  }
  throw new Error("no duty with a replay in four");
}

/** The moves on a board of your match now. */
const boardResult = (page: Page, board: number) =>
  page.evaluate((b) => {
    const s = (window as any).squads;
    const m = [...s.matches.values()].find((x: any) => x.sides.some((sd: any) => sd.seats.includes(s.myId)) && x.boards[b]?.result);
    return (m?.boards[b].result ?? null) as unknown;
  }, board);

const plies = (page: Page, board: number) =>
  page.evaluate((b) => {
    const s = (window as any).squads;
    const m = [...s.matches.values()].find((x: any) => x.state !== "over" && x.sides.some((sd: any) => sd.seats.includes(s.myId)));
    return m.boards[b].moves.length as number;
  }, board);

test("Relay: the replay button steps off, the last 2, all; your move on a board, unless you watched both of its last two moves land, replays them (who played each named over its piece), then the clock; a tap skips it; off, none and the same free time", async ({ page }) => {
  test.setTimeout(300_000);
  await named(page, "Tess");
  // (Quick board jump off: the game moves you to each board as your move there begins, so every move there was missed.)
  await page.addInitScript(() => localStorage.setItem("brc.squads.jumpNext", "0"));
  await relayLobby(page);
  await page.getByRole("button", { name: "Skip votes" }).click();
  // Turn 1: the board you start on, nothing to replay, the free seconds as they are.
  const first = await nextDuty(page);
  expect(first.duty!.replay).toBe(0);
  expect(first.duty!.freeMs).toBe(first.delayMs);
  await expect(page.locator(".rp-over")).toHaveCount(0);
  // The button (Nov 5, round 2): off on a first match (grayed, nothing turning); a tap: the last 2 (a short trail);
  // again: all (twice as fast, a longer trail); again: off.
  expect(await mode(page)).toBe("off");
  await expect(button(page).locator(".rp-trail")).toHaveCount(0);
  await still(page, "button-off");
  const spin = () => button(page).locator(".rp-trail-spin").evaluate((g) => [parseFloat(getComputedStyle(g).animationDuration), g.querySelectorAll("circle").length]);
  await button(page).click();
  expect(await mode(page)).toBe("two");
  const two = await spin();
  await button(page).click();
  expect(await mode(page)).toBe("all");
  const all = await spin();
  expect(all[0]).toBeCloseTo(two[0] / 2, 5);
  expect(all[1]).toBeGreaterThan(two[1]);
  await button(page).click();
  expect(await mode(page)).toBe("off");
  await button(page).click();
  await button(page).click();
  expect(await mode(page)).toBe("all");
  await still(page, "button-on");
  // Names over the replayed moves: a teammate's long name, an opponent's short one.
  await page.evaluate(() => {
    const s = (window as any).squads;
    const mine = (id: string) => !!s.mySquad?.seats?.includes(id);
    s.nameOf = (id: string) => (id === s.myId ? "Tess" : mine(id) ? "Christopherson" : "Bo");
  });
  await move(page, first.fen!);

  // Your next board where you didn't watch both of its last two moves land: every move since you last played there
  // replays, then the free seconds run.
  const tags = await page.evaluate(() => {
    const out: { text: string; w: number; h: number; fs: number }[] = [];
    (window as any).__tags = out;
    // (And, while the replay's board is up, the status line and whether the free seconds show the replay's icon: the same look.)
    const during: { status: string; icon: boolean }[] = [];
    (window as any).__during = during;
    const t = setInterval(() => {
      if (document.querySelector(".rp-over")) {
        const icon = document.querySelector(".sq-free.replay .rp-icon")?.getBoundingClientRect();
        during.push({ status: (document.querySelector(".sq-status")?.textContent ?? "").replace(/\s+/g, " ").trim(), icon: !!icon && icon.width > 0 && icon.height > 0 });
      }
      for (const el of document.querySelectorAll<HTMLElement>(".rp-over .rp-tag")) {
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        const text = el.querySelector<HTMLElement>(".rp-tag-text")!;
        out.push({ text: text.textContent ?? "", w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10, fs: parseFloat(getComputedStyle(text).fontSize) });
      }
    }, 40);
    setTimeout(() => clearInterval(t), 120_000);
    return true;
  });
  expect(tags).toBe(true);
  const back = await nextReplaying(page, first.seq);
  const n = back.duty!.replay;
  expect(n).toBeGreaterThan(0);
  // The free time: the free seconds + 0.5 s for each move missed (the server's, the clock's).
  expect(back.duty!.freeMs).toBe(back.delayMs + 500 * n);
  // (These are read from the watcher above, every 40 ms from before the replay: a replay of one move lasts 0.5 s, and it came and went
  // between the looks of toBeVisible, the tag and once the icon: CI and locally, Nov 11. docs/decisions/2026-11-11-flaky-batch.md)
  // The replay's board, with the status line's "replay x of y" and the replay's icon in the free seconds, in one look.
  await expect
    .poll(() => page.evaluate(() => ((window as any).__during as { status: string; icon: boolean }[]).some((d) => /^Your move · Board \d · replay \d of \d/.test(d.status) && d.icon)), {
      message: "the replay's board, its status and its icon",
      timeout: 500 * n + 3_000,
    })
    .toBe(true);
  // Mid-way: a move landed, its from and to marked on the replay's board, its player named over it.
  await expect.poll(() => page.evaluate(() => (window as any).__tags.length as number), { message: "a tag over a replayed move", timeout: 500 * n + 3_000 }).toBeGreaterThan(0);
  await still(page, "replay");
  // It ends as the extra time does (never later, never early), and the board is the board as it stands.
  await expect(page.locator(".rp-over")).toHaveCount(0, { timeout: 500 * n + 1_500 });
  const ended = await page.evaluate(() => Date.now());
  expect(ended - back.duty!.startedAt).toBeGreaterThan(500 * n - 400);
  await expect(page.locator(".sq-free")).toHaveText(/^free \d\.\d$/);
  // The name tags: one box size for every name; a long one set smaller, cut at 12 letters with "…".
  const seenTags = (await page.evaluate(() => (window as any).__tags)) as { text: string; w: number; h: number; fs: number }[];
  expect(seenTags.length).toBeGreaterThan(0);
  const texts = new Set(seenTags.map((t) => t.text));
  expect([...texts].every((t) => ["Christopher…", "Bo"].includes(t))).toBe(true);
  expect(new Set(seenTags.map((t) => t.w)).size).toBe(1);
  expect(new Set(seenTags.map((t) => t.h)).size).toBe(1);
  if (texts.has("Christopher…") && texts.has("Bo")) {
    const fs = (x: string) => seenTags.find((t) => t.text === x)!.fs;
    expect(fs("Christopher…")).toBeLessThan(fs("Bo"));
  }
  await move(page, back.fen!);

  // The last 2 (a tap from off): at most 2 replay. A tap on the board during the replay skips it at once, and the same
  // tap starts your move.
  await button(page).click();
  await button(page).click();
  expect(await mode(page)).toBe("two");
  const third = await nextReplaying(page, back.seq);
  expect(third.duty!.replay).toBeGreaterThan(1);
  await expect(page.locator(".rp-over")).toBeVisible();
  await expect(page.locator(".sq-status")).toContainText(/replay \d of 2$/);
  const mv = new Chess(third.fen!).moves({ verbose: true }).find((m) => !m.captured && !m.promotion)!;
  await tapSquare(page, mv.from);
  await expect(page.locator(".rp-over")).toHaveCount(0, { timeout: 300 });
  await tapSquare(page, mv.to);
  await expect.poll(async () => (await seen(page)).mine, { timeout: 5_000 }).toBe(mv.from + mv.to);

  // Off: no trail, remembered; the next board just shows, with the same free time.
  await button(page).click();
  await button(page).click();
  expect(await mode(page)).toBe("off");
  await expect(button(page).locator(".rp-trail")).toHaveCount(0);
  const never = await watchFor(page, { replay: { selector: ".rp-over" } });
  const fourth = await nextDuty(page, third.seq);
  expect(fourth.duty!.replay).toBeGreaterThan(0);
  expect(fourth.duty!.freeMs).toBe(fourth.delayMs + 500 * fourth.duty!.replay);
  await page.waitForTimeout(500 * fourth.duty!.replay + 300);
  expect(await never.seen()).toEqual({ replay: false });
});

test("Relay with Quick board jump: on your next board, no replay if you watched both of its last two moves land; arrived after either, the whole replay", async ({ page }) => {
  test.setTimeout(300_000);
  await named(page, "Tess");
  await relayLobby(page);
  await page.getByRole("button", { name: "Skip votes" }).click();
  let s = await nextDuty(page);
  while ((await mode(page)) !== "all") await button(page).click();
  // (Each of your next few moves: whichever way it went, the rule.)
  const seenCases = new Set<string>();
  for (let i = 0; i < 4; i++) {
    await move(page, s.fen!);
    // A beat later the big board is the one you play next: its moves when you got there.
    await expect(page.locator(".sq-tiny.on .sq-mark.next")).toHaveCount(1, { timeout: 5_000 });
    const board = await page.locator(".sq-board-no").innerText().then((t) => Number(t) - 1);
    const arrived = await plies(page, board);
    const next = await nextDuty(page, s.seq);
    if (next.duty!.board !== board) {
      // (The board shown finished before your turn there (a win or a draw on it), so the server rightly gave you the next one:
      // that turn shows nothing of the replay rule. Flaky batch 6, approved by Eric Nov 10.)
      expect(await boardResult(page, board)).not.toBeNull();
      s = next;
      continue;
    }
    const total = await plies(page, board);
    const watchedBoth = arrived <= total - 2;
    seenCases.add(watchedBoth ? "watched" : "arrived");
    if (watchedBoth) {
      await page.waitForTimeout(800);
      await expect(page.locator(".rp-over")).toHaveCount(0);
    } else {
      // Never a partial rewind: every move since you last played there.
      await expect(page.locator(".sq-status")).toContainText(new RegExp(`replay \\d of ${next.duty!.replay}$`));
    }
    s = next;
  }
  expect(seenCases.size).toBeGreaterThan(0);
});
