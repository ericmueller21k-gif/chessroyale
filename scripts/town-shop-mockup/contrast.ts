// MOCKUP ONLY: each board skin's numbers. npx tsx scripts/town-shop-mockup/contrast.ts
import { SKINS } from "../../packages/app/src/dev/town-shop-skins.ts";
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
const over = (base: number[], rgba: string) => { const m = rgba.match(/[\d.]+/g)!.map(Number); return base.map((v, i) => v * (1 - m[3]!) + m[i]! * m[3]!); };
const dist = (a: number[], b: number[]) => Math.round(Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!));
console.log("| Board | light | dark | black piece on dark | light vs dark | last move on light / dark (RGB distance from the plain square) | dot on light / dark (contrast) | check red vs dark (RGB distance) |");
console.log("|---|---|---|---|---|---|---|---|");
for (const s of SKINS) {
  const L = rgb(s.light), D = rgb(s.dark);
  console.log(`| ${s.name} | ${s.light} | ${s.dark} | ${ratio([0, 0, 0], D).toFixed(1)}:1 | ${ratio(L, D).toFixed(2)}:1 | ${dist(over(L, s.last), L)} / ${dist(over(D, s.last), D)} | ${ratio(over(L, s.dot), L).toFixed(2)} / ${ratio(over(D, s.dot), D).toFixed(2)} | ${dist([231, 0, 0], D)} |`);
}
