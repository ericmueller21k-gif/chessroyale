import { SQUADS_PROTOCOL, squadsLegalMoves, type NetSquadsLobby, type NetSquadsMatch, type NetTeamClock, type PartyServerMessage, type SquadsServerMessage } from "@chessroyale/chess/squads";
import type { MoveScore } from "@chessroyale/chess";

/**
 * A headless Squads player for tests and the full-lobby run (scripts/squads-headless.ts): a real WebSocket to a real
 * server (wrangler dev), speaking the Squads protocol as phase 3's screens will. It can play its duties (an engine's
 * top move, or a random legal one), answer bot work as a device would (with Node's Stockfish), or sit idle.
 */

export interface TopEngine {
  topMoves(fen: string, n: number): Promise<MoveScore[]>;
  topMovesAt?(fen: string, n: number, nodes: number): Promise<MoveScore[]>;
}

export interface ClientOptions {
  base: string;
  name: string;
  /** Plays its own duties: after `thinkMs` (a range), the engine's best (or a random legal move without one). */
  play?: boolean;
  thinkMs?: [number, number];
  /** A device: answers bot work with this engine. */
  engine?: TopEngine;
  nps?: number;
  /** Search bot work at this many nodes, whatever the job asks (an experiment); else the job's. */
  nodes?: number;
  /** The session cookie (a guest account from /api/me), so results and rewards are recorded. */
  cookie?: string;
  log?: (line: string) => void;
}

const wsUrl = (base: string, path: string) => base.replace(/^http/, "ws") + path;

/** A guest account's session cookie (GET /api/me makes one), and its profile. */
export async function guestCookie(base: string): Promise<string | undefined> {
  const res = await fetch(`${base}/api/me`);
  const set = res.headers.get("set-cookie") ?? "";
  const m = set.match(/hc_session=[^;]+/);
  return m?.[0];
}

export async function me(base: string, cookie: string): Promise<{ shop?: { coins: number }; recent?: { mode: string; placement: number }[] } | null> {
  const res = await fetch(`${base}/api/me`, { headers: { cookie } });
  return res.ok ? ((await res.json()) as never) : null;
}

function open(url: string, cookie?: string): WebSocket {
  // (Node's WebSocket takes headers as its second argument's `headers`.)
  return new (WebSocket as unknown as new (u: string, o?: unknown) => WebSocket)(url, cookie ? { headers: { cookie } } : undefined);
}

export class SquadsClient {
  ws: WebSocket | null = null;
  playerId: string | null = null;
  token: string | null = null;
  lobby: NetSquadsLobby | null = null;
  matches = new Map<string, NetSquadsMatch>();
  placed: Extract<SquadsServerMessage, { t: "placed" }> | null = null;
  results: Record<number, number> | null = null;
  /** Every squad's team clock, as last sent. */
  clocks: NetTeamClock[] = [];
  errors: string[] = [];
  closed = false;
  test = false;
  /** Counts for the report. */
  stats = { botWork: 0, chosen: 0, refused: 0, messages: 0, bytes: 0 };
  private timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly o: ClientOptions) {}

  private log(line: string) {
    this.o.log?.(`[${this.o.name}] ${line}`);
  }

  send(msg: object) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  /** Joins a lobby (with a party's pass, if any). Resolves on "welcome", rejects on "error". */
  join(code: string, party?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = open(wsUrl(this.o.base, `/api/squads/lobby/${code}/ws`), this.o.cookie);
      this.ws = ws;
      ws.addEventListener("open", () => ws.send(JSON.stringify({ t: "hello", v: SQUADS_PROTOCOL, name: this.o.name, device: "computer", ...(party ? { party } : {}), ...(this.token ? { token: this.token } : {}) })));
      ws.addEventListener("message", (e) => {
        const text = String(e.data);
        this.stats.messages++;
        this.stats.bytes += text.length;
        const msg = JSON.parse(text) as SquadsServerMessage;
        if (msg.t === "welcome") {
          this.playerId = msg.playerId;
          this.token = msg.token;
          this.test = msg.test;
          if (this.o.engine) this.send({ t: "speed", nps: this.o.nps ?? 1_000_000 });
          resolve();
        }
        if (msg.t === "error") {
          this.errors.push(msg.message);
          reject(new Error(msg.message));
        }
        this.onMessage(msg);
      });
      ws.addEventListener("close", () => {
        this.closed = true;
      });
      ws.addEventListener("error", () => reject(new Error("socket error")));
    });
  }

  close() {
    for (const t of this.timers) clearTimeout(t);
    this.ws?.close();
  }

  private later(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  /** Waits until `test` holds (checked every 200 ms), or fails after `ms`. */
  until(test: () => boolean, ms: number, what = "a condition"): Promise<void> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + ms;
      const tick = () => {
        if (test()) return resolve();
        if (Date.now() > deadline) return reject(new Error(`[${this.o.name}] timed out waiting for ${what}`));
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  private onMessage(msg: SquadsServerMessage) {
    switch (msg.t) {
      case "lobby":
        this.lobby = msg.lobby;
        if (msg.lobby.clocks.length) this.clocks = msg.lobby.clocks;
        break;
      case "clocks":
        this.clocks = msg.clocks;
        break;
      case "match":
        this.matches.set(msg.match.key, msg.match);
        break;
      case "half":
        this.matches.set(msg.key, { ...msg.match, boards: msg.match.boards.map((b, i) => ({ ...b, moves: [...(this.matches.get(msg.key)?.boards[i]?.moves ?? []), ...movesOf(msg, i)] })) });
        break;
      case "turn": {
        const m = this.matches.get(msg.key);
        if (m) {
          m.state = "half";
          m.current = msg.current;
          m.banks = msg.banks;
          this.onTurn(m);
        }
        break;
      }
      case "choiceNo":
        this.stats.refused++;
        this.log(`refused ${msg.move}: ${msg.reason}`);
        break;
      case "placed":
        this.placed = msg;
        break;
      case "results":
        this.results = msg.placements;
        break;
      case "botWork":
        for (const job of msg.jobs) void this.answer(job);
        break;
      case "error":
        this.log(`error: ${msg.message}`);
        break;
    }
  }

  private async answer(job: { id: string; fen: string; n: number; nodes?: number }) {
    const engine = this.o.engine;
    if (!engine) return;
    this.stats.botWork++;
    const nodes = this.o.nodes ?? job.nodes;
    const top = await (nodes && engine.topMovesAt ? engine.topMovesAt(job.fen, job.n, nodes) : engine.topMoves(job.fen, job.n)).catch(() => null);
    if (top) this.send({ t: "botTop", id: job.id, top: top.map((m) => ({ move: m.move, expected: m.expected, ...(m.mate !== undefined ? { mate: m.mate } : {}) })) });
  }

  private onTurn(m: NetSquadsMatch) {
    if (!this.o.play || !m.current || !this.playerId) return;
    const me = this.playerId;
    const duty = m.current.duties.find((d) => d.players.includes(me));
    if (!duty) return;
    const seat = this.lobby?.players.find((p) => p.id === me);
    if (seat?.botPlays) return;
    const [lo, hi] = this.o.thinkMs ?? [800, 2500];
    const seq = m.current.seq;
    this.later(lo + Math.random() * (hi - lo), async () => {
      const fen = m.boards[duty.board]!.fen;
      const legal = squadsLegalMoves(fen);
      let options: string[] = [...legal];
      if (this.o.engine) options = (await this.o.engine.topMoves(fen, 4).catch(() => [])).map((x) => x.move);
      if (!options.length) options = [...legal];
      for (const move of options.length > 1 ? [...options.slice(0, 3), ...legal] : options) {
        const before = this.stats.refused;
        this.send({ t: "choose", key: m.key, seq, move });
        this.send({ t: "lock", key: m.key, seq });
        this.stats.chosen++;
        // (A pick the partner already has is refused: the next one.)
        await new Promise((r) => setTimeout(r, 300));
        if (this.stats.refused === before) break;
      }
    });
  }
}

/** The moves a half added to board `i`, from its events (a forced move, a Relay move, a pair's or the final's move). */
function movesOf(msg: Extract<SquadsServerMessage, { t: "half" }>, i: number): string[] {
  return msg.events.flatMap((e) => (e.kind === "relay" || e.kind === "pair" || e.kind === "pickblock" || e.kind === "forced") && e.board === i ? [e.move] : []);
}

/** A party member's socket: its party view, and the lobby and pass once the leader's queueing places it. */
export class PartyClient {
  ws: WebSocket | null = null;
  memberId: string | null = null;
  party: Extract<PartyServerMessage, { t: "party" }>["party"] | null = null;

  constructor(
    private readonly base: string,
    private readonly name: string,
    private readonly cookie?: string,
  ) {}

  join(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = open(wsUrl(this.base, `/api/squads/party/${code}/ws`), this.cookie);
      this.ws = ws;
      ws.addEventListener("open", () => ws.send(JSON.stringify({ t: "hello", v: SQUADS_PROTOCOL, name: this.name, device: "computer" })));
      ws.addEventListener("message", (e) => {
        const msg = JSON.parse(String(e.data)) as PartyServerMessage;
        if (msg.t === "welcome") {
          this.memberId = msg.memberId;
          resolve();
        }
        if (msg.t === "party") this.party = msg.party;
        if (msg.t === "error") reject(new Error(msg.message));
      });
      ws.addEventListener("error", () => reject(new Error("socket error")));
    });
  }

  send(msg: object) {
    this.ws?.send(JSON.stringify(msg));
  }

  close() {
    this.ws?.close();
  }
}
