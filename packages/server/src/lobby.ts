import { DEFAULT_SETTINGS, allowedMs, botVotes, raidBossElo, clockAfterVote, cutSeconds, pregameVotes, tallyVotes, type Augment, type DrawRule, type Settings } from "@chessroyale/core";
import {
  MatchRunner,
  botRoster,
  legalMoves,
  netBoard,
  boardSlots,
  toSan,
  type BoardScore,
  type ClientMessage,
  type NetFinal,
  type NetStanding,
  type Opening,
  type RunnerSnapshot,
  type LivePick,
  type NetVote,
  type ScoreJob,
  type ServerMessage,
} from "@chessroyale/chess";

/**
 * One lobby's logic, independent of Cloudflare: players and tokens, the round
 * clock, picks, scoring via the host's browser, the draw, stage breaks and the
 * 2v2 final. The Durable Object stores `record` between messages and calls `alarm()`
 * at `nextAlarm`.
 */

type Outgoing = ServerMessage extends infer M ? (M extends { now: number } ? Omit<M, "now"> : never) : never;

export interface LobbyIO {
  send(playerId: string, msg: Outgoing): void;
  now(): number;
}

interface Human {
  id: string;
  name: string;
  token: string;
  connected: boolean;
  device: "phone" | "computer";
  practice?: boolean;
  /** The rating on their profile (for a boss raid's strength). */
  rating?: number | null;
}

type Timer =
  | "startRound"
  | "lock"
  | "afterReveal"
  | "nextRound"
  | "scoreTimeout"
  | "voteEnd"
  | "voteNext"
  | "bossTimeout"
  | "autoStart";

export interface LobbyRecord {
  code: string;
  createdAt: number;
  phase: "lobby" | "opening" | "vote" | "play" | "scoring" | "reveal" | "stageBreak" | "final" | "boss" | "results";
  humans: Human[];
  hostId: string | null;
  runner: RunnerSnapshot | null;
  bots: { id: string; name: string; skill: number }[];
  round: null | {
    key: string;
    /** The latest personal deadline (the round locks then at the latest). */
    deadline: number;
    deadlines: Record<string, number>;
    startedAt: number;
    picks: Record<string, { move: string; thinkMs: number }>;
    powerUps: Record<string, true>;
    /** Boss battle: players who called the King this move. */
    kingCalls?: Record<string, true>;
    kingStrikes?: Record<string, true>;
    /** Crowd: the host's early bot picks, and when each bot finishes (ms after the clock starts). */
    botPlan?: { picks: Record<string, string>; powerUps: string[] };
    botsDoneIn?: Record<string, number>;
  };
  timer: null | { at: number; kind: Timer };
  /** Last phase message per human, re-sent on reconnect. */
  last: Record<string, Outgoing>;
  scoreRequest: null | { key: string; jobs: ScoreJob[] };
  placements: Record<string, number>;
  mismatches: number;
  counter: number;
  /** Per-lobby settings: the mode and its options, opening length, plus playtest overrides (rounds, clock, pace, draw rule). */
  overrides?: Partial<Settings> & {
    drawRuleByStage?: DrawRule[];
  };
  /** Signed-in players' account ids (by player id), so results go on their profiles. */
  accounts?: Record<string, string>;
  resultsSaved?: boolean;
  /** Crowd augments: the move clock as voted (seconds), and this cut's votes. */
  moveClock?: number;
  augmentVotes?: Record<string, Augment>;
  /** The pre-game vote in progress: humans' votes as they come, the bots' (decided when it opens), and its result. */
  vote?: {
    index: number;
    key: string;
    startsAt: number;
    until: number;
    votes: Record<string, { option: number; at: number }>;
    bots: { id: string; option: number; at: number }[];
    result: number | null;
    nextAt?: number;
  };
  /** Boss battle: the boss move the host owes the server. */
  bossKey?: string;
  bossStumble?: boolean;
  bossKind?: "elo" | "stumble" | "stagger";
  bossIntroDone?: boolean;
  /** Matchmade ("Play now"): starts by itself when full or at `fillAt`, bots filling the rest. */
  auto?: { fillAt: number };
}

export function newLobbyRecord(code: string, now: number, overrides?: LobbyRecord["overrides"]): LobbyRecord {
  return {
    overrides,
    code,
    createdAt: now,
    phase: "lobby",
    humans: [],
    hostId: null,
    runner: null,
    bots: [],
    round: null,
    timer: null,
    last: {},
    scoreRequest: null,
    placements: {},
    mismatches: 0,
    counter: 0,
  };
}

const SCORE_TIMEOUT_MS = 15_000;
/** In the final, how long each move is shown before the next turn (longer when players go out). */
const FINAL_SHOW_MS = 3200;
const FINAL_CUT_MS = 1800;
/** Boss battle: how long the boss's move shows, how long a strike shows, and how long the host has to play the boss. */
const BOSS_SHOW_MS = 1800;
const BOSS_KILL_MS = 3800;
const BOSS_TIMEOUT_MS = 15_000;
const BOSS_INTRO_MS = 5500;
/** The God King's summoning and bolt, added to a reveal where he acts. */
const KING_FX_MS = 3900;

export class LobbyCore {
  private runner: MatchRunner | null = null;

  constructor(
    public record: LobbyRecord,
    private readonly io: LobbyIO,
    private readonly library: readonly Opening[],
    private readonly rng: () => number = Math.random,
    private settings: Settings = DEFAULT_SETTINGS,
  ) {
    this.settings = { ...settings, ...(record.overrides ?? {}) };
    if (record.moveClock) this.settings = { ...this.settings, moveClockSeconds: record.moveClock };
    if (record.runner) {
      this.runner = MatchRunner.restore(record.runner, { settings: this.settings, rng, engines: [], library });
    }
  }

  /** Call after every event so the record can be stored. */
  save(): LobbyRecord {
    if (this.runner) this.record.runner = this.runner.snapshot();
    return this.record;
  }

  get nextAlarm(): number | null {
    return this.record.timer?.at ?? null;
  }

  // ---------------- Helpers ----------------

  private get r() {
    return this.record;
  }

  private human(id: string) {
    return this.r.humans.find((h) => h.id === id);
  }

  private send(id: string, msg: Outgoing, remember = true) {
    if (remember) this.r.last[id] = msg;
    this.io.send(id, msg);
  }

  private broadcast(msg: Outgoing, remember = true) {
    for (const h of this.r.humans) this.send(h.id, msg, remember);
  }

  private setTimer(kind: Timer, at: number) {
    this.r.timer = { kind, at };
  }

  private nameOf(id: string): string {
    return this.human(id)?.name ?? this.r.bots.find((b) => b.id === id)?.name ?? id;
  }

  private lobbyMessage(): Outgoing {
    return {
      t: "lobby",
      players: [
        ...this.r.humans.map((h) => ({ id: h.id, name: h.name, isBot: false, connected: h.connected })),
        ...this.r.bots.map((b) => ({ id: b.id, name: b.name, isBot: true, connected: true })),
      ],
      hostId: this.r.hostId,
      started: this.r.phase !== "lobby",
      lobbySize: this.settings.lobbySize,
      ...(this.r.auto ? { auto: true, fillAt: this.r.auto.fillAt } : {}),
    };
  }

  /** Matchmaking: this lobby still takes players (open, not full, a few seconds left before it fills with bots). */
  joinable(): boolean {
    return this.r.phase === "lobby" && !!this.r.auto && this.r.humans.length < this.settings.lobbySize && this.io.now() < this.r.auto.fillAt - 2000;
  }

  private standings(): NetStanding[] {
    return this.runner?.leaderboard() ?? [];
  }

  private cutoff(): number {
    const alive = this.runner!.alive().length;
    return alive - (this.settings.knockoutsPerStage[this.runner!.state.stage] ?? 0);
  }

  private aliveHumans(): Human[] {
    const alive = new Set(this.runner?.alive().map((p) => p.id) ?? []);
    return this.r.humans.filter((h) => alive.has(h.id));
  }

  /** The host scores rounds; prefer a connected computer. */
  private pickHost(exclude?: string): string | null {
    const candidates = this.r.humans.filter((h) => h.connected && h.id !== exclude);
    const computer = candidates.find((h) => h.device === "computer");
    return (computer ?? candidates[0])?.id ?? null;
  }

  // ---------------- Connections ----------------

  connect(token: string | undefined, name: string | undefined, device: "phone" | "computer" = "computer", practice = false, rating: number | null = null) {
    const existing = token ? this.r.humans.find((h) => h.token === token) : undefined;
    if (existing) {
      existing.connected = true;
      if (!this.r.hostId || !this.human(this.r.hostId)?.connected) this.r.hostId = existing.id;
      this.send(existing.id, { t: "welcome", playerId: existing.id, token: existing.token, code: this.r.code }, false);
      this.broadcast(this.lobbyMessage(), false);
      const last = this.r.last[existing.id];
      if (last) this.send(existing.id, last, false);
      this.resendHostWork();
      return { ok: true as const, playerId: existing.id };
    }
    if (this.r.phase !== "lobby") return { ok: false as const, message: "This match has already started." };
    if (this.r.humans.length >= this.settings.lobbySize) return { ok: false as const, message: "This lobby is full." };
    const clean = (name ?? "").replace(/\s+/g, " ").trim().slice(0, 16) || `Player ${this.r.humans.length + 1}`;
    const id = `p${++this.r.counter}`;
    const newToken = Array.from({ length: 24 }, () => Math.floor(this.rng() * 16).toString(16)).join("");
    this.r.humans.push({ id, name: clean, token: newToken, connected: true, device, practice, rating: typeof rating === "number" && Number.isFinite(rating) ? Math.max(400, Math.min(3400, rating)) : null });
    if (!this.r.hostId) this.r.hostId = id;
    this.send(id, { t: "welcome", playerId: id, token: newToken, code: this.r.code }, false);
    this.broadcast(this.lobbyMessage(), false);
    // Matchmade and full: start now.
    if (this.r.auto && this.r.humans.length >= this.settings.lobbySize) this.startMatch();
    return { ok: true as const, playerId: id };
  }

  /** Sends a (re)connected player everything they need: welcome, lobby, the current phase, any host work. */
  resendTo(playerId: string) {
    const h = this.human(playerId);
    if (!h) return;
    this.io.send(playerId, { t: "welcome", playerId, token: h.token, code: this.r.code });
    this.io.send(playerId, this.lobbyMessage());
    const last = this.r.last[playerId];
    if (last) this.io.send(playerId, last);
    if (playerId === this.r.hostId) this.resendHostWork();
  }

  disconnect(playerId: string) {
    const h = this.human(playerId);
    if (!h) return;
    h.connected = false;
    if (this.r.hostId === playerId) {
      this.r.hostId = this.pickHost(playerId) ?? playerId;
      this.resendHostWork();
    }
    this.broadcast(this.lobbyMessage(), false);
  }

  /** If the host owes the server work (scores, a bot's duel move), (re)send it to the current host. */
  private resendHostWork() {
    const host = this.r.hostId;
    if (!host || !this.human(host)?.connected) return;
    if (this.r.phase === "scoring" && this.r.scoreRequest) {
      this.io.send(host, { t: "scoreRequest", ...this.r.scoreRequest });
    }
    if (this.r.phase === "boss" && this.r.bossKey) this.sendBossRequest(host);
  }

  // ---------------- Messages ----------------

  message(playerId: string, msg: ClientMessage) {
    switch (msg.t) {
      case "start":
        return this.start(playerId);
      case "pick":
        return this.pick(playerId, msg.key, msg.move);
      case "powerUp":
        return this.powerUp(playerId, msg.key);
      case "scores":
        return this.scores(playerId, msg.key, msg.boards);
      case "crossCheck":
        if (!msg.ok) {
          this.r.mismatches++;
          console.log(`cross-check mismatch in ${this.r.code} (${msg.key}, board ${msg.boardId}): ${msg.detail ?? ""}`);
        }
        return;
      case "botPlan":
        if (playerId === this.r.hostId && this.r.round?.key === msg.key && this.r.phase === "play" && !this.r.round.botPlan) {
          this.r.round.botPlan = { picks: msg.picks, powerUps: msg.powerUps };
          this.sendTally();
        }
        return;
      case "augment":
        if (this.r.phase === "stageBreak" && this.settings.cutClockVote && this.runner?.player(playerId)?.alive) {
          this.r.augmentVotes = { ...(this.r.augmentVotes ?? {}), [playerId]: msg.choice };
        }
        return;
      case "vote":
        return this.castVote(playerId, msg.key, msg.option);
      case "king": {
        const round = this.r.round;
        if (this.r.phase === "play" && round?.key === msg.key && this.runner?.boss?.kingCharges && this.runner.player(playerId)?.alive) {
          if (msg.strike) (round.kingStrikes ??= {})[playerId] = true;
          else (round.kingCalls ??= {})[playerId] = true;
        }
        return;
      }
      case "bossMove":
        if (playerId === this.r.hostId && this.r.phase === "boss" && this.r.bossKey === msg.key) this.playBoss(msg.move);
        return;
      case "hello":
        return;
    }
  }

  // ---------------- Match flow ----------------

  private start(playerId: string) {
    if (this.r.phase !== "lobby" || playerId !== this.r.hostId || this.r.auto) return;
    this.startMatch();
  }

  /** Fills the empty seats with bots and starts: the pre-game votes (Crowd 50 v 50) or the opening. */
  private startMatch() {
    if (this.r.phase !== "lobby") return;
    if (this.settings.raid) {
      // Boss raid: no bots; the boss is the weakest that's stronger than the group's average rating.
      const patch = { bossFixedElo: raidBossElo(this.r.humans.map((h) => h.rating ?? null)) };
      this.r.overrides = { ...(this.r.overrides ?? {}), ...patch } as LobbyRecord["overrides"];
      this.settings = { ...this.settings, ...patch };
    }
    const empty = this.settings.raid ? 0 : this.settings.lobbySize - this.r.humans.length;
    const bots = botRoster(this.rng, empty, this.settings);
    this.r.bots = bots.map((b) => ({ id: b.id, name: b.name, skill: b.skill ?? 5 }));
    this.runner = new MatchRunner({
      settings: this.settings,
      rng: this.rng,
      engines: [],
      library: this.library,
      entrants: [...this.r.humans.map((h) => ({ id: h.id, name: h.name, isBot: false, practice: !!h.practice })), ...bots],
    });
    const now = this.io.now();
    const voting = pregameVotes(this.settings).length > 0;
    this.r.phase = voting ? "vote" : "opening";
    this.broadcast(this.lobbyMessage(), false);
    if (voting) return this.startVote(0);
    this.broadcast({
      t: "opening",
      boards: [...this.runner.boards.values()].map((b) => netBoard(b, true)),
      until: now + this.settings.openingShowSeconds * 1000,
    });
    this.setTimer("startRound", now + this.settings.openingShowSeconds * 1000);
  }

  alarm() {
    const timer = this.r.timer;
    if (!timer || timer.at > this.io.now() + 50) return;
    this.r.timer = null;
    switch (timer.kind) {
      case "startRound":
      case "nextRound":
        return this.nextRound();
      case "lock":
        return this.lock();
      case "afterReveal":
        return this.afterReveal();
      case "scoreTimeout":
        return this.scoreTimeout();
      case "voteEnd":
        return this.endVote();
      case "voteNext":
        return this.r.vote && this.r.vote.index + 1 < pregameVotes(this.settings).length ? this.startVote(this.r.vote.index + 1) : this.nextRound();
      case "bossTimeout":
        return this.bossTimeout();
      case "autoStart":
        // Matchmade: time's up, bots fill the rest (if anyone is still here).
        if (this.r.phase === "lobby" && this.r.humans.some((h) => h.connected)) this.startMatch();
        return;
    }
  }

  /** Arms the matchmaking timer (called once when the lobby is made for "Play now"). */
  setAuto(fillAt: number) {
    this.r.auto = { fillAt };
    this.setTimer("autoStart", fillAt);
  }

  // ---------------- Pre-game votes ----------------

  private voteView(): NetVote {
    const v = this.r.vote!;
    const side = (id: string) => this.runner?.player(id)?.colour ?? "w";
    return {
      key: v.key,
      index: v.index,
      count: pregameVotes(this.settings).length,
      startsAt: v.startsAt,
      until: v.until,
      votes: [
        ...v.bots.map((b) => ({ playerId: b.id, option: b.option, at: b.at, side: side(b.id) })),
        ...Object.entries(v.votes).map(([playerId, x]) => ({ playerId, option: x.option, at: x.at, side: side(playerId) })),
      ],
      result: v.result,
      ...(v.nextAt ? { nextAt: v.nextAt } : {}),
    };
  }

  private startVote(index: number) {
    const runner = this.runner!;
    const def = pregameVotes(this.settings)[index]!;
    const now = this.io.now();
    const ms = this.settings.voteSeconds * 1000;
    const bots = runner.state.players.filter((p) => p.isBot).map((p) => p.id);
    this.r.vote = {
      index,
      key: `v${index}-${++this.r.counter}`,
      startsAt: now,
      until: now + ms,
      votes: {},
      bots: botVotes(this.rng, bots, def.options.length, ms).map((b) => ({ id: b.id, option: b.option, at: now + b.atMs })),
      result: null,
    };
    this.r.phase = "vote";
    this.broadcast({ t: "vote", vote: this.voteView(), standings: this.standings() });
    this.setTimer("voteEnd", now + ms);
  }

  private castVote(playerId: string, key: string, option: number) {
    const v = this.r.vote;
    if (this.r.phase !== "vote" || !v || v.key !== key || v.result !== null || v.votes[playerId]) return;
    const now = this.io.now();
    if (now > v.until + this.settings.lateGraceMs || !Number.isInteger(option) || option < 0 || option > 2 || !this.runner?.player(playerId)) return;
    v.votes[playerId] = { option, at: now };
    const side = this.runner.player(playerId).colour ?? "w";
    for (const h of this.r.humans) this.send(h.id, { t: "voteCast", key, playerId, option, at: now, side }, false);
    // Re-sent on reconnect with everyone's votes so far.
    for (const h of this.r.humans) this.r.last[h.id] = { t: "vote", vote: this.voteView(), standings: this.standings() };
  }

  private endVote() {
    const v = this.r.vote;
    if (this.r.phase !== "vote" || !v || v.result !== null) return;
    const def = pregameVotes(this.settings)[v.index]!;
    const choices = [...v.bots.map((b) => b.option), ...Object.values(v.votes).map((x) => x.option)];
    v.result = tallyVotes(choices, def.options.length, def.defaultOption, this.rng);
    const patch = def.options[v.result]!.patch;
    // Kept in the overrides, so the settings survive the Durable Object sleeping.
    this.r.overrides = { ...(this.r.overrides ?? {}), ...patch } as LobbyRecord["overrides"];
    this.settings = { ...this.settings, ...patch };
    this.runner!.patchSettings(patch);
    v.nextAt = this.io.now() + this.settings.voteResultSeconds * 1000;
    this.broadcast({ t: "vote", vote: this.voteView(), standings: this.standings() });
    this.setTimer("voteNext", v.nextAt);
  }

  // ---------------- Boss battle ----------------

  private bossMessage(until: number, opts: { thinking?: boolean; justKilled?: string | null } = {}): Outgoing {
    return { t: "boss", boss: this.runner!.bossView(opts.justKilled ?? null)!, standings: this.standings(), until, ...(opts.thinking ? { thinking: true } : {}) };
  }

  /** The boss's turn: everyone sees it thinking while the host's engine plays its move. */
  private requestBoss() {
    this.r.phase = "boss";
    this.r.bossKey = `b-${++this.r.counter}`;
    this.r.bossKind = this.runner!.bossMoveKind();
    this.broadcast(this.bossMessage(0, { thinking: true }));
    const host = this.r.hostId && this.human(this.r.hostId)?.connected ? this.r.hostId : this.pickHost();
    this.r.hostId = host;
    if (host) this.sendBossRequest(host);
    this.setTimer("bossTimeout", this.io.now() + BOSS_TIMEOUT_MS);
  }

  private sendBossRequest(host: string) {
    const runner = this.runner!;
    const fen = runner.boards.get(runner.state.boards[0]!)!.fen;
    this.io.send(host, {
      t: "bossRequest",
      key: this.r.bossKey!,
      fen,
      elo: runner.boss!.elo,
      nodes: this.settings.bossNodes,
      ...(this.r.bossKind === "stumble" ? { stumble: true } : this.r.bossKind === "stagger" ? { stagger: true } : {}),
    });
  }

  private playBoss(move: string) {
    this.r.bossKey = undefined;
    this.runner!.applyBossMove(move);
    const until = this.io.now() + BOSS_SHOW_MS;
    this.broadcast(this.bossMessage(until));
    this.setTimer("nextRound", until);
  }

  private bossTimeout() {
    if (this.r.phase !== "boss" || !this.r.bossKey) return;
    const next = this.pickHost(this.r.hostId ?? undefined);
    if (next && next !== this.r.hostId) {
      this.r.hostId = next;
      this.sendBossRequest(next);
      this.setTimer("bossTimeout", this.io.now() + BOSS_TIMEOUT_MS);
      return;
    }
    // Nobody can run the engine: the boss plays a random legal move so the match can go on.
    const runner = this.runner!;
    const legal = legalMoves(runner.boards.get(runner.state.boards[0]!)!.fen);
    this.playBoss(legal[Math.floor(this.rng() * legal.length)]!);
  }

  /** Humans playing this round (everyone alive in the knockout stages; just the mover in a final turn). */
  private roundHumans(): Human[] {
    const playing = new Set([...(this.runner?.groups.values() ?? [])].flat());
    return this.r.humans.filter((h) => playing.has(h.id));
  }

  private nextRound() {
    const runner = this.runner;
    if (!runner) return;
    if (runner.isOver()) return this.finishMatch();
    if (runner.boss) {
      if (!this.r.bossIntroDone) {
        // The boss arrives: it takes over from an even position of the game just played.
        this.r.bossIntroDone = true;
        this.r.phase = "boss";
        const until = this.io.now() + BOSS_INTRO_MS;
        this.broadcast({ ...this.bossMessage(until), intro: true } as Outgoing);
        return this.setTimer("nextRound", until);
      }
      if (runner.stageComplete()) {
        runner.finishBossBattle();
        return this.finishMatch();
      }
      if (runner.bossToMove()) return this.requestBoss();
    }
    if (this.r.augmentVotes) {
      // Crowd augments: the cut's vote sets the move clock from now on.
      const clock = clockAfterVote(this.settings.moveClockSeconds, Object.values(this.r.augmentVotes), this.settings);
      this.r.augmentVotes = undefined;
      this.r.moveClock = clock;
      this.settings = { ...this.settings, moveClockSeconds: clock };
      runner.setMoveClock(clock);
    }
    runner.deal();
    const final = !!runner.final;
    // The move clock starts after a short settling-in countdown on a new board (not in the final: it's one board).
    const now = this.io.now() + (final ? 0 : this.settings.boardIntroSeconds * 1000);
    const key = `${runner.state.stage}-${runner.state.round}-${++this.r.counter}`;
    // Each human's deadline comes from their own time bank.
    const deadlines: Record<string, number> = {};
    const playing = this.roundHumans();
    for (const h of playing) deadlines[h.id] = now + allowedMs(runner.player(h.id), this.settings);
    const deadline = Math.max(now, ...Object.values(deadlines));
    this.r.round = { key, deadline, deadlines, startedAt: now, picks: {}, powerUps: {}, ...(final ? {} : { botsDoneIn: runner.botThinkTimes() }) };
    this.r.phase = "play";
    const st = this.standings();
    const cutoff = this.cutoff();
    const alive = new Set(runner.alive().map((p) => p.id));
    const inRound = new Set(playing.map((h) => h.id));
    const crowd = this.settings.mode === "crowd";
    for (const h of this.r.humans) {
      // Crowd 50 v 50: the team not picking still gets the board, to watch the vote come in.
      const watching = crowd && !final && alive.has(h.id) && !inRound.has(h.id);
      const board = inRound.has(h.id) ? runner.boardOf(h.id) : watching ? runner.boards.get(runner.state.boards[0]!)! : null;
      this.send(h.id, {
        t: "round",
        key,
        stage: runner.state.stage,
        round: runner.state.round,
        startsAt: now,
        deadline: deadlines[h.id] ?? deadline,
        board: board ? netBoard(board) : null,
        standings: st,
        cutoff,
        alive: alive.has(h.id),
        botsDoneIn: final ? {} : runner.botThinkTimes(),
        slots: this.slots(),
        ...(watching ? { watching: true } : {}),
        moveClock: this.settings.moveClockSeconds,
      });
      if (final) this.send(h.id, { t: "final", final: runner.finalView()!, standings: st, slots: this.slots() }, !inRound.has(h.id));
      else if (!alive.has(h.id)) this.sendSpectate(h.id);
    }
    if (this.r.hostId) {
      const fens = [...runner.groups.keys()].map((id) => runner.boards.get(id)!.fen);
      const skills = new Map(this.r.bots.map((b) => [b.id, b.skill]));
      const ids = [...runner.groups.values()][0] ?? [];
      // Crowd: the host decides the bots' picks now, so everyone who has picked can watch them come in.
      const plan =
        crowd && !final
          ? { key, fen: fens[0]!, bots: ids.filter((id) => skills.has(id)).map((id) => ({ id, skill: skills.get(id)!, powerUps: runner.player(id).powerUps })) }
          : undefined;
      this.send(this.r.hostId, { t: "prefetch", fens, ...(plan ? { plan } : {}) }, false);
    }
    if (!playing.length) {
      // Only bots this round: in the final a bot "thinks" for its recorded time first; in Crowd the watching team sees
      // the vote come in for a few seconds.
      if (crowd && !final) return this.setTimer("lock", now + Math.min(this.settings.moveClockSeconds * 1000, 5000));
      if (!final) return this.lock();
      const mover = [...runner.groups.values()][0]![0]!;
      return this.setTimer("lock", this.io.now() + Math.min(6000, Math.max(1500, runner.botThinkTimes()[mover] ?? 2500)));
    }
    this.setTimer("lock", deadline + this.settings.lateGraceMs);
  }

  /** Every board slot, for the strip of tiny boards. */
  private slots() {
    return boardSlots(this.runner!.boards, this.runner!.state.boards);
  }

  private sendSpectate(id: string) {
    if (!this.runner) return;
    this.send(
      id,
      {
        t: "spectate",
        boards: this.runner.state.boards.map((b) => netBoard(this.runner!.boards.get(b)!)),
        standings: this.standings(),
        stage: this.runner.state.stage,
        round: this.runner.state.round,
        slots: this.slots(),
      },
      false,
    );
  }

  private pick(playerId: string, key: string, move: string) {
    const round = this.r.round;
    if (this.r.phase !== "play" || !round || round.key !== key || round.picks[playerId]) return;
    const now = this.io.now();
    const deadline = round.deadlines?.[playerId] ?? round.deadline;
    if (now > deadline + this.settings.lateGraceMs) return; // Late picks count as a miss.
    if (now < round.startedAt - 500) return; // Before the clock starts.
    const board = this.runner?.boardOf(playerId);
    if (!board || !legalMoves(board.fen).includes(move)) return;
    round.picks[playerId] = { move, thinkMs: Math.max(0, Math.min(now - round.startedAt, deadline - round.startedAt)) };
    for (const h of this.r.humans) this.send(h.id, { t: "moved", key, playerId }, false);
    this.sendTally();
    if (this.roundHumans().every((h) => round.picks[h.id])) this.lock();
  }

  /**
   * Crowd: the picks so far, to everyone allowed to see them: players who have
   * picked this round, and the team that's watching. Bots' picks show from the
   * moment each bot finishes thinking. Nobody sees picks before making their own.
   */
  private sendTally() {
    const round = this.r.round;
    const runner = this.runner;
    if (!round || !runner || this.settings.mode !== "crowd" || runner.final) return;
    const picks: LivePick[] = [
      ...Object.entries(round.picks).map(([playerId, p]) => ({ playerId, move: p.move, at: round.startedAt + p.thinkMs })),
      ...Object.entries(round.botPlan?.picks ?? {}).map(([playerId, move]) => ({ playerId, move, at: round.startedAt + (round.botsDoneIn?.[playerId] ?? 0) })),
    ];
    const playing = new Set(this.roundHumans().map((h) => h.id));
    for (const h of this.r.humans) {
      const alive = runner.player(h.id)?.alive;
      if (!alive || (playing.has(h.id) && !round.picks[h.id])) continue;
      this.send(h.id, { t: "tally", key: round.key, picks }, false);
    }
  }

  /** A power-up: the player's browser shows the engine's top moves; the server just counts it. */
  private powerUp(playerId: string, key: string) {
    const round = this.r.round;
    if (this.r.phase !== "play" || !round || round.key !== key || round.picks[playerId] || !this.runner) return;
    if (this.io.now() < round.startedAt - 500) return;
    const p = this.runner.state.players.find((x) => x.id === playerId);
    if (!p?.alive || !(p.practice || p.powerUps > 0)) return;
    (round.powerUps ??= {})[playerId] = true;
  }

  /** Picks are locked: ask the host's browser to score every board. */
  private lock() {
    if (!this.runner || !this.r.round || this.r.phase !== "play") return;
    this.r.phase = "scoring";
    const skills = new Map(this.r.bots.map((b) => [b.id, b.skill]));
    const jobs: ScoreJob[] = [...this.runner.groups.entries()].map(([boardId, ids]) => ({
      boardId,
      fen: this.runner!.boards.get(boardId)!.fen,
      humanPicks: Object.fromEntries(ids.filter((id) => !skills.has(id)).map((id) => [id, this.r.round!.picks[id]?.move ?? null])),
      bots: ids
        .filter((id) => skills.has(id))
        .map((id) => ({ id, skill: skills.get(id)!, powerUps: this.runner!.player(id).powerUps })),
      ...(this.r.round!.botPlan ? { botPlan: this.r.round!.botPlan.picks, botPlanPowerUps: this.r.round!.botPlan.powerUps } : {}),
    }));
    this.r.scoreRequest = { key: this.r.round.key, jobs };
    for (const h of this.r.humans) this.io.send(h.id, { t: "locked", key: this.r.round.key });
    const host = this.r.hostId && this.human(this.r.hostId)?.connected ? this.r.hostId : this.pickHost();
    this.r.hostId = host;
    if (host) this.io.send(host, { t: "scoreRequest", ...this.r.scoreRequest });
    this.setTimer("scoreTimeout", this.io.now() + SCORE_TIMEOUT_MS);
  }

  private scoreTimeout() {
    if (this.r.phase !== "scoring" || !this.r.scoreRequest) return;
    const next = this.pickHost(this.r.hostId ?? undefined);
    if (next && next !== this.r.hostId) {
      this.r.hostId = next;
      this.broadcast(this.lobbyMessage(), false);
      this.io.send(next, { t: "scoreRequest", ...this.r.scoreRequest });
      this.setTimer("scoreTimeout", this.io.now() + SCORE_TIMEOUT_MS);
      return;
    }
    // Nobody can score: treat every pick as equal so the match can go on.
    const boards: BoardScore[] = this.r.scoreRequest.jobs.map((j) => {
      const legal = legalMoves(j.fen);
      const botPicks = Object.fromEntries(j.bots.map((b) => [b.id, legal[Math.floor(this.rng() * legal.length)]!]));
      const moves = [...Object.values(j.humanPicks).filter((m): m is string => !!m), ...Object.values(botPicks)];
      return {
        boardId: j.boardId,
        bestMove: moves[0] ?? legal[0]!,
        bestExpected: 0.5,
        expectedAfter: Object.fromEntries([...moves, legal[0]!].map((m) => [m, 0.5])),
        botPicks,
        botThinkMs: Object.fromEntries(j.bots.map((b) => [b.id, 5000])),
      };
    });
    this.applyScores(boards);
  }

  private scores(playerId: string, key: string, boards: BoardScore[]) {
    if (this.r.phase !== "scoring" || playerId !== this.r.hostId || this.r.scoreRequest?.key !== key) return;
    this.applyScores(boards);
  }

  private applyScores(boards: BoardScore[]) {
    const runner = this.runner!;
    const round = this.r.round!;
    runner.kingCallers = new Set(Object.keys(round.kingCalls ?? {}));
    runner.kingStrikers = new Set(Object.keys(round.kingStrikes ?? {}));
    const byBoard = new Map(boards.map((b) => [b.boardId, b]));
    const results = this.r.scoreRequest!.jobs.map((job) => {
      const s = byBoard.get(job.boardId);
      const ids = runner.groups.get(job.boardId)!;
      const picks: Record<string, string | null> = { ...job.humanPicks };
      const legal = legalMoves(job.fen);
      for (const b of job.bots) {
        const m = s?.botPicks[b.id];
        picks[b.id] = m && legal.includes(m) ? m : legal[0]!;
        if (s?.botPowerUps?.includes(b.id)) runner.setBotPowerUp(b.id);
      }
      const bestExpected = s?.bestExpected ?? 0.5;
      const expectedAfter: Record<string, number> = { ...(s?.expectedAfter ?? {}) };
      // A pick the host didn't score counts as the best (no loss) rather than failing the round.
      for (const m of Object.values(picks)) if (m && expectedAfter[m] === undefined) expectedAfter[m] = bestExpected;
      const bestMove = s?.bestMove && legal.includes(s.bestMove) ? s.bestMove : legal[0]!;
      if (expectedAfter[bestMove] === undefined) expectedAfter[bestMove] = bestExpected;
      return runner.resolveBoard(job.boardId, ids, picks, { bestMove, bestExpected, expectedAfter });
    });
    const think = Object.fromEntries(Object.entries(round.picks).map(([id, p]) => [id, p.thinkMs]));
    // A miss uses the whole of the player's time for the move.
    for (const h of this.roundHumans()) think[h.id] ??= (round.deadlines?.[h.id] ?? round.deadline) - round.startedAt;
    const report = runner.finishRound(results, think, new Set(Object.keys(round.powerUps ?? {})));
    this.r.scoreRequest = null;
    if (runner.final) {
      // The final: everyone sees the move just played and its loss, then the next turn.
      const b = report.boards[0]!;
      const p = b.result.players[0]!;
      const last: NetFinal["last"] = { playerId: p.playerId, move: b.result.playedMove, san: toSan(b.fenBefore, b.result.playedMove), loss: p.loss };
      // Team final: when a step ends, the weakest on each side go out.
      const out = runner.afterFinalTurn();
      for (const id of out) this.r.placements[id] = runner.player(id).placement!;
      this.r.phase = "final";
      const st = this.standings();
      this.broadcast({ t: "final", final: runner.finalView(last, out)!, standings: st, slots: this.slots() });
      this.setTimer("afterReveal", this.io.now() + FINAL_SHOW_MS + (out.length ? FINAL_CUT_MS : 0));
      return;
    }
    this.r.phase = "reveal";
    const kingActs = report.boards.some((b) => b.king || b.kingStrike);
    const until = this.io.now() + (this.settings.revealSeconds + this.settings.drawnMoveSeconds) * 1000 + (kingActs ? KING_FX_MS : 0);
    const st = this.standings();
    const cutoff = this.cutoff();
    const slots = this.slots();
    for (const h of this.r.humans) {
      // Crowd: everyone still in sees the one board's vote, whether or not their team picked this turn.
      const mine = report.boards.find((b) => b.playerIds.includes(h.id)) ?? (this.settings.mode === "crowd" && runner.player(h.id).alive ? report.boards[0] : undefined);
      const score = mine ? byBoard.get(mine.boardId) : undefined;
      this.send(h.id, {
        t: "reveal",
        key: round.key,
        stage: runner.state.stage,
        roundsPlayed: runner.state.round,
        board: mine ? netBoard(runner.boards.get(mine.boardId)!) : null,
        fenBefore: mine?.fenBefore ?? null,
        bestMove: mine?.bestMove ?? null,
        playedMove: mine?.result.playedMove ?? null,
        picks: mine?.result.players.map((p) => ({ playerId: p.playerId, move: p.move, loss: p.loss, roundScore: p.roundScore })) ?? [],
        drawRule: mine?.result.drawRule ?? "random",
        ...(mine?.king !== undefined ? { king: mine.king, kingCalls: mine.kingCalls, kingStrike: mine.kingStrike, strikeCalls: mine.strikeCalls } : {}),
        expectedAfter: score?.expectedAfter ?? {},
        bestExpected: score?.bestExpected ?? null,
        standings: st,
        cutoff,
        until,
        slots,
      });
      if (!mine) this.sendSpectate(h.id);
    }
    this.setTimer("afterReveal", until);
  }

  private afterReveal() {
    const runner = this.runner!;
    if (runner.boss) {
      // The boss strikes when it's due: the crowd's worst recent mover goes.
      if (runner.bossKillDue()) {
        const victim = runner.bossKill()!;
        this.r.placements[victim] = runner.player(victim).placement!;
        this.r.phase = "boss";
        const until = this.io.now() + BOSS_KILL_MS;
        this.broadcast(this.bossMessage(until, { justKilled: victim }));
        this.setTimer("nextRound", until);
        return;
      }
      return this.nextRound();
    }
    if (!runner.stageComplete()) return this.nextRound();
    if (runner.isFinal()) {
      runner.finishFinal();
      return this.finishMatch();
    }
    const stage = runner.state.stage;
    const before = this.standings();
    const cutoff = this.cutoff();
    const end = runner.endStage();
    for (const p of end.knockedOut) this.r.placements[p.id] = p.placement!;
    this.r.phase = "stageBreak";
    const crowd = this.settings.mode === "crowd";
    const augments = crowd && this.settings.cutClockVote;
    if (augments) this.r.augmentVotes = {};
    const until = this.io.now() + (crowd ? cutSeconds(this.settings) : this.settings.stageBreakSeconds) * 1000;
    this.broadcast({
      t: "stageBreak",
      stage,
      standings: before,
      knockedOut: end.knockedOut.map((p) => p.id),
      cutoff,
      nextBoards: runner.state.boards.map((b) => netBoard(runner.boards.get(b)!)),
      until,
      placements: { ...this.r.placements },
      slots: this.slots(),
      ...(augments ? { augments: true, moveClock: this.settings.moveClockSeconds } : {}),
    });
    this.setTimer("nextRound", until);
  }

  // ---------------- Results ----------------

  /** Each human's result once the match is over (for their profiles). */
  humanResults(): { playerId: string; placement: number; players: number; team: "w" | "b" | null; teamWon: boolean | null; avgScore: number | null; rating: number | null }[] {
    const runner = this.runner;
    if (!runner || this.r.phase !== "results") return [];
    const st = this.standings();
    const winner = this.settings.mode === "crowd" ? runner.gameWinner() : null;
    const boss = runner.boss;
    return this.r.humans.flatMap((h) => {
      const row = st.find((s) => s.id === h.id);
      const placement = this.r.placements[h.id];
      if (!row || !placement) return [];
      const team = row.team ?? null;
      // Boss battle: those still standing at the end share the result.
      const p = runner.player(h.id);
      const reachedBoss = p.outInStage === null || p.outInStage >= this.settings.knockoutsPerStage.length;
      const survived = !!boss && reachedBoss && !boss.kills.some((k) => k.id === h.id);
      const teamWon = boss?.result ? (survived && boss.result !== "draw" ? boss.result === "crowd" : null) : team && winner ? team === winner : null;
      return [{ playerId: h.id, placement, players: runner.state.players.length, team, teamWon, avgScore: row.avg ?? null, rating: row.rating ?? null }];
    });
  }

  private finishMatch() {
    const runner = this.runner!;
    for (const p of runner.state.players) this.r.placements[p.id] = p.placement!;
    this.r.phase = "results";
    this.r.timer = null;
    const winner = runner.state.players.find((p) => p.placement === 1);
    const msg: Outgoing = {
      t: "results",
      placements: { ...this.r.placements },
      winner: winner ? this.nameOf(winner.id) : "",
      lossesByStage: Object.fromEntries(this.r.humans.map((h) => [h.id, runner.player(h.id).lossesByStage])),
      standings: this.standings(),
      ...(this.settings.mode === "crowd" ? { gameWinner: runner.gameWinner() } : {}),
      ...(runner.boss?.result ? { bossResult: runner.boss.result } : {}),
    };
    this.broadcast(msg);
  }
}
