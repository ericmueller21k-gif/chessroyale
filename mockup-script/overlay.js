// Throwaway mockup layer (never merged): draws the turf over a live board and the count + holds in the boss bar.
window.__mock = async function (cfg) {
  const HIS = "rgba(232, 115, 42, 0.26)";     // Chub's carrot orange (HOPPER_PALETTE R), soft
  const YOURS = "rgba(40, 105, 255, 0.26)";   // your side: a cool blue, apart from the last-move green
  const SOIL = "#3b3a1a";                     // the town ride's print (riding-chirp.tsx SOIL)
  document.querySelectorAll(".turf-mock").forEach((e) => e.remove());
  const board = document.querySelector(".hb-board");
  const flip = document.querySelector(".hb")?.classList.contains("orientation-black");
  const xy = (sq) => { const f = sq.charCodeAt(0) - 97, r = Number(sq[1]) - 1; return { x: flip ? 7 - f : f, y: flip ? r : 7 - r }; };
  const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => { const e = tag.startsWith("svg:") ? document.createElementNS(NS, tag.slice(4)) : document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; };
  // One Chirp print pair (riding-chirp.tsx printD/ChirpPrints), pointing along +x before rotation.
  const prints = (g, color, w) => {
    const pr = (x, y) => { const toes = [[5.2, -2.6], [6.2, 0], [5.2, 2.6]].map(([tx, ty]) => `M ${x + 1.2} ${y} L ${x + tx} ${y + ty}`).join(" "); el("svg:path", { d: toes, fill: "none", stroke: color, "stroke-linecap": "round", "stroke-width": w }, g); el("svg:ellipse", { cx: x - 0.6, cy: y, rx: 2.2, ry: 1.8, fill: color }, g); };
    pr(-3.2, -3.4 - 1.6); pr(-1.6, 3.4 - 1.6);
  };
  // ---- The board layer: under the last move, dots and pieces (first child of the squares' box).
  const layer = el("div", { class: "turf-mock", style: "position:absolute;inset:0;pointer-events:none;" });
  board.insertBefore(layer, board.firstChild);
  const cell = (sq, bg) => el("div", { style: `position:absolute;left:${xy(sq).x * 12.5}%;top:${xy(sq).y * 12.5}%;width:12.5%;height:12.5%;background:${bg};` }, layer);
  for (const sq of cfg.yours) cell(sq, YOURS);
  for (const sq of cfg.his) {
    const c = cell(sq, HIS);
    const fresh = (cfg.hop?.path ?? []).includes(sq);
    const svg = el("svg:svg", { viewBox: "-12 -12 24 24", style: "position:absolute;inset:14%;width:72%;height:72%;overflow:visible" }, c);
    const g = el("svg:g", { opacity: fresh ? 0.62 : 0.18, transform: `rotate(${90 + ((hash(sq) % 41) - 20)})` }, svg);
    prints(g, SOIL, 1.6);
  }
  // ---- The hop-around (still 2): the hopped squares' trail, the target, Chirp in the air.
  if (cfg.hop) {
    const over = el("div", { class: "turf-mock", style: "position:absolute;inset:0;pointer-events:none;z-index:5;" });
    board.appendChild(over);
    const svg = el("svg:svg", { viewBox: "0 0 800 800", style: "position:absolute;inset:0;width:100%;height:100%;overflow:visible" }, over);
    const c = (sq) => ({ x: xy(sq).x * 100 + 50, y: xy(sq).y * 100 + 50 });
    const pts = [...cfg.hop.path, cfg.hop.target].map(c);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 70;
      const last = i + 2 === pts.length;
      el("svg:path", { d: `M ${a.x} ${a.y - 10} Q ${mx} ${my} ${b.x} ${b.y - 10}`, fill: "none", stroke: last ? "#e8732a" : "rgba(59,58,26,0.55)", "stroke-width": last ? 7 : 5, "stroke-dasharray": last ? "14 12" : "2 12", "stroke-linecap": "round" }, svg);
    }
    // The open square he's about to land on: a carrot-orange ring.
    const t = c(cfg.hop.target);
    el("svg:rect", { x: t.x - 32, y: t.y - 32, width: 64, height: 64, rx: 10, fill: "none", stroke: "#e8732a", "stroke-width": 6, "stroke-dasharray": "16 10" }, svg);
    // Hop numbers on the three squares of his he bounces on.
    cfg.hop.path.forEach((sq, i) => { const p = c(sq); const g = el("svg:g", {}, svg); el("svg:circle", { cx: p.x + 30, cy: p.y - 30, r: 15, fill: "#2b5218", stroke: "#f8f0de", "stroke-width": 3 }, g); const tx = el("svg:text", { x: p.x + 30, y: p.y - 24.5, "text-anchor": "middle", "font-size": 18, "font-weight": 800, fill: "#f8f0de", "font-family": "system-ui, sans-serif" }, g); tx.textContent = String(i + 1); });
    // Chirp, airborne halfway along the last hop (the game's own sprite: leapfrog's highest frame).
    const { HOPPER } = await import("/src/characters/hopper.ts");
    const { renderFrame } = await import("/src/characters/sprite.ts");
    const fr = HOPPER.anims.leapfrog.frames[4];
    const img = renderFrame(HOPPER, fr);
    // (Airborne: the frame's own ground shadow, palette z, is left out; the board draws his shadow on the square below.)
    for (let i = 0; i < img.data.length; i += 4) if (img.data[i] === 13 && img.data[i + 1] === 14 && img.data[i + 2] === 18) img.data[i + 3] = 0;
    const cv = el("canvas", { width: img.w, height: img.h });
    cv.getContext("2d").putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
    const a = pts.at(-2), b = pts.at(-1);
    const u = 0.5, gx = a.x + (b.x - a.x) * u, gy = a.y + (b.y - a.y) * u, lift = 42;
    el("svg:ellipse", { cx: gx, cy: gy + 18, rx: 34, ry: 10, fill: "rgba(13,14,18,0.28)" }, svg);
    const bw = board.getBoundingClientRect().width, k = (bw / 800) * cfg.spriteScale; // css px per sprite px
    const right = b.x > a.x;
    const wrap = el("div", { style: `position:absolute;left:${(gx / 8) - (HOPPER.foot[0] * k / bw) * 100}%;top:${((gy - lift) / 8) - (HOPPER.foot[1] * k / bw) * 100}%;width:${(img.w * k / bw) * 100}%;transform:${right ? "scaleX(-1)" : "none"};` }, over);
    cv.style.cssText = "width:100%;image-rendering:pixelated;display:block;filter:drop-shadow(0 2px 0 rgba(0,0,0,0.25))";
    wrap.appendChild(cv);
    // His figure has left the bar (or the side) for the board: kept in its place, unseen.
    document.querySelectorAll(".boss-char").forEach((e) => { e.style.visibility = "hidden"; e.classList.add("turf-mock-hid"); });
  }
  // ---- The dock's line.
  if (cfg.dock) {
    const box = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && /^Your move\.?$/.test(e.textContent.trim()));
    if (box) { box.dataset.mockWas = box.textContent; box.textContent = cfg.dock; }
  }
  // ---- The boss bar: the count (hard numbers) and the three holds, greyed until held.
  const bar = document.querySelector(".boss-bar");
  const main = bar.querySelector(".boss-main");
  const phone = innerWidth < 700;
  const narrow = innerWidth < 360;
  const css = el("style", { class: "turf-mock" }, document.head);
  css.textContent = `
  .tm-count{display:flex;align-items:center;gap:${phone ? 7 : 8}px;font:700 ${phone ? 11.5 : 12}px/1 system-ui,-apple-system,sans-serif;color:#f3ece0;white-space:nowrap}
  .tm-count .tm-n{display:inline-flex;align-items:center;gap:4px}
  .tm-count b{font-weight:800;font-variant-numeric:tabular-nums}
  .tm-sw{width:11px;height:11px;border-radius:2px;background:var(--sq-light,#f0d9b5);position:relative;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,0.35)}
  .tm-sw i{position:absolute;inset:0}
  .tm-holds{display:flex;gap:4px;justify-content:flex-end}
  .tm-hold{display:inline-flex;align-items:center;gap:3px;height:18px;padding:0 6px;border-radius:9px;font:800 10px/1 system-ui,-apple-system,sans-serif;letter-spacing:.02em;color:rgba(243,236,224,0.42);background:rgba(255,255,255,0.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.14);white-space:nowrap}
  .tm-hold svg{width:11px;height:11px;flex:none}
  .tm-hold.on{color:#1b150e;background:#f79a3d;box-shadow:0 0 0 1px #ffc97e,0 0 8px rgba(247,154,61,0.7)}
  .tm-hold .tm-at{font-weight:700;opacity:.85}
  .tm-tip{position:absolute;z-index:50;width:${phone ? 236 : 260}px;padding:9px 11px;border-radius:10px;background:#1f1a14;color:#f3ece0;font:500 12.5px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,0.35),0 0 0 1px #f79a3d}
  .tm-tip strong{color:#ffc97e}
  .tm-tip::before{content:"";position:absolute;top:-6px;right:var(--tip-x,20px);width:10px;height:10px;background:#1f1a14;transform:rotate(45deg);box-shadow:-1px -1px 0 #f79a3d}
  `;
  const sw = (bg, withPrint) => { const s = el("span", { class: "tm-sw" }); if (bg) el("i", { style: `background:${bg}` }, s); if (withPrint) { const v = el("svg:svg", { viewBox: "-12 -12 24 24", style: "position:absolute;inset:0;width:100%;height:100%" }, s); const g = el("svg:g", { opacity: 0.55, transform: "rotate(90)" }, v); prints(g, SOIL, 2); } return s; };
  const count = el("span", { class: "tm-count turf-mock", role: "status", "aria-label": `Squares: ${cfg.names.his} ${cfg.counts.his}, you ${cfg.counts.yours}, open ${cfg.counts.open}` });
  const item = (bg, print, word, n) => { const s = el("span", { class: "tm-n" }, count); s.appendChild(sw(bg, print)); const t = el("span", {}, s); t.innerHTML = `${word} <b>${n}</b>`; };
  item(HIS, true, cfg.names.his, cfg.counts.his);
  item(YOURS, false, "You", cfg.counts.yours);
  item(null, false, "Open", cfg.counts.open);
  const ICON = {
    legs: '<svg viewBox="0 0 12 12"><path d="M3 7 L6 4 L9 7 M3 10.5 L6 7.5 L9 10.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fuse: '<svg viewBox="0 0 12 12"><circle cx="6" cy="6.8" r="4.3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 4.3 V6.9 L7.7 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M4.6 1.2 H7.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    double: '<svg viewBox="0 0 12 12"><path d="M1 9.5 Q3.3 3 5.6 9.5 M6.4 9.5 Q8.7 3 11 9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  };
  const holds = el("span", { class: "tm-holds turf-mock" });
  for (const h of cfg.holds) {
    const b = el("span", { class: `tm-hold${h.on ? " on" : ""}`, role: "button", "aria-label": `${h.name}: ${h.on ? "on" : `at ${h.at} squares`}`, title: h.tip, "data-hold": h.id }, holds);
    b.innerHTML = `${ICON[h.id]}${narrow ? "" : `<span>${h.short}</span>`}<span class="tm-at">${h.at}</span>`;
  }
  // Placement: a phone's bar is tall (his figure stands in it): the holds go under the status (the prop slot's top),
  // the count across the bar's bottom from the name column's left; a computer's bar is one line: both in the prop slot, right.
  main.style.position = "relative";
  if (phone) {
    const prop = bar.querySelector(".boss-prop");
    holds.style.cssText = "position:absolute;right:0;top:3px;";
    prop.appendChild(holds);
    count.style.cssText = "position:absolute;left:8px;bottom:3px;";
    main.appendChild(count);
  } else {
    const prop = bar.querySelector(".boss-prop");
    const row = el("span", { class: "turf-mock", style: "position:absolute;right:0;bottom:2px;display:flex;align-items:center;gap:10px;" }, prop);
    row.appendChild(count); row.appendChild(holds);
  }
  // ---- The tap text of a hold (still 3), floating under the bar, over the board (pushes nothing).
  if (cfg.tip) {
    const b = holds.querySelector(`[data-hold="${cfg.tip}"]`).getBoundingClientRect();
    const h = cfg.holds.find((x) => x.id === cfg.tip);
    const tip = el("div", { class: "tm-tip turf-mock" }, document.body);
    tip.innerHTML = `<strong>Long legs is on.</strong> ${cfg.names.his} holds ${cfg.counts.his} squares (${h.at}+): his pawns step 2 from any square, 3 from their start. Take squares back to switch it off.`;
    const w = phone ? 236 : 260;
    const left = Math.max(8, Math.min(innerWidth - w - 8, b.right - w + 14));
    tip.style.left = `${left}px`; tip.style.top = `${bar.getBoundingClientRect().bottom + 8}px`;
    tip.style.setProperty("--tip-x", `${left + w - (b.left + b.width / 2) - 5}px`);
  }
  // Fit check: everything inside the screen and the bar.
  const out = [];
  for (const e of document.querySelectorAll(".turf-mock, .tm-tip, .turf-mock canvas")) { const r = e.getBoundingClientRect(); if (r.width && (r.left < 0 || r.right > innerWidth + 0.5 || r.top < 0 || r.bottom > innerHeight)) out.push(e.className); }
  const br = bar.getBoundingClientRect(), cr = count.getBoundingClientRect(), hr = holds.getBoundingClientRect();
  if (!phone) { const pr = bar.querySelector('.boss-prop').getBoundingClientRect(); if (cr.left < pr.left) out.push('row past the prop slot ' + Math.round(cr.left) + '<' + Math.round(pr.left)); }
  return { out, count: [cr.left, cr.right, cr.top, cr.bottom].map(Math.round), holds: [hr.left, hr.right, hr.top, hr.bottom].map(Math.round), bar: [br.left, br.right, br.top, br.bottom].map(Math.round) };
};
