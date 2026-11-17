import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_KITS, placeFacing } from "../packages/app/src/characters/kits.ts";
import { GOD_KING } from "../packages/app/src/characters/god-king.ts";
import { SIDE_FEEL } from "../packages/app/src/characters/side-size.ts";
import { renderFrame, type Character } from "../packages/app/src/characters/sprite.ts";
import { BOARD_SEL, asAdmin, bossAloneFromHome, settled, submitMove, test } from "./helpers.ts";

/**
 * A boss beside the board on a computer stands by its bottom-left corner: a small gap off it where his room allows, and over its edge
 * by at most SIDE_FEEL.over of its side where it doesn't (Eric, Nov 4: overlapping the board is fine, "it can even create a cool
 * effect"; docs/decisions/2026-11-04-bigger-side-figures.md). Was (Oct 28, Folio "behind the board when idling"): clear of it, his
 * drawing's right edge short of the board's left edge. With no eval bar, as every player's board is: the drawn pixels of its idle (not
 * its frame, which has room around the drawing). The bosses whose drawings reach furthest toward the board: Folio's wing, Wrangler's
 * lasso, Hollow, Sawyer, Smudgy and Jefferson.
 */

const WIDE = ["folio", "pig", "hollow", "sawyer", "smudgy", "grex"];

/** The board's left edge less the rightmost drawn pixel of the boss's idle (negative: over the board), the most it reaches over 2 s (its frames move), and the board's side. */
async function gap(page: Page): Promise<{ gap: number; side: number }> {
  let side = 0;
  let least = Infinity;
  for (let i = 0; i < 10; i++) {
    const g = await page.evaluate((sel) => {
      const c = document.querySelector<HTMLCanvasElement>(".boss-char.place-side .boss-char-sprite")!;
      const board = document.querySelector(sel)!.getBoundingClientRect();
      const box = c.getBoundingClientRect();
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      // (Mirrored to face the board (kits.ts placeFacing), its frame's columns run right to left: its rightmost on screen is its leftmost drawn.)
      const m = new DOMMatrixReadOnly(getComputedStyle(c).transform).a < 0;
      let right = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3]! > 0) right = Math.max(right, m ? c.width - 1 - x : x);
      return { g: board.left - (box.left + ((right + 1) * box.width) / c.width), side: board.width };
    }, BOARD_SEL.wrap);
    least = Math.min(least, g.g);
    side = g.side;
    await page.waitForTimeout(200);
  }
  return { gap: least, side };
}

for (const boss of WIDE) {
  test(`${boss} beside the board stands by its corner, over its edge by at most ${SIDE_FEEL.over} of its side, no eval bar`, async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "the boss stands beside the board on a computer only");
    await page.addInitScript(() => localStorage.setItem("brc.evalBar", "0"));
    await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=${boss}`);
    await bossAloneFromHome(page);
    await expect.poll(() => page.evaluate(() => (window as any).match?.phase.kind ?? "none"), { timeout: 60_000 }).toBe("play");
    await expect(page.locator(".boss-char.place-side .boss-char-sprite")).toBeVisible();
    for (const [w, h] of [[1280, 800], [2000, 1250]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(400);
      const g = await gap(page);
      expect(g.gap, `${w}: over the board by at most ${SIDE_FEEL.over} of its side`).toBeGreaterThanOrEqual(-g.side * SIDE_FEEL.over - 1);
    }
  });
}

/**
 * Eric's rule (Nov 4): every character sprite is whole on screen wherever it stands, idles or ends a move, phone and computer (over the
 * board or a menu is fine; cut off by the page's edge never; only mid-motion may it pass off screen). Every boss with a character and the
 * God King (and your pawn beside him), at a phone's 390 × 844 and a computer's 1280 × 800, 1440 × 900, 1920 × 1080 and 2000 × 1250: each
 * frame it can rest in (its loops' frames) and the last frame of every one-shot (where each beat ends), drawn in its box as it stands,
 * inside the window, and nothing of theirs scrolling the page sideways (PR #482's first run: the God King's frame past the window's edge
 * at 1280 to 1920 px scrolled it). docs/rules/eric.md; docs/decisions/2026-11-04-battle-desktop-fixes.md.
 */
const SIZES = { phone: [[390, 844]], desktop: [[1280, 800], [1440, 900], [1920, 1080], [2000, 1250]] } as const;
/** Each frame's drawn box in its frame (sprite px), for the frames a figure rests in or ends a beat on. */
function restBoxes(ch: Character): number[][] {
  const out: number[][] = [];
  for (const a of Object.values(ch.anims)) {
    for (const f of a.loop ? a.frames : a.frames.slice(-1)) {
      const { w, h, data } = renderFrame(ch, f);
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (data[(y * w + x) * 4 + 3]! > 0) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
      if (x1 >= 0) out.push([x0, y0, x1 + 1, y1 + 1]);
    }
  }
  return out;
}
/** The union of `boxes` (frame px) drawn in a canvas at `r` (page px) whose frame is `w` × `h`, mirrored (`m`: facing the board) or not. */
const onPage = (boxes: number[][], r: number[], w: number, h: number, m = false) => {
  const sx = (r[2]! - r[0]!) / w, sy = (r[3]! - r[1]!) / h;
  const u = (m ? boxes.map(([x0, y0, x1, y1]) => [w - x1!, y0!, w - x0!, y1!]) : boxes).reduce((a, b) => [Math.min(a[0]!, b[0]!), Math.min(a[1]!, b[1]!), Math.max(a[2]!, b[2]!), Math.max(a[3]!, b[3]!)], [Infinity, Infinity, -Infinity, -Infinity]);
  return [r[0]! + u[0]! * sx, r[1]! + u[1]! * sy, r[0]! + u[2]! * sx, r[1]! + u[3]! * sy].map(Math.round);
};
const KING_BOXES = restBoxes(GOD_KING);
for (const [name, kit] of Object.entries(BOSS_KITS)) {
  const id = kit.ch.id;
  test(`Eric's rule (Nov 4): ${id} and the God King whole on screen at rest and at the end of every beat, phone and computer; ${id} facing the board (Nov 17)`, async ({ page }) => {
    test.setTimeout(180_000);
    const project = test.info().project.name as keyof typeof SIZES;
    await asAdmin(page);
    await page.addInitScript(() => localStorage.setItem("brc.evalBar", "0"));
    // (The Hidden Boss opens as the child since Nov 13: `form=adult` meets the man these kits measure.)
    await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=${id}${id === "recluse" ? "&form=adult" : ""}`);
    await bossAloneFromHome(page);
    await expect.poll(() => page.evaluate(() => (window as any).match?.phase.kind ?? "none"), { timeout: 60_000 }).toBe("play");
    // (A phone's bar may draw its own figure: the Hidden Boss's bust.)
    const ch = project === "phone" && kit.bar ? kit.bar : kit.ch;
    const boss = restBoxes(ch);
    for (const [w, h] of SIZES[project]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const box = (q: string) => {
          const e = [...document.querySelectorAll(q)].find((x) => x.getBoundingClientRect().width > 0);
          const b = e?.getBoundingClientRect();
          return b ? [b.left, b.top, b.right, b.bottom] : null;
        };
        const fig = [...document.querySelectorAll<HTMLElement>(".boss-char:not(.place-results)")].find((x) => x.getBoundingClientRect().width > 0);
        const cv = fig?.querySelector(".boss-char-sprite");
        return { faces: fig?.dataset.faces ?? null, mirror: !!cv && new DOMMatrixReadOnly(getComputedStyle(cv).transform).a < 0, boss: box(".boss-char:not(.place-results) .boss-char-sprite"), king: box(".boss-dock .gk-unit .gk-canvas"), you: box(".boss-dock .you-pawn-bob"), moves: box(".mv-side"), win: [innerWidth, innerHeight], scroll: [document.documentElement.scrollWidth, document.documentElement.clientWidth] };
      });
      const inside = (b: number[], what: string) => {
        expect(b[0]!, `${w} × ${h}: ${what} ${b} past the window's left`).toBeGreaterThanOrEqual(0);
        expect(b[1]!, `${w} × ${h}: ${what} ${b} past its top`).toBeGreaterThanOrEqual(0);
        expect(b[2]!, `${w} × ${h}: ${what} ${b} past its right`).toBeLessThanOrEqual(r.win[0]!);
        expect(b[3]!, `${w} × ${h}: ${what} ${b} past its bottom`).toBeLessThanOrEqual(r.win[1]!);
      };
      // (Never over the move list's text: Nov 4, round 2.)
      const clearOf = (b: number[], what: string) => {
        if (r.moves) expect(b[0]! < r.moves[2]! && r.moves[0]! < b[2]! && b[1]! < r.moves[3]! && r.moves[1]! < b[3]!, `${w} × ${h}: ${what} ${b} over the move list ${r.moves}`).toBe(false);
      };
      expect(r.boss, `${w} × ${h}: ${name} drawn`).not.toBeNull();
      // Facing the board (Eric, Nov 17: "have all the bosses facing the right way"): toward our right beside it (a phone's bar, a
      // computer's side), its drawing mirrored exactly when its art faces our left (kits.ts placeFacing; a front-facing one never).
      const want = placeFacing(kit, ch, project === "phone" ? "bar" : "side");
      expect([r.faces, r.mirror], `${w} × ${h}: ${name} faces the board`).toEqual([want.faces, want.mirror]);
      expect(want.faces, `${w} × ${h}: ${name} faces the board`).not.toBe("left");
      inside(onPage(boss, r.boss!, ch.w, ch.h, r.mirror), name);
      clearOf(onPage(boss, r.boss!, ch.w, ch.h, r.mirror), name);
      expect(r.king, `${w} × ${h}: the God King drawn`).not.toBeNull();
      inside(onPage(KING_BOXES, r.king!, GOD_KING.w, GOD_KING.h), "the God King");
      clearOf(onPage(KING_BOXES, r.king!, GOD_KING.w, GOD_KING.h), "the God King");
      if (r.you) inside(r.you.map(Math.round), "your pawn");
      // (A figure's frame past the window's edge, drawn or not, scrolls the page sideways: never.)
      expect(r.scroll[0], `${w} × ${h}: no sideways scroll`).toBeLessThanOrEqual(r.scroll[1]!);
    }
  });
}

test("Hollow's darkness on a computer: he casts where he stands, by the board's bottom-left corner, his words with him (Eric, Nov 4: he was drawn at the board's top-left, half off the window)", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "a computer's placement");
  test.setTimeout(180_000);
  for (const [w, h] of [[1280, 800], [2000, 1250]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=hollow`);
    await bossAloneFromHome(page);
    await expect.poll(() => page.evaluate(() => (window as any).match?.phase.kind ?? "none"), { timeout: 60_000 }).toBe("play");
    await page.waitForTimeout(500);
    // Every frame from his first move to the end of his cover: his figure's box, whether it shows, his words' box, any caster at the corner.
    await page.evaluate(() => {
      const w = window as any;
      w.__cast = [];
      const box = (q: string) => {
        const b = document.querySelector(q)?.getBoundingClientRect();
        return b && b.width ? [b.left, b.top, b.right, b.bottom].map(Math.round) : null;
      };
      const look = () => {
        const fig = document.querySelector(".boss-char.place-side .boss-char-sprite");
        w.__cast.push({
          dark: !!document.querySelector(".power-moment.pm-dark"),
          anim: document.querySelector(".boss-char.place-side")?.getAttribute("data-anim"),
          fig: box(".boss-char.place-side .boss-char-sprite"),
          box: box(".boss-char.place-side"),
          shown: !!fig && getComputedStyle(fig).visibility === "visible",
          words: box(".boss-char.place-side .bc-bubble"),
          caster: box(".pm-caster"),
          menu: box(".gm-frame > .fd-side"),
        });
        if (w.__cast.length < 3000) requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    await expect.poll(() => page.evaluate(() => (window as any).__cast.length)).toBeGreaterThan(2);
    const rest = (await page.evaluate(() => (window as any).__cast.at(-1).fig)) as number[];
    const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
    const mv = new Chess(fen).moves({ verbose: true }).find((m) => m.piece === "n")!;
    await submitMove(page, mv.from + mv.to, fen);
    await expect.poll(() => page.evaluate(() => (window as any).__cast.some((f: { dark: boolean; anim: string }) => f.dark && f.anim === "darkCast")), { timeout: 30_000, message: `${w}: his cast` }).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as any).__cast.at(-1).dark), { timeout: 10_000 }).toBe(false);
    const seen = (await page.evaluate(() => (window as any).__cast)) as { dark: boolean; anim: string; fig: number[]; box: [number, number, number, number]; shown: boolean; words: [number, number, number, number] | null; caster: number[] | null; menu: [number, number, number, number] | null }[];
    const dark = seen.filter((f) => f.dark);
    expect(dark.length, `${w}: the cover's frames`).toBeGreaterThan(10);
    for (const f of dark) {
      expect(f.caster, `${w}: no figure at the board's corner`).toBeNull();
      expect(f.shown, `${w}: his figure where he stands shows`).toBe(true);
      expect(f.fig, `${w}: his figure stays where it stands`).toEqual(rest);
      // (His words, while up, open over him: their right edge his box's, their bottom over it; or, where that would put them under the
      // computer's side menu, moved just clear of it (speech.tsx, Nov 11: nothing hidden under the menu).)
      if (f.words) {
        if (f.menu && f.words[0] <= f.menu[2] + 1 && f.words[2] > f.box[2]) expect(f.words[0], `${w}: his words just clear of the menu`).toBeGreaterThanOrEqual(f.menu[2] - 1);
        else expect(f.words[2], `${w}: his words with him`).toBe(f.box[2]);
        expect(f.words[3], `${w}: over him`).toBeLessThanOrEqual(f.box[1]);
      }
    }
  }
});

/**
 * Eric (Nov 13): the God King's words were cut off at the right edge of the game screen on a computer. Their box keeps inside the screen
 * (over the pawn if need be), at a computer's and a phone's sizes: forced line `inCheck`, its right edge within the screen's.
 */
test("the God King's words stay whole inside the game screen (Eric, Nov 13)", async ({ page }) => {
  await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=folio`);
  await bossAloneFromHome(page);
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase.kind ?? "none"), { timeout: 60_000 }).toBe("play");
  for (const [w, h] of [[1280, 800], [1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width: w, height: h });
    // (The line once the screen has taken the new size: the room his words get (`--king-room`) is set by the window's resize event, which
    // can come after a line said at once, and a line is fitted as it shows. Main, Nov 13: at 390 its box was still the 1440 one's, 614.)
    await settled(page, () =>
      page.evaluate(() => {
        const s = document.querySelector(".screen");
        return s ? [s.getBoundingClientRect().width, getComputedStyle(s).getPropertyValue("--king-room")] : null;
      }),
    );
    await page.evaluate(() => (window as any).__kingSay("inCheck", `check-${Date.now()}`));
    const bubble = page.locator(".gk-bubble:not(.leaving)").first();
    await expect(bubble).toBeVisible({ timeout: 5_000 });
    const r = await page.evaluate(() => {
      const e = document.querySelector(".gk-bubble:not(.leaving)")!;
      const b = e.getBoundingClientRect();
      const s = e.closest(".screen")!.getBoundingClientRect();
      return { right: b.right, left: b.left, screenRight: s.right, screenLeft: s.left };
    });
    expect(r.right, `${w}: words within the screen's right edge`).toBeLessThanOrEqual(r.screenRight + 0.5);
    expect(r.left, `${w}: words within the screen's left edge`).toBeGreaterThanOrEqual(r.screenLeft - 0.5);
  }
});

/**
 * Eric (Nov 15, Don Dough on a 1611 × 843 computer): "his chat boxes enlarge and move off screen after he says stuff… they are fine
 * for a moment, then they aren't". Each turn draws a new screen (yours, then his), and with it his figure and his words' box, which
 * fitted itself before that screen had set his size and place: so the box came back larger and further left, under the side menu. A
 * line's box keeps its size and place for its whole life, across the screens it outlives, and is whole on screen, right of the menu:
 * his longest line, every frame from its first to its last, through your move and his.
 */
test("Eric's rule (Nov 15): a boss's words beside the board keep their size and place for the line's whole life, on screen, right of the menu", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "the boss stands beside the board on a computer only");
  test.setTimeout(180_000);
  const kit = BOSS_KITS["Don Dough"]!;
  const text = [...Object.values(kit.lines).flatMap((v) => [...(v ?? [])]), ...(kit.fall ?? [])].reduce((a, b) => (b.length > a.length ? b : a));
  await asAdmin(page);
  await page.addInitScript(() => localStorage.setItem("brc.evalBar", "0"));
  for (const [w, h] of [[1611, 843], [1280, 800]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=zebra`);
    await bossAloneFromHome(page, "Don Dough");
    await expect.poll(() => page.evaluate(() => (window as any).match?.phase.kind ?? "none"), { timeout: 60_000 }).toBe("play");
    // (Past his opening words: the line below is the only one up.)
    await expect.poll(() => page.locator(".place-side .bc-bubble").count(), { timeout: 15_000 }).toBe(0);
    // Every frame while the line is up: its box (the entrance's pop-in, `fresh`, moves it a few px: left out), the menu's, the window's,
    // and which screen draws it.
    await page.evaluate((text) => {
      const w = window as any;
      w.__said = [];
      const ids = new WeakMap<Element, number>();
      let n = 0;
      const look = () => {
        const e = [...document.querySelectorAll(".place-side .bc-bubble")].find((x) => x.getAttribute("aria-label") === text);
        const s = document.querySelector(".screen");
        if (s && !ids.has(s)) ids.set(s, ++n);
        if (e && !e.classList.contains("fresh")) {
          const b = e.getBoundingClientRect();
          w.__said.push({ box: [b.left, b.top, b.right, b.bottom].map((v) => Math.round(v * 2) / 2), menu: document.querySelector(".gm-frame > .fd-side")?.getBoundingClientRect().right ?? 0, win: innerWidth, screen: ids.get(s!) });
        }
        if (w.__said.length < 2000) requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
      w.sayBoss(text);
    }, text);
    await expect.poll(() => page.evaluate(() => (window as any).__said.length)).toBeGreaterThan(2);
    // Your move: his screen, then yours again, while the line is still up.
    const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
    const mv = new Chess(fen).moves({ verbose: true }).find((m) => m.piece === "p" && !m.captured)!;
    await submitMove(page, mv.from + mv.to, fen);
    await expect.poll(() => page.evaluate((text) => [...document.querySelectorAll(".place-side .bc-bubble")].some((x) => x.getAttribute("aria-label") === text), text), { timeout: 20_000 }).toBe(false);
    const seen = (await page.evaluate(() => (window as any).__said)) as { box: number[]; menu: number; win: number; screen: number }[];
    expect(new Set(seen.map((f) => f.screen)).size, `${w}: the line outlived its screen`).toBeGreaterThan(1);
    const first = seen[0]!;
    for (const f of seen) {
      expect(f.box, `${w}: the box at its first frame and on screen ${f.screen}`).toEqual(first.box);
      expect(f.box[0], `${w}: right of the menu (${f.menu})`).toBeGreaterThanOrEqual(f.menu);
      expect(f.box[1], `${w}: under the window's top`).toBeGreaterThanOrEqual(0);
      expect(f.box[2], `${w}: inside the window's right`).toBeLessThanOrEqual(f.win);
    }
  }
});
