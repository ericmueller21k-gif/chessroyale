import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { legalMoves, type BoardScore, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";
import { library } from "./lobby-fixture.ts";
import { vi } from "vitest";
import { createGuest, ensureSchema, signInWithIdentity } from "../src/accounts.ts";
import { memoryDb } from "./memory-db.ts";
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));
import { Lobby } from "../src/lobby-do.ts";

type Msg = ServerMessage;
const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const play = (fen: string, uci: string) => {
  const c = new Chess(fen);
  c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return c;
};
/** What the side to move can win at once: mate = 100, else the best capture's value. */
const gain = (fen: string, moves: string[]) => {
  let best = { move: moves[0]!, v: -1 };
  for (const m of moves) {
    const before = new Chess(fen);
    const cap = before.get(m.slice(2, 4) as never);
    let v = cap ? VAL[cap.type]! : 0;
    try { if (play(fen, m).isCheckmate()) v = 100; } catch { continue; }
    if (v > best.v) best = { move: m, v };
  }
  return best;
};

function setup(settings: Partial<Settings>) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const core = new LobbyCore(newLobbyRecord("ABCDE", now), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]) }, library, mulberry32(7), { ...DEFAULT_SETTINGS, boardIntroSeconds: 0, ...settings });
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const drop = (id: string, t: Msg["t"]) => inbox.set(id, (inbox.get(id) ?? []).filter((m) => m.t !== t));
  const advance = (ms: number) => { now += ms; if (core.nextAlarm && core.nextAlarm <= now) core.alarm(); };
  return { core, last, drop, advance, inbox };
}


describe("review: match-end saves", () => {
  for (const N of [2, 10]) it(`counts D1 calls for ${N} signed-in players at a raid's end`, async () => {
    const L = setup({ ...RAID_SETTINGS, raidOpening: true });
    const ids = Array.from({ length: N }, (_, i) => `p${i + 1}`);
    ids.forEach((_, i) => L.core.connect(undefined, `P${i + 1}`, i ? "phone" : "computer", false, 1500));
    L.core.message("p1", { t: "start" });
    L.advance(1000); L.advance(60_000);
    for (let i = 0; i < 600 && L.core.record.phase !== "results"; i++) {
      const phase = L.core.record.phase;
      if (phase === "boss") {
        const req = L.last("p1", "bossRequest");
        if (req) {
          const allowed = req.allowed ?? legalMoves(req.fen);
          let worst = { move: allowed[0]!, v: -1 };
          for (const m of allowed) { let a: Chess; try { a = play(req.fen, m); } catch { continue; } const v = gain(a.fen(), legalMoves(a.fen())).v; if (v > worst.v) worst = { move: m, v }; }
          L.core.message("p1", { t: "bossMove", key: req.key, move: worst.move }); L.drop("p1", "bossRequest");
        }
      } else if (phase === "play") {
        const r = L.last("p1", "round");
        if (r?.board && !L.core.record.round?.picks.p1) {
          const ok = r.boss?.powers?.allowed ?? legalMoves(r.board.fen);
          const pick = gain(r.board.fen, ok).move;
          for (const id of ids) { const rr = L.last(id, "round"); if (rr) L.core.message(id, { t: "pick", key: rr.key, move: pick }); }
        }
      } else if (phase === "scoring") {
        const req = L.last("p1", "scoreRequest");
        if (req) {
          const boards: BoardScore[] = req.jobs.map((j) => { const legal = legalMoves(j.fen); return { boardId: j.boardId, bestMove: legal[0]!, bestExpected: 0.6, expectedAfter: Object.fromEntries(legal.map((m) => [m, 0.5])), botPicks: {}, botThinkMs: {} }; });
          L.core.message("p1", { t: "scores", key: req.key, boards }); L.drop("p1", "scoreRequest");
        }
      }
      L.advance(20_000);
    }
    expect(L.core.record.phase).toBe("results");
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql);
    const rec = L.core.record;
    rec.accounts = {};
    for (const id of ids) { const g = await createGuest(sql, Date.now(), id); rec.accounts[id] = (await signInWithIdentity(sql, g.user, "email", `${id}@example.com`, {}, Date.now())).id; }
    let calls = 0, batches = 0, inBatch = 0; const kinds: Record<string, number> = {};
    const real = d1 as unknown as { prepare(q: string): any; batch(s: any[]): Promise<any> };
    const wrap = (q: string, st: any): any => ({ bind: (...p: unknown[]) => wrap(q, st.bind(...p)), run: async () => { calls++; kinds[q.trim().slice(0, 28)] = (kinds[q.trim().slice(0, 28)] ?? 0) + 1; return st.run(); }, first: async () => { calls++; kinds[q.trim().slice(0, 28)] = (kinds[q.trim().slice(0, 28)] ?? 0) + 1; return st.first(); }, all: async () => { calls++; kinds[q.trim().slice(0, 28)] = (kinds[q.trim().slice(0, 28)] ?? 0) + 1; return st.all(); }, _raw: st });
    const counting = { prepare: (q: string) => wrap(q, real.prepare(q)), batch: async (s: any[]) => { batches++; inBatch += s.length; return real.batch(s.map((x) => x._raw ?? x)); } };
    const ctx = { storage: { get: async () => undefined, list: async () => new Map(), put: async () => undefined, setAlarm: async () => undefined, deleteAlarm: async () => undefined, deleteAll: async () => undefined }, getWebSockets: () => [], acceptWebSocket: () => undefined, waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined), blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn() };
    const lobby = new Lobby(ctx as never, { DB: counting, RESEND_API_KEY: "x" } as never) as any;
    lobby.record = rec;
    const t = performance.now();
    await lobby.saveResults(L.core, rec);
    const rows = (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM results"))!.n;
    console.log(JSON.stringify({ N, calls, batches, inBatch, perPlayer: +((calls + batches) / N).toFixed(1), rows, ms: Math.round(performance.now() - t) }));
    if (N === 2) console.log(JSON.stringify(Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 25)));
    // again, as after a restart that lost `resultsSaved`
    rec.resultsSaved = false;
    await lobby.saveResults(L.core, rec);
    console.log("rows after a second save (restart before resultsSaved was stored):", (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM results"))!.n);
  });
});
