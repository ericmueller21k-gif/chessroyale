import { DurableObject } from "cloudflare:workers";
import { CHAT_MOD, TOWN_TABLES, coinsPaid } from "@chessroyale/core";
import { DUEL_PROTOCOL, DUEL_UPDATE, type Color, type DuelClientMessage, type DuelOutcome, type DuelPlayerView } from "@chessroyale/chess/duel";
import { DuelCore, RECORD_RETRY_MS, newDuelRecord, type DuelRecord } from "./duel-room.ts";
import { accountOf, ageAnswer, isSignedIn, signInRequired, withSecrets } from "./api.ts";
import { d1Sql, ensureSchema, shopState } from "./accounts.ts";
import { eligibleForRanked } from "./fairplay.ts";
import { chatBlock } from "./chat-mod.ts";
import { recordDuel, type FinishedDuel } from "./ranked.ts";
import { grantXp } from "./xp.ts";
import { isPaused, RESIDENTS_PAUSED, residentsPaused } from "./kill-switches.ts";
import { grantWelcomeCrate } from "./welcome.ts";
import { countCall } from "./ops.ts";
import { serverError } from "./problems.ts";
import { liveHub } from "./live-hub.ts";
import type { Env } from "./index.ts";

/** What a socket carries: its player's side (null: not one of the two). */
interface Attached {
  color: Color | null;
  uid?: string;
  /** Typed chat (typed-chat.ts): a signed-in account (may type once its chat is on), or a device the age gate marked too young. */
  typer?: boolean;
  young?: boolean;
  /** A resident's (residents.ts): refused while PAUSE_RESIDENTS is on. */
  resident?: boolean;
  /** Watching (`?watch=1`, the town's spectator view, Nov 27): hears the game as both players do, says nothing to it. */
  watch?: true;
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
  /** A recording of the finished game is running (in memory only: a wake after an eviction or a deploy tries again). */
  private recording = false;
  /** Chat moderation: when each side's chat ban was last read (in memory: a wake reads it again). */
  private chatChecked = new Map<Color, number>();
  /** Telling the town its table is free is under way (`tellTown`; in memory: a wake tries again). */
  private townTelling = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.record = (await ctx.storage.get<DuelRecord>("game")) ?? null;
    });
  }

  private socketsOf(c: Color): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() as Attached | null)?.color === c);
  }

  /** Everyone watching (the town's spectator view). */
  private watchers(): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() as Attached | null)?.watch === true);
  }

  private core(skip?: WebSocket): DuelCore {
    const out = (to: WebSocket[], msg: object) => {
      if (!to.length) return;
      const text = JSON.stringify({ ...msg, now: Date.now() });
      for (const ws of to) {
        if (ws === skip) continue;
        try {
          ws.send(text);
        } catch {
          // Already closed.
        }
      }
    };
    return new DuelCore(this.record!, {
      now: () => Date.now(),
      send: (c, msg) => out(this.socketsOf(c), msg),
      watch: (msg) => out(this.watchers(), msg),
      connected: (c) => this.socketsOf(c).some((ws) => ws !== skip),
    });
  }

  /**
   * Stores the record and sets the alarm for whatever's next; a finished game whose recording is due (and none of
   * ours running) starts recording. While one runs, nothing is due sooner than RECORD_RETRY_MS from now (a recording
   * still running at its retry time or at closing never spins the alarm).
   */
  private async persist(core: DuelCore) {
    const finished = this.recording ? null : core.takeFinished();
    if (finished) this.recording = true;
    this.record = core.r;
    await this.ctx.storage.put("game", this.record);
    countCall("duel.persist");
    const at = core.nextAlarm;
    if (at !== null) await this.ctx.storage.setAlarm(this.recording ? Math.max(at, Date.now() + RECORD_RETRY_MS) : at);
    else await this.ctx.storage.deleteAlarm();
    if (finished) this.ctx.waitUntil(this.recordFinished(finished));
    this.tellTown(core);
  }

  /**
   * A game found from a town's park table (the queue's `town`), now over: the town hears it (live-hub.ts townMatchOver), so its table
   * is free and the two aren't shown seated there any more (Nov 27). Once; a call that fails is tried again at the next change, and as
   * the room closes (the hub lets a match go after TOWN_TABLES.matchMaxMinutes whatever happens).
   */
  private tellTown(core: DuelCore) {
    const r = this.record;
    if (!r?.town || r.townTold || this.townTelling || !core.end || !this.env.LIVE) return;
    this.townTelling = true;
    this.ctx.waitUntil(
      liveHub(this.env as Required<Pick<Env, "LIVE">>)
        .townMatchOver(r.code)
        .then(async () => {
          if (this.record !== r) return;
          r.townTold = true;
          await this.ctx.storage.put("game", r);
        })
        .catch(() => undefined)
        .finally(() => (this.townTelling = false)),
    );
  }

  /** Runs `fn` on the room and stores it only if it changed something (a sync, or a refused move, changes nothing). */
  private async change(core: DuelCore, fn: () => void) {
    const before = JSON.stringify(core.r);
    fn();
    if (JSON.stringify(core.r) !== before || (!this.recording && core.takeFinishedDue())) await this.persist(core);
  }

  /**
   * The finished game into D1 (ranks, coins, the kept game); each player then hears what it did for them. A game on a
   * test's clock where test switches are off (an admin's on the live game) is unranked: nothing recorded, no coins.
   * A try that fails is tried again on the alarm (takeFinished), for hours (RANKED_1V1.recordRetryHours).
   */
  private async recordFinished(finished: NonNullable<ReturnType<DuelCore["takeFinished"]>>) {
    try {
      let outcomes: Record<Color, DuelOutcome> | null = null;
      if (finished.testSeconds && this.env.TEST_SWITCHES !== "1") {
        const unranked: DuelOutcome = { change: null, coins: 0, unranked: true };
        outcomes = { w: unranked, b: unranked };
      } else if (this.env.DB) {
        const sql = d1Sql(this.env.DB);
        await ensureSchema(sql, this.env.DB);
        // (A recording that got this far before: its answer, kept, never asked of recordDuel again (its replay answers no rank-point change).)
        const kept = this.record?.ranks ?? null;
        // (A player fair play is holding, in review, keeps their rank as it is, and earns nothing.)
        // (Ranked's leave rules, a dodge or a leave charged once: off while PAUSE_LEAVE_PENALTIES is on.)
        outcomes =
          kept ??
          (await recordDuel(sql, finished, async (uid) => !(await eligibleForRanked(sql, uid).catch(() => true)), finished.endedAt, {
            penalties: !isPaused(this.env, "leave-penalties"),
          }));
        const played = finished.result !== "aborted";
        // (Ops' counts, /admin/ops: dodges and leaves charged.)
        if (outcomes && !kept) for (const o of [outcomes.w, outcomes.b]) if (o.conduct) countCall(`ranked.${o.conduct.kind}`);
        // XP (Nov 9; server/xp.ts): each side's moves and the game's length as this room kept them; once, keyed by the game. Its coins
        // with it (Nov 25): a grant that still fails after withXp's tries throws, and recordDuel's answer is kept on the room's record
        // (`ranks`), so the next try (the alarm: RECORD_RETRY_MS, then every recordRetrySeconds, for recordRetryHours) goes on from it:
        // ranks are never recorded twice, and each grant is keyed by the game, so a side already granted pays nothing more and answers
        // as before. The players hear their outcome once it's all in, as when recordDuel itself fails (the review's M1).
        if (outcomes && played) {
          const ranks = outcomes;
          try {
            outcomes = await withXp(sql, finished, ranks, signInRequired(await withSecrets(this.env)), isPaused(this.env, "rewards"));
          } catch (e) {
            if (this.record && !this.record.ranks) {
              this.record.ranks = ranks;
              await this.ctx.storage.put("game", this.record);
            }
            throw e;
          }
        }
        // (A finished ranked game: maybe the Welcome Crate for either player, once ever: welcome.ts.)
        if (outcomes && played) for (const uid of [finished.players.w, finished.players.b]) await grantWelcomeCrate(sql, uid, Date.now()).catch(() => false);
      }
      if (!this.record) return;
      const core = this.core();
      core.recorded(outcomes);
      await this.persist(core);
    } catch (e) {
      serverError(this.env, { kind: "DuelGame.record", route: "DuelGame.record", code: this.record?.code ?? null }, e, (p) => this.ctx.waitUntil(p));
    } finally {
      this.recording = false;
    }
  }

  private async closeIfDue(): Promise<boolean> {
    const r = this.record;
    if (!r || r.closeAt === null || r.closeAt > Date.now() || this.recording) return false;
    // A finished game not recorded yet (D1 failing): the room stays, trying again, up to RANKED_1V1.recordRetryHours (Nov 10).
    const core = this.core();
    if (core.toRecord()) return false;
    // (The town not told yet that the game is over (`tellTown` failing): a last try.)
    if (r.town && !r.townTold && this.env.LIVE) await liveHub(this.env as Required<Pick<Env, "LIVE">>).townMatchOver(r.code).catch(() => undefined);
    if (core.recordGivenUp()) {
      countCall("ranked.recordLost");
      serverError(this.env, { kind: "DuelGame.recordLost", route: "DuelGame.close", code: r.code }, new Error(`closing with the game never recorded (${r.recordTries} tries)`), (p) => this.ctx.waitUntil(p));
    }
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

  /**
   * A new game under this code (false: the code is in use), between these two players (White first). Both must be
   * there: a seat without a player is refused (an error, never a game nobody can open).
   */
  async create(code: string, players: Record<Color, DuelPlayerView>, opts: { testSeconds?: number | null; town?: boolean } = {}): Promise<boolean> {
    if (!validPlayer(players?.w) || !validPlayer(players?.b) || players.w.uid === players.b.uid) throw new Error("DuelGame.create: a seat without its player");
    if (this.record && !(await this.closeIfDue())) return false;
    this.record = newDuelRecord(code, Date.now(), players, opts);
    await this.persist(this.core());
    return true;
  }

  /**
   * A player who pressed the queue's Cancel after they were paired (the queue's cancel answered this game): their own Abort or
   * Resign (ranked's leave rules decide what it costs: DuelCore.cancelled), except for one who never connected to it, pressed
   * the moment it was found: called off, nobody's dodge. The other player hears it at once.
   */
  async abandon(uid: string): Promise<void> {
    if (!this.record || (await this.closeIfDue())) return;
    const c = this.record.players.w.uid === uid ? "w" : this.record.players.b.uid === uid ? "b" : null;
    if (!c) return;
    const core = this.core();
    await this.change(core, () => core.cancelled(c));
  }

  /** The queue handed this player the game's code (ranked's leave rules, L1: from then a no-show is their dodge). */
  async delivered(uid: string): Promise<void> {
    if (!this.record || (await this.closeIfDue())) return;
    const c = this.record.players.w.uid === uid ? "w" : this.record.players.b.uid === uid ? "b" : null;
    if (!c || this.record.delivered?.[c]) return;
    const core = this.core();
    await this.change(core, () => core.delivered(c));
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
    // Watching (the town's spectator view, Nov 27): anyone with the code, at most TOWN_TABLES.watchersMax at once; it hears the game as
    // both players do and nothing it sends reaches the game (webSocketMessage answers only its hello).
    if (new URL(request.url).searchParams.get("watch") === "1") {
      if (this.watchers().length >= TOWN_TABLES.watchersMax) return new Response(JSON.stringify({ message: "Too many are watching this game." }), { status: 429 });
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ color: null, watch: true } satisfies Attached);
      countCall("duel.watch");
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    const account = await accountOf(request, this.env, (p) => this.ctx.waitUntil(p)).catch(() => null);
    const players = this.record.players;
    const color: Color | null = account?.id === players.w.uid ? "w" : account?.id === players.b.uid ? "b" : null;
    if (!color) return new Response(JSON.stringify({ message: "This game is between two other players." }), { status: 403 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    const young = ageAnswer(request) === "under";
    server.serializeAttachment({
      color,
      uid: account!.id,
      ...(isSignedIn(account) && !young ? { typer: true } : {}),
      ...(young ? { young } : {}),
      ...(account!.resident === 1 ? { resident: true } : {}),
    } satisfies Attached);
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
    // (A watcher's hello: the game as it is now. Anything else it sends is nothing to the game.)
    if (!color && attached?.watch && msg.t === "hello") {
      const now = Date.now();
      try {
        ws.send(JSON.stringify(msg.v !== DUEL_PROTOCOL ? { t: "error", message: DUEL_UPDATE, reload: true, now } : { ...this.core().welcomeWatcher(), now }));
      } catch {
        // Already gone.
      }
      return;
    }
    if (!color) return;
    // The residents' kill switch (PAUSE_RESIDENTS; residents.ts): a resident's hello is refused, and any other message of theirs closes
    // their socket, a disconnect as anyone's (their clock runs on, or the abort rule applies).
    if (attached.resident && residentsPaused(this.env)) return this.refuseResident(ws, color, msg.t !== "hello");
    const sql = this.env.DB && attached.uid ? d1Sql(this.env.DB) : null;
    const now = Date.now();
    if (msg.t === "hello") {
      // An app on another protocol: it reloads to get this one (DUEL_PROTOCOL).
      if (msg.v !== DUEL_PROTOCOL) {
        try {
          ws.send(JSON.stringify({ t: "error", message: DUEL_UPDATE, reload: true, now }));
        } catch {
          // Already gone.
        }
        return;
      }
      // Their chat packs (shop items) and any chat ban, read as they connect: never per move. Each fails on its own.
      const [owned, block, chatOn] = sql
        ? await Promise.all([
            shopState(sql, attached.uid!).then((s) => s.owned).catch(() => null),
            chatBlock(sql, attached.uid!, now).catch(() => undefined),
            attached.typer ? sql.first<{ chat_on: number | null }>("SELECT chat_on FROM users WHERE id = ?", attached.uid!).then((r) => r?.chat_on === 1).catch(() => false) : false,
          ])
        : [null, undefined, false];
      if (!this.record) return;
      const core = this.core();
      core.chatTyping(color, { may: !!attached.typer && chatOn, young: !!attached.young });
      if (owned) core.chatOwned(color, owned);
      if (block !== undefined) {
        this.chatChecked.set(color, now);
        core.chatStanding(color, block);
      }
      core.connect(color);
      await this.persist(core);
      return;
    }
    // Chat turned on during the game (its opt-in): may they type now? The account's switch, read again.
    const typing = msg.t === "chatPrefs" && msg.typed === true && attached.typer && sql ? (await sql.first<{ chat_on: number | null }>("SELECT chat_on FROM users WHERE id = ?", attached.uid!).catch(() => null))?.chat_on === 1 : null;
    // A chatting player's chat ban, read again at most every CHAT_MOD.recheckMs.
    const recheck = msg.t === "chat" && sql && now - (this.chatChecked.get(color) ?? -Infinity) >= CHAT_MOD.recheckMs;
    const block = recheck ? await chatBlock(sql!, attached.uid!, now).catch(() => undefined) : undefined;
    if (!this.record) return;
    const core = this.core();
    await this.change(core, () => {
      if (typing !== null) core.chatTyping(color, { may: typing, young: false });
      if (block !== undefined) {
        this.chatChecked.set(color, now);
        core.chatStanding(color, block);
      }
      core.message(color, msg);
    });
  }

  /**
   * PAUSE_RESIDENTS (residents.ts): a resident's socket is told "Residents are paused." and closed; one that had said hello
   * (`connected`) disconnects as anyone's does, unless another of its sockets is still here. Its attachment loses its side first, so
   * its close does nothing more.
   */
  private async refuseResident(ws: WebSocket, color: Color, connected: boolean) {
    try {
      ws.send(JSON.stringify({ t: "error", message: RESIDENTS_PAUSED, now: Date.now() }));
    } catch {
      // Already gone.
    }
    ws.serializeAttachment({ color: null, resident: true } satisfies Attached);
    try {
      ws.close(1008, RESIDENTS_PAUSED);
    } catch {
      // Already gone.
    }
    if (!connected || !this.record || this.socketsOf(color).some((s) => s !== ws)) return;
    const core = this.core(ws);
    await this.change(core, () => core.disconnect(color));
  }

  async webSocketClose(ws: WebSocket) {
    const color = (ws.deserializeAttachment() as Attached | null)?.color;
    if (!color || !this.record) return;
    if (this.socketsOf(color).some((s) => s !== ws)) return;
    const core = this.core(ws);
    await this.change(core, () => core.disconnect(color));
  }

  async alarm() {
    if (!this.record || (await this.closeIfDue())) return;
    const core = this.core();
    core.alarm();
    // (Always stored: the alarm is set again for whatever's next, a recording due included.)
    await this.persist(core);
  }
}

/** A seat's player as the queue hands it over: their account and a name. */
function validPlayer(p: DuelPlayerView | undefined): p is DuelPlayerView {
  return !!p && typeof p.uid === "string" && !!p.uid && typeof p.name === "string";
}

/** How many times withXp tries a side's grant at once before it gives the try up to the room's retry. */
const XP_TRIES = 3;

/**
 * Each side's XP for a finished ranked game (server/xp.ts): your own moves (White the odd plies, Black the even), the game's length
 * by this room's clock, a win; a resign before the minimum says so; a test's clock earns none. Its play coins are paid with it (Nov 25):
 * a grant that fails is tried again at once, XP_TRIES times in all (it's keyed by the game, so it pays once); still failing, this
 * throws, and the room tries the recording again from its kept ranks (recordFinished; the review's M1).
 */
async function withXp(sql: ReturnType<typeof d1Sql>, f: FinishedDuel, outcomes: Record<Color, DuelOutcome>, signedInOnly: boolean, paused = false): Promise<Record<Color, DuelOutcome>> {
  const out = { ...outcomes };
  for (const c of ["w", "b"] as const) {
    const won = f.result === (c === "w" ? "1-0" : "0-1");
    const lost = f.result === (c === "w" ? "0-1" : "1-0");
    const grant = () =>
      grantXp(sql, f.players[c], {
        key: `duel:${f.id}`,
        facts: { ms: f.endedAt - f.startedAt, moves: c === "w" ? Math.ceil(f.moves.length / 2) : Math.floor(f.moves.length / 2), won, resigned: f.reason === "resign" && lost, test: !!f.testSeconds },
        signedInOnly,
        now: Date.now(),
        paused,
        quest: "duel",
        // (Play coins, Nov 25: a draw's bonus; a win's comes from XP's own win.)
        coin: { draw: f.result === "1/2-1/2" },
      });
    let xp: Awaited<ReturnType<typeof grantXp>> = null;
    for (let i = 1; ; i++) {
      try {
        xp = await grant();
        break;
      } catch (e) {
        console.log(`xp for duel ${f.id} (${c}), try ${i} of ${XP_TRIES}: ${String(e)}`);
        if (i >= XP_TRIES) throw e;
      }
    }
    // (The game's coins are its play coins and bonus, paid with its XP (PLAY_COINS since Nov 25; ranked's own coins are gone), and a
    // coin boost's extra (Nov 26).)
    if (xp) out[c] = { ...out[c], xp, coins: coinsPaid(xp.coins) };
  }
  return out;
}
