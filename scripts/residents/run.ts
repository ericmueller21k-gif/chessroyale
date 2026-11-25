/**
 * The residents (Eric, Nov 25: "literally have 200 bots made which just sit on the server and play ranked ... so like any time of day
 * I can login and see games played"; the design: notes/residents-design.md on claude/director-notes; docs/areas/ops.md "Residents";
 * docs/decisions/2026-11-25-residents-program.md). Real accounts (`users.resident`), made and signed in through the residents' admin
 * route, played by this program as people with browsers: home, the ranked 1 v 1 queue, games with moves drawn from Maia at each
 * resident's rating, on a daily schedule that keeps about --target-online of them online, in waves.
 *
 *   npx tsx scripts/residents/run.ts [--base https://hunchess.com] [--accounts 200] [--target-online 30] [--hours 0] [--modes 1v1]
 *     [--flat] [--follow-deploys]
 *
 * Options:
 *   --base URL           the site (default https://hunchess.com: Cloudflare Access's service token from CF_ACCESS_CLIENT_ID and
 *                        CF_ACCESS_CLIENT_SECRET, sent as headers, never printed). A local server (http://localhost:8787, wrangler dev)
 *                        takes the e2e's key for the admin route instead (E2E_SQL_KEY, the server's E2E_SQL).
 *   --accounts N         how many residents (the first N of names.json; default RESIDENTS.accounts)
 *   --target-online N    about how many online at once (default RESIDENTS.targetOnline; the schedule's waves move around it)
 *   --hours H            stop after H hours (default 0: run until stopped)
 *   --modes LIST         the modes they play (only "1v1" so far)
 *   --flat               no schedule: the first --target-online residents online all the time (a local test, a load check)
 *   --follow-deploys     the always-on host's way (scripts/residents/container): reads the site's /version.json every
 *                        RESIDENTS.host.versionCheckMinutes; once a new version is live it starts nothing new, lets games in
 *                        progress finish (at most RESIDENTS.host.drainMinutes, then resigns what's left) and exits with 75, so
 *                        the host starts it again on the new main
 *
 * Stopping: SIGTERM or Ctrl-C stops every resident cleanly (out of the queue, a game in progress resigned), sends a last heartbeat
 * and exits; a second one exits at once. The kill switch PAUSE_RESIDENTS is the server's: while it's on the program won't start, and
 * when it comes on (any answer "Residents are paused.", or a socket refused and the route saying so) every resident stops and the
 * program exits.
 *
 * Logs: one line per event on stdout (never a cookie or token), and a summary every RESIDENTS.summaryMinutes.
 */
import { readFileSync } from "node:fs";
import { RESIDENTS, mulberry32 } from "@chessroyale/core";
import { AccessRefused, Api, CookieJar, isPausedAnswer, targetFrom, type Target } from "./client.ts";
import { MoveSource } from "./engine.ts";
import { profilesFor } from "./profiles.ts";
import { QueueGate, Resident, Stats, type State, type World } from "./resident.ts";
import { Scheduler } from "./schedule.ts";

// ---------------- Options ----------------

const args = process.argv.slice(2);
const arg = (k: string, d?: string) => {
  const i = args.indexOf(`--${k}`);
  if (i < 0) return d;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : "1";
};
const fail = (message: string): never => {
  console.error(`residents: ${message}`);
  process.exit(1);
};
const num = (k: string, d: number) => {
  const v = Number(arg(k, String(d)));
  return Number.isFinite(v) && v >= 0 ? v : fail(`--${k} must be a number.`);
};

let target: Target;
try {
  target = targetFrom(arg("base", "https://hunchess.com")!, process.env);
} catch (e) {
  fail((e as Error).message);
}
const accounts = Math.floor(num("accounts", RESIDENTS.accounts));
const targetOnline = Math.floor(num("target-online", RESIDENTS.targetOnline));
const hours = num("hours", 0);
const flat = !!arg("flat");
const follow = !!arg("follow-deploys");
const modes = (arg("modes", "1v1") ?? "").split(",").map((m) => m.trim());
if (modes.some((m) => m !== "1v1")) fail('only "--modes 1v1" so far (50 v 50 comes in a later PR).');
if (accounts < 1) fail("--accounts must be at least 1.");

const names = JSON.parse(readFileSync(new URL("./names.json", import.meta.url), "utf8")) as string[];
let profiles: ReturnType<typeof profilesFor>;
try {
  profiles = profilesFor(names, accounts);
} catch (e) {
  fail((e as Error).message);
}

// ---------------- The log ----------------

const t0 = Date.now();
const log = (line: string) => console.log(`${new Date().toISOString().slice(0, 19)}Z  ${line}`);

// ---------------- Stopping ----------------

let stopping = false;
let pausedSeen = false;
/** A new version went live (--follow-deploys): since when, and the versions. */
let draining: { since: number; from: string; to: string } | null = null;
const drainingNow = () => draining;
const sleepers = new Set<() => void>();
const nap = (ms: number) =>
  stopping
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(t);
          sleepers.delete(done);
          resolve();
        };
        const t = setTimeout(done, Math.max(0, ms));
        sleepers.add(done);
      });

const admin = new Api(target!, new CookieJar());

/** The residents' route: whether residents are paused (null: no answer). */
async function pausedNow(): Promise<boolean | null> {
  const r = await admin.request("GET", "/api/admin/residents", { admin: true });
  if (isPausedAnswer(r)) return true;
  return r.status === 200 && typeof r.body?.paused === "boolean" ? r.body.paused : null;
}

let checkingPause = false;
const world: World = {
  target: target!,
  engine: new MoveSource(),
  gate: new QueueGate(mulberry32(Date.now() >>> 0)),
  stats: new Stats(),
  log,
  residentIds: new Set(),
  stopping: () => stopping,
  draining: () => draining !== null,
  nap,
  paused: (how) => {
    if (stopping || checkingPause) return;
    checkingPause = true;
    // (Any answer "Residents are paused." is the switch; a refused socket is checked with the route first.)
    void pausedNow()
      .then((p) => {
        if (p || /^(GET|POST|PATCH|DELETE) /.test(how)) {
          pausedSeen = true;
          log(`the server paused the residents (seen on ${how}): stopping everyone`);
          void shutdown("paused", 0);
        }
      })
      .finally(() => {
        checkingPause = false;
      });
  },
};
world.engine.onNote = (l) => log(l);

const residents = profiles!.map((p) => new Resident(p, world));

let shuttingDown: Promise<void> | null = null;
function shutdown(why: string, code: number): Promise<void> {
  if (shuttingDown) return shuttingDown;
  stopping = true;
  for (const w of [...sleepers]) w();
  world.gate.close();
  shuttingDown = (async () => {
    log(`stopping (${why})`);
    if (pausedSeen) for (const r of residents) r.pausedNow();
    await Promise.race([Promise.all(residents.map((r) => r.stopNow())), new Promise((r) => setTimeout(r, 15_000))]);
    if (!pausedSeen) await beat().catch(() => undefined);
    log(summary());
    world.engine.close();
    process.exit(code);
  })();
  return shuttingDown;
}
let signals = 0;
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    if (++signals > 1) process.exit(1);
    void shutdown(sig, 0);
  });
}

// ---------------- Following deploys ----------------

/** The exit code that tells the host a new version is live and the program is done with this one (start.sh starts over at once). */
const NEW_VERSION_EXIT = 75;

/** The version live on the site (/version.json's `version`: the build's commit, 12 characters), or null (no answer, or none built). */
async function liveVersion(): Promise<string | null> {
  const r = await admin.request("GET", "/version.json");
  const v = r.status === 200 ? r.body?.version : null;
  return typeof v === "string" && /^[0-9a-f]{7,40}$/.test(v) ? v : null;
}

/** The version live when this program started (or first answered): a different one later means a deploy. */
let startVersion: string | null = null;

/** Reads the live version; a new one starts the drain: nothing new from now, games in progress finish. */
async function checkVersion(now: number): Promise<void> {
  const v = await liveVersion().catch(() => null);
  if (!v || draining || stopping) return;
  if (!startVersion) {
    startVersion = v;
    return;
  }
  if (v === startVersion) return;
  draining = { since: now, from: startVersion, to: v };
  // (Everyone waiting at the queue's gate goes in at once and sees the drain: nobody waits out the gate's spacing.)
  world.gate.close();
  const playing = residents.filter((r) => r.state === "game").length;
  log(`a new version is live (${startVersion} → ${v}): starting nothing new, ${playing} game${playing === 1 ? "" : "s"} to finish (at most ${RESIDENTS.host.drainMinutes} min)`);
}

// ---------------- The heartbeat and the summary ----------------

function counts(): Record<State, number> {
  const c: Record<State, number> = { offline: 0, home: 0, queue: 0, game: 0 };
  for (const r of residents) c[r.state]++;
  return c;
}

let lastBeatOk = 0;
async function beat(): Promise<void> {
  const c = counts();
  const s = world.stats;
  const body = {
    v: 1,
    at: Date.now(),
    startedAt: t0,
    accounts: residents.length,
    signedIn: world.residentIds.size,
    targetOnline,
    flat,
    modes,
    online: residents.length - c.offline,
    states: c,
    games: s.games,
    moves: s.moves,
    fallbackMoves: s.fallbackMoves,
    sessions: s.sessions,
    errors: s.errors,
    maia: world.engine.ready(),
    queueGate: { waiting: world.gate.waiting, inLine: world.gate.queued },
    // (Where it runs from: the host's commit of main, the live version it follows, and whether it's winding down for a new one.)
    commit: process.env.RESIDENTS_COMMIT?.slice(0, 12) ?? null,
    follow: follow ? { version: startVersion, draining: draining ? { since: draining.since, to: draining.to } : null } : null,
  };
  const r = await admin.request("POST", "/api/admin/residents/beat", { admin: true, body });
  if (isPausedAnswer(r)) return world.paused("POST /api/admin/residents/beat");
  if (r.status === 200) lastBeatOk = Date.now();
  else world.stats.error(`beat-${r.status}`);
}

function summary(): string {
  const c = counts();
  const s = world.stats;
  const g = s.games;
  const waits = s.takeWaits();
  const errs = Object.entries(s.errors)
    .map(([k, n]) => `${k} ${n}`)
    .join(", ");
  return [
    `summary after ${Math.round((Date.now() - t0) / 60_000)} min: ${residents.length - c.offline} online (home ${c.home}, queue ${c.queue}, game ${c.game}), target ${targetOnline}${flat ? " flat" : ""}`,
    `  games: ${g.started} started, ${g.over} over (${g.wins} won, ${g.losses} lost, ${g.draws} drawn, ${g.aborted} aborted), ${g.vsPeople} against people, ${g.left} walked away, ${g.gone} gone, ${g.failed} failed`,
    `  moves ${s.moves} (${s.fallbackMoves} not Maia's), queue waits ${waits.n ? `median ${Math.round(waits.medianMs! / 1000)} s, max ${Math.round(waits.maxMs! / 1000)} s over ${waits.n}` : "none"}, maia ${world.engine.ready() ? "ready" : "DOWN"}, last heartbeat ${lastBeatOk ? `${Math.round((Date.now() - lastBeatOk) / 1000)} s ago` : "never"}`,
    `  errors: ${errs || "none"}`,
  ].join("\n");
}

// ---------------- Start ----------------

try {
  const p = await pausedNow();
  if (p === null) fail("the residents' route didn't answer (not deployed there yet, or this caller isn't let in: the Access token / E2E_SQL_KEY).");
  if (p) fail("residents are paused on the server (PAUSE_RESIDENTS): not starting.");
} catch (e) {
  fail(e instanceof AccessRefused ? e.message : `couldn't reach ${target!.origin}: ${String(e)}`);
}
log(`residents: ${residents.length} accounts, about ${targetOnline} online${flat ? " (flat)" : ""}, ${hours ? `for ${hours} h` : "until stopped"}, modes ${modes.join(",")}, at ${target!.origin}`);
if (follow) {
  startVersion = await liveVersion().catch(() => null);
  log(`following deploys: the live version is ${startVersion ?? "unknown (read again in a moment)"}${process.env.RESIDENTS_COMMIT ? `, this program is ${process.env.RESIDENTS_COMMIT.slice(0, 12)}` : ""}`);
}

if (!(await world.engine.start())) fail("Maia didn't load: residents play Maia's moves, so not starting (packages/maia-worker: npm run build -w maia-worker?).");

// Every account made (or found) and signed in, four at a time.
{
  let next = 0;
  let made = 0;
  const failures: string[] = [];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < residents.length && !stopping) {
        const r = residents[next++]!;
        let res: Awaited<ReturnType<Resident["signIn"]>>;
        try {
          res = await r.signIn();
        } catch (e) {
          if (e instanceof AccessRefused) fail(e.message);
          res = { ok: false, status: 0, message: String(e) };
        }
        if (res.ok && res.created) made++;
        if (!res.ok) {
          failures.push(`${r.profile.name} (${res.status} ${res.message})`);
          if (res.status === 503) world.paused("POST /api/admin/residents");
        }
      }
    }),
  );
  log(`signed in ${world.residentIds.size} of ${residents.length} residents (${made} new)${failures.length ? `; failed: ${failures.slice(0, 5).join(", ")}${failures.length > 5 ? ` and ${failures.length - 5} more` : ""}` : ""}`);
  if (!world.residentIds.size) fail("no resident could sign in.");
  if (failures.length) world.stats.errors["sign-in"] = failures.length;
}

const scheduler = new Scheduler(profiles!, targetOnline);
/** Sessions already begun (resident:start), so one that ended early (a rage-quit, a lockout) isn't begun again. */
const begun = new Set<string>();
const endAt = hours > 0 ? t0 + hours * 3_600_000 : Infinity;
let nextBeat = Date.now();
let nextSummary = Date.now() + RESIDENTS.summaryMinutes * 60_000;
let nextVersion = Date.now() + RESIDENTS.host.versionCheckMinutes * 60_000;

while (!stopping) {
  const now = Date.now();
  if (now >= endAt) {
    await shutdown(`${hours} h are up`, 0);
    break;
  }
  if (follow && now >= nextVersion) {
    nextVersion = now + RESIDENTS.host.versionCheckMinutes * 60_000;
    await checkVersion(now);
  }
  // (Read through a call: TypeScript can't see checkVersion set it.)
  const drain = drainingNow();
  if (drain) {
    if (residents.every((r) => !r.busy)) {
      await shutdown(`a new version is live (${drain.to}), every game finished`, NEW_VERSION_EXIT);
      break;
    }
    if (now - drain.since >= RESIDENTS.host.drainMinutes * 60_000) {
      await shutdown(`a new version is live (${drain.to}), ${RESIDENTS.host.drainMinutes} min are up`, NEW_VERSION_EXIT);
      break;
    }
  } else if (flat) {
    for (const r of residents.slice(0, targetOnline)) if (r.id && !r.busy && r.lockedUntil <= now) r.startSession(endAt === Infinity ? now + 365 * 86_400_000 : endAt);
  } else {
    const running = scheduler.runningAt(now);
    for (const [i, session] of running) {
      const r = residents[i]!;
      const key = `${i}:${session.start}`;
      if (!r.id || r.busy || begun.has(key) || r.lockedUntil > now) continue;
      begun.add(key);
      r.startSession(session.end);
    }
  }
  if (now >= nextBeat) {
    nextBeat = now + RESIDENTS.beatSeconds * 1000;
    // (Access turning the token away mid-run means it was revoked or changed: stop, as at the start; the host tries again later.)
    void beat().catch((e: unknown) => (e instanceof AccessRefused ? void shutdown("Access turned the service token away", 1) : world.stats.error("beat")));
  }
  if (now >= nextSummary) {
    nextSummary = now + RESIDENTS.summaryMinutes * 60_000;
    log(summary());
  }
  await nap(5000);
}
