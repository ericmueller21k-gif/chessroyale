import { describe, expect, it, vi } from "vitest";

// An admin's town is the street town (admin-town.ts STREET_TOWN): round 6's bigger Colosseum, Moo's and Ginger's homes up in their rows.
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true, STREET_TOWN: true }));

const { N, newPt, newView, proj, radial, rel, rimYAt, setView, forEachSquare } = await import("../src/town/camera.ts");
const { STREET_COLISEUM, STREET_LOTS, STREET_PROPS } = await import("../src/town/street.ts");
const { COLISEUM, COLISEUM_PLACE, PROPS, walkable } = await import("../src/town/world.ts");
const { streetBoxes, boxPoint, pxOf } = await import("../src/town/boxes.ts");
const { STRIPS } = await import("../src/town/strips.ts");
const { HOUSE_COLISEUM, HOUSE_COLISEUM_STREET, HOUSE_COLISEUM_SIGN, HOUSE_COLISEUM_STREET_SIGN, HOUSE_COLISEUM_STREET_LIGHTS, statueSpot } = await import("../src/town/houses/coliseum.ts");
const { COLISEUM_ART } = await import("../src/town/houses/index.ts");
const { STATUE_W, statueH } = await import("../src/town/houses/statues.ts");
const { TOWN_FEEL } = await import("../src/town/feel.ts");

type Ch = typeof HOUSE_COLISEUM;
/**
 * The street town, round 6 (Nov 5; brief-street-colosseum-big.md, docs/decisions/2026-11-05-street-colosseum-big.md): the Colosseum about
 * twice as tall and clearly wider, its top tiers over the rows from the streets south of it (the landmark you steer by), nothing
 * walkable beside or behind it; Moo's paddock and Ginger's dome drawn bigger, their fronts on their rows' line.
 */
const S = TOWN_FEEL.housePxPerSquare;
const at = (c: number, r: number) => `${c},${r}`;

/** A picture's first frame as opaque pixels (see-through shadows left out), and each column's first drawn row (-1: none). */
function opaque(ch: Ch): { op: Uint8Array; tops: Int16Array } {
  const op = new Uint8Array(ch.w * ch.h);
  for (const l of ch.anims.idle!.frames[0]!.layers) {
    const g = ch.parts[l.part]!.grid;
    for (let j = 0; j < g.length; j++)
      for (let i = 0; i < g[j]!.length; i++) {
        const k = g[j]![i]!;
        if (k === "." || (ch.palette[k] ?? "").length > 7) continue;
        const x = Math.round(l.x + i);
        const y = Math.round(l.y + j);
        if (x >= 0 && y >= 0 && x < ch.w && y < ch.h) op[y * ch.w + x] = 1;
      }
  }
  const tops = new Int16Array(ch.w).fill(-1);
  for (let x = 0; x < ch.w; x++)
    for (let y = 0; y < ch.h; y++)
      if (op[y * ch.w + x]) {
        tops[x] = y;
        break;
      }
  return { op, tops };
}
/** A part's opaque height at its middle column, and its width (its wall: the face's height at the gate's axis, the oval's width). */
function partSize(ch: Ch, name: string): { w: number; hMid: number } {
  const g = ch.parts[name]!.grid;
  const mid = Math.floor(g[0]!.length / 2);
  return { w: g[0]!.length, hMid: g.filter((row) => row[mid] !== ".").length };
}

describe("the street town's Colosseum, bigger (round 6; Eric: \"make it taller and bigger, so it really feels like a true overwhelmingly large kind of building\")", () => {
  it("is about twice as tall as today's and clearly wider, the same building; today's town keeps today's", () => {
    const big = partSize(HOUSE_COLISEUM_STREET, "wall");
    const today = partSize(HOUSE_COLISEUM, "wall");
    // Its wall's face at the gate (to its attic's lip) and the whole picture over its foot.
    const face = (ch: Ch) => partSize(ch, "wall").hMid - (ch.parts.wall!.grid.length - (ch.foot[1] - ch.anims.idle!.frames[0]!.layers.find((l) => l.part === "wall")!.y));
    expect(face(HOUSE_COLISEUM_STREET) / face(HOUSE_COLISEUM), "its wall's face, street / today").toBeGreaterThan(1.85);
    expect(face(HOUSE_COLISEUM_STREET) / face(HOUSE_COLISEUM)).toBeLessThan(2.15);
    expect(big.w / today.w, "its oval's width, street / today").toBeGreaterThan(1.2);
    const above = (ch: Ch) => ch.foot[1] - Math.min(...[...opaque(ch).tops].filter((t) => t >= 0));
    expect(above(HOUSE_COLISEUM_STREET) / above(HOUSE_COLISEUM), "its top (the flag's tip) over its foot").toBeGreaterThan(1.45);
    // In the street town (an admin's) its art is the big one, sign, lights and all; the tablet bigger for "THE COLOSSEUM".
    expect(COLISEUM_ART.ch).toBe(HOUSE_COLISEUM_STREET);
    expect(COLISEUM_ART.sign).toBe(HOUSE_COLISEUM_STREET_SIGN);
    expect(HOUSE_COLISEUM_STREET_SIGN.w).toBeGreaterThan(HOUSE_COLISEUM_SIGN.w);
    expect(HOUSE_COLISEUM_STREET_SIGN.h).toBeGreaterThan(HOUSE_COLISEUM_SIGN.h);
    // Its gate stays on its two squares (the plan's gate), its foot on its ground's front line.
    const gate = HOUSE_COLISEUM_STREET_LIGHTS[0]!;
    expect(gate.w, "the gate's width (px)").toBeLessThanOrEqual(2 * S);
    expect(gate.y + gate.h).toBe(HOUSE_COLISEUM_STREET.foot[1]);
    expect(COLISEUM_PLACE.cy - COLISEUM_PLACE.foot).toBe(STREET_COLISEUM.r0 - 0.5);
    // Its lights keep off its statues (no glare on their quotes), as today's do.
    for (const id of ["marble", "bronze"] as const) {
      const [sx, sy] = statueSpot(id);
      for (const l of HOUSE_COLISEUM_STREET_LIGHTS) {
        const clear = l.x + l.w + TOWN_FEEL.lightSpill[1][0] < sx || l.x - TOWN_FEEL.lightSpill[1][0] > sx + STATUE_W || l.y > sy + statueH(id) || l.y + l.h < sy;
        expect(clear, `a light at ${l.x},${l.y} glows over the ${id} statue`).toBe(true);
      }
    }
  });

  it("nothing walkable beside or behind it: every square under its picture's width, from its front line to the edge, is its ground or grove, with no tree standing inside it", () => {
    const C = STREET_COLISEUM;
    const axis = C.c0 + (C.size - 1) / 2;
    const half = partSize(HOUSE_COLISEUM_STREET, "wall").w / 2 / S;
    expect(half, "wider than its 12 squares of ground").toBeGreaterThan(C.size / 2 + 1);
    expect(half, "within the plaza's grove columns").toBeLessThan(C.size / 2 + 4);
    for (let r = C.r0; r < N; r++)
      for (let c = Math.floor(axis - half - 1); c <= Math.ceil(axis + half + 1); c++) expect(walkable(c, r), at(c, r)).toBe(false);
    for (const p of STREET_PROPS) if (p.y >= C.r0 - 0.5 && Math.abs(p.x - axis) < half) expect(p.kind === "tree" || p.kind === "bush", `${p.kind} at ${p.x},${p.y} inside it`).toBe(false);
    // The walls and gates beside it keep their lots (round 5), their outer halves and gates clear of its sides.
    const walls = STREET_LOTS.filter((l) => l.kind === "wall" && l.r0 === C.r0);
    expect(walls.map((l) => [l.c0, l.c0 + l.w - 1])).toEqual([[C.c0 - 4, C.c0 - 1], [C.c0 + C.size, C.c0 + C.size + 3]]);
    for (const l of walls) {
      const gx = l.c0 - 0.5 + l.wall!.gate! / S;
      expect(Math.abs(gx - axis) - 19 / S, `${l.name}'s gate clear of its side`).toBeGreaterThan(half);
    }
  });

  describe("its top over the rows: from the streets south of it, facing north, its top tiers show over the roofs", () => {
    const col = opaque(HOUSE_COLISEUM_STREET);
    const boxes = streetBoxes(PROPS);
    const pt = { x: 0, y: 0 };
    const p = newPt();
    const q = newPt();
    /**
     * How many of the Colosseum's top's columns (every 4 px across its picture on screen) show from (c, r), facing north, in a W x H box:
     * on screen, above the horizon when it's past the rim, and over every box and tree nearer the camera than its front, each counted as
     * the screen box round its whole block (its front, its depth, its tallest roof): bigger than it draws, so never too many.
     */
    function shows(c: number, r: number, W: number, H: number): number {
      const v = newView();
      setView(v, W, H, 0, 1, 0, 0, { tall: TOWN_FEEL.camStreetTall, wide: TOWN_FEEL.camStreetWide });
      const o = { dx: 0, dz: 0 };
      rel(v, c, r, COLISEUM_PLACE.cx, COLISEUM_PLACE.cy - COLISEUM_PLACE.foot, o);
      if (!proj(v, o.dx, o.dz, 0, p)) return 0;
      const far = radial(v, o.dx, o.dz) > v.rim;
      const ch = HOUSE_COLISEUM_STREET;
      const k = p.k / S;
      const x0 = p.x - ch.foot[0] * k;
      const y0 = p.y - ch.foot[1] * k;
      // Everything nearer than its front that the frame draws (boxes out to the rim and a little past, trees inside it), as screen boxes.
      const cover: [number, number, number, number][] = [];
      const grow = (xs: number[], ys: number[]) => cover.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
      for (const b of boxes) {
        const box = b.box;
        const px = pxOf(box);
        const tall = Math.max(box.front.foot[1], ...box.roof.flatMap((f) => f.pts.map((t) => t[2]))) / px;
        const xs: number[] = [];
        const ys: number[] = [];
        let near = false;
        for (const u of [0, box.front.w])
          for (const t of [0, 1]) {
            boxPoint(b, box, u, t, pt);
            const d = { dx: 0, dz: 0 };
            rel(v, c, r, pt.x, pt.y, d);
            if (d.dz < o.dz && radial(v, d.dx, d.dz) < v.rim + 4) near = true;
            for (const h of [0, tall]) if (proj(v, d.dx, Math.max(d.dz, -v.back + 0.6), h, q)) (xs.push(q.x), ys.push(q.y));
          }
        if (near && xs.length) grow(xs, ys);
      }
      for (const t of STREET_PROPS) {
        if (t.kind !== "tree") continue;
        const d = { dx: 0, dz: 0 };
        rel(v, c, r, t.x, t.y, d);
        if (d.dz >= o.dz || radial(v, d.dx, d.dz) > v.rim || !proj(v, d.dx, d.dz, 0, q)) continue;
        grow([q.x - 1.2 * q.k, q.x + 1.2 * q.k], [q.y - 3 * q.k, q.y]);
      }
      let n = 0;
      for (let x = Math.max(0, Math.ceil(x0)); x < Math.min(W, x0 + ch.w * k); x += 4) {
        const t = col.tops[Math.floor((x - x0) / k)]!;
        if (t < 0) continue;
        const y = y0 + (t + 0.5) * k;
        if (y < 0 || y >= H || (far && y >= (rimYAt(v, x) ?? -Infinity))) continue;
        if (!cover.some(([a, b, cc]) => x >= a && x <= cc && y >= b)) n++;
      }
      return n;
    }
    // South Street (south of the park), west and east of the promenade and up it; Fountain Street's east end, across the park.
    const SPOTS = [
      [8, 5],
      [22, 5],
      [36, 5],
      [38, 21],
    ] as const;
    for (const [name, W, H] of [["a phone", 390, 844], ["a computer", 1280, 800]] as const)
      it(`on ${name}: from at least two street spots south of the park, a good stretch of its top shows over the rows`, () => {
        const seen = SPOTS.map(([c, r]) => [at(c, r), shows(c, r, W, H)] as const);
        const south = seen.filter(([s, n]) => s.endsWith(",5") && n >= 6);
        expect(south.length, seen.map(([s, n]) => `${s}: ${n}`).join("; ")).toBeGreaterThanOrEqual(2);
      });
    it("from the plaza's foot and from the park it fills the view ahead (its top above the box: it looms)", () => {
      const v = newView();
      setView(v, 390, 844, 0, 1, 0, 0, { tall: TOWN_FEEL.camStreetTall, wide: TOWN_FEEL.camStreetWide });
      const o = { dx: 0, dz: 0 };
      rel(v, 22, 31, COLISEUM_PLACE.cx, COLISEUM_PLACE.cy - COLISEUM_PLACE.foot, o);
      expect(proj(v, o.dx, o.dz, 0, p)).toBe(true);
      const ch = HOUSE_COLISEUM_STREET;
      const k = p.k / S;
      expect(p.y - ch.foot[1] * k, "its top over the box's top").toBeLessThan(0);
      expect(p.x - ch.foot[0] * k, "wider than the box").toBeLessThan(0);
      expect(p.x + (ch.w - ch.foot[0]) * k).toBeGreaterThan(390);
    });
  });

  it("no square drawn twice, and one Colosseum: from the streets south of it to its plaza, at every zoom step, phone and computer", () => {
    for (const steps of TOWN_FEEL.streetZoomSteps)
      for (const [W, H] of [[390, 844], [1280, 800]] as const)
        for (const [camX, camY] of [[8, 5], [22, 5], [36, 5], [8, 20], [38, 21], [22, 24], [22, 31], [14, 32], [40, 38]] as const) {
          const v = newView();
          setView(v, W, H, 0, 1, 0, 0, steps);
          const seen = new Set<string>();
          forEachSquare(v, camX, camY, false, (c, r) => {
            if (c < 0 || r < 0) return;
            expect(seen.has(at(c, r)), `${at(c, r)} twice from ${camX},${camY}`).toBe(false);
            seen.add(at(c, r));
          });
          // (The Colosseum stands where the shortest way round puts it: once, east-west within half the world.)
          const o = { dx: 0, dz: 0 };
          rel(v, camX, camY, COLISEUM_PLACE.cx, COLISEUM_PLACE.cy - COLISEUM_PLACE.foot, o);
          expect(Math.abs(o.dx)).toBeLessThanOrEqual(N / 2);
        }
    expect(COLISEUM).toEqual(STREET_COLISEUM);
  });
});

describe("Moo's paddock and Ginger's dome up in their rows (round 6; the brief: they \"look sunk or short beside their neighbors\")", () => {
  const boxes = streetBoxes(PROPS);
  const pt = { x: 0, y: 0 };
  for (const id of ["moo", "gingerbread"] as const)
    it(`${id}: its front on its row's ground line, its picture's foot on it, its height with its neighbors', its door and strip working`, () => {
      const home = boxes.find((b) => b.home === id)!;
      expect(home, id).toBeDefined();
      // Drawn bigger (fewer picture pixels a square) than the rows' 37.
      const px = pxOf(home.box);
      expect(px).toBeCloseTo(S / TOWN_FEEL.streetHomeScale[id]!, 6);
      // Its row: the boxes facing its way whose front line is within a square of its, along the same street (its neighbors either side).
      const row = boxes.filter((b) => b !== home && b.facing === home.facing && b.kind !== "wall" && b.kind !== "hedge" && b.kind !== "shed" && Math.abs(b.fy - home.fy) < 1 && Math.abs(b.fx - home.fx) < 8);
      expect(row.length, "neighbors").toBeGreaterThanOrEqual(2);
      // The ground line: its front line is theirs (their feet on one line), and its picture's bottom sits on its foot (nothing sunk under it).
      for (const b of row) expect(home.fy, `${b.box.id}'s front line`).toBeCloseTo(b.fy, 6);
      const lowest = (ch: Ch) => {
        const { op } = opaque(ch);
        let lo = 0;
        for (let i = 0; i < op.length; i++) if (op[i]) lo = Math.floor(i / ch.w);
        return lo;
      };
      expect(Math.abs(lowest(home.box.front) - home.box.front.foot[1]), "its picture's bottom on its foot (px)").toBeLessThanOrEqual(3);
      // Its height (its picture's top over its foot, in squares) with its neighbors': at least three-quarters of the median's.
      const height = (box: typeof home.box) => {
        const t = [...opaque(box.front).tops].filter((y) => y >= 0);
        return (box.front.foot[1] - Math.min(...t)) / pxOf(box);
      };
      const hs = row.map((b) => height(b.box)).sort((a, b) => a - b);
      const median = hs[Math.floor(hs.length / 2)]!;
      expect(height(home.box), `its height against its neighbors' median ${median.toFixed(2)}`).toBeGreaterThanOrEqual(0.75 * median);
      expect(height(home.box), "taller than at the rows' scale").toBeGreaterThan(height({ ...home.box, px: S }) * 1.2);
      // Its door square and rest square stay on the sidewalk before its front; its strip still has its door square.
      const lot = STREET_LOTS.find((l) => l.kind === "home" && l.id === id)!;
      boxPoint(home, home.box, 0, 0, pt);
      const left = pt.x;
      boxPoint(home, home.box, home.box.front.w, 0, pt);
      const right = pt.x;
      for (const sq of [lot.door!, lot.rest!]) {
        expect(sq.c, `${at(sq.c, sq.r)} before its front (${left.toFixed(2)}..${right.toFixed(2)})`).toBeGreaterThanOrEqual(Math.min(left, right));
        expect(sq.c).toBeLessThanOrEqual(Math.max(left, right));
        expect(walkable(sq.c, sq.r), at(sq.c, sq.r)).toBe(true);
      }
      const strip = STRIPS.find((s) => s.home === id)!;
      expect(strip.squares).toContainEqual({ c: lot.door!.c, r: lot.door!.r });
    });
});
