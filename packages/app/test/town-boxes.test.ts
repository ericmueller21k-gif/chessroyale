import { describe, expect, it, vi } from "vitest";

// An admin's town is the street town (admin-town.ts STREET_TOWN): its boxes and its turning camera (Nov 5, round 3).
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true, STREET_TOWN: true }));

const { N, newView, pickSquare, proj, rel, setHeading, setView, wrapI } = await import("../src/town/camera.ts");
const PLAN = (await import("../src/town/street-plan.json")).default;
const { PROPS } = await import("../src/town/world.ts");
const { geomOf, newPlan, planBox, streetBoxes, faceLight, wallShade, boxPoint } = await import("../src/town/boxes.ts");
const { Turn, camAt, farColosseumShows, quarterOf, screenStep } = await import("../src/town/turn.ts");
const { TOWN_FEEL } = await import("../src/town/feel.ts");

/**
 * The street town, round 3: the buildings as boxes and the turning camera (Nov 5; docs/decisions/2026-11-05-street-town-boxes.md). The
 * boxes' faces and their drawing order; the sides a neighbour at least as tall covers, never drawn; the heading on every square and its
 * easing; taps and the arrow keys through the heading; the Colosseum's far drawing only within 45 degrees of north; each building's
 * draws within the art's budget.
 */
const BOXES = streetBoxes(PROPS);
const LOTS = BOXES.filter((b) => b.kind !== "shed" && b.kind !== "hedge");

/** A camera on a phone's box (390 x 844), zoomed in, facing `heading`. */
function view(heading: number, W = 390, H = 844) {
  const v = newView();
  setView(v, W, H, 0);
  setHeading(v, heading);
  return v;
}
/** Where the camera stands to look at box `b` from its street: on the street before its front, facing it. */
function before(b: (typeof BOXES)[number], back = 4): [number, number] {
  return b.facing === "S" ? [b.fx, b.fy - back] : [b.fx - back, b.fy];
}

/** The art's own camAt (scripts/boss-art/town-street/plan.ts on claude/boss-art 11a4d903), word for word but for its names. */
function artCamAt(c: number, r: number): 0 | 90 {
  const wrap = (v: number) => ((v % N) + N) % N;
  const cc = wrap(Math.round(c));
  if (!(cc >= 43 || cc <= 2)) return 0;
  const rr = wrap(Math.round(r));
  const crossing = [[43, 47], [12, 17], [21, 25], [29, 34]].some(([a, b]) => (rr >= a! && rr <= b!) || (rr + N >= a! && rr + N <= b!));
  return crossing ? 0 : 90;
}

describe("the street town's buildings are boxes (Nov 5, round 3)", () => {
  it("every lot is a box: its front on its front line, centred on its lot, facing its street; the sheds and hedges too", () => {
    expect(LOTS).toHaveLength(PLAN.lots.length);
    for (const b of LOTS) {
      const l = PLAN.lots[b.lot]!;
      expect(b.facing, l.name).toBe(l.facing);
      // Its front line's middle: the lot's middle along its front, its front edge plus the inset.
      if (l.facing === "S") expect([b.fx, b.fy]).toEqual([l.c0 + l.w / 2 - 0.5, l.r0 - 0.5 + b.box.inset]);
      else expect([b.fx, b.fy]).toEqual([l.c0 - 0.5 + b.box.inset, l.r0 + l.w / 2 - 0.5]);
    }
    expect(BOXES.filter((b) => b.kind === "shed")).toHaveLength(PROPS.filter((p) => p.kind === "shed").length);
    // The hedges in runs along their lines (up to five squares a run, each square once), each drawn by its first square.
    const runs = BOXES.filter((b) => b.kind === "hedge");
    const squares = runs.flatMap((b) => b.props).sort((a, b) => a - b);
    expect(squares).toEqual(PROPS.flatMap((p, i) => (p.kind === "hedge" ? [i] : [])));
    for (const b of runs) {
      expect(b.props[0]).toBe(b.prop);
      expect(b.props.length).toBeLessThanOrEqual(5);
      expect(b.box.front.w).toBe(37 * b.props.length);
    }
    // Seam Avenue's own fronts face west (the camera faces east there), as planned.
    expect(LOTS.filter((b) => PLAN.lots[b.lot]!.street === "seam-ave").every((b) => b.facing === "W" && b.ux === 0 && b.uy === -1)).toBe(true);
  });

  it("every roof face's normal points out and up (none faces down), and its texture frame holds its corners", () => {
    for (const b of BOXES)
      for (const box of [b.box, b.low]) {
        for (const fg of geomOf(box).faces) {
          expect(fg.nz, `${box.id}`).toBeGreaterThan(-0.01);
          expect(Math.hypot(fg.nx, fg.ny, fg.nz)).toBeCloseTo(1, 6);
          for (let k = 0; k < fg.n; k++) {
            expect(fg.tx[k]!).toBeGreaterThanOrEqual(fg.tx0 - 1e-9);
            expect(fg.ty[k]!).toBeLessThanOrEqual(fg.ty0 + fg.th + 1e-9);
          }
        }
      }
  });

  it("is drawn in the art's order: each part by its own depth (back, sides, roof, front), its roof's faces far to near", () => {
    let roofs = 0;
    for (const b of LOTS) {
      const v = view(b.facing === "S" ? 0 : 90);
      const [cx, cy] = before(b, 5);
      // (Off to the left a little, so a side shows.)
      const x = b.facing === "S" ? cx - 3 : cx;
      const y = b.facing === "S" ? cy : cy + 3;
      const p = newPlan(b.box);
      planBox(p, b, b.box, v, x, y, true, -Infinity);
      expect(p.front.on, b.box.id).toBe(true);
      if (p.back.on) expect(p.back.dz).toBeGreaterThan(p.roofDz);
      for (const w of [p.left, p.right]) if (w.on) expect(w.dz).toBeGreaterThan(p.roofDz);
      if (p.nOrder) {
        expect(p.roofDz).toBeGreaterThan(p.front.dz);
        roofs++;
      }
      for (let k = 1; k < p.nOrder; k++) expect(p.faces[p.order[k - 1]!]!.dz).toBeGreaterThanOrEqual(p.faces[p.order[k]!]!.dz);
    }
    expect(roofs).toBeGreaterThan(LOTS.length - 4);
  });

  it("a face turned away from the camera isn't drawn: a gable's far slope, a side wall facing away", () => {
    const b = LOTS.find((o) => o.box.id.startsWith("bakery"))!;
    const v = view(0);
    const p = newPlan(b.box);
    // From well off to the right: the right side shows, the left faces away.
    planBox(p, b, b.box, v, b.fx + 6, b.fy - 5, true, -Infinity);
    expect(p.left.on).toBe(false);
    expect(p.right.on || b.hideR).toBe(true);
    const g = geomOf(b.box);
    // Each drawn face's outward normal points toward the camera's side of it.
    for (let k = 0; k < p.nOrder; k++) {
      const fg = g.faces[p.order[k]!]!;
      expect(fg.nz > 0.05 || fg.nx > -0.05).toBe(true);
    }
  });

  it("skips a side a neighbour at least as tall covers: never drawn; a row's end and a taller building's side over a lower one are", () => {
    const hidden = LOTS.filter((b) => b.hideL || b.hideR);
    // (Seam Street's bakery's right side behind the taller townhouse beside it; the shop's left behind the skinny houses; ...)
    expect(hidden.length).toBeGreaterThanOrEqual(4);
    const seamSt = (id: string) => LOTS.find((b) => PLAN.lots[b.lot]!.street === "seam-st" && b.box.id.startsWith(id))!;
    expect(seamSt("bakery").hideR).toBe(true);
    expect(seamSt("shop").hideL).toBe(true);
    expect(seamSt("townhouse").hideL, "the townhouse's left, over the lower bakery").toBe(false);
    const eave = (s: { ch: { h: number } } | null) => (s ? s.ch.h - 1 : 0);
    for (const b of hidden) {
      // Its neighbour on that side: the same street line, its facing wall within a third of a square, at least as tall.
      const right = b.hideR;
      const mine = right ? b.box.right : b.box.left;
      const a = { x: 0, y: 0 };
      boxPoint(b, b.box, right ? b.box.body.x1 : b.box.body.x0, 0, a);
      const n = LOTS.find((o) => {
        if (o === b || o.facing !== b.facing) return false;
        const theirs = right ? o.box.left : o.box.right;
        if (!theirs || eave(theirs) < eave(mine)) return false;
        const q = { x: 0, y: 0 };
        boxPoint(o, o.box, right ? o.box.body.x0 : o.box.body.x1, 0, q);
        return Math.hypot(((q.x - a.x + N / 2) % N) - N / 2, q.y - a.y) < 0.45 + Math.abs(o.box.inset - b.box.inset);
      });
      expect(n, `${b.box.id}'s ${right ? "right" : "left"} side`).toBeTruthy();
      // And it's never drawn, from either side.
      for (const dx of [-6, 6]) {
        const p = newPlan(b.box);
        const [x, y] = before(b, 5);
        planBox(p, b, b.box, view(b.facing === "S" ? 0 : 90), b.facing === "S" ? x + dx : x, b.facing === "S" ? y : y - dx, true, -Infinity);
        expect(right ? p.right.on : p.left.on).toBe(false);
      }
    }
    // Seam Street's bakery, on the avenue's corner: its left side (the avenue's) is drawn.
    const bakery = LOTS.find((b) => PLAN.lots[b.lot]!.side && b.box.id.startsWith("bakery"))!;
    expect(bakery.hideL).toBe(false);
  });

  it("lights faces as the art: from the top left (a slope facing left lighter than one facing right), sides 6% left and 30% right, a front none", () => {
    // Facing north: a slope facing west (up and left) is lighter than one facing east.
    expect(faceLight(-0.7, 0, 0.7, 1, 0)).toBeGreaterThan(faceLight(0.7, 0, 0.7, 1, 0));
    expect(faceLight(0, 0, 1, 1, 0)).toBeCloseTo(0.74 + 0.36 * 0.79, 6);
    for (const [nx, ny, nz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0.3, -0.3, 0.9]] as const) {
      expect(faceLight(nx, ny, nz, 1, 0)).toBeGreaterThanOrEqual(0.55);
      expect(faceLight(nx, ny, nz, 1, 0)).toBeLessThanOrEqual(1.12);
    }
    expect(wallShade(-1, 0, 1, 0)).toBeCloseTo(0.06, 6);
    expect(wallShade(1, 0, 1, 0)).toBeCloseTo(0.3, 6);
    expect(wallShade(0, -1, 1, 0)).toBeCloseTo(0, 6);
    // Facing east, a wall facing west faces the camera (no shade), one facing south is turned right (30%).
    expect(wallShade(-1, 0, 0, 1)).toBeCloseTo(0, 6);
    expect(wallShade(0, -1, 0, 1)).toBeCloseTo(0.3, 6);
  });

  it("draws each building in about 12 to 20 draws (the art's budget, the 2D fallback's count: strips and faces), twice that mid-turn", () => {
    const counts: number[] = [];
    for (const b of LOTS) {
      const h = b.facing === "S" ? 0 : 90;
      const [x, y] = before(b, 4);
      for (const [dx, heading, limit] of [[0, h, 20], [-4, h, 20], [4, h, 20], [-3, 45, 40]] as const) {
        const p = newPlan(b.low);
        planBox(p, b, b.low, view(heading), b.facing === "S" ? x + dx : x, b.facing === "S" ? y : y - dx, false, -Infinity);
        expect(p.draws, `${b.box.id} from ${dx} at ${heading}`).toBeLessThanOrEqual(limit);
        if (heading === h && dx === 0) counts.push(p.draws);
      }
    }
    // (Seen straight on, most are a front and a few roof faces.)
    expect(Math.max(...counts)).toBeLessThanOrEqual(20);
  });

  it("a dome is one mesh's many faces in WebGL and cut down (6 x 3) on the 2D fallback", () => {
    for (const id of ["gingerbread", "hopper"]) {
      const b = LOTS.find((o) => o.home === id)!;
      expect(geomOf(b.box).faces.length).toBe(50);
      expect(geomOf(b.low).faces.length).toBe(18);
    }
    // (And Boingo's barrel vault: eight faces round, four on the 2D fallback.)
    const clown = LOTS.find((o) => o.home === "clown")!;
    expect(geomOf(clown.box).faces.length - geomOf(clown.low).faces.length).toBe(4);
  });

  it("leaves out what's nearer the camera than the cut (nothing between the camera and you), hedges aside", () => {
    const b = LOTS.find((o) => o.box.id.startsWith("bakery"))!;
    const p = newPlan(b.box);
    // The camera's focus 3 squares beyond the bakery's front, the cut 0.9 squares nearer than the focus: the front isn't drawn.
    planBox(p, b, b.box, view(0), b.fx, b.fy + 3, true, -TOWN_FEEL.streetNearCut);
    expect(p.front.on).toBe(false);
    planBox(p, b, b.box, view(0), b.fx, b.fy - 4, true, -TOWN_FEEL.streetNearCut);
    expect(p.front.on).toBe(true);
  });
});

describe("the street town's camera turns (Nov 5, round 3)", () => {
  it("faces north everywhere but Seam Avenue, east there, north again on its four crossings: as the art's plan, every square", () => {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) expect(camAt(c, r), `${c},${r}`).toBe(artCamAt(c, r));
    expect(camAt(45, 8)).toBe(90);
    expect(camAt(45, 14)).toBe(0);
    expect(camAt(0, 19)).toBe(90);
    expect(camAt(22, 11)).toBe(0);
    // Walking east along Fountain Street onto the avenue and up it: north, north on its crossing, then east.
    expect([[40, 14], [44, 14], [45, 17], [45, 18]].map(([c, r]) => camAt(c!, r!))).toEqual([0, 0, 0, 90]);
  });

  it("eases over about half a second a quarter turn, smoothly, and turns back from wherever it is", () => {
    const t = new Turn(0);
    t.aim(90, 1000);
    expect(t.at(1000)).toBe(0);
    expect(t.at(1000 + TOWN_FEEL.streetTurnMs / 2)).toBeCloseTo(45, 6);
    expect(t.at(1000 + TOWN_FEEL.streetTurnMs)).toBe(90);
    expect(t.turning(1100)).toBe(true);
    expect(t.turning(2000)).toBe(false);
    // Smooth: slow at the ends, quickest in the middle.
    const step = (a: number) => t.at(1000 + a + 10) - t.at(1000 + a);
    expect(step(0)).toBeLessThan(step(240));
    expect(step(490)).toBeLessThan(step(240));
    // A turn back caught midway: from where it was, in the share of the time.
    t.aim(0, 1000 + TOWN_FEEL.streetTurnMs / 2);
    expect(t.at(1000 + TOWN_FEEL.streetTurnMs / 2)).toBeCloseTo(45, 6);
    expect(t.ms).toBeCloseTo(TOWN_FEEL.streetTurnMs / 2, 6);
    expect(t.at(1000 + TOWN_FEEL.streetTurnMs)).toBe(0);
    expect(TOWN_FEEL.streetTurnMs).toBeGreaterThanOrEqual(300);
    expect(TOWN_FEEL.streetTurnMs).toBeLessThanOrEqual(800);
  });

  it("the arrow keys go through the heading: up is always up the screen (north facing north, east facing east)", () => {
    const o = { dc: 0, dr: 0 };
    const step = (dc: number, dr: number, h: number) => (screenStep(dc, dr, quarterOf(h), o), [o.dc, o.dr]);
    expect(step(0, 1, 0)).toEqual([0, 1]);
    expect(step(1, 0, 0)).toEqual([1, 0]);
    expect(step(0, 1, 90)).toEqual([1, 0]);
    expect(step(1, 0, 90)).toEqual([0, -1]);
    expect(step(0, -1, 90)).toEqual([-1, 0]);
    expect(step(-1, 0, 90)).toEqual([0, 1]);
    // Mid-turn: the quarter it faces most nearly.
    expect(step(0, 1, 40)).toEqual([0, 1]);
    expect(step(0, 1, 50)).toEqual([1, 0]);
    // And up the screen is where the camera looks: the square ahead projects higher on screen.
    for (const h of [0, 90]) {
      const v = view(h);
      const a = { x: 0, y: 0, k: 0, depth: 0 };
      const b = { x: 0, y: 0, k: 0, depth: 0 };
      const q = { dx: 0, dz: 0 };
      step(0, 1, h);
      rel(v, 45, 20, 45, 20, q);
      proj(v, q.dx, q.dz, 0, a);
      rel(v, 45, 20, 45 + o.dc, 20 + o.dr, q);
      proj(v, q.dx, q.dz, 0, b);
      expect(b.y).toBeLessThan(a.y);
      expect(Math.abs(b.x - a.x)).toBeLessThan(1e-6);
    }
  });

  it("a tap goes through the heading: the square under it is the one drawn there, facing north, east and midway", () => {
    for (const h of [0, 45, 90]) {
      const v = view(h);
      const q = { dx: 0, dz: 0 };
      const p = { x: 0, y: 0, k: 0, depth: 0 };
      for (const [c, r] of [[45, 22], [46, 22], [45, 24], [43, 21], [1, 19]] as const) {
        rel(v, 45, 20, c, r, q);
        if (!proj(v, q.dx, q.dz, 0, p) || p.y < 0 || p.y > v.H || p.x < 0 || p.x > v.W) continue;
        expect(pickSquare(v, 45, 20, p.x, p.y), `${c},${r} at ${h}`).toEqual({ c: wrapI(c), r: wrapI(r) });
      }
    }
  });

  it("the Colosseum's far drawing shows only within 45 degrees of north", () => {
    expect(farColosseumShows(0)).toBe(true);
    expect(farColosseumShows(45)).toBe(true);
    expect(farColosseumShows(46)).toBe(false);
    expect(farColosseumShows(90)).toBe(false);
    expect(farColosseumShows(-30)).toBe(true);
    expect(farColosseumShows(330)).toBe(true);
  });
});
