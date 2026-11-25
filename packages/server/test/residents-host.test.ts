import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RESIDENTS } from "@chessroyale/core";
import { ensureSchema } from "../src/accounts.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * The residents' always-on host (residents-host.ts; docs/areas/ops.md, "Residents, the host"): once its image exists
 * (RESIDENTS_HOST_IMAGE "1"; before, its Durable Object can't be made, so the cron never touches it), the 15-minute cron keeps the
 * container up while RESIDENTS_HOST_ON is "1", and stops it while paused, off or without the token. The container gets the token and
 * the program's options, nothing else; a running one whose environment changed (a new secret) is stopped, for a fresh start.
 */

// (The real Container needs the Workers runtime: a stand-in that records what the host asks of it, and a getContainer whose stub
// records the cron's calls.)
const calls = vi.hoisted(() => ({ instances: [] as string[], keepUp: 0, halt: 0, fail: null as Error | null, halted: "stopping" as "stopping" | "stopped" }));
vi.mock("@cloudflare/containers", () => ({
  Container: class {
    ctx: { container: { running: boolean }; storage: unknown };
    env: unknown;
    started: (Record<string, string> | undefined)[] = [];
    stopped: unknown[] = [];
    renewed = 0;
    constructor(ctx: { container: { running: boolean }; storage: unknown }, env: unknown) {
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
        return calls.halted;
      },
    };
  },
}));
const { ENV_HASH_KEY, LAST_EXIT_KEY, REFUSED_EXIT, HOST_INSTANCE, ResidentsHost, envHash, hostEnvVars, hostPlan, residentsHostTick } = await import("../src/residents-host.ts");
const { residentsReport } = await import("../src/residents.ts");
const { default: worker } = await import("../src/index.ts");

const NS = {} as NonNullable<import("../src/residents-host.ts").ResidentsHostEnv["RESIDENTS_HOST"]>;
// (The secret as it might be pasted, with a newline: the container gets it trimmed. The review's n3.)
const TOKEN = { RESIDENTS_CLIENT_ID: " 4bea329adb64a99cfe4f020046bb9bd4.access ", RESIDENTS_CLIENT_SECRET: "not-a-real-secret\n" };
const ON = { RESIDENTS_HOST: NS, RESIDENTS_HOST_IMAGE: "1", RESIDENTS_HOST_ON: "1", ...TOKEN };
const OFF_VALUES = [undefined, "", "0", "true", "yes", "on", "2"];

beforeEach(() => {
  calls.instances = [];
  calls.keepUp = 0;
  calls.halt = 0;
  calls.fail = null;
  calls.halted = "stopping";
});

describe("the cron's call (hostPlan)", () => {
  it("keeps it up only while RESIDENTS_HOST_ON is 1, with the token and no pause", () => {
    expect(hostPlan(ON)).toEqual({ action: "keep", why: "on" });
    expect(hostPlan({ ...ON, RESIDENTS_HOST_ON: " 1 " }).action).toBe("keep");
    expect(hostPlan({ ...ON, PAUSE_RESIDENTS: "0" }).action).toBe("keep");
  });

  it("no image yet, or no host in this Worker: never touched, whatever the switches say (its object can't be made yet)", () => {
    for (const v of OFF_VALUES) expect(hostPlan({ ...ON, RESIDENTS_HOST_IMAGE: v })).toEqual({ action: "none", why: "no image yet (RESIDENTS_HOST_IMAGE isn't 1)" });
    // (On before the image: still nothing, so the cron doesn't throw every 15 minutes. The review's n5.)
    expect(hostPlan({ ...ON, RESIDENTS_HOST_IMAGE: undefined, PAUSE_RESIDENTS: "1" }).action).toBe("none");
    expect(hostPlan({ ...ON, RESIDENTS_HOST: undefined }).action).toBe("none");
  });

  it("off: stopped at each run, never left to sleep on its own (every deploy renews the library's sleep deadline: the review's M2)", () => {
    for (const v of OFF_VALUES) expect(hostPlan({ ...ON, RESIDENTS_HOST_ON: v })).toEqual({ action: "stop", why: "off (RESIDENTS_HOST_ON isn't 1)" });
  });

  it("PAUSE_RESIDENTS stops it, however it's written (as every PAUSE_ switch), checked first: off or not", () => {
    for (const v of ["1", "true", "yes", "on"]) expect(hostPlan({ ...ON, PAUSE_RESIDENTS: v })).toEqual({ action: "stop", why: "paused (PAUSE_RESIDENTS)" });
    expect(hostPlan({ ...ON, RESIDENTS_HOST_ON: "0", PAUSE_RESIDENTS: "1" })).toEqual({ action: "stop", why: "paused (PAUSE_RESIDENTS)" });
  });

  it("no token (either half missing or blank): stopped, never started without one", () => {
    expect(hostPlan({ ...ON, RESIDENTS_CLIENT_ID: undefined }).action).toBe("stop");
    expect(hostPlan({ ...ON, RESIDENTS_CLIENT_ID: "  " }).action).toBe("stop");
    expect(hostPlan({ ...ON, RESIDENTS_CLIENT_SECRET: undefined }).action).toBe("stop");
    expect(hostPlan({ ...ON, RESIDENTS_CLIENT_SECRET: "" }).why).toMatch(/no token/);
    expect(hostPlan({ ...ON, RESIDENTS_CLIENT_SECRET: " \n" }).why).toMatch(/no token/);
  });
});

describe("the container's environment (hostEnvVars)", () => {
  it("the token as the program reads it (trimmed), and the program's options: nothing else of the Worker's", () => {
    const vars = hostEnvVars({ ...ON, PAUSE_RESIDENTS: "0", ADMIN_EMAILS: "someone@example.com" } as never);
    expect(vars).toEqual({ CF_ACCESS_CLIENT_ID: "4bea329adb64a99cfe4f020046bb9bd4.access", CF_ACCESS_CLIENT_SECRET: "not-a-real-secret", RESIDENTS_ARGS: "--follow-deploys" });
    expect(RESIDENTS.host.args).toContain("--follow-deploys");
  });

  it("its hash: the same for the same environment, another for any change (a new secret, new options), never the values", async () => {
    const vars = hostEnvVars(ON);
    const hash = await envHash(vars);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("not-a-real-secret");
    expect(await envHash({ ...vars })).toBe(hash);
    expect(await envHash({ ...vars, CF_ACCESS_CLIENT_SECRET: "rotated" })).not.toBe(hash);
    expect(await envHash({ ...vars, RESIDENTS_ARGS: "--follow-deploys --flat" })).not.toBe(hash);
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

  it("off: stops it, and says why; stopped already, nothing to say (null)", async () => {
    expect(await residentsHostTick({ ...ON, RESIDENTS_HOST_ON: "0" })).toBe("stopping: off (RESIDENTS_HOST_ON isn't 1)");
    expect(calls).toMatchObject({ instances: [HOST_INSTANCE], keepUp: 0, halt: 1 });
    calls.halted = "stopped";
    expect(await residentsHostTick({ ...ON, RESIDENTS_HOST_ON: "0" })).toBeNull();
    expect(calls).toMatchObject({ keepUp: 0, halt: 2 });
  });

  it("no image yet: nothing at all (null, and its object never asked for)", async () => {
    expect(await residentsHostTick({ ...ON, RESIDENTS_HOST_IMAGE: "0" })).toBeNull();
    expect(calls).toMatchObject({ instances: [], keepUp: 0, halt: 0 });
  });

  it("a start that fails is thrown, for the cron to log and count", async () => {
    calls.fail = new Error("no capacity");
    await expect(residentsHostTick(ON)).rejects.toThrow("no capacity");
  });
});

describe("the container class (ResidentsHost)", () => {
  type Fake = InstanceType<typeof ResidentsHost> & { started: (Record<string, string> | undefined)[]; stopped: unknown[]; renewed: number; ctx: { container: { running: boolean } } };
  /** A stand-in for the object's storage (get and put, as DurableObjectStorage's). */
  const storage = (kept: Record<string, unknown> = {}) => {
    const map = new Map(Object.entries(kept));
    return { map, get: async (k: string) => map.get(k), put: async (k: string, v: unknown) => void map.set(k, v) };
  };
  const host = (running: boolean, env: object = ON, kept = storage()) => new (ResidentsHost as unknown as new (ctx: object, env: object) => Fake)({ container: { running }, storage: kept }, env);

  it("sleeps after RESIDENTS.host.sleepAfter without the cron's ping (two missed runs)", () => {
    expect(host(false).sleepAfter).toBe(RESIDENTS.host.sleepAfter);
    expect(RESIDENTS.host.sleepAfter).toBe("30m");
  });

  it("keepUp: starts it with the token and options when it's down, keeping its environment's hash (never a value); renews its time", async () => {
    const kept = storage();
    const down = host(false, ON, kept);
    expect(await down.keepUp()).toBe("started");
    expect(down.started).toEqual([hostEnvVars(ON)]);
    expect(down.renewed).toBe(1);
    expect([...kept.map]).toEqual([[ENV_HASH_KEY, await envHash(hostEnvVars(ON))]]);
    expect(JSON.stringify([...kept.map])).not.toContain("not-a-real-secret");
    // (Running with the same environment: only its time renewed.)
    const up = host(true, ON, kept);
    expect(await up.keepUp()).toBe("running");
    expect(up.started).toEqual([]);
    expect(up.stopped).toEqual([]);
    expect(up.renewed).toBe(1);
  });

  it("keepUp: running with another environment (the secret rotated) or an unknown one, it's stopped for the next run's fresh start (M1, m4)", async () => {
    const kept = storage();
    await host(false, ON, kept).keepUp();
    const rotated = host(true, { ...ON, RESIDENTS_CLIENT_SECRET: "rotated-not-real" }, kept);
    expect(await rotated.keepUp()).toBe("restarting");
    expect(rotated.stopped).toEqual(["SIGTERM"]);
    expect(rotated.started).toEqual([]);
    expect(rotated.renewed).toBe(0);
    const unknown = host(true, ON, storage());
    expect(await unknown.keepUp()).toBe("restarting");
    expect(unknown.stopped).toEqual(["SIGTERM"]);
    // (Down by then: the next run starts it with the new secret, and keeps the new hash.)
    const next = host(false, { ...ON, RESIDENTS_CLIENT_SECRET: "rotated-not-real" }, kept);
    expect(await next.keepUp()).toBe("started");
    expect(next.started[0]?.CF_ACCESS_CLIENT_SECRET).toBe("rotated-not-real");
    expect(kept.map.get(ENV_HASH_KEY)).toBe(await envHash(next.started[0]!));
  });

  it("keepUp: Access refused the token at the last start (exit 78) with the same environment: started again, but thrown, so the cron counts it (the delta review's minor 1); a new secret, or another exit: no error", async () => {
    const kept = storage();
    await host(false, ON, kept).keepUp();
    (host(true, ON, kept) as unknown as { onStop(p: object): void }).onStop({ exitCode: REFUSED_EXIT, reason: "exit" });
    await Promise.resolve();
    expect(kept.map.get(LAST_EXIT_KEY)).toBe(REFUSED_EXIT);
    const again = host(false, ON, kept);
    await expect(again.keepUp()).rejects.toThrow(/Access refused the residents' token/);
    expect(again.started).toEqual([hostEnvVars(ON)]);
    // (The secret fixed on the Worker: a new environment, no error.)
    const fixed = host(false, { ...ON, RESIDENTS_CLIENT_SECRET: "fixed-not-real" }, kept);
    expect(await fixed.keepUp()).toBe("started");
    // (Any other exit, the same environment: no error.)
    const other = storage();
    await host(false, ON, other).keepUp();
    (host(true, ON, other) as unknown as { onStop(p: object): void }).onStop({ exitCode: 1, reason: "exit" });
    await Promise.resolve();
    expect(await host(false, ON, other).keepUp()).toBe("started");
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

  it("the 15-minute cron keeps it up while on, stops it while paused or off, and leaves it alone with no image", async () => {
    await cron(ON);
    expect(calls).toMatchObject({ keepUp: 1, halt: 0 });
    await cron({ ...ON, PAUSE_RESIDENTS: "1" });
    expect(calls).toMatchObject({ keepUp: 1, halt: 1 });
    await cron({ ...ON, RESIDENTS_HOST_ON: "0" });
    expect(calls).toMatchObject({ keepUp: 1, halt: 2 });
    await cron({ ...ON, RESIDENTS_HOST_IMAGE: "0" });
    expect(calls).toMatchObject({ keepUp: 1, halt: 2, instances: [HOST_INSTANCE, HOST_INSTANCE, HOST_INSTANCE] });
  });

  it("the residents' report says what the cron does about it", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    expect((await residentsReport(sql, ON, Date.now())).host).toEqual({ action: "keep", why: "on" });
    expect((await residentsReport(sql, { ...ON, PAUSE_RESIDENTS: "1" }, Date.now())).host.action).toBe("stop");
    expect((await residentsReport(sql, { ...ON, RESIDENTS_HOST_ON: "0" }, Date.now())).host.action).toBe("stop");
    expect((await residentsReport(sql, {}, Date.now())).host.action).toBe("none");
  });
});
