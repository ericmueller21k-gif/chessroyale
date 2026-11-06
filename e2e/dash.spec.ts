import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_CLOCK, BOSS_POWERS } from "@chessroyale/core";
import { BOARD_SEL, asAdmin, openBossRaid, submitMove, test } from "./helpers.ts";

/**
 * Dash, the cheetah (docs/decisions/2026-11-03-dash.md), in the game for admins first (BOSS_ADMIN_FIRST): his tile only on an
 * admin's Boss raid screen; Boss alone (Boss Battle's clock: the bank) with the test switches: his Clock Slap (`&power=clockslap`:
 * his first move slaps as a capture would) taking slapBankSeconds off your bank, the time flying from your clock to him, Tick's
 * tally; Time Scramble (the admins' trigger): its banner, then 3 seconds a move with the big 3-2-1 over the board; a scrambled move
 * left to run out: a move played for you (never a loss), his jab; nothing on screen moving all along.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase?.kind ?? "none").catch(() => "none");

async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 100), { timeout: 10_000 }).toBe(true);
}

/** Your move: a knight to an empty square when it may, else the first allowed. */
async function playOne(page: Page) {
  await yourMove(page);
  const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  const legal = new Chess(fen).moves({ verbose: true }).map((m) => ({ uci: m.from + m.to + (m.promotion ?? ""), knight: m.piece === "n" && !m.captured }));
  const ok = legal.sort((a, b) => (a.uci < b.uci ? -1 : 1));
  await submitMove(page, (ok.find((m) => m.knight) ?? ok[0])!.uci, fen);
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
}

/** Every frame: the power events, the banners' words, the countdown's seconds, the flight's words, the boxes that must stay put. */
async function watch(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__dash = { kinds: [] as string[], banners: [] as string[], secs: [] as string[], fly: [] as string[], tally: [] as string[], board: [] as string[], clock: [] as string[], caster: 0, hidden: 0, over: [] as string[] };
    const box = (el: Element | null) => {
      if (!el) return "";
      const r = el.getBoundingClientRect();
      return `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
    };
    const add = (a: string[], v: string | null | undefined) => v && !a.includes(v) && a.push(v);
    const look = () => {
      const r = w.__dash;
      for (const e of w.match?.boss?.powers?.events ?? []) add(r.kinds, e.kind);
      for (const b of document.querySelectorAll(".fight-banner")) add(r.banners, (b.textContent ?? "").replace(/\s+/g, " ").trim());
      add(r.secs, (document.querySelector(".dash-count") as HTMLElement | null)?.dataset.secs);
      add(r.fly, document.querySelector(".dash-fly")?.textContent);
      add(r.tally, box(document.querySelector(".tk-tally")));
      add(r.board, box(document.querySelector(".board-wrap")));
      // (Your clock's right edge and top: its numbers are right aligned, so its width follows "10:00" or "0:03".)
      const ck = document.querySelector(".dk-clock")?.getBoundingClientRect();
      add(r.clock, ck ? `${Math.round(ck.right)},${Math.round(ck.top)}` : "");
      // (He never steps up to the board's corner, his figure is never hidden, and its drawn box never covers a square: on a phone it
      // sits in the bar over the board, on a computer beside it.)
      if (document.querySelector(".pm-caster")) r.caster++;
      const fig = document.querySelector(".boss-char .boss-char-sprite");
      if (fig && getComputedStyle(fig).visibility === "hidden") r.hidden++;
      const b = document.querySelector(".board-wrap")?.getBoundingClientRect();
      const f = fig?.getBoundingClientRect();
      if (b && f && f.width > 0) {
        const cs = getComputedStyle(fig!);
        // (The canvas's own box: his frame, his feet at its foot; drawn pixels inside it. Counted by its overlap with the board.)
        const ox = Math.min(f.right, b.right) - Math.max(f.left, b.left);
        const oy = Math.min(f.bottom, b.bottom) - Math.max(f.top, b.top);
        if (ox > 1 && oy > 1 && cs.visibility !== "hidden") add(r.over, `${w.match?.boss?.powers?.events?.map((e: { kind: string }) => e.kind).join("+")}:${Math.round(ox)}x${Math.round(oy)}`);
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}
type Seen = { kinds: string[]; banners: string[]; secs: string[]; fly: string[]; tally: string[]; board: string[]; clock: string[]; caster: number; hidden: number; over: string[] };
const seen = (page: Page) => page.evaluate(() => (window as any).__dash as Seen);
const dash = (page: Page) => page.evaluate(() => (window as any).match.boss.powers.dash);

test.describe("Dash", () => {
  test("admins first: no tile for a player; an admin's Boss raid screen has his tile", async ({ page }) => {
    await page.goto("/?debug&mode=raid");
    await openBossRaid(page);
    const tiles = page.getByRole("radiogroup", { name: "Bosses" });
    await expect(tiles.getByRole("radio", { name: "Folio", exact: true })).toBeVisible();
    await expect(tiles.getByRole("radio", { name: "Dash", exact: true })).toHaveCount(0);
    await asAdmin(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Boss raid", exact: true })).toBeVisible();
    await expect(tiles.getByRole("radio", { name: "Dash", exact: true })).toBeVisible();
  });

  test("Clock Slap takes time off your bank and flies it to him; Time Scramble: 3 s a move counted down over the board; out of time, a move is played for you, never a loss; nothing moves", async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await asAdmin(page);
    await page.goto("/?debug&pace=quick&laststand=0&brain=stockfish&boss=dash&power=clockslap&mode=raid");
    await openBossRaid(page);
    await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    await yourMove(page);
    await watch(page);
    expect(await page.evaluate(() => (window as any).match.boss.id)).toBe("dash");
    // Boss alone plays on Boss Battle's clock (the bank): Tick and the tally ("−0:00", nothing stolen yet) in his bar.
    expect(await page.evaluate(() => (window as any).match.settings.bossClock)).toBe(true);
    await expect(page.locator(".tk-tally canvas")).toBeVisible();
    await expect(page.locator(".tk-tally .tk-text")).toHaveText("−0:00");
    // Your move; his first move slaps (the test switch): slapBankSeconds off your bank, the time flying to him at the corner.
    const bank0 = await page.evaluate(() => (window as any).match.standings().find((s: any) => s.isYou)?.bankMs ?? null);
    await playOne(page);
    await yourMove(page);
    const d1 = await dash(page);
    expect(d1.slap).toMatchObject({ ms: BOSS_POWERS.slapBankSeconds * 1000, bank: true });
    expect(d1.slaps).toBe(1);
    let s = await seen(page);
    expect(s.kinds).toContain("slap");
    expect(s.fly).toContain(`−${BOSS_POWERS.slapBankSeconds}s`);
    await expect(page.locator(".tk-tally .tk-text")).toHaveText(`−0:${String(BOSS_POWERS.slapBankSeconds).padStart(2, "0")}`);
    const bank1 = await page.evaluate(() => (window as any).match.standings().find((s: any) => s.isYou)?.bankMs ?? null);
    if (bank0 !== null && bank1 !== null) expect(bank1).toBeLessThanOrEqual(bank0 + BOSS_CLOCK.incrementSeconds * 1000 - BOSS_POWERS.slapBankSeconds * 1000);
    // Time Scramble by the admins' trigger: after his next move, TIME SCRAMBLE!, then your move has 3 seconds.
    await page.locator(".ult-test").click();
    await playOne(page);
    await yourMove(page);
    const clock = await page.evaluate(() => ({ ms: (window as any).match.phase.deadline - (window as any).match.phase.startsAt }));
    expect(clock.ms).toBe(BOSS_POWERS.scrambleSeconds * 1000);
    s = await seen(page);
    expect(s.kinds).toContain("scramble");
    expect(s.banners.some((b) => /TIME SCRAMBLE!/.test(b) && /next 5 moves: 3 seconds each/.test(b))).toBe(true);
    // Left to run out: 3, 2, 1 over the board, then a move played for you (a move of yours on the board, no submit), and play goes on.
    const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
    await expect(page.locator(".dash-count")).toBeVisible();
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
    await yourMove(page);
    const d2 = await dash(page);
    expect(d2.flags).toBe(1);
    expect(new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""))).toContain(d2.flag.move);
    expect(await page.evaluate(() => (window as any).match.boss.result ?? null)).toBeNull();
    s = await seen(page);
    expect(s.secs).toEqual(expect.arrayContaining(["3", "2", "1"]));
    expect(s.kinds).toContain("flag");
    // Still scrambled: this move too has 3 seconds and its countdown; a move in time is played as ever.
    expect(await page.evaluate(() => (window as any).match.phase.deadline - (window as any).match.phase.startsAt)).toBe(BOSS_POWERS.scrambleSeconds * 1000);
    await expect(page.locator(".dash-count")).toHaveAttribute("data-left", String(BOSS_POWERS.scrambleMoves - 1));
    await playOne(page);
    // Nothing shifts: the board, your clock and Tick's tally kept their places and sizes all along.
    s = await seen(page);
    expect(s.board).toHaveLength(1);
    expect(s.tally).toHaveLength(1);
    expect(s.clock).toHaveLength(1);
    // He stayed in his place through the slap, the warning, the scramble and his jab: never at the board's corner, never hidden.
    expect(s.caster).toBe(0);
    expect(s.hidden).toBe(0);
    expect(s.over, "his figure's box over the board").toEqual([]);
    expect(errors).toEqual([]);
  });

  test("his figure and the countdown on a phone at 320 px: the board whole, the count inside it", async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(test.info().project.name !== "phone", "the phone's narrowest width");
    await page.setViewportSize({ width: 320, height: 640 });
    await asAdmin(page);
    await page.goto("/?debug&pace=quick&laststand=0&brain=stockfish&boss=dash&power=scramble&mode=raid");
    await openBossRaid(page);
    await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    // (The test switch: its warning as the second turn begins, the scramble as the third does.)
    await playOne(page);
    await playOne(page);
    await yourMove(page);
    await expect(page.locator(".dash-count")).toBeVisible();
    const [count, board] = await Promise.all([page.locator(".dash-count").boundingBox(), page.locator(BOARD_SEL.wrap).boundingBox()]);
    expect(count!.x).toBeGreaterThanOrEqual(board!.x - 1);
    expect(count!.x + count!.width).toBeLessThanOrEqual(board!.x + board!.width + 1);
    expect(board!.x).toBeGreaterThanOrEqual(0);
    expect(board!.x + board!.width).toBeLessThanOrEqual(320);
  });
});

/**
 * Dash v2's Scramble Rush (Eric, Nov 6; docs/decisions/2026-11-06-dash-v2.md), Boss alone on a phone and a computer with real taps
 * and a drag (`&power=rush`: it comes as your second turn begins): "1.00" counting down while his five copies sweep the board, then
 * ten seconds to put the six swept pieces back: green edges where right, a red one and his word where wrong. 4 back: the God King's
 * word and your turn on the board as it was; 3 or none: his extra move at once. Read from the page: the board's own pieces (the DOM)
 * against the game's position.
 */
type RushSeen = { stages: string[]; copies: number; counts: string[]; doneBoards: string[]; said: string[] };
async function watchRush(page: Page) {
  await page.evaluate((pieceSel) => {
    const w = window as any;
    w.__rush = { stages: [], copies: 0, counts: [], doneBoards: [], said: [] } as RushSeen;
    const add = (a: string[], v: string | null | undefined) => v && !a.includes(v) && a.push(v);
    const look = () => {
      const r = w.__rush as RushSeen;
      const layer = document.querySelector(".rush-layer") as HTMLElement | null;
      add(r.stages, layer?.dataset.stage);
      r.copies = Math.max(r.copies, document.querySelectorAll(".rush-copy:not(.ghost)").length);
      add(r.counts, document.querySelector(".rb-count")?.textContent?.slice(0, 3));
      add(r.said, document.querySelector(".bc-bubble")?.textContent?.trim());
      if (layer?.dataset.stage === "done") {
        // The board as drawn: each piece's square (by its box in the squares' box, either way up) and kind.
        const box = document.querySelector(".hb-board")!.getBoundingClientRect();
        const white = !!document.querySelector(".hb.orientation-white");
        const list = [...document.querySelectorAll(pieceSel)]
          .filter((p) => !p.classList.contains("fading"))
          .map((p) => {
            const b = p.getBoundingClientRect();
            const col = Math.round(((b.left + b.width / 2 - box.left) / box.width) * 8 - 0.5);
            const row = Math.round(((b.top + b.height / 2 - box.top) / box.height) * 8 - 0.5);
            const sq = white ? `${"abcdefgh"[col]}${8 - row}` : `${"abcdefgh"[7 - col]}${row + 1}`;
            const role = ["pawn", "knight", "bishop", "rook", "queen", "king"].find((k) => p.classList.contains(k))!;
            return `${sq}:${p.classList.contains("white") ? "w" : "b"}${role === "knight" ? "n" : role[0]}`;
          })
          .sort()
          .join(" ");
        add(r.doneBoards, list);
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }, BOARD_SEL.piece);
}
/** The position's pieces as the watcher lists them. */
const piecesOf = (fen: string) =>
  new Chess(fen)
    .board()
    .flat()
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => `${p.square}:${p.color}${p.type}`)
    .sort()
    .join(" ");

for (const [right, held] of [
  [4, true],
  [3, false],
  [0, false],
] as const)
  test(`Scramble Rush: ${right} of 6 put back (${right === 0 ? "none" : "taps and a drag"}): ${held ? "held, your turn on the board as it was" : "his extra move at once"}`, async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await asAdmin(page);
    await page.goto("/?debug&pace=quick&laststand=0&brain=stockfish&boss=dash&power=rush&mode=raid");
    await openBossRaid(page);
    await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    await yourMove(page);
    await watchRush(page);
    await playOne(page);
    // His move, then the Rush: the game's position frozen as it began.
    await expect.poll(() => page.evaluate(() => !!(window as any).match.phase.rush), { timeout: 60_000 }).toBe(true);
    const start = await page.evaluate(() => {
      const m = (window as any).match;
      return { fen: m.boss.board.fen as string, plies: m.boss.board.history.length as number, moves: m.boss.powers.dash.rush.moves as { from: string; to: string; piece: string }[], side: m.boss.crowdSide as "w" | "b" };
    });
    expect(start.moves).toHaveLength(6);
    // Your ten seconds.
    await expect(page.locator('.rush-layer[data-stage="place"]')).toBeVisible({ timeout: 15_000 });
    const box = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
    const white = (await page.locator(".hb.orientation-white").count()) > 0;
    const at = (sq: string) => {
      const col = white ? sq.charCodeAt(0) - 97 : 104 - sq.charCodeAt(0);
      const row = white ? 8 - Number(sq[1]) : Number(sq[1]) - 1;
      return { x: box.x + (col + 0.5) * (box.width / 8), y: box.y + (row + 0.5) * (box.height / 8) };
    };
    for (const [i, m] of start.moves.slice(0, right).entries()) {
      const a = at(m.to);
      const b = at(m.from);
      if (i === 0) {
        // (A drag: the piece picked up and dropped on its square.)
        await page.mouse.move(a.x, a.y);
        await page.mouse.down();
        await page.mouse.move(b.x, b.y, { steps: 8 });
        await page.mouse.up();
      } else {
        await page.mouse.click(a.x, a.y);
        await page.mouse.click(b.x, b.y);
      }
    }
    await expect(page.locator(".rush-edge.right")).toHaveCount(right);
    if (right === 3) {
      // One more, put down on a wrong square (a free one of the middle ranks): a red edge, and his word.
      const m = start.moves[3]!;
      const taken = new Set([...new Chess(start.fen).board().flat().filter(Boolean).map((p) => p!.square), ...start.moves.map((x) => x.to)]);
      const free = ["a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3", "a6", "b6", "c6", "d6", "e6", "f6", "g6", "h6"].find((s) => !taken.has(s) && s !== m.from)!;
      await page.mouse.click(at(m.to).x, at(m.to).y);
      await page.mouse.click(at(free).x, at(free).y);
      await expect(page.locator(".rush-edge.wrong")).toHaveCount(1);
      await expect(page.locator(".rush-edge.right")).toHaveCount(3);
    }
    // Time's up: the verdict, the board as it was.
    await expect.poll(() => page.evaluate(() => (window as any).match.boss.powers.dash.rush.correct ?? null), { timeout: 30_000 }).toBe(right);
    expect(!(await page.evaluate(() => (window as any).match.boss.powers.dash.rush.extra))).toBe(held);
    await yourMove(page);
    const rush = await page.evaluate(() => (window as any).match.boss.powers.dash.rush);
    const after = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, plies: (window as any).match.boss.board.history.length as number }));
    if (held) expect(after.fen).toBe(start.fen);
    else {
      // (He moved again: one move more on the board, his, from the position the Rush froze; the crowd to move again.)
      expect(rush.extra).toBe("played");
      expect(after.plies).toBe(start.plies + 1);
      expect(after.fen.split(" ")[1]).toBe(start.fen.split(" ")[1]);
      const hist = await page.evaluate(() => (window as any).match.boss.board.history.at(-1) as string);
      expect(new Chess(start.fen).get(hist.slice(0, 2) as any)?.color).toBe(start.side === "w" ? "b" : "w");
    }
    const seen = (await page.evaluate(() => (window as any).__rush)) as RushSeen;
    expect(seen.stages).toEqual(expect.arrayContaining(["sweep", "place", "done"]));
    // (Five copies of him running, the countdown from "1.0" or "0.9…" down; the board drawn as the game's, piece for piece, once time's up.)
    expect(seen.copies).toBeGreaterThanOrEqual(3);
    expect(seen.copies).toBeLessThanOrEqual(5);
    expect(seen.counts.some((c) => c === "1.0" || c === "0.9")).toBe(true);
    expect(seen.doneBoards.length).toBeGreaterThan(0);
    for (const b of seen.doneBoards) expect(b).toBe(piecesOf(start.fen));
    if (right === 3) expect(seen.said.some((s) => /Close, but not quite!|Not even close\./.test(s))).toBe(true);
    expect(errors).toEqual([]);
  });
