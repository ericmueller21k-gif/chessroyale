import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A town bot's game (src/duel.ts, BotDuel with `town`): the bot's name and rating on its strip, no versus moment, Maia's
 * loading step first (Boss alone's MaiaGate: this device's Stockfish paused, Maia loaded alone), then the vote and the
 * game; casual: no rank change, no coins.
 */

/** Maia's engine as the gate sees it: loads when told. */
function fakeMaia() {
  let done: (ok: boolean) => void = () => undefined;
  const loaded = new Promise<boolean>((r) => (done = r));
  return { engine: { loaded: () => loaded, ready: () => false, close: vi.fn(), error: null, candidates: vi.fn() }, done };
}

const maia = fakeMaia();
const paused = vi.fn();
vi.mock("../src/maia.ts", () => ({ startMaia: vi.fn(() => maia.engine), prefetchMaia: vi.fn() }));
vi.mock("../src/engine.ts", () => ({
  pauseEngines: vi.fn(async (until: Promise<unknown>) => {
    paused();
    await Promise.resolve();
    void until;
  }),
  ownEngine: vi.fn(),
}));

afterEach(() => vi.unstubAllGlobals());

describe("a town bot's game", () => {
  it("its name and rating; Maia's loading step first (nothing to vote on yet), then the vote; resigning is casual", async () => {
    vi.stubGlobal("Worker", class {});
    const { BotDuel } = await import("../src/duel.ts");
    const { startMaia } = await import("../src/maia.ts");
    const g = new BotDuel(1400, { name: "Tempo Tess (bot)", look: { head: { def: "wizard-hat", color: "sage", blemish: 0, seed: 1 } } });
    let s = g.snapshot();
    const them = s.you === "w" ? "b" : "w";
    expect(s.players[them]).toMatchObject({ name: "Tempo Tess (bot)", bot: true, rank: { label: "1400" } });
    expect(s.players[them].look?.head?.def).toBe("wizard-hat");
    expect(s.town).toBe(true);
    // A pawn's strip shows its pawn, no face.
    expect(s.players[them].face).toBeUndefined();
    // Yours: "Casual", not your 1 v 1 rank.
    expect(s.players[s.you].rank.label).toBe("Casual");
    // The loading step: no versus moment, no vote yet; Stockfish paused while Maia loads alone, at the bot's rating.
    expect(s.loading).toBe(true);
    expect(s.phase).toBe("vote");
    expect(startMaia).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(paused).toHaveBeenCalled());
    // Maia's loaded: the vote opens now.
    maia.done(true);
    await vi.waitFor(() => expect(g.snapshot().loading).toBe(false));
    s = g.snapshot();
    expect(s.phase).toBe("vote");
    expect(s.voteAt).toBeLessThanOrEqual(Date.now());
    // Leaving before the first moves: called off, nothing recorded, no rank, no coins.
    g.resign();
    s = g.snapshot();
    expect(s.end?.result).toBe("aborted");
    expect(s.outcome).toEqual({ change: null, coins: 0 });
    await vi.waitFor(() => expect(maia.engine.close).toHaveBeenCalled());
    g.dispose();
  });

  it("where Maia can't run (no workers): no loading step, straight to the vote", async () => {
    const { BotDuel } = await import("../src/duel.ts");
    const g = new BotDuel(800, { name: "Pin Pete (bot)", look: null });
    const s = g.snapshot();
    expect(s.loading).toBe(false);
    expect(s.phase).toBe("vote");
    expect(s.players[s.you === "w" ? "b" : "w"].rank.label).toBe("800");
    g.dispose();
  });

  it("the bot game from the 1 v 1 queue is as before: 'Bot', unranked, its versus moment", async () => {
    const { BotDuel } = await import("../src/duel.ts");
    const g = new BotDuel(1500);
    const s = g.snapshot();
    expect(s.players[s.you === "w" ? "b" : "w"]).toMatchObject({ name: "Bot", rank: { label: "Unranked" } });
    expect(s.phase).toBe("versus");
    expect(s.town).toBe(false);
    expect(s.loading).toBe(false);
    g.dispose();
  });

  it("a sidekick's strip shows its face in place of the pawn (Oct 28), at its rating (Glim: 2500, Maia's top)", async () => {
    vi.stubGlobal("Worker", class {});
    const { BotDuel } = await import("../src/duel.ts");
    const k = new BotDuel(2500, { name: "Glim (bot)", look: null, face: "data:image/png;base64,AAAA" });
    const s = k.snapshot();
    expect(s.players[s.you === "w" ? "b" : "w"]).toMatchObject({ name: "Glim (bot)", face: "data:image/png;base64,AAAA", rank: { label: "2500" } });
    expect(s.loading).toBe(true);
    k.dispose();
  });
});
