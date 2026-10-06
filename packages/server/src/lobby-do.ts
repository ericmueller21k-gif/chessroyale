import { DurableObject } from "cloudflare:workers";
import type { ClientMessage, Opening, ServerMessage } from "@chessroyale/chess";
import openings from "@chessroyale/chess/data/openings.json";
import { LobbyCore, newLobbyRecord, type LobbyRecord } from "./lobby.ts";
import { SIGN_IN_TO_PLAY, accountOf, isSignedIn, signInRequired, withSecrets } from "./api.ts";
import { d1Sql, ensureSchema, recordResult } from "./accounts.ts";
import { recordWait, reportLobby, type LiveMode } from "./live.ts";
import type { Env } from "./index.ts";
import { serverRecheck, warmEngine } from "./engine.ts";
import { DEFAULT_SETTINGS } from "@chessroyale/core";

const library = openings as unknown as Opening[];

/**
 * One Durable Object per lobby. Holds the clock, the groups, the picks and the
 * draw; scoring comes from the host's browser. Uses WebSocket hibernation, so
 * the object can sleep between messages: state lives in storage, and timing
 * uses alarms.
 */
export class Lobby extends DurableObject<Env> {
  private record: LobbyRecord | null = null;
  /** The engine server answered its wake-up ping (only then does the host skip its own re-check). */
  private engineUp = false;
  /** What this lobby last told the live line, and when (it reports changes, and at least once a minute). */
  private reported: { key: string; at: number } | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.record = (await ctx.storage.get<LobbyRecord>("lobby")) ?? null;
    });
  }

  private core(code: string): LobbyCore {
    this.record ??= newLobbyRecord(code, Date.now());
    return new LobbyCore(this.record, {
      now: () => Date.now(),
      serverEngine: this.engineUp,
      send: (playerId, msg) => {
        const text = JSON.stringify({ ...msg, now: Date.now() } as ServerMessage);
        for (const ws of this.socketsOf(playerId)) {
          try {
            ws.send(text);
          } catch {
            // Socket already closed.
          }
        }
      },
    }, library);
  }

  /** Re-checks each board's close calls on the engine server (the host's numbers stand where it can't). */
  private async recheckOnServer(boards: Extract<ClientMessage, { t: "scores" }>["boards"]) {
    const jobs = this.record?.scoreRequest?.jobs ?? [];
    return Promise.all(
      boards.map(async (b) => {
        const job = jobs.find((j) => j.boardId === b.boardId);
        // Only where a person picked (a group of bots affects nobody real).
        if (!job || !Object.values(job.humanPicks).some((m) => !!m)) return b;
        const picks = [...Object.values(job.humanPicks), ...Object.values(b.botPicks ?? {})];
        const t = Date.now();
        const out = await serverRecheck(this.env, job.fen, { bestMove: b.bestMove, bestExpected: b.bestExpected, expectedAfter: b.expectedAfter }, picks, DEFAULT_SETTINGS, jobs.length);
        const changed = Object.keys(out.expectedAfter).filter((m) => out.expectedAfter[m] !== b.expectedAfter[m]);
        if (changed.length) console.log(`engine re-check: ${changed.length} moves in ${Date.now() - t} ms`);
        return { ...b, ...out };
      }),
    );
  }

  /** Sockets belonging to a player (identified after "hello" via the socket's attachment). */
  private socketsOf(playerId: string): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() as { playerId?: string } | null)?.playerId === playerId);
  }

  private async persist(core: LobbyCore) {
    this.record = core.save();
    // Match over: results go on signed-in players' profiles (once).
    if (this.record.phase === "results" && !this.record.resultsSaved && this.env.DB) {
      this.record.resultsSaved = true;
      const sql = d1Sql(this.env.DB);
      const mode = this.mode();
      for (const r of core.humanResults()) {
        const userId = this.record.accounts?.[r.playerId];
        if (userId) await recordResult(sql, userId, { ...r, mode, online: true }, Date.now()).catch(() => undefined);
      }
    }
    await this.ctx.storage.put("lobby", this.record);
    const at = core.nextAlarm;
    if (at) await this.ctx.storage.setAlarm(at);
    else await this.ctx.storage.deleteAlarm();
    // The live line hears about it in the background (it never holds up the match).
    void this.reportLive(core).catch(() => undefined);
  }

  private mode(): LiveMode {
    return this.record?.overrides?.raid ? "boss" : this.record?.overrides?.mode === "crowd" ? "crowd" : "classic";
  }

  /** Tells the live line (D1) about this lobby when something it shows changed, or a minute has passed. */
  private async reportLive(core: LobbyCore) {
    const rec = this.record;
    if (!rec || !this.env.DB) return;
    const s = core.liveSummary();
    const kind = rec.auto ? "queue" : "private";
    const key = `${s.phase}:${s.humans}:${s.alive}`;
    const now = Date.now();
    const waitDue = rec.auto?.filledAt && !rec.auto.waitSaved;
    if (!waitDue && this.reported?.key === key && (s.phase === "over" || now - this.reported.at < 60_000)) return;
    if (s.phase === "waiting" && kind === "private" && !this.reported) return;
    this.reported = { key, at: now };
    const sql = d1Sql(this.env.DB);
    await ensureSchema(sql, this.env.DB);
    await reportLobby(sql, { code: rec.code, mode: this.mode(), kind, ...s }, now);
    if (waitDue && rec.auto) {
      rec.auto.waitSaved = true;
      await this.ctx.storage.put("lobby", rec);
      await recordWait(sql, this.mode(), rec.auto.waiters ?? 0, rec.auto.waitMs ?? 0, now);
    }
  }

  async exists(): Promise<boolean> {
    return this.record !== null;
  }

  async create(code: string, overrides?: LobbyRecord["overrides"], auto?: { fillAt: number }): Promise<void> {
    if (this.record) return;
    this.record = newLobbyRecord(code, Date.now(), overrides);
    if (auto) {
      // Matchmade: it starts by itself at fillAt (or when full).
      const core = this.core(code);
      core.setAuto(auto.fillAt);
      await this.persist(core);
      return;
    }
    await this.ctx.storage.put("lobby", this.record);
  }

  /** Matchmaking: still taking players. */
  async joinable(): Promise<boolean> {
    if (!this.record) return false;
    return this.core(this.record.code).joinable();
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    if (!this.record) return new Response("No such lobby", { status: 404 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    // The player id is attached to the socket after "hello"; the account (from the session cookie) now.
    const account = await accountOf(request, this.env).catch(() => null);
    this.ctx.acceptWebSocket(server);
    // Online play needs a signed-in account (once sign-in is set up); a guest is told so on "hello".
    const guest = !!this.env.DB && signInRequired(await withSecrets(this.env)) && !isSignedIn(account);
    server.serializeAttachment({ userId: account?.id, guest });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    const attached = ws.deserializeAttachment() as { playerId?: string; userId?: string; guest?: boolean } | null;
    // The host's scores: the engine server re-checks the close calls first (before the lobby is touched, so
    // nothing changes under it while it waits), and its numbers are the ones used.
    if (msg.t === "scores" && this.engineUp && this.record?.scoreRequest?.key === msg.key && attached?.playerId === this.record.hostId) {
      msg = { ...msg, boards: await this.recheckOnServer(msg.boards) };
    }
    const core = this.core(this.record!.code);
    if (msg.t === "hello") {
      // Someone's joining: wake the engine server so it's up by the first re-check.
      this.ctx.waitUntil(warmEngine(this.env).then((up) => void (this.engineUp = up)));
      if (attached?.guest) {
        ws.send(JSON.stringify({ t: "error", message: SIGN_IN_TO_PLAY, now: Date.now() }));
        ws.close(1008, "Sign in to play online");
        return;
      }
      const result = core.connect(msg.token, msg.name, msg.device, !!msg.practice, msg.rating ?? null, msg.look, attached?.userId);
      if (!result.ok) {
        ws.send(JSON.stringify({ t: "error", message: result.message, now: Date.now() }));
        ws.close(1008, result.message);
        return;
      }
      ws.serializeAttachment({ playerId: result.playerId, userId: attached?.userId });
      // connect() sent the welcome before the socket was attached; send it again now it can be found.
      core.resendTo(result.playerId);
      await this.persist(core);
      return;
    }
    const playerId = attached?.playerId;
    if (!playerId) return;
    core.message(playerId, msg);
    await this.persist(core);
  }

  async webSocketClose(ws: WebSocket) {
    const playerId = (ws.deserializeAttachment() as { playerId?: string } | null)?.playerId;
    if (!playerId || !this.record) return;
    const others = this.socketsOf(playerId).filter((s) => s !== ws);
    if (others.length) return;
    const core = this.core(this.record.code);
    core.disconnect(playerId);
    await this.persist(core);
  }

  async alarm() {
    if (!this.record) return;
    const core = this.core(this.record.code);
    core.alarm();
    await this.persist(core);
  }
}
