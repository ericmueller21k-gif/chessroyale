// Frame-by-frame check of Squads' screens, played the way a player plays them (real taps), against a running server
// with the test switch on (npx wrangler dev --var SQUADS_TEST:1 ...):
//   npm run frames:squads -- <out-dir> <relay|pairs|final|menu|standings> [url=http://localhost:8787] [width=390] [scheme=dark]
// relay: your move (it must show at once and never snap back), then scouting a tiny board and back.
// pairs: your pick, lock in, the coin-flip reveal. final: picks and blocks until a reveal where the lock slams down.
// menu: the home screen's Squads card and a party with a friend in it. standings: every squad's clock (and sudden death).
// Every painted frame is recorded (Chrome's screencast); the big board's pieces are logged on every animation frame,
// and the timeline printed: a piece that moves twice, jumps back or flickers shows as an extra change. A GIF of the
// moment goes to <out-dir>/<mode>-<width>.gif (and PNGs for menu and standings). See .claude/LESSONS.md.
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium, devices } from "@playwright/test";
import { Chess } from "chess.js";

const [out = ".", mode = "relay", url = "http://localhost:8787", widthArg = "390", scheme = "dark"] = process.argv.slice(2);
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
    const ps = [...document.querySelectorAll(".board-area :is(cg-board, .hb-board) piece")].map((e) => `${e.className}@${e.style.transform}`).sort().join("|");
    const status = document.querySelector(".sq-status")?.textContent ?? "";
    const key = `${ps}#${status}`;
    if (key !== last) {
      last = key;
      log.push({ t: performance.now() + performance.timeOrigin, n: ps ? ps.split("|").length : 0, ps, status });
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
async function timeline(since) {
  const log = await p.evaluate(() => window.__pieces);
  const rows = log.filter((r) => r.t >= since);
  let prev = null;
  for (const r of rows) {
    const changed = prev && prev.ps !== r.ps ? diff(prev.ps, r.ps) : "";
    console.log(`${String(Math.round(r.t - since)).padStart(6)} ms  ${String(r.n).padStart(2)} pieces  ${r.status.padEnd(48).slice(0, 48)}  ${changed}`);
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
  const box = await p.locator(".board-area :is(cg-board, .hb-board)").boundingBox();
  const black = await p.locator(".board-area :is(.cg-wrap, .hb)").evaluate((el) => el.classList.contains("orientation-black"));
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  await p.mouse.click(box.x + ((black ? 7 - f : f) + 0.5) * (box.width / 8), box.y + ((black ? r : 7 - r) + 0.5) * (box.height / 8));
}
const legal = (fen) => new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
async function testLobby(start, clock = "120,0,3,0") {
  await p.goto(`${url}/squads/test/${start}?nolanding&debug&clock=${clock}`);
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
    let locks = 0;
    const { frames } = await record(async () => {
      await pick(s);
      await p.waitForTimeout(500);
      await p.getByRole("button", { name: /^Lock in my/ }).click().catch(() => undefined);
      await waitFor((x) => x.state === "show" || `${x.key}/${x.seq}` !== last, 40_000);
      for (let k = 0; k < 40; k++) {
        locks += await p.locator(".sq-lock").count();
        await p.waitForTimeout(150);
      }
    });
    console.log(`half ${last}: ${s.duty.role}, lock seen ${locks > 0}`);
    if (mode === "pairs" || locks > 0) {
      await timeline(since);
      console.log("flashes at frames", await flashes(frames));
      gif(frames, `${mode}-${W}`);
      break;
    }
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
