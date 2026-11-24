// The crate opening (crate-open/) on its preview page (packages/app/crate-open-preview.html: the game's own CrateOpening, a fake roll):
//   npx tsx scripts/crate-open-frames.ts <out dir> [tier=epic] [look=beta] [stills=1] [video=1] [frames=1] [w=390] [h=844]
// stills=1: the opening's beats (spin, stop, shake, burst, beam, card) as PNGs, its clock stopped at each (window.__seek), 2x.
// frames=1: every 1/30 s of it as PNGs (to watch it frame by frame), 1x.
// video=1: the whole opening played in real time (Legendary and Mythic through Fischer Random, as in the game), recorded, with the
// sound the page played laid under it (the opening's cues as the page logged them, made here by the same code, and the banner's
// sample), joined with ffmpeg into <tier>.mp4.
// (Box-path tiers seek; Fischer Random's banner and second strip run on timers, so its whole run is the video's.)
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { timeline } from "../packages/app/src/crate-open/timeline.ts";
import { crateSound } from "../packages/app/src/crate-open/sounds.ts";

const [dir = "crate-open", ...args] = process.argv.slice(2);
const arg = (k: string) => args.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
const tier = arg("tier") ?? "epic";
const look = arg("look") ?? "beta";
const size = { width: Number(arg("w") ?? 390), height: Number(arg("h") ?? 844) };
mkdirSync(dir, { recursive: true });

const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5199, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls!.local[0]!;
const exe = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ executablePath: exe, args: ["--autoplay-policy=no-user-gesture-required"] });
const T = timeline();

async function seekRun(scale: number) {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: scale });
  page.on("pageerror", (e) => console.error("page:", e.message));
  await page.goto(`${url}crate-open-preview.html?capture=1&tier=${tier}&look=${look}&fischer=0&delay=0`);
  await page.waitForFunction(() => ((globalThis as { __crateAnims?: unknown[] }).__crateAnims ?? []).length > 0);
  await page.evaluate(() => document.fonts.ready);
  const at = async (ms: number, file: string) => {
    await page.evaluate((m) => (window as unknown as { __seek: (ms: number) => void }).__seek(m), ms);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: join(dir, file) });
  };
  return { page, at };
}

if (arg("stills") === "1") {
  const { page, at } = await seekRun(2);
  const beats: [string, number][] = [
    ["1-spin", T.spinMs * 0.3],
    ["2-stop", T.stop + 40],
    ["3-shake", T.burstAt - 60],
    ["4-burst", T.burstAt + 90],
    ["5-beam", T.riseAt + 300],
    ["6-card", T.cardAt + T.cardMs + 600],
  ];
  for (const [name, ms] of beats) await at(ms, `${tier}-${name}.png`);
  await page.close();
}

if (arg("frames") === "1") {
  const { page, at } = await seekRun(1);
  const sub = join(dir, `${tier}-frames`);
  mkdirSync(sub, { recursive: true });
  for (let i = 0, ms = 0; ms <= T.cardAt + T.cardMs + 300; i++, ms = (i * 1000) / 30) await at(ms, `${tier}-frames/${String(i).padStart(4, "0")}.png`);
  await page.close();
}

if (arg("video") === "1") {
  const vdir = join(dir, "video-tmp");
  rmSync(vdir, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: vdir, size } });
  // (What the page played, and when on its clock: the opening's cues (sound.ts playCrateCues) and the game's sounds by name.)
  // (A string, not a function: tsx's helpers aren't in the page.)
  await ctx.addInitScript(
    "globalThis.__crateCues = []; globalThis.__soundAt = []; globalThis.__soundLog = Object.assign([], { push: (...x) => (x.forEach((n) => globalThis.__soundAt.push([n, performance.now()])), 0) });",
  );
  // (A first visit lets the dev server finish optimizing its dependencies, which reloads the page once.)
  const warm = await browser.newPage();
  await warm.goto(`${url}crate-open-preview.html?tier=${tier}&delay=0`);
  await warm.waitForTimeout(1500);
  await warm.locator(".cox-play").click();
  await warm.waitForTimeout(5000);
  await warm.close();
  const videoStart = Date.now();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("page:", e.message));
  await page.goto(`${url}crate-open-preview.html?tier=${tier}&look=${look}&delay=250`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const tap = Date.now();
  await page.locator(".cox-play").click();
  await page.locator(".cox-card.reveal-card").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1800);
  const played = await page.evaluate(() => {
    const g = globalThis as unknown as { __crateCues: { at: number; list: { at: number; sound: string }[] }[]; __soundAt: [string, number][] };
    return { origin: performance.timeOrigin, cues: g.__crateCues, sounds: g.__soundAt };
  });
  console.log(`${played.cues.length} cue lists, sounds: ${played.sounds.map((x) => x[0]).join(", ")}`);
  await page.close();
  await ctx.close();
  const webm = readdirSync(vdir).find((f) => f.endsWith(".webm"))!;
  renameSync(join(vdir, webm), join(vdir, "picture.webm"));
  const out = join(dir, `${tier}${size.width >= 1024 ? "-computer" : ""}.mp4`);
  // From just before the tap to the end. The sound made offline the way the page played it: every cue list at its time, and the
  // banner's sample (FISCHER RANDOM!) where it played, all at 48 kHz on the page's clock, placed on the video's.
  const from = Math.max(0, (tap - videoStart) / 1000 - 0.4);
  const rate = 48000;
  const toVideo = (pageMs: number) => (played.origin + pageMs - videoStart) / 1000;
  const length = 40;
  const mixd = new Float32Array(rate * length);
  const add = (src: Float32Array, atS: number, gain = 1) => {
    const o = Math.round(atS * rate);
    for (let i = 0; i < src.length; i++) if (o + i >= 0 && o + i < mixd.length) mixd[o + i]! += src[i]! * gain;
  };
  for (const c of played.cues) for (const q of c.list) add(crateSound(q.sound, rate), toVideo(c.at + q.at));
  for (const [name, at] of played.sounds) {
    if (!name.startsWith("bannerStart")) continue;
    const raw = execFileSync("ffmpeg", ["-loglevel", "error", "-i", "packages/app/public/sounds/banner/start.mp3", "-f", "f32le", "-ac", "1", "-ar", String(rate), "-"]);
    add(new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4), toVideo(at), 0.9);
  }
  writeFileSync(join(vdir, "sound.f32"), Buffer.from(mixd.buffer));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(vdir, "picture.webm"), "-f", "f32le", "-ar", String(rate), "-ac", "1", "-i", join(vdir, "sound.f32"), "-ss", from.toFixed(3), "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-shortest", out]);
  rmSync(vdir, { recursive: true, force: true });
  console.log(`wrote ${out}`);
}

await browser.close();
await server.close();
