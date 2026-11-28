import { afterEach, describe, expect, it, vi } from "vitest";
import { OPS, TOWN_BAKED_FALLBACK, TOWN_GL_FALLBACK } from "@chessroyale/core";

/**
 * The town's WebGL fallback report (problems.ts, `reportTownFallback`; docs/decisions/2026-10-30-town-webgl.md, "Oct 30,
 * later"): once a page whatever the reason, as its own kind with the reason as the message, in the request an error makes.
 */

vi.mock("../src/account.ts", () => ({ account: () => ({ profile: null }) }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** A page's error requests, as the server would get them. */
function page() {
  const sent: { kind: string; errors: { kind: string; message: string; stack: string }[] }[] = [];
  vi.stubGlobal("location", { origin: "https://hunchess.com" });
  vi.stubGlobal("navigator", { userAgent: "test" });
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("innerHeight", 844);
  vi.stubGlobal("devicePixelRatio", 3);
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body));
    return new Response("{}");
  });
  return sent;
}

describe("the baked town not used (Nov 28, the review of phase 1b, S3: problems.ts `reportBakedFallback`)", () => {
  it("is sent once a page with its first reason, as its own kind, however often the town paints its own pictures; beside a WebGL fallback, each its own", async () => {
    vi.useFakeTimers();
    const sent = page();
    const { reportBakedFallback, reportTownFallback } = await import("../src/problems.ts");
    reportBakedFallback("stall");
    reportBakedFallback("file");
    reportTownFallback("not-back");
    await vi.advanceTimersByTimeAsync(OPS.client.batchMs + 10);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.errors.map((e) => [e.kind, e.message, e.stack])).toEqual([[TOWN_BAKED_FALLBACK.kind, "stall", ""], [TOWN_GL_FALLBACK.kind, "not-back", ""]]);
    reportBakedFallback("manifest");
    await vi.advanceTimersByTimeAsync(OPS.client.batchMs + 10);
    expect(sent).toHaveLength(1);
    expect(TOWN_BAKED_FALLBACK.reasons).toEqual(["manifest", "file", "decode", "size", "list", "stall"]);
  });
});

describe("the town's WebGL fallback", () => {
  it("is sent once a page, whatever the reason and however often the town falls back: its kind, its reason, no stack", async () => {
    vi.useFakeTimers();
    const sent: { kind: string; errors: { kind: string; message: string; stack: string }[] }[] = [];
    vi.stubGlobal("location", { origin: "https://hunchess.com" });
    vi.stubGlobal("navigator", { userAgent: "test" });
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 844);
    vi.stubGlobal("devicePixelRatio", 3);
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return new Response("{}");
    });
    const { reportTownFallback } = await import("../src/problems.ts");
    reportTownFallback("lost-twice");
    reportTownFallback("lost-twice");
    reportTownFallback("no-context");
    await vi.advanceTimersByTimeAsync(OPS.client.batchMs + 10);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.kind).toBe("errors");
    expect(sent[0]!.errors.map((e) => [e.kind, e.message, e.stack])).toEqual([[TOWN_GL_FALLBACK.kind, "lost-twice", ""]]);
    // (Exactly the fields every error request carries: no more.)
    expect(Object.keys(sent[0]!).sort()).toEqual(["account", "device", "errors", "kind", "version"]);
    expect(Object.keys(sent[0]!.errors[0]!).sort()).toEqual(["kind", "message", "stack", "trail", "where"]);
    reportTownFallback("shader");
    await vi.advanceTimersByTimeAsync(OPS.client.batchMs + 10);
    expect(sent).toHaveLength(1);
  });
});
