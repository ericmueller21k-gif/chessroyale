import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { itemDef } from "@chessroyale/core";
import { sheetHash } from "../../../scripts/bake-sidekicks.ts";
import type { Character } from "../src/characters/sprite.ts";
import { SIDEKICK_SHEETS } from "../src/town/sidekick-sheets.ts";
import { N } from "../src/town/camera.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { BOTS, HOMES, START, TABLES, Walker, anyTableFree, botLabel, cancelMeet, comeOut, createTown, tdist, walkable, holdBot, isSprite, meet, meetReady, meetSeat, playAtTableText, ratingText, seatOf, seatText, seated, sidekickText, spriteAnim, stepsFrom, tableFor, tableStates, tick, townLine, waitingBot, waveMs, walkWalker, type HomeId, type Person, type Sq, type Town } from "../src/town/world.ts";

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

describe("town square: the bots take turns in the square (Oct 28: twenty cost frames)", () => {
  it("botsOut are out at once, the others at home (on no square); now and then one goes home and another comes out", () => {
    const t = createTown(0);
    const out = () => t.bots.filter((b) => !b.home);
    expect(out()).toHaveLength(TOWN_FEEL.botsOut);
    for (const b of t.bots) expect(t.all.includes(b.walker), b.name).toBe(!b.home);
    const first = new Set(out());
    const held = out()[0]!;
    holdBot(t, held);
    let now = 0;
    const seen = new Set(out());
    for (let i = 0; i < 20 * 60 * 120; i += 1) {
      now += 50;
      tick(t, now);
      if (i % 20) continue;
      // Never more out than botsOut (one fading out as another fades in: at most one more), a walker each, apart.
      expect(out().length).toBeLessThanOrEqual(TOWN_FEEL.botsOut + 1);
      for (const b of t.bots) expect(t.all.includes(b.walker), b.name).toBe(!b.home);
      const goals = out().map((b) => `${b.walker.goalC()},${b.walker.goalR()}`);
      expect(new Set(goals).size).toBe(goals.length);
      expect(held.home).toBe(false);
      for (const b of out()) seen.add(b);
    }
    // Over two hours every bot has been out, and the ones out now aren't the first ones.
    expect(seen.size).toBe(BOTS.length);
    expect([...first].every((b) => !b.home)).toBe(false);
  });

  it("back from a game, the bot you played is out (across from you); one called from home comes out", () => {
    for (let k = 0; k < 10; k++) {
      const t = createTown(0, undefined, { table: 2, stool: 0, bot: 19 });
      expect(t.bots[19]!.home).toBe(false);
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
