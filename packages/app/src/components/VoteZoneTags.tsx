import { useRef } from "preact/hooks";
import { testSwitchesAllowed } from "../test-switches.ts";
import "./vote-tags.css";

/**
 * MOCKUP (Eric, Nov 25; not merged): each vote zone's name, shown over the board for about 3 s as the vote begins, a soft fade
 * in and out, and gone for you the moment your vote is in ("when you actually put your vote in, then they go away because you know
 * what they are"). Three looks to pick from, by the test switch `?votetags=a|b|c` (read as the page opened: PLAY puts the
 * address back to "/"):
 *   - `a`, floor letters: chunky gold 3D words lying on the board just above each zone, the Battle Tower's floor arrow's look
 *     (its gold top, pale rim, deep-gold sides and dark edge), breathing and nudged toward the zone as the arrow is toward its door;
 *   - `b`, a floating tag: the game's dark banner as a small tag above each zone, a pointer down to it, bobbing gently;
 *   - `c`, a zone sweep: the zones light up in turn, left to right, each with its name written across its middle.
 * The same on every pawn vote (50 v 50's and Squads' VoteScreen, 1 v 1's DuelVote): each tag sits over its own zone, so it's right
 * from either side's board. Pure CSS motion (one animation per tag, started at the vote's start so a late screen joins it in step).
 */

export type VoteTagStyle = "a" | "b" | "c";

/** How long the tags show (ms): in, held, out. Also the CSS animations' length (`--vt-ms`). */
export const VOTE_TAG_MS = 3000;
/** Your vote in: the tags fade this fast (ms). */
const VOTE_TAG_GONE_MS = 280;

const ASKED = (() => {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? "");
    return { look: q.get("votetags"), hold: q.has("votetaghold") };
  } catch {
    return { look: null, hold: false };
  }
})();

/** The look asked for by `?votetags=` (a test switch), or null: no tags (today's game). */
export function voteTagStyle(): VoteTagStyle | null {
  if (!testSwitchesAllowed()) return null;
  const a = ASKED.look;
  return a === "a" || a === "b" || a === "c" ? a : null;
}

export interface VoteTag {
  key: string;
  label: string;
  /** Its zone on screen, percent of the board (zoneOnScreen). */
  box: { left: number; top: number; width: number; height: number };
}

export function VoteZoneTags({
  look,
  tags,
  startsAt,
  now,
  voted,
}: {
  look: VoteTagStyle | null;
  tags: readonly VoteTag[];
  startsAt: number;
  now: number;
  voted: boolean;
}) {
  // When your vote went in (on this screen): the tags fade from then.
  const votedAt = useRef<number | null>(null);
  if (voted && votedAt.current === null) votedAt.current = now;
  if (!voted) votedAt.current = null;
  // (A screen that opens after the vote began joins the motion where it is: a negative delay, fixed when the tags first show, as
  // the animation's clock runs from then.)
  const delay = useRef<{ startsAt: number; ms: number } | null>(null);
  if (delay.current?.startsAt !== startsAt) delay.current = { startsAt, ms: -Math.max(0, Math.round(now - startsAt)) };
  const since = now - startsAt;
  // (`?votetaghold`, the mockup's stills: the tags stay mounted past their 3 s, for the capture script to step their animation.)
  if (!look || since < 0 || (since >= VOTE_TAG_MS && !ASKED.hold)) return null;
  if (votedAt.current !== null && now - votedAt.current >= VOTE_TAG_GONE_MS) return null;
  const style = {
    "--vt-ms": `${VOTE_TAG_MS}ms`,
    "--vt-delay": `${delay.current.ms}ms`,
  };
  return (
    <div class={`vote-tags vt-${look}${votedAt.current !== null ? " gone" : ""}`} style={style} aria-hidden="true">
      {tags.map((t, i) => {
        // (The zones touch, so a name fits its own zone's width: up to 10 letters on one line, shrunk to fit if it must; longer, it
        // wraps, its longest word fitting. `--vt-fit`: the letters a line must hold.)
        const one = t.label.length <= 10;
        const fit = one ? t.label.length : Math.max(...t.label.split(" ").map((w) => w.length));
        const at =
          look === "c"
            ? {
                left: `${t.box.left}%`,
                top: `${t.box.top}%`,
                width: `${t.box.width}%`,
                height: `${t.box.height}%`,
              }
            : {
                left: `${t.box.left + t.box.width / 2}%`,
                top: `${t.box.top}%`,
              };
        return (
          <div
            key={t.key}
            class={`vt${one ? " one" : ""}`}
            style={{
              ...at,
              "--vt-i": String(i),
              "--vt-fit": String(Math.max(6, fit)),
            }}
          >
            {look === "a" ? (
              <span class="vt-floor">
                <span class="vt-word">{t.label}</span>
                <span class="vt-arrow" />
              </span>
            ) : look === "b" ? (
              <span class="vt-tag">{t.label}</span>
            ) : (
              <span class="vt-name">{t.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
