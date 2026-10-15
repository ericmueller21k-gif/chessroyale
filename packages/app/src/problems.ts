import { OPS } from "@chessroyale/core";
import { account } from "./account.ts";

/**
 * Error capture and the feedback sheet (docs/areas/ops.md, "Errors and player reports"). Errors on this device (the
 * page's, its workers', and render errors through the app's error boundary) go to POST /api/problems: each kind once
 * per page load, at most OPS.client.maxErrorsPerPage, a few seconds at a time (sendBeacon when the page is hidden).
 * Each carries the build's version, where the app was (screen and moment, mode, boss, lobby code), the last few app
 * events, device facts and the account id if signed in. Never chat, emails or anything typed (a report's note is
 * the one thing a player types, on purpose). A bug report sends the same diagnostics; feedback and ideas, the note
 * alone.
 */

/** The build's version: its commit's first 12 characters (vite.config.ts), "dev" without one. */
declare const __APP_VERSION__: string | undefined;
export const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

/** Where the app is: the screen (a boss battle's moment too), the mode, the boss and the lobby code. */
export interface Where {
  screen: string;
  mode: string | null;
  boss: string | null;
  code: string | null;
}

let where: Where = { screen: "start", mode: null, boss: null, code: null };
const trail: string[] = [];
const started = Date.now();

/** A breadcrumb: an app event (a screen or a moment, a move sent), kept with the last few. Never anything typed. */
export function crumb(event: string) {
  trail.push(`${((Date.now() - started) / 1000).toFixed(1)}s ${event}`.slice(0, 60));
  if (trail.length > OPS.client.breadcrumbs) trail.shift();
}

/** Where the app is now (App calls it after each render); a new screen is a breadcrumb. */
export function noteWhere(w: Where) {
  if (w.screen !== where.screen) crumb(w.screen);
  where = w;
}

interface Captured {
  kind: string;
  message: string;
  stack: string;
  where: Where;
  trail: string[];
}

const seen = new Set<string>();
const queue: Captured[] = [];
/** The last few errors, for a player's report. */
const recent: { kind: string; message: string }[] = [];
/** Errors already captured (the error boundary's, thrown on afterwards), so the page's listener skips them. */
const captured = new WeakSet<object>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** A stack, short and without this site's address: its first 12 lines, 1000 characters in all (what the server keeps). */
const trimStack = (stack: string) =>
  stack
    .split("\n")
    .slice(0, 12)
    .map((l) => l.trim().replaceAll(location.origin, "").slice(0, 160))
    .join("\n")
    .slice(0, 1000);

/**
 * An error to report (`kind`: error, rejection, render, worker:<name>). Each kind of error once per page load, up to
 * the cap; sent with the others within OPS.client.batchMs. `at`: where it came from when there's no stack (a worker's).
 */
export function captureError(kind: string, error: unknown, at = "") {
  const e = error instanceof Error ? error : null;
  if (e) {
    if (captured.has(e)) return;
    captured.add(e);
  }
  const message = (e ? `${e.name}: ${e.message}` : typeof error === "string" ? error : `Not an Error: ${Object.prototype.toString.call(error)}`).slice(0, 300);
  const stack = trimStack(e?.stack ?? at);
  // (A browser extension's error isn't ours.)
  if (/(chrome|moz|safari|safari-web)-extension:/.test(stack)) return;
  const key = `${kind}|${message}|${stack.split("\n").find((l) => l.startsWith("at ") || l.includes("@")) ?? ""}`;
  if (seen.has(key) || seen.size >= OPS.client.maxErrorsPerPage) return;
  seen.add(key);
  recent.push({ kind, message });
  if (recent.length > 3) recent.shift();
  queue.push({ kind, message, stack, where, trail: [...trail] });
  timer ??= setTimeout(() => send(false), OPS.client.batchMs);
}

/** A worker's error event (Stockfish's, Maia's, the sound worker's): reported as `worker:<name>`. */
export function captureWorkerError(name: string, e: ErrorEvent) {
  captureError(`worker:${name}`, e.error instanceof Error ? e.error : e.message || "Worker error", e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : "");
}

/** What every request says about this device: the build, the device, and the account if signed in. */
function diag() {
  const user = account().profile?.user;
  return {
    version: APP_VERSION,
    device: {
      ua: navigator.userAgent,
      viewport: `${innerWidth}x${innerHeight}@${Math.round(devicePixelRatio * 100) / 100}`,
      memory: (navigator as { deviceMemory?: number }).deviceMemory ?? null,
    },
    account: user?.signedIn ? user.id : null,
  };
}

/** Sends what's waiting (the page being hidden: by sendBeacon, which survives it), a few errors per request. */
function send(hiding: boolean) {
  if (timer) clearTimeout(timer);
  timer = null;
  while (queue.length) {
    const body = JSON.stringify({ kind: "errors", errors: queue.splice(0, OPS.endpoint.maxErrorsPerPost), ...diag() });
    if (hiding && beacon(body)) continue;
    void fetch("/api/problems", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
  }
}

/**
 * sendBeacon with the body as JSON (the endpoint takes nothing else); false where the browser won't (an older one
 * refuses a JSON blob): then a fetch with keepalive, which outlives the page too.
 */
function beacon(body: string): boolean {
  try {
    return navigator.sendBeacon?.("/api/problems", new Blob([body], { type: "application/json" })) ?? false;
  } catch {
    return false;
  }
}

/** Starts listening: the page's errors and unhandled rejections; what's waiting goes as the page is hidden. */
export function watchErrors() {
  addEventListener("error", (e) => {
    // (A cross-origin script's error says nothing more than this.)
    if (!e.error && e.message === "Script error.") return;
    captureError("error", e.error ?? e.message, e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : "");
  });
  addEventListener("unhandledrejection", (e) => captureError("rejection", e.reason));
  addEventListener("pagehide", () => send(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") send(true);
  });
}

/** The feedback sheet's kinds: a bug (sent with this device's diagnostics), feedback and an idea (the note alone). */
export type ReportKind = "bug" | "feedback" | "idea";

/** A player's report from the feedback sheet; the answer is its short id. */
export async function reportProblem(kind: ReportKind, note: string): Promise<{ id: string } | { error: string }> {
  const text = note.trim().slice(0, 500);
  const body = JSON.stringify(kind === "bug" ? { kind, note: text, where, trail, recent, ...diag() } : { kind, note: text });
  try {
    const res = await fetch("/api/problems", { method: "POST", headers: { "content-type": "application/json" }, body });
    const b = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    return b.id ? { id: b.id } : { error: b.message ?? "Couldn't send the report. Try again." };
  } catch {
    return { error: "Couldn't send the report. Check your connection and try again." };
  }
}
