// Draws two top-down plans of HunChess's town (north up): today's, from packages/app/src/town/world.ts, and a proposal.
const fs = require("fs");
const { chromium } = require("playwright");

const C = {
  bg: "#f4efe4", ink: "#2a2a2a", soft: "#6b6457", lightSq: "#efd9b0", darkSq: "#d9b27a", paving: "#e6e2da", grass: "#8fca6a",
  tree: "#3f8f3a", water: "#5ab0e0", coliseum: "#c9b48a", filler: "#cfc6b6", fillerInk: "#5b5346", hedge: "#5d9a4a", sidewalk: "#d8d4cc",
};

function svgDoc(w, h, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:${C.bg}}text{font-family:Inter,Arial,sans-serif}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg></body></html>`;
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ---------------------------------------------------------------- Today's town (46 x 46, wraps at its edges)
function nowMap() {
  const N = 46, S = 15, ox = 30, oy = 70; // r rises northward: screen y = N-1-r
  const X = (c) => ox + c * S, Y = (r) => oy + (N - 1 - r) * S;
  let b = "";
  b += `<text x="${ox}" y="34" font-size="24" font-weight="700" fill="${C.ink}">HunChess town today: top-down plan (north up)</text>`;
  b += `<text x="${ox}" y="56" font-size="13" fill="${C.soft}">46 x 46 squares; walk off one edge and you come back on the other.</text>`;
  b += `<defs><clipPath id="m"><rect x="${ox}" y="${oy}" width="${N * S}" height="${N * S}"/></clipPath></defs>`;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) b += `<rect x="${X(c)}" y="${Y(r)}" width="${S}" height="${S}" fill="${(c + r) % 2 ? C.lightSq : C.darkSq}"/>`;
  // Park (world.ts PARK_PLAN), rows from r1 (north) down.
  const plan = ["====================","=.t..sTs====sTs..t.=","=...b...====...b...=","=t...sTs====sTs...t=","=......B====B......=","=.t..sTs=Ff=sTs..t.=","=......==ff==......=","=t...sTs====sTs...t=","=...b...====...b...=","=.t..sTs====sTs..t.=","===================="];
  const C0 = 13, R1 = 20;
  plan.forEach((line, v) => [...line].forEach((ch, u) => {
    const c = C0 + u, r = R1 - v;
    const grass = ".tb".includes(ch);
    b += `<rect x="${X(c)}" y="${Y(r)}" width="${S}" height="${S}" fill="${grass ? C.grass : C.paving}"/>`;
    if (ch === "t") b += `<circle cx="${X(c) + S / 2}" cy="${Y(r) + S / 2}" r="${S * 0.45}" fill="${C.tree}"/>`;
    if (ch === "T") b += `<rect x="${X(c) + 2}" y="${Y(r) + 2}" width="${S - 4}" height="${S - 4}" fill="#6b4a2a"/>`;
  }));
  b += `<circle cx="${X(22) + S}" cy="${Y(15) + S}" r="${S * 0.9}" fill="${C.water}" stroke="#fff" stroke-width="2"/>`;
  // Apron + walk between the park and the Colosseum.
  for (let r = 25; r < 28; r++) for (let c = 17; c < 29; c++) b += `<rect x="${X(c)}" y="${Y(r)}" width="${S}" height="${S}" fill="${C.paving}"/>`;
  for (let r = 21; r < 25; r++) for (let c = 21; c < 25; c++) b += `<rect x="${X(c)}" y="${Y(r)}" width="${S}" height="${S}" fill="${C.paving}"/>`;
  // Colosseum 12 x 12 at c 17..28, r 28..39.
  b += `<rect x="${X(17)}" y="${Y(39)}" width="${12 * S}" height="${12 * S}" fill="${C.coliseum}" stroke="#8a7650" stroke-width="2" rx="40"/>`;
  b += `<text x="${X(23)}" y="${Y(33) + 6}" font-size="15" font-weight="700" text-anchor="middle" fill="${C.ink}">The Colosseum</text>`;
  b += `<text x="${X(23)}" y="${Y(16)}" font-size="14" font-weight="700" text-anchor="middle" fill="${C.ink}">Park (10 tables, fountain)</text>`;
  b += `<text x="${X(23)}" y="${Y(17) - 2}" font-size="11" text-anchor="middle" fill="${C.ink}">you start here</text>`;
  const homes = [
    ["Ginger Igloo","#3fae4f",39,11],["Jefferson's Fireworks","#e5566a",39,3],["Babur's Circus","#2f7fe0",28,4],["Big Boy's Crib","#23a8a8",43,31],
    ["Hollow Peak","#7a4fd0",0,43],["Moo & Moon Meadow","#5d7ad8",8,40],["Alfil's Pyramid","#b4840f",23,43],["Smudgy's Art Gallery","#f5832d",35,40],
    ["Boingo's Funhouse","#7d3b93",5,27],["Chub & Chirp's Grassland","#447a1f",6,8],["Puddles' Botanical Garden","#d6747b",16,2],["Sawyer's Woodshed","#d39a0b",40,23],
    ["Wrangler's Stall","#8f5629",4,17],["Folio's Folded House","#d8432a",35,30],["Timber's Lumber Lodge*","#ea7816",11,32],["Dash's Kicks*","#137a7a",4,34],
  ];
  for (const [name, col, cx, cy] of homes) {
    const dashed = name.endsWith("*");
    for (const dx of [0, N, -N]) b += `<rect clip-path="url(#m)" x="${X(cx - 1 + dx)}" y="${Y(cy + 1)}" width="${3 * S}" height="${3 * S}" fill="${col}" stroke="#fff" stroke-width="2" ${dashed ? 'stroke-dasharray="4 3"' : ""}/>`;
    const tx = Math.min(Math.max(X(cx) + S / 2, ox + 60), ox + N * S - 60);
    b += `<text x="${tx}" y="${Y(cy + 1) - 4}" font-size="11" font-weight="700" text-anchor="middle" fill="${C.ink}" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(name)}</text>`;
  }
  b += `<text x="${ox}" y="${oy + N * S + 22}" font-size="12" fill="${C.soft}">* Timber's and Dash's homes show in admins' town only for now. Hollow Peak sits on the wrap seam.</text>`;
  const w = ox * 2 + N * S, h = oy + N * S + 40;
  return svgDoc(w, h, `<rect width="${w}" height="${h}" fill="${C.bg}"/>` + b);
}

// ---------------------------------------------------------------- The proposal (66 x 66, north up, y down = south)
function proposal() {
  const G = 66, S = 14, ox = 30, oy = 80, LW = 440;
  const X = (x) => ox + x * S, Y = (y) => oy + y * S;
  const cell = Array.from({ length: G }, () => Array(G).fill("lawn"));
  const fill = (x0, y0, w, h, k, only) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < G && y < G && (!only || cell[y][x] === only)) cell[y][x] = k; };
  // Town edge: hedges and trees all round (no wrap).
  fill(0, 0, G, 2, "edge"); fill(0, G - 2, G, 2, "edge"); fill(0, 0, 2, G, "edge"); fill(G - 2, 0, 2, G, "edge");
  // Dark woods round Hollow, south-west.
  fill(2, 52, 10, 12, "woods");
  // Ring street: 4 squares of chessboard, a sidewalk either side.
  fill(12, 16, 42, 6, "walk"); fill(12, 52, 42, 6, "walk"); fill(12, 16, 6, 42, "walk"); fill(48, 16, 6, 42, "walk");
  fill(13, 17, 40, 4, "street"); fill(13, 53, 40, 4, "street"); fill(13, 17, 4, 40, "street"); fill(49, 17, 4, 40, "street");
  // The four avenues out of the park: north to the ring (the Colosseum's plaza beyond), south to the town gate, east and west to the edge.
  fill(30, 22, 6, 5, "walk"); fill(31, 22, 4, 5, "street");
  fill(30, 47, 6, 17, "walk"); fill(31, 47, 4, 17, "street");
  fill(2, 34, 21, 6, "walk", "lawn"); fill(2, 34, 21, 6, "walk", "woods"); fill(2, 35, 21, 4, "street"); fill(13, 34, 4, 6, "street");
  fill(43, 34, 21, 6, "walk", "lawn"); fill(43, 35, 21, 4, "street"); fill(49, 34, 4, 6, "street");
  fill(31, 16, 4, 6, "street"); fill(31, 52, 4, 6, "street"); fill(30, 58, 1, 6, "walk"); fill(35, 58, 1, 6, "walk");
  // The Colosseum and its plaza north of the ring street.
  fill(27, 2, 12, 12, "coliseum"); fill(24, 14, 18, 2, "plaza");
  // The park in the middle, 20 x 20, a paved cross through it.
  fill(23, 27, 20, 20, "park"); fill(31, 27, 4, 20, "cross"); fill(23, 35, 20, 4, "cross");
  let b = "";
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const k = cell[y][x];
    const f = { lawn: "#b9dd8f", edge: C.hedge, woods: "#3d5a3a", street: (x + y) % 2 ? C.lightSq : C.darkSq, walk: C.sidewalk, coliseum: C.coliseum, plaza: C.paving, park: C.grass, cross: (x + y) % 2 ? "#f1ece2" : "#e2dccf" }[k];
    b += `<rect x="${X(x)}" y="${Y(y)}" width="${S}" height="${S}" fill="${f}"/>`;
    if ((k === "edge" && (x * 7 + y * 3) % 4 === 0) || (k === "woods" && (x * 5 + y * 11) % 3 === 0)) b += `<circle cx="${X(x) + S / 2}" cy="${Y(y) + S / 2}" r="${S * 0.6}" fill="${k === "woods" ? "#24361f" : C.tree}"/>`;
  }
  b += `<rect x="${X(27)}" y="${Y(2)}" width="${12 * S}" height="${12 * S}" fill="${C.coliseum}" stroke="#8a7650" stroke-width="2" rx="44"/>`;
  const label = (x, y, t, o = {}) => (b += `<text x="${X(x)}" y="${Y(y)}" font-size="${o.size || 11}" font-weight="700" text-anchor="middle" fill="${o.col || C.ink}" paint-order="stroke" stroke="${o.halo || "#fff"}" stroke-width="3">${esc(t)}</text>`);
  label(33, 8.4, "The Colosseum", { size: 16, halo: C.coliseum });
  label(33, 15.2, "Colosseum Plaza (statues)", { size: 11, halo: C.paving });
  // Park details: fountain, ten tables, trees, benches.
  b += `<circle cx="${X(33)}" cy="${Y(37)}" r="${S * 1.7}" fill="${C.water}" stroke="#fff" stroke-width="3"/>`;
  for (const [tx, ty] of [[26, 29], [26, 32], [38, 29], [38, 32], [26, 41], [26, 44], [38, 41], [38, 44], [28, 30.5], [36, 42.5]]) b += `<rect x="${X(tx) + 2}" y="${Y(ty) + 2}" width="${S - 4}" height="${S - 4}" fill="#6b4a2a"/>`;
  for (const [tx, ty] of [[24, 28], [41, 28], [24, 45], [41, 45], [29, 28], [36, 45], [24, 33], [41, 40], [29, 45], [36, 28]]) b += `<circle cx="${X(tx) + S / 2}" cy="${Y(ty) + S / 2}" r="${S * 0.65}" fill="${C.tree}"/>`;
  label(33, 31, "The Park", { size: 13 }); label(33, 32.1, "(you start here)", { size: 10 });
  label(33, 65.6, "Town gate", { size: 11, col: "#fff", halo: C.hedge });
  // Lots, 3 x 3 (landmarks 4 x 4): [x, y, boss key or null, house type, size]
  const BOSS = {
    folio: ["Folio", "#d8432a"], smudgy: ["Smudgy", "#f5832d"], alfil: ["Alfil", "#b4840f"], babur: ["Babur", "#2f7fe0"],
    ginger: ["Ginger", "#3fae4f"], jeff: ["Jefferson", "#e5566a"], sawyer: ["Sawyer", "#d39a0b"], timber: ["Timber", "#ea7816"],
    pig: ["Wrangler", "#8f5629"], moo: ["Moo & Moon", "#5d7ad8"], hopper: ["Chub & Chirp", "#447a1f"], puddles: ["Puddles", "#d6747b"],
    boingo: ["Boingo", "#7d3b93"], bigboy: ["Big Boy", "#23a8a8"], dash: ["Dash", "#137a7a"], hollow: ["Hollow", "#7a4fd0"],
  };
  const lots = [
    // North: Gallery Walk (park to the ring), Alfil and Babur flank the Colosseum.
    [22, 23, null, "A"], [26, 23, "folio"], [37, 23, "smudgy"], [41, 23, null, "D"], [20, 7, "alfil", null, 4], [42, 7, "babur", null, 4],
    // Corners of the inner blocks.
    [18.5, 23, null, "E"], [44.5, 23, null, "B"], [18.5, 48, null, "C"], [44.5, 48, null, "F"],
    // East: Fire & Ice Row.
    [44, 27, null, "C"], [44, 31, "ginger"], [55, 31, "jeff"], [59, 31, null, "A"], [44, 40, "sawyer"], [44, 44, null, "D"], [55, 40, "timber"], [59, 40, null, "E"],
    // West: Funfair Street.
    [19, 27, null, "B"], [19, 31, "boingo"], [8, 31, "bigboy"], [4, 31, null, "F"], [19, 40, "dash"], [19, 44, null, "A"], [8, 40, null, "C"], [4, 40, null, "D"],
    // South: Meadow Lane, on to the town gate.
    [22, 48, null, "B"], [26, 48, "pig"], [37, 48, "moo"], [41, 48, null, "E"], [26, 59, "hopper"], [22, 59, null, "D"], [37, 59, "puddles"], [41, 59, null, "A"],
    // Hollow in the dark woods.
    [4, 56, "hollow", null, 4],
    // Everyday houses facing the ring street from outside.
    [4, 18, null, "A"], [8, 18, null, "E"], [55, 18, null, "C"], [59, 18, null, "B"], [55, 59, null, "F"], [59, 59, null, "D"],
  ];
  for (const [x, y, k, type, size = 3] of lots) {
    if (k) {
      const [name, col] = BOSS[k];
      b += `<rect x="${X(x) - 4}" y="${Y(y) - 4}" width="${size * S + 8}" height="${size * S + 8}" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="3 3" rx="5"/>`;
      b += `<rect x="${X(x)}" y="${Y(y)}" width="${size * S}" height="${size * S}" fill="${col}" stroke="#fff" stroke-width="2" rx="3"/>`;
      b += `<text x="${X(x) + (size * S) / 2}" y="${Y(y) + size * S + 15}" font-size="11" font-weight="700" text-anchor="middle" fill="${col}" paint-order="stroke" stroke="#fff" stroke-width="3.5">${esc(name)}</text>`;
    } else {
      b += `<rect x="${X(x) + 1}" y="${Y(y) + 1}" width="${3 * S - 2}" height="${3 * S - 2}" fill="${C.filler}" stroke="${C.fillerInk}" stroke-width="1" rx="2"/>`;
      b += `<text x="${X(x) + 1.5 * S}" y="${Y(y) + 1.5 * S + 5}" font-size="14" font-weight="700" text-anchor="middle" fill="${C.fillerInk}">${type}</text>`;
    }
  }
  // Street names.
  label(33, 25.3, "Gallery Walk", { size: 10 }); label(57.5, 37.4, "Fire & Ice Row"); label(7.5, 37.4, "Funfair Street"); label(33, 63, "Meadow Lane", { size: 10 });
  label(24, 19.4, "Ring Street"); label(7, 54, "dark woods", { col: "#fff", halo: "#24361f" });
  // Title and key.
  b = `<text x="${ox}" y="36" font-size="24" font-weight="700" fill="${C.ink}">A real town: proposed plan (north up, rough sketch)</text>` +
    `<text x="${ox}" y="60" font-size="13" fill="${C.soft}">About 66 x 66 squares (today 46 x 46). The park in the middle, four avenues out of it, a ring street, the Colosseum beyond it to the north.</text>` + b;
  const lx = ox + G * S + 28; let ly = oy + 4;
  const line = (t, o = {}) => { b += `<text x="${lx}" y="${ly}" font-size="${o.size || 13}" font-weight="${o.bold ? 700 : 400}" fill="${o.col || C.ink}">${esc(t)}</text>`; ly += o.gap || 19; };
  const swatch = (f, t, stroke) => { b += `<rect x="${lx}" y="${ly - 12}" width="16" height="16" fill="${f}" ${stroke ? `stroke="${stroke}" stroke-dasharray="3 3" stroke-width="2"` : ""}/>`; b += `<text x="${lx + 24}" y="${ly + 1}" font-size="13" fill="${C.ink}">${esc(t)}</text>`; ly += 22; };
  line("Key", { bold: true, size: 16, gap: 24 });
  b += `<rect x="${lx}" y="${ly - 12}" width="8" height="8" fill="${C.lightSq}"/><rect x="${lx + 8}" y="${ly - 12}" width="8" height="8" fill="${C.darkSq}"/><rect x="${lx}" y="${ly - 4}" width="8" height="8" fill="${C.darkSq}"/><rect x="${lx + 8}" y="${ly - 4}" width="8" height="8" fill="${C.lightSq}"/>`;
  b += `<text x="${lx + 24}" y="${ly + 1}" font-size="13" fill="${C.ink}">Street: still the chessboard, walkable, no cars</text>`; ly += 22;
  swatch(C.sidewalk, "Sidewalk on both sides of every street");
  swatch("#b9dd8f", "Lawns, front yards and back gardens");
  swatch(C.hedge, "Town edge: hedges and trees (no wrap)");
  swatch("#3fae4f", "A boss's home (all 16)");
  swatch("none", "Where that boss wanders: own lot + sidewalk", "#3fae4f");
  swatch(C.filler, "An everyday house, designs A to F");
  ly += 10;
  line("Six everyday house designs (new art)", { bold: true, size: 15, gap: 22 });
  for (const t of ["A  Little cottage, picket fence, flower boxes", "B  Two-storey townhouse with a front stoop", "C  Row of three skinny terraced houses", "D  Small apartment block with balconies", "E  Corner bakery or cafe front (decor only)", "F  House with a garden shed and veg patch"]) line(t);
  ly += 10;
  line("The four avenues", { bold: true, size: 15, gap: 22 });
  for (const t of ["North, Gallery Walk: Folio, Smudgy;", "   Alfil and Babur either side of the Colosseum", "East, Fire & Ice Row: Ginger, Jefferson,", "   Sawyer, Timber", "South, Meadow Lane to the town gate: Wrangler,", "   Moo & Moon, Chub & Chirp, Puddles", "West, Funfair Street: Boingo, Big Boy, Dash;", "   Hollow alone in the dark woods"]) line(t, { size: 12, gap: 17 });
  ly += 12;
  line("Open questions for Eric", { bold: true, size: 15, gap: 22 });
  for (const t of ["1. Keep the wrap, or give the town a real edge?", "2. Which boss goes on which avenue?", "3. Anything moving on the streets (a silly", "    trolley, a parade float), or people only?", "4. Can everyday houses be entered? (Sketch: no)"]) line(t, { size: 12, gap: 17 });
  const w = lx + LW, h = Math.max(oy + G * S + 30, ly + 20);
  return svgDoc(w, h, `<rect width="${w}" height="${h}" fill="${C.bg}"/>` + b);
}

(async () => {
  fs.writeFileSync("town-now.html", nowMap());
  fs.writeFileSync("town-proposal.html", proposal());
  const br = await chromium.launch();
  for (const f of ["town-now", "town-proposal"]) {
    const p = await br.newPage({ deviceScaleFactor: 2 });
    await p.goto("file://" + process.cwd() + "/" + f + ".html");
    const svg = await p.$("svg");
    await svg.screenshot({ path: f + ".png" });
  }
  await br.close();
})();
