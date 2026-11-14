import { resolve } from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";

/** The local server's state folder (playwright.config.ts: a fresh temp folder each run, unless E2E_KEEP_STATE=1). */
export const E2E_STATE = resolve(process.env.E2E_STATE_DIR || ".wrangler/state");

/**
 * Playwright's `test`, plus: every browser context a test opens itself (`browser.newContext()`, e.g. a second
 * player) is closed when the test ends, pass or fail. Playwright leaves them open until the worker exits, and a page
 * left in a live match keeps playing it (a host's page runs its engines), slowing every later test in that worker.
 * Use this `test` in any file that opens contexts.
 */
/**
 * The first-time walkthrough's "don't show again" key (packages/app/src/tutorial.ts, TUTORIAL_SEEN_KEY). Every test's
 * fresh account would otherwise get it over the screen and block its clicks, so each context starts with it set.
 * A test that tests the walkthrough sets `test.use({ tutorialSeen: false })`.
 */
const TUTORIAL_SEEN_KEY = "hunchess.tutorial.dismissed";

/** Sets the walkthrough's "don't show again" flag in every page the context opens, once (a reload keeps what the page saved). */
async function markSeen(context: import("@playwright/test").BrowserContext) {
  await context.addInitScript((k: string) => {
    try {
      if (!localStorage.getItem(k)) localStorage.setItem(k, "1");
    } catch {
      /* no storage: the walkthrough would show over the screen */
    }
  }, TUTORIAL_SEEN_KEY);
}

/** Whether contexts made now start with the walkthrough seen (set per test from the `tutorialSeen` option, below). */
let seenDefault = true;

/**
 * The quests overlay's "shown today" key (packages/app/src/quests.ts, QUESTS_SEEN_KEY; Nov 9, phase 3): a signed-in account's first
 * home visit of the day opens it over home, which would block a signed-in test's clicks, so each context starts with it set past any
 * day. The same for its opening by itself back on home after a game that moved a quest (QUESTS_NO_POP_KEY, Nov 10). A test of
 * either sets `test.use({ questsSeen: false })`.
 */
const QUESTS_SEEN_KEY = "hunchess.quests.seenDay";
const QUESTS_NO_POP_KEY = "hunchess.quests.noPop";
async function markQuestsSeen(context: import("@playwright/test").BrowserContext) {
  await context.addInitScript(
    ([k, off]: string[]) => {
      try {
        if (!localStorage.getItem(k!)) localStorage.setItem(k!, "9999999999999");
        localStorage.setItem(off!, "1");
      } catch {
        /* no storage: the overlay may show over home */
      }
    },
    [QUESTS_SEEN_KEY, QUESTS_NO_POP_KEY],
  );
}
let questsSeenDefault = true;

export const test = base.extend<{ closeOwnContexts: void; tutorialSeen: boolean; seenWalkthrough: void; questsSeen: boolean; questsSeenForTest: void; seenQuests: void }>({
  tutorialSeen: [true, { option: true }],
  // Sets the default for this test's contexts, then puts it back.
  seenDefaultForTest: [
    async ({ tutorialSeen }, use) => {
      seenDefault = tutorialSeen;
      await use();
      seenDefault = true;
    },
    { auto: true },
  ],
  questsSeen: [true, { option: true }],
  questsSeenForTest: [
    async ({ questsSeen }, use) => {
      questsSeenDefault = questsSeen;
      await use();
      questsSeenDefault = true;
    },
    { auto: true },
  ],
  // The page's own context (every page it opens, and every reload, keeps what the page saved).
  seenWalkthrough: [
    async ({ context, tutorialSeen, questsSeenForTest: _ }, use) => {
      if (tutorialSeen) await markSeen(context);
      await use();
    },
    { auto: true },
  ],
  // (After both defaults are set: the context is made by the first fixture that asks for it, with the defaults then in force.)
  seenQuests: [
    async ({ context, questsSeen, questsSeenForTest: _ }, use) => {
      if (questsSeen) await markQuestsSeen(context);
      await use();
    },
    { auto: true },
  ],
  // Every context a test makes with `browser.newContext()` (a second player) starts with the flag set too.
  browser: [
    async ({ browser }, use) => {
      const real = browser.newContext.bind(browser);
      browser.newContext = (async (options?: Parameters<typeof real>[0]) => {
        const ctx = await real(options);
        if (seenDefault) await markSeen(ctx);
        if (questsSeenDefault) await markQuestsSeen(ctx);
        return ctx;
      }) as typeof browser.newContext;
      await use(browser);
      browser.newContext = real as typeof browser.newContext;
    },
    { scope: "worker" },
  ],
  closeOwnContexts: [
    async ({ browser, context }, use) => {
      const before = new Set(browser.contexts());
      await use();
      // Every route is let go before its page closes, and a handler still running then fails quietly: a handler waiting on
      // `route.fetch()` as the test ended (switchesOff's /api/auth/config, asked for by the last page load) threw "route.fetch:
      // Target page, context or browser has been closed" into a test that had passed (public-profile's flaky helpers.ts:303, Nov 2).
      const own = browser.contexts().filter((c) => !before.has(c));
      await Promise.all(
        [context, ...own].flatMap((c) => [c.unrouteAll({ behavior: "ignoreErrors" }), ...c.pages().map((p) => p.unrouteAll({ behavior: "ignoreErrors" }))]),
      );
      await Promise.all(own.map((c) => c.close()));
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
 * Sound off in a match: the gear's list and its Sound switch (MatchMenu.tsx; the same on a phone and a computer).
 */
export async function soundOff(page: Page) {
  await page.getByRole("button", { name: "Match options" }).click();
  const sheet = page.getByRole("dialog", { name: "Match options" });
  await sheet.getByRole("switch", { name: /Sound/ }).click();
  // (A tap anywhere else, the X, or Escape, closes the list.)
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "detached" });
}

/**
 * Out of a 50 v 50 or Squads lobby for good (Nov 10: its Exit, with "Keep me in the queue" unchecked; checked, Exit keeps you
 * queued while you browse: search-home.spec.ts). The unchecked box is remembered on the device, as a player's is.
 */
export async function leaveQueue(page: Page) {
  await page.getByRole("checkbox", { name: "Keep me in the queue" }).uncheck();
  await page.getByRole("button", { name: "Exit", exact: true }).click();
}

/**
 * Home's RANKED row: tap `mode` ("50 v 50", "1 v 1", "Squads", "Classic"), or with none, 50 v 50 unless a mode is
 * picked already (by ?mode= or an earlier tap). Home opens with nothing picked and PLAY dimmed (Eric, Oct 18).
 */
export async function pickMode(page: Page, mode?: string) {
  const row = page.getByRole("radiogroup", { name: "RANKED" });
  await row.getByRole("radio").first().waitFor();
  if (mode) return row.getByRole("radio", { name: new RegExp(`^${mode}`) }).click();
  // (Nothing picked: the panel is there, greyed (Eric, Oct 25: its class `idle`). ?mode=classic picks Classic, which has no button in the row, but has its panel.)
  if (await page.locator(".fd-mode-panel.idle").count()) await row.getByRole("radio", { name: /^50 v 50/ }).click();
}

/**
 * Home → 50 v 50's Bots → PLAY → the Bot level box's OK (in the mode the URL or the picker chose, else 50 v 50): you and bots, after
 * the seats fill. The box keeps this device's last pick; with none, Medium (the bots of before Nov 9).
 */
export async function soloFromHome(page: Page) {
  await pickMode(page);
  await page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Bots/ }).click();
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await startBotLevel(page);
}

/** The Bot level box (PLAY with Bots): its OK, picking Medium first when nothing is picked. */
export async function startBotLevel(page: Page) {
  const box = page.getByRole("dialog", { name: "Bot level" });
  await box.waitFor();
  const ok = box.getByRole("button", { name: "OK", exact: true });
  if (await ok.isDisabled()) await box.getByRole("radio", { name: /^Medium/ }).click();
  await ok.click();
}

/**
 * Play with friends' sheet: a phone's Friends in home's top bar, then the friends page's "Private lobby: make one or join with a
 * code" (Nov 11; the pop-up's "Private lobby ›" before), a computer's side menu (Eric, Oct 18).
 */
export async function openPlayWithFriends(page: Page) {
  // (A computer's frame from 1024 px: phones and tablets have home's top bar.)
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.locator(".fd-top").getByRole("button", { name: /^Friends/ }).click();
    await page.getByRole("button", { name: "Private lobby: make one or join with a code" }).click();
  } else await page.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Play with friends" }).click();
  await page.getByRole("dialog", { name: /Play with friends|Join lobby/ }).waitFor();
}

/** Home → Play with friends → Get friend code (a lobby, its link copied), or Create a Boss Battle on the full Boss Battle screen. */
export async function createLobbyFromHome(page: Page) {
  // (The full screen's own button: since Nov 10 both Boss Battle screens share their heading.)
  const raidScreen = page.getByRole("main").getByRole("button", { name: /^Join a Boss Battle/ });
  await page.getByRole("button", { name: "PLAY", exact: true }).or(raidScreen).first().waitFor();
  if (await raidScreen.isVisible()) await page.getByRole("main").getByRole("button", { name: /^Play with friends/ }).click();
  else await openPlayWithFriends(page);
  await page.getByRole("button", { name: /^(Get friend code|Get a Classic friend code|Create a Boss Battle)$/ }).click();
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
 * ADMIN_EMAILS (playwright.config.ts' ADMINS) has one email per lane, spec file and project
 * (`${who}-admin-${file}-${project}@e2e.test`), given here straight in the local database (no sign-in is set up in tests).
 * One a file: putting an address on this account takes it off any other (withEmail), so two files running side by side
 * with one address left the first a guest halfway through ("Sign in to chat with other players." on a Report, Oct 30).
 * A new spec file that makes an admin needs its line in ADMINS. Reloads nothing: the server reads it at once.
 * The write goes through the server's own database (localSql), so it never locks the server out; an error fails the test, with its
 * message. Answers the account's id.
 */
export async function asServerAdmin(page: Page, who: "ops" | "chat" = "ops") {
  const file = test.info().file.split(/[\\/]/).pop()!.replace(/\.spec\.ts$/, "");
  return withEmail(page, `${who}-admin-${file}-${test.info().project.name}@e2e.test`);
}

/**
 * Makes this page's account a signed-in one (an email on it, given straight in the local database, as `asServerAdmin` does:
 * no sign-in is set up in tests), e.g. for the town square's chat, which is for signed-in accounts only. A fresh email each
 * time. Reload the page after it for the app to see it. Answers the account's id.
 */
export async function asSignedIn(page: Page, label = "player") {
  return withEmail(page, `${label}-${test.info().project.name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.test`);
}

/**
 * This page's own account's id. The page makes its guest account with its first /api/me, and the town square shows before that
 * answer comes (App.tsx renders the town ahead of the account's splash), so a test can get here first: `page.request` would
 * then go without the session cookie and make a second guest, and the page's own answer, landing after, would put its cookie
 * back. The email went on the other guest and the reload was a guest's (main 356dc03, town-chat.spec.ts "two signed-in
 * players…", Bo's typing line greyed "Sign in to chat"). So this waits for the page's session cookie before it asks.
 */
async function pageAccountId(page: Page): Promise<string> {
  // (A page that hasn't opened the app yet has no request of its own in flight: its /api/me here makes its account.)
  if (page.url() !== "about:blank")
    await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "hc_session"), { message: "the page's own account (its session cookie)", timeout: 20_000 }).toBe(true);
  return ((await (await page.request.get("/api/me")).json()) as { user: { id: string } }).user.id;
}

/** Puts `email` on this page's account in the local database (taking it off any other account first). Answers the id. */
async function withEmail(page: Page, email: string) {
  const id = await pageAccountId(page);
  await localSql(page, `UPDATE users SET email = NULL WHERE email = '${email}'; UPDATE users SET email = '${email}' WHERE id = '${id}'`);
  return id;
}

/**
 * The town's first frame drawn (its canvas's `data-ready`), within 20 s: as town.spec.ts and town-street.spec.ts wait. That first frame
 * paints every house and boss sprite on the page's own thread (Town.tsx, startTown): about 1 s on a phone, 2 to 3 s on a busy CI
 * runner, and past 5 s (the default wait) on a cold one (main run 42768777492, town-afk; colosseum, shop). Nov 10.
 */
// (40 s: the street town's loading screen paints and uploads every picture before its first frame, Nov 11: about 5 s more.)
export const townReady = (page: Page) => expect(page.locator("canvas.town-canvas")).toHaveAttribute("data-ready", "1", { timeout: 40_000 });

/**
 * Runs `sql` on the local database, through the server's own D1 (`POST /api/e2e/sql`, server/src/e2e-sql.ts; the e2e's local server
 * only). Answers the last statement's rows. (Not `wrangler d1 execute --local` beside the server any more: while that second process
 * held the file's lock, a request on the server failed with SQLITE_BUSY, a 500 in whatever test was open. Nov 10.)
 */
export async function localSql<T = Record<string, unknown>>(page: Page, sql: string, ...params: (string | number)[]): Promise<T[]> {
  const res = await page.request.post("/api/e2e/sql", { data: { sql, ...(params.length ? { params } : {}) }, headers: { "x-e2e-sql": process.env.E2E_SQL_KEY ?? "" } });
  if (!res.ok()) throw new Error(`local sql failed (${res.status()}): ${(await res.text()).slice(0, 500)}\n${sql}`);
  return ((await res.json()) as { rows: T[] }).rows;
}

/**
 * Gives this page's account crate items straight in the local database (for items no crate holds yet, such as the rides, Oct
 * 31: nobody but admins can get one), at the purity given (default 80%). Answers their ids, in order. Wear one with
 * `wearItem`; reload for the app to see them.
 */
export async function giveItems(page: Page, items: readonly { def: string; color: string; blemish?: number; seed?: number }[]) {
  const user = await pageAccountId(page);
  const ids = items.map((_, i) => `e2e-${user.slice(0, 8)}-${Date.now().toString(36)}-${i}`);
  const rows = items.map((it, i) => `('${ids[i]}', '${user}', '${it.def}', '${it.color}', ${it.blemish ?? 20}, ${it.seed ?? 7 + i}, 'e2e', 0)`);
  await localSql(page, `INSERT INTO items (id, user_id, def, color, blemish, seed, crate, created_at) VALUES ${rows.join(", ")}`);
  return ids;
}

/**
 * Gives this page's account `n` crates of a series (`crate`: "winter-1", "beta-001") and `keys` crate keys straight in the local
 * database (Nov 9, XP phase 2: a series crate takes one you hold and a key to open), as `giveItems` gives items. Reload, or let the
 * Crates tab load, for the app to see them. (No ledger rows: the local database's ledger check isn't run in tests.)
 */
export async function giveCrates(page: Page, crate: string, n: number, keys = n) {
  const user = await pageAccountId(page);
  await localSql(
    page,
    `INSERT INTO series_crates (user_id, crate, n) VALUES ('${user}', '${crate}', ${n}) ON CONFLICT (user_id, crate) DO UPDATE SET n = n + excluded.n; ` +
      `INSERT INTO wallets (user_id, crate_keys) VALUES ('${user}', ${keys}) ON CONFLICT (user_id) DO UPDATE SET crate_keys = crate_keys + excluded.crate_keys`,
  );
}

/**
 * Pushes this page's open solo boss battle's start back `ms` in the local database: the server times a solo battle by its own clock
 * (packages/server/src/boss-tokens.ts), so a test's short battle can count as one of 5 minutes or more.
 */
export async function backdateSoloBattle(page: Page, ms: number) {
  const user = await pageAccountId(page);
  await localSql(page, `UPDATE solo_battles SET started_at = started_at - ${Math.round(ms)} WHERE user_id = '${user}'`);
}

/** Wears item `id` (one of yours) in `slot`, or takes the slot's item off (null), through the server, as the locker does. */
export async function wearItem(page: Page, slot: string, id: string | null) {
  const ok = await page.evaluate(
    async ([slot, item]) => (await fetch("/api/locker/equip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slot, item }) })).ok,
    [slot, id] as const,
  );
  expect(ok, `wear ${id} in ${slot}`).toBe(true);
}

/**
 * The full Boss raid screen, every raid choice (Eric, Oct 16; Oct 26: the test link ?mode=raid). It's added to the page's own
 * address, so the switches it was opened with stay. Home's Boss Battle card opens the solo form instead: openSoloBoss.
 */
export async function openBossRaid(page: Page) {
  const to = new URL(page.url());
  to.searchParams.set("mode", "raid");
  await page.goto(`${to.pathname}${to.search}`);
  await expect(page.getByRole("heading", { name: "Boss Battle", exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: /^Join a Boss Battle/ })).toBeVisible();
}

/** Home → Boss Battle's card → its screen: the tiles, the stage and START (Eric, Oct 26; renamed Oct 29). */
export async function openSoloBoss(page: Page) {
  await page.getByRole("main").getByRole("button", { name: /^Boss Battle/ }).click();
  await expect(page.getByRole("heading", { name: "Boss Battle", exact: true })).toBeVisible();
}

/**
 * Home → Boss Battle → (the boss's tile, `boss`: its name, as its tile is named) → START: the battle at once, with that boss, or a
 * random one without `boss`, at the screen's difficulty (Oct 29: START skips the old Boss alone menu).
 */
export async function bossAloneFromHome(page: Page, boss?: string) {
  await openSoloBoss(page);
  if (boss) await page.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio", { name: boss, exact: true }).click();
  await page.getByRole("main").getByRole("button", { name: "START" }).click();
}

/**
 * The street town's look round: a drag by the mouse's left button across `box` from its middle, `share` of its width (negative:
 * leftward), at `yShare` of its height, in `steps` moves. The press and its first move go to the browser together (the DevTools
 * protocol's own mouse events), so no frame comes between them: on a slow software-WebGL runner a frame can take longer than the
 * street town's hold time (`streetHoldMs`, brief-street-controls-map.md), and a press held that long before it moves is a run.
 */
export async function lookDrag(page: Page, box: { x: number; y: number; width: number; height: number }, share: number, steps = 12, yShare = 0.35, pauseMs = 0) {
  const cdp = await page.context().newCDPSession(page);
  const y = Math.round(box.y + box.height * yShare);
  const x0 = box.x + box.width / 2;
  // (Positive `share` looks right: the finger moves left, pulling the world; Eric, Nov 6.)
  const at = (i: number) => Math.round(x0 - (share * box.width * i) / steps);
  const ev = (type: "mousePressed" | "mouseMoved" | "mouseReleased", x: number, buttons: number) =>
    cdp.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons, clickCount: type === "mouseMoved" ? 0 : 1, pointerType: "mouse" });
  await ev("mouseMoved", at(0), 0);
  // (The first move well past the town's drag threshold, `dragPx` 8, however short the steps: a drag from its first move.)
  const first = Math.abs(at(1) - at(0)) >= 16 || share === 0 ? at(1) : at(0) - Math.sign(share) * 16;
  await Promise.all([ev("mousePressed", at(0), 1), ev("mouseMoved", first, 1)]);
  for (let i = 2; i <= steps; i++) {
    await ev("mouseMoved", at(i), 1);
    if (pauseMs) await page.waitForTimeout(pauseMs);
  }
  await ev("mouseReleased", at(steps), 0);
  await cdp.detach();
}

/**
 * A quick tap by the mouse's left button at (x, y) in the street town: the press and the release go to the browser together, so no frame
 * comes between them (on a slow software-WebGL runner one frame can outlast the hold time, `streetHoldMs`, and the press would be a run).
 */
export async function quickTap(page: Page, x: number, y: number) {
  const cdp = await page.context().newCDPSession(page);
  const ev = (type: "mousePressed" | "mouseMoved" | "mouseReleased", buttons: number) =>
    cdp.send("Input.dispatchMouseEvent", { type, x: Math.round(x), y: Math.round(y), button: type === "mouseMoved" ? "none" : "left", buttons, clickCount: type === "mouseMoved" ? 0 : 1, pointerType: "mouse" });
  await ev("mouseMoved", 0);
  await Promise.all([ev("mousePressed", 1), ev("mouseReleased", 0)]);
  await cdp.detach();
}

/**
 * What `__townAt` finds in the street town: a boss or a home (by its id), the Colosseum, a statue, a table, a bot (by its index), a player,
 * or a square (`[c, r]`: "tap-square", the point of it a tap reaches; "square", its middle).
 */
export type TownThing = "boss" | "home" | "coliseum" | "statue" | "table" | "bot" | "player" | "tap-square" | "square";
/** A thing's id for `__townAt`: a home's or a boss's id, an index, a player's uid or a square. */
export type TownId = string | number | readonly [number, number];

/**
 * Where to tap a figure or a place in the street town once the view holds still (on the page): its tap point (`__townAt`, clear of
 * whatever stands in front, inside the canvas by 10 px and with nothing of the page laid over it) the same, within half a pixel, over 3
 * drawn frames in a row; null if it isn't drawn and clear then, or still
 * moving after `waitMs`. Counted in frames, not wall time: on CI's software WebGL under a full shard a frame can take a few hundred
 * milliseconds, and reads 100 ms apart saw a camera mid-glide as at rest (Nov 13, the street town for everyone).
 */
export async function townTapPoint(page: Page, kind: TownThing, id: TownId, waitMs = 3000, hold = false, still = 3): Promise<{ x: number; y: number } | null> {
  const xy = await page.evaluate(
    ([kind, id, waitMs, hold, still]) =>
      new Promise<{ x: number; y: number } | null>((done) => {
        const cv = document.querySelector<HTMLCanvasElement>("canvas.town-canvas");
        // (A point a finger reaches: 10 px inside the canvas, and the canvas itself under it, not a chip, the map, a button or a card
        // laid over it. Nov 13: Big Boy's Crib's point was at x 389.8 of a 390 px phone, so every tap missed it.)
        const at = () => {
          const p = (window as unknown as { __townAt?: (k: string, id: unknown) => { x: number; y: number } | null }).__townAt?.(kind, id) ?? null;
          if (!p || !cv) return null;
          const r = cv.getBoundingClientRect();
          if (p.x < 10 || p.y < 10 || p.x > r.width - 10 || p.y > r.height - 10) return null;
          return document.elementFromPoint(r.left + p.x, r.top + p.y) === cv ? p : null;
        };
        const until = performance.now() + waitMs;
        let last = at();
        let same = 0;
        const look = () => {
          const now = at();
          same = now && last && Math.hypot(now.x - last.x, now.y - last.y) < 0.5 ? same + 1 : 0;
          last = now;
          // (In the page's coordinates, read as it's found: the canvas's box can move as the page changes, out of a room say.)
          // (`still` 0: the first frame it's drawn and clear, for a figure that walks on whatever the view does: with `hold`, the tap
          // comes on that same frame anyway.)
          if (now && same >= still && cv) {
            // (`hold`: the town's frames held in this same frame (`__townHold`), so the frame on screen when the tap comes is the one
            // this point was read from. A figure walking about (Big Boy by his crib, a bot) moved off it between the read and the tap.)
            if (hold) (window as unknown as { __townHold?: (on: boolean) => void }).__townHold?.(true);
            done({ x: cv.getBoundingClientRect().left + now!.x, y: cv.getBoundingClientRect().top + now!.y });
          }
          else if (performance.now() > until) done(null);
          else requestAnimationFrame(look);
        };
        requestAnimationFrame(look);
      }),
    [kind, id, waitMs, hold, still] as const,
  );
  return xy;
}

/** The town's frames going again after `townTapPoint(…, hold)` (`__townHold(false)`; a page that has gone on is left alone). */
export const townLetGo = (page: Page) =>
  page.evaluate(() => (window as unknown as { __townHold?: (on: boolean) => void }).__townHold?.(false)).catch(() => undefined);

/**
 * A quick tap on a figure or a place in the street town, on the frame its point was read from (`townTapPoint` with `hold`): no frame
 * runs between the read and the tap, so nothing walks off the point first (Nov 14: Big Boy wandered in front of or behind his crib, a
 * bot stepped behind you, and the tap opened the crib's card or nothing). False if it isn't drawn and clear within `waitMs`.
 */
export async function townTap(page: Page, kind: TownThing, id: TownId, waitMs = 3000, still = 3): Promise<boolean> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const at = await townTapPoint(page, kind, id, waitMs, true, still);
    if (!at) return false;
    const ev = (type: "mousePressed" | "mouseReleased", buttons: number) =>
      cdp.send("Input.dispatchMouseEvent", { type, x: Math.round(at.x), y: Math.round(at.y), button: "left", buttons, clickCount: 1, pointerType: "mouse" });
    await Promise.all([ev("mousePressed", 1), ev("mouseReleased", 0)]);
    return true;
  } finally {
    await townLetGo(page);
    await cdp.detach().catch(() => undefined);
  }
}

/**
 * Opens `card` by a real tap on a figure or a place in the street town (Nov 13: one way for every spec, after taps on far figures and
 * homes failed on CI's software WebGL). Each try: another card open is closed; the view held still (`townTapPoint`); off the screen or
 * covered, the camera glides to `glide` once (a home's or a boss's id, as its chip would glide it, or a square) and the tap waits for it to
 * land; then a quick tap on the frame the point was read from (`townTap`: the press and the release together, so a slow frame between
 * them can't make it a run, and none between the read and the tap). A tap that misses walks you, the camera following: the next try glides
 * again. Returns once you've stopped walking with the card showing (it hides while its home is off the screen on the way).
 */
export async function tapInTown(page: Page, kind: TownThing, id: TownId, card: Locator, opts: { glide?: string | readonly [number, number] | null; timeout?: number } = {}) {
  const glide = opts.glide === undefined ? (kind === "boss" || kind === "home" ? String(id) : null) : opts.glide;
  await expect(async () => {
    if (await card.isVisible()) return;
    const open = page.locator(".town-card").filter({ visible: true });
    if (await open.count()) {
      await page.keyboard.press("Escape");
      await expect(open).toHaveCount(0, { timeout: 2000 });
    }
    // (The tap on the frame its point came from: `townTap`.)
    let tapped = await townTap(page, kind, id, 3000);
    if (!tapped && glide !== null) {
      await page.evaluate((to) => (window as unknown as { __townGlide?: (to: string | readonly [number, number]) => void }).__townGlide?.(to), glide);
      // (The glide across the street town: a few seconds of frames, longer on a slow runner.)
      tapped = await townTap(page, kind, id, 20_000);
    }
    expect(tapped, `${kind} ${id} drawn and clear, the view still`).toBe(true);
    await expect(card).toBeVisible({ timeout: 3000 });
    // (Open once you stand there. The tap walks you to it and the camera follows your walk, so a card whose home or figure leaves the
    // screen meanwhile is hidden until it's back (Town.tsx placeCard): shop:93 read a far home's "Go in" in that gap, Nov 14.)
    await expect.poll(() => page.evaluate(() => (window as unknown as { __townYou?: () => { moving: boolean } | null }).__townYou?.()?.moving ?? false), { timeout: 30_000 }).toBe(false);
    await expect(card).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: opts.timeout ?? 60_000 });
  return card;
}

/**
 * Runs `body` with the street town's frames held (`__townHold`), then lets them go: for a test that reads its own point on the canvas
 * (a building's edge, your pawn's box) and taps it, so the frame on screen when the tap comes is the one the point was read from
 * (Nov 14, round 5: the same race `townTap` closes, for points `__townAt` doesn't give).
 */
export async function townHeld<T>(page: Page, body: () => Promise<T>): Promise<T> {
  await page.evaluate(() => (window as unknown as { __townHold?: (on: boolean) => void }).__townHold?.(true));
  try {
    return await body();
  } finally {
    await townLetGo(page);
  }
}

/**
 * Waits until `read()` gives the same value (compared as JSON) for `ms` in a row, and returns it: for anything still moving when a test
 * looks (a camera's glide, a zoom, a layout after a resize or a font arriving), so the test measures or taps where the thing is, not
 * where it was a frame ago. Read about every 50 ms; fails after `timeout` if it never holds still. (Nov 13, "fix the cause": one helper
 * in place of fixed `waitForTimeout`s and one-off loops; docs/decisions/2026-11-14-flaky-causes.md.)
 */
export async function settled<T>(page: Page, read: () => Promise<T>, ms = 300, timeout = 20_000): Promise<T> {
  const until = Date.now() + timeout;
  let last = JSON.stringify(await read());
  let since = Date.now();
  for (;;) {
    await page.waitForTimeout(50);
    const now = await read();
    const key = JSON.stringify(now);
    if (key !== last) {
      last = key;
      since = Date.now();
    } else if (Date.now() - since >= ms) return now;
    if (Date.now() > until) throw new Error(`settled: still changing after ${timeout} ms (last: ${key.slice(0, 200)})`);
  }
}
