/**
 * The prompts and their JSON schemas: (a) a character sheet per boss, (b) a relationship per pair, (c) everyday lines per
 * boss by situation, (d) pair conversations, (e) a critique pass that keeps or rewrites every line. Every schema is
 * strict (additionalProperties false, every field required), so each answer is clean JSON.
 */
import { MAX_CHARS, ericWritingRules } from "./rules.ts";

/** The situations everyday lines are written for, with what each means. */
export const SITUATIONS = {
  town: "town square chatter: idle lines as the boss roams near its home in the Boss raid town square (said to nobody in particular, or to players walking by)",
  greet: "greeting another boss it meets in the town square (any boss; name one only if the line is about that boss)",
  teammatePower: "reacting when a teammate boss uses its power in a fight where bosses team up",
  winTogether: "winning a fight together with a teammate boss",
  loseTogether: "losing a fight together with a teammate boss",
} as const;
export type Situation = keyof typeof SITUATIONS;

const str = { type: "string" } as const;
const strs = { type: "array", items: str } as const;
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

export const SYSTEM = `You write original dialogue for the bosses of HunChess, a phone-first chess game where crowds of players fight bosses with silly powers. Each boss is a character with a pixel-art sprite. Lines show as text in small speech bubbles (no audio): in the Boss raid town square, where the bosses roam near their homes and chat, and in fights where bosses team up and talk to each other.

What the game's owner, Eric, asked for: "voice lines… that interact between characters and have unique lines when the bosses are on a team together, they'll talk to each other… original… giving lore to each of the characters… if they share something in common or opposites, they would mention it, like fire, ice… or dark and light… silly things like asking questions to each other that are funny… and just normal lines too."

Rules for every line:
- At most ${MAX_CHARS} characters. Short and punchy reads best in a bubble; most lines should be well under the limit.
- American English. Use "…" (one character) for a trailing-off pause, as the game's existing lines do.
- Original: no famous catchphrases, no quotes from films, shows, songs or games, no other company's characters or trademarks.
- Playful and PG: teasing and rivalry are welcome, cruelty and swearing are not. Funny beats clever-for-its-own-sake.
- In character: each boss sounds like itself (its words, rhythm and catchphrases), never like a generic villain.
- Facts come from the source pack: a boss's name, look, powers and lore are as the pack says. You may add small, consistent details (a habit, a fear, a favorite thing) to bring a character to life, and you list them where the schema asks, so Eric can see what's new.
- The other bosses never mention the game's secret Hidden Boss.
- A power is described as a player sees it (the FAQ's words in the pack), never with numbers or rules text.

Eric's writing rules, word for word from the repo:
${ericWritingRules()}`;

// ---------------- (a) Character sheet ----------------

export const SHEET_SCHEMA = obj({
  name: str,
  id: str,
  pitch: str,
  whoTheyAre: str,
  voice: obj({ words: strs, rhythm: str, catchphrases: strs, neverSays: strs }),
  loves: strs,
  hates: strs,
  flawOrSecret: str,
  powerBrags: strs,
  powerGripes: strs,
  newDetails: strs,
});
export interface Sheet {
  name: string;
  id: string;
  pitch: string;
  whoTheyAre: string;
  voice: { words: string[]; rhythm: string; catchphrases: string[]; neverSays: string[] };
  loves: string[];
  hates: string[];
  flawOrSecret: string;
  powerBrags: string[];
  powerGripes: string[];
  newDetails: string[];
}

export const sheetPrompt = (pack: string) => `Write the character sheet for this boss, from its source pack below.

- pitch: who they are in one sentence.
- whoTheyAre: a short paragraph: their story (from the lore), what they want, how they see the other bosses.
- voice: how they talk: favorite words (6 to 10), their rhythm (sentence length, punctuation, tics), 3 or 4 original catchphrases of their own (each at most ${MAX_CHARS} characters; not one of the lines they already say), and 3 things they'd never say.
- loves, hates: 3 to 5 each, specific and funny where possible.
- flawOrSecret: one flaw or secret that makes them likable or funny.
- powerBrags, powerGripes: their two powers as things they'd brag about or complain about (in their own voice, 2 or 3 each, at most ${MAX_CHARS} characters each).
- newDetails: every detail you added that isn't in the source pack.

Source pack:
${pack}`;

// ---------------- (b) Relationship ----------------

export const RELATION_SCHEMA = obj({
  pair: strs,
  opposites: strs,
  inCommon: strs,
  dynamic: str,
  sillyAngles: strs,
  questionsAToB: strs,
  questionsBToA: strs,
  runningJoke: str,
  newDetails: strs,
});
export interface Relationship {
  pair: string[];
  opposites: string[];
  inCommon: string[];
  dynamic: string;
  sillyAngles: string[];
  questionsAToB: string[];
  questionsBToA: string[];
  runningJoke: string;
  newDetails: string[];
}

export const relationPrompt = (a: Sheet, b: Sheet, packA: string, packB: string) => `Write the relationship between ${a.name} (A) and ${b.name} (B), two bosses who meet in the town square and sometimes fight on the same team.

- pair: their ids, A first ("${a.id}", "${b.id}").
- opposites: where they're opposites (elements, temperament, size, habits…), 2 to 4.
- inCommon: what they share, 2 to 4 (even small or silly things).
- dynamic: a short paragraph: rivals, friends, frenemies, or something odder, and why. How it changes when they're on the same team.
- sillyAngles: 3 to 5 funny angles to write from.
- questionsAToB, questionsBToA: 3 funny questions each that one would ask the other (in the asker's voice, at most ${MAX_CHARS} characters each).
- runningJoke: one running joke between them.
- newDetails: every detail you added that isn't in their sheets or packs.

A's sheet:
${JSON.stringify(a, null, 1)}

B's sheet:
${JSON.stringify(b, null, 1)}

A's source pack:
${packA}

B's source pack:
${packB}`;

// ---------------- (c) Everyday lines ----------------

export const LINES_SCHEMA = obj({ lines: { type: "array", items: obj({ situation: { type: "string", enum: Object.keys(SITUATIONS) }, text: str }) } });
export interface Line {
  situation: Situation;
  text: string;
}

export const linesPrompt = (s: Sheet, pack: string, perSituation: number) => `Write ${perSituation * Object.keys(SITUATIONS).length} everyday lines for ${s.name}: ${perSituation} for each situation below, in its voice (its sheet and pack follow). Lines that work with any other boss: don't name a specific boss unless the line is about bosses in general.

Situations:
${Object.entries(SITUATIONS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Mix it up: statements, questions, jokes, little bits of lore, a brag or a gripe about its powers. No two lines alike in shape or in their joke. None may repeat a line it already says (in the pack) or one of its sheet's catchphrases word for word.

Sheet:
${JSON.stringify(s, null, 1)}

Source pack:
${pack}`;

// ---------------- (d) Pair conversations ----------------

export const CONVOS_SCHEMA = (ids: readonly string[]) =>
  obj({
    conversations: {
      type: "array",
      items: obj({ topic: str, where: { type: "string", enum: ["town", "fight"] }, lines: { type: "array", items: obj({ speaker: { type: "string", enum: [...ids] }, text: str }) } }),
    },
  });
export interface Convo {
  topic: string;
  where: "town" | "fight";
  lines: { speaker: string; text: string }[];
}

export const convosPrompt = (n: number, a: Sheet, b: Sheet, rel: Relationship) => `Write ${n} short conversations between ${a.name} (id "${a.id}") and ${b.name} (id "${b.id}"), each 2 to 4 lines, alternating speakers (either may start). Some in the town square ("town"), some on the same team in a fight ("fight").

Use their relationship: their opposites and what they share, questions one asks and the other answers, jokes, digs about each other's powers, the running joke at most once. Each conversation lands a little joke or a little bit of character by its last line. No two built the same way.

${a.name}'s sheet:
${JSON.stringify(a, null, 1)}

${b.name}'s sheet:
${JSON.stringify(b, null, 1)}

Their relationship:
${JSON.stringify(rel, null, 1)}`;

// ---------------- (e) Critique ----------------

export const CRITIQUE_SCHEMA = obj({
  items: { type: "array", items: obj({ id: str, verdict: { type: "string", enum: ["keep", "rewrite"] }, text: str, reason: str }) },
});
export interface Verdict {
  id: string;
  verdict: "keep" | "rewrite";
  text: string;
  reason: string;
}

export const critiquePrompt = (items: string, sheets: readonly Sheet[], rel: Relationship | null) => `You're the tough editor for these boss lines. Go through every line below (each has an id) and decide:

- keep: it's in voice, fresh, funny or characterful, and follows every rule. text: the line unchanged.
- rewrite: it's bland, generic, repeats another line's joke or shape, is out of voice, is over ${MAX_CHARS} characters, breaks a rule, or contradicts the sheets. text: your better line (same speaker, same situation; for a conversation line, it must still fit the lines around it). reason: what was wrong, in a few words.

Be strict: a line that any villain could say gets rewritten. Return every id, in order, exactly once.

Sheets:
${sheets.map((s) => JSON.stringify(s, null, 1)).join("\n\n")}
${rel ? `\nRelationship:\n${JSON.stringify(rel, null, 1)}\n` : ""}
Lines:
${items}`;
