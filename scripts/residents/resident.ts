/**
 * One resident as a person with a browser: signed in once (its own cookie jar), then in each of its sessions it sits on home (the
 * live line every few seconds, which also puts it on the online count), queues for ranked 1 v 1 with its ticket, plays the game,
 * and goes back home, until the session ends (a game in progress is finished first; after a deploy, the same, at once) or its
 * behavior ends it early. The queue gate spaces residents into the queue so one is often alone in line, and a person who queues
 * meets them within seconds.
 */
import { RESIDENTS, itemDef, mulberry32, type Rng } from "@chessroyale/core";
import { Api, CookieJar, isPausedAnswer, type Answer, type Target } from "./client.ts";
import { DuelGameClient, type GameReport } from "./duel-client.ts";
import type { MoveSource } from "./engine.ts";
import { gamePlan, logsOffAfter } from "./play.ts";
import { between, seedOf, type Profile } from "./profiles.ts";

export type State = "offline" | "home" | "queue" | "game";

/** Counts for the heartbeat and the log's summary. */
export class Stats {
  errors: Record<string, number> = {};
  games = { started: 0, over: 0, wins: 0, losses: 0, draws: 0, aborted: 0, vsPeople: 0, left: 0, gone: 0, stopped: 0, failed: 0 };
  moves = 0;
  fallbackMoves = 0;
  queueWaitMs: number[] = [];
  sessions = 0;

  error(kind: string): void {
    this.errors[kind] = (this.errors[kind] ?? 0) + 1;
  }

  /** The queue waits since the last call, as {n, medianMs, maxMs}; and the list starts over. */
  takeWaits(): { n: number; medianMs: number | null; maxMs: number | null } {
    const w = this.queueWaitMs.splice(0).sort((a, b) => a - b);
    return { n: w.length, medianMs: w.length ? w[w.length >> 1]! : null, maxMs: w.length ? w[w.length - 1]! : null };
  }
}

/**
 * Lets residents into the queue a few at a time: at most `maxWaiting` unpaired at once, each `gapSeconds` after the last (quicker
 * when many are waiting to get in), so the line usually holds one resident alone for a while.
 */
export class QueueGate {
  private waiters: ((leave: () => void) => void)[] = [];
  private inLine = 0;
  private nextAt = 0;
  private closed = false;
  private timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly rng: Rng,
    private readonly s = RESIDENTS.duel.queue,
  ) {
    this.timer = setInterval(() => this.tick(), 500);
  }

  /** Waits for a turn in the queue; the answer is called on leaving it (paired, cancelled or refused). */
  enter(): Promise<() => void> {
    if (this.closed) return Promise.resolve(() => undefined);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  get waiting(): number {
    return this.waiters.length;
  }

  get queued(): number {
    return this.inLine;
  }

  private tick() {
    const now = Date.now();
    if (!this.waiters.length || this.inLine >= this.s.maxWaiting || now < this.nextAt) return;
    const next = this.waiters.splice(Math.floor(this.rng() * this.waiters.length), 1)[0]!;
    this.inLine++;
    const [a, b] = this.waiters.length > 2 ? [1, 4] : this.s.gapSeconds;
    this.nextAt = now + between(this.rng, a, b) * 1000;
    let left = false;
    next(() => {
      if (left) return;
      left = true;
      this.inLine--;
    });
  }

  /** Everyone waiting goes in at once (the program is stopping: they see it and leave). */
  close(): void {
    this.closed = true;
    clearInterval(this.timer);
    for (const w of this.waiters.splice(0)) w(() => undefined);
  }
}

/** What residents share: the target, the engine, the gate, the counts, the log, and the program's stop and pause. */
export interface World {
  target: Target;
  engine: MoveSource;
  gate: QueueGate;
  stats: Stats;
  log: (line: string) => void;
  /** Our residents' account ids (a game against anyone else is against a person). */
  residentIds: Set<string>;
  stopping: () => boolean;
  /** A new version went live (run.ts, --follow-deploys): nothing new starts, games in progress finish, then everyone goes offline. */
  draining: () => boolean;
  /** An answer said residents are paused (or a socket was refused as they are): the program checks and stops. */
  paused: (how: string) => void;
  /** Sleeps up to `ms`, less if the program stops. */
  nap: (ms: number) => Promise<void>;
}

export class Resident {
  state: State = "offline";
  id: string | null = null;
  /** Until then ranked's leave rules lock it out (its sessions are skipped). */
  lockedUntil = 0;
  private readonly api: Api;
  private readonly rng: Rng;
  private sessionEnd = 0;
  private game: DuelGameClient | null = null;
  private task: Promise<void> | null = null;

  constructor(
    readonly profile: Profile,
    private readonly world: World,
  ) {
    this.api = new Api(world.target, new CookieJar());
    // (Play-to-play randomness needn't repeat across runs: only the schedule does.)
    this.rng = mulberry32(seedOf(profile.seed, "run", Date.now()));
  }

  private get name() {
    return this.profile.name;
  }

  /** An answer, with its pause and server errors noted. */
  private async call(method: string, path: string, opts: { body?: unknown; admin?: boolean; timeoutMs?: number } = {}): Promise<Answer> {
    const a = await this.api.request(method, path, opts);
    if (isPausedAnswer(a)) this.world.paused(`${method} ${path.split("?")[0]}`);
    else if (a.status === 0) this.world.stats.error("network");
    else if (a.status >= 500) this.world.stats.error(`http-${a.status}`);
    return a;
  }

  /**
   * Makes the account (or finds it) and signs in as it: the session cookie from the residents' route, then fair play's device
   * marker from /api/me, both kept in this resident's own jar. Its look (pawn color, icon) is set by the route when it's made, and
   * the common items it was seeded with are put on then, once.
   */
  async signIn(): Promise<{ ok: true; created: boolean } | { ok: false; status: number; message: string }> {
    const r = await this.call("POST", "/api/admin/residents", { admin: true, body: { name: this.name, look: { pawn: this.profile.pawn, icon: this.profile.icon } } });
    if (r.status !== 200 || typeof r.body?.id !== "string") return { ok: false, status: r.status, message: String(r.body?.message ?? r.body?.text ?? "") };
    this.id = r.body.id as string;
    this.world.residentIds.add(this.id);
    const me = await this.call("GET", "/api/me");
    if (me.status !== 200 || me.body?.user?.id !== this.id) return { ok: false, status: me.status, message: "its session didn't sign in" };
    const seeded: string[] = Array.isArray(r.body.seeded) ? r.body.seeded : [];
    if (r.body.created && seeded.length) await this.wear(seeded);
    return { ok: true, created: !!r.body.created };
  }

  /** Puts on the items it was seeded with (one each slot). */
  private async wear(defs: string[]) {
    const locker = await this.call("GET", "/api/locker");
    const items: { id: string; def: string }[] = Array.isArray(locker.body?.items) ? locker.body.items : [];
    const slots = new Set<string>();
    for (const def of defs) {
      const slot = itemDef(def)?.slot;
      const item = items.find((i) => i.def === def);
      if (!slot || !item || slots.has(slot)) continue;
      slots.add(slot);
      const e = await this.call("POST", "/api/locker/equip", { body: { slot, item: item.id } });
      if (e.status !== 200) this.world.stats.error("equip");
    }
  }

  get busy(): boolean {
    return this.task !== null;
  }

  /** Begins a session until `end` (if not in one already). */
  startSession(end: number): void {
    this.sessionEnd = end;
    if (this.task) return;
    this.world.stats.sessions++;
    this.task = this.live()
      .catch((e: unknown) => {
        this.world.stats.error("resident");
        this.world.log(`${this.name}: ${String(e)}`);
      })
      .finally(() => {
        this.state = "offline";
        this.task = null;
      });
  }

  /** The session ends now: out of the queue, and a game in progress resigned. */
  async stopNow(): Promise<void> {
    this.sessionEnd = 0;
    this.game?.stop();
    await this.task;
  }

  /** Residents were paused: the game's socket is closed without a word. */
  pausedNow(): void {
    this.sessionEnd = 0;
    this.game?.pausedNow();
  }

  private over() {
    return this.world.stopping() || this.world.draining() || Date.now() >= this.sessionEnd;
  }

  private async live() {
    const until = this.sessionEnd - Date.now() > 86_400_000 ? "stopped" : `${new Date(this.sessionEnd).toISOString().slice(11, 16)} UTC`;
    this.world.log(`${this.name}: online until ${until} (${this.profile.behavior}, ${this.profile.rating})`);
    while (!this.over()) {
      this.state = "home";
      await this.home(between(this.rng, RESIDENTS.duel.homeMs[0], RESIDENTS.duel.homeMs[1]));
      if (this.over() || this.lockedUntil > Date.now()) break;
      this.state = "queue";
      const code = await this.queue();
      if (!code) continue;
      this.state = "game";
      const report = await this.playGame(code);
      if (report.how === "left" || report.how === "paused" || report.how === "stopped") break;
      const lost = !!report.end && report.you !== null && (report.end.result === (report.you === "w" ? "0-1" : "1-0"));
      if (logsOffAfter(this.profile.behavior, lost, this.rng)) {
        this.world.log(`${this.name}: rage-quits after the loss`);
        break;
      }
    }
    this.world.log(`${this.name}: offline`);
  }

  /** On home for `ms`: the live line every RESIDENTS.homePollMs, as the front door polls it. */
  private async home(ms: number) {
    const until = Date.now() + ms;
    while (!this.world.stopping() && !this.world.draining() && Date.now() < until) {
      await this.call("GET", "/api/live");
      await this.world.nap(Math.min(RESIDENTS.homePollMs, until - Date.now()));
    }
  }

  /** The 1 v 1 queue, as the app's DuelQueue asks it; the game's code, or null (gave up, stopped, refused). */
  private async queue(): Promise<string | null> {
    const leave = await this.world.gate.enter();
    const since = Date.now();
    let ticket: string | null = null;
    try {
      // (A resident waits up to three minutes, then goes back home: a person would try a bot or come back later.)
      while (!this.world.stopping() && !this.world.draining() && Date.now() - since < 180_000 && (Date.now() < this.sessionEnd || Date.now() - since < 60_000)) {
        const r = await this.call("POST", `/api/1v1/play${ticket ? `?ticket=${encodeURIComponent(ticket)}` : ""}`, { timeoutMs: 60_000 });
        if (isPausedAnswer(r)) return null;
        if (typeof r.body?.code === "string") {
          ticket = null;
          this.world.stats.queueWaitMs.push(Date.now() - since);
          return r.body.code as string;
        }
        if (r.body?.expired) {
          ticket = null;
          continue;
        }
        if (typeof r.body?.ticket === "string") ticket = r.body.ticket;
        if (r.status === 429 || r.body?.busy) {
          await this.world.nap(Number(r.body?.retryMs) || 3000);
          continue;
        }
        if (r.status === 403 && r.body?.lockedUntil) {
          this.lockedUntil = Number(r.body.lockedUntil) || Date.now() + 5 * 60_000;
          this.world.stats.error("locked-out");
          this.world.log(`${this.name}: locked out of 1 v 1 until ${new Date(this.lockedUntil).toISOString().slice(11, 16)} UTC (${r.body.message ?? ""})`);
          return null;
        }
        if (r.status === 401) {
          this.world.log(`${this.name}: signed out, signing in again`);
          const again = await this.signIn();
          if (!again.ok) return null;
          continue;
        }
        if (r.status === 0) {
          await this.world.nap(2000);
          continue;
        }
        if (r.status >= 400) {
          this.world.stats.error(`queue-${r.status}`);
          this.world.log(`${this.name}: the queue said ${r.status} (${r.body?.message ?? ""})`);
          await this.world.nap(10_000);
          return null;
        }
        // (Still searching: asked again at once, as the app does; the server holds each ask a few seconds.)
        if (!r.body?.searching) await this.world.nap(1000);
      }
      return null;
    } finally {
      if (ticket) await this.call("POST", `/api/1v1/cancel?ticket=${encodeURIComponent(ticket)}`);
      leave();
    }
  }

  private async playGame(code: string): Promise<GameReport> {
    const plan = gamePlan(this.profile.behavior, this.rng);
    const game = new DuelGameClient(this.api, code, this.profile, this.world.engine, this.rng, plan, (l) => this.world.log(l), () => this.world.paused("the game's socket"));
    this.game = game;
    this.world.stats.games.started++;
    // (The 30 s heartbeat a match keeps, as the app's: still online, "In a match".)
    const beat = setInterval(() => void this.call("GET", "/api/live?busy=1"), RESIDENTS.gamePollMs);
    let report: GameReport;
    try {
      report = await game.play();
    } finally {
      clearInterval(beat);
      this.game = null;
    }
    this.record(report);
    return report;
  }

  private record(r: GameReport) {
    const g = this.world.stats.games;
    const s = this.world.stats;
    s.moves += r.moves;
    s.fallbackMoves += r.fallbacks;
    const person = !!r.opponent && !this.world.residentIds.has(r.opponent.uid);
    if (person) g.vsPeople++;
    let what: string = r.how;
    if (r.how === "over" && r.end) {
      g.over++;
      const won = r.end.result === (r.you === "w" ? "1-0" : "0-1");
      if (r.end.result === "aborted") g.aborted++;
      else if (r.end.result === "1/2-1/2") g.draws++;
      else if (won) g.wins++;
      else g.losses++;
      what = `${r.end.result === "aborted" ? "aborted" : r.end.result === "1/2-1/2" ? "drew" : won ? "won" : "lost"} by ${r.end.reason}`;
    } else if (r.how === "left") g.left++;
    else if (r.how === "gone") g.gone++;
    else if (r.how === "stopped") g.stopped++;
    else if (r.how === "error") {
      g.failed++;
      s.error("game");
    }
    const pts = r.outcome?.change?.points;
    const change = r.outcome?.change ? (typeof pts === "number" ? `, ${pts >= 0 ? "+" : ""}${pts} RP` : r.outcome.change.placed ? ", placed" : ", placement game") : "";
    const conduct = r.outcome?.conduct ? `, ${r.outcome.conduct.kind} (-${r.outcome.conduct.rp} RP)` : "";
    this.world.log(
      `${this.name}: game ${r.code} ${what} as ${r.you === "w" ? "White" : r.you === "b" ? "Black" : "?"} vs ${r.opponent?.name ?? "?"}${person ? " (a PERSON)" : ""}, ${r.control ?? "no control"}, ${r.moves} moves${r.fallbacks ? ` (${r.fallbacks} not Maia's)` : ""}${change}${conduct}${r.note ? ` (${r.note})` : ""}`,
    );
  }
}
