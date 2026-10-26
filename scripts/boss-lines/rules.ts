/**
 * The automatic check every written line passes before it's kept: Eric's writing rules (docs/rules/eric.md, "Writing")
 * and the repo's own rules for boss lines, plus the speech bubble's length. A line that breaks one is rejected, with
 * the reasons, and listed as rejected in the results (never silently dropped).
 */
import { readFileSync } from "node:fs";

/** A speech bubble's room (the brief: "under ~70 characters"). */
export const MAX_CHARS = 70;

/** Words no boss line may contain, each with the rule it comes from. Matched whole-word, any case. */
const BANNED: readonly { re: RegExp; why: string }[] = [
  // Eric's rule for the Hidden Boss's lines (docs/rules/eric.md). These bosses never mention him, and the words stay out
  // of every line so a draft can't drift into his.
  { re: /\bsoviets?\b/i, why: "Eric's rule: never \"Soviet(s)\"" },
  { re: /\brussians?\b/i, why: "Eric's rule: never \"Russian(s)\"" },
  { re: /\bkorchnoi\b/i, why: "Eric's rule: nothing about Korchnoi" },
  { re: /\bhidden boss\b/i, why: "the Hidden Boss is never named or mentioned by the other bosses" },
  { re: /\brecluse\b/i, why: "the Hidden Boss's code name" },
  // Hollow's design (docs/history/bosses.md): no "Grinch"/"Grimch" in names or lines (someone else's trademark).
  { re: /\bgri[nm]ch/i, why: "no \"Grinch\"/\"Grimch\" in lines (Hollow's design: a trademark)" },
  // Original lines only: no famous catchphrases.
  { re: /to infinity and beyond|yabba dabba|i'll be back|hasta la vista|may the force|\bd'oh\b|cowabunga|i am groot|let it go|you shall not pass|why so serious|here's johnny|bazinga|it's-a me|that's all folks|what's up,? doc|show me the money|houston,? we have/i, why: "a famous catchphrase (lines must be original)" },
  // American English (CLAUDE.md, "Language").
  { re: /\b(colours?|favourite|honour|humour|realis(e|ed|ing)|organis(e|ed|ing|ation)|centre|theatre|grey|mum|neighbours?|flavours?|armour|travelled|cosy)\b/i, why: "British spelling (American English everywhere)" },
];

export interface LineCheck {
  ok: boolean;
  reasons: string[];
}

/** Words only some bosses may not say, by roster id. */
const BANNED_FOR: Readonly<Record<string, readonly { re: RegExp; why: string }[]>> = {
  // Hollow's design (docs/history/bosses.md): an original creature, no Santa suit. (Ginger's lore has Santa's workshop: Eric, Oct 25.)
  hollow: [{ re: /\bsanta\b/i, why: "no Santa in Hollow's lines (Hollow's design: an original creature, no Santa suit)" }],
  // A ginger-snap pun that didn't land (Eric, Oct 25: "why does he keep saying snap?").
  gingerbread: [{ re: /\bsnap/i, why: "no \"snap\" for Ginger (Eric, Oct 25: \"why does he keep saying snap?\")" }],
};

/** Checks one line: its length and every rule above. `"..."` is read as the ellipsis character the game's lines use. */
export function checkLine(text: string, speaker = ""): LineCheck {
  const reasons: string[] = [];
  const t = text.trim();
  if (!t) reasons.push("empty");
  if ([...t].length > MAX_CHARS) reasons.push(`too long for a bubble: ${[...t].length} characters (at most ${MAX_CHARS})`);
  if (t.includes("\n")) reasons.push("more than one line");
  for (const b of [...BANNED, ...(BANNED_FOR[speaker] ?? [])]) if (b.re.test(t)) reasons.push(b.why);
  return { ok: reasons.length === 0, reasons };
}

/** The game's lines use "…", not "...". */
export const tidy = (text: string): string => text.trim().replace(/\.\.\./g, "…");

/** Eric's writing rules, word for word from docs/rules/eric.md, for the prompts to carry. */
export function ericWritingRules(): string {
  const text = readFileSync("docs/rules/eric.md", "utf8");
  const at = text.indexOf("## Writing");
  if (at < 0) throw new Error("docs/rules/eric.md has no \"## Writing\" section (update scripts/boss-lines/rules.ts)");
  const next = text.indexOf("\n## ", at + 1);
  return text.slice(at, next < 0 ? undefined : next).trim();
}
