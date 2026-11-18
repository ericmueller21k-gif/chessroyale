/**
 * The screen as it is, taken as a picture (Folio's crumple, Nov 5: crumple-gl.ts): the page's canvases and its DOM (the header, the chat,
 * the match screen's board and bars), into one canvas `W` x `H` CSS pixels at `dpr`.
 *
 * - **A big canvas** (half the screen or more: the room's) is drawn straight from its pixels at its place, first; in the DOM's picture
 *   it's hidden and its ancestors' backgrounds are see-through, so what's over it (the header, the chat log) lands on it. (Its pixels to
 *   a data URL would cost a phone a few hundred ms.)
 * - **The DOM** is drawn by the browser itself: a copy of the page in an SVG `<foreignObject>` with the page's own style rules, as an
 *   image. Each small canvas in it (a figure beside the board) is put in as a picture of itself, each `<img>` as a data URL (an SVG image
 *   loads nothing from outside), each scrolled box scrolled as it is, the root's custom properties (the theme) set on its copy.
 * - Anything it can't take (a picture from another origin, a background image by URL) is left out, never waited for. The DOM's picture
 *   has a time limit: past it, `snapPage` gives the canvases alone (`dom: false`), so the crumple never waits long on it.
 */

/** The page's style rules as text, made again when a stylesheet is added (a lazily loaded screen's), `:root` read as the copy's `html`. */
let css = { n: -1, text: "" };
function pageCss(): string {
  const sheets = Array.from(document.styleSheets);
  if (sheets.length === css.n) return css.text;
  const parts: string[] = [];
  for (const sh of sheets) {
    try {
      for (const r of Array.from(sh.cssRules)) parts.push(r.cssText);
    } catch {
      // (Another origin's sheet: its rules can't be read. None of the game's.)
    }
  }
  css = { n: sheets.length, text: parts.join("\n").replace(/:root\b/g, "html") };
  return css.text;
}

/** A canvas this big (a share of the screen) is drawn from its pixels rather than put in the DOM's picture. */
const BIG = 0.5;
const XHTML = "http://www.w3.org/1999/xhtml";
/** Our own covers (the transitions' canvases) are never in the picture. */
const COVER = "canvas.boss-crumple, canvas.boss-storm, canvas.boss-wipe, canvas.boss-dark";

const shown = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  const st = getComputedStyle(el);
  return st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity) > 0;
};

/** A picture of an `<img>` (same origin, loaded) as a data URL, or null. */
function imgData(img: HTMLImageElement): string | null {
  if (!img.complete || !img.naturalWidth || img.src.startsWith("data:")) return null;
  try {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return c.toDataURL();
  } catch {
    return null;
  }
}

/**
 * The page's DOM as an SVG image (the big canvases hidden, their ancestors' backgrounds see-through), loaded and decoded; null if it
 * fails or takes longer than `ms`.
 */
async function domImage(W: number, H: number, big: readonly HTMLCanvasElement[], ms: number): Promise<HTMLImageElement | null> {
  const src = document.body;
  const copy = src.cloneNode(true) as HTMLElement;
  // (The copy's elements in the page's order, beside the page's: their canvases, images and scrolled boxes are matched by place.)
  const orig = [src, ...Array.from(src.querySelectorAll("*"))];
  const dup = [copy, ...Array.from(copy.querySelectorAll("*"))];
  if (orig.length !== dup.length) return null;
  const clear = new Set<Element>();
  for (const c of big) for (let e: Element | null = c.parentElement; e; e = e.parentElement) clear.add(e);
  const drop: Element[] = [];
  for (let i = 0; i < orig.length; i++) {
    const o = orig[i]!;
    const d = dup[i]! as HTMLElement;
    if (o.matches(COVER) || o.tagName === "SCRIPT") {
      drop.push(d);
      continue;
    }
    if (clear.has(o)) d.style.setProperty("background", "transparent", "important");
    if (o instanceof HTMLCanvasElement) {
      if (big.includes(o) || !shown(o)) {
        d.style.setProperty("visibility", "hidden", "important");
        continue;
      }
      // (A small canvas: a picture of itself in its place, sized as it is.)
      let url = "";
      try {
        url = o.toDataURL();
      } catch {
        // (Tainted: left out.)
      }
      const im = document.createElementNS(XHTML, "img") as HTMLImageElement;
      for (const a of Array.from(o.attributes)) im.setAttribute(a.name, a.value);
      if (url) im.setAttribute("src", url);
      const st = getComputedStyle(o);
      im.style.width = st.width;
      im.style.height = st.height;
      d.replaceWith(im);
      continue;
    }
    if (o instanceof HTMLImageElement) {
      const url = imgData(o);
      if (url) d.setAttribute("src", url);
    }
    if (o.scrollTop || o.scrollLeft) {
      // (A scrolled box: its children moved as the scroll moves them; the copy can't scroll.)
      d.style.overflow = "hidden";
      for (const ch of Array.from(d.children) as HTMLElement[]) ch.style.translate = `${-o.scrollLeft}px ${-o.scrollTop}px`;
    }
  }
  for (const d of drop) d.remove();
  const html = document.createElementNS(XHTML, "html") as HTMLElement;
  for (const a of Array.from(document.documentElement.attributes)) html.setAttribute(a.name, a.value);
  // (The theme: every custom property as the page's root has it now, whatever the image's own media queries make of the rules.)
  const root = getComputedStyle(document.documentElement);
  const vars: string[] = [];
  for (let i = 0; i < root.length; i++) {
    const k = root[i]!;
    if (k.startsWith("--")) vars.push(`${k}:${root.getPropertyValue(k)}`);
  }
  // (Under the big canvases the page's own background is drawn first, by `compose`: the copy's root and body are see-through then, or
  // they'd cover the canvases' pixels.)
  const see = big.length ? ";background:transparent!important" : "";
  html.setAttribute("style", `${html.getAttribute("style") ?? ""};${vars.join(";")};width:${W}px;height:${H}px;overflow:hidden${see}`);
  if (see) copy.style.setProperty("background", "transparent", "important");
  const head = document.createElementNS(XHTML, "head");
  const style = document.createElementNS(XHTML, "style");
  style.textContent = pageCss();
  head.append(style);
  html.append(head, copy);
  if (scrollY) copy.style.marginTop = `${-scrollY}px`;
  const xml = new XMLSerializer().serializeToString(html);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${xml}</foreignObject></svg>`;
  const img = new Image();
  img.width = W;
  img.height = H;
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  let timer = 0;
  const late = new Promise<null>((ok) => (timer = window.setTimeout(() => ok(null), ms)));
  const got = await Promise.race([img.decode().then(() => img, () => null), late]);
  clearTimeout(timer);
  return got;
}

/** The page's background (its body's, else its root's, else black). */
function pageBg(): string {
  for (const el of [document.body, document.documentElement]) {
    const c = getComputedStyle(el).backgroundColor;
    if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) return c;
  }
  return "#000";
}

/** The page's DOM layer, being taken: the big canvases it leaves out (to be drawn from their pixels), and its picture (null: none). */
export interface DomLayer {
  big: HTMLCanvasElement[];
  img: Promise<HTMLImageElement | null>;
  /** When it was started (performance.now()). */
  at: number;
}
/** Starts taking the page's DOM layer for a W x H screen (its picture, or null past `ms`). */
export function domLayer(W: number, H: number, ms: number): DomLayer {
  const big: HTMLCanvasElement[] = [];
  for (const c of Array.from(document.querySelectorAll("canvas"))) {
    if (c.matches(COVER) || !shown(c)) continue;
    const r = c.getBoundingClientRect();
    if ((r.width * r.height) / (W * H) >= BIG) big.push(c);
  }
  let img: Promise<HTMLImageElement | null>;
  try {
    img = domImage(W, H, big, ms).catch(() => null);
  } catch {
    img = Promise.resolve(null);
  }
  return { big, img, at: performance.now() };
}
/** The picture: the page's background, its big canvases from their pixels now, and the DOM layer (if any) over them. */
export function compose(W: number, H: number, dpr: number, big: readonly HTMLCanvasElement[], dom: HTMLImageElement | null): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = Math.round(W * dpr);
  out.height = Math.round(H * dpr);
  const g = out.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = pageBg();
  g.fillRect(0, 0, W, H);
  for (const c of big) {
    if (!c.isConnected) continue;
    const r = c.getBoundingClientRect();
    try {
      g.drawImage(c, r.left, r.top, r.width, r.height);
    } catch {
      // (A canvas that can't be read: left out.)
    }
  }
  if (dom) g.drawImage(dom, 0, 0, W, H);
  return out;
}
/** The whole page's picture, now (its DOM layer taken first, its big canvases read once that's in); `dom` false if the DOM didn't make it. */
export async function snapPage(W: number, H: number, dpr: number, ms: number): Promise<{ canvas: HTMLCanvasElement; dom: boolean }> {
  const l = domLayer(W, H, ms);
  const img = await l.img;
  return { canvas: compose(W, H, dpr, l.big, img), dom: !!img };
}
