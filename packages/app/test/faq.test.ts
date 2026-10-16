import { describe, expect, it } from "vitest";
import { BOSS_BRAIN, BOSS_DIFFICULTY, BOSS_POWERS, BOSS_ROSTER, BOSS_TIERS, CROWD_KNOCKOUTS, DEFAULT_SETTINGS, LEAVING, RANKED_1V1, RECLUSE_PHASE2, crowdFinalBoss, crowdFinalists, fixedLevel, isPlayable, maiaRatingFor, maiaTopRating } from "@chessroyale/core";
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
    expect(page.toc.map((t) => t.id)).toEqual(["modes", "scoring", "boss-brain", "boss-powers", "god-king", "crates", "fair-play", "credits", "privacy"]);
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
    // (The live note starts its sentence with it: "Every boss except…".)
    expect(own.toLowerCase()).toContain("every boss except hollow (stockfish) plays with maia");
  });

  it("Maia's download and its wait, from the settings: about downloadMb, kept; Solo waits loadGateMs at most, online never", () => {
    const on = section("boss-brain", { ...FAQ_DEFAULTS, brain: { ...BOSS_BRAIN, forPlayers: true, downloadMb: 35, loadGateMs: 12_000 } });
    expect(on).toContain("Maia is a human-like engine, so a boss plays more like a person than Stockfish does.");
    expect(on).toContain("It's a bigger download, about 35 MB, fetched once the first time you meet a boss and then kept on your device; on a slow connection, or if it can't load, the boss plays Stockfish instead.");
    expect(on).toContain("In Solo games and Boss alone, a boss battle waits for Maia to load before it starts, 12 s at most; online, nobody waits for it.");
    expect(on).not.toContain("Nobody ever waits for it");
    // (Off for players, nobody downloads it: no word of it.)
    expect(section("boss-brain", { ...FAQ_DEFAULTS, brain: { ...BOSS_BRAIN, forPlayers: false } })).not.toContain("bigger download");
  });

  it("Maia is marked as being tested only while it's off for players", () => {
    expect(section("boss-brain")).toContain(BOSS_BRAIN.forPlayers ? "plays with Maia" : "Being tested; coming soon.");
    // (No developer's notes in the player's FAQ: "New." went, Oct 15.)
    expect(section("boss-brain")).not.toContain("New.");
    const on = section("boss-brain", { ...FAQ_DEFAULTS, brain: { ...BOSS_BRAIN, forPlayers: true } });
    expect(on).not.toContain("Being tested");
    const off = section("boss-brain", { ...FAQ_DEFAULTS, brain: { ...BOSS_BRAIN, forPlayers: false } });
    expect(off).toContain("Being tested; coming soon.");
  });

  it("with Maia on for players, every line about it reads as live (the brain, Stockfish's part and the credits)", () => {
    const on: FaqSources = { ...FAQ_DEFAULTS, brain: { ...BOSS_BRAIN, forPlayers: true } };
    const brain = section("boss-brain", on);
    expect(brain).toContain("Every boss plays with Maia");
    expect(brain).toContain(`A boss at ${BOSS_BRAIN.stockfishFrom} or more plays with Stockfish`);
    for (const stale of ["Being tested", "coming soon", "isn't switched on", "In the test", "Every boss you meet today plays with Stockfish"]) expect(brain).not.toContain(stale);
    expect(section("credits", on)).toContain("Maia-3, the human-like model behind the bosses");
    expect(section("credits", on)).not.toContain("being tested");
    const off: FaqSources = { ...FAQ_DEFAULTS, brain: { ...BOSS_BRAIN, forPlayers: false } };
    expect(section("boss-brain", off)).toContain("Every boss you meet today plays with Stockfish");
    expect(section("credits", off)).toContain("being tested for bosses");
  });

  it("links the engines' source: the Maia box's in one line of its section, both in the credits, nothing \"on request\"", () => {
    const maia = faqPage().sections.find((s) => s.id === "boss-brain")!;
    const line = plainText(maia.blocks)
      .split("\n")
      .filter((l) => l.includes("source code"));
    expect(line).toEqual(["Maia runs in your browser as its own program, under the AGPL-3.0, and its source code is free to download."]);
    expect(linksOf(maia.blocks)).toContain("/engine/maia/maia-box-source.tar.gz");
    const credits = faqPage().sections.find((s) => s.id === "credits")!;
    expect(linksOf(credits.blocks)).toEqual(expect.arrayContaining(["/engine/maia/maia-box-source.tar.gz", "/engine/stockfish-source.tar.gz", "/engine/COPYING.txt", "/engine/maia/LICENSE.txt"]));
    expect(text()).not.toMatch(/on request/i);
  });

  it("links the privacy policy, the terms and the copyright page (as links, not bold text around them)", () => {
    const privacy = faqPage().sections.find((s) => s.id === "privacy")!;
    expect(linksOf(privacy.blocks)).toEqual(["/privacy", "/terms", "/copyright"]);
    expect(plainText(privacy.blocks)).not.toContain("](");
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
    expect(t).toContain("These rates are estimates, and may be tuned as real battles come in.");
    expect(t).not.toContain("not yet tested");
    expect(t).toContain("two ultimates never overlap");
    expect(t).toContain("only one of your pieces may move, picked at random");
    // Ginger's blizzard (Oct 12): its turns, the count free on its second, the thaw; numbers from the settings.
    expect(t).toContain(`Blizzard (ultimate): it lasts ${BOSS_POWERS.blizzardTurns} turns.`);
    expect(t).toContain(`On its second, ${BOSS_POWERS.blizzardFree[1]![0]} or ${BOSS_POWERS.blizzardFree[1]![1]} may move in all`);
    expect(t).toContain("On its third, the ice is gone and every piece moves again.");
    expect(t).toContain("The pieces that thaw next turn show cracked, dripping ice the turn before.");
    expect(t).toContain("in check, one that can get you out of it");
    expect(t).toContain(`the Blizzard's ${BOSS_POWERS.blizzardTurns} turns`);
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

  it("the opening allowance: its numbers from the settings, and both of the reveal's notes", () => {
    const t = section("scoring");
    expect(t).toContain("Through move 10, the first 8 points a move gives away don't count (less each move after that, and none from move 14)");
    expect(t).toContain("1.2 forgiven · opening");
    expect(t).toContain("no allowance · gave up material");
    expect(t).toContain("no allowance · missed a capture");
    expect(t).toContain("gives up a pawn or more");
    const moved = section("scoring", { ...FAQ_DEFAULTS, allowance: { points: 5, flatThrough: 8, goneBy: 12, materialPawns: 2 } });
    expect(moved).toContain("Through move 8, the first 5 points a move gives away don't count (less each move after that, and none from move 12)");
    expect(moved).toContain("gives up 2 pawns or more");
    // Never "free moves" or a "full grace": an allowance off each loss.
    expect(text()).not.toMatch(/free moves?|full grace/i);
  });

  it("ties at the cut line go through; the boss's tied strike waits", () => {
    const modes = section("modes");
    expect(modes).toContain("everyone tied exactly with the last player through stays in, and the cuts still to come take the extra, a little at each");
    expect(modes).toContain("Only the last cut before the ending breaks a tie");
    expect(modes).toContain("If two are still tied for the worst, nobody is struck");
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

  it("the clock vote's time controls, the default, and a raid's clock", () => {
    const t = section("modes");
    expect(t).toContain("Bullet 3+2 (3 minutes, +2 s a move, at most 10 s on a move), Blitz 5+3 (5 minutes, +3 s a move, at most 15 s on a move) or Rapid 10+5 (10 minutes, +5 s a move, at most 20 s on a move)");
    expect(t).toContain("Nobody voting means Blitz 5+3.");
    expect(t).toContain("as on a chess clock");
    // (A boss raid's clock by its name, as the vote names it.)
    expect(t).toContain("A boss raid is Rapid 10+5.");
    expect(t).not.toMatch(/Variable|Normal \(/);
    // Changed time controls (and a changed default) change the words.
    const V = FAQ_DEFAULTS.clockVote;
    const options = V.options.map((o) => (o.id === "bullet" ? { ...o, label: "Bullet 2+1", patch: { ...o.patch, timeBankSeconds: 120, timeIncrementSeconds: 1, moveClockSeconds: 8 } } : o));
    const moved = section("modes", { ...FAQ_DEFAULTS, clockVote: { options, defaultOption: options.findIndex((o) => o.id === "rapid") } });
    expect(moved).toContain("Bullet 2+1 (2 minutes, +1 s a move, at most 8 s on a move)");
    expect(moved).toContain("Nobody voting means Rapid 10+5.");
  });
});

describe("the FAQ on the Crowd's boss final (Eric, Oct 14: always the Hidden Boss, the top 4)", () => {
  const him = crowdFinalBoss()!;
  it("names him (the roster's name) and the number who face him (the knockouts), never typed", () => {
    const t = section("modes");
    // (The Crowd's ending is the boss final; "the Hidden Boss" with its article in a sentence.)
    expect(t).toContain(`a boss final (the top ${crowdFinalists("boss")} team up against the ${him.name})`);
    expect(t).toContain(`The Crowd's boss final is always the ${him.name}, for the last ${crowdFinalists("boss")} of a 50 v 50.`);
    // No strikes in the Crowd's final: the strike line is the raid's only.
    expect(t).toContain("until half the raid is left.");
    // Other knockouts, another name: the words follow.
    const renamed = BOSS_ROSTER.map(({ the: _, ...b }) => (b.id === him.id ? { ...b, name: "A Powerful Foe" } : b));
    const moved = section("modes", { ...FAQ_DEFAULTS, roster: renamed, crowdKnockouts: { ...CROWD_KNOCKOUTS, boss: CROWD_KNOCKOUTS.team } });
    expect(moved).toContain("a boss final (the top 8 team up against A Powerful Foe)");
    expect(moved).not.toContain(him.name);
  });

  it("his block: met only in the Crowd's final; no God King help, no strikes; the bullet clock and his second phase, numbers from the settings", () => {
    const t = section("boss-powers");
    expect(anchorsOf(faqPage().sections.find((s) => s.id === "boss-powers")!.blocks)).toContain(`boss-${him.id}`);
    expect(t).toContain(`Met only in the Crowd's boss final, where it's always him, against the top ${crowdFinalists("boss")}.`);
    expect(t).toContain(`full as turn ${BOSS_POWERS.bulletTurn} begins`);
    expect(t).toContain(`every bank is ${BOSS_POWERS.bulletBankSeconds / 60} minute`);
    expect(t).toContain(`${RECLUSE_PHASE2.boards} boards of Chess960 at once`);
    expect(t).toContain(`against Stockfish at ${RECLUSE_PHASE2.elo}`);
    expect(t).toContain("online, that's the crowd's victory");
    // "Still to come" lists only bosses without their art and powers.
    expect(t).toMatch(/Still to come/);
    expect(t.slice(t.indexOf("Still to come"))).not.toContain(him.name);
    const moved = section("boss-powers", { ...FAQ_DEFAULTS, powers: { ...BOSS_POWERS, bulletTurn: 9 }, phase2: { ...RECLUSE_PHASE2, slowMovesForUlt: 6 } });
    expect(moved).toContain("full as turn 9 begins");
    expect(moved).toContain("the team's 6th brings his last power");
  });

  it("his strength and brain are fixed (the Crowd's battle no longer follows the finalists' ratings); the God King can't help against him", () => {
    const t = section("boss-brain");
    expect(t).toContain(`The Crowd's boss final is always the ${him.name}, whose strength is fixed at ${fixedLevel()}`);
    expect(t).toContain(`Maia at its top rating, ${maiaTopRating()}, with no guard`);
    expect(section("god-king")).toContain(`His help doesn't work against the ${him.name}, the Crowd's boss`);
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

describe("the FAQ on Squads' screens (Oct 14: jump to my next board, who's watching)", () => {
  it("names the switch as the screen does, and says whether it starts on from the setting", () => {
    const t = section("modes");
    expect(t).toContain("Jump to my next board (on unless you switch it off, under the board) takes you straight to the board you play next turn");
    expect(t).toContain("An eye and pawns over a board show who else is watching it.");
    const off = section("modes", { ...FAQ_DEFAULTS, squadsWatching: { jumpToNext: false } });
    expect(off).toContain("Jump to my next board (off unless you switch it on, under the board)");
  });
});

describe("the FAQ on Squads' team clock (Oct 13: three chess time controls)", () => {
  it("names each time control in chess form with its bank, increment and cap, the default, the free seconds and sudden death, all from the settings", () => {
    const Q = FAQ_DEFAULTS.squads;
    const t = section("modes");
    const mins = (sec: number) => (sec === 60 ? "1 minute" : `${sec / 60} minutes`);
    for (const c of Q.clocks) {
      expect(t).toContain(`${c.label} ${c.bankSeconds / 60}+${c.incrementSeconds} (${mins(c.bankSeconds)}, +${c.incrementSeconds} s a move, at most ${c.capSeconds} s on a move)`);
    }
    expect(t).toContain(`The first ${Q.clocks[0]!.delaySeconds} s of every move are free`);
    const def = Q.clocks.find((c) => c.id === Q.clockDefault)!;
    expect(t).toContain(`Nobody voting means ${def.label} ${def.bankSeconds / 60}+${def.incrementSeconds}.`);
    expect(t).toContain("Every move made in time adds its seconds back");
    expect(t).toContain("sudden death: every move within the free seconds, until moves made in time earn some back");
    expect(t).not.toMatch(/\b(Fast|Normal|Long) \d/);
    // Changed settings: the words follow (an odd bank in m:ss, free seconds and top-ups that differ between options).
    const by = (id: string) => Q.clocks.find((c) => c.id === id)!;
    const clocks = [
      { ...by("rapid"), bankSeconds: 600, incrementSeconds: 5, capSeconds: 25, delaySeconds: 3, topUpSeconds: 120 },
      { ...by("blitz"), bankSeconds: 240, incrementSeconds: 2, capSeconds: 12, delaySeconds: 3, topUpSeconds: 60 },
      { ...by("bullet"), bankSeconds: 90, incrementSeconds: 1, capSeconds: 8, delaySeconds: 2, topUpSeconds: 20 },
    ];
    const changed = section("modes", { ...FAQ_DEFAULTS, squads: { ...Q, clocks, clockDefault: "rapid" } });
    expect(changed).toContain("Rapid 10+5 (10 minutes, +5 s a move, at most 25 s on a move), Blitz 4+2 (4 minutes, +2 s a move, at most 12 s on a move) or Bullet 1:30+1 (1:30 minutes, +1 s a move, at most 8 s on a move)");
    expect(changed).toContain("Nobody voting means Rapid 10+5.");
    expect(changed).toContain("The first few seconds of every move are free (Rapid 3 s, Blitz 3 s, Bullet 2 s); then your squad's clock runs");
    expect(changed).toContain("plus a top-up (Rapid 2 minutes, Blitz 1 minute, Bullet 20 s) as you go through");
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

describe("the FAQ: leaving or resigning", () => {
  it("says how to resign on a phone and a computer, what it does, and how long a seat waits (LEAVING)", () => {
    const t = text();
    expect(t).toContain("Leaving or resigning");
    expect(t).toContain("on a phone, tap ⋯ at the top right of the match, then Resign; on a computer, click the flag");
    expect(t).toContain(`Back within ${LEAVING.awayMs / 60_000} minutes, you're still in your seat`);
    expect(text({ ...FAQ_DEFAULTS, leaving: { awayMs: 90_000 } })).toContain("Back within 90 seconds, you're still in your seat");
    expect(faqAnchors(faqPage())).toContain("leaving");
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

describe("the FAQ: 1 v 1", () => {
  it("the mode, the vote's rule worked out by the game's own rule, the clocks, ranks, placements and coins, from the settings", () => {
    const t = text();
    expect(faqAnchors(faqPage())).toContain("mode-1v1");
    expect(t).toContain("Bullet 1+1 on the left, Blitz 3+2 in the middle and Rapid 10+5 on the right");
    expect(t).toContain("Bullet and Blitz make Bullet 2+1, Blitz and Rapid Blitz 5+3. Bullet against Rapid makes Blitz 3+2.");
    expect(t).toContain(`you both have ${RANKED_1V1.voteSeconds} seconds to drag your pawn`);
    expect(t).toContain(`Each side has ${RANKED_1V1.firstMoveSeconds} seconds for its first move`);
    expect(t).toContain("Iron, Bronze, Silver, Gold, Platinum, Emerald and Diamond");
    expect(t).toContain(`your first ${RANKED_1V1.placements.games} games show "Placement 1/${RANKED_1V1.placements.games}"`);
    expect(t).toContain("at most Diamond 4.");
    expect(t).toContain(`about +${RANKED_1V1.points.perGame} for a win and −${RANKED_1V1.points.perGame} for a loss against a player at your level`);
    expect(t).toContain(`${RANKED_1V1.coins.perMinute.win} coins a minute for a win`);
    expect(t).toContain(`Up to ${RANKED_1V1.coins.perDay} games a day pay coins`);
    // Changed numbers change the words.
    const R = { ...RANKED_1V1, voteSeconds: 7, controls: RANKED_1V1.controls.map((c) => (c.id === "blitz-rapid" ? { ...c, baseSeconds: 240 } : c)) };
    const changed = text({ ...FAQ_DEFAULTS, ranked: R });
    expect(changed).toContain("you both have 7 seconds");
    expect(changed).toContain("Blitz and Rapid Blitz 4+3");
  });
});
