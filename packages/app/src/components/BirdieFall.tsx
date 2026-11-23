/**
 * Birdie's fall (Eric, Nov 23; docs/decisions/2026-11-23-birdie-fall.md), his ultimate's moment while he thinks (components/Birdie.tsx,
 * `birdieFall`): built the way Moo's Full Moon cinematic is (MooCinematic.tsx). Its beats, all settings (BIRDIE_CINEMATIC in settings.ts;
 * BIRDIE_BEATS.fall adds them up, so the server and solo wait for all of it):
 * 1. His `fall` where he stands (his figure: Birdie.tsx plays it in place): a jolt throws him out of his train.
 * 2. The scene fades in over the board and everything above it (a phone: the whole width from the screen's top to the board's bottom;
 *    a computer: the board's column from the top): he tumbles through a blurred sky, speed lines streaming (the drawing's `fall`).
 * 3. His train comes up the track toward him, closer and closer, its headlights brighter and brighter (the drawing's `approach`), the
 *    Hidden Boss's light growing from them (recluse-light.ts, as Moo's moon: Eric, "how we did the lights") to a white-out at the hit.
 * 4. Out of the white, Armored Birdie, the steam clearing off him (the drawing's `reveal`), standing a moment (`hold`); the scene fades
 *    out, and he's in his spot as Armored Birdie (the kit's powered twin, from the hit: birdie-state.ts).
 * The pictures are the cutscene's two drawings baked into one sheet (characters/birdie-cutscene.png, scripts/bake-birdie-cutscene.ts):
 * no art code runs for it on a phone. Everything from the moment's start, so a screen drawn later carries on (a device that first sees
 * it as it rejoins skips it: Birdie.tsx). While the scene is up it takes every tap, and a match menu already open shows above it
 * (`mo-on`, Moo's).
 */
import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef } from "preact/hooks";
import { BIRDIE_CINEMATIC as C } from "@chessroyale/core";
import { BIRDIE_BEATS } from "@chessroyale/chess";
import sheetUrl from "../characters/birdie-cutscene.png?url";
import { BIRDIE_CUTSCENE_SHEET as SHEET } from "../characters/birdie-cutscene-sheet.ts";
import { useFrameNow } from "./Countdown.tsx";
import { onComputer } from "./PowerParts.tsx";
import { boardOnScreen } from "./RecluseCutscene.tsx";
import { canvasesOn, drawLight, lightNow, type LightBeats, type LightFrame } from "./recluse-light.ts";
import { play, type SoundName } from "../sound.ts";

const B = BIRDIE_BEATS.fall;
const W = SHEET.w;
const H = SHEET.h;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ramp = (t: number, from: number, ms: number) => clamp01((t - from) / Math.max(1, ms));

type SheetAnim = keyof typeof SHEET.anims;
/** The sheet's column for `anim` `ms` into it (a loop wraps; a one-shot holds its last frame). */
export function sheetColumn(anim: SheetAnim, ms: number): number {
  const a = SHEET.anims[anim];
  const total = a.ms.reduce((s, x) => s + x, 0);
  let t = a.loop ? ((Math.max(0, ms) % total) + total) % total : Math.max(0, ms);
  for (let i = 0; i < a.ms.length; i++) {
    if (t < a.ms[i]!) return a.at + i;
    t -= a.ms[i]!;
  }
  return a.at + a.ms.length - 1;
}

/** The picture at `t` ms into the moment: the sheet's column, or null before the scene (his fall where he stands) and after it. */
export function cutscenePicture(t: number): { column: number; anim: SheetAnim } | null {
  if (t < B.cutAt || t >= B.total) return null;
  if (t < B.approachAt) return { column: sheetColumn("fall", t - B.cutAt), anim: "fall" };
  if (t < B.hitAt) return { column: sheetColumn("approach", t - B.approachAt), anim: "approach" };
  if (t < B.holdAt) return { column: sheetColumn("reveal", t - B.hitAt), anim: "reveal" };
  return { column: sheetColumn("hold", t - B.holdAt), anim: "hold" };
}

/** The scene's opacity at `t`: fading in after his fall where he stands, out at its end. */
export function sceneOpacity(t: number): number {
  return Math.min(ramp(t, B.cutAt, C.fadeInMs), 1 - ramp(t, B.fadeOutAt, C.fadeOutMs));
}

/** The headlights' light's beats (recluse-light.ts, lightNow; ms into the moment): glowing, radiating, white at the hit, dying back. */
export function headlightBeats(): LightBeats {
  const never = 1e9;
  return {
    burstAt: never,
    riseAt: B.hitAt - C.glowMs,
    shootAt: never,
    radiateAt: B.hitAt - C.radiateMs,
    whiteAt: B.hitAt - C.whiteMs,
    whiteFull: B.hitAt,
    downAt: B.hitAt + C.lightHoldMs,
    revealAt: B.hitAt + C.lightMs,
    crackAt: never,
    growAt: 0,
    growMs: 0,
    pickupAt: 0,
  };
}

/** Whether the light is up at `t` (its canvas drawn only then). */
export function headlightOn(t: number): boolean {
  const T = headlightBeats();
  return t >= T.riseAt && t < T.revealAt;
}

/**
 * Where the headlights are in the picture at `t` (art pixels): between the two lamps of the approach's frame (the drawing's notes: a
 * speck in the haze at about (160, 228) on its first frame, its lamps at (54, 199) and (130, 199) on its last), easing between them as
 * it comes; at the hit and after, its last.
 */
export function headlightsAt(t: number): { x: number; y: number } {
  const p = clamp01((t - B.approachAt) / Math.max(1, C.approachMs));
  const e = p * p;
  return { x: 160 + (92 - 160) * e, y: 228 + (199 - 228) * e };
}

/** The sheet fetched and decoded ahead, as his battle starts (Birdie.tsx, prewarmBirdie): never a blank first frame. */
let sheet: HTMLImageElement | null = null;
export function prewarmBirdieFall(): void {
  if (sheet || typeof Image === "undefined") return;
  sheet = new Image();
  sheet.src = sheetUrl;
  (sheet.decode ? sheet.decode() : Promise.resolve()).catch(() => undefined);
}

/** Each picture's sound as it starts (his own: birdie-sounds.ts): the wind of his fall, his train's horn, the clank of his armor. */
const PICTURE_SOUND: Record<SheetAnim, SoundName | null> = { fall: "birdieWhoosh", approach: "birdieToot", reveal: "birdieClank", hold: null };
/** The pictures whose sound has played, by moment and picture (a screen drawn again never plays one twice). */
const sounded = new Set<string>();

/** His fall's scene, from the moment's start `at`. */
export function BirdieFall({ at }: { at: number }) {
  const now = useFrameNow();
  const t = now - at;
  const pic = cutscenePicture(t);
  const on = !!pic;
  // (Each picture's sound as it first shows, through the mute switch, once a moment: as the frame is drawn, in a layout effect.)
  useLayoutEffect(() => {
    const s = pic ? PICTURE_SOUND[pic.anim] : null;
    const key = `${at}:${pic?.anim}`;
    if (!s || sounded.has(key)) return;
    sounded.add(key);
    if (sounded.size > 40) sounded.delete(sounded.values().next().value!);
    play(s);
  }, [pic?.anim, at]);
  // (While it plays, a match menu already open shows above it: Moo's `mo-on`.)
  useLayoutEffect(() => {
    if (!on) return;
    document.body.classList.add("mo-on");
    return () => document.body.classList.remove("mo-on");
  }, [on]);
  // The light's canvas, handed to the light's worker once it's up (where a browser can), its drawing off the main thread (as Moo's).
  const lit = on && headlightOn(t);
  const cv = useRef<HTMLCanvasElement>(null);
  const worker = useRef<Worker | null>(null);
  useLayoutEffect(() => {
    const c = cv.current;
    if (!lit || !c || typeof Worker === "undefined" || !("transferControlToOffscreen" in c)) return;
    let w: Worker;
    try {
      w = new Worker(new URL("./recluse-light.worker.ts", import.meta.url), { type: "module" });
      const init = { back: null, front: c.transferControlToOffscreen(), beats: headlightBeats() };
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
    else drawLight(f, headlightBeats(), null, cv.current);
  });
  frame.current = null;
  // The board's box, read each frame: a board re-mounted or a phone turned mid-scene is followed.
  const rect = on ? boardOnScreen()?.getBoundingClientRect() : null;
  if (!pic || !rect || !rect.width) return null;
  // The area: the board and everything above it (Moo's).
  const computer = onComputer();
  const area = { x: computer ? rect.x : 0, y: 0, w: computer ? rect.width : innerWidth, h: rect.bottom };
  // The picture covers it, centered (the art keeps what matters away from its edges), in whole screen pixels.
  const k = Math.max(area.w / W, area.h / H);
  const box = { w: Math.ceil(W * k), h: Math.ceil(H * k) };
  const pos = { x: Math.round((area.w - box.w) / 2), y: Math.round((area.h - box.h) / 2) };
  if (lit) {
    const T = headlightBeats();
    const s = lightNow(t, T);
    s.shaft = 0;
    const lamps = headlightsAt(t);
    const mid = { x: area.x + pos.x + lamps.x * k, y: area.y + pos.y + lamps.y * k };
    // (The light's scale: grows with the train as it comes, a share of the picture's width.)
    const lk = box.w * (0.03 + 0.08 * clamp01((t - B.approachAt) / Math.max(1, C.approachMs)));
    frame.current = { t, bx: mid.x, by: mid.y, bw: 8 * lk, W: innerWidth, H: innerHeight, dpr: 1, mid, eyes: [], back: false, front: canvasesOn(s, t, false, T).front, noShaft: true };
  }
  const opacity = sceneOpacity(t);
  return createPortal(
    <div class="mo-cine bd-cine" data-t={Math.round(t)} data-pic={pic.anim}>
      <div class={`mo-area${opacity > 0 ? " mo-block" : ""}`} style={{ left: `${area.x}px`, top: `${area.y}px`, width: `${area.w}px`, height: `${area.h}px` }}>
        <div
          class="mo-pic bd-pic"
          data-frame={pic.column}
          style={{ left: `${pos.x}px`, top: `${pos.y}px`, width: `${box.w}px`, height: `${box.h}px`, opacity: String(opacity), backgroundImage: `url(${sheetUrl})`, backgroundSize: `${box.w * SHEET.frames}px ${box.h}px`, backgroundPosition: `${-pic.column * box.w}px 0` }}
        />
      </div>
      {lit && <canvas ref={cv} class="mo-light" style={{ width: `${innerWidth}px`, height: `${innerHeight}px` }} />}
    </div>,
    document.body,
  );
}
