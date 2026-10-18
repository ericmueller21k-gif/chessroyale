import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_POWERS, SAWYER_LOOKS } from "@chessroyale/core";
import { chooseCut } from "@chessroyale/chess";
import { BOARD_SEL, engineTop, test, watchFor, bossAloneFromHome } from "./helpers.ts";
import { REFUSED, REFUSED_MS, REFUSED_OTHER, THROUGH } from "../packages/app/src/refused.ts";

/**
 * Sawyer, the raccoon with a saw, played alone on a phone and a computer with real taps: his first move a pawn's and
 * the split once there's room for another pawn of his (SPLIT PAWN!, he leaps onto the pawn, it cracks and morphs into
 * two small whole pawns that land and grow to a pawn's size, or with SAWYER_LOOKS.split "halves" the two halves come
 * apart and stay drawn as halves), your move's knock first, the board saw (?power=boardsaw: BOARD SAW!, he saws up the middle, the board jolts and splits
 * with a gap; no moves or move dots across it), a saw cut (SAW CUT!, the groove on its edge, no move across it), the
 * cut taped over and healing away and the halves rejoining (the admins' trigger), his sounds through the mute switch.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const powers = (p: Page) => p.evaluate(() => (window as any).match?.boss?.powers ?? null).catch(() => null);
const soundsHeard = (p: Page) => p.evaluate(() => ((window as any).__soundLog ?? []) as string[]);

async function squareAt(page: Page, square: string) {
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
  const flip = (await page.evaluate(() => (window as any).match.boss?.crowdSide)) === "b";
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
}
const tap = async (page: Page, square: string) => {
  const q = await squareAt(page, square);
  await page.mouse.click(q.x, q.y);
};
async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}
async function play(page: Page, move: string) {
  await yourMove(page);
  for (let i = 0; i < 5 && (await phase(page)) === "play"; i++) {
    await tap(page, move.slice(0, 2));
    await tap(page, move.slice(2, 4));
    await page.waitForTimeout(300);
  }
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
}
/**
 * The crowd's moves now, ranked as the judge ranks them (his cuts' limits kept), best first, never one that ends the
 * battle (mate or stalemate: these tests need it to go on, and the engine's best moves mated him before his split now
 * and then, docs/decisions/2026-10-16-flaky-e2e-batch-3.md); its quiet moves (no castling: its knock is "castle"); its
 * pawn takes.
 */
async function ranked(page: Page) {
  await yourMove(page);
  const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  const goesOn = (mv: string) => {
    const after = new Chess(fen);
    after.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] ?? "q" });
    return !after.isGameOver();
  };
  const top = ((await engineTop(page)).top as { move: string; expected: number }[]).filter((m) => goesOn(m.move));
  const moves = new Chess(fen).moves({ verbose: true }).filter((m) => !m.promotion);
  return {
    top,
    quiet: moves.filter((m) => !m.captured && !/[kq]/.test(m.flags)).map((m) => m.from + m.to),
    takes: moves.filter((m) => m.captured === "p").map((m) => m.from + m.to),
  };
}
/**
 * An allowed move once it's your move that doesn't lose (within a tenth of the best's expected score: such a move never
 * walks into a quick mate, which ended the battle early now and then, Oct 15): `want`'s first, else the best quiet one,
 * else the best. `quiet`: a quiet move whatever (the knock test).
 */
async function allowedMove(page: Page, want: string[] = [], opts: { quiet?: boolean } = {}): Promise<string> {
  const { top, quiet } = await ranked(page);
  const fine = top.filter((m) => m.expected >= top[0]!.expected - 0.1).map((m) => m.move);
  const pick = want.find((m) => fine.includes(m) && (!opts.quiet || quiet.includes(m))) ?? fine.find((m) => quiet.includes(m));
  if (pick) return pick;
  return opts.quiet ? (top.map((m) => m.move).find((m) => quiet.includes(m)) ?? quiet[0]!) : fine[0]!;
}
const file = (sq: string) => sq.charCodeAt(0) - 97;
const crossesMiddle = (m: string) => file(m.slice(0, 2)) <= 3 !== file(m.slice(2, 4)) <= 3;
/** How opaque a canvas over the board is at a point between two squares' middles (`k` of the way from a to b). */
const coveredBetween = (page: Page, a: string, b: string, canvas: string, k = 0.5) =>
  Promise.all([squareAt(page, a), squareAt(page, b)]).then(([qa, qb]) =>
    page
      .locator(canvas)
      .first()
      .evaluate((c: HTMLCanvasElement, [x, y]) => {
        const r = c.getBoundingClientRect();
        return c.getContext("2d")!.getImageData(Math.floor(((x! - r.left) / r.width) * c.width), Math.floor(((y! - r.top) / r.height) * c.height), 1, 1).data[3];
      }, [qa.x + (qb.x - qa.x) * k, qa.y + (qb.y - qa.y) * k]),
  );
/** The move dots on screen now, as squares (from their boxes). */
async function dotSquares(page: Page): Promise<string[]> {
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
  const boxes = await page.locator(`${BOARD_SEL.square}.move-dest`).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
  return boxes.map(([x, y]) => `${"abcdefgh"[Math.floor(((x! - board.x) / board.width) * 8)]}${8 - Math.floor(((y! - board.y) / board.height) * 8)}`);
}

/** The split in the air (the morph's small whole pawns, two at once; or a half), and how the board draws the pair after. */
const morph = SAWYER_LOOKS.split === "morph";
const inAir = morph ? "piece.sw-mini:not(.saw-half-l):not(.saw-half-r) + piece.sw-mini:not(.saw-half-l):not(.saw-half-r)" : "piece.sw-half";
const pairLook = morph ? (SAWYER_LOOKS.settle === "small" ? "small" : null) : "halves";

/**
 * Until the split comes: a move that takes one of his pawns (so his split gets its room: the engine plays no ninth pawn)
 * if one costs little (within a fifth of the best's expected score: never a piece for it), else the engine's best. A
 * crowd that took any pawn it could, or drifted on the quiet moves, now and then lost before the split (Oct 15).
 */
async function roomMove(page: Page): Promise<string> {
  const { top, takes } = await ranked(page);
  return top.find((m) => takes.includes(m.move) && m.expected >= top[0]!.expected - 0.2)?.move ?? top[0]!.move;
}

test("Sawyer: his first move a pawn's, then the split (two small whole pawns that grow; or halves) once there's room; your move's knock; his saw cuts", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&boss=sawyer&laststand=0");
  await bossAloneFromHome(page);
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).match.boss.name)).toBe("Sawyer");

  // Move 1, after a real think: your move's knock is the first sound heard. His reply is a pawn move.
  await yourMove(page);
  await page.waitForTimeout(2500);
  await page.evaluate(() => ((window as any).__soundLog = []));
  const before = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  let split = await watchFor(page, {
    banner: { selector: ".fight-banner.power-cut", text: /SPLIT PAWN!/ },
    boy: { selector: ".pm-split .sw-boy" },
    saw: { selector: '.sw-layer[data-split="saw"]' },
    crack: { selector: ".sw-layer .sw-crack" },
    apart: { selector: `.sw-layer[data-split="apart"] ${inAir}` },
    line: { selector: ".bc-bubble", text: /Two for one!|Half off!|Double trouble!/ },
  });
  // (A quiet move: its knock is the plain move's.)
  await play(page, await allowedMove(page, ["g1f3", "b1c3", "g8f6", "b8c6", "h2h3", "h7h6"], { quiet: true }));
  await expect.poll(async () => (await soundsHeard(page)).map((s) => s.split(":")[0]), { timeout: 10_000 }).toContain("move");
  expect((await soundsHeard(page))[0]!.split(":")[0]).toBe("move");
  await yourMove(page);
  const first = await page.evaluate(() => (window as any).match.boss);
  const mine = first.crowdSide === "w" ? "b" : "w";
  const mid = new Chess(before);
  mid.move({ from: first.board.history.at(-2).slice(0, 2), to: first.board.history.at(-2).slice(2, 4), promotion: "q" });
  expect(mid.get(first.board.history.at(-1).slice(0, 2) as never)).toMatchObject({ type: "p", color: mine });

  // Until the split comes (at once, or after his first pawn move once one of his pawns is gone): take his pawns when
  // that costs little (roomMove). Any saw cut on the way: nothing crosses it, and its groove is on its edge.
  let cuts = 0;
  for (let i = 0; i < 20 && !(await powers(page))?.split?.square; i++) {
    const p = await powers(page);
    if (p.cut && !cuts) {
      cuts++;
      await expect(page.locator(`.sw-cut[data-cut="${p.cut.a}-${p.cut.b}"]`)).toHaveCount(1);
      await expect.poll(() => coveredBetween(page, p.cut.a, p.cut.b, ".sw-cut-board", 0.47), { timeout: 5000 }).toBeGreaterThan(0);
      expect(await coveredBetween(page, p.cut.a, p.cut.b, ".sw-cut-board", 0)).toBe(0);
      for (const m of p.allowed ?? []) expect([`${p.cut.a}${p.cut.b}`, `${p.cut.b}${p.cut.a}`]).not.toContain(m);
    }
    split = await watchFor(page, {
      banner: { selector: ".fight-banner.power-cut", text: /SPLIT PAWN!/ },
      boy: { selector: ".pm-split .sw-boy" },
      saw: { selector: '.sw-layer[data-split="saw"]' },
      crack: { selector: ".sw-layer .sw-crack" },
      apart: { selector: `.sw-layer[data-split="apart"] ${inAir}` },
      line: { selector: ".bc-bubble", text: /Two for one!|Half off!|Double trouble!/ },
    });
    await play(page, await roomMove(page));
    await yourMove(page);
  }
  const boss = await page.evaluate(() => (window as any).match.boss);
  const sp = boss.powers.split;
  expect(sp.square, "the split came").toBeTruthy();
  expect(await split.seen()).toEqual({ banner: true, boy: true, saw: true, crack: true, apart: true, line: true });
  // The new pawn beside his pawn, both his. The morph's "grow": drawn as ordinary pawns (nothing marked or clipped);
  // kept small: both marked small; halves: each drawn as its half (the one away from its partner).
  expect(sp.square[1]).toBe(sp.pawn[1]);
  expect(Math.abs(file(sp.square) - file(sp.pawn))).toBe(1);
  const pieces = new Chess(boss.board.fen);
  for (const h of sp.halves) expect(pieces.get(h.square)).toMatchObject({ type: "p", color: mine });
  const halves = await page.evaluate((pieces) => [...document.querySelectorAll<HTMLElement>(`${pieces}.saw-half-l, ${pieces}.saw-half-r`)].map((e) => `${e.dataset.square}:${e.classList.contains("saw-half-l") ? "l" : "r"}`).sort(), BOARD_SEL.piece);
  const small = await page.evaluate((pieces) => [...document.querySelectorAll<HTMLElement>(`${pieces}.saw-small`)].map((e) => e.dataset.square as string).sort(), BOARD_SEL.piece);
  const w = boss.crowdSide === "w";
  expect(halves).toEqual(pairLook === "halves" ? sp.halves.map((h: { square: string; side: string }) => `${h.square}:${(h.side === "a") === w ? "l" : "r"}`).sort() : []);
  expect(small).toEqual(pairLook === "small" ? sp.halves.map((h: { square: string }) => h.square).sort() : []);
  if (pairLook === "halves") {
    const clip = await page.locator(`${BOARD_SEL.piece}.saw-half-l, ${BOARD_SEL.piece}.saw-half-r`).first().evaluate((e) => getComputedStyle(e).clipPath);
    expect(clip).toContain("50%");
  }
  // (Never a ninth pawn: the engine plays every position.)
  expect([...boss.board.fen.split(" ")[0]].filter((c) => c === (mine === "w" ? "P" : "p")).length).toBeLessThanOrEqual(8);
  expect(errors).toEqual([]);
});

test("Sawyer's board saw (?power=boardsaw): he saws up the middle, the board splits with a gap, nothing crosses it; the cut waits a turn; his sounds through mute", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("brc.muted", "1"));
  await page.goto("/?debug&clock=60&boss=sawyer&power=boardsaw&laststand=0");
  await bossAloneFromHome(page);
  await yourMove(page);
  await page.evaluate(() => ((window as any).__soundLog = []));
  await play(page, await allowedMove(page, ["g1f3", "b1c3", "g8f6", "b8c6"]));
  await yourMove(page);
  // The test switch warned of it as the 2nd turn began; it comes as the 3rd begins.
  expect((await powers(page)).warned).toBe(true);
  const saw = await watchFor(page, {
    banner: { selector: ".fight-banner.power-cut", text: /BOARD SAW!/ },
    run: { selector: '.sw-layer[data-boardsaw="run"] .sw-boy' },
    groove: { selector: '.sw-gap[data-state="run"]' },
    part: { selector: '.sw-gap[data-state="part"]' },
    jolt: { selector: ".board-area.pw-crash" },
    line: { selector: ".bc-bubble", text: /Timber!|Renovation time!|Down the middle!/ },
  });
  await play(page, await allowedMove(page, ["b1c3", "g1f3", "h2h3", "b8c6", "g8f6", "h7h6"]));
  await yourMove(page);
  expect(await saw.seen()).toEqual({ banner: true, run: true, groove: true, part: true, jolt: true, line: true });
  const p3 = await powers(page);
  expect(p3.boardSaw).toEqual({ at: 3, until: 7 });
  await expect(page.locator('.sw-gap[data-state="gap"]')).toBeVisible();
  // The gap sits on the line between the d and e files, the board's whole height.
  const gap = (await page.locator(".sw-gap").boundingBox())!;
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
  expect(Math.abs(gap.x + gap.width / 2 - (board.x + board.width / 2))).toBeLessThanOrEqual(1.5);
  expect(gap.height).toBeGreaterThan(board.height - 2);
  // Nothing crosses it: not in the allowed moves, no move dots across it. When it stops none of the crowd's legal moves
  // (his move gave check and every answer stays on its half: "Check! Shield the king." on CI, Oct 18) there are no
  // allowed moves (null: every legal move is); likewise when it would stop them all (a limit never leaves none).
  const fen3 = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  const legal3 = new Chess(fen3).moves({ verbose: true }).map((m) => m.from + m.to);
  if (p3.allowed) {
    expect(p3.allowed.length).toBeGreaterThan(0);
    for (const m of p3.allowed) expect(crossesMiddle(m)).toBe(false);
  } else expect([0, legal3.length], fen3).toContain(legal3.filter(crossesMiddle).length);
  // (A piece with moves both across and not: its dots stay on its half. Now and then the position has none.)
  const across = new Chess(fen3).moves({ verbose: true }).find((m) => crossesMiddle(m.from + m.to) && (p3.allowed ?? []).some((a: string) => a.startsWith(m.from)));
  if (across) {
    await tap(page, across.from);
    await expect(page.locator(`${BOARD_SEL.square}.move-dest`).first()).toBeVisible();
    for (const sq of await dotSquares(page)) expect(file(sq) <= 3, `${across.from} → ${sq}`).toBe(file(across.from) <= 3);
    await tap(page, across.from);
  }
  // The cut due on the 3rd turn waited for the saw: it comes on the next turn with an edge for it (between two squares
  // of the crowd's half, crossed by one of its legal moves: chooseCut), the 4th, unless his move left none (a check
  // answered only diagonally, by a knight or outside the crowd's half: "Your king's in check!" at move 4 on CI, Oct 18).
  // Then it waits a turn more.
  expect(p3.cut ?? null).toBeNull();
  const cutSeen = await watchFor(page, { banner: { selector: ".fight-banner.power-cut", text: /SAW CUT!/ }, caster: { selector: ".pm-cut .pm-caster" } });
  const crowd = await page.evaluate(() => (window as any).match.boss.crowdSide as "w" | "b");
  for (;;) {
    await play(page, await allowedMove(page, ["h2h3", "a2a3", "h7h6", "a7a6"]));
    await yourMove(page);
    const now = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, p: (window as any).match.boss.powers }));
    // (Whether there's an edge for it, not which: the seed only picks among them.)
    if (chooseCut(now.fen, crowd, 0, now.p.turn)) {
      expect(now.p.cut).toMatchObject({ at: now.p.turn, until: now.p.turn + BOSS_POWERS.sawTurns - 1 });
      break;
    }
    expect(now.p.cut ?? null, `turn ${now.p.turn}: no edge for a cut in ${now.fen}`).toBeNull();
    expect(now.p.turn, "a cut within three turns of the saw's").toBeLessThan(6);
  }
  expect(await cutSeen.seen()).toEqual({ banner: true, caster: true });
  // His sounds came, and through the mute switch, silent.
  const heard = (await soundsHeard(page)).filter((x) => x.startsWith("sawyer"));
  expect(heard.map((x) => x.split(":")[0])).toEqual(expect.arrayContaining(["sawyerHop", "sawyerRev", "sawyerBigSaw", "sawyerCut"]));
  for (const x of heard) expect(x).toMatch(/:muted$/);
  expect(errors).toEqual([]);
});

/** Your profile says you're an admin (as /api/me does for an email in ADMIN_EMAILS). */
async function asAdmin(page: Page) {
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const body = await res.json().catch(() => null);
    await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
  });
}

test("Sawyer's board saw on Maia (Eric, Oct 17): his moves never cross it while it's up; a move of yours across it stays put and the dock says why", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // (An admin: the boss on Maia, no guard, as Eric played him, and the brain's debug line to read.)
  await asAdmin(page);
  await page.addInitScript(() => localStorage.setItem("brc.muted", "1"));
  await page.goto("/?debug&clock=60&boss=sawyer&power=boardsaw&laststand=0");
  await bossAloneFromHome(page);
  // The test switch: warned as the 2nd turn begins, the saw as the 3rd, up to the 7th; it's gone as the 8th begins.
  await play(page, await allowedMove(page, ["g1f3", "b1c3", "g8f6", "b8c6"]));
  await play(page, await allowedMove(page, ["b1c3", "g1f3", "h2h3", "b8c6", "g8f6", "h7h6"]));
  let before: string | null = null;
  let tried = false;
  const brains: string[] = [];
  for (let turn = 3; turn <= 8; turn++) {
    await yourMove(page);
    const now = await page.evaluate(() => {
      const m = (window as any).match;
      return { fen: m.phase.board.fen as string, lastMove: m.boss.lastMove as { move: string; through?: string } | null, powers: m.boss.powers, brain: (m.brainLine as string | null) ?? "" };
    });
    if (before) {
      // His reply from `before`, under the saw: never across it, unless every move he had crossed it (then the dock
      // says so).
      const his = now.lastMove!.move;
      brains.push(now.brain);
      if (crossesMiddle(his)) {
        expect(new Chess(before).moves({ verbose: true }).every((m) => crossesMiddle(m.from + m.to)), `${his} from ${before}`).toBe(true);
        expect(now.lastMove!.through).toBe("boardsaw");
        await expect(page.locator(".boss-dock .through-note")).toHaveText(THROUGH.boardsaw);
      } else expect(now.lastMove!.through, `${his} from ${before}`).toBeUndefined();
    }
    if (turn === 8) {
      expect(now.powers.boardSaw ?? null).toBeNull();
      break;
    }
    expect(now.powers.boardSaw).toEqual({ at: 3, until: 7 });
    if (!tried) {
      // A move of yours across the saw (legal in chess): tapped, it stays put, and the dock says why for a moment.
      const across = new Chess(now.fen).moves({ verbose: true }).find((m) => crossesMiddle(m.from + m.to) && !m.promotion);
      if (across) {
        await tap(page, across.from);
        await tap(page, across.to);
        await expect(page.locator(".boss-dock .refused-note")).toHaveText("The board saw blocks that move.");
        expect(await phase(page)).toBe("play");
        expect(await page.evaluate(() => (window as any).match.phase.board.fen)).toBe(now.fen);
        // Every one of these lines is whole in the dock's two lines (its box clamps and hides the rest), at this size
        // and on narrow phones (112 px of room at 320), measured in the real font and box, each in its own element.
        const lines = [...[...Object.values(REFUSED), REFUSED_OTHER].map((l) => ["refused-note", l]), ...Object.values(THROUGH).map((l) => ["through-note", l])];
        const cut = () =>
          page.evaluate((all) => {
            // (A stand-in for the line, as the dock's only child, as Play.tsx draws it; the dock's own put back after.)
            const dk = document.querySelector(".boss-dock .dk-text")!;
            const kids = [...dk.childNodes];
            const probe = document.createElement("span");
            dk.replaceChildren(probe);
            const out = all.filter(([cls, l]) => {
              probe.className = cls!;
              probe.textContent = l!;
              return probe.scrollHeight > probe.clientHeight + 1;
            });
            dk.replaceChildren(...kids);
            return out.map(([, l]) => l);
          }, lines);
        expect(await cut()).toEqual([]);
        if (test.info().project.name === "phone") {
          const size = page.viewportSize()!;
          for (const width of [360, 320]) {
            await page.setViewportSize({ width, height: 664 });
            await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
            expect(await cut(), `${width} px`).toEqual([]);
          }
          await page.setViewportSize(size);
        }
        // Then "Your move." again.
        await expect(page.locator(".boss-dock .dk-text")).toContainText("Your move.", { timeout: 5_000 });
        tried = true;
      }
    }
    const mine = await allowedMove(page, ["h2h3", "a2a3", "h7h6", "a7a6", "g2g3", "b2b3", "g7g6", "b7b6"]);
    expect(crossesMiddle(mine)).toBe(false);
    const after = new Chess(now.fen);
    after.move({ from: mine.slice(0, 2), to: mine.slice(2, 4), promotion: mine[4] ?? "q" });
    before = after.fen();
    await play(page, mine);
  }
  // Five replies of his under the saw, at least one of them Maia's own (the path Eric met: Maia, no guard).
  expect(brains.length).toBe(5);
  expect(brains.filter((l) => /Maia \d+ · no guard · Maia's/.test(l)).length, brains.join(" | ")).toBeGreaterThanOrEqual(1);
  expect(tried).toBe(true);
  expect(errors).toEqual([]);
});

/** Eric's position (Oct 17), the move before his Nh5-f6+: then the boss's only move is Qd8xf6, across the board saw. */
const ERIC_BEFORE = "3qk2r/1q4Q1/1p1p4/3PpP1N/4PP2/8/1p3K2/7R w - - 0 35";
/** A position with the colors swapped and the board turned top to bottom (the files, so the saw, stay put), and its moves. */
const mirror = (fen: string) => {
  const [rows, side, ...rest] = fen.split(" ");
  const swap = (c: string) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase());
  return [rows!.split("/").reverse().map((r) => [...r].map(swap).join("")).join("/"), side === "w" ? "b" : "w", ...rest].join(" ");
};
const mirrorMove = (m: string) => m[0]! + (9 - Number(m[1])) + m[2]! + (9 - Number(m[3])) + m.slice(4);

test("Sawyer's board saw lifted for his only move (Eric's position, Oct 17): Qxf6 across it, and the dock says so through your whole turn, whole at 320 px", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && /boss move refused/.test(m.text()) && errors.push(m.text()));
  await page.addInitScript(() => localStorage.setItem("brc.muted", "1"));
  await page.goto("/?debug&clock=60&boss=sawyer&power=boardsaw&laststand=0");
  await bossAloneFromHome(page);
  // The test switch: the saw from the 3rd turn to the 7th.
  await play(page, await allowedMove(page, ["g1f3", "b1c3", "g8f6", "b8c6"]));
  await play(page, await allowedMove(page, ["b1c3", "g1f3", "h2h3", "b8c6", "g8f6", "h7h6"]));
  await yourMove(page);
  expect((await powers(page)).boardSaw).toEqual({ at: 3, until: 7 });
  // On the phone, a narrow one from here on (the dock's text has 112 px at 320).
  if (test.info().project.name === "phone") {
    await page.setViewportSize({ width: 320, height: 664 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  // (First the turn's own searches on the old position: the round's plan reads the board again after its search, so
  // a position changed under it would mix the two, which play never does: a move waits for the plan.)
  await page.evaluate(() => {
    const w = window as any;
    w.__planned = false;
    void Promise.resolve(w.match.runner.planning).then(() => (w.__planned = true), () => (w.__planned = "failed"));
  });
  await expect.poll(() => page.evaluate(() => (window as any).__planned), { timeout: 30_000 }).toBe(true);
  // Eric's position on the runner and the screen's board, as the unit test sets it (r.boards.set, r.state): his split
  // done, no cut. You White, as Eric was; when this battle made you Black, the same position with the colors swapped.
  const white = (await page.evaluate(() => (window as any).match.boss.crowdSide)) === "w";
  const mv = (m: string) => (white ? m : mirrorMove(m));
  const before = white ? ERIC_BEFORE : mirror(ERIC_BEFORE);
  await page.evaluate((fen) => {
    const m = (window as any).match;
    const r = m.runner;
    const id = r.state.boards[0];
    const b = r.boards.get(id);
    const ply = b.history.length;
    const bases = [...(b.bases ?? []).filter((x: { ply: number }) => x.ply !== ply), { ply, fen }];
    r.boards.set(id, { ...b, fen, bases, lastMove: null });
    const boss = r.state.boss;
    r.state = { ...r.state, boss: { ...boss, powers: { ...boss.powers, split: { turn: 2, pawn: null, square: null, halves: [] }, cut: null } } };
    m.phase = { ...m.phase, board: { ...m.phase.board, fen, bases, lastMove: null } };
    m.emit();
  }, before);
  // Your Qxb7 across the saw (the "glitch"): it stays put, and the dock says why.
  await tap(page, mv("g7b7").slice(0, 2));
  await tap(page, mv("g7b7").slice(2, 4));
  await expect(page.locator(".boss-dock .refused-note")).toHaveText(REFUSED.boardsaw);
  await expect(page.locator(".boss-dock .dk-text")).toContainText("Your move.", { timeout: 5_000 });
  // Every frame from here to your next move: the phase, the board, the dock's line, and whether it's whole.
  await page.evaluate(() => {
    const w = window as any;
    w.__dock = [];
    const step = () => {
      const note = document.querySelector<HTMLElement>(".boss-dock .through-note");
      w.__dock.push({ t: Date.now(), kind: w.match.phase.kind, fen: w.match.phase.board?.fen ?? "", text: document.querySelector(".boss-dock .dk-text")?.textContent ?? "", whole: note ? note.scrollHeight <= note.clientHeight + 1 : null });
      if (!w.__dockDone) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  // Nf6+: his only move is Qxf6, across the saw (the limit lifts for it).
  await play(page, mv("h5f6"));
  await yourMove(page);
  const his = await page.evaluate(() => (window as any).match.boss.lastMove as { move: string; through?: string });
  expect(his).toMatchObject({ move: mv("d8f6"), through: "boardsaw" });
  const after = new Chess(before);
  for (const m of [mv("h5f6"), mv("d8f6")]) after.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
  const rows = after.fen().split(" ")[0]!;
  expect((await page.evaluate(() => (window as any).match.phase.board.fen as string)).split(" ")[0]).toBe(rows);
  // Your turn: the line stays (past a refusal's few seconds too), then your move, picked and tapped.
  await page.waitForTimeout(REFUSED_MS + 1000);
  const mine = await allowedMove(page);
  await play(page, mine);
  const frames = (await page.evaluate(() => {
    const w = window as any;
    w.__dockDone = true;
    return w.__dock;
  })) as { t: number; kind: string; fen: string; text: string; whole: boolean | null }[];
  const turn = frames.filter((f) => f.kind === "play" && f.fen.split(" ")[0] === rows);
  expect(turn.length).toBeGreaterThan(0);
  expect(turn.at(-1)!.t - turn[0]!.t).toBeGreaterThan(REFUSED_MS + 1000);
  // (Only the line in the dock, whole in its two lines, on every frame of the turn.)
  expect([...new Set(turn.map((f) => `${f.text} · ${f.whole}`))]).toEqual([`${THROUGH.boardsaw} · true`]);
  // (And those frames are the whole turn, one run from the boss's move showing to your move going in.)
  const first = frames.indexOf(turn[0]!);
  const last = frames.indexOf(turn.at(-1)!);
  expect(frames[first - 1]?.kind).toBe("boss");
  expect(frames.slice(first, last + 1).every((f) => f.kind === "play")).toBe(true);
  expect(frames[last + 1]?.kind ?? "none").not.toBe("play");
  expect(errors).toEqual([]);
});

test("Sawyer: the board saw from the admins' trigger, a cut taped over and healing, the halves rejoining", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await asAdmin(page);
  await page.goto("/?debug&clock=60&boss=sawyer&laststand=0");
  await bossAloneFromHome(page);
  await yourMove(page);
  const btn = page.locator(".ult-test");
  await btn.click();
  await expect(btn).toHaveText("Ultimate next turn (testing)");
  const both = await watchFor(page, { split: { selector: ".fight-banner.power-cut", text: /SPLIT PAWN!/ }, saw: { selector: ".fight-banner.power-cut", text: /BOARD SAW!/ } });
  await play(page, await allowedMove(page, ["g1f3", "b1c3"]));
  await yourMove(page);
  // (The split too, on the same turn, when there was room for it.)
  expect(await both.seen()).toEqual({ split: !!(await powers(page)).split?.square, saw: true });
  expect((await powers(page)).boardSaw).toEqual({ at: 2, until: 6 });
  // Under way while the halves are apart (no other can come meanwhile); the meter empty and held.
  await expect(btn).toHaveText("Ultimate under way (testing)");
  await expect(btn).toBeDisabled();
  expect((await powers(page)).rage).toBe(1);

  // The cut on the 3rd turn: raw, then taped (stage 1), more tape (stage 2), then healing away.
  await play(page, await allowedMove(page, ["h2h3", "a2a3"]));
  await yourMove(page);
  const cut = (await powers(page)).cut;
  expect(cut).toMatchObject({ at: 3, until: 5 });
  for (const stage of [0, 1, 2]) {
    await expect(page.locator(`.sw-cut[data-cut="${cut.a}-${cut.b}"][data-stage="${stage}"]`)).toHaveCount(1);
    await expect.poll(() => coveredBetween(page, cut.a, cut.b, ".sw-cut-board", 0.47), { timeout: 5000 }).toBeGreaterThan(0);
    await play(page, await allowedMove(page, ["a2a3", "h2h3", "a3a4", "h3h4"]));
    await yourMove(page);
  }
  // Turn 6: the cut is gone; its tape has faded away.
  expect((await powers(page)).cut ?? null).toBeNull();
  await expect(page.locator(".sw-cut")).toHaveCount(0);
  await expect.poll(() => page.locator(".sw-cut-board").count(), { timeout: 5000 }).toBe(0);
  // Turn 7: the board saw is over: the halves close up and rejoin.
  expect((await powers(page)).boardSaw).toEqual({ at: 2, until: 6 });
  const close = await watchFor(page, { close: { selector: '.sw-gap[data-state="close"]' } });
  await play(page, await allowedMove(page, ["a3a4", "h3h4", "a4a5", "h4h5"]));
  await yourMove(page);
  expect((await powers(page)).boardSaw ?? null).toBeNull();
  expect((await close.seen()).close).toBe(true);
  await expect.poll(() => page.locator(".sw-gap").count(), { timeout: 5000 }).toBe(0);
  // Moves across the middle are back.
  const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  const allowed = (await powers(page)).allowed ?? new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to);
  expect(allowed.some(crossesMiddle)).toBe(new Chess(fen).moves({ verbose: true }).some((m) => crossesMiddle(m.from + m.to)));
  expect(errors).toEqual([]);
});

/**
 * Here because it showed here (Oct 15: "ExitStatus" page errors now and then in this spec's errors check): Stockfish 19
 * ends its process on a position it refuses, and in a browser that exit was thrown into the page. The game's engine
 * never sends such a position (stockfishRefuses), and a worker's error, whatever its cause, stays in the worker.
 */
test("Stockfish: a position it refuses is never sent, and a worker's exit never reaches the page as an error; the engine answers on", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  test.setTimeout(3 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&boss=sawyer&laststand=0");
  await bossAloneFromHome(page);
  await yourMove(page);
  const NINE_PAWNS = "4k3/8/8/8/8/P7/PPPPPPPP/4K3 w - - 0 1";
  const ask = (fen: string | null) =>
    page.evaluate((fen) => {
      const m = (window as any).match;
      (window as any).__answer = null;
      void m.engines[0].topMoves(fen ?? m.phase.board.fen, 1).then((t: unknown) => ((window as any).__answer = t));
    }, fen);
  const answer = () => page.evaluate(() => (window as any).__answer);
  // The game's engine doesn't send it: no lines, as for a position with no moves.
  await ask(NINE_PAWNS);
  await expect.poll(answer, { timeout: 30_000 }).toEqual([]);
  // Sent to its worker anyway (around the engine's check, in its turn), Stockfish refuses it and ends its process: its
  // error stays in the worker.
  await page.evaluate((fen) => {
    const e = (window as any).match.engines[0];
    void e.serial(async () => {
      e.transport.send(`position fen ${fen}`);
      e.transport.send("isready");
      await new Promise((r) => setTimeout(r, 1500));
    });
  }, NINE_PAWNS);
  // The engine answers on, for the position on the board.
  await ask(null);
  await expect.poll(async () => ((await answer()) as unknown[] | null)?.length ?? 0, { timeout: 30_000 }).toBe(1);
  expect(errors).toEqual([]);
});

