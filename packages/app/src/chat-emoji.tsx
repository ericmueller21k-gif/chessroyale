import type { ComponentChildren } from "preact";

/**
 * The chat's own emoji (Eric, Nov 7: "Twitch-style… a starter set of ~8 original pixel-art chess emoji"): each a 12 × 12 pixel
 * drawing of ours, typed as `:name:` (the picker from the field's emoji button puts the code in) and drawn wherever a chat line
 * shows. The server sees only the text; a code this app doesn't know shows as typed. docs/decisions/2026-11-07-typed-chat-column.md.
 */

/** The palette: one letter per color ("." is nothing). */
const INK: Record<string, string> = {
  k: "#23252b",
  w: "#f7f3ea",
  s: "#d9d2c3",
  g: "#f2b632",
  G: "#b7801a",
  r: "#d6453f",
  R: "#a3302c",
  t: "#1fa39a",
  T: "#137a73",
  b: "#8a5a2b",
  e: "#6d727c",
  p: "#f39cb3",
};

export interface ChatEmojiDef {
  /** Its code, without the colons. */
  name: string;
  /** What the picker says (and a screen reader). */
  label: string;
  /** 12 rows of 12. */
  rows: readonly string[];
}

export const CHAT_EMOJI: readonly ChatEmojiDef[] = [
  {
    name: "happypawn",
    label: "Happy pawn",
    rows: [
      "...kkkkkk...",
      "..kwwwwwwk..",
      ".kwwkwwkwwk.",
      ".kwwkwwkwwk.",
      ".kpwwwwwwpk.",
      "..kwkkkkwk..",
      "...kwwwwk...",
      "....kwsk....",
      "...kwwwsk...",
      "..kwwwwwsk..",
      ".kwwwwwwwsk.",
      ".kkkkkkkkkk.",
    ],
  },
  {
    name: "crown",
    label: "Crown",
    rows: [
      "............",
      ".k...kk...k.",
      "kgk.kggk.kgk",
      "kgkkkggkkkgk",
      "kggkggggkggk",
      "kggggggggggk",
      "kgrggttggrgk",
      "kggggggggggk",
      "kGGGGGGGGGGk",
      ".kkkkkkkkkk.",
      "............",
      "............",
    ],
  },
  {
    name: "knight",
    label: "Knight",
    rows: [
      "....kk.k....",
      "...kwwkwk...",
      "..kwwwwwwk..",
      ".kwwkwwwwsk.",
      "kwwwwwwwwsk.",
      "kwwwwwwwwsk.",
      ".kkkkwwwwsk.",
      "....kwwwsk..",
      "...kwwwwwsk.",
      "..kwwwwwwwsk",
      "..kkkkkkkkkk",
      "............",
    ],
  },
  {
    name: "rook",
    label: "Rook",
    rows: [
      ".kk.kkkk.kk.",
      ".kwkkwwkkwk.",
      ".kwwwwwwwsk.",
      ".kkkkkkkkkk.",
      "..kwwwwwsk..",
      "..kwwwwwsk..",
      "..kwwwwwsk..",
      "..kwwwwwsk..",
      ".kkkkkkkkkk.",
      "kwwwwwwwwssk",
      "kkkkkkkkkkkk",
      "............",
    ],
  },
  {
    name: "trophy",
    label: "Trophy",
    rows: [
      "..kkkkkkkk..",
      "kkkwgggGGkkk",
      "k.kwgggGGk.k",
      "kkkwgggGGkkk",
      "...kgggGk...",
      "....kGGk....",
      ".....kk.....",
      "....kggk....",
      "...kggggk...",
      "..kkkkkkkk..",
      "............",
      "............",
    ],
  },
  {
    name: "brilliant",
    label: "Brilliant move",
    rows: [
      ".tttttttttt.",
      "tttttttttttt",
      "tttwwtttwwtt",
      "tttwwtttwwtt",
      "tttwwtttwwtt",
      "tttwwtttwwtt",
      "tttwwtttwwtt",
      "tttttttttttt",
      "tttwwtttwwtt",
      "tttwwtttwwtt",
      "TTTTTTTTTTTT",
      ".TTTTTTTTTT.",
    ],
  },
  {
    name: "blunder",
    label: "Blunder",
    rows: [
      ".rrrrrrrrrr.",
      "rrwwwrrwwwrr",
      "rwrrrwwrrrwr",
      "rrrrrwrrrrwr",
      "rrrrwrrrrwrr",
      "rrrwrrrrwrrr",
      "rrrwrrrrwrrr",
      "rrrrrrrrrrrr",
      "rrrwrrrrwrrr",
      "rrrrrrrrrrrr",
      "RRRRRRRRRRRR",
      ".RRRRRRRRRR.",
    ],
  },
  {
    name: "clock",
    label: "Chess clock",
    rows: [
      "..kk....kk..",
      ".kkkkkkkkkk.",
      ".kwwwkkwwwk.",
      "kwwkwwkwkwwk",
      "kwwkwwkwkwwk",
      "kwwkkwkwwwwk",
      "kwwwwwkwwwwk",
      ".kwwwkkwwwk.",
      ".kbbbbbbbbk.",
      "kbbbbbbbbbbk",
      "kkkkkkkkkkkk",
      "............",
    ],
  },
];

const BY_NAME = new Map(CHAT_EMOJI.map((e) => [e.name, e]));
export const chatEmoji = (name: string): ChatEmojiDef | undefined => BY_NAME.get(name);

/** One path per color, each pixel a 1 × 1 square: made once per emoji. */
const paths = new Map<string, [string, string][]>();
function pathsOf(e: ChatEmojiDef): [string, string][] {
  let out = paths.get(e.name);
  if (!out) {
    const by = new Map<string, string>();
    e.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = row[x]!;
        if (c === "." || !INK[c]) continue;
        by.set(c, `${by.get(c) ?? ""}M${x} ${y}h1v1h-1z`);
      }
    });
    out = [...by].map(([c, d]) => [INK[c]!, d]);
    paths.set(e.name, out);
  }
  return out;
}

/** An emoji, drawn crisp at `size` px (the line's height by default). */
export function ChatEmoji({ e, size }: { e: ChatEmojiDef; size?: number }) {
  return (
    <svg class="chat-emo" viewBox="0 0 12 12" width={size} height={size} shape-rendering="crispEdges" role="img" aria-label={`:${e.name}:`} data-emoji={e.name}>
      <title>{e.label}</title>
      {pathsOf(e).map(([fill, d]) => (
        <path key={fill} fill={fill} d={d} />
      ))}
    </svg>
  );
}

/** The pieces of a message: plain text, and a known `:name:` code as its emoji. */
export function emojiParts(text: string): (string | ChatEmojiDef)[] {
  const out: (string | ChatEmojiDef)[] = [];
  let last = 0;
  for (const m of text.matchAll(/:([a-z]{2,16}):/g)) {
    const e = chatEmoji(m[1]!);
    if (!e) continue;
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(e);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** A message's text with its emoji drawn. */
export function ChatText({ text }: { text: string }): ComponentChildren {
  return emojiParts(text).map((p, i) => (typeof p === "string" ? p : <ChatEmoji key={i} e={p} />));
}

/** The picker (the field's emoji button): every emoji, a tap puts its code in. */
export function EmojiPicker({ onPick }: { onPick: (code: string) => void }) {
  return (
    <div class="chat-emo-picker" role="group" aria-label="Emoji">
      {CHAT_EMOJI.map((e) => (
        <button key={e.name} type="button" class="chat-emo-pick" title={`${e.label} :${e.name}:`} aria-label={`${e.label} :${e.name}:`} onClick={() => onPick(`:${e.name}:`)}>
          <ChatEmoji e={e} size={24} />
        </button>
      ))}
    </div>
  );
}
