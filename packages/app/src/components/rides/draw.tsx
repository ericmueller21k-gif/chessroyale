import { h, render, type ComponentChildren } from "preact";
import { usePaint } from "../item-paint.tsx";
import { viewOf, type RiderDraft, type RiderFacing } from "./kit.ts";

/**
 * A ride's pictures as SVG, one layer of one frame at a time (Nov 1, rides v2: docs/decisions/2026-11-01-rides-v2.md): what the
 * town composes its riders' frames from (town/rides.ts, once, a frame an animation frame) and what the rides' measure reads
 * (dev/rides-measure.tsx). Its color and second color, 100% purity, no shine: the town shows a ride's colors, not its copy's
 * blotches or shine.
 */

/** The colors a ride is drawn in: its color, its second color (a two-color ride's), and the side of the pawn on it. */
export interface RideColors {
  color: string;
  color2: string;
  side: "w" | "b";
}

/** One layer (`Back`, behind the pawn, or `Front`) of one frame of a view of a ride, on the pawn's square. */
export function RideLayer({ d, view, c, anim, f, part }: { d: RiderDraft; view: RiderFacing; c: RideColors; anim: "idle" | "move"; f: number; part: "Back" | "Front" }): ComponentChildren {
  const v = viewOf(d, view);
  const box = v.frame ?? d.frame;
  const p = usePaint({ color: c.color, blemish: 0, seed: 1 }, box);
  const p2 = usePaint({ color: c.color2, blemish: 0, seed: 102 }, box);
  return (
    <g>
      <defs>
        {p.defs}
        {p2.defs}
      </defs>
      {v[part]({ p, p2, side: c.side, f, anim, view })}
    </g>
  );
}

/** One frame of a ride's trail mark, round (0, 0) on the ground, as it ran: `view` (side: going right), the `n`th mark of a run. */
export function RideMark({ d, view, c, f, n }: { d: RiderDraft; view: RiderFacing; c: RideColors; f: number; n: number }): ComponentChildren {
  const t = d.trail;
  if (!t) return null;
  const box: [number, number, number, number] = [-t.w / 2, -t.h / 2, t.w, t.h];
  const p = usePaint({ color: c.color, blemish: 0, seed: 1 }, box);
  const p2 = usePaint({ color: c.color2, blemish: 0, seed: 102 }, box);
  return (
    <g>
      <defs>
        {p.defs}
        {p2.defs}
      </defs>
      {t.Mark({ p, p2, f, view, n })}
    </g>
  );
}

const NS = "http://www.w3.org/2000/svg";
let host: SVGSVGElement | null = null;

/**
 * `node` drawn as a standalone SVG of `box` (x, y, w, h, in the pawn's square's units) at `px` pixels a unit: its text, to
 * become an image (Preact draws it into a detached SVG, read back as text; nothing is added to the page).
 */
export function svgText(node: ComponentChildren, box: readonly [number, number, number, number], px: number): string {
  host ??= document.createElementNS(NS, "svg");
  host.setAttribute("xmlns", NS);
  host.setAttribute("viewBox", box.join(" "));
  host.setAttribute("width", String(Math.round(box[2] * px)));
  host.setAttribute("height", String(Math.round(box[3] * px)));
  render(h("g", null, node), host);
  // (A shiny copy's moving glint: CSS only, and never drawn here: these pictures have no blotches or shine.)
  host.querySelectorAll(".item-shine").forEach((n) => n.remove());
  const text = new XMLSerializer().serializeToString(host);
  render(null, host);
  return text;
}

/** An SVG's text as a decoded image (a data address; `decode` resolves once it can be drawn). */
export function svgImage(text: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
  return img.decode().then(() => img);
}
