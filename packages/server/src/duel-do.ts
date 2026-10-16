import { DurableObject } from "cloudflare:workers";
import { CHAT_MOD } from "@chessroyale/core";
import type { Color, DuelClientMessage, DuelPlayerView } from "@chessroyale/chess/duel";
import { DuelCore, newDuelRecord, type DuelRecord } from "./duel-room.ts";
import { accountOf } from "./api.ts";
import { d1Sql, ensureSchema, shopState } from "./accounts.ts";
import { eligibleForRanked } from "./fairplay.ts";
import { chatBlock } from "./chat-mod.ts";
import { recordDuel } from "./ranked.ts";
import { countCall } from "./ops.ts";
import { serverError } from "./problems.ts";
import type { Env } from "./index.ts";

/** What a socket carries: its player's side (null: not one of the two). */
interface Attached {
  color: Color | null;
  uid?: string;
}

/**
 * One ranked 1 v 1 game (duel-room.ts is its logic; docs/areas/ranked.md): two seats by account, over hibernating
 * WebSockets, its record stored under "game" after every change and its timing on alarms. A player is known by the
 * account they're signed in with, so a reload or another device of theirs comes straight back to their seat. The
 * finished game is recorded in D1 (ranked.ts: ranks, coins, the kept game), and each player hears what it did for
 * them. It closes RANKED_1V1.resultsKeepMinutes after the end, deleting everything it stored, so its code is free again.
 */
export class DuelGame extends DurableObject<Env> {
  private record: DuelRecord | null = null;
  private recording = false;
  /** Chat moderation: when each side's chat ban was last read (in memory: a wake reads it again). */
  private chatChecked = new Map<Color, number>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.record = (await ctx.storage.get<DuelRecord>("game")) ?? null;
    });
  }

  private socketsOf(c: Color): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() as Attached | null)?.color === c);
  }

  private core(skip?: WebSocket): DuelCore {
    return new DuelCore(this.record!, {
      now: () => Date.now(),
      send: (c, msg) => {
        const text = JSON.stringify({ ...msg, now: Date.now() });
        for (const ws of this.socketsOf(c)) {
          if (ws === skip) continue;
          try {
            ws.send(text);
          } catch {
            // Already closed.
          }
        }
      },
      connected: (c) => this.socketsOf(c).some((ws) => ws !== skip),
    });
  }

  private async persist(core: DuelCore) {
    this.record = core.r;
    await this.ctx.storage.put("game", this.record);
    countCall("duel.persist");
    const at = core.nextAlarm;
    if (at !== null) await this.ctx.storage.setAlarm(at);
    else await this.ctx.storage.deleteAlarm();
    const finished = core.takeFinished();
    if (finished) {
      await this.ctx.storage.put("game", this.record);
      this.ctx.waitUntil(this.recordFinished(finished));
    }
  }

  /** The finished game into D1 (ranks, coins, the kept game); each player then hears what it did for them. */
  private async recordFinished(finished: NonNullable<ReturnType<DuelCore["takeFinished"]>>) {
    if (this.recording) return;
    this.recording = true;
    try {
      let outcomes = null;
      if (this.env.DB) {
        const sql = d1Sql(this.env.DB);
        await ensureSchema(sql, this.env.DB);
        // (A player fair play is holding, in review, keeps their rank as it is.)
        outcomes = await recordDuel(sql, finished, async (uid) => !(await eligibleForRanked(sql, uid).catch(() => true)));
      }
      if (!this.record) return;
      const core = this.core();
      core.recorded(outcomes);
      await this.persist(core);
    } catch (e) {
      serverError(this.env, { kind: "DuelGame.record", route: "DuelGame.record", code: this.record?.code ?? null }, e, (p) => this.ctx.waitUntil(p));
      if (!this.record) return;
      const core = this.core();
      core.recordFailed();
      await this.persist(core);
    } finally {
      this.recording = false;
    }
  }

  private async closeIfDue(): Promise<boolean> {
    const r = this.record;
    if (!r || r.closeAt === null || r.closeAt > Date.now() || this.recording) return false;
    await this.ctx.blockConcurrencyWhile(async () => {
      const text = JSON.stringify({ t: "closed", reason: "ended", now: Date.now() });
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(text);
          ws.close(4000, "Game closed");
        } catch {
          // Already gone.
        }
      }
      this.record = null;
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
    });
    return true;
  }

  /** A new game under this code (false: the code is in use), between these two players (White first). */
  async create(code: string, players: Record<Color, DuelPlayerView>, opts: { testSeconds?: number | null } = {}): Promise<boolean> {
    if (this.record && !(await this.closeIfDue())) return false;
    this.record = newDuelRecord(code, Date.now(), players, opts);
    await this.persist(this.core());
    return true;
  }

  /**
   * A player who pressed Cancel just as they were paired (the queue's cancel answered this game): the game is called
   * off for them (an abort, before any first move: nothing recorded), and the other player hears it at once.
   */
  async abandon(uid: string): Promise<void> {
    if (!this.record || (await this.closeIfDue())) return;
    const c = this.record.players.w.uid === uid ? "w" : this.record.players.b.uid === uid ? "b" : null;
    if (!c) return;
    const core = this.core();
    core.message(c, { t: "resign" });
    await this.persist(core);
  }

  async exists(): Promise<boolean> {
    return !!this.record && !(await this.closeIfDue());
  }

  /** Whether the game is open, and where it is (null: no such game, or it has closed). */
  async status(): Promise<{ phase: string } | null> {
    if (!this.record || (await this.closeIfDue())) return null;
    return { phase: this.core().phase() };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    if (!this.record || (await this.closeIfDue())) return new Response("No such game", { status: 404 });
    const account = await accountOf(request, this.env, (p) => this.ctx.waitUntil(p)).catch(() => null);
    const players = this.record.players;
    const color: Color | null = account?.id === players.w.uid ? "w" : account?.id === players.b.uid ? "b" : null;
    if (!color) return new Response(JSON.stringify({ message: "This game is between two other players." }), { status: 403 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ color, uid: account!.id } satisfies Attached);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (!this.record || (await this.closeIfDue())) return;
    let msg: DuelClientMessage;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object" || typeof msg.t !== "string") return;
    const attached = ws.deserializeAttachment() as Attached | null;
    const color = attached?.color;
    if (!color) return;
    const sql = this.env.DB && attached.uid ? d1Sql(this.env.DB) : null;
    const now = Date.now();
    if (msg.t === "hello") {
      // Their chat packs (shop items) and any chat ban, read as they connect: never per move. Each fails on its own.
      const [owned, block] = sql
        ? await Promise.all([shopState(sql, attached.uid!).then((s) => s.owned).catch(() => null), chatBlock(sql, attached.uid!, now).catch(() => undefined)])
        : [null, undefined];
      if (!this.record) return;
      const core = this.core();
      if (owned) core.chatOwned(color, owned);
      if (block !== undefined) {
        this.chatChecked.set(color, now);
        core.chatStanding(color, block);
      }
      core.connect(color);
      await this.persist(core);
      return;
    }
    // A chatting player's chat ban, read again at most every CHAT_MOD.recheckMs.
    const recheck = msg.t === "chat" && sql && now - (this.chatChecked.get(color) ?? -Infinity) >= CHAT_MOD.recheckMs;
    const block = recheck ? await chatBlock(sql!, attached.uid!, now).catch(() => undefined) : undefined;
    if (!this.record) return;
    const core = this.core();
    if (block !== undefined) {
      this.chatChecked.set(color, now);
      core.chatStanding(color, block);
    }
    core.message(color, msg);
    await this.persist(core);
  }

  async webSocketClose(ws: WebSocket) {
    const color = (ws.deserializeAttachment() as Attached | null)?.color;
    if (!color || !this.record) return;
    if (this.socketsOf(color).some((s) => s !== ws)) return;
    const core = this.core(ws);
    core.disconnect(color);
    await this.persist(core);
  }

  async alarm() {
    if (!this.record || (await this.closeIfDue())) return;
    const core = this.core();
    core.alarm();
    await this.persist(core);
  }
}
