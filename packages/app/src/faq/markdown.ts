/**
 * The FAQ's text format: a small, forgiving subset of Markdown, so a section is easy to write and edit in
 * `content.ts`. Pure (no DOM): the screen draws the blocks (`screens/Faq.tsx`), the tests read them, and
 * `plainText` makes the plain copy.
 *
 * - `### Heading {#id}`: a heading inside a section, with an anchor (tap-to-jump links point at it). Without `{#id}`
 *   its id is made from its words.
 * - A blank line ends a paragraph.
 * - `- item` or `1. item`: a list (one line an item).
 * - `| a | b |` lines: a table, its first row the header (a `|---|` line under it is optional and skipped).
 * - `$ formula`: a formula line, shown on its own in a fixed-width font (consecutive lines make one block).
 * - `> text`: a note, set apart (for "Being tested" and "Planned").
 * - Inline: `**bold**`, `*italic*`, `[words](#anchor)` or `[words](https://…)`.
 */

export type Inline = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "em"; text: string } | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "heading"; id: string; text: string }
  | { kind: "para"; inlines: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "table"; head: Inline[][]; rows: Inline[][][] }
  | { kind: "formula"; lines: string[] }
  | { kind: "note"; inlines: Inline[] };

/** An anchor from words: lower case, letters and digits, dashes between. */
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Inline marks in a line of text. Unclosed marks stay as they are. */
export function inlines(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\)/g;
  let at = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > at) out.push({ kind: "text", text: text.slice(at, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: "em", text: m[2] });
    else out.push({ kind: "link", text: m[3]!, href: m[4]! });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ kind: "text", text: text.slice(at) });
  return out;
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

/** A section's text as blocks. */
export function parse(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.replace(/\r/g, "").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "para", inlines: inlines(para.join(" ")) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = line.match(/^###\s+(.+?)(?:\s+\{#([a-z0-9-]+)\})?$/);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", id: heading[2] ?? slug(heading[1]!), text: heading[1]! });
      continue;
    }
    const item = line.match(/^(-|\d+\.)\s+(.*)$/);
    if (item) {
      flush();
      const ordered = item[1] !== "-";
      const last = blocks[blocks.length - 1];
      if (last?.kind === "list" && last.ordered === ordered && lines[i - 1]?.trim()) last.items.push(inlines(item[2]!));
      else blocks.push({ kind: "list", ordered, items: [inlines(item[2]!)] });
      continue;
    }
    if (line.startsWith("|")) {
      flush();
      const rows: string[][] = [];
      for (; i < lines.length && lines[i]!.trim().startsWith("|"); i++) {
        const row = cells(lines[i]!);
        if (!row.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(row);
      }
      i--;
      const [head = [], ...body] = rows;
      blocks.push({ kind: "table", head: head.map(inlines), rows: body.map((r) => r.map(inlines)) });
      continue;
    }
    if (line.startsWith("$ ")) {
      flush();
      const last = blocks[blocks.length - 1];
      const text = line.slice(2).trim();
      if (last?.kind === "formula" && lines[i - 1]?.trim().startsWith("$ ")) last.lines.push(text);
      else blocks.push({ kind: "formula", lines: [text] });
      continue;
    }
    if (line.startsWith(">")) {
      flush();
      const text = line.replace(/^>\s?/, "");
      const last = blocks[blocks.length - 1];
      if (last?.kind === "note" && lines[i - 1]?.trim().startsWith(">")) last.inlines.push({ kind: "text", text: " " }, ...inlines(text));
      else blocks.push({ kind: "note", inlines: inlines(text) });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/** The words of inline text, marks dropped (links keep their words). */
export const inlineText = (xs: readonly Inline[]) => xs.map((x) => x.text).join("");

/** Every anchor a section's blocks offer (its headings' ids). */
export const anchorsOf = (blocks: readonly Block[]) => blocks.flatMap((b) => (b.kind === "heading" ? [b.id] : []));

/** Every link in a section's blocks. */
export function linksOf(blocks: readonly Block[]): string[] {
  const all = (xs: readonly Inline[]) => xs.flatMap((x) => (x.kind === "link" ? [x.href] : []));
  return blocks.flatMap((b) =>
    b.kind === "para" || b.kind === "note" ? all(b.inlines) : b.kind === "list" ? b.items.flatMap(all) : b.kind === "table" ? [...b.head, ...b.rows.flat()].flatMap(all) : [],
  );
}

/** Blocks as plain text (the review copy): tables as aligned columns, lists with their marks. */
export function plainText(blocks: readonly Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.kind === "heading") out.push(`${b.text}\n${"-".repeat(b.text.length)}`);
    else if (b.kind === "para") out.push(inlineText(b.inlines));
    else if (b.kind === "note") out.push(`[${inlineText(b.inlines)}]`);
    else if (b.kind === "formula") out.push(b.lines.map((l) => `    ${l}`).join("\n"));
    else if (b.kind === "list") out.push(b.items.map((it, n) => `${b.ordered ? `${n + 1}.` : "-"} ${inlineText(it)}`).join("\n"));
    else {
      const rows = [b.head, ...b.rows].map((r) => r.map(inlineText));
      const widths = rows[0]!.map((_, c) => Math.max(...rows.map((r) => (r[c] ?? "").length)));
      const fmt = (r: string[]) => r.map((c, k) => c.padEnd(widths[k]!)).join("  ").trimEnd();
      out.push([fmt(rows[0]!), widths.map((w) => "-".repeat(w)).join("  "), ...rows.slice(1).map(fmt)].join("\n"));
    }
  }
  return out.join("\n\n");
}
