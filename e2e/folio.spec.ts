import { expect, type Page } from "@playwright/test";
import { Chess, type Square } from "chess.js";
import { BOSS_POWERS } from "@chessroyale/core";
import { crossesCrease } from "@chessroyale/chess";
import { BOARD_SEL, test, bossAloneFromHome, createLobbyFromHome, engineTop, submitMove } from "./helpers.ts";
import { REFUSED } from "../packages/app/src/refused.ts";
import { FOLIO_LINES } from "../packages/app/src/characters/folio-lines.ts";

/**
 * Folio, the paper crane, played alone (and online for a reload), the state read from the game and what the screens draw read from
 * the page every frame (docs/decisions/2026-10-27-folio-rules.md, 2026-10-27-folio-wired.md). Its marks' markers: `.fo-marks`
 * (what the view holds and which of its sprites are drawn on which squares, under the pieces and over them).
 * - Draft (`&power=draft`: from turn 2, again every turn once a mark is gone): the ink mark under the piece and the attack's dotted
 *   line, its count of your moves left (2, then 1), the banner DRAFT and its line; left standing for your two moves, the piece is
 *   folded (the paper drawn over it, banner FOLDED and its line); its moves are refused, and the dock says why.
 * - Crease (`&power=crease`): the pencil line with the warning ("Mind the crease." once), then the crease drawn for four turns,
 *   none of your moves crossing it, refused with why, another move working; then it unfolds (the dock says so).
 * - Revision (`&power=revision`): after your fifth move the board holds the position after it, the strokes cross out both moves,
 *   the pieces go back, its new move plays; the move list strikes both moves through.
 * - Online: a reload mid-crease draws the crease as it stands, without its moment again.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const state = (p: Page) =>
  p.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board?.fen as string, history: (m.phase.board?.history ?? []) as string[], boss: m.boss, allowed: (m.boss?.powers?.allowed ?? null) as string[] | null };
  });

async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}

/** Your quiet moves allowed now (no capture, no promotion, no check), knights first; `keep` filters them. */
function quiet(fen: string, allowed: string[] | null, keep: (m: string) => boolean = () => true): string {
  const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && !m.promotion && !m.san.includes("+")).map((m) => ({ uci: m.from + m.to, piece: m.piece }));
  const ok = legal.filter((m) => (!allowed || allowed.includes(m.uci)) && keep(m.uci));
  const any = legal.filter((m) => !allowed || allowed.includes(m.uci));
  // (None quiet: a capture or a check, whatever is allowed.)
  const all = new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? "")).filter((m) => !allowed || allowed.includes(m));
  return (ok.find((m) => m.piece === "n") ?? ok[0] ?? any[0])?.uci ?? all[0]!;
}

async function play(page: Page, move: string, fen: string) {
  await submitMove(page, move, fen);
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
}

/**
 * Every frame from now: the power events the view has shown, the banners' words, the boss's lines (each time one starts), the dock's
 * line, Folio's marks' markers, Revision's moment and the board as drawn (its pieces) while it plays.
 */
async function watch(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__fo = { kinds: [] as string[], banners: [] as string[], lines: [] as string[], docks: [] as string[], marks: [] as Record<string, string>[], rev: [] as { back: string; board: string; over: string }[] };
    let lastLine = "";
    const look = () => {
      const r = w.__fo;
      for (const e of w.match?.boss?.powers?.events ?? []) if (!r.kinds.includes(e.kind)) r.kinds.push(e.kind);
      for (const b of document.querySelectorAll(".fight-banner .fb-text")) if (!r.banners.includes(b.textContent!)) r.banners.push(b.textContent!);
      const line = [...document.querySelectorAll(".bc-bubble")].map((e) => e.getAttribute("aria-label") ?? "").find(Boolean) ?? "";
      if (line && line !== lastLine) r.lines.push(line);
      lastLine = line;
      const dock = document.querySelector(".boss-dock .dock-line")?.textContent ?? "";
      if (dock && r.docks.at(-1) !== dock) r.docks.push(dock);
      const m = document.querySelector<HTMLElement>(".fo-marks");
      if (m) {
        const d = { ...m.dataset } as Record<string, string>;
        if (JSON.stringify(r.marks.at(-1)) !== JSON.stringify(d)) r.marks.push(d);
      }
      const rev = document.querySelector<HTMLElement>(".pm-revision");
      if (rev) {
        const board = [...document.querySelectorAll<HTMLElement>(".hb-board piece[data-square]:not(.fading)")].map((e) => `${e.dataset.square}${e.classList.contains("white") ? "w" : "b"}${["pawn", "knight", "bishop", "rook", "queen", "king"].find((k) => e.classList.contains(k))}`).sort().join(" ");
        r.rev.push({ back: rev.dataset.back!, board, over: m?.dataset.over ?? "" });
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}
const seen = (page: Page) => page.evaluate(() => (window as any).__fo as { kinds: string[]; banners: string[]; lines: string[]; docks: string[]; marks: Record<string, string>[]; rev: { back: string; board: string; over: string }[] });
const marks = (page: Page) => page.evaluate(() => ({ ...(document.querySelector<HTMLElement>(".fo-marks")?.dataset ?? {}) }) as Record<string, string>);

/** A position's pieces as the watcher writes them ("e4wpawn"), sorted. */
function piecesOf(fen: string): string {
  const names: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
  const out: string[] = [];
  for (const row of new Chess(fen).board()) for (const p of row) if (p) out.push(`${p.square}${p.color}${names[p.type]}`);
  return out.sort().join(" ");
}

async function tap(page: Page, square: string) {
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
  const flip = (await page.evaluate(() => (window as any).match.boss?.crowdSide)) === "b";
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  await page.mouse.click(board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8));
}

/** A legal move tapped that the turn doesn't allow: it stays put, and the dock says `why`. */
async function refused(page: Page, fen: string, move: string, why: string) {
  await tap(page, move.slice(0, 2));
  await tap(page, move.slice(2, 4));
  await expect(page.locator(".boss-dock .refused-note")).toHaveText(why);
  expect(await phase(page)).toBe("play");
  expect(await page.evaluate(() => (window as any).match.phase.board.fen)).toBe(fen);
}

/** Nothing on the page wider than the screen. */
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("Folio's Draft: the ink mark and its line, DRAFT and its line, a count of your moves; left standing for two moves the piece is folded (its paper, FOLDED), its moves refused with why", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=folio&power=draft");
  await bossAloneFromHome(page);
  await yourMove(page);
  await watch(page);
  expect((await state(page)).boss.id).toBe("folio");
  let folded: { fen: string; square: string; allowed: string[] | null } | null = null;
  const counts = new Map<string, number[]>();
  for (let i = 0; i < 30 && !folded; i++) {
    await yourMove(page);
    const s = await state(page);
    const p = s.boss.powers;
    if (p.folded?.length) {
      folded = { fen: s.fen, square: p.folded[0], allowed: s.allowed };
      break;
    }
    // A mark up: drawn under its piece, its line on the squares between, the count of your moves left at its corner.
    const mark = p.draft as { square: string; attacker: string; line: string[]; until: number } | null;
    if (mark) {
      const m = await marks(page);
      expect(m.under.split(" "), "the ink under the piece").toContain(`inkMark@${mark.square}`);
      for (const sq of mark.line) expect(m.under.split(" "), `the line on ${sq}`).toContain(`inkLine@${sq}`);
      const left = Number(m.draft.split(":")[1]);
      expect(left).toBe(mark.until - s.boss.crowdMoves);
      counts.set(mark.square, [...(counts.get(mark.square) ?? []), left]);
    }
    // A move that leaves its attack standing (not the piece, not the line, not the attacker).
    const keeps = (mv: string) => {
      if (!mark) return true;
      try {
        const c = new Chess(s.fen);
        c.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] });
        return c.attackers(mark.square as Square, s.boss.crowdSide === "w" ? "b" : "w").includes(mark.attacker as Square);
      } catch {
        return false;
      }
    };
    // The engine's best such move (Boss alone has no clock): a crowd that plays well while it leaves the mark standing, so the
    // battle lasts until a piece is folded (a careless one was mated first now and then: CI, Oct 27). Else a quiet one.
    const { top } = await engineTop(page).catch(() => ({ top: [] as { move: string }[] }));
    const best = top.map((t) => t.move).find((mv) => (!s.allowed || s.allowed.includes(mv)) && keeps(mv));
    await play(page, best ?? quiet(s.fen, s.allowed, keeps), s.fen);
  }
  expect(folded, "a fold within 30 moves").not.toBeNull();
  const r = await seen(page);
  expect(r.kinds).toEqual(expect.arrayContaining(["draft", "fold"]));
  expect(r.banners).toEqual(expect.arrayContaining(["DRAFT", "FOLDED"]));
  expect(r.lines).toEqual(expect.arrayContaining([FOLIO_LINES.power![0], FOLIO_LINES.fold![0]]));
  // (The piece that was folded counted 2, then 1. A turn can be read twice at one count, as when a Revision takes your move
  // back: CI, Oct 27, [2, 1, 1] and [2, 2, 1]; so repeats in a row count once.)
  const steps = (c: number[]) => c.filter((x, i) => i === 0 || x !== c[i - 1]).join();
  expect([...counts.values()].some((c) => steps(c).includes("2,1")), JSON.stringify([...counts])).toBe(true);
  // The paper folded over it as its fold played, while it thought (before your turn, when the view's `folded` holds it).
  expect(r.marks.some((x) => x.folded === "" && x.over.split(" ").includes(`foldPaper@${folded!.square}`)), "the paper drawn in its fold's moment").toBe(true);
  // The paper is over the folded piece, and its mark gone.
  const m = await marks(page);
  expect(m.over.split(" ")).toContain(`foldPaper@${folded!.square}`);
  expect(m.folded).toBe(folded!.square);
  // Its moves aren't yours to play while it's folded; a tap on one is refused, and the dock says why.
  const own = new Chess(folded!.fen).moves({ verbose: true }).filter((mv) => mv.from === folded!.square && !mv.promotion);
  for (const mv of own) expect(folded!.allowed ?? [], mv.from + mv.to).not.toContain(mv.from + mv.to);
  if (own.length) await refused(page, folded!.fen, own[0]!.from + own[0]!.to, REFUSED.folded);
  expect(await noSideScroll(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("Folio's Crease: its pencil line with the warning ('Mind the crease.' once), then the crease drawn for four turns, none of your moves across it (refused with why, another works); then it unfolds", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=folio&power=crease");
  await bossAloneFromHome(page);
  await yourMove(page);
  await watch(page);
  let line: string | null = null;
  let tried = false;
  let held = 0;
  // The crease's turns as first seen and as last seen (a Revision while it holds adds one: the crossed-out turn isn't counted).
  let first: number | null = null;
  let last = 0;
  for (let i = 0; i < 10; i++) {
    await yourMove(page);
    const s = await state(page);
    const p = s.boss.powers;
    const m = await marks(page);
    if (p.creaseNext) {
      line = p.creaseNext;
      expect(m.pencil).toBe(line);
      expect(m.under).toContain("creasePencil@");
    }
    if (p.crease) {
      expect(p.crease.line).toBe(line);
      expect(m.crease).toBe(line);
      // Drawn along both sides of its line, the whole length of the board: 16 squares.
      expect(m.under.split(" ").filter((x) => x.startsWith("creaseEdge@"))).toHaveLength(16);
      held++;
      last = p.crease.until - p.crease.at + 1;
      first ??= last;
      for (const mv of s.allowed ?? []) expect(crossesCrease(mv, p.crease.line, s.fen), mv).toBe(false);
      const across = new Chess(s.fen).moves({ verbose: true }).find((mv) => crossesCrease(mv.from + mv.to, p.crease.line, s.fen) && !mv.promotion);
      if (!tried && across && s.allowed) {
        tried = true;
        await refused(page, s.fen, across.from + across.to, REFUSED.crease);
      }
    } else if (held) {
      expect(m.crease).toBe("");
      break;
    }
    // The engine's best allowed move, else a quiet one: a careless crowd was mated before the crease lifted now and then (CI, Oct 27).
    const { top } = await engineTop(page).catch(() => ({ top: [] as { move: string }[] }));
    const best = top.map((t) => t.move).find((mv) => !s.allowed || s.allowed.includes(mv));
    await play(page, best ?? quiet(s.fen, s.allowed), s.fen);
  }
  expect(line).not.toBeNull();
  expect(first).toBe(BOSS_POWERS.creaseTurns);
  expect(held).toBe(last);
  expect(tried).toBe(true);
  await expect.poll(async () => (await seen(page)).kinds, { timeout: 10_000 }).toEqual(expect.arrayContaining(["warn", "creaseWarn", "crease", "creaseEnd"]));
  const r = await seen(page);
  expect(r.banners).toEqual(expect.arrayContaining(["RAGE!", "CREASE!"]));
  expect(r.lines.filter((l) => l === FOLIO_LINES.ultimateWarn![0]), "said once").toHaveLength(1);
  // (The dock's line, its icon first.)
  expect(r.docks.some((d) => d.includes("The crease unfolds. Your pieces may cross again.")), r.docks.join(" | ")).toBe(true);
  expect(await noSideScroll(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("Folio's Revision: the board holds your move, both moves are struck out, the pieces go back, its new move plays, and the move list strikes both through", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=folio&power=revision");
  await bossAloneFromHome(page);
  await yourMove(page);
  await watch(page);
  let fourth: { fen: string; history: string[] } | null = null;
  let yours = "";
  for (let i = 0; i < 5; i++) {
    await yourMove(page);
    const s = await state(page);
    expect(s.boss.powers.revision ?? null).toBeNull();
    if (i === 4) fourth = { fen: s.fen, history: s.history };
    yours = quiet(s.fen, s.allowed);
    await play(page, yours, s.fen);
  }
  await yourMove(page);
  const after = await state(page);
  const r = after.boss.powers.revision;
  expect(r).toMatchObject({ at: 5 });
  // Crossed out: its fourth move and your fifth; the board back to before its fourth, then its move in their place.
  const n = fourth!.history.length;
  expect(r.moves).toEqual([fourth!.history[n - 1], after.history[n]]);
  expect(after.history).toHaveLength(n + 2);
  expect(r.move).toBe(after.history[n + 1]);
  const replay = new Chess();
  for (const mv of fourth!.history.slice(0, n - 1)) replay.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] });
  const back = replay.fen();
  replay.move({ from: r.move.slice(0, 2), to: r.move.slice(2, 4), promotion: r.move[4] });
  expect(replay.fen().split(" ").slice(0, 4)).toEqual(after.fen.split(" ").slice(0, 4));
  // On screen: until the page turns, the position after your move; the four squares struck; then the position before its move.
  const held = new Chess(fourth!.fen);
  held.move({ from: yours.slice(0, 2), to: yours.slice(2, 4) });
  const w = await seen(page);
  expect(w.banners).toContain("REVISION");
  expect(w.lines).toContain(FOLIO_LINES.revision![0]);
  const before = w.rev.filter((x) => x.back === "0");
  const later = w.rev.filter((x) => x.back === "1");
  expect(before.length, "frames before the page turns").toBeGreaterThan(10);
  for (const x of before) expect(x.board, "the position after your move, held").toBe(piecesOf(held.fen()));
  const struck = before.at(-1)!.over.split(" ").filter((x) => x.startsWith("inkStrike@")).sort();
  // (A stroke on each move's two squares: a square both moves touch gets two.)
  expect(struck).toEqual([r.moves[0].slice(0, 2), r.moves[0].slice(2, 4), r.moves[1].slice(0, 2), r.moves[1].slice(2, 4)].map((sq) => `inkStrike@${sq}`).sort());
  // (The pieces slide back in 220 ms: the last frames of the moment show the position before its move.)
  expect(later.length).toBeGreaterThan(5);
  expect(later.at(-1)!.board, "the position before its move").toBe(piecesOf(back));
  expect(later.at(-1)!.over).not.toContain("inkStrike");
  // The move list strikes both moves through (and only those).
  const rows = page.locator(".mv-row.mv-struck");
  if ((await page.locator(".mv-list").count()) > 0) {
    await expect(rows.first()).toBeAttached();
    expect(await page.locator(".mv-list").first().locator(".mv-row.mv-struck").count()).toBe(2);
    await expect(page.locator(".mv-list").first().locator(".mv-row.mv-struck").first()).toHaveAttribute("aria-label", /crossed out$/);
  }
  expect(errors).toEqual([]);
});

test("Folio's tile and stage, its figure in the bar or beside the board, at 320 and 1280, no page errors and nothing wider than the screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const desktop = test.info().project.name === "desktop";
  await page.setViewportSize(desktop ? { width: 1280, height: 800 } : { width: 320, height: 640 });
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=folio");
  await bossAloneFromHome(page);
  await yourMove(page);
  // Its figure drawn (its kit's), its name in the bar.
  await expect(page.locator(".boss-char-sprite:visible").first()).toBeVisible();
  await expect(page.locator(".boss-bar").first()).toContainText("Folio");
  expect(await noSideScroll(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("Folio online: a reload mid-crease draws the crease as it stands, without its moment again", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "one run is enough: a computer");
  test.setTimeout(6 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&mode=raid&boss=folio&power=crease&clock=60&laststand=0");
  await createLobbyFromHome(page);
  await page.getByRole("button", { name: /^Start with 1 player$/ }).click();
  for (let i = 0; i < 6; i++) {
    await yourMove(page);
    const s = await state(page);
    if (s.boss.powers.crease) break;
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    await expect.poll(() => page.evaluate(() => (window as any).match.phase.kind !== "play" || !!(window as any).match.boss?.powers?.crease), { timeout: 60_000 }).toBe(true);
  }
  await yourMove(page);
  const crease = (await state(page)).boss.powers.crease;
  expect(crease?.line).toBeTruthy();
  await page.reload();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await watch(page);
  await page.waitForTimeout(2000);
  const r = await seen(page);
  expect(r.banners, "no CREASE! again").not.toContain("CREASE!");
  const m = await marks(page);
  expect(m.crease).toBe(crease.line);
  expect(m.under.split(" ").filter((x) => x.startsWith("creaseEdge@"))).toHaveLength(16);
  expect(errors).toEqual([]);
});
