// Frame-by-frame check of Squads' screens, played the way a player plays them (real taps), against a running server
// with the test switch on (npx wrangler dev --var SQUADS_TEST:1 ...):
//   npm run frames:squads -- <out-dir> <relay|pairs|final|block|token|menu|standings|modevote|shop|stockfish|shield|chip|clockvote|clockline> [url=http://localhost:8787] [width=390] [scheme=dark] [clock=rapid]
// relay: your move (it must show at once and never snap back), then scouting a tiny board and back.
// pairs: your pick, lock in, the coin-flip reveal. final: your vote, lock in, the vote's reveal.
// block: from the Scotch recapture, Block, their queen, f6: the arrow draws, keeps redrawing with its lock pulsing,
// through your move and theirs, until they've moved (each frame's arrows are logged too). token: the same move as your
// bot partner there (Qxd4): the same-move reveal and, a few seconds later, the refund.
// menu: the home screen's Squads card and a party with a friend in it. standings: every squad's clock (and sudden death).
// Mercenary: modevote: the Mode vote (Mercenary tapped, Coming soon disabled), its result and the next vote. shop: a
// Mercenary test lobby at Pairs: the shop sliding in, the explainer, two purchases, Hide and the pill, then the match
// starting (the shop going); PNGs of the sheet, also with a wide wallet (12,345). stockfish: a token used on your pick
// (its arrows and lines). shield: a shield bought, the bots blocking whenever they can, the line saying it was canceled.
// chip: a Time chip bought, then tapped on your pick: the "+30 s", the clock jumping and standing still (each frame's
// clock text is logged).
// The time controls (Oct 13): clockvote: the Clock vote's three cards (Bullet, Blitz, Rapid), a tap, the result's banner
// with the winner in full, then the first match's card with its time control. clockline: a Relay test lobby on the
// clock given (an option's id, or "bank,top-up,free,increment,cap"; a small bank shows sudden death and living on the
// increment): the clock line under the board through a few halves. Both log, on every animation frame, the vote cards'
// or the clock line's text and anything sticking out of its box or the screen.
// Every painted frame is recorded (Chrome's screencast); the big board's pieces are logged on every animation frame,
// and the timeline printed: a piece that moves twice, jumps back or flickers shows as an extra change. A GIF of the
// moment goes to <out-dir>/<mode>-<width>.gif (and PNGs for menu and standings). See .claude/LESSONS.md.
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium, devices } from "@playwright/test";
import { Chess } from "chess.js";

const [out = ".", mode = "relay", url = "http://localhost:8787", widthArg = "390", scheme = "dark", clockArg = "rapid"] = process.argv.slice(2);
const W = Number(widthArg);
const phone = W < 900;
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctxOpts = phone
  ? { ...devices["iPhone 13"], viewport: { width: W, height: Math.round((W * devices["iPhone 13"].viewport.height) / devices["iPhone 13"].viewport.width) }, colorScheme: scheme }
  : { viewport: { width: W, height: 800 }, colorScheme: scheme };
const ctx = await b.newContext(ctxOpts);
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.addInitScript(() => {
  try {
    localStorage.setItem("brc.name", "Tess");
  } catch {}
  // The big board's pieces, logged whenever they change (every animation frame).
  const log = (window.__pieces = []);
  let last = "";
  const tick = () => {
    const ps = [...document.querySelectorAll(".board-area .hb-board piece")].map((e) => `${e.className}@${e.style.transform}`).sort().join("|");
    const status = document.querySelector(".sq-status")?.textContent ?? "";
    // Blocked moves' arrows: which, and the first one's dash and lock (to the hundredth: each change is a frame).
    const arrows = [...document.querySelectorAll(".board-area .sq-block-arrow")];
    const first = arrows[0];
    const r2 = (x) => Math.round(Number(x) * 100) / 100;
    const blocks = arrows.length ? `${arrows.map((a) => a.dataset.move).join(",")} dash ${r2(parseFloat(getComputedStyle(first.querySelector(".sq-block-shaft")).strokeDashoffset))} lock ${r2(getComputedStyle(first.querySelector(".sq-block-lock")).opacity)}` : "";
    const key = `${ps}#${status}#${blocks}`;
    if (key !== last) {
      last = key;
      log.push({ t: performance.now() + performance.timeOrigin, n: ps ? ps.split("|").length : 0, ps, status, blocks });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

// ---- Recording ----
let recording = null;
const cdp = await ctx.newCDPSession(p);
cdp.on("Page.screencastFrame", async (f) => {
  if (recording) recording.push({ t: f.metadata.timestamp * 1000, data: f.data });
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
});
async function record(fn) {
  recording = [];
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 80, everyNthFrame: 1 });
  const t0 = Date.now();
  await fn();
  await cdp.send("Page.stopScreencast");
  const frames = recording;
  recording = null;
  return { frames, t0 };
}
/** The frames as a GIF (ffmpeg, from their real timings), and the intermediate JPGs deleted. */
function gif(frames, name, fps = 15) {
  const dir = `${out}/.frames-${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const list = [];
  frames.forEach((f, i) => {
    writeFileSync(`${dir}/f${String(i).padStart(5, "0")}.jpg`, Buffer.from(f.data, "base64"));
    const next = frames[i + 1];
    list.push(`file 'f${String(i).padStart(5, "0")}.jpg'`, `duration ${next ? Math.max(0.001, (next.t - f.t) / 1000).toFixed(3) : "0.5"}`);
  });
  writeFileSync(`${dir}/frames.txt`, list.join("\n") + "\n");
  const scale = phone ? 360 : 960;
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", `${dir}/frames.txt`, "-vf", `fps=${fps},scale=${scale}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, `${out}/${name}.gif`]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`wrote ${out}/${name}.gif (${frames.length} frames)`);
}
/** Frames whose brightness jumps from the one before (a flash between screens). */
async function flashes(frames) {
  const sharp = (await import("sharp")).default;
  const lum = [];
  for (const f of frames) {
    const s = await sharp(Buffer.from(f.data, "base64")).resize(32, 32).greyscale().raw().toBuffer();
    lum.push(s.reduce((a, x) => a + x, 0) / s.length);
  }
  const out = [];
  for (let i = 1; i < lum.length - 1; i++) if (Math.abs(lum[i] - lum[i - 1]) > 30 && Math.abs(lum[i + 1] - lum[i - 1]) < 10) out.push(i);
  return out;
}
let blocksOnly = false;
async function timeline(since) {
  const log = await p.evaluate(() => window.__pieces);
  const rows = log.filter((r) => r.t >= since);
  let prev = null;
  for (const r of rows) {
    const changed = prev && prev.ps !== r.ps ? diff(prev.ps, r.ps) : "";
    if (!changed && prev && prev.status === r.status && !blocksOnly) continue;
    console.log(`${String(Math.round(r.t - since)).padStart(6)} ms  ${String(r.n).padStart(2)} pieces  ${r.status.padEnd(48).slice(0, 48)}  ${changed}${r.blocks ? `  [${r.blocks}]` : ""}`);
    prev = r;
  }
}
function diff(a, b) {
  const A = new Set(a.split("|"));
  const B = new Set(b.split("|"));
  const gone = [...A].filter((x) => !B.has(x)).map((x) => x.replace(/@translate\((\d+)px, (\d+)px\)/, "@$1,$2"));
  const came = [...B].filter((x) => !A.has(x)).map((x) => x.replace(/@translate\((\d+)px, (\d+)px\)/, "@$1,$2"));
  return `- ${gone.join(" ")}  + ${came.join(" ")}`;
}

// ---- Playing ----
const seen = () =>
  p.evaluate(() => {
    const s = window.squads;
    if (!s?.lobby) return null;
    const m = [...s.matches.values()].find((x) => x.state !== "over" && x.sides.some((sd) => sd.seats.includes(s.myId)));
    const d = m?.state === "half" ? m.current?.duties.find((x) => x.players.includes(s.myId)) : null;
    const partner = d?.players.find((x) => x !== s.myId) ?? null;
    return { phase: s.lobby.phase, key: m?.key, state: m?.state, seq: m?.current?.seq, duty: d ? { role: d.role } : null, fen: d ? m.boards[d.board].fen : null, partner: partner && m ? (m.visible[partner] ?? null) : null, locked: !!m?.locked.includes(s.myId) };
  });
async function waitFor(test, ms = 90_000) {
  const end = Date.now() + ms;
  for (;;) {
    const s = await seen().catch(() => null);
    if (s && test(s)) return s;
    if (Date.now() > end) throw new Error("timed out");
    await p.waitForTimeout(150);
  }
}
async function tap(sq) {
  const box = await p.locator(".board-area .hb-board").boundingBox();
  const black = await p.locator(".board-area .hb").evaluate((el) => el.classList.contains("orientation-black"));
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  await p.mouse.click(box.x + ((black ? 7 - f : f) + 0.5) * (box.width / 8), box.y + ((black ? r : 7 - r) + 0.5) * (box.height / 8));
}
const legal = (fen) => new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
/** 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Nxd4: White's only good move is Qxd4. */
const SCOTCH = "r1bqkbnr/pppp1ppp/8/8/3nP3/8/PPP2PPP/RNBQKB1R w KQkq - 0 5";
async function testLobby(start, clock = "120,0,3,0", extra = "") {
  await p.goto(`${url}/squads/test/${start}?nolanding&debug&clock=${clock}${extra}`);
  await p.getByRole("button", { name: "Skip votes" }).click({ timeout: 40_000 });
  await waitFor((s) => s.phase === "bracket");
}
async function pick(s) {
  if (s.duty.role !== "move") await waitFor((x) => !!x.partner, 20_000).catch(() => undefined);
  const now = await seen();
  const mv = legal(now.fen).find((m) => m.slice(0, 2) !== (now.partner ?? "").slice(0, 2) && m.length === 4);
  await tap(mv.slice(0, 2));
  await tap(mv.slice(2, 4));
  return mv;
}

if (mode === "relay") {
  await testLobby("relay");
  const s = await waitFor((x) => x.duty?.role === "move");
  await p.waitForTimeout(1200);
  const since = Date.now();
  const { frames } = await record(async () => {
    const mv = await pick(s);
    console.log("moved", mv);
    await p.waitForTimeout(1300);
    // Scouting: another board full size, then back to yours.
    await p.locator("button.sq-tiny:not(.is-you)").nth(5).click();
    await p.waitForTimeout(2200);
    await p.getByRole("button", { name: "Back to my board" }).click();
    await waitFor((x) => x.state === "half" && x.seq !== s.seq, 40_000).catch(() => undefined);
    await p.waitForTimeout(2500);
  });
  await timeline(since);
  console.log("flashes at frames", await flashes(frames));
  gif(frames, `relay-${W}`);
} else if (mode === "pairs" || mode === "final") {
  await testLobby(mode);
  let last = null;
  for (let i = 0; i < 8; i++) {
    const s = await waitFor((x) => !!x.duty && `${x.key}/${x.seq}` !== last);
    last = `${s.key}/${s.seq}`;
    await p.waitForTimeout(800);
    const since = Date.now();
    const { frames } = await record(async () => {
      await pick(s);
      await p.waitForTimeout(500);
      await p.getByRole("button", { name: /^Lock in my/ }).click().catch(() => undefined);
      await waitFor((x) => x.state === "show" || `${x.key}/${x.seq}` !== last, 40_000);
      await p.waitForTimeout(6000);
    });
    console.log(`half ${last}: ${s.duty.role}`);
    await timeline(since);
    console.log("flashes at frames", await flashes(frames));
    gif(frames, `${mode}-${W}`);
    break;
  }
} else if (mode === "block") {
  blocksOnly = true;
  await testLobby("relay", "120,0,3,0", `&bots=strong&seat=white&fen=${encodeURIComponent(SCOTCH)}`);
  const s = await waitFor((x) => x.duty?.role === "move");
  await p.waitForTimeout(1200);
  const since = Date.now();
  const { frames } = await record(async () => {
    await p.getByRole("button", { name: /^Block · / }).click();
    await p.waitForTimeout(500);
    await tap("d8");
    await p.waitForTimeout(500);
    await tap("f6");
    // The arrow draws, then keeps redrawing softly: watch two of its loops.
    await p.waitForTimeout(5600);
    await p.getByRole("button", { name: "Done blocking" }).click();
    await tap("d1");
    await tap("d4");
    // Through your half's end and theirs, until they've moved (the arrow goes then).
    await waitFor((x) => x.state === "half" && x.seq !== s.seq, 60_000);
    await waitFor((x) => x.state !== "half" || x.seq !== s.seq + 1, 60_000);
    await p.waitForTimeout(2500);
  });
  await timeline(since);
  console.log("flashes at frames", await flashes(frames));
  gif(frames, `block-${W}`, 20);
} else if (mode === "token") {
  await testLobby("pairs", "120,0,3,0", `&bots=strong&seat=white&fen=${encodeURIComponent(SCOTCH)}`);
  const s = await waitFor((x) => x.duty?.role === "pick");
  await p.waitForTimeout(800);
  const since = Date.now();
  const { frames } = await record(async () => {
    await tap("d1");
    await tap("d4");
    await p.waitForTimeout(800);
    await p.getByRole("button", { name: "Lock in my pick" }).click().catch(() => undefined);
    await waitFor((x) => x.state === "show" || x.seq !== s.seq, 40_000);
    await p.locator(".sq-note.news").waitFor({ timeout: 20_000 }).catch(() => undefined);
    await p.waitForTimeout(1500);
  });
  await timeline(since);
  console.log("flashes at frames", await flashes(frames));
  gif(frames, `token-${W}`);
} else if (mode === "modevote") {
  await p.goto(`${url}/squads/test?nolanding&debug&clock=120,0,3,0`);
  await p.locator(".vote-title h1", { hasText: "Which mode?" }).waitFor({ timeout: 40_000 });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/modevote-${W}.png` });
  const since = Date.now();
  const { frames } = await record(async () => {
    await p.locator(".vote-card").nth(1).click();
    await p.locator(".vote-title h1", { hasText: "How do the boards start?" }).waitFor({ timeout: 30_000 });
    await p.waitForTimeout(1500);
  });
  await timeline(since);
  console.log("flashes at frames", await flashes(frames));
  gif(frames, `modevote-${W}`);
} else if (mode === "shop" || mode === "stockfish" || mode === "shield" || mode === "chip") {
  await testLobby("pairs", "120,0,3,0", `&mode=mercenary&bots=strong${mode === "shield" ? ",blocks" : ""}`);
  const shop = p.locator(".mc-shop");
  if (mode === "shop") {
    const since = Date.now();
    const { frames } = await record(async () => {
      await shop.waitFor({ timeout: 20_000 });
      await p.waitForTimeout(1200);
      await p.screenshot({ path: `${out}/shop-explainer-${W}.png` });
      await p.getByRole("button", { name: "Got it" }).click();
      await p.waitForTimeout(500);
      await p.getByRole("button", { name: /^Buy a Stockfish token/ }).click();
      await p.waitForTimeout(700);
      await p.getByRole("button", { name: /^Buy a Shield/ }).click();
      await p.waitForTimeout(900);
      await p.screenshot({ path: `${out}/shop-${W}.png` });
      // The widest realistic wallet (and the other squad's): measured, not only looked at.
      await p.evaluate(() => {
        const s = window.squads;
        s.wallets = s.wallets.map((w) => ({ ...w, coins: 12345 }));
        s.emit();
      });
      await p.waitForTimeout(300);
      const over = await p.evaluate(() => {
        const sheet = document.querySelector(".mc-shop");
        const cut = [...document.querySelectorAll(".mc-shop *")].filter((e) => e.getBoundingClientRect().right > sheet.getBoundingClientRect().right + 0.5 || (e.scrollWidth > e.clientWidth + 0.5 && getComputedStyle(e).overflow !== "visible" && !e.matches(".mc-shop-when")));
        return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, cut: cut.map((e) => e.className) };
      });
      console.log("wide wallet: sideways scroll", over.page, "cut", JSON.stringify(over.cut));
      await p.screenshot({ path: `${out}/shop-wide-${W}.png` });
      await p.getByRole("button", { name: "Hide" }).click();
      await p.waitForTimeout(600);
      await p.locator(".mc-shop-pill").click();
      await p.waitForTimeout(600);
      await shop.waitFor({ state: "detached", timeout: 60_000 });
      await p.waitForTimeout(1500);
    });
    await timeline(since);
    console.log("flashes at frames", await flashes(frames));
    gif(frames, `shop-${W}`);
  } else {
    await shop.waitFor({ timeout: 20_000 });
    await p.getByRole("button", { name: "Got it" }).click().catch(() => undefined);
    await p.getByRole("button", { name: mode === "stockfish" ? /^Buy a Stockfish token/ : mode === "chip" ? /^Buy a Time chip/ : /^Buy a Shield/ }).click();
    await shop.waitFor({ state: "detached", timeout: 60_000 });
    if (mode === "chip") {
      const s = await waitFor((x) => x.duty?.role === "pick", 120_000);
      await p.waitForTimeout(600);
      const since = Date.now();
      // Every 100 ms: your squad's clock as shown, and whether "+30 s" is up.
      const clocks = [];
      const watch = setInterval(async () => {
        const t = await p.evaluate(() => ({ clock: document.querySelector(".sq-clockline-side.you .sq-clock")?.textContent ?? "", plus: !!document.querySelector(".sq-clockline-side.you .mc-chip-plus"), on: !!document.querySelector(".sq-clockline-side.you .mc-chip-clock.on") })).catch(() => null);
        if (t) clocks.push({ ms: Date.now() - since, ...t });
      }, 100);
      const { frames } = await record(async () => {
        await p.waitForTimeout(700);
        await p.screenshot({ path: `${out}/chip-before-${W}.png` });
        await p.locator(".sq-clockline-side.you .mc-chip-btn").click();
        await p.waitForTimeout(400);
        await p.screenshot({ path: `${out}/chip-${W}.png` });
        await p.waitForTimeout(2600);
        await pick(s);
        await p.waitForTimeout(1200);
      });
      clearInterval(watch);
      console.log("clock:", clocks.map((c) => `${c.ms}:${c.clock}${c.plus ? "+" : ""}${c.on ? "*" : ""}`).join(" "));
      await timeline(since);
      console.log("flashes at frames", await flashes(frames));
      gif(frames, `chip-${W}`);
    } else if (mode === "stockfish") {
      const s = await waitFor((x) => x.duty?.role === "pick", 120_000);
      await p.waitForTimeout(800);
      const since = Date.now();
      const { frames } = await record(async () => {
        await p.getByRole("button", { name: /^Stockfish token/ }).click();
        await p.locator(".mc-stockfish .sq-cheat-lines li").nth(2).waitFor({ timeout: 30_000 });
        await p.waitForTimeout(2000);
        await p.screenshot({ path: `${out}/stockfish-${W}.png` });
        await pick(s);
        await p.waitForTimeout(1500);
      });
      await timeline(since);
      console.log("flashes at frames", await flashes(frames));
      gif(frames, `stockfish-${W}`);
    } else {
      const since = Date.now();
      const { frames } = await record(async () => {
        // (Playing your picks meanwhile, so no bot takes your seat; the news shows in the panel whichever board it was on.)
        let last = null;
        const end = Date.now() + 120_000;
        while (Date.now() < end && !(await p.locator(".sq-status-block.mc-shield, .sq-note.news", { hasText: /shield/ }).count())) {
          const s = await seen();
          if (s?.duty && `${s.key}/${s.seq}` !== last && !s.locked) {
            last = `${s.key}/${s.seq}`;
            await pick(s).catch(() => undefined);
            await p.getByRole("button", { name: /^Lock in my/ }).click({ timeout: 3000 }).catch(() => undefined);
          }
          await p.waitForTimeout(200);
        }
        await p.waitForTimeout(3200);
      });
      await timeline(since);
      console.log("flashes at frames", await flashes(frames));
      gif(frames, `shield-${W}`);
      await p.screenshot({ path: `${out}/shield-after-${W}.png` });
    }
  }
} else if (mode === "clockvote" || mode === "clockline") {
  // On every animation frame: the vote cards' or the clock line's text, and any part of it outside its box or the screen.
  const watchFit = () =>
    p.evaluate((sel) => {
      const log = (window.__fit = []);
      let last = "";
      const tick = () => {
        const vw = document.documentElement.clientWidth;
        const els = [...document.querySelectorAll(sel)];
        const text = els.map((e) => e.textContent.replace(/\s+/g, " ").trim()).join(" | ");
        const out = els.flatMap((e) => {
          const r = e.getBoundingClientRect();
          // (Something placed over the board, the vote's result banner: inside the board, not over what's under it.)
          const over = getComputedStyle(e).position === "absolute" && e.offsetParent ? e.offsetParent.getBoundingClientRect() : null;
          const outside = over && (r.bottom > over.bottom + 0.5 || r.top < over.top - 0.5);
          return r.width && (e.scrollWidth > e.clientWidth + 0.5 || r.left < -0.5 || r.right > vw + 0.5 || outside) ? [`${e.className}(${Math.round(r.left)}-${Math.round(r.right)} of ${vw}, ${Math.round(r.top)}-${Math.round(r.bottom)}${over ? ` in ${Math.round(over.top)}-${Math.round(over.bottom)}` : ""}, scroll ${e.scrollWidth}/${e.clientWidth})`] : [];
        });
        const side = document.documentElement.scrollWidth - vw;
        const key = `${text}#${out.join(",")}#${side}`;
        if (key !== last) {
          last = key;
          log.push({ t: performance.now() + performance.timeOrigin, text, out, side });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, mode === "clockvote" ? ".vote-card strong, .vote-card-blurb, .vote-banner, .vote-banner-detail, .sq-banner-clock" : ".sq-clockline, .sq-clockline-side, .sq-clockline .sq-clock, .sq-free");
  const printFit = async (since) => {
    const log = await p.evaluate(() => window.__fit);
    let bad = 0;
    for (const r of log.filter((x) => x.t >= since)) {
      bad += r.out.length + (r.side > 0 ? 1 : 0);
      console.log(`${String(Math.round(r.t - since)).padStart(6)} ms  ${r.side > 0 ? `SIDE SCROLL ${r.side}  ` : ""}${r.out.length ? `OUT: ${r.out.join(" ")}  ` : ""}${r.text.slice(0, 160)}`);
    }
    console.log(bad ? `${bad} frames with something out of its box` : "every frame: everything inside its box and the screen");
  };
  if (mode === "clockvote") {
    await p.goto(`${url}/squads/test?nolanding&debug`);
    await p.locator(".vote-title h1", { hasText: "Which mode?" }).waitFor({ timeout: 40_000 });
    await p.locator(".vote-card").nth(0).click();
    await p.locator(".vote-title h1", { hasText: "How fast?" }).waitFor({ timeout: 60_000 });
    await p.waitForTimeout(600);
    await watchFit();
    await p.screenshot({ path: `${out}/clockvote-${W}.png` });
    const since = Date.now();
    const { frames } = await record(async () => {
      await p.locator(".vote-card").nth(0).click();
      await p.locator(".sq-banner-clock").waitFor({ timeout: 40_000 });
      await p.waitForTimeout(800);
      await p.screenshot({ path: `${out}/clockvote-card-${W}.png` });
      await p.waitForTimeout(1500);
    });
    await printFit(since);
    console.log("flashes at frames", await flashes(frames));
    gif(frames, `clockvote-${W}`);
  } else {
    await testLobby("relay", clockArg);
    await waitFor((x) => x.state === "half", 60_000);
    await watchFit();
    const since = Date.now();
    const { frames } = await record(async () => {
      // A few halves: your move when it comes (at once), the clocks running, the free seconds, sudden death if it comes.
      const end = Date.now() + 25_000;
      let shot = false;
      while (Date.now() < end) {
        const s = await seen();
        if (s?.duty && !s.locked && s.state === "half") {
          await p.waitForTimeout(2500);
          if (!shot) {
            await p.screenshot({ path: `${out}/clockline-${W}.png` });
            shot = true;
          }
          await pick(s).catch(() => undefined);
        }
        await p.waitForTimeout(200);
      }
    });
    await printFit(since);
    console.log("flashes at frames", await flashes(frames));
    gif(frames, `clockline-${W}`);
  }
} else if (mode === "standings") {
  await testLobby("relay", "8,0,3,0");
  await waitFor((x) => x.state === "half");
  // (A small bank: some squads reach sudden death within a few halves, so it shows too.)
  await p.locator(phone ? ".sq-strip-chip.sd" : ".sq-row.sd").first().waitFor({ timeout: 60_000 }).catch(() => undefined);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/standings-${W}.png` });
  if (phone) {
    await p.getByRole("button", { name: /show the standings/ }).click();
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}/standings-sheet-${W}.png` });
  }
  console.log("wrote standings");
} else if (mode === "menu") {
  await p.goto(`${url}/?nolanding&debug&pool=frames-${Date.now()}`);
  await p.getByRole("radio", { name: /Squads/ }).click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/menu-${W}.png` });
  await p.getByRole("button", { name: /^Party/ }).click();
  await p.getByRole("button", { name: "Create a party" }).click();
  const code = (await p.locator(".sq-invite-code").textContent()).trim();
  const friendCtx = await b.newContext(ctxOpts);
  const friend = await friendCtx.newPage();
  await friend.addInitScript(() => localStorage.setItem("brc.name", "Bo"));
  await friend.goto(`${url}/squads/party/${code}?nolanding`);
  await friend.getByRole("button", { name: "Join party" }).click();
  await p.locator(".sq-party-members li:not(.empty)").nth(1).waitFor();
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/party-${W}.png` });
  await friend.screenshot({ path: `${out}/party-friend-${W}.png` });
  await friendCtx.close();
  console.log("wrote menu and party");
}
await b.close();
