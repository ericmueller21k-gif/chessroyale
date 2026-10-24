/**
 * The circus tiger (BOSS_ROSTER "tiger", TIGER_NAME; Eric, Oct 23; docs/decisions/2026-10-23-tiger-rules.md): a circus
 * tiger who hated his act and makes chess-piece balloons. He starts from the game so far, as most bosses do.
 *
 * His passive, Balloons (a real-time pump):
 * - **The cycle:** as his turn begins (the crowd's move lands: afterCrowdMove), if his nozzle is empty, a new balloon goes
 *   on it (`place`, played over his turn: it never delays his move). It blows up in balloonStages stages of
 *   balloonStageSec seconds on the battle's clock (the match runner's `clock`, as Puddles' seeds: online the server's, solo
 *   and Boss alone the page's time while it's in view; without one, a crowd move counts as seedEverySec), then waits,
 *   ready. Stage changes are drawn from the clock (the view's `at` and `ready`): no moment.
 * - **At the end of his turn** (after his move, or after his hoops cast) a balloon that was ready as his turn's work was
 *   asked for (the request for his move or his hoops: `asked`/`due`, so the host, the server and solo decide on the same
 *   balloon) lands as one of his pieces, or pops. Then the nozzle is empty until his next turn begins. One not ready then
 *   keeps blowing up and is looked at again at the end of his next turn.
 * - **What it is**, rolled as it goes on (balloonOdds): a pawn, knight, bishop, rook, a fake queen or a queen; and whether
 *   it pops (balloonPops of that shape's: a fake queen always, a queen never: about half). The shape and color come from
 *   the battle's seed and are public from the start (a fake queen is "q" everywhere); a queen's being fake and every pop
 *   (`dud`) come only from the battle's own secret (BalloonState.secret, a draw from the match's random source, never in a
 *   view, moment or request): it shows only as it pops at the end of his turn.
 * - **Where it lands, by the engine** (landFrom, the host's engines; the server checks the square with landCheck): the
 *   least valuable safe square, his gain (his evaluation after it, the crowd to move, against before it) in the shape's
 *   band (balloonBands, in the engine's units) nearest its low end; none in the band: the nearest. Hard guards
 *   (landCheck): an empty square, never one the crowd attacks, never inside a hoop, never a check either way, never a mate
 *   in one for either side, never the crowd without a move (the walls counted), never a position the engine refuses. A
 *   dud goes through every step a real balloon does until the last: a shape he can't have (a ninth pawn, more pieces than
 *   promotions could make) pops (`nine`) either way; no square the rules allow (or no answer) and either stays ready on
 *   the nozzle until the end of his next turn; then a dud pops and a real one lands.
 *
 * His ultimate, Hoops (the rage meter, `rageSpeed.tiger`):
 * - The usual warning as a crowd turn begins; at the start of his turn after it, his whole turn (passTurn, a base at its
 *   ply): hoopsCount burning hoops, each a 2x2 block (named by its corner, its lowest file and rank) within ranks 2 to 7,
 *   apart from each other (never touching, sides or corners). Ready balloons land (or pop) at the end of it, outside them.
 * - **The walls** (hoopStops), for both sides, for the crowd's next hoopsCrowdMoves moves and his move between them: no
 *   move crosses a hoop's wall, into a block or out of it, sliding or jumping (a slider can't pass through a block; a
 *   capture en passant across a wall neither); pieces inside move within their block. No capture and no attack across a
 *   wall, so no check across one: a move that would leave a king attacked across a wall isn't played (the walls only ever
 *   take moves away, so every check is one the board and the engine agree on). They go in the move lists the way Big
 *   Boy's toy blocks do (crowdFilter, bossStops: the crowd's allowed moves, the judge's and the bots', his own search's
 *   searchmoves), and lift for a turn that would have none, as every power's limit does.
 * - **Where, by the engine** (hoopsFrom, the host's engines; the server checks the answer with hoopsCheck): block by
 *   block, each the one (of up to hoopsLooks a step, seeded, the inner ranks first) that keeps his gain with the walls in
 *   force in hoopsBand, nearest hoopsTarget. Hard guards (hoopsGuard): the crowd always has a move, no mate in one for
 *   either side, no king in check. Fewer blocks fit: what fits (at least one); none, the pass guard (passLoses), or no
 *   answer: no cast this turn (the meter stays full) and he plays his move.
 */
import { BOSS_POWERS, type Balloon, type BalloonResult, type BalloonShape, type BalloonState, type BossPowerSettings, type BossPowerState, type HoopsState, type PowerEvent, type Settings } from "@chessroyale/core";
import { applyMove, attackedSquares, kingAttacked, kingAttackers, legalMoves, matingMoves, pieceAt, sideToMove, withPiece } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import { BOSS_OPENING, newBoard } from "../boards.ts";
import { stockfishRefuses } from "../uci.ts";
import { PASS_WAIT, eachOn, from, logit, meterFull, moveSquares, other, passLoses, powerRoll, testSwitch, to, unleashed, type Battle, type BossRules, type Side } from "./base.ts";
import { passTurn } from "./hollow.ts";

// ---------------- His moments ----------------

/**
 * His animations' lengths (ms; the sprite's branch, docs/decisions/2026-10-23-tiger-animations.md), for the wiring and the
 * sims: his hop to the pump, `place` (its `touch` cue at 440: the balloon is on the nozzle), his reactions; the pump's
 * stage step, pop and release; the balloon's landing on its square (`poof` cue at 0.57 of it: his piece goes on); the
 * hoops' cast (`throw1` to `throw3`) and each ring's landing and going out.
 */
export const TIGER_ANIM = {
  hop: 620,
  place: 820,
  placeTouchAt: 440,
  cheer: 720,
  bigCheer: 1160,
  wince: 780,
  hoops: 1360,
  throwsAt: [300, 580, 860],
  pumpStage: 400,
  pumpPop: 400,
  pumpRelease: 330,
  balloonLand: 790,
  ringLand: 330,
  ringOut: 400,
} as const;

/**
 * The cast beat by beat (ms into its moment, as the crowd's turn after it begins): each hoop leaves his paw at its throw
 * cue, flies to its block for `flyMs` (my call: the art's flight is a loop the wiring moves), and lands (`ringLand`). The
 * moment lasts until the last ring has landed, or his animation's end if later.
 */
export const HOOPS_BEATS = {
  throwsAt: TIGER_ANIM.throwsAt,
  flyMs: 300,
  landMs: TIGER_ANIM.ringLand,
  total: Math.max(TIGER_ANIM.hoops, TIGER_ANIM.throwsAt[2] + 300 + TIGER_ANIM.ringLand),
} as const;

/**
 * How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts): only the hoops' cast, which the server
 * waits for (Eric's brief: "the server waits for the hoops cast, not for balloons"). The balloons' moments and the hoops
 * going out play over whoever's turn it is (TIGER_ANIM has their lengths): nothing waits for them.
 */
export const TIGER_FX = { place: 0, balloonLand: 0, pop: 0, balloonCheer: 0, balloonBigCheer: 0, wince: 0, hoops: HOOPS_BEATS.total, hoopsOut: 0 } as const;

type BalloonSettings = Pick<BossPowerSettings, "balloonStages" | "balloonStageSec" | "balloonOdds" | "balloonPops" | "balloonColors">;
type LandSettings = Pick<BossPowerSettings, "balloonBands" | "balloonLooks" | "balloonNodes" | "balloonTimeMs" | "bouncePawnLogit">;
type HoopsSettings = Pick<BossPowerSettings, "hoopsCount" | "hoopsBand" | "hoopsTarget" | "hoopsLooks" | "hoopsNodes" | "hoopsTimeMs" | "bouncePawnLogit" | "passGuardPawns">;

const SQUARES: readonly string[] = [..."abcdefgh"].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`));
const isSquare = (sq: string) => SQUARES.includes(sq);

// ---------------- The walls ----------------

/** Every hoop's corner there may be (its lowest file and rank): files a to g, ranks 2 to 6, so a block stays in ranks 2 to 7. */
export const HOOP_CORNERS: readonly string[] = [..."abcdefg"].flatMap((f) => [2, 3, 4, 5, 6].map((r) => `${f}${r}`));

/** A hoop's corner is one there may be. */
export const hoopCorner = (c: string): boolean => HOOP_CORNERS.includes(c);

/** The four squares of the hoop at `corner` ("c3": c3, d3, c4, d4). */
export function hoopSquares(corner: string): string[] {
  const f = corner.charCodeAt(0);
  const r = Number(corner[1]);
  const at = (df: number, dr: number) => `${String.fromCharCode(f + df)}${r + dr}`;
  return [at(0, 0), at(1, 0), at(0, 1), at(1, 1)];
}

/** `sq` is inside the hoop at `corner`. */
export function inHoop(corner: string, sq: string): boolean {
  const df = sq.charCodeAt(0) - corner.charCodeAt(0);
  const dr = Number(sq[1]) - Number(corner[1]);
  return df >= 0 && df <= 1 && dr >= 0 && dr <= 1;
}

/** Two hoops overlap or touch (sides or corners): they must have a square between them, so their rings never cross. */
export function hoopsTouch(a: string, b: string): boolean {
  return Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) <= 2 && Math.abs(Number(a[1]) - Number(b[1])) <= 2;
}

/** A set of hoops there may be: 1 to hoopsCount, each a corner there may be, none twice, no two touching. */
export function hoopsValid(blocks: readonly string[], s: Pick<BossPowerSettings, "hoopsCount"> = BOSS_POWERS): boolean {
  if (!blocks.length || blocks.length > s.hoopsCount) return false;
  return blocks.every((c, i) => hoopCorner(c) && blocks.every((d, j) => j <= i || !hoopsTouch(c, d)));
}

/** The squares a move touches for the walls: where it starts and lands, every square it passes over, a pawn taken en passant. */
function wallSquares(move: string, fen: string): string[] {
  const out = moveSquares(move, fen);
  if (pieceAt(fen, from(move))?.type === "p" && move[0] !== move[2] && !pieceAt(fen, to(move))) out.push(`${move[2]}${move[1]}`);
  return out;
}

/** A move (or an attack, written as one) crosses a hoop's wall: of the squares it touches, some are in the block and some out. */
export function crossesHoop(move: string, fen: string, blocks: readonly string[]): boolean {
  if (!blocks.length) return false;
  const sqs = wallSquares(move, fen);
  return blocks.some((c) => {
    const ins = sqs.filter((sq) => inHoop(c, sq)).length;
    return ins > 0 && ins < sqs.length;
  });
}

/** Some piece attacks a king across a hoop's wall: an attack the walls stop (no check across them). */
export function attackAcross(fen: string, blocks: readonly string[]): boolean {
  if (!blocks.length) return false;
  return kingAttackers(fen).some((a) => crossesHoop(a, fen, blocks));
}

/**
 * A move the hoops stop, either side: it crosses a wall (into a block, out of it, through it, a capture across it), or it
 * would leave a king attacked across one. The walls stop every attack across them, so no check across them either; such
 * a move isn't played, which keeps every check one the board and the engine agree on (the walls only ever take moves
 * away: a king never stands in an attack the walls stop).
 */
export function hoopStops(move: string, fen: string, blocks: readonly string[]): boolean {
  if (!blocks.length) return false;
  if (crossesHoop(move, fen, blocks)) return true;
  return leavesAttackAcross(move, fen, blocks, null);
}

/** The kings' squares in a position. */
function kingSquares(fen: string): string[] {
  const out: string[] = [];
  fen
    .split(" ")[0]!
    .split("/")
    .forEach((row, i) => {
      let f = 0;
      for (const c of row) {
        if (c >= "1" && c <= "8") f += Number(c);
        else {
          if (c === "k" || c === "K") out.push(`${"abcdefgh"[f]}${8 - i}`);
          f++;
        }
      }
    });
  return out;
}

/** `a` and `b` share a rank, file or diagonal, or are a knight's jump apart: a piece on one could attack the other. */
function aligned(a: string, b: string): boolean {
  const df = Math.abs(a.charCodeAt(0) - b.charCodeAt(0));
  const dr = Math.abs(Number(a[1]) - Number(b[1]));
  return df === 0 || dr === 0 || df === dr || (df === 1 && dr === 2) || (df === 2 && dr === 1);
}

/**
 * The move would leave a king attacked across a wall. Only the piece moved, a line it opens (its square, a pawn taken en
 * passant) or castling can make a new attack, so a move touching no square in line with a king is looked at no further,
 * unless the position before already has an attack across a wall (`before`: known; null, worked out).
 */
function leavesAttackAcross(move: string, fen: string, blocks: readonly string[], before: boolean | null, kings: string[] = kingSquares(fen)): boolean {
  const wasAcross = before ?? attackAcross(fen, blocks);
  if (!wasAcross) {
    const touched = [...wallSquares(move, fen)];
    const castling = pieceAt(fen, from(move))?.type === "k" && Math.abs(move.charCodeAt(0) - move.charCodeAt(2)) === 2;
    const near = castling || touched.some((sq) => kings.some((k) => sq !== k && aligned(sq, k))) || kings.includes(from(move));
    if (!near) return false;
  }
  try {
    return attackAcross(applyMove(fen, move), blocks);
  } catch {
    return true;
  }
}

/** Remembered answers of hoopMoves (the screens and the match ask about the same position many times): a few, newest last. */
const WALLED = new Map<string, string[]>();

/** The legal moves the hoops leave in this position (all of them with none standing). */
export function hoopMoves(fen: string, blocks: readonly string[]): string[] {
  if (!blocks.length) return legalMoves(fen);
  const key = `${fen}|${blocks.join(",")}`;
  const known = WALLED.get(key);
  if (known) return known;
  const before = attackAcross(fen, blocks);
  const kings = kingSquares(fen);
  const moves = legalMoves(fen).filter((m) => !crossesHoop(m, fen, blocks) && !leavesAttackAcross(m, fen, blocks, before, kings));
  WALLED.set(key, moves);
  if (WALLED.size > 32) WALLED.delete(WALLED.keys().next().value!);
  return moves;
}

/**
 * The side to move has a mate in one with the walls up: a move they leave it that checkmates (no legal answer at all: a
 * check the walls alone would leave unanswered lifts them for that turn, as every power's limit does, so it's no mate).
 */
export function hoopMateInOne(fen: string, blocks: readonly string[]): boolean {
  const mates = matingMoves(fen);
  if (!mates.length || !blocks.length) return mates.length > 0;
  const open = hoopMoves(fen, blocks);
  // (The walls leaving no move lift for that turn: then every legal move counts.)
  return !open.length || mates.some((m) => open.includes(m));
}

/**
 * A position his hoops or a balloon may leave (the crowd to move, `blocks` standing): one the engine plays, neither king
 * in check (nor attacked across a wall), a move for the crowd the walls leave, and no mate in one for either side (for
 * him, were the crowd to pass), the walls counted.
 */
export function hoopsGuard(after: string, blocks: readonly string[]): boolean {
  try {
    if (stockfishRefuses(after)) return false;
    const crowd = sideToMove(after);
    if (kingAttacked(after, crowd) || kingAttacked(after, other(crowd))) return false;
    if (!hoopMoves(after, blocks).length) return false;
    if (hoopMateInOne(after, blocks)) return false;
    const his = passTurn(after);
    return !(his && hoopMateInOne(his, blocks));
  } catch {
    return false;
  }
}

// ---------------- The engine's side ----------------

/**
 * The search's own clock: the time left before its limit, and a breath between steps so no stretch of the guards' work
 * holds the page for long (a yield to the event loop once BREATH_MS has passed since the last), as Puddles' watering.
 */
interface Pace {
  over(): boolean;
  breathe(): Promise<void>;
}
const BREATH_MS = 12;
function pace(now: () => number, limitMs: number): Pace {
  const end = now() + limitMs;
  let last = now();
  return {
    over: () => now() >= end,
    async breathe() {
      if (now() - last < BREATH_MS) return;
      await new Promise((r) => setTimeout(r, 0));
      last = now();
    },
  };
}

/**
 * The side to move's expected score (0-1): its best move at `nodes` over the moves the walls leave (searchmoves), on one
 * engine. Every position of a cast or a landing, the one before it included, is searched the same way, so the gain
 * compares like with like. Null: no move, or no answer. (An engine without topMovesAt, a test's: its top move, or the best
 * of the moves the walls leave.)
 */
async function sideBest(engine: EngineLike, fen: string, blocks: readonly string[], nodes: number): Promise<number | null> {
  const all = legalMoves(fen);
  const ok = blocks.length ? hoopMoves(fen, blocks) : all;
  if (!ok.length) return null;
  const only = ok.length < all.length ? ok : undefined;
  if (engine.topMovesAt) return (await engine.topMovesAt(fen, 1, nodes, only))[0]?.expected ?? null;
  if (!only) return (await engine.topMoves(fen, 1))[0]?.expected ?? null;
  const scored = await engine.scoreMoves(fen, only);
  return scored.length ? Math.max(...scored.map((m) => m.expected)) : null;
}

/** Nearest the target within the band, else nearest the band: the smaller the better. */
const bandDistance = (g: number, band: readonly [number, number], target: number): number =>
  g >= band[0] && g <= band[1] ? Math.abs(g - target) : 1000 + (g < band[0] ? band[0] - g : g - band[1]);

// ---------------- Balloons ----------------

/** A balloon's roll: its kind (balloonOdds' keys) from the battle's seed and which balloon it is. */
type BalloonKind = keyof BossPowerSettings["balloonOdds"];
const SHAPE_OF: Record<BalloonKind, BalloonShape> = { pawn: "p", knight: "n", bishop: "b", rook: "r", fakeQueen: "q", queen: "q" };
const KINDS: readonly BalloonKind[] = ["pawn", "knight", "bishop", "rook", "fakeQueen", "queen"];
const FORCED: Record<NonNullable<Settings["bossBalloonTest"]>, BalloonKind> = { pawn: "pawn", knight: "knight", bishop: "bishop", rook: "rook", queen: "queen", fakequeen: "fakeQueen" };

/**
 * Balloon `n` of a battle: its shape as everyone sees it and its color, from the battle's seed; whether it pops when ready
 * (balloonPops of its kind's), from the battle's `secret` alone (BalloonState.secret: a fake queen's kind is the secret's,
 * not the seed's, so its shape "q" says nothing of it). `forced` (the test switch ?balloon=): that kind, never a dud but
 * the fake queen.
 */
export function rollBalloon(seed: number, secret: number, n: number, forced?: Settings["bossBalloonTest"], s: BalloonSettings = BOSS_POWERS): { kind: BalloonKind; shape: BalloonShape; dud: boolean; color: number } {
  let kind: BalloonKind;
  if (forced) kind = FORCED[forced];
  else {
    // (The shape from the seed: pawn, knight, bishop, rook or queen; a queen's being a fake one, from the secret.)
    const r = powerRoll(seed, "balloon", n) * 100;
    const o = s.balloonOdds;
    const queens = o.fakeQueen + o.queen;
    let edge = 0;
    const shown = (["pawn", "knight", "bishop", "rook"] as const).find((k) => r < (edge += o[k])) ?? "queen";
    kind = shown !== "queen" ? shown : powerRoll(secret, "balloon-queen", n) * queens < o.fakeQueen ? "fakeQueen" : "queen";
  }
  const dud = forced ? kind === "fakeQueen" : powerRoll(secret, "balloon-pop", n) * 100 < s.balloonPops[kind];
  const color = Math.floor(powerRoll(seed, "balloon-color", n) * s.balloonColors) % s.balloonColors;
  return { kind, shape: SHAPE_OF[kind], dud, color };
}

/** Which stage a balloon on the nozzle shows at clock time `now` (1 to balloonStages), and whether it's ready. */
export function balloonStage(b: Pick<Balloon, "at" | "readyAt">, now: number, s: Pick<BossPowerSettings, "balloonStages" | "balloonStageSec"> = BOSS_POWERS): { stage: number; ready: boolean } {
  const ready = now >= b.readyAt;
  const stage = Math.max(1, Math.min(s.balloonStages, 1 + Math.floor(Math.max(0, now - b.at) / (s.balloonStageSec * 1000))));
  return { stage: ready ? s.balloonStages : stage, ready };
}

/**
 * Why a balloon of this shape can't be his at all (a position the engine refuses, whatever the square): a ninth pawn, or
 * more pieces than promotions could make. Null: it can land. (`fen`: any position; `his`: his side.)
 */
export function landRefused(fen: string, shape: BalloonShape, his: Side): "nine" | null {
  const count: Record<string, number> = {};
  for (const c of fen.split(" ")[0]!) if (/[pnbrq]/i.test(c) && (c === c.toUpperCase()) === (his === "w")) count[c.toLowerCase()] = (count[c.toLowerCase()] ?? 0) + 1;
  count[shape] = (count[shape] ?? 0) + 1;
  const n = (k: string) => count[k] ?? 0;
  if (n("p") > 8) return "nine";
  const promoted = Math.max(0, n("q") - 1) + Math.max(0, n("r") - 2) + Math.max(0, n("b") - 2) + Math.max(0, n("n") - 2);
  return promoted > 8 - n("p") ? "nine" : null;
}

/** The position with his piece put on a square, the en passant square kept only while a capture there is still legal. */
function placed(fen: string, sq: string, shape: BalloonShape, his: Side): string {
  const after = withPiece(fen, sq, { color: his, type: shape });
  const parts = after.split(" ");
  const ep = parts[3];
  if (!ep || ep === "-") return after;
  const takes = legalMoves(after).some((m) => to(m) === ep && pieceAt(after, from(m))?.type === "p" && m[0] !== m[2]);
  if (takes) return after;
  parts[3] = "-";
  return parts.join(" ");
}

/**
 * His balloon of `shape` on `square`, if the rules allow it there (`fen`: the crowd to move, before it; `blocks`: the
 * hoops standing): an empty square on the board, not the en passant square, not inside a hoop, a pawn never on a first or
 * last rank, and the position after passing every guard (hoopsGuard). The position after, or null.
 */
export function landCheck(fen: string, shape: BalloonShape, square: string, blocks: readonly string[]): string | null {
  try {
    if (!isSquare(square) || pieceAt(fen, square) || fen.split(" ")[3] === square) return null;
    if (blocks.some((c) => inHoop(c, square))) return null;
    if (shape === "p" && (square[1] === "1" || square[1] === "8")) return null;
    const crowd = sideToMove(fen);
    const his = other(crowd);
    if (landRefused(fen, shape, his)) return null;
    // (Never where the crowd can take it at once: a square it attacks.)
    if (attackedSquares(fen, crowd).has(square)) return null;
    const after = placed(fen, square, shape, his);
    return hoopsGuard(after, blocks) ? after : null;
  } catch {
    return null;
  }
}

/**
 * What the host's engines (or solo's) need to land a ready balloon: its shape as everyone sees it (a fake queen's is "q":
 * the host is asked the same whether it will pop or not), the order the squares are tried in (drawn from the battle's
 * seed and the balloon), and the hoops standing for the crowd's next turn (a hoops turn: the host's own cast's instead).
 */
export interface BalloonAsk {
  shape: BalloonShape;
  order: number;
  blocks: string[];
}

/** The engines' landing for a balloon (landFrom): the square, his gain there, the squares weighed. */
export interface LandPick {
  square: string;
  gain: number;
  looks: number;
  inBand: boolean;
}

/**
 * Where his balloon lands (`fen`: the crowd to move, before it lands, after his move or his cast), on this device's engines
 * (the host's online, solo's, the sims'): up to balloonLooks squares in a seeded order, each passing every guard (landCheck:
 * never one the crowd attacks), each searched at balloonNodes (the crowd's best over the moves the walls leave), breathing
 * per square, within `limitMs` (balloonTimeMs; past it, what's searched so far). The least valuable: the one whose gain
 * (his evaluation after, against before, both the crowd to move) is in the shape's band nearest its low end; none in the
 * band, the nearest. Null: a shape he can't have, no square, no engine or no answer.
 */
export async function landFrom(
  engines: readonly EngineLike[],
  fen: string,
  ask: BalloonAsk,
  s: LandSettings = BOSS_POWERS,
  now: () => number = () => performance.now(),
  limitMs: number = s.balloonTimeMs,
): Promise<LandPick | null> {
  if (!engines.length) return null;
  const crowd = sideToMove(fen);
  const his = other(crowd);
  if (landRefused(fen, ask.shape, his)) return null;
  const p = pace(now, limitMs);
  const ranked = SQUARES.filter((sq) => !pieceAt(fen, sq))
    .map((sq) => ({ sq, k: powerRoll(ask.order, "land", sq) }))
    .sort((a, b) => a.k - b.k);
  const options: { square: string; fen: string }[] = [];
  for (const { sq } of ranked) {
    if (options.length >= s.balloonLooks || p.over()) break;
    await p.breathe();
    const after = landCheck(fen, ask.shape, sq, ask.blocks);
    if (after) options.push({ square: sq, fen: after });
  }
  if (!options.length) return null;
  const before = await sideBest(engines[0]!, fen, ask.blocks, s.balloonNodes);
  if (before === null) return null;
  const band = s.balloonBands[ask.shape];
  // (Past the time limit, the squares not yet searched are left out: what's searched so far is weighed.)
  const scores = await eachOn(engines, options, async (e, o) => (p.over() ? null : (await p.breathe(), sideBest(e, o.fen, ask.blocks, s.balloonNodes))));
  let pick: LandPick | null = null;
  options.forEach((o, i) => {
    const c = scores[i];
    if (c === null || c === undefined) return;
    const gain = (logit(1 - c) - logit(1 - before)) / s.bouncePawnLogit;
    if (!pick || bandDistance(gain, band, band[0]) < bandDistance(pick.gain, band, band[0])) pick = { square: o.square, gain, looks: options.length, inBand: gain >= band[0] && gain <= band[1] };
  });
  const got = pick as LandPick | null;
  return got ? { ...got, gain: Math.round(got.gain * 100) / 100 } : null;
}

// ---------------- Hoops: where ----------------

/** What the host's engines need to place a cast: the order its blocks are tried in (from the battle's seed and the cast). */
export interface HoopsAsk {
  order: number;
}

/** A block within ranks 3 to 6 (the inner ranks the brief prefers): its corner on rank 3, 4 or 5. */
const innerHoop = (c: string) => Number(c[1]) >= 3 && Number(c[1]) <= 5;

/**
 * The corners in the order a step tries them (`fen`: the crowd to move after the pass; `chosen`: the blocks already
 * thrown): the ones whose walls, with those already chosen, stop the most of the crowd's legal moves first (a block
 * nothing would cross changes nothing), an inner block counting HOOP_INNER moves more (the inner ranks preferred); ties
 * seeded. Cheap: no engine, only which moves cross a wall.
 */
export const HOOP_INNER = 3;
export function hoopOrder(fen: string, chosen: readonly string[], order: number, step: number): string[] {
  const moves = legalMoves(fen);
  const bite = (c: string) => moves.filter((m) => crossesHoop(m, fen, [...chosen, c])).length;
  return HOOP_CORNERS.map((c) => ({ c, k: bite(c) + (innerHoop(c) ? HOOP_INNER : 0), r: powerRoll(order, "hoop", step, c) }))
    .sort((a, b) => b.k - a.k || a.r - b.r)
    .map((x) => x.c);
}

/** The engines' cast (hoopsFrom): the blocks in throw order, the position after (the crowd to move), his gain, the blocks weighed. */
export interface HoopsPick {
  blocks: string[];
  fen: string;
  gain: number;
  looks: number;
  /** It reached hoopsTimeMs: the blocks placed so far. */
  late?: true;
}

/**
 * Where the engines throw his hoops (`fen`: him to move, before the cast), on this device's engines: block by block, up to
 * hoopsCount, each step weighing up to hoopsLooks blocks (hoopOrder: the ones that stop the most crowd moves first, apart from those already chosen, the whole set
 * passing hoopsGuard) and keeping the one whose total gain (his evaluation with the walls in force, the crowd to move,
 * against his before, him to move, in pawns of log-odds) is in hoopsBand nearest hoopsTarget, else nearest the band. At
 * most hoopsLooks x hoopsCount positions searched besides the one before, within hoopsTimeMs (its own clock, `now`; past
 * it, the blocks so far), breathing between steps. Null: no engine, no answer, he can't pass, or no block fits at all.
 */
export async function hoopsFrom(engines: readonly EngineLike[], fen: string, ask: HoopsAsk, s: HoopsSettings = BOSS_POWERS, now: () => number = () => performance.now()): Promise<HoopsPick | null> {
  const passed = passTurn(fen);
  if (!passed || !engines.length) return null;
  const p = pace(now, s.hoopsTimeMs);
  const before = await sideBest(engines[0]!, fen, [], s.hoopsNodes);
  if (before === null) return null;
  const gainOf = (crowd: number) => (logit(1 - crowd) - logit(before)) / s.bouncePawnLogit;
  const chosen: string[] = [];
  let gain: number | null = null;
  let looks = 0;
  for (let step = 0; step < s.hoopsCount && !p.over(); step++) {
    const options: string[][] = [];
    for (const c of hoopOrder(passed, chosen, ask.order, step)) {
      if (options.length >= s.hoopsLooks || p.over()) break;
      if (chosen.some((x) => hoopsTouch(x, c))) continue;
      await p.breathe();
      const blocks = [...chosen, c];
      if (hoopsGuard(passed, blocks)) options.push(blocks);
    }
    if (!options.length) break;
    looks += options.length;
    const scores = await eachOn(engines, options, async (e, blocks) => (await p.breathe(), sideBest(e, passed, blocks, s.hoopsNodes)));
    let best: { blocks: string[]; gain: number } | null = null;
    options.forEach((blocks, i) => {
      const c = scores[i];
      if (c === null || c === undefined) return;
      const g = gainOf(c);
      if (!best || bandDistance(g, s.hoopsBand, s.hoopsTarget) < bandDistance(best.gain, s.hoopsBand, s.hoopsTarget)) best = { blocks, gain: g };
    });
    const b = best as { blocks: string[]; gain: number } | null;
    if (!b) break;
    chosen.splice(0, chosen.length, ...b.blocks);
    gain = b.gain;
  }
  if (!chosen.length || gain === null) return null;
  return { blocks: chosen, fen: passed, gain: Math.round(gain * 100) / 100, looks, ...(p.over() ? { late: true as const } : {}) };
}

/** The host's answer for a cast: its blocks in throw order, and "@" and the square a ready balloon lands on after it ("c3 f5 b6 @e4"). */
export const hoopsCode = (blocks: readonly string[], land?: string | null): string => [...blocks, ...(land ? [`@${land}`] : [])].join(" ");

/**
 * The host's answer (and solo's) for a cast: hoopsFrom's blocks (hoopsCode), with a ready balloon's landing after it
 * (landFrom, on the position after the cast, its walls standing: `balloon`, the server's ask), PASS_WAIT when it would
 * lose him real material and it isn't the test switch's or the admins' trigger's (`any`: the pass guard), or "" with no
 * engine, no answer or no block that fits (no cast: he moves).
 */
export async function hoopsAnswer(
  engines: readonly EngineLike[],
  fen: string,
  ask: HoopsAsk,
  balloon: BalloonAsk | null = null,
  any = false,
  s: HoopsSettings & LandSettings = BOSS_POWERS,
  now?: () => number,
): Promise<{ answer: string; pick: HoopsPick | null; land: LandPick | null }> {
  const clock = now ?? (() => performance.now());
  const start = clock();
  const pick = await hoopsFrom(engines, fen, ask, s, clock).catch(() => null);
  if (!pick) return { answer: "", pick: null, land: null };
  if (!any && passLoses(pick.gain, s)) return { answer: PASS_WAIT, pick, land: null };
  // (The landing after it gets its own share, never past hoopsTimeMs + balloonTimeMs in all: well inside the request's timeout.)
  const left = Math.max(0, s.hoopsTimeMs + s.balloonTimeMs - (clock() - start));
  const land = balloon ? await landFrom(engines, pick.fen, { ...balloon, blocks: pick.blocks }, s, clock, Math.min(s.balloonTimeMs, left)).catch(() => null) : null;
  return { answer: hoopsCode(pick.blocks, land?.square), pick, land };
}

/**
 * A cast's answer checked against the rules (the server's check of the host's, and solo's own): 1 to hoopsCount blocks,
 * each a corner there may be, none twice, no two touching, the position after the pass passing hoopsGuard with them all
 * standing. The blocks, the position after (the crowd to move) and the balloon's square named ("@e4"; null: none; it's
 * checked as it lands), or null: not a cast.
 */
export function hoopsCheck(fen: string, answer: string, s: Pick<BossPowerSettings, "hoopsCount"> = BOSS_POWERS): { blocks: string[]; fen: string; land: string | null } | null {
  const passed = passTurn(fen);
  if (!passed) return null;
  const tokens = answer.trim().split(/\s+/).filter(Boolean);
  const blocks = tokens.filter((t) => !t.startsWith("@"));
  const lands = tokens.filter((t) => t.startsWith("@"));
  if (lands.length > 1 || !hoopsValid(blocks, s)) return null;
  if (!hoopsGuard(passed, blocks)) return null;
  return { blocks, fen: passed, land: lands[0]?.slice(1) ?? null };
}

// ---------------- His rules ----------------

const FRESH: BalloonState = { nozzle: null, last: null, placed: 0, landed: 0, popped: 0 };
/** His balloons' state (a fresh one before his first). */
export const balloonsOf = (p: Pick<BossPowerState, "balloon"> | null | undefined): BalloonState => p?.balloon ?? FRESH;
/** The hoops standing now (their corners; none: []). */
export const hoopBlocks = (p: Pick<BossPowerState, "hoops"> | null | undefined): string[] => p?.hoops?.blocks ?? [];

/** His reaction to a balloon's end: a queen landed, another piece landed, or it popped. */
export const balloonReaction = (r: Pick<BalloonResult, "outcome" | "shape">): "balloonBigCheer" | "balloonCheer" | "wince" => (r.outcome === "pop" ? "wince" : r.shape === "q" ? "balloonBigCheer" : "balloonCheer");

/**
 * The test switch ?balloon=<shape> (bossBalloonTest) starts his battle from 1.e4 d5 2.exd5 Qxd5, a pawn gone from each side,
 * so a balloon can land from his first turn: every raid starts from the starting position, and with all eight of his
 * pawns and his full set, every balloon pops (`nine`: a ninth pawn, or more pieces than promotions could make, is a
 * position the engine refuses). The crowd White moves next; the crowd Black (?side=b) has him move first.
 */
export const BALLOON_TEST_MOVES: readonly string[] = ["e2e4", "d7d5", "e4d5", "d8d5"];

/**
 * The test switches: ?power=hoops warns as the second turn begins, the cast at the start of his turn after it, its pass
 * guard off; ?balloon=<shape> and ?stage=N (Settings' bossBalloonTest, bossStageTest) force his balloons (the former from
 * BALLOON_TEST_MOVES).
 */
export const TIGER: BossRules = {
  id: "tiger",
  // Hoops: the meter full as a turn begins, its warning that turn; at the start of his turn, after the crowd's move
  // (tigerBattle.hoopsDue). The trigger (`ultNext`, kept): at the start of his next turn, without the warning.
  ultimateOnHisTurn: true,
  ultimate(next, t) {
    if (next.warnAt !== undefined || t.ultNext) return false;
    if (meterFull(next, t) || testSwitch(t, next)) {
      next.warnAt = t.turn;
      t.events.push({ kind: "warn", turn: t.turn });
    }
    return false;
  },
  // From the cast until the hoops go out: the meter held empty, no other cast.
  ultimateRunning: (p, turn) => turn <= (p.ultAt ?? 0) || !!p.hoops,
  // As the crowd's turn after his turn's end begins: his cast, then his balloon's end and his reaction.
  everyTurn(next, t) {
    const h = next.hoops;
    if (h && h.at + 1 === t.turn && next.ultAt === h.at) t.events.push({ kind: "hoops", turn: t.turn, blocks: [...h.blocks] });
    const last = next.balloon?.last;
    if (last && last.at + 1 === t.turn) {
      t.events.push(last.outcome === "land" ? { kind: "balloonLand", turn: t.turn, square: last.square!, shape: last.shape, color: last.color } : { kind: "pop", turn: t.turn, shape: last.shape, color: last.color });
      t.events.push({ kind: balloonReaction(last), turn: t.turn });
    }
  },
  // (His balloons come by the clock and his turns: afterCrowdMove, afterBossMove.)
  passive() {},
  // The walls, either side (Big Boy's toy blocks' way: the allowed moves; lifted for a turn that would have none).
  crowdFilter(allowed, boss, fen) {
    const blocks = hoopBlocks(boss.powers);
    if (!blocks.length) return allowed;
    const open = new Set(hoopMoves(fen, blocks));
    return allowed.filter((m) => open.has(m));
  },
  bossStops(boss) {
    const blocks = hoopBlocks(boss.powers);
    return blocks.length ? (m, fen) => !hoopMoves(fen, blocks).includes(m) : null;
  },
  stopReason: (boss, fen, m) => (hoopStops(m, fen, boss.powers?.hoops?.blocks ?? []) ? "hoop" : null),
  // A turn with hoops standing, and the turn a balloon landed (the board changed), don't count for fair play.
  powerTurn: (boss) => {
    const p = boss.powers;
    const last = p?.balloon?.last;
    return !!p?.hoops || (!!last && last.outcome === "land" && last.at === boss.crowdMoves);
  },
  opening: {
    setUp(b, at) {
      if (b.settings.bossBalloonTest) b.boards.set(at.boardId, newBoard(at.boardId, { ...BOSS_OPENING, moves: [...BALLOON_TEST_MOVES] }, BALLOON_TEST_MOVES.length, at.generation));
      // (The duds' secret: a draw of its own from the match's random source, kept from every device.)
      return { balloon: { ...FRESH, secret: Math.floor(b.random() * 2 ** 32) } };
    },
  },
  afterCrowdMove(b) {
    tigerBattle.afterCrowdMove(b);
  },
  afterBossMove(b, _move, extras) {
    tigerBattle.endOfTurn(b, extras?.balloon ?? null, extras?.balloonGain ?? null);
  },
  view: (p) => tigerView(p),
};

/** His fields for the screens (NetBossPowers): the balloon on the nozzle, his last balloon's end, his counts, the hoops standing. */
export interface BalloonView {
  shape: BalloonShape;
  color: number;
  /** On the battle's clock (ms): when it went on, and when it's fully blown (balloonStage: the stage every device draws). */
  at: number;
  readyAt: number;
  /** Found ready at his turn's check: it lands or pops at the end of this turn (or waits ready, no square for it). */
  ready: boolean;
}
export interface TigerView {
  balloon: BalloonView | null;
  balloonLast: Omit<BalloonResult, "n"> | null;
  balloons: { placed: number; landed: number; popped: number };
  hoops: { blocks: string[]; left: number } | null;
}

export function tigerView(p: BossPowerState): TigerView {
  const st = balloonsOf(p);
  const nz = st.nozzle;
  const last = st.last;
  return {
    balloon: nz ? { shape: nz.shape, color: nz.color, at: nz.at, readyAt: nz.readyAt, ready: !!nz.due } : null,
    balloonLast: last ? { at: last.at, outcome: last.outcome, shape: last.shape, color: last.color, square: last.square, gain: last.gain, ...(last.nine ? { nine: true as const } : {}) } : null,
    balloons: { placed: st.placed, landed: st.landed, popped: st.popped },
    hoops: p.hoops ? { blocks: [...p.hoops.blocks], left: p.hoops.left } : null,
  };
}

// ---------------- His part in the match runner ----------------

const boardOf = (b: Battle) => b.boards.get(b.state.boards[0]!)!;
const setPowers = (b: Battle, change: (p: BossPowerState) => BossPowerState): void => {
  const boss = b.state.boss!;
  b.state = { ...b.state, boss: { ...boss, powers: change(boss.powers!) } };
};

export const tigerBattle = {
  /**
   * As the crowd's move lands (the start of his turn): the hoops' count goes down, and after their last crowd move they're
   * gone (`hoopsOut`); then, if his nozzle is empty, a new balloon goes on it (`place`), rolled from the battle's seed, at
   * the battle's clock now (the test switch's stage: put on that many stages blown). Not once the battle is over.
   */
  afterCrowdMove(b: Battle, s: BalloonSettings = BOSS_POWERS): void {
    const boss = b.state.boss;
    const p0 = boss?.powers;
    if (!boss || !p0 || boss.id !== "tiger") return;
    let p = p0;
    const events: PowerEvent[] = [...p.events];
    if (p.hoops) {
      const left = p.hoops.left - 1;
      if (left > 0) p = { ...p, hoops: { ...p.hoops, left } };
      else {
        events.push({ kind: "hoopsOut", turn: p.turn, blocks: [...p.hoops.blocks] });
        p = { ...p, hoops: null };
      }
    }
    const st = balloonsOf(p);
    if (!st.nozzle && !boss.result && b.bossToMove() && boss.crowdMoves < b.settings.bossMaxMoves) {
      const roll = rollBalloon(p.seed, st.secret ?? Math.imul(p.seed ^ 0x5bd1e995, 0x01000193) >>> 0, st.placed, b.settings.bossBalloonTest, s);
      const stageMs = s.balloonStageSec * 1000;
      const ahead = Math.max(0, Math.min(s.balloonStages, Math.round(b.settings.bossStageTest ?? 0)));
      const at = b.now() - ahead * stageMs;
      const nozzle: Balloon = { n: st.placed, shape: roll.shape, dud: roll.dud, color: roll.color, at, readyAt: at + s.balloonStages * stageMs };
      events.push({ kind: "place", turn: p.turn, shape: roll.shape, color: roll.color });
      p = { ...p, balloon: { ...st, nozzle, placed: st.placed + 1 } };
    }
    if (p !== p0) setPowers(b, () => ({ ...p, events }));
  },

  /**
   * His turn's check of the balloon, decided once a turn, as the request for his move (or his cast) goes out: whether the
   * balloon on the nozzle is ready on the battle's clock now (`due`: it lands or pops at the end of this turn). Then
   * what the engines need to land it (the same ask for one that will pop: the host learns nothing), or null: none due.
   */
  balloonAsk(b: Battle): BalloonAsk | null {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "tiger" || boss.result || !b.bossToMove()) return null;
    const st = balloonsOf(p);
    let nz = st.nozzle;
    if (!nz) return null;
    if (nz.asked !== boss.crowdMoves) {
      nz = { ...nz, asked: boss.crowdMoves, due: b.now() >= nz.readyAt };
      const next = nz;
      setPowers(b, (q) => ({ ...q, balloon: { ...balloonsOf(q), nozzle: next } }));
    }
    if (!nz.due) return null;
    return { shape: nz.shape, order: Math.floor(powerRoll(p.seed, "land-order", nz.n) * 2 ** 32), blocks: hoopBlocks(p) };
  },

  /**
   * The end of his turn (after his move, or his cast): a balloon due now (balloonAsk; asked now if it wasn't) pops if he
   * can't have its shape (`nine`, dud or not). Else `square` (the host's answer online, this device's in solo) must be one
   * the rules allow (landCheck), dud or not: none, or one refused, and it stays ready on the nozzle, looked at again at the
   * end of his next turn. Then a dud pops and a real one lands there (a base at its ply), the nozzle empty after either. The crowd's turn's moments
   * (`balloonLand` or `pop`, then his reaction) play as it begins.
   */
  endOfTurn(b: Battle, square: string | null, gain: number | null): BalloonResult | null {
    const boss = b.state.boss;
    if (!boss?.powers || boss.id !== "tiger" || boss.result) return null;
    const nz0 = balloonsOf(boss.powers).nozzle;
    if (!nz0) return null;
    // (Not asked for this turn (a move applied directly, a test's): decided now.)
    if (nz0.asked !== boss.crowdMoves) {
      const boss2 = b.state.boss!;
      const nz = { ...nz0, asked: boss2.crowdMoves, due: b.now() >= nz0.readyAt };
      setPowers(b, (q) => ({ ...q, balloon: { ...balloonsOf(q), nozzle: nz } }));
    }
    const p = b.state.boss!.powers!;
    const st = balloonsOf(p);
    const nz = st.nozzle!;
    if (!nz.due) return null;
    const board = boardOf(b);
    const fen = board.fen;
    const his = other(boss.crowdSide);
    // (The battle is over on the board: nothing more happens.)
    if (sideToMove(fen) !== boss.crowdSide || !legalMoves(fen).length) return null;
    const blocks = hoopBlocks(p);
    const base = { at: boss.crowdMoves, n: nz.n, shape: nz.shape, color: nz.color };
    // (The same steps for a dud and a real balloon until the very last, so nothing before a pop tells them apart: a shape
    // he can't have pops either way (`nine`); no square the rules allow, and either waits; then a dud pops, a real one lands.)
    let result: BalloonResult;
    if (landRefused(fen, nz.shape, his)) result = { ...base, outcome: "pop", square: null, gain: null, nine: true };
    else {
      const after = square ? landCheck(fen, nz.shape, square, blocks) : null;
      if (!after || !square) return null;
      if (nz.dud) result = { ...base, outcome: "pop", square: null, gain: null };
      else {
        const id = b.state.boards[0]!;
        const ply = board.history.length;
        b.boards.set(id, { ...board, fen: after, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen: after }] });
        result = { ...base, outcome: "land", square, gain };
      }
    }
    setPowers(b, (q) => {
      const s2 = balloonsOf(q);
      return { ...q, balloon: { ...s2, nozzle: null, last: result, landed: s2.landed + (result.outcome === "land" ? 1 : 0), popped: s2.popped + (result.outcome === "pop" ? 1 : 0) } };
    });
    return result;
  },

  /**
   * His hoops are due: the start of his turn (the crowd has just moved) from the turn the meter warned, or after the
   * admins' trigger; none standing; not already waiting after this crowd move; and he can pass (not in check).
   */
  hoopsDue(b: Battle): boolean {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "tiger" || boss.result || !b.bossToMove() || b.finalGameOver()) return false;
    if (p.ultAt !== undefined || p.hoops) return false;
    if (!p.ultNext && !(p.warnAt !== undefined && p.warnAt <= boss.crowdMoves)) return false;
    if (p.hoopsWait === boss.crowdMoves) return false;
    return passTurn(boardOf(b).fen) !== null;
  },

  /** What the host's engines need to place the cast (the boss request's `hoops`), or null when none is due. */
  hoopsAsk(b: Battle): HoopsAsk | null {
    if (!tigerBattle.hoopsDue(b)) return null;
    const p = b.state.boss!.powers!;
    return { order: Math.floor(powerRoll(p.seed, "hoops-order", p.ults ?? 0, b.state.boss!.crowdMoves) * 2 ** 32) };
  },

  /** It comes even when it would lose him real material: the test switch's first cast, or the admins' trigger. */
  hoopsAny(b: Battle): boolean {
    const p = b.state.boss?.powers;
    return !!p && (!!p.ultNext || (b.settings.bossPowerTest === "hoops" && !p.ults));
  },

  /** The cast from this device's engines (solo, the sims): hoopsAnswer (with a due balloon's landing), then apply. */
  async play(b: Battle, engines: readonly EngineLike[]): Promise<HoopsState | null> {
    const ask = tigerBattle.hoopsAsk(b);
    if (!ask) return null;
    const balloon = tigerBattle.balloonAsk(b);
    const { answer, pick, land } = await hoopsAnswer(engines, boardOf(b).fen, ask, balloon, tigerBattle.hoopsAny(b));
    return tigerBattle.apply(b, answer, pick?.gain ?? null, land?.gain ?? null);
  },

  /**
   * The cast (online the host's answer): checked (hoopsCheck); PASS_WAIT, "", or anything that isn't a cast: none now (it
   * waits for his next turn, the warning and the trigger staying), and he plays his move. Else his whole turn: the
   * position (a base at its ply), the turn passed to the crowd, the hoops standing for hoopsCrowdMoves crowd moves, the
   * rage meter spent; then a due balloon's end (landing outside the hoops), and the crowd's turn set up as after his move
   * (its moments play as it begins). Returns the hoops; null when none was due, or it waits.
   */
  apply(b: Battle, answer: string | null, gain: number | null = null, landGain: number | null = null, s: Pick<BossPowerSettings, "hoopsCrowdMoves" | "hoopsCount"> = BOSS_POWERS): HoopsState | null {
    if (!tigerBattle.hoopsDue(b)) return null;
    const boss = b.state.boss!;
    const checked = answer && answer !== PASS_WAIT ? hoopsCheck(boardOf(b).fen, answer, s) : null;
    if (!checked) {
      setPowers(b, (p) => ({ ...p, hoopsWait: boss.crowdMoves }));
      return null;
    }
    const board = boardOf(b);
    const id = b.state.boards[0]!;
    const ply = board.history.length;
    b.boards.set(id, { ...board, fen: checked.fen, expected: 1 - board.expected, lastMove: null, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen: checked.fen }] });
    b.bossLast = null;
    const hoops: HoopsState = { blocks: checked.blocks, at: boss.crowdMoves, left: Math.max(1, Math.round(s.hoopsCrowdMoves)), gain };
    const { ultNext: _trigger, hoopsWait: _wait, ...p } = boss.powers!;
    b.state = { ...b.state, boss: { ...boss, powers: unleashed({ ...p, ultAt: boss.crowdMoves, hoops }) } };
    tigerBattle.endOfTurn(b, checked.land, landGain);
    b.bossPassed();
    return hoops;
  },
};

/** His events for a turn (the sims and tests read them). */
export const tigerEvents = (events: readonly PowerEvent[]) =>
  events.filter((e) => e.kind === "place" || e.kind === "balloonLand" || e.kind === "pop" || e.kind === "balloonCheer" || e.kind === "balloonBigCheer" || e.kind === "wince" || e.kind === "hoops" || e.kind === "hoopsOut");
