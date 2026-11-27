// The e2e helpers every spec shares. Two rules for how a spec reaches its screens (the Nov 23 sweep's N5; .claude/LESSONS.md):
// - A test of what comes after a battle (the result screen, XP, rewards, quests, what's kept) ends it with `endBattle`; only a test of
//   playing a battle plays it to its end. Playing real moves to reach the end assumes how long the battle lasts.
// - A move a spec just needs comes from `pickMove` (never a mate let in), played with `submitMove`.
import { resolve } from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { Chess, type Move } from "chess.js";

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

/**
 * The renderer watchdog (Nov 24; docs/decisions/2026-11-24-renderer-watchdog.md). Twice in CI (moo.spec Nov 20, boss-bar.spec Nov 24) a
 * 5 s expect ran for minutes, to the test's timeout, with no trace: Playwright's expect makes its first check without any timeout, so a
 * page whose main thread never answers holds it until the test times out. This names the code: the test's page is pinged every
 * `HANG_PING_MS`; a ping unanswered for `HANG_AFTER_MS` pauses the page's script (Debugger.pause reaches a busy main thread, where an
 * evaluate can't), and its stack, with the code around each place, is attached to the test ("renderer-hang") and printed to the log.
 * The session and its Debugger domain are opened with the page: once the page hangs, a new one gets no answer. A test that times
 * out with the page still answering says so too (then it was Playwright's wait, not the page). Nothing is checked or failed here, and
 * the `@perf` specs aren't watched (nothing extra in the frames they time).
 */
const HANG_PING_MS = 10_000;
const HANG_AFTER_MS = 30_000;
async function watchRenderer(page: Page, testInfo: import("@playwright/test").TestInfo): Promise<() => Promise<void>> {
  // (Not the frame-budget specs: nothing extra in the page they time.)
  if (testInfo.tags.includes("@perf") || /@perf\b/.test(testInfo.titlePath.join(" "))) return async () => {};
  let cdp: import("@playwright/test").CDPSession;
  try {
    cdp = await page.context().newCDPSession(page);
    await cdp.send("Debugger.enable");
  } catch {
    return async () => {};
  }
  /** The unanswered ping's time (null: none out), the last answer, and the hang once seen (its start; `pausing` while its stack is read). */
  let waiting: number | null = null;
  let answered = Date.now();
  let hung: number | null = null;
  let pausing = false;
  let recovered = false;
  let stopped = false;
  const report = (text: string) => {
    console.error(`[renderer-hang] ${testInfo.titlePath.join(" › ")}\n${text}`);
    void testInfo.attach("renderer-hang", { body: text, contentType: "text/plain" }).catch(() => {});
  };
  type Paused = { callFrames: { functionName: string; url: string; location: { scriptId: string; lineNumber: number; columnNumber?: number } }[] };
  const snapshot = async (since: number) => {
    pausing = true;
    const head = `The page didn't answer for ${Math.round((Date.now() - since) / 1000)} s (${page.url()}).`;
    const paused = new Promise<Paused>((r) => cdp.once("Debugger.paused", r));
    const got = await Promise.race([cdp.send("Debugger.pause").then(() => paused), new Promise<null>((r) => setTimeout(() => r(null), 10_000))]).catch(() => null);
    if (stopped) return;
    if (!got) report(`${head} It didn't pause either: no script running (stuck in the browser's own work: layout, painting, decoding), or the browser itself stuck.`);
    else {
      const lines = [`${head} Its script's stack:`];
      const sources = new Map<string, Promise<string[]>>();
      for (const f of got.callFrames.slice(0, 12)) {
        const { scriptId, lineNumber: ln, columnNumber: col = 0 } = f.location;
        if (!sources.has(scriptId)) sources.set(scriptId, cdp.send("Debugger.getScriptSource", { scriptId }).then((x) => x.scriptSource.split("\n"), () => []));
        const src = (await sources.get(scriptId)!)[ln] ?? "";
        lines.push(`  at ${f.functionName || "(anonymous)"} ${f.url || "(no url)"}:${ln + 1}:${col + 1}`, `     ${src.slice(Math.max(0, col - 160), col)}⟦here⟧${src.slice(col, col + 160)}`);
      }
      await cdp.send("Debugger.resume").catch(() => {});
      report(lines.join("\n"));
    }
    // (Pings again from here: the one out was answered by the pause, not by the page.)
    pausing = false;
    waiting = null;
  };
  const tick = setInterval(() => {
    if (pausing) return;
    if (waiting === null) {
      const at = (waiting = Date.now());
      // (An answer, or an error (a page loading again has no context for a moment): either way the renderer answered.)
      const back = () => {
        if (stopped || pausing || waiting !== at) return;
        answered = Date.now();
        waiting = null;
        // (A hang that ends: how long it lasted, so a slow stretch reads apart from an endless one.)
        if (hung !== null && !recovered) (recovered = true), report(`The page answered again ${Math.round((answered - hung) / 1000)} s after it stopped answering.`);
      };
      void cdp.send("Runtime.evaluate", { expression: "0" }).then(back, back);
    } else if (hung === null && Date.now() - waiting >= HANG_AFTER_MS) {
      hung = waiting;
      void snapshot(waiting);
    }
  }, HANG_PING_MS);
  return async () => {
    stopped = true;
    clearInterval(tick);
    if (testInfo.status === "timedOut" && hung === null)
      report(`The test timed out with the page still answering (its last answer ${Math.round((Date.now() - answered) / 1000)} s before the end; ${page.url()}): not a renderer hang.`);
    // (Not waited on past a moment: a hung page may never let the session go.)
    await Promise.race([cdp.detach().catch(() => {}), new Promise((r) => setTimeout(r, 2000))]);
  };
}

export const test = base.extend<{ closeOwnContexts: void; tutorialSeen: boolean; seenDefaultForTest: void; seenWalkthrough: void; questsSeen: boolean; questsSeenForTest: void; seenQuests: void }>({
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
  // (The test's page, watched for a hang: watchRenderer.)
  // (Opened alongside the test, not before it: nothing waits on it.)
  page: async ({ page }, use, testInfo) => {
    const watching = watchRenderer(page, testInfo);
    await use(page);
    await (await watching)();
  },
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
 * Your move for a test that only needs the game to go on: a legal one the game takes (`allowed`: a boss power's list, as `lan`; null is
 * every move), quiet when it can be (no capture, no promotion), `prefer`'s first, and never one that lets the other side mate at once
 * while another move doesn't. Each spec once picked its own, and each missed a case: a frozen piece (Oct 15), no quiet move left (boss-bar,
 * Nov 20), and a mate: recluse's a3, a4, a5, a6 against the Hidden Boss's child let in Qxf2#, and the match ended before the test's
 * Win this form (Nov 20). One picker for every spec that just needs a move.
 */
export function pickMove(fen: string, { allowed = null, prefer }: { allowed?: readonly string[] | null; prefer?: (m: Move) => boolean } = {}): string {
  const c = new Chess(fen);
  const legal = c.moves({ verbose: true }).filter((m) => !allowed || allowed.includes(m.lan));
  if (!legal.length) throw new Error(`pickMove: no move the game takes in ${fen}`);
  const quiet = (m: Move) => !m.captured && !m.promotion;
  const rank = (m: Move) => (quiet(m) ? (prefer?.(m) ? 0 : 1) : 2);
  // (A stable order: chess.js's own within each rank.)
  const order = legal.map((m, i) => ({ m, i })).sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i).map((x) => x.m);
  const letsMate = (m: Move) => {
    c.move({ from: m.from, to: m.to, promotion: m.promotion });
    const mate = c.moves({ verbose: true }).some((r) => {
      c.move({ from: r.from, to: r.to, promotion: r.promotion });
      const over = c.isCheckmate();
      c.undo();
      return over;
    });
    c.undo();
    return mate;
  };
  return (order.find((m) => !letsMate(m)) ?? order[0]!).lan;
}

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
 * Ends the current solo boss battle with `outcome`, through the same end a real one takes (the result screen, its XP, quests and rewards,
 * a tower floor's write, the kept game cleared): the hook behind the admins' 🏆 "Win this match" (#846; SoloMatch.forceEnd, which adds a
 * loss and a draw for tests only), then one move of yours (pickMove), on which it ends. Waits for the results. Needs `?debug` and the
 * page made an admin (`asAdmin`) before it loads, as the 🏆 does; Boss alone, a solo raid or a solo tower floor, not online.
 * **A test of what comes after a battle ends it with this; only a test of playing a battle plays it to its end** (the Nov 23 sweep's N5:
 * specs that played real moves to reach a screen assumed how long the battle lasts, and any engine or boss change ended it a move early or
 * late, "play" against "results").
 */
export async function endBattle(page: Page, outcome: "win" | "loss" | "draw") {
  const kind = () => page.evaluate(() => (window as any).match?.phase?.kind ?? null);
  await expect.poll(kind, { timeout: 60_000 }).toBe("play");
  const result = { win: "crowd", loss: "boss", draw: "draw" }[outcome];
  const s = await page.evaluate((r) => {
    const m = (window as any).match;
    if (!m?.winFormShown || m.phase.kind !== "play") return null;
    m.forceEnd(r);
    return { fen: m.phase.board.fen as string, allowed: (m.runner.crowdAllowed() ?? null) as string[] | null };
  }, result);
  if (!s) throw new Error("endBattle: no end hook here (a solo boss battle, ?debug, and asAdmin before the page loads)");
  await submitMove(page, pickMove(s.fen, { allowed: s.allowed }), s.fen);
  await expect.poll(kind, { timeout: 120_000 }).toBe("results");
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

/**
 * The match's screens are in (packages/app/src/lazy-game.ts: their chunk, off the first load since Nov 10, every boss's code with it
 * since Nov 16). Home loads them a moment after it shows, or at once when play is next (the Bot level box, Play with friends, the Boss
 * Battle screen), as a player has them by the time they tap on. A test taps on within that moment, and on a busy runner the chunk's
 * work (a second or more) then fell inside the next step's wait (Nov 17: solo:80/151, chat-mod:31, boss-select:304/375). So the
 * helpers that open those wait here once, before the tap into the match, never a longer timeout per test.
 */
export async function matchScreens(page: Page) {
  await page.locator("html[data-match-chunk]").waitFor({ state: "attached", timeout: 30_000 });
}

/** The Bot level box (PLAY with Bots): its OK, picking Medium first when nothing is picked. */
export async function startBotLevel(page: Page) {
  const box = page.getByRole("dialog", { name: "Bot level" });
  await box.waitFor();
  const ok = box.getByRole("button", { name: "OK", exact: true });
  if (await ok.isDisabled()) await box.getByRole("radio", { name: /^Medium/ }).click();
  await matchScreens(page);
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
  await matchScreens(page);
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
export async function asSignedIn(page: Page, label = "player", opts: { welcomeNotice?: boolean } = {}) {
  return withEmail(page, `${label}-${test.info().project.name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.test`, opts);
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

/**
 * Puts `email` on this page's account in the local database (taking it off any other account first). Answers the id. A signed-in
 * account's first visit is given its first Welcome Crate, with a one-time notice over home (Nov 27, welcome-crate.spec.ts): given and
 * closed here (its /api/me, then "seen"), so it never covers what a test taps; `welcomeNotice` leaves it to show.
 */
async function withEmail(page: Page, email: string, opts: { welcomeNotice?: boolean } = {}) {
  const id = await pageAccountId(page);
  await localSql(page, `UPDATE users SET email = NULL WHERE email = '${email}'; UPDATE users SET email = '${email}' WHERE id = '${id}'`);
  if (!opts.welcomeNotice) {
    await page.request.get("/api/me");
    await page.request.post("/api/locker/welcome/seen", { data: {} });
  }
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
  await matchScreens(page);
}

/** Home → Boss Battle's card → its screen: the tiles, the stage and START (Eric, Oct 26; renamed Oct 29). */
export async function openSoloBoss(page: Page) {
  await page.getByRole("main").getByRole("button", { name: /^Boss Battle/ }).click();
  await expect(page.getByRole("heading", { name: "Boss Battle", exact: true })).toBeVisible();
  await matchScreens(page);
}

/**
 * A deploy landed (as the page will find out): the server's `/version.json` names another build than the page's. With a file of the game
 * refused, this stages a deploy's missing file; a file refused without it is a dropped connection, which loads the page again only if
 * its try again fails too, keeping the screen (stale.ts, Nov 25: the Boss Battle screen thrown back to home by one, main's run
 * 45559755980; older Chromium's kept failure, #942).
 */
export async function aDeployLanded(page: Page) {
  await page.route(/\/version\.json$/, (r) => r.fulfill({ json: { version: "0123456789ab", commit: null, built: new Date().toISOString() } }));
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
 * `gone`: null as soon as it hasn't been drawn and clear for that many frames in a row, not after the whole `waitMs`: for a caller with
 * another way to bring it into view (tapInTown's glide). Nov 16: tapInTown's first try at a home off the screen waited its full 3 s,
 * 22 times in one run of shop.spec on a phone, before the glide that brings it in.
 */
export async function townTapPoint(page: Page, kind: TownThing, id: TownId, waitMs = 3000, hold = false, still = 3, gone = Infinity): Promise<{ x: number; y: number } | null> {
  const xy = await page.evaluate(
    ([kind, id, waitMs, hold, still, gone]) =>
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
        let missing = last ? 0 : 1;
        const look = () => {
          const now = at();
          same = now && last && Math.hypot(now.x - last.x, now.y - last.y) < 0.5 ? same + 1 : 0;
          missing = now ? 0 : missing + 1;
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
          else if ((gone > 0 && missing >= gone) || performance.now() > until) done(null);
          else requestAnimationFrame(look);
        };
        requestAnimationFrame(look);
      }),
    // (-1: no limit.)
    [kind, id, waitMs, hold, still, Number.isFinite(gone) ? gone : -1] as const,
  );
  return xy;
}

/** The town's frames going again after `townTapPoint(…, hold)` (`__townHold(false)`; a page that has gone on is left alone). */
export const townLetGo = (page: Page) =>
  page.evaluate(() => (window as unknown as { __townHold?: (on: boolean) => void }).__townHold?.(false)).catch(() => undefined);

/**
 * A quick tap on a figure or a place in the street town, on the frame its point was read from (`townTapPoint` with `hold`): no frame
 * runs between the read and the tap, so nothing walks off the point first (Nov 14: Big Boy wandered in front of or behind his crib, a
 * bot stepped behind you, and the tap opened the crib's card or nothing). False if it isn't drawn and clear within `waitMs` (or for
 * `gone` frames in a row: townTapPoint).
 */
export async function townTap(page: Page, kind: TownThing, id: TownId, waitMs = 3000, still = 3, gone = Infinity): Promise<boolean> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const at = await townTapPoint(page, kind, id, waitMs, true, still, gone);
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
    // (The tap on the frame its point came from: `townTap`. With a glide to fall back on, a thing not drawn and clear for 6 frames in a
    // row goes to the glide at once: off the screen, it won't come in by itself.)
    let tapped = await townTap(page, kind, id, 3000, 3, glide !== null ? 6 : Infinity);
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

/**
 * Real computer screens (Nov 25; docs/decisions/2026-11-25-real-screens.md). Computer layouts were built and checked at 1280 × 800,
 * 1440 × 900 and 1920 × 1080 only; a 1080p laptop at Windows' recommended 125% (Eric's) gives a window about 1536 × 730, shorter than any
 * of them, so boards sized "height − 170" shrank and pages laid out for 800 px scrolled. Every computer layout check runs at these too,
 * each with its own device scale (the board's size is a whole number of device pixels). Named by what they are: never "a computer".
 */
export const REAL_SCREENS = [
  { name: "laptop 1536×730", width: 1536, height: 730, scale: 1.25, what: "a 1080p laptop at Windows' recommended 125% (Eric's)" },
  { name: "laptop 1280×600", width: 1280, height: 600, scale: 1.5, what: "a 1080p laptop at 150%" },
  { name: "laptop 1366×650", width: 1366, height: 650, scale: 1, what: "a 768p laptop at 100%" },
  { name: "desktop 1920×960", width: 1920, height: 960, scale: 1, what: "a 1080p desktop at 100%, a maximized browser" },
] as const;
export type RealScreen = (typeof REAL_SCREENS)[number];

/** A chess.com-style name bar's height (the 1 v 1's strip over and under the board): the board-size target counts two of them. */
export const NAME_BAR_PX = 34;
/** The board's target on a real screen (Nov 25 brief): the window's height less two name bars and 40 px. */
export const boardTarget = (s: RealScreen) => s.height - 2 * NAME_BAR_PX - 40;

/** A window on a real screen: its size and device scale, a computer's mouse. */
export const realScreenContext = (browser: import("@playwright/test").Browser, s: RealScreen) =>
  browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.scale, isMobile: false, hasTouch: false });

/**
 * One screen's layout, measured: how far the page scrolls each way, every element of the screen cut off at the window's top (its
 * selector-ish name), each chat's message area (`.qfeed`: its height), the game's board and the end page's move-by-move board (boxes).
 */
export async function realLayout(page: Page) {
  return page.evaluate(() => {
    const box = (e: Element | null) => {
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return b.width > 0 && b.height > 0 ? { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height } : null;
    };
    const shown = (e: Element) => {
      const s = getComputedStyle(e);
      return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0;
    };
    const name = (e: Element) => `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`;
    const screen = document.querySelector(".screen");
    const cut = screen
      ? [screen, ...screen.querySelectorAll("*")].filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && b.height > 0 && b.top < -1 && shown(e) && getComputedStyle(e).position !== "fixed";
        })
      : [];
    return {
      scrollX: document.documentElement.scrollWidth - innerWidth,
      scrollY: document.documentElement.scrollHeight - innerHeight,
      cut: cut.slice(0, 6).map(name),
      feeds: [...document.querySelectorAll(".qchat .qfeed")].filter(shown).map((e) => e.getBoundingClientRect().height),
      board: box(document.querySelector(".board-area .board-row > .board-wrap .hb-container")),
      review: box(document.querySelector(".results-review .hb-container")),
      reviewCol: box(document.querySelector(".results-review")),
    };
  });
}

/**
 * An end screen's spacing (Eric, Nov 25: "Make things spaced evenly and tight, and then we can always just center the whole thing";
 * docs/decisions/2026-11-25-end-screens-2.md): the containers of its stack (`root`'s children, through `display: contents` wrappers and
 * the rewards' column), each gap between two in a row, the stack's one gap (its row gap: `--es-gap`), and anything set to stretch (a
 * container that grows, a stack that spreads its items). The gap in the screen's px: a zoomed stack's (a computer's boss result on a
 * short window, Nov 25) scaled with it.
 */
export async function endGaps(page: Page, root: string) {
  return page.evaluate((sel) => {
    const top = document.querySelector(sel)!;
    const flat = (e: Element): Element[] =>
      [...e.children].flatMap((c) => {
        const s = getComputedStyle(c);
        if (s.display === "contents" || c.classList.contains("es-rewards")) return flat(c);
        if (s.display === "none" || s.position === "absolute" || s.position === "fixed") return [];
        const b = c.getBoundingClientRect();
        return b.height > 0 && b.width > 0 ? [c] : [];
      });
    const items = flat(top);
    const name = (e: Element) => `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`;
    const gaps = items.slice(1).map((e, i) => ({ between: `${name(items[i]!)} → ${name(e)}`, px: e.getBoundingClientRect().top - items[i]!.getBoundingClientRect().bottom }));
    const spread = [top, ...top.querySelectorAll(".es-rewards")].map((e) => getComputedStyle(e).justifyContent).filter((j) => /space-|stretch/.test(j));
    const grow = items.filter((e) => Number(getComputedStyle(e).flexGrow) > 0 && !e.classList.contains("results-review")).map(name);
    return { token: parseFloat(getComputedStyle(top).rowGap) * (parseFloat(getComputedStyle(top).zoom) || 1), gaps, spread, grow };
  }, root);
}
