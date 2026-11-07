import { render, type ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { SQUADS, SQUADS_LOBBY, bannerPlusMs } from "@chessroyale/core";
import { applyMove, fenAtPly, inCheck, legalMoves, toSan, type MoveScore } from "@chessroyale/chess";
import { matchClockLine, minutesName, tokenLines, type Colour, type Side, type SquadsEvent } from "@chessroyale/chess/squads";
import { Board, type Arrow } from "../components/Board.tsx";
import { TimerBar, useFrameNow } from "../components/Countdown.tsx";
import { HistoryNav, useHistoryView } from "../components/HistoryNav.tsx";
import { COMPUTER_LAYOUT, MatchMenu, SwitchRow, type MatchExit } from "../components/MatchMenu.tsx";
import { useMedia } from "../components/QuickChat.tsx";
import { ShadeMoves, type ShadeMove } from "../components/ShadeMoves.tsx";
import { ClockText, Member, SquadTag, SquadsBoards, StandingsStrip, Watchers, shownTurn, useNow } from "../components/SquadsParts.tsx";
import { testParams } from "../test-switches.ts";
import { BlockArrows, BlockPicker, ChipIcon, LockIcon, PickTags, SquadResources, TokenBreakdown, squareAt } from "../components/SquadsBlocks.tsx";
import { Coins, ItemIcon, KitIcons } from "../components/MercenaryShop.tsx";
import { CoachMarks, ReplayButton, ReplayIcon, ReplayTag, useReplayMode } from "../components/MoveReplay.tsx";
import { replayFrameAt, replayFrames, replayMoves, replayTimes, type ReplayFrame } from "../move-replay.ts";
import { ownEngine } from "../engine.ts";
import { onPrefsChange, setSquadsJumpNext, squadsJumpNext } from "../prefs.ts";
import type { SquadsClient } from "../squads.ts";
import {
  CHEAT_BRUSHES,
  FORMAT_NAME,
  JUMP_NEXT_INFO,
  JUMP_NEXT_LABEL,
  ROUND_NAME,
  bankText,
  squadColour,
  boardQueue,
  foldedRows,
  queueLine,
  queuePlace,
  type TurnRow,
  blockBankNow,
  hasBlocks,
  blockCheatFen,
  blockName,
  blocksShown,
  canUseStockfish,
  cheatArrows,
  cheatEval,
  cheatLinesAt,
  colourOf,
  dutyOf,
  freeMs,
  replayCount,
  liveBank,
  chipLeftMs,
  chipsLeft,
  canTapChip,
  drainRate,
  myAssist,
  myBoards,
  points,
  scouting,
  shownMatches,
  sideIn,
  squadName,
  stockfishLeft,
  notWatchers,
  studyBoard,
  walletOf,
  type LocalBoard,
  type LocalMatch,
} from "../squads-view.ts";

/**
 * A Squads match on screen (docs/areas/squads.md, "The screens"), in its round's format:
 * - **Relay** (round 1): your board full size (« » step through its moves), every board in the lobby as tiny boards
 *   across the top (YOU and NEXT marked), tappable once you've moved; your move shows at once.
 * - **Pairs** (round 2): you and your partner each pick; their pick shows live; lock in; then the coin-flip reveal (the
 *   ghost-move reveal: both picks slide in, the reel lands on the coin's). The same move as your partner's plays for
 *   sure and uses one of your squad's same-move tokens (none left: picks must differ); the judge may refund it.
 * - **The final** (a majority vote): the whole squad picks, teammates' picks live with their names, copy one with a
 *   tap; the reveal: every pick as a ghost with its pickers' names, the most picked plays (a tie: the coin). A "SQUAD
 *   FINAL" intro, knocked-out squads watching, and Armageddon's color choice if it comes to that.
 * - **Blocks** (every round): on your turn, before your move is settled, Block, tap their piece, tap where it would go:
 *   that move can't be played on their next turn there. Every blocked move shows to everyone as a soft arrow that keeps
 *   drawing itself, a lock pulsing on it, until they've moved. Each squad's block bank and tokens are under the board.
 * The same screen watches any board (spectating): nothing to choose, every board tappable.
 */

/** A board on screen: a match's key and the board's number; `ply`: a position on it to show (a turn order row's tap). */
export interface BoardRef {
  key: string;
  board: number;
  ply?: number;
  /** (Each tap anew, so the same row twice shows it twice.) */
  at?: number;
}

const sideWord = (c: Colour) => (c === "w" ? "White" : "Black");

/** The match to watch when you have none of your own: the final, else the latest round's first live match. */
export function spectateDefault(client: SquadsClient): BoardRef | null {
  const live = shownMatches([...client.matches.values()]).filter((m) => m.state !== "over");
  const pick = live.find((m) => m.round === 2) ?? live[live.length - 1] ?? shownMatches([...client.matches.values()]).pop();
  return pick ? { key: pick.key, board: 0 } : null;
}

/** What a reveal shows: a pair's two picks (or one, the same move), or the final's vote. */
type RevealEvent = Extract<SquadsEvent, { kind: "pair" | "vote" }>;

/** The events of the last half on one board (the reveal reads its pair or vote event). */
function lastOn(m: LocalMatch, board: number): RevealEvent | null {
  return m.last?.events.find((e): e is RevealEvent => (e.kind === "pair" || e.kind === "vote") && e.board === board) ?? null;
}

/** The moves a reveal's reel steps between (the coin's choice), or none: the same move, a clear majority, a random move. */
function reelOf(e: RevealEvent): readonly string[] {
  if (e.kind === "pair") return e.same ? [] : e.picks;
  return e.tied.length > 1 ? e.tied : [];
}

/** The reveal's timeline (ms after the half's result arrived), fitted to the show the server gives it. */
export function revealTimes(e: RevealEvent, total: number) {
  if (!reelOf(e).length) {
    const land = Math.min(900, total * 0.3);
    return { reelFrom: 0, land, playAt: Math.min(land + 500, total * 0.8) };
  }
  const land = Math.min(1800, total * 0.6);
  return { reelFrom: Math.min(450, total * 0.15), land, playAt: Math.min(land + 500, total * 0.8) };
}

/**
 * The reveal over the board: a pair's two picks then the coin (or their one move, the same: no coin), or the final's
 * vote: every move picked slides in as a ghost with its pickers' names, then the most picked lands (a tie: a reel
 * between the tied moves lands on the coin's). Silent: the move's own knock comes when it plays.
 */
function Reveal({ client, e, fen, orientation, at, until }: { client: SquadsClient; e: RevealEvent; fen: string; orientation: "white" | "black"; at: number; until: number }) {
  const now = useFrameNow();
  const t = now - at;
  const total = Math.max(1500, until - at);
  const times = revealTimes(e, total);
  const name = (id: string | undefined) => (!id ? "?" : id === client.myId ? "You" : short(client.nameOf(id)));
  const shades: ShadeMove[] =
    e.kind === "pair"
      ? e.same
        ? [{ move: e.move, names: e.players.map((p) => name(p)), you: e.players.includes(client.myId ?? "") }]
        : e.picks.map((mv, i) => ({ move: mv, names: [e.missed[i] ? `${name(e.players[i])} (missed)` : name(e.players[i])], you: e.players[i] === client.myId }))
      : e.tally.map((x) => {
          const who = e.players.filter((_, i) => e.picks[i] === x.move);
          return { move: x.move, names: who.map((p) => name(p)), you: who.includes(client.myId ?? "") };
        });
  const chosen = e.move;
  const landed = t >= times.land;
  const reel = reelOf(e);
  // The reel: steps between the moves the coin chooses from, slowing, ending on the one that plays.
  const steps = useMemo(() => {
    if (!reel.length) return [];
    const n = 7;
    const end = reel.indexOf(chosen);
    const raw = Array.from({ length: n }, (_, i) => Math.pow(1.3, i));
    const scale = (times.land - times.reelFrom) / raw.reduce((a, b) => a + b, 0);
    let acc = times.reelFrom;
    return raw.map((d, i) => {
      const step = { at: acc, index: (end + reel.length * n - (n - 1 - i)) % reel.length };
      acc += d * scale;
      return step;
    });
  }, [e, total]);
  const reeling = reel.length > 0 && t >= times.reelFrom && !landed;
  const step = reeling ? steps.filter((x) => x.at <= t).pop() : undefined;
  const highlight = step ? reel[step.index]! : null;
  // The picks as ghost arrows under the ghost pieces (yours green, the others blue).
  const arrows: Arrow[] = landed ? [] : shades.map((x) => ({ move: x.move, brush: x.you ? "green" : "blue" }));
  return (
    <>
      <ShadeMoves fen={fen} moves={shades} orientation={orientation} highlight={highlight} chosen={landed ? chosen : null} />
      <BoardArrows arrows={arrows} orientation={orientation} />
    </>
  );
}

/** What the reveal is saying now, in the line above the board (`t`: ms since it began). */
export function revealCaption(client: SquadsClient, e: RevealEvent, fen: string, t: number, total: number): string {
  const landed = t >= revealTimes(e, total).land;
  const san = (mv: string) => toSan(fen, mv);
  const whose = (id: string | undefined) => (id === client.myId ? "your" : `${id ? short(client.nameOf(id)) : "?"}'s`);
  if (e.kind === "pair") {
    if (e.same) return landed ? `Same move: ${san(e.move)} plays · a token used` : "Same move: no coin";
    return landed ? `The coin plays ${whose(e.players[e.coin ?? 0])} ${san(e.move)}` : "Flipping the coin…";
  }
  if (e.random) return `Nobody picked: a random move, ${san(e.move)}`;
  const most = e.tally[0]?.votes ?? 0;
  const counted = e.picks.filter(Boolean).length;
  if (e.tied.length > 1) return landed ? `A tie: the coin plays ${san(e.move)}` : `A tie, ${e.tied.length} moves on ${most} ${most === 1 ? "vote" : "votes"}: the coin…`;
  return `${san(e.move)} plays · ${most} of ${counted} ${counted === 1 ? "vote" : "votes"}`;
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
  party0: "#e8820c",
  party1: "#2f6fe0",
  party2: "#c2349b",
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
        // (Stop short of the target's center, so the head sits on the square, as the board's do.)
        const end = { x: to.x - ((to.x - from.x) / len) * 0.32, y: to.y - ((to.y - from.y) / len) * 0.32 };
        return <line key={`${a.move}${a.brush}`} x1={from.x} y1={from.y} x2={end.x} y2={end.y} stroke={ARROW_COLOUR[a.brush]} stroke-width="0.16" stroke-linecap="round" opacity="0.8" marker-end={`url(#sq-head-${a.brush})`} />;
      })}
    </svg>
  );
}

/**
 * The line under the board: the two squads' team clocks (yours first), and between them the free seconds counting
 * down while a move is being thought about (then the bank drains; ▼▼ when two of a squad's moves drain it at once).
 * Under each clock, that squad's block bank and (Pairs) its same-move tokens: both squads see both, always.
 */
function ClockLine({ client, m, board }: { client: SquadsClient; m: LocalMatch; board: number }) {
  const now = useNow(100);
  const mine = sideIn(m, client.myId);
  const order: Side[] = mine === 1 ? [1, 0] : [0, 1];
  const live = m.state === "half" && m.current;
  // (The free seconds of this board's move: coming back to a board, 0.5 s more for each move replayed, Eric, Nov 5.)
  const free = live ? Math.max(0, m.current!.startedAt + freeMs(m, board) - now) : 0;
  const replayLeft = live ? Math.max(0, m.current!.startedAt + freeMs(m, board) - m.delayMs - now) : 0;
  // Mercenary: a Time chip on this board's move shows on its squad's clock (20 s left with a chip: 50), counting down
  // while the bank stands still.
  const duty = live ? m.current!.duties.find((d) => d.board === board) : undefined;
  const merc = m.mode === "mercenary";
  const clockOf = (side: Side) => {
    const bankMs = liveBank(m, side, now);
    const chip = merc && duty?.side === side ? chipLeftMs(m, board, now) : 0;
    return { squadId: m.sides[side].squadId, bankMs: bankMs + chip, suddenDeath: bankMs + chip <= 0, rate: drainRate(m, side, now), key: m.key, chip: chip > 0 };
  };
  const flash = merc && client.chipFlash && client.chipFlash.key === m.key && now - client.chipFlash.at < CHIP_FLASH_MS ? client.chipFlash : null;
  const myDuty = live && client.myId ? m.current!.duties.find((d) => d.players.includes(client.myId!)) : undefined;
  const canChip = merc && !!myDuty && myDuty.board === board && canTapChip(m, client.myId, now);
  return (
    <span class="sq-clockline">
      {order.map((side, i) => (
        <>
          {i === 1 && (
            <span key="free" class={`sq-free${free > 0 ? " on" : live ? " running" : ""}${replayLeft > 0 ? " replay" : ""}`} title="Free seconds: the team clock runs after them (coming back to a board, 0.5 s more for each move you missed)">
              {/* (While the replay's extra lasts, its icon in place of the word: the pill keeps its size.) */}
              {replayLeft > 0 && <ReplayIcon size={11} />}
              {free > 0 ? `${replayLeft > 0 ? "" : "free "}${(free / 1000).toFixed(1)}` : ""}
            </span>
          )}
          <span key={side} class={`sq-clockline-side${side === mine ? " you" : ""}`}>
            <span class="sq-clockline-top">
              <SquadTag id={m.sides[side].squadId} you={side === mine} />
              <span class={`mc-chip-clock${clockOf(side).chip ? " on" : ""}`}>
                <ClockText clock={clockOf(side)} delayMs={m.delayMs} short />
                {flash && flash.side === side && (
                  <span class="mc-chip-plus" key={flash.at} aria-hidden="true">
                    +{SQUADS.mercenary.chipSeconds} s
                  </span>
                )}
              </span>
              {side === mine && canChip && (
                <button type="button" class="mc-chip-btn" onClick={() => client.tapChip(m.key)} aria-label={`Tap a Time chip: ${SQUADS.mercenary.chipSeconds} more seconds for this move (${chipsLeft(m, side)} left)`}>
                  <ChipIcon size={14} />
                  <span class="mc-chip-btn-text">+{SQUADS.mercenary.chipSeconds}s</span>
                </button>
              )}
            </span>
            <SquadResources bank={hasBlocks(m, side) ? blockBankNow(m, side) : null} tokens={m.tokens ? m.tokens[side] : null} chips={merc ? chipsLeft(m, side) : null} you={side === mine} />
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

/**
 * Move replay (Eric, Nov 5; move-replay.ts): when your move on a board starts, the last 2 moves there or all since you
 * last played it (the replay button), one by one, within the extra free time the rule gave you (the server's `freeMs`;
 * the last 2 sooner done), then the board as it stands. None if you were watching this board when both of its last two
 * moves landed (`replayMoves`). Not while you browse the moves, or once skipped (a tap on the board). `me`: you, on your
 * own board (null: nothing to replay).
 */
function useMoveReplay(m: LocalMatch, b: LocalBoard, me: string | null, browsing: boolean): { frame: ReplayFrame | null; step: number; count: number; skip: () => void; arrivedAt: number } {
  const mode = useReplayMode();
  const d = me && m.state === "half" && m.current ? m.current.duties.find((x) => x.board === b.id && x.players.includes(me)) : undefined;
  // (The board's move count when it came on screen: this view is drawn afresh for each board, and kept while it shows.)
  const arrivedAt = useRef(b.moves.length);
  const n = d ? replayMoves({ mode, total: b.moves.length, missed: replayCount(d, me), arrivedAt: arrivedAt.current }) : 0;
  const extra = d ? freeMs(m, b.id) - m.delayMs : 0;
  const total = mode === "two" ? Math.min(extra, SQUADS_LOBBY.replay.firstMs + (n + 1) * SQUADS_LOBBY.replay.stepMs) : extra;
  const half = m.current ? `${m.key}/${m.current.seq}` : "";
  const [skipped, setSkipped] = useState<string | null>(null);
  const frames = useMemo(() => (n > 0 && total > 0 ? replayFrames(b.startFen, b.moves, b.by ?? [], n) : []), [half, n, total, b.moves.length]);
  const startedAt = m.current?.startedAt ?? 0;
  const frame = !browsing && skipped !== half && frames.length > 1 ? replayFrameAt(frames, total, Date.now() - startedAt) : null;
  // (Drawn again as each move lands, and as it ends.)
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!frame) return;
    const next = [...replayTimes(frames.length - 1, total), total].map((x) => startedAt + x).find((x) => x > Date.now());
    if (next === undefined) return;
    const t = setTimeout(() => redraw((k) => k + 1), next - Date.now() + 5);
    return () => clearTimeout(t);
  });
  return { frame, step: frame ? frames.indexOf(frame) : 0, count: frames.length - 1, skip: () => setSkipped(half), arrivedAt: arrivedAt.current };
}

/**
 * A replay's step over the big board: the position then (a board of its own over the real one, which stays ready for
 * your move under it), the move just played marked, and a name tag over the moved piece: who played it.
 */
function ReplayLayer({ client, m, frame, orientation }: { client: SquadsClient; m: LocalMatch; frame: ReplayFrame; orientation: "white" | "black" }) {
  const me = client.myId;
  const mySide = sideIn(m, me);
  const names = frame.by.map((id) => (id === me ? "You" : client.nameOf(id)));
  const tone = frame.by.includes(me ?? "") ? "you" : mySide !== null && frame.by.some((id) => m.sides[mySide].seats.includes(id)) ? "mate" : "them";
  return (
    <div class="rp-over" aria-hidden="true">
      <Board fen={frame.fen} orientation={orientation} lastMove={frame.lastMove} />
      {frame.lastMove && <ReplayTag key={frame.lastMove + frame.fen} square={frame.lastMove.slice(2, 4)} names={names} orientation={orientation} tone={tone} />}
    </div>
  );
}

/** Seconds as the screen says them: "2", "5.5". */
const secs = (ms: number) => String(Math.round(ms / 100) / 10);

/**
 * Your move's free time in words: "2 s free, then your squad's clock runs."; coming back to a board, with move replay's
 * extra (Eric, Nov 5): "5.5 s free (+3.5 s for 7 moves missed), then your squad's clock runs."
 */
export function freeLine(m: LocalMatch, me: string | null): string {
  const d = me ? m.current?.duties.find((x) => x.players.includes(me)) : undefined;
  const free = d ? freeMs(m, d.board) : m.delayMs;
  const n = replayCount(d, me);
  const extra = free - m.delayMs;
  return extra > 0 && n > 0 ? `${secs(free)} s free (+${secs(extra)} s for ${n} ${n === 1 ? "move" : "moves"} missed), then your squad's clock runs.` : `${secs(free)} s free, then your squad's clock runs.`;
}

/** One line of plain-language rules for each format. */
function rulesLine(m: LocalMatch): string {
  // (Relay: no blocks, Mercenary too; they come from the shop, after round 1: Eric, Oct 19.)
  // (3 boards and 4 a squad since Nov 5: the ring. A match stored on 4 boards keeps its line.)
  if (m.format === "relay") return m.boards.length < 4 ? "Your squad moves in turn, each move one board along; one of you waits to slot in. Best 2 of 3 boards." : "Each turn you make one move, one board along.";
  if (m.format === "pairs") return "You and your partner each pick; a coin plays one. Pick the same move and it plays for sure: a token.";
  return "Your whole squad votes: the most picked move plays (a tie: a coin). Copy a teammate with a tap.";
}

/**
 * The match screen. `focus` is the board on the big board when you aren't asked to choose: your own (null) or one you
 * tapped. `extra` goes in the panel (the knocked-out and "through" cards, the bracket while you watch).
 */
export function SquadsMatchScreen({
  client,
  panel,
  onNextRound,
  onLeave,
  exit = null,
}: {
  client: SquadsClient;
  panel?: ComponentChildren;
  onNextRound?: () => void;
  onLeave?: () => void;
  /** Resign or leave, from the top line (MatchMenu) and the standings' foot. */
  exit?: MatchExit | null;
}) {
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
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useLayoutEffect(() => {
    if (duty && !myLocked) {
      clearTimeout(jumpTimer.current);
      setWatch(null);
    }
  }, [mine?.key, seq, !!duty]);
  // "Jump to my next board" (Relay; on unless switched off, remembered on this device): once you've moved, the big
  // board goes to the board you play next, a beat later (your piece lands first), unless you've opened another. Once
  // a half; the half ending at once (you were the last to move: Eric, Oct 18) doesn't call it off.
  const jump = useJumpNext();
  const moved = !!duty && duty.duty.role === "move" && !!me && !!mine!.visible[me];
  const study = mine && moved && jump ? studyBoard(mine, me) : null;
  const jumpedIn = useRef<string | null>(null);
  useEffect(() => {
    if (study === null || !mine) return;
    const half = `${mine.key}/${seq}`;
    if (jumpedIn.current === half) return;
    jumpedIn.current = half;
    const key = mine.key;
    jumpTimer.current = setTimeout(() => setWatch((w) => w ?? { key, board: study }), SQUADS_LOBBY.watching.jumpAfterMs);
  }, [mine?.key, seq, study]);
  useEffect(() => {
    if (!jump) clearTimeout(jumpTimer.current);
  }, [jump]);
  useEffect(() => () => clearTimeout(jumpTimer.current), []);
  // A watched match that has gone (finished long ago, or never was): back home.
  const viewing = watch && client.matches.get(watch.key) && shownMatches(matches).some((m) => m.key === watch.key) ? watch : home;
  const vm = viewing ? client.matches.get(viewing.key)! : null;
  const vb = vm && viewing ? (vm.boards[viewing.board] ?? vm.boards[0]!) : null;
  // The sudden-death sting follows the big board's match.
  client.focus = vm?.key ?? null;
  // Who's watching: the server hears which board this screen shows, only when it changes (none once it's gone).
  const shown = vm && vb ? `${vm.key}/${vb.id}` : null;
  useEffect(() => client.view(vm && vb ? vm.key : null, vb?.id), [shown]);
  useEffect(() => () => client.view(null), []);
  if (!vm || !viewing || !vb) return <div class="screen center sq-wait">{panel ?? <p class="muted">Waiting for the bracket…</p>}</div>;
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
      studying={!onMine && !!mine && vm.key === mine.key && vb.id === studyBoard({ ...mine, turn: shownTurn(mine) }, me)}
      canWatch={!duty || myLocked || vm.state !== "half"}
      onWatch={(key, board) => setWatch(mine && key === mine.key && board === myBoard ? null : { key, board })}
      onShow={(board, ply) => setWatch({ key: vm.key, board, ply, at: Date.now() })}
      showAt={viewing.ply !== undefined ? { ply: viewing.ply, at: viewing.at ?? 0 } : null}
      canShow={!duty || myLocked || vm.state !== "half"}
      panel={panel}
      onNextRound={onNextRound}
      onLeave={onLeave}
      exit={exit}
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
  studying,
  canWatch,
  onWatch,
  onShow,
  showAt,
  canShow,
  panel,
  onNextRound,
  onLeave,
  exit,
}: {
  client: SquadsClient;
  m: LocalMatch;
  boardId: number;
  orientation: "white" | "black";
  onMine: boolean;
  watching: boolean;
  /** The board on screen is the one you play next (Relay: "Jump to my next board", or a tap). */
  studying: boolean;
  canWatch: boolean;
  onWatch: (key: string, board: number) => void;
  /** The turn order's row tapped: that board at that position (`canShow`: not while you have a move to make elsewhere). */
  onShow: (board: number, ply: number) => void;
  showAt: { ply: number; at: number } | null;
  canShow: boolean;
  panel?: ComponentChildren;
  onNextRound?: () => void;
  onLeave?: () => void;
  exit: MatchExit | null;
}) {
  const me = client.myId;
  const b = m.boards[boardId]!;
  const now = Date.now();
  const history = useHistoryView(b.moves, [{ ply: 0, fen: b.startFen }]);
  // (A turn order row's tap: this board at the position after that move.)
  useLayoutEffect(() => {
    if (showAt) history.go(showAt.ply);
  }, [showAt?.at]);
  // Move replay (Eric, Nov 5): back on a board, the moves you missed land first (a tap on the board skips it).
  const replay = useMoveReplay(m, b, onMine && !client.me?.botPlays ? me : null, history.browsing);
  // (A bot plays your seat after repeated misses: nothing to choose until you take it back.)
  const d = onMine && !client.me?.botPlays ? dutyOf(m, me) : null;
  const mySide = sideIn(m, me);
  const myLocked = !!me && m.locked.includes(me);
  const mineChoice = me ? (m.visible[me] ?? null) : null;
  const partner = d?.partner ?? null;
  const partnerChoice = partner ? (m.visible[partner] ?? null) : null;
  const scout = onMine ? scouting(m, me) : null;
  // The reveal: the last half's pair or vote on this board, until its move plays.
  const reveal = m.state === "show" && m.last ? lastOn(m, boardId) : null;
  const times = reveal ? revealTimes(reveal, Math.max(1500, m.last!.until - m.last!.at)) : null;
  const revealing = !!reveal && !!times && now - m.last!.at < times.playAt;
  // (The reveal runs on its own frames; this screen is drawn again only at its moments: the landing, the move.)
  const [, redraw] = useState(0);
  const moments = revealing ? [times!.land, times!.playAt].map((x) => m.last!.at + x).filter((x) => x > now) : [];
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
  // Blocks on this board: those in effect (this half's side to move can't play them) and those placed this half.
  const inEffect = m.state === "half" ? m.blocks.filter((x) => x.board === boardId).map((x) => x.move) : [];
  const noTokens = m.format === "pairs" && mySide !== null && (m.tokens?.[mySide] ?? 0) <= 0;
  const allowed = useMemo(
    () => (choosing ? legalMoves(b.fen).filter((mv) => !inEffect.includes(mv.slice(0, 4)) && !(noTokens && mv === partnerChoice)) : undefined),
    [choosing, b.fen, partnerChoice, inEffect.join(), noTokens],
  );
  // Blocking: before your squad's move here is settled, with points in the bank.
  const bank = mySide === null ? 0 : blockBankNow(m, mySide);
  const settled = !!d && (d.duty.role === "move" ? !!mineChoice : d.duty.players.every((p) => m.locked.includes(p)));
  // (Classic has no blocks; nor has a squad that came into this match without block points: none to start, Eric, Oct 19.)
  const canBlock = mySide !== null && hasBlocks(m, mySide) && !!d && m.state === "half" && !history.browsing && d.duty.board === boardId && !settled && !client.me?.botPlays;
  const [blockMode, setBlockMode] = useState(false);
  const blocking = blockMode && canBlock && bank > 0;
  useLayoutEffect(() => {
    if (!canBlock && blockMode) setBlockMode(false);
  }, [canBlock, m.current?.seq]);
  // Live arrows: your pick (green), your partner's or teammates' (blue); the final's carry their pickers' names.
  const arrows: Arrow[] = [];
  const tags: { move: string; names: string[]; you: boolean }[] = [];
  if (m.state === "half" && m.current && !history.browsing) {
    for (const duty of m.current.duties) {
      if (duty.board !== boardId || duty.role === "move") continue;
      for (const p of duty.players) {
        const mv = m.visible[p];
        if (!mv) continue;
        if (!arrows.some((a) => a.move === mv)) arrows.push({ move: mv, brush: p === me ? "green" : "blue" });
        else if (p === me) arrows.splice(arrows.findIndex((a) => a.move === mv), 1, { move: mv, brush: "green" });
        if (m.format !== "final") continue;
        const tag = tags.find((x) => x.move === mv) ?? (tags.push({ move: mv, names: [], you: false }), tags[tags.length - 1]!);
        tag.names.push(p === me ? "You" : short(client.nameOf(p)));
        tag.you ||= p === me;
      }
    }
  }
  const arrowKey = arrows.map((a) => a.move + a.brush).join();
  const liveArrows = useMemo(() => arrows, [arrowKey]);
  const myDeadline = d && m.current ? d.duty.deadline : null;
  const status = revealing && reveal
    ? revealCaption(client, reveal, before, now - m.last!.at, Math.max(1500, m.last!.until - m.last!.at))
    : replay.frame
      ? `Your move · Board ${boardId + 1} · replay ${replay.step} of ${replay.count}`
      : statusLine(client, m, boardId, onMine, watching, studying, d, scout, revealing, blocking);
  // Who else is watching this board (their pawns over it): never you or its own players this turn; each pawn in its
  // player's color here. (Strings, so the pawns are drawn again only when these change or someone comes or goes.)
  const notWatching = notWatchers({ ...m, turn: shownTurn(m) }, boardId, me).join(",");
  const colours = m.sides.flatMap((s, side) => s.seats.map((id) => `${id}:${colourOf(b, side as Side)}`)).join(",");
  const round = `${ROUND_NAME[m.round]} · ${m.armageddon ? "Armageddon" : FORMAT_NAME[m.format]}`;
  const intro = m.state === "break" && m.startsAt !== null && m.startsAt > now;
  const armChoice = m.state === "armageddon" ? m.armageddonChoice : undefined;
  // Cheat lines (test controls only): the engine's top moves wherever you choose, worked out on this device. While
  // blocking: the other squad's moves after yours (your pick if you have one, else a teammate's; or as things stand).
  const ownPick = mineChoice ?? partnerChoice ?? (d ? (d.team.map((p) => m.visible[p]).find(Boolean) ?? null) : null);
  const cheatBase = blocking ? blockCheatFen(b.fen, ownPick, applyMove, inCheck) : b.fen;
  const cheatFen = cheatBase === null ? null : cheatLinesAt(client.test, { choosing: choosing || blocking, colourChoice: !!armChoice && mySide === armChoice.chooser && !client.me?.botPlays, fen: cheatBase });
  const cheatOn = cheatFen !== null && client.cheatLines;
  const cheat = useCheatLines(cheatOn ? cheatFen : null);
  // Mercenary: a Stockfish token's lines, on your screen only (the final: your squad's), for your own decision on this
  // board this half: your side to move, your own top moves, never theirs (and never while blocking: that's their moves).
  const assist = m.state === "half" && !history.browsing ? myAssist(m, boardId, me) : null;
  const tokenOn = !!assist && !blocking && assist.fen === b.fen;
  const tokenTop = useEngineLines(tokenOn ? b.fen : null, SQUADS.mercenary.stockfish.lines + inEffect.length, SQUADS.mercenary.stockfish.nodes);
  const token = tokenOn && tokenTop ? tokenLines(tokenTop, inEffect) : null;
  const boardArrows = useMemo(
    () => (token?.length ? [...liveArrows, ...cheatArrows(token)] : cheatOn && cheat?.length ? [...liveArrows, ...cheatArrows(cheat)] : liveArrows),
    [liveArrows, cheatOn, cheat, token],
  );
  // Every blocked move on this board, for everyone, from when it's placed until the other squad has moved.
  const shownBlocks = history.browsing ? [] : blocksShown(m, boardId);
  const onBoard = client.bannerOn(m.key, boardId);
  const banner = onBoard && now - onBoard.at < bannerMs() ? onBoard : null;
  // (The banner goes when its time is up, whatever else is drawn meanwhile.)
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => redraw((n) => n + 1), Math.max(0, banner.at + bannerMs() - Date.now()) + 20);
    return () => clearTimeout(t);
  }, [banner?.at]);
  const sideTag = (s: Side) => <SquadTag id={m.sides[s].squadId} you={s === mySide} />;
  const computer = useMedia(COMPUTER_LAYOUT);
  const turnBox = m.format === "relay" ? <TurnOrderBox client={client} m={m} board={boardId} computer={computer} onRow={canShow ? onShow : null} shownPly={history.browsing ? history.ply : null} /> : null;
  return (
    <div class={`screen game sq-game sq-${m.format}${m.round === 2 ? " sq-is-final" : ""}`}>
      <div class="hud-row">
        {/* (The test-only "Next round": a tiny icon hard left, admins and test lobbies only; Nov 5, round 2.) */}
        {client.test && onNextRound && (
          <button type="button" class="sq-next" onClick={onNextRound} aria-label="Next round (test)" title="Next round (test)">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M2.5 3.2v9.6l6-4.8zM8.5 3.2v9.6l6-4.8z" fill="currentColor" />
            </svg>
          </button>
        )}
        {/* (Cheat lines, test controls only: on a phone's Relay a tiny switch here, its lines the arrows on the board.) */}
        {client.test && m.format === "relay" && !computer && (
          <button type="button" disabled={cheatFen === null} class={`sq-next sq-cheat-mini${client.cheatLines ? " on" : ""}`} aria-pressed={client.cheatLines} aria-label="Cheat lines (test)" title="Cheat lines (test)" onClick={() => client.toggleCheatLines()}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M2 13L13 2M9 2h4v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        )}
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
        {/* Move replay's button, then the gear (its list has Sound, Animations, Quick board jump, Resign and Report a bug). */}
        <ReplayButton />
        <MatchMenu exit={exit} extra={<QuickJumpRow />} />
      </div>
      {/* The first-time tips (Nov 5, round 2): at a player's first Relay, once per device. */}
      {m.format === "relay" && mySide !== null && <CoachMarks code={client.code} at={coachStart()} />}
      <StandingsStrip client={client} onLeave={onLeave} exit={exit} />
      <SquadsBoards client={client} watching={`${m.key}/${boardId}`} onWatch={canWatch ? onWatch : null} />
      <div class="board-area">
        <div class="sq-status-row">
          {/* Which board this is at a glance (Eric, Oct 18): its number, in the color you play on it. */}
          {m.boards.length > 1 && (
            <span class={`sq-board-no${mySide === null ? "" : ` is-${colourOf(b, mySide)}`}`} aria-hidden="true">
              {boardId + 1}
            </span>
          )}
          <div class="opening-name sq-status" aria-live="polite">
            {/* (A block placed or lifted: said here for a few seconds, both squads; the reveal's words come first.) */}
            {banner && !revealing ? (
              <span class={`sq-status-block${banner.kind ? ` mc-${banner.kind}` : ""}`} key={banner.at}>
                {banner.kind === "shield" ? <ItemIcon item="shield" size={13} /> : banner.kind === "brilliant" ? <span class="mc-bang" aria-hidden="true">!!</span> : <LockIcon size={13} />}
                {banner.text}
              </span>
            ) : (
              status
            )}
          </div>
          <Watchers client={client} board={`${m.key}/${boardId}`} hide={notWatching} colours={colours} />
        </div>
        {/* (During a move replay, a tap on the board skips it; the tap goes on to the board under it, so a move can start with it.) */}
        {/* (data-arrived: the board's move count when it came on screen, which decides a replay; tests read it.) */}
        <div class="board-row" data-arrived={replay.arrivedAt} onPointerDownCapture={replay.frame ? replay.skip : undefined}>
          <Board fen={fen} orientation={orientation} lastMove={lastMove} interactive={choosing && !blocking} moves={allowed} onMove={(mv) => client.choose(m.key, mv)} arrows={boardArrows}>
            {replay.frame && <ReplayLayer client={client} m={m} frame={replay.frame} orientation={orientation} />}
            {(choosing || canBlock) && myDeadline && m.current && <TimerBar startsAt={m.current.startedAt} deadline={myDeadline} total={Math.max(1, myDeadline - m.current.startedAt)} quiet />}
            {revealing && reveal && <Reveal client={client} e={reveal} fen={before} orientation={orientation} at={m.last!.at} until={m.last!.until} />}
            {!replay.frame && <BlockArrows blocks={shownBlocks} since={m.blockAt} orientation={orientation} />}
            {tags.length > 0 && !blocking && !replay.frame && <PickTags picks={tags} orientation={orientation} />}
            {blocking && mySide !== null && (
              <BlockPicker
                fen={b.fen}
                them={colourOf(b, mySide) === "w" ? "b" : "w"}
                bank={bank}
                taken={blocksShown(m, boardId).map((x) => x.move)}
                orientation={orientation}
                onBlock={(mv) => client.block(m.key, boardId, mv)}
              />
            )}

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
                <div class="sq-banner-rules">{rulesLine(m)}</div>
                {client.lobby?.rules && <div class="sq-banner-rules sq-banner-clock">{matchClockLine(client.lobby.rules.clock)}</div>}
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
        <HistoryNav view={history} total={b.moves.length} clock={<ClockLine client={client} m={m} board={boardId} />} />
        {/* Relay (Nov 5, round 2): under the board only the move arrows and the turn order; whose turn it is shows there.
            (A computer: in the column beside the board, at its top.) */}
        {m.format === "relay" && !computer && <Island id="sq-turn-order">{turnBox}</Island>}
      </div>
      <div class="sq-panel">
        {m.format === "relay" && computer && <Island id="sq-turn-order">{turnBox}</Island>}
        {cheatFen !== null && !(m.format === "relay" && !computer) && <CheatLines on={client.cheatLines} top={cheat} fen={cheatFen} onToggle={() => client.toggleCheatLines()} />}
        {m.mode === "mercenary" && d && m.state === "half" && d.duty.board === boardId && (
          <StockfishToken
            left={mySide === null ? 0 : stockfishLeft(m, mySide)}
            can={canUseStockfish(m, me)}
            shown={assist}
            byMe={assist?.by === me}
            byName={assist ? client.nameOf(assist.by) : ""}
            lines={token}
            fen={b.fen}
            onUse={() => client.useStockfish(m.key)}
          />
        )}
        {/* (Relay has no duty panel since Nov 5, but a Mercenary Relay still blocks: its Block button on its own.) */}
        {d && m.state === "half" && m.format === "relay" && canBlock && (
          <div class="sq-duty move sq-relay-block">
            <BlockBar client={client} m={m} block={{ on: blocking, bank, toggle: () => setBlockMode(!blocking), shields: mySide === null ? 0 : (m.shields?.[mySide === 0 ? 1 : 0] ?? 0) }} />
          </div>
        )}
        {d && m.state === "half" && m.format !== "relay" && (
          <DutyPanel
            client={client}
            m={m}
            role={d.duty.role}
            partner={partner}
            team={d.team}
            mine={mineChoice}
            partnerChoice={partnerChoice}
            locked={myLocked}
            fen={b.fen}
            block={canBlock ? { on: blocking, bank, toggle: () => setBlockMode(!blocking), shields: mySide === null ? 0 : (m.shields?.[mySide === 0 ? 1 : 0] ?? 0) } : null}
            noTokens={noTokens}
          />
        )}
        {m.format === "pairs" && m.tokenLog.length > 0 && (m.state === "over" || !!m.result) && <TokenBreakdown log={m.tokenLog} sides={m.sides} mine={mySide} />}
        {m.mode === "mercenary" && <KitLine client={client} m={m} mine={mySide} />}
        {!d && m.format !== "relay" && <p class="sq-explain">{rulesLine(m)}</p>}
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
          <p class={`sq-note${client.note.kind === "news" ? " news" : ""}`} role="alert">
            {client.note.text}
          </p>
        )}
        {panel}
      </div>
    </div>
  );
}

/** "Jump to my next board", as this device has it (redrawn when it's switched). */
function useJumpNext(): boolean {
  const [on, setOn] = useState(squadsJumpNext);
  useEffect(() => onPrefsChange(() => setOn(squadsJumpNext())), []);
  return on;
}

/**
 * Quick board jump (Relay; Eric, Oct 14 as "Jump to my next board"; Nov 5, round 2: in the Squads settings, the gear's
 * list, not under the board): on or off, the same choice as before (`brc.squads.jumpNext`), and Settings → Squads.
 */
function QuickJumpRow() {
  const on = useJumpNext();
  return <SwitchRow icon="⤳" label={JUMP_NEXT_LABEL} on={on} onClick={() => setSquadsJumpNext(!on)} />;
}

/** A test switch for the stills: `?coachat=N` starts the coach marks at the Nth (from 1). */
function coachStart(): number {
  const n = Number(testParams().get("coachat"));
  return Number.isInteger(n) && n >= 1 && n <= 3 ? n - 1 : 0;
}

/**
 * A part of the screen that is never rebuilt (Eric, Nov 5: the turn order "is never rebuilt or redrawn"): the match view
 * is drawn afresh for each board (its board, moves and replay are the board's), but this part's element is made once and
 * moved into each new view's slot before the screen is painted, its contents updated in place. So tapping another tiny
 * board, or a move landing, changes only what's in it: the same element, the same size, the same rows. Gone (emptied)
 * once no view holds it.
 */
const islands = new Map<string, HTMLElement>();
function Island({ id, children }: { id: string; children: ComponentChildren }) {
  const slot = useRef<HTMLDivElement>(null);
  let el = islands.get(id);
  if (!el && typeof document !== "undefined") {
    el = document.createElement("div");
    el.className = "sq-island";
    islands.set(id, el);
  }
  useLayoutEffect(() => {
    if (el && slot.current && el.parentNode !== slot.current) slot.current.appendChild(el);
    return () => {
      // (Another view takes it in the same commit; only if none has, it's emptied.)
      setTimeout(() => {
        if (el && !el.isConnected && islands.get(id) === el) {
          render(null, el);
          islands.delete(id);
        }
      }, 0);
    };
  }, []);
  useLayoutEffect(() => {
    if (el) render(<>{children}</>, el);
  });
  return <div class="sq-island-slot" ref={slot} />;
}

/**
 * Rows that glide to their new places (FLIP, about 220 ms) when their order changes, as the scoreboards do: each row
 * (`data-id`) kept by player, so its element is reused; where it was is measured before and after, and it slides from
 * there. Nothing else moves.
 */
function useGlide(list: { current: HTMLElement | null }, order: string) {
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const root = list.current;
    if (!root) return;
    const rows = [...root.querySelectorAll<HTMLElement>("[data-id]")];
    for (const row of rows) {
      const id = row.dataset.id!;
      const was = tops.current.get(id);
      const now = row.offsetTop;
      if (was !== undefined && was !== now && typeof row.animate === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        row.animate([{ transform: `translateY(${was - now}px)` }, { transform: "translateY(0)" }], { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
      }
    }
    tops.current = new Map(rows.map((r) => [r.dataset.id!, r.offsetTop]));
  }, [order]);
}

/**
 * The turn order (Relay; Eric, Nov 5: "you know when you look down right away, being like, oh, I've got 2 turns left";
 * his correction: one queue for the board on screen): all 8 players in the order they'll move on this board, the next
 * there on top (lit while it's their move now), each with their squad's color and, on the right, the move they last
 * played (a tap shows that position). Your row is bold "You"; on top it says "Your turn · play now" (Eric: nothing
 * lower down, the order says it). A phone shows 4 rows (with you further down, the top 3 and yours) and a tap opens all 8 over the board,
 * so nothing below moves; a computer all 8. One size per state on every board.
 */
function TurnOrderBox({ client, m, board, computer, onRow, shownPly }: { client: SquadsClient; m: LocalMatch; board: number; computer: boolean; onRow: ((board: number, ply: number) => void) | null; shownPly: number | null }) {
  const [open, setOpen] = useState(false);
  const queue = boardQueue(m, board, client.myId);
  const line = queueLine(queue);
  const place = queuePlace(queue);
  const waiting = place ? `Waiting for ${place} ${place === 1 ? "player" : "players"}` : null;
  const key = m.boards.map((b) => b.moves.length).join();
  const sans = useMemo(() => {
    const out = new Map<string, string>();
    for (const r of queue) {
      if (!r.last) continue;
      const b = m.boards[r.last.board]!;
      out.set(r.id, safeSan(fenAtPly(b.moves, r.last.ply, [{ ply: 0, fen: b.startFen }]), b.moves[r.last.ply]!));
    }
    return out;
  }, [key, board]);
  const all = computer || open;
  const rows = all ? queue : foldedRows(queue);
  const listRef = useRef<HTMLDivElement>(null);
  useGlide(listRef, rows.map((r) => r.id).join());
  // (Whole names, cut with an ellipsis by the row's width, never wrapped: the move's column keeps its place.)
  const nameOf = (r: TurnRow) => (r.you ? "You" : client.nameOf(r.id));
  const list = (
    <div class={`sq-to-list${all ? " all" : ""}`} ref={listRef} role="list" aria-label={`Turn order on board ${board + 1}`}>
      {rows.map((r, i) => {
        const shown = !!r.last && shownPly !== null && r.last.board === board && r.last.ply + 1 === shownPly;
        const gap = !all && i === 3 && queue.indexOf(r) > 3;
        return (
          <button
            key={r.id}
            type="button"
            role="listitem"
            class={`sq-to-row${i === 0 ? " top" : ""}${r.lit ? " lit" : ""}${r.you ? " you" : ""}${shown ? " shown" : ""}${gap ? " skip" : ""}`}
            data-place={queue.indexOf(r)}
            data-id={r.id}
            style={{ "--sq": squadColour(m.sides[r.side].squadId) }}
            disabled={!r.last || !onRow}
            onClick={() => r.last && onRow?.(r.last.board, r.last.ply + 1)}
            aria-label={`${nameOf(r)}${r.you && (line ?? waiting) ? `, ${line ?? waiting}` : ""}${r.last ? `, last played ${sans.get(r.id)} on board ${r.last.board + 1}` : ""}`}
          >
            <span class="sq-to-mark" aria-hidden="true" />
            <span class="sq-to-name">{nameOf(r)}</span>
            {/* (Only on top, Eric: "Your turn · play now"; lower down the queue's order says it. The move's column keeps its place.) */}
            <span class="sq-to-where">{r.you && line ? line : ""}</span>
            <span class="sq-to-move">{r.last ? sans.get(r.id) : ""}</span>
          </button>
        );
      })}
    </div>
  );
  return (
    <div class={`sq-to${computer ? " computer" : ""}${open ? " open" : ""}`} role="group" aria-label="Turn order">
      {list}
      {!computer && (
        <button type="button" class="sq-to-more" aria-expanded={open} aria-label={open ? "Show the next 4" : "Show all 8"} onClick={() => setOpen(!open)}>
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d={open ? "M2.5 7.5L6 4l3.5 3.5" : "M2.5 4.5L6 8l3.5-3.5"} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>{open ? "4" : "8"}</span>
        </button>
      )}
    </div>
  );
}

/**
 * Blocks (Mercenary): the blocks placed on your board this half, the Block button (Done blocking; "No block points left")
 * and a shield's note. In a duty's panel; in Relay (whose panel is gone, Nov 5) on its own beside the board.
 */
function BlockBar({ client, m, block }: { client: SquadsClient; m: LocalMatch; block: { on: boolean; bank: number; toggle: () => void; shields: number } | null }) {
  const blockButton = block && (
    <button type="button" class={`fd-btn sq-block-btn${block.on ? " on" : ""}`} aria-pressed={block.on} disabled={block.bank <= 0 && !block.on} onClick={block.toggle}>
      <LockIcon size={16} />
      {block.on ? "Done blocking" : block.bank > 0 ? `Block · ${block.bank} ${block.bank === 1 ? "point" : "points"}` : "No block points left"}
    </button>
  );
  // (Mercenary: their shield cancels your next block that would take effect; you still pay for it.)
  const shieldLine = block && block.shields > 0 && (
    <span class="mc-shield-note">
      <ItemIcon item="shield" size={12} />
      They have {block.shields === 1 ? "a shield" : `${block.shields} shields`}: your next block {block.shields === 1 ? "is" : "blocks are"} canceled, still paid
    </span>
  );
  const placed = m.placed.filter((b) => b.board === m.current?.duties.find((d) => d.players.includes(client.myId ?? ""))?.board);
  const placedLine = placed.length > 0 && (
    <span class="sq-placed">
      <LockIcon size={12} />
      Blocked: {placed.map((b) => blockName(b)).join(", ")}
    </span>
  );
  return (
    <>
      {placedLine}
      {blockButton}
      {shieldLine}
    </>
  );
}

/** Engine lines already worked out, by position and how many (a screen change doesn't search again). */
const linesSeen = new Map<string, MoveScore[]>();

/**
 * The engine's top `n` moves in `fen` at `nodes` (null: none asked, or still searching), on this device's own engine
 * (never queued behind the lobby's bot work): Cheat lines, and a Stockfish token's lines.
 */
function useEngineLines(fen: string | null, n: number, nodes: number): MoveScore[] | null {
  const [found, setFound] = useState<{ key: string; top: MoveScore[] } | null>(null);
  const key = fen ? `${fen}|${n}|${nodes}` : null;
  useEffect(() => {
    if (!fen || !key || linesSeen.has(key)) return;
    let live = true;
    void ownEngine()
      .then((engine) => engine.topMovesAt(fen, n, nodes))
      .then((top) => {
        if (linesSeen.size > 200) linesSeen.clear();
        linesSeen.set(key, top);
        if (live) setFound({ key, top });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key]);
  if (!key) return null;
  return linesSeen.get(key) ?? (found?.key === key ? found.top : null);
}

/** Cheat lines (test controls only): the engine's top moves in the position, at the test controls' search. */
const useCheatLines = (fen: string | null) => useEngineLines(fen, SQUADS_LOBBY.cheatLines.moves, SQUADS_LOBBY.cheatLines.nodes);

/**
 * Mercenary's Stockfish token on your decision: the button (with your squad's tokens left), and once it's used your top
 * moves listed under it as on the board (rank, move, evaluation). Yours only: in the final your whole squad's.
 */
function StockfishToken({
  left,
  can,
  shown,
  byMe,
  byName,
  lines,
  fen,
  onUse,
}: {
  left: number;
  can: boolean;
  shown: { by: string } | null;
  byMe: boolean;
  byName: string;
  lines: readonly MoveScore[] | null;
  fen: string;
  onUse: () => void;
}) {
  if (!shown && left <= 0) return null;
  return (
    <div class="sq-cheat mc-stockfish">
      {!shown ? (
        <button type="button" class="fd-btn mc-stockfish-btn" disabled={!can} onClick={onUse}>
          <ItemIcon item="stockfish" size={16} />
          Stockfish token · {left} left
        </button>
      ) : (
        <span class="mc-stockfish-on">
          <ItemIcon item="stockfish" size={14} />
          {byMe ? "Your Stockfish lines" : `${byName}'s Stockfish token: your squad's lines`}
        </span>
      )}
      {shown &&
        (lines === null ? (
          <span class="muted small">Asking the engine…</span>
        ) : lines.length ? (
          <ol class="hints sq-cheat-lines">
            {lines.slice(0, CHEAT_BRUSHES.length).map((t, i) => (
              <li key={t.move} class={`hint-${CHEAT_BRUSHES[i]}`}>
                <strong>
                  {i + 1} · {safeSan(fen, t.move)}
                </strong>
                <span>{cheatEval(t)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <span class="muted small">No moves here.</span>
        ))}
    </div>
  );
}

/**
 * Mercenary: both squads' coins and what they brought to this match that's still to use (Stockfish tokens and shields
 * left), always on screen for both (counterplay).
 */
function KitLine({ client, m, mine }: { client: SquadsClient; m: LocalMatch; mine: Side | null }) {
  const order: Side[] = mine === 1 ? [1, 0] : [0, 1];
  return (
    <div class="mc-kitline" aria-label="Coins and items">
      {order.map((side) => {
        const w = walletOf(client.wallets, m.sides[side].squadId);
        const left = { stockfish: Math.max(0, stockfishLeft(m, side)), blocks: 0, shield: m.shields?.[side] ?? 0, chip: chipsLeft(m, side) };
        return (
          <span key={side} class={`mc-kitline-side${side === mine ? " you" : ""}`}>
            <SquadTag id={m.sides[side].squadId} you={side === mine} />
            {w && <Coins n={w.coins} />}
            <KitIcons counts={left} />
          </span>
        );
      })}
    </div>
  );
}

/** "Cheat lines" (test controls only): the switch, and while it's on the engine's top moves listed (rank, move, eval). */
function CheatLines({ on, top, fen, onToggle }: { on: boolean; top: MoveScore[] | null; fen: string; onToggle: () => void }) {
  return (
    <div class="sq-cheat">
      <button type="button" class={`sq-cheat-btn${on ? " on" : ""}`} aria-pressed={on} onClick={onToggle}>
        Cheat lines
      </button>
      {on &&
        (top === null ? (
          <span class="muted small">Asking the engine…</span>
        ) : top.length ? (
          <ol class="hints sq-cheat-lines">
            {top.slice(0, CHEAT_BRUSHES.length).map((t, i) => (
              <li key={t.move} class={`hint-${CHEAT_BRUSHES[i]}`}>
                <strong>
                  {i + 1} · {safeSan(fen, t.move)}
                </strong>
                <span>{cheatEval(t)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <span class="muted small">No moves here.</span>
        ))}
    </div>
  );
}

function safeSan(fen: string, move: string): string {
  try {
    return toSan(fen, move);
  } catch {
    return move;
  }
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
  studying: boolean,
  d: ReturnType<typeof dutyOf>,
  scout: ReturnType<typeof scouting>,
  revealing: boolean,
  blocking: boolean,
): string {
  const b = m.boards[boardId]!;
  const where = m.boards.length > 1 ? `Board ${boardId + 1}` : "The board";
  if (b.result) return `${where} is over: ${b.result.winner === null ? "a draw" : `${sideWord(b.result.winner)} won`}`;
  if (watching) return studying ? `Watching ${where} · your next board` : `Watching ${where} · ${squadName(m.sides[0].squadId)} v ${squadName(m.sides[1].squadId)}`;
  if (m.state === "break") return m.boards.length > 1 ? `${where} · starting soon` : "Starting soon";
  if (m.state === "armageddon") return "Armageddon: choosing colors";
  if (m.state === "over") return "The match is over";
  if (revealing) return m.format === "pairs" ? "The coin decides which pick plays" : "The votes are in";
  if (m.state === "show") return "Moves landing…";
  if (blocking) return "Block: tap one of their pieces, then where it would go";
  const side = sideIn(m, client.myId);
  if (d) {
    const colour = sideWord(colourOf(b, d.duty.side));
    const partner = d.partner ? (client.isBot(d.partner) ? `${client.nameOf(d.partner)} (bot)` : client.nameOf(d.partner)) : "";
    if (d.duty.role === "move") return m.visible[client.myId!] ? `Moved · ${where} · waiting for the half to end` : `Your move · ${where} · you're ${colour}`;
    if (m.format === "final") return `Vote with your squad · you're ${colour}`;
    return `Pick with ${partner} · you're ${colour}`;
  }
  if (scout) return `${where} has finished · you're scouting this turn`;
  if (onMine && side !== null) {
    const toMove = m.current ? (m.current.duties.find((x) => x.board === boardId)?.side ?? null) : null;
    if (m.format === "final") return toMove === side ? "Your squad is voting" : "They're voting";
    return toMove === side ? "Your squad's move here" : "Their move here";
  }
  return `${where} · ${squadName(m.sides[0].squadId)} v ${squadName(m.sides[1].squadId)}`;
}

/**
 * Your move or pick: who chose what, lock in, and Block (with your squad's points left). Pairs: your partner's pick
 * (the same move plays for sure and uses a token; none left, picks must differ). The final: each teammate's pick, with
 * Copy.
 */
function DutyPanel({
  client,
  m,
  role,
  partner,
  team,
  mine,
  partnerChoice,
  locked,
  fen,
  block,
  noTokens,
}: {
  client: SquadsClient;
  m: LocalMatch;
  role: "move" | "pick";
  partner: string | null;
  team: string[];
  mine: string | null;
  partnerChoice: string | null;
  locked: boolean;
  fen: string;
  block: { on: boolean; bank: number; toggle: () => void; shields: number } | null;
  noTokens: boolean;
}) {
  const san = (mv: string) => safeSan(fen, mv);
  const blockBar = <BlockBar client={client} m={m} block={block} />;
  if (role === "move") {
    return (
      <div class="sq-duty move">
        <strong>{mine ? `You played ${san(mine)}` : "Your move"}</strong>
        <span class="muted small">{mine ? "Tap a tiny board to watch it." : freeLine(m, client.myId)}</span>
        {blockBar}
      </div>
    );
  }
  const name = (id: string) => client.nameOf(id);
  if (m.format === "final") {
    return (
      <div class="sq-duty pick vote">
        <div class="sq-choices">
          <span class={`sq-choice you${mine ? "" : " none"}`}>
            <i aria-hidden="true" />
            You: <strong>{mine ? san(mine) : "tap a move"}</strong>
            {locked && <em title="Locked in"> ✓</em>}
          </span>
          {team.map((id) => {
            const pick = m.visible[id] ?? null;
            return (
              <span key={id} class={`sq-choice partner${pick ? "" : " none"}`}>
                <i aria-hidden="true" />
                {name(id)}: <strong>{pick ? san(pick) : "thinking…"}</strong>
                {m.locked.includes(id) && <em title="Locked in"> ✓</em>}
                {pick && pick !== mine && !locked && (
                  <button type="button" class="sq-copy" onClick={() => client.choose(m.key, pick)} aria-label={`Copy ${name(id)}'s ${san(pick)}`}>
                    Copy
                  </button>
                )}
              </span>
            );
          })}
        </div>
        <button type="button" class="fd-btn primary sq-lockin" disabled={!mine || locked} onClick={() => client.lock(m.key)}>
          {locked ? "Locked in" : "Lock in my vote"}
        </button>
        {blockBar}
        <span class="muted small">The most picked move plays; a tie, a coin. You can change until you lock in.</span>
      </div>
    );
  }
  const partnerLocked = !!partner && m.locked.includes(partner);
  const same = !!mine && mine === partnerChoice;
  return (
    <div class="sq-duty pick">
      <div class="sq-choices">
        <span class={`sq-choice you${mine ? "" : " none"}`}>
          <i aria-hidden="true" />
          You: <strong>{mine ? san(mine) : "tap a pick"}</strong>
          {locked && <em title="Locked in"> ✓</em>}
        </span>
        {partner && (
          <span class={`sq-choice partner${partnerChoice ? "" : " none"}`}>
            <i aria-hidden="true" />
            {name(partner)}: <strong>{partnerChoice ? san(partnerChoice) : "thinking…"}</strong>
            {partnerLocked && <em title="Locked in"> ✓</em>}
          </span>
        )}
      </div>
      <button type="button" class="fd-btn primary sq-lockin" disabled={!mine || locked} onClick={() => client.lock(m.key)}>
        {locked ? "Locked in" : "Lock in my pick"}
      </button>
      {same && <span class="sq-same">Same move: it plays for sure, and uses a token.</span>}
      {noTokens && <span class="sq-same none">No same-move tokens left: pick a different move.</span>}
      {blockBar}
      <span class="muted small">{noTokens ? "You can change until you lock in." : "Pick your partner's move too and it plays for sure (a token). You can change until you lock in."}</span>
    </div>
  );
}

/**
 * A block banner shows this long over the board (ms; 3.6 s: every banner a second longer, Eric, Oct 15; and the
 * banners' extra, bannerPlusMs, Oct 24). Only what's drawn: the game never waits for it.
 */
const bannerMs = () => 3600 + bannerPlusMs();
/** How long "+30 s" shows on a squad's clock after a Time chip (both squads). */
const CHIP_FLASH_MS = 1800;

export { bankText };
