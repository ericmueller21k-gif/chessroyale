import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { HunchessCrateArt } from "./Items.tsx";
import {
  TUTORIAL_CRATE_LABEL,
  TUTORIAL_HANDBOOK_SLIDE,
  TUTORIAL_SEEN_KEY,
  crateBars,
  shouldSaveSeen,
  shouldShowTutorial,
  slideSpotId,
  tutorialSlides,
  type TutorialSlide,
} from "../tutorial.ts";
import { account } from "../account.ts";

/**
 * The first-time walkthrough over the home screen. A slide's spot (its `data-tour` element) is cut out of the dim: the spot
 * is the element's exact box and radius, transparent inside, its box-shadow dimming everything outside. A soft gold glow
 * starts at the element's edge and pulses; the element is lifted slightly (scaled from its centre). The highlight glides to the next spot; the
 * bubble is docked at the bottom of the screen while the spot's centre is in the top half, and at the top once it is past
 * halfway, fading when it moves. A slide with no spot (the Handbook) dims the whole screen. Tap anywhere to go on. The last
 * slide shows both Welcome Crates and a "Go to your inventory" button (the shop's Crates tab). "Don't show this tutorial
 * again" starts unticked: finishing every slide saves it; Skip saves it only when ticked. Storage is read and written in try/catch.
 */

/** Settings' "Show the walkthrough again": a one-shot session flag (for when Home mounts) and an event (when it's mounted). */
export const WALKTHROUGH_REPLAY_KEY = "hunchess.tutorial.replay";
export const WALKTHROUGH_REPLAY_EVENT = "hunchess:walkthrough";

const DOCK_MOVE_MS = 180;
const GLIDE_MS = 250;

function readSeen(): string | null {
  try {
    return localStorage.getItem(TUTORIAL_SEEN_KEY);
  } catch {
    return null;
  }
}

function saveSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
  } catch {
    /* no storage: the walkthrough just shows again next time */
  }
}

/** Clears the "don't show again" flag and asks for the walkthrough to start over. */
export function replayWalkthrough(): void {
  try {
    localStorage.removeItem(TUTORIAL_SEEN_KEY);
  } catch {
    /* no storage */
  }
  try {
    sessionStorage.setItem(WALKTHROUGH_REPLAY_KEY, "1");
  } catch {
    /* no storage */
  }
  dispatchEvent(new Event(WALKTHROUGH_REPLAY_EVENT));
}

function takeReplay(): boolean {
  try {
    const on = sessionStorage.getItem(WALKTHROUGH_REPLAY_KEY) === "1";
    sessionStorage.removeItem(WALKTHROUGH_REPLAY_KEY);
    return on;
  } catch {
    return false;
  }
}

function reducedMotion(): boolean {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** The element a slide lights up: the first one on screen (a computer has some spots twice, one of them hidden). */
function spotElement(slide: TutorialSlide): HTMLElement | null {
  const id = slideSpotId(slide);
  if (!id) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** How much a lit spot grows: a little more for the small top-bar icons. */
function litScale(el: HTMLElement): number {
  return el.classList.contains("fd-icon-btn") || el.closest(".fd-top") ? 1.12 : 1.05;
}

interface SpotBox {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
  scale: number;
}

/**
 * The cut-out for an element: its exact box and radius (no padding, so no page colour shows round it). A lit element is
 * scaled about its centre, so its centre stays put and its size comes from offsetWidth/offsetHeight (untransformed): the
 * cut-out is the same whether or not the lift is on yet.
 */
function boxOf(el: HTMLElement, lit: boolean): SpotBox {
  const r = el.getBoundingClientRect();
  const w = el.offsetWidth || r.width;
  const h = el.offsetHeight || r.height;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const own = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  return {
    top: cy - h / 2,
    left: cx - w / 2,
    width: w,
    height: h,
    radius: Math.min(own, Math.min(w, h) / 2),
    scale: lit ? litScale(el) : 1,
  };
}

/** Opens the shop on its Crates tab: the URL `?crates` the shop reads on mount, the same as the shop's own deep link. */
function goToCrates(onShop: () => void): void {
  // (The shop's own open leaves the URL at "/", so the query goes on after it: the shop mounts on the next render.)
  onShop();
  try {
    history.replaceState(null, "", "/shop?crates");
  } catch {
    /* no history: the shop opens on its Shop tab */
  }
}

export function Walkthrough({ onShop }: { onShop: () => void }) {
  const [open, setOpen] = useState<boolean>(() => takeReplay() || shouldShowTutorial(readSeen()));
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);
  const [spot, setSpot] = useState<SpotBox | null>(null);
  const [gliding, setGliding] = useState(false);
  const [dock, setDock] = useState<"top" | "bottom">("bottom");
  const [moving, setMoving] = useState(false);
  const target = useRef<HTMLElement | null>(null);
  const slides = tutorialSlides();
  const slide = slides[step];
  const reduce = reducedMotion();

  useEffect(() => {
    const again = () => {
      takeReplay();
      setStep(0);
      setOpen(true);
    };
    addEventListener(WALKTHROUGH_REPLAY_EVENT, again);
    return () => removeEventListener(WALKTHROUGH_REPLAY_EVENT, again);
  }, []);

  // Light up the slide's spot: the old one's lift comes off (it fades back, its transition stays), the new one lifts, and the
  // cut-out glides to it. Measured with the new lift already in place (its centre doesn't move, so the box is the same).
  useLayoutEffect(() => {
    if (!open || !slide) return;
    const el = spotElement(slide);
    const prev = target.current;
    if (prev && prev !== el) prev.classList.remove("wt-lit");
    target.current = el;
    if (el) {
      el.classList.add("wt-track");
      if (reduce) el.classList.remove("wt-lit");
      else {
        el.style.setProperty("--wt-scale", String(litScale(el)));
        el.classList.add("wt-lit");
      }
    }
    setSpot(el ? boxOf(el, !reduce) : null);
    if (reduce) return;
    setGliding(true);
    const t = setTimeout(() => setGliding(false), GLIDE_MS + 50);
    return () => clearTimeout(t);
  }, [open, step]);

  // Follow the target on resize and scroll (the cut-out follows at once; only a slide change glides).
  useEffect(() => {
    if (!open) return;
    const follow = () => {
      const el = target.current;
      setSpot(el ? boxOf(el, el.classList.contains("wt-lit")) : null);
    };
    addEventListener("resize", follow);
    addEventListener("scroll", follow, true);
    return () => {
      removeEventListener("resize", follow);
      removeEventListener("scroll", follow, true);
    };
  }, [open, step]);

  // Take the lift off when the walkthrough closes or the screen goes.
  useEffect(() => {
    if (open) return;
    target.current?.classList.remove("wt-lit");
    target.current = null;
  }, [open]);
  useEffect(() => () => target.current?.classList.remove("wt-lit"), []);

  // The bubble docks at the bottom while the spot's centre is in the top half, else at the top. It fades out, jumps and fades in
  // only when it has to move.
  const wantDock: "top" | "bottom" = spot && spot.top + spot.height / 2 >= innerHeight / 2 ? "top" : "bottom";
  useEffect(() => {
    if (wantDock === dock) {
      setMoving(false);
      return;
    }
    setMoving(true);
    const t = setTimeout(() => {
      setDock(wantDock);
      setMoving(false);
    }, reduce ? 0 : DOCK_MOVE_MS);
    return () => clearTimeout(t);
  }, [wantDock, dock]);

  const finish = (completed: boolean) => {
    if (shouldSaveSeen(completed, dontShow)) saveSeen();
    setOpen(false);
  };
  const next = () => {
    if (step + 1 >= slides.length) finish(true);
    else setStep(step + 1);
  };

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") next();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  if (!open || !slide) return null;

  const isCrates = slide.kind === "crates";
  const title = slide.kind === "spot" ? slide.spot.title : slide.kind === "handbook" ? TUTORIAL_HANDBOOK_SLIDE.title : "Your welcome crates";
  const body = slide.kind === "spot" ? slide.spot.body : slide.kind === "handbook" ? TUTORIAL_HANDBOOK_SLIDE.body : null;
  const bars = isCrates ? crateBars(account().profile?.locker?.welcome?.games ?? 0) : null;
  const spotClass = ["wt-spot", spot && spot.scale !== 1 ? "wt-spot-lit" : "", gliding ? "wt-glide" : ""].join(" ").trim();

  return (
    <div class="wt-root" role="dialog" aria-modal="true" aria-label="Welcome walkthrough" onClick={next}>
      {spot ? (
        // (Keyed by step under reduced motion, so each slide's spot fades in rather than gliding.)
        <div
          key={reduce ? step : "spot"}
          class={spotClass}
          aria-hidden="true"
          style={{
            top: `${spot.top}px`,
            left: `${spot.left}px`,
            width: `${spot.width}px`,
            height: `${spot.height}px`,
            borderRadius: `${spot.radius}px`,
            transform: spot.scale !== 1 ? `scale(${spot.scale})` : undefined,
          }}
        />
      ) : (
        <div class="wt-dim" aria-hidden="true" />
      )}
      <div
        class={`wt-bubble wt-dock-${dock}${moving ? " wt-moving" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="wt-text" key={step}>
          <p class="wt-count">{step + 1} of {slides.length}</p>
          <h2 class="wt-title">{title}</h2>
          {body && <p class="wt-body">{body}</p>}
          {bars && (
            <ul class="wt-crates">
              {bars.map((b) => (
                <li key={b.goal} class="wt-crate">
                  <span class="wt-art"><HunchessCrateArt /></span>
                  <span class="wt-crate-text">
                    <strong>{TUTORIAL_CRATE_LABEL(b.goal)}</strong>
                    <span class="wt-bar"><span style={{ width: `${b.fraction * 100}%` }} /></span>
                    <span class="wt-progress">{b.done} of {b.goal}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {isCrates && (
            <button type="button" class="wt-inventory" onClick={(e) => { e.stopPropagation(); finish(true); goToCrates(onShop); }}>
              Go to your inventory
            </button>
          )}
        </div>
        <label class="wt-check" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow((e.target as HTMLInputElement).checked)} />
          Don't show this tutorial again
        </label>
        <div class="wt-actions">
          <button type="button" class="wt-skip" onClick={(e) => { e.stopPropagation(); finish(false); }}>Skip</button>
          <span class="wt-tap">Tap anywhere to continue</span>
        </div>
      </div>
    </div>
  );
}
