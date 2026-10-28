import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { itemDef } from "@chessroyale/core";
import { sheetHash } from "../../../scripts/bake-sidekicks.ts";
import type { Character } from "../src/characters/sprite.ts";
import { SIDEKICK_SHEETS } from "../src/town/sidekick-sheets.ts";
import { N, wrapF, wrapI } from "../src/town/camera.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { APRON, BOTS, CROWD_MAX, HOMES, addCrowd, START, TABLES, Walker, anyTableFree, canGoHome, homeDoor, inSquare, plotDist, sendHome, botLabel, cancelMeet, comeOut, createTown, tdist, walkable, holdBot, isSprite, meet, meetReady, meetSeat, playAtTableText, ratingText, seatOf, seatText, seated, sidekickText, spriteAnim, stepsFrom, tableFor, tableStates, tick, townLine, waitingBot, waveMs, walkWalker, type HomeId, type Person, type Sq, type Town } from "../src/town/world.ts";

/** Each sidekick's sprite file (and its id, `sidekick-<file>`), by its boss's home. */
const HOME_FILE: Record<HomeId, string> = { clown: "boingo", pig: "wrangler", smudgy: "smudgy", bigboy: "bigboy", hopper: "chubchirp", folio: "folio", moo: "moo", gardener: "puddles", sawyer: "sawyer", tiger: "babur", alfil: "alfil", gingerbread: "ginger", grex: "jefferson", hollow: "hollow" };

/**
 * Playing a town bot (Oct 27, Eric): the bot table (short names, a rating each, one or two crate items), its card's
 * words, the walk to a free table and when the game opens, and coming back to the table after it
 * (docs/areas/town-square.md, "Playing a bot").
 */

/** A town with nobody wandering off on their own. */
function still(seat: Parameters<typeof createTown>[2] = null): Town {
  const t = createTown(0, undefined, seat, BOTS.length);
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
  it("twenty bots, a ladder from 600 to 2500 by 100 (each rung once), names of at most 10 characters (Oct 28)", () => {
    expect(BOTS).toHaveLength(20);
    expect(BOTS.map((b) => b.rating)).toEqual(Array.from({ length: 20 }, (_, i) => 600 + 100 * i));
    for (const b of BOTS) expect(b.name.length, b.name).toBeLessThanOrEqual(10);
    expect(new Set(BOTS.map((b) => b.name)).size).toBe(20);
    // Hollow's critter on top, stronger than Hollow (Eric's twist).
    const top = BOTS[BOTS.length - 1]!;
    expect(top.boss).toBe("hollow");
    expect(top.rating).toBe(2500);
  });

  it("the six pawns keep their names and clothes, one or two crate items each, at 600, 900, 1200, 1500, 1800 and 2100", () => {
    const pawns = BOTS.filter((b) => !isSprite(b.look));
    expect(pawns.map((b) => [b.name, b.rating])).toEqual([
      ["Pin Pete", 600],
      ["Rook Rita", 900],
      ["Fork Frank", 1200],
      ["Tempo Tess", 1500],
      ["Bishop Bo", 1800],
      ["Gambit Gus", 2100],
    ]);
    for (const b of pawns) {
      if (isSprite(b.look)) continue;
      expect(b.boss, b.name).toBeUndefined();
      const worn = Object.entries(b.look.wear ?? {});
      expect(worn.length, b.name).toBeGreaterThanOrEqual(1);
      expect(worn.length, b.name).toBeLessThanOrEqual(2);
      // Real crate items, each in its own slot, in a palette color.
      for (const [slot, it] of worn) expect(itemDef(it!.def)?.slot, `${b.name}: ${it!.def}`).toBe(slot);
    }
  });

  it("the fourteen sidekicks, one a boss, each its sprite with idle, walk, sit and wave; easier bosses' kids lower", () => {
    const kids = BOTS.filter((b) => isSprite(b.look));
    expect(kids).toHaveLength(14);
    expect(new Set(kids.map((b) => b.boss)).size).toBe(14);
    for (const h of HOMES) expect(kids.some((b) => b.boss === h.id), h.id).toBe(true);
    for (const b of kids) {
      if (!isSprite(b.look)) continue;
      expect(b.look.sprite.id).toBe(`sidekick-${HOME_FILE[b.boss!]}`);
      for (const a of ["idle", "walk", "sit", "wave"] as const) expect(b.look.sprite.ms[a].length, `${b.name}: ${a}`).toBeGreaterThan(0);
    }
    // The ladder's order: the crowd's score against each boss in its latest sim, highest (easiest boss) lowest; Hollow on top.
    expect(kids.map((b) => b.boss)).toEqual(["clown", "pig", "smudgy", "bigboy", "hopper", "folio", "moo", "gardener", "sawyer", "tiger", "alfil", "gingerbread", "grex", "hollow"]);
  });

  it("each sidekick's baked sheet is its sprite as drawn (scripts/bake-sidekicks.ts): idle, walk, sit, wave, every pixel", async () => {
    const files = readdirSync(new URL("../src/characters/sidekicks/", import.meta.url)).filter((f) => f.endsWith(".ts"));
    expect(files).toHaveLength(14);
    for (const file of files) {
      const name = file.replace(/\.ts$/, "") as keyof typeof SIDEKICK_SHEETS;
      const mod = (await import(`../src/characters/sidekicks/${file}`)) as Record<string, unknown>;
      const ch = Object.values(mod).find((v): v is Character => !!v && typeof v === "object" && "anims" in v && "palette" in v)!;
      const sheet = SIDEKICK_SHEETS[name];
      expect(ch.id, file).toBe(`sidekick-${name}`);
      expect(sheet.id).toBe(ch.id);
      for (const a of ["idle", "walk", "sit", "wave"] as const) expect(sheet.ms[a], `${file}: ${a}`).toEqual(ch.anims[a]!.frames.map((f) => f.ms));
      expect([sheet.w, sheet.h, ...sheet.foot]).toEqual([ch.w, ch.h, ...ch.foot]);
      // Stale after a change to the art: npx tsx scripts/bake-sidekicks.ts.
      expect(sheet.hash, `${file}: run npx tsx scripts/bake-sidekicks.ts`).toBe(sheetHash(ch));
    }
  }, 60_000);

  it("a sidekick's card says whose it is ('Hollow's sidekick'); a pawn's says nothing more", () => {
    const named = (n: string) => BOTS.find((b) => b.name === n)!;
    expect(sidekickText(named("Glim"))).toBe("Hollow's sidekick");
    expect(sidekickText(named("Bun & Bug"))).toBe("Chub & Chirp's sidekick");
    expect(sidekickText(named("Twinkle"))).toBe("Moo & Moon's sidekick");
    expect(sidekickText(named("Drizzle"))).toBe("Puddles' sidekick");
    expect(sidekickText(named("Sparky"))).toBe("Jefferson's sidekick");
    expect(sidekickText(named("Tempo Tess"))).toBeNull();
    expect(botLabel(named("Glim"))).toBe("Glim (bot)");
    expect(ratingText(named("Glim"))).toBe("Rating 2500");
  });

  it("Hollow's card: Eric's three lines, the next each time it opens; no other home has lines", () => {
    expect([0, 1, 2, 3].map((n) => townLine("hollow", n))).toEqual([
      "The little one plays in the dark. Even I don't sit across from him.",
      "Don't let the eyes fool you. He's stronger than I ever was.",
      "I found him in the dark. The dark had been teaching him.",
      "The little one plays in the dark. Even I don't sit across from him.",
    ]);
    for (const h of HOMES) if (h.id !== "hollow") expect(townLine(h.id, 0), h.id).toBeNull();
  });

  it("a sidekick walks, stands, sits at a table and waves once when tapped (then stands again)", () => {
    const t = still();
    const glim = botNamed(t, "Glim");
    expect(spriteAnim(glim, 0)).toBe("idle");
    // Tapped: its wave, once through, then idle.
    glim.waved = 1000;
    if (!isSprite(glim.look)) throw new Error("Glim is a sidekick");
    const ms = waveMs(glim.look.sprite);
    expect(ms).toBeGreaterThan(500);
    expect(spriteAnim(glim, 1000)).toBe("wave");
    expect(spriteAnim(glim, 1000 + ms - 1)).toBe("wave");
    expect(spriteAnim(glim, 1000 + ms)).toBe("idle");
    // Walking: its walk; on a stool: its sit (sitting wins over a wave).
    const tb = TABLES.find((x) => [0, 1].every((k) => !t.people.some((p) => same(p.walker.here(), x.stools[k]!))))!;
    walkWalker(glim.walker, tb.stools[0]);
    expect(spriteAnim(glim, 1000 + ms)).toBe("walk");
    settle(t);
    expect(seated(glim)).toBe(tb);
    glim.waved = 0;
    expect(spriteAnim(glim, 1)).toBe("sit");
  });

  it("shown as '<name> (bot)' everywhere: their tags in the town, their cards, the table's Play", () => {
    const t = still();
    const tess = BOTS.find((b) => b.name === "Tempo Tess")!;
    expect(botLabel(tess)).toBe("Tempo Tess (bot)");
    expect(ratingText(tess)).toBe("Rating 1500");
    expect(playAtTableText(tess)).toBe("Play Tempo Tess (bot) · 1500");
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
    const t = createTown(0, undefined, null, BOTS.length);
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

/** What the turns did: who was sent home (and who was out, not on its way home, just before), who came out, who got home. */
interface TurnLog {
  sent: { bot: Person; at: number; out: Set<Person> }[];
  came: { bot: Person; at: number; from: Sq }[];
  home: { bot: Person; at: number }[];
}
/** Runs the town `ms` from `from` in steps of `step`, logging the turns (and calling `each` after every tick). */
function run(t: Town, from: number, ms: number, log: TurnLog = { sent: [], came: [], home: [] }, step = 100, each?: (now: number) => void): number {
  let now = from;
  const going = new Map(t.bots.map((b) => [b, b.going]));
  const home = new Map(t.bots.map((b) => [b, b.home]));
  let staying = new Set(t.bots.filter((b) => !b.home && !b.going));
  while (now < from + ms) {
    now += step;
    tick(t, now);
    for (const b of t.bots) {
      if (b.going && !going.get(b)) log.sent.push({ bot: b, at: now, out: staying });
      if (!b.home && home.get(b)) log.came.push({ bot: b, at: now, from: b.walker.here() });
      if (b.home && !home.get(b)) log.home.push({ bot: b, at: now });
      going.set(b, b.going);
      home.set(b, b.home);
    }
    staying = new Set(t.bots.filter((b) => !b.home && !b.going));
    each?.(now);
  }
  return now;
}
/** You stand far from the square (so no bot is passed over for being near you). */
function away(t: Town): void {
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (walkable(c, r) && !inSquare(c, r) && tdist({ c, r }, START) >= 18 && HOMES.every((h) => plotDist(h, c, r) > 3)) {
        t.you.walker.c = c;
        t.you.walker.r = r;
        return;
      }
}
const MIN = TOWN_FEEL.botTurnMs;

describe("town square: the bots take turns (Oct 28, Eric: ten out, one goes home each minute and another walks out of its own home)", () => {
  it("ten out, the others at home (on no square); ten in the world all along, the ones out staying in the square", () => {
    expect(TOWN_FEEL.botsOut).toBe(10);
    const t = createTown(0);
    const out = () => t.bots.filter((b) => !b.home);
    expect(out()).toHaveLength(10);
    for (const b of t.bots) expect(t.all.includes(b.walker), b.name).toBe(!b.home);
    expect(t.homeQueue).toHaveLength(10);
    expect(t.homeQueue.every((b) => b.home)).toBe(true);
    const log = run(t, 0, 30 * MIN, undefined, 100, () => {
      // Ten in the world (near the square or on their way), a walker each, apart where they stop.
      expect(out()).toHaveLength(10);
      for (const b of t.bots) expect(t.all.includes(b.walker), b.name).toBe(!b.home);
      const goals = out().map((b) => `${b.walker.goalC()},${b.walker.goalR()}`);
      expect(new Set(goals).size).toBe(goals.length);
      // A bot out and not on its way home or out stands in the square (the park, the walk, the apron).
      for (const b of out()) if (!b.trip && !b.going && !b.walker.moving()) expect(inSquare(b.walker.c, b.walker.r), `${b.name} at ${b.walker.c},${b.walker.r}`).toBe(true);
    });
    expect(log).toBeGreaterThan(0);
  });

  it("one change a minute: a bot sent home only on the minute, at most one a minute", () => {
    expect(TOWN_FEEL.botTurnMs).toBe(60000);
    const t = createTown(0);
    away(t);
    const log: TurnLog = { sent: [], came: [], home: [] };
    run(t, 0, 20 * MIN + 500, log);
    const minutes = log.sent.map((s) => Math.floor(s.at / MIN));
    for (const s of log.sent) expect(s.at % MIN, s.bot.name).toBeLessThanOrEqual(100);
    expect(new Set(minutes).size).toBe(minutes.length);
    expect(Math.min(...minutes)).toBe(1);
    expect(log.sent.length).toBeGreaterThanOrEqual(15);
    // And one came out for each that got home.
    expect(log.came.length).toBe(log.home.length);
  });

  it("the rounds: every bot out goes home once before any goes twice (a bot that came out is safe until the others have gone)", () => {
    const t = createTown(0);
    away(t);
    const log: TurnLog = { sent: [], came: [], home: [] };
    run(t, 0, 62 * MIN, log);
    // (Fewer than one a minute: a bot due that sits at a table waits its turn, and the minute passes.)
    expect(log.sent.length).toBeGreaterThanOrEqual(30);
    // In rounds of ten: the ten out as the round starts, each once.
    for (let k = 0; k + 10 <= log.sent.length; k += 10) {
      const round = log.sent.slice(k, k + 10).map((s) => s.bot);
      expect(new Set(round).size, `round ${k / 10}`).toBe(10);
      expect(new Set(round), `round ${k / 10}`).toEqual(log.sent[k]!.out);
    }
    // Never sent home within a minute and a half of coming out.
    for (const s of log.sent) {
      const came = log.came.filter((c) => c.bot === s.bot && c.at < s.at).pop();
      if (came) expect(s.at - came.at).toBeGreaterThanOrEqual(TOWN_FEEL.botOutAtLeastMs);
    }
  });

  it("busy bots are passed over and stay in the round: held, seated, on its way to or from a game, near you, just out; rechecked each minute", () => {
    const t = createTown(0);
    away(t);
    const log: TurnLog = { sent: [], came: [], home: [] };
    let now = run(t, 0, MIN + 200, log);
    expect(log.sent).toHaveLength(1);
    // Hold one still due (its card is open): the others go, then the minutes are skipped until it's free.
    const x = t.bots.find((b) => b.due && !b.home && !b.going)!;
    holdBot(t, x);
    for (let m = 0; m < 40 && t.bots.some((b) => b.due && b !== x); m++) now = run(t, now, MIN, log);
    // (The round's other nine have gone.)
    expect(log.sent).toHaveLength(9);
    // Only it is due: the minutes pass with nobody sent.
    now = run(t, now, 3 * MIN, log);
    expect(log.sent).toHaveLength(9);
    expect(log.sent.some((s) => s.bot === x)).toBe(false);
    expect(x.due).toBe(true);
    // Free again, it's the next sent home (once it isn't busy otherwise: it may sit at a table a while first).
    holdBot(t, null);
    for (let m = 0; m < 20 && log.sent.length === 9; m++) now = run(t, now, MIN, log);
    expect(log.sent).toHaveLength(10);
    expect(log.sent[9]!.bot).toBe(x);
    // Each kind of busy, one by one.
    const u = createTown(0);
    away(u);
    const b = u.bots.find((p) => !p.home && !seated(p))!;
    expect(canGoHome(u, b, 0)).toBe(true);
    u.hold = b;
    expect(canGoHome(u, b, 0)).toBe(false);
    u.hold = null;
    u.meet = { bot: b, table: TABLES[0]!, yours: TABLES[0]!.stools[0], theirs: TABLES[0]!.stools[1] };
    expect(canGoHome(u, b, 0)).toBe(false);
    u.meet = null;
    u.leave = { bot: b, at: 1000 };
    expect(canGoHome(u, b, 0)).toBe(false);
    u.leave = null;
    b.came = -1000;
    expect(canGoHome(u, b, 0)).toBe(false);
    b.came = -TOWN_FEEL.botOutAtLeastMs;
    expect(canGoHome(u, b, 0)).toBe(true);
    const near = { ...b.walker.here() };
    u.you.walker.c = near.c;
    u.you.walker.r = wrapI(near.r + TOWN_FEEL.botTurnAway - 1);
    expect(canGoHome(u, b, 0)).toBe(false);
    away(u);
    walkWalker(b.walker, TABLES[4]!.stools[0]);
    settle(u);
    expect(seated(b)).toBe(TABLES[4]);
    expect(canGoHome(u, b, 0)).toBe(false);
  });

  it("the one home longest comes out next (first in, first out), never the one that just went home", () => {
    const t = createTown(0);
    away(t);
    const first = [...t.homeQueue];
    const log: TurnLog = { sent: [], came: [], home: [] };
    run(t, 0, 25 * MIN, log);
    expect(log.came.length).toBeGreaterThanOrEqual(15);
    const expected = [...first, ...log.home.map((h) => h.bot)];
    expect(log.came.map((c) => c.bot.name)).toEqual(expected.slice(0, log.came.length).map((b) => b.name));
    // Each comes out as the one before it gets home, and it's another.
    for (let i = 0; i < log.came.length; i++) {
      expect(log.came[i]!.at).toBe(log.home[i]!.at);
      expect(log.came[i]!.bot).not.toBe(log.home[i]!.bot);
    }
  });

  it("going home: a sidekick walks to its boss's door and a pawn to the Colosseum's gate, and fades out there; coming out, the same the other way", () => {
    const t = createTown(0);
    away(t);
    t.nextTurnAt = Infinity;
    for (const kid of [true, false]) {
      const b = t.bots.find((p) => !p.home && !p.going && !!p.bot!.boss === kid)!;
      sendHome(t, b, 0);
      expect(b.going).toBe(true);
      let fadeAt: Sq | null = null;
      let fadeLeft = 0;
      let next: Person | null = null;
      const log: TurnLog = { sent: [], came: [], home: [] };
      run(t, 0, MIN, log, 20, (now) => {
        if (!b.home && b.leaves < Infinity && !fadeAt) {
          fadeAt = b.walker.here();
          fadeLeft = b.leaves - now;
        }
        // On its way it's drawn and tappable as any bot (not home), on walkable squares but the doorway's.
        if (!b.home && !fadeAt) expect(walkable(b.walker.hereC(), b.walker.hereR()) || same(b.walker.here(), b.trip!), b.name).toBe(true);
        if (log.came.length && !next) next = log.came[0]!.bot;
      });
      expect(b.home, b.name).toBe(true);
      expect(t.all.includes(b.walker)).toBe(false);
      expect(fadeAt).not.toBeNull();
      expect(fadeLeft).toBeGreaterThan(TOWN_FEEL.botFadeMs - 40);
      expect(fadeLeft).toBeLessThanOrEqual(TOWN_FEEL.botFadeMs);
      const at = fadeAt! as Sq;
      if (kid) {
        // Its boss's home's door: the plot's front row, by the middle.
        const h = HOMES.find((x) => x.id === b.bot!.boss)!;
        expect(at.r).toBe(wrapI(h.cy - 1));
        expect(Math.abs(at.c - h.cx)).toBeLessThanOrEqual(1);
        expect(same(homeDoor(b.bot!), { c: h.cx, r: wrapI(h.cy - 1) })).toBe(true);
      } else {
        // The gate: the apron's squares nearest it.
        expect(APRON.slice(0, 4).some((s) => same(s, at)), `${at.c},${at.r}`).toBe(true);
      }
      // The one home longest came out at its own door, faded in, and walked to the square.
      expect(next).not.toBeNull();
      const c = log.came[0]!;
      const n = c.bot;
      const door = homeDoor(n.bot!);
      expect(Math.abs(wrapF(c.from.c - door.c)) <= 1 && Math.abs(wrapF(c.from.r - door.r)) <= (n.bot!.boss ? 0 : 1), `${n.name} from ${c.from.c},${c.from.r}`).toBe(true);
      expect(n.came).toBe(c.at);
      settle(t, c.at + 20);
      expect(n.trip).toBeNull();
      expect(inSquare(n.walker.c, n.walker.r), n.name).toBe(true);
    }
    // Every sidekick's door has a square in front to walk to; each home's door leads to the square.
    for (const b of BOTS.filter((x) => x.boss)) {
      const d = homeDoor(b);
      expect(walkable(d.c, wrapI(d.r - 1)), b.name).toBe(true);
      expect(stepsFrom({ c: d.c, r: wrapI(d.r - 1) })[START.r * N + START.c]!, b.name).toBeGreaterThan(0);
    }
  });

  it("a bot on its way home holds while its card is open, then carries on; one you play stays (nobody leaves mid-game)", () => {
    const t = createTown(0);
    away(t);
    t.nextTurnAt = Infinity;
    const b = t.bots.find((p) => !p.home && p.bot!.boss)!;
    sendHome(t, b, 0);
    let now = run(t, 0, 600);
    holdBot(t, b);
    const here = b.walker.here();
    now = run(t, now, 5000);
    expect(b.home).toBe(false);
    expect(same(b.walker.here(), here)).toBe(true);
    holdBot(t, null);
    now = run(t, now, MIN);
    expect(b.home).toBe(true);
    // Played on its way home: it stays for the game.
    const u = createTown(0);
    u.nextTurnAt = Infinity;
    const g = u.bots.find((p) => !p.home && !seated(p))!;
    sendHome(u, g, 0);
    run(u, 0, 300);
    meet(u, tableFor(u, g)!);
    expect(g.going).toBe(false);
    settle(u, 300);
    expect(meetReady(u)).toBe(true);
    // Seated across from you for many minutes: never sent home, while the others take their turns.
    u.nextTurnAt = 0;
    const log: TurnLog = { sent: [], came: [], home: [] };
    run(u, 0, 15 * MIN, log);
    expect(g.home).toBe(false);
    expect(log.sent.some((s) => s.bot === g)).toBe(false);
    expect(log.sent.length).toBeGreaterThanOrEqual(8);
  });

  it("the testers' crowd (?crowd=N, measuring only): N more named pawns, at most 100, wandering the square; the bots' turns don't count them", () => {
    const t = createTown(0);
    addCrowd(t, 150);
    expect(t.crowd).toHaveLength(CROWD_MAX);
    expect(CROWD_MAX).toBe(100);
    expect(t.crowd.map((p) => p.name).slice(0, 2)).toEqual(["Guest 1", "Guest 2"]);
    for (const p of t.crowd) {
      expect(p.bot).toBeNull();
      expect(t.people.includes(p) && t.all.includes(p.walker)).toBe(true);
    }
    const at = new Map(t.crowd.map((p) => [p, `${p.walker.c},${p.walker.r}`]));
    run(t, 0, 2 * MIN, undefined, 100, () => expect(t.bots.filter((b) => !b.home)).toHaveLength(10));
    expect(t.crowd.filter((p) => at.get(p) !== `${p.walker.c},${p.walker.r}`).length).toBeGreaterThan(50);
  });

  it("back from a game, the bot you played is out (across from you); one called from home comes out", () => {
    for (let k = 0; k < BOTS.length; k++) {
      const t = createTown(0, undefined, { table: 2, stool: 0, bot: k });
      expect(t.bots[k]!.home).toBe(false);
      expect(t.bots.filter((b) => !b.home)).toHaveLength(TOWN_FEEL.botsOut);
    }
    const t = createTown(0);
    const b = t.bots.find((x) => x.home)!;
    comeOut(t, b, 100, 3);
    expect(b.home).toBe(false);
    expect(t.all.includes(b.walker)).toBe(true);
    expect(tdist(b.walker.here(), t.you.walker.here())).toBeGreaterThanOrEqual(3);
    expect(walkable(b.walker.c, b.walker.r)).toBe(true);
  });
});

describe("town square: back from a game with a bot", () => {
  it("a seat as the address carries it, and back; anything else is none", () => {
    for (const s of [{ table: 0, stool: 0, bot: 0 }, { table: 9, stool: 1, bot: 5 }] as const) expect(seatOf(seatText(s))).toEqual(s);
    for (const bad of [null, "", "6.2.1", "10.0.1", "1.0.20", "a.b.c", "1.0"]) expect(seatOf(bad)).toBeNull();
  });

  it("you sit on your stool at that table, the bot across, its card closed; after a short while it gets up and wanders off", () => {
    const seat = { table: 3, stool: 1, bot: 2 } as const;
    const t = createTown(0, undefined, seat, BOTS.length);
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
    const t = createTown(0, undefined, { table: 5, stool: 0, bot: 4 }, BOTS.length);
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
