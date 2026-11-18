import { describe, expect, it } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, type BossPowerSettings, type BossPowerState, type BossState, type StopReason } from "@chessroyale/core";
import {
  applyMove,
  beamAllows,
  blockedBy,
  boardAltered,
  bossAllowed,
  bossRules,
  bossStopped,
  crowdAllowed,
  doughSquares,
  hisToppleOpen,
  lands,
  legalMoves,
  moveSquares,
  pawnOnGold,
  pieceAt,
  piedSquares,
  plantSquares,
  stopFieldsOf,
  stopReason,
  takesShield,
  toyStops,
  toysAfterCrowd,
  toysTakeReply,
  type BossRules,
  type ChandyStopFields,
  type StopFields,
} from "../src/index.ts";
import { kitBattles, quickSearches, runBattle, type KitBattle } from "./boss-kit-lib.ts";

/**
 * The square marks' twin (Battle Tower PR 3, Nov 18; docs/decisions/2026-11-18-square-marks-on-the-layer.md): Boingo's pies, Big
 * Boy's toy blocks, Puddles' plants, Chandy's beam and scatter shot and Don Dough's dough moved from each boss's own checks
 * (`crowdFilter`, `bossStops`, `stopReason`'s geometry) onto the board layer (`BossRules.layer`, `layerStop`, `marksStop`). Over
 * seeded battles of every boss in the family (the kit's, more seeds, and each power that puts marks down switched on), on every
 * crowd turn and before every move of his: the crowd's allowed moves, his allowed moves, which of his moves went through a power,
 * the screens' words for every legal move (the match's state and the screens' view), the Last Stand's test, Big Boy's power turn
 * and toy rule, and the geometry the powers' own picks use (where a move lands; a wall on any empty square; a beam) all agree
 * exactly with today's rules, frozen here as they stood on main. Solo and the server both ask the runner's `crowdAllowed` and
 * `bossAllowed`, read here too (the server's own path: boss-kit-parity.test.ts).
 */

/** The family, by BOSS_ROSTER id, and each one's test switches that put square marks down beyond the kit's own battles. */
const FAMILY: Record<string, readonly string[]> = {
  clown: ["pie"],
  bigboy: ["tower"],
  gardener: ["water"],
  chandy: ["scatter", "beam"],
  zebra: ["dough"],
};
const MAX_MOVES = 24;
const SEEDS = 2;
const FILES = "abcdefgh";

// ---------------- Today's rules, frozen (main before the move) ----------------

/** bosses/base.ts `heldIn` before PR 2 (the beam's held pieces). */
function oldHeldIn(fen: string, move: string, held: readonly string[]): boolean {
  if (held.includes(move.slice(0, 2))) return true;
  const f0 = move.charCodeAt(0);
  const f1 = move.charCodeAt(2);
  if (Math.abs(f1 - f0) !== 2 || move[1] !== move[3] || pieceAt(fen, move.slice(0, 2))?.type !== "k") return false;
  return held.includes(`${f1 > f0 ? "h" : "a"}${move[1]}`);
}

/** boingo.ts `lands`: the move's target, and castling's rook too, found by playing it. */
function oldLands(m: string, fen: string): string[] {
  const from = m.slice(0, 2);
  const to = m.slice(2, 4);
  const king = pieceAt(fen, from);
  if (king?.type !== "k" || from[1] !== to[1]) return [to];
  const own = pieceAt(fen, to);
  if (Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) < 2 && !(own && own.color === king.color)) return [to];
  try {
    const after = applyMove(fen, m);
    const out = new Set<string>([to]);
    for (const f of FILES) {
      const sq = `${f}${from[1]}`;
      const p = pieceAt(after, sq);
      const was = pieceAt(fen, sq);
      if (p && p.color === king.color && (!was || was.type !== p.type || was.color !== p.color)) out.add(sq);
    }
    return [...out];
  } catch {
    return [to];
  }
}

/** bigboy.ts `blockedBy`: the block is where the move lands or on its way (moveSquares: a castling king's way on to the corner). */
const oldBlockedBy = (m: string, sq: string, fen: string): boolean => moveSquares(m, fen).slice(1).includes(sq);

type Toys = Pick<BossPowerState, "tower" | "scatter"> | null | undefined;

/** bigboy.ts `toyStops`. */
function oldToyStops(move: string, p: Toys, fen: string, mayTopple: boolean, s: Pick<BossPowerSettings, "towerEnter"> = BOSS_POWERS): boolean {
  if (p?.scatter?.squares.some((sq) => oldBlockedBy(move, sq, fen))) return true;
  const t = p?.tower;
  if (!t || !oldBlockedBy(move, t.square, fen)) return false;
  const castles = Math.abs(move.charCodeAt(0) - move.charCodeAt(2)) === 2 && pieceAt(fen, move.slice(0, 2))?.type === "k";
  const topples = t.height >= s.towerEnter && move.slice(2, 4) === t.square && !castles;
  return !(mayTopple && topples && moveSquares(move, fen).indexOf(t.square) === 1);
}

const legalIn = (fen: string): string[] => {
  try {
    return legalMoves(fen);
  } catch {
    return [];
  }
};

/** bigboy.ts `toysTakeMove` (his powerTurn with the position). */
function oldToysTakeMove(p: Toys, fen: string): boolean {
  if (!p?.tower && !p?.scatter) return false;
  const legal = legalIn(fen);
  const open = legal.filter((m) => !oldToyStops(m, p, fen, true));
  return open.length > 0 && open.length < legal.length;
}

/** bigboy.ts `toysTakeReply` (his standAltered). */
function oldToysTakeReply(p: BossPowerState, fen: string, played: string, reply: string | undefined): boolean {
  if (!(p.tower || p.scatter?.squares.length)) return false;
  if (!reply) return true;
  let after: string;
  try {
    after = applyMove(fen, played);
  } catch {
    return true;
  }
  const next = toysAfterCrowd(p, after);
  if (!next.tower && !next.scatter) return false;
  const open = hisToppleOpen(next);
  const legal = legalIn(after);
  const allowed = legal.filter((m) => !oldToyStops(m, next, after, open));
  return allowed.length > 0 && !allowed.includes(reply);
}

/** gardener.ts `plantStops`. */
const oldPlantStops = (m: string, plants: readonly string[], fen: string): boolean => plants.some((p) => oldBlockedBy(m, p, fen));

/** chandy.ts `beamAllows`. */
const oldBeamAllows = (fen: string, m: string, squares: readonly string[]): boolean => !oldHeldIn(fen, m, squares) && !moveSquares(m, fen).slice(1).some((sq) => squares.includes(sq));

/** chandy.ts `chandyStop`. */
function oldChandyStop(f: ChandyStopFields | null, fen: string, m: string): StopReason | null {
  if (!f) return null;
  if (f.beam.length && !oldBeamAllows(fen, m, f.beam)) return "beam";
  if (f.scatter.length && oldLands(m, fen).some((sq) => f.scatter.includes(sq))) return "scatter";
  if (f.shields.length && takesShield(fen, m, f.shields)) return "shield";
  return null;
}

/** zebra.ts `zebraStop`. */
function oldZebraStop(z: NonNullable<StopFields["zebra"]> | null, fen: string, m: string): StopReason | null {
  if (!z) return null;
  if (pawnOnGold(fen, m, z.gold)) return "gold";
  const pc = pieceAt(fen, m.slice(0, 2));
  if (z.his && pc?.color === z.his && z.lumps.some((l) => l.square === m.slice(2, 4))) return "dough";
  return null;
}

/** Each boss's own checks as they stood: its crowdFilter, its bossStops, its stopReason. */
interface OldRules {
  crowd(allowed: string[], boss: BossState, fen: string): string[];
  his(boss: BossState): ((m: string, fen: string) => boolean) | null;
  why(boss: { powers?: StopFields | null }, fen: string, m: string): StopReason | null;
}

const OLD: Record<string, OldRules> = {
  clown: {
    crowd: (a, boss, fen) => {
      const pied = piedSquares(boss);
      return pied.length ? a.filter((m) => !oldLands(m, fen).some((sq) => pied.includes(sq))) : a;
    },
    his: (boss) => {
      const pied = piedSquares(boss);
      return pied.length ? (m) => pied.includes(m.slice(2, 4)) : null;
    },
    why: (boss, fen, m) => {
      const pied = (boss.powers?.pies ?? []).map((x) => x.square);
      return pied.length && oldLands(m, fen).some((sq) => pied.includes(sq)) ? "pie" : null;
    },
  },
  bigboy: {
    crowd: (a, boss, fen) => {
      const p = boss.powers!;
      return p.tower || p.scatter ? a.filter((m) => !oldToyStops(m, p, fen, true)) : a;
    },
    his: (boss) => {
      const p = boss.powers;
      if (!p?.tower && !p?.scatter) return null;
      const open = hisToppleOpen(p);
      return (m, fen) => oldToyStops(m, p, fen, open);
    },
    why: (boss, fen, m) => (oldToyStops(m, boss.powers, fen, false) ? "block" : null),
  },
  gardener: {
    crowd: (a, boss, fen) => {
      const plants = plantSquares(boss.powers);
      return plants.length ? a.filter((m) => !oldPlantStops(m, plants, fen)) : a;
    },
    his: (boss) => {
      const plants = plantSquares(boss.powers);
      return plants.length ? (m, fen) => oldPlantStops(m, plants, fen) : null;
    },
    why: (boss, fen, m) => (oldPlantStops(m, (boss.powers?.garden?.plants ?? []).map((p) => p.square), fen) ? "plant" : null),
  },
  chandy: {
    crowd: (a, boss, fen) => {
      const f = stopFieldsOf(boss.powers);
      if (!f || (!f.scatter.length && !f.beam.length && !f.shields.length)) return a;
      return a.filter((m) => !oldChandyStop(f, fen, m));
    },
    his: (boss) => {
      const p = boss.powers!;
      const sc = p.chandy?.scatter;
      const on = sc && sc.turn === p.turn ? sc : null;
      return on ? (m, fen) => oldLands(m, fen).some((sq) => on.squares.includes(sq)) : null;
    },
    why: (boss, fen, m) => oldChandyStop(stopFieldsOf(boss.powers), fen, m),
  },
  zebra: {
    crowd: (a, boss, fen) => {
      const gold = boss.powers?.zebra?.gold ?? [];
      return gold.length ? a.filter((m) => !pawnOnGold(fen, m, gold)) : a;
    },
    his: (boss) => {
      const lumps = doughSquares(boss.powers);
      return lumps.length ? (m) => lumps.includes(m.slice(2, 4)) : null;
    },
    why: (boss, fen, m) => oldZebraStop(boss.powers?.zebra ?? null, fen, m),
  },
};

/** The held pieces (PR 2's twin keeps their rule), from the layer. */
const heldOf = (rules: BossRules, boss: BossState, fen: string): string[] => (rules.layer?.(boss, fen)?.pieces ?? []).filter((m) => m.held).map((m) => m.square);

/** boss-powers.ts `limitCrowd`: the held pieces' moves out, then the boss's own limits. */
function oldLimitCrowd(old: OldRules, rules: BossRules, boss: BossState, fen: string, legal: string[]): string[] {
  const held = heldOf(rules, boss, fen);
  return old.crowd(held.length ? legal.filter((m) => !oldHeldIn(fen, m, held)) : legal, boss, fen);
}

/** boss-powers.ts `crowdAllowed`: the limits, lifted if none is left; the Last Stand's barred move on top. */
function oldCrowdAllowed(old: OldRules, rules: BossRules, boss: BossState, fen: string): string[] | null {
  const legal = legalMoves(fen);
  let allowed = oldLimitCrowd(old, rules, boss, fen, legal);
  if (!allowed.length) allowed = legal;
  if (boss.barred) {
    const open = allowed.filter((m) => m !== boss.barred);
    allowed = open.length ? open : legal.filter((m) => m !== boss.barred);
    if (!allowed.length) allowed = legal;
  }
  return allowed.length === legal.length ? null : allowed;
}

/** boss-powers.ts `bossAllowed`. */
function oldBossAllowed(old: OldRules, boss: BossState, fen: string): string[] | null {
  const stops = old.his(boss);
  if (!stops) return null;
  const legal = legalMoves(fen);
  const allowed = legal.filter((m) => !stops(m, fen));
  return allowed.length && allowed.length < legal.length ? allowed : null;
}

/** boss-powers.ts `boardAltered`, the general test (every boss here had a crowdFilter, so it never stopped early). */
function oldBoardAltered(old: OldRules, rules: BossRules, boss: BossState, fen: string, toys: boolean): boolean {
  if ((toys ? oldToysTakeMove(boss.powers, fen) : rules.powerTurn?.(boss, fen)) || old.his(boss) || rules.altersBoard?.(boss)) return true;
  const legal = legalMoves(fen);
  return oldLimitCrowd(old, rules, boss, fen, legal).length < legal.length;
}

// ---------------- The twin ----------------

interface Tally {
  crowdTurns: number;
  bossTurns: number;
  crowdStopped: number;
  bossStopped: number;
  castles: number;
  lifted: number;
}

function battlesOf(id: string): KitBattle[] {
  const def = BOSS_ROSTER.find((d) => d.id === id)!;
  const kit = kitBattles(def, MAX_MOVES, SEEDS - 1);
  const more = FAMILY[id]!.flatMap((test, i) =>
    Array.from({ length: SEEDS }, (_, k): KitBattle => ({ ...kit[0]!, seed: 8000 + 100 * i + k, side: k % 2 ? "b" : "w", test, triggerFrom: 4, strikes: [5] })),
  );
  return [...kit, ...more];
}

const castling = (fen: string, m: string) => pieceAt(fen, m.slice(0, 2))?.type === "k" && Math.abs(m.charCodeAt(0) - m.charCodeAt(2)) === 2;

describe("the square marks on the board layer: the twin of today's rules", () => {
  for (const id of Object.keys(FAMILY)) {
    it(`${id}: both sides' allowed moves, the screens' words, the Last Stand's test and the powers' geometry are today's, every turn`, async () => {
      const undo = quickSearches();
      const old = OLD[id]!;
      const t: Tally = { crowdTurns: 0, bossTurns: 0, crowdStopped: 0, bossStopped: 0, castles: 0, lifted: 0 };
      const diffs: string[] = [];
      try {
        for (const k of battlesOf(id)) {
          await runBattle(k, null, (r, fen, who) => {
            const boss = r.boss!;
            if (!boss.powers) return;
            const rules = bossRules(boss)!;
            const at = `seed ${k.seed} ?power=${k.test} turn ${boss.crowdMoves + 1} ${who} ${fen}`;
            const diff = (what: string, was: unknown, now: unknown) => {
              if (JSON.stringify(was) !== JSON.stringify(now)) diffs.push(`${at}: ${what} ${JSON.stringify(was)} -> ${JSON.stringify(now)}`);
            };
            const legal = legalMoves(fen);
            if (who === "crowd") {
              t.crowdTurns++;
              const was = oldCrowdAllowed(old, rules, boss, fen);
              diff("crowdAllowed", was, crowdAllowed(boss, fen));
              diff("the runner's crowdAllowed", was, r.crowdAllowed());
              const free = oldLimitCrowd(old, rules, boss, fen, legal);
              if (free.length < legal.length) t.crowdStopped++;
              if (legal.some((m) => castling(fen, m) && !free.includes(m))) t.castles++;
              if (!free.length && legal.length) t.lifted++;
              const toys = id === "bigboy";
              diff("boardAltered", oldBoardAltered(old, rules, boss, fen, toys), boardAltered(boss, fen));
              if (toys) {
                diff("powerTurn", oldToysTakeMove(boss.powers, fen), rules.powerTurn!(boss, fen));
                // (The Last Stand's own test for him, the game's path: the first move the crowd may play, against each reply.)
                const played = (was ?? legal)[0];
                if (played) for (const reply of [...legalIn(applyMove(fen, played)), undefined]) diff(`standAltered ${played} ${reply}`, oldToysTakeReply(boss.powers, fen, played, reply), toysTakeReply(boss.powers, fen, played, reply));
              }
            } else {
              t.bossTurns++;
              const was = oldBossAllowed(old, boss, fen);
              diff("bossAllowed", was, bossAllowed(boss, fen));
              diff("the runner's bossAllowed", was, r.bossAllowed());
              const stops = old.his(boss);
              if (stops && legal.some((m) => stops(m, fen))) t.bossStopped++;
              diff("bossStopped", legal.filter((m) => !!stops?.(m, fen)), legal.filter((m) => bossStopped(boss, fen, m)));
            }
            // The screens' words for every legal move, the match's state and the screens' view.
            const view = r.bossView();
            for (const m of legal) {
              diff(`stopReason ${m}`, old.why(boss, fen, m), stopReason(boss, fen, m));
              if (view) diff(`the view's stopReason ${m}`, old.why(view, fen, m), stopReason(view, fen, m));
            }
            // The geometry the powers' own picks use: where each move lands; a wall on any empty square; Big Boy's toys either way;
            // a few beams.
            for (const m of legal) {
              diff(`lands ${m}`, oldLands(m, fen), lands(m, fen));
              for (let f = 0; f < 8; f++)
                for (let rank = 1; rank <= 8; rank++) {
                  const sq = `${FILES[f]}${rank}`;
                  if (!pieceAt(fen, sq) && oldBlockedBy(m, sq, fen) !== blockedBy(m, sq, fen)) diffs.push(`${at}: blockedBy ${m} ${sq}`);
                }
              if (id === "bigboy") for (const open of [true, false]) diff(`toyStops ${m} ${open}`, oldToyStops(m, boss.powers, fen, open), toyStops(m, boss.powers, fen, open));
              if (id === "chandy")
                for (let b = 0; b < 4; b++) {
                  const rank = ((boss.crowdMoves + 2 * b) % 8) + 1;
                  const file = FILES[(3 * boss.crowdMoves + 5 * b) % 8]!;
                  const squares = [...new Set([...FILES].map((x) => `${x}${rank}`).concat([1, 2, 3, 4, 5, 6, 7, 8].map((y) => `${file}${y}`)))];
                  diff(`beamAllows ${m} ${file}${rank}`, oldBeamAllows(fen, m, squares), beamAllows(fen, m, squares));
                }
            }
          });
        }
      } finally {
        undo();
      }
      expect(diffs.slice(0, 20)).toEqual([]);
      // (The battles reach what the twin is for: marks that stop the crowd's moves, and his. Measured Nov 18: crowd turns with a
      // move stopped 21-114 a boss, his 4-67; castling stopped for Big Boy, Puddles and Chandy.)
      expect(t.crowdStopped, JSON.stringify(t)).toBeGreaterThan(0);
      expect(t.bossStopped, JSON.stringify(t)).toBeGreaterThan(0);
    }, 300_000);
  }
});
