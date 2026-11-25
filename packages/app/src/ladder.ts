import { CROWD_SETTINGS, DEFAULT_SETTINGS, RANKED_1V1, botLook, rankView, type ItemLook, type RankView } from "@chessroyale/core";

/**
 * The season ladder (Eric, Nov 25: "a ladder board for all rank modes for the current season"): a MOCKUP. The page
 * (screens/Ladder.tsx) reads a `LadderPage`; today only `ladderMock()` makes one, behind `?ladder=mock` (and `mock-in`,
 * `mock-placement`, `mock-guest`). The endpoint it would read is in the mockup's NOTE.md (stills/ladder-mockup).
 */

/** The tabs, in order: one per ranked mode. A mode with no ranks of its own yet is greyed with its reason, never hidden. */
const crowdHalf = (CROWD_SETTINGS.lobbySize ?? DEFAULT_SETTINGS.lobbySize) / 2;
export const LADDER_MODES = [
  { id: "1v1", label: "1 v 1", soon: null },
  { id: "50v50", label: `${crowdHalf} v ${crowdHalf}`, soon: `${crowdHalf} v ${crowdHalf} has no ranks of its own yet. Its ladder starts when its ranks do.` },
  { id: "squads", label: "Squads", soon: "Squads has no ranks of its own yet. Its ladder starts when its ranks do." },
] as const;
export type LadderModeId = (typeof LADDER_MODES)[number]["id"];

/** One player's row: their place this season, how they look, their rank and record. */
export interface LadderRow {
  uid: string;
  name: string;
  look?: ItemLook;
  /** 1 + how many ladders are higher (equal ladders share a place). */
  place: number;
  rank: RankView;
  wins: number;
  losses: number;
  draws: number;
  /** Wins in a row now. */
  streak: number;
  you?: boolean;
}

/** One page of a mode's ladder, and your own standing (always shown: in the list when it's on this page, pinned below either way). */
export interface LadderPage {
  season: number;
  /** Ranked players this season (placements done). */
  total: number;
  rows: LadderRow[];
  /** Your row; `placement` while you're still placing; null for a guest. */
  you: LadderRow | { placement: { played: number; of: number } } | null;
}

/** "142 – 88" (draws left out, as the profile's W / L). */
export const recordLine = (r: Pick<LadderRow, "wins" | "losses">) => `${r.wins} – ${r.losses}`;
/** Wins over games, whole percent ("62%"). */
export const winPct = (r: Pick<LadderRow, "wins" | "losses" | "draws">) => {
  const g = r.wins + r.losses + r.draws;
  return g > 0 ? `${Math.round((100 * r.wins) / g)}%` : "—";
};
/** "Gold 2 · 45 RP", "Transcendent · 214 RP". */
export const rankLine = (rank: RankView) => (rank.division === null ? `${rank.tier} · ${rank.points} RP` : `${rank.tier} ${rank.division} · ${rank.points} RP`);
/** "#2,418". */
export const placeText = (n: number) => `#${n.toLocaleString("en-US")}`;
/** Your pinned row's words while you're still placing. */
export const placementLine = (p: { played: number; of: number }) => {
  const left = p.of - p.played;
  return `Play ${left} more placement game${left === 1 ? "" : "s"} to join the ladder`;
};

// ---------------- The mockup's made-up season ----------------

const NAMES = [
  "Rookbreaker", "QueenOfTarts", "pawnstorm88", "Knightowl", "Zugzwanger", "EnPassantPete", "Gambiteer", "castle_rock",
  "BishopBash", "DrawnOut", "TempoTaker", "forkyou_kindly", "MateInThree", "the_pinmaster", "Skewerlord", "Fianchetto",
  "Blunderbuss", "SacrificeEverything", "hangingpiece", "OpenFileOllie", "KingWalker", "Promotion_Pam", "Outpost", "zwischenzug",
  "TwoBishops", "Rookie_Mistake", "Backrank", "LuftLover", "PawnChainz", "EndgameEddie", "SicilianSam", "Caro_Kahnt",
  "DutchDefender", "LondonCalling", "Kingsgambit", "BongCloudBoss", "Isolani", "Hedgehog", "Desperado", "TripledPawns",
  "Sweet_Sixteen", "Bughouse", "Kibitzer", "TouchMove", "Patzer_Pro", "Smothered", "Underpromote", "StaleMateSally",
  "QueenTrade", "MinorityAttack", "Lasker_fan", "OppositeColors", "Windmill", "Zugzwang_Zoe", "dark_squares", "light_squares",
  "TheDragon", "Najdorf_Nate", "Ruy_Lopez_Jr", "Scandi", "AlekhineAl", "PircPirate", "Grob", "Benko_Bandit",
  "Catalan", "Nimzo", "Trompowsky", "Jobava", "Colle_Kid", "Stonewall", "Pawngrabber", "Bishop_Pair",
  "Rook_Lift", "QueenSac", "Greek_Gift", "Fried_Liver", "Evans", "Two_Knights", "Petrov", "Philidor",
  "Budapest", "Englund", "Halloween", "Orangutan", "Bird", "Larsen", "Reti", "Torre",
  "Vienna", "Danish", "Scotch", "Italian", "Spanish", "French_Toast", "Slav", "Semi_Slav",
  "Tarrasch", "Marshall", "Breyer", "Zaitsev",
];

/** A look with a hat or face piece most of the time (the ladder's heads read better dressed): the bots' looks, by seed. */
function mockLook(name: string): ItemLook {
  for (let i = 0; i < 12; i++) {
    const { look } = botLook(`${name}#${i}`);
    if (look.head || look.face) return look;
  }
  return botLook(name).look;
}

/**
 * The made-up page: an early season (Eric's playtest population would be small): the top three past the top tiers' floor
 * (Transcendent), then down through Radiant, Sublime and Illustrious, so every tier's emblem shows somewhere. `you`:
 * "off" (place 2,418, pinned below), "in" (place 7, in the list and pinned), "placement" (2 of 5 played), "guest".
 */
export function ladderMock(you: "off" | "in" | "placement" | "guest" = "off", myLook?: ItemLook, myName = "You"): LadderPage {
  const R = RANKED_1V1;
  const rows: LadderRow[] = [];
  let ladder = 2905;
  let place = 1;
  for (let i = 0; i < 100; i++) {
    // (Ties share a place: rows 14 and 15 sit on the same ladder.)
    if (i > 0) ladder -= i === 14 ? 0 : 6 + ((i * 37) % 23);
    if (i > 0 && rows[i - 1]!.rank.ladder !== ladder) place = i + 1;
    const games = 60 + ((i * 53) % 140);
    const wins = Math.round(games * (0.71 - i * 0.0016 - ((i * 13) % 7) * 0.004));
    const draws = (i * 7) % 5;
    const name = NAMES[i % NAMES.length]!;
    rows.push({
      uid: `mock-${i}`,
      name,
      look: mockLook(name),
      place,
      rank: rankView({ games, ladder, place }),
      wins,
      losses: games - wins - draws,
      draws,
      streak: i % 4 === 0 ? (i * 3) % 9 : 0,
    });
  }
  const page: LadderPage = { season: 1, total: 12408, rows, you: null };
  if (you === "in") {
    const r = rows[6]!;
    rows[6] = { ...r, name: myName, look: myLook, you: true, uid: "me" };
    page.you = rows[6];
  } else if (you === "off") {
    page.you = { uid: "me", name: myName, look: myLook, place: 2418, rank: rankView({ games: 46, ladder: 2 * 400 + 3 * 80 + 45 }), wins: 25, losses: 19, draws: 2, streak: 2, you: true };
  } else if (you === "placement") {
    page.you = { placement: { played: 2, of: R.placements.games } };
  }
  return page;
}

/** The test switch: `?ladder=mock` (you off the page), `mock-in`, `mock-placement`, `mock-guest`; null without it. */
export function ladderSwitch(search = typeof location === "undefined" ? "" : location.search): "off" | "in" | "placement" | "guest" | null {
  const v = new URLSearchParams(search).get("ladder");
  if (v === "mock") return "off";
  if (v === "mock-in") return "in";
  if (v === "mock-placement") return "placement";
  if (v === "mock-guest") return "guest";
  return null;
}

/**
 * The mockup's ways in on a phone (Eric, Nov 25: "on mobile not sure where the button belongs yet"), one at a time for the
 * stills: `?ladderin=a` "LADDER ›" at the end of home's RANKED label (the pick), `b` "Ladder" in your card's bottom-left
 * corner (the mirror of "View profile"), `c` "See ladder ›" on the profile's Ranked Standing card. None without it.
 */
export function ladderWayIn(search = typeof location === "undefined" ? "" : location.search): "a" | "b" | "c" | null {
  const v = new URLSearchParams(search).get("ladderin");
  return v === "a" || v === "b" || v === "c" ? v : null;
}
/** The mockup's way to the page: a plain load of /ladder, its test switches kept. */
export const goLadder = () => location.assign(`/ladder${location.search || "?ladder=mock"}`);

/** The ladder's trophy (the computer's side menu, the ways in). */
export const TROPHY_PATHS = ["M8 4h8v5a4 4 0 0 1-8 0z", "M8 6H5.5a2.5 2.5 0 0 0 2.6 3.4M16 6h2.5a2.5 2.5 0 0 1-2.6 3.4", "M12 13v3M8.5 20h7M9.5 20l.5-4h4l.5 4"];
