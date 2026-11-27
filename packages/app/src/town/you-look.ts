/**
 * Your own pawn in the town square as your profile shows it (Eric's slice 4 test: "my pawn isn't showing my profile
 * pawn"): your equipped crate items (account.ts, `locker.look`) over the pawn, drawn the way `Avatar` draws them
 * (components/Items.tsx: the items behind the piece, the piece or its skin, the items in front), into one canvas the
 * world draws as your sprite. `Avatar` is SVG made by Preact, so it's rendered once off screen, each of its layers turned
 * into an image, and the images drawn in its order; the plain pawn stands in for its piece. Made again only when your
 * look changes. Signed out or nothing on: null (the world draws the plain pawn). An item that plays in the town (Nov 27) is painted as its
 * loop's frames too, once (`dressedPawn`'s `play`); the town picks one each draw (render.ts `artAt`).
 */
import { h, render } from "preact";
import { TOWN_ITEM_FRAMES, type ItemLook } from "@chessroyale/core";
import { Avatar } from "../components/Items.tsx";
import type { YouArt } from "./render.ts";
import { art2d } from "./paint.ts";
import { upName } from "./frame-report.ts";

/** Room round the pawn's box for items that rise or reach past it (`Avatar` lets them go 12% past it at most). */
const PAD = 0.15;

/** A key for a look (null: nothing on), to tell when it changed. */
export const lookKey = (look: ItemLook | null | undefined): string | null => (look && Object.keys(look).length ? JSON.stringify(look) : null);

/**
 * What the pawn itself wears: a look without its ride (Oct 31: the town draws the ride under the dressed pawn, rides.ts) or its
 * outfit (Nov 10: drawn the same way, round the pawn).
 */
export function offRide(look: ItemLook | null | undefined): ItemLook | null {
  if (!look?.ride && !look?.outfit) return look ?? null;
  const { ride: _, outfit: _o, ...rest } = look;
  return rest;
}

/** What the pawn shows from behind (Nov 1, rides v2, the director's call: a ride's back view): its look without its face items (a hat still shows). */
export function offFace(look: ItemLook | null | undefined): ItemLook | null {
  if (!look?.face) return look ?? null;
  const { face: _, ...rest } = look;
  return rest;
}

/** The item a look plays in the town (TOWN_ITEM_FRAMES: the first worn in its order), or null. */
export function loopOf(look: ItemLook | null | undefined): (typeof TOWN_ITEM_FRAMES.items)[string] | null {
  if (!look) return null;
  const worn = new Set(Object.values(look).map((it) => it?.def));
  for (const [id, spec] of Object.entries(TOWN_ITEM_FRAMES.items)) if (worn.has(id)) return spec;
  return null;
}

/** The parts an item animates (Items.tsx: `ia` and `ia-twist`); their styles live in styles.css, which a picture made from the SVG lacks. */
const MOVING = ".ia, .ia-twist";

/**
 * A layer of the live Avatar as an SVG standing alone: its animated parts' styles as they are now (their transform, opacity and dash, from
 * the page's styles.css, which an SVG made into an image doesn't have) written onto them, in the padded view box at S px.
 */
function standAlone(el: SVGSVGElement, vb: string, S: number): string {
  const svg = el.cloneNode(true) as SVGSVGElement;
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("viewBox", vb);
  svg.setAttribute("width", String(S));
  svg.setAttribute("height", String(S));
  const from = el.querySelectorAll<SVGElement>(MOVING);
  const to = svg.querySelectorAll<SVGElement>(MOVING);
  from.forEach((part, i) => {
    const cs = getComputedStyle(part);
    const t = to[i]!;
    // (About the user space's origin, as an `ia` part turns: transform-box view-box, transform-origin 0 0.)
    if (cs.transform && cs.transform !== "none") t.setAttribute("transform", cs.transform);
    t.style.opacity = cs.opacity;
    t.style.strokeDasharray = cs.strokeDasharray;
    t.style.strokeDashoffset = cs.strokeDashoffset;
  });
  svg.querySelectorAll(".item-shine").forEach((n) => n.remove()); // (a shiny item's moving glint: CSS only)
  return new XMLSerializer().serializeToString(svg);
}
const svgImg = (text: string): Promise<CanvasImageSource> => {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
  return img.decode().then(() => img);
};

/**
 * Your dressed pawn at `px` pixels a pawn's box, over `pawn` (the plain pawn's picture, square) in `side` (your default
 * pawn color, or a player's; "w" for a bot): resolves to null if there's nothing to wear or an image fails to load (the
 * world then keeps the plain pawn).
 *
 * With `play` and an item that plays in the town (`loopOf`, Nov 27), its loop's frames too (`YouArt.loop`): the Avatar is put in the page
 * (off screen, where styles.css reaches it), the item's own CSS animations stopped at each frame's moment and its moving parts' styles
 * written onto a copy of its layer, the other layers drawn once. The still picture is every part at rest, as anywhere an item isn't the focus.
 */
export async function dressedPawn(look: ItemLook | null | undefined, pawn: HTMLCanvasElement, px: number, side: "w" | "b" = "w", play = false): Promise<YouArt | null> {
  if (!lookKey(look)) return null;
  const spec = play && !reducedMotion() ? loopOf(look) : null;
  const host = document.createElement("div");
  render(h(Avatar, { look: look!, side, live: !!spec }), host);
  try {
    const span = host.firstElementChild;
    if (!span) return null;
    const S = Math.round(px * (1 + 2 * PAD));
    const vb = `${-PAD * 100} ${-PAD * 100} ${100 * (1 + 2 * PAD)} ${100 * (1 + 2 * PAD)}`;
    // (Animated parts' rest and frames come from styles.css: in the page, off screen, while their styles are read.)
    if (span.querySelector(MOVING)) {
      host.style.cssText = "position:fixed;left:-10000px;top:0;width:100px;height:100px;visibility:hidden;pointer-events:none";
      document.body.append(host);
    }
    const els = Array.from(span.children);
    const anims = host.isConnected ? span.getAnimations({ subtree: true }) : [];
    const target = (a: Animation) => (a.effect as KeyframeEffect | null)?.target ?? null;
    const plays = spec ? anims.filter((a) => spec.play.some((c) => target(a)?.classList.contains(c))) : [];
    for (const a of anims) if (!plays.includes(a)) a.cancel();
    // (Each frame: the playing animations stopped at its moment; only the layers holding them drawn again.)
    const moving = new Set(els.filter((el) => plays.some((a) => el.contains(target(a)))));
    const frameTexts: string[][] = [];
    if (spec && moving.size) {
      for (let k = 0; k < spec.n; k++) {
        const t = spec.fromMs + ((spec.toMs - spec.fromMs) * k) / spec.n;
        for (const a of plays) {
          a.pause();
          a.currentTime = t;
        }
        frameTexts.push(els.filter((el) => moving.has(el)).map((el) => standAlone(el as SVGSVGElement, vb, S)));
      }
    }
    // (Then every part at rest: the still picture.)
    for (const a of plays) a.cancel();
    const layers = await Promise.all(els.map((el) => (el.tagName.toLowerCase() !== "svg" ? Promise.resolve(pawn as CanvasImageSource) : svgImg(standAlone(el as SVGSVGElement, vb, S)))));
    const frameLayers = await Promise.all(frameTexts.map((texts) => Promise.all(texts.map(svgImg))));
    const inset = Math.round(PAD * px);
    const compose = (swap: CanvasImageSource[] | null) => {
      const c = document.createElement("canvas");
      c.width = c.height = S;
      const g = art2d(c);
      let m = 0;
      layers.forEach((l, i) => {
        const pic = swap && moving.has(els[i]!) ? swap[m++]! : l;
        if (pic === pawn) g.drawImage(pawn, inset, inset, S - 2 * inset, S - 2 * inset);
        else g.drawImage(pic, 0, 0, S, S);
      });
      return c;
    };
    const c = compose(null);
    const g = art2d(c);
    // Its top (a hat rises over the pawn's head): your name tag sits over it.
    const d = g.getImageData(0, 0, S, S).data;
    let first = d.length;
    for (let j = 3; j < d.length; j += 4)
      if (d[j]! > 24) {
        first = j;
        break;
      }
    const art: YouArt = { img: c, pad: PAD, top: Math.floor(first / 4 / S) / S };
    if (spec && frameLayers.length) art.loop = { frames: frameLayers.map((l) => upName(compose(l), "dressed pawn frame")), loopMs: spec.loopMs, fromMs: spec.fromMs, toMs: spec.toMs };
    return art;
  } catch {
    return null;
  } finally {
    render(null, host);
    host.remove();
  }
}

/** The player asks for less motion: no item plays (the CSS animations don't either). */
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
