/**
 * Boss powers: the rules each power answers, from the boss template (core's BOSS_ROSTER). Pure functions of the
 * battle's state and the position, so the server, the solo game and every screen work out the same thing: which
 * moves the crowd (and the boss) may play this turn, what happens as a turn begins, what each player sees, and
 * whether a turn counts for fair play. The ground rules:
 *
 * - The server decides every power, from the battle's seed (drawn once, as it starts) and the position.
 * - A power never leaves anyone without a legal move and never breaks check: if a restriction would leave no legal
 *   move (or no escape from check), it lifts for that turn. The king is never frozen.
 * - The judge plays by the same rules: the best move is the best of the allowed ones (judge.ts, runner.ts).
 * - A turn the boss plays for the crowd (the funhouse) isn't scored; any turn a power touches doesn't count for
 *   fair play.
 *
 * Turns are the crowd's: turn N is the crowd's Nth move of the battle (crowdMoves + 1 while it's being picked).
 */
import {
  BOSS_POWERS,
  bossDef,
  mulberry32,
  type BossPowerSettings,
  type BossPowerState,
  type BossState,
  type BurnEvent,
  type CandleWave,
  type DarkSquare,
  type FireTile,
  type LightsOutRound,
  type LightsOutTarget,
  type PowerEvent,
  type PowerId,
} from "@chessroyale/core";
import { applyMove, kingAttacked, legalMoves, pieceAt, positionOver, withoutPiece } from "./rules.ts";
import type { EngineLike } from "./runner.ts";
import type { MoveScore } from "./uci.ts";

type Side = "w" | "b";
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const other = (s: Side): Side => (s === "w" ? "b" : "w");
const from = (m: string) => m.slice(0, 2);
const to = (m: string) => m.slice(2, 4);

/** Material on the board for one side (pawns 1, knights and bishops 3, rooks 5, queens 9). */
export function materialOf(fen: string, side: Side): number {
  let total = 0;
  for (const c of fen.split(" ")[0]!) {
    const v = VALUE[c.toLowerCase()];
    if (v && (c === c.toUpperCase()) === (side === "w")) total += v;
  }
  return total;
}

/** A number in [0, 1) from the battle's seed and what it's for: the same on every device and every replay. */
export function powerRoll(seed: number, ...parts: readonly (string | number)[]): number {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  for (const ch of parts.join("|")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return mulberry32(h)();
}

/** The boss's powers, if it has any (its template's passive and ultimate). */
export function bossPowers(boss: Pick<BossState, "id"> | null | undefined): { passive: PowerId; ultimate: PowerId } | null {
  return bossDef(boss?.id)?.powers ?? null;
}

/** A battle's powers as it starts (nothing has happened yet; the first turn is set up by prepareTurn). */
export function initPowers(seed: number, fen: string, crowdSide: Side): BossPowerState {
  return { seed: seed >>> 0, turn: 0, material: materialOf(fen, other(crowdSide)), lost: 0, nextPassive: BOSS_POWERS.firstPassive, events: [] };
}

/** The crowd turn being picked now. */
const turnOf = (boss: Pick<BossState, "crowdMoves">) => boss.crowdMoves + 1;

/** The legal moves of the side not to move (as if it were its turn): what a square would block for the boss. */
function movesOfOther(fen: string): string[] {
  const parts = fen.split(" ");
  parts[1] = parts[1] === "w" ? "b" : "w";
  parts[3] = "-";
  try {
    return legalMoves(parts.join(" "));
  } catch {
    return [];
  }
}

/**
 * Freeze: the piece to ice, one that matters (the most valuable and mobile of the crowd's pieces: a pick from the
 * top three), never the king, never a piece without a move, and never one whose freeze leaves no other legal move.
 */
export function chooseFreeze(fen: string, crowdSide: Side, seed: number, turn: number, pie?: string | null): { square: string; piece: string } | null {
  const legal = legalMoves(fen).filter((m) => to(m) !== pie);
  const moves = new Map<string, number>();
  for (const m of legal) moves.set(from(m), (moves.get(from(m)) ?? 0) + 1);
  const options = [...moves.entries()]
    .map(([square, n]) => ({ square, n, piece: pieceAt(fen, square) }))
    .filter((o) => o.piece && o.piece.color === crowdSide && o.piece.type !== "k" && legal.length - o.n > 0)
    // Pieces before pawns; then the most valuable and mobile. Ties by square, so every device ranks alike.
    .map((o) => ({ ...o, score: (o.piece!.type === "p" ? 0 : 100) + VALUE[o.piece!.type]! * 3 + o.n }))
    .sort((a, b) => b.score - a.score || (a.square < b.square ? -1 : 1));
  if (!options.length) return null;
  const top = options.slice(0, 3);
  const pick = top[Math.floor(powerRoll(seed, "freeze", turn) * top.length)]!;
  return { square: pick.square, piece: pick.piece!.type };
}

const CENTRE = ["d4", "e4", "d5", "e5", "c3", "d3", "e3", "f3", "c4", "f4", "c5", "f5", "c6", "d6", "e6", "f6"];
const centreDistance = (sq: string) => Math.abs(sq.charCodeAt(0) - 100.5) + Math.abs(Number(sq[1]) - 4.5);

/**
 * Pie: the square to pie, an empty one near the centre chosen so the position barely changes: the fewest moves of
 * either side can land there right now (none, if possible), nearest the middle first, a pick from the best few.
 */
export function choosePie(fen: string, seed: number, turn: number): string | null {
  const reach = new Map<string, number>();
  for (const m of [...legalMoves(fen), ...movesOfOther(fen)]) reach.set(to(m), (reach.get(to(m)) ?? 0) + 1);
  const empty = CENTRE.filter((sq) => !pieceAt(fen, sq))
    .map((sq) => ({ sq, reach: reach.get(sq) ?? 0, d: centreDistance(sq) }))
    .sort((a, b) => a.reach - b.reach || a.d - b.d || (a.sq < b.sq ? -1 : 1));
  if (!empty.length) return null;
  const least = empty.filter((e) => e.reach === empty[0]!.reach).slice(0, 4);
  return least[Math.floor(powerRoll(seed, "pie", turn) * least.length)]!.sq;
}

// ---------------- The ultimate's meter ----------------

/** The rates the meter fills at (BOSS_POWERS). */
export type RageRates = Pick<BossPowerSettings, "rageFull" | "rageOverTime" | "ragePerMove" | "rageAheadMax" | "rageAheadFull" | "ragePerMaterial">;

/**
 * One crowd move's worth of rage over time: ragePerMove, plus up to rageAheadMax more while the crowd is ahead on the
 * judged eval (`judged`: its expected score after the move, 0-1; all of it from rageAheadFull). Nothing with the
 * switch off (rageOverTime).
 */
export function rageTick(judged: number | undefined, s: RageRates = BOSS_POWERS): number {
  if (!s.rageOverTime) return 0;
  const ahead = judged === undefined ? 0 : Math.max(0, Math.min(1, (judged - 0.5) / Math.max(0.01, s.rageAheadFull - 0.5)));
  return s.ragePerMove + s.rageAheadMax * ahead;
}

/** Rage points: the charge from time and the eval, plus the boss's own material lost (a queen's worth fills it). */
export function ragePoints(p: Pick<BossPowerState, "charge" | "lost">, s: RageRates = BOSS_POWERS): number {
  return (p.charge ?? 0) + p.lost * s.ragePerMaterial;
}

/**
 * As a crowd turn begins (after the boss's move, or as the battle starts): the rage meter, the ultimate's warning
 * and the ultimate, and the passive. `fen` is the position with the crowd to move. Once per turn: calling it again
 * for the same turn (the re-pick after the God King's Last Stand) changes nothing. `test`: an ultimate (the test switch)
 * warned as the second turn begins and unleashed on the third (the passive comes on the second turn anyway).
 * The test trigger (an admin's, `ultNext`) brings the ultimate as this turn begins, without the warning. `lastMove`: the
 * boss's move just played (Hollow covers its piece's square after his first).
 */
export function prepareTurn(boss: BossState, fen: string, test = "", s: BossPowerSettings = BOSS_POWERS, lastMove: string | null = null): BossState {
  const powers = bossPowers(boss);
  const p = boss.powers;
  if (!powers || !p) return boss;
  const turn = turnOf(boss);
  if (p.turn === turn) return boss;
  const crowd = boss.crowdSide;
  const events: PowerEvent[] = [];
  const lost = Math.max(p.lost, p.material - materialOf(fen, other(crowd)));
  // The meter over time: each crowd move since the last turn began, faster while the crowd is ahead on the judged eval.
  const moved = p.turn > 0 ? Math.max(0, turn - p.turn) : 0;
  const charge = (p.charge ?? 0) + moved * rageTick(p.judged, s);
  const ult = powers.ultimate;
  // (Lights out comes at the start of his turn, not as the crowd's begins: the trigger waits for it there.)
  const { ultNext, ...rest } = p;
  const next: BossPowerState = { ...rest, turn, lost, charge, events, ...(ultNext && ult === "lightsout" ? { ultNext } : {}) };
  // What wore off: the ice after its turns (or once its piece is gone), the pie after its turns.
  if (next.frozen) {
    const piece = pieceAt(fen, next.frozen.square);
    if (next.frozen.until < turn || piece?.color !== crowd || piece.type !== next.frozen.piece) next.frozen = null;
  }
  if (next.pie && next.pie.until < turn) next.pie = null;
  // The ultimate: the rage meter full, a warning as this turn begins; the next turn, the ultimate. Once a match.
  let ultNow = false;
  if (next.ultAt === undefined && ult === "lightsout") {
    // Hollow's Lights out: the meter full as this turn begins, it comes at the start of his turn after the crowd's move
    // (lightsOutDue). The full meter is its only warning (no "RAGE!"). The test switch: the meter fills as the second
    // turn begins.
    if (ragePoints(next, s) >= s.rageFull || (test === ult && turn >= 2)) next.ultAt = turn;
  } else if (next.ultAt === undefined) {
    if (ultNext) {
      // (The test trigger: straight to the ultimate.)
      next.ultAt = turn;
      ultNow = true;
    } else if (next.warnAt === undefined) {
      // (The test switch: warned as the second turn begins, after the boss's first move, as in play.)
      if (ragePoints(next, s) >= s.rageFull || (test === ult && turn >= 2)) {
        next.warnAt = turn;
        events.push({ kind: "warn", turn });
      }
    } else if (turn > next.warnAt) {
      next.ultAt = turn;
      ultNow = true;
    }
    // (The funhouse's moment is the move it plays: added when it's played.)
    if (ultNow && ult === "blizzard") events.push({ kind: "blizzard", turn });
    if (ultNow && ult === "candle") {
      next.candle = { at: turn, left: s.candleShots };
      events.push({ kind: "candle", turn });
    }
  }
  // The Roman candle's fireballs: a wave a crowd turn from candleDelay turns after it fired, each landing as a fresh fire
  // tile; each wave's squares picked candleAhead turns before it lands (their shadows growing meanwhile).
  if (next.candle) {
    const barrage = candleTurn(next, fen, crowd, turn, s);
    next.candle = barrage.candle;
    if (barrage.fire) next.fire = barrage.fire;
    if (barrage.event) events.push(barrage.event);
  }
  // The passive (not on the ultimate's turn: it waits a turn).
  const passive = powers.passive;
  if (passive === "dark") {
    // Hollow's dark: the squares whose turns are over clear; after his first move and every darkEvery-th after it, he
    // covers another. His bulbs count down to it.
    const old = next.dark ?? [];
    next.dark = old.filter((d) => d.until >= turn);
    next.cleared = old.filter((d) => d.until < turn).map((d) => d.square);
    const n = hisMoves(turn);
    if (coversAfter(n, s)) {
      const square = chooseDark(fen, crowd, p.seed, turn, next.dark, n === 1 && lastMove ? to(lastMove) : null);
      if (square) {
        next.dark = [...next.dark, { square, at: turn, until: turn + s.darkTurns - 1 }];
        events.push({ kind: "dark", turn, square, ...(n === 1 ? { first: true as const } : {}) });
      }
    }
    next.bulbs = bulbsAt(turn, s);
  } else if (ultNow && turn >= next.nextPassive) next.nextPassive = turn + 1;
  else if (passive === "sparkler") {
    // A sparkler when no tile is burning, a full turn after the last fire went out; paused through the candle's barrage.
    const barrage = !!next.candle && (next.candle.left > 0 || !!next.fire?.length);
    const ready = !next.fire?.length && turn >= next.nextPassive && (next.fireOut === undefined || turn > next.fireOut + s.fireGap);
    if (!barrage && ready) {
      const square = chooseSpark(fen, crowd, p.seed, turn, next.fire ?? []);
      if (square) {
        next.fire = [{ square, lit: turn }];
        events.push({ kind: "spark", turn, square });
        next.nextPassive = turn + s.fireStages + s.fireGap;
      } else next.nextPassive = turn + 1;
    }
  } else if (turn >= next.nextPassive) {
    if (passive === "freeze") {
      const pick = chooseFreeze(fen, crowd, p.seed, turn, next.pie?.square);
      if (pick) {
        next.frozen = { ...pick, until: turn + s.freezeTurns - 1 };
        events.push({ kind: "freeze", turn, square: pick.square });
        const [lo, hi] = s.freezeEvery;
        next.nextPassive = turn + lo + Math.floor(powerRoll(p.seed, "every", turn) * (hi - lo + 1));
      } else next.nextPassive = turn + 1;
    } else if (passive === "pie") {
      const square = choosePie(fen, p.seed, turn);
      if (square) {
        next.pie = { square, until: turn + s.pieTurns - 1 };
        events.push({ kind: "pie", turn, square });
        next.nextPassive = turn + s.pieTurns + s.pieGap;
      } else next.nextPassive = turn + 1;
    }
  }
  return { ...boss, powers: next };
}

// ---------------- G-REX: fire ----------------

/** The crowd's half of the board (ranks 1-4 for White, 5-8 for Black). */
function crowdHalf(crowd: Side): string[] {
  const out: string[] = [];
  for (const f of "abcdefgh") for (let r = crowd === "w" ? 1 : 5; r <= (crowd === "w" ? 4 : 8); r++) out.push(`${f}${r}`);
  return out;
}
const kingSquare = (fen: string, side: Side) => {
  for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) if (pieceAt(fen, `${f}${r}`)?.type === "k" && pieceAt(fen, `${f}${r}`)?.color === side) return `${f}${r}`;
  return null;
};
const apart = (a: string, b: string) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])));

/** The sparkler's square: a random one on the crowd's half, empty or not, never the crowd king's, never on fire. */
export function chooseSpark(fen: string, crowd: Side, seed: number, turn: number, fire: readonly FireTile[] = []): string | null {
  const king = kingSquare(fen, crowd);
  const burning = new Set(fire.map((t) => t.square));
  const options = crowdHalf(crowd).filter((sq) => sq !== king && !burning.has(sq));
  return options.length ? options[Math.floor(powerRoll(seed, "spark", turn) * options.length)]! : null;
}

/**
 * A wave of the Roman candle's fireballs: `n` squares on the crowd's half, never the crowd king's, never one already on
 * fire, spread out (none next to another tile if it can be helped). The same everywhere, from the seed.
 */
export function chooseFireballs(fen: string, crowd: Side, seed: number, turn: number, n: number, fire: readonly FireTile[] = []): string[] {
  const king = kingSquare(fen, crowd);
  const taken = fire.map((t) => t.square);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const free = crowdHalf(crowd).filter((sq) => sq !== king && !taken.includes(sq) && !out.includes(sq));
    if (!free.length) break;
    // (Away from every tile if it can be; else at least from this wave's.)
    const spread = free.filter((sq) => [...taken, ...out].every((t) => apart(sq, t) >= 2));
    const inWave = free.filter((sq) => out.every((t) => apart(sq, t) >= 2));
    const pool = spread.length ? spread : inWave.length ? inWave : free;
    out.push(pool[Math.floor(powerRoll(seed, "fireball", turn, i) * pool.length)]!);
  }
  return out;
}

/** The crowd turn wave `i` of the Roman candle's schedule lands on (he fired on crowd turn `at`). */
export const candleLands = (at: number, i: number, s: Pick<BossPowerSettings, "candleDelay"> = BOSS_POWERS) => at + s.candleDelay + i;

/**
 * The Roman candle's barrage as a crowd turn begins: the waves due land, each fireball a stage-1 fire tile (one on the
 * crowd king's square fizzles: never on his square), then the waves whose time has come are picked, candleAhead turns
 * before they land: spread out (chooseFireballs), never on the king's square or one that will be burning or hit before
 * then. Returns the candle and the fire tiles after it, and the turn's fireball event if a wave landed. Pure: the same
 * everywhere, from the seed.
 */
export function candleTurn(
  p: Pick<BossPowerState, "candle" | "fire" | "seed">,
  fen: string,
  crowd: Side,
  turn: number,
  s: Pick<BossPowerSettings, "candleWaves" | "candleDelay" | "candleAhead" | "fireStages"> = BOSS_POWERS,
): { candle: BossPowerState["candle"]; fire: FireTile[] | undefined; event: PowerEvent | null } {
  const c = p.candle;
  if (!c) return { candle: c, fire: p.fire, event: null };
  let waves: CandleWave[] = c.waves ?? [];
  let left = c.left;
  let fire = p.fire;
  let event: PowerEvent | null = null;
  // Land what's due.
  const due = waves.filter((w) => w.lands <= turn);
  if (due.length) {
    const king = kingSquare(fen, crowd);
    const burning = new Set((fire ?? []).map((t) => t.square));
    const squares = due.flatMap((w) => w.squares);
    const fizzled = squares.filter((sq) => sq === king || burning.has(sq));
    fire = [...(fire ?? []), ...squares.filter((sq) => !fizzled.includes(sq)).map((square) => ({ square, lit: turn }))];
    left = Math.max(0, left - due.reduce((t, w) => t + w.shots, 0));
    waves = waves.filter((w) => w.lands > turn);
    event = { kind: "fireball", turn, squares, ...(fizzled.length ? { fizzled } : {}) };
  }
  // Pick the waves whose time has come (their shots still unassigned: the schedule's, then the rest in one).
  let nextWave = c.next ?? 0;
  const ahead = Math.max(0, Math.min(s.candleAhead, s.candleDelay));
  let unpicked = left - waves.reduce((t, w) => t + w.shots, 0);
  while (unpicked > 0 && candleLands(c.at, nextWave, s) - ahead <= turn) {
    const lands = Math.max(turn + 1, candleLands(c.at, nextWave, s));
    const shots = Math.min(unpicked, s.candleWaves[nextWave] ?? unpicked);
    // (What will be burning as it lands: tiles not yet burnt out by then, and the waves landing before it.)
    const taken: FireTile[] = [
      ...(fire ?? []).filter((t) => t.lit + s.fireStages - 1 >= lands),
      ...waves.flatMap((w) => w.squares.map((square) => ({ square, lit: w.lands }))),
    ];
    waves = [...waves, { lands, shots, squares: chooseFireballs(fen, crowd, p.seed, lands, shots, taken) }];
    unpicked -= shots;
    nextWave++;
  }
  return { candle: { ...c, left, next: nextWave, waves }, fire, event };
}

/** A shadow's size on a crowd turn: 1 (small) when its wave is candleAhead turns out, up to candleAhead (lands next turn). */
export const shadowStage = (lands: number, turn: number, s: Pick<BossPowerSettings, "candleAhead"> = BOSS_POWERS) => s.candleAhead - (lands - turn) + 1;

/** Where the Roman candle's fireballs are coming down: each square still to be hit, the turn it lands, its shadow's size. */
export function fireShadows(p: Pick<BossPowerState, "candle" | "turn"> | null | undefined, s: Pick<BossPowerSettings, "candleAhead"> = BOSS_POWERS): { square: string; lands: number; stage: number }[] {
  return (p?.candle?.waves ?? []).flatMap((w) => w.squares.map((square) => ({ square, lands: w.lands, stage: Math.max(1, shadowStage(w.lands, p!.turn, s)) })));
}

/** A fire tile's stage on a crowd turn: 1 (a singe) as it lands, up to fireStages (ablaze). */
export const fireStage = (t: FireTile, turn: number) => turn - t.lit + 1;

/** The tiles ablaze this crowd turn: a crowd piece left on one after the crowd's move burns. */
export function ablaze(boss: BossState | null | undefined, s: Pick<BossPowerSettings, "fireStages"> = BOSS_POWERS): string[] {
  const fire = boss?.powers?.fire;
  if (!boss || !fire?.length) return [];
  const turn = turnOf(boss);
  return fire.filter((t) => fireStage(t, turn) >= s.fireStages).map((t) => t.square).sort();
}

/**
 * What the fire does to a position (after the crowd's move, `crowd` its side): each crowd piece on a tile in `burn`
 * is destroyed, but never the king (the tile fizzles), and never a piece whose loss would leave a king in check (its
 * own exposed, or the boss's checked by it: the tile fizzles too). Nothing burns once the game is over. Tiles in
 * square order, each with what burnt before it.
 */
export function burnOutcome(fen: string, burn: readonly string[], crowd: Side): { fen: string; burnt: { square: string; piece?: string; fizzled?: boolean }[] } {
  const out: { square: string; piece?: string; fizzled?: boolean }[] = [];
  if (!burn.length || positionOver(fen)) return { fen, burnt: out };
  let now = fen;
  for (const square of [...burn].sort()) {
    const piece = pieceAt(now, square);
    if (!piece || piece.color !== crowd) continue;
    if (piece.type === "k") {
      out.push({ square, fizzled: true });
      continue;
    }
    const after = withoutPiece(now, square);
    if (kingAttacked(after, crowd) || (!kingAttacked(now, other(crowd)) && kingAttacked(after, other(crowd)))) {
      out.push({ square, fizzled: true });
      continue;
    }
    now = after;
    out.push({ square, piece: piece.type });
  }
  return { fen: now, burnt: out };
}

/**
 * After the crowd's move (the boss state already counting it): the tiles that were ablaze burn out, destroying what
 * burnOutcome says; the God King's warning the first time a crowd piece steps onto a burning tile. Returns the new
 * state, the position after the fire, and the squares emptied.
 */
export function fireAfterMove(boss: BossState, fen: string, move: string | null, s: Pick<BossPowerSettings, "fireStages"> = BOSS_POWERS): { boss: BossState; fen: string; emptied: string[] } {
  const p = boss.powers;
  if (!p?.fire?.length) return { boss, fen, emptied: [] };
  const turn = boss.crowdMoves;
  const due = p.fire.filter((t) => fireStage(t, turn) >= s.fireStages);
  // (Stepping onto a tile that isn't ablaze yet: there's still time to leave.)
  const stepped = p.stepped ?? (move && p.fire.some((t) => t.square === to(move) && fireStage(t, turn) < s.fireStages) ? turn : undefined);
  const result = burnOutcome(fen, due.map((t) => t.square), boss.crowdSide);
  const fire = p.fire.filter((t) => !due.includes(t));
  // (A tile with nothing of the crowd's on it just burns out.)
  const burnt: BurnEvent[] = due.map((t) => ({ turn, square: t.square, ...result.burnt.find((b) => b.square === t.square) })).sort((a, b) => (a.square < b.square ? -1 : 1));
  const powers: BossPowerState = {
    ...p,
    fire,
    burnt,
    ...(stepped !== undefined ? { stepped } : {}),
    ...(due.length && !fire.length ? { fireOut: turn } : {}),
  };
  return { boss: { ...boss, powers }, fen: result.fen, emptied: result.burnt.filter((b) => b.piece).map((b) => b.square) };
}

/** How much of the crowd's material a move leaves to the fire this turn (pawn 1 ... queen 9). */
export function fireLoss(fen: string, move: string, burn: readonly string[], crowd: Side): number {
  if (!burn.length) return 0;
  let after: string;
  try {
    after = applyMove(fen, move);
  } catch {
    return 0;
  }
  return burnOutcome(after, burn, crowd).burnt.reduce((t, b) => t + (b.piece ? VALUE[b.piece]! : 0), 0);
}

const logit = (x: number) => {
  const q = Math.min(0.999, Math.max(0.001, x));
  return Math.log(q / (1 - q));
};

/**
 * The judge treats a piece left on a tile ablaze as already gone: a move's expected score with what it leaves to the
 * fire taken off (firePawnLogit log-odds a pawn of value), so saving the piece is never scored as a mistake.
 */
export function fireExpected(expected: number, lost: number, s: Pick<BossPowerSettings, "firePawnLogit"> = BOSS_POWERS): number {
  if (lost <= 0) return expected;
  return 1 / (1 + Math.exp(-(logit(expected) - lost * s.firePawnLogit)));
}

/**
 * A board's evaluation as the fire's judge sees it (this turn's tiles ablaze, `burn`): every move's expected score less
 * what it leaves to burn, and the best move the best of those. Unchanged without fire. Pure: every device, the host
 * and the lobby work out the same numbers from the same evaluation.
 */
export function fireJudged<E extends { bestMove: string; bestExpected: number; expectedAfter: Record<string, number> }>(evaluation: E, fen: string, burn: readonly string[], crowd: Side): E {
  if (!burn.length) return evaluation;
  const expectedAfter = Object.fromEntries(Object.entries(evaluation.expectedAfter).map(([m, e]) => [m, fireExpected(e, fireLoss(fen, m, burn, crowd))]));
  const best = expectedAfter[evaluation.bestMove] ?? fireExpected(evaluation.bestExpected, fireLoss(fen, evaluation.bestMove, burn, crowd));
  let bestMove = evaluation.bestMove;
  let bestExpected = best;
  for (const [m, e] of Object.entries(expectedAfter).sort((a, b) => (a[0] < b[0] ? -1 : 1))) if (e > bestExpected) [bestMove, bestExpected] = [m, e];
  return { ...evaluation, bestMove, bestExpected, expectedAfter };
}

/** Top moves as the fire's judge ranks them (for bots and hints): expected less what each leaves to burn, best first. */
export function fireRanked(top: readonly MoveScore[], fen: string, burn: readonly string[], crowd: Side): MoveScore[] {
  if (!burn.length) return [...top];
  return top.map((m) => ({ ...m, expected: fireExpected(m.expected, fireLoss(fen, m.move, burn, crowd)) })).sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1));
}

/** The moves that take a crowd piece off a tile ablaze (the judge scores them all, so saving it is always on the table). */
export function fireEscapes(fen: string, burn: readonly string[]): string[] {
  if (!burn.length) return [];
  const on = new Set(burn);
  return legalMoves(fen).filter((m) => on.has(from(m)));
}


// ---------------- Hollow: the dark ----------------

/** His moves made as a crowd turn begins: the crowd (White, from the starting position) moves first. */
const hisMoves = (turn: number) => Math.max(0, turn - 1);

/** He covers a square after his `n`th move: his first, then every darkEvery-th (his 4th, 7th, 10th…). */
export const coversAfter = (n: number, s: Pick<BossPowerSettings, "darkEvery"> = BOSS_POWERS) => n >= 1 && (n - 1) % s.darkEvery === 0;

/**
 * His bulbs still lit as a crowd turn begins: his moves until he next covers a square (one goes out with each move;
 * the last as he covers, and they relight). 1 before his first move, then 3, 2, 1, 3, 2, 1…
 */
export function bulbsAt(turn: number, s: Pick<BossPowerSettings, "darkEvery"> = BOSS_POWERS): number {
  const n = hisMoves(turn);
  const next = n < 1 ? 1 : 1 + Math.ceil(n / s.darkEvery) * s.darkEvery;
  return next - n;
}

/** Every piece's square on the board, by side, kings apart. */
function occupied(fen: string): { w: string[]; b: string[]; kings: string[] } {
  const out = { w: [] as string[], b: [] as string[], kings: [] as string[] };
  fen
    .split(" ")[0]!
    .split("/")
    .forEach((row, r) => {
      let f = 0;
      for (const c of row) {
        if (c >= "1" && c <= "8") f += Number(c);
        else {
          const sq = `${"abcdefgh"[f]}${8 - r}`;
          if (c.toLowerCase() === "k") out.kings.push(sq);
          else out[c === c.toUpperCase() ? "w" : "b"].push(sq);
          f++;
        }
      }
    });
  return out;
}

/**
 * The square he covers: after his first move, the square of the piece he just moved (`moved`); later, a random
 * occupied square from the seed, his or the crowd's (a coin flip for whose, so roughly half each), never a king's,
 * never one already dark. Null when there's none.
 */
export function chooseDark(fen: string, crowd: Side, seed: number, turn: number, dark: readonly DarkSquare[] = [], moved?: string | null): string | null {
  const taken = new Set(dark.map((d) => d.square));
  const board = occupied(fen);
  if (moved && !taken.has(moved) && !board.kings.includes(moved) && pieceAt(fen, moved)) return moved;
  const mine = powerRoll(seed, "dark-side", turn) < 0.5 ? crowd : other(crowd);
  const pick = (side: Side) => board[side].filter((sq) => !taken.has(sq));
  const pool = pick(mine).length ? pick(mine) : pick(other(mine));
  return pool.length ? pool[Math.floor(powerRoll(seed, "dark", turn) * pool.length)]! : null;
}

/** The dark squares as this crowd turn stands (for the board and the judge of move attempts). */
export const darkSquares = (boss: Pick<BossState, "powers"> | null | undefined): string[] => (boss?.powers?.dark ?? []).map((d) => d.square);

/**
 * The squares a move touches: where it starts and lands, every square it passes over on its way (a slide along a
 * rank, file or diagonal; a pawn's double step), and a castling king's way on to his rook's corner (`fen` says it's a
 * king). A knight's jump passes over nothing.
 */
export function moveSquares(move: string, fen?: string): string[] {
  const a = from(move);
  const b = to(move);
  const out = [a, b];
  const f0 = a.charCodeAt(0) - 97;
  const r0 = Number(a[1]) - 1;
  const df = b.charCodeAt(0) - 97 - f0;
  const dr = Number(b[1]) - 1 - r0;
  const sq = (f: number, r: number) => `${"abcdefgh"[f]}${r + 1}`;
  if (df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr)) {
    const n = Math.max(Math.abs(df), Math.abs(dr));
    for (let k = 1; k < n; k++) out.push(sq(f0 + Math.sign(df) * k, r0 + Math.sign(dr) * k));
  }
  if (fen && dr === 0 && Math.abs(df) === 2 && pieceAt(fen, a)?.type === "k") {
    // (Castling: his way past the square he lands on, to the rook's corner.)
    for (let f = f0 + df + Math.sign(df); f >= 0 && f <= 7; f += Math.sign(df)) out.push(sq(f, r0));
  }
  return out;
}

/** A move attempt touches the dark (starts on a dark square, lands on one or passes over one). */
export const touchesDark = (move: string, dark: readonly string[], fen?: string): boolean => dark.length > 0 && moveSquares(move, fen).some((sq) => dark.includes(sq));

/**
 * A move attempt sent unchecked because it touches the dark, as the judge reads it: the legal move it is (a pawn's
 * move to the last rank without a piece named becomes a queen), or null when it isn't one.
 */
export function darkAttempt(fen: string, move: string): string | null {
  const legal = legalMoves(fen);
  if (legal.includes(move)) return move;
  if (move.length === 4 && legal.includes(`${move}q`)) return `${move}q`;
  return null;
}

// ---------------- Hollow: Lights out ----------------

/** His Lights out comes now: the start of his turn, from the full meter (or the test trigger), once a match. */
export const lightsOutDue = (boss: BossState | null | undefined): boolean => {
  const p = boss?.powers;
  return !!p && !boss!.result && bossPowers(boss)?.ultimate === "lightsout" && !p.lightsOut && (!!p.ultNext || p.ultAt === boss!.crowdMoves);
};

/** Where each kind of his pieces starts, by file (the back rank, or the pawns' rank). */
const HOME_FILES: Record<string, string> = { k: "e", q: "d", r: "ah", b: "cf", n: "bg", p: "abcdefgh" };
/** A piece of `side` still on a square it starts the game on (it may never have moved: anyone could find it). */
export const onStartSquare = (type: string, square: string, side: Side): boolean =>
  (HOME_FILES[type] ?? "").includes(square[0]!) && square[1] === (type === "p" ? (side === "w" ? "2" : "7") : side === "w" ? "1" : "8");

/** The squares that answer a target: every piece of the type (a pawn: those on its file). */
const answersOf = (t: LightsOutTarget, mine: readonly { square: string; type: string }[]) =>
  mine.filter((x) => x.type === t.type && (!t.file || x.square[0] === t.file)).map((x) => x.square);

/**
 * Lights out's rounds: what he names in each (BOSS_POWERS.lightsOutRounds: 1, 2, then 3 pieces), from the seed, never
 * anything trivial (Eric, Oct 9): only pieces that have left their starting squares.
 * - A type is named only if every piece he has of it has moved ("Find my queen."; two or more: "Find one of my
 *   rooks.", any of them counts), else the one left at home would give it away.
 * - A pawn is named by its file, and only a moved pawn alone on its file ("Find my pawn on the c-file.").
 * - Nothing is named twice in the test. Pieces before pawns, each in a random order from the seed.
 * - Not enough of those (an early or a test game): as a last resort, types with a piece at home, then pawns at home
 *   alone on their file, then any file of pawns ("one of my pawns on the c-file"). A round with nothing left to name
 *   is dropped.
 * Each round's answers are every square that answers one of its targets.
 */
export function chooseLightsOut(fen: string, side: Side, seed: number, s: Pick<BossPowerSettings, "lightsOutRounds"> = BOSS_POWERS): LightsOutRound[] {
  const mine: { square: string; type: string }[] = [];
  for (const f of "abcdefgh")
    for (let r = 1; r <= 8; r++) {
      const pc = pieceAt(fen, `${f}${r}`);
      if (pc?.color === side) mine.push({ square: `${f}${r}`, type: pc.type });
    }
  const order = <T>(xs: T[], key: (x: T) => string) => xs.map((x) => ({ x, k: powerRoll(seed, "lights", key(x)) })).sort((a, b) => a.k - b.k).map((e) => e.x);
  const types = [..."kqrbn"].filter((t) => mine.some((x) => x.type === t));
  const moved = (xs: typeof mine) => xs.every((x) => !onStartSquare(x.type, x.square, side));
  const ofType = (t: string) => mine.filter((x) => x.type === t);
  const pawnsOn = (f: string) => mine.filter((x) => x.type === "p" && x.square[0] === f);
  const files = [..."abcdefgh"].filter((f) => pawnsOn(f).length > 0);
  const typeTarget = (t: string): LightsOutTarget => ({ type: t, ...(ofType(t).length > 1 ? { several: true } : {}) });
  const pawnTarget = (f: string): LightsOutTarget => ({ type: "p", file: f, ...(pawnsOn(f).length > 1 ? { several: true } : {}) });
  const lone = files.filter((f) => pawnsOn(f).length === 1);
  const candidates = [
    ...order(types.filter((t) => moved(ofType(t))), (t) => t).map(typeTarget),
    ...order(lone.filter((f) => moved(pawnsOn(f))), (f) => `p${f}`).map(pawnTarget),
    // The last resort: pieces that haven't moved.
    ...order(types.filter((t) => !moved(ofType(t))), (t) => t).map(typeTarget),
    ...order(lone.filter((f) => !moved(pawnsOn(f))), (f) => `p${f}`).map(pawnTarget),
    ...order(files.filter((f) => pawnsOn(f).length > 1), (f) => `p${f}`).map(pawnTarget),
  ];
  let next = 0;
  const RANK = "kqrbnp";
  return s.lightsOutRounds
    .map((round) => {
      // (Named in board order, the bigger pieces first, pawns by file: "Find my queen and my pawn on the c-file.")
      const targets = candidates.slice(next, (next += round.pieces)).sort((a, b) => RANK.indexOf(a.type) - RANK.indexOf(b.type) || (a.file ?? "").localeCompare(b.file ?? ""));
      const answers = [...new Set(targets.flatMap((t) => answersOf(t, mine)))].sort();
      return { pieces: targets.map((t) => t.type), targets, answers, ms: round.ms };
    })
    .filter((r) => r.pieces.length > 0);
}

/** A round's targets (a round from before they were spelt out: one type target per piece letter). */
const targetsOf = (round: Pick<LightsOutRound, "pieces" | "targets">): LightsOutTarget[] => round.targets ?? round.pieces.map((type) => ({ type }));

/**
 * A round's taps, judged in order. Every tap is a try, and a player has as many tries as there are pieces to find: a
 * square answering a target still to find finds it; one answering a target already found changes nothing (but uses
 * the try); any other is wrong. The pieces not found are missed.
 */
export function judgeTaps(round: Pick<LightsOutRound, "pieces" | "targets">, fen: string, side: Side, taps: readonly string[]): { found: string[]; wrong: string[]; used: number; missed: number; done: boolean } {
  const targets = targetsOf(round);
  const done = new Set<number>();
  const found: string[] = [];
  const wrong: string[] = [];
  const seen = new Set<string>();
  let used = 0;
  for (const sq of taps) {
    if (used >= targets.length) break;
    if (seen.has(sq)) continue;
    seen.add(sq);
    used++;
    const pc = pieceAt(fen, sq);
    const answers = (t: LightsOutTarget) => pc?.color === side && pc.type === t.type && (!t.file || sq[0] === t.file);
    const i = targets.findIndex((t, k) => !done.has(k) && answers(t));
    if (i >= 0) {
      done.add(i);
      found.push(sq);
    } else if (!targets.some(answers)) wrong.push(sq);
  }
  return { found, wrong, used, missed: targets.length - found.length, done: used >= targets.length };
}

/** A bot's Lights out: how many pieces it misses (each found with its round's lightsOutBotHit chance, from the seed). */
export function botLightsMisses(seed: number, botId: string, rounds: readonly Pick<LightsOutRound, "pieces">[], s: Pick<BossPowerSettings, "lightsOutBotHit"> = BOSS_POWERS): number {
  let missed = 0;
  rounds.forEach((r, i) => {
    const hit = s.lightsOutBotHit[Math.min(i, s.lightsOutBotHit.length - 1)] ?? 0.5;
    r.pieces.forEach((_, k) => {
      if (powerRoll(seed, "lights-bot", botId, i, k) >= hit) missed++;
    });
  });
  return missed;
}

// ---------------- The test trigger ----------------

/**
 * An admin's test trigger: the boss's ultimate comes as the next crowd turn begins, without the warning. Safe at any
 * moment: nothing happens if the boss has no ultimate, it's spent or already on its way, or the battle is over; it
 * only takes effect as a turn begins (prepareTurn), never in the middle of one or of a moment.
 */
export function triggerUltimate(boss: BossState | null | undefined): { boss: BossState | null | undefined; ok: boolean } {
  const p = boss?.powers;
  if (!boss || !p || !bossPowers(boss) || boss.result || p.ultAt !== undefined) return { boss, ok: false };
  if (p.ultNext) return { boss, ok: true };
  return { boss: { ...boss, powers: { ...p, ultNext: true } }, ok: true };
}

/** This turn is the blizzard's. */
export const blizzardNow = (boss: BossState | null | undefined): boolean =>
  !!boss?.powers && bossPowers(boss)?.ultimate === "blizzard" && boss.powers.ultAt === turnOf(boss);

/** The boss plays the crowd's move this turn (the funhouse), and hasn't yet. */
export const funhouseDue = (boss: BossState | null | undefined): boolean =>
  !!boss?.powers && !boss.result && bossPowers(boss)?.ultimate === "funhouse" && boss.powers.ultAt === turnOf(boss) && !boss.powers.funhouse;

/** After the funhouse, the crowd sees the board flipped for its next few turns. */
export const boardFlipped = (boss: BossState | null | undefined): boolean => {
  const p = boss?.powers;
  return !!p?.funhouse && p.flipUntil !== undefined && turnOf(boss!) > p.funhouse.turn && turnOf(boss!) <= p.flipUntil;
};

/**
 * The moves the crowd may play this turn, or null when every legal move is allowed. Frozen pieces can't move and
 * nobody can move onto the pie; in the blizzard only the queen moves (no queen, or she can't: the king). The God
 * King's Last Stand bars the move he took back on top. Never empty: a restriction that would leave no legal move
 * lifts for the turn (and since only legal moves are counted, check is always answered).
 */
export function crowdAllowed(boss: BossState | null | undefined, fen: string): string[] | null {
  const p = boss?.powers;
  const barred = boss?.barred;
  if (!p && !barred) return null;
  const legal = legalMoves(fen);
  let allowed = legal;
  if (p) {
    if (p.pie) allowed = allowed.filter((m) => to(m) !== p.pie!.square);
    if (blizzardNow(boss)) {
      const queen = allowed.filter((m) => pieceAt(fen, from(m))?.type === "q");
      const king = allowed.filter((m) => pieceAt(fen, from(m))?.type === "k");
      allowed = queen.length ? queen : king.length ? king : allowed;
    } else if (p.frozen) allowed = allowed.filter((m) => from(m) !== p.frozen!.square);
    if (!allowed.length) allowed = legal;
  }
  if (barred) {
    const open = allowed.filter((m) => m !== barred);
    allowed = open.length ? open : legal.filter((m) => m !== barred);
    if (!allowed.length) allowed = legal;
  }
  return allowed.length === legal.length ? null : allowed;
}

/** The moves the boss may play (only the pie stops it), or null when every legal move is allowed. */
export function bossAllowed(boss: BossState | null | undefined, fen: string): string[] | null {
  const pie = boss?.powers?.pie?.square;
  if (!pie) return null;
  const legal = legalMoves(fen);
  const allowed = legal.filter((m) => to(m) !== pie);
  return allowed.length && allowed.length < legal.length ? allowed : null;
}

/** A crowd move is allowed this turn. */
export const crowdMayPlay = (boss: BossState | null | undefined, fen: string, move: string): boolean => {
  const allowed = crowdAllowed(boss, fen);
  return allowed ? allowed.includes(move) : legalMoves(fen).includes(move);
};

/**
 * A power touches this crowd turn (a frozen piece, a pie, the blizzard, a flipped board): its picks don't count as
 * fair-play signals.
 */
export function powerTurn(boss: BossState | null | undefined): boolean {
  const p = boss?.powers;
  return !!p && (!!p.frozen || !!p.pie || blizzardNow(boss) || boardFlipped(boss) || !!p.fire?.length);
}

/** The squares that show ice: the frozen piece; in the blizzard every crowd piece but the one(s) still free to move. */
export function icedSquares(boss: BossState | null | undefined, fen: string): string[] {
  const p = boss?.powers;
  if (!p || !boss) return [];
  if (blizzardNow(boss)) {
    const free = new Set((crowdAllowed({ ...boss, barred: undefined }, fen) ?? []).map(from));
    const out: string[] = [];
    for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) {
      const sq = `${f}${r}`;
      const piece = pieceAt(fen, sq);
      if (piece?.color === boss.crowdSide && !free.has(sq)) out.push(sq);
    }
    return out;
  }
  return p.frozen ? [p.frozen.square] : [];
}

/** The rage meter, 0 to 1 (full: the warning, then the ultimate); null once the ultimate is spent. */
export function rageOf(boss: BossState | null | undefined, s: RageRates = BOSS_POWERS): number | null {
  const p = boss?.powers;
  if (!p || !bossPowers(boss)) return null;
  if (p.ultAt !== undefined && turnOf(boss!) > p.ultAt) return null;
  return Math.max(0, Math.min(1, ragePoints(p, s) / s.rageFull));
}

/** The funhouse played: the crowd's move is on the board (the caller plays it), and the board flips for a while. */
export function funhousePlayed(boss: BossState, move: string, san: string): BossState {
  const p = boss.powers!;
  const turn = turnOf(boss);
  return {
    ...boss,
    crowdMoves: boss.crowdMoves + 1,
    powers: { ...p, funhouse: { turn, move, san }, flipUntil: turn + BOSS_POWERS.flipTurns, events: [...p.events, { kind: "funhouse", turn }] },
  };
}

// ---------------- The judge plays by the same rules ----------------

/** What limits the crowd's moves in a judging job: the move the God King took back, and a power's allowed moves. */
export interface MoveLimits {
  barred?: string;
  allowed?: string[];
}

/** Whether the job lets the crowd play `move` (not the barred move; one of the allowed, when a power limits them). */
export function jobAllows(job: MoveLimits, move: string): boolean {
  return move !== job.barred && (!job.allowed || job.allowed.includes(move));
}

/**
 * The top moves the job may use: never the barred move, unless it's the only one; only allowed moves when a power
 * limits them (none of them in the top moves: empty, and the second search covers them all).
 */
export function judgeTop(job: MoveLimits, top: readonly MoveScore[]): MoveScore[] {
  const open = top.filter((m) => jobAllows(job, m.move));
  if (open.length || job.allowed) return open;
  return [...top];
}

/**
 * The scores the job's best move and bots' picks come from: the top moves it allows, or (a power left none of the
 * top moves) the second search over every allowed move, best first.
 */
export function judgeCandidates(job: MoveLimits, top: readonly MoveScore[], extra: readonly MoveScore[] = []): MoveScore[] {
  const t = judgeTop(job, top);
  if (t.length || !job.allowed) return t;
  // (Best first, ties by move: the same order whatever order the engine listed them in.)
  return extra.filter((m) => jobAllows(job, m.move)).sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1));
}

/**
 * A power left none of the top moves open: one search over every allowed move (and any pick), whose best is the
 * best allowed move. Null when the top moves already hold an allowed one (or nothing limits the moves).
 */
export async function allowedSearch(engine: Pick<EngineLike, "scoreMoves">, job: MoveLimits & { fen: string; picks?: readonly string[] }, top: readonly MoveScore[]): Promise<MoveScore[] | null> {
  if (!job.allowed || judgeTop(job, top).length) return null;
  const have = new Set(top.map((m) => m.move));
  const moves = [...new Set([...job.allowed, ...(job.picks ?? [])].filter((m) => !have.has(m)))].sort();
  return engine.scoreMoves(job.fen, moves);
}
