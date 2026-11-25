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
 * Kept up by the Worker's 15-minute cron (index.ts `scheduled`, `residentsHostTick`) once its image exists (`RESIDENTS_HOST_IMAGE`
 * "1"): while `RESIDENTS_HOST_ON` is "1" and `PAUSE_RESIDENTS` isn't on, each run starts it if it's down and renews its `sleepAfter`
 * (two missed runs and it sleeps). Paused, off or with no token, each run stops it (paused, the server has already refused every
 * resident, so the program has stopped its games; off, the program ends them on the SIGTERM). Never left to sleep on its own: the
 * library renews the sleep deadline whenever its object starts again, at every deploy (the review's M2).
 */
export class ResidentsHost extends Container {
  // (No port: the program serves nothing. `start` sees nothing listening and is done.)
  sleepAfter = RESIDENTS.host.sleepAfter;

  /**
   * Starts the program's container if it isn't running, and renews its sleepAfter. Running with another environment than it would
   * start with now (the token's secret changed, or the program's options), it's stopped instead (SIGTERM: the program ends its
   * games and exits), and the next run starts it with the new one. What it started with is kept as a SHA-256 of the environment in
   * this object's storage (ENV_HASH_KEY), never the values.
   */
  async keepUp(): Promise<"started" | "running" | "restarting"> {
    const vars = hostEnvVars(this.env as ResidentsHostEnv);
    const hash = await envHash(vars);
    if (this.ctx.container?.running) {
      if ((await this.ctx.storage.get<string>(ENV_HASH_KEY)) !== hash) {
        await this.stop("SIGTERM");
        return "restarting";
      }
      this.renewActivityTimeout();
      return "running";
    }
    await this.ctx.storage.put(ENV_HASH_KEY, hash);
    // (The library tries the port up to `retries` times, `waitInterval` apart, each try taking up to its 5 s ping: at most about 18
    // minutes, not its default 8 s. A cold start, pulling Node's full Debian image of about 1.6 GB, takes about a minute. The port is
    // only the library's probe: nothing listens on it, which tells it the container is up.)
    await this.start({ envVars: vars }, { portToCheck: 8080, retries: 200, waitInterval: 300 });
    this.renewActivityTimeout();
    return "started";
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
  /** "1" once the image exists (set with the host's `containers` entry): before it, the cron never touches the host (it can't be made). */
  RESIDENTS_HOST_IMAGE?: string;
  /** "1": the cron keeps the host up (it starts the spend). Anything else: each run stops it. */
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
 * The cron's call, from the Worker's variables alone. Before the image exists (RESIDENTS_HOST_IMAGE not "1": wrangler.jsonc has no
 * `containers` entry for it) the host is never touched, as its Durable Object can't be made at all. After, it's stopped while paused
 * (checked first), off (RESIDENTS_HOST_ON not "1") or with no token, and kept up otherwise.
 */
export function hostPlan(env: ResidentsHostEnv): HostPlan {
  if (!env.RESIDENTS_HOST) return { action: "none", why: "no host in this Worker" };
  if (env.RESIDENTS_HOST_IMAGE?.trim() !== "1") return { action: "none", why: "no image yet (RESIDENTS_HOST_IMAGE isn't 1)" };
  if (residentsPaused(env)) return { action: "stop", why: "paused (PAUSE_RESIDENTS)" };
  if (env.RESIDENTS_HOST_ON?.trim() !== "1") return { action: "stop", why: "off (RESIDENTS_HOST_ON isn't 1)" };
  if (!env.RESIDENTS_CLIENT_ID?.trim() || !env.RESIDENTS_CLIENT_SECRET?.trim()) return { action: "stop", why: "no token (RESIDENTS_CLIENT_ID and RESIDENTS_CLIENT_SECRET)" };
  return { action: "keep", why: "on" };
}

/**
 * The container's environment: the residents' token (as the program reads it, CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET, both
 * trimmed: a secret pasted with a newline would be turned away) and the program's options. Passed to the container at start only;
 * never logged.
 */
export function hostEnvVars(env: ResidentsHostEnv): Record<string, string> {
  return {
    CF_ACCESS_CLIENT_ID: env.RESIDENTS_CLIENT_ID?.trim() ?? "",
    CF_ACCESS_CLIENT_SECRET: env.RESIDENTS_CLIENT_SECRET?.trim() ?? "",
    RESIDENTS_ARGS: RESIDENTS.host.args.join(" "),
  };
}

/** Where keepUp keeps the hash of the environment the running container started with. */
export const ENV_HASH_KEY = "envHash";

/** A SHA-256 of an environment (hex), to tell whether it changed without keeping it: never the values themselves. */
export async function envHash(vars: Record<string, string>): Promise<string> {
  const text = JSON.stringify(Object.keys(vars).sort().map((k) => [k, vars[k]]));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The host's one instance. */
export const HOST_INSTANCE = "residents";

/**
 * The cron's run (index.ts): what it did, for the log (null: nothing to do: no image yet, or stopped already). Throws on a failed
 * start or stop (the cron counts it).
 */
export async function residentsHostTick(env: ResidentsHostEnv): Promise<string | null> {
  const plan = hostPlan(env);
  if (plan.action === "none") return null;
  const host = getContainer(env.RESIDENTS_HOST!, HOST_INSTANCE);
  if (plan.action === "keep") return await host.keepUp();
  return (await host.halt()) === "stopping" ? `stopping: ${plan.why}` : null;
}
