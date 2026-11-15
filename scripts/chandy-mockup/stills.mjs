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
      const s = device === "desktop" ? 1 : 1.5;
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
  window.__mk = {
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
      c.style.width = `${c.width * 3}px`;
      c.style.height = `${c.height * 3}px`;
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
        c.style.width = `${c.width * 3}px`;
        c.style.height = `${c.height * 3}px`;
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
          s2.style.cssText = `position:absolute;left:0;top:${step === "slide0" ? -30 : -10}px;width:${s2.width * 3}px;height:${s2.height * 3}px;image-rendering:pixelated`;
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
