// Frame-by-frame check of the queue's pops (see .claude/LESSONS.md): people's pawns popping into their seats,
// several at once (staggered), then the bots' cascade when the fill time runs out.
//   npm run frames:queue -- <out-dir> [base url, default http://localhost:8788]
// Needs the Worker running (npx wrangler dev --port 8788 --var MATCH_FILL_SECONDS:20 ...). Animations are slowed
// 10× so each 0.35 s pop spans many frames. Saves a PNG of the grid every ~100 ms (35 ms of animation time each), a
// timeline of every seat's scale per frame (timeline.txt: look for a scale past 1 that settles back to 1, and for
// any seat that pops twice), and a strip of the first pop (strip.png, with ImageMagick).
import { chromium, devices } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const [out = "queue-frames", base = "http://localhost:8788"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"], colorScheme: "dark" });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.goto(base + "/?debug");
await p.getByRole("button", { name: "PLAY", exact: true }).click();
await p.locator(".fd-seats").waitFor();
const cdp = await ctx.newCDPSession(p);
await cdp.send("Animation.enable");
await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.1 });

const lines = [];
let n = 0;
const t0 = Date.now();
async function snap(label) {
  const seats = await p.evaluate(() =>
    [...document.querySelectorAll(".fd-seat")].map((s) => {
      const pawn = s.querySelector(".fd-pawn");
      if (!pawn) return ".";
      const m = getComputedStyle(pawn).transform;
      const scale = m === "none" ? 1 : Number(m.match(/matrix\(([^,]+)/)?.[1] ?? 1);
      return scale.toFixed(2);
    }),
  );
  const file = `${out}/f${String(n++).padStart(4, "0")}.png`;
  await p.locator(".fd-queue-panel").screenshot({ path: file });
  const filled = seats.filter((s) => s !== ".");
  lines.push(`${String(Date.now() - t0).padStart(6)} ms  ${label.padEnd(10)} seats ${filled.length}  scales ${filled.slice(0, 12).join(" ")}  ${file}`);
}
async function frames(ms, label) {
  const until = Date.now() + ms;
  while (Date.now() < until) await snap(label);
}
// Your own pawn pops first.
await frames(4500, "you");
// One joins, then two at once.
const others = [];
for (const group of [[1], [2, 3]]) {
  await Promise.all(
    group.map(async () => {
      const o = await (await b.newContext()).newPage();
      await o.goto(base + "/");
      await o.getByRole("button", { name: "PLAY", exact: true }).click();
      others.push(o);
    }),
  );
  await frames(5000, group.length > 1 ? "two" : "one");
}
// The fill: bots cascade in. The server begins the match 1.8 s later whatever the animations do, so this part runs
// at real speed: frames as fast as they can be taken until the queue gives way to the match.
await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
await p.waitForFunction(() => window.match?.filledAt, null, { timeout: 60_000 });
try {
  await frames(4000, "bots");
} catch {
  lines.push("(the match began: the queue screen is gone)");
}
writeFileSync(`${out}/timeline.txt`, lines.join("\n") + "\n");
console.log(lines.slice(0, 60).join("\n"));
try {
  const first = Array.from({ length: 12 }, (_, i) => `${out}/f${String(i * 3).padStart(4, "0")}.png`);
  execFileSync("montage", [...first, "-tile", "12x1", "-geometry", "+2+2", "-background", "#14161b", `${out}/strip.png`]);
  console.log("strip", `${out}/strip.png`);
} catch {
  console.log("(no ImageMagick: no strip)");
}
await b.close();
