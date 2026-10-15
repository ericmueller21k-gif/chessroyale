// Records every frame the browser paints while you resign (Resign and leave: components/MatchMenu.tsx): a phone's
// "⋯", its sheet, the confirm, Cancel, then Resign for real; a computer's flag and its confirm. In the page, every
// animation frame logs where the sheet or confirm is against the board and the line above it (the move's count and
// clock): nothing may cover them, and the board mustn't move. Flags frames that blink (a jump in brightness).
//   npm run frames:resign -- <out-dir> [phone|desktop|both] [dark|light|both] [boss|crowd] [base-url]
// The base URL is a running Worker (npx wrangler dev --var TEST_SWITCHES:1, http://localhost:8787 by default): the built app.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import sharp from "sharp";

const [out = ".", which = "both", schemes = "both", mode = "boss", base = "http://localhost:8787"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const layouts = which === "both" ? ["phone", "desktop"] : [which];
const colors = schemes === "both" ? ["dark", "light"] : [schemes];
let problems = 0;

for (const layout of layouts) {
  for (const scheme of colors) {
    const tag = `${mode}-${layout}-${scheme}`;
    const dir = `${out}/${tag}`;
    mkdirSync(dir, { recursive: true });
    const opts = layout === "phone" ? { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } : { viewport: { width: 1280, height: 800 } };
    const ctx = await b.newContext({ ...opts, colorScheme: scheme });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => console.log("pageerror", e.message));
    if (mode === "boss") {
      await p.goto(`${base}/?debug&nolanding&clock=60&boss=gingerbread`);
      await p.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
    } else {
      await p.goto(`${base}/?debug&nolanding&pace=quick&mode=crowd&rounds=2&clock=30&augments=0`);
      await p.getByRole("radio", { name: /^Solo/ }).click();
      await p.getByRole("button", { name: "PLAY", exact: true }).click();
    }
    await p.waitForFunction(() => window.match?.phase.kind === "play", null, { timeout: 90_000 });
    await p.waitForTimeout(1500);
    // In the page: every frame, the boxes that matter.
    await p.evaluate(() => {
      const box = (sel) => {
        const e = document.querySelector(sel);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return r.width && r.height ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
      };
      window.__mmLog = [];
      const loop = () => {
        window.__mmLog.push({
          t: performance.now(),
          phase: window.match?.phase.kind,
          sheet: box(".mm-sheet"),
          confirm: box(".mm-confirm"),
          board: box(".board-area .hb"),
          above: box(".board-area .opening-name"),
          control: box(".hud-row .mm"),
        });
        if (window.__mmLog.length < 4000) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    const frames = [];
    const cdp = await ctx.newCDPSession(p);
    cdp.on("Page.screencastFrame", async (f) => {
      frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
      await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, everyNthFrame: 1 });
    const step = async (what, fn) => {
      await fn();
      await p.waitForTimeout(450);
      console.log(`${tag}: ${what}`);
    };
    if (layout === "phone") {
      await step("⋯", () => p.getByRole("button", { name: "Match options" }).click());
      await step("Resign in the sheet", () => p.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^Resign$/ }).click());
    } else {
      await step("the flag", () => p.getByRole("button", { name: "Resign", exact: true }).click());
    }
    await step("Cancel", () => p.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click());
    if (layout === "phone") {
      await step("⋯ again", () => p.getByRole("button", { name: "Match options" }).click());
      await step("Resign in the sheet", () => p.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^Resign$/ }).click());
    } else {
      await step("the flag again", () => p.getByRole("button", { name: "Resign", exact: true }).click());
    }
    await step("Resign", () => p.getByRole("alertdialog").getByRole("button", { name: /Resign/ }).click());
    await p.waitForTimeout(800);
    await cdp.send("Page.stopScreencast");
    const log = await p.evaluate(() => window.__mmLog);
    // Overlaps, and the board moving, while the match is on screen.
    const hit = (a, c) => a && c && !(a.x + a.w <= c.x + 1 || c.x + c.w <= a.x + 1 || a.y + a.h <= c.y + 1 || c.y + c.h <= a.y + 1);
    const inPlay = log.filter((f) => f.phase !== "results" && f.board);
    const covered = inPlay.filter((f) => hit(f.sheet, f.board) || hit(f.confirm, f.board) || hit(f.sheet, f.above) || hit(f.confirm, f.above));
    const first = inPlay[0]?.board;
    const moved = inPlay.filter((f) => first && (Math.abs(f.board.x - first.x) > 0.5 || Math.abs(f.board.y - first.y) > 0.5 || Math.abs(f.board.w - first.w) > 0.5));
    const shown = inPlay.filter((f) => f.sheet || f.confirm).length;
    // Blinks: a frame much brighter or darker than the frames either side.
    const lum = [];
    for (const f of frames) {
      const { data } = await sharp(Buffer.from(f.data, "base64")).resize(32, 32).greyscale().raw().toBuffer({ resolveWithObject: true });
      lum.push(data.reduce((s, v) => s + v, 0) / data.length);
    }
    const blinks = lum.flatMap((l, i) => (i > 0 && i < lum.length - 1 && Math.abs(l - lum[i - 1]) > 40 && Math.abs(l - lum[i + 1]) > 40 ? [i] : []));
    frames.forEach((f, i) => writeFileSync(`${dir}/f${String(i).padStart(4, "0")}.jpg`, Buffer.from(f.data, "base64")));
    console.log(`${tag}: ${log.length} animation frames logged (${shown} with the sheet or confirm), ${frames.length} painted; covered ${covered.length}, board moved ${moved.length}, blinks ${blinks.length}; ended on ${log.at(-1)?.phase}`);
    if (covered.length || moved.length || blinks.length || log.at(-1)?.phase !== "results") problems++;
    await ctx.close();
  }
}
await b.close();
console.log(problems ? `${problems} run(s) with problems` : "no problems");
process.exit(problems ? 1 : 0);
