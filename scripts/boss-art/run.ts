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

const ARGS = process.argv.slice(2);
/** What's drawn: a boss character (the default), a crate item (`--item`) or a ride under the pawn (`--rider`). */
const MODE: "boss" | "item" | "rider" = ARGS.includes("--rider") ? "rider" : ARGS.includes("--item") ? "item" : "boss";
const [id, briefPath, refsDir] = ARGS.filter((a) => !a.startsWith("--"));
if (!id || !/^[a-z][a-z0-9-]{1,30}$/.test(id) || !briefPath) {
  console.error("usage: npx tsx scripts/boss-art/run.ts [--item | --rider] <id> <brief.md> [refs dir]");
  process.exit(2);
}
const ITEMISH = MODE !== "boss";
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
 * Each turn's output ceiling (thinking included): room for a whole drawing written at once (an item or a ride is far
 * smaller). BOSS_ART_MAX_TOKENS raises it (Oct 27: Sonnet 5.5 at xhigh thought past 48,000 before writing; it allows 128,000).
 */
const MAX_TOKENS = Number(process.env.BOSS_ART_MAX_TOKENS ?? (MODE === "boss" ? 48000 : MODE === "rider" ? 32000 : 24000));
if (!(MAX_TOKENS >= 1000 && MAX_TOKENS <= 128000)) throw new Error("BOSS_ART_MAX_TOKENS: 1000 to 128000");

const ROOT = resolve(".");
const OUT = resolve(`scripts/boss-art/out/${id}`);
const DRAFT = join(OUT, `${id}.${ITEMISH ? "tsx" : "ts"}`);
const LOOKS = join(OUT, "looks");
mkdirSync(LOOKS, { recursive: true });
/** What the model may read: the characters' code, the art guide and the boss area page (read only). */
const READABLE = (
  ITEMISH
    ? ["packages/app/src/components/Items.tsx", "packages/core/src/crates.ts", "scripts/boss-art/item-kit.tsx", ".claude/agents/item-builder.md", "packages/app/src/characters"]
    : ["packages/app/src/characters", "packages/app/src/town/houses", ".claude/agents/characters.md", "docs/areas/bosses.md", "docs/areas/town-square.md", "scripts/boss-art/out/folio", "scripts/boss-art/out/sidekick-jefferson-sonnet-2", "scripts/boss-art/out/rank-wood", "scripts/boss-art/out/rank-sublime", "scripts/boss-art/out/rank-top-transcendent", "scripts/boss-art/briefs"]
)
  // BOSS_ART_READ: more paths it may read, comma-separated (a redo reading its first try).
  .concat((process.env.BOSS_ART_READ ?? "").split(",").filter(Boolean))
  .map((p) => resolve(p));
const refs = refsDir ? readdirSync(refsDir).filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f)).sort() : [];
const IMG_TYPE: Record<string, "image/png" | "image/jpeg" | "image/webp" | "image/gif"> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

const inside = (p: string, dir: string) => p === dir || p.startsWith(dir + sep);
/** The environment for a process that runs the drawing's code: the path and home only, never the key. */
const bareEnv = (): NodeJS.ProcessEnv => Object.fromEntries(["PATH", "HOME", "TMPDIR"].flatMap((k) => (process.env[k] ? [[k, process.env[k]!]] : [])));

const SYSTEM = `You are a pixel artist drawing a boss character for HunChess, a chess game, as code: one TypeScript file in the game's sprite format. You work alone in a loop with tools, and you see your work only by rendering it.

The format and the house style:
- Read packages/app/src/characters/sprite.ts (the format: palette, parts as grids of palette keys, layers, frames, animations) and packages/app/src/characters/paint.ts (shape helpers) first. Then study one or two finished bosses for how they're built (a pose() rig that builds frames from part positions, so moving a part is a number): packages/app/src/characters/tiger.ts, gingerbread.ts, recluse.ts are good examples. .claude/agents/characters.md is the art guide; follow its "How the art works" section (true pixel art, whole pixels, every part outlined in "k", a faint halo, light from the top left, chunky proportions that read at phone size, drama yes, gore no).
- Your file is ${relative(ROOT, DRAFT)}. Import from the game with paths relative to it: "../../../../packages/app/src/characters/sprite.ts" and "../../../../packages/app/src/characters/paint.ts". Export the character as a named const with id "${id}". Keep it self-contained (no other imports than those two and node built-ins are not needed).
- It needs these animations, each a few frames to a dozen or more, with ms per frame: idle (loops, alive but calm), entrance, thinking (loops), move, capture, hurt, check, smug, rattled, defeat, victory; plus any the brief asks for. Size it like the other bosses (render shows it beside one at phone size).

How to work:
- Write the drawing (write_drawing), then render it (render) and look hard at what comes back: the strip of frames at up to 4x and the phone-size view beside another boss. Fix what reads badly (edit_drawing for small changes) and look again. Every animation should be looked at before you're done, and the idle and the face most of all, since they're on screen the most.
- The brief's reference pictures are ideas for shape and feel: draw the character in our pixel style, never their pixels.
- Spend: each tool result tells you what's been spent of the cap. Pace yourself to finish everything well before the cap; when the drawing is complete and you've checked every animation, call done with your notes.`;

const KIT = `The format (read scripts/boss-art/item-kit.tsx first: it's short, and it's the game's own item paint from packages/app/src/components/Items.tsx):
- Items are SVG drawn by Preact on the pawn's 100 × 100 square, not pixel grids. The house item style: flat fills, a bold dark outline on every part ({...LINE}: 3 units, "#1d1d1f", round joins; lw(n) for any other width, lw(1.6) for small parts), a simple highlight or two, chunky shapes that read at 60 px. Look at a few finished items in Items.tsx for the feel (read a line range: CandyCane ~420-440, Cutlass ~927-950, Spyglass ~951-977, LittleCrown ~677-691, PirateHat ~1023-1052, CaptainsCoat ~978-1022, Parrot ~1053-1073; the ITEM_ART, FRAMES and ATTACH tables from ~1234). .claude/agents/item-builder.md has the conventions.
- The cburnett pawn on the square: head top y 20, head center (50, 29), radius 9, neck about y 35-38, collar to about y 47, base about y 88, body x 25-75. Weapons sit at the pawn's right side, around x 60-98, slightly tilted (they may reach a little past the square). Head items: the brim at y 25 (attach: 25). Items may rise at most 9 units above the square (y -9: the avatar's clip cuts the rest).
- Painted parts go through <Region p={p} name="..." d={[paths]} />: they take the item's color, its blemish blotches (purity) and the shine for free; every color scheme comes free. Give each region its own name. p2 is a second color (only with colors: 2). Fixed parts (water, metal, paper, flame, white) are plain paths with {...LINE} outlines, colors you pick to suit the boss. Every item should have enough painted area that its color reads, but fixed parts are welcome where the real thing has a set color.
- Your file is ${relative(ROOT, DRAFT)}: TSX. Import only from "../../item-kit.tsx" (Region, LINE, lw, mirror, darken, lighten, isLight, Pawn, PAWN_PATH and the types) and "preact" if you need it. No other imports.`;

const ITEM_SYSTEM = `You are an artist drawing one crate item for HunChess, a chess game whose players dress their pawn in cosmetic items from crates. You draw it as code, one TSX file, in the game's own item format, working alone in a loop with tools; you see your work only by rendering it.

${KIT}
- Export one const of type ItemDraft (id "${id}"): its name, tier, slot (head, face, skin or weapon), a one-line description with a little humor, frame (its box on the square, x y w h, for its tile: every frame of the motion must fit inside), attach (head and face items), layer "back" only if it sits behind the pawn, and motion: { ms: [each frame's length] } (it loops; keep it subtle and alive: a few frames to a dozen or so). Art({ p, p2, side, f }) draws frame f. A skin replaces the pawn: draw <Pawn side={side} /> yourself if the pawn shows, and make the fixed colors read on a white and a black pawn.
- Motion is drawn by numbers: compute positions from f (a sway angle, a drop's position), so a frame is a number, not a redraw. Long holds at rest and a short beat of motion often read best ("now and then").

How to work:
- Write the drawing (write_drawing), render it (render) and look hard at what comes back: the motion frame by frame at 4x on a pawn, then phone size (a 60 px lobby pawn, the 130 px home pawn, its 64 px tile) beside existing items, then every color scheme at 75% purity. Fix what reads badly (edit_drawing for small changes) and look again. It must read at 60 px and look great at 4x, in every color, and its motion must be visible but never distracting.
- The reference pictures are the boss it's named for: take its colors, shapes and feel, in the item style (not pixel art).
- Spend: each tool result tells you what's been spent of the cap. Pace yourself to finish well before it: a few renders are usually enough. When it's done, call done with short notes: what it is, its motion beat by beat, and any choice the owner might want to change.`;

const RIDER_SYSTEM = `You are an artist drawing one ride for HunChess, a chess game whose players dress their pawn in cosmetic items from crates. A ride is a new, very rare kind of item: the player's pawn rides on it. You draw it as code, one TSX file, in the game's own item format, working alone in a loop with tools; you see your work only by rendering it.

${KIT}
- A ride is bigger than the pawn and sits under it. The pawn sits on it the way a pawn sits on a park bench or a stool in the game's town: its lower part hidden (behind the ride's seat), the rest resting on top. Export one const of type RiderDraft (id "${id}"): name, tier, a one-line description with a little humor, frame (its box with the pawn on it at rest, for its tile), idle and move ({ ms: [each frame's length] }), pose(anim, f) and two drawings, Back (behind the pawn) and Front (in front of it: what hides the pawn's lower part).
- pose(anim, f) places a frame: dx, dy move the whole group (the ride and its pawn; 100 units is one square of the town); pawnX, pawnY move the pawn on the ride (up is negative y: lift it so it rests on the seat), pawnTilt tilts it round its base, and cut is the line on the pawn's own square below which it's hidden (the bench-sit hides about its lowest third: cut ≈ 66; more if the seat is high). The pawn's base is at y 88 of its square; the ground line in the renders is y 80-100.
- idle loops at rest (alive and calm). move is one square of the town's movement, from dx 0 to dx 100 (the town plays it once per square walked, back to back): its last frame should land so the next move's first frame follows on.

How to work:
- Write the drawing (write_drawing), render it (render, anim idle or move) and look hard at what comes back: the animation frame by frame at 4x with a pawn riding, the town size (a pawn about 45 px) at rest and through its move, every color scheme at 75% purity, its tile. Fix what reads badly (edit_drawing for small changes) and look again. It must read at town size and look great at 4x, in every color; the pawn must clearly sit on it.
- The reference pictures are the boss it comes from: take its colors, shapes and feel, in the item style (not pixel art).
- Spend: each tool result tells you what's been spent of the cap. Pace yourself to finish well before it. When it's done, call done with short notes: what it is, idle and move beat by beat, and any choice the owner might want to change.`;

const ITEM_RENDER: Anthropic.Tool = {
  name: "render",
  description:
    MODE === "rider"
      ? "Render your ride into one picture: on top, one animation (`anim`, idle or move) frame by frame at 4x with a pawn riding (`frames`: 0-based, default all, at most 8; `side`: w or b; `color`: a color id, default red); then the town size at rest and every frame of the move; then every color scheme at 75% purity, 100%, shiny and its tile, beside existing items. Returns the picture, the facts (frame counts, loop lengths) and any warnings."
      : "Render your item into one picture: on top, its motion frame by frame on a pawn at 4x (`frames`: 0-based, default all, at most 8; `side`: w or b; `color`: a color id, default red); then phone size (a 60 px lobby pawn white and black, the 130 px home pawn, its 64 px tile) beside existing items of its slot; then every color scheme at 75% purity, 100% and shiny. Returns the picture, the facts (frames, its box) and any warnings (spilling past its frame box, rising past the avatar's cap).",
  input_schema: {
    type: "object",
    properties: {
      ...(MODE === "rider" ? { anim: { type: "string", enum: ["idle", "move"] } } : {}),
      frames: { type: "array", items: { type: "integer" } },
      side: { type: "string", enum: ["w", "b"] },
      color: { type: "string", enum: ["red", "yellow", "sage", "opal", "cobalt", "midnight", "emerald", "oceanic", "pearl"] },
    },
    required: [],
  },
};

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

if (ITEMISH) TOOLS.splice(TOOLS.findIndex((t) => t.name === "render"), 1, ITEM_RENDER);
for (const t of TOOLS) {
  if (!ITEMISH) break;
  if (t.name === "read_file") t.description = "Read a text file: your drawing, packages/app/src/components/Items.tsx, packages/core/src/crates.ts, scripts/boss-art/item-kit.tsx, .claude/agents/item-builder.md or anything under packages/app/src/characters. Optional 1-based line range (Items.tsx is long: read ranges).";
  if (t.name === "list_files") t.description = "List the files in a folder you may read (packages/app/src/characters and below).";
  if (t.name === "done") t.description = "Finish: the drawing is complete and its motion and colors have been looked at. Give short notes: what it is, its motion beat by beat, and any choice the owner might want to change.";
}

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
      const req = ITEMISH ? { draft: DRAFT, mode: MODE, anim: str(input.anim) ?? undefined, frames: Array.isArray(input.frames) ? input.frames.map(Number) : undefined, side: str(input.side) ?? undefined, color: str(input.color) ?? undefined, out: dir } : { draft: DRAFT, id, anim: str(input.anim) ?? "idle", frames: Array.isArray(input.frames) ? input.frames.map(Number) : undefined, scale: input.scale, bg: input.bg, with: input.with, out: dir };
      let raw: string;
      try {
        // Its own process, with no key in its environment: it runs the drawing's code.
        raw = execFileSync("npx", ["tsx", `scripts/boss-art/${ITEMISH ? "item-render" : "render"}.ts`, JSON.stringify(req)], {
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
    content: `${brief}\n\nYour ${MODE === "boss" ? "character" : MODE === "rider" ? "ride" : "item"}'s id is "${id}". Reference pictures (view_reference): ${refs.length ? refs.join(", ") : "none"}. The spend cap is $${CAP}.`,
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
          system: [{ type: "text", text: MODE === "item" ? ITEM_SYSTEM : MODE === "rider" ? RIDER_SYSTEM : SYSTEM, cache_control: { type: "ephemeral" } }],
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
  if (existsSync(DRAFT) && ITEMISH) {
    // Every frame of the motion (both animations for a ride), and the standard look, as the renderer draws them.
    const dir = join(OUT, "preview");
    mkdirSync(dir, { recursive: true });
    const shots: [string, object][] = MODE === "rider" ? [["idle", { anim: "idle", all: true }], ["move", { anim: "move", all: true }], ["look", { anim: "idle" }]] : [["frames", { all: true }], ["look", {}]];
    const made: string[] = [];
    for (const [name, extra] of shots) {
      try {
        const raw = execFileSync("npx", ["tsx", "scripts/boss-art/item-render.ts", JSON.stringify({ draft: DRAFT, mode: MODE, out: LOOKS, ...extra })], { cwd: ROOT, env: bareEnv(), timeout: 120_000, encoding: "utf8" });
        const r = JSON.parse(raw.trim().split("\n").pop() ?? "{}") as { file?: string; error?: string };
        if (r.file) {
          const to = join(dir, `${name}.png`);
          execFileSync("mv", [r.file, to]);
          made.push(relative(ROOT, to));
        } else made.push(`${name}: ${r.error ?? "no picture"}`);
      } catch (e) {
        made.push(`${name}: failed (${String(e).slice(0, 200)})`);
      }
    }
    preview = made.join(", ");
  } else if (existsSync(DRAFT)) {
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
    `# Boss art${MODE === "boss" ? "" : ` (${MODE})`}: ${id}`,
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
