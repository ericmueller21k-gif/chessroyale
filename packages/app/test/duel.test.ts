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

describe("the 1 v 1 screens' words and clocks", () => {
  it("a clock runs only for the side to move, once the clocks run", async () => {
    const { clockAt } = await import("../src/duel.ts");
    const s = { clocks: { w: 60_000, b: 50_000 }, turnAt: 1000, running: true, moves: ["e2e4", "e7e5"] };
    expect(clockAt(s, "w", 11_000)).toBe(50_000);
    expect(clockAt(s, "b", 11_000)).toBe(50_000);
    expect(clockAt({ ...s, running: false }, "w", 11_000)).toBe(60_000);
    expect(clockAt(s, "w", 100_000)).toBe(0);
  });

  it("the result card: who won, and why, from your side", async () => {
    const { resultReason, resultTitle } = await import("../src/screens/Duel.tsx");
    const end = (patch: Partial<DuelEnd>): DuelEnd => ({ result: "1-0", reason: "checkmate", by: "b", at: 0, ...patch });
    expect(resultTitle(end({}), "w")).toBe("You won");
    expect(resultTitle(end({}), "b")).toBe("You lost");
    expect(resultTitle(end({ result: "1/2-1/2", reason: "repetition" }), "b")).toBe("Draw");
    expect(resultTitle(end({ result: "aborted", reason: "no_first_move" }), "w")).toBe("Game aborted");
    expect(resultReason(end({ reason: "resign" }), "w", "Bob")).toBe("Bob resigned.");
    expect(resultReason(end({ reason: "timeout", by: "w", result: "0-1" }), "w", "Bob")).toBe("You ran out of time.");
    expect(resultReason(end({ reason: "timeout_vs_insufficient", by: "b", result: "1/2-1/2" }), "w", "Bob")).toBe("Bob ran out of time, but you couldn't mate.");
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
