/**
 * Hollow, the Darkness boss (BOSS_ROSTER "hollow"): his rules. Always Black, from the starting position (in a raid where
 * the crowd would have been Black, he claims the dark side first). His passive, the dark: after his first move he
 * covers the square of the piece he moved, then another every few moves, each for a while; pieces there are hidden, and
 * a move attempt that touches the dark goes unchecked (an illegal one costs points). His ultimate, Lights out, comes at
 * the start of his turn when the meter is full: a memory test in rounds ("Find my queen."); each piece missed costs
 * points, and a crowd that finds too few lets him move twice. Numbers: BOSS_POWERS.dark*, lightsOut*. His art and
 * moments are the app's (characters/hollow.ts, components/LightsOut.tsx, the dark in characters/effects/).
 */
import { BOSS_POWERS, type BossPowerSettings, type BossState, type DarkSquare, type LightsOutRound, type LightsOutTarget, type LightsOutTest } from "@chessroyale/core";
import { playOnBoard, type BoardState } from "../boards.ts";
import { applyMove, inCheck, legalMoves, pieceAt, toSan } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import type { MoveScore } from "../uci.ts";
import { bossPowers, from, meterFull, moveSquares, other, powerRoll, testSwitch, to, type Battle, type BossRules, type Side } from "./base.ts";

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). The extra move: his banner over the board as it lands. */
export const HOLLOW_FX = { dark: 2700, extra: 2200 } as const;

/** Hollow's first cover of the dark holds longer, for his first-cover line ("Don't forget what's there…"). */
export const DARK_FIRST_EXTRA_MS = 1300;

/** His moments that can hold longer (powerFxMs in boss-timing.ts): the first cover of the dark. */
export const HOLLOW_FX_EXTRA = { dark: (e: { first?: boolean }) => (e.first ? DARK_FIRST_EXTRA_MS : 0) } as const;

/** Hollow claiming the dark side in the intro (when the crowd would have been Black): his `claimDark` and his line. */
export const CLAIM_MS = 2400;

/** Hollow, the dark boss: always Black, from the starting position (his passive is the dark). */
export const startsDark = (def: { powers: { passive: string } | null } | null | undefined) => def?.powers?.passive === "dark";

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

// ---------------- Lights out ----------------

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

/** A bot's Lights out, round by round: how many pieces it finds (each with its round's lightsOutBotHit chance, from the seed). */
export function botLightsFound(seed: number, botId: string, rounds: readonly Pick<LightsOutRound, "pieces">[], s: Pick<BossPowerSettings, "lightsOutBotHit"> = BOSS_POWERS): number[] {
  return rounds.map((r, i) => {
    const hit = s.lightsOutBotHit[Math.min(i, s.lightsOutBotHit.length - 1)] ?? 0.5;
    return r.pieces.filter((_, k) => powerRoll(seed, "lights-bot", botId, i, k) < hit).length;
  });
}

/** A bot's Lights out: how many pieces it misses in all (botLightsFound). */
export function botLightsMisses(seed: number, botId: string, rounds: readonly Pick<LightsOutRound, "pieces">[], s: Pick<BossPowerSettings, "lightsOutBotHit"> = BOSS_POWERS): number {
  const found = botLightsFound(seed, botId, rounds, s);
  return rounds.reduce((n, r, i) => n + r.pieces.length - found[i]!, 0);
}

/**
 * The crowd's count in Lights out (Eric, Oct 10): the pieces found by everyone in the test, the pieces settled so far
 * (found, or missed for good), and the pieces asked of them in all. The find rate is found over asked once it's over;
 * while it runs, found over settled (the screens' meter).
 */
export interface LightsTally {
  found: number;
  settled: number;
  asked: number;
}

/**
 * The crowd's count so far, from the server's own judging. `ended`: the rounds over. A person's round (judgeTaps):
 * every try settles a piece (one try a piece: a try that finds nothing means a piece missed), and once the round is
 * over, all of its pieces are. A bot's finds count as each round ends (botLightsFound).
 */
export function lightsTally(
  rounds: readonly Pick<LightsOutRound, "pieces">[],
  ended: number,
  people: readonly (readonly { found: readonly unknown[]; used?: number }[])[],
  bots: readonly (readonly number[])[],
): LightsTally {
  const all = rounds.reduce((n, r) => n + r.pieces.length, 0);
  let found = 0;
  let settled = 0;
  for (const mine of people)
    rounds.forEach((r, i) => {
      if (i > ended) return;
      const m = mine[i];
      const f = Math.min(r.pieces.length, m?.found.length ?? 0);
      found += f;
      settled += i < ended ? r.pieces.length : Math.min(r.pieces.length, Math.max(f, m?.used ?? f));
    });
  for (const bot of bots)
    rounds.forEach((r, i) => {
      if (i >= ended) return;
      found += Math.min(r.pieces.length, bot[i] ?? 0);
      settled += r.pieces.length;
    });
  return { found, settled, asked: all * (people.length + bots.length) };
}

/** The running find rate (0 to 1): found over settled; null before anything is settled. */
export const lightsRate = (t: Pick<LightsTally, "found" | "settled">): number | null => (t.settled > 0 ? t.found / t.settled : null);

/** The crowd held the light: its find rate over the whole test at or above lightsOutHold (nothing asked: it held). */
export const lightsHeld = (t: Pick<LightsTally, "found" | "asked">, s: Pick<BossPowerSettings, "lightsOutHold"> = BOSS_POWERS): boolean =>
  t.asked <= 0 || t.found >= s.lightsOutHold * t.asked - 1e-9;

/** Hollow: squares covered in the dark (their pieces hidden), and Lights out, a memory test, at the start of his turn. */
export const HOLLOW: BossRules = {
  id: "hollow",
  ultimateOnHisTurn: true,
  // Lights out: the meter full as this turn begins, it comes at the start of his turn after the crowd's move
  // (lightsOutDue). The full meter is its only warning (no "RAGE!"). The test switch: the meter fills as the second turn
  // begins.
  ultimate(next, t) {
    if (meterFull(next, t) || testSwitch(t)) next.ultAt = t.turn;
    return false;
  },
  // The dark: the squares whose turns are over clear; after his first move and every darkEvery-th after it, he covers
  // another. His bulbs count down to it.
  passive(next, t) {
    const old = next.dark ?? [];
    next.dark = old.filter((d) => d.until >= t.turn);
    next.cleared = old.filter((d) => d.until < t.turn).map((d) => d.square);
    const n = hisMoves(t.turn);
    if (coversAfter(n, t.s)) {
      const square = chooseDark(t.fen, t.crowd, t.seed, t.turn, next.dark, n === 1 && t.lastMove ? to(t.lastMove) : null);
      if (square) {
        next.dark = [...next.dark, { square, at: t.turn, until: t.turn + t.s.darkTurns - 1 }];
        t.events.push({ kind: "dark", turn: t.turn, square, ...(n === 1 ? { first: true as const } : {}) });
      }
    }
    next.bulbs = bulbsAt(t.turn, t.s);
  },
  // Always Black, from the starting position (no opening moves).
  opening: { fromStart: true, crowdWhite: true },
  // Each wrong attempt into the dark costs darkTryCost; a turn never costs more than missing it.
  scoreRound(b, players) {
    const tries = hollowBattle.darkTries(b);
    for (const pl of players) {
      const n = tries[pl.playerId] ?? 0;
      if (n > 0) pl.roundScore = Math.max(b.settings.missedMoveScore, pl.roundScore - n * BOSS_POWERS.darkTryCost);
    }
  },
  view: (p) => ({
    dark: (p.dark ?? []).map((d) => ({ square: d.square, at: d.at, until: d.until })),
    cleared: p.cleared ?? [],
    bulbs: p.bulbs ?? bulbsAt(p.turn || 1),
    ...(p.claimed ? { claimed: true } : {}),
    lightsAt: p.lightsOut ? p.lightsOut.at : null,
    ...(p.lightsOut?.extra ? { lightsExtra: p.lightsOut.extra } : {}),
  }),
};

// ---------------- The extra move (a failed Lights out) ----------------

/**
 * The position with him to move again after his own move (the crowd's turn passed: the side to move swapped, no en
 * passant), or null when it can't be: the crowd is in check or has no move (the game is over).
 */
export function passTurn(fen: string): string | null {
  try {
    if (inCheck(fen) || !legalMoves(fen).length) return null;
    const f = fen.split(" ");
    f[1] = f[1] === "w" ? "b" : "w";
    f[3] = "-";
    const passed = f.join(" ");
    return legalMoves(passed).length ? passed : null;
  } catch {
    return null;
  }
}

/**
 * His extra move's candidates in the passed position: quiet moves only (Eric, Oct 10): no capture (en passant
 * included), no promotion, no check; and never one that leaves the crowd without a move (a stalemate would decide
 * the game). His own king is never left in check (only legal moves).
 */
export function extraMoveCandidates(passed: string): string[] {
  return legalMoves(passed).filter((m) => {
    if (m.length > 4 || pieceAt(passed, to(m))) return false;
    if (pieceAt(passed, from(m))?.type === "p" && m[0] !== m[2]) return false;
    const after = applyMove(passed, m);
    return !inCheck(after) && legalMoves(after).length > 0;
  });
}

/**
 * His extra move, from the candidates' scores (his expected score after each, 0 to 1) and `before`, his expected score
 * had he not moved again: the one that gains him most without gaining more than `cap` points (expected x 100), nor
 * losing more than that; never one with a forced mate either way in its line. Null when there's none.
 */
export function pickExtraMove(scored: readonly MoveScore[], before: number, candidates: readonly string[], cap: number = BOSS_POWERS.lightsOutExtraGain): string | null {
  const ok = new Set(candidates);
  const within = scored.filter((m) => ok.has(m.move) && m.mate === undefined && Math.abs(m.expected - before) * 100 <= cap + 1e-9);
  return [...within].sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1))[0]?.move ?? null;
}

/**
 * Hollow's Lights out, beat by beat (ms from its start), the same for the server and every screen. Nobody's clock runs.
 *   0          "LIGHTS OUT!" (his banner) and his line, "It's time."
 *   dropAt     he drops onto the board's top edge (his `lightsOut`) and smashes his strand in three strikes: the board
 *              dims a step at each, night at the last.
 *   rounds     each round: his prompt ("Find my queen."), its seconds to tap (BOSS_POWERS.lightsOutRounds) and the
 *              usual late grace; then the answers show (`answerMs`) and the night closes over them again.
 *   backAt     the lights come back (his `lightsBack`: a fresh strand from the void, the dawn spreading from his spot),
 *              he returns to his corner (`backMs`), and his turn goes on: he plays his move.
 */
export const LIGHTS_OUT = { dropAt: 1300, dropMs: 2900, gapMs: 300, answerMs: 1800, backMs: 2300 } as const;

/**
 * Lights out's beats for its rounds' seconds (`ms` each) and the late grace on each round. A round is over when every
 * player is done (lightsRoundEnd: each tap gives its player a second more); once it is, `endedAt` (ms from the test's
 * start) says when, and the next round follows its answers. Until then its end is the earliest it can be: its seconds
 * and the grace (`over` false).
 */
export function lightsOutTimeline(rounds: readonly { ms: number; endedAt?: number }[], graceMs: number) {
  let t = LIGHTS_OUT.dropAt + LIGHTS_OUT.dropMs + LIGHTS_OUT.gapMs;
  const out = rounds.map((r) => {
    const round = { at: t, until: t + r.ms, answersAt: r.endedAt ?? t + r.ms + graceMs, over: r.endedAt !== undefined };
    t = round.answersAt + LIGHTS_OUT.answerMs;
    return round;
  });
  return { rounds: out, backAt: t, total: t + LIGHTS_OUT.backMs };
}

/** A player's own deadline in a round (ms from the test's start, before the late grace): its seconds, and a second more for each tap they've made. */
export const lightsDeadline = (round: { until: number }, taps: number, tapMs: number = BOSS_POWERS.lightsOutTapMs): number => round.until + taps * tapMs;

/**
 * When a Lights out round is over (ms from the test's start): when every player is done, each once they've used all
 * their tries (`pieces`: at their last one) or their own time is up (lightsDeadline, and the late grace). `taps`: each
 * player's tap times in the round (ms from the test's start), in order. Nobody tapping: its seconds and the grace.
 */
export function lightsRoundEnd(round: { until: number }, pieces: number, taps: readonly (readonly number[])[], graceMs: number, tapMs: number = BOSS_POWERS.lightsOutTapMs): number {
  const base = round.until + graceMs;
  if (!taps.length) return base;
  return Math.max(...taps.map((t) => (t.length >= pieces ? t[pieces - 1]! : base + t.length * tapMs)));
}

// ---------------- In the match ----------------

/**
 * Hollow's extra move after a failed Lights out (Eric, Oct 10): with the crowd's turn passed, a quiet move (no capture,
 * check or promotion; extraMoveCandidates) that gains him at most `cap` points over not moving again, nor loses him
 * more (pickExtraMove), by the same engine searches the boss's moves use: his expected score had he not moved again is
 * one less the crowd's best in the position now; the engine's top moves first, then the other candidates. Null (he
 * skips it) when the crowd is in check, or no candidate is within the cap.
 */
export async function extraMoveFrom(engine: EngineLike, fen: string, cap: number = BOSS_POWERS.lightsOutExtraGain): Promise<string | null> {
  const passed = passTurn(fen);
  if (!passed) return null;
  const candidates = extraMoveCandidates(passed);
  if (!candidates.length) return null;
  const crowdBest = (await engine.topMoves(fen, 1))[0];
  const before = crowdBest ? 1 - crowdBest.expected : 0.5;
  const top = (await engine.topMoves(passed, 8)).filter((m) => candidates.includes(m.move));
  const pick = pickExtraMove(top, before, candidates, cap);
  if (pick) return pick;
  const rest = candidates.filter((m) => !top.some((t) => t.move === m));
  return rest.length ? pickExtraMove([...top, ...(await engine.scoreMoves(passed, rest))], before, candidates, cap) : null;
}

/** His part in the match runner (the runner's darkTry, darkTries, Lights out and extra-move methods hand it over). */
export const hollowBattle = {
  /**
   * The dark: a move attempt that touches a dark square, sent unchecked. A legal (allowed) move is the player's pick
   * (`move`: a pawn's move to the last rank without a piece named is a queen's). An illegal one costs darkTryCost off the
   * turn's score (his scoreRound takes it off), and the player picks again; the darkTries-th wrong one ends their turn
   * as a missed move (`out`). Anything else (no dark on its way, the move the God King took back): refused, free. Bots
   * never try: they know the board.
   */
  darkTry(b: Battle, playerId: string, move: string): { kind: "move"; move: string } | { kind: "wrong"; tries: number; out: boolean } | { kind: "refused" } {
    const boss = b.state.boss;
    const p = boss?.powers;
    const board = b.boardOf(playerId);
    if (!boss || !p || !board || typeof move !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) return { kind: "refused" };
    const dark = darkSquares(boss);
    const legal = darkAttempt(board.fen, move);
    if (legal) {
      const allowed = b.crowdAllowed(board.id);
      return allowed && !allowed.includes(legal) ? { kind: "refused" } : { kind: "move", move: legal };
    }
    if (!touchesDark(move, dark, board.fen)) return { kind: "refused" };
    const round = b.state.round;
    const by = p.tries?.round === round ? { ...p.tries.by } : {};
    by[playerId] = (by[playerId] ?? 0) + 1;
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, tries: { round, by } } } };
    return { kind: "wrong", tries: by[playerId]!, out: by[playerId]! >= BOSS_POWERS.darkTries };
  },

  /** The dark: each player's wrong attempts into the dark this round. */
  darkTries(b: Battle): Record<string, number> {
    const t = b.state.boss?.powers?.tries;
    return t && t.round === b.state.round ? t.by : {};
  },

  /** Lights out is due: the start of his turn (the crowd has moved), from the full meter or the test trigger. */
  lightsOutDue(b: Battle): boolean {
    return lightsOutDue(b.state.boss) && b.bossToMove();
  },

  /**
   * Lights out begins (the clocks stopped: nobody is picking): its rounds, picked from the battle's seed and the
   * position. Once a match: the ultimate is spent from here.
   */
  startLightsOut(b: Battle): LightsOutTest {
    const boss = b.state.boss!;
    const { ultNext: _trigger, ...p } = boss.powers!;
    const fen = b.boards.get(b.state.boards[0]!)!.fen;
    const test: LightsOutTest = { at: boss.crowdMoves, rounds: chooseLightsOut(fen, boss.crowdSide === "w" ? "b" : "w", p.seed) };
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, ultAt: p.ultAt ?? boss.crowdMoves, lightsOut: test } } };
    return test;
  },

  /**
   * Lights out is over: every player still in loses lightsOutMiss for each piece they didn't find (people's from their
   * taps, `missed`; a person with no entry found nothing; bots' from the seed). It isn't a move: nothing else changes,
   * and fair play never sees it. Returns what each missed.
   */
  finishLightsOut(b: Battle, missed: Readonly<Record<string, number>>): Record<string, number> {
    const boss = b.state.boss!;
    const p = boss.powers!;
    const test = p.lightsOut;
    if (!test || test.missed) return test?.missed ?? {};
    const all = test.rounds.reduce((n, r) => n + r.pieces.length, 0);
    const out: Record<string, number> = {};
    const alive = b.alive();
    for (const pl of alive) out[pl.id] = pl.isBot ? botLightsMisses(p.seed, pl.id, test.rounds) : Math.max(0, Math.min(all, missed[pl.id] ?? all));
    const cost = BOSS_POWERS.lightsOutMiss;
    // The crowd's find rate over the whole test (Eric, Oct 10): under lightsOutHold, he moves twice before its turn.
    const asked = all * alive.length;
    const found = asked - alive.reduce((n, pl) => n + out[pl.id]!, 0);
    const held = lightsHeld({ found, asked });
    b.state = {
      ...b.state,
      players: b.state.players.map((pl) => (out[pl.id] ? { ...pl, stageScore: pl.stageScore - out[pl.id]! * cost } : pl)),
      boss: { ...boss, powers: { ...p, lightsOut: { ...test, missed: out, found, asked, ...(held ? {} : { extra: "due" as const }) } } },
    };
    return out;
  },

  /**
   * Lights out's crowd count so far (the screens' meter, and the verdict as its last round ends): each person's taps
   * judged (`people`, by id: judgeTaps round by round; nobody's entry, nothing found), each bot's finds from the seed
   * as each round ends. `ended`: the rounds over. The same people and bots as finishLightsOut counts.
   */
  lightsTally(b: Battle, people: Readonly<Record<string, readonly { found: readonly unknown[]; used?: number }[]>>, ended: number): LightsTally {
    const p = b.state.boss!.powers!;
    const rounds = p.lightsOut?.rounds ?? [];
    const alive = b.alive();
    return lightsTally(
      rounds,
      ended,
      alive.filter((pl) => !pl.isBot).map((pl) => people[pl.id] ?? []),
      alive.filter((pl) => pl.isBot).map((pl) => botLightsFound(p.seed, pl.id, rounds)),
    );
  },

  /**
   * His extra move is due: the crowd failed Lights out (under lightsOutHold), and he has played his own move (the
   * crowd's turn has begun, not yet dealt). Like the funhouse, it comes before the crowd picks.
   */
  extraMoveDue(b: Battle): boolean {
    const boss = b.state.boss;
    const t = boss?.powers?.lightsOut;
    // (Only before the crowd's next move: once it has moved, a driver that skipped it has let it lapse.)
    return t?.extra === "due" && t.at === boss!.crowdMoves && !boss!.result && !b.finalGameOver() && !b.bossToMove();
  },

  /** His extra move: a quiet one that gains him only a little (extraMoveFrom), from this device's engine. */
  async playExtraMove(b: Battle, engine: EngineLike): Promise<string | null> {
    return hollowBattle.applyExtraMove(b, await extraMoveFrom(engine, b.boards.get(b.state.boards[0]!)!.fen));
  },

  /**
   * Plays his extra move (from the host's engine online): the crowd's turn passes (a base on the board: the position
   * changes between moves), then his quiet move. A move that isn't one of the candidates (extraMoveCandidates), or
   * none, and he skips it. It isn't the crowd's: nothing is scored and fair play never sees it; the crowd's turn (its
   * powers already set as his own move landed) follows as usual. Returns the move played, or null.
   */
  applyExtraMove(b: Battle, move: string | null): string | null {
    const boss = b.state.boss!;
    const p = boss.powers!;
    const test = p.lightsOut;
    if (!test || test.extra !== "due" || test.at !== boss.crowdMoves) return null;
    const id = b.state.boards[0]!;
    const board = b.boards.get(id)!;
    const passed = passTurn(board.fen);
    if (!move || !passed || !extraMoveCandidates(passed).includes(move)) {
      b.state = { ...b.state, boss: { ...boss, powers: { ...p, lightsOut: { ...test, extra: "skipped" } } } };
      return null;
    }
    const ply = board.history.length;
    const base: BoardState = { ...board, fen: passed, expected: 1 - board.expected, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen: passed }] };
    b.boards.set(id, playOnBoard(base, move, base.expected));
    b.bossLast = { move, san: toSan(passed, move) };
    b.state = {
      ...b.state,
      boss: { ...boss, powers: { ...p, lightsOut: { ...test, extra: "played" }, events: [...p.events, { kind: "extra", turn: p.turn, square: move.slice(2, 4) }] } },
    };
    return move;
  },
};
