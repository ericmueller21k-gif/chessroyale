import { it, vi } from "vitest";
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true, STREET_TOWN: true }));
const { newView, setView, setHeading } = await import("../src/town/camera.ts");
const { PROPS } = await import("../src/town/world.ts");
const { streetBoxes, newPlan, planBox } = await import("../src/town/boxes.ts");
const { TOWN_FEEL } = await import("../src/town/feel.ts");
it("x", () => {
  const v = newView();
  setView(v, 768, 800, 0, 1, 0, 0, TOWN_FEEL.streetZoomSteps[2]!);
  setHeading(v, -90);
  console.log("back", v.back, "W", v.W);
  for (const b of streetBoxes(PROPS)) {
    if (b.kind !== "ring" && b.kind !== "portal") continue;
    const p = newPlan(b.box);
    planBox(p, b, b.box, v, 22, 41, false, -Infinity);
    const f = p.front;
    console.log(b.box.id, b.fx.toFixed(2), b.fy.toFixed(2), "on", f.on, "x", f.x0.toFixed(0), f.x1.toFixed(0), "y", f.y0.toFixed(0), f.y1.toFixed(0), "k", f.k0.toFixed(0), f.k1.toFixed(0), "s", f.s0.toFixed(2), f.s1.toFixed(2), "strips", f.strips, "faces", p.nOrder);
  }
});
