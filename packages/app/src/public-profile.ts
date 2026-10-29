import { CROWD_SETTINGS, DEFAULT_SETTINGS, SLOT_NAMES, bossDef, bossInfo, itemColor, itemDef, secondColor, tierInfo, type ItemLook, type ItemSlot, type RankedRecentGame, type RankView } from "@chessroyale/core";
import type { PublicProfile } from "./account.ts";

/**
 * The public profile's words and numbers (docs/decisions/2026-10-28-public-profile.md), pure so a test can read each one:
 * the "Online now · Joined Oct 2026" line, the level, the Ranked Standing card's tier, RP, peak and stats, the Recent
 * Matches rows (the ranked 1 v 1 games and the profile's other games, merged by time), and the Equipped Cosmetics tiles.
 * Nothing here draws; screens/PublicProfile.tsx does.
 */

// ---------------- Who they are ----------------

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 86_400_000;
/** The local calendar day of a time (the profile's "yesterday" is the viewer's). */
const dayOf = (t: number) => Math.floor((t - new Date(t).getTimezoneOffset() * MIN) / DAY);
const shortDate = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** "Oct 2026". */
export const joinedText = (joinedAt: number) => new Date(joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });

/**
 * How long ago: "just now", "5m ago", "2h ago" (inside a day), then "Yesterday", then the date ("Oct 25"). The same words
 * in the Recent Matches rows ("Ranked · 2h ago") and in "Last seen 2h ago".
 */
export function ago(at: number, now: number): string {
  const elapsed = now - at;
  if (elapsed < DAY) {
    if (elapsed < MIN) return "just now";
    return elapsed < HOUR ? `${Math.floor(elapsed / MIN)}m ago` : `${Math.floor(elapsed / HOUR)}h ago`;
  }
  return dayOf(now) - dayOf(at) === 1 ? "Yesterday" : shortDate(at);
}

/** The line under the name: a green dot and "Online now · Joined Oct 2026", "Last seen 2h ago · Joined Oct 2026", or just "Joined Oct 2026" for one who hides when they're online. */
export function seenLine(p: Pick<PublicProfile, "online" | "hidden" | "lastSeen" | "joinedAt">, now: number): { dot: boolean; text: string } {
  const joined = `Joined ${joinedText(p.joinedAt)}`;
  if (p.hidden) return { dot: false, text: joined };
  if (p.online) return { dot: true, text: `Online now · ${joined}` };
  if (!p.lastSeen) return { dot: false, text: `Offline · ${joined}` };
  const when = ago(p.lastSeen, now);
  // ("Last seen yesterday", but "Last seen Oct 25": only the word is lowered.)
  return { dot: false, text: `Last seen ${when === "Yesterday" ? "yesterday" : when} · ${joined}` };
}

/**
 * The level line: "Level 38" only where the test switches count (an admin; the real levels aren't built yet, so `level` is
 * FrontDoor's TEST_LEVEL placeholder), else empty. The line keeps its height either way.
 */
export const levelLine = (allowed: boolean, level: number): string => (allowed ? `Level ${level}` : "");

/** An icon of their own (a drawing, or an older account's emoji), as opposed to the default pawn: it goes behind their pawn; the default gets the theme's light yellow. */
export const hasOwnIcon = (icon: string | undefined): icon is string => !!icon && icon !== "♟";

// ---------------- Ranked Standing ----------------

/** What the card's menu offers, in its order: 1 v 1 first (the default). 50 v 50 and Squads have no ranks of their own yet. */
export const RANKED_MODES = [
  { id: "1v1", label: "1v1" },
  { id: "50v50", label: `${(CROWD_SETTINGS.lobbySize ?? DEFAULT_SETTINGS.lobbySize) / 2} v ${(CROWD_SETTINGS.lobbySize ?? DEFAULT_SETTINGS.lobbySize) / 2}` },
  { id: "squads", label: "Squads" },
] as const;
export type RankedModeId = (typeof RANKED_MODES)[number]["id"];

/** The tier as the card names it: "Gold 3", "Pearlescent" (no division up there), "Placement 2/5". */
export function tierTitle(rank: RankView): string {
  if (rank.placement) return `Placement ${rank.placement.played}/${rank.placement.of}`;
  return rank.division === null ? rank.tier : `${rank.tier} ${rank.division}`;
}

/** A worn item's tile's share of the row: the mockup's tiles are 115 : 110 : 121 across, not equal, the longer color line with more room ("Weapon · Cobalt & Sage" fits whole). */
export const tileWeight = (line: string): number => line.length + 110;

/** "Peak rank: Gold 3", or "Peak rank: —" when there's none yet (a player who hasn't finished their placements). */
export const peakLine = (peak: RankView | null | undefined): string => `Peak rank: ${peak && !peak.placement ? tierTitle(peak) : "—"}`;

/** Wins over games, whole percent ("58%"); "—" before a first game. */
export const winRate = (wins: number, games: number): string => (games > 0 ? `${Math.round((100 * wins) / games)}%` : "—");

/** "34 – 25". */
export const recordText = (wins: number, losses: number): string => `${wins} – ${losses}`;

/** The win streak: wins in a row now (0: their last game wasn't a win). */
export const streakText = (streak: number): string => String(streak);

/**
 * Which of the card's states their 1 v 1 is in: banned (nothing but that), never played, still in placements, or ranked. From
 * their rank alone: a record with no games is "Placement 0/5", so an admin's `?rank=` shown in its place (your own page)
 * reads as ranked.
 */
export type RankedState = "banned" | "unranked" | "placement" | "ranked";
export function rankedState(rank: RankView | null | undefined, banned: boolean): RankedState {
  if (banned) return "banned";
  if (!rank || (rank.placement && rank.placement.played === 0)) return "unranked";
  return rank.placement ? "placement" : "ranked";
}

// ---------------- Recent Matches ----------------

export type PillTone = "win" | "loss" | "draw" | "place";
export type RpTone = "gain" | "loss" | "none";

export interface RecentRow {
  key: string;
  at: number;
  /** What's drawn in the circle: their dressed pawn (a 1 v 1's opponent), the boss's face, or a small mode icon. */
  face: { kind: "pawn"; look?: ItemLook } | { kind: "boss"; id: string | null; name: string; icon: string } | { kind: "mode"; mode: "crowd" | "squads" | "classic" };
  pill: { text: string; tone: PillTone };
  title: string;
  /** "Ranked · 2h ago", "Casual · Oct 25". */
  sub: string;
  rp: { text: string; tone: RpTone };
}

/** "1st", "2nd", "3rd", "11th". */
export function nth(n: number): string {
  const v = n % 100;
  return `${n}${["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th"}`;
}

/** "+18", "−14" (a real minus sign, as the design has it), "0", and "—" where it's not known or doesn't apply. */
export function rpChange(rp: number | null | undefined): { text: string; tone: RpTone } {
  if (typeof rp !== "number" || !Number.isFinite(rp)) return { text: "—", tone: "none" };
  if (rp > 0) return { text: `+${rp}`, tone: "gain" };
  if (rp < 0) return { text: `−${-rp}`, tone: "loss" };
  return { text: "0", tone: "none" };
}

const RESULT_PILL: Record<RankedRecentGame["result"], { text: string; tone: PillTone }> = {
  win: { text: "WIN", tone: "win" },
  loss: { text: "LOSS", tone: "loss" },
  draw: { text: "DRAW", tone: "draw" },
};

/**
 * One of the profile's other games (crowd, a raid, Squads, Classic) as a row. "Ranked" when it counted toward their rating (the
 * game's own flag: online, enough real players; the director's review, Oct 29: a 50 v 50 that moved your rating isn't casual),
 * else "Casual". Only a ranked 1 v 1 has RP.
 */
function resultRow(r: PublicProfile["recent"][number], i: number, now: number): RecentRow {
  const sub = `${r.ranked === true ? "Ranked" : "Casual"} · ${ago(r.playedAt, now)}`;
  const base = { key: `r${r.playedAt}-${i}`, at: r.playedAt, sub, rp: rpChange(null) };
  if (r.mode === "boss") {
    const def = bossDef(r.bossId);
    const known = !!(r.bossId || r.bossElo);
    const info = known ? bossInfo(r.bossElo ?? 0, r.bossId) : null;
    // (Beaten: the boss fell. Anything else, including a result nobody recorded, is a loss.)
    return {
      ...base,
      face: { kind: "boss", id: def?.id ?? null, name: info?.name ?? "Boss", icon: info?.icon ?? "👑" },
      pill: r.won === true ? RESULT_PILL.win : RESULT_PILL.loss,
      title: info ? `vs. ${info.name}` : "Boss raid",
    };
  }
  if (r.mode === "crowd") {
    // (A match with no team recorded: older ones, "everyone moves": the winner took 1st.)
    const won = r.won ?? r.placement === 1;
    return { ...base, face: { kind: "mode", mode: "crowd" }, pill: won ? RESULT_PILL.win : RESULT_PILL.loss, title: CROWD_TITLE };
  }
  const squads = r.mode === "squads";
  return {
    ...base,
    face: { kind: "mode", mode: squads ? "squads" : "classic" },
    pill: { text: nth(r.placement), tone: r.placement === 1 ? "win" : "place" },
    title: squads ? "Squads" : "Classic",
  };
}

const CROWD_TITLE = RANKED_MODES[1].label;

/** A ranked 1 v 1 game as a row. */
function duelRow(g: RankedRecentGame, i: number, now: number): RecentRow {
  return {
    key: `d${g.at}-${i}`,
    at: g.at,
    // (An account since deleted has no look: the default pawn.)
    face: { kind: "pawn", look: g.opponent.look ?? undefined },
    pill: RESULT_PILL[g.result],
    title: `vs. ${g.opponent.name || "Player"}`,
    sub: `Ranked · ${ago(g.at, now)}`,
    // (Points: null in placements, for a game fair play held, and for games from before Oct 28, 2026: "—".)
    rp: rpChange(g.points),
  };
}

/** How many games the card lists. */
export const RECENT_SHOWN = 5;

/**
 * The card's rows: the last `RECENT_SHOWN` games in any mode, newest first. The ranked 1 v 1 games (`RankedSummary.recent`, the
 * last five) and the profile's `recent` (crowd, raids, Squads, Classic) merged by time; a tie keeps the 1 v 1 game first.
 */
export function recentRows(ranked: RankedRecentGame[], recent: PublicProfile["recent"], now: number, limit = RECENT_SHOWN): RecentRow[] {
  return [...ranked.map((g, i) => duelRow(g, i, now)), ...recent.map((r, i) => resultRow(r, i, now))].sort((a, b) => b.at - a.at).slice(0, limit);
}

// ---------------- Equipped Cosmetics ----------------

/** The order worn items are listed in (FrontDoor's WORN_ORDER: this file stays free of components). */
const WORN: readonly ItemSlot[] = ["skin", "head", "face", "weapon"];

export interface WornTile {
  slot: ItemSlot;
  def: string;
  /** The item as it looks on them (colors, blotches), for ItemArt. */
  finish: NonNullable<ItemLook[ItemSlot]>;
  name: string;
  /** "Skin · Opal & Opal", "Head · Opal": the slot, then the color's name (a second color too, if the item has one). */
  line: string;
  /** The rarity pill, colored as the shop colors it. */
  tier: { name: string; color: string };
}

export function wornTiles(look: ItemLook): WornTile[] {
  return WORN.flatMap((slot) => {
    const it = look[slot];
    const d = it && itemDef(it.def);
    if (!it || !d) return [];
    const first = itemColor(it.color).name;
    const second = secondColor(it);
    const t = tierInfo(d.tier);
    return [{ slot, def: it.def, finish: it, name: d.name, line: `${SLOT_NAMES[slot]} · ${second ? `${first} & ${itemColor(second).name}` : first}`, tier: { name: t.name, color: t.color } }];
  });
}
