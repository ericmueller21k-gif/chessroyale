import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RESIDENTS } from "@chessroyale/core";
import { ensureSchema } from "../src/accounts.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * The residents' always-on host (residents-host.ts; docs/areas/ops.md, "Residents, the host"): the 15-minute cron keeps the container
 * up while RESIDENTS_HOST_ON is "1", stops it while PAUSE_RESIDENTS is on or the token is missing, and never touches it while off
 * (before its image exists its Durable Object can't be made). The container gets the token and the program's options, nothing else.
 */

// (The real Container needs the Workers runtime: a stand-in that records what the host asks of it, and a getContainer whose stub
// records the cron's calls.)
const calls = vi.hoisted(() => ({ instances: [] as string[], keepUp: 0, halt: 0, fail: null as Error | null }));
vi.mock("@cloudflare/containers", () => ({
  Container: class {
    ctx: { container: { running: boolean } };
    env: unknown;
    started: (Record<string, string> | undefined)[] = [];
    stopped: unknown[] = [];
    renewed = 0;
    constructor(ctx: { container: { running: boolean } }, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
    async start(opts?: { envVars?: Record<string, string> }) {
      this.started.push(opts?.envVars);
      this.ctx.container.running = true;
    }
    async stop(signal?: unknown) {
      this.stopped.push(signal);
    }
    renewActivityTimeout() {
      this.renewed++;
    }
  },
  getContainer: (_ns: unknown, name: string) => {
    calls.instances.push(name);
    return {
      keepUp: async () => {
        calls.keepUp++;
        if (calls.fail) throw calls.fail;
        return "started";
      },
      halt: async () => {
        calls.halt++;
        return "stopping";
      },
    };
  },
}));
const { HOST_INSTANCE, ResidentsHost, hostEnvVars, hostPlan, residentsHostTick } = await import("../src/residents-host.ts");
const { residentsReport } = await import("../src/residents.ts");
const { default: worker } = await import("../src/index.ts");

const NS = {} as NonNullable<import("../src/residents-host.ts").ResidentsHostEnv["RESIDENTS_HOST"]>;
const TOKEN = { RESIDENTS_CLIENT_ID: " 4bea329adb64a99cfe4f020046bb9bd4.access ", RESIDENTS_CLIENT_SECRET: "not-a-real-secret" };
const ON = { RESIDENTS_HOST: NS, RESIDENTS_HOST_ON: "1", ...TOKEN };

beforeEach(() => {
  calls.instances = [];
  calls.keepUp = 0;
  calls.halt = 0;
  calls.fail = null;
});

describe("the cron's call (hostPlan)", () => {
  it("keeps it up only while RESIDENTS_HOST_ON is 1, with the token and no pause", () => {
    expect(hostPlan(ON)).toEqual({ action: "keep", why: "on" });
    expect(hostPlan({ ...ON, RESIDENTS_HOST_ON: " 1 " }).action).toBe("keep");
    expect(hostPlan({ ...ON, PAUSE_RESIDENTS: "0" }).action).toBe("keep");
  });

  it("off, or no host in this Worker: never touched (no start, no stop: its object may not exist yet)", () => {
    for (const v of [undefined, "", "0", "true", "yes", "on", "2"]) expect(hostPlan({ ...ON, RESIDENTS_HOST_ON: v }).action).toBe("none");
    expect(hostPlan({ ...ON, RESIDENTS_HOST: undefined }).action).toBe("none");
    // (Off wins over the pause: nothing to stop that the cron ever started.)
    expect(hostPlan({ ...ON, RESIDENTS_HOST_ON: "0", PAUSE_RESIDENTS: "1" }).action).toBe("none");
  });

  it("PAUSE_RESIDENTS stops it, however it's written (as every PAUSE_ switch)", () => {
    for (const v of ["1", "true", "yes", "on"]) expect(hostPlan({ ...ON, PAUSE_RESIDENTS: v })).toEqual({ action: "stop", why: "paused (PAUSE_RESIDENTS)" });
  });

  it("no token (either half missing or blank): stopped, never started without one", () => {
    expect(hostPlan({ ...ON, RESIDENTS_CLIENT_ID: undefined }).action).toBe("stop");
    expect(hostPlan({ ...ON, RESIDENTS_CLIENT_ID: "  " }).action).toBe("stop");
    expect(hostPlan({ ...ON, RESIDENTS_CLIENT_SECRET: undefined }).action).toBe("stop");
    expect(hostPlan({ ...ON, RESIDENTS_CLIENT_SECRET: "" }).why).toMatch(/no token/);
  });
});

describe("the container's environment (hostEnvVars)", () => {
  it("the token as the program reads it, and the program's options: nothing else of the Worker's", () => {
    const vars = hostEnvVars({ ...ON, PAUSE_RESIDENTS: "0", ADMIN_EMAILS: "someone@example.com" } as never);
    expect(vars).toEqual({ CF_ACCESS_CLIENT_ID: "4bea329adb64a99cfe4f020046bb9bd4.access", CF_ACCESS_CLIENT_SECRET: "not-a-real-secret", RESIDENTS_ARGS: "--follow-deploys" });
    expect(RESIDENTS.host.args).toContain("--follow-deploys");
  });
});

describe("the cron's run (residentsHostTick)", () => {
  it("on: keeps the one instance up", async () => {
    expect(await residentsHostTick(ON)).toBe("started");
    expect(calls).toMatchObject({ instances: [HOST_INSTANCE], keepUp: 1, halt: 0 });
  });

  it("paused: stops it, and says why", async () => {
    expect(await residentsHostTick({ ...ON, PAUSE_RESIDENTS: "1" })).toBe("stopping: paused (PAUSE_RESIDENTS)");
    expect(calls).toMatchObject({ instances: [HOST_INSTANCE], keepUp: 0, halt: 1 });
  });

  it("off: nothing at all (null, and its object never asked for)", async () => {
    expect(await residentsHostTick({ ...ON, RESIDENTS_HOST_ON: "0" })).toBeNull();
    expect(calls).toMatchObject({ instances: [], keepUp: 0, halt: 0 });
  });

  it("a start that fails is thrown, for the cron to log and count", async () => {
    calls.fail = new Error("no capacity");
    await expect(residentsHostTick(ON)).rejects.toThrow("no capacity");
  });
});

describe("the container class (ResidentsHost)", () => {
  type Fake = InstanceType<typeof ResidentsHost> & { started: (Record<string, string> | undefined)[]; stopped: unknown[]; renewed: number; ctx: { container: { running: boolean } } };
  const host = (running: boolean, env: object = ON) => new (ResidentsHost as unknown as new (ctx: object, env: object) => Fake)({ container: { running } }, env);

  it("sleeps after RESIDENTS.host.sleepAfter without the cron's ping (two missed runs)", () => {
    expect(host(false).sleepAfter).toBe(RESIDENTS.host.sleepAfter);
    expect(RESIDENTS.host.sleepAfter).toBe("30m");
  });

  it("keepUp: starts it with the token and options when it's down; renews its time either way", async () => {
    const down = host(false);
    expect(await down.keepUp()).toBe("started");
    expect(down.started).toEqual([hostEnvVars(ON)]);
    expect(down.renewed).toBe(1);
    const up = host(true);
    expect(await up.keepUp()).toBe("running");
    expect(up.started).toEqual([]);
    expect(up.renewed).toBe(1);
  });

  it("halt: SIGTERM if it's running (the program ends its games and exits), nothing if not", async () => {
    const up = host(true);
    expect(await up.halt()).toBe("stopping");
    expect(up.stopped).toEqual(["SIGTERM"]);
    const down = host(false);
    expect(await down.halt()).toBe("stopped");
    expect(down.stopped).toEqual([]);
  });
});

describe("wired in", () => {
  afterEach(() => vi.useRealTimers());

  /** One run of the Worker's schedule, its background work all done. */
  async function cron(env: object) {
    vi.useFakeTimers();
    const { d1 } = memoryDb();
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException() {} } as unknown as ExecutionContext;
    const ASSETS = { fetch: async () => new Response("{}") } as unknown as Fetcher;
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await worker.scheduled({ scheduledTime: Date.now() } as ScheduledController, { DB: d1, ASSETS, ENGINE: {}, ...env } as never, ctx);
    while (pending.length) {
      let done = false;
      void pending.shift()!.finally(() => (done = true));
      while (!done) await vi.advanceTimersByTimeAsync(1_000);
    }
    log.mockRestore();
  }

  it("the 15-minute cron keeps it up while on, stops it while paused, and leaves it alone while off", async () => {
    await cron(ON);
    expect(calls).toMatchObject({ keepUp: 1, halt: 0 });
    await cron({ ...ON, PAUSE_RESIDENTS: "1" });
    expect(calls).toMatchObject({ keepUp: 1, halt: 1 });
    await cron({ ...ON, RESIDENTS_HOST_ON: "0" });
    expect(calls).toMatchObject({ keepUp: 1, halt: 1, instances: [HOST_INSTANCE, HOST_INSTANCE] });
  });

  it("the residents' report says what the cron does about it", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    expect((await residentsReport(sql, ON, Date.now())).host).toEqual({ action: "keep", why: "on" });
    expect((await residentsReport(sql, { ...ON, PAUSE_RESIDENTS: "1" }, Date.now())).host.action).toBe("stop");
    expect((await residentsReport(sql, {}, Date.now())).host.action).toBe("none");
  });
});
