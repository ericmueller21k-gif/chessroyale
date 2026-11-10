/**
 * The cheater demo (Eric, Nov 10: "make a deliberate bot ... one that's like clearly cheating ... and then one that's maybe just like
 * Maia at a strong level ... see everything play out as if it were real people"; docs/decisions/2026-11-10-cheater-demo.md).
 *
 * Four test accounts (server/src/test-accounts.ts: dummy emails at test.hunchess, marked test, off public rankings) play real
 * Crowd 50 v 50 matches through PLAY, as four people on four computers would: the real queue, the lobby's WebSocket, bots in the
 * other seats.
 *   - Engine Eddie: Stockfish's top move every pick (the full-network build, about a million nodes): the cheater.
 *   - Strong Sam:   Maia-3 at its strongest (2500, its likeliest move): a strong human-like player who shouldn't be pooled.
 *   - Judge Jo, Judge Jay: everyday players (Maia at 1500, drawn as people play), so each match has devices of four accounts.
 * Every one of them answers the lobby's judge work as an honest device does (the app's own code, net.ts: judge, planBots,
 * hostScore, on Node's Stockfish), so the match is vouched (two devices of two accounts on every job). Afterwards it prints each
 * account's fair-play numbers and case (GET /api/admin/test-accounts), as the review page (/admin/fairplay) shows them.
 *
 *   npx tsx scripts/cheater-demo.ts [--url https://hunchess.com] [--matches 3] [--until-pooled] [--wait-pool 45] [--out FILE]
 *   npx tsx scripts/cheater-demo.ts --report          # the accounts' numbers and cases only
 *   npx tsx scripts/cheater-demo.ts --delete          # deletes every test account and its data (fair play's file too)
 *
 * Options:
 *   --url URL        the site (default https://hunchess.com). Only https://hunchess.com gets the Cloudflare Access service token
 *                    (CF_ACCESS_CLIENT_ID2 / CF_ACCESS_CLIENT_SECRET2, sent as headers, never printed); a local server (wrangler dev
 *                    under Playwright's webServer) takes the e2e's key instead (E2E_SQL_KEY, set by playwright.config.ts).
 *   --matches N      matches to play, one after another (default 1)
 *   --until-pooled   stop once Engine Eddie is in the engine pool (checked after each match)
 *   --wait-pool M    after the last match, keep reading the report each minute for up to M minutes until Eddie is pooled (the deep
 *                    re-check runs on the Worker's 15-minute schedule; default 0)
 *   --who LIST       which accounts play (default eddie,sam,jo,jay)
 *   --pool NAME      a queue of its own (a test switch: local servers only)
 *   --out FILE       also write the report there (Markdown)
 *   --timeout S      give up on a match after this long (default 3600)
 *
 * The boss final: if the crowd votes it, everyone here resigns as its intro begins (results and fair play are recorded as they leave:
 * the boss's moves come from a host device, which this script doesn't play, and a boss move one device decides alone would make the
 * whole match unvouched, its fair play unrecorded).
 */
import WebSocket from "ws";
import { DEFAULT_SETTINGS, JUDGES, PREGAME_VOTES, botChoose, botLeanFor, botThinkMs, modeSettings, type Settings } from "@chessroyale/core";
import {
  HumanUciEngine,
  TopMovesCache,
  allowedSearch,
  deepCheck,
  jobEscapes,
  jobOffers,
  jobRanked,
  judgeBotPicks,
  judgeCandidates,
  legalMoves,
  recheckCloseCalls,
  repliesFrom,
  runQuickJob,
  type BoardScore,
  type ClientMessage,
  type JudgeJob,
  type JudgeReport,
  type ScoreJob,
  type ServerMessage,
  type UciEngine,
} from "@chessroyale/chess";
import { STOCKFISH_FULL_BUILD, createNodeEngine } from "@chessroyale/chess/node";
import { writeFileSync } from "node:fs";
import { maiaProcess } from "../packages/sim/src/maia-process.ts";

// ---------------- Options ----------------

const args = process.argv.slice(2);
const arg = (k: string, d?: string) => {
  const i = args.indexOf(`--${k}`);
  if (i < 0) return d;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : "1";
};
const fail = (message: string): never => {
  console.error(`cheater-demo: ${message}`);
  process.exit(1);
};
let base: URL;
try {
  base = new URL(arg("url", "https://hunchess.com")!);
} catch {
  fail("--url isn't a URL.");
}
const live = base!.protocol === "https:" && base!.hostname === "hunchess.com" && base!.port === "" && !base!.username && !base!.password;
const origin = base!.origin;
/** Headers every request carries: Access's service token, to https://hunchess.com only (never printed). */
const accessHeaders: Record<string, string> = {};
/** Headers the admin route needs besides: the e2e's key, to a local server only. */
const adminHeaders: Record<string, string> = {};
if (live) {
  const id = process.env.CF_ACCESS_CLIENT_ID2;
  const secret = process.env.CF_ACCESS_CLIENT_SECRET2;
  if (!id || !secret) fail("Set CF_ACCESS_CLIENT_ID2 and CF_ACCESS_CLIENT_SECRET2 (the Cloudflare Access service token).");
  accessHeaders["CF-Access-Client-Id"] = id!;
  accessHeaders["CF-Access-Client-Secret"] = secret!;
} else {
  if (!/^(localhost|127\.0\.0\.1)$/.test(base!.hostname)) fail("only https://hunchess.com or a local server (localhost).");
  if (process.env.E2E_SQL_KEY) adminHeaders["x-e2e-sql"] = process.env.E2E_SQL_KEY;
}
const matches = Math.max(0, Number(arg("matches", "1")) || 0);
const untilPooled = !!arg("until-pooled");
const waitPoolMin = Math.max(0, Number(arg("wait-pool", "0")) || 0);
const testPool = arg("pool");
const out = arg("out");
const timeoutMs = (Number(arg("timeout", "3600")) || 3600) * 1000;

const t0 = Date.now();
const log = (line: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(5)} s  ${line}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// ---------------- The accounts ----------------

type Style = "engine" | "strong" | "everyday";
interface Persona {
  key: string;
  name: string;
  style: Style;
}
const PERSONAS: Persona[] = [
  { key: "eddie", name: "Engine Eddie", style: "engine" },
  { key: "sam", name: "Strong Sam", style: "strong" },
  { key: "jo", name: "Judge Jo", style: "everyday" },
  { key: "jay", name: "Judge Jay", style: "everyday" },
];
const who = (arg("who", "eddie,sam,jo,jay") ?? "").split(",").map((s) => s.trim().toLowerCase());
const playing = PERSONAS.filter((p) => who.includes(p.key));

async function http(method: string, path: string, opts: { cookie?: string; body?: unknown; admin?: boolean } = {}): Promise<{ status: number; body: any; setCookie: string | null }> {
  const res = await fetch(origin + path, {
    method,
    headers: {
      ...accessHeaders,
      ...(opts.admin ? adminHeaders : {}),
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  if (live && res.status >= 300 && res.status < 400) fail("Access turned the service token away (a redirect to its login): check the token.");
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { text: text.slice(0, 200) };
  }
  return { status: res.status, body, setCookie: res.headers.get("set-cookie") };
}

/** The named test account, signed in: its session cookie (and the device marker /api/me gives, as a browser keeps). */
async function signIn(p: Persona): Promise<{ id: string; cookie: string }> {
  const r = await http("POST", "/api/admin/test-accounts", { body: { name: p.name }, admin: true });
  if (r.status === 404) fail("the test accounts' route answered Not found: not deployed there yet, or this caller isn't let in (Access token / E2E_SQL_KEY).");
  if (r.status !== 200) fail(`making ${p.name} failed (${r.status}): ${r.body?.message ?? ""}`);
  const session = r.setCookie?.match(/hc_session=([^;]+)/)?.[1];
  if (!session) fail(`no session for ${p.name}`);
  let cookie = `hc_session=${session}`;
  const me = await http("GET", "/api/me", { cookie });
  const device = me.setCookie?.match(/hc_device=([^;]+)/)?.[1];
  if (device) cookie += `; hc_device=${device}`;
  if (me.status !== 200 || me.body?.user?.id !== r.body.id) fail(`${p.name}'s session didn't sign in (${me.status}).`);
  return { id: r.body.id as string, cookie };
}

// ---------------- Engines ----------------

/** The crowd's settings, for the bots' picks when this device scores a round alone (the app's own `settings`). */
const SETTINGS: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd", { augments: true }) };

let maia: HumanUciEngine | null = null;
async function startMaia(): Promise<HumanUciEngine | null> {
  try {
    const m = new HumanUciEngine(maiaProcess());
    if (await m.init(120_000)) return m;
    log(`Maia didn't load (${m.error ?? "no reason"}): Stockfish's top three stand in`);
  } catch (e) {
    log(`Maia didn't start (${(e as Error).message}): Stockfish's top three stand in`);
  }
  return null;
}

/** Eddie's engine: the full-network Stockfish (the deep re-check's kind), sized to the move's clock. */
let eddieEngine: UciEngine | null = null;
let eddieNps = 300_000;

// ---------------- One seat: a person on a computer ----------------

interface MatchOutcome {
  persona: Persona;
  code: string | null;
  how: "results" | "resigned" | "error" | "timeout" | "closed";
  placement?: number;
  ranked?: boolean;
  unvouched?: boolean;
  picks: number;
  note?: string;
}

class Seat {
  private ws: WebSocket | null = null;
  private code: string | null = null;
  private playerId: string | null = null;
  private seatToken: string | undefined;
  private offset = 0;
  private picked = new Set<string>();
  private voted = new Set<string>();
  private judged = 0;
  private picks = 0;
  private key: string | null = null;
  private reconnects = 0;
  private done: ((o: MatchOutcome) => void) | null = null;
  private finished = false;
  private resigning = false;
  private top = new TopMovesCache(DEFAULT_SETTINGS.botCandidateMoves);
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(
    readonly persona: Persona,
    private readonly cookie: string,
    private readonly engine: UciEngine,
    private readonly nps: number,
  ) {}

  private serverNow() {
    return Date.now() + this.offset;
  }
  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, Math.max(0, ms)));
  }

  /** PLAY, the lobby, the match: resolves when it's over for this seat. */
  async play(): Promise<MatchOutcome> {
    const q = new URLSearchParams({ mode: "crowd" });
    if (testPool) q.set("pool", testPool);
    for (let tries = 0; tries < 200 && !this.code; tries++) {
      const r = await http("POST", `/api/play?${q}`, { cookie: this.cookie });
      if (r.body?.code) this.code = r.body.code as string;
      else if (r.body?.busy) {
        if (r.body.ticket) q.set("ticket", r.body.ticket);
        await sleep(Number(r.body.retryMs) || 3000);
      } else if (r.status === 429) await sleep(Number(r.body?.retryMs) || 5000);
      else return { persona: this.persona, code: null, how: "error", picks: 0, note: `PLAY ${r.status}: ${r.body?.message ?? ""}` };
    }
    if (!this.code) return { persona: this.persona, code: null, how: "error", picks: 0, note: "no lobby" };
    log(`${this.persona.name}: lobby ${this.code}`);
    return new Promise<MatchOutcome>((resolve) => {
      this.done = resolve;
      this.later(timeoutMs, () => this.finish("timeout"));
      this.connect();
    });
  }

  private finish(how: MatchOutcome["how"], extra: Partial<MatchOutcome> = {}) {
    if (this.finished) return;
    this.finished = true;
    for (const t of this.timers) clearTimeout(t);
    this.ws?.close();
    this.done?.({ persona: this.persona, code: this.code, how, picks: this.picks, ...extra });
  }

  private connect() {
    const ws = new WebSocket(`${origin.replace(/^http/, "ws")}/api/lobby/${this.code}/ws`, { headers: { ...accessHeaders, cookie: this.cookie } });
    this.ws = ws;
    ws.on("open", () => {
      this.reconnects = 0;
      // (A computer; no `seeded`: this script never plays or checks a boss's moves.)
      this.send({ t: "hello", token: this.seatToken, name: this.persona.name, device: "computer", look: {}, evalBar: false });
    });
    ws.on("message", (data: unknown) => {
      let m: ServerMessage;
      try {
        m = JSON.parse(String(data)) as ServerMessage;
      } catch {
        return;
      }
      void this.onMessage(m).catch((e: unknown) => log(`${this.persona.name}: ${String(e)}`));
    });
    ws.on("unexpected-response", (_req: unknown, res: { statusCode?: number }) => log(`${this.persona.name}: the lobby refused the connection (${res.statusCode})`));
    ws.on("error", () => undefined);
    ws.on("close", () => {
      if (this.finished) return;
      if (++this.reconnects > 8) return this.finish("error", { note: "connection lost" });
      this.later(Math.min(8000, 500 * 2 ** this.reconnects), () => this.connect());
    });
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private async onMessage(m: ServerMessage) {
    if (typeof (m as { now?: number }).now === "number") this.offset = (m as { now: number }).now - Date.now();
    switch (m.t) {
      case "welcome":
        this.playerId = m.playerId;
        this.seatToken = m.token;
        // This device's speed, so the lobby shares out the judging (as the app's reportSpeed).
        this.send({ t: "speed", nps: this.nps });
        if (this.resigning) this.send({ t: "resign" });
        return;
      case "error":
        if (m.left) return this.finish("resigned", { note: m.left.how });
        if (m.ended) return this.finish("closed", { note: "ended" });
        return this.finish("error", { note: m.message });
      case "closed":
        return this.finish("closed", { note: m.reason });
      case "resigned":
        return this.finish("resigned", { placement: m.result?.placement, note: m.how });
      case "results":
        return this.finish("results", { placement: this.playerId ? m.placements[this.playerId] : undefined, ranked: m.ranked, unvouched: !!m.unvouched });
      case "vote":
        return this.vote(m.vote);
      case "boss":
        // (The boss final: everyone here leaves as it begins; see the header.)
        if (!this.resigning) {
          this.resigning = true;
          log(`${this.persona.name}: the boss final begins: resigning (results and fair play are recorded as they leave)`);
          this.send({ t: "resign" });
        }
        return;
      case "round":
        this.key = m.key;
        if (m.boss && !this.resigning) {
          this.resigning = true;
          this.send({ t: "resign" });
          return;
        }
        if (!m.alive || m.watching || !m.board || this.picked.has(m.key)) return;
        this.picked.add(m.key);
        return this.pick(m.key, m.board.fen, m.startsAt, m.deadline);
      case "prefetch":
        this.top.prefetch([this.engine], m.fens);
        if (m.plan) await this.planBots(m.plan);
        return;
      case "judge":
        return this.judge(m.key, m.jobs);
      case "scoreRequest":
        return this.hostScore(m.key, m.jobs, !!m.serverRecheck);
    }
  }

  private vote(v: Extract<ServerMessage, { t: "vote" }>["vote"]) {
    if (v.result !== null || this.voted.has(v.key)) return;
    this.voted.add(v.key);
    const def = PREGAME_VOTES[v.index];
    const want = { format: "team", start: "normal", speed: "blitz" }[def?.id ?? ""] ?? "";
    const option = Math.max(0, def?.options.findIndex((o) => o.id === want) ?? 0);
    const until = v.until - this.offset - Date.now();
    this.later(rand(800, Math.max(900, Math.min(4000, until - 800))), () => this.send({ t: "vote", key: v.key, option }));
  }

  /** This person's move, sent after a person's think time (within their deadline). */
  private async pick(key: string, fen: string, startsAt: number, deadline: number) {
    const startIn = startsAt - this.serverNow();
    const clockMs = Math.max(2000, deadline - startsAt);
    const latest = clockMs - 1500;
    const think = this.persona.style === "engine" ? rand(2500, 6000) : this.persona.style === "strong" ? rand(4000, 10_000) : rand(3000, 11_000);
    // (When to send it, on this machine's clock: after the think time, or as soon as the move is found if that takes longer.)
    const target = Date.now() + startIn + Math.min(think, latest);
    const move = await this.choose(fen, clockMs).catch(() => null);
    const fallback = legalMoves(fen)[0];
    const chosen = move ?? (await this.top.get(this.engine, fen).catch(() => []))[0]?.move ?? fallback;
    if (!chosen) return;
    this.later(target - Date.now(), () => {
      if (this.key !== key || this.finished) return;
      this.picks++;
      this.send({ t: "pick", key, move: chosen });
    });
  }

  private async choose(fen: string, clockMs: number): Promise<string | null> {
    if (this.persona.style === "engine" && eddieEngine) {
      // Stockfish's top move: as deep as about half the move's clock allows (a million nodes or so on a computer).
      const nodes = Math.round(Math.max(300_000, Math.min(1_500_000, eddieNps * Math.min(6, (clockMs / 1000) * 0.45))));
      const [best] = await eddieEngine.topMovesAt(fen, 1, nodes);
      return best?.move ?? null;
    }
    const strong = this.persona.style === "strong";
    if (maia?.ready()) {
      // Sam: Maia's likeliest move at its top rating; an everyday player: drawn from its moves at 1500, as people vary.
      const a = await maia.candidates(fen, strong ? 2500 : 1500, null, strong ? { temperature: 0, topP: 1, multipv: 5 } : { temperature: 1, topP: 0.95, multipv: 5 });
      if (a?.best) return a.best;
    }
    // (No Maia: Stockfish's top three, weighted, for Sam; one of its top five for the others.)
    const top = await this.top.get(this.engine, fen);
    if (!top.length) return null;
    const weights = strong ? [0.6, 0.25, 0.15] : [0.3, 0.25, 0.2, 0.15, 0.1];
    let x = Math.random() * weights.slice(0, top.length).reduce((a, b) => a + b, 0);
    for (let i = 0; i < Math.min(top.length, weights.length); i++) if ((x -= weights[i]!) <= 0) return top[i]!.move;
    return top[0]!.move;
  }

  // ---- An honest device's work: as the app's net.ts (judge, planBots, hostScore), on this seat's Stockfish ----

  private async judge(key: string, jobs: JudgeJob[]) {
    const quick = new Map<string, JudgeReport>();
    for (const job of jobs) {
      try {
        const report = await runQuickJob(this.engine, job, this.top.get(this.engine, job.fen));
        quick.set(job.id, report);
        this.judged++;
        this.send({ t: "judged", key, id: job.id, report });
      } catch {
        // (No answer: the lobby gives the job to someone else.)
      }
    }
    for (const job of jobs.filter((j) => j.recheck && quick.has(j.id))) {
      try {
        const deep = await deepCheck(this.engine, job, quick.get(job.id)!);
        if (deep) this.send({ t: "judgedDeep", key, id: job.id, deep });
      } catch {
        // (As above.)
      }
    }
  }

  private async planBots(plan: NonNullable<Extract<ServerMessage, { t: "prefetch" }>["plan"]>) {
    try {
      const engine = this.engine;
      if (plan.seed !== undefined && plan.rules) {
        const top = await this.top.get(engine, plan.fen);
        const bots = plan.bots.map((b) => ({ skill: b.skill, powerUps: b.powerUps ?? 0 }));
        const job = { fen: plan.fen, picks: [], bots, seed: plan.seed, rules: plan.rules, ...(plan.barred ? { barred: plan.barred } : {}), ...(plan.allowed ? { allowed: plan.allowed } : {}), ...(plan.burn ? { burn: plan.burn } : {}), ...(plan.race ? { race: plan.race } : {}) } as unknown as JudgeJob;
        const open = await allowedSearch(engine, job, top);
        const offers = open ? [] : jobOffers(job).filter((mv) => !top.some((t) => t.move === mv));
        const chosen = judgeBotPicks(job, top, open ?? (offers.length ? await engine.scoreMoves(plan.fen, offers) : []));
        const picks = Object.fromEntries(plan.bots.map((b, i) => [b.id, chosen.picks[i]!]));
        if (this.key === plan.key) this.send({ t: "botPlan", key: plan.key, picks, powerUps: chosen.powerUps.map((i) => plan.bots[i]!.id) });
        return;
      }
      const all = await this.top.get(engine, plan.fen);
      const limits = { ...(plan.barred ? { barred: plan.barred } : {}), ...(plan.allowed ? { allowed: plan.allowed } : {}) };
      const baseMoves = judgeCandidates(limits, all, (await allowedSearch(engine, { ...limits, fen: plan.fen }, all)) ?? []);
      const offers = jobOffers({ fen: plan.fen, race: plan.race, ...limits }).filter((mv) => !baseMoves.some((t) => t.move === mv));
      const top = jobRanked({ fen: plan.fen, burn: plan.burn, race: plan.race }, [...baseMoves, ...(offers.length ? await engine.scoreMoves(plan.fen, offers) : [])]);
      const best = top[0]?.expected ?? 0.5;
      const candidates = top.map((mv) => ({ move: mv.move, loss: Math.max(0, (best - mv.expected) * 100) }));
      const legal = plan.allowed ?? legalMoves(plan.fen).filter((mv) => mv !== plan.barred);
      const picks: Record<string, string> = {};
      const powerUps: string[] = [];
      const lean = botLeanFor(Math.random, candidates, SETTINGS);
      for (const b of plan.bots) {
        const choice = botChoose(Math.random, candidates, { skill: b.skill, powerUps: b.powerUps ?? 0 }, legal, SETTINGS, lean);
        picks[b.id] = choice.move;
        if (choice.usedPowerUp) powerUps.push(b.id);
      }
      if (this.key === plan.key) this.send({ t: "botPlan", key: plan.key, picks, powerUps });
    } catch {
      // No plan: the bots pick at scoring time instead.
    }
  }

  private async hostScore(key: string, jobs: ScoreJob[], serverRecheck: boolean) {
    const engine = this.engine;
    const out: BoardScore[] = [];
    for (const job of jobs) {
      const all = await this.top.get(engine, job.fen);
      const limits = { ...(job.barred ? { barred: job.barred } : {}), ...(job.allowed ? { allowed: job.allowed } : {}) };
      const humanMoves = Object.values(job.humanPicks).filter((mv): mv is string => !!mv);
      const open = (await allowedSearch(engine, { ...limits, fen: job.fen, picks: humanMoves }, all)) ?? [];
      const top = judgeCandidates(limits, all, open);
      const best = top[0]!.expected;
      const offers = jobOffers({ fen: job.fen, race: job.race, ...limits }).filter((mv) => !top.some((t) => t.move === mv));
      const offered = offers.length ? await engine.scoreMoves(job.fen, offers) : [];
      const ranked = jobRanked(job, [...top, ...offered]);
      const candidates = ranked.map((mv) => ({ move: mv.move, loss: Math.max(0, (ranked[0]!.expected - mv.expected) * 100) }));
      const legal = job.allowed ?? legalMoves(job.fen).filter((mv) => mv !== job.barred);
      const botPicks: Record<string, string> = {};
      const botThink: Record<string, number> = {};
      const botPowerUps: string[] = [];
      const lean = botLeanFor(Math.random, candidates, SETTINGS);
      for (const b of job.bots) {
        const planned = job.botPlan?.[b.id];
        if (planned) {
          botPicks[b.id] = planned;
          if (job.botPlanPowerUps?.includes(b.id)) botPowerUps.push(b.id);
          botThink[b.id] = botThinkMs(Math.random, SETTINGS);
          continue;
        }
        const choice = botChoose(Math.random, candidates, { skill: b.skill, powerUps: b.powerUps ?? 0 }, legal, SETTINGS, lean);
        botPicks[b.id] = choice.move;
        if (choice.usedPowerUp) botPowerUps.push(b.id);
        botThink[b.id] = botThinkMs(Math.random, SETTINGS);
      }
      const expectedAfter: Record<string, number> = Object.fromEntries(top.map((mv) => [mv.move, mv.expected]));
      for (const mv of open) expectedAfter[mv.move] = mv.expected;
      for (const mv of offered) expectedAfter[mv.move] = mv.expected;
      const escapes = jobEscapes({ fen: job.fen, burn: job.burn, race: job.race, allowed: job.allowed, barred: job.barred });
      const missing = [...new Set([...Object.values(job.humanPicks), ...Object.values(botPicks), ...escapes])].filter((mv): mv is string => !!mv && expectedAfter[mv] === undefined);
      const extra = [...open, ...offered, ...(missing.length ? await engine.scoreMoves(job.fen, missing) : [])];
      for (const s of extra) expectedAfter[s.move] = s.expected;
      const { replies, mates } = repliesFrom([top, extra]);
      const people = Object.values(job.humanPicks).some((mv) => !!mv);
      const checked =
        serverRecheck || !people
          ? { bestMove: top[0]!.move, bestExpected: best, expectedAfter }
          : await recheckCloseCalls(engine, job.fen, { bestMove: top[0]!.move, bestExpected: best, expectedAfter }, [...Object.values(job.humanPicks), ...Object.values(botPicks)], SETTINGS, job.priority);
      out.push({ boardId: job.boardId, bestMove: checked.bestMove, bestExpected: checked.bestExpected, expectedAfter: checked.expectedAfter, botPicks, botThinkMs: botThink, botPowerUps, replies, mates });
    }
    this.send({ t: "scores", key, boards: out });
  }

  get jobsJudged() {
    return this.judged;
  }
}

// ---------------- The report ----------------

interface ReportAccount {
  id: string;
  name: string;
  email: string;
  case: { status: string; reason: string | null; opened_at: number; decided_at: number | null } | null;
  log: { at: number; action: string; by: string; reason: string | null }[];
  matches: { lobby: string | null; playedAt: number; moves: number | null; counted: number; perf: number | null; found: number | null; evidence: number | null; deepChecked: number; deepMatch: number; deepDone: boolean; score: number; level: string }[];
  results: { played_at: number; placement: number; players: number }[];
}

async function report(): Promise<ReportAccount[]> {
  const r = await http("GET", "/api/admin/test-accounts", { admin: true });
  if (r.status !== 200) fail(`the report answered ${r.status}${r.status === 404 ? " (not deployed there yet, or this caller isn't let in)" : ""}.`);
  return r.body.accounts as ReportAccount[];
}

const utc = (t: number) => new Date(t).toISOString().slice(0, 16).replace("T", " ");
const r1 = (x: number | null) => (x === null ? "–" : String(Math.round(x * 10) / 10));

function reportText(accounts: ReportAccount[]): string {
  const lines = [`## Test accounts on ${origin} (${utc(Date.now())} UTC)`, ""];
  lines.push("| Account | Matches (fair play) | Case | Why |", "| --- | --- | --- | --- |");
  for (const a of accounts) {
    lines.push(`| ${a.name} | ${a.matches.length} | ${a.case?.status ?? "none"} | ${(a.case?.reason ?? "").replace(/\|/g, "/").slice(0, 160)} |`);
  }
  lines.push("", "| Account | Lobby | Played | Counted | Found | Strength | Evidence | Deep best / checked | Score | Level |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const a of accounts) {
    for (const m of a.matches) {
      lines.push(
        `| ${a.name} | ${m.lobby ?? "–"} | ${utc(m.playedAt)} | ${m.counted}/${m.moves ?? "?"} | ${m.found ?? "–"} | ${m.perf ?? "–"} | ${r1(m.evidence)} | ${m.deepMatch}/${m.deepChecked}${m.deepDone ? "" : " (in progress)"} | ${r1(m.score)} | ${m.level} |`,
      );
    }
  }
  lines.push("", "Case logs:");
  for (const a of accounts) for (const l of a.log) lines.push(`- ${a.name}, ${utc(l.at)}: ${l.action} by ${l.by}${l.reason ? `: ${l.reason.slice(0, 200)}` : ""}`);
  return lines.join("\n");
}

const eddiePooled = (accounts: ReportAccount[]) => accounts.find((a) => a.name === "Engine Eddie")?.case?.status === "pool";

// ---------------- Main ----------------

if (arg("delete")) {
  const r = await http("DELETE", "/api/admin/test-accounts", { admin: true });
  if (r.status !== 200) fail(`deleting answered ${r.status}.`);
  console.log(`Deleted ${r.body.deleted} test account(s) and everything kept about them.`);
  process.exit(0);
}

if (!arg("report") && matches > 0) {
  if (!playing.length) fail("--who names nobody (eddie, sam, jo, jay).");
  const accounts = new Map<string, { id: string; cookie: string }>();
  for (const p of playing) accounts.set(p.key, await signIn(p));
  log(`signed in: ${playing.map((p) => `${p.name} (${accounts.get(p.key)!.id})`).join(", ")}`);
  if (playing.some((p) => p.style !== "engine")) maia = await startMaia();
  if (playing.some((p) => p.style === "engine")) {
    eddieEngine = await createNodeEngine({ nodes: 1_000_000, hashMb: 64 }, STOCKFISH_FULL_BUILD);
    eddieNps = await eddieEngine.speed(JUDGES.benchNodes);
  }
  // Each computer's own Stockfish for the lobby's work (the browser's build), and its speed check.
  const engines = new Map<string, { engine: UciEngine; nps: number }>();
  for (const p of playing) {
    const engine = await createNodeEngine({ nodes: DEFAULT_SETTINGS.engineNodes, hashMb: DEFAULT_SETTINGS.engineHashMb });
    engines.set(p.key, { engine, nps: await engine.speed(JUDGES.benchNodes) });
  }
  log(`engines ready (Maia ${maia ? "loaded" : "off"}; Eddie's search ${Math.round(eddieNps / 1000)}k nodes/s)`);

  for (let n = 1; n <= matches; n++) {
    log(`match ${n} of ${matches}: PLAY`);
    const seats = playing.map((p) => new Seat(p, accounts.get(p.key)!.cookie, engines.get(p.key)!.engine, engines.get(p.key)!.nps));
    const outcomes = await Promise.all(seats.map((s) => s.play()));
    for (const [i, o] of outcomes.entries()) {
      log(
        `  ${o.persona.name}: ${o.how}${o.code ? ` in ${o.code}` : ""}${o.placement ? `, placed ${o.placement}` : ""}, ${o.picks} picks, ${seats[i]!.jobsJudged} jobs judged${o.unvouched ? ", UNVOUCHED (no fair play recorded)" : ""}${o.ranked !== undefined ? `, ranked ${o.ranked}` : ""}${o.note ? ` (${o.note})` : ""}`,
      );
    }
    // (Results are written as the lobby wraps up: a moment before the report sees them.)
    await sleep(5000);
    const now = await report();
    console.log(reportText(now));
    if (untilPooled && eddiePooled(now)) {
      log("Engine Eddie is in the engine pool: stopping.");
      break;
    }
  }
  for (const { engine } of engines.values()) engine.close();
  eddieEngine?.close();
  maia?.close();
}

let final = await report();
for (let waited = 0; waitPoolMin > 0 && !eddiePooled(final) && waited < waitPoolMin; waited++) {
  if (waited === 0) log(`waiting up to ${waitPoolMin} min for the deep re-check (the Worker's 15-minute schedule) to pool Eddie`);
  await sleep(60_000);
  final = await report();
}
const text = reportText(final);
console.log(text);
if (out) writeFileSync(out, text + "\n");
process.exit(0);
