import { Container, getContainer } from "@cloudflare/containers";
import { RESIDENTS } from "@chessroyale/core";
import { residentsPaused } from "./kill-switches.ts";

/**
 * The residents' always-on host (the design: notes/residents-design.md on claude/director-notes, §1 "(b2)", §3 "PR 3";
 * docs/areas/ops.md, "Residents, the host"): a Cloudflare Container running the residents program (scripts/residents/run.ts) around
 * the clock. Its image (scripts/residents/container) is only Node and git: at each start it clones the public repository's main,
 * installs it and runs the program, so a code change reaches it with no new image. Its traffic leaves the container and comes back to
 * hunchess.com through the public edge and Cloudflare Access, as any player's, with the residents' own service token.
 *
 * Kept up by the Worker's 15-minute cron (index.ts `scheduled`, `residentsHostTick`): while `RESIDENTS_HOST_ON` is "1" and
 * `PAUSE_RESIDENTS` isn't on, each run starts it if it's down and renews its `sleepAfter` (two missed runs and it sleeps). While
 * PAUSE_RESIDENTS is on, each run stops it (the server has already refused every resident, so the program has stopped its games).
 */
export class ResidentsHost extends Container {
  // (No port: the program serves nothing. `start` sees nothing listening and is done.)
  sleepAfter = RESIDENTS.host.sleepAfter;

  /** Starts the program's container if it isn't running, and renews its sleepAfter either way. */
  async keepUp(): Promise<"started" | "running"> {
    const running = this.ctx.container?.running ?? false;
    if (!running) await this.start({ envVars: hostEnvVars(this.env as ResidentsHostEnv) });
    this.renewActivityTimeout();
    return running ? "running" : "started";
  }

  /** Asks the program to stop (SIGTERM: it ends its games and exits), if it's running. */
  async halt(): Promise<"stopping" | "stopped"> {
    if (!this.ctx.container?.running) return "stopped";
    await this.stop("SIGTERM");
    return "stopping";
  }

  override onStart(): void {
    console.log("residents host: started");
  }

  override onStop(params: { exitCode?: number; reason?: string }): void {
    console.log(`residents host: stopped (${params.reason ?? "?"}, exit ${params.exitCode ?? "?"})`);
  }

  override onError(error: unknown): unknown {
    console.error("residents host:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export interface ResidentsHostEnv {
  /** The container's Durable Object (wrangler.jsonc `RESIDENTS_HOST`; its `containers` entry names the image). */
  RESIDENTS_HOST?: DurableObjectNamespace<ResidentsHost>;
  /** "1": the cron keeps the host up (it starts the spend). Anything else: the cron leaves it alone, and it sleeps within sleepAfter. */
  RESIDENTS_HOST_ON?: string;
  /** The kill switch (kill-switches.ts residentsPaused): "1" stops the host at the next cron run. */
  PAUSE_RESIDENTS?: string;
  /** The residents' Access service token: its client ID (wrangler.jsonc `vars`) and its secret (a Worker secret, never in the repo). */
  RESIDENTS_CLIENT_ID?: string;
  RESIDENTS_CLIENT_SECRET?: string;
}

/** What the cron does about the host, and why (also in GET /api/admin/residents). */
export interface HostPlan {
  /** "keep": start it if it's down and renew its sleepAfter; "stop": stop it if it's running; "none": don't touch it. */
  action: "keep" | "stop" | "none";
  why: string;
}

/**
 * The cron's call, from the Worker's variables alone. Off (RESIDENTS_HOST_ON not "1"), the host is never touched: before its image
 * exists (wrangler.jsonc has no `containers` entry for it) its Durable Object can't be made at all. Paused or with no token, it's
 * stopped.
 */
export function hostPlan(env: ResidentsHostEnv): HostPlan {
  if (!env.RESIDENTS_HOST) return { action: "none", why: "no host in this Worker" };
  if (env.RESIDENTS_HOST_ON?.trim() !== "1") return { action: "none", why: "off (RESIDENTS_HOST_ON isn't 1)" };
  if (residentsPaused(env)) return { action: "stop", why: "paused (PAUSE_RESIDENTS)" };
  if (!env.RESIDENTS_CLIENT_ID?.trim() || !env.RESIDENTS_CLIENT_SECRET) return { action: "stop", why: "no token (RESIDENTS_CLIENT_ID and RESIDENTS_CLIENT_SECRET)" };
  return { action: "keep", why: "on" };
}

/**
 * The container's environment: the residents' token (as the program reads it, CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET) and
 * the program's options. Passed to the container at start only; never logged.
 */
export function hostEnvVars(env: ResidentsHostEnv): Record<string, string> {
  return {
    CF_ACCESS_CLIENT_ID: env.RESIDENTS_CLIENT_ID?.trim() ?? "",
    CF_ACCESS_CLIENT_SECRET: env.RESIDENTS_CLIENT_SECRET ?? "",
    RESIDENTS_ARGS: RESIDENTS.host.args.join(" "),
  };
}

/** The host's one instance. */
export const HOST_INSTANCE = "residents";

/** The cron's run (index.ts): what it did, for the log (null: nothing, it's off). Throws on a failed start or stop (the cron counts it). */
export async function residentsHostTick(env: ResidentsHostEnv): Promise<string | null> {
  const plan = hostPlan(env);
  if (plan.action === "none") return null;
  const host = getContainer(env.RESIDENTS_HOST!, HOST_INSTANCE);
  return plan.action === "keep" ? await host.keepUp() : `${await host.halt()}: ${plan.why}`;
}
