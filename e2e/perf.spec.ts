import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { ITEM_DEFS, RECLUSE_PHASE2, adminCopy } from "@chessroyale/core";
import { SAW_SWAP_TEST_CHECK } from "@chessroyale/chess";
import { BOARD_SEL, asAdmin, giveItems, test, bossAloneFromHome, wearItem } from "./helpers.ts";
import { counts, frameStats, instrument } from "./perf-probe.js";
import { MOCKUP_LOOK, demoProfile, routeProfile } from "./public-profile-data.ts";
import { START, walkable } from "../packages/app/src/town/world.ts";
import { P } from "../packages/app/src/town/frame-report.ts";

/**
 * Lag that grew with the match (.claude/LESSONS.md): a solo boss battle against Ginger, on a phone slowed 4x, stays
 * smooth late in a long game. Real moves first, measuring after each (DOM, animations, rAF callbacks per frame,
 * timers: none may grow); then the board's game made 120 plies long (a real game) and the frames measured while the
 * board sits and while a piece is dragged, then through the boss's turn. The whole match: `npm run perf:boss`.
 *
 * Every test here is tagged `@perf`: a frame budget depends on the machine's speed, so CI's e2e leaves them out
 * (`--grep-invert @perf`). Run them locally under the e2e lock, or from the e2e workflow's manual run (Actions → e2e →
 * Run workflow, "perf").
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/** Some frames, for the log: the 95th percentile, the dropped ones (over 20 ms) and the longest. */
const f = (s: { n: number; p95: number; slow: number; max: number }) => `p95 ${s.p95} ms, ${Math.round(s.slow * 100)}% dropped (${Math.round(s.slow * s.n)} of ${s.n} over 20 ms), longest ${s.max} ms`;

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

test("a long boss battle on a slow phone: nothing grows, and late frames stay within budget", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(4 * 60_000);
  await page.addInitScript(instrument);
  await page.goto("/?debug&nolanding&clock=60&boss=gingerbread");
  await bossAloneFromHome(page);
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
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
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
  console.log(`late (120 plies): idle ${f(late.idle)}; drag ${f(drag)}; boss turn ${f(turn)}; DOM ${early.dom} → ${late.dom} (the move list ${early.list} → ${late.list}, ${late.rows} rows of ${late.cap}), rAF/frame ${early.rafPerFrame} → ${late.rafPerFrame}`);
  // Nothing grows with the moves (a little slack for a banner or a bubble at the moment of counting). The move list fills its
  // panel once, to the rows its box holds (and a few spare), then stays: counted apart (Nov 23; until then it kept every move's
  // row, about 1,750 elements at 120 plies).
  for (const s of [...samples, late]) {
    expect(s.dom - s.list, "DOM elements (but the move list's)").toBeLessThanOrEqual(early.dom - early.list + 40);
    expect(s.rows, "the move list's rows").toBeLessThanOrEqual(s.cap!);
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

test("Grex's fire on a slow phone: a barrage of tiles late in a long game stays within budget", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(4 * 60_000);
  await page.addInitScript(instrument);
  // (?power=candle: the Roman candle on the third turn.)
  // (?laststand=0: a move the God King would take back would put the candle off a turn.)
  await page.goto("/?debug&nolanding&clock=60&boss=grex&power=candle&laststand=0");
  await bossAloneFromHome(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const frames = async (ms: number) => {
    await page.evaluate(() => ((window as any).__perf.frames = []));
    await page.waitForTimeout(ms);
    return frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((f) => f[0]));
  };
  // Through the sparkler and the candle: the launch itself measured (he slams the candle down and fires 24 shots that
  // fan out, each whistling; the first wave's shadows appear as he jumps off).
  let launch: { n: number; p95: number; slow: number; max: number } | null = null;
  let draws = 0;
  for (let i = 0; i < 3; i++) {
    await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
    const { fen, allowed } = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, allowed: ((window as any).match.boss?.powers?.allowed ?? null) as string[] | null }));
    const legal = new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? "")).filter((m) => !allowed || allowed.includes(m));
    await page.evaluate((uci) => (window as any).match.submit(uci), legal[0]!);
    await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
    if (i === 1) {
      await page.locator(".pm-rex").waitFor({ timeout: 30_000 });
      // (How many times the board draws its pieces through the launch: the board under the moment, kept.)
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as (HTMLElement & { hbDraws?: number }) | null;
        Object.assign(window, { __launchBoard: el, __launchDraws: el?.hbDraws ?? 0 });
      }, BOARD_SEL.squares);
      await page.evaluate(() => ((window as any).__perf.frames = []));
      await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
      launch = frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((f) => f[0]));
      draws = await page.evaluate(() => ((window as any).__launchBoard?.hbDraws ?? 0) - (window as any).__launchDraws);
    }
  }
  console.log(`Grex's Roman candle launch (slowed phone): ${f(launch!)}, the board drawn ${draws} times`);
  // The screen draws every frame while the candle plays over the board; the board's pieces only when they change
  // (docs/areas/board.md): a few times at most, not once a frame (Oct 14: it was every frame).
  expect(draws, "the board's pieces drawn during the launch").toBeLessThan(10);
  expect(launch!.p95, "the launch: 95th percentile frame (ms)").toBeLessThan(50);
  expect(launch!.slow, "the launch: share of dropped frames").toBeLessThan(0.15);
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
    ({ history, fen, squares, king }) => {
      const m = (window as any).match;
      const r = m.runner;
      const b = r.boards.get(r.state.boards[0]);
      Object.assign(b, { history: [...history], fen, lastMove: history[history.length - 1] });
      const p = r.state.boss.powers;
      // (And the candle's waves on their way: eleven shadows in three sizes, under the pieces.)
      const shade = ["b1", "d1", "f1", "h1", "a2", "c2", "g3", "a4", "d4", "f4", "h3"].filter((sq) => !squares.includes(sq) && sq !== king);
      const waves = [0, 1, 2].map((n) => ({ lands: p.turn + 1 + n, shots: 4, squares: shade.slice(n * 4, n * 4 + 4) }));
      r.state = { ...r.state, boss: { ...r.state.boss, powers: { ...p, fire: squares.map((square: string, i: number) => ({ square, lit: p.turn - (i % 3) })), candle: { at: p.turn - 5, left: 12, next: 9, waves } } } };
      m.phase = { ...m.phase, board: { ...m.phase.board, fen, lastMove: b.lastMove, history: [...history], ply: history.length } };
      m.emit();
    },
    { history, fen, squares, king },
  );
  await expect(page.locator(".power-board .pw-fire")).toHaveCount(squares.length);
  await expect(page.locator(".boss-prop .pw-pips")).toHaveAttribute("data-left", "12");
  await expect(page.locator(".power-board .pw-shadow")).not.toHaveCount(0);
  const late = await page.evaluate(counts);
  const idle = await frames(1500);
  // A piece dragged round the board for two seconds (and put back).
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
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
  console.log(`Grex, 9 fire tiles and shadows, 120 plies: idle ${f(idle)}; drag ${f(drag)}; boss turn ${f(turn)}; DOM ${early.dom} → ${late.dom} (the move list ${early.list} → ${late.list}, ${late.rows} rows of ${late.cap}), anims ${early.anims} → ${late.anims}`);
  // The tiles' own elements and animations only (a few each), nothing per redraw. (The move list apart: it fills its panel
  // once, then stays, as in the long battle above.)
  expect(late.dom - late.list, "DOM elements (but the move list's)").toBeLessThanOrEqual(early.dom - early.list + 40 + squares.length * 6);
  expect(late.rows, "the move list's rows").toBeLessThanOrEqual(late.cap!);
  for (const [what, s] of [["idle", idle], ["drag", drag], ["boss turn", turn]] as const) {
    expect(s.p95, `${what}: 95th percentile frame (ms)`).toBeLessThan(50);
    expect(s.slow, `${what}: share of dropped frames`).toBeLessThan(0.15);
  }
});

test("Big Boy on a slow phone: his snack, his toy block and the whole Big Bounce stay within budget, the first time they show", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(4 * 60_000);
  await page.addInitScript(instrument);
  // (?power=bounce: the warning as the 2nd turn begins, the bounce after your 2nd move; the first toy block with it.)
  await page.goto("/?debug&nolanding&clock=60&boss=bigboy&power=bounce&laststand=0");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await bossAloneFromHome(page);
  /** The frames from now until `until` holds. */
  const through = async (until: () => Promise<boolean>, ms = 60_000) => {
    await page.evaluate(() => ((window as any).__perf.frames = []));
    await expect.poll(until, { timeout: ms }).toBe(true);
    return frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((f) => f[0]));
  };
  const move = async () => {
    const { fen, allowed } = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, allowed: ((window as any).match.boss?.powers?.allowed ?? null) as string[] | null }));
    const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && (!allowed || allowed.includes(m.from + m.to)));
    await page.evaluate((uci) => (window as any).match.submit(uci), legal[0]!.from + legal[0]!.to);
    await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
  };
  // The intro: his card, then his snack (the first time he waddles, eats, and his frames show).
  await page.locator(".boss-intro").waitFor({ timeout: 30_000 });
  const snack = await through(() => phase(page).then((p) => p === "play"));
  await move();
  // His reply, the toy block and the warning.
  const block = await through(() => phase(page).then((p) => p === "play"));
  await move();
  // The bounce: getting ready (the candidates, the engine), the bounce itself, his move.
  const bounce = await through(() => phase(page).then((p) => p === "play"));
  const powers = await page.evaluate(() => (window as any).match.boss.powers);
  expect(powers.bounce).toBeTruthy();
  console.log(`Big Boy (slowed phone): snack ${f(snack)}; block and warning ${f(block)}; bounce (${powers.bounce.moves.length} moved) ${f(bounce)}`);
  for (const [what, s] of [["snack", snack], ["block", block], ["bounce", bounce]] as const) {
    expect(s.p95, `${what}: 95th percentile frame (ms)`).toBeLessThan(50);
    expect(s.slow, `${what}: share of dropped frames`).toBeLessThan(0.15);
  }
});

test("Big Boy's tower on a slow phone: a block dropping on (the 9th), its wobble at 10 and its topple (the tip, ten blocks flying out) stay within budget, the first time they show (Nov 18)", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(4 * 60_000);
  await page.addInitScript(instrument);
  // (?power=tower: his first tower 8 tall on turn 2; 9 and 10 on turns 3 and 4; it falls as turn 5 begins.)
  await page.goto("/?debug&nolanding&clock=60&boss=bigboy&power=tower&laststand=0");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await bossAloneFromHome(page);
  const through = async (until: () => Promise<boolean>, ms = 60_000) => {
    await page.evaluate(() => ((window as any).__perf.frames = []));
    await expect.poll(until, { timeout: ms }).toBe(true);
    return frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((f) => f[0]));
  };
  // A quiet move, never onto his tower (that would knock it over).
  const move = async () => {
    await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
    const { fen, allowed, tower } = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, allowed: ((window as any).match.boss?.powers?.allowed ?? null) as string[] | null, tower: ((window as any).match.boss?.powers?.tower?.square ?? null) as string | null }));
    const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && m.to !== tower && (!allowed || allowed.includes(m.from + m.to)));
    await page.evaluate((uci) => (window as any).match.submit(uci), legal[0]!.from + legal[0]!.to);
    await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
  };
  await move();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await move();
  const stack = await through(() => phase(page).then((p) => p === "play"));
  await move();
  const wobble = await through(() => phase(page).then((p) => p === "play"));
  await move();
  const topple = await through(() => phase(page).then((p) => p === "play"));
  const powers = await page.evaluate(() => (window as any).match.boss.powers);
  expect(powers.scatter?.by).toBe("boss");
  console.log(`Big Boy's tower (slowed phone): 9th block ${f(stack)}; 10th and its wobble ${f(wobble)}; topple (${powers.scatter.squares.length} blocks) ${f(topple)}`);
  for (const [what, s] of [["stack", stack], ["wobble", wobble], ["topple", topple]] as const) {
    expect(s.p95, `${what}: 95th percentile frame (ms)`).toBeLessThan(50);
    expect(s.slow, `${what}: share of dropped frames`).toBeLessThan(0.15);
  }
});

test("Sawyer on a slow phone: the split, the board saw and his first saw cut stay within budget, the first time they show", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(4 * 60_000);
  await page.addInitScript(instrument);
  // (?power=boardsaw: the split and the warning as the 2nd turn begins, the board saw on the 3rd, the first cut the 4th.)
  await page.goto("/?debug&nolanding&clock=60&boss=sawyer&power=boardsaw&laststand=0");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await bossAloneFromHome(page);
  const through = async (until: () => Promise<boolean>, ms = 60_000) => {
    await page.evaluate(() => ((window as any).__perf.frames = []));
    await expect.poll(until, { timeout: ms }).toBe(true);
    return frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((f) => f[0]));
  };
  const move = async () => {
    const { fen, allowed } = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, allowed: ((window as any).match.boss?.powers?.allowed ?? null) as string[] | null }));
    const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && !m.promotion && (!allowed || allowed.includes(m.from + m.to)));
    await page.evaluate((uci) => (window as any).match.submit(uci), legal[0]!.from + legal[0]!.to);
    await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
  };
  await page.locator(".boss-intro").waitFor({ timeout: 30_000 });
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await move();
  // His first move, the split and the warning.
  const split = await through(() => phase(page).then((p) => p === "play"));
  await move();
  // The board saw: he leaps on, revs, saws up the middle, the board splits.
  const saw = await through(() => phase(page).then((p) => p === "play"));
  await move();
  // The first saw cut.
  const cut = await through(() => phase(page).then((p) => p === "play"));
  const powers = await page.evaluate(() => (window as any).match.boss.powers);
  expect(powers.split).toBeTruthy();
  expect(powers.boardSaw).toBeTruthy();
  expect(powers.cut).toBeTruthy();
  console.log(`Sawyer (slowed phone): split ${f(split)}; board saw ${f(saw)}; cut ${f(cut)}`);
  for (const [what, s] of [["split", split], ["board saw", saw], ["cut", cut]] as const) {
    expect(s.p95, `${what}: 95th percentile frame (ms)`).toBeLessThan(50);
    expect(s.slow, `${what}: share of dropped frames`).toBeLessThan(0.15);
  }
});

test("Chandy on a slow phone: his beam's cover, Dodge's scope-in (the blur under a moving mask) and warning volley, its beams with a hit's crack, and the kill stay within budget, the first time they show", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(5 * 60_000);
  await page.addInitScript(instrument);
  await asAdmin(page);
  const cdp = await page.context().newCDPSession(page);
  const through = async (until: () => Promise<boolean>, ms = 60_000) => {
    await page.evaluate(() => ((window as any).__perf.frames = []));
    await expect.poll(until, { timeout: ms }).toBe(true);
    return frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((f) => f[0]));
  };
  const move = async () => {
    await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
    const { fen, allowed } = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, allowed: ((window as any).match.boss?.powers?.allowed ?? null) as string[] | null }));
    const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && !m.promotion && (!allowed || allowed.includes(m.from + m.to)));
    await page.evaluate((uci) => (window as any).match.submit(uci), legal[0]!.from + legal[0]!.to);
    await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
  };
  // (Admins first: his battle from the Boss raid screen's Boss alone, as e2e/chandy.spec.ts.)
  const battle = async (power: string) => {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await page.goto(`/?debug&nolanding&clock=60&laststand=0&brain=stockfish&boss=chandy&power=${power}&mode=raid`);
    await expect(page.getByRole("main").getByRole("button", { name: /^Boss alone/ })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  };
  // The beam (?power=beam: it lands as your second turn begins): his move, the banner, his shot, the cover over 15 squares.
  await battle("beam");
  await move();
  const beam = await through(() => phase(page).then((p) => p === "play"));
  expect(await page.evaluate(() => (window as any).match.boss.powers.chandy.beam?.squares.length)).toBe(15);
  // Dodge (?power=dodge: the warning as your second turn begins, Dodge as your third does): from his move to the vote, the scope-in,
  // the slide, the warning volley's beams and the blank board opening.
  await battle("dodge");
  await move();
  await move();
  const scope = await through(() => page.evaluate(() => !!document.querySelector(".cd-root.cd-p-vote")));
  // A wrong square in round 1 (the beams travel, hold, your king cracks) and round 2 (the kill, his shatter, the result).
  const wrongVote = () =>
    page.evaluate(() => {
      const m = (window as any).match;
      const d = m.boss.powers.chandy.dodge;
      const safe = d.rounds[m.phase.dodge.round].safe as string;
      m.dodgeVote(["d3", "e3", "f3", "d4", "e4", "f4", "d5", "e5", "f5"].find((sq) => sq !== safe));
    });
  await wrongVote();
  const beams = await through(() => page.evaluate(() => (window as any).match.phase.dodge?.round === 1 && !!document.querySelector(".cd-root.cd-p-vote")));
  await wrongVote();
  const kill = await through(() => phase(page).then((p) => p === "results"));
  console.log(`Chandy (slowed phone): beam ${f(beam)}; Dodge's scope-in ${f(scope)}; its beams and crack ${f(beams)}; the kill ${f(kill)}`);
  for (const [what, s] of [["beam", beam], ["Dodge's scope-in", scope], ["Dodge's beams", beams], ["Dodge's kill", kill]] as const) {
    expect(s.p95, `${what}: 95th percentile frame (ms)`).toBeLessThan(50);
    expect(s.slow, `${what}: share of dropped frames`).toBeLessThan(0.15);
  }
});

test("the Hidden Boss's phase 2 on a slow phone: the phase change, four boards in play, his slashes and a board's fade to grey stay within budget", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(4 * 60_000);
  await page.addInitScript(instrument);
  // (An admin, as /api/me says for an email in ADMIN_EMAILS: only an admin meets him.)
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    try {
      const res = await route.fetch();
      const body = await res.json().catch(() => null);
      await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
    } catch {
      // The page is gone.
    }
  });
  const me = page.waitForResponse((r) => r.url().includes("/api/me") && r.request().method() === "GET");
  // (The hidden /bosses: the solo boss picker, where an admin meets him; the Boss raid screen's tile is locked.)
  await page.goto("/bosses?debug&nolanding&phase=2");
  await me;
  await page.waitForTimeout(500);
  await page.getByRole("dialog", { name: "Choose your boss" }).getByRole("button", { name: /^Hidden Boss/ }).click();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("phaseChange");
  await page.evaluate(() => ((window as any).__perf.frames = []));
  // (The phase change and the countdown after it: about 30 s since Oct 17, its added beats settings; since Nov 13 the cast about
  // 10 s longer, his two lines in it, 15 s allowed.)
  const P = RECLUSE_PHASE2.change;
  await expect.poll(() => page.evaluate(() => !!(window as any).match.simul?.playing), { timeout: 30_000 + P.transform.introMs + 6000 + 15_000 + P.countdownSeconds * 1000 }).toBe(true);
  const change = frameStats((await page.evaluate(() => (window as any).__perf.frames.splice(0))).map((f: [number, number]) => f[0]));
  // Four boards in play: the bots and he move on theirs (you don't), for eight and a half seconds: your move turns slow at 6.5 s, its
  // heart's slash in it (Nov 16).
  await page.waitForTimeout(8500);
  const play = frameStats((await page.evaluate(() => (window as any).__perf.frames.splice(0))).map((f: [number, number]) => f[0]));
  const moves = await page.evaluate(() => (window as any).match.simul.boards.reduce((n: number, b: { history: string[] }) => n + b.history.length, 0));
  expect(await page.evaluate(() => (window as any).match.simul.boards[0].hearts), "the slash came in that stretch").toBe(RECLUSE_PHASE2.hearts - 1);
  // Your last heart: the rest cut first (the admins' trigger), then the last, measured: its slash, his line and your board's slow fade
  // to grey under "TOO SLOW".
  const btn = page.getByRole("button", { name: "Lose a heart (testing)" });
  const hearts = () => page.evaluate(() => (window as any).match.simul.boards[0].hearts as number);
  while ((await hearts()) > 1) {
    const n = await hearts();
    await btn.click();
    await expect.poll(hearts).toBe(n - 1);
  }
  await page.waitForTimeout(RECLUSE_PHASE2.slash.ms + 500);
  await page.evaluate(() => ((window as any).__perf.frames = []));
  await btn.click();
  await page.waitForTimeout(RECLUSE_PHASE2.slash.ms + RECLUSE_PHASE2.slash.greyMs + 200);
  expect(await page.evaluate(() => (window as any).match.simul.boards[0].result?.how)).toBe("slow");
  const slash = frameStats((await page.evaluate(() => (window as any).__perf.frames.splice(0))).map((f: [number, number]) => f[0]));
  console.log(`phase 2 on a 4x-slowed phone: the phase change ${f(change)}; four boards in play ${f(play)}, ${moves} moves; the last heart's slash and the fade ${f(slash)}`);
  expect(moves, "moves played on the bots' boards meanwhile").toBeGreaterThan(4);
  for (const [what, s] of [["the phase change", change], ["four boards in play, a slash", play], ["the last heart's slash and the fade to grey", slash]] as const) {
    expect(s.p95, `${what}: 95th percentile frame (ms)`).toBeLessThan(50);
    expect(s.slow, `${what}: share of dropped frames`).toBeLessThan(0.15);
  }
});

test("worn items playing on a slow phone: a profile wearing the Fire & Ice Crown, a Smiley Face and the Candy Cane, its pawn and its tiles animating, stays within budget through a whole cycle (Nov 25)", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(2 * 60_000);
  await page.addInitScript(instrument);
  // (The page with the most items playing at once: the profile's pawn and its Wearing tiles. CSS on the drawings only, no frame loop.)
  const look = { ...MOCKUP_LOOK, head: { def: "fire-ice-crown", color: "red", blemish: 20, seed: 12 }, face: { def: "smiley-face", color: "yellow", blemish: 20, seed: 8 }, weapon: { def: "candy-cane", color: "red", blemish: 20, seed: 3 } };
  const profile = demoProfile({ look });
  await page.goto("/?nolanding");
  await routeProfile(page, profile);
  await page.goto(`/profile/${profile.id}?nolanding`);
  await expect(page.locator(".pp-tile")).toHaveCount(4);
  const live = await page.locator(".ia-live").count();
  expect(live, "items playing on the page").toBeGreaterThanOrEqual(3);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.waitForTimeout(500);
  await page.evaluate(() => ((window as any).__perf.frames = []));
  // (The longest cycle is the cane's, 6.5 s; the crown's 6.)
  await page.waitForTimeout(7_000);
  const s = frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((x) => x[0]));
  console.log(`worn items playing (${live} live, slowed phone): ${f(s)}`);
  expect(s.n, "frames in 7 s").toBeGreaterThan(100);
  expect(s.p95, "95th percentile frame (ms)").toBeLessThan(50);
  expect(s.slow, "share of dropped frames").toBeLessThan(0.15);
});

test("the end screen on a slow phone: its frames through the count, the lob and the bar's fill, a level-up included (Nov 9; Nov 20)", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(3 * 60_000);
  await page.addInitScript(instrument);
  // (490 XP, then a won game counted as 12 minutes: 170 XP, through a level-up (500 a level). e2e/xp.spec.ts has the fill's own checks.)
  await page.goto("/?debug&nolanding&pace=quick&win=1&boss=gingerbread&xp=490&xpgame=12");
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "hc_session"), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => ((await (await page.request.get("/api/me")).json()) as { xp?: number }).xp, { timeout: 20_000 }).toBe(490);
  await bossAloneFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  // (Slowed from the mate on: the result screen comes, the box waits for its XP, then fills.)
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => (window as any).match.submit("h5f7"));
  // (The end screen, Nov 20: from its first frame through XP EARNED's count, its lob and the bar's fill, to its end.)
  await page.getByTestId("es-rewards").waitFor({ timeout: 60_000 });
  await page.evaluate(() => ((window as any).__perf.frames = []));
  // (To the coin strip's start: the count, the lob and the fill.)
  const strip = page.getByTestId("es-coin-strip");
  await expect(strip).toHaveAttribute("data-cs", "run", { timeout: 30_000 });
  const s = frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((x) => x[0]));
  console.log(`the end screen's count, lob and fill (slowed phone): ${f(s)}`);
  expect(s.n, "frames while it filled").toBeGreaterThan(20);
  expect(s.p95, "95th percentile frame (ms)").toBeLessThan(50);
  expect(s.slow, "share of dropped frames").toBeLessThan(0.15);
  // The coin strip (Nov 25): its canvas's falling coins and the count's rolling digits, to its end; then no frames of its own.
  await expect(strip).toHaveAttribute("data-cs", "done", { timeout: 30_000 });
  const c = frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((x) => x[0]));
  console.log(`the coin strip's drop and count (slowed phone): ${f(c)}`);
  expect(c.n, "frames while the coins dropped").toBeGreaterThan(15);
  expect(c.p95, "the strip: 95th percentile frame (ms)").toBeLessThan(50);
  expect(c.slow, "the strip: share of dropped frames").toBeLessThan(0.15);
  await expect(page.getByTestId("es-rewards")).toHaveAttribute("data-es", "done", { timeout: 30_000 });
});

test("the boss's attack on your pawn on a slow phone: a loss's result screen while he attacks and your XP fills (Nov 9)", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(3 * 60_000);
  await page.addInitScript(instrument);
  // (Ginger mates you at once: his attack where he stands, your pawn jolting at each lash, ResultDuo.tsx.)
  await page.goto("/?debug&nolanding&pace=quick&mate=1&boss=gingerbread");
  await bossAloneFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("boss");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.locator(".results-duo").waitFor({ timeout: 60_000 });
  await page.evaluate(() => ((window as any).__perf.frames = []));
  await expect(page.locator(".results-duo")).toHaveAttribute("data-attack", "done", { timeout: 30_000 });
  const s = frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((x) => x[0]));
  console.log(`the boss's attack on your pawn (slowed phone): ${f(s)}`);
  expect(s.n, "frames while he attacked").toBeGreaterThan(20);
  expect(s.p95, "95th percentile frame (ms)").toBeLessThan(50);
  expect(s.slow, "share of dropped frames").toBeLessThan(0.15);
});

/**
 * A fixed piece of work like the town loading screen's painting (render.ts `warm`: each picture's pixels worked out as rows of
 * palette keys, read into RGBA and put on its own canvas), timed in the page: the middle of three runs (ms; about 1 s on a slowed
 * phone). Runs in the page.
 */
function townRefJob(): number {
  const once = () => {
    const t0 = performance.now();
    for (let k = 0; k < 400; k++) {
      const n = 96;
      const rows = Array.from({ length: n }, (_, j) => Array.from({ length: n }, (_, i) => ((i * 31 + j * 17 + k) % 7 ? "abc"[(i + j + k) % 3]! : ".")).join(""));
      const data = new Uint8ClampedArray(n * n * 4);
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const c = rows[y]![x];
          if (c === ".") continue;
          const i = (y * n + x) * 4;
          data[i] = c === "a" ? 200 : 40;
          data[i + 1] = c === "b" ? 180 : 60;
          data[i + 2] = 90;
          data[i + 3] = 255;
        }
      const cv = document.createElement("canvas");
      cv.width = cv.height = n;
      cv.getContext("2d", { willReadFrequently: true })!.putImageData(new ImageData(data, n, n), 0, 0);
    }
    return performance.now() - t0;
  };
  return [once(), once(), once()].sort((a, b) => a - b)[1]!;
}
/**
 * The town's first frame may take this many reference jobs (`townRefJob`): set Nov 23 from this machine's runs, a quarter over (20,
 * when its runs read 13.4 to 18.1). Since the paint workers (Nov 23, town/paint-pool.ts): 12, the median of a first visit's runs (8.9 to
 * 11.0 over 3 runs of both towns, median 9.6) and a quarter. docs/decisions/2026-11-23-town-paint-workers.md. Nov 28: 14, for the
 * warm-up under the loading card and the box tops worked out there (about 1.5 s at 4x on a first visit; Eric, Nov 27: a couple of seconds
 * more loading is fine if it then plays smooth): 11.1 and 12.9 measured. docs/decisions/2026-11-28-town-load-smooth.md. Nov 28, later: 16,
 * for a first visit's pictures kept under the card (about 1 s at 4x; it was a hitch after the card lifted, Eric: "load the town first so it
 * doesn't lag"): 12.8 and 14.1 measured. Nov 28, phase 1c: 8. Nothing is painted or kept on the device any more (the build's baked
 * files, the sidekicks' frames among them): 4.6 to 5.3 measured over 3 runs of both towns (5.9 in phase 1b's runs, on another machine);
 * the largest of them all and a third. docs/decisions/2026-11-28-town-no-device-painting.md.
 */
const TOWN_LOAD_REFS = 8;
/** (Until Nov 28 `&paintslow=4` too, which slowed the paint workers as CDP slows the page: nothing is painted on the device now.) */
const TOWN_SLOW = "/?sky=day";
/** And its longest task (`townRefJob`s; Nov 23: 2, when painting froze the loading bar for up to 1.8). Nov 28, phase 1c: 1; measured 0.5
 * to 0.6 over 3 runs of both towns (the town's code starting, before its card shows; under the card, the warm-up's first frame). */
const TOWN_LONG_REFS = 1;

// (Nov 13: the street town is everyone's: a player's (a guest's here) and an admin's, both with the loading screen; before, a player's was the
// old Canvas 2D town, timed to its first frame under 2.5 s.)
for (const who of ["a player's town", "an admin's town"] as const)
  test(`Chess Town on a slow phone: ${who} shows its loading screen soon after the tap (Nov 11), then draws, with no long freeze (Nov 10, phone load 3)`, { tag: "@perf" }, async ({ page }) => {
    test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
    test.setTimeout(2 * 60_000);
    if (who === "an admin's town") await asAdmin(page);
    await page.addInitScript(() => {
      const w = window as unknown as { __long: { s: number; d: number }[] };
      w.__long = [];
      new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__long.push({ s: e.startTime, d: e.duration }))).observe({ type: "longtask", buffered: true });
    });
    await page.goto(TOWN_SLOW);
    const town = page.getByRole("main").getByRole("button", { name: "Chess Town", exact: true }).first();
    await town.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(3000);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    // (This machine's speed, slowed as the load is: a fixed job like the loading screen's (pixel grids built as strings, read
    // back into pixels and put on canvases), the middle of three. The load is checked as a multiple of it, so a faster or slower
    // machine moves both (Nov 23).)
    const ref = await page.evaluate(townRefJob);
    await page.evaluate(() => addEventListener("pointerup", () => ((window as unknown as { __tap: number }).__tap = performance.now()), { capture: true, once: true }));
    await town.click();
    const canvas = page.locator("canvas.town-canvas");
    // (The street town, Nov 11: its loading screen first (Eric: "I have no issue with doing a loading screen for the town… even if it
    // takes 3 or 5 seconds"): what's timed is the tap to that screen; its first frame comes once every picture is in.)
    const sinceTap = () => page.evaluate(() => performance.now() - (window as unknown as { __tap: number }).__tap);
    await expect(page.locator(".town-loading")).toBeVisible({ timeout: 60_000 });
    const shown = await sinceTap();
    await expect(canvas).toHaveAttribute("data-ready", "1", { timeout: 90_000 });
    await expect(canvas).toHaveAttribute("data-backend", "webgl");
    const loaded = await sinceTap();
    // (The first frame was drawn just before data-ready was read: within one frame of it.)
    const long = await page.evaluate(() => {
      const w = window as unknown as { __long: { s: number; d: number }[]; __tap: number };
      return Math.max(0, ...w.__long.filter((e) => e.s >= w.__tap - 5).map((e) => e.d));
    });
    // (Nov 28, phase 1: none painted here. The build's baked files, fetched and uploaded whole, their decoded copies let go: town/baked.ts.
    // Until then a first visit painted them, on the phone's other cores too.)
    const paint = await page.evaluate(() => (window as unknown as { __townPaint: () => { pictures: { baked: boolean; files: number; bytes: number; open: boolean; count: number } } }).__townPaint().pictures);
    console.log(`${who} (slowed phone): loading screen ${Math.round(shown)} ms after the tap, the town's first frame ${Math.round(loaded)} ms (${(loaded / ref).toFixed(1)} x the reference job's ${Math.round(ref)} ms), longest task ${Math.round(long)} ms; ${paint.count} pictures from ${paint.files} baked files (${(paint.bytes / 1048576).toFixed(2)} MB)`);
    expect({ baked: paint.baked, open: paint.open }, "the build's baked pictures loaded, their decoded files let go once uploaded").toEqual({ baked: true, open: false });
    // (Nov 10, headless Chromium: about 2.1 s and 1.4 s for the street town; before phone load 3, 5.8 s and 4.6 s. The old town, a player's
    // until Nov 13: about 1.7 s to its first frame.)
    expect(shown, "tap to the loading screen (ms)").toBeLessThan(3000);
    // (A bound on the town playable, Nov 13 review m2: a load regression for every player shows here. Until Nov 23 it was 8 s, never
    // met on a slowed phone since the loading screen paints every picture first (Nov 11): 15.4 s at Nov 13's main, 16.5 s at Nov 22's
    // on the same machine. Now a multiple of the reference job, set from those runs with a quarter's room:
    // docs/decisions/2026-11-23-town-load-bound.md.)
    expect(loaded / ref, "tap to the town's first frame, in reference jobs").toBeLessThan(TOWN_LOAD_REFS);
    // (The longest task too, Nov 23: under 2 s until then, close to it on a slower machine (1.97 s). Measured 1.3 to 1.8 reference
    // jobs at 4x and 2x slowing, about 1.5 the middle: 2 is about a third over it, as 2 s was over the 1.5 s it measured.)
    expect(long / ref, "longest task, in reference jobs").toBeLessThan(TOWN_LONG_REFS);
  });

/**
 * A visit's first frame, in reference jobs: every visit loads the build's baked files (Nov 28, the town's structure, phase 1), a first
 * one from the server and a later one from the service worker's copies. Phase 1c measured both again, the sidekicks' frames baked too
 * and nothing painted or kept on the device: a first visit 5.1 to 5.6, a later one 3.8 to 5.8 (3 runs each); the budget is the largest
 * and a third, one for both: a first visit is a later one now. (History: 6 for a second visit with the first's pictures kept, Nov 23; 8
 * for a first visit's baked files, phase 1b, when it measured 5.9 to 6.0.)
 */
const TOWN_VISIT_REFS = 8;

test("Chess Town on a slow phone: a first visit and a second both load the build's baked pictures, every picture's pixels and what the GPU holds for it the same, and draw as soon as each other (Nov 28; Nov 23: a second visit's kept pictures)", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(4 * 60_000);
  const cdp = await page.context().newCDPSession(page);
  type Pics = { baked: boolean; bakedMs: number; files: number; bytes: number; open: boolean; count: number };
  const pics = () => page.evaluate(() => (window as unknown as { __townPaint?: () => { pictures: Pics } | null }).__townPaint?.()?.pictures ?? null);
  const sum = () => page.evaluate(() => (window as unknown as { __townPictureSum: () => { n: number; hash: string; gpu: string | null } }).__townPictureSum());
  const visit = async () => {
    await page.goto(TOWN_SLOW);
    const town = page.getByRole("main").getByRole("button", { name: "Chess Town", exact: true }).first();
    await town.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(3000);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const ref = await page.evaluate(townRefJob);
    await page.evaluate(() => addEventListener("pointerup", () => ((window as unknown as { __tap: number }).__tap = performance.now()), { capture: true, once: true }));
    await town.click();
    const canvas = page.locator("canvas.town-canvas");
    await expect(canvas).toHaveAttribute("data-ready", "1", { timeout: 90_000 });
    const loaded = await page.evaluate(() => performance.now() - (window as unknown as { __tap: number }).__tap);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    return { ref, loaded, pics: (await pics())! };
  };
  // The first visit loads the build's baked files: none painted here, and their decoded copies let go once the GPU has them.
  const one = await visit();
  expect({ baked: one.pics.baked, open: one.pics.open }, "the first visit loads the baked pictures").toEqual({ baked: true, open: false });
  const first = await sum();
  expect(first.n, "pictures the loading screen put in place").toBeGreaterThan(2000);
  // The second loads the same files (the service worker's kept copies): every picture's pixels, and what the GPU holds for each, the first's.
  // (That the GPU holds the build's own pixels, picture by picture: e2e/town-street.spec.ts, "the town loads the build's baked pictures".
  // That the build's are the painting code's: packages/app/test/town-bake.test.ts. Until phase 1c a third visit painted them here.)
  const two = await visit();
  expect(two.pics.baked, "the second visit loads the baked pictures").toBe(true);
  expect(await sum(), "every picture's pixels, as the first visit had them").toEqual(first);
  console.log(`Chess Town's baked pictures (slowed phone): first visit ${Math.round(one.loaded)} ms (${(one.loaded / one.ref).toFixed(1)} x ${Math.round(one.ref)} ms; fetching and decoding ${Math.round(one.pics.bakedMs)} ms), second ${Math.round(two.loaded)} ms (${(two.loaded / two.ref).toFixed(1)} x ${Math.round(two.ref)} ms; ${Math.round(two.pics.bakedMs)} ms); ${one.pics.count} pictures from ${one.pics.files} files, ${(one.pics.bytes / 1048576).toFixed(2)} MB`);
  expect(one.loaded / one.ref, "a first visit's tap to its first frame, in reference jobs").toBeLessThan(TOWN_VISIT_REFS);
  expect(two.loaded / two.ref, "a second visit's tap to its first frame, in reference jobs").toBeLessThan(TOWN_VISIT_REFS);
});

/**
 * The town busy (Eric, Nov 27: "its not the residents lol, if thats the case the game is dead, imagine 50+ users on"): 55 other players
 * there, each walking to a new square at every answer of the server's (the town's beat), and a player's chat line every 250 ms, cost our
 * frame next to nothing more than an empty town on the same walk, and the page next to nothing outside it. Measured with the frame report
 * (`?report`: our parts a frame; the browser's long frames' other scripts: the presence and chat handling, never in our parts).
 */
test("Chess Town busy on a slow phone: 55 other players walking, six ranked games seated at the tables and a chat line every 250 ms cost our frame little more than an empty town's, and the page little outside it (Nov 27)", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(5 * 60_000);
  await busyTown(page, false);
});

/**
 * The same, half of them wearing an item that plays in the town (Eric, Nov 27: "it needs to be playing in the town"): the Gift-Wrap Tube or
 * the Candy Cane, in four colors each (eight looks: TOWN_ITEM_FRAMES.othersLooks of them play, the rest stand still). The same budget, and
 * a second walk uploads none of their frames again (each uploaded once, as it first showed; again only if its spare page starts again).
 */
test("Chess Town busy on a slow phone, half of them wearing the tube or the cane, playing: the same frame budget, and their frames uploaded once (Nov 27)", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(6 * 60_000);
  await busyTown(page, true);
});

/** (The busy town's walks: `wearing`, half the others in the tube or the cane.) */
async function busyTown(page: Page, wearing: boolean) {
  const colors = ["red", "cobalt", "gold", "green"];
  const wear = (i: number) => (wearing && i % 2 ? { weapon: { def: i % 4 === 1 ? "gift-tube" : "candy-cane", color: colors[Math.floor(i / 4) % 4]!, blemish: 30, seed: 4 } } : undefined);
  // (The server's answers: everyone else in the town. 55 players on walkable squares near the start, each a few squares on at every answer.)
  const spots: [number, number][] = [];
  for (let d = 1; spots.length < 400 && d < 20; d++)
    for (let dc = -d; dc <= d; dc++)
      for (const dr of [-d, d]) for (const [c, r] of [[START.c + dc, START.r + dr], [START.c + dr, START.r + dc]] as const) if (walkable(c, r) && !spots.some(([a, b]) => a === c && b === r)) spots.push([c, r]);
  let busy = false;
  let beat = 0;
  await page.route("**/api/town/here", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    beat++;
    const others = busy ? Array.from({ length: 55 }, (_, i) => { const [c, r] = spots[(i * 7 + beat * 3) % spots.length]!; return { id: `busy-${i}`, name: `Walker ${i + 1}`, c, r, zzz: false, pawn: i % 2 ? "black" : "white", look: wear(i) }; }) : [];
    // (Six ranked games at the park's tables, Nov 27: each pair seated on its stools with their tags, its board playing.)
    const tables = busy ? Array.from({ length: 6 }, (_, t) => ({ code: `BUSY${t}`, table: t, seats: [0, 1].map((k) => ({ uid: `seat-${t}-${k}`, name: `Player ${t * 2 + k + 1}`, look: null, pawn: k ? "black" : "white" })) })) : [];
    await route.fulfill({ json: { others, tables } });
  });
  // (Nov 28, Eric's frame report: his ride's frames and trail marks uploaded as each first showed. Not wearing: you ride the Chirp, whose
  // frames and marks the loading screen keeps, so the first walk uploads nothing.)
  if (!wearing) {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "View profile", exact: true }).or(page.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Profile" })).filter({ visible: true }).first()).toBeVisible();
    const [chirp] = await giveItems(page, [{ def: "riding-chirp", color: "cobalt", blemish: 0 }]);
    await wearItem(page, "ride", chirp!);
  }
  await page.goto(`/town?sky=day&report=120&townroom=busy${Date.now().toString(36)}`);
  const canvas = page.locator("canvas.town-canvas");
  await expect(canvas).toHaveAttribute("data-ready", "1", { timeout: 90_000 });
  type W = { __townHush: (on: boolean) => void; __townWalk: (s: readonly [number, number]) => boolean; __townYou: () => { moving: boolean } | null; __townHere: () => { you: boolean; here: boolean }[]; __townSay: (n: string, l: string, k?: string) => void; __townReport: () => { state: string; summary: { frames: number; uploads: number; resets: number; uploadsBy: [string, number][]; segs: { avg: number[]; mean: number }[]; long: { n: number; ms: number; scripts: number; layout: number; by: [string, number][] } | null } | null } | null; __chat?: number };
  await page.evaluate(() => (window as unknown as W).__townHush(true));
  // (A first visit's pictures saved, so their packing isn't in either walk.)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __townPaint: () => { pictures: { saved?: number } } }).__townPaint().pictures.saved), { timeout: 90_000 }).not.toBeUndefined();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const walk = async () => {
    // (Round a square of the street and back, twice: about 15 s, three of the server's answers.)
    for (const sq of [[START.c + 6, START.r], [START.c + 6, START.r + 6], [START.c, START.r + 6], [START.c, START.r], [START.c + 6, START.r], [START.c + 6, START.r + 6], [START.c, START.r + 6], [START.c, START.r]] as const) {
      await page.evaluate((s) => (window as unknown as W).__townWalk(s), sq);
      await page.waitForTimeout(300);
      await page.waitForFunction(() => !(window as unknown as W).__townYou()?.moving, null, { timeout: 30_000 }).catch(() => undefined);
    }
    await page.locator(".tfr-pill").getByRole("button", { name: "Done" }).click();
    const s = (await page.evaluate(() => (window as unknown as W).__townReport()))!.summary!;
    // (Ours: every part of a frame but the time outside our code.)
    const ours = s.segs[0]!.avg.slice(0, P.outside).reduce((a, b) => a + b, 0);
    await page.locator(".tfr-panel").getByRole("button", { name: "Again" }).click();
    return { ours, frames: s.frames, mean: s.segs[0]!.mean, long: s.long, parts: s.segs[0]!.avg.slice(0, P.outside).map((x) => +x.toFixed(2)).join(" "), uploads: `${s.uploads} uploads: ${s.uploadsBy.map(([k, n]) => `${k} ${n}`).join(", ")}; ${s.resets} pages started again`, frameUps: s.uploadsBy.find(([k]) => k === "dressed pawn frame")?.[1] ?? 0 };
  };
  const empty = await walk();
  if (!wearing) {
    const ride = await page.evaluate(() => (window as unknown as { __townRide: () => { you: { ride: string | null; ready: boolean } } }).__townRide().you);
    expect(ride, "on the Chirp, its frames ready").toMatchObject({ ride: "riding-chirp", ready: true });
    expect(empty.uploads, "the first walk after the loading screen uploads nothing (its ride's frames and marks kept there)").toMatch(/^0 uploads/);
  }
  busy = true;
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__townHere().filter((h) => !h.you && h.here).length), { timeout: 30_000, message: "the other players in the town" }).toBeGreaterThanOrEqual(50);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __townHere: () => { here: boolean; match: string | null; table: number | null }[] }).__townHere().filter((h) => h.here && h.match && h.table !== null).length), { timeout: 30_000, message: "the six games' players seated" }).toBe(12);
  await page.evaluate(() => {
    const w = window as unknown as W;
    let k = 0;
    w.__chat = window.setInterval(() => w.__townSay(`Walker ${(k % 55) + 1}`, `hello everyone, line ${k++}`, "player"), 250);
  });
  // (Their name tags made between frames as they came, Nov 27: render.ts queueTags. Once made, the busy town's walk is measured.)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __townPaint: () => { tagsQueued: number } }).__townPaint().tagsQueued), { timeout: 60_000, message: "newcomers' tags still to make" }).toBe(0);
  // (Wearing: the eight looks dressed, their frames painted off the frame loop, before the walk is measured.)
  if (wearing) await expect.poll(() => page.evaluate(() => (window as unknown as { __townHere: () => { you: boolean; look: unknown; dressed: boolean }[] }).__townHere().filter((h) => !h.you && h.look && !h.dressed).length), { timeout: 60_000, message: "wearers still being dressed" }).toBe(0);
  const beats = beat;
  const full = await walk();
  // (Wearing: the same walk again, every frame they play uploaded by now: none again, no page started again.)
  const again = wearing ? await walk() : null;
  await page.evaluate(() => clearInterval((window as unknown as W).__chat));
  const fmt = (x: typeof empty) => `our parts ${x.ours.toFixed(1)} ms a frame of ${x.mean.toFixed(0)} (${x.frames} frames; ${x.parts}; ${x.uploads})${x.long ? `, the browser's long frames' other scripts ${Math.round(x.long.scripts)} ms (${x.long.by.map(([k, n]) => `${k} ${Math.round(n)}`).join(", ")})` : ""}`;
  console.log(`Chess Town busy (slowed phone${wearing ? ", half wearing the tube or the cane" : ""}): empty ${fmt(empty)}; with 55 others, six seated games and a chat line every 250 ms ${fmt(full)}${again ? `; again ${fmt(again)}` : ""}; ${beat - beats} server answers`);
  if (again) {
    // (Uploaded again for their own sake: none. After a spare page starts again they are, as everything on it is: the 55 players' tags at
    // five sizes nearly fill the 2 spare pages, and any wearers' pictures tip them over, on main too; logged above, not checked here.)
    expect(again.frameUps, "their frames uploaded on the second walk (not counting a page started again)").toBe(0);
    expect(again.ours, "our parts a frame, busy and playing, the second walk, against the empty town's").toBeLessThan(empty.ours * 1.25);
  }
  expect(beat - beats, "the server's answers while the busy town walked (each moving everyone)").toBeGreaterThan(0);
  expect(empty.frames, "frames recorded walking the empty town").toBeGreaterThan(20);
  expect(full.frames, "frames recorded walking the busy town").toBeGreaterThan(20);
  // (The busy town's frame: 55 more pawns and their tags drawn. Measured Nov 27, 4x: empty 10.7 to 12.3 ms, busy 12.0 to 13.0 (before that
  // day's fixes 16 to 19: tags painted in the frames, chat lines drawn again). Its budget, a quarter over the empty town's.)
  expect(full.ours, "our parts a frame, busy, against the empty town's").toBeLessThan(empty.ours * 1.25);
  // (Outside our frame: the server's answers put in the town and the chat's lines, under 2 ms a frame of the walk.)
  if (full.long) expect(full.long.scripts / full.frames, "the page's other scripts a frame (ms), busy").toBeLessThan(2);
}

test("Moo & Moon's Full Moon cinematic on a slow phone: the hop, the field, the close-up, the transformation and the hop back stay within budget, the first time they show (Nov 17)", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(4 * 60_000);
  await page.addInitScript(instrument);
  // (?power=fullmoon: the warning as the 2nd turn begins, the Full Moon as your 2nd move lands.)
  await page.goto("/?debug&nolanding&clock=60&boss=moo&power=fullmoon&laststand=0");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await bossAloneFromHome(page);
  const move = async () => {
    await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
    const { fen, allowed } = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, allowed: ((window as any).match.boss?.powers?.allowed ?? null) as string[] | null }));
    const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && (!allowed || allowed.includes(m.from + m.to)));
    await page.evaluate((uci) => (window as any).match.submit(uci), legal[0]!.from + legal[0]!.to);
    await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
  };
  await move();
  await move();
  // The cinematic, from its first frame to its last.
  await page.locator(".mo-cine").waitFor({ timeout: 30_000 });
  await page.evaluate(() => ((window as any).__perf.frames = []));
  await expect(page.locator(".mo-cine")).toHaveCount(0, { timeout: 30_000 });
  const s = frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((x) => x[0]));
  console.log(`Moo's Full Moon cinematic (slowed phone): ${f(s)}`);
  expect(s.p95, "95th percentile frame (ms)").toBeLessThan(50);
  expect(s.slow, "share of dropped frames").toBeLessThan(0.15);
});

test("Sawyer's Saw Swap on a slow phone: the grooves across the middle and down his half, his half's two blocks sliding past each other and the board closing stay within budget, the first time they show (Nov 20)", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(4 * 60_000);
  await page.addInitScript(instrument);
  // (?power=sawswap: the crowd's check, Bb5+, brings it as it lands.)
  await page.goto("/?debug&nolanding&clock=60&boss=sawyer&power=sawswap&laststand=0");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await bossAloneFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await page.evaluate((uci) => (window as any).match.submit(uci), SAW_SWAP_TEST_CHECK.w);
  // The moment, from its banner to your turn (his move after it).
  await page.locator(".fight-banner.power-cut", { hasText: "SAW SWAP!" }).waitFor({ timeout: 30_000 });
  await page.evaluate(() => ((window as any).__perf.frames = []));
  await expect.poll(() => phase(page), { timeout: 40_000 }).toBe("play");
  const s = frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((x) => x[0]));
  console.log(`Sawyer's Saw Swap (slowed phone): ${f(s)}`);
  expect(s.p95, "95th percentile frame (ms)").toBeLessThan(50);
  expect(s.slow, "share of dropped frames").toBeLessThan(0.15);
});

test("Ginger's Super Freeze on a slow phone: his charge-up and blast, the ice block growing over the 3 x 3 and its settle stay within budget, the first time they show (Nov 18)", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(4 * 60_000);
  await page.addInitScript(instrument);
  // (?power=superfreeze: it comes as your first move lands.)
  await page.goto("/?debug&nolanding&clock=60&boss=gingerbread&power=superfreeze&laststand=0");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await bossAloneFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  const { fen } = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string }));
  const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured);
  await page.evaluate((uci) => (window as any).match.submit(uci), legal[0]!.from + legal[0]!.to);
  // The moment, from its banner to your turn (his move after it).
  await page.locator(".fight-banner.power-cut", { hasText: "SUPER FREEZE!" }).waitFor({ timeout: 30_000 });
  await page.evaluate(() => ((window as any).__perf.frames = []));
  await expect.poll(() => phase(page), { timeout: 40_000 }).toBe("play");
  const s = frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((x) => x[0]));
  console.log(`Ginger's Super Freeze (slowed phone): ${f(s)}`);
  expect(s.p95, "95th percentile frame (ms)").toBeLessThan(50);
  expect(s.slow, "share of dropped frames").toBeLessThan(0.15);
});

test("an admin's locker on a slow phone: one of every item, shiny, opened from home after its warm-up, opens and fills within budget (Nov 27)", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(2 * 60_000);
  await page.addInitScript(instrument);
  // (An admin's locker, as the server makes it: one of every item, each shiny; core/admin-copies.ts. Before Nov 27, this way on this
  // phone: 440 to 980 ms to the first paint, a 220 to 510 ms task, and every frame dropped while it was open (p95 230 to 330 ms), every
  // shine repainting. After: about 420 ms, 110 to 160 ms and p95 50 ms.)
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const body = await res.json().catch(() => null);
    if (body?.locker) body.locker.items = ITEM_DEFS.map(adminCopy);
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/?nolanding");
  const pawn = page.getByRole("button", { name: "Open your inventory" });
  await pawn.waitFor();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  // (Home's warm-up draws them in its idle time: Crates.tsx, warmLocker.)
  await page.waitForTimeout(8000);
  const open = await pawn.evaluate(
    (el) =>
      new Promise<{ paint: number; filled: number; longest: number }>((done) => {
        const P = (window as any).__perf;
        const t0 = performance.now();
        // (Tapped from the page: a new account's walkthrough may cover home.)
        (el as HTMLElement).click();
        let paint = 0;
        const wait = () => {
          const arts = [...document.querySelectorAll(".locker-grid .item-art svg")];
          // (This runs in a frame's rAF: a task queued now runs just after that frame is painted.)
          if (!paint && arts.length) setTimeout(() => (paint = performance.now() - t0));
          if (paint && arts.length && arts.every((e) => e.childElementCount)) {
            const longs: [number, number][] = P.longs.filter((l: [number, number]) => l[0] >= t0 - 5);
            done({ paint: Math.round(paint), filled: Math.round(performance.now() - t0), longest: Math.round(Math.max(0, ...longs.map((l) => l[1]))) });
          } else requestAnimationFrame(wait);
        };
        requestAnimationFrame(wait);
      }),
  );
  await page.evaluate(() => ((window as any).__perf.frames = []));
  await page.waitForTimeout(2000);
  const s = frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((x) => x[0]));
  console.log(`admin's locker from home (${ITEM_DEFS.length} items, slowed phone): first paint ${open.paint} ms, all drawn ${open.filled} ms, longest task ${open.longest} ms; open: ${f(s)}`);
  expect(open.paint, "the first paint (ms)").toBeLessThan(500);
  expect(open.longest, "the longest task (ms)").toBeLessThan(200);
  expect(open.filled, "every cell drawn (ms)").toBeLessThan(5000);
  expect(s.p95, "95th percentile frame while open (ms)").toBeLessThan(100);
});
