import { DurableObject } from "cloudflare:workers";
import type { ClientMessage, Opening, ServerMessage } from "@chessroyale/chess";
import openings from "@chessroyale/chess/data/openings.json";
import { LobbyCore, newLobbyRecord, type LobbyRecord } from "./lobby.ts";
import { SIGN_IN_TO_PLAY, accountOf, isSignedIn, signInRequired, withSecrets } from "./api.ts";
import { d1Sql, recordResult } from "./accounts.ts";
import type { Env } from "./index.ts";

const library = openings as unknown as Opening[];

/**
 * One Durable Object per lobby. Holds the clock, the groups, the picks and the
 * draw; scoring comes from the host's browser. Uses WebSocket hibernation, so
 * the object can sleep between messages: state lives in storage, and timing
 * uses alarms.
 */
export class Lobby extends DurableObject<Env> {
  private record: LobbyRecord | null = null;

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
      const mode = this.record.overrides?.mode === "crowd" ? "crowd" : "classic";
      for (const r of core.humanResults()) {
        const userId = this.record.accounts?.[r.playerId];
        if (userId) await recordResult(sql, userId, { ...r, mode, online: true }, Date.now()).catch(() => undefined);
      }
    }
    await this.ctx.storage.put("lobby", this.record);
    const at = core.nextAlarm;
    if (at) await this.ctx.storage.setAlarm(at);
    else await this.ctx.storage.deleteAlarm();
  }

  async exists(): Promise<boolean> {
    return this.record !== null;
  }

  async create(code: string, overrides?: LobbyRecord["overrides"]): Promise<void> {
    if (this.record) return;
    this.record = newLobbyRecord(code, Date.now(), overrides);
    await this.ctx.storage.put("lobby", this.record);
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
    const core = this.core(this.record!.code);
    const attached = ws.deserializeAttachment() as { playerId?: string; userId?: string; guest?: boolean } | null;
    if (msg.t === "hello") {
      if (attached?.guest) {
        ws.send(JSON.stringify({ t: "error", message: SIGN_IN_TO_PLAY, now: Date.now() }));
        ws.close(1008, "Sign in to play online");
        return;
      }
      const result = core.connect(msg.token, msg.name, msg.device, !!msg.practice);
      if (!result.ok) {
        ws.send(JSON.stringify({ t: "error", message: result.message, now: Date.now() }));
        ws.close(1008, result.message);
        return;
      }
      ws.serializeAttachment({ playerId: result.playerId, userId: attached?.userId });
      if (attached?.userId) {
        // (core.save() returns the record the core works on, so this sticks.)
        const rec = core.save();
        rec.accounts = { ...(rec.accounts ?? {}), [result.playerId]: attached.userId };
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
    await this.persist(core);
  }

  async alarm() {
    if (!this.record) return;
    const core = this.core(this.record.code);
    core.alarm();
    await this.persist(core);
  }
}
