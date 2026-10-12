import {
  pairSchedule,
  relayBoardOf,
  type Colour,
  type SquadsBlock,
  type TokenUse,
  type NetBracketMatch,
  type NetDuty,
  type NetSquad,
  type NetSquadsBoard,
  type NetSquadsLobby,
  type NetSquadsMatch,
  type NetTeamClock,
  type Side,
  type SquadsEvent,
  type SquadsPlacement,
} from "@chessroyale/chess/squads";
import { toSan, type MoveScore } from "@chessroyale/chess";
import type { Arrow } from "./board/types.ts";

/**
 * What Squads' screens work out from the lobby as the server sends it (docs/areas/squads.md, "The screens"): pure, so
 * it's tested on its own (packages/app/test/squads-view.test.ts). Times here are local (the client converts the
 * server's on arrival).
 */

/** A board with its moves in this match (the client keeps them from the "match" message and each "half"). */
export type LocalBoard = NetSquadsBoard & { moves: string[] };

/** A match as the client keeps it: its boards' moves, the live choices it may see, and the last half played. */
export interface LocalMatch extends Omit<NetSquadsMatch, "boards"> {
  boards: LocalBoard[];
  /** Live choices this player may see this half (their squad's; the final's blocks for everyone). */
  visible: Record<string, string>;
  /** Who has locked in this half, and when this device first saw each (the team clocks run from it). */
  locked: string[];
  lockedAt: Record<string, number>;
  /** When each visible choice last changed (local). */
  choiceAt: Record<string, number>;
  /** Blocks placed this half (everyone sees them at once), and when each block on screen was first seen (its arrow's beat). */
  placed: SquadsBlock[];
  blockAt: Record<string, number>;
  /** The last half played: its events, every board's position before it, when it arrived and when its show ends. */
  last: { seq: number; events: SquadsEvent[]; before: string[]; at: number; until: number; missed: string[] } | null;
}

/**
 * The eight squads' names and colours, by squad id (display only: the rules number them). One short word each, so a
 * name fits beside its clock in the phone's strip at 360 px.
 */
export const SQUAD_NAMES = ["Rooks", "Knights", "Bishops", "Queens", "Kings", "Pawns", "Towers", "Crowns"] as const;
export const SQUAD_COLOURS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#14b8a6", "#f97316", "#ec4899"] as const;
export const squadName = (id: number | null | undefined) => (id == null ? "?" : (SQUAD_NAMES[id % SQUAD_NAMES.length] ?? `Squad ${id + 1}`));
export const squadColour = (id: number | null | undefined) => (id == null ? "#888" : (SQUAD_COLOURS[id % SQUAD_COLOURS.length] ?? "#888"));

export const FORMAT_NAME = { relay: "Relay", pairs: "Pairs", final: "Team vote" } as const;
export const ROUND_NAME = ["Round 1", "Round 2", "Final"] as const;

export function placementText(p: SquadsPlacement): string {
  return p === 1 ? "1st" : p === 2 ? "2nd" : p === 3 ? "3rd–4th" : "5th–8th";
}

/** A score: "2½", "½", "0". */
export function points(x: number): string {
  const whole = Math.floor(x);
  const half = x - whole >= 0.5;
  return half ? (whole ? `${whole}½` : "½") : String(whole);
}

/** "3:05" (m:ss); under ten seconds "9.4". */
export function bankText(ms: number): string {
  const v = Math.max(0, ms);
  if (v < 10_000) return (Math.floor(v / 100) / 10).toFixed(1);
  const s = Math.floor(v / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function squadOf(lobby: NetSquadsLobby | null, playerId: string | null): NetSquad | null {
  if (!lobby || !playerId) return null;
  return lobby.squads.find((sq) => sq.seats.includes(playerId)) ?? null;
}

/** The side of a match a player is on (null: not in it). */
export function sideIn(m: Pick<NetSquadsMatch, "sides">, playerId: string | null): Side | null {
  if (!playerId) return null;
  const i = m.sides.findIndex((s) => s.seats.includes(playerId));
  return i < 0 ? null : (i as Side);
}

/** A squad's seat (0-3) in a match (the rules' "player 1" is seat 0). */
export function seatIn(m: Pick<NetSquadsMatch, "sides">, playerId: string | null): number {
  const side = sideIn(m, playerId);
  return side === null ? -1 : m.sides[side].seats.indexOf(playerId!);
}

/** The board's colour a side plays. */
export const colourOf = (b: Pick<NetSquadsBoard, "white">, side: Side): Colour => (b.white === side ? "w" : "b");

/**
 * Your board this turn and next (Relay: one board along each turn; Pairs: your pair's slot; the final: its one board).
 * Null when you're not in the match. `next` is null in the final.
 */
export function myBoards(m: Pick<NetSquadsMatch, "format" | "sides" | "turn" | "boards">, playerId: string | null): { you: number; next: number | null } | null {
  const seat = seatIn(m, playerId);
  if (seat < 0) return null;
  const n = m.boards.length;
  if (m.format === "relay" && n > 1) return { you: relayBoardOf(seat, m.turn, n), next: relayBoardOf(seat, m.turn + 1, n) };
  if (m.format === "pairs" && n > 1) {
    const slot = (turn: number) => (pairSchedule(turn)[0].includes(seat) ? 0 : 1);
    return { you: slot(m.turn), next: slot(m.turn + 1) };
  }
  return { you: 0, next: null };
}

/** Your duty in the half being played, your partner (Pairs) if any, and the rest of your squad on it (the final's vote). */
export function dutyOf(m: Pick<NetSquadsMatch, "state" | "current">, playerId: string | null): { duty: NetDuty; partner: string | null; team: string[] } | null {
  if (!playerId || m.state !== "half" || !m.current) return null;
  for (const duty of m.current.duties) {
    if (!duty.players.includes(playerId)) continue;
    const team = duty.players.filter((p) => p !== playerId);
    return { duty, partner: duty.players.length === 2 ? team[0]! : null, team };
  }
  return null;
}

/** Whether you're scouting this half (whoever's turn it would be on a finished board). */
export function scouting(m: Pick<NetSquadsMatch, "state" | "current">, playerId: string | null): NetDuty | null {
  if (!playerId || m.state !== "half" || !m.current) return null;
  return m.current.scouts.find((d) => d.players.includes(playerId)) ?? null;
}

/**
 * A side's team bank now (ms), as the screen runs it during a half: from the bank as the half began, each of the
 * side's moves still being thought about (a duty whose players haven't all locked in) drains it past the free seconds;
 * a move locked in stopped draining when it was. The exact bank comes with the half's result.
 */
export function liveBank(m: Pick<LocalMatch, "state" | "current" | "banks" | "delayMs" | "locked" | "lockedAt">, side: Side, now: number): number {
  const start = m.banks[side];
  if (m.state !== "half" || !m.current || start <= 0) return Math.max(0, start);
  const t0 = m.current.startedAt;
  const t = now - t0;
  let drained = 0;
  for (const d of m.current.duties) {
    if (d.side !== side) continue;
    const done = d.players.every((p) => m.locked.includes(p));
    const end = done ? Math.max(...d.players.map((p) => (m.lockedAt[p] ?? now) - t0)) : Math.min(t, d.deadline - t0);
    drained += Math.max(0, Math.min(end, t) - m.delayMs);
  }
  return Math.max(0, start - drained);
}

/** How many of a side's moves are draining its bank right now (2: Relay's two movers, twice as fast). */
export function drainRate(m: Pick<LocalMatch, "state" | "current" | "banks" | "delayMs" | "locked">, side: Side, now: number): number {
  if (m.state !== "half" || !m.current || m.banks[side] <= 0) return 0;
  if (now - m.current.startedAt <= m.delayMs) return 0;
  return m.current.duties.filter((d) => d.side === side && !d.players.every((p) => m.locked.includes(p)) && now < d.deadline).length;
}

/** A squad's team clock for the screen: its bank now, sudden death, and whether it's running (draining). */
export interface SquadClock {
  squadId: number;
  bankMs: number;
  suddenDeath: boolean;
  /** Moves draining it now (0: still, 1, 2: twice as fast). */
  rate: number;
  /** The match it's playing, if any. */
  key: string | null;
}

/** Every squad's clock, now: a squad in a live match from the match (run down during a half), else the lobby's. */
export function squadClocks(clocks: readonly NetTeamClock[], matches: Iterable<LocalMatch>, now: number): SquadClock[] {
  const live = new Map<number, SquadClock>();
  for (const m of matches) {
    if (m.state === "over" || m.armageddon) continue;
    for (const side of [0, 1] as const) {
      const bankMs = liveBank(m, side, now);
      live.set(m.sides[side].squadId, { squadId: m.sides[side].squadId, bankMs, suddenDeath: bankMs <= 0, rate: drainRate(m, side, now), key: m.key });
    }
  }
  return clocks.map((c) => live.get(c.squadId) ?? { squadId: c.squadId, bankMs: c.bankMs, suddenDeath: c.suddenDeath, rate: 0, key: null });
}

/** The bracket match a squad is in now (playing, about to, or waiting for its opponent), else its last one. */
export function squadMatch(bracket: readonly NetBracketMatch[], squadId: number): NetBracketMatch | null {
  const mine = bracket.filter((b) => b.squads.includes(squadId));
  return mine.find((b) => b.state !== "over") ?? mine[mine.length - 1] ?? null;
}

/** Where a squad stands, in a few words: "Round 1 · v Knights", "Out · 5th–8th", "Champions", "Final · v Kings". */
export function standingLine(lobby: NetSquadsLobby, squadId: number): string {
  const sq = lobby.squads.find((s) => s.id === squadId);
  if (sq?.placement === 1) return "Champions";
  if (sq?.placement) return `Out · ${placementText(sq.placement)}`;
  const bm = squadMatch(lobby.bracket, squadId);
  if (!bm) return lobby.phase === "bracket" ? "In the bracket" : "Waiting";
  const other = bm.squads[0] === squadId ? bm.squads[1] : bm.squads[0];
  const round = ROUND_NAME[bm.round];
  if (bm.state === "over") return bm.winner === squadId ? `Through · won ${round}` : `Out in ${round}`;
  if (other === null) return `${round} · waiting`;
  return `${round} · v ${squadName(other)}`;
}

/**
 * Squads ordered for the standings: by how far each got (the champions; the final; round 2; round 1), a squad still
 * playing above one knocked out at the same stage, then by id.
 */
export function standingsOrder(lobby: NetSquadsLobby): number[] {
  const LEVEL: Record<SquadsPlacement, number> = { 1: 4, 2: 3, 3: 2, 5: 1 };
  const key = (id: number) => {
    const sq = lobby.squads.find((s) => s.id === id);
    if (sq?.placement) return LEVEL[sq.placement] * 2;
    return Math.max(0, ...lobby.bracket.filter((b) => b.squads.includes(id)).map((b) => b.round + 1)) * 2 + 1;
  };
  return lobby.squads.map((s) => s.id).sort((a, b) => key(b) - key(a) || a - b);
}

/**
 * The matches whose boards show as tiny boards: every match still going, and the latest round's finished ones (greyed).
 */
export function shownMatches(matches: readonly LocalMatch[]): LocalMatch[] {
  const latest = Math.max(-1, ...matches.map((m) => m.round));
  return matches.filter((m) => m.state !== "over" || m.round === latest).sort((a, b) => a.round - b.round || a.index - b.index);
}

/** The moves a half added to board `i`, from its events (a forced move, a Relay move, a pair's or the final's move). */
export function movesOfHalf(events: readonly SquadsEvent[], i: number): string[] {
  return events.flatMap((e) => ((e.kind === "relay" || e.kind === "pair" || e.kind === "vote" || e.kind === "forced") && e.board === i ? [e.move] : []));
}

// ---------------- Squads v2: blocks and tokens ----------------

/** A side's block bank now: the match's, less the blocks it has placed this half (paid at once). */
export function blockBankNow(m: Pick<LocalMatch, "blockBanks" | "placed">, side: Side): number {
  return m.blockBanks[side] - m.placed.filter((b) => b.side === side).reduce((t, b) => t + b.cost, 0);
}

/** The blocks on a board now: those in effect this half, and those placed this half (for the other side's next turn). */
export function blocksShown(m: Pick<LocalMatch, "blocks" | "placed">, board: number): SquadsBlock[] {
  return [...m.blocks, ...m.placed].filter((b) => b.board === board);
}

const PIECE_LETTER = { p: "", n: "N", b: "B", r: "R", q: "Q", k: "K" } as const;

/** A blocked move in a few characters: "Ng8–f6", "e7–e5", castling "O-O" or "O-O-O". */
export function blockName(b: Pick<SquadsBlock, "move" | "piece">): string {
  if (b.piece === "k") return b.move[2] === "g" ? "O-O" : "O-O-O";
  return `${PIECE_LETTER[b.piece]}${b.move.slice(0, 2)}–${b.move.slice(2, 4)}`;
}

/**
 * The position whose engine lines help choose a block (Cheat lines while blocking): the other squad's moves after your
 * squad's (your own pick or move if you've made one, else your partner's or a teammate's), or with nobody's yet, the
 * position with the move handed over (a "null move": their threats as things stand). Null if that can't be made (in
 * check: handing over the move would leave your king in check).
 */
export function blockCheatFen(fen: string, ownMove: string | null, apply: (fen: string, move: string) => string, inCheck: (fen: string) => boolean): string | null {
  if (ownMove) {
    try {
      return apply(fen, ownMove);
    } catch {
      return null;
    }
  }
  if (inCheck(fen)) return null;
  const parts = fen.split(" ");
  parts[1] = parts[1] === "w" ? "b" : "w";
  parts[3] = "-";
  return parts.join(" ");
}

/** A same-move token's move in the breakdown (its SAN in the position it was played in). */
const sanOf = (fen: string, move: string) => {
  try {
    return toSan(fen, move);
  } catch {
    return move;
  }
};

/**
 * A token use in the post-match breakdown, in plain words with numbers: "Rxd4: refunded, every other move lost at
 * least 2.1 pawns"; "e5: not refunded, Nf3 was within 0.3"; "e5: waiting for the judge".
 */
export function tokenWords(u: Pick<TokenUse, "fen" | "move" | "verdict">): string {
  const move = sanOf(u.fen, u.move);
  const v = u.verdict;
  if (!v) return `${move}: waiting for the judge`;
  const rival = v.rival ? sanOf(u.fen, v.rival) : null;
  const pawns = (x: number | undefined) => `${(x ?? 0).toFixed(1)} ${x === 1 ? "pawn" : "pawns"}`;
  switch (v.why) {
    case "only_move":
      return `${move}: refunded, every other move lost at least ${pawns(v.pawns)}`;
    case "close":
      return v.mate ? `${move}: not refunded, ${rival} mates too` : v.pawns ? `${move}: not refunded, ${rival} was within ${(v.pawns ?? 0).toFixed(1)}` : `${move}: not refunded, ${rival} was just as good`;
    case "better":
      return `${move}: not refunded, ${rival} was better by ${v.atLeast ? "at least " : ""}${pawns(v.pawns)}`;
    case "unranked":
      return `${move}: not refunded, the judge couldn't rank the other moves`;
    case "no_judge":
      return `${move}: not refunded, no device could judge it`;
  }
}

/** The match on screen for a player: their squad's live one, else (spectating) the latest live match, final first. */
export function matchFor(matches: readonly LocalMatch[], squadId: number | null): LocalMatch | null {
  if (squadId !== null) {
    const mine = matches.filter((m) => m.sides.some((s) => s.squadId === squadId));
    const live = mine.find((m) => m.state !== "over");
    if (live) return live;
  }
  return null;
}

/**
 * "Cheat lines" (test controls only, Eric Oct 12): the position whose engine lines to show, or null for no button. Only
 * for a test player (the server's `welcome` says `test`: an admin, or SQUADS_TEST), and only while they choose
 * something: their Relay move, a Pairs or final pick, a block (the position is the picking side's, so its top moves
 * are the ones worth blocking), or Armageddon's colours.
 */
export function cheatLinesAt(test: boolean, s: { choosing: boolean; colourChoice: boolean; fen: string }): string | null {
  return test && (s.choosing || s.colourChoice) ? s.fen : null;
}

/** The colours of the cheat lines, best first (the power-up hints' own). */
export const CHEAT_BRUSHES = ["green", "blue", "yellow"] as const;

/**
 * A line's evaluation for the side to move, in pawns ("+0.8"), or a mate ("#3"; "#-2": the mover is mated). The engine
 * gives an expected score (win + half the draws); this turns it back into pawns on Stockfish's scale, where +1.00 is
 * about a 50% win (an expected score of about 0.75): approximate, and enough to rank and compare.
 */
export function cheatEval(t: Pick<MoveScore, "expected" | "mate">): string {
  if (t.mate !== undefined) return `#${t.mate}`;
  const e = Math.min(0.999, Math.max(0.001, t.expected));
  const pawns = Math.max(-9.9, Math.min(9.9, Math.log(e / (1 - e)) / Math.log(3)));
  const r = Math.round(pawns * 10) / 10;
  return r === 0 ? "0.0" : `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(1)}`;
}

/** The cheat lines as the board's arrows: best first, coloured by rank, each labelled with its evaluation. */
export function cheatArrows(top: readonly Pick<MoveScore, "move" | "expected" | "mate">[]): Arrow[] {
  return top.slice(0, CHEAT_BRUSHES.length).map((t, i) => ({ move: t.move, brush: CHEAT_BRUSHES[i]!, label: cheatEval(t) }));
}
