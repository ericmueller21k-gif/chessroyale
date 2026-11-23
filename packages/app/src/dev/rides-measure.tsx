import { render } from "preact";
import { ITEM_COLORS } from "@chessroyale/core";
import { FACINGS, viewOf, type RiderFacing } from "../components/rides/kit.ts";
import { RideLayer, svgImage, svgText } from "../components/rides/draw.tsx";
import { RIDE_IDS, loadRide } from "../components/rides/load.ts";

/**
 * Dev only (not in the build): measures each ride's views for the town square (`npx tsx scripts/measure-rides.ts`, which opens
 * this page on the app's dev server). `window.__measure(id)` draws every frame of each of the ride's views (side, and its back
 * and front if it has them), both layers, in every color, and answers each view's cell (the box round all of them, in the pawn's
 * square's units, with room for the outlines) and its top (the highest drawn row of any idle frame, in units). The town composes
 * its riders' frames from the drawings themselves (town/rides.ts), into these cells. `window.__poses(id)` (Nov 1, rides lazy) answers
 * the numbers every box needs before the drawing has loaded: its tile's box, each view's frames (their times and where the pawn sits)
 * and its trail mark's times and box.
 */

/** Pixels a unit the top is read at (the town's: RIDE_PX). */
const PX = 1.6;
const ANIMS = ["idle", "move"] as const;

async function measure(id: string) {
  const d = await loadRide(id);
  if (!d) throw new Error(`no ride ${id}`);
  const host = document.getElementById("app")!;
  const out: Partial<Record<RiderFacing, { cell: number[]; top: number; bottom: number }>> = {};
  for (const view of FACINGS) {
    if (view !== "side" && !d.views?.[view]) continue;
    const v = view === "side" ? d : d.views![view]!;
    // The cell: every frame's box, both layers, every color, with room for the outlines (getBBox leaves strokes out), in whole units.
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const c of ITEM_COLORS)
      for (const anim of ANIMS)
        for (let f = 0; f < v[anim].ms.length; f++)
          for (const part of ["Back", "Front"] as const) {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("viewBox", "0 0 100 100");
            svg.setAttribute("width", "100");
            svg.setAttribute("height", "100");
            host.replaceChildren(svg);
            render(<RideLayer d={d} view={view} c={{ color: c.id, color2: c.id, side: "w" }} anim={anim} f={f} part={part} />, svg);
            // (The shine's band: 100% purity is shiny, but the town draws no shine, and its rect would widen the box.)
            svg.querySelectorAll(".item-shine").forEach((n) => n.remove());
            const b = (svg.firstElementChild as SVGGElement).getBBox();
            render(null, svg);
            if (!b.width && !b.height) continue;
            x0 = Math.min(x0, b.x);
            y0 = Math.min(y0, b.y);
            x1 = Math.max(x1, b.x + b.width);
            y1 = Math.max(y1, b.y + b.height);
          }
    const M = 3;
    const cell = [Math.floor(x0 - M), Math.floor(y0 - M), 0, 0];
    cell[2] = Math.ceil(x1 + M) - cell[0]!;
    cell[3] = Math.ceil(y1 + M) - cell[1]!;
    // Its top: the highest drawn row of any idle frame, either layer (in red), in units.
    const cw = Math.round(cell[2]! * PX);
    const ch = Math.round(cell[3]! * PX);
    const cv = document.createElement("canvas");
    cv.width = cw;
    cv.height = ch;
    const g = cv.getContext("2d")!;
    for (let f = 0; f < v.idle.ms.length; f++)
      for (const part of ["Back", "Front"] as const)
        g.drawImage(await svgImage(svgText(<RideLayer d={d} view={view} c={{ color: "red", color2: "red", side: "w" }} anim="idle" f={f} part={part} />, cell as [number, number, number, number], PX)), 0, 0, cw, ch);
    const px = g.getImageData(0, 0, cw, ch).data;
    let top = ch;
    for (let i = 3; i < px.length; i += 4) if (px[i]! > 24) top = Math.min(top, Math.floor((i - 3) / 4 / cw));
    // (And, for the log only, its lowest drawn row on its first idle frame: where its feet or its shadow are, for TOWN_FEEL.rides' `foot`.)
    g.clearRect(0, 0, cw, ch);
    for (const part of ["Back", "Front"] as const)
      g.drawImage(await svgImage(svgText(<RideLayer d={d} view={view} c={{ color: "red", color2: "red", side: "w" }} anim="idle" f={0} part={part} />, cell as [number, number, number, number], PX)), 0, 0, cw, ch);
    const px0 = g.getImageData(0, 0, cw, ch).data;
    let bottom = 0;
    for (let i = 3; i < px0.length; i += 4) if (px0[i]! > 24) bottom = Math.max(bottom, Math.floor((i - 3) / 4 / cw));
    out[view] = { cell, top: +(top / PX).toFixed(2), bottom: +(cell[1]! + (bottom + 1) / PX).toFixed(1) };
  }
  host.replaceChildren();
  return out;
}

/** A number as the registry keeps it (to a thousandth of a unit; never -0). */
const r3 = (x: number) => Math.round(x * 1000) / 1000 + 0;

/** A ride's tile box, its views' frames ([ms, x, y, tilt, cut] standing; a move's also its lift, the pose's dy) and its trail's numbers. */
async function poses(id: string) {
  const d = await loadRide(id);
  if (!d) throw new Error(`no ride ${id}`);
  const views: Partial<Record<RiderFacing, { idle: number[][]; move: number[][] }>> = {};
  for (const view of FACINGS) {
    if (view !== "side" && !d.views?.[view]) continue;
    const v = viewOf(d, view);
    const rows = (anim: "idle" | "move") =>
      v[anim].ms.map((ms, f) => {
        const p = v.pose(anim, f);
        return [ms, r3(p.pawnX), r3(p.pawnY), r3(p.pawnTilt ?? 0), r3(p.cut), ...(anim === "move" ? [r3(p.dy)] : [])];
      });
    views[view] = { idle: rows("idle"), move: rows("move") };
  }
  const t = d.trail;
  return { frame: d.frame, views, trail: t ? { ms: t.ms, w: t.w, h: t.h, every: Math.max(1, t.every ?? 1) } : null };
}

const w = window as unknown as { __measure: typeof measure; __poses: typeof poses; __rides: readonly string[] };
w.__measure = measure;
w.__poses = poses;
w.__rides = RIDE_IDS;
