import { useEffect, useLayoutEffect, useState } from "preact/hooks";
import { GearIcon } from "./MatchMenu.tsx";
import { squareAt } from "./SquadsBlocks.tsx";
import { closeTip, onReplayChange, replayOn, setReplayOn, tagText, tipDue } from "../move-replay.ts";

/**
 * Move replay on screen (Eric, Nov 5; move-replay.ts): the replay button by the gear, its icon, the name tag over a
 * replayed move's piece, and the first-time tip.
 */

/** Rewind: a ring turning back on itself, its arrowhead at the top, and a back-step inside. Drawn, in currentColor. */
export function ReplayIcon({ size = 20 }: { size?: number }) {
  return (
    <svg class="rp-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4.6 9.2A8 8 0 1 1 4 12.6" />
        <path d="M3.6 4.6v4.8h4.8" />
      </g>
      <path d="M15.4 8.6v6.8l-4.6-3.4z M10.6 8.6v6.8L6 12z" fill="currentColor" transform="translate(1.2 0)" />
    </svg>
  );
}

/** The replay button's setting (per account on this device), kept in step wherever it's drawn. */
export function useReplayOn(): boolean {
  const [on, setOn] = useState(replayOn);
  useEffect(() => onReplayChange(() => setOn(replayOn())), []);
  return on;
}

/**
 * The replay button, next to the gear in Squads' top line (Eric, Nov 5): on or off. On, a few dots chase slowly round
 * its edge, like a game's toggled-on ability; off, the plain icon.
 */
export function ReplayButton() {
  const on = useReplayOn();
  return (
    <button
      type="button"
      class={`rp-btn${on ? " on" : ""}`}
      aria-pressed={on}
      aria-label={on ? "Move replay: on" : "Move replay: off"}
      title={on ? "Move replay is on: coming back to a board, the moves you missed play back first" : "Move replay is off"}
      onClick={() => setReplayOn(!on)}
    >
      <ReplayIcon />
      {on && (
        <svg class="rp-trail" viewBox="0 0 44 42" aria-hidden="true">
          {/* (Three dots, smaller and fainter behind the first, on the button's rounded edge; the group turns.) */}
          <g class="rp-trail-spin">
            <circle cx="22" cy="2.6" r="2.1" />
            <circle cx="15.4" cy="3.6" r="1.6" opacity="0.65" />
            <circle cx="9.6" cy="6.4" r="1.2" opacity="0.35" />
          </g>
        </svg>
      )}
    </button>
  );
}

/**
 * Who played a replayed move: a name tag over the moved piece (on `square`), in the look of the names over pieces in
 * the final's picks. One box size for every name: a long one is set smaller to fit (and over 12 letters cut with "…").
 */
export function ReplayTag({ square, names, orientation, tone }: { square: string; names: readonly string[]; orientation: "white" | "black"; tone: "you" | "mate" | "them" }) {
  if (!names.length) return null;
  const text = tagText(names);
  const sq = squareAt(square, orientation);
  return (
    <span class={`rp-tag ${tone}`} style={{ "--sq-x": String(sq.x), "--sq-y": String(sq.y), "--rp-len": String(Math.max(6, text.length)) }} data-name={text}>
      <span class="rp-tag-text">{text}</span>
    </span>
  );
}

/** Where a button is on screen, for the tip's lit rings. */
interface Spot {
  x: number;
  y: number;
  w: number;
  h: number;
}

function spotOf(sel: string): Spot | null {
  const el = document.querySelector(sel);
  if (!el) return null;
  const b = el.getBoundingClientRect();
  if (!b.width) return null;
  // (A rounded box round the button, a little bigger, so two side by side each keep their own.)
  return { x: b.left - 3, y: b.top - 3, w: b.width + 6, h: b.height + 6 };
}

/**
 * The first-time tip (Eric, Nov 5): the first time this account queues for Squads, on the first screen with the gear
 * and the replay button, the screen dims but for those two (rings round them), and a small box says what each does,
 * with "Don't show this again" and OK. Not ticked, it comes back the next time they queue.
 */
export function ReplayTip({ code }: { code: string | null }) {
  const [due, setDue] = useState(() => tipDue(code));
  const [never, setNever] = useState(false);
  const [spots, setSpots] = useState<{ replay: Spot; gear: Spot } | null>(null);
  useLayoutEffect(() => {
    if (!due) return;
    const place = () => {
      const replay = spotOf(".rp-btn");
      const gear = spotOf(".mm-more");
      setSpots(replay && gear ? { replay, gear } : null);
    };
    place();
    // (The top line can settle a frame later, and the window can turn.)
    const t = setTimeout(place, 120);
    addEventListener("resize", place);
    return () => {
      clearTimeout(t);
      removeEventListener("resize", place);
    };
  }, [due]);
  if (!due || !spots) return null;
  const ok = () => {
    closeTip(never);
    setDue(false);
  };
  const w = innerWidth;
  const h = innerHeight;
  const top = Math.max(spots.replay.y + spots.replay.h, spots.gear.y + spots.gear.h) + 12;
  return (
    <div class="rp-tip" role="dialog" aria-modal="true" aria-labelledby="rp-tip-title">
      <svg class="rp-tip-dim" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <defs>
          <mask id="rp-tip-holes">
            <rect width={w} height={h} fill="#fff" />
            {[spots.replay, spots.gear].map((s, i) => (
              <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={14} fill="#000" />
            ))}
          </mask>
        </defs>
        <rect width={w} height={h} fill="rgba(0,0,0,0.62)" mask="url(#rp-tip-holes)" />
        {[spots.replay, spots.gear].map((s, i) => (
          <rect key={i} class="rp-tip-ring" x={s.x} y={s.y} width={s.w} height={s.h} rx={14} />
        ))}
      </svg>
      <div class="rp-tip-box" style={{ top: `${Math.min(top, h - 260)}px` }}>
        <h2 class="rp-tip-title" id="rp-tip-title">
          Two quick settings
        </h2>
        <p class="rp-tip-line">
          <span class="rp-tip-icon">
            <ReplayIcon size={18} />
          </span>
          <span>
            Move replay is on: when the rotation brings you back to a board, the moves you missed play back first, and you get a little extra time for them. Tap <ReplayIcon size={14} /> to turn it off.
          </span>
        </p>
        <p class="rp-tip-line">
          <span class="rp-tip-icon">
            <GearIcon size={18} />
          </span>
          <span>
            Tap <GearIcon size={14} /> to turn off Animations for a calmer board: picks show as names only.
          </span>
        </p>
        <div class="rp-tip-foot">
          <label class="rp-tip-never">
            <input type="checkbox" checked={never} onChange={(e) => setNever(e.currentTarget.checked)} />
            Don't show this again
          </label>
          <button type="button" class="fd-btn primary rp-tip-ok" onClick={ok}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
