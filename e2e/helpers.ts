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

/** Home → Matchmaking: Solo → PLAY (in the mode the URL or the picker chose): you and bots, after the seats fill. */
export async function soloFromHome(page: Page) {
  await page.getByRole("radio", { name: /^Solo/ }).click();
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
}

/** Home → Play with friends → Create a lobby (or a raid). */
export async function createLobbyFromHome(page: Page) {
  // (The home screen's button: on a computer the side menu has one too.)
  await page.getByRole("main").getByRole("button", { name: "Play with friends" }).click();
  await page.getByRole("button", { name: /^Create a (lobby|raid|Classic lobby)$/ }).click();
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
