import { describe, expect, it, vi } from "vitest";

// The street town (everyone's since Nov 13; here an admin's), where Eric tapped Alfil's door (Nov 12).
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true }));

const PLAN = (await import("../src/town/street-plan.json")).default;
const { HOMES, createTown, destFor, homeNear, plotAt, walkable } = await import("../src/town/world.ts");
const { N, wrapI } = await import("../src/town/camera.ts");

/**
 * A tap on or near a building's foot is that home's (Nov 12, Eric: "when you click any pixels that are at the bottom of the building,
 * especially where the door is, even on the tiles that are not fully displayed that are underneath the building"; `homeNear`, used by the
 * tap's plan in Town.tsx). Its picture's own pixels and its see-through gaps near its foot are render.ts `pick`'s (the e2e,
 * e2e/town-street.spec.ts); here, the squares: the half-hidden row under its front, its door, the ground right in front, and nothing
 * two rows out or round the corner.
 */
const lotOf = (id: string) => PLAN.lots.find((l) => l.kind === "home" && l.id === (id === "dash" ? "blitz" : id))!;

describe("a tap on or near a home's foot is that home (the street town)", () => {
  it("every home: its plot's front row (half under its picture), its door square, the one beside it and its whole foot row are the home; two rows out and the corners are not", () => {
    expect(HOMES.length).toBeGreaterThan(10);
    for (const h of HOMES) {
      const lot = lotOf(h.id);
      const front = lot.r0;
      const foot = lot.door.r;
      expect(foot, `${h.id}: its door's row is the one right in front`).toBe(front - 1);
      for (let c = lot.c0; c < lot.c0 + lot.w; c++) {
        expect(homeNear(c, front)?.id, `${h.id}: the half-hidden tile (${c}, ${front})`).toBe(h.id);
        expect(homeNear(c, foot)?.id, `${h.id}: its foot (${c}, ${foot})`).toBe(h.id);
        const out = homeNear(c, foot - 1);
        expect(out?.id ?? null, `${h.id}: two out (${c}, ${foot - 1})`).not.toBe(h.id);
        if (walkable(c, foot - 1)) expect(out, `${h.id}: open ground two out is a square`).toBeNull();
      }
      expect(homeNear(lot.door.c, foot)?.id, `${h.id}: its door square`).toBe(h.id);
      for (const c of [lot.c0 - 1, lot.c0 + lot.w]) expect(homeNear(c, foot)?.id ?? null, `${h.id}: the corner (${wrapI(c)}, ${foot})`).not.toBe(h.id);
    }
  });

  it("a tap on any square of the foot row walks you to the home's door square, as a tap on the building does", () => {
    const t = createTown(1);
    for (const h of HOMES) {
      const lot = lotOf(h.id);
      for (let c = lot.c0; c < lot.c0 + lot.w; c++) {
        const home = homeNear(c, lot.door.r)!;
        const to = destFor(t, t.you.walker, { kind: "home", home });
        // (The door square, or the one beside it if someone stands there: destFor's front squares.)
        expect(to && to.r === lot.door.r && Math.abs(to.c - lot.door.c) <= 1, `${h.id} from (${c}, ${lot.door.r}): ${JSON.stringify(to)}`).toBe(true);
      }
    }
  });

  it("a plot's own squares stay its home's (plotAt), and off the world is nothing", () => {
    for (let k = 0; k < N * N; k++) if (plotAt[k]) expect(homeNear(k % N, Math.floor(k / N))).toBe(plotAt[k]);
    expect(homeNear(0, -1)).toBeNull();
    expect(homeNear(0, N)).toBeNull();
  });
});
