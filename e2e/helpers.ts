import { execFileSync } from "node:child_process";
import { test as base, expect, type Page } from "@playwright/test";

/**
 * Playwright's `test`, plus: every browser context a test opens itself (`browser.newContext()`, e.g. a second
 * player) is closed when the test ends, pass or fail. Playwright leaves them open until the worker exits, and a page
 * left in a live match keeps playing it (a host's page runs its engines), slowing every later test in that worker.
 * Use this `test` in any file that opens contexts.
 */
export const test = base.extend<{ closeOwnContexts: void }>({
  closeOwnContexts: [
    async ({ browser }, use) => {
      const before = new Set(browser.contexts());
      await use();
      await Promise.all(browser.contexts().filter((c) => !before.has(c)).map((c) => c.close()));
    },
    { auto: true },
  ],
});

/**
 * The board's parts, as selectors (board/OwnBoard.tsx: docs/areas/board.md). Tests use these, so a change to the
 * board's elements is one change here.
 */
export const BOARD_SEL = {
  /** The board element, with its `orientation-white` / `orientation-black` class. */
  wrap: ".hb",
  /** Exactly the 64 squares (a hair smaller than the wrap). */
  squares: ".hb-board",
  /** The drawn board with its coordinates and arrows (the same box as the squares). */
  container: ".hb-container",
  /** A piece on the board (`piece.white.pawn`, `.fading` while a captured one fades). */
  piece: ".hb-board piece",
  /** A square's highlight (`square.move-dest`, `.selected`, `.last-move`, `.oc` on an occupied destination). */
  square: ".hb-board square",
  /** The arrows' shafts. */
  arrowLine: "svg.hb-shapes line",
  /** The coordinates along the bottom and up the side. */
  fileCoord: ".hb-files .hb-coord",
  rankCoord: ".hb-ranks .hb-coord",
} as const;

/**
 * Plays `move` in the page's match while it's your turn (on `fen`, if given; nothing to play: nothing happens). Work a
 * move out in one evaluate (it may await the engine) and play it with this, never inside that awaited evaluate: the
 * move starts a render before Chrome has taken the evaluate's answer, and under a busy render Chrome can lose the answer
 * to its garbage collector ("Promise was collected", which Playwright reports as "Execution context was destroyed").
 */
export async function submitMove(page: Page, move: string | null | undefined, fen?: string) {
  if (!move) return;
  await page.evaluate(
    ([mv, f]) => {
      const m = (window as any).match;
      if (m.phase.kind === "play" && (!f || m.phase.board.fen === f)) m.submit(mv);
    },
    [move, fen ?? null] as const,
  );
}

/**
 * The front door, as a player uses it. Your name is your profile's: `named` sets the one a fresh device's guest
 * account is made with (before the first visit).
 */
export async function named(page: Page, name: string) {
  await page.addInitScript((n) => {
    try {
      if (!localStorage.getItem("brc.name")) localStorage.setItem("brc.name", n);
    } catch {
      // No storage.
    }
  }, name);
}

/**
 * Sound off in a match: the sound button in the top line on a computer; on a phone, the "⋯" sheet's Sound switch
 * (MatchMenu.tsx: the phone's top line has "⋯" where the sound button was).
 */
export async function soundOff(page: Page) {
  const btn = page.getByRole("button", { name: "Turn sound off" }).first();
  if (await btn.isVisible().catch(() => false)) return btn.click();
  await page.getByRole("button", { name: "Match options" }).click();
  const sheet = page.getByRole("dialog", { name: "Match options" });
  await sheet.getByRole("switch", { name: /Sound/ }).click();
  // (A tap anywhere else, or Escape, closes the sheet.)
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "detached" });
}

/**
 * Home's RANKED row: tap `mode` ("50 v 50", "1 v 1", "Squads", "Classic"), or with none, 50 v 50 unless a mode is
 * picked already (by ?mode= or an earlier tap). Home opens with nothing picked and PLAY dimmed (Eric, Oct 18).
 */
export async function pickMode(page: Page, mode?: string) {
  const row = page.getByRole("radiogroup", { name: "RANKED" });
  await row.getByRole("radio").first().waitFor();
  if (mode) return row.getByRole("radio", { name: new RegExp(`^${mode}`) }).click();
  if (!(await row.locator('[aria-checked="true"]').count())) await row.getByRole("radio", { name: /^50 v 50/ }).click();
}

/** Home → Matchmaking: Solo → PLAY (in the mode the URL or the picker chose, else 50 v 50): you and bots, after the seats fill. */
export async function soloFromHome(page: Page) {
  await pickMode(page);
  await page.getByRole("radio", { name: /^Solo/ }).click();
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
}

/** Play with friends' sheet: a phone's Friends in home's top bar, a computer's side menu (Eric, Oct 18). */
export async function openPlayWithFriends(page: Page) {
  // (A computer's frame from 1024 px: phones and tablets have home's top bar.)
  if ((page.viewportSize()?.width ?? 0) < 1024) await page.locator(".fd-top").getByRole("button", { name: /^Friends/ }).click();
  else await page.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Play with friends" }).click();
  await page.getByRole("dialog", { name: /Play with friends|Join lobby/ }).waitFor();
}

/** Home → Play with friends → Get friend code (a lobby, its link copied), or Create a raid on the Boss raid screen. */
export async function createLobbyFromHome(page: Page) {
  const raidScreen = page.getByRole("heading", { name: "Boss raid", exact: true });
  await page.getByRole("button", { name: "PLAY", exact: true }).or(raidScreen).first().waitFor();
  if (await raidScreen.isVisible()) await page.getByRole("main").getByRole("button", { name: /^Play with friends/ }).click();
  else await openPlayWithFriends(page);
  await page.getByRole("button", { name: /^(Get friend code|Get a Classic friend code|Create a raid)$/ }).click();
}

/** An invite link opens the join form with the code filled in. */
export async function joinFromInvite(page: Page) {
  const dialog = page.getByRole("dialog", { name: /Join lobby/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Join lobby" }).click();
}

/**
 * The engine's top moves for the position on the board, without holding a page.evaluate open while the engine thinks:
 * the search starts in the page, its answer is kept on `window`, and the test polls for it. An evaluate that awaited
 * the search could fail now and then with "Execution context was destroyed, most likely because of a navigation"
 * although nothing navigated (.claude/LESSONS.md: "A navigation that never happened").
 * - "judged" (default): the runner's, ranked as the judge ranks them (a solo match; online, this device's engine's top 8).
 * - "raw": the runner's unfiltered search (the moves a power may forbid included).
 */
export async function engineTop(page: Page, kind: "judged" | "raw" = "judged", timeout = 60_000): Promise<{ fen: string; top: { move: string }[] }> {
  const key = await page.evaluate((kind) => {
    const w = window as unknown as { match: any; __top?: Record<string, unknown> };
    const m = w.match;
    const fen: string = m.phase.board.fen;
    const k = `${fen}#${Math.random().toString(36).slice(2)}`;
    const store = (w.__top ??= {});
    store[k] = null;
    const r = m.runner;
    const search: Promise<unknown> = !r
      ? m.engines().then(([e]: { topMoves: (f: string, n: number) => Promise<unknown> }[]) => e!.topMoves(fen, 8))
      : kind === "raw"
        ? r.top.get(r.opts.engines[0], fen)
        : r.topMovesFor(fen);
    void search.then(
      (top: unknown) => (store[k] = { fen, top }),
      (e: unknown) => (store[k] = { fen, top: [], error: String(e) }),
    );
    return k;
  }, kind);
  let out: { fen: string; top: { move: string }[] } | null = null;
  await expect
    .poll(async () => (out = await page.evaluate((k) => ((window as unknown as { __top?: Record<string, unknown> }).__top?.[k] ?? null) as never, key)), { timeout })
    .not.toBeNull();
  await page.evaluate((k) => delete (window as unknown as { __top?: Record<string, unknown> }).__top?.[k], key);
  return out!;
}

/**
 * Starts watching the page, every frame, for a selector (and, optionally, text in it): `spans()` then says when each
 * was first and last on screen (the page's clock, ms; null: never). For what must come in order on screen, frame by
 * frame: a power's banner off the board before the power plays (docs/decisions/2026-10-16-banner-timing.md).
 */
export async function watchSpans(page: Page, what: Record<string, { selector: string; text?: RegExp }>) {
  const tag = Math.random().toString(36).slice(2);
  await page.evaluate(
    ({ tag, what }) => {
      const w = window as unknown as { __spans?: Record<string, Record<string, { first: number; last: number } | null>> };
      const spans: Record<string, { first: number; last: number } | null> = Object.fromEntries(Object.keys(what).map((k) => [k, null]));
      (w.__spans ??= {})[tag] = spans;
      const end = performance.now() + 120_000;
      const frame = () => {
        const now = performance.now();
        for (const [k, { selector, text }] of Object.entries(what as Record<string, { selector: string; text?: { source: string; flags: string } }>)) {
          const on = [...document.querySelectorAll(selector)].some((e) => !text || new RegExp(text.source, text.flags).test(e.textContent ?? ""));
          if (on) spans[k] = { first: spans[k]?.first ?? now, last: now };
        }
        if (now < end) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },
    { tag, what: Object.fromEntries(Object.entries(what).map(([k, v]) => [k, { selector: v.selector, text: v.text ? { source: v.text.source, flags: v.text.flags } : undefined }])) as never },
  );
  return {
    spans: () => page.evaluate((t) => (window as unknown as { __spans: Record<string, Record<string, { first: number; last: number } | null>> }).__spans[t]!, tag),
  };
}

/**
 * Starts watching the page for a selector (and, optionally, text in another): `seen()` then says whether each ever
 * showed, however briefly. For things on screen for a moment (a piece burning for 1.5 s), so a test never misses one
 * by checking a beat too late.
 */
export async function watchFor(page: Page, what: Record<string, { selector: string; text?: RegExp }>) {
  const tag = Math.random().toString(36).slice(2);
  await page.evaluate(
    ({ tag, what }) => {
      const w = window as unknown as { __seen?: Record<string, Record<string, boolean>> };
      const seen: Record<string, boolean> = Object.fromEntries(Object.keys(what).map((k) => [k, false]));
      (w.__seen ??= {})[tag] = seen;
      const check = () => {
        for (const [k, { selector, text }] of Object.entries(what as Record<string, { selector: string; text?: { source: string; flags: string } }>)) {
          if (seen[k]) continue;
          const els = [...document.querySelectorAll(selector)];
          seen[k] = els.some((e) => !text || new RegExp(text.source, text.flags).test(e.textContent ?? ""));
        }
      };
      check();
      const obs = new MutationObserver(check);
      obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
      setTimeout(() => obs.disconnect(), 120_000);
    },
    { tag, what: Object.fromEntries(Object.entries(what).map(([k, v]) => [k, { selector: v.selector, text: v.text ? { source: v.text.source, flags: v.text.flags } : undefined }])) as never },
  );
  return {
    seen: () => page.evaluate((t) => (window as unknown as { __seen: Record<string, Record<string, boolean>> }).__seen[t]!, tag),
  };
}

/**
 * The big board's coordinates, each measured by its text against the square it names (.claude/LESSONS.md,
 * "Coordinates a column off"): every label along the bottom inside the bottom-row square it names, every label up the
 * left inside the left-column square it names, either way up, and on a board turned a quarter of the way round
 * (Boingo's funhouse: the board's `data-turn`, 90 or 270), where the bottom edge runs along the real ranks and the side
 * along the real files. Says which way up the board is, its turn, and which labels are out of place (none: an empty
 * list). Poll it until the board you mean is on screen.
 */
export async function boardCoords(page: Page): Promise<{ orientation: "white" | "black" | null; turn: number; off: string[] }> {
  return page.evaluate((sel) => {
    const wrap = document.querySelector(`.board-area ${sel.wrap}`);
    const board = wrap?.querySelector(sel.squares);
    if (!wrap || !board) return { orientation: null, turn: 0, off: ["no board"] };
    const black = wrap.classList.contains("orientation-black");
    const turn = Number((wrap.closest(".board-wrap") as HTMLElement | null)?.dataset.turn ?? 0);
    const b = board.getBoundingClientRect();
    const sq = b.width / 8;
    const text = (el: Element) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getBoundingClientRect();
    };
    // The real square drawn in a column and row (from the top-left): the view's square there, turned back.
    const realAt = (col: number, row: number) => {
      const F = black ? 7 - col : col;
      const R = black ? row : 7 - row;
      const [f, r] = turn === 90 ? [7 - R, F] : turn === 270 ? [R, 7 - F] : [F, R];
      return { file: "abcdefgh"[f]!, rank: String(r + 1) };
    };
    const names = (sqr: { file: string; rank: string }, label: string) => (/^[a-h]$/.test(label) ? sqr.file === label : sqr.rank === label);
    // (Half a pixel either way for the text's own rounding.)
    const inSquare = (t: DOMRect, col: number, row: number) =>
      t.width > 0 && t.left >= b.left + col * sq - 0.5 && t.right <= b.left + (col + 1) * sq + 0.5 && t.top >= b.top + row * sq - 0.5 && t.bottom <= b.top + (row + 1) * sq + 0.5;
    const where = (t: DOMRect) => `${Math.round(t.left - b.left)},${Math.round(t.top - b.top)} on a ${Math.round(sq)} px square`;
    const files = [...wrap.querySelectorAll(sel.fileCoord)];
    const ranks = [...wrap.querySelectorAll(sel.rankCoord)];
    const off: string[] = [];
    if (files.length !== 8 || ranks.length !== 8) off.push(`${files.length} bottom and ${ranks.length} side labels`);
    const bottom = files.map((el) => (el.textContent ?? "").trim().toLowerCase());
    const side = ranks.map((el) => (el.textContent ?? "").trim().toLowerCase());
    if (new Set(bottom).size !== bottom.length || new Set(side).size !== side.length) off.push(`labels named twice: ${bottom.join("")} / ${side.join("")}`);
    files.forEach((el, i) => {
      const label = bottom[i]!;
      const col = [0, 1, 2, 3, 4, 5, 6, 7].find((c) => names(realAt(c, 7), label));
      const t = text(el);
      if (col === undefined || !inSquare(t, col, 7)) off.push(`bottom ${label} at ${where(t)}`);
    });
    ranks.forEach((el, i) => {
      const label = side[i]!;
      const row = [0, 1, 2, 3, 4, 5, 6, 7].find((r) => names(realAt(0, r), label));
      const t = text(el);
      if (row === undefined || !inSquare(t, 0, row)) off.push(`side ${label} at ${where(t)}`);
    });
    return { orientation: black ? "black" : "white", turn, off };
  }, BOARD_SEL);
}

/** Waits until the big board (that way up, if given) has every coordinate in its own square; says which way up it is. */
export async function expectCoordsInSquares(page: Page, orientation?: "white" | "black", timeout = 10_000, turn?: number): Promise<"white" | "black"> {
  let last: Awaited<ReturnType<typeof boardCoords>> = { orientation: null, turn: 0, off: [] };
  await expect
    .poll(
      async () => {
        last = await boardCoords(page);
        return last.off.length === 0 && (!orientation || last.orientation === orientation) && (turn === undefined || last.turn === turn)
          ? "in their squares"
          : `${last.orientation} ${last.turn}: ${last.off.join("; ") || "waiting for the board that way up"}`;
      },
      { timeout },
    )
    .toBe("in their squares");
  return last.orientation!;
}

/** The server's config as production's says it: TEST_SWITCHES off. */
export async function switchesOff(page: Page) {
  await page.route("**/api/auth/config", async (route) => {
    const res = await route.fetch();
    const { testSwitches: _, ...body } = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, json: body });
  });
}

/** Your profile says you're an admin (as /api/me does for an email in ADMIN_EMAILS). */
export async function asAdmin(page: Page) {
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    try {
      const res = await route.fetch();
      const body = await res.json().catch(() => null);
      await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
    } catch {
      // The page is gone: nothing to answer.
    }
  });
}

/**
 * Makes this page's account a real admin on the server (the admin pages: /admin/ops, /admin/fairplay): the local Worker's
 * ADMIN_EMAILS (playwright.config.ts) has one email per lane and project (`${who}-admin-${project}@e2e.test`), given
 * here straight in the local database (no sign-in is set up in tests). Reloads nothing: the server reads it at once.
 * The local database is one SQLite file that the running server writes to as well (presence, live lobbies), and this
 * second process gets "database is locked: SQLITE_BUSY" while a write of the server's is under way: then it waits a
 * moment and asks again, as SQLite's own busy wait would (wrangler's command has none). Any other error fails the test,
 * with its message (docs/decisions/2026-10-15-flaky-e2e-batch.md). Answers the account's id.
 */
export async function asServerAdmin(page: Page, who: "ops" | "chat" = "ops") {
  const email = `${who}-admin-${test.info().project.name}@e2e.test`;
  const id = ((await (await page.request.get("/api/me")).json()) as { user: { id: string } }).user.id;
  const sql = `UPDATE users SET email = NULL WHERE email = '${email}'; UPDATE users SET email = '${email}' WHERE id = '${id}'`;
  for (let attempt = 1; ; attempt++) {
    try {
      execFileSync("npx", ["wrangler", "d1", "execute", "hunchess", "--local", "--command", sql], { stdio: "pipe" });
      return id;
    } catch (e) {
      const why = String((e as { stderr?: unknown }).stderr ?? e);
      if (!why.includes("SQLITE_BUSY") || attempt >= 10) throw new Error(`d1 execute failed (attempt ${attempt}): ${why.slice(-500)}`);
      await page.waitForTimeout(300);
    }
  }
}

/** Home → the Boss raid card → its screen (Eric, Oct 16: the boss raid has a screen of its own). */
export async function openBossRaid(page: Page) {
  await page.getByRole("main").getByRole("button", { name: /^Boss raid/ }).click();
  await expect(page.getByRole("heading", { name: "Boss raid", exact: true })).toBeVisible();
}

/**
 * Home → Boss raid → (the boss's tile, `boss`: its name, as its tile is named) → Boss alone: its menu, the difficulty and
 * that boss, or a random one without `boss` (with ?boss= in the address, the battle at once).
 */
export async function bossAloneFromHome(page: Page, boss?: string) {
  await openBossRaid(page);
  if (boss) await page.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio", { name: boss, exact: true }).click();
  await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
}
