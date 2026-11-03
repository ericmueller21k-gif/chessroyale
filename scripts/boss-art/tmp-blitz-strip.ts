import { writeFileSync } from "node:fs";
import { renderFrame, type Character } from "../../packages/app/src/characters/sprite.ts";
import { blank, blit, png } from "./render.ts";
const [file, exp, out, scArg, bg] = process.argv.slice(2) as [string, string, string, string?, string?];
const M = await import(file);
const ch = M[exp] as Character;
const sc = Number(scArg ?? 2);
const names = Object.keys(ch.anims);
const rows = names.map((n) => ch.anims[n]!.frames);
const maxN = Math.max(...rows.map((r) => r.length));
const cols = Math.min(maxN, 8);
const rowCount = rows.reduce((s, r) => s + Math.ceil(r.length / cols), 0);
const o = blank((ch.w + 2) * cols * sc, (ch.h + 2) * rowCount * sc, bg ?? "#c9b48e");
let ry = 0;
for (const r of rows) {
  r.forEach((f, i) => {
    const im = renderFrame(ch, f);
    blit(o, im, ((i % cols) * (ch.w + 2)) * sc, (ry + Math.floor(i / cols)) * (ch.h + 2) * sc, sc);
  });
  ry += Math.ceil(r.length / cols);
}
writeFileSync(out, png(o));
console.log(names.map((n, i) => `${n}:${rows[i]!.length}`).join(" "), o.w, o.h);
