/**
 * Which version `npm run rollback -- previous` goes back to (scripts/rollback.ts), as a pure function so it's tested
 * (packages/server/test/rollback.test.ts).
 *
 * Saving a variable or secret in the dashboard makes a new version of the same code (its `workers/triggered_by` isn't
 * "upload"), so "the version before the live one" can be the bad code itself: bad code goes out as #20, PAUSE_X is set
 * to contain it (#21), and #20 is #20's code without the pause. So "previous" is chosen from the deployments, the
 * versions that were really live: step back from the live one past settings changes to the upload its code came from,
 * then take the latest deployment before that upload whose version is older than it (the state just before that code
 * went out, or the code before it when the live one is itself a rollback).
 */

export interface VersionInfo {
  id: string;
  number: number;
  /** When it was made (ISO). */
  at: string;
  /** What made it: "upload" is new code (a deploy); anything else (a secret or variable saved, …) is the same code. */
  trigger: string;
}

export interface Deployment {
  /** When it went live (ISO). */
  at: string;
  versions: { id: string; percentage: number }[];
}

/** The version a deployment serves most. */
export const mainVersion = (d: Deployment): string | undefined => [...d.versions].sort((a, b) => b.percentage - a.percentage)[0]?.id;

export type Choice =
  | {
      ok: true;
      live: VersionInfo;
      /** The upload the live code came from (the live version itself when it's an upload). */
      liveCode: VersionInfo;
      target: VersionInfo;
      /** Why this one, and what to know, line by line. */
      notes: string[];
    }
  | { ok: false; why: string };

const label = (v: VersionInfo) => `#${v.number}`;
const isCode = (v: VersionInfo) => v.trigger === "upload";

/** "previous": see the top of this file. `info` knows every version a deployment names. */
export function pickPrevious(deployments: readonly Deployment[], info: (id: string) => VersionInfo | undefined): Choice {
  const live = [...deployments].sort((a, b) => a.at.localeCompare(b.at));
  if (!live.length) return { ok: false, why: "No deployments found." };
  const vs: VersionInfo[] = [];
  for (const d of live) {
    const id = mainVersion(d);
    const v = id ? info(id) : undefined;
    if (!v) return { ok: false, why: `Couldn't read version ${id ?? "(none)"} of a deployment.` };
    vs.push(v);
  }
  const now = vs[vs.length - 1]!;
  // Back past settings changes (same code) to the upload the live code came from.
  let j = vs.length - 1;
  while (j >= 0 && !isCode(vs[j]!)) j--;
  if (j < 0) return { ok: false, why: `The live code's upload isn't in the latest ${vs.length} deployments: name a version by its id (npm run rollback lists them).` };
  const liveCode = vs[j]!;
  // The latest deployment before it whose version is older than that code.
  for (let i = j - 1; i >= 0; i--) {
    const v = vs[i]!;
    if (v.number >= liveCode.number) continue;
    const notes = [
      now.id === liveCode.id
        ? `The live version ${label(now)} is the upload of the code now running.`
        : `The live version ${label(now)} is a settings change (${now.trigger}) on the code uploaded as ${label(liveCode)}.`,
      `${label(v)} was live just before that code (from ${live[i]!.at}).`,
      ...(isCode(v) ? [] : [`${label(v)} is itself a settings change (${v.trigger}): the code uploaded before it, with the variables as they were then.`]),
    ];
    const later = [...new Set(vs.slice(i + 1).filter((x) => !isCode(x) && x.id !== v.id).map(label))];
    if (later.length) notes.push(`Settings changed since (${later.join(", ")}) aren't in ${label(v)}: check the PAUSE_ variables and MAINTENANCE_BANNER after.`);
    return { ok: true, live: now, liveCode, target: v, notes };
  }
  return { ok: false, why: `No deployment before ${label(liveCode)} in the latest ${vs.length}: name a version by its id (npm run rollback lists them).` };
}

/** A version named by id: what to know about it. */
export function aboutTarget(target: VersionInfo, deployments: readonly Deployment[]): string[] {
  const wasLive = deployments.some((d) => d.versions.some((v) => v.id === target.id));
  return [
    ...(wasLive ? [] : [`${label(target)} wasn't live in the latest ${deployments.length} deployments: make sure it's the code you want.`]),
    ...(isCode(target) ? [] : [`${label(target)} is a settings change (${target.trigger}), not an upload: the code uploaded before it, with the variables as they were then.`]),
    `A version carries its own variables: check the PAUSE_ variables and MAINTENANCE_BANNER after.`,
  ];
}
