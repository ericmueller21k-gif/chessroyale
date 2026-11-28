import { describe, expect, it } from "vitest";
import { keepSpot, parseSpot, readSpot, spotKey } from "../src/town/spot.ts";

/** The last town spot (Eric, Nov 27; town/spot.ts): kept as you go in, let go on the street, read back only for a building you can start in. */

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};
const can = (home: string) => home === "tower" || home === "tiger";

describe("the last town spot", () => {
  it("is kept as you go in and read back on the next load; the street lets it go", () => {
    const s = memory();
    const key = spotKey("u1");
    expect(readSpot(key, can, s)).toBeNull();
    keepSpot(key, "tower", 1000, s);
    expect(JSON.parse(s.m.get(key)!)).toEqual({ home: "tower", at: 1000 });
    expect(readSpot(key, can, s)).toBe("tower");
    // (Read again: still there, a reload after a reload lands there too.)
    expect(readSpot(key, can, s)).toBe("tower");
    keepSpot(key, null, 2000, s);
    expect(readSpot(key, can, s)).toBeNull();
  });

  it("is each account's own on the device, a guest's too", () => {
    const s = memory();
    keepSpot(spotKey("a"), "tower", 1, s);
    expect(readSpot(spotKey("b"), can, s)).toBeNull();
    expect(spotKey(null)).toBe("brc.town.spot");
    expect(spotKey("g-1")).toBe("brc.town.spot.g-1");
  });

  it("a bad spot (not JSON, no home, a building gone or not one to start in): the plaza, and it's let go", () => {
    for (const raw of ["{", "null", "{}", '{"home":3}', '{"home":""}', '{"home":"recluse","at":1}', '{"home":"gone","at":1}']) {
      expect(parseSpot(raw, can)).toBeNull();
      const s = memory();
      s.setItem("k", raw);
      expect(readSpot("k", can, s)).toBeNull();
      expect(s.m.has("k"), raw).toBe(false);
    }
    expect(parseSpot('{"home":"tiger","at":5}', can)).toBe("tiger");
  });

  it("no storage (a private window): nothing kept, nothing thrown", () => {
    const broken = { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); }, removeItem: () => { throw new Error("no"); } };
    expect(() => keepSpot("k", "tower", 1, broken)).not.toThrow();
    expect(readSpot("k", can, broken)).toBeNull();
    expect(readSpot("k", can, null)).toBeNull();
  });
});
