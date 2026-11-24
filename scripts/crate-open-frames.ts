// MOCKUP (claude/crate-open-mockup): the crate opening mockup's GIFs, MP4s (with the sound) and stills.
//   npx tsx scripts/crate-open-frames.ts <out dir> [tiers=common,rare] [sound=spokes] [desk=1] [fps=25] [stills=1] [look=beta]
// Starts the app's dev server, opens /crate-open-preview.html?capture=1, stops the page's clock at every frame (window.__seek),
// screenshots the stage, and joins the frames with ffmpeg: <tier>.gif, and <tier>-<sound>.mp4 with that sound option laid under.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import type { ItemTier } from "@chessroyale/core";
import { renderCrateClip, type CrateSoundOption } from "../packages/app/src/dev/crate-open-sounds.ts";

const [dir = "crate-open", ...args] = process.argv.slice(2);
const arg = (k: string) => args.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
const tiers = (arg("tiers") ?? "common,uncommon,rare,epic,legendary,mythic").split(",") as ItemTier[];
const sounds = (arg("sound") ?? "spokes").split(",") as CrateSoundOption[];
const desk = arg("desk") === "1";
const fps = Number(arg("fps") ?? 25);
const stills = arg("stills") === "1";
const look = arg("look") ?? "beta";
const spin = Number(arg("spin") ?? 2700);
mkdirSync(dir, { recursive: true });

const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5199, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls!.local[0]!;
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: desk ? { width: 1280, height: 800 } : { width: 390, height: 640 }, deviceScaleFactor: stills ? 2 : 1 });
page.on("pageerror", (e) => console.error("page:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("page:", m.text()));

for (const tier of tiers) {
  await page.goto(`${url}crate-open-preview.html?capture=1&tier=${tier}&look=${look}&spin=${spin}${desk ? "&desk=1" : ""}`);
  await page.waitForFunction(() => typeof (window as unknown as { __seek?: unknown }).__seek === "function");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const length = await page.evaluate(() => (window as unknown as { __length: number }).__length);
  const width = await page.evaluate(() => (document.querySelector(".cox-reel-window") as HTMLElement).offsetWidth);
  const stage = page.locator(".cox-stage");
  const name = `${desk ? "computer-" : ""}${tier}`;
  if (stills) {
    // The beats worth a still: mid-spin, the stop, the shake, the burst, the beam, the card.
    const { T } = await import("../packages/app/src/dev/crate-open-sounds.ts").then((m) => m.clipEvents({ option: "spokes", tier, spinMs: spin }));
    const beats: [string, number][] = [["1-spin", T.spinMs * 0.18], ["2-stop", T.stop + 160], ["3-shake", T.burstAt - 60], ["4-burst", T.burstAt + 120], ["5-beam", T.riseAt + 300], ["6-card", length - 100]];
    for (const [b, ms] of beats) {
      await page.evaluate((x) => (window as unknown as { __seek: (n: number) => void }).__seek(x), ms);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await stage.screenshot({ path: join(dir, `${name}-${b}.png`) });
    }
    console.log(`stills ${name}`);
    continue;
  }
  const frames = join(dir, `.frames-${name}`);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames);
  const n = Math.ceil((length / 1000) * fps);
  for (let i = 0; i <= n; i++) {
    await page.evaluate((x) => (window as unknown as { __seek: (n: number) => void }).__seek(x), (i * 1000) / fps);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await stage.screenshot({ path: join(frames, `${String(i).padStart(4, "0")}.png`) });
  }
  const input = ["-framerate", String(fps), "-i", join(frames, "%04d.png")];
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...input, "-vf", `split[a][b];[a]palettegen=max_colors=200:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a`, "-loop", "0", join(dir, `${name}.gif`)]);
  for (const sound of sounds) {
    const RATE = 48000;
    const x = renderCrateClip(RATE, { option: sound, tier, spinMs: spin, width });
    const wav = join(frames, "sound.wav");
    const b = Buffer.alloc(44 + x.length * 2);
    b.write("RIFF", 0);
    b.writeUInt32LE(36 + x.length * 2, 4);
    b.write("WAVEfmt ", 8);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(RATE, 24);
    b.writeUInt32LE(RATE * 2, 28);
    b.writeUInt16LE(2, 32);
    b.writeUInt16LE(16, 34);
    b.write("data", 36);
    b.writeUInt32LE(x.length * 2, 40);
    for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i]!)) * 32767), 44 + i * 2);
    writeFileSync(wav, b);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...input, "-i", wav, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-af", "apad", "-shortest", join(dir, `${name}-${sound}.mp4`)]);
  }
  rmSync(frames, { recursive: true, force: true });
  console.log(`${name}: ${n + 1} frames, ${(length / 1000).toFixed(1)} s`);
}
await browser.close();
await server.close();
