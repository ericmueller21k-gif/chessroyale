import { afterEach, describe, expect, it, vi } from "vitest";
import { rankView } from "@chessroyale/core";
import type { DuelEnd } from "@chessroyale/chess/duel";

/**
 * 1 v 1 in the app: the shared first-time vote hint (once per device, and once per page with no storage), the clocks
 * as the strips read them, the result card's words, and the rank label the home screen's button reads.
 */

/** A device's storage holding `stored` (or none at all: every call throws, as in some private modes). */
function device(stored: Record<string, string> = {}, noStorage = false) {
  const m = new Map(Object.entries(stored));
  const fail = () => {
    throw new Error("no storage");
  };
  vi.stubGlobal("localStorage", noStorage ? { getItem: fail, setItem: fail, removeItem: fail } : { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)) });
  return m;
}
const loadHint = async () => {
  vi.resetModules();
  return import("../src/components/VoteHint.tsx");
};

afterEach(() => vi.unstubAllGlobals());

describe("the first-time vote hint (VoteHint)", () => {
  it("shows on a device that hasn't seen it, then never again there", async () => {
    const m = device();
    const h = await loadHint();
    expect(h.voteHintSeen()).toBe(false);
    h.markVoteHintSeen();
    expect(m.get("brc.voteHintSeen")).toBe("1");
    const again = await loadHint();
    expect(again.voteHintSeen()).toBe(true);
  });

  it("with no storage: once per page load", async () => {
    device({}, true);
    const h = await loadHint();
    expect(h.voteHintSeen()).toBe(false);
    h.markVoteHintSeen();
    expect(h.voteHintSeen()).toBe(true);
  });
});

describe("the 1 v 1 queue and game in the app", () => {
  it("a ticket the server no longer knows (expired): dropped, and it asks afresh, still searching", async () => {
    const asked: string[] = [];
    const answers = [{ searching: true, ticket: "t-old-ticket", botRating: 1500 }, { expired: true }, { code: "ABCDE" }];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url);
      return new Response(JSON.stringify(answers.shift() ?? {}), { status: 200 });
    });
    vi.stubGlobal("location", { search: "" });
    const { DuelQueue } = await import("../src/duel.ts");
    const q = new DuelQueue();
    await q.start();
    expect(asked).toEqual(["/api/1v1/play", "/api/1v1/play?ticket=t-old-ticket", "/api/1v1/play"]);
    expect(q.state).toEqual({ kind: "found", code: "ABCDE" });
  });

  it("a search is saved for a reload after every ask, carried on with its ticket and wait, and forgotten once found", async () => {
    const saved = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => void saved.set(k, v), removeItem: (k: string) => void saved.delete(k) });
    vi.stubGlobal("location", { search: "" });
    let answers: object[] = [{ searching: true, ticket: "t-1" }];
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url);
      const a = answers.shift();
      // (No answer left: the search goes on, as it would while you browse; the test cancels it.)
      return a ? new Response(JSON.stringify(a), { status: 200 }) : new Promise<Response>(() => undefined);
    });
    vi.resetModules();
    const { DuelQueue, savedDuelQueue } = await import("../src/duel.ts");
    const q = new DuelQueue();
    void q.start();
    await vi.waitFor(() => expect(savedDuelQueue()?.ticket).toBe("t-1"));
    const since = (q.state as { since: number }).since;
    expect(savedDuelQueue()!.since).toBe(since);
    // A reload: the same ticket, the same wait.
    answers = [{ code: "ABCDE" }];
    asked.length = 0;
    const again = new DuelQueue(savedDuelQueue());
    expect(again.state).toEqual({ kind: "searching", since });
    await again.start();
    expect(asked).toEqual(["/api/1v1/play?ticket=t-1"]);
    expect(again.state).toEqual({ kind: "found", code: "ABCDE" });
    expect(savedDuelQueue()).toBeNull();
    // Too old (no ask for 2 minutes): not carried on.
    saved.set("brc.duelQueue", JSON.stringify({ ticket: "t-2", since: 0, at: Date.now() - 3 * 60_000, test: {} }));
    expect(savedDuelQueue()).toBeNull();
  });

  it("Cancel while the first ask is still out: its ticket, once it comes, is cancelled too", async () => {
    vi.stubGlobal("location", { search: "" });
    const asked: string[] = [];
    let answer: (r: Response) => void = () => undefined;
    vi.stubGlobal("fetch", (url: string) => {
      asked.push(url);
      return url.startsWith("/api/1v1/play") ? new Promise<Response>((r) => (answer = r)) : Promise.resolve(new Response("{}"));
    });
    vi.resetModules();
    const { DuelQueue } = await import("../src/duel.ts");
    const q = new DuelQueue();
    const run = q.start();
    q.cancel();
    expect(asked).toEqual(["/api/1v1/play"]);
    answer(new Response(JSON.stringify({ searching: true, ticket: "t-late" }), { status: 200 }));
    await run;
    expect(asked).toEqual(["/api/1v1/play", "/api/1v1/cancel?ticket=t-late"]);
    expect(q.state).toEqual({ kind: "cancelled" });
  });

  it("the server's clock: the quickest message's sample is kept, not the latest", async () => {
    const { NetDuel } = await import("../src/duel.ts");
    const d = new NetDuel("ABCDE") as unknown as { onMessage(m: unknown): void; offset: number };
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    d.onMessage({ t: "presence", connected: { w: true, b: true }, now: 1_000_000 + 4_950 }); // 50 ms on the way
    d.onMessage({ t: "presence", connected: { w: true, b: true }, now: 1_000_000 + 4_700 }); // 300 ms: slower
    expect(d.offset).toBe(4_950);
    d.onMessage({ t: "presence", connected: { w: true, b: true }, now: 1_000_000 + 4_990 }); // 10 ms: quicker
    expect(d.offset).toBe(4_990);
    vi.useRealTimers();
  });

  it("back after a dropped socket with your move unanswered: sent again only if the game still waits for it", async () => {
    const { NetDuel } = await import("../src/duel.ts");
    const { START_FEN } = await import("@chessroyale/chess");
    const sent: unknown[] = [];
    const d = new NetDuel("ABCDE") as unknown as NetDuelInside;
    d.send = (m: unknown) => void sent.push(m);
    const view = (moves: string[]) => ({
      code: "ABCDE", phase: "play", players: { w: { uid: "a", name: "Ann", look: null, rank: rankView(null) }, b: { uid: "b", name: "Bo", look: null, rank: rankView(null) } },
      versusAt: 0, voteAt: 0, voteEndsAt: 0, picks: { w: null, b: null }, control: "blitz", clock: { baseSeconds: 180, incrementSeconds: 2 }, startsAt: 0,
      fen: moves.length ? "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" : START_FEN, moves, sans: moves.map(() => "e4"),
      clocks: { w: 180_000, b: 180_000 }, turnAt: 0, running: false, firstMoveBy: null, drawOffer: null, canOffer: { w: false, b: false }, connected: { w: true, b: true }, end: null,
    });
    d.onMessage({ t: "welcome", you: "w", game: view([]), v: 1 });
    d.move("e2e4");
    expect(sent).toEqual([{ t: "move", uci: "e2e4", ply: 0 }]);
    // The socket drops before the answer; back, the game still waits for ply 0: sent again.
    d.onMessage({ t: "welcome", you: "w", game: view([]), v: 1 });
    expect(sent).toEqual([{ t: "move", uci: "e2e4", ply: 0 }, { t: "move", uci: "e2e4", ply: 0 }]);
    // Dropped again; back, the move was played meanwhile: nothing more.
    d.onMessage({ t: "welcome", you: "w", game: view(["e2e4"]), v: 1 });
    expect(sent).toHaveLength(2);
  });
});

/** NetDuel's insides a test drives (its socket's messages, and what it sends). */
interface NetDuelInside {
  onMessage(m: unknown): void;
  send(m: unknown): void;
  move(uci: string): void;
}

describe("the 1 v 1 screens' words and clocks", () => {
  it("a clock runs only for the side to move, once the clocks run", async () => {
    const { clockAt } = await import("../src/duel.ts");
    const s = { clocks: { w: 60_000, b: 50_000 }, turnAt: 1000, running: true, moves: ["e2e4", "e7e5"] };
    expect(clockAt(s, "w", 11_000)).toBe(50_000);
    expect(clockAt(s, "b", 11_000)).toBe(50_000);
    expect(clockAt({ ...s, running: false }, "w", 11_000)).toBe(60_000);
    expect(clockAt(s, "w", 100_000)).toBe(0);
  });

  it("the result card: who won, and why (a sentence of its own, by name), from your side", async () => {
    const { resultReason, resultTitle } = await import("../src/screens/Duel.tsx");
    const end = (patch: Partial<DuelEnd>): DuelEnd => ({ result: "1-0", reason: "checkmate", by: "b", at: 0, ...patch });
    expect(resultTitle(end({}), "w")).toBe("You won");
    expect(resultTitle(end({}), "b")).toBe("You lost");
    expect(resultTitle(end({ result: "1/2-1/2", reason: "repetition" }), "b")).toBe("Draw");
    expect(resultTitle(end({ result: "aborted", reason: "no_first_move" }), "w")).toBe("Game aborted");
    expect(resultReason(end({}), "w", "Bob")).toBe("Checkmate.");
    expect(resultReason(end({ reason: "resign" }), "w", "Bob")).toBe("Bob resigned.");
    expect(resultReason(end({ reason: "timeout", by: "w", result: "0-1" }), "w", "Bob")).toBe("You ran out of time.");
    expect(resultReason(end({ reason: "timeout_vs_insufficient", by: "b", result: "1/2-1/2" }), "w", "Bob")).toBe("Bob ran out of time, but you couldn't checkmate.");
    expect(resultReason(end({ reason: "timeout_vs_insufficient", by: "w", result: "1/2-1/2" }), "w", "Bob")).toBe("You ran out of time, but Bob couldn't checkmate.");
    expect(resultReason(end({ reason: "agreement", by: null, result: "1/2-1/2" }), "w", "Bob")).toBe("Draw agreed.");
    // Every reason a sentence: never run into the headline.
    for (const reason of ["checkmate", "resign", "timeout", "timeout_vs_insufficient", "stalemate", "repetition", "fifty_moves", "insufficient_material", "agreement", "abort", "no_first_move", "no_show"] as const)
      expect(resultReason(end({ reason }), "w", "Bob")).toMatch(/^[A-Z0-9].*\.$/);
    expect(resultReason(end({ reason: "no_first_move", by: "w", result: "aborted" }), "w", "Bob")).toBe("Your first move didn't come in time. No rank change.");
    expect(resultReason(end({ reason: "abort", by: "b", result: "aborted" }), "w", "Bob")).toBe("Bob left before the first moves. No rank change.");
    expect(resultReason(end({ reason: "no_show", by: null, result: "aborted" }), "w", "Bob")).toBe("Your opponent didn't arrive. No rank change.");
  });

  it("the home screen's label: your rank from your profile (placements before any game), nothing before it loads", async () => {
    device();
    vi.resetModules();
    const acc = await import("../src/account.ts");
    const { ranked1v1Label } = await import("../src/ranked.ts");
    expect(ranked1v1Label()).toBeNull();
    const state = acc.account() as { profile: unknown };
    state.profile = { user: { id: "u", name: "Ann" }, ranked1v1: { rank: rankView({ games: 9, ladder: 1245 }), games: 9, wins: 5, losses: 4, draws: 0 } };
    expect(ranked1v1Label()).toBe("Gold 4 · 45 RP");
    state.profile = { user: { id: "u", name: "Ann" } };
    expect(ranked1v1Label()).toBe("Placement 0/5");
  });
});
