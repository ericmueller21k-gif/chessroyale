import { QUICK_CHAT, botChatLines, canSay, canSayToAll, chatCheck, chatSay, chatSent, mulberry32, noChatSent, ownedChatPacks, type BotChatMoment, type ChatSent } from "@chessroyale/core";
import { FAIRPLAY, type FairMove } from "@chessroyale/core";
import { BOSS_POWERS, DEFAULT_SETTINGS, JUDGES, isTeamMatch, type JudgeConfig, FRONT_DOOR, LOBBY_LIFE, MATCHMAKING, isRankedMatch, brilliance, cleanLook, matchFeats, type ItemLook, type MatchFeats, botVotes, castPregameVote, closePregameVote, raidBossElo, bossDef, clockAfterVote, cutSeconds, pregameVotes, type Augment, type DrawRule, type Settings } from "@chessroyale/core";
import {
  MatchRunner,
  botRoster,
  bossIntroTimeline,
  judgeTaps,
  lightsOutTimeline,
  type NetLightsOut,
  bossShowMs,
  bossThinkMs,
  powerMomentMs,
  LAST_STAND_MS,
  lastMoveTookQueen,
  legalMoves,
  netBoard,
  boardSlots,
  toSan,
  type BoardRound,
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
  applyRecheck,
  blameJudge,
  deepTargets,
  quickPart,
  boardsAgree,
  distanceFrom,
  judgedBoard,
  recheckTargets,
  kingMoveMs,
  kingStrikeMs,
  lightsDeadline,
  lightsRoundEnd,
  verdictBoard,
  verdictMoves,
  type JudgedBoard,
  type JudgeJob,
  type JudgeReport,
  type MoveScore,
} from "@chessroyale/chess";
import { assignJudges, cutBubble, drawJudges, emptyStats, seedFor, type JudgeDevice, type JudgeHow, type JudgeStats, type JudgeTask } from "./judges.ts";

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
  /** Many judges: the settings (default JUDGES), and the random source for drawing judges and spot checks. */
  judges?: JudgeConfig;
  judgeRng?: () => number;
  /**
   * Many judges: a deep search on the engine server (`boards`: how many boards share its time this round). The
   * answer comes back through serverScored(id, …), null if the server couldn't answer (down, out of budget, slow).
   */
  serverScore?(req: ServerScoreRequest): void;
  /** Many judges: how each of the round's jobs was settled, as the round's scores go in (the harness measures with it). */
  settled?(jobs: { id: string; boardId: number; how: JudgeHow; judges: string[]; board: JudgedBoard }[]): void;
}

/** A deep search the lobby asks of the engine server (a verdict, a re-check of close calls, a spot check). */
export interface ServerScoreRequest {
  id: string;
  fen: string;
  moves: string[];
  boards: number;
}

/** How long the lobby waits for the engine server before going on without it (its own timeout is 12 s). */
const SERVER_WAIT_MS = 14_000;
/** With no engine server, how long a dispute waits for a third device's second opinion. */
const REFEREE_WAIT_MS = 5_000;
const waitFor = (kind: "verdict" | "recheck" | "referee", referee = REFEREE_WAIT_MS) => (kind === "referee" ? referee : SERVER_WAIT_MS);

/** Quick chat's state in a lobby. */
interface ChatRecord {
  /** Lines said so far (the last QUICK_CHAT.logSize, both teams), to send a player who (re)joins. */
  n: number;
  lines: NetChatLine[];
  /**
   * What each person has sent lately (the limits): by account, so leaving the queue and taking a new seat in it
   * doesn't start them afresh (by seat without one).
   */
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
  /** The boss they met last (a BOSS_ROSTER id): the next raid avoids the one most of the lobby met. */
  lastBoss?: string | null;
  /** The crate items they wear. */
  look?: ItemLook;
  /** When they took their seat (the queue's wait). */
  joinedAt?: number;
  /** When they dropped (not connected since). */
  goneAt?: number;
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
  | "autoGo"
  | "judgeTick"
  | "lights";

/**
 * A running match's board, for the home page's live window (Crowd and boss raids; the live hub keeps it): the
 * position, the move just played, the crowd's top votes on it ([SAN, count], most first; a final's one player:
 * [SAN, 1]; none for a boss's move), and the moves played so far. No names.
 */
export interface LiveMatchBoard {
  fen: string;
  lastMove: string | null;
  votes: [string, number][];
  ply: number;
}

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
    /** `away`: look-aways during the clock before the pick, as the app counted them (fair play's one device signal). */
    picks: Record<string, { move: string; thinkMs: number; away?: number }>;
    powerUps: Record<string, true>;
    /** Boss battle: players who called the King this move, and who called for his strike. */
    kingCalls?: Record<string, true>;
    kingStrikes?: Record<string, true>;
    /** Boss battle: the King's strike on screen (the move clock stands still from `at` to `until`). */
    strike?: { at: number; until: number };
    /** Crowd: the host's (or a judge's) early bot picks, and when each bot finishes (ms after the clock starts). */
    botPlan?: { picks: Record<string, string>; powerUps: string[]; by?: string };
    botsDoneIn?: Record<string, number>;
    /** Hollow's dark: players whose last wrong attempt into the dark ended their turn (a miss), with their time used. */
    darkOut?: Record<string, number>;
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
    /** Boss raid: the creator picked this boss (a BOSS_ROSTER id), else a random one. */
    bossPicked?: string;
    /** Boss raid: a fixed strength (a test link's ?boss=<tier>), so it isn't matched to the group. */
    bossFixed?: number;
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
  /** "funhouse": the host plays the crowd's move for Boingo (his ultimate). */
  bossKind?: "elo" | "stumble" | "stagger" | "funhouse";
  /** The boss's move, held until it has "thought" long enough (your queen banner plays first), and when that is. */
  bossPending?: string;
  bossMinAt?: number;
  bossIntroDone?: boolean;
  /**
   * Hollow's Lights out in progress (the boss's turn, before his move; the phase stays "boss"): when it began, how many
   * rounds have ended (their answers shown), and each player's taps, round by round.
   */
  /**
   * Hollow's Lights out: when it began, how many rounds are over and when each ended (ms from `at`), and each person's
   * taps round by round, with their times (ms from `at`: each gives its player a second more, lightsDeadline).
   */
  lights?: { key: string; at: number; ended: number; endedAt?: number[]; taps: Record<string, string[][]>; tapAt?: Record<string, number[][]> };
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
  /** Quick chat (Crowd matches and boss raids, from the lobby before the match: the queue, a private lobby). */
  chat?: ChatRecord;
  /**
   * The last time a person did anything here (joined, left, connected, dropped, sent anything but quick chat): when it
   * closes.
   */
  activeAt?: number;
  /** When the match ended (its results came up). */
  endedAt?: number;
  /**
   * The home page's live window: the crowd's top votes on the move just played ([SAN, count], most first; a final's
   * one player: [SAN, 1]), and how many moves the game had after it (so a later position doesn't show old votes).
   */
  liveVotes?: { ply: number; votes: [string, number][] };
  /** How long the results stay up, if not LOBBY_LIFE's (playtests: ?keep=SECONDS on a lobby you create). */
  keepMs?: number;
  /** Bots off: the tokens of seats freed while their people were gone (they get a new seat if they come back). */
  freed?: string[];
  /** Many judges (see judges.ts and DECISIONS.md): each device's speed and strikes, the scoring in progress, counts. */
  judges?: JudgesRecord;
  /**
   * Fair play: each person's picks with what the judged numbers say about them (core/fairplay.ts), by player id, and
   * a count that goes up with each round's additions (the Durable Object stores them apart, only when it changes).
   */
  fair?: Record<string, FairMove[]>;
  fairV?: number;
}

export interface JudgesRecord {
  devices: Record<string, JudgeDevice>;
  /** Who judges each board this round (drawn as the round starts, so they can search while players think). */
  plan?: { key: string; byBoard: Record<string, string[]> };
  /** This round's scoring jobs (by job id) while they're being judged. */
  tasks?: Record<string, JudgeTask>;
  /** Second opinions after a disagreement (a third device; blame only, nothing waits for them), by job id. */
  referees?: Record<string, { job: JudgeJob; by: string; boards: Record<string, JudgedBoard | null>; at: number }>;
  /**
   * Checks on the engine server afterwards, by request id: a spot check of a job one judge answered alone (one board),
   * or a late second answer that disagreed with the one used (two boards).
   */
  spots?: Record<string, { job: JudgeJob; boards: Record<string, JudgedBoard>; refereed?: boolean }>;
  /** Jobs settled on one answer while another judge was still searching: its answer is compared when it comes. */
  late?: Record<string, { job: JudgeJob; judge: string; board: JudgedBoard; pending: string[]; at: number }>;
  stats: JudgeStats;
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

  /**
   * Bots off, still waiting: frees the seats of people gone longer than MATCHMAKING.botsOffSeatHoldMs (`keep`: one who's
   * just come back), so the count is real and a full lobby never starts with people who left.
   */
  private freeGoneSeats(keep?: string) {
    const a = this.r.auto;
    if (!a?.botsOff || a.filledAt || this.r.phase !== "lobby") return;
    const now = this.io.now();
    const gone = this.r.humans.filter((h) => h.id !== keep && !h.connected && h.goneAt !== undefined && now - h.goneAt >= MATCHMAKING.botsOffSeatHoldMs);
    if (!gone.length) return;
    for (const h of gone) {
      this.leave(h.id);
      this.r.freed = [...(this.r.freed ?? []), h.token].slice(-100);
    }
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

  /** Matchmaking: seats still free for new players (0 once it no longer takes players). */
  seatsLeft(): number {
    return this.joinable() ? this.settings.lobbySize - this.r.humans.length : 0;
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
    const all = this.r.humans.filter((h) => h.connected && h.id !== exclude);
    // (Not a device benched for wrong scores, while there's anyone else.)
    const trusted = all.filter((h) => !this.benched(h.id));
    const candidates = trusted.length ? trusted : all;
    const computer = candidates.find((h) => h.device === "computer");
    return (computer ?? candidates[0])?.id ?? null;
  }

  /** The host for the engine work now: the current one, unless it's gone or was benched for wrong scores. */
  private hostNow(): string | null {
    const h = this.r.hostId;
    if (h && this.human(h)?.connected && !this.benched(h)) return h;
    return this.pickHost() ?? (h && this.human(h)?.connected ? h : null);
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
    lastBoss: string | null = null,
  ) {
    this.r.activeAt = this.io.now();
    const existing = token ? this.r.humans.find((h) => h.token === token) : undefined;
    // (Bots off: seats of people long gone are freed first, so the count and "full" are real. Not the arriving one's.)
    this.freeGoneSeats(existing?.id);
    if (existing) {
      existing.connected = true;
      delete existing.goneAt;
      if (look !== undefined) existing.look = cleanLook(look);
      if (bossDef(lastBoss)) existing.lastBoss = lastBoss;
      if (userId) this.r.accounts = { ...(this.r.accounts ?? {}), [existing.id]: userId };
      if (!this.r.hostId || !this.human(this.r.hostId)?.connected) this.r.hostId = existing.id;
      this.send(existing.id, { t: "welcome", playerId: existing.id, token: existing.token, code: this.r.code }, false);
      this.broadcast(this.lobbyMessage(existing.id), false);
      const last = this.r.last[existing.id];
      if (last) this.send(existing.id, last, false);
      this.resendHostWork();
      this.resendJudgeWork(existing.id);
      // Matchmade, and its time came while nobody was here (nothing started it): start now (bots fill the rest unless Bots off).
      if (!this.r.timer && this.dueToStart()) this.startMatch();
      return { ok: true as const, playerId: existing.id };
    }
    // Bots off: someone whose seat was freed while they were gone, back while it still waits: a new seat, same token.
    const reseat = !!token && !!this.r.freed?.includes(token) && this.joinable();
    if (reseat) this.r.freed = this.r.freed!.filter((t) => t !== token);
    // A seat this lobby never gave out: from an older lobby that had this code (it has closed since), so that match is over.
    else if (token) return { ok: false as const, message: MATCH_ENDED, ended: true as const };
    if (this.r.phase === "results") return { ok: false as const, message: MATCH_ENDED, ended: true as const };
    if (this.r.phase !== "lobby" || this.r.auto?.filledAt) return { ok: false as const, message: "This match has already started." };
    if (this.r.humans.length >= this.settings.lobbySize) return { ok: false as const, message: "This lobby is full." };
    const clean = (name ?? "").replace(/\s+/g, " ").trim().slice(0, 16) || `Player ${this.r.humans.length + 1}`;
    const id = `p${++this.r.counter}`;
    const newToken = reseat ? token! : Array.from({ length: 24 }, () => Math.floor(this.rng() * 16).toString(16)).join("");
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
      ...(bossDef(lastBoss) ? { lastBoss } : {}),
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
    this.resendJudgeWork(playerId);
    this.sendChatLog(playerId);
  }

  disconnect(playerId: string) {
    const h = this.human(playerId);
    if (!h) return;
    h.connected = false;
    h.goneAt = this.io.now();
    this.r.activeAt = this.io.now();
    if (this.r.hostId === playerId) {
      this.r.hostId = this.pickHost(playerId) ?? playerId;
      this.resendHostWork();
    }
    this.judgeGone(playerId);
    this.broadcast(this.lobbyMessage(), false);
  }

  /** Leaving before the match starts (Cancel in the queue, Leave in a lobby): the seat is free again. */
  leave(playerId: string) {
    if (this.r.phase !== "lobby" || this.r.auto?.filledAt || !this.human(playerId)) return;
    this.r.activeAt = this.io.now();
    this.r.humans = this.r.humans.filter((h) => h.id !== playerId);
    delete this.r.last[playerId];
    this.chatGone(playerId);
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
    if (this.r.phase === "scoring" && this.r.scoreRequest && !this.r.judges?.tasks) {
      this.io.send(host, { t: "scoreRequest", ...this.r.scoreRequest });
    }
    if (this.r.phase === "boss" && this.r.bossKey) this.sendBossRequest(host);
  }

  /**
   * The test trigger: an admin (the Durable Object checks ADMIN_EMAILS and passes `admin`) brings the boss's ultimate
   * as the next crowd turn begins, without the warning. Anyone else, no boss battle, or the trigger switched off
   * (BOSS_POWERS.ultimateTestButton): nothing. Never touches a turn or a moment in progress (see triggerUltimate).
   */
  ultimateTrigger(playerId: string, admin: boolean): boolean {
    if (!admin || !BOSS_POWERS.ultimateTestButton || !this.human(playerId) || !this.runner?.boss || this.r.phase === "results") return false;
    const ok = this.runner.triggerUltimate();
    if (ok) console.log(`test trigger: ${playerId} brings the ultimate in ${this.r.code}`);
    return ok;
  }

  // ---------------- Messages ----------------

  message(playerId: string, msg: ClientMessage) {
    // (Quick chat isn't activity: chatting never keeps a lobby nobody starts open. See lobbyClosing.)
    if (this.human(playerId) && msg.t !== "chat" && msg.t !== "chatPrefs") this.r.activeAt = this.io.now();
    switch (msg.t) {
      case "start":
        return this.start(playerId);
      case "pick":
        return this.pick(playerId, msg.key, msg.move, msg.away);
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
        if (this.planner(playerId, msg.key) && this.r.round?.key === msg.key && this.r.phase === "play" && !this.r.round.botPlan) {
          this.r.round.botPlan = { picks: msg.picks, powerUps: msg.powerUps, ...(this.r.judges?.plan?.key === msg.key ? { by: playerId } : {}) };
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
        if (this.doneThisRound(playerId)) return;
        (round.kingCalls ??= {})[playerId] = true;
        for (const h of this.r.humans) this.send(h.id, { t: "moved", key: round.key, playerId }, false);
        this.sendTally();
        if (this.roundHumans().every((h) => this.doneThisRound(h.id))) this.lock();
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
      case "speed":
        return this.speed(playerId, msg.nps);
      case "judged":
        return this.judged(playerId, msg.key, msg.id, msg.report);
      case "judgedDeep":
        return this.judgedDeep(playerId, msg.key, msg.id, msg.deep);
      case "darkTry":
        return this.darkTry(playerId, msg.key, msg.move, msg.away);
      case "lightsTap":
        return this.lightsTap(playerId, msg.key, msg.round, msg.square);
      case "hello":
      // (The test trigger goes through ultimateTrigger, from the Durable Object, which knows who's an admin.)
      case "ultimate":
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
    if (this.settings.raid && !this.r.overrides?.bossFixed) {
      // Boss raid: no bots; the boss plays a step above the group's average rating (the weakest tier stronger than it),
      // plus its own offset (the runner adds that once it knows which boss it is).
      const patch = { bossFixedElo: raidBossElo(this.r.humans.map((h) => h.rating ?? null)) };
      this.r.overrides = { ...(this.r.overrides ?? {}), ...patch } as LobbyRecord["overrides"];
      this.settings = { ...this.settings, ...patch };
    }
    if (!this.settings.bossId) {
      // Which boss (a raid, or a Crowd match that ends in one): random, but not the one most of the lobby met last.
      const avoid = this.lobbyLastBoss();
      if (avoid) this.settings = { ...this.settings, bossAvoid: avoid };
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
      // The bots just sat down: one or two say hello in the lobby chat (within the full grid's moment).
      if (bots.length) this.botChat({ kind: "lobby" });
      this.setTimer("autoGo", now + FRONT_DOOR.fillShowMs);
      return;
    }
    this.begin();
  }

  /** The boss most of the lobby met last (more than any other; ties: none), so a random boss avoids it. */
  private lobbyLastBoss(): string | null {
    const count = new Map<string, number>();
    for (const h of this.r.humans) if (h.lastBoss) count.set(h.lastBoss, (count.get(h.lastBoss) ?? 0) + 1);
    const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]);
    return ranked.length && (ranked.length === 1 || ranked[0]![1] > ranked[1]![1]) ? ranked[0]![0] : null;
  }

  /** The match begins: the pre-game votes, the boss's intro (a raid) or the opening. */
  private begin() {
    const runner = this.runner!;
    const now = this.io.now();
    const voting = pregameVotes(this.settings).length > 0;
    this.r.phase = voting ? "vote" : "opening";
    this.r.startedAt = now;
    this.broadcast(this.lobbyMessage(), false);
    // Quick chat carries on from the lobby into the match, now with teams (and a bot or two wishes everyone luck).
    // (Icons already sent in the lobby aren't sent again.)
    for (const h of this.r.humans) this.sendChatLog(h.id, false);
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
    this.freeGoneSeats();
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
      case "judgeTick":
        return this.judgeTick();
      case "lights":
        return this.lightsStep();
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
    const board = this.runner!.boards.get(this.runner!.state.boards[0]!)!;
    // (G-REX's fire has just burnt something: that plays first too.)
    const b = this.runner!.state.boss;
    const burnt = !!b?.powers?.burnt?.some((x) => x.turn === b.crowdMoves && (x.piece || x.fizzled));
    this.r.bossMinAt = lastMoveTookQueen(board.history, board.bases) || burnt ? this.io.now() + bossThinkMs(board.history, board.bases, burnt) : undefined;
    this.broadcast(this.bossMessage(0, { thinking: true }));
    const host = this.hostNow();
    this.r.hostId = host;
    if (host) this.sendBossRequest(host);
    this.setTimer("bossTimeout", this.io.now() + BOSS_TIMEOUT_MS);
  }

  private sendBossRequest(host: string) {
    const runner = this.runner!;
    const fen = runner.boards.get(runner.state.boards[0]!)!.fen;
    const funhouse = this.r.bossKind === "funhouse";
    // A power limits the moves: the boss's (a pie), or the crowd's for the move Boingo plays for them.
    const allowed = funhouse ? runner.crowdAllowed() : runner.bossAllowed();
    this.io.send(host, {
      t: "bossRequest",
      key: this.r.bossKey!,
      fen,
      elo: runner.boss!.elo,
      nodes: this.settings.bossNodes,
      ...(this.r.bossKind === "stumble" ? { stumble: true } : this.r.bossKind === "stagger" ? { stagger: true } : {}),
      ...(funhouse ? { funhouse: true } : {}),
      ...(allowed ? { allowed } : {}),
    });
  }

  /**
   * Boingo's funhouse: as the turn passes to the crowd, the boss plays its move for it. The host's engine picks a
   * weak but recoverable move (as it plays the boss's), everyone sees the funhouse, and then the boss replies.
   */
  private requestFunhouse() {
    this.r.phase = "boss";
    this.r.bossKey = `f-${++this.r.counter}`;
    this.r.bossKind = "funhouse";
    this.r.bossMinAt = undefined;
    const host = this.hostNow();
    this.r.hostId = host;
    if (host) this.sendBossRequest(host);
    this.setTimer("bossTimeout", this.io.now() + BOSS_TIMEOUT_MS);
  }

  private playBoss(move: string) {
    this.r.bossKey = undefined;
    if (this.r.bossKind === "funhouse") {
      // The crowd's move, played by the boss: unscored; the funhouse plays out, then the boss replies.
      this.r.bossKind = undefined;
      this.runner!.applyFunhouse(move);
      const until = this.io.now() + powerMomentMs([{ kind: "funhouse" }]);
      this.broadcast(this.bossMessage(until));
      return this.setTimer("nextRound", until);
    }
    // Too soon (your queen banner is still up): hold the move until then.
    if (this.r.bossMinAt && this.io.now() < this.r.bossMinAt - 50) {
      this.r.bossPending = move;
      return this.setTimer("bossPlay", this.r.bossMinAt);
    }
    this.r.bossPending = undefined;
    this.runner!.applyBossMove(move);
    // As the turn passes to the crowd, any power that comes with it (a freeze, a pie, the warning, the blizzard)
    // plays out before the crowd's clock starts.
    const view = this.runner!.bossView();
    const until = this.io.now() + bossShowMs(view?.lastMove) + powerMomentMs(view?.powers?.events);
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
    // Nobody can run the engine: the boss plays a random allowed move so the match can go on (in its funhouse, the
    // crowd's: a random allowed one too).
    const runner = this.runner!;
    const legal = (this.r.bossKind === "funhouse" ? runner.crowdAllowed() : runner.bossAllowed()) ?? legalMoves(runner.boards.get(runner.state.boards[0]!)!.fen);
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
        const until = this.io.now() + bossIntroTimeline(runner.boards.get(runner.state.boards[0]!)!.history.length, !!runner.boss.powers?.claimed).total;
        this.broadcast({ ...this.bossMessage(until), intro: true } as Outgoing);
        return this.setTimer("nextRound", until);
      }
      if (runner.stageComplete()) {
        runner.finishBossBattle();
        return this.finishMatch();
      }
      // (Hollow's Lights out comes at the start of his turn, before his move.)
      if (runner.bossToMove()) return runner.lightsOutDue() ? this.startLights() : this.requestBoss();
      if (runner.funhouseDue()) return this.requestFunhouse();
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
    if (this.judging()) this.planJudges(key, crowd && !final);
    else if (this.r.hostId) {
      const fens = [...runner.groups.keys()].map((id) => runner.boards.get(id)!.fen);
      const skills = new Map(this.r.bots.map((b) => [b.id, b.skill]));
      const ids = [...runner.groups.values()][0] ?? [];
      // Crowd: the host decides the bots' picks now, so everyone who has picked can watch them come in.
      const barred = runner.boss?.barred;
      const plan =
        crowd && !final
          ? {
              key,
              fen: fens[0]!,
              bots: ids.filter((id) => skills.has(id)).map((id) => ({ id, skill: skills.get(id)!, powerUps: runner.player(id).powerUps })),
              ...(barred ? { barred } : {}),
              ...(runner.boss && runner.crowdAllowed() ? { allowed: runner.crowdAllowed()! } : {}),
              ...(runner.fireBurn().length ? { burn: runner.fireBurn() } : {}),
            }
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

  /** This player's turn is over this round: they picked, called the King, or ran out of tries in Hollow's dark. */
  private doneThisRound(playerId: string): boolean {
    const round = this.r.round;
    return !!round && (!!round.picks[playerId] || this.called(playerId) || round.darkOut?.[playerId] !== undefined);
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
    const ms = kingStrikeMs(this.settings);
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

  private pick(playerId: string, key: string, move: string, away?: unknown) {
    const round = this.r.round;
    if (this.r.phase !== "play" || !round || round.key !== key || this.doneThisRound(playerId)) return;
    const now = this.io.now();
    const deadline = round.deadlines?.[playerId] ?? round.deadline;
    if (now > deadline + this.settings.lateGraceMs) return; // Late picks count as a miss.
    if (now < round.startedAt - 500) return; // Before the clock starts.
    const board = this.runner?.boardOf(playerId);
    if (!board || !legalMoves(board.fen).includes(move)) return;
    // Boss battle: only a move allowed this turn (a power's limits; the move the God King took back can't be picked).
    const allowed = this.runner?.boss ? this.runner.crowdAllowed() : null;
    if (allowed && !allowed.includes(move)) return;
    round.picks[playerId] = {
      move,
      thinkMs: Math.min(this.thinkTime(round, now), this.thinkTime(round, deadline)),
      ...(typeof away === "number" && away > 0 ? { away: Math.min(50, Math.round(away)) } : {}),
    };
    for (const h of this.r.humans) this.send(h.id, { t: "moved", key, playerId }, false);
    this.sendTally();
    if (this.roundHumans().every((h) => this.doneThisRound(h.id))) this.lock();
  }

  /**
   * Hollow's dark: a move attempt that touched a dark square, sent unchecked. The runner judges it: a legal move is the
   * player's pick; an illegal one costs points and they pick again, and the last of their tries ends their turn as a
   * missed move. Only the player hears how it went.
   */
  private darkTry(playerId: string, key: string, move: unknown, away?: unknown) {
    const round = this.r.round;
    if (this.r.phase !== "play" || !round || round.key !== key || this.doneThisRound(playerId) || !this.runner?.boss || typeof move !== "string") return;
    const now = this.io.now();
    const deadline = round.deadlines?.[playerId] ?? round.deadline;
    if (now > deadline + this.settings.lateGraceMs || now < round.startedAt - 500) return;
    const out = this.runner.darkTry(playerId, move);
    if (out.kind === "move") {
      this.send(playerId, { t: "darkTry", key, move: out.move, ok: true }, false);
      return this.pick(playerId, key, out.move, away);
    }
    if (out.kind === "refused") return this.send(playerId, { t: "darkTry", key, move, ok: false, refused: true }, false);
    this.send(playerId, { t: "darkTry", key, move, ok: false, tries: out.tries, ...(out.out ? { out: true } : {}) }, false);
    if (!out.out) return;
    (round.darkOut ??= {})[playerId] = Math.min(this.thinkTime(round, now), this.thinkTime(round, deadline));
    for (const h of this.r.humans) this.send(h.id, { t: "moved", key, playerId }, false);
    this.sendTally();
    if (this.roundHumans().every((h) => this.doneThisRound(h.id))) this.lock();
  }

  // ---------------- Hollow's Lights out ----------------

  /** The test's beats (boss-timing.ts), from its rounds' seconds, the late grace and when the rounds over ended. */
  private lightsTimeline() {
    const ended = this.r.lights?.endedAt ?? [];
    return lightsOutTimeline((this.runner?.boss?.powers?.lightsOut?.rounds ?? []).map((r, i) => ({ ms: r.ms, endedAt: ended[i] })), this.settings.lateGraceMs);
  }

  /** When the round on is over (ms from the test's start): every person done, by their tries or their own time. */
  private lightsRoundEnd(): number {
    const l = this.r.lights!;
    const k = l.ended;
    const r = this.lightsTimeline().rounds[k]!;
    const pieces = this.runner!.boss!.powers!.lightsOut!.rounds[k]!.pieces.length;
    return lightsRoundEnd(r, pieces, Object.values(l.tapAt ?? {}).map((x) => x[k] ?? []), this.settings.lateGraceMs);
  }

  /** Lights out begins at the start of his turn: the game paused, nobody's clock running, the server timing each round. */
  private startLights() {
    const runner = this.runner!;
    const test = runner.startLightsOut();
    this.r.phase = "boss";
    this.r.lights = { key: `l-${++this.r.counter}`, at: this.io.now(), ended: 0, endedAt: [], taps: {}, tapAt: {} };
    for (const p of runner.alive())
      if (!p.isBot) {
        this.r.lights.taps[p.id] = test.rounds.map(() => []);
        this.r.lights.tapAt![p.id] = test.rounds.map(() => []);
      }
    this.sendLights();
    this.armLights();
  }

  private armLights() {
    const l = this.r.lights!;
    const tl = this.lightsTimeline();
    this.setTimer("lights", l.at + (l.ended < tl.rounds.length ? this.lightsRoundEnd() : tl.total));
  }

  /** A round ends (its answers go out, each player's taps judged), or the lights are back: the misses cost, and he moves. */
  private lightsStep() {
    const l = this.r.lights;
    const runner = this.runner;
    if (!l || !runner || this.r.phase !== "boss") return;
    const tl = this.lightsTimeline();
    if (l.ended < tl.rounds.length) {
      // (A tap since may have given someone more time.)
      const end = this.lightsRoundEnd();
      if (this.io.now() < l.at + end) return this.armLights();
      (l.endedAt ??= []).push(Math.max(end, this.io.now() - l.at));
      l.ended++;
      this.sendLights();
      return this.armLights();
    }
    const missed: Record<string, number> = {};
    for (const id of Object.keys(l.taps)) missed[id] = this.lightsMine(id).reduce((n, r, i) => n + (runner.boss!.powers!.lightsOut!.rounds[i]!.pieces.length - r.found.length), 0);
    runner.finishLightsOut(missed);
    this.r.lights = undefined;
    this.requestBoss();
  }

  /** A player's taps in Lights out, judged round by round. */
  private lightsMine(playerId: string): { found: string[]; wrong: string[]; used: number }[] {
    const runner = this.runner!;
    const test = runner.boss!.powers!.lightsOut!;
    const fen = runner.boards.get(runner.state.boards[0]!)!.fen;
    const side = runner.boss!.crowdSide === "w" ? "b" : "w";
    return test.rounds.map((r, i) => {
      const j = judgeTaps(r, fen, side, this.r.lights?.taps[playerId]?.[i] ?? []);
      return { found: j.found, wrong: j.wrong, used: j.used };
    });
  }

  /** The test as each player sees it (their own taps judged; a round's answers once it's over). */
  private sendLights(only?: string) {
    const l = this.r.lights!;
    const runner = this.runner!;
    const test = runner.boss!.powers!.lightsOut!;
    const boss = runner.bossView()!;
    const standings = this.standings();
    for (const h of this.r.humans) {
      if (only && h.id !== only) continue;
      const lights: NetLightsOut = {
        key: l.key,
        at: l.at,
        rounds: test.rounds.map((r, i) => ({ pieces: r.pieces, targets: r.targets, ms: r.ms, ...(i < l.ended ? { answers: r.answers, endedAt: l.endedAt?.[i] } : {}) })),
        mine: this.lightsMine(h.id),
      };
      this.send(h.id, { t: "lights", lights, boss, standings });
    }
  }

  /**
   * A tap in Lights out: judged against the round on, while it's open for this player (their own deadline: the round's
   * seconds, a second more for each tap, and the usual late grace) and they have tries left (one per piece). Every
   * tap gives them a second more; once everyone is done, the round is over.
   */
  private lightsTap(playerId: string, key: string, round: unknown, square: unknown) {
    const l = this.r.lights;
    if (!l || l.key !== key || this.r.phase !== "boss" || typeof round !== "number" || typeof square !== "string" || !/^[a-h][1-8]$/.test(square)) return;
    const taps = l.taps[playerId]?.[round];
    const r = this.lightsTimeline().rounds[round];
    if (!taps || !r || round !== l.ended) return;
    const t = this.io.now() - l.at;
    if (t < r.at - 300 || t > lightsDeadline(r, taps.length) + this.settings.lateGraceMs) return;
    const pieces = this.runner!.boss!.powers!.lightsOut!.rounds[round]!.pieces.length;
    if (taps.length >= pieces || taps.includes(square)) return;
    taps.push(square);
    ((l.tapAt ??= {})[playerId] ??= l.taps[playerId]!.map(() => []))[round]!.push(t);
    this.sendLights(playerId);
    // Done at once if everyone is; otherwise the round may now end later.
    if (this.lightsRoundEnd() <= t) return this.lightsStep();
    this.armLights();
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
      if (!alive || (playing.has(h.id) && !this.doneThisRound(h.id))) continue;
      this.send(h.id, { t: "tally", key: round.key, picks }, false);
    }
  }

  /** A power-up: the player's browser shows the engine's top moves; the server just counts it. */
  private powerUp(playerId: string, key: string) {
    const round = this.r.round;
    if (this.r.phase !== "play" || !round || round.key !== key || this.doneThisRound(playerId) || !this.runner) return;
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
      ...(this.runner!.boss && this.runner!.crowdAllowed(boardId) ? { allowed: this.runner!.crowdAllowed(boardId)! } : {}),
      ...(this.runner!.fireBurn().length ? { burn: this.runner!.fireBurn() } : {}),
    }));
    // Close calls that can decide the cut are re-checked first.
    const bubble = this.cutPriority();
    for (const j of jobs) {
      const priority = [...new Set(Object.entries(j.humanPicks).flatMap(([id, m]) => (m && bubble.has(id) ? [m] : [])))].sort();
      if (priority.length) j.priority = priority;
    }
    this.r.scoreRequest = { key: this.r.round.key, jobs };
    for (const h of this.r.humans) this.io.send(h.id, { t: "locked", key: this.r.round.key });
    // Many judges: two devices score each board, and the lobby compares their answers.
    if (this.judging()) return this.startJudging();
    const host = this.hostNow();
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
    if (this.r.phase !== "scoring" || playerId !== this.r.hostId || this.r.scoreRequest?.key !== key || this.r.judges?.tasks) return;
    this.applyScores(boards);
  }

  private applyScores(boards: BoardScore[], judged = false) {
    const runner = this.runner!;
    const round = this.r.round!;
    runner.kingCallers = new Set(Object.keys(round.kingCalls ?? {}));
    const byBoard = new Map(boards.map((b) => [b.boardId, b]));
    // (Fair play: the move before each position, for recaptures; the boards move on in finishRound.)
    const lastMoves = new Map(this.r.scoreRequest!.jobs.map((j) => [j.boardId, runner.boards.get(j.boardId)?.lastMove ?? null]));
    const results = this.r.scoreRequest!.jobs.map((job) => {
      const s = byBoard.get(job.boardId);
      const ids = runner.groups.get(job.boardId)!;
      const picks: Record<string, string | null> = { ...job.humanPicks };
      // (Boss battle: no bot plays a move that isn't allowed, nor the move the God King took back.)
      const legal = job.allowed ?? legalMoves(job.fen).filter((m) => m !== job.barred);
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
    // A miss uses the whole of the player's time for the move (out of tries in Hollow's dark: the time until then).
    for (const h of this.roundHumans()) think[h.id] ??= round.darkOut?.[h.id] ?? this.thinkTime(round, round.deadlines?.[h.id] ?? round.deadline);
    const report = runner.finishRound(results, think, new Set(Object.keys(round.powerUps ?? {})));
    this.noteFeats(report);
    this.noteFair(report, lastMoves);
    this.r.scoreRequest = null;
    if (runner.final) {
      // The final: everyone sees the move just played and its loss, then the next turn.
      const b = report.boards[0]!;
      const p = b.result.players[0]!;
      const last: NetFinal["last"] = { playerId: p.playerId, move: b.result.playedMove, san: toSan(b.fenBefore, b.result.playedMove), loss: p.loss };
      this.noteLiveVotes(b);
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
    if (this.settings.mode === "crowd" && report.boards[0]) this.noteLiveVotes(report.boards[0]);
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
    const until = this.io.now() + (this.settings.revealSeconds + this.settings.drawnMoveSeconds) * 1000 + (kingActs ? kingMoveMs(this.settings) : 0) + (stand ? LAST_STAND_MS : 0);
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
        ...(judged ? { judged: true as const } : {}),
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

  // ---------------- Many judges ----------------
  //
  // Each board's scoring job goes to two devices drawn at random (faster ones more often). Agreement: used.
  // Disagreement: the engine server's deep search decides, and a device that was off gets a strike (a third device's
  // second opinion says which, exactly; without one, distance from the verdict does). Two strikes: no more jobs this
  // match. One judge late or gone: the other's answer, and now and then a spot check on the server afterwards.
  // With fewer than two devices that can judge, the host scores as before. See DECISIONS.md, "Many judges".
  // Deep checks: with two capable devices (computers fast enough) judging a board, they also re-check its close
  // calls, and the server is asked only when they disagree or are late (DECISIONS.md, "Deep checks on players'
  // computers"). A knocked-out player's device judges as long as its page is open.

  private get jcfg(): JudgeConfig {
    return this.io.judges ?? JUDGES;
  }

  private get jr(): JudgesRecord {
    return (this.r.judges ??= { devices: {}, stats: emptyStats() });
  }

  private jrng(): number {
    return (this.io.judgeRng ?? Math.random)();
  }

  private benched(id: string): boolean {
    return (this.r.judges?.devices[id]?.strikes ?? 0) >= this.jcfg.strikes;
  }

  /** The engine server can be asked now. */
  private get serverOn(): boolean {
    return !!this.io.serverEngine && !!this.io.serverScore;
  }

  /** Devices that can judge now: connected, speed known (an up-to-date app), not benched. */
  private judgeDevices(): { id: string; nps: number }[] {
    const devices = this.r.judges?.devices ?? {};
    return this.r.humans.filter((h) => h.connected && devices[h.id] && !this.benched(h.id)).map((h) => ({ id: h.id, nps: devices[h.id]!.nps }));
  }

  /** Two judges per job when two devices can judge (else the host, as before). */
  private judging(): boolean {
    const cfg = this.jcfg;
    return cfg.on && cfg.perJob >= 2 && this.judgeDevices().length >= 2;
  }

  /** A device that can re-check close calls itself: a computer fast enough to do deepMinNodes in the deep window. */
  private capable(id: string): boolean {
    const cfg = this.jcfg;
    const d = this.r.judges?.devices[id];
    return this.human(id)?.device === "computer" && !!d && (d.nps * cfg.deepHeadroom * cfg.deepWindowMs) / 1000 >= cfg.deepMinNodes;
  }

  /** Deep checks on devices this round: two capable devices can judge. */
  private deepMode(): boolean {
    return this.jcfg.deepOnDevices && this.judgeDevices().filter((d) => this.capable(d.id)).length >= 2;
  }

  /** The devices a round's judges are drawn from: the capable ones in deep mode, else all that can judge. */
  private judgePool(): { id: string; nps: number }[] {
    const all = this.judgeDevices();
    return this.deepMode() ? all.filter((d) => this.capable(d.id)) : all;
  }

  /**
   * The re-check's node count for a job its two capable judges share: what the slower does in the deep window (with
   * headroom, shared by its jobs this round), at most the server's (shared by the round's boards, as the server's).
   */
  private deepNodesFor(judges: readonly string[], boards: number, load: number): number {
    const cfg = this.jcfg;
    const nps = Math.min(...judges.map((j) => this.r.judges?.devices[j]?.nps ?? 0));
    const cap = Math.max(400_000, cfg.deepNodes / Math.max(1, boards));
    const fit = (cfg.deepHeadroom * cfg.deepWindowMs * nps) / 1000 / Math.max(1, load);
    return Math.max(100_000, Math.floor(Math.min(cap, fit) / 100_000) * 100_000);
  }

  /** A device's speed check (nodes per second). */
  private speed(playerId: string, nps: unknown) {
    if (!this.human(playerId) || typeof nps !== "number" || !Number.isFinite(nps) || nps <= 0) return;
    const d = (this.jr.devices[playerId] ??= { nps: 0, strikes: 0, jobs: 0, answered: 0 });
    d.nps = Math.round(Math.max(10_000, Math.min(50_000_000, nps)));
  }

  /** Who may send the Crowd bots' early picks this round: the host, or (many judges) a judge of the board. */
  private planner(playerId: string, key: string): boolean {
    const plan = this.r.judges?.plan;
    if (plan?.key === key) return Object.values(plan.byBoard)[0]?.includes(playerId) ?? false;
    return playerId === this.r.hostId;
  }

  /** The rules the bots' picks follow, for a job. */
  private judgeRules() {
    return { botCandidateMoves: DEFAULT_SETTINGS.botCandidateMoves, botRandomMoveChance: this.settings.botRandomMoveChance, botPowerUpLoss: this.settings.botPowerUpLoss };
  }

  /** People whose picks can decide this stage's cut (near the cut line). */
  private cutPriority(): Set<string> {
    const runner = this.runner;
    const k = runner ? (this.settings.knockoutsPerStage[runner.state.stage] ?? 0) : 0;
    if (!runner || runner.final || runner.boss || !k) return new Set();
    const rows = runner.leaderboard();
    if (!isTeamMatch(this.settings)) return cutBubble(rows, this.cutoff(), this.settings.recheckCutPoints);
    // Crowd 50 v 50: each team's bottom goes (half the knockouts each), so each team has its own cut line.
    const out = new Set<string>();
    for (const side of ["w", "b"] as const) {
      const team = rows.filter((r) => r.team === side && !r.out);
      for (const id of cutBubble(team, team.length - Math.floor(k / 2), this.settings.recheckCutPoints)) out.add(id);
    }
    return out;
  }

  /**
   * A round starts: draw each board's judges now, so they search its position while players think (and in Crowd,
   * plan the bots' picks from the job's seed, which the scoring job then checks).
   */
  private planJudges(key: string, plan: boolean) {
    const runner = this.runner!;
    const cfg = this.jcfg;
    const devices = this.judgePool();
    const boards = [...runner.groups.entries()].map(([boardId, ids]) => ({ boardId, cost: ids.length }));
    const byBoard = assignJudges(() => this.jrng(), boards, devices, Math.min(cfg.perJob, devices.length), cfg);
    this.jr.plan = { key, byBoard: Object.fromEntries([...byBoard].map(([b, j]) => [String(b), j])) };
    const fens = new Map<string, string[]>();
    for (const [boardId, judges] of byBoard) for (const j of judges) fens.set(j, [...(fens.get(j) ?? []), runner.boards.get(boardId)!.fen]);
    const skills = new Map(this.r.bots.map((b) => [b.id, b.skill]));
    const [firstBoard, firstIds] = [...runner.groups.entries()][0] ?? [0, []];
    const barred = runner.boss?.barred;
    const botPlan = plan
      ? {
          key,
          fen: runner.boards.get(firstBoard)!.fen,
          bots: firstIds.filter((id) => skills.has(id)).map((id) => ({ id, skill: skills.get(id)!, powerUps: runner.player(id).powerUps })),
          ...(barred ? { barred } : {}),
          ...(runner.boss && runner.crowdAllowed(firstBoard) ? { allowed: runner.crowdAllowed(firstBoard)! } : {}),
          ...(runner.fireBurn().length ? { burn: runner.fireBurn() } : {}),
          seed: seedFor(key, firstBoard),
          rules: this.judgeRules(),
        }
      : undefined;
    const planners = byBoard.get(firstBoard) ?? [];
    for (const [id, list] of fens) this.send(id, { t: "prefetch", fens: list, ...(botPlan && planners.includes(id) ? { plan: botPlan } : {}) }, false);
  }

  /** Picks are locked: every board's job to its judges. */
  private startJudging() {
    const runner = this.runner!;
    const round = this.r.round!;
    const cfg = this.jcfg;
    const now = this.io.now();
    const devices = this.judgePool();
    const perJob = Math.min(cfg.perJob, devices.length);
    const planned = this.r.judges?.plan?.key === round.key ? this.r.judges.plan.byBoard : {};
    const load = new Map<string, number>();
    const tasks: Record<string, JudgeTask> = {};
    // Old second opinions nobody answered.
    for (const [id, ref] of Object.entries(this.jr.referees ?? {})) if (now - ref.at > 60_000) delete this.jr.referees![id];
    for (const [id, l] of Object.entries(this.jr.late ?? {})) if (now - l.at > 60_000) this.lateGone(id);
    for (const sj of this.r.scoreRequest!.jobs) {
      const job: JudgeJob = {
        id: `${round.key}/${sj.boardId}`,
        fen: sj.fen,
        picks: Object.values(sj.humanPicks).filter((m): m is string => !!m).sort(),
        bots: sj.bots.map((b) => ({ skill: b.skill, powerUps: b.powerUps })),
        seed: seedFor(round.key, sj.boardId),
        rules: this.judgeRules(),
        ...(sj.barred ? { barred: sj.barred } : {}),
        ...(sj.allowed ? { allowed: sj.allowed } : {}),
        ...(sj.burn ? { burn: sj.burn } : {}),
        ...(sj.priority ? { priority: sj.priority } : {}),
      };
      const judges = (planned[String(sj.boardId)] ?? []).filter((id) => devices.some((d) => d.id === id)).slice(0, perJob);
      if (judges.length < perJob) judges.push(...drawJudges(() => this.jrng(), devices, perJob - judges.length, cfg, load, new Set(judges)));
      for (const j of judges) load.set(j, (load.get(j) ?? 0) + 1);
      tasks[job.id] = { boardId: sj.boardId, job, botIds: sj.bots.map((b) => b.id), judges, tried: [...judges], want: perJob, sentAt: now, sent: {}, reports: {}, boards: {} };
      this.jr.stats.jobs++;
    }
    // The re-check of close calls (where a person picked: a group of bots affects nobody real). Two capable judges:
    // they do it, at the depth both fit in the deep window. No engine server: the judges do it as before.
    const boards = Object.keys(tasks).length;
    for (const t of Object.values(tasks)) {
      if (!t.job.picks.length) continue;
      const deep = cfg.deepOnDevices && t.judges.length >= 2 && t.judges.every((j) => this.capable(j));
      if (!deep && this.serverOn) continue;
      const nodes = deep ? this.deepNodesFor(t.judges, boards, Math.max(...t.judges.map((j) => load.get(j) ?? 1))) : this.settings.recheckNodes;
      t.job.recheck = { recheckLoss: this.settings.recheckLoss, recheckMax: this.settings.recheckMax, recheckNodes: nodes, recheckCutLoss: this.settings.recheckCutLoss, recheckCutMax: this.settings.recheckCutMax };
      if (deep) {
        t.deep = true;
        this.jr.stats.deepJobs++;
      }
    }
    this.jr.tasks = tasks;
    const byJudge = new Map<string, JudgeJob[]>();
    for (const t of Object.values(tasks)) for (const j of t.judges) byJudge.set(j, [...(byJudge.get(j) ?? []), t.job]);
    for (const [id, jobs] of byJudge) this.sendJobs(id, jobs);
    this.armJudgeTimer();
  }

  private sendJobs(id: string, jobs: JudgeJob[]) {
    const tasks = this.r.judges?.tasks ?? {};
    const d = this.jr.devices[id];
    for (const job of jobs) {
      const t = tasks[job.id];
      if (t) t.sent[id] = this.io.now();
      if (d) d.jobs++;
    }
    this.io.send(id, { t: "judge", key: this.r.round?.key ?? "", jobs });
  }

  /** A judge reconnected while it owed answers: send its jobs again. */
  private resendJudgeWork(playerId: string) {
    if (this.r.phase !== "scoring") return;
    const jobs = Object.values(this.r.judges?.tasks ?? {}).filter((t) => !t.done && t.judges.includes(playerId) && !t.reports[playerId]).map((t) => t.job);
    if (jobs.length) this.io.send(playerId, { t: "judge", key: this.r.round?.key ?? "", jobs });
  }

  /** A judge disconnected: anything it owed goes to another device (or the other judge's answer stands). */
  private judgeGone(playerId: string) {
    for (const [id, l] of Object.entries(this.r.judges?.late ?? {})) if (l.pending.includes(playerId)) this.lateGone(id, playerId);
    const tasks = this.r.judges?.tasks;
    if (this.r.phase !== "scoring" || !tasks) return;
    for (const t of Object.values(tasks)) {
      if (t.done || t.server || !t.judges.includes(playerId) || t.reports[playerId]) continue;
      t.judges = t.judges.filter((j) => j !== playerId);
      console.log(`judge gone: ${this.r.code} ${playerId} dropped job ${t.job.id}`);
      // Nobody has answered yet: a replacement. (Someone has: theirs stands, as when a judge is late.)
      if (!Object.values(t.boards).some((b) => b)) this.replaceJudge(t);
      this.settleTask(t);
    }
    this.afterJudging();
  }

  /** Gives a job to one more device, if there's one not yet tried. */
  private replaceJudge(t: JudgeTask): boolean {
    // (A job with a deep re-check goes to another capable device, if there is one.)
    const capable = t.deep ? this.judgeDevices().filter((d) => this.capable(d.id)) : [];
    const pool = capable.some((d) => !t.tried.includes(d.id)) ? capable : this.judgeDevices();
    const [next] = drawJudges(() => this.jrng(), pool, 1, this.jcfg, new Map(), new Set(t.tried));
    if (!next) return false;
    t.judges.push(next);
    t.tried.push(next);
    t.waitUntil = undefined;
    this.jr.stats.replaced++;
    this.sendJobs(next, [t.job]);
    return true;
  }

  private strike(id: string, why: string) {
    const d = this.jr.devices[id];
    if (!d) return;
    d.strikes++;
    this.jr.stats.strikes++;
    console.log(`judge strike: ${this.r.code} ${id} (${this.nameOf(id)}) ${d.strikes}/${this.jcfg.strikes}: ${why}`);
    if (d.strikes === this.jcfg.strikes) {
      this.jr.stats.benched++;
      console.log(`judge benched: ${this.r.code} ${id} (${this.nameOf(id)}) gets no more jobs this match`);
    }
  }

  /** A device's answer to a job. */
  private judged(playerId: string, key: string, id: string, report: JudgeReport) {
    if (typeof id !== "string") return;
    const ref = this.r.judges?.referees?.[id];
    if (ref) return this.refereeAnswer(playerId, id, report);
    const late = this.r.judges?.late?.[id];
    if (late?.pending.includes(playerId)) return this.lateAnswer(playerId, id, report);
    const t = this.r.judges?.tasks?.[id];
    if (this.r.phase !== "scoring" || this.r.round?.key !== key || !t || t.done || t.server || !t.judges.includes(playerId) || playerId in t.reports) return;
    // (The quick part; an app from before deep checks sends its re-check in the same report.)
    const { deep, ...quick } = (report ?? {}) as JudgeReport;
    t.reports[playerId] = quick as JudgeReport;
    if (Array.isArray(deep) && t.job.recheck) (t.deepReports ??= {})[playerId] = deep;
    const d = this.jr.devices[playerId];
    if (d) d.answered++;
    const board = judgedBoard(quickPart(t.job), quick as JudgeReport);
    t.boards[playerId] = board;
    if (!board) {
      // An answer that doesn't hold together is wrong whatever the position: a strike, and it's as if unanswered.
      this.jr.stats.invalid++;
      this.strike(playerId, `report for ${id} doesn't hold together`);
      t.judges = t.judges.filter((j) => j !== playerId);
      if (!Object.values(t.boards).some((b) => b)) this.replaceJudge(t);
    }
    this.settleTask(t);
    this.afterJudging();
  }

  /** Decides a job when its answers allow: agreement, a dispute, one answer alone, or nobody left to ask. */
  private settleTask(t: JudgeTask) {
    if (t.done || t.server) return;
    const now = this.io.now();
    const valid = t.judges.filter((j) => t.boards[j]);
    const pending = t.judges.filter((j) => !(j in t.reports));
    if (valid.length >= 2) {
      const [a, b] = valid as [string, string];
      const { agree, diff } = boardsAgree(t.boards[a]!, t.boards[b]!, this.jcfg.tolerance);
      if (agree) {
        this.jr.stats.agreed++;
        return this.accept(t, t.boards[a]!, "agreed");
      }
      this.jr.stats.disagreed++;
      console.log(`judges disagree: ${this.r.code} job ${t.job.id} (${a} v ${b}), worst difference ${(diff * 100).toFixed(1)} points`);
      return this.dispute(t, a, b);
    }
    // (A device with a strike is never trusted alone while its partner is still searching: the job waits for both,
    // up to the usual deadline.)
    const trusted = valid.length === 1 && !(this.jr.devices[valid[0]!]?.strikes ?? 0);
    if (valid.length === 1 && (!pending.length || (trusted && t.waitUntil !== undefined && now >= t.waitUntil))) {
      const [a] = valid as [string];
      if (pending.length) {
        console.log(`judge late: ${this.r.code} job ${t.job.id}: ${pending.join(", ")} (using ${a}'s answer)`);
        // Its answer still counts for blame: compared with the one used when it comes.
        (this.jr.late ??= {})[t.job.id] = { job: t.job, judge: a, board: t.boards[a]!, pending, at: now };
      }
      t.judges = [a];
      this.jr.stats.single++;
      // The other judge is gone (dropped, timed out, or its answer didn't hold together): now and then a spot check
      // on the engine server (afterwards: the round doesn't wait). A late one is checked against its answer instead.
      if (t.want >= 2 && !pending.length) this.maybeSpotCheck(t.job, a, t.boards[a]!);
      return this.accept(t, t.boards[a]!, "single");
    }
    if (valid.length === 1) {
      // The first answer is in: the second has a little longer (graceMs, or graceFactor of the first's time).
      if (t.waitUntil === undefined && trusted) {
        const took = now - (t.sent[valid[0]!] ?? t.sentAt);
        t.waitUntil = now + Math.max(this.jcfg.graceMs, this.jcfg.graceFactor * took);
      }
      return;
    }
    if (!valid.length && !pending.length && !this.replaceJudge(t)) {
      // Nobody left who can score it: every pick counts the same, as when no host could.
      console.log(`judges: nobody could score job ${t.job.id} in ${this.r.code}`);
      this.jr.stats.fallback++;
      t.done = { board: this.equalBoard(t), how: "none" };
    }
  }

  /** Every pick scored the same (nobody could score the job), the bots picking at random. */
  private equalBoard(t: JudgeTask): JudgedBoard {
    const legal = t.job.allowed ?? legalMoves(t.job.fen).filter((m) => m !== t.job.barred);
    const botPicks = t.job.bots.map(() => legal[Math.floor(this.rng() * legal.length)]!);
    const moves = [...t.job.picks, ...botPicks, legal[0]!];
    return { bestMove: moves[0]!, bestExpected: 0.5, expectedAfter: Object.fromEntries(moves.map((m) => [m, 0.5])), botPicks, botPowerUps: [], replies: {}, mates: {}, rechecked: [] };
  }

  /**
   * A job's quick numbers are settled; then its close calls: re-checked by the devices that agreed (deep checks, or no
   * engine server), else by the engine server.
   */
  private accept(t: JudgeTask, board: JudgedBoard, how: JudgeHow) {
    t.waitUntil = undefined;
    const recheck = t.job.recheck;
    if (recheck && t.job.picks.length && (how === "agreed" || how === "majority" || (how === "single" && !this.serverOn))) {
      const flagged = recheckTargets(board, [...t.job.picks, ...board.botPicks], recheck, t.job.priority ?? []);
      t.done = { board, how };
      if (!flagged.length) return;
      const from = how === "agreed" ? [...t.judges] : how === "majority" ? [...(t.majorityPair ?? [])] : [t.judges[0]!];
      t.awaitDeep = { from, until: this.io.now() + this.jcfg.deepWaitMs };
      return this.tryDeep(t);
    }
    if (this.serverOn && t.job.picks.length) {
      const sj = this.r.scoreRequest?.jobs.find((j) => j.boardId === t.boardId);
      const flagged = recheckTargets(board, [...t.job.picks, ...board.botPicks], this.settings, sj?.priority ?? []);
      if (flagged.length) {
        t.done = { board, how };
        t.server = { kind: "recheck", id: `recheck:${t.job.id}`, at: this.io.now() };
        this.jr.stats.serverRecheck++;
        this.askServer(t.server.id, t.job.fen, [board.bestMove, ...flagged]);
        return;
      }
    }
    t.done = { board, how };
  }

  /** A device's re-check of a job's close calls (deep checks). */
  private judgedDeep(playerId: string, key: string, id: string, deep: MoveScore[]) {
    if (typeof id !== "string" || !Array.isArray(deep) || deep.length > 256) return;
    const t = this.r.judges?.tasks?.[id.replace(/~ref$/, "")];
    if (this.r.phase !== "scoring" || this.r.round?.key !== key || !t?.job.recheck) return;
    if (!t.judges.includes(playerId) && t.refereeBy !== playerId) return;
    if (t.deepReports?.[playerId]) return;
    (t.deepReports ??= {})[playerId] = deep;
    this.tryDeep(t);
    this.afterJudging();
  }

  /** The re-checks are in from the devices that agreed: identical, used; else the engine server re-checks. */
  private tryDeep(t: JudgeTask) {
    const w = t.awaitDeep;
    if (!w || !t.done || !w.from.every((j) => t.deepReports?.[j] && t.reports[j])) return;
    const boards = w.from.map((j) => judgedBoard(t.job, { ...t.reports[j]!, deep: t.deepReports![j]! }));
    w.from.forEach((j, i) => {
      if (boards[i]) return;
      this.jr.stats.invalid++;
      this.strike(j, `re-check for ${t.job.id} doesn't hold together`);
    });
    if (w.from.length === 1) {
      // (No engine server, one judge: its re-check stands, as a device's always did without the server.)
      t.awaitDeep = undefined;
      if (boards[0]) t.done = { ...t.done, board: boards[0] };
      return;
    }
    if (boards.every((b) => b) && boardsAgree(boards[0]!, boards[1]!, this.jcfg.tolerance).agree) {
      this.jr.stats.deepAgreed++;
      t.awaitDeep = undefined;
      t.done = { ...t.done, board: boards[0]! };
      return;
    }
    this.jr.stats.deepDisagreed++;
    console.log(`judges' re-checks disagree: ${this.r.code} job ${t.job.id} (${w.from.join(" v ")})`);
    t.deepBoards = Object.fromEntries(w.from.map((j, i) => [j, boards[i] ?? null]));
    this.deepFallback(t, "the devices' re-checks disagree");
  }

  /** Deep checks that disagreed or came too late: the engine server re-checks (else the quick numbers stand). */
  private deepFallback(t: JudgeTask, why: string) {
    const w = t.awaitDeep;
    t.awaitDeep = undefined;
    if (!t.done) return;
    const board = t.done.board;
    if (this.serverOn) {
      const flagged = recheckTargets(board, [...t.job.picks, ...board.botPicks], this.settings, t.job.priority ?? []);
      if (!flagged.length) return;
      console.log(`judges: ${why} on ${t.job.id} in ${this.r.code}; the engine server re-checks`);
      t.server = { kind: "recheck", id: `recheck:${t.job.id}`, at: this.io.now() };
      this.jr.stats.serverRecheck++;
      this.askServer(t.server.id, t.job.fen, [board.bestMove, ...flagged]);
      return;
    }
    // No engine server: late, a re-check that did come from a device without a strike stands; disagreeing, or
    // nothing came, the quick numbers.
    const ok = t.deepBoards ? undefined : (w?.from ?? []).find((j) => t.deepReports?.[j] && !(this.jr.devices[j]?.strikes ?? 0));
    const full = ok ? judgedBoard(t.job, { ...t.reports[ok]!, deep: t.deepReports![ok]! }) : null;
    if (full) t.done = { ...t.done, board: full };
    console.log(`judges: ${why} on ${t.job.id} in ${this.r.code}, and no engine server: ${full ? `${ok}'s re-check` : "the quick numbers"} stand`);
  }

  private askServer(id: string, fen: string, moves: string[]) {
    this.io.serverScore!({ id, fen, moves, boards: Object.keys(this.r.judges?.tasks ?? {}).length || 1 });
  }

  /**
   * Two judges disagree. A third device that can do the job (a capable one when the job carries a deep re-check) gets
   * it, and the engine server is asked for its verdict at the same moment: whichever settles it first stands (two of
   * three devices exactly alike, or the server's verdict), so a dispute is never slower than the server alone. With no
   * engine server, the third device settles it (or the more trusted judge, if it can't).
   */
  private dispute(t: JudgeTask, a: string, b: string) {
    t.judges = [a, b];
    t.waitUntil = undefined;
    const pool = t.deep ? this.judgeDevices().filter((d) => this.capable(d.id)) : this.judgeDevices();
    const [ref] = drawJudges(() => this.jrng(), pool, 1, this.jcfg, new Map(), new Set(t.tried));
    if (ref) {
      t.refereed = true;
      t.refereeBy = ref;
      t.tried.push(ref);
      const id = `${t.job.id}~ref`;
      (this.jr.referees ??= {})[id] = { job: { ...t.job, id }, by: ref, boards: { [a]: t.boards[a]!, [b]: t.boards[b]! }, at: this.io.now() };
      this.io.send(ref, { t: "judge", key: this.r.round?.key ?? "", jobs: [{ ...t.job, id }] });
    }
    if (this.serverOn) return this.askVerdict(t);
    if (ref) {
      t.server = { kind: "referee", id: `${t.job.id}~ref`, at: this.io.now() };
      return;
    }
    this.fallback(t, "no engine server, and no third device");
  }

  /** The engine server's verdict on a dispute: it scores every move either judge scored. */
  private askVerdict(t: JudgeTask) {
    const [a, b] = t.judges as [string, string];
    t.server = { kind: "verdict", id: `verdict:${t.job.id}`, at: this.io.now() };
    this.jr.stats.serverVerdict++;
    this.askServer(t.server.id, t.job.fen, verdictMoves(t.job, [t.reports[a]!, t.reports[b]!], [t.boards[a]!, t.boards[b]!]));
  }

  /** A dispute with no verdict: the judge with fewer strikes stands (then the faster device), as the host's did. */
  private fallback(t: JudgeTask, why: string) {
    const devices = this.jr.devices;
    const valid = t.judges.filter((j) => t.boards[j]);
    const pick = [...valid].sort((x, y) => (devices[x]?.strikes ?? 0) - (devices[y]?.strikes ?? 0) || (devices[y]?.nps ?? 0) - (devices[x]?.nps ?? 0))[0]!;
    console.log(`judges: ${why}; using ${pick}'s answer for job ${t.job.id} in ${this.r.code}`);
    this.jr.stats.fallback++;
    t.server = undefined;
    t.done = { board: t.boards[pick]!, how: "fallback" };
  }

  /** One judge's answer used alone, with no second answer to check it against: now and then the engine server checks it afterwards (blame only). */
  private maybeSpotCheck(job: JudgeJob, judge: string, board: JudgedBoard) {
    if (!this.serverOn || this.jrng() >= this.jcfg.spotCheckShare) return;
    const id = `spot:${job.id}`;
    (this.jr.spots ??= {})[id] = { job, boards: { [judge]: board } };
    this.jr.stats.serverSpot++;
    this.askServer(id, job.fen, verdictMoves(job, [], [board]));
  }

  /** A late judge that will never answer (gone, or too long): the job it owed is as good as answered alone. */
  private lateGone(id: string, judge?: string) {
    const late = this.r.judges?.late?.[id];
    if (!late) return;
    late.pending = judge ? late.pending.filter((j) => j !== judge) : [];
    if (late.pending.length) return;
    delete this.r.judges!.late![id];
    this.maybeSpotCheck(late.job, late.judge, late.board);
  }

  /** The engine server's answer (null: it couldn't). */
  serverScored(id: string, moves: MoveScore[] | null) {
    const spot = this.r.judges?.spots?.[id];
    if (spot) {
      delete this.r.judges!.spots![id];
      if (!moves) return void this.jr.stats.serverFailed++;
      const judges = Object.keys(spot.boards);
      const boards = judges.map((j) => spot.boards[j]!);
      const verdict = verdictBoard(spot.job, moves, boards[0]!);
      if (!verdict) return;
      // (A late answer's dispute that went to a third device too: its second opinion decides the blame instead.)
      if (spot.refereed) return;
      const { blamed, distances } = blameJudge(verdict, boards, this.jcfg.blameMargin, this.jcfg.soloBlame);
      for (const i of blamed) {
        this.jr.stats.spotCaught++;
        this.strike(judges[i]!, `${judges.length === 1 ? "spot check" : "late answer's dispute"} on ${spot.job.id}: ${distances[i]!.toFixed(1)} points off the engine server`);
      }
      return;
    }
    const t = Object.values(this.r.judges?.tasks ?? {}).find((x) => x.server?.id === id);
    if (!t || this.r.phase !== "scoring") return;
    const kind = t.server!.kind;
    t.server = undefined;
    if (!moves) this.jr.stats.serverFailed++;
    if (kind === "recheck") {
      // Close calls: the deep numbers go in (the judges' numbers stand if the server couldn't answer).
      if (moves && t.done) {
        const sj = this.r.scoreRequest?.jobs.find((j) => j.boardId === t.boardId);
        const b = t.done.board;
        const flagged = recheckTargets(b, [...t.job.picks, ...b.botPicks], this.settings, sj?.priority ?? []);
        const checked = applyRecheck(b, flagged, moves);
        t.done = { ...t.done, board: { ...b, bestMove: checked.bestMove, bestExpected: checked.bestExpected, expectedAfter: checked.expectedAfter, rechecked: checked.rechecked } };
        // Two devices' re-checks disagreed: the one further from the server's (by blameMargin) is struck.
        if (t.deepBoards) {
          const ids = Object.keys(t.deepBoards).filter((j) => t.deepBoards![j]);
          if (ids.length === 2) {
            const { blamed, distances } = blameJudge(t.done.board, ids.map((j) => t.deepBoards![j]!), this.jcfg.blameMargin, this.jcfg.soloBlame);
            for (const i of blamed) this.strike(ids[i]!, `re-check on ${t.job.id} ${distances[i]!.toFixed(1)} points off the engine server's`);
          }
        }
      } else if (!moves) console.log(`judges: engine server didn't answer a re-check in ${this.r.code}; the judges' numbers stand`);
      return this.afterJudging();
    }
    if (!moves) {
      this.fallback(t, "engine server unavailable (down, out of budget or slow)");
      return this.afterJudging();
    }
    // The verdict: the server's numbers. The bots' picks follow the judge closer to it.
    const [a, b] = t.judges as [string, string];
    const first = verdictBoard(t.job, moves, t.boards[a]!);
    if (!first) {
      this.fallback(t, "engine server's verdict was empty");
      return this.afterJudging();
    }
    const { blamed, distances } = blameJudge(first, [t.boards[a]!, t.boards[b]!], this.jcfg.blameMargin, this.jcfg.soloBlame);
    // (A tie: the judge with fewer strikes.)
    const strikesOf = (j: string) => this.jr.devices[j]?.strikes ?? 0;
    const closer = distances[0]! < distances[1]! || (distances[0] === distances[1] && strikesOf(a) <= strikesOf(b)) ? a : b;
    t.done = { board: closer === a ? first : verdictBoard(t.job, moves, t.boards[b]!)!, how: "verdict" };
    const refereed = !!t.refereed;
    console.log(`judges: verdict for ${t.job.id} in ${this.r.code}: ${a} ${distances[0]!.toFixed(1)} and ${b} ${distances[1]!.toFixed(1)} points off${refereed ? " (a third device decides who's to blame)" : ""}`);
    // A third device will say exactly who was off; without one, blame goes by distance from the verdict.
    if (!refereed) for (const i of blamed) this.strike(i === 0 ? a : b, `${distances[i]!.toFixed(1)} points off the engine server's verdict on ${t.job.id}`);
    this.afterJudging();
  }

  /**
   * A judge's answer that came after the job was settled on the other's: compared now. Agreement: nothing to do.
   * Disagreement: a dispute after the fact (blame only; the round's scores stand): a third device's second opinion,
   * and the engine server.
   */
  private lateAnswer(playerId: string, id: string, report: JudgeReport) {
    const late = this.r.judges!.late![id]!;
    late.pending = late.pending.filter((j) => j !== playerId);
    if (!late.pending.length) delete this.r.judges!.late![id];
    const mine = judgedBoard(quickPart(late.job), report);
    if (!mine) {
      this.jr.stats.invalid++;
      return this.strike(playerId, `late report for ${id} doesn't hold together`);
    }
    if (boardsAgree(late.board, mine, this.jcfg.tolerance).agree) return void this.jr.stats.lateAgreed++;
    this.jr.stats.lateDisagreed++;
    console.log(`judges disagree (late): ${this.r.code} job ${id} (${late.judge} v ${playerId}); the scores used stand`);
    const [ref] = drawJudges(() => this.jrng(), this.judgeDevices(), 1, this.jcfg, new Map(), new Set([late.judge, playerId]));
    if (ref) {
      const rid = `${id}~ref`;
      (this.jr.referees ??= {})[rid] = { job: { ...late.job, id: rid }, by: ref, boards: { [late.judge]: late.board, [playerId]: mine }, at: this.io.now() };
      this.io.send(ref, { t: "judge", key: this.r.round?.key ?? "", jobs: [{ ...late.job, id: rid }] });
    }
    // (A third device's exact second opinion settles the blame; the engine server only when there's none.)
    if (this.serverOn && !ref) {
      const sid = `late:${id}`;
      (this.jr.spots ??= {})[sid] = { job: late.job, boards: { [late.judge]: late.board, [playerId]: mine }, ...(ref ? { refereed: true } : {}) };
      this.jr.stats.serverSpot++;
      this.askServer(sid, late.job.fen, verdictMoves(late.job, [], [late.board, mine]));
    }
  }

  /** A third device's second opinion on a dispute: whichever judge it doesn't match exactly gets a strike. */
  private refereeAnswer(playerId: string, id: string, report: JudgeReport) {
    const ref = this.r.judges!.referees![id]!;
    if (ref.by !== playerId) return;
    delete this.r.judges!.referees![id];
    const mine = judgedBoard(quickPart(ref.job), report);
    if (!mine) {
      this.jr.stats.invalid++;
      return this.strike(playerId, `second opinion on ${id} doesn't hold together`);
    }
    const matches = Object.entries(ref.boards).filter(([, b]) => b && boardsAgree(mine, b, this.jcfg.tolerance).agree).map(([j]) => j);
    this.jr.stats.refereed++;
    // A dispute waiting on this: two of three decide the scores (and the re-check goes to those two).
    const t = Object.values(this.r.judges?.tasks ?? {}).find((x) => (x.server?.kind === "referee" && x.server.id === id) || (x.server?.kind === "verdict" && `${x.job.id}~ref` === id));
    if (t && this.r.phase === "scoring" && (matches.length === 1 || t.server?.kind === "referee")) {
      // (Settled two of three before the server's verdict came: its answer, when it comes, is ignored.)
      t.server = undefined;
      if (matches.length === 1) {
        this.jr.stats.majority++;
        const { deep, ...quick } = report;
        t.reports[playerId] = quick as JudgeReport;
        if (Array.isArray(deep) && t.job.recheck) (t.deepReports ??= {})[playerId] = deep;
        t.judges = [matches[0]!];
        t.majorityPair = [matches[0]!, playerId];
        this.accept(t, ref.boards[matches[0]!]!, "majority");
      } else this.fallback(t, "the second opinion matched neither judge");
      this.afterJudging();
    }
    if (matches.length !== 1) return void console.log(`judges: second opinion on ${id} in ${this.r.code} matched ${matches.length ? "both" : "neither"}: no blame`);
    for (const j of Object.keys(ref.boards)) if (j !== matches[0]) this.strike(j, `differed from two others on ${ref.job.id.replace(/~ref$/, "")}`);
  }

  /** The judges' timers: a late second judge, a judge that never answered, an engine server that never did. */
  private judgeTick() {
    const tasks = this.r.judges?.tasks;
    if (this.r.phase !== "scoring" || !tasks) return;
    const now = this.io.now();
    for (const t of Object.values(tasks)) {
      if (t.server && now >= t.server.at + waitFor(t.server.kind, this.jcfg.refereeWaitMs)) {
        if (t.server.kind === "referee") this.fallback(t, "no second opinion in time");
        else this.serverScored(t.server.id, null);
        continue;
      }
      if (t.awaitDeep && now >= t.awaitDeep.until) {
        this.jr.stats.deepLate++;
        this.deepFallback(t, `re-checks late (${t.awaitDeep.from.filter((j) => !t.deepReports?.[j]).join(", ")})`);
        continue;
      }
      if (t.done || t.server) continue;
      for (const j of t.judges.filter((x) => !(x in t.reports) && now >= (t.sent[x] ?? t.sentAt) + SCORE_TIMEOUT_MS)) {
        console.log(`judge timed out: ${this.r.code} ${j} on job ${t.job.id}`);
        t.judges = t.judges.filter((x) => x !== j);
        if (!Object.values(t.boards).some((b) => b)) this.replaceJudge(t);
      }
      this.settleTask(t);
    }
    this.afterJudging();
  }

  /** The next judges' deadline, as the lobby's timer. */
  private armJudgeTimer() {
    const times: number[] = [];
    for (const t of Object.values(this.r.judges?.tasks ?? {})) {
      if (t.server) times.push(t.server.at + waitFor(t.server.kind, this.jcfg.refereeWaitMs));
      if (t.awaitDeep) times.push(t.awaitDeep.until);
      if (t.done || t.server) continue;
      if (t.waitUntil !== undefined) times.push(t.waitUntil);
      for (const j of t.judges) if (!(j in t.reports)) times.push((t.sent[j] ?? t.sentAt) + SCORE_TIMEOUT_MS);
    }
    if (times.length) this.setTimer("judgeTick", Math.min(...times));
  }

  /** Every job settled: the round's scores, as the host's used to be. */
  private afterJudging() {
    const tasks = this.r.judges?.tasks;
    if (this.r.phase !== "scoring" || !tasks) return;
    if (!Object.values(tasks).every((t) => t.done && !t.server && !t.awaitDeep)) return this.armJudgeTimer();
    const round = this.r.round!;
    const boards: BoardScore[] = Object.values(tasks).map((t) => {
      const b = t.done!.board;
      return {
        boardId: t.boardId,
        bestMove: b.bestMove,
        bestExpected: b.bestExpected,
        expectedAfter: b.expectedAfter,
        botPicks: Object.fromEntries(t.botIds.map((id, i) => [id, b.botPicks[i]!])),
        botThinkMs: {},
        botPowerUps: b.botPowerUps.map((i) => t.botIds[i]!),
        replies: b.replies,
        mates: b.mates,
      };
    });
    // Crowd: the early bot picks someone sent must be what two agreeing judges worked out (from the same seed).
    const plan = round.botPlan;
    const first = boards[0];
    const firstHow = Object.values(tasks)[0]?.done?.how;
    if (plan?.by && first && firstHow === "agreed" && Object.entries(plan.picks).some(([id, m]) => first.botPicks[id] !== undefined && first.botPicks[id] !== m)) {
      this.strike(plan.by, `bot picks it planned for ${round.key} don't follow from the position`);
    }
    this.io.settled?.(Object.values(tasks).map((t) => ({ id: t.job.id, boardId: t.boardId, how: t.done!.how, judges: [...t.judges], board: t.done!.board })));
    this.jr.tasks = undefined;
    this.r.timer = null;
    this.applyScores(boards, true);
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

  /**
   * Fair play: each person's pick this round, with what the round's judged numbers say about it (core/fairplay.ts):
   * its loss, the share of the other people in that position who found the best move, how many moves were close to
   * the best, think time, look-aways. Practice players (unlimited hints) aren't recorded, and neither they nor anyone
   * who used a power-up counts in anyone's crowd.
   */
  private noteFair(report: RoundReport, lastMoves: Map<number, string | null>) {
    const round = this.r.round;
    if (!round) return;
    const people = new Set(this.r.humans.filter((h) => !h.practice).map((h) => h.id));
    const sig = FAIRPLAY.signals;
    let added = false;
    for (const b of report.boards) {
      const picked = b.result.players.filter((p) => people.has(p.playerId) && p.move && p.loss !== null);
      if (!picked.length || !b.scored.length) continue;
      const best = b.scored[0]!;
      const near = b.scored.filter((x) => x.loss <= sig.nearPoints).length;
      const last = lastMoves.get(b.boardId) ?? null;
      const legal = legalMoves(b.fenBefore).length;
      const [, side, , , , full] = b.fenBefore.split(" ");
      const ply = (Math.max(1, Number(full) || 1) - 1) * 2 + (side === "b" ? 1 : 0);
      const crowd = picked.filter((p) => !p.usedPowerUp);
      const tally = new Map<string, number>();
      for (const o of crowd) tally.set(o.move!, (tally.get(o.move!) ?? 0) + 1);
      for (const p of picked) {
        const others = crowd.filter((o) => o.playerId !== p.playerId);
        // What the others picked, the most picked few (the crowd's rate for any move, read later).
        const mine = crowd.includes(p) ? p.move! : null;
        const picks = Object.fromEntries(
          [...tally.entries()]
            .map(([m, n]) => [m, n - (m === mine ? 1 : 0)] as const)
            .filter(([, n]) => n > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6),
        );
        const pick = round.picks[p.playerId];
        const move: FairMove = {
          ply,
          fen: b.fenBefore,
          move: p.move!,
          best: best.move,
          loss: Math.round(p.loss! * 100) / 100,
          bestExp: Math.round(best.expected * 1000) / 1000,
          near,
          gap: b.scored.length > 1 ? Math.round(b.scored[1]!.loss * 100) / 100 : null,
          crowd: others.length,
          crowdFound: others.filter((o) => o.loss! <= sig.foundLoss).length,
          picks,
          thinkMs: pick?.thinkMs ?? 0,
          away: pick?.away ?? 0,
          legal,
          top: b.scored.slice(0, FAIRPLAY.deep.candidates).map((x) => x.move),
          ...(p.usedPowerUp ? { powerUp: true } : {}),
          ...(b.power ? { power: true } : {}),
          ...(last && best.move.slice(2, 4) === last.slice(2, 4) ? { recapture: true } : {}),
        };
        ((this.r.fair ??= {})[p.playerId] ??= []).push(move);
        added = true;
      }
    }
    if (added) this.r.fairV = (this.r.fairV ?? 0) + 1;
  }

  /** Fair play: a person's recorded picks this match (for their fair-play summary once it's over). */
  fairMoves(playerId: string): FairMove[] {
    return this.r.fair?.[playerId] ?? [];
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

  /** The home page's live window: the crowd's top votes on the move just played (Crowd and boss raids; no names). */
  private noteLiveVotes(b: BoardRound) {
    const counts = new Map<string, number>();
    for (const p of b.result.players) if (p.move) counts.set(p.move, (counts.get(p.move) ?? 0) + 1);
    const played = b.result.playedMove;
    const top = [...counts.entries()].sort((x, y) => y[1] - x[1] || (x[0] === played ? -1 : y[0] === played ? 1 : 0)).slice(0, 3);
    const board = this.runner?.boards.get(b.boardId);
    this.r.liveVotes = { ply: board?.history.length ?? 0, votes: top.map(([m, n]) => [toSan(b.fenBefore, m), n]) };
  }

  /** What the live line and the "playing now" list need to know about this lobby (and, for Crowd and raids, its board). */
  liveSummary(): {
    phase: "waiting" | "playing" | "over";
    humans: number;
    alive: number | null;
    total: number | null;
    bossElo: number | null;
    startedAt: number | null;
    board: LiveMatchBoard | null;
  } {
    const runner = this.runner;
    const phase = this.r.phase === "results" ? "over" : this.r.phase === "lobby" && !this.r.auto?.filledAt ? "waiting" : "playing";
    const id = runner?.state.boards[0];
    const b = runner && phase === "playing" && this.settings.mode === "crowd" && id !== undefined ? runner.boards.get(id) : undefined;
    const votes = this.r.liveVotes;
    return {
      phase,
      humans: this.r.humans.filter((h) => h.connected).length,
      alive: runner && phase === "playing" ? runner.alive().length : null,
      total: runner ? runner.state.players.length : null,
      bossElo: this.settings.raid ? (this.settings.bossFixedElo ?? null) : null,
      startedAt: this.r.startedAt ?? this.r.auto?.filledAt ?? null,
      board: b ? { fen: b.fen, lastMove: b.lastMove, votes: votes && votes.ply === b.history.length ? votes.votes : [], ply: b.history.length } : null,
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
    const js = this.r.judges;
    if (js?.stats.jobs) console.log(`judges in ${this.r.code}: ${JSON.stringify(js.stats)}`);
  }

  // ---------------- Quick chat ----------------

  private get chat(): ChatRecord {
    return (this.r.chat ??= { n: 0, lines: [], sent: {}, owned: {}, iconTo: {}, off: {}, muted: {}, bots: [] });
  }

  /**
   * Chat is on in Crowd matches (50 v 50, everyone moves) and boss raids, from the lobby before the match (the queue,
   * a private lobby) to the results. Not in Classic.
   */
  chatOpen(): boolean {
    return this.settings.mode === "crowd";
  }

  /**
   * Before the match (the queue, a private lobby, the full grid's moment before the votes): there are no teams yet,
   * so there's one channel, everyone in the lobby. Every line you own may go to it (there's no other team to keep a
   * plan from), and its lines stay in the match's feed, marked as the lobby's.
   */
  private chatInLobby(): boolean {
    return this.r.phase === "lobby";
  }

  /** Whose limits a line counts against: the account's (a new seat in the same lobby doesn't reset them), else the seat's. */
  private chatKey(id: string): string {
    const uid = this.r.accounts?.[id];
    return uid ? `u:${uid}` : id;
  }

  /** Someone left the lobby before the match: their chat choices go (their lines stay with those who saw them). */
  private chatGone(id: string) {
    const c = this.r.chat;
    if (!c) return;
    delete c.owned[id];
    delete c.iconTo[id];
    delete c.off[id];
    delete c.muted[id];
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

  /**
   * The recent lines this player can see, and their packs (they joined, they're back, or the match began). Only lines
   * from people still here: someone who left the queue took their seat and their name with them, so a newcomer
   * never sees a line from nobody. `fresh`: the device has nothing yet (it joined or reconnected), so every sender's
   * icon goes again.
   */
  private sendChatLog(id: string, fresh = true) {
    if (!this.chatOpen() || !this.human(id)) return;
    const c = this.chat;
    if (fresh) c.iconTo[id] = [];
    const here = new Set([...this.r.humans.map((h) => h.id), ...this.r.bots.map((b) => b.id)]);
    const lines = c.lines.filter((l) => here.has(l.from) && this.chatHears(id, l)).slice(-QUICK_CHAT.feedSize);
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
   * lines show as buttons is their profile's picks: the app's business. Any line they own may go.) In the lobby
   * before the match, every line goes to everyone there (no teams yet), with the same checks.
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
    const lobby = this.chatInLobby();
    const toAll = !lobby && to === "all";
    if (toAll && !canSayToAll(line.id)) return refuse("team");
    const key = this.chatKey(playerId);
    const sent = c.sent[key] ?? noChatSent();
    const check = chatCheck(sent, line.id, now);
    if (!check.ok) return refuse(check.limit, check.retryAt);
    c.sent[key] = chatSent(sent, line.id, now);
    this.chatPost(this.chatLine(playerId, line.id, toAll ? "all" : "team", now));
  }

  /** A line to post: in the lobby, to everyone there; in the match, to the sender's team (or everyone). */
  private chatLine(from: string, say: string, to: "team" | "all", at: number): Omit<NetChatLine, "n"> {
    if (this.chatInLobby()) return { from, say, to: "all", team: null, at, lobby: true };
    return { from, say, to, team: this.chatTeam(from), at };
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
      this.chatPost(this.chatLine(l.from, l.say, l.to, at));
    }
  }
}
