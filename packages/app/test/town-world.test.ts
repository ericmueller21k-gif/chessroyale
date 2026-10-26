import { describe, expect, it } from "vitest";
import { N, wrapF, wrapI } from "../src/town/camera.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { COLISEUM, Walker, createTown, destFor, taken, tick, walkWalker, walkable, type Sq, type Town } from "../src/town/world.ts";

/** One pawn a square (src/town/world.ts): where a walk ends, and rings of people round someone. */

const king = (a: Sq, b: Sq) => Math.max(Math.abs(wrapF(a.c - b.c)), Math.abs(wrapF(a.r - b.r)));
/** The Coliseum's middle: open ground, no homes near. */
const SPOT: Sq = { c: COLISEUM.c0 + 3, r: COLISEUM.r0 + 3 };

/** A town with nobody wandering off on their own (the bots stay put; the bosses are far from the middle). */
function still(): Town {
  const t = createTown(0);
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
/** Nobody shares a square. */
function apart(t: Town) {
  const seen = new Set<number>();
  for (const w of t.all) {
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
