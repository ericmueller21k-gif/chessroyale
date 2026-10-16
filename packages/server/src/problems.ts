/**
 * Errors and player reports (docs/areas/ops.md, "Errors and player reports").
 *
 *   - POST /api/problems {kind: "errors", errors, ...}: errors a device caught (each kind once per page load). They're
 *     counted in this instance's memory by fingerprint and written to D1 in bounded batches (ErrorTally), so an error
 *     storm can't run up D1's bill.
 *   - POST /api/problems {kind: "bug" | "feedback" | "idea", note, ...} → {id}: the feedback sheet, one row at once
 *     (its short id). A bug comes with the device's diagnostics; feedback and ideas are the note alone.
 *   - The server's own errors (the Worker's fetch, the cron, the Durable Objects' entry points): one structured log
 *     line and the same tally (serverError, guardEntries).
 *
 * Stored: what ops.md lists, nothing else (no IP addresses: the rate limits use them in memory only; emails are
 * scrubbed from any text). Rows older than OPS.store.keepDays go with the 15-minute cron (pruneProblems).
 */
import { OPS } from "@chessroyale/core";
import { d1Sql, ensureSchema, getUser, type Sql } from "./accounts.ts";
import { SESSION_COOKIE, ageAnswer, isSignedIn, readCookie, type WaitUntil } from "./api.ts";
import { randomCode } from "./codes.ts";
import { RateLimiter, TOO_MANY, isSessionToken, problemLimited } from "./limits.ts";
import { cachedUserId } from "./presence.ts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface ProblemsEnv {
  DB?: D1Database;
  /** The built app (its version.json says which commit this deploy is). */
  ASSETS?: Fetcher;
}

/** Where the app was: its screen (with a boss battle's moment), mode, boss and lobby code. */
export interface Where {
  screen: string;
  mode: string | null;
  boss: string | null;
  code: string | null;
}
/** What every request says about the device: the app's build, the device, and the account if signed in. */
export interface Diag {
  version: string;
  device: { ua: string; viewport: string; memory: number | null };
  account: string | null;
}
/** One error from a device, with where the app was and its breadcrumbs then. */
export interface DeviceError {
  kind: string;
  message: string;
  stack: string;
  where: Where;
  trail: string[];
}
/** The feedback sheet's kinds: a bug (with diagnostics), feedback and an idea (a note alone). */
export const REPORT_KINDS = ["bug", "feedback", "idea"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
/** A player's report from the feedback sheet. Feedback and ideas keep only `kind` and `note` (saveReport). */
export interface Report {
  kind: ReportKind;
  note: string;
  diag: Diag;
  where: Where;
  trail: string[];
  recent: { kind: string; message: string }[];
}
export type Problem = { kind: "errors"; diag: Diag; errors: DeviceError[] } | Report;

// ---------------- Reading a request ----------------

/**
 * An email address. Linear: a match is tried only where a run of address characters starts (the lookbehind), never
 * from inside one, and no quantifier is nested, so a long run without an "@" costs one pass, not one per character.
 */
const EMAIL = /(?<![^\s@<>()"',;:])[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}/gi;
/** Every email address in a text, as "[email]". */
export const scrubEmails = (s: string) => s.replace(EMAIL, "[email]");
const VERSION = /^([0-9a-f]{7,40}|dev)$/;
/**
 * Text as stored: a string, control characters (other than newlines) dropped first (so none can split an address
 * past the scrub), cut to its size with room for an address across the cut, emails scrubbed, cut to `max`: the
 * scrub's work is bounded by the field, never the request.
 */
const text = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
        .slice(0, max + 256)
        .replace(EMAIL, "[email]")
        .slice(0, max)
    : "";
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function cleanWhere(v: unknown): Where {
  const w = obj(v);
  return {
    screen: text(w.screen, 60) || "?",
    mode: text(w.mode, 30) || null,
    boss: text(w.boss, 30) || null,
    code: typeof w.code === "string" && /^[A-Z2-9]{5}$/.test(w.code) ? w.code : null,
  };
}
const cleanTrail = (v: unknown) => (Array.isArray(v) ? v.slice(-OPS.client.breadcrumbs).map((c) => text(c, 60)).filter(Boolean) : []);

function cleanDiag(b: Record<string, unknown>): Diag {
  const d = obj(b.device);
  return {
    version: typeof b.version === "string" && VERSION.test(b.version) ? b.version : "unknown",
    device: {
      ua: text(d.ua, 300),
      viewport: typeof d.viewport === "string" && /^\d{2,5}x\d{2,5}(@\d{1,2}(\.\d{1,3})?)?$/.test(d.viewport) ? d.viewport : "",
      memory: typeof d.memory === "number" && d.memory > 0 && d.memory <= 1024 ? d.memory : null,
    },
    // (Checked against the request's session before it's kept: see handleProblems.)
    account: typeof b.account === "string" && /^[\w-]{1,64}$/.test(b.account) ? b.account : null,
  };
}

/** What a request's body says it is (read before anything else in it, for the rate limits); null if nothing we take. */
export function problemKind(body: unknown): "errors" | ReportKind | null {
  const k = obj(body).kind;
  return k === "errors" ? k : (REPORT_KINDS.find((r) => r === k) ?? null);
}

/** A request's body as a problem, every field checked and cut to size; null if it isn't one. */
export function readProblem(body: unknown): Problem | null {
  const b = obj(body);
  const kind = problemKind(b);
  if (kind === "errors") {
    if (!Array.isArray(b.errors) || !b.errors.length) return null;
    const errors = b.errors.slice(0, OPS.endpoint.maxErrorsPerPost).map((v) => {
      const e = obj(v);
      return { kind: text(e.kind, 40) || "error", message: text(e.message, 300) || "(no message)", stack: text(e.stack, 1000), where: cleanWhere(e.where), trail: cleanTrail(e.trail) };
    });
    return { kind: "errors", diag: cleanDiag(b), errors };
  }
  if (kind) {
    const note = text(b.note, 500).trim();
    // (Feedback and ideas are the note: without one there's nothing to keep.)
    if (kind !== "bug" && !note) return null;
    const recent = Array.isArray(b.recent) ? b.recent.slice(-3).map((v) => ({ kind: text(obj(v).kind, 40), message: text(obj(v).message, 200) })) : [];
    return { kind, note, diag: cleanDiag(b), where: cleanWhere(b.where), trail: cleanTrail(b.trail), recent };
  }
  return null;
}

/** The body as text, or null past `max` bytes (read in pieces, so a huge body is never held whole). */
export async function readCapped(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.byteLength;
  }
  return new TextDecoder().decode(all);
}

// ---------------- Fingerprints ----------------

/** FNV-1a, 32 bits, in base 36 (a few hundred kinds of error make a collision about a one-in-a-million chance). */
function fnv(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** A message with what changes between occurrences taken out: addresses' hosts and queries, build hashes, numbers, ids. */
export function normalizeMessage(m: string): string {
  return m
    .replace(/https?:\/\/[^/\s'")]+/g, "")
    .replace(/\?[^\s'")]*/g, "")
    .replace(/-[\w-]{8}(\.(?:m?js|css|wasm))/g, "$1")
    .replace(/\b(0x)?[0-9a-f]{8,}\b/gi, "X")
    .replace(/\d+/g, "N")
    .slice(0, 200);
}

/** The first file a stack names, without the build's hash (index-AbC123xy.js → index.js), its line or column. */
export function topFile(stack: string): string {
  return stack.match(/([\w.-]+?)(?:-[\w-]{8})?\.(m?js|tsx?)\b/)?.slice(1, 3).join(".") ?? "";
}

/** Errors that are the same bug share a fingerprint: where they came from, the message (normalized) and the top file. */
export const fingerprint = (source: string, kind: string, message: string, stack: string) => fnv(`${source}|${kind}|${normalizeMessage(message)}|${topFile(stack)}`);

/**
 * A device error's diagnostics, as its row keeps them (the latest occurrence's): the stack, where the app was, the last
 * few breadcrumbs, the device, version and account (the message is the row's own).
 */
export const errorSample = (e: DeviceError, diag: Diag, account: string | null, at: number) =>
  JSON.stringify({ stack: e.stack, where: e.where, trail: e.trail.slice(-OPS.store.sampleCrumbs), device: diag.device, version: diag.version, account, at });

// ---------------- The tally: bounded writes ----------------

export interface ErrorGroup {
  fingerprint: string;
  source: "client" | "server";
  kind: string;
  message: string;
  version: string;
  /** The latest occurrence's diagnostics, as JSON. */
  sample: string;
}
interface Counted extends ErrorGroup {
  count: number;
  first: number;
  last: number;
}

/**
 * One kind of error's count for its hour: added to its row, or a new row while the hour (and any after it) has fewer
 * than OPS.store.maxNewErrorsPerHour (the database's own cap, in the same statement: a flood of made-up errors from
 * many instances can't grow it without bound). No row back: the cap held it out.
 */
const UPSERT = `INSERT INTO ops_errors (fingerprint, hour, source, kind, message, version, count, first_seen, last_seen, sample)
  SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
  WHERE EXISTS (SELECT 1 FROM ops_errors WHERE fingerprint = ?1 AND hour = ?2) OR (SELECT COUNT(*) FROM ops_errors WHERE hour >= ?2) < ?11
  ON CONFLICT (fingerprint, hour) DO UPDATE SET count = count + excluded.count, last_seen = MAX(last_seen, excluded.last_seen),
  message = excluded.message, version = excluded.version, sample = excluded.sample
  RETURNING count`;

/** Pairs of who sent it and its fingerprint the tally keeps for one write window (memory, never stored). */
const MAX_SEEN = 10_000;

/**
 * Errors counted in memory by fingerprint and written to D1 at most every OPS.store.flushMs (the first at once), at
 * most OPS.store.maxRowsPerFlush rows a time: the most frequent, one row per kind of error per hour. The rest wait for
 * the next write; kinds past OPS.store.maxGroups in memory are dropped and logged as a number. Each address counts once
 * per kind per write window, so one device sending the same error over and over can't push others out. One tally per
 * Worker instance (and per Durable Object's), so writes are bounded by instances, never by errors.
 */
export class ErrorTally {
  private groups = new Map<string, Counted>();
  /** `who|fingerprint` counted since the last write. */
  private seen = new Set<string>();
  private flushedAt = -Infinity;
  private waiting = false;
  private dropped = 0;

  /**
   * Counts an error (once per `who`, the sender's address, per kind per write window; a server error has no `who`);
   * true when it's the first of its kind since the last write (the caller logs those).
   */
  add(g: ErrorGroup, now: number, who?: string): boolean {
    if (who) {
      const key = `${who}|${g.fingerprint}`;
      if (this.seen.has(key)) return false;
      if (this.seen.size < MAX_SEEN) this.seen.add(key);
    }
    const had = this.groups.get(g.fingerprint);
    if (had) {
      Object.assign(had, { count: had.count + 1, last: now, message: g.message, version: g.version, sample: g.sample });
      return false;
    }
    if (this.groups.size >= OPS.store.maxGroups) {
      this.dropped++;
      return false;
    }
    this.groups.set(g.fingerprint, { ...g, count: 1, first: now, last: now });
    return true;
  }

  /** Kinds counted and not yet written. */
  get pending(): number {
    return this.groups.size;
  }

  /** Writes the most frequent kinds counted (one upsert each, up to the cap; the rest wait); the rows written. */
  async flush(sql: Sql): Promise<number> {
    const rows = [...this.groups.values()].sort((a, b) => b.count - a.count).slice(0, OPS.store.maxRowsPerFlush);
    for (const g of rows) this.groups.delete(g.fingerprint);
    this.seen.clear();
    if (this.dropped) console.error({ ops: "errors-dropped", count: this.dropped });
    this.dropped = 0;
    let held = 0;
    for (const g of rows) {
      const hour = Math.floor(g.last / HOUR) * HOUR;
      const row = await sql.first(UPSERT, g.fingerprint, hour, g.source, g.kind, g.message, g.version, g.count, g.first, g.last, g.sample, OPS.store.maxNewErrorsPerHour);
      if (!row) held += g.count;
    }
    // (A full hour keeps counting what it has; new kinds wait for the next. Said once a write, for the health view.)
    if (held) console.error({ ops: "cap", what: "new kinds of error an hour", cap: OPS.store.maxNewErrorsPerHour, count: held });
    return rows.length;
  }

  /** Runs `write` now if the last one was OPS.store.flushMs ago, else once that's up (one wait at a time). */
  schedule(now: number, write: () => Promise<unknown>, waitUntil: WaitUntil): void {
    const since = now - this.flushedAt;
    if (since >= OPS.store.flushMs) {
      // (A wait still marked is one its request's end cut short: this write stands in for it.)
      this.waiting = false;
      this.flushedAt = now;
      waitUntil(write());
      return;
    }
    if (this.waiting) return;
    this.waiting = true;
    waitUntil(
      new Promise((r) => setTimeout(r, Math.min(OPS.store.flushMs, OPS.store.flushMs - since))).then(() => {
        this.waiting = false;
        this.flushedAt = Date.now();
        return write();
      }),
    );
  }
}

const tally = new ErrorTally();

/**
 * Counts an error in this instance's tally (once per `who` per kind per write window) and has it written within
 * OPS.store.flushMs, and what's left after that write a window later; true if it's new this window.
 */
function record(env: ProblemsEnv, g: ErrorGroup, waitUntil: WaitUntil, who?: string): boolean {
  const first = tally.add(g, Date.now(), who);
  const db = env.DB;
  if (db) {
    const wait: WaitUntil = (p) => waitUntil(p.catch((e: unknown) => console.error({ ops: "errors-not-written", message: String(e) })));
    const write = async (): Promise<void> => {
      const sql = d1Sql(db);
      await ensureSchema(sql, db);
      await tally.flush(sql);
      if (tally.pending) tally.schedule(Date.now(), write, wait);
    };
    tally.schedule(Date.now(), write, wait);
  }
  return first;
}

// ---------------- The server's own errors ----------------

async function readVersion(env: ProblemsEnv): Promise<string> {
  try {
    const res = await env.ASSETS!.fetch("https://assets.local/version.json");
    const v = ((await res.json()) as { version?: unknown }).version;
    if (typeof v === "string" && VERSION.test(v)) return v;
  } catch {
    // No assets here (unit tests), or no version.json (a dev build without one).
  }
  return "unknown";
}
let versionRead: Promise<string> | null = null;
/** This deploy's version (the app build's version.json, through the assets binding), read once per instance. */
export function serverVersion(env: ProblemsEnv): Promise<string> {
  versionRead ??= readVersion(env).then((v) => {
    // (Not found: asked again next time.)
    if (v === "unknown") versionRead = null;
    return v;
  });
  return versionRead;
}

/** A stack, short: its first 12 lines, each cut to 200 characters, 1000 in all. */
export const trimStack = (stack: string) =>
  stack
    .split("\n")
    .slice(0, 12)
    .map((l) => l.trim().slice(0, 200))
    .join("\n")
    .slice(0, 1000);

/** Where a server error happened: what (fetch, cron, or a Durable Object's Class.method), its route and lobby code. */
export interface ServerWhere {
  kind: string;
  route: string;
  code?: string | null;
}

/**
 * The server's own error: one structured log line (the first of its kind since the last write: the count goes to D1)
 * and the tally. Never throws.
 */
export function serverError(env: ProblemsEnv, where: ServerWhere, error: unknown, waitUntil: WaitUntil): void {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    const message = text(`${e.name}: ${e.message}`, 300);
    const stack = text(trimStack(e.stack ?? ""), 1000);
    const code = where.code ?? null;
    waitUntil(
      serverVersion(env).then((version) => {
        const fp = fingerprint("server", where.kind, message, stack);
        const route = text(where.route, 200);
        // (The message is the row's own.)
        const sample = JSON.stringify({ stack, route, code, version, at: Date.now() });
        if (record(env, { fingerprint: fp, source: "server", kind: where.kind, message, version, sample }, waitUntil)) {
          console.error({ ops: "error", kind: where.kind, route, code, version, message, fingerprint: fp });
        }
      }),
    );
  } catch {
    // Reporting an error must never be a second one.
  }
}

/** A lobby's or party's code in an API path (/api/lobby/ABCDE/ws, /api/squads/party/ABCDE), for the log line. */
export const codeInPath = (path: string) => path.match(/^\/api\/(?:lobby|squads\/(?:party|lobby))\/([A-Z2-9]{5})(?:\/|$)/i)?.[1]?.toUpperCase() ?? null;

/**
 * Wraps a Durable Object class's entry points (its fetch, WebSocket handlers, alarm and the methods the Worker calls):
 * an error is logged and counted (serverError, as `Class.method`, with the object's lobby code if it has one), then
 * thrown on as before. Only async methods: each wrapper is async.
 */
export function guardEntries<T extends object>(cls: { prototype: T }, name: string, methods: readonly (keyof T & string)[]): void {
  const proto = cls.prototype as Record<string, unknown>;
  for (const m of methods) {
    const fn = proto[m] as (...args: unknown[]) => Promise<unknown>;
    proto[m] = async function (this: { env: ProblemsEnv; ctx: DurableObjectState; record?: { code?: unknown } | null }, ...args: unknown[]) {
      try {
        return await fn.apply(this, args);
      } catch (e) {
        const code = typeof this.record?.code === "string" ? this.record.code : null;
        serverError(this.env, { kind: `${name}.${m}`, route: `${name}.${m}`, code }, e, (p) => this.ctx.waitUntil(p));
        throw e;
      }
    };
  }
}

// ---------------- The endpoint ----------------

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

/** Player reports this instance writes (OPS.store.maxReportsPerMinute), whoever sends them. */
const reportsWritten = new RateLimiter(OPS.store.maxReportsPerMinute, 60_000);

/**
 * A player report's row: its short id (6 characters, no look-alikes), retried on the rare clash; null when the
 * database's cap (OPS.store.maxReportsPerDay, checked in the same statement, whatever the instances) holds it out. A
 * bug keeps its diagnostics and the account (if signed in); feedback and ideas only their note.
 */
export async function saveReport(sql: Sql, p: Report, account: string | null, now: number): Promise<string | null> {
  const bug = p.kind === "bug";
  const diag = bug ? JSON.stringify({ where: p.where, trail: p.trail, recent: p.recent, device: p.diag.device, version: p.diag.version, account }) : "{}";
  for (let i = 0; ; i++) {
    try {
      const row = await sql.first<{ id: string }>(
        `INSERT INTO ops_reports (id, at, kind, account, version, note, diag) SELECT ?, ?, ?, ?, ?, ?, ?
         WHERE (SELECT COUNT(*) FROM ops_reports WHERE at > ?) < ? RETURNING id`,
        randomCode(6),
        now,
        p.kind,
        bug ? account : null,
        bug ? p.diag.version : "",
        p.note,
        diag,
        now - DAY,
        OPS.store.maxReportsPerDay,
      );
      return row?.id ?? null;
    } catch (e) {
      if (i >= 2 || !/unique|constraint/i.test(String(e))) throw e;
    }
  }
}

/** The only requests we take: JSON (a form can't send it) from this site's own pages, when the browser says. */
function crossSite(request: Request): Response | null {
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) return json({ message: "Send JSON" }, 415);
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return json({ message: "Not from here" }, 403);
  return null;
}

/**
 * POST /api/problems: errors (counted, 200) or a player's report: a bug, feedback or an idea ({id}). 415 unless JSON
 * and 403 from another site's page (crossSite), 413 past OPS.endpoint.maxBytes, 429 past the limits (per address and
 * per account, reports of every kind together: limits.ts; checked before any field is read), 400 if it isn't one, 503
 * without a database, past this instance's reports a minute or the database's reports a day.
 */
export async function handleProblems(request: Request, env: ProblemsEnv, waitUntil: WaitUntil): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Not found" }, 404);
  const refused = crossSite(request);
  if (refused) return refused;
  const raw = await readCapped(request, OPS.endpoint.maxBytes);
  if (raw === null) return json({ message: "Too big" }, 413);
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    // Not JSON: a bad request.
  }
  const kind = problemKind(body);
  if (!kind) return json({ message: "Bad request" }, 400);
  const now = Date.now();
  const ip = request.headers.get("cf-connecting-ip");
  const token = readCookie(request, SESSION_COOKIE);
  const wait = problemLimited(kind === "errors" ? "errors" : "report", { ip, session: token }, now);
  if (wait !== null) return json({ message: TOO_MANY, retryMs: wait }, 429, { "retry-after": String(Math.ceil(wait / 1000)) });
  const p = readProblem(body);
  if (!p) return json({ message: "Bad request" }, 400);
  if (!env.DB) return json({ message: "Not set up here." }, 503);
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  // A guest on a device that answered the age question "too young" sends nothing it typed: a bug keeps its diagnostics
  // without the note, and feedback or an idea (a note alone) isn't taken. Someone signed in there is as anywhere
  // (docs/decisions/2026-10-16-age-gate-and-real-money.md). (A read only for such a device's reports.)
  if (p.kind !== "errors" && ageAnswer(request) === "under") {
    const uid = isSessionToken(token) ? await cachedUserId(sql, token, now) : null;
    if (!isSignedIn(uid ? await getUser(sql, uid) : null)) {
      if (p.kind !== "bug") return json({ message: "Bad request" }, 400);
      p.note = "";
    }
  }
  // The account id only if it's this session's (the app sends it only when signed in, and only with errors and bugs);
  // cached, so rarely a D1 read.
  const account = p.kind !== "feedback" && p.kind !== "idea" && p.diag.account && isSessionToken(token) && (await cachedUserId(sql, token, now)) === p.diag.account ? p.diag.account : null;
  if (p.kind === "errors") {
    // Each kind of error once a request (and once per address a write window: the tally).
    const counted = new Set<string>();
    for (const e of p.errors) {
      const fp = fingerprint("client", e.kind, e.message, e.stack);
      if (counted.has(fp)) continue;
      counted.add(fp);
      record(env, { fingerprint: fp, source: "client", kind: e.kind, message: e.message, version: p.diag.version, sample: errorSample(e, p.diag, account, now) }, waitUntil, ip ?? undefined);
    }
    return json({ ok: true });
  }
  // This instance's cap, then the database's own (in the insert itself).
  const busy = () => json({ message: "Too many reports right now. Try again in a minute." }, 503);
  if (!reportsWritten.hit("all", now).ok) return busy();
  const id = await saveReport(sql, p, account, now);
  if (!id) {
    console.error({ ops: "cap", what: "player reports a day", cap: OPS.store.maxReportsPerDay });
    return busy();
  }
  return json({ id });
}

// ---------------- Reading them back (the ops page) and pruning ----------------

export interface ErrorRow {
  fingerprint: string;
  source: string;
  kind: string;
  message: string;
  /** Occurrences in the last 24 hours and 7 days (by hour, so "24 hours" reaches back to the start of that hour). */
  day: number;
  week: number;
  firstSeen: number;
  lastSeen: number;
  /** The versions it came from in the last 7 days, comma-separated. */
  versions: string;
  /** The latest occurrence's diagnostics (JSON). */
  sample: string;
}

/**
 * The most frequent errors of the last 7 days: those of the last 24 hours first, then the newest. `search`: only those
 * whose message contains it.
 */
export async function topErrors(sql: Sql, now: number, limit = 30, search = ""): Promise<ErrorRow[]> {
  const hourOf = (t: number) => Math.floor(t / HOUR) * HOUR;
  return sql.all<ErrorRow>(
    `SELECT g.fingerprint, e.source, e.kind, e.message, g.day, g.week, g.last_seen AS lastSeen, g.versions, e.sample,
       (SELECT MIN(f.first_seen) FROM ops_errors f WHERE f.fingerprint = g.fingerprint) AS firstSeen
     FROM (SELECT fingerprint, MAX(hour) AS hour, SUM(count) AS week, SUM(CASE WHEN hour >= ? THEN count ELSE 0 END) AS day,
             MAX(last_seen) AS last_seen, GROUP_CONCAT(DISTINCT version) AS versions
           FROM ops_errors WHERE hour >= ? AND instr(message, ?) > 0 GROUP BY fingerprint) g
     JOIN ops_errors e ON e.fingerprint = g.fingerprint AND e.hour = g.hour
     ORDER BY g.day DESC, g.week DESC, g.last_seen DESC LIMIT ?`,
    hourOf(now - DAY),
    hourOf(now - 7 * DAY),
    search,
    limit,
  );
}

export interface ReportRow {
  id: string;
  at: number;
  kind: ReportKind;
  account: string | null;
  version: string;
  note: string;
  diag: string;
}
/** The latest player reports, of one kind or (`kind` "") all. */
export const latestReports = (sql: Sql, limit = 30, kind: ReportKind | "" = "") =>
  sql.all<ReportRow>("SELECT id, at, kind, account, version, note, diag FROM ops_reports WHERE ? IN ('', kind) ORDER BY at DESC LIMIT ?", kind, limit);
export const reportById = (sql: Sql, id: string) => sql.first<ReportRow>("SELECT id, at, kind, account, version, note, diag FROM ops_reports WHERE id = ?", id);

/** Deletes errors and player reports older than OPS.store.keepDays (the 15-minute cron). */
export async function pruneProblems(sql: Sql, now: number): Promise<void> {
  const before = now - OPS.store.keepDays * DAY;
  await sql.run("DELETE FROM ops_errors WHERE hour < ?", Math.floor(before / HOUR) * HOUR);
  await sql.run("DELETE FROM ops_reports WHERE at < ?", before);
}
