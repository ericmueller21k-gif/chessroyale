import { describe, expect, it } from "vitest";
import type { VNode } from "preact";
import { HUNCHESS_RIDES, RIDES as RIDE_SETTINGS, hunchessBase } from "@chessroyale/core";
import { HUNCHESS_LEVELS, HUNCHESS_PALETTE, hunchessFilterId } from "../src/components/rides/hunchess.tsx";
import { FACINGS, viewOf, type RiderProps } from "../src/components/rides/kit.ts";
import { RIDE_IDS, loadRide, rideBase, rideCells } from "../src/components/rides/load.ts";
import { rideScale, rideSpeed } from "../src/components/rides/scale.ts";
import { RIDE_CELLS } from "../src/town/ride-cells.ts";

/**
 * The HunChess colorway (the Welcome Crate's prize, Eric, Nov 6: "Make that colorway for every ride"): every ride has one, drawn from
 * that ride's own drawing with every layer remapped (the filter on Back, Front, each view and the trail), and everything else (its
 * cells, size, pace) its ride's. docs/welcome-crate/hunchess-rides.png is the sheet of every one, drawn.
 */

const paint = { id: "p", fill: "#f2c14e", blotch: "none", hex: "#f2c14e", defs: null, finish: { color: "yellow", blemish: 0, seed: 1 }, flameFill: "#f2c14e", box: [0, 0, 100, 100] };
const props: RiderProps = { p: paint as never, p2: paint as never, side: "w", f: 0, anim: "idle" };

/** The filter a layer's drawing is wrapped in (its outermost group's). */
const filterOf = (node: unknown) => ((node as VNode<{ filter?: string }>)?.props?.filter ?? null) as string | null;

describe("the HunChess colorway (Nov 6)", () => {
  it("every ride has one, and only rides do", () => {
    expect(HUNCHESS_RIDES.map((d) => hunchessBase(d.id)).sort()).toEqual([...RIDE_IDS].sort());
    for (const d of HUNCHESS_RIDES) expect(RIDE_IDS).not.toContain(d.id);
  });

  it("each draws: its ride's drawing, every layer of every view and its trail in the remap's filter (the ride's own levels)", async () => {
    for (const d of HUNCHESS_RIDES) {
      const base = hunchessBase(d.id)!;
      const plain = (await loadRide(base))!;
      const hc = (await loadRide(d.id))!;
      expect(hc, d.id).toBeDefined();
      expect(hc).not.toBe(plain);
      // (Loaded once: asked again, the same drawing.)
      expect(await loadRide(d.id)).toBe(hc);
      expect(hc.frame).toEqual(plain.frame);
      for (const facing of FACINGS) {
        const v = viewOf(hc, facing);
        for (const anim of ["idle", "move"] as const) {
          const n = (anim === "idle" ? v.idle : v.move).ms.length;
          for (let f = 0; f < n; f++) {
            for (const part of ["Back", "Front"] as const) {
              const node = v[part]({ ...props, anim, f, view: facing });
              expect(filterOf(node), `${d.id} ${facing} ${anim} ${f} ${part}`).toBe(`url(#${hunchessFilterId(base)})`);
            }
            expect(v.pose(anim, f)).toEqual(viewOf(plain, facing).pose(anim, f));
          }
        }
      }
      if (plain.trail) expect(filterOf(hc.trail!.Mark({ p: paint as never, p2: paint as never, f: 0, view: "side", n: 0 })), d.id).toBe(`url(#${hunchessFilterId(base)})`);
      else expect(hc.trail).toBeUndefined();
    }
  });

  it("its cells, size and pace are its ride's", () => {
    for (const d of HUNCHESS_RIDES) {
      const base = hunchessBase(d.id)!;
      expect(rideBase(d.id)).toBe(base);
      expect(rideCells(d.id)).toBe(RIDE_CELLS[base]);
      expect(rideScale(d.id)).toBe(RIDE_SETTINGS.scale[base] ?? RIDE_SETTINGS.defaultScale);
      expect(rideSpeed(d.id)).toBe(rideSpeed(base));
    }
    expect(rideSpeed("cheetah-shoes-hunchess")).toBe(2);
  });

  it("the palette is gold, black and cream; levels are set only for real rides, and keep the light in range", () => {
    expect(HUNCHESS_PALETTE).toMatchObject({ black: "#0b0906", gold: "#c99a22", cream: "#fff4d6" });
    for (const [id, l] of Object.entries(HUNCHESS_LEVELS)) {
      expect(RIDE_IDS, id).toContain(id);
      expect(l.gain).toBeGreaterThan(0);
      expect(l.lift).toBeGreaterThanOrEqual(0);
      expect(l.lift).toBeLessThan(0.5);
    }
  });
});
