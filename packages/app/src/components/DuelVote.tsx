import { useEffect, useRef, useState } from "preact/hooks";
import { DUEL_ZONES, controlLabel, voteZoneAt, voteZoneBox, voteZoneCentre, voteZoneFor, zoneControl, type BoardSpot, type DuelZone, type ItemLook } from "@chessroyale/core";
import type { Color } from "@chessroyale/chess/duel";
import { Avatar } from "./Items.tsx";
import { TimerBar } from "./Countdown.tsx";
import { VoteHint, useVoteHint } from "./VoteHint.tsx";
import { useBoardAnimations } from "../hooks.ts";

/**
 * 1 v 1's time-control vote, drawn over the game's own board (Eric, Oct 16: "we don't want to move that board"):
 * three zones in the empty middle of the starting position, Bullet on the left, Blitz in the middle, Rapid on the
 * right (the same order from either side: voteZoneFor), and each player's dressed pawn standing off the grid on their
 * own side, on the line between their second and third ranks, so it's plainly out of place. Drag yours into a zone
 * (or tap it, then a zone); the other player's glides live to theirs. Five seconds; then "Timer: Blitz 3+2" over the
 * board (`DuelOverlay`) and the pawns are gone. The board's own squares and pieces stay exactly where they are.
 */

type Orientation = "white" | "black";

/** A point on the board (squares from White's side) on screen, in percent, from this side. */
function onScreen(p: BoardSpot, orientation: Orientation) {
  return orientation === "white" ? { left: p.x * 12.5, top: (8 - p.y) * 12.5 } : { left: (8 - p.x) * 12.5, top: p.y * 12.5 };
}

/** A zone's box on screen (percent), from this side. */
function zoneOnScreen(zone: number, orientation: Orientation) {
  const z = voteZoneBox(zone);
  const a = onScreen({ x: z.x0, y: z.y1 }, orientation);
  const b = onScreen({ x: z.x1, y: z.y0 }, orientation);
  return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), width: 25, height: 25 };
}

/**
 * Where a side's pawn starts: off the grid, on the line between its own second and third ranks, between the d- and
 * e-files (White's: y 2 from White's side; Black's: y 6). Outside every zone (they're ranks 4 and 5).
 */
export const duelPawnHome = (c: Color): BoardSpot => ({ x: 4, y: c === "w" ? 2 : 6 });

export interface DuelVoteProps {
  you: Color;
  picks: Record<Color, DuelZone | null>;
  looks: Record<Color, ItemLook | null>;
  voteAt: number;
  voteEndsAt: number;
  now: number;
  onPick: (zone: DuelZone) => void;
}

export function DuelVote({ you, picks, looks, voteAt, voteEndsAt, now, onPick }: DuelVoteProps) {
  const animate = useBoardAnimations();
  const orientation: Orientation = you === "w" ? "white" : "black";
  const them: Color = you === "w" ? "b" : "w";
  const open = now >= voteAt && now < voteEndsAt;
  // Zone k on this screen holds option k's zone from White's side: the options keep their order left to right.
  const zoneOf = (i: number) => voteZoneFor(i, you, DUEL_ZONES.length);
  const optionAt = (zone: number) => voteZoneFor(zone, you, DUEL_ZONES.length);
  const mine = picks[you];
  const hint = useVoteHint(open, !!mine);

  const layer = useRef<HTMLDivElement>(null);
  const press = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const [dragAt, setDragAt] = useState<BoardSpot | null>(null);
  const [selected, setSelected] = useState(false);
  // Where you let go in your zone (it stays there); a tap stands it in the middle of your half.
  const [drop, setDrop] = useState<{ zone: DuelZone; spot: BoardSpot } | null>(null);
  useEffect(() => {
    if (!open) {
      setSelected(false);
      setDragAt(null);
      press.current = null;
    }
  }, [open]);

  const cast = (zone: DuelZone, spot: BoardSpot) => {
    if (!open) return;
    setDrop({ zone, spot });
    setSelected(false);
    if (picks[you] !== zone) onPick(zone);
  };
  const toBoard = (clientX: number, clientY: number): BoardSpot | null => {
    const r = layer.current?.getBoundingClientRect();
    if (!r || !r.width) return null;
    const fx = ((clientX - r.left) / r.width) * 8;
    const fy = ((clientY - r.top) / r.height) * 8;
    return orientation === "white" ? { x: fx, y: 8 - fy } : { x: 8 - fx, y: fy };
  };
  const onDown = (e: PointerEvent) => {
    if (!open) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  };
  const onMove = (e: PointerEvent) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
    p.moved = true;
    setSelected(false);
    setDragAt(toBoard(e.clientX, e.clientY));
  };
  const onUp = (e: PointerEvent) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    if (!p.moved) return setSelected((s) => !s);
    const at = toBoard(e.clientX, e.clientY);
    setDragAt(null);
    const zone = at ? voteZoneAt(at) : null;
    // Let go in a zone: your pick, and the pawn stays where you put it (inside the zone's edges). Anywhere else: back.
    if (at && zone !== null) {
      const z = voteZoneBox(zone);
      const m = 0.5;
      cast(DUEL_ZONES[optionAt(zone)]!, { x: Math.min(z.x1 - m, Math.max(z.x0 + m, at.x)), y: voteZoneCentre(zone, you).y });
    }
  };

  const spotFor = (c: Color): BoardSpot => {
    const z = picks[c];
    if (!z) return duelPawnHome(c);
    const zone = zoneOf(DUEL_ZONES.indexOf(z));
    if (c === you && drop?.zone === z) return drop.spot;
    return voteZoneCentre(zone, c);
  };
  const myAt = dragAt ? { x: dragAt.x, y: dragAt.y + (orientation === "white" ? 0.3 : -0.3) } : spotFor(you);
  const theirAt = spotFor(them);
  const over = dragAt ? voteZoneAt(dragAt) : null;
  const pos = (p: BoardSpot) => onScreen(p, orientation);

  return (
    <>
      {open && <TimerBar startsAt={voteAt} deadline={voteEndsAt} total={Math.max(1, voteEndsAt - voteAt)} quiet />}
      <div ref={layer} class={`vote-layer dv-vote${animate ? " animate" : ""}${selected ? " picking" : ""}${dragAt ? " dragging" : ""}${open ? "" : " leaving"}`} onClick={() => selected && setSelected(false)}>
        <div class="vote-zones" aria-hidden="true">
          {DUEL_ZONES.map((z, i) => {
            const box = zoneOnScreen(zoneOf(i), orientation);
            return (
              <div
                key={z}
                class={`vote-zone${mine === z ? " mine" : ""}${over === zoneOf(i) ? " over" : ""}`}
                style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
              />
            );
          })}
        </div>
        <div class="vote-labels dv-labels" aria-hidden="true">
          {DUEL_ZONES.map((z, i) => {
            const box = zoneOnScreen(zoneOf(i), orientation);
            return (
              <div key={z} class={`dv-label${mine === z ? " mine" : ""}`} style={{ left: `${box.left + box.width / 2}%`, top: `${box.top}%` }}>
                {controlLabel(zoneControl(z))}
              </div>
            );
          })}
        </div>
        <span class={`vote-pawn dv-pawn${picks[them] ? " in" : ""}`} data-side={them} style={{ left: `${pos(theirAt).left}%`, top: `${pos(theirAt).top}%` }}>
          <Avatar look={looks[them] ?? undefined} side={them} />
        </span>
        {/* Zones to tap, once your pawn is picked up with a tap. */}
        {selected &&
          DUEL_ZONES.map((z, i) => {
            const box = zoneOnScreen(zoneOf(i), orientation);
            return (
              <button
                type="button"
                key={z}
                class="vote-zone-hit"
                aria-label={`Pick ${controlLabel(zoneControl(z))}`}
                style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  cast(z, voteZoneCentre(zoneOf(i), you));
                }}
              />
            );
          })}
        <span
          class={`vote-pawn vote-me dv-pawn${dragAt ? " lifted" : ""}${selected ? " selected" : ""}${open ? " can" : ""}${mine ? " in" : ""}`}
          data-side={you}
          style={{ left: `${pos(myAt).left}%`, top: `${pos(myAt).top}%` }}
          role="button"
          aria-label={open ? "Your pawn: drag it into Bullet, Blitz or Rapid" : "Your pawn"}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => {
            press.current = null;
            setDragAt(null);
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar look={looks[you] ?? undefined} side={you} />
        </span>
      </div>
      <VoteHint show={hint && !dragAt} text="Drag your pawn into the speed you want" class="dv-hint" />
    </>
  );
}

/** "Timer: Blitz 3+2" over the board after the vote, before White's first move (a line, not a banner). */
export function DuelOverlay({ text }: { text: string }) {
  return (
    <div class="dv-overlay" role="status">
      {text}
    </div>
  );
}
