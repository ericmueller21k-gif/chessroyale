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
/**
 * Letters that look like Latin ones, by the Latin letter they pass for (lower case, as `base` leaves them): Cyrillic,
 * Greek, Armenian, Coptic, Latin's own small capitals and variants (dotless ı, ɡ, ʀ…), from Unicode's confusables for
 * single Latin letters. Accented letters need none: `base` takes the accents off.
 */
const LIKE: Record<string, string> = {
  a: "аαɑᴀ⍺ɐ",
  b: "вьбʙƅɓβᖯ",
  c: "сϲᴄҫςƈꮯ",
  d: "ԁժᴅɗđðдδ",
  e: "еєэɛᴇҽɘεǝə",
  f: "ꜰƒғϝ",
  g: "ɡɢցǥɠԍ",
  h: "нһʜհħɦђћ",
  i: "іιıɪɩ¡ꭵꙇ",
  j: "јʝϳ",
  k: "кκᴋҝқƙⱪ",
  l: "ӏʟłɫɭǀ",
  m: "мᴍɱ",
  n: "ոռпиɴηπƞŋɲɳ",
  o: "оοσᴏօøɵѳⲟθɔ",
  p: "рρᴘⲣ",
  q: "ԛɋ",
  r: "гяʀɾɼɽꭇᴦ",
  s: "ѕꜱʂ",
  t: "тτᴛŧƭʈ",
  u: "υᴜսμʋц",
  v: "νᴠѵ",
  w: "ԝᴡωшѡɯ",
  x: "хχҳ",
  y: "уʏγүɣ",
  z: "ᴢʐƶȥ",
};
const LOOKALIKE: Record<string, string> = {
  ...Object.fromEntries(Object.entries(LIKE).flatMap(([latin, like]) => [...like].map((c) => [c, latin]))),
  // (Letters that stand for two.)
  ß: "ss", æ: "ae", œ: "oe", þ: "th",
};

/** Fillers that show as nothing (Hangul fillers, the blank braille cell): taken out like invisible characters. */
export const FILLERS = /[\u115F\u1160\u3164\uFFA0\u2800]/gu;
/** Lower case, no accents, invisible characters or fillers. */
const base = (text: string) => text.normalize("NFKD").replace(/[\p{M}\p{Cf}]/gu, "").replace(FILLERS, "").toLowerCase();
/** Look-alikes and leetspeak as the letters they stand for; letters only. */
const letters = (word: string) => word.replace(/./gsu, (c) => LOOKALIKE[c] ?? LEET[c] ?? c).replace(/[^a-z]/g, "");

/**
 * The ways a word's last digits are read: as letters ("n4z1"), as a number left out ("Magnus2009" is "magnus", a
 * slur with "69" or "_69" after it is the slur), and as a letter and then a number (leetspeak, then "69").
 */
const READINGS = [(w: string) => w, (w: string) => w.replace(/[_.-]*\d+$/, ""), (w: string) => w.replace(/(?<=\d)\d+$/, "")];

/** For a chat message, how each word was made: where each typed piece starts in it, and whether a piece had two letters. */
interface Pieces {
  starts: number[];
  pair: boolean;
}

/**
 * The name's words, one reading of its digits: letters only within each, and a run of two or more short words (two
 * letters or fewer each) as one word. For a chat message (`pieces` given), a two-letter word that ends a sentence or a
 * clause ("go. ok") ends its run, and `pieces` gets, for each word, where its typed pieces start and whether one had two
 * letters (ordinary short words in a row, "is hi to", rather than letters spaced out, "f u n").
 */
function words(text: string, reading: (word: string) => string, pieces?: Pieces[]): string[] {
  const out: string[] = [];
  let short = false;
  for (const token of base(text).split(/\s+/)) {
    const w = letters(reading(token));
    if (!w) continue;
    if (w.length <= 2 && short) {
      const i = out.length - 1;
      if (pieces) {
        pieces[i]!.starts.push(out[i]!.length);
        if (w.length === 2) pieces[i]!.pair = true;
      }
      out[i] += w;
    } else {
      out.push(w);
      pieces?.push({ starts: [0], pair: w.length === 2 });
    }
    short = w.length <= 2 && !(pieces && w.length === 2 && /[.,!?;:]$/.test(token));
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
  "shpx", "cuhpx", "sphx", "sipx", "cuhx", "fuvg", "ovgpu", "ovngpu", "phag", "nffubyr", "nefrubyr", "onfgneq", "fyhg", "juber", "jnaxre", "obyybpxf",
  "qvpxurnq", "wnpxnff", "qhzonff", "cvff", "cbea",
];
/** Swear words found only as a whole word, exactly (or plural): short ones that are parts of ordinary words. */
const SWEARS_WORDS = ["nff", "nefr", "qvpx", "pbpx", "chffl", "gjng", "jnax", "cevpx", "gvgf", "jgs", "fgsh", "tgsb"];
/** The masked spellings ("f*ck" reads as "fck"), as whole words with their endings ("f*cking", "sh*tty", "fukin"). */
const SWEARS_MASKED = ["shx", "shd", "spx", "sx", "fug", "ogpu", "pag", "qpx"];
/** Ordinary words with a swear word inside. */
const SWEARS_ALLOW = ["fphagubecr", "fuvvgnxr", "fuvgnxr", "fuvgn", "cvffneeb", "cbbea", "cuhxrg"];
/** How much of a chat message is read (a message is at most TOWN_CHAT.maxChars; this bounds the work for any caller). */
const CHAT_READ = 256;

const SWEAR_ANY_RE = new RegExp(entries(SWEARS_ANYWHERE).map(repeats).join("|"));
const SWEAR_START_RE = new RegExp(`^(?:${SWEAR_ANY_RE.source})`);
const SWEAR_WORD_RE = new RegExp(`^(?:(?:${entries(SWEARS_WORDS).join("|")})s?|(?:${entries(SWEARS_MASKED).join("|")})(?:ing|in|ed|er|s|ty|y)?)$`);
const SWEAR_ALLOW_RE = new RegExp(entries(SWEARS_ALLOW).map(repeats).join("|"), "g");
/** A swear word starting `at` in this word: inside it from there, or as the whole rest of it. */
const swearFrom = (w: string, at: number) => {
  const rest = w.slice(at);
  return SWEAR_WORD_RE.test(rest) || SWEAR_START_RE.test(rest.replace(SWEAR_ALLOW_RE, ""));
};
/**
 * Whether these words (one reading of a message) hold a swear word:
 *   - inside a word as typed, or one made of letters spaced out ("f u c k", "u f u c k");
 *   - in a run of ordinary short words read as one ("is hi to", "go f u c k"), only from where one of its typed pieces
 *     starts, so a sentence's little words don't spell one by chance ("up or no") while one split among them is caught;
 *   - across two neighbors when one is short ("f uck", "fuc k", "bi tch", "go f uck"), from where a piece of the first starts.
 */
function swears(ws: string[], pieces: Pieces[]): boolean {
  return ws.some((w, i) => {
    const p = pieces[i]!;
    if (p.starts.length === 1 || !p.pair ? SWEAR_WORD_RE.test(w) || SWEAR_ANY_RE.test(w.replace(SWEAR_ALLOW_RE, "")) : p.starts.some((at) => swearFrom(w, at))) return true;
    // (Its last typed piece, or the next word, short: "f uck", "go f uck", "fuc k".)
    const next = ws[i + 1];
    return next !== undefined && Math.min(w.length - p.starts.at(-1)!, next.length) <= 2 && p.starts.some((at) => swearFrom(w + next, at));
  });
}

/** Alphabets with letters that pass for Latin ones (and Latin's own extensions: small capitals, IPA letters…). */
const LOOKALIKE_SCRIPTS = /[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Armenian}\p{Script=Cherokee}\p{Script=Coptic}\p{Script=Lisu}\p{Script=Latin}]/u;
/** Each look-alike alphabet on its own, to tell how many a word draws from. */
const SCRIPTS = ["Cyrillic", "Greek", "Armenian", "Cherokee", "Coptic", "Lisu", "Latin"].map((name) => new RegExp(`\\p{Script=${name}}`, "u"));
/**
 * A word, as typed, that mixes alphabets with Latin look-alikes and has a letter of theirs the map doesn't know: real
 * Latin letters (a to z) beside one ("sh" + a new look-alike + "t"), or letters from two or more of those alphabets
 * (Cyrillic п, е, г beside a Cherokee letter). In chat it's refused, so a look-alike the list doesn't have yet can't carry
 * a word past the filter. A known look-alike is read as its Latin letter instead (the lists catch the word). Words wholly
 * in one alphabet ("дела", "καλημέρα") and other scripts beside Latin ("gg楽しかった", "ok你好") are left alone. (Names
 * don't get this: real names still work.)
 */
const mixedScript = (text: string) =>
  base(text)
    .split(/\s+/)
    .some((t) => {
      const chars = [...t];
      if (!chars.some((c) => c > "\x7f" && /\p{L}/u.test(c) && LOOKALIKE_SCRIPTS.test(c) && LOOKALIKE[c] === undefined)) return false;
      if (/[a-z]/.test(t)) return true;
      return SCRIPTS.filter((re) => chars.some((c) => /\p{L}/u.test(c) && re.test(c))).length >= 2;
    });

/**
 * A phone number, or any other: seven digits or more in the whole message, any script's (the director's call, after three
 * rounds of shapes opened new holes: "5 5 5 1 2 3 4", "12 34 56 78"). Rating ranges, long score lists and full dates are
 * refused with them; a short message still carries one or two numbers ("I'm 1500", "gg 1-0", "3+2").
 */
const PHONE_DIGITS = 7;
const digitCount = (text: string) => (text.match(/\p{Nd}/gu) ?? []).length;
/** The endings of web addresses people paste (not short ones that start sentences when someone skips a space: "me", "to"). */
const TLDS = "com|net|org|io|co|ly|tv|app|xyz|info|biz|uk|ru|de|fr|ca|au|link|site|online|club|shop|live|top|dev|cc|ws|tk|gl|page|store|chat|gg|me";
/** The same, without the ones that are everyday words ("polka dot top"), for an address spelled with "dot". */
const DOT_TLDS = "com|net|org|io|co|ly|tv|xyz|uk|ru|de|fr|ca|au|gg";
const LINK_RE = new RegExp(
  [
    "https?\\b", // http, https, http://
    "www\\s*[.。｡]",
    "://",
    // example.com, bit.ly (no space after the dot; "me" and "gg" only with a path: "t.me/x", "discord.gg/x")
    `\\b[a-z0-9-]+[.。｡](?:${TLDS.replace("|gg|me", "")})\\b`,
    "\\b[a-z0-9-]+(?:[.。｡][a-z0-9-]+)*[.。｡][a-z]{2,}/\\S", // t.me/someone, example.co.uk/page
    `\\b[a-z0-9-]+\\s+[.。｡]\\s*(?:${TLDS})\\b`, // example . io, bit . ly/x (a space before the dot: never prose)
    `\\b[a-z0-9-]+\\s*[([{]\\s*[.。｡]\\s*[)\\]}]\\s*(?:${TLDS})\\b`, // example(.)com, example [.] com, example{.}net
    "\\b[a-z0-9-]+\\s*[.。｡]\\s*(?:com|net|org)\\b", // example. com
    `\\b[a-z0-9-]+\\s*[([{]?\\s*dot\\s*[)\\]}]?\\s*(?:${DOT_TLDS})\\b`, // example dot com, example (dot) io
  ].join("|"),
);
/** Mail services. */
const MAIL = "gmail|googlemail|hotmail|outlook|yahoo|ymail|icloud|aol|proton|protonmail|gmx|msn";
/** An email address, a mail service's name ("my gmail"), or one spelled out ("at yahoo", "@ gmail"). */
const EMAIL_RE = new RegExp(`[\\w.+-]+\\s*@\\s*[\\w-]+[.。｡][a-z]{2,}|\\b(?:gmail|googlemail|hotmail|icloud|protonmail|ymail)\\b|(?:\\bat|@)\\s*(?:${MAIL})\\b`);
/** Messaging apps and games with their own chat, where "add me on …" moves a conversation off the game. */
const APPS_RE = /\b(?:discord|snapchat|snap\s+chat|instagram|whatsapp|telegram|tiktok|facebook|skype|wechat|roblox|kik)\b/;

/** What a refused chat message hears: a slur, a hate term or a swear word… */
export const CHAT_NOT_ALLOWED = "That message isn't allowed.";
/** …and a link, an email address or a phone number. */
export const CHAT_NO_CONTACT = "No links or contact details in chat.";

/** Why a chat message (the town square's) is refused, or null when it may go. */
export function chatRefusal(text: string): string | null {
  if (typeof text !== "string" || !text) return null;
  // ("who're" is "who are", not a word inside it.)
  const said = text.slice(0, CHAT_READ).replace(/\bwho['’]re\b/gi, "who are");
  const refused = (reading: (word: string) => string) => {
    const pieces: Pieces[] = [];
    const ws = words(said, reading, pieces);
    return listed(ws) || swears(ws, pieces);
  };
  const digits = said.normalize("NFKC").replace(/\P{Nd}/gu, "");
  if (READINGS.some(refused) || mixedScript(said) || NUMBERS.some((n) => digits.includes(n))) return CHAT_NOT_ALLOWED;
  // (Look-alike letters read as Latin ones, so a Cyrillic "о" can't hide a ".com"; digits and symbols stay as typed.)
  const plain = base(said).replace(/./gsu, (c) => LOOKALIKE[c] ?? c);
  if (LINK_RE.test(plain) || EMAIL_RE.test(plain) || APPS_RE.test(plain) || digitCount(said) >= PHONE_DIGITS) return CHAT_NO_CONTACT;
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
