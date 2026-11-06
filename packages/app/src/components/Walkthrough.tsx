import { useEffect, useLayoutEffect, useState } from "preact/hooks";
import { account } from "../account.ts";
import {
  TUTORIAL_HANDBOOK_SLIDE,
  TUTORIAL_SEEN_KEY,
  crateBars,
  shouldShowTutorial,
  tutorialSlides,
  type TutorialSlide,
} from "../tutorial.ts";

/**
 * The first-time walkthrough over the home screen: a dimmed screen, a spotlight on each home spot (its `data-tour`
 * element), and a bubble under it (above it when there's no room). Tap anywhere to go on; Skip ends it. "Don't show
 * this tutorial again" is ticked by default and is saved when the walkthrough ends. Storage is read and written in
 * try/catch, so a private window still gets the walkthrough and nothing breaks.
 */

function readSeen(): string | null {
  try {
    return localStorage.getItem(TUTORIAL_SEEN_KEY);
  } catch {
    return null;
  }
}

/** Settings' "Show the walkthrough again": a one-shot session flag (for when Home mounts) and an event (when it's mounted). */
export const WALKTHROUGH_REPLAY_KEY = "hunchess.tutorial.replay";
export const WALKTHROUGH_REPLAY_EVENT = "hunchess:walkthrough";

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

function saveSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
  } catch {
    /* no storage: the walkthrough just shows again next time */
  }
}

/** The spotlight's box for a slide, or null for a slide with no spot (the Handbook and crates slides). */
function spotBox(slide: TutorialSlide): DOMRect | null {
  if (slide.kind !== "spot") return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${slide.spot.id}"]`);
  return el ? el.getBoundingClientRect() : null;
}

export function Walkthrough({ startOpen }: { startOpen?: boolean }) {
  const [open, setOpen] = useState<boolean>(() => startOpen ?? (takeReplay() || shouldShowTutorial(readSeen())));
  const [step, setStep] = useState(0);

  useEffect(() => {
    const again = () => {
      takeReplay();
      setStep(0);
      setOpen(true);
    };
    addEventListener(WALKTHROUGH_REPLAY_EVENT, again);
    return () => removeEventListener(WALKTHROUGH_REPLAY_EVENT, again);
  }, []);
  const [dontShow, setDontShow] = useState(true);
  const [box, setBox] = useState<DOMRect | null>(null);
  const slides = tutorialSlides();
  const slide = slides[step];

  // Measure the spot for this slide, again on resize, and on the first frame (layout may still be settling).
  useLayoutEffect(() => {
    if (!open || !slide) return;
    const measure = () => setBox(spotBox(slide));
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [open, step]);

  const finish = () => {
    if (dontShow) saveSeen();
    setOpen(false);
  };
  const next = () => {
    if (step + 1 >= slides.length) finish();
    else setStep(step + 1);
  };

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") next();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  if (!open || !slide) return null;

  const pad = 8;
  const below = box ? box.bottom + 16 : null;
  const spotlight = box
    ? { top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }
    : null;
  const bubbleAbove = box ? box.bottom + 160 > innerHeight : false;
  const bubbleStyle = box
    ? bubbleAbove
      ? { bottom: `${innerHeight - box.top + 16}px` }
      : { top: `${below}px` }
    : undefined;

  const title = slide.kind === "spot" ? slide.spot.title : slide.kind === "handbook" ? TUTORIAL_HANDBOOK_SLIDE.title : "Your welcome crate";
  const body = slide.kind === "spot" ? slide.spot.body : slide.kind === "handbook" ? TUTORIAL_HANDBOOK_SLIDE.body : null;
  const games = account().profile?.locker?.welcome?.games ?? 0;
  const bars = slide.kind === "crates" ? crateBars(games) : null;

  return (
    <div class="wt-root" role="dialog" aria-modal="true" aria-label="Welcome walkthrough" onClick={next}>
      <div class="wt-dim" aria-hidden="true" />
      {spotlight && <div class="wt-spot" aria-hidden="true" style={spotlight} />}
      <div class={`wt-bubble${box ? "" : " wt-bubble-mid"}`} style={bubbleStyle} onClick={(e) => e.stopPropagation()}>
        <p class="wt-count">{step + 1} of {slides.length}</p>
        <h2 class="wt-title">{title}</h2>
        {body && <p class="wt-body">{body}</p>}
        {bars && (
          <ul class="wt-bars">
            {bars.map((b) => (
              <li key={b.goal}>
                <span>{b.done} of {b.goal} games</span>
                <span class="wt-bar"><span style={{ width: `${b.fraction * 100}%` }} /></span>
              </li>
            ))}
          </ul>
        )}
        <label class="wt-check" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow((e.target as HTMLInputElement).checked)} />
          Don't show this tutorial again
        </label>
        <div class="wt-actions">
          <button type="button" class="wt-skip" onClick={(e) => { e.stopPropagation(); finish(); }}>Skip</button>
          <span class="wt-tap">Tap anywhere to continue</span>
        </div>
      </div>
    </div>
  );
}
