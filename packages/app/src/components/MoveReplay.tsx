import { useEffect, useLayoutEffect, useState } from "preact/hooks";
import { squareAt } from "./SquadsBlocks.tsx";
import { COACH_MARKS, coachDone, coachDue, nextCoachMark, nextReplayMode, onReplayChange, replayMode, setReplayMode, tagText, type ReplayMode } from "../move-replay.ts";

/**
 * Move replay on screen (Eric, Nov 5; move-replay.ts): the replay button by the gear, its icon, the name tag over a
 * replayed move's piece; and Squads' first-time tips, the coach marks (Nov 5, round 2).
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
export function useReplayMode(): ReplayMode {
  const [mode, setMode] = useState(replayMode);
  useEffect(() => onReplayChange(() => setMode(replayMode())), []);
  return mode;
}

const MODE_NAME: Record<ReplayMode, string> = { off: "off", two: "the last 2 moves", all: "all moves since you last played" };

/** The dots of the button's trail, first to last (a longer trail for "all"): where on the ring, how big, how faint. */
const TRAIL: Record<Exclude<ReplayMode, "off">, readonly (readonly [number, number, number])[]> = {
  two: [
    [0, 2.1, 1],
    [-24, 1.6, 0.6],
    [-46, 1.2, 0.3],
  ],
  all: [
    [0, 2.2, 1],
    [-20, 1.9, 0.8],
    [-40, 1.6, 0.6],
    [-60, 1.35, 0.45],
    [-80, 1.1, 0.3],
    [-100, 0.9, 0.18],
  ],
};

/**
 * The replay button, next to the gear in Squads' top line (Eric, Nov 5; round 2): no box, only the drawn ring. A tap
 * steps off → the last 2 moves → all moves since you last played → off. Off: grayed, nothing turning; the last 2: dots
 * chase round it at a moderate pace with a short trail; all: twice as fast, a longer trail.
 */
export function ReplayButton() {
  const mode = useReplayMode();
  const next = nextReplayMode(mode);
  return (
    <button
      type="button"
      class={`rp-btn is-${mode}`}
      data-mode={mode}
      aria-label={`Move replay: ${MODE_NAME[mode]}. Tap for ${MODE_NAME[next]}.`}
      title={`Move replay: ${MODE_NAME[mode]}`}
      onClick={() => setReplayMode(next)}
    >
      <ReplayIcon />
      {mode !== "off" && (
        <svg class="rp-trail" viewBox="0 0 40 40" aria-hidden="true">
          <g class="rp-trail-spin">
            {TRAIL[mode].map(([deg, r, o], i) => (
              <circle key={i} cx={20 + 17.5 * Math.sin((deg * Math.PI) / 180)} cy={20 - 17.5 * Math.cos((deg * Math.PI) / 180)} r={r} opacity={o} />
            ))}
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

/** Where a thing is on screen, for a coach mark's lit hole and its pointer. */
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
  return { x: b.left - 4, y: b.top - 4, w: b.width + 8, h: b.height + 8 };
}

/**
 * The first-time tips (Eric, Nov 5, round 2): three coach marks, one at a time, like games do (move-replay.ts,
 * `COACH_MARKS`): the screen dims but for the one thing, a short line points to it from a small box with its words and
 * OK; a tap anywhere or OK goes to the next. At a player's Relay, until the last one's "Don't show these again" is
 * ticked (`coachDue`). `at`: a test switch's start (stills).
 */
export function CoachMarks({ code, at = 0 }: { code: string | null; at?: number }) {
  const [i, setI] = useState<number | null>(() => (coachDue(code) ? at : null));
  const [spot, setSpot] = useState<Spot | null>(null);
  const [never, setNever] = useState(false);
  const mark = i === null ? null : COACH_MARKS[i]!;
  useLayoutEffect(() => {
    if (!mark) return;
    const place = () => setSpot(spotOf(mark.target));
    place();
    // (The top line can settle a frame later, and the window can turn.)
    const t = setTimeout(place, 120);
    addEventListener("resize", place);
    return () => {
      clearTimeout(t);
      removeEventListener("resize", place);
    };
  }, [mark?.id]);
  if (!mark || !spot) return null;
  const go = () => {
    const n = nextCoachMark(i!);
    if (n === null) coachDone(never);
    setI(n);
  };
  const w = innerWidth;
  const h = innerHeight;
  // The box under the thing (or over it, low on the screen), as wide as fits; the pointer from the box to the thing.
  const boxW = Math.min(300, w - 32);
  const below = spot.y + spot.h + 150 < h;
  const cx = spot.x + spot.w / 2;
  const left = Math.max(16, Math.min(w - 16 - boxW, cx - boxW / 2));
  const gap = 34;
  const top = below ? spot.y + spot.h + gap : undefined;
  const bottom = below ? undefined : h - spot.y + gap;
  const lineFrom = below ? spot.y + spot.h : spot.y;
  const lineTo = below ? spot.y + spot.h + gap : spot.y - gap;
  return (
    <div class="cm" role="dialog" aria-modal="true" aria-labelledby="cm-text" data-mark={mark.id} onClick={go}>
      <svg class="cm-dim" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <defs>
          <mask id="cm-hole">
            <rect width={w} height={h} fill="#fff" />
            <rect x={spot.x} y={spot.y} width={spot.w} height={spot.h} rx={12} fill="#000" />
          </mask>
        </defs>
        <rect width={w} height={h} fill="rgba(0,0,0,0.66)" mask="url(#cm-hole)" />
        <rect class="cm-ring" x={spot.x} y={spot.y} width={spot.w} height={spot.h} rx={12} />
        <line class="cm-line" x1={cx} y1={lineFrom} x2={cx} y2={lineTo} />
        <circle class="cm-dot" cx={cx} cy={lineTo} r={3.5} />
      </svg>
      <div class="cm-box" style={{ left: `${left}px`, width: `${boxW}px`, ...(top !== undefined ? { top: `${top}px` } : { bottom: `${bottom}px` }) }}>
        <p class="cm-text" id="cm-text">
          {mark.text}
        </p>
        <div class="cm-foot">
          {nextCoachMark(i!) === null ? (
            // (The last: "Don't show these again", Eric, Nov 5. A tap on it ticks it, and goes no further.)
            <label class="cm-never" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={never} onChange={(e) => setNever(e.currentTarget.checked)} />
              Don't show these again
            </label>
          ) : (
            <span class="cm-step muted">
              {i! + 1} of {COACH_MARKS.length}
            </span>
          )}
          <button
            type="button"
            class="fd-btn primary cm-ok"
            onClick={(e) => {
              e.stopPropagation();
              go();
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
