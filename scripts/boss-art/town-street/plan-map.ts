/**
 * The street town's overhead plan (Nov 5 mockup), north up, from plan.ts: the streets (the chessboard), the sidewalks, the
 * plus park and its 12 tables, the Colosseum in its grove, every lot (the boss homes named, the everyday ones by design,
 * the bigger buildings behind), the back gardens, and the camera's facing on each street.
 *
 *   npx tsx scripts/boss-art/town-street/plan-map.ts <out.png>
 */
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { ARENA, BOARD, COLISEUM, GARDEN, GRASS, HOME_INFO, LOT, LOTS, N, PAVE, PROPS, STREETS, TABLES, ground, type HomeId } from "./plan.ts";
import { DESIGN_NAMES } from "./facades.ts";

const out = process.argv[2] ?? "plan.png";
const S = 19;
const ox = 34, oy = 96;
const X = (c: number) => ox + c * S;
const Y = (r: number) => oy + (N - 1 - r) * S; // top edge of row r
const C = { bg: "#f4efe4", ink: "#2a2a2a", soft: "#6b6457", light: "#efd9b0", dark: "#d9b27a", pave: "#e3ded4", grass: "#8fca6a", garden: "#b9dc9c", arena: "#c9b48a", tree: "#3f8f3a", water: "#5ab0e0" };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const WALL = ["#f1d78f", "#a9c7e4", "#b1dbbf", "#efb3bf", "#c6bae8", "#f0b88d", "#d8d0c2"];
const ROOF = ["#b8453a", "#566a8f", "#568c50", "#8a6244", "#3f8c8a"];

let b = "";
b += `<text x="${ox}" y="38" font-size="26" font-weight="700" fill="${C.ink}">A street town: revised plan (north up)</text>`;
b += `<text x="${ox}" y="64" font-size="14" fill="${C.soft}">46 × 46 squares, as today, and it still wraps: walk off any edge and you're back on the opposite one. The two seam streets run along the wrap's seams</text>`;
b += `<text x="${ox}" y="82" font-size="14" fill="${C.soft}">(you see half of each at either edge). Arrows: which way the camera faces on that street. Every street's fronts face the camera; the other side is back gardens.</text>`;
b += `<defs><clipPath id="m"><rect x="${ox}" y="${oy}" width="${N * S}" height="${N * S}"/></clipPath>
<marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1f2530"/></marker></defs>`;
b += `<g clip-path="url(#m)">`;
for (let r = 0; r < N; r++)
  for (let c = 0; c < N; c++) {
    const g = ground[r * N + c]!;
    const fill = g === BOARD ? ((c + r) % 2 ? C.light : C.dark) : g === PAVE ? C.pave : g === GRASS ? C.grass : g === ARENA ? C.arena : C.garden;
    b += `<rect x="${X(c)}" y="${Y(r)}" width="${S}" height="${S}" fill="${fill}"/>`;
  }
// The Colosseum.
b += `<rect x="${X(COLISEUM.c0) + 2}" y="${Y(COLISEUM.r0 + COLISEUM.size - 1) + 2}" width="${COLISEUM.size * S - 4}" height="${COLISEUM.size * S - 4}" rx="${S * 3.5}" fill="${C.arena}" stroke="#8a7650" stroke-width="2.5"/>`;
b += `<ellipse cx="${X(COLISEUM.c0 + 6)}" cy="${Y(COLISEUM.r0 + 6)}" rx="${S * 3.6}" ry="${S * 3.6}" fill="#e6d7b0" stroke="#8a7650" stroke-width="1.5"/>`;
b += `<text x="${X(COLISEUM.c0 + 6)}" y="${Y(COLISEUM.r0 + 6) + 6}" font-size="17" font-weight="700" text-anchor="middle" fill="${C.ink}">The Colosseum</text>`;
b += `<text x="${X(COLISEUM.c0 + 6)}" y="${Y(COLISEUM.r0 + 6) + 24}" font-size="11" text-anchor="middle" fill="${C.ink}">gate faces south; trees all round</text>`;
for (const c of [17, 28]) b += `<rect x="${X(c) + 4}" y="${Y(27) + 4}" width="${S - 8}" height="${S - 8}" fill="#fff" stroke="#8a7650"/>`;
// Lots.
for (const l of LOTS) {
  const [c0, r1, w, h] = l.facing === "S" ? [l.c0, l.r0 + l.d - 1, l.w, l.d] : [l.c0, l.r0 + l.w - 1, l.d, l.w];
  for (const dx of [0, N, -N]) {
    const x = X(c0 + dx), y = Y(r1);
    const W = w * S, H = h * S;
    if (l.kind === "home") {
      const info = HOME_INFO[l.id as HomeId];
      b += `<rect x="${x + 1.5}" y="${y + 1.5}" width="${W - 3}" height="${H - 3}" fill="${info.color}" stroke="#fff" stroke-width="2.5" rx="2"/>`;
    } else if (l.kind === "tall") {
      b += `<rect x="${x + 5}" y="${y + 5}" width="${W - 4}" height="${H - 4}" fill="#0004" rx="1"/>`;
      b += `<rect x="${x + 1}" y="${y + 1}" width="${W - 4}" height="${H - 4}" fill="#8792a6" stroke="#4d5668" stroke-width="1.5" rx="1"/>`;
      for (let i = 1; i < w * 2; i++) b += `<line x1="${x + 1 + (i * (W - 4)) / (w * 2)}" y1="${y + 4}" x2="${x + 1 + (i * (W - 4)) / (w * 2)}" y2="${y + H - 6}" stroke="#a7b1c3" stroke-width="1"/>`;
    } else {
      const roof = ROOF[(l.v + l.w) % ROOF.length]!;
      b += `<rect x="${x + 1}" y="${y + 1}" width="${W - 2}" height="${H - 2}" fill="${roof}" stroke="#3a2d22" stroke-width="1" rx="1"/>`;
      // The ridge, along the street.
      if (l.facing === "S") b += `<line x1="${x + 3}" y1="${y + H / 2}" x2="${x + W - 3}" y2="${y + H / 2}" stroke="#0005" stroke-width="1.5"/>`;
      else b += `<line x1="${x + W / 2}" y1="${y + 3}" x2="${x + W / 2}" y2="${y + H - 3}" stroke="#0005" stroke-width="1.5"/>`;
    }
    // Its front: a bright edge on the street side.
    const fc = l.kind === "home" ? "#fff" : WALL[(l.v * 3 + l.w) % WALL.length]!;
    if (l.facing === "S") b += `<rect x="${x + 1}" y="${y + H - 5}" width="${W - 2}" height="4" fill="${fc}" stroke="#3a2d22" stroke-width="0.8"/>`;
    else b += `<rect x="${x + 1}" y="${y + 1}" width="4" height="${H - 2}" fill="${fc}" stroke="#3a2d22" stroke-width="0.8"/>`;
    if (l.side) b += `<rect x="${x + 1}" y="${y + 1}" width="3" height="${H - 2}" fill="${fc}" opacity="0.7"/>`;
  }
}
// Props.
for (const p of PROPS) {
  const cx = X(p.x) + S / 2, cy = Y(p.y) + S / 2;
  if (p.kind === "tree") b += `<circle cx="${cx}" cy="${cy}" r="${S * 0.46}" fill="${C.tree}" stroke="#2c6b28"/>`;
  if (p.kind === "bush") b += `<circle cx="${cx}" cy="${cy}" r="${S * 0.25}" fill="#5d9a4a"/>`;
  if (p.kind === "bench") b += `<rect x="${cx - S * 0.35}" y="${cy - 3}" width="${S * 0.7}" height="6" fill="#8a5a33"/>`;
  if (p.kind === "lamp") b += `<circle cx="${cx}" cy="${cy}" r="2.6" fill="#1f2530"/>`;
  if (p.kind === "hedge") b += Math.abs(p.x % 1) > 0.3 ? `<rect x="${X(p.x) + S / 2 - 3}" y="${Y(p.y)}" width="6" height="${S}" fill="#3f7a32"/>` : `<rect x="${X(p.x)}" y="${cy - 3}" width="${S}" height="6" fill="#3f7a32"/>`;
  if (p.kind === "shed") b += `<rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" fill="#9a6a43" stroke="#5a3a22"/>`;
  if (p.kind === "bed") b += `<rect x="${cx - 7}" y="${cy - 3}" width="14" height="6" fill="#ff8fb3" stroke="#6e4a2c"/>`;
  if (p.kind === "fountain") b += `<circle cx="${X(p.x) + S / 2}" cy="${Y(p.y + 1.5) + S}" r="${S * 0.95}" fill="${C.water}" stroke="#fff" stroke-width="2"/>`;
}
for (const t of TABLES) b += `<rect x="${X(t.c) + 3}" y="${Y(t.r) + 3}" width="${S - 6}" height="${S - 6}" fill="#6b4a2a"/><rect x="${X(t.c - 1) + 6}" y="${Y(t.r) + 6}" width="${S - 12}" height="${S - 12}" fill="#cfc4ad"/><rect x="${X(t.c + 1) + 6}" y="${Y(t.r) + 6}" width="${S - 12}" height="${S - 12}" fill="#cfc4ad"/>`;
// Camera arrows: north on the east-west streets (and the park and plaza), east on Seam Avenue.
const arrow = (x: number, y: number, dx: number, dy: number) => `<line x1="${x - dx * 9}" y1="${y - dy * 9}" x2="${x + dx * 9}" y2="${y + dy * 9}" stroke="#1f2530" stroke-width="3" marker-end="url(#ar)"/>`;
for (const s of STREETS) {
  if (s.axis === "EW") {
    const yy = Y(s.r0 + 1.5) + S / 2;
    for (let c = s.c0 + 3; c <= s.c1; c += 7) {
      const cc = ((c % N) + N) % N;
      if (cc >= 42 || cc <= 3) continue; // (the crossing with Seam Avenue: the camera turns there)
      b += arrow(X(cc) + S / 2, yy, 0, -1);
    }
  } else {
    for (let r = 4; r < N; r += 6) {
      if ([[12, 17], [20, 25], [29, 34], [42, 46]].some(([a, z]) => r >= a! && r <= z!)) continue;
      b += arrow(X(45.5) + S / 2 - S * 0.5, Y(r) + S / 2, 1, 0);
      b += arrow(X(-0.5) + S / 2 + S * 0.5 + N * S, Y(r) + S / 2, 1, 0);
      b += arrow(X(0) + S / 2, Y(r) + S / 2, 1, 0);
    }
  }
}
b += arrow(X(22.5) + S / 2, Y(10) + S / 2, 0, -1);
b += arrow(X(22.5) + S / 2, Y(5) + S / 2, 0, -1);
b += `</g>`;
// The seams.
b += `<rect x="${ox}" y="${oy}" width="${N * S}" height="${N * S}" fill="none" stroke="#1f2530" stroke-width="2" stroke-dasharray="8 5"/>`;
// Street names.
const label = (x: number, y: number, t: string, rot = 0, size = 13) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="700" fill="#1f2530" text-anchor="middle" paint-order="stroke" stroke="#fff8" stroke-width="3" ${rot ? `transform="rotate(${rot} ${x} ${y})"` : ""}>${esc(t)}</text>`;
b += label(X(12), Y(45) + S + 5, "Seam Street (the Gallery) · half up here...");
b += label(X(34), Y(0) + 5, "...and half down here: one street across the seam");
b += label(X(7.5), Y(14.5) + 5, "Fountain Street (Fire & Ice)");
b += label(X(38), Y(14.5) + 5, "Fountain Street");
b += label(X(7.5), Y(22.5) + 5, "Colosseum Row (the Funfair)");
b += label(X(38), Y(22.5) + 5, "Colosseum Row");
b += label(X(7.5), Y(31.5) + 5, "Upper Street (the Meadow)");
b += label(X(38), Y(31.5) + 5, "Upper Street");
b += label(X(0.5), Y(24), "Seam Avenue (looks east)", -90, 12);
b += label(X(22.5) + S / 2, Y(6) + 5, "South Lane", -90, 11);
b += label(X(22.5) + S / 2, Y(22.5) + 10, "the plaza", 0, 11);
b += label(X(16.5), Y(10.2), "the park", 0, 12);
// Home names.
for (const l of LOTS) {
  if (l.kind !== "home") continue;
  const info = HOME_INFO[l.id as HomeId];
  const [cx, cy] = l.facing === "S" ? [X(l.c0) + (l.w * S) / 2, Y(l.r0 + l.d - 1) + (l.d * S) / 2] : [X(l.c0) + (l.d * S) / 2, Y(l.r0 + l.w - 1) + (l.w * S) / 2];
  b += `<text x="${cx}" y="${cy + 4}" font-size="11.5" font-weight="800" fill="#fff" text-anchor="middle" paint-order="stroke" stroke="#0009" stroke-width="3">${esc(info.boss)}</text>`;
}
// The key and the numbers.
const kx = ox + N * S + 34;
let ky = oy + 10;
const sw = (fill: string, text: string, extra = "") => {
  const s = `<rect x="${kx}" y="${ky - 12}" width="18" height="16" fill="${fill}" stroke="#3a2d22" stroke-width="0.8" ${extra}/><text x="${kx + 28}" y="${ky + 1}" font-size="14" fill="${C.ink}">${esc(text)}</text>`;
  ky += 24;
  return s;
};
const head = (t: string) => {
  const s = `<text x="${kx}" y="${ky + 8}" font-size="17" font-weight="700" fill="${C.ink}">${esc(t)}</text>`;
  ky += 32;
  return s;
};
const line = (t: string, size = 13.5) => {
  const s = `<text x="${kx}" y="${ky}" font-size="${size}" fill="${C.ink}">${esc(t)}</text>`;
  ky += 19;
  return s;
};
b += head("Key");
b += sw(C.dark, "Street: the chessboard (4 squares wide)");
b += sw(C.pave, "Sidewalk (1 square), the park's walks, the apron");
b += sw(C.grass, "The park's lawns");
b += sw(C.garden, "Back gardens (the near side of every street)");
b += sw("#b8453a", "An everyday building (roof); its pale edge is its front");
b += sw("#3fae4f", "A boss home (all 16): stands out, can be entered");
b += sw("#8792a6", "A bigger building behind the rows (can't be reached)");
b += `<line x1="${kx}" y1="${ky - 4}" x2="${kx + 18}" y2="${ky - 4}" stroke="#1f2530" stroke-width="3" marker-end="url(#ar)"/><text x="${kx + 28}" y="${ky + 1}" font-size="14" fill="${C.ink}">Which way the camera faces there</text>`;
ky += 24;
b += `<line x1="${kx}" y1="${ky - 4}" x2="${kx + 18}" y2="${ky - 4}" stroke="#1f2530" stroke-width="2" stroke-dasharray="5 3"/><text x="${kx + 28}" y="${ky + 1}" font-size="14" fill="${C.ink}">The wrap's seams (nothing shows there in the game)</text>`;
ky += 34;
b += head("The numbers");
const homes = LOTS.filter((l) => l.kind === "home").length;
const houses = LOTS.filter((l) => l.kind === "house").length;
const talls = LOTS.filter((l) => l.kind === "tall").length;
const frontage = LOTS.filter((l) => l.kind !== "tall").reduce((s, l) => s + l.w, 0);
for (const t of [
  `Streets 4 squares of board; a sidewalk of 1 each side.`,
  `Lots 3 deep. Fronts: boss homes 4 wide (6 for the pyramid),`,
  `everyday ones 2 or 3, bigger ones behind 2 or 4.`,
  `${homes} boss homes, ${houses} everyday fronts, ${talls} bigger buildings behind;`,
  `${frontage} squares of street front in all.`,
  `Five streets: Seam Street (36 squares of front), Fountain,`,
  `Colosseum Row and Upper Street (20 each, either side of the`,
  `seam), Seam Avenue (11 of its own, plus 4 corner side walls).`,
  `The park: 20 × 12, the promenade and the new walk 4 wide,`,
  `${TABLES.length} tables (3 in each lawn), the fountain at the crossing.`,
  `The Colosseum where it is today (12 × 12), in its own grove.`,
]) b += line(t);
ky += 14;
b += head("The quarters (Eric's pairs side by side)");
for (const t of [
  "Seam Street, the Gallery: Puddles, Smudgy | Folio, Alfil",
  "Fountain Street, Fire & Ice: Timber, Sawyer | Ginger, Jefferson",
  "Colosseum Row, the Funfair: Boingo, Babur | Big Boy, Dash",
  "Upper Street, the Meadow: Chub & Chirp, Wrangler | Moo & Moon, Hollow",
  "Seam Avenue: everyday fronts only",
]) b += line(t);
ky += 14;
b += head("Getting round");
for (const t of [
  "The park's four walks lead out: north onto Colosseum Row (the",
  "plaza), west and east along Fountain Street, south down South",
  "Lane onto Seam Street. Seam Avenue crosses every street at the",
  "seam; Upper Street ends at the Colosseum's grove on both sides.",
  "The camera faces north everywhere but Seam Avenue (east), and",
  "turns at its four crossings.",
]) b += line(t);

const w = kx + 560, h = Math.max(oy + N * S + 30, ky + 20);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:${C.bg}}text{font-family:Inter,Arial,sans-serif}</style></head><body><svg id=s xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${C.bg}"/>${b}</svg></body></html>`;
const browser = await chromium.launch(existsSync(chromium.executablePath()) ? {} : { executablePath: "/opt/pw-browsers/chromium", args: ["--headless", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5 });
await page.setContent(html);
await page.locator("#s").screenshot({ path: out });
await browser.close();
console.log(`wrote ${out} (${homes} homes, ${houses} everyday, ${talls} behind, ${frontage} squares of front; ${DESIGN_NAMES.cottage ? "" : ""})`);
