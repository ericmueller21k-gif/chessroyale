import { expect, type Browser, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOARD_SEL, expectCoordsInSquares, named, soundOff, test, watchFor } from "./helpers.ts";

/**
 * Squads played through its screens, on the real server (wrangler dev, SQUADS_TEST on) with its bots: test lobbies
 * straight at Pairs and at the final, a Relay half, the test control "Next round", the party, and the mode's sounds.
 * Every move is a real tap on the board. On a phone and a computer (docs/areas/squads.md, "The screens"). Squads v2's
 * tokens, blocks and the vote in play: e2e/squads-v2.spec.ts.
 */

const run = Date.now().toString(36).slice(-5);

interface Seen {
  phase: string | null;
  key: string | null;
  state: string | null;
  seq: number | null;
  duty: { board: number; role: "move" | "pick"; partner: string | null } | null;
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
    const partner = d?.players.length === 2 ? d.players.find((x: string) => x !== s.myId) : null;
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
  // (The Mode vote first; nobody voting in it here: Classic.)
  await expect(page.locator(".vote-title h1")).toHaveText("Which mode?");
  await page.getByRole("button", { name: "Skip votes" }).click();
  await expect.poll(async () => (await seen(page)).phase, { timeout: 20_000 }).toBe("bracket");
}

/** No sideways scroll, and every squad's short name whole in the phone's strip. */
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  const cut = await page.locator(".sq-strip-name").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0 && e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent));
  expect(cut).toEqual([]);
}

test("Pairs (a test lobby): your partner's pick shows live, both squads' tokens and block points show, lock in a different pick, then the coin-flip reveal; Next round moves on", async ({ page }) => {
  test.setTimeout(240_000);
  await testLobby(page, "pairs");
  // Every squad's clock is on screen (the strip on a phone, the side panel on a computer). The side panel has your own squad
  // pinned at the top as well as in its place: nine rows (Nov 1).
  const standings = page.locator(test.info().project.name === "desktop" ? ".sq-side .sq-row" : ".sq-strip-chip");
  await expect(standings).toHaveCount(test.info().project.name === "desktop" ? 9 : 8);
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
  // Each squad's same-move tokens, under the board for both squads; Classic has no block points (and no Block button).
  await expect(page.locator(".sq-clockline .sq-res-tokens")).toHaveText(["×5", "×5"]);
  await expect(page.locator(".sq-clockline .sq-res-bank")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Block/ })).toHaveCount(0);
  // Yours, different from theirs (the same move would use a token): tap it, then lock in.
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

test("the final (a test lobby): the whole squad votes, teammates' picks named on the board, copy one, lock in, the most picked plays", async ({ page }) => {
  test.setTimeout(300_000);
  await testLobby(page, "final");
  const reveal = await watchFor(page, {
    intro: { selector: ".sq-banner-title", text: /SQUAD FINAL/ },
    tags: { selector: ".sq-pick-tag" },
    decided: { selector: ".sq-status", text: /plays|A tie|Nobody picked/ },
  });
  const s = await nextDuty(page, null, 120_000);
  expect(s.duty!.role).toBe("pick");
  await expect(page.locator(".sq-status")).toContainText(/^Vote with your squad/);
  // Teammates' picks come in live (bots), each named where it lands; copy one.
  const copy = page.getByRole("button", { name: /^Copy / }).first();
  await expect(copy).toBeVisible({ timeout: 30_000 });
  const theirs = await page.evaluate(() => {
    const sq = (window as any).squads;
    const m = [...sq.matches.values()].find((x: any) => x.state === "half" && x.sides.some((sd: any) => sd.seats.includes(sq.myId)));
    return Object.entries(m.visible as Record<string, string>).find(([id]) => id !== sq.myId)?.[1] ?? null;
  });
  expect(theirs).not.toBeNull();
  await copy.click();
  await expect.poll(async () => (await seen(page)).mine).not.toBeNull();
  await page.getByRole("button", { name: "Lock in my vote" }).click();
  // The vote: the most picked move plays, and it is one of the picks made.
  await expect.poll(async () => (await seen(page)).seq !== s.seq || (await seen(page)).state !== "half", { timeout: 60_000 }).toBe(true);
  const vote = await page.evaluate((key) => {
    const sq = (window as any).squads;
    const m = sq.matches.get(key);
    return m.last?.events.find((e: any) => e.kind === "vote") ?? null;
  }, s.key);
  expect(vote).not.toBeNull();
  expect(vote.picks).toContain(vote.move);
  expect(vote.tally[0].votes).toBe(vote.tally.find((t: any) => t.move === vote.move).votes);
  await expect.poll(() => reveal.seen(), { timeout: 60_000 }).toEqual({ intro: true, tags: true, decided: true });
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
  // At once: your move is on your board (nothing snaps back).
  await expect.poll(() => moved.seen(), { timeout: 5000 }).toEqual({ moved: true, played: true });
  // A beat later (Jump to my next board, on by default) the big board is next turn's (e2e/squads-watch.spec.ts).
  await expect(page.locator(".sq-tiny.on .sq-mark.next")).toHaveCount(1, { timeout: 5000 });
  // The tiny boards are tappable now: watch another board full size, then back.
  const others = page.locator("button.sq-tiny:not(.is-you)");
  await expect(others.first()).toBeVisible();
  // The big board's coordinates sit in their own squares, either way up (the letters were a column off): on next
  // turn's board, then back on yours, where your squad has the other color, so it opens the other way up.
  const up = await expectCoordsInSquares(page);
  await page.getByRole("button", { name: "Back to my board" }).click();
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
  await expect(page.locator(".fd-hint")).toHaveText(/^Solo queue: bots fill any empty seat/);
  await page.getByRole("radio", { name: /^Party/ }).click();
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
  await soundOff(page);
  await page.evaluate(() => ((window as any).__soundLog = []));
  await expect.poll(() => page.evaluate(() => (window as any).__soundLog.length), { timeout: 30_000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).__soundLog.every((l: string) => l.endsWith(":muted")))).toBe(true);
});

/** A second player's browser, the same kind of device as the project's. */
async function newPlayer(browser: Browser, project: string) {
  const { devices } = await import("@playwright/test");
  return project === "desktop" ? browser.newContext({ viewport: { width: 1280, height: 800 } }) : browser.newContext({ ...devices["iPhone 13"], browserName: undefined } as never);
}

test("the party sheet: Escape closes it from its first frame, and leaves a party made while it was open", async ({ page }) => {
  // (Its key listener waited for a paint, so an Escape pressed as it opened was lost: kill-switches.spec.ts, CI, Oct
  // 16. And it kept the sheet's first close, from before the party was made, so it dropped the party without leaving
  // it. docs/decisions/2026-10-16-flaky-e2e-batch-4.md)
  test.setTimeout(90_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await named(page, "Esc");
  await page.goto(`/?nolanding&debug&pool=sqesc-${run}`);
  await page.getByRole("radio", { name: /Squads/ }).click();
  const sheet = page.getByRole("dialog", { name: "Squads party" });
  // Escape the moment the sheet is in the page (before it's painted): it closes.
  await page.evaluate(() => {
    const w = window as any;
    w.__sheetSeen = false;
    const obs = new MutationObserver(() => {
      if (!document.querySelector('[role="dialog"]')) return;
      obs.disconnect();
      w.__sheetSeen = true;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole("radio", { name: /^Party/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__sheetSeen)).toBe(true);
  await expect(sheet).toHaveCount(0);
  // A party made with the sheet open: Escape closes the sheet and leaves the party, as ✕ does.
  await page.getByRole("radio", { name: /^Party/ }).click();
  await sheet.getByRole("button", { name: "Create a party" }).click();
  const code = (await page.locator(".sq-invite-code").textContent({ timeout: 15_000 }))!.trim();
  const members = () => page.evaluate((c) => fetch(`/api/squads/party/${c}`).then((r) => (r.ok ? r.json().then((s) => s.members as number) : 0)), code);
  await expect.poll(members).toBe(1);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect.poll(members, { timeout: 10_000 }).toBe(0);
});
