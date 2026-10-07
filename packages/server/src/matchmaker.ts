import { DurableObject } from "cloudflare:workers";
import { MATCHMAKING, type MatchmakingType } from "@chessroyale/core";
import type { LobbyRecord } from "./lobby.ts";
import { openLobbyCode } from "./codes.ts";
import type { Env } from "./index.ts";

/**
 * The queue's name: one matchmaker per mode and type, so Default and Bots off never share a lobby (Bots off players
 * would get bots). `pool`: a queue of its own (tests run several at once without meeting).
 */
export function queueName(mode: "crowd" | "raid", type: Exclude<MatchmakingType, "solo">, pool?: string | null): string {
  return `${mode}-${type}${pool && /^[a-z0-9-]{1,24}$/.test(pool) ? `-${pool}` : ""}`;
}

/**
 * PLAY: one Durable Object per queue hands out the lobby that's filling up. Default: players join it until it's full
 * or a minute has passed since it opened, then it starts with bots in the empty seats and the next player gets a new
 * lobby. Bots off: it waits until it's full (a raid: see MATCHMAKING). Solo never comes here: it's played in the browser.
 */
export class Matchmaker extends DurableObject<Env> {
  /**
   * `fillMs`: how long a new lobby waits before bots fill it (Bots off: before a raid may begin with fewer than 50).
   * `since`: someone switching from Bots off, who has been waiting since then: bots fill a minute after that at the
   * latest (their wait counts).
   */
  async next(overrides: LobbyRecord["overrides"], fillMs: number, opts: { botsOff?: boolean; crowdWaitsForFull?: boolean; since?: number } = {}): Promise<{ code: string }> {
    // One request at a time, so two players arriving together don't open two lobbies.
    return this.ctx.blockConcurrencyWhile(async () => {
      const now = Date.now();
      const current = await this.ctx.storage.get<string>("current");
      if (current) {
        const stub = this.env.LOBBIES.get(this.env.LOBBIES.idFromName(current));
        if (await stub.joinable()) {
          if (opts.since !== undefined) await stub.hurry(opts.since + fillMs);
          return { code: current };
        }
      }
      // When bots fill (Default), or when a raid may begin with fewer (Bots off); a Bots off 50 v 50 waits until full.
      const fillAt = opts.botsOff
        ? opts.crowdWaitsForFull
          ? null
          : now + fillMs
        : opts.since !== undefined
          ? Math.min(now + fillMs, Math.max(now + MATCHMAKING.switchMinWaitMs, opts.since + fillMs))
          : now + fillMs;
      // A fresh code: one whose lobby is still open (a match, or its results) is never handed out.
      const code = await openLobbyCode((c) => this.env.LOBBIES.get(this.env.LOBBIES.idFromName(c)).create(c, overrides, { fillAt, botsOff: !!opts.botsOff }));
      if (!code) throw new Error("Couldn't open a lobby.");
      await this.ctx.storage.put("current", code);
      return { code };
    });
  }
}
