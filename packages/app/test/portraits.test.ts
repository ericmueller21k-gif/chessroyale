import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BOSS_ROSTER } from "@chessroyale/core";
import { BOSS_KITS, artOf, bossKitOf } from "../src/characters/kits.ts";
import { renderFrame } from "../src/characters/sprite.ts";
import { CHILD_FORM, portraitName, portraitPixels } from "../src/characters/portraits.ts";
import { portraitEntries, portraitsSource } from "./portraits-make.ts";

// The portraits the first load draws (characters/portraits.ts, Nov 16: the bundle split) are each boss's own, pixel for pixel.
describe("boss portraits without the bosses' code", () => {
  it("portraits.gen.ts is made from today's drawings (npx tsx packages/app/scripts/portraits.ts writes it)", () => {
    const file = readFileSync(fileURLToPath(new URL("../src/characters/portraits.gen.ts", import.meta.url)), "utf8");
    expect(file).toBe(portraitsSource());
  });

  it("each decodes to its portrait frame as the kit draws it", () => {
    for (const [name, kit] of portraitEntries()) {
      const art = artOf(kit);
      const p = kit.portrait;
      const want = renderFrame(art, art.anims[p.anim]!.frames[p.frame]!).data;
      expect(Buffer.from(portraitPixels(name)!).equals(Buffer.from(want)), name).toBe(true);
    }
  });

  it("names the same kit as bossKitOf for every boss in the roster and the Hidden Boss's child", () => {
    const named = (boss: { name: string; form?: string }) => {
      const kit = bossKitOf(boss);
      return kit ? (portraitEntries().find(([, k]) => k === kit)?.[0] ?? "?") : null;
    };
    for (const b of BOSS_ROSTER) expect(portraitName(b), b.name).toBe(named(b));
    expect(portraitName({ name: "Hidden Boss", form: "child" })).toBe(CHILD_FORM);
    expect(named({ name: "Hidden Boss", form: "child" })).toBe(CHILD_FORM);
    expect(Object.keys(BOSS_KITS).every((k) => portraitName({ name: k }) === k)).toBe(true);
  });
});
