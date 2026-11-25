import { DurableObject } from "cloudflare:workers";
import { SQUADS, SQUADS_LOBBY, modeSettings, pausedLine } from "@chessroyale/core";
import type { LobbyCloseReason, Opening } from "@chessroyale/chess";
import type { PartyClientMessage, PlayerBadge, SquadsClientMessage } from "@chessroyale/chess/squads";
import openings from "@chessroyale/chess/data/openings.json";
import { SQUADS_STARTED, SquadsCore, newSquadsRecord, squadsClosing, squadsLiveKey, squadsLiveSummary, type LiveMatch, type SquadsRecord, type SquadsReward, type SquadsServerRequest } from "./squads-lobby.ts";
import { CROWD_PARTY_LINES, PartyCore, TOWER_PARTY_LINES, needsCrowdInvite, newPartyRecord, partyClosing, type BossStart, type PartyRecord, type TowerPartyPlan } from "./squads-party.ts";
import { crowdInviteOpen } from "./friends.ts";
import { bossPartyOverrides, partyLobby } from "./boss-party.ts";
import { openLobbyCode } from "./codes.ts";
import { DEVICE_COOKIE, SIGN_IN_TO_PLAY, accountOf, isSignedIn, readCookie, signInRequired, withSecrets } from "./api.ts";
import { d1Sql, ensureSchema, grantReward, recordResult, type Sql } from "./accounts.ts";
import { cond, opKeys, type Cond, type Outcome } from "./ledger.ts";
import { grantXp } from "./xp.ts";
import { rankOf } from "./ranked-schema.ts";
import { grantWelcomeCrate } from "./welcome.ts";
import { BANNED_MESSAGE, anyPooled, banCheck } from "./fairplay.ts";
import { isAdmin } from "./admin.ts";
import { serverScoreAt } from "./engine.ts";
import { countCall } from "./ops.ts";
import { LiveReporter } from "./live.ts";
import { liveHub } from "./live-hub.ts";
import { isPaused, pausedBosses, RESIDENTS_PAUSED, residentsPaused } from "./kill-switches.ts";
import { TOWER_LINES, commitPartyFloor, preparePartyFloor, type LobbyGone, type PartyFloorPrep, type PartyRefusal } from "./tower.ts";
import { partyOpenText } from "./town-chat.ts";
import { chatRoomOf, townPartyPoster } from "./town-chat-api.ts";
import { livesLeft, towerPool } from "@chessroyale/core";
import type { Env } from "./index.ts";

const library = openings as unknown as Opening[];

/**
 * A Battle Tower party's plan as the party keeps it (TowerPartyPlan), from a floor ready to begin (tower.ts preparePartyFloor); climbing on
 * together, its lives left (Nov 20: the fewest any copy holds there), so a change of them changes the plan (everyone readies again).
 */
const planOf = (prep: PartyFloorPrep): TowerPartyPlan["plan"] =>
  prep.plan.kind === "continue" ? { kind: "continue", floor: prep.floor, back: prep.plan.back, lives: livesLeft(prep.run) } : prep.plan;

/** What a socket carries: who it is once they've said hello, and what the request said about them. */
interface Attached {
  playerId?: string;
  userId?: string;
  /** The account's name as it connected: a seat's name (so a name a moderator reset stays reset whatever the device sends). */
  name?: string;
  guest?: boolean;
  banned?: boolean;
  /** In fair play's engine pool (null: not known, the read failed; false for no account). */
  pooled?: boolean | null;
  /** May use the test controls (an admin, or SQUADS_TEST on). */
  test?: boolean;
  /** A resident's (residents.ts): refused while PAUSE_RESIDENTS is on. */
  resident?: boolean;
  /** Their badge in the turn order (a lobby's sockets only). */
  badge?: PlayerBadge;
}

/**
 * A signed-in person's badge for the turn order (Eric, Nov 7): their 1 v 1 tier's emblem (rankOf, as on profiles) and
 * their rating ("Rating 1612" on profiles). One read as they connect; none for a guest, or without the database.
 */
async function badgeOf(env: Env, userId: string | undefined): Promise<PlayerBadge | undefined> {
  if (!userId || !env.DB) return undefined;
  const sql = d1Sql(env.DB);
  const row = await sql.first<{ rating: number | null; games: number | null; ladder: number | null }>(
    "SELECT u.rating, r.games, r.ladder FROM users u LEFT JOIN ranked_1v1 r ON r.user_id = u.id WHERE u.id = ?",
    userId,
  );
  if (!row) return undefined;
  const rank = await rankOf(sql, row.games === null ? null : { games: row.games, ladder: row.ladder });
  return { emblem: rank.emblem, rating: typeof row.rating === "number" ? Math.round(row.rating) : null };
}

/** Who is asking (from the session cookie): their account and its name; refused as a guest where sign-in is set up, or banned; an admin. */
async function whoIsAsking(request: Request, env: Env, waitUntil: (p: Promise<unknown>) => void, seated: (userId: string) => boolean): Promise<Attached> {
  const account = await accountOf(request, env, waitUntil).catch(() => null);
  const secrets = await withSecrets(env);
  const guest = !!env.DB && signInRequired(secrets) && !isSignedIn(account);
  const check = !guest && !!account && !seated(account.id) && !!env.DB ? await banCheck(d1Sql(env.DB), account, readCookie(request, DEVICE_COOKIE), Date.now()).catch(() => null) : null;
  const banned = !!check?.banned;
  const pooled = account ? (check ? !!check.pooled : null) : false;
  const test = !guest && (env.SQUADS_TEST === "1" || isAdmin(secrets, account));
  return { userId: account?.id, ...(account?.name ? { name: account.name } : {}), guest, banned, pooled, ...(test ? { test: true } : {}), ...(account?.resident === 1 ? { resident: true } : {}) };
}

/**
 * PAUSE_RESIDENTS (residents.ts): a resident's socket is told "Residents are paused." and closed. Seated (`playerId`: it had said
 * hello), it then disconnects as anyone's does (`gone`), unless another of its sockets is still here. Its attachment loses its seat
 * first, so its close does nothing more.
 */
function refuseResident(ws: WebSocket, attached: Attached, others: (playerId: string) => WebSocket[], gone: (playerId: string) => Promise<void>): Promise<void> {
  try {
    ws.send(JSON.stringify({ t: "error", message: RESIDENTS_PAUSED, now: Date.now() }));
  } catch {
    // Already gone.
  }
  ws.serializeAttachment({ resident: true } satisfies Attached);
  try {
    ws.close(1008, RESIDENTS_PAUSED);
  } catch {
    // Already gone.
  }
  const id = attached.playerId;
  return id && !others(id).some((s) => s !== ws) ? gone(id) : Promise.resolve();
}

/**
 * One Squads lobby (squads-lobby.ts is its logic): 32 seats, the votes, the bracket and every match, over hibernating
 * WebSockets. The record is stored under "lobby" and each match under "m:<key>" (only the ones that changed), and
 * timing uses alarms. Results and rewards go to D1 as placements are decided, at least once: each stays in the stored record until
 * it's written (writeRewards), and a write again pays nothing more (its ledger key, its result's once). It closes itself as Crowd's
 * lobbies do (squadsClosing): everything it stored is deleted and its code is free again.
 */
export class SquadsLobby extends DurableObject<Env> {
  private record: SquadsRecord | null = null;
  private matches: Record<string, LiveMatch> = {};
  private serverQueue: SquadsServerRequest[] = [];
  /** When this lobby last told the live hub about itself (live.ts). */
  private live = new LiveReporter();
  /** The rewards being written now (one write at a time), and whether more came meanwhile. */
  private writing: Promise<boolean> | null = null;
  private writeAgain = false;

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
    // (Nowhere to write them without D1: they go, as nothing would ever take them.)
    if (!this.env.DB) core.takeRewards();
    // The rewards due are stored with the record before they're written, and taken out only once they are.
    await this.ctx.storage.put({ lobby: record, ...Object.fromEntries(Object.entries(matches).map(([k, v]) => [`m:${k}`, v])) });
    countCall("squads.persist");
    const close = squadsClosing(record, this.connectedNow(closing));
    // (Rewards waiting: a wake to try again if this write fails.)
    const retry = record.rewardQueue.length ? Date.now() + SQUADS_LOBBY.rewardRetrySeconds * 1000 : null;
    const times = [core.nextAlarm, close?.at, retry].filter((t): t is number => typeof t === "number");
    if (times.length) await this.ctx.storage.setAlarm(Math.min(...times));
    else await this.ctx.storage.deleteAlarm();
    if (record.rewardQueue.length) this.ctx.waitUntil(this.writeRewards());
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

  /**
   * Placements on profiles (unranked) and rewards in wallets: each reward waiting in the record, in order, taken out (and the record
   * stored) only once it's written; a failed one and those after it wait for the next try (the next alarm or wake). One write at a
   * time. True: none left waiting.
   */
  private writeRewards(): Promise<boolean> {
    if (this.writing) {
      this.writeAgain = true;
      return this.writing;
    }
    this.writing = (async () => {
      let ok = true;
      do {
        this.writeAgain = false;
        ok = await this.writePending();
      } while (ok && this.writeAgain);
      return ok;
    })().finally(() => (this.writing = null));
    return this.writing;
  }

  private async writePending(): Promise<boolean> {
    const rec = this.record;
    if (!rec?.rewardQueue.length || !this.env.DB) return true;
    const sql = d1Sql(this.env.DB);
    let written = 0;
    let ok = true;
    try {
      await ensureSchema(sql, this.env.DB);
      const signedInOnly = signInRequired(await withSecrets(this.env));
      for (const r of [...rec.rewardQueue]) {
        const out = await writeReward(sql, rec.code, rec.createdAt, r, Date.now(), signedInOnly, isPaused(this.env, "rewards"));
        const i = rec.rewardQueue.indexOf(r);
        if (i >= 0) rec.rewardQueue.splice(i, 1);
        written++;
        // (The daily cap took it: kept with the lobby, so a reconnect is told too (m7), and they're told now, in place of the coins.)
        if (out === "refused") {
          (rec.capped ??= {})[r.playerId] = true;
          if (this.record === rec) this.core().rewardCapped(r.playerId);
        }
      }
    } catch (e) {
      ok = false;
      console.log(`squads ${rec.code}: ${rec.rewardQueue.length} rewards not written yet, kept to try again (${String(e)})`);
    }
    // (Not once the lobby has closed, or a new one has its code. A store that fails: written again next time, paying nothing more.)
    if (written && this.record === rec) await this.ctx.storage.put("lobby", rec).catch(() => undefined);
    return ok;
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
    // Rewards not written yet (D1 failing): it stays until they are, trying again, up to SQUADS_LOBBY.rewardRetryHours.
    if (!(await this.writeRewards()) && Date.now() < close.at + SQUADS_LOBBY.rewardRetryHours * 3_600_000) {
      await this.ctx.storage.setAlarm(Date.now() + SQUADS_LOBBY.rewardRetrySeconds * 1000);
      return false;
    }
    await this.close(close.reason);
    return true;
  }

  private async close(reason: LobbyCloseReason) {
    await this.ctx.blockConcurrencyWhile(async () => {
      const rec = this.record;
      if (!rec) return;
      if (rec.rewardQueue.length) console.error(`squads ${rec.code}: closing with ${rec.rewardQueue.length} rewards never written (D1 failed for ${SQUADS_LOBBY.rewardRetryHours} hours)`);
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
    opts: { fillAt: number | null; reserve?: { size: number; pass: string }[]; reserveMs?: number; test?: SquadsRecord["test"]; keepMs?: number; engine?: boolean },
  ): Promise<false | number[]> {
    if (this.record && !(await this.closeIfDue())) return false;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    this.record = newSquadsRecord(code, Date.now(), seed, { auto: !opts.test, fillAt: opts.fillAt, test: opts.test, keepMs: opts.keepMs });
    if (opts.engine) this.record.engine = true;
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
    const badge = who.guest || who.banned ? undefined : await badgeOf(this.env, who.userId).catch(() => undefined);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(badge ? { ...who, badge } : who);
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
    // The residents' kill switch (PAUSE_RESIDENTS; residents.ts): a resident's hello is refused, and any other message of theirs closes
    // their socket (their seat goes on as anyone's who leaves).
    if (attached.resident && residentsPaused(this.env))
      return refuseResident(ws, attached, (id) => this.socketsOf(id), async (id) => {
        const core = this.core();
        core.disconnect(id);
        await this.persist(core, ws);
      });
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
      // A matchmade lobby seats newcomers from its own side of fair play's engine pool only, whoever has the code; a party's members come in
      // by its pass, as their party queued (a failed read lets them in, as a ban's does). The #618 review, m4.
      const member = typeof msg.party === "string" && !!msg.party && Object.values(this.record.parties).some((p) => p.pass === msg.party);
      if (!known && this.record.auto && !member && attached.pooled !== undefined && attached.pooled !== null && attached.pooled !== !!this.record.engine) return refuse(SQUADS_STARTED);
      if (known) ws.serializeAttachment({ ...attached, playerId: known.id });
      const result = core.connect(token, {
        name: attached.name ?? (typeof msg.name === "string" ? msg.name : undefined),
        device: msg.device === "phone" ? "phone" : "computer",
        party: typeof msg.party === "string" ? msg.party : undefined,
        look: msg.look,
        userId: attached.userId,
        test: !!attached.test,
        v: msg.v,
        ...(attached.badge ? { badge: attached.badge } : {}),
      });
      if (!result.ok) {
        // (Not that seat's socket: closing this one mustn't mark its player gone.)
        if (known) ws.serializeAttachment(attached);
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
  private record: (PartyRecord & { queueName: string; fillMs: number; poolName?: string }) | null = null;
  private asking = false;
  /** A Boss Battle party's START is making its battle (one at a time: makeBattle). */
  private making = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.record = (await ctx.storage.get<PartyRecord & { queueName: string; fillMs: number; poolName?: string }>("party")) ?? null;
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
   * A new party under this code (false: the code is in use), queueing on `queueName` (lobbies fill after `fillMs`), or on
   * `poolName` when a member is in fair play's engine pool (read from their accounts as it queues). A Boss Battle party (`kind`
   * "boss", boss-party.ts) has no queue: its START makes the battle. A 50 v 50 party ("crowd", Nov 16) queues into the public
   * 50 v 50 matchmaking; `owner` (its maker's account) is the only one in without an invite.
   */
  async create(code: string, queueName: string, fillMs: number, kind?: "boss" | "crowd" | "tower", poolName?: string, owner?: string, towerWin = false): Promise<boolean> {
    if (this.record && !(await this.closeIfDue())) return false;
    this.record = { ...newPartyRecord(code, Date.now(), kind, owner), queueName, fillMs, ...(poolName ? { poolName } : {}) };
    // (A Battle Tower party's test switch: its floors open where Qxf7 mates the boss, index.ts.)
    if (towerWin && this.record.tower) this.record.tower.win = true;
    await this.persist(this.core());
    return true;
  }

  async status(): Promise<{ members: number; state: PartyRecord["state"]; kind?: "boss" | "crowd" | "tower" } | null> {
    if (!this.record || (await this.closeIfDue())) return null;
    return { members: this.record.members.length, state: this.record.state, ...(this.record.kind ? { kind: this.record.kind } : {}) };
  }

  /**
   * A 50 v 50 party's invites (friends-api.ts): whether member `from` may invite `to` now (asked before the invite is stored), that
   * it went out (their seat shows "…"), and that they declined it. CROWD_PARTY_LINES are the refusals.
   */
  async crowdMayInvite(from: string, to: string): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!this.record || (await this.closeIfDue())) return { ok: false, message: "That party has closed." };
    return this.core().mayInvite(from, to);
  }
  async crowdInvited(from: string, to: string, name: string, expiresAt: number): Promise<void> {
    if (!this.record || (await this.closeIfDue())) return;
    const core = this.core();
    core.invited(from, to, name, expiresAt);
    await this.persist(core);
  }
  async crowdUninvited(to: string): Promise<void> {
    if (!this.record || (await this.closeIfDue())) return;
    const core = this.core();
    core.uninvited(to);
    await this.persist(core);
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
    // The residents' kill switch (PAUSE_RESIDENTS; residents.ts), as the lobby's above.
    if (attached.resident && residentsPaused(this.env))
      return refuseResident(ws, attached, (id) => this.socketsOf(id), async (id) => {
        const core = this.core();
        core.disconnect(id);
        await this.persist(core, ws);
        await this.towerUpkeep();
      });
    if (msg.t === "hello") {
      const refuse = (message: string, extra: Record<string, unknown> = {}) => {
        ws.send(JSON.stringify({ t: "error", message, ...extra, now: Date.now() }));
        ws.close(1008, message.slice(0, 100));
      };
      if (attached.guest) return refuse(SIGN_IN_TO_PLAY);
      if (attached.banned) return refuse(BANNED_MESSAGE, { banned: true });
      const crowd = this.record.kind === "crowd";
      // A 50 v 50 party's newcomer: the invite that lets them in must still stand in the database (a block, the invite declined
      // with no other left, or their Do Not Disturb takes it back: the fix round of #747, L2). A failed read: the party's own list.
      if (crowd && attached.userId && this.env.DB && needsCrowdInvite(this.record, attached.userId)) {
        const open = await crowdInviteOpen(d1Sql(this.env.DB), attached.userId, this.record.code, Date.now(), true).catch(() => true);
        if (!this.record) return;
        if (!open) return refuse(CROWD_PARTY_LINES.invitedOnly);
      }
      const core = this.core();
      const token = typeof msg.token === "string" ? msg.token : undefined;
      // (A 50 v 50 party's seat is the account's, never a token a shared device kept for someone else: L4.)
      const known = token && !crowd ? this.record.members.find((m) => m.token === token) : undefined;
      if (known) ws.serializeAttachment({ ...attached, playerId: known.id });
      const result = core.connect(token, { name: attached.name ?? (typeof msg.name === "string" ? msg.name : undefined), device: msg.device === "phone" ? "phone" : "computer", v: msg.v, look: msg.look, ...(attached.userId ? { userId: attached.userId } : {}) });
      if (!result.ok) return refuse(result.message);
      if (!known) {
        ws.serializeAttachment({ ...attached, playerId: result.memberId });
        core.resendTo(result.memberId);
      }
      await this.persist(core);
      await this.towerUpkeep();
      return;
    }
    const memberId = attached.playerId;
    if (!memberId) return;
    const was = this.record.state;
    const core = this.core();
    // (A Battle Tower party's Open party: its line goes in the town's chat room the app is in, the town's own but where the test switches are on.)
    if (msg.t === "open") msg = { ...msg, room: chatRoomOf(msg.room, this.env.TEST_SWITCHES === "1") };
    core.message(memberId, msg, { test: !!attached.test });
    if (msg.t === "leave") ws.close(4001, "Left the party");
    await this.persist(core, msg.t === "leave" ? ws : undefined);
    // (A 50 v 50 party's Find match drops its invites still out: off the friends' lists too.)
    if (this.record?.kind === "crowd" && was !== "queueing" && this.record.state === "queueing") this.ctx.waitUntil(this.dropInvites());
    if (this.record.kind === "boss" || this.record.kind === "tower") {
      await this.revokeInBattle();
      await this.towerUpkeep();
      return this.makeBattle();
    }
    await this.askMatchmaker();
    await this.cancelTickets();
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
      if (this.record.kind === "tower") return await this.makeTowerFloor(want);
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
    const party = { code: this.record.code, start: r.start };
    for (const m of r.members) await battle.revokePartyMember(m, party).catch((e: unknown) => console.log(`party ${party.code}: revoke ${m}: ${String(e)}`));
  }

  /** Its battle kicked someone (the AFK kick): out of the party too, never back in (by member id). */
  async kickMember(id: string): Promise<void> {
    if (!this.record || (this.record.kind !== "boss" && this.record.kind !== "tower")) return;
    const core = this.core();
    core.kickMember(id);
    await this.persist(core);
  }

  /** Its battle from START `id` is over: that battle's passes go. */
  async battleOver(id: number): Promise<void> {
    if (!this.record || (this.record.kind !== "boss" && this.record.kind !== "tower")) return;
    const core = this.core();
    core.battleOver(id);
    await this.persist(core);
    await this.towerUpkeep();
  }

  /** A Battle Tower party as the clerk's list of open parties shows it, or null: it isn't open to newcomers (PartyCore.towerListing). */
  async towerListing(): Promise<{ leader: string; members: number; max: number } | null> {
    if (!this.record || this.record.kind !== "tower" || (await this.closeIfDue())) return null;
    return this.core().towerListing();
  }

  /** A party floor's match room, asked whether it still holds the floor (tower.ts settleStale). */
  private lobbyGone: LobbyGone = async (f) => (f.lobby ? !(await this.env.LOBBIES.get(this.env.LOBBIES.idFromName(f.lobby)).holdsTowerFloor(f.id)) : null);

  /**
   * A Battle Tower party's upkeep after anything changes (docs/decisions/2026-11-20-tower-party.md): its plan read again from everyone's
   * copies when its people changed (or a floor ended), its Open party line posted in the town's chat, and taken out again once it
   * lapses (full, started, or its leader gone).
   */
  private async towerUpkeep() {
    if (!this.record || this.record.kind !== "tower") return;
    for (let tries = 0; tries < 3 && this.record?.kind === "tower" && this.core().towerPlanStale(); tries++) {
      const people = this.core().towerPeople();
      const plan = people.length < 2 ? { kind: "wait" as const, message: TOWER_PARTY_LINES.needTwo } : await this.readTowerPlan(people);
      if (!this.record) return;
      const core = this.core();
      const recheck = plan.kind === "wait" && "recheck" in plan;
      core.towerRecheck(recheck ? Date.now() + 3000 : null);
      core.setTowerPlan({ key: people.join(","), plan: plan.kind === "wait" ? { kind: "wait", message: plan.message } : plan });
      await this.persist(core);
    }
    const hub = this.env.LIVE ? liveHub(this.env) : null;
    const code = this.record.code;
    const core = this.core();
    const lapsed = core.takeLapsedOpen();
    const post = core.takeOpen();
    if (!lapsed && !post) return;
    await this.persist(core);
    // (Only this party's own line: the town's numbers start again after a restart (the review of #835, finding 4).)
    if (lapsed && hub) await hub.townRemoveParty(lapsed.line, code, lapsed.room).catch(() => undefined);
    if (post) {
      const put = hub ? await this.postOpenLine(post, code).catch(() => null) : null;
      if (!this.record) return;
      const after = this.core();
      if (put && "message" in put) after.openRefused(put.message);
      else after.openPosted(put ? put.n : null);
      // (It lapsed while it went up: out again at once.)
      const gone = after.takeLapsedOpen();
      await this.persist(after);
      if (gone && hub) await hub.townRemoveParty(gone.line, code, gone.room).catch(() => undefined);
    }
  }

  /**
   * The leader's Open party line, into the town's chat (the review of #835, finding 2): the town chat's checks for the leader first (a
   * ban, a moderator's chat ban, the chat paused: townPartyPoster), their account's name on it, and the room's one line an account and
   * its wait between them (TownChat.partyOpen). Its number there, or the words to tell the leader why not.
   */
  private async postOpenLine(post: { uid: string; name: string; free: number; room: string }, code: string): Promise<{ n: number } | { message: string }> {
    const now = Date.now();
    const may = this.env.DB ? await (async () => {
      const sql = d1Sql(this.env.DB!);
      await ensureSchema(sql, this.env.DB);
      return townPartyPoster(sql, post.uid, now, isPaused(this.env, "town-chat", now));
    })() : { ok: true as const, name: post.name };
    if (!may.ok) return { message: may.message };
    const put = (await liveHub(this.env).townPartyOpen(post.uid, partyOpenText(may.name, post.free), code, post.room)) as { n: number } | { retryMs: number };
    return "n" in put ? put : { message: TOWER_PARTY_LINES.openWait(put.retryMs) };
  }

  /** A member's name here, by account (a plan's words). */
  private nameOf(uid: string): string {
    return this.record?.members.find((m) => m.userId === uid)?.name ?? "A member";
  }

  /** The plan for these people, from their copies (tower.ts preparePartyFloor); while one's floor is under way, why it waits (and a recheck soon). */
  private async readTowerPlan(people: string[]): Promise<TowerPartyPlan["plan"] | { kind: "wait"; message: string; recheck: true }> {
    if (!this.env.DB) return { kind: "wait", message: TOWER_LINES.noRun };
    const sql = d1Sql(this.env.DB);
    const read = await (async () => {
      await ensureSchema(sql, this.env.DB);
      return preparePartyFloor(sql, people, Date.now(), { pool: towerPool(pausedBosses(this.env)), lobbyGone: this.lobbyGone });
    })().catch(() => null);
    if (!read) return { kind: "wait", message: TOWER_PARTY_LINES.reading, recheck: true };
    if (read.ok) return planOf(read.prep);
    // (A deleted member's seat holds the plan until they're kicked or leave, and both read it again: no recheck meanwhile (the delta
    // review of #835, finding 9). Everything else that refuses passes on its own: asked again in a moment.)
    return "gone" in read ? { kind: "wait", message: this.refusalLine(read) } : { kind: "wait", message: this.refusalLine(read), recheck: true };
  }

  /** Why a party floor can't begin, in words (preparePartyFloor's refusal). */
  private refusalLine(read: PartyRefusal): string {
    if ("busy" in read) return read.party ? TOWER_LINES.saving(this.nameOf(read.busy)) : TOWER_LINES.busy(this.nameOf(read.busy));
    if ("gone" in read) return TOWER_LINES.gone(this.nameOf(read.gone));
    return "resting" in read ? TOWER_LINES.resting : TOWER_LINES.noRun;
  }

  /**
   * A Battle Tower party's START (docs/decisions/2026-11-20-tower-party.md): the plan read again from everyone's copies (it must be the
   * one they readied for: else it's shown afresh, everyone un-readied), the floor's match room made (towerPartySettings: the party rule,
   * ties to the engine's best; its floor and bosses from the run), then the floor begun on every copy at once (commitPartyFloor: all or
   * nothing), then everyone placed in it. Anything refused on the way: nobody is placed, and they're told why.
   */
  private async makeTowerFloor(want: BossStart) {
    if (!this.record) return;
    const fail = async (message: string, reread = false) => {
      if (!this.record) return;
      const core = this.core();
      if (reread) core.towerReread();
      core.placedIn(null, want.id, message);
      await this.persist(core);
      if (reread) await this.towerUpkeep();
    };
    if (!this.env.DB) return fail(TOWER_LINES.noRun);
    // (Online boss battles resting, a kill switch: no party floor begins; its copies stay as they are.)
    if (isPaused(this.env, "raid")) return fail(pausedLine("raid"));
    const sql = d1Sql(this.env.DB);
    const uids = [...want.members].sort((a, b) => a.seat - b.seat).flatMap((m) => (m.userId ? [m.userId] : []));
    const read = await (async () => {
      await ensureSchema(sql, this.env.DB);
      return preparePartyFloor(sql, uids, Date.now(), { pool: towerPool(pausedBosses(this.env)), lobbyGone: this.lobbyGone });
    })().catch(() => null);
    if (!this.record) return;
    if (!read) return fail("Couldn't reach the tower. Try again.");
    if (!read.ok) return fail(this.refusalLine(read), true);
    const prep: PartyFloorPrep = read.prep;
    const shown = this.record.tower?.plan;
    const now = planOf(prep);
    if (!shown || shown.key !== uids.join(",") || JSON.stringify(shown.plan) !== JSON.stringify(now)) return fail(TOWER_LINES.changed, true);
    const code = this.record.code;
    const fight = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(16).padStart(2, "0")).join("");
    const overrides = JSON.parse(JSON.stringify({ ...prep.settings, ...(this.record.tower?.win ? { bossWinTest: true } : {}) })) as NonNullable<Parameters<ReturnType<Env["LOBBIES"]["get"]>["create"]>[1]>;
    const lobby = await openLobbyCode(async (c) => (await this.env.LOBBIES.get(this.env.LOBBIES.idFromName(c)).create(c, overrides, undefined, undefined, partyLobby(want, code, Date.now(), { fight }))) !== false).catch(() => null);
    if (!this.record) return;
    if (!lobby) return fail("Couldn't start the floor. Try again.");
    const ends = new Set(prep.plan.kind === "new" ? prep.plan.ends.map((e) => e.uid) : []);
    const started = Date.now();
    const ok = await commitPartyFloor(sql, prep, { id: fight, startedAt: started, lobby }, started, ends).catch((e: unknown) => {
      console.log(`party ${code}: the floor's copies not begun (${String(e)})`);
      return false;
    });
    if (!this.record) return;
    if (!ok) return fail(TOWER_LINES.changed, true);
    const core = this.core();
    core.placedIn(lobby, want.id);
    await this.persist(core);
    await this.towerUpkeep();
  }

  async webSocketClose(ws: WebSocket) {
    const memberId = (ws.deserializeAttachment() as Attached | null)?.playerId;
    if (!memberId || !this.record) return;
    if (this.socketsOf(memberId).some((s) => s !== ws)) return;
    const core = this.core();
    core.disconnect(memberId);
    await this.persist(core, ws);
    await this.towerUpkeep();
  }

  async alarm() {
    if (!this.record || (await this.closeIfDue())) return;
    // (A Battle Tower party: a member's last floor was still being written: its plan read again.)
    if (this.record.kind === "tower") {
      const core = this.core();
      if ((this.record.tower?.recheckAt ?? Infinity) <= Date.now()) {
        core.towerRecheck(null);
        core.towerReread();
        await this.persist(core);
      }
      // (Its floor still showing under way: its room asked whether it's over, should the room's own word never have come.)
      const check = core.takeFloorCheck();
      if (check) {
        await this.persist(core);
        const done = await this.env.LOBBIES.get(this.env.LOBBIES.idFromName(check.lobby))
          .partyBattleDone(this.record.code, check.start)
          .catch(() => false);
        if (done && this.record) {
          const after = this.core();
          after.battleOver(check.start);
          await this.persist(after);
        }
      }
      return this.towerUpkeep();
    }
    // (A 50 v 50 party: its away leader's hold on the lead ends; a search with nobody here stops.)
    if (this.record.kind === "crowd") {
      const core = this.core();
      core.tick();
      await this.persist(core);
    }
    await this.askMatchmaker();
    await this.persist(this.core());
    await this.cancelTickets();
  }

  /** A 50 v 50 party's search stopped with a ticket in the matchmaker's line: canceled there, in both queues (L5). */
  private async cancelTickets() {
    if (!this.record) return;
    const core = this.core();
    const tickets = core.takeDropTickets();
    if (!tickets.length) return;
    await this.persist(core);
    const queues = [this.record.queueName, this.record.poolName].filter((q): q is string => !!q);
    for (const t of tickets) for (const q of queues) await this.env.MATCHMAKER.get(this.env.MATCHMAKER.idFromName(q)).cancel(t).catch(() => undefined);
  }

  /** A 50 v 50 party's invites in the database (its Find match dropped them). Best effort: they lapse anyway. */
  private async dropInvites() {
    if (!this.env.DB || !this.record) return;
    await d1Sql(this.env.DB)
      .run("DELETE FROM invites WHERE kind = 'crowdparty' AND code = ?", this.record.code)
      .catch(() => undefined);
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
      // A member in fair play's engine pool: the whole party queues in the pool's own queue (the server's record, never a browser's).
      const ids = this.record.members.flatMap((m) => (m.userId ? [m.userId] : []));
      const pooled = !!this.record.poolName && !!this.env.DB && (await anyPooled(d1Sql(this.env.DB), ids).catch(() => false));
      if (!this.record) return;
      const queue = pooled ? this.record.poolName! : this.record.queueName;
      // Squads resting (a kill switch): the party waits in line with its line, asking again each minute, and goes in
      // once it's back. (A 50 v 50 party: 50 v 50's kill switch, the same way.)
      const part = this.record.kind === "crowd" ? "crowd" : "squads";
      const mm = this.env.MATCHMAKER.get(this.env.MATCHMAKER.idFromName(queue));
      const info = { size: want.size, pass: want.pass };
      // (A 50 v 50 party asks exactly as PLAY does, /api/play's Default: the same lobbies, the party's seats held whole under its pass.)
      const answer = isPaused(this.env, part)
        ? { busy: true as const, ticket: want.ticket ?? "", position: 0, waitSeconds: 60, retryMs: 60_000, message: pausedLine(part) }
        : await (part === "crowd"
            ? mm.next(JSON.parse(JSON.stringify(modeSettings("crowd", { augments: true }))), this.record.fillMs, { botsOff: false, crowdWaitsForFull: true, ...(pooled ? { engine: true } : {}) }, want.ticket, info)
            : mm.next({}, this.record.fillMs, { squads: true, ...(pooled ? { engine: true } : {}) }, want.ticket, info)
          ).catch(() => null);
      if (!this.record) return;
      const core = this.core();
      core.answered(want.pass, answer);
      await this.persist(core);
    } finally {
      this.asking = false;
    }
  }
}

/**
 * One reward, written so that writing it again changes nothing: its results row only if this account has none from this lobby yet
 * (code and creation), the Welcome Crate (once ever), and the coins and crates as a ledger op keyed `squads:<code>:<created>:<ledger
 * id>`. Throws if D1 fails, so the lobby keeps it to try again.
 */
export async function writeReward(sql: Sql, code: string, created: number, r: SquadsReward, now: number, signedInOnly: boolean, paused = false): Promise<Outcome | null> {
  if (!r.userId) return null;
  if (r.recorded) {
    // XP (Nov 9): your moves and time as this lobby counted them; a win is your squad winning the lobby (1st). Once: keyed by this
    // lobby (code and creation). Never in the way of the result.
    const xp = await grantXp(sql, r.userId, {
      key: `squads:${code}:${created}`,
      facts: { ms: r.playMs ?? 0, moves: r.moves ?? 0, won: r.placement === 1, resigned: !!r.resigned, abandoned: !!r.abandoned },
      signedInOnly,
      now,
      paused,
      quest: "squads",
    }).catch((e: unknown) => {
      console.log(`xp for squads ${code}: ${String(e)}`);
      return null;
    });
    const result = { mode: "squads" as const, online: true, placement: r.placement, players: SQUADS.squadCount, teamWon: r.placement === 1, ranked: false, lobby: code, playMs: r.playMs ?? null, moves: r.moves ?? null, xp };
    await recordResult(sql, r.userId, result, now, { since: created });
    // (A finished game: maybe the Welcome Crate, once ever: welcome.ts.)
    await grantWelcomeCrate(sql, r.userId, now).catch(() => false);
  }
  return grantReward(sql, r.userId, r.coins, r.crates, opKeys.squadsReward(code, created), now, squadsDailyCap(now));
}

/**
 * Squads' daily cap (SQUADS_LOBBY.rewardsPerDay, like ranked's): fewer than that many Squads placement rewards in the account's ledger
 * since the UTC day began, checked in the same statement as this one goes in (two lobbies ending at once can't both pass it).
 */
export const squadsDailyCap =
  (now: number) =>
  (account: string): Cond =>
    cond(
      "(SELECT COUNT(*) FROM ledger WHERE account = ? AND reason = 'reward' AND leg = 0 AND op_id LIKE 'squads:%' AND created_at >= ?) < ?",
      account,
      Math.floor(now / 86_400_000) * 86_400_000,
      SQUADS_LOBBY.rewardsPerDay,
    );
