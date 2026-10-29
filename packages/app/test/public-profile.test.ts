import { describe, expect, it } from "vitest";
import { RANKED_1V1, rankView, type ItemLook, type RankedRecentGame } from "@chessroyale/core";
import type { PublicProfile } from "../src/account.ts";
import { WORN_ORDER } from "../src/components/FrontDoor.tsx";
import { RANKED_MODES, RECENT_SHOWN, ago, hasOwnIcon, joinedText, levelLine, nth, peakLine, rankedState, recentRows, recordText, rpChange, seenLine, streakText, tierTitle, winRate, wornTiles } from "../src/public-profile.ts";

/** The public profile's words and numbers (docs/decisions/2026-10-28-public-profile.md). */

const H = 3_600_000;
const NOW = Date.UTC(2026, 9, 28, 15, 0);
/** A time `h` hours before NOW. */
const before = (h: number) => NOW - h * H;

const rankAt = (tier: string, division: number, points = 45) => {
  const R = RANKED_1V1;
  const t = R.tiers.findIndex((x) => x.name.toLowerCase() === tier);
  return rankView({ games: R.placements.games, ladder: (t * R.divisions + (R.divisions - division)) * R.pointsPerDivision + points }, R);
};

describe("the line under the name", () => {
  const base = { joinedAt: Date.UTC(2026, 9, 2, 12), lastSeen: null, online: false };
  it("online: a dot, 'Online now', and when they joined", () => {
    expect(seenLine({ ...base, online: true, lastSeen: NOW }, NOW)).toEqual({ dot: true, text: "Online now · Joined Oct 2026" });
  });
  it("offline: no dot, when they were last seen, and when they joined", () => {
    expect(seenLine({ ...base, lastSeen: before(2) }, NOW)).toEqual({ dot: false, text: "Last seen 2h ago · Joined Oct 2026" });
    expect(seenLine({ ...base, lastSeen: NOW - 5 * 60_000 }, NOW).text).toBe("Last seen 5m ago · Joined Oct 2026");
    expect(seenLine({ ...base, lastSeen: before(36) }, NOW).text).toBe("Last seen yesterday · Joined Oct 2026");
    expect(seenLine({ ...base, lastSeen: Date.UTC(2026, 9, 20, 12) }, NOW).text).toBe("Last seen Oct 20 · Joined Oct 2026");
    // (Seen never, say an account made and never opened again: no made-up time.)
    expect(seenLine(base, NOW).text).toBe("Offline · Joined Oct 2026");
  });
  it("hiding when they're online: just when they joined, never a dot or a last-seen time", () => {
    expect(seenLine({ ...base, hidden: true, online: false, lastSeen: null }, NOW)).toEqual({ dot: false, text: "Joined Oct 2026" });
    // (Whatever the truth: a profile that hides it says nothing of it.)
    expect(seenLine({ ...base, hidden: true, online: true, lastSeen: NOW }, NOW)).toEqual({ dot: false, text: "Joined Oct 2026" });
  });
  it("how long ago: minutes and hours inside a day, then Yesterday, then the date", () => {
    expect(ago(NOW - 20_000, NOW)).toBe("just now");
    expect(ago(NOW - 59 * 60_000, NOW)).toBe("59m ago");
    expect(ago(before(2), NOW)).toBe("2h ago");
    expect(ago(before(23), NOW)).toBe("23h ago");
    expect(ago(before(30), NOW)).toBe("Yesterday");
    expect(ago(Date.UTC(2026, 9, 25, 12), NOW)).toBe("Oct 25");
    expect(joinedText(Date.UTC(2026, 9, 2, 12))).toBe("Oct 2026");
  });
  it("the level line is Level N where the test switches count, else empty (and always a line)", () => {
    expect(levelLine(true, 38)).toBe("Level 38");
    expect(levelLine(false, 38)).toBe("");
  });
  it("an icon of their own goes behind their pawn; the default pawn, or none, gets the theme's yellow", () => {
    expect(hasOwnIcon("data:image/png;base64,AAAA")).toBe(true);
    expect(hasOwnIcon("🦁")).toBe(true);
    expect(hasOwnIcon("♟")).toBe(false);
    expect(hasOwnIcon("")).toBe(false);
    expect(hasOwnIcon(undefined)).toBe(false);
  });
});

describe("Ranked Standing", () => {
  it("the menu: 1v1 first (the default), 50 v 50 and Squads", () => {
    expect(RANKED_MODES.map((m) => m.label)).toEqual(["1v1", "50 v 50", "Squads"]);
  });
  it("the tier, the way the card names it", () => {
    expect(tierTitle(rankAt("gold", 3))).toBe("Gold 3");
    expect(tierTitle(rankAt("wood", 5, 0))).toBe("Wood 5");
    expect(tierTitle(rankView({ games: 5, ladder: RANKED_1V1.topFloor + 120, place: 300 }, RANKED_1V1))).toBe("Pearlescent");
    expect(tierTitle(rankView({ games: 5, ladder: RANKED_1V1.topFloor + 120, place: 50 }, RANKED_1V1))).toBe("Transcendent");
    expect(tierTitle(rankView({ games: 2, ladder: null }, RANKED_1V1))).toBe("Placement 2/5");
    expect(rankAt("gold", 3, 45).points).toBe(45);
  });
  it("a top tier's RP counts above its floor, as the card shows it", () => {
    const top = rankView({ games: 5, ladder: RANKED_1V1.topFloor + 120, place: 50 }, RANKED_1V1);
    expect(top.points).toBe(120);
    expect(top.division).toBeNull();
  });
  it("peak rank: the tier and division, or a dash when there's none yet (placements not done)", () => {
    expect(peakLine(rankAt("paragon", 4))).toBe("Peak rank: Paragon 4");
    expect(peakLine(null)).toBe("Peak rank: —");
    expect(peakLine(rankView({ games: 2, ladder: null }, RANKED_1V1))).toBe("Peak rank: —");
  });
  it("win rate is wins over games, a whole percent; a dash before a first game", () => {
    expect(winRate(34, 59)).toBe("58%");
    expect(winRate(1, 3)).toBe("33%");
    expect(winRate(2, 3)).toBe("67%");
    expect(winRate(0, 4)).toBe("0%");
    // (A draw is a game that isn't a win: 34 wins, 25 losses, 3 draws is 34 of 62.)
    expect(winRate(34, 34 + 25 + 3)).toBe("55%");
    expect(winRate(0, 0)).toBe("—");
  });
  it("wins and losses, and the streak", () => {
    expect(recordText(34, 25)).toBe("34 – 25");
    expect(recordText(0, 0)).toBe("0 – 0");
    expect(streakText(3)).toBe("3");
    expect(streakText(0)).toBe("0");
  });
  it("which state the card is in: banned (nothing else), never played, placements, ranked", () => {
    expect(rankedState(rankAt("gold", 3), true)).toBe("banned");
    expect(rankedState(rankView(null, RANKED_1V1), false)).toBe("unranked");
    expect(rankedState(rankView({ games: 0, ladder: null }, RANKED_1V1), false)).toBe("unranked");
    expect(rankedState(rankView({ games: 2, ladder: null }, RANKED_1V1), false)).toBe("placement");
    expect(rankedState(rankAt("gold", 3), false)).toBe("ranked");
  });
});

describe("Recent Matches", () => {
  // (As the server's RankedSummary.recent has them: core's RankedRecentGame; a deleted account's id is "deleted", its look null.)
  const duels: RankedRecentGame[] = [
    { opponent: { id: "a", name: "Guest 43", look: {} }, result: "win", points: 18, at: before(2) },
    { opponent: { id: "b", name: "Woolly", look: {} }, result: "loss", points: -14, at: before(30) },
    { opponent: { id: "deleted", name: "Deleted account", look: null }, result: "draw", points: 0, at: before(60) },
    { opponent: { id: "c", name: "Guest 21", look: {} }, result: "win", points: null, at: before(200) },
  ];
  const other = (patch: Partial<PublicProfile["recent"][number]>): PublicProfile["recent"][number] => ({
    mode: "crowd",
    online: true,
    placement: 5,
    players: 100,
    team: "w",
    won: true,
    survived: null,
    bestMove: null,
    bossElo: null,
    playedAt: before(10),
    ranked: null,
    ...patch,
  });

  it("a ranked 1 v 1 game: a result pill, 'vs. <name>', Ranked · how long ago, and its RP", () => {
    const [win, loss, draw, noRp] = recentRows(duels, [], NOW);
    expect(win).toMatchObject({ pill: { text: "WIN", tone: "win" }, title: "vs. Guest 43", sub: "Ranked · 2h ago", rp: { text: "+18", tone: "gain" }, face: { kind: "pawn" } });
    expect(loss).toMatchObject({ pill: { text: "LOSS", tone: "loss" }, title: "vs. Woolly", sub: "Ranked · Yesterday", rp: { text: "−14", tone: "loss" } });
    expect(draw).toMatchObject({ pill: { text: "DRAW", tone: "draw" }, rp: { text: "0", tone: "none" } });
    // (A placement game, one fair play held, or one from before the points were kept: no RP, "—".)
    expect(noRp).toMatchObject({ pill: { text: "WIN" }, sub: "Ranked · Oct 20", rp: { text: "—", tone: "none" } });
  });

  it("a raid: WIN if the boss fell, else LOSS; 'vs. <boss>' with the boss's face; Casual", () => {
    const [won, lost] = recentRows([], [other({ mode: "boss", bossId: "gingerbread", bossElo: 1500, won: true, playedAt: before(5) }), other({ mode: "boss", bossId: "clown", bossElo: 1900, won: false, survived: true, playedAt: before(6) })], NOW);
    expect(won).toMatchObject({ pill: { text: "WIN", tone: "win" }, title: "vs. Ginger", sub: "Casual · 5h ago", rp: { text: "—" }, face: { kind: "boss", id: "gingerbread" } });
    expect(lost).toMatchObject({ pill: { text: "LOSS", tone: "loss" }, face: { kind: "boss", id: "clown" } });
    // (Standing at the end isn't a win: the boss has to fall.)
    expect(lost!.title.startsWith("vs. ")).toBe(true);
  });

  it("a raid from before bosses had identities keeps the tier's old name; one with nothing says 'Boss raid'", () => {
    const [old, none] = recentRows([], [other({ mode: "boss", bossId: null, bossElo: 1500, won: true, playedAt: before(1) }), other({ mode: "boss", bossId: null, bossElo: null, won: null, playedAt: before(2) })], NOW);
    expect(old!.title).toMatch(/^vs\. /);
    expect(old!.face).toMatchObject({ kind: "boss", id: null });
    expect(none).toMatchObject({ title: "Boss raid", pill: { text: "LOSS" } });
  });

  it("50 v 50: WIN or LOSS by its team's result, titled '50 v 50' with a mode icon", () => {
    const [win, loss, old] = recentRows([], [other({ won: true, playedAt: before(1) }), other({ won: false, playedAt: before(2) }), other({ won: null, team: null, placement: 1, playedAt: before(3) })], NOW);
    expect(win).toMatchObject({ pill: { text: "WIN", tone: "win" }, title: "50 v 50", sub: "Casual · 1h ago", face: { kind: "mode", mode: "crowd" }, rp: { text: "—" } });
    expect(loss).toMatchObject({ pill: { text: "LOSS", tone: "loss" } });
    // (An older match with no team: everyone moved, so the one who placed 1st won.)
    expect(old).toMatchObject({ pill: { text: "WIN" } });
    expect(recentRows([], [other({ won: null, team: null, placement: 7 })], NOW)[0]!.pill.text).toBe("LOSS");
  });

  it("Squads: their place ('3rd'), titled 'Squads'; Classic the same", () => {
    const [third, first, classic] = recentRows([], [other({ mode: "squads", placement: 3, playedAt: before(1) }), other({ mode: "squads", placement: 1, playedAt: before(2) }), other({ mode: "classic", placement: 12, playedAt: before(3) })], NOW);
    expect(third).toMatchObject({ pill: { text: "3rd", tone: "place" }, title: "Squads", face: { kind: "mode", mode: "squads" } });
    expect(first).toMatchObject({ pill: { text: "1st", tone: "win" } });
    expect(classic).toMatchObject({ pill: { text: "12th" }, title: "Classic", face: { kind: "mode", mode: "classic" } });
  });

  it("the two lists merge by time, newest first, whatever list a game came from", () => {
    const rows = recentRows(duels, [other({ playedAt: before(1) }), other({ mode: "squads", placement: 2, playedAt: before(45) }), other({ playedAt: before(500) })], NOW);
    expect(rows.map((r) => r.title)).toEqual(["50 v 50", "vs. Guest 43", "vs. Woolly", "Squads", "vs. Deleted account"]);
    expect(rows.map((r) => r.at)).toEqual([...rows.map((r) => r.at)].sort((a, b) => b - a));
  });

  it("only the last five", () => {
    const many = Array.from({ length: 8 }, (_, i): RankedRecentGame => ({ opponent: { id: `p${i}`, name: `P${i}`, look: {} }, result: "win", points: 10, at: before(i + 1) }));
    const rows = recentRows(many, [other({ playedAt: before(0.5) }), other({ playedAt: before(100) })], NOW);
    expect(RECENT_SHOWN).toBe(5);
    expect(rows).toHaveLength(5);
    // (The newest five of ten: the 50 v 50 half an hour ago, then P0 to P3. The oldest games are the ones that go.)
    expect(rows.map((r) => r.title)).toEqual(["50 v 50", "vs. P0", "vs. P1", "vs. P2", "vs. P3"]);
  });

  it("with nothing yet: no rows; no 1 v 1 games yet: the other games alone", () => {
    expect(recentRows([], [], NOW)).toEqual([]);
    expect(recentRows([], [other({})], NOW)).toHaveLength(1);
  });

  it("a deleted opponent's game still lists, with the default pawn", () => {
    const [row] = recentRows([duels[2]!], [], NOW);
    expect(row).toMatchObject({ title: "vs. Deleted account", face: { kind: "pawn", look: undefined } });
  });

  it("RP change: green plus, red minus (a real minus sign), a dash when unknown", () => {
    expect(rpChange(18)).toEqual({ text: "+18", tone: "gain" });
    expect(rpChange(-14)).toEqual({ text: "−14", tone: "loss" });
    expect(rpChange(null)).toEqual({ text: "—", tone: "none" });
    expect(rpChange(undefined)).toEqual({ text: "—", tone: "none" });
    expect(rpChange(0)).toEqual({ text: "0", tone: "none" });
  });

  it("places read 1st, 2nd, 3rd, 11th, 22nd", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(nth)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"]);
  });
});

describe("Equipped Cosmetics", () => {
  const look: ItemLook = {
    weapon: { def: "gift-tube", color: "cobalt", blemish: 55, seed: 3 },
    head: { def: "pirate-hat", color: "opal", blemish: 20, seed: 12 },
    skin: { def: "suit-and-tie", color: "opal", color2: "opal", blemish: 4, seed: 11 },
  };
  it("a tile for each worn item, in the order skin, head, face, weapon", () => {
    expect(wornTiles(look).map((t) => t.name)).toEqual(["Suit and Tie", "Pirate Hat", "Gift-Wrap Tube"]);
    const four = wornTiles({ ...look, face: { def: "smiley-face", color: "yellow", blemish: 0, seed: 1 } }).map((t) => t.slot);
    expect(four).toEqual(["skin", "head", "face", "weapon"]);
    // (The same order as today's profile's list: FrontDoor's WORN_ORDER.)
    expect(four).toEqual([...WORN_ORDER]);
  });
  it("'<Slot> · <colors>': two colors with an &, one color alone", () => {
    const lines = Object.fromEntries(wornTiles(look).map((t) => [t.name, t.line]));
    expect(lines["Suit and Tie"]).toBe("Skin · Opal & Opal");
    expect(lines["Pirate Hat"]).toBe("Head · Opal");
    // (The tube's second color comes from its seed: seed 3 gives Sage.)
    expect(lines["Gift-Wrap Tube"]).toBe("Weapon · Cobalt & Sage");
  });
  it("the rarity pill is the tier's name in the tier's color, as the shop colors it", () => {
    const tiers = Object.fromEntries(wornTiles(look).map((t) => [t.name, t.tier]));
    expect(tiers["Suit and Tie"]).toEqual({ name: "Epic", color: "#c084fc" });
    expect(tiers["Pirate Hat"]).toEqual({ name: "Legendary", color: "#fbbf24" });
    expect(tiers["Gift-Wrap Tube"]).toEqual({ name: "Legendary", color: "#fbbf24" });
    expect(wornTiles({ head: { def: "beanie", color: "red", blemish: 0, seed: 1 } })[0]!.tier).toEqual({ name: "Common", color: "#9ca3af" });
    expect(wornTiles({ head: { def: "fire-ice-crown", color: "red", blemish: 0, seed: 1 } })[0]!.tier).toEqual({ name: "Mythic", color: "#f43f5e" });
  });
  it("nothing worn, or an item that no longer exists: no tiles", () => {
    expect(wornTiles({})).toEqual([]);
    expect(wornTiles({ head: { def: "no-such-item", color: "red", blemish: 0, seed: 1 } })).toEqual([]);
  });
});
