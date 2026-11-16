import { describe, expect, it, vi } from "vitest";

// A player's town (Nov 13: the street town for everyone; admin-town.ts ADMIN_TOWN off): the homes of the bosses in the game for admins first
// (core's BOSS_ADMIN_FIRST) aren't in it, and their lots go to the rows' look-alike fronts (street.ts lotHere), so no half-built home shows.
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: false }));

const { BOSS_ADMIN_FIRST } = await import("@chessroyale/core");
const { N } = await import("../src/town/camera.ts");
const { PLAN_HOMES, STREET_BUILDINGS, STREET_HOMES, STREET_LOTS } = await import("../src/town/street.ts");
const { streetBoxes } = await import("../src/town/boxes.ts");
const { STRIPS } = await import("../src/town/strips.ts");
const { HOMES, PROPS, START, plotAt, stepsFrom, walkable } = await import("../src/town/world.ts");

const lotId = (id: string) => (id === "dash" ? "blitz" : id);

describe("a player's town: the street town without the admin-first homes (Nov 13)", () => {
  it("has every home but the admin-first ones, each on its lot", () => {
    expect(BOSS_ADMIN_FIRST.length).toBeGreaterThan(0);
    for (const id of BOSS_ADMIN_FIRST) expect(HOMES.some((h) => h.id === id), id).toBe(false);
    expect(HOMES.length).toBe(PLAN_HOMES.length - BOSS_ADMIN_FIRST.length);
    expect(STREET_HOMES.map((l) => l.id).sort()).toEqual(HOMES.map((h) => lotId(h.id)).sort());
  });

  it("their lots are the row's look-alike fronts: no home's box, plot, strip or lot there, and a front stands over each", () => {
    const boxes = streetBoxes(PROPS);
    for (const id of BOSS_ADMIN_FIRST) {
      const plan = PLAN_HOMES.find((l) => l.id === lotId(id))!;
      expect(boxes.some((b) => b.home === id), `${id}'s box`).toBe(false);
      expect(STRIPS.some((s) => s.home === lotId(id) || s.home === id), `${id}'s strip`).toBe(false);
      expect(STREET_LOTS.some((l) => l.kind === "home" && l.id === plan.id), `${id}'s lot`).toBe(false);
      for (let dr = 0; dr < plan.d; dr++) for (let dc = 0; dc < plan.w; dc++) expect(plotAt[(plan.r0 + dr) * N + plan.c0 + dc], `${id}'s plot`).toBeNull();
      // A look-alike front over the middle of its lot's front.
      const mid = plan.c0 + (plan.w - 1) / 2;
      const front = STREET_BUILDINGS.find((b) => b.look && b.at && b.facing === plan.facing && Math.abs(b.at.y - (plan.r0 - 0.5 + plan.inset)) < 1 && Math.abs(b.at.x - mid) <= b.w / 2 + 0.5);
      expect(front, `a look-alike front on ${id}'s lot`).toBeTruthy();
    }
  });

  it("is walkable all round: every square you can stand on is reached from your start", () => {
    const d = stepsFrom(START);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (walkable(c, r)) expect(d[r * N + c], `${c},${r} cut off`).toBeGreaterThanOrEqual(0);
  });
});
