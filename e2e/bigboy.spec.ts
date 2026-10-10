import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { test, watchFor } from "./helpers.ts";

/**
 * Big Boy, the baby boss, played alone on a phone and a computer with real taps: his snack before move 1 (he waddles
 * over and eats the crowd's d- or e-pawn), your move's knock first after a real think, his toy block (TOY BLOCK!, the
 * block on an empty square of your half, no move dots onto it, gone after its 3 turns), and the Big Bounce from the
 * admins' test trigger (BIG BOUNCE!, pieces knocked into the air, the crash, every piece settling into the new position,
 * then his move), its sounds through the mute switch.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const powers = (p: Page) => p.evaluate(() => (window as any).match?.boss?.powers ?? null).catch(() => null);
const soundsHeard = (p: Page) => p.evaluate(() => ((window as any).__soundLog ?? []) as string[]);

async function squareAt(page: Page, square: string) {
  const board = (await page.locator("cg-board").first().boundingBox())!;
  const flip = (await page.evaluate(() => (window as any).match.boss?.crowdSide)) === "b";
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
}
const tap = async (page: Page, square: string) => {
  const q = await squareAt(page, square);
  await page.mouse.click(q.x, q.y);
};
async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}
async function play(page: Page, move: string) {
  await yourMove(page);
  for (let i = 0; i < 5 && (await phase(page)) === "play"; i++) {
    await tap(page, move.slice(0, 2));
    await tap(page, move.slice(2, 4));
    await page.waitForTimeout(300);
  }
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
}
/** An allowed move once it's your move (the toy block's limits), preferring `want`. */
async function allowedMove(page: Page, want: string[] = []): Promise<string> {
  await yourMove(page);
  const { fen, allowed } = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, allowed: (window as any).match.boss?.powers?.allowed as string[] | null }));
  const legal = allowed ?? new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
  // (A quiet move: nothing that gives a piece away, so the battle goes on.)
  return want.find((m) => legal.includes(m)) ?? legal.filter((m) => m.length === 4).sort()[0]!;
}
/** How opaque a canvas over the board is at a square's middle. */
const covered = (page: Page, square: string, canvas: string) =>
  squareAt(page, square).then((q) =>
    page
      .locator(canvas)
      .first()
      .evaluate((c: HTMLCanvasElement, [x, y]) => {
        const r = c.getBoundingClientRect();
        return c.getContext("2d")!.getImageData(Math.floor(((x! - r.left) / r.width) * c.width), Math.floor(((y! - r.top) / r.height) * c.height), 1, 1).data[3];
      }, [q.x, q.y]),
  );

test("Big Boy's snack before move 1, your move's knock, and his toy block (no dots onto it, gone after its turns)", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&boss=bigboy&laststand=0");
  const snackSeen = await watchFor(page, { snack: { selector: ".pm-snack .bb-snack" }, nom: { selector: ".bc-bubble", text: /Nom nom\.|Yummy pawn!|Snack time!/ } });
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  const boss = await page.evaluate(() => (window as any).match.boss);
  expect(boss.name).toBe("Big Boy");
  expect(boss.crowdSide).toBe("w");
  expect(boss.board.history).toEqual([]);
  const snack: string = boss.powers.snack;
  expect(["d2", "e2"]).toContain(snack);
  // The pawn is on the board during his card, until he grabs it.
  await expect(page.locator("cg-board piece.white.pawn")).toHaveCount(8);
  await expect.poll(async () => (await snackSeen.seen()).snack, { timeout: 15_000 }).toBe(true);
  await expect(page.locator("cg-board piece.white.pawn")).toHaveCount(7, { timeout: 5000 });
  await expect.poll(async () => (await snackSeen.seen()).nom, { timeout: 5000 }).toBe(true);
  expect(new Chess(boss.board.fen).get(snack as never)).toBeFalsy();

  // Move 1, after a real think: your move's knock is the first sound heard (no boss sound in its place).
  await yourMove(page);
  await page.waitForTimeout(2500);
  await page.evaluate(() => ((window as any).__soundLog = []));
  const banner = await watchFor(page, { block: { selector: ".fight-banner.power-cut", text: /TOY BLOCK!/ } });
  await play(page, await allowedMove(page, ["g1f3", "b1c3"]));
  await expect.poll(async () => (await soundsHeard(page)).map((s) => s.split(":")[0]), { timeout: 10_000 }).toContain("move");
  expect((await soundsHeard(page))[0]!.split(":")[0]).toBe("move");

  // His reply; the 2nd turn begins with his toy block on an empty square of your half.
  await expect.poll(async () => (await banner.seen()).block, { timeout: 30_000 }).toBe(true);
  await yourMove(page);
  const p2 = await powers(page);
  const sq: string = p2.block.square;
  expect(Number(sq[1])).toBeLessThanOrEqual(4);
  expect(new Chess(await page.evaluate(() => (window as any).match.phase.board.fen)).get(sq as never)).toBeFalsy();
  await expect(page.locator(`.pw-block[data-square="${sq}"]`)).toHaveCount(1);
  await expect.poll(() => covered(page, sq, ".pw-block-board"), { timeout: 5000 }).toBeGreaterThan(0);
  expect(p2.allowed.some((m: string) => m.slice(2, 4) === sq)).toBe(false);
  // A piece that could have gone there: picked up, no dot on the block.
  const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  // (One that has somewhere else to go, so it shows its dots.)
  const onto = new Chess(fen).moves({ verbose: true }).find((m) => m.to === sq && p2.allowed.some((a: string) => a.startsWith(m.from)));
  if (onto) {
    await tap(page, onto.from);
    await expect(page.locator("cg-board square.move-dest").first()).toBeVisible();
    const dots = await page.locator("cg-board square.move-dest").count();
    expect(dots).toBeGreaterThan(0);
    const blocked = await squareAt(page, sq);
    const dotsThere = await page.locator("cg-board square.move-dest").evaluateAll(
      (els, [x, y]) => els.filter((e) => { const r = e.getBoundingClientRect(); return x! > r.left && x! < r.right && y! > r.top && y! < r.bottom; }).length,
      [blocked.x, blocked.y],
    );
    expect(dotsThere).toBe(0);
    await tap(page, onto.from);
  }
  // Three turns, then it's gone (puffed away).
  for (let i = 0; i < 3; i++) await play(page, await allowedMove(page, ["h2h3", "a2a3", "h3h4", "a3a4", "b1c3", "g1f3"]));
  await yourMove(page);
  expect((await powers(page)).block).toBeNull();
  await expect(page.locator(`.pw-block[data-square="${sq}"]`)).toHaveCount(0);
  expect(errors).toEqual([]);
});

/** Your profile says you're an admin (as /api/me does for an email in ADMIN_EMAILS). */
async function asAdmin(page: Page) {
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const body = await res.json().catch(() => null);
    await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
  });
}

test("Big Boy's Big Bounce (the admins' trigger): pieces knocked up, the crash, the new position, then his move; his sounds through mute", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await asAdmin(page);
  // Muted on this device: his sounds are still asked for (the log), and every one stays silent.
  await page.addInitScript(() => localStorage.setItem("brc.muted", "1"));
  await page.goto("/?debug&clock=60&boss=bigboy&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await yourMove(page);
  const btn = page.locator(".ult-test");
  await expect(btn).toHaveText("Trigger ultimate (testing)");
  await btn.click();
  await expect(btn).toHaveText("Ultimate next turn (testing)");
  const seen = await watchFor(page, {
    banner: { selector: ".fight-banner.power-cut", text: /BIG BOUNCE!/ },
    boy: { selector: ".bb-layer .bb-boy" },
    piece: { selector: ".bb-layer piece.bb-piece" },
    crash: { selector: ".bb-layer .bb-crash" },
    jolt: { selector: ".board-area.pw-crash" },
    settled: { selector: '.bb-layer[data-bounce="settled"]' },
  });
  await page.evaluate(() => ((window as any).__soundLog = []));
  await play(page, await allowedMove(page, ["g1f3", "b1c3"]));
  // At the start of his turn, before his move: the bounce.
  await expect.poll(() => page.evaluate(() => !!(window as any).match.boss?.powers?.bounce), { timeout: 30_000 }).toBe(true);
  const b = (await powers(page)).bounce;
  expect(b.at).toBe(1);
  expect(b.spots).toHaveLength(3);
  expect(await page.evaluate(() => (window as any).match.boss.board.history.length)).toBe(1);
  // It plays out, then he moves: your turn again.
  await yourMove(page);
  const s = await seen.seen();
  expect(s).toEqual({ banner: true, boy: true, piece: true, crash: true, jolt: true, settled: true });
  const end = await page.evaluate(() => (window as any).match.boss);
  // Not a move: the crowd's one and his one.
  expect(end.board.history.length).toBe(2);
  // Every piece it threw is on its new square (unless his move took it).
  const c = new Chess(end.board.fen);
  for (const m of b.moves as { from: string; to: string; piece: string }[]) {
    if (end.board.history[1].slice(2, 4) === m.to) continue;
    // (Unless he has moved it on since: his move's piece is his own, so a thrown piece of yours stays put.)
    expect(c.get(m.to as never), `${m.from}-${m.to}`).toMatchObject({ color: "w", type: m.piece });
  }
  // The board shows it: chessground's pieces are the position's.
  await page.waitForTimeout(500);
  const shown = await page.locator("cg-board piece:not(.ghost):not(.fading)").count();
  expect(shown).toBe(c.board().flat().filter(Boolean).length);
  expect((await powers(page)).rage).toBeNull();
  await expect(btn).toHaveText("Ultimate used (testing)");
  // His sounds came (the boing, the crash), and through the mute switch, silent.
  const log = await soundsHeard(page);
  const his = log.filter((x) => x.startsWith("bigboy"));
  expect(his.map((x) => x.split(":")[0])).toEqual(expect.arrayContaining(["bigboyBoing", "bigboyCrash"]));
  for (const x of his) expect(x).toMatch(/:muted$/);
  expect(errors).toEqual([]);
});
