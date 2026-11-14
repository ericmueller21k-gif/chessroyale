import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { RECLUSE_PHASE2 } from "@chessroyale/core";
import { BOARD_SEL, asAdmin, test, bossAloneFromHome } from "./helpers.ts";
import { counts, frameStats, instrument } from "./perf-probe.js";

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

test("G-REX's fire on a slow phone: a barrage of tiles late in a long game stays within budget", { tag: "@perf" }, async ({ page }) => {
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
  console.log(`G-REX's Roman candle launch (slowed phone): ${f(launch!)}, the board drawn ${draws} times`);
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
  console.log(`G-REX, 9 fire tiles and shadows, 120 plies: idle ${f(idle)}; drag ${f(drag)}; boss turn ${f(turn)}; DOM ${early.dom} → ${late.dom}, anims ${early.anims} → ${late.anims}`);
  // The tiles' own elements and animations only (a few each), nothing per redraw.
  expect(late.dom, "DOM elements").toBeLessThanOrEqual(early.dom + 40 + squares.length * 6);
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

test("the Hidden Boss's phase 2 on a slow phone: the phase change and four boards in play stay within budget", { tag: "@perf" }, async ({ page }) => {
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
  // Four boards in play: the bots and he move on theirs (you don't), for eight seconds.
  await page.waitForTimeout(8000);
  const play = frameStats((await page.evaluate(() => (window as any).__perf.frames.splice(0))).map((f: [number, number]) => f[0]));
  const moves = await page.evaluate(() => (window as any).match.simul.boards.reduce((n: number, b: { history: string[] }) => n + b.history.length, 0));
  console.log(`phase 2 on a 4x-slowed phone: the phase change ${f(change)}; four boards in play ${f(play)}, ${moves} moves`);
  expect(moves, "moves played on the bots' boards meanwhile").toBeGreaterThan(4);
  for (const [what, s] of [["the phase change", change], ["four boards in play", play]] as const) {
    expect(s.p95, `${what}: 95th percentile frame (ms)`).toBeLessThan(50);
    expect(s.slow, `${what}: share of dropped frames`).toBeLessThan(0.15);
  }
});

test("the XP box on a slow phone: the result screen's frames while the bar fills, a level-up included (Nov 9)", { tag: "@perf" }, async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough (the phone, slowed)");
  test.setTimeout(3 * 60_000);
  await page.addInitScript(instrument);
  // (990 XP, then a won game counted as 12 minutes: 170 XP, through a level-up. e2e/xp.spec.ts has the fill's own checks.)
  await page.goto("/?debug&nolanding&pace=quick&win=1&boss=gingerbread&xp=990&xpgame=12");
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "hc_session"), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => ((await (await page.request.get("/api/me")).json()) as { xp?: number }).xp, { timeout: 20_000 }).toBe(990);
  await bossAloneFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  // (Slowed from the mate on: the result screen comes, the box waits for its XP, then fills.)
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => (window as any).match.submit("h5f7"));
  await page.locator(".xp-box").waitFor({ timeout: 60_000 });
  await page.evaluate(() => ((window as any).__perf.frames = []));
  await expect(page.locator(".xp-box")).toHaveClass(/xp-done/, { timeout: 30_000 });
  const s = frameStats(((await page.evaluate(() => (window as any).__perf.frames.splice(0))) as [number][]).map((x) => x[0]));
  console.log(`the XP box filling (slowed phone): ${f(s)}`);
  expect(s.n, "frames while it filled").toBeGreaterThan(20);
  expect(s.p95, "95th percentile frame (ms)").toBeLessThan(50);
  expect(s.slow, "share of dropped frames").toBeLessThan(0.15);
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
    await page.goto("/?sky=day");
    const town = page.getByRole("main").getByRole("button", { name: "Chess Town", exact: true }).first();
    await town.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(3000);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
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
    console.log(`${who} (slowed phone): loading screen ${Math.round(shown)} ms after the tap, the town's first frame ${Math.round(loaded)} ms, longest task ${Math.round(long)} ms`);
    // (Nov 10, headless Chromium: about 2.1 s and 1.4 s for the street town; before phone load 3, 5.8 s and 4.6 s. The old town, a player's
    // until Nov 13: about 1.7 s to its first frame.)
    expect(shown, "tap to the loading screen (ms)").toBeLessThan(3000);
    // (A loose bound on the town playable, Nov 13 review m2: a load regression for every player shows here; Eric took "3 or 5 seconds".)
    expect(loaded, "tap to the town's first frame (ms)").toBeLessThan(8000);
    expect(long, "longest task (ms)").toBeLessThan(2000);
  });
