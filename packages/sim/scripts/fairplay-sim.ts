/**
 * The fair-play simulation: cheater bots and honest players of many strengths in simulated Crowd 50 v 50 matches,
 * scored by the same code the server runs (core/fairplay.ts). Measures, for each threshold set, the catch rate within
 * 1, 2 and 5 matches per cheater type, and false flags and false bans per 1,000 honest players at each strength.
 * Writes reports/fairplay.md.
 *
 * No engine runs here: every position comes from the bank (fairplay-bank.ts), analysed once. Honest players pick the
 * way Stockfish's own limited strength does (src/skill.ts, from the bank's MultiPV-4 lines at each depth); cheaters
 * copy the bank's strong engine (the full network at 1M nodes); every pick is scored with the judges' numbers.
 *
 *   npx tsx packages/sim/scripts/fairplay-sim.ts [players=2000] [matches=5]
 *
 * Other modes (environment variables): FAIRPLAY_SETS='name:levels.banEvidence=8,signals.strengthCap=2800;…' adds
 * threshold sets to compare; FAIRPLAY_GRID=1 prints one line per set instead of the report; FAIRPLAY_USE_FITTED=1 uses
 * the models fitted in this run instead of settings.ts's; FAIRPLAY_DIAG / DIAG2 / DIAG3 / DIAG4 print distributions
 * and the model's calibration; FAIRPLAY_BANNED=1 lists the honest players a set would ban, match by match.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import {
  CROWD_KNOCKOUTS,
  FAIRPLAY,
  RATING_CURVE,
  honestChance,
  matchSignals,
  moveEvidence,
  mulberry32,
  playerLevel,
  referenceStrength,
  skipReason,
  crowdRate,
  type FairLevel,
  type FairLevels,
  type FairMove,
  type FairScore,
  type FairSignals,
  type FairSummary,
} from "@chessroyale/core";
import { pickDepth, randUint, skillPick } from "../src/skill.ts";
import type { BankGame, BankPosition } from "./fairplay-bank.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const PLAYERS = Number(process.argv[2] ?? 2000);
const MATCHES = Number(process.argv[3] ?? 5);
const rng = mulberry32(2026);
const rand = randUint(rng);

// ---------------- The bank ----------------

/** Every bank position by its FEN (the deep re-check looks moves up). */
const byFen = new Map<string, { cheat: string[]; top: string[]; exp: Map<string, number>; bestExp: number }>();

function loadBank(): BankGame[] {
  const packed = root + "packages/sim/data/fairplay-bank.json.gz";
  if (existsSync(packed)) return JSON.parse(gunzipSync(readFileSync(packed)).toString()) as BankGame[];
  const dir = root + "packages/sim/data/fairplay-bank/";
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(dir + f, "utf8")) as BankGame);
}

/** A bank position ready to play: every move's judged expected score, the best, complexity, difficulty. */
interface Pos {
  ply: number;
  fen: string;
  legal: number;
  exp: Map<string, number>;
  best: string;
  bestExp: number;
  near: number;
  gap: number | null;
  recapture: boolean;
  sh: Record<number, [string, number][]>;
  maxDepth: number;
  cheat: string[];
  /** Share of 1500-strength honest players who miss the best move (the time model's difficulty). */
  diff: number;
  /** The judges' best moves, best first (the deep re-check's candidates). */
  top: string[];
}

function prepare(p: BankPosition): Pos {
  const exp = new Map<string, number>([...p.top, ...Object.entries(p.extra)]);
  let best = p.top[0]![0];
  for (const [m, e] of exp) if (e > exp.get(best)!) best = m;
  const bestExp = exp.get(best)!;
  const losses = p.top.map(([, e]) => Math.max(0, (bestExp - e) * 100)).sort((a, b) => a - b);
  const depths = Object.keys(p.sh).map(Number);
  const pos: Pos = {
    ply: p.ply,
    fen: p.fen,
    legal: p.legal,
    exp,
    best,
    bestExp,
    near: losses.filter((l) => l <= FAIRPLAY.signals.nearPoints).length,
    gap: losses.length > 1 ? losses[1]! : null,
    recapture: !!p.last && best.slice(2, 4) === p.last.slice(2, 4),
    sh: p.sh,
    maxDepth: Math.max(...depths),
    cheat: p.cheat.length ? p.cheat : [best],
    diff: 0,
    top: [...exp.entries()].sort((a, b) => b[1] - a[1]).slice(0, FAIRPLAY.deep.candidates).map(([m]) => m),
  };
  let miss = 0;
  for (let i = 0; i < 200; i++) if (loss(pos, honestPick(pos, 1500)) > FAIRPLAY.signals.foundLoss) miss++;
  pos.diff = miss / 200;
  return pos;
}

function loss(pos: Pos, move: string): number {
  const e = pos.exp.get(move);
  if (e === undefined) return Math.max(0, (pos.bestExp - Math.min(...pos.exp.values())) * 100);
  return Math.max(0, (pos.bestExp - e) * 100);
}

function honestPick(pos: Pos, elo: number): string {
  let d = Math.min(pickDepth(elo), pos.maxDepth);
  while (d > 1 && !pos.sh[d]) d--;
  const lines = pos.sh[d] ?? pos.sh[pos.maxDepth]!;
  return skillPick(lines, elo, rand);
}

// ---------------- Players ----------------

const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) * Math.cos(2 * Math.PI * rng());
const clockMs = 20_000;
/** Honest thinking: longer on harder moves (lognormal around 3.5 s + 9 s × difficulty). */
const honestThink = (pos: Pos) => Math.max(800, Math.min(clockMs, Math.exp(Math.log(3500 + 9000 * pos.diff) + 0.5 * gauss())));
/** Copying an engine: 3-12 s whatever the position (the brief's "human-like delays"). */
const engineThink = () => 3000 + 9000 * rng();

/**
 * The cheater's engine (whatever app they run) against our deep re-check (Stockfish 17.1, the full network): two
 * strong engines don't always agree on the best move. Here the cheater's top move is ours this often, else our second
 * choice: a conservative stand-in for a different engine, depth or version.
 */
const ENGINE_AGREE = 0.85;
const engineMove = (p: Pos) => (rng() < ENGINE_AGREE ? p.cheat[0]! : (p.cheat[1] ?? p.cheat[0]!));

interface Kind {
  name: string;
  /** Honest strength (UCI_Elo), or the cheater's own strength for the moves it plays itself. */
  elo: number;
  cheat?: (pos: Pos, own: string, rate: number) => string | null;
  /** Cheaters on 20-40% of moves draw their rate per player. */
  rate?: () => number;
}

const HONEST: Kind[] = [1200, 1500, 1800, 2000, 2200, 2400, 2500, 2600, 2700].map((elo) => ({ name: `Honest ${elo}`, elo }));
const CHEATERS: Kind[] = [
  { name: "Full engine (top move, 3-12 s)", elo: 1500, cheat: (p) => engineMove(p) },
  { name: "Engine on 20-40% of moves (a 1500 player)", elo: 1500, rate: () => 0.2 + 0.2 * rng(), cheat: (p, _o, r) => (rng() < r ? engineMove(p) : null) },
  { name: "Engine on 20-40% of moves (a 1900 player)", elo: 1900, rate: () => 0.2 + 0.2 * rng(), cheat: (p, _o, r) => (rng() < r ? engineMove(p) : null) },
  { name: "Engine in hard positions only (a 1500 player)", elo: 1500, cheat: (p) => (p.diff >= 0.6 ? engineMove(p) : null) },
  { name: "Engine when its own move is a mistake (a 1500 player)", elo: 1500, cheat: (p, own) => (loss(p, own) >= 5 ? engineMove(p) : null) },
  {
    name: "Blended: the engine's 1st, 2nd or 3rd choice (50/30/20%)",
    elo: 1500,
    cheat: (p) => {
      const r = rng();
      return p.cheat[r < 0.5 ? 0 : r < 0.8 ? 1 : 2] ?? p.cheat[0]!;
    },
  },
];

interface Subject {
  kind: Kind;
  rate: number;
  /** Same phone (switches apps to the engine: a look-away on each engine move) or a second device. */
  samePhone: boolean;
  summaries: (FairSummary & { at: number })[];
  /** The highest level reached after each match (index: match number - 1). */
  levels: FairLevel[];
  movesByMatch: FairMove[][];
}

// ---------------- A match ----------------

const KNOCKOUTS = CROWD_KNOCKOUTS.team.map((k) => k / 2); // per team
const FIRST_CUT = 10; // a team's picks before the first cut (20 plies)

interface Seat {
  subject: Subject | null;
  elo: number;
  score: number;
  think: number;
  alive: boolean;
  moves: FairMove[];
}

/** One team's side of a 50 v 50: its seats pick on its plies, cuts after the 10th pick and every pick after. */
function playTeam(game: Pos[], color: 0 | 1, seats: Seat[], crowdInfo: boolean) {
  const plies = game.filter((p) => p.ply % 2 === color);
  let cut = 0;
  for (let k = 0; k < plies.length && cut < KNOCKOUTS.length; k++) {
    const pos = plies[k]!;
    const alive = seats.filter((s) => s.alive);
    const picks = alive.map((s) => {
      const own = honestPick(pos, s.elo);
      const sub = s.subject;
      const engine = sub?.kind.cheat ? sub.kind.cheat(pos, own, sub.rate) : null;
      const move = engine ?? own;
      const think = engine ? engineThink() : honestThink(pos);
      const away = engine && sub!.samePhone ? (rng() < 0.9 ? 1 : 0) : rng() < 0.02 ? 1 : 0;
      return { s, move, l: loss(pos, move), think, away };
    });
    const avg = picks.reduce((a, p) => a + p.l, 0) / picks.length;
    const foundAll = picks.filter((p) => p.l <= FAIRPLAY.signals.foundLoss).length;
    const tally = new Map<string, number>();
    for (const p of picks) tally.set(p.move, (tally.get(p.move) ?? 0) + 1);
    for (const p of picks) {
      p.s.score += avg - p.l;
      p.s.think += p.think;
      if (!p.s.subject) continue;
      const f = p.l <= FAIRPLAY.signals.foundLoss ? 1 : 0;
      p.s.moves.push({
        ply: pos.ply,
        fen: pos.fen,
        move: p.move,
        best: pos.best,
        loss: Math.round(p.l * 100) / 100,
        bestExp: pos.bestExp,
        near: pos.near,
        gap: pos.gap,
        crowd: crowdInfo ? picks.length - 1 : 0,
        crowdFound: crowdInfo ? foundAll - f : 0,

        ...(crowdInfo
          ? {
              picks: Object.fromEntries(
                [...tally.entries()]
                  .map(([m, n]) => [m, n - (m === p.move ? 1 : 0)] as const)
                  .filter(([, n]) => n > 0)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6),
              ),
            }
          : {}),
        thinkMs: Math.round(p.think),
        away: p.away,
        legal: pos.legal,
        top: pos.top,
        ...(pos.recapture ? { recapture: true } : {}),
      });
    }
    // The cuts: after the 10th pick, then after every pick, the lowest scores go (less thinking wins a tie).
    if (k + 1 >= FIRST_CUT) {
      const order = alive.sort((a, b) => a.score - b.score || b.think - a.think);
      for (const s of order.slice(0, KNOCKOUTS[cut]!)) s.alive = false;
      cut++;
    }
  }
}

/** A crowd player's strength: the population, UCI_Elo ~ N(1500, 350). */
const crowdElo = () => Math.max(900, Math.min(2700, 1500 + 350 * gauss()));

function playMatch(games: Pos[][], subjects: Subject[], at: number, crowdInfo: boolean) {
  const game = games[Math.floor(rng() * games.length)]!;
  // Subjects spread over both teams; the rest of each team of 50 is the crowd.
  const teams: Seat[][] = [[], []];
  subjects.forEach((sub, i) => {
    // An honest player's form varies from match to match (a good day): conservative for false flags.
    const elo = sub.kind.cheat ? sub.kind.elo : Math.max(900, Math.min(2850, sub.kind.elo + 100 * gauss()));
    teams[i % 2]!.push({ subject: sub, elo, score: 0, think: 0, alive: true, moves: [] });
  });
  for (const t of teams) while (t.length < 50) t.push({ subject: null, elo: crowdElo(), score: 0, think: 0, alive: true, moves: [] });
  playTeam(game, 0, teams[0]!, crowdInfo);
  playTeam(game, 1, teams[1]!, crowdInfo);
  for (const seat of [...teams[0]!, ...teams[1]!]) {
    const sub = seat.subject;
    if (!sub) continue;
    sub.movesByMatch.push(seat.moves);
  }
}

// ---------------- Running everything ----------------

const games = loadBank()
  .sort((a, b) => a.g - b.g)
  .map((g) => g.positions.map(prepare));
const positions = games.flat();
for (const p of positions) byFen.set(p.fen, p);
console.log(`bank: ${games.length} games, ${positions.length} positions`);

/** Plays every subject through `MATCHES` matches, 12 subjects to a match (6 per team). */
function run(kinds: Kind[], n: number, crowdInfo = true, samePhone = false): Subject[] {
  const subjects: Subject[] = [];
  for (const kind of kinds) for (let i = 0; i < n; i++) subjects.push({ kind, rate: kind.rate?.() ?? 0, samePhone, summaries: [], levels: [], movesByMatch: [] });
  // Shuffle so each match mixes kinds.
  for (let i = subjects.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [subjects[i], subjects[j]] = [subjects[j]!, subjects[i]!];
  }
  for (let m = 0; m < MATCHES; m++) for (let i = 0; i < subjects.length; i += 12) playMatch(games, subjects.slice(i, i + 12), m, crowdInfo);
  return subjects;
}

type Settings = { signals: FairSignals; score: FairScore; levels: FairLevels; queueScore: number };
const rank: Record<FairLevel, number> = { none: 0, watch: 1, review: 2, ban: 3 };

/** Scores every subject's matches with a settings set: the level after each match. */
/**
 * The deep re-check of one match's counted moves, as the server does it afterwards: our deep engine's best (the bank's
 * full-network engine) among the judges' top moves and the pick, the pick's rank and loss.
 */
function deepCheck(moves: FairMove[], st: Settings): FairMove[] {
  return moves.map((m) => {
    if (skipReason(m, st.signals) !== null) return m;
    const pos = byFen.get(m.fen)! as Pos;
    const order = [...new Set([pos.cheat[0]!, ...pos.cheat.slice(1), ...pos.top])];
    const at = order.indexOf(m.move);
    const rank = at >= 0 ? at + 1 : order.length + 1;
    return { ...m, deep: { best: pos.cheat[0]!, rank, loss: Math.max(0, m.loss - loss(pos, pos.cheat[0]!)), top: order.slice(0, 3) } };
  });
}

function evaluate(subjects: Subject[], st: Settings) {
  const HOUR = 3_600_000;
  for (const sub of subjects) {
    sub.summaries = [];
    sub.levels = [];
    let best: FairLevel = "none";
    const checked: boolean[] = [];
    sub.movesByMatch.forEach((raw, m) => {
      const at = (m + 1) * HOUR;
      const refAt = (i: number) => referenceStrength(sub.summaries.slice(0, i).map((s) => s.perf), null);
      let summary = { ...matchSignals(raw, refAt(m), st.signals, st.score), at };
      let lv = playerLevel([...sub.summaries, summary], at + 1, st.levels).level;
      // Queued for the deep re-check (a flagged match, or a player already watched), done before their next match.
      // As on the server, once a player is flagged every earlier match still kept is checked too (it can clear them).
      if (summary.score >= st.queueScore || lv !== "none" || best !== "none") {
        summary = { ...matchSignals(deepCheck(raw, st), refAt(m), st.signals, st.score), at };
        checked[m] = true;
        for (let i = 0; i < m; i++) {
          if (checked[i]) continue;
          sub.summaries[i] = { ...matchSignals(deepCheck(sub.movesByMatch[i]!, st), refAt(i), st.signals, st.score), at: sub.summaries[i]!.at };
          checked[i] = true;
        }
        lv = playerLevel([...sub.summaries, summary], at + 1, st.levels).level;
      }
      sub.summaries.push(summary);
      if (rank[lv] > rank[best]) best = lv;
      sub.levels.push(best);
    });
  }
}

/** Share of subjects of a kind at `level` or above within `k` matches. */
const reached = (subs: Subject[], level: FairLevel, k: number) => subs.filter((s) => rank[s.levels[Math.min(k, s.levels.length) - 1]!] >= rank[level]).length / subs.length;
const pct = (x: number) => `${(100 * x).toFixed(x < 0.1 && x > 0 ? 1 : 0)}%`;
const per1000 = (x: number) => (x === 0 ? "0" : (1000 * x).toFixed(1));
const quant = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))]! : NaN;
};

const t0 = Date.now();
const honest = run(HONEST, PLAYERS);
const cheaters = run(CHEATERS, Math.round(PLAYERS / 4));
const cheatersSame = run(CHEATERS, Math.round(PLAYERS / 8), true, true);
const honestFew = run(HONEST.filter((k) => k.elo >= 2200), Math.round(PLAYERS / 2), false);
const cheatersFew = run(CHEATERS, Math.round(PLAYERS / 8), false);
console.log(`played in ${Math.round((Date.now() - t0) / 1000)} s`);

// ---------------- The hard-find model's slope, fitted on honest players ----------------

function fitSlope(): number {
  // found ~ sigmoid(logit(c') + b * (R - 1500) / 400), over honest subjects' counted moves with a crowd; Newton on b.
  const data: { off: number; x: number; y: number }[] = [];
  for (const sub of honest)
    for (const moves of sub.movesByMatch)
      for (const m of moves) {
        if (skipReason(m) !== null || crowdRate(m) === null) continue;
        const c = (m.crowdFound + 0.5) / (m.crowd + 1);
        data.push({ off: Math.log(c / (1 - c)), x: (sub.kind.elo - FAIRPLAY.signals.crowdRating) / 400, y: m.loss <= FAIRPLAY.signals.foundLoss ? 1 : 0 });
      }
  let b = 1;
  for (let it = 0; it < 30; it++) {
    let g = 0;
    let h = 0;
    for (const d of data) {
      const p = 1 / (1 + Math.exp(-(d.off + b * d.x)));
      g += (d.y - p) * d.x;
      h += p * (1 - p) * d.x * d.x;
    }
    b += g / h;
  }
  return Math.round(b * 100) / 100;
}
const slope = fitSlope();
console.log(`fitted hard-find slope: ${slope} (settings: ${FAIRPLAY.signals.hardSlope})`);

/** Logistic regression by Newton's method: y ~ sigmoid(w · x). */
function irls(data: { x: number[]; y: number }[]): number[] {
  const k = data[0]!.x.length;
  let w = new Array<number>(k).fill(0);
  for (let it = 0; it < 40; it++) {
    const g = new Array<number>(k).fill(0);
    const h = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    for (const d of data) {
      const p = 1 / (1 + Math.exp(-d.x.reduce((t, xi, i) => t + xi * w[i]!, 0)));
      for (let i = 0; i < k; i++) {
        g[i]! += (d.y - p) * d.x[i]!;
        for (let j = 0; j < k; j++) h[i]![j]! += p * (1 - p) * d.x[i]! * d.x[j]!;
      }
    }
    // Solve h · step = g (Gaussian elimination).
    const a = h.map((row, i) => [...row, g[i]!]);
    for (let c = 0; c < k; c++) {
      let piv = c;
      for (let r = c + 1; r < k; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[piv]![c]!)) piv = r;
      [a[c], a[piv]] = [a[piv]!, a[c]!];
      for (let r = 0; r < k; r++) {
        if (r === c) continue;
        const f = a[r]![c]! / a[c]![c]!;
        for (let j = c; j <= k; j++) a[r]![j]! -= f * a[c]![j]!;
      }
    }
    w = w.map((wi, i) => wi + a[i]![k]! / a[i]![i]!);
  }
  return w.map((x) => Math.round(x * 100) / 100);
}
/** The honest-chance models (core/fairplay.ts, honestChance), fitted on honest players' counted moves. */
function fitModels() {
  type D = { x: number[]; y: number }[];
  const withCrowd = { judge: [] as D, deep: [] as D, deep3: [] as D };
  const hardest = { judge: [] as D, deep: [] as D, deep3: [] as D };
  const solo = { judge: [] as D, deep: [] as D, deep3: [] as D };
  for (const sub of honest)
    for (const moves of sub.movesByMatch)
      for (const m of moves) {
        if (skipReason(m) !== null) continue;
        const d = (sub.kind.elo - 1500) / 400;
        const pos = byFen.get(m.fen)!;
        const top3 = [...new Set([pos.cheat[0]!, ...pos.cheat.slice(1), ...(pos as Pos).top])].slice(0, 3);
        for (const which of ["judge", "deep", "deep3"] as const) {
          const y = which === "deep" ? (m.move === pos.cheat[0] ? 1 : 0) : which === "deep3" ? (top3.includes(m.move) ? 1 : 0) : m.loss <= FAIRPLAY.signals.foundLoss ? 1 : 0;
          solo[which].push({ x: [1, d], y });
          if (m.crowd < FAIRPLAY.signals.minCrowd) continue;
          const found =
            which === "deep" ? (m.picks?.[pos.cheat[0]!] ?? 0) : which === "deep3" ? top3.reduce((t, x) => t + (m.picks?.[x] ?? 0), 0) : m.crowdFound;
          const c = (found + 0.5) / (m.crowd + 1);
          const lc = Math.log(c / (1 - c));
          withCrowd[which].push({ x: [lc, d * lc, 1, d], y });
          if (found / m.crowd < 0.05) hardest[which].push({ x: [1, d], y });
        }
      }
  return {
    findJudge: [...irls(withCrowd.judge), ...irls(hardest.judge)],
    findDeep: [...irls(withCrowd.deep), ...irls(hardest.deep)],
    findDeep3: irls(withCrowd.deep3),
    soloFound: irls(solo.judge),
    soloDeep: irls(solo.deep),
    soloDeep3: irls(solo.deep3),
  };
}
const fitted = fitModels();
console.log(`fitted models: ${JSON.stringify(fitted)}`);
console.log(`settings: ${JSON.stringify({ findJudge: FAIRPLAY.signals.findJudge, findDeep: FAIRPLAY.signals.findDeep, findDeep3: FAIRPLAY.signals.findDeep3, soloFound: FAIRPLAY.signals.soloFound, soloDeep: FAIRPLAY.signals.soloDeep, soloDeep3: FAIRPLAY.signals.soloDeep3 })}`);

// ---------------- Threshold sets ----------------

const base: Settings = { signals: FAIRPLAY.signals, score: FAIRPLAY.score, levels: FAIRPLAY.levels, queueScore: FAIRPLAY.deep.queueScore };
// (FAIRPLAY_USE_FITTED=1: every set uses the models fitted above, to try them before they go in settings.ts.)
if (process.env.FAIRPLAY_USE_FITTED) base.signals = { ...base.signals, ...fitted };
const SETS: { name: string; st: Settings }[] = [{ name: "settings.ts", st: base }];
for (const extra of (process.env.FAIRPLAY_SETS ?? "").split(";").filter(Boolean)) {
  // FAIRPLAY_SETS='name:levels.banPerf=2800,score.evidencePer=1,signals.soloDeep=-0.5|0.3;…'
  const [name, spec] = extra.split(":");
  const st: Settings = JSON.parse(JSON.stringify(base));
  for (const kv of spec!.split(",")) {
    const [path, v] = kv.split("=");
    const [a, b] = path!.split(".");
    const value = v!.includes("|") ? v!.split("|").map(Number) : Number(v);
    if (b === undefined) (st as unknown as Record<string, unknown>)[a!] = value;
    else (st as unknown as Record<string, Record<string, unknown>>)[a!]![b] = value;
  }
  SETS.push({ name: name!, st });
}

if (process.env.FAIRPLAY_DIAG) {
  // Per kind, per match over counted moves: found (judge's best within 1 point), deep match (the strong engine's top
  // move), mean loss.
  const deepTop = new Map<string, string>();
  for (const p of positions) deepTop.set(p.fen, p.cheat[0]!);
  console.log("kind | counted | found share p10/p50/p90 | deep-match share p10/p50/p90 | mean loss p10/p50/p90");
  for (const kind of [...HONEST, ...CHEATERS]) {
    const subs = [...honest, ...cheaters].filter((s) => s.kind === kind);
    const f: number[] = [];
    const d: number[] = [];
    const l: number[] = [];
    const c: number[] = [];
    for (const sub of subs)
      for (const moves of sub.movesByMatch) {
        const cm = moves.filter((m) => skipReason(m) === null);
        if (cm.length < 6) continue;
        c.push(cm.length);
        f.push(cm.filter((m) => m.loss <= 1).length / cm.length);
        d.push(cm.filter((m) => m.move === deepTop.get(m.fen)).length / cm.length);
        l.push(cm.reduce((a, m) => a + m.loss, 0) / cm.length);
      }
    const q3 = (xs: number[]) => [0.1, 0.5, 0.9].map((q) => quant(xs, q).toFixed(2)).join("/");
    console.log(`${kind.name} | ${quant(c, 0.5)} | ${q3(f)} | ${q3(d)} | ${q3(l)}`);
  }
  process.exit(0);
}

if (process.env.FAIRPLAY_DIAG2) {
  // Per kind, per match: counted, perf, evidence without and with the deep re-check, score with deep.
  const q3 = (xs: number[]) => [0.1, 0.5, 0.9, 0.99].map((q) => quant(xs, q).toFixed(1)).join("/");
  console.log("kind | counted | perf | evidence (judges) | evidence (deep) | deep share | score (deep) p10/p50/p90/p99");
  for (const kind of [...HONEST, ...CHEATERS]) {
    const subs = [...honest, ...cheaters].filter((s) => s.kind === kind);
    const c: number[] = [], pf: number[] = [], e1: number[] = [], e2: number[] = [], ds: number[] = [], sc: number[] = [];
    for (const sub of subs)
      for (const raw of sub.movesByMatch) {
        const a = matchSignals(raw, null, base.signals, base.score);
        const b = matchSignals(deepCheck(raw, base), null, base.signals, base.score);
        c.push(a.counted);
        pf.push(a.perf ?? 0);
        e1.push(a.evidence);
        e2.push(b.evidence);
        ds.push(b.deepChecked ? b.deepMatch / b.deepChecked : 0);
        sc.push(b.score);
      }
    console.log(`${kind.name} | ${q3(c)} | ${q3(pf)} | ${q3(e1)} | ${q3(e2)} | ${q3(ds)} | ${q3(sc)}`);
  }
  process.exit(0);
}

if (process.env.FAIRPLAY_DIAG3) {
  // Per subject, the evidence summed over its first k matches (all deep-checked), and deep-checked moves.
  const st = SETS[SETS.length - 1]!.st;
  console.log(`set ${SETS[SETS.length - 1]!.name}: kind | sum after 1 / 2 / 5 matches: p10, p50 (cheaters) or p99, p99.9, max (honest) | deep-checked after 2`);
  for (const kind of [...HONEST, ...CHEATERS]) {
    const subs = [...honest, ...cheaters].filter((s) => s.kind === kind);
    const sums = [1, 2, 5].map(() => [] as number[]);
    const checked: number[] = [];
    for (const sub of subs) {
      let total = 0;
      let n = 0;
      sub.movesByMatch.forEach((raw, m) => {
        const x = matchSignals(deepCheck(raw, st), null, st.signals, st.score);
        if (Number.isNaN(x.evidence) && process.env.FAIRPLAY_DEBUG) {
          for (const mv of deepCheck(raw, st)) {
            const e = moveEvidence(mv, 2000, st.signals);
            if (Number.isNaN(e.evidence)) {
              console.log(JSON.stringify(mv), JSON.stringify(e));
              process.exit(1);
            }
          }
        }
        total += x.evidence;
        if (m < 2) n += x.deepChecked;
        [1, 2, 5].forEach((k, i) => m + 1 === k && sums[i]!.push(total));
      });
      checked.push(n);
    }
    const cheat = !!kind.cheat;
    const f = (xs: number[]) => (cheat ? [0.1, 0.5].map((q) => quant(xs, q).toFixed(1)).join(", ") : `${quant(xs, 0.99).toFixed(1)}, ${quant(xs, 0.999).toFixed(1)}, ${Math.max(...xs).toFixed(1)}`);
    console.log(`${kind.name} | ${sums.map(f).join(" / ")} | ${quant(checked, 0.5)}`);
  }
  process.exit(0);
}

if (process.env.FAIRPLAY_DIAG4) {
  // Calibration: honest players' actual chance of picking the deep re-check's best and the judges' best, by the crowd's
  // rate for that move, against the model at their strength.
  const bins = [0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.7, 1.01];
  for (const which of ["deep", "judge"] as const) {
    console.log(`${which}: strength | crowd rate bins ${bins.slice(0, -1).join(" ")} → actual (model) [n]`);
    for (const kind of HONEST.filter((k) => k.elo >= 1500)) {
      const acc = bins.slice(0, -1).map(() => ({ n: 0, hit: 0, model: 0 }));
      for (const sub of honest.filter((x) => x.kind === kind))
        for (const raw of sub.movesByMatch)
          for (const m of deepCheck(raw, base)) {
            if (skipReason(m) !== null || m.crowd < 8) continue;
            const pos = byFen.get(m.fen)!;
            const hit = which === "deep" ? m.move === pos.cheat[0] : m.loss <= 1;
            const found = which === "deep" ? (m.picks?.[pos.cheat[0]!] ?? 0) : m.crowdFound;
            const c = found / m.crowd;
            const i = bins.findIndex((b, j) => c >= b && c < bins[j + 1]!);
            acc[i]!.n++;
            if (hit) acc[i]!.hit++;
            const sg = base.signals;
            acc[i]!.model += honestChance(m.crowd, found, kind.elo, which === "deep" ? sg.findDeep : sg.findJudge, which === "deep" ? sg.soloDeep : sg.soloFound, sg);
          }
      console.log(`${kind.elo} | ${acc.map((a) => (a.n ? `${(a.hit / a.n).toFixed(2)} (${(a.model / a.n).toFixed(2)}) [${a.n}]` : "-")).join(" | ")}`);
    }
  }
  process.exit(0);
}

if (process.env.FAIRPLAY_BANNED) {
  // The honest players a set bans, match by match (what made them look like engines).
  const st = SETS[SETS.length - 1]!.st;
  evaluate(honest, st);
  evaluate(cheaters, st);
  const show = (sub: Subject) =>
    sub.summaries
      .map((x) => `perf ${x.perf} n ${x.counted} ev ${x.evidence} deep ${x.deepMatch}/${x.deepChecked} corr ${x.timeCorr} fast ${x.fastHard} score ${x.score}`)
      .join(" || ");
  for (const sub of honest.filter((x) => x.levels[MATCHES - 1] === "ban")) console.log(`HONEST ${sub.kind.elo}: ${sub.levels.join(",")} :: ${show(sub)}`);
  for (const sub of cheaters.filter((x) => x.kind === CHEATERS[0]).slice(0, 6)) console.log(`ENGINE: ${sub.levels.join(",")} :: ${show(sub)}`);
  process.exit(0);
}

if (process.env.FAIRPLAY_GRID) {
  // A compact line per threshold set, to compare them (FAIRPLAY_SETS); no report written.
  const head = ["set", "full: rev 1/2", "full: ban 1/2/5", "20-40% (1500): rev/ban 5", "20-40% (1900): rev/ban 5", "hard only: rev/ban 5", "mistakes: rev/ban 5", "blended: rev/ban 5", "honest review /1000 (1500, 2000, 2400, 2700)", "honest bans (count@strength)", "few people: full ban 5"];
  console.log(head.join(" | "));
  for (const set of SETS) {
    for (const subs of [honest, cheaters, honestFew, cheatersFew]) evaluate(subs, set.st);
    const of = (subs: Subject[], i: number) => subs.filter((s) => s.kind === CHEATERS[i]);
    const h = (elo: number) => honest.filter((s) => s.kind.elo === elo);
    const rb = (i: number) => `${pct(reached(of(cheaters, i), "review", 5))}/${pct(reached(of(cheaters, i), "ban", 5))}`;
    console.log(
      [
        set.name,
        `${pct(reached(of(cheaters, 0), "review", 1))}/${pct(reached(of(cheaters, 0), "review", 2))}`,
        [1, 2, 5].map((k) => pct(reached(of(cheaters, 0), "ban", k))).join("/"),
        rb(1),
        rb(2),
        rb(3),
        rb(4),
        rb(5),
        [1500, 2000, 2400, 2700].map((e) => per1000(reached(h(e), "review", MATCHES))).join(", "),
        HONEST.map((k) => [k.elo, h(k.elo).filter((x) => x.levels[MATCHES - 1] === "ban").length] as const)
          .filter(([, n]) => n)
          .map(([e, n]) => `${n}@${e}`)
          .join(" ") || "0",
        pct(reached(of(cheatersFew, 0), "ban", 5)),
      ].join(" | "),
    );
  }
  process.exit(0);
}

const lines: string[] = [];
const out = (s = "") => lines.push(s);
const nHonest = PLAYERS;
const nCheat = Math.round(PLAYERS / 4);
out("# Fair play: simulated cheaters and honest players");
out("");
out(`Generated by \`packages/sim/scripts/fairplay-sim.ts\` (${nHonest.toLocaleString("en-US")} honest players per strength, ${nCheat.toLocaleString("en-US")} cheaters per type, ${MATCHES} Crowd 50 v 50 matches each). Every pick is summarised and scored by the server's own code (\`core/fairplay.ts\`) with the thresholds in \`settings.ts\` (\`FAIRPLAY\`). DECISIONS.md, "Fair play", has the summary.`);
out("");
out("## How it's simulated");
out("");
out(`- **Positions:** \`fairplay-bank.ts\` played ${games.length} Crowd games from the starting position the way a crowd does (50 honest players pick, the most popular move is played), ${positions.length} positions in all. Each was analysed once: the judges' search (the browser engine, 250k nodes, top 8, plus every other move anyone might pick), Stockfish's own MultiPV-4 lines at depths 1-11, and a strong engine (the full network, 1M nodes, top 3), which stands in for both a cheater's engine app and our deep re-check.`);
out(`- **Honest players** pick the way Stockfish's limited strength (UCI_Elo) does, emulated exactly from those lines (\`src/skill.ts\`), at 1200 to 2700, with ±100 of form from match to match. The crowd around them is honest players of N(1500, 350). Think time: lognormal, longer on harder moves (3.5 s + 9 s × the share of 1500 players who'd miss the move). A look-away on 2% of moves.`);
out(`- **Cheaters** copy the engine with 3-12 s delays whatever the move. Their engine agrees with our deep re-check's best ${Math.round(ENGINE_AGREE * 100)}% of the time (else they play our second choice): two strong engines, depths or versions don't always agree, so this is deliberately not 100%. Types: every move; 20-40% of moves (per player) at 1500 and 1900; only in hard positions; only when their own move would lose 5+ points; and a blend of the engine's 1st, 2nd and 3rd choices (50/30/20%). "Same phone": a look-away on 90% of engine moves.`);
out(`- **A match:** each player is on a team of 50 and picks on its team's plies: 10 picks to the first cut, then a cut after every pick (the team-final schedule, half of each cut per team), to the final eight. The final's few moves aren't simulated (fewer counted moves than real finalists get: conservative).`);
out(`- **The deep re-check** runs on any match that scored ${FAIRPLAY.deep.queueScore}+ or of a player already flagged, before their next match.`);
out(`- **"Few people":** the same matches with fewer than ${FAIRPLAY.signals.minCrowd} other people picking (bots fill the lobby), so there are no crowd rates and only strength-based chances apply.`);
out("");
out("## Honest players: does the emulation play at its strength?");
out("");
out("Average loss per move over every bank position, against the calibration curve the app's engine rating uses (`reports/rating-calibration.md`, the real engine on other positions):");
out("");
out("| UCI_Elo | Emulated loss per move | Calibration curve |");
out("| --- | --- | --- |");
for (const c of RATING_CURVE.filter((c) => c.elo <= 2800)) {
  let total = 0;
  for (const p of positions) total += loss(p, honestPick(p, c.elo));
  out(`| ${c.elo} | ${(total / positions.length).toFixed(2)} | ${c.meanLoss.toFixed(2)} |`);
}
out("");
const counted = honest.flatMap((s) => s.movesByMatch.flat()).filter((m) => skipReason(m) === null);
const allHonestMoves = honest.flatMap((s) => s.movesByMatch.flat());
const hardShare = counted.filter((m) => (crowdRate(m) ?? 1) < FAIRPLAY.signals.hardShare).length / counted.length;
out(`Of the honest players' picks, ${pct(counted.length / allHonestMoves.length)} count (the rest: the opening, forced moves, only moves and recaptures most of the crowd found, positions already won or lost); ${pct(hardShare)} of counted positions are hard (fewer than ${pct(FAIRPLAY.signals.hardShare)} of the crowd found the best move).`);
out("");
out("## The evidence model, fitted on honest players");
out("");
out(`An honest player's chance of picking the best move, from the crowd's rate for it and their strength (\`honestChance\`): fitted ${JSON.stringify(fitted)}; in settings: ${JSON.stringify({ findJudge: FAIRPLAY.signals.findJudge, findDeep: FAIRPLAY.signals.findDeep, findDeep3: FAIRPLAY.signals.findDeep3, soloFound: FAIRPLAY.signals.soloFound, soloDeep: FAIRPLAY.signals.soloDeep, soloDeep3: FAIRPLAY.signals.soloDeep3 })}.`);
out("");
out("How well it fits: honest players' actual chance of picking the deep re-check's best, by the crowd's rate for that move (the model's chance in brackets):");
out("");
{
  const bins = [0, 0.05, 0.1, 0.2, 0.35, 0.5, 1.01];
  out(`| Strength | ${bins.slice(0, -1).map((b, i) => `crowd ${Math.round(b * 100)}-${Math.min(100, Math.round(bins[i + 1]! * 100))}%`).join(" | ")} |`);
  out(`| --- | ${bins.slice(0, -1).map(() => "---").join(" | ")} |`);
  for (const kind of HONEST.filter((k) => k.elo >= 1500)) {
    const acc = bins.slice(0, -1).map(() => ({ n: 0, hit: 0, model: 0 }));
    for (const sub of honest.filter((x) => x.kind === kind))
      for (const raw of sub.movesByMatch)
        for (const m of raw) {
          if (skipReason(m) !== null || m.crowd < FAIRPLAY.signals.minCrowd) continue;
          const pos = byFen.get(m.fen)!;
          const found = m.picks?.[pos.cheat[0]!] ?? 0;
          const c = found / m.crowd;
          const i = bins.findIndex((b, j) => c >= b && c < bins[j + 1]!);
          acc[i]!.n++;
          if (m.move === pos.cheat[0]) acc[i]!.hit++;
          acc[i]!.model += honestChance(m.crowd, found, kind.elo, base.signals.findDeep, base.signals.soloDeep, base.signals);
        }
    out(`| ${kind.elo} | ${acc.map((a) => (a.n ? `${(a.hit / a.n).toFixed(2)} (${(a.model / a.n).toFixed(2)})` : "–")).join(" | ")} |`);
  }
}
out("");

// Every threshold set, compared in one table; then the full tables for the one in settings.ts.
out("## Threshold sets compared");
out("");
out("Full engine user: review and ban within 1 / 2 / 5 matches. Others: review / ban within 5. Honest players: per 1,000 within 5 matches.");
out("");
out("| Set | Full engine: review | Full engine: ban | 20-40% (1500) | 20-40% (1900) | Hard positions only | When its move is a mistake | Blended | Honest review /1000 (1500 / 2000 / 2400 / 2700) | Honest bans /1000 (any strength) |");
out("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const set of SETS) {
  for (const subs of [honest, cheaters]) evaluate(subs, set.st);
  const of = (i: number) => cheaters.filter((s) => s.kind === CHEATERS[i]);
  const h = (elo: number) => honest.filter((s) => s.kind.elo === elo);
  const rb = (i: number) => `${pct(reached(of(i), "review", 5))} / ${pct(reached(of(i), "ban", 5))}`;
  const bans = HONEST.reduce((t, k) => t + h(k.elo).filter((x) => x.levels[MATCHES - 1] === "ban").length, 0);
  out(
    `| ${set.name} | ${[1, 2, 5].map((k) => pct(reached(of(0), "review", k))).join(" / ")} | ${[1, 2, 5].map((k) => pct(reached(of(0), "ban", k))).join(" / ")} | ${rb(1)} | ${rb(2)} | ${rb(3)} | ${rb(4)} | ${rb(5)} | ${[1500, 2000, 2400, 2700].map((e) => per1000(reached(h(e), "review", MATCHES))).join(" / ")} | ${bans} of ${(HONEST.length * nHonest).toLocaleString("en-US")} |`,
  );
}
out("");

const chosen = SETS[0]!;
for (const subs of [honest, cheaters, cheatersSame, honestFew, cheatersFew]) evaluate(subs, chosen.st);
out(`## The thresholds in settings.ts, in full`);
out("");
out("### Catch rate per cheater type (a second device: no look-aways)");
out("");
out("Review: a person looks and results are held. Ban: automatic. Within 1, 2 and 5 matches.");
out("");
out("| Cheater | Counted moves (median) | Match strength (median) | Deep matches (median) | Review 1 / 2 / 5 | Ban 1 / 2 / 5 | Same phone: ban 2 / 5 |");
out("| --- | --- | --- | --- | --- | --- | --- |");
for (const kind of CHEATERS) {
  const subs = cheaters.filter((s) => s.kind === kind);
  const same = cheatersSame.filter((s) => s.kind === kind);
  const perfs = subs.flatMap((s) => s.summaries.map((x) => x.perf ?? 0));
  const cnt = subs.flatMap((s) => s.summaries.map((x) => x.counted));
  const deep = subs.flatMap((s) => s.summaries.filter((x) => x.deepChecked).map((x) => x.deepMatch / x.deepChecked));
  out(
    `| ${kind.name} | ${quant(cnt, 0.5)} | ${quant(perfs, 0.5)} | ${deep.length ? pct(quant(deep, 0.5)) : "–"} | ${[1, 2, 5].map((k) => pct(reached(subs, "review", k))).join(" / ")} | ${[1, 2, 5].map((k) => pct(reached(subs, "ban", k))).join(" / ")} | ${[2, 5].map((k) => pct(reached(same, "ban", k))).join(" / ")} |`,
  );
}
out("");
out(`### Honest players: false flags per 1,000 players within ${MATCHES} matches (${nHonest.toLocaleString("en-US")} players each)`);
out("");
out("| Strength (UCI_Elo) | Counted moves (median) | Match strength (median / 99th pct) | Watch | Review | Ban |");
out("| --- | --- | --- | --- | --- | --- |");
for (const kind of HONEST) {
  const subs = honest.filter((s) => s.kind === kind);
  const perfs = subs.flatMap((s) => s.summaries.map((x) => x.perf ?? 0));
  const cnt = subs.flatMap((s) => s.summaries.map((x) => x.counted));
  out(
    `| ${kind.elo} | ${quant(cnt, 0.5)} | ${quant(perfs, 0.5)} / ${quant(perfs, 0.99)} | ${per1000(reached(subs, "watch", MATCHES))} | ${per1000(reached(subs, "review", MATCHES))} | ${per1000(reached(subs, "ban", MATCHES))} |`,
  );
}
out("");
out("### Few people in the match (no crowd rates: mostly bots)");
out("");
out(`| Who | Review within 5 | Ban within 2 / 5 |`);
out("| --- | --- | --- |");
for (const kind of CHEATERS) {
  const subs = cheatersFew.filter((s) => s.kind === kind);
  out(`| ${kind.name} | ${pct(reached(subs, "review", 5))} | ${[2, 5].map((k) => pct(reached(subs, "ban", k))).join(" / ")} |`);
}
for (const kind of HONEST.filter((k) => k.elo >= 2200)) {
  const subs = honestFew.filter((s) => s.kind === kind);
  out(`| Honest ${kind.elo} (per 1,000; ${subs.length.toLocaleString("en-US")} players) | ${per1000(reached(subs, "review", 5))} | ${per1000(reached(subs, "ban", 2))} / ${per1000(reached(subs, "ban", 5))} |`);
}
out("");
out("### Match scores and evidence (median / 90th / 99th / max)");
out("");
out("| Who | Score | Evidence | Strength points | Time points |");
out("| --- | --- | --- | --- | --- |");
const dist = (subs: Subject[], f: (x: FairSummary) => number) => {
  const xs = subs.flatMap((s) => s.summaries.map(f));
  return `${quant(xs, 0.5).toFixed(1)} / ${quant(xs, 0.9).toFixed(1)} / ${quant(xs, 0.99).toFixed(1)} / ${Math.max(...xs).toFixed(1)}`;
};
for (const kind of [...HONEST.filter((k) => k.elo >= 2000), ...CHEATERS]) {
  const subs = [...honest, ...cheaters].filter((s) => s.kind === kind);
  out(`| ${kind.name} | ${dist(subs, (x) => x.score)} | ${dist(subs, (x) => x.evidence)} | ${dist(subs, (x) => x.parts.perf)} | ${dist(subs, (x) => x.parts.time)} |`);
}
out("");
out("## What this can't tell");
out("");
out("- Real people aren't Stockfish at a lower strength: their mistakes are more human (missed tactics), and how often a strong person matches the engine may differ. The evidence model is fitted on the emulated players; refit it from real games (`honestChance`) once there are enough flagged-and-cleared matches, and keep auto-bans conservative until then.");
out(`- How often a real cheater's engine agrees with our deep re-check is assumed (${Math.round(ENGINE_AGREE * 100)}%). Lower agreement means slower bans, never more false ones.`);
out("- Timing and look-aways are modelled, not measured; they add few points and never ban on their own.");
out("- A cheater using the engine on a fifth to two fifths of moves plays like a stronger honest player: no move-by-move statistic can tell them apart without far more matches. Reports and a strength far above their own history are what catch them.");
out("");

writeFileSync(root + "reports/fairplay.md", lines.join("\n"));
console.log(lines.join("\n"));
