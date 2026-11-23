import { describe, expect, it, vi } from "vitest";

// An admin's town is the street town: its boxes (the box path goes through the kit).
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true }));

const { area, facesOf, lightStep } = await import("../src/town/kit/prims.ts");
const { bakeFace, gridOf, gridTexel, rampColors, rampOf, rampsOf, stepChar, toHex, rgba } = await import("../src/town/kit/bake.ts");
const { geomOf, streetBoxes, faceStep } = await import("../src/town/boxes.ts");
const { tileOf, tileTexel, RIM_KEY } = await import("../src/town/box-draw.ts");
const { PROPS } = await import("../src/town/world.ts");
type Shape = import("../src/town/kit/prims.ts").Shape;
type PFace = import("../src/town/kit/prims.ts").PFace;

/**
 * The 3D art kit (Nov 6; brief-3d-kit, the audit's §3): its primitives' geometry, its faces baked as palette ramp steps with an ink
 * outline, and the street town's box path through it (every roof pixel a palette color).
 */
const shape = (prim: Shape["prim"], extra: Partial<Shape> = {}): Shape => ({ prim, at: [0, 0, 0], size: [20, 10, 30], faces: { front: "f" }, ...extra });
const byRole = (fs: PFace[], role: string) => fs.filter((f) => f.role === role);
const close = (a: readonly number[], b: readonly number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));
/** Every face's corners run clockwise in its texture (y down), from its top left: its texture reads like a picture from outside. */
const clockwise = (f: PFace) => expect(area(f.tx, f.ty)).toBeGreaterThan(0);

describe("the kit's primitives", () => {
  it("a box: front, back, both sides and a top, each facing out, its texture the face's size", () => {
    const fs = facesOf(shape("box"));
    expect(fs.map((f) => f.role).sort()).toEqual(["back", "front", "left", "right", "top"]);
    close(byRole(fs, "front")[0]!.n, [0, -1, 0]);
    close(byRole(fs, "back")[0]!.n, [0, 1, 0]);
    close(byRole(fs, "left")[0]!.n, [-1, 0, 0]);
    close(byRole(fs, "right")[0]!.n, [1, 0, 0]);
    close(byRole(fs, "top")[0]!.n, [0, 0, 1]);
    const f = byRole(fs, "front")[0]!;
    expect([f.tw, f.th]).toEqual([20, 30]);
    // The front's top left is its first corner: texture (0, 0) at the top left, y down the wall.
    expect([f.tx[0], f.ty[0], f.tx[2], f.ty[2]]).toEqual([0, 0, 20, 30]);
    const s = byRole(fs, "right")[0]!;
    expect([s.tw, s.th]).toEqual([10, 30]);
    const t = byRole(fs, "top")[0]!;
    expect([t.tw, t.th]).toEqual([20, 10]);
    fs.forEach(clockwise);
    // Hidden faces are left out.
    expect(facesOf(shape("box", { hide: ["top", "back"] })).length).toBe(3);
  });

  it("a prism (gable): triangle ends, two slopes meeting at the ridge, lit left and dark right", () => {
    const fs = facesOf(shape("prism"));
    expect(fs.map((f) => f.role)).toEqual(["front", "back", "left", "right"]);
    expect(fs[0]!.pts.length).toBe(3);
    const [l, r] = [byRole(fs, "left")[0]!, byRole(fs, "right")[0]!];
    expect(l.n[0]).toBeLessThan(0);
    expect(l.n[2]).toBeGreaterThan(0);
    expect(r.n[0]).toBeGreaterThan(0);
    // Its ridge: the slopes' top edge at the full height, in the middle.
    expect(Math.max(...l.pts.map((p) => p[2]))).toBe(30);
    expect(l.pts.filter((p) => p[2] === 30).every((p) => p[0] === 10)).toBe(true);
    fs.forEach(clockwise);
    // (Facing north, a slope facing left is a step lighter than one facing right.)
    const st = (f: PFace) => lightStep(f.n[0], f.n[1], f.n[2]);
    expect(st(l)).toBeGreaterThan(st(r));
  });

  it("a pyramid comes to a point; a hip has a ridge", () => {
    const p = facesOf(shape("pyramid"));
    expect(p.map((f) => f.pts.length)).toEqual([3, 3, 3, 3]);
    const top = p.flatMap((f) => f.pts).filter((q) => q[2] === 30);
    expect(new Set(top.map((q) => q.join())).size).toBe(1);
    const h = facesOf(shape("pyramid", { ridge: 0.5 }));
    expect(h.map((f) => f.pts.length)).toEqual([3, 3, 4, 4]);
    [...p, ...h].forEach(clockwise);
    for (const f of [...p, ...h]) expect(f.n[2]).toBeGreaterThan(0);
  });

  it("a wedge: a slope up toward the back (a control desk), a front lip with `lo`", () => {
    const w = facesOf(shape("wedge"));
    expect(w.map((f) => f.role)).toEqual(["top", "back", "left", "right"]);
    const t = w[0]!;
    expect(t.n[1]).toBeLessThan(0);
    expect(t.n[2]).toBeGreaterThan(0);
    const lo = facesOf(shape("wedge", { lo: 0.25 }));
    expect(lo.map((f) => f.role)).toEqual(["top", "front", "back", "left", "right"]);
    expect(byRole(lo, "front")[0]!.th).toBe(8);
    [...w, ...lo].forEach(clockwise);
  });

  it("a cylinder: n sides round it and an n-gon top; a dome: n x m facets up to its top", () => {
    const c = facesOf(shape("cyl", { n: 6, size: [20, 20, 10] }));
    expect(c.length).toBe(7);
    const top = byRole(c, "top")[0]!;
    expect(top.pts.length).toBe(6);
    close(top.n, [0, 0, 1]);
    for (const f of byRole(c, "slope")) {
      expect(Math.abs(f.n[2])).toBeLessThan(1e-9);
      // Each side faces out from the axis.
      const m = f.pts.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
      expect(f.n[0] * (m[0]! - 10) + f.n[1] * (m[1]! - 10)).toBeGreaterThan(0);
    }
    const d = facesOf(shape("dome", { n: 8, m: 3, size: [20, 20, 10] }));
    expect(d.length).toBe(24);
    expect(d.filter((f) => f.pts.length === 3).length).toBe(8);
    for (const f of d) expect(f.n[2]).toBeGreaterThan(0);
    [...c, ...d].forEach(clockwise);
    // (A curved shape's facets have no outline of their own.)
    expect(d.every((f) => f.soft)).toBe(true);
  });

  it("a quad: thin, two-sided, upright or flat or at any angle", () => {
    const up = facesOf(shape("quad", { size: [2, 0, 30] }))[0]!;
    expect(up.twoSided).toBe(true);
    expect([up.tw, up.th, up.role]).toEqual([2, 30, "front"]);
    const flat = facesOf(shape("quad", { size: [20, 10, 0] }))[0]!;
    expect(flat.role).toBe("top");
    const side = facesOf(shape("quad", { size: [0, 10, 5] }))[0]!;
    expect(side.role).toBe("right");
    const slant = facesOf(shape("quad", { pts: [[0, 0, 10], [2, 0, 10], [7, 0, 0], [5, 0, 0]] }))[0]!;
    expect(slant.role).toBe("front");
    expect(slant.tw).toBe(7);
    [up, flat, side, slant].forEach(clockwise);
  });
});

describe("the kit's light: palette ramp steps", () => {
  it("tops and lit faces the light step, fronts the base, the right side a step darker, roofs from n . L", () => {
    expect(lightStep(0, 0, 1)).toBe(1);
    expect(lightStep(0, -1, 0)).toBe(0);
    expect(lightStep(-1, 0, 0)).toBe(0);
    expect(lightStep(1, 0, 0)).toBe(-1);
    // A wall turned a little right of the camera stays the base; turned past the art's half way, a step darker.
    expect(lightStep(Math.sin(0.3), -Math.cos(0.3), 0)).toBe(0);
    expect(lightStep(Math.sin(0.7), -Math.cos(0.7), 0)).toBe(-1);
    // Roof slopes: toward the light (up and left) lit; away (right, or the back) darker.
    const s = Math.SQRT1_2;
    expect(lightStep(-s, 0, s)).toBe(1);
    expect(lightStep(s, 0, s)).toBe(-1);
    expect(lightStep(0, s, s)).toBe(-1);
    // The town's: the same, through the camera's heading (facing east, a face facing south is on the right).
    expect(faceStep(0, -1, 0, 0, 1)).toBe(-1);
    expect(faceStep(-1, 0, 0, 0, 1)).toBe(0);
  });

  it("a derived ramp: the dark step is the art's 30% shade (the street's right-hand walls), the light a touch brighter; alpha kept", () => {
    const [d, b, l] = rampOf("#a4744a");
    expect(b).toBe("#a4744a");
    expect(d).toBe(toHex(0.7 * 0xa4 + 0.3 * 0x0b, 0.7 * 0x74 + 0.3 * 0x0a, 0.7 * 0x4a + 0.3 * 0x12));
    expect(rgba(l)[0]).toBeGreaterThan(0xa4);
    expect(rampOf("#9fe3ff80").every((c) => c.endsWith("80"))).toBe(true);
    // A model's own ramp is kept as given.
    expect(rampsOf({ r: ["#a3202b", "#e2343b", "#ff5a5f"] }).r).toEqual(["#a3202b", "#e2343b", "#ff5a5f"]);
  });

  it("a picture a step darker is a palette swap: every color its own ramp's dark step, frames' own colors too", () => {
    const ch = { id: "t", name: "t", w: 1, h: 1, foot: [0, 0] as const, palette: { k: "#2a2118", b: "#cfc4ad" }, parts: {}, anims: { idle: { loop: true, frames: [{ layers: [], ms: 100, pal: { b: "#ffffff" } }] } } };
    const d = stepChar(ch, -1);
    expect(d.palette.b).toBe(rampOf("#cfc4ad")[0]);
    expect(d.anims.idle!.frames[0]!.pal!.b).toBe(rampOf("#ffffff")[0]);
    expect(stepChar(ch, -1)).toBe(d);
    expect(stepChar(ch, 0)).toBe(ch);
  });
});

describe("the kit's faces", () => {
  const ramps = rampsOf({ k: "#150c11", r: ["#a3202b", "#e2343b", "#ff6b6b"], y: "#f2c14e", l: "#9fe3ff80" });
  const colors = rampColors(ramps);
  const pixels = (b: { w: number; h: number; data: Uint8ClampedArray; mask: Uint8Array }) => {
    const out: { i: number; j: number; c: string }[] = [];
    for (let j = 0; j < b.h; j++)
      for (let i = 0; i < b.w; i++) {
        const k = j * b.w + i;
        if (!b.mask[k]) continue;
        const d = b.data;
        out.push({ i, j, c: toHex(d[k * 4]!, d[k * 4 + 1]!, d[k * 4 + 2]!, d[k * 4 + 3]!) });
      }
    return out;
  };
  const poly = (f: PFace) => ({ n: f.pts.length, tx: f.tx, ty: f.ty, tx0: 0, ty0: 0, tw: f.tw, th: f.th });

  it("every pixel is a palette color at every step, see-through glass included; the outline is the ink on every outer edge", () => {
    const grid = ["rrry", "ryrr", "llrr"];
    for (const prim of ["box", "prism", "pyramid", "wedge", "cyl", "quad"] as const)
      for (const f of facesOf(shape(prim, prim === "quad" ? { size: [20, 0, 30] } : {})))
        for (const step of [-1, 0, 1] as const) {
          const b = bakeFace(poly(f), gridTexel(grid), ramps, step, { soft: f.soft });
          const px = pixels(b);
          expect(px.length).toBeGreaterThan(0);
          for (const p of px) expect(colors.has(p.c), `${prim} ${f.role} ${step}: ${p.c}`).toBe(true);
        }
    // A box's front: its outer ring of pixels is all ink, its inside the texture at its step.
    const front = facesOf(shape("box"))[0]!;
    for (const step of [-1, 0, 1] as const) {
      const b = bakeFace(poly(front), gridTexel(["r"]), ramps, step);
      const px = pixels(b);
      const ink = px.filter((p) => p.c === "#150c11");
      const edge = px.filter((p) => p.i === 1 || p.j === 1 || p.i === b.w - 2 || p.j === b.h - 2);
      expect(edge.every((p) => p.c === "#150c11"), `outlined at ${step}`).toBe(true);
      expect(ink.length).toBe(edge.length);
      expect(px.filter((p) => p.c !== "#150c11").every((p) => p.c === ramps.r![step + 1])).toBe(true);
    }
  });

  it("a triangle's outline follows its slanted edges; a thin part (2 texels) and a curved facet have none", () => {
    const tri = facesOf(shape("prism"))[0]!;
    const b = bakeFace(poly(tri), gridTexel(["r"]), ramps, 0);
    const px = pixels(b);
    // Every pixel next to one outside the face is ink.
    const own = new Set(px.map((p) => `${p.i},${p.j}`));
    const out = (p: { i: number; j: number }) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => !own.has(`${p.i + a!},${p.j + c!}`));
    expect(px.filter(out).every((p) => p.c === "#150c11")).toBe(true);
    expect(px.some((p) => p.c === ramps.r![1])).toBe(true);
    const thin = facesOf(shape("quad", { size: [2, 0, 30] }))[0]!;
    expect(pixels(bakeFace(poly(thin), gridTexel(["y"]), ramps, 0)).every((p) => p.c !== "#150c11")).toBe(true);
    const dome = facesOf(shape("dome", { size: [40, 40, 20] }))[0]!;
    expect(pixels(bakeFace(poly(dome), gridTexel(["r"]), ramps, 0, { soft: dome.soft })).every((p) => p.c !== "#150c11")).toBe(true);
  });

  it("a texture as data: a fill with rectangles painted over it in order", () => {
    expect(gridOf(4, 3, "r", [[1, 0, 2, 2, "y"], [2, 1, 9, 9, "k"]])).toEqual(["ryyr", "rykk", "rrkk"]);
  });

  it("a texture tiles from the face's top left, rows down the face", () => {
    const front = facesOf(shape("box", { size: [12, 4, 12] }))[0]!;
    const b = bakeFace(poly(front), gridTexel(["ry", "yr"]), ramps, 0, { ink: null });
    const at = (i: number, j: number) => pixels(b).find((p) => p.i === i + 1 && p.j === j + 1)!.c;
    expect([at(0, 0), at(1, 0), at(0, 1), at(2, 0)]).toEqual([ramps.r![1], ramps.y![1], ramps.y![1], ramps.r![1]]);
  });
});

describe("the street town's box path through the kit", () => {
  it("every roof face of every box, at every step, bakes to its palette's ramps only (and the ink, the rim): no multiply, no overlay", () => {
    const seen = new Set<unknown>();
    let faces = 0;
    for (const b of streetBoxes(PROPS)) {
      const key = b.tile ?? b.box;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const fg of geomOf(b.box).faces) {
        const tile = tileOf(b.box, fg.tex, b.tile);
        const colors = rampColors(tile.ramps);
        for (const step of [-1, 0, 1] as const) {
          const d = bakeFace(fg, tileTexel(fg, tile), tile.ramps, step, { soft: fg.soft, rim: fg.rim ? RIM_KEY : undefined });
          for (let k = 0; k < d.mask.length; k++) {
            if (!d.mask[k]) continue;
            const c = toHex(d.data[k * 4]!, d.data[k * 4 + 1]!, d.data[k * 4 + 2]!, d.data[k * 4 + 3]!);
            if (!colors.has(c)) throw new Error(`${b.box.id} ${fg.tex} at ${step}: ${c} is not in its palette`);
          }
        }
        faces++;
      }
    }
    expect(faces).toBeGreaterThan(100);
  });
});
