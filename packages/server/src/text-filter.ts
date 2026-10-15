/**
 * The server's filter for the free text players type that others see. Chat is preset lines only, so that's display
 * names: a profile's name, and the name a device sends when it joins a lobby or a Squads party. A name with a slur or
 * a hate term in it is refused (a profile) or replaced (a lobby seat). See DECISIONS.md, "Chat moderation for launch".
 *
 * A small list of our own, slurs and hate terms only (not swearing), ROT13-encoded so the words don't turn up in
 * searches, diffs or screenshots of the code: `rot13("word")` gives a new entry. Matching folds what people use to
 * get past filters: case, accents, look-alike letters from other alphabets, zero-width characters, digits and symbols
 * for letters (n1gg3r), letters repeated or spaced out. Two kinds of entry:
 *   - ANYWHERE: long, unambiguous words, found anywhere in the name with every space and symbol removed;
 *   - WORDS: short ones that are parts of ordinary words, found only as a whole word (a plural "s" allowed).
 * ALLOW lists the few ordinary words that contain an ANYWHERE entry.
 */

/** ROT13: turns a list entry into the word, and a word into an entry. */
export const rot13 = (s: string) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));

const ANYWHERE = [
  "avttre", "avttn", "avtyrg", "sntbg", "ergneq", "genaal", "genaavr", "furznyr", "jrgonpx", "ornare", "wvtnobb", "cbepuzbaxrl",
  "whatyrohaal", "mvccreurnq", "enturnq", "gbjryurnq", "tbyyvjbt", "fcrnepuhpxre", "erqfxva", "uvgyre", "fvrturvy", "juvgrcbjre",
  "juvgrcevqr", "xhxyhk",
];
const WORDS = ["avt", "snt", "qlxr", "xvxr", "xlxr", "puvax", "tbbx", "fcvp", "fcvpx", "pbba", "cnxv", "jbt", "wnc", "qnexvr", "fdhnj", "anmv", "xxx"];
const ALLOW = ["favttre", "ergneqnag"];
/** Hate codes made of digits, found in the name's digits. */
const NUMBERS = ["1488"];

/** Digits and symbols used for letters (q for g as in "niqqa"). */
const LEET: Record<string, string> = { "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "€": "e", "4": "a", "@": "a", "5": "s", $: "s", "7": "t", "+": "t", "8": "b", "6": "g", "9": "g", q: "g" };
/** Letters from other alphabets that look like Latin ones (Cyrillic, Greek). */
const LOOKALIKE: Record<string, string> = {
  а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x", і: "i", ј: "j", ѕ: "s", ԁ: "d", ӏ: "l", ɡ: "g",
  α: "a", β: "b", ε: "e", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x",
};

/** Lower case, no accents or invisible characters, look-alikes and leetspeak as the letters they stand for. */
const fold = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\p{M}\p{Cf}]/gu, "")
    .toLowerCase()
    .replace(/./gsu, (c) => LOOKALIKE[c] ?? LEET[c] ?? c);
const squash = (text: string) => fold(text).replace(/[^a-z]/g, "");
/** Each letter of a word, repeated once or more (so "niiigger" is caught, and "niger" isn't "nigger"). */
const pattern = (word: string) => [...squash(word)].map((c) => `${c}+`).join("");

const ANYWHERE_RE = new RegExp(ANYWHERE.map((w) => pattern(rot13(w))).join("|"));
const WORD_RE = new RegExp(`^(?:${WORDS.map((w) => pattern(rot13(w))).join("|")})s*$`);
const ALLOW_RE = new RegExp(ALLOW.map((w) => pattern(rot13(w))).join("|"), "g");

/** Whether free text a player typed (a display name) holds a slur or a hate term. */
export function isBlockedText(text: string): boolean {
  if (typeof text !== "string" || !text) return false;
  if (ANYWHERE_RE.test(squash(text).replace(ALLOW_RE, ""))) return true;
  if (fold(text).split(/[^a-z]+/).some((w) => w && WORD_RE.test(w))) return true;
  const digits = text.normalize("NFKD").replace(/\D/g, "");
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
