import { useRef } from "preact/hooks";
import { VOTE_TAGS } from "@chessroyale/core";
import "./vote-tags.css";

/**
 * Each vote zone's name as a small floating tag over the board as the vote opens (Eric, Nov 25, look B of the mockup; "when you
 * actually put your vote in, then they go away because you know what they are"): the game's dark banner in small, a thin gold rim
 * and a pointer down to its zone. It rises in, bobs gently and lifts away over `VOTE_TAGS.showMs`, and fades in `goneMs` the moment
 * your vote is in. Each tag sits over its own zone, so it's right from either side's board, and nothing on the board moves (the tags
 * float on top and take no taps). Pure CSS motion: one animation per tag, started at the vote's start, so a late screen joins it in
 * step. Reduced motion: no bob (styles in vote-tags.css). Every pawn vote with zones that aren't named on the board already: 50 v 50
 * and Squads (VoteScreen). 1 v 1's DuelVote keeps its own labels above the zones (docs/decisions/2026-11-25-vote-labels.md).
 */

export interface VoteTag {
  key: string;
  label: string;
  /** Its zone on screen, percent of the board (zoneOnScreen). */
  box: { left: number; top: number; width: number; height: number };
}

export function VoteZoneTags({ tags, startsAt, now, voted }: { tags: readonly VoteTag[]; startsAt: number; now: number; voted: boolean }) {
  // When your vote went in (on this screen): the tags fade from then.
  const votedAt = useRef<number | null>(null);
  if (voted && votedAt.current === null) votedAt.current = now;
  if (!voted) votedAt.current = null;
  // A screen that opens after the vote began joins the motion where it is: a negative delay, fixed when the tags first show.
  const delay = useRef<{ startsAt: number; ms: number } | null>(null);
  if (delay.current?.startsAt !== startsAt) delay.current = { startsAt, ms: -Math.max(0, Math.round(now - startsAt)) };
  const since = now - startsAt;
  if (since < 0 || since >= VOTE_TAGS.showMs) return null;
  if (votedAt.current !== null && now - votedAt.current >= VOTE_TAGS.goneMs) return null;
  const style = {
    "--vt-ms": `${VOTE_TAGS.showMs}ms`,
    "--vt-gone-ms": `${VOTE_TAGS.goneMs}ms`,
    "--vt-delay": `${delay.current.ms}ms`,
  };
  return (
    <div class={`vote-tags${votedAt.current !== null ? " gone" : ""}`} style={style} aria-hidden="true">
      {tags.map((t) => {
        // The zones touch, so a name fits its own zone's width: up to 10 letters on one line, shrunk to fit if it must; longer, it
        // wraps onto two lines, its longest word fitting. `--vt-fit`: the letters a line must hold.
        const one = t.label.length <= 10;
        const fit = one ? t.label.length : Math.max(...t.label.split(" ").map((w) => w.length));
        return (
          <div
            key={t.key}
            class={`vt${one ? " one" : ""}`}
            data-zone={t.key}
            style={{ left: `${t.box.left + t.box.width / 2}%`, top: `${t.box.top}%`, "--vt-fit": String(Math.max(6, fit)) }}
          >
            <span class="vt-tag">{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}
