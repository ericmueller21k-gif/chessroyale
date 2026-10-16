import { useEffect, useState } from "preact/hooks";
import { bossesOff, type Pausable } from "@chessroyale/core";

/**
 * The kill switches that are off and the maintenance banner (GET /api/status: kill-switches.ts on the server; the parts
 * and their lines: pauses.ts in core). Asked as the app starts, then every minute and whenever the app comes back to
 * the screen. Without an answer (offline, no server) nothing is resting: the server still refuses what it must.
 */
export interface ServerStatus {
  paused: readonly string[];
  banner: string | null;
}

const EVERY_MS = 60_000;
let state: ServerStatus = { paused: [], banner: null };
const listeners = new Set<() => void>();

export const serverStatus = () => state;
export const isPaused = (what: Pausable) => state.paused.includes(what);
/** The bosses resting, by id (a solo game's `bossesOff`, the boss menu). */
export const pausedBosses = () => bossesOff(state.paused);

export async function refreshStatus(): Promise<void> {
  try {
    const res = await fetch("/api/status", { credentials: "same-origin" });
    if (!res.ok) return;
    const body = (await res.json()) as Partial<ServerStatus>;
    const next = { paused: Array.isArray(body.paused) ? body.paused.filter((p) => typeof p === "string") : [], banner: typeof body.banner === "string" && body.banner ? body.banner : null };
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    listeners.forEach((l) => l());
  } catch {
    // Offline: as it was.
  }
}

let started = false;
/** Starts asking (once). */
export function startStatus() {
  if (started) return;
  started = true;
  void refreshStatus();
  setInterval(() => document.visibilityState === "visible" && void refreshStatus(), EVERY_MS);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void refreshStatus());
}

/** The status, kept up to date in a component. */
export function useServerStatus(): ServerStatus {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return state;
}
