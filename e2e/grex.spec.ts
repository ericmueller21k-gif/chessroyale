import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { engineTop, test, watchFor, bossAloneFromHome, submitMove } from "./helpers.ts";
import { MUSIC } from "@chessroyale/core";

/**
 * Jefferson (id "grex"; G-REX until Oct 10), the Fire boss, played through alone on a phone and a computer: his sparkler's tile burning in stages with its
 * countdown, a piece left on a tile ablaze burning, the God King's warning, and the Roman candle (?power=candle: warned
 * as the second turn begins, fired on the third): its 24 shots falling 1, 2, 3, 4, 4, 4, 3, 2, 1 from 3 crowd moves
 * on, each wave's squares shadowed 3 turns ahead. And the admins' test trigger.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const powers = (p: Page) => p.evaluate(() => (window as any).match?.boss?.powers ?? null).catch(() => null);
const banner = (p: Page, text: string) => p.locator(".fight-banner.power-cut", { hasText: text });

/**
 * Waits for your move, then plays one: G-REX's fire first (`leave`: keep a pawn on a tile ablaze, to watch it burn;
 * `step`: onto a burning tile when one's in reach), else the engine's best allowed move. Returns the move and the
 * squares where a pawn was left to burn.
 */
async function play(page: Page, opts: { leave?: boolean; step?: boolean } = {}) {
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await page.waitForTimeout(300);
  // (The engine's answer is polled for, never awaited inside the page: see engineTop.)
  const { fen, top } = await engineTop(page);
  const { fire, allowed } = await page.evaluate(() => {
    const m = (window as any).match;
    return { fire: (m.boss?.powers?.fire ?? []) as { square: string; stage: number }[], allowed: (m.boss?.powers?.allowed ?? null) as string[] | null };
  });
  const chess = new Chess(fen);
  // Never a move that ends the game: the test watches the candle's waves through turn 13, and the engine's best moves
  // can mate him before then (docs/decisions/2026-10-15-flaky-e2e-batch.md).
  const goesOn = (mv: string) => {
    const after = new Chess(fen);
    after.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] });
    return !after.isGameOver();
  };
  const legal = chess
    .moves({ verbose: true })
    .map((mv) => mv.from + mv.to + (mv.promotion ?? ""))
    .filter((mv) => (!allowed || allowed.includes(mv)) && goesOn(mv));
  const best = top.map((t) => t.move).find((mv) => legal.includes(mv)) ?? null;
  const mine = (sq: string) => {
    const pc = chess.get(sq as never);
    return !!pc && pc.color === chess.turn() && pc.type !== "k";
  };
  // (A pawn: leaving a bigger piece to burn is a blunder the God King's Last Stand would take back.)
  const ablaze = fire.filter((t) => t.stage >= 3 && mine(t.square) && chess.get(t.square as never)?.type === "p").map((t) => t.square);
  const burning = fire.filter((t) => t.stage < 3).map((t) => t.square);
  let move: string | undefined;
  // (Leave the piece: the best move that doesn't take it off, if the engine's is one; else any quiet one.)
  if (opts.leave && ablaze.length) move = best && !ablaze.includes(best.slice(0, 2)) ? best : legal.find((mv) => !ablaze.includes(mv.slice(0, 2)) && !chess.get(mv.slice(2, 4) as never));
  if (!move && opts.step) move = legal.find((mv) => burning.includes(mv.slice(2, 4)) && chess.get(mv.slice(0, 2) as never)?.type !== "k");
  move ??= best ?? legal[0];
  const left = opts.leave && move ? ablaze.filter((sq) => !move!.startsWith(sq)) : [];
  // (A burn shows for a moment as the boss's turn begins: watched for from before the move, so it's never missed.)
  const burn = left.length ? await watchFor(page, { piece: { selector: left.map((sq) => `.pw-burns .pw-burn[data-square="${sq}"]:not(.out):not(.fizzled)`).join(",") }, dock: { selector: ".boss-dock-status", text: /burnt/i } }) : null;
  await page.evaluate((mv) => {
    const m = (window as any).match;
    if (m.phase.kind === "play" && mv) m.submit(mv);
  }, move ?? null);
  await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
  return { move, left, burn };
}

/** The candle's shadows as markers on the board: square to size (1 small ... 3 biggest). */
const shadowsShown = (page: Page) =>
  page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>(".power-board .pw-shadow")].map((e) => [e.dataset.square!, Number(e.dataset.size)])));

test("Jefferson (he was G-REX): a test link's ?boss=jefferson meets him, by his new name", { tag: "@phone-only" }, async ({ page }) => {
  await page.goto("/?debug&clock=40&boss=jefferson");
  await bossAloneFromHome(page);
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".boss-intro-name")).toHaveText("Jefferson");
  expect(await page.evaluate(() => { const b = (window as any).match.boss; return [b.id, b.name]; })).toEqual(["grex", "Jefferson"]);
});

test("Jefferson's music: fetched when his battle is picked (not at app start), started as the battle starts, Music off and on in the match's options, faded out at the result; Settings has the switch", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(3 * 60_000);
  // (docs/decisions/2026-11-11-boss-music.md. ?win=1: your first move, Qxf7, mates him.)
  // (The sound log, noting the match's phase as the music starts.)
  await page.addInitScript(() => {
    const w = window as any;
    const log: string[] = [];
    log.push = (...xs: string[]) => {
      for (const x of xs) if (x.startsWith("music:start")) w.__musicStartPhase = { kind: w.match?.phase?.kind, intro: !!w.match?.phase?.intro, loading: !!w.match?.phase?.loading };
      return Array.prototype.push.apply(log, xs);
    };
    w.__soundLog = log;
    // (Every connection made, to read the music's way to the speakers: Nov 14, "fuck the filter and the compression".)
    const ins = new Map<AudioNode, AudioNode[]>();
    const connect = AudioNode.prototype.connect as any;
    (AudioNode.prototype as any).connect = function (this: AudioNode, to: any, ...rest: any[]) {
      if (to instanceof AudioNode) ins.set(this, [...(ins.get(this) ?? []), to]);
      return connect.call(this, to, ...rest);
    };
    w.__musicPaths = () => {
      const kind = (x: AudioNode) => (x instanceof AudioBufferSourceNode ? "source" : x instanceof GainNode ? "gain" : x instanceof AudioDestinationNode ? "speakers" : x.constructor.name);
      const out: string[] = [];
      const walk = (x: AudioNode, path: string[]): void => void ((ins.get(x) ?? []).length ? ins.get(x)!.forEach((y) => walk(y, [...path, kind(y)])) : out.push(path.join(" > ")));
      for (const x of ins.keys()) if (x instanceof AudioBufferSourceNode && x.loop && (x.buffer?.duration ?? 0) > 30) walk(x, ["source"]);
      return out;
    };
  });
  const music: string[] = [];
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith("/music/")) music.push(path);
  });
  const log = () => page.evaluate(() => ((window as any).__soundLog as string[]).filter((l) => l.startsWith("music:")));
  await page.goto("/?debug&pace=quick&win=1&boss=grex");
  await expect(page.getByRole("main").getByRole("button", { name: /^Boss Battle/ })).toBeVisible({ timeout: 30_000 });
  expect(music, "nothing of the music at app start").toEqual([]);
  await bossAloneFromHome(page);
  // Fetched as the battle is picked (its loading step and intro), the MP3s only.
  await expect.poll(() => music.filter((p) => p.endsWith(".mp3")).sort(), { timeout: 30_000 }).toEqual(["/music/grex-intro.mp3", "/music/grex-loop.mp3"]);
  // Not started during the intro; started once the battle starts (your first move).
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase?.kind), { timeout: 60_000 }).toBe("play");
  await expect.poll(log, { timeout: 30_000 }).toContain("music:start:grex");
  expect(await page.evaluate(() => (window as any).__musicStartPhase), "started after the intro").toEqual({ kind: "play", intro: false, loading: false });
  // Its way out: its gain, the music's own (the master's level), the speakers; no filter, no compressor (Nov 14).
  expect(await page.evaluate(() => (window as any).__musicPaths()), "the music's path").toEqual(["source > gain > gain > speakers"]);
  // The match's options: Music off fades it to nothing, on brings it back (the loop keeping its place: no new start).
  await page.getByRole("button", { name: "Match options" }).click();
  const row = page.getByRole("dialog", { name: "Match options" }).getByRole("switch", { name: /Music/ });
  await expect(row).toHaveAttribute("aria-checked", "true");
  await row.click();
  await expect(row).toHaveAttribute("aria-checked", "false");
  await expect.poll(log).toContain("music:level:0");
  await row.click();
  await expect.poll(log).toContain(`music:level:${MUSIC.volume}`);
  expect((await log()).filter((l) => l.startsWith("music:start")), "one start").toHaveLength(1);
  await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: "Close" }).click();
  // The result: faded out and stopped (before the result screen shows).
  await submitMove(page, "h5f7");
  await expect(page.locator(".results h1")).toHaveText("Victory!", { timeout: 120_000 });
  expect(await log()).toContain("music:end:grex");
  // Settings → Sound: the Music switch beside Sound, on by default, remembered on the device.
  await page.goto("/settings");
  const toggle = page.getByRole("switch", { name: /^Music/ });
  await expect(toggle).toBeChecked();
  await page.locator(".fd-toggle", { has: toggle }).click();
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole("switch", { name: /^Music/ })).not.toBeChecked();
});

test("Jefferson: his tiles burn in stages counting down, a piece left on one burns, and the Roman candle's 24 shots fall where their shadows said", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(9 * 60_000);
  // (?laststand=0: leaving a piece to burn on purpose isn't taken back by the God King.)
  await page.goto("/?debug&clock=40&bossMoves=16&boss=grex&power=candle&laststand=0");
  await bossAloneFromHome(page);
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).match.boss.name)).toBe("Jefferson");
  await expect(page.locator(".rage-meter")).toBeVisible();

  await play(page);
  // As the second turn begins: SPARKLER! (a tile on your half, at its first stage, counting 3), then RAGE!.
  await expect(banner(page, "SPARKLER!")).toBeVisible({ timeout: 30_000 });
  // (His name on the banner is Jefferson, never his old G-REX.)
  await expect(banner(page, "SPARKLER!").locator(".kc-label")).toHaveText("Jefferson");
  await expect(banner(page, "RAGE!")).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  const p2 = await powers(page);
  expect(p2.fire).toHaveLength(1);
  expect(p2.fire[0].stage).toBe(1);
  expect(Number(p2.fire[0].square[1])).toBeLessThanOrEqual(4);
  await expect(page.locator(".power-board .pw-fire.stage-1")).toHaveCount(1);
  await expect(page.locator(`.power-board .pw-fire[data-square="${p2.fire[0].square}"] .pw-count`)).toHaveText("3");

  // Step onto it if a piece can (the God King's warning, once a match).
  await play(page, { step: true });
  // The Roman candle: its banner, G-REX on the middle of the board, the row of pips in his boss card filling as he fires.
  await expect(banner(page, "ROMAN CANDLE!")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".pm-rex")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".pw-pips")).toBeVisible({ timeout: 8_000 });
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  const p3 = await powers(page);
  expect(p3.candle).toEqual({ at: 3, left: 24 });
  expect(p3.fire[0].stage).toBe(2);
  await expect(page.locator(".boss-prop .pw-pips")).toHaveAttribute("data-left", "24");
  await expect(page.locator(".power-board .pw-fire.stage-2 .pw-count")).toHaveText("2");
  // The pips: a row in his boss card's free room (Eric, Nov 11: the column by the board's right edge was cut off by the screen),
  // whole inside the card and the screen, clear of his name, his level and "N moves left".
  const [pips, card, name, level, status] = await Promise.all([".boss-prop .pw-pips", ".boss-bar", ".boss-name strong", ".boss-level", ".boss-next"].map((s) => page.locator(s).first().boundingBox()));
  const clear = (a: typeof pips, b: typeof pips) => !a || !b || a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5 || a.y + a.height <= b.y + 0.5 || b.y + b.height <= a.y + 0.5;
  expect(pips!.width).toBeGreaterThan(pips!.height * 8);
  expect(pips!.x).toBeGreaterThanOrEqual(card!.x - 0.5);
  expect(pips!.x + pips!.width).toBeLessThanOrEqual(Math.min(card!.x + card!.width, page.viewportSize()!.width) + 0.5);
  expect(pips!.y).toBeGreaterThanOrEqual(card!.y - 0.5);
  expect(pips!.y + pips!.height).toBeLessThanOrEqual(card!.y + card!.height + 0.5);
  for (const [what, b] of [["name", name], ["level", level], ["moves left", status]] as const) expect(clear(pips, b), `the row clear of his ${what}`).toBe(true);
  await expect(page.locator(".power-board .pw-pips")).toHaveCount(0);
  // The first wave's square is shadowed, small: it falls 3 turns after the launch.
  expect(p3.shadows).toEqual([{ square: expect.any(String), lands: 6, stage: 1 }]);
  await expect.poll(() => shadowsShown(page)).toEqual({ [p3.shadows[0].square]: 1 });

  // Then the barrage: a wave a turn from 3 crowd moves after he fired, each on the squares shadowed 3 turns before.
  // Leave one pawn on a tile ablaze to watch it burn.
  const left = new Map<number, number>();
  const shadowed = new Map<number, string[]>([[6, [p3.shadows[0].square]]]);
  let burnt = false;
  let leftOne = false;
  // Some of each wave falls on his own half (Eric, Oct 11); the first time one of his pieces stands in that fire he
  // laughs it off, once, in his text box.
  let onHisHalf = 0;
  const laughs: number[] = [];
  const laugh = await watchFor(page, { line: { selector: ".bc-bubble", text: /Ha! My pieces don't burn|Fireproof! Did I forget|Hot\? Not for my team|Mine are fire-rated/ } });
  for (let turn = 4; turn <= 13; turn++) {
    // (The match can end early: a mate.)
    await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|results/);
    if ((await phase(page)) !== "play") break;
    const r = await play(page, { leave: !leftOne });
    if (r.left.length) {
      // It burns as the boss's turn begins (unless it shields the king: then its tile fizzles): flames over its square,
      // the countdown at 0, the dock says so.
      let what: { square: string; piece?: string } | null = null;
      await expect.poll(async () => (what = ((await powers(page))?.burnt ?? []).find((b: { square: string }) => r.left.includes(b.square)) ?? null), { timeout: 15_000 }).not.toBeNull();
      if (what!.piece) {
        leftOne = true;
        await expect.poll(async () => (await r.burn!.seen()).piece, { timeout: 15_000 }).toBe(true);
        await expect.poll(async () => (await r.burn!.seen()).dock, { timeout: 15_000 }).toBe(true);
        burnt = true;
      }
    }
    await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|results/);
    if ((await phase(page)) !== "play") break;
    const p = await powers(page);
    left.set(p.turn, p.candle.left);
    if (p.candle.left > 0) await expect(page.locator(".boss-prop .pw-pips")).toHaveAttribute("data-left", String(p.candle.left));
    // What landed this turn is what was shadowed for it (but a square the crowd's king stands on: it fizzles).
    const wave = p.events.find((e: { kind: string }) => e.kind === "fireball");
    if (shadowed.has(p.turn)) expect(wave?.squares, `turn ${p.turn}`).toEqual(shadowed.get(p.turn));
    onHisHalf += (wave?.squares ?? []).filter((sq: string) => Number(sq[1]) >= 5).length;
    if (p.events.some((e: { kind: string }) => e.kind === "fireproof")) laughs.push(p.turn);
    for (const sq of wave?.squares ?? []) if (!wave.fizzled?.includes(sq)) expect(p.fire.find((t: { square: string }) => t.square === sq)?.stage).toBe(1);
    // Every shadow on the board, at its size: the turn it lands is 3 turns out for the smallest.
    for (const sh of p.shadows) {
      expect(sh.lands - p.turn).toBe(4 - sh.stage);
      if (!shadowed.has(sh.lands)) shadowed.set(sh.lands, []);
      if (!shadowed.get(sh.lands)!.includes(sh.square)) shadowed.get(sh.lands)!.push(sh.square);
    }
    await expect.poll(() => shadowsShown(page)).toEqual(Object.fromEntries(p.shadows.map((sh: { square: string; stage: number }) => [sh.square, sh.stage])));
    // Each tile counts down: 3, 2, 1.
    for (const t of p.fire) await expect(page.locator(`.power-board .pw-fire[data-square="${t.square}"] .pw-count`)).toHaveText(String(4 - Math.min(3, t.stage)));
    // Never on the king's square; never two on one square.
    const squares = p.fire.map((t: { square: string }) => t.square);
    expect(new Set(squares).size).toBe(squares.length);
  }
  // (Fired on turn 3: none as the 4th and 5th begin; then 1, 2, 3, 4, 4, 4, 3, 2 and the last 1, a turn each from the 6th.)
  const want: Record<number, number> = { 4: 24, 5: 24, 6: 23, 7: 21, 8: 18, 9: 14, 10: 10, 11: 6, 12: 3 };
  for (const [turn, n] of left) if (want[turn] !== undefined) expect(n, `shots up as turn ${turn} begins`).toBe(want[turn]);
  expect(left.size).toBeGreaterThanOrEqual(5);
  if (leftOne) expect(burnt).toBe(true);
  // Fireballs on his half too, and his laugh at most once; when it came, his line was in his text box.
  if (left.size >= 7) expect(onHisHalf).toBeGreaterThan(0);
  expect(laughs.length).toBeLessThanOrEqual(1);
  if (laughs.length) expect((await laugh.seen()).line).toBe(true);
  console.log(`fireballs on his half: ${onHisHalf}; his laugh on turn ${laughs[0] ?? "none"}`);
});

test("on a computer the dock is under the board at every width, the board and dock on screen, the God King beside it", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "a computer's widths");
  await page.goto("/?debug&clock=60&boss=grex");
  await bossAloneFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  for (const [w, h] of [[1024, 800], [1280, 800], [1440, 900], [1600, 900], [1920, 1080], [1590, 923]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    const [board, dock] = await Promise.all([page.locator(".board-wrap").first().boundingBox(), page.locator(".boss-dock").boundingBox()]);
    expect(dock!.y, `${w}: the dock under the board`).toBeGreaterThanOrEqual(board!.y + board!.height);
    expect(dock!.y + dock!.height, `${w}: the dock on screen`).toBeLessThanOrEqual(h);
    // (Under it: overlapping it across, not off in another column.)
    expect(dock!.x, `${w}`).toBeLessThan(board!.x + board!.width);
    expect(dock!.x + dock!.width, `${w}`).toBeGreaterThan(board!.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${w}: no sideways scroll`).toBeLessThanOrEqual(w);
    // The God King by the board's bottom-right corner (Eric, Oct 11), on screen, clear of the column beside the board.
    const king = (await page.locator(".gk-unit .gk-unit-btn").boundingBox())!;
    expect(king.x, `${w}: the God King right of the board`).toBeGreaterThanOrEqual(board!.x + board!.width);
    expect(Math.abs(king.y + king.height - (board!.y + board!.height)), `${w}: his feet on the board's bottom edge`).toBeLessThanOrEqual(2);
    expect(king.x + king.width, `${w}: on screen`).toBeLessThanOrEqual(w);
    const side = await page.locator(".screen.game > .mini-tower:visible, .screen.game > .under-board:visible").first().boundingBox({ timeout: 500 }).catch(() => null);
    if (side) expect(side.x, `${w}: the column beside the board clear of him`).toBeGreaterThanOrEqual(king.x + king.width);
  }
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

test("the test trigger is hidden from players", { tag: "@phone-only" }, async ({ page }) => {
  await page.goto("/?debug&clock=40&bossMoves=6&boss=gingerbread");
  await bossAloneFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await expect(page.locator(".boss-dock")).toBeVisible();
  await expect(page.locator(".ult-test")).toHaveCount(0);
});

test("an admin's test trigger against Ginger, pressed during your turn: the blizzard next turn, no warning; twice is once; again once it's over", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await asAdmin(page);
  await page.goto("/?debug&clock=40&bossMoves=8&boss=gingerbread");
  await bossAloneFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  const btn = page.locator(".ult-test");
  await expect(btn).toHaveAccessibleName("Trigger ultimate (testing)");
  // (A computer: beside the board, before the gear, where the title line's tools went on Nov 1; a phone: under the dock. Eric, Oct 13.)
  await expect(page.locator(".gm-tools .ult-test")).toHaveCount(test.info().project.name === "desktop" ? 1 : 0);
  await btn.click();
  await expect(btn).toHaveAccessibleName("Ultimate next turn (testing)");
  await expect(btn).toBeDisabled();
  // This turn goes on as it was.
  expect((await powers(page)).allowed).toBeNull();
  // (The blizzard's and a thaw's banners are up for 1.3 s, Oct 16: watched for from before they can appear.)
  const blizzard = await watchFor(page, { banner: { selector: ".fight-banner.power-cut", text: /BLIZZARD!/ } });
  await play(page);
  await expect.poll(async () => (await blizzard.seen()).banner, { timeout: 30_000 }).toBe(true);
  await expect(banner(page, "RAGE!")).toHaveCount(0);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  await expect(btn).toHaveAccessibleName("Ultimate under way (testing)");
  expect((await powers(page)).allowed.length).toBeGreaterThan(0);
  // Under way through its three turns (Oct 12): the thaw, then the ice gone.
  const thawing = await watchFor(page, { banner: { selector: ".fight-banner.power-cut", text: /THAWING!/ } });
  await play(page);
  await expect.poll(async () => (await thawing.seen()).banner, { timeout: 30_000 }).toBe(true);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  await expect(btn).toHaveAccessibleName("Ultimate under way (testing)");
  const thawed = await watchFor(page, { banner: { selector: ".fight-banner.power-cut", text: /THAWED!/ } });
  await play(page);
  await expect.poll(async () => (await thawed.seen()).banner, { timeout: 30_000 }).toBe(true);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  await expect(btn).toHaveAccessibleName("Ultimate under way (testing)");
  expect((await powers(page)).allowed).toBeNull();
  // Over as the next turn begins: the meter emptied (filling again), the trigger ready, and the blizzard comes again.
  await play(page);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  await expect(btn).toHaveAccessibleName("Trigger ultimate (testing)");
  expect((await powers(page)).rage).toBeLessThan(0.5);
  await btn.click();
  await expect(btn).toHaveAccessibleName("Ultimate next turn (testing)");
  const again = await watchFor(page, { banner: { selector: ".fight-banner.power-cut", text: /BLIZZARD!/ } });
  await play(page);
  await expect.poll(async () => (await again.seen()).banner, { timeout: 30_000 }).toBe(true);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  expect((await powers(page)).ults).toBe(2);
});

test("an admin's test trigger against Boingo, pressed while the boss thinks: the funhouse", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await asAdmin(page);
  await page.goto("/?debug&clock=40&bossMoves=6&boss=clown");
  await bossAloneFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await play(page);
  await expect(page.locator(".boss-screen .ult-test")).toBeVisible({ timeout: 10_000 });
  await page.locator(".boss-screen .ult-test").click();
  // (Pressed before its move: the funhouse as your turn begins; pressed as its move landed: the turn after.)
  const pressedBefore = await page.evaluate(() => (window as any).match.boss.powers.ultNext);
  const fun = banner(page, "FUNHOUSE!");
  for (let i = 0; i < 2 && !(await fun.isVisible()); i++) {
    if (await fun.waitFor({ timeout: 15_000 }).then(() => true, () => false)) break;
    if ((await phase(page)) === "play") await play(page);
  }
  await expect(fun).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  // (He played your move for you, then his: the board turned upside down, your move to make.)
  expect((await powers(page)).funhouse?.turn).toBeGreaterThan(0);
  expect((await powers(page)).funhouse?.move).toMatch(/^[a-h][1-8][a-h][1-8]/);
  expect((await powers(page)).angle).toBe(180);
  expect(pressedBefore).toBe(true);
});
