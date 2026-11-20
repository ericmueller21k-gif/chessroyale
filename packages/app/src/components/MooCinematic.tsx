/**
 * Moo & Moon's Full Moon cinematic (Eric, Nov 17; docs/decisions/2026-11-17-moo-cinematic.md), the Full Moon's moment while he
 * thinks (components/Moo.tsx, `fullMoon`). Its beats, all settings (MOO_CINEMATIC in settings.ts; MOO_BEATS.fullMoon adds them up,
 * so the server and solo wait for all of it):
 * 1. He hops from his spot (the phone's bar, or beside the board on a computer) onto the board (his `move`).
 * 2. The field fades in over the board and everything above it: on a phone the whole width from the screen's top to the board's
 *    bottom (the top bar and the boss bar), on a computer the board's column from the top (the boss bar). He stands in it. The moon
 *    (Eric, Nov 20; docs/decisions/2026-11-20-moo-moonrise.md) rises from half hidden behind the hill into the sky, always behind
 *    the hills, the barn and the grass, starts glowing with the Hidden Boss's light (its glow and rays radiating over the whole
 *    screen), and bursts into a white-out over the whole screen.
 * 3. At full white, the cut to the close-up of the two of them looking up at the moon: it comes in out of that light, dying back
 *    into the moon's side above them, its rays and a wash of it on them easing as their eyes turn white; a quick cut back.
 * 4. His transformation (`fullMoon`, his colors going gold at its `swap`), a beat powered up, the field fades out.
 * 5. He hops back to his spot (his powered `move`).
 * Two pictures in one sheet (characters/moo-cinematic.png: the field's four frames, its stars twinkling, and the close-up's five,
 * normal to white eyes; drawn on claude/boss-art: scripts/boss-art/out/arena-moo-field and scripts/boss-art/moo-closeup), the field's
 * moon lifted as its own sprite (characters/moo-moon.png, scripts/lift-moo-moon.py) rising between the field's sky without it and its
 * front (characters/moo-field-layers.png, scripts/lift-moo-field.py), his own sprite over the field, and opacities:
 * no filters. The light is the Hidden Boss's (recluse-light.ts), on one canvas the size of the screen drawn in its worker, off the
 * main thread, only while it's up. Everything from the moment's start, so a screen drawn
 * later carries on (a device that first sees it as it rejoins skips it: Moo.tsx, fullMoonMoment). While the field is up it takes
 * every tap, so nothing hidden under it is reached blind; a match menu already open shows above it (`mo-on`).
 */
import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef } from "preact/hooks";
import { MOO_CINEMATIC as C } from "@chessroyale/core";
import { MOO_BEATS } from "@chessroyale/chess";
import sheetUrl from "../characters/moo-cinematic.png?url";
import moonUrl from "../characters/moo-moon.png?url";
import layersUrl from "../characters/moo-field-layers.png?url";
import { bossKit } from "../characters/kits.ts";
import { BossMoment } from "./BossEffect.tsx";
import { useFrameNow } from "./Countdown.tsx";
import { onComputer } from "./PowerParts.tsx";
import { boardOnScreen } from "./RecluseCutscene.tsx";
import { canvasesOn, drawLight, lightNow, type LightBeats, type LightFrame } from "./recluse-light.ts";

const B = MOO_BEATS.fullMoon;
/** The pictures' own size (art pixels) and the sheet's frames: the field's four, then the close-up's five. */
const W = 200;
const H = 260;
const FIELD = [0, 1, 2, 3];
const FIELD_MS = 400;
const CLOSE = [4, 5, 6, 7, 8];
/** The field's layers (characters/moo-field-layers.png): its sky without the moon, four frames, then its front, four frames. */
const SKY = [0, 1, 2, 3];
const FRONT = [4, 5, 6, 7];
/** Where he stands in the field (art pixels): the field was drawn with this patch clear for him. */
const SPOT: readonly [number, number] = [100, 205];

/** The field's moon (art pixels): its sprite's box in the field (scripts/lift-moo-moon.py) and its middle. */
const MOON = { x: 42, y: 24, w: 116, h: 113, cx: 100, cy: 80.5 };
/** The moon's side of the close-up (shares of the picture: above the two of them, to the left, where its light streaks come from). */
const LIGHT_FROM: readonly [number, number] = [0.14, -0.06];

/** Each beat's start (ms into the moment). */
export const cineBeats = () => {
  const close = C.hopMs + C.fadeInMs + C.fieldMs;
  const fadeOut = B.transformAt + B.transformMs + C.afterMs;
  return { landed: C.hopMs, close, closeEnd: close + C.closeMs, transform: B.transformAt, fadeOut, hopBack: fadeOut + C.fadeOutMs, end: B.total };
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ramp = (t: number, from: number, ms: number) => clamp01((t - from) / Math.max(1, ms));

/** The field's opacity at `t`: fading in after the hop, out before the hop back. */
export function fieldOpacity(t: number): number {
  const b = cineBeats();
  return Math.min(ramp(t, b.landed, C.fadeInMs), 1 - ramp(t, b.fadeOut, C.fadeOutMs));
}

/** The close-up's opacity at `t`: a quick cut in, a quick cut out. */
export function closeOpacity(t: number): number {
  const b = cineBeats();
  return Math.min(ramp(t, b.close, C.cutMs), 1 - ramp(t, b.closeEnd - C.cutMs, C.cutMs));
}

/** The close-up's frame at `t` (0: their eyes as ever; 4: white and glowing). */
export function closeFrame(t: number): number {
  const into = t - cineBeats().close - C.whitenAt;
  return into < 0 ? 0 : Math.min(4, 1 + Math.floor(into / C.eyeStepMs));
}

/**
 * The moon rising at `t` (null outside the field before the cut, where the field is its own picture, its moon where this one ends):
 * how many times the field's moon it is, how far below it its middle is (art pixels), and its opacity (the field's).
 */
export function moonAt(t: number): { scale: number; y: number; opacity: number } | null {
  const b = cineBeats();
  if (t < b.landed || t >= b.close) return null;
  const p = 1 - (1 - clamp01((t - b.landed) / (b.close - b.landed))) ** C.moonEase;
  return { scale: C.moonFrom.scale + (C.moonTo.scale - C.moonFrom.scale) * p, y: C.moonFrom.y + (C.moonTo.y - C.moonFrom.y) * p, opacity: fieldOpacity(t) };
}

/** The moon's middle in the field at `t` (art pixels; where its light comes from): where it has risen to, its end's from the cut. */
export function moonMiddle(t: number): { x: number; y: number } {
  return { x: MOON.cx, y: MOON.cy + (moonAt(t)?.y ?? C.moonTo.y) };
}

/** The moon's box in the field at `t` (art pixels), as it's drawn. */
export function moonArtBox(m: { scale: number; y: number }): { x: number; y: number; w: number; h: number } {
  return { x: MOON.cx + (MOON.x - MOON.cx) * m.scale, y: MOON.cy + m.y + (MOON.y - MOON.cy) * m.scale, w: MOON.w * m.scale, h: MOON.h * m.scale };
}

/**
 * The Hidden Boss's light's beats for the moon (recluse-light.ts, lightNow; ms into the moment): its glow growing from `riseAt`,
 * its rays radiating from `radiateAt`, the white from `whiteAt`, whole at the cut (`whiteFull`), dying back from `downAt` to
 * `revealAt`. None of the rest: no burst, no pages, no slam (and no shaft: the frame's `noShaft`).
 */
export function moonLightBeats(): LightBeats {
  const close = cineBeats().close;
  const never = 1e9;
  return {
    burstAt: never,
    riseAt: close - C.glowMs,
    shootAt: never,
    radiateAt: close - C.radiateMs,
    whiteAt: close - C.whiteMs,
    whiteFull: close,
    downAt: close + C.lightHoldMs,
    revealAt: close + C.lightMs,
    crackAt: never,
    growAt: 0,
    growMs: 0,
    pickupAt: 0,
  };
}

/** Whether the light is up at `t` (its canvas drawn only then). */
export function moonLightOn(t: number): boolean {
  const T = moonLightBeats();
  return t >= T.riseAt && t < T.revealAt;
}

/** The wash of the moon's light on the two of them in the close-up at `t`: `lit.from` at the cut, easing to `lit.to` as their eyes whiten. */
export function litOpacity(t: number): number {
  const b = cineBeats();
  if (t < b.close || t >= b.closeEnd) return 0;
  const u = ramp(t, b.close, C.whitenAt + 4 * C.eyeStepMs);
  const e = u * u * (3 - 2 * u);
  return closeOpacity(t) * (C.lit.from + (C.lit.to - C.lit.from) * e);
}

/** His animation at `t`, and since when (ms into the moment). */
export function cineFigure(t: number): { anim: string; since: number } {
  const b = cineBeats();
  if (t < b.landed) return { anim: "move", since: 0 };
  if (t < b.transform) return { anim: "idle", since: b.landed };
  if (t < b.transform + B.transformMs) return { anim: "fullMoon", since: b.transform };
  if (t < b.hopBack) return { anim: "powerIdle", since: b.transform + B.transformMs };
  return { anim: "p_move", since: b.hopBack };
}

/** How far along a hop he is at `t` ms into it: off the ground at `move`'s second frame, down at its fourth (100 to 300 ms). */
const HOP_UP = 90;
const HOP_DOWN = 300;
const hopP = (t: number) => {
  const p = clamp01((t - HOP_UP) / (HOP_DOWN - HOP_UP));
  return p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
};

type Box = { x: number; y: number; w: number };

/** His figure's box in its usual spot (the bar's on a phone, beside the board on a computer): where he hops from and back to. */
function spotBox(): Box | null {
  const c = [...document.querySelectorAll<HTMLElement>(".boss-char.ch-moo .boss-char-sprite")].find((e) => e.offsetParent);
  const r = c?.getBoundingClientRect();
  return r && r.width ? { x: r.x, y: r.y, w: r.width } : null;
}

/** The pictures fetched and decoded ahead, as his battle starts (Moo.tsx, prewarmMoo): never a blank first frame. */
let sheet: HTMLImageElement[] | null = null;
export function prewarmCinematic(): void {
  if (sheet || typeof Image === "undefined") return;
  sheet = [sheetUrl, moonUrl, layersUrl].map((src) => {
    const im = new Image();
    im.src = src;
    im.decode?.().catch(() => undefined);
    return im;
  });
}

/** A figure's scale at most this share of the area's height per art pixel: in a wide area the field's cover scale would make him giant. */
const FIG_MAX = 1 / 200;

/** `name`: the boss's name, as his kit is found (bossKit). */
export function MooCinematic({ at, name }: { at: number; name: string }) {
  const now = useFrameNow();
  const t = now - at;
  const on = t >= 0 && t < B.total;
  // (While it plays, a match menu already open shows above it: `mo-on` on the page, as the Hidden Boss's `cs-on`; review of #776, #1.)
  useLayoutEffect(() => {
    if (!on) return;
    document.body.classList.add("mo-on");
    return () => document.body.classList.remove("mo-on");
  }, [on]);
  // The light's canvas, handed to the light's worker once it's up (where a browser can), so its drawing is off the main thread (as the
  // Hidden Boss's: RecluseTransform.tsx); ended with it. Elsewhere it's drawn here.
  const lit = on && moonLightOn(t);
  const cv = useRef<HTMLCanvasElement>(null);
  const worker = useRef<Worker | null>(null);
  useLayoutEffect(() => {
    const c = cv.current;
    if (!lit || !c || typeof Worker === "undefined" || !("transferControlToOffscreen" in c)) return;
    let w: Worker;
    try {
      w = new Worker(new URL("./recluse-light.worker.ts", import.meta.url), { type: "module" });
      const init = { back: null, front: c.transferControlToOffscreen(), beats: moonLightBeats() };
      w.postMessage({ init }, [init.front]);
    } catch {
      return;
    }
    worker.current = w;
    return () => {
      w.terminate();
      worker.current = null;
    };
  }, [lit]);
  const frame = useRef<LightFrame | null>(null);
  useLayoutEffect(() => {
    const f = frame.current;
    if (!f) return;
    if (worker.current) worker.current.postMessage({ frame: f });
    else drawLight(f, moonLightBeats(), null, cv.current);
  });
  frame.current = null;
  const kit = bossKit(name);
  // The board's box and his spot's, read each frame: a board re-mounted or a phone turned mid-cinematic is followed (review, #7).
  const rect = on ? boardOnScreen()?.getBoundingClientRect() : null;
  if (!rect || !rect.width || !kit) return null;
  const b = cineBeats();
  // The area: the board and everything above it.
  const computer = onComputer();
  const area = { x: computer ? rect.x : 0, y: 0, w: computer ? rect.width : innerWidth, h: rect.bottom };
  // The pictures cover it, centered (the art keeps what matters away from its edges), in whole screen pixels. The close-up fits
  // instead in an area wider than 4:3 (a short, wide window), where covering would show only a thin band of it (review, #5).
  const cover = Math.max(area.w / W, area.h / H);
  const place = (k: number) => {
    const w = Math.ceil(W * k);
    const h = Math.ceil(H * k);
    return { x: Math.round((area.w - w) / 2), y: Math.round((area.h - h) / 2), w, h };
  };
  const field = place(cover);
  const close = area.w / area.h > 4 / 3 ? place(Math.min(area.w / W, area.h / H)) : field;
  const pic = (frame: number, opacity: number, cls: string, r: typeof field, url = sheetUrl, frames = 9) =>
    opacity > 0 && (
      <div
        class={`mo-pic ${cls}`}
        data-frame={frame}
        style={{ left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`, opacity: String(opacity), backgroundImage: `url(${url})`, backgroundSize: `${r.w * frames}px ${r.h}px`, backgroundPosition: `${-frame * r.w}px 0` }}
      />
    );
  // His figure: where he stands in the field, his feet kept inside the area and his scale capped, flying between there and his spot
  // on the hops.
  const ch = kit.ch;
  const k = field.w / W;
  const kf = Math.min(k, area.h * FIG_MAX);
  const feet = { x: area.x + field.x + SPOT[0] * k, y: Math.min(field.y + SPOT[1] * k, area.h * 0.92) };
  const stand: Box = { x: feet.x - ch.foot[0] * kf, y: feet.y - ch.foot[1] * kf, w: ch.w * kf };
  const spot = t < b.landed || t >= b.hopBack ? spotBox() : null;
  const from = spot ?? { x: area.x + area.w * 0.1, y: area.y, w: stand.w / 2 };
  const hop = t < b.landed ? hopP(t) : t >= b.hopBack ? 1 - hopP(t - b.hopBack) : 1;
  const lift = Math.sin(Math.PI * hop) * Math.max(40, 0.3 * Math.hypot(stand.x - from.x, stand.y - from.y));
  const fig: Box = { x: from.x + (stand.x - from.x) * hop, y: from.y + (stand.y - from.y) * hop - lift, w: from.w + (stand.w - from.w) * hop };
  const f = cineFigure(t);
  // (While the field is up it takes every tap: nothing hidden under it, the board's premoves or the top bar's menu, is reached
  // blind; review, #1 and #4. On the hops the board shows, and takes taps as ever.)
  const fieldUp = fieldOpacity(t) > 0;
  // The moon rising: the field's, lifted, its middle where the field's is (less `y`), in whole screen pixels, between the field's sky
  // without it and its front (the hills, the barn, the grass), so it's always behind them.
  const m = moonAt(t);
  const ab = m && moonArtBox(m);
  const moonBox = ab && { x: Math.round(field.x + ab.x * k), y: Math.round(field.y + ab.y * k), w: Math.round(ab.w * k), h: Math.round(ab.h * k) };
  // The light: from the moon's middle in the field; from the moon's side of the close-up after the cut (under the white, unseen).
  if (lit) {
    const T = moonLightBeats();
    const s = lightNow(t, T);
    s.shaft = 0;
    const toClose = t >= b.close;
    const mm = moonMiddle(t);
    const mid = toClose
      ? { x: area.x + close.x + LIGHT_FROM[0] * close.w, y: area.y + close.y + LIGHT_FROM[1] * close.h }
      : { x: area.x + field.x + mm.x * k, y: area.y + field.y + mm.y * k };
    // (The light's scale: a share of the moon's size in the field, of the close-up's width after the cut.)
    const lk = toClose ? close.w * 0.11 : MOON.w * (m?.scale ?? C.moonTo.scale) * k * 0.22;
    frame.current = { t, bx: mid.x, by: mid.y, bw: 8 * lk, W: innerWidth, H: innerHeight, dpr: 1, mid, eyes: [], back: false, front: canvasesOn(s, t, false, T).front, noShaft: true };
  }
  const litOn = litOpacity(t);
  const fieldFrame = Math.floor(Math.max(0, t) / FIELD_MS) % FIELD.length;
  return createPortal(
    <div class="mo-cine" data-t={Math.round(t)}>
      <div class={`mo-area${fieldUp ? " mo-block" : ""}`} style={{ left: `${area.x}px`, top: `${area.y}px`, width: `${area.w}px`, height: `${area.h}px` }}>
        {m ? pic(SKY[fieldFrame]!, fieldOpacity(t), "mo-field", field, layersUrl, 8) : pic(FIELD[fieldFrame]!, fieldOpacity(t), "mo-field", field)}
        {moonBox && m!.opacity > 0 && (
          <div class="mo-bigmoon" style={{ left: `${moonBox.x}px`, top: `${moonBox.y}px`, width: `${moonBox.w}px`, height: `${moonBox.h}px`, opacity: String(m!.opacity), backgroundImage: `url(${moonUrl})` }} />
        )}
        {m && pic(FRONT[fieldFrame]!, fieldOpacity(t), "mo-front", field, layersUrl, 8)}
        {pic(CLOSE[closeFrame(t)]!, closeOpacity(t), "mo-close", close)}
        {litOn > 0 && (
          <div
            class="mo-lit"
            style={{ left: `${close.x}px`, top: `${close.y}px`, width: `${close.w}px`, height: `${close.h}px`, opacity: litOn.toFixed(3), "--mo-lx": `${LIGHT_FROM[0] * 100}%`, "--mo-ly": `${LIGHT_FROM[1] * 100}%` }}
          />
        )}
      </div>
      <BossMoment boss={name} anim={f.anim} since={at + f.since} class="mo-cine-fig" style={{ left: `${fig.x}px`, top: `${fig.y}px`, width: `${fig.w}px` }} />
      {lit && <canvas ref={cv} class="mo-light" style={{ width: `${innerWidth}px`, height: `${innerHeight}px` }} />}
    </div>,
    document.body,
  );
}
