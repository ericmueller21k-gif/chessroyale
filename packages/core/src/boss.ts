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
export type PowerId = "freeze" | "blizzard" | "pie" | "funhouse" | "sparkler" | "candle" | "dark" | "lightsout" | "blocks" | "bounce" | "cuts" | "boardsaw";
/** Every power, for the test switch (?power=<id>: a boss's ultimate comes early; its passive as usual). */
export const POWER_IDS: readonly PowerId[] = ["freeze", "blizzard", "pie", "funhouse", "sparkler", "candle", "dark", "lightsout", "blocks", "bounce", "cuts", "boardsaw"];

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
  { id: "grex", name: "Jefferson", icon: "🦖", kit: "Jefferson", offset: -100, powers: { passive: "sparkler", ultimate: "candle" } },
  { id: "hollow", name: "Hollow", icon: "🌑", kit: "Hollow", offset: -100, powers: { passive: "dark", ultimate: "lightsout" } },
  // Big Boy eats one of the crowd's centre pawns before move 1 (his snack), so he plays further under the lobby's
  // strength than the others (DECISIONS.md: "Big Boy, built": the boss sim's numbers).
  { id: "bigboy", name: "Big Boy", icon: "🍭", kit: "Big Boy", offset: -250, powers: { passive: "blocks", ultimate: "bounce" } },
  // Sawyer saws his first pawn in two after his first move (the split pawn): a pawn's head start, so he plays further
  // under the lobby's strength too (DECISIONS.md: "Sawyer, built": the boss sim's numbers).
  { id: "sawyer", name: "Sawyer", icon: "🪚", kit: "Sawyer", offset: -250, powers: { passive: "cuts", ultimate: "boardsaw" } },
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
 * Other names a test link may use for a boss (?boss=jefferson), each to its roster id. A boss renamed on screen keeps
 * its id everywhere else (Jefferson, Oct 10: he was G-REX, and his id stays "grex").
 */
export const BOSS_ALIASES: Readonly<Record<string, string>> = { jefferson: "grex" };
/** A test link's ?boss= as a roster id (an alias becomes its boss's id); anything else as it is. */
export const bossIdFromLink = (q: string | null | undefined): string | null => (q ? (BOSS_ALIASES[q.toLowerCase()] ?? q) : null);

/**
 * Which boss a match meets: `wanted` if it's playable, else a random playable one (from `roll`, 0-1), not `avoid`
 * when there's another to meet (no repeats: solo avoids your last boss, online the one most of the lobby met last).
 */
export function chooseBoss(roll: number, wanted?: string | null, avoid?: string | null, roster: readonly BossDef[] = BOSS_ROSTER, unfinished = false): BossDef {
  const pick = roster.find((b) => b.id === wanted);
  // (Testing, solo only: a boss whose powers are built but whose art isn't yet, with placeholders.)
  if (unfinished && pick?.powers) return pick;
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
  /**
   * The Roman candle: the crowd turn he fired, the shots still to fall, the next wave of the schedule to pick
   * (BOSS_POWERS.candleWaves), and the waves picked and on their way (their squares show a growing shadow).
   */
  candle?: { at: number; left: number; next?: number; waves?: CandleWave[] } | null;
  /** The first crowd turn a crowd piece stepped onto a burning tile (the God King's warning, once a match). */
  stepped?: number;
  /**
   * Hollow's dark: the squares covered (the dark belongs to the square, not the piece), each with the crowd turn it fell
   * as and the last crowd turn it covers; and the squares whose dark cleared as this turn began.
   */
  dark?: DarkSquare[];
  cleared?: string[];
  /** Hollow's bulbs still lit as this turn began: his moves until he covers the next square (the last goes out as he does). */
  bulbs?: number;
  /** Hollow always plays Black: the usual side pick would have made the crowd Black, so he claimed the dark side before move 1. */
  claimed?: boolean;
  /**
   * Hollow's dark: wrong move attempts into the dark this round (the match's round number), by player. Each costs
   * darkTryCost off the turn's score; the darkTries-th ends that player's turn as a missed move. Never sent to screens.
   */
  tries?: { round: number; by: Record<string, number> };
  /** Hollow's Lights out (his ultimate, at the start of his turn): the test once it has begun. Never sent to screens. */
  lightsOut?: LightsOutTest | null;
  /** Big Boy's snack: the crowd's centre pawn he ate before move 1 (its square). */
  snack?: { square: string };
  /** Big Boy's toy block: its square (empty; nothing may move onto it or slide through it), the crowd turn it landed, its last. */
  block?: { square: string; at: number; until: number } | null;
  /** Big Boy's Big Bounce (his ultimate, at the start of his turn, after the crowd's move): what it did, once it has. */
  bounce?: BounceResult | null;
  /** Sawyer's split pawn, once his first move is played (unset until then: his first move must be a pawn move). */
  split?: SplitPawn;
  /** Sawyer's saw cut: the edge between two neighbouring squares nothing may move straight across, its first and last crowd turn. */
  cut?: SawCut | null;
  /** Sawyer's board saw (his ultimate): no move may cross between the d and e files from crowd turn `at` through `until`. */
  boardSaw?: { at: number; until: number } | null;
  /** What happened as this turn began, for the screens' moments (the same for everyone). */
  events: PowerEvent[];
}

/**
 * The Big Bounce, once it has happened: after which crowd move (crowdMoves), the position before it (the crowd's move
 * just played, him to move), the crowd's pieces it moved (each from its square to an empty one; none: nothing moved),
 * where his three bounces landed (each a 2x2 block, by its lower-left square from White's side), and the crowd's loss
 * the engine put on it (in pawns; null when nothing moved, or not known here: online the host's engine picked it).
 */
export interface BounceResult {
  at: number;
  before: string;
  moves: { from: string; to: string; piece: string }[];
  spots: string[];
  loss: number | null;
}

/**
 * Sawyer's split pawn: after his first move (crowd turn `turn` begins with it), the pawn he moved (`pawn`, where it
 * stood after the move; null: his first move wasn't a pawn's) sawn in two (or later: `waiting`), the new half on `square` beside it (null: neither side was free, no split). The
 * two halves are tracked through the game (`halves`: each one's square now and which side of the cut it was, "a" the
 * half on the a-file side, "h" the other); a half that's taken or promotes is gone from the list.
 */
export interface SplitPawn {
  turn: number;
  pawn: string | null;
  square: string | null;
  halves: { square: string; side: "a" | "h" }[];
  /**
   * His first move was a pawn move but there was no room yet for another pawn of his (he had all 8, or the board 32
   * pieces: the engine plays only positions with up to 8 pawns a side and 32 pieces): the split comes after his first
   * pawn move once there is (then `turn`, `pawn` and `square` are that one's).
   */
  waiting?: true;
}

/**
 * A saw cut on the edge between two orthogonally neighbouring squares (`a` before `b`: the lower file, or the lower rank
 * on one file), from crowd turn `at` through `until` (sawTurns in all).
 */
export interface SawCut {
  a: string;
  b: string;
  at: number;
  until: number;
}

/** One of Hollow's dark squares: the crowd turn it fell as, and the last crowd turn it covers (darkTurns in all). */
export interface DarkSquare {
  square: string;
  at: number;
  until: number;
}

/**
 * A round of Lights out: the pieces he names (piece letters; a type named twice needs both squares), the squares that
 * answer it (every square holding a named type of his), and the time to find them.
 */
/**
 * One piece he names in Lights out: a type ("Find my queen."; `several`: he has more than one of it, any counts: "Find
 * one of my rooks."), or a pawn by its file ("Find my pawn on the c-file."; `several`: one of those on it, a last
 * resort).
 */
export interface LightsOutTarget {
  type: string;
  file?: string;
  several?: boolean;
}

/** A Lights out round: the piece letters he names (one per target), what exactly, the squares that answer, its time. */
export interface LightsOutRound {
  pieces: string[];
  targets?: LightsOutTarget[];
  answers: string[];
  ms: number;
}

/**
 * Hollow's Lights out: after which crowd move it came (crowdMoves), its rounds, and once over, the pieces each player
 * missed (people from their taps, bots from the seed).
 */
export interface LightsOutTest {
  at: number;
  rounds: LightsOutRound[];
  missed?: Record<string, number>;
  /** Once over: the pieces found by everyone still in, and the pieces asked of them (the crowd's find rate). */
  found?: number;
  asked?: number;
  /**
   * Under lightsOutHold: his extra move after his own, before the crowd's turn ("due"), then "played", or "skipped"
   * when no quiet move within lightsOutExtraGain was there. At or above it: none.
   */
  extra?: "due" | "played" | "skipped";
}

/**
 * A wave of the Roman candle's fireballs on its way: the crowd turn it lands (as that turn begins), how many shots it
 * is, and the squares they'll hit, picked candleAhead turns before (never the crowd king's square then; if he stands
 * on one as it lands, that fireball fizzles).
 */
export interface CandleWave {
  lands: number;
  shots: number;
  squares: string[];
}

/** A fire tile: its square and the crowd turn it landed on (its stage is the turn now − lit + 1). */
export interface FireTile {
  square: string;
  lit: number;
}

/** After a crowd move: a piece the fire destroyed (`piece` its kind), a tile that fizzled under the king, or one that just burnt out (neither). */
export interface BurnEvent {
  turn: number;
  square: string;
  piece?: string;
  fizzled?: boolean;
}

/**
 * `extra`: Hollow's extra move after a failed Lights out (played after his own, before the crowd's turn). `block`: Big
 * Boy's toy block landing; `bounce`: his Big Bounce (at the start of his turn, after the crowd's move). `split`:
 * Sawyer saws the pawn of his first move in two; `cut`: a saw cut on an edge; `boardsaw`: his board saw.
 */
export type PowerEventKind = "freeze" | "pie" | "warn" | "blizzard" | "funhouse" | "spark" | "candle" | "fireball" | "dark" | "extra" | "block" | "bounce" | "split" | "cut" | "boardsaw";
export interface PowerEvent {
  kind: PowerEventKind;
  turn: number;
  /** The square it hit (a freeze, a pie, a sparkler). */
  square?: string;
  /** The squares a wave of fireballs hit. */
  squares?: string[];
  /** Of those, the ones that fizzled as they landed (the crowd's king stood there): no fire tile. */
  fizzled?: string[];
  /** Hollow's first cover of the dark (the square of the piece he just moved, with his first-cover line). */
  first?: true;
}

/** The settings behind the God King's Last Stand. */
export type LastStandSettings = Pick<
  Settings,
  "lastStandLoss" | "lastStandChargedExtra" | "lastStandLossFloor" | "lastStandDecayMoves" | "lastStandFrom" | "lastStandShareBelow" | "lastStandShare"
>;

/**
 * The God King's Last Stand: how big a mistake it takes (points of expected score given away against the best
 * move), with the crowd's best move worth `best` (its expected score, 0-1), after `crowdMoves` crowd moves without
 * one. The plain bar starts at lastStandLoss, a little higher while he still has charges, and falls in a straight
 * line to lastStandLossFloor over lastStandDecayMoves crowd moves, so a long game without a disaster still sees him
 * step in for a smaller one. While the best move is worth under lastStandShareBelow, the bar is a share
 * (lastStandShare) of the chances left, when that's lower: from 25%, a move that throws away half of them (12.5
 * points) is a disaster, though no move there can give away the plain bar's 35 (Eric, Oct 10).
 */
export function lastStandBar(best: number, crowdMoves: number, charges: number, s: LastStandSettings): number {
  const decay = Math.max(0, 1 - crowdMoves / Math.max(1, s.lastStandDecayMoves));
  const bar = s.lastStandLossFloor + (s.lastStandLoss - s.lastStandLossFloor) * decay + (charges > 0 ? s.lastStandChargedExtra : 0);
  const left = best * 100;
  return left < s.lastStandShareBelow ? Math.min(bar, s.lastStandShare * left) : bar;
}

/**
 * Whether the crowd's played move calls for the Last Stand: it gave away at least the bar (`loss`, in points; see
 * lastStandBar), and the position wasn't already lost (the best move was worth at least lastStandFrom, `best`
 * being the mover's expected score after it, 0-1). The engine's judgement decides, not the material: a sacrifice it
 * likes gives nothing away. Once per game: the caller checks he hasn't fallen already.
 */
export function lastStandDue(loss: number, best: number, crowdMoves: number, charges: number, s: LastStandSettings): boolean {
  return best * 100 >= s.lastStandFrom && loss >= lastStandBar(best, crowdMoves, charges, s);
}
