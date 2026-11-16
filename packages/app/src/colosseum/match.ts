/**
 * The game on the Colosseum's floor (Oct 30, the first look): two town bots play 3+2, the next game starting a few seconds
 * after one ends, for as long as the screen is open. Played on this device for this preview (the tournament's games will
 * run on our server). The engine and the clock are passed in, so the tests drive it without Stockfish or waiting.
 */
import { moveKnock } from "../move-sound.ts";
import { START_FEN, applyMove, gameEnd, pieceAt, sideToMove, toSan, type GameEnd } from "@chessroyale/chess";
import { BOTS, type TownBot } from "../town/world.ts";
import type { FloorPiece } from "./arena-gl.ts";

/** The time control and the pauses (ms). */
export const FLOOR = {
  baseMs: 180_000,
  incMs: 2_000,
  /** Between one game's end and the next's first move. */
  nextMs: 5_000,
  /** The first game's wait for the arena to come in. */
  firstMs: 1_200,
  /** A game longer than this many plies is called a draw (no game on the floor runs for ever). */
  maxPlies: 240,
  /** The search for a bot's move and for the eval bar (Stockfish's nodes: a low depth, quick on a phone). */
  moveNodes: 20_000,
  evalNodes: 12_000,
} as const;

/** The bots who play on the floor: the town's bots Stockfish can play at their rating (UCI_Elo starts at 1320). */
export const PLAYERS: readonly number[] = BOTS.flatMap((b, i) => (b.rating >= 1300 ? [i] : []));

export type Result = "1-0" | "0-1" | "1/2-1/2";
export type Reason = Exclude<GameEnd, null> | "time" | "long";

export interface FloorState {
  /** Games started since the screen opened (1: the first). */
  game: number;
  white: number;
  black: number;
  fen: string;
  moves: string[];
  sans: string[];
  /** Each side's clock (ms) at the start of the move now being thought about; and when that move began (the clock's `now`). */
  clock: { w: number; b: number };
  turnAt: number;
  /** Pieces each side has taken ("q", "p", …), in the order taken. */
  took: { w: string[]; b: string[] };
  /** White's expected score (0 to 1) after the last move, and a mate in the line (+ White mates), when known. */
  eval: number | null;
  mate: number | null;
  status: "waiting" | "playing" | "over";
  result: Result | null;
  reason: Reason | null;
  /** The last move's pieces on the floor (what moved, from where; what was taken). */
  pieces: FloorPiece[];
  /** A queen was taken by the last move (the crowd jumps). */
  queenTaken: boolean;
  /** The last move's piece sound, as a played game's (move-sound.ts): set by a move, cleared once played. */
  knock: "move" | "capture" | "castle" | null;
}

export interface FloorDeps {
  /** A bot's move in a position, at its rating, in at most `ms`. */
  move(fen: string, rating: number, ms: number): Promise<string>;
  /** The eval after a move: White's expected score, and a mate in moves (+ White mates); null if there's none. */
  evaluate(fen: string): Promise<{ white: number; mate: number | null } | null>;
  now(): number;
  random(): number;
  /** Waits (the screen's setTimeout); resolves false when the match has been stopped. */
  wait(ms: number): Promise<boolean>;
  /** How long a bot thinks (ms), given the move number and its clock: the tests and `?fast` make it short. */
  think?(ply: number, clockMs: number): number;
  /** The pause between games (ms; FLOOR.nextMs unless the tests or `?fast` make it short). */
  nextMs?(): number;
}

/** The pieces of a position, each on its square ("wp" … "bk"). */
export function piecesOf(fen: string): FloorPiece[] {
  const out: FloorPiece[] = [];
  const rows = fen.split(" ")[0]!.split("/");
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        out.push({ key: (ch === ch.toUpperCase() ? "w" : "b") + ch.toLowerCase(), sq: String.fromCharCode(97 + f) + (8 - i), from: null, taken: false });
        f++;
      }
    }
  });
  return out;
}

/** The pieces after `uci` was played from `before` (giving `after`): the mover (and a castling rook) slide from where they were; a taken piece stays to go as the slide lands. */
export function piecesAfter(before: string, uci: string, after: string): { pieces: FloorPiece[]; took: string | null } {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const mover = pieceAt(before, from);
  const slides = new Map<string, string>([[to, from]]);
  if (mover?.type === "k" && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2) {
    const rank = from[1]!;
    if (to[0] === "g") slides.set(`f${rank}`, `h${rank}`);
    else slides.set(`d${rank}`, `a${rank}`);
  }
  let takenSq: string | null = pieceAt(before, to) ? to : null;
  if (!takenSq && mover?.type === "p" && from[0] !== to[0]) takenSq = to[0]! + from[1]!; // en passant
  const taken = takenSq ? pieceAt(before, takenSq) : null;
  const pieces = piecesOf(after).map((p) => ({ ...p, from: slides.get(p.sq) ?? null }));
  if (taken && takenSq) pieces.push({ key: taken.color + taken.type, sq: takenSq, from: null, taken: true });
  return { pieces, took: taken?.type ?? null };
}

/** How long a bot thinks over a move (ms): quick in the opening, longer in the middle, less when its clock runs low. */
export function thinkMs(ply: number, clockMs: number, random: number): number {
  const base = ply < 10 ? 400 + random * 900 : 900 + random * 4200;
  return Math.max(150, Math.min(base, clockMs / 18 + FLOOR.incMs * 0.7));
}

/** The match: games one after another until `stop`. `onChange` is called after every change (a move, a game's end or start). */
export class FloorMatch {
  state: FloorState;
  private stopped = false;
  private ended = false;

  constructor(
    private readonly deps: FloorDeps,
    private readonly onChange: (s: FloorState) => void,
  ) {
    this.state = this.fresh(0, -1);
  }

  private fresh(game: number, last: number): FloorState {
    const pick = () => PLAYERS[Math.floor(this.deps.random() * PLAYERS.length) % PLAYERS.length]!;
    let white = pick();
    let black = pick();
    for (let i = 0; (black === white || white === last) && i < 20; i++) ((white = pick()), (black = pick()));
    if (black === white) black = PLAYERS[(PLAYERS.indexOf(white) + 1) % PLAYERS.length]!;
    return {
      game,
      white,
      black,
      fen: START_FEN,
      moves: [],
      sans: [],
      clock: { w: FLOOR.baseMs, b: FLOOR.baseMs },
      turnAt: this.deps.now(),
      took: { w: [], b: [] },
      eval: 0.5,
      mate: null,
      status: "waiting",
      result: null,
      reason: null,
      pieces: piecesOf(START_FEN),
      queenTaken: false,
      knock: null,
    };
  }

  bot(i: number): TownBot {
    return BOTS[i]!;
  }

  /** The clock of `side` now (ms; the side to move's running). */
  clockNow(side: "w" | "b"): number {
    const s = this.state;
    const run = s.status === "playing" && sideToMove(s.fen) === side ? this.deps.now() - s.turnAt : 0;
    return Math.max(0, s.clock[side] - run);
  }

  /** Plays games till stopped. */
  async run(): Promise<void> {
    let first = true;
    while (!this.stopped) {
      const s = this.fresh(this.state.game + 1, this.state.white);
      this.state = s;
      this.ended = false;
      this.onChange(s);
      if (!(await this.deps.wait(first ? FLOOR.firstMs : 400))) return;
      first = false;
      s.status = "playing";
      s.turnAt = this.deps.now();
      this.onChange(s);
      await this.play(s);
      if (this.stopped) return;
      if (!(await this.deps.wait(this.deps.nextMs ? this.deps.nextMs() : FLOOR.nextMs))) return;
    }
  }

  private async play(s: FloorState): Promise<void> {
    while (!this.stopped && !this.ended && s === this.state) {
      const side = sideToMove(s.fen);
      const bot = BOTS[side === "w" ? s.white : s.black]!;
      const clock = s.clock[side];
      const think = this.deps.think ? this.deps.think(s.moves.length, clock) : thinkMs(s.moves.length, clock, this.deps.random());
      const t0 = this.deps.now();
      let uci: string;
      try {
        uci = await this.deps.move(s.fen, bot.rating, think);
      } catch {
        return this.finish(s, "1/2-1/2", "long");
      }
      const spent = this.deps.now() - t0;
      if (spent < think && !(await this.deps.wait(think - spent))) return;
      if (this.ended || s !== this.state) return;
      const used = this.deps.now() - s.turnAt;
      if (used >= clock) {
        s.clock[side] = 0;
        return this.finish(s, side === "w" ? "0-1" : "1-0", "time");
      }
      this.apply(s, uci, clock - used);
      const end = gameEnd(START_FEN, s.moves);
      if (end) return this.finish(s, end === "checkmate" ? (side === "w" ? "1-0" : "0-1") : "1/2-1/2", end);
      if (s.moves.length >= FLOOR.maxPlies) return this.finish(s, "1/2-1/2", "long");
      void this.deps.evaluate(s.fen).then((e) => {
        if (!e || s !== this.state || s.status !== "playing") return;
        s.eval = e.white;
        s.mate = e.mate;
        this.onChange(s);
      });
    }
  }

  private apply(s: FloorState, uci: string, left: number): void {
    const side = sideToMove(s.fen);
    const before = s.fen;
    const san = toSan(before, uci);
    s.fen = applyMove(before, uci);
    s.moves.push(uci);
    s.sans.push(san);
    s.clock[side] = left + FLOOR.incMs;
    s.turnAt = this.deps.now();
    const { pieces, took } = piecesAfter(before, uci, s.fen);
    s.pieces = pieces;
    s.queenTaken = took === "q";
    s.knock = moveKnock(before, s.fen, uci);
    if (took) s.took[side].push(took);
    this.onChange(s);
  }

  private finish(s: FloorState, result: Result, reason: Reason): void {
    if (s.status === "over") return;
    s.status = "over";
    s.result = result;
    s.reason = reason;
    s.queenTaken = false;
    this.ended = true;
    this.onChange(s);
  }

  /** (Tests) Ends the game now, on time against the side to move. */
  flag(): void {
    const s = this.state;
    if (s.status !== "playing") return;
    const side = sideToMove(s.fen);
    s.clock[side] = 0;
    this.finish(s, side === "w" ? "0-1" : "1-0", "time");
  }

  stop(): void {
    this.stopped = true;
  }
}

/** A result in words, as the middle of the overlay says it ("White wins on time"). */
export function resultText(s: Pick<FloorState, "result" | "reason">): string {
  if (!s.result) return "";
  const who = s.result === "1-0" ? "White wins" : s.result === "0-1" ? "Black wins" : "Draw";
  const why: Record<Reason, string> = {
    checkmate: "by checkmate",
    time: "on time",
    stalemate: "by stalemate",
    repetition: "by repetition",
    fifty_moves: "by the 50-move rule",
    insufficient_material: "by insufficient material",
    long: "",
  };
  const w = s.reason ? why[s.reason] : "";
  return w ? `${who} ${w}` : who;
}

/** A clock as the cards show it: "2:58", and tenths under 20 seconds ("0:09.4"). */
export function clockText(ms: number): string {
  const t = Math.max(0, ms);
  if (t < 20_000) return `0:${String(Math.floor(t / 1000)).padStart(2, "0")}.${Math.floor((t % 1000) / 100)}`;
  const s = Math.ceil(t / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The eval as the bar says it: "+0.3" for White, "−1.2" for Black, "M3" / "−M3" for a mate; from White's expected score. */
export function evalText(white: number | null, mate: number | null): string {
  if (mate) return mate > 0 ? `M${mate}` : `−M${-mate}`;
  if (white === null) return "";
  const e = Math.min(0.999, Math.max(0.001, white));
  // (Lichess's link between centipawns and winning chances, turned round.)
  const pawns = -Math.log(1 / e - 1) / 0.368208;
  const v = Math.round(pawns * 10) / 10;
  return v === 0 ? "0.0" : v > 0 ? `+${v.toFixed(1)}` : `−${(-v).toFixed(1)}`;
}

/** A viewer count as the middle shows it: "1.2K" from 1,000 up. */
export function viewersText(n: number): string {
  return n >= 1000 ? `${(Math.floor(n / 100) / 10).toFixed(1)}K` : String(n);
}
