// The stills for Eric (Nov 5, round 2: Relay on 3 boards and a cleaner match screen), against a running server with the
// test switches on (npx wrangler dev --var SQUADS_TEST:1 --var TEST_SWITCHES:1 ...):
//   node scripts/stills-squads-three-boards.mjs <out-dir> [url=http://localhost:8787] [only]
// A phone (iPhone 13/15, 390 × 844) is shot as Safari shows the page with its bars (the page 390 × 664 between the status
// bar and the browser bar, both drawn round it), and a computer at 1440 × 900. Each still is a Relay test lobby played
// with real taps; finished boards (the tiny boards' checks) are set on this device's copy of the match, a mockup.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { Chess } from "chess.js";

const [out = ".", url = "http://localhost:8787", only = ""] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();

const PHONE = { w: 390, h: 844, page: 664, top: 47 };

async function open(kind, extra = "", scheme = "light") {
  const phone = kind === "phone";
  const ctx = await b.newContext(
    phone
      ? { ...devices["iPhone 13"], viewport: { width: PHONE.w, height: PHONE.page }, colorScheme: scheme }
      : { viewport: { width: 1440, height: 900 }, colorScheme: scheme },
  );
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  await p.addInitScript(() => {
    try {
      localStorage.setItem("brc.name", "Tess");
    } catch {}
  });
  await p.goto(`${url}/squads/test/relay?nolanding&debug&clock=180,30,2,2,60&seat=white&mode=classic${extra}`);
  await p.getByRole("button", { name: "Skip votes" }).click({ timeout: 60_000 });
  return { ctx, p, phone };
}

const seen = (p) =>
  p.evaluate(() => {
    const s = window.squads;
    const m = s ? [...s.matches.values()].find((x) => x.state !== "over" && x.sides.some((sd) => sd.seats.includes(s.myId))) : null;
    const d = m?.state === "half" ? m.current?.duties.find((x) => x.players.includes(s.myId)) : null;
    return { key: m?.key ?? null, state: m?.state ?? null, seq: m?.current?.seq ?? null, turn: m?.turn ?? null, duty: d ? { board: d.board } : null, fen: d ? m.boards[d.board].fen : null, mine: m ? (m.visible[s.myId] ?? null) : null };
  });

async function until(fn, ms = 120_000) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function nextDuty(p, after = null) {
  return until(async () => {
    const s = await seen(p);
    return s.duty && !s.mine && (after === null || s.seq > after) ? s : null;
  });
}

async function tapSquare(p, sq) {
  const box = await p.locator(".board-area .board-wrap .cg-wrap, .board-area .board-wrap").first().boundingBox();
  const black = await p.locator(".board-area .board-wrap").first().evaluate((el) => el.classList.contains("orientation-black") || !!el.querySelector(".orientation-black"));
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const x = black ? 7 - f : f;
  const y = black ? r : 7 - r;
  await p.mouse.click(box.x + (x + 0.5) * (box.width / 8), box.y + (y + 0.5) * (box.height / 8));
}

async function move(p, fen) {
  const mv = new Chess(fen).moves({ verbose: true }).find((m) => !m.captured && !m.promotion);
  await tapSquare(p, mv.from);
  await tapSquare(p, mv.to);
  await until(async () => (await seen(p)).mine === mv.from + mv.to, 5_000);
}

/** Plays your moves for `n` of your turns (real taps). */
async function play(p, n) {
  let after = null;
  for (let i = 0; i < n; i++) {
    const s = await nextDuty(p, after);
    await move(p, s.fen);
    after = s.seq;
  }
}

/**
 * A mockup: boards finished on this device's copy, drawn again: in your match one your squad won (not yours), in the
 * others a win each way and a draw.
 */
async function finishBoards(p) {
  await p.evaluate(() => {
    const s = window.squads;
    let k = 0;
    for (const m of s.matches.values()) {
      const mineSide = m.sides.findIndex((sd) => sd.seats.includes(s.myId));
      const d = m.current?.duties.find((x) => x.players.includes(s.myId));
      const done = (b, winner) => (b.result = { winner, reason: winner ? "checkmate" : "stalemate" });
      if (mineSide >= 0) {
        const b = m.boards.find((x) => x.id !== d?.board && x.id !== (d?.board ?? -1) + 1) ?? m.boards.find((x) => x.id !== d?.board);
        done(b, b.white === mineSide ? "w" : "b");
        continue;
      }
      const pick = [["w", null, null], [null, "b", null], [null, null, null], [null, "=", "w"]][k++ % 4];
      m.boards.forEach((b, i) => pick[i] && done(b, pick[i] === "=" ? null : pick[i]));
    }
    s.emit();
  });
}

/** Phone: the page between Safari's status bar and browser bar, drawn round it (390 × 844). */
async function frame(p, file, phone) {
  if (!phone) return p.screenshot({ path: file });
  const shot = (await p.screenshot()).toString("base64");
  const dark = await p.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
  const bg = dark ? "#1c1c1e" : "#f2f1ee";
  const ink = dark ? "#fff" : "#111";
  const H = PHONE.top + PHONE.page + 133;
  const pg = await b.newPage({ viewport: { width: PHONE.w, height: H }, deviceScaleFactor: 3 });
  await pg.setContent(`<!doctype html><html><body style="margin:0;width:${PHONE.w}px;height:${H}px;background:${bg};font:600 15px -apple-system,system-ui,sans-serif;color:${ink};position:relative;overflow:hidden">
    <div style="position:absolute;left:0;right:0;top:0;height:${PHONE.top}px;display:flex;align-items:center;justify-content:space-between;padding:0 30px 0 34px;box-sizing:border-box"><span>1:02</span><span style="letter-spacing:2px">▂▄▆ ◠ ▭</span></div>
    <img src="data:image/png;base64,${shot}" style="position:absolute;left:0;top:${PHONE.top}px;width:${PHONE.w}px;height:${PHONE.page}px">
    <div style="position:absolute;left:0;right:0;top:${PHONE.top + PHONE.page}px;bottom:0;background:${bg};display:flex;gap:10px;align-items:flex-start;justify-content:center;padding-top:12px;box-sizing:border-box">
      <span style="width:44px;height:44px;border-radius:22px;border:1px solid #9994;display:grid;place-items:center">‹</span>
      <span style="width:230px;height:44px;border-radius:22px;border:1px solid #9994;display:grid;place-items:center">hunchess.com</span>
      <span style="width:44px;height:44px;border-radius:22px;border:1px solid #9994;display:grid;place-items:center">⧉</span>
    </div></body></html>`);
  await pg.screenshot({ path: file });
  await pg.close();
}

/** Anything below the page's bottom edge (the screen scrolls, or a box runs past it): its selector and how far. */
async function cutOff(p) {
  return p.evaluate(() => {
    const h = innerHeight;
    const out = [];
    if (document.scrollingElement.scrollHeight > h + 1) out.push(`page scrolls ${document.scrollingElement.scrollHeight - h}px`);
    for (const sel of [".board-area", ".sq-to", ".history-nav", ".sq-panel > *"]) for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.height && r.bottom > h + 0.5) out.push(`${sel} ${Math.round(r.bottom - h)}px past`);
    }
    return out;
  });
}

async function shot(p, name, kind) {
  await p.waitForTimeout(350);
  await frame(p, `${out}/${name}-${kind}.png`, kind === "phone");
  const cut = await cutOff(p);
  console.log(name, kind, cut.length ? `CUT: ${cut.join("; ")}` : "nothing cut off");
}

/** The phone's top line, 3× (the replay button's states). */
async function topCrop(p, name) {
  const box = await p.locator(".hud-row").boundingBox();
  const pg = p;
  await pg.screenshot({ path: `${out}/${name}-top-phone.png`, clip: { x: 0, y: Math.max(0, box.y - 4), width: PHONE.w, height: box.height + 8 } });
}

/** The phone's top (the line, the clocks, the tiny boards), 3×. */
async function topOf(p, name, upTo = ".sq-boards") {
  const end = await p.locator(upTo).first().boundingBox();
  await p.screenshot({ path: `${out}/${name}-phone.png`, clip: { x: 0, y: 0, width: PHONE.w, height: Math.ceil(end.y + end.height + 6) } });
}

/** Your row in the turn order of the board on screen: how many move there before you (0: your turn). */
const myPlace = (p) => p.locator(".sq-to-row.you .sq-to-where").textContent().then((t) => (/^Your turn/.test(t) ? 0 : Number(t.match(/\d+/)?.[0] ?? -1)));

const shots = {
  /**
   * The turn order (one queue for the board on screen): your turn (you on top); waiting, third in a board's queue
   * ("Waiting for 2 players"); a board where you're further down (a phone: the top 3 and you; a tap: all 8); the
   * replay button's 3 states; finished boards checked; settings.
   */
  async play(kind) {
    const { ctx, p } = await open(kind);
    await play(p, 1);
    const first = await nextDuty(p);
    await shot(p, "your-turn", kind);
    // The replay button: off (greyed, still), the last 2 (a short trail), all (twice as fast, a longer trail).
    for (const mode of ["off", "two", "all"]) {
      while ((await p.locator(".hud-row .rp-btn").getAttribute("data-mode")) !== mode) await p.locator(".hud-row .rp-btn").click();
      await shot(p, `replay-${mode}`, kind);
      if (kind === "phone") await topOf(p, `replay-${mode}-top`, ".hud-row");
    }
    // Waiting: your move made; each board of your match in turn, until one has you third and one further down.
    const want = { third: false, down: false };
    let s = first;
    for (let round = 0; round < 6 && !(want.third && want.down); round++) {
      await move(p, s.fen);
      await p.waitForTimeout(900);
      for (let i = 0; i < 3 && !(want.third && want.down); i++) {
        const tiny = p.locator(".sq-match.ours button.sq-tiny").nth(i);
        if (!(await tiny.count())) continue;
        await tiny.click();
        await p.waitForTimeout(250);
        const at = await myPlace(p);
        if (at === 2 && !want.third) {
          want.third = true;
          await shot(p, "waiting-third", kind);
        } else if (at >= 4 && !want.down) {
          want.down = true;
          await shot(p, "further-down", kind);
          if (kind === "phone") {
            await p.locator(".sq-to-more").click();
            await shot(p, "further-down-all8", kind);
            await p.locator(".sq-to-more").click();
          }
        }
      }
      if (!(want.third && want.down)) s = await nextDuty(p, s.seq);
    }
    console.log(kind, "found", want);
    // A row's tap: that board at the position after that move.
    await p.locator(".sq-to-row:not(:disabled)").nth(1).click();
    await shot(p, "turn-order-tap", kind);
    // Finished boards (a mockup on this device's copy): a check in the winner's color, ½ for a draw.
    await finishBoards(p);
    if (kind === "phone") await topOf(p, "top-finished");
    else await shot(p, "top-finished", kind);
    // Settings: the gear's list, with Quick board jump.
    await p.locator(".hud-row .mm-more").click();
    await shot(p, "settings", kind);
    await ctx.close();
  },
  /** The coach marks, one at a time (a tap goes on). */
  async coach(kind) {
    const { ctx, p } = await open(kind, "&coach");
    await until(async () => (await p.locator(".cm").count()) > 0, 90_000);
    for (let i = 1; i <= 3; i++) {
      await until(async () => (await p.locator(`.cm[data-mark]`).count()) > 0, 5_000);
      if (i === 3) await p.locator(".cm-never input").check();
      await shot(p, `coach-${i}`, kind);
      await p.locator(".cm-ok").click();
    }
    await ctx.close();
  },
  /** Nothing below the bottom edge on other phones with their browser bars (iPhone 15: 393 × 659; a short Android: 360 × 560). */
  async sizes() {
    for (const [w, h] of [
      [393, 659],
      [360, 560],
      [428, 746],
    ]) {
      PHONE.w = w;
      PHONE.page = h;
      const { ctx, p } = await open("phone");
      await nextDuty(p);
      console.log(`${w}x${h}`, (await cutOff(p)).join("; ") || "nothing cut off");
      if (w === 360) await shot(p, "short-android", "phone");
      await ctx.close();
    }
    PHONE.w = 390;
    PHONE.page = 664;
  },
};

for (const [name, fn] of Object.entries(shots)) {
  if (only && !only.split(",").includes(name)) continue;
  if (name === "sizes") await fn();
  else for (const kind of ["phone", "desktop"]) await fn(kind);
}
await b.close();
