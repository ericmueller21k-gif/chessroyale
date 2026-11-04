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

/** Your Relay move, tap, tap: the first quiet legal move. */
async function move(page: Page, fen: string) {
  const mv = new Chess(fen).moves({ verbose: true }).find((m) => !m.captured && !m.promotion)!;
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

test("Relay: coming back to a board, the moves you missed replay (who played each named over its piece), then the clock; a tap skips it and starts your move; off, no replay and the same free time", async ({ page }) => {
  test.setTimeout(300_000);
  await named(page, "Tess");
  await relayLobby(page);
  await page.getByRole("button", { name: "Skip votes" }).click();
  // Turn 1: the board you start on, nothing to replay, the free seconds as they are.
  const first = await nextDuty(page);
  expect(first.duty!.replay).toBe(0);
  expect(first.duty!.freeMs).toBe(first.delayMs);
  await expect(page.locator(".rp-over")).toHaveCount(0);
  // The button: on by default, its dot trail running round it.
  await expect(button(page)).toHaveAttribute("aria-pressed", "true");
  await expect(button(page).locator(".rp-trail")).toHaveCount(1);
  await still(page, "button-on");
  // Names over the replayed moves: a teammate's long name, an opponent's short one.
  await page.evaluate(() => {
    const s = (window as any).squads;
    const mine = (id: string) => !!s.mySquad?.seats?.includes(id);
    s.nameOf = (id: string) => (id === s.myId ? "Tess" : mine(id) ? "Christopherson" : "Bo");
  });
  await move(page, first.fen!);

  // Your next board (Black there, never played): every move on it so far replays, then the free seconds run.
  const tags = await page.evaluate(() => {
    const out: { text: string; w: number; h: number; fs: number }[] = [];
    (window as any).__tags = out;
    const t = setInterval(() => {
      for (const el of document.querySelectorAll<HTMLElement>(".rp-tag")) {
        const b = el.getBoundingClientRect();
        const text = el.querySelector<HTMLElement>(".rp-tag-text")!;
        out.push({ text: text.textContent ?? "", w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10, fs: parseFloat(getComputedStyle(text).fontSize) });
      }
    }, 40);
    setTimeout(() => clearInterval(t), 120_000);
    return true;
  });
  expect(tags).toBe(true);
  const back = await nextDuty(page, first.seq);
  const n = back.duty!.replay;
  expect(n).toBeGreaterThan(0);
  // The free time: the free seconds + 0.5 s for each move missed (the server's, the clock's).
  expect(back.duty!.freeMs).toBe(back.delayMs + 500 * n);
  await expect(page.locator(".rp-over")).toBeVisible();
  await expect(page.locator(".sq-status")).toContainText(/^Your move · Board \d · replay \d of \d/);
  await expect(page.locator(".sq-free.replay .rp-icon")).toBeVisible();
  // Mid-way: a move landed, its from and to marked on the replay's board, its player named over it.
  await expect(page.locator(".rp-over .rp-tag")).toBeVisible({ timeout: 3_000 });
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

  // The next board: a tap on the board during the replay skips it at once, and the same tap starts your move.
  const third = await nextDuty(page, back.seq);
  expect(third.duty!.replay).toBeGreaterThan(0);
  await expect(page.locator(".rp-over")).toBeVisible();
  const mv = new Chess(third.fen!).moves({ verbose: true }).find((m) => !m.captured && !m.promotion)!;
  await tapSquare(page, mv.from);
  await expect(page.locator(".rp-over")).toHaveCount(0, { timeout: 300 });
  await tapSquare(page, mv.to);
  await expect.poll(async () => (await seen(page)).mine, { timeout: 5_000 }).toBe(mv.from + mv.to);

  // Off: the button plain (no trail), remembered; the next board just shows, with the same free time.
  await button(page).click();
  await expect(button(page)).toHaveAttribute("aria-pressed", "false");
  await expect(button(page).locator(".rp-trail")).toHaveCount(0);
  await still(page, "button-off");
  const never = await watchFor(page, { replay: { selector: ".rp-over" } });
  const fourth = await nextDuty(page, third.seq);
  expect(fourth.duty!.replay).toBeGreaterThan(0);
  expect(fourth.duty!.freeMs).toBe(fourth.delayMs + 500 * fourth.duty!.replay);
  await page.waitForTimeout(500 * fourth.duty!.replay + 300);
  expect(await never.seen()).toEqual({ replay: false });
  await button(page).click();
  await expect(button(page).locator(".rp-trail")).toHaveCount(1);
});

test("the first-time tip: the screen dimmed, the gear and the replay button lit; it comes back until \"Don't show this again\" is ticked", async ({ page }) => {
  test.setTimeout(300_000);
  await named(page, "Tess");
  const tip = page.getByRole("dialog", { name: "Two quick settings" });
  // Queued (a test lobby's link counts as queueing with ?replaytip): the tip over the votes.
  await relayLobby(page, "&replaytip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Move replay is on: when the rotation brings you back to a board, the moves you missed play back first");
  await expect(tip).toContainText("to turn off Animations");
  // Both lit: a ring round each, centered on it; the rest dimmed.
  const rings = page.locator(".rp-tip-ring");
  await expect(rings).toHaveCount(2);
  for (const [i, sel] of [".rp-btn", ".mm-more"].entries()) {
    const b = (await page.locator(sel).first().boundingBox())!;
    const r = (await rings.nth(i).boundingBox())!;
    expect(Math.abs(r.x + r.width / 2 - (b.x + b.width / 2))).toBeLessThan(2);
    expect(Math.abs(r.y + r.height / 2 - (b.y + b.height / 2))).toBeLessThan(2);
    expect(r.width).toBeGreaterThan(b.width);
    expect(r.height).toBeGreaterThan(b.height);
  }
  await expect(page.locator(".rp-tip-dim rect[mask]")).toHaveCount(1);
  // The box is whole on screen.
  const box = (await page.locator(".rp-tip-box").boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  await still(page, "tip");
  // OK, not ticked: gone now, back the next time.
  await tip.getByRole("button", { name: "OK" }).click();
  await expect(tip).toHaveCount(0);
  await relayLobby(page, "&replaytip");
  await expect(tip).toBeVisible();
  await tip.getByLabel("Don't show this again").check();
  await tip.getByRole("button", { name: "OK" }).click();
  await expect(tip).toHaveCount(0);
  // Ticked: never again (this account on this device).
  await relayLobby(page, "&replaytip");
  await page.waitForTimeout(1_000);
  await expect(tip).toHaveCount(0);
});
