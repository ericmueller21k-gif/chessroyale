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

/** The 1 v 1 games and other games in the mockup's list (the 1 v 1 ones as RankedSummary.recent will carry them). */
export const MOCKUP_RANKED_GAMES = [
  { opponent: { id: "g43", name: "Guest 43", look: { head: { def: "wizard-hat", color: "red", blemish: 10, seed: 1 } } }, result: "win", rp: 18, at: hoursAgo(2) },
  { opponent: { id: "woolly", name: "Woolly", look: { head: { def: "party-hat", color: "cobalt", blemish: 30, seed: 2 } } }, result: "loss", rp: -14, at: hoursAgo(30) },
  { opponent: { id: "g21", name: "Guest 21", look: {} }, result: "win", rp: 22, at: hoursAgo(31) },
  { opponent: { id: "g49", name: "Guest 49", look: { skin: { def: "ninja-gi", color: "midnight", blemish: 0, seed: 4 } } }, result: "loss", rp: -11, at: hoursAgo(96) },
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
      { mode: "boss", online: true, placement: 1, players: 100, team: "w", won: true, survived: true, bestMove: null, bossElo: 1500, bossId: "gingerbread", playedAt: hoursAgo(50), ranked: false },
      { mode: "crowd", online: true, placement: 4, players: 100, team: "b", won: true, survived: null, bestMove: "Nxe5", bossElo: null, playedAt: hoursAgo(75), ranked: false },
      { mode: "squads", online: true, placement: 3, players: 32, team: null, won: false, survived: null, bestMove: null, bossElo: null, playedAt: hoursAgo(120), ranked: false },
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
