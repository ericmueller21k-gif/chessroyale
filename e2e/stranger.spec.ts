import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { localSql, openBossRaid, submitMove, test } from "./helpers.ts";

/**
 * The Stranger (Eric, Nov 27; docs/decisions/2026-11-27-stranger-rules.md), on a phone: his Frostfire strike (your piece frozen for your
 * next turn, thawed the turn after, then its square burns what's left on it), his locked card in the Boss Battle picker (a tap shows him
 * and how to unlock him, every way to play greyed), and the unlock once Battle Tower floor 10, his, is won (the server's best). Before his
 * art lands he's met with `?wip=1` (placeholders); the server's TEST_SWITCHES deals his floor the same way.
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase?.kind ?? "none").catch(() => "none");
type Turn = { fen: string; allowed: string[] | null; strike: { turn: number; square: string; frozenUntil: number; burnAt: number } | null; burn: { at: number; square: string; piece?: string } | null; turn: number; kinds: string[] };
const turnNow = (page: Page) =>
  page.evaluate(() => {
    const m = (window as any).match;
    if (m?.phase?.kind !== "play" || Date.now() < m.phase.startsAt + 300) return null;
    const p = m.boss?.powers;
    return { fen: m.phase.board.fen, allowed: p?.allowed ?? null, strike: p?.stranger?.strike ?? null, burn: p?.stranger?.burn ?? null, turn: p?.turn ?? 0, kinds: (p?.events ?? []).map((e: any) => e.kind) } as Turn;
  });

/** Waits for your turn (the board in play, settled), up to `ms`. */
async function yourTurn(page: Page, ms = 60_000): Promise<Turn> {
  let t: Turn | null = null;
  await expect.poll(async () => !!(t = await turnNow(page)), { timeout: ms }).toBe(true);
  return t!;
}

/** Your move: the first allowed move not from `keep` (a knight's if it can), never from `keep` unless nothing else can move. */
async function moveBut(page: Page, t: Turn, keep: string | null) {
  const legal = new Chess(t.fen).moves({ verbose: true }).map((m) => ({ uci: m.from + m.to + (m.promotion ?? ""), from: m.from, knight: m.piece === "n" }));
  const ok = legal.filter((m) => !t.allowed || t.allowed.includes(m.uci)).sort((a, b) => (a.uci < b.uci ? -1 : 1));
  const pick = ok.find((m) => m.from !== keep && m.knight) ?? ok.find((m) => m.from !== keep) ?? ok[0]!;
  await submitMove(page, pick.uci, t.fen);
}

test("his Frostfire on a phone: your piece frozen a turn (no move of it, its ice), thawed the next (its square ablaze), then the square burns it", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=stranger&wip=1&power=frostfire`);
  await openBossRaid(page);
  await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
  await expect.poll(() => phase(page), { timeout: 45_000 }).toBe("play");
  expect(await page.evaluate(() => (window as any).match.boss.id)).toBe("stranger");
  // Your moves until his strike stands (the test switch: from his first move).
  let t = await yourTurn(page);
  for (let i = 0; i < 6 && !t.strike; i++) {
    await moveBut(page, t, null);
    t = await yourTurn(page);
  }
  const st = t.strike!;
  expect(st, "his strike after his first move").toBeTruthy();
  expect(t.turn).toBe(st.turn);
  // Frozen: no move of it allowed, its ice on the board.
  expect((t.allowed ?? []).some((m) => m.startsWith(st.square))).toBe(false);
  await expect(page.locator(`.pw-ice[data-square="${st.square}"]`)).toBeVisible();
  const kind = new Chess(t.fen).get(st.square as any)!.type;
  await moveBut(page, t, st.square);
  // Thawed: its ice gone, its square ablaze (the fire tile, its countdown 1); its moves allowed again if it has any.
  t = await yourTurn(page);
  expect(t.turn).toBe(st.burnAt);
  await expect(page.locator(`.pw-ice[data-square="${st.square}"]`)).toHaveCount(0);
  await expect(page.locator(`.pw-frostfire[data-square="${st.square}"]`)).toBeVisible();
  const own = new Chess(t.fen).moves({ verbose: true }).filter((m) => m.from === st.square).map((m) => m.from + m.to + (m.promotion ?? ""));
  if (own.length) expect(t.allowed === null || own.some((m) => t.allowed!.includes(m))).toBe(true);
  // Left there: the square burns it as your move lands.
  const left = new Chess(t.fen).get(st.square as any);
  await moveBut(page, t, st.square);
  t = await yourTurn(page);
  expect(t.burn?.at).toBe(st.burnAt);
  expect(t.burn?.square).toBe(st.square);
  if (left && left.type !== "k" && t.burn?.piece === kind) expect(new Chess(t.fen).get(st.square as any)?.color ?? null).not.toBe("w");
  await expect(page.locator(`.pw-frostfire[data-square="${st.square}"]`)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("his locked card: a tap shows him and how to unlock him, every way to play greyed; won on Battle Tower floor 10 (his), he's yours to pick", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/?debug&wip=1`);
  await openBossRaid(page);
  const tiles = page.getByRole("radiogroup", { name: "Bosses" });
  const locked = tiles.getByRole("radio", { name: "Locked boss: The Stranger. Beat him on Battle Tower floor 10" });
  await expect(locked).toBeVisible();
  await expect(locked).toHaveClass(/bs-locked/);
  await locked.click();
  await expect(page.locator(".bs-name")).toHaveText("The Stranger");
  // (Every way to play: shown, greyed and locked, never hidden.)
  const alone = page.getByRole("main").getByRole("button", { name: /^Boss alone/ });
  await expect(alone).toBeVisible();
  await expect(alone).toBeDisabled();
  await expect(alone).toHaveClass(/rd-locked/);

  // Up the tower to floor 10 (the deal set to floor 9 in the local database), floor 9 won: the server deals floor 10, him alone.
  const made = await page.evaluate(async () => {
    const run = await fetch("/api/tower/run", { method: "POST", body: "{}", credentials: "same-origin", headers: { "content-type": "application/json" } });
    const me = await (await fetch("/api/me", { credentials: "same-origin" })).json();
    return { ok: run.ok, user: me.user.id as string };
  });
  expect(made.ok).toBe(true);
  const floors = Array.from({ length: 9 }, (_, i) => (i % 2 ? ["gingerbread"] : ["clown"]));
  await localSql(page, "UPDATE tower_runs SET floor = 9, met = ? WHERE user_id = ? AND status = 'open'", JSON.stringify({ floors, deck: [], decks: 1 }), made.user);
  const climb = () =>
    page.evaluate(async () => {
      const post = (path: string, body: object) => fetch(path, { method: "POST", body: JSON.stringify(body), credentials: "same-origin", headers: { "content-type": "application/json" } }).then((r) => r.json());
      const start = await post("/api/tower/floor/start", {});
      const end = await post("/api/tower/floor/finish", { fight: start.fight.id, outcome: "won" });
      const state = await (await fetch("/api/tower", { credentials: "same-origin" })).json();
      return { floor: start.floor as number, bosses: start.bosses as string[], best: end.best as number, next: state.runs.solo as { floor: number; bosses: string[] } | null };
    });
  const nine = await climb();
  expect([nine.floor, nine.best]).toEqual([9, 9]);
  expect(nine.next).toMatchObject({ floor: 10, bosses: ["stranger"] });
  const ten = await climb();
  expect([ten.floor, ten.bosses, ten.best]).toEqual([10, ["stranger"], 10]);
  // Back on the picker: his card unlocked, named as any other; a tap picks him, START's ways to play open.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Boss Battle", exact: true })).toBeVisible();
  const open = tiles.getByRole("radio", { name: "The Stranger", exact: true });
  await expect(open).toBeVisible({ timeout: 20_000 });
  await expect(open).not.toHaveClass(/bs-locked/);
  await open.click();
  await expect(page.locator(".bs-name")).toHaveText("The Stranger");
  await expect(page.getByRole("main").getByRole("button", { name: /^Boss alone/ })).toBeEnabled();
  // (Boss alone's menu lists him: the review of #1000 found it empty for a boss unlocked by a win.)
  await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
  await expect(page.locator(".boss-menu-list .boss-row:not(.match)")).toHaveCount(1);
  await expect(page.locator(".boss-menu-list .boss-row:not(.match)")).toContainText("The Stranger");
});
