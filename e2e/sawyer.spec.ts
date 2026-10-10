import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { test, watchFor } from "./helpers.ts";

/**
 * Sawyer, the raccoon with a saw, played alone on a phone and a computer with real taps: his first move a pawn's and
 * the split once there's room for another pawn of his (SPLIT PAWN!, he leaps onto the pawn, it cracks, the two halves
 * come apart and stay drawn as halves), your move's knock first, the board saw (?power=boardsaw: BOARD SAW!, he saws up the middle, the board jolts and splits
 * with a gap; no moves or move dots across it), a saw cut (SAW CUT!, the groove on its edge, no move across it), the
 * cut taped over and healing away and the halves rejoining (the admins' trigger), his sounds through the mute switch.
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
/** An allowed move once it's your move (his cuts' limits), preferring `want`; a quiet one otherwise. */
async function allowedMove(page: Page, want: string[] = []): Promise<string> {
  await yourMove(page);
  const { fen, allowed } = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, allowed: (window as any).match.boss?.powers?.allowed as string[] | null }));
  const legal = allowed ?? new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
  const quiet = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && !m.promotion).map((m) => m.from + m.to);
  return want.find((m) => legal.includes(m)) ?? legal.filter((m) => quiet.includes(m)).sort()[0] ?? legal.sort()[0]!;
}
const file = (sq: string) => sq.charCodeAt(0) - 97;
const crossesMiddle = (m: string) => file(m.slice(0, 2)) <= 3 !== file(m.slice(2, 4)) <= 3;
/** How opaque a canvas over the board is at a point between two squares' middles (`k` of the way from a to b). */
const coveredBetween = (page: Page, a: string, b: string, canvas: string, k = 0.5) =>
  Promise.all([squareAt(page, a), squareAt(page, b)]).then(([qa, qb]) =>
    page
      .locator(canvas)
      .first()
      .evaluate((c: HTMLCanvasElement, [x, y]) => {
        const r = c.getBoundingClientRect();
        return c.getContext("2d")!.getImageData(Math.floor(((x! - r.left) / r.width) * c.width), Math.floor(((y! - r.top) / r.height) * c.height), 1, 1).data[3];
      }, [qa.x + (qb.x - qa.x) * k, qa.y + (qb.y - qa.y) * k]),
  );
/** The move dots on screen now, as squares (from their boxes). */
async function dotSquares(page: Page): Promise<string[]> {
  const board = (await page.locator("cg-board").first().boundingBox())!;
  const boxes = await page.locator("cg-board square.move-dest").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
  return boxes.map(([x, y]) => `${"abcdefgh"[Math.floor(((x! - board.x) / board.width) * 8)]}${8 - Math.floor(((y! - board.y) / board.height) * 8)}`);
}

/** A move that takes one of his pawns, if one may (so his split gets its room: the engine plays no ninth pawn). */
async function takeHisPawn(page: Page): Promise<string | null> {
  await yourMove(page);
  const { fen, allowed, side } = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, allowed: (window as any).match.boss?.powers?.allowed as string[] | null, side: (window as any).match.boss.crowdSide as string }));
  const his = side === "w" ? "b" : "w";
  const take = new Chess(fen).moves({ verbose: true }).filter((m) => m.captured === "p" && m.color !== his && !m.promotion && (!allowed || allowed.includes(m.from + m.to)));
  // (The cheapest piece takes it.)
  const order = "pnbrqk";
  return take.sort((a, b) => order.indexOf(a.piece) - order.indexOf(b.piece))[0] ? take[0]!.from + take[0]!.to : null;
}

test("Sawyer: his first move a pawn's, then the split (two halves, drawn as halves) once there's room; your move's knock; his saw cuts", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&boss=sawyer&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).match.boss.name)).toBe("Sawyer");

  // Move 1, after a real think: your move's knock is the first sound heard. His reply is a pawn move.
  await yourMove(page);
  await page.waitForTimeout(2500);
  await page.evaluate(() => ((window as any).__soundLog = []));
  const before = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  let split = await watchFor(page, {
    banner: { selector: ".fight-banner.power-cut", text: /SPLIT PAWN!/ },
    boy: { selector: ".pm-split .sw-boy" },
    saw: { selector: '.sw-layer[data-split="saw"]' },
    crack: { selector: ".sw-layer .sw-crack" },
    apart: { selector: '.sw-layer[data-split="apart"] piece.sw-half' },
    line: { selector: ".bc-bubble", text: /Two for one!|Half off!|Double trouble!/ },
  });
  await play(page, (await takeHisPawn(page)) ?? (await allowedMove(page)));
  await expect.poll(async () => (await soundsHeard(page)).map((s) => s.split(":")[0]), { timeout: 10_000 }).toContain("move");
  expect((await soundsHeard(page))[0]!.split(":")[0]).toBe("move");
  await yourMove(page);
  const first = await page.evaluate(() => (window as any).match.boss);
  const mine = first.crowdSide === "w" ? "b" : "w";
  const mid = new Chess(before);
  mid.move({ from: first.board.history.at(-2).slice(0, 2), to: first.board.history.at(-2).slice(2, 4), promotion: "q" });
  expect(mid.get(first.board.history.at(-1).slice(0, 2) as never)).toMatchObject({ type: "p", color: mine });

  // Until the split comes (at once, or after his first pawn move once one of his pawns is gone): take his pawns when
  // you can. Any saw cut on the way: nothing crosses it, and its groove is on its edge.
  let cuts = 0;
  for (let i = 0; i < 14 && !(await powers(page))?.split?.square; i++) {
    const p = await powers(page);
    if (p.cut && !cuts) {
      cuts++;
      await expect(page.locator(`.sw-cut[data-cut="${p.cut.a}-${p.cut.b}"]`)).toHaveCount(1);
      await expect.poll(() => coveredBetween(page, p.cut.a, p.cut.b, ".sw-cut-board", 0.47), { timeout: 5000 }).toBeGreaterThan(0);
      expect(await coveredBetween(page, p.cut.a, p.cut.b, ".sw-cut-board", 0)).toBe(0);
      for (const m of p.allowed ?? []) expect([`${p.cut.a}${p.cut.b}`, `${p.cut.b}${p.cut.a}`]).not.toContain(m);
    }
    split = await watchFor(page, {
      banner: { selector: ".fight-banner.power-cut", text: /SPLIT PAWN!/ },
      boy: { selector: ".pm-split .sw-boy" },
      saw: { selector: '.sw-layer[data-split="saw"]' },
      crack: { selector: ".sw-layer .sw-crack" },
      apart: { selector: '.sw-layer[data-split="apart"] piece.sw-half' },
      line: { selector: ".bc-bubble", text: /Two for one!|Half off!|Double trouble!/ },
    });
    await play(page, (await takeHisPawn(page)) ?? (await allowedMove(page, ["h2h3", "a2a3", "h7h6", "a7a6"])));
    await yourMove(page);
  }
  const boss = await page.evaluate(() => (window as any).match.boss);
  const sp = boss.powers.split;
  expect(sp.square, "the split came").toBeTruthy();
  expect(await split.seen()).toEqual({ banner: true, boy: true, saw: true, crack: true, apart: true, line: true });
  // The new half beside his pawn, both his, each drawn as its half (the one away from its partner).
  expect(sp.square[1]).toBe(sp.pawn[1]);
  expect(Math.abs(file(sp.square) - file(sp.pawn))).toBe(1);
  const pieces = new Chess(boss.board.fen);
  for (const h of sp.halves) expect(pieces.get(h.square)).toMatchObject({ type: "p", color: mine });
  const halves = await page.evaluate(() => [...document.querySelectorAll("cg-board piece.saw-half-l, cg-board piece.saw-half-r")].map((e) => `${(e as any).cgKey}:${e.classList.contains("saw-half-l") ? "l" : "r"}`).sort());
  const w = boss.crowdSide === "w";
  expect(halves).toEqual(sp.halves.map((h: { square: string; side: string }) => `${h.square}:${(h.side === "a") === w ? "l" : "r"}`).sort());
  const clip = await page.locator("cg-board piece.saw-half-l, cg-board piece.saw-half-r").first().evaluate((e) => getComputedStyle(e).clipPath);
  expect(clip).toContain("50%");
  // (Never a ninth pawn: the engine plays every position.)
  expect([...boss.board.fen.split(" ")[0]].filter((c) => c === (mine === "w" ? "P" : "p")).length).toBeLessThanOrEqual(8);
  expect(errors).toEqual([]);
});

test("Sawyer's board saw (?power=boardsaw): he saws up the middle, the board splits with a gap, nothing crosses it; the cut waits a turn; his sounds through mute", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("brc.muted", "1"));
  await page.goto("/?debug&clock=60&boss=sawyer&power=boardsaw&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await yourMove(page);
  await page.evaluate(() => ((window as any).__soundLog = []));
  await play(page, await allowedMove(page, ["g1f3", "b1c3", "g8f6", "b8c6"]));
  await yourMove(page);
  // The test switch warned of it as the 2nd turn began; it comes as the 3rd begins.
  expect((await powers(page)).warned).toBe(true);
  const saw = await watchFor(page, {
    banner: { selector: ".fight-banner.power-cut", text: /BOARD SAW!/ },
    run: { selector: '.sw-layer[data-boardsaw="run"] .sw-boy' },
    groove: { selector: '.sw-gap[data-state="run"]' },
    part: { selector: '.sw-gap[data-state="part"]' },
    jolt: { selector: ".board-area.pw-crash" },
    line: { selector: ".bc-bubble", text: /Timber!|Renovation time!|Down the middle!/ },
  });
  await play(page, await allowedMove(page, ["b1c3", "g1f3", "h2h3", "b8c6", "g8f6", "h7h6"]));
  await yourMove(page);
  expect(await saw.seen()).toEqual({ banner: true, run: true, groove: true, part: true, jolt: true, line: true });
  const p3 = await powers(page);
  expect(p3.boardSaw).toEqual({ at: 3, until: 7 });
  await expect(page.locator('.sw-gap[data-state="gap"]')).toBeVisible();
  // The gap sits on the line between the d and e files, the board's whole height.
  const gap = (await page.locator(".sw-gap").boundingBox())!;
  const board = (await page.locator("cg-board").first().boundingBox())!;
  expect(Math.abs(gap.x + gap.width / 2 - (board.x + board.width / 2))).toBeLessThanOrEqual(1.5);
  expect(gap.height).toBeGreaterThan(board.height - 2);
  // Nothing crosses it: not in the allowed moves, no move dots across it.
  const fen3 = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  expect(p3.allowed?.length).toBeGreaterThan(0);
  for (const m of p3.allowed) expect(crossesMiddle(m)).toBe(false);
  const across = new Chess(fen3).moves({ verbose: true }).find((m) => crossesMiddle(m.from + m.to) && p3.allowed.some((a: string) => a.startsWith(m.from)));
  expect(across, "a piece with a move across the middle").toBeTruthy();
  await tap(page, across!.from);
  await expect(page.locator("cg-board square.move-dest").first()).toBeVisible();
  for (const sq of await dotSquares(page)) expect(file(sq) <= 3, `${across!.from} → ${sq}`).toBe(file(across!.from) <= 3);
  await tap(page, across!.from);
  // The cut due on the 3rd turn waited for the saw: it comes on the 4th.
  expect(p3.cut ?? null).toBeNull();
  const cutSeen = await watchFor(page, { banner: { selector: ".fight-banner.power-cut", text: /SAW CUT!/ }, caster: { selector: ".pm-cut .pm-caster" } });
  await play(page, await allowedMove(page, ["h2h3", "a2a3", "h7h6", "a7a6"]));
  await yourMove(page);
  expect(await cutSeen.seen()).toEqual({ banner: true, caster: true });
  expect((await powers(page)).cut).toMatchObject({ at: 4, until: 6 });
  // His sounds came, and through the mute switch, silent.
  const heard = (await soundsHeard(page)).filter((x) => x.startsWith("sawyer"));
  expect(heard.map((x) => x.split(":")[0])).toEqual(expect.arrayContaining(["sawyerHop", "sawyerRev", "sawyerBigSaw", "sawyerCrack", "sawyerCut"]));
  for (const x of heard) expect(x).toMatch(/:muted$/);
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

test("Sawyer: the board saw from the admins' trigger, a cut taped over and healing, the halves rejoining", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await asAdmin(page);
  await page.goto("/?debug&clock=60&boss=sawyer&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await yourMove(page);
  const btn = page.locator(".ult-test");
  await btn.click();
  await expect(btn).toHaveText("Ultimate next turn (testing)");
  const both = await watchFor(page, { split: { selector: ".fight-banner.power-cut", text: /SPLIT PAWN!/ }, saw: { selector: ".fight-banner.power-cut", text: /BOARD SAW!/ } });
  await play(page, await allowedMove(page, ["g1f3", "b1c3"]));
  await yourMove(page);
  // (The split too, on the same turn, when there was room for it.)
  expect(await both.seen()).toEqual({ split: !!(await powers(page)).split?.square, saw: true });
  expect((await powers(page)).boardSaw).toEqual({ at: 2, until: 6 });
  await expect(btn).toHaveText("Ultimate used (testing)");

  // The cut on the 3rd turn: raw, then taped (stage 1), more tape (stage 2), then healing away.
  await play(page, await allowedMove(page, ["h2h3", "a2a3"]));
  await yourMove(page);
  const cut = (await powers(page)).cut;
  expect(cut).toMatchObject({ at: 3, until: 5 });
  for (const stage of [0, 1, 2]) {
    await expect(page.locator(`.sw-cut[data-cut="${cut.a}-${cut.b}"][data-stage="${stage}"]`)).toHaveCount(1);
    await expect.poll(() => coveredBetween(page, cut.a, cut.b, ".sw-cut-board", 0.47), { timeout: 5000 }).toBeGreaterThan(0);
    await play(page, await allowedMove(page, ["a2a3", "h2h3", "a3a4", "h3h4"]));
    await yourMove(page);
  }
  // Turn 6: the cut is gone; its tape has faded away.
  expect((await powers(page)).cut ?? null).toBeNull();
  await expect(page.locator(".sw-cut")).toHaveCount(0);
  await expect.poll(() => page.locator(".sw-cut-board").count(), { timeout: 5000 }).toBe(0);
  // Turn 7: the board saw is over: the halves close up and rejoin.
  expect((await powers(page)).boardSaw).toEqual({ at: 2, until: 6 });
  const close = await watchFor(page, { close: { selector: '.sw-gap[data-state="close"]' } });
  await play(page, await allowedMove(page, ["a3a4", "h3h4", "a4a5", "h4h5"]));
  await yourMove(page);
  expect((await powers(page)).boardSaw ?? null).toBeNull();
  expect((await close.seen()).close).toBe(true);
  await expect.poll(() => page.locator(".sw-gap").count(), { timeout: 5000 }).toBe(0);
  // Moves across the middle are back.
  const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  const allowed = (await powers(page)).allowed ?? new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to);
  expect(allowed.some(crossesMiddle)).toBe(new Chess(fen).moves({ verbose: true }).some((m) => crossesMiddle(m.from + m.to)));
  expect(errors).toEqual([]);
});
