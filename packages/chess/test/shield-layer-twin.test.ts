import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, type BossState, type ChandyState, type StopReason } from "@chessroyale/core";
import {
  bindsBosses,
  boardAltered,
  bossAllowed,
  bossRules,
  capturedSquare,
  chandyMarks,
  crowdAllowed,
  doughMarks,
  layerStop,
  legalMoves,
  marksStop,
  mateOpen,
  matingMoves,
  mergeLayers,
  pieceAt,
  stopFieldsOf,
  stopReason,
  type BossRules,
  type LayerMarks,
  type StopFields,
} from "../src/index.ts";
import { kitBattles, quickSearches, runBattle, type KitBattle } from "./boss-kit-lib.ts";

/**
 * The shields' twin (Battle Tower PR 5, Nov 18; docs/decisions/2026-11-18-shields-on-the-layer.md): Don Dough's gold (no pawn of
 * the crowd's takes a gold piece) and Chandy's shields (the crowd takes no shielded piece) moved from each boss's `crowdFilter`
 * and `stopReason` onto the board layer (`shieldFrom` piece marks: `goldMarks`, `chandyMarks`). Over seeded battles of both
 * bosses (the kit's, more seeds, and each power that shields switched on), on every crowd turn and before every move of his: the
 * crowd's allowed moves (the dispatcher's and the runner's), his, the Last Stand's test, the screens' words for every legal move
 * (the match's state and the screens' view), Don Dough's power turn (a pawn could take gold) and Chandy's last chance all agree
 * exactly with today's rules, frozen here as they stood on main. Solo and the server both ask the runner's `crowdAllowed` and
 * `bossAllowed`, read here too (the server's own path: boss-kit-parity.test.ts).
 */

/** The family, by BOSS_ROSTER id, and each one's test switches that shield beyond the kit's own battles. */
const FAMILY: Record<string, readonly string[]> = { zebra: ["goldplate"], chandy: ["shields"] };
const MAX_MOVES = 24;
const SEEDS = 3;

// ---------------- Today's rules, frozen (main before the move) ----------------

/** zebra.ts `pawnOnGold`. */
const pawnOnGold = (fen: string, m: string, gold: readonly string[]): boolean => gold.includes(m.slice(2, 4)) && pieceAt(fen, m.slice(0, 2))?.type === "p";

/** chandy.ts `takesShield`. */
const takesShield = (fen: string, m: string, shields: readonly string[]): boolean => shields.includes(capturedSquare(fen, m) ?? "");

/** The boss's marks on the layer without the shields (their rules as they stood: the boss's own checks below). */
const unshielded = (marks: LayerMarks | null | undefined): LayerMarks | null => (marks ? { ...marks, pieces: (marks.pieces ?? []).filter((m) => !m.shieldFrom) } : null);

/** zebra.ts and chandy.ts: their crowdFilter, their stopReason, Don Dough's power turn. */
interface OldRules {
  crowd(allowed: string[], boss: BossState, fen: string): string[];
  why(boss: { powers?: StopFields | null }, fen: string, m: string): StopReason | null;
  powerTurn(boss: BossState, fen: string, rules: BossRules): boolean;
}

const OLD: Record<string, OldRules> = {
  zebra: {
    crowd: (a, boss, fen) => {
      const gold = boss.powers?.zebra?.gold ?? [];
      return gold.length ? a.filter((m) => !pawnOnGold(fen, m, gold)) : a;
    },
    why: (boss, fen, m) => {
      const z = boss.powers?.zebra;
      if (!z) return null;
      if (pawnOnGold(fen, m, z.gold)) return "gold";
      const crowd = z.his === "w" ? "b" : "w";
      if (z.his && z.lumps.length && marksStop({ squares: doughMarks(z.lumps.map((l) => l.square)) }, fen, m, crowd)) return "dough";
      return null;
    },
    powerTurn: (boss, fen) => {
      const z = boss.powers!.zebra!;
      return z.rises.some((r) => r.at === boss.crowdMoves) || (z.gold.length > 0 && legalMoves(fen).some((m) => pawnOnGold(fen, m, z.gold)));
    },
  },
  chandy: {
    crowd: (a, boss, fen) => {
      const shields = stopFieldsOf(boss.powers)?.shields ?? [];
      return shields.length ? a.filter((m) => !takesShield(fen, m, shields)) : a;
    },
    why: (boss, fen, m) => {
      const f = stopFieldsOf(boss.powers);
      if (!f) return null;
      const mark = marksStop(chandyMarks({ ...f, shields: [] }), fen, m);
      if (mark) return mark.kind as StopReason;
      return f.shields.length && takesShield(fen, m, f.shields) ? "shield" : null;
    },
    powerTurn: (boss, fen, rules) => rules.powerTurn!(boss, fen),
  },
};

/** chandy.ts `mateOpen`. */
function oldMateOpen(c: ChandyState | null | undefined, fen: string, turn: number): boolean {
  const mates = matingMoves(fen);
  if (!mates.length) return false;
  const f = stopFieldsOf({ chandy: c, turn });
  const dizzy = c?.dizzy && c.dizzy.turn === turn ? c.dizzy.squares : [];
  const marks = chandyMarks(f && { ...f, shields: [] }, dizzy);
  const ok = (m: string) => !marksStop(marks, fen, m) && !(f?.shields.length && takesShield(fen, m, f.shields));
  return mates.some(ok) || !legalMoves(fen).some(ok);
}

/** boss-powers.ts `limitCrowd`: the marks on the layer, then the boss's own limits. */
function oldLimitCrowd(old: OldRules, rules: BossRules, boss: BossState, fen: string, legal: string[]): string[] {
  const marks = unshielded(rules.layer?.(boss, fen));
  const layer = marks ? mergeLayers(boss.crowdSide, [marks]) : null;
  return old.crowd(layer ? legal.filter((m) => !layerStop(layer, fen, m)) : legal, boss, fen);
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

/** boss-powers.ts `bossAllowed`: the marks that bind him. */
function oldBossAllowed(rules: BossRules, boss: BossState, fen: string): string[] | null {
  const marks = unshielded(rules.layer?.(boss, fen));
  if (!bindsBosses(marks)) return null;
  const layer = mergeLayers(boss.crowdSide, [marks]);
  const legal = legalMoves(fen);
  const allowed = legal.filter((m) => !layerStop(layer, fen, m));
  return allowed.length && allowed.length < legal.length ? allowed : null;
}

/** boss-powers.ts `boardAltered`, the general test (both had a crowdFilter, so it never stopped early). */
function oldBoardAltered(old: OldRules, rules: BossRules, boss: BossState, fen: string): boolean {
  if (old.powerTurn(boss, fen, rules) || rules.altersBoard?.(boss)) return true;
  if (bindsBosses(unshielded(rules.layer?.(boss, fen)))) return true;
  const legal = legalMoves(fen);
  return oldLimitCrowd(old, rules, boss, fen, legal).length < legal.length;
}

// ---------------- The twin ----------------

function battlesOf(id: string): KitBattle[] {
  const def = BOSS_ROSTER.find((d) => d.id === id)!;
  const kit = kitBattles(def, MAX_MOVES, SEEDS - 1);
  const more = FAMILY[id]!.flatMap((test, i) =>
    Array.from({ length: SEEDS }, (_, k): KitBattle => ({ ...kit[0]!, seed: 9000 + 100 * i + k, side: k % 2 ? "b" : "w", test, triggerFrom: 4, strikes: [5] })),
  );
  return [...kit, ...more];
}

describe("the shields on the board layer: the twin of today's rules", () => {
  for (const id of Object.keys(FAMILY)) {
    it(`${id}: both sides' allowed moves, the Last Stand's test, the screens' words and the powers' own looks are today's, every turn`, async () => {
      const undo = quickSearches();
      const old = OLD[id]!;
      const t = { crowdTurns: 0, bossTurns: 0, shielded: 0, stopped: 0, lifted: 0, mates: 0 };
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
              diff("boardAltered", oldBoardAltered(old, rules, boss, fen), boardAltered(boss, fen));
              diff("powerTurn", old.powerTurn(boss, fen, rules), rules.powerTurn!(boss, fen));
              if ((rules.layer?.(boss, fen)?.pieces ?? []).some((m) => m.shieldFrom)) t.shielded++;
              const shieldless = old.crowd(legal, boss, fen);
              if (shieldless.length < legal.length) t.stopped++;
              if (!shieldless.length && legal.length) t.lifted++;
              if (id === "chandy") {
                const p = boss.powers;
                if (matingMoves(fen).length) t.mates++;
                diff("mateOpen", oldMateOpen(p.chandy, fen, p.turn), mateOpen(p, { fen, turn: p.turn }));
              }
            } else {
              t.bossTurns++;
              const was = oldBossAllowed(rules, boss, fen);
              diff("bossAllowed", was, bossAllowed(boss, fen));
              diff("the runner's bossAllowed", was, r.bossAllowed());
            }
            // The screens' words for every legal move, the match's state and the screens' view.
            const view = r.bossView();
            for (const m of legal) {
              diff(`stopReason ${m}`, old.why(boss, fen, m), stopReason(boss, fen, m));
              if (view) diff(`the view's stopReason ${m}`, old.why(view, fen, m), stopReason(view, fen, m));
            }
          });
        }
      } finally {
        undo();
      }
      expect(diffs.slice(0, 20)).toEqual([]);
      // (The battles reach what the twin is for: shields up, and crowd moves they stop.)
      expect(t.shielded, JSON.stringify(t)).toBeGreaterThan(0);
      expect(t.stopped, JSON.stringify(t)).toBeGreaterThan(0);
    }, 300_000);
  }
});
