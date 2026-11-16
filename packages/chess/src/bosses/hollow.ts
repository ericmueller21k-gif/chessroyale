/**
 * Hollow, the Darkness boss (BOSS_ROSTER "hollow"): his rules. Always Black, from the starting position (in a raid where
 * the crowd would have been Black, he claims the dark side first). His passive, the dark: after his first move he
 * covers the square of the piece he moved, then another every few moves, each for a while; pieces there are hidden, and
 * a move attempt that touches the dark goes unchecked (an illegal one costs points). His ultimate, Lights out, comes at
 * the start of his turn when the meter is full: a memory test in rounds ("Find my queen."); each piece missed costs
 * points, and a crowd that finds too few lets him move twice. Numbers: BOSS_POWERS.dark*, lightsOut*. His art and
 * moments are the app's (characters/hollow.ts, components/LightsOut.tsx, the dark in characters/effects/).
 */
import { BOSS_POWERS, bossBannerMs, type BossPowerSettings, type BossPowerState, type BossState, type DarkSquare, type LightsOutRound, type LightsOutTarget, type LightsOutTest } from "@chessroyale/core";
import { playOnBoard, type BoardState } from "../boards.ts";
import { applyMove, inCheck, legalMoves, pieceAt, toSan } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import type { MoveScore } from "../uci.ts";
import { bossPowers, from, meterFull, moveSquares, other, powerRoll, testSwitch, to, turnOf, unleashed, type Battle, type BossRules, type Side } from "./base.ts";
import { funhouseMoveFrom } from "./boingo.ts";

/**
 * Hollow's rule set (BossPowerState.hv), set as a battle begins: 2 since Nov 5, 2026 (his 2 x 2 blocks and his 3 x 3 of
 * the dark). A battle without it (begun before) keeps the single squares only. His solo bulbs are their own switch,
 * also set as the battle begins (`strand`).
 */
export const HOLLOW_RULES = 2;

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). The extra move: his banner over the board as it lands. */
export const HOLLOW_FX = { dark: 2700, darkBlock: 2700, extra: 2200 } as const;

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

/** The squares of a `size` x `size` block whose corner nearest a1 is `corner` (file by file, a rank at a time). */
export function blockSquares(corner: string, size: number): string[] {
  const f0 = corner.charCodeAt(0) - 97;
  const r0 = Number(corner[1]);
  const out: string[] = [];
  for (let r = r0; r < r0 + size; r++) for (let f = f0; f < f0 + size; f++) out.push(`${"abcdefgh"[f]}${r}`);
  return out;
}

/**
 * His block of the dark (Eric, Nov 5: "if you don't know where say the bishop moves to in it, that's just your loss"): a
 * `size` x `size` block, from the seed, among those wholly on the board that hold neither king (so a king always shows
 * as it falls, and it can never cover all of a king's escape squares: any block holding a king's neighbors on both sides
 * holds the king), holding at least `minPieces` pieces (kings aside) when any does, else at least one, else any. Squares
 * already dark may be in it. Null only on a board with no room (never: a king takes one square of 64).
 */
export function chooseDarkBlock(fen: string, size: number, seed: number, turn: number, minPieces: number): { corner: string; squares: string[] } | null {
  const board = occupied(fen);
  const pieces = new Set([...board.w, ...board.b]);
  const all: { corner: string; squares: string[]; n: number }[] = [];
  for (let f = 0; f + size <= 8; f++)
    for (let r = 1; r + size <= 9; r++) {
      const corner = `${"abcdefgh"[f]}${r}`;
      const squares = blockSquares(corner, size);
      if (squares.some((sq) => board.kings.includes(sq))) continue;
      all.push({ corner, squares, n: squares.filter((sq) => pieces.has(sq)).length });
    }
  const pool = [all.filter((x) => x.n >= minPieces), all.filter((x) => x.n >= 1), all].find((xs) => xs.length) ?? [];
  if (!pool.length) return null;
  const pick = pool[Math.floor(powerRoll(seed, "dark-block", size, turn) * pool.length)]!;
  return { corner: pick.corner, squares: pick.squares };
}

/**
 * The dark with a block added (its squares dark from `turn` through `until`): a square already dark keeps its one entry,
 * dark until the later of its two ends. Returns the new list and the squares newly dark.
 */
export function addDarkBlock(dark: readonly DarkSquare[], squares: readonly string[], turn: number, until: number): { dark: DarkSquare[]; fresh: string[] } {
  const out = dark.map((d) => (squares.includes(d.square) ? { ...d, until: Math.max(d.until, until) } : d));
  const fresh = squares.filter((sq) => !dark.some((d) => d.square === sq));
  return { dark: [...out, ...fresh.map((square) => ({ square, at: turn, until }))], fresh };
}

/** The blocks due after his `n`th move (rule set 2): his 3 x 3 (once a game) and a 2 x 2, as sizes (`test`: the test switch's on his first). */
export function blocksAfter(n: number, s: Pick<BossPowerSettings, "darkBlockAt" | "darkBigAt"> = BOSS_POWERS, test?: number): number[] {
  const out: number[] = [];
  if (n === s.darkBigAt || (test === 3 && n === 1)) out.push(3);
  if (s.darkBlockAt.includes(n) || (test === 2 && n === 1)) out.push(2);
  return out;
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

/**
 * His Lights out comes now: the start of his turn, from the full meter (or the test trigger), and not yet after this
 * crowd move (an earlier test was another turn's).
 */
export const lightsOutDue = (boss: BossState | null | undefined): boolean => {
  const p = boss?.powers;
  return !!p && !boss!.result && bossPowers(boss)?.ultimate === "lightsout" && p.lightsOut?.at !== boss!.crowdMoves && (!!p.ultNext || p.ultAt === boss!.crowdMoves);
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

/** A round's targets (a round from before they were spelled out: one type target per piece letter). */
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

/** The dark's move for you this crowd turn (Boss alone: the 3rd or 7th bulb went out), picked or still to pick. */
export const forcedNow = (boss: Pick<BossState, "powers" | "crowdMoves"> | null | undefined) => {
  const f = boss?.powers?.forced;
  return f && f.turn === turnOf(boss!) ? f : null;
};

/** The battle is his: the last of the bulbs went out (Boss alone). */
export const blackedOut = (boss: Pick<BossState, "powers"> | null | undefined): boolean => !!boss?.powers?.blackout;

/**
 * The bulb that just went out (the `out`-th) brings the dark's move for you: one of darkBulbForced (3 and 7), short of
 * the last.
 */
export const bulbForces = (out: number, s: Pick<BossPowerSettings, "darkBulbForced" | "darkBulbs"> = BOSS_POWERS) => out < s.darkBulbs && s.darkBulbForced.includes(out);

/**
 * The dark's move for you (Eric, Nov 5: "forced into a bad move"): from the allowed moves less any that ends the game on
 * the spot (a mate or a stalemate), funhouseMoveFrom's pick in darkForcedLoss (15 to 30 points against the best, nearest
 * the middle; never past darkForcedMaxLogit in log-odds; never one whose line lets him force mate; never one that leaves
 * the queen to be taken unless it takes his; short of the range, the weakest move below it; with nothing else, the best).
 */
export async function darkForcedMoveFrom(engine: EngineLike, fen: string, allowed: readonly string[] | null = null): Promise<string> {
  const all = allowed ? [...allowed] : legalMoves(fen);
  const open = all.filter((m) => legalMoves(applyMove(fen, m)).length > 0);
  return funhouseMoveFrom(engine, fen, open.length ? open : all, BOSS_POWERS.darkForcedLoss, BOSS_POWERS.darkForcedMaxLogit);
}

/** Hollow: squares covered in the dark (their pieces hidden), and Lights out, a memory test, at the start of his turn. */
export const HOLLOW: BossRules = {
  id: "hollow",
  ultimateOnHisTurn: true,
  // Lights out: the meter full as this turn begins, it comes at the start of his turn after the crowd's move
  // (lightsOutDue). The full meter is its only warning (no "RAGE!"). The test switch: the meter fills as the second turn
  // begins.
  ultimate(next, t) {
    if (meterFull(next, t) || testSwitch(t, next)) next.ultAt = t.turn;
    return false;
  },
  // Lights out runs through the turn after it (his extra move, if the crowd failed it, comes before that turn's picks).
  ultimateRunning: (p, turn) => turn <= Math.max(p.ultAt!, p.lightsOut?.at ?? 0) + 1,
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
    // His bigger darkness (rule set 2, Eric, Nov 5): a 2 x 2 block now and then, and once a game his 3 x 3.
    if ((next.hv ?? 0) >= 2)
      for (const size of blocksAfter(n, t.s, next.blockTest)) {
        const block = chooseDarkBlock(t.fen, size, t.seed, t.turn, size === 3 ? t.s.darkBigMinPieces : t.s.darkBlockMinPieces);
        if (!block) continue;
        const { dark, fresh } = addDarkBlock(next.dark, block.squares, t.turn, t.turn + (size === 3 ? t.s.darkBigTurns : t.s.darkBlockTurns) - 1);
        next.dark = dark;
        t.events.push({ kind: "darkBlock", turn: t.turn, square: block.corner, size, squares: fresh });
      }
    next.bulbs = bulbsAt(t.turn, t.s);
  },
  // Always Black, from the starting position (no opening moves). His rule set as the battle begins, and in Boss alone
  // his strand of bulbs (settings.hollowBulbs: one player, no crowd).
  opening: {
    fromStart: true,
    crowdWhite: true,
    setUp: (b) => ({
      hv: HOLLOW_RULES,
      ...(b.settings.hollowBulbs && b.state.players.length === 1 ? { strand: { out: Math.max(0, Math.min(BOSS_POWERS.darkBulbs - 1, b.settings.hollowBulbsOut ?? 0)) } } : {}),
      ...(b.settings.hollowBlockTest ? { blockTest: b.settings.hollowBlockTest } : {}),
    }),
  },
  // The dark plays your move (Boss alone, at the 3rd and 7th bulb): once picked, the only move allowed that turn.
  crowdFilter(allowed, boss) {
    const f = forcedNow(boss);
    return f?.move && allowed.includes(f.move) ? [f.move] : allowed;
  },
  // (A move the dark played for you isn't yours: it doesn't count for fair play.)
  powerTurn: (boss) => !!forcedNow(boss),
  // Squares in the dark, their pieces hidden (the God King's Last Stand sits out).
  altersBoard: (boss) => darkSquares(boss).length > 0,
  // Each wrong attempt into the dark costs darkTryCost; a turn never costs more than missing it. (Boss alone, his bulbs
  // instead: no points.)
  scoreRound(b, players) {
    if (b.state.boss?.powers?.strand) return;
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
    // (Boss alone: his strand, the dark's move for you, the blackout.)
    ...(p.strand ? { strand: { out: p.strand.out, of: BOSS_POWERS.darkBulbs } } : {}),
    ...(p.forced ? { forced: { ...p.forced } } : {}),
    ...(p.blackout ? { blackout: { ...p.blackout } } : {}),
    lightsAt: p.lightsOut ? p.lightsOut.at : null,
    ...(p.lightsOut?.extra ? { lightsExtra: p.lightsOut.extra } : {}),
    // His lights' colors this battle (looks only): from the seed, 12 bits of it.
    lights: Math.floor(powerRoll(p.seed, "lights") * 4096),
  }),
};

// ---------------- The extra move (a failed Lights out) ----------------

/**
 * The position with the side to move's turn passed (the other side to move, no en passant; when Black passes, the move
 * number goes up, as after Black's move): Hollow's extra move (the crowd's turn passed after his move) and Alfil's
 * fusion (his move). Null when it can't be: the side to move is in check or has no move (the game is over), or the
 * other side would have none.
 */
export function passTurn(fen: string): string | null {
  try {
    if (inCheck(fen) || !legalMoves(fen).length) return null;
    const f = fen.split(" ");
    if (f[1] === "b" && f[5]) f[5] = String(Number(f[5]) + 1);
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
 *   0          "LIGHTS OUT!" (his banner: a boss banner's length, bossBannerMs) and his line, "It's time."
 *   dropAt     he drops onto the board's top edge (his `lightsOut`) and smashes his strand in three strikes: the board
 *              dims a step at each, night at the last.
 *   rounds     each round: his prompt ("Find my queen."), its seconds to tap (BOSS_POWERS.lightsOutRounds) and the
 *              usual late grace; then the answers show (`answerMs`) and the night closes over them again.
 *   backAt     the lights come back (his `lightsBack`: a fresh strand from the void, the dawn spreading from his spot),
 *              he returns to his corner (`backMs`), and his turn goes on: he plays his move.
 */
export const LIGHTS_OUT = {
  // (Its banner showed until he dropped, 1.3 s; since Oct 24 it shows a boss banner's whole length, the extra included,
  // and he drops, and everything after, as it goes: bossBannerMs.)
  get dropAt(): number {
    return Math.max(1300, bossBannerMs());
  },
  dropMs: 2900,
  gapMs: 300,
  answerMs: 1800,
  backMs: 2300,
} as const;

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

/** A move attempt into the dark, judged (hollowBattle.darkTry). */
export type DarkTryResult =
  | { kind: "move"; move: string }
  | { kind: "wrong"; tries: number; out: boolean; bulbs?: number; forced?: boolean; blackout?: boolean }
  | { kind: "refused" };

/** His part in the match runner (the runner's darkTry, darkTries, Lights out and extra-move methods hand it over). */
export const hollowBattle = {
  /**
   * The dark: a move attempt that touches a dark square, sent unchecked. A legal (allowed) move is the player's pick
   * (`move`: a pawn's move to the last rank without a piece named is a queen's). An illegal one is wrong, and the player
   * picks again:
   * - in a crowd (and a raid, a party): it costs darkTryCost off the turn's score (his scoreRound takes it off); the
   *   darkTries-th wrong one ends their turn as a missed move (`out`);
   * - in Boss alone (his strand, `strand`): it puts a bulb out (`bulbs`: how many are out now), no points; as the 3rd and
   *   the 7th go out, the dark plays this turn's move for you (`forced`: darkForcedDue, then playDarkForced); as the last
   *   goes out, the battle is his (`blackout`). Either ends the turn (`out`).
   * Anything else (no dark on its way, the move the God King took back, a turn the dark already moves for you or the
   * battle already lost): refused, free. Bots never try: they know the board.
   */
  darkTry(b: Battle, playerId: string, move: string): DarkTryResult {
    const boss = b.state.boss;
    const p = boss?.powers;
    const board = b.boardOf(playerId);
    if (!boss || !p || !board || typeof move !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) return { kind: "refused" };
    if (forcedNow(boss) || p.blackout || boss.result) return { kind: "refused" };
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
    if (p.strand) {
      const out = Math.min(BOSS_POWERS.darkBulbs, p.strand.out + 1);
      const blackout = out >= BOSS_POWERS.darkBulbs;
      const forced = bulbForces(out);
      const turn = turnOf(boss);
      b.state = {
        ...b.state,
        boss: { ...boss, powers: { ...p, tries: { round, by }, strand: { out }, ...(forced ? { forced: { turn, at: out } } : {}), ...(blackout ? { blackout: { turn } } : {}) } },
      };
      return { kind: "wrong", tries: by[playerId]!, out: forced || blackout, bulbs: out, ...(forced ? { forced } : {}), ...(blackout ? { blackout } : {}) };
    }
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, tries: { round, by } } } };
    return { kind: "wrong", tries: by[playerId]!, out: by[playerId]! >= BOSS_POWERS.darkTries };
  },

  /** The dark is to play your move this turn (Boss alone, a 3rd or 7th bulb out), not yet picked. */
  darkForcedDue(b: Battle): boolean {
    const f = forcedNow(b.state.boss);
    return !!f && !f.move && !b.state.boss!.result;
  },

  /** The dark's move for you, from this device's engine (darkForcedMoveFrom), set as the turn's only move. */
  async playDarkForced(b: Battle, engine: EngineLike): Promise<string> {
    const fen = b.boards.get(b.state.boards[0]!)!.fen;
    return hollowBattle.applyDarkForced(b, await darkForcedMoveFrom(engine, fen, b.crowdAllowed()));
  },

  /**
   * Sets the dark's move for you: the turn's only allowed move from now (his crowdFilter). One that isn't allowed (an
   * engine's slip) gives way to the first allowed move. Once set it stays (asking again returns it).
   */
  applyDarkForced(b: Battle, move: string): string {
    const boss = b.state.boss!;
    const f = forcedNow(boss);
    if (!f) return move;
    if (f.move) return f.move;
    const fen = b.boards.get(b.state.boards[0]!)!.fen;
    const allowed = b.crowdAllowed() ?? legalMoves(fen);
    const m = allowed.includes(move) ? move : allowed[0]!;
    b.state = { ...b.state, boss: { ...boss, powers: { ...boss.powers!, forced: { ...f, move: m, san: toSan(fen, m) } } } };
    return m;
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
   * position. The meter is spent from here (from the test trigger, the ultimate comes now).
   */
  startLightsOut(b: Battle): LightsOutTest {
    const boss = b.state.boss!;
    const { ultNext: _trigger, ...p } = boss.powers!;
    const fen = b.boards.get(b.state.boards[0]!)!.fen;
    // (Another Lights out after his first: a seed of its own, so it names other pieces and the bots find others.)
    const seed = p.lightsOut ? Math.floor(powerRoll(p.seed, "lights-test", boss.crowdMoves) * 2 ** 32) >>> 0 : p.seed;
    const test: LightsOutTest = { at: boss.crowdMoves, rounds: chooseLightsOut(fen, boss.crowdSide === "w" ? "b" : "w", seed), ...(seed !== p.seed ? { seed } : {}) };
    const powers: BossPowerState = { ...p, ultAt: p.ultAt ?? boss.crowdMoves, lightsOut: test };
    b.state = { ...b.state, boss: { ...boss, powers: p.ultAt === undefined ? unleashed(powers) : powers } };
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
    for (const pl of alive) out[pl.id] = pl.isBot ? botLightsMisses(test.seed ?? p.seed, pl.id, test.rounds) : Math.max(0, Math.min(all, missed[pl.id] ?? all));
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
      alive.filter((pl) => pl.isBot).map((pl) => botLightsFound(p.lightsOut?.seed ?? p.seed, pl.id, rounds)),
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
