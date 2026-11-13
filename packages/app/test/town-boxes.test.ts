import { describe, expect, it, vi } from "vitest";

// The street town (everyone's since Nov 13), as an admin's (every home): its boxes and its turning camera (Nov 5, round 3).
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true }));

const { N, newView, pickSquare, proj, rel, setHeading, setView, wrapI } = await import("../src/town/camera.ts");
const PLAN = (await import("../src/town/street-plan.json")).default;
const { PROPS } = await import("../src/town/world.ts");
const { geomOf, newPlan, planBox, streetBoxes, faceLight, wallShade, boxPoint } = await import("../src/town/boxes.ts");
const { Turn, quarterOf, screenStep } = await import("../src/town/turn.ts");
const { STREET_LOTS } = await import("../src/town/street.ts");
const { TOWN_FEEL } = await import("../src/town/feel.ts");

/**
 * The street town, round 3: the buildings as boxes and the turning camera (Nov 5; docs/decisions/2026-11-05-street-town-boxes.md). The
 * boxes' faces and their drawing order; the sides a neighbour at least as tall covers, never drawn; the turn's easing; taps and the
 * arrow keys through the heading. Round 4 (the rows, the chase camera, the town wrapping
 * east-west only): fronts face all four ways, so "before a front" is on its own street whichever way it faces; the heading on every
 * square (round 3's `camAt`) and the far Colosseum's 45 degrees went with the chase camera (town-rows.test.ts has their successors).
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
/** The heading that looks at a front facing `f` (a front facing south is seen looking north). */
const facingHeading = (f: string) => ({ S: 0, W: 90, N: 180, E: 270 })[f as "S"]!;
/** Where the camera stands to look at box `b` from its street: on the street before its front, facing it (`side`: that far to its left). */
function before(b: (typeof BOXES)[number], back = 4, side = 0): [number, number] {
  // (Out of the front is minus the way back; the camera's left, looking at it, is the front's left too: minus the way along it.)
  return [b.fx - b.bx * back - b.ux * side, b.fy - b.by * back - b.uy * side];
}

describe("the street town's buildings are boxes (Nov 5, round 3)", () => {
  it("every lot is a box facing its street: a home on its lot's front line (centred, or slid along its row to fit), a row's front where its row put it; the sheds and hedges too", () => {
    expect(LOTS).toHaveLength(STREET_LOTS.length);
    for (const b of LOTS) {
      const l = STREET_LOTS[b.lot]!;
      expect(b.facing, l.name).toBe(l.facing);
      // A row's look-alike or a skyline tower: its front line's middle where the rows put it (to the pixel: its width's rounding).
      if (l.at) {
        expect(b.fx, l.name).toBeCloseTo(l.at.x, 1);
        expect(b.fy, l.name).toBeCloseTo(l.at.y, 1);
      } else {
        // A home: its lot's middle along its front (plus its slide), its front edge plus the inset.
        expect(l.kind).toBe("home");
        expect([b.fx, b.fy]).toEqual([l.c0 + l.w / 2 - 0.5 + (l.shift ?? 0), l.r0 - 0.5 + b.box.inset]);
        expect(Math.abs(l.shift ?? 0), l.name).toBeLessThan(0.8);
      }
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
    // Seam Avenue's own fronts face the avenue: west east of it, east west of it; every way's front runs left to right as you face it.
    const ave = LOTS.filter((b) => STREET_LOTS[b.lot]!.street === "seam-ave");
    expect(ave.length).toBeGreaterThanOrEqual(4);
    for (const b of ave) expect([b.ux, b.uy]).toEqual(b.facing === "W" ? [0, -1] : [0, 1]);
    for (const b of LOTS) expect(b.ux * b.by - b.uy * b.bx, b.box.id).toBeCloseTo(1, 9);
  });

  it("every roof face's normal points out and up (none faces down), and its texture frame holds its corners", () => {
    for (const { box } of BOXES)
      for (const fg of geomOf(box).faces) {
        expect(fg.nz, `${box.id}`).toBeGreaterThan(-0.01);
        expect(Math.hypot(fg.nx, fg.ny, fg.nz)).toBeCloseTo(1, 6);
        for (let k = 0; k < fg.n; k++) {
          expect(fg.tx[k]!).toBeGreaterThanOrEqual(fg.tx0 - 1e-9);
          expect(fg.ty[k]!).toBeLessThanOrEqual(fg.ty0 + fg.th + 1e-9);
        }
      }
  });

  it("is drawn in the art's order: each part by its own depth (back, sides, roof, front), its roof's faces far to near", () => {
    let roofs = 0;
    for (const b of LOTS) {
      const v = view(facingHeading(b.facing));
      // (Off to the left a little, so a side shows.)
      const [x, y] = before(b, 5, 3);
      const p = newPlan(b.box);
      planBox(p, b, b.box, v, x, y, -Infinity);
      expect(p.front.on, b.box.id).toBe(true);
      if (p.back.on) expect(p.back.dz).toBeGreaterThan(p.roofDz);
      for (const w of [p.left, p.right]) if (w.on) expect(w.dz).toBeGreaterThan(p.roofDz);
      if (p.nOrder) {
        expect(p.roofDz).toBeGreaterThan(p.front.dz);
        roofs++;
      }
      for (let k = 1; k < p.nOrder; k++) expect(p.faces[p.order[k - 1]!]!.dz).toBeGreaterThanOrEqual(p.faces[p.order[k]!]!.dz);
    }
    // (The Colosseum's ring stretches, the north edge round: from a camera lower than their rim, their bowl is hidden behind their wall and left out.)
    expect(roofs).toBeGreaterThan(LOTS.filter((b) => b.kind !== "ring").length - 4);
  });

  it("a face turned away from the camera isn't drawn: a gable's far slope, a side wall facing away", () => {
    // (Timber's Lumber Lodge: a hipped roof, on Fountain Street's north row.)
    const b = LOTS.find((o) => o.home === "timber")!;
    const v = view(0);
    const p = newPlan(b.box);
    // From well off to the right: the right side shows, the left faces away.
    planBox(p, b, b.box, v, b.fx + 6, b.fy - 5, -Infinity);
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
    // (Round 4: the rows' party walls. Most fronts butt a neighbour at least as tall on one side or both.)
    expect(hidden.length).toBeGreaterThanOrEqual(50);
    // A front's side over a lower neighbour shows (a stepped roofline); a corner's turned end is never hidden.
    const looks = LOTS.filter((b) => STREET_LOTS[b.lot]!.look);
    const corners = looks.filter((b) => STREET_LOTS[b.lot]!.look!.corner);
    expect(corners.length).toBeGreaterThanOrEqual(16);
    for (const b of corners) expect(STREET_LOTS[b.lot]!.look!.corner === "L" ? b.hideL : b.hideR, b.box.id).toBe(false);
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
        return Math.hypot(((((q.x - a.x + N / 2) % N) + N) % N) - N / 2, q.y - a.y) < 0.45 + Math.abs(o.box.inset - b.box.inset);
      });
      expect(n, `${b.box.id}'s ${right ? "right" : "left"} side`).toBeTruthy();
      // And it's never drawn, from either side.
      for (const dx of [-6, 6]) {
        const p = newPlan(b.box);
        const [sx, sy] = before(b, 5, dx);
        planBox(p, b, b.box, view(facingHeading(b.facing)), sx, sy, -Infinity);
        expect(right ? p.right.on : p.left.on).toBe(false);
      }
    }
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

  it("a dome is one mesh's many faces, whole (no cut-down copy)", () => {
    for (const id of ["gingerbread", "hopper"]) expect(geomOf(LOTS.find((o) => o.home === id)!.box).faces.length).toBe(50);
  });

  it("leaves out what's nearer the camera than the cut (nothing between the camera and you), hedges aside", () => {
    // (A south-facing front on South Street's north row.)
    const b = LOTS.find((o) => o.facing === "S" && STREET_LOTS[o.lot]!.street === "south-st" && STREET_LOTS[o.lot]!.look)!;
    const p = newPlan(b.box);
    // The camera's focus 3 squares beyond the bakery's front, the cut 0.9 squares nearer than the focus: the front isn't drawn.
    planBox(p, b, b.box, view(0), b.fx, b.fy + 3, -TOWN_FEEL.streetNearCut);
    expect(p.front.on).toBe(false);
    planBox(p, b, b.box, view(0), b.fx, b.fy - 4, -TOWN_FEEL.streetNearCut);
    expect(p.front.on).toBe(true);
  });
});

describe("the street town's camera turns (Nov 5, round 3; round 4 aims it at the way you walk)", () => {
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

});
