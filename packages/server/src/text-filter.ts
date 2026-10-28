/**
 * The server's filter for the free text players type that others see: display names (a profile's name, and the name a
 * device sends when it joins a lobby or a Squads party) and, since Oct 28, the town square's typed chat (`chatRefusal`).
 * A name with a slur or a hate term in it is refused (a profile) or replaced (a lobby seat); a chat message with one, or
 * with a common swear word, or with a link or contact details, is refused. See docs/decisions/2026-10-16-chat-moderation.md
 * and docs/decisions/2026-10-28-town-chat-typing.md.
 *
 * A small list of our own, slurs and hate terms only (not swearing), ROT13-encoded so the words don't turn up in
 * searches, diffs or screenshots of the code: `rot13("word")` gives a new entry. Matching folds what people use to get
 * past filters (case, accents, look-alike letters from other alphabets, invisible characters, digits and symbols for
 * letters), and reads the name word by word: symbols inside a word are dropped (letters dotted apart), a run of short
 * words (two letters or fewer each) is one word (letters spaced out, or spaced in pairs), and digits at a word's end
 * are read both as letters and as a number (a year, a "69"). Other words are never read as one
 * ("Jared Skinner" is two names, nothing else), except that the n-word's entries are also looked for across the
 * words, starting where a word starts (so a surname ending in its first letters, before a given name, isn't read as
 * one: "König Gábor"). Three kinds:
 *   - ANYWHERE: long, unambiguous words, found inside any one word (letters may repeat, and q may stand for g). An entry
 *     with a space is a phrase, found as one word or as those words in a row (two words written as one, or apart);
 *   - WORDS: short ones that are parts of ordinary words, found only as a whole word, exactly (a plural "s" allowed);
 *   - NUMBERS: hate codes, found in the name's digits.
 * ALLOW lists the few ordinary words that contain an ANYWHERE entry. Words that are also common surnames are left out
 * on purpose (reports and a moderator's reset handle those): "qlxr" and "pbba", in ROT13.
 */

/** ROT13 (either case): turns a list entry into the word, and a word into an entry. */
export const rot13 = (s: string) =>
  s.replace(/[a-z]/gi, (c) => {
    const a = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - a + 13) % 26) + a);
  });

const ANYWHERE = [
  "avttre", "avttn", "avtyrg", "sntbg", "ergneq", "genaal", "genaavr", "furznyr", "jrgonpx", "ornare", "wvtnobb", "tbyyvjbt", "erqfxva", "uvgyre",
  "juvgr cbjre", "juvgr cevqr", "fvrt urvy", "xh xyhk", "cbepu zbaxrl", "whatyr ohaal", "fcrne puhpxre", "ent urnq", "gbjry urnq", "mvccre urnq",
];
/** The n-word's entries, also looked for across the whole name ("first half" + "second half" as two words). */
const ACROSS = ["avttre", "avttn"];
const WORDS = ["avt", "snt", "xvxr", "xlxr", "anmv", "puvax", "tbbx", "fcvp", "fcvpx", "cnxv", "jbt", "wnc", "qnexvr", "fdhnj", "xxx"];
const ALLOW = ["favttre", "ergneqnag"];
const NUMBERS = ["1488"];
/** Only this much of a name is read (a name is at most 16 characters; the rest is never shown, and costs time). */
const MAX = 64;

/** Digits and symbols used for letters. */
const LEET: Record<string, string> = { "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "€": "e", "4": "a", "@": "a", "5": "s", $: "s", "7": "t", "+": "t", "8": "b", "6": "g", "9": "g" };
/** Letters from other alphabets that look like Latin ones (Cyrillic, Greek). */
const LOOKALIKE: Record<string, string> = {
  а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x", і: "i", ј: "j", ѕ: "s", ԁ: "d", ӏ: "l", ɡ: "g",
  α: "a", β: "b", ε: "e", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x",
};

/** Lower case, no accents or invisible characters. */
const base = (text: string) => text.normalize("NFKD").replace(/[\p{M}\p{Cf}]/gu, "").toLowerCase();
/** Look-alikes and leetspeak as the letters they stand for; letters only. */
const letters = (word: string) => word.replace(/./gsu, (c) => LOOKALIKE[c] ?? LEET[c] ?? c).replace(/[^a-z]/g, "");

/**
 * The ways a word's last digits are read: as letters ("n4z1"), as a number left out ("Magnus2009" is "magnus", a
 * slur with "69" or "_69" after it is the slur), and as a letter and then a number (leetspeak, then "69").
 */
const READINGS = [(w: string) => w, (w: string) => w.replace(/[_.-]*\d+$/, ""), (w: string) => w.replace(/(?<=\d)\d+$/, "")];

/**
 * The name's words, one reading of its digits: letters only within each, and a run of two or more short words (two
 * letters or fewer each) as one word. For a chat message (`joined` given), a two-letter word that ends a sentence or a
 * clause ("go. ok") ends its run, and `joined` gets each word's index whose run has a two-letter word in it (ordinary
 * short words in a row, "is hi to", rather than letters spaced out, "f u n").
 */
function words(text: string, reading: (word: string) => string, joined?: Set<number>): string[] {
  const out: string[] = [];
  let short = false;
  for (const token of base(text).split(/\s+/)) {
    const w = letters(reading(token));
    if (!w) continue;
    if (w.length <= 2 && short) {
      out[out.length - 1] += w;
      if (w.length === 2 || out[out.length - 1]!.length - w.length === 2) joined?.add(out.length - 1);
    } else out.push(w);
    short = w.length <= 2 && !(joined && w.length === 2 && /[.,!?;:]$/.test(token));
  }
  return out;
}

/** Each letter repeated once or more (a letter typed three times still matches; one letter too few doesn't). */
const repeats = (word: string) => [...word].map((c) => `${c}+`).join("");
/** As `repeats`, with q standing for g too (the long entries only: a short one, as "faq", is an ordinary word). */
const loose = (word: string) => [...word].map((c) => (c === "g" ? "[gq]+" : `${c}+`)).join("");
const entries = (list: string[]) => list.map((w) => rot13(w));

const ANYWHERE_RE = new RegExp(entries(ANYWHERE).map((w) => loose(w.replace(/ /g, ""))).join("|"));
const ACROSS_RE = new RegExp(`^(?:${entries(ACROSS).map(loose).join("|")})`);
const PHRASE_RE = new RegExp(` (?:${entries(ANYWHERE).filter((w) => w.includes(" ")).map((w) => w.split(" ").map(loose).join(" ")).join("|")})s* `);
const WORD_RE = new RegExp(`^(?:${entries(WORDS).join("|")})s?$`);
const ALLOW_RE = new RegExp(entries(ALLOW).map(repeats).join("|"), "g");

/** Whether these words (one reading of a name) hold a listed word. */
const listed = (ws: string[]) =>
  ws.some((w) => WORD_RE.test(w) || ANYWHERE_RE.test(w.replace(ALLOW_RE, ""))) || PHRASE_RE.test(` ${ws.join(" ")} `) || ws.some((_, i) => ACROSS_RE.test(ws.slice(i).join("").replace(ALLOW_RE, "")));

/** Whether free text a player typed (a display name) holds a slur or a hate term. */
export function isBlockedText(text: string): boolean {
  if (typeof text !== "string" || !text) return false;
  const name = text.slice(0, MAX);
  if (READINGS.some((reading) => listed(words(name, reading)))) return true;
  const digits = name.normalize("NFKD").replace(/\D/g, "");
  return NUMBERS.some((n) => digits.includes(n));
}

// ---- Chat: the town square's typed messages (Eric, Oct 28). The names' list, plus common swear words, refused alike
// (Eric: "it's family-friendly chat", so a word that isn't allowed just isn't allowed); links and contact details refused
// with a reason of their own. Read the same way as a name (case, accents, look-alikes, leetspeak, spacing folded).

/** Swear words found inside any one word (letters may repeat), as ANYWHERE above but without q for g. */
const SWEARS_ANYWHERE = [
  "shpx", "cuhpx", "sphx", "fuvg", "ovgpu", "ovngpu", "phag", "nffubyr", "nefrubyr", "onfgneq", "fyhg", "juber", "jnaxre", "obyybpxf", "qvpxurnq", "wnpxnff",
  "qhzonff", "cvff", "cbea",
];
/** Swear words found only as a whole word, exactly (or plural): short ones inside ordinary words, and the masked spellings. */
const SWEARS_WORDS = ["nff", "nefr", "qvpx", "pbpx", "chffl", "gjng", "jnax", "cevpx", "gvgf", "shx", "shd", "spx", "sx", "fug", "ogpu", "pag", "qpx", "jgs", "fgsh", "tgsb"];
/** Ordinary words with a swear word inside. */
const SWEARS_ALLOW = ["fphagubecr", "fuvvgnxr", "fuvgnxr", "fuvgn", "cvffneeb", "cbbea"];
/** How much of a chat message is read (a message is at most TOWN_CHAT.maxChars; this bounds the work for any caller). */
const CHAT_READ = 256;

const SWEAR_ANY_RE = new RegExp(entries(SWEARS_ANYWHERE).map(repeats).join("|"));
const SWEAR_START_RE = new RegExp(`^(?:${SWEAR_ANY_RE.source})`);
const SWEAR_WORD_RE = new RegExp(`^(?:${entries(SWEARS_WORDS).join("|")})s?$`);
const SWEAR_ALLOW_RE = new RegExp(entries(SWEARS_ALLOW).map(repeats).join("|"), "g");
/**
 * Whether these words (one reading of a message) hold a swear word. In a run of ordinary short words read as one
 * (`joined`: "up or no", "is hi to") only from the run's start, so a sentence's little words don't spell one by chance;
 * a word split into pieces ("sh it", "f u c k") still starts its run.
 */
const swears = (ws: string[], joined: Set<number>) =>
  ws.some((w, i) => SWEAR_WORD_RE.test(w) || (joined.has(i) ? SWEAR_START_RE : SWEAR_ANY_RE).test(w.replace(SWEAR_ALLOW_RE, "")));

/**
 * Runs of digits with only spaces and phone-number marks between them ("555 123-4567", "+1 (555) 123 4567", "14 88"):
 * a letter or other punctuation ends a run, so "1800 vs 2000" or "12:30" are separate numbers.
 */
const digitRuns = (text: string) => (text.normalize("NFKC").match(/(?:\d[\s.\-_()+/]*)+/g) ?? []).map((r) => r.replace(/\D/g, ""));
/** A phone number: seven digits or more in one run. */
const PHONE_DIGITS = 7;
/** The endings of web addresses people paste (not short ones that start sentences when someone skips a space: "me", "to"). */
const TLDS = "com|net|org|io|co|ly|tv|app|xyz|info|biz|uk|ru|de|fr|ca|au|link|site|online|club|shop|live|top|dev|cc|ws|tk|gl|page|store|chat";
const LINK_RE = new RegExp(
  [
    "https?\\b", // http, https, http://
    "www\\s*[.。｡]",
    "://",
    `\\b[a-z0-9-]+[.。｡](?:${TLDS})\\b`, // example.com, bit.ly
    "\\b[a-z0-9-]+\\s*[([{]?\\s*(?:[.。｡]|dot)\\s*[)\\]}]?\\s*(?:com|net|org)\\b", // example . com, example (dot) com
  ].join("|"),
);
/** An email address, or a mail service's name ("at gmail"). */
const EMAIL_RE = /[\w.+-]+\s*@\s*[\w-]+[.。｡][a-z]{2,}|\b(?:gmail|hotmail|icloud|protonmail|ymail)\b/;
/** Messaging apps, where "add me on …" moves a conversation off the game. */
const APPS_RE = /\b(?:discord|snapchat|snap\s+chat|instagram|whatsapp|telegram|tiktok|facebook|skype|wechat)\b/;

/** What a refused chat message hears: a slur, a hate term or a swear word… */
export const CHAT_NOT_ALLOWED = "That message isn't allowed.";
/** …and a link, an email address or a phone number. */
export const CHAT_NO_CONTACT = "No links or contact details in chat.";

/** Why a chat message (the town square's) is refused, or null when it may go. */
export function chatRefusal(text: string): string | null {
  if (typeof text !== "string" || !text) return null;
  const said = text.slice(0, CHAT_READ);
  const runs = digitRuns(said);
  const refused = (reading: (word: string) => string) => {
    const joined = new Set<number>();
    const ws = words(said, reading, joined);
    return listed(ws) || swears(ws, joined);
  };
  if (READINGS.some(refused) || runs.some((d) => NUMBERS.some((n) => d.includes(n)))) return CHAT_NOT_ALLOWED;
  // (Look-alike letters read as Latin ones, so a Cyrillic "о" can't hide a ".com"; digits and symbols stay as typed.)
  const plain = base(said).replace(/./gsu, (c) => LOOKALIKE[c] ?? c);
  if (LINK_RE.test(plain) || EMAIL_RE.test(plain) || APPS_RE.test(plain) || runs.some((d) => d.length >= PHONE_DIGITS)) return CHAT_NO_CONTACT;
  return null;
}

/**
 * The name a device asks to sit under in a lobby or a Squads party: spaces tidied, at most 16 characters, else
 * `fallback` ("Player N") when it's empty or the filter refuses it.
 */
export function seatName(name: unknown, fallback: string): string {
  const typed = (typeof name === "string" ? name : "").replace(/\s+/g, " ").trim().slice(0, 16);
  return typed && !isBlockedText(typed) ? typed : fallback;
}

/** What a profile hears when the name it asked for is refused. */
export const NAME_NOT_ALLOWED = "That name isn't allowed. Pick another one.";
