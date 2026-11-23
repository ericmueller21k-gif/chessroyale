import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { VNode } from "preact";
import { BankBox } from "../src/screens/Hud.tsx";
import { clockShown } from "../src/clock-text.ts";

/**
 * The top bar's bank time once you're out (the second delta review of #881, N1: Classic's final places its finalists as its last move
 * plays, and the bank went from the bar then, shifting it; a team final's step that puts you out too). Eric's "nothing shifts"
 * (docs/rules/eric.md, "Every screen"): the box stays, the same element with the same text (tabular figures: the same width), only
 * unseen, by `visibility: hidden`, which keeps its box in the row (never `display: none`, which takes it out).
 */
describe("the bank's box when you're out (nothing shifts)", () => {
  const box = (bank: number, out: boolean) => BankBox({ bank, out }) as VNode<{ class: string; children: string; "aria-hidden"?: string }>;

  it("out, the same box with the same text, marked out and unseen; in, as before", () => {
    for (const bank of [95_000, 42_000]) {
      const shown = box(bank, false);
      const out = box(bank, true);
      expect(out.type).toBe(shown.type);
      expect(out.props.children).toBe(clockShown(bank));
      expect(out.props.children).toBe(shown.props.children);
      expect(out.props.class).toBe("hud-bank out");
      expect(out.props["aria-hidden"]).toBe("true");
      expect(shown.props.class).toBe(bank < 60_000 ? "hud-bank low" : "hud-bank");
      expect(shown.props["aria-hidden"]).toBeUndefined();
    }
  });

  it("the stylesheet hides it in place: visibility, never display", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    const rule = /\.hud-bank\.out\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/visibility:\s*hidden/);
    expect(css).not.toMatch(/\.hud-bank(\.out)?[^{]*\{[^}]*display:\s*none/);
  });
});
