import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useMemo, useState } from "preact/hooks";
import { SQUADS } from "@chessroyale/core";
import { applyMove, legalMoves, toSan } from "@chessroyale/chess";
import { minutesName, type Colour, type Side, type SquadsEvent } from "@chessroyale/chess/squads";
import { Board, type Arrow } from "../components/Board.tsx";
import { TimerBar, useFrameNow } from "../components/Countdown.tsx";
import { HistoryNav, useHistoryView } from "../components/HistoryNav.tsx";
import { MuteButton } from "../components/MuteButton.tsx";
import { ShadeMoves, type ShadeMove } from "../components/ShadeMoves.tsx";
import { ClockText, Member, SquadTag, SquadsBoards, StandingsStrip, shownTurn, useNow } from "../components/SquadsParts.tsx";
import type { SquadsClient } from "../squads.ts";
import {
  FORMAT_NAME,
  ROUND_NAME,
  bankText,
  colourOf,
  dutyOf,
  liveBank,
  drainRate,
  myBoards,
  points,
  scouting,
  shownMatches,
  sideIn,
  squadName,
  type LocalMatch,
} from "../squads-view.ts";

/**
 * A Squads match on screen (docs/areas/squads.md, "The screens"), in its round's format:
 * - **Relay** (round 1): your board full size (« » step through its moves), every board in the lobby as tiny boards
 *   across the top (YOU and NEXT marked), tappable once you've moved; your move shows at once.
 * - **Pairs** (round 2): you and your partner each pick; their pick shows live; you can't pick theirs; lock in; then the
 *   coin-flip reveal (the ghost-move reveal: both picks slide in, the reel lands on the coin's).
 * - **Pick and Block** (the final): pickers see their partner's pick live; blocks show live to everyone as red arrows;
 *   lock in; the reveal: both picks as ghost arrows, the active block slamming down as a red lock, then the coin. A
 *   "SQUAD FINAL" intro, knocked-out squads watching, and Armageddon's colour choice if it comes to that.
 * The same screen watches any board (spectating): nothing to choose, every board tappable.
 */

/** A board on screen: a match's key and the board's number. */
export interface BoardRef {
  key: string;
  board: number;
}

const sideWord = (c: Colour) => (c === "w" ? "White" : "Black");

/** The match to watch when you have none of your own: the final, else the latest round's first live match. */
export function spectateDefault(client: SquadsClient): BoardRef | null {
  const live = shownMatches([...client.matches.values()]).filter((m) => m.state !== "over");
  const pick = live.find((m) => m.round === 2) ?? live[live.length - 1] ?? shownMatches([...client.matches.values()]).pop();
  return pick ? { key: pick.key, board: 0 } : null;
}

/** The events of the last half on one board (the reveal reads its pair or pick-and-block event). */
function lastOn(m: LocalMatch, board: number): SquadsEvent | null {
  return m.last?.events.find((e) => (e.kind === "pair" || e.kind === "pickblock") && e.board === board) ?? null;
}

/** The reveal's timeline (ms after the half's result arrived), fitted to the show the server gives it. */
export function revealTimes(kind: "pair" | "pickblock", total: number, hit: boolean) {
  if (kind === "pair") {
    const land = Math.min(1800, total * 0.6);
    return { reelFrom: Math.min(450, total * 0.15), blocksAt: 0, slamAt: 0, land, playAt: Math.min(land + 500, total * 0.8) };
  }
  const slamAt = Math.min(1300, total * 0.29);
  const land = hit ? Math.min(2500, total * 0.55) : Math.min(3300, total * 0.72);
  return { reelFrom: Math.min(2100, total * 0.46), blocksAt: Math.min(700, total * 0.16), slamAt, land, playAt: Math.min(land + 500, total * 0.85) };
}

/** Where a square is, in eighths of the board (for overlays placed like SquareRing). */
function squareAt(square: string, orientation: "white" | "black") {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { x: orientation === "white" ? f : 7 - f, y: orientation === "white" ? 7 - r : r };
}

/**
 * The reveal over the board: Pairs' two picks, or the final's picks and blocks, then the coin. Ghost pieces slide to
 * each pick's square with its picker's name (ShadeMoves, the same as Crowd's reveal), a reel steps between them and
 * lands on the one that plays. In the final the active block slams down as a red lock first; if it hits a pick, the
 * other plays without a coin. Silent: the move's own knock comes when it plays.
 */
function Reveal({ client, e, fen, orientation, at, until }: { client: SquadsClient; e: Extract<SquadsEvent, { kind: "pair" | "pickblock" }>; fen: string; orientation: "white" | "black"; at: number; until: number }) {
  const now = useFrameNow();
  const t = now - at;
  const total = Math.max(1500, until - at);
  const pickers = e.kind === "pair" ? e.players : e.pickers;
  const hit = e.kind === "pickblock" ? e.hit : null;
  const times = revealTimes(e.kind, total, hit !== null);
  const name = (id: string | undefined) => (!id ? "?" : id === client.myId ? "You" : short(client.nameOf(id)));
  const missed = e.kind === "pair" ? e.missed : e.pickMissed;
  const shades: ShadeMove[] = e.picks.map((mv, i) => ({ move: mv, names: [missed[i] ? `${name(pickers[i])} (missed)` : name(pickers[i])], you: pickers[i] === client.myId }));
  const chosen = e.move;
  const landed = t >= times.land;
  // The reel: steps between the two picks, slowing, ending on the one that plays (a hit block plays the other at once).
  const steps = useMemo(() => {
    const n = 7;
    const end = e.picks.indexOf(chosen);
    const raw = Array.from({ length: n }, (_, i) => Math.pow(1.3, i));
    const scale = (times.land - times.reelFrom) / raw.reduce((a, b) => a + b, 0);
    let acc = times.reelFrom;
    return raw.map((d, i) => {
      const s = { at: acc, index: (end + n - 1 - i) % 2 };
      acc += d * scale;
      return s;
    });
  }, [e, total]);
  const reeling = hit === null && t >= times.reelFrom && !landed;
  const step = reeling ? steps.filter((s) => s.at <= t).pop() : undefined;
  const highlight = step ? e.picks[step.index]! : null;
  const arrows: Arrow[] = [];
  let lock: { square: string; cancelled: boolean } | null = null;
  if (e.kind === "pickblock") {
    if (t >= times.blocksAt) {
      e.blocks.forEach((b, i) => {
        if (!b) return;
        const active = t >= times.slamAt && e.active === i;
        if (t >= times.slamAt && e.active !== i) return;
        arrows.push({ move: b, brush: active && !e.cancelled ? "red" : "paleGrey" });
      });
    }
    const activeMove = e.active === null ? null : e.blocks[e.active];
    if (t >= times.slamAt && activeMove) lock = { square: activeMove.slice(2, 4), cancelled: e.cancelled };
  }
  // Both picks as ghost arrows under the ghost pieces (yours green, your partner's blue; a spectator's both blue).
  if (!landed) e.picks.forEach((p, i) => arrows.push({ move: p, brush: pickers[i] === client.myId ? "green" : "blue" }));
  return (
    <>
      <ShadeMoves fen={fen} moves={shades} orientation={orientation} highlight={highlight} chosen={landed ? chosen : hit !== null && t >= times.slamAt + 400 ? chosen : null} />
      <BoardArrows arrows={arrows} orientation={orientation} />
      {lock && (
        <div
          class={`sq-lock${lock.cancelled ? " cancelled" : ""}`}
          style={{ "--sq-x": String(squareAt(lock.square, orientation).x), "--sq-y": String(squareAt(lock.square, orientation).y) }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
            <rect x="4" y="10" width="16" height="11" rx="2.5" fill="currentColor" />
          </svg>
        </div>
      )}
    </>
  );
}

/** What the reveal is saying now, in the line above the board (`t`: ms since it began). */
export function revealCaption(client: SquadsClient, e: Extract<SquadsEvent, { kind: "pair" | "pickblock" }>, fen: string, t: number, total: number): string {
  const hit = e.kind === "pickblock" ? e.hit : null;
  const times = revealTimes(e.kind, total, hit !== null);
  const landed = t >= times.land;
  const pickers = e.kind === "pair" ? e.players : e.pickers;
  const whose = (id: string | undefined) => (id === client.myId ? "your" : `${id ? short(client.nameOf(id)) : "?"}'s`);
  const san = (mv: string) => toSan(fen, mv);
  if (e.kind === "pair") return landed ? `The coin plays ${whose(pickers[e.coin])} ${san(e.move)}` : "Flipping the coin…";
  if (t < times.slamAt) return e.mercy ? "No blocks: 3 or fewer moves" : "Two picks, two blocks…";
  const active = e.active === null ? null : e.blocks[e.active];
  if (!active) return landed ? `No block · the coin plays ${san(e.move)}` : "That block was missed · the coin…";
  if (e.cancelled) return "Block cancelled: mate threat";
  if (hit !== null) return `Blocked ${san(e.picks[hit]!)} · ${san(e.move)} plays`;
  return landed ? `Block missed · the coin plays ${san(e.move)}` : "Block missed both · the coin…";
}

/** A name short enough for a tag on the board: a bot's last word ("Gambit Gwen" → "Gwen"), a person's first 10 letters. */
export function short(name: string): string {
  const words = name.trim().split(/\s+/);
  const last = words.length > 1 ? words[words.length - 1]! : name;
  return last.length > 10 ? `${last.slice(0, 9)}…` : last;
}

const ARROW_COLOUR: Record<Arrow["brush"], string> = {
  green: "#15781b",
  blue: "#003088",
  red: "#c0262d",
  yellow: "#e68f00",
  paleGrey: "#4a4a4a",
  paleBlue: "#003088",
};

/**
 * Arrows the reveal draws itself (the Board's own arrows are its props, and the reveal runs on its own frames so the
 * rest of the screen isn't drawn sixty times a second): an SVG over the squares, in eighths of the board's own size.
 */
function BoardArrows({ arrows, orientation }: { arrows: Arrow[]; orientation: "white" | "black" }) {
  if (!arrows.length) return null;
  const c = (sq: string) => {
    const p = squareAt(sq, orientation);
    return { x: p.x + 0.5, y: p.y + 0.5 };
  };
  return (
    <svg class="sq-arrows" viewBox="0 0 8 8" aria-hidden="true">
      <defs>
        {Object.entries(ARROW_COLOUR).map(([k, col]) => (
          <marker key={k} id={`sq-head-${k}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={col} />
          </marker>
        ))}
      </defs>
      {arrows.map((a) => {
        const from = c(a.move.slice(0, 2));
        const to = c(a.move.slice(2, 4));
        const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        // (Stop short of the target's centre, so the head sits on the square, as the board's do.)
        const end = { x: to.x - ((to.x - from.x) / len) * 0.32, y: to.y - ((to.y - from.y) / len) * 0.32 };
        return <line key={`${a.move}${a.brush}`} x1={from.x} y1={from.y} x2={end.x} y2={end.y} stroke={ARROW_COLOUR[a.brush]} stroke-width="0.16" stroke-linecap="round" opacity="0.8" marker-end={`url(#sq-head-${a.brush})`} />;
      })}
    </svg>
  );
}

/**
 * The line under the board: the two squads' team clocks (yours first), and between them the free seconds counting
 * down while a move is being thought about (then the bank drains; ▼▼ when two of a squad's moves drain it at once).
 */
function ClockLine({ client, m }: { client: SquadsClient; m: LocalMatch }) {
  const now = useNow(100);
  const mine = sideIn(m, client.myId);
  const order: Side[] = mine === 1 ? [1, 0] : [0, 1];
  const live = m.state === "half" && m.current;
  const free = live ? Math.max(0, m.current!.startedAt + m.delayMs - now) : 0;
  const clockOf = (side: Side) => {
    const bankMs = m.armageddon ? liveBank(m, side, now) : liveBank(m, side, now);
    return { squadId: m.sides[side].squadId, bankMs, suddenDeath: bankMs <= 0, rate: drainRate(m, side, now), key: m.key };
  };
  return (
    <span class="sq-clockline">
      {order.map((side, i) => (
        <>
          {i === 1 && (
            <span key="free" class={`sq-free${free > 0 ? " on" : live ? " running" : ""}`} title="Free seconds: the team clock runs after them">
              {free > 0 ? `free ${(free / 1000).toFixed(1)}` : ""}
            </span>
          )}
          <span key={side} class={`sq-clockline-side${side === mine ? " you" : ""}`}>
            <SquadTag id={m.sides[side].squadId} you={side === mine} />
            <ClockText clock={clockOf(side)} delayMs={m.delayMs} short />
          </span>
        </>
      ))}
    </span>
  );
}

/** A center banner over the board (an intro, Armageddon): a title, a line, an optional countdown. */
function Banner({ title, sub, until, children }: { title: string; sub?: ComponentChildren; until?: number | null; children?: ComponentChildren }) {
  const now = useNow(200);
  const secs = until ? Math.max(0, Math.ceil((until - now) / 1000)) : null;
  return (
    <div class="sq-banner" role="status">
      <div class="sq-banner-title">{title}</div>
      {sub && <div class="sq-banner-sub">{sub}</div>}
      {children}
      {secs !== null && secs > 0 && <div class="sq-banner-count">{secs}</div>}
    </div>
  );
}

/** One line of plain-language rules for each format and role. */
function rulesLine(m: LocalMatch, role: "move" | "pick" | "block" | null): string {
  if (m.format === "relay") return "Each turn you make one move, one board along. Your squad's clock runs after the free seconds.";
  if (m.format === "pairs") return "You and your partner each pick a different move; a coin plays one of them.";
  if (role === "block") return "Block two moves they might play: a coin makes one block active. If it hits a pick, the other pick plays.";
  return "Two pickers pick, two blockers block (red). A coin makes one block active; if it hits a pick, the other plays, else a coin.";
}

/**
 * The match screen. `focus` is the board on the big board when you aren't asked to choose: your own (null) or one you
 * tapped. `extra` goes in the panel (the knocked-out and "through" cards, the bracket while you watch).
 */
export function SquadsMatchScreen({ client, panel, onNextRound, onLeave }: { client: SquadsClient; panel?: ComponentChildren; onNextRound?: () => void; onLeave?: () => void }) {
  const me = client.myId;
  const mySquad = client.mySquad;
  const matches = [...client.matches.values()];
  const mine = mySquad ? (matches.find((m) => m.state !== "over" && m.sides.some((s) => s.squadId === mySquad.id)) ?? null) : null;
  const [watch, setWatch] = useState<BoardRef | null>(null);
  const duty = mine ? dutyOf(mine, me) : null;
  const myLocked = !!duty && !!me && mine!.locked.includes(me);
  // Your own board: this turn's (during the show after a turn, still the one you just played).
  const myBoard = mine ? (myBoards({ ...mine, turn: shownTurn(mine) }, me)?.you ?? 0) : null;
  const home: BoardRef | null = mine && myBoard !== null ? { key: mine.key, board: myBoard } : spectateDefault(client);
  // A new half that asks something of you brings you back to your board.
  const seq = mine?.current?.seq ?? -1;
  useLayoutEffect(() => {
    if (duty && !myLocked) setWatch(null);
  }, [mine?.key, seq, !!duty]);
  // A watched match that has gone (finished long ago, or never was): back home.
  const viewing = watch && client.matches.get(watch.key) && shownMatches(matches).some((m) => m.key === watch.key) ? watch : home;
  const vm = viewing ? client.matches.get(viewing.key)! : null;
  // The sudden-death sting follows the big board's match.
  client.focus = vm?.key ?? null;
  if (!vm || !viewing) return <div class="screen center sq-wait">{panel ?? <p class="muted">Waiting for the bracket…</p>}</div>;
  const vb = vm.boards[viewing.board] ?? vm.boards[0]!;
  const onMine = !!mine && vm.key === mine.key && viewing.board === myBoard;
  const mySide = sideIn(vm, me);
  const myColour: Colour = mySide === null ? "w" : colourOf(vb, mySide);
  const orientation = myColour === "w" ? "white" : "black";
  return (
    <MatchView
      key={`${vm.key}/${vb.id}`}
      client={client}
      m={vm}
      boardId={vb.id}
      orientation={orientation}
      onMine={onMine}
      watching={!!watch && !onMine}
      canWatch={!duty || myLocked || vm.state !== "half"}
      onWatch={(key, board) => setWatch({ key, board })}
      onBack={() => setWatch(null)}
      panel={panel}
      onNextRound={onNextRound}
      onLeave={onLeave}
    />
  );
}

function MatchView({
  client,
  m,
  boardId,
  orientation,
  onMine,
  watching,
  canWatch,
  onWatch,
  onBack,
  panel,
  onNextRound,
  onLeave,
}: {
  client: SquadsClient;
  m: LocalMatch;
  boardId: number;
  orientation: "white" | "black";
  onMine: boolean;
  watching: boolean;
  canWatch: boolean;
  onWatch: (key: string, board: number) => void;
  onBack: () => void;
  panel?: ComponentChildren;
  onNextRound?: () => void;
  onLeave?: () => void;
}) {
  const me = client.myId;
  const b = m.boards[boardId]!;
  const now = Date.now();
  const history = useHistoryView(b.moves, [{ ply: 0, fen: b.startFen }]);
  // (A bot plays your seat after repeated misses: nothing to choose until you take it back.)
  const d = onMine && !client.me?.botPlays ? dutyOf(m, me) : null;
  const mySide = sideIn(m, me);
  const myLocked = !!me && m.locked.includes(me);
  const mineChoice = me ? (m.visible[me] ?? null) : null;
  const partner = d?.partner ?? null;
  const partnerChoice = partner ? (m.visible[partner] ?? null) : null;
  const scout = onMine ? scouting(m, me) : null;
  // The reveal: the last half's pair or pick-and-block on this board, until its move plays.
  const e = m.state === "show" && m.last ? lastOn(m, boardId) : null;
  const reveal = e && (e.kind === "pair" || e.kind === "pickblock") ? e : null;
  const times = reveal ? revealTimes(reveal.kind, Math.max(1500, m.last!.until - m.last!.at), reveal.kind === "pickblock" && reveal.hit !== null) : null;
  const revealing = !!reveal && !!times && now - m.last!.at < times.playAt;
  // (The reveal runs on its own frames; this screen is drawn again only at its moments: the slam, the landing, the move.)
  const [, redraw] = useState(0);
  const moments = revealing ? [times!.blocksAt, times!.slamAt, times!.land, times!.playAt].map((x) => m.last!.at + x).filter((x) => x > now) : [];
  useEffect(() => {
    const ts = moments.map((at) => setTimeout(() => redraw((n) => n + 1), Math.max(0, at - Date.now()) + 5));
    return () => ts.forEach(clearTimeout);
  }, [moments.join()]);
  // What the big board shows: a reveal's position before its move; your Relay move as soon as you made it.
  const before = m.last?.before[boardId] ?? b.fen;
  const relayMine = d?.duty.role === "move" && mineChoice ? mineChoice : null;
  const liveFen = revealing ? before : relayMine ? safeApply(b.fen, relayMine) : b.fen;
  const fen = history.browsing ? history.fen! : liveFen;
  const lastMove = history.browsing ? history.lastMove : revealing ? (m.boards[boardId]!.moves[m.boards[boardId]!.moves.length - 2] ?? null) : relayMine ?? b.lastMove;
  const choosing = !!d && m.state === "half" && !history.browsing && d.duty.board === boardId && !(d.duty.role === "move" && mineChoice);
  const allowed = useMemo(() => (choosing ? legalMoves(b.fen).filter((mv) => mv !== partnerChoice) : undefined), [choosing, b.fen, partnerChoice]);
  // Live arrows: your pick (green), your partner's (blue), every visible block (red).
  const arrows: Arrow[] = [];
  if (m.state === "half" && m.current && !history.browsing) {
    for (const duty of m.current.duties) {
      if (duty.board !== boardId || duty.role === "move") continue;
      for (const p of duty.players) {
        const mv = m.visible[p];
        if (!mv) continue;
        arrows.push({ move: mv, brush: duty.role === "block" ? "red" : p === me ? "green" : "blue" });
      }
    }
  }
  const arrowKey = arrows.map((a) => a.move + a.brush).join();
  const liveArrows = useMemo(() => arrows, [arrowKey]);
  const myDeadline = d && m.current ? d.duty.deadline : null;
  const status = revealing && reveal ? revealCaption(client, reveal, before, now - m.last!.at, Math.max(1500, m.last!.until - m.last!.at)) : statusLine(client, m, boardId, onMine, watching, d, scout, revealing);
  const round = `${ROUND_NAME[m.round]} · ${m.armageddon ? "Armageddon" : FORMAT_NAME[m.format]}`;
  const intro = m.state === "break" && m.startsAt !== null && m.startsAt > now;
  const armChoice = m.state === "armageddon" ? m.armageddonChoice : undefined;
  const sideTag = (s: Side) => <SquadTag id={m.sides[s].squadId} you={s === mySide} />;
  return (
    <div class={`screen game sq-game sq-${m.format}${m.round === 2 ? " sq-is-final" : ""}`}>
      <div class="hud-row">
        <div class="hud sq-hud">
          <span class="sq-hud-vs">
            {sideTag(mySide === 1 ? 1 : 0)}
            <span class="sq-hud-score">{points(scoreOf(m, mySide === 1 ? 1 : 0))}–{points(scoreOf(m, mySide === 1 ? 0 : 1))}</span>
            {sideTag(mySide === 1 ? 0 : 1)}
          </span>
          <span class="sq-hud-round muted">
            {round} · T{m.turn + 1}
          </span>
        </div>
        {client.test && onNextRound && (
          <button type="button" class="sq-next" onClick={onNextRound}>
            Next round
          </button>
        )}
        <MuteButton />
      </div>
      <StandingsStrip client={client} onLeave={onLeave} />
      <SquadsBoards client={client} watching={`${m.key}/${boardId}`} onWatch={canWatch ? onWatch : null} />
      <div class="board-area">
        <div class="opening-name sq-status" aria-live="polite">
          {status}
        </div>
        <div class="board-row">
          <Board fen={fen} orientation={orientation} lastMove={lastMove} interactive={choosing} moves={allowed} onMove={(mv) => client.choose(m.key, mv)} arrows={liveArrows}>
            {choosing && myDeadline && m.current && <TimerBar startsAt={m.current.startedAt} deadline={myDeadline} total={Math.max(1, myDeadline - m.current.startedAt)} quiet />}
            {revealing && reveal && <Reveal client={client} e={reveal} fen={before} orientation={orientation} at={m.last!.at} until={m.last!.until} />}
            {intro && (
              <Banner
                title={m.round === 2 ? "SQUAD FINAL" : `${ROUND_NAME[m.round]} · ${FORMAT_NAME[m.format]}`}
                sub={
                  <>
                    {sideTag(0)} v {sideTag(1)}
                  </>
                }
                until={m.startsAt}
              >
                {m.round === 2 && (
                  <div class="sq-banner-teams">
                    {([0, 1] as const).map((s) => (
                      <div key={s} class="sq-banner-team">
                        {m.sides[s].seats.map((id) => (
                          <Member key={id} client={client} id={id} />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                <div class="sq-banner-rules">{rulesLine(m, null)}</div>
              </Banner>
            )}
            {armChoice && (
              <Banner title="ARMAGEDDON" sub={m.drawnFinal ? `The final was drawn ${points(m.drawnFinal.points[0])}–${points(m.drawnFinal.points[1])}` : "The final was drawn"} until={armChoice.until}>
                <div class="sq-banner-rules">
                  {sideTag(armChoice.chooser)} had more time left, so it picks: White has more time, Black wins a draw.
                </div>
                {mySide === armChoice.chooser && !client.me?.botPlays && (
                  <div class="sq-arm-pick">
                    {(["w", "b"] as const).map((c) => (
                      <button type="button" key={c} class={`fd-btn${armChoice.colour === c ? " primary" : ""}`} onClick={() => client.armageddon(m.key, c)}>
                        {c === "w" ? `White · ${minutesName(SQUADS.armageddon.whiteSeconds)}` : `Black · ${minutesName(SQUADS.armageddon.blackSeconds)}, a draw wins`}
                      </button>
                    ))}
                  </div>
                )}
                {armChoice.colour && <div class="sq-banner-rules">Picked: {sideWord(armChoice.colour)}</div>}
              </Banner>
            )}
          </Board>
        </div>
        <HistoryNav view={history} total={b.moves.length} clock={<ClockLine client={client} m={m} />} />
      </div>
      <div class="sq-panel">
        {watching && (
          <button type="button" class="fd-btn small sq-back" onClick={onBack}>
            Back to my board
          </button>
        )}
        {d && m.state === "half" && <DutyPanel client={client} m={m} role={d.duty.role} partner={partner} mine={mineChoice} partnerChoice={partnerChoice} locked={myLocked} fen={b.fen} />}
        {!d && <p class="sq-explain">{rulesLine(m, null)}</p>}
        {client.me?.botPlays && !client.me.isBot && !client.me.left && mySide !== null && (
          <div class="sq-card">
            <div class="sq-card-title">A bot is playing your seat</div>
            <p class="muted small">After {SQUADS.noShowsBeforeBot} missed moves in a row a bot took over, so your squad isn't left short.</p>
            <button type="button" class="fd-btn primary" onClick={() => client.reclaim()}>
              Take my seat back
            </button>
          </div>
        )}
        {client.note && Date.now() - client.note.at < 4000 && (
          <p class="sq-note" role="alert">
            {client.note.text}
          </p>
        )}
        {panel}
      </div>
    </div>
  );
}

function safeApply(fen: string, move: string): string {
  try {
    return applyMove(fen, move);
  } catch {
    return fen;
  }
}

function scoreOf(m: LocalMatch, side: Side): number {
  let pts = 0;
  for (const b of m.boards) {
    if (!b.result) continue;
    if (b.result.winner === null) pts += 0.5;
    else if (colourOf(b, side) === b.result.winner) pts += 1;
  }
  return pts;
}

/** What's happening on the big board, in one line above it. */
function statusLine(
  client: SquadsClient,
  m: LocalMatch,
  boardId: number,
  onMine: boolean,
  watching: boolean,
  d: ReturnType<typeof dutyOf>,
  scout: ReturnType<typeof scouting>,
  revealing: boolean,
): string {
  const b = m.boards[boardId]!;
  const where = m.boards.length > 1 ? `Board ${boardId + 1}` : "The board";
  if (b.result) return `${where} is over: ${b.result.winner === null ? "a draw" : `${sideWord(b.result.winner)} won`}`;
  if (watching) return `Watching ${where} · ${squadName(m.sides[0].squadId)} v ${squadName(m.sides[1].squadId)}`;
  if (m.state === "break") return m.boards.length > 1 ? `${where} · starting soon` : "Starting soon";
  if (m.state === "armageddon") return "Armageddon: choosing colours";
  if (m.state === "over") return "The match is over";
  if (revealing) return m.format === "pairs" ? "The coin decides which pick plays" : "Picks, blocks, then the coin";
  if (m.state === "show") return "Moves landing…";
  const side = sideIn(m, client.myId);
  if (d) {
    const colour = sideWord(colourOf(b, d.duty.side));
    const partner = d.partner ? (client.isBot(d.partner) ? `${client.nameOf(d.partner)} (bot)` : client.nameOf(d.partner)) : "";
    if (d.duty.role === "move") return m.visible[client.myId!] ? `Moved · ${where} · waiting for the half to end` : `Your move · ${where} · you're ${colour}`;
    if (d.duty.role === "pick") return `Pick with ${partner} · you're ${colour}`;
    return `Block with ${partner} · ${colour} is picking`;
  }
  if (scout) return `${where} has finished · you're scouting this turn`;
  if (onMine && side !== null) {
    const toMove = m.current ? (m.current.duties.find((x) => x.board === boardId)?.side ?? null) : null;
    if (m.format === "final") {
      const mine = m.current?.duties.some((x) => x.side === side && x.role === "pick");
      return mine ? "Your squad is picking: watch your pickers" : "They're picking: watch the blocks";
    }
    return toMove === side ? "Your squad's move here" : "Their move · you play next half";
  }
  return `${where} · ${squadName(m.sides[0].squadId)} v ${squadName(m.sides[1].squadId)}`;
}

/** Your pick or block: who chose what, lock in. */
function DutyPanel({
  client,
  m,
  role,
  partner,
  mine,
  partnerChoice,
  locked,
  fen,
}: {
  client: SquadsClient;
  m: LocalMatch;
  role: "move" | "pick" | "block";
  partner: string | null;
  mine: string | null;
  partnerChoice: string | null;
  locked: boolean;
  fen: string;
}) {
  if (role === "move") {
    return (
      <div class="sq-duty move">
        <strong>{mine ? `You played ${toSan(fen, mine)}` : "Your move"}</strong>
        <span class="muted small">{mine ? "Tap a tiny board to watch it." : `${Math.round(m.delayMs / 1000)} s free, then your squad's clock runs.`}</span>
      </div>
    );
  }
  const partnerName = partner ? client.nameOf(partner) : "";
  const partnerLocked = !!partner && m.locked.includes(partner);
  const verb = role === "block" ? "block" : "pick";
  return (
    <div class={`sq-duty ${role}`}>
      <div class="sq-choices">
        <span class={`sq-choice you${mine ? "" : " none"}`}>
          <i aria-hidden="true" />
          You: <strong>{mine ? toSan(fen, mine) : `tap a ${verb}`}</strong>
          {locked && <em title="Locked in"> ✓</em>}
        </span>
        {partner && (
          <span class={`sq-choice partner${partnerChoice ? "" : " none"}`}>
            <i aria-hidden="true" />
            {partnerName}: <strong>{partnerChoice ? toSan(fen, partnerChoice) : "thinking…"}</strong>
            {partnerLocked && <em title="Locked in"> ✓</em>}
          </span>
        )}
      </div>
      <button type="button" class="fd-btn primary sq-lockin" disabled={!mine || locked} onClick={() => client.lock(m.key)}>
        {locked ? "Locked in" : `Lock in my ${verb}`}
      </button>
      <span class="muted small">{role === "block" ? "Not your partner's block. Blocks show to everyone in red." : "Not your partner's move. You can change until you lock in."}</span>
    </div>
  );
}

export { bankText };
