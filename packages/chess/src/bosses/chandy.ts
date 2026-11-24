/**
 * Chandy, the special-ops alligator whose energy rifle grows (BOSS_ROSTER "chandy"; Eric's design, Nov 15-16: DESIGN.md on branch
 * stills/boss-chandy, rounds 1, 2, 2b and 2c; docs/decisions/2026-11-16-chandy-rules.md). He starts from the game so far, as most
 * bosses do. Every pick below comes from the battle's seed and the position, the same on the server, solo and every screen.
 *
 * **Lock-on** (his passive, L1-L6):
 * - **His first two captures teach it** (Eric, Nov 16: "the first piece of the game that he captures is always marked first"; Nov 18:
 *   "for the 1st and 2nd capture he should apply the same thing where he locks onto the 2nd piece he captures right beforehand"): no
 *   lock comes before them. On each move where he takes one of your pieces, the first and the second (chandy.teachCaptures; his
 *   engine's own moves, never steered; any piece but the king, your queen too), the crosshair locks onto that piece right before he
 *   takes it (`lockOn` with `first`, while he still thinks: firstLock, called with his move before it shows), he points, then the
 *   capture lands: upgrades 1 and 2 (`marked` counts them; `taught` once they're done).
 * - **Then he hunts** (from the third capture on): at the end of each of his turns he locks your most capturable piece (lockOrder: free to take, then
 *   under-defended, then pinned or trapped with a move of his that attacks it; ties the more valuable, then the seed; nothing fits:
 *   the least defended), at most chandy.maxLocks, a second once the first is chandy.secondAfter of his turns old. A lock hunts for
 *   chandy.huntTurns of his turns; still gettable then (free or under-defended), it lives on to chandy.liveTurns. Never the king or
 *   the queen; a locked pawn that promotes to a queen is dropped.
 * - **The steering (L3):** of his engine's top chandy.lockLines moves (the search his move already makes), one taking a locked piece
 *   within chandy.takeMargin pawns of his best is played (the best such); else one attacking a locked piece or adding an attacker
 *   within chandy.chaseMargin (his own pick if it does). Only on his ordinary moves (not the King's strike, a slip or a power's
 *   engine-best reply). Online the host steers with the request's `lock` (steerPick), the same function as here.
 * - **Upgrades:** only taking a locked piece upgrades the rifle (to chandy.upgradesMax); each unlocks one of his five moves at
 *   random, the queen lock first while it could come right then (you have a queen, or with none it can aim at a rook, it can aim at:
 *   queenLockAim, Nov 19; chandy.queenLockFirst;
 *   Eric, Nov 18: "make that upgrade happen earlier"; unlockPick) (the rifle's parts come in a fixed order: the art's), shown in the
 *   upgrade window as your turn begins (`upgrade`, 2 s, the clock held). After the fifth: no window.
 * - **A new unlock fires at once** (chandy.fireOnUnlock; Eric, Nov 16): on his turn after its upgrade window, whatever his meter
 *   says (it starts over from empty once the move fires); a queen lock that can't come then (queenLockOk) waits for the meter.
 *
 * **The move meter** (from the first upgrade): one of your moves a notch, full at chandy.meterEvery. Full as his turn begins, he
 * picks a move (meterOrder): the newest unlock first, never the one he fired last while another can come, then the ones he has fired
 * the fewest times, ties at random (the queen lock only when it can come; Eric, Nov 18). A pick that can't land takes the next in
 * that order that can. The queen lock is
 * his whole turn, at once (the pass guard may refuse it: the meter picks another unlocked move; none: it stays due, checked again on his
 * next turn, the pass guard's own rule); the others land as your next turn begins, after his move:
 * - **Scatter shot** (`scatterShot`): a spot with at least four empty squares round it; four of them blocked through your turn and
 *   his move after it, as Boingo's pies (nobody lands on one; a slide passes through), the ones taking away the most of your moves.
 * - **Beam** (`beam`): a rank and a file, never your king's, the pair holding the most of your pieces; for your turn its squares
 *   are walls (Big Boy's rule: nothing lands on or slides through; a knight jumps) and your pieces in it are held. The chess is the
 *   same: they still block, defend and check. The screens cover the squares.
 * - **Shields** (`shields`): two of his pieces you attack (else his two most valuable), never his king or a piece giving check: your
 *   pieces can't take them on your turn (Don Dough's gold rule, every piece, one turn).
 * - **Rapid fire** (`rapidFire`): three of your pieces with a move, at random, never the king: held for your turn (Moo's stun).
 * - **Queen lock** (`queenAim`, then `queenShot`): only when you have a queen and a move that leaves a pawn, knight or bishop
 *   between her and his edge on her file (queenLockAim); with no queen it can aim at, your best rook with such a move (Eric, Nov 19:
 *   "yes on chandy good idea"; lockRank's most gettable, ties by the seed). He spends his turn aiming; your move is free; at the
 *   start of his next turn he fires straight down the file the target stands on then: the first of your pieces from his edge
 *   shatters (the target, if none is in the way); your king in the way stops it; his own pieces don't. A shot that would leave your king attacked with him to move, or
 *   hand him a promotion for his next move, fizzles.
 * A power never leaves you without a legal move: the dispatcher lifts the turn's limits if it would.
 *
 * **Dodge** (his ultimate, once a battle: maxUltimates.chandy; Eric, Nov 16): his rage meter (his own: dodgeMeter) is dimmed until the
 * fifth upgrade, then fills over chandy.dodgeAfterMoves of your moves (nothing else fills or drains it); full, the usual warning, then
 * as your next turn begins Dodge (the crowd's turn waits for it: dodgeDue). **Last chance:** as your turn begins, if he hasn't used
 * it and you have a move that mates him (mateOpen), Dodge comes now, its warning with it, whatever his rifle or meter (on a shared
 * floor too, whichever boss moved last, the others' ultimates waiting: ultimateNow; the side's limits asked); the board
 * comes back after it and you may still play the mate. On a blank board, your king in the middle of the 3 x 3 round e4 (White) or e5
 * (Black): first the warning volley (Eric, Nov 16): the clones fire once on lines that miss your king (dodgeVolley), no vote, then
 * "Dodge the next one!". Then three rounds: four clones, two on rank lines and two on file lines, leave exactly one square safe
 * (dodgeRounds); they teleport chandy.dodgeTeleports' times into the vote, each one shifting the safe square a step. The crowd votes
 * the king's square (the most votes; ties and nobody voting: from the seed); the beams travel from the clones and hold; on the safe
 * square, DODGED; anywhere else a hit. chandy.dodgeHits hits lose (`dodgeWin`; the God King's Last Stand doesn't apply): the first
 * cracks your king and play goes on, the second ends the battle. The board comes back as it was: Dodge never changes the position.
 *
 * Test switches (solo): `?power=lockon` (until his captures have taught it, his move takes a piece of yours whenever one nets him no loss:
 * testCapture), `?power=dodge` (all five upgrades at the start, the
 * warning as the second turn begins), `?power=scatter|beam|shields|rapidfire|queenlock` (that move unlocked from the start, his
 * meter full after every move of yours).
 */
import { BOSS_POWERS, CHANDY_MOVES, type BossPowerSettings, type BossPowerState, type BossState, type ChandyDodge, type ChandyLock, type ChandyMove, type ChandyState, type DodgeLine, type DodgeResult, type DodgeRound, type PowerEvent } from "@chessroyale/core";
import { Chess, type Square } from "chess.js";
import type { BoardState } from "../boards.ts";
import { applyMove, attackedSquares, exchangeNet, fenAtPly, kingAttacked, legalMoves, matingMoves, pieceAt, sideToMove, withoutPiece } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import type { MoveScore } from "../uci.ts";
import { PASS_WAIT, VALUE, from, logit, other, powerRoll, testSwitch, to, turnOf, type Battle, type BossRules, type Side, type StopFields, type TurnContext } from "./base.ts";
import { heldIn, marksStop, type LayerMarks, type PieceMark, type SquareMark } from "../board-layer.ts";
import { lands } from "./boingo.ts";
import { passTurn } from "./hollow.ts";
import { castAnswer } from "./hopper.ts";

type ChandySettings = BossPowerSettings["chandy"];
type SteerSettings = Pick<BossPowerSettings, "chandy" | "bouncePawnLogit">;

// ---------------- His moments ----------------

/**
 * How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts, so the server waits for them): the art's lengths
 * (packages/app/src/characters/effects/chandy.ts; an app test keeps them the same). A lock's crosshair snapping on and his point;
 * the upgrade window (Eric: 2 s, everything paused); each move's shot and what it leaves; the queen lock's aim, and its shot at the
 * start of his next turn. Dodge plays on a screen of its own (dodgeTimeline), and its hit ends the battle.
 */
/** When his shot fires in a move's moment (ms): his `fire` animation's cue (the art's: unsling, aim, fire at 520 ms). */
export const CHANDY_FIRE_AT = 520;

export const CHANDY_FX = {
  lockOn: 900,
  upgrade: BOSS_POWERS.chandy.upgradeMs,
  scatterShot: 1300,
  beam: 1300,
  shields: 1100,
  rapidFire: 1400,
  queenAim: 1100,
  queenShot: 1400,
  dodge: 0,
  dodgeWin: 0,
} as const;

// ---------------- His state ----------------

const FRESH: ChandyState = { moves: 0, locks: [], upgrades: 0, unlocked: [], meter: 0, used: 0 };

/** His state (a fresh one before his battle has set it up). */
export const chandyOf = (p: Pick<BossPowerState, "chandy"> | null | undefined): ChandyState => p?.chandy ?? FRESH;

const setChandy = (b: Battle, change: (c: ChandyState) => ChandyState, events: PowerEvent[] = []): void => {
  const boss = b.state.boss!;
  const p = boss.powers!;
  b.state = { ...b.state, boss: { ...boss, powers: { ...p, chandy: change(chandyOf(p)), ...(events.length ? { events: [...p.events, ...events] } : {}) } } };
};

const boardOf = (b: Battle) => b.boards.get(b.state.boards[0]!)!;

/** The board changed outside a move (a piece shattered, a turn passed): the new position, a base at its ply. */
function setBoard(b: Battle, fen: string): void {
  const id = b.state.boards[0]!;
  const board = boardOf(b);
  const ply = board.history.length;
  b.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen }] });
}

/** The position before the board's newest move. */
const fenBeforeLast = (board: BoardState): string | null => (board.history.length ? fenAtPly(board.history, board.history.length - 1, board.bases) : null);

/** A seeded order of `items` (each by its roll for `tag`): the same everywhere. */
function seeded<T>(items: readonly T[], seed: number, key: (x: T) => string, ...tag: (string | number)[]): T[] {
  return items
    .map((x) => ({ x, r: powerRoll(seed, ...tag, key(x)) }))
    .sort((a, b) => a.r - b.r || (key(a.x) < key(b.x) ? -1 : 1))
    .map((y) => y.x);
}

/** A pick from the top `n` (ranked best first) by the seed. */
function pickTop<T>(ranked: readonly T[], n: number, seed: number, ...tag: (string | number)[]): T | null {
  const top = ranked.slice(0, Math.max(1, n));
  return top.length ? top[Math.floor(powerRoll(seed, ...tag) * top.length)]! : null;
}

/** An effect of crowd turn `turn` (null otherwise). */
const on = <T extends { turn: number }>(x: T | null | undefined, turn: number): T | null => (x && x.turn === turn ? x : null);

// ---------------- The board's squares ----------------

const FILES = "abcdefgh";
const sqOf = (f: number, r: number) => `${FILES[f]}${r + 1}`;
const fileIx = (sq: string) => sq.charCodeAt(0) - 97;
const rankIx = (sq: string) => Number(sq[1]) - 1;

/** Every square holding a piece of `side`, with its letter. */
function piecesOf(fen: string, side: Side): { square: string; type: string }[] {
  const out: { square: string; type: string }[] = [];
  fen
    .split(" ")[0]!
    .split("/")
    .forEach((row, i) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) f += Number(ch);
        else {
          if ((ch === ch.toUpperCase()) === (side === "w")) out.push({ square: sqOf(f, 7 - i), type: ch.toLowerCase() });
          f++;
        }
      }
    });
  return out;
}

const kingOf = (fen: string, side: Side): string | null => piecesOf(fen, side).find((p) => p.type === "k")?.square ?? null;

/** A position read once by chess.js, for counting attacks on many squares (whoever is to move). */
function boardFor(fen: string): Chess | null {
  try {
    return new Chess(fen, { skipValidation: true });
  } catch {
    return null;
  }
}

/** The pieces of `by` attacking `square` (whoever stands there, whoever is to move), as chess.js counts attacks. */
function attackersOf(board: Chess | null, square: string, by: Side): string[] {
  try {
    return board ? board.attackers(square as Square, by) : [];
  } catch {
    return [];
  }
}

/** The square a move takes a piece on (en passant: the pawn beside it), or null: it takes nothing. */
export function capturedSquare(fen: string, move: string): string | null {
  const mover = pieceAt(fen, from(move));
  const there = pieceAt(fen, to(move));
  if (there && mover && there.color !== mover.color) return to(move);
  const ep = fen.split(" ")[3];
  if (mover?.type === "p" && ep && ep !== "-" && to(move) === ep && from(move)[0] !== to(move)[0]) return `${to(move)[0]}${from(move)[1]}`;
  return null;
}

/** The position with `side` to move (the en passant square cleared), whatever it says: for counting `side`'s moves. */
function withMover(fen: string, side: Side): string {
  const f = fen.split(" ");
  if (f[1] === side) return fen;
  f[1] = side;
  f[3] = "-";
  return f.join(" ");
}

// ---------------- The locks ----------------

/**
 * How gettable a piece of the crowd's on `square` is for him now (L2): 3 free to take (attacked and undefended, or attacked by
 * something worth less); 2 under-defended (more of his attackers than its defenders); 1 pinned or trapped (fewer than 2 of its moves
 * to squares he doesn't attack) with a move of his that attacks it; 0 none of these. `board` and `hits` (the squares he attacks):
 * the position read once, for many squares.
 */
export function lockRank(fen: string, square: string, crowd: Side, board: Chess | null = boardFor(fen), hits: ReadonlySet<string> = attackedSquares(fen, other(crowd))): number {
  const piece = pieceAt(fen, square);
  if (!piece || piece.color !== crowd) return 0;
  const his = other(crowd);
  const atk = attackersOf(board, square, his);
  const def = attackersOf(board, square, crowd);
  const value = VALUE[piece.type]!;
  const cheaper = atk.some((a) => {
    const t = pieceAt(fen, a)?.type;
    return !!t && t !== "k" && VALUE[t]! < value;
  });
  if (atk.length && (!def.length || cheaper)) return 3;
  if (atk.length > def.length) return 2;
  // (Pinned or trapped: its own moves, the crowd to move, to squares he doesn't attack.)
  try {
    let safe = 0;
    for (const m of legalMoves(withMover(fen, crowd))) if (from(m) === square && !hits.has(to(m))) safe++;
    if (safe >= 2) return 0;
    // (A move of his that attacks it.)
    const hisFen = withMover(fen, his);
    for (const m of legalMoves(hisFen)) if (to(m) !== square && attackersOf(boardFor(applyMove(hisFen, m)), square, his).includes(to(m))) return 1;
  } catch {
    return 0;
  }
  return 0;
}

/**
 * The crowd's pieces he may lock (never the king or queen, nor `skip`), most capturable first (lockRank), among equals one he can take
 * now by a trade within chandy.huntLoss first (huntable: Nov 24, the hunt), then the more valuable, then the seed; the ones nothing
 * fits (rank 0) by their defenders, fewest first (Q5: nothing fits, the least defended anyway).
 */
export function lockOrder(fen: string, crowd: Side, seed: number, n: number, skip: readonly string[] = [], s: Pick<ChandySettings, "huntLoss"> = BOSS_POWERS.chandy): string[] {
  const board = boardFor(fen);
  const hits = attackedSquares(fen, other(crowd));
  const nets = takeNets(fen, crowd);
  const rolled = piecesOf(fen, crowd)
    .filter((p) => p.type !== "k" && p.type !== "q" && !skip.includes(p.square))
    .map((p) => ({ ...p, rank: lockRank(fen, p.square, crowd, board, hits), hunt: huntable(fen, p.square, crowd, s, nets) ? 1 : 0, def: attackersOf(board, p.square, crowd).length, roll: powerRoll(seed, "lock", n, p.square) }));
  return rolled.sort((a, b) => b.rank - a.rank || b.hunt - a.hunt || (a.rank === 0 ? a.def - b.def : 0) || VALUE[b.type]! - VALUE[a.type]! || a.roll - b.roll || (a.square < b.square ? -1 : 1)).map((p) => p.square);
}

/**
 * His best take of each of the crowd's pieces he can capture (read with him to move, whoever `fen` says is; his moves listed once): its
 * square → the capture of it netting him the most by the exchange check (pawns: what it takes, less the most the crowd can take back).
 */
export function takeNets(fen: string, crowd: Side): Map<string, number> {
  const his = withMover(fen, other(crowd));
  const out = new Map<string, number>();
  try {
    for (const m of legalMoves(his)) {
      const sq = capturedSquare(his, m);
      if (!sq || pieceAt(his, sq)?.color !== crowd) continue;
      const net = exchangeNet(his, m);
      if (net !== null && net > (out.get(sq) ?? -Infinity)) out.set(sq, net);
    }
  } catch {
    return out;
  }
  return out;
}

/**
 * He can take the crowd's piece on `square` by a trade netting him at least −chandy.huntLoss pawns (the hunt's reach, Nov 24; `nets`:
 * takeNets of the position, when it's at hand).
 */
export function huntable(fen: string, square: string, crowd: Side, s: Pick<ChandySettings, "huntLoss"> = BOSS_POWERS.chandy, nets: ReadonlyMap<string, number> = takeNets(fen, crowd)): boolean {
  const net = nets.get(square);
  return net !== undefined && net >= -s.huntLoss - 1e-9;
}

/**
 * The hunt's captures (`fen`: him to move; Eric, Nov 24: "if it's like a decent trade, but maybe slightly negative, he still targets
 * it"): his moves among `allowed` taking a locked piece by a trade that nets him at least −chandy.huntLoss pawns by the exchange check,
 * which counts the crowd's best capture back anywhere (so never one that hangs his queen). His engine scores them against his best
 * (steerPick: within chandy.takeMargin, never into a mate).
 */
export function huntTakes(fen: string, locks: readonly string[], allowed: readonly string[] | null = null, s: Pick<ChandySettings, "huntLoss"> = BOSS_POWERS.chandy): string[] {
  if (!locks.length) return [];
  return (allowed ?? legalMoves(fen)).filter((m) => {
    if (!locks.includes(capturedSquare(fen, m) ?? "")) return false;
    const net = exchangeNet(fen, m);
    return net !== null && net >= -s.huntLoss - 1e-9;
  });
}

/**
 * The test switch's capture (`?power=lockon`; `fen`: him to move): until his captures have taught it, a capture of a piece of yours (never
 * the king) that nets him no loss by the exchange check, the one netting most, then the more valuable, then the seed; null: none.
 */
export function testCapture(fen: string, crowd: Side, seed: number, allowed: readonly string[] | null = null): string | null {
  if (sideToMove(fen) !== other(crowd)) return null;
  const ranked: { m: string; net: number; value: number; roll: number }[] = [];
  for (const m of allowed ?? legalMoves(fen)) {
    const sq = capturedSquare(fen, m);
    const victim = sq ? pieceAt(fen, sq) : null;
    if (!sq || !victim || victim.color !== crowd || victim.type === "k") continue;
    const net = exchangeNet(fen, m);
    if (net === null || net < 0) continue;
    ranked.push({ m, net, value: VALUE[victim.type]!, roll: powerRoll(seed, "test-capture", m) });
  }
  ranked.sort((a, b) => b.net - a.net || b.value - a.value || a.roll - b.roll || (a.m < b.m ? -1 : 1));
  return ranked[0]?.m ?? null;
}

/** A lock's age (his moves since it came). */
export const lockAge = (c: Pick<ChandyState, "moves">, l: Pick<ChandyLock, "at">): number => c.moves - l.at;

/** A lock's turns left on its crosshair (L6: 3, 2, 1): its hunt's, then (still gettable) its life's; the Lock-on Shot's, 1 (it fires next). */
export function lockLeft(c: Pick<ChandyState, "moves">, l: Pick<ChandyLock, "at" | "shot">, s: Pick<ChandySettings, "huntTurns" | "liveTurns"> = BOSS_POWERS.chandy): number {
  if (l.shot) return 1;
  const age = lockAge(c, l);
  return Math.max(1, age < s.huntTurns ? s.huntTurns - age : s.liveTurns - age);
}

/**
 * A lock that ends now (`fen`: the crowd to move): its piece gone or changed, too old, or past its hunt and no longer gettable (nor
 * huntable: a trade within chandy.huntLoss keeps it, Nov 24). `relock` (the hunt, Nov 24: "re-locks the next most gettable piece when
 * one escapes"): another of the crowd's pieces is huntable now, so a lock whose piece got away (neither gettable nor huntable) ends at
 * once and the next is locked. The Lock-on Shot's lock never ends here: the shot takes it away (only its piece gone ends it).
 */
export function lockEnds(fen: string, crowd: Side, c: Pick<ChandyState, "moves">, l: ChandyLock, s: Pick<ChandySettings, "huntTurns" | "liveTurns" | "huntLoss"> = BOSS_POWERS.chandy, relock = false): boolean {
  const piece = pieceAt(fen, l.square);
  if (l.shot) return !piece || piece.color !== crowd || piece.type !== l.piece;
  if (!piece || piece.color !== crowd || piece.type !== l.piece || piece.type === "q" || piece.type === "k") return true;
  const age = lockAge(c, l);
  if (age >= s.liveTurns) return true;
  if (lockRank(fen, l.square, crowd) >= 2 || huntable(fen, l.square, crowd, s)) return false;
  return age >= s.huntTurns || (relock && age >= 1);
}

/** The locks after a move (`fen`: before it): each follows its piece (castling's rook too); one taken is gone; a promotion takes its new letter. */
export function locksAfter(fen: string, move: string, locks: readonly ChandyLock[]): ChandyLock[] {
  if (!locks.length) return [];
  const taken = capturedSquare(fen, move);
  let after: string;
  try {
    after = applyMove(fen, move);
  } catch {
    return locks.map((l) => ({ ...l }));
  }
  const castle = pieceAt(fen, from(move))?.type === "k" && Math.abs(fileIx(from(move)) - fileIx(to(move))) === 2;
  const out: ChandyLock[] = [];
  for (const l of locks) {
    if (l.square === taken) continue;
    let sq = l.square;
    if (sq === from(move)) sq = to(move);
    else if (castle && sq[1] === from(move)[1]) {
      // (Castling's rook: from its corner to the square beside the king's.)
      const kingSide = fileIx(to(move)) > fileIx(from(move));
      if (sq === `${kingSide ? "h" : "a"}${sq[1]}`) sq = `${kingSide ? "f" : "d"}${sq[1]}`;
    }
    const p = pieceAt(after, sq);
    if (p) out.push({ ...l, square: sq, piece: p.type });
  }
  return out;
}

// ---------------- The steering (L3) ----------------

/**
 * His move steered toward his locks (`fen`: him to move; `pick`: the move his brain chose; `top`: the engine's top moves, scored for
 * him; `locks`: the locked squares; `hunt`: the hunt's captures (huntTakes) scored in one search with his best move, Nov 24). A take
 * within takeMargin pawns of his best: of the best chandy.lockLines allowed, one taking a locked piece; or one of the hunt's (a trade
 * within huntLoss by the exchange check), its loss against his best measured in its own search, never one walking into a mate. The best
 * such (his pick if it's one); else one of those lines attacking a locked piece or adding an attacker within chaseMargin (his pick if it
 * does, else the best such); else his pick. Pawns as log-odds (bouncePawnLogit), as the pass guard counts them.
 */
export function steerPick(fen: string, pick: string, top: readonly MoveScore[], locks: readonly string[], allowed: readonly string[] | null = null, s: SteerSettings = BOSS_POWERS, hunt: readonly MoveScore[] = []): string {
  if (!locks.length || !top.length) return pick;
  const ok = new Set(allowed ?? legalMoves(fen));
  const lines = [...top]
    .filter((m) => ok.has(m.move))
    .sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1))
    .slice(0, Math.max(1, s.chandy.lockLines));
  const best = lines[0];
  if (!best) return pick;
  const lost = (from: number, m: MoveScore) => (logit(from) - logit(m.expected)) / s.bouncePawnLogit;
  const pawns = (m: MoveScore) => lost(best.expected, m);
  const takesLock = (m: string) => locks.includes(capturedSquare(fen, m) ?? "");
  // (Each take's loss against his best: from the top lines, else from the hunt's own search (its best the reference).)
  const loss = new Map<string, number>();
  for (const m of lines) if (takesLock(m.move)) loss.set(m.move, pawns(m));
  const huntOk = new Set(huntTakes(fen, locks, [...ok], s.chandy));
  const mated = (m: MoveScore) => m.mate !== undefined && m.mate < 0;
  for (const m of top) if (huntOk.has(m.move) && !mated(m) && !loss.has(m.move)) loss.set(m.move, pawns(m));
  const ref = Math.max(...hunt.map((m) => m.expected));
  for (const m of hunt) if (huntOk.has(m.move) && !mated(m) && !loss.has(m.move)) loss.set(m.move, Math.max(0, lost(ref, m)));
  const takes = [...loss].filter(([, x]) => x <= s.chandy.takeMargin + 1e-9).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  if (takes.length) return takes.some(([m]) => m === pick) ? pick : takes[0]![0];
  if (takesLock(pick)) return pick;
  const his = sideToMove(fen);
  const board = boardFor(fen);
  const before = locks.map((sq) => attackersOf(board, sq, his).length);
  const chases = (m: string): boolean => {
    try {
      const after = boardFor(applyMove(fen, m));
      return locks.some((sq, i) => attackersOf(after, sq, his).length > before[i]!);
    } catch {
      return false;
    }
  };
  const near = lines.filter((m) => pawns(m) <= s.chandy.chaseMargin + 1e-9);
  if (near.some((m) => m.move === pick) && chases(pick)) return pick;
  return near.find((m) => chases(m.move))?.move ?? pick;
}

// ---------------- The move meter ----------------

/**
 * The order his meter takes his unlocked moves in (`skip`: moves that can't come now), first to last: the newest unlock first; never
 * the one he fired last while another can come (Eric, Nov 16: "Despite 2 weapon unlocks he just did this move twice in a row"); then
 * the ones he has fired the fewest times this battle, ties at random (Eric, Nov 18: "he literally had all 5 but kept spamming the
 * scatter shot ... he randomly skipped one entirely": a plain random pick let one come four times in eight while another never came).
 * One order for the meter's pick, the queen lock's wait and a pick that can't land (landMove), so they all keep the same rule.
 */
export function meterOrder(c: Pick<ChandyState, "unlocked" | "fresh" | "used" | "last" | "fired">, seed: number, skip: readonly ChandyMove[] = []): ChandyMove[] {
  const open = c.unlocked.filter((m) => !skip.includes(m));
  const fresh = c.fresh && open.includes(c.fresh) ? [c.fresh] : [];
  const rest = seeded(
    open.filter((m) => m !== c.fresh),
    seed,
    (x) => x,
    "meter",
    c.used,
  ).sort((a, b) => Number(open.length > 1 && a === c.last) - Number(open.length > 1 && b === c.last) || (c.fired?.[a] ?? 0) - (c.fired?.[b] ?? 0));
  return [...fresh, ...rest];
}

/** The move the full meter fires (`skip`: moves that can't come now): the first of meterOrder; null: none can. */
export const meterPick = (c: Pick<ChandyState, "unlocked" | "fresh" | "used" | "last" | "fired">, seed: number, skip: readonly ChandyMove[] = []): ChandyMove | null => meterOrder(c, seed, skip)[0] ?? null;

/**
 * The move an upgrade unlocks: the queen lock while it's still locked and it could come right then (`queen`: you have a queen, or
 * with none a rook (Nov 19), it can aim at, afterHisMove; chandy.queenLockFirst: Eric, Nov 18, "make that upgrade happen earlier": in his game the queens were gone
 * before it came), else random among those still locked
 * (from the seed and the upgrade's number); none once all five are.
 */
export function unlockPick(unlocked: readonly ChandyMove[], seed: number, n: number, queen = false): ChandyMove | null {
  if (queen && !unlocked.includes("queenlock")) return "queenlock";
  const left = CHANDY_MOVES.filter((m) => !unlocked.includes(m));
  return left.length ? left[Math.floor(powerRoll(seed, "unlock", n) * left.length)]! : null;
}

// ---------------- Scatter shot ----------------

const NEAR: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/**
 * Scatter shot's spot and its blocked squares (`fen`: the crowd to move): an empty square with at least chandy.scatterSquares empty
 * squares round it; its squares the ones round it the most of the crowd's moves land on (ties by the seed); the spots ranked by the
 * moves their squares take away, a pick of the top chandy.looks. Squares dropped (the least taken first) until the crowd keeps a
 * legal move. Null: no spot fits.
 */
export function chooseScatter(fen: string, crowd: Side, seed: number, n: number, s: ChandySettings = BOSS_POWERS.chandy): { spot: string; squares: string[] } | null {
  void crowd;
  const legal = legalMoves(fen);
  const landings = new Map<string, number>();
  for (const m of legal) for (const sq of lands(m, fen)) landings.set(sq, (landings.get(sq) ?? 0) + 1);
  const spots: { spot: string; squares: string[]; score: number }[] = [];
  for (let f = 0; f < 8; f++)
    for (let r = 0; r < 8; r++) {
      const spot = sqOf(f, r);
      if (pieceAt(fen, spot)) continue;
      const round = NEAR.map(([df, dr]) => [f + df, r + dr] as const)
        .filter(([x, y]) => x >= 0 && x < 8 && y >= 0 && y < 8)
        .map(([x, y]) => sqOf(x, y))
        .filter((sq) => !pieceAt(fen, sq));
      if (round.length < s.scatterSquares) continue;
      const squares = seeded(round, seed, (x) => x, "scatter-sq", n, spot)
        .sort((a, b) => (landings.get(b) ?? 0) - (landings.get(a) ?? 0))
        .slice(0, s.scatterSquares);
      spots.push({ spot, squares, score: squares.reduce((t, sq) => t + (landings.get(sq) ?? 0), 0) });
    }
  const ordered = seeded(spots, seed, (x) => x.spot, "scatter", n).sort((a, b) => b.score - a.score);
  const pick = pickTop(ordered, s.looks, seed, "scatter-pick", n);
  if (!pick) return null;
  const squares = [...pick.squares];
  while (squares.length && !legal.some((m) => !marksStop(chandyMarks({ scatter: squares, beam: [], shields: [] }), fen, m))) squares.pop();
  return squares.length ? { spot: pick.spot, squares } : null;
}

// ---------------- Beam ----------------

/** A rank's and a file's squares (the beam's cover). */
export function beamSquares(rank: number, file: string): string[] {
  const out = new Set<string>();
  for (let i = 0; i < 8; i++) {
    out.add(`${FILES[i]}${rank}`);
    out.add(`${file}${i + 1}`);
  }
  return [...out];
}

/** A crowd move under a beam's cover (`squares`): none of its pieces in it moves, nothing lands on or slides through it (chandyMarks). */
export const beamAllows = (fen: string, move: string, squares: readonly string[]): boolean => !marksStop(chandyMarks({ beam: squares, scatter: [], shields: [] }), fen, move);

/**
 * The beam's rank and file (`fen`: the crowd to move): never the crowd king's rank or file; the pairs holding the most of the
 * crowd's pieces first, a pick of the top chandy.looks among those that leave it a legal move. Null: none does.
 */
export function chooseBeam(fen: string, crowd: Side, seed: number, n: number, s: ChandySettings = BOSS_POWERS.chandy): { rank: number; file: string; squares: string[] } | null {
  const king = kingOf(fen, crowd);
  if (!king) return null;
  const mine = new Set(piecesOf(fen, crowd).map((p) => p.square));
  const legal = legalMoves(fen);
  const pairs: { rank: number; file: string; squares: string[]; count: number }[] = [];
  for (let r = 1; r <= 8; r++)
    for (const f of FILES) {
      if (r === Number(king[1]) || f === king[0]) continue;
      const squares = beamSquares(r, f);
      if (!legal.some((m) => beamAllows(fen, m, squares))) continue;
      pairs.push({ rank: r, file: f, squares, count: squares.filter((sq) => mine.has(sq)).length });
    }
  const ordered = seeded(pairs, seed, (x) => `${x.file}${x.rank}`, "beam", n).sort((a, b) => b.count - a.count);
  const pick = pickTop(ordered, s.looks, seed, "beam-pick", n);
  return pick ? { rank: pick.rank, file: pick.file, squares: pick.squares } : null;
}

// ---------------- Shields ----------------

/**
 * Shields (`fen`: the crowd to move): his pieces the crowd attacks, most valuable first, then his others by value (ties by the
 * seed), never his king or a piece giving check: chandy.shieldCount of them.
 */
export function chooseShields(fen: string, crowd: Side, seed: number, n: number, s: ChandySettings = BOSS_POWERS.chandy): string[] {
  const his = other(crowd);
  const board = boardFor(fen);
  const king = kingOf(fen, crowd);
  const checking = new Set(king ? attackersOf(board, king, his) : []);
  const attacked = (sq: string) => (attackersOf(board, sq, crowd).length > 0 ? 1 : 0);
  return seeded(
    piecesOf(fen, his).filter((p) => p.type !== "k" && !checking.has(p.square)),
    seed,
    (x) => x.square,
    "shield",
    n,
  )
    .sort((a, b) => attacked(b.square) - attacked(a.square) || VALUE[b.type]! - VALUE[a.type]!)
    .slice(0, s.shieldCount)
    .map((p) => p.square);
}


// ---------------- Rapid fire ----------------

/** Rapid fire's targets (`fen`: the crowd to move): chandy.rapidCount of the crowd's pieces with a move, never the king, at random; each kept only while the crowd keeps a legal move. */
export function chooseRapid(fen: string, crowd: Side, seed: number, n: number, s: ChandySettings = BOSS_POWERS.chandy): string[] {
  const legal = legalMoves(fen);
  const movers = new Set(legal.map(from));
  const picked: string[] = [];
  for (const c of seeded(
    piecesOf(fen, crowd).filter((p) => p.type !== "k" && movers.has(p.square)),
    seed,
    (x) => x.square,
    "rapid",
    n,
  )) {
    if (picked.length >= s.rapidCount) break;
    const held = [...picked, c.square];
    if (legal.some((m) => !heldIn(fen, m, held))) picked.push(c.square);
  }
  return picked;
}

// ---------------- Queen lock ----------------

/** The squares from his edge's rank (8 when the crowd is White) down `square`'s file to it (his edge first, `square` last). */
function fromHisEdge(square: string, crowd: Side): string[] {
  const edge = crowd === "w" ? 7 : 0;
  const end = rankIx(square);
  const step = end > edge ? 1 : -1;
  const out: string[] = [];
  for (let r = edge; r !== end + step; r += step) out.push(`${square[0]}${r + 1}`);
  return out;
}

/** The first of the crowd's pieces down the file from his edge to the target's square (the queen lock's queen or rook, it included), or null. */
export function shotTarget(fen: string, queen: string, crowd: Side): string | null {
  for (const sq of fromHisEdge(queen, crowd)) if (pieceAt(fen, sq)?.color === crowd) return sq;
  return null;
}

/** A pawn, knight or bishop of the crowd's is the first of its pieces from his edge down the target's file, before it. */
const shielded = (fen: string, queen: string, crowd: Side): boolean => {
  const first = shotTarget(fen, queen, crowd);
  return !!first && first !== queen && ["p", "n", "b"].includes(pieceAt(fen, first)!.type);
};

/**
 * The piece the queen lock aims at (`passed`: his turn spent, the crowd to move), or null: it can't come now. The crowd's queen (a
 * promoted one counts; several: the one with the most saves, ties by the seed) with a move that leaves a pawn, knight or bishop
 * between her and his edge on her file (one is there already, she steps behind one, or one steps in front of her). With no queen it
 * can aim at, the crowd's best rook with such a save (Eric, Nov 19: "yes on chandy good idea", the queen lock a dead upgrade once the
 * queens came off): the one lockRank rates most gettable, ties by the seed (docs/decisions/2026-11-19-chandy-rook-lock.md). Never
 * with the crowd in check; null `passed` (he's in check: no pass) never.
 */
export function queenLockAim(passed: string | null, crowd: Side, seed: number, n: number): string | null {
  if (!passed || sideToMove(passed) !== crowd || kingAttacked(passed, crowd)) return null;
  const legal = legalMoves(passed);
  const saves = (sq: string, type: "q" | "r") =>
    legal.filter((m) => {
      try {
        const after = applyMove(passed, m);
        const now = from(m) === sq ? to(m) : sq;
        return pieceAt(after, now)?.type === type && shielded(after, now, crowd);
      } catch {
        return false;
      }
    }).length;
  const of = (type: "q" | "r") => piecesOf(passed, crowd).filter((p) => p.type === type).map((p) => p.square);
  const queen = seeded(of("q"), seed, (x) => x, "queen-aim", n)
    .map((q) => ({ q, n: saves(q, "q") }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)[0]?.q;
  if (queen) return queen;
  const board = boardFor(passed);
  const hits = attackedSquares(passed, other(crowd));
  return (
    seeded(of("r"), seed, (x) => x, "rook-aim", n)
      .filter((r) => saves(r, "r") > 0)
      .map((r) => ({ r, rank: lockRank(passed, r, crowd, board, hits) }))
      .sort((a, b) => b.rank - a.rank)[0]?.r ?? null
  );
}

/** The queen lock may come now (`fen`: him to move): a queen (or, with none it can aim at, a rook) with a cheap save (queenLockAim), and a turn he can pass. */
export const queenLockOk = (fen: string, crowd: Side, seed: number, n: number): boolean => queenLockAim(passTurn(fen), crowd, seed, n) !== null;

/**
 * The crowd's moves (of `moves`; `fen`: the crowd to move) that put a piece of theirs in front of the Lock-on Shot's target (`target`:
 * its square; the aim follows it), so its round hits that piece instead: the target's saves.
 */
export function shotSaves(fen: string, target: string, crowd: Side, moves: readonly string[] = legalMoves(fen)): string[] {
  return moves.filter((m) => {
    try {
      const now = from(m) === target ? to(m) : target;
      const hit = shotTarget(applyMove(fen, m), now, crowd);
      return !!hit && hit !== now;
    } catch {
      return false;
    }
  });
}

/**
 * The piece the Lock-on Shot will most likely hit (Eric, Nov 24: "When he does his queen shot, we should already know ... which piece
 * you're most likely to sacrifice. So have him mark that piece as well"), decided once as he aims (`passed`: the crowd to move;
 * `target`: the aim's square), from the position alone so every device agrees: the piece already first down the target's file from
 * his edge, if one is in front of it; else the cheapest piece a move of yours can put there (ties: the one more of your moves put
 * there, then the seed), as its square now; else the target. Null: nothing to aim at.
 */
export function shotVictim(passed: string, target: string, crowd: Side, seed: number, n: number): string | null {
  const first = shotTarget(passed, target, crowd);
  if (!first) return null;
  if (first !== target) return first;
  const ways = new Map<string, number>();
  for (const m of shotSaves(passed, target, crowd)) {
    const now = from(m) === target ? to(m) : target;
    const hit = shotTarget(applyMove(passed, m), now, crowd)!;
    // (The piece as it stands now: the mover, if it's the one that stepped in front; castling's rook isn't counted.)
    const sq = hit === to(m) ? from(m) : hit;
    if (pieceAt(passed, sq)?.color === crowd) ways.set(sq, (ways.get(sq) ?? 0) + 1);
  }
  const pick = seeded([...ways.keys()], seed, (x) => x, "shot-victim", n).sort((a, b) => VALUE[pieceAt(passed, a)!.type]! - VALUE[pieceAt(passed, b)!.type]! || ways.get(b)! - ways.get(a)!)[0];
  return pick ?? target;
}

/**
 * The queen lock's shot at the start of his turn (`fen`: him to move; `queen`: where she stands now): the square it shatters and the
 * position after (null square: it stopped on your king, found nothing, or would leave your king attacked or hand him a promotion
 * for his next move: it fizzles), and the squares it flew over from his edge.
 */
export function queenShot(fen: string, queen: string, crowd: Side): { square: string | null; piece: string | null; fen: string; trail: string[] } {
  const trail = fromHisEdge(queen, crowd);
  const hit = shotTarget(fen, queen, crowd);
  const path = hit ? trail.slice(0, trail.indexOf(hit) + 1) : trail;
  const piece = hit ? pieceAt(fen, hit) : null;
  if (!hit || !piece || piece.type === "k") return { square: null, piece: piece?.type ?? null, fen, trail: path };
  const after = withoutPiece(fen, hit);
  const promos = (f: string) => new Set(legalMoves(f).filter((m) => m.length === 5));
  const before = promos(fen);
  if (kingAttacked(after, crowd) || [...promos(after)].some((m) => !before.has(m))) return { square: null, piece: null, fen, trail: path };
  return { square: hit, piece: piece.type, fen: after, trail: path };
}

// ---------------- Dodge ----------------

/** Where your king slides for Dodge: e4 for White, e5 for Black (D1a); the 3 x 3 round it is the arena. */
export const dodgeCenter = (crowd: Side): string => (crowd === "w" ? "e4" : "e5");

/** The arena's nine squares (the 3 x 3 round the center), rank by rank from a1's corner. */
export function dodgeArena(center: string): string[] {
  const out: string[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let df = -1; df <= 1; df++) out.push(sqOf(fileIx(center) + df, rankIx(center) + dr));
  return out;
}

/** A clone's line crosses this square. */
export const lineCovers = (line: DodgeLine, sq: string): boolean => ("rank" in line ? Number(sq[1]) === line.rank : sq[0] === line.file);

/** The arena's squares no line crosses (exactly one, always: the proof is a unit test). */
export const safeSquares = (center: string, lines: readonly DodgeLine[]): string[] => dodgeArena(center).filter((sq) => !lines.some((l) => lineCovers(l, sq)));

/** The lines after the round's first `k` teleports. */
export function linesAfter(round: Pick<DodgeRound, "lines" | "teleports">, k: number): DodgeLine[] {
  const lines = round.lines.map((l) => ({ ...l }));
  for (const t of round.teleports.slice(0, k)) lines[t.clone] = { ...t.to };
  return lines;
}

/**
 * Dodge's three rounds (D3, D4), from the seed (`n`: which Dodge of the battle): each round's safe square as it opens, the two ranks
 * and two files of the arena that miss it (a rank's clone on the a- or h-file, from the seed), and its teleports
 * (chandy.dodgeTeleports' count): each one a clone on a line next to the safe square's (a rank's or a file's, from the seed) blinking
 * onto the free line of its kind, so the safe square moves one step. A round's last safe square is never the round before's (the
 * middle allowed).
 */
export function dodgeRounds(center: string, seed: number, n: number, s: ChandySettings = BOSS_POWERS.chandy): DodgeRound[] {
  const out: DodgeRound[] = [];
  const f0 = fileIx(center) - 1;
  const r0 = rankIx(center) - 1;
  let prev: string | null = null;
  for (let k = 0; k < s.dodgeRounds; k++) {
    const count = s.dodgeTeleports[k]?.length ?? 0;
    let round: DodgeRound | null = null;
    for (let attempt = 0; attempt < 64 && !round; attempt++) {
      const roll = (...x: (string | number)[]) => powerRoll(seed, "dodge", n, k, attempt, ...x);
      let fi = Math.floor(roll("f") * 3);
      let ri = Math.floor(roll("r") * 3);
      const lines: DodgeLine[] = [
        ...[0, 1, 2].filter((x) => x !== ri).map((x, i): DodgeLine => ({ rank: r0 + x + 1, side: roll("side", i) < 0.5 ? "left" : "right" })),
        ...[0, 1, 2].filter((x) => x !== fi).map((x): DodgeLine => ({ file: FILES[f0 + x]! })),
      ];
      const cur = lines.map((l) => ({ ...l }));
      const teleports: DodgeRound["teleports"] = [];
      for (let j = 0; j < count; j++) {
        const byRank = roll("kind", j) < 0.5;
        const at = byRank ? ri : fi;
        const steps = [at - 1, at + 1].filter((x) => x >= 0 && x <= 2);
        const next = steps[Math.floor(roll("step", j) * steps.length)]!;
        const clone = cur.findIndex((l) => (byRank ? "rank" in l && l.rank === r0 + next + 1 : "file" in l && l.file === FILES[f0 + next]));
        const was = cur[clone]!;
        const toLine: DodgeLine = byRank ? { rank: r0 + at + 1, side: "rank" in was ? was.side : "left" } : { file: FILES[f0 + at]! };
        cur[clone] = toLine;
        teleports.push({ clone, to: toLine });
        if (byRank) ri = next;
        else fi = next;
      }
      const safe = sqOf(f0 + fi, r0 + ri);
      if (safe !== prev) round = { lines, teleports, safe };
    }
    out.push(round!);
    prev = round!.safe;
  }
  return out;
}

/**
 * The warning volley's lines (Eric, Nov 16: "an additional shot first that you can't move"): the arena's two ranks and two files that
 * miss the center, where your king stands (a rank's clone on the a- or h-file from the seed): every beam misses him.
 */
export function dodgeVolley(center: string, seed: number, n: number): DodgeLine[] {
  const f = fileIx(center);
  const r = rankIx(center);
  return [
    ...[-1, 1].map((d, i): DodgeLine => ({ rank: r + d + 1, side: powerRoll(seed, "dodge-volley", n, i) < 0.5 ? "left" : "right" })),
    ...[-1, 1].map((d): DodgeLine => ({ file: FILES[f + d]! })),
  ];
}

/**
 * Dodge's beats (ms from its start; the server, solo and every screen alike; nobody's clock runs): the scope-in on your king, his
 * slide to the center (`slideAt`); the warning volley (`volley`: the clones appear at `at`, the beams fire at `fireAt` and have all
 * landed by `landAt`, "Dodge the next one!", until `end`); then each round: "get ready" (`openAt`), its vote (`voteAt` to `voteEnd`,
 * the teleports at their times), the server's lag grace (`closeAt`: the votes counted), LOCKED (your king on the winning square, the
 * lines flashing), the beams (`blastAt`: each from its clone's muzzle across the board, dodgeStaggerMs apart, dodgeTravelMs each),
 * the hit or DODGED as the last lands (`hitAt`), the beams held until `end` (dodgeHoldMs). A hit that loses: the kill from `hitAt`
 * for `killMs` (the beams on your king, then his shatter), then the result (dodgeEndAt).
 */
export function dodgeTimeline(s: ChandySettings = BOSS_POWERS.chandy) {
  const travel = 3 * s.dodgeStaggerMs + s.dodgeTravelMs;
  const vAt = s.dodgeScopeMs + s.dodgeSlideMs;
  const volley = { at: vAt, fireAt: vAt + s.dodgeAimMs, landAt: vAt + s.dodgeAimMs + travel, end: vAt + s.dodgeVolleyMs };
  const rounds: { openAt: number; voteAt: number; teleports: number[]; voteEnd: number; closeAt: number; blastAt: number; hitAt: number; end: number }[] = [];
  let openAt = volley.end;
  for (let k = 0; k < s.dodgeRounds; k++) {
    const voteAt = openAt + s.dodgeOpenMs;
    const voteEnd = voteAt + s.dodgeVoteMs;
    const closeAt = voteEnd + s.dodgeGraceMs;
    const blastAt = closeAt + s.dodgeLockedMs;
    const hitAt = blastAt + travel;
    const end = hitAt + s.dodgeHoldMs;
    rounds.push({ openAt, voteAt, teleports: (s.dodgeTeleports[k] ?? []).map((ms) => voteAt + ms), voteEnd, closeAt, blastAt, hitAt, end });
    openAt = end;
  }
  // Its beats: each time its screen first shows something by the clock alone, with no update (in order). Written once, here, from the
  // times the screen draws by (Chandy.tsx, dodgeView), and read by a kept solo battle (SoloMatch.moment: kept as each shows) and its
  // test: the volley's lines, then each round as it opens (the round before over), its lines and each teleport. (The scope-in and the
  // volley's beams show nothing a rejoin could use twice; a round's beams and its hit play out its result, kept by the update that
  // closes it.)
  const beats = [volley.at, ...rounds.flatMap((r) => [r.openAt, r.voteAt, ...r.teleports])];
  return { slideAt: s.dodgeScopeMs, volley, rounds, beats, killMs: s.dodgeKillMs + s.dodgeShatterMs, total: rounds.at(-1)?.end ?? 0 };
}

/** A Dodge's hits so far. */
export const dodgeHits = (d: Pick<ChandyDodge, "results">): number => d.results.filter((r) => r.hit).length;

/** When a Dodge is done (ms from its start, `d` over): the kill's end after a losing hit, else the last round's end. */
export function dodgeEndAt(d: Pick<ChandyDodge, "rounds" | "results">, s: ChandySettings = BOSS_POWERS.chandy): number {
  const tl = dodgeTimeline(s);
  const k = Math.max(0, d.results.length - 1);
  return dodgeHits(d) >= s.dodgeHits ? tl.rounds[k]!.hitAt + tl.killMs : tl.rounds[k]!.end;
}

/**
 * A round's vote, closed (`votes`: each voter's square; bots' are in it too): the square with the most votes (ties drawn among them
 * by the seed); nobody voted, a square of the arena from the seed. A hit when it isn't the safe square.
 */
export function dodgeTally(d: Pick<ChandyDodge, "center" | "n" | "rounds">, k: number, votes: Readonly<Record<string, unknown>>, seed: number): DodgeResult {
  const arena = dodgeArena(d.center);
  const counts: Record<string, number> = {};
  for (const v of Object.values(votes)) if (typeof v === "string" && arena.includes(v)) counts[v] = (counts[v] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(counts));
  const tied = top > 0 ? arena.filter((sq) => counts[sq] === top) : [];
  const random = !tied.length;
  const pool = random ? arena : tied;
  const placed = pool[Math.floor(powerRoll(seed, random ? "dodge-random" : "dodge-tie", d.n, k) * pool.length)]!;
  return { placed, hit: placed !== d.rounds[k]!.safe, ...(random ? { random: true as const } : {}), votes: counts };
}

/** A bot's vote in a round: the safe square with chandy.dodgeBotHit's chance, else a square of the arena (all from the seed). */
export function botDodgeVote(d: Pick<ChandyDodge, "center" | "n" | "rounds">, k: number, botId: string, seed: number, s: ChandySettings = BOSS_POWERS.chandy): string {
  if (powerRoll(seed, "dodge-bot", d.n, k, botId) < s.dodgeBotHit) return d.rounds[k]!.safe;
  const arena = dodgeArena(d.center);
  return arena[Math.floor(powerRoll(seed, "dodge-bot-sq", d.n, k, botId) * arena.length)]!;
}

/** Dodge is over: every round played, or the hits that lose (chandy.dodgeHits). */
export const dodgeOver = (d: Pick<ChandyDodge, "rounds" | "results"> | null | undefined, s: Pick<ChandySettings, "dodgeHits"> = BOSS_POWERS.chandy): boolean => !!d && (d.results.length >= d.rounds.length || dodgeHits(d) >= s.dodgeHits);

/** Dodge's hits ended the battle: his. */
export const dodgeWon = (boss: Pick<BossState, "powers"> | null | undefined, s: Pick<ChandySettings, "dodgeHits"> = BOSS_POWERS.chandy): boolean => {
  const d = boss?.powers?.chandy?.dodge;
  return !!d && dodgeHits(d) >= s.dodgeHits;
};

/**
 * What a screen may see of a Dodge `elapsed` ms into it (online, the server sends this; D3: the teleports are the surprise): each
 * round's teleports only once their time has come, and its safe square only once its vote has closed ("" until then).
 */
export function dodgeSeen(d: ChandyDodge, elapsed: number, s: ChandySettings = BOSS_POWERS.chandy): ChandyDodge {
  const tl = dodgeTimeline(s);
  return {
    ...d,
    ...(d.volley ? { volley: d.volley.map((l) => ({ ...l })) } : {}),
    rounds: d.rounds.map((r, k) => {
      const t = tl.rounds[k]!;
      const done = k < d.results.length;
      const shown = done ? r.teleports : r.teleports.filter((_, j) => elapsed >= (t.teleports[j] ?? Infinity));
      return { lines: r.lines.map((l) => ({ ...l })), teleports: shown.map((x) => ({ ...x, to: { ...x.to } })), safe: done ? r.safe : "" };
    }),
    results: d.results.map((r) => ({ ...r, votes: { ...r.votes } })),
  };
}

// ---------------- His rules ----------------

/** His meter's move switches (?power=…): that move unlocked from the start, the meter full after every move of yours. */
const moveTest = (test: string): ChandyMove | null => ((CHANDY_MOVES as readonly string[]).includes(test) ? (test as ChandyMove) : null);

/** His Dodges a battle at most (BOSS_POWERS.maxUltimates.chandy: once). */
const dodgeMax = (s: Pick<BossPowerSettings, "maxUltimates"> = BOSS_POWERS): number => s.maxUltimates?.["chandy"] ?? 1;

/** The rifle is whole: the rage meter fills from now on (D9). */
export const rifleWhole = (c: Pick<ChandyState, "upgrades">, s: Pick<ChandySettings, "upgradesMax"> = BOSS_POWERS.chandy): boolean => c.upgrades >= s.upgradesMax;

/**
 * His rage meter, 0-1, as crowd turn `turn` is picked (BossRules.meter: his own, so the God King's strike and the usual gains add
 * nothing; Eric, Nov 16): empty until the rifle is whole (`whole`: the crowd turn its fifth upgrade showed), then a notch for each of
 * your moves, full after chandy.dodgeAfterMoves; full once warned and on Dodge's own turn; empty after it (once a battle).
 */
export function dodgeMeter(p: Pick<BossPowerState, "chandy" | "ultAt" | "warnAt">, turn: number, s: Pick<BossPowerSettings, "chandy"> = BOSS_POWERS): number {
  if (p.ultAt !== undefined) return turn <= p.ultAt ? 1 : 0;
  if (p.warnAt !== undefined) return 1;
  const whole = p.chandy?.whole;
  if (whole === undefined) return 0;
  const n = s.chandy.dodgeAfterMoves;
  return n <= 0 ? 1 : Math.max(0, Math.min(1, (turn - whole) / n));
}

/**
 * The last chance (Eric, Nov 16: "if we can calculate that it's a guaranteed mate in one ... he still fires his ult anyway"): the
 * crowd, to move in `t.fen`, has a move that mates him, among its allowed moves as this turn's limits stand (his held pieces and
 * stops in `next` for crowd turn `t.turn`; limits that would leave no move lift, as the dispatcher's do). Every legal move tried
 * (chess.js: matingMoves). Several bosses: among the moves the side allows (`t.crowdMoves`: every boss's limits; a mate another
 * boss's freeze stops isn't open).
 */
export function mateOpen(next: Pick<BossPowerState, "chandy">, t: Pick<TurnContext, "fen" | "turn" | "crowdMoves">): boolean {
  const mates = matingMoves(t.fen);
  if (!mates.length) return false;
  if (t.crowdMoves) {
    const allowed = t.crowdMoves();
    return mates.some((m) => allowed.includes(m));
  }
  const c = next.chandy;
  const f = stopFieldsOf({ chandy: c, turn: t.turn });
  const marks = chandyMarks(f, on(c?.dizzy, t.turn)?.squares ?? []);
  const ok = (m: string) => !marksStop(marks, t.fen, m);
  return mates.some(ok) || !legalMoves(t.fen).some(ok);
}

/** His state after firing `m`: it counts (meterOrder), it's the one he fired last, and no longer new. */
const fired = (c: ChandyState, m: ChandyMove): Partial<ChandyState> => ({ used: c.used + 1, last: m, fired: { ...c.fired, [m]: (c.fired?.[m] ?? 0) + 1 }, fresh: c.fresh === m ? null : c.fresh });

/**
 * The move the meter picked lands as the crowd's turn begins (`t.fen`: the crowd to move): it, or (it can't here: say shields with
 * only his king left) the next in the meter's order that can (meterOrder: not the one he fired last while another can, the least
 * fired), never the queen lock (his whole turn: at its start). None can: it waits, the meter full.
 */
function landMove(c: ChandyState, t: TurnContext): ChandyState {
  const s = t.s.chandy;
  const n = c.used;
  const tries = [c.due!, ...meterOrder(c, t.seed, [c.due!, "queenlock"])];
  for (const m of tries) {
    const done = (x: Partial<ChandyState>, e: PowerEvent): ChandyState => {
      t.events.push(e);
      return { ...c, ...x, due: null, meter: 0, ...fired(c, m) };
    };
    if (m === "scatter") {
      const pick = chooseScatter(t.fen, t.crowd, t.seed, n, s);
      if (pick) return done({ scatter: { ...pick, turn: t.turn } }, { kind: "scatterShot", turn: t.turn, square: pick.spot, squares: [...pick.squares] });
    } else if (m === "beam") {
      const pick = chooseBeam(t.fen, t.crowd, t.seed, n, s);
      if (pick) return done({ beam: { ...pick, turn: t.turn } }, { kind: "beam", turn: t.turn, square: `${pick.file}${pick.rank}`, squares: [...pick.squares] });
    } else if (m === "shields") {
      const squares = chooseShields(t.fen, t.crowd, t.seed, n, s);
      if (squares.length) return done({ shields: { squares, turn: t.turn } }, { kind: "shields", turn: t.turn, squares: [...squares] });
    } else if (m === "rapidfire") {
      const squares = chooseRapid(t.fen, t.crowd, t.seed, n, s);
      if (squares.length) return done({ dizzy: { squares, turn: t.turn } }, { kind: "rapidFire", turn: t.turn, squares: [...squares] });
    }
  }
  return c;
}

export const CHANDY: BossRules = {
  id: "chandy",
  ultimateMax: BOSS_POWERS.maxUltimates["chandy"],
  spentMeterShown: true,
  // His own rage meter (Eric, Nov 16): from the fifth upgrade, over dodgeAfterMoves of your moves; nothing else fills or drains it.
  meter: (p, turn, s) => dodgeMeter(p, turn, s),
  // (After his last Dodge, as long as the battle: the meter spent, empty and dimmed, and no other comes.)
  ultimateRunning: (p, turn, s) => (p.ults ?? 0) >= dodgeMax(s) || turn <= (p.ultAt ?? 0),
  wearOff(next, t) {
    const c = next.chandy;
    if (!c) return;
    // This crowd turn's effects only; the locks that end (L1: their piece gone, too old, past their hunt and safe; the hunt, Nov 24:
    // one that got away while another piece can be hunted, the next locked by the passive).
    let relock: boolean | null = null;
    const another = () => {
      if (relock === null) {
        const nets = takeNets(t.fen, t.crowd);
        relock = lockOrder(t.fen, t.crowd, t.seed, c.moves, c.locks.map((l) => l.square), t.s.chandy).some((sq) => huntable(t.fen, sq, t.crowd, t.s.chandy, nets));
      }
      return relock;
    };
    next.chandy = {
      ...c,
      scatter: on(c.scatter, t.turn),
      beam: on(c.beam, t.turn),
      shields: on(c.shields, t.turn),
      dizzy: on(c.dizzy, t.turn),
      locks: c.locks.filter((l) => !lockEnds(t.fen, t.crowd, c, l, t.s.chandy, false) && !(c.taught && !l.shot && lockEnds(t.fen, t.crowd, c, l, t.s.chandy, true) && another())),
    };
  },
  // Several bosses: the last chance can't wait for his own turn change (a mate open as your turn begins: Dodge now, whoever moved).
  ultimateNow: (p, t) => (p.ults ?? 0) < dodgeMax(t.s) && mateOpen(p, t),
  // Dodge: his meter full (dodgeMeter) or the test switch, the warning as this turn begins, Dodge as the next does; the admins'
  // trigger, straight to it; the last chance (mateOpen), now, its warning with it. Once a battle.
  ultimate(next, t) {
    // (A fresh state where the battle set none up: the ?win=1 and ?mate=1 switches skip his set-up.)
    const c = chandyOf(next);
    if ((next.ults ?? 0) >= dodgeMax(t.s)) return false;
    // (Warned as an earlier turn began: it comes now.)
    if (!t.ultNext && next.warnAt === undefined) {
      const last = mateOpen(next, t);
      if (!last && dodgeMeter(next, t.turn, t.s) < 1 && !testSwitch(t, next)) return false;
      next.warnAt = t.turn;
      t.events.push({ kind: "warn", turn: t.turn });
      if (!last) return false;
    }
    next.ultAt = t.turn;
    const center = dodgeCenter(t.crowd);
    const n = (next.ults ?? 0) + 1;
    next.chandy = { ...c, dodge: { at: t.turn - 1, n, king: kingOf(t.fen, t.crowd) ?? center, center, volley: dodgeVolley(center, t.seed, n), rounds: dodgeRounds(center, t.seed, n, t.s.chandy), results: [] } };
    t.events.push({ kind: "dodge", turn: t.turn });
    return true;
  },
  // As every crowd turn begins: the upgrade his move just earned, and the queen lock's aim (his whole turn just spent).
  everyTurn(next, t) {
    const c = next.chandy;
    if (!c) return;
    if (c.upgrade && c.upgrade.turn === t.turn) t.events.push({ kind: "upgrade", turn: t.turn, stage: c.upgrade.stage, ...(c.upgrade.unlock ? { unlock: c.upgrade.unlock } : {}) });
    if (c.aim && c.aim.turn === t.turn) {
      // (Its target, a queen or a rook (Nov 19), for the screens' words.)
      const shape = pieceAt(t.fen, c.aim.square)?.type;
      t.events.push({ kind: "queenAim", turn: t.turn, square: c.aim.square, ...(shape === "r" || shape === "q" ? { shape } : {}) });
      // (The piece the round will most likely hit, decided as he aimed (shotVictim): locked too, its crosshair snapping on after the aim's
      // (Nov 24). Already locked, or the target itself (the aim's crosshair is on it): nothing more.)
      const v = c.aim.victim;
      const piece = v ? pieceAt(t.fen, v) : null;
      if (v && piece && piece.color === t.crowd && v !== c.aim.square && !c.locks.some((l) => l.square === v)) {
        next.chandy = { ...c, locks: [...c.locks, { square: v, piece: piece.type, at: c.moves, shot: true }] };
        t.events.push({ kind: "lockOn", turn: t.turn, square: v });
      }
    }
  },
  passive(next, t) {
    let c = next.chandy;
    if (!c) return;
    next.nextPassive = t.turn;
    // The meter's move lands (not the queen lock: his turn's own).
    if (c.due && c.due !== "queenlock") c = landMove(c, t);
    // Then he hunts: a lock, or a second once the first is old enough (L1). (The Lock-on Shot's lock isn't one he hunts.)
    const s = t.s.chandy;
    const hunting = c.locks.filter((l) => !l.shot);
    if (c.taught && (hunting.length === 0 || (hunting.length < s.maxLocks && hunting.every((l) => lockAge(c!, l) >= s.secondAfter)))) {
      const sq = lockOrder(t.fen, t.crowd, t.seed, c.moves, c.locks.map((l) => l.square), s)[0];
      const piece = sq ? pieceAt(t.fen, sq) : null;
      if (sq && piece) {
        c = { ...c, locks: [...c.locks, { square: sq, piece: piece.type, at: c.moves }] };
        t.events.push({ kind: "lockOn", turn: t.turn, square: sq });
      }
    }
    next.chandy = c;
  },
  // On the board layer (chandyMarks): rapid fire's dizzy pieces and those under the beam don't move this turn, nor castle with a
  // held rook; the beam's squares are walls to the crowd's pieces; nobody lands on a scatter shot's square, him included, through
  // his move after your turn (Boingo's pie rule); the crowd takes no shielded piece this turn.
  layer: (boss) => {
    const p = boss.powers!;
    return chandyMarks(stopFieldsOf(p), on(chandyOf(p).dizzy, p.turn)?.squares ?? []);
  },
  stopReason: (boss, fen, m) => chandyStop(stopFieldsOf(boss.powers), fen, m),
  powerTurn: (boss) => {
    const p = boss.powers!;
    const c = chandyOf(p);
    return !!(on(c.scatter, p.turn) || on(c.beam, p.turn) || on(c.shields, p.turn) || on(c.dizzy, p.turn) || (c.aim && c.aim.turn === p.turn));
  },
  afterCrowdMove(b, move) {
    chandyBattle.afterCrowdMove(b, move);
  },
  afterBossMove(b, move) {
    chandyBattle.afterHisMove(b, move);
  },
  // (Several bosses: another boss's move, his locks and the queen lock's aim follow it too; one it took is gone.)
  followMove(b, move, fenBefore) {
    const c = b.state.boss?.powers?.chandy;
    if (!c || (!c.locks.length && !c.aim)) return;
    setChandy(b, () => followLocks(c, fenBefore, move));
  },
  opening: {
    setUp(b) {
      const test = b.settings.bossPowerTest;
      const s = BOSS_POWERS.chandy;
      const m = moveTest(test);
      return {
        chandy: {
          ...FRESH,
          ...(test === "dodge" ? { upgrades: s.upgradesMax, unlocked: [...CHANDY_MOVES], taught: true as const, whole: 1 } : {}),
          ...(m ? { upgrades: 1, unlocked: [m], fresh: m, meter: s.meterEvery - 1 } : {}),
        },
      };
    },
  },
  view: (p) => ({ chandy: chandyView(p) }),
};

// ---------------- What stops a move (the screens' words) ----------------

/** This crowd turn's scatter squares, beam squares and shields. */
export interface ChandyStopFields {
  scatter: readonly string[];
  beam: readonly string[];
  shields: readonly string[];
}

/** The stop fields from a boss's powers, the match's state or the screens' view alike (an effect carrying its turn counts on that turn only). */
export function stopFieldsOf(p: StopFields | null | undefined): ChandyStopFields | null {
  const c = p?.chandy;
  if (!c) return null;
  const now = (x: { squares: readonly string[]; turn?: number } | null | undefined) => (x && (x.turn === undefined || x.turn === p!.turn) ? x.squares : []);
  return { scatter: now(c.scatter), beam: now(c.beam), shields: now(c.shields) };
}

/**
 * His marks on the board layer this crowd turn (`f`: the beam's and scatter shot's squares and the shields; `dizzy`: rapid fire's
 * pieces): the dizzy pieces and the crowd's pieces under the beam held; the beam's squares walls to the crowd's pieces (nothing
 * lands on or slides through one; a knight jumps); the scatter shot's squares landed on by nobody, him included; his shielded
 * pieces taken by none of the crowd's. Null: none.
 */
export function chandyMarks(f: ChandyStopFields | null, dizzy: readonly string[] = []): LayerMarks | null {
  const beam = f?.beam ?? [];
  const scatter = f?.scatter ?? [];
  const shields = f?.shields ?? [];
  if (!beam.length && !scatter.length && !shields.length && !dizzy.length) return null;
  const held = (kind: "dizzy" | "beam", squares: readonly string[]): PieceMark[] => squares.map((square) => ({ square, kind, held: true, binds: "crowd", by: "chandy" }));
  return {
    pieces: [...held("dizzy", dizzy), ...held("beam", beam), ...shields.map((square): PieceMark => ({ square, kind: "shield", shieldFrom: "all", binds: "crowd", by: "chandy" }))],
    squares: [
      ...beam.map((square): SquareMark => ({ square, kind: "beam", noLand: true, noPass: true, binds: "crowd", by: "chandy" })),
      ...scatter.map((square): SquareMark => ({ square, kind: "scatter", noLand: true, binds: "both", by: "chandy" })),
    ],
  };
}

/** Which of his powers stops `move` now (the screens' words): the beam (a held piece in it, or a wall), a scatter shot's square, a shield. */
export function chandyStop(f: ChandyStopFields | null, fen: string, move: string): "beam" | "scatter" | "shield" | null {
  if (!f) return null;
  return (marksStop(chandyMarks(f), fen, move)?.kind as "beam" | "scatter" | "shield" | undefined) ?? null;
}

// ---------------- What the screens get ----------------

/** His fields for the screens (NetBossPowers' `chandy`): this crowd turn's effects only. */
export interface ChandyView {
  locks: { square: string; left: number }[];
  upgrades: number;
  unlocked: ChandyMove[];
  /** The move meter, 0-1 (null: not started, before the first upgrade). */
  meter: number | null;
  /** The rage meter is dimmed: the rifle isn't whole yet (D9) and Dodge hasn't come (the last chance can bring it before). */
  rageLocked: boolean;
  scatter: { spot: string; squares: string[] } | null;
  beam: { rank: number; file: string; squares: string[] } | null;
  shields: { squares: string[] } | null;
  dizzy: string[];
  aim: string | null;
  shot: ChandyState["shot"];
  dodge: ChandyDodge | null;
}

export function chandyView(p: BossPowerState, s: ChandySettings = BOSS_POWERS.chandy): ChandyView | null {
  const c = p.chandy;
  if (!c) return null;
  const scatter = on(c.scatter, p.turn);
  const beam = on(c.beam, p.turn);
  const shields = on(c.shields, p.turn);
  return {
    locks: c.locks.map((l) => ({ square: l.square, left: lockLeft(c, l, s) })),
    upgrades: c.upgrades,
    unlocked: [...c.unlocked],
    meter: c.upgrades > 0 ? Math.min(1, c.meter / Math.max(1, s.meterEvery)) : null,
    rageLocked: !rifleWhole(c, s) && !p.ults,
    scatter: scatter ? { spot: scatter.spot, squares: [...scatter.squares] } : null,
    beam: beam ? { rank: beam.rank, file: beam.file, squares: [...beam.squares] } : null,
    shields: shields ? { squares: [...shields.squares] } : null,
    dizzy: [...(on(c.dizzy, p.turn)?.squares ?? [])],
    aim: c.aim?.square ?? null,
    shot: c.shot ? { ...c.shot } : null,
    // (The whole of it: online the server sends only what has been seen of it, dodgeSeen.)
    dodge: c.dodge ? { ...c.dodge, ...(c.dodge.volley ? { volley: c.dodge.volley.map((l) => ({ ...l })) } : {}), rounds: c.dodge.rounds.map((r) => ({ lines: r.lines.map((l) => ({ ...l })), teleports: r.teleports.map((x) => ({ ...x, to: { ...x.to } })), safe: r.safe })), results: c.dodge.results.map((r) => ({ ...r, votes: { ...r.votes } })) } : null,
  };
}

// ---------------- His part in the match runner ----------------

/**
 * His locks and the queen lock's aim after a move (`before`: the position before it): each follows its piece; one taken is gone; a
 * locked pawn that promotes to a queen is unlocked at once (never the queen, L1); the aim stays only on the queen or rook it was on.
 */
function followLocks(chandy: ChandyState, before: string, move: string): ChandyState {
  const c: ChandyState = { ...chandy };
  c.locks = locksAfter(before, move, c.locks).filter((l) => l.piece !== "q" || l.shot);
  if (c.aim) {
    // (The aim follows its piece, a queen or a rook (Nov 19), while it stays that piece: taken, or not there, it's gone.)
    const was = pieceAt(before, c.aim.square)?.type;
    const followed = was === "q" || was === "r" ? locksAfter(before, move, [{ square: c.aim.square, piece: was, at: 0 }])[0] : undefined;
    c.aim = followed && followed.piece === was ? { ...c.aim, square: followed.square } : null;
  }
  return c;
}

/**
 * An upgrade of his rifle (to chandy.upgradesMax; `fen`: the board as it will be on your turn, for the queen lock's "could it come
 * then"): its stage, the move it unlocks (unlockPick: the Lock-on Shot first while it could come then, chandy.queenLockFirst), shown as
 * crowd turn `turn` begins; the fifth makes the rifle whole. Past the fifth: nothing.
 */
function upgraded(c: ChandyState, fen: string, crowd: Side, seed: number, turn: number, s: ChandySettings = BOSS_POWERS.chandy): ChandyState {
  if (c.upgrades >= s.upgradesMax) return c;
  // (The queen lock first only when it could come now: a queen of yours (or, with none, a rook: Nov 19) with a save, the test queenLockOk
  // makes after his pass, on the board you'll move on. The review of #797: with a queen it can't aim at, the slot sat dead.)
  const queen = s.queenLockFirst && !c.unlocked.includes("queenlock") && sideToMove(fen) === crowd && queenLockAim(fen, crowd, seed, c.used) !== null;
  const unlock = unlockPick(c.unlocked, seed, c.upgrades, queen);
  const stage = c.upgrades + 1;
  return { ...c, upgrades: stage, upgrade: { turn, stage, ...(unlock ? { unlock } : {}) }, ...(unlock ? { unlocked: [...c.unlocked, unlock], fresh: unlock } : {}), ...(stage >= s.upgradesMax ? { whole: turn } : {}) };
}

export const chandyBattle = {
  /**
   * After the crowd's move (him to move): his locks and the queen lock's aim follow their pieces; the queen lock fires if it was
   * aimed (a base: the board changed outside a move); his meter takes a notch (from the first upgrade) and, full, picks his move; and
   * that's all: a taught capture's lock comes with his move (firstLock). Not once the battle is over on the board.
   */
  afterCrowdMove(b: Battle, move: string | null): void {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p?.chandy || boss.id !== "chandy" || boss.result) return;
    const s = BOSS_POWERS.chandy;
    const crowd = boss.crowdSide;
    const before = move ? fenBeforeLast(boardOf(b)) : null;
    let c: ChandyState = move && before ? followLocks(p.chandy, before, move) : { ...p.chandy };
    const fen = boardOf(b).fen;
    if (sideToMove(fen) === crowd || !legalMoves(fen).length) return setChandy(b, () => c);
    const events: PowerEvent[] = [];
    // (An upgrade shown as this turn began: its unlock fires now, below; read before the shot's own upgrade replaces it.)
    const shown = c.upgrade;
    // The queen lock fires at the start of his turn after its aim (Q5); then he plays his move. (Several bosses on one side: his own
    // next turn, as alone: hisTurn.)
    if (c.aim && c.aim.turn <= boss.crowdMoves && (b.hisTurn?.() ?? true)) {
      const shot = queenShot(fen, c.aim.square, crowd);
      c.shot = { at: boss.crowdMoves, square: shot.square, piece: shot.piece };
      events.push({ kind: "queenShot", turn: p.turn, square: shot.square ?? c.aim.square, squares: shot.trail, ...(shot.square ? { shape: shot.piece as "p" | "n" | "b" | "r" | "q" } : { fizzled: [c.aim.square] }) });
      // (The Lock-on Shot's round shattering a locked piece, or its target, is an upgrade, as a capture (Nov 24: the piece it would most
      // likely hit was locked as he aimed). Shown as your turn after his move begins, as a capture's.)
      const hit = !!shot.square && (shot.square === c.aim.square || c.locks.some((l) => l.square === shot.square));
      c.aim = null;
      if (shot.square) {
        setBoard(b, shot.fen);
        c.locks = c.locks.filter((l) => l.square !== shot.square);
      }
      // (Its lock goes with the shot, whatever it hit.)
      c.locks = c.locks.filter((l) => !l.shot);
      if (hit) c = upgraded(c, passTurn(boardOf(b).fen) ?? boardOf(b).fen, crowd, p.seed, turnOf(boss), s);
    }
    const now = boardOf(b).fen;
    // A new unlock fires at once (fireOnUnlock): your move after its upgrade window has the meter full and the unlock picked, whatever
    // the meter said; a queen lock that can't come now waits for the meter, as ever.
    const unlock = s.fireOnUnlock && shown?.unlock && shown.turn === boss.crowdMoves ? shown.unlock : null;
    if (unlock && (unlock !== "queenlock" || queenLockOk(now, crowd, p.seed, c.used))) {
      c.meter = s.meterEvery;
      c.due = unlock;
    } else {
      // The meter: one of your moves a notch, from the first upgrade (a move's test switch: full at once); full, his move.
      if (c.upgrades > 0 && !c.due) c.meter = moveTest(b.settings.bossPowerTest) ? s.meterEvery : Math.min(s.meterEvery, c.meter + 1);
      if (c.upgrades > 0 && c.meter >= s.meterEvery && (!c.due || c.due === "queenlock")) c.due = meterPick(c, p.seed, queenLockOk(now, crowd, p.seed, c.used) ? [] : ["queenlock"]);
    }
    setChandy(b, () => c, events);
  },

  /**
   * Each of his first captures (chandy.teachCaptures), as his move is about to show (`move`: the move he plays; him to move): the
   * crosshair locks onto the piece it takes (never the king; your queen too), his point (`lockOn` with `first`, this crowd turn's
   * moment while he still thinks; after the queen lock's shot when one came as this turn began), and the move shows after it (the
   * server holds it, solo waits: CHANDY_FX.lockOn). Returns the square; null: not one of those captures, or it's marked already.
   */
  firstLock(b: Battle, move: string): string | null {
    const boss = b.state.boss;
    const p = boss?.powers;
    const c = p?.chandy;
    if (!boss || !p || !c || boss.id !== "chandy" || boss.result || c.taught || c.locks.some((l) => !l.shot) || !b.bossToMove() || b.finalGameOver()) return null;
    const fen = boardOf(b).fen;
    // (The runner checks it against his allowed moves first: bossMoveMoment.)
    if (!legalMoves(fen).includes(move)) return null;
    const sq = capturedSquare(fen, move);
    const piece = sq ? pieceAt(fen, sq) : null;
    if (!sq || !piece || piece.color !== boss.crowdSide || piece.type === "k") return null;
    setChandy(b, (x) => ({ ...x, locks: [...x.locks.filter((l) => l.shot && l.square !== sq), { square: sq, piece: piece.type, at: x.moves }] }), [{ kind: "lockOn", turn: p.turn, square: sq, first: true }]);
    return sq;
  },

  /**
   * After his move (the crowd to move): a locked piece he took is an upgrade (and its unlock), and so are his first two captures of
   * your pieces (chandy.teachCaptures: firstLock marked each as the move showed; where nothing did, it counts all the same); his locks
   * follow; his move counts.
   */
  afterHisMove(b: Battle, move: string): void {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p?.chandy || boss.id !== "chandy" || boss.result) return;
    const s = BOSS_POWERS.chandy;
    const before = fenBeforeLast(boardOf(b));
    let c: ChandyState = { ...p.chandy, moves: p.chandy.moves + 1 };
    if (before) {
      const taken = capturedSquare(before, move);
      const victim = taken ? pieceAt(before, taken) : null;
      const first = !c.taught && !!victim && victim.color === boss.crowdSide && victim.type !== "k";
      // (Until his captures have taught it the only lock is a capture's mark: one on a piece his move didn't take goes.)
      if (!c.taught) c.locks = c.locks.filter((l) => l.shot || l.square === taken);
      if (first) {
        c.marked = (c.marked ?? 0) + 1;
        if (c.marked >= s.teachCaptures) c.taught = true;
      }
      const hit = first || (taken ? c.locks.some((l) => l.square === taken) : false);
      c.locks = locksAfter(before, move, c.locks);
      // (Shown as your next turn begins: everyTurn.)
      if (hit) c = upgraded(c, boardOf(b).fen, boss.crowdSide, p.seed, turnOf(boss), s);
    }
    setChandy(b, () => c);
  },

  /** Dodge is due: it came as this crowd turn began, not over (the crowd's turn waits for it). */
  dodgeDue(b: Battle): boolean {
    const boss = b.state.boss;
    const d = boss?.powers?.chandy?.dodge;
    return !!boss && !!d && d.at === boss.crowdMoves && !dodgeOver(d) && !boss.result && !b.finalGameOver() && !b.bossToMove();
  },

  /**
   * Dodge's round on closes (`votes`: each person's square, by player id; the bots' from the seed; only those still in vote): the
   * square played and whether it's a hit (dodgeTally). The hit that makes chandy.dodgeHits: the battle is his (`dodgeWin`); the
   * first only cracks the king. Returns the result; null: none due.
   */
  finishDodgeRound(b: Battle, votes: Readonly<Record<string, unknown>>): DodgeResult | null {
    const boss = b.state.boss;
    const p = boss?.powers;
    const d = p?.chandy?.dodge;
    if (!boss || !p || !d || dodgeOver(d) || d.at !== boss.crowdMoves) return null;
    const k = d.results.length;
    const all: Record<string, unknown> = {};
    for (const pl of b.alive()) {
      if (pl.isBot) all[pl.id] = botDodgeVote(d, k, pl.id, p.seed);
      else if (votes[pl.id] !== undefined) all[pl.id] = votes[pl.id];
    }
    const result = dodgeTally(d, k, all, p.seed);
    const results = [...d.results, result];
    const won = result.hit && dodgeHits({ results }) >= BOSS_POWERS.chandy.dodgeHits;
    setChandy(b, (c) => ({ ...c, dodge: { ...d, results } }), won ? [{ kind: "dodgeWin", turn: p.turn, square: result.placed }] : []);
    return result;
  },

  /**
   * The queen lock is due: the start of his turn, his meter's pick, with a queen (or a rook) to aim at and a cheap save (queenLockOk), not after
   * the pass guard had it wait this turn. It's his whole turn: no move of his follows it.
   */
  queenLockDue(b: Battle): boolean {
    const boss = b.state.boss;
    const p = boss?.powers;
    const c = p?.chandy;
    if (!boss || !p || !c || boss.id !== "chandy" || boss.result || !b.bossToMove() || b.finalGameOver()) return false;
    if (c.due !== "queenlock" || c.passWait === boss.crowdMoves) return false;
    return queenLockOk(boardOf(b).fen, boss.crowdSide, p.seed, c.used);
  },

  /** The queen lock from this device's engines (solo, the sims; online the host's, castAnswer: the pass guard). */
  async playQueenLock(b: Battle, engines: readonly EngineLike[]): Promise<string | null> {
    if (!chandyBattle.queenLockDue(b)) return null;
    return chandyBattle.applyQueenLock(b, await castAnswer(engines, boardOf(b).fen).catch(() => null));
  },

  /**
   * The queen lock's aim (his whole turn): `answer` PASS_WAIT (the host's pass guard): no aim, the meter's pick another unlocked move
   * (none: the queen lock stays due, checked again on his next turn), and he plays his move; anything else aims: the turn passes to
   * the crowd (a base), the aim on its target's square (her, or a rook), the meter spent, and the crowd's turn set up as after his move (its moment, the aim's). Returns the target's square; null: none was due, or it waits.
   */
  applyQueenLock(b: Battle, answer: string | null = null): string | null {
    if (!chandyBattle.queenLockDue(b)) return null;
    const boss = b.state.boss!;
    const p = boss.powers!;
    const c = chandyOf(p);
    if (answer === PASS_WAIT) {
      // (The meter picks another unlocked move instead, landing as your next turn begins: the review of #739, M1, the design's own
      // "else the meter picks another unlocked move". None can: the queen lock stays due, the meter full, checked again on his next
      // turn, as the pass guard has every power that spends his turn (Oct 18; it emptied the meter until Nov 18: right after his
      // first upgrade, mid-trade, that left the queen lock, his only move, dead until upgrade 2 in 10 battles of 20).)
      setChandy(b, (x) => ({ ...x, passWait: boss.crowdMoves, due: meterPick(x, p.seed, ["queenlock"]) ?? "queenlock" }));
      return null;
    }
    const board = boardOf(b);
    const passed = passTurn(board.fen);
    const queen = queenLockAim(passed, boss.crowdSide, p.seed, c.used);
    if (!passed || !queen) return null;
    setBoard(b, passed);
    b.boards.set(b.state.boards[0]!, { ...boardOf(b), expected: 1 - board.expected, lastMove: null });
    b.bossLast = null;
    // (The piece its round will most likely hit, decided now (shotVictim), locked as the aim shows: everyTurn.)
    const victim = shotVictim(passed, queen, boss.crowdSide, p.seed, c.used);
    setChandy(b, (x) => ({ ...x, moves: x.moves + 1, aim: { square: queen, turn: turnOf(boss), ...(victim && victim !== queen ? { victim } : {}) }, due: null, meter: 0, ...fired(x, "queenlock") }));
    b.bossPassed();
    return queen;
  },

  /** His hunting locks now (the steering's squares: the boss request's `lock`), or null: none, or not his move. Never before his captures have taught it: those moves are his engine's own. */
  steer(b: Battle): string[] | null {
    const boss = b.state.boss;
    const c = boss?.powers?.chandy;
    const hunting = c?.locks.filter((l) => !l.shot) ?? [];
    if (!boss || !c || boss.id !== "chandy" || !c.taught || !hunting.length || !b.bossToMove()) return null;
    return hunting.map((l) => l.square);
  },

  /** The test switch's move (`?power=lockon`, solo): until his captures have taught it, a capture whenever one nets him no loss (testCapture); else null. */
  testMove(b: Battle, allowed: readonly string[] | null): string | null {
    const boss = b.state.boss;
    const c = boss?.powers?.chandy;
    if (!boss || !c || boss.id !== "chandy" || c.taught || b.settings.bossPowerTest !== "lockon" || !b.bossToMove()) return null;
    return testCapture(boardOf(b).fen, boss.crowdSide, boss.powers!.seed, allowed);
  },
};

