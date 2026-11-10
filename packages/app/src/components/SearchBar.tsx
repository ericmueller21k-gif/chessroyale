import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { clockShown } from "../clock-text.ts";
import { answerLeave, awaySearch, leaveAsked, searchOnHome, watchSearch } from "../search.ts";

/**
 * The search on every page but home (search.ts; Eric, Oct 16 for 1 v 1, every queue since Nov 10): a slim bar at the top,
 * "Searching 50 v 50 · 0:42 ›" (back to the lobby or the stage) and Cancel (out of the queue, no confirm; the page stays).
 * Home shows the search in its own mode rows instead. At 1 v 1's "Few players online" it turns gold and says so (its
 * choices are on the stage). Its height goes to --qbar-h, which --banner-h adds to the maintenance banner's, so the page
 * starts under it and nothing is covered.
 *
 * Also here, since it's mounted over every screen: the one confirm, "Leave the 50 v 50 queue?", before another mode
 * starts while a search goes. Classes `dq-` (from when it was 1 v 1's alone).
 */
export function SearchBar() {
  const [, redraw] = useState(0);
  useLayoutEffect(() => watchSearch(() => redraw((n) => n + 1)), []);
  const a = awaySearch();
  const shown = !!a && !searchOnHome();
  // The wait (and the lobby's count), every second while it shows.
  useEffect(() => {
    if (!shown) return;
    const t = setInterval(() => redraw((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [shown]);
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
  const few = shown && a!.few(now);
  const text = few ? "Few players online" : `Searching ${a?.name ?? ""}`;
  const time = clockShown(Math.max(0, now - (a?.since ?? now)));
  const leave = leaveAsked();
  return (
    <>
      {shown && (
        <div class={`dq-bar${few ? " few" : ""}`} ref={el} role="region" aria-label={`${a!.name} search`}>
          <button type="button" class="dq-go" onClick={() => awaySearch()?.back()} aria-label={`${text}, ${time}: back to the ${a!.mode === "1v1" ? "search" : "lobby"}`}>
            <span class="dq-dot" aria-hidden="true" />
            <span class="dq-text">{text}</span>
            <span class="dq-time">· {time}</span>
            <span class="dq-chev" aria-hidden="true">
              ›
            </span>
          </button>
          <button type="button" class="dq-cancel" onClick={() => awaySearch()?.cancel()}>
            Cancel
          </button>
        </div>
      )}
      {leave && <LeaveConfirm name={leave.name} onStay={() => answerLeave(false)} onLeave={() => answerLeave(true)} />}
    </>
  );
}

/** "Leave the 50 v 50 queue?": Stay (focused, so Enter or a stray tap never leaves), or Leave queue. */
function LeaveConfirm({ name, onStay, onLeave }: { name: string; onStay: () => void; onLeave: () => void }) {
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => stay.current?.focus(), []);
  return (
    <div class="dq-scrim" onClick={onStay}>
      <div class="dq-confirm" role="alertdialog" aria-modal="true" aria-labelledby="dq-confirm-title" aria-describedby="dq-confirm-note" onClick={(e) => e.stopPropagation()}>
        <strong id="dq-confirm-title">Leave the {name} queue?</strong>
        <p id="dq-confirm-note">Starting this ends your {name} search.</p>
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
