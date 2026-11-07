import { describe, expect, it } from "vitest";
import { HERE_LIMITS, TownHere, type HereBeat } from "../src/town-here.ts";
import { readBeat, readLimits } from "../src/town-here-api.ts";

const S = 1000;
const at = (c: number, r: number, idleMs = 0, hidden = false, shop: string | null = null): HereBeat => ({ c, r, idleMs, hidden, shop });

describe("who's in the town square (town-here.ts): the server drops an away pawn itself (Eric, Nov 7)", () => {
  it("the numbers are TOWN_AFK's: zzz at 60 s, out at 300 s idle and 300 s hidden (Eric, on #542), silent from 20 s", () => {
    expect(HERE_LIMITS).toEqual({ zzzMs: 60 * S, bootMs: 300 * S, hiddenBootMs: 300 * S, silentMs: 20 * S });
  });

  it("everyone else in the room, with their zzz; not you, not another room's, not someone in a shop", () => {
    const h = new TownHere();
    h.beat("ann", "Ann", "town", at(1, 2), 0);
    h.beat("bo", "Bo", "town", at(3, 4, 70 * S), 0);
    h.beat("cy", "Cy", "other", at(5, 6), 0);
    h.beat("di", "Di", "town", at(7, 8, 0, false, "babur"), 0);
    expect(h.view("town", 0, "ann")).toEqual([{ id: "bo", name: "Bo", c: 3, r: 4, zzz: true }]);
    expect(h.view("town", 0, "bo")).toEqual([{ id: "ann", name: "Ann", c: 1, r: 2, zzz: false }]);
  });

  it("the zzz from the idle time a beat says, and gone the beat after an input", () => {
    const h = new TownHere();
    h.beat("bo", "Bo", "town", at(3, 4, 50 * S), 0);
    expect(h.view("town", 9 * S, null)[0]!.zzz).toBe(false);
    expect(h.view("town", 10 * S, null)[0]!.zzz).toBe(true);
    h.beat("bo", "Bo", "town", at(3, 5, 0), 11 * S);
    expect(h.view("town", 11 * S, null)[0]).toEqual({ id: "bo", name: "Bo", c: 3, r: 5, zzz: false });
  });

  it("no input for 5 minutes: dropped for everyone, beats or not", () => {
    const h = new TownHere();
    for (let t = 0; t < 300 * S; t += 5 * S) h.beat("bo", "Bo", "town", at(3, 4, t), t);
    expect(h.view("town", 299 * S, null)).toHaveLength(1);
    expect(h.view("town", 300 * S, null)).toEqual([]);
    expect(h.has("bo")).toBe(false);
  });

  it("in the background 5 minutes (the beat it sent as it hid): dropped, though it sends nothing more", () => {
    const h = new TownHere();
    h.beat("bo", "Bo", "town", at(3, 4, 0, true), 0);
    expect(h.view("town", 299 * S, null)).toHaveLength(1);
    expect(h.sweep(300 * S)).toEqual(["bo"]);
  });

  it("a device gone silent counts as in the background from its last beat (a phone hid without a word)", () => {
    const h = new TownHere();
    h.beat("bo", "Bo", "town", at(3, 4), 0);
    expect(h.sweep(19 * S)).toEqual([]);
    expect(h.sweep(299 * S)).toEqual([]);
    expect(h.sweep(300 * S)).toEqual(["bo"]);
  });

  it("back from the background: the clock is the beat's again", () => {
    const h = new TownHere();
    h.beat("bo", "Bo", "town", at(3, 4, 0, true), 0);
    h.beat("bo", "Bo", "town", at(3, 4, 0, false), 250 * S);
    expect(h.sweep(260 * S)).toEqual([]);
    // (A second hidden beat keeps when it first hid.)
    h.beat("bo", "Bo", "town", at(3, 4, 0, true), 262 * S);
    h.beat("bo", "Bo", "town", at(3, 4, 0, true), 264 * S);
    expect(h.sweep(561 * S)).toEqual([]);
    expect(h.sweep(562 * S)).toEqual(["bo"]);
  });

  it("a beat after being dropped brings the pawn back; a leave takes it out at once", () => {
    const h = new TownHere();
    h.beat("bo", "Bo", "town", at(3, 4, 0, true), 0);
    h.sweep(300 * S);
    h.beat("bo", "Bo", "town", at(3, 4), 301 * S);
    expect(h.view("town", 301 * S, null)).toHaveLength(1);
    h.leave("bo");
    expect(h.view("town", 301 * S, null)).toEqual([]);
  });

  it("a test's own limits (test switches only, read by the API) drop by them", () => {
    const h = new TownHere();
    const L = readLimits({ zzz: 2, boot: 5, hidden: 4 })!;
    expect(L).toEqual({ zzzMs: 2 * S, bootMs: 5 * S, hiddenBootMs: 4 * S, silentMs: 20 * S });
    h.beat("bo", "Bo", "t", at(3, 4, 0), 0, L);
    expect(h.view("t", 2 * S, null)[0]!.zzz).toBe(true);
    expect(h.view("t", 5 * S, null)).toEqual([]);
    h.beat("cy", "Cy", "t", at(3, 4, 0, true), 0, L);
    expect(h.sweep(4 * S)).toEqual(["cy"]);
    expect(readLimits(null)).toBeUndefined();
    expect(readLimits({ zzz: 0, boot: "x" })).toEqual(HERE_LIMITS);
  });

  it("what each one wears goes with them (Eric, on #542); a guest watching gets the looks and no names", () => {
    const h = new TownHere();
    const look = { head: { def: "beanie", color: "red", blemish: 0, seed: 1 } };
    h.beat("bo", "Bo", "town", at(3, 4), 0, undefined, look);
    h.beat("cy", "Cy", "town", at(5, 6), 0);
    expect(h.view("town", 0, null)).toEqual([
      { id: "bo", name: "Bo", c: 3, r: 4, zzz: false, look },
      { id: "cy", name: "Cy", c: 5, r: 6, zzz: false },
    ]);
    expect(h.view("town", 0, null, undefined, false).map((o) => [o.name, o.look ?? null])).toEqual([
      ["", look],
      ["", null],
    ]);
  });

  it("a beat's fields are checked: whole squares, a sane idle time, a shop's id", () => {
    expect(readBeat({ c: 3, r: 4, idleMs: 12, hidden: true, shop: "babur" })).toEqual({ c: 3, r: 4, idleMs: 12, hidden: true, shop: "babur" });
    expect(readBeat({ c: 3.5, r: 4 })).toBeNull();
    expect(readBeat({ c: "3", r: 4 })).toBeNull();
    expect(readBeat({ c: 3, r: 4, idleMs: -5, shop: "<b>" })).toEqual({ c: 3, r: 4, idleMs: 0, hidden: false, shop: null });
    expect(readBeat({ c: 3, r: 4, idleMs: 1e12 })!.idleMs).toBe(86_400_000);
  });
});
