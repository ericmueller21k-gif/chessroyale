import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOARD_SEL, test, bossAloneFromHome, engineTop, watchFor } from "./helpers.ts";

/**
 * Chub & Chirp (id hopper; live since Oct 18, their art wired in), played alone with real taps on a phone and a
 * computer: their tile and stage, and what the board shows for their powers (docs/decisions/2026-10-18-hopper-wired.md).
 * - Leapfrog (?power=leapfrog: the battle starts from 1.e4 e5, your move): at the start of his turn, "LEAPFROG!", his
 *   pawn stays on its square until it takes off, arcs over yours (on neither square meanwhile) and lands beyond it; a
 *   base on the board, no move added; then his move.
 * - The Carrot Patch (?power=carrotpatch: the cast at the start of his first turn; ?carrots=2: two carrots a step from
 *   his pieces and out of your reach, three a step from yours and out of his): "CARROT PATCH!", the carrots flying and
 *   planted, his ladder; the dock's count; you pull yours (each popping as your move lands, counted), he pulls his; all
 *   pulled, his spin: the reel stops on what he rolled, its cards only his count's prizes, and the prize pieces are on
 *   his side.
 * - His fifth carrot (?carrots=5: each carrot a step from one of his pieces, out of your reach, and he takes one whenever
 *   he can): you leave them, he pulls them, counted in the dock; the fifth wins the battle, no spin.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const bossNow = (p: Page) => p.evaluate(() => (window as any).match?.boss ?? null).catch(() => null);
const fenNow = (p: Page) => p.evaluate(() => (window as any).match.phase.board.fen as string);

async function squareAt(page: Page, square: string) {
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
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
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
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
/** The legal moves now (no promotions) that keep the battle going and that `ok` says yes to. */
function moves(fen: string, ok: (m: { from: string; to: string; captured?: string }, after: Chess) => boolean = () => true): string[] {
  return new Chess(fen)
    .moves({ verbose: true })
    .filter((m) => {
      if (m.promotion) return false;
      const after = new Chess(fen);
      after.move({ from: m.from, to: m.to });
      return !after.isGameOver() && ok(m, after);
    })
    .map((m) => m.from + m.to);
}
/** The carrots still in the ground. */
const openCarrots = (c: { squares: string[]; by: (string | null)[] }) => c.squares.filter((_, i) => !c.by[i]);
/** A prize's key, its pieces sorted ("-": nothing), as the reel's cards carry it. */
const key = (p: readonly string[]) => [...p].sort().join("") || "-";

test("Chub & Chirp's Leapfrog (the test switch): his pawn stays on its square until it takes off, arcs over yours and lands beyond it, then he moves", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&boss=hopper&power=leapfrog&laststand=0");
  await bossAloneFromHome(page);
  await yourMove(page);
  const boss = await bossNow(page);
  expect(boss.name).toBe("Chub & Chirp");
  expect(boss.powers.hop).toBeNull();
  const crowd: "w" | "b" = boss.crowdSide;
  const plies = await page.evaluate(() => (window as any).match.phase.board.history.length as number);
  // (Every frame of the hop's moment: its state, his pawns on the board, a pawn in the air, the banner.)
  await page.evaluate((his) => {
    const w = window as any;
    w.__hop = [];
    const look = () => {
      const layer = document.querySelector<HTMLElement>(".pm-hop .hp-layer");
      if (layer)
        w.__hop.push({
          hop: layer.dataset.hop,
          pawns: [...document.querySelectorAll(`.hb-board piece.${his}.pawn:not(.fading)`)].map((e) => e.getAttribute("data-square")),
          air: !!layer.querySelector("piece.hp-piece"),
          banner: /LEAPFROG!/.test(document.querySelector(".fight-banner")?.textContent ?? ""),
        });
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }, crowd === "w" ? "black" : "white");
  await play(page, crowd === "w" ? "g1f3" : "b8c6");
  await yourMove(page);
  const [from, over, to] = crowd === "w" ? ["e5", "e4", "e3"] : ["e4", "e5", "e6"];
  expect((await bossNow(page)).powers.hop).toEqual({ at: 1, from, over, to });
  const frames: { hop: string; pawns: string[]; air: boolean; banner: boolean }[] = await page.evaluate(() => (window as any).__hop);
  // Its moment: the banner first, then on the board, in order: on its square, in the air, landed.
  expect(frames.some((f) => f.banner)).toBe(true);
  expect(frames.map((f) => f.hop).filter((s, i, a) => s !== a[i - 1])).toEqual(["ready", "air", "landed"]);
  for (const f of frames.filter((x) => x.hop === "ready")) {
    expect(f.pawns).toContain(from);
    expect(f.pawns).not.toContain(to);
  }
  const air = frames.filter((x) => x.hop === "air");
  expect(air.length).toBeGreaterThanOrEqual(3);
  for (const f of air) {
    expect(f.pawns).not.toContain(from);
    expect(f.pawns).not.toContain(to);
    expect(f.air).toBe(true);
  }
  for (const f of frames.filter((x) => x.hop === "landed")) {
    expect(f.pawns).toContain(to);
    expect(f.pawns).not.toContain(from);
  }
  // On the board: a base at the hop's ply (no move added), then his move from it.
  const board = (await bossNow(page)).board;
  expect(board.history).toHaveLength(plies + 2);
  const hopped = new Chess(board.bases.find((b: { ply: number }) => b.ply === plies + 1).fen);
  expect(hopped.get(to as never)).toMatchObject({ color: crowd === "w" ? "b" : "w", type: "p" });
  expect(hopped.get(over as never)).toMatchObject({ color: crowd, type: "p" });
  expect(hopped.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""))).toContain(board.history[plies + 1]);
  expect(errors).toEqual([]);
});

test("Chub & Chirp's Carrot Patch (the test switches): the cast and its ladder, the dock's count, pulls by both sides, the reel stopping on his roll, the prize on the board", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&boss=hopper&power=carrotpatch&carrots=2&laststand=0");
  await bossAloneFromHome(page);
  await yourMove(page);
  const crowd: "w" | "b" = (await bossNow(page)).crowdSide;
  const his = crowd === "w" ? "b" : "w";
  // The cast, as his whole turn: the banner, the carrots in flight, planted on the board's canvas, his ladder after.
  const castSeen = await watchFor(page, {
    banner: { selector: ".fight-banner", text: /CARROT PATCH!/ },
    fly: { selector: ".pm-carrots .hp-fly" },
    ladder: { selector: ".hp-ladder", text: /What their carrots win/ },
    top: { selector: ".hp-ladder li.win", text: /they win/ },
    canvas: { selector: ".board-wrap > .hp-carrots" },
    dock: { selector: ".dock-line", text: /Chub & Chirp spent their turn planting carrots\./ },
  });
  // (The reel's cards and where it stopped, every frame it's on screen.)
  await page.evaluate(() => {
    const w = window as any;
    w.__reel = null;
    const look = () => {
      const r = document.querySelector<HTMLElement>(".hp-reel");
      if (r) w.__reel = { stopped: r.classList.contains("stopped"), shown: r.dataset.reel, won: document.querySelector<HTMLElement>(".hp-card.won")?.dataset.prize ?? null, cards: [...new Set([...r.querySelectorAll<HTMLElement>(".hp-card")].map((e) => e.dataset.prize))] };
      if (!w.__reel?.stopped) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  // (A quiet first move: passing after it costs him nothing, so the pass guard lets the cast come at once. After a
  // move like 3.d4, passing would lose real material and it waits: docs/decisions/2026-10-18-turn-passing-guard.md.)
  await play(page, crowd === "w" ? "d2d3" : "d7d6");
  await yourMove(page);
  expect(await castSeen.seen()).toEqual({ banner: true, fly: true, ladder: true, top: true, canvas: true, dock: true });
  let c = (await bossNow(page)).powers.carrots;
  expect(c.squares).toHaveLength(5);
  // The dock's count: his, yours, your moves left.
  const badge = page.locator(".dk-race");
  await expect(badge).toHaveAttribute("data-his", "0");
  await expect(badge).toHaveAttribute("data-yours", "0");
  await expect(badge).toHaveAttribute("data-left", "12");
  await expect(badge.locator(".dk-race-left")).toHaveText("12 left");
  // The race: you pull the carrots a step from your pieces (a pull of yours pops as your move lands and the dock counts
  // it), he pulls his.
  let yours = 0;
  for (let turn = 0; turn < 14; turn++) {
    c = (await bossNow(page)).powers.carrots;
    if (c.spin || c.over === "won") break;
    await yourMove(page);
    const fen = await fenNow(page);
    const open = openCarrots(c);
    const pull = moves(fen, (m) => open.includes(m.to))[0];
    const move = pull ?? (await engineTop(page)).top[0]!.move;
    const popSeen = pull ? await watchFor(page, { pop: { selector: ".pm-carrot" } }) : null;
    await play(page, move);
    await expect.poll(() => phase(page), { timeout: 90_000 }).toMatch(/^(play|results)$/);
    if ((await phase(page)) === "results") break;
    if (pull) {
      yours++;
      expect(await popSeen!.seen()).toEqual({ pop: true });
      const c2 = (await bossNow(page)).powers.carrots;
      if (!c2.spin) expect(Number(await badge.getAttribute("data-yours"))).toBe(c2.crowd);
    }
  }
  const end = await bossNow(page);
  c = end.powers.carrots;
  expect(yours).toBeGreaterThan(0);
  expect(c.crowd).toBeGreaterThanOrEqual(yours);
  expect(c.boss).toBeGreaterThan(0);
  expect(c.over).toMatch(/^(pulled|moves)$/);
  // His spin: the reel stopped on what he rolled, its cards only his count's prizes; the prize pieces on his side.
  expect(c.spin.tier).toBe(c.boss);
  const r = await page.evaluate(() => (window as any).__reel);
  expect(r.stopped).toBe(true);
  expect(r.shown).toBe(key(c.spin.rolled));
  expect(r.won).toBe(key(c.spin.rolled));
  const allowed: Record<number, string[]> = { 0: ["-"], 1: ["p", "pp"], 2: ["pp", "n", "b"], 3: ["n", "b", "r", "q", "qr"], 4: ["qq"] };
  for (const card of r.cards) expect(allowed[c.spin.tier]).toContain(card);
  const board = new Chess(end.board.fen);
  for (const sq of c.spin.squares) {
    expect(board.get(sq as never)).toMatchObject({ color: his });
    await expect(page.locator(`${BOARD_SEL.piece}[data-square="${sq}"]`)).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});

test("his fifth carrot (?carrots=5): you leave them, he pulls them one by one, counted in the dock; the fifth wins the battle, no spin", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&boss=hopper&power=carrotpatch&carrots=5&laststand=0");
  await bossAloneFromHome(page);
  const pullSeen = await watchFor(page, { pull: { selector: ".pm-carrot" } });
  // (Watching for his win's banner from his third carrot on: a watch lasts two minutes.)
  let winSeen: Awaited<ReturnType<typeof watchFor>> | null = null;
  let his = 0;
  for (let turn = 0; turn < 14; turn++) {
    await expect.poll(() => phase(page), { timeout: 90_000 }).toMatch(/^(play|results)$/);
    if ((await phase(page)) === "results") break;
    await yourMove(page);
    const c = (await bossNow(page)).powers.carrots;
    if (c) {
      // The dock counts his carrots.
      expect(Number(await page.locator(".dk-race").getAttribute("data-his"))).toBe(c.boss);
      expect(c.boss).toBeGreaterThanOrEqual(his);
      his = c.boss;
      if (his >= 3 && !winSeen) winSeen = await watchFor(page, { banner: { selector: ".fight-banner", text: /FIVE CARROTS!/ } });
    }
    if (turn === 0) {
      // (A quiet first move: passing after it costs him nothing, so the pass guard lets the cast come at once.)
      await play(page, (await bossNow(page)).crowdSide === "w" ? "d2d3" : "d7d6");
      continue;
    }
    const fen = await fenNow(page);
    const open = c ? openCarrots(c) : [];
    const quiet = moves(fen, (m, after) => !open.includes(m.to) && !m.captured && !after.inCheck());
    const off = moves(fen, (m) => !open.includes(m.to));
    const top = (await engineTop(page)).top.map((m) => m.move);
    await play(page, top.find((m) => quiet.includes(m)) ?? quiet[0] ?? top.find((m) => off.includes(m)) ?? off[0] ?? top[0]!);
  }
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("results");
  expect((await bossNow(page)).powers.carrots).toMatchObject({ boss: 5, over: "won", spin: null });
  expect(await pullSeen.seen()).toEqual({ pull: true });
  expect(await winSeen!.seen()).toEqual({ banner: true });
  await expect(page.locator(".team-result")).toHaveText(/Chub & Chirp won with their fifth carrot\./, { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test("their tile and stage, their figure by the board and the dock's count: whole on a phone (320 px) and a computer (1280 px)", async ({ page }, info) => {
  test.setTimeout(4 * 60_000);
  const phone = info.project.name === "phone";
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (phone) await page.setViewportSize({ width: 320, height: 640 });
  // (Their wider box in a phone's bar: below.)
  await page.goto("/?debug&mode=raid");
  const tile = page.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio", { name: "Chub & Chirp", exact: true });
  await expect(tile.locator("canvas.boss-portrait")).toBeVisible();
  expect((await tile.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  await tile.click();
  await expect(page.locator(".bs-stage .bs-sprite")).toHaveAttribute("data-fx", "hopper");
  await expect(page.locator(".bs-name")).toHaveText("Chub & Chirp");
  await page.waitForTimeout(500);
  const stage = (await page.locator(".bs-spot").boundingBox())!;
  const fig = (await page.locator(".bs-sprite").boundingBox())!;
  expect(fig.x).toBeGreaterThanOrEqual(stage.x - 1);
  expect(fig.x + fig.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
  // (Full size: drawn at the stage's one pixel size, 0.8 of a frame pixel per cqi, as every boss up to 70 px tall.)
  expect(Math.abs(fig.width - (84 * 0.8 * stage.width) / 100)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: info.outputPath(`hopper-select-${info.project.name}.png`) });
  // In their battle (the Carrot Patch's switch, for the dock's count): on a phone in the bar's usual box at its left,
  // whole on the screen, never over the board; on a computer by the board's bottom-left corner.
  await page.goto("/?debug&clock=60&boss=hopper&power=carrotpatch&laststand=0");
  await bossAloneFromHome(page);
  await yourMove(page);
  const char = page.locator(phone ? ".boss-char.place-bar" : ".boss-char.place-side");
  await expect(char).toBeVisible();
  if (phone) expect((await char.boundingBox())!.width).toBe(58);
  const sprite = (await char.locator("canvas").boundingBox())!;
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(sprite.x).toBeGreaterThanOrEqual(0);
  expect(sprite.x + sprite.width).toBeLessThanOrEqual(vw);
  expect(sprite.y).toBeGreaterThanOrEqual(0);
  if (phone) expect((await char.boundingBox())!.y + (await char.boundingBox())!.height).toBeLessThanOrEqual(board.y);
  else expect((await char.boundingBox())!.x + (await char.boundingBox())!.width).toBeLessThanOrEqual(board.x);
  // The cast, then the dock's count: a computer's in the status box beside your move's line and your clock; a phone's at
  // the left of the God King's line under it (the box keeps its room for the words), clear of him.
  // (A quiet first move: passing after it costs him nothing, so the pass guard lets the cast come at once. After a
  // move like 3.d4, passing would lose real material and it waits: docs/decisions/2026-10-18-turn-passing-guard.md.)
  await play(page, (await bossNow(page)).crowdSide === "w" ? "d2d3" : "d7d6");
  await yourMove(page);
  await expect(page.locator(".dk-race")).toHaveCount(1);
  const status = (await page.locator(".boss-dock-status").boundingBox())!;
  const badge = (await page.locator(".dk-race").boundingBox())!;
  const text = (await page.locator(".boss-dock-status .dk-text").boundingBox())!;
  const clock = (await page.locator(".boss-dock-status .dk-clock").boundingBox())!;
  if (phone) {
    const king = (await page.locator(".boss-dock > .gk-unit").boundingBox())!;
    expect(await page.locator(".dk-race").evaluate((e) => e.classList.contains("dk-race-below"))).toBe(true);
    expect(badge.x).toBeGreaterThanOrEqual(status.x - 50);
    expect(badge.x).toBeGreaterThanOrEqual(0);
    expect(badge.x + badge.width).toBeLessThanOrEqual(king.x);
    expect(badge.y).toBeGreaterThanOrEqual(status.y + status.height);
    expect(badge.y).toBeGreaterThanOrEqual(king.y - 1);
    expect(badge.y + badge.height).toBeLessThanOrEqual(king.y + king.height + 1);
  } else {
    expect(badge.x).toBeGreaterThanOrEqual(status.x);
    expect(badge.x + badge.width).toBeLessThanOrEqual(text.x + 1);
    expect(badge.y).toBeGreaterThanOrEqual(status.y);
    expect(badge.y + badge.height).toBeLessThanOrEqual(status.y + status.height);
  }
  expect(text.x + text.width).toBeLessThanOrEqual(clock.x + 1);
  expect(clock.x + clock.width).toBeLessThanOrEqual(status.x + status.width);
  expect(text.width).toBeGreaterThanOrEqual(90);
  // ("Your move." whole, on one line.)
  await expect(page.locator(".boss-dock-status .dk-text")).toHaveText(/^Your move\./);
  expect((await page.locator(".boss-dock-status .dk-text strong").first().boundingBox())!.height).toBeLessThanOrEqual(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: info.outputPath(`hopper-race-${info.project.name}.png`) });
  expect(errors).toEqual([]);
});
