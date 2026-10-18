import { readFileSync } from "node:fs";
import { devices, expect } from "@playwright/test";
import { CROWD_SETTINGS } from "@chessroyale/core";
import { createLobbyFromHome, engineTop, expectCoordsInSquares, named, soloFromHome, submitMove, test } from "./helpers.ts";

const phase = (p: any) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

/** The longest name in the opening library (a Classic board's name, at any of its plies). */
const LONGEST_OPENING = (JSON.parse(readFileSync(new URL("../packages/chess/data/openings.json", import.meta.url), "utf8")) as { names: Record<string, string> }[])
  .flatMap((o) => Object.values(o.names))
  .reduce((a, b) => (b.length > a.length ? b : a), "");

test("narrow phones: the top bar's numbers stay clear of the options button, and the cut lists whole rows of names", async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  // 360 px and 375 px wide (the layout is the same in both schemes; one of each).
  for (const [device, colorScheme] of [["Galaxy S24", "light"], ["iPhone SE (3rd gen)", "dark"]] as const) {
    const page = await (await browser.newContext({ ...devices[device], browserName: undefined, colorScheme } as any)).newPage();
    await named(page, "Maximilian Wolfe");
    await page.goto("/?debug&pace=quick&mode=crowd&rounds=2&clock=30&augments=0");
    await soloFromHome(page);
    await expect.poll(() => phase(page), { timeout: 30_000 }).toMatch(/play|watching/);
    // The longest real names (a 100-player lobby numbers them: "… 2") and the widest numbers, late in a game:
    // move 34, you at −112.5, the cut line around −120.
    await page.evaluate(() => {
      const m = (window as any).match;
      const long = ["Queen's Gambit Quinn", "Trompowsky Trina", "Prophylaxis Pia", "King's Indian Kip", "Bishop Pair Paul", "Zwischenzug Zak"];
      m.runner.state.players.forEach((p: any, i: number) => {
        if (p.isBot) p.name = `${long[i % long.length]} 2`;
        p.stageScore = p.id === "you" ? -112.5 : -100 - (i % 37) * 0.7;
      });
      m.phase = { ...m.phase, board: { ...m.phase.board, fen: m.phase.board.fen.replace(/\d+$/, "34") } };
      m.emit();
    });
    await expect(page.locator(".hud-row .hud-cut")).toContainText("−1");
    await page.waitForTimeout(1200); // (the numbers count to their new values)
    const bar = await page.evaluate(() => {
      const hud = document.querySelector(".hud-row .hud")!;
      const cut = document.querySelector(".hud-row .hud-cut")!.getBoundingClientRect();
      // (On a phone the top line ends in "⋯", the match's options: Sound and Resign.)
      const mute = document.querySelector(".hud-row .mm-more")!.getBoundingClientRect();
      const label = [...document.querySelectorAll(".hud-row .hud-stage-text > span")];
      return {
        text: (hud as HTMLElement).innerText,
        spill: hud.scrollWidth - hud.clientWidth,
        clear: mute.left - cut.right,
        labelCut: label.some((e) => e.scrollWidth > e.clientWidth),
      };
    });
    expect(bar.spill, `${device}: ${bar.text}`).toBeLessThanOrEqual(0);
    expect(bar.clear, `${device}: the cut pill runs under the options button`).toBeGreaterThanOrEqual(0);
    expect(bar.labelCut, `${device}: "Move 34 · cut in 2" is cut short`).toBe(false);
    // Play to the first cut (up to 16 go out: ties at the line go through) and hold it there. You play the engine's best
    // move, so you go through: nobody's pick scores better than yours, and you start well above your team's line. (A
    // bot's pick, which this copied before, is now and then a random legal move, `botRandomMoveChance`; one put you out,
    // and then the first name listed is yours, "You" in red and not struck through, by design.)
    const stopAt = Date.now() + 120_000;
    while ((await phase(page)) !== "stageBreak" && Date.now() < stopAt) {
      if ((await phase(page)) === "play") {
        const { fen, top } = await engineTop(page);
        await submitMove(page, top[0]?.move, fen);
      }
      await page.waitForTimeout(250);
    }
    expect(await phase(page)).toBe("stageBreak");
    await page.evaluate(() => clearTimeout((window as any).match.timer));
    expect(await page.evaluate(() => (window as any).match.phase.youOut), `${device}: you went through`).toBe(false);
    const names = page.locator(".crowd-cut .cut-out");
    await expect(names).toBeVisible({ timeout: 5000 });
    const list = await names.evaluate((box) => {
      const b = box.getBoundingClientRect();
      const chips = [...box.children].map((c) => ({ bottom: c.getBoundingClientRect().bottom, text: (c as HTMLElement).innerText, struck: getComputedStyle(c).textDecorationLine }));
      return { bottom: b.bottom, chips };
    });
    // Every name shown is whole (no row cut in half), struck through, and "+N" counts the rest of those out.
    const out: number = await page.evaluate(() => (window as any).match.phase.knockedOut.length);
    await expect(page.locator(".crowd-cut .cut-head")).toContainText(`${out} out`);
    for (const c of list.chips) expect(c.bottom, `${device}: "${c.text}" is cut off`).toBeLessThanOrEqual(list.bottom + 0.5);
    const more = list.chips.at(-1)!;
    expect(more.text).toBe(`+${out - (list.chips.length - 1)}`);
    for (const c of list.chips.slice(0, -1)) expect(c.struck).toBe("line-through");
    expect(list.chips.length).toBeGreaterThanOrEqual(5);
  }
});

test("the opening allowance on the reveal: a sound move off the engine's line is forgiven, said in one line at 320 px", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  // The narrowest phone we support (320 px).
  const page = await (await browser.newContext({ ...devices["iPhone SE"], browserName: undefined } as any)).newPage();
  await page.goto("/?debug&pace=quick&mode=crowd&format=team&rounds=2&clock=40&augments=0");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  // A move in the engine's top 8 that gives away a little (0.5 to 6 points): under the allowance, so it counts 0.
  const { fen, top } = await engineTop(page);
  const best = (top[0] as any).expected as number;
  const sound = top.find((m: any) => (best - m.expected) * 100 >= 0.5 && (best - m.expected) * 100 <= 6);
  test.skip(!sound, "no top move in the band in this position");
  await submitMove(page, sound!.move, fen);
  await expect.poll(() => phase(page), { timeout: 60_000, intervals: [50] }).toBe("reveal");
  // Hold the reveal (solo moves on by a timer).
  await page.evaluate(() => clearTimeout((window as any).match.timer));
  const line = page.locator(".poll-result .allowance-line");
  await expect(line).toHaveText(/^\d+(\.\d)? forgiven · opening$/);
  const oneLine = () =>
    line.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { text: (el as HTMLElement).innerText, spill: el.scrollWidth - el.clientWidth, height: r.height, lineHeight: parseFloat(getComputedStyle(el).lineHeight), right: r.right, left: r.left, width: innerWidth };
    });
  const forgiven = await oneLine();
  expect(forgiven.spill).toBeLessThanOrEqual(0);
  expect(forgiven.height).toBeLessThan(forgiven.lineHeight * 1.5);
  // The widest notes a move can get (refused the allowance for material; partly forgiven on a loss of nearly 100): still
  // one line, on screen.
  const notes = [
    [{ loss: 100, material: "missed" }, "no allowance · missed a capture"],
    [{ loss: 100, material: "gave" }, "no allowance · gave up material"],
    [{ loss: 99.9, counted: 91.9 }, "8 of 99.9 forgiven · opening"],
  ] as const;
  for (const [patch, words] of notes) {
    await page.evaluate((patch) => {
      const m = (window as any).match;
      const me = m.phase.mine.result.players.find((p: any) => m.isYou(p.playerId));
      delete me.counted;
      delete me.material;
      Object.assign(me, patch);
      m.emit();
    }, patch);
    await expect(line).toHaveText(words);
    const wide = await oneLine();
    expect(wide.spill, wide.text).toBeLessThanOrEqual(0);
    expect(wide.height, wide.text).toBeLessThan(wide.lineHeight * 1.5);
    expect(wide.left, wide.text).toBeGreaterThanOrEqual(0);
    expect(wide.right, wide.text).toBeLessThanOrEqual(wide.width);
  }
});

test("online, once you're out, a later cut says so (not \"You're through\") and the gavel strikes again", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  // A lobby of one (and 99 bots) where you never pick: -25 a move puts you at the bottom of your team.
  await page.goto("/?debug&pace=quick&mode=crowd&format=team&rounds=1&clock=4");
  await createLobbyFromHome(page);
  await page.getByRole("button", { name: /Start with 1 player/ }).click();
  const cut = () => page.evaluate(() => {
    const p = (window as any).match?.phase;
    return p?.kind === "stageBreak" ? { stage: p.stage as number, youOut: p.youOut as boolean, out: p.knockedOut.length as number } : null;
  });
  let outAt: number | null = null;
  await expect
    .poll(async () => {
      const c = await cut();
      if (c?.youOut) outAt = c.stage;
      return outAt;
    }, { timeout: 3 * 60_000, intervals: [200] })
    .not.toBeNull();
  // The cut you went out at.
  await expect(page.locator(".crowd-cut .out-msg")).toContainText("You're out");
  await expect(page.getByRole("button", { name: "Why was I cut?" })).toBeVisible();
  // A later cut that puts players out, watched from the sidelines: a new judgment (the doomed pawns glow before the
  // gavel lands). (Ties at the line go through, so a cut early on, when the opening allowance leaves many level, may put
  // nobody out and strike nothing: docs/decisions/2026-10-15-flaky-e2e-batch.md.)
  await expect
    .poll(async () => {
      const c = await cut();
      return c && c.stage > outAt! && c.out > 0 ? c.stage : -1;
    }, { timeout: 90_000, intervals: [100] })
    .toBeGreaterThan(outAt!);
  await expect(page.locator(".crowd-cut .grid-pawn.doomed").first()).toBeVisible({ timeout: 1000 });
  await expect(page.locator(".crowd-cut .grid-pawn.cut-now").first()).toBeVisible({ timeout: 5000 });
  // It says you went out before, not that you're through.
  await expect(page.locator(".crowd-cut .out-msg")).toHaveText(/^You went out earlier, in \d+(st|nd|rd|th) place\.$/);
  await expect(page.locator(".crowd-cut .safe-msg")).toHaveCount(0);
  await expect(page.locator(".crowd-cut")).not.toContainText("You're through");
  await expect(page.getByRole("button", { name: "Why was I cut?" })).toHaveCount(0);
});

test("Crowd 50 v 50: plays your team's turns, watches the other team's, survives cuts, through the team final to results", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  // Two rounds a stage, as in a real match (a cut after every move: one ply for each team). With one, a stage is a
  // single ply, so at the first cut the team that hasn't moved yet is all tied on 0 and its cut is a coin flip: you
  // could go out before ever playing.
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=2&clock=20&augments=0&finalTurns=12");
  await soloFromHome(page);
  const seen = new Set<string>();
  const stopAt = Date.now() + 9 * 60_000;
  while (Date.now() < stopAt) {
    const p = await phase(page);
    seen.add(p);
    if (p === "results") break;
    if (p === "play") {
      // The game starts from the initial position, with no other boards beside it.
      await expect(page.locator(".boards-strip")).toHaveCount(0);
      // The best move if the engine answers within 12 s, searched in the page and polled for (engineTop: no evaluate
      // held open over a search, .claude/LESSONS.md "A navigation that never happened"); any legal move otherwise (a
      // busy test machine mustn't miss the clock).
      const best = await engineTop(page, "judged", 12_000).catch(() => null);
      const pick = best?.top[0]
        ? { fen: best.fen, move: best.top[0].move }
        : await page.evaluate(() => {
            const m = (window as any).match;
            if (m.phase.kind !== "play") return null;
            // (A teammate bot's planned pick is a legal move in the same position.)
            return { fen: m.phase.board.fen as string, move: [...(m.runner.planned?.values() ?? [])][0] as string };
          });
      await submitMove(page, pick?.move, pick?.fen);
    } else if (p === "reveal") {
      // The live poll shows (unless the short quick-pace reveal has already moved on).
      await expect.poll(async () => (await phase(page)) !== "reveal" || (await page.locator(".poll-row").first().isVisible())).toBe(true);
      if (await page.locator(".poll-row").count()) seen.add("poll");
    }
    await page.waitForTimeout(250);
  }
  expect(await phase(page)).toBe("results");
  for (const k of ["play", "watching", "reveal", "poll", "stageBreak"]) expect(seen.has(k)).toBe(true);
  await expect(page.locator(".team-result")).toBeVisible();
  // Everyone placed 1-100.
  const places = await page.evaluate(() => (window as any).match.runner.state.players.map((p: any) => p.placement).sort((a: number, b: number) => a - b));
  expect(places).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
});

test("the board's coordinates sit in their own squares, either way up (Crowd 50 v 50: your team's side at the bottom)", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  // Your team is drawn as the match starts, about one in two each: new matches until both have come up.
  const seen = new Set<string>();
  for (let i = 0; i < 12 && seen.size < 2; i++) {
    await page.goto("/?debug&mode=crowd&augments=0");
    await soloFromHome(page);
    await expect.poll(() => phase(page), { timeout: 30_000 }).toMatch(/play|watching/);
    const team: string = await page.evaluate(() => (window as any).match.runner.player("you").colour);
    seen.add(await expectCoordsInSquares(page, team === "w" ? "white" : "black"));
  }
  expect([...seen].sort()).toEqual(["black", "white"]);
});

test("a device that chose the old options (Everyone moves, Relaxed pace off) plays 50 v 50 at the mode's own pace", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("brc.crowdTurns", "all");
    localStorage.setItem("brc.pace", "quick");
  });
  await page.goto("/?debug&mode=crowd&augments=0");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toMatch(/play|watching/);
  const m = await page.evaluate(() => {
    const x = (window as any).match;
    return { teams: x.settings.crowdTeams, reveal: x.settings.revealSeconds, drawn: x.settings.drawnMoveSeconds, team: x.runner.player("you").colour };
  });
  expect(m).toEqual({ teams: true, reveal: CROWD_SETTINGS.revealSeconds, drawn: CROWD_SETTINGS.drawnMoveSeconds, team: expect.stringMatching(/^[wb]$/) });
});

test("the board never moves or resizes during a turn (Crowd and Classic)", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  for (const mode of ["crowd", "classic"]) {
    await page.goto(`/?debug&pace=quick&mode=${mode}&augments=0`);
    await soloFromHome(page);
    await expect.poll(() => phase(page), { timeout: 30_000 }).toMatch(/play|watching/);
    const rects = new Map<string, Set<string>>();
    const stopAt = Date.now() + 25_000;
    while (Date.now() < stopAt) {
      const [kind, rect] = await page.evaluate(() => {
        const m = (window as any).match;
        const k = m.phase.kind;
        if (k === "play" && !(window as any).__sub && Date.now() > m.phase.startsAt + 1000) {
          (window as any).__sub = 1;
          // (The search isn't awaited in this evaluate: .claude/LESSONS.md, "A navigation that never happened".)
          const fen = m.phase.board.fen;
          void m.runner.topMovesFor(fen).then((top: { move: string }[]) => {
            if (m.phase.kind === "play" && m.phase.board.fen === fen) m.submit(top[0]!.move);
            setTimeout(() => ((window as any).__sub = 0), 500);
          });
        }
        const r = document.querySelector(".board-wrap .board")?.getBoundingClientRect();
        return [k, r ? `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}` : "none"];
      });
      if (["play", "scoring", "watching", "reveal"].includes(kind)) {
        if (!rects.has(rect)) rects.set(rect, new Set());
        rects.get(rect)!.add(kind);
      }
      if (kind === "stageBreak" && mode === "classic") await page.evaluate(() => (window as any).match.continueFromBreak());
      await page.waitForTimeout(100);
    }
    const summary = [...rects].map(([r, k]) => `${r} (${[...k].join("/")})`);
    expect(summary, `${mode}: board positions seen`).toHaveLength(1);
    expect([...rects.values()][0]!.size).toBeGreaterThanOrEqual(3);
    if (mode !== "classic") continue;
    // Classic's line above the board is the board's opening name, and the next round can put you on any board: the
    // library's longest name stays on one line and leaves the board where it was (a long one used to wrap and push it
    // down a line on a phone: docs/decisions/2026-10-15-flaky-e2e-batch.md).
    const at = [...rects.keys()][0]!;
    // (Measured against a short name's line on the same board: one line, whatever the line height is.)
    type Look = { text: string; height: number; rect: string };
    let seen = null as { short: Look; long: Look } | null;
    for (let i = 0; i < 5 && seen?.long.text !== LONGEST_OPENING; i++) {
      await expect
        .poll(async () => {
          const k = await phase(page);
          if (k === "stageBreak") await page.evaluate(() => (window as any).match.continueFromBreak());
          return k;
        }, { timeout: 60_000 })
        .toBe("play");
      seen = await page.evaluate(async (longest) => {
        const m = (window as any).match;
        const look = async (name: string) => {
          m.phase = { ...m.phase, board: { ...m.phase.board, openingName: name } };
          m.emit();
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const line = document.querySelector<HTMLElement>(".board-area .opening-name")!;
          const r = document.querySelector(".board-wrap .board")!.getBoundingClientRect();
          return { text: line.textContent ?? "", height: line.getBoundingClientRect().height, rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}` };
        };
        const short = await look("Slav Defense");
        return { short, long: await look(longest) };
      }, LONGEST_OPENING);
    }
    expect(seen!.short.text).toBe("Slav Defense");
    expect(seen!.long.text).toBe(LONGEST_OPENING);
    expect(seen!.short.height).toBeGreaterThan(0);
    expect(seen!.long.height).toBe(seen!.short.height);
    expect(seen!.short.rect).toBe(at);
    expect(seen!.long.rect).toBe(at);
  }
});
