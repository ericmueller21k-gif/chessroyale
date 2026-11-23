import { describe, expect, it } from "vitest";
import { CLAW_CABINET } from "../src/town/kit/models/claw-cabinet.ts";
import { FUN_PALETTE } from "../src/town/shops/boingo-palette.ts";
import { bakeFace, gridTexel, rampsOf, toHex } from "../src/town/kit/bake.ts";
import { facesOf, texOf } from "../src/town/kit/prims.ts";

/**
 * Boingo's claw machine as a kit model (Nov 6; brief-3d-kit part 2): every pixel of every face, at every light step, is one of
 * Boingo's own colors (FUN_PALETTE); its faces carry the ink outline; nothing is a stroked line or a smooth vector shape.
 */
describe("the claw cabinet on the kit", () => {
  const ramps = rampsOf(CLAW_CABINET.palette);
  const boingo = new Set(Object.values(FUN_PALETTE).map((c) => c.toLowerCase()));

  it("its palette is Boingo's: every ramp step one of his colors", () => {
    for (const [k, r] of Object.entries(ramps)) for (const c of r) expect(boingo.has(c), `${k}: ${c}`).toBe(true);
  });

  it("every face bakes, at every step, to Boingo's colors only; the cabinet's faces have the ink outline", () => {
    let outlined = 0;
    CLAW_CABINET.shapes.forEach((s, i) => {
      for (const f of facesOf(s)) {
        const grid = CLAW_CABINET.textures[texOf(s, f)];
        expect(grid, `shape ${i} ${f.role}: its texture "${texOf(s, f)}"`).toBeDefined();
        for (const step of [-1, 0, 1] as const) {
          const b = bakeFace({ n: f.pts.length, tx: f.tx, ty: f.ty, tx0: 0, ty0: 0, tw: f.tw, th: f.th }, gridTexel(grid!), ramps, step, { soft: f.soft });
          let ink = 0;
          for (let k = 0; k < b.mask.length; k++) {
            if (!b.mask[k]) continue;
            const c = toHex(b.data[k * 4]!, b.data[k * 4 + 1]!, b.data[k * 4 + 2]!, b.data[k * 4 + 3]!);
            expect(boingo.has(c), `shape ${i} ${f.role} at ${step}: ${c}`).toBe(true);
            if (c === FUN_PALETTE.k) ink++;
          }
          if (step === 0 && f.tw >= 4 && f.th >= 4 && !f.soft && ink > 0) outlined++;
        }
      }
    });
    expect(outlined).toBeGreaterThan(40);
  });

  it("the base, the glass and the sign are boxes; the claw's arm and cable are quads; its texels are the room's (37 a square)", () => {
    const prims = CLAW_CABINET.shapes.map((s) => s.prim);
    expect(prims.filter((p) => p === "box").length).toBeGreaterThan(20);
    const arm = CLAW_CABINET.shapes.filter((s) => s.part?.startsWith("prong-") || s.part?.startsWith("cable"));
    expect(arm.length).toBe(18 + 5);
    expect(arm.every((s) => s.prim === "quad")).toBe(true);
    // 66 texels across: the room's 1.8-square cabinet at 37 texels a square.
    expect(CLAW_CABINET.shapes[0]!.size[0] / 37).toBeCloseTo(1.8, 1);
  });
});
