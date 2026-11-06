/**
 * The street town's minimap (Nov 5, brief-street-controls-map.md; minimap.ts draws it): small in the town's top right corner, partly
 * see-through, the whole town from above with your dot; a tap opens it large in the middle of the town's box (Eric: "If you tap the
 * minimap, it comes to the center of your screen … all of Chess Town … put the little icon of which boss is at which shop … the Colosseum,
 * the park … tap it again or tap away, back to normal size"), each boss home with its boss's small portrait (the chips' faces), the
 * Colosseum and the park as small icons, you as the dot; no names. A tap on it or anywhere outside it closes it; it never walks you.
 * The map button in the town's icon row (TownChatTools) turns it off and on (per device; on by default). Street town only.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { TOWN_FEEL } from "./feel.ts";
import { MAP_BOX, MAP_DOTS, MapDot, colosseumPoint, drawMap, mapHeight, mapOn, mapPoint, mapScale, onMapOn, parkPoint } from "./minimap.ts";

/** A home's portrait on the large map: where (in squares), its ring's color, and its face (the chip's: its boss's first idle frame). */
export interface MapFace {
  id: string;
  x: number;
  y: number;
  color: string;
  img: HTMLCanvasElement;
  box: readonly [x: number, y: number, size: number];
}

/** Whether the map shows now, redrawing when it's turned. */
export function useMapOn(): boolean {
  const [v, set] = useState(mapOn);
  useEffect(() => {
    set(mapOn());
    return onMapOn(() => set(mapOn()));
  }, []);
  return v;
}

/** Draws the map onto `cv` at `w` css px wide (its device pixels too). Once a size. */
function paint(cv: HTMLCanvasElement, w: number): number {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const h = mapHeight(w);
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  const g = cv.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = mapScale(w);
  drawMap(g, s);
  return s;
}

export function TownMap({ hidden, faces }: { hidden: boolean; faces: () => MapFace[] }) {
  const on = useMapOn();
  const [big, setBig] = useState(false);
  const [boxSize, setBoxSize] = useState<{ w: number; h: number; computer: boolean }>({ w: 0, h: 0, computer: false });
  /** The chat's box (in the town's box) as last laid out: the map keeps clear of it (null: the chat isn't showing). */
  const [chat, setChat] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const small = useRef<HTMLButtonElement>(null);
  const smallCv = useRef<HTMLCanvasElement>(null);
  const smallYou = useRef<HTMLDivElement>(null);
  const bigCv = useRef<HTMLCanvasElement>(null);
  const bigYou = useRef<HTMLDivElement>(null);
  const show = on && !hidden;
  // The town's box: its size, and whether it's a computer's (in the front door's frame).
  useLayoutEffect(() => {
    const box = anchor.current?.closest<HTMLElement>(".town-box");
    if (!box) return;
    const computer = !!box.closest(".town-screen.in-frame");
    const chatEl = box.querySelector<HTMLElement>(".town-chat");
    const measure = () => {
      setBoxSize((o) => (o.w === box.clientWidth && o.h === box.clientHeight && o.computer === computer ? o : { w: box.clientWidth, h: box.clientHeight, computer }));
      // (The chat's box as laid out: its size changes as it shows, hides or the box resizes. A chat carried over the map is the player's
      // choice: the map doesn't chase it.)
      const c = chatEl?.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const next = c && c.width > 0 ? { x: Math.round(c.left - b.left), y: Math.round(c.top - b.top), w: Math.round(c.width), h: Math.round(c.height) } : null;
      setChat((o) => (o === next || (o && next && o.x === next.x && o.y === next.y && o.w === next.w && o.h === next.h) ? o : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    if (chatEl) ro.observe(chatEl);
    return () => ro.disconnect();
  }, []);
  const f = TOWN_FEEL;
  const sw = Math.round(Math.min(f.mapMaxPx, Math.max(72, boxSize.w * (boxSize.computer ? f.mapShareComputer : f.mapShare))));
  const sh = mapHeight(sw);
  // Its top: the box's top right corner; where the chat's box reaches over that corner (a narrow computer frame, where the chat takes the
  // whole top), just under the chat instead, on the same right edge.
  const GAP = 8;
  const mapLeft = boxSize.w - GAP - sw - 2 * GAP;
  const top = chat && chat.y < GAP + sh + GAP && chat.x + chat.w > mapLeft ? chat.y + chat.h + GAP : GAP;
  // The small map: drawn once a size; its box kept for the chips and the test hooks (zero while it doesn't show).
  useLayoutEffect(() => {
    if (!show || !boxSize.w) {
      MAP_BOX.w = MAP_BOX.h = 0;
      return;
    }
    const s = paint(smallCv.current!, sw);
    const dot = new MapDot(smallYou.current!, s);
    MAP_DOTS.add(dot);
    const el = small.current!;
    const box = el.closest<HTMLElement>(".town-box")!;
    const a = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    Object.assign(MAP_BOX, { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height });
    return () => {
      MAP_DOTS.delete(dot);
      MAP_BOX.w = MAP_BOX.h = 0;
    };
  }, [show, sw, top, boxSize.w, boxSize.h]);
  // The large map: the whole town in the middle of the box, as big as it fits.
  const bw0 = Math.min(f.mapBigMaxPx, Math.floor(Math.min(boxSize.w, boxSize.h) * f.mapBigShare));
  const bw = mapHeight(bw0) > boxSize.h * f.mapBigShare ? Math.floor((bw0 * boxSize.h * f.mapBigShare) / mapHeight(bw0)) : bw0;
  const bs = mapScale(bw);
  useLayoutEffect(() => {
    if (!big || !bw) return;
    paint(bigCv.current!, bw);
    const dot = new MapDot(bigYou.current!, bs);
    MAP_DOTS.add(dot);
    return () => void MAP_DOTS.delete(dot);
  }, [big, bw]);
  // (Escape closes the large map; turning the map off or going inside closes it too.)
  useEffect(() => {
    if (!big) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setBig(false);
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [big]);
  useEffect(() => {
    if (!show) setBig(false);
  }, [show]);
  const pt = { x: 0, y: 0 };
  const iconPx = Math.round(Math.max(18, Math.min(34, bs * 2.8)));
  const park = (parkPoint(bs, pt), { ...pt });
  const col = (colosseumPoint(bs, pt), { ...pt });
  return (
    <div class="tm-root" ref={anchor}>
      {show && (
        <button type="button" class="tm-small" ref={small} aria-label="Open the map" style={{ top: `${top}px`, width: `${sw}px`, height: `${sh}px`, opacity: f.mapOpacity }} onClick={() => setBig(true)}>
          <canvas ref={smallCv} aria-hidden="true" />
          <div class="tm-you" ref={smallYou} aria-hidden="true" />
        </button>
      )}
      {big && show && (
        <div class="tm-scrim" role="dialog" aria-label="Map of the town" onClick={() => setBig(false)}>
          <div class="tm-big" style={{ width: `${bw}px`, height: `${mapHeight(bw)}px` }}>
            <canvas ref={bigCv} aria-hidden="true" />
            {faces().map((m) => {
              mapPoint(m.x, m.y, bs, pt);
              return <Face key={m.id} face={m} x={pt.x} y={pt.y} size={Math.round(Math.max(20, Math.min(40, bs * 3.4)))} />;
            })}
            <ParkIcon x={park.x} y={park.y} size={iconPx} />
            <ColosseumIcon x={col.x} y={col.y} size={iconPx} />
            <div class="tm-you tm-you-big" ref={bigYou} aria-hidden="true" />
          </div>
        </div>
      )}
    </div>
  );
}

/** A boss's portrait in a ring of its home's color, as its chip shows it (drawn once, as the large map opens). */
function Face({ face, x, y, size }: { face: MapFace; x: number; y: number; size: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = cv.current!;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * dpr);
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    g.drawImage(face.img, face.box[0], face.box[1], face.box[2], face.box[2], 0, 0, c.width, c.height);
  }, [face.img, size]);
  return (
    <div class="tm-face" data-home={face.id} style={{ left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`, "--town-chip": face.color } as Record<string, string>}>
      <canvas ref={cv} aria-hidden="true" />
    </div>
  );
}

/** The park: a round tree on a lawn (small, no words). */
function ParkIcon({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <svg class="tm-icon tm-park" data-icon="park" viewBox="0 0 24 24" width={size} height={size} style={{ left: `${x}px`, top: `${y}px` }} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#f6f1e4" stroke="#3d6b2c" stroke-width="1.5" />
      <rect x="10.9" y="12.5" width="2.2" height="6.5" rx="0.8" fill="#7a5130" />
      <circle cx="12" cy="10" r="5.4" fill="#4f9a3a" />
      <circle cx="9.6" cy="11.6" r="3" fill="#5fae47" />
      <circle cx="14.5" cy="11.4" r="3.2" fill="#458a33" />
    </svg>
  );
}

/** The Colosseum: its arches, small, on its band (no words). */
function ColosseumIcon({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <svg class="tm-icon tm-col" data-icon="colosseum" viewBox="0 0 24 24" width={size} height={size} style={{ left: `${x}px`, top: `${y}px` }} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#f6f1e4" stroke="#6f5530" stroke-width="1.5" />
      <path d="M4.5 17.5V9.2C4.5 7.7 8 6.4 12 6.4s7.5 1.3 7.5 2.8v8.3z" fill="#d8bd86" stroke="#6f5530" stroke-width="1" />
      <path d="M4.5 12.4h15" stroke="#6f5530" stroke-width="0.9" />
      <path d="M6.6 17.5v-2.6a1.1 1.1 0 0 1 2.2 0v2.6M10.9 17.5v-2.6a1.1 1.1 0 0 1 2.2 0v2.6M15.2 17.5v-2.6a1.1 1.1 0 0 1 2.2 0v2.6" fill="#6f5530" />
      <path d="M6.6 11.2v-1.3a1.1 1.1 0 0 1 2.2 0v1.3M10.9 11.2v-1.3a1.1 1.1 0 0 1 2.2 0v1.3M15.2 11.2v-1.3a1.1 1.1 0 0 1 2.2 0v1.3" fill="#6f5530" />
    </svg>
  );
}
