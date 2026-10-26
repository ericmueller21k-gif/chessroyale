/**
 * A source pack per boss: everything the repo already says about it, gathered at run time so the writing never invents
 * a fact. Its name and id (BOSS_ROSTER), its lines (its kit's lines by moment and its select-screen lines), its powers in
 * a player's words (the FAQ's block), its look (its sprite file's header comment, and its lines file's when it has one)
 * and its lore (lore.ts).
 */
import { readFileSync } from "node:fs";
import { BOSS_POWERS, BOSS_ROSTER, type BossDef } from "@chessroyale/core";
import { BOSS_KITS } from "../../packages/app/src/characters/kits.ts";
import { SELECT_LINES } from "../../packages/app/src/characters/boss-select.ts";
import { BOSS_BLOCKS } from "../../packages/app/src/faq/content.ts";
import { LORE, PRONOUNS } from "./lore.ts";

/** The 13 bosses, by roster id, in roster order. The Hidden Boss is left out on purpose. */
export const BOSS_IDS = ["gingerbread", "clown", "grex", "hollow", "bigboy", "sawyer", "pig", "alfil", "hopper", "smudgy", "moo", "gardener", "tiger"] as const;
export type BossId = (typeof BOSS_IDS)[number];

/** Each boss's sprite file, and its lines file when it has its own. */
const FILES: Readonly<Record<BossId, { sprite: string; lines?: string }>> = {
  gingerbread: { sprite: "gingerbread" },
  clown: { sprite: "clown" },
  grex: { sprite: "grex" },
  hollow: { sprite: "hollow" },
  bigboy: { sprite: "bigboy" },
  sawyer: { sprite: "sawyer" },
  pig: { sprite: "pig" },
  alfil: { sprite: "alfil" },
  hopper: { sprite: "hopper" },
  smudgy: { sprite: "smudgy" },
  moo: { sprite: "moo" },
  gardener: { sprite: "gardener", lines: "gardener-lines" },
  tiger: { sprite: "tiger", lines: "tiger-lines" },
};

export interface SourcePack {
  id: BossId;
  name: string;
  pronouns: string | null;
  powers: { passive: string; ultimate: string; faq: string };
  look: string[];
  lore: { source: string; text: string }[];
  selectLines: readonly string[];
  kitLines: Record<string, readonly string[]>;
}

const CHARACTERS = "packages/app/src/characters";

/** The first doc comment of a file, as plain text. */
function headerComment(path: string): string {
  const m = /\/\*\*([\s\S]*?)\*\//.exec(readFileSync(path, "utf8"));
  if (!m) throw new Error(`no header comment in ${path}`);
  return m[1]!.split("\n").map((l) => l.replace(/^\s*\* ?/, "")).join(" ").replace(/\s+/g, " ").trim();
}

/** The paragraph of a Markdown file that starts with `start` (up to the next blank line). */
function paragraph(file: string, start: string): string {
  const text = readFileSync(file, "utf8");
  const at = text.indexOf(start);
  if (at < 0) throw new Error(`lore source moved: "${start}" isn't in ${file} (update scripts/boss-lines/lore.ts)`);
  const end = text.indexOf("\n\n", at);
  return text.slice(at, end < 0 ? undefined : end).replace(/\s+/g, " ").trim();
}

export function sourcePack(id: BossId): SourcePack {
  const def: BossDef | undefined = BOSS_ROSTER.find((b) => b.id === id);
  if (!def || !def.kit || !def.powers) throw new Error(`no playable boss "${id}" in BOSS_ROSTER`);
  const kit = BOSS_KITS[def.kit];
  if (!kit) throw new Error(`no kit "${def.kit}" for ${id}`);
  const block = BOSS_BLOCKS[id];
  if (!block) throw new Error(`no FAQ block for ${id}`);
  const files = FILES[id];
  const look = [headerComment(`${CHARACTERS}/${files.sprite}.ts`), ...(files.lines ? [headerComment(`${CHARACTERS}/${files.lines}.ts`)] : [])];
  const lore = (LORE[id] ?? []).map((l) => (l.kind === "quote" ? { source: l.source, text: l.text } : { source: l.file, text: paragraph(l.file, l.startsWith) }));
  const kitLines: Record<string, readonly string[]> = {};
  for (const [beat, lines] of Object.entries(kit.lines)) if (lines?.length) kitLines[beat] = lines;
  return {
    id,
    name: def.name,
    pronouns: PRONOUNS[id] ?? null,
    powers: { passive: def.powers.passive, ultimate: def.powers.ultimate, faq: block(BOSS_POWERS, def).trim() },
    look,
    lore,
    selectLines: SELECT_LINES[id] ?? [],
    kitLines,
  };
}

/** A pack as the text a prompt carries. */
export function packText(p: SourcePack): string {
  const lines = Object.entries(p.kitLines).map(([beat, ls]) => `  ${beat}: ${ls.map((l) => JSON.stringify(l)).join(", ")}`);
  return [
    `### ${p.name} (id: ${p.id})`,
    p.pronouns ? `Pronouns: ${p.pronouns}` : null,
    `Powers (passive "${p.powers.passive}", ultimate "${p.powers.ultimate}"), as the game's FAQ explains them to players:\n${p.powers.faq}`,
    `Look (from the art's notes):\n${p.look.map((l) => `- ${l}`).join("\n")}`,
    p.lore.length ? `Lore:\n${p.lore.map((l) => `- ${l.text} [source: ${l.source}]`).join("\n")}` : "Lore: none written yet. Build only from the look, the powers and the lines.",
    `Character-select lines: ${p.selectLines.map((l) => JSON.stringify(l)).join(", ")}`,
    `Lines it already says in battle, by moment:\n${lines.join("\n")}`,
  ]
    .filter((x) => x !== null)
    .join("\n\n");
}
