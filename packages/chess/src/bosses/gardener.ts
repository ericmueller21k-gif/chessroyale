/**
 * The hippo gardener (BOSS_ROSTER "gardener", GARDENER_NAME a placeholder; Eric, Oct 20; docs/decisions/2026-10-21-gardener-rules.md).
 * He starts from the starting position, as every raid does.
 *
 * His passive, Seeds:
 * - **A public count on a real-time meter:** seedsAtStart seeds as the battle begins (`plantMany`, his opening toss), then
 *   one every seedEverySec seconds of real time, whoever's turn it is, up to seedMax waiting. The count is everyone's to
 *   see; where the seeds are is never decided until he waters, so nothing is hidden and nothing can leak.
 * - **The count is a pure function of time** (seedsAt): `base` seeds at clock time `since`, one more every seedEverySec.
 *   The server and every device work it out from the same two numbers, with no timer of its own and nothing sent as a
 *   seed lands. The clock is the match runner's (`Battle.now`): online the server's (the lobby's), solo and Boss alone
 *   the device's counting only while the page is in view (the app's garden clock: a player who walks away doesn't feed
 *   him; the cap bounds it too). Without one (tests, the sims' default), one crowd move counts as seedEverySec.
 * - **His toss over your turn:** `plantMany` as the first crowd turn begins; `plant` each time the count rises, played by
 *   the screens from their own clock (no turn's events carry it). Neither ever blocks or delays a move: their POWER_FX
 *   is 0, and nothing waits for them.
 *
 * His ultimate, Watering (the rage meter, `rageSpeed.gardener`):
 * - The usual warning as a crowd turn begins; at the start of his turn after it, his whole turn (passTurn: the crowd
 *   moves next, the en passant square cleared, a base at its ply). Every waiting seed comes up and the count goes to 0
 *   (from the moment it was taken: the meter starts again from empty).
 * - **Each seed rolls** (waterOdds, seeded from the battle): nothing, a plain plant, a killer plant, a pawn, a knight,
 *   bishop or rook (which one seeded), the queen. A plain plant blocks an empty square as Big Boy's toy block does
 *   (nothing moves onto it or through it, either side; a knight jumps it; it never stops an attack) for plantTurns crowd
 *   turns, then it's gone. A killer plant eats a non-king piece of either side (gone as if captured). A grown piece is
 *   his, on an empty square (a pawn never on a first or last rank, never a ninth).
 * - **Fair, by the engine:** the host's engines place what came up (waterFrom), outcome by outcome, the biggest first,
 *   each on the square (among waterLooks seeded ones its guards allow) that keeps his total gain nearest waterTarget, at
 *   most the band's top (waterBand; a queen lifts the top and the target to jackpotMax). A killer plant tries the crowd's
 *   pieces first and his own only when none keeps the band. An outcome with no square under the top is dropped: it comes
 *   up as nothing. Nothing at all placed: a shrug (his whole turn all the same).
 * - **Hard guards on every step:** never a king; never either side left in check; never a mate in one for either side;
 *   never the crowd without a move (the plants counted); never a position the engine refuses (stockfishRefuses).
 * - **The pass guard** (as every power that spends his whole turn): when the watering would lose him real material
 *   (passLoses), it waits for his next turn and he plays his move; the test switch's and the admins' trigger's come anyway.
 * - Online the server rolls the seeds and the host's engines place them (the boss request's `water`); the server checks
 *   the answer (waterCheck: what was rolled, where the rules allow it) and plays it. Anything else waits a turn.
 */
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type GardenPlant, type GardenState, type PowerEvent, type WaterGrowth, type WaterKind, type WaterResult } from "@chessroyale/core";
import { kingAttacked, legalMoves, mateInOne, pieceAt, sideToMove, withPiece, withoutPiece } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import { stockfishRefuses } from "../uci.ts";
import { PASS_WAIT, eachOn, logit, meterFull, other, passLoses, powerRoll, testSwitch, unleashed, type Battle, type BossRules, type Side } from "./base.ts";
import { blockedBy } from "./bigboy.ts";
import { passTurn } from "./hollow.ts";

/**
 * His animations' lengths (ms; docs/decisions/2026-10-21-gardener-animations.md, on his sprite's branch): the toss of one
 * seed (`plant`) and the opening's five (`plantMany`), the watering's cast (`water`: its `spray` cue at 460 ms), and his
 * reactions. The board art's: the sweep across the board (from `spray`), a sprout, and each outcome from the sprout
 * (`kill` with its `snap` cue at 350: the piece comes off; `bud` and `budQueen` with `pop` at 270: the piece goes on;
 * `grow`, a plain plant's first state; `wilt`, nothing; `gone`, a plain plant's last).
 */
export const GARDENER_ANIM = { plant: 740, plantMany: 800, water: 1340, waterSprayAt: 460, cheer: 720, bigCheer: 1200, shrug: 800 } as const;
export const GARDEN_ART = { sweep: 420, sprout: 300, kill: 870, killSnap: 350, bud: 550, budQueen: 630, budPop: 270, grow: 290, wilt: 490, gone: 480 } as const;

/**
 * The watering beat by beat (ms into its moment, as the crowd's turn after it begins): his `water` cast; the sweep across
 * the board from its `spray` cue, each seed sprouting as it passes (all sprouted by `sproutsBy`); then from `growAt`, the
 * outcomes one after another `stagger` apart in the order of `growth` (killer plants, grown pieces, plain plants,
 * nothing), each for its art's length. The moment lasts until the last has played (waterMs), at least the cast.
 */
export const WATER_BEATS = {
  sprayAt: GARDENER_ANIM.waterSprayAt,
  sproutsBy: GARDENER_ANIM.waterSprayAt + GARDEN_ART.sweep + GARDEN_ART.sprout,
  growAt: GARDENER_ANIM.water,
  stagger: 250,
} as const;

/** How long one outcome plays on its square, from its start (its board art). */
export const growthMs = (g: Pick<WaterGrowth, "kind">): number =>
  g.kind === "killer" ? GARDEN_ART.kill : g.kind === "q" ? GARDEN_ART.budQueen : g.kind === "plant" ? GARDEN_ART.grow : g.kind === "nothing" ? GARDEN_ART.wilt : GARDEN_ART.bud;

/** When outcome `i` of a watering starts (ms into its moment). */
export const growthAt = (i: number): number => WATER_BEATS.growAt + i * WATER_BEATS.stagger;

/** How long a watering's moment holds the screen: its cast, then every outcome in turn (WATER_BEATS). */
export function waterMs(growth: readonly Pick<WaterGrowth, "kind">[] | null | undefined): number {
  return (growth ?? []).reduce<number>((t, g, i) => Math.max(t, growthAt(i) + growthMs(g)), GARDENER_ANIM.water);
}

/**
 * How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts, so the server waits for them). The
 * seeds' tosses are 0: they play over whoever's turn it is and nothing waits for them (GARDENER_ANIM has their lengths).
 * The watering's own length grows with what came up (waterMs; boss-timing's POWER_FX_EXTRA adds the rest).
 */
export const GARDENER_FX = { plantMany: 0, plant: 0, water: GARDENER_ANIM.water, cheer: GARDENER_ANIM.cheer, bigCheer: GARDENER_ANIM.bigCheer, shrug: GARDENER_ANIM.shrug } as const;

type SeedSettings = Pick<BossPowerSettings, "seedsAtStart" | "seedEverySec" | "seedMax">;
type WaterSettings = Pick<BossPowerSettings, "waterBand" | "waterTarget" | "jackpotMax" | "waterLooks" | "waterNodes" | "waterBudget" | "bouncePawnLogit" | "passGuardPawns">;

// ---------------- Seeds ----------------

/**
 * The seeds waiting at clock time `now` (ms, the garden's clock: the server's online, the page's visible time solo) and
 * when the next one lands (null: the meter is at seedMax). A pure function of the meter's two numbers, so the server and
 * every device agree. `fixed`: the test switch's set count (?seeds=N), whatever the clock says.
 */
export function seedsAt(g: Pick<GardenState, "since" | "base"> & { fixed?: number | null }, now: number, s: SeedSettings = BOSS_POWERS): { count: number; next: number | null } {
  if (g.fixed !== undefined && g.fixed !== null) return { count: g.fixed, next: null };
  const every = s.seedEverySec * 1000;
  const grown = Math.floor(Math.max(0, now - g.since) / every);
  const count = Math.min(s.seedMax, g.base + grown);
  return { count, next: count >= s.seedMax ? null : g.since + (count - g.base + 1) * every };
}

/** The meter's fill toward the next seed (0-1; 1 at seedMax) at clock time `now`: what the app's meter draws. */
export function seedFill(g: Pick<GardenState, "since" | "base"> & { fixed?: number | null }, now: number, s: SeedSettings = BOSS_POWERS): number {
  const { next } = seedsAt(g, now, s);
  if (next === null) return 1;
  const every = s.seedEverySec * 1000;
  return Math.max(0, Math.min(1, 1 - (next - now) / every));
}

/** What one seed rolls at a watering (waterOdds, in percent), seeded from the battle, the watering and the seed. */
export function rollSeed(seed: number, watering: number, i: number, s: Pick<BossPowerSettings, "waterOdds"> = BOSS_POWERS): WaterKind {
  const r = powerRoll(seed, "water", watering, i) * 100;
  const o = s.waterOdds;
  let edge = 0;
  if (r < (edge += o.nothing)) return "nothing";
  if (r < (edge += o.plant)) return "plant";
  if (r < (edge += o.killer)) return "killer";
  if (r < (edge += o.pawn)) return "p";
  if (r < (edge += o.piece)) return (["n", "b", "r"] as const)[Math.floor(powerRoll(seed, "water-piece", watering, i) * 3)]!;
  return "q";
}

// ---------------- Watering: placing what came up ----------------

/** What a placed outcome is: a plain plant, a killer plant, or a piece grown for him. */
export type PlacedKind = Exclude<WaterKind, "nothing">;

/** One outcome placed: its kind and square. */
export interface Placed {
  kind: PlacedKind;
  square: string;
}

/**
 * What the host's engines (or solo's) need to place a watering: what the seeds rolled (in seed order), the plain plants
 * already on the board, and a number the order of the squares tried comes from (drawn from the battle's seed and the
 * watering: the battle's own seed never leaves the server).
 */
export interface WaterAsk {
  kinds: WaterKind[];
  plants: string[];
  order: number;
}

/**
 * The order the outcomes are placed in (biggest first), and what each is reckoned to add to his gain for the steps'
 * targets (in the gain's own pawns: the engine's win chances saturate, so a grown pawn on a square the engine allows
 * adds about half a pawn, a plain plant very little; measured on real positions, docs/decisions/2026-10-21-gardener-rules.md).
 */
const NOMINAL: Record<PlacedKind, number> = { q: 6, r: 3, b: 2, n: 2, killer: 1, p: 0.5, plant: 0.05 };
const BIG_FIRST: readonly PlacedKind[] = ["q", "r", "b", "n", "killer", "p", "plant"];
/** The order the screens play the outcomes in: killer plants, grown pieces (the queen last), plain plants, nothing. */
const PLAY_ORDER: readonly WaterKind[] = ["killer", "p", "n", "b", "r", "q", "plant", "nothing"];

/** An answer's letter for each kind: "t" a plain plant, "x" a killer plant, a piece's own letter. */
const CODE: Record<PlacedKind, string> = { plant: "t", killer: "x", p: "p", n: "n", b: "b", r: "r", q: "q" };
const KIND_OF: Record<string, PlacedKind> = { t: "plant", x: "killer", p: "p", n: "n", b: "b", r: "r", q: "q" };

/** The host's answer for a placement: each outcome as its letter and square, in the order placed ("none": nothing at all). */
export const waterCode = (placed: readonly Placed[]): string => (placed.length ? placed.map((p) => CODE[p.kind] + p.square).join(" ") : "none");

const SQUARES: readonly string[] = [..."abcdefgh"].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`));
const isSquare = (sq: string) => SQUARES.includes(sq);

/** A move a plain plant stops (lands on it or passes over it; a knight jumps it), as a toy block does. */
export const plantStops = (move: string, plants: readonly string[], fen?: string): boolean => plants.some((p) => blockedBy(move, p, fen));

/**
 * A position a watering may leave (the crowd to move, `plants` on the board): one the engine plays, neither side in
 * check, a move for the crowd that no plant stops, no mate in one for the crowd, and none for him were the crowd to pass.
 */
export function waterGuard(after: string, plants: readonly string[]): boolean {
  try {
    if (stockfishRefuses(after)) return false;
    const crowd = sideToMove(after);
    if (kingAttacked(after, crowd) || kingAttacked(after, other(crowd))) return false;
    const legal = legalMoves(after);
    if (!legal.some((m) => !plantStops(m, plants, after))) return false;
    if (mateInOne(after)) return false;
    const his = passTurn(after);
    return !(his && mateInOne(his));
  } catch {
    return false;
  }
}

/** One outcome on its square, if the rules allow it there (the guards aside): the position after, or null. */
function placeOne(pos: string, kind: PlacedKind, sq: string, boss: Side, plants: readonly string[], used: ReadonlySet<string>, tier?: "crowd" | "his"): string | null {
  if (!isSquare(sq) || used.has(sq) || plants.includes(sq)) return null;
  const piece = pieceAt(pos, sq);
  if (kind === "killer") {
    if (!piece || piece.type === "k") return null;
    if (tier && (piece.color === boss) !== (tier === "his")) return null;
    return withoutPiece(pos, sq);
  }
  if (piece) return null;
  if (kind === "plant") return pos;
  if (kind === "p" && (sq[1] === "1" || sq[1] === "8")) return null;
  return withPiece(pos, sq, { color: boss, type: kind });
}

/** A step's options: up to `max` squares for this outcome, in a seeded order, each passing every guard. */
function stepOptions(pos: string, plants: readonly string[], used: ReadonlySet<string>, kind: PlacedKind, boss: Side, order: number, step: number, tier: "crowd" | "his" | undefined, max: number) {
  // (A plain plant goes where the crowd could move now, when it can: a plant on a square nobody can use changes nothing.)
  let squares = SQUARES;
  if (kind === "plant") {
    const paths = new Set(legalMoves(pos).flatMap((m) => blockedSquares(m, pos)));
    const near = SQUARES.filter((sq) => paths.has(sq));
    if (near.length) squares = near;
  }
  // (A killer plant's pawns first, each side's: only a pawn's loss fits the band, unless the battle is already lopsided.)
  const pawnFirst = (sq: string) => (kind === "killer" && pieceAt(pos, sq)?.type !== "p" ? 1 : 0);
  const ranked = squares.map((sq) => ({ sq, k: pawnFirst(sq) + powerRoll(order, "water-square", step, tier ?? "", sq) })).sort((a, b) => a.k - b.k);
  const out: { square: string; fen: string; plants: string[] }[] = [];
  for (const { sq } of ranked) {
    if (out.length >= max) break;
    const after = placeOne(pos, kind, sq, boss, plants, used, tier);
    if (!after) continue;
    const pl = kind === "plant" ? [...plants, sq] : [...plants];
    if (waterGuard(after, pl)) out.push({ square: sq, fen: after, plants: pl });
  }
  return out;
}

/** The squares a move needs free (where it lands and what it passes over). */
function blockedSquares(move: string, fen: string): string[] {
  return SQUARES.filter((sq) => blockedBy(move, sq, fen));
}

/**
 * The side to move's expected score (0-1) at `nodes`, over its moves no plant stops (all of them: its top move; some:
 * those scored), on one engine. Null: no move, or no answer.
 */
async function sideBest(engine: EngineLike, fen: string, plants: readonly string[], nodes: number): Promise<number | null> {
  const all = legalMoves(fen);
  const ok = all.filter((m) => !plantStops(m, plants, fen));
  if (!ok.length) return null;
  if (ok.length < all.length) {
    const scored = engine.scoreMovesAt ? await engine.scoreMovesAt(fen, ok, nodes) : await engine.scoreMoves(fen, ok);
    return scored.length ? Math.max(...scored.map((m) => m.expected)) : null;
  }
  const top = engine.topMovesAt ? await engine.topMovesAt(fen, 1, nodes) : await engine.topMoves(fen, 1);
  return top[0]?.expected ?? null;
}

/** The engines' placement of a watering (waterFrom), with what it gained him and what the search spent. */
export interface WaterPick {
  placed: Placed[];
  fen: string;
  gain: number;
  /** Positions searched (beyond the one before), and the killer plants that ate one of his own pieces. */
  looks: number;
  ownKills: number;
}

/**
 * Where the engines put what came up (`fen`: him to move, before the watering), on this device's engines (the host's
 * online, solo's, the sims'). The outcomes are placed one at a time, the biggest first (a queen, a rook, a bishop, a
 * knight, a killer plant, a pawn, a plain plant), each on whichever of its options (up to waterLooks squares, in a seeded
 * order, each passing every guard: stepOptions) leaves his total gain nearest the step's target: waterTarget less what the
 * outcomes still to come are reckoned to add (NOMINAL), never above the band's top. The queen (the jackpot) goes on the
 * square nearest jackpotMax with no top (a queen up saturates the engine's win chances, so a cap would only ever leave it
 * hanging), and lifts the top for the rest to jackpotMax (or what it gained, if more) and their target to jackpotMax. A killer plant weighs the crowd's pieces first (pawns first), his own only when none of them stays under the
 * top, and then only one that lands within the band. An
 * outcome with no option under the top is dropped (it comes up as nothing). The gain is his evaluation after (the crowd
 * to move) against his before (him to move), in pawns of log-odds (bouncePawnLogit), each over the moves no plant stops.
 * Every step's position is a whole watering that passes the guards, so the last one placed is the answer. The search
 * stops at waterBudget positions (the outcomes left are dropped): ten seeds never stall a phone. Null: no engine, no
 * answer, or he can't pass (in check).
 */
export async function waterFrom(engines: readonly EngineLike[], fen: string, ask: WaterAsk, s: WaterSettings = BOSS_POWERS): Promise<WaterPick | null> {
  const passed = passTurn(fen);
  if (!passed || !engines.length) return null;
  const boss = sideToMove(fen);
  const before = await sideBest(engines[0]!, fen, ask.plants, s.waterNodes);
  if (before === null) return null;
  const gainOf = (crowd: number) => (logit(1 - crowd) - logit(before)) / s.bouncePawnLogit;
  const kinds = ask.kinds.filter((k): k is PlacedKind => k !== "nothing").sort((a, b) => BIG_FIRST.indexOf(a) - BIG_FIRST.indexOf(b));
  let budget = s.waterBudget;
  let pos = passed;
  let plants = [...ask.plants];
  const used = new Set<string>();
  const placed: Placed[] = [];
  let gain: number | null = null;
  let jackpot = false;
  let looks = 0;
  let ownKills = 0;
  for (let i = 0; i < kinds.length && budget > 0; i++) {
    const kind = kinds[i]!;
    const rest = kinds.slice(i + 1).reduce((t, k) => t + NOMINAL[k], 0);
    // (The jackpot: the queen on the square nearest jackpotMax, however far over it (the engine's win chances saturate
    // near 7 from an even position, so a queen that stays on the board often measures over 6: never one left hanging to
    // fit); then the rest under jackpotMax, or under what the queen gained if more.)
    const top = kind === "q" ? Infinity : jackpot ? Math.max(s.jackpotMax, gain ?? 0) : s.waterBand[1];
    const target = kind === "q" ? s.jackpotMax : (jackpot ? s.jackpotMax : s.waterTarget) - rest;
    let chosen: { square: string; fen: string; plants: string[]; gain: number } | null = null;
    for (const tier of kind === "killer" ? (["crowd", "his"] as const) : ([undefined] as const)) {
      if (budget <= 0) break;
      const options = stepOptions(pos, plants, used, kind, boss, ask.order, i, tier, Math.min(s.waterLooks, budget));
      if (!options.length) continue;
      budget -= options.length;
      looks += options.length;
      const scores = await eachOn(engines, options, (e, o) => sideBest(e, o.fen, o.plants, s.waterNodes));
      options.forEach((o, j) => {
        const crowd = scores[j];
        if (crowd === null || crowd === undefined) return;
        const g = gainOf(crowd);
        // (His own piece only when that keeps the band: within it, not just under its top.)
        if (g > top || (tier === "his" && g < s.waterBand[0])) return;
        if (!chosen || Math.abs(g - target) < Math.abs(chosen.gain - target)) chosen = { ...o, gain: g };
      });
      if (chosen) {
        if (tier === "his") ownKills++;
        break;
      }
    }
    if (!chosen) continue;
    const c: { square: string; fen: string; plants: string[]; gain: number } = chosen;
    pos = c.fen;
    plants = c.plants;
    used.add(c.square);
    placed.push({ kind, square: c.square });
    gain = c.gain;
    if (kind === "q") jackpot = true;
  }
  if (gain === null) {
    // (Nothing placed: the pass alone, if it's a position the watering may leave.)
    if (!waterGuard(passed, ask.plants)) return null;
    const crowd = await sideBest(engines[0]!, passed, ask.plants, s.waterNodes);
    if (crowd === null) return null;
    gain = gainOf(crowd);
    looks++;
  }
  return { placed, fen: pos, gain: Math.round(gain * 100) / 100, looks, ownKills };
}

/**
 * The host's answer (and solo's) for a watering: its placement (waterCode), PASS_WAIT when it would lose him real
 * material and it isn't the test switch's or the admins' trigger's (`any`: the pass guard, passLoses), or "" with no
 * engine or no answer (it waits).
 */
export async function waterAnswer(engines: readonly EngineLike[], fen: string, ask: WaterAsk, any = false, s: WaterSettings = BOSS_POWERS): Promise<{ answer: string; pick: WaterPick | null }> {
  const pick = await waterFrom(engines, fen, ask, s).catch(() => null);
  if (!pick) return { answer: "", pick: null };
  if (!any && passLoses(pick.gain, s)) return { answer: PASS_WAIT, pick };
  return { answer: waterCode(pick.placed), pick };
}

/**
 * An answer checked against the rules (the server's check of the host's, and solo's own): every outcome one that was
 * rolled (each at most as often), on a square its rules allow (a plain plant or a grown piece on an empty square no plant
 * holds, a pawn never on a first or last rank; a killer plant on a non-king piece), each square once, every step's
 * position passing the guards (waterGuard), placed in the answer's order. "none": nothing at all, if the pass alone
 * passes them. The position after (the crowd to move) and what was placed, or null: not a placement of this watering.
 */
export function waterCheck(fen: string, ask: Pick<WaterAsk, "kinds" | "plants">, answer: string): { fen: string; placed: Placed[]; plants: string[] } | null {
  const passed = passTurn(fen);
  if (!passed) return null;
  const boss = sideToMove(fen);
  const text = answer.trim();
  if (text === "none") return waterGuard(passed, ask.plants) ? { fen: passed, placed: [], plants: [] } : null;
  if (!text) return null;
  const left = ask.kinds.filter((k) => k !== "nothing") as PlacedKind[];
  let pos = passed;
  let plants = [...ask.plants];
  const used = new Set<string>();
  const placed: Placed[] = [];
  for (const tok of text.split(/\s+/)) {
    const kind = KIND_OF[tok[0] ?? ""];
    const sq = tok.slice(1);
    const at = kind ? left.indexOf(kind) : -1;
    if (!kind || at < 0) return null;
    const after = placeOne(pos, kind, sq, boss, plants, used);
    if (!after) return null;
    left.splice(at, 1);
    if (kind === "plant") plants = [...plants, sq];
    if (!waterGuard(after, plants)) return null;
    pos = after;
    used.add(sq);
    placed.push({ kind, square: sq });
  }
  return { fen: pos, placed, plants: plants.slice(ask.plants.length) };
}

/**
 * What came up where, in the order the screens play it (killer plants, grown pieces, plain plants, nothing), from the
 * seeds' rolls (`kinds`) and the placement: each placed outcome on its square (a killer plant with the piece it ate, from
 * `passed`, the position before it); each roll that wasn't placed comes up as nothing (`dropped`), and every nothing on
 * an empty square of its own (seeded: where its sprout wilts).
 */
export function waterGrowth(passed: string, after: string, kinds: readonly WaterKind[], placed: readonly Placed[], plants: readonly string[], boss: Side, order: number): WaterGrowth[] {
  const left = [...placed];
  const out: WaterGrowth[] = [];
  const nothings: (WaterKind | null)[] = [];
  for (const k of kinds) {
    const at = k === "nothing" ? -1 : left.findIndex((p) => p.kind === k);
    if (at < 0) {
      nothings.push(k === "nothing" ? null : k);
      continue;
    }
    const p = left.splice(at, 1)[0]!;
    if (p.kind === "killer") {
      const piece = pieceAt(passed, p.square)!;
      out.push({ kind: "killer", square: p.square, ate: piece.color === "w" ? piece.type.toUpperCase() : piece.type, ...(piece.color === boss ? { own: true as const } : {}) });
    } else out.push({ kind: p.kind, square: p.square });
  }
  const taken = new Set([...out.map((g) => g.square), ...plants]);
  const free = SQUARES.filter((sq) => !taken.has(sq) && !pieceAt(after, sq))
    .map((sq) => ({ sq, k: powerRoll(order, "water-wilt", sq) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.sq);
  nothings.forEach((d, i) => out.push({ kind: "nothing", square: free[i % Math.max(1, free.length)] ?? "a1", ...(d ? { dropped: d } : {}) }));
  return out.map((g, i) => ({ g, i })).sort((a, b) => PLAY_ORDER.indexOf(a.g.kind) - PLAY_ORDER.indexOf(b.g.kind) || a.i - b.i).map((x) => x.g);
}

// ---------------- His rules ----------------

/** His powers' state (a fresh one when a battle has none yet). */
export const gardenOf = (p: Pick<BossPowerState, "garden"> | null | undefined): GardenState => p?.garden ?? { since: 0, base: 0, plants: [], waterings: 0 };

/** The plain plants on the board now (their squares). */
export const plantSquares = (p: Pick<BossPowerState, "garden"> | null | undefined): string[] => (p?.garden?.plants ?? []).map((x) => x.square);

/** His reaction after a watering: a queen grew, another piece grew, or nothing came up at all (none: plants and kills only). */
export function reactionOf(growth: readonly WaterGrowth[]): "bigCheer" | "cheer" | "shrug" | null {
  if (growth.some((g) => g.kind === "q")) return "bigCheer";
  if (growth.some((g) => g.kind === "p" || g.kind === "n" || g.kind === "b" || g.kind === "r")) return "cheer";
  return growth.every((g) => g.kind === "nothing") ? "shrug" : null;
}

/**
 * The test switch (?power=water): the warning as the second turn begins, the watering at the start of his turn after
 * it, its pass guard off; with ?seeds=N, N seeds at every watering (bossSeedTest).
 */
export const GARDENER: BossRules = {
  id: "gardener",
  // Watering: the meter full as a turn begins, its warning that turn; at the start of his turn, after the crowd's move
  // (gardenerBattle.due). The trigger (`ultNext`, kept): at the start of his next turn, without the warning.
  ultimateOnHisTurn: true,
  ultimate(next, t) {
    if (next.warnAt !== undefined || t.ultNext) return false;
    if (meterFull(next, t) || testSwitch(t, next)) {
      next.warnAt = t.turn;
      t.events.push({ kind: "warn", turn: t.turn });
    }
    return false;
  },
  // Its own turn only: the meter fills again from the crowd's turn after it.
  ultimateRunning: (p, turn) => turn <= (p.ultAt ?? 0),
  // As a crowd turn begins, first: the plain plants whose turns are over are gone.
  wearOff(next, t) {
    const g = next.garden;
    if (g?.plants.some((p) => p.until < t.turn)) next.garden = { ...g, plants: g.plants.filter((p) => p.until >= t.turn) };
  },
  // The opening toss as the first crowd turn begins; the watering and his reaction as the crowd's turn after it begins.
  everyTurn(next, t) {
    const g = next.garden;
    if (!g) return;
    if (t.turn === 1) t.events.push({ kind: "plantMany", turn: t.turn, seeds: g.fixed ?? g.base });
    const w = g.water;
    if (w && w.at + 1 === t.turn) {
      t.events.push({ kind: "water", turn: t.turn, growth: w.growth.map((x) => ({ ...x })) });
      const r = reactionOf(w.growth);
      if (r) t.events.push({ kind: r, turn: t.turn });
    }
  },
  // (Seeds come by the clock: nothing happens as a turn begins.)
  passive() {},
  // Nothing moves onto a plain plant or through it, either side (a toy block's way).
  crowdFilter(allowed, boss, fen) {
    const plants = plantSquares(boss.powers);
    return plants.length ? allowed.filter((m) => !plantStops(m, plants, fen)) : allowed;
  },
  bossStops(boss) {
    const plants = plantSquares(boss.powers);
    return plants.length ? (m, fen) => plantStops(m, plants, fen) : null;
  },
  stopReason: (boss, fen, m) => (plantStops(m, (boss.powers?.garden?.plants ?? []).map((p) => p.square), fen) ? "plant" : null),
  // A turn with a plant on the board, and the turn after a watering (the board changed), don't count for fair play.
  powerTurn: (boss) => {
    const g = boss.powers?.garden;
    return !!g && (g.plants.length > 0 || g.water?.at === boss.crowdMoves);
  },
  opening: {
    fromStart: true,
    // The meter from the battle's start: seedsAtStart waiting now (the test switch: its set count at every watering).
    setUp(b) {
      const fixed = b.settings.bossSeedTest;
      return { garden: { since: b.now(), base: BOSS_POWERS.seedsAtStart, plants: [], waterings: 0, ...(fixed !== undefined ? { fixed } : {}) } };
    },
  },
  view: (p) => ({ garden: gardenView(p) }),
};

/**
 * His fields for the screens (NetBossPowers' `garden`): the meter's two numbers (seedsAt, with the screens' clock: the
 * server's online, the page's visible time solo) and the test switch's set count; the plain plants with the crowd turns
 * each still blocks (`left`: 3 the turn it grew, then 2, then 1: its art's green, fall and drop); his last watering;
 * how many this battle.
 */
export interface GardenView {
  since: number;
  base: number;
  fixed: number | null;
  plants: (GardenPlant & { left: number })[];
  water: WaterResult | null;
  waterings: number;
}

export function gardenView(p: BossPowerState): GardenView | null {
  const g = p.garden;
  if (!g) return null;
  return {
    since: g.since,
    base: g.base,
    fixed: g.fixed ?? null,
    plants: g.plants.map((x) => ({ ...x, left: Math.max(0, x.until - p.turn + 1) })),
    water: g.water ? { ...g.water, rolled: [...g.water.rolled], growth: g.water.growth.map((x) => ({ ...x })) } : null,
    waterings: g.waterings,
  };
}

// ---------------- His part in the match runner ----------------

const setGarden = (b: Battle, change: (g: GardenState, p: BossPowerState) => GardenState): void => {
  const boss = b.state.boss!;
  const p = boss.powers!;
  b.state = { ...b.state, boss: { ...boss, powers: { ...p, garden: change(gardenOf(p), p) } } };
};
const boardOf = (b: Battle) => b.boards.get(b.state.boards[0]!)!;

export const gardenerBattle = {
  /**
   * His watering is due: the start of his turn (the crowd has just moved) from the turn the meter warned, or after the
   * admins' trigger; not already waiting after this crowd move (the pass guard, no answer); and he can pass (not in check).
   */
  due(b: Battle): boolean {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "gardener" || boss.result || !b.bossToMove() || b.finalGameOver()) return false;
    if (p.ultAt !== undefined) return false;
    if (!p.ultNext && !(p.warnAt !== undefined && p.warnAt <= boss.crowdMoves)) return false;
    if (gardenOf(p).wait === boss.crowdMoves) return false;
    return passTurn(boardOf(b).fen) !== null;
  },

  /**
   * The watering's roll for his turn now, taken the first time it's asked for and kept (the server's request, the host's
   * answer and the check agree on it): the clock then, the seeds waiting then (seedsAt; the test switch's set count), and
   * each one's outcome (rollSeed). Null when none is due.
   */
  roll(b: Battle): NonNullable<GardenState["roll"]> | null {
    if (!gardenerBattle.due(b)) return null;
    const boss = b.state.boss!;
    const g = gardenOf(boss.powers);
    if (g.roll?.at === boss.crowdMoves) return g.roll;
    const clock = b.now();
    const seeds = seedsAt(g, clock).count;
    const kinds = Array.from({ length: seeds }, (_, i) => rollSeed(boss.powers!.seed, g.waterings, i));
    const roll = { at: boss.crowdMoves, clock, seeds, kinds };
    setGarden(b, (x) => ({ ...x, roll }));
    return roll;
  },

  /** What the host's engines need to place it (the boss request's `water`), or null when none is due. */
  ask(b: Battle): WaterAsk | null {
    const roll = gardenerBattle.roll(b);
    if (!roll) return null;
    const p = b.state.boss!.powers!;
    return { kinds: [...roll.kinds], plants: plantSquares(p), order: Math.floor(powerRoll(p.seed, "water-order", gardenOf(p).waterings) * 2 ** 32) };
  },

  /** It comes even when it would lose him real material: the test switch's first watering, or the admins' trigger. */
  any(b: Battle): boolean {
    const p = b.state.boss?.powers;
    return !!p && (!!p.ultNext || (b.settings.bossPowerTest === "water" && !gardenOf(p).waterings));
  },

  /** The watering from this device's engines (solo, the sims): waterAnswer, then apply. */
  async play(b: Battle, engines: readonly EngineLike[]): Promise<WaterResult | null> {
    const ask = gardenerBattle.ask(b);
    if (!ask) return null;
    const { answer, pick } = await waterAnswer(engines, boardOf(b).fen, ask, gardenerBattle.any(b));
    return gardenerBattle.apply(b, answer, pick?.gain ?? null);
  },

  /**
   * The watering (online the host's answer): checked (waterCheck); PASS_WAIT, "", or anything that isn't a placement of
   * this roll: none now (it waits for his next turn, the warning and the trigger staying, a new roll then), and he plays
   * his move. Else his whole turn: the position (a base at its ply), the turn passed to the crowd, the plain plants on the
   * board for plantTurns crowd turns, the meter emptied from the moment the count was taken, the rage meter spent, and the
   * crowd's turn set up as after his move (its moments play as it begins). Returns the watering; null when none was due,
   * or it waits.
   */
  apply(b: Battle, answer: string | null, gain: number | null = null): WaterResult | null {
    const roll = gardenerBattle.roll(b);
    const ask = gardenerBattle.ask(b);
    if (!roll || !ask) return null;
    const boss = b.state.boss!;
    const checked = answer && answer !== PASS_WAIT ? waterCheck(boardOf(b).fen, ask, answer) : null;
    if (!checked) {
      setGarden(b, (g) => ({ ...g, roll: null, wait: boss.crowdMoves }));
      return null;
    }
    const board = boardOf(b);
    const passed = passTurn(board.fen)!;
    const his = other(boss.crowdSide);
    const growth = waterGrowth(passed, checked.fen, roll.kinds, checked.placed, [...ask.plants, ...checked.plants], his, ask.order);
    const result: WaterResult = { at: boss.crowdMoves, seeds: roll.seeds, rolled: [...roll.kinds], growth, gain, ...(checked.placed.some((x) => x.kind === "q") ? { jackpot: true as const } : {}) };
    const id = b.state.boards[0]!;
    const ply = board.history.length;
    b.boards.set(id, { ...board, fen: checked.fen, expected: 1 - board.expected, lastMove: null, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen: checked.fen }] });
    b.bossLast = null;
    const plants: GardenPlant[] = checked.plants.map((square) => ({ square, at: boss.crowdMoves, until: boss.crowdMoves + BOSS_POWERS.plantTurns }));
    const { ultNext: _trigger, ...p } = boss.powers!;
    const g = gardenOf(p);
    const { roll: _roll, wait: _wait, ...rest } = g;
    b.state = { ...b.state, boss: { ...boss, powers: unleashed({ ...p, ultAt: boss.crowdMoves, garden: { ...rest, since: roll.clock, base: 0, plants: [...g.plants, ...plants], water: result, waterings: g.waterings + 1 } }) } };
    b.bossPassed();
    return result;
  },
};

/** His events for a turn (the sims and tests read them). */
export const gardenerEvents = (events: readonly PowerEvent[]) => events.filter((e) => e.kind === "plantMany" || e.kind === "plant" || e.kind === "water" || e.kind === "cheer" || e.kind === "bigCheer" || e.kind === "shrug");
