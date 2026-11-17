/**
 * Moo & Moon's Full Moon cinematic (Eric, Nov 17; docs/decisions/2026-11-17-moo-cinematic.md), the Full Moon's moment while he
 * thinks (components/Moo.tsx, `fullMoon`). Its beats, all settings (MOO_CINEMATIC in settings.ts; MOO_BEATS.fullMoon adds them up,
 * so the server and solo wait for all of it):
 * 1. He hops from his spot (the phone's bar, or beside the board on a computer) onto the board (his `move`).
 * 2. The field fades in over the board and everything above it: on a phone the whole width from the screen's top to the board's
 *    bottom (the top bar and the boss bar), on a computer the board's column from the top (the boss bar). He stands in it.
 * 3. A quick cut to the close-up of the two of them looking up at the moon; their eyes turn white; a quick cut back.
 * 4. His transformation (`fullMoon`, his colors going gold at its `swap`), a beat powered up, the field fades out.
 * 5. He hops back to his spot (his powered `move`).
 * Two pictures in one sheet (characters/moo-cinematic.png: the field's four frames, its stars twinkling, and the close-up's five,
 * normal to white eyes; drawn on claude/boss-art: scripts/boss-art/out/arena-moo-field and scripts/boss-art/moo-closeup), his own
 * sprite over the field, and opacities: no canvas of its own, no filters. Everything from the moment's start, so a screen drawn
 * later carries on and everyone online sees the same. Nothing takes a tap (pointer-events: none).
 */
import { createPortal } from "preact/compat";
import { useLayoutEffect, useState } from "preact/hooks";
import { MOO_CINEMATIC as C } from "@chessroyale/core";
import { MOO_BEATS } from "@chessroyale/chess";
import sheetUrl from "../characters/moo-cinematic.png?url";
import { bossKit } from "../characters/kits.ts";
import { BossMoment } from "./BossEffect.tsx";
import { useFrameNow } from "./Countdown.tsx";
import { onComputer } from "./PowerParts.tsx";
import { boardOnScreen, useRect } from "./RecluseCutscene.tsx";

const B = MOO_BEATS.fullMoon;
/** The pictures' own size (art pixels) and the sheet's frames: the field's four, then the close-up's five. */
const W = 200;
const H = 260;
const FIELD = [0, 1, 2, 3];
const FIELD_MS = 400;
const CLOSE = [4, 5, 6, 7, 8];
/** Where he stands in the field (art pixels): the field was drawn with this patch clear for him. */
const SPOT: readonly [number, number] = [100, 205];

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
let sheet: HTMLImageElement | null = null;
export function prewarmCinematic(): void {
  if (sheet || typeof Image === "undefined") return;
  sheet = new Image();
  sheet.src = sheetUrl;
  sheet.decode?.().catch(() => undefined);
}

/** `name`: the boss's name, as his kit is found (bossKit). */
export function MooCinematic({ at, name }: { at: number; name: string }) {
  const now = useFrameNow();
  const [board, setBoard] = useState<HTMLElement | null>(null);
  const [spot, setSpot] = useState<Box | null>(null);
  useLayoutEffect(() => {
    setBoard(boardOnScreen());
    setSpot(spotBox());
  }, []);
  const rect = useRect(board);
  const kit = bossKit(name);
  const t = now - at;
  if (!rect || !kit || t < 0 || t >= B.total) return null;
  const b = cineBeats();
  // The area: the board and everything above it.
  const computer = onComputer();
  const area = { x: computer ? rect.x : 0, y: 0, w: computer ? rect.width : innerWidth, h: rect.bottom };
  // The pictures cover it, centered (the art keeps what matters away from its edges), in whole screen pixels.
  const k = Math.max(area.w / W, area.h / H);
  const sw = Math.ceil(W * k);
  const sh = Math.ceil(H * k);
  const sx = Math.round((area.w - sw) / 2);
  const sy = Math.round((area.h - sh) / 2);
  const pic = (frame: number, opacity: number, cls: string) =>
    opacity > 0 && (
      <div
        class={`mo-pic ${cls}`}
        data-frame={frame}
        style={{ left: `${sx}px`, top: `${sy}px`, width: `${sw}px`, height: `${sh}px`, opacity: String(opacity), backgroundImage: `url(${sheetUrl})`, backgroundSize: `${sw * 9}px ${sh}px`, backgroundPosition: `${-frame * sw}px 0` }}
      />
    );
  // His figure: at the field's scale where he stands in it, flying between there and his spot on the hops.
  const ch = kit.ch;
  const stand: Box = { x: area.x + sx + (SPOT[0] - ch.foot[0]) * (sw / W), y: sy + (SPOT[1] - ch.foot[1]) * (sh / H), w: ch.w * (sw / W) };
  const from = spot ?? { x: area.x + area.w * 0.1, y: area.y, w: stand.w / 2 };
  const hop = t < b.landed ? hopP(t) : t >= b.hopBack ? 1 - hopP(t - b.hopBack) : 1;
  const lift = Math.sin(Math.PI * hop) * Math.max(40, 0.3 * Math.hypot(stand.x - from.x, stand.y - from.y));
  const fig: Box = { x: from.x + (stand.x - from.x) * hop, y: from.y + (stand.y - from.y) * hop - lift, w: from.w + (stand.w - from.w) * hop };
  const f = cineFigure(t);
  return createPortal(
    <div class="mo-cine" data-t={Math.round(t)}>
      <div class="mo-area" style={{ left: `${area.x}px`, top: `${area.y}px`, width: `${area.w}px`, height: `${area.h}px` }}>
        {pic(FIELD[Math.floor(Math.max(0, t) / FIELD_MS) % FIELD.length]!, fieldOpacity(t), "mo-field")}
        {pic(CLOSE[closeFrame(t)]!, closeOpacity(t), "mo-close")}
      </div>
      <BossMoment boss={name} anim={f.anim} since={at + f.since} class="mo-cine-fig" style={{ left: `${fig.x}px`, top: `${fig.y}px`, width: `${fig.w}px` }} />
    </div>,
    document.body,
  );
}
