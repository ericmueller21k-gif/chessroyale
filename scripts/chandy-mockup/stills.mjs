// Chandy's mockup stills (round 1, Nov 15): a real Boss Battle (Ginger's, for a dealt opening) on a phone or a computer, with
// Chandy drawn over it by the game's own sprite renderer (packages/app/src/characters/chandy.ts, effects/chandy.ts): his figure in
// the boss bar, his rifle and upgrade pips in the bar's free room, his move meter under the rage meter, and each power's board art.
// Nothing here is wired into the game: the page is a mockup, drawn over the live screen.
//   node scripts/chandy-mockup/stills.mjs <outDir> [phone|desktop] [scene,scene...]
// Scenes: lock, upgrade, upgradeGif, scatter, beam, shields, rapid, queen, fire, tile, desktop.
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";

const [outArg = "chandy-stills", device = "phone", only = ""] =
  process.argv.slice(2);
const out = resolve(outArg);
mkdirSync(out, { recursive: true });
const want = only ? only.split(",") : null;
const server = await createServer({
  root: "packages/app",
  configFile: "packages/app/vite.config.ts",
  server: { port: 5233, strictPort: false },
  logLevel: "error",
});
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const ctx =
  device === "desktop"
    ? { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }
    : {
        ...devices["iPhone 13"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      };

async function battle() {
  const p = await browser.newPage({ ...ctx, colorScheme: "dark" });
  await p.addInitScript(() => {
    try {
      localStorage.setItem("hunchess.tutorial.dismissed", "1");
      localStorage.setItem("hunchess.quests.seenDay", "9999-12-31");
      localStorage.setItem("hunchess.quests.noPop", "1");
    } catch {}
  });
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  await p.goto(
    `${url}?debug&clock=600&nolanding&brain=stockfish&boss=hopper&laststand=0`,
  );
  await p
    .getByRole("main")
    .getByRole("button", { name: /^Boss Battle/ })
    .click();
  await p.getByRole("main").getByRole("button", { name: "START" }).click();
  const ready = () =>
    p.evaluate(() => {
      const ph = window.match?.phase;
      return (
        ph?.kind === "play" &&
        !ph.thinking &&
        /Your move/.test(document.body.innerText)
      );
    });
  const waitReady = async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 60000 && !(await ready()))
      await p.waitForTimeout(300);
  };
  await waitReady();
  // A few ordinary opening moves by taps, so the board looks like a game in progress.
  const tap = async (s) => {
    const b = await p.evaluate(() =>
      (({ left, top, width }) => ({ left, top, width }))(
        document.querySelector(".board").getBoundingClientRect(),
      ),
    );
    const q = b.width / 8;
    await p.mouse.click(
      b.left + (s.charCodeAt(0) - 97 + 0.5) * q,
      b.top + (8 - Number(s[1]) + 0.5) * q,
    );
  };
  for (const mv of ["e2e4", "g1f3", "f1c4", "b1c3", "d2d3", "g1f3", "h2h3"]) {
    const before = await p.evaluate(() => window.match?.phase?.board?.fen);
    await tap(mv.slice(0, 2));
    await p.waitForTimeout(150);
    await tap(mv.slice(2));
    await p.waitForTimeout(600);
    const after = await p.evaluate(() => window.match?.phase?.board?.fen);
    if (after === before) continue;
    await p.waitForTimeout(800);
    await waitReady();
  }
  await p.waitForTimeout(1500);
  await waitReady();
  await p.waitForTimeout(800);
  await p.evaluate(setup);
  return p;
}

// ---- In the page: the mockup's toolkit (window.__mk).
async function setup() {
  const device = window.innerWidth >= 900 ? "desktop" : "phone";
  const sp = await import("/src/characters/sprite.ts");
  const ch = await import("/src/characters/chandy.ts");
  const fx = await import("/src/characters/effects/chandy.ts");
  const layer = document.createElement("div");
  layer.id = "mk";
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:60";
  document.body.append(layer);
  const style = document.createElement("style");
  style.textContent = `
    #mk canvas{image-rendering:pixelated;position:absolute}
    .mk-win{position:absolute;display:grid;justify-items:center;gap:6px;padding:10px 10px 12px;font-family:"Press Start 2P",ui-monospace,monospace;color:#fff;
      background:linear-gradient(180deg,#2a3cbd 0%,#13207a 55%,#0a1150 100%);border:3px solid #f4f4f4;border-radius:6px;box-shadow:0 0 0 2px #0b0b1a,4px 6px 0 rgba(0,0,0,.35)}
    .mk-win h2{margin:0;font-size:16px;letter-spacing:2px;color:#f2c14e;text-shadow:2px 2px 0 #0b0b1a}
    .mk-win .mk-l{font-size:10px;text-shadow:2px 2px 0 #0b0b1a}
    .mk-win .mk-n{font-size:7px;line-height:1.6;color:#c9d1ff;text-align:center}
    .mk-win .mk-art{position:relative}
    #mk .mk-win .mk-art canvas{position:static;display:block}
    .mk-pips{position:absolute;display:flex;gap:3px}
    .mk-pips i{width:9px;height:9px;border-radius:2px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.45)}
    .mk-pips i.on{background:#58e6ff;border-color:#e4ffff;box-shadow:0 0 6px #58e6ff}
    .mk-meter{position:absolute;width:44px;height:6px;border:1px solid rgba(255,255,255,.35);border-radius:3px;background:rgba(0,0,0,.45);overflow:hidden}
    .mk-meter i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#129cc3,#58e6ff)}
    .mk-meter.off{opacity:.45}
    .mk-lock{position:absolute;font-size:9px;line-height:1;opacity:.6}
    .bc-bar-bubble,.bubble:not(.gk-bubble){visibility:hidden!important}
    .mk-label{position:absolute;font:600 10px system-ui;color:#9ef2ff;opacity:.85}
  `;
  document.head.append(style);
  const canvasOf = (character, anim, i) => {
    const r = sp.renderFrame(character, character.anims[anim].frames[i], {});
    const c = document.createElement("canvas");
    c.width = r.w;
    c.height = r.h;
    c.getContext("2d").putImageData(
      new ImageData(new Uint8ClampedArray(r.data), r.w, r.h),
      0,
      0,
    );
    return c;
  };
  const rect = (sel) => {
    const els = [...document.querySelectorAll(sel)].filter(
      (e) => e.getBoundingClientRect().width > 0,
    );
    return els[0]?.getBoundingClientRect() ?? null;
  };
  const place = (c, x, y, scale) => {
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
    c.style.width = `${c.width * scale}px`;
    c.style.height = `${c.height * scale}px`;
    layer.append(c);
    return c;
  };
  const board = () => rect(".board");
  /** A square's box on the page (white at the bottom). */
  const sq = (name) => {
    const b = board();
    const s = b.width / 8;
    const f = name.charCodeAt(0) - 97;
    const r = Number(name[1]);
    return { x: b.left + f * s, y: b.top + (8 - r) * s, s };
  };
  const onSquare = (character, anim, i, name, scale = 1, dy = 0) => {
    const q = sq(name);
    const c = canvasOf(character, anim, i);
    const k = (q.s / 32) * scale;
    return place(
      c,
      q.x + (q.s - c.width * k) / 2,
      q.y + (q.s - c.height * k) / 2 + dy * q.s,
      k,
    );
  };
  const fen = () =>
    window.match?.boss?.board?.fen ?? window.match?.phase?.board?.fen ?? "";
  const pieces = () => {
    const rows = fen().split(" ")[0].split("/");
    const out = {};
    rows.forEach((row, i) => {
      let f = 0;
      for (const chr of row) {
        if (/\d/.test(chr)) f += Number(chr);
        else ((out[`${String.fromCharCode(97 + f)}${8 - i}`] = chr), f++);
      }
    });
    return out;
  };
  const setText = (re, text) => {
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode()); )
      if (re.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(re, text);
  };
  let figure = null;
  /** Chandy in the boss bar (or beside the board on a computer), in an animation's frame. */
  const figureAt = (character, anim, i) => {
    figure?.remove();
    const spr = [...document.querySelectorAll(".boss-char-sprite")].find(
      (e) => e.getBoundingClientRect().width > 0,
    );
    const r = spr.getBoundingClientRect();
    spr.style.visibility = "hidden";
    const c = canvasOf(character, anim, i);
    const scale =
      device === "desktop"
        ? Math.max(1, Math.round((r.height / spr.height) * 2) / 2)
        : 1;
    // On a phone his snout stops short of his name (the frame's x 94 is his snout's tip at rest).
    const name = rect(".boss-name");
    const left =
      device === "desktop" || !name
        ? r.left + r.width / 2 - ch.CHANDY_FOOT[0] * scale + 4
        : Math.max(-4, name.left - 6 - 94 * scale);
    figure = place(c, left, r.bottom - (ch.CHANDY_FOOT[1] + 2) * scale, scale);
    return figure;
  };
  let bar = [];
  /** His bar: the rifle at its stage with five pips in the bar's free room; the move meter under the rage meter. */
  const barAt = (stage, meter) => {
    bar.forEach((e) => e.remove());
    bar = [];
    setText(/Chub & Chirp|Chub &amp; Chirp/g, "Chandy");
    const prop = rect(".boss-prop");
    const rage = rect(".rage-meter");
    for (const e of document.querySelectorAll(".boss-prop > *"))
      e.style.visibility = "hidden";
    if (prop) {
      const c = canvasOf(ch.CHANDY_RIFLE, `stage${stage}`, 0);
      const s = device === "desktop" ? 1 : 1.25;
      bar.push(place(c, prop.right - c.width * s - 2, prop.top + 2, s));
      const pips = document.createElement("div");
      pips.className = "mk-pips";
      pips.innerHTML = [1, 2, 3, 4, 5]
        .map((n) => `<i class="${n <= stage ? "on" : ""}"></i>`)
        .join("");
      // (A phone: under the rifle; a computer's thin bar: left of it.)
      pips.style.left = `${device === "desktop" ? prop.right - c.width * s - 70 : prop.right - 64}px`;
      pips.style.top = `${device === "desktop" ? prop.top + 2 + (c.height * s) / 2 - 5 : prop.top + c.height * s + 4}px`;
      layer.append(pips);
      bar.push(pips);
    }
    if (rage) {
      const m = document.createElement("div");
      m.className = `mk-meter${meter == null ? " off" : ""}`;
      m.style.left = `${rage.left}px`;
      m.style.top = `${rage.bottom + 5}px`;
      m.style.width = `${rage.width}px`;
      m.style.height = `${rage.height}px`;
      m.innerHTML = `<i style="width:${(meter ?? 0) * 100}%"></i>`;
      layer.append(m);
      bar.push(m);
      if (meter == null) {
        const l = document.createElement("div");
        l.className = "mk-lock";
        l.textContent = "🔒";
        l.style.left = `${rage.right + 4}px`;
        l.style.top = `${rage.bottom + 3}px`;
        layer.append(l);
        bar.push(l);
      }
    }
  };
  // His portrait in the move list's rows (the boss's rows), cut from his idle as the kits' portraits are.
  const bust = (() => {
    const c = canvasOf(ch.CHANDY, "idle", 0);
    const P = ch.CHANDY_PORTRAIT;
    const o = document.createElement("canvas");
    o.width = P.w;
    o.height = P.h;
    o.getContext("2d").drawImage(c, -P.x, -P.y);
    return o.toDataURL();
  })();
  const bustCanvas = (() => {
    const c = canvasOf(ch.CHANDY, "idle", 0);
    const P = ch.CHANDY_PORTRAIT;
    const o = document.createElement("canvas");
    o.width = P.w;
    o.height = P.h;
    o.getContext("2d").drawImage(c, -P.x, -P.y);
    return o;
  })();
  const faces = () => {
    for (const cv of document.querySelectorAll("canvas.boss-portrait")) {
      if (cv.dataset.mk) continue;
      cv.dataset.mk = "1";
      cv.width = bustCanvas.width;
      cv.height = bustCanvas.height;
      cv.getContext("2d").drawImage(bustCanvas, 0, 0);
    }
    for (const im of document.querySelectorAll('img[src^="data:image/png"]'))
      if (im.naturalWidth < 90 && !im.closest("#mk")) im.src = bust;
  };
  let dockWant = null;
  let dockNode = null;
  const keep = () => {
    faces();
    setText(/Chub & Chirp/g, "Chandy");
    if (dockWant != null) {
      if (!dockNode || !dockNode.isConnected) {
        dockNode = null;
        const walk = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
        );
        for (let n; (n = walk.nextNode()); )
          if (
            /Your move\./.test(n.nodeValue) &&
            !n.parentElement.closest("#mk")
          )
            dockNode = n;
      }
      if (dockNode && dockNode.nodeValue !== dockWant)
        dockNode.nodeValue = dockWant;
    }
  };
  keep();
  new MutationObserver(keep).observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  // The dock's line: kept on the text node that said "Your move." through the screen's re-renders.
  const dock = (text) => {
    dockWant = text;
    keep();
  };
  // ---- Dodge (his ultimate): the board zoomed onto your king, a 3 x 3 arena of its own round him, the clones, the lines, the timer.
  const Z = 1.4;
  const dodge = (st) => {
    document.querySelectorAll("#mk .mk-dodge").forEach((e) => e.remove());
    const wrapEl = document.querySelector(".board-wrap");
    const boardEl = document.querySelector(".board");
    const ps = pieces();
    const ksq = Object.keys(ps).find((q) => ps[q] === "K");
    const kf = ksq.charCodeAt(0) - 97;
    const kr = Number(ksq[1]);
    const z = st.zoom ?? Z;
    // (Measure the board untransformed.)
    boardEl.style.transform = "";
    const w = wrapEl.getBoundingClientRect();
    const b = boardEl.getBoundingClientRect();
    const sqz = b.width / 8;
    const kx = (kf + 0.5) * sqz + (b.left - w.left);
    const ky = (8 - kr + 0.5) * sqz + (b.top - w.top);
    wrapEl.style.overflow = "hidden";
    boardEl.style.transformOrigin = "0 0";
    const f = (z - 1) / (Z - 1);
    boardEl.style.transform = `translate(${(w.width / 2 - kx * Z) * f}px, ${(w.height / 2 - ky * Z) * f}px) scale(${z})`;
    if (z < Z) return;
    const C = { x: w.left + w.width / 2, y: w.top + w.height / 2 };
    const cell = sqz * Z;
    const el = (cls, css, html = "") => {
      const d = document.createElement("div");
      d.className = `mk-dodge ${cls}`;
      d.style.cssText = `position:absolute;${css}`;
      d.innerHTML = html;
      layer.append(d);
      return d;
    };
    // Dim the board round the arena.
    el(
      "",
      `left:${w.left}px;top:${w.top}px;width:${w.width}px;height:${w.height}px;background:rgba(10,8,20,.45)`,
    );
    // The arena: its own 9 squares in the board's colors (whether or not the board has them: your king on its edge here).
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const light = (kf + dc + (kr - dr)) % 2 === 1;
        el(
          "",
          `left:${C.x + (dc - 0.5) * cell}px;top:${C.y + (dr - 0.5) * cell}px;width:${cell}px;height:${cell}px;background:${light ? "#efdcb5" : "#c4ad8b"};box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)`,
        );
      }
    el(
      "",
      `left:${C.x - 1.5 * cell - 3}px;top:${C.y - 1.5 * cell - 3}px;width:${3 * cell}px;height:${3 * cell}px;border:3px solid #ff3f5e;border-radius:4px;box-shadow:0 0 12px #ff3f5e80`,
    );
    // Your king: the board's own piece, on the square you've picked (hidden on the board under the arena).
    const kEl = document.querySelector(".board piece.white.king");
    if (kEl) kEl.style.visibility = "hidden";
    const bg = kEl ? getComputedStyle(kEl).backgroundImage : "";
    const [kc, krr] = st.king ?? [0, 0];
    const king = el(
      "",
      `left:${C.x + (kc - 0.5) * cell}px;top:${C.y + (krr - 0.5) * cell}px;width:${cell}px;height:${cell}px;background:${bg} center/88% no-repeat;z-index:3`,
    );
    if (st.result === "hit")
      ((king.style.filter =
        "drop-shadow(0 0 4px #fff) drop-shadow(0 0 10px #ff3f5e) drop-shadow(0 0 3px #ff3f5e)"),
        (king.style.zIndex = "7"));
    // The lines: the two rows and the two columns that miss the safe square.
    const [sc, sr] = st.safe;
    const rows = [-1, 0, 1].filter((r) => r !== sr);
    const cols = [-1, 0, 1].filter((c2) => c2 !== sc);
    const tile = (anim, i, x, y, rot) => {
      const c2 = canvasOf(fx.LINE_TILE, anim, i);
      c2.style.cssText = `position:absolute;image-rendering:pixelated;left:${x - cell / 2}px;top:${y - cell / 2}px;width:${cell}px;height:${cell}px;${rot ? "transform:rotate(90deg);" : ""}z-index:4`;
      c2.classList.add("mk-dodge");
      layer.append(c2);
    };
    const clones = st.clones ?? 4;
    const lines = [
      ...rows.map((r, i) => ({ row: r, side: i === 0 ? -1 : 1 })),
      ...cols.map((c2) => ({ col: c2 })),
    ];
    lines.forEach((ln, n) => {
      if (n >= clones) return;
      // Its clone: rows from the left or the right, aiming level; columns from above, aiming down.
      const pose = ln.row !== undefined ? "level" : "down";
      const cc = canvasOf(ch.CHANDY_CLONE, pose, 0);
      const m = ch.cloneMuzzle(pose);
      const k = 0.5;
      let x0;
      let y0;
      let flip = false;
      if (ln.row !== undefined) {
        if (ln.side < 0) x0 = C.x - 1.5 * cell - 6 - m[0] * k;
        else
          ((x0 = C.x + 1.5 * cell + 6 - (cc.width - m[0]) * k), (flip = true));
        y0 = C.y + ln.row * cell - m[1] * k;
      } else {
        x0 = C.x + ln.col * cell - m[0] * k;
        y0 = C.y - 1.5 * cell - 6 - m[1] * k;
      }
      cc.style.cssText = `position:absolute;image-rendering:pixelated;left:${x0}px;top:${y0}px;width:${cc.width * k}px;height:${cc.height * k}px;${flip ? "transform:scaleX(-1);" : ""}z-index:5;opacity:${st.ghost?.[n] ?? 1}`;
      cc.classList.add("mk-dodge");
      layer.append(cc);
      if (!st.lines) return;
      const anim = st.lines === "beam" ? "beam" : "aimPink";
      const fi = st.lines === "beam" ? (st.beamFrame ?? 0) : 0;
      if (ln.row !== undefined)
        for (let dc = -1; dc <= 1; dc++)
          tile(anim, fi, C.x + dc * cell, C.y + ln.row * cell, false);
      else
        for (let dr = -1; dr <= 1; dr++)
          tile(anim, fi, C.x + ln.col * cell, C.y + dr * cell, true);
    });
    // The HUD under the arena: the round, the 3 s timer as a draining bar and its seconds.
    const t = st.t ?? 3;
    el(
      "",
      `left:${C.x - 120}px;top:${C.y + 1.5 * cell + 10}px;width:240px;display:grid;gap:5px;justify-items:center;font-family:"Press Start 2P",monospace;color:#fff;text-shadow:2px 2px 0 #0b0b1a;z-index:6`,
      `<div style="font-size:11px">DODGE! <span style="color:#ff8fa3">ROUND ${st.round ?? 1}/3</span></div>
       <div style="width:220px;height:10px;border:2px solid #fff;border-radius:3px;background:#0b0b1a;overflow:hidden"><div style="height:100%;width:${(t / 3) * 100}%;background:${t > 1 ? "#ff3f5e" : "#ffe0e6"}"></div></div>
       <div style="font-size:9px;color:#ffe0e6">${st.locked ? "LOCKED" : `${t.toFixed(1)} s`}</div>`,
    );
    if (st.result) {
      // The result where the round's line was, big, on a dark pill under the arena.
      const big =
        st.result === "hit" ? "HIT! YOU LOSE" : `DODGED ${st.round ?? 1}/3`;
      el(
        "",
        `left:${C.x - 150}px;top:${C.y + 1.5 * cell + 6}px;width:300px;padding:6px 0;text-align:center;background:#0b0b1a;border:2px solid ${st.result === "hit" ? "#ff3f5e" : "#f2c14e"};border-radius:6px;font:400 14px "Press Start 2P",monospace;color:${st.result === "hit" ? "#ff3f5e" : "#f2c14e"};text-shadow:2px 2px 0 #000;z-index:9`,
        big,
      );
    }
  };
  // ---- Dodge, round 2b: the scope-in on your king, his slide to the center, the blank board; the round on the real squares with the vote.
  const dodge2 = (st) => {
    document.querySelectorAll("#mk .mk-dodge").forEach((e) => e.remove());
    const wrapEl = document.querySelector(".board-wrap");
    const boardEl = document.querySelector(".board");
    const b = boardEl.getBoundingClientRect();
    const s = b.width / 8;
    const ps = pieces();
    const ksq = Object.keys(ps).find((q) => ps[q] === "K");
    const kEl = document.querySelector(".board piece.white.king");
    const bg = kEl ? getComputedStyle(kEl).backgroundImage : "";
    const center = (name) => ({
      x: b.left + (name.charCodeAt(0) - 97 + 0.5) * s,
      y: b.top + (8 - Number(name[1]) + 0.5) * s,
    });
    const el = (css, html = "") => {
      const d = document.createElement("div");
      d.className = "mk-dodge";
      d.style.cssText = `position:absolute;${css}`;
      d.innerHTML = html;
      layer.append(d);
      return d;
    };
    // The board's own pieces: all there before the board goes blank; after, none (your king is drawn by the mockup).
    for (const pc of document.querySelectorAll(".board piece"))
      pc.style.visibility = st.blank || pc === kEl ? "hidden" : "";
    // Your king: from his square sliding to e4 (`slide` 0..1), then on the square you pick.
    const from = center(ksq);
    const to = center("e4");
    const kp = st.king
      ? center(st.king)
      : {
          x: from.x + (to.x - from.x) * (st.slide ?? 0),
          y: from.y + (to.y - from.y) * (st.slide ?? 0),
        };
    // The blank board: the mockup redraws its 64 squares over the real ones (no pieces, no last-move marks); its letters stay.
    if (st.blank)
      for (let i = 0; i < 64; i++) {
        const f = i % 8;
        const r = Math.floor(i / 8);
        el(
          `left:${b.left + f * s}px;top:${b.top + r * s}px;width:${s}px;height:${s}px;background:var(${(f + r) % 2 ? "--sq-dark" : "--sq-light"});z-index:1`,
        );
      }
    // The 3 x 3 round e4, its red frame (on the blank board only).
    const A = center("e4");
    if (st.blank && st.arena !== false)
      el(
        `left:${A.x - 1.5 * s - 3}px;top:${A.y - 1.5 * s - 3}px;width:${3 * s}px;height:${3 * s}px;border:3px solid #ff3f5e;border-radius:4px;box-shadow:0 0 12px #ff3f5e80;z-index:2`,
      );
    const king = el(
      `left:${kp.x - s / 2}px;top:${kp.y - s / 2}px;width:${s}px;height:${s}px;background:${bg} center/100% no-repeat;z-index:6`,
    );
    if (st.result === "hit")
      king.style.filter =
        "drop-shadow(0 0 4px #fff) drop-shadow(0 0 10px #ff3f5e)";
    // The scope: everything but a circle round your king greyed, blurred and darkened; a cyan scope ring round the circle.
    if (st.hole != null) {
      const R = st.hole;
      const op = st.scope ?? 1;
      const w = wrapEl.getBoundingClientRect();
      const fx0 = kp.x - w.left;
      const fy0 = kp.y - w.top;
      el(
        `left:${w.left}px;top:${w.top}px;width:${w.width}px;height:${w.height}px;opacity:${op};backdrop-filter:grayscale(1) blur(2.5px) brightness(.35);-webkit-mask:radial-gradient(circle at ${fx0}px ${fy0}px,transparent ${R}px,#000 ${R + 2}px);mask:radial-gradient(circle at ${fx0}px ${fy0}px,transparent ${R}px,#000 ${R + 2}px);z-index:7`,
      );
      el(
        `left:${kp.x - R}px;top:${kp.y - R}px;width:${2 * R}px;height:${2 * R}px;border-radius:50%;border:3px solid #58e6ff;box-shadow:0 0 10px #58e6ff;opacity:${op};z-index:8`,
        `<i style="position:absolute;left:50%;top:-10px;width:3px;height:18px;margin-left:-1.5px;background:#58e6ff"></i><i style="position:absolute;left:50%;bottom:-10px;width:3px;height:18px;margin-left:-1.5px;background:#58e6ff"></i><i style="position:absolute;top:50%;left:-10px;height:3px;width:18px;margin-top:-1.5px;background:#58e6ff"></i><i style="position:absolute;top:50%;right:-10px;height:3px;width:18px;margin-top:-1.5px;background:#58e6ff"></i>`,
      );
    }
    if (!st.blank || !st.safe) return;
    // The lines and the clones, as round 2, on the real squares.
    const [sc, sr] = st.safe;
    const rows = [-1, 0, 1].filter((r) => r !== sr);
    const cols = [-1, 0, 1].filter((c) => c !== sc);
    const lines = [
      ...rows.map((r, i) => ({ row: r, side: i === 0 ? -1 : 1 })),
      ...cols.map((c) => ({ col: c })),
    ];
    const tile = (anim, i, x, y, rot) => {
      const c2 = canvasOf(fx.LINE_TILE, anim, i);
      c2.style.cssText = `position:absolute;image-rendering:pixelated;left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;${rot ? "transform:rotate(90deg);" : ""}z-index:4`;
      c2.classList.add("mk-dodge");
      layer.append(c2);
    };
    lines.forEach((ln, n) => {
      if (n >= (st.clones ?? 4)) return;
      const pose = ln.row !== undefined ? "level" : "down";
      const cc = canvasOf(ch.CHANDY_CLONE, pose, 0);
      const m = ch.cloneMuzzle(pose);
      const k = 0.5;
      let x0;
      let y0;
      let flip = false;
      if (ln.row !== undefined) {
        if (ln.side < 0) x0 = A.x - 1.5 * s - 4 - m[0] * k;
        else ((x0 = A.x + 1.5 * s + 4 - (cc.width - m[0]) * k), (flip = true));
        y0 = A.y + ln.row * s - m[1] * k;
      } else {
        x0 = A.x + ln.col * s - m[0] * k;
        y0 = A.y - 1.5 * s - 4 - m[1] * k;
      }
      cc.style.cssText = `position:absolute;image-rendering:pixelated;left:${x0}px;top:${y0}px;width:${cc.width * k}px;height:${cc.height * k}px;${flip ? "transform:scaleX(-1);" : ""}z-index:5;opacity:${st.ghost?.[n] ?? 1}`;
      cc.classList.add("mk-dodge");
      layer.append(cc);
      if (!st.lines) return;
      const anim = st.lines === "beam" ? "beam" : "aimPink";
      const fi = st.lines === "beam" ? (st.beamFrame ?? 0) : 0;
      if (ln.row !== undefined)
        for (let dc = -1; dc <= 1; dc++)
          tile(anim, fi, A.x + dc * s, A.y + ln.row * s, false);
      else
        for (let dr = -1; dr <= 1; dr++)
          tile(anim, fi, A.x + ln.col * s, A.y + dr * s, true);
    });
    // The vote: each square's count (as the crowd's vote shows its counts), your own pick ringed in gold.
    for (const [q, n] of Object.entries(st.votes ?? {})) {
      const c = center(q);
      el(
        `left:${c.x + s / 2 - 22}px;top:${c.y - s / 2 + 2}px;min-width:18px;padding:1px 3px;border-radius:8px;background:#0b0b1a;color:#fff;font:700 10px system-ui;text-align:center;border:1px solid #f2c14e;z-index:9`,
        String(n),
      );
    }
    if (st.mine) {
      const c = center(st.mine);
      el(
        `left:${c.x - s / 2 + 2}px;top:${c.y - s / 2 + 2}px;width:${s - 4}px;height:${s - 4}px;border:3px solid #f2c14e;border-radius:4px;box-sizing:border-box;z-index:9`,
      );
    }
    // The HUD under the 3 x 3: the round, the vote's 3 s bar, its seconds or the result.
    const t = st.t ?? 3;
    const line3 = st.random
      ? "NOBODY VOTED: RANDOM"
      : st.locked
        ? "LOCKED"
        : `VOTE: TAP A SQUARE  ${t.toFixed(1)} s`;
    el(
      `left:${A.x - 150}px;top:${A.y + 1.5 * s + 6}px;width:300px;box-sizing:border-box;padding:6px 0 7px;display:grid;gap:5px;justify-items:center;font-family:"Press Start 2P",monospace;color:#fff;text-shadow:2px 2px 0 #0b0b1a;background:rgba(11,11,26,.88);border-radius:8px;z-index:9`,
      st.result
        ? `<div style="padding:6px 10px;background:#0b0b1a;border:2px solid ${st.result === "hit" ? "#ff3f5e" : "#f2c14e"};border-radius:6px;font-size:13px;color:${st.result === "hit" ? "#ff3f5e" : "#f2c14e"}">${st.result === "hit" ? "HIT! YOU LOSE" : `DODGED ${st.round ?? 1}/3`}</div>`
        : `<div style="font-size:11px">DODGE! <span style="color:#ff8fa3">ROUND ${st.round ?? 1}/3</span></div>
       <div style="width:220px;height:10px;border:2px solid #fff;border-radius:3px;background:#0b0b1a;overflow:hidden"><div style="height:100%;width:${(t / 3) * 100}%;background:${t > 1 ? "#ff3f5e" : "#ffe0e6"}"></div></div>
       <div style="font-size:9px;color:${st.random ? "#f2c14e" : "#ffe0e6"}">${line3}</div>`,
    );
  };
  window.__mk = {
    dodge2,
    dodge,
    ch,
    fx,
    sp,
    canvasOf,
    place,
    sq,
    onSquare,
    pieces,
    fen,
    figureAt,
    barAt,
    dock,
    setText,
    layer,
    rect,
    board,
  };
}

const shot = async (p, name) => {
  await p.waitForTimeout(150);
  await p.screenshot({ path: join(out, `${device}-${name}.png`) });
  console.log("still", name);
};
const clear = (p) =>
  p.evaluate(() =>
    [
      ...document.querySelectorAll(
        "#mk > canvas:not(.keep), #mk .mk-win, #mk .mk-tmp",
      ),
    ].forEach((e) => e !== null && e.remove()),
  );

/** A target square for the lock-on: a crowd piece (not the king, not the queen) the boss's pieces could plausibly reach: here, the mockup's pick. */
const SCENES = {
  async lock(p) {
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(1, 0.35);
      m.figureAt(m.ch.CHANDY, "point", 3);
      const ps = m.pieces();
      const pick =
        ["c3", "f3", "d4", "e4", "c4", "b5", "f4"].find(
          (s) => ps[s] && /[NBRP]/.test(ps[s]),
        ) ?? Object.keys(ps).find((s) => /[NB]/.test(ps[s]));
      window.__lockSq = pick;
      m.onSquare(m.fx.CROSSHAIR, "held", 0, pick).classList.add("keep");
      m.dock("Your move.");
    });
    await shot(p, "lock-on");
  },
  async upgrade(p) {
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(2, 0);
      m.figureAt(m.ch.CHANDY_STAGES, "stage2", 0);
      const b = m.board();
      const w = document.createElement("div");
      w.className = "mk-win";
      const c = m.canvasOf(m.ch.CHANDY_RIFLE, "stage2", 0);
      c.style.width = `${c.width * 2.5}px`;
      c.style.height = `${c.height * 2.5}px`;
      w.innerHTML = `<h2>UPGRADE!</h2><div class="mk-art"></div><div class="mk-l">BIG SCOPE  2/5</div><div class="mk-n">New move unlocked: Shields</div>`;
      w.querySelector(".mk-art").append(c);
      m.layer.append(w);
      const r = w.getBoundingClientRect();
      w.style.left = `${b.left + (b.width - r.width) / 2}px`;
      w.style.top = `${b.top + (b.height - r.height) / 2}px`;
      m.dock("Upgrade: Big scope.");
    });
    await shot(p, "upgrade");
  },
  async upgradeGif(p) {
    // About 2 s: the window steps in with the old rifle, the new part slides on and snaps (a flash), UPGRADE!, the window steps out.
    const dir = join(out, "gif-upgrade");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(1, 0);
      m.figureAt(m.ch.CHANDY_STAGES, "stage1", 0);
    });
    const frames = [
      // [ms, step]
      [80, "in0"],
      [80, "in1"],
      [240, "old"],
      [80, "slide0"],
      [80, "slide1"],
      [80, "snap"],
      [80, "flash"],
      [700, "new"],
      [360, "new2"],
      [80, "out0"],
      [80, "out1"],
    ];
    let i = 0;
    for (const [ms, step] of frames) {
      await p.evaluate((step) => {
        const m = window.__mk;
        document.querySelectorAll("#mk .mk-win").forEach((e) => e.remove());
        const b = m.board();
        const scaleY =
          step === "in0" || step === "out1"
            ? 0.35
            : step === "in1" || step === "out0"
              ? 0.7
              : 1;
        const stage = ["old", "in0", "in1", "slide0", "slide1"].includes(step)
          ? 1
          : 2;
        const w = document.createElement("div");
        w.className = "mk-win";
        const c = m.canvasOf(m.ch.CHANDY_RIFLE, `stage${stage}`, 0);
        c.style.width = `${c.width * 2.5}px`;
        c.style.height = `${c.height * 2.5}px`;
        const title = ["snap", "flash", "new", "new2", "out0", "out1"].includes(
          step,
        )
          ? "UPGRADE!"
          : "&nbsp;";
        const label = stage === 2 ? "BIG SCOPE  2/5" : "&nbsp;";
        const note = stage === 2 ? "New move unlocked: Shields" : "&nbsp;";
        w.innerHTML = `<h2 style="${step === "new2" ? "color:#fff" : ""}">${title}</h2><div class="mk-art"></div><div class="mk-l">${label}</div><div class="mk-n">${note}</div>`;
        const art = w.querySelector(".mk-art");
        art.append(c);
        if (step === "slide0" || step === "slide1") {
          // The scope alone, sliding down onto the rail.
          const s2 = m.canvasOf(m.ch.CHANDY_RIFLE, "stage2", 0);
          const s1 = m.canvasOf(m.ch.CHANDY_RIFLE, "stage1", 0);
          const g2 = s2
            .getContext("2d")
            .getImageData(0, 0, s2.width, s2.height);
          const g1 = s1
            .getContext("2d")
            .getImageData(0, 0, s1.width, s1.height);
          for (let j = 0; j < g2.data.length; j += 4)
            if (g1.data[j + 3] && j / 4 / s2.width > 11) g2.data[j + 3] = 0;
          s2.getContext("2d").putImageData(g2, 0, 0);
          s2.style.cssText = `position:absolute;left:0;top:${step === "slide0" ? -25 : -8}px;width:${s2.width * 2.5}px;height:${s2.height * 2.5}px;image-rendering:pixelated`;
          art.append(s2);
        }
        if (step === "flash") {
          const f = document.createElement("div");
          f.style.cssText =
            "position:absolute;left:30%;top:0;width:40%;height:40%;border-radius:50%;background:radial-gradient(#e4ffff,#58e6ff80 45%,transparent 70%)";
          art.append(f);
        }
        w.style.transform = `scaleY(${scaleY})`;
        m.layer.append(w);
        const r = w.getBoundingClientRect();
        w.style.left = `${b.left + (b.width - r.width) / 2}px`;
        w.style.top = `${b.top + (b.height - w.offsetHeight) / 2}px`;
        if (stage === 2) m.barAt(2, 0);
      }, step);
      for (let k = 0; k < Math.round(ms / 40); k++)
        await p.screenshot({
          path: join(dir, `${String(i++).padStart(4, "0")}.png`),
        });
    }
    const w = device === "desktop" ? 640 : 390;
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-framerate",
      "25",
      "-i",
      join(dir, "%04d.png"),
      "-vf",
      `scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse`,
      join(out, `${device}-upgrade.gif`),
    ]);
    rmSync(dir, { recursive: true, force: true });
    console.log("gif upgrade");
    await p.evaluate(() =>
      document.querySelectorAll("#mk .mk-win").forEach((e) => e.remove()),
    );
  },
  async scatter(p) {
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(3, 1);
      m.figureAt(m.ch.CHANDY_FIRE, "fire", 4);
      const ps = m.pieces();
      // The shot's spot: an empty square in the crowd's half with empty squares round it; four of those blocked.
      const empty = (s) => /^[a-h][1-8]$/.test(s) && !ps[s];
      const nb = (s) =>
        [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
          [-1, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
        ]
          .map(
            ([df, dr]) =>
              `${String.fromCharCode(s.charCodeAt(0) + df)}${Number(s[1]) + dr}`,
          )
          .filter(empty);
      const spots = [
        "d3",
        "e3",
        "c3",
        "f3",
        "d4",
        "e4",
        "c4",
        "f4",
        "b3",
        "g3",
      ].filter((s) => empty(s) && nb(s).length >= 4);
      const at = spots[0];
      m.onSquare(m.fx.SCATTER_BURST, "burst", 1, at);
      for (const s of nb(at).slice(0, 4))
        m.onSquare(m.fx.SCATTER_MARK, "held", 1, s);
      m.dock("Scatter shot: 4 squares blocked.");
    });
    await shot(p, "move-scatter");
  },
  async beam(p) {
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(3, 1);
      m.figureAt(m.ch.CHANDY_FIRE, "fire", 3);
      const ps = m.pieces();
      const king = Object.keys(ps).find((s) => ps[s] === "K");
      // A rank and a file away from your king's; the rank with the most of your pieces on it, then the file.
      const ranks = [2, 3, 4].filter((r) => r !== Number(king[1]));
      const rank = ranks.sort(
        (a, b) =>
          Object.keys(ps).filter((s) => s[1] == b && /[A-Z]/.test(ps[s]))
            .length -
          Object.keys(ps).filter((s) => s[1] == a && /[A-Z]/.test(ps[s]))
            .length,
      )[0];
      const file = ["c", "f", "b", "g"].find((f) => f !== king[0]);
      for (let i = 0; i < 8; i++) {
        const fl = String.fromCharCode(97 + i);
        if (fl !== file)
          m.onSquare(m.fx.BEAM_TILE, "row", i % 3, `${fl}${rank}`);
      }
      for (let r = 1; r <= 8; r++)
        if (r !== rank) m.onSquare(m.fx.BEAM_TILE, "col", r % 3, `${file}${r}`);
      m.onSquare(m.fx.BEAM_TILE, "cross", 0, `${file}${rank}`);
      m.dock(`Beam: rank ${rank} and ${file}-file held.`);
    });
    await shot(p, "move-beam");
  },
  async shields(p) {
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(3, 1);
      m.figureAt(m.ch.CHANDY_FIRE, "fire", 4);
      const ps = m.pieces();
      // Two of his pieces, never his king: here his developed minor pieces first (off his back rank), then any.
      const his = Object.keys(ps)
        .filter((s) => /[nbrq]/.test(ps[s]))
        .sort(
          (a, b) =>
            (a[1] === "8") - (b[1] === "8") ||
            "nbrq".indexOf(ps[a]) - "nbrq".indexOf(ps[b]),
        );
      const two = his.slice(0, 2);
      for (const s of two) m.onSquare(m.fx.SHIELD, "held", 0, s, 1.05);
      m.dock("Shields: those 2 can't be taken.");
    });
    await shot(p, "move-shields");
  },
  async rapid(p) {
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(3, 1);
      m.figureAt(m.ch.CHANDY_FIRE, "fire", 3);
      const ps = m.pieces();
      // Three of your pieces at random (never the king): here a spread of a knight, a bishop and a pawn where there are.
      const mine = Object.keys(ps).filter((s) => /[NBRP]/.test(ps[s]));
      const three = [];
      for (const k of ["N", "B", "P", "R", "N", "B", "P"]) {
        const s = mine.find(
          (x) =>
            ps[x] === k &&
            !three.includes(x) &&
            (k !== "P" || Number(x[1]) > 2),
        );
        if (s && three.length < 3) three.push(s);
      }
      three.forEach((s, i) => {
        m.onSquare(m.fx.DIZZY, "dizzy", i * 2, s, 1.5, -0.42);
        if (i === 2) m.onSquare(m.fx.DIZZY, "hit", 1, s);
      });
      m.dock("Rapid fire: 3 pieces dizzy.");
    });
    await shot(p, "move-rapid");
  },
  async queen(p) {
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(5, 1);
      m.figureAt(m.ch.CHANDY_FIRE, "fire", 3);
      const ps = m.pieces();
      const q = Object.keys(ps).find((s) => ps[s] === "Q") ?? "d1";
      // The round comes down the queen's file from his side; the first piece in its way (here: whatever stands above her) shatters.
      const f = q[0];
      let blocker = null;
      for (let r = Number(q[1]) + 1; r <= 8; r++)
        if (ps[`${f}${r}`]) blocker = `${f}${r}`;
      for (let r = Number(q[1]) + 1; r <= 8; r++)
        if (ps[`${f}${r}`]) {
          blocker = `${f}${r}`;
          break;
        }
      m.onSquare(m.fx.CROSSHAIR, "held", 1, q);
      // His own pieces don't stop it (the round is his): the trail runs from his edge to the first of yours.
      const top = blocker ? Number(blocker[1]) : Number(q[1]);
      for (let r = 8; r > top; r--)
        m.onSquare(m.fx.PIERCING_ROUND, "trail", 0, `${f}${r}`);
      const head = m.onSquare(m.fx.PIERCING_ROUND, "fly", 0, `${f}${top + 1}`);
      head.style.transform = "rotate(90deg)";
      if (blocker) m.onSquare(m.fx.SHATTER, "shatter", 1, blocker, 1.6);
      window.__queenInfo = { q, blocker };
      m.dock(
        blocker
          ? "Queen lock: blocked, piece lost."
          : "Queen lock: your queen falls.",
      );
    });
    await shot(p, "move-queen");
  },
  async dodgeAim(p) {
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(5, 1);
      m.figureAt(m.ch.CHANDY_FIRE, "fire", 2);
      m.dodge({ safe: [1, -1], king: [0, 0], lines: "aim", t: 2.2, round: 1 });
      m.dock("Dodge! Find the one safe square.");
    });
    await shot(p, "dodge-aim");
  },
  async dodgeDodged(p) {
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(5, 1);
      m.figureAt(m.ch.CHANDY_FIRE, "fire", 4);
      m.dodge({
        safe: [1, -1],
        king: [1, -1],
        lines: "beam",
        t: 0,
        locked: true,
        round: 1,
        result: "dodged",
      });
      m.dock("Dodged! Round 2 of 3 next.");
    });
    await shot(p, "dodge-dodged");
  },
  async dodgeHit(p) {
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(5, 1);
      m.figureAt(m.ch.CHANDY_FIRE, "fire", 3);
      m.dodge({
        safe: [-1, 1],
        king: [0, 0],
        lines: "beam",
        beamFrame: 1,
        t: 0,
        locked: true,
        round: 3,
        result: "hit",
      });
      m.dock("Hit! Chandy wins the battle.");
    });
    await shot(p, "dodge-hit");
  },
  async dodgeGif(p) {
    // One round, about 5 s: the zoom onto your king, the clones blink in round the arena, the aim lines, the 3 s, your king steps to
    // the safe square, LOCKED, the beams fire, DODGED.
    const dir = join(out, "gif-dodge");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(5, 1);
      m.figureAt(m.ch.CHANDY_FIRE, "fire", 2);
      m.dock("Dodge! Find the one safe square.");
    });
    const safe = [-1, 0];
    const steps = [
      [120, { zoom: 1.13 }],
      [120, { zoom: 1.27 }],
      [160, { safe, clones: 0 }],
      [120, { safe, clones: 1, ghost: [0.5] }],
      [120, { safe, clones: 2, ghost: [1, 0.5] }],
      [120, { safe, clones: 3, ghost: [1, 1, 0.5] }],
      [120, { safe, clones: 4, ghost: [1, 1, 1, 0.5] }],
    ];
    for (let t = 3; t > 0.01; t -= 0.25)
      steps.push([
        250,
        { safe, lines: "aim", t, king: t < 1.6 ? safe : [0, 0] },
      ]);
    steps.push([300, { safe, lines: "aim", t: 0, locked: true, king: safe }]);
    for (let i = 0; i < 6; i++)
      steps.push([
        70,
        {
          safe,
          lines: "beam",
          beamFrame: i % 2,
          t: 0,
          locked: true,
          king: safe,
        },
      ]);
    steps.push([
      1100,
      { safe, lines: "beam", t: 0, locked: true, king: safe, result: "dodged" },
    ]);
    let i = 0;
    for (const [ms, st] of steps) {
      await p.evaluate((st) => window.__mk.dodge({ round: 1, ...st }), st);
      for (let k = 0; k < Math.round(ms / 40); k++)
        await p.screenshot({
          path: join(dir, `${String(i++).padStart(4, "0")}.png`),
        });
    }
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-framerate",
      "25",
      "-i",
      join(dir, "%04d.png"),
      "-vf",
      "scale=390:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse",
      join(out, `${device}-dodge.gif`),
    ]);
    rmSync(dir, { recursive: true, force: true });
    console.log("gif dodge");
  },
  async queenAim(p) {
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(5, 1);
      m.figureAt(m.ch.CHANDY, "point", 3);
      const ps = m.pieces();
      const q = Object.keys(ps).find((s) => ps[s] === "Q") ?? "d1";
      m.onSquare(m.fx.CROSSHAIR, "held", 1, q);
      // The aim: a dashed line from his edge straight down her file to her.
      for (let r = 8; r > Number(q[1]); r--)
        m.onSquare(
          m.fx.LINE_TILE,
          "aimCyan",
          0,
          `${q[0]}${r}`,
        ).style.transform = "rotate(90deg)";
      m.dock("Queen lock: he fires at her next.");
    });
    await shot(p, "queen-lock-aim");
  },
  async queenShot(p) {
    // Your answer: the queen steps behind a pawn (here d1 to e2, behind the e4 pawn), then he fires down her new file.
    const b = await p.evaluate(() =>
      (({ left, top, width }) => ({ left, top, width }))(
        document.querySelector(".board").getBoundingClientRect(),
      ),
    );
    const tap = async (s) => {
      const q = b.width / 8;
      await p.mouse.click(
        b.left + (s.charCodeAt(0) - 97 + 0.5) * q,
        b.top + (8 - Number(s[1]) + 0.5) * q,
      );
    };
    const before = await p.evaluate(() => window.__mk.fen());
    // Her answer: a queen move (a slide along a clear line) to a square with one of your pawns in front of her on its file.
    const pick = await p.evaluate(() => {
      const ps = window.__mk.pieces();
      const q = Object.keys(ps).find((s) => ps[s] === "Q");
      const F = (s) => s.charCodeAt(0) - 97;
      const name = (f, r) => `${String.fromCharCode(97 + f)}${r}`;
      const out = [];
      for (const [df, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
        [0, -1],
      ])
        for (let k = 1; k < 8; k++) {
          const f = F(q) + df * k;
          const r = Number(q[1]) + dr * k;
          if (f < 0 || f > 7 || r < 1 || r > 8 || ps[name(f, r)]) break;
          if (f === F(q)) continue;
          let first = null;
          for (let rr = r + 1; rr <= 8 && !first; rr++)
            if (ps[name(f, rr)]) first = ps[name(f, rr)];
          if (first === "P") out.push(name(f, r));
        }
      return [q, out[0]];
    });
    console.log("queen answer", pick);
    if (pick[1]) {
      await tap(pick[0]);
      await p.waitForTimeout(200);
      await tap(pick[1]);
      await p.waitForTimeout(700);
    }
    const t0 = Date.now();
    while (
      Date.now() - t0 < 60000 &&
      !(await p.evaluate(
        () =>
          /Your move/.test(document.body.innerText) &&
          !window.match?.phase?.thinking,
      ))
    )
      await p.waitForTimeout(300);
    await p.waitForTimeout(600);
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(5, 1);
      m.figureAt(m.ch.CHANDY_FIRE, "fire", 3);
      const ps = m.pieces();
      const q = Object.keys(ps).find((s) => ps[s] === "Q");
      const f = q[0];
      let blocker = null;
      for (let r = Number(q[1]) + 1; r <= 8 && !blocker; r++)
        if (ps[`${f}${r}`] && /[A-Z]/.test(ps[`${f}${r}`]))
          blocker = `${f}${r}`;
      m.onSquare(m.fx.CROSSHAIR, "held", 1, q);
      const top = blocker ? Number(blocker[1]) : Number(q[1]);
      for (let r = 8; r > top; r--)
        m.onSquare(m.fx.PIERCING_ROUND, "trail", 0, `${f}${r}`);
      m.onSquare(
        m.fx.PIERCING_ROUND,
        "fly",
        0,
        `${f}${top + 1}`,
      ).style.transform = "rotate(90deg)";
      if (blocker) m.onSquare(m.fx.SHATTER, "shatter", 1, blocker, 1.6);
      m.dock(
        blocker
          ? `Queen lock: a ${{ P: "pawn", N: "knight", B: "bishop", R: "rook" }[ps[blocker]] ?? "piece"} took it.`
          : "Queen lock: your queen falls.",
      );
    });
    await shot(p, "queen-lock-shot");
  },
  async dodge2Gif(p) {
    // About 7 s: the scope-in on your king, his slide to the center, the scope opens on a blank board, one round with the vote.
    const dir = join(out, "gif-dodge2");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(5, 1);
      m.figureAt(m.ch.CHANDY_FIRE, "fire", 2);
      m.dock("Dodge! He's targeting your king.");
    });
    const safe = [1, 1];
    const steps = [[400, {}]];
    for (const R of [200, 140, 90, 50, 34]) steps.push([90, { hole: R }]);
    steps.push([300, { hole: 34 }]);
    for (let i = 1; i <= 6; i++) steps.push([80, { hole: 34, slide: i / 6 }]);
    steps.push([200, { hole: 34, slide: 1 }]);
    for (const [R, op, blank] of [
      [60, 0.8, true],
      [120, 0.55, true],
      [220, 0.3, true],
    ])
      steps.push([90, { hole: R, scope: op, slide: 1, blank }]);
    steps.push([300, { slide: 1, blank: true }]);
    for (let n = 1; n <= 4; n++)
      steps.push([
        110,
        {
          blank: true,
          slide: 1,
          safe,
          clones: n,
          ghost: [1, 1, 1, 1].map((g, i) => (i === n - 1 ? 0.5 : 1)),
        },
      ]);
    const votes = [
      {},
      { f3: 1 },
      { f3: 1, e3: 2 },
      { f3: 3, e3: 2 },
      { f3: 4, e3: 2, d5: 1 },
      { f3: 6, e3: 2, d5: 1 },
    ];
    let v = 0;
    for (let t = 3; t > 0.01; t -= 0.25) {
      if (t < 2.6 && v < votes.length - 1 && Math.round(t * 4) % 2 === 0) v++;
      steps.push([
        250,
        {
          blank: true,
          slide: 1,
          safe,
          lines: "aim",
          t,
          votes: votes[v],
          mine: t < 2.2 ? "f3" : undefined,
        },
      ]);
    }
    steps.push([
      350,
      {
        blank: true,
        king: "f3",
        safe,
        lines: "aim",
        t: 0,
        locked: true,
        votes: votes[5],
        mine: "f3",
      },
    ]);
    for (let i = 0; i < 6; i++)
      steps.push([
        70,
        {
          blank: true,
          king: "f3",
          safe,
          lines: "beam",
          beamFrame: i % 2,
          t: 0,
          locked: true,
        },
      ]);
    steps.push([
      1200,
      {
        blank: true,
        king: "f3",
        safe,
        lines: "beam",
        t: 0,
        locked: true,
        result: "dodged",
      },
    ]);
    let i = 0;
    for (const [ms, st] of steps) {
      await p.evaluate((st) => window.__mk.dodge2({ round: 1, ...st }), st);
      for (let k = 0; k < Math.round(ms / 40); k++)
        await p.screenshot({
          path: join(dir, `${String(i++).padStart(4, "0")}.png`),
        });
      if (ms === 300 && st.hole === 34 && !st.slide)
        await p.screenshot({ path: join(out, `${device}-dodge-scope-in.png`) });
    }
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-framerate",
      "25",
      "-i",
      join(dir, "%04d.png"),
      "-vf",
      "scale=390:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse",
      join(out, `${device}-dodge-2b.gif`),
    ]);
    rmSync(dir, { recursive: true, force: true });
    console.log("gif dodge-2b");
  },
  async dodge2Vote(p) {
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(5, 1);
      m.figureAt(m.ch.CHANDY_FIRE, "fire", 2);
      m.dodge2({
        blank: true,
        slide: 1,
        safe: [1, 1],
        lines: "aim",
        t: 1.4,
        round: 1,
        votes: { f3: 6, e3: 2, d5: 1 },
        mine: "f3",
      });
      m.dock("Dodge! Vote for a square.");
    });
    await shot(p, "dodge-vote");
  },
  async dodge2Random(p) {
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(5, 1);
      m.figureAt(m.ch.CHANDY_FIRE, "fire", 2);
      m.dodge2({
        blank: true,
        king: "d5",
        safe: [-1, -1],
        lines: "aim",
        t: 0,
        locked: true,
        random: true,
        round: 2,
      });
      m.dock("Nobody voted: a random square.");
    });
    await shot(p, "dodge-nobody-voted");
  },
  async queenWarn(p) {
    await p.evaluate(() => {
      const m = window.__mk;
      m.barAt(5, 1);
      m.figureAt(m.ch.CHANDY, "point", 3);
      const ps = m.pieces();
      const q = Object.keys(ps).find((s) => ps[s] === "Q") ?? "d1";
      m.onSquare(m.fx.CROSSHAIR, "held", 1, q);
      m.dock("Queen lock: move your queen!");
    });
    await shot(p, "move-queen-warn");
  },
};

// The Boss Battle screen's tiles, Chandy's tile picked (his figure on the stage too): its own page, not a battle.
async function tileScene() {
  const p = await browser.newPage({ ...ctx, colorScheme: "dark" });
  await p.addInitScript(() => {
    try {
      localStorage.setItem("hunchess.tutorial.dismissed", "1");
      localStorage.setItem("hunchess.quests.seenDay", "9999-12-31");
      localStorage.setItem("hunchess.quests.noPop", "1");
    } catch {}
  });
  await p.goto(`${url}?debug&nolanding`);
  await p
    .getByRole("main")
    .getByRole("button", { name: /^Boss Battle/ })
    .click();
  await p
    .getByRole("radiogroup", { name: "Bosses" })
    .getByRole("radio", { name: "Chub & Chirp", exact: true })
    .click();
  await p.waitForTimeout(1500);
  await p.evaluate(setup);
  await p.evaluate(() => {
    const m = window.__mk;
    const radio = [...document.querySelectorAll('[role="radio"]')].find((r) =>
      /Chub/.test(r.getAttribute("aria-label") ?? r.textContent),
    );
    const art = radio?.querySelector("canvas.bs-art");
    if (art) {
      const c = m.canvasOf(m.ch.CHANDY, "idle", 0);
      art.width = c.width;
      art.height = c.height;
      art.getContext("2d").drawImage(c, 0, 0);
      const f = m.ch.CHANDY_SELECT_FRAMING;
      Object.entries({
        "--ax": f.neck[0],
        "--ay": f.neck[1],
        "--aw": c.width,
        "--ah": c.height,
        "--span": f.span,
        "--at": f.at,
      }).forEach(([k, v]) => art.style.setProperty(k, String(v)));
    }
    // The stage's big figure (the select screen's `.bs-sprite`), and its line hidden.
    document
      .querySelectorAll(".bs-bubble")
      .forEach((e) => (e.style.visibility = "hidden"));
    for (const spr of document.querySelectorAll(
      ".bs-sprite, .bs-sprite canvas",
    )) {
      if (spr.tagName !== "CANVAS") continue;
      const r = spr.getBoundingClientRect();
      if (!r.width) continue;
      spr.style.visibility = "hidden";
      const c = m.canvasOf(m.ch.CHANDY, "idle", 0);
      const s = Math.max(1, Math.round((r.height / spr.height) * 2) / 2);
      m.place(
        c,
        r.left + r.width / 2 - m.ch.CHANDY_FOOT[0] * s,
        r.bottom - (m.ch.CHANDY_FOOT[1] + 2) * s,
        s,
      );
    }
    m.setText(/Chub & Chirp/g, "Chandy");
  });
  await shot(p, "select-tile");
  await p.close();
}

const scenes =
  want ??
  (device === "desktop"
    ? ["lock", "upgrade"]
    : [
        "lock",
        "upgrade",
        "upgradeGif",
        "scatter",
        "beam",
        "shields",
        "rapid",
        "queenWarn",
        "queen",
      ]);
for (const s of scenes) {
  if (s === "tile") {
    await tileScene();
    continue;
  }
  const p = await battle();
  await SCENES[s](p);
  await p.close();
}
await browser.close();
await server.close();
