import { useEffect, useLayoutEffect, useState } from "preact/hooks";
import { account } from "../account.ts";
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

/**
 * The first-time walkthrough over the home screen: a dimmed screen, a spotlight on each slide's spot (its `data-tour`
 * element), and a bubble under it (above when there's no room). Tap anywhere to go on. The last slide shows both Welcome
 * Crates and a "Go to your inventory" button (the shop's Crates tab). "Don't show this tutorial again" starts unticked:
 * finishing every slide saves it; Skip saves it only when ticked. Storage is read and written in try/catch.
 */

/** Settings' "Show the walkthrough again": a one-shot session flag (for when Home mounts) and an event (when it's mounted). */
export const WALKTHROUGH_REPLAY_KEY = "hunchess.tutorial.replay";
export const WALKTHROUGH_REPLAY_EVENT = "hunchess:walkthrough";

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

/** The spotlight's box for a slide's spot, or null for a slide with none (the Handbook slide). */
function spotBox(slide: TutorialSlide): DOMRect | null {
  const id = slideSpotId(slide);
  if (!id) return null;
  // The first one on screen: a computer has some spots twice (the top bar and the side menu), one of them hidden.
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
  }
  return null;
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
  const [box, setBox] = useState<DOMRect | null>(null);
  const slides = tutorialSlides();
  const slide = slides[step];

  useEffect(() => {
    const again = () => {
      takeReplay();
      setStep(0);
      setOpen(true);
    };
    addEventListener(WALKTHROUGH_REPLAY_EVENT, again);
    return () => removeEventListener(WALKTHROUGH_REPLAY_EVENT, again);
  }, []);

  // Measure the spot for this slide, again on resize (layout may still be settling on the first frame).
  useLayoutEffect(() => {
    if (!open || !slide) return;
    const measure = () => setBox(spotBox(slide));
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [open, step]);

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

  const pad = 8;
  const spotlight = box
    ? { top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }
    : null;
  const bubbleAbove = box ? box.bottom + 260 > innerHeight : false;
  const bubbleStyle = box
    ? bubbleAbove
      ? { bottom: `${innerHeight - box.top + 16}px` }
      : { top: `${box.bottom + 16}px` }
    : undefined;

  const isCrates = slide.kind === "crates";
  const title = slide.kind === "spot" ? slide.spot.title : slide.kind === "handbook" ? TUTORIAL_HANDBOOK_SLIDE.title : "Your welcome crates";
  const body = slide.kind === "spot" ? slide.spot.body : slide.kind === "handbook" ? TUTORIAL_HANDBOOK_SLIDE.body : null;
  const bars = isCrates ? crateBars(account().profile?.locker?.welcome?.games ?? 0) : null;

  return (
    <div class="wt-root" role="dialog" aria-modal="true" aria-label="Welcome walkthrough" onClick={next}>
      <div class="wt-dim" aria-hidden="true" />
      {spotlight && <div class="wt-spot" aria-hidden="true" style={spotlight} />}
      <div class={`wt-bubble${box || isCrates ? "" : " wt-bubble-mid"}`} style={bubbleStyle} onClick={(e) => e.stopPropagation()}>
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
