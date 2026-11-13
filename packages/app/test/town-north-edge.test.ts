import { describe, expect, it, vi } from "vitest";

// The street town (everyone's since Nov 13), as an admin's (every home): the north edge round's one back line and its Colosseum as a solid.
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true }));

const { N, newView, setHeading, setView } = await import("../src/town/camera.ts");
const PLAN = (await import("../src/town/street-plan.json")).default;
const { STREET_GROUND, STREET_GROUND_KEY, STREET_LOTS, STREET_PROPS, STREET_STREETS } = await import("../src/town/street.ts");
const { HOMES, PROPS, START, findPath, stepsFrom, walkable } = await import("../src/town/world.ts");
const { boxPoint, newPlan, planBox, pxOf, streetBoxes } = await import("../src/town/boxes.ts");
const { STRIPS } = await import("../src/town/strips.ts");
const { ROW_MIN_W, ROW_SIDES, layRow } = await import("../src/town/rows.ts");
const { homesOn } = await import("../src/town/street.ts");
const { OVAL, RING, RING_M } = await import("../src/town/houses/coliseum-ring.ts");
const { TOWN_FEEL } = await import("../src/town/feel.ts");

/**
 * The street town's north edge (Nov 5; brief-street-north-edge.md, docs/decisions/2026-11-05-street-north-edge.md; Eric: "There's
 * nothing behind it. It's at the end of the map … it's a solid back wall … the most back thing is the Colosseum, with gates running along
 * and then exits out of the gates into the town"): one back line across the whole town, nothing walkable or standing past it but the
 * Colosseum (and treetops); Upper Street and its four homes moved south (Meadow Street); the plaza walled, with gateways out onto
 * Colosseum Row; the Colosseum a solid ring of wall faces the box renderer draws from any heading; Moo's and Ginger's homes 1.3x.
 */
const LINE = PLAN.coliseum.line;
const at = (c: number, r: number) => `${c},${r}`;
const BOXES = streetBoxes(PROPS);
const pt = { x: 0, y: 0 };

describe("one back line across the whole town", () => {
  it("nothing walkable past it, anywhere along it", () => {
    for (let r = Math.ceil(LINE); r < N; r++) for (let c = 0; c < N; c++) expect(walkable(c, r), at(c, r)).toBe(false);
    // (And from the start, nothing reached is past it.)
    const d = stepsFrom(START);
    for (let r = Math.ceil(LINE); r < N; r++) for (let c = 0; c < N; c++) expect(d[r * N + c], at(c, r)).toBeLessThan(0);
  });
  it("nothing drawn past it but the Colosseum (its ring, the arena's floor under its oval) and treetops: no building, no prop, no paving", () => {
    for (const b of BOXES) {
      if (b.kind === "ring") continue;
      // Every box's front, both ends, on or before the line (the back wall's on it).
      for (const u of [0, b.box.front.w]) {
        boxPoint(b, b.box, u, 0, pt);
        expect(pt.y, b.box.id).toBeLessThanOrEqual(LINE + 1e-9);
      }
    }
    for (const p of STREET_PROPS) if (p.kind !== "tree") expect(p.y, `${p.kind} ${p.x},${p.y}`).toBeLessThanOrEqual(LINE);
    // The ground past it: the meadow, and the arena's board under the oval only.
    const { g: meadow, A: arena } = STREET_GROUND_KEY;
    for (let r = Math.ceil(LINE); r < N; r++)
      for (let c = 0; c < N; c++) {
        const inOval = ((c - OVAL.cx) / OVAL.a) ** 2 + ((r - OVAL.cy) / OVAL.b) ** 2 <= 1;
        expect(STREET_GROUND[r * N + c], at(c, r)).toBe(inOval ? arena : meadow);
      }
    // Its ring stands on the line or past it (its front's southmost point a hair before it, on the plinths' row).
    // (Its front proud of the line by under two squares, the back wall's centerpiece, Eric, Nov 6.)
    for (const s of RING) expect(Math.min(s.y0, s.my), `ring ${s.k}`).toBeGreaterThan(LINE - 2);
  });
  it("no street or lot past it: the back wall stands on it, every other lot and every street before it", () => {
    for (const s of STREET_STREETS) expect(s.r1, s.id).toBeLessThan(LINE);
    for (const l of STREET_LOTS) {
      if (l.kind === "ring" || l.kind === "portal") continue;
      if (l.kind === "wall" && l.r0 === Math.ceil(LINE)) {
        // (The back wall: its front on the line, half a square deep.)
        expect(l.at!.y, l.name).toBeCloseTo(LINE, 9);
        expect(l.wall!.depth, l.name).toBeLessThanOrEqual(0.5);
        continue;
      }
      expect(l.r0 + l.d - 1, `${l.kind} ${l.name}`).toBeLessThan(LINE);
    }
    expect(STREET_STREETS.map((s) => s.id)).not.toContain("upper-st");
  });
});

describe("Upper Street's homes moved south: Meadow Street", () => {
  it("every boss home is in the town, each with its door, strip and rest square, reached from the start", () => {
    expect(HOMES).toHaveLength(18);
    const d = stepsFrom(START);
    for (const h of HOMES) {
      const strip = STRIPS.find((s) => s.home === (h.id === "dash" ? "blitz" : h.id));
      expect(strip, h.id).toBeDefined();
      expect(strip!.squares, `${h.id}: its door on its strip`).toContainEqual(h.door);
      expect(walkable(h.rest.c, h.rest.r), `${h.id}'s rest square`).toBe(true);
      expect(d[h.door.r * N + h.door.c], `${h.id}'s door reached`).toBeGreaterThan(0);
      expect(d[h.rest.r * N + h.rest.c], `${h.id}'s rest square reached`).toBeGreaterThan(0);
    }
  });
  it("Hopper's, Wrangler's, Moo's and Hollow's homes stand on Meadow Street's north side, south of South Street, fronts facing it", () => {
    const meadow = STREET_STREETS.find((s) => s.id === "meadow-st")!;
    const south = STREET_STREETS.find((s) => s.id === "south-st")!;
    expect(meadow.r1).toBeLessThan(south.r0);
    expect([meadow.c0, meadow.c1]).toEqual([0, N - 1]);
    for (const id of ["hopper", "pig", "moo", "hollow"]) {
      const l = STREET_LOTS.find((o) => o.kind === "home" && o.id === id)!;
      expect(l.street, id).toBe("meadow-st");
      expect(l.facing, id).toBe("S");
      expect(l.r0, id).toBe(meadow.r1 + 2);
      expect(l.door!.r, id).toBe(meadow.r1 + 1);
    }
  });
  it("the start is on the promenade in the park, and the park still the town's middle", () => {
    expect(START).toEqual({ c: 22, r: 25 });
    expect(PLAN.park.r1 - PLAN.park.d + 1).toBeLessThanOrEqual(START.r);
    expect(PLAN.park.r1).toBeGreaterThan(START.r);
  });
});

describe("the plaza and the gates (Eric, Nov 6: no wall in front of the Colosseum; the gates in the back wall either side of it)", () => {
  it("the plaza is open to Colosseum Row across its width, and walked from it to the gates and the portal", () => {
    for (let c = 13; c <= 32; c++) expect(walkable(c, 39), at(c, 39)).toBe(true);
    for (const [c, r] of [[14, 43], [31, 43], [22, 41]] as const) {
      expect(walkable(c, r), at(c, r)).toBe(true);
      expect(findPath({ c: 22, r: 36 }, (x, y) => x === c && y === r, walkable), at(c, r)).not.toBeNull();
    }
  });
  it("the gates stand in the back wall either side of the Colosseum, past the statues: you walk up to one, never through it", () => {
    const gates = STREET_LOTS.filter((l) => l.kind === "wall" && l.wall!.arches?.length);
    expect(gates.map((l) => l.name)).toEqual(["The west gate", "The east gate"]);
    const statues = PROPS.filter((p) => p.kind === "statue").map((p) => p.x).sort((a, b) => a - b);
    expect(gates[0]!.c0 + gates[0]!.w - 0.5).toBeLessThanOrEqual(statues[0]!);
    expect(gates[1]!.c0 - 0.5).toBeGreaterThanOrEqual(statues[1]!);
    for (const l of gates) {
      expect(l.at!.y, l.name).toBeCloseTo(LINE, 9);
      for (let c = l.c0; c < l.c0 + l.w; c++) {
        expect(walkable(c, Math.floor(LINE)), `before ${l.name}`).toBe(true);
        expect(walkable(c, Math.ceil(LINE)), `through ${l.name}`).toBe(false);
      }
    }
  });
  it("Boingo's, Tiger's, Big Boy's and Dash's homes beside the plaza keep their backs on the back wall", () => {
    // (The art's ids: Boingo's is "clown", Dash's "blitz".)
    for (const id of ["clown", "tiger", "bigboy", "blitz"]) {
      const l = STREET_LOTS.find((o) => o.kind === "home" && o.id === id)!;
      expect(l.street, id).toBe("colosseum-row");
      expect(l.r0 + l.d - 0.5, id).toBe(LINE);
    }
  });
});

describe("the Colosseum as a solid (Eric: \"we probably have to actually draw the Colosseum out\")", () => {
  const ring = BOXES.filter((b) => b.kind === "ring");
  const portal = BOXES.find((b) => b.kind === "portal")!;
  it("a closed ring of equal stretches round its oval, each facing out, and its portal on the plaza, the Colosseum's own box", () => {
    expect(ring).toHaveLength(RING_M);
    for (let k = 0; k < RING_M; k++) {
      const s = RING[k]!;
      const n = RING[(k + 1) % RING_M]!;
      // Each stretch's right end is the next one's left end.
      expect(s.x0 + s.ux * (Math.hypot(n.x0 - s.x0, n.y0 - s.y0) || 0)).toBeCloseTo(n.x0, 6);
      // Its front faces out: away from the oval's middle.
      expect((s.mx - OVAL.cx) * s.uy - (s.my - OVAL.cy) * s.ux, `ring ${k}`).toBeGreaterThan(0);
    }
    expect(portal.home).toBe("coliseum");
    expect(portal.facing).toBe("S");
  });
  it("is drawn as faces from 8 headings all round: every stretch facing the camera drawn, side by side with no gap, at different depths", () => {
    const v = newView();
    for (let h = 0; h < 360; h += 45) {
      setView(v, 1280, 800, 0, 1, 0, 0, TOWN_FEEL.streetZoomSteps[2]!);
      setHeading(v, h);
      const t = (h * Math.PI) / 180;
      // The camera's focus 13 squares out from the oval's middle, looking at it.
      const camX = OVAL.cx - 13 * Math.sin(t);
      const camY = OVAL.cy - 13 * Math.cos(t);
      const drawn: { x0: number; x1: number; dz: number }[] = [];
      for (const b of ring) {
        const p = newPlan(b.box);
        planBox(p, b, b.box, v, camX, camY, -Infinity);
        const s = RING[STREET_LOTS[b.lot]!.ring!]!;
        // (Out of its front, toward the camera's eye: facing it squarely enough.)
        const ox = s.uy;
        const oy = -s.ux;
        const facing = ox * (camX - s.mx) + oy * (camY - s.my) > 0.3 * Math.hypot(camX - s.mx, camY - s.my);
        if (facing) expect(p.front.on, `ring ${s.k} from heading ${h}`).toBe(true);
        if (p.front.on) drawn.push({ x0: Math.min(p.front.x0, p.front.x1), x1: Math.max(p.front.x0, p.front.x1), dz: p.front.dz });
        // And its roof: the rim and the seats, faces of their own.
        expect(p.faces.length, `ring ${s.k}`).toBe(3);
      }
      expect(drawn.length, `stretches drawn from ${h}`).toBeGreaterThanOrEqual(4);
      drawn.sort((a, b) => a.x0 - b.x0);
      let reach = drawn[0]!.x1;
      for (const d of drawn.slice(1)) {
        expect(d.x0, `no gap in its wall from ${h}`).toBeLessThanOrEqual(reach + 1.5);
        reach = Math.max(reach, d.x1);
      }
      // A solid, not a card: its stretches at different depths.
      const dz = drawn.map((d) => d.dz);
      expect(Math.max(...dz) - Math.min(...dz), `depths from ${h}`).toBeGreaterThan(2);
    }
  });
  it("from the plaza, looking at it any way it shows, it's the ring and the portal that are drawn", () => {
    const v = newView();
    for (const h of [-45, 0, 45]) {
      setView(v, 390, 844, 0, 1, 0, 0, TOWN_FEEL.streetZoomSteps[1]!);
      setHeading(v, h);
      let fronts = 0;
      for (const b of [...ring, portal]) {
        const p = newPlan(b.box);
        planBox(p, b, b.box, v, 22, 40.5, -Infinity);
        if (p.front.on) fronts++;
      }
      expect(fronts, `from heading ${h}`).toBeGreaterThanOrEqual(2);
    }
  });
  it("about twice as tall as round 5's wall (150 px): it looms", () => {
    for (const b of ring) expect(b.box.front.foot[1] / pxOf(b.box), b.box.id).toBeGreaterThan((2 * 150 * 0.85) / 37);
  });
});

describe("boss homes are never neighbors, and no look-alike is a sliver (Eric, Nov 6: \"Nothing should be that close … not two bosses\")", () => {
  it(`every row: a whole look-alike (${ROW_MIN_W} square or more) between any two boss homes, and every look-alike at least ${ROW_MIN_W} wide`, () => {
    let homes = 0;
    for (const side of ROW_SIDES) {
      const placed = layRow(side, homesOn(side));
      placed.forEach((p, i) => {
        if (p.kind === "look") expect(p.s1 - p.s0, `${side.id}: front ${i} ${p.s0.toFixed(2)}..${p.s1.toFixed(2)}`).toBeGreaterThanOrEqual(ROW_MIN_W - 1e-9);
        else {
          homes++;
          expect(placed[i + 1]?.kind, `${side.id}: ${p.home} has a boss home beside it`).not.toBe("home");
        }
      });
    }
    expect(homes).toBe(18);
    expect(ROW_MIN_W).toBe(1);
  });
});

describe("Moo's paddock and Ginger's dome up in their rows (round 6, ported; they \"look sunk or short beside their neighbors\")", () => {
  for (const id of ["moo", "gingerbread"] as const)
    it(`${id}: drawn ${TOWN_FEEL.streetHomeScale[id]}x, its front on its row's line, its door and strip working`, () => {
      const home = BOXES.find((b) => b.home === id)!;
      expect(home, id).toBeDefined();
      expect(pxOf(home.box)).toBeCloseTo(37 / TOWN_FEEL.streetHomeScale[id]!, 6);
      const row = BOXES.filter((b) => b !== home && b.facing === home.facing && b.kind !== "wall" && b.kind !== "hedge" && b.kind !== "shed" && Math.abs(b.fy - home.fy) < 1 && Math.abs(b.fx - home.fx) < 8);
      expect(row.length, "neighbors").toBeGreaterThanOrEqual(2);
      for (const b of row) expect(home.fy, `${b.box.id}'s front line`).toBeCloseTo(b.fy, 6);
      const lot = STREET_LOTS.find((l) => l.kind === "home" && l.id === id)!;
      boxPoint(home, home.box, 0, 0, pt);
      const left = pt.x;
      boxPoint(home, home.box, home.box.front.w, 0, pt);
      const right = pt.x;
      for (const sq of [lot.door!, lot.rest!]) {
        expect(sq.c, `${at(sq.c, sq.r)} before its front`).toBeGreaterThanOrEqual(Math.min(left, right));
        expect(sq.c).toBeLessThanOrEqual(Math.max(left, right));
        expect(walkable(sq.c, sq.r), at(sq.c, sq.r)).toBe(true);
      }
      expect(STRIPS.find((s) => s.home === id)!.squares).toContainEqual({ c: lot.door!.c, r: lot.door!.r });
    });
});
