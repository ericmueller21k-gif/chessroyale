import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { HunchessCrateArt } from "./Items.tsx";
import {
  TUTORIAL_ANYWHERE_SLIDE,
  TUTORIAL_CRATE_LABEL,
  TUTORIAL_HANDBOOK_SLIDE,
  TUTORIAL_SEEN_KEY,
  crateBars,
  shouldSaveSeen,
  shouldShowTutorial,
  slideSpotId,
  tourRequested,
  tutorialSlides,
  type TutorialSlide,
} from "../tutorial.ts";
import { account } from "../account.ts";

/**
 * The first-time walkthrough over the home screen. A slide's spots (every visible `data-tour` element for it: a computer has
 * some twice, in its side menu and on the home screen) are cut out of one dim layer: each cut-out is the element's exact box and
 * radius (a mask over the dim, so no page colour shows round it and the dim never covers a spot). A soft gold glow starts at each
 * element's edge and pulses; each element is lifted slightly (scaled from its centre). The highlights glide to the next slide's
 * spots; the bubble is docked at the bottom of the screen while the spots' centre is in the top half, and at the top once it is
 * past halfway, fading when it moves. A slide with no spot (the Handbook, Play anywhere) dims the whole screen. Tap anywhere to go on,
 * except on the last slide: there only the OK button finishes it, with "Don't show me this again" under it (ticked, OK saves
 * the flag; unticked, it closes for now). Skip (on the other slides) and Escape close without saving. `?tour=1` opens it from
 * the first slide whatever the flag says. Storage is read and written in try/catch.
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

/** The elements a slide lights up: every one on screen with its `data-tour` id (a computer has some twice). */
function spotElements(slide: TutorialSlide): HTMLElement[] {
  const id = slideSpotId(slide);
  if (!id) return [];
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
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

/** The cut-out's box with the lift on (the scaled box, about the centre): where the dim has its hole. */
function holeOf(s: SpotBox) {
  const w = s.width * s.scale;
  const h = s.height * s.scale;
  return { x: s.left + (s.width - w) / 2, y: s.top + (s.height - h) / 2, width: w, height: h, rx: s.radius * s.scale };
}

export function Walkthrough({ onShop }: { onShop: () => void }) {
  const [open, setOpen] = useState<boolean>(
    () => takeReplay() || tourRequested(location.search) || shouldShowTutorial(readSeen()),
  );
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);
  const [spots, setSpots] = useState<SpotBox[]>([]);
  const [gliding, setGliding] = useState(false);
  const [dock, setDock] = useState<"top" | "bottom">("bottom");
  const [moving, setMoving] = useState(false);
  const targets = useRef<HTMLElement[]>([]);
  const slides = tutorialSlides();
  const slide = slides[step];
  const isLast = step === slides.length - 1;
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

  // Light up the slide's spots: the old ones' lift comes off (it fades back, its transition stays), the new ones lift, and the
  // cut-outs glide to them. Measured with the new lift already in place (its centre doesn't move, so the box is the same).
  useLayoutEffect(() => {
    if (!open || !slide) return;
    const els = spotElements(slide);
    for (const prev of targets.current) if (!els.includes(prev)) prev.classList.remove("wt-lit");
    targets.current = els;
    for (const el of els) {
      el.classList.add("wt-track");
      if (reduce) el.classList.remove("wt-lit");
      else {
        el.style.setProperty("--wt-scale", String(litScale(el)));
        el.classList.add("wt-lit");
      }
    }
    setSpots(els.map((el) => boxOf(el, !reduce)));
    if (reduce) return;
    setGliding(true);
    const t = setTimeout(() => setGliding(false), GLIDE_MS + 50);
    return () => clearTimeout(t);
  }, [open, step]);

  // Follow the targets on resize and scroll (the cut-outs follow at once; only a slide change glides).
  useEffect(() => {
    if (!open) return;
    const follow = () => setSpots(targets.current.map((el) => boxOf(el, el.classList.contains("wt-lit"))));
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
    for (const el of targets.current) el.classList.remove("wt-lit");
    targets.current = [];
  }, [open]);
  useEffect(() => () => { for (const el of targets.current) el.classList.remove("wt-lit"); }, []);

  // The bubble docks at the bottom while the spots' centre is in the top half, else at the top. It fades out, jumps and fades in
  // only when it has to move.
  const top = spots.length ? Math.min(...spots.map((s) => s.top)) : 0;
  const bottom = spots.length ? Math.max(...spots.map((s) => s.top + s.height)) : 0;
  const wantDock: "top" | "bottom" = spots.length && (top + bottom) / 2 >= innerHeight / 2 ? "top" : "bottom";
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

  /** Closes it. It's saved as seen only if the box is ticked (the last slide's OK, Skip, Escape, Go to your inventory). */
  const close = (dontShowAgain: boolean) => {
    if (shouldSaveSeen(dontShowAgain)) saveSeen();
    setOpen(false);
  };
  // Tapping goes on, but never past the last slide: there only its OK (or Escape) closes it.
  const next = () => {
    if (!isLast) setStep(step + 1);
  };

  // (A layout effect, as every pop-up's: an effect waits for a paint, and an Escape pressed as it opened was lost. LESSONS.md, Nov 11.)
  useLayoutEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(dontShow);
      if (!isLast && (e.key === "Enter" || e.key === " " || e.key === "ArrowRight")) next();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  if (!open || !slide) return null;

  const title =
    slide.kind === "spot" ? slide.spot.title
    : slide.kind === "handbook" ? TUTORIAL_HANDBOOK_SLIDE.title
    : slide.kind === "anywhere" ? TUTORIAL_ANYWHERE_SLIDE.title
    : "Your welcome crates";
  const body =
    slide.kind === "spot" ? slide.spot.body
    : slide.kind === "handbook" ? TUTORIAL_HANDBOOK_SLIDE.body
    : slide.kind === "anywhere" ? TUTORIAL_ANYWHERE_SLIDE.body
    : null;
  const isCrates = slide.kind === "crates";
  const bars = isCrates ? crateBars(account().profile?.locker?.welcome?.games ?? 0) : null;
  const holes = spots.map(holeOf);
  const spotClass = (s: SpotBox) => ["wt-spot", s.scale !== 1 ? "wt-spot-lit" : "", gliding ? "wt-glide" : ""].join(" ").trim();

  return (
    <div class="wt-root" role="dialog" aria-modal="true" aria-label="Welcome walkthrough" onClick={isLast ? undefined : next}>
      {/* The dim, with a hole for each lit element (a mask: the holes never dim, whatever overlaps them). */}
      <svg class="wt-dim" aria-hidden="true">
        <defs>
          <mask id="wt-holes" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
            <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
            {holes.map((h, i) => (
              <rect
                key={i}
                class={`wt-hole${gliding ? " wt-glide" : ""}`}
                x={h.x}
                y={h.y}
                width={h.width}
                height={h.height}
                rx={h.rx}
                style={`x:${h.x}px;y:${h.y}px;width:${h.width}px;height:${h.height}px`}
                fill="#000"
              />
            ))}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(8, 10, 14, 0.62)" mask="url(#wt-holes)" />
      </svg>
      {spots.map((s, i) => (
        // (Keyed by step under reduced motion, so each slide's spots fade in rather than gliding.)
        <div
          key={reduce ? `${step}-${i}` : `spot-${i}`}
          class={spotClass(s)}
          aria-hidden="true"
          style={{
            top: `${s.top}px`,
            left: `${s.left}px`,
            width: `${s.width}px`,
            height: `${s.height}px`,
            borderRadius: `${s.radius}px`,
            transform: s.scale !== 1 ? `scale(${s.scale})` : undefined,
          }}
        />
      ))}
      <div class={`wt-dock wt-dock-${dock}${moving ? " wt-moving" : ""}`}>
        {!isLast && <p class="wt-tap">Tap anywhere to continue</p>}
        <div class="wt-bubble" onClick={(e) => e.stopPropagation()}>
          <div class="wt-text" key={step}>
            <div class={`wt-row${slide.kind === "handbook" || slide.kind === "anywhere" ? " wt-prose" : ""}`}>
              <div class="wt-lead">
                <h2 class="wt-title">{title}</h2>
                <p class="wt-count">{step + 1} of {slides.length}</p>
              </div>
              {body && <p class="wt-body">{body}</p>}
              {isCrates && (
                <button type="button" class="wt-inventory" onClick={(e) => { e.stopPropagation(); close(dontShow); goToCrates(onShop); }}>
                  Go to your inventory
                </button>
              )}
              {!isLast && (
                <button type="button" class="wt-skip" onClick={(e) => { e.stopPropagation(); close(false); }}>Skip</button>
              )}
            </div>
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
          </div>
          {isLast && (
            <div class="wt-finish">
              <label class="wt-check" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow((e.target as HTMLInputElement).checked)} />
                Don't show me this again
              </label>
              <button type="button" class="wt-ok" onClick={(e) => { e.stopPropagation(); close(dontShow); }}>OK</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
