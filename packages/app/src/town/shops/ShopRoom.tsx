/**
 * Inside a shop (Nov 2, round 1: Babur's circus tent and Puddles' greenhouse; docs/decisions/2026-11-02-shop-interiors-r1.md).
 * Loaded only when you go in (the town imports it with a dynamic `import()`, and each room's art is its own chunk after that).
 *
 * The room (20 x 20 squares, the art's layout: shops/babur-art.ts, shops/puddles-art.ts) is drawn as the approved mockup drew it
 * (scripts/boss-art/shop-view.ts on claude/boss-art): through the town's own camera (camera.ts), the floor tiles laid flat on
 * their squares (baked once into one picture, drawn as two triangles a block), each upright piece stood at its foot at the town's
 * scale (37 px a square), a deep piece drawn as a plan (Puddles' pond garden) lying flat on its squares with the strip above its
 * north row standing up, the Shopkeeper (the boss's kid, its idle playing, a blue "Shopkeeper" tag) and you, far to near; a tent's
 * canvas or a greenhouse's glass above the walls. Animated pieces loop (the fire hoops, the pond, the palm, the fountain, the
 * crate). You start in Close (SHOP_FEEL.close, the third-person camera); the town's − / + switch between Close and the town's
 * zoomed-in camera. Inside is just you: the town's bots and other players don't come in.
 *
 * Your ride comes in with you (Eric, Nov 2: "your rider goes in with you"; SHOP_FEEL.rideInside): the town's own rider, its frames
 * composed as the town drew them (town/rides.ts: the ride at its scale, 0.75 of the pawn), drawn under you at the room's camera,
 * its idle standing and its move walking, its side, back or front the way you go, at its own pace (RIDES.speed); you go out still
 * on it. No ride (or rideInside false: the ride waits outside, as round 1 had it): on foot.
 *
 * You walk by tapping, as in the town (one square at a time, round what's solid: shops/room.ts); a drag looks around and the focus
 * button brings the camera back. Standing within talking range of the Shopkeeper, its card ("Shopkeeper", Talk) shows; Talk opens
 * the crate's card (its picture, its prizes, the price, what you have, and the two ways to buy, through `buyBossCrate`: round 2, the
 * server's purchase, into your inventory since Nov 2; a way you can't pay is greyed, and the answer shows under them). Standing
 * just inside the way out, a card says "Go out".
 *
 * One requestAnimationFrame loop draws everything on one canvas (Canvas 2D); it stops when you go out or the tab is hidden. Every
 * frame of every piece is drawn into a canvas of its own as the room loads (behind the black fade), never in the loop.
 * Test hooks (test switches on): the canvas's `data-room` (its home), `data-you="c,r"`, `data-ready="1"`; `window.__shopAt("keeper"
 * | "door" | "square", [c, r]?)` where to tap; `__shopCam()` the camera (its zoom: 0 Close, 1 the town's); `__shopBench(n)` ms a draw.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { onAccountChange } from "../../account.ts";
import { renderFrame, type Character } from "../../characters/sprite.ts";
import { testSwitchesAllowed } from "../../test-switches.ts";
import { newPt, newView, proj, setView, type CamPair } from "../camera.ts";
import { SHOP_FEEL, TOWN_FEEL, type CamSet } from "../feel.ts";
import type { LightPool, LightSpot } from "../houses/kit.ts";
import { Press } from "../press.ts";
import { PAWN_HEAD, PAWN_PATH, type YouArt } from "../render.ts";
import { SIDEKICK_SHEETS, type SidekickSheet } from "../sidekick-sheets.ts";
import { TAG_STYLE, type TagKind } from "../tags.ts";
import { Walker, type HomeId } from "../world.ts";
import type { Rider } from "../rides.ts";
import { rideSpeed } from "../../components/rides/scale.ts";
import { inTalkRange, isFloor, makeRoom, onDoor, tapTarget, findPath, type Room, type ShopPlace, type Sq } from "./room.ts";
import { POOL_LINE, bossHoldings, buyBossCrate, canAfford, holdLine, priceLine, prizeRows, shopOf, wayText, type CrateWay, type ShopDef } from "./shops.ts";

/** A room's art, as its file exports it. */
interface RoomArt {
  layout: readonly ShopPlace[];
  pieces: Readonly<Record<string, Character>>;
  /** Where the crate sits on the counter, in the counter's pixels. */
  crateAt: readonly [number, number];
  lights: readonly (LightSpot & { piece: string })[];
  pools: readonly (LightPool & { piece: string })[];
}
const ART: Partial<Record<HomeId, () => Promise<RoomArt>>> = {
  tiger: () => import("./babur-art.ts").then((m) => ({ layout: m.SHOP_BABUR_LAYOUT, pieces: m.SHOP_BABUR_PIECES, crateAt: m.SHOP_BABUR_CRATE_AT, lights: m.SHOP_BABUR_HOOP_LIGHTS, pools: m.SHOP_BABUR_HOOP_POOLS })),
  gardener: () => import("./puddles-art.ts").then((m) => ({ layout: m.SHOP_PUDDLES_LAYOUT, pieces: m.SHOP_PUDDLES_PIECES, crateAt: m.SHOP_PUDDLES_CRATE_AT, lights: [], pools: [] })),
  alfil: () => import("./alfil-art.ts").then((m) => ({ layout: m.SHOP_ALFIL_LAYOUT, pieces: m.SHOP_ALFIL_PIECES, crateAt: m.SHOP_ALFIL_CRATE_AT, lights: m.SHOP_ALFIL_LIGHTS, pools: m.SHOP_ALFIL_POOLS })),
};

/** A piece's frames, each drawn once into a canvas, and when each ends in its loop. */
interface Frames {
  ch: Character;
  frames: HTMLCanvasElement[];
  ends: number[];
  loop: number;
}
/** A room ready to draw: its art and every piece's frames (made as it loads, behind the fade). */
export interface LoadedRoom {
  def: ShopDef;
  art: RoomArt;
  frames: Record<string, Frames>;
  /** The kid's sheet (its picture loaded). */
  kid: { sheet: SidekickSheet; img: HTMLImageElement };
}

const toCanvas = (ch: Character, i: number): HTMLCanvasElement => {
  const { w, h, data } = renderFrame(ch, ch.anims.idle!.frames[i]!);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  return c;
};
const SHEET_URL: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>("../sidekicks/*.png", { eager: true, query: "?url", import: "default" })).map(([path, url]) => [path.replace(/^.*\/|\.png$/g, ""), url]),
);
const loading = new Map<HomeId, Promise<LoadedRoom>>();
/** Loads a home's room (its art's chunk, every piece's frames drawn, the kid's sheet), once. */
export function loadRoom(home: HomeId): Promise<LoadedRoom> {
  let p = loading.get(home);
  if (p) return p;
  const def = shopOf(home)!;
  const sheet = SIDEKICK_SHEETS[def.kid];
  const img = new Image();
  const kid = new Promise<void>((ok, no) => {
    img.onload = () => ok();
    img.onerror = () => no(new Error(`the ${def.kid} sheet didn't load`));
    img.src = SHEET_URL[def.kid]!;
  });
  p = Promise.all([ART[home]!(), kid]).then(([art]) => {
    const frames: Record<string, Frames> = {};
    for (const [name, ch] of Object.entries(art.pieces)) {
      const idle = ch.anims.idle!;
      let t = 0;
      const ends = idle.frames.map((f) => (t += Math.max(16, f.ms)));
      frames[name] = { ch, frames: idle.frames.map((_, i) => toCanvas(ch, i)), ends, loop: t };
    }
    return { def, art, frames, kid: { sheet, img } };
  });
  p.catch(() => loading.delete(home));
  loading.set(home, p);
  return p;
}

/** The card open inside: the Shopkeeper's, the crate's, or the way out's. */
export type ShopCard = "talk" | "crate" | "door";

/** What the town's buttons and back button do while you're inside. */
export interface ShopCtl {
  zoom: (out: boolean) => void;
  recenter: () => void;
}

export function ShopRoom({ room, youArt, youRider, youName, onZoom, onOut, onReady, ctl }: { room: LoadedRoom; youArt: () => YouArt | null; /** The town's rider you're on (its frames ready), or null: on foot. */ youRider: () => Rider | null; youName: () => string; onZoom: (out: boolean) => void; onOut: () => void; onReady: () => void; ctl: { current: ShopCtl | null } }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cardEl = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<ShopCard | null>(null);
  const [msg, setMsg] = useState("");
  const eng = useRef<ReturnType<typeof startRoom> | null>(null);
  const { def } = room;
  useLayoutEffect(() => {
    const r = (eng.current = startRoom(box.current!, canvas.current!, cardEl.current!, room, youArt, youRider, youName, onZoom, (c) => {
      setCard(c);
      setMsg("");
    }));
    ctl.current = r;
    onReady();
    return () => {
      ctl.current = null;
      r.stop();
    };
  }, []);
  // What you hold: your locker's, as the server last said (a buy, a token from a battle, an admin's grant), drawn again with it.
  const [, accountChanged] = useState(0);
  useEffect(() => onAccountChange(() => accountChanged((n) => n + 1)), []);
  const [busy, setBusy] = useState(false);
  const buy = (way: CrateWay) => {
    if (busy) return;
    setBusy(true);
    setMsg("");
    void buyBossCrate(def.home, way).then((res) => {
      setBusy(false);
      setMsg(res.message);
    });
  };
  const held = bossHoldings(def.home);
  const label = card === "talk" ? "Shopkeeper" : card === "crate" ? def.crate : card === "door" ? "Door" : undefined;
  return (
    <div class="town-shop" ref={box}>
      <canvas class="town-shop-canvas" ref={canvas} aria-label={`Inside ${def.boss}'s shop`} />
      <div class={card === "crate" ? "town-card shop-crate" : "town-card"} ref={cardEl} role="dialog" aria-label={label} style={{ display: card ? "" : "none" }}>
        {card === "talk" && (
          <>
            <h2>Shopkeeper</h2>
            <button type="button" class="town-btn primary" onClick={() => eng.current?.show("crate")}>
              Talk
            </button>
          </>
        )}
        {card === "door" && (
          <button type="button" class="town-btn primary" onClick={onOut}>
            Go out
          </button>
        )}
        {card === "crate" && (
          <>
            <h2>{def.crate}</h2>
            <div class="shop-crate-top">
              <CratePic frames={room.frames["crate"]!} />
              <div class="shop-prizes">
                <p class="shop-label">Prizes</p>
                <ul>
                  {prizeRows(def).map((p) => (
                    <li key={p.id}>
                      <span class="shop-prize-name">{p.name}</span>
                      <span class="shop-prize-kind">
                        <i style={{ background: p.color }} />
                        {p.kind}
                      </span>
                    </li>
                  ))}
                  <li class="shop-pool">{POOL_LINE}</li>
                </ul>
              </div>
            </div>
            <p class="shop-price">{priceLine(def)}</p>
            <p class="shop-hold">{holdLine(def, held)}</p>
            {/* (A way you can't pay is greyed, not hidden; the server checks again.) */}
            <button type="button" class="town-btn primary" disabled={busy || !canAfford(held, "tokens")} onClick={() => buy("tokens")}>
              Buy with {wayText(def, "tokens")}
            </button>
            <button type="button" class="town-btn" disabled={busy || !canAfford(held, "key")} onClick={() => buy("key")}>
              Buy with {wayText(def, "key")}
            </button>
            {/* (Its row is always there, its height kept, empty until a buy answers: nothing moves. A crate bought goes into your
                inventory, unopened: "Babur's Boss Crate is in your inventory." (Eric, Nov 2); the Crates tab opens it.) */}
            <div class="town-soon shop-msg" aria-live="polite">
              <span>{msg}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The crate's picture on its card: its first idle frame, three times its size, crisp. */
function CratePic({ frames }: { frames: Frames }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current!;
    const src = frames.frames[0]!;
    c.width = src.width * 3;
    c.height = src.height * 3;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
  }, [frames]);
  return <canvas class="shop-crate-pic" ref={ref} aria-hidden="true" />;
}

/** A Walker's view (the town's: 1 up the screen, its rows running away from the camera) as a room draws it (rows toward the camera). */
const roomView = (v: 0 | 1 | 2): 0 | 1 | 2 => (v === 1 ? 2 : v === 2 ? 1 : 0);

/** The pawn's base's foot down its box (render.ts's PAWN_FOOT: the path's bottom at y 39.5, and half its outline). */
const PAWN_FOOT = (39.5 + 0.75) / 45;
const SHADOW = "rgb(60,35,10)";
const PAWN = new Path2D(PAWN_PATH);
const CAM_KEYS = ["h", "back", "th", "cy"] as const;

/** An upright thing in the room, drawn at its foot, sorted far to near by `z` (its row). */
interface Up {
  name: string;
  /** Its foot: a square (fractions allowed). */
  c: number;
  r: number;
  z: number;
  /** Moved from its foot this many of its pixels (the crate on the counter). */
  ox: number;
  oy: number;
  flip: boolean;
  /** Only this strip of its picture, from its top (a deep piece's part that stands up): its height in pixels; 0 = all. */
  cut: number;
}

/** Runs the room in `box` on `cv`: the loop, the camera, the input and the cards. Returns its controls and its stop. */
function startRoom(
  box: HTMLDivElement,
  cv: HTMLCanvasElement,
  cardEl: HTMLDivElement,
  loaded: LoadedRoom,
  youArt: () => YouArt | null,
  youRider: () => Rider | null,
  youName: () => string,
  onZoom: (out: boolean) => void,
  onCard: (c: ShopCard | null) => void,
) {
  const f = TOWN_FEEL;
  const S = SHOP_FEEL;
  const SQ = f.housePxPerSquare;
  const { def, art, frames } = loaded;
  const room: Room = makeRoom(art.layout, def.keeper);
  const n = room.n;
  const g = cv.getContext("2d")!;
  const you = new Walker(room.start, f.youStepMs, true, f.walkEase);
  // (Facing the counter, north: away from the camera. The Walker's views are the town's, whose rows run away from the camera;
  // a room's run toward it, so its back and front swap: roomView.)
  you.view = 2;
  /** The rider drawn inside now (your ride's, its frames ready; SHOP_FEEL.rideInside), or null: on foot. */
  const riding = (): Rider | null => {
    if (!S.rideInside) return null;
    const rd = youRider();
    return rd?.ready ? rd : null;
  };
  /** The test hook's view of your ride (as the town's `youRide`): its animation and frame drawn last, its side, its view. */
  const seen = { ride: null as string | null, anim: "" as "" | "idle" | "move", frame: -1, facing: 1, view: 0 };

  // ---- The floor, baked once: every tile (turned as the layout says) into one picture of the whole room, n x n squares.
  const floor = document.createElement("canvas");
  floor.width = floor.height = n * SQ;
  {
    const fg = floor.getContext("2d")!;
    fg.imageSmoothingEnabled = false;
    for (const p of art.layout) {
      if (!isFloor(p.name)) continue;
      const img = frames[p.name]!.frames[0]!;
      fg.save();
      fg.translate(p.col * SQ + SQ / 2, p.row * SQ + SQ / 2);
      fg.rotate(((p.rot ?? 0) * Math.PI) / 2);
      fg.drawImage(img, -img.width / 2, -img.height / 2);
      fg.restore();
    }
  }
  // ---- The upright things, far to near; and the deep pieces drawn as plans, which lie flat on their squares.
  const ups: Up[] = [];
  const flats: ShopPlace[] = [];
  const counter = art.layout.find((p) => p.name === "counter");
  for (const p of art.layout) {
    if (isFloor(p.name)) continue;
    const w = p.w ?? 1;
    const d = p.d ?? 1;
    const ch = art.pieces[p.name]!;
    if (d > 1) {
      // The plan lies flat on its w x d squares; the strip above its north row (its plants' tops) stands up there.
      flats.push(p);
      const rise = ch.h - d * SQ;
      if (rise > 0) ups.push({ name: p.name, c: p.col + (w - 1) / 2, r: p.row - d + 0.5, z: p.row - d + 0.5, ox: 0, oy: ch.foot[1] - rise + 1, flip: false, cut: rise });
      continue;
    }
    if (p.name === "crate" && counter) {
      // On the counter, at the art's place for it in the counter's pixels; drawn just after the counter.
      const cp = art.pieces["counter"]!;
      ups.push({ name: p.name, c: counter.col + ((counter.w ?? 1) - 1) / 2, r: counter.row, z: counter.row + 0.01, ox: art.crateAt[0] - cp.foot[0], oy: art.crateAt[1] - cp.foot[1], flip: false, cut: 0 });
      continue;
    }
    ups.push({ name: p.name, c: p.col + (w - 1) / 2, r: p.row, z: p.row, ox: 0, oy: 0, flip: !!p.flip, cut: 0 });
  }
  ups.sort((a, b) => a.z - b.z);

  // ---- The glow of a fire (Babur's hoops): one soft round sprite per color, made once, stretched into each pool and halo.
  const glowOf = new Map<string, HTMLCanvasElement>();
  const glow = (color: string) => {
    let c = glowOf.get(color);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = 64;
    const gg = c.getContext("2d")!;
    const grad = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    gg.fillStyle = grad;
    gg.fillRect(0, 0, 64, 64);
    glowOf.set(color, c);
    return c;
  };
  for (const l of [...art.pools, ...art.lights]) glow(l.color);
  const upOf = new Map(ups.map((u) => [u.name, u]));

  // ---- Tags: each drawn once (its pill and its words), stamped every frame.
  const tagArt = new Map<string, HTMLCanvasElement>();
  const tag = (text: string, kind: TagKind) => {
    const key = `${kind}|${text}|${DPR}`;
    let c = tagArt.get(key);
    if (c) return c;
    c = document.createElement("canvas");
    const tg = c.getContext("2d")!;
    const s = 12;
    const font = `600 ${s}px Archivo, system-ui, sans-serif`;
    tg.font = font;
    const w = tg.measureText(text).width + s * 1.25;
    const h = s + (8 * s) / 11;
    c.width = Math.ceil((w + 8) * DPR);
    c.height = Math.ceil((h + 8) * DPR);
    tg.scale(DPR, DPR);
    const { pill, ink } = TAG_STYLE[kind];
    tg.shadowColor = "rgba(0,0,0,.25)";
    tg.shadowBlur = 4;
    tg.fillStyle = pill;
    tg.beginPath();
    tg.roundRect(4, 4, w, h, h / 2);
    tg.fill();
    tg.shadowColor = "transparent";
    tg.font = font;
    tg.textAlign = "center";
    tg.textBaseline = "middle";
    tg.fillStyle = ink;
    tg.fillText(text, 4 + w / 2, 4 + h / 2);
    tagArt.set(key, c);
    return c;
  };

  // ---- The camera: Close (0) to the town's zoomed-in camera (1), following you as the town's does.
  const v = newView();
  const tall: CamSet = { ...f.camTall };
  const wide: CamSet = { ...f.camWide };
  const sets: CamPair = { tall, wide };
  let zoomCur = 0;
  let zoomTarget = 0;
  let camX = you.c;
  let camY = you.r;
  let vx = 0;
  let vy = 0;
  let follow = true;
  const pt = newPt();
  const pq = [newPt(), newPt(), newPt(), newPt()];
  const P = (c: number, r: number, out = pt) => proj(v, c - camX, camY - r, 0, out);

  let W = 1;
  let H = 1;
  let DPR = 1;
  /** Above the walls: the tent's canvas or the greenhouse's glass, drawn once for the box's size (as the mockup drew it). */
  const roof = document.createElement("canvas");
  const drawRoof = () => {
    roof.width = Math.round(W * DPR);
    roof.height = Math.round(H * DPR);
    const rg = roof.getContext("2d")!;
    rg.scale(DPR, DPR);
    if (def.roof === "glass") {
      const sky = rg.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#9fd0e6");
      sky.addColorStop(1, "#d9eef2");
      rg.fillStyle = sky;
      rg.fillRect(0, 0, W, H);
      rg.strokeStyle = "#f4f2ea";
      rg.lineWidth = 3;
      for (let i = -12; i <= 12; i++) {
        rg.beginPath();
        rg.moveTo(W / 2 + i * W * 0.05, -H * 0.5);
        rg.lineTo(W / 2 + i * W * 0.18, H * 0.45);
        rg.stroke();
      }
      for (const y of [H * 0.06, H * 0.15, H * 0.26]) {
        rg.beginPath();
        rg.moveTo(0, y);
        rg.lineTo(W, y);
        rg.stroke();
      }
      return;
    }
    if (def.roof === "stone") {
      // A pyramid's sandstone ceiling (as the mockup drew it): warm stone, darker toward the top, its beams running up to a point.
      const sky = rg.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#5a3f22");
      sky.addColorStop(1, "#b88d56");
      rg.fillStyle = sky;
      rg.fillRect(0, 0, W, H);
      rg.strokeStyle = "#7d5c33";
      rg.lineWidth = 4;
      for (let i = -12; i <= 12; i++) {
        rg.beginPath();
        rg.moveTo(W / 2 + i * W * 0.05, -H * 0.5);
        rg.lineTo(W / 2 + i * W * 0.18, H * 0.45);
        rg.stroke();
      }
      return;
    }
    const sky = rg.createLinearGradient(0, 0, 0, H * 0.5);
    sky.addColorStop(0, "#2a0d10");
    sky.addColorStop(1, "#5a1a1e");
    rg.fillStyle = sky;
    rg.fillRect(0, 0, W, H);
    // The big top's canvas stripes, running up to a peak above the screen.
    for (let i = -24; i <= 24; i++) {
      const x0 = W / 2 + i * W * 0.09;
      rg.beginPath();
      rg.moveTo(W / 2, -H * 0.9);
      rg.lineTo(x0, H * 0.45);
      rg.lineTo(x0 + W * 0.09, H * 0.45);
      rg.closePath();
      const st = rg.createLinearGradient(0, 0, 0, H * 0.45);
      st.addColorStop(0, i & 1 ? "#1c0a0b" : "#2a1512");
      st.addColorStop(1, i & 1 ? "#6e1a20" : "#8a7a68");
      rg.fillStyle = st;
      rg.fill();
    }
  };
  const resize = () => {
    const rc = box.getBoundingClientRect();
    const w = Math.max(1, rc.width);
    const h = Math.max(1, rc.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === W && h === H && dpr === DPR) return false;
    if (dpr !== DPR) tagArt.clear();
    W = w;
    H = h;
    DPR = dpr;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
    drawRoof();
    return true;
  };

  /** A source triangle of `img` (u, v pixels) onto a screen triangle, clipped to it (a hair wider, so no seam shows). */
  const tri = (img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, u0: number, v0: number, u1: number, v1: number, u2: number, v2: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
    const cx = (x0 + x1 + x2) / 3;
    const cy = (y0 + y1 + y2) / 3;
    g.save();
    g.beginPath();
    g.moveTo(x0 + Math.sign(x0 - cx) * 0.6, y0 + Math.sign(y0 - cy) * 0.6);
    g.lineTo(x1 + Math.sign(x1 - cx) * 0.6, y1 + Math.sign(y1 - cy) * 0.6);
    g.lineTo(x2 + Math.sign(x2 - cx) * 0.6, y2 + Math.sign(y2 - cy) * 0.6);
    g.closePath();
    g.clip();
    const den = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
    const a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / den;
    const b = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / den;
    const c = (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / den;
    const d = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / den;
    const e = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / den;
    const ff = (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / den;
    g.transform(a, d, b, e, c, ff);
    // (Only the block's own pixels, a pixel round them: not the whole picture.)
    g.drawImage(img, sx - 1, sy - 1, sw + 2, sh + 2, sx - 1, sy - 1, sw + 2, sh + 2);
    g.restore();
  };
  /**
   * A flat picture laid on squares (c0, r0) to (c0 + nc - 1, r0 + nr - 1), its pixel (sx, sy) at the first square's north-west
   * corner, `SQ` pixels a square: in blocks of `floorBlock` squares, a block drawn large near the camera split into single squares.
   */
  const flat = (img: HTMLCanvasElement, sx: number, sy: number, c0: number, r0: number, nc: number, nr: number, B: number) => {
    for (let br = r0; br < r0 + nr; br += B)
      for (let bc = c0; bc < c0 + nc; bc += B) {
        const bw = Math.min(B, c0 + nc - bc);
        const bh = Math.min(B, r0 + nr - br);
        const [a, b, c, d] = pq as [typeof pt, typeof pt, typeof pt, typeof pt];
        if (!P(bc - 0.5, br - 0.5, a) || !P(bc + bw - 0.5, br - 0.5, b) || !P(bc + bw - 0.5, br + bh - 0.5, c) || !P(bc - 0.5, br + bh - 0.5, d)) {
          if (B > 1) flat(img, sx + (bc - c0) * SQ, sy + (br - r0) * SQ, bc, br, bw, bh, 1);
          continue;
        }
        const x0 = Math.min(a.x, b.x, c.x, d.x);
        const x1 = Math.max(a.x, b.x, c.x, d.x);
        const y0 = Math.min(a.y, b.y, c.y, d.y);
        const y1 = Math.max(a.y, b.y, c.y, d.y);
        if (x1 < 0 || x0 > W || y1 < 0 || y0 > H) continue;
        if (B > 1 && (bw > 1 || bh > 1) && y1 - y0 > S.floorSplitPx) {
          flat(img, sx + (bc - c0) * SQ, sy + (br - r0) * SQ, bc, br, bw, bh, 1);
          continue;
        }
        const u0 = sx + (bc - c0) * SQ;
        const v0 = sy + (br - r0) * SQ;
        const u1 = u0 + bw * SQ;
        const v1 = v0 + bh * SQ;
        tri(img, u0, v0, bw * SQ, bh * SQ, u0, v0, u1, v0, u1, v1, a.x, a.y, b.x, b.y, c.x, c.y);
        tri(img, u0, v0, bw * SQ, bh * SQ, u0, v0, u1, v1, u0, v1, a.x, a.y, c.x, c.y, d.x, d.y);
      }
  };
  /** A piece's frame now (all frames of a room share one clock, as the art's loops are drawn to). */
  const frameAt = (name: string, now: number): HTMLCanvasElement => {
    const fr = frames[name]!;
    if (fr.frames.length === 1) return fr.frames[0]!;
    const t = now % fr.loop;
    let i = 0;
    while (i < fr.ends.length - 1 && t >= fr.ends[i]!) i++;
    return fr.frames[i]!;
  };
  /** Where things were drawn in the last frame (taps, cards, tests): the kid's box and the head points. */
  const kidBox = { x0: 0, y0: 0, x1: 0, y1: 0, on: false, hx: 0, hy: 0 };
  const youHead = { x: 0, y: 0, on: false };
  const dest = { c: 0, r: 0, on: false };
  const pose = { x: 0, y: 0, hop: 0, tilt: 0, step: false, t: 0 };
  const sheet = loaded.kid.sheet;
  const kidSquares = f.sidekickSquares / (sheet.foot[1] / sheet.h - sheet.top.idle / sheet.h);
  let kidT = 0;
  const kidEnds = sheet.ms.idle.map((ms) => (kidT += Math.max(16, ms)));

  const drawUp = (u: Up, now: number) => {
    if (!P(u.c, u.r)) return;
    // Near the camera (between it and you, up close: the front wall as you stand at the door) a piece fades out, so it never fills
    // the screen in front of you.
    const near = (pt.depth - S.nearGone) / (S.nearFull - S.nearGone);
    if (near <= 0) return;
    const img = frameAt(u.name, now);
    const ch = frames[u.name]!.ch;
    const s = pt.k / SQ;
    const fx = u.flip ? ch.w - 1 - ch.foot[0] : ch.foot[0];
    const h = u.cut || img.height;
    const x = pt.x + (u.ox - fx) * s;
    const y = pt.y + (u.oy - ch.foot[1]) * s;
    const w = img.width * s;
    if (x > W || x + w < 0 || y > H || y + h * s < 0) return;
    g.globalAlpha = Math.min(1, near);
    if (u.flip) {
      g.save();
      g.translate(x + w, y);
      g.scale(-1, 1);
      g.drawImage(img, 0, 0, img.width, h, 0, 0, w, h * s);
      g.restore();
    } else g.drawImage(img, 0, 0, img.width, h, x, y, w, h * s);
    g.globalAlpha = 1;
  };
  const shadows = (x: number, y: number, k: number, pawnW: number) => {
    g.fillStyle = SHADOW;
    g.globalAlpha = f.shadowAlpha;
    g.beginPath();
    g.ellipse(x, y, Math.min(pawnW * 0.42, k * 0.42), k * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = f.contactShadowAlpha;
    g.beginPath();
    g.ellipse(x, y, pawnW * f.contactShadowW, k * f.contactShadowDepth, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  };
  const drawKid = (now: number) => {
    kidBox.on = false;
    if (!P(def.at[0], def.at[1])) return;
    const s = (kidSquares * pt.k) / sheet.h;
    const x0 = pt.x - sheet.foot[0] * s;
    const y0 = pt.y - sheet.foot[1] * s;
    const t = now % kidEnds[kidEnds.length - 1]!;
    let i = 0;
    while (i < kidEnds.length - 1 && t >= kidEnds[i]!) i++;
    shadows(pt.x, pt.y, pt.k, sheet.w * s * 0.6);
    g.imageSmoothingEnabled = false;
    g.drawImage(loaded.kid.img, i * sheet.w, 0, sheet.w, sheet.h, x0, y0, sheet.w * s, sheet.h * s);
    Object.assign(kidBox, { x0, y0, x1: x0 + sheet.w * s, y1: y0 + sheet.h * s, on: true, hx: pt.x, hy: pt.y - (sheet.foot[1] - sheet.top.idle) * s - 2 });
  };
  /**
   * You on your ride (town/rides.ts' frames, as the town's drawRider draws them): its idle standing, its move a cycle a step,
   * lifted by its hop; its shadows as the town's (smaller and lighter as it lifts); your tag over its top standing.
   */
  const drawRiding = (rd: Rider, now: number) => {
    const view = roomView(you.view);
    const rv = rd.views[view];
    const flip = rv.facing === "side" ? you.facing : 1;
    const box = f.youSquares;
    let img: HTMLCanvasElement;
    let lift = 0;
    let i: number;
    if (pose.step) {
      i = rv.moveIndex(pose.t);
      img = rv.frames.move[i]!;
      lift = (rv.lift[i]! * box) / 100;
    } else img = rv.frames.idle[(i = rv.idleIndex(now))]!;
    Object.assign(seen, { ride: rd.id, anim: pose.step ? "move" : "idle", frame: i, facing: flip, view: rv === rd.views[0] ? 0 : view });
    const h = ((box * rv.h) / 100) * pt.k;
    const w = (h * rv.w) / rv.h;
    const x0 = pt.x - rv.footX * w;
    const y0 = pt.y - rv.footY * h - lift * pt.k;
    // The shadows (the town's drawSprite for a rider: sized by the ride's own `shadow`).
    const up = Math.max(0, lift);
    const grow = 1 / (1 + up * f.shadowLiftShrink);
    const fade = Math.max(0, 1 - up * f.shadowLiftFade);
    const soft = rd.shadow;
    g.fillStyle = SHADOW;
    g.globalAlpha = f.shadowAlpha * (0.5 + 0.5 * fade);
    g.beginPath();
    g.ellipse(pt.x, pt.y, Math.min(w * 0.42, pt.k * 0.42 * soft) * grow, pt.k * 0.12 * soft * grow, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = f.contactShadowAlpha * fade;
    g.beginPath();
    g.ellipse(pt.x, pt.y, pt.k * f.contactShadowW * 1.45 * Math.min(soft, 1.2) * grow, pt.k * f.contactShadowDepth * grow, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.save();
    if (flip < 0) {
      g.translate(pt.x, 0);
      g.scale(-1, 1);
      g.translate(-pt.x, 0);
    }
    // (Crisp drawn bigger than its pixels, smooth smaller: as the town draws it.)
    g.imageSmoothingEnabled = h < img.height * 1.5;
    g.drawImage(img, x0, y0, w, h);
    g.restore();
    g.imageSmoothingEnabled = false;
    // (The tag over its top standing: it doesn't jump with the hop.)
    Object.assign(youHead, { x: pt.x, y: y0 + lift * pt.k + rv.top * h - 2, on: true });
  };
  const drawYou = (now: number) => {
    youHead.on = false;
    seen.anim = "";
    you.pose(now, pose);
    if (!P(pose.x, pose.y)) return;
    const rd = riding();
    if (rd) return drawRiding(rd, now);
    seen.ride = null;
    const a = youArt();
    const pad = a?.pad ?? 0;
    const kk = 1 + 2 * pad;
    const h = f.youSquares * kk * pt.k;
    const fy = (pad + PAWN_FOOT) / kk;
    const head = Math.min(a?.top ?? 1, (pad + PAWN_HEAD) / kk);
    const lift = pose.hop * f.youHop * pt.k;
    shadows(pt.x, pt.y, pt.k, h / kk);
    const y0 = pt.y - fy * h - lift;
    g.save();
    g.translate(pt.x, pt.y);
    if (pose.tilt) g.rotate((pose.tilt * f.hobbleTilt * Math.PI) / 180);
    if (you.facing < 0) g.scale(-1, 1);
    if (a) {
      g.imageSmoothingEnabled = h < a.img.height * 1.5;
      g.drawImage(a.img, -h / 2, y0 - pt.y, h, h);
    } else {
      // The plain pawn drawn as its outline at this size (crisp up close, as the mockup's), not its 160 px picture blown up.
      const u = h / 45;
      g.translate(-h / 2, y0 - pt.y);
      g.scale(u, u);
      g.fillStyle = "#ffffff";
      g.fill(PAWN);
      g.lineWidth = 1.5;
      g.lineCap = "round";
      g.strokeStyle = "#000000";
      g.stroke(PAWN);
    }
    g.restore();
    g.imageSmoothingEnabled = false;
    Object.assign(youHead, { x: pt.x, y: y0 + head * h - 2, on: true });
  };
  /** The Shopkeeper (`kid`) or you. */
  const drawFigure = (kid: boolean, now: number) => (kid ? drawKid(now) : drawYou(now));
  const drawTag = (text: string, kind: TagKind, x: number, y: number) => {
    const c = tag(text, kind);
    const w = c.width / DPR;
    const h = c.height / DPR;
    g.drawImage(c, x - w / 2, y - h + 4, w, h);
  };
  const drawGlows = (now: number) => {
    if (!art.pools.length && !art.lights.length) return;
    g.globalCompositeOperation = "lighter";
    for (const l of art.pools) {
      const u = upOf.get(l.piece);
      if (!u || !P(u.c, u.r)) continue;
      const ch = frames[l.piece]!.ch;
      const s = pt.k / SQ;
      g.globalAlpha = l.strength * S.glow;
      g.drawImage(glow(l.color), pt.x + (l.x - ch.foot[0] - l.rx * 2) * s, pt.y + (l.y - ch.foot[1] - l.ry * 2) * s, l.rx * 4 * s, l.ry * 4 * s);
    }
    for (const l of art.lights) {
      const u = upOf.get(l.piece);
      if (!u || !l.halo || !P(u.c, u.r)) continue;
      const ch = frames[l.piece]!.ch;
      const s = pt.k / SQ;
      // A torch's slow, gentle flicker (as the town's lights flicker: two slow waves, never dark).
      const fl = l.flicker ? 0.85 + 0.1 * Math.sin(now / 170 + u.c) + 0.05 * Math.sin(now / 53 + u.r) : 1;
      g.globalAlpha = 0.35 * l.strength * S.glow * fl;
      const r = l.halo * s;
      g.drawImage(glow(l.color), pt.x + (l.x + l.w / 2 - ch.foot[0]) * s - r, pt.y + (l.y + l.h / 2 - ch.foot[1]) * s - r, 2 * r, 2 * r);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  const draw = (now: number) => {
    for (const k of CAM_KEYS) {
      tall[k] = S.close[k] + (f.camTall[k] - S.close[k]) * zoomCur;
      wide[k] = S.close[k] + (f.camWide[k] - S.close[k]) * zoomCur;
    }
    setView(v, W, H, 0, 1, 0, 0, sets);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(roof, 0, 0, W, H);
    // Outside, past the low front wall: the bright day the door opens onto (a flat pale ground).
    const q = pq as [typeof pt, typeof pt, typeof pt, typeof pt];
    const near = Math.min(n + 6, camY + v.back - 0.6); // (up to just in front of the camera)
    if (near > n - 0.5 && P(-6, n - 0.5, q[0]) && P(n + 5, n - 0.5, q[1]) && P(n + 5, near, q[2]) && P(-6, near, q[3])) {
      g.fillStyle = "#e6dfcf";
      g.beginPath();
      g.moveTo(q[0].x, q[0].y);
      for (let i = 1; i < 4; i++) g.lineTo(q[i]!.x, q[i]!.y);
      g.fill();
    }
    flat(floor, 0, 0, 0, 0, n, n, S.floorBlock);
    for (const p of flats) {
      const img = frameAt(p.name, now);
      const d = p.d ?? 1;
      flat(img, 0, img.height - d * SQ, p.col, p.row - d + 1, p.w ?? 1, d, S.floorBlock);
    }
    // Your destination: a small gold ring on its square until you're there.
    if (dest.on && you.moving() && P(dest.c, dest.r)) {
      g.strokeStyle = "rgba(255,206,84,0.95)";
      g.lineWidth = Math.max(1.5, pt.k * 0.05);
      g.beginPath();
      g.ellipse(pt.x, pt.y, pt.k * 0.3, pt.k * 0.11, 0, 0, Math.PI * 2);
      g.stroke();
    } else dest.on = false;
    drawGlows(now);
    // Far to near: the pieces by their rows, the Shopkeeper and you each drawn before the first piece nearer than them.
    you.pose(now, pose);
    const kidFirst = def.at[1] <= pose.y;
    const z0 = kidFirst ? def.at[1] : pose.y;
    const z1 = kidFirst ? pose.y : def.at[1];
    let drawn = 0;
    for (const u of ups) {
      if (drawn === 0 && z0 < u.z) drawFigure(drawn++ === 0 === kidFirst, now);
      if (drawn === 1 && z1 < u.z) drawFigure(drawn++ === 0 === kidFirst, now);
      drawUp(u, now);
    }
    while (drawn < 2) drawFigure(drawn++ === 0 === kidFirst, now);
    if (kidBox.on) drawTag("Shopkeeper", "sidekick", kidBox.hx, kidBox.hy);
    if (youHead.on) drawTag(youName(), "you", youHead.x, youHead.y);
    placeCard();
    const h = you.here();
    const key = `${h.c},${h.r}`;
    if (cv.dataset.you !== key) cv.dataset.you = key;
    if (cv.dataset.ready !== "1") cv.dataset.ready = "1";
  };

  // ---- The cards: the Shopkeeper's and the way out's show when you stop near them; the crate's from Talk.
  let card: ShopCard | null = null;
  /** The square where you closed a card: it doesn't open again until you've moved on. */
  let shut = "";
  let cardW = NaN;
  let cardH = NaN;
  let cardX = NaN;
  let cardY = NaN;
  let cardA = NaN;
  const setCard = (c: ShopCard | null) => {
    if (c === card) return;
    card = c;
    cardW = cardH = cardX = cardY = cardA = NaN;
    onCard(c);
  };
  const close = () => {
    if (!card) return;
    const h = you.here();
    shut = `${h.c},${h.r}`;
    setCard(null);
  };
  const stepCards = () => {
    const h = you.here();
    const key = `${h.c},${h.r}`;
    if (shut && shut !== key) shut = "";
    if (you.moving()) {
      if (card === "talk" || card === "door") setCard(null);
      return;
    }
    if (card || shut === key) return;
    if (onDoor(room, h.c, h.r)) setCard("door");
    else if (inTalkRange(room, h.c, h.r)) setCard("talk");
  };
  function placeCard() {
    if (!card) return;
    if (Number.isNaN(cardW)) {
      if (cardEl.style.display === "none") return; // (drawn next time round)
      cardW = cardEl.offsetWidth;
      cardH = cardEl.offsetHeight;
    }
    // The crate's card stands in the middle of the box; the others over the Shopkeeper's head or yours, their tails pointing there.
    let ax = W / 2;
    let ay = H / 2 + cardH / 2 + 14;
    if (card === "talk" && kidBox.on) ((ax = kidBox.hx), (ay = kidBox.hy - 16));
    else if (card !== "crate" && youHead.on) ((ax = youHead.x), (ay = youHead.y - 16));
    const left = Math.max(8, Math.min(W - cardW - 8, ax - cardW / 2));
    const top = Math.max(8, Math.min(H - cardH - 8, ay - cardH - 14));
    if (!(Math.abs(left - cardX) < 0.05 && Math.abs(top - cardY) < 0.05)) {
      cardEl.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
      cardX = left;
      cardY = top;
    }
    const tail = Math.max(20, Math.min(cardW - 20, ax - left));
    if (!(Math.abs(tail - cardA) < 0.05)) {
      cardEl.style.setProperty("--ax", `${tail.toFixed(1)}px`);
      cardA = tail;
    }
  }

  // ---- The loop.
  let raf = 0;
  let last = performance.now();
  let alive = true;
  const frame = (now: number) => {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    zoomCur += (zoomTarget - zoomCur) * (1 - Math.exp(-dt * f.zoomRate));
    if (Math.abs(zoomTarget - zoomCur) < 0.001) zoomCur = zoomTarget;
    // (On your ride inside, at its pace: RIDES.speed, as in the town.)
    you.stepMs = f.youStepMs / rideSpeed(riding()?.id);
    you.update(now);
    stepCards();
    if (follow) {
      // A critically damped spring toward you (the town's), solved exactly for the frame.
      you.pose(now, pose);
      const w = f.followSpring;
      const e = Math.exp(-w * dt);
      const x = camX - pose.x;
      const y = camY - pose.y;
      const jx = vx + w * x;
      const jy = vy + w * y;
      camX = pose.x + (x + jx * dt) * e;
      camY = pose.y + (y + jy * dt) * e;
      vx = (vx - w * jx * dt) * e;
      vy = (vy - w * jy * dt) * e;
    } else vx = vy = 0;
    draw(now);
    raf = requestAnimationFrame(frame);
  };
  const run = () => {
    if (raf || !alive || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const halt = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const onVisibility = () => (document.hidden ? halt() : run());
  document.addEventListener("visibilitychange", onVisibility);
  const ro = new ResizeObserver(() => {
    if (resize()) draw(performance.now());
  });
  ro.observe(box);
  resize();

  // ---- Input: a tap walks you (to a square, into talking range, to the way out); a drag looks around.
  const press = new Press(f.dragPx);
  let drag: { id: number; x: number; y: number; cx: number; cy: number; k: number } | null = null;
  let closing = false;
  /** The square under (x, y) in the box, or null: the nearest drawn square whose shape holds the point. */
  const squareAt = (x: number, y: number): Sq | null => {
    const q = pq as [typeof pt, typeof pt, typeof pt, typeof pt];
    for (let r = n - 1; r >= 0; r--)
      for (let c = 0; c < n; c++) {
        if (!P(c - 0.5, r - 0.5, q[0]) || !P(c + 0.5, r - 0.5, q[1]) || !P(c + 0.5, r + 0.5, q[2]) || !P(c - 0.5, r + 0.5, q[3])) continue;
        let pos = 0;
        let neg = 0;
        for (let i = 0; i < 4; i++) {
          const a = q[i]!;
          const b = q[(i + 1) % 4]!;
          const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
          if (cross > 0) pos++;
          else if (cross < 0) neg++;
        }
        if (pos === 0 || neg === 0) return { c, r };
      }
    return null;
  };
  /** What a tap at (x, y) means: the Shopkeeper (its picture), the way out (its picture), or the square under it. */
  const plan = (x: number, y: number) => {
    const here = you.here();
    if (kidBox.on && x >= kidBox.x0 && x <= kidBox.x1 && y >= kidBox.y0 && y <= kidBox.y1) return tapTarget(room, here, def.keeper[0]!.c, def.keeper[0]!.r);
    const sq = squareAt(x, y);
    if (!sq) return null;
    return tapTarget(room, here, sq.c, sq.r);
  };
  const local = (e: PointerEvent) => {
    const rc = box.getBoundingClientRect();
    return { x: e.clientX - rc.left, y: e.clientY - rc.top };
  };
  const onDown = (e: PointerEvent) => {
    cv.setPointerCapture?.(e.pointerId);
    P(camX, camY - 0.5, pq[0]);
    P(camX, camY + 0.5, pq[1]);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: camX, cy: camY, k: Math.max(8, pq[1]!.y - pq[0]!.y) };
    closing = !!card;
    press.down(e.clientX, e.clientY, "tap");
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!press.move(e.clientX, e.clientY)) return;
    follow = false;
    // As the town's drag (Eric, Nov 2: "when I drag from down to up, it should be the same as the town movement"): the floor
    // follows the finger, both ways. A room's rows run toward the camera (P's `camY - r`; the town's run away from it), so a
    // finger going down the screen takes this camY down, where the town's drag adds to its own.
    camX = Math.max(0, Math.min(n - 1, drag.cx - (e.clientX - drag.x) / v.kf));
    camY = Math.max(0, Math.min(n - 1, drag.cy - (e.clientY - drag.y) / drag.k));
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    if (press.up("tap") !== "walk") return;
    if (closing) return close();
    const xy = local(e);
    const p = plan(xy.x, xy.y);
    if (!p?.dest) return;
    const path = findPath(room, you.here(), p.dest);
    if (!path) return;
    you.go(path);
    Object.assign(dest, { c: p.dest.c, r: p.dest.r, on: path.length > 0 });
    shut = "";
    follow = true;
  };
  const onCancel = () => {
    drag = null;
    press.cancel();
  };
  const setZoom = (out: boolean) => {
    zoomTarget = out ? 1 : 0;
    onZoom(out);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    setZoom(e.deltaY > 0);
  };
  const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
  cv.addEventListener("pointerdown", onDown);
  cv.addEventListener("pointermove", onMove);
  cv.addEventListener("pointerup", onUp);
  cv.addEventListener("pointercancel", onCancel);
  cv.addEventListener("wheel", onWheel, { passive: false });
  addEventListener("keydown", onKey);

  // ---- Test hooks (e2e, with the test switches on).
  cv.dataset.room = def.home;
  const hookAt = (kind: "keeper" | "door" | "square", sq?: readonly [number, number]) => {
    if (!testSwitchesAllowed()) return null;
    if (kind === "keeper") {
      const x = (kidBox.x0 + kidBox.x1) / 2;
      const y = kidBox.y0 + (kidBox.y1 - kidBox.y0) * 0.7;
      return kidBox.on && x > 0 && x < W && y > 0 && y < H ? { x, y } : null;
    }
    const s = kind === "door" ? room.doors[0]! : { c: sq![0], r: sq![1] };
    return P(s.c, s.r) && pt.x >= 0 && pt.x <= W && pt.y >= 0 && pt.y <= H ? { x: pt.x, y: pt.y } : null;
  };
  const hookCam = () => (testSwitchesAllowed() ? { zoom: zoomCur, zoomTarget, room: def.home, follow, focus: [camX, camY] } : null);
  const hookRide = () => (testSwitchesAllowed() ? { ...seen, stepMs: you.stepMs } : null);
  const hookBench = (k: number) => {
    if (!testSwitchesAllowed()) return null;
    const now = performance.now();
    draw(now);
    const t0 = performance.now();
    for (let i = 0; i < k; i++) draw(now);
    return (performance.now() - t0) / k;
  };
  const hooks = window as unknown as { __shopAt?: typeof hookAt; __shopCam?: typeof hookCam; __shopBench?: typeof hookBench; __shopRide?: typeof hookRide };
  hooks.__shopAt = hookAt;
  hooks.__shopRide = hookRide;
  hooks.__shopCam = hookCam;
  hooks.__shopBench = hookBench;

  run();
  draw(performance.now()); // the first frame, before the fade lifts

  return {
    zoom: setZoom,
    /** A card's button opens another (Talk: the crate's). */
    show: (c: ShopCard) => setCard(c),
    recenter: () => {
      follow = true;
    },
    stop: () => {
      alive = false;
      halt();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      removeEventListener("keydown", onKey);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointercancel", onCancel);
      cv.removeEventListener("wheel", onWheel);
      delete hooks.__shopAt;
      delete hooks.__shopCam;
      delete hooks.__shopBench;
      delete hooks.__shopRide;
    },
  };
}
