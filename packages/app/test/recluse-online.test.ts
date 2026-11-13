import { describe, expect, it } from "vitest";
import { RECLUSE_ONLINE, RECLUSE_PHASE2 } from "@chessroyale/core";
import { chess960Fen, legalMoves, type ClientMessage, type NetPhase2 } from "@chessroyale/chess";
import { PHASE_CHANGE } from "../src/recluse-phase2.ts";
import { OnlinePhase2 } from "../src/recluse-online.ts";
import { NetMatch } from "../src/net.ts";
import type { Phase } from "../src/game.ts";

/**
 * The Hidden Boss's phase 2 online on this device (recluse-online.ts; the server's: packages/server/src/bosses/recluse.ts): the
 * server times his phase change by RECLUSE_ONLINE.changeMs, which must match the screens' own timeline; the view puts your board
 * first, in this device's times; your move shows at once.
 */

describe("his phase change online: the server's length is the screens'", () => {
  it("RECLUSE_ONLINE.changeMs is PHASE_CHANGE.total (within 300 ms), and the fall the server holds is PHASE_CHANGE.fallMs", () => {
    expect(Math.abs(PHASE_CHANGE.total - RECLUSE_ONLINE.changeMs)).toBeLessThanOrEqual(300);
    expect(PHASE_CHANGE.fallMs).toBe(RECLUSE_PHASE2.change.fallMs);
    expect(PHASE_CHANGE.countdownMs).toBe(RECLUSE_PHASE2.change.countdownSeconds * 1000);
  });
});

/** Phase 2 as the server sends it: you (`me`) on board 2, bots on the others; the clocks from `clocksAt`. */
function serverView(now: number, me: string, o: Partial<NetPhase2> = {}): NetPhase2 {
  return {
    key: "p2-1",
    cutAt: now - 40_000,
    at: now - 40_000,
    clocksAt: now - 1000,
    from: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    boards: [0, 1, 2, 3].map((id) => {
      const fen = chess960Fen(100 + id);
      return { id, player: id === 2 ? me : `b${id}`, name: id === 2 ? "Me" : `Bot ${id}`, number: 100 + id, fen, lastMove: null, history: [], bases: [{ ply: 0, fen }], bankMs: 120_000, turnAt: now - 1000, result: null };
    }),
    slow: 0,
    lastSlow: null,
    ultAt: null,
    ...o,
  };
}

function device(offset = 5000) {
  let phase: Phase = { kind: "loading" };
  const sent: ClientMessage[] = [];
  let looks = 0;
  const g = new OnlinePhase2({
    myId: () => "me",
    // (The server's clock runs 5 s ahead of this device's.)
    local: (t) => t - offset,
    phase: () => phase,
    setPhase: (p) => (phase = p),
    emit: () => undefined,
    send: (m) => void sent.push(m),
    turnBegins: () => void looks++,
    turnEnds: () => 3,
  });
  return { g, sent, phase: () => phase, looks: () => looks };
}

describe("phase 2 online on this device", () => {
  it("the boards: yours first (\"You\"), every time this device's; the phase at the server's moments", () => {
    const D = device();
    const now = Date.now() + 5000;
    D.g.onMessage(serverView(now, "me"));
    expect(D.phase()).toMatchObject({ kind: "simul", at: now - 1000 - 5000 });
    const v = D.g.view()!;
    expect(v.playing).toBe(true);
    expect(v.boards[0]).toMatchObject({ id: 2, you: true, name: "You", toMove: "crowd", turnAt: now - 1000 - 5000 });
    expect(v.boards.slice(1).every((b) => !b.you)).toBe(true);
    expect(D.g.note()).toBe("0 of 4 won");
    expect(D.g.onBoard).toBe(true);
    // (Your board's turn began: look-aways count from it, once.)
    expect(D.looks()).toBe(1);
    D.g.dispose();
  });

  it("his phase change from the server's `at`, the boards and their countdown before `clocksAt`", () => {
    const D = device();
    const now = Date.now() + 5000;
    D.g.onMessage(serverView(now, "me", { at: now - 1000, clocksAt: now - 1000 + RECLUSE_ONLINE.changeMs + 5000 }));
    expect(D.phase()).toMatchObject({ kind: "phaseChange", at: now - 1000 - 5000, splitAt: now - 1000 - 5000 + PHASE_CHANGE.crackAt });
    expect(D.g.view()!.playing).toBe(false);
    expect(D.g.view()!.boards[0]!.toMove).toBeNull();
    expect(D.g.note()).toBe("");
    D.g.dispose();
  });

  it("your move: sent with its key and look-aways, shown at once; only yours, on your move", () => {
    const D = device();
    const now = Date.now() + 5000;
    const p = serverView(now, "me");
    D.g.onMessage(p);
    const fen = p.boards[2]!.fen;
    const move = legalMoves(fen)[0]!;
    D.g.move(0, legalMoves(p.boards[0]!.fen)[0]!);
    expect(D.sent).toHaveLength(0);
    D.g.move(2, move);
    expect(D.sent).toEqual([{ t: "phase2Move", key: "p2-1", board: 2, move, ply: 0, away: 3 }]);
    const mine = D.g.view()!.boards[0]!;
    expect(mine.history).toEqual([move]);
    expect(mine.toMove).toBe("boss");
    expect(mine.turnAt).toBeNull();
    D.g.dispose();
  });

  it("your move stays shown over the server's word until it has it (another board's move before it doesn't put your piece back); a refusal drops it; back after a dropped connection, it's sent again", () => {
    const D = device();
    const now = Date.now() + 5000;
    const p = serverView(now, "me");
    D.g.onMessage(p);
    const fen = p.boards[2]!.fen;
    const move = legalMoves(fen)[0]!;
    D.g.move(2, move);
    // (A word the server sent before it got your move: a bot moved on board 0. Yours stays shown, and you can't move again.)
    const bot = legalMoves(p.boards[0]!.fen)[0]!;
    const other = { ...p, boards: p.boards.map((b) => (b.id === 0 ? { ...b, history: [bot], lastMove: bot } : b)) };
    D.g.onMessage(other);
    expect(D.g.view()!.boards[0]).toMatchObject({ id: 2, history: [move], toMove: "boss" });
    expect(D.g.view()!.boards.find((b) => b.id === 0)!.history).toEqual([bot]);
    D.g.move(2, legalMoves(fen)[1]!);
    expect(D.sent).toHaveLength(1);
    // (The connection dropped and came back: sent again, with its ply, so the server refuses it if it has it already.)
    D.g.onWelcome();
    expect(D.sent[1]).toEqual({ t: "phase2Move", key: "p2-1", board: 2, move, ply: 0 });
    // The server's word with it (and his reply): its state from here.
    const reply = { ...p.boards[2]!, history: [move, "x"], lastMove: "x" };
    D.g.onMessage({ ...other, boards: other.boards.map((b) => (b.id === 2 ? reply : b)) });
    expect(D.g.view()!.boards[0]!.history).toEqual([move, "x"]);
    D.g.onWelcome();
    expect(D.sent).toHaveLength(2);
    // A refusal: the move shown goes back.
    const E = device();
    E.g.onMessage(p);
    E.g.move(2, move);
    E.g.onMessage(p, true);
    expect(E.g.view()!.boards[0]).toMatchObject({ history: [], toMove: "crowd" });
    D.g.dispose();
    E.g.dispose();
  });

  it("the cutscene's hold from the view (`cutAt` to `at`): a device back during it, which missed its event, still knows the scene", () => {
    const D = device();
    const now = Date.now() + 5000;
    D.g.onMessage(serverView(now, "me", { cutAt: now - 1000, at: now + 9000, clocksAt: now + 9000 + RECLUSE_ONLINE.changeMs + 5000 }));
    expect(D.g.cutscene).toEqual({ at: now - 1000 - 5000, until: now + 9000 - 5000 });
    D.g.dispose();
    // (A reload into it (the review of #679, M1): the page starts on "loading"; the view brings it to his fall's screen, the scene
    // over it drawn from its moment, not "Connecting…" until his phase change. Who takes the boards: the view's.)
    const m = new NetMatch("TEST", "Ann", async () => []);
    const tell = (msg: object) => (m as unknown as { onMessage(x: object): void }).onMessage({ now: Date.now(), ...msg });
    tell({ t: "welcome", playerId: "me", token: "t", code: "TEST" });
    expect(m.phase.kind).not.toBe("boss");
    const t = Date.now();
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const boss = { id: "recluse", name: "Hidden Boss", result: "crowd", lastMove: "e2e4", board: { id: 0, fen, lastMove: "e2e4", ply: 9 } };
    tell({ t: "phase2", p2: serverView(t, "me", { cutAt: t - 20_000, at: t + 80_000, clocksAt: t + 80_000 + RECLUSE_ONLINE.changeMs + 5000 }), boss, standings: [{ id: "me", name: "Ann", out: true }] });
    expect(m.phase).toMatchObject({ kind: "boss", fall: true, toPhase2: true, boss: { id: "recluse" } });
    expect(m.cutscene!.until - m.cutscene!.at).toBe(100_000);
    expect(m.exit).toBe("resign");
    (m as unknown as { phase2: { dispose(): void } }).phase2.dispose();
  });

  it("a Crowd final's watcher: no board is yours, and leaving isn't resigning a board", () => {
    const D = device();
    const now = Date.now() + 5000;
    D.g.onMessage(serverView(now, "someone else"));
    expect(D.g.view()!.boards.every((b) => !b.you)).toBe(true);
    expect(D.g.onBoard).toBe(false);
    D.g.dispose();
  });
});

describe("his fall online says who takes the boards (the review of #677, m3)", () => {
  /** A match told your id, then his fall with his phase change to follow: `boards` take the four boards; you're out in the standings. */
  function fallen(boards: string[]) {
    const m = new NetMatch("TEST", "Ann", async () => []);
    const tell = (msg: object) => (m as unknown as { onMessage(x: object): void }).onMessage({ now: Date.now(), ...msg });
    tell({ t: "welcome", playerId: "me", token: "t", code: "TEST" });
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    tell({
      t: "boss",
      boss: { id: "recluse", name: "Hidden Boss", result: "crowd", lastMove: "e2e4", board: { id: 0, fen, lastMove: "e2e4", ply: 9 } },
      standings: [{ id: "me", name: "Ann", out: true }],
      until: Date.now() + 1800,
      fall: true,
      toPhase2: true,
      phase2Boards: boards,
    });
    return m;
  }

  it("on a board: leaving from his fall on is resigning it (a loss; a bot plays it on), in a Crowd final as in his room", () => {
    const m = fallen(["p1", "me", "p3", "b4"]);
    expect(m.exit).toBe("resign");
    expect(m.seatToBot).toBe(true);
  });

  it("a watcher (out, no board): leaving is going home, the result standing", () => {
    const m = fallen(["p1", "p2", "p3", "b4"]);
    expect(m.exit).toBe("leave");
  });
});
