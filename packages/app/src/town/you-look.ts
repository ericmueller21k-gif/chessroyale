/**
 * Your own pawn in the town square as your profile shows it (Eric's slice 4 test: "my pawn isn't showing my profile
 * pawn"): your equipped crate items (account.ts, `locker.look`) over the pawn, drawn the way `Avatar` draws them
 * (components/Items.tsx: the items behind the piece, the piece or its skin, the items in front), into one canvas the
 * world draws as your sprite. `Avatar` is SVG made by Preact, so it's rendered once off screen, each of its layers turned
 * into an image, and the images drawn in its order; the plain pawn stands in for its piece. Made again only when your
 * look changes. Signed out or nothing on: null (the world draws the plain pawn). Bots stay plain.
 */
import { h, render } from "preact";
import type { ItemLook } from "@chessroyale/core";
import { Avatar } from "../components/Items.tsx";
import type { YouArt } from "./render.ts";

/** Room round the pawn's box for items that rise or reach past it (`Avatar` lets them go 12% past it at most). */
const PAD = 0.15;

/** A key for a look (null: nothing on), to tell when it changed. */
export const lookKey = (look: ItemLook | null | undefined): string | null => (look && Object.keys(look).length ? JSON.stringify(look) : null);

/**
 * Your dressed pawn at `px` pixels a pawn's box, over `pawn` (the plain pawn's picture, square): resolves to null if
 * there's nothing to wear or an image fails to load (the world then keeps the plain pawn).
 */
export async function dressedPawn(look: ItemLook | null | undefined, pawn: HTMLCanvasElement, px: number): Promise<YouArt | null> {
  if (!lookKey(look)) return null;
  const host = document.createElement("div");
  render(h(Avatar, { look: look!, side: "w" }), host);
  try {
    const span = host.firstElementChild;
    if (!span) return null;
    const S = Math.round(px * (1 + 2 * PAD));
    const vb = `${-PAD * 100} ${-PAD * 100} ${100 * (1 + 2 * PAD)} ${100 * (1 + 2 * PAD)}`;
    // Its layers in order: an SVG becomes an image; the piece (a CSS background) is the plain pawn.
    const layers = await Promise.all(
      Array.from(span.children).map((el) => {
        if (el.tagName.toLowerCase() !== "svg") return Promise.resolve(pawn as CanvasImageSource);
        const svg = el.cloneNode(true) as SVGSVGElement;
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("viewBox", vb);
        svg.setAttribute("width", String(S));
        svg.setAttribute("height", String(S));
        svg.querySelectorAll(".item-shine").forEach((n) => n.remove()); // (a shiny item's moving glint: CSS only)
        const img = new Image();
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
        return img.decode().then(() => img as CanvasImageSource);
      }),
    );
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const inset = Math.round(PAD * px);
    for (const l of layers) {
      if (l === pawn) g.drawImage(pawn, inset, inset, S - 2 * inset, S - 2 * inset);
      else g.drawImage(l, 0, 0, S, S);
    }
    // Its top (a hat rises over the pawn's head): your name tag sits over it.
    const d = g.getImageData(0, 0, S, S).data;
    let first = d.length;
    for (let j = 3; j < d.length; j += 4)
      if (d[j]! > 24) {
        first = j;
        break;
      }
    return { img: c, pad: PAD, top: Math.floor(first / 4 / S) / S };
  } catch {
    return null;
  } finally {
    render(null, host);
  }
}
