import { describe, expect, it } from "vitest";
import { BOSS_BRAIN, BOSS_DIFFICULTY, BOSS_POWERS, BOSS_ROSTER, BOSS_TIERS, DEFAULT_SETTINGS, isPlayable, maiaRatingFor } from "@chessroyale/core";
import { BOSS_BLOCKS, FAQ_DEFAULTS, eloExpected, faqAnchors, faqPage, faqPlainText, faqSections, type FaqSources } from "../src/faq/content.ts";
import { inlineText, linksOf, parse, plainText } from "../src/faq/markdown.ts";

/** The FAQ's text, built from these sources. */
const text = (src: FaqSources = FAQ_DEFAULTS) => faqPlainText(src);
/** One section's text. */
const section = (id: string, src: FaqSources = FAQ_DEFAULTS) => {
  const s = faqPage(src).sections.find((x) => x.id === id)!;
  return plainText(s.blocks);
};
const withSettings = (patch: Partial<typeof DEFAULT_SETTINGS>): FaqSources => ({ ...FAQ_DEFAULTS, settings: { ...FAQ_DEFAULTS.settings, ...patch } });

describe("the FAQ's contents", () => {
  const page = faqPage();
  const anchors = faqAnchors(page);

  it("has every section the brief lists, in order", () => {
    expect(page.toc.map((t) => t.id)).toEqual(["modes", "scoring", "boss-brain", "boss-powers", "god-king", "crates", "fair-play", "credits"]);
  });

  it("every table-of-contents entry has a matching section, and every sub-entry a heading in it", () => {
    for (const t of page.toc) {
      const s = page.sections.find((x) => x.id === t.id);
      expect(s, t.id).toBeDefined();
      expect(s!.title).toBe(t.title);
      for (const sub of t.subs) {
        const h = s!.blocks.find((b) => b.kind === "heading" && b.id === sub.id);
        expect(h, `${t.id} › ${sub.id}`).toBeDefined();
        expect(h && h.kind === "heading" && h.text).toBe(sub.title);
      }
    }
  });

  it("every section is in the contents, and every anchor is unique", () => {
    expect(page.sections.map((s) => s.id)).toEqual(page.toc.map((t) => t.id));
    expect(new Set(anchors).size).toBe(anchors.length);
    expect(anchors).not.toContain("contents");
  });

  it("every link inside the FAQ jumps to an anchor that exists", () => {
    const links = page.sections.flatMap((s) => linksOf(s.blocks)).filter((h) => h.startsWith("#"));
    expect(links.length).toBeGreaterThan(3);
    for (const l of links) expect(anchors, l).toContain(l.slice(1));
  });

  it("the bosses' sections list their sub-headings; the boss brain section has the handover and the rating gap", () => {
    const brain = page.toc.find((t) => t.id === "boss-brain")!;
    expect(brain.subs.map((s) => s.id)).toEqual(expect.arrayContaining(["boss-strength", "stockfish-brain", "maia-brain", "handover", "rating-gap"]));
    expect(page.toc.find((t) => t.id === "god-king")!.subs.map((s) => s.id)).toContain("last-stand");
  });

  it("every playable boss has its own block, under its own heading", () => {
    const powers = page.sections.find((s) => s.id === "boss-powers")!;
    for (const b of BOSS_ROSTER.filter(isPlayable)) {
      expect(BOSS_BLOCKS[b.id], b.id).toBeTypeOf("function");
      expect(anchorsOf(powers.blocks)).toContain(`boss-${b.id}`);
      expect(section("boss-powers")).toContain(b.name);
    }
  });

  it("leaves no markup in the words", () => {
    const t = text();
    expect(t).not.toMatch(/\*\*|\]\(#|\{#|\$\{|undefined|NaN|null/);
  });
});

const anchorsOf = (blocks: ReturnType<typeof parse>) => blocks.flatMap((b) => (b.kind === "heading" ? [b.id] : []));

describe("the FAQ's numbers come from the settings", () => {
  it("the Last Stand's thresholds", () => {
    const s = DEFAULT_SETTINGS;
    const t = section("god-king");
    expect(t).toContain(`Under ${s.lastStandFrom}%: no save`);
    expect(t).toContain(`From ${s.lastStandFrom}% to ${s.lastStandShareBelow}%`);
    expect(t).toContain(`starts at ${s.lastStandLoss + s.lastStandChargedExtra} with charges`);
    const moved = section("god-king", withSettings({ lastStandFrom: 15, lastStandShareBelow: 45, lastStandLoss: 40 }));
    expect(moved).toContain("Under 15%: no save");
    expect(moved).toContain("From 15% to 45%");
    expect(moved).toContain(`starts at ${40 + s.lastStandChargedExtra} with charges`);
  });

  it("the handover: Maia's rating lines, the crowd's margin, the worked example, the bridge and where Stockfish takes over", () => {
    const t = section("boss-brain");
    const M = BOSS_BRAIN;
    const [x0] = M.maiaRating[0]!;
    expect(t).toContain(`from ${x0} to`);
    expect(t).toContain(`= ${maiaRatingFor(2000 + M.crowdMargin)}`);
    expect(t).toContain(`A level from ${M.bridgeFrom}: Maia with the light guard`);
    expect(t).toContain(`from ${M.bridgeStrictFrom}: Maia with the strict guard`);
    expect(t).toContain(`A strength from ${M.stockfishFrom} up: Stockfish`);
    expect(t).not.toContain("Planned");
    const brain = { ...M, maiaRating: [[1400, 1200], [2400, 2000], [2600, 2600]] as const, crowdMargin: 100, bridgeFrom: 2500, bridgeStrictFrom: 2650, bridgeShareFrom: 2500, stockfishFrom: 2900, bridgeStockfishShare: 0.4 };
    const moved = section("boss-brain", { ...FAQ_DEFAULTS, brain });
    expect(moved).toContain("from 1400 to 2400: Maia = 1200 + 0.8 × (level − 1400)");
    expect(moved).toContain("from 2600 up: Maia = 2600");
    expect(moved).toContain("level = strength + 100 (a crowd)");
    // (A raid's boss at 2000: level 2100, Maia 1200 + 0.8 × 700.)
    expect(moved).toContain("1200 + 0.8 × (2100 − 1400) = 1200 + 560 = 1760");
    expect(moved).toContain("A level from 2500: Maia with the light guard");
    expect(moved).toContain("from 2650: Maia with the strict guard");
    expect(moved).toContain("Stockfish's share = 40% × (strength − 2500) / 400");
    expect(moved).toContain("A strength from 2900 up: Stockfish");
    // (The table: 2000 alone at Maia 1680, a crowd at 1760, no Stockfish moves; at 2400 the crowd's level (2500) meets
    // the light guard first; 2600 alone light, a crowd strict, a quarter of the moves Stockfish's.)
    expect(moved).toMatch(/\n2000\s+Maia 1680\s+Maia 1760\s+none/);
    expect(moved).toMatch(/\n2400\s+Maia 2000\s+Maia 2300, light guard\s+none/);
    expect(moved).toMatch(/\n2600\s+Maia 2600, light guard\s+Maia 2600, strict guard\s+10%/);
    expect(moved).toMatch(/\n2900\s+Stockfish\s+Stockfish\s+all/);
  });

  it("every boss is on Maia (or the bosses with a brain of their own are named)", () => {
    expect(section("boss-brain")).toContain(BOSS_BRAIN.forPlayers ? "Every boss plays with Maia" : "In the test, every boss plays with Maia");
    const own = section("boss-brain", { ...FAQ_DEFAULTS, brain: { ...BOSS_BRAIN, byBoss: { hollow: "stockfish" } } });
    expect(own).toContain("every boss except Hollow (Stockfish) plays with Maia");
  });

  it("Maia is marked as being tested only while it's off for players", () => {
    expect(section("boss-brain")).toContain(BOSS_BRAIN.forPlayers ? "New." : "Being tested; coming soon.");
    const on = section("boss-brain", { ...FAQ_DEFAULTS, brain: { ...BOSS_BRAIN, forPlayers: true } });
    expect(on).not.toContain("Being tested");
    const off = section("boss-brain", { ...FAQ_DEFAULTS, brain: { ...BOSS_BRAIN, forPlayers: false } });
    expect(off).toContain("Being tested; coming soon.");
  });

  it("the blunder guard, the slips and the strength example", () => {
    const t = section("boss-brain");
    expect(t).toContain(`more than ${DEFAULT_SETTINGS.bossMaxLoss} points against the best move`);
    expect(t).toContain(`below ${DEFAULT_SETTINGS.bossStumbleBelow} a boss sometimes slips`);
    const moved = section("boss-brain", withSettings({ bossMaxLoss: 12, bossStumbleBelow: 2200 }));
    expect(moved).toContain("more than 12 points against the best move");
    expect(moved).toContain("below 2200 a boss sometimes slips");
    const roster = BOSS_ROSTER.map((b) => (b.id === "bigboy" ? { ...b, offset: -200 } : b));
    const tier = BOSS_TIERS.find((t) => t > 1750)!;
    const hard = BOSS_DIFFICULTY.find((d) => d.id === "hard")!.elo;
    expect(section("boss-brain", { ...FAQ_DEFAULTS, roster })).toContain(`Big Boy at Hard: ${tier} − 200 + ${hard} = ${tier - 200 + hard}`);
  });

  it("the expected-score formula", () => {
    expect(eloExpected(0)).toBe(0.5);
    expect(eloExpected(200)).toBeCloseTo(0.76, 2);
    expect(eloExpected(400)).toBeCloseTo(0.909, 3);
    expect(section("boss-brain")).toMatch(new RegExp(`\\n400\\s+${eloExpected(400).toFixed(2)}\\s+${(1 - eloExpected(400)).toFixed(2)}`));
  });

  it("the powers and the rage meter", () => {
    const t = section("boss-powers");
    expect(t).toContain(`can't move for ${BOSS_POWERS.freezeTurns} turns`);
    expect(t).toContain(`The meter fills to ${BOSS_POWERS.rageFull}`);
    const moved = section("boss-powers", { ...FAQ_DEFAULTS, powers: { ...BOSS_POWERS, freezeTurns: 3, ragePerMove: 4, candleShots: 30 } });
    expect(moved).toContain("can't move for 3 turns");
    expect(moved).toContain("- 4 for every crowd move");
    expect(moved).toContain("30 fireballs");
    expect(moved).toContain("full after about 25 crowd moves");
    // Again and again (Eric, Oct 11), the King's strikes, each boss's speed, and the rates' standing.
    expect(t).toContain("again and again");
    expect(t).toContain(`${BOSS_POWERS.rageStrike} each time the God King strikes the boss`);
    expect(t).toContain(`Ginger ×${BOSS_POWERS.rageSpeed.gingerbread}`);
    expect(t).toContain("not yet tested with bots");
    expect(t).toContain("two ultimates never overlap");
    expect(t).toContain("only one of your pieces may move, picked at random");
    // Ginger's blizzard (Oct 12): its turns, the count free on its second, the thaw; numbers from the settings.
    expect(t).toContain(`Blizzard (ultimate): it lasts ${BOSS_POWERS.blizzardTurns} turns.`);
    expect(t).toContain(`On its second, ${BOSS_POWERS.blizzardFree[1]![0]} or ${BOSS_POWERS.blizzardFree[1]![1]} may move in all`);
    expect(t).toContain("On its third, the ice is gone and every piece moves again.");
    expect(t).toContain("The pieces that thaw next turn show cracked, dripping ice the turn before.");
    expect(t).toContain("in check, one that can get you out of it");
    expect(t).toContain(`the blizzard's ${BOSS_POWERS.blizzardTurns} turns`);
    const longer = section("boss-powers", { ...FAQ_DEFAULTS, powers: { ...BOSS_POWERS, blizzardTurns: 4, blizzardFree: [[1, 1], [3, 3], [5, 7]] } });
    expect(longer).toContain("it lasts 4 turns.");
    expect(longer).toContain("On its second, 3 may move in all");
    expect(longer).toContain("On its third, 5 to 7 may move in all");
    expect(longer).toContain("On its fourth, the ice is gone");
    expect(section("boss-powers", { ...FAQ_DEFAULTS, powers: { ...BOSS_POWERS, rageStrike: 30 } })).toContain("30 each time the God King strikes the boss");
    expect(section("god-king")).toContain(`${BOSS_POWERS.rageStrike} on its rage meter`);
    // Jefferson's candle: a share on his own half (Oct 11).
    expect(t).toContain(`About ${Math.round(BOSS_POWERS.candleOwnShare * 100)}% of each wave falls on his own half`);
    expect(section("boss-powers", { ...FAQ_DEFAULTS, powers: { ...BOSS_POWERS, candleOwnShare: 0.25 } })).toContain("About 25% of each wave");
  });

  it("the judge, the re-check and brilliant moves", () => {
    const t = section("scoring");
    expect(t).toContain(`A missed move scores −${-DEFAULT_SETTINGS.missedMoveScore}`);
    const moved = section("scoring", { ...withSettings({ engineNodes: 300_000, recheckMax: 4 }), brilliant: { ...FAQ_DEFAULTS.brilliant, minPickers: 7 } });
    expect(moved).toContain("300,000 positions");
    expect(moved).toContain("up to 4 moves a board");
    expect(moved).toContain("among at least 7 pickers");
  });

  it("the worked example is scored by the game's own scoring", () => {
    const t = section("scoring");
    expect(t).toMatch(/A\s+0\.62\s+0\s+\+10/);
    expect(t).toMatch(/D\s+0\.30\s+32\s+−22/);
    expect(t).toContain("(0 + 4 + 4 + 32) / 4 = 10");
  });

  it("the crates' odds", () => {
    const crates = FAQ_DEFAULTS.crates.map((c) => ({ ...c, strip: c.strip.map((x) => (x.tier === "common" ? { ...x, weight: 50 } : x)) }));
    const moved = section("crates", { ...FAQ_DEFAULTS, crates });
    // Common's weight 50 of 110 in all.
    expect(moved).toContain(`${((50 / 110) * 100).toFixed(1)}%`);
  });
});

describe("the FAQ on Squads (v2: tokens, blocks, the team vote)", () => {
  it("its numbers come from the settings", () => {
    const Q = FAQ_DEFAULTS.squads;
    const t = section("modes");
    expect(t).toContain(`${Q.tokens.perMatch} tokens for the match`);
    expect(t).toContain(`${Q.blocks.bankPerMatch} block points a match`);
    expect(t).toContain("the team vote");
    expect(t).toContain("a tie is settled by a coin");
    expect(t).not.toContain("Pick and Block");
    const changed = section("modes", { ...FAQ_DEFAULTS, squads: { ...Q, tokens: { ...Q.tokens, perMatch: 3 }, blocks: { ...Q.blocks, bankPerMatch: 7, maxPerTurn: 2, castlingCost: null, cost: { ...Q.blocks.cost, q: 4 } } } });
    expect(changed).toContain("3 tokens for the match");
    expect(changed).toContain("7 block points a match");
    expect(changed).toContain("4 for a queen's;");
    expect(changed).toContain("Up to 2 blocks a turn");
    expect(changed).not.toContain("for castling");
  });
});

describe("the FAQ on Squads' modes and Mercenary", () => {
  it("says what the modes are, and Mercenary's numbers come from the settings", () => {
    const Q = FAQ_DEFAULTS.squads;
    const M = Q.mercenary;
    const t = section("modes");
    expect(t).toContain("Classic is just chess");
    expect(t).toContain("Mercenary adds coins");
    expect(t).toContain("coming soon");
    expect(t).toContain(`a knight or bishop ${M.capture.n}`);
    expect(t).toContain(`every match your squad plays pays ${M.played} coins when it ends, win or lose, and winning it pays ${M.matchWin} more`);
    expect(t).toContain(`a board pays double in Pairs and ${M.roundScale[2]} times as much in the final`);
    expect(t).toContain(`A brilliant move pays ${M.brilliant.coins}, at most ${M.brilliant.capPerMatch} times per squad per match`);
    expect(t).not.toMatch(/breather/i);
    expect(t).toContain(`Stockfish token (${M.items.stockfish.price} coins, up to ${M.items.stockfish.cap} a round)`);
    expect(t).toContain(`Shield (${M.items.shield.price} coins`);
    expect(t).toContain(`${M.priceStep} coins more for every one`);
    expect(t).toContain("Never the other squad's moves");
    expect(t).toContain("use them or lose them");
    expect(t).toContain(`Time chip (25, 25, 50, 50, then 50 coins each; your squad holds up to ${M.items.chip.cap})`);
    expect(t).toContain(`${M.chipSeconds} seconds more for that move`);
    expect(t).toContain("kept for the next round");
    const changed = section("modes", { ...FAQ_DEFAULTS, squads: { ...Q, mercenary: { ...M, priceStep: 70, chipSeconds: 45, items: { ...M.items, chip: { price: 10, cap: 4, prices: [10, 20] } } } } });
    expect(changed).toContain("70 coins more for every one");
    expect(changed).toContain("Time chip (10, 20, then 20 coins each; your squad holds up to 4): tap it during your squad's move, on the board you're playing: 45 seconds more");
  });
});

describe("the FAQ keeps to how the game works", () => {
  it("says nothing about how the app talks to the server, admin or test controls", () => {
    // ("Token" alone is a login's; Squads' same-move tokens and Mercenary's Stockfish tokens are rules of the game, so a
    // line about them may say it.)
    const t = text()
      .split("\n")
      .map((l) => (/same-move|stockfish token/i.test(l) ? l.replace(/\btokens?\b/gi, "") : l))
      .join("\n");
    expect(t).not.toMatch(/\/api\b|websocket|endpoint|protocol|durable|\bhost\b|admin|secret|token|rate limit|\?[a-z]+=|test switch|trigger ultimate/i);
  });

  it("is built the same every time (no randomness)", () => {
    expect(text()).toBe(text());
    expect(faqSections().map((s) => s.id)).toEqual(faqPage().toc.map((t) => t.id));
  });
});

describe("the FAQ's text format", () => {
  it("headings, lists, tables, formulas, notes and links", () => {
    const blocks = parse(`### A heading {#here}\n\nSome **bold** and a [link](#here).\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n$ x = 1\n$ y = 2\n\n> **Note.** Planned.`);
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "para", "list", "table", "formula", "note"]);
    expect(blocks[0]).toEqual({ kind: "heading", id: "here", text: "A heading" });
    expect(linksOf(blocks)).toEqual(["#here"]);
    const table = blocks[3]!;
    expect(table.kind === "table" && table.rows.length).toBe(1);
    expect(blocks[4]).toEqual({ kind: "formula", lines: ["x = 1", "y = 2"] });
    expect(inlineText(blocks[1]!.kind === "para" ? blocks[1]!.inlines : [])).toBe("Some bold and a link.");
  });

  it("a heading without an id gets one from its words", () => {
    expect(parse("### The God King's save")[0]).toEqual({ kind: "heading", id: "the-god-king-s-save", text: "The God King's save" });
  });
});
