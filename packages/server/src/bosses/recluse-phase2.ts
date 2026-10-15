/**
 * The Hidden Boss's phase 2 on the lobby server (DECISIONS.md, "The Hidden Boss's phase 2 online"): the Crowd's boss
 * final, phase 1 won, then his fall, the phase change and his four boards at once, the finalists on boards 0-3 and every
 * other device in the lobby watching. The rules are solo's own (packages/chess/src/bosses/recluse-phase2.ts: the clocks,
 * slow moves, his ultimate, the results); this file runs them on server time and asks devices for the moves the server
 * can't make (it has no engine): his, and a bot finalist's.
 *
 * His brain (`askBoss`): the host's device, one board at a time in phase2Next's order (option (a)). A device that doesn't
 * answer within RECLUSE_PHASE2.hostWaitMs hands the move to the next device (the lobby's host moves with it); with no
 * device left, the last resort plays it (phase2FallbackMove: a quick material search, never a random move). The engine
 * server (option (b)) plugs in through LobbyIO.serverMove: every waiting board at once, a short wait each, and any move it
 * can't make goes to the host as above.
 *
 * The lobby routes here: its "phase2" timer, the messages p2Move, p2Answer and p2Resign, the host's work when the host
 * changes, someone leaving with a board in play, the admins' test trigger and the results.
 */
import { DEFAULT_SETTINGS, RECLUSE_PHASE2, type Settings } from "@chessroyale/core";
import {
  PHASE2_CHANGE_MS,
  PHASE2_FALL_MS,
  legalMoves,
  phase2BotThink,
  phase2Changes,
  phase2Due,
  phase2FallbackMove,
  phase2Move,
  phase2Next,
  phase2Numbers,
  phase2Outcome,
  phase2Queue,
  phase2Resign,
  phase2Tick,
  phase2ToMove,
  phase2Ult,
  startPhase2,
  type NetPhase2,
  type Phase2State,
} from "@chessroyale/chess";
import type { BossLobby } from "./base.ts";
import type { LobbyRecord, Outgoing } from "../lobby.ts";

/** How long the lobby waits for the engine server's move before the host plays it (option (b), not wired yet). */
export const SERVER_MOVE_WAIT_MS = 3000;

/** A move the lobby has asked for and not yet had: his on a board, or a bot finalist's. */
export interface Phase2Ask {
  key: string;
  kind: "boss" | "bot";
  board: number;
  /** The position it's for: an answer for any other is dropped (the key is this board at this position). */
  fen: string;
  /** Asked of devices (the host, then the next...: an answer is taken from these only), or of the engine server. */
  by: "host" | "server";
  to: string[];
  /** When it's given up on (the next device, the host, or the last resort). */
  until: number;
}

/** Phase 2 in a lobby's record (stored with it between messages). */
export interface Phase2Record {
  /** "fall": phase 1 beaten, he collapses; "change": the phase change; "play": the clocks run; "end": his reaction. */
  stage: "fall" | "change" | "play" | "end";
  /** When the stage began; and (the end) when the results come. */
  at: number;
  until?: number;
  /** Phase 1's last position (the phase change splits it). */
  from: string;
  state: Phase2State;
  /** Every player's name by id (the finalists, and a bot that took a board since), and which of them are bots. */
  names: Record<string, string>;
  bots: string[];
  /** Boards waiting for his move, in the order they came. */
  waiting: number[];
  asks: Phase2Ask[];
  /** A bot's move on a board (by board id): when it may be played (its thinking time), its search's budget, the move once sent. */
  botMoves: Record<string, { due: number; searchMs: number; move?: string }>;
  /** His moves the engine server couldn't make (board:ply): the host plays them. */
  serverFailed?: string[];
  lastSlow: { board: number; at: number } | null;
  /** The test switch (?win=1): every board from a mate in one, and the bots play their best. */
  win?: true;
  /** Moves the last resort played (no device answered), his and the bots'. */
  fallbacks: number;
}

/** What phase 2 needs of the lobby (LobbyCore hands it over: its `bossLobby`). */
export interface Phase2Lobby extends BossLobby {
  rng(): number;
  broadcast(msg: Outgoing, remember?: boolean): void;
  /** The device for the lobby's engine work now (the host), and the next one, not any of `exclude`. */
  hostNow(): string | null;
  pickHost(exclude: readonly string[]): string | null;
  /** Phase 1 beaten: everyone sees him fall until `until` (the boss message's `fall`, and `phase2`: his phase change follows). */
  bossFall(until: number): void;
  finishMatch(): void;
  /** The engine server plays his move (LobbyIO.serverMove: option (b)); false or missing: the host does. */
  serverMove?(req: { key: string; fen: string; elo: number; nodes: number; moveMs: number }): boolean;
  /** A kill switch is on (LobbyIO.paused). */
  paused?(name: string): boolean;
}

/** The kill switch that pauses the Hidden Boss (kill-switches.ts): phase 2 doesn't start while it's on, as phase 1 doesn't. */
export const PAUSE_RECLUSE = "PAUSE_BOSS_RECLUSE";

/**
 * Whether his phase 2 follows phase 1 won in this lobby: on (RECLUSE_PHASE2.online, or the lobby's test switch), not
 * paused, the Hidden Boss beaten by the crowd in a Crowd final (never a raid), with a finalist for every board.
 */
export function phase2Follows(L: Pick<Phase2Lobby, "settings" | "runner" | "paused">, finalists: number): boolean {
  const s: Settings = L.settings ?? DEFAULT_SETTINGS;
  const boss = L.runner?.boss;
  if (!(RECLUSE_PHASE2.online || s.phase2Online) || L.paused?.(PAUSE_RECLUSE)) return false;
  return boss?.id === "recluse" && boss.result === "crowd" && s.mode === "crowd" && !s.raid && RECLUSE_PHASE2.boards >= 1 && finalists >= RECLUSE_PHASE2.boards;
}

const p2 = (L: Phase2Lobby) => L.r.p2!;
/** Phase 2's rules' numbers in this lobby (a test lobby's ?slow=N: his ultimate sooner). */
const rules = (L: Pick<Phase2Lobby, "settings">) => (L.settings.phase2SlowForUlt ? { ...RECLUSE_PHASE2, slowMovesForUlt: L.settings.phase2SlowForUlt } : RECLUSE_PHASE2);
const boardOf = (st: Phase2State, id: number) => st.boards.find((b) => b.id === id);
const isBot = (p: Phase2Record, id: string) => p.bots.includes(id);

/** Phase 2 as everyone sees it (no clocks shown running before play). */
export function phase2View(p: Phase2Record): NetPhase2 {
  const playing = p.stage === "play" || p.stage === "end";
  return {
    stage: p.stage === "fall" ? "change" : p.stage,
    at: p.at,
    ...(p.until !== undefined ? { until: p.until } : {}),
    from: p.from,
    slow: p.state.slow,
    lastSlow: p.lastSlow,
    ultAt: p.state.ultAt,
    boards: p.state.boards.map((b) => ({
      id: b.id,
      player: b.player,
      name: p.names[b.player] ?? "Bot",
      number: b.number,
      fen: b.board.fen,
      lastMove: b.board.lastMove,
      history: b.board.history,
      ...(b.board.bases ? { bases: b.board.bases } : {}),
      bankMs: b.bankMs,
      turnAt: playing ? b.turnAt : null,
      toMove: playing ? phase2ToMove(b) : null,
      result: b.result,
    })),
  };
}

/** The phase 2 message to send someone (re)joining now, or null (none yet: he's still falling, or it isn't on). */
export function phase2Message(r: LobbyRecord): Outgoing | null {
  const p = r.p2;
  return r.phase === "phase2" && p && p.stage !== "fall" ? { t: "phase2", p2: phase2View(p) } : null;
}

/** Where the battle stands, for the results (null: no phase 2 in this match). */
export function phase2Result(r: LobbyRecord): { won: number; of: number; beaten: boolean } | null {
  if (!r.p2) return null;
  const o = phase2Outcome(r.p2.state);
  return { won: o.won, of: o.of, beaten: o.beaten };
}

/** The board someone plays that's still in play, or null (none: a watcher, or theirs is decided). */
export function liveBoardOf(r: LobbyRecord, playerId: string): number | null {
  const b = r.phase === "phase2" ? r.p2?.state.boards.find((x) => x.player === playerId && !x.result) : undefined;
  return b ? b.id : null;
}

// ---------------- Its stages ----------------

/**
 * Phase 1 beaten, his phase 2 follows: the boards are set up now (each its own Chess960 start, from the battle's seed;
 * the finalists in their places, best first), and everyone sees him fall (PHASE2_FALL_MS), then the phase change
 * (PHASE2_CHANGE_MS), then the clocks start.
 */
function begin(L: Phase2Lobby, finalists: readonly { id: string; name: string; isBot: boolean }[]) {
  const runner = L.runner!;
  const now = L.now();
  const players = finalists.slice(0, RECLUSE_PHASE2.boards);
  const seed = runner.state.boss?.powers?.seed ?? Math.floor(L.rng() * 2 ** 32);
  const win = !!L.settings.bossWinTest;
  const numbers = phase2Numbers(seed);
  L.r.p2 = {
    stage: "fall",
    at: now,
    from: runner.boards.get(runner.state.boards[0]!)!.fen,
    state: startPhase2({ players: players.map((p) => p.id), numbers, now, win }),
    names: Object.fromEntries(players.map((p) => [p.id, p.name])),
    bots: players.filter((p) => p.isBot).map((p) => p.id),
    waiting: [],
    asks: [],
    botMoves: {},
    lastSlow: null,
    ...(win ? { win: true as const } : {}),
    fallbacks: 0,
  };
  L.r.phase = "phase2";
  console.log(`lobby ${L.r.code}: the Hidden Boss's phase 2 follows (${players.map((p) => (p.isBot ? "bot" : p.id)).join(", ")})`);
  L.bossFall(now + PHASE2_FALL_MS);
  schedule(L);
}

function stageChange(L: Phase2Lobby) {
  const p = p2(L);
  p.stage = "change";
  p.at = L.now();
  send(L);
  schedule(L);
}

/** The phase change is over: every clock starts (the players are White), the bots start thinking. */
function stagePlay(L: Phase2Lobby) {
  const p = p2(L);
  const now = L.now();
  p.state = startPhase2({ players: p.state.boards.map((b) => b.player), numbers: p.state.boards.map((b) => b.number), now, win: !!p.win });
  p.stage = "play";
  p.at = now;
  for (const b of p.state.boards) if (isBot(p, b.player)) botTurn(L, b.id, now);
  pump(L);
  send(L);
  schedule(L);
}

/** Every board decided: his reaction holds the boards (RECLUSE_PHASE2.endMs), then the results. */
function stageEnd(L: Phase2Lobby, now: number) {
  const p = p2(L);
  p.stage = "end";
  p.until = now + RECLUSE_PHASE2.endMs;
  p.asks = [];
  p.botMoves = {};
  const o = phase2Outcome(p.state);
  console.log(`lobby ${L.r.code}: phase 2 over, ${o.won} of ${o.of} won${p.fallbacks ? ` (${p.fallbacks} moves by the last resort)` : ""}`);
}

// ---------------- The state, the queue and the devices ----------------

/** A change of the state: what it brought (a slow move, boards decided, his turn, a bot's turn), the asks it made stale. */
function apply(L: Phase2Lobby, next: Phase2State, now: number): boolean {
  const p = p2(L);
  const before = p.state;
  if (next === before) return false;
  p.state = next;
  const c = phase2Changes(before, next);
  if (c.slow) p.lastSlow = { board: c.slow.board, at: now };
  p.waiting = phase2Queue(p.waiting, next, c);
  // (A board that moved on: whatever was asked for it, and a bot's move in hand, are for a position that's gone.)
  p.asks = p.asks.filter((a) => {
    const b = boardOf(next, a.board);
    return !!b && b.board.fen === a.fen && phase2ToMove(b) === (a.kind === "boss" ? "boss" : "crowd");
  });
  for (const b of next.boards) {
    const was = boardOf(before, b.id);
    if (was && was.board.fen !== b.board.fen) delete p.botMoves[b.id];
    if (b.result) delete p.botMoves[b.id];
  }
  for (const id of c.crowdTurns) if (isBot(p, boardOf(next, id)!.player)) botTurn(L, id, now);
  if (c.done) stageEnd(L, now);
  return true;
}

/** A bot's turn begins: it thinks a bullet player's while (its clock running); a device works out its move meanwhile. */
function botTurn(L: Phase2Lobby, board: number, now: number) {
  const p = p2(L);
  const { thinkMs, searchMs } = phase2BotThink(() => L.rng(), { ultCome: p.state.ultAt !== null, win: !!p.win });
  p.botMoves[board] = { due: now + thinkMs, searchMs };
}

const plyOf = (st: Phase2State, id: number) => boardOf(st, id)?.board.history.length ?? 0;

/**
 * Asks for the moves the boards wait for: his on each waiting board (the engine server, every board at once, when it's
 * there; else the host, one board at a time, in phase2Next's order), and a bot's on each board where a bot is thinking
 * (the host, one at a time). Nothing is asked twice.
 */
function pump(L: Phase2Lobby) {
  const p = p2(L);
  if (p.stage !== "play") return;
  const now = L.now();
  p.waiting = phase2Queue(p.waiting, p.state);
  const asked = (id: number, kind: Phase2Ask["kind"]) => p.asks.some((a) => a.board === id && a.kind === kind);
  // His moves: the engine server first (option (b)), for any board it hasn't failed at this move.
  if (L.serverMove) {
    for (const id of p.waiting) {
      if (asked(id, "boss") || p.serverFailed?.includes(`${id}:${plyOf(p.state, id)}`)) continue;
      const key = `p2-${++L.r.counter}`;
      const fen = boardOf(p.state, id)!.board.fen;
      if (!L.serverMove({ key, fen, elo: RECLUSE_PHASE2.elo, nodes: RECLUSE_PHASE2.nodes, moveMs: RECLUSE_PHASE2.moveMs })) break;
      p.asks.push({ key, kind: "boss", board: id, fen, by: "server", to: [], until: now + SERVER_MOVE_WAIT_MS });
    }
  }
  // The host: one of his moves at a time (its one engine for him), and one bot's. (With no device, the last resort
  // makes each at once, so every waiting board gets its move now.)
  for (let n = 0; n <= p.state.boards.length && p.stage === "play" && !p.asks.some((a) => a.kind === "boss" && a.by === "host"); n++) {
    const id = phase2Next(p.state, phase2Queue(p.waiting, p.state).filter((x) => !asked(x, "boss")), "");
    if (id === null) break;
    askHost(L, "boss", id);
  }
  if (p.stage === "play" && !p.asks.some((a) => a.kind === "bot")) {
    const id = Object.keys(p.botMoves)
      .map(Number)
      .sort((a, b) => p.botMoves[a]!.due - p.botMoves[b]!.due)
      .find((x) => !p.botMoves[x]!.move);
    if (id !== undefined) askHost(L, "bot", id);
  }
}

/** Asks the host (or the device after it, past `tried`) for a move; with no device at all, the last resort plays it. */
function askHost(L: Phase2Lobby, kind: Phase2Ask["kind"], board: number, tried: readonly string[] = [], key = `p2-${++L.r.counter}`) {
  const p = p2(L);
  const fen = boardOf(p.state, board)!.board.fen;
  const host = tried.length ? L.pickHost(tried) : L.hostNow();
  if (!host) return lastResort(L, kind, board);
  if (tried.length) L.r.hostId = host;
  const ask: Phase2Ask = { key, kind, board, fen, by: "host", to: [...tried, host], until: L.now() + RECLUSE_PHASE2.hostWaitMs };
  p.asks = [...p.asks.filter((a) => a.key !== key), ask];
  sendAsk(L, ask, host);
}

function sendAsk(L: Phase2Lobby, a: Phase2Ask, to: string) {
  const p = p2(L);
  const bot = a.kind === "bot" ? p.botMoves[a.board] : undefined;
  L.send(
    to,
    bot
      ? { t: "p2Request", key: a.key, board: a.board, fen: a.fen, elo: RECLUSE_PHASE2.botElo, nodes: RECLUSE_PHASE2.botNodes, moveMs: Math.round(bot.searchMs), bot: true, ...(p.win ? { best: true as const } : {}) }
      : { t: "p2Request", key: a.key, board: a.board, fen: a.fen, elo: RECLUSE_PHASE2.elo, nodes: RECLUSE_PHASE2.nodes, moveMs: RECLUSE_PHASE2.moveMs },
    false,
  );
}

/**
 * No device can make this move: the last resort makes it (phase2FallbackMove), his played now, a bot's when its thinking
 * time is up. Logged and counted (fair play may weigh such a fight differently).
 */
function lastResort(L: Phase2Lobby, kind: Phase2Ask["kind"], board: number) {
  const p = p2(L);
  const b = boardOf(p.state, board);
  if (!b) return;
  const move = phase2FallbackMove(b.board.fen, () => L.rng());
  if (!move) return;
  p.fallbacks++;
  console.log(`lobby ${L.r.code}: phase 2, no device answered: the last resort plays ${kind === "boss" ? "his" : "a bot's"} move on board ${board}`);
  const now = L.now();
  if (kind === "boss") return void apply(L, phase2Move(p.state, board, move, now, rules(L)), now);
  const m = p.botMoves[board];
  if (!m) return;
  m.move = move;
  if (now >= m.due) apply(L, phase2Move(p.state, board, move, now, rules(L)), now);
}

/** A device that was asked didn't answer in time: the next device (and the lobby's host with it), or the last resort. */
function giveUp(L: Phase2Lobby, a: Phase2Ask) {
  const p = p2(L);
  p.asks = p.asks.filter((x) => x.key !== a.key);
  if (a.by === "server") {
    // (The engine server: the host plays this move.)
    p.serverFailed = [...(p.serverFailed ?? []).filter((x) => p.state.boards.some((b) => x === `${b.id}:${b.board.history.length}`)), `${a.board}:${plyOf(p.state, a.board)}`];
    return;
  }
  askHost(L, a.kind, a.board, a.to, a.key);
}

/** The next moment phase 2 needs the lobby: a stage's end, a clock's end (plus the late grace), a bot's move due, a wait over. */
function schedule(L: Phase2Lobby) {
  const p = p2(L);
  let at: number | null = null;
  const take = (t: number | null | undefined) => {
    if (typeof t === "number") at = at === null ? t : Math.min(at, t);
  };
  if (p.stage === "fall") take(p.at + PHASE2_FALL_MS);
  else if (p.stage === "change") take(p.at + PHASE2_CHANGE_MS);
  else if (p.stage === "end") take(p.until);
  else {
    const due = phase2Due(p.state);
    take(due === null ? null : due + L.settings.lateGraceMs);
    for (const m of Object.values(p.botMoves)) if (m.move) take(m.due);
    for (const a of p.asks) take(a.until);
  }
  if (at !== null) L.setTimer("phase2", at);
}

/** Everyone sees phase 2 as it now stands. (Not remembered per player: someone (re)joining gets it fresh, phase2Message.) */
function send(L: Phase2Lobby) {
  L.broadcast({ t: "phase2", p2: phase2View(p2(L)) }, false);
}

/** After anything that may have changed phase 2: the moves to ask for, everyone told (if it changed), the next alarm. */
function settle(L: Phase2Lobby, changed: boolean) {
  const p = p2(L);
  const before = p.state;
  pump(L);
  if (changed || p.state !== before) send(L);
  schedule(L);
}

// ---------------- What the lobby routes here ----------------

/** The lobby's "phase2" timer: a stage's end, the clocks, bots' moves due, devices that didn't answer. */
function alarm(L: Phase2Lobby) {
  const p = L.r.p2;
  if (L.r.phase !== "phase2" || !p) return;
  const now = L.now();
  const soon = (t: number) => now >= t - 50;
  if (p.stage === "fall") return soon(p.at + PHASE2_FALL_MS) ? stageChange(L) : schedule(L);
  if (p.stage === "change") return soon(p.at + PHASE2_CHANGE_MS) ? stagePlay(L) : schedule(L);
  if (p.stage === "end") return soon(p.until ?? 0) ? L.finishMatch() : schedule(L);
  // The clocks, a moment late (the late grace: a move made in time is still on its way).
  const before = p.state;
  apply(L, phase2Tick(p.state, now - L.settings.lateGraceMs, () => L.rng(), rules(L)), now);
  for (const [id, m] of Object.entries(p.botMoves)) if (m.move && soon(m.due)) apply(L, phase2Move(p.state, Number(id), m.move, now, rules(L)), now);
  for (const a of [...p.asks]) if (soon(a.until) && p.asks.includes(a)) giveUp(L, a);
  settle(L, p.state !== before);
}

/**
 * A player's move on their board (`ply`: the moves on it before theirs; a move for a position that has gone is dropped).
 * Before his ultimate, a move just past the bank's end (within the late grace) still counts, with nothing left.
 */
function move(L: Phase2Lobby, playerId: string, board: unknown, ply: unknown, mv: unknown) {
  const p = L.r.p2;
  if (L.r.phase !== "phase2" || p?.stage !== "play" || typeof board !== "number" || typeof mv !== "string") return;
  const b = boardOf(p.state, board);
  if (!b || b.player !== playerId || phase2ToMove(b) !== "crowd" || b.board.history.length !== ply) return;
  const now = L.now();
  let at = now;
  if (p.state.ultAt === null && b.turnAt !== null) {
    const end = b.turnAt + b.bankMs;
    if (now >= end && now <= end + L.settings.lateGraceMs) at = end - 1;
  }
  settle(L, apply(L, phase2Move(p.state, board, mv, at, rules(L)), now));
}

/** A device's move for a key it was asked for (his, played now; a bot's, played when its thinking time is up). */
function answer(L: Phase2Lobby, from: string, key: unknown, mv: unknown) {
  const p = L.r.p2;
  if (L.r.phase !== "phase2" || p?.stage !== "play" || typeof mv !== "string") return;
  const a = p.asks.find((x) => x.key === key && x.by === "host" && x.to.includes(from));
  if (a) take(L, a, mv);
}

/** The engine server's move for a key (option (b)); null: it couldn't (the host plays it). */
function serverMoved(L: Phase2Lobby, key: string, mv: string | null) {
  const p = L.r.p2;
  if (L.r.phase !== "phase2" || p?.stage !== "play") return;
  const a = p.asks.find((x) => x.key === key && x.by === "server");
  if (!a) return;
  if (mv === null) {
    giveUp(L, a);
    return settle(L, false);
  }
  take(L, a, mv);
}

function take(L: Phase2Lobby, a: Phase2Ask, mv: string) {
  const p = p2(L);
  const b = boardOf(p.state, a.board);
  // (Not a legal move here: ignored, and the wait runs on to the next device.)
  if (!b || b.board.fen !== a.fen || !legalMoves(a.fen).includes(mv)) return;
  p.asks = p.asks.filter((x) => x.key !== a.key);
  const now = L.now();
  let changed = false;
  if (a.kind === "boss") changed = apply(L, phase2Move(p.state, a.board, mv, now, rules(L)), now);
  else {
    const m = p.botMoves[a.board];
    if (m) {
      m.move = mv;
      if (now >= m.due) changed = apply(L, phase2Move(p.state, a.board, mv, now, rules(L)), now);
    }
  }
  settle(L, changed);
}

/** A player resigns their board: it's lost; the others play on, and they watch. */
function resign(L: Phase2Lobby, playerId: string) {
  const p = L.r.p2;
  if (L.r.phase !== "phase2" || !p) return;
  const id = liveBoardOf(L.r, playerId);
  if (id === null) return;
  const now = L.now();
  settle(L, apply(L, phase2Resign(p.state, id, now), now));
}

/** The admins' test trigger: his ultimate now. */
function ult(L: Phase2Lobby): boolean {
  const p = L.r.p2;
  if (L.r.phase !== "phase2" || p?.stage !== "play" || p.state.ultAt !== null) return false;
  const now = L.now();
  settle(L, apply(L, phase2Ult(p.state, now), now));
  return true;
}

/**
 * A finalist has left the match with their board in play (gone longer than LEAVING.awayMs, or left on purpose): a bot
 * (the lobby's new seat, `bot`) takes the board where it stands, their clock as it stands, and plays it for the team.
 */
function handOver(L: Phase2Lobby, from: string, bot: { id: string; name: string }) {
  const p = L.r.p2;
  if (!p) return;
  const b = p.state.boards.find((x) => x.player === from && !x.result);
  if (!b) return;
  p.state = { ...p.state, boards: p.state.boards.map((x) => (x.id === b.id ? { ...x, player: bot.id } : x)) };
  p.names[bot.id] = bot.name;
  p.bots = [...p.bots, bot.id];
  if (p.stage === "play" && phase2ToMove(b) === "crowd") botTurn(L, b.id, L.now());
  settle(L, true);
}

/**
 * The host changed (or came back): what's asked of a device goes to it now, a fresh wait if it's new to that move.
 * (Asked already, the request goes again: its answer is the same move.)
 */
function hostWork(L: Phase2Lobby, host: string) {
  const p = L.r.p2;
  if (L.r.phase !== "phase2" || p?.stage !== "play") return;
  for (const a of p.asks) {
    if (a.by !== "host") continue;
    if (!a.to.includes(host)) {
      a.to.push(host);
      a.until = L.now() + RECLUSE_PHASE2.hostWaitMs;
    }
    sendAsk(L, a, host);
  }
  schedule(L);
}

export const phase2Lobby = { begin, alarm, move, answer, serverMoved, resign, ult, handOver, hostWork };
