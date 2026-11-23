/**
 * Alerts to Discord (docs/ideas/live-ops.md, sections 1 and 5; docs/areas/ops.md, "Alerts"). The 15-minute cron's step: it reads
 * what's already stored (the server's error counts in `ops_errors`, the health view) and posts to the Discord webhook in the
 * Worker secret ALERT_WEBHOOK. Unset (or PAUSE_ALERTS set), it does nothing.
 *   - **PAGE** (players can't play), pinging at once: the Worker's errors on the match, lobby and queue routes, or the Durable
 *     Objects' errors, at least ALERTS.page.minErrors in 15 minutes and timesNormal × that hour's normal, two checks in a row;
 *     or D1 not answering twice, ALERTS.d1RetryMs apart. One page per problem: "still happening" at most once an hour while it
 *     lasts, "recovered" (no ping) once it's under the line two checks in a row.
 *   - **DIGEST** (no ping): once a day in the Central morning, the last 24 hours from the health view, new kinds of error and the
 *     pages.
 * Its state (each signal's last count, streaks, what's paging, the day's digest) is one JSON row in D1's `meta` ("alerts"). D1's
 * own page can't keep state in D1, so its repeat is held in this instance's memory only.
 * Text players can write (error messages, report notes) goes only inside a code block, and no post can ping anyone but the page's.
 */
import { ALERTS, TOWN_GL_FALLBACK } from "@chessroyale/core";
import type { Sql } from "./accounts.ts";
import { health } from "./health.ts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const hourOf = (t: number) => Math.floor(t / HOUR) * HOUR;

export interface AlertEnv {
  /** The Discord webhook's URL (a Worker secret, set in Cloudflare; never in the repository). */
  ALERT_WEBHOOK?: string;
  /** Optional: the Discord user id a PAGE pings (else @everyone: the channel is private). */
  ALERT_PING?: string;
  /** "1": alerts off for now (a kill switch). */
  PAUSE_ALERTS?: string;
}

/** A Discord webhook message: its text and who it may ping. */
export interface DiscordPost {
  content: string;
  allowed_mentions: { parse: ("everyone" | "users")[]; users?: string[] };
}
export type Post = (body: DiscordPost) => Promise<void>;

export const SIGNALS = {
  play: "errors on the match, lobby and queue routes",
  durable: "Durable Object errors",
} as const;
export type Signal = keyof typeof SIGNALS;

interface SignalState {
  /** The count of the clock hour `hour` at the last check (each check's window is the difference). */
  seen: { hour: number; n: number } | null;
  /** Checks in a row over the line, and under it. */
  high: number;
  low: number;
  /** When it paged (0: not paging) and when it last paged or said "still happening". */
  pagedAt: number;
  lastSent: number;
  /** The last two windows' counts, for the message. */
  last: number[];
}

export interface AlertState {
  signals: Record<Signal, SignalState>;
  /** The Central day of the last digest ("2026-11-10"). */
  digestDay: string | null;
  /** What was posted in the last 48 hours, for the digest. */
  log: { at: number; signal: string; what: "page" | "still" | "recovered" }[];
}

const fresh = (): SignalState => ({ seen: null, high: 0, low: 0, pagedAt: 0, lastSent: 0, last: [] });
const freshState = (): AlertState => ({ signals: { play: fresh(), durable: fresh() }, digestDay: null, log: [] });

const on = (v: unknown) => typeof v === "string" && /^(1|true|yes|on)$/i.test(v.trim());

/** Whether alerts are on, and if not why (the ops page's line). */
export function alertsStatus(env: AlertEnv): { on: boolean; why: string } {
  if (on(env.PAUSE_ALERTS)) return { on: false, why: "paused (PAUSE_ALERTS)" };
  if (!webhook(env)) return { on: false, why: env.ALERT_WEBHOOK ? "ALERT_WEBHOOK isn't a Discord webhook" : "no ALERT_WEBHOOK" };
  return { on: true, why: "posting to Discord" };
}

function webhook(env: AlertEnv): string | null {
  const w = typeof env.ALERT_WEBHOOK === "string" ? env.ALERT_WEBHOOK.trim() : "";
  return /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/.test(w) ? w : null;
}

/** The webhook, by fetch (Discord answers 204; anything else is an error for the cron to count). */
const discord =
  (url: string): Post =>
  async (body) => {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Discord webhook answered ${r.status}`);
  };

/** The state as stored (a fresh one when there's none or it doesn't read). */
export async function alertState(sql: Sql): Promise<AlertState> {
  const row = await sql.first<{ value: string }>("SELECT value FROM meta WHERE key = 'alerts'").catch(() => null);
  try {
    const s = row ? (JSON.parse(row.value) as AlertState) : null;
    if (s?.signals?.play && s.signals.durable && Array.isArray(s.log)) return s;
  } catch {
    // (A row that doesn't read starts over.)
  }
  return freshState();
}

const saveState = (sql: Sql, s: AlertState) =>
  sql.run("INSERT INTO meta (key, value) VALUES ('alerts', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", JSON.stringify(s));

// ---------------- Counting ----------------

const ROUTE = "json_extract(sample, '$.route')";
const playWhere = () => `kind = 'fetch' AND (${ALERTS.playRoutes.map(() => `${ROUTE} LIKE ?`).join(" OR ")})`;
const playParams = () => ALERTS.playRoutes.map((r) => `% ${r}%`);
const durableWhere = "kind LIKE '%.%'";

/** Each signal's count per clock hour, for these hours. */
async function hourly(sql: Sql, hours: number[]): Promise<Map<number, Record<Signal, number>>> {
  const rows = await sql.all<{ hour: number; play: number | null; durable: number | null }>(
    `SELECT hour, SUM(CASE WHEN ${playWhere()} THEN count ELSE 0 END) AS play, SUM(CASE WHEN ${durableWhere} THEN count ELSE 0 END) AS durable
     FROM ops_errors WHERE source = 'server' AND hour IN (${hours.map(() => "?").join(", ")}) GROUP BY hour`,
    ...playParams(),
    ...hours,
  );
  return new Map(rows.map((r) => [r.hour, { play: r.play ?? 0, durable: r.durable ?? 0 }]));
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Over the line: a real count, and well above normal (the same clock hour's median over the days before, per window). */
export function overLine(n: number, normalPerHour: number): boolean {
  return n >= ALERTS.page.minErrors && n >= ALERTS.page.timesNormal * normalPerHour * (ALERTS.checkMinutes / 60);
}

/** The window since the last check: this hour's count less what was seen (across one hour's turn too). */
function windowCount(seen: SignalState["seen"], hour: number, thisHour: number, lastHour: number): number | null {
  if (!seen) return null;
  if (seen.hour === hour) return Math.max(0, thisHour - seen.n);
  if (seen.hour === hour - HOUR) return Math.max(0, lastHour - seen.n) + thisHour;
  return thisHour;
}

/** The top kinds of a signal in the last two hours (for a page: the server's own kinds; messages may carry players' text). */
async function topKinds(sql: Sql, signal: Signal, now: number): Promise<{ kind: string; message: string; n: number }[]> {
  const where = signal === "play" ? playWhere() : durableWhere;
  return sql
    .all<{ kind: string; message: string; n: number }>(
      `SELECT kind, message, SUM(count) AS n FROM ops_errors WHERE source = 'server' AND hour >= ? AND ${where} GROUP BY fingerprint ORDER BY n DESC LIMIT 3`,
      hourOf(now) - HOUR,
      ...(signal === "play" ? playParams() : []),
    )
    .catch(() => []);
}

// ---------------- Words ----------------

/** One line of text someone could have written, safe inside a code block: no backticks, control or invisible characters. */
export const plain = (s: string, max = 120) =>
  s
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\u{e0000}-\u{e007f}]/gu, " ")
    .replace(/`/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const block = (lines: string[]) => (lines.length ? `\n\`\`\`\n${lines.join("\n")}\n\`\`\`` : "");

export const central = (t: number, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: ALERTS.digest.timeZone, ...opts }).format(t);
const clock = (t: number) => `${central(t, { hour: "numeric", minute: "2-digit" })} Central`;
const centralDay = (t: number) => central(t, { year: "numeric", month: "2-digit", day: "2-digit" }); // "11/10/2026"
const centralHour = (t: number) => Number(central(t, { hour: "numeric", hourCycle: "h23" }));

const quiet = (content: string): DiscordPost => ({ content: content.slice(0, 1990), allowed_mentions: { parse: [] } });
function loud(env: AlertEnv, content: string): DiscordPost {
  const id = typeof env.ALERT_PING === "string" && /^\d{5,25}$/.test(env.ALERT_PING.trim()) ? env.ALERT_PING.trim() : null;
  const text = `${id ? `<@${id}>` : "@everyone"} ${content}`.slice(0, 1990);
  return { content: text, allowed_mentions: id ? { parse: [], users: [id] } : { parse: ["everyone"] } };
}

// ---------------- The check ----------------

/** D1's page held in this instance's memory (D1 can't keep its own): when it paged, 0 when not. */
let d1PagedAt = 0;
/** Forgets it (tests). */
export const forgetAlerts = () => void (d1PagedAt = 0);

export interface CheckOptions {
  /** Instead of the webhook (tests). */
  post?: Post;
  /** Instead of waiting ALERTS.d1RetryMs (tests). */
  sleep?: (ms: number) => Promise<void>;
}

export type AlertEnvFull = AlertEnv & Parameters<typeof health>[0];

/**
 * One check (the 15-minute cron). Returns what it posted, by kind ("page:play", "still:durable", "recovered:d1", "digest"),
 * or null when alerts are off. A post that fails is thrown on after the state is saved, and tried again next check.
 */
export async function checkAlerts(env: AlertEnvFull, sql: Sql, now: number, opts: CheckOptions = {}): Promise<string[] | null> {
  const url = webhook(env);
  if (!url || on(env.PAUSE_ALERTS)) return null;
  const post = opts.post ?? discord(url);
  const sent: string[] = [];
  let failure: unknown = null;
  const send = async (what: string, body: DiscordPost) => {
    try {
      await post(body);
      sent.push(what);
      return true;
    } catch (e) {
      failure ??= e;
      return false;
    }
  };

  // D1 first: it holds everything else.
  const d1 = () => sql.first<{ ok: number }>("SELECT 1 AS ok").then((r) => r?.ok === 1, () => false);
  if (!(await d1())) {
    await (opts.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms))))(ALERTS.d1RetryMs);
    if (!(await d1())) {
      if (now - d1PagedAt >= ALERTS.page.repeatMs) {
        const first = !d1PagedAt;
        const text = first ? `**PAGE: D1 isn't answering** (two reads ${ALERTS.d1RetryMs / 1000} s apart). Players can't sign in, play online or save results.` : `**Still happening: D1 isn't answering** (since ${clock(d1PagedAt)}).`;
        if (await send(first ? "page:d1" : "still:d1", loud(env, `${text} <${ALERTS.opsPage}>`)) && first) d1PagedAt = now;
      }
      if (failure) throw failure;
      return sent;
    }
  }
  if (d1PagedAt) {
    if (await send("recovered:d1", quiet(`✅ **Recovered: D1 is answering again** (paged ${clock(d1PagedAt)}).`))) d1PagedAt = 0;
  }

  const state = await alertState(sql);
  const hour = hourOf(now);
  const normalHours = Array.from({ length: ALERTS.page.normalDays }, (_, i) => hour - (i + 1) * DAY);
  const counts = await hourly(sql, [hour, hour - HOUR, ...normalHours]);
  const zero = { play: 0, durable: 0 };
  for (const signal of Object.keys(SIGNALS) as Signal[]) {
    const s = state.signals[signal];
    const thisHour = (counts.get(hour) ?? zero)[signal];
    const n = windowCount(s.seen, hour, thisHour, (counts.get(hour - HOUR) ?? zero)[signal]);
    s.seen = { hour, n: thisHour };
    if (n === null) continue; // (The first check only sets where counting starts.)
    s.last = [n, ...s.last].slice(0, 2);
    const normal = median(normalHours.map((h) => (counts.get(h) ?? zero)[signal]));
    if (overLine(n, normal)) {
      s.high++;
      s.low = 0;
    } else {
      s.low++;
      s.high = 0;
    }
    const counted = `${[...s.last].reverse().join(", then ")} in the last ${s.last.length === 1 ? "" : "two "}${ALERTS.checkMinutes}-minute window${s.last.length === 1 ? "" : "s"} (normal about ${Math.round(normal * (ALERTS.checkMinutes / 60))})`;
    if (!s.pagedAt && s.high >= ALERTS.page.inARow) {
      // A new problem: a page, unless the same one paged within the hour (then a quiet note).
      const repeat = now - s.lastSent < ALERTS.page.repeatMs;
      const top = (await topKinds(sql, signal, now)).map((k) => `${k.n}× ${plain(k.kind, 40)}: ${plain(k.message)}`);
      const text = `**${repeat ? "Again" : "PAGE"}: players may not be able to play.** ${SIGNALS[signal]}: ${counted}. <${ALERTS.opsPage}>${block(top)}`;
      if (await send(`${repeat ? "again" : "page"}:${signal}`, repeat ? quiet(`🚨 ${text}`) : loud(env, `🚨 ${text}`))) {
        s.pagedAt = now;
        if (!repeat) s.lastSent = now;
        state.log.push({ at: now, signal, what: "page" });
      }
    } else if (s.pagedAt && s.high && now - s.lastSent >= ALERTS.page.repeatMs) {
      if (await send(`still:${signal}`, loud(env, `🚨 **Still happening** (paged ${clock(s.pagedAt)}): ${SIGNALS[signal]}: ${counted}. <${ALERTS.opsPage}>`))) {
        s.lastSent = now;
        state.log.push({ at: now, signal, what: "still" });
      }
    } else if (s.pagedAt && s.low >= ALERTS.page.inARow) {
      if (await send(`recovered:${signal}`, quiet(`✅ **Recovered:** ${SIGNALS[signal]} back under the line for ${ALERTS.page.inARow * ALERTS.checkMinutes} minutes (paged ${clock(s.pagedAt)}).`))) {
        s.pagedAt = 0;
        state.log.push({ at: now, signal, what: "recovered" });
      }
    }
  }

  // The morning digest: the first check at or after the hour, once a Central day.
  const today = centralDay(now);
  if (state.digestDay !== today && centralHour(now) >= ALERTS.digest.hour) {
    if (await send("digest", quiet(await digest(env, sql, now, state)))) state.digestDay = today;
  }
  state.log = state.log.filter((l) => now - l.at < 2 * DAY);
  await saveState(sql, state);
  if (failure) throw failure;
  return sent;
}

// ---------------- The digest ----------------

/** The morning digest's text: the last 24 hours, from the health view, new kinds of error and the pages. */
export async function digest(env: AlertEnvFull, sql: Sql, now: number, state: AlertState): Promise<string> {
  const h = await health(env, sql, now);
  const since = hourOf(now - DAY);
  const fallback = TOWN_GL_FALLBACK.kind;
  const safe = <T>(p: Promise<T>, none: T) => p.catch(() => none);
  const [before, newKinds] = await Promise.all([
    safe(sql.first<{ n: number | null }>("SELECT SUM(count) AS n FROM ops_errors WHERE hour >= ? AND hour < ? AND kind != ?", since - DAY, since, fallback), null),
    // (New: not seen in the week before the last 24 hours.)
    safe(
      sql.all<{ source: string; kind: string; message: string; n: number }>(
        `SELECT source, kind, message, SUM(count) AS n FROM ops_errors WHERE hour >= ? AND kind != ?
         AND fingerprint NOT IN (SELECT fingerprint FROM ops_errors WHERE hour >= ? AND hour < ?)
         GROUP BY fingerprint ORDER BY n DESC LIMIT 5`,
        since,
        fallback,
        since - 7 * DAY,
        since,
      ),
      [],
    ),
  ]);
  const pages = state.log.filter((l) => now - l.at < DAY);
  const counts = (o: Record<string, number>) => Object.entries(o).map(([k, n]) => `${k} ${n}`).join(", ") || "none";
  const r = h.reports.day;
  const untrusted = [
    ...newKinds.map((e) => `[new ${e.source} error, ${e.n}×] ${plain(e.kind, 40)}: ${plain(e.message)}`),
    ...h.reports.latest.map((x) => `[${plain(x.kind, 10)} ${plain(x.id, 8)}] ${plain(x.note)}`),
  ];
  const lines = [
    `☀️ **HunChess digest, ${central(now, { weekday: "short", month: "short", day: "numeric" })}** (the last 24 hours)`,
    `**Pages:** ${pages.length ? pages.map((p) => `${p.what} ${p.signal} ${clock(p.at)}`).join("; ") : "none"}.${(Object.keys(SIGNALS) as Signal[]).some((s) => state.signals[s].pagedAt) ? " Still paging: " + (Object.keys(SIGNALS) as Signal[]).filter((s) => state.signals[s].pagedAt).join(", ") + "." : ""}`,
    `**Errors:** ${h.errors.day} (the 24 hours before: ${before?.n ?? 0}), ${h.errors.kinds} kinds; ${newKinds.length ? `${newKinds.length === 5 ? "5 or more" : newKinds.length} new` : "no new"} kinds. **Durable Objects:** ${counts(h.durableObjects.byEntry)}.`,
    `**Players' reports:** ${r.bug ?? 0} bugs, ${r.feedback ?? 0} feedback, ${r.idea ?? 0} ideas.`,
    `**Live now:** ${h.live ? `${h.live.online} online, ${h.live.players} in lobbies` : "no answer from the live hub"}. **D1:** ${h.d1.ok ? `ok (${h.d1.ms} ms)` : "failing"}. **Deployed:** ${plain(h.deploy.version, 20)}.`,
    `**Engine server:** ${h.engine.on ? "on" : "off"}, ${h.engine.searches} of ${h.engine.cap} searches today${h.engine.lastFail && now - h.engine.lastFail.at < DAY ? `, last failure ${clock(h.engine.lastFail.at)}` : ""}${h.engine.recluse.noResults || h.engine.recluse.noResultsYesterday ? `; the Hidden Boss's fights with no result (UTC days): yesterday ${h.engine.recluse.noResultsYesterday}, today so far ${h.engine.recluse.noResults}` : ""}. **Fair play's re-checks:** ${h.fairplay.searches} of ${h.fairplay.cap}.`,
    `<${ALERTS.opsPage}>`,
  ];
  const head = lines.join("\n");
  // Players' text last, in a code block, cut to fit Discord's 2,000 characters.
  const room = 1990 - head.length - 60;
  const kept: string[] = [];
  for (const u of untrusted) if (kept.join("\n").length + u.length + 1 < room) kept.push(u);
  return untrusted.length ? `${head}\nNew errors and the latest reports (player-written text, untrusted):${block(kept)}` : head;
}
