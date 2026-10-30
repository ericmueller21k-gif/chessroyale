import type { Page } from "@playwright/test";
import { RANKED_1V1, rankView, type ItemLook } from "@chessroyale/core";

/**
 * A made-up public profile for the public profile's specs (docs/decisions/2026-10-28-public-profile.md), served in place of the
 * server's answer for one account id (`routeProfile`), so every card has something in it: Eric's mockup's player, HunChess, with
 * his Suit and Tie, Pirate Hat and Gift-Wrap Tube. (An e2e can't play dozens of ranked games; the server's side is in its unit tests.)
 */

export const DEMO_ID = "demo-hunchess";

/** A rank at a tier's division with `points` RP into it ("gold", 3, 45), as the server works it out. */
export function rankAt(tier: string, division: number, points = 45) {
  const R = RANKED_1V1;
  const t = R.tiers.findIndex((x) => x.name.toLowerCase() === tier);
  const ladder = (t * R.divisions + (R.divisions - division)) * R.pointsPerDivision + points;
  return rankView({ games: R.placements.games, ladder });
}

/** Their look in the mockup: Suit and Tie (Opal & Opal), Pirate Hat (Opal), Gift-Wrap Tube (Cobalt & Sage: seed 3 draws the sage). */
export const MOCKUP_LOOK: ItemLook = {
  skin: { def: "suit-and-tie", color: "opal", color2: "opal", blemish: 4, seed: 11 },
  head: { def: "pirate-hat", color: "opal", blemish: 20, seed: 12 },
  weapon: { def: "gift-tube", color: "cobalt", blemish: 55, seed: 3 },
};

const hoursAgo = (h: number) => Date.now() - h * 3_600_000;
/**
 * Yesterday (the viewer's) at `min` (under 30) minutes past midnight: "Yesterday" at any time of day. "Yesterday" needs a day
 * or more ago, so in the first half hour after midnight it comes in to the same share of the minutes since then (it ran
 * 00:00-00:20 as "23h ago" before, Oct 30); a larger `min` stays the later of two.
 */
const yesterday = (min: number) => {
  const d = new Date();
  const sinceMidnight = d.getTime() - new Date(d).setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + Math.min(min * 60_000, (sinceMidnight * min) / 30);
};
/** `n` days back at noon: always a date ("Oct 25"). */
const daysBack = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
};

/** The 1 v 1 games in the mockup's list, as the server's RankedSummary.recent carries them (core's RankedRecentGame: `points`, not RP). */
export const MOCKUP_RANKED_GAMES = [
  { opponent: { id: "g43", name: "Guest 43", look: { head: { def: "wizard-hat", color: "red", blemish: 10, seed: 1 } } }, result: "win", points: 18, at: hoursAgo(2) },
  { opponent: { id: "woolly", name: "Woolly", look: { head: { def: "party-hat", color: "cobalt", blemish: 30, seed: 2 } } }, result: "loss", points: -14, at: yesterday(20) },
  { opponent: { id: "g21", name: "Guest 21", look: {} }, result: "win", points: 22, at: yesterday(10) },
  { opponent: { id: "g49", name: "Guest 49", look: { skin: { def: "ninja-gi", color: "midnight", blemish: 0, seed: 4 } } }, result: "loss", points: -11, at: daysBack(5) },
] as const;

export function demoProfile(over: Record<string, unknown> = {}) {
  const rank = rankAt("gold", 3, 45);
  return {
    id: DEMO_ID,
    name: "HunChess",
    icon: "♟",
    look: MOCKUP_LOOK,
    joinedAt: Date.UTC(2026, 9, 2, 12),
    lastSeen: Date.now(),
    online: true,
    rating: null,
    tier: null,
    topPercent: null,
    banned: false,
    ranked1v1: {
      rank,
      games: 59,
      wins: 34,
      losses: 25,
      draws: 0,
      peak: rankAt("paragon", 4, 10),
      streak: 3,
      recent: MOCKUP_RANKED_GAMES,
    },
    crowd: { games: 12, wins: 3, avgPlace: 21.4, best: 1, cutsSurvivedPct: 80, brilliant: 4 },
    boss: { raids: 6, bossesBeaten: 2, strikesSurvived: 9, lastStands: 1, survivedPct: 50, brilliant: 2 },
    ratingHistory: [],
    bossesBeaten: [],
    recent: [
      // A raid the boss lost in, a 50 v 50 the team won, and a Squads match placed 3rd.
      { mode: "boss", online: true, placement: 1, players: 100, team: "w", won: true, survived: true, bestMove: null, bossElo: 1500, bossId: "gingerbread", playedAt: daysBack(3), ranked: false },
      { mode: "crowd", online: true, placement: 4, players: 100, team: "b", won: true, survived: null, bestMove: "Nxe5", bossElo: null, playedAt: daysBack(4), ranked: false },
      { mode: "squads", online: true, placement: 3, players: 32, team: null, won: false, survived: null, bestMove: null, bossElo: null, playedAt: daysBack(6), ranked: false },
    ],
    ...over,
  };
}

/** Serves `profile` for GET /api/profile/<its id> in place of the server's answer. */
export async function routeProfile(page: Page, profile: ReturnType<typeof demoProfile>, delayMs = 0) {
  await page.route(new RegExp(`/api/profile/${profile.id}$`), async (route) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({ json: profile });
  });
}

/** A 48 × 48 drawing as a PNG data URL, for an icon: a sky, with a cloud and a sun. (Drawn in the page, which has a canvas.) */
export async function skyIcon(page: Page): Promise<string> {
  return page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 48;
    const g = c.getContext("2d")!;
    const sky = g.createLinearGradient(0, 0, 0, 48);
    sky.addColorStop(0, "#3a8bff");
    sky.addColorStop(1, "#bfe1ff");
    g.fillStyle = sky;
    g.fillRect(0, 0, 48, 48);
    g.fillStyle = "#ffd84a";
    g.fillRect(30, 6, 10, 10);
    g.fillStyle = "#ffffff";
    g.fillRect(6, 24, 22, 6);
    g.fillRect(12, 20, 12, 6);
    g.fillStyle = "#2a6b2e";
    g.fillRect(0, 38, 48, 10);
    return c.toDataURL("image/png");
  });
}
