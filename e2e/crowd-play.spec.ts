import { readFileSync } from "node:fs";
import { expect } from "@playwright/test";
import { CROWD_SETTINGS } from "@chessroyale/core";
import { engineTop, expectCoordsInSquares, soloFromHome, submitMove, test } from "./helpers.ts";

/** Crowd's specs, part two (split from crowd.spec.ts on Nov 10, unchanged): the coordinates, the old options, and the board, scoreboard
 * and match screen that never move. */
const phase = (p: any) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

/** The longest name in the opening library (a Classic board's name, at any of its plies). */
const LONGEST_OPENING = (JSON.parse(readFileSync(new URL("../packages/chess/data/openings.json", import.meta.url), "utf8")) as { names: Record<string, string> }[])
  .flatMap((o) => Object.values(o.names))
  .reduce((a, b) => (b.length > a.length ? b : a), "");

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

test("a device that chose the old options (Everyone moves, Relaxed pace off) plays 50 v 50 at the mode's own pace", { tag: "@phone-only" }, async ({ page }) => {
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

test("the scoreboard never moves: its top edge, height and the middle box hold through two turns (phone)", async ({ page }) => {
  // (Nov 1: "I should never see the scoreboard container shifting up or down", a phone's locked screen.)
  test.setTimeout(4 * 60_000);
  test.skip(test.info().project.name !== "phone", "a phone's locked screen");
  await page.goto("/?debug&pace=quick&mode=crowd&augments=0");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|watching/);
  const tops = new Set<string>();
  const heights = new Set<string>();
  const middles = new Set<string>();
  const kinds = new Set<string>();
  let reveals = 0;
  let last = "";
  let submitted = "";
  let worstSpill = -Infinity;
  const stopAt = Date.now() + 3 * 60_000;
  while (reveals < 2 && Date.now() < stopAt) {
    const s = await page.evaluate(() => {
      const m = (window as any).match;
      const box = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return `${Math.round(r.top)} ${Math.round(r.height)}`;
      };
      const middleBox = () => document.querySelector(".screen.game > .play-footer") ?? document.querySelector(".screen.game > .poll");
      return {
        kind: (m?.phase.kind ?? "none") as string,
        fen: (m?.phase.board?.fen ?? "") as string,
        tower: box(document.querySelector(".screen.game .mini-tower")),
        middle: box(middleBox()),
        // The middle box's content fits it (nothing spills onto the scoreboard): how far its content runs past it.
        spill: (() => {
          const el = middleBox();
          return el ? el.scrollHeight - el.clientHeight : 0;
        })(),
      };
    });
    if (s.kind === "play" && s.fen !== submitted) {
      // (The engine's best move, or any legal one: a turn has to end for the next one to show.)
      const best = await engineTop(page, "judged", 12_000).catch(() => null);
      submitted = s.fen;
      await submitMove(page, best?.top[0]?.move, best?.fen);
    }
    if (s.kind !== last) {
      if (s.kind === "reveal") reveals++;
      last = s.kind;
    }
    if (["play", "watching", "reveal"].includes(s.kind) && s.tower) {
      kinds.add(s.kind);
      tops.add(s.tower.split(" ")[0]!);
      heights.add(s.tower.split(" ")[1]!);
      middles.add(s.middle ?? "none");
      if (s.middle) worstSpill = Math.max(worstSpill, s.spill);
    }
    await page.waitForTimeout(100);
  }
  expect(reveals, "two turns played").toBeGreaterThanOrEqual(2);
  expect([...kinds].sort(), "the phases seen with the scoreboard").toEqual(expect.arrayContaining(["play", "reveal"]));
  // The scoreboard's top edge and height are the same on every phase of both turns.
  expect([...tops], "scoreboard top edge").toHaveLength(1);
  expect([...heights], "scoreboard height").toHaveLength(1);
  // The middle box keeps its place and its height (the power-up row, the status and the vote results take turns in it).
  const mid = [...middles].map((v) => v.split(" "));
  expect(new Set(mid.map((v) => v[0])).size, "middle box top").toBe(1);
  expect(new Set(mid.map((v) => v[1])).size, "middle box height").toBe(1);
  // Nothing spills: the middle box's content never runs past its box (scrollHeight <= clientHeight), on every phase seen.
  expect(worstSpill, "the middle box was measured").toBeGreaterThan(Number.NEGATIVE_INFINITY);
  expect(worstSpill, "middle box content overflow, px (≤ 0: it fits)").toBeLessThanOrEqual(0);
});

test("the match screen's rows never move (Nov 8, Eric: nothing on the match screen moves): the power-up row, the status slot and the table keep one place through picking, move in and the other team's vote, at 390×844, 360×740 and a computer", async ({ page }) => {
  // One game, three sizes: each size plays a turn through picking ("Your pick for …": the status slot empty), move in
  // ("Move in. Waiting for other players") and the other team's vote ("… is voting"), and the row tops, the status slot's
  // top and height, and the table's top must be the same (within 1 px) in all three phases.
  test.setTimeout(10 * 60_000);
  await page.goto("/?debug&pace=quick&mode=crowd&augments=0");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|watching/);
  const snap = () =>
    page.evaluate(() => {
      const m = (window as any).match;
      const box = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, h: r.height };
      };
      const banner = document.querySelector(".screen.game .play-slot .waiting-banner");
      const text = banner?.textContent ?? "";
      const kind = (m?.phase.kind ?? "none") as string;
      const state = banner ? (/is voting/.test(text) ? "voting" : /Waiting for other players/.test(text) ? "move in" : "other") : kind === "play" ? "picking" : "other";
      return { state, fen: (m?.phase.board?.fen ?? "") as string, nav: box(".screen.game .history-nav"), slot: box(".screen.game .play-slot"), panel: box(".screen.game .mini-tower, .screen.game .under-board") };
    });
  // Phone sizes (the locked phone layout) and a computer's; the same game carries on through each.
  for (const vp of [
    { width: 390, height: 844 },
    { width: 360, height: 740 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(vp);
    const name = `${vp.width}×${vp.height}`;
    // (The screens re-fit a moment after a resize (their resize listeners): wait until the power-up row holds still for 300 ms, so the
    // first phase isn't snapped mid re-fit. Nov 13: a desktop run's first snapshot at 390×844 was taken before it settled.)
    let held = "";
    let since = Date.now();
    await expect
      .poll(
        async () => {
          const t = await page.evaluate(() => String(document.querySelector(".screen.game .history-nav")?.getBoundingClientRect().top ?? ""));
          if (t !== held) ((held = t), (since = Date.now()));
          return t !== "" && Date.now() - since >= 300;
        },
        { message: `the layout settles at ${name}`, intervals: [50], timeout: 10_000 },
      )
      .toBe(true);
    const seen = new Map<string, Awaited<ReturnType<typeof snap>>>();
    let submitted = "";
    const stopAt = Date.now() + 3 * 60_000;
    while (seen.size < 3 && Date.now() < stopAt) {
      const s = await snap();
      if (s.state === "picking" && s.fen !== submitted) {
        // (The engine's best move, or any legal one: the turn has to end for the next phase to show.)
        submitted = s.fen;
        const best = await engineTop(page, "judged", 12_000).catch(() => null);
        await submitMove(page, best?.top[0]?.move, best?.fen);
      }
      if (["picking", "move in", "voting"].includes(s.state) && s.nav && s.slot && s.panel && !seen.has(s.state)) seen.set(s.state, s);
      await page.waitForTimeout(100);
    }
    expect([...seen.keys()].sort(), `the three phases seen at ${name}`).toEqual(["move in", "picking", "voting"]);
    const all = [...seen.values()];
    const spread = (f: (s: (typeof all)[number]) => number) => Math.max(...all.map(f)) - Math.min(...all.map(f));
    expect(spread((s) => s.nav!.top), `power-up row top at ${name}, px`).toBeLessThanOrEqual(1);
    expect(spread((s) => s.slot!.top), `status slot top at ${name}, px`).toBeLessThanOrEqual(1);
    expect(spread((s) => s.slot!.h), `status slot height at ${name}, px`).toBeLessThanOrEqual(1);
    expect(spread((s) => s.panel!.top), `table top at ${name}, px`).toBeLessThanOrEqual(1);
  }
});

test("the scoreboard box is built once: the same element and header, the same box, through picking, the reveal, the next turn and a cut (phone)", async ({ page }) => {
  // (Eric, Nov 1: "the container should be static, and anything inside of it should be… fading in and out and moving,
  // but not flashing". Each phase of a turn is a screen of its own, and each built the box anew: three rows on its first
  // frame, the rest wiping in. Now it's one element for the match: QuickChat.tsx, KeptBox.)
  test.setTimeout(5 * 60_000);
  test.skip(test.info().project.name !== "phone", "a phone's locked screen");
  await page.setViewportSize({ width: 390, height: 750 });
  // (A cut after each team's move; loose bots, so you're through it and see the box again.)
  await page.goto("/?debug&pace=quick&mode=crowd&augments=0&rounds=2&clock=20&weakbots=1");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|watching/);
  // A bots-only game has the chat tab too (Eric, Nov 1).
  await expect(page.locator(".screen.game > .under-board .mini-chat-tab")).toBeVisible();
  // Every frame: which box element, which header, the box's place and size, and how many rows it shows.
  await page.evaluate(() => {
    const w = window as any;
    const b = (w.__box = { els: [] as Element[], heads: [] as Element[], boxes: [] as string[], fewest: Infinity, seq: [] as string[] });
    const tick = () => {
      const kind = w.match?.phase.kind ?? "none";
      if (b.seq.at(-1) !== kind) b.seq.push(kind);
      const el = document.querySelector(".screen.game > .under-board");
      if (el) {
        if (!b.els.includes(el)) b.els.push(el);
        const head = el.querySelector(".mini-tower-head");
        if (head && !b.heads.includes(head)) b.heads.push(head);
        const r = el.getBoundingClientRect();
        const at = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
        if (!b.boxes.includes(at)) b.boxes.push(at);
        b.fewest = Math.min(b.fewest, el.querySelectorAll(".tower-row").length);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const seq = () => page.evaluate(() => (window as any).__box.seq as string[]);
  // Until the box is back after a cut, having seen your pick, a reveal and the other team's turn.
  const done = (s: string[]) => {
    const cut = s.indexOf("stageBreak");
    return cut > 0 && ["play", "reveal", "watching"].every((k) => s.slice(0, cut).includes(k)) && s.slice(cut).some((k) => k === "play" || k === "watching");
  };
  let submitted = "";
  const stopAt = Date.now() + 4 * 60_000;
  while (Date.now() < stopAt && !done(await seq())) {
    if ((await phase(page)) === "play") {
      const fen: string = await page.evaluate(() => (window as any).match.phase.board?.fen ?? "");
      if (fen && fen !== submitted) {
        submitted = fen;
        const pick = await page.evaluate(() => [...((window as any).match.runner.planned?.values() ?? [])][0] as string | undefined);
        await submitMove(page, pick, fen);
      }
    }
    await page.waitForTimeout(200);
  }
  const b = await page.evaluate(() => {
    const b = (window as any).__box;
    return { els: b.els.length, heads: b.heads.length, boxes: b.boxes, fewest: b.fewest, seq: b.seq };
  });
  const where = JSON.stringify(b);
  expect(done(b.seq), where).toBe(true);
  // One box element and one header for the match (a screen of its own no longer builds them anew).
  expect(b.els, where).toBe(1);
  expect(b.heads, where).toBe(1);
  // Its place and size never change.
  expect(b.boxes, where).toHaveLength(1);
  // Never the three rows of a scoreboard that hasn't measured its box yet (on a 390 × 750 phone it shows about nine).
  expect(b.fewest, where).toBeGreaterThan(3);
});
