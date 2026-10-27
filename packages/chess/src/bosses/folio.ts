/**
 * Folio, a paper crane folded from a page of handwriting (BOSS_ROSTER "folio"; the director's boss, Oct 26): its rules.
 * Calm, honest, a little unsettling: it tells you the truth, and it never takes anything back for you (Eric, Oct 26: no
 * power of its forgives the players' blunders). docs/decisions/2026-10-27-folio-rules.md.
 *
 * - **Draft** (passive): every draftEvery crowd turns from draftFirst, as the crowd's turn after its move begins, an ink
 *   mark under one of the crowd's pieces that one of its pieces attacks (chooseDraft: defended, never one a cheaper piece
 *   of its attacks, the most valuable, seeded among ties). The crowd has draftWindow of its own moves to end that
 *   one attack; if it still stands after them, the piece is folded: frozen for foldTurns crowd turns (Ginger's freeze's
 *   rules: never the king, lifted for a turn it would leave no move). The mark clears as soon as the attack ends.
 * - **Crease** (ultimate, the rage meter's): the engine picks one of the 14 inner lines with Folio's move (creasePick, on
 *   the host's engines online), shown on the warning's turn; as the next crowd turn begins the board is creased along it
 *   for creaseTurns crowd turns: none of the crowd's pieces crosses it, and Folio's may (it folds the board toward itself:
 *   the director's call, Oct 27); for the crowd's moves, Sawyer's board saw's rules (crossesCrease).
 * - **Revision** (once a battle): right after a crowd move that punishes its last move (revisionDrop, by the judge's own
 *   numbers), both moves are crossed out: the board goes back to before its move (a base), it plays the engine's best
 *   there (bestReply), and the crowd moves again.
 *
 * Its art and moments are the app's (the wiring lane: components/Folio.tsx holds their place). Numbers: BOSS_POWERS'
 * draft*, foldTurns, crease*, revision*, rageSpeed.folio.
 */
import { BOSS_POWERS, mulberry32, type BossPowerSettings, type BossPowerState, type BossState, type FolioState } from "@chessroyale/core";
import { Chess, type Square } from "chess.js";
import { boardEnd } from "../boards.ts";
import { applyMove, baseAt, fenAtPly, legalMoves, matingMoves, pieceAt, toSan } from "../rules.ts";
import { stunnedIn } from "./moo.ts";
import type { EngineLike } from "../runner.ts";
import { VALUE, eachOn, from, logit, materialOf, meterFull, other, powerRoll, rageNow, rageSpeedOf, rageTick, testSwitch, to, turnOf, type Battle, type BossRules, type JudgedMove, type Side } from "./base.ts";

/**
 * How long each of its moments holds the screen (ms; POWER_FX in boss-timing.ts). `fold` and `revision` play at the start
 * of its turn, while it thinks (its move waits for them: folioTurnMs); the rest as the crowd's turn begins, before the
 * crowd's clock starts. `creaseWarn` comes with the RAGE warning (`warn`), whose time covers it: the line only shows.
 */
export const FOLIO_FX = { draft: 1800, fold: 1600, creaseWarn: 0, crease: 2400, creaseEnd: 900, revision: 2800 } as const;

const FILES = "abcdefgh";
const file = (sq: string) => sq.charCodeAt(0) - 97;
const rank = (sq: string) => Number(sq[1]);
const square = (f: number, r: number) => `${FILES[f]}${r}`;

/** A battle's Folio state as it starts. */
export const FOLIO_FRESH: FolioState = { mark: null, folded: null, next: null, warned: null, last: null, revision: null, revisions: 0, drafts: 0, folds: 0, answered: 0 };
export const folioOf = (p: Pick<BossPowerState, "folio"> | null | undefined): FolioState => p?.folio ?? FOLIO_FRESH;

// ---------------- Draft ----------------

/** The squares of `color`'s pieces attacking `sq` (chess.js's attacks: a pinned piece still attacks), sorted. */
function attackersOf(fen: string, sq: string, color: Side): string[] {
  try {
    return new Chess(fen, { skipValidation: true }).attackers(sq as Square, color).sort();
  } catch {
    return [];
  }
}

/** The squares strictly between two squares on one rank, file or diagonal (none otherwise, or side by side). */
function between(a: string, b: string): string[] {
  const df = file(b) - file(a);
  const dr = rank(b) - rank(a);
  if (!(df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr))) return [];
  const n = Math.max(Math.abs(df), Math.abs(dr));
  const out: string[] = [];
  for (let k = 1; k < n; k++) out.push(square(file(a) + Math.sign(df) * k, rank(a) + Math.sign(dr) * k));
  return out;
}

/** An attacker's worth for the Draft's rules: its value, a king counted above everything (it never takes a defended piece). */
const worth = (type: string) => (type === "k" ? 100 : VALUE[type]!);

/**
 * The Draft's mark (the crowd to move in `fen`): of the crowd's pieces (never the king, never the piece folded now:
 * `skip`) that a Folio piece attacks and that are defended, and that no cheaper Folio piece attacks (so Folio wouldn't
 * just take it: the brief's "isn't simply hanging"), the most valuable: the piece that matters most (the director's call,
 * Oct 27; it was a seeded pick of the top three), a seeded pick among those of that value. The attacker is the cheapest
 * Folio piece attacking it (ties by square); `line`, the squares between them for a bishop, rook or queen (none for a
 * knight, a pawn or a king, or side by side). Null: none qualifies.
 */
export function chooseDraft(fen: string, crowd: Side, seed: number, turn: number, skip: string | null = null): { square: string; piece: string; attacker: string; by: string; line: string[] } | null {
  const folio = other(crowd);
  const options: { square: string; piece: string; attacker: string; by: string; value: number }[] = [];
  for (let f = 0; f < 8; f++)
    for (let r = 1; r <= 8; r++) {
      const sq = square(f, r);
      const pc = pieceAt(fen, sq);
      if (!pc || pc.color !== crowd || pc.type === "k" || sq === skip) continue;
      const attackers = attackersOf(fen, sq, folio);
      if (!attackers.length || !attackersOf(fen, sq, crowd).length) continue;
      const value = VALUE[pc.type]!;
      const ranked = attackers.map((a) => ({ a, type: pieceAt(fen, a)!.type })).sort((x, y) => worth(x.type) - worth(y.type) || (x.a < y.a ? -1 : 1));
      if (ranked.some((x) => x.type !== "k" && VALUE[x.type]! < value)) continue;
      options.push({ square: sq, piece: pc.type, attacker: ranked[0]!.a, by: ranked[0]!.type, value });
    }
  if (!options.length) return null;
  options.sort((a, b) => b.value - a.value || (a.square < b.square ? -1 : 1));
  const top = options.filter((o) => o.value === options[0]!.value);
  const pick = top[Math.floor(powerRoll(seed, "draft", turn) * top.length)]!;
  const slider = pick.by === "b" || pick.by === "r" || pick.by === "q";
  return { square: pick.square, piece: pick.piece, attacker: pick.attacker, by: pick.by, line: slider ? between(pick.attacker, pick.square) : [] };
}

/**
 * The mark's attack still stands in `fen`: the crowd's marked piece on its square, the same Folio piece on the attacker's
 * square, and it attacks that square. Anything else (the piece moved or taken, the line blocked, the attacker taken or
 * moved away) has ended it.
 */
export function attackStands(fen: string, mark: NonNullable<FolioState["mark"]>, crowd: Side): boolean {
  const p = pieceAt(fen, mark.square);
  const a = pieceAt(fen, mark.attacker);
  return p?.color === crowd && p.type === mark.piece && a?.color === other(crowd) && a.type === mark.by && attackersOf(fen, mark.square, other(crowd)).includes(mark.attacker);
}

/** The piece folded on crowd turn `turn` (its square), or null. */
export function foldedOn(f: FolioState, turn: number): string | null {
  return f.folded && f.folded.at <= turn && f.folded.until >= turn ? f.folded.square : null;
}

// ---------------- Crease ----------------

/** The 14 inner lines a crease may fall on: between neighboring files ("a|b" to "g|h"), then ranks ("1|2" to "7|8"). */
export const CREASE_LINES: readonly string[] = [...[0, 1, 2, 3, 4, 5, 6].map((i) => `${FILES[i]}|${FILES[i + 1]}`), ...[1, 2, 3, 4, 5, 6, 7].map((r) => `${r}|${r + 1}`)];

/** The side of a line a square is on: 0, the a-file or first-rank side; 1, the other. */
function sideOf(line: string, sq: string): 0 | 1 {
  const c = line[0]!;
  return c >= "a" && c <= "h" ? (file(sq) <= file(`${c}1`) ? 0 : 1) : rank(sq) <= Number(c) ? 0 : 1;
}

/**
 * A move crosses the crease: a piece it moves ends on the other side of the line from where it started. Any move,
 * knights included (Sawyer's board saw's rule); castling's king, and its rook too (on a line between files the saw never
 * sat on, the rook can cross it alone: no piece of the crowd's may cross, so neither may). Never an attack: checks and
 * pins work across it as in ordinary chess. It stops the crowd's moves only (Crease.side); Folio's pieces cross freely.
 */
export function crossesCrease(move: string, line: string | null | undefined, fen?: string): boolean {
  if (!line) return false;
  const a = from(move);
  const b = to(move);
  if (sideOf(line, a) !== sideOf(line, b)) return true;
  if (fen && rank(a) === rank(b) && Math.abs(file(b) - file(a)) === 2 && pieceAt(fen, a)?.type === "k") {
    const kingside = file(b) > file(a);
    return sideOf(line, square(kingside ? 7 : 0, rank(a))) !== sideOf(line, square(kingside ? 5 : 3, rank(a)));
  }
  return false;
}

/** The legal moves the crease leaves the side to move (all of them with none). */
export function creaseMoves(fen: string, line: string | null | undefined): string[] {
  const legal = legalMoves(fen);
  return line ? legal.filter((m) => !crossesCrease(m, line, fen)) : legal;
}

/** Remembered answers of safeAfter (the guard asks about the same position for each line): a few positions, newest last. */
const SAFE = new Map<string, Map<string, boolean>>();

/** After the crowd's move `m` (the crowd to move in `fen`), Folio has no mate in one. Remembered per position. */
function safeAfter(fen: string, m: string): boolean {
  let known = SAFE.get(fen);
  if (!known) {
    known = new Map();
    SAFE.set(fen, known);
    if (SAFE.size > 16) SAFE.delete(SAFE.keys().next().value!);
  }
  let safe = known.get(m);
  if (safe === undefined) {
    safe = !matingMoves(applyMove(fen, m)).length;
    known.set(m, safe);
  }
  return safe;
}

/**
 * A line the Crease may take on this position (the crowd to move): it leaves the crowd a move, never takes away the crowd's
 * mate in one (one of its mating moves stays open), and never hands Folio one: when the crowd has a move after which Folio
 * can't mate at once, one of those stays open. (Folio's own moves are never limited, so its side needs nothing more.) Its
 * moves are looked at lazily: usually the first open move already leaves Folio no mate.
 */
export function creaseGuard(fen: string, line: string): boolean {
  try {
    if (!CREASE_LINES.includes(line)) return false;
    const open = creaseMoves(fen, line);
    if (!open.length) return false;
    const mates = matingMoves(fen);
    if (mates.length && !mates.some((m) => open.includes(m))) return false;
    if (open.some((m) => safeAfter(fen, m))) return true;
    // (No open move stops its mate: refused when a move the line takes away would have.)
    return !legalMoves(fen).some((m) => !open.includes(m) && safeAfter(fen, m));
  } catch {
    return false;
  }
}

/** The server's check of the host's line (online) or this device's (solo): a line the guard allows on this position, else null. */
export const creaseCheck = (fen: string, answer: string | null | undefined): string | null => (answer && creaseGuard(fen, answer) ? answer : null);

/** What the host's engines need to pick the line after Folio's move (the boss request's `crease`): the order ties are broken in. */
export interface CreaseAsk {
  order: number;
}

/** The side to move's best expected score (0-1), over `only` (searchmoves; all with none), at `nodes` on one engine. Null: no answer. */
async function sideBest(engine: EngineLike, fen: string, only: readonly string[] | null, nodes: number): Promise<number | null> {
  if (engine.topMovesAt) return (await engine.topMovesAt(fen, 1, nodes, only ?? undefined))[0]?.expected ?? null;
  if (!only) return (await engine.topMoves(fen, 1))[0]?.expected ?? null;
  const scored = await engine.scoreMoves(fen, only);
  return scored.length ? Math.max(...scored.map((m) => m.expected)) : null;
}

/** What a crease costs the crowd, in pawns of log-odds: its best move without it, against its best with it (crowd to move). */
export const creasePawns = (before: number, after: number, s: Pick<BossPowerSettings, "bouncePawnLogit"> = BOSS_POWERS): number => (logit(before) - logit(after)) / s.bouncePawnLogit;

/**
 * Every line the guard allows on `fen` (the crowd to move, after Folio's move), each with what it costs the crowd: its
 * best move with the line's crossings taken away against its best with every move, each searched at creaseNodes on this
 * device's engines (the host's online). Lines that take away the same moves share one search; a line no move of the
 * crowd crosses costs nothing and isn't searched. At most 15 searches. Null: no engine, or no answer for the position.
 */
export async function creaseScores(engines: readonly EngineLike[], fen: string, s: Pick<BossPowerSettings, "creaseNodes" | "bouncePawnLogit"> = BOSS_POWERS): Promise<{ line: string; loss: number }[] | null> {
  const all = legalMoves(fen);
  if (!all.length || !engines.length) return null;
  const lines = CREASE_LINES.filter((l) => creaseGuard(fen, l));
  const sets = new Map<string, string[]>();
  const keyOf = new Map<string, string>();
  for (const l of lines) {
    const ok = creaseMoves(fen, l);
    const key = ok.length === all.length ? "" : ok.join(",");
    keyOf.set(l, key);
    if (key && !sets.has(key)) sets.set(key, ok);
  }
  const keys = [...sets.keys()];
  const [before, ...after] = await eachOn(engines, ["", ...keys], (e, k) => sideBest(e, fen, k ? sets.get(k)! : null, s.creaseNodes));
  if (before === null || before === undefined) return null;
  const value = new Map(keys.map((k, i) => [k, after[i] ?? null]));
  return lines.flatMap((l) => {
    const k = keyOf.get(l)!;
    const got = k ? value.get(k) : before;
    return got === null || got === undefined ? [] : [{ line: l, loss: creasePawns(before, got, s) }];
  });
}

/**
 * The line, from the scored lines: in [creaseLossMin, creaseLossMax] nearest the band's middle; none there, the one
 * nearest creaseLossMin below it (never one costing more than creaseLossMax). Ties (lines taking away the same moves cost
 * the same) by `order`, the server's seeded roll. Null: none.
 */
export function pickCrease(scores: readonly { line: string; loss: number }[], order: number, s: Pick<BossPowerSettings, "creaseLossMin" | "creaseLossMax"> = BOSS_POWERS): { line: string; loss: number } | null {
  const lo = s.creaseLossMin;
  const hi = s.creaseLossMax;
  const band = scores.filter((x) => x.loss >= lo && x.loss <= hi);
  const pool = band.length ? band : scores.filter((x) => x.loss < lo);
  if (!pool.length) return null;
  const mid = (lo + hi) / 2;
  const dist = (x: { loss: number }) => (band.length ? Math.abs(x.loss - mid) : lo - x.loss);
  const best = Math.min(...pool.map(dist));
  const ties = pool.filter((x) => dist(x) - best <= 1e-9).sort((a, b) => (a.line < b.line ? -1 : 1));
  return ties[Math.floor(mulberry32(order >>> 0)() * ties.length)]!;
}

/** The line after Folio's move on this device's engines (the host's answer online, solo's and the sims' own), with its cost; null: none. */
export async function creasePick(engines: readonly EngineLike[], fen: string, ask: CreaseAsk, s: BossPowerSettings = BOSS_POWERS): Promise<{ line: string; loss: number } | null> {
  const scores = await creaseScores(engines, fen, s);
  return scores ? pickCrease(scores, ask.order, s) : null;
}

/**
 * What a crease costs the crowd on `fen` (the crowd to move: as it falls), by this device's first engine: its best move with
 * the line's crossings taken away against its best (the sims judge each crease where it's in force). Null: no answer.
 */
export async function creaseCost(engine: EngineLike, fen: string, line: string, s: Pick<BossPowerSettings, "creaseNodes" | "bouncePawnLogit"> = BOSS_POWERS): Promise<number | null> {
  const open = creaseMoves(fen, line);
  if (!open.length) return null;
  const before = await sideBest(engine, fen, null, s.creaseNodes);
  const after = open.length === legalMoves(fen).length ? before : await sideBest(engine, fen, open, s.creaseNodes);
  return before === null || after === null ? null : creasePawns(before, after, s);
}

/** The host's answer: the line ("" none). */
export async function creaseAnswer(engines: readonly EngineLike[], fen: string, ask: CreaseAsk): Promise<string> {
  return (await creasePick(engines, fen, ask))?.line ?? "";
}

/** The Crease holds on crowd turn `turn`. */
export const creaseOn = (p: Pick<BossPowerState, "crease"> | null | undefined, turn: number): string | null => (p?.crease && p.crease.at <= turn && p.crease.until >= turn ? p.crease.line : null);

// ---------------- Revision ----------------

/**
 * Revision's measure of a crowd move (Folio's last move came just before it, the crowd's judged score then `before`):
 * what Folio's move cost it against its best there (`cost`: the crowd's best reply's score against `before`), and how much
 * worse its judged evaluation is after the crowd's reply (`drop`), in pawns of log-odds (bouncePawnLogit). Both at least
 * revisionDrop: it comes.
 */
export function revisionMeasure(before: number, judged: Pick<JudgedMove, "best" | "played">, s: Pick<BossPowerSettings, "bouncePawnLogit" | "revisionDrop"> = BOSS_POWERS): { cost: number; drop: number; due: boolean } {
  const cost = (logit(Math.max(judged.best, judged.played)) - logit(before)) / s.bouncePawnLogit;
  const drop = (logit(judged.played) - logit(before)) / s.bouncePawnLogit;
  return { cost, drop, due: cost >= s.revisionDrop && drop >= s.revisionDrop };
}

// ---------------- Its rules ----------------

const setFolio = (b: Battle, change: (f: FolioState, p: BossPowerState) => Partial<BossPowerState>): void => {
  const boss = b.state.boss!;
  const p = boss.powers!;
  b.state = { ...b.state, boss: { ...boss, powers: { ...p, ...change(folioOf(p), p) } } };
};
const boardOf = (b: Battle) => b.boards.get(b.state.boards[0]!)!;

/** Its moments that take a crowd turn's start (the Draft waits rather than share one with them). */
const ULT_MOMENTS = new Set(["warn", "creaseWarn", "crease", "creaseEnd"]);

/**
 * Folio. The test switches: ?power=draft brings the Draft from turn 2, again every turn once a mark is gone; ?power=crease
 * warns as the second turn begins (the crease as the third does); ?power=revision brings Revision at the first crowd move
 * it may follow, whatever the evaluation says (its other rules kept).
 */
export const FOLIO: BossRules = {
  id: "folio",
  // (The test trigger waits for its move: the line comes with it.)
  triggerAtHisTurn: true,
  wearOff(next, t) {
    const f = folioOf(next);
    let g = f;
    // The fold after its turns, or once its piece is gone (Ginger's freeze's way).
    if (g.folded) {
      const pc = pieceAt(t.fen, g.folded.square);
      if (g.folded.until < t.turn || pc?.color !== t.crowd || pc.type !== g.folded.piece) g = { ...g, folded: null };
    }
    // (A mark whose attack ended, or whose last turn passed with the battle's end: the after-move checks clear it; this is the last look.)
    if (g.mark && (g.mark.until < t.turn || !attackStands(t.fen, g.mark, t.crowd))) g = { ...g, mark: null };
    if (g.next && g.next.turn < t.turn) g = { ...g, next: null };
    if (g !== f) next.folio = g;
    // The crease unfolds after its turns.
    if (next.crease && next.crease.until < t.turn) {
      t.events.push({ kind: "creaseEnd", turn: t.turn, line: next.crease.line });
      next.crease = null;
    }
  },
  // The Crease: the meter full (or the test switch) and a line picked with its move for this turn: the warning, its line
  // shown; as the next turn begins, it lands (checked again there). No line (no engine, none allowed): the warning waits,
  // and its next move asks again. The trigger: it lands now, with the line picked with its move (kept until one comes).
  ultimate(next, t) {
    const f = folioOf(next);
    const fresh = f.next && f.next.turn === t.turn ? f.next : null;
    const land = (line: string, loss: number | null): boolean => {
      next.ultAt = t.turn;
      delete next.ultNext;
      next.crease = { line, at: t.turn, until: t.turn + Math.max(1, Math.round(t.s.creaseTurns)) - 1, side: t.crowd, loss };
      next.folio = { ...f, next: null, warned: null };
      t.events.push({ kind: "crease", turn: t.turn, line });
      return true;
    };
    if (t.ultNext) return fresh && creaseGuard(t.fen, fresh.line) ? land(fresh.line, fresh.loss) : false;
    if (next.warnAt === undefined) {
      if (fresh && (meterFull(next, t) || testSwitch(t, next))) {
        next.warnAt = t.turn;
        next.folio = { ...f, next: null, warned: { line: fresh.line, loss: fresh.loss } };
        t.events.push({ kind: "warn", turn: t.turn }, { kind: "creaseWarn", turn: t.turn, line: fresh.line });
      }
      return false;
    }
    if (t.turn > next.warnAt) {
      if (f.warned) {
        // (Checked again as it falls, on the position it falls on: a line the guard now refuses doesn't land. No other line
        // comes (the crowd was shown this one): its line clears (`creaseEnd`), and the meter is spent as if it had come.)
        if (creaseGuard(t.fen, f.warned.line)) return land(f.warned.line, f.warned.loss);
        next.ultAt = t.turn;
        next.folio = { ...f, next: null, warned: null };
        t.events.push({ kind: "creaseEnd", turn: t.turn, line: f.warned.line });
        return true;
      }
      // (A warning without its line, a state no rule leaves: withdrawn, so the meter can warn again.)
      delete next.warnAt;
    }
    return false;
  },
  // While the crease holds the meter stays empty.
  ultimateRunning: (p, turn) => turn <= (p.crease?.until ?? p.ultAt!),
  // The Draft: one mark at a time; none that qualifies, a mark still up, or another moment of its own this turn: it tries
  // again next turn, and the try doesn't count.
  passive(next, t) {
    if (t.turn < next.nextPassive) return;
    const f = folioOf(next);
    const pick = f.mark || t.events.some((e) => ULT_MOMENTS.has(e.kind)) ? null : chooseDraft(t.fen, t.crowd, t.seed, t.turn, foldedOn(f, t.turn));
    if (!pick) {
      next.nextPassive = t.turn + 1;
      return;
    }
    next.folio = { ...f, mark: { ...pick, at: t.turn, until: t.turn + Math.max(1, Math.round(t.s.draftWindow)) - 1 }, drafts: f.drafts + 1 };
    t.events.push({ kind: "draft", turn: t.turn, square: pick.square, squares: [pick.attacker, ...pick.line, pick.square] });
    next.nextPassive = t.turn + (t.test === "draft" ? 1 : Math.max(1, Math.round(t.s.draftEvery)));
  },
  // A folded piece doesn't move; none of the crowd's pieces crosses the crease (the dispatcher lifts both for a turn they'd
  // leave no move, or no way out of check). Folio's own moves are never stopped: no bossStops.
  crowdFilter(allowed, boss, fen) {
    const turn = turnOf(boss);
    const folded = foldedOn(folioOf(boss.powers), turn);
    const line = creaseOn(boss.powers, turn);
    if (!folded && !line) return allowed;
    // (Castling with a folded rook is its move too: stunnedIn, Moo's rule for a stunned rook.)
    return allowed.filter((m) => !(folded && stunnedIn(fen, m, [folded])) && !crossesCrease(m, line, fen));
  },
  // (A move of the crowd's across it: the screens' words. Folio's cross it freely.)
  stopReason: (boss, fen, m) => {
    const c = boss.powers?.crease;
    return c && crossesCrease(m, c.line, fen) && pieceAt(fen, from(m))?.color === c.side ? "crease" : null;
  },
  // A turn with a folded piece or the crease doesn't count for fair play (the crossed-out turn: crossedOut).
  powerTurn: (boss) => !!creaseOn(boss.powers, turnOf(boss)) || !!foldedOn(folioOf(boss.powers), turnOf(boss)),
  // Revision's move: the engine's best at full strength.
  bestReply: (boss) => {
    const r = boss.powers?.folio?.revision;
    return !!r && r.at === boss.crowdMoves && !r.move;
  },
  afterCrowdMove(b, move, judged) {
    folioBattle.afterCrowdMove(b, move, judged ?? null);
  },
  crossedOut: (boss) => crossedOut(boss),
  afterBossMove(b, move, extras) {
    folioBattle.afterItsMove(b, move, extras?.crease ?? null, extras?.creaseLoss ?? null);
  },
  opening: { setUp: (b) => ({ nextPassive: b.settings.bossPowerTest === "draft" ? 2 : BOSS_POWERS.draftFirst, folio: FOLIO_FRESH }) },
  view: (p) => folioView(p),
};

/**
 * The crowd's move just played was crossed out by Revision (it came after it, and its move in their place is still to
 * come): its round doesn't count for fair play.
 */
export const crossedOut = (boss: Pick<BossState, "crowdMoves" | "powers">): boolean => {
  const r = boss.powers?.folio?.revision;
  return !!r && r.at === boss.crowdMoves && !r.move;
};

/** Its fields for the screens (NetBossPowers). */
export interface FolioView {
  /** The Draft's mark: the piece, the Folio piece attacking it, the squares between, its last crowd turn to answer it. */
  draft: { square: string; attacker: string; line: string[]; until: number } | null;
  /** The folded piece's square, while it's folded (none: empty). */
  folded: string[];
  /** The crease holding (its line, its turns, the side whose pieces it stops: the crowd's), or null. */
  crease: { line: string; at: number; until: number; side: Side } | null;
  /** The warning's line (shown faintly until it lands), or null. */
  creaseNext: string | null;
  /** Revision, once it has come: the crowd move it followed, the two moves crossed out and their names, its move in their place once played. */
  revision: { at: number; moves: [string, string]; sans: [string, string]; move: string | null; san: string | null } | null;
}

export function folioView(p: BossPowerState): FolioView {
  const f = folioOf(p);
  const r = f.revision;
  const folded = foldedOn(f, p.turn);
  return {
    draft: f.mark ? { square: f.mark.square, attacker: f.mark.attacker, line: [...f.mark.line], until: f.mark.until } : null,
    folded: folded ? [folded] : [],
    crease: p.crease ? { line: p.crease.line, at: p.crease.at, until: p.crease.until, side: p.crease.side } : null,
    creaseNext: f.warned?.line ?? null,
    revision: r ? { at: r.at, moves: [r.moves[0], r.moves[1]], sans: [r.sans[0], r.sans[1]], move: r.move ?? null, san: r.san ?? null } : null,
  };
}

// ---------------- Its part in the match runner ----------------

export const folioBattle = {
  /**
   * The Crease's line is wanted with its move now: as the crowd's next turn begins the warning would come (the meter full
   * by then, worked out as prepareTurn will: this crowd move's rage and its material lost so far; or the test switch), or
   * the admins' trigger is pulled. Not while one is warned, holds or the meter is held.
   */
  creaseDue(b: Battle, s: BossPowerSettings = BOSS_POWERS): boolean {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "folio" || boss.result || p.ultAt !== undefined) return false;
    if (p.ultNext) return true;
    if (p.warnAt !== undefined) return false;
    const turn = boss.crowdMoves + 1;
    if (b.settings.bossPowerTest === "crease" && turn >= 2 && !p.ults) return true;
    const moved = p.turn > 0 ? Math.max(0, turn - p.turn) : 0;
    const charge = (p.charge ?? 0) + moved * rageTick(p.judged, s);
    const lost = Math.max(p.lost, p.material - materialOf(boardOf(b).fen, other(boss.crowdSide)));
    return rageNow({ charge, lost, rageUsed: p.rageUsed }, rageSpeedOf(boss.id, s), s) >= s.rageFull;
  },

  /** What the host's engines need to pick the line after its move now (the boss request's `crease`), or null: none wanted. */
  creaseAsk(b: Battle): CreaseAsk | null {
    if (!b.bossToMove() || !folioBattle.creaseDue(b)) return null;
    const boss = b.state.boss!;
    return { order: Math.floor(powerRoll(boss.powers!.seed, "crease-order", boss.powers!.ults ?? 0, boss.crowdMoves) * 2 ** 32) };
  },

  /**
   * After the crowd's move (the start of its turn; `judged`: the judge's numbers for it, none for a move the boss played
   * for the crowd): Revision first, when its move is punished (it comes, and nothing else does); else the mark: cleared if
   * the attack has ended (answered), folded if it still stands after the crowd's last move to answer it (`fold`, while it
   * thinks).
   */
  afterCrowdMove(b: Battle, move: string | null, judged: JudgedMove | null, s: BossPowerSettings = BOSS_POWERS): void {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "folio" || !move) return;
    if (folioBattle.revise(b, judged, s)) return;
    const f = folioOf(p);
    const mark = f.mark;
    if (!mark) return;
    const board = boardOf(b);
    if (!attackStands(board.fen, mark, boss.crowdSide)) {
      setFolio(b, (g) => ({ folio: { ...g, mark: null, answered: g.answered + 1 } }));
      return;
    }
    if (boss.crowdMoves < mark.until) return;
    // (Not once the battle is over on the board or at the move cap: nothing more happens.)
    if (boss.result || boardEnd(board) !== null || boss.crowdMoves >= b.settings.bossMaxMoves) {
      setFolio(b, (g) => ({ folio: { ...g, mark: null } }));
      return;
    }
    const folded = { square: mark.square, piece: mark.piece, at: boss.crowdMoves + 1, until: boss.crowdMoves + Math.max(1, Math.round(s.foldTurns)) };
    setFolio(b, (g, q) => ({ folio: { ...g, mark: null, folded, folds: g.folds + 1 }, events: [...q.events, { kind: "fold", turn: q.turn, square: mark.square }] }));
  },

  /**
   * Revision, if it comes after the crowd's move just played: Folio's last move came just before it, from crowd turn
   * revisionFrom, once a battle (revisionMax), never after a move that ends the battle (mate, a draw on the board, the move
   * cap), the God King's move, nor when the King's strike staggered Folio's move; and by the judge's numbers its move cost it
   * revisionDrop or more and the crowd's reply found it (revisionMeasure; the test switch ?power=revision skips the numbers).
   * Then both moves are crossed out: the board goes back to the position before its move (a base at this ply: the history
   * keeps both moves), its last move is the engine's best (bestReply), and the crowd moves again. The crowd's turn still
   * counts as played (the meter, the strike's count, the move cap); its picks keep their scores, and fair play skips it
   * (crossedOut). Folio's own counts of the crowd's moves (the mark's window, a fold, the crease) don't count it: each
   * lasts one turn more. Returns whether it came.
   */
  revise(b: Battle, judged: JudgedMove | null, s: BossPowerSettings = BOSS_POWERS): boolean {
    const boss = b.state.boss!;
    const p = boss.powers!;
    const f = folioOf(p);
    const last = f.last;
    const test = b.settings.bossPowerTest === "revision";
    if (!last || f.revisions >= Math.max(0, Math.round(s.revisionMax)) || boss.crowdMoves < s.revisionFrom) return false;
    if (boss.result || boss.crowdMoves >= b.settings.bossMaxMoves || last.at !== boss.crowdMoves - 1 || last.staggered || judged?.king) return false;
    const board = boardOf(b);
    const ply = board.history.length;
    if (last.ply + 2 !== ply || board.history[last.ply] !== last.move || boardEnd(board) !== null) return false;
    let cost: number | null = null;
    let drop: number | null = null;
    if (!test) {
      if (!judged || last.before === null) return false;
      const m = revisionMeasure(last.before, judged, s);
      if (!m.due) return false;
      cost = Math.round(m.cost * 100) / 100;
      drop = Math.round(m.drop * 100) / 100;
    }
    const mine = board.history[ply - 2]!;
    const theirs = board.history[ply - 1]!;
    const sans: [string, string] = [toSan(last.fen, mine), toSan(fenAtPly(board.history, ply - 1, board.bases), theirs)];
    const evals = [...(board.evals ?? [])];
    const expected = last.before === null ? (evals[ply - 2] ?? board.expected) : 1 - last.before;
    if (evals.length > ply) evals[ply] = expected;
    // (The move that led to the position it goes back to, unless that position began the board: a base of its own.)
    const lastMove = baseAt(ply - 2, board.bases).ply === ply - 2 ? null : (board.history[ply - 3] ?? null);
    b.boards.set(board.id, { ...board, fen: last.fen, expected, lastMove, evals, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen: last.fen, from: ply - 2 }] });
    const at = boss.crowdMoves;
    const longer = <T extends { until: number } | null>(x: T): T => (x && x.until >= at ? { ...x, until: x.until + 1 } : x);
    const mark = f.mark && attackStands(last.fen, f.mark, boss.crowdSide) ? longer(f.mark) : null;
    const revision = { at, moves: [mine, theirs] as [string, string], sans, fen: last.fen, ply, cost, drop };
    setFolio(b, (g, q) => ({
      folio: { ...g, mark, folded: longer(g.folded), last: null, revision, revisions: g.revisions + 1 },
      crease: longer(q.crease ?? null),
      ...(last.before !== null ? { judged: last.before } : {}),
      events: [...q.events, { kind: "revision", turn: q.turn, moves: [mine, theirs] }],
    }));
    return true;
  },

  /**
   * After its move: what Revision needs of it (the move, the position before it, the crowd's judged score then); Revision's
   * own move filled in; the mark cleared if the move ended its attack (the attacker moved away, the marked piece taken), a
   * fold whose piece it took gone; and the Crease's line for the crowd's next turn, when one came with the move (`crease`:
   * the host's answer online, this device's in solo), checked here (creaseCheck).
   */
  afterItsMove(b: Battle, move: string, crease: string | null, creaseLoss: number | null): void {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "folio") return;
    const board = boardOf(b);
    const ply = board.history.length - 1;
    const before = fenAtPly(board.history, ply, board.bases);
    const f = folioOf(p);
    const r = f.revision && f.revision.at === boss.crowdMoves && !f.revision.move ? { ...f.revision, move, san: toSan(before, move) } : f.revision;
    // (The crowd's judged score before this move: after Revision, the one before the move it crossed out, put back then.)
    const last = { move, fen: before, ply, at: boss.crowdMoves, before: p.judged ?? null, staggered: !!b.bossLast?.staggered };
    const mark = f.mark && (from(move) === f.mark.attacker || !attackStands(board.fen, f.mark, boss.crowdSide)) ? null : f.mark;
    const folded = f.folded && to(move) === f.folded.square ? null : f.folded;
    const line = creaseCheck(board.fen, crease);
    const next = line ? { turn: boss.crowdMoves + 1, line, loss: creaseLoss } : f.next;
    setFolio(b, () => ({ folio: { ...f, revision: r, last, mark, folded, next } }));
  },
};

/** Its events for a turn (the sims and tests read them). */
export const folioEvents = (events: readonly { kind: string }[]) => events.filter((e) => ["draft", "fold", "creaseWarn", "crease", "creaseEnd", "revision"].includes(e.kind));
