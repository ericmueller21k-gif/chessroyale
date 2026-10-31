import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ITEM_COLORS, ITEM_DEFS } from "@chessroyale/core";
import { rideHash } from "../../../scripts/bake-rides.ts";
import { RIDES } from "../src/components/rides/kit.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { RIDE_PX, RIDE_SHEETS } from "../src/town/ride-sheets.ts";
import { Rider } from "../src/town/rides.ts";
import { Walker, type Pose } from "../src/town/world.ts";

/**
 * Rides in the town (Oct 31; docs/decisions/2026-10-31-rides.md): each ride's baked sheets are its drawing as drawn, in every
 * color; a rider's frames, its stance and its tag's height come from them; the walk tells a ride's move how far through a
 * step it is, so it plays one cycle a square at the walk's own pace.
 */

// (No browser here: a rider only works out its numbers, `compose` false.)
/** The repository's root (the bake reads its files from there). */
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** A WebP's width and height, from its header (lossless "VP8L", or "VP8X"). */
function webpSize(b: Buffer): [number, number] {
  expect(b.toString("ascii", 0, 4) + b.toString("ascii", 8, 12)).toBe("RIFFWEBP");
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8L") {
    expect(b[20]).toBe(0x2f);
    const bits = b.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  expect(chunk).toBe("VP8X");
  return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
}

describe("the rides' baked sheets", () => {
  it("every ride item has a drawing and a sheet, and every drawing is a ride item", () => {
    const rides = ITEM_DEFS.filter((d) => d.slot === "ride").map((d) => d.id);
    expect(Object.keys(RIDES).sort()).toEqual([...rides].sort());
    expect(Object.keys(RIDE_SHEETS).sort()).toEqual([...rides].sort());
  });

  it("each sheet is its ride as drawn now, in every color (run npx tsx scripts/bake-rides.ts after a change)", () => {
    for (const [id, s] of Object.entries(RIDE_SHEETS)) {
      expect(s.hash, `${id}: run npx tsx scripts/bake-rides.ts`).toBe(rideHash(id, ROOT));
      // Every color's sheet, whole: its columns (the longer animation's frames) and its four rows of cells (a partial bake fails).
      const cols = Math.max(s.ms.idle.length, s.ms.move.length);
      for (const c of ITEM_COLORS) {
        const file = `${ROOT}packages/app/src/town/rides/ride-${id}-${c.id}.webp`;
        expect(existsSync(file), `${id} ${c.id}`).toBe(true);
        expect(webpSize(readFileSync(file)), `${id} ${c.id}`).toEqual([cols * s.w, 4 * s.h]);
      }
      const d = RIDES[id]!;
      expect(s.ms.idle).toEqual(d.idle.ms);
      expect(s.ms.move).toEqual(d.move.ms);
      for (const anim of ["idle", "move"] as const)
        s.seat[anim].forEach((seat, f) => {
          const p = d.pose(anim, f);
          expect(seat, `${id} ${anim} ${f}`).toEqual([p.pawnX, p.pawnY, p.pawnTilt ?? 0, p.cut].map((x) => +x.toFixed(2)));
        });
      expect(s.lift).toEqual(d.move.ms.map((_, f) => +(-d.pose("move", f).dy).toFixed(2)));
      // The cell is the same pixels a unit as the town's dressed pawns (160 a pawn).
      expect(Math.abs(s.w - s.cell[2] * RIDE_PX)).toBeLessThanOrEqual(1);
      expect(TOWN_FEEL.rides[id], id).toBeDefined();
    }
  });
});

describe("a rider", () => {
  const pawn = { img: { width: 208, height: 208 } as HTMLCanvasElement, pad: 0.15, top: 0.2 };

  it("stands its ride's feet on the square's middle, its pawn the size it is on foot, its tag over the highest of the ride and the pawn", () => {
    for (const s of Object.values(RIDE_SHEETS)) {
      const rd = new Rider(s, "red", pawn, false);
      // Its foot: the drawing's middle (x 50) and its feet's line, inside its box.
      expect(rd.x0 + rd.footX * rd.w).toBeCloseTo(50);
      expect(rd.y0 + rd.footY * rd.h).toBeCloseTo(TOWN_FEEL.rides[s.id]!.foot);
      // The box holds the ride's cell and the pawn raised onto its seat.
      expect(rd.x0).toBeLessThanOrEqual(s.cell[0]);
      expect(rd.x0 + rd.w).toBeGreaterThanOrEqual(s.cell[0] + s.cell[2]);
      const seatY = Math.min(...s.seat.idle.map((x) => x[1]!));
      expect(rd.y0).toBeLessThanOrEqual(-12 + seatY);
      // Its top: the pawn's top on its seat (a hat over the head) or the ride's own, whichever is higher.
      const pawnTop = -15 + 0.2 * 130 + seatY;
      const rideTop = s.cell[1] + s.top / RIDE_PX;
      expect(rd.y0 + rd.top * rd.h).toBeCloseTo(Math.min(pawnTop, rideTop));
      expect(rd.ready).toBe(false);
      rd.drop();
    }
  });

  it("plays its idle on its own times, and its move one cycle a step, in the shares of its drawn times", () => {
    const s = RIDE_SHEETS["riding-chirp"];
    const rd = new Rider(s, "red", pawn, false);
    const total = s.ms.idle.reduce((a, b) => a + b, 0);
    expect(rd.idleLoop).toBe(total);
    expect(rd.idleIndex(0)).toBe(0);
    expect(rd.idleIndex(s.ms.idle[0]! - 1)).toBe(0);
    expect(rd.idleIndex(s.ms.idle[0]!)).toBe(1);
    expect(rd.idleIndex(total + 1)).toBe(0);
    expect(rd.idleIndex(total - 1)).toBe(s.ms.idle.length - 1);
    // The move: 650 ms as drawn, played over one step whatever its length (the walk keeps its pace).
    const moveTotal = s.ms.move.reduce((a, b) => a + b, 0);
    let at = 0;
    s.ms.move.forEach((ms, i) => {
      expect(rd.moveIndex(at / moveTotal + 1e-6), `frame ${i}`).toBe(i);
      at += ms;
    });
    expect(rd.moveIndex(1)).toBe(s.ms.move.length - 1);
    rd.drop();
  });

  it("a walker says how far through its step it is (0 to 1, even in time), and standing, that it isn't stepping", () => {
    const w = new Walker({ c: 5, r: 5 }, 90, true, 0.5);
    const pose: Pose = { x: 0, y: 0, hop: 0, tilt: 0, step: true, t: 1 };
    w.pose(0, pose);
    expect([pose.step, pose.t]).toEqual([false, 0]);
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
    expect([pose.step, pose.t, pose.x]).toEqual([false, 0, 7]);
  });
});

describe("riders shared and freed", () => {
  const pawn = { img: { width: 160, height: 160 } as HTMLCanvasElement, pad: 0, top: 0.18 };
  /** A sheet's picture in a test: never arrives (`hang`), or fails to (`fail`). */
  function picture(how: "hang" | "fail") {
    (globalThis as { Image?: unknown }).Image = class {
      src = "";
      decode() {
        return how === "hang" ? new Promise(() => {}) : Promise.reject(new Error("404"));
      }
    };
  }

  it("people whose pawns look the same share one set of frames and one sheet; the last one out frees it; the town's close frees everything", async () => {
    const { shareRider, leaveRider, dropRiders, ridersHeld } = await import("../src/town/rides.ts");
    picture("hang");
    const s = RIDE_SHEETS["moon-ride"];
    const a = shareRider(s, "pearl", "light||null", pawn, () => {});
    const b = shareRider(s, "pearl", "light||null", pawn, () => {});
    const c = shareRider(s, "pearl", "dark||null", pawn, () => {});
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    expect(a.users).toBe(2);
    expect(ridersHeld()).toEqual({ riders: 2, sheets: 1 });
    leaveRider(a);
    expect(ridersHeld().riders).toBe(2);
    leaveRider(b);
    expect(ridersHeld().riders).toBe(1);
    dropRiders();
    expect(ridersHeld()).toEqual({ riders: 0, sheets: 0 });
  });

  it("a sheet that doesn't come is forgotten, so the next rider in that color fetches it again", async () => {
    const { shareRider, dropRiders, ridersHeld } = await import("../src/town/rides.ts");
    picture("fail");
    const s = RIDE_SHEETS["riding-chirp"];
    const a = shareRider(s, "sage", "light||null", pawn, () => {});
    expect(ridersHeld()).toEqual({ riders: 1, sheets: 1 });
    await new Promise((r) => setTimeout(r, 0));
    expect(ridersHeld()).toEqual({ riders: 0, sheets: 0 });
    expect(a.ready).toBe(false);
    picture("hang");
    const b = shareRider(s, "sage", "light||null", pawn, () => {});
    expect(b).not.toBe(a);
    expect(ridersHeld()).toEqual({ riders: 1, sheets: 1 });
    dropRiders();
  });
});
