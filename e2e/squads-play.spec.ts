import { expect, type Browser, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOARD_SEL, expectCoordsInSquares, named, test, watchFor } from "./helpers.ts";

/**
 * Squads played through its screens, on the real server (wrangler dev, SQUADS_TEST on) with its bots: test lobbies
 * straight at Pairs and at the final, a Relay half, the test control "Next round", the party, and the mode's sounds.
 * Every move is a real tap on the board. On a phone and a computer (docs/areas/squads.md, "The screens").
 */

const run = Date.now().toString(36).slice(-5);

interface Seen {
  phase: string | null;
  key: string | null;
  state: string | null;
  seq: number | null;
  duty: { board: number; role: "move" | "pick" | "block"; partner: string | null } | null;
  fen: string | null;
  mine: string | null;
  partner: string | null;
  locked: boolean;
}

/** What the page's Squads client says about you now (your squad's live match, your duty in its half). */
const seen = (page: Page): Promise<Seen> =>
  page.evaluate(() => {
    const s = (window as any).squads;
    if (!s?.lobby) return { phase: null, key: null, state: null, seq: null, duty: null, fen: null, mine: null, partner: null, locked: false };
    const m = [...s.matches.values()].find((x: any) => x.state !== "over" && x.sides.some((sd: any) => sd.seats.includes(s.myId)));
    const d = m?.state === "half" ? m.current?.duties.find((x: any) => x.players.includes(s.myId)) : null;
    const partner = d?.players.find((x: string) => x !== s.myId) ?? null;
    return {
      phase: s.lobby.phase,
      key: m?.key ?? null,
      state: m?.state ?? null,
      seq: m?.current?.seq ?? null,
      duty: d ? { board: d.board, role: d.role, partner } : null,
      fen: d ? m.boards[d.board].fen : null,
      mine: m ? (m.visible[s.myId] ?? null) : null,
      partner: partner && m ? (m.visible[partner] ?? null) : null,
      locked: !!m?.locked.includes(s.myId),
    };
  });

/** A tap on a square of the big board (its squares' own box, either way up). */
async function tapSquare(page: Page, sq: string) {
  const box = (await page.locator(`.board-area ${BOARD_SEL.squares}`).boundingBox())!;
  const black = await page.locator(`.board-area ${BOARD_SEL.wrap}`).evaluate((el) => el.classList.contains("orientation-black"));
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const x = black ? 7 - f : f;
  const y = black ? r : 7 - r;
  await page.mouse.click(box.x + (x + 0.5) * (box.width / 8), box.y + (y + 0.5) * (box.height / 8));
}

/** A move made the way a player makes it: tap the piece, tap its square. */
async function tapMove(page: Page, uci: string) {
  await tapSquare(page, uci.slice(0, 2));
  await tapSquare(page, uci.slice(2, 4));
}

const legal = (fen: string) => new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));

/** Waits for a half that asks something of you (a move, a pick or a block) in a new half. */
async function nextDuty(page: Page, after: string | null, timeout = 90_000): Promise<Seen> {
  let s: Seen | null = null;
  await expect
    .poll(
      async () => {
        s = await seen(page);
        return !!s.duty && `${s.key}/${s.seq}` !== after;
      },
      { timeout, intervals: [250] },
    )
    .toBe(true);
  return s!;
}

/** Into a test lobby (the test controls' link), past the votes ("Skip votes": the test control in the votes). */
async function testLobby(page: Page, start: "relay" | "pairs" | "final", clock = "90,0,3,0") {
  await named(page, "Tess");
  await page.addInitScript(() => ((window as any).__soundLog = []));
  await page.goto(`/squads/test/${start}?nolanding&debug&clock=${clock}`);
  // The waiting room: a test lobby fills with bots a few seconds after it opens.
  await expect(page.locator(".fd-queue-mode")).toHaveText("Squads · 8 squads of 4", { timeout: 20_000 });
  await expect(page.locator(".fd-queue-line")).toContainText(/Test lobby|Squads formed/);
  await expect(page.getByRole("button", { name: "Skip votes" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".vote-title h1")).toHaveText("How do the boards start?");
  await page.getByRole("button", { name: "Skip votes" }).click();
  await expect.poll(async () => (await seen(page)).phase, { timeout: 20_000 }).toBe("bracket");
}

/** No sideways scroll, and every squad's short name whole in the phone's strip. */
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  const cut = await page.locator(".sq-strip-name").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0 && e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent));
  expect(cut).toEqual([]);
}

test("Pairs (a test lobby): your partner's pick shows live, you can't take it, lock in, then the coin-flip reveal; Next round moves on", async ({ page }) => {
  test.setTimeout(240_000);
  await testLobby(page, "pairs");
  // Every squad's clock is on screen (the strip on a phone, the side panel on a computer).
  const standings = page.locator(test.info().project.name === "desktop" ? ".sq-side .sq-row" : ".sq-strip-chip");
  await expect(standings).toHaveCount(8);
  const s = await nextDuty(page, null);
  expect(s.duty!.role).toBe("pick");
  await expect(page.locator(".sq-status")).toContainText(/^Pick with /);
  await expect(page.locator(".sq-mark.you")).toBeVisible();
  // The tiny boards wait until you've locked in.
  await expect(page.locator("button.sq-tiny")).toHaveCount(0);
  await fits(page);
  // Your partner (a bot) picks within its thinking time: it shows live.
  await expect.poll(async () => (await seen(page)).partner, { timeout: 30_000 }).not.toBeNull();
  const partner = (await seen(page)).partner!;
  await expect(page.locator(".sq-choice.partner strong")).not.toHaveText("thinking…");
  // Their move can't be picked: the board doesn't take it.
  await tapMove(page, partner);
  await page.waitForTimeout(400);
  expect((await seen(page)).mine).not.toBe(partner);
  // Yours: tap it, then lock in.
  // (A different piece from theirs: tapping theirs left it picked up, and a second tap on it would put it down.)
  const mine = legal(s.fen!).find((m) => m.slice(0, 2) !== partner.slice(0, 2) && m.length === 4)!;
  const reveal = await watchFor(page, {
    flipping: { selector: ".sq-status", text: /Flipping the coin/ },
    coin: { selector: ".sq-status", text: /The coin plays/ },
    ghosts: { selector: ".shade-layer piece.shade" },
  });
  await tapMove(page, mine);
  await expect.poll(async () => (await seen(page)).mine).toBe(mine);
  await expect(page.locator(".sq-choice.you strong")).not.toHaveText(/tap a/);
  await page.getByRole("button", { name: "Lock in my pick" }).click();
  // Locked in (or, everyone else in already, the half is over at once): the tiny boards open.
  await expect.poll(async () => (await seen(page)).locked || (await seen(page)).seq !== s.seq || (await seen(page)).state !== "half").toBe(true);
  await expect(page.locator("button.sq-tiny").first()).toBeVisible();
  // The reveal: both picks slide in as ghosts with their pickers' names, the coin lands, the move plays.
  await expect.poll(() => reveal.seen(), { timeout: 40_000 }).toEqual({ flipping: true, coin: true, ghosts: true });
  // The move it played made the normal move sound.
  await expect.poll(() => page.evaluate(() => (window as any).__soundLog.some((l: string) => /^(move|capture|castle):/.test(l))), { timeout: 10_000 }).toBe(true);
  // Next round (the test control): this round ends now; your squad is out (the card) or through to the final.
  const next = await watchFor(page, { out: { selector: ".sq-out .sq-card-title", text: /Knocked out/ }, final: { selector: ".sq-banner-title", text: /SQUAD FINAL/ } });
  await page.getByRole("button", { name: "Next round" }).click();
  await expect.poll(async () => Object.values(await next.seen()).some(Boolean), { timeout: 20_000 }).toBe(true);
  await fits(page);
});

test("the final (a test lobby): pick or block, blocks in red for everyone, lock in, the lock slams down, then the coin", async ({ page }) => {
  test.setTimeout(300_000);
  await testLobby(page, "final");
  const reveal = await watchFor(page, {
    intro: { selector: ".sq-banner-title", text: /SQUAD FINAL/ },
    lock: { selector: ".sq-lock" },
    picks: { selector: ".sq-status", text: /Two picks, two blocks/ },
    decided: { selector: ".sq-status", text: /plays/ },
  });
  const roles = new Set<string>();
  let last: string | null = null;
  for (let i = 0; i < 6 && !(roles.has("pick") && roles.has("block") && (await reveal.seen()).lock); i++) {
    const s = await nextDuty(page, last, 120_000);
    last = `${s.key}/${s.seq}`;
    roles.add(s.duty!.role);
    await expect(page.locator(".sq-status")).toContainText(s.duty!.role === "pick" ? /^Pick with / : /^Block with /);
    if (s.duty!.role === "block") await expect(page.locator(".sq-duty.block")).toBeVisible();
    // Your partner's choice shows live (a pick to its squad; a block to everyone, in red).
    await expect.poll(async () => (await seen(page)).partner, { timeout: 30_000 }).not.toBeNull();
    const partner = (await seen(page)).partner!;
    const mine = legal(s.fen!).find((m) => m !== partner && m.length === 4)!;
    await tapMove(page, mine);
    await expect.poll(async () => (await seen(page)).mine).toBe(mine);
    await page.getByRole("button", { name: s.duty!.role === "pick" ? "Lock in my pick" : "Lock in my block" }).click();
    await expect.poll(async () => {
      const now = await seen(page);
      return now.locked || `${now.key}/${now.seq}` !== last || now.state !== "half";
    }).toBe(true);
  }
  expect([...roles].sort()).toEqual(["block", "pick"]);
  await expect.poll(() => reveal.seen(), { timeout: 60_000 }).toEqual({ intro: true, lock: true, picks: true, decided: true });
  await fits(page);
  // Next round ends the final: the results, every squad placed.
  await page.getByRole("button", { name: "Next round" }).click();
  await expect(page.locator(".sq-places li")).toHaveCount(8, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Play again|Back to your party/ })).toBeVisible();
});

test("Relay (a test lobby): your move on your board shows at once, then the tiny boards open; watch one, back to your board", async ({ page }) => {
  test.setTimeout(240_000);
  await testLobby(page, "relay");
  const s = await nextDuty(page, null);
  expect(s.duty!.role).toBe("move");
  await expect(page.locator(".sq-status")).toContainText(/^Your move · Board \d/);
  // Every board in the lobby: 16 tiny boards, yours marked.
  await expect(page.locator(".sq-tiny")).toHaveCount(16);
  await expect(page.locator(".sq-mark.you")).toHaveCount(1);
  await expect(page.locator(".sq-mark.next")).toHaveCount(1);
  await expect(page.locator("button.sq-tiny")).toHaveCount(0);
  await fits(page);
  const mine = legal(s.fen!).find((m) => m.length === 4)!;
  const moved = await watchFor(page, { moved: { selector: ".sq-status", text: /^Moved · Board/ }, played: { selector: ".sq-duty strong", text: /^You played / } });
  await tapMove(page, mine);
  // At once: your move is on your board (it stays there: nothing snaps back while the half runs).
  await expect.poll(() => moved.seen(), { timeout: 5000 }).toEqual({ moved: true, played: true });
  // The tiny boards are tappable now: watch another board full size, then back.
  const others = page.locator("button.sq-tiny:not(.is-you)");
  await expect(others.first()).toBeVisible();
  // The big board's coordinates sit in their own squares, either way up (the letters were a column off): on your board,
  // then on next turn's, where your squad has the other colour, so it opens the other way up.
  const up = await expectCoordsInSquares(page);
  await page.locator("button.sq-tiny:has(.sq-mark.next)").click();
  await expectCoordsInSquares(page, up === "white" ? "black" : "white");
  await others.nth(3).click();
  await expect(page.locator(".sq-status")).toContainText(/^Watching Board \d|is over/);
  await page.getByRole("button", { name: "Back to my board" }).click();
  await expect(page.getByRole("button", { name: "Back to my board" })).toHaveCount(0);
  // The half resolves: your move stays on the board, and the bot work came from this device.
  await expect.poll(async () => (await seen(page)).state, { timeout: 40_000 }).not.toBe("half");
  await expect.poll(() => page.evaluate(() => (window as any).squads.botAnswers), { timeout: 30_000 }).toBeGreaterThan(0);
});

test("the party: one makes it, a friend joins by link, the leader presses PLAY, both sit in one squad", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const pool = `sqp-${run}-${test.info().project.name}`;
  await named(page, "Ann");
  await page.goto(`/?nolanding&debug&pool=${pool}`);
  await page.getByRole("radio", { name: /Squads/ }).click();
  await expect(page.locator(".fd-hint")).toHaveText(/^Solo queue: you join a squad of 4/);
  await page.getByRole("button", { name: /^Party/ }).click();
  const sheet = page.getByRole("dialog", { name: "Squads party" });
  await sheet.getByRole("button", { name: "Create a party" }).click();
  const code = (await page.locator(".sq-invite-code").textContent({ timeout: 15_000 }))!.trim();
  expect(code).toMatch(/^[A-Z2-9]{5}$/);
  await expect(page.locator(".sq-party-members li:not(.empty)")).toHaveCount(1);
  // A friend opens the invite link: the join form, with the code filled in.
  const friend = await (await newPlayer(browser, test.info().project.name)).newPage();
  await named(friend, "Bo");
  await friend.goto(`/squads/party/${code}?nolanding&debug&pool=${pool}`);
  const join = friend.getByRole("dialog", { name: "Squads party" });
  await expect(join.getByLabel("Party code")).toHaveValue(code);
  await join.getByRole("button", { name: "Join party" }).click();
  await expect(page.locator(".sq-party-members li:not(.empty)")).toHaveCount(2);
  await expect(friend.locator(".sq-party-state")).toContainText("Waiting for Ann to press PLAY");
  // The leader queues everyone: both land in one lobby, in one squad, once bots fill it.
  await page.getByRole("button", { name: /^PLAY · 2 players/ }).click();
  for (const p of [page, friend]) await expect(p.locator(".fd-queue-mode")).toHaveText("Squads · 8 squads of 4", { timeout: 20_000 });
  const lobby = async (p: Page) => p.evaluate(() => (window as any).squads?.code ?? null);
  expect(await lobby(page)).toBe(await lobby(friend));
  await expect(page.locator(".fd-queue-rank")).toHaveText("Your party sits together in one squad", { timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => (window as any).squads.lobby.squads.length), { timeout: 30_000 }).toBe(8);
  const squadOf = (p: Page) => p.evaluate(() => (window as any).squads.mySquad?.id ?? null);
  expect(await squadOf(page)).not.toBeNull();
  expect(await squadOf(page)).toBe(await squadOf(friend));
  await fits(page);
});

test("sounds: ticks in the last free seconds, a sting at sudden death, quieter than a move, and silent when muted", async ({ page }) => {
  test.setTimeout(240_000);
  // A tiny team clock (3 s bank, 3 free seconds): sudden death within a turn or two.
  await testLobby(page, "pairs", "3,0,3,0");
  await nextDuty(page, null);
  // Think past the free seconds: they tick; then the bank runs out: the sting, and the clock turns red.
  await expect.poll(() => page.evaluate(() => (window as any).__soundLog.filter((l: string) => l.startsWith("sqTick")).length), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (window as any).__soundLog.some((l: string) => l.startsWith("sqSting"))), { timeout: 60_000 }).toBe(true);
  await expect(page.locator(".sq-clockline .sq-clock.sd").first()).toBeVisible();
  // No chimes: Squads' own sounds are the knocks, its tick and its sting.
  const names: string[] = await page.evaluate(() => (window as any).__soundLog.map((l: string) => l.split(":")[0]));
  expect(names.filter((n) => !["move", "capture", "castle", "sqTick", "sqSting"].includes(n))).toEqual([]);
  // Quieter than a move (each rendered as it would play).
  await expect.poll(() => page.evaluate(() => (window as any).__measureSound("move").then((m: { peak: number }) => m.peak)), { timeout: 10_000 }).toBeGreaterThan(0.05);
  const level = (n: string) => page.evaluate((n) => (window as any).__measureSound(n), n) as Promise<{ peak: number; rms: number }>;
  const move = await level("move");
  for (const n of ["sqTick", "sqSting"]) {
    const s = await level(n);
    expect(s.peak).toBeLessThan(move.peak);
    expect(s.rms).toBeLessThan(move.rms);
  }
  // Muted: still logged, never heard.
  await page.getByRole("button", { name: "Turn sound off" }).first().click();
  await page.evaluate(() => ((window as any).__soundLog = []));
  await expect.poll(() => page.evaluate(() => (window as any).__soundLog.length), { timeout: 30_000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).__soundLog.every((l: string) => l.endsWith(":muted")))).toBe(true);
});

/** A second player's browser, the same kind of device as the project's. */
async function newPlayer(browser: Browser, project: string) {
  const { devices } = await import("@playwright/test");
  return project === "desktop" ? browser.newContext({ viewport: { width: 1280, height: 800 } }) : browser.newContext({ ...devices["iPhone 13"], browserName: undefined } as never);
}
