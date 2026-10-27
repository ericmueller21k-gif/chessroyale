import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, hiddenBosses, menuBosses } from "@chessroyale/core";
import { readFileSync } from "node:fs";
import { rowSizes, SELECT_FRAMING, SELECT_LINES, SELECT_SOUND, SELECT_TINT, selectLine, TILE_RATIO, TILES_PER_ROW, townSound } from "../src/characters/boss-select.ts";
import { renderFrame } from "../src/characters/sprite.ts";
import { bossKit } from "../src/characters/kits.ts";
import { HOMES } from "../src/town/world.ts";

/** The Boss raid screen's character select: each boss's sound and lines (docs/decisions/2026-10-16-boss-character-select.md). */
describe("the boss select", () => {
  const all = [...menuBosses({ admin: false, raid: true }), ...hiddenBosses()];

  it("has a sound from its own pack and lines for every boss with a tile, the Hidden Boss's too", () => {
    expect(all.length).toBeGreaterThanOrEqual(8);
    for (const b of all) {
      // (One of its own pack: its character's or its powers' effects', all named for it: clownSplat is the pie's.)
      const pack = Object.values(bossKit(b.name)!.sounds)[0]!.match(/^[a-z]+/)![0];
      expect(SELECT_SOUND[b.id], b.id).toMatch(new RegExp(`^${pack}[A-Z]`));
      // (Folio has one, the director's: its entrance line, the only one its sheet gives it. docs/decisions/2026-10-27-folio-wired.md.)
      expect(SELECT_LINES[b.id]?.length ?? 0, b.id).toBeGreaterThanOrEqual(b.id === "folio" ? 1 : 2);
    }
    // Nothing for a boss that isn't in the roster.
    for (const id of [...Object.keys(SELECT_SOUND), ...Object.keys(SELECT_LINES)]) expect(BOSS_ROSTER.some((b) => b.id === id), id).toBe(true);
  });

  it("uses each boss's own lines (until Eric approves new ones), except the Hidden Boss's two, Eric's, and Chub & Chirp's, from their lines' draft", () => {
    for (const b of menuBosses({ admin: false, raid: true })) {
      // (Chub & Chirp's are the draft's `CHC-select` lines, as written: docs/decisions/2026-10-18-hopper-wired.md.)
      if (b.id === "hopper") continue;
      const own = new Set(Object.values(bossKit(b.name)!.lines).flat());
      for (const l of SELECT_LINES[b.id]!) expect(own.has(l), `${b.id}: "${l}"`).toBe(true);
    }
    expect(SELECT_LINES.recluse).toEqual(["Team up on me. It wouldn't be the first time anyone did that.", "You're not ready to fight me yet."]);
    expect(SELECT_LINES.hopper).toEqual(["Chub and Chirp! Best friends!", "He's Chirp. I'm Chub. We hop.", "Got any carrots?"]);
  });

  it("never says the same line twice running; the Hidden Boss's two go in turn", () => {
    for (const b of menuBosses({ admin: false, raid: true })) {
      // (Folio's one line is its every tap's: below.)
      if (SELECT_LINES[b.id]!.length === 1) continue;
      let last: string | null = null;
      for (let i = 0; i < 40; i++) {
        const l = selectLine(b.id, last, (i * 0.37) % 1)!;
        expect(l).not.toBe(last);
        expect(SELECT_LINES[b.id]).toContain(l);
        last = l;
      }
    }
    const first = selectLine("recluse", null)!;
    const second = selectLine("recluse", first)!;
    expect([first, second]).toEqual(SELECT_LINES.recluse);
    expect(selectLine("recluse", second)).toBe(first);
    expect(selectLine("nobody", null)).toBeNull();
    expect(SELECT_LINES.folio).toEqual(["Every game is a draft. Shall we write one?"]);
    expect(selectLine("folio", SELECT_LINES.folio![0]!)).toBe(SELECT_LINES.folio![0]);
  });

  it("never names the Hidden Boss in his lines", () => {
    for (const l of SELECT_LINES.recluse!) expect(l).not.toMatch(/Fischer|Soviet|Russian/i);
  });

  it("shares the tiles out over as few rows as it takes, evenly, the longer rows first (docs/decisions/2026-10-23-boss-select-sf.md)", () => {
    const per = TILES_PER_ROW;
    expect(per).toBe(5);
    // Today's sixteen tiles (fourteen bosses, the Hidden Boss's and "?"): three rows of five and "?" on its own (Oct 27, Folio's).
    expect(all.length + 1).toBe(16);
    expect(rowSizes(all.length + 1, per)).toEqual([5, 5, 5, 1]);
    expect(rowSizes(14, per)).toEqual([5, 5, 4]);
    expect(rowSizes(15, per)).toEqual([5, 5, 5]);
    // The next bosses: five to a row always, so a new tile moves no boss's tile before it.
    expect(rowSizes(17, per)).toEqual([5, 5, 5, 2]);
    expect(rowSizes(0, per)).toEqual([]);
    for (let n = 1; n <= 60; n++) {
      const rows = rowSizes(n, per);
      expect(rows.reduce((a, b) => a + b, 0), `${n}`).toBe(n);
      expect(Math.max(...rows), `${n}`).toBeLessThanOrEqual(per);
      expect(rows.slice(0, -1).every((r) => r === per), `${n}: every row full but the last`).toBe(true);
      expect(rows, `${n}: the longer rows first`).toEqual([...rows].sort((a, b) => b - a));
      // (One more tile never moves a tile already there: the rows before it are the same.)
      expect(rowSizes(n + 1, per).slice(0, rows.length - 1), `${n} + 1`).toEqual(rows.slice(0, -1));
    }
  });

  /** A boss's figure as its tile frames it: the frame, the tile's box in the frame's pixels, and where the figure's ink is. */
  const framed = (b: { id: string; name: string }) => {
    const kit = bossKit(b.name)!;
    const p = kit.portrait;
    const img = renderFrame(kit.ch, kit.ch.anims[p.anim]!.frames[p.frame]!);
    let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3]! > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const fit = SELECT_FRAMING[b.id]!;
    const [nx, ny] = fit.neck;
    const tile = { left: nx - fit.span / 2, right: nx + fit.span / 2, top: ny - fit.at * TILE_RATIO * fit.span, bottom: ny + (1 - fit.at) * TILE_RATIO * fit.span };
    return { kit, img, ink: { x0, y0, x1, y1 }, tile, fit };
  };

  it("frames every boss's whole figure: it covers the tile's width, the head is inside the tile, and the body runs on past its foot", () => {
    for (const b of all) {
      const { img, ink, tile, fit } = framed(b);
      expect(fit, b.id).toBeDefined();
      expect(fit.at, b.id).toBeGreaterThan(0.3);
      expect(fit.at, b.id).toBeLessThan(0.7);
      // (The tile is TILE_RATIO tall at most: a short screen has it shorter, never taller.) No bare strip down either side.
      expect(tile.left, `${b.id}: the left edge of its frame`).toBeGreaterThanOrEqual(0);
      expect(tile.right, `${b.id}: the right edge of its frame`).toBeLessThanOrEqual(img.w);
      // The head, hat, ears and all, inside the tile's top, and the figure still going at its foot.
      expect(ink.y0, `${b.id}: the top of its head`).toBeGreaterThanOrEqual(tile.top - 0.5);
      expect(ink.y1, `${b.id}: its body to the tile's foot`).toBeGreaterThanOrEqual(tile.bottom - 0.5);
      // Neither the tile nor its neck outside the frame.
      expect(fit.neck[0], b.id).toBeGreaterThan(0);
      expect(fit.neck[0], b.id).toBeLessThan(img.w);
      expect(fit.neck[1], b.id).toBeGreaterThan(ink.y0);
      expect(fit.neck[1], b.id).toBeLessThan(ink.y1);
    }
    // Nothing for a boss that isn't in the roster.
    for (const id of Object.keys(SELECT_FRAMING)) expect(BOSS_ROSTER.some((r) => r.id === id), id).toBe(true);
  });

  it("gives every boss with a character a color of its own palette behind it (the Hidden Boss's tile is dark and '?' is plain), one that doesn't blend into the figure, in either theme", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    const get = (name: string, from: number) => css.slice(from).match(new RegExp(`--${name}: ([^;]+);`))![1]!;
    const dark = css.indexOf(":root {\n  --bs-edge");
    const light = css.indexOf(':root[data-theme="light"] {\n  --bs-edge');
    expect(dark).toBeGreaterThan(0);
    expect(light).toBeGreaterThan(dark);
    const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
    const mix = (tint: string, pct: string, base: string) => {
      const a = parseInt(pct) / 100;
      const [t, b] = [hex(tint), hex(base)];
      return [0, 1, 2].map((i) => t[i]! * a + b[i]! * (1 - a)) as [number, number, number];
    };
    // The gradient's two ends in each theme, worked out as the stylesheet's color-mix does.
    const themes = { dark, light };
    const ends = (tint: string, at: number) => ({ hi: mix(tint, get("bs-mix-hi", at), get("bs-base-hi", at)), lo: mix(tint, get("bs-mix-lo", at), get("bs-base-lo", at)) });
    for (const b of all) {
      if (b.id === "recluse") {
        expect(SELECT_TINT[b.id], "the Hidden Boss's tile is always dark").toBeUndefined();
        continue;
      }
      const tint = SELECT_TINT[b.id];
      expect(tint, b.id).toMatch(/^#[0-9a-f]{6}$/);
      // (A color of the boss's own palette.)
      const palette = Object.values(bossKit(b.name)!.ch.palette).map((c) => c.slice(0, 7).toLowerCase());
      expect(palette, `${b.id}: ${tint} is one of its colors`).toContain(tint);
      // The figure's pixels (not its dark outline: a ring of every shape) against the background's two ends: how many are close to it.
      const { img, kit } = framed(b);
      // (Its halo is a ring of every shape too: Folio's, #3b3530, is a little lighter than the others', which the sum below leaves out.)
      const halo = kit.ch.halo ? hex(kit.ch.halo) : null;
      for (const [theme, at] of Object.entries(themes)) {
        const { hi, lo } = ends(tint!, at);
        let own = 0, near = 0;
        for (let i = 0; i < img.data.length; i += 4) {
          if (img.data[i + 3]! < 255) continue;
          const px = [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
          if (px[0]! + px[1]! + px[2]! < 120) continue;
          if (halo && px.every((v, j) => v === halo[j])) continue;
          own++;
          const far = (bg: number[]) => Math.hypot(px[0]! - bg[0]!, px[1]! - bg[1]!, px[2]! - bg[2]!);
          if (Math.min(far(hi), far(lo)) < 50) near++;
        }
        expect(near / own, `${b.id} in the ${theme} theme: the share of its figure close to its background`).toBeLessThan(0.2);
      }
    }
  });
});

describe("a boss's sound when tapped in the town square (Eric, Oct 27)", () => {
  it("is its select sound, or its own town sounds in turn (Folio: a murmur, then a soft mm-hm)", () => {
    expect(townSound("tiger", 0)).toBe(SELECT_SOUND.tiger);
    expect(townSound("tiger", 5)).toBe(SELECT_SOUND.tiger);
    expect([0, 1, 2, 3].map((n) => townSound("folio", n))).toEqual(["folioMurmur", "folioHum", "folioMurmur", "folioHum"]);
    // Every boss with a home in the town has one.
    for (const h of HOMES) expect(townSound(h.id, 0), h.id).toBeTruthy();
  });
});
