import { describe, expect, it, vi } from "vitest";

// An admin's town is the street town (admin-town.ts STREET_TOWN): round 5's one fixed view, the strips, the look round, the back wall.
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true, STREET_TOWN: true }));

const { N, newView, pickSquare, proj, rel, setHeading, setView, forEachSquare } = await import("../src/town/camera.ts");
const { STRIPS, stripAt, stripOf, baseHeading, headingFacing } = await import("../src/town/strips.ts");
const { LookAround, Turn, nearestTurn, quarterOf, screenStep } = await import("../src/town/turn.ts");
const { STREET_HOMES, STREET_LOTS, STREET_PROPS, STREET_GROUND, STREET_COLISEUM } = await import("../src/town/street.ts");
const { HOMES, COLISEUM, PROPS, createTown, destFor, walkable, findPath } = await import("../src/town/world.ts");
const { streetBoxes, boxPoint } = await import("../src/town/boxes.ts");
const { STANDING, COLISEUM_FOOT, HOUSE_COLISEUM_STREET } = await import("../src/town/houses/coliseum.ts");
const { TOWN_FEEL } = await import("../src/town/feel.ts");

/**
 * The street town, round 5 (Nov 5; brief-town-fixed-cam.md, docs/decisions/2026-11-05-street-fixed-view.md): one fixed view (north),
 * but on a boss home's front strip, facing its front; the arrows are the normal view's screen directions; a drag looks round about your
 * pawn and the first step eases it back; the Colosseum against the back wall, with a grove beside and behind it that nobody walks or
 * sees past; no second Colosseum in view; the statues before it side by side, planted.
 */
const at = (c: number, r: number) => `${c},${r}`;
/** A phone's camera (390 x 844) at the default zoom, facing `heading`. */
function view(heading: number, W = 390, H = 844) {
  const v = newView();
  setView(v, W, H, 0, 1, 0, 0, { tall: TOWN_FEEL.camStreetTall, wide: TOWN_FEEL.camStreetWide });
  setHeading(v, heading);
  return v;
}

describe("one fixed view (round 5; Eric: \"There should be one view point no matter what, always\")", () => {
  it("faces north on every square but a boss home's front strip", () => {
    const strips = new Set(STRIPS.flatMap((s) => s.squares.map((q) => at(q.c, q.r))));
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        if (strips.has(at(c, r))) continue;
        expect(baseHeading(c, r), at(c, r)).toBe(0);
        expect(stripAt(c, r)).toBeNull();
      }
  });
  it("each home has a strip: the sidewalk squares right before its front, as wide as it, its door square among them", () => {
    expect(STRIPS).toHaveLength(16);
    for (const s of STRIPS) {
      const l = STREET_HOMES.find((h) => h.id === s.home)!;
      expect(s.squares.length, s.home).toBeGreaterThanOrEqual(2);
      expect(s.squares.length, s.home).toBeLessThanOrEqual(6);
      expect(s.squares, s.home).toContainEqual(l.door);
      for (const q of s.squares) {
        // (A south-facing front: the row before its lot; paving.)
        expect(q.r, s.home).toBe(l.r0 - 1);
        expect(STREET_GROUND[q.r * N + q.c], `${s.home} ${at(q.c, q.r)}`).toBe(1);
        expect(stripAt(q.c, q.r)).toBe(s);
      }
    }
  });
  it("on a strip the camera faces the home's front: every shipped home faces south, so that's north, head on; a home facing north would turn it round", () => {
    for (const s of STRIPS) {
      expect(s.facing).toBe("S");
      for (const q of s.squares) expect(baseHeading(q.c, q.r)).toBe(0);
    }
    expect([headingFacing("S"), headingFacing("W"), headingFacing("N"), headingFacing("E")]).toEqual([0, 90, 180, 270]);
    // A home on a street's south side (its front facing north): its strip is the row after its lot, and the camera faces south there.
    const l = STREET_HOMES[0]!;
    const turned = stripOf({ ...l, facing: "N", r0: l.r0 - 3 });
    for (const q of turned.squares) expect(q.r).toBe(l.r0);
    expect(turned.heading).toBe(180);
  });
  it("a tap on a strip square walks you there (the camera then faces the home); a step off turns it back to north, the short way, over about 0.5 s", () => {
    const t = createTown(0);
    t.nextBotAt = Infinity;
    for (const w of t.all) if (w !== t.you.walker) w.c = w.r = -100;
    for (const s of STRIPS) {
      const q = s.squares.find((x) => walkable(x.c, x.r))!;
      expect(destFor(t, t.you.walker, { kind: "square", c: q.c, r: q.r }), s.home).toEqual(q);
      expect(baseHeading(q.c, q.r)).toBe(s.heading);
      // One step back to the street: north again.
      expect(baseHeading(q.c, q.r - 1)).toBe(0);
    }
    // The turn: about half a second a quarter, the short way round (from 270 to 0 is a quarter, not three).
    const turn = new Turn(270);
    turn.aim(nearestTurn(0, turn.to), 1000);
    expect(turn.to).toBe(360);
    expect(turn.at(1000 + TOWN_FEEL.streetTurnMs)).toBe(360);
    expect(TOWN_FEEL.streetTurnMs).toBeGreaterThanOrEqual(400);
    expect(TOWN_FEEL.streetTurnMs).toBeLessThanOrEqual(600);
  });
  it("the arrows are screen directions: up north, down south, left west, right east (and through a strip's view where it turns)", () => {
    const o = { dc: 0, dr: 0 };
    const step = (dc: number, dr: number, h: number) => (screenStep(dc, dr, quarterOf(h), o), [o.dc, o.dr]);
    expect([step(0, 1, 0), step(0, -1, 0), step(-1, 0, 0), step(1, 0, 0)]).toEqual([[0, 1], [0, -1], [-1, 0], [1, 0]]);
    // Facing a north-facing home (south): up toward it, down back to the street.
    expect([step(0, 1, 180), step(0, -1, 180)]).toEqual([[0, -1], [0, 1]]);
  });
});

describe("looking round (round 5 addendum; Eric: \"hold your mouse, move it a little to the left … so you could see what the houses are to your left\")", () => {
  it("a drag turns the view: across the box's width about half a turn, left looks left; letting go keeps it", () => {
    const l = new LookAround();
    l.grab(0);
    l.drag(-390, 390);
    expect(l.at(10)).toBeCloseTo(-TOWN_FEEL.streetLookPerWidth, 6);
    expect(TOWN_FEEL.streetLookPerWidth).toBe(180);
    l.drag(195, 390);
    expect(l.at(20)).toBeCloseTo(90, 6);
    l.release();
    expect(l.at(5000)).toBeCloseTo(90, 6);
    expect(l.turned(5000)).toBe(true);
  });
  it("the first step eases it back over about 0.3 s, the short way round; not while you still drag", () => {
    const l = new LookAround();
    l.grab(0);
    l.drag(-390 * 1.5, 390); // three quarters round to the left
    l.back(100); // (still dragging: nothing)
    expect(l.at(100)).toBeCloseTo(-270, 6);
    l.release();
    l.back(1000);
    expect(TOWN_FEEL.streetLookBackMs).toBe(300);
    // (-270 is a quarter to the right: it eases from 90 to 0.)
    expect(l.at(1000)).toBeCloseTo(90, 6);
    expect(l.at(1000 + TOWN_FEEL.streetLookBackMs / 2)).toBeCloseTo(45, 6);
    expect(l.at(1000 + TOWN_FEEL.streetLookBackMs)).toBe(0);
    expect(l.turned(2000)).toBe(false);
  });
  it("the arrows stay the normal view's: they go through the normal heading, never the look round's", () => {
    // (Town.tsx turns a key's step by quarterOf(turn.to): the normal heading; a look round of any angle leaves it north.)
    const o = { dc: 0, dr: 0 };
    for (const lookDeg of [-170, -90, -30, 45, 120]) {
      screenStep(0, 1, quarterOf(0), o);
      expect([o.dc, o.dr], `looking ${lookDeg}`).toEqual([0, 1]);
    }
  });
  it("a tap while turned walks to the square under the finger, worked out from the turned view", () => {
    for (const h of [0, 37, 137, 222, 300]) {
      const v = view(h);
      const q = { dx: 0, dz: 0 };
      const p = { x: 0, y: 0, k: 0, depth: 0 };
      let checked = 0;
      for (const [c, r] of [[24, 20], [20, 22], [18, 18], [26, 17], [22, 23], [19, 20]] as const) {
        rel(v, 22, 20, c, r, q);
        if (!proj(v, q.dx, q.dz, 0, p) || p.y < 0 || p.y > v.H || p.x < 0 || p.x > v.W) continue;
        expect(pickSquare(v, 22, 20, p.x, p.y), `${c},${r} at ${h}`).toEqual({ c, r });
        checked++;
      }
      expect(checked, `squares in view at ${h}`).toBeGreaterThan(0);
    }
  });
});

describe("the Colosseum against the back wall (round 5; Eric: \"you can't go past it. It's all blocked off\")", () => {
  const C = STREET_COLISEUM;
  it("sits at the top centre, its top row the north edge", () => {
    expect(COLISEUM).toEqual(C);
    expect(C.r0 + C.size - 1).toBe(N - 1);
    expect(C.c0 + C.size / 2 - 0.5).toBeCloseTo(N / 2 - 0.5, 0);
  });
  it("nothing beside or behind it is walkable: you only come at it from the front; nothing past the north edge either", () => {
    for (let r = C.r0; r < N; r++)
      for (let c = C.c0 - 4; c < C.c0 + C.size + 4; c++) expect(walkable(c, r), at(c, r)).toBe(false);
    for (let c = 0; c < N; c++) expect(walkable(c, N)).toBe(false);
    // Nothing walkable on the back two rows, the whole way along.
    for (const r of [44, 45]) for (let c = 0; c < N; c++) expect(walkable(c, r), at(c, r)).toBe(false);
    // The plaza before it is: from the gate's square down to the town.
    expect(walkable(22, C.r0 - 1)).toBe(true);
    expect(findPath({ c: 22, r: C.r0 - 1 }, (c, r) => c === 22 && r === 17, walkable)).not.toBeNull();
    // And no path from the plaza reaches a square beside it (its grove, four columns either side).
    const beside = (c: number, r: number) => r >= C.r0 && ((c >= C.c0 - 4 && c < C.c0) || (c >= C.c0 + C.size && c < C.c0 + C.size + 4));
    expect(findPath({ c: 22, r: C.r0 - 1 }, beside, walkable)).toBeNull();
  });
  it("a wall with a closed gate either side of it on its front line, the back wall along the whole edge, the grove behind them", () => {
    const walls = STREET_LOTS.filter((l) => l.kind === "wall");
    const side = walls.filter((l) => l.r0 === C.r0);
    expect(side.map((l) => [l.c0, l.c0 + l.w - 1])).toEqual([[C.c0 - 4, C.c0 - 1], [C.c0 + C.size, C.c0 + C.size + 3]]);
    for (const l of side) expect(l.wall!.gate).not.toBeNull();
    // The back wall: every column but the Colosseum's, once.
    const back = walls.filter((l) => l.r0 === N - 1);
    const cols = back.flatMap((l) => Array.from({ length: l.w }, (_, k) => l.c0 + k)).sort((a, b) => a - b);
    expect(cols).toEqual(Array.from({ length: N }, (_, c) => c).filter((c) => c < C.c0 || c >= C.c0 + C.size));
    for (const l of back) expect(l.at!.y).toBeCloseTo(N - 0.5, 9);
    // Trees behind the walls (treetops over them), no skyline tower on the back rows.
    expect(STREET_PROPS.filter((p) => p.kind === "tree" && p.y >= C.r0 && (p.x < C.c0 || p.x >= C.c0 + C.size)).length).toBeGreaterThanOrEqual(30);
    expect(STREET_LOTS.filter((l) => l.kind === "tall" && l.r0 >= 40)).toEqual([]);
  });
  it("nothing stands north of the back wall: no building's foot and no prop past the edge", () => {
    const pt = { x: 0, y: 0 };
    for (const b of streetBoxes(PROPS)) {
      boxPoint(b, b.box, b.box.front.w / 2, 0, pt);
      expect(pt.y, b.box.id).toBeLessThanOrEqual(N - 0.5 + 1e-9);
    }
    for (const p of STREET_PROPS) expect(p.y, `${p.kind} ${p.x},${p.y}`).toBeLessThanOrEqual(N - 1);
  });
  it("no second Colosseum (nor any square twice) in view: the wrap never shows the town beside itself, at every zoom step", () => {
    for (const steps of TOWN_FEEL.streetZoomSteps)
      for (const [W, H] of [[390, 844], [1280, 800]] as const)
        for (const camX of [0, 6, 13, 22, 31, 40, 45])
          for (const camY of [33, 26, 20, 5]) {
            const v = newView();
            setView(v, W, H, 0, 1, 0, 0, steps);
            const seen = new Set<string>();
            forEachSquare(v, camX, camY, false, (c, r) => {
              if (c < 0 || r < 0) return;
              const k = at(c, r);
              expect(seen.has(k), `${k} twice from ${camX},${camY}`).toBe(false);
              seen.add(k);
            });
          }
    // (The Colosseum is one thing in the world: drawn where the shortest way round puts it, once.)
    expect(HOMES.length).toBe(16);
  });
  it("the statues and chess pieces before it stand side by side on its front line, planted, never overlapping; no pawn floats at its back", () => {
    const s = [...STANDING].sort((a, b) => a.x0 - b.x0);
    expect(s.length).toBe(8);
    for (let i = 1; i < s.length; i++) expect(s[i]!.x0, `${s[i - 1]!.name} | ${s[i]!.name}`).toBeGreaterThanOrEqual(s[i - 1]!.x1);
    for (const x of s) {
      expect(x.foot, x.name).toBeGreaterThanOrEqual(COLISEUM_FOOT);
      expect(x.foot - COLISEUM_FOOT, x.name).toBeLessThanOrEqual(6);
    }
    const parts = new Set(HOUSE_COLISEUM_STREET.anims.idle!.frames[0]!.layers.map((l) => l.part));
    for (const p of ["pawnL", "pawnR", "plinthPL", "plinthPR"]) expect(parts.has(p), p).toBe(false);
  });
});
