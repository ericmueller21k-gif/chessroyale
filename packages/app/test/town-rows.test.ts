import { describe, expect, it, vi } from "vitest";

// The street town (everyone's since Nov 13), as an admin's (every home): round 4's rows, the chase camera and the town wrapping east-west only.
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true }));

const { layRow, ROW_SIDES, ROW_PX, ROW_OVERLAP_PX, alongSign, homeSpan, splitGap, HOME_BODY, HOME_NO_SIDES } = await import("../src/town/rows.ts");
const { homeBox } = await import("../src/town/home-boxes.ts");
const { lookalikeWith } = await import("../src/town/lookalike.ts");
const { STREET_LOTS, homesOn } = await import("../src/town/street.ts");
const { N, WRAP, rowI, colI } = await import("../src/town/camera.ts");
const { HOMES, PROPS, START, findPath, stepsFrom, tdist, walkable } = await import("../src/town/world.ts");
const { streetBoxes, boxPoint, solidTop, pxOf } = await import("../src/town/boxes.ts");
const { seenFrom } = await import("../src/town/seen.ts");
const { StreetZoom, parkSide, isPark } = await import("../src/town/zoom-steps.ts");
const { TOWN_FEEL } = await import("../src/town/feel.ts");

/**
 * The street town, round 4 (Nov 5; brief-town-rows.md, docs/decisions/2026-11-05-street-rows.md): every street side one continuous row
 * (shipped and after random slot swaps), every join blended, corners closed, no front low next to the pawn; what the rows let you see;
 * the town wrapping east-west only; the zoom steps and the park's step out; the chase camera's heading; the Colosseum behind the rows.
 */
const ALL_HOMES = Object.keys(HOME_BODY) as (keyof typeof HOME_BODY)[];
const MIN_W = 0.6;
type Side = (typeof ROW_SIDES)[number];
type Placed = ReturnType<typeof layRow>;

/** Every point of a row side from end to end is covered by a front, each butting the next, and every join blended. */
function covered(side: Side, placed: Placed) {
  expect(placed[0]!.s0, `${side.id}: from its first end`).toBeCloseTo(side.a0, 6);
  expect(placed[placed.length - 1]!.s1, `${side.id}: to its last end`).toBeCloseTo(side.a1, 6);
  for (let i = 1; i < placed.length; i++) expect(placed[i]!.s0, `${side.id}: front ${i} butts the one before`).toBeCloseTo(placed[i - 1]!.s1, 6);
  placed.forEach((p, i) => {
    expect(p.s1 - p.s0, `${side.id}: front ${i} has width`).toBeGreaterThan(0.02);
    if (p.kind !== "look") return;
    // The join's blend (Eric: butted, not painted over): each look-alike runs a pixel under each neighbour, so no crack shows sky.
    expect(p.look!.w, `${side.id}: front ${i} overlaps its neighbours`).toBeGreaterThanOrEqual((p.s1 - p.s0) * ROW_PX + 2 * ROW_OVERLAP_PX - 0.5);
    // A front slimmer than a filler is only ever a strip between two homes (a pilaster over their seam), at least 12 px wide.
    if (p.s1 - p.s0 < MIN_W - 1e-9) {
      expect(placed[i - 1]?.kind === "home" && placed[i + 1]?.kind === "home", `${side.id}: a slim front ${i} between two homes`).toBe(true);
      expect(lookalikeWith(p.look!).box.front.w).toBeGreaterThanOrEqual(12);
    }
  });
}
/** Each end that turns a corner is closed: a look-alike whose turned side faces the cross street, or a home with its own side wall there. */
function cornersClosed(side: Side, placed: Placed) {
  const sgn = alongSign(side.facing);
  for (const [end, p] of [[0, placed[0]!], [1, placed[placed.length - 1]!]] as const) {
    if (!(end ? side.corner1 : side.corner0)) continue;
    // (The picture's left runs from a0 when sgn is +1, from a1 when -1.)
    const want = (end === 0) === sgn > 0 ? "L" : "R";
    if (p.kind === "look") expect(p.look!.corner, `${side.id}'s ${end ? "last" : "first"} end`).toBe(want);
    else expect(want === "L" ? homeBox(p.home!).left : homeBox(p.home!).right, `${side.id}: ${p.home}'s side on the corner`).toBeTruthy();
  }
}

describe("the rows (round 4)", () => {
  it("every street's built sides are rows: both sides of every east-west street, Seam Avenue's own stretch, the south edge's row", () => {
    const streets = new Set(ROW_SIDES.map((s) => s.street));
    // (The north edge round: Upper Street gone, Meadow Street new, south of South Street.)
    expect([...streets].sort()).toEqual(["colosseum-row", "fountain-st", "meadow-st", "seam-ave", "south-st"]);
    for (const st of ["meadow-st", "south-st", "fountain-st", "colosseum-row"]) {
      expect(ROW_SIDES.some((s) => s.street === st && s.facing === "S"), `${st}: its north side`).toBe(true);
      expect(ROW_SIDES.some((s) => s.street === st && s.facing === "N"), `${st}: its south side`).toBe(true);
    }
    // The south edge: one row the whole way round (no ends), and Colosseum Row's north row (its backs on the back wall) over the wrap.
    const edge = ROW_SIDES.find((s) => s.id === "south-edge")!;
    expect(edge.a1 - edge.a0).toBe(N);
    expect(ROW_SIDES.find((s) => s.id === "colrow-n")!.a1).toBeGreaterThan(N);
  });
  it("each side is covered from end to end by fronts butted edge to edge, every join blended, every corner closed, as shipped", () => {
    for (const side of ROW_SIDES) {
      const placed = layRow(side, homesOn(side));
      covered(side, placed);
      cornersClosed(side, placed);
    }
    // Every home stands in a row (all sixteen, an admin's).
    const inRows = ROW_SIDES.flatMap((s) => homesOn(s).map((h) => h.id));
    expect(inRows.sort()).toEqual([...ALL_HOMES].sort());
  });
  it("after random swaps (homes moved, removed, added, wider or narrower; other seeds) every side is still covered, blended and closed", () => {
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 600; n++) {
      const side = { ...ROW_SIDES[n % ROW_SIDES.length]!, seed: Math.floor(r() * 1e6), landmark: r() < 0.5 };
      if (side.facing === "W" || side.facing === "E") {
        covered(side, layRow(side, []));
        continue;
      }
      const homes: { id: (typeof ALL_HOMES)[number]; a: number; w: number }[] = [];
      let a = side.a0 + 0.5 + Math.floor(r() * 3);
      for (;;) {
        const id = ALL_HOMES[Math.floor(r() * ALL_HOMES.length)]!;
        const w = id === "alfil" ? 6 : 4;
        if (a + w > side.a1 + 0.5 || r() > 0.7) break;
        homes.push({ id, a, w });
        a += w + Math.floor(r() * 3);
      }
      const placed = layRow(side, homes);
      covered(side, placed);
      cornersClosed(side, placed);
    }
  });
  it("a gap of any length splits into look-alikes of at least 0.6 squares that add up to it", () => {
    for (let len = 0.6; len < 12; len += 0.37) {
      const ws = splitGap(len, Math.random);
      expect(ws.reduce((s, w) => s + w, 0)).toBeCloseTo(len, 6);
      for (const w of ws) expect(w).toBeGreaterThanOrEqual(0.6 - 1e-9);
    }
  });
  it("no front is low next to the pawn (Eric, Nov 5): three floors at least (the mockup's right row), a home's neighbours four (3 pawn heights)", () => {
    // (Your pawn as drawn: its box youSquares tall; the pawn's own shape about 0.85 of it.)
    const pawn = TOWN_FEEL.youSquares * 0.85;
    const side = (l: (typeof STREET_LOTS)[number]) => ROW_SIDES.find((s) => s.street === l.street && s.facing === l.facing)!;
    for (const s of ROW_SIDES) {
      const placed = layRow(s, homesOn(s));
      placed.forEach((p, i) => {
        if (p.kind !== "look") return;
        const { box, parts } = lookalikeWith(p.look!);
        expect(parts.floors, `${s.id} front ${i}`).toBeGreaterThanOrEqual(3);
        if (placed[i - 1]?.kind === "home" || placed[i + 1]?.kind === "home") {
          expect(parts.floors, `${s.id} front ${i}, beside a home`).toBeGreaterThanOrEqual(4);
          // ("About 3": a four-floor front's solid top is 2.9 to 4 pawn heights, its cap.)
          expect(solidTop(box) / pxOf(box) / pawn, `${s.id} front ${i}, beside a home`).toBeGreaterThanOrEqual(2.9);
        }
      });
    }
    expect(STREET_LOTS.filter((l) => l.look && l.kind !== "tall").every((l) => side(l))).toBe(true);
  });
  it("the skyline's towers stand over every row (6 to 9 floors), windows on every side, their sky above", () => {
    const towers = STREET_LOTS.filter((l) => l.kind === "tall");
    // (Round 5: the four on the town's back rows gave way to the grove along the back wall: six left, behind South Street's row.)
    expect(towers.length).toBeGreaterThanOrEqual(6);
    const rowTop = Math.max(...STREET_LOTS.filter((l) => l.look && l.kind !== "tall").map((l) => lookalikeWith(l.look!).box.front.h));
    for (const t of towers) {
      const { box, parts } = lookalikeWith(t.look!);
      expect(parts.floors).toBeGreaterThanOrEqual(6);
      expect(box.front.h, t.name).toBeGreaterThan(rowTop * 0.9);
      expect(box.left && box.right && box.rear).toBeTruthy();
    }
  });
  it("away from the corners a look-alike is a flat front (a shallow box, one flat roof face); a corner keeps its depth and its roof", () => {
    const looks = STREET_LOTS.filter((l) => l.look && l.kind !== "tall");
    for (const l of looks) {
      const { box } = lookalikeWith(l.look!);
      if (l.look!.corner) expect(l.look!.flat).toBeFalsy();
      else {
        expect(l.look!.flat, l.name).toBe(true);
        expect(box.roof).toHaveLength(1);
        expect(box.depth).toBeLessThanOrEqual(2);
      }
    }
  });
  it("the rows' copy of each home's body matches its art; a home's body is centred on its lot", () => {
    for (const [id, [w, x0, x1]] of Object.entries(HOME_BODY)) {
      const b = homeBox(id as never);
      expect([b.front.w, b.body.x0, b.body.x1], id).toEqual([w, x0, x1]);
      // (And its copy of which homes have no side walls.)
      expect(!b.left && !b.right, id).toBe(HOME_NO_SIDES.has(id as never));
    }
    const [s0, s1] = homeSpan("timber", 3, 4, "S");
    expect((s0 + s1) / 2).toBeGreaterThan(4);
    expect((s0 + s1) / 2).toBeLessThan(5);
  });
  it("a look-alike's wall fills every column of its picture (no gap to its neighbour), and its back shows from behind", () => {
    for (let seed = 1; seed < 40; seed++) {
      const { box } = lookalikeWith({ seed, w: 20 + seed * 3, tall: (seed % 4) as 0 | 1 | 2 | 3, depth: 2.3 });
      expect(box.body.x0).toBe(0);
      expect(box.body.x1).toBe(box.front.w);
      expect(box.rear?.ch.w).toBe(box.front.w);
    }
  });
});

describe("what the rows let you see (round 4): drawn, the rest left out at the close zoom steps", () => {
  const BOXES = streetBoxes(PROPS).filter((b) => b.kind !== "shed" && b.kind !== "hedge");
  const pt = { x: 0, y: 0 };
  const seenBox = (seen: Uint8Array, b: (typeof BOXES)[number]) => {
    for (let u = 0; u <= b.box.front.w; u += 6) {
      boxPoint(b, b.box, Math.min(u, b.box.front.w - 0.5), 0.02, pt);
      if (seen[rowI(Math.round(pt.y)) * N + colI(Math.round(pt.x))]) return true;
    }
    return false;
  };
  it("from Fountain Street: its own rows both sides, never the rows back to back behind them; draws fall to well under half", () => {
    const seen = seenFrom(4, 28);
    const near = BOXES.filter((b) => Math.hypot(((((b.fx - 4 + N / 2) % N) + N) % N) - N / 2, b.fy - 28) < 16);
    const shown = near.filter((b) => seenBox(seen, b));
    const street = (b: (typeof BOXES)[number]) => STREET_LOTS[b.lot]!.street;
    expect(shown.some((b) => street(b) === "fountain-st" && b.facing === "S")).toBe(true);
    expect(shown.some((b) => street(b) === "fountain-st" && b.facing === "N")).toBe(true);
    // (Their corners onto Seam Avenue, a look-alike's or a home's, show up the avenue from the crossing: their flat fronts never. The north
    // edge round: Colosseum Row's north row closes the avenue's end, facing down it, as Upper Street's did: in view.)
    expect(shown.filter((b) => ((street(b) === "colosseum-row" && b.facing === "N") || street(b) === "south-st") && !b.home && !STREET_LOTS[b.lot]!.look?.corner).map((b) => b.box.id)).toEqual([]);
    // (Nov 6: no look-alike narrower than a square, so fewer, wider fronts near: 27 of 52 shown, where it was 28 of 55; under 0.55.)
    expect(shown.length / near.length).toBeLessThan(0.55);
  });
  it("sees down the street and over the wrap, through a crossing up the avenue, and not through a row", () => {
    const s = seenFrom(4, 28);
    expect(s[28 * N + 48]).toBe(1); // west along Fountain Street, over the wrap
    expect(s[36 * N + 0]).toBe(1); // up Seam Avenue from its crossing
    expect(s[36 * N + 8]).toBe(0); // Colosseum Row, behind Fountain Street's north row
    expect(s[21 * N + 8]).toBe(0); // the gardens behind its south row
  });
});

describe("the town wraps east-west only (round 4; Eric: the Colosseum at the north edge, nothing behind it)", () => {
  it("is the plan's one switch: east-west yes, north-south no", () => {
    expect(WRAP).toEqual({ ew: true, ns: false });
    expect(rowI(-1)).toBe(-1);
    expect(rowI(N)).toBe(-1);
    expect(colI(-1)).toBe(N - 1);
    expect(colI(N)).toBe(0);
  });
  it("nothing past the north or south edge is walked; distances don't go round north-south", () => {
    for (let c = 0; c < N; c++) {
      expect(walkable(c, -1)).toBe(false);
      expect(walkable(c, N)).toBe(false);
    }
    expect(tdist({ c: 22, r: 1 }, { c: 22, r: N - 2 })).toBe(N - 3);
    expect(tdist({ c: 1, r: 5 }, { c: N - 2, r: 5 })).toBe(3);
  });
  it("a path never crosses the north or south edge, and does cross east-west the short way", () => {
    // The plaza before the Colosseum (the north edge round: walled, a gateway out) to Meadow Street (the bottom street): down through the
    // town, every step one row at most.
    const from = { c: 22, r: 41 };
    expect(walkable(from.c, from.r)).toBe(true);
    const path = findPath(from, (c, r) => c === 14 && r === 5, walkable)!;
    expect(path).not.toBeNull();
    let prev = from;
    for (const s of path) {
      expect(Math.abs(s.r - prev.r), `${prev.c},${prev.r} -> ${s.c},${s.r}`).toBeLessThanOrEqual(1);
      expect(s.r).toBeGreaterThanOrEqual(0);
      expect(s.r).toBeLessThan(N);
      prev = s;
    }
    expect(path.length).toBeGreaterThan(36);
    // East-west: from just east of the seam to just west of it, three steps over it.
    const across = findPath({ c: 1, r: 5 }, (c, r) => c === N - 2 && r === 5, walkable)!;
    expect(across.map((s) => s.c)).toEqual([0, N - 1, N - 2]);
    // And from the start, every square reached is a square you can stand on in the world.
    const d = stepsFrom(START);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (d[r * N + c]! > 0) expect(walkable(c, r)).toBe(true);
  });
  it("every home's door is on a street (its lot moved with the plan): walkable, reached from the start", () => {
    const d = stepsFrom(START);
    for (const h of HOMES) expect(d[h.door.r * N + h.door.c], h.id).toBeGreaterThan(0);
  });
});

describe("the zoom steps and the park's step out (round 4)", () => {
  const steps = TOWN_FEEL.streetZoomSteps;
  it("has five steps (in, the mockup's camera, out, the overview, and since Nov 13 the old town's zoomed-out camera, the furthest); the town opens at the third (Eric, Nov 5: \"we're going with number three for the default\")", () => {
    expect(steps).toHaveLength(5);
    expect(TOWN_FEEL.streetZoomStart).toBe(2);
    expect(steps[1]!.tall).toEqual(TOWN_FEEL.camStreetTall);
    expect(steps[1]!.wide).toEqual(TOWN_FEEL.camStreetWide);
    for (let k = 1; k < 5; k++) expect(steps[k]!.tall.h).toBeGreaterThan(steps[k - 1]!.tall.h);
    for (let k = 1; k < 5; k++) expect(steps[k]!.wide.h).toBeGreaterThan(steps[k - 1]!.wide.h);
  });
  it("the park: its square of slack at the edge (fully in, fully out, between)", () => {
    // (The north edge round: the park 8 rows on.)
    expect(isPark(22, 28)).toBe(true);
    expect(parkSide(22, 28)).toBe(true);
    expect(parkSide(13, 28)).toBe(null); // its edge
    expect(parkSide(12, 28)).toBe(null); // the square before it
    expect(parkSide(8, 28)).toBe(false);
  });
  it("− and + move a step at a time, gliding, and stop at the ends", () => {
    const z = new StreetZoom(1, false);
    expect(z.press(true, 0)).toBe(2);
    expect(z.at(TOWN_FEEL.streetZoomMs / 2)).toBeCloseTo(1.5, 6);
    expect(z.at(TOWN_FEEL.streetZoomMs)).toBe(2);
    expect(z.press(true, 1000)).toBe(3);
    expect(z.press(true, 2000)).toBe(4);
    expect(z.press(true, 3000)).toBe(4);
    for (let k = 0; k < 6; k++) z.press(false, 3000 + k);
    expect(z.step).toBe(0);
  });
  it("coming into the park eases one step out over parkZoomMs; leaving eases back; the slack changes nothing", () => {
    const z = new StreetZoom(1, false);
    z.where(null, 0);
    expect(z.step).toBe(1);
    z.where(true, 100);
    expect(z.step).toBe(2);
    expect(z.before).toBe(1);
    expect(z.at(100 + TOWN_FEEL.parkZoomMs / 2)).toBeCloseTo(1.5, 6);
    expect(z.at(100 + TOWN_FEEL.parkZoomMs)).toBe(2);
    expect(TOWN_FEEL.parkZoomMs).toBeGreaterThanOrEqual(500);
    expect(TOWN_FEEL.parkZoomMs).toBeLessThanOrEqual(800);
    // Walking along the edge: nothing.
    z.where(null, 1000);
    z.where(true, 1100);
    expect(z.step).toBe(2);
    z.where(false, 2000);
    expect(z.step).toBe(1);
    expect(z.before).toBe(null);
    // From the overview: nothing further out (the farthest step is only chosen with −), and nothing back; nor from the farthest.
    const top = new StreetZoom(3, false);
    top.where(true, 0);
    expect(top.step).toBe(3);
    top.where(false, 1000);
    expect(top.step).toBe(3);
    const far = new StreetZoom(4, false);
    far.where(true, 0);
    expect(far.step).toBe(4);
    far.where(false, 1000);
    expect(far.step).toBe(4);
  });
  it("a press in the park wins: you leave at the step you chose", () => {
    const z = new StreetZoom(1, false);
    z.where(true, 0);
    expect(z.step).toBe(2);
    z.press(false, 1000);
    expect(z.step).toBe(1);
    z.where(false, 2000);
    expect(z.step).toBe(1);
    // Opening in the park doesn't zoom you; leaving and coming back does.
    const o = new StreetZoom(1, true);
    o.where(true, 0);
    expect(o.step).toBe(1);
    o.where(false, 10);
    o.where(true, 20);
    expect(o.step).toBe(2);
  });
  it("one switch turns it off (parkZoomOut)", () => {
    const was = TOWN_FEEL.parkZoomOut;
    (TOWN_FEEL as { parkZoomOut: boolean }).parkZoomOut = false;
    try {
      const z = new StreetZoom(1, false);
      z.where(true, 0);
      expect(z.step).toBe(1);
    } finally {
      (TOWN_FEEL as { parkZoomOut: boolean }).parkZoomOut = was;
    }
  });
});

// (Round 5: the chase camera's heading tests went with it: test/town-fixed.test.ts has the one fixed view.)

// (The north edge round: round 4's line of sight to the Colosseum went with its flat picture. Its ring of boxes is drawn where it stands,
// over the rows' roofs from near enough: test/town-north-edge.test.ts.)
