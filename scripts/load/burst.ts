/**
 * The matchmaker alone: N guests press PLAY at the same moment (no WebSockets), and we time every answer. Shows how
 * many PLAY presses a second one queue gets through, and whether any lobby is promised to more than its seats.
 *
 *   npx tsx scripts/load/burst.ts --url http://localhost:8787 --players 1000 [--name NAME] [--ops-key KEY]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Metrics } from "./metrics.ts";

const args = process.argv.slice(2);
const arg = (k: string, d?: string) => {
  const i = args.indexOf(`--${k}`);
  return i < 0 ? d : (args[i + 1] ?? d);
};
const base = (arg("url", "http://localhost:8787") as string).replace(/\/$/, "");
if (/hunchess\.com/i.test(base)) throw new Error("Never load-test production.");
const n = Number(arg("players", "1000"));
const name = arg("name");
const opsKey = arg("ops-key");
const pool = `burst${Date.now().toString(36)}`;
const m = new Metrics();

// Guests first (50 at a time), so the burst is PLAY only.
const cookies: string[] = [];
for (let i = 0; i < n; i += 50) {
  await Promise.all(
    Array.from({ length: Math.min(50, n - i) }, async () => {
      const res = await fetch(`${base}/api/me?name=Burst`);
      const c = res.headers.get("set-cookie")?.match(/hc_session=([^;]+)/)?.[1];
      await res.arrayBuffer();
      if (c) cookies.push(`hc_session=${c}`);
    }),
  );
}
if (opsKey) await fetch(`${base}/api/ops/stats?reset=1`, { headers: { "x-ops-key": opsKey } });
const t0 = performance.now();
const codes = new Map<string, number>();
let busy = 0;
await Promise.all(
  cookies.map(async (cookie) => {
    const t = performance.now();
    try {
      const res = await fetch(`${base}/api/play?pool=${pool}`, { method: "POST", headers: { cookie }, signal: AbortSignal.timeout(120_000) });
      const body = (await res.json()) as { code?: string; busy?: boolean };
      m.time("play", performance.now() - t);
      if (body.code) codes.set(body.code, (codes.get(body.code) ?? 0) + 1);
      else if (body.busy) busy++;
      else m.error(`play ${res.status}`);
    } catch (e) {
      m.error(`play ${(e as Error).name}`);
    }
  }),
);
const secs = (performance.now() - t0) / 1000;
const server = opsKey ? await (await fetch(`${base}/api/ops/stats`, { headers: { "x-ops-key": opsKey } })).json() : null;
const sizes = [...codes.values()].sort((a, b) => b - a);
const summary = [
  `# Matchmaker burst: ${name ?? ""}`,
  "",
  `${new Date().toISOString()} · ${base} · ${cookies.length} PLAY presses at once`,
  "",
  `All answered in ${secs.toFixed(1)} s: ${(cookies.length / secs).toFixed(0)} PLAY presses a second. Seated ${sizes.reduce((a, b) => a + b, 0)} in ${sizes.length} lobbies (largest ${sizes[0] ?? 0}${sizes[0] && sizes[0] > 100 ? ", MORE THAN ITS 100 SEATS" : ""}); told busy ${busy}.`,
  "",
  m.table(),
  "",
  "Errors: " + ([...m.errors].map(([k, v]) => `${k} (${v})`).join(" · ") || "none"),
  "",
  server ? "Server calls: " + Object.entries(server.calls as Record<string, number>).map(([k, v]) => `${k} ${v}`).join(" · ") : "",
  "",
].join("\n");
console.log(summary);
if (name) {
  mkdirSync("reports/load", { recursive: true });
  writeFileSync(`reports/load/${name}.md`, summary);
}
