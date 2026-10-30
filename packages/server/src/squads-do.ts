import { DurableObject } from "cloudflare:workers";
import { SQUADS, pausedLine } from "@chessroyale/core";
import type { LobbyCloseReason, Opening } from "@chessroyale/chess";
import type { PartyClientMessage, SquadsClientMessage } from "@chessroyale/chess/squads";
import openings from "@chessroyale/chess/data/openings.json";
import { SquadsCore, newSquadsRecord, squadsClosing, squadsLiveKey, squadsLiveSummary, type LiveMatch, type SquadsRecord, type SquadsReward, type SquadsServerRequest } from "./squads-lobby.ts";
import { PartyCore, newPartyRecord, partyClosing, type PartyRecord } from "./squads-party.ts";
import { bossPartyOverrides, partyLobby } from "./boss-party.ts";
import { openLobbyCode } from "./codes.ts";
import { DEVICE_COOKIE, SIGN_IN_TO_PLAY, accountOf, isSignedIn, readCookie, signInRequired, withSecrets } from "./api.ts";
import { d1Sql, ensureSchema, grantReward, recordResult } from "./accounts.ts";
import { BANNED_MESSAGE, banCheck } from "./fairplay.ts";
import { isAdmin } from "./admin.ts";
import { serverScoreAt } from "./engine.ts";
import { countCall } from "./ops.ts";
import { LiveReporter } from "./live.ts";
import { liveHub } from "./live-hub.ts";
import { isPaused } from "./kill-switches.ts";
import type { Env } from "./index.ts";

const library = openings as unknown as Opening[];

/** What a socket carries: who it is once they've said hello, and what the request said about them. */
interface Attached {
  playerId?: string;
  userId?: string;
  /** The account's name as it connected: a seat's name (so a name a moderator reset stays reset whatever the device sends). */
  name?: string;
  guest?: boolean;
  banned?: boolean;
  /** May use the test controls (an admin, or SQUADS_TEST on). */
  test?: boolean;
}

/** Who is asking (from the session cookie): their account and its name; refused as a guest where sign-in is set up, or banned; an admin. */
async function whoIsAsking(request: Request, env: Env, waitUntil: (p: Promise<unknown>) => void, seated: (userId: string) => boolean): Promise<Attached> {
  const account = await accountOf(request, env, waitUntil).catch(() => null);
  const secrets = await withSecrets(env);
  const guest = !!env.DB && signInRequired(secrets) && !isSignedIn(account);
  const banned =
    !guest && !!account && !seated(account.id) && !!env.DB
      ? (await banCheck(d1Sql(env.DB), account, readCookie(request, DEVICE_COOKIE), Date.now()).catch(() => ({ banned: false }))).banned
      : false;
  const test = !guest && (env.SQUADS_TEST === "1" || isAdmin(secrets, account));
  return { userId: account?.id, ...(account?.name ? { name: account.name } : {}), guest, banned, ...(test ? { test: true } : {}) };
}

/**
 * One Squads lobby (squads-lobby.ts is its logic): 32 seats, the votes, the bracket and every match, over hibernating
 * WebSockets. The record is stored under "lobby" and each match under "m:<key>" (only the ones that changed), and
 * timing uses alarms. Results and rewards go to D1 as placements are decided. It closes itself as Crowd's lobbies do
 * (squadsClosing): everything it stored is deleted and its code is free again.
 */
export class SquadsLobby extends DurableObject<Env> {
  private record: SquadsRecord | null = null;
  private matches: Record<string, LiveMatch> = {};
  private serverQueue: SquadsServerRequest[] = [];
  /** When this lobby last told the live hub about itself (live.ts). */
  private live = new LiveReporter();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.record = (await ctx.storage.get<SquadsRecord>("lobby")) ?? null;
      if (!this.record) return;
      const stored = await ctx.storage.get<LiveMatch>(this.record.matchKeys.map((k) => `m:${k}`));
      for (const [k, v] of stored) this.matches[k.slice(2)] = v;
    });
  }

  private socketsOf(playerId: string): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() as Attached | null)?.playerId === playerId);
  }

  private core(): SquadsCore {
    return new SquadsCore(
      this.record!,
      this.matches,
      {
        now: () => Date.now(),
        send: (playerId, msg) => {
          const text = JSON.stringify({ ...msg, now: Date.now() });
          for (const ws of this.socketsOf(playerId)) {
            try {
              ws.send(text);
            } catch {
              // Already closed.
            }
          }
        },
        serverEngine: !!this.env.ENGINE && this.env.ENGINE_OFF !== "1",
        serverTop: (req) => void this.serverQueue.push(req),
        close: (playerId) => {
          for (const ws of this.socketsOf(playerId)) {
            try {
              ws.close(4001, "Left");
            } catch {
              // Already closed.
            }
          }
        },
      },
      library,
    );
  }

  private connectedNow(except?: WebSocket): boolean {
    return this.ctx.getWebSockets().some((ws) => ws !== except && !!(ws.deserializeAttachment() as Attached | null)?.playerId);
  }

  private async persist(core: SquadsCore, closing?: WebSocket) {
    const { record, matches } = core.save();
    this.record = record;
    Object.assign(this.matches, matches);
    const rewards = core.takeRewards();
    await this.ctx.storage.put({ lobby: record, ...Object.fromEntries(Object.entries(matches).map(([k, v]) => [`m:${k}`, v])) });
    countCall("squads.persist");
    const close = squadsClosing(record, this.connectedNow(closing));
    const times = [core.nextAlarm, close?.at].filter((t): t is number => typeof t === "number");
    if (times.length) await this.ctx.storage.setAlarm(Math.min(...times));
    else await this.ctx.storage.deleteAlarm();
    if (rewards.length) this.ctx.waitUntil(this.writeRewards(record.code, rewards));
    for (const req of this.serverQueue.splice(0)) this.ctx.waitUntil(this.serve(req));
    // The live hub hears about it in the background (it never holds up the match).
    void this.reportLive().catch(() => undefined);
  }

  /**
   * Tells the live hub about this lobby when its phase or the people connected change (or a minute on), at most every
   * CAPACITY.presence.lobbyReportMs: Squads counts for the overload limit and the health view, not the home page's line.
   */
  private async reportLive(again = false) {
    const rec = this.record;
    if (!rec || !this.env.LIVE) return;
    const s = squadsLiveSummary(rec);
    const due = this.live.next(`${s.phase}:${s.humans}`, s.phase === "over", Date.now(), again);
    if (due === null) return;
    if (due !== "now") {
      this.ctx.waitUntil(new Promise((r) => setTimeout(r, due)).then(() => this.reportLive(true).catch(() => undefined)));
      return;
    }
    countCall("live.report");
    await liveHub(this.env).report(s);
  }

  /** Placements on profiles (unranked) and rewards in wallets. */
  private async writeRewards(code: string, rewards: SquadsReward[]) {
    if (!this.env.DB) return;
    const sql = d1Sql(this.env.DB);
    try {
      await ensureSchema(sql, this.env.DB);
      for (const r of rewards) {
        if (!r.userId) continue;
        if (r.recorded) {
          await recordResult(sql, r.userId, { mode: "squads", online: true, placement: r.placement, players: SQUADS.squadCount, teamWon: r.placement === 1, ranked: false, lobby: code }, Date.now());
        }
        await grantReward(sql, r.userId, r.coins, r.crates);
      }
    } catch (e) {
      console.log(`squads ${code}: rewards not written (${String(e)})`);
    }
  }

  /** The engine server's verdict on bot work two devices disagreed about. */
  private async serve(req: SquadsServerRequest) {
    const t = Date.now();
    const moves = await serverScoreAt(this.env, req.fen, req.moves, req.nodes).catch(() => null);
    console.log(`squads engine verdict: ${req.id} ${moves ? `${moves.length} moves` : "no answer"} in ${Date.now() - t} ms`);
    if (!this.record) return;
    const core = this.core();
    core.serverAnswered(req.id, moves);
    await this.persist(core);
  }

  private async closeIfDue(): Promise<boolean> {
    if (!this.record) return false;
    const close = squadsClosing(this.record, this.connectedNow());
    if (!close || close.at > Date.now()) return false;
    await this.close(close.reason);
    return true;
  }

  private async close(reason: LobbyCloseReason) {
    await this.ctx.blockConcurrencyWhile(async () => {
      const rec = this.record;
      if (!rec) return;
      const text = JSON.stringify({ t: "closed", reason, now: Date.now() });
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(text);
          ws.close(4000, "Match closed");
        } catch {
          // Already gone.
        }
      }
      if (this.env.LIVE) await liveHub(this.env).forget(squadsLiveKey(rec.code)).catch(() => undefined);
      this.record = null;
      this.matches = {};
      this.live = new LiveReporter();
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      console.log(`squads lobby ${rec.code} closed (${reason})`);
    });
  }

  async exists(): Promise<boolean> {
    return !!this.record && !(await this.closeIfDue());
  }

  /** Whether the lobby is open, and where it is (null: no such lobby, or it has closed). */
  async status(): Promise<{ phase: SquadsRecord["phase"] } | null> {
    if (!this.record || (await this.closeIfDue())) return null;
    return { phase: this.record.phase };
  }

  /**
   * A new lobby under this code (false: the code is in use). Matchmade: bots fill at `fillAt`, and `reserve` holds
   * seats for the groups on their way (the answer: which it took). A test lobby: `test`.
   */
  async create(
    code: string,
    opts: { fillAt: number | null; reserve?: { size: number; pass: string }[]; reserveMs?: number; test?: SquadsRecord["test"]; keepMs?: number },
  ): Promise<false | number[]> {
    if (this.record && !(await this.closeIfDue())) return false;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    this.record = newSquadsRecord(code, Date.now(), seed, { auto: !opts.test, fillAt: opts.fillAt, test: opts.test, keepMs: opts.keepMs });
    this.matches = {};
    const core = this.core();
    const took = opts.reserve?.length ? core.reserve(opts.reserve, opts.reserveMs ?? 20_000) : [];
    await this.persist(core);
    return took;
  }

  /** The matchmaker's seats for groups on their way: which it took (none once it no longer takes players). */
  async reserve(groups: { size: number; pass: string }[], ms: number): Promise<number[]> {
    if (!this.record || (await this.closeIfDue())) return [];
    const core = this.core();
    const took = core.reserve(groups, ms);
    if (took.length) await this.persist(core);
    return took;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    if (!this.record || (await this.closeIfDue())) return new Response("No such lobby", { status: 404 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const accounts = new Set(Object.values(this.record.accounts));
    const who = await whoIsAsking(request, this.env, (p) => this.ctx.waitUntil(p), (id) => accounts.has(id));
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(who);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (!this.record || (await this.closeIfDue())) return;
    let msg: SquadsClientMessage;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object" || typeof msg.t !== "string") return;
    const attached = (ws.deserializeAttachment() as Attached | null) ?? {};
    const refuse = (message: string, extra: Record<string, unknown> = {}) => {
      ws.send(JSON.stringify({ t: "error", message, ...extra, now: Date.now() }));
      ws.close(1008, message.slice(0, 100));
    };
    const core = this.core();
    if (msg.t === "hello") {
      if (attached.guest) return refuse(SIGN_IN_TO_PLAY);
      if (attached.banned) return refuse(BANNED_MESSAGE, { banned: true });
      // (Attached first, so what connect() sends reaches this socket.)
      const token = typeof msg.token === "string" ? msg.token : undefined;
      const known = token ? this.record.humans.find((h) => h.token === token) : undefined;
      if (known) ws.serializeAttachment({ ...attached, playerId: known.id });
      const result = core.connect(token, {
        name: attached.name ?? (typeof msg.name === "string" ? msg.name : undefined),
        device: msg.device === "phone" ? "phone" : "computer",
        party: typeof msg.party === "string" ? msg.party : undefined,
        look: msg.look,
        userId: attached.userId,
        test: !!attached.test,
        v: msg.v,
      });
      if (!result.ok) {
        await this.persist(core);
        return refuse(result.message, { ...(result.ended ? { ended: true } : {}), ...(result.left ? { left: result.left } : {}) });
      }
      if (!known) {
        ws.serializeAttachment({ ...attached, playerId: result.playerId });
        // connect() sent the welcome before this socket was attached: once more, now it can be found.
        core.resendTo(result.playerId);
      }
      await this.persist(core);
      return;
    }
    const playerId = attached.playerId;
    if (!playerId) return;
    core.message(playerId, msg);
    await this.persist(core);
  }

  async webSocketClose(ws: WebSocket) {
    const playerId = (ws.deserializeAttachment() as Attached | null)?.playerId;
    if (!playerId || !this.record) return;
    if (this.socketsOf(playerId).some((s) => s !== ws)) return;
    const core = this.core();
    core.disconnect(playerId);
    await this.persist(core, ws);
  }

  async alarm() {
    if (!this.record || (await this.closeIfDue())) return;
    const core = this.core();
    core.alarm();
    await this.persist(core);
  }
}

/**
 * One Squads party (squads-party.ts is its logic): up to 4 friends under a code, over hibernating WebSockets. When the
 * leader queues, it asks the Squads matchmaker for seats (again every SQUADS_LOBBY.partyRetryMs while the servers
 * are busy) and tells everyone the lobby and its pass. It closes after a while with nobody in it.
 */
export class SquadsParty extends DurableObject<Env> {
  private record: (PartyRecord & { queueName: string; fillMs: number }) | null = null;
  private asking = false;
  /** A Boss Battle party's START is making its battle (one at a time: makeBattle). */
  private making = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.record = (await ctx.storage.get<PartyRecord & { queueName: string; fillMs: number }>("party")) ?? null;
    });
  }

  private socketsOf(memberId: string): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() as Attached | null)?.playerId === memberId);
  }

  private core(): PartyCore {
    return new PartyCore(this.record!, {
      now: () => Date.now(),
      send: (memberId, msg) => {
        const text = JSON.stringify({ ...msg, now: Date.now() });
        for (const ws of this.socketsOf(memberId)) {
          try {
            ws.send(text);
          } catch {
            // Already closed.
          }
        }
      },
      close: (memberId) => {
        for (const ws of this.socketsOf(memberId)) {
          try {
            ws.close(4003, "Removed from the party");
          } catch {
            // Already closed.
          }
        }
      },
    });
  }

  private connectedNow(except?: WebSocket): boolean {
    return this.ctx.getWebSockets().some((ws) => ws !== except && !!(ws.deserializeAttachment() as Attached | null)?.playerId);
  }

  private async persist(core: PartyCore, closing?: WebSocket) {
    this.record = { ...this.record!, ...core.record };
    await this.ctx.storage.put("party", this.record);
    const close = partyClosing(this.record, this.connectedNow(closing));
    const times = [core.nextAlarm, close?.at].filter((t): t is number => typeof t === "number");
    if (times.length) await this.ctx.storage.setAlarm(Math.min(...times));
    else await this.ctx.storage.deleteAlarm();
  }

  private async closeIfDue(): Promise<boolean> {
    if (!this.record) return false;
    const close = partyClosing(this.record, this.connectedNow());
    if (!close || close.at > Date.now()) return false;
    await this.ctx.blockConcurrencyWhile(async () => {
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(JSON.stringify({ t: "closed", reason: close.reason, now: Date.now() }));
          ws.close(4000, "Party closed");
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

  /**
   * A new party under this code (false: the code is in use), queueing on `queueName` (lobbies fill after `fillMs`). A
   * Boss Battle party (`kind` "boss", boss-party.ts) has no queue: its START makes the battle.
   */
  async create(code: string, queueName: string, fillMs: number, kind?: "boss"): Promise<boolean> {
    if (this.record && !(await this.closeIfDue())) return false;
    this.record = { ...newPartyRecord(code, Date.now(), kind), queueName, fillMs };
    await this.persist(this.core());
    return true;
  }

  async status(): Promise<{ members: number; state: PartyRecord["state"] } | null> {
    if (!this.record || (await this.closeIfDue())) return null;
    return { members: this.record.members.length, state: this.record.state };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    if (!this.record || (await this.closeIfDue())) return new Response("No such party", { status: 404 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const who = await whoIsAsking(request, this.env, (p) => this.ctx.waitUntil(p), () => false);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(who);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (!this.record || (await this.closeIfDue())) return;
    let msg: PartyClientMessage;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object" || typeof msg.t !== "string") return;
    const attached = (ws.deserializeAttachment() as Attached | null) ?? {};
    const core = this.core();
    if (msg.t === "hello") {
      const refuse = (message: string, extra: Record<string, unknown> = {}) => {
        ws.send(JSON.stringify({ t: "error", message, ...extra, now: Date.now() }));
        ws.close(1008, message.slice(0, 100));
      };
      if (attached.guest) return refuse(SIGN_IN_TO_PLAY);
      if (attached.banned) return refuse(BANNED_MESSAGE, { banned: true });
      const token = typeof msg.token === "string" ? msg.token : undefined;
      const known = token ? this.record.members.find((m) => m.token === token) : undefined;
      if (known) ws.serializeAttachment({ ...attached, playerId: known.id });
      const result = core.connect(token, { name: attached.name ?? (typeof msg.name === "string" ? msg.name : undefined), device: msg.device === "phone" ? "phone" : "computer", v: msg.v, look: msg.look, ...(attached.userId ? { userId: attached.userId } : {}) });
      if (!result.ok) return refuse(result.message);
      if (!known) {
        ws.serializeAttachment({ ...attached, playerId: result.memberId });
        core.resendTo(result.memberId);
      }
      await this.persist(core);
      return;
    }
    const memberId = attached.playerId;
    if (!memberId) return;
    core.message(memberId, msg, { test: !!attached.test });
    if (msg.t === "leave") ws.close(4001, "Left the party");
    await this.persist(core, msg.t === "leave" ? ws : undefined);
    if (this.record.kind === "boss") {
      await this.revokeInBattle();
      return this.makeBattle();
    }
    await this.askMatchmaker();
  }

  /**
   * A Boss Battle party's START: its battle, a private lobby only its members may join (boss-party.ts). One at a time
   * (`making`): a message while the lobby is being made never makes a second, and the placement is tied to its START.
   */
  private async makeBattle() {
    if (this.making || !this.record) return;
    const want = this.core().takeStart();
    if (!want) return;
    this.making = true;
    try {
      const code = this.record.code;
      const lobby = await openLobbyCode(async (c) => (await this.env.LOBBIES.get(this.env.LOBBIES.idFromName(c)).create(c, bossPartyOverrides(want), undefined, undefined, partyLobby(want, code, Date.now()))) !== false).catch(() => null);
      if (!this.record) return;
      const core = this.core();
      core.placedIn(lobby ?? null, want.id);
      await this.persist(core);
    } finally {
      this.making = false;
    }
    // (Kicked while it was being made: revoked in it now.)
    await this.revokeInBattle();
  }

  /** Members kicked after START: their passes into the battle revoked there (and out of it, if in). */
  private async revokeInBattle() {
    if (!this.record || this.making) return;
    const core = this.core();
    const r = core.takeRevokes();
    if (!r) return;
    await this.persist(core);
    if (!r.lobby) return;
    const battle = this.env.LOBBIES.get(this.env.LOBBIES.idFromName(r.lobby));
    for (const m of r.members) await battle.revokePartyMember(m).catch((e: unknown) => console.log(`party ${this.record?.code}: revoke ${m}: ${String(e)}`));
  }

  /** Its battle kicked someone (the AFK kick): out of the party too, never back in (by member id). */
  async kickMember(id: string): Promise<void> {
    if (!this.record || this.record.kind !== "boss") return;
    const core = this.core();
    core.kickMember(id);
    // (Already out of that battle: nothing to revoke there.)
    core.takeRevokes();
    await this.persist(core);
  }

  async webSocketClose(ws: WebSocket) {
    const memberId = (ws.deserializeAttachment() as Attached | null)?.playerId;
    if (!memberId || !this.record) return;
    if (this.socketsOf(memberId).some((s) => s !== ws)) return;
    const core = this.core();
    core.disconnect(memberId);
    await this.persist(core, ws);
  }

  async alarm() {
    if (!this.record || (await this.closeIfDue())) return;
    await this.askMatchmaker();
    await this.persist(this.core());
  }

  /** In line: ask the Squads matchmaker for seats for the party (its answer: a lobby, or busy and when to ask again). */
  private async askMatchmaker() {
    if (this.asking || !this.record) return;
    const asking = this.core();
    const want = asking.takeQueue();
    if (!want) return;
    this.asking = true;
    try {
      await this.persist(asking);
      // Squads resting (a kill switch): the party waits in line with its line, asking again each minute, and goes in
      // once it's back.
      const answer = isPaused(this.env, "squads")
        ? { busy: true as const, ticket: want.ticket ?? "", position: 0, waitSeconds: 60, retryMs: 60_000, message: pausedLine("squads") }
        : await this.env.MATCHMAKER.get(this.env.MATCHMAKER.idFromName(this.record.queueName))
            .next({}, this.record.fillMs, { squads: true }, want.ticket, { size: want.size, pass: want.pass })
            .catch(() => null);
      if (!this.record) return;
      const core = this.core();
      core.answered(want.pass, answer);
      await this.persist(core);
    } finally {
      this.asking = false;
    }
  }
}
