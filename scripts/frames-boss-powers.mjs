// Boss powers frame by frame, on a phone and a computer: a solo raid against a boss with its ultimate brought early
// (?power=), played with real taps. Records every frame the browser paints (Chrome's screencast) around each power's
// moment (the passive and the warning as the second turn begins, the ultimate on the third), saves stills and a GIF of
// each moment, and prints a timeline of phases and moments.
//   npm run frames:powers -- <out-dir> [gingerbread|clown|both] [phone|desktop|both] [light|dark]
// Read the frames before calling a power done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const [out = "power-frames", bossArg = "both", which = "both", scheme = "light"] = process.argv.slice(2);
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
process.chdir("packages/app");
const server = await createServer({ root: ".", configFile: "vite.config.ts", server: { port: 5197, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const ULT = { gingerbread: "blizzard", clown: "funhouse" };

async function run(boss, name, context) {
  const tag = `${boss}-${name}`;
  const p = await browser.newPage({ ...context, colorScheme: scheme });
  p.on("pageerror", (e) => console.log(tag, "pageerror", e.message));
  const cdp = await p.context().newCDPSession(p);
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
  });
  await p.goto(`${url}?debug&clock=60&nolanding&boss=${boss}&power=${ULT[boss]}`);
  await p.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  const t0 = Date.now();
  const phase = () => p.evaluate(() => window.match?.phase.kind ?? null);
  const state = () =>
    p.evaluate(() => {
      const m = window.match;
      const b = m?.boss;
      return { kind: m?.phase.kind, until: m?.phase.until ?? 0, events: b?.powers?.events ?? [], turn: b?.powers?.turn, now: Date.now(), flipped: !!b?.powers?.flipped };
    });
  const waitFor = async (want, ms = 90_000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (want.includes(await phase())) return true;
      await p.waitForTimeout(100);
    }
    return false;
  };
  /** One crowd move, played with two taps (an allowed move: pieces first, a capture if there's one). */
  const move = async () => {
    await waitFor(["play"]);
    await p.locator(".cc-banner", { hasText: "Round start" }).waitFor({ state: "detached", timeout: 15000 }).catch(() => undefined);
    await p.waitForTimeout(500);
    const { allowed, fen, orientation } = await p.evaluate(() => {
      const m = window.match;
      const fen = m.phase.board.fen;
      return { allowed: m.boss?.powers?.allowed ?? null, fen, orientation: document.querySelector(".cg-wrap")?.classList.contains("orientation-black") ? "black" : "white" };
    });
    const options = allowed ?? new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
    const pick = options[Math.floor(options.length / 3)] ?? options[0];
    if (!pick) return;
    const board = await p.locator("cg-board").first().boundingBox();
    const flip = orientation === "black";
    const at = (s) => {
      const f = s.charCodeAt(0) - 97;
      const r = Number(s[1]) - 1;
      return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
    };
    // Two taps; again if the board wasn't taking moves yet.
    for (let tries = 0; tries < 8 && (await phase()) === "play"; tries++) {
      await p.mouse.click(at(pick.slice(0, 2)).x, at(pick.slice(0, 2)).y);
      await p.mouse.click(at(pick.slice(2, 4)).x, at(pick.slice(2, 4)).y);
      await p.waitForTimeout(400);
    }
    console.log(`${tag} +${Date.now() - t0}ms played ${pick}${allowed ? ` (of ${allowed.length} allowed)` : ""}, now ${await phase()}`);
  };
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 80, everyNthFrame: 1 });
  const marks = [];
  // Three crowd moves (or four, to see the board flipped after the funhouse), watching each boss screen's moments.
  for (let i = 0; i < 4; i++) {
    await move();
    for (let k = 0; k < 400; k++) {
      const s = await state();
      if (s.kind === "boss" && s.events.length && s.until > s.now) {
        const key = `${s.turn}:${s.events.map((e) => e.kind).join("+")}`;
        if (!marks.some((m) => m.key === key)) {
          marks.push({ key, from: s.now - 600, to: s.until + 300, kinds: s.events.map((e) => e.kind) });
          console.log(`${tag} +${s.now - t0}ms boss screen with ${key}, until +${s.until - t0}ms`);
        }
      }
      if (s.kind === "play") break;
      await p.waitForTimeout(80);
    }
    await p.screenshot({ path: join(outDir, `${tag}-play-${i + 1}.png`) });
  }
  await cdp.send("Page.stopScreencast");
  // Each moment: its frames, a few stills and a GIF.
  for (const m of marks) {
    const name = `${tag}-${m.kinds.join("+")}`;
    const dir = join(outDir, `${name}-frames`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const list = frames.filter((f) => f.t >= m.from && f.t <= m.to);
    list.forEach((f, i) => writeFileSync(join(dir, `${String(i).padStart(4, "0")}.jpg`), Buffer.from(f.data, "base64")));
    // Stills a quarter of the way through each part.
    for (const q of [0.15, 0.35, 0.55, 0.75, 0.92]) {
      const f = list[Math.floor(q * (list.length - 1))];
      if (f) writeFileSync(join(outDir, `${name}-${Math.round(q * 100)}.jpg`), Buffer.from(f.data, "base64"));
    }
    if (list.length > 2) {
      const dur = (list[list.length - 1].t - list[0].t) / 1000;
      const fps = Math.max(5, Math.min(30, Math.round(list.length / Math.max(0.1, dur))));
      try {
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "%04d.jpg"), "-vf", `fps=15,scale=${name.includes("desktop") ? 720 : 390}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse`, join(outDir, `${name}.gif`)]);
      } catch (e) {
        console.log("gif failed", e.message);
      }
    }
    console.log(`${tag} ${m.key}: ${list.length} frames`);
  }
  await p.close();
}

for (const boss of bossArg === "both" ? ["gingerbread", "clown"] : [bossArg]) {
  if (which !== "desktop") await run(boss, "phone", { ...devices["iPhone 13"] });
  if (which !== "phone") await run(boss, "desktop", { viewport: { width: 1440, height: 900 } });
}
await browser.close();
await server.close();
