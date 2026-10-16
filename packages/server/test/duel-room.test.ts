import { describe, expect, it } from "vitest";
import { QUICK_CHAT, RANKED_1V1, rankView } from "@chessroyale/core";
import type { Color, DuelPlayerView } from "@chessroyale/chess/duel";
import { DuelCore, newDuelRecord, type DuelIO, type DuelOutgoing, type DuelRecord } from "../src/duel-room.ts";

/**
 * Ranked 1 v 1's room (duel-room.ts): the timeline around the rules, both players' views, every way a game ends,
 * leaving and coming back with the clock running, handing the game over to be recorded, and quick chat.
 */

const T0 = 1_800_000_000_000;
const VERSUS = RANKED_1V1.versusMs;
const VOTE = RANKED_1V1.voteSeconds * 1000;
const OVERLAY = RANKED_1V1.overlayMs;
const FIRST = RANKED_1V1.firstMoveSeconds * 1000;

const player = (uid: string, name: string): DuelPlayerView => ({ uid, name, look: null, rank: rankView(null) });

/** A room with a clock we move, sockets we open and close, and every message each side was sent. */
function room(opts: { testSeconds?: number } = {}) {
  let now = T0;
  const conn: Record<Color, boolean> = { w: false, b: false };
  const inbox: Record<Color, DuelOutgoing[]> = { w: [], b: [] };
  const io: DuelIO = {
    now: () => now,
    send: (c, msg) => void (conn[c] && inbox[c].push(msg)),
    connected: (c) => conn[c],
  };
  const record: DuelRecord = newDuelRecord("ABCDE", now, { w: player("uw", "Wendy"), b: player("ub", "Bo") }, opts);
  const core = () => new DuelCore(record, io);
  const at = (t: number) => {
    now = t;
    core().alarm();
  };
  const come = (c: Color) => {
    conn[c] = true;
    core().connect(c);
  };
  const go = (c: Color) => {
    conn[c] = false;
    core().disconnect(c);
  };
  const send = (c: Color, msg: Parameters<DuelCore["message"]>[1]) => core().message(c, msg);
  const last = <T extends DuelOutgoing["t"]>(c: Color, t: T) => inbox[c].filter((m) => m.t === t).at(-1) as Extract<DuelOutgoing, { t: T }> | undefined;
  return { record, core, at, come, go, send, inbox, last, now: () => now, set: (t: number) => void (now = t) };
}

/** Both connected at T0: the versus moment, then the vote at T0 + VERSUS. */
function started(opts: { testSeconds?: number } = {}) {
  const r = room(opts);
  r.come("w");
  r.come("b");
  return r;
}

/** In play: the vote closed with these picks, the overlay over. */
function playing(w: "bullet" | "blitz" | "rapid" | null = null, b: "bullet" | "blitz" | "rapid" | null = null, opts: { testSeconds?: number } = {}) {
  const r = started(opts);
  r.set(T0 + VERSUS + 100);
  if (w) r.send("w", { t: "pick", zone: w });
  if (b) r.send("b", { t: "pick", zone: b });
  r.at(T0 + VERSUS + VOTE);
  r.at(T0 + VERSUS + VOTE + OVERLAY);
  expect(r.core().phase()).toBe("play");
  return r;
}

describe("1 v 1's room: the timeline", () => {
  it("waiting → versus (both here) → vote → overlay → play; both see each phase", () => {
    const r = room();
    r.come("w");
    expect(r.last("w", "welcome")).toMatchObject({ you: "w", game: { phase: "waiting", players: { w: { name: "Wendy" }, b: { name: "Bo" } } } });
    expect(r.core().nextAlarm).toBe(T0 + RANKED_1V1.joinSeconds * 1000);
    r.set(T0 + 3000);
    r.come("b");
    expect(r.last("b", "game")?.game).toMatchObject({ phase: "versus", versusAt: T0 + 3000, voteAt: T0 + 3000 + VERSUS });
    expect(r.last("w", "game")?.game.phase).toBe("versus");
    // A pick during the versus moment doesn't count.
    r.send("w", { t: "pick", zone: "bullet" });
    expect(r.record.game!.picks.w).toBeNull();
    r.set(T0 + 3000 + VERSUS);
    expect(r.core().phase()).toBe("vote");
    r.send("w", { t: "pick", zone: "bullet" });
    r.send("b", { t: "pick", zone: "rapid" });
    expect(r.last("b", "picks")?.picks).toEqual({ w: "bullet", b: "rapid" });
    expect(r.core().nextAlarm).toBe(T0 + 3000 + VERSUS + VOTE);
    r.at(T0 + 3000 + VERSUS + VOTE);
    expect(r.last("w", "game")?.game).toMatchObject({ phase: "overlay", control: "blitz", clock: { baseSeconds: 180, incrementSeconds: 2 } });
    r.at(T0 + 3000 + VERSUS + VOTE + OVERLAY);
    expect(r.last("b", "game")?.game).toMatchObject({ phase: "play", firstMoveBy: T0 + 3000 + VERSUS + VOTE + OVERLAY + FIRST });
  });

  it("nobody, or only one, turned up: called off at the join time, nothing to record, closing later", () => {
    const one = room();
    one.come("w");
    one.at(T0 + RANKED_1V1.joinSeconds * 1000);
    expect(one.last("w", "game")?.game.end).toMatchObject({ result: "aborted", reason: "no_show", by: "b" });
    expect(one.core().takeFinished()).toBeNull();
    expect(one.record.closeAt).toBe(T0 + RANKED_1V1.joinSeconds * 1000 + RANKED_1V1.resultsKeepMinutes * 60_000);
    const none = room();
    none.at(T0 + RANKED_1V1.joinSeconds * 1000);
    expect(none.core().end).toMatchObject({ reason: "no_show", by: null });
  });

  it("a first move that doesn't come aborts the game: no result to record", () => {
    const r = playing();
    const start = r.record.game!.startsAt!;
    expect(r.core().nextAlarm).toBe(start + FIRST);
    r.at(start + FIRST);
    expect(r.last("w", "game")?.game.end).toMatchObject({ result: "aborted", reason: "no_first_move", by: "w" });
    expect(r.core().takeFinished()).toBeNull();
  });

  it("Abort (resign before both first moves): in the versus moment, the vote, or after White's first move", () => {
    const early = started();
    early.send("b", { t: "resign" });
    expect(early.core().end).toMatchObject({ result: "aborted", reason: "abort", by: "b" });
    const waiting = room();
    waiting.come("w");
    waiting.send("w", { t: "resign" });
    expect(waiting.core().end).toMatchObject({ result: "aborted", reason: "abort", by: "w" });
    const r = playing();
    r.send("w", { t: "move", uci: "e2e4", ply: 0 });
    r.send("w", { t: "resign" });
    expect(r.core().end).toMatchObject({ result: "aborted", reason: "abort" });
    expect(r.core().takeFinished()).toBeNull();
  });
});

describe("1 v 1's room: playing", () => {
  it("moves go to both with the clocks; the wrong turn, an illegal move or the wrong ply come back with the game", () => {
    const r = playing("blitz", "blitz");
    const start = r.record.game!.startsAt!;
    r.set(start + 4000);
    r.send("w", { t: "move", uci: "e2e4", ply: 0 });
    expect(r.last("b", "move")).toMatchObject({ uci: "e2e4", san: "e4", ply: 0, running: false, firstMoveBy: start + 4000 + FIRST });
    r.send("w", { t: "move", uci: "d2d4", ply: 1 });
    expect(r.last("w", "moveNo")).toMatchObject({ ply: 1, reason: "turn" });
    r.send("b", { t: "move", uci: "e7e4", ply: 1 });
    expect(r.last("b", "moveNo")).toMatchObject({ ply: 1, reason: "illegal", game: { moves: ["e2e4"] } });
    r.send("b", { t: "move", uci: "e7e5", ply: 3 });
    expect(r.last("b", "moveNo")).toMatchObject({ ply: 3, reason: "step" });
    r.set(start + 9000);
    r.send("b", { t: "move", uci: "e7e5", ply: 1 });
    expect(r.last("w", "move")).toMatchObject({ ply: 1, running: true, turnAt: start + 9000, clocks: { w: 180_000, b: 180_000 } });
    // The same move sent again (a reconnect): nothing.
    const before = r.inbox.w.length;
    r.send("b", { t: "move", uci: "e7e5", ply: 1 });
    expect(r.inbox.w.length).toBe(before);
  });

  it("checkmate ends it, and the finished game is handed over to be recorded once", () => {
    const r = playing();
    const start = r.record.game!.startsAt!;
    let t = start;
    for (const [i, m] of ["f2f3", "e7e5", "g2g4", "d8h4"].entries()) {
      t += 2000;
      r.set(t);
      r.send(i % 2 ? "b" : "w", { t: "move", uci: m, ply: i });
    }
    expect(r.last("w", "game")?.game.end).toMatchObject({ result: "0-1", reason: "checkmate", by: "w" });
    const f = r.core().takeFinished();
    expect(f).toMatchObject({ id: r.record.id, players: { w: "uw", b: "ub" }, control: "blitz", result: "0-1", reason: "checkmate", moves: ["f2f3", "e7e5", "g2g4", "d8h4"], startedAt: start, endedAt: t });
    expect(f!.times).toEqual([2000, 2000, 2000, 2000]);
    // (Not again while that try may still be running.)
    expect(r.core().takeFinished()).toBeNull();
    r.core().recorded({ w: { change: null, coins: 0 }, b: { change: null, coins: 0 } });
    expect(r.last("b", "outcome")).toEqual({ t: "outcome", outcome: { change: null, coins: 0 } });
    // A player coming back afterwards hears it again.
    r.go("w");
    r.come("w");
    expect(r.last("w", "outcome")).toBeDefined();
  });

  it("a recording with no outcome (failed, or lost mid-way to an eviction) is tried again later, a few times; never once it's in", () => {
    const r = playing();
    r.send("w", { t: "move", uci: "e2e4", ply: 0 });
    r.send("b", { t: "move", uci: "e7e5", ply: 1 });
    r.send("w", { t: "resign" });
    const end = r.core().end!.at;
    expect(r.core().takeFinished()).not.toBeNull();
    // Nothing back yet: the next try is due 15 s after this one started (the alarm), not before.
    expect(r.record.recordTries).toBe(1);
    expect(r.core().takeFinished()).toBeNull();
    expect(r.core().nextAlarm).toBe(end + 15_000);
    // (What a fresh object reads back from storage after an eviction: the same, so a wake tries again.)
    const stored = JSON.parse(JSON.stringify(r.record)) as typeof r.record;
    expect(new DuelCore(stored, { now: () => end + 15_000, send: () => {}, connected: () => false }).takeFinished()).not.toBeNull();
    for (let k = 1; k < 4; k++) {
      r.set(end + k * 15_000);
      expect(r.core().takeFinished()).not.toBeNull();
    }
    // Four tries: no more, and no alarm for it.
    r.set(end + 60_000);
    expect(r.core().takeFinished()).toBeNull();
    expect(r.core().nextAlarm).toBe(r.record.closeAt);
    // Once an outcome is in, never again.
    const r2 = playing();
    r2.send("w", { t: "move", uci: "e2e4", ply: 0 });
    r2.send("b", { t: "move", uci: "e7e5", ply: 1 });
    r2.send("w", { t: "resign" });
    expect(r2.core().takeFinished()).not.toBeNull();
    r2.core().recorded({ w: { change: null, coins: 0 }, b: { change: null, coins: 0 } });
    r2.set(r2.core().end!.at + 15_000);
    expect(r2.core().takeFinished()).toBeNull();
    expect(r2.core().nextAlarm).toBe(r2.record.closeAt);
  });

  it("a move resent for a ply already played (a reconnect) is never played twice, nor answered as a refusal", () => {
    const r = playing();
    r.send("w", { t: "move", uci: "e2e4", ply: 0 });
    r.send("b", { t: "move", uci: "e7e5", ply: 1 });
    const before = JSON.stringify(r.record.game);
    const sent = r.inbox.w.length;
    r.send("w", { t: "move", uci: "e2e4", ply: 0 });
    r.send("w", { t: "move", uci: "g1f3", ply: 0 });
    expect(JSON.stringify(r.record.game)).toBe(before);
    expect(r.inbox.w.slice(sent).filter((m) => m.t === "moveNo")).toEqual([]);
    // A ply ahead of the game: out of step, answered with the game.
    r.send("w", { t: "move", uci: "g1f3", ply: 5 });
    expect(r.last("w", "moveNo")).toMatchObject({ ply: 5, reason: "step" });
    expect(r.record.game!.moves).toEqual(["e2e4", "e7e5"]);
  });

  it("a disconnected player's clock keeps running: they come back to the same game, or lose on time", () => {
    const r = playing("bullet", "bullet");
    const start = r.record.game!.startsAt!;
    r.set(start + 1000);
    r.send("w", { t: "move", uci: "e2e4", ply: 0 });
    r.set(start + 2000);
    r.send("b", { t: "move", uci: "e7e5", ply: 1 });
    r.go("w");
    expect(r.last("b", "presence")?.connected).toEqual({ w: false, b: true });
    // Back 20 s later: the same game, 20 s gone from the clock.
    r.set(start + 22_000);
    r.come("w");
    const back = r.last("w", "welcome")!.game;
    expect(back).toMatchObject({ phase: "play", moves: ["e2e4", "e7e5"], running: true, turnAt: start + 2000, clocks: { w: 60_000 } });
    expect(r.last("b", "presence")?.connected).toEqual({ w: true, b: true });
    // Gone again, for good: the flag falls at the alarm.
    r.go("w");
    expect(r.core().nextAlarm).toBe(start + 2000 + 60_000);
    r.at(start + 2000 + 60_000);
    expect(r.core().end).toMatchObject({ result: "0-1", reason: "timeout", by: "w" });
    expect(r.last("b", "game")?.game.end?.reason).toBe("timeout");
  });

  it("draws: offered, seen by both, accepted; or declined", () => {
    const r = playing();
    r.send("w", { t: "draw" });
    expect(r.record.game!.drawOffer).toBeNull();
    r.send("w", { t: "move", uci: "e2e4", ply: 0 });
    r.send("b", { t: "move", uci: "e7e5", ply: 1 });
    r.send("w", { t: "draw" });
    expect(r.last("b", "draw")).toMatchObject({ drawOffer: "w", canOffer: { w: false, b: false } });
    r.send("b", { t: "drawNo" });
    expect(r.last("w", "draw")).toMatchObject({ drawOffer: null, canOffer: { w: false, b: true } });
    r.send("b", { t: "draw" });
    r.send("w", { t: "draw" });
    expect(r.last("b", "game")?.game.end).toMatchObject({ result: "1/2-1/2", reason: "agreement" });
  });

  it("a test's clock: each side's seconds and no increment", () => {
    const r = playing("rapid", "rapid", { testSeconds: 8 });
    expect(r.core().view().clock).toEqual({ baseSeconds: 8, incrementSeconds: 0 });
  });

  it("closes once the results have been up their time", () => {
    const r = playing();
    r.send("b", { t: "resign" });
    expect(r.record.closeAt).toBe(r.now() + RANKED_1V1.resultsKeepMinutes * 60_000);
    expect(r.core().nextAlarm).toBe(r.record.closeAt);
  });
});

describe("1 v 1's room: quick chat", () => {
  const pack = (r: ReturnType<typeof room>) => {
    r.core().chatOwned("w", []);
    r.core().chatOwned("b", []);
  };

  it("a known line goes to both; an unknown one is refused; the limits hold", () => {
    const r = started();
    pack(r);
    r.send("w", { t: "chat", say: "good-luck" });
    expect(r.last("b", "chat")?.line).toMatchObject({ from: "w", say: "good-luck", to: "all" });
    expect(r.last("w", "chat")?.line.say).toBe("good-luck");
    r.send("w", { t: "chat", say: "nonsense" });
    expect(r.last("w", "chatNo")).toMatchObject({ reason: "unknown" });
    r.send("w", { t: "chat", say: "gg" });
    expect(r.last("w", "chatNo")).toMatchObject({ reason: "gap" });
    r.set(r.now() + QUICK_CHAT.minGapMs);
    r.send("w", { t: "chat", say: "gg" });
    expect(r.last("b", "chat")?.line.say).toBe("gg");
  });

  it("muted (by side) or chat off: the other's lines aren't sent; unmuted, the log comes again", () => {
    const r = started();
    pack(r);
    r.send("b", { t: "chatPrefs", muted: ["w"] });
    const n = r.inbox.b.filter((m) => m.t === "chat").length;
    r.send("w", { t: "chat", say: "good-luck" });
    expect(r.inbox.b.filter((m) => m.t === "chat").length).toBe(n);
    r.send("b", { t: "chatPrefs", muted: [] });
    expect(r.last("b", "chatLog")?.lines.map((l) => l.say)).toEqual(["good-luck"]);
    r.send("w", { t: "chatPrefs", off: true });
    r.send("w", { t: "chat", say: "hi-all" });
    expect(r.last("w", "chatNo")).toMatchObject({ reason: "off" });
  });

  it("a chat ban in force: refused with the ban (they still read); lifted, they can send", () => {
    const r = started();
    pack(r);
    r.core().chatStanding("w", { until: r.now() + 60_000 });
    r.send("w", { t: "chat", say: "good-luck" });
    expect(r.last("w", "chatNo")).toMatchObject({ reason: "mod", block: { until: r.now() + 60_000 } });
    r.send("b", { t: "chat", say: "good-luck" });
    expect(r.last("w", "chat")?.line.from).toBe("b");
    r.core().chatStanding("w", null);
    r.send("w", { t: "chat", say: "good-luck" });
    expect(r.last("b", "chat")?.line.from).toBe("w");
  });
});
