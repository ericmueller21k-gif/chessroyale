import { DurableObject } from "cloudflare:workers";
import type { LobbyRecord } from "./lobby.ts";
import { openLobbyCode } from "./codes.ts";
import type { Env } from "./index.ts";

/**
 * "Play now": one Durable Object hands out the lobby that's filling up. Players
 * join it until it's full or a minute has passed since it opened, then it
 * starts with bots in the empty seats and the next player gets a new lobby.
 * Unranked for now; ranked queues by rating come later.
 */
export class Matchmaker extends DurableObject<Env> {
  async next(overrides: LobbyRecord["overrides"], fillMs: number): Promise<{ code: string }> {
    // One request at a time, so two players arriving together don't open two lobbies.
    return this.ctx.blockConcurrencyWhile(async () => {
      const current = await this.ctx.storage.get<string>("current");
      if (current) {
        const stub = this.env.LOBBIES.get(this.env.LOBBIES.idFromName(current));
        if (await stub.joinable()) return { code: current };
      }
      // A fresh code: one whose lobby is still open (a match, or its results) is never handed out.
      const code = await openLobbyCode((c) => this.env.LOBBIES.get(this.env.LOBBIES.idFromName(c)).create(c, overrides, { fillAt: Date.now() + fillMs }));
      if (!code) throw new Error("Couldn't open a lobby.");
      await this.ctx.storage.put("current", code);
      return { code };
    });
  }
}
