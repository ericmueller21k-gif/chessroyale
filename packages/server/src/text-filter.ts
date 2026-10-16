/**
 * The server's filter for the free text players type that others see. Chat is preset lines only, so that's display
 * names: a profile's name, and the name a device sends when it joins a lobby or a Squads party. A name with a slur or
 * a hate term in it is refused (a profile) or replaced (a lobby seat). See docs/decisions/2026-10-16-chat-moderation.md.
 *
 * A small list of our own, slurs and hate terms only (not swearing), ROT13-encoded so the words don't turn up in
 * searches, diffs or screenshots of the code: `rot13("word")` gives a new entry. Matching folds what people use to get
 * past filters (case, accents, look-alike letters from other alphabets, invisible characters, digits and symbols for
 * letters), and reads the name word by word: symbols inside a word are dropped (letters dotted apart), a run of short
 * words (two letters or fewer each) is one word (letters spaced out, or spaced in pairs), and digits at a word's end
 * are read both as letters and as a number (a year, a "69"). Other words are never read as one
 * ("Jared Skinner" is two names, nothing else), except that the n-word's entries are also looked for across the whole
 * name. Three kinds:
 *   - ANYWHERE: long, unambiguous words, found inside any one word (letters may repeat, and q may stand for g). An entry
 *     with a space is a phrase, found as one word ("WhitePower") or as those words in a row ("white power");
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
 * letters or fewer each) as one word.
 */
function words(text: string, reading: (word: string) => string): string[] {
  const out: string[] = [];
  let short = false;
  for (const token of base(text).split(/\s+/)) {
    const w = letters(reading(token));
    if (!w) continue;
    if (w.length <= 2 && short) out[out.length - 1] += w;
    else out.push(w);
    short = w.length <= 2;
  }
  return out;
}

/** Each letter repeated once or more (a letter typed three times still matches; one letter too few doesn't). */
const repeats = (word: string) => [...word].map((c) => `${c}+`).join("");
/** As `repeats`, with q standing for g too (the long entries only: a short one, as "faq", is an ordinary word). */
const loose = (word: string) => [...word].map((c) => (c === "g" ? "[gq]+" : `${c}+`)).join("");
const entries = (list: string[]) => list.map((w) => rot13(w));

const ANYWHERE_RE = new RegExp(entries(ANYWHERE).map((w) => loose(w.replace(/ /g, ""))).join("|"));
const ACROSS_RE = new RegExp(entries(ACROSS).map(loose).join("|"));
const PHRASE_RE = new RegExp(` (?:${entries(ANYWHERE).filter((w) => w.includes(" ")).map((w) => w.split(" ").map(loose).join(" ")).join("|")})s* `);
const WORD_RE = new RegExp(`^(?:${entries(WORDS).join("|")})s?$`);
const ALLOW_RE = new RegExp(entries(ALLOW).map(repeats).join("|"), "g");

/** Whether these words (one reading of a name) hold a listed word. */
const listed = (ws: string[]) =>
  ws.some((w) => WORD_RE.test(w) || ANYWHERE_RE.test(w.replace(ALLOW_RE, ""))) || PHRASE_RE.test(` ${ws.join(" ")} `) || ACROSS_RE.test(ws.join("").replace(ALLOW_RE, ""));

/** Whether free text a player typed (a display name) holds a slur or a hate term. */
export function isBlockedText(text: string): boolean {
  if (typeof text !== "string" || !text) return false;
  const name = text.slice(0, MAX);
  if (READINGS.some((reading) => listed(words(name, reading)))) return true;
  const digits = name.normalize("NFKD").replace(/\D/g, "");
  return NUMBERS.some((n) => digits.includes(n));
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
