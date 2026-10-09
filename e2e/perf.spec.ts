import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { test } from "./helpers.ts";
import { counts, frameStats, instrument } from "./perf-probe.js";

/**
 * Lag that grew with the match (.claude/LESSONS.md): a solo boss battle against Ginger, on a phone slowed 4x, stays
 * smooth late in a long game. Real moves first, measuring after each (DOM, animations, rAF callbacks per frame,
 * timers: none may grow); then the board's game made 120 plies long (a real game) and the frames measured while the
 * board sits and while a piece is dragged, then through the boss's turn. The whole match: `npm run perf:boss`.
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/** A legal game of `plies` moves that isn't over, White to move (the crowd's side), from a fixed seed. */
function longGame(plies: number): { history: string[]; fen: string } {
  for (let seed = 1; ; seed++) {
    const c = new Chess();
    const history: string[] = [];
    let s = seed;
    while (history.length < plies && !c.isGameOver()) {
      const moves = c.moves({ verbose: true });
      s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
      // Mostly quiet moves (captures empty the board too soon).
      const quiet = moves.filter((m) => !m.captured);
      const pool = quiet.length && s % 5 ? quiet : moves;
      const m = pool[s % pool.length]!;
      c.move(m);
      history.push(m.from + m.to + (m.promotion ?? ""));
    }
    if (history.length === plies && !c.isGameOver() && c.turn() === "w" && c.moves().length > 5) return { history, fen: c.fen() };
  }
}

test("a long boss battle on a slow phone: nothing grows, and late frames stay within budget", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(4 * 60_000);
  await page.addInitScript(instrument);
  await page.goto("/?debug&nolanding&clock=60&boss=gingerbread");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  /** On your move, after the round's banner: the counts, and the frames of a second and a half doing nothing. */
  const settle = async () => {
    await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
    await page.locator(".cc-banner", { hasText: "Round start" }).waitFor({ state: "detached", timeout: 20_000 }).catch(() => undefined);
    await page.evaluate(() => ((window as any).__perf.frames = []));
    await page.waitForTimeout(1500);
    const frames: [number, number][] = await page.evaluate(() => (window as any).__perf.frames.splice(0));
    const raf = frames.map((f) => f[1]).sort((a, b) => a - b);
    return { ...(await page.evaluate(counts)), idle: frameStats(frames.map((f) => f[0])), rafPerFrame: raf[Math.floor(raf.length / 2)] ?? 0 };
  };
  /** Plays an allowed move (a quiet one if there is one), through the app as the board does. */
  const move = async () => {
    const { fen, allowed } = await page.evaluate(() => {
      const m = (window as any).match;
      return { fen: m.phase.board.fen as string, allowed: (m.boss?.powers?.allowed ?? null) as string[] | null };
    });
    const legal = new Chess(fen).moves({ verbose: true });
    const ok = legal.filter((m) => !allowed || allowed.includes(m.from + m.to + (m.promotion ?? "")));
    const m = ok.find((m) => !m.captured && m.piece !== "k") ?? ok[0]!;
    await page.evaluate((uci) => (window as any).match.submit(uci), m.from + m.to + (m.promotion ?? ""));
    await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
  };

  const samples = [];
  for (let i = 0; i < 4; i++) {
    samples.push(await settle());
    await move();
  }
  const early = samples[0]!;

  // Late in the match: the board's game 120 plies long, shown as the round starts.
  const { history, fen } = longGame(120);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await page.evaluate(
    ({ history, fen }) => {
      const m = (window as any).match;
      const b = m.runner.boards.get(m.runner.state.boards[0]);
      Object.assign(b, { history: [...history], fen, lastMove: history[history.length - 1] });
      m.phase = { ...m.phase, board: { ...m.phase.board, fen, lastMove: b.lastMove, history: [...history], ply: history.length } };
      m.emit();
    },
    { history, fen },
  );
  const late = await settle();
  // A piece dragged round the board for two seconds (and put back), the frames measured.
  const board = (await page.locator("cg-board").first().boundingBox())!;
  const piece = new Chess(fen).moves({ verbose: true })[0]!.from;
  const at = (sq: string) => ({ x: board.x + (sq.charCodeAt(0) - 96.5) * (board.width / 8), y: board.y + (8.5 - Number(sq[1])) * (board.height / 8) });
  await page.evaluate(() => ((window as any).__perf.frames = []));
  await page.mouse.move(at(piece).x, at(piece).y);
  await page.mouse.down();
  for (let t0 = Date.now(), i = 0; Date.now() - t0 < 2000; i++) {
    await page.mouse.move(board.x + board.width * (0.5 + 0.3 * Math.cos(i / 6)), board.y + board.height * (0.5 + 0.3 * Math.sin(i / 6)));
    await page.waitForTimeout(16);
  }
  const drag = frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((f) => f[0]));
  await page.mouse.move(at(piece).x, at(piece).y);
  await page.mouse.up();
  // The boss's turn with the long game: its move and the next round's start.
  await move();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|results/);
  const turn = frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((f) => f[0]));

  const report = { early, after: samples.map((s) => ({ dom: s.dom, anims: s.anims, raf: s.rafPerFrame, timers: s.timeouts + s.intervals, idle: s.idle })), late, drag, turn };
  await test.info().attach("perf", { body: JSON.stringify(report, null, 1), contentType: "application/json" });
  const f = (s: { p95: number; slow: number }) => `p95 ${s.p95} ms, ${Math.round(s.slow * 100)}% dropped`;
  console.log(`late (120 plies): idle ${f(late.idle)}; drag ${f(drag)}; boss turn ${f(turn)}; DOM ${early.dom} → ${late.dom}, rAF/frame ${early.rafPerFrame} → ${late.rafPerFrame}`);
  // Nothing grows with the moves (a little slack for a banner or a bubble at the moment of counting).
  for (const s of [...samples, late]) {
    expect(s.dom, "DOM elements").toBeLessThanOrEqual(early.dom + 40);
    expect(s.anims, "running animations").toBeLessThanOrEqual(early.anims + 3);
    expect(s.rafPerFrame, "rAF callbacks per frame").toBeLessThanOrEqual(early.rafPerFrame + 3);
    expect(s.timeouts + s.intervals, "pending timers").toBeLessThanOrEqual(early.timeouts + early.intervals + 3);
  }
  // Late in the match, on the slowed phone: frames within budget sitting, dragging and through the boss's turn.
  // (Before the fix a long game's redraws took hundreds of ms each.)
  for (const [what, s] of [["idle", late.idle], ["drag", drag], ["boss turn", turn]] as const) {
    expect(s.p95, `${what}: 95th percentile frame (ms)`).toBeLessThan(50);
    expect(s.slow, `${what}: share of dropped frames`).toBeLessThan(0.15);
  }
});

test("G-REX's fire on a slow phone: a barrage of tiles late in a long game stays within budget", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(4 * 60_000);
  await page.addInitScript(instrument);
  // (?power=candle: the Roman candle on the third turn.)
  await page.goto("/?debug&nolanding&clock=60&boss=grex&power=candle");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const frames = async (ms: number) => {
    await page.evaluate(() => ((window as any).__perf.frames = []));
    await page.waitForTimeout(ms);
    return frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((f) => f[0]));
  };
  // Through the sparkler and the candle.
  for (let i = 0; i < 3; i++) {
    await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
    const { fen, allowed } = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, allowed: ((window as any).match.boss?.powers?.allowed ?? null) as string[] | null }));
    const legal = new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? "")).filter((m) => !allowed || allowed.includes(m));
    await page.evaluate((uci) => (window as any).match.submit(uci), legal[0]!);
    await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
  }
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  const early = await page.evaluate(counts);
  // Late, at the barrage's peak: a 120-ply game with nine fire tiles across the crowd's half in all three stages (empty
  // squares and pieces), and pips for the shots still to fall.
  const { history, fen } = longGame(120);
  const king = (() => {
    const c = new Chess(fen);
    for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) if (c.get(`${f}${r}` as never)?.type === "k" && c.get(`${f}${r}` as never)?.color === "w") return `${f}${r}`;
    return "";
  })();
  const squares = ["a1", "c1", "e2", "g2", "b3", "d3", "f3", "h4", "c4", "e4", "a3"].filter((sq) => sq !== king).slice(0, 9);
  await page.evaluate(
    ({ history, fen, squares }) => {
      const m = (window as any).match;
      const r = m.runner;
      const b = r.boards.get(r.state.boards[0]);
      Object.assign(b, { history: [...history], fen, lastMove: history[history.length - 1] });
      const p = r.state.boss.powers;
      r.state = { ...r.state, boss: { ...r.state.boss, powers: { ...p, fire: squares.map((square: string, i: number) => ({ square, lit: p.turn - (i % 3) })), candle: { at: p.turn - 5, left: 4 } } } };
      m.phase = { ...m.phase, board: { ...m.phase.board, fen, lastMove: b.lastMove, history: [...history], ply: history.length } };
      m.emit();
    },
    { history, fen, squares },
  );
  await expect(page.locator(".power-board .pw-fire")).toHaveCount(squares.length);
  await expect(page.locator(".power-board .pw-pips")).toHaveAttribute("data-left", "4");
  const late = await page.evaluate(counts);
  const idle = await frames(1500);
  // A piece dragged round the board for two seconds (and put back).
  const board = (await page.locator("cg-board").first().boundingBox())!;
  const piece = new Chess(fen).moves({ verbose: true })[0]!.from;
  const at = (sq: string) => ({ x: board.x + (sq.charCodeAt(0) - 96.5) * (board.width / 8), y: board.y + (8.5 - Number(sq[1])) * (board.height / 8) });
  await page.evaluate(() => ((window as any).__perf.frames = []));
  await page.mouse.move(at(piece).x, at(piece).y);
  await page.mouse.down();
  for (let t0 = Date.now(), i = 0; Date.now() - t0 < 2000; i++) {
    await page.mouse.move(board.x + board.width * (0.5 + 0.3 * Math.cos(i / 6)), board.y + board.height * (0.5 + 0.3 * Math.sin(i / 6)));
    await page.waitForTimeout(16);
  }
  const drag = frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((f) => f[0]));
  await page.mouse.move(at(piece).x, at(piece).y);
  await page.mouse.up();
  // The boss's turn: a piece left on a tile ablaze burns, then its move and the next round's start.
  const quiet = new Chess(fen).moves({ verbose: true }).find((m) => !m.captured && m.piece !== "k" && !squares.includes(m.from))!;
  await page.evaluate((uci) => (window as any).match.submit(uci), quiet.from + quiet.to);
  await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|results/);
  const turn = frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((f) => f[0]));
  const f = (s: { p95: number; slow: number }) => `p95 ${s.p95} ms, ${Math.round(s.slow * 100)}% dropped`;
  console.log(`G-REX, 9 fire tiles, 120 plies: idle ${f(idle)}; drag ${f(drag)}; boss turn ${f(turn)}; DOM ${early.dom} → ${late.dom}, anims ${early.anims} → ${late.anims}`);
  // The tiles' own elements and animations only (a few each), nothing per redraw.
  expect(late.dom, "DOM elements").toBeLessThanOrEqual(early.dom + 40 + squares.length * 6);
  for (const [what, s] of [["idle", idle], ["drag", drag], ["boss turn", turn]] as const) {
    expect(s.p95, `${what}: 95th percentile frame (ms)`).toBeLessThan(50);
    expect(s.slow, `${what}: share of dropped frames`).toBeLessThan(0.15);
  }
});
