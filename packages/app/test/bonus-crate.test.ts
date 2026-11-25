import { describe, expect, it, vi } from "vitest";
import { CRATE_BONUS, bonusOddsLine } from "@chessroyale/core";
import { BonusCard } from "../src/screens/Crates.tsx";
import { BONUS, timeline } from "../src/crate-open/timeline.ts";
import { TokenArt } from "../src/components/TokenArt.tsx";
import { KeyArt } from "../src/components/Items.tsx";
import { FAQ_DEFAULTS, faqPage } from "../src/faq/content.ts";

/**
 * The bonus crate's card (Nov 24; docs/decisions/2026-11-24-bonus-crate.md): after the item's reveal card, "BONUS!" with the crate's art
 * (a boss crate's with its token), its name, "+1 crate key" when a key came with it, and OK; each crate's odds line and the FAQ's.
 */
type V = { type: unknown; props: Record<string, unknown> & { children?: unknown } };
/** Every element in a tree, as returned (components left unrendered: their props say what they'd draw). */
function nodes(node: unknown, out: V[] = []): V[] {
  if (Array.isArray(node)) node.forEach((n) => nodes(n, out));
  else if (node && typeof node === "object" && "props" in node) {
    out.push(node as V);
    nodes((node as V).props.children, out);
  }
  return out;
}
/** Every bit of text in a tree. */
function texts(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(texts);
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (node && typeof node === "object" && "props" in node) return texts((node as V).props.children);
  return [];
}
const card = (bonus: { crate: string; key: boolean }, onOk = () => undefined) => BonusCard({ bonus, onOk });

describe("the bonus crate's card", () => {
  it("a series crate with its key: BONUS!, the crate's name, +1 crate key with the key's picture, where it is, OK", () => {
    const tree = card({ crate: "winter-1", key: true });
    const words = texts(tree).join("");
    expect(words).toContain("BONUS!");
    expect(words).toContain("+1 crate key");
    expect(words).toContain("A bonus crate and its key, in your inventory's Crates.");
    const all = nodes(tree);
    expect(all.some((n) => (n.props as { name?: string }).name === "Winter Crate · Series 1")).toBe(true);
    expect(all.some((n) => n.type === KeyArt)).toBe(true);
    // (No boss token on a series crate.)
    expect(all.some((n) => n.type === TokenArt)).toBe(false);
  });

  it("a boss crate: its boss's token on the crate, no key (a boss crate opens without one)", () => {
    const tree = card({ crate: "boss-tiger", key: false });
    const words = texts(tree).join("");
    expect(words).toContain("BONUS!");
    expect(words).not.toContain("crate key");
    expect(words).toContain("A bonus crate, in your inventory's Crates.");
    const all = nodes(tree);
    expect(all.find((n) => n.type === TokenArt)?.props.boss).toBe("tiger");
    expect(all.some((n) => (n.props as { name?: string }).name === "Babur's Boss Crate")).toBe(true);
    expect(all.some((n) => n.type === KeyArt)).toBe(false);
  });

  it("its OK closes it (back to the item's card)", () => {
    const onOk = vi.fn();
    const ok = nodes(card({ crate: "beta-001", key: true }, onOk)).find((n) => n.type === "button" && texts(n).join("").includes("OK"))!;
    expect(ok).toBeDefined();
    (ok.props.onClick as () => void)();
    expect(onOk).toHaveBeenCalledTimes(1);
  });

  it("comes a beat after the item's card has formed, its card forming as its beam comes up", () => {
    const T = timeline();
    expect(BONUS.afterCardMs).toBeGreaterThan(0);
    expect(BONUS.cardAt).toBeLessThan(BONUS.beamMs);
    // (The whole bonus is shorter than the opening's own card forming and a beat: it's the short beam.)
    expect(BONUS.cardAt + BONUS.cardMs).toBeLessThan(T.cardMs + 400);
  });
});

describe("the bonus crate's odds line", () => {
  it("each crate's odds panel and the FAQ say it in one plain line, from CRATE_BONUS", () => {
    expect(bonusOddsLine()).toMatch(/^Opening a series or boss crate: 25% chance of a bonus crate, one of \d+ crates chosen evenly /);
    expect(CRATE_BONUS.chance).toBe(0.25);
    expect(bonusOddsLine(0.3)).toContain("Opening a series or boss crate: 30% chance");
    const faq = (src = FAQ_DEFAULTS) => faqPage(src).sections.find((s) => s.id === "crates")!.body;
    expect(faq()).toContain(`**Bonus crates.** ${bonusOddsLine()}`);
    expect(faq({ ...FAQ_DEFAULTS, crateBonus: { chance: 0.1 } })).toContain("10% chance of a bonus crate");
    expect(faq()).toContain("The Welcome Crate and crates of bosses not yet released aren't in it.");
  });
});
