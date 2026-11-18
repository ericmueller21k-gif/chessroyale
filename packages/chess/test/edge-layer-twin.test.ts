import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, type BossPowerState, type BossState, type SawCut, type StopReason } from "@chessroyale/core";
import {
  CREASE_LINES,
  boardAltered,
  bossAllowed,
  bossRules,
  bossStopped,
  creaseMarks,
  creaseMoves,
  creaseOn,
  crowdAllowed,
  firstMoveDue,
  legalMoves,
  marksStop,
  pieceAt,
  sawMarks,
  stopReason,
  type BossRules,
  type StopFields,
} from "../src/index.ts";
import { kitBattles, quickSearches, runBattle, type KitBattle } from "./boss-kit-lib.ts";

/**
 * The edges' twin (Battle Tower PR 4, Nov 18; docs/decisions/2026-11-18-edges-on-the-layer.md): Sawyer's saw cut and board saw
 * and Folio's crease moved from each boss's own checks (`crowdFilter`, `bossStops`, `stopReason`: crossesCut, crossesMiddle,
 * sawStops, crossesCrease) onto the board layer (`BossRules.layer`: `sawMarks`, `creaseMarks`; `layerStop`, `marksStop`). Over
 * seeded battles of both bosses (the kit's, more seeds, and each ultimate switched on), on every crowd turn and before every move
 * of his: the crowd's allowed moves, his allowed moves, which of his moves went through a power, the screens' words for every
 * legal move (the match's state and the screens' view), the Last Stand's test, the crease's moves for every line (its pick's
 * guard), and the geometry (every move against a cut on every inner edge, the board saw, a crease on every line) all agree
 * exactly with today's rules, frozen here as they stood on main. Solo and the server both ask the runner's `crowdAllowed` and
 * `bossAllowed`, read here too (the server's own path: boss-kit-parity.test.ts).
 */

/** The family, by BOSS_ROSTER id, and each one's test switches beyond the kit's own battles. */
const FAMILY: Record<string, readonly string[]> = { sawyer: ["boardsaw"], folio: ["crease"] };
const MAX_MOVES = 24;
const SEEDS = 2;
const FILES = "abcdefgh";

// ---------------- Today's rules, frozen (main before the move) ----------------

const file = (sq: string) => sq.charCodeAt(0) - 97;
const rank = (sq: string) => Number(sq[1]);
const square = (f: number, r: number) => `${FILES[f]}${r}`;

/** bosses/base.ts `heldIn` before PR 2 (Folio's folded piece). */
function oldHeldIn(fen: string, move: string, held: readonly string[]): boolean {
  if (held.includes(move.slice(0, 2))) return true;
  const f0 = move.charCodeAt(0);
  const f1 = move.charCodeAt(2);
  if (Math.abs(f1 - f0) !== 2 || move[1] !== move[3] || pieceAt(fen, move.slice(0, 2))?.type !== "k") return false;
  return held.includes(`${f1 > f0 ? "h" : "a"}${move[1]}`);
}

/** board-layer.ts `moveEdges` (sawyer.ts's before PR 1). */
function oldMoveEdges(move: string, fen?: string): { a: string; b: string }[] {
  const a = move.slice(0, 2);
  const b = move.slice(2, 4);
  const df = file(b) - file(a);
  const dr = rank(b) - rank(a);
  if (df !== 0 && dr !== 0) return [];
  let end = b;
  if (fen && dr === 0 && Math.abs(df) === 2 && pieceAt(fen, a)?.type === "k") end = square(df > 0 ? 7 : 0, rank(a));
  const n = Math.max(Math.abs(file(end) - file(a)), Math.abs(rank(end) - rank(a)));
  const sf = Math.sign(file(end) - file(a));
  const sr = Math.sign(rank(end) - rank(a));
  const edge = (s1: string, s2: string) => (file(s1) < file(s2) || (file(s1) === file(s2) && rank(s1) < rank(s2)) ? { a: s1, b: s2 } : { a: s2, b: s1 });
  const out: { a: string; b: string }[] = [];
  for (let k = 0; k < n; k++) out.push(edge(square(file(a) + sf * k, rank(a) + sr * k), square(file(a) + sf * (k + 1), rank(a) + sr * (k + 1))));
  return out;
}

/** sawyer.ts `crossesCut`. */
const oldCrossesCut = (move: string, cut: Pick<SawCut, "a" | "b"> | null | undefined, fen?: string): boolean => !!cut && oldMoveEdges(move, fen).some((e) => e.a === cut.a && e.b === cut.b);

/** sawyer.ts `crossesMiddle`. */
const oldCrossesMiddle = (move: string): boolean => file(move.slice(0, 2)) <= 3 !== file(move.slice(2, 4)) <= 3;

/** sawyer.ts `sawStops`. */
const oldSawStops = (p: Pick<BossPowerState, "cut" | "boardSaw">, move: string, fen: string): boolean => oldCrossesCut(move, p.cut, fen) || (!!p.boardSaw && oldCrossesMiddle(move));

/** folio.ts `sideOf`. */
function sideOf(line: string, sq: string): 0 | 1 {
  const c = line[0]!;
  return c >= "a" && c <= "h" ? (file(sq) <= file(`${c}1`) ? 0 : 1) : rank(sq) <= Number(c) ? 0 : 1;
}

/** folio.ts `crossesCrease`. */
function oldCrossesCrease(move: string, line: string | null | undefined, fen?: string): boolean {
  if (!line) return false;
  const a = move.slice(0, 2);
  const b = move.slice(2, 4);
  if (sideOf(line, a) !== sideOf(line, b)) return true;
  if (fen && rank(a) === rank(b) && Math.abs(file(b) - file(a)) === 2 && pieceAt(fen, a)?.type === "k") {
    const kingside = file(b) > file(a);
    return sideOf(line, square(kingside ? 7 : 0, rank(a))) !== sideOf(line, square(kingside ? 5 : 3, rank(a)));
  }
  return false;
}

/** folio.ts `creaseMoves`. */
const oldCreaseMoves = (fen: string, line: string | null | undefined): string[] => {
  const legal = legalMoves(fen);
  return line ? legal.filter((m) => !oldCrossesCrease(m, line, fen)) : legal;
};

/** Each boss's own checks as they stood: its crowdFilter, its bossStops, its stopReason. */
interface OldRules {
  crowd(allowed: string[], boss: BossState, fen: string): string[];
  his(boss: BossState): ((m: string, fen: string) => boolean) | null;
  why(boss: { powers?: StopFields | null }, fen: string, m: string): StopReason | null;
}

const OLD: Record<string, OldRules> = {
  sawyer: {
    crowd: (a, boss, fen) => {
      const p = boss.powers!;
      return p.cut || p.boardSaw ? a.filter((m) => !oldSawStops(p, m, fen)) : a;
    },
    his: (boss) => {
      const p = boss.powers;
      if (!p) return null;
      const first = firstMoveDue(p);
      if (!first && !p.cut && !p.boardSaw) return null;
      return (m, fen) => (first && pieceAt(fen, m.slice(0, 2))?.type !== "p") || oldSawStops(p, m, fen);
    },
    why: (boss, fen, m) => (boss.powers?.boardSaw && oldCrossesMiddle(m) ? "boardsaw" : oldCrossesCut(m, boss.powers?.cut, fen) ? "cut" : null),
  },
  folio: {
    crowd: (a, boss, fen) => {
      const line = creaseOn(boss.powers, boss.crowdMoves + 1);
      return line ? a.filter((m) => !oldCrossesCrease(m, line, fen)) : a;
    },
    his: () => null,
    why: (boss, fen, m) => {
      const c = boss.powers?.crease;
      return c && oldCrossesCrease(m, c.line, fen) && pieceAt(fen, m.slice(0, 2))?.color === c.side ? "crease" : null;
    },
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

/** boss-powers.ts `boardAltered`, the general test (both had a crowdFilter, so it never stopped early). */
function oldBoardAltered(old: OldRules, rules: BossRules, boss: BossState, fen: string): boolean {
  if (rules.powerTurn?.(boss, fen) || old.his(boss) || rules.altersBoard?.(boss)) return true;
  const legal = legalMoves(fen);
  return oldLimitCrowd(old, rules, boss, fen, legal).length < legal.length;
}

// ---------------- The twin ----------------

/** Every edge between two neighboring squares (112), in edgeOf's order. */
const EDGES: { a: string; b: string }[] = [];
for (let f = 0; f < 8; f++)
  for (let r = 1; r <= 8; r++) {
    if (f < 7) EDGES.push({ a: square(f, r), b: square(f + 1, r) });
    if (r < 8) EDGES.push({ a: square(f, r), b: square(f, r + 1) });
  }

function battlesOf(id: string): KitBattle[] {
  const def = BOSS_ROSTER.find((d) => d.id === id)!;
  const kit = kitBattles(def, MAX_MOVES, SEEDS - 1);
  const more = FAMILY[id]!.flatMap((test, i) =>
    Array.from({ length: SEEDS }, (_, k): KitBattle => ({ ...kit[0]!, seed: 9000 + 100 * i + k, side: k % 2 ? "b" : "w", test, triggerFrom: 4, strikes: [5] })),
  );
  return [...kit, ...more];
}

const castling = (fen: string, m: string) => pieceAt(fen, m.slice(0, 2))?.type === "k" && Math.abs(m.charCodeAt(0) - m.charCodeAt(2)) === 2;

describe("the edges on the board layer: the twin of today's rules", () => {
  it("the geometry: every move of a few positions against a cut on every edge, the board saw and a crease on every line", () => {
    const fens = [
      "r3k2r/pppq1ppp/2n2n2/3pp3/3PP3/2N2N2/PPPQ1PPP/R3K2R w KQkq - 0 1",
      "r3k2r/pppq1ppp/2n2n2/3pp3/3PP3/2N2N2/PPPQ1PPP/R3K2R b KQkq - 0 1",
      "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
      "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2",
      "8/P6k/8/8/8/8/6Kp/8 w - - 0 1",
    ];
    const diffs: string[] = [];
    for (const fen of fens)
      for (const m of legalMoves(fen)) {
        for (const e of EDGES) if (oldCrossesCut(m, e, fen) !== !!marksStop({ edges: sawMarks({ cut: { ...e, at: 1, until: 1 } }) }, fen, m)) diffs.push(`${fen} ${m} cut ${e.a}-${e.b}`);
        if (oldCrossesMiddle(m) !== !!marksStop({ edges: sawMarks({ boardSaw: { at: 1, until: 1 } }) }, fen, m)) diffs.push(`${fen} ${m} boardsaw`);
        for (const l of CREASE_LINES) if (oldCrossesCrease(m, l, fen) !== !!marksStop({ edges: creaseMarks(l) }, fen, m)) diffs.push(`${fen} ${m} crease ${l}`);
      }
    expect(diffs.slice(0, 20)).toEqual([]);
  });

  for (const id of Object.keys(FAMILY)) {
    it(`${id}: both sides' allowed moves, the screens' words, the Last Stand's test and the edges' geometry are today's, every turn`, async () => {
      const undo = quickSearches();
      const old = OLD[id]!;
      const t = { crowdTurns: 0, bossTurns: 0, crowdStopped: 0, bossStopped: 0, bossSawn: 0, castles: 0, lifted: 0 };
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
              diff("boardAltered", oldBoardAltered(old, rules, boss, fen), boardAltered(boss, fen));
              // (The crease's pick: its guard and costs ask each line's moves.)
              if (id === "folio") for (const l of CREASE_LINES) diff(`creaseMoves ${l}`, oldCreaseMoves(fen, l), creaseMoves(fen, l));
            } else {
              t.bossTurns++;
              const was = oldBossAllowed(old, boss, fen);
              diff("bossAllowed", was, bossAllowed(boss, fen));
              diff("the runner's bossAllowed", was, r.bossAllowed());
              const stops = old.his(boss);
              if (stops && legal.some((m) => stops(m, fen))) t.bossStopped++;
              if (boss.powers.cut || boss.powers.boardSaw) if (legal.some((m) => oldSawStops(boss.powers!, m, fen))) t.bossSawn++;
              diff("bossStopped", legal.filter((m) => !!stops?.(m, fen)), legal.filter((m) => bossStopped(boss, fen, m)));
            }
            // The screens' words for every legal move, the match's state and the screens' view.
            const view = r.bossView();
            for (const m of legal) {
              diff(`stopReason ${m}`, old.why(boss, fen, m), stopReason(boss, fen, m));
              if (view) diff(`the view's stopReason ${m}`, old.why(view, fen, m), stopReason(view, fen, m));
            }
            // The geometry: every legal move against a cut on every edge, the board saw, a crease on every line.
            for (const m of legal) {
              if (id === "sawyer") {
                for (const e of EDGES) if (oldCrossesCut(m, e, fen) !== !!marksStop({ edges: sawMarks({ cut: { ...e, at: 1, until: 1 } }) }, fen, m)) diffs.push(`${at}: cut ${m} ${e.a}-${e.b}`);
                diff(`boardsaw ${m}`, oldCrossesMiddle(m), !!marksStop({ edges: sawMarks({ boardSaw: { at: 1, until: 1 } }) }, fen, m));
              } else for (const l of CREASE_LINES) diff(`crease ${m} ${l}`, oldCrossesCrease(m, l, fen), !!marksStop({ edges: creaseMarks(l) }, fen, m));
            }
          });
        }
      } finally {
        undo();
      }
      expect(diffs.slice(0, 20)).toEqual([]);
      // (The battles reach what the twin is for: edges that stop the crowd's moves, and Sawyer's.)
      expect(t.crowdStopped, JSON.stringify(t)).toBeGreaterThan(0);
      if (id === "sawyer") expect(t.bossSawn, JSON.stringify(t)).toBeGreaterThan(0);
      console.log(id, JSON.stringify(t));
    }, 300_000);
  }
});
