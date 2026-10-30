/**
 * The runner's eyes in item and rider modes, run as its own process for each look (run.ts starts it with no API key in
 * its environment, since it runs the drawing the model wrote): it bundles item-harness.tsx with the draft (esbuild),
 * shows it in Chromium and screenshots it.
 *   npx tsx scripts/boss-art/item-render.ts '<json request>'
 * The request: { draft, mode: "item" | "rider", frames?, anim?, side?, color?, all?, out }. Prints one line of JSON: the
 * picture (`<out>/look.png`, never over 1500 px wide or tall unless `all`), the facts and the warnings, or { error }.
 */
import { build } from "esbuild";
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface Req {
  /** The drawing (item and rider modes). */
  draft?: string;
  /** The contact sheet: every drawing, the colors to show them in, existing items too, a title. */
  drafts?: string[];
  colors?: Record<string, string>;
  extra?: { def: string; label: string; color?: string }[];
  title?: string;
  looks?: { id: string; color: string; over?: string; label: string }[];
  mode: "item" | "rider" | "sheet";
  frames?: number[];
  anim?: "idle" | "move";
  side?: "w" | "b";
  color?: string;
  all?: boolean;
  out: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
/** The game's shine (styles.css), paused mid-roll so a shiny look shows its band. */
const CSS = `
body { background: #14161b; margin: 0; }
.item-shine { mix-blend-mode: screen; animation: shine-roll 4.2s ease-in-out infinite; animation-delay: -1.4s; animation-play-state: paused; }
@keyframes shine-roll { 0% { transform: translateX(calc(-1 * var(--shine-d))); } 70%, 100% { transform: translateX(var(--shine-d)); } }
`;

async function main(req: Req): Promise<object> {
  const sheet = req.mode === "sheet";
  const draft = resolve(req.draft ?? "");
  let js: string;
  try {
    const out = await build({
      entryPoints: [resolve(HERE, sheet ? "sheet-harness.tsx" : "item-harness.tsx")],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      jsx: "automatic",
      jsxImportSource: "preact",
      logLevel: "silent",
      plugins: [
        {
          name: "draft",
          setup: (b) => {
            b.onResolve({ filter: /^virtual:draft$/ }, () => (sheet ? { path: "none", namespace: "drafts" } : { path: draft }));
            b.onResolve({ filter: /^virtual:drafts$/ }, () => ({ path: "all", namespace: "drafts" }));
            b.onLoad({ filter: /.*/, namespace: "drafts" }, (a) => ({
              contents: a.path === "all" ? (req.drafts ?? []).map((d, i) => `export * as d${i} from ${JSON.stringify(resolve(d))};`).join("\n") : "export {};",
              resolveDir: HERE,
              loader: "ts",
            }));
          },
        },
      ],
    });
    js = out.outputFiles[0]!.text;
  } catch (e) {
    const errs = (e as { errors?: { text: string; location?: { file: string; line: number; lineText: string } }[] }).errors;
    return { error: `the drawing doesn't compile: ${errs ? errs.slice(0, 5).map((x) => `${x.location ? `${x.location.file.split("/").pop()}:${x.location.line}: ` : ""}${x.text}${x.location ? ` | ${x.location.lineText.trim()}` : ""}`).join("\n") : String(e)}` };
  }
  // (The container's Chromium, when this Playwright's own build isn't installed.)
  const browser = await chromium.launch(existsSync(chromium.executablePath()) ? {} : { executablePath: "/opt/pw-browsers/chromium", args: ["--headless", "--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 600 }, deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const reqJson = JSON.stringify({ mode: req.mode, frames: req.frames, anim: req.anim, side: req.side, color: req.color, all: req.all, colors: req.colors, extra: req.extra, title: req.title, looks: req.looks }).replace(/</g, "\\u003c");
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div id="app"></div><script>window.__REQ=${reqJson}</script><script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`);
    await page.waitForFunction(() => (window as unknown as { __DONE?: object }).__DONE, null, { timeout: 30_000 }).catch(() => undefined);
    const done = (await page.evaluate(() => (window as unknown as { __DONE?: object }).__DONE)) as { error?: string; facts?: object; warnings?: string[] } | undefined;
    if (!done || done.error) return { error: done?.error ?? `the page never finished${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}` };
    const size = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
    const file = `${req.out}/look.png`;
    const max = req.all ? 8000 : 1500;
    await page.setViewportSize({ width: Math.min(max, Math.max(400, size.w)), height: Math.min(max, Math.max(200, size.h)) });
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: Math.min(max, size.w), height: Math.min(max, size.h) } });
    const warnings = [...(done.warnings ?? []), ...errors.slice(0, 5).map((e) => `page error: ${e}`)];
    if (size.h > max) warnings.push(`the picture was cut at ${max} px tall (pick fewer frames)`);
    return { file, facts: done.facts, warnings };
  } finally {
    await browser.close();
  }
}

main(JSON.parse(process.argv[2]!) as Req)
  .then((r) => console.log(JSON.stringify(r)))
  .catch((e: unknown) => console.log(JSON.stringify({ error: e instanceof Error ? `${e.message}\n${(e.stack ?? "").split("\n").slice(1, 4).join("\n")}` : String(e) })));
