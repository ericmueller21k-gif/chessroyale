import { PRIOR_RATING } from "./rating.ts";
import type { Settings } from "./settings.ts";

/**
 * Boss battle: the last 10 team up against Stockfish. The boss's strength comes
 * from the crowd's own ratings, weighted towards the best players (it should
 * feel like a real fight to them, and like a wall to the weakest), plus an
 * offset because a crowd voting together plays better than its average member.
 */
export function bossElo(ratings: readonly (number | null)[], s: Pick<Settings, "bossEloOffset" | "bossEloRange">): number {
  const rs = ratings.map((r) => r ?? PRIOR_RATING).sort((a, b) => b - a);
  if (!rs.length) return s.bossEloRange[0];
  // The best gets weight n, the next n-1, ... the weakest 1.
  let sum = 0;
  let weights = 0;
  rs.forEach((r, i) => {
    const w = rs.length - i;
    sum += w * r;
    weights += w;
  });
  const elo = Math.round(sum / weights + s.bossEloOffset);
  return Math.max(s.bossEloRange[0], Math.min(s.bossEloRange[1], elo));
}

/**
 * Stockfish can't play weaker than UCI_Elo 1320, and even a boss set a little
 * below a weaker crowd's rating beat it nearly every time in calibration (see
 * reports/boss-calibration.md). Below bossStumbleBelow the
 * boss "slips" now and then instead: a small deliberate inaccuracy from its top
 * moves (bossSlipLoss), never a blunder (it used to be any random move, which
 * threw away queens).
 */
export function bossStumbleChance(elo: number, s: Pick<Settings, "bossStumbleBelow" | "bossStumbleMax">): number {
  return Math.max(0, Math.min(s.bossStumbleMax, (s.bossStumbleBelow - elo) / 1000));
}

/**
 * Where the boss battle starts: a position from the game just played, with
 * White (the crowd) to move, between moves 5 and 12. It should be roughly even
 * and never better for the boss: White's expected score 0.50-0.60 if possible
 * (the one nearest move 8), else the closest to even that still favours White,
 * else the starting position. `evals[k]` is the side to move's expected score
 * after k plies.
 */
export function bossStartPly(evals: readonly number[], plies: number): number {
  const candidates = [];
  for (let k = 10; k <= Math.min(24, plies); k += 2) if (evals[k] !== undefined) candidates.push({ k, white: evals[k]! });
  const even = candidates.filter((c) => c.white >= 0.5 && c.white <= 0.6).sort((a, b) => Math.abs(a.k - 16) - Math.abs(b.k - 16));
  if (even.length) return even[0]!.k;
  const ahead = candidates.filter((c) => c.white > 0.6).sort((a, b) => a.white - b.white);
  if (ahead.length) return ahead[0]!.k;
  return 0;
}

/**
 * Boss raid: the strengths a boss comes in (Stockfish UCI_Elo), one per boss: ten
 * of them, up to 3190, the strongest Stockfish plays with its strength limited
 * (beyond that is full strength, deliberately not a tier).
 */
export const BOSS_TIERS: readonly number[] = [1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3190];

/** Boss raid: the weakest boss that's stronger than the lobby's average rating (the strongest if none is). */
export function raidBossElo(ratings: readonly (number | null)[]): number {
  const rs = ratings.map((r) => r ?? PRIOR_RATING);
  const avg = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : PRIOR_RATING;
  return BOSS_TIERS.find((t) => t > avg) ?? BOSS_TIERS[BOSS_TIERS.length - 1]!;
}

export interface BossInfo {
  name: string;
  icon: string;
  /** 1 to 5 skulls (two bosses to a skull): how scary it is, without giving away the number. */
  threat: number;
}

/** The boss powers there are: a passive (or opening) and an ultimate per boss. */
export type PowerId = "freeze" | "blizzard" | "pie" | "funhouse" | "sparkler" | "candle";

/**
 * A raid boss: the base template every boss fills in. Its powers' rules (which moves are allowed, what happens after
 * a move, what each player sees, whether a turn is scored or counts for fair play) live in the chess package's
 * boss-powers.ts, by power id; its art, lines and sounds in the app's character kit, by `kit`.
 */
export interface BossDef {
  id: string;
  name: string;
  /** Where a screen has no room for its drawing. */
  icon: string;
  /** Its character kit (art, moments, lines, sounds: the app's BOSS_KITS key) once complete; null until it's drawn. */
  kit: string | null;
  /** Elo on top of the lobby's strength: a boss with nastier powers plays a little weaker underneath. */
  offset: number;
  /** Its passive and its ultimate; null until they're built. */
  powers: { passive: PowerId; ultimate: PowerId } | null;
}

/**
 * Every boss, complete or not. Only a playable one (isPlayable: a complete character and powers) is ever chosen,
 * in every boss mode: the raid, the Crowd's boss final and solo's boss menu. The rest are placeholders waiting for
 * their art and powers.
 */
export const BOSS_ROSTER: readonly BossDef[] = [
  { id: "gingerbread", name: "Ginger", icon: "🍪", kit: "Ginger", offset: -100, powers: { passive: "freeze", ultimate: "blizzard" } },
  { id: "clown", name: "Boingo the Clown", icon: "🤡", kit: "Boingo the Clown", offset: -100, powers: { passive: "pie", ultimate: "funhouse" } },
  // (His character kit, "G-REX", is the characters delegate's: set here once it's complete.)
  { id: "grex", name: "G-REX", icon: "🦖", kit: null, offset: -100, powers: { passive: "sparkler", ultimate: "candle" } },
  { id: "golem", name: "The Pawn Golem", icon: "🗿", kit: null, offset: 0, powers: null },
  { id: "archer", name: "The Bone Archer", icon: "💀", kit: null, offset: 0, powers: null },
  { id: "knight", name: "The Black Knight", icon: "🐴", kit: null, offset: 0, powers: null },
  { id: "witch", name: "The Storm Witch", icon: "🧙", kit: null, offset: 0, powers: null },
  { id: "tyrant", name: "The Tower Tyrant", icon: "🏰", kit: null, offset: 0, powers: null },
  { id: "dragon", name: "The Frost Dragon", icon: "🐉", kit: null, offset: 0, powers: null },
  { id: "wraith", name: "The Grandmaster Wraith", icon: "👻", kit: null, offset: 0, powers: null },
  { id: "demon", name: "The Demon Lord", icon: "😈", kit: null, offset: 0, powers: null },
  { id: "eternal", name: "The Engine Eternal", icon: "👹", kit: null, offset: 0, powers: null },
];

/** The one rule for choosing a boss: it has a complete character and its powers. */
export const isPlayable = (b: BossDef | null | undefined): b is BossDef => !!b && b.kit !== null && b.powers !== null;

/** The bosses that can be met, in roster order. */
export function playableBosses(roster: readonly BossDef[] = BOSS_ROSTER): BossDef[] {
  return roster.filter(isPlayable);
}

export const bossDef = (id: string | null | undefined): BossDef | null => (id ? (BOSS_ROSTER.find((b) => b.id === id) ?? null) : null);

/**
 * Which boss a match meets: `wanted` if it's playable, else a random playable one (from `roll`, 0-1), not `avoid`
 * when there's another to meet (no repeats: solo avoids your last boss, online the one most of the lobby met last).
 */
export function chooseBoss(roll: number, wanted?: string | null, avoid?: string | null, roster: readonly BossDef[] = BOSS_ROSTER): BossDef {
  const pick = roster.find((b) => b.id === wanted);
  if (isPlayable(pick)) return pick;
  const all = playableBosses(roster);
  if (!all.length) throw new Error("No playable boss");
  const pool = all.length > 1 ? all.filter((b) => b.id !== avoid) : all;
  return pool[Math.min(pool.length - 1, Math.floor(Math.max(0, roll) * pool.length))]!;
}

/** The strongest the engine plays with its strength limited (Stockfish's UCI_Elo ceiling). */
export const ENGINE_MAX_ELO = 3190;

/**
 * The boss's strength: the lobby's (the usual calculation) plus its own offset, plus solo's difficulty (`extra`:
 * Easy −300 to Hardest +500), within what Stockfish plays.
 */
export function bossStrength(base: number, def: Pick<BossDef, "offset"> | null, extra = 0): number {
  return Math.max(800, Math.min(ENGINE_MAX_ELO, Math.round(base + (def?.offset ?? 0) + extra)));
}

/** Threat thresholds: two to a skull, 1 to 5 (the old ten tiers' boundaries). */
const THREAT_FROM = [0, 1500, 1700, 1900, 2100, 2300, 2500, 2700, 2900, 3100];

/** How scary a strength is, 1 to 5 skulls (the Elo itself stays secret). */
export function bossThreat(elo: number): number {
  let i = 0;
  while (i + 1 < THREAT_FROM.length && elo >= THREAT_FROM[i + 1]!) i++;
  return Math.floor(i / 2) + 1;
}

/** A boss's name, look and threat level: `id`'s, at strength `elo`. */
export function bossInfo(elo: number, id?: string | null): BossInfo {
  const def = bossDef(id);
  if (def) return { name: def.name, icon: def.icon, threat: bossThreat(elo) };
  // (Older records with no boss: the tier's old placeholder.)
  let i = 0;
  while (i + 1 < THREAT_FROM.length && elo >= THREAT_FROM[i + 1]!) i++;
  const b = TIER_NAMES[i]!;
  return { name: b.name, icon: b.icon, threat: bossThreat(elo) };
}

/** The ten tiers' old names (a record from before bosses had identities shows these). */
const TIER_NAMES = ["golem", "clown", "archer", "knight", "witch", "tyrant", "dragon", "wraith", "demon", "eternal"].map((id) => bossDef(id)!);

/**
 * A boss's powers as they stand in a battle (the rules are in the chess package's boss-powers.ts). Crowd turns are
 * numbered from 1 (the crowd's first move of the battle): turn = crowdMoves + 1.
 */
export interface BossPowerState {
  /** Every choice a power makes comes from this and the position (the same on the server and in every replay). */
  seed: number;
  /** The crowd turn these are set for. */
  turn: number;
  /** The rage meter: the boss's material when the battle began, and the most of it it has lost since. */
  material: number;
  lost: number;
  /** The ultimate: warned as this crowd turn began, unleashed at this one. Once per match. */
  warnAt?: number;
  ultAt?: number;
  /** When the passive fires next (a crowd turn). */
  nextPassive: number;
  /** Freeze: the iced piece (its square and kind), through this crowd turn. */
  frozen?: { square: string; piece: string; until: number } | null;
  /** Pie: the pied square (nobody may move onto it), through this crowd turn. */
  pie?: { square: string; until: number } | null;
  /** The funhouse: the move the boss played for the crowd, as which crowd turn. */
  funhouse?: { turn: number; move: string; san: string } | null;
  /** After the funhouse, the crowd sees the board flipped through this crowd turn. */
  flipUntil?: number;
  /**
   * The meter's charge from time and the judged eval (rage points, never coming down); the boss's material lost adds
   * to it (BOSS_POWERS.ragePerMaterial a point). `judged`: the crowd's expected score after its last move, as judged.
   */
  charge?: number;
  judged?: number;
  /** The test trigger (an admin): the ultimate comes as the next crowd turn begins, without the warning. */
  ultNext?: boolean;
  /**
   * G-REX's fire tiles, each with the crowd turn it landed (stage 1 that turn, ablaze fireStages - 1 turns later;
   * after the crowd's move on that turn, a crowd piece still on it burns, the king never).
   */
  fire?: FireTile[];
  /** The crowd turn whose move the last fire went out after (the next sparkler waits fireGap turns from it). */
  fireOut?: number;
  /** What the fire did after the crowd's last move: the pieces it destroyed and the tiles that fizzled (a king on them). */
  burnt?: BurnEvent[];
  /** The Roman candle: the crowd turn he fired, and the shots still to fall. */
  candle?: { at: number; left: number } | null;
  /** The first crowd turn a crowd piece stepped onto a burning tile (the God King's warning, once a match). */
  stepped?: number;
  /** What happened as this turn began, for the screens' moments (the same for everyone). */
  events: PowerEvent[];
}

/** A fire tile: its square and the crowd turn it landed on (its stage is the turn now − lit + 1). */
export interface FireTile {
  square: string;
  lit: number;
}

/** After a crowd move: a piece the fire destroyed (`piece` its kind), or a tile that fizzled under the king. */
export interface BurnEvent {
  turn: number;
  square: string;
  piece?: string;
  fizzled?: boolean;
}

export type PowerEventKind = "freeze" | "pie" | "warn" | "blizzard" | "funhouse" | "spark" | "candle" | "fireball";
export interface PowerEvent {
  kind: PowerEventKind;
  turn: number;
  /** The square it hit (a freeze, a pie, a sparkler). */
  square?: string;
  /** The squares a wave of fireballs hit. */
  squares?: string[];
}

/** The settings behind the God King's Last Stand. */
export type LastStandSettings = Pick<Settings, "lastStandLoss" | "lastStandChargedExtra" | "lastStandLossFloor" | "lastStandDecayMoves" | "lastStandFrom">;

/**
 * The God King's Last Stand: how big a mistake it takes (points of expected score given away against the best
 * move) after `crowdMoves` crowd moves without one. It starts at lastStandLoss, a little higher while he still has
 * charges, and falls in a straight line to lastStandLossFloor over lastStandDecayMoves crowd moves, so a long game
 * without a disaster still sees him step in for a smaller one.
 */
export function lastStandBar(crowdMoves: number, charges: number, s: LastStandSettings): number {
  const decay = Math.max(0, 1 - crowdMoves / Math.max(1, s.lastStandDecayMoves));
  const bar = s.lastStandLossFloor + (s.lastStandLoss - s.lastStandLossFloor) * decay;
  return bar + (charges > 0 ? s.lastStandChargedExtra : 0);
}

/**
 * Whether the crowd's played move calls for the Last Stand: it gave away at least the bar (`loss`, in points),
 * and the position wasn't already lost (the best move was worth at least lastStandFrom, `best` being the mover's
 * expected score after it, 0-1). Once per game: the caller checks he hasn't fallen already.
 */
export function lastStandDue(loss: number, best: number, crowdMoves: number, charges: number, s: LastStandSettings): boolean {
  return best * 100 >= s.lastStandFrom && loss >= lastStandBar(crowdMoves, charges, s);
}
