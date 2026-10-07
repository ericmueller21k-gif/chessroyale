/**
 * The load test: simulated players against a HunChess server (local wrangler dev or the staging Worker; never
 * production). See DEPLOY.md, "Load testing", and DECISIONS.md, "Capacity".
 *
 *   npx tsx scripts/load/run.ts --url http://localhost:8787 --players 500 --ramp 60 --session 240 --name local-500
 *
 * Options:
 *   --url URL          the server (refuses hunchess.com)
 *   --players N        how many simulated players (default 100)
 *   --ramp S           seconds over which they arrive, evenly (default 30)
 *   --session S        each leaves after this long, 0 = plays to the results (default 0)
 *   --home S           up to this long on the home screen before PLAY (default 10)
 *   --mode crowd|raid  the queue (default crowd)
 *   --pool NAME        a queue of its own (default: a fresh one per run, so runs never meet)
 *   --chat P           chance per round of a quick-chat line (default 0.1)
 *   --name NAME        writes reports/load/NAME.md and .json
 *   --ops-key KEY      reads the server's counters (/api/ops/stats; the OPS_STATS variable) before and after
 *   --access           sends Cloudflare Access headers from CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET (staging)
 *   --until S          stop the whole run after this long (default: when every player is done)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { Metrics } from "./metrics.ts";
import { FakePlayer, type PlayerOptions } from "./player.ts";

const args = process.argv.slice(2);
const arg = (k: string, d?: string) => {
  const i = args.indexOf(`--${k}`);
  if (i < 0) return d;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : "1";
};

const base = (arg("url", "http://localhost:8787") as string).replace(/\/$/, "");
if (/hunchess\.com/i.test(base)) {
  console.error("Never load-test production. Use wrangler dev or the staging Worker.");
  process.exit(1);
}
const players = Number(arg("players", "100"));
const rampS = Number(arg("ramp", "30"));
const name = arg("name");
const opsKey = arg("ops-key");
const untilS = Number(arg("until", "0"));
const headers: Record<string, string> = {};
if (arg("access")) {
  const id = process.env.CF_ACCESS_CLIENT_ID;
  const secret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (id && secret) Object.assign(headers, { "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret });
}
const opts: PlayerOptions = {
  base,
  mode: arg("mode", "crowd") === "raid" ? "raid" : "crowd",
  pool: arg("pool", `load${Date.now().toString(36)}`),
  homeDwellMs: Number(arg("home", "10")) * 1000,
  chatChance: Number(arg("chat", "0.1")),
  maxSessionMs: Number(arg("session", "0")) * 1000,
  headers,
  heartbeatMs: 30_000,
};

async function stats(reset = false) {
  if (!opsKey) return null;
  try {
    const res = await fetch(`${base}/api/ops/stats${reset ? "?reset=1" : ""}`, { headers: { ...headers, "x-ops-key": opsKey } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const m = new Metrics();
await stats(true);
const t0 = Date.now();
const runs: Promise<void>[] = [];
let lastUsage = process.cpuUsage();
let lastAt = performance.now();
let generatorCpuMax = 0;
const progress = setInterval(() => {
  const u = process.cpuUsage(lastUsage);
  const now = performance.now();
  const cpu = (u.user + u.system) / 1000 / (now - lastAt);
  generatorCpuMax = Math.max(generatorCpuMax, cpu);
  lastUsage = process.cpuUsage();
  lastAt = now;
  console.log(`${m.line()} | generator cpu ${(cpu * 100).toFixed(0)}%`);
}, 10_000);

for (let i = 0; i < players; i++) {
  const due = t0 + (rampS * 1000 * i) / Math.max(1, players);
  const wait = due - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  runs.push(new FakePlayer(opts, m).run().catch((e) => m.error(`player crashed: ${String(e)}`)));
}
const deadline = new Promise((r) => setTimeout(r, Math.max(0, untilS * 1000 - (Date.now() - t0))));
await (untilS ? Promise.race([Promise.all(runs), deadline]) : Promise.all(runs));
clearInterval(progress);
const server = await stats();
console.log(m.line());

const minutes = (Date.now() - t0) / 60_000;
const out = { base, players, rampS, opts: { ...opts, headers: undefined }, generatorCpuMax, minutes, ...m.json(), server };
if (name) {
  mkdirSync("reports/load", { recursive: true });
  writeFileSync(`reports/load/${name}.json`, JSON.stringify(out, null, 2));
  const d1 = server?.d1 ?? {};
  const lines = [
    `# Load test: ${name}`,
    "",
    `${new Date(t0).toISOString()} · ${base} · ${players} players over ${rampS} s · ${opts.mode} · session ${opts.maxSessionMs ? `${opts.maxSessionMs / 1000} s` : "to the results"} · ${minutes.toFixed(1)} min`,
    `Generator CPU peak (one Node process): ${(generatorCpuMax * 100).toFixed(0)}%`,
    "",
    "## Players",
    "",
    m.table(),
    "",
    "Counts: " + [...m.counts].map(([k, v]) => `${k} ${v}`).join(" · "),
    "",
    "Errors: " + ([...m.errors].map(([k, v]) => `${k} (${v})`).join(" · ") || "none"),
    "",
  ];
  if (server) {
    const perPlayerMin = (n: number) => (n / players / minutes).toFixed(2);
    lines.push(
      "## Server counters",
      "",
      `D1 statements: ${server.d1Reads} reads, ${server.d1Writes} writes (${perPlayerMin(server.d1Writes)} writes per player per minute; ${(server.d1Writes / (minutes * 60)).toFixed(1)} writes/s)`,
      "",
      "| D1 statement | count | per player per min |",
      "| --- | ---: | ---: |",
      ...Object.entries(d1 as Record<string, number>)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `| ${k} | ${v} | ${perPlayerMin(v)} |`),
      "",
      "| Route | requests | mean ms |",
      "| --- | ---: | ---: |",
      ...Object.entries(server.routes as Record<string, { n: number; ms: number }>)
        .sort((a, b) => b[1].n - a[1].n)
        .map(([k, v]) => `| ${k} | ${v.n} | ${(v.ms / v.n).toFixed(1)} |`),
      "",
      "Calls: " + Object.entries(server.calls as Record<string, number>).map(([k, v]) => `${k} ${v}`).join(" · "),
      "",
    );
  }
  writeFileSync(`reports/load/${name}.md`, lines.join("\n"));
  console.log(`wrote reports/load/${name}.md`);
}
process.exit(0);
