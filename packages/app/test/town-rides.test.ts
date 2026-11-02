import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ITEM_DEFS, RIDES as RIDE_SETTINGS } from "@chessroyale/core";
import { rideHash } from "../../../scripts/measure-rides.ts";
import { FACINGS, viewOf, type RiderDraft } from "../src/components/rides/kit.ts";
import { RIDE_IDS, loadRide, rideDrawing } from "../src/components/rides/load.ts";
import { rideSpeed, seatAnchor } from "../src/components/rides/scale.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { RIDE_CELLS } from "../src/town/ride-cells.ts";
import { Rider, rideArt } from "../src/town/rides.ts";
import { Walker, type Pose } from "../src/town/world.ts";

/**
 * Rides in the town (Oct 31; Nov 1, rides v2: docs/decisions/2026-11-01-rides-v2.md): every ride is a catalog item with its
 * drawing (its side, and its back and front views and trail mark where it has them), measured for the town (ride-cells.ts); a
 * rider's frames, its stance and its tag's height in each view come from them; the walk says which view (the way it last
 * walked) and how far through a step it is, so a ride's move plays one cycle a square at the walk's own pace.
 */

// (No browser here: a rider only works out its numbers, `compose` false.)
/** The repository's root (the measure reads its files from there). */
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const pawn = { img: { width: 208, height: 208 } as HTMLCanvasElement, pad: 0.15, top: 0.2 };
const art = (id: string) => rideArt(id)!;
const RED = { color: "red", color2: "red", side: "w" as const };
/** Every ride's drawing (each its own chunk in the app: load.ts), loaded here up front. */
const RIDES: Record<string, RiderDraft> = Object.fromEntries(await Promise.all(RIDE_IDS.map(async (id) => [id, (await loadRide(id))!] as const)));

describe("the rides", () => {
  it("every ride item has a drawing and its measured views, and every drawing is a ride item, with the drawing's own name and line (Nov 1: every boss's)", () => {
    const rides = ITEM_DEFS.filter((d) => d.slot === "ride");
    expect(rides.map((d) => d.id).sort()).toEqual(
      ["riding-chirp", "moon-ride", "hollow-bulb", "smudgy-brush", "alfil-howdah", "balloon-pup", "bigboy-buggy", "boingo-pogo", "folio-crane", "ginger-sled", "jefferson-giraffe", "puddles-mower", "sawyer-dozer", "rodeo-bull", "cheetah-shoes", "log-roller"].sort(),
    );
    expect(Object.keys(RIDES).sort()).toEqual(rides.map((d) => d.id).sort());
    expect(Object.keys(RIDE_CELLS).sort()).toEqual(rides.map((d) => d.id).sort());
    for (const def of rides) {
      const d = RIDES[def.id]!;
      expect([def.name, def.description, def.tier, def.colors]).toEqual([d.name, d.description, "mythic", d.colors]);
      // A view measured for each view drawn (Moon's Ride: its side only, as Eric left it).
      for (const v of ["back", "front"] as const) expect(!!RIDE_CELLS[def.id]![v], `${def.id} ${v}`).toBe(!!d.views?.[v]);
      expect(TOWN_FEEL.rides[def.id], def.id).toBeDefined();
    }
    expect(RIDES["moon-ride"]!.views).toBeUndefined();
    expect(RIDES["moon-ride"]!.trail).toBeUndefined();
    // Every other ride has both views and a trail mark, inside the art's limits (40 x 30 units).
    for (const d of Object.values(RIDES).filter((x) => x.id !== "moon-ride")) {
      expect([!!d.views?.back, !!d.views?.front, !!d.trail], d.id).toEqual([true, true, true]);
      expect(d.trail!.w, d.id).toBeLessThanOrEqual(40);
      expect(d.trail!.h, d.id).toBeLessThanOrEqual(30);
    }
  });

  it("each ride's cells are its drawing as drawn now (run npx tsx scripts/measure-rides.ts after a change)", () => {
    for (const [id, c] of Object.entries(RIDE_CELLS)) expect(c.hash, `${id}: run npx tsx scripts/measure-rides.ts`).toBe(rideHash(id, ROOT));
  });

  it("each ride's measured numbers are its drawing's (Nov 1, rides lazy): its tile's box, each view's frames (times, seats, lift) and its trail's, so every box is sized before the drawing loads", () => {
    for (const id of RIDE_IDS) {
      const d = RIDES[id]!;
      const c = RIDE_CELLS[id]!;
      expect(c.frame, id).toEqual(d.frame);
      for (const facing of FACINGS) {
        const m = c[facing];
        if (!m) continue;
        const v = viewOf(d, facing);
        for (const anim of ["idle", "move"] as const) {
          expect(m[anim].map((r) => r[0]), `${id} ${facing} ${anim}`).toEqual(v[anim].ms);
          v[anim].ms.forEach((_, f) => {
            const p = v.pose(anim, f);
            const want = [p.pawnX, p.pawnY, p.pawnTilt ?? 0, p.cut, ...(anim === "move" ? [p.dy] : [])];
            m[anim][f]!.slice(1).forEach((x, i) => expect(x, `${id} ${facing} ${anim} ${f}`).toBeCloseTo(want[i]!, 3));
          });
        }
      }
      expect(c.trail ?? null, id).toEqual(d.trail ? { ms: d.trail.ms, w: d.trail.w, h: d.trail.h, every: Math.max(1, d.trail.every ?? 1) } : null);
    }
  });

  it("each drawing loads on its own (Nov 1, rides lazy): only load.ts imports one, never statically, so none is in the main bundle; once loaded it's kept, and a non-ride is none", async () => {
    const SRC = fileURLToPath(new URL("../src/", import.meta.url));
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(`${dir}${e.name}/`) : /\.tsx?$/.test(e.name) ? [`${dir}${e.name}`] : []));
    const drawing = new RegExp(`["/](${RIDE_IDS.join("|")})\\.tsx["']`);
    for (const f of files(SRC)) {
      const text = readFileSync(f, "utf8");
      const lines = text.split("\n").filter((l) => drawing.test(l) && /\bimport\b/.test(l));
      if (f.endsWith("components/rides/load.ts")) {
        expect(lines.length).toBe(RIDE_IDS.length);
        for (const l of lines) expect(l, l).toMatch(/\(\) => import\("\.\/[a-z-]+\.tsx"\)/);
      } else expect(lines, f).toEqual([]);
    }
    expect(rideDrawing("riding-chirp")).toBe(RIDES["riding-chirp"]);
    expect(await loadRide("riding-chirp")).toBe(RIDES["riding-chirp"]);
    expect(await loadRide("pirate-hat")).toBeUndefined();
    expect(await loadRide("toString")).toBeUndefined();
  });

  it("every ride is 0.75 its drawn size (Nov 1, Eric: \"0.75 is good\"), one default, and Cheetah Shoes walk twice as fast", () => {
    expect(RIDE_SETTINGS.defaultScale).toBe(0.75);
    expect(RIDE_SETTINGS.scale).toEqual({});
    expect(RIDE_SETTINGS.speed).toEqual({ "cheetah-shoes": 2 });
    expect(rideSpeed("cheetah-shoes")).toBe(2);
    expect(rideSpeed("riding-chirp")).toBe(1);
    expect(rideSpeed(undefined)).toBe(1);
  });
});

describe("a rider", () => {
  it("in each of its views stands its ride's feet on the square's middle, its pawn the size it is on foot, its tag over the highest of the ride and the pawn", () => {
    for (const id of Object.keys(RIDES)) {
      const rd = new Rider(art(id), RED, pawn, pawn, false);
      const d = RIDES[id]!;
      rd.views.forEach((rv, i) => {
        const facing = FACINGS[i]!;
        // (A ride without that view keeps its side.)
        expect(rv.facing, `${id} ${facing}`).toBe(facing === "side" || d.views?.[facing] ? facing : "side");
        const m = RIDE_CELLS[id]![rv.facing]!;
        const v = viewOf(d, rv.facing);
        // Its foot: the drawing's middle (x 50) and its feet's line, inside its box (at 1, as drawn).
        expect(rv.x0 + rv.footX * rv.w).toBeCloseTo(50);
        expect(rv.y0 + rv.footY * rv.h).toBeCloseTo(TOWN_FEEL.rides[id]!.foot);
        // The box holds the ride's cell and the pawn raised onto its seat.
        expect(rv.x0).toBeLessThanOrEqual(m.cell[0]);
        expect(rv.x0 + rv.w).toBeGreaterThanOrEqual(m.cell[0] + m.cell[2]);
        const seatY = Math.min(...v.idle.ms.map((_, f) => v.pose("idle", f).pawnY));
        expect(rv.y0).toBeLessThanOrEqual(-12 + seatY);
        // Its top: the pawn's top on its seat (a hat over the head) or the ride's own, whichever is higher.
        expect(rv.y0 + rv.top * rv.h).toBeCloseTo(Math.min(-15 + 0.2 * 130 + seatY, m.cell[1] + m.top));
        // Its times and lift: the view's own.
        expect(rv.idleEnds.length).toBe(v.idle.ms.length);
        expect(rv.moveEnds.length).toBe(v.move.ms.length);
        // (As measured: ride-cells.ts keeps a thousandth of a unit.)
        expect(rv.lift.length).toBe(v.move.ms.length);
        rv.lift.forEach((x, f) => expect(x).toBeCloseTo(-v.pose("move", f).dy, 3));
      });
      expect(rd.ready).toBe(false);
      rd.drop();
    }
  });

  it("from behind, its pawn is the one with its face items left off (the director's call); from the side and the front, the pawn as dressed", () => {
    const back = { ...pawn, top: 0.25 };
    const rd = new Rider(art("riding-chirp"), RED, pawn, back, false);
    expect(rd.views.map((v) => v.pawn)).toEqual([pawn, back, pawn]);
    // (Moon's Ride has no back view: its side, the pawn as dressed.)
    const moon = new Rider(art("moon-ride"), RED, pawn, back, false);
    expect(moon.views.map((v) => v.pawn)).toEqual([pawn, pawn, pawn]);
    expect(new Set(moon.views).size).toBe(1);
  });

  it("at a smaller or bigger size (Nov 1, RIDES.scale): the ride scaled about its saddle, the pawn its own size still in the saddle, the ride on the square", () => {
    for (const id of Object.keys(RIDES))
      for (const k of [0.5, 0.75, 1.25]) {
        const one = new Rider(art(id), RED, pawn, pawn, false);
        const rd = new Rider(art(id), RED, pawn, pawn, false, k);
        expect(rd.scale).toBe(k);
        for (let vi = 0; vi < 3; vi++) {
          const rv = rd.views[vi]!;
          const r1 = one.views[vi]!;
          const v = viewOf(RIDES[id]!, rv.facing);
          const m = RIDE_CELLS[id]![rv.facing]!;
          const seat = (anim: "idle" | "move", f: number) => {
            const p = v.pose(anim, f);
            return [p.pawnX, p.pawnY, p.pawnTilt ?? 0, p.cut];
          };
          const a = seatAnchor(seat("idle", 0));
          const foot = TOWN_FEEL.rides[id]!.foot;
          // The ride: its cell k times as big about the saddle, its feet still on the square's middle.
          expect(rv.cell[2]).toBeCloseTo(k * m.cell[2]);
          expect(rv.cell[3]).toBeCloseTo(k * m.cell[3]);
          expect(rv.x0 + rv.footX * rv.w).toBeCloseTo(a[0] + k * (50 - a[0]));
          expect(rv.y0 + rv.footY * rv.h).toBeCloseTo(a[1] + k * (foot - a[1]));
          // The pawn: the same size; on every frame its cut line on the saddle as scaled (the same share of it hidden).
          for (const anim of ["idle", "move"] as const)
            v[anim].ms.forEach((_, f) => {
              const s0 = seat(anim, f);
              const [x, y, tilt, cut] = rv.seats[anim][f]!;
              expect(tilt).toBeCloseTo(s0[2]!, 3);
              expect(cut).toBeCloseTo(s0[3]!, 3);
              const r = (tilt! * Math.PI) / 180;
              const q = [50 - (cut! - 88) * Math.sin(r), 88 + (cut! - 88) * Math.cos(r)];
              expect(x! + q[0]!, `${id} ${rv.facing} ${k} ${anim} ${f}`).toBeCloseTo(a[0] + k * (s0[0]! + q[0]! - a[0]));
              expect(y! + q[1]!, `${id} ${rv.facing} ${k} ${anim} ${f}`).toBeCloseTo(a[1] + k * (s0[1]! + q[1]! - a[1]));
            });
          // Standing on the square, the pawn is lower by the ride's shrinking under it (higher when it grows), never resized.
          const drop = rv.y0 + rv.footY * rv.h - rv.seats.idle[0]![1]! - (r1.y0 + r1.footY * r1.h - r1.seats.idle[0]![1]!);
          expect(drop).toBeCloseTo((k - 1) * (foot - a[1]));
          rv.lift.forEach((l, i) => expect(l).toBeCloseTo(r1.lift[i]! * k));
          expect(rv.x0 + rv.w).toBeGreaterThanOrEqual(rv.cell[0] + rv.cell[2]);
        }
        // Its shadow and its trail mark at its size; drawn from farther off the sides when bigger.
        expect(rd.shadow).toBeCloseTo(TOWN_FEEL.rides[id]!.shadow * k);
        if (rd.trail) expect([rd.trail.w, rd.trail.h]).toEqual([RIDES[id]!.trail!.w * k, RIDES[id]!.trail!.h * k]);
        expect(rd.margin).toBe(k > 1 ? 1.5 * k : 1.5);
        one.drop();
        rd.drop();
      }
  });

  it("plays its idle on its own times, its move one cycle a step in the shares of its drawn times, and its trail mark on the mark's own times", () => {
    const d = RIDES["riding-chirp"]!;
    const rd = new Rider(art("riding-chirp"), RED, pawn, pawn, false);
    const rv = rd.views[0];
    const total = d.idle.ms.reduce((a, b) => a + b, 0);
    expect(rv.idleLoop).toBe(total);
    expect(rv.idleIndex(0)).toBe(0);
    expect(rv.idleIndex(d.idle.ms[0]! - 1)).toBe(0);
    expect(rv.idleIndex(d.idle.ms[0]!)).toBe(1);
    expect(rv.idleIndex(total + 1)).toBe(0);
    expect(rv.idleIndex(total - 1)).toBe(d.idle.ms.length - 1);
    // The move: 650 ms as drawn, played over one step whatever its length (the walk keeps its pace).
    const moveTotal = d.move.ms.reduce((a, b) => a + b, 0);
    let at = 0;
    d.move.ms.forEach((ms, i) => {
      expect(rv.moveIndex(at / moveTotal + 1e-6), `frame ${i}`).toBe(i);
      at += ms;
    });
    expect(rv.moveIndex(1)).toBe(d.move.ms.length - 1);
    // The trail (Chirp's prints: 160, 150, 150, 140 ms): gone after 600 ms, one on every square.
    expect(rd.trail).toMatchObject({ ends: [160, 310, 460, 600], life: 600, every: 1 });
    expect(new Rider(art("moon-ride"), RED, pawn, pawn, false).trail).toBeNull();
    rd.drop();
  });

  it("a walker says how far through its step it is (0 to 1, even in time), standing that it isn't stepping, and which way it last walked (its view)", () => {
    const w = new Walker({ c: 5, r: 5 }, 90, true, 0.5);
    const pose: Pose = { x: 0, y: 0, hop: 0, tilt: 0, step: true, t: 1 };
    w.pose(0, pose);
    expect([pose.step, pose.t, w.view]).toEqual([false, 0, 0]);
    w.go([{ c: 6, r: 5 }, { c: 7, r: 5 }]);
    w.update(1000);
    w.pose(1000 + 45, pose);
    expect(pose.step).toBe(true);
    expect(pose.t).toBeCloseTo(0.5);
    w.update(1090);
    w.pose(1090 + 9, pose);
    expect(pose.t).toBeCloseTo(0.1);
    w.update(5000);
    w.pose(5000, pose);
    expect([pose.step, pose.t, pose.x, w.view, w.facing]).toEqual([false, 0, 7, 0, 1]);
    // Up the screen (away, r growing): its back; down (r shrinking): its front; standing, the last one; left: its side, facing left.
    w.go([{ c: 7, r: 6 }]);
    w.update(6000);
    expect(w.view).toBe(1);
    w.update(7000);
    expect(w.view).toBe(1);
    w.go([{ c: 7, r: 5 }]);
    w.update(8000);
    expect(w.view).toBe(2);
    w.go([{ c: 6, r: 5 }]);
    w.update(9000);
    expect([w.view, w.facing]).toEqual([0, -1]);
  });

  it("a walker's step time can change (Cheetah Shoes: half a step's time), and its steps take that long", () => {
    const w = new Walker({ c: 5, r: 5 }, 90, true);
    w.stepMs = TOWN_FEEL.youStepMs / rideSpeed("cheetah-shoes");
    expect(w.stepMs).toBe(45);
    const pose: Pose = { x: 0, y: 0, hop: 0, tilt: 0, step: false, t: 0 };
    w.go([{ c: 6, r: 5 }, { c: 7, r: 5 }]);
    w.update(1000);
    w.update(1045);
    w.pose(1045 + 22.5, pose);
    expect([pose.x, pose.t]).toEqual([6.5, 0.5]);
  });
});

describe("riders shared and freed", () => {
  const plain = { img: { width: 160, height: 160 } as HTMLCanvasElement, pad: 0, top: 0.18 };
  afterEach(() => vi.unstubAllGlobals());

  it("people whose pawns look the same share one set of frames; the last one out frees it; the town's close frees everything", async () => {
    const { shareRider, leaveRider, dropRiders, ridersHeld } = await import("../src/town/rides.ts");
    // (Composing never gets its first animation frame here.)
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const pearl = { color: "pearl", color2: "pearl", side: "w" as const };
    const a = shareRider(art("moon-ride"), pearl, "light||null", plain, plain, () => {});
    const b = shareRider(art("moon-ride"), pearl, "light||null", plain, plain, () => {});
    const c = shareRider(art("moon-ride"), { ...pearl, side: "b" }, "dark||null", plain, plain, () => {});
    const d = shareRider(art("moon-ride"), RED, "light||null", plain, plain, () => {});
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    expect(d).not.toBe(a);
    expect(a.users).toBe(2);
    expect(ridersHeld()).toEqual({ riders: 3 });
    leaveRider(a);
    expect(ridersHeld().riders).toBe(3);
    leaveRider(b);
    expect(ridersHeld().riders).toBe(2);
    dropRiders();
    expect(ridersHeld()).toEqual({ riders: 0 });
  });

  it("a rider whose pictures don't come is forgotten, so the next rider on that look makes them again", async () => {
    const { shareRider, dropRiders, ridersHeld } = await import("../src/town/rides.ts");
    // (An animation frame comes, but there's no page to draw the ride's SVG in: its pictures fail.)
    vi.stubGlobal("requestAnimationFrame", (f: (t: number) => void) => setTimeout(() => f(0), 0));
    const sage = { color: "sage", color2: "sage", side: "w" as const };
    const a = shareRider(art("riding-chirp"), sage, "light||null", plain, plain, () => {});
    expect(ridersHeld()).toEqual({ riders: 1 });
    await new Promise((r) => setTimeout(r, 20));
    expect(ridersHeld()).toEqual({ riders: 0 });
    expect(a.ready).toBe(false);
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const b = shareRider(art("riding-chirp"), sage, "light||null", plain, plain, () => {});
    expect(b).not.toBe(a);
    expect(ridersHeld()).toEqual({ riders: 1 });
    dropRiders();
  });
});
