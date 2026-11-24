/**
 * The crate opening's picture (Nov 24; the approved mockup, built: docs/decisions/2026-11-24-crate-open-build.md).
 *
 * - `OpenLayer`: the whole opening sits on its own layer, on the mockup's blue-black (Eric, Nov 24: "the full phone screen takes over
 *   ... using this blue and black background"): the whole window on a phone, the middle column (between the side menu and the right
 *   column) on a computer ("it can take up that middle space"). It's laid over the screen it was opened from, which stays mounted and
 *   untouched under it, so closing leaves you exactly where you were.
 * - `CrateStage`: one strip and what comes after it. The strip spins with depth (its ends in shadow, a glowing line, a motion-blurred
 *   copy fading as it slows), creeps over the winning tile's near edge and settles; then either the winning box drops in, shakes and
 *   bursts open with a beam of light in the item's tier color (`ending: "box"`), or the beam comes straight up out of the winning tile
 *   (Fischer Random's second strip: `"beam"`), or nothing (Fischer Random's first strip, before its banner: `"none"`). The item rises
 *   out of the beam into the reveal card, which forms round it.
 *
 * Everything moves by transform and opacity in Web Animations (on the compositor, not the main thread), set up as the stage mounts
 * (while "Opening…" waits for the server) and started together once the answer is in, with the sound laid on the audio clock at the
 * same moment (sound.ts `playCrateCues`, timeline.ts `cues`): no frame loop anywhere. Reduced motion: no blur, shake or jolt; the box
 * fades in and the beam fades up.
 */
import "./crate-open.css";
import type { ComponentChildren, JSX } from "preact";
import { createPortal } from "preact/compat";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";
import { tierInfo, type ItemTier } from "@chessroyale/core";
import { lightMasks } from "../components/recluse-light.ts";
import { playCrateCues } from "../sound.ts";
import { BONUS, OVERSHOOT, TIER_POWER, clickTimes, cues, isBig, stripEase, stripTarget, timeline, type Timeline } from "./timeline.ts";

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The capture hooks (the preview page's frames script): every running stage's animations, to stop the clock anywhere. */
type Hooks = { __crateAnims?: Animation[] };
const hooks = globalThis as Hooks;

/**
 * The light's masks as CSS images, made once (the first opening: a few ms, while "Opening…" waits), colored by CSS in the tier's
 * color (crate-open.css).
 */
let masks: Record<string, string> | null = null;
function maskVars(): Record<string, string> {
  if (!masks) {
    const m = lightMasks();
    const url = (c: HTMLCanvasElement | OffscreenCanvas) => `url(${(c as HTMLCanvasElement).toDataURL()})`;
    masks = { "--m-ray": url(m.ray), "--m-tinted": url(m.tinted), "--m-shaft": url(m.shaft), "--m-core": url(m.core), "--m-round": url(m.round) };
  }
  return masks;
}

/**
 * The opening's layer: on the body, over everything; on a computer (the frame's three columns) only the middle column, read from the
 * frame it was opened in. Nothing under it scrolls or hears a tap.
 */
export function OpenLayer({ label, children }: { label: string; children: ComponentChildren }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // (A layout effect: placed in the commit that shows it, so it never shows a frame over the whole window first.)
  useLayoutEffect(() => {
    const place = () => {
      const el = root.current;
      if (!el) return;
      const frame = anchor.current?.closest<HTMLElement>(".fd-root.framed");
      const wide = typeof matchMedia === "function" && matchMedia("(min-width: 1024px)").matches;
      const cs = frame && wide ? getComputedStyle(frame) : null;
      const side = (v: string | undefined) => (v && v.trim() ? v.trim() : "0px");
      el.style.left = cs ? side(cs.getPropertyValue("--fd-menu")) : "0px";
      el.style.right = cs ? side(cs.getPropertyValue("--fd-rail")) : "0px";
      el.classList.toggle("desk", !!cs);
      // A short window (a phone on its side): the stage scaled down whole to fit under the title, nothing cut off.
      const head = el.querySelector<HTMLElement>(".cox-head");
      const pad = parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom);
      const room = el.clientHeight - pad - (head?.offsetHeight ?? 0) - 8;
      el.style.setProperty("--cox-fit", String(Math.min(1, Math.max(0.4, room / 540))));
    };
    place();
    root.current?.focus({ preventScroll: true });
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, []);
  // (A wheel or a drag on it moves nothing, under it or in it.)
  const still = (e: Event) => e.preventDefault();
  useEffect(() => {
    const el = root.current!;
    el.addEventListener("wheel", still, { passive: false });
    el.addEventListener("touchmove", still, { passive: false });
    return () => {
      el.removeEventListener("wheel", still);
      el.removeEventListener("touchmove", still);
    };
  }, []);
  return (
    <>
      <span ref={anchor} hidden />
      {createPortal(
        <div ref={root} class="cox-layer crate-opening" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} data-testid="crate-opening">
          {/* The strip's motion blur: a horizontal-only blur for its blurred copy. */}
          <svg width="0" height="0" class="cox-defs" aria-hidden="true">
            <filter id="cox-hblur" x="-5%" width="110%">
              <feGaussianBlur stdDeviation="9 0" />
            </filter>
          </svg>
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}

export type Ending = "box" | "beam" | "none";

export function CrateStage({
  tiles,
  land,
  tile,
  ending,
  tier,
  Box,
  lid,
  item,
  cardClass = "",
  cardBody,
  go,
  hidden = false,
  onStop,
  onCard,
}: {
  /** How many tiles, which one it lands on, and each tile (drawn twice: the strip and its blurred copy). */
  tiles: number;
  land: number;
  tile: (i: number) => JSX.Element;
  /** What follows the strip (null until the server answers: set up for a box meanwhile). */
  ending: Ending | null;
  /** The item's tier (its light's color and size), once known. */
  tier: ItemTier | null;
  /** The crate's box art (its look's), drawn in the tier's color. */
  Box: (p: { color: string }) => JSX.Element;
  /** Where the box's lid ends, as a share of its height (the lid flies off there). */
  lid: number;
  /** The item's picture, rising out of the light. */
  item: JSX.Element | null;
  /** The reveal card's classes ("shiny", "special") and everything under its picture (Crates.tsx `RevealDetails`). */
  cardClass?: string;
  cardBody: ComponentChildren;
  /** Start (the answer is in, the strip's tiles final). */
  go: boolean;
  /** Mounted ahead and out of sight (Fischer Random's second strip, under its banner). */
  hidden?: boolean;
  /** The strip has stopped and settled (and a beat). */
  onStop?: () => void;
  /** The card has formed: the reveal is shown. */
  onCard?: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const built = useRef<{ T: Timeline; anims: Animation[]; ending: Animation[]; width: number } | null>(null);
  const started = useRef(false);
  const color = tier ? tierInfo(tier).color : "#c7d2fe";
  const T = timeline(undefined, ending !== "beam");
  const reduced = reducedMotion();

  // Set up while "Opening…" waits: the strip, and (unless it's known there's none) the ending, all paused at their first frame.
  useEffect(() => {
    const root = stage.current!;
    for (const [k, v] of Object.entries(maskVars())) root.style.setProperty(k, v);
    const width = root.querySelector<HTMLElement>(".cox-reel-window")!.offsetWidth;
    const strip = buildStrip(root, T, land, width, reduced);
    const end = ending === "none" ? [] : buildEnding(root, T, ending ?? "box", lid, reduced);
    for (const a of [...strip, ...end]) a.pause();
    built.current = { T, anims: strip, ending: end, width };
    return () => {
      for (const a of [...strip, ...end]) a.cancel();
      built.current = null;
    };
  }, []);

  // Go: the answer's in. Drop what doesn't apply, add the tier's extras, and start every animation and every sound together: two frames
  // on, so the answer's own drawing (its tiles, the card, the item) is painted while the strip is still at rest, not on its first frames.
  useEffect(() => {
    const b = built.current;
    if (!go || !b || started.current || ending === null) return;
    started.current = true;
    const root = stage.current!;
    let stopSound = () => undefined as void;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (ending === "none") b.ending.forEach((a) => a.cancel());
    const all = [...b.anims, ...(ending === "none" ? [] : b.ending)];
    const light = ending !== "none" && tier ? buildTierLight(root, b.T, tier, reduced) : [];
    for (const a of light) all.push((a.pause(), a));
    let ran = false;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        ran = true;
        // (A frame's lead, so the first frame drawn is the strip's first.)
        const lead = 50;
        const start = (document.timeline.currentTime as number) + lead;
        for (const a of all) a.startTime = start;
        hooks.__crateAnims = all;
        stopSound = playCrateCues(cues(b.T, clickTimes(b.T.spinMs, b.width, land), ending === "none" ? null : tier), lead);
        if (onStop) timers.push(setTimeout(onStop, lead + b.T.stop + 450));
        if (ending !== "none" && onCard) timers.push(setTimeout(onCard, lead + b.T.cardAt + b.T.cardMs));
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      stopSound();
      timers.forEach(clearTimeout);
      // (Called off before it started (its answer taken back): ready to start again on the next one, its tier's light made anew then.)
      if (!ran) {
        started.current = false;
        light.forEach((a) => a.cancel());
      }
    };
  }, [go, ending]);

  return (
    <div
      class={`cox-stage${tier && isBig(tier) ? " big" : ""}${ending === "beam" ? " beam" : ""}${hidden ? " cox-ahead" : ""}${reduced ? " still" : ""}`}
      ref={stage}
      style={{ "--tier": color, "--power": String(tier ? TIER_POWER[tier] : 0.5), "--lid": String(lid) }}
      aria-hidden={hidden ? "true" : undefined}
    >
      {/* The light, behind everything it lights: the rays over the whole stage (Legendary and Mythic), the rays, the pool, the beam. */}
      <div class="cox-light cox-radiate">
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} style={{ "--a": `${(i / 14) * 360 + 7}deg` }} />
        ))}
      </div>
      <div class="cox-light cox-rays">
        {Array.from({ length: RAYS }, (_, i) => (
          <i key={i} style={{ "--a": `${(i / RAYS) * 360 + ((i * 37) % 11) - 5}deg`, "--len": String(0.55 + 0.45 * (((i * 53) % 10) / 10)) }} />
        ))}
      </div>
      <div class="cox-light cox-pool" />
      <div class="cox-light cox-beam">
        <div class="cox-beam-shaft" />
        <div class="cox-beam-core" />
        <div class="cox-motes">
          {Array.from({ length: 16 }, (_, i) => (
            <i key={i} style={{ left: `${8 + ((i * 41) % 84)}%` }} />
          ))}
        </div>
      </div>
      {/* The box: two copies of its own art, the lid and the body, so the lid can fly off. */}
      <div class="cox-box" aria-hidden="true">
        <div class="cox-seam" />
        <div class="cox-box-body">
          <Box color={color} />
        </div>
        <div class="cox-box-lid">
          <Box color={color} />
        </div>
        <div class="cox-flash" />
      </div>
      {/* The strip. */}
      <div class="cox-reel">
        <div class="cox-reel-window">
          <div class="cox-track sharp">{Array.from({ length: tiles }, (_, i) => <TileSlot key={i} win={i === land} tile={tile(i)} />)}</div>
          {!reduced && (
            <div class="cox-track blur" aria-hidden="true">
              {Array.from({ length: tiles }, (_, i) => tile(i))}
            </div>
          )}
          <div class="cox-reel-dim" />
          <div class="cox-reel-shade" />
        </div>
        <div class="cox-line">
          <i class="top" />
          <i class="bottom" />
        </div>
        <div class="cox-line-flare" />
      </div>
      {/* The reveal card (the game's own), forming round the risen item. */}
      {/* (Only a card that will form is a reveal card: Fischer Random's first strip's stays an unseen shell.) */}
      <div class={`ff-window cox-card${cardBody ? " reveal-card" : ""}${cardClass ? ` ${cardClass}` : ""}`}>
        <span class="reveal-tier">{tier ? tierInfo(tier).name : " "}</span>
        <span class="reveal-art cox-card-art" />
        {cardBody}
      </div>
      <div class="cox-item" aria-hidden="true">
        <div class="cox-item-glow" />
        {item}
      </div>
      <div class="cox-whiteout" />
    </div>
  );
}

/**
 * The bonus crate's card (Nov 24; docs/decisions/2026-11-24-bonus-crate.md): a second card over the item's, on a short gold beam. The
 * item's stage dims behind it (and takes no tap while it's up), the opening's own beam (its shaft and core) shoots up in gold behind
 * the card, and a reveal card forms round `children` (Crates.tsx `BonusCard`'s crate, name and key) as the item's card
 * formed. Web Animations on transform and opacity, as the opening's; reduced motion: the beam fades up, the card fades in. Its beats:
 * timeline.ts `BONUS`.
 */
export function BonusStage({ children }: { children: ComponentChildren }) {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = stage.current!;
    for (const [k, v] of Object.entries(maskVars())) root.style.setProperty(k, v);
    const reduced = reducedMotion();
    const out: Animation[] = [];
    const at = animator(out);
    const $ = (s: string) => root.querySelector(s) as HTMLElement;
    at($(".cox-bonus-dim"), [{ opacity: 0 }, { opacity: 1 }], 0, 220, { easing: "ease-out" });
    const beam = $(".cox-beam");
    if (reduced) at(beam, [{ opacity: 0, transform: "none" }, { opacity: 1, transform: "none" }], 60, 300, { easing: "ease-out" });
    else at(beam, [{ transform: "scaleY(0) scaleX(0.5)", opacity: 1 }, { transform: "scaleY(1.04) scaleX(1.15)", opacity: 1, offset: 0.55 }, { transform: "scaleY(1) scaleX(1)", opacity: 1 }], 60, BONUS.beamMs, { easing: "cubic-bezier(.1,.9,.3,1)" });
    at(beam, [{ opacity: 1 }, { opacity: 0.35 }], BONUS.cardAt + BONUS.cardMs, 500, { fill: "forwards", easing: "ease-out", composite: "replace" });
    const card = $(".cox-card");
    at(card, [{ visibility: "hidden" }, { visibility: "visible" }], BONUS.cardAt, 1, { easing: "steps(1, start)" });
    at(card, [{ opacity: 0, transform: reduced ? "none" : "translateY(40px) scale(0.86)" }, { opacity: 1, transform: "none" }], BONUS.cardAt, BONUS.cardMs, { easing: "cubic-bezier(.2,1.3,.4,1)" });
    return () => out.forEach((a) => a.cancel());
  }, []);
  return (
    <div class="cox-stage cox-bonus" ref={stage} style={{ "--tier": "#fbbf24", "--power": "0.55", "--lid": "0.5" }} data-testid="crate-bonus">
      <div class="cox-bonus-dim" />
      <div class="cox-light cox-beam">
        <div class="cox-beam-shaft" />
        <div class="cox-beam-core" />
      </div>
      <div class="ff-window cox-card reveal-card special cox-bonus-card" role="dialog" aria-label="Bonus crate">
        {children}
      </div>
    </div>
  );
}

/** The most rays a tier's light has (Mythic's); a lower tier's light shows fewer (`buildTierLight`). */
const RAYS = 18;

/** A strip's tile, as the caller draws it, the winner marked (it lifts at the stop). */
function TileSlot({ tile, win }: { tile: JSX.Element; win: boolean }) {
  return win ? <span class="cox-win">{tile}</span> : tile;
}

type At = (el: Element, kf: Keyframe[], start: number, dur: number, o?: KeyframeAnimationOptions) => void;
function animator(out: Animation[]): At {
  return (el, kf, start, dur, o = {}) => void out.push(el.animate(kf, { delay: start, duration: dur, fill: "both", easing: "linear", ...o }));
}

/** The strip: its travel (a cubic ease-out, an overshoot settling back), the blurred copy fading, the line, the winner lifting. */
function buildStrip(root: HTMLElement, T: Timeline, land: number, width: number, reduced: boolean): Animation[] {
  const $ = (s: string) => root.querySelector(s) as HTMLElement;
  const out: Animation[] = [];
  const at = animator(out);
  const peak = stripTarget(width, land) + OVERSHOOT;
  const kf: Keyframe[] = [];
  const total = T.spinMs + T.settleMs;
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    kf.push({ transform: `translate3d(${-peak * stripEase(u)}px,0,0)`, offset: (u * T.spinMs) / total });
  }
  // (The settle: back onto the stop, eased.)
  for (let i = 1; i <= 6; i++) {
    const v = i / 6;
    const e = v * v * (3 - 2 * v);
    kf.push({ transform: `translate3d(${-(peak - OVERSHOOT * e)}px,0,0)`, offset: (T.spinMs + v * T.settleMs) / total });
  }
  for (const tr of root.querySelectorAll(".cox-track")) at(tr, kf, 0, total);
  // The blurred copy over it, fading as it slows (gone by 45% of the spin), the sharp one under it always.
  if (!reduced) at($(".cox-track.blur"), [{ opacity: 0.95 }, { opacity: 0.95, offset: 0.12 }, { opacity: 0 }], 0, T.spinMs * 0.45);
  // The line glows harder while it's fast; it flares at the stop.
  at($(".cox-line"), [{ opacity: 0.85 }, { opacity: 1 }], 0, T.spinMs);
  at($(".cox-line-flare"), [{ opacity: 0, transform: "scaleY(0.6)" }, { opacity: 1, transform: "scaleY(1.15)", offset: 0.25 }, { opacity: 0, transform: "scaleY(1)" }], T.stop - 40, 420);
  // The winner lifts, the others dim round it.
  at($(".cox-track.sharp .cox-win"), [{ transform: "none" }, { transform: "translateY(-7px) scale(1.12)" }], T.stop - 60, 200, { easing: "cubic-bezier(.2,1.6,.4,1)" });
  at($(".cox-reel-dim"), [{ opacity: 0 }, { opacity: 1 }], T.stop - 60, 200);
  return out;
}

/** After the strip: the box (or the winning tile's flare), the beam, the item rising and the card forming. The tier's color is CSS. */
function buildEnding(root: HTMLElement, T: Timeline, ending: "box" | "beam", lidCut: number, reduced: boolean): Animation[] {
  const $ = (s: string) => root.querySelector(s) as HTMLElement;
  const out: Animation[] = [];
  const at = animator(out);
  const box = $(".cox-box");
  // The strip falls back and fades as the box drops (or as the beam comes up out of the winner).
  at($(".cox-reel"), [{ opacity: 1, transform: "none" }, { opacity: 0, transform: reduced ? "none" : "translateY(18px) scale(0.94)" }], ending === "box" ? T.dropAt + 40 : T.burstAt + 120, 260, { easing: "ease-in" });

  if (ending === "box") {
    // ---- The box: drops, lands (a squash), shakes harder and harder, the lid bursts off.
    at(box, [{ opacity: 0 }, { opacity: 1 }], T.dropAt, reduced ? 200 : 60);
    if (!reduced) {
      at(
        box,
        [
          { transform: "translateY(-340px) scale(0.9)" },
          { transform: "translateY(0) scale(1.08, 0.86)", offset: T.dropMs / (T.dropMs + 160), easing: "cubic-bezier(.3,1.5,.5,1)" },
          { transform: "translateY(0) scale(1)" },
        ],
        T.dropAt,
        T.dropMs + 160,
        { easing: "cubic-bezier(.55,0,1,.45)" },
      );
      // The shake, on the box's parts (so it adds to the drop): faster and wider to the burst.
      const shake: Keyframe[] = [];
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const amp = 2 + 9 * u * u;
        const side = i % 2 ? 1 : -1;
        shake.push({ transform: i === steps ? "none" : `translate(${side * amp * 0.35}px, ${-amp * 0.25}px) rotate(${side * amp}deg)`, offset: 1 - (1 - u) ** 1.5 });
      }
      for (const part of [$(".cox-box-body"), $(".cox-box-lid")]) at(part, shake, T.landAt, T.shakeMs);
    }
    // Light leaking from the lid's seam, building to the burst.
    const seam = $(".cox-seam");
    at(seam, [{ opacity: 0, transform: "scaleX(0.4)" }, { opacity: 0.5, offset: 0.5 }, { opacity: 1, transform: "scaleX(1.1)" }], T.landAt + 80, T.shakeMs - 80, { easing: "ease-in" });
    at(seam, [{ opacity: 1 }, { opacity: 0 }], T.burstAt, 200, { fill: "forwards" });
    // The lid flies off, turning (or, reduced, fades); the body stays and fades behind the card.
    // (Its flight, as high as the tier's light: buildTierLight.)
    const lid = $(".cox-box-lid");
    at(lid, [{ opacity: 1 }, { opacity: 0 }], T.burstAt + (reduced ? 0 : 380), 260, { fill: "forwards" });
    at($(".cox-box-body"), [{ opacity: 1 }, { opacity: 0 }], T.cardAt + 100, 300, { fill: "forwards" });
    at($(".cox-flash"), [{ opacity: 0, transform: "scale(0.4)" }, { opacity: 1, transform: "scale(1.2)", offset: 0.2 }, { opacity: 0, transform: "scale(1.9)" }], T.burstAt, 450);
    at($(".cox-pool"), [{ opacity: 0, transform: "scale(0.3)" }, { opacity: 1, transform: "scale(1)" }], T.landAt + 100, T.burstAt - T.landAt, { easing: "ease-in" });
  } else {
    // Fischer Random's: no box; the winning tile flares and the light comes up out of it.
    at($(".cox-pool"), [{ opacity: 0, transform: "scale(0.3)" }, { opacity: 1, transform: "scale(1)" }], T.stop, T.burstAt - T.stop, { easing: "ease-in" });
  }

  // ---- The light: the beam shooting up (reduced: fading up), the rays fanning out behind it, motes rising in it.
  const beam = $(".cox-beam");
  if (reduced) at(beam, [{ opacity: 0, transform: "none" }, { opacity: 1, transform: "none" }], T.burstAt, 400, { easing: "ease-out" });
  else at(beam, [{ transform: "scaleY(0) scaleX(0.5)", opacity: 1 }, { transform: "scaleY(1.04) scaleX(1.15)", opacity: 1, offset: 0.55 }, { transform: "scaleY(1) scaleX(1)", opacity: 1 }], T.burstAt, 320, { easing: "cubic-bezier(.1,.9,.3,1)" });
  if (!reduced) at($(".cox-beam-shaft"), [{ opacity: 0.85 }, { opacity: 1 }, { opacity: 0.8 }, { opacity: 1 }, { opacity: 0.9 }], T.burstAt, 900, { iterations: Infinity });
  at(beam, [{ opacity: 1 }, { opacity: 0.35 }], T.cardAt, 500, { fill: "forwards", easing: "ease-out", composite: "replace" });
  const rays = $(".cox-rays");
  if (reduced) at(rays, [{ opacity: 0 }, { opacity: 0.55 }], T.burstAt + 30, 600);
  else at(rays, [{ opacity: 0, transform: "scale(0.2) rotate(0deg)" }, { opacity: 1, transform: "scale(1) rotate(8deg)", offset: 0.12 }, { opacity: 0.55, transform: "scale(1.06) rotate(40deg)" }], T.burstAt + 30, 3400, { easing: "cubic-bezier(.2,.8,.4,1)" });
  if (!reduced)
    [...root.querySelectorAll(".cox-motes i")].forEach((m, i) =>
      at(m, [{ transform: "translateY(0)", opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: `translateY(-${180 + ((i * 29) % 160)}px)`, opacity: 0 }], T.burstAt + 60 + ((i * 97) % 700), 900 + ((i * 131) % 700), { iterations: Infinity }),
    );

  // ---- The item rises out of the box (or the tile) into the card's picture; the card forms round it.
  const item = $(".cox-item");
  const sr = root.getBoundingClientRect();
  const ar = $(".cox-card-art").getBoundingClientRect();
  let from: { x: number; y: number };
  if (ending === "box") {
    const br = box.getBoundingClientRect();
    from = { x: br.left + br.width / 2 - sr.left, y: br.top + br.height * lidCut - sr.top };
  } else {
    const wr = $(".cox-reel-window").getBoundingClientRect();
    from = { x: wr.left + wr.width / 2 - sr.left, y: wr.top + wr.height / 2 - sr.top };
  }
  const to = { x: ar.left + ar.width / 2 - sr.left, y: ar.top + ar.height / 2 - sr.top };
  // (In the stage's own pixels: the stages are scaled down whole on a short window.)
  const k = sr.width / root.offsetWidth || 1;
  for (const p of [from, to]) {
    p.x /= k;
    p.y /= k;
  }
  item.style.left = `${to.x}px`;
  item.style.top = `${to.y}px`;
  const move = reduced ? "" : ` translate(${from.x - to.x}px, ${from.y - to.y}px) scale(0.25)`;
  at(
    item,
    [
      { transform: `translate(-50%,-50%)${move}`, opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { transform: `translate(-50%,-50%) translateY(${reduced ? 0 : -10}px) scale(${reduced ? 1 : 1.06})`, offset: 0.8 },
      { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
    ],
    T.riseAt,
    T.riseMs,
    { easing: "cubic-bezier(.2,.7,.3,1)" },
  );
  at($(".cox-item-glow"), [{ opacity: 0.9, transform: "scale(1.4)" }, { opacity: 0.55, transform: "scale(1)" }], T.riseAt, T.riseMs + 300);
  // (Hidden, not just see-through, until it forms: nothing on it can be tapped or found before.)
  // (Two animations: the visibility, which only the page can change, apart from the fade and scale, which run on the compositor.)
  const card = $(".cox-card");
  at(card, [{ visibility: "hidden" }, { visibility: "visible" }], T.cardAt, 1, { easing: "steps(1, start)" });
  at(card, [{ opacity: 0, transform: reduced ? "none" : "scale(0.86)" }, { opacity: 1, transform: "none" }], T.cardAt, T.cardMs, { easing: "cubic-bezier(.2,1.3,.4,1)" });
  return out;
}

/** The tier's own: how many rays, and for Legendary and Mythic the light over the whole stage, a flash and (not reduced) a jolt. */
function buildTierLight(root: HTMLElement, T: Timeline, tier: ItemTier, reduced: boolean): Animation[] {
  const out: Animation[] = [];
  const at = animator(out);
  const power = TIER_POWER[tier];
  // The box's lid flying off, turning, as high as the light is strong (added to its shake).
  const lid = root.querySelector(".cox-box-lid");
  if (T.box && lid && !reduced)
    out.push(
      lid.animate(
        [
          { transform: "translate(0,0) rotate(0)" },
          { transform: `translate(-46px, -${220 + 80 * power}px) rotate(-38deg)`, offset: 0.7 },
          { transform: `translate(-60px, -${250 + 90 * power}px) rotate(-52deg)` },
        ],
        { delay: T.burstAt, duration: 640, fill: "forwards", easing: "cubic-bezier(.15,.8,.3,1)", composite: "add" },
      ),
    );
  const n = Math.round(8 + 10 * power);
  root.querySelectorAll<HTMLElement>(".cox-rays i").forEach((r, i) => (r.style.display = i < n ? "" : "none"));
  if (!isBig(tier)) return out;
  const radiate = root.querySelector(".cox-radiate")!;
  if (reduced) at(radiate, [{ opacity: 0 }, { opacity: 0.4 }], T.burstAt, 600);
  else at(radiate, [{ opacity: 0, transform: "scale(0.3) rotate(0deg)" }, { opacity: 0.9, transform: "scale(1) rotate(6deg)", offset: 0.15 }, { opacity: 0.4, transform: "scale(1.05) rotate(30deg)" }], T.burstAt, 3000, { easing: "cubic-bezier(.2,.8,.4,1)" });
  at(root.querySelector(".cox-whiteout")!, [{ opacity: 0 }, { opacity: reduced ? 0.4 : 0.85, offset: 0.12 }, { opacity: 0 }], T.burstAt - 20, 560, { easing: "ease-out" });
  if (!reduced) {
    const jolt: Keyframe[] = [0, -6, 5, -4, 3, -2, 1, 0].map((x, i) => ({ transform: `translate(${x}px, ${i % 2 ? -x / 2 : x / 2}px)` }));
    at(root, jolt, T.burstAt, 380);
  }
  return out;
}
