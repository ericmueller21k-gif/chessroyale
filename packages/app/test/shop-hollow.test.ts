import { describe, expect, it } from "vitest";
import { BOSS_CRATES, bossCrateOf } from "@chessroyale/core";
import { SHOP_HOLLOW_CRATE_AT, SHOP_HOLLOW_FLOOR, SHOP_HOLLOW_LAYOUT, SHOP_HOLLOW_LIGHTS, SHOP_HOLLOW_MARKS, SHOP_HOLLOW_PIECES, SHOP_HOLLOW_POOLS, rockPiece } from "../src/town/shops/hollow-art.ts";
import { SHOP_BLITZ_LAYOUT } from "../src/town/shops/blitz-art.ts";
import { camFocus, findPath, inTalkRange, isFloor, lightsAt, litDx, makeRoom, overlaps, stepsFrom, tapTarget, upAlpha, walkable, youBox, type Sq } from "../src/town/shops/room.ts";
import { SHOPS, holdLine, priceLine, prizeRows, shopOf } from "../src/town/shops/shops.ts";
import { CHALLENGE_FEEL, introOf, marksFeel, marksOf } from "../src/town/shops/challenge.ts";
import { SIDEKICK_SHEETS } from "../src/town/sidekick-sheets.ts";
import { ADMIN_BOTS, BOTS, TOWN_BOTS, isSprite } from "../src/town/world.ts";
import { BOSS_ART, PAWN_PATH } from "../src/town/render.ts";
import { PARK_TABLE } from "../src/town/houses/park.ts";
import { SHOP_FEEL, TOWN_FEEL } from "../src/town/feel.ts";
import { newPt, newView, proj, setView } from "../src/town/camera.ts";
import { renderFrame, type Character, type Frame } from "../src/characters/sprite.ts";
import { BOSS_HOLLOW_INTRO } from "../src/characters/hollow-intro.ts";
import { bossKit } from "../src/characters/kits.ts";

/**
 * Hollow's cave (Nov 3; docs/decisions/2026-11-03-hollow-shop.md): the first room that isn't a box. Its floor's shape (the art's
 * SHOP_HOLLOW_FLOOR), the rock placed from it (`rockPiece`), the lights at every place their pieces stand, the camera kept over the
 * floor, the dog at the counter, the crate, and the pond that holds the table, its stools and both of you.
 */
const def = SHOPS.hollow!;
const room = makeRoom(SHOP_HOLLOW_LAYOUT, def.keeper, 20, SHOP_HOLLOW_FLOOR);
const open = (c: number, r: number) => SHOP_HOLLOW_FLOOR[r]?.[c] === ".";
const PX = TOWN_FEEL.housePxPerSquare;

describe("the cave's floor (SHOP_HOLLOW_FLOOR)", () => {
  it("is 20 rows of 20, `.` floor and `#` rock, as the art drew it (in at the mouth, up the passage, round the bend west)", () => {
    expect(SHOP_HOLLOW_FLOOR).toEqual([
      "####################",
      "####################",
      "###......###########",
      "##........##########",
      "##..........########",
      "##............######",
      "##.............#####",
      "###..............###",
      "######...........###",
      "#########........###",
      "#########.........##",
      "#########.........##",
      "#########.........##",
      "#########.........##",
      "#########........###",
      "##########.......###",
      "##########.......###",
      "###########......###",
      "###########......###",
      "############....####",
    ]);
    expect(room.n).toBe(20);
    expect(room.floor).not.toBeNull();
  });

  it("every `#` is blocked, whatever stands there (the flat rock tiles aren't solid: the mask blocks them)", () => {
    for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) if (!open(c, r)) expect(walkable(room, c, r), `${c},${r}`).toBe(false);
    // (The rock's flat tiles from above are floor tiles, not solid: only the mask keeps you off them.)
    expect(SHOP_HOLLOW_LAYOUT.filter((p) => p.name.startsWith("floor-rock")).every((p) => !p.solid && isFloor(p.name))).toBe(true);
    // A box room has no mask: as before.
    expect(makeRoom(SHOP_BLITZ_LAYOUT, SHOPS.dash!.keeper).floor).toBeNull();
  });

  it("is one piece: every walkable square is reached from where you come in, and every floor square is walkable or under a solid piece", () => {
    const d = stepsFrom(room, room.start);
    const solid = new Set(SHOP_HOLLOW_LAYOUT.filter((p) => p.solid).flatMap((p) => Array.from({ length: (p.w ?? 1) * (p.d ?? 1) }, (_, i) => `${p.col + (i % (p.w ?? 1))},${p.row - Math.floor(i / (p.w ?? 1))}`)));
    for (let r = 0; r < 20; r++)
      for (let c = 0; c < 20; c++) {
        if (walkable(room, c, r)) expect(d[r * 20 + c], `${c},${r}`).toBeGreaterThanOrEqual(0);
        else if (open(c, r) && r < 19) expect(solid.has(`${c},${r}`) || def.keeper.some((k) => k.c === c && k.r === r), `${c},${r} floor but blocked`).toBe(true);
      }
    // The floor's own shape is connected too (rows 0-18: row 19 is the mouth's sill, the way out).
    const seen = new Set<string>();
    const q: Sq[] = [{ c: 14, r: 18 }];
    while (q.length) {
      const s = q.pop()!;
      const k = `${s.c},${s.r}`;
      if (seen.has(k) || !open(s.c, s.r) || s.r > 18) continue;
      seen.add(k);
      q.push({ c: s.c + 1, r: s.r }, { c: s.c - 1, r: s.r }, { c: s.c, r: s.r + 1 }, { c: s.c, r: s.r - 1 });
    }
    expect(seen.size).toBe(SHOP_HOLLOW_FLOOR.slice(0, 19).join("").split("").filter((x) => x === ".").length);
  });

  it("has no one-square pinches: no floor square with rock on both sides (east and west, or north and south), no rock fin one square thick", () => {
    for (let r = 0; r < 20; r++)
      for (let c = 0; c < 20; c++) {
        if (open(c, r)) {
          expect(!open(c - 1, r) && !open(c + 1, r), `${c},${r}: rock east and west`).toBe(false);
          if (r < 19) expect(!open(c, r - 1) && !open(c, r + 1), `${c},${r}: rock north and south`).toBe(false);
        } else {
          expect(open(c - 1, r) && open(c + 1, r), `${c},${r}: a fin across`).toBe(false);
          expect(open(c, r - 1) && open(c, r + 1), `${c},${r}: a fin down`).toBe(false);
        }
      }
    // Every row's floor is one run at least 4 wide (the mouth's sill) and 6 wide from the passage up.
    for (let r = 2; r < 20; r++) {
      const run = SHOP_HOLLOW_FLOOR[r]!.replace(/^#+|#+$/g, "");
      expect(run, `row ${r}`).toMatch(/^\.+$/);
      expect(run.length, `row ${r}`).toBeGreaterThanOrEqual(r === 19 ? 4 : 6);
    }
  });

  it("the pond (its 30 tiles), both marks, the counter, the dog's squares and where you talk to him are all on the floor", () => {
    const pond = SHOP_HOLLOW_LAYOUT.filter((p) => p.name.startsWith("circle-"));
    expect(pond).toHaveLength(30);
    for (const p of pond) expect(open(p.col, p.row), p.name).toBe(true);
    for (const m of [SHOP_HOLLOW_MARKS.boss, SHOP_HOLLOW_MARKS.you]) for (const r of [Math.floor(m[1]), Math.ceil(m[1])]) expect(walkable(room, m[0], r), `mark ${m}`).toBe(true);
    for (let c = 4; c <= 7; c++) expect(open(c, 4) && !walkable(room, c, 4), `counter ${c},4`).toBe(true);
    for (const k of def.keeper) expect(open(k.c, k.r) && !walkable(room, k.c, k.r), `dog ${k.c},${k.r}`).toBe(true);
    const talk = tapTarget(room, room.start, def.keeper[0]!.c, def.keeper[0]!.r);
    expect(talk.kind).toBe("keeper");
    // (In front of him, the counter between you: row 5, under his two squares.)
    expect(talk.dest!.r).toBe(5);
    expect([5, 6]).toContain(talk.dest!.c);
    expect(inTalkRange(room, talk.dest!.c, 5)).toBe(true);
  });

  it("from the mouth to the counter round the bend: about 25 steps, every one on the floor; the counter out of talking range at the pond", () => {
    expect(room.start).toEqual({ c: 14, r: 17 });
    expect(room.doors).toEqual([{ c: 13, r: 18 }, { c: 14, r: 18 }]);
    const path = findPath(room, room.start, { c: 5, r: 5 })!;
    expect(path.length).toBeGreaterThanOrEqual(20);
    expect(path.length).toBeLessThanOrEqual(26);
    for (const s of path) expect(open(s.c, s.r), `${s.c},${s.r}`).toBe(true);
    expect(inTalkRange(room, 13, 12)).toBe(false);
    // A tap on the rock walks you beside it, never into it.
    const t = tapTarget(room, { c: 13, r: 12 }, 8, 11);
    expect(t.kind).toBe("square");
    expect(open(t.dest!.c, t.dest!.r) && Math.max(Math.abs(t.dest!.c - 8), Math.abs(t.dest!.r - 11))).toBe(1);
  });
});

describe("the rock, placed from the floor's shape (rockPiece)", () => {
  const ups = SHOP_HOLLOW_LAYOUT.filter((p) => !isFloor(p.name));
  const at = (c: number, r: number) => ups.filter((p) => p.col === c && p.row === r && p.name.startsWith("rock"));
  it("every rock square on the floor's edge has the wall piece its neighbours say (the backdrop and the crack standing in for two), solid; deep rock has none", () => {
    for (let r = 0; r < 20; r++)
      for (let c = 0; c < 20; c++) {
        const rp = rockPiece(c, r);
        const here = at(c, r);
        const backdrop = r === 1 && c >= 4 && c <= 7;
        if (open(c, r) || !rp || backdrop) {
          expect(here, `${c},${r}`).toHaveLength(0);
          continue;
        }
        expect(here, `${c},${r}`).toHaveLength(1);
        const p = here[0]!;
        expect(p.solid, `${c},${r}`).toBe(true);
        expect(!!p.flip, `${c},${r} flip`).toBe(rp.flip);
        const kind = p.name === "rock-crack" ? "back" : p.name.replace(/^rock-/, "").replace(/-b$|-c$/, "");
        expect(kind, `${c},${r}`).toBe(rp.kind);
      }
    expect(ups.find((p) => p.name === "backdrop")).toMatchObject({ col: 4, row: 1, solid: true, w: 4 });
    expect(at(11, 3)[0]?.name).toBe("rock-crack");
  });

  it("the floor is closed in: every floor square's rock neighbour (north, south, east, west) is a solid rock piece, the backdrop or the mouth's sill", () => {
    for (let r = 0; r < 19; r++)
      for (let c = 0; c < 20; c++) {
        if (!open(c, r)) continue;
        for (const [nc, nr] of [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]] as const) {
          if (open(nc, nr)) continue;
          const backdrop = nr === 1 && nc >= 4 && nc <= 7;
          expect(backdrop || at(nc, nr).length === 1, `${nc},${nr} beside ${c},${r}`).toBe(true);
        }
      }
  });

  it("the rules: floor south a back face (an outer corner with floor west, mirrored east); north the low hem; east a side (mirrored west); only diagonally south an inner corner", () => {
    expect(rockPiece(12, 4)).toEqual({ kind: "corner-out", flip: false }); // (row 5 floor south and 11,4 west)
    expect(rockPiece(14, 5)).toEqual({ kind: "corner-out", flip: false });
    expect(rockPiece(4, 8)).toEqual({ kind: "hem", flip: false });
    expect(rockPiece(5, 8)).toEqual({ kind: "hem-end", flip: false }); // (floor north and east)
    expect(rockPiece(8, 12)).toEqual({ kind: "side", flip: false });
    expect(rockPiece(18, 12)).toEqual({ kind: "side", flip: true });
    expect(rockPiece(0, 0)).toBeNull();
    expect(rockPiece(13, 12)).toBeNull(); // (floor)
  });
});

describe("lights at every place their pieces stand (all shops, Nov 3)", () => {
  const ups = SHOP_HOLLOW_LAYOUT.filter((p) => !isFloor(p.name));
  it("the five lanterns each have their halo and their pool; the bulb strings light on each of their squares", () => {
    const halos = lightsAt(SHOP_HOLLOW_LIGHTS, ups, (l) => !!l.halo);
    const pools = lightsAt(SHOP_HOLLOW_POOLS, ups);
    const lanterns = (xs: { at: { name: string; col: number; row: number } }[]) =>
      xs.filter((x) => x.at.name.startsWith("lantern")).map((x) => `${x.at.col},${x.at.row}`).sort();
    const five = ["9,5", "11,8", "9,11", "17,12", "13,16"].sort();
    expect(lanterns(halos)).toEqual(five);
    expect(lanterns(pools)).toEqual(five);
    // (The bulbs' spots, one per bulb color, on every bulb piece: 10 pieces of string, 6 colors.)
    const bulbs = lightsAt(SHOP_HOLLOW_LIGHTS, ups).filter((x) => x.at.name.startsWith("bulbs"));
    expect(new Set(bulbs.map((x) => `${x.at.col},${x.at.row}`)).size).toBe(ups.filter((p) => p.name.startsWith("bulbs")).length);
    expect(bulbs).toHaveLength(6 * ups.filter((p) => p.name.startsWith("bulbs")).length);
    // One place per light per placement, never twice.
    expect(new Set(halos.map((x) => `${x.l.piece}|${x.at.col},${x.at.row}|${SHOP_HOLLOW_LIGHTS.indexOf(x.l)}`)).size).toBe(halos.length);
  });

  it("a mirrored piece's light is mirrored with it, about its foot", () => {
    expect(litDx(5, 18, false)).toBe(-13);
    expect(litDx(5, 18, true)).toBe(13);
    expect(litDx(18, 18, true)).toBe(0);
  });
});

describe("the camera in the cave", () => {
  it("a drag keeps its focus over the floor: on the floor it's as asked, over the rock the nearest floor; a box room as before", () => {
    const out = { x: 0, y: 0 };
    for (let y = -2; y <= 21; y += 0.5)
      for (let x = -2; x <= 21; x += 0.5) {
        camFocus(room, x, y, out);
        expect(open(Math.round(out.x), Math.round(out.y)), `${x},${y} -> ${out.x},${out.y}`).toBe(true);
        if (open(Math.round(x), Math.round(y)) && x >= 0 && y >= 0 && x <= 19 && y <= 19) expect([out.x, out.y]).toEqual([x, y]);
      }
    const box = makeRoom(SHOP_BLITZ_LAYOUT, SHOPS.dash!.keeper);
    expect(camFocus(box, -3, 25, out)).toEqual({ x: 0, y: 19 });
    expect(camFocus(box, 4.2, 7.7, out)).toEqual({ x: 4.2, y: 7.7 });
  });

  it("you're never hidden behind the rock: from every square you can stand on, at both zooms, on a phone and a computer, a rock piece nearer the camera that covers you is drawn see-through (SHOP_FEEL.seeThrough)", () => {
    const pieces = SHOP_HOLLOW_LAYOUT.filter((p) => !isFloor(p.name) && /^(rock|drift|entrance)/.test(p.name));
    const alphas = new Map<string, Uint8Array>();
    const alpha = (name: string) => {
      let a = alphas.get(name);
      if (!a) {
        const ch = SHOP_HOLLOW_PIECES[name]!;
        const f = renderFrame(ch, ch.anims.idle!.frames[0]!);
        a = new Uint8Array(f.w * f.h);
        for (let i = 0; i < a.length; i++) a[i] = f.data[i * 4 + 3]! > 0 ? 1 : 0;
        alphas.set(name, a);
      }
      return a;
    };
    const hidden: string[] = [];
    const box = { x0: 0, y0: 0, x1: 0, y1: 0 };
    let covered = 0;
    const v = newView();
    const pt = newPt();
    const f = TOWN_FEEL;
    for (const [W, H] of [[390, 700], [1000, 740]] as const)
      for (const zoom of [0, 1]) {
        const tall = { ...f.camTall };
        const wide = { ...f.camWide };
        for (const k of ["h", "back", "th", "cy"] as const) {
          tall[k] = SHOP_FEEL.close[k] + (f.camTall[k] - SHOP_FEEL.close[k]) * zoom;
          wide[k] = SHOP_FEEL.close[k] + (f.camWide[k] - SHOP_FEEL.close[k]) * zoom;
        }
        setView(v, W, H, 0, 1, 0, 0, { tall, wide });
        for (let r = 0; r < 20; r++)
          for (let c = 0; c < 20; c++) {
            if (!walkable(room, c, r)) continue;
            proj(v, 0, 0, 0, pt);
            // (Your middle: half your height over your feet; your box as ShopRoom keeps it.)
            const yx = pt.x;
            const yy = pt.y - (f.youSquares * pt.k) / 2;
            youBox(pt.x, pt.y, pt.k, f.youSquares, box);
            for (const p of pieces) {
              if (p.row <= r) continue;
              const ch = SHOP_HOLLOW_PIECES[p.name]!;
              const fc = p.col + ((p.w ?? 1) - 1) / 2;
              if (!proj(v, fc - c, r - p.row, 0, pt)) continue;
              if (pt.depth <= SHOP_FEEL.nearGone) continue;
              const s = pt.k / PX;
              const x0 = pt.x - ch.foot[0] * s;
              const y0 = pt.y - ch.foot[1] * s;
              // (Its drawn pixel there, mirrored with it: an opaque one covers you.)
              const px = Math.floor((yx - x0) / s);
              const py = Math.floor((yy - y0) / s);
              if (px < 0 || py < 0 || px >= ch.w || py >= ch.h) continue;
              const img = alpha(p.name);
              if (img[py * ch.w + (p.flip ? ch.w - 1 - px : px)]) covered++;
              // (As ShopRoom draws it: its opacity, see-through over you.)
              const a = upAlpha(pt.depth, overlaps(box, x0, y0, x0 + ch.w * s, y0 + ch.h * s), true);
              expect(upAlpha(pt.depth, false, true), "a box room's rule as before").toBe(upAlpha(pt.depth, false, false));
              if (img[py * ch.w + (p.flip ? ch.w - 1 - px : px)] && a > SHOP_FEEL.seeThrough + 1e-9) hidden.push(`${W}x${H} zoom ${zoom}: ${p.name} at ${p.col},${p.row} covers you at ${c},${r}`);
            }
          }
      }
    expect(hidden).toEqual([]);
    // (It does come up: along the passage's walls and under the mouth's arch, with the far camera behind you.)
    expect(covered).toBeGreaterThan(10);
  });
});

describe("the dog keeps the shop", () => {
  it("his sheet is baked (64 x 64, feet at 30, 61; idle 12, walk 6, sit 10, wave 10); standing he shows over the 30 px counter", () => {
    const s = SIDEKICK_SHEETS.hollowdog;
    expect(s.id).toBe("sidekick-hollow-dog");
    expect([s.w, s.h, ...s.foot]).toEqual([64, 64, 30, 61]);
    expect([s.ms.idle.length, s.ms.walk.length, s.ms.sit.length, s.ms.wave.length]).toEqual([12, 6, 10, 10]);
    expect(s.foot[1] - s.top.idle).toBeGreaterThan(30);
  });

  it("he isn't a town bot: Glim stays Hollow's kid in the town", () => {
    for (const b of [...BOTS, ...ADMIN_BOTS, ...TOWN_BOTS]) if (isSprite(b.look)) expect(b.look.sprite.id, b.name).not.toBe("sidekick-hollow-dog");
    const glim = BOTS.find((b) => b.boss === "hollow")!;
    expect(glim.name).toBe("Glim");
    expect(isSprite(glim.look) && glim.look.sprite).toBe(SIDEKICK_SHEETS.hollow);
  });

  it("behind the counter on (5, 2) and (6, 2), drawn at (5.5, 2.4); the crate on the counter's east end; no name, the night tone", () => {
    expect(def).toMatchObject({ home: "hollow", boss: "Hollow", kid: "hollowdog", at: [5.5, 2.4], keeper: [{ c: 5, r: 2 }, { c: 6, r: 2 }], roof: "cave", chatTone: "night" });
    expect(SHOP_HOLLOW_LAYOUT.find((p) => p.name === "counter")).toMatchObject({ col: 4, row: 4, w: 4, solid: true });
    expect(SHOP_HOLLOW_CRATE_AT).toEqual([122, 16]);
    expect(SHOP_HOLLOW_PIECES.counter!.h - SHOP_HOLLOW_PIECES.counter!.foot[1]).toBeLessThan(4);
  });
});

describe("Hollow's Boss Crate", () => {
  it("in BOSS_CRATES with his ride, Hollow's Bulb, first; its words as the others'", () => {
    const crate = bossCrateOf("hollow")!;
    // (Wrangler's came after it, Nov 4.)
    expect(BOSS_CRATES).toContain(crate);
    expect(crate.name).toBe("Hollow's Boss Crate");
    expect(crate.ride).toBe("hollow-bulb");
    expect(crate.items).toContain("hollow-bulb");
    const s = shopOf("hollow")!;
    expect(s.crate).toBe("Hollow's Boss Crate");
    expect(priceLine(s)).toBe("3 Hollow tokens, or 1 Hollow token + 1 crate key");
    expect(holdLine(s, { tokens: 1, keys: 0 })).toBe("You have 1 Hollow token and 0 crate keys.");
    expect(prizeRows(s)[0]).toMatchObject({ id: "hollow-bulb", name: "Hollow's Bulb", kind: "Mythic ride" });
  });
});

describe("his challenge on the pond", () => {
  /** A figure's columns (squares from its foot, west and east) over its lowest `up` squares, `sq` squares tall. */
  const extent = (ch: Character, frames: readonly Frame[], sq: number, up = Infinity): [number, number] => {
    const k = sq / ch.h;
    let l = Infinity;
    let r = -Infinity;
    for (const fr of frames) {
      const f = renderFrame(ch, fr);
      for (let y = 0; y < f.h; y++) {
        if ((ch.foot[1] - y) * k > up) continue;
        for (let x = 0; x < f.w; x++) if (f.data[(y * f.w + x) * 4 + 3]! > 0) ((l = Math.min(l, x)), (r = Math.max(r, x)));
      }
    }
    return [(l - ch.foot[0]) * k, (r + 1 - ch.foot[0]) * k];
  };
  it("his own intro (Nov 3: the dark), across, his line his entrance's; you both sit at your clear places", () => {
    expect(introOf("hollow")).toMatchObject({ custom: true, name: "Hollow", line: "Did you leave a light on?", layout: "across", seated: true, cues: { table: "pop" }, clear: 2.92 });
  });

  it("the table, its stools and you fit on the ice; Hollow stands on it on his mark, and hops back to its west edge, his whole swing clear of the rock", () => {
    const own = introOf("hollow")!.clear!;
    const m = marksOf(SHOP_HOLLOW_LAYOUT, "across", SHOP_HOLLOW_MARKS, marksFeel(null, CHALLENGE_FEEL, own))!;
    expect([m.boss, m.you, m.table]).toEqual([{ c: 11, r: 11.5 }, { c: 14, r: 11.5 }, { c: 12.5, r: 11.5 }]);
    expect(m.bossClear.c).toBeCloseTo(12.5 - own, 9);
    // The ice: the art's oval, its middle on the marks' line (x = 13 x 37 px, column 13's west edge: 12.5 in squares), 3 x 37 - 5 px
    // either side of it there (hollow-art.ts PX, PRX); its tiles (with the snowy rim and the frost round it) run a square further.
    const [west, east] = [12.5 - (3 * PX - 5) / PX, 12.5 + (3 * PX - 5) / PX];
    const pond = SHOP_HOLLOW_LAYOUT.filter((p) => p.name.startsWith("circle-") && (p.row === 11 || p.row === 12)).map((p) => p.col);
    expect(Math.min(...pond) - 0.5).toBeLessThan(west);
    expect(Math.max(...pond) + 0.5).toBeGreaterThan(east);
    // The table's picture, three squares across (its stools in the outer ones), on the ice.
    expect(PARK_TABLE.w).toBe(3 * PX);
    expect(m.table.c - 1.5).toBeGreaterThanOrEqual(west);
    expect(m.table.c + 1.5).toBeLessThanOrEqual(east);
    expect([m.bossStool.c, m.youStool.c]).toEqual([m.table.c - CHALLENGE_FEEL.stoolOff, m.table.c + CHALLENGE_FEEL.stoolOff]);
    // You (the pawn's base) on the ice, on your mark and hopped back.
    const [, x0, x1] = /([\d.]+),39\.5 H ([\d.]+)/.exec(PAWN_PATH)!.map(Number);
    const half = (((x1! - x0!) / 2) * TOWN_FEEL.youSquares) / 45;
    for (const c of [m.you.c, m.youClear.c]) {
      expect(c - half, `your base at ${c}`).toBeGreaterThanOrEqual(west);
      expect(c + half).toBeLessThanOrEqual(east);
    }
    // Hollow (his town figure, facing you): his feet on the ice on his mark. Hopped back (his own clear place, so his lash's feet
    // clear his stool: boss-challenge.test.ts), his foot at the ice's west edge (a tenth of a square at most past it, on its snowy rim).
    const ch = BOSS_ART.hollow;
    const sq = TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale.hollow ?? 1);
    const [fl, fr] = extent(ch, ch.anims.idle!.frames, sq, 0.3);
    expect(m.boss.c + fl, "his feet on his mark, west").toBeGreaterThanOrEqual(west);
    expect(m.boss.c + fr, "east").toBeLessThanOrEqual(m.table.c);
    expect(m.bossClear.c).toBeGreaterThanOrEqual(west - 0.1);
    // His whole figure and his whole swing (every frame of his God King attack, all of it) clear of the west rock (columns 9 to 17
    // are floor on the marks' rows).
    for (const r of [11, 12]) expect(open(8, r) || open(18, r)).toBe(false);
    const ka = bossKit("Hollow")!.kingAttack!;
    const [al] = extent(ka.ch, ka.ch.anims[ka.anim]!.frames, sq * (ka.ch.h / ch.h));
    const [bl] = extent(ch, ch.anims.idle!.frames, sq);
    expect(m.bossClear.c + Math.min(al, bl), "his swing clear of the west rock").toBeGreaterThan(8.5);
    expect(m.youClear.c + half).toBeLessThan(17.5);
    // His intro's moves (Nov 3: he sits there through it all, braced wide as he drinks): his feet clear of his stool, all of him
    // clear of the west rock. (The stool's outer edge: the park table's, a square and a half west of its middle.)
    for (const a of ["charge", "swell", "drink", "full", "settle"]) {
      const [il, ir] = extent(BOSS_HOLLOW_INTRO, BOSS_HOLLOW_INTRO.anims[a]!.frames, sq);
      const [, feet] = extent(BOSS_HOLLOW_INTRO, BOSS_HOLLOW_INTRO.anims[a]!.frames, sq, 0.3);
      expect(m.bossClear.c + il, `${a}: clear of the west rock`).toBeGreaterThan(8.5);
      expect(m.bossClear.c + feet, `${a}: his feet clear of his stool`).toBeLessThanOrEqual(m.table.c - 1.5);
      expect(ir).toBeGreaterThan(0);
    }
  });

});
