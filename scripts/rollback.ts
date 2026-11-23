// Rolls the live Worker back to an earlier version, through wrangler (docs/areas/ops.md, "Rolling back").
//
//   npm run rollback                                    list the latest versions, newest first, the live one marked
//   npm run rollback -- previous --dry-run              which version "previous" is, and why; changes nothing
//   npm run rollback -- previous [--message "why"]      back to the version live before the live code went out
//   npm run rollback -- <version-id> [--message "why"]  back to that version
//   … --env staging                                     the staging Worker instead of production
//
// Flags go after `--` (npm keeps the ones before it for itself: `npm run rollback previous --dry-run` would lose the
// --dry-run, so this stops when it sees one there). A real rollback runs only in a terminal that isn't CI (`CI` and
// the like unset: whyNotHere): wrangler asks before it deploys, and asks again about any secret changed since that
// version (outside a terminal, or with CI set, it would answer yes by itself). Needs CLOUDFLARE_API_TOKEN (wrangler reads it; it's never printed): listing needs read access to Workers,
// rolling back "Workers Scripts: Edit". A rollback lasts until the next deploy from main: revert or fix the bad change
// on main before anything else merges.
import { execFileSync, spawnSync } from "node:child_process";
import { aboutTarget, mainVersion, pickPrevious, whyNotHere, type Deployment, type VersionInfo } from "./rollback-pick.ts";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

// Flags npm took for itself (typed without `--` before them): stop rather than run without them.
const swallowed = ["dry_run", "env", "yes", "message"].filter((k) => process.env[`npm_config_${k}`] !== undefined);
if (swallowed.length) fail(`Put -- before the flags: npm run rollback -- previous --dry-run (npm kept --${swallowed[0]!.replace("_", "-")} for itself).`);

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const env = option("--env");
const message = option("--message") ?? "Rolled back with npm run rollback";
const known = new Set(["--dry-run", "--env", "--message"]);
const unknown = args.filter((a) => a.startsWith("--") && !known.has(a));
if (unknown.length) fail(`Unknown ${unknown.join(", ")}. Flags: --dry-run, --env <name>, --message "<why>".`);
const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--env" && args[i - 1] !== "--message");
if (positional.length > 1) fail(`One version at most (got ${positional.join(", ")}). Put -- before the flags: npm run rollback -- previous --dry-run`);
const target = positional[0];
const dryRun = args.includes("--dry-run");

if (!process.env.CLOUDFLARE_API_TOKEN) fail("CLOUDFLARE_API_TOKEN isn't set: wrangler needs it (a token with Workers Scripts: Edit to roll back).");

/** Runs wrangler and returns its standard output; on failure, its error (wrangler never echoes the token). */
function wrangler(...rest: string[]): string {
  const full = [...rest, ...(env ? ["--env", env] : [])];
  try {
    return execFileSync("npx", ["wrangler", ...full], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    const why = String(err.stderr ?? err.message)
      .split("\n")
      .filter((l) => l.trim() && !/Proxy environment variables detected/.test(l))
      .join("\n");
    if (/Authentication|not authorized|permission|code: 10000|code: 9109/i.test(why)) {
      console.error("The token isn't allowed to do this: it needs Workers Scripts: Edit (and Account: Read) for this account.");
    }
    return fail(`wrangler ${full.join(" ")} failed:\n${why}`);
  }
}

type RawVersion = { id: string; number: number; metadata?: { created_on?: string }; annotations?: Record<string, string> };
const toInfo = (v: RawVersion): VersionInfo => ({ id: v.id, number: v.number, at: v.metadata?.created_on ?? "", trigger: v.annotations?.["workers/triggered_by"] ?? "unknown" });
const versions = (JSON.parse(wrangler("versions", "list", "--json")) as RawVersion[]).map(toInfo).sort((a, b) => b.number - a.number);
const deployments = (JSON.parse(wrangler("deployments", "list", "--json")) as { created_on: string; versions: { version_id: string; percentage: number }[] }[]).map(
  (d): Deployment => ({ at: d.created_on, versions: d.versions.map((v) => ({ id: v.version_id, percentage: v.percentage })) }),
);
// Every version a deployment names (an older one isn't in the latest 10 versions: ask for it).
const byId = new Map(versions.map((v) => [v.id, v]));
for (const d of deployments)
  for (const { id } of d.versions) if (!byId.has(id)) byId.set(id, toInfo(JSON.parse(wrangler("versions", "view", id, "--json")) as RawVersion));
const info = (id: string) => byId.get(id);
const latest = [...deployments].sort((a, b) => a.at.localeCompare(b.at)).at(-1);
const live = latest ? mainVersion(latest) : undefined;
const wasLive = new Set(deployments.flatMap((d) => d.versions.map((v) => v.id)));

const when = (iso: string) => iso.replace("T", " ").replace(/\.\d+Z$/, " UTC").replace(/Z$/, " UTC");
const line = (v: VersionInfo) =>
  `${v.id === live ? "→" : wasLive.has(v.id) ? "•" : " "} #${v.number}  ${when(v.at)}  ${v.id}  ${v.trigger === "upload" ? "code upload" : `settings change (${v.trigger})`}`;

if (!target) {
  console.log(`The Worker's latest versions${env ? ` (${env})` : ""}, newest first (→ live now, • was live):`);
  for (const v of versions) console.log(line(v));
  console.log("\nSee what going back would do: npm run rollback -- previous --dry-run   (or a version's id)");
  process.exit(0);
}

let pick!: VersionInfo;
let notes!: string[];
if (target === "previous") {
  const c = pickPrevious(deployments, info);
  if (!c.ok) fail(c.why);
  else {
    pick = c.target;
    notes = [...c.notes, `A version carries its own variables: check the PAUSE_ variables and MAINTENANCE_BANNER after.`];
  }
} else {
  const v = info(target) ?? toInfo(JSON.parse(wrangler("versions", "view", target, "--json")) as RawVersion);
  pick = v;
  notes = aboutTarget(v, deployments);
}
if (pick!.id === live) fail(`#${pick!.number} is already the live version.`);
const liveInfo = live ? info(live) : undefined;
console.log(`Live now:     ${liveInfo ? line(liveInfo).slice(2) : (live ?? "unknown")}`);
console.log(`Roll back to: ${line(pick!).slice(2)}`);
for (const n of notes!) console.log(`  · ${n}`);
const command = ["rollback", pick!.id, "--message", message, ...(env ? ["--env", env] : [])];
if (dryRun) {
  console.log(`\n--dry-run: nothing changed. It would run  npx wrangler ${command.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
  process.exit(0);
}
const notHere = whyNotHere({ stdin: !!process.stdin.isTTY, stdout: !!process.stdout.isTTY }, process.env);
if (notHere) fail(`\n${notHere}`);
// (wrangler asks for the message, whether to deploy, and about changed secrets; nothing is answered for it.)
const run = spawnSync("npx", ["wrangler", ...command], { stdio: "inherit" });
if (run.status === 0) console.log(`\nIf wrangler rolled back: it lasts until the next deploy from main. Fix or revert the bad change there first.`);
process.exit(run.status ?? 1);
