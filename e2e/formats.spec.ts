import { expect, type Page } from "@playwright/test";
import { createLobbyFromHome, named, soloFromHome, test } from "./helpers.ts";

/** page.evaluate that shrugs off a dropped execution context (seen under heavy load while the page carries on). */
async function safely<T>(f: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await f();
  } catch (e) {
    if (/Execution context was destroyed/.test(String(e))) return fallback;
    throw e;
  }
}
const phase = (p: Page) => safely(() => p.evaluate(() => (window as any).match?.phase.kind ?? "none"), "none");

/** Plays as a strong human (the engine's move, or a planned bot pick if the engine is slow) until the results. */
async function playToResults(page: Page, seen: Set<string>, minutes: number) {
  const stopAt = Date.now() + minutes * 60_000;
  while (Date.now() < stopAt) {
    const p = await phase(page);
    seen.add(p);
    if (p === "results") return;
    if (p === "play") {
      await safely(() => page.evaluate(async () => {
        const m = (window as any).match;
        if (m.phase.kind !== "play") return;
        // Boss battle: call the King every move (he plays when more than half the crowd calls).
        if (m.boss) m.callKing();
        const fen = m.phase.board.fen;
        const engines = m.runner ? null : await m.engines?.();
        const top = await Promise.race([
          m.runner ? m.runner.topMovesFor(fen) : engines[0].topMoves(fen, 1),
          new Promise((r) => setTimeout(() => r(null), 12000)),
        ]);
        const fallback = m.runner ? [...(m.runner.planned?.values() ?? [])][0] : null;
        const move = top ? (top as any)[0].move : fallback;
        if (m.phase.kind === "play" && move) m.submit(move);
      }), undefined);
    }
    if (p === "boss") {
      const k = await safely(() => page.evaluate(() => ((window as any).match.phase.boss?.justKilled ? "bossKill" : (window as any).match.phase.thinking ? "bossThinking" : "bossMove")), "none");
      seen.add(k);
    }
    await page.waitForTimeout(250);
  }
}

test("pre-game votes: the cards vote too; the winners set the ending and the clock", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&mode=crowd&turns=teams&augments=1");
  await soloFromHome(page);
  await expect(page.locator(".vote-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "How does it end?" })).toBeVisible();
  await expect(page.locator(".vote-zone")).toHaveCount(3);
  // Vote 1: tap the middle card (Boss battle). (Dragging your pawn is in votes.spec.ts.)
  await page.getByRole("radio", { name: /Boss battle/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).match.myVote)).toBe(1);
  await expect(page.locator(".vote-card.on")).toContainText("Boss battle");
  // Your pawn walks into that zone.
  await expect(page.locator(".vote-me.in")).toBeVisible();
  // Votes come in live; then the result.
  await expect.poll(async () => Number(await page.locator(".vote-zone-count").nth(1).textContent())).toBeGreaterThan(1);
  await expect(page.locator(".vote-banner")).toBeVisible({ timeout: 15_000 });
  const format = await page.evaluate(() => (window as any).match.settings.finalFormat);
  expect(["team", "boss", "duel"]).toContain(format);
  // Vote 2: tap the Bullet card.
  await expect(page.getByRole("heading", { name: "How fast?" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("radio", { name: /Bullet/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).match.myVote)).toBe(2);
  await expect.poll(() => page.evaluate(() => (window as any).match.phase.vote?.result ?? null), { timeout: 15_000 }).not.toBeNull();
  const result: number = await page.evaluate(() => (window as any).match.phase.vote.result);
  await expect.poll(() => phase(page), { timeout: 20_000 }).toMatch(/play|watching/);
  // The game's clock is the winning speed's: Normal 20 s, Variable 10 s on move 1 (then rising), Bullet 10 s.
  const clock = await page.evaluate(() => {
    const r = (window as any).match.runner;
    return { now: r.moveClock(), steps: r.settings.moveClockSteps.length };
  });
  expect(clock).toEqual([{ now: 20, steps: 0 }, { now: 10, steps: 5 }, { now: 10, steps: 0 }][result]);
});

test("team final: the top 8 play 4v4, the weakest on each side go out, everyone is placed", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&pace=quick&mode=crowd&turns=teams&format=team&rounds=1&clock=20&finalTurns=30");
  await soloFromHome(page);
  const seen = new Set<string>();
  await playToResults(page, seen, 9);
  expect(await phase(page)).toBe("results");
  const f = await page.evaluate(() => (window as any).match.runner.state.final);
  expect(f.format).toBe("team");
  // 30 turns: 24 for the 4v4 step, then the first cut (one from each side).
  expect(f.out.length).toBe(2);
  const places = await page.evaluate(() => (window as any).match.runner.state.players.map((p: any) => p.placement).sort((a: number, b: number) => a - b));
  expect(places).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  if (seen.has("final")) await expect(page.locator(".team-result")).toBeVisible();
});

test("boss battle (solo): the boss replies, strikes every 3 moves, and the result shows", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&pace=quick&mode=crowd&turns=teams&format=boss&rounds=1&clock=20&bossMoves=7");
  await soloFromHome(page);
  const seen = new Set<string>();
  await playToResults(page, seen, 9);
  expect(await phase(page)).toBe("results");
  const boss = await page.evaluate(() => (window as any).match.runner.state.boss);
  expect(["crowd", "boss", "draw"]).toContain(boss.result);
  expect(boss.kills.length).toBe(2);
  expect(boss.kingCharges).toBeGreaterThanOrEqual(0);
  const reached = await page.evaluate(() => {
    const m = (window as any).match;
    const me = m.runner.player("you");
    return me.outInStage === null || me.outInStage >= m.settings.knockoutsPerStage.length;
  });
  if (reached) {
    for (const k of ["boss", "bossThinking", "bossMove", "bossKill"]) expect(seen.has(k)).toBe(true);
    // You called the King every move; the bots back you most of the time, so he played at least once.
    expect(boss.kingMoves.length).toBeGreaterThan(0);
  }
  await expect(page.locator(".team-result")).toBeVisible();
});

test("boss raid (solo): you against a boss from a named opening; the King can strike it", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&pace=quick&clock=20&bossMoves=6");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  // First, the boss menu: a random boss, then every boss you can meet (a complete character and powers), each at
  // your strength plus its own offset. Pick one and it starts.
  const menu = page.getByRole("dialog", { name: "Choose your boss" });
  await expect(menu).toBeVisible();
  await expect(menu.locator(".boss-row")).toHaveCount(4);
  await expect(menu.getByRole("button", { name: /Random boss/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: /Match the group/ })).toHaveCount(0);
  await menu.getByRole("button", { name: /Boingo the Clown/ }).click();
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".opening-roulette.landed")).toBeVisible({ timeout: 5_000 });
  const boss = await page.evaluate(() => (window as any).match.boss);
  expect(boss.raid).toBe(true);
  expect(boss.name).toBe("Boingo the Clown");
  expect(boss.board.ply).toBe(10);
  // On your first move, strike the boss (alone, you're the whole crowd): its next move is staggered.
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  // He stands by the board and introduces himself. Tap him: his commands open above his head; tap again to close.
  await expect(page.locator(".gk-bubble")).toBeVisible({ timeout: 5_000 });
  const king = page.getByRole("button", { name: /God King: tap to summon/ });
  await king.click();
  await expect(page.getByRole("menu", { name: "God King commands" })).toBeVisible();
  await king.click();
  await expect(page.getByRole("menu", { name: "God King commands" })).toHaveCount(0);
  await king.click();
  // A strike isn't your turn: the clock stops while he strikes, then you pick.
  await page.getByRole("menuitem", { name: /Strike/ }).click();
  // Alone you're the whole crowd, so he comes at once, during your move: on your king's square, striking the boss.
  await expect(page.getByLabel("The God King strikes the boss")).toBeVisible({ timeout: 5_000 });
  expect(await phase(page)).toBe("play");
  // One strike a move: Strike is greyed out now.
  await expect(page.locator(".king-summon")).toHaveCount(0, { timeout: 8_000 });
  await king.click();
  await expect(page.getByRole("menuitem", { name: /Strike/ })).toBeDisabled();
  await king.click();
  // Then he's gone and the move goes on: still yours to pick.
  await expect(page.locator(".king-summon")).toHaveCount(0, { timeout: 8_000 });
  expect(await phase(page)).toBe("play");
  const seen = new Set<string>();
  await playToResults(page, seen, 7);
  expect(await phase(page)).toBe("results");
  const end = await page.evaluate(() => (window as any).match.runner.state.boss);
  expect(end.kingStrikes).toEqual([1]);
  expect(["crowd", "boss", "draw"]).toContain(end.result);
  await expect(page.locator(".team-result")).toBeVisible();
  // Alone, the headline is the result against the boss, never "1st of 1 · You won the match!" after a loss.
  await expect(page.locator(".results h1")).toHaveText({ crowd: "Victory!", boss: "Defeated", draw: "A draw" }[end.result as "crowd" | "boss" | "draw"]);
});

test("boss raid alone flows like a chess site: your move is played, the boss replies, your turn (no reveal, no ring, no countdown)", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&clock=30&boss=1600");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect.poll(() => phase(page), { timeout: 40_000 }).toBe("play");
  // The engine's best move (never a blunder, so no Last Stand), then every phase on the way back to your move, and
  // any ring or countdown seen meanwhile.
  const seen = await page.evaluate(
    async () => {
      const m = (window as any).match;
      const [top] = await m.runner.topMovesFor(m.phase.board.fen);
      return new Promise<{ phases: string[]; ring: boolean; countdown: boolean; ms: number }>((resolve) => {
        const t0 = Date.now();
        const phases: string[] = [];
        let ring = false;
        let countdown = false;
        const tick = () => {
          const k = m.phase.kind;
          if (phases[phases.length - 1] !== k) phases.push(k);
          ring ||= !!document.querySelector(".square-ring");
          countdown ||= /Your move in|Get ready/.test(document.body.innerText);
          if (k === "play" && phases.length > 1) return resolve({ phases, ring, countdown, ms: Date.now() - t0 });
          if (Date.now() - t0 > 60_000) return resolve({ phases, ring, countdown, ms: -1 });
          requestAnimationFrame(tick);
        };
        m.submit(top.move);
        tick();
      });
    },
  );
  expect(seen.phases).toEqual(["scoring", "boss", "play"]);
  expect(seen.ring).toBe(false);
  expect(seen.countdown).toBe(false);
  // Your clock starts as the boss's move lands.
  expect(await page.evaluate(() => (window as any).match.phase.startsAt <= Date.now())).toBe(true);
});

test("the God King's Last Stand (solo raid, ?laststand=1): the ?? warning, he takes the blow, falls, leaves his charges as power-ups, and you pick again without that move", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  // (?boss=1600 skips the boss menu.)
  await page.goto("/?debug&pace=quick&clock=20&bossMoves=3&boss=1600&laststand=1");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect.poll(() => phase(page), { timeout: 40_000 }).toBe("play");
  const fen = await page.evaluate(() => (window as any).match.phase.board.fen);
  // Your move (the test switch makes this one call for him, whatever it is).
  const move: string = await page.evaluate(async () => {
    const m = (window as any).match;
    const top = await m.runner.topMovesFor(m.phase.board.fen);
    const mv = top[top.length - 1].move;
    m.submit(mv);
    return mv;
  });
  // On everyone's screen: first the warning (the ?? badge on the piece's square, the dock in plain words), then he
  // crashes onto the square, his banner, the blow, and he falls into the dock.
  await expect(page.getByRole("alert", { name: /The God King's Last Stand/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("img", { name: "Blunder" })).toBeVisible({ timeout: 2_000 });
  const san = await page.evaluate(() => {
    const m = (window as any).match;
    return m.phase.kind === "reveal" ? m.phase.mine.lastStand.move : null;
  });
  expect(san).toBe(move);
  await expect(page.locator(".boss-dock-status")).toContainText("?? Blunder:");
  await expect(page.locator(".boss-dock-status .blunder-words")).toHaveText(/^(Loses your (knight|bishop|rook|queen)|Allows mate|(Your c|C)hances \d+% → \d+%)/);
  // The eval bar plunges to your chances after the move (ringed red) while the warning is up.
  await expect(page.locator(".eval-bar.plunged")).toBeVisible();
  await expect(page.getByRole("alert", { name: /^Last stand:/ })).toBeVisible({ timeout: 8_000 });
  await expect(page.locator(".ls-dmg").first()).toBeVisible({ timeout: 6_000 });
  await expect(page.getByRole("img", { name: "The God King has fallen" })).toBeVisible({ timeout: 8_000 });
  await expect(page.getByRole("status", { name: "Finish… it… for me." })).toBeVisible({ timeout: 3_000 });
  // Then the same position again, a full clock, his charges gone, the move he took back barred.
  await expect.poll(() => phase(page), { timeout: 15_000 }).toBe("play");
  const again = await page.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board.fen, allowed: m.phase.allowedMs, barred: m.boss.barred, stand: m.boss.lastStand, charges: m.boss.kingCharges };
  });
  expect(again.fen).toBe(fen);
  expect(again.allowed).toBe(20_000);
  expect(again.barred).toBe(move);
  expect(again.charges).toBe(0);
  expect(again.stand).toMatchObject({ atMove: 1, move, charges: 3 });
  // He can't be called any more, and the barred move can't be played.
  await expect(page.getByRole("button", { name: /God King: tap to summon/ })).toHaveCount(0);
  await page.evaluate((mv) => (window as any).match.submit(mv), move);
  expect(await phase(page)).toBe("play");
  // He fell with his 3 charges: they're your power-ups, a ⚡ button beside his fallen figure. One shows the engine's
  // top 3 moves as arrows (and the barred move keeps its grey ✕ arrow).
  const power = page.getByRole("button", { name: /Use a power-up: the engine's top 3 moves \(3 left\)/ });
  await expect(power).toBeVisible();
  await power.click();
  await expect.poll(() => page.evaluate(() => (window as any).match.hint?.length ?? 0), { timeout: 15_000 }).toBe(3);
  await expect(page.getByRole("button", { name: /Power-up in use/ })).toBeVisible();
  await expect.poll(() => page.locator(".board-row cg-container svg.cg-shapes line").count()).toBe(4);
  const seen = new Set<string>();
  await playToResults(page, seen, 5);
  expect(await phase(page)).toBe("results");
  const end = await page.evaluate(() => (window as any).match.runner.state.boss);
  expect(end.lastStand.atMove).toBe(1);
  expect(["crowd", "boss", "draw"]).toContain(end.result);
  // The power-up move counted as one (an ordinary pick, marked as a power-up move: never brilliant).
  const record = await page.evaluate(() => (window as any).match.moves.find((m: any) => m.usedPowerUp));
  expect(record).toBeTruthy();
  expect(record.brilliant).toBe(false);
  // The result screen: he rises if the crowd won, otherwise he stays down. Beside him, the Last Stand's card: one
  // line, and tapped open, your move, the best move, your chances and the position with both arrows.
  await expect(page.locator(end.result === "crowd" ? ".gk-epilogue.rises" : ".gk-epilogue.down")).toBeVisible();
  const card = page.getByRole("button", { name: /The God King's Last Stand/ });
  await expect(card).toContainText(/Move \d+: \S+\?\? · /);
  await card.click();
  await expect(card).toHaveAttribute("aria-expanded", "true");
  const facts = page.locator(".ls-card-facts");
  await expect(facts).toContainText("Your move");
  await expect(facts).toContainText("Your chances");
  await expect(page.locator(".ls-card .mini cg-container svg.cg-shapes line").first()).toBeAttached();
});

test("boss battle (online): the host's browser plays the boss", async ({ page }) => {
  test.setTimeout(12 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run is enough");
  await page.goto("/?debug&pace=quick&mode=crowd&turns=teams&format=boss&rounds=1&clock=15&bossMoves=6");
  await createLobbyFromHome(page);
  await page.getByRole("button", { name: /Start with 1 player/ }).click();
  const seen = new Set<string>();
  await playToResults(page, seen, 11);
  expect(await phase(page)).toBe("results");
  expect(seen.has("bossThinking") || seen.has("bossMove") || seen.has("spectating")).toBe(true);
  expect(["crowd", "boss", "draw"]).toContain(await page.evaluate(() => (window as any).match.phase.bossResult));
});

test("Play now: players land in the same lobby, the count climbs, bots fill it and the votes begin", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run is enough");
  const pages = await Promise.all([0, 1].map(async () => (await browser.newContext({ viewport: { width: 420, height: 860 } })).newPage()));
  for (const [i, p] of pages.entries()) {
    await named(p, `P${i}`);
    await p.goto("/?debug&pool=formats");
    await p.getByRole("button", { name: "PLAY", exact: true }).click();
    await expect(p.locator(".fd-seats")).toBeVisible();
  }
  const codes = await Promise.all(pages.map((p) => p.evaluate(() => (window as any).match.code)));
  expect(codes[0]).toBe(codes[1]);
  await expect(pages[0]!.locator(".fd-count-n")).toHaveText("2");
  // MATCH_FILL_SECONDS is 8 locally: then bots fill the seats and the pre-game votes start.
  for (const p of pages) await expect(p.locator(".vote-screen")).toBeVisible({ timeout: 20_000 });
  expect(await pages[0]!.evaluate(() => (window as any).match.players.length)).toBe(100);
  // Online too: 8 seconds to vote. Neither of them votes, so when time's up both go with the crowd: counted with the
  // winner, their pawns in its zone, and a line above the board says so.
  expect(await pages[0]!.evaluate(() => (window as any).match.phase.vote.until - (window as any).match.phase.vote.startsAt)).toBe(8000);
  for (const p of pages) {
    await expect(p.locator(".vote-hint")).toHaveText("You didn't vote, so you're with the crowd.", { timeout: 15_000 });
    const end = await p.evaluate(() => {
      const m = (window as any).match;
      const v = m.phase.vote;
      return { result: v.result, mine: v.votes.find((x: any) => x.playerId === m.myId), all: new Set(v.votes.map((x: any) => x.playerId)).size };
    });
    expect(end.mine).toMatchObject({ option: end.result, joined: true });
    expect(end.all).toBe(100);
    await expect(p.locator(".vote-me.in")).toBeVisible();
  }
  // A new player now gets a new lobby.
  const late = await (await browser.newContext()).newPage();
  await late.goto("/?debug&pool=formats");
  await late.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(late.locator(".fd-seats")).toBeVisible();
  expect(await late.evaluate(() => (window as any).match.code)).not.toBe(codes[0]);
});
