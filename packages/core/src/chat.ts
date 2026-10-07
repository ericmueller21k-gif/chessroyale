import { QUICK_CHAT } from "./settings.ts";

/**
 * Quick chat: everything players can say to each other in a match. There is no typing anywhere: a message is the
 * id of a line from this list (a phrase or an emoji), so there's nothing to moderate. Shared by the app (the
 * buttons, the feed) and the server (which relays only known lines the sender owns, within the limits).
 *
 * Lines come in packs. The free packs everyone has; the others are sold in the shop (core/shop.ts lists them as
 * "chat" items). A new pack is a few lines here and a price in settings.ts (QUICK_CHAT.packPrices).
 */

/** The four groups the phrases come in. Pack phrases join one of them, so the panel keeps the same four rows. */
export type ChatGroup = "hello" | "reactions" | "plans" | "sporting";

export interface ChatGroupDef {
  id: ChatGroup;
  name: string;
  /** Can go to everyone (the Team / All switch); the rest stay inside your team, so plans stay secret. */
  all: boolean;
}

export const CHAT_GROUPS: readonly ChatGroupDef[] = [
  { id: "hello", name: "Hello", all: true },
  { id: "reactions", name: "Reactions", all: false },
  { id: "plans", name: "Plans", all: false },
  { id: "sporting", name: "Sporting", all: true },
];

export interface ChatLineDef {
  /** What goes over the wire. Never reuse an id for a different line. */
  id: string;
  text: string;
  /** Phrases only (emoji have no group: they're team reactions). */
  group?: ChatGroup;
}

export interface ChatPack {
  id: string;
  name: string;
  kind: "phrases" | "emoji";
  /** Everyone has it. */
  free?: boolean;
  /** For the shop card. */
  blurb: string;
  lines: readonly ChatLineDef[];
}

export const CHAT_PACKS: readonly ChatPack[] = [
  {
    id: "basics",
    name: "Quick chat",
    kind: "phrases",
    free: true,
    blurb: "Sixteen lines to say hello, react, make plans with your team and be a good sport.",
    lines: [
      { id: "good-luck", text: "Good luck!", group: "hello" },
      { id: "have-fun", text: "Have fun!", group: "hello" },
      { id: "hi-all", text: "Hi all!", group: "hello" },
      { id: "lets-go", text: "Let's go!", group: "hello" },
      { id: "nice-move", text: "Nice move!", group: "reactions" },
      { id: "wow", text: "Wow!", group: "reactions" },
      { id: "oops", text: "Oops…", group: "reactions" },
      { id: "so-close", text: "So close!", group: "reactions" },
      { id: "trust-crowd", text: "Trust the crowd", group: "plans" },
      { id: "defend-king", text: "Defend the king!", group: "plans" },
      { id: "push-pawns", text: "Push the pawns!", group: "plans" },
      { id: "go-mate", text: "Go for mate!", group: "plans" },
      { id: "gg", text: "GG", group: "sporting" },
      { id: "well-played", text: "Well played", group: "sporting" },
      { id: "thanks", text: "Thanks!", group: "sporting" },
      { id: "rematch", text: "Rematch?", group: "sporting" },
    ],
  },
  {
    id: "emoji-basics",
    name: "Basics",
    kind: "emoji",
    free: true,
    blurb: "Eight quick reactions.",
    lines: [
      { id: "e-thumbs", text: "👍" },
      { id: "e-clap", text: "👏" },
      { id: "e-laugh", text: "😂" },
      { id: "e-wow", text: "😮" },
      { id: "e-grimace", text: "😬" },
      { id: "e-fire", text: "🔥" },
      { id: "e-skull", text: "💀" },
      { id: "e-party", text: "🎉" },
    ],
  },
  {
    id: "godking",
    name: "God King pack",
    kind: "phrases",
    blurb: "Speak like the crowd's champion.",
    lines: [
      { id: "gk-crown", text: "For the crown!", group: "hello" },
      { id: "gk-stand", text: "Not while I stand!", group: "reactions" },
      { id: "gk-call", text: "Call the King!", group: "plans" },
      { id: "gk-long-live", text: "Long live the King!", group: "sporting" },
    ],
  },
  {
    id: "winter",
    name: "Winter pack",
    kind: "phrases",
    blurb: "Seasonal cheer for cold games.",
    lines: [
      { id: "w-hohoho", text: "Ho ho ho!", group: "hello" },
      { id: "w-snow-way", text: "Snow way!", group: "reactions" },
      { id: "w-icy", text: "Ice cold.", group: "reactions" },
      { id: "w-holidays", text: "Happy holidays!", group: "sporting" },
    ],
  },
  {
    id: "spicy",
    name: "Spicy pack",
    kind: "phrases",
    blurb: "For the bold and the brave.",
    lines: [
      { id: "s-calculated", text: "Calculated.", group: "reactions" },
      { id: "s-sacrifice", text: "Was that a sacrifice?", group: "reactions" },
      { id: "s-spicy", text: "Spicy!", group: "reactions" },
      { id: "s-all-in", text: "All in!", group: "plans" },
    ],
  },
  {
    id: "emoji-chess",
    name: "Chess emoji",
    kind: "emoji",
    blurb: "The pieces themselves.",
    lines: [
      { id: "e-pawn", text: "♟️" },
      { id: "e-crown", text: "👑" },
      { id: "e-castle", text: "🏰" },
      { id: "e-horse", text: "🐴" },
      { id: "e-swords", text: "⚔️" },
      { id: "e-shield", text: "🛡️" },
    ],
  },
  {
    id: "emoji-winter",
    name: "Winter emoji",
    kind: "emoji",
    blurb: "Snow, trees and cookies.",
    lines: [
      { id: "e-snowflake", text: "❄️" },
      { id: "e-snowman", text: "⛄" },
      { id: "e-tree", text: "🎄" },
      { id: "e-gift", text: "🎁" },
      { id: "e-deer", text: "🦌" },
      { id: "e-cookie", text: "🍪" },
    ],
  },
  {
    id: "emoji-royal",
    name: "Royal emoji",
    kind: "emoji",
    blurb: "Fit for a court.",
    lines: [
      { id: "e-prince", text: "🤴" },
      { id: "e-princess", text: "👸" },
      { id: "e-gem", text: "💎" },
      { id: "e-trophy", text: "🏆" },
      { id: "e-fleur", text: "⚜️" },
      { id: "e-dragon", text: "🐉" },
    ],
  },
];

/** One line with its pack, as the app and server look it up. */
export interface ChatSay extends ChatLineDef {
  pack: string;
  kind: "phrase" | "emoji";
}

const SAYS = new Map<string, ChatSay>(
  CHAT_PACKS.flatMap((p) => p.lines.map((l) => [l.id, { ...l, pack: p.id, kind: p.kind === "emoji" ? "emoji" : "phrase" } as ChatSay] as const)),
);

/** A line by its id (undefined for anything not on the list: the server drops it). */
export const chatSay = (id: unknown): ChatSay | undefined => (typeof id === "string" ? SAYS.get(id) : undefined);

export const chatPack = (id: string): ChatPack | undefined => CHAT_PACKS.find((p) => p.id === id);

/** A pack's shop item id ("chat-godking"); everything you own in the shop is a list of these and other items. */
export const chatPackItem = (packId: string) => `chat-${packId}`;

/** The packs someone can use: the free ones, and those whose shop item they own. */
export function ownedChatPacks(owned: readonly string[] | null | undefined): string[] {
  const have = new Set(owned ?? []);
  return CHAT_PACKS.filter((p) => p.free || have.has(chatPackItem(p.id))).map((p) => p.id);
}

/** Whoever owns `owned` (shop item ids) may send this line. */
export function canSay(id: unknown, owned: readonly string[] | null | undefined): boolean {
  const say = chatSay(id);
  if (!say) return false;
  return ownedChatPacks(owned).includes(say.pack);
}

export type ChatTo = "team" | "all";

/** Hello and Sporting phrases can go to everyone; reactions, plans and emoji stay inside your team. */
export function canSayToAll(id: unknown): boolean {
  const say = chatSay(id);
  return !!say?.group && !!CHAT_GROUPS.find((g) => g.id === say.group)?.all;
}

/** The lines you can use (owning these shop items), by kind and group, in list order (the buttons). */
export function chatButtons(owned: readonly string[] | null | undefined): { groups: { group: ChatGroupDef; lines: ChatSay[] }[]; emoji: ChatSay[] } {
  return chatButtonsOf(ownedChatPacks(owned));
}

/** The lines in these packs, by kind and group, in list order. */
export function chatButtonsOf(packIds: readonly string[]): { groups: { group: ChatGroupDef; lines: ChatSay[] }[]; emoji: ChatSay[] } {
  const packs = new Set(packIds);
  const mine = [...SAYS.values()].filter((s) => packs.has(s.pack));
  return {
    groups: CHAT_GROUPS.map((group) => ({ group, lines: mine.filter((s) => s.kind === "phrase" && s.group === group.id) })),
    emoji: mine.filter((s) => s.kind === "emoji"),
  };
}

// ---------------- Limits ----------------

/** What one player has sent lately: the times, and their last line. */
export interface ChatSent {
  times: number[];
  last: { say: string; at: number } | null;
}

export const noChatSent = (): ChatSent => ({ times: [], last: null });

export type ChatLimit = "gap" | "burst" | "repeat";

export type ChatLimits = Pick<typeof QUICK_CHAT, "minGapMs" | "burstMax" | "burstWindowMs" | "repeatMs">;

/** When this player may send anything again (now or later), from the gap and the burst limits. */
export function chatReadyAt(sent: ChatSent, limits: ChatLimits = QUICK_CHAT): number {
  const recent = sent.times;
  const lastAt = recent.length ? recent[recent.length - 1]! : -Infinity;
  let at = lastAt + limits.minGapMs;
  // At the burst limit: the oldest message in the window has to fall out of it first.
  if (recent.length >= limits.burstMax) at = Math.max(at, recent[recent.length - limits.burstMax]! + limits.burstWindowMs);
  return at;
}

/** Whether a line may go now; if not, which limit stops it and when it could go. */
export function chatCheck(sent: ChatSent, say: string, now: number, limits: ChatLimits = QUICK_CHAT): { ok: true } | { ok: false; limit: ChatLimit; retryAt: number } {
  const ready = chatReadyAt(sent, limits);
  if (now < ready) {
    const recent = sent.times.filter((t) => t > now - limits.burstWindowMs);
    return { ok: false, limit: recent.length >= limits.burstMax ? "burst" : "gap", retryAt: ready };
  }
  if (sent.last && sent.last.say === say && now < sent.last.at + limits.repeatMs) return { ok: false, limit: "repeat", retryAt: sent.last.at + limits.repeatMs };
  return { ok: true };
}

/** After a line went: its time joins the recent ones (only those still inside the burst window are kept). */
export function chatSent(sent: ChatSent, say: string, now: number, limits: ChatLimits = QUICK_CHAT): ChatSent {
  return { times: [...sent.times.filter((t) => t > now - limits.burstWindowMs), now], last: { say, at: now } };
}

// ---------------- Bots ----------------

export type BotChatMoment =
  /** The match begins. */
  | { kind: "start" }
  /** A crowd move just played lost at most QUICK_CHAT.botGreatMoveLoss points; `bots` are the team that picked it. */
  | { kind: "greatMove"; loss: number }
  /** The match is over. */
  | { kind: "end" };

export interface BotLine {
  from: string;
  say: string;
  to: ChatTo;
  /** How long after the moment it's said. */
  delayMs: number;
}

/**
 * Bots chat a little, so a lobby with bots doesn't feel dead: "Good luck!" as the match begins, "Nice move!" after a
 * great crowd move (from a bot on the team that made it), "GG" at the end. `recent` are the times of the lobby's
 * bot lines so far (when each is said); across all bots there are at most QUICK_CHAT.botMaxPerMinute a minute.
 */
export function botChatLines(
  rng: () => number,
  moment: BotChatMoment,
  bots: readonly string[],
  recent: readonly number[],
  now: number,
  q: Pick<
    typeof QUICK_CHAT,
    "botMaxPerMinute" | "botStartChance" | "botStartMax" | "botGreatMoveChance" | "botGreatMoveLoss" | "botEndChance" | "botEndMax" | "botDelayMs"
  > = QUICK_CHAT,
): BotLine[] {
  if (!bots.length) return [];
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length) % xs.length]!;
  const delay = () => Math.round(q.botDelayMs[0] + rng() * (q.botDelayMs[1] - q.botDelayMs[0]));
  let want: { say: readonly string[]; to: ChatTo; count: number };
  if (moment.kind === "start") {
    if (rng() >= q.botStartChance) return [];
    want = { say: ["good-luck", "have-fun", "hi-all", "good-luck"], to: "all", count: 1 + Math.floor(rng() * q.botStartMax) };
  } else if (moment.kind === "greatMove") {
    if (moment.loss > q.botGreatMoveLoss || rng() >= q.botGreatMoveChance) return [];
    want = { say: ["nice-move", "nice-move", "wow"], to: "team", count: 1 };
  } else {
    if (rng() >= q.botEndChance) return [];
    want = { say: ["gg", "gg", "well-played"], to: "all", count: 1 + Math.floor(rng() * q.botEndMax) };
  }
  const out: BotLine[] = [];
  const times = [...recent];
  const used = new Set<string>();
  for (let i = 0; i < want.count; i++) {
    const delayMs = delay() + i * 1200;
    const at = now + delayMs;
    // At most a few lines a minute across all bots (counting the lines already planned).
    if (times.filter((t) => t > at - 60_000 && t <= at + 60_000).length >= q.botMaxPerMinute) break;
    const from = pick(bots.filter((b) => !used.has(b)).length ? bots.filter((b) => !used.has(b)) : bots);
    used.add(from);
    // Two bots in a row don't say exactly the same thing.
    const options = want.say.filter((s) => s !== out[out.length - 1]?.say);
    out.push({ from, say: pick(options.length ? options : want.say), to: want.to, delayMs });
    times.push(at);
  }
  return out;
}
