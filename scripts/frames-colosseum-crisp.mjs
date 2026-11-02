// The Colosseum's Pixel pieces, stills and a GIF (Nov 2; docs/colosseum-crisp3d/): the high view behind White, the start
// position, phone (390 x 844) and computer (1440 x 900), plus a 4x crop of the near rook and knight; and with `gif`, a few
// opening moves sliding, each frame drawn at its own time 1/25 s apart (the test hook `snap(time, box)`), so the GIF plays
// at the page's own pace, not the software renderer's few frames a second.
//   node scripts/frames-colosseum-crisp.mjs <out-dir> <label, e.g. before|after> [stills|gif|both] [phone|desktop|both]
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";

const [out = "crisp-frames", label = "after", what = "stills", which = "both"] = process.argv.slice(2);
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5297, strictPort: false, fs: { allow: [resolve(".")] } }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
const PROFILES = {
  phone: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

async function open(name) {
  const ctx = await browser.newContext(PROFILES[name]);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log(name, "pageerror", e.message));
  await p.addInitScript(() => localStorage.setItem("colosseum-pieces", "pixel"));
  await p.goto(`${url}colosseum`);
  for (let i = 0; i < 400; i++) {
    const s = await p.evaluate(() => window.__colosseum?.state?.() ?? {});
    if (s.backend === "webgl" && s.crowd > 0) break;
    await p.waitForTimeout(100);
  }
  return { ctx, p };
}

/** Where the near rook (a1) and knight (b1) stand on screen (CSS px), from the page's own camera. */
async function cropRect(p) {
  return p.evaluate(() => window.__colosseum?.screenBox?.(["a1", "b1"]) ?? null);
}

async function stills(name) {
  const { ctx, p } = await open(name);
  await p.evaluate((fen) => {
    const h = window.__colosseum;
    h.freeze();
    const out = [];
    fen.split("/").forEach((row, i) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) f += Number(ch);
        else (out.push({ key: (ch === ch.toUpperCase() ? "w" : "b") + ch.toLowerCase(), sq: String.fromCharCode(97 + f) + (8 - i), from: null, taken: false }), f++);
      }
    });
    h.place(out);
  }, START);
  await p.waitForTimeout(1500);
  const file = `${outDir}/${label}-${name}.png`;
  await p.screenshot({ path: file });
  const box = await cropRect(p);
  // The near rook and knight (a1, b1) at 4x, nearest-neighbor, from the screenshot (its device pixels).
  if (box) {
    const k = PROFILES[name].deviceScaleFactor ?? 1;
    const pad = 6;
    const g = `${Math.round((box.w + 2 * pad) * k)}x${Math.round((box.h + 2 * pad) * k)}+${Math.round((box.x - pad) * k)}+${Math.round((box.y - pad) * k)}`;
    execFileSync("convert", [file, "-crop", g, "+repage", "-filter", "point", "-resize", `${400 / k}%`, `${outDir}/${label}-${name}-rook-knight-4x.png`]);
    writeFileSync(`${outDir}/crop-${name}.json`, JSON.stringify(box));
  }
  console.log(name, "still", file, JSON.stringify(await p.evaluate(() => window.__colosseum.state())));
  await ctx.close();
}

/** The start position as the floor's pieces. */
function startPieces() {
  const out = [];
  START.split("/").forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else (out.push({ key: (ch === ch.toUpperCase() ? "w" : "b") + ch.toLowerCase(), sq: String.fromCharCode(97 + f) + (8 - i), from: null, taken: false }), f++);
    }
  });
  return out;
}

/** A few opening moves, each slid as the floor slides them (0.45 s) and held a little, drawn 25 frames a second. */
const MOVES = [["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"], ["f1", "c4"], ["g8", "f6"]];
async function gif(name) {
  const { ctx, p } = await open(name);
  const dir = `${outDir}/${label}-${name}-gif`;
  mkdirSync(dir, { recursive: true });
  let pieces = startPieces();
  await p.evaluate((ps) => (window.__colosseum.freeze(), window.__colosseum.place(ps)), pieces);
  await p.waitForTimeout(500);
  // The board and a little round it, in the canvas's pixels (the arena alone: the overlay isn't in a snap).
  const crop = await p.evaluate(() => {
    const h = window.__colosseum;
    h.snap();
    const b = h.screenBox(["a1", "h1", "a8", "h8"]);
    const cv = document.querySelector("canvas");
    const r = cv.getBoundingClientRect();
    const k = cv.width / r.width;
    const pad = 0.04 * b.w;
    const x = Math.max(0, Math.round((b.x - r.left - pad) * k));
    const y = Math.max(0, Math.round((b.y - r.top - pad) * k));
    return { x, y, w: Math.min(cv.width - x, Math.round((b.w + 2 * pad) * k)) & ~1, h: Math.min(cv.height - y, Math.round((b.h + 2 * pad) * k)) & ~1 };
  });
  let n = 0;
  const shot = async (t) => {
    const url = await p.evaluate(([t, crop]) => window.__colosseum.snap(t, crop), [t, crop]);
    writeFileSync(`${dir}/f${String(n++).padStart(3, "0")}.png`, Buffer.from(url.split(",")[1], "base64"));
  };
  let t = 100;
  for (let i = 0; i < 10; i++) await shot((t += 0.04));
  for (const [from, to] of MOVES) {
    pieces = pieces.map((q) => (q.sq === from ? { ...q, sq: to, from } : { ...q, from: null }));
    const t0 = t;
    await p.evaluate(([ps, t0]) => window.__colosseum.place(ps, t0), [pieces, t0]);
    for (let i = 0; i < 20; i++) await shot((t += 0.04));
  }
  try {
    const gif = `${outDir}/${label}-${name}.gif`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "25", "-i", `${dir}/f%03d.png`, "-vf", "split[a][b];[a]palettegen=max_colors=256[p];[b][p]paletteuse=dither=none", gif]);
    console.log(name, "gif", gif, n, "frames");
  } catch (e) {
    console.log("ffmpeg failed", e.message);
  }
  await ctx.close();
}

for (const name of which === "both" ? ["phone", "desktop"] : [which]) {
  if (what !== "gif") await stills(name);
  if (what !== "stills") await gif(name);
}
await browser.close();
await server.close();
