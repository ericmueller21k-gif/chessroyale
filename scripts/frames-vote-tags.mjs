// MOCKUP (Eric, Nov 25): stills and GIFs of the vote zones' name tags (VoteZoneTags.tsx, ?votetags=a|b|c) on a solo 50 v 50's
// first vote. For each look: a still at the tags' peak on a phone (iPhone 13) and a computer (1280 x 800), light and dark, and a
// GIF of its 3 s (the phone, the board's area), stepped frame by frame through the tags' own animation (paused: exact timing).
//   node scripts/frames-vote-tags.mjs <out-dir> [looks=a,b,c] [side=w|b|any] [vote=1]
// With vote 2 or 3 (the longer names: Random opening, Bullet 3+2): that vote's still on the phone (dark) only.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";

const [out = ".", looksArg = "a,b,c", want = "w", voteArg = "1"] = process.argv.slice(2);
const voteNo = Number(voteArg);
const looks = looksArg.split(",");
mkdirSync(out, { recursive: true });
const server = await createServer({
  root: "packages/app",
  configFile: "packages/app/vite.config.ts",
  server: { port: 5199 },
  logLevel: "error",
});
await server.listen();
const url = server.resolvedUrls.local[0];
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

/** The tags' peak on each look (ms from the vote's start): all fully in (C: the last zone at its brightest). */
const PEAK = { a: 1500, b: 1500, c: 1400 };
const GIF_STEP = 50;
/** The GIF runs to this long after the vote opens (ms): the tags' 3 s and a beat after. */
const VOTE_TAG_END = 3700;

const PLATFORMS = {
  phone: { ...devices["iPhone 13"] },
  computer: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
};

async function openVote(platform, scheme, look, dsf, live = false) {
  const ctx = await b.newContext({
    ...PLATFORMS[platform],
    ...(dsf ? { deviceScaleFactor: dsf } : {}),
    colorScheme: scheme,
  });
  // (The first-time "Drag your pawn into a zone" hint: seen, so these show only the tags.)
  // (And the first-time walkthrough, as e2e/helpers.ts sets it.)
  await ctx.addInitScript(() => {
    localStorage.setItem("brc.voteHintSeen", "1");
    localStorage.setItem("hunchess.tutorial.dismissed", "1");
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  const frames = [];
  let cdp = null;
  const phase = () => p.evaluate(() => window.match?.phase.kind ?? "none").catch(() => "?");
  for (let attempt = 0; attempt < 12; attempt++) {
    await p.goto(url + `?debug&nolanding&mode=crowd&augments=1&pace=quick&votetags=${look}${live ? "" : "&votetaghold"}`);
    await p.getByRole("radio", { name: /^Bots/ }).click();
    await p.getByRole("button", { name: "PLAY", exact: true }).click();
    // (The Bot level box: Medium, as e2e/helpers.ts startBotLevel.)
    const box = p.getByRole("dialog", { name: "Bot level" });
    await box.waitFor();
    const ok = box.getByRole("button", { name: "OK", exact: true });
    if (await ok.isDisabled()) await box.getByRole("radio", { name: /^Medium/ }).click();
    await p.locator("html[data-match-chunk]").waitFor({ state: "attached", timeout: 30_000 });
    // (Live, for the GIF: every painted frame from here, Chrome's screencast, with its time.)
    if (live) {
      frames.length = 0;
      cdp ??= await ctx.newCDPSession(p);
      await cdp.send("Page.stopScreencast").catch(() => undefined);
      cdp.removeAllListeners("Page.screencastFrame");
      cdp.on("Page.screencastFrame", async (f) => {
        frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
        await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
      });
      await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
    }
    await ok.click();
    for (let i = 0; i < 600 && (await phase()) !== "vote"; i++) await p.waitForTimeout(50);
    if ((await phase()) !== "vote") await p.screenshot({ path: join(out, "stuck.png") });
    const side = await p.evaluate(() => window.match.standings().find((s) => s.isYou).team);
    if (want === "any" || side === want) break;
  }
  // (A later vote: wait for it to open.)
  await p.waitForFunction(
    (n) => window.match?.phase.kind === "vote" && window.match.phase.vote.index === n && window.match.phase.vote.result === null,
    voteNo - 1,
    { timeout: 60_000 },
  );
  await p.locator(".vote-tags .vt").first().waitFor();
  if (live) return { ctx, p, cdp, frames, shownAt: Date.now() };
  // Pause the tags' animations; step them by hand from here (`at(t)`: t ms from the vote's start).
  await p.evaluate(() => {
    const anims = document.getAnimations().filter((a) => a.effect?.target?.closest?.(".vote-tags"));
    const base = Math.min(...anims.map((a) => a.effect.getTiming().delay));
    for (const a of anims) a.pause();
    window.__tagsAt = (t) => {
      for (const a of anims) a.currentTime = Math.max(0, t + base);
    };
  });
  const at = (t) => p.evaluate((t) => window.__tagsAt(t), t);
  return { ctx, p, at };
}

for (const look of looks) {
  if (voteNo > 1) {
    const { ctx, p, at } = await openVote("phone", "dark", look);
    await at(PEAK[look]);
    await p.waitForTimeout(120);
    const file = join(out, `${look}-phone-dark-vote${voteNo}${want === "b" ? "-black" : ""}.png`);
    await p.screenshot({ path: file });
    console.log("still", file);
    await ctx.close();
    continue;
  }
  for (const platform of ["phone", "computer"])
    for (const scheme of ["light", "dark"]) {
      const { ctx, p, at } = await openVote(platform, scheme, look);
      await at(PEAK[look]);
      await p.waitForTimeout(120);
      const file = join(out, `${look}-${platform}-${scheme}.png`);
      await p.screenshot({ path: file });
      console.log("still", file);
      await ctx.close();
    }
  // The GIF: the phone (dark), its board's area, live (real time: the crowd's pawns gliding in as they do), from just before the vote
  // shows to just after the tags' 3 s, resampled to an even 20 frames a second.
  const { ctx, p, cdp, frames, shownAt } = await openVote("phone", "dark", look, 2, true);
  const startsAt = await p.evaluate(() => window.match.phase.vote.startsAt);
  const box = await p.locator(".board-wrap").first().boundingBox();
  const until = startsAt + VOTE_TAG_END;
  while (Date.now() < until) await p.waitForTimeout(100);
  await cdp.send("Page.stopScreencast");
  await ctx.close();
  const dir = join(out, `.gif-${look}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let n = 0;
  // (From the vote's screen: not before its tags are on it, nor the lobby's last frames.)
  for (let t = Math.max(startsAt - 300, shownAt + 150); t <= until; t += GIF_STEP) {
    const f = frames.filter((x) => x.t <= t).pop() ?? frames[0];
    writeFileSync(join(dir, `f${String(n++).padStart(4, "0")}.png`), Buffer.from(f.data, "base64"));
  }
  // (The board's area as shares of the frame: the screencast's frames needn't be at the device's scale.)
  const H = PLATFORMS.phone.viewport.height;
  const y = Math.max(0, box.y - 50) / H;
  const h = Math.min(1 - y, (box.height + 60) / H);
  const gif = join(out, `${look}-fade.gif`);
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    String(1000 / GIF_STEP),
    "-i",
    join(dir, "f%04d.png"),
    "-vf",
    `crop=iw:trunc(ih*${h.toFixed(4)}/2)*2:0:trunc(ih*${y.toFixed(4)}),scale=390:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=160[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4`,
    "-loop",
    "0",
    gif,
  ]);
  rmSync(dir, { recursive: true, force: true });
  console.log("gif", gif);
}
await b.close();
await server.close();
