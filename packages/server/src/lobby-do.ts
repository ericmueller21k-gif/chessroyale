import { DurableObject } from "cloudflare:workers";
import type { ClientMessage, LobbyCloseReason, Opening, ServerMessage } from "@chessroyale/chess";
import openings from "@chessroyale/chess/data/openings.json";
import { LobbyCore, lobbyClosing, newLobbyRecord, type LobbyRecord, type ServerScoreRequest } from "./lobby.ts";
import { SIGN_IN_TO_PLAY, accountOf, isSignedIn, signInRequired, withSecrets } from "./api.ts";
import { ICONS, d1Sql, ensureSchema, isPixelIcon, recordResult, shopState } from "./accounts.ts";
import { forgetLobby, recordWait, reportLobby, type LiveMode } from "./live.ts";
import type { Env } from "./index.ts";
import { SERVER_RECHECK_NODES, serverRecheck, serverScoreAt, warmEngine } from "./engine.ts";
import { DEFAULT_SETTINGS } from "@chessroyale/core";

const library = openings as unknown as Opening[];

/**
 * One Durable Object per lobby. Holds the clock, the groups, the picks and the
 * draw; scoring comes from the host's browser. Uses WebSocket hibernation, so
 * the object can sleep between messages: state lives in storage, and timing
 * uses alarms.
 *
 * It closes itself (lobbyClosing: its results have been up long enough, it never started, or it was abandoned):
 * results are on profiles and the live line has forgotten it, anyone still connected is told and disconnected, and
 * everything it stored is deleted, which frees its code.
 */
export class Lobby extends DurableObject<Env> {
  private record: LobbyRecord | null = null;
  /** The engine server answered its wake-up ping (only then does the host skip its own re-check). */
  private engineUp = false;
  /** What this lobby last told the live line, and when (it reports changes, and at least once a minute). */
  private reported: { key: string; at: number } | null = null;
  /** Quick chat: each person's pixel icon (stored apart from the lobby record, as "icon:<player id>"). */
  private icons = new Map<string, string>();
  /** Many judges: deep searches the lobby asked of the engine server, sent once the lobby is stored. */
  private serverQueue: ServerScoreRequest[] = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.record = (await ctx.storage.get<LobbyRecord>("lobby")) ?? null;
      for (const [key, icon] of await ctx.storage.list<string>({ prefix: "icon:" })) this.icons.set(key.slice(5), icon);
    });
  }

  /** Quick chat: a person's icon and the shop items they own (their chat packs), from their account. */
  private async chatProfileOf(userId: string): Promise<{ icon: string | null; owned: string[] }> {
    const sql = d1Sql(this.env.DB!);
    const row = await sql.first<{ icon: string }>("SELECT icon FROM users WHERE id = ?", userId);
    const icon = row && (isPixelIcon(row.icon) || (ICONS as readonly string[]).includes(row.icon)) ? row.icon : null;
    return { icon, owned: (await shopState(sql, userId)).owned };
  }

  private core(code: string): LobbyCore {
    this.record ??= newLobbyRecord(code, Date.now());
    return new LobbyCore(this.record, {
      now: () => Date.now(),
      serverEngine: this.engineUp,
      icon: (playerId) => this.icons.get(playerId),
      serverScore: (req) => void this.serverQueue.push(req),
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
        const out = await serverRecheck(this.env, job.fen, { bestMove: b.bestMove, bestExpected: b.bestExpected, expectedAfter: b.expectedAfter }, picks, DEFAULT_SETTINGS, jobs.length, job.priority);
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

  /** Match over: results go on signed-in players' profiles (once), with the lobby's code for "See your result". */
  private async saveResults(core: LobbyCore, rec: LobbyRecord) {
    if (rec.phase !== "results" || rec.resultsSaved || !this.env.DB) return;
    rec.resultsSaved = true;
    const sql = d1Sql(this.env.DB);
    const mode = this.mode();
    for (const r of core.humanResults()) {
      const userId = rec.accounts?.[r.playerId];
      if (userId) await recordResult(sql, userId, { ...r, mode, online: true, lobby: rec.code }, Date.now()).catch(() => undefined);
    }
  }

  /** Anyone connected right now: an open socket that has said hello (leaving out one that's closing). */
  private connectedNow(except?: WebSocket): boolean {
    return this.ctx.getWebSockets().some((ws) => ws !== except && !!(ws.deserializeAttachment() as { playerId?: string } | null)?.playerId);
  }

  /** `closing`: a socket that's closing (it no longer counts as someone connected). */
  private async persist(core: LobbyCore, closing?: WebSocket) {
    this.record = core.save();
    await this.saveResults(core, this.record);
    await this.ctx.storage.put("lobby", this.record);
    // The alarm: the match's next event, or when the lobby closes, whichever comes first.
    const close = lobbyClosing(this.record, this.connectedNow(closing));
    const times = [core.nextAlarm, close?.at].filter((t): t is number => typeof t === "number");
    if (times.length) await this.ctx.storage.setAlarm(Math.min(...times));
    else await this.ctx.storage.deleteAlarm();
    // The live line hears about it in the background (it never holds up the match).
    void this.reportLive(core).catch(() => undefined);
    // Many judges: the engine server's searches run in the background; each answer is a new event for the lobby.
    for (const req of this.serverQueue.splice(0)) this.ctx.waitUntil(this.serve(req));
  }

  /** One deep search for the judges (a verdict, a re-check, a spot check); its answer goes back to the lobby. */
  private async serve(req: ServerScoreRequest) {
    const nodes = Math.max(400_000, Math.round(SERVER_RECHECK_NODES / Math.max(1, req.boards)));
    const t = Date.now();
    const moves = await serverScoreAt(this.env, req.fen, req.moves, nodes).catch(() => null);
    console.log(`engine server for judges: ${req.id.split(":")[0]} ${moves ? `${moves.length} moves` : "no answer"} in ${Date.now() - t} ms`);
    if (!this.record) return;
    const core = this.core(this.record.code);
    core.serverScored(req.id, moves);
    await this.persist(core);
  }

  /** Closes the lobby now if its time has come (its alarm hasn't run yet, or it's from before lobbies closed). */
  private async closeIfDue(): Promise<boolean> {
    if (!this.record) return false;
    const close = lobbyClosing(this.record, this.connectedNow());
    if (!close || close.at > Date.now()) return false;
    await this.close(close.reason);
    return true;
  }

  /**
   * Closes the lobby: results saved and the live line told first, then anyone still connected is told ("closed")
   * and disconnected, then everything stored (the lobby, the icons, the alarm) is deleted. Nothing else runs here
   * meanwhile, so a new lobby can't take the code halfway through.
   */
  private async close(reason: LobbyCloseReason) {
    await this.ctx.blockConcurrencyWhile(async () => {
      const rec = this.record;
      if (!rec) return;
      if (this.env.DB) {
        const sql = d1Sql(this.env.DB);
        try {
          await ensureSchema(sql, this.env.DB);
          await this.saveResults(this.core(rec.code), rec);
          await forgetLobby(sql, rec.code);
        } catch (e) {
          console.log(`lobby ${rec.code}: closing without D1 (${String(e)})`);
        }
      }
      const text = JSON.stringify({ t: "closed", reason, now: Date.now() } as ServerMessage);
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(text);
          ws.close(4000, "Match closed");
        } catch {
          // Already gone.
        }
      }
      this.record = null;
      this.icons.clear();
      this.reported = null;
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      console.log(`lobby ${rec.code} closed (${reason})`);
    });
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
    if (!this.record || (await this.closeIfDue())) return false;
    return true;
  }

  /** Whether the lobby is open, and where its match is (null: no such lobby, or it has closed). */
  async status(): Promise<{ phase: "waiting" | "playing" | "over" } | null> {
    if (!this.record || (await this.closeIfDue())) return null;
    const r = this.record;
    return { phase: r.phase === "results" ? "over" : r.phase === "lobby" && !r.auto?.filledAt ? "waiting" : "playing" };
  }

  /**
   * A new lobby under this code: false if the code is in use (a lobby that hasn't closed), so the caller tries
   * another. `keepMs`: how long its results stay up (playtests).
   */
  async create(code: string, overrides?: LobbyRecord["overrides"], auto?: { fillAt: number }, keepMs?: number): Promise<boolean> {
    if (this.record && !(await this.closeIfDue())) return false;
    this.record = newLobbyRecord(code, Date.now(), overrides);
    if (keepMs) this.record.keepMs = keepMs;
    const core = this.core(code);
    // Matchmade: it starts by itself at fillAt (or when full).
    if (auto) core.setAuto(auto.fillAt);
    // (Stored with its alarm: the fill time, or when it closes if nobody ever starts it.)
    await this.persist(core);
    return true;
  }

  /** Matchmaking: still taking players. */
  async joinable(): Promise<boolean> {
    if (!this.record || (await this.closeIfDue())) return false;
    return this.core(this.record.code).joinable();
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    if (!this.record || (await this.closeIfDue())) return new Response("No such lobby", { status: 404 });
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
    if (!this.record || (await this.closeIfDue())) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    const attached = ws.deserializeAttachment() as { playerId?: string; userId?: string; guest?: boolean } | null;
    // The host's scores: the engine server re-checks the close calls first (before the lobby is touched, so
    // nothing changes under it while it waits), and its numbers are the ones used.
    if (msg.t === "scores" && this.engineUp && this.record?.scoreRequest?.key === msg.key && attached?.playerId === this.record.hostId && !this.record.judges?.tasks) {
      msg = { ...msg, boards: await this.recheckOnServer(msg.boards) };
    }
    // Quick chat: who's joining (their icon and chat packs), read before the lobby is touched, as above.
    const chatProfile = msg.t === "hello" && this.env.DB && attached?.userId && !attached.guest ? await this.chatProfileOf(attached.userId).catch(() => null) : null;
    // (Closed while that was being read.)
    if (!this.record) return;
    const core = this.core(this.record.code);
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
        ws.send(JSON.stringify({ t: "error", message: result.message, ...("ended" in result ? { ended: true } : {}), now: Date.now() }));
        ws.close(1008, result.message);
        return;
      }
      ws.serializeAttachment({ playerId: result.playerId, userId: attached?.userId });
      if (chatProfile) {
        core.chatOwned(result.playerId, chatProfile.owned);
        if (chatProfile.icon && this.icons.get(result.playerId) !== chatProfile.icon) {
          this.icons.set(result.playerId, chatProfile.icon);
          await this.ctx.storage.put(`icon:${result.playerId}`, chatProfile.icon);
        }
      }
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
    await this.persist(core, ws);
  }

  async alarm() {
    if (!this.record || (await this.closeIfDue())) return;
    const core = this.core(this.record.code);
    core.alarm();
    await this.persist(core);
  }
}
