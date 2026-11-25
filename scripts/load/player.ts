/**
 * One simulated player, speaking the app's real protocol (packages/chess/src/protocol.ts) over the HTTP API and a
 * WebSocket, the way packages/app/src/net.ts does:
 *   guest account (GET /api/me) → the home screen's live line (GET /api/live every 5 s) → PLAY (POST /api/play;
 *   "busy, you're in line" answers are waited out) → the lobby's WebSocket (hello) → votes, legal moves within the
 *   clock (chess.js), the odd quick-chat line, the 30 s heartbeat → leaves at the results (or when its time is up).
 * When the lobby makes it the host, it answers the host's work (scores, bot plans, the boss's move) with
 * deterministic fake numbers at once, so the test measures the servers, not Stockfish.
 */
import WebSocket from "ws";
import { Chess } from "chess.js";
import type { BoardScore, ClientMessage, ScoreJob, ServerMessage } from "../../packages/chess/src/protocol.ts";
import type { Metrics } from "./metrics.ts";

export interface PlayerOptions {
  base: string;
  mode: "crowd" | "raid";
  pool?: string;
  /** Time on the home screen before pressing PLAY (random up to this). */
  homeDwellMs: number;
  /** Chance per round of sending a quick-chat line. */
  chatChance: number;
  /** Leave after this long even if the match isn't over (0: play to the results). */
  maxSessionMs: number;
  /** Extra headers on every request (Cloudflare Access on staging). */
  headers: Record<string, string>;
  /** Keep the WebSocket's heartbeat (GET /api/live every 30 s). */
  heartbeatMs: number;
}

type State = "new" | "home" | "inLine" | "queue" | "match" | "done" | "failed";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function legal(fen: string): string[] {
  try {
    return new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
  } catch {
    return [];
  }
}

/** A stable fake evaluation for a move (0.30-0.60), the same for every host. */
function fakeExpected(fen: string, move: string): number {
  let h = 2166136261;
  for (const c of fen + move) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return 0.3 + ((h >>> 0) % 300) / 1000;
}

let seq = 0;

export class FakePlayer {
  readonly n = ++seq;
  private cookie = "";
  private state: State = "new";
  private ws: WebSocket | null = null;
  private playerId: string | null = null;
  private seatToken: string | undefined;
  private code: string | null = null;
  private offset = 0;
  private playStart = 0;
  private welcomedAt = 0;
  private queueWaitDone = false;
  private picked = new Set<string>();
  private voted = new Set<string>();
  private pickSent = new Map<string, number>();
  private chatSent = new Map<string, number>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private finished = false;
  private reconnects = 0;
  private resolveDone: (() => void) | null = null;

  constructor(
    private readonly o: PlayerOptions,
    private readonly m: Metrics,
  ) {}

  private set(s: State) {
    this.m.move(this.state === "new" ? null : this.state, s);
    this.state = s;
  }

  private async http(method: string, path: string, name: string): Promise<{ status: number; body: any; serverMs: number | null }> {
    const t = performance.now();
    try {
      const res = await fetch(this.o.base + path, {
        method,
        headers: { ...this.o.headers, ...(this.cookie ? { cookie: this.cookie } : {}) },
        signal: AbortSignal.timeout(30_000),
      });
      const setCookie = res.headers.get("set-cookie");
      const m = setCookie?.match(/hc_session=([^;]+)/);
      if (m) this.cookie = `hc_session=${m[1]}`;
      const body = await res.json().catch(() => null);
      const ms = performance.now() - t;
      this.m.time(`http ${name}`, ms);
      const st = res.headers.get("server-timing")?.match(/app;dur=(\d+)/);
      const serverMs = st ? Number(st[1]) : null;
      if (serverMs !== null) this.m.time(`server ${name}`, serverMs);
      if (res.status === 429) this.m.count(`429 ${name}`);
      else if (res.status >= 400) this.m.error(`${name} ${res.status} ${body?.message ?? ""}`);
      return { status: res.status, body, serverMs };
    } catch (e) {
      this.m.error(`${name} ${(e as Error).name}: ${(e as Error).message}`);
      return { status: 0, body: null, serverMs: null };
    }
  }

  async run(): Promise<void> {
    this.set("home");
    const me = await this.http("GET", "/api/me?name=" + encodeURIComponent(`Load ${this.n}`), "me");
    if (me.status !== 200) return this.fail();
    // The home screen: the live line every 5 s.
    const dwell = rand(0, this.o.homeDwellMs);
    const homeUntil = Date.now() + dwell;
    while (Date.now() < homeUntil) {
      await this.http("GET", "/api/live", "live");
      await sleep(Math.min(5000, Math.max(0, homeUntil - Date.now())));
    }
    // PLAY.
    this.playStart = performance.now();
    const q = new URLSearchParams();
    if (this.o.mode === "raid") q.set("mode", "raid");
    if (this.o.pool) q.set("pool", this.o.pool);
    let code: string | null = null;
    let lineStart = 0;
    for (let tries = 0; tries < 400 && !code; tries++) {
      const r = await this.http("POST", `/api/play${q.size ? `?${q}` : ""}`, "play");
      if (r.body?.code) code = r.body.code;
      else if (r.body?.busy) {
        // "Servers are busy, you're in line: about N s": wait as told, then ask again with the ticket.
        if (!lineStart) {
          lineStart = performance.now();
          this.set("inLine");
          this.m.count("toldBusy");
        }
        if (r.body.ticket) q.set("ticket", r.body.ticket);
        this.m.time("busyEstimateS", Number(r.body.waitSeconds) * 1000);
        await sleep(Number(r.body.retryMs) || 3000);
      } else if (r.status === 429) await sleep(Number(r.body?.retryMs) || 5000);
      else return this.fail();
    }
    if (lineStart) this.m.time("inLineMs", performance.now() - lineStart);
    if (!code) return this.fail();
    this.code = code;
    this.m.time("playToCode", performance.now() - this.playStart);
    this.set("queue");
    const heartbeat = setInterval(() => void this.http("GET", "/api/live", "heartbeat"), this.o.heartbeatMs);
    if (this.o.maxSessionMs) this.timers.push(setTimeout(() => this.finish("timeUp"), this.o.maxSessionMs));
    await new Promise<void>((resolve) => {
      this.resolveDone = resolve;
      this.connect();
    });
    clearInterval(heartbeat);
    for (const t of this.timers) clearTimeout(t);
  }

  private fail() {
    this.m.count("playersFailed");
    this.set("failed");
  }

  private connect() {
    const t = performance.now();
    const url = `${this.o.base.replace(/^http/, "ws")}/api/lobby/${this.code}/ws`;
    const ws = new WebSocket(url, { headers: { ...this.o.headers, cookie: this.cookie } });
    this.ws = ws;
    let opened = false;
    ws.on("open", () => {
      opened = true;
      this.m.time("wsOpen", performance.now() - t);
      this.send({ t: "hello", token: this.seatToken, name: `Load ${this.n}`, device: "computer", look: {} });
    });
    ws.on("message", (data) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      this.m.count("msgsIn");
      this.onMessage(msg);
    });
    ws.on("unexpected-response", (_req, res) => {
      this.m.error(`ws refused ${res.statusCode}`);
    });
    ws.on("error", (e) => this.m.error(`ws error ${e.message}`));
    ws.on("close", () => {
      if (this.finished) return;
      this.m.count(opened ? "wsDropped" : "wsRefused");
      if (++this.reconnects > 5) return this.finish("gaveUp");
      this.timers.push(setTimeout(() => this.connect(), Math.min(8000, 500 * 2 ** this.reconnects)));
    });
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      this.m.count("msgsOut");
    }
  }

  private finish(how: string) {
    if (this.finished) return;
    this.finished = true;
    this.m.count(`end ${how}`);
    if (this.state === "queue" && how === "timeUp") this.send({ t: "leave" });
    this.ws?.close();
    this.set("done");
    this.resolveDone?.();
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, Math.max(0, ms)));
  }

  private serverNow() {
    return Date.now() + this.offset;
  }

  private onMessage(m: ServerMessage) {
    this.offset = m.now - Date.now();
    switch (m.t) {
      case "welcome":
        this.playerId = m.playerId;
        this.seatToken = m.token;
        if (!this.welcomedAt) {
          this.welcomedAt = Date.now();
          this.m.time("playToLobby", performance.now() - this.playStart);
        }
        return;
      case "lobby":
        if (m.filledAt && !this.queueWaitDone && this.welcomedAt) {
          this.queueWaitDone = true;
          this.m.time("queueWait", Math.max(0, m.filledAt - this.offset - this.welcomedAt));
          if (this.state === "queue") this.set("match");
        }
        return;
      case "error":
        this.m.error(`lobby error: ${m.message}`);
        if (m.ended || !this.playerId) this.finish("error");
        return;
      case "closed":
        return this.finish("closed");
      case "results":
        this.m.count("matchesFinishedSeen");
        return this.finish("results");
      case "vote": {
        if (this.state === "queue") this.set("match");
        const v = m.vote;
        if (v.result !== null || this.voted.has(v.key)) return;
        this.voted.add(v.key);
        const until = v.until - this.offset - Date.now();
        this.later(rand(500, Math.max(600, Math.min(4000, until - 500))), () => this.send({ t: "vote", key: v.key, option: Math.floor(Math.random() * 2) }));
        return;
      }
      case "round": {
        if (this.state === "queue") this.set("match");
        if (!m.alive || m.watching || !m.board || this.picked.has(m.key)) return;
        this.picked.add(m.key);
        const moves = legal(m.board.fen);
        if (!moves.length) return;
        const startIn = m.startsAt - this.offset - Date.now();
        const clock = m.deadline - m.startsAt;
        // Think for a while within the clock (a few miss it, as people do).
        const think = Math.random() < 0.03 ? clock + 2000 : rand(800, Math.max(900, Math.min(clock * 0.7, 9000)));
        const key = m.key;
        this.later(startIn + think, () => {
          this.pickSent.set(key, performance.now());
          this.send({ t: "pick", key, move: moves[Math.floor(Math.random() * moves.length)]! });
        });
        if (Math.random() < this.o.chatChance) {
          this.later(startIn + rand(0, clock), () => {
            const say = ["good-luck", "have-fun", "hi-all"][Math.floor(Math.random() * 3)]!;
            this.chatSent.set(say, performance.now());
            this.send({ t: "chat", say, to: "all" });
          });
        }
        return;
      }
      case "moved":
        if (m.playerId === this.playerId) {
          const t = this.pickSent.get(m.key);
          if (t !== undefined) {
            this.m.time("pickRtt", performance.now() - t);
            this.pickSent.delete(m.key);
          }
        }
        return;
      case "chat":
        if (m.line.from === this.playerId) {
          const t = this.chatSent.get(m.line.say);
          if (t !== undefined) {
            this.m.time("chatRtt", performance.now() - t);
            this.chatSent.delete(m.line.say);
          }
        }
        return;
      case "chatNo":
        this.m.count(`chatNo ${m.reason}`);
        return;
      // ---- Host work, with fake numbers ----
      case "prefetch":
        if (m.plan) {
          const plan = m.plan;
          const moves = legal(plan.fen).filter((x) => x !== plan.barred);
          const picks = Object.fromEntries(plan.bots.map((b) => [b.id, moves[Math.floor(Math.random() * moves.length)]!]));
          this.later(rand(100, 400), () => this.send({ t: "botPlan", key: plan.key, picks, powerUps: [] }));
        }
        return;
      case "scoreRequest": {
        const boards = m.jobs.map((j) => this.fakeScore(j));
        this.m.count("hostScores");
        this.later(rand(150, 500), () => this.send({ t: "scores", key: m.key, boards }));
        return;
      }
      case "bossRequest": {
        const moves = legal(m.fen);
        this.m.count("hostBossMoves");
        this.later(rand(200, 600), () => this.send({ t: "bossMove", key: m.key, move: moves[Math.floor(Math.random() * moves.length)]! }));
        return;
      }
    }
  }

  private fakeScore(j: ScoreJob): BoardScore {
    const moves = legal(j.fen).filter((x) => x !== j.barred);
    const botPicks: Record<string, string> = {};
    const botThinkMs: Record<string, number> = {};
    for (const b of j.bots) {
      botPicks[b.id] = j.botPlan?.[b.id] ?? moves[Math.floor(Math.random() * moves.length)]!;
      botThinkMs[b.id] = Math.round(rand(3000, 9000));
    }
    const all = new Set([...moves.slice(0, 8), ...Object.values(j.humanPicks).filter((x): x is string => !!x), ...Object.values(botPicks)]);
    const expectedAfter = Object.fromEntries([...all].map((mv) => [mv, fakeExpected(j.fen, mv)]));
    const best = [...all].sort((a, b) => expectedAfter[b]! - expectedAfter[a]!)[0]!;
    return { boardId: j.boardId, bestMove: best, bestExpected: expectedAfter[best]!, expectedAfter, botPicks, botThinkMs, botPowerUps: [] };
  }
}
