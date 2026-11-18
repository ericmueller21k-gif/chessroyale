import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FRONT_DOOR } from "@chessroyale/core";
import { LOAD_STEPS, loadStep } from "../src/loadbar.ts";

describe("the loading bar (Eric, Nov 10: only past a ~2 s hang)", () => {
  it("index.html's shell waits and gives up by FRONT_DOOR's numbers", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const m = html.match(/var AFTER = (\d+), STALL = (\d+);/);
    expect(m, "the bar's numbers in index.html").toBeTruthy();
    expect([Number(m![1]), Number(m![2])]).toEqual([FRONT_DOOR.loadBarAfterMs, FRONT_DOOR.loadBarStallMs]);
    // The shell's own first step, before the app's script: the game, at a tenth.
    expect(html).toContain('<p class="hc-load-line">Loading the game…</p>');
    expect(html).toMatch(/at = 0\.1,/);
  });

  it("the steps only move forward, from the shell's tenth to short of full, each a plain line", () => {
    const steps = Object.values(LOAD_STEPS);
    expect(steps.map(([, line]) => line)).toEqual(["Signing you in…", "Loading your account…", "Almost there…"]);
    let at = 0.1;
    for (const [to] of steps) {
      expect(to).toBeGreaterThan(at);
      at = to;
    }
    expect(at).toBeLessThan(1);
  });

  it("does nothing without the shell (no page, or the shell gone)", () => {
    expect(() => loadStep("account")).not.toThrow();
    const seen: [number, string][] = [];
    (globalThis as { hcLoad?: unknown }).hcLoad = (to: number, line: string) => seen.push([to, line]);
    loadStep("last");
    delete (globalThis as { hcLoad?: unknown }).hcLoad;
    expect(seen).toEqual([[0.85, "Almost there…"]]);
  });
});
