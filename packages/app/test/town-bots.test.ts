import { describe, expect, it } from "vitest";
import { itemDef } from "@chessroyale/core";
import { N } from "../src/town/camera.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { BOTS, START, TABLES, Walker, anyTableFree, botLabel, cancelMeet, createTown, holdBot, meet, meetReady, meetSeat, playAtTableText, ratingText, seatOf, seatText, seated, stepsFrom, tableFor, tableStates, tick, waitingBot, walkWalker, type Person, type Sq, type Town } from "../src/town/world.ts";

/**
 * Playing a town bot (Oct 27, Eric): the bot table (short names, a rating each, one or two crate items), its card's
 * words, the walk to a free table and when the game opens, and coming back to the table after it
 * (docs/areas/town-square.md, "Playing a bot").
 */

/** A town with nobody wandering off on their own. */
function still(seat: Parameters<typeof createTown>[2] = null): Town {
  const t = createTown(0, undefined, seat);
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
const botNamed = (t: Town, name: string): Person => t.bots.find((p) => p.bot?.name === name)!;
const same = (a: Sq, b: Sq) => a.c === b.c && a.r === b.r;
/** Someone else (a stand-in walker) standing on square `s`: it's taken. */
const occupy = (t: Town, s: Sq) => t.all.push(new Walker(s, 100, false));

describe("town square: the bots (Oct 27)", () => {
  it("six bots, names of 8 to 10 characters, ratings spread from 800 to 2000, each in one or two crate items", () => {
    expect(BOTS).toHaveLength(6);
    for (const b of BOTS) {
      expect(b.name.length, b.name).toBeGreaterThanOrEqual(8);
      expect(b.name.length, b.name).toBeLessThanOrEqual(10);
      const worn = Object.entries(b.look.wear ?? {});
      expect(worn.length, b.name).toBeGreaterThanOrEqual(1);
      expect(worn.length, b.name).toBeLessThanOrEqual(2);
      // Real crate items, each in its own slot, in a palette color.
      for (const [slot, it] of worn) expect(itemDef(it!.def)?.slot, `${b.name}: ${it!.def}`).toBe(slot);
    }
    const ratings = BOTS.map((b) => b.rating);
    expect(Math.min(...ratings)).toBe(800);
    expect(Math.max(...ratings)).toBe(2000);
    expect(new Set(ratings).size).toBe(6);
    const sorted = [...ratings].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(150);
    expect(new Set(BOTS.map((b) => b.name)).size).toBe(6);
  });

  it("shown as '<name> (bot)' everywhere: their tags in the town, their cards, the table's Play", () => {
    const t = still();
    const tess = BOTS.find((b) => b.name === "Tempo Tess")!;
    expect(botLabel(tess)).toBe("Tempo Tess (bot)");
    expect(ratingText(tess)).toBe("Rating 1400");
    expect(playAtTableText(tess)).toBe("Play Tempo Tess (bot) · 1400");
    // Each bot in the square: its name tag, its entry in BOTS and its look (one field, BOTS' own).
    expect(t.bots.map((p) => p.name)).toEqual(BOTS.map(botLabel));
    t.bots.forEach((p, i) => {
      expect(p.bot).toBe(BOTS[i]);
      expect(p.look).toBe(BOTS[i]!.look);
    });
    expect(t.you.bot).toBeNull();
  });
});

describe("town square: playing a bot (its card's Play)", () => {
  it("Play: the nearest table with both stools free, nearest to the two of you; you take the stool nearer you, the bot the other", () => {
    const t = still();
    const bot = botNamed(t, "Fork Frank");
    const m = tableFor(t, bot)!;
    expect(m).not.toBeNull();
    const dy = stepsFrom(t.you.walker.here());
    const db = stepsFrom(bot.walker.here());
    const at = (d: Int16Array, s: Sq) => d[s.r * N + s.c]!;
    // Yours is the nearer of its two stools to you; nothing else is nearer for the two of you.
    expect(at(dy, m.yours)).toBeLessThanOrEqual(at(dy, m.theirs));
    const cost = at(dy, m.yours) + at(db, m.theirs);
    for (const tb of TABLES) {
      const [a, b] = tb.stools;
      const mine = at(dy, a) <= at(dy, b) ? a : b;
      const other = mine === a ? b : a;
      expect(at(dy, mine) + at(db, other), `table ${tb.i}`).toBeGreaterThanOrEqual(cost);
    }
    // A stool someone else stands on (or is headed for): that table isn't free.
    occupy(t, m.theirs);
    const m2 = tableFor(t, bot)!;
    expect(m2.table).not.toBe(m.table);
  });

  it("you both walk there and sit; the game opens once both do (its seat: the table, your stool, the bot)", () => {
    const t = still();
    const bot = botNamed(t, "Tempo Tess");
    const m = tableFor(t, bot)!;
    meet(t, m);
    expect(t.hold).toBe(bot);
    expect(meetReady(t)).toBe(false);
    settle(t);
    expect(same(t.you.walker.here(), m.yours)).toBe(true);
    expect(same(bot.walker.here(), m.theirs)).toBe(true);
    expect(seated(t.you)).toBe(m.table);
    expect(seated(bot)).toBe(m.table);
    expect(meetReady(t)).toBe(true);
    const seat = meetSeat(t)!;
    expect(seat).toEqual({ table: m.table.i, stool: m.table.stools.indexOf(m.yours as never) as 0 | 1, bot: BOTS.indexOf(bot.bot!) });
    // You at the table: still, from your side.
    expect(tableStates(t.people)[m.table.i]!.kind).toBe("still");
  });

  it("walking elsewhere calls it off: the bot is free again", () => {
    const t = still();
    const bot = botNamed(t, "Pin Pete");
    meet(t, tableFor(t, bot)!);
    cancelMeet(t);
    expect(t.meet).toBeNull();
    expect(t.hold).toBeNull();
    expect(meetReady(t)).toBe(false);
  });

  it("every table taken: no table for you, and the card's Play greys ('Tables are full'); one frees: it's back", () => {
    const t = still();
    const bot = botNamed(t, "Bishop Bo");
    expect(anyTableFree(t, bot)).toBe(true);
    // Someone on one stool of every table.
    for (const tb of TABLES) occupy(t, tb.stools[0]);
    expect(anyTableFree(t, bot)).toBe(false);
    expect(tableFor(t, bot)).toBeNull();
    // That one walks off.
    const w = t.all[t.all.length - 1]!;
    expect(walkWalker(w, START)).toBe(true);
    expect(anyTableFree(t, bot)).toBe(true);
    expect(tableFor(t, bot)!.table).toBe(TABLES[TABLES.length - 1]);
    // You or the bot already on a stool doesn't take the table from the two of you.
    const u = still();
    const b2 = botNamed(u, "Bishop Bo");
    walkWalker(u.you.walker, TABLES[0]!.stools[0]);
    settle(u);
    expect(tableFor(u, b2)!.table).toBe(TABLES[0]);
  });

  it("a bot whose card is open holds still: it stops at the square it steps onto and doesn't wander off", () => {
    const t = createTown(0);
    const bot = botNamed(t, "Gambit Gus");
    walkWalker(bot.walker, { c: bot.walker.c, r: bot.walker.r + 3 });
    tick(t, 1);
    holdBot(t, bot);
    let now = settle(t, 1);
    const at = bot.walker.here();
    for (let i = 0; i < 60 * 30; i++) tick(t, (now += 33));
    expect(bot.walker.here()).toEqual(at);
    holdBot(t, null);
    expect(t.hold).toBeNull();
  });

  it("a bot sitting alone at a table is the one its card offers to play (with you across too); two sitting: none", () => {
    const t = still();
    const tb = TABLES[6]!;
    const [a, b] = t.bots;
    expect(waitingBot(t, tb)).toBeNull();
    walkWalker(a!.walker, tb.stools[0]);
    settle(t);
    expect(waitingBot(t, tb)).toBe(a);
    t.you.sit = true;
    walkWalker(t.you.walker, tb.stools[1]);
    settle(t);
    expect(seated(t.you)).toBe(tb);
    expect(waitingBot(t, tb)).toBe(a);
    // Played from there: the meeting is the bot where it sits and you across.
    meet(t, { bot: a!, table: tb, yours: tb.stools[1], theirs: tb.stools[0] });
    expect(meetReady(t)).toBe(true);
    // Two bots: none.
    const u = still();
    walkWalker(u.bots[0]!.walker, tb.stools[0]);
    walkWalker(u.bots[1]!.walker, tb.stools[1]);
    settle(u);
    expect(waitingBot(u, tb)).toBeNull();
    expect(b).toBeDefined();
  });
});

describe("town square: back from a game with a bot", () => {
  it("a seat as the address carries it, and back; anything else is none", () => {
    for (const s of [{ table: 0, stool: 0, bot: 0 }, { table: 9, stool: 1, bot: 5 }] as const) expect(seatOf(seatText(s))).toEqual(s);
    for (const bad of [null, "", "6.2.1", "10.0.1", "1.0.6", "a.b.c", "1.0"]) expect(seatOf(bad)).toBeNull();
  });

  it("you sit on your stool at that table, the bot across, its card closed; after a short while it gets up and wanders off", () => {
    const seat = { table: 3, stool: 1, bot: 2 } as const;
    const t = createTown(0, undefined, seat);
    const tb = TABLES[3]!;
    const bot = t.bots[2]!;
    expect(t.you.walker.here()).toEqual(tb.stools[1]);
    expect(bot.walker.here()).toEqual(tb.stools[0]);
    expect(seated(t.you)).toBe(tb);
    expect(seated(bot)).toBe(tb);
    expect(tableStates(t.people)[3]!.kind).toBe("still");
    // Nobody else on either stool, or anywhere near.
    for (const p of t.bots) if (p !== bot) expect(TABLES[3]!.stools.some((s) => same(s, p.walker.here()))).toBe(false);
    // It stays a moment, then goes.
    tick(t, TOWN_FEEL.botLeaveAfterGameMs - 100);
    expect(bot.walker.here()).toEqual(tb.stools[0]);
    let now = TOWN_FEEL.botLeaveAfterGameMs + 10;
    tick(t, now);
    now = settle(t, now);
    expect(same(bot.walker.here(), tb.stools[0])).toBe(false);
    expect(t.leave).toBeNull();
  });

  it("held while its table's card is open with you across: it stays until you close it", () => {
    const t = createTown(0, undefined, { table: 5, stool: 0, bot: 4 });
    const bot = t.bots[4]!;
    holdBot(t, bot);
    let now = 0;
    for (let i = 0; i < 300; i++) tick(t, (now += 33));
    expect(bot.walker.here()).toEqual(TABLES[5]!.stools[1]);
    holdBot(t, null);
    tick(t, (now += 33));
    expect(bot.walker.moving() || !same(bot.walker.here(), TABLES[5]!.stools[1])).toBe(true);
  });
});
