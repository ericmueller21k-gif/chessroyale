/**
 * The residents program's own decisions about its life on the always-on host (run.ts; docs/areas/ops.md, "Residents, the host"),
 * kept pure so they can be tested: when a deploy means it should wind down, when the wind-down is over, and whether another copy of
 * the program is already playing the same accounts. Its exit codes are what the host's start.sh acts on.
 */

/** A new version went live and this program is done with the old one: start.sh starts over at once on the newest main. */
export const NEW_VERSION_EXIT = 75;
/** Access turned the service token away: start.sh ends the container, so the cron's next start brings the Worker's current secret. */
export const ACCESS_REFUSED_EXIT = 78;

/**
 * What a read of the live version (/version.json's `version`, 12 characters of the commit) means, `--follow-deploys`:
 * - `start`: the version this program counts as "its" live one from now (unchanged unless it says otherwise);
 * - `drainTo`: a new version is live (wind down: games finish, then exit NEW_VERSION_EXIT), or null.
 *
 * `own` is the program's own commit (RESIDENTS_COMMIT, 12 characters; null off the host). The host clones main's head, which can be
 * ahead of the live version while a merge deploys: when its own commit goes live it's already running it, so that's no drain.
 */
export function versionCall(start: string | null, own: string | null, live: string | null): { start: string | null; drainTo: string | null } {
  if (!live) return { start, drainTo: null };
  if (own && live === own) return { start: live, drainTo: null };
  if (!start) return { start: live, drainTo: null };
  return live === start ? { start, drainTo: null } : { start, drainTo: live };
}

/** The version this program starts counting from: the live one, or its own commit when the first read fails (null: neither). */
export function firstVersion(live: string | null, own: string | null): string | null {
  return live ?? own;
}

/** Whether a wind-down is over: "finished" (no resident busy), "time up" (drainMinutes since it began), or null (wait on). */
export function drainOver(since: number, now: number, anyBusy: boolean, drainMinutes: number): "finished" | "time up" | null {
  if (!anyBusy) return "finished";
  return now - since >= drainMinutes * 60_000 ? "time up" : null;
}

/** The last heartbeat as GET /api/admin/residents gives it (`beat`): when it came, who sent it, and what it said. */
export interface LastBeat {
  at: number;
  by: string;
  beat: { instance?: unknown; stopped?: unknown } & Record<string, unknown>;
}

/**
 * Whether another program is playing the residents right now, from the last heartbeat at this one's start: one that beat within
 * 2 × beatSeconds and didn't say it stopped (a program's last beat, on a clean stop, says so). Its description, or null. Two at
 * once sign each other's residents out (every sign-in ends the account's other sessions), so the program won't start beside one
 * (it exits 1: on the host, start.sh tries again after its wait).
 */
export function otherProgram(last: LastBeat | null | undefined, now: number, beatSeconds: number): string | null {
  if (!last || typeof last.at !== "number" || !last.beat || typeof last.beat !== "object") return null;
  if (last.beat.stopped === true) return null;
  const age = now - last.at;
  if (age >= 2 * beatSeconds * 1000) return null;
  const instance = typeof last.beat.instance === "string" ? last.beat.instance : "unknown";
  return `instance ${instance} (by ${last.by}) sent a heartbeat ${Math.max(0, Math.round(age / 1000))} s ago`;
}
