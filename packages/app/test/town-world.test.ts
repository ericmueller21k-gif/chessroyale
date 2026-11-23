import { describe, expect, it } from "vitest";
import { N, wrapF, wrapI } from "../src/town/camera.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { APRON, BOTS, COLISEUM, HOMES, START, STATUES, TABLES, Walker, createTown, destFor, onColiseum, seated, statueAt, stoolAt, tableStates, taken, tick, walkWalker, walkable, type Sq, type Town } from "../src/town/world.ts";

/** One pawn a square (src/town/world.ts): where a walk ends, and rings of people round someone. */

const king = (a: Sq, b: Sq) => Math.max(Math.abs(wrapF(a.c - b.c)), Math.abs(wrapF(a.r - b.r)));
/**
 * Open ground: Fountain Street's board between Seam Avenue and the east, no homes, bosses' boxes, bots or anything standing within two
 * squares. (The Colosseum's middle until slice 5 built it; then open ground in the old town until it went, Nov 13.)
 */
const SPOT: Sq = { c: 28, r: 13 };

/** A town with nobody wandering off on their own (the bots stay put; the bosses are far from the middle). */
function still(): Town {
  const t = createTown(0, undefined, null, BOTS.length);
  t.nextBotAt = Infinity;
  return t;
}
/** Runs the town until nobody is walking (or a minute has passed). */
function settle(t: Town, from = 0): number {
  let now = from;
  for (let i = 0; i < 4000; i++) {
    now += 16;
    tick(t, now);
    if (!t.people.some((p) => p.walker.moving())) break;
  }
  return now;
}
/** Nobody shares a square (`passing`: but a walker passing through on its way, which people may: only where they stop counts). */
function apart(t: Town, passing: (w: Walker) => boolean = () => false) {
  const seen = new Set<number>();
  for (const w of t.all) {
    if (passing(w)) continue;
    const k = w.hereR() * N + w.hereC();
    expect(seen.has(k), `two on (${w.hereC()}, ${w.hereR()})`).toBe(false);
    seen.add(k);
  }
}

describe("town square: one pawn a square", () => {
  it("tapping a taken square ends you next to it, on a free square", () => {
    const t = still();
    const bot = t.bots[0]!.walker.here();
    const to = destFor(t, t.you.walker, { kind: "square", c: bot.c, r: bot.r })!;
    expect(king(to, bot)).toBe(1);
    expect(walkable(to.c, to.r)).toBe(true);
    expect(taken(t, to.c, to.r, t.you.walker)).toBe(false);
    walkWalker(t.you.walker, to);
    settle(t);
    expect(t.you.walker.here()).toEqual(to);
    apart(t);
  });

  it("tapping a home walks you in front of its door (Eric, Nov 5): its door square (the sidewalk before its door), or one either side if that's taken", () => {
    // (The street town for everyone since Nov 13: a home's door square is its plan's, before its lot's front; the old town's was the row
    // before its plot's middle.)
    for (const h of HOMES) {
      const t = still();
      const to = destFor(t, t.you.walker, { kind: "home", home: h })!;
      expect(to, h.name).not.toBeNull();
      expect(wrapI(to.r), `${h.name}: its door square's row`).toBe(wrapI(h.door.r));
      expect(Math.abs(wrapF(to.c - h.door.c)), `${h.name}: on its door square, or one either side`).toBeLessThanOrEqual(1);
      expect(walkable(to.c, to.r) && !taken(t, to.c, to.r, t.you.walker)).toBe(true);
    }
  });

  it("a free square is its own end; tapping a person or a boss ends you beside them", () => {
    const t = still();
    expect(destFor(t, t.you.walker, { kind: "square", ...SPOT })).toEqual(SPOT);
    const b = t.bosses[2]!.walker.here();
    const to = destFor(t, t.you.walker, { kind: "beside", at: b })!;
    expect(king(to, b)).toBe(1);
  });

  it("the end square is always free: tap after tap, nobody ever ends on someone else's square", () => {
    const t = still();
    let now = 0;
    let seed = 7;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let n = 0; n < 40; n++) {
      // Somewhere near you, or right onto a bot.
      const target: Sq = n % 3 === 0 ? t.bots[n % t.bots.length]!.walker.here() : { c: wrapI(t.you.walker.hereC() + Math.floor(rnd() * 9) - 4), r: wrapI(t.you.walker.hereR() + Math.floor(rnd() * 9) - 4) };
      const to = destFor(t, t.you.walker, { kind: "square", ...target });
      if (!to) continue;
      expect(taken(t, to.c, to.r, t.you.walker)).toBe(false);
      walkWalker(t.you.walker, to);
      now = settle(t, now);
      apart(t);
    }
  });

  it("someone stepping onto your last square first: you stop on the nearest free square beside it", () => {
    const t = still();
    const bot = t.bots[0]!.walker;
    // The bot claims the spot first (walks there), then your walk is sent to the very same square.
    walkWalker(bot, SPOT);
    walkWalker(t.you.walker, SPOT);
    settle(t);
    expect(bot.here()).toEqual(SPOT);
    expect(king(t.you.walker.here(), SPOT)).toBe(1);
    apart(t);
  });

  it("three bots sent to one spot ring round it, a square each", () => {
    const t = still();
    for (const p of t.bots.slice(0, 3)) walkWalker(p.walker, destFor(t, p.walker, { kind: "beside", at: SPOT })!);
    settle(t);
    const ring = t.bots.slice(0, 3).map((p) => p.walker.here());
    for (const s of ring) expect(king(s, SPOT)).toBe(1);
    expect(new Set(ring.map((s) => `${s.c},${s.r}`)).size).toBe(3);
  });

  it("a ring fills nearest first: the 8 squares round someone, then the next ring out", () => {
    const t = still();
    // Ten more people (and none of the bots), all sent beside the same spot.
    t.all = [t.you.walker, ...t.bosses.map((b) => b.walker)];
    const crowd: Walker[] = [];
    for (let i = 0; i < 10; i++) {
      const w = new Walker({ c: wrapI(SPOT.c - 6 + i), r: wrapI(SPOT.r - 7) }, TOWN_FEEL.botStepMs, true);
      t.all.push(w);
      crowd.push(w);
    }
    const ends = crowd.map((w) => {
      const to = destFor(t, w, { kind: "beside", at: SPOT })!;
      walkWalker(w, to);
      return to;
    });
    expect(ends.slice(0, 8).every((s) => king(s, SPOT) === 1)).toBe(true);
    expect(ends.slice(8).every((s) => king(s, SPOT) === 2)).toBe(true);
    expect(new Set(ends.map((s) => `${s.c},${s.r}`)).size).toBe(10);
  });
});

describe("town square: the Colosseum", () => {
  const front = (s: Sq) => s.r === COLISEUM.r0 - 1 && (s.c === COLISEUM.c0 + COLISEUM.size / 2 - 1 || s.c === COLISEUM.c0 + COLISEUM.size / 2);

  it("its ground is solid: none of it walked on (the street town's, at the north edge: nothing behind it)", () => {
    for (let r = COLISEUM.r0; r < COLISEUM.r0 + COLISEUM.size; r++)
      for (let c = COLISEUM.c0; c < COLISEUM.c0 + COLISEUM.size; c++) {
        expect(onColiseum(c, r)).toBe(true);
        expect(walkable(c, r)).toBe(false);
      }
  });

  it("the apron in front of its gate is open ground, nearest the gate first", () => {
    for (const s of APRON) expect(walkable(s.c, s.r)).toBe(true);
    expect(front(APRON[0]!) && front(APRON[1]!)).toBe(true);
  });

  it("a tap on it (or its ground) walks you to the apron, at the gate; people tapping it gather there, a square each", () => {
    const t = still();
    const to = destFor(t, t.you.walker, { kind: "coliseum" })!;
    expect(front(to)).toBe(true);
    expect(destFor(t, t.you.walker, { kind: "square", c: COLISEUM.c0 + 3, r: COLISEUM.r0 + 4 })).toEqual(to);
    // Everyone sent there: the first two at the gate, the rest round them on the apron, nobody on anyone's square.
    for (const p of t.people) {
      const s = destFor(t, p.walker, { kind: "coliseum" })!;
      expect(APRON.some((a) => a.c === s.c && a.r === s.r)).toBe(true);
      walkWalker(p.walker, s);
    }
    settle(t);
    apart(t);
    expect(t.people.filter((p) => front(p.walker.here()))).toHaveLength(2);
  });
});

describe("town square: the statues", () => {
  it("each has its viewing square on the apron, right in front of the Colosseum ground's end columns, either side of the gate", () => {
    const [marble, bronze] = STATUES;
    expect(marble!.id).toBe("marble");
    expect(bronze!.id).toBe("bronze");
    for (const s of STATUES) {
      expect(APRON.some((a) => a.c === s.c && a.r === s.r), `${s.id} on the apron`).toBe(true);
      expect(onColiseum(s.c, s.r + 1), `${s.id} right in front of the Colosseum's ground`).toBe(true);
      expect(statueAt(s.c, s.r)).toBe(s);
    }
    // Symmetric about the gate: the marble on its left (west), the bronze on its right.
    expect(marble!.c).toBe(COLISEUM.c0);
    expect(bronze!.c).toBe(COLISEUM.c0 + COLISEUM.size - 1);
    expect(marble!.r).toBe(bronze!.r);
  });

  it("the quotes, word for word", () => {
    expect(STATUES.map((s) => s.quote)).toEqual(["Nothing is so healing as the human touch", "Concrete considerations always take precedence over general principles"]);
  });

  it("a tap on a statue walks you to its square; someone on it, to the nearest free square beside it", () => {
    const t = still();
    const s = STATUES[1]!;
    expect(destFor(t, t.you.walker, { kind: "statue", statue: s })).toEqual({ c: s.c, r: s.r });
    const bot = t.bots[0]!;
    walkWalker(bot.walker, { c: s.c, r: s.r });
    settle(t);
    const to = destFor(t, t.you.walker, { kind: "statue", statue: s })!;
    expect(king(to, s)).toBe(1);
    expect(taken(t, to.c, to.r, t.you.walker)).toBe(false);
  });

  it("the bots never stop on a statue's square (it's kept free to look from)", () => {
    const t = createTown(0);
    let now = 0;
    for (let i = 0; i < 20000; i++) {
      now += 50;
      tick(t, now);
      for (const b of t.bots) expect(statueAt(b.walker.goalC(), b.walker.goalR())).toBeNull();
    }
  });
});

// (The park's layout, the street town's since Nov 13 for everyone: town-street.test.ts, "has twelve tables where the plan has them…".)
describe("town square: the park's tables", () => {
  /** The table nearest your start, and its stool nearer you. */
  const near = TABLES.reduce((a, b) => (king(b, START) < king(a, START) ? b : a));
  const nearStool = near.stools.reduce((a, b) => (Math.hypot(b.c - START.c, b.r - START.r) < Math.hypot(a.c - START.c, a.r - START.r) ? b : a));

  it("a tap on a table walks you to its nearest free stool, where you sit; both taken, beside it; walking on, you stand", () => {
    const t = still();
    const table = near;
    const to = destFor(t, t.you.walker, { kind: "table", table })!;
    expect(to).toEqual(nearStool);
    walkWalker(t.you.walker, to);
    t.you.sit = true;
    settle(t);
    expect(seated(t.you)).toBe(table);
    // Standing up: the card closed (you stay on the stool's square, standing).
    t.you.sit = false;
    expect(seated(t.you)).toBeNull();
    // Someone on both stools: you end beside the table.
    const t2 = still();
    const [a, b] = t2.bots;
    walkWalker(a!.walker, table.stools[0]);
    walkWalker(b!.walker, table.stools[1]);
    settle(t2);
    expect(seated(a!)).toBe(table);
    const beside = destFor(t2, t2.you.walker, { kind: "table", table })!;
    expect(king(beside, table)).toBe(1);
    expect(stoolAt(beside.c, beside.r)).toBeNull();
  });

  it("a table's state from who sits (Eric, Oct 27): two others play, one waits (the ring under the free stool), you at it: still", () => {
    const table = near;
    const t = still();
    const [a, b] = t.bots;
    expect(tableStates(t.people)[table.i]).toEqual({ kind: "still" });
    // One bot on the west stool: waiting, the east one free.
    walkWalker(a!.walker, table.stools[0]);
    settle(t);
    expect(tableStates(t.people)[table.i]).toEqual({ kind: "waiting", free: 1 });
    // A second on the east stool: playing. Every other table: still.
    walkWalker(b!.walker, table.stools[1]);
    settle(t);
    const states = tableStates(t.people);
    expect(states[table.i]).toEqual({ kind: "playing" });
    expect(states.filter((s) => s.kind !== "still")).toHaveLength(1);
    // A bot standing on a stool isn't sitting: it doesn't count.
    b!.sit = false;
    expect(tableStates(t.people)[table.i]).toEqual({ kind: "waiting", free: 1 });
    // You sitting across a bot: not a game yet (no matchmaking), no ring: its pieces stand set up.
    const t2 = still();
    walkWalker(t2.bots[0]!.walker, table.stools[0]);
    walkWalker(t2.you.walker, table.stools[1]);
    t2.you.sit = true;
    settle(t2);
    expect(seated(t2.you)).toBe(table);
    expect(tableStates(t2.people)[table.i]).toEqual({ kind: "still" });
    // You alone: still too (you aren't searching yet).
    t2.bots[0]!.sit = false;
    expect(tableStates(t2.people)[table.i]).toEqual({ kind: "still" });
  });

  it("bots sit at the tables now and then, a stool each", () => {
    const t = createTown(0);
    let now = 0;
    let sat = 0;
    // (Oct 28: a bot walking home or out passes the bosses' grounds, and may pass through a boss on its way, as people do.)
    const tripping = (w: Walker) => w.moving() && t.bots.some((b) => b.walker === w && (b.going || b.trip));
    for (let i = 0; i < 6000; i++) {
      now += 50;
      tick(t, now);
      for (const b of t.bots) if (seated(b)) sat++;
      apart(t, tripping);
    }
    expect(sat).toBeGreaterThan(0);
  });
});
