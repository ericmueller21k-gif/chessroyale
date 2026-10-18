/**
 * The shared boss test kit (Eric, Oct 18: "I should be able to tell you to add a boss and it should take an hour"):
 * the driver, the stand-in engine and the invariants every boss gets for free. Used by `boss-kit.test.ts` (a short
 * seeded fuzz of every boss in BOSS_ROSTER, hidden ones included) and by the server's `boss-kit-parity.test.ts` (the
 * same battle through solo's path and the lobby's). docs/decisions/2026-10-18-boss-test-kit.md has why each check is
 * here; docs/areas/bosses.md, "Adding a boss", what a new boss still adds.
 *
 * The invariants, checked after every step (a crowd move, each step at the start of his turn, his move, his extra
 * move, the funhouse's move, the battle's end):
 *  1. The position is one Stockfish 19 plays: `stockfishRefuses` (pawns never on rank 1 or 8, at most 8 pawns, no more
 *     pieces than promotions could make, the side not to move never in check), at most 16 pieces a side, and the en
 *     passant square only where Stockfish keeps it (`epKept`: #275's S2).
 *  2. chess.js's legal moves are Stockfish's (`go perft 1`, the real engine) wherever a power made the position (a
 *     base at its ply) and at the start: the moves the judge and the boss are asked about are the moves the engine path
 *     accepts (S2's 22 against 21; an ordinary move's position is chess.js's own). A round's scored moves are each legal and
 *     listed once ("A move scored twice", Oct 14), and the crowd's move is one it was allowed.
 *  3. Whoever is to move has a legal move unless the game is over, and a power's limit leaves at least one (the
 *     crowd's `crowdAllowed`, the boss's `bossAllowed`); the boss's move is one he was allowed (lifted: any legal).
 *  4. The replay from the last base reproduces the position (`fenAtPly`; "A move only legal after a burn", Oct 9), and
 *     the boss view builds and serializes (the screens and the lobby send it).
 *  5. No step at the start of his turn (Lights out, a bounce, Alfil's steps, the Carrot Patch's cast, a hop) leaves him
 *     a promotion he didn't have as the crowd's move left the board: his move comes straight after, with no crowd turn
 *     between (#273's "instant queen"). A boss whose sheet allows one opts out in PROMOTION_OPT_OUT.
 *  6. A power's declared win beats a draw on the same move (#275's S1): whenever a power declares the battle his (an
 *     event whose kind ends in `Win`, e.g. `carrotWin`), a copy of the battle with the board stalemated must still end
 *     "boss"; and at the real end, such an event means "boss".
 *  7. A power's moments precede the result (#275's N-a): when the board's game ends on his move, the turn his rules
 *     would set up (prepareTurn) declares nothing the view leaves out; a battle the boss won with no mate, no time-out
 *     and before the move cap carries its declaring event in the last view before the result.
 */
import { vi } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type BossDef, type Settings } from "@chessroyale/core";
import {
  MatchRunner,
  boardEnd,
  fenAtPly,
  legalMoves,
  pieceAt,
  prepareTurn,
  sanLineToUci,
  sideToMove,
  stockfishRefuses,
  type EngineLike,
  type Opening,
  type RoundReport,
} from "../src/index.ts";
import { nodeTransport } from "../src/node.ts";

/**
 * Bosses whose sheet lets a power hand him a promotion for his very next move (invariant 5). Empty unless a boss's
 * sheet says so: `{ <boss id>: "<the sheet's words, and its decision file>" }`.
 */
export const PROMOTION_OPT_OUT: Readonly<Record<string, string>> = {};

/**
 * The runner's steps the driver plays, by name. A runner method that names a step (`…Due`, `…Step`) and isn't listed
 * here fails the kit (`unknownSteps`): a new kind of step must be played by the driver, never skipped silently.
 */
export const KNOWN_STEPS = ["lightsOutDue", "bounceDue", "alfilStep", "carrotDue", "hopDue", "extraMoveDue", "funhouseDue", "bossKillDue"] as const;

/** Runner methods that look like steps but aren't in KNOWN_STEPS. */
export function unknownSteps(): string[] {
  const names = Object.getOwnPropertyNames(MatchRunner.prototype).filter((n) => /(?:Due|Step)$/.test(n));
  return names.filter((n) => !(KNOWN_STEPS as readonly string[]).includes(n));
}

/** A device's search budget in the kit (ms of the kit's clock): a power that searches against the clock gets this. */
export const KIT_SEARCH_MS = 200;

/**
 * Every power's search that runs against the clock (a `…SearchMs`, `…TurnMs` or `…TestMs` in BOSS_POWERS: Wrangler's
 * showdown, 3 to 10 s a turn) cut to KIT_SEARCH_MS, on a clock that steps 1 ms each time it's read (`performance.now`):
 * a search's length is then a count of its own steps, not the machine's speed, so a battle is the same on every run and
 * on both paths of the parity test (on the real clock, a busy machine found other line-ups). The stand-in engine answers
 * at once, so a full budget would only be waiting. The rules and their guards don't change. Returns the undo.
 */
export function quickSearches(): () => void {
  const powers = BOSS_POWERS as unknown as Record<string, unknown>;
  const old: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(powers)) {
    if (/(?:Search|Turn|Test)Ms$/.test(k) && typeof v === "number" && v > KIT_SEARCH_MS) {
      old[k] = v;
      powers[k] = KIT_SEARCH_MS;
    }
  }
  let t = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => (t += 1));
  return () => {
    clock.mockRestore();
    Object.assign(powers, old);
  };
}

export const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
/**
 * The stand-in engine's score of a move: the same on every path (the server tests' host uses it too). A hash, plus a
 * bonus for a pawn's step forward that grows as it nears the last rank, and more for a promotion: both sides push
 * their pawns, so the fuzz meets promotions, pawns nose to nose and en passant often (where #273 and #275's S2 lived).
 */
export function fakeScore(fen: string, m: string): number {
  const p = pieceAt(fen, m.slice(0, 2));
  if (p?.type !== "p") return 0.3 + 0.4 * hash(fen + m);
  const ahead = p.color === "w" ? Number(m[3]) - 2 : 7 - Number(m[3]);
  return Math.min(0.99, 0.3 + 0.3 * hash(fen + m) + 0.04 * ahead + (m.length === 5 ? 0.3 : 0));
}

/**
 * A stand-in engine, a pure function of the position: every legal move scored by a hash, best first; the boss plays
 * the best of them. Quick (no search), and the same answers on every path, so solo and the lobby can be compared.
 */
export function fakeEngine(): EngineLike {
  const ranked = (fen: string) =>
    legalMoves(fen)
      .map((move) => ({ move, expected: fakeScore(fen, move) }))
      .sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1));
  return {
    topMoves: async (fen, n) => ranked(fen).slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: fakeScore(fen, move) })),
    topMovesAt: async (fen, n) => ranked(fen).slice(0, n),
    playAtElo: async (fen) => ranked(fen)[0]?.move ?? "0000",
  };
}

const line = (id: string, san: string[]): Opening => {
  const moves = sanLineToUci(san);
  return { id, eco: "C88", name: id, family: id, unusual: false, moves, namedPlies: moves.length, expected: Object.fromEntries(moves.map((_, i) => [i, 0.52])) };
};
/** The game so far for most battles (a boss with an opening of his own starts from it instead). */
export const KIT_OPENING = line("kit", ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O"]);
/**
 * The stress start (the crowd White): pawns locked across the board and one of his nose to nose with one of yours on
 * your third rank, the square behind yours empty (d4 against d3, d2 open): where a power could hand him a promotion for
 * his very next move (#273's hop onto your second rank, then dxc1=Q).
 */
export const KIT_STRESS = line("kit-stress", ["d3", "d5", "Nf3", "d4", "g3", "c5", "Bg2", "Nc6", "O-O", "e5", "a3", "f5", "h3", "h5", "Kh2", "Nf6"]);

/** One fuzz battle: which boss, its seed, the crowd's side, the test switch, from which crowd turn the trigger is pulled. */
export interface KitBattle {
  boss: string;
  seed: number;
  side: "w" | "b";
  /** The test switch (`?power=`): the boss's passive or ultimate. */
  test: string;
  /** The admins' test trigger, pulled whenever it may be from this crowd turn on. */
  triggerFrom: number;
  /** Crowd turns on which the crowd calls the God King's strike. */
  strikes: readonly number[];
  maxMoves: number;
  /** The game so far (the stress start, or the usual one). */
  opening: Opening;
}

/**
 * The battles each boss gets: his passive switched on early (crowd White); his ultimate switched on early and the
 * admins' trigger pulled again and again (crowd Black); and from the stress start with the trigger pulled from the
 * first turn (crowd White). `extra` more seeds of each (KIT_SEEDS, for a deeper run by hand).
 */
export function kitBattles(def: BossDef, maxMoves: number, extra = 0): KitBattle[] {
  const p = def.powers;
  if (!p) return [];
  const out: KitBattle[] = [];
  for (let k = 0; k <= extra; k++) {
    const base = 1 + Math.floor(hash(def.id) * 1000) + 10 * k;
    out.push(
      { boss: def.id, seed: base, side: "w", test: p.passive, triggerFrom: 12, strikes: [3, 9], maxMoves, opening: KIT_OPENING },
      { boss: def.id, seed: base + 1, side: "b", test: p.ultimate, triggerFrom: 1, strikes: [6], maxMoves, opening: KIT_OPENING },
      { boss: def.id, seed: base + 2, side: "w", test: "", triggerFrom: 1, strikes: [4], maxMoves, opening: KIT_STRESS },
    );
  }
  return out;
}

export const kitSettings = (b: Pick<KitBattle, "boss" | "test" | "maxMoves">, patch: Partial<Settings> = {}): Settings =>
  ({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: b.boss, bossUnfinished: true, bossHidden: true, lastStandFrom: 999, bossMaxMoves: b.maxMoves, bossPowerTest: b.test, ...patch }) as Settings;

/** Every boss in the roster (hidden ones too), with powers. */
export const kitBosses = (): BossDef[] => BOSS_ROSTER.filter((d) => d.powers);

// ---------------- Stockfish's own move list ----------------

/** Stockfish 19 (the same build as the game's), asked for each position's legal moves (`go perft 1`). */
export class StockfishMoves {
  private t = nodeTransport();
  private listener: ((line: string) => void) | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor() {
    this.t.onLine((l) => this.listener?.(l));
  }
  private until(send: string[], done: (l: string) => boolean, each?: (l: string) => void): Promise<void> {
    return new Promise((resolve) => {
      this.listener = (l) => {
        each?.(l);
        if (done(l)) {
          this.listener = null;
          resolve();
        }
      };
      for (const c of send) this.t.send(c);
    });
  }
  async init() {
    await this.until(["uci"], (l) => l === "uciok");
    await this.until(["isready"], (l) => l === "readyok");
  }
  /** Stockfish's legal moves in a position (UCI, sorted). Only for a position stockfishRefuses passes. */
  moves(fen: string): Promise<string[]> {
    const run = async () => {
      const out: string[] = [];
      await this.until([`position fen ${fen}`, "go perft 1"], (l) => l.startsWith("Nodes searched"), (l) => {
        const m = /^([a-h][1-8][a-h][1-8][nbrq]?): \d+$/.exec(l);
        if (m) out.push(m[1]!);
      });
      return out.sort();
    };
    const next = this.queue.then(run);
    this.queue = next.catch(() => undefined);
    return next;
  }
  close() {
    this.t.close();
  }
}

// ---------------- The invariants ----------------

const FILES = "abcdefgh";
const sq = (f: number, r: number) => (f >= 0 && f < 8 && r >= 1 && r <= 8 ? `${FILES[f]}${r}` : null);

/**
 * Whether Stockfish keeps the FEN's en passant square (its Position::set): on the side to move's sixth rank, a pawn of
 * the side to move attacking it, the pawn that just moved in front of it, and both it and the square behind it empty.
 * "-" is always kept.
 */
export function epKept(fen: string): boolean {
  const [, side, , ep = "-"] = fen.split(" ");
  if (ep === "-") return true;
  const f = FILES.indexOf(ep[0]!);
  const r = Number(ep[1]);
  if (f < 0 || r !== (side === "w" ? 6 : 3)) return false;
  const them = side === "w" ? "b" : "w";
  const dir = side === "w" ? 1 : -1;
  const pushed = sq(f, r - dir);
  const behind = sq(f, r + dir);
  const attackers = [sq(f - 1, r - dir), sq(f + 1, r - dir)].filter((s): s is string => !!s);
  const isPawn = (s: string | null, c: string) => !!s && pieceAt(fen, s)?.type === "p" && pieceAt(fen, s)?.color === c;
  return attackers.some((s) => isPawn(s, side!)) && isPawn(pushed, them) && !pieceAt(fen, ep) && !!behind && !pieceAt(fen, behind);
}

/** Pieces a side has on the board. */
const piecesOf = (fen: string, color: "w" | "b") => [...fen.split(" ")[0]!].filter((c) => /[a-z]/i.test(c) && (color === "w" ? c === c.toUpperCase() : c === c.toLowerCase())).length;

/** The boss's promotions in a position (him to move): `from+to`, one per square pair. */
export const promotionsOf = (fen: string) => [...new Set(legalMoves(fen).filter((m) => m.length === 5).map((m) => m.slice(0, 4)))];

/**
 * Invariants 1 and 2 on one position: what's wrong with it (nothing: []). `stockfish`: Stockfish's own legal moves there
 * (StockfishMoves), or null to skip that comparison.
 */
export function positionProblems(fen: string, stockfish: readonly string[] | null): string[] {
  const out: string[] = [];
  const refused = stockfishRefuses(fen);
  if (refused) out.push(`a position Stockfish refuses: ${refused}`);
  for (const c of ["w", "b"] as const) if (piecesOf(fen, c) > 16) out.push(`${c} has more than 16 pieces`);
  if (!epKept(fen)) out.push(`an en passant square Stockfish drops (${fen.split(" ")[3]})`);
  if (stockfish && !refused) {
    const ours = [...legalMoves(fen)].sort();
    const theirs = [...stockfish].sort();
    if (ours.join() !== theirs.join()) out.push(`chess.js has ${ours.length} legal moves, Stockfish ${theirs.length} (only chess.js: ${ours.filter((m) => !theirs.includes(m)).join(" ") || "-"}; only Stockfish: ${theirs.filter((m) => !ours.includes(m)).join(" ") || "-"})`);
  }
  return out;
}

/** Invariant 5 on two positions (him to move in both): the promotions he has after a power's step and didn't before it. */
export const newPromotions = (crowdLeft: string, after: string) => {
  const before = promotionsOf(crowdLeft);
  return promotionsOf(after).filter((m) => !before.includes(m));
};

/** A copy of a runner, as every lobby event restores it. */
export function copyOf(r: MatchRunner, settings: Settings, engines: EngineLike[]): MatchRunner {
  return MatchRunner.restore(structuredClone(r.snapshot()), { settings, rng: mulberry32(1), engines, library: [KIT_OPENING, KIT_STRESS] });
}

/** A stalemate with `side` to move (its king boxed in by a queen; nothing else on the board). */
export const stalemateFor = (side: "w" | "b") => (side === "w" ? "7k/8/8/8/8/1q6/8/K7 w - - 0 60" : "k7/8/1Q6/8/8/8/8/7K b - - 0 60");

const winsIn = (events: readonly { kind: string; turn: number }[] | undefined) => (events ?? []).filter((e) => /Win$/.test(e.kind));

/** A failed invariant: where it happened, so it can be replayed (the battle, the step, the position, the moves). */
export class KitFailure extends Error {}

/** One battle's checks; `where` names the battle in every failure. */
export class Checker {
  failures: string[] = [];
  steps = 0;
  /** Each invariant that ran, and how often (so a check that never ran shows). */
  ran: Record<string, number> = {};
  private seenWins = new Set<string>();
  constructor(
    private where: string,
    private sf: StockfishMoves | null,
    private settings: Settings,
  ) {}
  private fail(what: string, r: MatchRunner, step: string) {
    const b = r.boards.get(r.state.boards[0]!)!;
    this.failures.push(`${this.where}, after ${step}: ${what}\n  FEN ${b.fen}\n  moves ${b.history.join(" ")}\n  bases ${JSON.stringify(b.bases ?? [])}`);
  }
  private count(name: string) {
    this.ran[name] = (this.ran[name] ?? 0) + 1;
  }
  private board(r: MatchRunner) {
    return r.boards.get(r.state.boards[0]!)!;
  }

  /** Invariants 1-4 and 6's probe, after any step. */
  async position(r: MatchRunner, step: string) {
    this.steps++;
    const b = this.board(r);
    const fen = b.fen;
    // 1 and 2. A position Stockfish plays, and chess.js's moves are Stockfish's. (Stockfish is asked only where a power
    // made the position, a base at this ply, and at the start: a position an ordinary move made is chess.js's own.)
    this.count("legal position");
    const edited = !b.history.length || !!b.bases?.some((x) => x.ply === b.history.length) || this.steps === 1;
    const theirs = edited && this.sf && !stockfishRefuses(fen) ? await this.sf.moves(fen) : null;
    if (theirs) this.count("chess.js = Stockfish");
    for (const problem of positionProblems(fen, theirs)) this.fail(problem, r, step);
    // 3. A move for whoever is to move.
    const over = boardEnd(b) !== null;
    const legal = legalMoves(fen);
    this.count("a move to play");
    if (!over && !legal.length) this.fail("no legal move, and the game isn't over", r, step);
    if (!over && r.boss && !r.stageComplete()) {
      const crowdTurn = sideToMove(fen) === r.boss.crowdSide;
      const allowed = crowdTurn ? r.crowdAllowed() : r.bossAllowed();
      if (allowed && !allowed.length) this.fail(`the ${crowdTurn ? "crowd" : "boss"} is left no allowed move`, r, step);
      for (const m of allowed ?? []) if (!legal.includes(m)) this.fail(`the ${crowdTurn ? "crowd" : "boss"} is allowed an illegal move ${m}`, r, step);
    }
    // 4. The replay reproduces it; the view builds.
    this.count("replay");
    const replay = fenAtPly(b.history, b.history.length, b.bases);
    if (replay !== fen) this.fail(`the replay from the last base gives ${replay}`, r, step);
    let events: { kind: string; turn: number }[] = [];
    try {
      const view = r.bossView();
      JSON.parse(JSON.stringify(view));
      events = view?.powers?.events ?? [];
      const turn = r.boss?.powers?.turn ?? 0;
      for (const e of events) if (e.turn > turn + 1) this.fail(`an event from a turn to come (${e.kind}, turn ${e.turn}, now ${turn})`, r, step);
    } catch (e) {
      this.fail(`the boss view fails: ${e instanceof Error ? e.message : String(e)}`, r, step);
    }
    // 6. A power declared the battle his: it stands even when the same move draws on the board.
    for (const w of winsIn(events)) {
      const key = `${w.kind}@${w.turn}`;
      if (this.seenWins.has(key)) continue;
      this.seenWins.add(key);
      this.count("a declared win beats a draw");
      const copy = copyOf(r, this.settings, []);
      const cb = copy.boards.get(copy.state.boards[0]!)!;
      const stale = stalemateFor(r.boss!.crowdSide);
      copy.boards.set(cb.id, { ...cb, fen: stale, bases: [...(cb.bases ?? []).filter((x) => x.ply !== cb.history.length), { ply: cb.history.length, fen: stale }] });
      const result = copy.stageComplete() ? copy.finishBossBattle() : "not over";
      if (result !== "boss") this.fail(`${w.kind} declared the battle his, but with the same move stalemating it ends "${result}"`, r, step);
    }
  }

  /** Invariant 2's other half: a round's scored moves are legal, each listed once, and the crowd's move was allowed. */
  round(r: MatchRunner, report: RoundReport, allowed: readonly string[], step: string) {
    this.count("scored once");
    for (const br of report.boards) {
      const legal = legalMoves(br.fenBefore);
      const moves = br.scored.map((s) => s.move);
      const twice = moves.filter((m, i) => moves.indexOf(m) !== i);
      if (twice.length) this.fail(`moves scored twice: ${[...new Set(twice)].join(" ")}`, r, step);
      for (const m of moves) if (!legal.includes(m)) this.fail(`an illegal move scored: ${m}`, r, step);
      const played = br.result.playedMove;
      if (played && !allowed.includes(played)) this.fail(`the crowd's move ${played} wasn't one it was allowed`, r, step);
    }
  }

  /** Invariant 3's last part: the boss's move was one he was allowed (or any legal one when the limit lifted). */
  bossMove(r: MatchRunner, fenBefore: string, allowed: readonly string[] | null, played: string, step: string) {
    this.count("his move allowed");
    const b = this.board(r);
    // (The move on the board: a special move, Wrangler's long pull, is recorded as its legal double step.)
    const onBoard = b.history.at(-1);
    const ok = allowed ?? legalMoves(fenBefore);
    if (!onBoard || (!ok.includes(onBoard) && !ok.includes(played))) this.fail(`his move ${played} (${onBoard}) wasn't one he was allowed in ${fenBefore}`, r, step);
  }

  /**
   * Invariant 7's probe at every win a power declares on his move: the same move played on a copy of the battle from
   * before it, with the game over on the board as it lands (the runner's game-over check answering yes, as after a mate
   * or a stalemate), still brings that win's moment. Nothing is built by hand: whatever his rules do when his move also
   * ends the game is what runs (#275's N-a: the turn's setup returned at the game's end, and his win's moments never
   * came).
   */
  endsTooProbe(pre: MatchRunner, r: MatchRunner, step: string) {
    const turn = r.boss?.powers?.turn;
    const wins = winsIn(r.bossView()?.powers?.events).filter((e) => e.turn === turn);
    if (!wins.length) return;
    this.count("moments when the game ends too");
    const move = this.board(r).history.at(-1)!;
    (pre as unknown as { finalGameOver(): boolean }).finalGameOver = () => true;
    pre.applyBossMove(move);
    const got = winsIn(pre.bossView()?.powers?.events);
    for (const w of wins) if (!got.some((x) => x.kind === w.kind)) this.fail(`with the same move also ending the game on the board, ${w.kind} never comes: its moments would be skipped before the result`, r, step);
  }

  /** Invariant 5: a step at the start of his turn left him no promotion the crowd's move hadn't. */
  promotion(r: MatchRunner, crowdLeft: string, step: string) {
    if (!r.bossToMove() || PROMOTION_OPT_OUT[r.boss!.id ?? ""]) return;
    this.count("no instant queen");
    const now = newPromotions(crowdLeft, this.board(r).fen);
    if (now.length) this.fail(`a power gave him a promotion for his very next move: ${now.join(" ")}`, r, step);
  }

  /** Invariants 6 and 7 at the end (before finishBossBattle), then the result; returns it. */
  end(r: MatchRunner, step: string): "crowd" | "boss" | "draw" {
    const b = this.board(r);
    const boss = r.boss!;
    const ending = boardEnd(b);
    const events = r.bossView()?.powers?.events ?? [];
    const wins = winsIn(events);
    // 7. The game ended on his move: the turn his rules would set up declares nothing the view leaves out.
    if (ending && sideToMove(b.fen) === boss.crowdSide) {
      this.count("moments before the result");
      const would = prepareTurn(boss, b.fen, this.settings.bossPowerTest, BOSS_POWERS, b.lastMove ?? null);
      for (const w of winsIn(would.powers?.events)) if (!wins.some((x) => x.kind === w.kind)) this.fail(`the game ended on his move, and ${w.kind} (his rules' moment for that turn) never reached the view`, r, step);
    }
    const timedOut = r.bossOutOfTime() && !ending;
    const result = r.finishBossBattle();
    this.count("result");
    if (ending === "checkmate") {
      const mated = sideToMove(b.fen);
      const want = mated === boss.crowdSide ? "boss" : "crowd";
      if (result !== want) this.fail(`checkmate, but the result is "${result}"`, r, step);
    }
    if (wins.length && result !== "boss") this.fail(`${wins.map((w) => w.kind).join(", ")} declared the battle his, but the result is "${result}"`, r, step);
    if (result === "boss" && ending !== "checkmate" && !timedOut && boss.crowdMoves < this.settings.bossMaxMoves && !wins.length) this.fail(`the boss won with no mate, no time-out and before the move cap, and no power's win is in the view before the result`, r, step);
    return result;
  }
}

/** The God King's strike, when the crowd calls it (its first player). */
const callStrike = (r: MatchRunner) => {
  const p = r.alive()[0];
  if (p && (r.boss?.kingCharges ?? 0) > 0) r.callStrike(p.id);
};

/**
 * The crowd's move: cheap and seeded. A promotion when it has one, else pawn moves often (they make promotions,
 * nose-to-nose pawns and en passant), captures sometimes, else any allowed move.
 */
export function crowdPick(fen: string, allowed: readonly string[], rng: () => number): string {
  const sorted = [...allowed].sort();
  const pick = (xs: string[]) => xs[Math.floor(rng() * xs.length)]!;
  const promos = sorted.filter((m) => m.length === 5);
  if (promos.length && rng() < 0.8) return pick(promos);
  const pawns = sorted.filter((m) => pieceAt(fen, m.slice(0, 2))?.type === "p");
  const caps = sorted.filter((m) => pieceAt(fen, m.slice(2, 4)));
  const x = rng();
  if (pawns.length && x < 0.45) return pick(pawns);
  if (caps.length && x < 0.7) return pick(caps);
  return pick(sorted);
}

/** What one battle did: its result, the steps checked, the steps it played by kind, the events seen. */
export interface KitRun {
  result: "crowd" | "boss" | "draw" | null;
  steps: number;
  played: Record<string, number>;
  events: Set<string>;
  failures: string[];
  ran: Record<string, number>;
}

/**
 * One battle through the match runner, as solo plays one (simulateRest's order of steps), every invariant after every
 * step. The steps at the start of his turn are the runner's own (KNOWN_STEPS); his move is `playBoss` on the stand-in
 * engine.
 */
export async function runBattle(k: KitBattle, sf: StockfishMoves | null): Promise<KitRun> {
  const settings = kitSettings(k);
  const engines = [fakeEngine()];
  const r = new MatchRunner({ settings, rng: mulberry32(k.seed), engines, library: [k.opening], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: k.side });
  const where = `${k.boss} (seed ${k.seed}, crowd ${k.side === "w" ? "White" : "Black"}, ?power=${k.test || "none"}, from ${k.opening.id})`;
  const c = new Checker(where, sf, settings);
  const run: KitRun = { result: null, steps: 0, played: {}, events: new Set(), failures: c.failures, ran: c.ran };
  const note = (s: string) => (run.played[s] = (run.played[s] ?? 0) + 1);
  const seen = () => {
    for (const e of r.boss?.powers?.events ?? []) run.events.add(e.kind);
  };
  if (r.boss?.id !== k.boss) {
    c.failures.push(`${where}: the runner met ${r.boss?.id ?? "no boss"} instead`);
    return run;
  }
  const rng = mulberry32(k.seed * 7919);
  await c.position(r, "the start");
  for (let i = 0; i < 400 && !r.isOver(); i++) {
    if (r.stageComplete()) {
      seen();
      run.result = c.end(r, "the last step");
      break;
    }
    if (r.boss!.crowdMoves + 1 >= k.triggerFrom) r.triggerUltimate();
    if (r.bossToMove()) {
      const crowdLeft = r.boards.get(r.state.boards[0]!)!.fen;
      if (r.lightsOutDue()) {
        r.startLightsOut();
        r.finishLightsOut({});
        note("lightsout");
        await c.position(r, "Lights out");
        c.promotion(r, crowdLeft, "Lights out");
      }
      if (r.bounceDue()) {
        await r.playBounce(engines).catch(() => r.applyBounce(null));
        note("bounce");
        await c.position(r, "the bounce");
        c.promotion(r, crowdLeft, "the bounce");
      }
      for (let s = 0; s < 3; s++) {
        const step = r.alfilStep();
        if (!step) break;
        await r.playAlfil(engines).catch(() => r.applyAlfil(null));
        note(step);
        await c.position(r, `Alfil's ${step}`);
        c.promotion(r, crowdLeft, `Alfil's ${step}`);
      }
      if (r.bossToMove() && r.carrotDue()) {
        r.applyCarrots();
        note("carrots");
        await c.position(r, "the Carrot Patch's cast");
        c.promotion(r, crowdLeft, "the Carrot Patch's cast");
      }
      if (r.bossToMove() && r.hopDue()) {
        await r.playHop(engines).catch(() => r.applyHop(null));
        note("hop");
        await c.position(r, "the hop");
        c.promotion(r, crowdLeft, "the hop");
      }
      if (r.bossToMove()) {
        const fen = r.boards.get(r.state.boards[0]!)!.fen;
        const allowed = r.bossAllowed();
        const pre = copyOf(r, settings, engines);
        const move = await r.playBoss(engines[0]);
        note("boss");
        await c.position(r, `his move ${move}`);
        c.bossMove(r, fen, allowed, move, `his move ${move}`);
        c.endsTooProbe(pre, r, `his move ${move}`);
      }
      seen();
      continue;
    }
    if (r.extraMoveDue()) {
      await r.playExtraMove(engines[0]);
      note("extra");
      await c.position(r, "his extra move");
      continue;
    }
    if (r.funhouseDue()) {
      await r.playFunhouse(engines[0]).catch(() => r.applyFunhouse(""));
      note("funhouse");
      await c.position(r, "the funhouse's move");
      continue;
    }
    r.deal();
    const fen = r.boards.get(r.state.boards[0]!)!.fen;
    const allowed = r.crowdAllowed() ?? legalMoves(fen);
    if (k.strikes.includes(r.boss!.crowdMoves + 1)) callStrike(r);
    const move = crowdPick(fen, allowed, rng);
    const report = await r.score(new Map([[r.alive()[0]!.id, { move, thinkMs: 1000 }]]));
    note("crowd");
    c.round(r, report, allowed, `the crowd's move ${move}`);
    await c.position(r, `the crowd's move ${move}`);
    if (r.bossKillDue()) r.bossKill();
    seen();
  }
  run.steps = c.steps;
  return run;
}

