import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { DuelQueue } from "../duel.ts";
import { clockShown } from "../clock-text.ts";
import { isMuted, play } from "../sound.ts";

/**
 * Browsing while queued for 1 v 1 (Eric, Oct 16: "a back button or they can view inventory"; docs/areas/ranked.md,
 * "Browsing while queued"). Home from the search stage keeps the search going (the queue is the app's, not the
 * screen's), and while it goes a slim bar sits at the top of every screen: "Searching 1 v 1 · 0:42 ›" (back to the
 * stage) and Cancel. At "Few players online" it turns gold and says so (its choices are on the stage). Its height goes
 * to --qbar-h, which --banner-h adds to the maintenance banner's, so the page starts under it and nothing is covered.
 *
 * Also here, since it's mounted over every screen: the one confirm, "Leave the 1 v 1 queue?", before another mode
 * starts while the search goes; and the alert (a sound and a buzz) when an opponent is found while you browse.
 *
 * App sets what the bar shows (`setAwaySearch`) after every render; the bar reads it from here. Classes `dq-`.
 */

export interface AwaySearch {
  queue: DuelQueue;
  /** Back to the search stage. */
  back(): void;
  /** Leaves the queue (no confirm: Cancel). */
  cancel(): void;
}

let away: AwaySearch | null = null;
/** The confirm's "Leave queue": what to do then (null: no confirm open). */
let leaving: (() => void) | null = null;
const seen = new Set<() => void>();
const emit = () => {
  for (const f of seen) f();
};

/** What the bar shows: the search you stepped away from, or null (on the stage, in a game, or no search). */
export function setAwaySearch(a: AwaySearch | null) {
  const changed = a?.queue !== away?.queue;
  away = a;
  if (changed) emit();
}

/** Asks "Leave the 1 v 1 queue?"; `leave` runs if they say so (it leaves the queue, then starts what they picked). */
export function confirmLeaveDuelQueue(leave: () => void) {
  leaving = leave;
  emit();
}

/** An opponent found while you browse: a sound and a short buzz (none while sound is off). */
export function duelFoundAlert() {
  play("bannerStart");
  if (!isMuted()) {
    try {
      navigator.vibrate?.([90, 60, 160]);
    } catch {
      // No vibration here.
    }
  }
}

/** The bar and the confirm, over every screen (main.tsx). */
export function DuelQueueBar() {
  const [, redraw] = useState(0);
  useLayoutEffect(() => {
    const f = () => redraw((n) => n + 1);
    seen.add(f);
    return () => void seen.delete(f);
  }, []);
  const a = away;
  const q = a?.queue ?? null;
  const shown = !!q && q.state.kind === "searching";
  // The wait, every second, and the queue's own changes (found, refused, cancelled), while it shows.
  useEffect(() => {
    if (!shown || !q) return;
    const t = setInterval(() => redraw((n) => n + 1), 1000);
    const off = q.subscribe(() => redraw((n) => n + 1));
    return () => {
      clearInterval(t);
      off();
    };
  }, [shown, q]);
  const el = useRef<HTMLDivElement>(null);
  // (Before the frame is painted, so the page moves with the bar as it comes and goes, never a frame apart.)
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    const node = el.current;
    if (!shown || !node) return void root.removeProperty("--qbar-h");
    const set = () => root.setProperty("--qbar-h", `${Math.ceil(node.getBoundingClientRect().height)}px`);
    set();
    const watch = new ResizeObserver(set);
    watch.observe(node);
    return () => {
      watch.disconnect();
      root.removeProperty("--qbar-h");
    };
  }, [shown]);
  const now = Date.now();
  const since = q && q.state.kind === "searching" ? q.state.since : now;
  const few = shown && !q!.keepWaiting && now >= q!.fewAt;
  return (
    <>
      {shown && (
        <div class={`dq-bar${few ? " few" : ""}`} ref={el} role="region" aria-label="1 v 1 search">
          <button type="button" class="dq-go" onClick={() => away?.back()} aria-label={`${few ? "Few players online" : "Searching 1 v 1"}, ${clockShown(now - since)}: back to the search`}>
            <span class="dq-dot" aria-hidden="true" />
            <span class="dq-text">{few ? "Few players online" : "Searching 1 v 1"}</span>
            <span class="dq-time">· {clockShown(Math.max(0, now - since))}</span>
            <span class="dq-chev" aria-hidden="true">
              ›
            </span>
          </button>
          <button type="button" class="dq-cancel" onClick={() => away?.cancel()}>
            Cancel
          </button>
        </div>
      )}
      {leaving && (
        <LeaveConfirm
          onStay={() => {
            leaving = null;
            emit();
          }}
          onLeave={() => {
            const go = leaving;
            leaving = null;
            emit();
            go?.();
          }}
        />
      )}
    </>
  );
}

/** "Leave the 1 v 1 queue?": Stay (focused, so Enter or a stray tap never leaves), or Leave queue. */
function LeaveConfirm({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => stay.current?.focus(), []);
  return (
    <div class="dq-scrim" onClick={onStay}>
      <div class="dq-confirm" role="alertdialog" aria-modal="true" aria-labelledby="dq-confirm-title" aria-describedby="dq-confirm-note" onClick={(e) => e.stopPropagation()}>
        <strong id="dq-confirm-title">Leave the 1 v 1 queue?</strong>
        <p id="dq-confirm-note">Starting this ends your 1 v 1 search.</p>
        <div class="dq-confirm-actions">
          <button type="button" class="btn btn-secondary" ref={stay} onClick={onStay}>
            Stay
          </button>
          <button type="button" class="btn btn-primary" onClick={onLeave}>
            Leave queue
          </button>
        </div>
      </div>
    </div>
  );
}
