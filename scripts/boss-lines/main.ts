/**
 * Boss dialogue drafts with the Claude API, for Eric to review (nothing here goes into the game).
 *
 *   npm run boss-lines -- packs [out]          the source packs only, no API call (free); default out docs/boss-lines/packs
 *   npm run boss-lines -- sample               Ginger and Jefferson: two sheets, their relationship, 15 lines each,
 *                                              6 conversations, the critique; out docs/boss-lines/sample
 *   npm run boss-lines -- pair <id> <id> [out] the same for any two bosses (roster ids)
 *   npm run boss-lines -- boss <id> [out]      one boss: its sheet and 100 everyday lines (20 a situation), the critique
 *   npm run boss-lines -- sheets [out]         the 13 character sheets only, for Eric to approve before any lines;
 *                                              out docs/boss-lines/sheets
 *
 * BOSS_LINES_CAP_USD (default 3) caps the run's spend: a call that could pass it isn't sent. Results go to the out folder
 * as JSON plus a readable sample.md. scripts/boss-lines/README.md has the details.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MODEL, PRICE, SpendCapReached, Writer, hasKey } from "./api.ts";
import { BOSS_IDS, packText, sourcePack, type BossId, type SourcePack } from "./packs.ts";
import {
  CONVOS_SCHEMA,
  CRITIQUE_SCHEMA,
  LINES_SCHEMA,
  RELATION_SCHEMA,
  SHEET_SCHEMA,
  SITUATIONS,
  SYSTEM,
  convosPrompt,
  critiquePrompt,
  linesPrompt,
  relationPrompt,
  sheetPrompt,
  type Convo,
  type Line,
  type Relationship,
  type Sheet,
  type Verdict,
} from "./prompts.ts";
import { MAX_CHARS, checkLine, tidy } from "./rules.ts";

/** One line, start to finish: as first written, after the critique, and the automatic check's verdict on the final. */
interface Drafted {
  id: string;
  speaker: string;
  situation: string;
  first: string;
  text: string;
  verdict: "keep" | "rewrite" | "unreviewed";
  reason: string;
  ok: boolean;
  rejected: string[];
}

interface Plan {
  ids: BossId[];
  perSituation: number;
  convos: number;
  out: string;
  title: string;
}

const asId = (s: string | undefined): BossId => {
  if (!s || !(BOSS_IDS as readonly string[]).includes(s)) throw new Error(`unknown boss "${s}": one of ${BOSS_IDS.join(", ")}`);
  return s as BossId;
};

async function run(plan: Plan, cap: number): Promise<void> {
  mkdirSync(plan.out, { recursive: true });
  const packs = plan.ids.map(sourcePack);
  const save = (file: string, data: unknown) => writeFileSync(join(plan.out, file), JSON.stringify(data, null, 2) + "\n");
  save("packs.json", packs);
  if (!hasKey()) throw new Error("BOSS_LINES_API_KEY isn't set in this environment (the source packs were written; no call was made).");

  const w = new Writer(cap);
  const name = (id: string) => packs.find((p) => p.id === id)?.name ?? id;
  const result: { sheets: Sheet[]; relationship: Relationship | null; lines: Drafted[]; stoppedEarly: string | null } = { sheets: [], relationship: null, lines: [], stoppedEarly: null };
  const write = () => {
    save("results.json", { model: MODEL, effort: "high", capUsd: cap, usage: w.usage, calls: w.log, ...result });
    writeFileSync(join(plan.out, "sample.md"), report(plan, packs, result, w));
  };
  try {
    for (const p of packs) {
      console.log(`${p.name}: character sheet`);
      result.sheets.push(await w.json<Sheet>(`sheet ${p.id}`, SYSTEM, sheetPrompt(packText(p)), SHEET_SCHEMA));
      write();
    }
    const [a, b] = plan.ids.length === 2 ? result.sheets : [];
    if (a && b) {
      console.log(`${a.name} and ${b.name}: relationship`);
      result.relationship = await w.json<Relationship>(`relationship ${a.id}-${b.id}`, SYSTEM, relationPrompt(a, b, packText(packs[0]!), packText(packs[1]!)), RELATION_SCHEMA);
      write();
    }
    const draft: Omit<Drafted, "text" | "verdict" | "reason" | "ok" | "rejected">[] = [];
    for (const [i, p] of plan.perSituation > 0 ? packs.entries() : []) {
      console.log(`${p.name}: everyday lines`);
      const got = await w.json<{ lines: Line[] }>(`lines ${p.id}`, SYSTEM, linesPrompt(result.sheets[i]!, packText(p), plan.perSituation), LINES_SCHEMA);
      got.lines.forEach((l, k) => draft.push({ id: `L-${p.id}-${k + 1}`, speaker: p.id, situation: l.situation, first: tidy(l.text) }));
    }
    if (a && b && plan.convos > 0) {
      console.log(`${a.name} and ${b.name}: conversations`);
      const got = await w.json<{ conversations: Convo[] }>(`conversations ${a.id}-${b.id}`, SYSTEM, convosPrompt(plan.convos, a, b, result.relationship!), CONVOS_SCHEMA([a.id, b.id]));
      got.conversations.forEach((c, n) => c.lines.forEach((l, k) => draft.push({ id: `C${n + 1}-${k + 1}`, speaker: l.speaker, situation: `${c.where}: ${c.topic}`, first: tidy(l.text) })));
    }
    // Until the critique answers, every line stands as first written (and is checked as such).
    result.lines = draft.map((d) => ({ ...d, text: d.first, verdict: "unreviewed", reason: "", ...verdictOf(d.first, d.speaker) }));
    write();

    if (draft.length > 0) {
      console.log("critique");
      const items = draft.map((d) => `${d.id} [${name(d.speaker)} · ${d.situation}]: ${JSON.stringify(d.first)}`).join("\n");
      const got = await w.json<{ items: Verdict[] }>("critique", SYSTEM, critiquePrompt(items, result.sheets, result.relationship), CRITIQUE_SCHEMA);
      const byId = new Map(got.items.map((v) => [v.id, v]));
      result.lines = draft.map((d) => {
        const v = byId.get(d.id);
        const text = v ? tidy(v.text) : d.first;
        return { ...d, text, verdict: v ? v.verdict : "unreviewed", reason: v?.reason ?? "the critique skipped this line", ...verdictOf(text, d.speaker) };
      });
    }
  } catch (e) {
    if (!(e instanceof SpendCapReached)) {
      write();
      throw e;
    }
    result.stoppedEarly = e.message;
    console.log(e.message);
  }
  write();
  const bad = result.lines.filter((l) => !l.ok).length;
  console.log(`done: ${w.usage.calls} calls, ${w.usage.input} input + ${w.usage.output} output tokens, $${w.usage.usd.toFixed(4)}; ${result.lines.length} lines, ${bad} rejected by the check. ${join(plan.out, "sample.md")}`);
}

const verdictOf = (text: string, speaker: string) => {
  const c = checkLine(text, speaker);
  return { ok: c.ok, rejected: c.reasons };
};

/** The readable report: a summary, the sheets, the relationship, the lines and conversations as they'd appear, the cost. */
function report(plan: Plan, packs: readonly SourcePack[], r: { sheets: Sheet[]; relationship: Relationship | null; lines: Drafted[]; stoppedEarly: string | null }, w: Writer): string {
  const name = (id: string) => packs.find((p) => p.id === id)?.name ?? id;
  const u = w.usage;
  const rewritten = r.lines.filter((l) => l.verdict === "rewrite").length;
  const kept = r.lines.filter((l) => l.verdict === "keep").length;
  const unreviewed = r.lines.length - kept - rewritten;
  const rejected = r.lines.filter((l) => !l.ok);
  const shown = (l: Drafted) => (l.ok ? l.text : `~~${l.text}~~ (rejected: ${l.rejected.join("; ")})`);
  const out: string[] = [
    `# ${plan.title}`,
    "",
    "> **Summary**",
    `> 1. Built: \`scripts/boss-lines/\` (\`npm run boss-lines\`): source packs from the repo, then ${MODEL} at effort "high" with structured outputs writes sheets, a relationship, lines and conversations, and a critique pass rewrites the weak ones.`,
    `> 2. Cost: ${u.calls} calls, ${u.input.toLocaleString("en-US")} input + ${u.output.toLocaleString("en-US")} output tokens = **$${u.usd.toFixed(4)}** (cap $${w.capUsd}).${r.stoppedEarly ? ` Stopped early: ${r.stoppedEarly}.` : ""}`,
    `> 3. ${r.lines.length} lines: the critique kept ${kept} and rewrote ${rewritten}${unreviewed ? ` (${unreviewed} not reviewed: shown as first written)` : ""}; the automatic check (Eric's writing rules, ${MAX_CHARS} characters) rejected ${rejected.length}.`,
    "> 4. Lore: Hollow's and Ginger's are Eric's own, kept exactly. The other sketches for the first seven bosses come from PR #264's description (draft lore, never in the repo); the rest from their decision files.",
    "> 5. Drafts only: nothing here is in the game. Each sheet lists the details it added beyond the sources (\"New details\"), for Eric to approve or cut.",
    "",
  ];
  for (const s of r.sheets) {
    out.push(
      `## ${s.name}: character sheet`,
      "",
      `**${s.pitch}**`,
      "",
      s.whoTheyAre,
      "",
      `- **Voice:** ${s.voice.rhythm}`,
      `- **Words:** ${s.voice.words.join(", ")}`,
      `- **Catchphrases:** ${s.voice.catchphrases.map((c) => `"${c}"`).join(" · ")}`,
      `- **Never says:** ${s.voice.neverSays.join("; ")}`,
      `- **Loves:** ${s.loves.join("; ")}`,
      `- **Hates:** ${s.hates.join("; ")}`,
      `- **Flaw or secret:** ${s.flawOrSecret}`,
      `- **Brags:** ${s.powerBrags.map((c) => `"${c}"`).join(" · ")}`,
      `- **Gripes:** ${s.powerGripes.map((c) => `"${c}"`).join(" · ")}`,
      `- **New details (not in the sources):** ${s.newDetails.join("; ") || "none"}`,
      "",
    );
  }
  const rel = r.relationship;
  if (rel) {
    const [a, b] = rel.pair.map(name);
    out.push(
      `## ${a} and ${b}: their relationship`,
      "",
      rel.dynamic,
      "",
      `- **Opposites:** ${rel.opposites.join("; ")}`,
      `- **In common:** ${rel.inCommon.join("; ")}`,
      `- **Silly angles:** ${rel.sillyAngles.join("; ")}`,
      `- **${a} asks ${b}:** ${rel.questionsAToB.map((q) => `"${q}"`).join(" · ")}`,
      `- **${b} asks ${a}:** ${rel.questionsBToA.map((q) => `"${q}"`).join(" · ")}`,
      `- **Running joke:** ${rel.runningJoke}`,
      `- **New details:** ${rel.newDetails.join("; ") || "none"}`,
      "",
    );
  }
  for (const p of packs) {
    const mine = r.lines.filter((l) => l.id.startsWith(`L-${p.id}-`));
    if (!mine.length) continue;
    out.push(`## ${p.name}: everyday lines`, "");
    for (const sit of Object.keys(SITUATIONS)) {
      const ls = mine.filter((l) => l.situation === sit);
      if (ls.length) out.push(`**${sit}**`, "", ...ls.map((l) => `- ${shown(l)}`), "");
    }
  }
  const convos = [...new Set(r.lines.filter((l) => l.id.startsWith("C")).map((l) => l.id.split("-")[0]!))];
  if (convos.length) {
    out.push("## Conversations", "");
    for (const c of convos) {
      const ls = r.lines.filter((l) => l.id.split("-")[0] === c);
      out.push(`**${c}** (${ls[0]!.situation})`, "", ...ls.map((l) => `> **${name(l.speaker)}:** ${shown(l)}  `), "");
    }
  }
  const changed = r.lines.filter((l) => l.verdict === "rewrite");
  if (changed.length) out.push("## What the critique rewrote", "", "| Line | First draft | Why |", "| --- | --- | --- |", ...changed.map((l) => `| ${l.id} | ${l.first.replace(/\|/g, "\\|")} | ${l.reason.replace(/\|/g, "\\|")} |`), "");
  out.push(
    "## Cost",
    "",
    `Model ${MODEL}, effort "high", adaptive thinking (thinking tokens count as output). Prices: $${PRICE.input} per million input tokens, $${PRICE.output} per million output.`,
    "",
    "| Step | Input tokens | Output tokens | Dollars |",
    "| --- | ---: | ---: | ---: |",
    ...w.log.map((c) => `| ${c.step} | ${c.input.toLocaleString("en-US")} | ${c.output.toLocaleString("en-US")} | $${c.usd.toFixed(4)} |`),
    `| **Total** | **${u.input.toLocaleString("en-US")}** | **${u.output.toLocaleString("en-US")}** | **$${u.usd.toFixed(4)}** |`,
    "",
  );
  return out.join("\n");
}

async function main(): Promise<void> {
  const [mode, ...args] = process.argv.slice(2);
  const cap = Number(process.env.BOSS_LINES_CAP_USD ?? 3);
  if (!(cap > 0)) throw new Error("BOSS_LINES_CAP_USD must be a positive number of dollars");
  switch (mode) {
    case "packs": {
      const out = args[0] ?? "docs/boss-lines/packs";
      mkdirSync(out, { recursive: true });
      for (const id of BOSS_IDS) writeFileSync(join(out, `${id}.md`), packText(sourcePack(id)) + "\n");
      console.log(`${BOSS_IDS.length} source packs written to ${out} (no API call)`);
      return;
    }
    case "sample":
      return run({ ids: ["gingerbread", "grex"], perSituation: 3, convos: 6, out: "docs/boss-lines/sample", title: "Boss lines sample: Ginger and Jefferson (ice vs fire)" }, cap);
    case "pair": {
      const [a, b] = [asId(args[0]), asId(args[1])];
      return run({ ids: [a, b], perSituation: 3, convos: 6, out: args[2] ?? `docs/boss-lines/pairs/${a}-${b}`, title: `Boss lines: ${a} and ${b}` }, cap);
    }
    case "sheets":
      return run({ ids: [...BOSS_IDS], perSituation: 0, convos: 0, out: args[0] ?? "docs/boss-lines/sheets", title: "Boss lines: the 13 character sheets" }, cap);
    case "boss": {
      const id = asId(args[0]);
      return run({ ids: [id], perSituation: 20, convos: 0, out: args[1] ?? `docs/boss-lines/bosses/${id}`, title: `Boss lines: ${id}` }, cap);
    }
    default:
      throw new Error(`mode: packs, sample, sheets, pair <id> <id> or boss <id> (got "${mode ?? ""}")`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
