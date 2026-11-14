/**
 * The Hidden Boss's transformation over the board (his phase change from its start to his leap home; the beats: PHASE_CHANGE in
 * recluse-phase2.ts; the figures: characters/recluse-transform.ts). Laid over the screen like his cutscene, which it carries on
 * without a break: the lens (the cutscene's dim with its round light), the child beside him until the white-out, the man, the book
 * at his feet, and the light on two canvases the size of the screen (behind him: the dark round it, the pool, the rays, the shaft;
 * over him: the beam's core and its motes, the glow engulfing him, the rays radiating over the whole screen, his white eyes' glow,
 * the white-out, the light dying back into the center, the flash as he lands). The light is the summoning's from his room
 * (town/shops/recluse-scene.ts): its sprites made once and stretched, drawn only while the phase change is up. His words stand
 * over his head (his voice's bubble, as on the board before). The board, its split and the arcs are the screen's
 * (screens/Recluse2.tsx), under this.
 */
import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef } from "preact/hooks";
import { RECLUSE_CUTSCENE as CS } from "@chessroyale/core";
import { RECLUSE, RECLUSE_JUMP, headOf } from "../characters/recluse.ts";
import { RECLUSE_CUTSCENE } from "../characters/recluse-ages.ts";
import { BOOK_MID, CHANGE_FIG, CHANGE_PLACE, CHEST, GROUND_Y, RECLUSE_CHANGE, RECLUSE_CHANGE_BOOK, RECLUSE_CHANGE_KID, SCENE_LEFT, SCENE_SHARE, SPOT, onBoard } from "../characters/recluse-transform.ts";
import { BOSS_KITS } from "../characters/kits.ts";
import { PHASE_CHANGE } from "../recluse-phase2.ts";
import { VoiceBubble, bossVoice } from "../speech.tsx";
import { SpriteAnim } from "./BossEffect.tsx";
import { canvasesOn, drawLight, lightNow, type LightBeats, type LightFrame } from "./recluse-light.ts";

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
/**
 * The light canvases' pixels per CSS pixel: one (Nov 14 review, B1; the director, on Eric's "if the light looks worse quality I'll
 * be upset": "keep 1 device pixel per CSS pixel, not 0.5"). Drawn in a worker, off the main thread (recluse-light.worker.ts).
 */
const LIGHT_DPR = 1;

/** The beats the light follows, for its worker (a plain object: PHASE_CHANGE is a lazy table). */
const beatsOf = (T: typeof PHASE_CHANGE): LightBeats => {
  const { burstAt, riseAt, shootAt, radiateAt, whiteAt, whiteFull, downAt, revealAt, crackAt, growAt, growMs, pickupAt } = T;
  return { burstAt, riseAt, shootAt, radiateAt, whiteAt, whiteFull, downAt, revealAt, crackAt, growAt, growMs, pickupAt };
};
let OPEN_MS: number | undefined;
/** His animations standing on the same spot after the reveal (his box stays put over them). */
const STANDING = new Set(["revealed", "flipUp", "flipDown", "crouch"]);
/** His figure at `t` (ms into the phase change): which animation, since when (ms into it), where his feet are (shares of the board). */
export function changeFigAt(t: number, computer: boolean): { anim: string; then?: string; since: number; feet: { x: number; y: number } } | null {
  const T = PHASE_CHANGE;
  const feet = SPOT;
  const openMs = (OPEN_MS ??= RECLUSE_CHANGE.anims.open!.frames.reduce((s, f) => s + f.ms, 0));
  if (t < 0) return { anim: "together", since: 0, feet };
  if (t < openMs) return { anim: "open", since: 0, feet };
  if (t < T.burstAt) return { anim: "glowing", since: 0, feet };
  if (t < T.riseAt) return { anim: "burst", since: T.burstAt, feet };
  if (t < T.riseAt + T.riseMs) return { anim: "rise", since: T.riseAt, feet };
  // (Hovering in the beam, a little higher as the light grows; set down unseen in the white.)
  if (t < T.whiteFull) return { anim: "beam", since: T.riseAt + T.riseMs, feet: { x: feet.x, y: feet.y - 0.03 * ease((t - T.riseAt - T.riseMs) / (T.whiteFull - T.riseAt - T.riseMs)) } };
  if (t < T.flipUpAt) return { anim: "revealed", since: T.whiteFull, feet };
  if (t < T.flipDownAt) return { anim: "flipUp", then: "faceOpen", since: T.flipUpAt, feet };
  if (t < T.crouchAt) return { anim: "flipDown", then: "revealed", since: T.flipDownAt, feet };
  if (t < T.upAt) return { anim: "crouch", since: T.crouchAt, feet };
  if (t < T.crackAt) {
    const u = (t - T.upAt) / (T.crackAt - T.upAt);
    return { anim: "air", since: T.upAt, feet: { x: feet.x, y: feet.y - 0.34 * 4 * u * (1 - u) } };
  }
  if (t < T.pickupAt) return { anim: "land", then: "landed", since: T.crackAt, feet };
  if (t < T.backAt) return { anim: "pickup", since: T.pickupAt, feet };
  const place = computer ? CHANGE_PLACE.computer : CHANGE_PLACE.phone;
  const u = clamp01((t - T.backAt - RECLUSE_JUMP.upAt) / (RECLUSE_JUMP.landAt - RECLUSE_JUMP.upAt));
  if (t < T.homeAt) return { anim: "leap2", since: T.backAt, feet: { x: feet.x + (place.x - feet.x) * u, y: feet.y + (place.y - feet.y) * u - 0.22 * 4 * u * (1 - u) } };
  return null;
}

/**
 * The transformation over `rect` (the board's box on the screen), `t` ms into the phase change (`at`: its start). `sceneStand`: ms
 * into the phase change of the cutscene's `together` loop's start, so his and the child's loop carries on unbroken.
 */
export function RecluseTransform({ at, t, rect, computer, sceneStand }: { at: number; t: number; rect: DOMRect; computer: boolean; sceneStand: number }) {
  const T = PHASE_CHANGE;
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const headAt = useRef<readonly [number, number] | null>(null);
  const fig = changeFigAt(t, computer);
  const W = innerWidth;
  const H = innerHeight;
  const bw = rect.width;
  const bx = rect.x + BOOK_MID.x * bw;
  const by = rect.y + BOOK_MID.y * bw;
  const lit = t < T.pickupAt + 600;
  const s = lightNow(t, T);
  const on = canvasesOn(s, t, !!headAt.current, T);
  // The light's worker: the two canvases handed to it once they're up (where a browser can), so their drawing is off the main
  // thread; ended with them. Elsewhere they're drawn here.
  const worker = useRef<Worker | null>(null);
  useLayoutEffect(() => {
    const b = back.current;
    const f = front.current;
    if (!lit || !b || !f || typeof Worker === "undefined" || !("transferControlToOffscreen" in b)) return;
    let w: Worker;
    try {
      w = new Worker(new URL("./recluse-light.worker.ts", import.meta.url), { type: "module" });
      const init = { back: b.transferControlToOffscreen(), front: f.transferControlToOffscreen(), beats: beatsOf(T) };
      w.postMessage({ init }, [init.back, init.front]);
    } catch {
      return;
    }
    worker.current = w;
    return () => {
      w.terminate();
      worker.current = null;
    };
  }, [lit]);
  useLayoutEffect(() => {
    const feet = fig?.feet ?? SPOT;
    const chest = t < T.whiteFull ? onBoard(feet, RECLUSE.foot[0], RECLUSE.foot[1] - 70) : CHEST;
    const mid = { x: rect.x + chest.x * bw, y: rect.y + chest.y * bw };
    const h = headAt.current;
    const eyes = h && t >= T.burstAt && t < T.whiteFull ? [onBoard(feet, h[0] + 9, h[1] + 18.5), onBoard(feet, h[0] + 16, h[1] + 18.5)].map((p) => ({ x: rect.x + p.x * bw, y: rect.y + p.y * bw })) : [];
    // (Each kept up while the light is; hidden, and not drawn, while it has nothing to draw.)
    if (back.current) back.current.style.visibility = on.back ? "" : "hidden";
    if (front.current) front.current.style.visibility = on.front ? "" : "hidden";
    if (!on.back && !on.front) return;
    const frame: LightFrame = { t, bx, by, bw, W, H, dpr: LIGHT_DPR, mid, eyes, back: on.back, front: on.front };
    if (worker.current) worker.current.postMessage({ frame });
    else drawLight(frame, T, back.current, front.current);
  });

  const px = (x: number) => `${x * 100}%`;
  const figStyle = (feet: { x: number; y: number }) => ({ left: px(feet.x - (CHANGE_FIG * RECLUSE.foot[0]) / RECLUSE.w), top: `${(feet.y - (CHANGE_FIG * RECLUSE.foot[1]) / RECLUSE.w) * bw}px`, width: px(CHANGE_FIG), aspectRatio: `${RECLUSE.w} / ${RECLUSE.h}` });
  const lens = t < T.whiteFull ? 1 : 0;
  const bookApart = t >= T.riseAt && t < T.crackAt + 90;
  return createPortal(
    <div class="cs-layer rc-transform" aria-hidden="true" data-t={Math.round(t)}>
      {lens > 0 && <div class="cs-dim" style={{ "--cs-x": `${rect.x + bw / 2}px`, "--cs-y": `${rect.y + bw / 2}px`, "--cs-r": `${bw * CS.spot}px`, "--cs-in": `${CS.spotInner * 100}%`, "--cs-a": String(CS.dimAlpha) }} />}
      {lit && <canvas ref={back} class="rc-light-cv" style={{ width: `${W}px`, height: `${H}px` }} />}
      <div class="cs-stage rc-tf-stage" style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${bw}px`, height: `${bw}px` }}>
        {t < T.whiteFull && (
          <span class="cs-fig rc-tf-kid" style={{ left: px(SCENE_LEFT), top: `${(GROUND_Y - (SCENE_SHARE * RECLUSE_CUTSCENE.foot[1]) / RECLUSE_CUTSCENE.w) * bw}px`, width: px(SCENE_SHARE), aspectRatio: `${RECLUSE_CUTSCENE.w} / ${RECLUSE_CUTSCENE.h}` }}>
            <SpriteAnim ch={RECLUSE_CHANGE_KID} anim="together" since={at + sceneStand} id="rc-tf-kid" />
          </span>
        )}
        {bookApart && (
          <span class="cs-fig rc-tf-book" style={figStyle(SPOT)}>
            <SpriteAnim ch={RECLUSE_CHANGE_BOOK} anim="glow" since={at + T.riseAt} id="rc-tf-book" />
          </span>
        )}
        {fig && (
          <span class="cs-fig rc-tf-fig" data-anim={fig.anim} style={figStyle(fig.feet)}>
            <SpriteAnim
              ch={RECLUSE_CHANGE}
              anim={fig.anim}
              then={fig.then}
              since={at + (fig.anim === "together" ? sceneStand : fig.since)}
              sounds={BOSS_KITS["Hidden Boss"]!.sounds}
              id="rc-tf-fig"
              onFrame={(f) => void (headAt.current = headOf(f))}
            />
            {/* His words over his head (his voice's bubble), mounted again with each of his animations so a box moved into view is
                placed again where he stands now; one mount while he stands in place (his first line runs from the visor up
                through the crouch, and a box mounted again in its fade would vanish at once). */}
            <span class="rc-say-at">
              <VoiceBubble key={STANDING.has(fig.anim) ? "stand" : fig.anim} voice={bossVoice} class="bc-bubble rc-say" />
            </span>
          </span>
        )}
      </div>
      {lit && <canvas ref={front} class="rc-light-cv rc-light-front" style={{ width: `${W}px`, height: `${H}px` }} />}
    </div>,
    document.body,
  );
}
