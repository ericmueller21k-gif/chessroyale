import { describe, expect, it } from "vitest";
import { N, forEachSquare, newPt, newView, pickSquare, proj, rowsInView, setView, wrapF, wrapI } from "../src/town/camera.ts";
import { COLISEUM, HOMES, PARK, PAVING, START, ease, findPath, groundAt, plotAt, walkable } from "../src/town/world.ts";

/** The town square's camera (src/town/camera.ts): pure projection math, on a phone's box and a computer's. */
const BOXES = [
  ["phone", 390, 792],
  ["computer", 1440, 848],
] as const;

describe("town square camera", () => {
  it.each(BOXES)("a square at the focus projects to the box's middle column (%s)", (_, W, H) => {
    const v = newView();
    setView(v, W, H, 0);
    const p = newPt();
    expect(proj(v, 0, 0, 0, p)).toBe(true);
    expect(p.x).toBeCloseTo(W / 2, 6);
    expect(p.y).toBeGreaterThan(H * 0.4);
    expect(p.y).toBeLessThan(H);
    // ... and the horizon sits about a fifth of the way down the box (the prototype's camera).
    expect(v.hy / H).toBeGreaterThan(0.15);
    expect(v.hy / H).toBeLessThan(0.3);
  });

  it("the world wraps both ways", () => {
    expect(wrapI(-1)).toBe(N - 1);
    expect(wrapI(N)).toBe(0);
    expect(wrapI(3 * N + 5)).toBe(5);
    expect(wrapF(N - 1)).toBe(-1);
    expect(wrapF(-(N - 1))).toBe(1);
    expect(wrapF(N / 2 + 2)).toBe(-N / 2 + 2);
    // A square just across the seam is drawn next to the focus, not a whole world away.
    const v = newView();
    setView(v, 390, 792, 0);
    const a = newPt();
    const b = newPt();
    proj(v, wrapF(N - 1 - 0), wrapF(0 - 0), 0, a); // the square one to the left of column 0, seen from column 0
    proj(v, -1, 0, 0, b);
    expect(a.x).toBeCloseTo(b.x, 6);
  });

  it.each(BOXES)("a tap on a drawn square picks that square, wherever the camera is (%s)", (_, W, H) => {
    const v = newView();
    setView(v, W, H, 0);
    const p = newPt();
    for (const [camX, camY] of [
      [20, 10],
      [0.3, 39.6],
      [39.2, 0.4],
    ] as const) {
      let checked = 0;
      for (const [dc, dr] of [
        [0, 0],
        [0, 3],
        [-2, 5],
        [1, 8],
        [0, -2],
      ] as const) {
        const c = wrapI(Math.round(camX) + dc);
        const r = wrapI(Math.round(camY) + dr);
        // The square's middle on screen, then a tap there.
        if (!proj(v, wrapF(c - camX), wrapF(r - camY), 0, p) || p.y > H || p.y < v.hy) continue;
        expect(pickSquare(v, camX, camY, p.x, p.y), `square ${c},${r} from ${camX},${camY}`).toEqual({ c, r });
        checked++;
      }
      expect(checked).toBeGreaterThanOrEqual(4);
    }
    // The sky picks nothing.
    expect(pickSquare(v, 20, 10, W / 2, 2)).toBeNull();
  });

  it("far squares shrink", () => {
    const v = newView();
    setView(v, 390, 792, 0);
    const p = newPt();
    let last = Infinity;
    for (let dz = -2; dz <= 10; dz++) {
      expect(proj(v, 0, dz, 0, p)).toBe(true);
      expect(p.k).toBeLessThan(last);
      last = p.k;
    }
    // Every drawn square is smaller the farther its row.
    const widths = new Map<number, number>();
    forEachSquare(v, 20, 10, true, (_c, _r, _cu, ru, q) => void widths.set(ru, q[4]! - q[6]!));
    const rows = [...widths.keys()].sort((a, b) => a - b);
    for (let i = 1; i < rows.length; i++) expect(widths.get(rows[i]!)!).toBeLessThan(widths.get(rows[i - 1]!)!);
  });

  it.each(BOXES)("zooming out shows more rows (%s)", (_, W, H) => {
    const v = newView();
    setView(v, W, H, 0);
    const near = rowsInView(v);
    setView(v, W, H, 1);
    const far = rowsInView(v);
    expect(near).toBeGreaterThanOrEqual(10);
    expect(far).toBeGreaterThan(near + 2);
  });

  it("the box's shape blends the phone's camera and the computer's", () => {
    const v = newView();
    setView(v, 390, 792, 0);
    expect(v.P.h).toBeCloseTo(9.3);
    setView(v, 1440, 848, 0);
    expect(v.P.h).toBeCloseTo(7.8);
    setView(v, 800, 800, 0);
    expect(v.P.h).toBeGreaterThan(7.8);
    expect(v.P.h).toBeLessThan(9.3);
  });
});

describe("town square walking", () => {
  it("thirteen homes spread over the world: neighbors 8 or more squares apart, none near your start, the Colosseum's ground clear", () => {
    expect(HOMES).toHaveLength(13);
    expect(new Set(HOMES.map((h) => h.id)).size).toBe(13);
    const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(wrapF(ax - bx), wrapF(ay - by));
    for (const h of HOMES) {
      expect(dist(h.cx, h.cy, START.c, START.r), `${h.id} from the start`).toBeGreaterThanOrEqual(7.5);
      const near = Math.min(...HOMES.filter((o) => o !== h).map((o) => dist(h.cx, h.cy, o.cx, o.cy)));
      expect(near, `${h.id}'s nearest neighbor`).toBeGreaterThanOrEqual(8);
      expect(near, `${h.id}'s nearest neighbor`).toBeLessThanOrEqual(10);
    }
    // No home stands on the Colosseum's 12 x 12 ground (slice 5 built the Colosseum there: solid; slice 6 made it twice the
    // size), nor in its park, and you start south of it, in the park in front of its gate (slice 6: the park between; since
    // the park stood back from it, 11 rows south, still inside the view's rim).
    for (let r = COLISEUM.r0; r < COLISEUM.r0 + COLISEUM.size; r++) for (let c = COLISEUM.c0; c < COLISEUM.c0 + COLISEUM.size; c++) expect(plotAt[r * N + c]).toBeNull();
    for (let r = PARK.r1 - PARK.d + 1; r <= PARK.r1; r++) for (let c = PARK.c0; c < PARK.c0 + PARK.w; c++) expect(plotAt[r * N + c]).toBeNull();
    expect(START.r).toBeLessThan(COLISEUM.r0);
    expect(COLISEUM.r0 - START.r).toBeLessThanOrEqual(11);
    expect(START.c).toBeGreaterThanOrEqual(COLISEUM.c0);
    expect(START.c).toBeLessThan(COLISEUM.c0 + COLISEUM.size);
    expect(groundAt[START.r * N + START.c], "on the park's promenade").toBe(PAVING);
    expect(walkable(START.c, START.r)).toBe(true);
  });

  it("a path walks around a home", () => {
    const ginger = HOMES.find((h) => h.id === "gingerbread")!;
    // From the start to the square behind Ginger's house: around it, never through it.
    const goal = { c: ginger.cx, r: ginger.cy + 2 };
    const path = findPath(START, (c, r) => c === goal.c && r === goal.r, walkable)!;
    expect(path.at(-1)).toEqual(goal);
    for (const s of path) expect(walkable(s.c, s.r)).toBe(true);
    for (let i = 1; i < path.length; i++) expect(Math.abs(wrapF(path[i]!.c - path[i - 1]!.c)) + Math.abs(wrapF(path[i]!.r - path[i - 1]!.r))).toBe(1);
  });

  it("an eased first or last step meets the even steps at the same speed (no jolt between squares)", () => {
    const d = 1e-4;
    for (const a of [0, 0.5, 1]) {
      // A first step ends at full speed; a last one starts at it; each starts at 0 and ends at 1.
      expect((ease(1, true, false, a) - ease(1 - d, true, false, a)) / d).toBeCloseTo(1, 2);
      expect((ease(d, false, true, a) - ease(0, false, true, a)) / d).toBeCloseTo(1, 2);
      for (const [f, l] of [
        [true, true],
        [true, false],
        [false, true],
        [false, false],
      ] as const) {
        expect(ease(0, f, l, a)).toBe(0);
        expect(ease(1, f, l, a)).toBeCloseTo(1, 9);
      }
    }
  });
});
