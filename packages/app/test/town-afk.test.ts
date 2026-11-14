import { describe, expect, it } from "vitest";
import { ITEM_COLORS, TOWN_AFK, cleanLook } from "@chessroyale/core";
import { AWAY_LIMITS, AwayClock, GuestTime, readAwaySwitch, readGuestSwitch } from "../src/town/afk.ts";
import { applyHere } from "../src/town/here-net.ts";
import { START, createTown, taken, tick, walkable, type Town } from "../src/town/world.ts";

const S = 1000;

describe("the town's away rule (Eric, Nov 7; on #542: zzz after 1 minute, out after 5 of no input or in the background)", () => {
  it("the numbers are settings.ts's: zzz at 60 s, out at 300 s idle and 300 s hidden; a guest's 30 s", () => {
    expect([TOWN_AFK.zzzAfterSec, TOWN_AFK.bootAfterSec, TOWN_AFK.hiddenBootAfterSec, TOWN_AFK.guestTownSec]).toEqual([60, 300, 300, 30]);
    expect(AWAY_LIMITS).toEqual({ zzzMs: 60 * S, bootMs: 300 * S, hiddenBootMs: 300 * S });
  });

  it("no input: here, then the zzz at 1 minute, then out at 5", () => {
    const c = new AwayClock(0);
    expect(c.state(59.9 * S)).toBe("here");
    expect(c.state(60 * S)).toBe("zzz");
    expect(c.state(299.9 * S)).toBe("zzz");
    expect(c.state(300 * S)).toBe("out");
    expect(c.idleMs(200 * S)).toBe(200 * S);
  });

  it("any input clears the zzz at once and starts the clock again", () => {
    const c = new AwayClock(0);
    expect(c.state(200 * S)).toBe("zzz");
    c.act(200 * S);
    expect(c.state(200 * S)).toBe("here");
    expect(c.state(259 * S)).toBe("here");
    expect(c.state(260 * S)).toBe("zzz");
    expect(c.state(500 * S)).toBe("out");
    // (An input stamped earlier than the last never turns the clock back.)
    c.act(100 * S);
    expect(c.idleMs(200 * S)).toBe(0);
  });

  it("in the background for the limit without a break: out, the moment the page is back (a phone ran no timer meanwhile)", () => {
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
    expect(c.state(9059 * S)).toBe("here");
    expect(c.state(9060 * S)).toBe("zzz");
  });

  it("the loading screen holds the idle clock (no zzz, never out for idling) but not the background's (Nov 14)", () => {
    const c = new AwayClock(0);
    c.setLoading(true, 0);
    expect(c.state(5000 * S)).toBe("here");
    expect(c.idleMs(5000 * S)).toBe(0);
    // Loaded: the idle clock starts from then.
    c.setLoading(false, 5000 * S);
    expect(c.state(5059 * S)).toBe("here");
    expect(c.state(5060 * S)).toBe("zzz");
    // Put away as it loads (a phone in the background runs no frames, so it stays loading): out at the background's limit, the moment
    // the page is back, as any other page.
    const d = new AwayClock(0, { zzzMs: 3600 * S, bootMs: 3600 * S, hiddenBootMs: 4 * S });
    d.setLoading(true, 0);
    d.hidden(true, 1 * S);
    expect(d.state(4.9 * S)).toBe("here");
    expect(d.state(5 * S)).toBe("out");
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
    const { gone, dressed } = applyHere(t, [{ id: "u1", name: "Ann", c: sq.c, r: sq.r, zzz: true }], 500);
    expect([gone, dressed]).toEqual([[], []]);
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
    const { gone } = applyHere(t, [], 100);
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
  it("what they wear, as the server says: dressed when it's new or changed (and only then), a plain pawn again with nothing on", () => {
    const t = createTown(0);
    const a = free(t, START);
    const hat = { head: { def: "beanie", color: ITEM_COLORS[0]!.id, blemish: 0, seed: 1 } };
    const look = cleanLook(hat);
    expect(Object.keys(look)).toEqual(["head"]);
    const slot = "head";
    const first = applyHere(t, [{ id: "u1", name: "Ann", c: a.c, r: a.r, zzz: false, look: hat }], 0);
    const ann = t.people.at(-1)!;
    if (slot) {
      expect(first.dressed).toEqual([ann]);
      expect("wear" in ann.look && ann.look.wear).toEqual(look);
      expect(applyHere(t, [{ id: "u1", name: "Ann", c: a.c, r: a.r, zzz: false, look: hat }], 10).dressed).toEqual([]);
      expect(applyHere(t, [{ id: "u1", name: "Ann", c: a.c, r: a.r, zzz: false }], 20).dressed).toEqual([ann]);
    }
    expect("wear" in ann.look && ann.look.wear).toBeNull();
  });
});

describe("a guest's town time (Eric, on #542: \"like 30 seconds\", then make an account)", () => {
  it("counts only while the page is visible, and carries on from the last visit's time", () => {
    const g = new GuestTime();
    g.visible(true, 0);
    expect(g.usedMs(10 * S)).toBe(10 * S);
    g.visible(false, 10 * S);
    expect(g.usedMs(500 * S)).toBe(10 * S);
    g.visible(true, 500 * S);
    g.visible(true, 505 * S);
    expect(g.usedMs(520 * S)).toBe(30 * S);
    const next = new GuestTime(g.usedMs(520 * S));
    expect(next.usedMs(0)).toBe(30 * S);
  });

  it("the test switch ?townguest=: seconds, or off; anything else is ignored", () => {
    expect(readGuestSwitch(null)).toBeUndefined();
    expect(readGuestSwitch("off")).toBeNull();
    expect(readGuestSwitch("3")).toBe(3 * S);
    for (const bad of ["x", "-1", "99999", ""]) expect(readGuestSwitch(bad)).toBeUndefined();
  });
});
