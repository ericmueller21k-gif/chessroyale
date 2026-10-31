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
 *
 * `--rider-views <id> <brief.md>` adds front and back views to a finished ride: its drawing (out/<id>/<id>.tsx) is the
 * starting file and the reference, and `done` is refused while the side view's pictures differ from the original's.
 * `--rider-trail <id> <brief.md>` adds (or replaces) a finished ride's trail mark and takes any left-behind trail out of
 * its frames: `done` is refused while its frames differ from the original's other than by what was taken away.
 */
import Anthropic from "@anthropic-ai/sdk";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { MODEL as OPUS, PRICE as OPUS_PRICE, hasKey } from "../boss-lines/api.ts";

const ARGS = process.argv.slice(2);
/**
 * What's drawn: a boss character (the default), a crate item (`--item`), a ride under the pawn (`--rider`), the front
 * and back views of a finished ride (`--rider-views`, a ride run that starts from its side view), or a finished ride's
 * trail mark (`--rider-trail`, a ride run that starts from the finished ride).
 */
const VIEWS = ARGS.includes("--rider-views");
const TRAIL = ARGS.includes("--rider-trail");
const MODE: "boss" | "item" | "rider" = VIEWS || TRAIL || ARGS.includes("--rider") ? "rider" : ARGS.includes("--item") ? "item" : "boss";
const [id, briefPath, refsDir] = ARGS.filter((a) => !a.startsWith("--"));
if (!id || !/^[a-z][a-z0-9-]{1,30}$/.test(id) || !briefPath) {
  console.error("usage: npx tsx scripts/boss-art/run.ts [--item | --rider | --rider-views | --rider-trail] <id> <brief.md> [refs dir]");
  process.exit(2);
}
const ITEMISH = MODE !== "boss";
/** The cap: $20, or $3 for adding a ride's views, $1.50 for its trail (Oct 31). */
const CAP = Number(process.env.BOSS_ART_CAP_USD ?? (VIEWS ? 3 : TRAIL ? 1.5 : 20));
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
/** (A trail run: medium by default.) */
const EFFORT = (process.env.BOSS_ART_EFFORT ?? (TRAIL ? "medium" : "high")) as "low" | "medium" | "high" | "xhigh";
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
/**
 * Adding views or a trail: the finished drawing, kept as it was when the run started (next to the drawing, so its import
 * still resolves; not committed: `<id>.side.tsx`, `<id>.pre-trail.tsx`), to show the model and to check against at `done`.
 */
const ORIG = join(OUT, `${id}.${VIEWS ? "side" : "pre-trail"}.tsx`);
if (VIEWS || TRAIL) {
  if (!existsSync(DRAFT)) {
    console.error(`${VIEWS ? "--rider-views" : "--rider-trail"}: no finished ride at ${relative(ROOT, DRAFT)} (draw it first with --rider)`);
    process.exit(2);
  }
  writeFileSync(ORIG, readFileSync(DRAFT));
}
/** This run's own files: a views or trail run keeps the side run's summary and log, and numbers its looks apart. */
const RUN = VIEWS ? "views-" : TRAIL ? "trail-" : "";
mkdirSync(LOOKS, { recursive: true });
/** What the model may read: the characters' code, the art guide and the boss area page (read only). */
const ARENA_DONE = existsSync(resolve("scripts/boss-art/out")) ? readdirSync(resolve("scripts/boss-art/out")).filter((d) => d.startsWith("arena-")).map((d) => `scripts/boss-art/out/${d}`) : [];
const READABLE = (
  ITEMISH
    ? ["packages/app/src/components/Items.tsx", "packages/core/src/crates.ts", "scripts/boss-art/item-kit.tsx", ".claude/agents/item-builder.md", "packages/app/src/characters", ...(VIEWS || TRAIL ? [join(OUT, "summary.md"), join(OUT, "views-summary.md"), ORIG] : [])]
    : [...ARENA_DONE, "packages/app/src/characters", "packages/app/src/town/houses", ".claude/agents/characters.md", "docs/areas/bosses.md", "docs/areas/town-square.md", "scripts/boss-art/out/folio", "scripts/boss-art/out/sidekick-jefferson-sonnet-2", "scripts/boss-art/out/rank-wood", "scripts/boss-art/out/rank-sublime", "scripts/boss-art/out/rank-top-transcendent", "scripts/boss-art/briefs"]
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
${
  id.startsWith("arena-")
    ? `- This is not a boss: it is a piece of scenery for the Colosseum's inside (an arena the game builds from many such pieces), in the same sprite format. It needs exactly the animations the brief names (often just idle; a set of stills is one single-frame animation each). Ignore every boss-only rule (the boss moments, the phone-size comparison's sizing): the brief sets the size. Render's \`tile\` shows a slice repeated side by side ("x") or in a 3 x 3 grid ("xy") to check its seams; \`anim: "*"\` shows the first frame of every animation side by side; exports named ..._SEATS (arrays of [x, y]) are marked in magenta on the render.`
    : "- It needs these animations, each a few frames to a dozen or more, with ms per frame: idle (loops, alive but calm), entrance, thinking (loops), move, capture, hurt, check, smug, rattled, defeat, victory; plus any the brief asks for. Size it like the other bosses (render shows it beside one at phone size)."
}

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

/** Nothing left behind in a ride's own frames (Oct 31): the rider, rider-views and rider-trail prompts. */
const LEFT_BEHIND = `Nothing left behind in the ride's own frames (Oct 31; Eric: the trails appear only when you're running around the town). Its idle has no trail at all, and its move draws nothing that stays behind as it goes: no ribbon, sparkle trail, streaks, smoke line, footprints or puffs left in the air or on the ground behind it. What goes along with the ride is fine (an exhaust puff at its pipe, a kick of dust at its feet that stays with it, a wisp rising from it, twinkles round it at rest). What it leaves behind is its trail mark (\`trail\`), which the town draws on the ground, apart from the ride, only while it runs.`;

/** A ride's trail mark: the format and how the town shows it (the rider and rider-trail prompts). */
const TRAIL_TEXT = `Its trail (Oct 31). In the town your pawn leaves a few small white droplets on the squares behind it as it runs, each fading out (seen only by you). A ride replaces them with its own trail mark (the RiderDraft's \`trail\`, type RiderTrail): a cricket's little footprints, a bulb's dark smudge, a moon's sparkle.
- trail: { ms: [each frame's length], every?: one mark every this many squares (default 1), w, h: its box in units, Mark({ p, p2, f, view, n }) }. The town drops one mark on each square the ride leaves while it runs (none while it stands still), where it stays and plays its frames once, fresh to faded (frame 0 when it lands; its life is the sum of ms: a few hundred ms to a second; the droplets live 520 ms, so about three show behind a run), then it's gone. The fade is drawn in its frames (opacity, shrinking, breaking up).
- It's small and on the ground: drawn round (0, 0), the middle of the square it lands on (a square is about 69 units), inside its box (w × h centered there, at most 40 × 30). Draw it seen from above at the town's angle, a little flattened, lying flat on the floor (no shadow, nothing standing up). It must read on the floor's light tan and dark brown squares at town size (a square 31 px).
- view is the way the ride was running: side (going right; the town mirrors it for left), back (going up the screen), front (going down), so prints or streaks can point the way it went; n numbers a run's marks (0, 1, 2, …), for marks that take turns (a left and a right footprint).
- It may take the item's color (p.hex, flat; or a Region: its box is the mark's) or have fixed colors, as the brief says.
- Render it with view "trail": every frame at 4x for each way it runs, at town size and in every color, then a strip of frames from the ride's GIF (the end of a run right, a moment later as its marks fade, the ends of a run up and a run down) at the town's scale.`;

/** Front and back: what they are and how they move (the rider and rider-views prompts). */
const VIEWS_TEXT = `Three views (Oct 31). In the town a ride is seen from the way it's going, so a ride can have three views:
- side (walking left or right): the RiderDraft's own fields, facing our right (the town mirrors it for left).
- back (walking up the screen, away from us): views.back. We see it from behind: its rump and tail (or a vehicle's back and back wheels), the back of its saddle or seat, its hind legs; the pawn on it is seen from behind (the same cburnett silhouette; the game hides face items then). Its head, if it has one, is mostly hidden by the pawn: ears, horns, antennae or the top of the head may peek out round it.
- front (walking down the screen, toward us): views.front. We see its face and chest (or a vehicle's front, grille, headlights), its front legs or wheels, the front of its saddle; the pawn sits behind the head, seen from the front, its lower part hidden by the head, neck and saddle.
- The camera looks slightly down on the town (about 30 degrees). From behind it sees the top of the ride's back and rump and the saddle's seat behind the pawn, not just a flat rear; from the front it sees the face and chest, and over the head a little of the top of the back running away behind the pawn. Things nearer the camera sit a little lower on the picture and overlap what's behind them.
- Front and back are centered on x 50 (the pawn's middle), roughly symmetric, and narrower than the side (a body seen end-on is about as wide as it is tall), at the same scale: the same height, the same ground line (feet or wheels on y 88-97), the pawn at the same height on it (the same pawnY and cut as the side, pawnX about 0, pawnTilt only a small sideways roll), so turning a corner doesn't make it jump.
- Each view has its own idle and move ({ ms }), pose, Back (behind the pawn) and Front (in front of it), the side's shapes (type RiderViewDraft; an optional frame, its box). Back and Front get \`view\` in their props, if you share code between views.
- The front and back move is one square's walk toward or away from the camera, played once per square like the side's. The town slides the ride up or down the screen itself, so the drawing stays on its square (pose dx 0; dy only for a bob or a hop, negative is up) and shows the motion in place: legs stepping in turn (lifting and setting down, seen end-on), wheels rolling (seen end-on: a tread or spokes moving, a little bounce), a hop's crouch, spring and landing. Match the side's move: the same gait, about the same number of frames and the same timing, and its last frame leads into its first.
- Each view's idle has the side's beats where they'd show from there (a blink, an ear or tail flick, a breath, a puff).`;

const RIDER_SYSTEM = `You are an artist drawing one ride for HunChess, a chess game whose players dress their pawn in cosmetic items from crates. A ride is a new, very rare kind of item: the player's pawn rides on it. You draw it as code, one TSX file, in the game's own item format, working alone in a loop with tools; you see your work only by rendering it.

${KIT}
- A ride is bigger than the pawn and sits under it. The pawn sits on it the way a pawn sits on a park bench or a stool in the game's town: its lower part hidden (behind the ride's seat), the rest resting on top. Export one const of type RiderDraft (id "${id}"): name, tier, a one-line description with a little humor, frame (its box with the pawn on it at rest, for its tile), idle and move ({ ms: [each frame's length] }), pose(anim, f) and two drawings, Back (behind the pawn) and Front (in front of it: what hides the pawn's lower part).
- pose(anim, f) places a frame: dx, dy move the whole group (the ride and its pawn; 100 units is the pawn's box, about 1.45 town squares, so one square is about 69 units); pawnX, pawnY move the pawn on the ride (up is negative y: lift it so it rests on the seat), pawnTilt tilts it round its base, and cut is the line on the pawn's own square below which it's hidden (the bench-sit hides about its lowest third: cut ≈ 66; more if the seat is high). The pawn's base is at y 88 of its square; the ground line in the renders is y 80-100.
- idle loops at rest (alive and calm). move is one square of the town's movement, drawn as dx 0 to dx 100 (the town fits it to one square, about 69 units, and plays it once per square walked, back to back): its last frame should land so the next move's first frame follows on. A ride's widest frame, in any view, stays within 125 units (about 1.8 town squares).

${VIEWS_TEXT}
- Draw the side view. Draw front and back views (views: { front, back }) only if the brief asks for them; they can be added later from the finished side.

${LEFT_BEHIND}

${TRAIL_TEXT}
- Draw its trail mark if the brief describes one; otherwise leave \`trail\` out (it can be added later).

How to work:
- Write the drawing (write_drawing), render it (render, anim idle or move) and look hard at what comes back: the animation frame by frame at 4x with a pawn riding, the town size (a pawn about 45 px) at rest and through its move, every color scheme at 75% purity, its tile. Fix what reads badly (edit_drawing for small changes) and look again. It must read at town size and look great at 4x, in every color; the pawn must clearly sit on it.
- The reference pictures are the boss it comes from: take its colors, shapes and feel, in the item style (not pixel art).
- Spend: each tool result tells you what's been spent of the cap. Pace yourself to finish well before it. When it's done, call done with short notes: what it is, idle and move beat by beat, and any choice the owner might want to change.`;

const RIDER_VIEWS_SYSTEM = `You are an artist adding the front and back views to a finished ride for HunChess, a chess game whose players dress their pawn in cosmetic items from crates; a ride is a very rare item the pawn rides on. The ride is drawn as code, one TSX file in the game's own item format, and you work alone in a loop with tools; you see your work only by rendering it.

${KIT}
- The pawn sits on a ride the way a pawn sits on a park bench in the game's town: its lower part hidden behind the seat, the rest resting on top. pose(anim, f) places a frame: dx, dy move the whole group (ride and pawn); pawnX, pawnY move the pawn on the ride (up is negative y), pawnTilt tilts it round its base, and cut is the line on the pawn's own square below which it's hidden. The pawn's base is at y 88 of its square.

${VIEWS_TEXT}

${LEFT_BEHIND} If the side's move leaves something behind, the front and back views leave nothing behind all the same (the trail mark covers it).

Your task:
- Your file (${relative(ROOT, DRAFT)}) starts as the finished ride: its side view, already approved. Its source, its maker's notes and pictures of its side view are in the first message. Add views: { front, back } to its RiderDraft, each a RiderViewDraft.
- The side view must not change at all: not a number, a color, a region's name or the order things are drawn. done renders the side view and compares it with the original's pixels, and refuses while anything differs. So add code, never rewrite: put the new functions after the side's, and add the views field with edit_drawing (small inserts). You may reuse the side's constants, colors and state tables (its idle and move beats) from the new code, but don't edit them.
- Match the side so the three read as one ride turning: the same proportions and size, the same fixed colors and the same painted parts (the item's color on the same parts, seen from that side, with the same Region names where it's the same part, so the blemishes and shine behave alike), the same personality and details where they'd show from there (a bell, a blush, a horn, a tail tuft, a flag).

How to work:
- Render with view "all" to see the three views side by side (at rest and through their moves, at 4x and at town size, in two more colors); render one view (view "front" or "back", anim idle or move) to see it frame by frame at 4x and in every color. Look hard and fix what reads badly. Both new views must read at town size (a pawn about 45 px) and look great at 4x, in every color; the pawn must clearly sit on the ride, and from the front its face must read.
- Spend: each tool result tells you what's been spent of the cap. Pace yourself to finish well before it. When it's done, call done with short notes: what each new view shows, its idle and move beat by beat, and any choice the owner might want to change.`;

const RIDER_TRAIL_SYSTEM = `You are an artist adding the trail mark to a finished ride for HunChess, a chess game whose players dress their pawn in cosmetic items from crates; a ride is a very rare item the pawn rides on. The ride is drawn as code, one TSX file in the game's own item format, and you work alone in a loop with tools; you see your work only by rendering it.

${KIT}
- The pawn sits on a ride the way a pawn sits on a park bench in the game's town. A ride has an idle and a move (one square's travel) for its side view, and may have front and back views (views: { front, back }) with their own.

${TRAIL_TEXT}

${LEFT_BEHIND}

Your task:
- Your file (${relative(ROOT, DRAFT)}) starts as the finished ride, already approved. Its source, its maker's notes and pictures of each view are in the first message. Add its trail mark as the brief describes: a \`trail\` field on its RiderDraft, its Mark function after the ride's code (if it already has one, replace it).
- Take out of the ride's own frames anything left behind, in every view, idle and move: a sparkle trail behind its tail, a ribbon of paint, streaks, smoke or dust left behind in the air or on the ground. Keep what goes along with the ride. Take out only that (remove the code that draws it, or make it draw nothing) and leave everything else exactly as it is: not a number, a color, a region's name or the order things are drawn; the same frames, frame lengths and poses. Add no new views.
- done renders every frame of every view before and after (in two colors) and refuses while anything differs other than by being taken away: nothing added, nothing of the ride itself changed (what the trail covered may show again). It also refuses while the trail mark is missing, past its box or its limits. Its refusal shows the frames that differ: before, after, and the difference (magenta: taken away; orange: next to it; red: changed or added).

How to work:
- Render with view "trail" to see the mark (and how it lies behind the running ride); render a view's move (view side, front or back; anim move) to check that nothing is left behind any more. The mark must read at town size on light and dark squares, in every color it takes, and suit the ride.
- Spend: each tool result tells you what's been spent of the cap. Pace yourself to finish well before it. When it's done, call done with short notes: the mark frame by frame (its life, how it fades, how it points), what you took out of which frames, and any choice the owner might want to change.`;

const ITEM_RENDER: Anthropic.Tool = {
  name: "render",
  description:
    MODE === "rider"
      ? "Render your ride into one picture. `view`: side, front, back, or all (the default once it has a front or back view); or trail: its trail mark, every frame at 4x for each way it runs (`frames`, `color`), at town size and in every color, plus a second picture, a strip of frames from the ride's GIF at the town's scale (the end of a run right, a moment later as the marks fade, the ends of a run up and a run down). One view: on top, one animation (`anim`, idle or move) frame by frame at 4x with a pawn riding (`frames`: 0-based, default all, at most 8; `side`: w or b; `color`: a color id, default red); then the town size at rest and every frame of the move; then every color scheme at 75% purity, 100%, shiny and its tile, beside existing items. All: the three views side by side in columns, idle frame 0 and some move frames at 4x (`frames`: the move frames, at most 4; default 3 spread over the move; the side's move shown in place), then at town size idle and every move frame, then at rest in cobalt (white pawn) and midnight (black pawn). Returns the picture, the facts (frame counts, loop lengths, per view) and any warnings."
      : "Render your item into one picture: on top, its motion frame by frame on a pawn at 4x (`frames`: 0-based, default all, at most 8; `side`: w or b; `color`: a color id, default red); then phone size (a 60 px lobby pawn white and black, the 130 px home pawn, its 64 px tile) beside existing items of its slot; then every color scheme at 75% purity, 100% and shiny. Returns the picture, the facts (frames, its box) and any warnings (spilling past its frame box, rising past the avatar's cap).",
  input_schema: {
    type: "object",
    properties: {
      ...(MODE === "rider" ? { anim: { type: "string", enum: ["idle", "move"] }, view: { type: "string", enum: ["side", "front", "back", "all", "trail"] } } : {}),
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

/** One picture from item-render.ts (its own process, with no key in its environment: it runs the drawing's code). */
function itemRender(req: object): { file?: string; error?: string; facts?: { rider?: { views?: string[]; trail?: object | null } }; warnings?: string[] } {
  try {
    const raw = execFileSync("npx", ["tsx", "scripts/boss-art/item-render.ts", JSON.stringify(req)], { cwd: ROOT, env: bareEnv(), timeout: 120_000, encoding: "utf8", maxBuffer: 4 << 20 });
    return JSON.parse(raw.trim().split("\n").pop() ?? "{}");
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string };
    return { error: `render failed: ${(err.stderr || err.stdout || err.message).slice(0, 2000)}` };
  }
}

/**
 * Adding views: whether the side view still draws exactly as the original did (its idle and its move, every frame, the
 * town size, every color and the tile, compared pixel for pixel), and which views the drawing has. Null when it's fine.
 */
function sideCheck(needViews: boolean): string | null {
  const shot = (draft: string, anim: string) => {
    const dir = join(LOOKS, "side-check", `${draft === ORIG ? "original" : "now"}-${anim}`);
    mkdirSync(dir, { recursive: true });
    return itemRender({ draft, mode: "rider", view: "side", anim, all: true, out: dir });
  };
  const changed: string[] = [];
  for (const anim of ["idle", "move"]) {
    const was = shot(ORIG, anim);
    const now = shot(DRAFT, anim);
    if (now.error) return `the drawing doesn't render: ${now.error}`;
    if (was.error || !was.file || !now.file) return `the side check couldn't render the original: ${was.error ?? "no picture"}`;
    if (!readFileSync(was.file).equals(readFileSync(now.file))) changed.push(anim);
    if (anim === "idle" && needViews) {
      const has = now.facts?.rider?.views ?? [];
      const missing = ["front", "back"].filter((v) => !has.includes(v));
      if (missing.length) return `the ride has no ${missing.join(" or ")} view yet (views.${missing[0]})`;
    }
  }
  return changed.length ? `the side view's pictures differ from the original's (${changed.join(" and ")}: compare the side view with render view "side"; the original is ${relative(ROOT, ORIG)}, read only). Put the side view back exactly as it was` : null;
}

/**
 * A ride's trail in its GIF (ride-gif.ts, its own process without the key): a strip of a few of its frames at the town's
 * scale, as a picture block, or the reason there's none.
 */
function trailStrip(dir: string, color: string): Anthropic.ImageBlockParam | string {
  const strip = join(dir, "strip.png");
  try {
    execFileSync("npx", ["tsx", "scripts/boss-art/ride-gif.ts", DRAFT, color, "--out", join(dir, "ride.gif"), "--strip", strip], { cwd: ROOT, env: bareEnv(), timeout: 180_000, encoding: "utf8", maxBuffer: 4 << 20, stdio: "pipe" });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string };
    return `the GIF strip failed: ${(err.stderr || err.stdout || err.message).slice(0, 1500)}`;
  }
  return existsSync(strip) ? { type: "image", source: { type: "base64", media_type: "image/png", data: readFileSync(strip).toString("base64") } } : "the GIF strip wasn't written";
}

/** The trail check's answer (ride-gif.ts --trail-check). */
interface TrailCheck {
  ok: boolean;
  problems: string[];
  removed?: string[];
  trail?: object;
  file?: string | null;
}
let trailChecks = 0;
/**
 * Adding a trail: whether the ride's frames (every view, idle and move) differ from the original's only by what was taken
 * away, its timing and travel are the same, and its trail mark is there and within its limits (ride-gif.ts
 * --trail-check, its own process without the key, since it runs the drawing).
 */
function trailCheck(): TrailCheck {
  try {
    const raw = execFileSync("npx", ["tsx", "scripts/boss-art/ride-gif.ts", "--trail-check", ORIG, DRAFT, "--out", join(LOOKS, `trail-check-${++trailChecks}`)], { cwd: ROOT, env: bareEnv(), timeout: 600_000, encoding: "utf8", maxBuffer: 4 << 20, stdio: "pipe" });
    return JSON.parse(raw.trim().split("\n").pop() ?? "{}") as TrailCheck;
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string };
    return { ok: false, problems: [`the trail check didn't run: ${(err.stderr || err.stdout || err.message).slice(0, 1500)}`] };
  }
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
      const dir = join(LOOKS, RUN + String(++looks).padStart(3, "0"));
      mkdirSync(dir, { recursive: true });
      const req = ITEMISH ? { draft: DRAFT, mode: MODE, anim: str(input.anim) ?? undefined, view: str(input.view) ?? undefined, frames: Array.isArray(input.frames) ? input.frames.map(Number) : undefined, side: str(input.side) ?? undefined, color: str(input.color) ?? undefined, out: dir } : { draft: DRAFT, id, anim: str(input.anim) ?? "idle", frames: Array.isArray(input.frames) ? input.frames.map(Number) : undefined, scale: input.scale, bg: input.bg, with: input.with, tile: input.tile, out: dir };
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
      const pic: Anthropic.ImageBlockParam = { type: "image", source: { type: "base64", media_type: "image/png", data: readFileSync(file).toString("base64") } };
      // A ride's trail: its mark, then the strip from its GIF.
      if (MODE === "rider" && input.view === "trail") {
        const strip = trailStrip(dir, str(input.color) ?? "red");
        return { content: typeof strip === "string" ? [pic, { type: "text", text: `${text}\n${strip}` }] : [pic, strip, { type: "text", text: `Above: its trail mark, then the strip from its GIF (the end of a run right, a moment later, the ends of a run up and a run down). ${text}` }] };
      }
      return { content: [pic, { type: "text", text }] };
    }
    case "view_reference": {
      const n = str(input.name);
      if (!n || !refsDir || !refs.includes(n)) return { content: `no such reference; the references are: ${refs.join(", ") || "none"}`, error: true };
      const media = IMG_TYPE[extname(n).toLowerCase()]!;
      return { content: [{ type: "image", source: { type: "base64", media_type: media, data: readFileSync(join(refsDir, n)).toString("base64") } }, { type: "text", text: `${n} ${spendLine()}` }] };
    }
    case "done": {
      if (VIEWS) {
        const problem = sideCheck(true);
        if (problem) return { content: `not done: ${problem}. ${spendLine()}`, error: true };
      }
      if (TRAIL) {
        const c = trailCheck();
        if (!c.ok) {
          const text = `not done:\n- ${c.problems.join("\n- ")}\n(the original is ${relative(ROOT, ORIG)}, read only) ${spendLine()}`;
          return { content: c.file && existsSync(c.file) ? [{ type: "image", source: { type: "base64", media_type: "image/png", data: readFileSync(c.file).toString("base64") } }, { type: "text", text: `Above: the frames that differ (before | after | the difference). ${text}` }] : text, error: true };
        }
      }
      return { content: "noted", done: str(input.notes) ?? "" };
    }
    default:
      return { content: `no tool "${name}"`, error: true };
  }
}

// ---- The loop.
const brief = readFileSync(briefPath, "utf8");
const intro = `${brief}\n\nYour ${MODE === "boss" ? "character" : MODE === "rider" ? "ride" : "item"}'s id is "${id}". Reference pictures (view_reference): ${refs.length ? refs.join(", ") : "none"}. The spend cap is $${CAP}.`;
/**
 * Adding views or a trail: the first message also carries the finished drawing (its source and its maker's notes) and
 * pictures of it, rendered before the first turn (no API spend): views, the side view's idle and move; a trail, the side
 * view's idle and every view's move (where a left-behind trail shows).
 */
function startIntro(): Anthropic.ContentBlockParam[] {
  const notesOf = (file: string) => (existsSync(join(OUT, file)) ? readFileSync(join(OUT, file), "utf8").split("## Its notes")[1]?.trim() ?? "" : "");
  const notes = VIEWS ? notesOf("summary.md") : [notesOf("summary.md"), notesOf("views-summary.md") && `Adding its front and back views:\n\n${notesOf("views-summary.md")}`].filter(Boolean).join("\n\n");
  const pics: Anthropic.ContentBlockParam[] = [];
  const shots: [string, "idle" | "move"][] = [["side", "idle"], ["side", "move"]];
  for (let i = 0; i < shots.length; i++) {
    const [view, anim] = shots[i]!;
    const dir = join(LOOKS, `${RUN}000-${view}-${anim}`);
    mkdirSync(dir, { recursive: true });
    const r = itemRender({ draft: ORIG, mode: "rider", view, anim, out: dir });
    if (!r.file) throw new Error(`the finished ride doesn't render: ${r.error ?? "no picture"}`);
    pics.push({ type: "image", source: { type: "base64", media_type: "image/png", data: readFileSync(r.file).toString("base64") } }, { type: "text", text: `Above: the ${view} view's ${anim}, frame by frame at 4x, then town size${view === "side" ? ", every color and its tile" : ""}.` });
    if (TRAIL && i === 0) for (const v of (r.facts?.rider?.views ?? []).filter((v) => v !== "side")) shots.push([v, "move"]);
  }
  return [
    { type: "text", text: `${intro}\n\nThe finished ride, your starting file (${relative(ROOT, DRAFT)}; the original stays at ${relative(ROOT, ORIG)}, read only):\n\n\`\`\`tsx\n${readFileSync(ORIG, "utf8")}\`\`\`\n\nIts maker's notes:\n\n${notes || "(none)"}` },
    ...pics,
  ];
}
const messages: Anthropic.MessageParam[] = [{ role: "user", content: VIEWS || TRAIL ? startIntro() : intro }];
const log = (o: object) => appendFileSync(join(OUT, `${RUN}log.jsonl`), `${JSON.stringify({ at: new Date().toISOString(), ...o })}\n`);

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
          system: [{ type: "text", text: MODE === "item" ? ITEM_SYSTEM : VIEWS ? RIDER_VIEWS_SYSTEM : TRAIL ? RIDER_TRAIL_SYSTEM : MODE === "rider" ? RIDER_SYSTEM : SYSTEM, cache_control: { type: "ephemeral" } }],
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
    // A ride: its side view as before (idle.png, move.png, look.png), then each front and back animation and the three
    // views side by side (views.png), once it has them, and its trail mark (trail.png) once it has one.
    const shots: [string, object][] = MODE === "rider" ? [["idle", { view: "side", anim: "idle", all: true }], ["move", { view: "side", anim: "move", all: true }], ["look", { view: "side", anim: "idle" }]] : [["frames", { all: true }], ["look", {}]];
    const made: string[] = [];
    for (let i = 0; i < shots.length; i++) {
      const [name, extra] = shots[i]!;
      const r = itemRender({ draft: DRAFT, mode: MODE, out: LOOKS, ...extra });
      if (r.file) {
        const to = join(dir, `${name}.png`);
        execFileSync("mv", [r.file, to]);
        made.push(relative(ROOT, to));
      } else made.push(`${name}: ${r.error ?? "no picture"}`);
      if (MODE === "rider" && i === 0) {
        const has = (r.facts?.rider?.views ?? []).filter((v) => v !== "side");
        for (const v of has) shots.push([`${v}-idle`, { view: v, anim: "idle", all: true }], [`${v}-move`, { view: v, anim: "move", all: true }]);
        if (has.length) shots.push(["views", { view: "all", all: true }]);
        if (r.facts?.rider?.trail) shots.push(["trail", { view: "trail", all: true }]);
      }
    }
    // A trail run: the ride's GIF too (preview/ride.gif), its marks dropped behind it as it runs.
    if (TRAIL)
      try {
        execFileSync("npx", ["tsx", "scripts/boss-art/ride-gif.ts", id!], { cwd: ROOT, env: bareEnv(), timeout: 300_000, stdio: "pipe" });
        made.push(relative(ROOT, join(dir, "ride.gif")));
      } catch (e) {
        made.push(`ride.gif: ${String((e as { stderr?: Buffer }).stderr ?? e).slice(0, 300)}`);
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
  // Adding views: whether the side view came through unchanged (done checks it; a run that stopped early may not have).
  const side = VIEWS && existsSync(DRAFT) ? sideCheck(true) : null;
  // Adding a trail: the same for its frames and its mark; the frames that changed go to preview/trail-check.png.
  const trail = TRAIL && existsSync(DRAFT) ? trailCheck() : null;
  if (trail?.file && existsSync(trail.file)) execFileSync("cp", [trail.file, join(OUT, "preview", "trail-check.png")]);
  const removed = trail?.removed?.length ? `taken out of ${trail.removed.length} frame pictures (${trail.removed.slice(0, 6).join("; ")}${trail.removed.length > 6 ? "; …" : ""}; preview/trail-check.png)` : "nothing taken out of its frames";
  const summary = [
    `# Boss art${MODE === "boss" ? "" : ` (${VIEWS ? "rider views" : TRAIL ? "rider trail" : MODE})`}: ${id}`,
    "",
    `- Model ${MODEL}, effort ${EFFORT}, adaptive thinking. ${spent.turns} turns, ${looks} renders.`,
    `- Spend: **$${spent.usd.toFixed(2)}** of the $${CAP} cap (${spent.input.toLocaleString("en-US")} input, ${spent.cacheWrite.toLocaleString("en-US")} cache-write, ${spent.cacheRead.toLocaleString("en-US")} cache-read, ${spent.output.toLocaleString("en-US")} output tokens).`,
    stopped ? `- **Stopped early:** ${stopped}.` : "- Finished: it called done.",
    `- The drawing: ${relative(ROOT, DRAFT)}${existsSync(DRAFT) ? "" : " (none written)"}.`,
    ...(VIEWS ? [`- The side view: ${side ? `**${side}** (the original: ${relative(ROOT, ORIG)})` : "unchanged, and the front and back views are drawn"}.`] : []),
    ...(trail ? [`- The trail: ${trail.ok ? `its mark ${JSON.stringify(trail.trail ?? {})}; ${removed}, the rest of every frame unchanged` : `**${trail.problems.join("; ")}** (the original: ${relative(ROOT, ORIG)})`}.`] : []),
    `- Previews: ${preview || "none"}. Each look it took: ${relative(ROOT, LOOKS)}/.`,
    "",
    "## Its notes",
    "",
    doneNotes ?? "(none: it didn't call done)",
    "",
  ].join("\n");
  writeFileSync(join(OUT, `${RUN}summary.md`), summary);
  console.log(`\n${summary}`);
}

main().catch((e: unknown) => {
  // Never prints the key: the SDK's errors carry no headers.
  console.error(`boss-art failed: ${e instanceof Error ? e.message : String(e)} ${spendLine()}`);
  process.exit(1);
});
