/**
 * The town square's chat log (Eric, Oct 28: "a little timestamp of the message, the person's name, the message, and then they
 * kind of fade… and when somebody says something again, it appears again… on mobile show at most 4 to 5 messages; on desktop
 * closer to a dozen"). The lines, the numbers and the log's rules, with no DOM and no drawing: `TownChat.tsx` shows it and
 * `town-chat.css` styles it. docs/areas/town-square.md, "The chat log".
 *
 * v2 (Eric, Oct 28, docs/decisions/2026-10-28-town-chat-v2.md): one see-through box that holds every line of the last minute and
 * scrolls; three modes from a header icon (`ChatMode`: always on, new messages only, off), remembered on this device.
 *
 * One way in: `say(name, text, kind, who)`. The bosses and their kids say a line now and then (`CHATTER`, placeholders);
 * players' messages come from the server (chat-net.ts: signed-in players only), each with who said it and its number in the
 * server's room (`who`), so a tap on it can open Profile / Mute / Report, and `unsay` can take it out again (a moderator's
 * Remove, a player you mute). The numbers a player sees (80 characters, one message every 15 s, a line's minute) are the
 * server's, TOWN_CHAT. docs/decisions/2026-10-28-town-chat-typing.md.
 */
import { TOWN_CHAT } from "@chessroyale/core";
import { HOMES, type HomeId } from "./world.ts";

/** Every number of the chat, in one place (the CSS reads none of them: the component hands it the fade times). */
export const CHAT = {
  /** Nothing new this long: the lines fade out. */
  fadeAfterMs: 8000,
  /** ... over this long; they fade back in over `fadeInMs` when something is said. */
  fadeMs: 1000,
  fadeInMs: 200,
  /** A line is gone for good this long after it was said (Eric: it keeps the DOM small); it also goes when pushed past the cap. */
  lifeMs: TOWN_CHAT.lineMs,
  /** A boss or a kid speaks every this many ms, at random between the two. */
  everyMs: [20_000, 45_000] as readonly [number, number],
  /** The computer's frame (styles.css' "computer"); anything else is a phone. (The box's size is in town-chat.css: about 5 lines on a phone, 12 on a computer.) */
  computerQuery: "(min-width: 900px) and (min-height: 600px)",
  /** Scrolled this near the foot (px) still counts as at the foot: new lines keep it there. */
  pinSlopPx: 4,
  /** What you may type, and the wait between two of your messages (the server's numbers: it enforces them). */
  maxChars: TOWN_CHAT.maxChars,
  sendEveryMs: TOWN_CHAT.gapMs,
  /** A refusal's reason shows over the field this long. */
  noteMs: 4000,
  /** The "N left" count shows from this many characters left. */
  nearEnd: 10,
  /** Press and hold this long on the box (without moving more than `holdSlopPx`) to pick it up. */
  holdMs: 400,
  holdSlopPx: 8,
  /** The box's gap from the map's edges, and from the buttons. */
  margin: 8,
  /** Where the box's place, and its mode, are remembered on this device. */
  storageKey: "brc.townChat",
  modeKey: "brc.townChatMode",
} as const;

/**
 * The chat's three modes, in the order the header icon's tap goes through them (Eric, Oct 28). "always": the box and its field
 * always show. "new": the lines show when a message comes and fade after `fadeAfterMs`, the field with them; a tap on a line
 * brings back every line of the last minute. "off": no box, no field (the lines still arrive, so turning it on shows the last
 * minute).
 */
export type ChatMode = "always" | "new" | "off";
export const CHAT_MODES: readonly ChatMode[] = ["always", "new", "off"];
/** What the header icon is called, by mode (its accessible name). */
export const CHAT_MODE_LABEL: Readonly<Record<ChatMode, string>> = { always: "Chat: always on", new: "Chat: new messages only", off: "Chat: off" };
/** What each choice is called in the town's settings sheet. */
export const CHAT_MODE_CHOICE: Readonly<Record<ChatMode, string>> = { always: "Always on", new: "New messages", off: "Off" };
/** The mode a tap on the icon goes to: always on, new messages, off, and round again. */
export const nextChatMode = (m: ChatMode): ChatMode => CHAT_MODES[(CHAT_MODES.indexOf(m) + 1) % CHAT_MODES.length]!;

export type ChatKind = "boss" | "kid" | "player" | "system";

/** Who said a player's line, from the server: their account id and the line's number in its room. */
export interface ChatWho {
  uid: string;
  n: number;
}

export interface ChatLine extends Partial<ChatWho> {
  id: number;
  /** When it was said (ms since 1970, this device's clock). */
  at: number;
  /** "9:41": the hour and minute this device saw it, 12-hour, no am/pm. */
  time: string;
  name: string;
  text: string;
  kind: ChatKind;
}

/** The time of day as the log shows it: hours and minutes, 12-hour, no am/pm ("9:41", "12:05"). */
export function clockText(d: Date): string {
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---- The log: the lines kept, whether they show, and when they fade and go.

let current: ChatLog | null = null;

/**
 * The one way in for a message (a boss's, a kid's, a player's, the town's own): dropped when no town is open. `who`: a
 * player's line from the server (their account and the line's number). `at`: when it was said (the test hook says a line was said a
 * while ago, to scroll back to).
 */
export function say(name: string, text: string, kind: ChatKind, who?: ChatWho, at = Date.now()): void {
  current?.say(name, text, kind, at, who);
}

/** Takes the lines `test` picks out of the open log (a moderator's Remove, a player you mute, a name reset). */
export function unsay(test: (l: ChatLine) => boolean): void {
  current?.drop(test);
}

/** The mode now: the one remembered on this device (the first time it's asked), else always on. */
let mode: ChatMode | null = null;
const modeSeen = new Set<() => void>();
export function chatMode(): ChatMode {
  return (mode ??= loadChatMode());
}
/** Sets the mode, remembers it on this device, and tells everyone showing it (the header icon, the settings sheet, the box). */
export function setChatMode(m: ChatMode): void {
  if (m === mode) return;
  mode = m;
  saveChatMode(m);
  for (const f of modeSeen) f();
}
export function onChatMode(fn: () => void): () => void {
  modeSeen.add(fn);
  return () => void modeSeen.delete(fn);
}

/** The mode remembered on this device, or "always" (nothing stored, something else stored, or a storage that won't answer). */
export function loadChatMode(): ChatMode {
  try {
    const v = localStorage.getItem(CHAT.modeKey);
    return CHAT_MODES.find((m) => m === v) ?? "always";
  } catch {
    return "always";
  }
}

export function saveChatMode(m: ChatMode): void {
  try {
    localStorage.setItem(CHAT.modeKey, m);
  } catch {
    // (private mode, storage full: it lasts until a reload)
  }
}

/**
 * Whether a scrolling box keeps up with its newest line (Eric, Oct 28: "new lines keep it pinned to the bottom unless you've
 * scrolled up; then it stays where you are until you scroll back down"). Pinned until the box is scrolled up from its foot;
 * while it isn't, the lines that come are counted (the "↓ new" marker) and the box stays put.
 */
export class Stick {
  pinned = true;
  /** Lines that came while the box was scrolled up and not yet seen. */
  unseen = 0;

  /** The box was scrolled (a finger, the wheel, a jump): pinned again once it's back at its foot. */
  scrolled(box: { scrollTop: number; scrollHeight: number; clientHeight: number }): void {
    this.pinned = box.scrollHeight - box.scrollTop - box.clientHeight <= CHAT.pinSlopPx;
    if (this.pinned) this.unseen = 0;
  }

  /** `n` lines came: true if the box should go to its foot (it's pinned); false if it stays where it is (they're counted). */
  added(n: number): boolean {
    if (this.pinned) return true;
    this.unseen += n;
    return false;
  }

  /** The box was put back at its foot (the marker's tap, or it came back on screen). */
  toFoot(): void {
    this.pinned = true;
    this.unseen = 0;
  }
}

export class ChatLog {
  /** Every line of the last `lifeMs`, oldest first (each is removed for good at its minute). */
  lines: ChatLine[] = [];
  /** True from a message until `fadeAfterMs` after it (and while the box is held, typed in, or being read). */
  shown = false;
  /** "New messages": a tap brought back every line, not just the ones said since the box last came back; until it fades. */
  expanded = false;
  /** The first line of the burst on show: "new messages" shows these (and, once a tap has `expanded` it, all of them). */
  private freshFrom = 0;
  private nextId = 1;
  private holds = 0;
  private fadeTimer: ReturnType<typeof setTimeout> | undefined;
  private lifeTimer: ReturnType<typeof setTimeout> | undefined;

  /** `changed` runs when the lines or `shown` change (a few times a minute: the component draws then). */
  constructor(private readonly changed: () => void) {}

  /** Makes this the log `say` reaches. Returns the close: it stops this log's timers and `say` goes nowhere. */
  open(): () => void {
    current = this;
    return () => {
      clearTimeout(this.fadeTimer);
      clearTimeout(this.lifeTimer);
      if (current === this) current = null;
    };
  }

  /** The lines the box shows in `m`: all of them always on, the burst on show (all of them once a tap `expanded` it) in new messages, none off. */
  visible(m: ChatMode): readonly ChatLine[] {
    if (m === "off") return [];
    if (m === "always" || this.expanded) return this.lines;
    return this.lines.filter((l) => l.id >= this.freshFrom);
  }

  say(name: string, text: string, kind: ChatKind, at = Date.now(), who?: ChatWho): void {
    const id = this.nextId++;
    this.lines.push({ id, at, time: clockText(new Date(at)), name, text, kind, ...(who ? { uid: who.uid, n: who.n } : {}) });
    // A message after the box had faded starts a new burst: only the new lines show in "new messages", until a tap brings back the rest.
    if (!this.shown) {
      this.freshFrom = id;
      this.expanded = false;
    }
    this.shown = true;
    this.arm();
    this.watch();
    this.changed();
  }

  /** Takes out the lines `test` picks (nothing changes, and nothing is drawn, when it picks none). */
  drop(test: (l: ChatLine) => boolean): void {
    const keep = this.lines.filter((l) => !test(l));
    if (keep.length === this.lines.length) return;
    this.lines = keep;
    this.watch();
    this.changed();
  }

  /** A tap on a line in "new messages": every line of the last minute comes back, the faded ones too, and the wait starts over. */
  expand(): void {
    this.expanded = true;
    this.shown = true;
    this.arm();
    this.changed();
  }

  /** Someone is reading (scrolling): the wait before the fade starts over. */
  poke(): void {
    if (this.shown) this.arm();
  }

  /** Keeps the lines showing while something holds the box (it's picked up, typed in, or its menu is open). */
  hold(on: boolean): void {
    this.holds = Math.max(0, this.holds + (on ? 1 : -1));
    if (on) {
      clearTimeout(this.fadeTimer);
      if (!this.shown) {
        this.shown = true;
        this.freshFrom = this.nextId; // (no message: nothing new to show, only what a tap brings back)
        this.expanded = false;
        this.changed();
      }
    } else this.arm();
  }

  /** (Re)starts the wait before the fade. */
  private arm(): void {
    clearTimeout(this.fadeTimer);
    if (this.holds > 0) return;
    this.fadeTimer = setTimeout(() => {
      this.shown = false;
      this.changed();
    }, CHAT.fadeAfterMs);
  }

  /** One timer, for the oldest line: it goes `lifeMs` after it was said (the next one's timer starts then). */
  private watch(): void {
    clearTimeout(this.lifeTimer);
    const first = this.lines[0];
    if (!first) return;
    this.lifeTimer = setTimeout(() => {
      const now = Date.now();
      const keep = this.lines.findIndex((l) => now - l.at < CHAT.lifeMs);
      this.lines.splice(0, keep < 0 ? this.lines.length : keep);
      this.watch();
      this.changed();
    }, Math.max(0, first.at + CHAT.lifeMs - Date.now()));
  }
}

// ---- The chatter: who talks for now. PLACEHOLDERS until real players chat (Eric, Oct 28: "the animals and the bosses can put
// messages in here, like once in a while, just so we can see").

/** What one home's boss says (two lines), and what its kid says (one or two). */
interface Voices {
  /** The kid's name (the sidekick brief's; read from `BOTS` instead once the sidekicks are in the town). */
  kid: string;
  boss: readonly [string, string];
  kidSays: readonly string[];
}

/**
 * Short (under 60 characters), friendly, in their voices, about chess or the town. Not the Hidden Boss; nothing about the
 * bronze statue. Hollow's kid is only ever eerie, as Hollow says of it. Keyed by home, so every boss with a home has one.
 */
export const CHATTER: Readonly<Record<HomeId, Voices>> = {
  grex: { kid: "Sparky", boss: ["Fireworks by my place at dusk. Come watch!", "Tall tip: see the whole board, not one square."], kidSays: ["Ooh, sparkly! Is it fireworks time yet?", "Sparky's sparkler is lit. Stand back!"] },
  clown: { kid: "Squirt", boss: ["Honk honk! Who wants a game at the park?", "Knights hop like clowns. I taught them."], kidSays: ["Psst! Smell my flower. Go on, closer!", "Oops! My flower squirted again. Sorry!"] },
  gingerbread: { kid: "Crumb", boss: ["Come by the igloo. It's nice and cool.", "Careful with the pawns. Some of us crumble."], kidSays: ["Crumb here! Careful, I'm still warm."] },
  hollow: { kid: "Glim", boss: ["The park gets quiet after dark. I like it.", "Every board has a corner the light forgets."], kidSays: ["The dark taught me a good opening.", "Shh. The dark is thinking."] },
  bigboy: { kid: "Blocky", boss: ["Big boy found the chess tables! Yay!", "Wanna play? Big boy shares. Sometimes."], kidSays: ["Blocky has a block. A big block!", "Blocky stacks it up. Then, crash!"] },
  sawyer: { kid: "Chip", boss: ["Measure twice, then move once.", "The park's tables are built to last."], kidSays: ["Chip helps! Chip carries the little planks.", "Chip made a pawn. It's a little crooked."] },
  pig: { kid: "Tex", boss: ["Howdy, folks! Pull up a stool at the park.", "Slow and steady wins the rodeo. Chess too."], kidSays: ["Yee-haw! Tex is ready for a game!"] },
  alfil: { kid: "Woolly", boss: ["Bishops used to be elephants. Ask me how.", "The Pyramid is open. Mind the dust."], kidSays: ["Woolly is big! Well, getting there."] },
  smudgy: { kid: "Dabble", boss: ["New painting up at the Gallery. Come look!", "A chessboard is a painting in two colors."], kidSays: ["Dabble blended in. Can you find me?", "Dabble painted a tiny pawn. Want to see?"] },
  moo: { kid: "Twinkle", boss: ["Moo says hi to everyone! (Moo!)", "Best friends make the best moves!"], kidSays: ["Twinkle! Twinkle! Look, a star!", "Moo-ve over! Twinkle wants a turn."] },
  gardener: { kid: "Drizzle", boss: ["Mind the flower beds on your way past.", "Good soil today. Good day for a game."], kidSays: ["Drizzle waters the flowers. Splish splash!"] },
  hopper: { kid: "Bun & Bug", boss: ["Chirp found a carrot by the fountain!", "Hop to it! The tables are filling up."], kidSays: ["Bun and Bug found a carrot. Hop hop!", "Bug rides on Bun. Hop hop, chirp chirp!"] },
  tiger: { kid: "Stripes", boss: ["No roaring today. Balloons and chess only.", "Don't rush the artist. Or the endgame."], kidSays: ["Stripes has a purple balloon. Don't pop it!", "Stripes tried a roar. It came out squeaky."] },
  folio: { kid: "Pleat", boss: ["I folded a new crane. Come see it.", "A good move has no wasted folds."], kidSays: ["Pleat folds a little pawn. Fold, fold!"] },
};

export interface Chatter {
  name: string;
  kind: "boss" | "kid";
  text: string;
}

/** Everyone who talks: each home's boss, then its kid. */
const SPEAKERS: readonly { name: string; kind: "boss" | "kid"; lines: readonly string[] }[] = HOMES.flatMap((h) => [
  { name: h.boss, kind: "boss" as const, lines: CHATTER[h.id].boss },
  { name: CHATTER[h.id].kid, kind: "kid" as const, lines: CHATTER[h.id].kidSays },
]);

/** The next speaker and line: anyone but the one who spoke last (`last`), one of their lines at random. `rand` in [0, 1). */
export function pickChatter(rand: () => number, last: string | null = null): Chatter {
  let i = Math.min(SPEAKERS.length - 1, Math.floor(rand() * SPEAKERS.length));
  if (SPEAKERS[i]!.name === last) i = (i + 1) % SPEAKERS.length;
  const s = SPEAKERS[i]!;
  return { name: s.name, kind: s.kind, text: s.lines[Math.min(s.lines.length - 1, Math.floor(rand() * s.lines.length))]! };
}

/** How long until the next one speaks: `everyMs`, at random. */
export const chatterDelay = (rand: () => number): number => CHAT.everyMs[0] + rand() * (CHAT.everyMs[1] - CHAT.everyMs[0]);

/**
 * Starts the bosses' and kids' chatter: one of them says a line every `chatterDelay`. `now()` makes one speak at once (the
 * test hook) and starts the wait over; `stop()` ends it.
 */
export function startChatter(rand: () => number = Math.random): { now: () => void; stop: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last: string | null = null;
  const speak = () => {
    const c = pickChatter(rand, last);
    last = c.name;
    say(c.name, c.text, c.kind);
    wait();
  };
  const wait = () => {
    clearTimeout(timer);
    timer = setTimeout(speak, chatterDelay(rand));
  };
  wait();
  return { now: speak, stop: () => clearTimeout(timer) };
}

// ---- Your own line goes to the server (chat-net.ts: `sendTownChat`), and comes back into the log like everyone's.

/**
 * A tap on a player's line, name or text (the only lines that take taps; the bosses' and kids' pass them to the map).
 * `anchor` is the line's box in the page's pixels, for the menu to open beside: Profile / Mute / Report, and Remove for a
 * moderator (TownChat.tsx's menu, set with `setTownChatLineTap`; Eric, Oct 28: players report a message by tapping it).
 */
export function onTownChatLineTap(line: ChatLine, anchor: Rect): void {
  tapped?.(line, anchor);
}

let tapped: ((line: ChatLine, anchor: Rect) => void) | null = null;
/** What a tap on a player's line does (the menu); returns the release. */
export function setTownChatLineTap(fn: (line: ChatLine, anchor: Rect) => void): () => void {
  tapped = fn;
  return () => {
    if (tapped === fn) tapped = null;
  };
}

// ---- Where the box is: the map's pixels. The edge chips keep off it (render.ts), shown or not.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The box now, in the map's pixels (w = 0: not laid out yet). `TownChat` writes it; the renderer's chips read it. */
export const CHAT_BOX: Rect = { x: 0, y: 0, w: 0, h: 0 };

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Where a `w` × `h` box wanted at (x, y) ends up on a `map`: inside it (`pad` from the edges) and clear of the buttons
 * (`avoid`, `pad` round them): if it would cover them, the nearest place beside or above or below them that fits.
 */
export function clampBox(x: number, y: number, size: { w: number; h: number }, map: { w: number; h: number }, avoid: Rect | null, pad: number = CHAT.margin): { x: number; y: number } {
  const fit = (v: number, room: number) => Math.max(pad, Math.min(room - pad, v));
  const at = { x: fit(x, map.w - size.w), y: fit(y, map.h - size.h) };
  if (!avoid || !overlaps({ ...at, ...size }, { x: avoid.x - pad, y: avoid.y - pad, w: avoid.w + 2 * pad, h: avoid.h + 2 * pad })) return at;
  const inside = (p: { x: number; y: number }) => p.x >= pad && p.y >= pad && p.x + size.w <= map.w - pad && p.y + size.h <= map.h - pad;
  const beside = [
    { x: avoid.x - pad - size.w, y: at.y },
    { x: avoid.x + avoid.w + pad, y: at.y },
    { x: at.x, y: avoid.y - pad - size.h },
    { x: at.x, y: avoid.y + avoid.h + pad },
  ]
    .filter(inside)
    .sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y));
  return beside[0] ?? { x: at.x, y: Math.max(pad, avoid.y - pad - size.h) };
}

/** The place remembered on this device, or null (nothing stored, or a storage that won't answer). */
export function loadChatPos(): { x: number; y: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAT.storageKey) ?? "null") as { x?: unknown; y?: unknown } | null;
    return v && typeof v.x === "number" && typeof v.y === "number" && Number.isFinite(v.x) && Number.isFinite(v.y) ? { x: v.x, y: v.y } : null;
  } catch {
    return null;
  }
}

export function saveChatPos(p: { x: number; y: number }): void {
  try {
    localStorage.setItem(CHAT.storageKey, JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y) }));
  } catch {
    // (private mode, storage full: the box just forgets next time)
  }
}
