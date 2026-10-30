/**
 * Boss art through the Claude API: Opus 5.5 draws one boss character (a sprite file in the game's own format, as code)
 * in a loop of write → render → look → fix, with tools, until it calls `done` or the spend cap would be passed.
 *   npx tsx scripts/boss-art/run.ts <id> <brief.md> [refs dir]
 * Spend: BOSS_ART_CAP_USD (default 20); the key: BOSS_LINES_API_KEY (scripts/boss-lines/api.ts, never printed or
 * written). Everything goes to scripts/boss-art/out/<id>/: the drawing (`<id>.ts`), each look's PNGs (`looks/`), the
 * turn log (`log.jsonl`, tokens and dollars per turn), the final previews (`preview/`) and `summary.md`.
 * Nothing here goes into the game: the drawing is reviewed and moved into packages/app/src/characters by hand.
 *
 * The model's tools: read the repo's character code and art guide (read only, those folders), write or edit its one
 * drawing, render it (render.ts, a process of its own without the key in its environment, since it runs the drawing),
 * look at the reference pictures, and say it's done.
 */
import Anthropic from "@anthropic-ai/sdk";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { MODEL as OPUS, PRICE as OPUS_PRICE, hasKey } from "../boss-lines/api.ts";

const [id, briefPath, refsDir] = process.argv.slice(2);
if (!id || !/^[a-z][a-z0-9-]{1,30}$/.test(id) || !briefPath) {
  console.error("usage: npx tsx scripts/boss-art/run.ts <id> <brief.md> [refs dir]");
  process.exit(2);
}
const CAP = Number(process.env.BOSS_ART_CAP_USD ?? 20);
/**
 * The model and its effort (Oct 27, Eric: compare Sonnet and Opus on the same drawing): BOSS_ART_MODEL (default Opus 5.5)
 * and BOSS_ART_EFFORT (default high). Each model's prices, dollars per million tokens (cache writes at 1.25x input).
 */
const MODEL = process.env.BOSS_ART_MODEL ?? OPUS;
const PRICES: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  [OPUS]: OPUS_PRICE,
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
};
const PRICE = PRICES[MODEL]!;
if (!PRICES[MODEL]) throw new Error(`BOSS_ART_MODEL: no prices for ${MODEL} (${Object.keys(PRICES).join(", ")})`);
const EFFORT = (process.env.BOSS_ART_EFFORT ?? "high") as "low" | "medium" | "high" | "xhigh";
if (!["low", "medium", "high", "xhigh"].includes(EFFORT)) throw new Error("BOSS_ART_EFFORT: low, medium, high or xhigh");
if (!(CAP > 0)) throw new Error("BOSS_ART_CAP_USD must be a positive number of dollars");
const MAX_TURNS = Number(process.env.BOSS_ART_MAX_TURNS ?? 90);
/**
 * Each turn's output ceiling (thinking included): room for a whole drawing written at once. BOSS_ART_MAX_TOKENS raises it
 * (Oct 27: Sonnet 5.5 at xhigh thought past 48,000 before writing; it allows 128,000).
 */
const MAX_TOKENS = Number(process.env.BOSS_ART_MAX_TOKENS ?? 48000);
if (!(MAX_TOKENS >= 1000 && MAX_TOKENS <= 128000)) throw new Error("BOSS_ART_MAX_TOKENS: 1000 to 128000");

const ROOT = resolve(".");
const OUT = resolve(`scripts/boss-art/out/${id}`);
const DRAFT = join(OUT, `${id}.ts`);
const LOOKS = join(OUT, "looks");
mkdirSync(LOOKS, { recursive: true });
/** What the model may read: the characters' code, the art guide and the boss area page (read only). */
const ARENA_DONE = existsSync(resolve("scripts/boss-art/out")) ? readdirSync(resolve("scripts/boss-art/out")).filter((d) => d.startsWith("arena-")).map((d) => `scripts/boss-art/out/${d}`) : [];
const READABLE = [...ARENA_DONE, "packages/app/src/characters", "packages/app/src/town/houses", ".claude/agents/characters.md", "docs/areas/bosses.md", "docs/areas/town-square.md", "scripts/boss-art/out/folio", "scripts/boss-art/out/sidekick-jefferson-sonnet-2", "scripts/boss-art/out/rank-wood", "scripts/boss-art/out/rank-sublime", "scripts/boss-art/out/rank-top-transcendent", "scripts/boss-art/briefs"].map((p) => resolve(p));
const refs = refsDir ? readdirSync(refsDir).filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f)).sort() : [];
const IMG_TYPE: Record<string, "image/png" | "image/jpeg" | "image/webp" | "image/gif"> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

const inside = (p: string, dir: string) => p === dir || p.startsWith(dir + sep);
/** The environment for a process that runs the drawing's code: the path and home only, never the key. */
const bareEnv = (): NodeJS.ProcessEnv => Object.fromEntries(["PATH", "HOME", "TMPDIR"].flatMap((k) => (process.env[k] ? [[k, process.env[k]!]] : [])));

const SYSTEM = `You are a pixel artist drawing a boss character for HunChess, a chess game, as code: one TypeScript file in the game's sprite format. You work alone in a loop with tools, and you see your work only by rendering it.

The format and the house style:
- Read packages/app/src/characters/sprite.ts (the format: palette, parts as grids of palette keys, layers, frames, animations) and packages/app/src/characters/paint.ts (shape helpers) first. Then study one or two finished bosses for how they're built (a pose() rig that builds frames from part positions, so moving a part is a number): packages/app/src/characters/tiger.ts, gingerbread.ts, recluse.ts are good examples. .claude/agents/characters.md is the art guide; follow its "How the art works" section (true pixel art, whole pixels, every part outlined in "k", a faint halo, light from the top left, chunky proportions that read at phone size, drama yes, gore no).
- Your file is ${relative(ROOT, DRAFT)}. Import from the game with paths relative to it: "../../../../packages/app/src/characters/sprite.ts" and "../../../../packages/app/src/characters/paint.ts". Export the character as a named const with id "${id}". Keep it self-contained (no other imports than those two and node built-ins are not needed).
${
  id.startsWith("arena-")
    ? `- This is not a boss: it is a piece of scenery for the Colosseum's inside (an arena the game builds from many such pieces), in the same sprite format. It needs exactly the animations the brief names (often just idle; a set of stills is one single-frame animation each). Ignore every boss-only rule (the boss moments, the phone-size comparison's sizing): the brief sets the size. Render's \`tile\` shows a slice repeated side by side ("x") or in a 3 x 3 grid ("xy") to check its seams; \`anim: "*"\` shows the first frame of every animation side by side; exports named ..._SEATS (arrays of [x, y]) are marked in magenta on the render.`
    : "- It needs these animations, each a few frames to a dozen or more, with ms per frame: idle (loops, alive but calm), entrance, thinking (loops), move, capture, hurt, check, smug, rattled, defeat, victory; plus any the brief asks for. Size it like the other bosses (render shows it beside one at phone size)."
}

How to work:
- Write the drawing (write_drawing), then render it (render) and look hard at what comes back: the strip of frames at up to 4x and the phone-size view beside another boss. Fix what reads badly (edit_drawing for small changes) and look again. Every animation should be looked at before you're done, and the idle and the face most of all, since they're on screen the most.
- The brief's reference pictures are ideas for shape and feel: draw the character in our pixel style, never their pixels.
- Spend: each tool result tells you what's been spent of the cap. Pace yourself to finish everything well before the cap; when the drawing is complete and you've checked every animation, call done with your notes.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "done",
    description: "Finish: the drawing is complete and every animation has been looked at. Give short notes: each animation beat by beat, and any choice the owner might want to change.",
    input_schema: { type: "object", properties: { notes: { type: "string" } }, required: ["notes"] },
  },
  {
    name: "edit_drawing",
    description: "Replace one exact piece of text in your drawing file with another (the old text must occur exactly once).",
    eager_input_streaming: true,
    input_schema: { type: "object", properties: { old: { type: "string" }, new: { type: "string" } }, required: ["old", "new"] },
  },
  {
    name: "list_files",
    description: "List the files in a folder you may read (packages/app/src/characters and below).",
    input_schema: { type: "object", properties: { dir: { type: "string" } }, required: ["dir"] },
  },
  {
    name: "read_file",
    description: "Read a text file: your drawing, anything under packages/app/src/characters, .claude/agents/characters.md or docs/areas/bosses.md. Optional 1-based line range.",
    input_schema: { type: "object", properties: { path: { type: "string" }, from: { type: "integer" }, to: { type: "integer" } }, required: ["path"] },
  },
  {
    name: "render",
    description:
      "Render your drawing into one picture: on top, one animation's frames (default all, at most 8: pick with `frames`, 0-based) side by side at `scale` (default 4, shrunk to fit 1500 px); below, the first idle frame at phone size (1x, 2x) beside another boss (`with`, a roster id, default tiger). Returns the picture, the frame counts of every animation and any warnings (a missing animation, a pixel on a frame's edge).",
    input_schema: {
      type: "object",
      properties: {
        anim: { type: "string" },
        frames: { type: "array", items: { type: "integer" } },
        scale: { type: "integer" },
        bg: { type: "string", enum: ["dark", "light"] },
        with: { type: "string" },
        tile: { type: "string", enum: ["x", "xy"], description: "scenery only: repeat the first shown frame 3 times side by side (x) or 3 x 3 (xy), to check seams" },
      },
      required: ["anim"],
    },
  },
  {
    name: "view_reference",
    description: "Look at one of the brief's reference pictures, by file name.",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "write_drawing",
    description: "Write your whole drawing file (replaces it).",
    eager_input_streaming: true,
    input_schema: { type: "object", properties: { contents: { type: "string" } }, required: ["contents"] },
  },
];

// ---- Spend: the real usage of every turn, at the model's prices.
const spent = { usd: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, turns: 0 };
const dollars = (u: Anthropic.Usage) =>
  (u.input_tokens * PRICE.input + u.output_tokens * PRICE.output + (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite + (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead) / 1e6;
const spendLine = () => `[spent $${spent.usd.toFixed(2)} of $${CAP} cap, turn ${spent.turns}]`;

// ---- The tools.
type Content = string | Anthropic.ToolResultBlockParam["content"];
let looks = 0;
const str = (v: unknown) => (typeof v === "string" ? v : null);

function readable(p: string): string | null {
  const abs = resolve(ROOT, p);
  return abs === DRAFT || READABLE.some((r) => inside(abs, r)) ? abs : null;
}

function runTool(name: string, input: Record<string, unknown>): { content: Content; error?: boolean; done?: string } {
  switch (name) {
    case "read_file": {
      const abs = str(input.path) && readable(str(input.path)!);
      if (!abs || !existsSync(abs)) return { content: "not readable here (or no such file)", error: true };
      const lines = readFileSync(abs, "utf8").split("\n");
      const from = Math.max(1, Number(input.from ?? 1));
      const to = Math.min(lines.length, Number(input.to ?? lines.length));
      const text = lines.slice(from - 1, to).map((l, i) => `${from + i}\t${l}`).join("\n");
      return { content: text.length > 150_000 ? `${text.slice(0, 150_000)}\n[cut at 150,000 characters: read a line range]` : text };
    }
    case "list_files": {
      const abs = str(input.dir) && readable(str(input.dir)!);
      if (!abs || !existsSync(abs)) return { content: "not listable here", error: true };
      return { content: readdirSync(abs, { withFileTypes: true }).map((d) => (d.isDirectory() ? `${d.name}/` : d.name)).join("\n") };
    }
    case "write_drawing": {
      const c = str(input.contents);
      if (c === null || c.length < 50) return { content: "contents missing or too short", error: true };
      writeFileSync(DRAFT, c);
      return { content: `written: ${c.split("\n").length} lines ${spendLine()}` };
    }
    case "edit_drawing": {
      const o = str(input.old);
      const n = str(input.new);
      if (o === null || n === null || !existsSync(DRAFT)) return { content: "old and new are both needed, and the drawing must exist", error: true };
      const text = readFileSync(DRAFT, "utf8");
      const count = text.split(o).length - 1;
      if (count !== 1) return { content: `the old text occurs ${count} times (it must occur exactly once)`, error: true };
      writeFileSync(DRAFT, text.replace(o, () => n));
      return { content: `edited ${spendLine()}` };
    }
    case "render": {
      if (!existsSync(DRAFT)) return { content: "write the drawing first", error: true };
      const dir = join(LOOKS, String(++looks).padStart(3, "0"));
      mkdirSync(dir, { recursive: true });
      const req = { draft: DRAFT, id, anim: str(input.anim) ?? "idle", frames: Array.isArray(input.frames) ? input.frames.map(Number) : undefined, scale: input.scale, bg: input.bg, with: input.with, tile: input.tile, out: dir };
      let raw: string;
      try {
        // Its own process, with no key in its environment: it runs the drawing's code.
        raw = execFileSync("npx", ["tsx", "scripts/boss-art/render.ts", JSON.stringify(req)], {
          cwd: ROOT,
          env: bareEnv(),
          timeout: 60_000,
          encoding: "utf8",
          maxBuffer: 4 << 20,
        });
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string; message: string };
        return { content: `render failed: ${(err.stderr || err.stdout || err.message).slice(0, 4000)}`, error: true };
      }
      const last = raw.trim().split("\n").pop() ?? "{}";
      let r: { error?: string; file?: string };
      try {
        r = JSON.parse(last);
      } catch {
        return { content: `render printed something unexpected: ${raw.slice(-2000)}`, error: true };
      }
      const { file, ...rest } = r;
      const text = `${JSON.stringify(rest, null, 1)} ${spendLine()}`;
      if (!file) return { content: text, error: !!r.error };
      return { content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: readFileSync(file).toString("base64") } }, { type: "text", text }] };
    }
    case "view_reference": {
      const n = str(input.name);
      if (!n || !refsDir || !refs.includes(n)) return { content: `no such reference; the references are: ${refs.join(", ") || "none"}`, error: true };
      const media = IMG_TYPE[extname(n).toLowerCase()]!;
      return { content: [{ type: "image", source: { type: "base64", media_type: media, data: readFileSync(join(refsDir, n)).toString("base64") } }, { type: "text", text: `${n} ${spendLine()}` }] };
    }
    case "done":
      return { content: "noted", done: str(input.notes) ?? "" };
    default:
      return { content: `no tool "${name}"`, error: true };
  }
}

// ---- The loop.
const brief = readFileSync(briefPath, "utf8");
const messages: Anthropic.MessageParam[] = [
  {
    role: "user",
    content: `${brief}\n\nYour character's id is "${id}". Reference pictures (view_reference): ${refs.length ? refs.join(", ") : "none"}. The spend cap is $${CAP}.`,
  },
];
const log = (o: object) => appendFileSync(join(OUT, "log.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), ...o })}\n`);

/** One cache breakpoint on the newest turn's last block (the system prompt has its own); older ones taken off. */
function markNewest(): void {
  for (const m of messages)
    if (Array.isArray(m.content)) for (const b of m.content) if ("cache_control" in b) delete (b as { cache_control?: unknown }).cache_control;
  const last = messages[messages.length - 1]!;
  if (typeof last.content === "string") last.content = [{ type: "text", text: last.content }];
  const blocks = last.content as Anthropic.ContentBlockParam[];
  (blocks[blocks.length - 1] as { cache_control?: Anthropic.CacheControlEphemeral }).cache_control = { type: "ephemeral" };
}

async function main(): Promise<void> {
  if (!hasKey()) throw new Error("BOSS_LINES_API_KEY isn't set in this environment: add it in the environment's settings and start a new session.");
  const client = new Anthropic({ apiKey: process.env.BOSS_LINES_API_KEY, baseURL: "https://api.anthropic.com" });
  let doneNotes: string | null = null;
  let stopped = "";
  let lastInput = 0;
  let jsonRetries = 0;
  while (spent.turns < MAX_TURNS) {
    // The worst this turn could cost: what's cached read again, a generous guess at what's new, and a full output.
    const newChars = JSON.stringify(messages[messages.length - 1]).length;
    const worst = (lastInput * PRICE.cacheRead + (newChars / 3) * PRICE.cacheWrite + MAX_TOKENS * PRICE.output) / 1e6;
    if (spent.usd + worst > CAP) {
      stopped = `stopped before turn ${spent.turns + 1}: $${spent.usd.toFixed(2)} spent, and the next turn could cost up to $${worst.toFixed(2)} (cap $${CAP})`;
      break;
    }
    // The API takes requests up to 32 MB; the looks' pictures are resent every turn.
    const bytes = JSON.stringify(messages).length;
    if (bytes > 26e6) {
      stopped = `stopped before turn ${spent.turns + 1}: the conversation is ${(bytes / 1e6).toFixed(1)} MB, near the API's 32 MB request limit`;
      break;
    }
    markNewest();
    let msg: Anthropic.Message;
    try {
      msg = await client.messages
        .stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          thinking: { type: "adaptive" },
          output_config: { effort: EFFORT },
          system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
          tools: TOOLS,
          messages,
        })
        .finalMessage();
      jsonRetries = 0;
    } catch (e) {
      // Only a tool input that couldn't be parsed at all is tried again; an API error stops the run (what's drawn is kept).
      if (e instanceof Anthropic.APIError || jsonRetries++ >= 2) {
        stopped = `the API call failed: ${e instanceof Error ? e.message.slice(0, 300) : String(e)}`;
        break;
      }
      console.log("  a tool input couldn't be parsed; asking again");
      continue;
    }
    const cost = dollars(msg.usage);
    spent.turns++;
    spent.usd += cost;
    spent.input += msg.usage.input_tokens;
    spent.output += msg.usage.output_tokens;
    spent.cacheWrite += msg.usage.cache_creation_input_tokens ?? 0;
    spent.cacheRead += msg.usage.cache_read_input_tokens ?? 0;
    lastInput = msg.usage.input_tokens + (msg.usage.cache_creation_input_tokens ?? 0) + (msg.usage.cache_read_input_tokens ?? 0);
    const uses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    console.log(`turn ${spent.turns}: ${uses.map((u) => u.name).join(", ") || msg.stop_reason}, $${cost.toFixed(3)} (total $${spent.usd.toFixed(2)})`);
    log({ turn: spent.turns, stop: msg.stop_reason, tools: uses.map((u) => u.name), usage: msg.usage, usd: cost, total: spent.usd });
    if (msg.stop_reason === "refusal") {
      stopped = "the model declined (stop_reason refusal)";
      break;
    }
    if (msg.stop_reason === "max_tokens") {
      stopped = `a turn ran out of room (max_tokens ${MAX_TOKENS}); the last tool call wasn't run`;
      break;
    }
    messages.push({ role: "assistant", content: msg.content });
    if (!uses.length) {
      // It stopped talking without done: ask it to carry on or finish.
      messages.push({ role: "user", content: "Carry on with the tools; call done when the drawing is complete and every animation has been looked at." });
      continue;
    }
    const results: Anthropic.ToolResultBlockParam[] = uses.map((u) => {
      const r = runTool(u.name, (u.input ?? {}) as Record<string, unknown>);
      if (r.done !== undefined) doneNotes = r.done;
      return { type: "tool_result", tool_use_id: u.id, content: r.content, ...(r.error ? { is_error: true } : {}) };
    });
    messages.push({ role: "user", content: results });
    if (doneNotes !== null) break;
  }
  if (doneNotes === null && !stopped) stopped = `stopped at the turn limit (${MAX_TURNS})`;
  // The final previews of every animation (the repo's own preview script, without the key in its environment).
  let preview = "";
  if (existsSync(DRAFT)) {
    try {
      execFileSync("npx", ["tsx", "scripts/preview-characters.ts", join(OUT, "preview"), `extra=${DRAFT}`, `only=${id}`, "looks=none"], {
        cwd: ROOT,
        env: bareEnv(),
        timeout: 300_000,
        stdio: "pipe",
      });
      preview = `${relative(ROOT, join(OUT, "preview"))}/ (GIFs, the frame sheet, the comparison)`;
    } catch (e) {
      preview = `the final preview failed: ${String((e as { stderr?: Buffer }).stderr ?? e).slice(0, 500)}`;
    }
  }
  const summary = [
    `# Boss art: ${id}`,
    "",
    `- Model ${MODEL}, effort ${EFFORT}, adaptive thinking. ${spent.turns} turns, ${looks} renders.`,
    `- Spend: **$${spent.usd.toFixed(2)}** of the $${CAP} cap (${spent.input.toLocaleString("en-US")} input, ${spent.cacheWrite.toLocaleString("en-US")} cache-write, ${spent.cacheRead.toLocaleString("en-US")} cache-read, ${spent.output.toLocaleString("en-US")} output tokens).`,
    stopped ? `- **Stopped early:** ${stopped}.` : "- Finished: it called done.",
    `- The drawing: ${relative(ROOT, DRAFT)}${existsSync(DRAFT) ? "" : " (none written)"}.`,
    `- Previews: ${preview || "none"}. Each look it took: ${relative(ROOT, LOOKS)}/.`,
    "",
    "## Its notes",
    "",
    doneNotes ?? "(none: it didn't call done)",
    "",
  ].join("\n");
  writeFileSync(join(OUT, "summary.md"), summary);
  console.log(`\n${summary}`);
}

main().catch((e: unknown) => {
  // Never prints the key: the SDK's errors carry no headers.
  console.error(`boss-art failed: ${e instanceof Error ? e.message : String(e)} ${spendLine()}`);
  process.exit(1);
});
