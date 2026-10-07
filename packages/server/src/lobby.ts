import { QUICK_CHAT, botChatLines, canSay, canSayToAll, chatCheck, chatSay, chatSent, mulberry32, noChatSent, ownedChatPacks, type BotChatMoment, type ChatSent } from "@chessroyale/core";
import { DEFAULT_SETTINGS, FRONT_DOOR, LOBBY_LIFE, MATCHMAKING, isRankedMatch, brilliance, cleanLook, matchFeats, type ItemLook, type MatchFeats, botVotes, castPregameVote, closePregameVote, raidBossElo, clockAfterVote, cutSeconds, pregameVotes, type Augment, type DrawRule, type Settings } from "@chessroyale/core";
import {
  MatchRunner,
  botRoster,
  bossIntroTimeline,
  bossShowMs,
  bossThinkMs,
  LAST_STAND_MS,
  lastMoveTookQueen,
  legalMoves,
  netBoard,
  boardSlots,
  toSan,
  type BoardScore,
  type ClientMessage,
  type NetFinal,
  type NetStanding,
  type Opening,
  type RoundReport,
  type RunnerSnapshot,
  type LivePick,
  type ChatRefusal,
  type NetChatLine,
  type NetVote,
  type ScoreJob,
  type ServerMessage,
  type LobbyCloseReason,
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
  /** The engine server re-checks the host's close calls (so the host needn't). */
  serverEngine?: boolean;
  /** Quick chat: a person's pixel icon (kept outside the record: icons are up to 16 KB each). */
  icon?(playerId: string): string | undefined;
}

/** Quick chat's state in a lobby. */
interface ChatRecord {
  /** Lines said so far (the last QUICK_CHAT.logSize, both teams), to send a player who (re)joins. */
  n: number;
  lines: NetChatLine[];
  /** What each person has sent lately (the limits). */
  sent: Record<string, ChatSent>;
  /** The shop items each person's account owns (their chat packs), read when they join. */
  owned: Record<string, string[]>;
  /** Whose icons each player has been sent (an icon goes with a sender's first line to each player). */
  iconTo: Record<string, string[]>;
  /** Players with chat off (nothing is sent to them), and who each player has muted for the match. */
  off: Record<string, true>;
  muted: Record<string, string[]>;
  /** When the bots' lines are said (to keep them to a few a minute). */
  bots: number[];
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
  /** The crate items they wear. */
  look?: ItemLook;
  /** When they took their seat (the queue's wait). */
  joinedAt?: number;
}

type Timer =
  | "bossPlay"
  | "startRound"
  | "lock"
  | "afterReveal"
  | "nextRound"
  | "scoreTimeout"
  | "voteEnd"
  | "voteNext"
  | "bossTimeout"
  | "autoStart"
  | "autoGo";

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
    /** Boss battle: players who called the King this move, and who called for his strike. */
    kingCalls?: Record<string, true>;
    kingStrikes?: Record<string, true>;
    /** Boss battle: the King's strike on screen (the move clock stands still from `at` to `until`). */
    strike?: { at: number; until: number };
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
    /** Boss raid: the creator picked this boss (its strength), so it isn't matched to the group. */
    bossPicked?: number;
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
    /** People's votes, and (once counted) everyone who didn't vote, joined to the winner (`joined`). */
    votes: Record<string, { option: number; at: number; joined?: true }>;
    /** The bots' votes (a few bots don't vote: settings.voteBotSkip). */
    bots: { id: string; option: number; at: number }[];
    result: number | null;
    nextAt?: number;
  };
  /** Boss battle: the boss move the host owes the server. */
  bossKey?: string;
  bossStumble?: boolean;
  bossKind?: "elo" | "stumble" | "stagger";
  /** The boss's move, held until it has "thought" long enough (your queen banner plays first), and when that is. */
  bossPending?: string;
  bossMinAt?: number;
  bossIntroDone?: boolean;
  /**
   * Matchmade ("Play now"): starts by itself when full or at `fillAt`, bots filling the rest. `filledAt`: the seats
   * were filled then (bots pop in on the queue screen) and the match begins FRONT_DOOR.fillShowMs later; `waitMs`:
   * how long its people had waited on average, and how many (for the typical wait under PLAY).
   */
  auto?: {
    /** When bots fill the empty seats (null: Bots off in a 50 v 50, which waits until it's full). */
    fillAt: number | null;
    /**
     * Bots off: no bots, ever. A 50 v 50 waits until it's full; a raid also starts once `fillAt` has passed with
     * MATCHMAKING.raidBotsOffMinPlayers people in it.
     */
    botsOff?: boolean;
    filledAt?: number;
    waitMs?: number;
    waiters?: number;
    waitSaved?: boolean;
  };
  /** Each person's brilliant moves and their moves (SAN and round score) for the best one, for their profile. */
  feats?: Record<string, { brilliant: number; best: { san: string; score: number } | null }>;
  /** When the match began (after any pre-start show). */
  startedAt?: number;
  /** Quick chat (Crowd matches and boss raids, once the match has begun). */
  chat?: ChatRecord;
  /** The last time a person did anything here (joined, left, connected, dropped, sent anything): when it closes. */
  activeAt?: number;
  /** When the match ended (its results came up). */
  endedAt?: number;
  /** How long the results stay up, if not LOBBY_LIFE's (playtests: ?keep=SECONDS on a lobby you create). */
  keepMs?: number;
}

/** What someone is told when they open a match that's over (results still up, or long gone). */
export const MATCH_ENDED = "That match has ended.";

/**
 * When a lobby closes and why (null: not while a match is on with someone connected). Then its Durable Object
 * deletes everything it stored, and its code is free again.
 *   - The match is over: `lobbyResultsKeepMinutes` after it ended (a lobby that ended before this rule existed: now).
 *   - It never started (a private lobby nobody started, a queue everyone left): `lobbyIdleMinutes` after anyone last
 *     did anything in it.
 *   - A match in progress: never while anyone is connected; with nobody connected, `lobbyAbandonedMinutes` after anyone
 *     was last heard from (a safety cap: a match left to itself reaches its results long before; see LOBBY_LIFE).
 * `connected`: anyone is connected right now (the Durable Object counts its open sockets).
 */
export function lobbyClosing(r: LobbyRecord, connected: boolean, life = LOBBY_LIFE): { at: number; reason: LobbyCloseReason } | null {
  const min = 60_000;
  if (r.phase === "results") return { at: (r.endedAt ?? 0) + (r.keepMs ?? life.lobbyResultsKeepMinutes * min), reason: "ended" };
  if (r.phase === "lobby" && !r.auto?.filledAt) return { at: (r.activeAt ?? r.createdAt) + life.lobbyIdleMinutes * min, reason: "idle" };
  if (connected) return null;
  return { at: (r.activeAt ?? r.startedAt ?? r.createdAt) + life.lobbyAbandonedMinutes * min, reason: "abandoned" };
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
const BOSS_KILL_MS = 3800;
const BOSS_TIMEOUT_MS = 15_000;
/** The God King's summoning, cut-in banner and bolt, added to a reveal where he plays the move. */
const KING_FX_MS = 5400;

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
    if (record.moveClock) this.settings = { ...this.settings, moveClockSeconds: record.moveClock, moveClockSteps: [] };
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

  /**
   * The lobby: everyone in it, in the order they took their seats. Looks are big, so they go out only with `looks`:
   * everyone's to a player who (re)joins, only the newcomer's to the others.
   */
  private lobbyMessage(looks: "all" | string | null = null): Outgoing {
    const uid = (id: string) => this.r.accounts?.[id];
    return {
      t: "lobby",
      players: [
        ...this.r.humans.map((h) => {
          const withLook = (looks === "all" || looks === h.id) && h.look && Object.keys(h.look).length;
          return { id: h.id, name: h.name, isBot: false, connected: h.connected, ...(uid(h.id) ? { uid: uid(h.id) } : {}), ...(withLook ? { look: h.look } : {}) };
        }),
        ...this.r.bots.map((b) => ({ id: b.id, name: b.name, isBot: true, connected: true })),
      ],
      hostId: this.r.hostId,
      started: this.r.phase !== "lobby" || !!this.r.auto?.filledAt,
      lobbySize: this.settings.lobbySize,
      ...(this.r.auto
        ? { auto: true, fillAt: this.r.auto.fillAt, ...(this.r.auto.botsOff ? { botsOff: true } : {}), ...(this.r.auto.filledAt ? { filledAt: this.r.auto.filledAt } : {}) }
        : {}),
    };
  }

  /** Matchmaking: this lobby still takes players (open, not full, and, unless Bots off, a few seconds left before bots fill it). */
  joinable(): boolean {
    const a = this.r.auto;
    if (this.r.phase !== "lobby" || !a || a.filledAt || this.r.humans.length >= this.settings.lobbySize) return false;
    return !!a.botsOff || (a.fillAt !== null && this.io.now() < a.fillAt - 2000);
  }

  /** Bots off: enough people to begin (full; or a raid that has waited its minute with enough for a crowd). */
  private botsOffReady(): boolean {
    const a = this.r.auto;
    const people = this.r.humans.length;
    if (people >= this.settings.lobbySize) return true;
    return !!this.settings.raid && a?.fillAt != null && this.io.now() >= a.fillAt && people >= MATCHMAKING.raidBotsOffMinPlayers;
  }

  /** Matchmade and still waiting, and its time has come: Default once the fill time has passed; Bots off once ready. */
  private dueToStart(): boolean {
    const a = this.r.auto;
    if (!a || a.filledAt || this.r.phase !== "lobby") return false;
    if (a.botsOff) return this.botsOffReady();
    return a.fillAt !== null && this.io.now() >= a.fillAt;
  }

  /**
   * Bots off → Default ("let bots fill"): this person leaves this Bots off lobby for a Default one, keeping their wait
   * (when they joined here). Null if they can't any more (it started meanwhile).
   */
  release(token: string): { joinedAt: number } | null {
    const h = this.r.humans.find((x) => x.token === token);
    if (!h || !this.r.auto?.botsOff || this.r.auto.filledAt || this.r.phase !== "lobby") return null;
    const joinedAt = h.joinedAt ?? this.io.now();
    this.leave(h.id);
    return { joinedAt };
  }

  /**
   * Someone arrived from Bots off having already waited: bots fill no later than `at` (a minute after they first
   * joined), but not sooner than MATCHMAKING.switchMinWaitMs from now.
   */
  hurry(at: number) {
    const a = this.r.auto;
    if (!a || a.botsOff || a.filledAt || a.fillAt === null || this.r.phase !== "lobby") return;
    const fillAt = Math.max(this.io.now() + MATCHMAKING.switchMinWaitMs, Math.min(a.fillAt, at));
    if (fillAt >= a.fillAt) return;
    a.fillAt = fillAt;
    this.setTimer("autoStart", fillAt);
    this.broadcast(this.lobbyMessage(), false);
  }

  private standings(): NetStanding[] {
    const looks = new Map(this.r.humans.flatMap((h) => (h.look && Object.keys(h.look).length ? [[h.id, h.look] as const] : [])));
    // A person's account, so a tap on their name opens their profile.
    const uid = (id: string) => this.r.accounts?.[id];
    return (this.runner?.leaderboard() ?? []).map((s) => ({ ...s, ...(looks.has(s.id) ? { look: looks.get(s.id)! } : {}), ...(uid(s.id) ? { uid: uid(s.id) } : {}) }));
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

  connect(
    token: string | undefined,
    name: string | undefined,
    device: "phone" | "computer" = "computer",
    practice = false,
    rating: number | null = null,
    look: unknown = undefined,
    userId?: string,
  ) {
    this.r.activeAt = this.io.now();
    const existing = token ? this.r.humans.find((h) => h.token === token) : undefined;
    if (existing) {
      existing.connected = true;
      if (look !== undefined) existing.look = cleanLook(look);
      if (userId) this.r.accounts = { ...(this.r.accounts ?? {}), [existing.id]: userId };
      if (!this.r.hostId || !this.human(this.r.hostId)?.connected) this.r.hostId = existing.id;
      this.send(existing.id, { t: "welcome", playerId: existing.id, token: existing.token, code: this.r.code }, false);
      this.broadcast(this.lobbyMessage(existing.id), false);
      const last = this.r.last[existing.id];
      if (last) this.send(existing.id, last, false);
      this.resendHostWork();
      // Matchmade, and its time came while nobody was here (nothing started it): start now (bots fill the rest unless Bots off).
      if (!this.r.timer && this.dueToStart()) this.startMatch();
      return { ok: true as const, playerId: existing.id };
    }
    // A seat this lobby never gave out: from an older lobby that had this code (it has closed since), so that match is over.
    if (token) return { ok: false as const, message: MATCH_ENDED, ended: true as const };
    if (this.r.phase === "results") return { ok: false as const, message: MATCH_ENDED, ended: true as const };
    if (this.r.phase !== "lobby" || this.r.auto?.filledAt) return { ok: false as const, message: "This match has already started." };
    if (this.r.humans.length >= this.settings.lobbySize) return { ok: false as const, message: "This lobby is full." };
    const clean = (name ?? "").replace(/\s+/g, " ").trim().slice(0, 16) || `Player ${this.r.humans.length + 1}`;
    const id = `p${++this.r.counter}`;
    const newToken = Array.from({ length: 24 }, () => Math.floor(this.rng() * 16).toString(16)).join("");
    this.r.humans.push({
      id,
      name: clean,
      token: newToken,
      connected: true,
      device,
      practice,
      rating: typeof rating === "number" && Number.isFinite(rating) ? Math.max(400, Math.min(3400, rating)) : null,
      look: cleanLook(look),
      joinedAt: this.io.now(),
    });
    if (userId) this.r.accounts = { ...(this.r.accounts ?? {}), [id]: userId };
    if (!this.r.hostId) this.r.hostId = id;
    this.send(id, { t: "welcome", playerId: id, token: newToken, code: this.r.code }, false);
    this.broadcast(this.lobbyMessage(id), false);
    // Matchmade and full (or, Bots off, ready): start now.
    if (this.r.auto && (this.r.humans.length >= this.settings.lobbySize || (this.r.auto.botsOff && this.botsOffReady()))) this.startMatch();
    return { ok: true as const, playerId: id };
  }

  /** Sends a (re)connected player everything they need: welcome, lobby, the current phase, any host work. */
  resendTo(playerId: string) {
    const h = this.human(playerId);
    if (!h) return;
    this.io.send(playerId, { t: "welcome", playerId, token: h.token, code: this.r.code });
    this.io.send(playerId, this.lobbyMessage("all"));
    const last = this.r.last[playerId];
    if (last) this.io.send(playerId, last);
    if (playerId === this.r.hostId) this.resendHostWork();
    this.sendChatLog(playerId);
  }

  disconnect(playerId: string) {
    const h = this.human(playerId);
    if (!h) return;
    h.connected = false;
    this.r.activeAt = this.io.now();
    if (this.r.hostId === playerId) {
      this.r.hostId = this.pickHost(playerId) ?? playerId;
      this.resendHostWork();
    }
    this.broadcast(this.lobbyMessage(), false);
  }

  /** Leaving before the match starts (Cancel in the queue, Leave in a lobby): the seat is free again. */
  leave(playerId: string) {
    if (this.r.phase !== "lobby" || this.r.auto?.filledAt || !this.human(playerId)) return;
    this.r.activeAt = this.io.now();
    this.r.humans = this.r.humans.filter((h) => h.id !== playerId);
    delete this.r.last[playerId];
    if (this.r.accounts?.[playerId]) {
      const { [playerId]: _gone, ...rest } = this.r.accounts;
      this.r.accounts = rest;
    }
    if (this.r.hostId === playerId) this.r.hostId = this.pickHost(playerId);
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
    if (this.human(playerId)) this.r.activeAt = this.io.now();
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
        if (this.r.phase !== "play" || round?.key !== msg.key || !this.runner?.boss?.kingCharges || !this.runner.player(playerId)?.alive) return;
        if (msg.strike) return this.callStrike(playerId);
        // Calling the King to play the move is this player's whole turn: no move of their own.
        if (round.picks[playerId] || this.called(playerId)) return;
        (round.kingCalls ??= {})[playerId] = true;
        for (const h of this.r.humans) this.send(h.id, { t: "moved", key: round.key, playerId }, false);
        this.sendTally();
        if (this.roundHumans().every((h) => round.picks[h.id] || this.called(h.id))) this.lock();
        return;
      }
      case "bossMove":
        if (playerId === this.r.hostId && this.r.phase === "boss" && this.r.bossKey === msg.key) this.playBoss(msg.move);
        return;
      case "leave":
        return this.leave(playerId);
      case "chat":
        return this.chatSay(playerId, msg.say, msg.to);
      case "chatPrefs":
        return this.chatPrefs(playerId, msg.off, msg.muted);
      case "hello":
        return;
    }
  }

  // ---------------- Match flow ----------------

  private start(playerId: string) {
    if (this.r.phase !== "lobby" || playerId !== this.r.hostId || this.r.auto) return;
    this.startMatch();
  }

  /**
   * Fills the empty seats with bots and starts: the pre-game votes (Crowd 50 v 50) or the opening. A matchmade
   * lobby first shows the full lobby for FRONT_DOOR.fillShowMs (the bots popping into their seats on the queue
   * screen), then begins.
   */
  private startMatch() {
    if (this.r.phase !== "lobby" || this.r.auto?.filledAt) return;
    if (this.settings.raid && !this.r.overrides?.bossPicked) {
      // Boss raid: no bots; the boss is the one the creator picked, else the weakest that's stronger than the group's average rating.
      const patch = { bossFixedElo: raidBossElo(this.r.humans.map((h) => h.rating ?? null)) };
      this.r.overrides = { ...(this.r.overrides ?? {}), ...patch } as LobbyRecord["overrides"];
      this.settings = { ...this.settings, ...patch };
    }
    // Bots fill the empty seats, except with Bots off, and in a private raid (people only, as before). A matchmade
    // raid's bots join the crowd.
    const empty = this.r.auto?.botsOff || (this.settings.raid && !this.r.auto) ? 0 : this.settings.lobbySize - this.r.humans.length;
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
    if (this.r.auto) {
      const waiting = this.r.humans.filter((h) => h.connected && h.joinedAt !== undefined);
      this.r.auto.filledAt = now;
      this.r.auto.waiters = waiting.length;
      this.r.auto.waitMs = waiting.length ? waiting.reduce((a, h) => a + (now - h.joinedAt!), 0) / waiting.length : 0;
      this.broadcast(this.lobbyMessage(), false);
      this.setTimer("autoGo", now + FRONT_DOOR.fillShowMs);
      return;
    }
    this.begin();
  }

  /** The match begins: the pre-game votes, the boss's intro (a raid) or the opening. */
  private begin() {
    const runner = this.runner!;
    const now = this.io.now();
    const voting = pregameVotes(this.settings).length > 0;
    this.r.phase = voting ? "vote" : "opening";
    this.r.startedAt = now;
    this.broadcast(this.lobbyMessage(), false);
    // Quick chat opens with the match (and a bot or two wishes everyone luck).
    for (const h of this.r.humans) this.sendChatLog(h.id);
    this.botChat({ kind: "start" });
    if (voting) return this.startVote(0);
    // Boss raid: straight to the boss's intro, which replays the opening from the starting position itself.
    if (this.settings.raid) return this.setTimer("startRound", now + 300);
    this.broadcast({
      t: "opening",
      boards: [...runner.boards.values()].map((b) => netBoard(b, true)),
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
      case "bossPlay":
        this.r.bossMinAt = undefined;
        return this.r.bossPending ? this.playBoss(this.r.bossPending) : undefined;
      case "autoStart":
        // Matchmade: time's up, bots fill the rest (if anyone is still here). Bots off: a raid with enough people begins.
        if (this.r.humans.some((h) => h.connected) && this.dueToStart()) this.startMatch();
        return;
      case "autoGo":
        if (this.r.phase === "lobby" && this.runner) this.begin();
        return;
    }
  }

  /**
   * Arms the matchmaking timer (called once when the lobby is made for PLAY). `fillAt`: when bots fill the empty seats;
   * Bots off: when a raid may begin with fewer than 50 (null: a 50 v 50, which waits until it's full).
   */
  setAuto(fillAt: number | null, botsOff = false) {
    this.r.auto = { fillAt, ...(botsOff ? { botsOff: true } : {}) };
    if (fillAt !== null) this.setTimer("autoStart", fillAt);
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
        ...Object.entries(v.votes).map(([playerId, x]) => ({ playerId, option: x.option, at: x.at, side: side(playerId), ...(x.joined ? { joined: true as const } : {}) })),
      ],
      result: v.result,
      ...(v.nextAt ? { nextAt: v.nextAt } : {}),
      ...(this.settings.voteChangeAllowed ? { changeAllowed: true } : {}),
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
      bots: botVotes(this.rng, bots, def.options.length, ms, this.settings.voteBotSkip).map((b) => ({ id: b.id, option: b.option, at: now + b.atMs })),
      result: null,
    };
    this.r.phase = "vote";
    this.broadcast({ t: "vote", vote: this.voteView(), standings: this.standings() });
    this.setTimer("voteEnd", now + ms);
  }

  private castVote(playerId: string, key: string, option: number) {
    const v = this.r.vote;
    if (this.r.phase !== "vote" || !v || v.key !== key || v.result !== null) return;
    const now = this.io.now();
    if (now > v.until + this.settings.lateGraceMs || !Number.isInteger(option) || option < 0 || option > 2 || !this.runner?.player(playerId)) return;
    // One vote each (a later one replaces it only with voteChangeAllowed on).
    const had = v.votes[playerId];
    if (!castPregameVote(had ? [{ playerId, option: had.option }] : [], { playerId, option }, this.settings.voteChangeAllowed)) return;
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
    // The winner, then everyone who didn't vote (people and bots) joins it: they walk there now.
    const cast = [...v.bots.map((b) => ({ playerId: b.id, option: b.option })), ...Object.entries(v.votes).map(([playerId, x]) => ({ playerId, option: x.option }))];
    const everyone = this.runner!.state.players.map((p) => p.id);
    const { result, joined } = closePregameVote(cast, everyone, def, this.rng, (playerId, option) => ({ playerId, option }));
    v.result = result;
    const now = this.io.now();
    for (const id of joined) v.votes[id] = { option: result, at: now, joined: true };
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
    // You just took its queen: the boss's reply waits for your banner (otherwise it shows as soon as it's ready).
    const history = this.runner!.boards.get(this.runner!.state.boards[0]!)!.history;
    this.r.bossMinAt = lastMoveTookQueen(history) ? this.io.now() + bossThinkMs(history) : undefined;
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
    // Too soon (your queen banner is still up): hold the move until then.
    if (this.r.bossMinAt && this.io.now() < this.r.bossMinAt - 50) {
      this.r.bossPending = move;
      return this.setTimer("bossPlay", this.r.bossMinAt);
    }
    this.r.bossPending = undefined;
    this.runner!.applyBossMove(move);
    const until = this.io.now() + bossShowMs(this.runner!.bossView()?.lastMove);
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
        const until = this.io.now() + bossIntroTimeline(runner.boards.get(runner.state.boards[0]!)!.history.length).total;
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
      const clock = clockAfterVote(runner.moveClock(), Object.values(this.r.augmentVotes), this.settings);
      this.r.augmentVotes = undefined;
      this.r.moveClock = clock;
      this.settings = { ...this.settings, moveClockSeconds: clock, moveClockSteps: [] };
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
    for (const h of playing) deadlines[h.id] = now + runner.allowedMsFor(h.id);
    const deadline = Math.max(now, ...Object.values(deadlines));
    this.r.round = { key, deadline, deadlines, startedAt: now, picks: {}, powerUps: {}, ...(final ? {} : { botsDoneIn: runner.botThinkTimes() }) };
    this.r.phase = "play";
    const st = this.standings();
    const cutoff = this.cutoff();
    const alive = new Set(runner.alive().map((p) => p.id));
    const inRound = new Set(playing.map((h) => h.id));
    const crowd = this.settings.mode === "crowd";
    const bossNow = runner.boss ? runner.bossView()! : undefined;
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
        // This move's clock (the Variable speed's rises as the game goes on).
        moveClock: runner.moveClock(),
        ...(bossNow ? { boss: bossNow } : {}),
      });
      if (final) this.send(h.id, { t: "final", final: runner.finalView()!, standings: st, slots: this.slots() }, !inRound.has(h.id));
      else if (!alive.has(h.id)) this.sendSpectate(h.id);
    }
    if (this.r.hostId) {
      const fens = [...runner.groups.keys()].map((id) => runner.boards.get(id)!.fen);
      const skills = new Map(this.r.bots.map((b) => [b.id, b.skill]));
      const ids = [...runner.groups.values()][0] ?? [];
      // Crowd: the host decides the bots' picks now, so everyone who has picked can watch them come in.
      const barred = runner.boss?.barred;
      const plan =
        crowd && !final
          ? { key, fen: fens[0]!, bots: ids.filter((id) => skills.has(id)).map((id) => ({ id, skill: skills.get(id)!, powerUps: runner.player(id).powerUps })), ...(barred ? { barred } : {}) }
          : undefined;
      this.send(this.r.hostId, { t: "prefetch", fens, ...(plan ? { plan } : {}) }, false);
    }
    if (!playing.length) {
      // Only bots this round: in the final a bot "thinks" for its recorded time first; in Crowd the watching team sees
      // the vote come in for a few seconds.
      if (crowd && !final) return this.setTimer("lock", now + Math.min(runner.moveClock() * 1000, 5000));
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

  /** Boss battle: this player called the King to play this move instead of picking. */
  private called(playerId: string): boolean {
    return !!this.r.round?.kingCalls?.[playerId];
  }

  /**
   * Boss battle: a call for the King's strike. When enough have called he strikes now: everyone sees it, the
   * move clock stands still while he does (every deadline, and every bot still thinking, moves back by that
   * long), and then the move goes on.
   */
  private callStrike(playerId: string) {
    const round = this.r.round!;
    const runner = this.runner!;
    const now = this.io.now();
    if (round.kingStrikes?.[playerId] || round.strike || now < round.startedAt - 500 || now > round.deadline) return;
    (round.kingStrikes ??= {})[playerId] = true;
    runner.kingStrikers = new Set(Object.keys(round.kingStrikes));
    const { struck, calls } = runner.callStrike(playerId);
    const crowd = ([...runner.groups.values()][0] ?? []).length;
    const needed = Math.floor(crowd / 2) + 1;
    if (!struck) {
      for (const h of this.roundHumans()) this.send(h.id, { t: "strike", key: round.key, calls, needed }, false);
      return;
    }
    const ms = this.settings.kingStrikeMs;
    round.strike = { at: now, until: now + ms };
    round.deadline += ms;
    for (const id of Object.keys(round.deadlines)) round.deadlines[id]! += ms;
    for (const [id, at] of Object.entries(round.botsDoneIn ?? {})) if (round.startedAt + at > now) round.botsDoneIn![id] = at + ms;
    for (const h of this.roundHumans()) {
      this.send(h.id, { t: "strike", key: round.key, calls, needed, at: now, until: now + ms, deadline: round.deadlines[h.id] ?? round.deadline });
    }
    this.sendTally();
    this.setTimer("lock", round.deadline + this.settings.lateGraceMs);
  }

  /** Time spent on this move so far (or up to `upTo`), leaving out the King's strike. */
  private thinkTime(round: NonNullable<LobbyRecord["round"]>, upTo: number): number {
    const s = round.strike;
    const frozen = s ? Math.max(0, Math.min(upTo, s.until) - s.at) : 0;
    return Math.max(0, upTo - round.startedAt - frozen);
  }

  private pick(playerId: string, key: string, move: string) {
    const round = this.r.round;
    if (this.r.phase !== "play" || !round || round.key !== key || round.picks[playerId] || this.called(playerId)) return;
    const now = this.io.now();
    const deadline = round.deadlines?.[playerId] ?? round.deadline;
    if (now > deadline + this.settings.lateGraceMs) return; // Late picks count as a miss.
    if (now < round.startedAt - 500) return; // Before the clock starts.
    const board = this.runner?.boardOf(playerId);
    if (!board || !legalMoves(board.fen).includes(move)) return;
    // The re-pick after the God King's Last Stand: the move he took back can't be picked.
    if (move === this.runner?.boss?.barred) return;
    round.picks[playerId] = { move, thinkMs: Math.min(this.thinkTime(round, now), this.thinkTime(round, deadline)) };
    for (const h of this.r.humans) this.send(h.id, { t: "moved", key, playerId }, false);
    this.sendTally();
    if (this.roundHumans().every((h) => round.picks[h.id] || this.called(h.id))) this.lock();
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
      if (!alive || (playing.has(h.id) && !round.picks[h.id] && !this.called(h.id))) continue;
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
      ...(this.runner!.boss?.barred ? { barred: this.runner!.boss.barred } : {}),
    }));
    this.r.scoreRequest = { key: this.r.round.key, jobs };
    for (const h of this.r.humans) this.io.send(h.id, { t: "locked", key: this.r.round.key });
    const host = this.r.hostId && this.human(this.r.hostId)?.connected ? this.r.hostId : this.pickHost();
    this.r.hostId = host;
    if (host) this.io.send(host, { t: "scoreRequest", ...this.r.scoreRequest, ...(this.io.serverEngine ? { serverRecheck: true } : {}) });
    this.setTimer("scoreTimeout", this.io.now() + SCORE_TIMEOUT_MS);
  }

  private scoreTimeout() {
    if (this.r.phase !== "scoring" || !this.r.scoreRequest) return;
    const next = this.pickHost(this.r.hostId ?? undefined);
    if (next && next !== this.r.hostId) {
      this.r.hostId = next;
      this.broadcast(this.lobbyMessage(), false);
      this.io.send(next, { t: "scoreRequest", ...this.r.scoreRequest, ...(this.io.serverEngine ? { serverRecheck: true } : {}) });
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
    const byBoard = new Map(boards.map((b) => [b.boardId, b]));
    const results = this.r.scoreRequest!.jobs.map((job) => {
      const s = byBoard.get(job.boardId);
      const ids = runner.groups.get(job.boardId)!;
      const picks: Record<string, string | null> = { ...job.humanPicks };
      // (The re-pick after the God King's Last Stand: no bot takes the move he took back.)
      const legal = legalMoves(job.fen).filter((m) => m !== job.barred);
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
      // (The host's replies and mates from the same searches: what a blunder loses, for the God King's Last Stand.)
      return runner.resolveBoard(job.boardId, ids, picks, { bestMove, bestExpected, expectedAfter, ...(s?.replies ? { replies: s.replies } : {}), ...(s?.mates ? { mates: s.mates } : {}) });
    });
    const think = Object.fromEntries(Object.entries(round.picks).map(([id, p]) => [id, p.thinkMs]));
    // A miss uses the whole of the player's time for the move.
    for (const h of this.roundHumans()) think[h.id] ??= this.thinkTime(round, round.deadlines?.[h.id] ?? round.deadline);
    const report = runner.finishRound(results, think, new Set(Object.keys(round.powerUps ?? {})));
    this.noteFeats(report);
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
    // Crowd: a bot on the team that made a great move may say so.
    const crowdBoard = this.settings.mode === "crowd" ? report.boards[0] : undefined;
    const playedLoss = crowdBoard?.result.players.find((p) => p.move === crowdBoard.result.playedMove)?.loss;
    if (crowdBoard && playedLoss != null) {
      const bots = new Set(this.r.bots.map((b) => b.id));
      this.botChat({ kind: "greatMove", loss: playedLoss }, crowdBoard.playerIds.filter((id) => bots.has(id) && runner.player(id).alive));
    }
    const kingActs = report.boards.some((b) => b.king);
    // The God King's Last Stand plays out in the reveal (the next move's clock starts after it: nobody loses time).
    const stand = report.boards.some((b) => b.lastStand);
    const until = this.io.now() + (this.settings.revealSeconds + this.settings.drawnMoveSeconds) * 1000 + (kingActs ? KING_FX_MS : 0) + (stand ? LAST_STAND_MS : 0);
    const bossNow = runner.boss ? runner.bossView()! : undefined;
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
        picks: mine?.result.players.map((p) => ({ playerId: p.playerId, move: p.move, loss: p.loss, roundScore: p.roundScore, ...(p.usedPowerUp ? { usedPowerUp: true } : {}) })) ?? [],
        drawRule: mine?.result.drawRule ?? "random",
        ...(mine?.king !== undefined ? { king: mine.king, kingCalls: mine.kingCalls } : {}),
        ...(mine?.lastStand ? { lastStand: mine.lastStand } : {}),
        ...(bossNow ? { boss: bossNow } : {}),
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
      ...(augments ? { augments: true, moveClock: runner.moveClock() } : {}),
    });
    this.setTimer("nextRound", until);
  }

  // ---------------- Results ----------------

  /** After each round: people's brilliant moves and best picks, for their profiles. */
  private noteFeats(report: RoundReport) {
    const humans = new Set(this.r.humans.map((h) => h.id));
    for (const b of report.boards) {
      const bril = brilliance(b.result.players);
      for (const p of b.result.players) {
        if (!humans.has(p.playerId) || !p.move) continue;
        const f = ((this.r.feats ??= {})[p.playerId] ??= { brilliant: 0, best: null });
        const brilliant = !!bril?.players.includes(p.playerId);
        if (brilliant) f.brilliant++;
        // The best: a brilliant move, else the pick that beat the field by most (the later of equals; see bestMoveOf).
        const score = p.roundScore + (brilliant ? 1e6 : 0);
        if (!f.best || score >= f.best.score) f.best = { san: toSan(b.fenBefore, p.move), score };
      }
    }
  }

  /** Each human's result once the match is over (for their profiles). */
  humanResults(): ({
    playerId: string;
    placement: number;
    players: number;
    team: "w" | "b" | null;
    teamWon: boolean | null;
    avgScore: number | null;
    rating: number | null;
    brilliant: number;
    bestMove: string | null;
    /** It counts for their ranking: enough real players (isRankedMatch), and they weren't practising (unlimited hints). */
    ranked: boolean;
  } & MatchFeats)[] {
    const runner = this.runner;
    if (!runner || this.r.phase !== "results") return [];
    const st = this.standings();
    const winner = this.settings.mode === "crowd" ? runner.gameWinner() : null;
    const boss = runner.boss;
    const stages = this.settings.knockoutsPerStage.length;
    return this.r.humans.flatMap((h) => {
      const row = st.find((s) => s.id === h.id);
      const placement = this.r.placements[h.id];
      if (!row || !placement) return [];
      const team = row.team ?? null;
      // Boss battle: those still standing at the end share the result.
      const p = runner.player(h.id);
      const reachedBoss = p.outInStage === null || p.outInStage >= stages;
      const survived = !!boss && reachedBoss && !boss.kills.some((k) => k.id === h.id);
      const teamWon = boss?.result ? (survived && boss.result !== "draw" ? boss.result === "crowd" : null) : team && winner ? team === winner : null;
      const f = this.r.feats?.[h.id];
      return [
        {
          playerId: h.id,
          placement,
          players: runner.state.players.length,
          team,
          teamWon,
          avgScore: row.avg ?? null,
          rating: row.rating ?? null,
          brilliant: f?.brilliant ?? 0,
          bestMove: f?.best?.san ?? null,
          ranked: this.ranked() && !h.practice,
          ...matchFeats(p, stages, boss, !!this.settings.raid),
        },
      ];
    });
  }

  /**
   * The match counts for ranking: real players fill at least RANKING.rankedMinHumanShare of the mode's seats (30 of a
   * 50 v 50's 100, 15 of a raid's 50). A match that started short (a raid with Bots off) counts its empty seats too.
   */
  ranked(): boolean {
    const players = this.runner?.state.players ?? [];
    return isRankedMatch(players.filter((p) => !p.isBot).length, Math.max(this.settings.lobbySize, players.length));
  }

  /** What the live line and the "playing now" list need to know about this lobby. */
  liveSummary(): { phase: "waiting" | "playing" | "over"; humans: number; alive: number | null; total: number | null; bossElo: number | null; startedAt: number | null } {
    const runner = this.runner;
    const phase = this.r.phase === "results" ? "over" : this.r.phase === "lobby" && !this.r.auto?.filledAt ? "waiting" : "playing";
    return {
      phase,
      humans: this.r.humans.filter((h) => h.connected).length,
      alive: runner && phase === "playing" ? runner.alive().length : null,
      total: runner ? runner.state.players.length : null,
      bossElo: this.settings.raid ? (this.settings.bossFixedElo ?? null) : null,
      startedAt: this.r.startedAt ?? this.r.auto?.filledAt ?? null,
    };
  }

  private finishMatch() {
    const runner = this.runner!;
    for (const p of runner.state.players) this.r.placements[p.id] = p.placement!;
    this.r.phase = "results";
    this.r.timer = null;
    this.r.endedAt = this.io.now();
    const winner = runner.state.players.find((p) => p.placement === 1);
    const msg: Outgoing = {
      t: "results",
      placements: { ...this.r.placements },
      winner: winner ? this.nameOf(winner.id) : "",
      lossesByStage: Object.fromEntries(this.r.humans.map((h) => [h.id, runner.player(h.id).lossesByStage])),
      standings: this.standings(),
      ...(this.settings.mode === "crowd" ? { gameWinner: runner.gameWinner() } : {}),
      ...(runner.boss?.result ? { bossResult: runner.boss.result } : {}),
      // Whether it counted for ranking (the results say so in words).
      ranked: this.ranked(),
    };
    this.broadcast(msg);
    this.botChat({ kind: "end" });
  }

  // ---------------- Quick chat ----------------

  private get chat(): ChatRecord {
    return (this.r.chat ??= { n: 0, lines: [], sent: {}, owned: {}, iconTo: {}, off: {}, muted: {}, bots: [] });
  }

  /** Chat is on in Crowd matches (50 v 50, everyone moves) and boss raids, once the match has begun (not in the queue, not Classic). */
  chatOpen(): boolean {
    return this.settings.mode === "crowd" && this.r.phase !== "lobby";
  }

  /** A player's side in a 50 v 50 (null when there are no teams). */
  private chatSide(id: string): "w" | "b" | null {
    if (!this.runner || !this.settings.crowdTeams) return null;
    return this.runner.state.players.find((p) => p.id === id)?.colour ?? null;
  }

  /** The team a line goes to: the sender's side, or null (everyone) when everyone is one team, as in a boss battle. */
  private chatTeam(id: string): "w" | "b" | null {
    return this.runner?.boss ? null : this.chatSide(id);
  }

  /** Whether a player is sent a line: chat on, sender not muted, and the line to everyone or to their team. */
  private chatHears(id: string, line: NetChatLine): boolean {
    const c = this.chat;
    if (c.off[id]) return false;
    if (line.from === id) return true;
    if (c.muted[id]?.includes(line.from)) return false;
    return line.to === "all" || line.team === null || this.chatSide(id) === line.team;
  }

  /** The line with its sender's icon, if this player hasn't been sent that icon yet. */
  private withIcon(to: string, line: NetChatLine): NetChatLine {
    const icon = this.io.icon?.(line.from);
    if (!icon) return line;
    const has = (this.chat.iconTo[to] ??= []);
    if (has.includes(line.from)) return line;
    has.push(line.from);
    return { ...line, icon };
  }

  /** Quick chat: what this person's account owns (shop item ids), so the packs they bought work. */
  chatOwned(playerId: string, owned: readonly string[]) {
    this.chat.owned[playerId] = owned.filter((x) => typeof x === "string").slice(0, 200);
  }

  /** The recent lines this player can see, and their packs (chat has opened, or they're back). */
  private sendChatLog(id: string) {
    if (!this.chatOpen() || !this.human(id)) return;
    const c = this.chat;
    c.iconTo[id] = [];
    const lines = c.lines.filter((l) => this.chatHears(id, l)).slice(-QUICK_CHAT.feedSize);
    this.io.send(id, { t: "chatLog", lines: lines.map((l) => this.withIcon(id, l)), packs: ownedChatPacks(c.owned[id]) });
  }

  private chatPost(line: Omit<NetChatLine, "n">) {
    const c = this.chat;
    const full: NetChatLine = { n: ++c.n, ...line };
    c.lines = [...c.lines, full].slice(-QUICK_CHAT.logSize);
    for (const h of this.r.humans) {
      // (Someone away gets the recent lines when they're back.)
      if (h.connected && this.chatHears(h.id, full)) this.io.send(h.id, { t: "chat", line: this.withIcon(h.id, full) });
    }
  }

  /**
   * A person says a line. Only known lines they own, Hello and Sporting lines and emoji alone to everyone, within the
   * limits (one every 3 s, 5 in 30 s, no repeats): anything else is dropped and the sender told why. (Which of their
   * lines show as buttons is their profile's picks: the app's business. Any line they own may go.)
   */
  private chatSay(playerId: string, say: unknown, to: unknown) {
    const now = this.io.now();
    const c = this.chat;
    const refuse = (reason: ChatRefusal, retryAt = now) => this.io.send(playerId, { t: "chatNo", say: String(say).slice(0, 40), reason, retryAt });
    if (!this.chatOpen() || !this.human(playerId)) return refuse("closed");
    if (c.off[playerId]) return refuse("off");
    const line = chatSay(say);
    if (!line) return refuse("unknown");
    if (!canSay(line.id, c.owned[playerId])) return refuse("locked");
    const toAll = to === "all";
    if (toAll && !canSayToAll(line.id)) return refuse("team");
    const sent = c.sent[playerId] ?? noChatSent();
    const check = chatCheck(sent, line.id, now);
    if (!check.ok) return refuse(check.limit, check.retryAt);
    c.sent[playerId] = chatSent(sent, line.id, now);
    this.chatPost({ from: playerId, say: line.id, to: toAll ? "all" : "team", team: this.chatTeam(playerId), at: now });
  }

  /** This device's chat choices: chat off, and who it muted for the match (their lines aren't sent to it). */
  private chatPrefs(playerId: string, off: unknown, muted: unknown) {
    if (!this.human(playerId)) return;
    const c = this.chat;
    const wasOff = !!c.off[playerId];
    if (off === true) c.off[playerId] = true;
    else if (off === false) delete c.off[playerId];
    if (Array.isArray(muted)) {
      const ids = new Set([...this.r.humans.map((h) => h.id), ...this.r.bots.map((b) => b.id)]);
      c.muted[playerId] = [...new Set(muted.filter((m): m is string => typeof m === "string" && m !== playerId && ids.has(m)))].slice(0, 100);
    }
    // Back on: the lines missed meanwhile.
    if (wasOff && !c.off[playerId]) this.sendChatLog(playerId);
  }

  /** Bots chat a little (see botChatLines): their lines are sent now, shown a moment later (`at`). */
  private botChat(moment: BotChatMoment, from?: string[]) {
    if (!this.chatOpen() || !this.r.bots.length) return;
    const c = this.chat;
    const now = this.io.now();
    // Their own randomness, so chat never changes how the match plays out.
    let seed = 0;
    for (const ch of this.r.code) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
    const rng = mulberry32((seed ^ Math.imul(this.r.counter + 1, 2654435761) ^ Math.imul(c.n + c.bots.length + 1, 40503)) >>> 0);
    const lines = botChatLines(rng, moment, from ?? this.r.bots.map((b) => b.id), c.bots, now);
    for (const l of lines) {
      const at = now + l.delayMs;
      c.bots = [...c.bots.filter((t) => t > now - 120_000), at];
      this.chatPost({ from: l.from, say: l.say, to: l.to, team: this.chatTeam(l.from), at });
    }
  }
}
