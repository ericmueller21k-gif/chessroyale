import { PRIOR_RATING } from "./rating.ts";
import { BOSS_BRAIN, type BossBrain, type BossBrainSettings, type Settings } from "./settings.ts";

/**
 * Boss battle: the Crowd's finalists team up against a boss. Its strength comes
 * from the crowd's own ratings, weighted toward the best players (it should
 * feel like a real fight to them, and like a wall to the weakest), plus an
 * offset because a crowd voting together plays better than its average member.
 * (A boss with a fixed strength, the Hidden Boss, who is always the Crowd's boss
 * since Oct 14, ignores it: bossStrength.)
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
 * (the one nearest move 8), else the closest to even that still favors White,
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
export type PowerId = "freeze" | "blizzard" | "pie" | "funhouse" | "sparkler" | "candle" | "dark" | "lightsout" | "blocks" | "bounce" | "cuts" | "boardsaw" | "drag" | "showdown" | "nohelp" | "bullet" | "tusks" | "slam" | "leapfrog" | "carrotpatch" | "camouflage" | "repaint" | "moonbeam" | "fullmoon";
/**
 * Every power, for the test switch (?power=<id>: a boss's ultimate comes early; its passive as usual, but for Wrangler's
 * drag and Alfil's Tusks, which come sooner and more often, the hopper's Leapfrog, whose battle starts with a hop due
 * on his first turn, and his Carrot Patch, which comes at the start of his first turn: their files). Smudgy's Camouflage
 * comes from his first move whatever the switch says; ?power=repaint warns as the second turn begins. Moo & Moon's
 * ?power=moonbeam brings a beam after every one of his moves (not every third), ?power=fullmoon warns as the second turn
 * begins (the Full Moon at the start of his turn after it).
 */
export const POWER_IDS: readonly PowerId[] = ["freeze", "blizzard", "pie", "funhouse", "sparkler", "candle", "dark", "lightsout", "blocks", "bounce", "cuts", "boardsaw", "drag", "showdown", "nohelp", "bullet", "tusks", "slam", "leapfrog", "carrotpatch", "camouflage", "repaint", "moonbeam", "fullmoon"];

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
  /**
   * Hidden from players (the Hidden Boss, Eric, Oct 14: "for testing available in boss mode with bots for now"): an
   * admin meets it in Boss alone, picked from the boss menu (`adminPlayable`). Never chosen at random, never in a raid,
   * never in a player's boss menu. The one exception is `crowdFinal`.
   */
  adminOnly?: true;
  /**
   * The Crowd's boss final always meets this boss, for everyone (Eric, Oct 14: "that mode is always just versus [him],
   * like the top four always battle versus [him]"): `crowdFinalBoss`. Hidden from players everywhere else if `adminOnly`.
   */
  crowdFinal?: true;
  /**
   * Said with "the" in a sentence ("You beat the Hidden Boss!", "the Hidden Boss mocks it"), never in a label (his card,
   * his bar): a name that's a title. `bossInText` adds it.
   */
  the?: true;
}

/**
 * A boss's name as a sentence says it: "the Hidden Boss" (a name said with "the": `the`), "the Pawn Golem" (a name
 * starting "The "), "Ginger". `start`: at the start of a sentence ("The Hidden Boss").
 */
export function bossInText(name: string, start = false, roster: readonly BossDef[] = BOSS_ROSTER): string {
  const said = roster.find((b) => b.name === name)?.the ? `the ${name}` : name.replace(/^The /, "the ");
  return start ? said[0]!.toUpperCase() + said.slice(1) : said;
}

/** The hopper's name wherever it shows (Eric, Oct 18): Chub the rabbit riding Chirp the grasshopper. Its id stays "hopper". */
export const HOPPER_NAME = "Chub & Chirp";

/**
 * Every boss, complete or not. Only a playable one (isPlayable: a complete character and powers) is ever chosen,
 * in every boss mode: the raid and solo's boss menu; the Crowd's boss final meets the `crowdFinal` one (crowdFinalBoss).
 * The rest are placeholders waiting for their art and powers.
 */
export const BOSS_ROSTER: readonly BossDef[] = [
  { id: "gingerbread", name: "Ginger", icon: "🍪", kit: "Ginger", offset: -100, powers: { passive: "freeze", ultimate: "blizzard" } },
  { id: "clown", name: "Boingo the Clown", icon: "🤡", kit: "Boingo the Clown", offset: -100, powers: { passive: "pie", ultimate: "funhouse" } },
  { id: "grex", name: "Jefferson", icon: "🦖", kit: "Jefferson", offset: -100, powers: { passive: "sparkler", ultimate: "candle" } },
  { id: "hollow", name: "Hollow", icon: "🌑", kit: "Hollow", offset: -100, powers: { passive: "dark", ultimate: "lightsout" } },
  // Big Boy eats one of the crowd's center pawns before move 1 (his snack), so he plays further under the lobby's
  // strength than the others (DECISIONS.md: "Big Boy, built": the boss sim's numbers).
  { id: "bigboy", name: "Big Boy", icon: "🍭", kit: "Big Boy", offset: -250, powers: { passive: "blocks", ultimate: "bounce" } },
  // Sawyer saws his first pawn in two after his first move (the split pawn): a pawn's head start, so he plays further
  // under the lobby's strength too (DECISIONS.md: "Sawyer, built": the boss sim's numbers).
  { id: "sawyer", name: "Sawyer", icon: "🪚", kit: "Sawyer", offset: -250, powers: { passive: "cuts", ultimate: "boardsaw" } },
  // Wrangler (the cowboy pig; his code id stays "pig": "wrangler" is Cloudflare's CLI here) drags a crowd piece a square
  // every few turns and lines up a forced duel as his ultimate, each costing the crowd up to about a pawn by the
  // engine's measure (more if it picks the wrong duel), so he plays as far under the lobby's strength as Big Boy and
  // Sawyer (DECISIONS.md: "Wrangler, built": the estimate).
  { id: "pig", name: "Wrangler", icon: "🤠", kit: "Wrangler", offset: -250, powers: { passive: "drag", ultimate: "showdown" } },
  // Alfil, the woolly mammoth (Eric, Oct 17): Tusks (two of his pawns fuse into an elephant, a bishop, and that's his
  // move) and the Mammoth Slam (three of the crowd's pieces in the air for three turns). Live with his art (Eric, Oct 17:
  // "you can just push it"). His offset from the boss sim (docs/decisions/2026-10-17-alfil-rules.md; V1, the fusion is
  // his move: reports/alfil-sim.md).
  { id: "alfil", name: "Alfil", icon: "🦣", kit: "Alfil", offset: -250, powers: { passive: "tusks", ultimate: "slam" } },
  // Chub & Chirp (HOPPER_NAME; id "hopper"): Chub the rabbit riding Chirp the grasshopper (Eric, Oct 18). Leapfrog: his
  // pawn hops over one of the crowd's that stands nose to nose with it (bosses/hopper.ts). Carrot Patch, once a battle:
  // five carrots planted, a race to pull them, then his spin (bosses/carrots.ts). Live with their art (Eric, Oct 18:
  // docs/decisions/2026-10-18-hopper-wired.md). His offset from the boss sim (reports/hopper-sim.md).
  { id: "hopper", name: HOPPER_NAME, icon: "🐇", kit: HOPPER_NAME, offset: -250, powers: { passive: "leapfrog", ultimate: "carrotpatch" } },
  // Smudgy, the chameleon painter (Eric, Oct 19): always from the starting position. Camouflage: his first two moves are
  // forced (an end pawn two squares, that side's rook out through the gap), then the rook swaps places with one of his
  // pawns and hides as a pawn until it strikes (bosses/smudgy.ts). Repaint, at most twice a battle: one of his pawns
  // painted the crowd's color and one of the crowd's knights or bishops his, his whole turn. Live with his art (Eric,
  // Oct 19: docs/decisions/2026-10-19-smudgy-wired.md; the test links `?boss=smudgy`, `&power=repaint`). His offset from the boss
  // sim: 0, at the lobby's strength (his forced opening costs him; at −250 the crowd scored 0.69, at 0 0.44:
  // reports/smudgy-sim.md; docs/decisions/2026-10-19-smudgy-rules.md).
  { id: "smudgy", name: "Smudgy", icon: "🦎", kit: "Smudgy", offset: 0, powers: { passive: "camouflage", ultimate: "repaint" } },
  // The Hidden Boss (working id "recluse"; Eric names him later: his name is this one string, wherever it shows). Hidden
  // from players (admins, Boss alone) except in the Crowd's boss final, which is always him (Eric, Oct 14). His strength
  // is fixed whatever the player's rating (BOSS_BRAIN.fixed: Maia at its top), so his offset is unused. The God King's
  // help doesn't work against him ("nohelp"), and his ultimate turns the clock into bullet ("bullet").
  // Moo & Moon (Eric, Oct 20): a cow who can't talk and his friend, a chatty crescent moon. Moonbeam: every 3 of his
  // moves, at the end of his turn, a beam stuns one of the crowd's pieces (it can't move on the crowd's next turn).
  // Full Moon: he plays at full strength for 5 of his moves, and the first ends with a flurry of 5 beams
  // (bosses/moo.ts; docs/decisions/2026-10-20-moo-rules.md). Not playable until his kit is wired (kit null; the test
  // link `?boss=moo&wip=1`, `&power=fullmoon` or `&power=moonbeam`). His offset from the raid sim (reports/moo-sim.md).
  { id: "moo", name: "Moo & Moon", icon: "🐄", kit: null, offset: -250, powers: { passive: "moonbeam", ultimate: "fullmoon" } },
  { id: "recluse", name: "Hidden Boss", icon: "📕", kit: "Hidden Boss", offset: 0, powers: { passive: "nohelp", ultimate: "bullet" }, adminOnly: true, crowdFinal: true, the: true },
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

/** The one rule for choosing a boss: it has a complete character and its powers, and isn't hidden from players. */
export const isPlayable = (b: BossDef | null | undefined): b is BossDef => !!b && b.kit !== null && b.powers !== null && !b.adminOnly;
/** An admin may meet it in Boss alone: a playable boss, or one hidden from players with its character and powers. */
export const adminPlayable = (b: BossDef | null | undefined): b is BossDef => !!b && b.kit !== null && b.powers !== null;
/** The bosses only admins meet (in Boss alone), in roster order. */
export const hiddenBosses = (roster: readonly BossDef[] = BOSS_ROSTER): BossDef[] => roster.filter((b) => b.adminOnly && adminPlayable(b));
/**
 * The boss menu's bosses: the playable ones; for an admin picking for Boss alone (not a raid), the hidden ones after them
 * (the Hidden Boss, for testing).
 */
export const menuBosses = (opts: { admin: boolean; raid: boolean }, roster: readonly BossDef[] = BOSS_ROSTER): BossDef[] => [...playableBosses(roster), ...(opts.admin && !opts.raid ? hiddenBosses(roster) : [])];

/**
 * The boss the Crowd's boss final always meets (Eric, Oct 14: the Hidden Boss, the top 4 against him): the roster's
 * `crowdFinal` boss with its character and powers, for everyone, though he's hidden from players everywhere else. Null
 * (none marked): the final meets a random playable boss, as raids do.
 */
export const crowdFinalBoss = (roster: readonly BossDef[] = BOSS_ROSTER): BossDef | null => roster.find((b) => b.crowdFinal && adminPlayable(b)) ?? null;

/** The bosses that can be met, in roster order. */
export function playableBosses(roster: readonly BossDef[] = BOSS_ROSTER): BossDef[] {
  return roster.filter(isPlayable);
}

/**
 * The roster without the bosses resting (`off`: their ids; kill switches, pauses.ts), for choosing a match's boss and
 * for the boss menu. If that would leave no playable boss, the whole roster: a match never fails for it (the ways in
 * close first).
 */
export function rosterWithout(off: readonly string[] | undefined, roster: readonly BossDef[] = BOSS_ROSTER): readonly BossDef[] {
  if (!off?.length) return roster;
  const left = roster.filter((b) => !off.includes(b.id));
  return playableBosses(left).length ? left : roster;
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
 * `hidden`: an admin's Boss alone, where `wanted` may be a boss hidden from players (adminPlayable); never at random.
 */
export function chooseBoss(roll: number, wanted?: string | null, avoid?: string | null, roster: readonly BossDef[] = BOSS_ROSTER, unfinished = false, hidden = false): BossDef {
  const pick = roster.find((b) => b.id === wanted);
  // (Testing, solo only: a boss whose powers are built but whose art isn't yet, with placeholders. Never a hidden one
  // but for an admin's Boss alone.)
  if (unfinished && pick?.powers && (!pick.adminOnly || hidden)) return pick;
  if (isPlayable(pick) || (hidden && adminPlayable(pick))) return pick;
  const all = playableBosses(roster);
  if (!all.length) throw new Error("No playable boss");
  const pool = all.length > 1 ? all.filter((b) => b.id !== avoid) : all;
  return pool[Math.min(pool.length - 1, Math.floor(Math.max(0, roll) * pool.length))]!;
}

/** The strongest the engine plays with its strength limited (Stockfish's UCI_Elo ceiling). */
export const ENGINE_MAX_ELO = 3190;
/** The weakest it plays (Stockfish's UCI_Elo floor): a boss set below it slips now and then instead (bossStumbleChance). */
export const ENGINE_MIN_ELO = 1320;

/**
 * The boss's strength: the lobby's (the usual calculation) plus its own offset, plus solo's difficulty (`extra`:
 * Easy −300 to Hardest +500), within what Stockfish plays. A boss whose brain is fixed (BOSS_BRAIN.fixed: the Hidden
 * Boss) has a fixed strength instead, whatever the player's rating or the difficulty: the level where Maia reaches its
 * top rating (fixedLevel).
 */
export function bossStrength(base: number, def: (Pick<BossDef, "offset"> & { id?: string }) | null, extra = 0, s: Pick<BossBrainSettings, "fixed" | "maiaRating"> = BOSS_BRAIN): number {
  if (def?.id && s.fixed[def.id]) return fixedLevel(s);
  return Math.max(800, Math.min(ENGINE_MAX_ELO, Math.round(base + (def?.offset ?? 0) + extra)));
}

/** Maia's top rating in our setup (BOSS_BRAIN.maiaRating's last point: 2500), and the level it's reached at (2650). */
export const maiaTopRating = (s: Pick<BossBrainSettings, "maiaRating"> = BOSS_BRAIN): number => s.maiaRating[s.maiaRating.length - 1]![1];
export const fixedLevel = (s: Pick<BossBrainSettings, "maiaRating"> = BOSS_BRAIN): number => s.maiaRating[s.maiaRating.length - 1]![0];

/**
 * Maia's rating for a strength on the game's rating scale (BOSS_BRAIN.maiaRating's lines): below the first point along
 * the first line, never under maiaRatingMin; above the last point held there (Maia's ceiling).
 */
export function maiaRatingFor(level: number, s: Pick<BossBrainSettings, "maiaRating" | "maiaRatingMin"> = BOSS_BRAIN): number {
  const pts = s.maiaRating;
  const [x0, y0] = pts[0]!;
  if (level <= x0) {
    const [x1, y1] = pts[1] ?? [x0 + 1, y0];
    return Math.max(s.maiaRatingMin, Math.round(y0 + ((level - x0) * (y1 - y0)) / (x1 - x0)));
  }
  for (let i = 1; i < pts.length; i++) {
    const [xa, ya] = pts[i - 1]!;
    const [xb, yb] = pts[i]!;
    if (level <= xb) return Math.round(ya + ((level - xa) * (yb - ya)) / (xb - xa));
  }
  return pts[pts.length - 1]![1];
}

/** How a boss plays a battle: its brain, the rating Maia plays at (null: Stockfish), and the bridge's share of Stockfish's moves. */
export interface BossBrainPlan {
  brain: BossBrain;
  rating: number | null;
  /** The share of its moves that are today's Stockfish move instead (the bridge band; 0 elsewhere). */
  stockfishShare: number;
}

/**
 * The brain when nobody picked one (BOSS_BRAIN): the boss's own below the bridge, then the light and the strict guard by
 * the level, a share of Stockfish's moves by the strength, and Stockfish from stockfishFrom.
 */
export function bandBrain(bossId: string, strength: number, level: number = strength, s: BossBrainSettings = BOSS_BRAIN): { brain: BossBrain; stockfishShare: number } {
  const own = s.byBoss[bossId] ?? s.brain;
  if (strength >= s.stockfishFrom || own === "stockfish") return { brain: "stockfish", stockfishShare: 0 };
  const share = strength <= s.bridgeShareFrom ? 0 : (s.bridgeStockfishShare * (strength - s.bridgeShareFrom)) / Math.max(1, s.stockfishFrom - s.bridgeShareFrom);
  const brain = level < s.bridgeFrom ? own : level < s.bridgeStrictFrom ? "maia-light" : "maia-strict";
  return { brain, stockfishShare: Math.round(share * 1000) / 1000 };
}

/**
 * A boss's brain in a battle (BOSS_BRAIN): the one picked (an admin's Brain picker: that brain, no bridge share), else
 * the boss's own with the bridge band; Stockfish from stockfishFrom whatever was picked, and wherever Maia isn't on
 * offer (`maia` false: a player while forPlayers is off, a lobby with one). The level is the strength, plus
 * crowdMargin when a crowd (`crowd`: more than one picking its moves) plays the boss: Maia plays at the level's rating,
 * and the bridge's guard follows the level too.
 *
 * A boss with a fixed brain (BOSS_BRAIN.fixed: the Hidden Boss) plays it at Maia's top rating, with no guard and no
 * Stockfish share, whatever the strength, the crowd, the difficulty or an admin's pick; Stockfish only where Maia isn't
 * on offer (and while Maia loads, as every boss).
 *
 * Boss alone (`alone`: its difficulty's Maia rating, BOSS_DIFFICULTY's `maia`) plays the boss's own brain, or an
 * admin's pick, at that rating whatever the strength, with no bridge share.
 */
export function bossBrainFor(
  bossId: string,
  strength: number,
  picked: BossBrain | "",
  maia: boolean,
  opts: { crowd?: boolean; alone?: number } = {},
  s: BossBrainSettings = BOSS_BRAIN,
): BossBrainPlan {
  const stockfish: BossBrainPlan = { brain: "stockfish", rating: null, stockfishShare: 0 };
  const fixed = s.fixed[bossId];
  if (fixed) return !maia || fixed === "stockfish" ? stockfish : { brain: fixed, rating: maiaTopRating(s), stockfishShare: 0 };
  if (!maia) return stockfish;
  // (Boss alone: its difficulty's Maia rating, whatever the strength; no bridge (BOSS_DIFFICULTY's `maia`, Oct 18).)
  if (opts.alone && !opts.crowd) {
    const brain = picked || (s.byBoss[bossId] ?? s.brain);
    return brain === "stockfish" ? stockfish : { brain, rating: opts.alone, stockfishShare: 0 };
  }
  if (strength >= s.stockfishFrom) return stockfish;
  const level = strength + (opts.crowd ? s.crowdMargin : 0);
  const { brain, stockfishShare } = picked ? { brain: picked, stockfishShare: 0 } : bandBrain(bossId, strength, level, s);
  if (brain === "stockfish") return stockfish;
  return { brain, rating: maiaRatingFor(level, s), stockfishShare };
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
  /**
   * The ultimate on its way or under way: warned as this crowd turn began, unleashed at this one. Both clear once its
   * effect is over (its rules' ultimateRunning), and the meter fills again for the next one.
   */
  warnAt?: number;
  ultAt?: number;
  /** How many ultimates have come this battle (the test switch brings only the first). */
  ults?: number;
  /**
   * The rage points spent so far (BOSS_POWERS): the meter is the rage gathered (ragePoints) less these. Each ultimate
   * spends all of it, and so does every turn its effect still runs (the meter stays empty meanwhile).
   */
  rageUsed?: number;
  /** When the passive fires next (a crowd turn). */
  nextPassive: number;
  /** Freeze: the iced piece (its square and kind), through this crowd turn. */
  frozen?: { square: string; piece: string; until: number } | null;
  /**
   * Ginger's blizzard (three turns, thawing; Eric, Oct 12): the crowd turn it came and its first free piece's square
   * then (a random one with a move, from the seed); and for crowd turn `at` (set as each of its turns begins, until the
   * ice is gone), `iced`: the crowd's pieces its ice holds (every one but those free), and `next`: those of them that
   * thaw as the next crowd turn begins (cracked and dripping on screen). Null once the ice is gone.
   */
  blizzard?: { turn: number; square: string; at?: number; iced?: string[]; next?: string[] } | null;
  /** Boingo's pies: each pied square (nobody may move onto it) through its crowd turn; up to BOSS_POWERS.pieMax. */
  pies?: { square: string; until: number }[];
  /**
   * Boingo's funhouse: the crowd turn it came (the board upside down), and the side its quarter turn goes to after
   * (90: a quarter turn clockwise, 270: counterclockwise); then the other side, then back (boardAngle). `move`/`san`: the
   * crowd's move he played for it on that first turn (Eric, Oct 12: "the forced move is the joke"), once played.
   */
  funhouse?: { turn: number; side: 90 | 270; move?: string; san?: string } | null;
  /**
   * The meter's charge from time, the judged eval and the God King's strikes (rage points, never coming down); the
   * boss's material lost adds to it (BOSS_POWERS.ragePerMaterial a point). `judged`: the crowd's expected score after its
   * last move, as judged.
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
   * Jefferson's laugh (once a match): the crowd turn one of his own pieces first sat on fire from his Roman candle, and
   * the line he says, picked from the seed (`pick`, 0-4095: the app takes it modulo its lines).
   */
  fireproof?: { turn: number; square: string; pick: number };
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
  /** Big Boy's snack: the crowd's center pawn he ate before move 1 (its square). */
  snack?: { square: string };
  /** Big Boy's toy block: its square (empty; nothing may move onto it or slide through it), the crowd turn it landed, its last. */
  block?: { square: string; at: number; until: number } | null;
  /** Big Boy's Big Bounce (his ultimate, at the start of his turn, after the crowd's move): what it did, once it has. */
  bounce?: BounceResult | null;
  /** Sawyer's split pawn, once his first move is played (unset until then: his first move must be a pawn move). */
  split?: SplitPawn;
  /** Sawyer's saw cut: the edge between two neighboring squares nothing may move straight across, its first and last crowd turn. */
  cut?: SawCut | null;
  /** Sawyer's board saw (his ultimate): no move may cross between the d and e files from crowd turn `at` through `until`. */
  boardSaw?: { at: number; until: number } | null;
  /**
   * Wrangler's long pull (his first move): the center pawn's double step (`from` to `via`), then lassoed one square
   * further (to `to`), as crowd turn `turn` begins. Null: his first move was an ordinary one (no sound pull). Unset until
   * his first move.
   */
  pull?: LongPull | null;
  /** Wrangler's last lasso drag: a crowd piece dragged one square after his move, as crowd turn `turn` began. */
  drag?: LassoDrag | null;
  /** Wrangler's last showdown: the pairs he lined up after his move, as crowd turn `turn` began (its forced duel). */
  showdown?: ShowdownResult | null;
  /**
   * Wrangler's meter (his own: BOSS_POWERS.showdownMeterTurns of his moves fill it; nothing else adds to it): his moves
   * made when it last emptied (0 as the battle starts; his move that lined up a showdown). Full once he has made
   * showdownMeterTurns more.
   */
  sdBase?: number;
  /** Wrangler's "I've got you in my sights.": the fill (its `sdBase`) he said it for, once a fill. */
  sdReady?: number;
  /**
   * Alfil's Tusks: the cast under way (two of his pawns marked, glowing: their squares now, as they move; his next turn
   * is the fusion, unless the crowd takes one), null once it fused or failed.
   */
  tusks?: TusksCast | null;
  /** Alfil's last fusion (or the one that failed: `to` null), for the screens' moment. */
  fusion?: Fusion | null;
  /** Alfil's elephants on the board (bishops in the rules, drawn with their own art): their squares now, as they move. */
  elephants?: string[];
  /** How many elephants Alfil has made this battle (at most BOSS_POWERS.tusksMax). */
  fused?: number;
  /** His turn (his turns so far + 1: a fusion was one) from which his next cast may come. */
  tusksNext?: number;
  /** Alfil's last Mammoth Slam that lifted something: what it lifted, when they land, and the engine's measure. */
  slam?: SlamResult | null;
  /**
   * Alfil's Mammoth Slam lifted nothing after this crowd move (no lift could go, none within the cap, or no engine's
   * answer): the meter isn't spent and nothing shows; it comes again at the start of his next turn. Never sent to screens.
   */
  slamWait?: number;
  /**
   * A power that spends his whole turn (Alfil's fusion) waited after this crowd move: passing would have lost real
   * material (the pass guard, BOSS_POWERS.passGuardPawns), so he plays his move instead, and it's due again at the start
   * of his next turn. Never sent to screens.
   */
  passWait?: number;
  /** The crowd's pieces in the air after the Mammoth Slam (each with the square it lands on), until they land. */
  airborne?: SlamPiece[] | null;
  /** Their last landing: where each came down (its own square, or the nearest empty one that's allowed). */
  landed?: SlamLanding | null;
  /** The hopper's last hop (Leapfrog): his pawn over a crowd pawn nose to nose with it, to the square beyond. */
  hop?: LeapfrogHop | null;
  /** How many hops the hopper has made this battle (at most BOSS_POWERS.hopMax). */
  hops?: number;
  /** The hopper's Carrot Patch, from its cast on (his ultimate, once a battle): the carrots, the race, his spin. */
  carrots?: CarrotPatch | null;
  /** Smudgy's Camouflage (his passive): his two forced moves, the swap, the rook hiding as a pawn, its reveal. */
  camo?: Camouflage | null;
  /** Smudgy's last Repaint (his ultimate): the pawn and the piece he painted. */
  repaint?: RepaintResult | null;
  /** How many Repaints Smudgy has made this battle (at most BOSS_POWERS.repaintMax). */
  repaints?: number;
  /**
   * Smudgy's Repaint was due after this crowd move and no pair fitted (or no engine's answer): he plays his move, and it
   * comes again at the start of his next turn, the warning staying. Never sent to screens.
   */
  repaintWait?: number;
  /** Moo & Moon's powers (Moonbeam, the Full Moon). */
  moo?: MooState | null;
  /** What happened as this turn began, for the screens' moments (the same for everyone). */
  events: PowerEvent[];
}

/**
 * Moo & Moon's powers in a battle (id moo; Eric, Oct 20; the chess package's bosses/moo.ts).
 * - `moves`: his moves this battle (Moonbeam comes after every BOSS_POWERS.moonbeamEvery-th).
 * - `stun`: the crowd's pieces a moonbeam holds: these squares (in the order the beams landed) can't move on crowd turn
 *   `turn`; `flurry`: the Full Moon's flurry put them there. Cleared as the crowd's move lands. Null: none.
 * - `full`: the Full Moon under way: it came after crowd move `at` (at the start of his turn); `left`, his moves still at
 *   full strength. Null: none.
 * - `dazed`: the crowd turn whose start plays the Full Moon's end (after his last move at full strength).
 */
export interface MooState {
  moves: number;
  stun: { turn: number; squares: string[]; flurry?: true } | null;
  full: { at: number; left: number } | null;
  dazed?: number;
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
 * Sawyer's split pawn: after his first move (crowd turn `turn` begins with it), the pawn sawn in two (`pawn`: the one
 * he moved, or another of his when it had no square to split into; null: his first move wasn't a pawn's, a check
 * leaving him no pawn move), or later (`waiting`), the new half on `square` beside it (null: no split yet). The
 * two halves are tracked through the game (`halves`: each one's square now and which side of the cut it was, "a" the
 * half on the a-file side, "h" the other); a half that's taken or promotes is gone from the list.
 */
export interface SplitPawn {
  turn: number;
  pawn: string | null;
  square: string | null;
  halves: { square: string; side: "a" | "h" }[];
  /**
   * No split after his first move: there was no room yet for another pawn of his (he had all 8, or the board 32
   * pieces: the engine plays only positions with up to 8 pawns a side and 32 pieces), no pawn of his had a square to
   * split into, or his first move wasn't a pawn's (a check with no pawn move out of it). The split comes after his
   * first pawn move once there is room and a pawn to split (then `turn`, `pawn` and `square` are that one's).
   */
  waiting?: true;
}

/**
 * A saw cut on the edge between two orthogonally neighboring squares (`a` before `b`: the lower file, or the lower rank
 * on one file), from crowd turn `at` through `until` (sawTurns in all).
 */
export interface SawCut {
  a: string;
  b: string;
  at: number;
  until: number;
}

/**
 * The power that stops a move that is otherwise legal, either side (Sawyer's board saw and saw cut, Boingo's pie, Big
 * Boy's toy block): the screens say which when one of yours is refused, and when the boss's only move went through one
 * (a limit that would leave no move lifts for that turn). `paint`: Smudgy's hidden rook makes a move of yours illegal
 * that the board as you see it allows (your king into its line, a piece it pins); never a move of his.
 */
export type StopReason = "boardsaw" | "cut" | "pie" | "block" | "paint";

/** Wrangler's long pull: his center pawn's double step (`from` to `via`), lassoed on to `to`, as crowd turn `turn` begins. */
export interface LongPull {
  turn: number;
  from: string;
  via: string;
  to: string;
}

/**
 * Wrangler's lasso drag: the crowd's piece (`piece`, its letter) dragged from `from` to the empty square `to` beside it
 * after his move, as crowd turn `turn` begins; `ult`: the drag that stood in for his showdown (none could be found).
 */
export interface LassoDrag {
  turn: number;
  from: string;
  to: string;
  piece: string;
  ult?: true;
}

/**
 * One pair of Wrangler's showdown: a piece of the crowd's and one of his of the same kind (`piece`, its letter), facing
 * each other: the crowd's on `crowd`, his on `boss`, each roped in from `crowdFrom` and `bossFrom`.
 */
export interface ShowdownPair {
  piece: string;
  crowd: string;
  boss: string;
  crowdFrom: string;
  bossFrom: string;
}

/**
 * Wrangler's showdown: as crowd turn `turn` begins (after his move), the pairs lined up in the middle of the board (the
 * crowd must play one of the duels: its piece taking his), the position before the line-up, and his edge in pawns after
 * the crowd's best duel as the engine put it (null: not known here; online the host's engine picked it).
 */
export interface ShowdownResult {
  turn: number;
  pairs: ShowdownPair[];
  before: string;
  edge: number | null;
  /** The board's ply the line-up was put on (the crowd's duel is the move played from it). */
  ply?: number;
  /** The admins' test trigger fired it outside the band (none inside it found): marked on their debug line. */
  outside?: true;
}

/**
 * Alfil's Tusks cast: at the start of his turn `turn` (his turns so far + 1; after the crowd's move `at`) he marked two
 * of his pawns (`pawns`: their squares now; they travel with the pieces). On his next turn they fuse into an elephant,
 * and that's his move, unless the crowd takes one first.
 */
export interface TusksCast {
  turn: number;
  at: number;
  pawns: string[];
}

/**
 * An Alfil fusion, his move after the crowd's move `at`: the two pawns (`from`, their squares then) became an elephant
 * on `to`, one of the two (the engine's pick); `to` null: it failed (`why`: one was taken, or no longer a pawn; or
 * neither square was allowed then, and he moved instead: bosses/alfil.ts, fusedFen).
 */
export interface Fusion {
  at: number;
  from: string[];
  to: string | null;
  why?: "taken" | "nowhere";
}

/** A crowd piece in the air after Alfil's Mammoth Slam: its letter (lower case) and its own square, where it lands. */
export interface SlamPiece {
  piece: string;
  square: string;
}

/**
 * Alfil's Mammoth Slam, after the crowd's move `at` (at the start of his turn): the crowd's pieces it lifted (always
 * some: a Slam that lifts nothing keeps the meter, BossPowerState.slamWait), the crowd turn they land as it begins
 * (`lands`), and the swing the engine put on it (pawns; null when not known here: online the host's engine picked it).
 */
export interface SlamResult {
  at: number;
  pieces: SlamPiece[];
  lands: number;
  loss: number | null;
}

/**
 * Where the Slam's pieces came down: as crowd turn `turn` began (after his move), or (`early`) at the start of his turn
 * after the crowd's move `at` (he had a mate in one only while they were up). Each piece's own square (`from`) and where
 * it landed (`to`: the same, or the nearest empty square that's allowed).
 */
export interface SlamLanding {
  turn: number;
  at: number;
  pieces: { piece: string; from: string; to: string }[];
  early?: true;
}

/**
 * A hop of the hopper's (Leapfrog), after the crowd's move `at`, at the start of his turn: his pawn on `from` hopped
 * over the crowd's pawn on `over` (nose to nose with it) to the empty square beyond, `to`.
 */
export interface LeapfrogHop {
  at: number;
  from: string;
  over: string;
  to: string;
}

/** Who pulled a carrot: the crowd, or the boss (Chub & Chirp). */
export type CarrotSide = "crowd" | "boss";

/**
 * Chub & Chirp's Carrot Patch (their ultimate, once a battle), from its cast on. The cast was his whole turn, after the
 * crowd's move `at`: carrots planted on `squares`. A piece pulls one by ending its move on it (a capture onto it counts,
 * and so does his Leapfrog hop landing there); a pulled carrot stays pulled (`pulls`: each square, who, and after which
 * crowd move: the crowd's own move, or his move or hop after it). The race: each side's moves since the cast (BOSS_POWERS
 * .carrotMoves each). It's `over` once every carrot is pulled ("pulled"), both sides' moves are done ("moves"), or he
 * pulls his last one ("won": the battle is his at once). Then, after his move, his spin (`spin`), unless the battle ended
 * first.
 */
export interface CarrotPatch {
  at: number;
  squares: string[];
  pulls: CarrotPull[];
  crowdMoves: number;
  bossMoves: number;
  over?: "pulled" | "moves" | "won";
  spin?: CarrotSpin | null;
}

/** A carrot pulled: its square, by whom, after which crowd move (his move or hop then: after the crowd's), and whether his hop did it. */
export interface CarrotPull {
  square: string;
  by: CarrotSide;
  at: number;
  hop?: true;
}

/**
 * His spin, after his move once the race is over (after the crowd's move `at`): his tier (his carrots), the prize the
 * roll gave (`rolled`: pieces as letters, "p" "n" "b" "r" "q"; none on tier 0), the prize he got (`prize`: stepped down
 * when the engines can't take it, BOSS_POWERS.carrotPrizes's order), and where each piece of it was put (`squares`).
 */
export interface CarrotSpin {
  at: number;
  tier: number;
  rolled: string[];
  prize: string[];
  squares: string[];
}

/**
 * Smudgy's Camouflage (Eric, Oct 19; docs/decisions/2026-10-19-smudgy-rules.md). His first two moves are forced: an end
 * pawn two squares (`side`: the a- or h-file), then that side's rook out through the gap to its third rank. A forced
 * move that can't be played on a turn waits for his next (`missed`), up to camoTries turns, then `off`: no Camouflage
 * this battle. After the second, before the crowd's turn, the swap: the rook (on `swap.rook`) and one of his pawns (on
 * `swap.pawn`) change places, and the rook hides as a pawn there. It moves like a pawn (forward, never a capture) until
 * it strikes: any rook move from the crowd's move `swap.at + camoStrikeTurn` on. It's revealed when it moves other than
 * as a pawn, when it gives check (directly or discovered), when his move leaves the crowd no move legal on both the
 * board it sees and the true one ("stuck"), and when the crowd takes it (`reveal`).
 */
export interface Camouflage {
  /** The side of his forced moves (null until the first is played). */
  side: "a" | "h" | null;
  /** His forced moves played so far (0, 1 or 2). */
  step: number;
  /** His turns on which the forced move due couldn't be played. */
  missed: number;
  /** The forced move due on his turn now (set as his turn begins; null: none, or none can be played now). */
  due: string | null;
  /** No Camouflage this battle (the forced moves couldn't be played within camoTries turns, or no pawn could take the rook's place). */
  off?: true;
  /** The swap, once done: after the crowd move `at`, the rook's square then (a real pawn stands there now) and the pawn's (the rook hides there). */
  swap?: { at: number; rook: string; pawn: string };
  /** The hidden rook's square now (null: not hidden, revealed or taken). */
  square: string | null;
  /** How it was revealed: after which crowd move (his move after it, or the crowd's move itself when it was taken), where, and how. */
  reveal?: { at: number; square: string; how: "move" | "check" | "stuck" | "taken"; from?: string };
}

/**
 * Smudgy's Repaint (his ultimate, his whole turn), after the crowd's move `at`: his pawn on `pawn` painted the crowd's
 * color, the crowd's knight or bishop on `piece` (`type`: "n" or "b") painted his; `gain`, what it gained him in pawns by
 * the engine (null: not known here, online the host's engine picked it); `outside`: the test switch's or the admins'
 * trigger's, outside the band (none inside it).
 */
export interface RepaintResult {
  at: number;
  pawn: string;
  piece: string;
  type: "n" | "b";
  gain: number | null;
  outside?: true;
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
  /**
   * A Lights out after his first (the ultimate comes again): its own seed, drawn from the battle's and the turn, so
   * it names other pieces and the bots find others; the first one uses the battle's seed, as ever.
   */
  seed?: number;
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
  /** It fell from his Roman candle (not his sparkler). */
  candle?: true;
}

/** After a crowd move: a piece the fire destroyed (`piece` its kind), a tile that fizzled under the king, or one that just burnt out (neither). */
export interface BurnEvent {
  turn: number;
  square: string;
  piece?: string;
  fizzled?: boolean;
}

/**
 * `thaw`: Ginger's blizzard thawing as one of its later turns begins (`squares`: the pieces whose ice melts now).
 * `extra`: Hollow's extra move after a failed Lights out (played after his own, before the crowd's turn). `block`: Big
 * Boy's toy block landing; `bounce`: his Big Bounce (at the start of his turn, after the crowd's move). `split`:
 * Sawyer saws the pawn of his first move in two; `cut`: a saw cut on an edge; `boardsaw`: his board saw. `pull`:
 * Wrangler's long pull (his first move, a center pawn three squares); `drag`: his lasso drag (a crowd piece dragged a
 * square after his move; `ult`: standing in for the test trigger's showdown when the board can't hold one); `showdown`:
 * his showdown (pairs lined up, a forced duel). `bullet`: the Hidden Boss's ultimate (his clock speech and spellbook; the
 * crowd's clock is bullet from then on). `bulletPlus`: a few moves into it, he adds time per move from then on (his line,
 * the increment across the board; BOSS_POWERS.bulletPlainMoves, bulletIncrementSeconds). Alfil's: `tusks`, his cast at
 * the start of his turn (two of his pawns marked: `squares`); `fuse`, their fusion, his move (with the moments of the
 * crowd's turn after it; `squares` the two, `square` the elephant's); `slam`, his Mammoth Slam at the start of his turn
 * (`squares` the pieces lifted); `land`, the Slam's pieces back down (`squares` where they landed; as a crowd turn
 * begins, or at the start of his turn when they come down early). The hopper's: `hop`, his Leapfrog (`squares`: the
 * hop's three, from, over and to; `square` where it landed); `carrots`, his Carrot Patch's cast (his whole turn: as the
 * crowd's turn after it begins; `squares` the carrots); `carrot`, a carrot pulled (`square`, `by`: the crowd's move, as
 * it lands; his hop, at the start of his turn; his move, as the crowd's turn after it begins); `carrotSpin`, his spin
 * once the race is over (as the crowd's turn after his move begins; `tier`, `prize`, `squares` where the prize went);
 * `carrotWin`, his last carrot pulled: the battle is his (`square`). Smudgy's: `camouflage`, the swap after his second
 * forced move (as the crowd's turn after it begins; `square`: the rook's old square, where a real pawn now stands; where
 * the rook hides is not in the moment, only in the view's `camo.square`: the app covers his whole pawn row); `unmask`,
 * the hidden rook revealed by his move (`reveal` "move": a move no pawn could make, `squares` from and to; "check": it
 * gives check, by its own pawn-shaped step or discovered; "stuck": his move left the crowd no move legal on the board it
 * sees as well as the true one; `square` where it stands), as the crowd's turn after it begins; `rookTaken`,
 * the crowd took it (`square`), as the crowd's move lands; `repaint`, his Repaint (his whole turn: as the crowd's turn
 * after it begins; `squares`: his pawn now the crowd's, then the crowd's piece now his). Moo & Moon's: `moonbeam`, a beam
 * at the end of his turn (`square`: the crowd's piece it stuns, which can't move this crowd turn) and `flurry`, the Full
 * Moon's beams at the end of its first turn (`squares`, in the order they land), each as the crowd's turn after his move
 * begins; `fullMoon`, his transformation at the start of his turn (as the crowd's move lands, while he thinks: his move
 * follows it); `dazed`, the Full Moon over, as the crowd's turn after his last move at full strength begins.
 */
export type PowerEventKind =
  | "freeze"
  | "pie"
  | "warn"
  | "blizzard"
  | "thaw"
  | "funhouse"
  | "spin"
  | "spark"
  | "candle"
  | "fireball"
  | "fireproof"
  | "dark"
  | "extra"
  | "block"
  | "bounce"
  | "split"
  | "cut"
  | "boardsaw"
  | "pull"
  | "drag"
  | "showdown"
  | "bullet"
  | "bulletPlus"
  | "tusks"
  | "fuse"
  | "slam"
  | "land"
  | "hop"
  | "carrots"
  | "carrot"
  | "carrotSpin"
  | "carrotWin"
  | "camouflage"
  | "unmask"
  | "rookTaken"
  | "repaint"
  | "moonbeam"
  | "flurry"
  | "fullMoon"
  | "dazed";
export interface PowerEvent {
  kind: PowerEventKind;
  turn: number;
  /** The square it hit (a freeze, a pie, a sparkler). */
  square?: string;
  /** The squares a wave of fireballs hit; the pieces Ginger's blizzard thaws. */
  squares?: string[];
  /** Of those, the ones that fizzled as they landed (the crowd's king stood there): no fire tile. */
  fizzled?: string[];
  /** Hollow's first cover of the dark (the square of the piece he just moved, with his first-cover line). */
  first?: true;
  /**
   * Which of the boss's lines (0-4095 from the seed; the app takes it modulo its lines): Jefferson's fireproof laugh,
   * Boingo's joke as his funhouse plays the crowd's move.
   */
  pick?: number;
  /** Wrangler's drag that stands in for the test trigger's showdown (the board couldn't hold a line-up). */
  ult?: true;
  /** Chub & Chirp's carrot pulled: by whom. */
  by?: CarrotSide;
  /** Chub & Chirp's spin: his tier (his carrots) and the prize he got (piece letters; none: a blank). */
  tier?: number;
  prize?: string[];
  /** Smudgy's unmask: how his hidden rook was revealed (a move no pawn could make, a check, or the crowd left no move it could see). */
  reveal?: "move" | "check" | "stuck";
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
 * being the mover's expected score after it, 0-1). The engine's judgment decides, not the material: a sacrifice it
 * likes gives nothing away. Once per game: the caller checks he hasn't fallen already.
 */
export function lastStandDue(loss: number, best: number, crowdMoves: number, charges: number, s: LastStandSettings): boolean {
  return best * 100 >= s.lastStandFrom && loss >= lastStandBar(best, crowdMoves, charges, s);
}
