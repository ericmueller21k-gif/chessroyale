import { DurableObject } from "cloudflare:workers";
import type { ClientMessage, LobbyCloseReason, Opening, ServerMessage } from "@chessroyale/chess";
import openings from "@chessroyale/chess/data/openings.json";
import { LobbyCore, lobbyClosing, newLobbyRecord, type LobbyRecord, type ServerScoreRequest } from "./lobby.ts";
import { DEVICE_COOKIE, SIGN_IN_TO_PLAY, accountOf, isSignedIn, readCookie, signInRequired, withSecrets } from "./api.ts";
import { ICONS, d1Sql, ensureSchema, isPixelIcon, recordResult, shopState } from "./accounts.ts";
import { forgetLobby, recordWait, reportLobby, type LiveMode } from "./live.ts";
import type { Env } from "./index.ts";
import { countCall } from "./ops.ts";
import { liveHub } from "./live-hub.ts";
import { SERVER_RECHECK_NODES, serverRecheck, serverScoreAt, warmEngine } from "./engine.ts";
import { CAPACITY, DEFAULT_SETTINGS } from "@chessroyale/core";
import { BANNED_MESSAGE, banCheck, eligibleForRanked, recordFairPlay } from "./fairplay.ts";
import { caseMailer } from "./fairplay-mail.ts";
import { isAdmin } from "./admin.ts";

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
  /**
   * Each person's last phase message (the record's `last`, re-sent on reconnect) as last stored, under its own key
   * "last" and only when one changes: it's half the stored record (with 100 people, 77 of 157 KB), and most messages
   * (a pick, a vote, a chat line) change none of it. One value, so the standings the messages share are stored once.
   */
  private lastStored = new Map<string, unknown>();
  /** Matchmaking: seats promised to players on their way (expiry times), so a surge never overfills the lobby. */
  private reservations: number[] = [];
  /** A live-line report held back by the 2 s limit is on its way. */
  private reportQueued = false;
  /** Many judges: deep searches the lobby asked of the engine server, sent once the lobby is stored. */
  private serverQueue: ServerScoreRequest[] = [];
  /**
   * Fair play: the record's `fair` (each person's picks with their signals) as last stored, by its count. Stored under
   * its own key "fair" and only when a round added to it, so a pick or a chat line never rewrites it.
   */
  private fairStored = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.record = (await ctx.storage.get<LobbyRecord>("lobby")) ?? null;
      for (const [key, icon] of await ctx.storage.list<string>({ prefix: "icon:" })) this.icons.set(key.slice(5), icon);
      // (A record from before "last" had its own key keeps its own; the next store moves it out.)
      const last = await ctx.storage.get<LobbyRecord["last"]>("last");
      if (this.record && last && !Object.keys(this.record.last ?? {}).length) {
        this.record.last = last;
        this.lastStored = new Map(Object.entries(last));
      }
      const fair = await ctx.storage.get<LobbyRecord["fair"]>("fair");
      if (this.record && fair) {
        this.record.fair = fair;
        this.fairStored = this.record.fairV ?? 0;
      }
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
    const mail = caseMailer(await withSecrets(this.env));
    for (const r of core.humanResults()) {
      const userId = rec.accounts?.[r.playerId];
      if (!userId) continue;
      // Fair play: the match's signals and the player's level first (it may put them in review)…
      const moves = core.fairMoves(r.playerId);
      if (moves.length) {
        await recordFairPlay(sql, userId, { lobby: rec.code, mode, moves }, Date.now(), mail).catch((e: unknown) => console.log(`fair play for ${rec.code}: ${String(e)}`));
      }
      // …then a player in review (or banned) has their results held off ranking until they're cleared.
      const held = !(await eligibleForRanked(sql, userId).catch(() => true));
      await recordResult(sql, userId, { ...r, mode, online: true, lobby: rec.code, held }, Date.now()).catch(() => undefined);
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
    await this.store(this.record);
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

  /**
   * Stores the record: everything but `last` and `fair` under "lobby", `last` under "last" when any of it changed,
   * and `fair` under "fair" when a round added to it.
   */
  private async store(rec: LobbyRecord) {
    const { last, fair, ...rest } = rec;
    const entries = Object.entries(last ?? {});
    const changed = entries.length !== this.lastStored.size || entries.some(([id, msg]) => this.lastStored.get(id) !== msg);
    const fairChanged = (rec.fairV ?? 0) !== this.fairStored;
    await this.ctx.storage.put({
      lobby: { ...rest, last: {} },
      ...(changed ? { last: last ?? {} } : {}),
      ...(fairChanged ? { fair: fair ?? {} } : {}),
    });
    if (changed) this.lastStored = new Map(entries);
    if (fairChanged) this.fairStored = rec.fairV ?? 0;
    countCall(changed ? "lobby.persistWithLast" : "lobby.persist");
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
          if (this.env.LIVE) await liveHub(this.env).forget(rec.code);
          else await forgetLobby(sql, rec.code);
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
      this.lastStored.clear();
      this.fairStored = 0;
      this.reservations = [];
      this.reported = null;
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      console.log(`lobby ${rec.code} closed (${reason})`);
    });
  }

  private mode(): LiveMode {
    return this.record?.overrides?.raid ? "boss" : this.record?.overrides?.mode === "crowd" ? "crowd" : "classic";
  }

  /**
   * Tells the live line about this lobby when something it shows changed, or a minute has passed: the live hub (at
   * most every CAPACITY.presence.lobbyReportMs, the latest state following when that's up), or D1 without one.
   */
  private async reportLive(core: LobbyCore) {
    const rec = this.record;
    if (!rec || !this.env.DB) return;
    const s = core.liveSummary();
    const kind = rec.auto ? "queue" : "private";
    // (With the live hub, a matchmade match's every new position too: the home page's live window can show its board.
    // At most every 2 s.)
    const key = `${s.phase}:${s.humans}:${s.alive}${this.env.LIVE && rec.auto && s.board ? `:${s.board.ply}:${s.board.votes.length}` : ""}`;
    const now = Date.now();
    // (The typical wait under PLAY is Default's: a Bots off wait would skew it.)
    const waitDue = rec.auto?.filledAt && !rec.auto.waitSaved && !rec.auto.botsOff;
    if (!waitDue && this.reported?.key === key && (s.phase === "over" || now - this.reported.at < 60_000)) return;
    if (s.phase === "waiting" && kind === "private" && !this.reported) return;
    const gap = CAPACITY.presence.lobbyReportMs;
    if (this.env.LIVE && this.reported && now - this.reported.at < gap && s.phase !== "over" && !waitDue) {
      // Too soon after the last: the state as it is then follows (the object stays up for it).
      if (!this.reportQueued) {
        this.reportQueued = true;
        this.ctx.waitUntil(
          new Promise((r) => setTimeout(r, gap - (now - this.reported!.at))).then(() => {
            this.reportQueued = false;
            if (this.record) return this.reportLive(this.core(this.record.code)).catch(() => undefined);
          }),
        );
      }
      return;
    }
    this.reported = { key, at: now };
    countCall("live.report");
    const sql = d1Sql(this.env.DB);
    await ensureSchema(sql, this.env.DB);
    if (this.env.LIVE) await liveHub(this.env).report({ code: rec.code, mode: this.mode(), kind, ...s });
    else await reportLobby(sql, { code: rec.code, mode: this.mode(), kind, ...s }, now);
    if (waitDue && rec.auto) {
      rec.auto.waitSaved = true;
      await this.store(rec);
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
  async create(code: string, overrides?: LobbyRecord["overrides"], auto?: { fillAt: number | null; botsOff?: boolean; reserve?: number; reserveMs?: number }, keepMs?: number): Promise<boolean | number> {
    if (this.record && !(await this.closeIfDue())) return false;
    this.record = newLobbyRecord(code, Date.now(), overrides);
    this.lastStored.clear();
    this.fairStored = 0;
    this.reservations = [];
    if (keepMs) this.record.keepMs = keepMs;
    const core = this.core(code);
    // Matchmade: it starts by itself at fillAt with bots (or when full; Bots off: see LobbyCore.setAuto).
    if (auto) core.setAuto(auto.fillAt, !!auto.botsOff);
    // (Stored with its alarm: the fill time, or when it closes if nobody ever starts it.)
    await this.persist(core);
    // Matchmaking in batches: seats for the players on their way (how many it could give).
    if (auto?.reserve) return this.reserveSeats(core, auto.reserve, auto.reserveMs ?? CAPACITY.queue.reservationMs);
    return true;
  }

  /** Matchmaking: still taking players. */
  async joinable(): Promise<boolean> {
    if (!this.record || (await this.closeIfDue())) return false;
    return this.core(this.record.code).joinable();
  }

  /**
   * Matchmaking: up to `n` seats for players on their way (each held `ms` for them to connect); how many it gave.
   * None once it no longer takes players.
   */
  async reserve(n: number, ms: number): Promise<number> {
    if (!this.record || (await this.closeIfDue())) return 0;
    return this.reserveSeats(this.core(this.record.code), n, ms);
  }

  private reserveSeats(core: LobbyCore, n: number, ms: number): number {
    const now = Date.now();
    this.reservations = this.reservations.filter((t) => t > now);
    const give = Math.max(0, Math.min(n, core.seatsLeft() - this.reservations.length));
    for (let i = 0; i < give; i++) this.reservations.push(now + ms);
    return give;
  }

  /** Bots off → Default: this seat leaves (see LobbyCore.release); when its person first joined, or null. */
  async release(token: string): Promise<{ joinedAt: number } | null> {
    if (!this.record || (await this.closeIfDue())) return null;
    const core = this.core(this.record.code);
    const out = core.release(token);
    if (out) await this.persist(core);
    return out;
  }

  /** Someone who has already waited joins: bots fill by `at` (see LobbyCore.hurry). */
  async hurry(at: number): Promise<void> {
    if (!this.record || (await this.closeIfDue())) return;
    const core = this.core(this.record.code);
    core.hurry(at);
    await this.persist(core);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    if (!this.record || (await this.closeIfDue())) return new Response("No such lobby", { status: 404 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    // The player id is attached to the socket after "hello"; the account (from the session cookie) now.
    const account = await accountOf(request, this.env, (p) => this.ctx.waitUntil(p)).catch(() => null);
    this.ctx.acceptWebSocket(server);
    // Online play needs a signed-in account (once sign-in is set up); a guest is told so on "hello". So is a player
    // banned for fair play (only someone new to this lobby: a seat already taken stays, the ban counts from the next).
    const guest = !!this.env.DB && signInRequired(await withSecrets(this.env)) && !isSignedIn(account);
    const seated = !!account && Object.values(this.record.accounts ?? {}).includes(account.id);
    const banned =
      !guest && !seated && !!account && !!this.env.DB
        ? (await banCheck(d1Sql(this.env.DB), account, readCookie(request, DEVICE_COOKIE), Date.now()).catch(() => ({ banned: false }))).banned
        : false;
    // (Admins, ADMIN_EMAILS as for the fair-play review: the boss battle's test trigger.)
    const admin = !guest && isAdmin(await withSecrets(this.env), account);
    server.serializeAttachment({ userId: account?.id, guest, banned, ...(admin ? { admin } : {}) });
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
    const attached = ws.deserializeAttachment() as { playerId?: string; userId?: string; guest?: boolean; banned?: boolean; admin?: boolean } | null;
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
      if (attached?.banned) {
        ws.send(JSON.stringify({ t: "error", message: BANNED_MESSAGE, banned: true, now: Date.now() }));
        ws.close(1008, "Banned");
        return;
      }
      const before = this.record.humans.length;
      const result = core.connect(msg.token, msg.name, msg.device, !!msg.practice, msg.rating ?? null, msg.look, attached?.userId, typeof msg.lastBoss === "string" ? msg.lastBoss : null);
      // A new player took a seat: one held for the players on their way is theirs (the oldest).
      if (result.ok && this.record.humans.length > before) this.reservations.shift();
      if (!result.ok) {
        ws.send(JSON.stringify({ t: "error", message: result.message, ...("ended" in result ? { ended: true } : {}), now: Date.now() }));
        ws.close(1008, result.message);
        return;
      }
      ws.serializeAttachment({ playerId: result.playerId, userId: attached?.userId, ...(attached?.admin ? { admin: true } : {}) });
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
    if (msg.t === "ultimate") core.ultimateTrigger(playerId, !!attached?.admin);
    else core.message(playerId, msg);
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
