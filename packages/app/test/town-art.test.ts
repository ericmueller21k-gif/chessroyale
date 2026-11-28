/**
 * The town's art's fingerprint (packages/app/town-art.ts, Nov 28): the key of the town's pictures kept between visits. A deploy that
 * leaves the art alone keeps the saved town; one that changes a house's art paints it again.
 */
import { describe, expect, it } from "vitest";
import { townArt } from "../town-art.ts";

const HOUSE = "packages/app/src/town/houses/alfil.ts";

describe("the town's art's fingerprint", () => {
  it("is the same for the same code, and comes from the painting code alone: not the screen, nor anything that knows the build's commit", async () => {
    const read: string[] = [];
    const a = await townArt((path, text) => (read.push(path), text));
    expect(a).toMatch(/^[0-9a-f]{12}$/);
    expect(await townArt()).toBe(a);
    // What it reads: the houses and the painting, and neither the town's screen nor the two files the build's commit is written into
    // (`__APP_VERSION__`: problems.ts, stale.ts), so another commit of the same code has the same fingerprint.
    expect(read).toContain(HOUSE);
    expect(read).toContain("packages/app/src/town/paint-jobs.ts");
    expect(read.filter((p) => /\/(Town\.tsx|problems\.ts|stale\.ts)$/.test(p))).toEqual([]);
    expect(read.every((p) => p.startsWith("packages/"))).toBe(true);
  }, 30_000);

  it("changes when a house's art does (one color of Alfil's home), and not for a comment there or a setting the town's pictures don't read", async () => {
    const base = await townArt();
    let hits = 0;
    const recolored = await townArt((path, text) => {
      if (path !== HOUSE) return text;
      const next = text.replace('"#f0d6a0"', '"#f0d6a1"');
      if (next !== text) hits++;
      return next;
    });
    expect(hits, "the house's color was there to change").toBe(1);
    expect(recolored).not.toBe(base);
    expect(await townArt((path, text) => (path === HOUSE ? `// A note.\n${text}` : text))).toBe(base);
    // (A setting the town's pictures don't read: how many versions the service worker keeps.)
    let set = 0;
    const tuned = await townArt((path, text) => {
      if (path !== "packages/core/src/settings.ts") return text;
      const next = text.replace("keepVersions: 3,", "keepVersions: 4,");
      if (next !== text) set++;
      return next;
    });
    expect(set, "the setting was there to change").toBe(1);
    expect(tuned).toBe(base);
  }, 30_000);
});
