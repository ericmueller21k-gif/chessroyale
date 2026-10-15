#!/usr/bin/env node
// Rolls the live Worker back to an earlier version, through wrangler (docs/areas/ops.md, "Rolling back").
//
//   npm run rollback                                   list the 10 latest versions, newest first, the live one marked
//   npm run rollback -- previous [--message "why"]     back to the version before the live one
//   npm run rollback -- <version-id> [--message "why"] back to that version
//   … --dry-run                                         say what it would do, change nothing
//   … --yes                                             no question first (otherwise it asks, in a terminal)
//   … --env staging                                     the staging Worker instead of production
//
// Needs CLOUDFLARE_API_TOKEN in the environment (wrangler reads it; it's never printed). Listing needs read access to
// Workers; rolling back needs "Workers Scripts: Edit". A rollback lasts until the next deploy from main: revert or fix
// the bad change on main before anything else merges.
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const env = option("--env");
const message = option("--message") ?? "Rolled back with npm run rollback";
const target = args.find((a, i) => !a.startsWith("--") && !["--env", "--message"].includes(args[i - 1]));
const dryRun = flag("--dry-run");

if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN isn't set: wrangler needs it (a token with Workers Scripts: Edit to roll back).");
  process.exit(1);
}

/** Runs wrangler and returns its standard output; on failure, its error (never the token, which wrangler doesn't echo). */
function wrangler(...rest) {
  const full = [...rest, ...(env ? ["--env", env] : [])];
  try {
    return execFileSync("npx", ["wrangler", ...full], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: process.env });
  } catch (e) {
    const why = String(e.stderr ?? e.message)
      .split("\n")
      .filter((l) => l.trim() && !/Proxy environment variables detected/.test(l))
      .join("\n");
    console.error(`wrangler ${full.join(" ")} failed:\n${why}`);
    if (/Authentication|not authorized|permission|10000|code: 9109/i.test(why)) {
      console.error("The token isn't allowed to do this: it needs Workers Scripts: Edit (and Account: Read) for this account.");
    }
    process.exit(1);
  }
}

const versions = JSON.parse(wrangler("versions", "list", "--json"))
  .map((v) => ({ id: v.id, number: v.number, at: v.metadata?.created_on ?? "", source: v.annotations?.["workers/triggered_by"] ?? v.metadata?.source ?? "", note: v.annotations?.["workers/message"] ?? "" }))
  .sort((a, b) => b.number - a.number);
const deployments = JSON.parse(wrangler("deployments", "list", "--json"));
const latest = deployments.sort((a, b) => String(a.created_on).localeCompare(String(b.created_on))).at(-1);
// The live version: the latest deployment's (the one with the most traffic, if it's split).
const live = [...(latest?.versions ?? [])].sort((a, b) => b.percentage - a.percentage)[0]?.version_id;
const share = new Map((latest?.versions ?? []).map((v) => [v.version_id, v.percentage]));

const when = (iso) => (iso ? iso.replace("T", " ").replace(/\.\d+Z$/, " UTC").replace(/Z$/, " UTC") : "");
const line = (v) => `${v.id === live ? "→" : " "} #${v.number}  ${when(v.at)}  ${v.id}${share.has(v.id) ? `  live ${share.get(v.id)}%` : ""}  ${v.source}${v.note ? `  "${v.note}"` : ""}`;

if (!target) {
  console.log(`The Worker's latest versions${env ? ` (${env})` : ""}, newest first (→ the live one):`);
  for (const v of versions) console.log(line(v));
  console.log("\nRoll back: npm run rollback -- previous   (or a version's id; --dry-run to see first)");
  process.exit(0);
}

const liveVersion = versions.find((v) => v.id === live);
const pick = target === "previous" ? versions.find((v) => liveVersion && v.number < liveVersion.number) : versions.find((v) => v.id === target);
if (!pick) {
  console.error(target === "previous" ? "No version before the live one in the latest 10." : `No version ${target} in the latest 10 (npm run rollback lists them).`);
  process.exit(1);
}
if (pick.id === live) {
  console.error(`Version #${pick.number} is already the live one.`);
  process.exit(1);
}
console.log(`Live now:     ${liveVersion ? line(liveVersion).slice(2) : live ?? "unknown"}`);
console.log(`Roll back to: ${line(pick).slice(2)}`);
const command = ["rollback", pick.id, "--message", message, "--yes"];
if (dryRun) {
  console.log(`\n--dry-run: would run  npx wrangler ${command.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}${env ? ` --env ${env}` : ""}`);
  process.exit(0);
}
if (!flag("--yes")) {
  if (!process.stdin.isTTY) {
    console.error("\nNot a terminal: add --yes to roll back (or --dry-run to only look).");
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nRoll back${env ? ` ${env}` : " production"} to #${pick.number}? Type yes: `);
  rl.close();
  if (answer.trim().toLowerCase() !== "yes") {
    console.log("Nothing changed.");
    process.exit(0);
  }
}
process.stdout.write(wrangler(...command));
console.log(`\nRolled back to #${pick.number}. It lasts until the next deploy from main: fix or revert the bad change there first.`);
