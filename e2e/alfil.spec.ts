import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_POWERS } from "@chessroyale/core";
import { BOARD_SEL, asAdmin, engineTop, test, bossAloneFromHome, watchFor } from "./helpers.ts";

/**
 * Alfil, the woolly mammoth (live since Oct 17), played alone with real taps on a phone and a computer: his tile and
 * stage, his powers' rules (the battle's state, window.match) and what the board shows for them (his art: the glow,
 * the fusion's flash, the elephant piece, the Slam's pieces flying up, the shadows growing, the landing; the dock).
 * - Tusks (?power=tusks: his cast from his first turn): two of his pawns marked before his move, glowing; his next turn
 *   is the fusion: they rise, a white flash, the elephant (a bishop drawn as an elephant) on one of their squares, the
 *   pawns gone, no move after it, and the dock says so.
 * - The Mammoth Slam (?power=slam: warned as turn 2 begins, at the start of his turn after your move): the board
 *   shakes, up to three of your pieces fly up off the board, their shadows' sizes 1, 2, 3 over your next turns, back
 *   down as the turn after begins. (A Slam whose every lift would swing the game past its cap lifts nothing, about one
 *   in six: then the admins' trigger brings the next, until one lifts.)
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const powers = (p: Page) => p.evaluate(() => (window as any).match?.boss?.powers ?? null).catch(() => null);
const fenNow = (p: Page) => p.evaluate(() => (window as any).match.phase.board.fen as string);

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
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
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
/** A good move now (the engine's, as the judge ranks them; never a promotion) that keeps the battle going and isn't one of `avoid`. */
async function goodMove(page: Page, avoid: (fen: string, move: string) => boolean = () => false): Promise<string> {
  await yourMove(page);
  const { fen, top } = await engineTop(page);
  const goesOn = (mv: string) => {
    const after = new Chess(fen);
    after.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] ?? "q" });
    return !after.isGameOver();
  };
  const legal = new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
  return [...top.map((m) => m.move), ...legal].find((m) => !m.slice(4) && goesOn(m) && !avoid(fen, m))!;
}
/** The pieces drawn on the board now, by color and kind (what the app shows: ghosts and fading pieces aside). */
const drawn = (page: Page, color: "white" | "black", kind: string) => page.locator(`${BOARD_SEL.piece}.${color}.${kind}:not(.ghost):not(.fading)`).count();
/** The pieces a position has, by color and kind. */
const counted = (fen: string, color: "w" | "b", type: string) => new Chess(fen).board().flat().filter((p) => p && p.color === color && p.type === type).length;

test("Alfil's Tusks (the test switch): two of his pawns marked before his move, then the elephant on one of their squares as his move", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&boss=alfil&power=tusks&laststand=0");
  await bossAloneFromHome(page);
  await yourMove(page);
  const boss = await page.evaluate(() => (window as any).match.boss);
  expect(boss.name).toBe("Alfil");
  expect(boss.powers.passive).toBe("tusks");
  const his = boss.crowdSide === "w" ? "b" : "w";
  // Your first move; his turn begins with the cast ("TUSKS!", his two pawns glowing from its beat), then his move.
  const castSeen = await watchFor(page, { banner: { selector: ".fight-banner", text: /TUSKS!/ }, glow: { selector: ".al-glow" } });
  await play(page, await goodMove(page));
  await yourMove(page);
  const cast = await powers(page);
  expect(await castSeen.seen()).toEqual({ banner: true, glow: true });
  // They glow through your turn, each glow exactly on its pawn's square.
  await expect(page.locator(".al-glow")).toHaveCount(2);
  for (const sq of cast.tusks.pawns as string[]) {
    const g = (await page.locator(`.al-glow[data-square="${sq}"]`).boundingBox())!;
    const c = await squareAt(page, sq);
    expect(Math.abs(g.x + g.width / 2 - c.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(g.y + g.height / 2 - c.y)).toBeLessThanOrEqual(1);
  }
  expect(cast.tusks.pawns).toHaveLength(2);
  const fen1 = await fenNow(page);
  for (const sq of cast.tusks.pawns) expect(new Chess(fen1).get(sq as never)).toMatchObject({ color: his, type: "p" });
  // Your move is quiet: it takes nothing (no counter here, and his pieces as they were) and gives no check (his move
  // must answer a check, so no fusion would be allowed); his next turn is the fusion.
  const marked: string[] = cast.tusks.pawns;
  const bishops = counted(fen1, his, "b");
  const pawns = counted(fen1, his, "p");
  const plies = await page.evaluate(() => (window as any).match.phase.board.history.length as number);
  const loud = (fen: string, m: string) => {
    const after = new Chess(fen);
    return !!after.move({ from: m.slice(0, 2), to: m.slice(2, 4) }).captured || after.inCheck();
  };
  // The fusion, as his move: the pawns rise, the white flash, the elephant drops in, and the dock says he spent his move.
  const fuseSeen = await watchFor(page, {
    rise: { selector: '.al-layer[data-fuse="rise"] piece.al-glowing' },
    flash: { selector: ".al-flash" },
    drop: { selector: ".al-layer piece.elephant" },
    dock: { selector: ".dock-line", text: /Alfil spent his move on the fusion\./ },
  });
  await play(page, await goodMove(page, loud));
  await yourMove(page);
  const fused = await powers(page);
  expect(await fuseSeen.seen()).toEqual({ rise: true, flash: true, drop: true, dock: true });
  const fen2 = await fenNow(page);
  expect(fused.tusks).toBeNull();
  expect([...fused.fusion.from].sort()).toEqual([...marked].sort());
  // The elephant (uncountered, it always comes: only a position where neither square is allowed stops it, not this
  // quiet game): a bishop of his on one of the two squares, and that was his move: no move of his on the board since
  // yours, none shown, exactly two pawns fewer and a bishop more.
  expect(fused.fusion.why).toBeUndefined();
  expect(fused.fusion.from).toContain(fused.fusion.to);
  expect(fused.elephants).toEqual([fused.fusion.to]);
  expect(new Chess(fen2).get(fused.fusion.to as never)).toMatchObject({ color: his, type: "b" });
  expect(await page.evaluate(() => (window as any).match.phase.board.history.length)).toBe(plies + 1);
  expect(await page.evaluate(() => (window as any).match.boss.lastMove)).toBeNull();
  expect(counted(fen2, his, "b")).toBe(bishops + 1);
  expect(counted(fen2, his, "p")).toBe(pawns - 2);
  // The board draws the elephant on its square, with its own art (and no glow left).
  const eleph = page.locator(`${BOARD_SEL.piece}.elephant`);
  await expect(eleph).toHaveCount(1);
  await expect(eleph).toHaveAttribute("data-square", fused.fusion.to);
  expect(await eleph.evaluate((e) => getComputedStyle(e).backgroundImage)).toMatch(/elephant/);
  await expect(page.locator(".al-glow")).toHaveCount(0);
  // The board draws the position: his bishops and pawns as the state has them.
  await expect.poll(() => drawn(page, his === "b" ? "black" : "white", "bishop")).toBe(counted(fen2, his, "b"));
  await expect.poll(() => drawn(page, his === "b" ? "black" : "white", "pawn")).toBe(counted(fen2, his, "p"));
  expect(errors).toEqual([]);
});

test("Alfil's Mammoth Slam (the test switch): your pieces up for three turns, their shadows growing, then back down", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // (An admin, for the trigger if a Slam lifts nothing.)
  await asAdmin(page);
  await page.goto("/?debug&clock=60&boss=alfil&power=slam&laststand=0");
  await bossAloneFromHome(page);
  await yourMove(page);
  const crowd: "w" | "b" = await page.evaluate(() => (window as any).match.boss.crowdSide);
  const you = crowd === "w" ? "white" : "black";
  await play(page, await goodMove(page));
  await yourMove(page);
  expect((await powers(page)).warned).toBe(true);
  let p: any = null;
  let slamSeen: Awaited<ReturnType<typeof watchFor>> | null = null;
  for (let tries = 1; tries <= 4 && !p?.slam.pieces.length; tries++) {
    if (tries > 1) {
      // (The last lifted nothing: within the cap, none could go; the meter spent anyway. The trigger: the next one.)
      expect(p.airborne).toEqual([]);
      const btn = page.locator(".ult-test");
      await expect(btn).toHaveText("Trigger ultimate (testing)");
      await btn.click();
      await expect(btn).toHaveText("Ultimate next turn (testing)");
    }
    const mine = await goodMove(page);
    const before = new Chess(await fenNow(page));
    before.move({ from: mine.slice(0, 2), to: mine.slice(2, 4) });
    const at = await page.evaluate(() => (window as any).match.boss.crowdMoves + 1);
    slamSeen = await watchFor(page, {
      banner: { selector: ".fight-banner", text: /MAMMOTH SLAM!/ },
      shake: { selector: ".board-area.pw-crash" },
      fly: { selector: '.al-layer[data-slam="fly"] piece.al-piece' },
      shadow: { selector: '.pw-shadow[data-size="1"]' },
    });
    await play(page, mine);
    // At the start of his turn, before his move: the Slam (this device's engines pick the lift), then his move.
    await yourMove(page);
    p = await powers(page);
    expect(p.ults).toBe(tries);
    expect(p.slam.at).toBe(at);
    expect(p.slam.lands).toBe(at + 1 + BOSS_POWERS.slamTurns);
    expect(p.slam.pieces.length).toBeLessThanOrEqual(BOSS_POWERS.slamPawns + BOSS_POWERS.slamMinors);
    for (const x of p.slam.pieces) {
      expect(["p", "n", "b"]).toContain(x.piece);
      expect(before.get(x.square as never)).toMatchObject({ color: crowd, type: x.piece });
    }
    expect(p.airborne.map((x: { square: string }) => x.square)).toEqual(p.slam.pieces.map((x: { square: string }) => x.square));
  }
  const up: { piece: string; square: string }[] = p.slam.pieces;
  expect(up.length).toBeGreaterThan(0);
  // He crashed down (the board shook), the pieces flew up off their squares, and their shadows showed.
  expect(await slamSeen!.seen()).toEqual({ banner: true, shake: true, fly: true, shadow: true });
  const landSeen: Awaited<ReturnType<typeof watchFor>>[] = [];
  // Three of your turns with them up: off the board (drawn and in the state), their shadows' sizes 1, 2, 3.
  const total = (fen: string) => (["p", "n", "b"] as const).reduce((t, k) => t + counted(fen, crowd, k), 0);
  for (let i = 0; i < BOSS_POWERS.slamTurns; i++) {
    await yourMove(page);
    const v = await powers(page);
    // (Down early: he had a mate in one only because they were up. Then they're back now.)
    if (v.landed?.early) break;
    expect(v.airborne.map((x: { stage: number }) => x.stage)).toEqual(up.map(() => i + 1));
    expect(v.airborne.map((x: { left: number }) => x.left)).toEqual(up.map(() => BOSS_POWERS.slamTurns - i));
    expect(v.paused).toBe(true);
    // The shadow on each one's square, growing a size a turn.
    await expect(page.locator(".pw-shadow")).toHaveCount(up.length);
    for (const x of up) await expect(page.locator(`.pw-shadow[data-square="${x.square}"]`)).toHaveAttribute("data-size", String(i + 1));
    landSeen.push(await watchFor(page, { drop: { selector: '.al-layer[data-land="on"] piece.al-piece' }, dock: { selector: ".dock-line", text: /Your pieces? (is|are) back\./ } }));
    const fen = await fenNow(page);
    for (const k of ["pawn", "knight", "bishop"] as const) await expect.poll(() => drawn(page, you, k)).toBe(counted(fen, crowd, k[0] === "k" ? "n" : k[0]!));
    await play(page, await goodMove(page));
  }
  // Back down as your next turn begins: each on its own square, or the nearest one allowed.
  await yourMove(page);
  const down = await powers(page);
  const fen = await fenNow(page);
  expect(down.airborne).toEqual([]);
  // They dropped back out of the sky (the dock said so), and no shadow is left.
  const seenLanding = await Promise.all(landSeen.map((w) => w.seen()));
  expect(seenLanding.some((x) => x.drop && x.dock)).toBe(true);
  await expect(page.locator(".pw-shadow")).toHaveCount(0);
  expect(down.landed.pieces.map((x: { from: string }) => x.from).sort()).toEqual(up.map((x) => x.square).sort());
  for (const x of down.landed.pieces as { piece: string; from: string; to: string }[]) {
    const now = new Chess(fen).get(x.to as never);
    // (Unless his move since took it.)
    if (now) expect(now).toMatchObject({ color: crowd, type: x.piece });
  }
  expect(total(fen)).toBeGreaterThan(0);
  for (const k of ["pawn", "knight", "bishop"] as const) await expect.poll(() => drawn(page, you, k)).toBe(counted(fen, crowd, k[0] === "k" ? "n" : k[0]!));
  expect(errors).toEqual([]);
});

test("Alfil's tile and stage, and his figure by the board: whole on a phone (320 px, his wide box) and a computer (1280 px)", async ({ page }, info) => {
  const phone = info.project.name === "phone";
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (phone) await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/?mode=raid");
  const tile = page.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio", { name: "Alfil", exact: true });
  await expect(tile.locator("canvas.boss-portrait")).toBeVisible();
  await tile.click();
  await expect(page.locator(".bs-stage .bs-sprite")).toHaveAttribute("data-fx", "alfil");
  await expect(page.locator(".bs-name")).toHaveText("Alfil");
  await page.waitForTimeout(500);
  const stage = (await page.locator(".bs-spot").boundingBox())!;
  const fig = (await page.locator(".bs-sprite").boundingBox())!;
  expect(fig.x).toBeGreaterThanOrEqual(stage.x - 1);
  expect(fig.x + fig.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
  // (Full size: drawn at the stage's one pixel size, 0.8 of a frame pixel per cqi, as every boss up to 70 px tall.)
  expect(Math.abs(fig.width - (81 * 0.8 * stage.width) / 100)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  // In his battle: on a phone in the bar's wide box at its left, whole on the screen (his hops too: their room is in his
  // frame), never over the board; on a computer by the board's bottom-left corner.
  await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
  await page.getByRole("dialog", { name: "Boss alone" }).getByRole("button", { name: /Alfil/ }).click();
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  const char = page.locator(phone ? ".boss-char.place-bar" : ".boss-char.place-side");
  await expect(char).toBeVisible();
  if (phone) expect((await char.boundingBox())!.width).toBe(58);
  const sprite = (await char.locator("canvas").boundingBox())!;
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(sprite.x).toBeGreaterThanOrEqual(0);
  expect(sprite.x + sprite.width).toBeLessThanOrEqual(vw);
  expect(sprite.y).toBeGreaterThanOrEqual(0);
  if (phone) expect((await char.boundingBox())!.y + (await char.boundingBox())!.height).toBeLessThanOrEqual(board.y);
  else expect((await char.boundingBox())!.x + (await char.boundingBox())!.width).toBeLessThanOrEqual(board.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: info.outputPath(`alfil-${info.project.name}.png`) });
  expect(errors).toEqual([]);
});
