/**
 * A Squads lobby end to end through a real server (wrangler dev; never production), headless: real WebSockets, the
 * real matchmaker, parties and lobby objects, every match played in real time. Reports the wall time.
 *
 *   npx tsx scripts/squads-headless.ts --url http://localhost:8787 [options]
 *
 * Options:
 *   --mode queue|party|test   how the people get in: PLAY alone (default), a party, or a test lobby (needs SQUADS_TEST=1)
 *   --people N                people (default 1; a party's size with --mode party, at most 4)
 *   --start relay|pairs|final a test lobby's first round
 *   --clock B,T,F,I            a test lobby's team clock: bank, top-up, free seconds, increment (seconds)
 *   --play                    the people play their own duties (the engine's best, or a random legal move); else they
 *                             sit idle and a bot takes each seat after its third miss (a full bot lobby)
 *   --device                  each person's client answers bot work with Node's Stockfish, as a phone or computer would
 *   --nodes N                 the device engine's nodes (default 250000, the app's)
 *   --pool NAME               the queue's pool (default: a fresh one, so runs never meet)
 *   --out FILE                also write the report (Markdown) there
 *   --timeout S               give up after this long (default 7200: a bot lobby can run over an hour)
 */
import { writeFileSync } from "node:fs";
import { createNodeEngine } from "@chessroyale/chess/node";
import { DEFAULT_SETTINGS } from "@chessroyale/core";
import { PartyClient, SquadsClient, guestCookie, me, type TopEngine } from "../e2e/squads-client.ts";

const args = process.argv.slice(2);
const arg = (k: string, d?: string) => {
  const i = args.indexOf(`--${k}`);
  if (i < 0) return d;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : "1";
};
const base = (arg("url", "http://localhost:8787") as string).replace(/\/$/, "");
if (/hunchess\.com/i.test(base)) {
  console.error("Never run this against production. Use wrangler dev.");
  process.exit(1);
}
const mode = arg("mode", "queue") as "queue" | "party" | "test";
const people = Math.max(1, Math.min(mode === "party" ? 4 : 32, Number(arg("people", "1"))));
const pool = arg("pool", `sq${Date.now().toString(36)}`)!;
const timeoutMs = Number(arg("timeout", "7200")) * 1000;
const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1).padStart(7)} s`;
const log = (line: string) => console.log(`${stamp()}  ${line}`);

const engines: TopEngine[] = [];
if (arg("device")) {
  for (let i = 0; i < people; i++) engines.push(await createNodeEngine({ nodes: Number(arg("nodes", String(DEFAULT_SETTINGS.engineNodes))), hashMb: 16 }));
}

const cookies = await Promise.all(Array.from({ length: people }, () => guestCookie(base)));
const clients = Array.from({ length: people }, (_, i) => new SquadsClient({ base, name: `Head ${i + 1}`, play: !!arg("play"), engine: engines[i], cookie: cookies[i], nps: 900_000 }));

let code: string;
if (mode === "test") {
  const q = new URLSearchParams({ start: arg("start", "relay")!, ...(arg("clock") ? { clock: arg("clock")! } : {}), keep: "60" });
  const res = await fetch(`${base}/api/squads/lobby?${q}`, { method: "POST", headers: { cookie: cookies[0] ?? "" } });
  if (!res.ok) throw new Error(`test lobby: ${res.status} ${await res.text()}`);
  code = ((await res.json()) as { code: string }).code;
  for (const c of clients) await c.join(code);
} else if (mode === "party") {
  const res = await fetch(`${base}/api/squads/party?pool=${pool}`, { method: "POST", headers: { cookie: cookies[0] ?? "" } });
  const party = ((await res.json()) as { code: string }).code;
  const members = clients.map((_, i) => new PartyClient(base, `Head ${i + 1}`, cookies[i]));
  for (const m of members) await m.join(party);
  log(`party ${party}: ${members.length} in`);
  members[0]!.send({ t: "queue" });
  const deadline = Date.now() + 60_000;
  while (!members.every((m) => m.party?.placed) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
  const placed = members[0]!.party?.placed;
  if (!placed) throw new Error("the party was never placed");
  code = placed.lobby;
  for (let i = 0; i < clients.length; i++) await clients[i]!.join(code, members[i]!.party!.placed!.pass);
  for (const m of members) m.close();
} else {
  for (const c of clients) {
    let answer: { code?: string; ticket?: string; busy?: true; retryMs?: number } = {};
    for (let tries = 0; !answer.code && tries < 20; tries++) {
      const res = await fetch(`${base}/api/squads/play?pool=${pool}${answer.ticket ? `&ticket=${answer.ticket}` : ""}`, { method: "POST", headers: { cookie: c === clients[0] ? (cookies[0] ?? "") : (cookies[clients.indexOf(c)] ?? "") } });
      answer = (await res.json()) as typeof answer;
      if (!answer.code) await new Promise((r) => setTimeout(r, answer.retryMs ?? 1000));
    }
    if (!answer.code) throw new Error("no lobby from the queue");
    code = answer.code;
    await c.join(answer.code);
  }
}
log(`lobby ${code!}: ${people} ${people === 1 ? "person" : "people"} in (${mode}${arg("play") ? ", playing" : ", idle"}${arg("device") ? ", devices" : ""})`);

const watch = clients[0]!;
const marks: Record<string, number> = {};
const seen = new Set<string>();
const note = (k: string) => {
  if (seen.has(k)) return;
  seen.add(k);
  marks[k] = Date.now();
  log(k);
};
const tick = () => {
  const l = watch.lobby;
  if (!l) return;
  note(`phase ${l.phase}`);
  for (const bm of l.bracket) {
    if (bm.state === "playing") note(`${bm.key} (${bm.format}) playing`);
    if (bm.state === "over") note(`${bm.key} over${bm.points ? `: ${bm.points.join("-")} by ${bm.how}` : " (skipped: a test lobby)"}`);
  }
  for (const m of watch.matches.values()) {
    if (m.armageddon) note(`${m.key} Armageddon`);
    if (m.state === "half") note(`${m.key} (${m.format}) first half`);
    if (m.result && m.result.winner !== null) note(`${m.key} result: ${m.result.points.join("-")} by ${m.result.how}${m.result.timeLeft ? ` (time left ${m.result.timeLeft.map((t) => Math.round(t / 1000)).join(" v ")} s)` : ""}, boards ${m.boards.map((b) => `${b.ply} plies ${b.result?.reason ?? "-"}`).join(", ")}`);
  }
};
const poll = setInterval(tick, 250);

try {
  await watch.until(() => watch.lobby?.phase === "results" || watch.closed, timeoutMs, "the results");
} finally {
  tick();
  clearInterval(poll);
}
const filled = marks["phase filled"] ?? t0;
const ended = marks["phase results"] ?? Date.now();
const rewards = await Promise.all(clients.map((c, i) => (cookies[i] ? me(base, cookies[i]!).catch(() => null) : null)));
const lines = [
  `# Squads: a lobby through the real server`,
  "",
  `${new Date().toISOString()}, ${base}, mode ${mode}, ${people} ${people === 1 ? "person" : "people"}${arg("play") ? " playing" : " idle (bots take their seats)"}${arg("device") ? ", answering bot work with Node's Stockfish" : ", no devices (the server's quick look)"}.`,
  "",
  `- Wall time, filled to results: **${((ended - filled) / 60_000).toFixed(1)} minutes** (${Math.round((ended - filled) / 1000)} s); from the first PLAY: ${((ended - t0) / 60_000).toFixed(1)} minutes.`,
  ...Object.entries(marks).map(([k, t]) => `  - ${((t - filled) / 1000).toFixed(0).padStart(5)} s: ${k}`),
  `- Placements (squad: place): ${JSON.stringify(watch.results)}`,
  ...clients.map((c, i) => `- ${c.playerId}: placed ${c.placed?.placement ?? "-"}, reward ${c.placed ? `${c.placed.coins} coins, ${c.placed.crates} crates, recorded ${c.placed.recorded}` : "-"}; wallet now ${rewards[i]?.shop?.coins ?? "-"}; bot work answered ${c.stats.botWork}; moves chosen ${c.stats.chosen}, refused ${c.stats.refused}; ${c.stats.messages} messages, ${(c.stats.bytes / 1024).toFixed(0)} KB; errors: ${c.errors.join("; ") || "none"}`),
];
console.log(`\n${lines.join("\n")}`);
const out = arg("out");
if (out) writeFileSync(out, `${lines.join("\n")}\n`);
for (const c of clients) c.close();
for (const e of engines) (e as { close?: () => void }).close?.();
process.exit(watch.lobby?.phase === "results" ? 0 : 1);
