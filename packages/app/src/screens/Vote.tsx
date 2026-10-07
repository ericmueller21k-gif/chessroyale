import { memo } from "preact/compat";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  PREGAME_VOTES,
  clampToZone,
  voteHomeSpots,
  voteZoneAt,
  voteZoneBox,
  voteZoneCentre,
  voteZoneSpot,
  type BoardSpot,
  type ItemLook,
} from "@chessroyale/core";
import { START_FEN } from "@chessroyale/chess";
import { Avatar } from "../components/Items.tsx";
import { Board } from "../components/Board.tsx";
import { TimerBar, useFrameNow } from "../components/Countdown.tsx";
import { EvalBar } from "../components/EvalBar.tsx";
import { MuteButton } from "../components/MuteButton.tsx";
import { myTeam, type GameView, type VoteView } from "../game.ts";
import { pawnLook } from "../looks.ts";
import { underBoardView } from "../prefs.ts";
import { play } from "../sound.ts";
import { useCrowdAnimations } from "./Crowd.tsx";

/** No pieces while the votes run: only everyone's pawns. */
const EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1";
/** How long a pawn takes to glide into its zone (the CSS transition on .vote-pawn). */
const GLIDE_MS = 700;
/** Between the votes: everyone's pawn walks back to its starting spot over the result's last this-many ms. */
const RESET_MS = 650;
/** After the last vote: the pawns and zones fade over the result's last this-many ms… */
const LEAVE_MS = 950;
/** …and the real pieces drop into the starting position (they're down by the time the game's screen takes over). */
const DROP_MS = 700;
/** Time's up: "Didn't vote? You're with the crowd" shows above the board this long after the last of them lands. */
const CROWD_LINE_MS = 1100;

type Orientation = "white" | "black";

/** Where a point on the board (squares from White's side) sits on screen, in percent of the board, from this side. */
function onScreen(p: BoardSpot, orientation: Orientation) {
  return orientation === "white" ? { left: p.x * 12.5, top: (8 - p.y) * 12.5 } : { left: (8 - p.x) * 12.5, top: p.y * 12.5 };
}

/** A zone's box on screen (percent), from this side. */
function zoneOnScreen(option: number, orientation: Orientation) {
  const z = voteZoneBox(option);
  const a = onScreen({ x: z.x0, y: z.y1 }, orientation);
  const b = onScreen({ x: z.x1, y: z.y0 }, orientation);
  return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), width: 25, height: 25 };
}

/**
 * Someone else's pawn: faint (a "ghost"), dressed as they are. It glides when its spot changes (CSS), and pawns
 * lower on the screen stand in front.
 */
const VotePawn = memo(function VotePawn({ id, left, top, look, hat, side, voted }: { id: string; left: number; top: number; look?: ItemLook; hat: string; side: "w" | "b"; voted: boolean }) {
  return (
    <span class={`vote-pawn${voted ? " in" : ""}`} data-id={id} style={{ left: `${left}%`, top: `${top}%`, zIndex: String(Math.round(top * 10)) }}>
      <Avatar look={look} side={side} hat={hat} />
    </span>
  );
});

/** A count that pops (a quick scale bump) each time it goes up: the tally bubbling up as votes land. */
function PopCount({ n, class: cls }: { n: number; class: string }) {
  return (
    <span key={`n${n}`} class={`${cls}${n > 0 ? " pop" : ""}`}>
      {n}
    </span>
  );
}

/**
 * A pre-game vote. The board is empty but for the players: everyone is their own pawn, dressed in their look,
 * White's scattered over ranks 1-2 and Black's over ranks 7-8. Yours is solid and a little bigger (voteYouScale);
 * everyone else's is a faint ghost. Drag your pawn into one of the three zones (or tap it, then a zone, or tap a
 * card) to vote. Everyone's pawn glides into the zone they vote for as the votes come in, and each zone's count pops
 * as it goes up. When time's up the winning zone lights up and everyone who didn't vote walks into it ("Didn't vote?
 * You're with the crowd"), then the banner names the winner; between the votes everyone walks back to their spot,
 * and after the last one the pawns fade and the real pieces drop into place for the game.
 */
export function VoteScreen({ match, vote }: { match: GameView; vote: VoteView }) {
  const def = PREGAME_VOTES[vote.index]!;
  const now = useFrameNow();
  const animate = useCrowdAnimations();
  const side = myTeam(match) ?? "w";
  const orientation: Orientation = side === "w" ? "white" : "black";
  const counting = vote.result === null;
  const open = counting && now < vote.until;
  const last = vote.index + 1 >= vote.count;
  const nextAt = vote.nextAt ?? Infinity;
  // After the result: everyone goes back to their spot for the next vote, or (after the last) the game takes over.
  const resetting = !counting && !last && now >= nextAt - RESET_MS;
  const leaving = !counting && last && now >= nextAt - LEAVE_MS;
  const dropping = !counting && last && now >= nextAt - DROP_MS;
  // (After the last vote they fade where they stand.)
  const home = resetting;
  // The game's screen makes its board bigger when the space under it is folded (that space's own setting): so does this.
  const [towerClosed] = useState(() => !underBoardView().open);

  // Everyone in the match, their look, and their starting spot (seeded by id: the same in both votes).
  const players = useMemo(() => match.standings(), [vote.key]);
  const me = players.find((p) => p.isYou) ?? null;
  const spots = useMemo(() => voteHomeSpots(players.map((p) => ({ id: p.id, side: p.team === "b" ? "b" : "w" }))), [players]);
  const looks = useMemo(() => new Map(players.map((p) => [p.id, pawnLook(p)])), [players]);

  const visible = vote.votes.filter((v) => v.at <= now || match.isYou(v.playerId));
  const votedIds = new Set(visible.map((v) => v.playerId));
  const mine = visible.find((v) => match.isYou(v.playerId)) ?? null;
  // Time's up: everyone who didn't vote joins the winner (closePregameVote). They walk there, and the banner waits
  // until they've landed: it covers the zones.
  const joined = vote.votes.filter((v) => v.joined);
  const youJoined = joined.some((v) => match.isYou(v.playerId));
  const walkedAt = joined.length && animate ? Math.max(...joined.map((v) => v.at)) + GLIDE_MS : -Infinity;
  // A vote counts (and its count pops) as its pawn lands in the zone; yours at once; all of them once it's counted
  // (but those who join the winner as they land).
  const landed = (v: VoteView["votes"][number]) => !animate || (!counting && !v.joined) || match.isYou(v.playerId) || v.at + GLIDE_MS <= now;
  const counts = def.options.map((_, i) => visible.filter((v) => v.option === i && landed(v)).length);
  const canAct = open && (!mine || !!vote.changeAllowed);

  // Where each voter lands in their zone: the next free spot on their side's half, in the order the votes arrive.
  const landing = useRef<{ key: string; spot: Map<string, { option: number; k: number }>; next: Map<string, number> }>({ key: "", spot: new Map(), next: new Map() });
  if (landing.current.key !== vote.key) landing.current = { key: vote.key, spot: new Map(), next: new Map() };
  for (const v of [...visible].sort((a, b) => a.at - b.at)) {
    const had = landing.current.spot.get(v.playerId);
    if (had?.option === v.option) continue;
    const slot = `${v.option}${v.side}`;
    const k = landing.current.next.get(slot) ?? 0;
    landing.current.next.set(slot, k + 1);
    landing.current.spot.set(v.playerId, { option: v.option, k });
  }

  // Your pawn: where you dropped it (or the middle of your half of the zone you tapped), and the drag in progress.
  const [myDrop, setMyDrop] = useState<{ key: string; option: number; spot: BoardSpot } | null>(null);
  const [dragAt, setDragAt] = useState<BoardSpot | null>(null);
  const [selected, setSelected] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const press = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  useEffect(() => {
    // A new vote: nothing carried over.
    setSelected(false);
    setDragAt(null);
    press.current = null;
  }, [vote.key]);
  useEffect(() => {
    if (!canAct) {
      setSelected(false);
      setDragAt(null);
    }
  }, [canAct]);

  const winner = vote.result === null ? null : def.options[vote.result]!;
  useEffect(() => {
    if (vote.result !== null) play("select");
  }, [vote.result]);

  const cast = (option: number, spot: BoardSpot) => {
    if (!canAct || mine?.option === option) return;
    setMyDrop({ key: vote.key, option, spot });
    setSelected(false);
    match.castVote(option);
  };

  /** A point under the finger, in squares from White's side. */
  const toBoard = (clientX: number, clientY: number): BoardSpot | null => {
    const r = layer.current?.getBoundingClientRect();
    if (!r || !r.width) return null;
    const fx = ((clientX - r.left) / r.width) * 8;
    const fy = ((clientY - r.top) / r.height) * 8;
    return orientation === "white" ? { x: fx, y: 8 - fy } : { x: 8 - fx, y: fy };
  };
  const onDown = (e: PointerEvent) => {
    if (!canAct) return;
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
    if (!p.moved) {
      // A tap: pick your pawn up (then tap a zone), or put it down again.
      setSelected((s) => !s);
      return;
    }
    const at = toBoard(e.clientX, e.clientY);
    setDragAt(null);
    const zone = at ? voteZoneAt(at) : null;
    // Let go in a zone: that's your vote, and the pawn stays where you put it. Anywhere else, it walks back.
    if (at && zone !== null) cast(zone, clampToZone(zone, at, side));
  };
  const onCancel = () => {
    press.current = null;
    setDragAt(null);
  };

  // Your pawn's place: under your finger while dragging (a little above it, so you can see it), in your zone once
  // you've voted (or joined the winner), else your starting spot.
  // (Yours is a little bigger than the others: its spot keeps it inside the board's edge.)
  const seeded = me ? spots.get(me.id) : undefined;
  const myHome = seeded && { x: Math.min(7.64, Math.max(0.36, seeded.x)), y: seeded.y };
  const myVoted = mine && !home ? (myDrop?.key === vote.key && myDrop.option === mine.option ? myDrop.spot : voteZoneCentre(mine.option, side)) : null;
  const myAt = dragAt ? { x: dragAt.x, y: dragAt.y + (orientation === "white" ? 0.3 : -0.3) } : (myVoted ?? myHome);
  const myLook = me ? looks.get(me.id)! : pawnLook({ id: "", isYou: true, isBot: false });
  const overZone = dragAt ? voteZoneAt(dragAt) : null;

  const nextLabel = vote.index + 1 < vote.count ? PREGAME_VOTES[vote.index + 1]!.title : "The game begins";
  const nextIn = vote.nextAt ? Math.max(0, Math.ceil((vote.nextAt - now) / 1000)) : null;
  const hint = winner
    ? joined.length && now < Math.max(walkedAt, vote.until) + CROWD_LINE_MS
      ? youJoined
        ? "You didn't vote, so you're with the crowd."
        : "Didn't vote? You're with the crowd."
      : `${nextLabel}${nextIn ? ` in ${nextIn}…` : "…"}`
    : !open
      ? "Counting the votes…"
      : mine
        ? vote.changeAllowed
          ? "Vote in. Drag your pawn again to change it."
          : "Vote in. Watch the crowd decide."
        : selected
          ? "Now tap a zone."
          : "Drag your pawn into a zone, or tap a card.";

  return (
    <div class={`screen game vote-screen${towerClosed ? " tower-closed" : ""}`}>
      {/* The same frame as the game's screens (the top line, the line above the board, the board beside its eval
          bar), so the board stays exactly where it is when the game begins. */}
      <div class="hud-row vote-hud">
        <div class="hud vote-title">
          <span class="vote-step">
            Vote {vote.index + 1} of {vote.count}
          </span>
          <h1>{def.title}</h1>
        </div>
        <MuteButton />
      </div>
      <div class="board-area">
        <div class="opening-name vote-hint" aria-live="polite">
          {hint}
        </div>
        <div class={`board-row vote-board-row${dropping ? " dropping" : ""}`}>
          <EvalBar fen={START_FEN} orientation={side} evaluate={(f) => match.evaluate(f)} />
          <Board fen={dropping ? START_FEN : EMPTY_FEN} orientation={orientation} animate={false}>
            {counting && <TimerBar startsAt={vote.startsAt} deadline={vote.until} total={Math.max(1, vote.until - vote.startsAt)} />}
            <div
              ref={layer}
              class={`vote-layer${animate ? " animate" : ""}${leaving ? " leaving" : ""}${selected ? " picking" : ""}${dragAt ? " dragging" : ""}`}
              style={{ "--vp-me": `calc(var(--vp) * ${match.settings.voteYouScale ?? 1})` }}
              onClick={() => selected && setSelected(false)}
            >
              <div class="vote-zones" aria-hidden="true">
                {def.options.map((o, i) => {
                  const box = zoneOnScreen(i, orientation);
                  const state = vote.result === null ? "" : vote.result === i ? " win" : " lose";
                  return (
                    <div
                      key={o.id}
                      class={`vote-zone${state}${mine?.option === i ? " mine" : ""}${overZone === i ? " over" : ""}`}
                      style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
                    />
                  );
                })}
              </div>
              <div class="vote-pawns" aria-hidden="true">
                {players.map((p) => {
                  if (p.isYou) return null;
                  const at = landing.current.spot.get(p.id);
                  const voted = !home && !!at && votedIds.has(p.id);
                  const pawnSide = p.team === "b" ? "b" : "w";
                  const spot = voted ? voteZoneSpot(at!.option, pawnSide, at!.k) : spots.get(p.id)!;
                  const { left, top } = onScreen(spot, orientation);
                  const look = looks.get(p.id)!;
                  return <VotePawn key={p.id} id={p.id} left={left} top={top} look={look.look} hat={look.hat} side={pawnSide} voted={voted} />;
                })}
              </div>
              {/* Each zone's icon and count, on its far half (the other team's): your team's votes and your pawn
                  land on the near half, in full view. */}
              <div class="vote-labels" aria-hidden="true">
                {def.options.map((o, i) => {
                  const box = zoneOnScreen(i, orientation);
                  const state = vote.result === null ? "" : vote.result === i ? " win" : " lose";
                  return (
                    <div key={o.id} class={`vote-label${state}`} style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height / 2}%` }}>
                      <span class="vote-zone-icon">{o.icon}</span>
                      <PopCount n={counts[i]!} class="vote-zone-count" />
                    </div>
                  );
                })}
              </div>
              {selected &&
                def.options.map((o, i) => {
                  const box = zoneOnScreen(i, orientation);
                  return (
                    <button
                      type="button"
                      key={o.id}
                      class="vote-zone-hit"
                      aria-label={`Vote ${o.label}`}
                      style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        cast(i, voteZoneCentre(i, side));
                      }}
                    />
                  );
                })}
              {myAt && (
                <span
                  class={`vote-pawn vote-me${dragAt ? " lifted" : ""}${selected ? " selected" : ""}${canAct ? " can" : ""}${mine && !home ? " in" : ""}`}
                  style={{ left: `${onScreen(myAt, orientation).left}%`, top: `${onScreen(myAt, orientation).top}%` }}
                  role="button"
                  aria-label={canAct ? "Your pawn: drag it into a zone to vote" : "Your pawn"}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onCancel}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Avatar look={myLook.look} side={side} hat={myLook.hat} />
                </span>
              )}
            </div>
            {winner && now >= walkedAt && (
              <div class={`vote-banner${resetting || leaving ? " leaving" : ""}`} role="status">
                <span class="vote-banner-icon">{winner.icon}</span>
                <strong>{winner.label}</strong>
                <span>{winner.blurb}</span>
                {winner.detail && <span class="vote-banner-detail">{winner.detail}</span>}
              </div>
            )}
          </Board>
        </div>
      </div>
      <div class={`vote-cards${orientation === "black" ? " flipped" : ""}${leaving ? " leaving" : ""}`} role="radiogroup" aria-label={def.title}>
        {def.options.map((o, i) => {
          const total = Math.max(1, counts.reduce((s, x) => s + x, 0));
          const state = vote.result === null ? "" : vote.result === i ? " win" : " lose";
          return (
            <button
              type="button"
              role="radio"
              aria-checked={mine?.option === i}
              key={o.id}
              class={`vote-card${mine?.option === i ? " on" : ""}${state}`}
              disabled={!canAct}
              onClick={() => cast(i, voteZoneCentre(i, side))}
            >
              <span class="vote-card-icon" aria-hidden="true">
                {o.icon}
              </span>
              <strong>{o.label}</strong>
              <span class="vote-card-blurb">{o.blurb}</span>
              <span class="vote-card-bar">
                <i style={{ width: `${(100 * counts[i]!) / total}%` }} />
              </span>
              <PopCount n={counts[i]!} class="vote-card-count" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

