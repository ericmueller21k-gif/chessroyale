import { describe, expect, it } from "vitest";
import { TOWN_AFK } from "@chessroyale/core";
import { AWAY_LIMITS, AwayClock, readAwaySwitch } from "../src/town/afk.ts";
import { applyHere } from "../src/town/here-net.ts";
import { START, createTown, taken, tick, walkable, type Town } from "../src/town/world.ts";

const S = 1000;

describe("the town's away rule (Eric, Nov 7: zzz after a few minutes, out after 10 of no input or in the background)", () => {
  it("the numbers are settings.ts's: zzz at 180 s, out at 600 s idle and 600 s hidden", () => {
    expect([TOWN_AFK.zzzAfterSec, TOWN_AFK.bootAfterSec, TOWN_AFK.hiddenBootAfterSec]).toEqual([180, 600, 600]);
    expect(AWAY_LIMITS).toEqual({ zzzMs: 180 * S, bootMs: 600 * S, hiddenBootMs: 600 * S });
  });

  it("no input: here, then the zzz at 3 minutes, then out at 10", () => {
    const c = new AwayClock(0);
    expect(c.state(179.9 * S)).toBe("here");
    expect(c.state(180 * S)).toBe("zzz");
    expect(c.state(599.9 * S)).toBe("zzz");
    expect(c.state(600 * S)).toBe("out");
    expect(c.idleMs(200 * S)).toBe(200 * S);
  });

  it("any input clears the zzz at once and starts the clock again", () => {
    const c = new AwayClock(0);
    expect(c.state(300 * S)).toBe("zzz");
    c.act(300 * S);
    expect(c.state(300 * S)).toBe("here");
    expect(c.state(479 * S)).toBe("here");
    expect(c.state(480 * S)).toBe("zzz");
    expect(c.state(900 * S)).toBe("out");
    // (An input stamped earlier than the last never turns the clock back.)
    c.act(100 * S);
    expect(c.idleMs(300 * S)).toBe(0);
  });

  it("in the background 10 minutes without a break: out, the moment the page is back (a phone ran no timer meanwhile)", () => {
    const c = new AwayClock(0, { zzzMs: 180 * S, bootMs: 3600 * S, hiddenBootMs: 600 * S });
    c.hidden(true, 10 * S);
    expect(c.state(609 * S)).toBe("zzz");
    expect(c.state(610 * S)).toBe("out");
    // Back after 9 minutes: still here; hidden again counts from then.
    const d = new AwayClock(0, { zzzMs: 3600 * S, bootMs: 3600 * S, hiddenBootMs: 600 * S });
    d.hidden(true, 0);
    expect(d.state(540 * S)).toBe("here");
    d.hidden(false, 540 * S);
    d.hidden(true, 541 * S);
    expect(d.state(1140 * S)).toBe("here");
    expect(d.state(1141 * S)).toBe("out");
    // (A second "hidden" while hidden doesn't restart it.)
    d.hidden(true, 1000 * S);
    expect(d.state(1141 * S)).toBe("out");
  });

  it("a challenge or the claw machine holds the clock (no zzz, never out), and it starts again as it ends", () => {
    const c = new AwayClock(0);
    c.setBusy(true, 10 * S);
    expect(c.state(5000 * S)).toBe("here");
    expect(c.idleMs(5000 * S)).toBe(0);
    c.hidden(true, 5000 * S);
    expect(c.state(9000 * S)).toBe("here");
    c.hidden(false, 9000 * S);
    c.setBusy(false, 9000 * S);
    expect(c.state(9179 * S)).toBe("here");
    expect(c.state(9180 * S)).toBe("zzz");
  });

  it("off (the test switch ?townafk=off): always here", () => {
    const c = new AwayClock(0, null);
    c.hidden(true, 0);
    expect(c.state(86_400 * S)).toBe("here");
  });

  it("the test switch ?townafk=: off, or zzz,boot,hidden in seconds; anything else is ignored", () => {
    expect(readAwaySwitch(null)).toBeUndefined();
    expect(readAwaySwitch("off")).toBeNull();
    expect(readAwaySwitch("0")).toBeNull();
    expect(readAwaySwitch("2,5,4")).toEqual({ zzzMs: 2 * S, bootMs: 5 * S, hiddenBootMs: 4 * S });
    for (const bad of ["2,5", "a,b,c", "2,-5,4", "1,2,99999", ""]) expect(readAwaySwitch(bad)).toBeUndefined();
  });
});

describe("other players in the town from the server's list (applyHere)", () => {
  const free = (t: Town, near: { c: number; r: number }) => {
    for (let d = 2; d < 10; d++) for (const [dc, dr] of [[d, 0], [0, d], [-d, 0], [0, -d]] as const) {
      const c = near.c + dc;
      const r = near.r + dr;
      if (walkable(c, r) && !taken(t, c, r, null)) return { c, r };
    }
    throw new Error("no free square");
  };

  it("a newcomer stands on their square, fades in, and carries their zzz; you're never in it", () => {
    const t = createTown(0);
    const n0 = t.people.length;
    const sq = free(t, START);
    const gone = applyHere(t, [{ id: "u1", name: "Ann", c: sq.c, r: sq.r, zzz: true }], 500);
    expect(gone).toEqual([]);
    expect(t.people.length).toBe(n0 + 1);
    const ann = t.people.at(-1)!;
    expect([ann.uid, ann.name, ann.remote, ann.zzz, ann.home, ann.came]).toEqual(["u1", "Ann", true, true, false, 500]);
    expect(ann.walker.here()).toEqual(sq);
    expect(t.all).toContain(ann.walker);
    // The zzz clears when the server says so.
    applyHere(t, [{ id: "u1", name: "Ann", c: sq.c, r: sq.r, zzz: false }], 600);
    expect(ann.zzz).toBe(false);
    expect(t.people.length).toBe(n0 + 1);
  });

  it("someone already here walks to their new square", () => {
    const t = createTown(0);
    const a = free(t, START);
    applyHere(t, [{ id: "u1", name: "Ann", c: a.c, r: a.r, zzz: false }], 0);
    const ann = t.people.at(-1)!;
    const b = free(t, a);
    applyHere(t, [{ id: "u1", name: "Ann", c: b.c, r: b.r, zzz: false }], 100);
    expect(ann.walker.goal()).toEqual(b);
    for (let ms = 100; ms < 20_000 && ann.walker.moving(); ms += 16) tick(t, ms);
    expect(ann.walker.here()).toEqual(b);
  });

  it("someone no longer listed leaves for everyone (not drawn, off every square, a card on them closes) and can come back", () => {
    const t = createTown(0);
    const a = free(t, START);
    applyHere(t, [{ id: "u1", name: "Ann", c: a.c, r: a.r, zzz: true }], 0);
    const ann = t.people.at(-1)!;
    const n = t.people.length;
    const gone = applyHere(t, [], 100);
    expect(gone).toEqual([ann]);
    expect([ann.home, ann.zzz]).toEqual([true, false]);
    expect(t.all).not.toContain(ann.walker);
    expect(taken(t, a.c, a.r, null)).toBe(false);
    // (Indices stay put: a card open on anyone else still points at them.)
    expect(t.people.length).toBe(n);
    applyHere(t, [{ id: "u1", name: "Ann", c: a.c, r: a.r, zzz: false }], 200);
    expect([ann.home, ann.came, t.people.length]).toEqual([false, 200, n]);
    expect(t.all).toContain(ann.walker);
  });

  it("the test player and the bots are never taken out by the list", () => {
    const t = createTown(0);
    const before = t.people.filter((p) => !p.home).length;
    applyHere(t, [], 0);
    expect(t.people.filter((p) => !p.home).length).toBe(before);
  });

  it("a square off the map or not walkable is ignored", () => {
    const t = createTown(0);
    const n = t.people.length;
    applyHere(t, [{ id: "u9", name: "X", c: -1, r: 3, zzz: false }, { id: "u8", name: "Y", c: 9999, r: 0, zzz: false }], 0);
    expect(t.people.length).toBe(n);
  });
});
