/**
 * The town square (hidden page /town; slice 1: the world, five homes, their bosses and a few bots, nothing else). A slim
 * bar with the back button and the title; the world fills the rest of the screen, on a phone and a computer alike, and
 * works its camera out from its box's shape (camera.ts). Tap a square to walk there (around the homes, a square at a
 * time); tap a home, a boss or a bot to walk next to it; drag to look around; "Back to me"; −/+ (and the wheel) zoom;
 * the chips at the edge point to the homes off screen, and a tap glides the camera there.
 *
 * One requestAnimationFrame loop draws everything on one canvas; it stops when the screen closes or the tab is hidden.
 * Test hooks (e2e only): the canvas carries `data-you="c,r"` (your square) and `data-ready="1"` once a frame is drawn.
 * docs/areas/town-square.md.
 */
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { playerName } from "../account.ts";
import { N, proj, wrapF } from "./camera.ts";
import { TOWN_FEEL } from "./feel.ts";
import { BOSS_FACE, Renderer } from "./render.ts";
import { sameWeights, skyOverride, skyWeights, type SkyWeights } from "./sky.ts";
import { HOMES, START, createTown, plotAt, plotDist, tdist, tick, walkNextTo, walkTo, type Home } from "./world.ts";
import "./town.css";

const CHIPS = TOWN_FEEL.maxChips;

export function TownScreen({ onBack }: { onBack: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const chips = useRef<(HTMLDivElement | null)[]>([]);
  const ctl = useRef<{ zoom: (out: boolean) => void; recenter: () => void; chip: (i: number) => void } | null>(null);
  const [zoomedOut, setZoomedOut] = useState<boolean>(TOWN_FEEL.startZoomedOut);

  // (A layout effect: the world's first frame is drawn before the screen first shows.)
  useLayoutEffect(() => {
    const t = startTown(box.current!, canvas.current!, chips.current, setZoomedOut);
    ctl.current = t;
    return t.stop;
  }, []);

  return (
    <div class="town-screen">
      <header class="town-bar">
        <button type="button" class="town-back" aria-label="Back" onClick={onBack}>
          ‹
        </button>
        <h1>Town square</h1>
      </header>
      <div class="town-box" ref={box}>
        <canvas class="town-canvas" ref={canvas} aria-label="The town square" />
        <div class="town-overlay">
          {Array.from({ length: CHIPS }, (_, i) => (
            <div class="town-chip" key={i} ref={(el) => void (chips.current[i] = el)} style={{ display: "none" }}>
              <div class="town-chip-rot">
                <div class="town-chip-arrow" />
              </div>
              <button type="button" class="town-chip-face" onClick={() => ctl.current?.chip(i)}>
                <canvas width={92} height={92} />
              </button>
            </div>
          ))}
        </div>
        <div class="town-controls">
          <div class="town-zoom">
            <button type="button" aria-label="Zoom out" aria-pressed={zoomedOut} onClick={() => ctl.current?.zoom(true)}>
              −
            </button>
            <button type="button" aria-label="Zoom in" aria-pressed={!zoomedOut} onClick={() => ctl.current?.zoom(false)}>
              +
            </button>
          </div>
          <button type="button" class="town-recenter" onClick={() => ctl.current?.recenter()}>
            Back to me
          </button>
        </div>
      </div>
    </div>
  );
}

/** Runs the world in `box` on `cv`: the loop, the camera, the input and the chips. Returns its controls and its stop. */
function startTown(box: HTMLDivElement, cv: HTMLCanvasElement, chipEls: (HTMLDivElement | null)[], onZoom: (out: boolean) => void) {
  const f = TOWN_FEEL;
  const ctx = cv.getContext("2d")!;
  const town = createTown(performance.now());
  const r = new Renderer(ctx, town, HOMES);
  // (The signs' pixel font is the game's own; it's loaded on first use, so ask for it now.)
  void document.fonts?.load('8px "Press Start 2P"').catch(() => {});
  let camX = START.c;
  let camY = START.r;
  let follow = true;
  /** The camera's speed while it follows you (squares a second): the spring's state. */
  let vx = 0;
  let vy = 0;
  let glide: { x: number; y: number } | null = null;
  let zoomCur = f.startZoomedOut ? 1 : 0;
  let zoomTarget = zoomCur;
  // The sky by the device's clock, read about once a minute; `?sky=day|dawn|dusk|night` holds one look (for Eric, tests).
  const pinned = skyOverride(new URLSearchParams(location.search).get("sky"));
  const clock = (): SkyWeights => {
    const d = new Date();
    return skyWeights(d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60);
  };
  let sky = pinned ?? clock();
  let skyAt = performance.now();
  r.setSky(sky);
  let raf = 0;
  let last = performance.now();
  let alive = true;
  let ready = false;
  let youKey = "";
  const chipHome: (Home | null)[] = chipEls.map(() => null);
  const chipXY = chipEls.map(() => ({ x: NaN, y: NaN, a: NaN }));

  /** Sizes the canvas to its box; true if it changed. (Setting a canvas's size clears it, even to the same size.) */
  const resize = () => {
    const rc = box.getBoundingClientRect();
    const W = Math.max(1, rc.width);
    const H = Math.max(1, rc.height);
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    if (W === r.W && H === r.H && DPR === r.DPR) return false;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
    r.resize(W, H, DPR);
    // The buttons' box, in the world's pixels: the chips keep off it.
    const ctl = box.querySelector(".town-controls")?.getBoundingClientRect();
    if (ctl) Object.assign(r.keepClear, { x: ctl.left - rc.left, y: ctl.top - rc.top, w: ctl.width, h: ctl.height });
    return true;
  };
  // A resize runs after the frame's drawing (before its paint) and clears the canvas: draw again at once, so no frame
  // shows it blank.
  const ro = new ResizeObserver(() => {
    if (resize()) draw(performance.now());
  });
  ro.observe(box);
  resize();

  const updateCamera = (dt: number, now: number) => {
    if (glide) {
      const k = 1 - Math.exp(-f.glideRate * dt);
      camX += wrapF(glide.x - camX) * k;
      camY += wrapF(glide.y - camY) * k;
      if (Math.hypot(wrapF(glide.x - camX), wrapF(glide.y - camY)) < 0.03) glide = null;
    } else if (follow) {
      // A critically damped spring toward your pawn, solved exactly for the frame (steady at any frame rate).
      const p = town.you.walker.pose(now, POSE);
      const w = f.followSpring;
      const e = Math.exp(-w * dt);
      const x = wrapF(camX - p.x);
      const y = wrapF(camY - p.y);
      const jx = vx + w * x;
      const jy = vy + w * y;
      camX = p.x + (x + jx * dt) * e;
      camY = p.y + (y + jy * dt) * e;
      vx = (vx - w * jx * dt) * e;
      vy = (vy - w * jy * dt) * e;
    }
    if (!follow || glide) vx = vy = 0;
    // (Kept near the world's middle so the numbers never grow, however far you walk round.)
    camX = START.c + wrapF(camX - START.c);
    camY = START.r + wrapF(camY - START.r);
  };

  const draw = (now: number, dt = 0) => {
    r.draw(now, camX, camY, zoomCur, dt);
    placeChips();
    const h = town.you.walker.here();
    const key = `${h.c},${h.r}`;
    if (key !== youKey) cv.dataset.you = youKey = key;
    if (!ready) cv.dataset.ready = String(+(ready = true));
  };

  const frame = (now: number) => {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    zoomCur += (zoomTarget - zoomCur) * (1 - Math.exp(-dt * f.zoomRate));
    if (Math.abs(zoomTarget - zoomCur) < 0.001) zoomCur = zoomTarget;
    town.you.name = playerName();
    if (!pinned && now - skyAt > f.skyCheckMs) {
      skyAt = now;
      const w = clock();
      if (!sameWeights(w, sky)) r.setSky((sky = w));
    }
    tick(town, now);
    updateCamera(dt, now);
    draw(now, dt);
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

  // ---- The chips: moved only when they move; a boss's face drawn into its chip when the chip changes home.
  function placeChips() {
    for (let i = 0; i < chipEls.length; i++) {
      const el = chipEls[i];
      if (!el) continue;
      const c = r.chips[i]!;
      if (c.home !== chipHome[i]) {
        chipHome[i] = c.home;
        el.style.display = c.home ? "" : "none";
        if (!c.home) el.querySelector("button")!.removeAttribute("aria-label");
        else {
          el.style.setProperty("--town-chip", c.home.color);
          const face = el.querySelector("button")!;
          face.setAttribute("aria-label", `Go to ${c.home.name}`);
          drawFace(face.querySelector("canvas")!, r.bossFace(c.home.id), BOSS_FACE[c.home.id]);
          chipXY[i]!.x = chipXY[i]!.a = NaN; // (placed below: NaN is never "close enough")
        }
      }
      if (!c.home) continue;
      const xy = chipXY[i]!;
      if (!(Math.abs(xy.x - c.x) <= 0.3 && Math.abs(xy.y - c.y) <= 0.3)) {
        el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0)`;
        xy.x = c.x;
        xy.y = c.y;
      }
      if (!(Math.abs(xy.a - c.angle) <= 0.5)) {
        (el.firstElementChild as HTMLElement).style.transform = `rotate(${c.angle.toFixed(1)}deg)`;
        xy.a = c.angle;
      }
    }
  }

  // ---- Input: a press that moves is a drag (look around); one that doesn't is a tap.
  let press: { id: number; x: number; y: number; cx: number; cy: number; drag: boolean; kx: number; ky: number } | null = null;
  const local = (e: PointerEvent) => {
    const rc = box.getBoundingClientRect();
    return { x: e.clientX - rc.left, y: e.clientY - rc.top };
  };
  const onDown = (e: PointerEvent) => {
    cv.setPointerCapture?.(e.pointerId);
    // Pixels per square at the focus point, across and along (for the drag).
    const v = r.view;
    const ky = Math.max(8, rowSpan(r));
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: camX, cy: camY, drag: false, kx: v.kf, ky };
  };
  const onMove = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!press.drag && Math.hypot(dx, dy) > f.dragPx) {
      press.drag = true;
      follow = false;
      glide = null;
    }
    if (press.drag) {
      camX = press.cx - dx / press.kx;
      camY = press.cy + dy / press.ky;
    }
  };
  const onUp = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    press = null;
    if (p.drag) return;
    const xy = local(e);
    tapAt(xy.x, xy.y);
  };
  const onCancel = () => void (press = null);
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    setZoom(e.deltaY > 0);
  };
  cv.addEventListener("pointerdown", onDown);
  cv.addEventListener("pointermove", onMove);
  cv.addEventListener("pointerup", onUp);
  cv.addEventListener("pointercancel", onCancel);
  cv.addEventListener("wheel", onWheel, { passive: false });

  function tapAt(x: number, y: number) {
    const now = performance.now();
    r.ripple(x, y, now);
    const hit = r.pick(x, y);
    if (!hit) return;
    let moved = false;
    if (hit.kind === "square") {
      const home = plotAt[hit.r * N + hit.c];
      moved = home ? walkNextTo(town, (c, rr) => plotDist(home, c, rr) === 1) : walkTo(town, hit.c, hit.r);
    } else if (hit.kind === "house") moved = walkNextTo(town, (c, rr) => plotDist(hit.home, c, rr) === 1);
    else if (hit.kind === "boss" || (hit.kind === "person" && !hit.person.you)) {
      const at = (hit.kind === "boss" ? hit.boss.walker : hit.person.walker).here();
      moved = walkNextTo(town, (c, rr) => tdist({ c, r: rr }, at) === 1);
    }
    if (moved) {
      follow = true;
      glide = null;
    }
  }

  function setZoom(out: boolean) {
    zoomTarget = out ? 1 : 0;
    onZoom(out);
  }

  run();
  draw(performance.now()); // the first frame, before the screen shows

  return {
    zoom: setZoom,
    recenter: () => {
      follow = true;
      glide = null;
    },
    chip: (i: number) => {
      const h = chipHome[i];
      if (!h) return;
      follow = false;
      glide = { x: camX + wrapF(h.cx - camX), y: camY + wrapF(h.cy - f.glideAhead - camY) };
    },
    stop: () => {
      alive = false;
      halt();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointercancel", onCancel);
      cv.removeEventListener("wheel", onWheel);
    },
  };
}

const POSE = { x: 0, y: 0, hop: 0, tilt: 0 };
const PA = { x: 0, y: 0, k: 0, depth: 0 };
const PB = { x: 0, y: 0, k: 0, depth: 0 };

/** How many pixels one square ahead spans at the focus point (dragging down by this much moves the camera a square). */
function rowSpan(r: Renderer): number {
  const v = r.view;
  return proj(v, 0, -0.5, 0, PA) && proj(v, 0, 0.5, 0, PB) ? PA.y - PB.y : v.kf * 0.5;
}

/** A boss's face in its chip: its head (`box`, in its first idle frame's pixels) filling the round chip. */
function drawFace(c: HTMLCanvasElement, img: HTMLCanvasElement, box: readonly [x: number, y: number, size: number]) {
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = false;
  g.drawImage(img, box[0], box[1], box[2], box[2], 0, 0, c.width, c.height);
}

