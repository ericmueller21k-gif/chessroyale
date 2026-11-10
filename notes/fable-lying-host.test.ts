import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { legalMoves, type BoardScore, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";
import { library } from "./lobby-fixture.ts";

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

describe("review: a lying host", () => {
  it("a raid's host makes the boss throw the game, and the server plays every move it sends", () => {
    const L = setup({ ...RAID_SETTINGS, raidOpening: true });
    L.core.connect(undefined, "Cheat", "computer", false, 1500);
    L.core.connect(undefined, "Friend", "phone", false, 1500);
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    L.advance(60_000);
    let bossMoves = 0, accepted = 0, crowdMoves = 0;
    for (let i = 0; i < 400 && L.core.record.phase !== "results"; i++) {
      const phase = L.core.record.phase;
      if (phase === "boss") {
        const req = L.last("p1", "bossRequest");
        if (req) {
          const allowed = req.allowed ?? legalMoves(req.fen);
          // The worst move for the boss: the one after which the crowd can win the most at once.
          let worst = { move: allowed[0]!, v: -1 };
          for (const m of allowed) {
            let after: Chess;
            try { after = play(req.fen, m); } catch { continue; }
            const v = gain(after.fen(), legalMoves(after.fen())).v;
            if (v > worst.v) worst = { move: m, v };
          }
          L.core.message("p1", { t: "bossMove", key: req.key, move: worst.move });
          L.drop("p1", "bossRequest");
          bossMoves++;
          const b = L.last("p1", "boss");
          if (b?.boss.lastMove && JSON.stringify(b.boss.lastMove).includes(worst.move.slice(2, 4))) accepted++;
        }
      } else if (phase === "play") {
        const r = L.last("p1", "round");
        if (r?.board && !L.core.record.round?.picks.p1) {
          const ok = r.boss?.powers?.allowed ?? legalMoves(r.board.fen);
          const pick = gain(r.board.fen, ok).move;
          for (const id of ["p1", "p2"]) L.core.message(id, { t: "pick", key: L.last(id, "round")!.key, move: pick });
          crowdMoves++;
        }
      } else if (phase === "scoring") {
        const req = L.last("p1", "scoreRequest");
        if (req) {
          // The host scores nothing but a made-up best: its own pick is left out, so it "counts as the best".
          const boards: BoardScore[] = req.jobs.map((j) => ({ boardId: j.boardId, bestMove: Object.values(j.humanPicks).find(Boolean) ?? legalMoves(j.fen)[0]!, bestExpected: 0.99, expectedAfter: {}, botPicks: {}, botThinkMs: {} }));
          L.core.message("p1", { t: "scores", key: req.key, boards });
          const rv = L.last("p1", "reveal"); if (rv) console.log("reveal", JSON.stringify(rv.picks), rv.bestMove, rv.playedMove);
          L.drop("p1", "scoreRequest");
        }
      }
      L.advance(5_000);
    }
    const rec = L.core.record;
    const results = L.core.humanResults();
    console.log(JSON.stringify({ phase: rec.phase, bossMoves, accepted, crowdMoves, results: results.map((r) => ({ id: r.playerId, placement: r.placement, teamWon: r.teamWon, avgScore: r.avgScore })) }));
    expect(rec.phase).toBe("results");
    expect(results.every((r) => r.teamWon === true)).toBe(true);
  });
});
