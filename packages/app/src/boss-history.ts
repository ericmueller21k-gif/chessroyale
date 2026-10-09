/**
 * The bosses this device met, newest first: a random boss avoids the last one (solo from here; online, the lobby
 * avoids the boss most of its players met last, each sending theirs as they join).
 */
import { bossDef } from "@chessroyale/core";

const KEY = "brc.bossHistory";
let memory: string[] = [];

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!bossDef(x)) : memory;
  } catch {
    return memory;
  }
}

/** The boss met last (a BOSS_ROSTER id), or null. */
export function lastBoss(): string | null {
  return read()[0] ?? null;
}

/** A boss battle began against `id` (once per battle: a repeat of the newest is ignored). */
export function rememberBoss(id: string | null | undefined, battle: string) {
  if (!id || !bossDef(id) || seen.has(battle)) return;
  seen.add(battle);
  memory = [id, ...read()].slice(0, 10);
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Not important: kept in memory for this visit.
  }
}
const seen = new Set<string>();
