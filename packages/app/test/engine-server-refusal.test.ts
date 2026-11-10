import { afterEach, describe, expect, it, vi } from "vitest";
import type { UciEngine } from "@chessroyale/chess";
import { warmEngineServer, withServerRecheck } from "../src/engine.ts";

/** The review of #610, m5: a refusal from the engine server (401, 429, 404) holds for the rest of the game; a new game asks again. */
describe("the engine server's refusals", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("after a 401 or 429 the device re-checks for the rest of the game, asking nothing more; a new game asks again", async () => {
    const device = { scoreMovesAt: vi.fn(async () => [{ move: "e2e4", expected: 0.5 }]) } as unknown as UciEngine;
    const engine = withServerRecheck(device);
    for (const status of [429, 401]) {
      const calls: string[] = [];
      vi.stubGlobal("fetch", async (url: string) => (calls.push(url), new Response("{}", { status })));
      warmEngineServer();
      await new Promise((r) => setTimeout(r, 0));
      // The game's ping was refused: no score call at all.
      expect(await engine.scoreMovesAt("fen", ["e2e4"], 1000)).toEqual([{ move: "e2e4", expected: 0.5 }]);
      expect(calls).toEqual(["/api/engine/ping"]);
      // A new game whose ping is answered asks; the first refusal ends the asking for that game.
      vi.stubGlobal("fetch", async (url: string) => (calls.push(url), new Response("{}", { status: url.endsWith("ping") ? 200 : status })));
      warmEngineServer();
      await new Promise((r) => setTimeout(r, 0));
      await engine.scoreMovesAt("fen", ["e2e4"], 1000);
      await engine.scoreMovesAt("fen", ["e2e4"], 1000);
      expect(calls).toEqual(["/api/engine/ping", "/api/engine/ping", "/api/engine/score"]);
    }
  });
});
