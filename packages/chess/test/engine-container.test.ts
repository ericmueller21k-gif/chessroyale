import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { START_FEN, legalMoves, pieceAt, stockfishRefuses } from "../src/index.ts";
import { CASES } from "./stockfish-refuses-cases.ts";

/**
 * The engine server's own Stockfish (engine/Dockerfile), through its real HTTP interface (engine/server.mjs): every
 * case of `stockfish-refuses-cases.ts` that `stockfishRefuses` lets through is searched, and the server answers on
 * after it; what the container does with each case it turns away (never sent in the game) is reported. Plus one search
 * as the game asks for it. Runs only where the image is built (`ENGINE_IMAGE`: .github/workflows/engine-container.yml);
 * skipped everywhere else.
 */
const IMAGE = process.env.ENGINE_IMAGE;
const PORT = Number(process.env.ENGINE_PORT ?? 18080);
const NAME = "hunchess-engine-check";
/** Each case's search: deep enough to reach castling and en passant in its tree, quick enough for ~50 cases. */
const CASE_NODES = 200_000;

type Line = { move: string; expected: number };
type Outcome =
  | { kind: "searched"; moves: Line[]; ms: number }
  | { kind: "turned away"; status: number }
  | { kind: "died"; how: string }
  | { kind: "hung" }
  | { kind: "broke"; why: string };

const docker = (...args: string[]) => {
  const r = spawnSync("docker", args, { encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
};
const running = () => docker("inspect", "-f", "{{.State.Running}}", NAME).out === "true";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function start(): Promise<void> {
  docker("rm", "-f", NAME);
  const run = docker("run", "-d", "--name", NAME, "-p", `127.0.0.1:${PORT}:8080`, IMAGE!);
  if (!run.ok) throw new Error(`docker run failed: ${run.out}`);
  for (let t = Date.now(); Date.now() - t < 30_000; await sleep(100)) {
    if (docker("logs", NAME).out.includes("engine server ready")) return;
  }
  throw new Error(`the engine server didn't start: ${docker("logs", NAME).out}`);
}

type Reply = { status: number; body: { moves?: Line[]; ms?: number } } | { error: string };

async function post(fen: string, moves: readonly string[], nodes: number, timeoutMs: number): Promise<Reply> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/score`, {
      method: "POST",
      body: JSON.stringify({ fen, moves, nodes }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: res.status, body: (await res.json()) as { moves?: Line[]; ms?: number } };
  } catch (e) {
    return { error: String(e) };
  }
}

/** One search, and what became of the server: still answering (a quick search of the start), down, or stuck. */
async function search(fen: string, moves: readonly string[], nodes: number, timeoutMs = 30_000): Promise<Outcome> {
  const r = await post(fen, moves, nodes, timeoutMs);
  if ("status" in r && r.status !== 200) return { kind: "turned away", status: r.status };
  if ("status" in r) {
    const after = await post(START_FEN, ["e2e4", "d2d4"], 10_000, 10_000);
    if ("status" in after && after.status === 200 && after.body.moves?.length === 2) return { kind: "searched", moves: r.body.moves ?? [], ms: r.body.ms ?? 0 };
    const why = "status" in after ? `then answered ${after.status} ${JSON.stringify(after.body)}` : `then ${after.error}`;
    await start();
    return { kind: "broke", why };
  }
  for (let t = Date.now(); Date.now() - t < 5000 && running(); ) await sleep(100);
  if (running()) {
    await start();
    return { kind: "hung" };
  }
  const how = /stockfish exited \(([^)]*)\)/.exec(docker("logs", NAME).out)?.[1] ?? "no exit line";
  await start();
  return { kind: "died", how: `stockfish exited (${how})` };
}

/** The moves a case sends, as the game would (its legal moves, at most 8, the king's first: castling's in them). */
function movesFor(fen: string): string[] {
  try {
    const all = legalMoves(fen);
    const king = all.filter((m) => pieceAt(fen, m.slice(0, 2))?.type === "k");
    const moves = [...king, ...all.filter((m) => !king.includes(m))].slice(0, 8);
    if (moves.length) return moves;
  } catch {
    // (A position our rules can't read: any move in the right shape does, the engine ignores one it can't play.)
  }
  return ["e1e2", "e8e7"];
}

function show(o: Outcome): string {
  switch (o.kind) {
    case "searched":
      return `searched (${o.moves.map((m) => `${m.move} ${m.expected.toFixed(3)}`).join(", ")})`;
    case "turned away":
      return `turned away (${o.status})`;
    case "died":
      return `died: ${o.how}`;
    case "broke":
      return `broke: ${o.why}`;
    case "hung":
      return "hung (no answer in 30 s, still running)";
  }
}

describe.skipIf(!IMAGE)("the engine server's own Stockfish, in its container, over HTTP", () => {
  beforeAll(start, 60_000);
  afterAll(() => void docker("rm", "-f", NAME));

  it("searches every case stockfishRefuses lets through and answers on after it (and reports the rest)", async () => {
    const rows: string[] = [];
    const broken: string[] = [];
    for (const [name, c] of Object.entries(CASES)) {
      const refused = stockfishRefuses(c.fen);
      const moves = movesFor(c.fen);
      const o = await search(c.fen, moves, CASE_NODES);
      const fine = o.kind === "searched" && o.moves.length > 0 && o.moves.every((m) => moves.includes(m.move) && m.expected >= 0 && m.expected <= 1);
      if (!refused && !fine) broken.push(`${name}: ${show(o)}`);
      rows.push(`| ${name} | \`${c.fen}\` | ${refused ?? "sent"} | ${(c.sf19 ?? c.refused) ? "refuses" : "plays"} | ${show(o)} |`);
    }
    const table = ["| Case | FEN | stockfishRefuses | Stockfish 19 | The container |", "| --- | --- | --- | --- | --- |", ...rows].join("\n");
    console.log(table);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## The engine server's Stockfish on each case\n\n${table}\n\n`);
    expect(broken, "positions stockfishRefuses lets through that the container's Stockfish doesn't search").toEqual([]);
  }, 600_000);

  it("searches a normal position as the game asks (the server's re-check: 2M nodes, 4 moves) inside the Worker's 12 s", async () => {
    const fen = "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 6";
    const moves = ["c1g5", "a2a3", "h2h3", "c3a4"];
    // (SERVER_RECHECK_NODES in packages/server/src/engine.ts; its fetch gives up after 12 s, TIMEOUT_MS.)
    const o = await search(fen, moves, 2_000_000);
    console.log(`normal search: ${show(o)}${o.kind === "searched" ? `, ${o.ms} ms` : ""}`);
    if (process.env.GITHUB_STEP_SUMMARY && o.kind === "searched") appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Normal search (2M nodes, 4 moves): ${o.ms} ms. ${show(o)}\n\n`);
    expect(o.kind).toBe("searched");
    if (o.kind !== "searched") return;
    expect(o.moves.map((m) => m.move).sort()).toEqual([...moves].sort());
    for (const m of o.moves) {
      expect(m.expected).toBeGreaterThan(0.2);
      expect(m.expected).toBeLessThan(0.8);
    }
    expect(o.ms).toBeLessThan(12_000);
  }, 60_000);
});
