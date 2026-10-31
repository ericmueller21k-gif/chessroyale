import { render, type ComponentChildren } from "preact";
import { ITEM_COLORS } from "@chessroyale/core";
import { usePaint } from "../components/item-paint.tsx";
import { RIDES, type RiderDraft } from "../components/rides/kit.ts";

/**
 * Dev only (not in the build): bakes a ride's frames for the town square (`npx tsx scripts/bake-rides.ts`, which opens this
 * page on the app's dev server). `window.__bake(id, color)` draws every frame of the ride's `idle` and `move`, its `Back`
 * and its `Front` apart (the town puts the pawn between them), in that color at 100% purity without the shine (the town
 * draws no blotches and no shine: docs/decisions/2026-10-31-rides.md), into one sheet: rows idle back, idle front, move
 * back, move front, a frame a column, each cell the same box round every frame (`cell`, in the pawn's square's units).
 * Answers the sheet as a PNG's data address and the cell.
 */

/** Pixels a unit of the pawn's square (the town draws a dressed pawn at 160 pixels a pawn: town/render.ts, PAWN_PX). */
const PX = 1.6;
const ANIMS = ["idle", "move"] as const;

/** One layer of one frame, as SVG on the pawn's square. */
function Layer({ d, color, anim, f, part }: { d: RiderDraft; color: string; anim: "idle" | "move"; f: number; part: "Back" | "Front" }): ComponentChildren {
  const finish = { color, blemish: 0, seed: 1 };
  const p = usePaint(finish, d.frame);
  const p2 = usePaint({ ...finish, seed: 102 }, d.frame);
  return (
    <g>
      <defs>
        {p.defs}
        {p2.defs}
      </defs>
      {d[part]({ p, p2, side: "w", f, anim })}
    </g>
  );
}

/** Every layer of every frame drawn into the page (hidden), to measure and to copy. */
function layers(d: RiderDraft, color: string): { anim: "idle" | "move"; f: number; part: "Back" | "Front"; el: SVGGElement }[] {
  const host = document.getElementById("app")!;
  const out: { anim: "idle" | "move"; f: number; part: "Back" | "Front"; el: SVGGElement }[] = [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("width", "100");
  svg.setAttribute("height", "100");
  host.replaceChildren(svg);
  for (const anim of ANIMS)
    for (let f = 0; f < d[anim].ms.length; f++)
      for (const part of ["Back", "Front"] as const) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        svg.append(g);
        render(<Layer d={d} color={color} anim={anim} f={f} part={part} />, g);
        // (The shine's band: the town draws none, and its rect would widen the box.)
        g.querySelectorAll(".item-shine").forEach((n) => n.remove());
        out.push({ anim, f, part, el: g });
      }
  return out;
}

async function bake(id: string, color: string) {
  const d = RIDES[id];
  if (!d) throw new Error(`no ride ${id}`);
  if (!ITEM_COLORS.some((c) => c.id === color)) throw new Error(`no color ${color}`);
  const all = layers(d, color);
  // The cell: every frame's box, both layers, with room for the outlines (getBBox leaves strokes out), in whole units.
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const { el } of all) {
    const b = el.getBBox();
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
  const cw = Math.round(cell[2]! * PX);
  const ch = Math.round(cell[3]! * PX);
  const cols = Math.max(d.idle.ms.length, d.move.ms.length);
  const sheet = document.createElement("canvas");
  sheet.width = cols * cw;
  sheet.height = 4 * ch;
  const g = sheet.getContext("2d")!;
  const ns = "http://www.w3.org/2000/svg";
  for (const { anim, f, part, el } of all) {
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("xmlns", ns);
    svg.setAttribute("viewBox", cell.join(" "));
    svg.setAttribute("width", String(cw));
    svg.setAttribute("height", String(ch));
    svg.append(el.cloneNode(true));
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    await img.decode();
    const row = (anim === "idle" ? 0 : 2) + (part === "Back" ? 0 : 1);
    g.drawImage(img, f * cw, row * ch, cw, ch);
  }
  render(null, document.getElementById("app")!);
  // The highest drawn row of any idle frame, back or front (the town's name tag sits over the ride's top and its rider's).
  const px = g.getImageData(0, 0, sheet.width, 2 * ch).data;
  let top = 2 * ch;
  for (let i = 3; i < px.length; i += 4) if (px[i]! > 24) top = Math.min(top, Math.floor((i - 3) / 4 / sheet.width) % ch);
  return { png: sheet.toDataURL("image/png"), cell, w: cw, h: ch, top };
}

/** A ride's times and seats: each frame's ms, where the pawn sits (x, y, tilt, cut) and, moving, the lift (-dy), in units. */
function poses(id: string) {
  const d = RIDES[id]!;
  const seat = (anim: "idle" | "move") =>
    d[anim].ms.map((_, f) => {
      const p = d.pose(anim, f);
      return [p.pawnX, p.pawnY, p.pawnTilt ?? 0, p.cut];
    });
  return { ms: { idle: d.idle.ms, move: d.move.ms }, seat: { idle: seat("idle"), move: seat("move") }, lift: d.move.ms.map((_, f) => -d.pose("move", f).dy) };
}

const w = window as unknown as { __bake: typeof bake; __poses: typeof poses; __rides: string[]; __colors: string[] };
w.__bake = bake;
w.__poses = poses;
w.__rides = Object.keys(RIDES);
w.__colors = ITEM_COLORS.map((c) => c.id);
