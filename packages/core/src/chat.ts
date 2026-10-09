import { QUICK_CHAT } from "./settings.ts";

/**
 * Quick chat: everything players can say to each other in a match. There is no typing anywhere: a message is the
 * id of a line from this list (a phrase or an emoji), so there's nothing to moderate. Shared by the app (the
 * buttons, the feed) and the server (which relays only known lines the sender owns, within the limits).
 *
 * Lines come in packs. The free packs everyone has; the others are sold in the shop (core/shop.ts lists them as
 * "chat" items). A new pack is a few lines here and a price in settings.ts (QUICK_CHAT.packPrices).
 *
 * Which of their lines a player sees in their games is their profile's picks (ChatPicks, below): up to
 * QUICK_CHAT.maxLines lines and maxEmoji emoji, the defaults until they choose. Bots use the whole list.
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
  /** Phrases only (emoji have no group, and can go to everyone). */
  group?: ChatGroup;
  /** Emoji only: what it's called (the profile's search, and screen readers). */
  name?: string;
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
      { id: "e-thumbs", text: "👍", name: "thumbs up" },
      { id: "e-clap", text: "👏", name: "clap" },
      { id: "e-laugh", text: "😂", name: "laugh" },
      { id: "e-wow", text: "😮", name: "wow" },
      { id: "e-grimace", text: "😬", name: "grimace" },
      { id: "e-fire", text: "🔥", name: "fire" },
      { id: "e-skull", text: "💀", name: "skull" },
      { id: "e-party", text: "🎉", name: "party" },
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
      { id: "e-pawn", text: "♟️", name: "pawn" },
      { id: "e-crown", text: "👑", name: "crown" },
      { id: "e-castle", text: "🏰", name: "castle" },
      { id: "e-horse", text: "🐴", name: "horse" },
      { id: "e-swords", text: "⚔️", name: "swords" },
      { id: "e-shield", text: "🛡️", name: "shield" },
    ],
  },
  {
    id: "emoji-winter",
    name: "Winter emoji",
    kind: "emoji",
    blurb: "Snow, trees and cookies.",
    lines: [
      { id: "e-snowflake", text: "❄️", name: "snowflake" },
      { id: "e-snowman", text: "⛄", name: "snowman" },
      { id: "e-tree", text: "🎄", name: "tree" },
      { id: "e-gift", text: "🎁", name: "gift" },
      { id: "e-deer", text: "🦌", name: "deer" },
      { id: "e-cookie", text: "🍪", name: "cookie" },
    ],
  },
  {
    id: "emoji-royal",
    name: "Royal emoji",
    kind: "emoji",
    blurb: "Fit for a court.",
    lines: [
      { id: "e-prince", text: "🤴", name: "prince" },
      { id: "e-princess", text: "👸", name: "princess" },
      { id: "e-gem", text: "💎", name: "gem" },
      { id: "e-trophy", text: "🏆", name: "trophy" },
      { id: "e-fleur", text: "⚜️", name: "fleur-de-lis" },
      { id: "e-dragon", text: "🐉", name: "dragon" },
    ],
  },
];

/** One line with its pack, as the app and server look it up. */
export interface ChatSay extends ChatLineDef {
  pack: string;
  kind: "phrase" | "emoji";
}

/**
 * The lobby pack: lines for the home page's global chat only (greetings, invites, how the last game went). Everyone
 * has it. It isn't one of CHAT_PACKS, so it never shows in a match, the shop or the profile's picks, and a match's
 * server refuses its lines (canSay only knows CHAT_PACKS).
 */
export const HOME_CHAT_PACK: ChatPack = {
  id: "lobby",
  name: "Lobby",
  kind: "phrases",
  free: true,
  blurb: "Lines for the home page's global chat.",
  lines: [
    { id: "l-hey", text: "Hey everyone!", group: "hello" },
    { id: "l-morning", text: "Morning all!", group: "hello" },
    { id: "l-evening", text: "Evening all!", group: "hello" },
    { id: "l-welcome", text: "Welcome!", group: "hello" },
    { id: "l-back", text: "Hello again!", group: "hello" },
    { id: "l-raid", text: "Anyone up for a raid?", group: "plans" },
    { id: "l-crowd", text: "Anyone for 50 v 50?", group: "plans" },
    { id: "l-queue", text: "Queueing now, join me!", group: "plans" },
    { id: "l-one-more", text: "One more game?", group: "plans" },
    { id: "l-won", text: "Just won one!", group: "reactions" },
    { id: "l-boss", text: "Beat the boss!", group: "reactions" },
    { id: "l-out", text: "Knocked out early…", group: "reactions" },
    { id: "l-close", text: "What a nail-biter!", group: "reactions" },
    { id: "l-wild", text: "The crowd was wild!", group: "reactions" },
    { id: "l-tough", text: "That boss is tough!", group: "reactions" },
    { id: "l-gg-all", text: "GG all!", group: "sporting" },
    { id: "l-thanks", text: "Thanks for the games!", group: "sporting" },
    { id: "l-brb", text: "BRB", group: "sporting" },
    { id: "l-bye", text: "Bye for now!", group: "sporting" },
    { id: "l-see-you", text: "See you on the board!", group: "sporting" },
  ],
};

const SAYS = new Map<string, ChatSay>(
  [...CHAT_PACKS, HOME_CHAT_PACK].flatMap((p) => p.lines.map((l) => [l.id, { ...l, pack: p.id, kind: p.kind === "emoji" ? "emoji" : "phrase" } as ChatSay] as const)),
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

/** Hello and Sporting phrases, and emoji, can go to everyone; reactions and plans stay inside your team. */
export function canSayToAll(id: unknown): boolean {
  const say = chatSay(id);
  if (say?.kind === "emoji") return true;
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

// ---------------- Picks ----------------

/**
 * The lines and emoji a player sees in their games, in their order, chosen in their profile ("Quick chat and
 * emoji"): at most QUICK_CHAT.maxLines lines and QUICK_CHAT.maxEmoji emoji. Bots keep the whole list.
 */
export interface ChatPicks {
  lines: string[];
  emoji: string[];
}

export type ChatPickKind = keyof ChatPicks;

/** What's stored for a player: each kind their own list, or null (never chosen: the defaults). */
export interface StoredChatPicks {
  lines?: readonly string[] | null;
  emoji?: readonly string[] | null;
}

export type ChatPickLimits = Pick<typeof QUICK_CHAT, "maxLines" | "maxEmoji" | "defaultLines" | "defaultEmoji">;

export const chatPickCap = (kind: ChatPickKind, q: ChatPickLimits = QUICK_CHAT) => (kind === "lines" ? q.maxLines : q.maxEmoji);

const kindOf = (kind: ChatPickKind): ChatSay["kind"] => (kind === "lines" ? "phrase" : "emoji");

/** A list of picks made clean: known lines of the right kind, from packs in `packIds`, no repeats, in order, capped. */
export function cleanChatPickList(raw: unknown, kind: ChatPickKind, packIds: readonly string[], q: ChatPickLimits = QUICK_CHAT): string[] {
  if (!Array.isArray(raw)) return [];
  const packs = new Set(packIds);
  const out: string[] = [];
  for (const id of raw) {
    const say = chatSay(id);
    if (!say || say.kind !== kindOf(kind) || !packs.has(say.pack) || out.includes(say.id)) continue;
    out.push(say.id);
    if (out.length >= chatPickCap(kind, q)) break;
  }
  return out;
}

/** Everyone's picks until they choose their own: QUICK_CHAT.defaultLines and defaultEmoji (free lines only). */
export const defaultChatPicks = (q: ChatPickLimits = QUICK_CHAT): ChatPicks => ({
  lines: cleanChatPickList(q.defaultLines, "lines", ownedChatPacks([]), q),
  emoji: cleanChatPickList(q.defaultEmoji, "emoji", ownedChatPacks([]), q),
});

/** A player's picks, from what's stored (a kind never chosen gets the defaults) and the packs they own. */
export function chatPicksOf(stored: StoredChatPicks | null | undefined, packIds: readonly string[], q: ChatPickLimits = QUICK_CHAT): ChatPicks {
  const def = defaultChatPicks(q);
  const one = (kind: ChatPickKind) => {
    const s = stored?.[kind];
    return Array.isArray(s) ? cleanChatPickList(s, kind, packIds, q) : def[kind];
  };
  return { lines: one("lines"), emoji: one("emoji") };
}

/** The same, from the shop items owned. */
export const chatPicks = (stored: StoredChatPicks | null | undefined, owned: readonly string[] | null | undefined, q: ChatPickLimits = QUICK_CHAT) =>
  chatPicksOf(stored, ownedChatPacks(owned), q);

export type ChatPickResult = { ok: true; picks: ChatPicks } | { ok: false; reason: "unknown" | "locked" | "full"; picks: ChatPicks };

/** Adds a line to the end of a player's picks, or takes it out if it's there (`on` forces one or the other). */
export function toggleChatPick(picks: ChatPicks, id: string, packIds: readonly string[], on?: boolean, q: ChatPickLimits = QUICK_CHAT): ChatPickResult {
  const say = chatSay(id);
  if (!say) return { ok: false, reason: "unknown", picks };
  const kind: ChatPickKind = say.kind === "emoji" ? "emoji" : "lines";
  const list = picks[kind];
  const has = list.includes(id);
  if (on ?? !has) {
    if (has) return { ok: true, picks };
    if (!packIds.includes(say.pack)) return { ok: false, reason: "locked", picks };
    if (list.length >= chatPickCap(kind, q)) return { ok: false, reason: "full", picks };
    return { ok: true, picks: { ...picks, [kind]: [...list, id] } };
  }
  return { ok: true, picks: { ...picks, [kind]: list.filter((x) => x !== id) } };
}

/**
 * A pack was just got: its lines go into any empty slots (in the pack's order, up to the cap). `added` are those
 * that went in; the rest the player can pick in their profile.
 */
export function chatPicksAfterGetting(picks: ChatPicks, packId: string, q: ChatPickLimits = QUICK_CHAT): { picks: ChatPicks; added: string[] } {
  const pack = chatPack(packId);
  if (!pack) return { picks, added: [] };
  const kind: ChatPickKind = pack.kind === "emoji" ? "emoji" : "lines";
  const room = chatPickCap(kind, q) - picks[kind].length;
  const added = pack.lines.map((l) => l.id).filter((id) => !picks[kind].includes(id)).slice(0, Math.max(0, room));
  return { picks: added.length ? { ...picks, [kind]: [...picks[kind], ...added] } : picks, added };
}

/** Lines by id, in the given order (unknown ids dropped): the buttons for a player's picks. */
export const chatSays = (ids: readonly string[]): ChatSay[] => ids.flatMap((id) => chatSay(id) ?? []);

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
  /** The queue's lobby, before the match: the bots have just taken their seats. */
  | { kind: "lobby" }
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
 * Bots chat a little, so a lobby with bots doesn't feel dead: "Hi all!" as they take their seats in the queue,
 * "Good luck!" as the match begins, "Nice move!" after a great crowd move (from a bot on the team that made it), "GG"
 * at the end. `recent` are the times of the lobby's bot lines so far (when each is said); across all bots there are
 * at most QUICK_CHAT.botMaxPerMinute a minute, the queue's hellos included.
 */
export function botChatLines(
  rng: () => number,
  moment: BotChatMoment,
  bots: readonly string[],
  recent: readonly number[],
  now: number,
  q: Pick<
    typeof QUICK_CHAT,
    | "botMaxPerMinute"
    | "botStartChance"
    | "botStartMax"
    | "botGreatMoveChance"
    | "botGreatMoveLoss"
    | "botEndChance"
    | "botEndMax"
    | "botDelayMs"
    | "botLobbyChance"
    | "botLobbyMax"
    | "botLobbyDelayMs"
    | "botLobbyGapMs"
  > = QUICK_CHAT,
): BotLine[] {
  if (!bots.length) return [];
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length) % xs.length]!;
  const range = moment.kind === "lobby" ? q.botLobbyDelayMs : q.botDelayMs;
  const delay = () => Math.round(range[0] + rng() * (range[1] - range[0]));
  // (The queue's last moment is short: its lines come closer together.)
  const gap = moment.kind === "lobby" ? q.botLobbyGapMs : 1200;
  let want: { say: readonly string[]; to: ChatTo; count: number };
  if (moment.kind === "lobby") {
    if (rng() >= q.botLobbyChance) return [];
    want = { say: ["hi-all", "hi-all", "have-fun", "lets-go"], to: "all", count: 1 + Math.floor(rng() * q.botLobbyMax) };
  } else if (moment.kind === "start") {
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
    const delayMs = delay() + i * gap;
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

// ---------------- The home page's global chat ----------------

/** Match lines that suit the home page's global chat: Hello, Reactions and Sporting. Plans are for a team in a match. */
export const HOME_GROUPS: readonly ChatGroup[] = ["hello", "reactions", "sporting"];

/**
 * The global chat's presets-only rule: a line from the list (never free text) that the sender owns and that suits the
 * home page: the lobby pack, Hello, Reactions and Sporting lines of the packs they own, and the emoji they own.
 */
export function canSayHome(id: unknown, owned: readonly string[] | null | undefined): boolean {
  const say = chatSay(id);
  if (!say) return false;
  if (say.pack === HOME_CHAT_PACK.id) return true;
  if (!ownedChatPacks(owned).includes(say.pack)) return false;
  return say.kind === "emoji" || (!!say.group && HOME_GROUPS.includes(say.group));
}

/**
 * The global chat's buttons: the lobby pack's lines, then the lines picked in your profile that suit the home page
 * (Hello, Reactions, Sporting), then your picked emoji. Owned packs reach it through the picks, as in matches.
 */
export function homeChatButtons(picks: ChatPicks): { lobby: ChatSay[]; lines: ChatSay[]; emoji: ChatSay[] } {
  return {
    lobby: chatSays(HOME_CHAT_PACK.lines.map((l) => l.id)),
    lines: chatSays(picks.lines).filter((s) => s.kind === "phrase" && !!s.group && HOME_GROUPS.includes(s.group)),
    emoji: chatSays(picks.emoji).filter((s) => s.kind === "emoji"),
  };
}

/** What bots say in the global chat (free lines only): hellos, invites, results, good sport, and a few emoji. */
export const HOME_BOT_LINES: readonly string[] = [
  "l-hey", "l-morning", "l-evening", "l-welcome", "l-back", "hi-all",
  "l-raid", "l-raid", "l-crowd", "l-crowd", "l-queue", "l-one-more",
  "l-won", "l-boss", "l-out", "l-close", "l-wild", "l-tough",
  "l-gg-all", "gg", "well-played", "l-thanks", "l-brb", "l-bye", "l-see-you", "good-luck",
  "e-thumbs", "e-laugh", "e-fire", "e-party",
];

/**
 * A bot's next line in the global chat: a bot that hasn't spoken in the last few lines, saying something not said in
 * the last few. `names` are the bots' names (the match bots' list); `recent` the chat's latest lines, oldest first.
 */
export function homeBotLine(rng: () => number, names: readonly string[], recent: readonly { name: string; say: string; bot?: boolean }[]): { name: string; say: string } {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length) % xs.length]!;
  const last = recent.slice(-6);
  const nameOptions = names.filter((n) => !last.some((l) => l.bot && l.name === n));
  const sayOptions = HOME_BOT_LINES.filter((s) => !last.some((l) => l.say === s));
  return { name: pick(nameOptions.length ? nameOptions : names), say: pick(sayOptions.length ? sayOptions : HOME_BOT_LINES) };
}
